/* 任务会话：按「任务 + 当前用户」过滤；演示数据按任务确定性生成，首次查看时补齐。 */
import { CV_PROJECTS } from '../collab/data.js';
import { STAGES } from '../expert/data.js';
import { TEAMS } from '../expert/store.js';
import { tkCurrentUserId } from './data.js';
import { taskExecutionStages } from './task-execution.js';

export const TASK_SESSION_ORIGINS = { start:'开始执行', revise:'退回修改', retry:'重试执行', manual:'发起会话' };
export const TASK_SESSION_STATUS = { active:'进行中', ended:'已结束', failed:'执行异常' };

const SESSIONS_STORAGE_KEY = 'lingee_task_sessions_v1';
var _sessions = [];
var _seeded = new Set();
var _nextId = 1;
try {
  var savedSessions = JSON.parse(localStorage.getItem(SESSIONS_STORAGE_KEY) || '[]');
  if (Array.isArray(savedSessions)) _sessions = savedSessions.filter(function (session) {
    return Number.isInteger(session?.id) && Number.isInteger(session.taskId) && typeof session.ownerId === 'string';
  });
  _nextId = Math.max(0, ..._sessions.map(function (session) { return session.id; })) + 1;
} catch (e) { /* 本地存储不可用时保留当前会话 */ }
function persistSessions() {
  try { localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(_sessions)); }
  catch (e) { /* 本地存储不可用时保留当前会话 */ }
}

function pad(value) { return String(value).padStart(2, '0'); }
function formatMinute(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}
function minutesAgo(minutes) { return formatMinute(new Date(Date.now() - minutes * 60000)); }
function stageName(stageId, task) { return (task ? taskExecutionStages(task) : STAGES).find(function (stage) { return stage.id === stageId; })?.name || ''; }
function taskAgentName(task) {
  var project = CV_PROJECTS.find(function (row) { return row.id === task.project; });
  var teamId = task.teamId || project?.defaultTeam;
  return TEAMS.find(function (row) { return row.id === teamId; })?.name || '任务专家团';
}
function clip(text, size) {
  text = String(text || '');
  return text.length > size ? text.slice(0, size) + '…' : text;
}

function createSession(task, ownerId, spec) {
  var session = Object.assign({
    id: _nextId++, taskId: task.id, ownerId: ownerId, origin: 'manual', stageId: null,
    status: 'active', agentName: taskAgentName(task), messages: [], steps: [], error: '', next: '',
  }, spec);
  session.lastAt = session.lastAt || session.startedAt;
  _sessions.push(session);
  persistSessions();
  return session;
}

/* 会话开场指令：登记会话与直接发起会话共用同一句，保证「我的会话」记录与聊天开场一致 */
export function tkTaskSessionOpeningMessage(task, origin, stageId) {
  if (origin === 'revise') return '退回修改「' + stageName(stageId, task) + '」阶段，请按审核意见调整后重新提交。';
  if (origin === 'retry') return '重试执行「' + stageName(stageId, task) + '」阶段，沿用上次的输入与配置。';
  if (origin === 'start') return '执行「' + (stageName(stageId, task) || '当前节点') + '」：任务「' + task.title + '」；' + clip(task.desc, 60);
  return '关于任务「' + task.title + '」，我想先确认几个问题。';
}

function sessionTitle(task, origin, stageId) {
  if (origin === 'revise') return '修改' + stageName(stageId, task) + '阶段产出';
  if (origin === 'retry') return '重试' + stageName(stageId, task) + '阶段';
  if (origin === 'start') return '执行' + (stageName(stageId, task) || '任务') + '：' + task.title;
  return '讨论任务：' + task.title;
}

/* 演示数据：只给当前用户负责或创建、且已经开始执行的任务生成会话。 */
function seedDemoSessions(task, ownerId) {
  if (task.status === 'backlog' && task.executionStageId) return;
  var key = task.id + ':' + ownerId;
  if (_seeded.has(key)) return;
  _seeded.add(key);
  if (_sessions.some(function (session) { return session.taskId === task.id && session.ownerId === ownerId; })) return;
  var stageId = task.executionStageId || taskExecutionStages(task)[0].id;
  var stageOwner = taskExecutionStages(task).find(function (stage) { return stage.id === stageId; })?.assigneeId;
  if (stageOwner ? stageOwner !== ownerId : task.assignee !== ownerId && task.createdBy !== ownerId) return;
  var status = task.initialStatus || task.status;
  if (!['in_progress', 'in_review', 'blocked', 'done'].includes(status)) {
    if (!['in_progress', 'in_review', 'blocked'].includes(task.status)) return;
    var startedAt = (task.statusHistory || []).find(function (change) { return change.to === 'in_progress'; })?.time || task.updatedAt || minutesAgo(0);
    createSession(task, ownerId, {
      origin:'start', title:sessionTitle(task, 'start', stageId), stageId:stageId,
      status:task.status === 'in_progress' ? 'active' : 'ended', startedAt:startedAt, lastAt:startedAt,
      messages:[{role:'agent', text:'此阶段的历史对话内容未保存，可继续会话。'}],
    });
    return;
  }
  var day = task.createDate;
  var agent = taskAgentName(task);
  if (task.id % 2 === 0) createSession(task, ownerId, {
    origin: 'manual', title: '梳理任务范围与验收标准', status: 'ended', startedAt: day + ' 09:48', lastAt: day + ' 10:06',
    messages: [
      { role: 'user', text: '先帮我梳理一下「' + task.title + '」的范围和验收标准。' },
      { role: 'agent', text: '已按任务描述整理出范围边界与验收标准，并标出了需要你确认的依赖项。' },
      { role: 'user', text: '可以，按这个范围开始执行。' },
    ],
  });
  var startStatus = status === 'in_progress' ? 'active' : 'ended';
  var progress = status === 'done' ? '全部阶段已完成，交付物已归档到任务详情。'
    : status === 'in_review' ? '「' + stageName(stageId, task) + '」阶段产出已提交，等待你审核。'
    : status === 'blocked' ? '「' + stageName(stageId, task) + '」阶段执行中断，详情见异常会话。'
    : '正在执行「' + stageName(stageId, task) + '」阶段，完成后会通知你审核。';
  createSession(task, ownerId, {
    origin: 'start', title: sessionTitle(task, 'start', stageId), stageId: stageId, status: startStatus,
    startedAt: day + ' 10:20', lastAt: startStatus === 'active' ? minutesAgo(task.id % 40 + 6) : day + ' 11:02',
    messages: [
      { role: 'user', text: tkTaskSessionOpeningMessage(task, 'start') },
      { role: 'agent', text: '已接收任务，按「' + taskExecutionStages(task).map(function (stage) { return stage.name; }).join(' → ') + '」推进。' },
      { role: 'agent', text: progress },
    ],
  });
  if (status === 'in_review' && task.id % 3 === 0 && taskExecutionStages(task).findIndex(function (stage) { return stage.id === stageId; }) > 0) createSession(task, ownerId, {
    origin: 'revise', title: sessionTitle(task, 'revise', stageId), stageId: stageId, status: 'ended', startedAt: day + ' 15:10', lastAt: day + ' 15:36',
    messages: [
      { role: 'user', text: tkTaskSessionOpeningMessage(task, 'revise', stageId) },
      { role: 'agent', text: '已根据审核意见补充遗漏的边界场景，并重新提交「' + stageName(stageId, task) + '」阶段产出。' },
    ],
  });
  if (status === 'blocked' && task.blockedRun) createSession(task, ownerId, {
    origin: 'start', title: stageName(stageId, task) + '阶段执行异常', stageId: stageId, status: 'failed', agentName: task.blockedRun.agentName || agent,
    startedAt: task.blockedRun.failedAt, lastAt: task.blockedRun.failedAt,
    messages: [{ role: 'user', text: '继续执行「' + stageName(stageId, task) + '」阶段。' }],
    steps: task.blockedRun.steps || [], error: task.blockedRun.reason, next: task.blockedRun.next,
  });
}

export function tkGetMySessions(task) {
  var ownerId = tkCurrentUserId();
  if (!task || !ownerId) return [];
  seedDemoSessions(task, ownerId);
  if (['in_progress','in_review','blocked'].includes(task.status)) {
    var stageId = task.executionStageId || taskExecutionStages(task)[0]?.id;
    var stageOwner = taskExecutionStages(task).find(function (stage) { return stage.id === stageId; })?.assigneeId;
    var ownsStage = stageOwner ? stageOwner === ownerId : task.assignee === ownerId || task.createdBy === ownerId;
    var hasStageSession = _sessions.some(function (session) {
      return session.taskId === task.id && session.ownerId === ownerId
        && (session.stageId === stageId || (!session.stageId && session.origin === 'start'));
    });
    if (stageId && ownsStage && !hasStageSession) {
      var startedAt = task.updatedAt || minutesAgo(0);
      createSession(task, ownerId, {
        origin:'start', title:sessionTitle(task, 'start', stageId), stageId:stageId,
        status:task.status === 'in_progress' ? 'active' : 'ended', startedAt:startedAt, lastAt:startedAt,
        messages:[{role:'agent', text:'此阶段的历史对话内容未保存，可继续会话。'}],
      });
    }
  }
  return _sessions.filter(function (session) { return session.taskId === task.id && session.ownerId === ownerId; })
    .sort(function (a, b) { return b.lastAt.localeCompare(a.lastAt) || b.id - a.id; });
}

export function tkAddTaskSession(task, origin, stageId) {
  var ownerId = tkCurrentUserId();
  if (!task || !ownerId) return null;
  _sessions.forEach(function (session) {
    if (session.taskId === task.id && session.ownerId === ownerId && session.status === 'active') session.status = 'ended';
  });
  persistSessions();
  var now = minutesAgo(0);
  return createSession(task, ownerId, {
    origin: origin, title: sessionTitle(task, origin, stageId), stageId: stageId || null, status: 'active', startedAt: now, lastAt: now,
    messages: [{ role: 'user', text: tkTaskSessionOpeningMessage(task, origin, stageId) }],
  });
}

export function tkTouchTaskSession(sessionId) {
  var session = _sessions.find(function (row) { return row.id === sessionId; });
  if (!session) return;
  session.lastAt = minutesAgo(0);
  if (session.status === 'ended') session.status = 'active';
  persistSessions();
}

export function tkLatestStageSession(task, stageId, status) {
  return tkGetMySessions(task).find(function (session) { return session.stageId === stageId && (!status || session.status === status); }) || null;
}

export function tkTaskSessionTitle(session) {
  if (session.title) return session.title;
  var name = stageName(session.stageId);
  return (name ? name + ' · ' : '') + (TASK_SESSION_ORIGINS[session.origin] || '会话');
}
