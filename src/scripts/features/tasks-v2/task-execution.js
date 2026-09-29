import { STAGES } from '../expert/data.js';
import { tkCurrentStageHandlerId, tkCurrentUserId, tkGetTasks, tkGetTaskArtifacts, tkUpdateTask, tkCanViewTask } from './data.js';

const pendingStageReviews = new Map();

export function taskExecutionStages(task) {
  return Array.isArray(task?.executionPlan) && task.executionPlan.length
    ? task.executionPlan.map(function (stage) { return {id:stage.id, name:stage.title || stage.workType, desc:stage.description || '', assigneeId:stage.assigneeId}; })
    : STAGES;
}

function stagePlan(task, stageId, status) {
  if (!Array.isArray(task.executionPlan)) return undefined;
  return task.executionPlan.map(function (stage) { return stage.id === stageId ? {...stage, status:status} : stage; });
}

export function taskStageHandoffPatch(task, assigneeId) {
  var waiting = !!task.executionStageId && task.status === 'in_progress';
  /* 流转覆盖当前处理人前记录历史处理人，「已办」视图据此识别本人处理过的任务。 */
  var previousAssignee = task.assignee;
  return {
    assignee:assigneeId, flowAssignee:'',
    ...(previousAssignee && previousAssignee !== assigneeId
      ? {assigneeHistory:(task.assigneeHistory || []).concat(previousAssignee)}
      : {}),
    ...(waiting ? {status:'backlog'} : {}),
    ...(Array.isArray(task.executionPlan) ? {executionPlan:task.executionPlan.map(function (stage) {
      return stage.id === task.executionStageId
        ? {...stage, assigneeId:assigneeId, ...(waiting ? {status:'pending'} : {})}
        : stage;
    })} : {}),
  };
}

export function startTaskStage(task) {
  if (!task) return {ok:false};
  var currentHandlerId = tkCurrentStageHandlerId(task);
  if (!currentHandlerId || currentHandlerId !== tkCurrentUserId() || !tkCanViewTask(task)) {
    return {ok:false, message:'仅当前阶段处理人可开始执行'};
  }
  if (task.status === 'in_progress') {
    var current = taskExecutionStages(task).find(function (stage) { return stage.id === task.executionStageId; });
    if (!current && task.executionPlan?.length) {
      current = taskExecutionStages(task).find(function (stage) { return task.executionPlan.find(function (row) { return row.id === stage.id; })?.status !== 'done'; });
      if (current) tkUpdateTask(task.id,{executionStageId:current.id,executionPlan:stagePlan(task,current.id,'running')});
    }
    return {ok:!!current, stage:current};
  }
  if (!['planned','backlog'].includes(task.status)) return {ok:false};
  if (task.executionPlan?.length && task.executionPlan.some(function (stage) { return !stage.assigneeId; })) return {ok:false, message:'请先为执行计划的每个阶段指定负责人'};
  var stages = taskExecutionStages(task);
  var stage = stages.find(function (row) { return row.id === task.executionStageId; })
    || stages.find(function (row) { return task.executionPlan?.find(function (item) { return item.id === row.id; })?.status !== 'done'; })
    || stages[0];
  if (!stage) return {ok:false};
  var assigneeId = currentHandlerId;
  tkUpdateTask(task.id, {status:'in_progress', assignee:assigneeId, executionStageId:stage.id, executionPlan:stagePlan(task,stage.id,'running'),
    planStatus:task.executionPlan?.length ? 'confirmed' : task.planStatus});
  return {ok:true, stage:stage};
}

export function submitTaskStage(task) {
  if (task?.status !== 'in_progress') return {ok:false};
  var stage = taskExecutionStages(task).find(function (row) { return row.id === task.executionStageId; });
  if (!stage && task.executionPlan?.length) stage = taskExecutionStages(task).find(function (row) { return task.executionPlan.find(function (item) { return item.id === row.id; })?.status !== 'done'; });
  if (!stage) return {ok:false};
  var artifacts = task.executionArtifacts || [];
  if (!tkGetTaskArtifacts(task).some(function (artifact) { return artifact.stageId === stage.id; })) {
    var now = new Date();
    var date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
      + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    var templateId = /需求/.test(stage.name) ? 'requirements'
      : /设计|规划/.test(stage.name) ? 'technical'
      : /编码|实现|开发/.test(stage.name) ? 'implementation'
      : /测试|验证/.test(stage.name) ? 'test'
      : /部署|交付|发布/.test(stage.name) ? 'delivery' : 'technical';
    var template = tkGetTaskArtifacts(task).find(function (artifact) { return artifact.id === templateId; });
    artifacts = artifacts.concat(template ? {
      ...template, id:'stage-' + stage.id, stageId:stage.id,
      status:'待审核', date:date,
    } : {
      id:'stage-' + stage.id, stageId:stage.id, type:'技术文档',
      docTitle:'《' + task.title + '》阶段执行记录', summary:stage.desc || task.title,
      status:'待审核', date:date, author:'执行 Agent',
      sections:[{heading:'执行目标',blocks:[{p:stage.desc || task.desc || task.title}]},
        {heading:'提交说明',blocks:[{p:'本阶段已提交，等待项目负责人确认。'}]}],
    });
  }
  tkUpdateTask(task.id, {status:'in_review', executionStageId:stage.id, executionPlan:stagePlan(task,stage.id,'review'), executionArtifacts:artifacts});
  return {ok:true, stage:stage};
}

export function scheduleTaskStageStartedNotice(taskId, stageId) {
  if (!stageId || pendingStageReviews.has(taskId)) return;
  const timer = setTimeout(function () {
    pendingStageReviews.delete(taskId);
    const task = tkGetTasks().find(function (row) { return row.id === taskId; });
    if (!task || !['in_progress', 'in_review'].includes(task.status) || task.executionStageId !== stageId) return;
    document.dispatchEvent(new CustomEvent('lingee:task-stage-started-notice', {detail:{taskId:taskId, stageId:stageId}}));
  }, 5000);
  pendingStageReviews.set(taskId, timer);
}

function flowTimestamp() {
  var now = new Date();
  function pad(value) { return String(value).padStart(2, '0'); }
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' '
    + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
}

export function reviewTaskStage(task, approved) {
  if (task?.status !== 'in_review') return {ok:false};
  var stages = taskExecutionStages(task);
  var index = stages.findIndex(function (stage) { return stage.id === task.executionStageId; });
  if (index < 0 && task.executionPlan?.length) index = stages.findIndex(function (stage) { return task.executionPlan.find(function (row) { return row.id === stage.id; })?.status !== 'done'; });
  if (index < 0) return {ok:false};
  var stage = stages[index], next = stages[index + 1];
  var plan = stagePlan(task, stage.id, approved ? 'done' : 'running');
  var nextAssignee = approved && next ? task.flowAssignee || next.assigneeId || (!task.executionPlan?.length ? task.assignee : '') : '';
  if (approved && next && !nextAssignee) return {ok:false, message:'请先指定下一阶段处理人'};
  if (approved && next && plan) plan = plan.map(function (row) { return row.id === next.id ? {...row,assigneeId:nextAssignee,status:'pending'} : row; });
  var patch = {status:approved ? next ? 'backlog' : 'done' : 'in_progress',
    executionStageId:approved && next ? next.id : stage.id, executionPlan:plan};
  if (approved) {
    /* 通过即流转：上一处理人与审核人记入历史处理人（「已办」据此识别），并追加与手动流转一致的动态记录。 */
    var reviewerId = tkCurrentUserId();
    var history = (task.assigneeHistory || []).slice();
    [task.assignee, reviewerId].forEach(function (id) {
      if (id && id !== nextAssignee && !history.includes(id)) history.push(id);
    });
    patch.assigneeHistory = history;
    if (next) {
      patch.assignee = nextAssignee;
      patch.flowAssignee = '';
      patch.comments = (task.comments || []).concat([{kind:'flow', authorId:reviewerId, createdAt:flowTimestamp(), fromStatus:'in_review', fromAssignee:task.assignee, status:'backlog', assignee:nextAssignee, text:''}]);
    }
    var artifacts = (task.executionArtifacts || []).map(function (artifact) {
      return artifact.stageId === stage.id ? {...artifact, status:'已通过'} : artifact;
    });
    if (artifacts.length) patch.executionArtifacts = artifacts;
  }
  tkUpdateTask(task.id, patch);
  return {ok:true, stage:stage, next:approved ? next : null, done:approved && !next};
}
