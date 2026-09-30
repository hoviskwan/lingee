import { $ } from '../core/dom.js';
/* 登录鉴权
   拆分自 src/scripts/main.js，逻辑逐行保留；副作用集中在下方 init* 函数里，
   由 main.js 按拆分前的原始顺序调用。 */


/* ---------- 登录鉴权 ---------- */
var loginOverlay=$('#loginOverlay');
var loginForm=$('#loginForm');
var loginBtn=$('#loginBtn');
var loginError=$('#loginError');
var LOGIN_KEY='lingee_auth_session';
var REMEMBER_KEY='lingee_remember_user';

/* 账号 → 角色：登录后进入对应角色
   原有账号为全功能（所有者）；虚拟账号按角色；密码统一 */
var ACCOUNTS={
  /* 原有账号（全功能） */
  'wuhc2023@gmail.com':{pass:'lingee520',role:'owner',name:'吴宏超',avatar:'吴'},
  '17299999999':{pass:['KDadm!@#2022','lingee520'],role:'owner',name:'张工',avatar:'张'},
  'wei_bu@kingdee.com':{pass:'lingee520',role:'owner',name:'Wei',avatar:'W'},
  '6686612@qq.com':{pass:'lingee520',role:'owner',name:'吴晓锋',avatar:'吴'},
  'liangpingxian@gmail.com':{pass:'lingee520',role:'owner',name:'Xian',avatar:'L'},
  /* 团队人员账号（账号 = 姓名） */
  '吴宏超':{pass:'lingee520',role:'owner',name:'吴宏超',avatar:'吴'},
  '部伟':{pass:'lingee520',role:'owner',name:'部伟',avatar:'部'},
  '张利军':{pass:'lingee520',role:'owner',name:'张利军',avatar:'张'},
  '王育权':{pass:'lingee520',role:'owner',name:'王育权',avatar:'王'},
  '付鹏城':{pass:'lingee520',role:'owner',name:'付鹏城',avatar:'付'},
  '陈惠琼':{pass:'lingee520',role:'owner',name:'陈惠琼',avatar:'陈'},
  '吴晓锋':{pass:'lingee520',role:'owner',name:'吴晓锋',avatar:'吴'},
  '钟伟纯':{pass:'lingee520',role:'owner',name:'钟伟纯',avatar:'钟'},
  '刘鉴洲':{pass:'lingee520',role:'owner',name:'刘鉴洲',avatar:'刘'},
  '陈谨':{pass:'lingee520',role:'owner',name:'陈瑾',avatar:'陈'},
  '陈瑾':{pass:'lingee520',role:'owner',name:'陈瑾',avatar:'陈'},
  '陈来珍':{pass:'lingee520',role:'owner',name:'陈来珍',avatar:'陈'},
  '暴福音':{pass:'lingee520',role:'owner',name:'暴福音',avatar:'暴'},
  '荆龙刚':{pass:'lingee520',role:'owner',name:'荆龙刚',avatar:'荆'},
  '梁平贤':{pass:'lingee520',role:'owner',name:'梁平贤',avatar:'梁'},
  /* 虚拟账号（按角色） */
  'owner':{pass:'lingee520',role:'owner',name:'吴宏超',avatar:'吴'},
  'project_manager':{pass:'lingee520',role:'pm',name:'赵琳',avatar:'赵'},
  'dev':{pass:'lingee520',role:'dev',name:'张工',avatar:'张'},
  'pm':{pass:'lingee520',role:'pm',name:'赵琳',avatar:'赵'},
  'qa':{pass:'lingee520',role:'qa',name:'陈晨',avatar:'陈'},
  'ops':{pass:'lingee520',role:'ops',name:'周杰',avatar:'周'}
};

/* 仅暴露可登录账号的公开资料，供协作人员选择；不包含密码和演示角色账号。 */
var LOGIN_PEOPLE_IDS={
  'wuhc2023@gmail.com':'p22','17299999999':'p01','6686612@qq.com':'p23','66866':'p23',
  '吴宏超':'p22','部伟':'p29','张利军':'p30','王育权':'p31','付鹏城':'p32',
  '陈惠琼':'p33','吴晓锋':'p23','钟伟纯':'p35','刘鉴洲':'p36','陈谨':'p37',
  '陈来珍':'p38','暴福音':'p39','荆龙刚':'p40','梁平贤':'p41','陈瑾':'p37',
  'owner':'p22','dev':'p01','project_manager':'p04','pm':'p04','qa':'p05','ops':'p07'
};
export function getLoginPersonId(){ return LOGIN_PEOPLE_IDS[getAuthedUser()] || ''; }
function getLoginPeople(){
  return Object.keys(ACCOUNTS).filter(function(account){return account.includes('@')||/^\d{11}$/.test(account);}).map(function(account){
    var profile=ACCOUNTS[account];
    return {id:LOGIN_PEOPLE_IDS[account]||'login:'+account,name:profile.name,account:account,
      phone:/^\d{11}$/.test(account)?account:'',email:account.includes('@')?account:''};
  });
}

/* 演示角色：不同角色登录后看到不同视图（权限差异演示） */
var DEMO_ROLES=[
  {id:'owner',label:'管理员',name:'吴宏超',avatar:'吴',desc:'项目管理 · 系统集成'},
  {id:'dev',  label:'开发',  name:'张工',  avatar:'张', desc:'任务执行 · 代码评审 · 专家协作'},
  {id:'pm',   label:'需求',  name:'赵琳',  avatar:'赵', desc:'需求创建 · 需求评审'},
  {id:'qa',   label:'测试',  name:'陈晨',  avatar:'陈', desc:'测试评审 · 用例产物'},
  {id:'ops',  label:'运维',  name:'周杰',  avatar:'周', desc:'部署发布 · 运维产物'}
];
var ROLE_KEY='lingee_demo_role';
function getRole(){ try{ var role=sessionStorage.getItem(ROLE_KEY)||'owner'; return role==='project_manager'?'pm':role; }catch(e){ return 'owner'; } }
function setRole(r){ try{ sessionStorage.setItem(ROLE_KEY,r); }catch(e){} }
/* 按角色在 body 上打标记，具体可见性交给 CSS（data-perm 属性） */
function applyRole(){ if(document.body) document.body.setAttribute('data-role',getRole()); }
function applyRoleUser(r){
  var av=$('#userAvatar'),nm=$('#userName'),tag=$('#userRoleTag');
  if(av) av.textContent=r.avatar;
  if(nm) nm.textContent=r.name;
  if(!tag){
    var nb=nm&&nm.parentNode;
    if(nb){ tag=document.createElement('span'); tag.id='userRoleTag'; tag.className='user-role-tag'; nb.insertBefore(tag,nm.nextSibling); }
  }
  if(tag) tag.textContent=r.label;
}

function getAuthedUser(){
  try{ return sessionStorage.getItem(LOGIN_KEY)||null; }catch(e){ return null; }
}
function setAuthed(user){
  try{ sessionStorage.setItem(LOGIN_KEY,user); }catch(e){}
}
function applyUserInfo(user){
  var acc=ACCOUNTS[user]||{name:'吴晓锋',avatar:'吴',role:'owner'};
  var av=$('#userAvatar'),nm=$('#userName');
  if(av) av.textContent=acc.avatar;
  if(nm) nm.textContent=acc.name;
  var tag=$('#userRoleTag');
  if(!tag){
    var nb=nm&&nm.parentNode;
    if(nb){ tag=document.createElement('span'); tag.id='userRoleTag'; tag.className='user-role-tag'; nb.insertBefore(tag,nm.nextSibling); }
  }
  if(tag) tag.textContent=(DEMO_ROLES.filter(function(r){return r.id===acc.role;})[0]||{}).label||'管理员';
}
/* 登录框登录后仍留在 DOM 里，Chrome 会把整页当登录页，
   往搜索框之类的文本框推荐保存的账号。禁用掉就不再是自动填充来源。 */
var _loginFormHome=null, _loginFormNode=null;
function setLoginFieldsEnabled(on){
  var form=$('#loginForm');
  if(on){
    /* 密码框在初始 HTML 里是 type="text"，到这里才变回 password。
       Chrome 在解析阶段就靠 type="password" 判定「这是登录页」，
       一旦判定，本页任何文本框聚焦时都会被推荐保存的账号。 */
    var pw=$('#loginPass');
    if(pw && pw.hasAttribute('data-pw')) pw.setAttribute('type','password');
  }
  if(!on){
    /* 登录成功后把整个表单摘出 DOM。只 disabled 不够：Chrome 仍会把本页当登录页，
       往任意文本框推荐保存的账号（会被当成搜索关键词，把列表筛空）。 */
    if(form){ _loginFormHome=form.parentNode; _loginFormNode=form; form.remove(); }
  }else if(_loginFormNode && _loginFormHome && !_loginFormNode.isConnected){
    _loginFormHome.appendChild(_loginFormNode);
  }
}
function showLogin(){
  if(loginOverlay) loginOverlay.classList.remove('hidden');
  setLoginFieldsEnabled(true);
}
function hideLogin(){
  if(loginOverlay) loginOverlay.classList.add('hidden');
  setLoginFieldsEnabled(false);
}

/* 原型免登录：保留身份模型供任务、项目等模块识别“当前用户”，
   首次打开时自动使用吴晓锋账号，已有会话身份则继续沿用。 */
var DEFAULT_USER='6686612@qq.com';
var _authedUser=getAuthedUser()||DEFAULT_USER;
if(!getAuthedUser()) setAuthed(_authedUser);

export function initLogin() {
  /* 恢复记住的账号和密码 */
  try{
    var saved=localStorage.getItem(REMEMBER_KEY);
    if(saved){
      saved=JSON.parse(saved);
      var inp=$('#loginUser'); if(inp) inp.value=saved.u||'';
      var pp=$('#loginPass'); if(pp) pp.value=saved.p||'';
      var cb=$('#loginRemember'); if(cb) cb.checked=true;
    }
  }catch(e){}

  if(loginForm){
    loginForm.addEventListener('submit',function(e){
      e.preventDefault();
      var user=$('#loginUser').value.trim();
      var pass=$('#loginPass').value.trim();
      if(!user||!pass){
        loginError.textContent='请输入账号和密码';
        return;
      }
      var acc=ACCOUNTS[user];
      var passOk=acc && (acc.pass===pass || (Array.isArray(acc.pass)&&acc.pass.indexOf(pass)>=0));
      if(passOk){
        loginError.textContent='';
        loginBtn.classList.add('loading');
        loginBtn.disabled=true;
        loginBtn.textContent='登录中';
        var remember=$('#loginRemember');
        try{
          if(remember&&remember.checked) localStorage.setItem(REMEMBER_KEY,JSON.stringify({u:user,p:pass}));
          else localStorage.removeItem(REMEMBER_KEY);
        }catch(e){}
        setTimeout(function(){
          setAuthed(user);
          setRole(acc.role);
          applyUserInfo(user);
          applyRole();
          hideLogin();
          document.dispatchEvent(new Event('lingee:auth-changed'));
          loginBtn.classList.remove('loading');
          loginBtn.disabled=false;
          loginBtn.textContent='登录';
        },800);
      }else{
        loginError.textContent='账号或密码错误，请重试';
        $('#loginPass').value='';
        $('#loginPass').focus();
      }
    });
    loginBtn.addEventListener('click',function(){});

  /* 登录页全局回车快捷键 */
  document.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&loginOverlay&&!loginOverlay.classList.contains('hidden')&&loginBtn&&!loginBtn.disabled)
      loginForm.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
  });
  /* Ctrl+Alt+Enter 一键登录（演示用，免账号密码） */
  document.addEventListener('keydown',function(e){
    if(e.ctrlKey&&e.altKey&&e.key==='Enter'&&loginOverlay&&!loginOverlay.classList.contains('hidden')){
      var demoUser='66866';
      loginBtn.classList.add('loading');
      loginBtn.disabled=true;
      loginBtn.textContent='登录中';
      setTimeout(function(){
        setAuthed(demoUser);
        setRole('owner');
        applyUserInfo(demoUser);
        applyRole();
        hideLogin();
        document.dispatchEvent(new Event('lingee:auth-changed'));
        loginBtn.classList.remove('loading');
        loginBtn.disabled=false;
        loginBtn.textContent='登录';
      },300);
    }
  });
  }
  applyRole();
  var _r=DEMO_ROLES.filter(function(x){return x.id===getRole();})[0];
  if(_r && String(_authedUser).indexOf('demo:')===0) applyRoleUser(_r); else applyUserInfo(_authedUser);
  hideLogin();
}

export { DEMO_ROLES, LOGIN_KEY, REMEMBER_KEY, _authedUser, applyRole, getLoginPeople, getRole, loginError, loginForm, showLogin };
