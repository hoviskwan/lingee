import { renderTaskBoard } from './task-board.js';
import { $, $$ } from '../../core/dom.js';
import { toast } from '../../core/toast.js';
import { setNavActive, setTasksEmbedded, showView } from '../../core/view.js';
import { cvRenderExperts } from './experts.js';
import { cvIsWorkspaceAdmin, cvSyncUrl, cvSyncWorkspacePermissions } from './projects.js';
import { xesc } from '../expert/data.js';
import { renderExpertGrid } from '../expert/library.js';
/* 协作开发：视图与页签切换
   拆分自 src/scripts/main.js，逻辑逐行保留；副作用集中在下方 init* 函数里，
   由 main.js 按拆分前的原始顺序调用。 */


/* ============ VIEW SWITCHING ============ */
function cvSwitchFilter(btn){
  var group=btn.closest('.filter-group');if(group){group.querySelectorAll('.filter-btn').forEach(function(b){b.classList.remove('filter-btn--active');});}
  btn.classList.add('filter-btn--active');
  cvApplyFilters();
}
function cvApplyFilters(){
  var taskView=document.getElementById('cv-tasks');
  if(taskView&&taskView.classList.contains('active')){
    renderTaskBoard();
  }
  var memberView=document.getElementById('cv-members');
  if(memberView&&memberView.classList.contains('active')){
    if(window.cvRenderProjectList) window.cvRenderProjectList();
  }
}
function cvGetFilterVal(view,type){
  var dd=view.querySelector('[data-cvfdd="'+type+'"]');
  if(dd){
    var on=dd.querySelector('.cv-fdd-item.on');
    return on?on.getAttribute('data-cvfdd-val'):null;
  }
  var g=view.querySelector('[data-filter-type="'+type+'"]');if(!g)return null;
  var a=g.querySelector('.filter-btn--active');return a?a.textContent.trim():null;
}
/* ---------- 面板切换 ---------- */
var cvInited=false, cvLastTab='tasks';
var cvPendingTab, cvPendingProj;   /* 由上面的 URL 恢复逻辑先行赋值，故此处不带初始值 */
/* 一级页签「设置」带二级子页签；cvSubState 记录当前停留的子视图 */
var cvSubState={config:'config'};
var CV_SUBS={
  config:[['config','工作区设置'],['config-perm','人员']]
};
function cvPrimaryOf(name){
  if(name==='config-perm') return 'config';
  return name;
}
function cvRenderSubNav(primary,active){
  var el=document.getElementById('cvSubNav');if(!el)return;
  var subs=CV_SUBS[primary];
  if(!subs){ el.classList.add('hidden'); el.innerHTML=''; return; }
  el.classList.remove('hidden');
  el.innerHTML=subs.map(function(s){
    return '<button type="button" class="cv-subnav-item'+(s[0]===active?' on':'')+'" data-cvsub="'+s[0]+'">'+s[1]+'</button>';
  }).join('');
}
function cvToast(msg,type){ toast(msg, type==='error'?'error':undefined); }
function cvShowPanel(name){
  var primary=cvPrimaryOf(name);
  $$('#view-collab .cv-panel').forEach(function(p){ p.classList.toggle('active', p.id===(name==='tasks'?'cv-tasks-current':'cv-'+name)); });
  $$('#cvTabNav .tab-nav-item').forEach(function(t){
    t.classList.toggle('tab-nav-item--active', t.getAttribute('data-cvview')===primary);
  });
}
function cvSwitchSub(name){
  cvSubState[cvPrimaryOf(name)]=name;
  cvSwitchView(name);
}
function cvSwitchView(name){
  if(name==='config-proj') name='config';   /* 旧链接兼容：项目设置已并入项目管理 */
  if(name==='config-perm') name='config';   /* 人员已并入设置左导航 */
  if(window.cvLeaveProjectTasks)window.cvLeaveProjectTasks();
  cvSyncWorkspacePermissions();
  if(name==='config' && !cvIsWorkspaceAdmin()) name='tasks';   /* 设置仅工作区管理员可进 */
  if(name==='tasks'){
    setTasksEmbedded(true);
  }
  if(name!=='members'){
    if(window.cvRestoreProjectTaskBoard)window.cvRestoreProjectTaskBoard();
    if(window.cvResetProjectListState)window.cvResetProjectListState();
  }
  cvLastTab=(name==='chat'||name==='review-detail')?cvLastTab:name;
  cvShowPanel(name);
  if(name==='members'&&window.cvRenderProjectList)window.cvRenderProjectList();
  if(name==='teams') renderExpertGrid();
  if(name==='experts') cvRenderExperts();
  if(name==='config' && window.cvRenderPermTable) window.cvRenderPermTable();   /* 人员管理是设置里默认打开的一项 */
  cvSyncUrl();
}
/* 执行中的任务在侧边栏项目下挂一条会话 */
function cvAddSidebarConversation(title){
  var group=$('.sb-scroll .project-group');
  if(!group) return;
  var item=document.createElement('div');
  item.className='sub-item cv-running';
  item.innerHTML='<span class="dot blue"></span><span class="txt">'+xesc(title)+'</span>';
  item.addEventListener('click',function(){ showView('collab'); setNavActive('协作开发'); cvSwitchView('chat'); });
  var head=group.querySelector('.group-head');
  if(head&&head.nextSibling) group.insertBefore(item,head.nextSibling); else group.appendChild(item);
}

export function initCollabView() {
  /* 下拉筛选器：按钮开合、选项选中后刷新列表、点空白处收起 */
  document.addEventListener('click',function(e){
    var sub=e.target.closest('[data-cvsub]');
    if(sub){ cvSwitchSub(sub.getAttribute('data-cvsub')); return; }
    var art=e.target.closest('[data-cv-art]');
    if(art){
      var op=art.getAttribute('data-cv-art');
      var nm=art.getAttribute('data-cv-art-name')||'';
      if(op==='预览'){ if(window.cvOpenArtFiles) window.cvOpenArtFiles(nm); return; }
      cvToast('原型演示：'+op+'「'+nm+'」');
      return;
    }
    var tog=e.target.closest('[data-cvfdd-toggle]');
    if(tog){
      var dd=tog.closest('.cv-fdd');
      var wasOpen=dd.classList.contains('open');
      document.querySelectorAll('.cv-fdd.open').forEach(function(x){x.classList.remove('open');});
      if(!wasOpen) dd.classList.add('open');
      return;
    }
    var item=e.target.closest('.cv-fdd-item');
    if(item){
      var box=item.closest('.cv-fdd');
      box.querySelectorAll('.cv-fdd-item').forEach(function(x){x.classList.remove('on');});
      item.classList.add('on');
      box.classList.remove('open');
      var lbl=box.querySelector('.cv-fdd-label');
      if(lbl) lbl.textContent=item.getAttribute('data-cvfdd-val');
      cvApplyFilters();
      return;
    }
    if(!e.target.closest('.cv-fdd')) document.querySelectorAll('.cv-fdd.open').forEach(function(x){x.classList.remove('open');});
  });
}

export function initCollabTabs() {
  window.cvCard=null; window.cvReviewIdx=0;
}

/* cvInited 由其它模块写回；import 绑定只读，所以走这个 setter */
export function set_cvInited(v){ cvInited=v; return v; }
/* cvPendingProj 由其它模块写回；import 绑定只读，所以走这个 setter */
export function set_cvPendingProj(v){ cvPendingProj=v; return v; }
/* cvPendingTab 由其它模块写回；import 绑定只读，所以走这个 setter */
export function set_cvPendingTab(v){ cvPendingTab=v; return v; }

export { cvAddSidebarConversation, cvApplyFilters, cvGetFilterVal, cvInited, cvLastTab, cvPendingProj, cvPendingTab, cvShowPanel, cvSwitchFilter, cvSwitchSub, cvSwitchView, cvToast };
