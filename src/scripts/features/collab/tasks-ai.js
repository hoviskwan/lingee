import { xesc } from '../expert/data.js';
import { tkCanViewTask, tkCurrentUserId, tkGetPerson, tkGetProjectName, tkGetTasks, tkWasTaskHandler } from '../tasks-v2/data.js';
import { openTaskFromBoard } from '../tasks-v2/index.js';
import { cvOpenVersionPicker, cvSwitchView } from './view.js';

/* AI 任务新版：只负责独立页面的聚合展示，不修改当前任务页及其状态。 */
var root;
var priorityWeight={urgent:4,high:3,medium:2,low:1};

function sortTasks(tasks){
  return tasks.slice().sort(function(a,b){
    return (priorityWeight[b.priority]||0)-(priorityWeight[a.priority]||0)
      || String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999'));
  });
}
function myTasks(){
  var me=tkCurrentUserId();
  return tkGetTasks().filter(tkCanViewTask).filter(function(task){
    if(task.status==='done')return tkWasTaskHandler(task);
    return task.assignee===me&&!['planned','cancelled'].includes(task.status);
  });
}
function meta(task){
  return '<span>'+xesc(task.code||'')+'</span><span>'+xesc(tkGetProjectName(task.project)||'未归属项目')+'</span>'+(task.dueDate?'<span>截止 '+xesc(task.dueDate.slice(5).replace('-','/'))+'</span>':'');
}
var defaultStages=['需求分析','方案设计','实现规划','编码实现','测试验证','部署交付'];
function taskStages(task){
  var stages=(task.executionPlan||[]).map(function(stage,index){
    return {id:stage.id||'stage-'+index,name:stage.title||stage.workType||defaultStages[index]||('阶段 '+(index+1)),status:stage.status||'pending'};
  });
  if(!stages.length)stages=defaultStages.map(function(name,index){return {id:'stage-'+index,name:name,status:'pending'};});
  var currentIndex=stages.findIndex(function(stage){return stage.id===task.executionStageId;});
  if(currentIndex<0)currentIndex=stages.findIndex(function(stage){return stage.status!=='done';});
  if(currentIndex<0)currentIndex=stages.length-1;
  return stages.map(function(stage,index){
    var state=index<currentIndex||stage.status==='done'?'done':index===currentIndex?'current':'pending';
    return {name:stage.name,state:state};
  });
}
function stageFlow(task){
  var stages=taskStages(task);
  var currentIndex=stages.findIndex(function(stage){return stage.state==='current';});
  if(currentIndex<0)currentIndex=stages.length-1;
  return '<div class="cv-ai-stage-chart" aria-label="任务执行阶段"><div class="cv-ai-stage-chart-head"><span>任务阶段</span><em>'+(currentIndex+1)+'/'+stages.length+' · '+xesc(stages[currentIndex].name)+'</em></div>'
    +'<div class="cv-ai-stage-labels">'+stages.map(function(stage){return '<span class="is-'+stage.state+'" title="'+xesc(stage.name)+'">'+xesc(stage.name)+'</span>';}).join('')+'</div>'
    +'<div class="cv-ai-stage-track" aria-hidden="true">'+stages.map(function(stage){return '<i class="is-'+stage.state+'"></i>';}).join('')+'</div></div>';
}
function actionCard(task,status){
  var label=status==='backlog'?'交给 AI 执行':'查看并验收';
  return '<article class="cv-ai-action-card cv-ai-action-card--'+status+'" data-ai-task-id="'+task.id+'" tabindex="0">'
    +'<div class="cv-ai-card-main"><div class="cv-ai-card-meta">'+meta(task)+'</div><strong>'+xesc(task.title)+'</strong></div>'
    +'<button type="button" class="cv-ai-card-action" data-ai-task-id="'+task.id+'">'+label+'</button>'+stageFlow(task)+'</article>';
}
function renderActionList(id,tasks,status,emptyText){
  var el=document.getElementById(id);if(!el)return;
  var visible=sortTasks(tasks).slice(0,3);
  el.innerHTML=visible.length?visible.map(function(task){return actionCard(task,status);}).join(''):'<div class="cv-ai-empty">'+emptyText+'</div>';
  if(tasks.length>3)el.insertAdjacentHTML('beforeend','<button type="button" class="cv-ai-more" data-ai-open-current>查看全部 '+tasks.length+' 项</button>');
}
function taskProgress(task){
  var stages=task.executionPlan||[];if(!stages.length)return 45;
  var done=stages.filter(function(stage){return stage.status==='done';}).length;
  return Math.max(8,Math.min(92,Math.round(done/stages.length*100)+(task.status==='in_progress'?8:0)));
}
function currentStage(task){
  var stages=task.executionPlan||[];
  return stages.find(function(stage){return stage.id===task.executionStageId;})||stages.find(function(stage){return stage.status!=='done';});
}
function renderAlerts(tasks){
  var el=document.getElementById('cvAiAlertZone');if(!el)return;
  el.innerHTML=sortTasks(tasks).map(function(task){
    return '<article class="cv-ai-alert"><span class="cv-ai-alert-icon">!</span><div class="cv-ai-alert-copy"><strong>执行异常 · '+xesc(task.title)+'</strong><p>'+xesc(task.desc||'AI 执行意外中止，需要你及时查看。')+'</p></div><button type="button" data-ai-task-id="'+task.id+'">立即处理</button></article>';
  }).join('');
}
function renderRunning(tasks){
  var el=document.getElementById('cvAiRunningList');if(!el)return;
  var visible=sortTasks(tasks).slice(0,3);
  el.innerHTML=visible.length?visible.map(function(task){
    var progress=taskProgress(task),stage=currentStage(task);
    return '<article class="cv-ai-running-card" data-ai-task-id="'+task.id+'" tabindex="0"><strong>'+xesc(task.title)+'</strong><small>'+xesc(stage?stage.title:'AI 正在执行')+' · '+progress+'%</small><div class="cv-ai-progress"><i style="width:'+progress+'%"></i></div></article>';
  }).join(''):'<div class="cv-ai-empty">AI 当前没有正在执行的任务</div>';
}
function renderDone(tasks){
  var el=document.getElementById('cvAiDoneList');if(!el)return;
  var visible=tasks.slice().sort(function(a,b){return String(b.updatedAt||b.dueDate||b.createDate||'').localeCompare(String(a.updatedAt||a.dueDate||a.createDate||''));}).slice(0,3);
  el.innerHTML=visible.length?visible.map(function(task){
    var date=(task.updatedAt||task.dueDate||task.createDate||'').slice(0,10);
    return '<article class="cv-ai-done-row" data-ai-task-id="'+task.id+'" tabindex="0"><span class="cv-ai-done-check">✓</span><strong>'+xesc(task.title)+'</strong><time>'+xesc(date||'已完成')+'</time><em>查看产物</em></article>';
  }).join(''):'<div class="cv-ai-empty">完成并通过验收的任务会出现在这里</div>';
}
export function renderAiTaskPage(){
  if(!root)root=document.getElementById('cv-tasks-ai');if(!root)return;
  var tasks=myTasks();
  var groups={backlog:[],in_review:[],blocked:[],in_progress:[],done:[]};
  tasks.forEach(function(task){if(groups[task.status])groups[task.status].push(task);});
  var currentPerson=tkGetPerson(tkCurrentUserId());
  document.getElementById('cvAiTaskTitle').textContent='你好，'+((currentPerson&&currentPerson.name)||'你');
  document.getElementById('cvAiBacklogCount').textContent=groups.backlog.length;
  document.getElementById('cvAiReviewCount').textContent=groups.in_review.length;
  document.getElementById('cvAiRunningCount').textContent=groups.in_progress.length;
  document.getElementById('cvAiDoneCount').textContent=groups.done.length;
  var actionCount=groups.backlog.length+groups.in_review.length+groups.blocked.length;
  document.getElementById('cvAiTaskBrief').textContent=actionCount?'你有 '+actionCount+' 件事需要关注，先处理异常，再安排 AI 和验收结果。':'目前没有需要你处理的任务，可以安心关注 AI 的推进情况。';
  document.getElementById('cvAiActionSummary').textContent=groups.blocked.length?'另有 '+groups.blocked.length+' 项异常已置顶提醒':'AI 执行正常';
  document.getElementById('cvAiRunningSummary').textContent=groups.in_progress.length?'AI 正在推进 '+groups.in_progress.length+' 项任务':'当前没有运行中的任务';
  renderAlerts(groups.blocked);
  renderActionList('cvAiBacklogList',groups.backlog,'backlog','没有等待 AI 执行的任务');
  renderActionList('cvAiReviewList',groups.in_review,'in_review','没有等待你验收的结果');
  renderRunning(groups.in_progress);
  renderDone(groups.done);
}
export function initAiTaskPage(){
  root=document.getElementById('cv-tasks-ai');if(!root)return;
  root.addEventListener('click',function(event){
    if(event.target.closest('#cvAiVersionSwitch')){cvOpenVersionPicker();return;}
    if(event.target.closest('[data-ai-open-current]')){cvSwitchView('tasks');return;}
    var target=event.target.closest('[data-ai-task-id]');if(target)openTaskFromBoard(Number(target.getAttribute('data-ai-task-id')));
  });
  root.addEventListener('keydown',function(event){
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-ai-task-id]')){event.preventDefault();openTaskFromBoard(Number(event.target.getAttribute('data-ai-task-id')));}
  });
  document.addEventListener('lingee:task-updated',renderAiTaskPage);
  document.addEventListener('lingee:tasks-changed',renderAiTaskPage);
  document.addEventListener('lingee:ai-task-page-open',renderAiTaskPage);
  renderAiTaskPage();
}
