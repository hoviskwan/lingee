import { $, $$ } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { showView } from '../core/view.js';
import { openChangelog } from './changelog.js';

import { chatResizer } from './composer.js';
import { LOGIN_KEY, REMEMBER_KEY, loginError, loginForm, showLogin } from './login.js';
/* 侧边栏：滚动条、用户菜单、图标功能、分段页签、分组折叠
   拆分自 src/scripts/main.js，逻辑逐行保留；副作用集中在下方 init* 函数里，
   由 main.js 按拆分前的原始顺序调用。 */


/* ---------- 滚动条：滚动时显示，停留后延迟隐藏 ---------- */
var _scrollTimers=new WeakMap();
var _sbHideDelay=1500;
var _sbHovered=null;
var _sbDragging=false;
function _sbSchedule(t){
  var old=_scrollTimers.get(t);
  if(old)clearTimeout(old);
  _scrollTimers.set(t,setTimeout(function(){
    /* 指针停在该滚动区内或正在拖拽滑块时不隐藏，避免够不到 */
    if(_sbHovered===t||_sbDragging){ _sbSchedule(t); return; }
    t.classList.remove('scrolling');
  },_sbHideDelay));
}
/* ---------- 用户菜单：头像 / 姓名 ---------- */
var userWrap=$('.user-wrap'), userBtn=$('#userBtn');
function closeUserMenu(){
  if(!userWrap)return;
  userWrap.classList.remove('open');
  if(userBtn) userBtn.setAttribute('aria-expanded','false');
}
var userMenuSettings=$('#userMenuSettings');
var userMenuLogout=$('#userMenuLogout');
/* ---------- 侧边栏图标功能 ---------- */
var sbSearchIcon=$('#sbSearchIcon');
var sbCollapseIcon=$('#sbCollapseIcon');
var sbSearch=$('#sbSearch');
var sbSearchInput=$('#sbSearchInput');
var sidebarEl=$('.sidebar');
var newProjectIcon=$('#newProjectIcon');
var viewToggleIcon=$('#viewToggleIcon');
var sbScroll=$('.sb-scroll');
/* 搜索：点击展开/收起 */
var sbSearchClose=$('#sbSearchClose');
function closeSbSearch(){
  sbSearch.classList.remove('show');
  sbSearchInput.value='';
  filterSidebar('');
}
function filterSidebar(q){
  q=q.trim().toLowerCase();
  $$('.sub-item, .flat-item, .chat-session-entry',sbScroll).forEach(function(item){
    var txt=item.textContent.trim().toLowerCase();
    var folder=item.closest('.chat-project-folder');
    var folderMatches=folder && folder.querySelector('.chat-project-title')?.textContent.trim().toLowerCase().includes(q);
    item.style.display=(!q||txt.indexOf(q)>-1||folderMatches)?'':'none';
  });
  var sessionSection=document.getElementById('chatSessionSection');
  if(sessionSection) sessionSection.hidden=!$$('.chat-session-entry',sessionSection).some(function(item){ return item.style.display!=='none'; });
  $$('.chat-project-folder',sbScroll).forEach(function(folder){
    folder.hidden=!$$('.chat-session-entry',folder).some(function(item){ return item.style.display!=='none'; });
  });
  $$('.group-head',sbScroll).forEach(function(h){
    if(!q){ h.style.display=''; return; }
    var group=h.nextElementSibling;
    var hasVisible=false;
    while(group && !group.classList.contains('group-head') && !group.classList.contains('section-label')){
      if(group.classList.contains('sub-item') && group.style.display!=='none'){ hasVisible=true; break; }
      group=group.nextElementSibling;
    }
    h.style.display=hasVisible?'':'none';
  });
  document.dispatchEvent(new Event('lingee:sidebar-filter'));
}
/* 侧边栏宽度变化时，把腾出/占用的空间给预览区，保持会话区宽度不变 */
var _prevWishW=null;
function absorbSidebarDelta(fn){
  var view=document.getElementById('view-chat');
  var ps=document.getElementById('chatPreviewSide');
  var open=view&&view.classList.contains('preview-open')&&ps;
  var before=open?sidebarEl.offsetWidth:0;
  fn();
  if(!open)return;
  var delta=before-sidebarEl.offsetWidth;
  if(!delta)return;
  var want=(_prevWishW==null?ps.offsetWidth:_prevWishW)+delta;
  _prevWishW=want;
  var w=want;
  var maxW=view.offsetWidth-360-(chatResizer?chatResizer.offsetWidth:1);
  if(w>maxW)w=maxW;
  if(w<200)w=200;
  ps.style.width=w+'px';
  try{localStorage.setItem('chatPreviewWidth',w+'px')}catch(e){}
}
/* 收起/展开侧边栏（折叠状态持久化到 localStorage） */
function syncCollapseIcon(){
  if(!sbCollapseIcon)return;
  var collapsed=sidebarEl.classList.contains('collapsed');
  sbCollapseIcon.setAttribute('data-tooltip',collapsed?'展开侧边栏':'收起侧边栏');
  sbCollapseIcon.innerHTML=collapsed
    ? '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>'
    : '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>';
}
function setSidebarCollapsed(collapsed){
  absorbSidebarDelta(function(){ sidebarEl.classList.toggle('collapsed',collapsed); });
  syncCollapseIcon();
  try{localStorage.setItem('sidebarCollapsed',collapsed?'1':'0')}catch(e){}
}
/* 展开侧边栏浮动按钮 */
var expandBtn=$('#expandSidebarBtn');

export function initScrollbar() {
  document.addEventListener('scroll',function(e){
    var t=e.target;
    if(t&&t.nodeType===1&&t!==document){
      t.classList.add('scrolling');
      _sbSchedule(t);
    }
  },true);
  document.addEventListener('mouseover',function(e){
    var t=e.target;
    while(t&&t.nodeType===1){
      if(t.classList&&t.classList.contains('scrolling')){ _sbHovered=t; return; }
      t=t.parentElement;
    }
    _sbHovered=null;
  },true);
  document.addEventListener('mousedown',function(){_sbDragging=true},true);
  document.addEventListener('mouseup',function(){
    _sbDragging=false;
    if(_sbHovered)_sbSchedule(_sbHovered);
  },true);
}

export function initUserMenu() {
  if(userBtn){
    userBtn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=!userWrap.classList.contains('open');
      userWrap.classList.toggle('open',open);
      userBtn.setAttribute('aria-expanded',open?'true':'false');
    });
    userBtn.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); userBtn.click(); }
    });
    document.addEventListener('click',function(e){
      if(userWrap&&!userWrap.contains(e.target)) closeUserMenu();
    });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeUserMenu(); });
  }
  var userMenuAnalytics=$('#userMenuAnalytics');
  if(userMenuAnalytics){
    userMenuAnalytics.addEventListener('click',function(){
      closeUserMenu();
      showView('analytics');
      $$('.nav-item').forEach(function(n){n.classList.remove('active')});
    });
  }
  if(userMenuSettings){
    userMenuSettings.addEventListener('click',function(){
      closeUserMenu();
      showView('settings');
      $$('.nav-item').forEach(function(n){n.classList.remove('active')});
    });
  }
  var userMenuChangelog=$('#userMenuChangelog');
  if(userMenuChangelog){
    userMenuChangelog.addEventListener('click',function(){
      closeUserMenu();
      openChangelog();
    });
  }
  if(userMenuLogout) userMenuLogout.addEventListener('click',function(){
    closeUserMenu();
    try{ sessionStorage.removeItem(LOGIN_KEY); }catch(e){}
    try{ sessionStorage.removeItem('lingee_demo_role'); }catch(e){}
    if(document.body) document.body.removeAttribute('data-role');
    if(loginForm) loginForm.reset();
    if(loginError) loginError.textContent='';
    /* 重新回填记住的账号和密码 */
    try{
      var saved=localStorage.getItem(REMEMBER_KEY);
      if(saved){
        saved=JSON.parse(saved);
        var inp=$('#loginUser'); if(inp) inp.value=saved.u||'';
        var pp=$('#loginPass'); if(pp) pp.value=saved.p||'';
        var cb=$('#loginRemember'); if(cb) cb.checked=true;
      }
    }catch(e){}
    showLogin();
    $('#loginUser').focus();
  });
}

export function initSidebarIcons() {
  if(sbSearchIcon){
    sbSearchIcon.addEventListener('click',function(){
      sbSearch.classList.toggle('show');
      if(sbSearch.classList.contains('show')){
        sbSearchInput.focus();
      }else{
        closeSbSearch();
      }
    });
    sbSearchInput.addEventListener('input',function(){ filterSidebar(this.value); });
    sbSearchInput.addEventListener('keydown',function(e){
      if(e.key==='Escape'){ closeSbSearch(); sbSearchIcon.focus(); }
    });
  }
  if(sbSearchClose){
    sbSearchClose.addEventListener('click',closeSbSearch);
  }
  /* 刷新后保持折叠状态：先于首帧应用，避免展开再收起的闪动 */
  if(localStorage.getItem('sidebarCollapsed')==='1'){
    sidebarEl.classList.add('collapsed');
  }
  syncCollapseIcon();
  if(sbCollapseIcon){
    sbCollapseIcon.addEventListener('click',function(){
      setSidebarCollapsed(!sidebarEl.classList.contains('collapsed'));
    });
  }
  if(expandBtn){
    expandBtn.addEventListener('click',function(){ setSidebarCollapsed(false); });
  }
  /* 新增项目 */
  if(newProjectIcon){
    newProjectIcon.addEventListener('click',function(e){
      e.stopPropagation();
      var fi=document.createElement('input');
      fi.type='file';
      fi.addEventListener('change',function(){
        if(fi.files.length>0) toast('已选择文件：'+fi.files[0].name);
      });
      fi.click();
    });
  }
  /* 显示设置：分组依据（对齐工程的 kcode.nav.groupBy：Project / Date / None） */
  var displayDd=$('#displayDd');
  if(viewToggleIcon && displayDd){
    var groupByValue=$('#groupByValue');
    var groupByItem=$('#groupByItem');
    var groupByMenu=$('#groupByMenu');
    var GROUP_LABELS={project:'Project',date:'Date',none:'None'};
    var DATE_BUCKETS=[{key:'today',label:'今天'},{key:'thisWeek',label:'本周'},{key:'earlier',label:'更早'}];
    var CHEVRON='<span class="group-chevron"><svg class="ic ic-down" viewBox="0 0 16 16" fill="none"><path d="M11.8619 5.5287C12.1223 5.26835 12.5443 5.26835 12.8046 5.5287C13.0649 5.78905 13.065 6.21109 12.8046 6.47141L9.03706 10.239C8.46432 10.8117 7.53562 10.8117 6.96284 10.239L3.19526 6.47141C2.93491 6.21106 2.93491 5.78905 3.19526 5.5287C3.45561 5.26835 3.87762 5.26835 4.13797 5.5287L7.90555 9.29628C7.95763 9.34825 8.04232 9.34831 8.09435 9.29628L11.8619 5.5287Z" fill="currentColor"/></svg><svg class="ic ic-right" viewBox="0 0 16 16" fill="none"><path d="M5.52827 3.19537C5.78862 2.93505 6.21064 2.93503 6.47098 3.19537L10.2386 6.96294C10.8113 7.53571 10.8113 8.46441 10.2386 9.03716L6.47098 12.8047C6.21065 13.0651 5.78862 13.065 5.52827 12.8047C5.26792 12.5444 5.26792 12.1224 5.52827 11.862L9.29585 8.09445C9.34786 8.0424 9.34784 7.95771 9.29585 7.90565L5.52827 4.13807C5.26792 3.87772 5.26792 3.45571 5.52827 3.19537Z" fill="currentColor"/></svg></span>';

    /* 可重排的行，以及每个父节点原本的子节点顺序——切回「按项目」时原样还原。
       只移动节点、不重建，事件监听因此不会丢。 */
    var rows=$$('.sub-item, .flat-item',sbScroll).filter(function(r){return !r.classList.contains('muted');});
    var parents=[];
    rows.forEach(function(r){ if(parents.indexOf(r.parentNode)<0) parents.push(r.parentNode); });
    var snap=parents.map(function(p){ return [p, [].slice.call(p.children)]; });
    function restoreHome(){ snap.forEach(function(s){ s[1].forEach(function(c){ s[0].appendChild(c); }); }); }

    var flatHost=document.createElement('div'); flatHost.className='sb-flat';
    var dateHost=document.createElement('div'); dateHost.className='sb-dates';
    sbScroll.appendChild(flatHost); sbScroll.appendChild(dateHost);

    function applyGrouping(mode){
      restoreHome();
      flatHost.textContent=''; dateHost.textContent='';
      sbScroll.setAttribute('data-grouping',mode);
      groupByValue.textContent=GROUP_LABELS[mode];
      $$('.menu-item',groupByMenu).forEach(function(it){
        it.classList.toggle('checked', it.getAttribute('data-group')===mode);
      });
      if(mode==='none'){
        rows.forEach(function(r){ flatHost.appendChild(r); });
      }else if(mode==='date'){
        DATE_BUCKETS.forEach(function(b){
          var bucket=rows.filter(function(r){ return r.getAttribute('data-date')===b.key; });
          if(!bucket.length) return;
          var g=document.createElement('div'); g.className='sb-date-group';
          var h=document.createElement('div'); h.className='group-head sb-date-head';
          h.innerHTML='<button class="group-toggle" type="button"><span class="group-label">'+b.label+'</span>'+CHEVRON+'</button>';
          g.appendChild(h);
          bucket.forEach(function(r){ g.appendChild(r); });
          h.addEventListener('click',function(){ g.classList.toggle('collapsed'); $('.group-chevron',h)?.classList.toggle('collapsed',g.classList.contains('collapsed')); });
          dateHost.appendChild(g);
        });
      }
    }

    var displayMenu=$('#displayMenu');
    viewToggleIcon.addEventListener('click',function(e){
      e.stopPropagation();
      displayDd.classList.remove('sub-open');
      var willOpen=!displayDd.classList.contains('open');
      displayDd.classList.toggle('open',willOpen);
      if(willOpen){
        var r=viewToggleIcon.getBoundingClientRect();
        displayMenu.style.left=Math.max(8,r.right-displayMenu.offsetWidth)+'px';
        displayMenu.style.top=(r.bottom+4)+'px';
      }
    });
    groupByItem.addEventListener('click',function(e){
      e.stopPropagation();
      var willOpen=!displayDd.classList.contains('sub-open');
      displayDd.classList.toggle('sub-open',willOpen);
      if(willOpen){
        var r=groupByItem.getBoundingClientRect();
        groupByMenu.style.left=(r.right+10)+'px';
        groupByMenu.style.top=r.top+'px';
      }
    });
    $$('.menu-item',groupByMenu).forEach(function(it){
      it.addEventListener('click',function(e){
        e.stopPropagation();
        applyGrouping(it.getAttribute('data-group'));
        displayDd.classList.remove('open','sub-open');
      });
    });
    document.addEventListener('click',function(e){
      if(!e.target.closest('#displayDd')) displayDd.classList.remove('open','sub-open');
    });

    applyGrouping('project');
  }
}

export function initSegmentedTabs() {
  /* ---------- segmented tabs (工作 / 开发) ---------- */
  $$('.seg-item').forEach(function(s){
    s.addEventListener('click',function(){
      $$('.seg-item').forEach(function(i){i.classList.remove('active')});
      s.classList.add('active');
      toast(s.textContent.trim());
    });
  });

  /* ---------- project groups collapse ---------- */
  $$('.project-group').forEach(function(g){
    var head=$('.group-head',g);
    if(!head) return;
    head.addEventListener('click',function(){
      g.classList.toggle('collapsed');
      head.classList.toggle('collapsed',g.classList.contains('collapsed'));
      $('.group-chevron',head)?.classList.toggle('collapsed',g.classList.contains('collapsed'));
      var c=$('.caret',head); if(c) c.classList.toggle('rot', g.classList.contains('collapsed'));
    });
  });
  // standalone second group-head (rotate its caret only)
  $$('.sb-scroll > .group-head').forEach(function(h){
    h.addEventListener('click',function(){
      h.classList.toggle('collapsed');
      $('.group-chevron',h)?.classList.toggle('collapsed');
      var c=$('.caret',h); if(c) c.classList.toggle('rot');
    });
  });
}

/* _prevWishW 由其它模块写回；import 绑定只读，所以走这个 setter */
export function set__prevWishW(v){ _prevWishW=v; return v; }

/* ---------- 项目操作下拉（打开文件夹 / 重命名 / 删除） ---------- */
export function initProjectActions(){
  $$('.project-dd').forEach(function(dd){
    var trigger=$('[data-chip]',dd);
    if(!trigger) return;
    trigger.addEventListener('click',function(e){
      e.stopPropagation();
      e.preventDefault();
      var willOpen=!dd.classList.contains('open');
      $$('.project-dd.open').forEach(function(o){ if(o!==dd) o.classList.remove('open'); });
      dd.classList.toggle('open',willOpen);
    });
    $$('.menu-item',dd).forEach(function(item){
      item.addEventListener('click',function(e){
        e.stopPropagation();
        var action=item.getAttribute('data-action');
        dd.classList.remove('open');
        if(action==='open-folder') toast('已打开文件夹');
        else if(action==='rename') toast('进入重命名模式');
        else if(action==='delete') toast('确认删除项目？','warn');
      });
    });
  });
  document.addEventListener('click',function(e){
    if(!e.target.closest('.project-dd'))
      $$('.project-dd.open').forEach(function(dd){ dd.classList.remove('open'); });
  });
  $$('[data-action="workspace-new-session"]').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      e.preventDefault();
      toast('新建会话');
    });
  });
}

export { _prevWishW, closeUserMenu, filterSidebar, sbCollapseIcon, sbSearch, sbSearchIcon, sbSearchInput };
