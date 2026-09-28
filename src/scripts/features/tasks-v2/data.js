/* 任务管理 v2 —— 模拟数据与状态
   纯前端原型，所有数据本地维护。 */
import { CV_MEMBERS, CV_PROJECTS, CV_TASKS, cvCurrentUserName, cvPeopleInProject } from '../collab/data.js';
import { getLoginPersonId } from '../login.js';
import { createDemoReviewReport } from './review-reports.js';
import { createDemoBlockedRun } from './blocked-runs.js';
import { createDemoCompletedRun } from './completed-runs.js';
import { buildTaskArtifactDocs } from './artifact-docs.js';

/* ---------- 常量定义 ---------- */
export const TK_STATUSES = [
  { id: 'planned',     name: '待规划', color: 'gray',   icon: 'dotted' },
  { id: 'backlog',     name: '待办',   color: 'gray',   icon: 'circle' },
  { id: 'in_progress', name: '进行中', color: 'orange', icon: 'half' },
  { id: 'in_review',  name: '审核中', color: 'green',  icon: 'three_quarters' },
  { id: 'blocked',   name: '已阻塞', color: 'red',    icon: 'slash' },
  { id: 'done',       name: '已完成', color: 'blue',   icon: 'check' },
  { id: 'cancelled',  name: '已取消', color: 'gray',   icon: 'cross' },
];

export const TK_PRIORITIES = [
  { id: 'urgent', name: '紧急', color: 'red'    },
  { id: 'high',   name: '高',   color: 'orange' },
  { id: 'medium', name: '中',   color: 'blue'   },
  { id: 'low',    name: '低',   color: 'gray'   },
];

/* 演示任务只使用项目中已有的七位人员；姓名和身份始终来自项目人员主数据。 */
const TK_DEMO_PERSON_IDS = ['p22', 'p01', 'p02', 'p03', 'p04', 'p05', 'p07'];
const TK_PERSON_COLORS = ['#495dff', '#08a040', '#e04a3a', '#7858f9', '#c06010', '#0891b2', '#d76794'];
export const TK_PEOPLE = [];
export function tkSyncPeople() {
  var assignedIds = typeof _tasks === 'undefined' ? [] : _tasks.flatMap(function (task) {
    return [task.assignee, task.createdBy].concat((task.executionPlan || []).map(function (stage) { return stage.assigneeId; }));
  }).filter(Boolean);
  var personIds = Array.from(new Set(TK_DEMO_PERSON_IDS.concat(assignedIds)));
  TK_PEOPLE.splice(0, TK_PEOPLE.length, ...personIds.map(function (id, index) {
    var person = CV_MEMBERS.find(function (row) { return row.id === id; });
    return person && person.status !== 'disabled' ? { id:person.id, name:person.name, avatar:person.name.slice(0, 1), color:TK_PERSON_COLORS[index % TK_PERSON_COLORS.length] } : null;
  }).filter(Boolean));
  TK_FILTER_FIELDS.find(function (field) { return field.id === 'assignee'; }).options = TK_PEOPLE.map(function (person) { return { value:person.id, label:person.name }; });
  TK_FILTER_FIELDS.find(function (field) { return field.id === 'project'; }).options = tkProjectsForCurrentUser().map(function (project) { return { value:project.id, label:project.name }; });
  if (typeof _tasks !== 'undefined') _tasks.forEach(function (task) {
    var people = tkPeopleInProject(task.project);
    if (!people.some(function (person) { return person.id === task.assignee; })) task.assignee = people[0]?.id || '';
    if (task.createdBy && !CV_MEMBERS.some(function (person) { return person.id === task.createdBy; })) task.createdBy = '';
  });
}
export function tkPeopleInProject(projectId) {
  var project = CV_PROJECTS.find(function (row) { return row.id === projectId; });
  if (!project) return [];
  var members = cvPeopleInProject(project);
  var owner = CV_MEMBERS.find(function (person) { return person.name === project.owner; });
  if (owner && !members.some(function (person) { return person.id === owner.id; })) members.push(owner);
  return members.filter(function (person) { return person.status !== 'disabled'; }).map(function (person, index) {
    return { id:person.id, name:person.name, avatar:person.name.slice(0, 1), color:TK_PERSON_COLORS[TK_DEMO_PERSON_IDS.indexOf(person.id)] || TK_PERSON_COLORS[index % TK_PERSON_COLORS.length] };
  });
}
export function tkCurrentUserId() {
  var personId = getLoginPersonId();
  return CV_MEMBERS.some(function (person) { return person.id === personId && person.status !== 'disabled'; }) ? personId : '';
}
export function tkCurrentStageHandlerId(task) {
  if (!task) return '';
  if (!Array.isArray(task.executionPlan) || !task.executionPlan.length) return task.assignee || '';
  var stage = task.executionPlan.find(function (row) { return row.id === task.executionStageId; })
    || task.executionPlan.find(function (row) { return row.status !== 'done'; })
    || task.executionPlan[0];
  return stage?.assigneeId || '';
}
export function tkCanStartTask(task) {
  var me = tkCurrentUserId();
  return !!me && task?.status === 'backlog' && tkCanViewTask(task) && tkCurrentStageHandlerId(task) === me;
}
/* 当前或历史节点负责人均保留在「我负责」，任务完成后也不丢失。 */
export function tkWasTaskHandler(task) {
  var me = tkCurrentUserId();
  return !!me && !!task && (task.assignee === me
    || (task.assigneeHistory || []).includes(me)
    || (task.executionPlan || []).some(function (stage) { return stage && (stage.assigneeId === me || stage.reviewerId === me); }));
}
/* 项目成员仅能查看自己参与的任务；项目负责人可查看本项目全部任务。 */
export function tkParticipatesCurrentUser(task) {
  var me = tkCurrentUserId();
  if (!me || !task) return false;
  return tkWasTaskHandler(task) || task.createdBy === me
    || (task.comments || []).some(function (c) { return c && (c.authorId === me || c.assignee === me); })
    || (task.statusHistory || []).some(function (entry) { return entry && entry.authorId === me; });
}
export function tkCanViewTask(task) {
  if (!task) return false;
  var project = tkProjectsForCurrentUser().find(function (row) { return row.id === task.project; });
  if (!project) return false;
  var me = CV_MEMBERS.find(function (person) { return person.id === tkCurrentUserId(); });
  return project.owner === me?.name || tkParticipatesCurrentUser(task);
}
export function tkProjectsForCurrentUser() {
  var userId = tkCurrentUserId();
  return userId ? CV_PROJECTS.filter(function (project) {
    return (project.members || []).includes(userId)
      || CV_MEMBERS.some(function (person) { return person.id === userId && project.owner === person.name; });
  }) : [];
}

export const TK_AGENTS = [
  { id: 'a1', name: '代码审查专家', avatar: 'C', color: '#495dff' },
  { id: 'a2', name: '需求分析专家', avatar: 'R', color: '#08a040' },
  { id: 'a3', name: '测试验证专家', avatar: 'T', color: '#ff8d42' },
];

export const TK_PROJECTS = CV_PROJECTS;

export const TK_LABELS = ['需求', '缺陷'];

/* 任务详情中的 AI 产物，内容随任务标题、描述与项目成员变化。 */
export function tkGetTaskArtifacts(task) {
  var projectPeople = tkPeopleInProject(task.project);
  function nameAt(i, fallbackId) { return (projectPeople[i] || tkGetPerson(fallbackId)).name; }
  return buildTaskArtifactDocs({
    task: task,
    projectName: tkGetProjectName(task.project),
    people: {
      product: nameAt(0, task.createdBy),
      dev: nameAt(1, task.assignee),
      arch: nameAt(2, task.assignee),
      test: nameAt(3, task.assignee),
      owner: tkGetPerson(task.createdBy || task.assignee).name,
    },
  }).concat(task.executionArtifacts || []);
}

/* ---------- 视图配置 ---------- */
export const TK_VIEWS = [
  { id: 'all',        name: '全部',    scope: 'all',       builtin: true },
  { id: 'members',    name: '我负责',  scope: 'my_assigned', builtin: true },
  { id: 'agents',     name: '进行中',  scope: 'in_progress', builtin: true },
];

/* ---------- 筛选字段定义 ---------- */
export const TK_FILTER_FIELDS = [
  { id: 'status',    name: '状态',   type: 'select', options: TK_STATUSES.map(s => ({ value: s.id, label: s.name })) },
  { id: 'priority',  name: '优先级', type: 'select', options: TK_PRIORITIES.map(p => ({ value: p.id, label: p.name })) },
  { id: 'assignee',  name: '处理人', type: 'select', options: TK_PEOPLE.map(p => ({ value: p.id, label: p.name })) },
  { id: 'project',   name: '项目',   type: 'select', options: TK_PROJECTS.map(p => ({ value: p.id, label: p.name })) },
  { id: 'label',     name: '标签',   type: 'select', options: TK_LABELS.map(l => ({ value: l, label: l })) },
  { id: 'dueDate',   name: '截止日期', type: 'date' },
  { id: 'keyword',   name: '关键词',   type: 'text' },
];

export const TK_OPERATORS = {
  select: [
    { value: 'eq', label: '等于' },
    { value: 'neq', label: '不等于' },
  ],
  date: [
    { value: 'before', label: '早于' },
    { value: 'after', label: '晚于' },
    { value: 'today', label: '今天' },
    { value: 'overdue', label: '已逾期' },
  ],
  text: [
    { value: 'contains', label: '包含' },
    { value: 'not_contains', label: '不包含' },
  ],
};

/* ---------- 模拟任务数据 ---------- */
export const TK_TASKS = [
  { id: 1,  code: 'T1000001', title: '采购订单列表页开发', desc: '完成采购订单列表页的前端开发，包含多条件筛选（供应商、日期范围、订单状态）、分页加载、批量导出 Excel。列表需支持列排序、列宽拖拽调整、固定表头。筛选区域可折叠保存，表格行右键支持快捷操作菜单（查看详情、复制订单、打印）。接口对接后端分页查询 API，需处理 loading 态和空数据态。', status: 'in_progress', priority: 'high',   assignee: 'p01', project: 'purchase', labels: ['需求'],     dueDate: '2026-09-25', createDate: '2026-09-20' },
  { id: 2,  code: 'T1000002', title: '供应商评级模型设计', desc: '设计供应商多维度评级算法，覆盖交货准时率（30%）、质量合格率（25%）、价格竞争力（20%）、服务响应速度（15%）、合作年限（10%）五个维度。支持权重动态配置与评级周期自定义（月度/季度/年度）。评级结果分 A/B/C/D 四档，自动生成评级报告并推送至采购负责人。需输出算法设计文档、数据库表结构设计、评级计算存储过程。', status: 'in_review',  priority: 'urgent', assignee: 'p03', project: 'supply', labels: ['缺陷'],     dueDate: '2026-09-24', createDate: '2026-09-18' },
  { id: 3,  code: 'T1000003', title: '入库单审批流程配置', desc: '配置入库单的多级审批流程：仓管员提交→库管主管初审（金额<1万）→采购经理复审（1万-10万）→财务总监终审（>10万）。支持金额阈值自动路由、审批人代理设置（请假/出差）、审批超时自动催办（24小时未处理）。审批节点支持自定义表单字段（审批意见、附件、签字）。需与工作流引擎对接，审批记录可追溯。', status: 'backlog',     priority: 'medium', assignee: 'p07', project: 'purchase', labels: ['需求'],              dueDate: '2026-09-28', createDate: '2026-09-22' },
  { id: 4,  code: 'T1000004', title: '财务报表数据源对接', desc: '对接 ERP 总账数据源，实现资产负债表、利润表、现金流量表的实时数据同步。需处理多账套合并取数、币种折算、期初期末结转等场景。接口采用定时增量拉取+手动全量刷新双模式，数据落库前做完整性校验（借贷平衡、科目编码规范）。阻塞原因：ERP 测试环境账套数据不完整，需协调运维补数。', status: 'blocked',     priority: 'high',   assignee: 'p22', project: 'expense', labels: ['缺陷'],        dueDate: '2026-09-26', createDate: '2026-09-19' },
  { id: 5,  code: 'T1000005', title: '采购订单详情页交互', desc: '完成采购订单详情页全部交互逻辑：订单基本信息展示、明细行增删改、金额自动计算（含税/不含税切换）、状态流转时间轴、附件预览（PDF/图片在线预览）、操作日志。支持订单复制创建、变更对比（标红变更字段）、打印预览。底部评论区域支持 @ 提及人员并推送通知。', status: 'in_progress', priority: 'medium', assignee: 'p01', project: 'purchase', labels: ['需求'],              dueDate: '2026-09-27', createDate: '2026-09-21', parentId: 1 },
  { id: 6,  code: 'T1000006', title: '供应商黑白名单管理', desc: '开发供应商黑白名单管理功能：支持单条录入与 Excel 批量导入（含模板下载、数据校验、导入预览）。黑名单供应商自动拦截采购下单并弹窗提示原因；白名单供应商享受绿色通道（免审批、优先付款）。名单变更需审批，变更记录可追溯。已通过测试验收并上线运行。', status: 'done',        priority: 'low',    assignee: 'p03', project: 'supply', labels: ['缺陷'],        dueDate: '2026-09-15', createDate: '2026-09-10' },
  { id: 7,  code: 'T1000007', title: '入库质检标准配置', desc: '按品类配置入库质检标准和抽检比例：原材料类全检（外观+尺寸+批次），标准件类按 AQL 2.5 抽检，辅料类免检。质检项目包含外观、尺寸、重量、性能指标，不合格项支持退货/让步接收/返工处理。质检结果自动关联入库单状态，不合格自动冻结入库流程并通知采购。', status: 'backlog',     priority: 'medium', assignee: 'p07', project: 'purchase', labels: ['需求'],            dueDate: '2026-09-30', createDate: '2026-09-22' },
  { id: 8,  code: 'T1000008', title: '报表导出性能优化', desc: '优化大数据量报表导出性能，当前 10 万行导出耗时 28 秒，目标降至 3 秒内。优化方案：1. 查询层加索引+分页游标读取；2. 内存层用流式写入替代全量缓存；3. 输出层异步生成文件+进度条反馈；4. 引入 Redis 缓存高频报表模板。已完成查询优化和流式写入，正在对接前端进度条组件。', status: 'in_progress', priority: 'high',   assignee: 'p22', project: 'expense', labels: ['缺陷'],     dueDate: '2026-09-29', createDate: '2026-09-20' },
  { id: 9,  code: 'T1000009', title: '采购订单打印模板', desc: '设计并开发采购订单打印模板，支持自定义字段配置（公司信息、签章位置、明细列显示/隐藏）。模板支持 A4/热敏两种纸张规格，打印时自动分页并带页眉页脚（页码、打印时间、制单人）。支持批量打印（按日期范围筛选）。已完成模板设计稿评审，正在开发模板渲染引擎。', status: 'in_review',  priority: 'low',    assignee: 'p07', project: 'purchase', labels: ['需求'],     dueDate: '2026-09-25', createDate: '2026-09-19', parentId: 1 },
  { id: 10, code: 'T1000010', title: '供应商准入审核流程', desc: '配置供应商准入资质审核全流程：基础信息录入→营业执照OCR校验→资质文件上传（营业执照、税务登记、开户许可、质量体系认证）→风控核查（司法风险、信用黑名单）→采购初审→风控复审→管理层审批。资质文件支持 OCR 自动识别关键字段并填充，风控数据对接第三方征信接口。审核通过自动创建供应商档案。', status: 'backlog',     priority: 'urgent', assignee: 'p03', project: 'supply', labels: ['缺陷'],       dueDate: '2026-09-24', createDate: '2026-09-23' },
  { id: 11, code: 'T1000011', title: '入库异常预警机制', desc: '开发入库异常自动预警系统，监控维度：库存超上限/低于安全库存、保质期临期（剩余<30天黄色/15天橙色/7天红色）、批次号重复、规格与采购订单不符。预警通过站内消息+邮件双通道推送至仓管员和采购员。看板页面实时滚动展示异常清单，支持标记已处理/忽略。', status: 'in_progress', priority: 'high',   assignee: 'p07', project: 'purchase', labels: ['需求'],        dueDate: '2026-09-28', createDate: '2026-09-21' },
  { id: 12, code: 'T1000012', title: '财务月报自动生成', desc: '配置月度财务报表自动生成定时任务：每月 1 日凌晨 2:00 自动拉取上月凭证数据，生成资产负债表、利润表、费用明细表、应收应付账龄分析表。报表导出 PDF 并推送至财务群邮件组，同时在系统中创建月报归档记录。支持手动触发补生成和自定义报表期间。', status: 'done',        priority: 'medium', assignee: 'p05', project: 'expense', labels: ['缺陷'],       dueDate: '2026-09-14', createDate: '2026-09-08' },
  { id: 13, code: 'T1000013', title: '采购价格比对看板', desc: '开发采购价格历史比对看板，展示同一物料近 12 个月采购价格趋势曲线，标注最高/最低/均价。支持多供应商横向比价（柱状图+表格双视图）。价格异常波动（偏离均价±15%）自动标红并推送预警。看板支持按物料分类、供应商、采购员筛选。已完成前端组件开发，正在对接数据接口。', status: 'in_review',  priority: 'medium', assignee: 'p01', project: 'purchase', labels: ['需求'],     dueDate: '2026-09-26', createDate: '2026-09-20' },
  { id: 14, code: 'T1000014', title: '供应商合同到期提醒', desc: '配置供应商合同到期自动提醒机制：到期前 90/60/30/15/7 天分五级递进提醒，提醒方式从站内消息逐步升级至邮件+短信。提醒对象为合同签约人和对应采购员。支持合同续签在线发起（带原合同信息预填），续签审批通过后自动延长合同到期日并重置提醒周期。', status: 'backlog',     priority: 'low',    assignee: 'p03', project: 'supply', labels: ['缺陷'],              dueDate: '2026-10-05', createDate: '2026-09-22' },
  { id: 15, code: 'T1000015', title: '入库单批量打印', desc: '开发入库单批量打印功能：支持按日期范围、仓库、单据状态筛选入库单，勾选后一键批量打印。打印队列支持排序（按日期/单号/仓库），打印进度实时显示（已打印/总计）。支持打印份数设置和补打标记（避免重复打印浪费纸张）。已完成后端接口和筛选交互，正在开发打印队列渲染逻辑。', status: 'in_progress', priority: 'low',    assignee: 'p07', project: 'purchase', labels: ['需求'],              dueDate: '2026-09-30', createDate: '2026-09-21' },
  { id: 16, code: 'T1000016', title: '报表权限分级管控', desc: '配置报表查看权限分级管控体系：按角色（高管/部门主管/业务员）和部门维度控制报表可见范围。高管查看全公司汇总报表，部门主管仅看本部门明细，业务员仅看本人数据。支持行列级权限（隐藏敏感列如成本价、利润率）。权限变更需审批并记录日志。阻塞原因：权限矩阵需与集团统一身份认证中心联调，对方接口排期到下周。', status: 'blocked',     priority: 'urgent', assignee: 'p04', project: 'expense', labels: ['缺陷'],       dueDate: '2026-09-23', createDate: '2026-09-18' },
  { id: 17, code: 'T1000017', title: '采购退货流程开发', desc: '开发采购退货全流程：发起退货申请（选退货原因、填写退货数量、上传照片凭证）→退货审批（采购主管+质量主管双签）→生成退货出库单→库存回退（扣减入库数量、恢复可用库存）→财务退款处理（冲销应付账款）。退货原因分类：质量问题、规格不符、多发货、过期退货。支持退货明细行级部分退货。', status: 'backlog',     priority: 'high',   assignee: 'p01', project: 'purchase', labels: ['需求'],       dueDate: '2026-10-02', createDate: '2026-09-23' },
  { id: 18, code: 'T1000018', title: '供应商评分明细报表', desc: '开发供应商评分明细报表，展示每个供应商各维度评分明细及加权总分。支持多维度钻取：点击交货准时率可下钻到每笔订单的交货记录，点击质量合格率可下钻到每批次质检报告。报表支持导出 Excel 并附评分趋势图（近 6 期评分变化折线）。已完成后端查询逻辑，正在开发前端钻取交互。', status: 'in_review',  priority: 'medium', assignee: 'p03', project: 'supply', labels: ['缺陷'],     dueDate: '2026-09-27', createDate: '2026-09-20', parentId: 2 },
  { id: 19, code: 'T1000019', title: '入库扫码功能开发', desc: '开发 PDA 扫码入库功能：扫描采购订单条码自动带出待入库明细，扫描物料条码匹配明细行并填入实收数量。支持连续扫描模式（不跳转页面逐条扫描）。异常处理：扫码与订单不符时弹窗提示并阻止入库、实收大于应收时拦截。扫码完成后一键提交入库单并打印入库标签。已完成 PDA 端页面框架，正在对接扫码 SDK。', status: 'in_progress', priority: 'high',   assignee: 'p07', project: 'purchase', labels: ['需求'],        dueDate: '2026-09-29', createDate: '2026-09-22', parentId: 3 },
  { id: 20, code: 'T1000020', title: '财务凭证自动生成', desc: '配置采购入库自动生成财务凭证规则：入库单审核通过后自动生成借记"原材料"、贷记"应付账款"凭证；退货入库生成红字冲销凭证。凭证模板支持科目映射配置（按物料类别映射不同存货科目）、摘要模板自定义、辅助核算项自动填充。月结时批量校验凭证借贷平衡，异常凭证自动标记并通知会计处理。', status: 'done',        priority: 'medium', assignee: 'p22', project: 'expense', labels: ['缺陷'],     dueDate: '2026-09-12', createDate: '2026-09-06' },
  { id: 21, code: 'T1000021', title: '采购订单批量审批', desc: '开发采购订单批量审批功能：列表页支持勾选多张订单后点击"批量审批"，弹窗显示选中订单汇总信息（总金额、供应商数、明细行数）供确认。支持快捷键操作（Ctrl+A 全选、Enter 确认、Esc 取消）。批量审批限制：不同供应商订单不能混合审批、超过单笔审批限额的订单自动排除。审批结果汇总展示成功/失败条数。', status: 'backlog',     priority: 'medium', assignee: 'p02', project: 'purchase', labels: ['需求'],              dueDate: '2026-10-03', createDate: '2026-09-23' },
  { id: 22, code: 'T1000022', title: '供应商资质文件管理', desc: '开发供应商资质文件管理模块：支持营业执照、税务登记证、组织机构代码证、开户许可证、质量体系认证等文件的上传（PDF/图片，单文件<10MB）。OCR 自动识别证照关键字段（编号、有效期、经营范围）并入库。到期前 60 天自动提醒更新，过期文件标红冻结。支持文件版本管理，历史版本可追溯。', status: 'in_review',  priority: 'low',    assignee: 'p03', project: 'supply', labels: ['缺陷'],       dueDate: '2026-09-28', createDate: '2026-09-19' },
  { id: 23, code: 'T1000023', title: '入库库存预警看板', desc: '开发入库库存预警实时看板，适配仓库大屏展示（1920x1080 横屏）。看板分四个区域：今日入库概览（总单数/总数量/异常数）、库存水位监控（红黄绿三色预警图）、实时入库流水（滚动展示最新 20 条）、异常待处理清单。数据每 30 秒自动刷新，支持手动暂停刷新。已完成大屏 UI 框架，正在对接 WebSocket 实时推送。', status: 'in_progress', priority: 'urgent', assignee: 'p07', project: 'purchase', labels: ['需求'],     dueDate: '2026-09-24', createDate: '2026-09-21' },
  { id: 24, code: 'T1000024', title: '报表数据校验规则', desc: '配置报表数据完整性校验规则库：借贷平衡校验（差额=0）、科目编码规范校验（长度/层级/编码段）、必填项校验（摘要/日期/金额非空）、逻辑校验（资产=负债+权益）。校验不通过时自动生成异常清单并标记异常类型和行号，支持一键定位到原始凭证。校验规则支持自定义扩展，规则变更需审批。', status: 'backlog',     priority: 'medium', assignee: 'p05', project: 'expense', labels: ['缺陷'],       dueDate: '2026-10-01', createDate: '2026-09-22' },
  { id: 25, code: 'T1000025', title: '采购合同电子签署', desc: '对接第三方电子签署平台（e签宝），完成采购合同在线签署全流程：上传合同 PDF→设置签署方（乙方信息自动填充）→拖拽设置签署位置→发起签署→对方短信通知→签署完成回调。签署完成的合同自动归档并带数字签名水印。支持签署状态实时查询和签署日志导出。阻塞原因：e签宝测试环境密钥申请流程卡在法务审批。', status: 'blocked',     priority: 'high',   assignee: 'p01', project: 'purchase', labels: ['需求'],       dueDate: '2026-09-25', createDate: '2026-09-17' },
  { id: 26, code: 'T1000026', title: '供应商评级接口联调', desc: '供应商评级计算接口与前端联调测试：后端提供评级查询（按供应商/期间/维度）、评级明细钻取、评级趋势图数据三个接口。联调发现问题：钻取接口分页参数传递异常（已修复）、趋势图日期范围边界值返回空（已修复）、评级总分小数精度不一致（待修复）。需补充接口文档并更新 Mock 数据。', status: 'in_review',  priority: 'high',   assignee: 'p03', project: 'supply', labels: ['缺陷'],       dueDate: '2026-09-26', createDate: '2026-09-20', parentId: 2 },
  { id: 27, code: 'T1000027', title: '入库上架指引开发', desc: '开发入库上架指引页面：扫描物料条码后系统自动推荐上架库位，推荐算法基于就近原则（优先同品属相邻库位）+分散存储策略（同批次拆分到不同货架降低风险）。指引页面显示推荐库位平面图（高亮目标货架）、搬运路径规划。支持人工修改库位，修改时校验该库位容量和承重限制。', status: 'in_progress', priority: 'low',    assignee: 'p07', project: 'purchase', labels: ['需求'],     dueDate: '2026-10-04', createDate: '2026-09-22', parentId: 3 },
  { id: 28, code: 'T1000028', title: '财务对账自动化', desc: '开发采购与财务自动对账功能：按采购订单维度自动匹配采购入库记录与财务付款记录，匹配规则：订单号+金额完全一致自动匹配、金额差异<100元标记为"小额差异"待人工确认、差异>100元标记为"异常"。对账结果生成差异明细表，支持导出 Excel 和批量处理（确认/退回/挂账）。已上线运行，月均处理对账记录 3000+条。', status: 'done',        priority: 'medium', assignee: 'p22', project: 'expense', labels: ['缺陷'],     dueDate: '2026-09-10', createDate: '2026-09-04' },
  { id: 29, code: 'T1000029', title: '采购询价比价功能', desc: '开发采购询价比价模块：发起询价时自动拉取同物料历史采购价作为基准价参考，支持同时向多家供应商发起询价（邮件/站内消息）。供应商报价回收后自动生成比价矩阵表（含报价、交期、最小起订量、付款条件），按综合成本最低推荐中标供应商。支持询价单转采购订单一键创建。', status: 'backlog',     priority: 'medium', assignee: 'p02', project: 'purchase', labels: ['需求'],     dueDate: '2026-10-06', createDate: '2026-09-23' },
  { id: 30, code: 'T1000030', title: '供应商绩效月报', desc: '配置供应商绩效月报自动生成和推送：每月 3 日自动生成上月供应商绩效报告，内容包括交货准时率排行、质量异常 TOP10、价格波动分析、合作金额统计。报告以 PDF 附件形式邮件推送至采购总监和各品类采购经理，同时在系统中归档可在线查阅。支持订阅特定供应商的绩效月报。', status: 'in_review',  priority: 'low',    assignee: 'p03', project: 'supply', labels: ['缺陷'],        dueDate: '2026-09-29', createDate: '2026-09-19' },
  { id: 31, code: 'T1000031', title: '入库盘点任务管理', desc: '开发入库盘点任务全流程管理：创建盘点计划（选择仓库/品类/盘点日期）→系统生成盘点清单（自动带出账面库存）→分配盘点人→PDA 扫码盘点录入实盘数量→系统自动计算盘盈盘亏→生成盘点差异报告→差异审批处理（盘亏需追究责任）→调整库存账面。支持盲盘（不显示账面数量）和明盘两种模式。', status: 'in_progress', priority: 'medium', assignee: 'p07', project: 'purchase', labels: ['需求'],       dueDate: '2026-09-30', createDate: '2026-09-21' },
  { id: 32, code: 'T1000032', title: '报表订阅推送配置', desc: '配置报表定时订阅推送功能：用户可订阅任意报表并设置推送规则（每日/每周/每月、推送时间、收件人、格式 PDF/Excel）。推送渠道支持邮件附件、站内消息链接、企业微信卡片三种。订阅管理页面展示所有订阅列表，支持暂停/恢复/删除。已实现订阅创建和邮件推送通道，企业微信通道待对接。', status: 'backlog',     priority: 'low',    assignee: 'p04', project: 'expense', labels: ['缺陷'],       dueDate: '2026-10-08', createDate: '2026-09-22' },
  { id: 33, code: 'T1000033', title: '生产工单排程引擎开发', desc: '开发生产工单排程引擎，基于工序工时、设备产能和交期约束自动生成最优排产计划。支持手动拖拽调整排程甘特图，调整后自动重算后续工序时间。排程冲突（设备占用、人员重叠）时高亮提示并给出替代方案。已完成排程算法核心逻辑，正在开发甘特图交互组件。', status: 'in_progress', priority: 'high',   assignee: 'p01', project: 'production', labels: ['需求'],     dueDate: '2026-09-28', createDate: '2026-09-21' },
  { id: 34, code: 'T1000034', title: '工序流转状态机设计', desc: '设计工序流转状态机：待开工→开工→首检→工序加工→完工检验→流转下一工序。支持并行工序和可选工序分支。状态变更自动记录操作人、时间和设备编号。异常状态（返工、报废、让步接收）走独立流转分支，需质量主管审批后才能继续。已完成状态机UML设计文档，待架构评审。', status: 'in_review',  priority: 'medium', assignee: 'p03', project: 'production', labels: ['缺陷'],        dueDate: '2026-09-26', createDate: '2026-09-19' },
  { id: 35, code: 'T1000035', title: '产能利用率看板开发', desc: '开发车间产能利用率实时看板：按产线/设备/班组维度展示当日产能、实际产出、利用率（绿>85%正常/黄70-85%关注/红<70%预警）。看板支持班次切换查看历史对比，自动生成产能趋势曲线（近30天）。低于阈值时推送告警给车间主任。已完成后端聚合查询，正在对接前端图表。', status: 'backlog',     priority: 'medium', assignee: 'p04', project: 'production', labels: ['需求'],     dueDate: '2026-10-02', createDate: '2026-09-22' },
  { id: 36, code: 'T1000036', title: '生产报工扫码功能', desc: '开发车间PDA扫码报工功能：扫描工单条码自动带出工序列表，选择当前工序后扫描设备码确认开工。完工时扫描物料批次号关联产出批次，输入完工数量和不合格数量。支持离线报工缓存，联网后自动同步。已完成PDA端页面开发，正在对接扫码SDK和离线缓存方案。', status: 'in_progress', priority: 'high',   assignee: 'p07', project: 'production', labels: ['缺陷'],        dueDate: '2026-09-30', createDate: '2026-09-21' },
  { id: 37, code: 'T1000037', title: '质量追溯数据链路', desc: '搭建产品质量全链路追溯：从原材料批次（供应商/入库/检验）→生产工序（设备/人员/参数）→完工检验→成品入库→发货记录，全链路数据关联并可正反向追溯。输入成品序列号即可查看完整生产履历。追溯数据支持导出PDF质量证明书。已上线试运行，覆盖3条核心产线。', status: 'done',        priority: 'low',    assignee: 'p22', project: 'production', labels: ['需求'],     dueDate: '2026-09-15', createDate: '2026-09-08' },
  { id: 38, code: 'T1000038', title: '工单自动派单算法', desc: '开发工单自动派单算法：按技能标签匹配工程师（Java/前端/运维），叠加当前负载权重（处理中工单数）和SLA优先级（紧急工单插队）。支持手动指派覆盖自动分配结果，手动指派记录操作日志。派单后自动推送企微通知，30分钟未响应自动转派。算法方案已评审，正在编码实现。', status: 'in_review',  priority: 'urgent', assignee: 'p03', project: 'service', labels: ['缺陷'],        dueDate: '2026-09-25', createDate: '2026-09-20' },
  { id: 39, code: 'T1000039', title: '多渠道工单接入层', desc: '开发多渠道工单接入层：统一接入企业微信、邮件、电话录音转写、官网表单四个渠道的工单。各渠道消息格式归一化为标准工单结构（标题/描述/紧急程度/联系人/来源渠道）。邮件渠道支持附件提取并关联到工单。已完成企微和邮件渠道对接，电话和官网渠道待开发。', status: 'in_progress', priority: 'high',   assignee: 'p01', project: 'service', labels: ['需求'],        dueDate: '2026-09-29', createDate: '2026-09-21' },
  { id: 40, code: 'T1000040', title: 'SLA倒计时监控', desc: '开发工单SLA倒计时监控：按工单优先级配置响应时效（紧急30分/高2时/中4时/低8时）和解决时效（紧急4时/高8时/中24时/低48时）。超时前15分钟黄色预警，超时后红色告警并自动升级优先级。看板展示所有倒计时工单，按剩余时间排序。阻塞原因：SLA规则引擎依赖的定时调度服务集群扩容审批中。', status: 'blocked',     priority: 'high',   assignee: 'p22', project: 'service', labels: ['缺陷'],     dueDate: '2026-09-26', createDate: '2026-09-18' },
  { id: 41, code: 'T1000041', title: '客户满意度评价页', desc: '开发工单关闭后的客户满意度评价页面：1-5星评分+标签快选（响应快/专业/耐心/已解决）+可选文字评价。评价链接随工单关闭通知短信/邮件发送。低于3星的工单自动标记并推送至客服主管，触发回访流程。已完成评价页UI和提交接口，正在对接通知推送。', status: 'backlog',     priority: 'low',    assignee: 'p04', project: 'service', labels: ['需求'],     dueDate: '2026-10-05', createDate: '2026-09-23' },
  { id: 42, code: 'T1000042', title: '工单批量导出功能', desc: '开发工单批量导出功能：支持按时间范围、渠道、状态、处理人筛选后一键导出 Excel。导出字段可配置（默认含工单号/标题/状态/优先级/处理人/创建时间/关闭时间/满意度），导出数据量上限 5 万条。已上线使用，日均导出 30+ 次。', status: 'done',        priority: 'medium', assignee: 'p05', project: 'service', labels: ['缺陷'],        dueDate: '2026-09-12', createDate: '2026-09-06' },
  { id: 43, code: 'T1000043', title: '人效指标体系搭建', desc: '搭建人力效能指标体系：人均产值（总产值/在职人数）、人均利润、单位人工成本产出、加班占比、核心岗位流失率。指标按部门/团队/个人三级下钻，支持同比环比对比。指标定义文档已通过HR部门评审，正在开发指标计算逻辑和落库方案。', status: 'in_review',  priority: 'high',   assignee: 'p04', project: 'hr-analytics', labels: ['需求'],     dueDate: '2026-09-27', createDate: '2026-09-20' },
  { id: 44, code: 'T1000044', title: '组织画像可视化看板', desc: '开发组织画像可视化看板：部门人数分布树状图、学历分布饼图、年龄结构柱状图、司龄分布、职级分布。支持按部门筛选和层级下钻。看板顶部展示组织健康度综合评分（结构合理性+人才密度+流动率）。已完成前端框架和数据接口对接，正在开发下钻交互。', status: 'in_progress', priority: 'medium', assignee: 'p01', project: 'hr-analytics', labels: ['缺陷'],     dueDate: '2026-09-30', createDate: '2026-09-22' },
  { id: 45, code: 'T1000045', title: '离职风险预测模型', desc: '开发员工离职风险预测模型：特征工程包含司龄、调薪间隔、加班时长趋势、请假天数变化、绩效评分变化、直属主管离职率等12个维度。采用梯度提升树算法，输出离职概率分档（高>70%/中30-70%/低<30%）。高险人员自动推送给HRBP，附风险因子贡献度。模型方案设计中。', status: 'backlog',     priority: 'urgent', assignee: 'p03', project: 'hr-analytics', labels: ['需求'],     dueDate: '2026-09-25', createDate: '2026-09-23' },
  { id: 46, code: 'T1000046', title: '人力数据ETL管道', desc: '搭建人力数据ETL管道：从HR系统（花名册/考勤/薪酬/绩效）定时抽取数据，经清洗转换后落入分析数仓。增量抽取频率每日凌晨2点，全量补数据支持手动触发。字段映射规则可配置，异常数据（空值/越界/编码不匹配）进入待确认队列。阻塞原因：HR系统开放API排期到下月。', status: 'blocked',     priority: 'high',   assignee: 'p22', project: 'hr-analytics', labels: ['缺陷'],       dueDate: '2026-09-28', createDate: '2026-09-18' },
  { id: 47, code: 'T1000047', title: '考勤数据自动汇总', desc: '配置考勤数据自动汇总定时任务：每日凌晨从考勤机系统拉取打卡记录，按排班规则自动计算迟到/早退/缺卡/加班时长，生成日考勤汇总。异常打卡（缺班/连续迟到3天）自动推送部门主管。月度汇总次月3日生成，支持导出 Excel 考勤月报。已上线运行。', status: 'done',        priority: 'low',    assignee: 'p05', project: 'hr-analytics', labels: ['需求'],       dueDate: '2026-09-10', createDate: '2026-09-04' },
  { id: 48, code: 'T1000048', title: '库位动态优化算法', desc: '开发库位动态优化算法：基于ABC分类（高频出入库A类就近/低频C类远端）+批次亲和性（同物料集中存放）+承重均衡三大策略，自动推荐货物上架库位。每周生成库位调整建议清单，支持一键执行调整（系统自动打印搬移标签）。算法模型已通过模拟验证，正在对接WMS库位数据。', status: 'in_progress', priority: 'high',   assignee: 'p03', project: 'warehouse', labels: ['缺陷'],     dueDate: '2026-09-28', createDate: '2026-09-21' },
  { id: 49, code: 'T1000049', title: '扫码出入库PDA开发', desc: '开发仓储PDA扫码出入库功能：入库时扫描采购订单→扫描物料条码→输入实收数量→系统校验订单明细匹配→确认入库并打印库位标签。出库时扫描领料单→推荐拣货库位→扫码确认拣货→更新库存。支持连续扫码模式和离线缓存。已完成PDA端框架和入库流程，出库扫码待开发。', status: 'in_review',  priority: 'urgent', assignee: 'p07', project: 'warehouse', labels: ['需求'],        dueDate: '2026-09-25', createDate: '2026-09-19' },
  { id: 50, code: 'T1000050', title: '库存实时预警引擎', desc: '开发库存实时预警引擎：监控安全库存阈值（低于安全线黄色/为零红色）、库龄超期（>180天橙色/>365天红色）、呆滞料识别（无动销>90天标记）。预警事件推送至仓储主管和对应采购员，同时在看板滚动展示。引擎已部署，正在调试阈值参数和推送频率。', status: 'in_progress', priority: 'high',   assignee: 'p01', project: 'warehouse', labels: ['缺陷'],        dueDate: '2026-09-29', createDate: '2026-09-20' },
  { id: 51, code: 'T1000051', title: '库龄分析与呆滞料识别', desc: '开发库龄分析与呆滞料识别报表：按物料维度展示入库日期、库龄天数、库龄分布直方图。呆滞料识别规则：90天无动销预警、180天冻结采购建议、365天启动清仓处理。报表支持按仓库/品类/供应商筛选，自动计算呆滞金额占比。已完成后端分析逻辑。', status: 'backlog',     priority: 'medium', assignee: 'p02', project: 'warehouse', labels: ['需求'],     dueDate: '2026-10-03', createDate: '2026-09-22' },
  { id: 52, code: 'T1000052', title: '仓储大屏可视化', desc: '开发仓储运营大屏（1920x1080横屏）：四区布局——今日出入库概览（单数/数量/异常）、库存水位热力图（按库区色温展示利用率）、实时出入库流水滚动、预警待处理清单。数据每15秒自动刷新，支持暂停。已上线部署在仓库入口大屏，日均运行稳定。', status: 'done',        priority: 'low',    assignee: 'p04', project: 'warehouse', labels: ['缺陷'],     dueDate: '2026-09-14', createDate: '2026-09-07' },
  { id: 73, code: 'T1000073', title: '采购合同电子签章需求梳理', desc: '梳理采购合同电子签章的适用单据、签署顺序、证书校验和归档范围；待法务确认签章主体与验收边界后，再安排专家团评估和实施。', status: 'planned', priority: 'medium', assignee: 'p02', project: 'purchase', labels: ['需求'], dueDate: '2026-10-12', createDate: '2026-09-24' },
  { id: 74, code: 'T1000074', title: '旧版工单短信模板迁移', desc: '原计划将旧版工单短信模板迁移到新通知中心；因模板已被统一消息服务替代，项目负责人取消该项工作并保留任务记录供追溯。', status: 'cancelled', priority: 'low', assignee: 'p04', project: 'service', labels: ['缺陷'], dueDate: '2026-09-30', createDate: '2026-09-20' },
];

/* 将吴晓锋项目已有的演示任务接入当前任务管理列表。 */
const LINGEE_TASK_STATUSES = {
  '未开始': 'backlog', '待办': 'backlog', '进行中': 'in_progress',
  '待评审': 'in_review', '审核中': 'in_review', '已完成': 'done', '已失败': 'blocked', '已阻塞': 'blocked',
};
const LINGEE_TASK_PRIORITIES = { '高': 'high', '中': 'medium', '低': 'low' };
function tkConvertCvTasks(projectId, startId) {
  var modules = new Map(CV_TASKS.filter(function (task) {
    return task.project === projectId && task.kind === 'epic';
  }).map(function (task) { return [task.boardId, { name: task.title, priority: task.priority }]; }));
  var owner = CV_PROJECTS.find(function (p) { return p.id === projectId; });
  var ownerId = owner ? (CV_MEMBERS.find(function (m) { return m.name === owner.owner; }) || {}).id || '' : '';
  return CV_TASKS.filter(function (task) {
    return task.project === projectId && task.kind !== 'epic';
  }).map(function (task, index) {
    var id = startId + index;
    var assignee = CV_MEMBERS.find(function (person) { return person.name === task.assignee; });
    var module = modules.get(task.parentTaskId);
    var dueDate = new Date(Date.UTC(2026, 9, 5 + index));
    return {
      id: id, code: 'T' + String(1000000 + id), title: task.title, desc: task.desc || '',
      status: LINGEE_TASK_STATUSES[task.status] || 'backlog',
      priority: LINGEE_TASK_PRIORITIES[task.priority || module?.priority] || 'medium',
      assignee: assignee?.id || ownerId || 'p23', createdBy: ownerId || 'p23', project: projectId,
      labels: task.type === 'Bug' ? ['缺陷'] : ['需求'],
      createDate: '2026-09-' + String(10 + index % 10).padStart(2, '0'),
      dueDate: dueDate.toISOString().slice(0, 10),
    };
  });
}
TK_TASKS.push(...tkConvertCvTasks('lingee-prototype', 53).slice(0, 20));
TK_TASKS.push(...tkConvertCvTasks('cosmic-app-dev', 75));

/* 团队任务按人分配；编号固定，便于已保存的本地数据一次性补种。 */
const TK_TEAM_ASSIGN_IDS = ['p29','p30','p31','p32','p33','p35','p36','p37','p38','p39','p40','p41'];
const TK_PERSONAL_DEMO_TASKS = TK_TEAM_ASSIGN_IDS.flatMap(function (personId, index) {
  return [
    { id:1001 + index * 2, code:'T100' + String(1001 + index * 2), title:'梳理任务需求与验收条件',
      desc:'核对当前负责范围、输入资料和验收条件。', status:'backlog', priority:'medium', assignee:personId,
      createdBy:personId, project:'lingee-prototype', labels:['需求'], createDate:'2026-09-25', dueDate:'2026-10-08' },
    { id:1002 + index * 2, code:'T100' + String(1002 + index * 2), title:'完成方案协作记录',
      desc:'整理已参与的方案讨论与交付记录。', status:'done', priority:'low', assignee:TK_TEAM_ASSIGN_IDS[(index + 1) % TK_TEAM_ASSIGN_IDS.length],
      createdBy:personId, project:'lingee-prototype', labels:['需求'], createDate:'2026-09-20', dueDate:'2026-09-26' },
  ];
});
TK_TASKS.push(...TK_PERSONAL_DEMO_TASKS);

/* ---------- 工具函数：根据 id 查名称 ---------- */
export function tkGetStatusName(id) {
  var s = TK_STATUSES.find(function (x) { return x.id === id; });
  return s ? s.name : id;
}
export function tkGetPriorityName(id) {
  var p = TK_PRIORITIES.find(function (x) { return x.id === id; });
  return p ? p.name : id;
}
export function tkGetPerson(id) {
  var p = TK_PEOPLE.find(function (x) { return x.id === id; });
  if (p) return p;
  var member = CV_MEMBERS.find(function (x) { return x.id === id; });
  return member ? { id:member.id, name:member.name, avatar:member.name.slice(0, 1), color:'#495dff' } : { id: id, name: '未分配', avatar: '?', color: '#b8b8b8' };
}
export function tkGetProjectName(id) {
  var p = TK_PROJECTS.find(function (x) { return x.id === id; });
  return p ? p.name : id;
}
export function tkGetStatusObj(id) {
  return TK_STATUSES.find(function (x) { return x.id === id; }) || {};
}
export function tkGetPriorityObj(id) {
  return TK_PRIORITIES.find(function (x) { return x.id === id; }) || {};
}

/* ---------- 可变状态（原型用内存数组，支持增删改） ---------- */
/* 示例运行停在不同交付阶段；审核中表示该阶段运行已结束，等待人工确认。 */
const DEMO_EXECUTION_STAGES = ['requirements','design','planning','implementation','verification','delivery'];
const DEMO_TASK_STAGE = {
  1:'implementation',5:'implementation',8:'verification',11:'requirements',15:'implementation',19:'implementation',
  23:'verification',27:'design',31:'planning',33:'implementation',36:'verification',39:'implementation',
  44:'verification',48:'design',50:'delivery',
  2:'design',9:'implementation',13:'design',18:'verification',22:'implementation',26:'verification',
  30:'delivery',34:'design',38:'verification',43:'design',49:'verification',58:'delivery',70:'delivery',
  4:'verification',16:'implementation',25:'implementation',40:'planning',46:'requirements',63:'verification',
};
function taskMinuteNow() {
  var now = new Date();
  function pad(value) { return String(value).padStart(2, '0'); }
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' '
    + pad(now.getHours()) + ':' + pad(now.getMinutes());
}
var _tasks = TK_TASKS.map(function (t) {
  var people = tkPeopleInProject(t.project).filter(function (person) { return TK_DEMO_PERSON_IDS.includes(person.id); });
  return Object.assign({
    initialStatus:t.status,
    executionStageId:['in_progress','in_review','blocked'].includes(t.status)
      ? DEMO_TASK_STAGE[t.id] || DEMO_EXECUTION_STAGES[t.id % DEMO_EXECUTION_STAGES.length]
      : null,
    createdBy: t.project === 'expense' && t.id % 4 === 0 ? 'p22' : (people[(t.id + 1) % people.length]?.id || ''),
    createdAt: t.createDate + ' 09:30',
    updatedAt: t.createDate + ' 10:15',
    reviewReport: createDemoReviewReport(t),
    blockedRun: createDemoBlockedRun(t),
    completedRun: createDemoCompletedRun(t),
  }, t);
});
const TASKS_STORAGE_KEY = 'lingee_tasks_v2';
try {
  var savedTasks = JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY) || 'null');
  if (Array.isArray(savedTasks) && savedTasks.every(function (task) { return task && Number.isInteger(task.id) && typeof task.project === 'string'; })) _tasks = savedTasks;
} catch (e) { /* 存储数据损坏时使用演示任务 */ }
/* 只补充缺失的示例任务，不改写本地已有任务或人员分工。 */
try {
  if (!localStorage.getItem('lingee_tasks_personal_seed_v1')) {
    var existingCodes = new Set(_tasks.map(function (task) { return task.code; }));
    _tasks.push(...TK_PERSONAL_DEMO_TASKS.filter(function (task) { return !existingCodes.has(task.code); }));
    persistTasks();
    localStorage.setItem('lingee_tasks_personal_seed_v1', '1');
  }
} catch (e) { /* 本地存储不可用时保留内存中的示例任务 */ }
/* 清理已补种到本地或共享存储中的旧标题，只匹配原始演示文案，保留用户改过的标题。 */
var personalDemoTitles = new Map(TK_PERSONAL_DEMO_TASKS.map(function (task) { return [task.code, task.title]; }));
var personalDemoNames = new Set(TK_TEAM_ASSIGN_IDS.map(function (id) {
  return CV_MEMBERS.find(function (member) { return member.id === id; })?.name;
}).filter(Boolean));
var personalTitlesChanged = false;
_tasks.forEach(function (task) {
  var plainTitle = personalDemoTitles.get(task.code);
  if (!plainTitle || typeof task.title !== 'string') return;
  var separator = task.title.indexOf('：');
  if (separator < 0 || task.title.slice(separator + 1) !== plainTitle || !personalDemoNames.has(task.title.slice(0, separator))) return;
  task.title = plainTitle;
  personalTitlesChanged = true;
});
if (personalTitlesChanged) {
  try { persistTasks(); } catch (e) { /* 存储不可用时仍更新当前页面 */ }
}
/* p34（早期误建的重复记录）名下任务归并到 p23（吴晓锋）；幂等，人员已并入后不会再出现 */
_tasks.forEach(function (task) { if (task.assignee === 'p34') task.assignee = 'p23'; });
try {
  if (!localStorage.getItem('lingee_tasks_merge_p34_v1')) {
    persistTasks();
    localStorage.setItem('lingee_tasks_merge_p34_v1', '1');
  }
} catch (e) { /* 本地存储不可用时跳过持久化 */ }
function persistTasks() {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(_tasks));
  if (typeof document !== 'undefined') document.dispatchEvent(new Event('lingee:tasks-changed'));
}
var _views = TK_VIEWS.map(function (v) { return Object.assign({}, v); });
try {
  var storedViews = JSON.parse(localStorage.getItem('lingee_tasks_custom_views') || '[]');
  if (Array.isArray(storedViews)) _views = _views.concat(storedViews.filter(function (v) { return v && typeof v.id === 'string' && typeof v.name === 'string' && !v.builtin; }));
} catch (e) { /* 本地存储不可用时仍可在当前页面管理视图 */ }
var _nextId = Math.max(0, ...TK_TASKS.map(function (task) { return task.id; }), ..._tasks.map(function (task) { return task.id; })) + 1;
var _nextViewId = Math.max(4, ..._views.map(function (v) {
  var number = Number(v.id.slice(1));
  return v.id.charAt(0) === 'v' && Number.isInteger(number) ? number + 1 : 0;
}));
function persistViews() {
  try { localStorage.setItem('lingee_tasks_custom_views', JSON.stringify(_views.filter(function (v) { return !v.builtin; }))); }
  catch (e) { /* 本地存储不可用时保留内存中的视图 */ }
}

export function tkGetTasks() { return _tasks; }
export function tkSetTasks(arr) { _tasks = arr; persistTasks(); }
/* 只在明确删除工作区后，按该工作区的项目 ID 清理任务；刷新时不能据未恢复的项目列表删数据。 */
export function tkPruneOrphanTasks(projectIds) {
  if(!Array.isArray(projectIds)||!projectIds.length)return;
  var removed=new Set(projectIds);
  var previousLength=_tasks.length;
  _tasks=_tasks.filter(function(task){return !removed.has(task.project);});
  if(_tasks.length!==previousLength)persistTasks();
}
export function tkEnsureWorkspaceDemoTasks() {
  var projects=tkProjectsForCurrentUser();
  var project=projects.find(function(row){return row.demoSeed;});
  if(!project||_tasks.some(function(task){return projects.some(function(row){return row.id===task.project;});}))return false;
  var personId=tkCurrentUserId();
  if(!personId)return false;
  [
    {title:'梳理需求与验收标准',desc:'明确范围、参与人和交付标准',status:'backlog',priority:'high',module:'需求梳理'},
    {title:'实现核心流程并完成联调',desc:'完成主要功能并与上下游接口联调',status:'in_progress',priority:'medium',module:'开发实现'},
    {title:'评审代码与测试结果',desc:'检查实现质量并确认关键测试用例',status:'in_review',priority:'medium',module:'质量验证'},
    {title:'整理发布说明',desc:'汇总变更内容和使用说明',status:'done',priority:'low',module:'交付发布'}
  ].forEach(function(spec){tkAddTask({...spec,project:project.id,assignee:personId,createdBy:personId,labels:['演示']});});
  return true;
}
export function tkAddTask(task) {
  var now = taskMinuteNow();
  task.id = _nextId++;
  task.code = 'T' + String(1000000 + task.id);
  task.createDate = now.slice(0, 10);
  task.createdAt = now;
  task.updatedAt = now;
  task.initialStatus = task.status;
  task.statusHistory = [];
  if (!task.createdBy) task.createdBy = tkCurrentUserId();
  _tasks.unshift(task);
  persistTasks();
  return task;
}
export function tkUpdateTask(id, patch) {
  var t = _tasks.find(function (x) { return x.id === id; });
  if (t) {
    var before = { status:t.status, priority:t.priority, assignee:t.assignee, dueDate:t.dueDate, comments:(t.comments || []).length };
    if (patch.status && patch.status !== t.status) {
      t.statusHistory = (t.statusHistory || []).concat({
        from:t.status, to:patch.status, authorId:tkCurrentUserId(), time:taskMinuteNow(),
      });
    }
    if (patch.assignee && patch.assignee !== t.assignee && t.assignee) {
      t.assigneeHistory = Array.from(new Set((t.assigneeHistory || []).concat(t.assignee)));
    }
    Object.assign(t, patch, { updatedAt: taskMinuteNow() });
    persistTasks();
    if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('lingee:task-updated', { detail:{ task:t, before:before, patch:patch } }));
  }
  return t;
}
export function tkDeleteTask(id) {
  _tasks = _tasks.filter(function (x) { return x.id !== id; });
  persistTasks();
}
export function tkGetViews() { return _views; }
export function tkAddView(name, config) {
  var v = Object.assign({ id: 'v' + _nextViewId++, name: name, scope: 'all', builtin: false }, config || {});
  _views.push(v);
  persistViews();
  return v;
}
export function tkDeleteView(id) {
  _views = _views.filter(function (v) { return v.id !== id; });
  persistViews();
}
export function tkRenameView(id, name) {
  var v = _views.find(function (x) { return x.id === id; });
  if (v) { v.name = name; persistViews(); }
}
