/* 项目与任务管理共用的本地交付过程样例；优先使用任务选择的专家团。 */
import { EXPERTS, PRESET_TEAMS } from '../expert/data.js';
import { TEAMS } from '../expert/store.js';
import { taskExecutionStages } from '../tasks-v2/task-execution.js';
import { $ } from '../../core/dom.js'; // 模块自检将模板插值的 $ 识别为跨模块符号。

const PHASE_OWNERS = {
  requirements:['software-product-manager','software-team-lead'],
  design:['software-architect','cosmic-workflow','cosmic-api','software-team-lead'],
  planning:['software-team-lead','software-architect'],
  implementation:['cosmic-form','cosmic-workflow','cosmic-report','cosmic-plugin','cosmic-api','frontend-engineer','software-engineer'],
  verification:['software-qa-engineer','software-product-manager','software-team-lead'],
  delivery:['software-team-lead','software-architect'],
};

function implementationOwner(title, team) {
  const preferences = /报表|看板|统计|指标|大屏|导出/.test(title)
    ? ['cosmic-report','frontend-engineer','software-engineer']
    : /审批|流程|流转|派单|任务执行/.test(title)
      ? ['cosmic-workflow','software-engineer']
      : /接口|集成|同步|对接|数据|持久化/.test(title)
        ? ['cosmic-api','software-engineer']
        : /插件|二开|扩展/.test(title)
          ? ['cosmic-plugin','software-engineer']
          : /页面|列表|侧边栏|标签|交互|原型/.test(title)
            ? ['frontend-engineer','cosmic-form','software-engineer']
            : ['cosmic-form','software-engineer','frontend-engineer'];
  return preferences.find(id => team.members.includes(id));
}

function ownerFor(stageId, title, team) {
  const preferred = stageId === 'implementation' ? implementationOwner(title, team) : null;
  const id = preferred || (PHASE_OWNERS[stageId] || []).find(item => team.members.includes(item)) || team.leadId || team.members[0];
  return EXPERTS.find(item => item.id === id) || { id, name:team.name };
}

function detailFor(stageId, task, project, team) {
  const title = task.title || project.name;
  const scope = String(task.desc || '').split(/[。；\n]/)[0].slice(0, 64);
  const lingee = project.id === 'lingee-prototype';
  const cosmic = team.id === 'cosmic-app-dev';
  const saas = team.id === 'kingdee-saas-implementation';
  const context = lingee ? '页面状态、交互路径、模拟数据与任务流转边界' : cosmic ? '表单字段、流程节点、报表口径与接口边界' : saas
    ? '现有 SaaS 配置、审批规则、报表口径与集成边界' : '页面交互、服务接口、数据结构与权限边界';
  const texts = {
    requirements:`围绕「${title}」确认业务入口与验收边界${scope ? `；重点核对：${scope}${scope.length === 64 ? '…' : ''}` : '，并记录异常场景与非目标'}。`,
    design:`对齐「${title}」的${context}，记录依赖、数据流和失败回退路径。`,
    planning:`将「${title}」拆成可交付工作项，明确${lingee ? '页面、状态流转、模拟数据和验证' : cosmic ? '表单、流程、报表和接口' : saas ? '配置、联调和验收' : '设计、开发和测试'}的先后依赖与责任人。`,
    implementation:`完成「${title}」的${lingee ? '高保真页面交互与模拟数据' : cosmic ? '苍穹配置与必要扩展' : saas ? 'SaaS 配置及接口映射' : '功能实现与界面联动'}，记录关键分支和针对性检查结果。`,
    verification:`按验收清单核对「${title}」的正常路径、权限边界和异常恢复，并整理回归结论。`,
    delivery:`汇总「${title}」的配置、验证记录与交付说明，完成集成确认和后续观察项登记。`,
  };
  return texts[stageId] || `围绕「${title}」完成当前计划节点，记录执行结果与待审核事项。`;
}

function normalizedStatus(status) {
  return ({'待规划':'planned','待办':'backlog','进行中':'in_progress','审核中':'in_review','已阻塞':'blocked','已完成':'done','已取消':'cancelled','未开始':'backlog','待评审':'in_review','已失败':'blocked'})[status] || status;
}

export function createDeliveryActivity(task, project, options = {}) {
  const team = TEAMS.find(item => item.id === task.teamId || project?.defaultTeam)
    || PRESET_TEAMS.find(item => item.id === project?.defaultTeam)
    || {id:'task-ai',name:'AI 助手',members:EXPERTS[0] ? [EXPERTS[0].id] : [],leadId:EXPERTS[0]?.id};
  const status = normalizedStatus(task.status);
  const date = task.createDate || options.date || '2026-09-22';
  const title = task.title || project.name;
  const activity = [{stageId:'kickoff', stage:'任务创建', author:options.creator || project.owner || '项目成员',
    text:`将「${title}」加入「${project.name}」，交由${team.name}评估交付范围。`, time:`${date} 09:15`, state:'done'}];
  if (status === 'planned' || status === 'cancelled' || (status === 'backlog' && !task.executionStageId)) return activity;
  const stages = taskExecutionStages(task);
  const requestedIndex = stages.findIndex(stage => stage.id === task.executionStageId);
  const activeIndex = status === 'done' ? -1 : requestedIndex < 0 ? 0 : requestedIndex;
  const completedCount = status === 'done' ? stages.length : activeIndex;
  const hours = ['09:40','10:25','11:10','13:45','15:05','16:20'];
  stages.forEach((stage, index) => {
    if (index >= completedCount && index !== activeIndex) return;
    const expert = ownerFor(stage.id, title, team);
    let detail = stage.desc || detailFor(stage.id, task, project, team);
    let state = 'done';
    if (index === activeIndex) {
      state = status === 'blocked' ? 'blocked' : status === 'in_review' ? 'review' : status === 'backlog' ? 'pending' : 'running';
      if (status === 'blocked') detail = `${detail} 当前遇到阻塞：${options.blockedReason || '所需依赖尚未就绪，已暂停后续验证。'}`;
      if (status === 'in_progress') detail = `${detail} 本阶段持续处理中，尚未提交独立验证。`;
      if (status === 'in_review') detail = `已由${expert.name}提交「${title}」的${stage.name}结果，等待项目负责人审核；通过后${index === stages.length - 1 ? '完成任务' : '进入下一阶段'}。`;
    }
    if (status === 'in_progress' && index === activeIndex && !task.statusHistory?.length) {
      activity.push(
        {stageId:'status-flow', stage:'状态流转', author:options.creator || project?.owner || '项目成员',
         text:`状态从「待办」流转至「进行中」，开始${stage.name}。`, time:`${date} 09:30`, state:'done'},
        {stageId:'assignee', stage:'处理人分配', author:options.creator || project?.owner || '项目成员',
         text:`分配处理人「${options.assigneeName || '待分配'}」，协同${expert.name}完成${stage.name}。`, time:`${date} 09:35`, state:'done'},
      );
    }
    activity.push({stageId:stage.id, stage:stage.name, author:expert.name, expertId:expert.id,
      text:detail, time:`${date} ${hours[index]}`, state});
  });
  return activity;
}
