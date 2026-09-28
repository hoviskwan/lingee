import { cvSimulateExecution, cvSwitchToChat } from './chat.js';
import { CV_MEMBERS, CV_PROJECTS, CV_REVIEWS, CV_TASKS, CV_WORKFLOW, CV_WORKFLOW_ROLES, cvInjectCardActions, cvPeopleInWorkspace, cvProject, cvProjectInWorkspace, cvProjectName, cvRenderTaskStats, cvRenderTasks } from './data.js';
import { cvUpdateCounts } from './projects.js';
import { cvAddSidebarConversation, cvApplyFilters, cvGetFilterVal, cvToast } from './view.js';
import { xesc } from '../expert/data.js';
/* 协作开发：任务统计、同步、执行 / 转交 / 流转
   拆分自 src/scripts/main.js，逻辑逐行保留；副作用集中在下方 init* 函数里，
   由 main.js 按拆分前的原始顺序调用。 */


/* ============ STATS CLICK ============ */
function cvClickStat(stat,status){
  var view=stat.closest('.cv-panel');if(!view)return;
  view.querySelectorAll('.stat').forEach(function(s){s.classList.remove('stat--active');});
  stat.classList.add('stat--active');
  /* 点统计卡同步选中状态下拉项 */
  var dd=view.querySelector('[data-cvfdd="status"]');
  if(dd){
    var val=status||'全部状态';
    dd.querySelectorAll('.cv-fdd-item').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-cvfdd-val')===val);});
    var lbl=dd.querySelector('.cv-fdd-label');if(lbl)lbl.textContent=val;
  }
  cvApplyFilters();
}
function cvClickReviewStat(stat,filter){
  var view=stat.closest('.cv-panel');if(!view)return;
  view.querySelectorAll('.stat').forEach(function(s){s.classList.remove('stat--active');});
  stat.classList.add('stat--active');
  if(filter&&filter!=='全部待评审'){
    var groups=view.querySelectorAll('.filter-group');
    groups.forEach(function(g){
      var match=Array.prototype.find.call(g.querySelectorAll('.filter-btn'),function(b){return b.textContent.trim()===filter;});
      if(match){
        g.querySelectorAll('.filter-btn').forEach(function(b){b.classList.remove('filter-btn--active');});
        match.classList.add('filter-btn--active');
      }
    });
  }
  cvApplyReviewFilters();
}
function cvApplyReviewFilters(){
  var view=document.getElementById('cv-review');if(!view)return;
  var typeF=cvGetFilterVal(view,'review-type');
  var priorityF=cvGetFilterVal(view,'review-priority');
  var search=(view.querySelector('input')||{}).value||'';search=search.toLowerCase();
  view.querySelectorAll('.card').forEach(function(card){
    var match=true;var idx=parseInt(card.getAttribute('data-idx'));
    var r=CV_REVIEWS[idx];if(!r){card.style.display='none';return;}
    if(typeF&&typeF!=='全部待评审'){
      if(typeF==='我发起的'&&r.from!=='张工')match=false;
      if(typeF==='分配给我的'&&r.reviewer!=='张工')match=false;
    }
    if(match&&priorityF&&priorityF!=='全部优先级'&&r.priority!==priorityF)match=false;
    if(match&&search){if(r.title.toLowerCase().indexOf(search)<0)match=false;}
    card.style.display=match?'':'none';
  });
}

/* ============ SYNC MODAL ============ */
function cvOpenSyncModal(){document.getElementById('cv-sync-overlay').style.display='flex';}
function cvCloseSyncModal(){document.getElementById('cv-sync-overlay').style.display='none';}
function cvSelectCollabMode(el){
  var parent=el.parentNode;parent.querySelectorAll('.sync-collab-option').forEach(function(o){o.classList.remove('sync-collab-option--selected');});
  el.classList.add('sync-collab-option--selected');
}
function cvToggleSyncDropdown(el,ev){
  if(ev)ev.stopPropagation();
  var existing=el.parentNode.querySelector('.sync-dropdown');
  if(existing){existing.remove();return;}
  var valId=el.querySelector('.sync-modal__select-placeholder').id;
  var opts={'cv-sync-type-val':['需求','Bug','任务','改进'],'cv-sync-priority-val':['高','中','低'],'cv-sync-source-val':['对话自建','Jira','TAPD','API','飞书'],'cv-sync-size-val':['小任务','大任务']}[valId]||[];
  var current=el.querySelector('.sync-modal__select-placeholder').textContent;
  var dd=document.createElement('div');dd.className='sync-dropdown sync-dropdown--open';
  opts.forEach(function(o){var item=document.createElement('div');item.className='sync-dropdown-item'+(o===current?' sync-dropdown-item--active':'');item.textContent=o;item.onclick=function(){el.querySelector('.sync-modal__select-placeholder').textContent=o;dd.remove();};dd.appendChild(item);});
  el.parentNode.appendChild(dd);
}
function cvCollectSyncTaskData(status){
  var title=document.getElementById('cv-sync-title');if(!title||!title.value.trim()){cvToast('请输入任务标题','warning');return null;}
  var activeProject=CV_PROJECTS.find(function(project){return project.id===cvProject&&cvProjectInWorkspace(project.id);})||CV_PROJECTS.find(function(project){return cvProjectInWorkspace(project.id);});
  if(!activeProject){cvToast('请先创建项目','warning');return null;}
  var desc=document.getElementById('cv-sync-desc');
  var type=document.getElementById('cv-sync-type-val');
  var priority=document.getElementById('cv-sync-priority-val');
  var source=document.getElementById('cv-sync-source-val');
  var size=document.getElementById('cv-sync-size-val');
  var sel=document.querySelector('#cv-sync-collab-options .sync-collab-option--selected .sync-collab-name');
  var mode=sel?sel.textContent:'Agent间协作';
  return{title:title.value.trim(),desc:desc?desc.value.trim():'',type:type?type.textContent:'需求',priority:priority?priority.textContent:'中',source:source?source.textContent:'对话自建',size:size?size.textContent:'小任务',status:status||'未开始',collab:mode,assignee:activeProject.owner,project:activeProject.id,progress:0};
}
function cvSaveTaskToStorage(task){
  var tasks=[];try{tasks=JSON.parse(localStorage.getItem('build_tasks')||'[]');}catch(e){}
  tasks.unshift(task);localStorage.setItem('build_tasks',JSON.stringify(tasks));
}
/* 弹窗里的任务落库：归一化字段并挂到当前项目（聚合视图下默认第一个项目） */
function cvNormalizeTask(task){
  var big=task.size==='大任务'||task.size==='大';
  return {type:task.type,size:big?'大':'小',source:task.source,sourceId:task.sourceId||'新建',
    exec:big?'专家团':'自动执行',status:task.status,collab:task.collab,title:task.title,
    desc:task.desc||'暂无描述',assignee:task.assignee,progress:task.progress||0,
    project:task.project||cvProject||CV_PROJECTS.find(function(project){return cvProjectInWorkspace(project.id);})?.id};
}
function cvAddTask(task){
  var row=cvNormalizeTask(task);
  CV_TASKS.unshift(row);
  cvRenderTaskStats(); cvRenderTasks(); cvInjectCardActions(); cvApplyFilters(); cvUpdateCounts();
  return row;
}
function cvSaveSyncTask(){
  var task=cvCollectSyncTaskData('未开始');if(!task)return;
  var row=cvAddTask(task);cvSaveTaskToStorage(row);cvCloseSyncModal();
  cvToast('任务已保存到「'+cvProjectName(row.project)+'」任务列表','success');
}
function cvStartSyncTask(){
  var task=cvCollectSyncTaskData('未开始');if(!task)return;
  var row=cvAddTask(task);cvSaveTaskToStorage(row);cvCloseSyncModal();
  cvToast('任务已创建到「'+cvProjectName(row.project)+'」，可点击「执行」启动','success');
}

/* ============ TASK MODALS ============ */
function cvOpenTaskModal(id){
  var el=document.getElementById(id);if(el)el.style.display='flex';
  var search=el&&el.querySelector('[data-person-list-search]');if(search)search.value='';
  if(id==='cv-transfer-overlay'){cvRenderPersonList('cv-transfer-person-list');}
  if(id==='cv-twist-overlay'){cvRenderWorkflow();cvRenderTwistArtifacts();}
  if(id==='cv-review-overlay'){cvRenderReviewPersonList();cvRenderReviewArtifacts();}
}
function cvCloseTaskModal(id){var el=document.getElementById(id);if(el)el.style.display='none';}
function cvRenderPersonList(listId){
  var el=document.getElementById(listId);if(!el)return;
  el.innerHTML=cvPeopleInWorkspace().map(function(m,i){
    return '<button class="person-item" data-person-search="'+xesc((m.name+' '+(m.email||'')).toLocaleLowerCase())+'" onclick="cvSelectPersonItem(this)"><div class="person-avatar-sm">'+m.name[0]+'</div><div><div class="person-name-sm">'+m.name+'</div><div class="person-role-sm">'+m.roles.map(function(r){return r.text;}).join(' · ')+'</div></div></button>';
  }).join('');
}
function cvRenderReviewPersonList(){
  var el=document.getElementById('cv-review-person-list');if(!el)return;
  var card=window.cvCard;var node='开发实现';
  if(card){var na=card.querySelector('.card-node');if(na)node=na.textContent.replace(/^[\s\u200b]+/,'').trim();}
  var role=CV_WORKFLOW_ROLES[node]||'开发人员';
  el.innerHTML=cvPeopleInWorkspace().filter(function(m){return !m.roles.length||m.roles.some(function(r){return r.text.indexOf(role)>=0||role.indexOf(r.text)>=0;});}).map(function(m){
    return '<button class="person-item" data-person-search="'+xesc((m.name+' '+(m.email||'')).toLocaleLowerCase())+'" onclick="cvSelectPersonItem(this)"><div class="person-avatar-sm">'+m.name[0]+'</div><div><div class="person-name-sm">'+m.name+'</div><div class="person-role-sm">'+m.roles.map(function(r){return r.text;}).join(' · ')+'</div></div></button>';
  }).join('');
  if(!el.innerHTML){el.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-soft);font-size:12.5px">当前节点无匹配人员</div>';}
}
function cvSelectPersonItem(el){
  var parent=el.parentNode;parent.querySelectorAll('.person-item').forEach(function(p){p.classList.remove('person-item--selected');});
  el.classList.add('person-item--selected');
}
function cvRenderWorkflow(){
  var el=document.getElementById('cv-twist-workflow');if(!el)return;
  var card=window.cvCard;var currentNode='开发实现';
  if(card){var na=card.querySelector('.card-node');if(na)currentNode=na.textContent.replace(/^[\s\u200b]+/,'').trim();}
  var currentIdx=CV_WORKFLOW.indexOf(currentNode);if(currentIdx<0)currentIdx=0;
  el.innerHTML=CV_WORKFLOW.map(function(step,i){
    var cls=i<currentIdx?'workflow-step--done':(i===currentIdx?'workflow-step--current':'');
    var num=i<currentIdx?'✓':(i+1);
    var status=i<currentIdx?'已完成':(i===currentIdx?'当前节点':CV_WORKFLOW_ROLES[step]);
    return '<div class="workflow-step '+cls+'"><div class="workflow-step-num">'+num+'</div><div class="workflow-step-name">'+step+'</div><div class="workflow-step-status">'+status+'</div></div>';
  }).join('');
  var nextIdx=Math.min(currentIdx+1,CV_WORKFLOW.length-1);
  el.innerHTML+='<div style="padding:8px 12px;font-size:12px;color:#7858f9;font-weight:600">下一步：'+CV_WORKFLOW[nextIdx]+' → '+CV_WORKFLOW_ROLES[CV_WORKFLOW[nextIdx]]+'</div>';
}
function cvRenderTwistArtifacts(){
  var el=document.getElementById('cv-twist-artifacts');if(!el)return;
  var arts=[['code','</>','源代码','ExpensePlugin.java'],['test','T','单元测试','ExpenseTest.java'],['spec','S','需求规格','PRD.md'],['doc','D','技术方案','TechSpec.md']];
  el.innerHTML=arts.map(function(a){return '<div class="artifact-row"><div class="artifact-icon artifact-icon--'+a[0]+'">'+a[1]+'</div><span>'+a[2]+'</span><span style="margin-left:auto;font-size:11px;color:var(--text-soft)">'+a[3]+'</span></div>';}).join('');
}
function cvRenderReviewArtifacts(){
  var el=document.getElementById('cv-review-artifacts');if(!el)return;
  var arts=[['code','</>','源代码','ExpensePlugin.java'],['test','T','单元测试','ExpenseTest.java'],['spec','S','需求规格','PRD.md'],['doc','D','技术方案','TechSpec.md']];
  el.innerHTML=arts.map(function(a){return '<div class="artifact-row"><div class="artifact-icon artifact-icon--'+a[0]+'">'+a[1]+'</div><span>'+a[2]+'</span><span style="margin-left:auto;font-size:11px;color:var(--text-soft)">'+a[3]+'</span></div>';}).join('');
}

/* ============ CONFIRM ACTIONS ============ */
function cvConfirmExec(){
  var sel=document.querySelector('#cv-exec-collab-options .sync-collab-option--selected .sync-collab-name');
  var mode=sel?sel.textContent:'Agent间协作';
  cvCloseTaskModal('cv-exec-overlay');
  var card=window.cvCard;var taskTitle='新任务';
  if(card){
    var titleEl=card.querySelector('.card-title');if(titleEl)taskTitle=titleEl.textContent;
    card.setAttribute('data-status','进行中');
    var sb=card.querySelector('.badge-status');if(sb){sb.className='badge-status badge-status--running';sb.innerHTML='<span class="badge-status-dot"></span>执行中';}
    var node=card.querySelector('.card-node');if(node)node.innerHTML='<span class="card-node-dot" style="background:var(--dot-blue)"></span>开发实现';
    card.querySelector('.card-actions')&&(card.querySelector('.card-actions').style.display='none');
  }
  cvAddSidebarConversation(taskTitle);cvSwitchToChat();cvToast('任务已启动执行！协作模式：'+mode,'success');
  cvSimulateExecution(taskTitle,card);
}
function cvConfirmTransfer(){
  var sel=document.querySelector('#cv-transfer-person-list .person-item--selected .person-name-sm');
  cvCloseTaskModal('cv-transfer-overlay');
  cvToast('任务已转交给：'+(sel?sel.textContent:'李工'),'success');
}
function cvConfirmTwist(){cvCloseTaskModal('cv-twist-overlay');cvToast('任务已流转到下一节点：代码审查，产物已自动传递给审查人员','info');}
function cvConfirmReview(){
  var sel=document.querySelector('#cv-review-person-list .person-item--selected .person-name-sm');
  cvCloseTaskModal('cv-review-overlay');
  if(window.cvCard){
    window.cvCard.setAttribute('data-status','待评审');
    var sb=window.cvCard.querySelector('.badge-status');if(sb){sb.className='badge-status badge-status--review';sb.innerHTML='<span class="badge-status-dot"></span>待评审';}
    var node=window.cvCard.querySelector('.card-node');if(node){node.innerHTML='<span class="card-node-dot" style="background:var(--warning)"></span>代码审查';node.style.background='var(--warning-bg)';node.style.color='var(--warning)';}
  }
  cvToast('评审已发起！评审人：'+(sel?sel.textContent:'王工')+'，任务状态已变更为「待评审」','success');
}

export function initCollabTasks() {
  document.addEventListener('click',function(){document.querySelectorAll('.sync-dropdown').forEach(function(d){d.remove();});});
  document.querySelectorAll('[data-person-list-search]').forEach(function(input){input.addEventListener('input',function(){
    var list=document.getElementById(this.getAttribute('data-person-list-search'));
    var query=this.value.trim().toLocaleLowerCase();
    if(list)list.querySelectorAll('[data-person-search]').forEach(function(row){row.hidden=!row.getAttribute('data-person-search').includes(query);});
  });});
}

export { cvApplyReviewFilters, cvClickReviewStat, cvClickStat, cvCloseSyncModal, cvCloseTaskModal, cvConfirmExec, cvConfirmReview, cvConfirmTransfer, cvConfirmTwist, cvNormalizeTask, cvOpenSyncModal, cvOpenTaskModal, cvSaveSyncTask, cvSelectCollabMode, cvSelectPersonItem, cvStartSyncTask, cvToggleSyncDropdown };
