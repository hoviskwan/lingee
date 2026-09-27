import { STAGES } from '../expert/data.js';
import { tkGetTasks, tkGetTaskArtifacts, tkUpdateTask } from './data.js';

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

export function startTaskStage(task) {
  if (!task) return {ok:false};
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
  var stage = taskExecutionStages(task)[0];
  tkUpdateTask(task.id, {status:'in_progress', executionStageId:stage.id, executionPlan:stagePlan(task,stage.id,'running'),
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
    artifacts = artifacts.concat({
      id:'stage-' + stage.id, stageId:stage.id, type:stage.name + '产物', summary:stage.desc || '「' + task.title + '」的阶段执行结果',
      status:'待审核', date:date, author:'执行 Agent',
      sections:[{heading:'阶段目标', text:stage.desc || task.desc || task.title},
        {heading:'执行结果', text:'「' + stage.name + '」阶段已完成模拟执行，提交当前产物等待审核。'}],
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

export function reviewTaskStage(task, approved) {
  if (task?.status !== 'in_review') return {ok:false};
  var stages = taskExecutionStages(task);
  var index = stages.findIndex(function (stage) { return stage.id === task.executionStageId; });
  if (index < 0 && task.executionPlan?.length) index = stages.findIndex(function (stage) { return task.executionPlan.find(function (row) { return row.id === stage.id; })?.status !== 'done'; });
  if (index < 0) return {ok:false};
  var stage = stages[index], next = stages[index + 1];
  var plan = stagePlan(task, stage.id, approved ? 'done' : 'running');
  if (approved && next && plan) plan = plan.map(function (row) { return row.id === next.id ? {...row,status:'running'} : row; });
  var patch = {status:approved ? next ? 'in_progress' : 'done' : 'in_progress',
    executionStageId:approved && next ? next.id : stage.id, executionPlan:plan};
  if (approved) {
    var artifacts = (task.executionArtifacts || []).map(function (artifact) {
      return artifact.stageId === stage.id ? {...artifact, status:'已通过'} : artifact;
    });
    if (artifacts.length) patch.executionArtifacts = artifacts;
  }
  tkUpdateTask(task.id, patch);
  return {ok:true, stage:stage, next:approved ? next : null, done:approved && !next};
}
