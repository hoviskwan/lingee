import { CV_TASKS, CV_PROJECTS } from './data.js';
import { TEAMS } from '../expert/store.js';
import { EX, STAGES, STAGE_MODES } from '../expert/data.js';
import { toast } from '../../core/toast.js';
/* 任务看板共享核心：列定义、当前任务、状态持久化与派生工具
   task-board / new-task / task-chat 三个模块共用，避免彼此循环依赖。 */


/* 状态：[值, 标签, 色调, 图标符号, 分类, 说明]。分类用于看板列分组与设置页展示。 */
export const tbColumns = [
  ['待规划', '待规划', 'backlog', '◌', '未开始', '搁置。把任务移到这里不会启动智能体。'],
  ['待办', '待开始', 'pending', '○', '未开始', '排队中。把任务移到这里会启动指派的智能体。'],
  ['进行中', '执行中', 'running', '◐', '已开始', '正在进行。'],
  ['审核中', '审核中', 'review', '◉', '已开始', '已交付，等待人工审核。会结束自动化运行。'],
  ['已阻塞', '已阻塞', 'blocked', '⊘', '已开始', '被外部依赖阻塞。'],
  ['已完成', '已完成', 'done', '✓', '已完成', '已完成。'],
  ['已取消', '已取消', 'canceled', '✕', '已关闭', '决定不做。'],
];
/* 待规划只用于项目管理里的父任务（epic），任务看板与状态下拉都先不出现 */
export const tbBoardColumns = tbColumns.filter(c => c[0] !== '待规划');
const storageKey = 'lingee_task_board_v1';
const legacyTeamIds = {
  'software-company': 'general-app-dev', 'fast-app': 'kingdee-saas-implementation',
  'cosmic-team': 'cosmic-app-dev', 'web-team': 'kingdee-secondary-dev',
};
let selected = null;

/* selected 由其它模块写回；import 绑定只读，所以走 setter */
export function tbGetSelected() { return selected; }
export function tbSetSelected(v) { selected = v; return v; }

export function tbCurrentTeamId(id) { return legacyTeamIds[id] || id; }
export function tbTaskId(t) { return t.boardId || t.source + ':' + t.sourceId + ':' + t.project; }
export function tbMode(t) { return t.mode || (t.collab === '无需协作' ? '单人执行' : '多人协作'); }
export function tbOwner(t) { return t.assignee; }
export function tbTeamName(t) {
  const id = tbCurrentTeamId(CV_PROJECTS.find(p => p.id === t.project)?.defaultTeam);
  return TEAMS.find(team => team.id === id)?.name || '未指定专家团';
}
/* 专家团属于项目策略。Task 与运行期 WorkItem 只继承，不单独覆盖。 */
export function tbMatchedTeam(t) {
  const id = tbCurrentTeamId(CV_PROJECTS.find(p => p.id === t.project)?.defaultTeam);
  return TEAMS.find(team => team.id === id) || null;
}
export function tbMatchExperts(t) {
  const team = tbMatchedTeam(t);
  if (team && team.members && team.members.length) {
    const names = team.members.slice(0, 3).map(m => (EX[m] && EX[m].name) || m);
    if (names.length) return names;
  }
  /* 没有绑专家团时，按任务类型/关键词退化为角色建议 */
  if (/Bug|修复|错误|异常|失败/.test(t.type + t.title)) return ['架构专家', '开发专家', '测试专家'];
  if (/需求|方案|设计/.test(t.type + t.title)) return ['需求专家', '架构专家'];
  return ['开发专家'];
}
export function tbPriority(t) { return t.priority || (t.type === 'Bug' ? '高' : '中'); }
/* 专家团实际能覆盖到的阶段：按团内成员的工作模式，交叉 STAGE_MODES 过滤。 */
export function tbTeamStages(team) {
  if (!team) return STAGES.slice();
  const modes = {};
  (team.members || []).forEach(id => { const e = EX[id]; if (e) (e.modes || []).forEach(m => { modes[m] = true; }); });
  const covered = STAGES.filter(s => (STAGE_MODES[s.id] || []).some(m => modes[m]));
  return covered.length ? covered : STAGES.slice();
}
export function tbLabel(status) { return tbColumns.find(c => c[0] === status)?.[1] || status; }
/* 任务是否已启动：待规划与待办视为未启动，目标与分工仍可编辑；
   进入执行中及之后的状态即为启动，详情页转为只读。 */
export function tbIsStarted(t) { return !!t && !['待规划', '待办'].includes(t.status); }
export function tbSave() {
  try { localStorage.setItem(storageKey, JSON.stringify(CV_TASKS)); return true; }
  catch { toast('保存失败，本地存储空间不足', 'error'); return false; }
}
export { storageKey };
