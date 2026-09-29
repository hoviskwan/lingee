import { $, $$ } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { navItems, showView } from '../core/view.js';
import { chatAppDd, selectChatApp } from './attach-app.js';
import { createArtifactCard, messagesList, scrollChatBottom } from './composer.js';
import { EX, PRESET_TEAMS, STAGES, xav, xesc } from './expert/data.js';
import { renderExpertChips } from './expert/chips.js';
import { set_activePick } from './expert/store.js';
/* 侧边栏演示会话：苍穹应用开发专家团执行「苍穹采购订单开发」。
   阶段沿用专家团流程 STAGES，演示停在「编码实现」完成、等待进入「测试验证」。 */

var TEAM_ID = 'cosmic-app-dev';
var SESSION_TITLE = '苍穹采购订单开发';
/* 会话关联的采购订单开发任务，点击标题旁标签可跳转任务详情 */
var LINKED_TASK = { id: 1, code: 'T1000001', title: '采购订单列表页开发' };
var USER_PROMPT = '帮我在苍穹上开发采购订单：录入供应商与物料明细，自动计算含税金额；'
  + '提交后走部门主管 → 采购经理两级审批，审核后可同步到供应商协同平台，并提供采购订单执行情况报表。';

/* 各阶段执行记录：owner 为主责专家，steps 为过程，outputs 为阶段产物 */
var STAGE_RUNS = {
  requirements: {
    owners: ['software-product-manager'], time: '09:12 – 09:26', cost: '14 分钟',
    steps: [
      ['解析业务诉求', '识别 4 类角色（采购员、部门主管、采购经理、供应商）与 6 个核心场景'],
      ['梳理单据与业务规则', '明确表头 18 个字段、明细分录 14 个字段，价税合计 = Σ(数量 × 含税单价)'],
      ['编写验收标准', '整理 5 个功能点、12 条可验证的验收标准，经你确认后冻结范围']
    ],
    summary: '需求范围已确认：单据录入、金额计算、两级审批、供应商同步、执行情况报表。',
    outputs: [['doc', '需求规格说明书', 'PRD.md'], ['doc', '验收标准清单', 'Acceptance.md']]
  },
  design: {
    owners: ['software-team-lead', 'cosmic-form', 'cosmic-workflow'], time: '09:26 – 09:48', cost: '22 分钟',
    steps: [
      ['设计单据模型', '采购订单 pm_purorder：表头 + 明细分录，复用基础资料供应商、物料、计量单位'],
      ['设计审批流程', '草稿 → 提交 → 部门主管审批 → 采购经理审批（金额 ≥ 50 万加签财务）→ 已审核'],
      ['约定扩展点与接口', '金额计算与提交校验放在表单插件；审核后通过开放接口推送供应商协同平台']
    ],
    summary: '技术方案采用「苍穹元数据 + 表单插件 + 工作流」组合，无需改动标准产品。',
    outputs: [['doc', '技术方案', 'TechSpec.md'], ['doc', '数据模型设计', 'DataModel.md'], ['flow', '审批流程图', 'ApprovalFlow.bpmn']]
  },
  planning: {
    owners: ['software-team-lead'], time: '09:48 – 09:55', cost: '7 分钟',
    steps: [
      ['拆解开发任务', '按表单、流程、插件、接口、报表拆成 5 个开发任务'],
      ['排定依赖与分工', '表单模型先行；插件与流程依赖表单；接口与报表可在表单完成后并行']
    ],
    summary: '5 个开发任务已分派给对应专家，关键路径为 表单 → 插件 → 接口。',
    outputs: [['doc', '实现计划', 'ImplPlan.md']]
  },
  implementation: {
    owners: ['cosmic-form', 'cosmic-plugin', 'cosmic-workflow', 'cosmic-api', 'cosmic-report'], time: '09:55 – 10:42', cost: '47 分钟',
    tasks: [
      ['cosmic-form', '采购订单表单与列表', '生成单据元数据 32 个字段、编辑页与列表页，配置单据编码规则 PO-YYYYMMDD-####', 'PurOrderBill.dym'],
      ['cosmic-plugin', '金额计算与提交校验插件', '明细行数量/单价变更实时重算价税合计；提交前校验供应商状态与交货日期', 'PurOrderEditPlugin.java'],
      ['cosmic-workflow', '两级审批流程', '配置部门主管、采购经理审批节点与 50 万金额加签条件，驳回回到提交人', 'PurOrderApprove.bpmn'],
      ['cosmic-api', '供应商协同同步接口', '审核后调用供应商协同 OpenAPI 推送订单，失败自动重试 3 次并记录日志', 'PurOrderSyncService.java'],
      ['cosmic-report', '采购订单执行情况报表', '按供应商、物料统计订单数量、已入库数量与执行率，支持导出 Excel', 'PurOrderExecRpt.rpt']
    ],
    summary: '5 个开发任务全部完成，自测通过：单元测试 18/18 通过，静态检查 0 错误，已部署到苍穹测试环境。',
    outputs: [['code', '表单插件源码', 'PurOrderEditPlugin.java'], ['code', '同步接口源码', 'PurOrderSyncService.java'], ['test', '单元测试报告', '18/18 通过']]
  }
};
/* 演示停在编码实现完成：之前的阶段完成，之后的阶段待开始 */
var DONE_UNTIL = 'implementation';

var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
var ICON_FILE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
var ICON_CODE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>';
var ICON_FLOW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M9 6h4a2 2 0 0 1 2 2v7"/></svg>';
var ICON_TEST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/></svg>';
var ICON_CHEVRON = '<svg viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var OUTPUT_ICONS = { doc: ICON_FILE, code: ICON_CODE, flow: ICON_FLOW, test: ICON_TEST };

function expertName(id) { return EX[id] ? EX[id].name : id; }
function avatar(id) { return EX[id] ? '<img src="' + xav(EX[id].k) + '" alt="">' : ''; }
function stageState(index) {
  var doneIdx = STAGES.findIndex(function (s) { return s.id === DONE_UNTIL; });
  return index <= doneIdx ? 'done' : (index === doneIdx + 1 ? 'next' : 'todo');
}

function renderTeamNote(team) {
  return '<div class="ts-team">'
    + '<span class="ts-team-av">' + team.members.slice(0, 4).map(avatar).join('') + '</span>'
    + '<span class="ts-team-b">已交给 <b>' + xesc(team.name) + '</b> 执行'
    + '<i>' + team.members.length + ' 位专家 · 由' + xesc(expertName(team.leadId)) + '统筹，按专家团流程逐阶段推进</i></span>'
    + '</div>';
}

function renderProgress() {
  return '<div class="ts-progress">' + STAGES.map(function (s, i) {
    var st = stageState(i);
    var label = st === 'done' ? '已完成' : (st === 'next' ? '待确认' : '待开始');
    return '<div class="ts-progress-item is-' + st + '">'
      + '<span class="ts-progress-dot">' + (st === 'done' ? ICON_CHECK : i + 1) + '</span>'
      + '<span class="ts-progress-name">' + xesc(s.name) + '</span>'
      + '<span class="ts-progress-state">' + label + '</span></div>';
  }).join('') + '</div>';
}

function renderOutputs(outputs) {
  return '<div class="ts-outputs">' + outputs.map(function (o) {
    return '<span class="ts-output" data-ts-output="' + xesc(o[1]) + '"><span class="ts-output-ic is-' + o[0] + '">' + OUTPUT_ICONS[o[0]] + '</span>'
      + '<span class="ts-output-name">' + xesc(o[1]) + '</span><span class="ts-output-meta">' + xesc(o[2]) + '</span></span>';
  }).join('') + '</div>';
}

function renderStage(stage, index) {
  var run = STAGE_RUNS[stage.id];
  var body = run.tasks
    ? '<div class="ts-tasks">' + run.tasks.map(function (t) {
      return '<div class="ts-task"><span class="ts-task-check">' + ICON_CHECK + '</span>'
        + '<div class="ts-task-main"><div class="ts-task-head"><strong>' + xesc(t[1]) + '</strong>'
        + '<span class="ts-task-owner">' + avatar(t[0]) + xesc(expertName(t[0])) + '</span></div>'
        + '<p>' + xesc(t[2]) + '</p><code>' + xesc(t[3]) + '</code></div></div>';
    }).join('') + '</div>'
    : '<ol class="ts-steps">' + run.steps.map(function (s) {
      return '<li><span class="ts-step-check">' + ICON_CHECK + '</span><div><strong>' + xesc(s[0]) + '</strong><p>' + xesc(s[1]) + '</p></div></li>';
    }).join('') + '</ol>';
  /* 最近完成的阶段默认展开，其余收起 */
  var open = stage.id === DONE_UNTIL;
  return '<section class="ts-stage' + (open ? ' is-open' : '') + '">'
    + '<button type="button" class="ts-stage-head" aria-expanded="' + open + '">'
    + '<span class="ts-stage-no">' + ICON_CHECK + '</span>'
    + '<span class="ts-stage-title"><b>阶段 ' + (index + 1) + ' · ' + xesc(stage.name) + '</b><i>' + xesc(stage.desc) + '</i></span>'
    + '<span class="ts-stage-owners">' + run.owners.slice(0, 3).map(avatar).join('') + '</span>'
    + '<span class="ts-stage-time">' + xesc(run.cost) + '</span>'
    + '<span class="ts-stage-chev">' + ICON_CHEVRON + '</span></button>'
    + '<div class="ts-stage-body">'
    + '<div class="ts-stage-meta">' + run.owners.map(function (id) { return '<span>' + avatar(id) + xesc(expertName(id)) + '</span>'; }).join('')
    + '<em>' + xesc(run.time) + '</em></div>'
    + body
    + '<p class="ts-stage-summary">' + xesc(run.summary) + '</p>'
    + renderOutputs(run.outputs)
    + '</div></section>';
}

function renderHandoff() {
  var nextIdx = STAGES.findIndex(function (s) { return s.id === DONE_UNTIL; }) + 1;
  var next = STAGES[nextIdx];
  return '<div class="ts-handoff">'
    + '<div class="ts-handoff-b"><b>编码实现已完成，等待进入「' + xesc(next.name) + '」</b></div>'
    + '<div class="ts-handoff-actions">'
    + '<button type="button" class="ts-btn ts-btn--primary" data-ts-action="verify">提交测试</button>'
    + '</div></div>';
}

function openTeamSession() {
  var team = PRESET_TEAMS.find(function (t) { return t.id === TEAM_ID; });
  if (!team) return;
  showView('chat');
  navItems.forEach(function (n) { n.classList.remove('active'); });
  $('#chatTitle').textContent = SESSION_TITLE;
  $('#chatTitle').classList.remove('is-task');
  var empty = $('#chatEmpty');
  if (empty) empty.remove();
  messagesList.innerHTML = '';

  var user = document.createElement('div');
  user.className = 'message user';
  user.innerHTML = '<div class="message-content"><p>' + xesc(USER_PROMPT) + '</p></div>';
  messagesList.appendChild(user);

  var reply = document.createElement('div');
  reply.className = 'message assistant';
  reply.innerHTML = '<div class="message-content"><div class="assistant-response ts-session">'
    + renderTeamNote(team)
    + renderProgress()
    + STAGES.filter(function (s) { return STAGE_RUNS[s.id]; }).map(renderStage).join('')
    + '<div class="ts-result"></div>'
    + renderHandoff()
    + '</div></div>';
  messagesList.appendChild(reply);
  /* 编码实现产出的单据可直接预览 */
  var artifact = createArtifactCard();
  reply.querySelector('.ts-result').appendChild(artifact);

  selectChatApp('采购订单管理');
  chatAppDd.classList.add('disabled');
  /* 选中苍穹应用开发专家团 */
  set_activePick({kind:'team', id:TEAM_ID, auto:false});
  renderExpertChips();
  scrollChatBottom();
}

export function initTeamSession() {
  $$('.sub-item[data-session="cosmic-po-team"]').forEach(function (item) {
    item.addEventListener('click', function (e) {
      if (e.target.closest('.sub-more')) return;
      openTeamSession();
    });
  });
  messagesList.addEventListener('click', function (e) {
    var head = e.target.closest('.ts-stage-head');
    if (head) {
      var stage = head.closest('.ts-stage');
      var open = !stage.classList.contains('is-open');
      stage.classList.toggle('is-open', open);
      head.setAttribute('aria-expanded', open);
      return;
    }
    var output = e.target.closest('[data-ts-output]');
    if (output) { toast('原型演示：打开「' + output.getAttribute('data-ts-output') + '」'); return; }
    var action = e.target.closest('[data-ts-action]');
    if (!action) return;
    if (action.getAttribute('data-ts-action') === 'verify') toast('原型演示：已提交测试，等待软件测试工程师认领');
  });
}
