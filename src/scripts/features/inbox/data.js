import { CV_PROJECTS, CV_WORKSPACES, cvCurrentUserName } from '../collab/data.js';
import { tkGetTasks, tkGetPerson, tkGetStatusName, tkCurrentUserId, tkCanViewTask } from '../tasks-v2/data.js';
import { taskExecutionStages } from '../tasks-v2/task-execution.js';

const storageKey = () => 'lingee-inbox-v1:' + (tkCurrentUserId() || 'unknown');
const stamp = (hours) => new Date(Date.now() - hours * 3600000).toISOString();
const visibleTasks = () => tkGetTasks().filter(tkCanViewTask);
const byStatus = (status) => visibleTasks().filter((task) => task.status === status);
const projectOf = (task) => CV_PROJECTS.find((project) => project.id === task.project);
const actorOf = (task, type) => {
  if (type !== 'agent') return tkGetPerson(task.assignee).name;
  const team = task.teamId || projectOf(task)?.defaultTeam;
  return ({'cosmic-app-dev':'苍穹应用开发专家团','general-app-dev':'通用应用开发专家团','kingdee-saas':'金蝶 SaaS 实施专家团','kingdee-custom':'金蝶二次开发专家团'})[team] || '项目执行专家团';
};

function makeItem(id, task, type, hours, body, actorType = 'user') {
  const project = task && projectOf(task);
  return {
    id, workspace_id: project?.workspace || CV_WORKSPACES[0]?.id || 'ws-build',
    recipient_type:'user', recipient_id:cvCurrentUserName(),
    actor_type:actorType, actor_id:actorOf(task || {}, actorType),
    type, severity:type === 'agent_blocked' || type === 'task_failed' ? 'error' : 'info',
    issue_id:task?.id || null, title:task?.title || '系统通知', body,
    issue_status:task?.status || null, issue_priority:task?.priority || null,
    read:hours >= 20, archived:hours >= 60, created_at:stamp(hours), details:{project_id:task?.project || null, task_code:task?.code || null},
  };
}

function initialItems() {
  const tasks = visibleTasks();
  const pick = (status, index = 0) => byStatus(status)[index] || tasks[index] || tasks[0];
  const recipes = [
    ['in_review',0,'review_requested',0.3,'专家团已完成交付并提交审核，请核对执行结果、验收标准和关联产物。','agent'],
    ['in_review',0,'agent_completed',1.2,'苍穹应用开发专家团完成编码实现与测试验证，执行报告已生成。','agent'],
    ['blocked',0,'agent_blocked',1.8,'集成接口返回权限不足，智能体已暂停执行，等待负责人确认连接配置。','agent'],
    ['in_progress',0,'new_comment',2.4,'我已补充字段映射与筛选条件，请在本轮实现中一并核对。'],
    ['in_progress',1,'mentioned',3.1,'在任务讨论中提到了你：请确认本阶段的交付范围。'],
    ['done',0,'task_completed',4.2,'交付物已通过验收，任务已完成。'],
    ['in_review',1,'review_requested',5.1,'测试验证结束，待审核测试结果和回归记录。','agent'],
    ['blocked',1,'task_failed',6.3,'执行时发现接口返回字段与方案设计不一致，需要先更新数据契约。','agent'],
    ['backlog',0,'issue_assigned',8,'任务已分配给你，请确认目标和截止时间。'],
    ['in_progress',2,'status_changed',10,'状态由「待办」变更为「执行中」，专家团开始处理。'],
    ['done',1,'task_completed',12,'专家团已完成全部交付阶段，负责人确认后归档。','agent'],
    ['in_review',2,'new_comment',15,'评审意见已补充：请检查权限边界和异常处理。'],
    ['planned',0,'priority_changed',20,'优先级调整，请重新安排本周计划。'],
    ['in_progress',3,'agent_completed',26,'方案设计已输出接口清单与数据流说明。','agent'],
    ['backlog',1,'due_date_changed',30,'截止日期已调整，请关注最新交付时间。'],
    ['in_review',3,'mentioned',39,'请协助核对验收清单中的第 3 项。'],
    ['blocked',2,'agent_blocked',48,'测试环境无法连接，正在等待环境维护人处理。','agent'],
    ['done',2,'status_changed',54,'状态由「审核中」变更为「已完成」。'],
    ['backlog',2,'assignee_changed',63,'任务负责人已调整，请查看新的协作分工。'],
    ['in_progress',4,'new_comment',72,'接口联调记录已上传，发现两处字段命名待确认。'],
  ];
  const taskItems = recipes.filter((r) => pick(r[0],r[1])).map((r,i) => makeItem('seed-'+(i+1),pick(r[0],r[1]),r[2],r[3],r[4],r[5]));
  return taskItems.concat([
    {...makeItem('seed-system-1',null,'quick_create_done',7,'智能体已根据需求生成任务草稿，请打开任务列表确认范围。'),'title':'任务草稿已生成',actor_id:'任务规划智能体',actor_type:'agent',workspace_id:'ws-build'},
    {...makeItem('seed-system-2',null,'autopilot_paused',34,'自动化执行已暂停。请检查工作区连接与运行额度后再继续。'),'title':'自动化已暂停',actor_id:'系统',workspace_id:'ws-app',severity:'warning'},
    {...makeItem('seed-system-3',null,'quick_create_failed',67,'创建任务时未能解析目标项目，请补充项目名称后重试。'),'title':'创建任务未完成',actor_id:'任务规划智能体',actor_type:'agent',workspace_id:'ws-quality',severity:'error'},
  ]);
}

let items = null;
let itemsForUser = '';
export function inboxItems() {
  const userId = tkCurrentUserId();
  if (items && itemsForUser === userId) return items;
  itemsForUser = userId;
  const seeds = initialItems();
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey()) || '{}') || {}; } catch (e) { /* fresh state */ }
  const states = saved.states || {};
  items = seeds.map((item) => ({...item, ...states[item.id]}));
  (saved.added || []).forEach((item) => { if (item && item.id && !items.some((row) => row.id === item.id)) items.push(item); });
  return items;
}
export function inboxPersist() {
  const all = inboxItems();
  const states = {};
  all.filter((item) => item.id.startsWith('seed-')).forEach((item) => { states[item.id] = {read:item.read, archived:item.archived}; });
  try { localStorage.setItem(storageKey(),JSON.stringify({states,added:all.filter((item) => !item.id.startsWith('seed-'))})); } catch (e) { /* session state remains */ }
}
export function inboxAddTaskStageStartedNotice(taskId, stageId) {
  const task = tkGetTasks().find((row) => row.id === taskId);
  if (!task || task.executionStageId !== stageId || task.status !== 'in_progress') return false;
  const stageName = taskExecutionStages(task).find((stage) => stage.id === stageId)?.name || '当前阶段';
  inboxItems().unshift(makeItem('live-agent-started-'+Date.now(),task,'agent_started',0,`「${stageName}」阶段的 Agent 已启动，可在任务详情查看进度。`,'agent'));
  inboxPersist();
  return true;
}
export function inboxAddFromTaskChange(detail) {
  const {task,before,patch} = detail || {};
  if (!task || !before || !patch) return false;
  const changes = [];
  if (patch.assignee && patch.assignee !== before.assignee) changes.push(['assignee_changed',`负责人变更为「${tkGetPerson(patch.assignee).name}」。`]);
  if (patch.status && patch.status !== before.status) {
    const agentFinished = patch.status === 'in_review' && Object.hasOwn(patch,'executionPlan');
    const stageName = taskExecutionStages(task).find((stage) => stage.id === task.executionStageId)?.name || '当前阶段';
    changes.push(agentFinished
      ? ['review_requested',`「${stageName}」阶段的 Agent 已完成，等待你审核。`,'agent']
      : ['status_changed',`状态由「${tkGetStatusName(before.status)}」变更为「${tkGetStatusName(patch.status)}」。`]);
  }
  if (patch.priority && patch.priority !== before.priority) changes.push(['priority_changed','任务优先级已调整。']);
  if (Object.hasOwn(patch,'dueDate') && patch.dueDate !== before.dueDate) changes.push(['due_date_changed',`截止日期调整为 ${patch.dueDate || '未设置'}。`]);
  if (Array.isArray(patch.comments) && patch.comments.length > before.comments) {
    const comment = patch.comments.at(-1);
    if (comment?.authorId !== tkCurrentUserId()) changes.push([String(comment?.text || comment?.body || '').includes('@') ? 'mentioned' : 'new_comment',String(comment?.text || comment?.body || '任务新增了一条评论。').slice(0,160)]);
  }
  if (!changes.length) return false;
  inboxItems().filter((item) => item.issue_id === task.id).forEach((item) => { item.issue_status=task.status; item.issue_priority=task.priority; });
  changes.forEach(([type,body,actorType], index) => {
    const item=makeItem('live-'+Date.now()+'-'+index,task,type,0,body,actorType);
    const authorId=(type==='new_comment' || type==='mentioned') ? patch.comments?.at(-1)?.authorId : tkCurrentUserId();
    if (actorType !== 'agent') item.actor_id=tkGetPerson(authorId).name;
    inboxItems().unshift(item);
  });
  inboxPersist();
  return true;
}
