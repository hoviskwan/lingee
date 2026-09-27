import { CV_TASKS, CV_PROJECTS, CV_ARTIFACTS, cvCurrentUserName, cvInProject, cvProject, cvProjectInWorkspace, cvProjectName, cvSeedTaskDetails, cvPeopleInProject } from './data.js';
import { TEAMS } from '../expert/store.js';
import { STAGES, xesc } from '../expert/data.js';
import { cvSetProject, cvUpdateCounts } from './projects.js';
import { tbBoardColumns, tbColumns, tbCurrentTeamId, tbIsStarted, tbLabel, tbMode, tbOwner, tbPriority, tbTaskId, tbGetSelected, tbSave, tbSetSelected, tbTeamName, tbTeamStages, tbMatchedTeam } from './tb-core.js';
import { ensureTaskRuntime, retryTaskRuntime, runtimeArtifacts, syncTaskFromRuntime } from './runtime.js';
/* 任务看板：列渲染、任务详情（打开/保存）、筛选与初始化
   共享状态与工具在 tb-core；新建任务在 new-task；任务对话在 task-chat。 */


let scope = 'all';
let returnFocus = null;

function filtered() {
  const searchInput = document.getElementById('tb-search');
  const search = (searchInput?.value || '').trim().toLowerCase();
  const focusedTaskId = searchInput?.dataset.focusTaskId;
  const execution = document.getElementById('tb-mode')?.value;
  return CV_TASKS.filter(t => t.kind !== 'epic').filter(cvInProject).filter(t =>
    (scope !== 'mine' || t.assignee === currentUserName()) &&
    (scope !== 'attention' || ['审核中', '已阻塞'].includes(t.status)) &&
    (!execution || tbMode(t) === execution) &&
    (!focusedTaskId || t.boardId === focusedTaskId) &&
    (!search || (t.title + ' ' + t.sourceId).toLowerCase().includes(search)));
}
export function renderTaskSummary() {
  const el = document.getElementById('cv-task-stats');
  if (!el) return;
  const rows = CV_TASKS.filter(t => t.kind !== 'epic').filter(cvInProject);
  el.innerHTML = '<span><b>' + rows.length + '</b> 个任务</span><span class="tb-live">◐ ' + rows.filter(t => t.status === '进行中').length + ' 个任务执行中</span><span class="tb-summary-note">成员与专家共同参与 · 本地演示</span>';
  document.getElementById('tb-attention-count').textContent = rows.filter(t => ['审核中', '已阻塞'].includes(t.status)).length;
  const mine = document.getElementById('tb-mine-count');
  if (mine) mine.textContent = rows.filter(t => t.assignee === currentUserName()).length;
}
function card(t) {
  const index = CV_TASKS.indexOf(t);
  const runtimeState = t.runtime ? ({ ready: '已规划', running: '运行中', failed: '需介入', completed: '待验收' }[t.runtime.status] || '') : '';
  const projLine = cvProjectName(t.project) + " · " + tbTeamName(t) + (runtimeState ? " · " + runtimeState : '');
  const actBtns = '<button type="button" class="tb-quick" data-tb-handoff="' + index + '">转交</button>';
  /* 待办卡片右上角用"开始执行"按钮代替类型标签 */
  const execBtnHtml = '<button type="button" class="tb-exec-btn" data-tb-exec="' + index + '" title="开始执行任务" aria-label="开始执行任务" style="margin-left:auto"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 9-14 9V3z"/></svg></button>';
  if (index < 3) console.log('[tb-card #'+index+'] status='+t.status+' title='+t.title);
  const topRight = t.status === '待办'
    ? execBtnHtml
    : '<span class="tb-type">' + xesc(t.type) + '</span>' + (t.status === '待办' ? '' : '');
  return ("<div class=\"tb-card\" data-tb-task=\"" + (index) + "\" role=\"button\" tabindex=\"0\">"
    + "<span class=\"tb-card-top\"><span>" + (xesc(t.sourceId)) + "</span>" + topRight + "</span>"
    + "<strong title=\"" + (xesc(t.title)) + "\">" + (xesc(t.title)) + "</strong>"
    + "<span class=\"tb-description\" title=\"" + (xesc(t.desc)) + "\">" + (xesc(t.desc)) + "</span>"
    + "<span class=\"tb-project\" title=\"" + (xesc(projLine)) + "\">" + (xesc(projLine)) + "</span>"
    + "<span class=\"tb-card-bottom\"><span class=\"tb-person\"><i>" + xesc((t.assignee || '待')[0]) + "</i>" + (xesc(tbOwner(t))) + "</span><span class=\"tb-priority\" data-priority=\"" + (xesc(tbPriority(t))) + "\">≋ " + (xesc(tbPriority(t))) + "</span></span>"
    + "<span class=\"tb-context\">" + (xesc(tbMode(t))) + "<span>" + (t.status === '审核中' ? '等待人工确认' : t.status === '已阻塞' ? '需要介入' : t.status === '进行中' ? '执行中 · ' + (t.progress || 0) + '%' : xesc(tbLabel(t.status))) + "</span></span>"
    + "<span class=\"tb-card-acts\">" + actBtns + "</span></div>");
}
function tbQuickAssign(index) {
  const t = CV_TASKS[index]; if (!t) return;
  tbSetSelected(t);
  window.tbOpenTransfer && window.tbOpenTransfer({ title: '分配任务', action: 'assign', reopen: false });
}
function tbQuickTransfer(index) {
  const t = CV_TASKS[index]; if (!t) return;
  tbSetSelected(t);
  window.tbOpenTransfer && window.tbOpenTransfer({ title: '转交任务', action: 'transfer', reopen: false });
}
export function renderTaskBoard() {
  const grid = document.getElementById('cv-task-grid');
  if (!grid || !document.getElementById('tb-layout')) return;
  const rows = filtered();
  const list = document.getElementById('tb-layout').value === 'list';
  grid.className = list ? 'tb-board tb-list' : 'tb-board';
  grid.innerHTML = tbBoardColumns.map(([status, title, tone, symbol]) => {
    const tasks = rows.filter(t => t.status === status);
    return ("<section class=\"tb-column tb-" + (tone) + "\"><header><span class=\"tb-column-title\" data-tb-fold role=\"button\" tabindex=\"0\" title=\"点击折叠/展开\"><svg class=\"tb-fold-caret\" viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m5 7.5 5 5 5-5\"/></svg><i>" + (symbol) + "</i>" + (title) + "<small>" + (tasks.length) + "</small></span><button data-tb-add=\"" + (status) + "\" aria-label=\"在" + (title) + "中新建任务\">＋</button></header><div class=\"tb-cards\">" + (tasks.map(card).join('') || '<div class="tb-column-empty">暂无任务</div>') + "</div></section>");
  }).join('');
  document.getElementById('tb-empty').hidden = rows.length > 0;
  grid.hidden = rows.length === 0;
  renderTaskSummary();
}
function options(values, current) { return values.map(v => ("<option value=\"" + (xesc(v)) + "\" " + (v === current ? 'selected' : '') + ">" + (xesc(v)) + "</option>")).join(''); }
function artifactLink(a) {
  return '<button type="button" data-task-artifact="' + xesc(a.key) + '"><span>▤</span><span class="tb-artifact-name"><strong>' + xesc(a.name) + '</strong><small>' + xesc(a.version || '当前版本') + '</small></span><span>预览 ↗</span></button>';
}
function previewTaskArtifact(key) {
  const t = tbGetSelected();
  const a = t && taskArtifacts(t).find(item => item.key === key);
  if (!a) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'tb-artifact-preview';
  dialog.innerHTML = '<header><div><h3>' + xesc(a.name) + '</h3><span>' + xesc(t.title) + ' · ' + xesc(a.version || '当前版本') + '</span></div><button type="button" aria-label="关闭产物预览">×</button></header><div class="tb-preview-body"></div>';
  const body = dialog.querySelector('.tb-preview-body');
  if (typeof a.content === 'string') {
    const pre = document.createElement('pre'); pre.textContent = a.content; body.appendChild(pre);
  } else if (/^(https?:\/\/|blob:|\/[^/]|\.\.?\/)/i.test(a.url || '')) {
    const frame = document.createElement('iframe'); frame.title = a.name; frame.setAttribute('sandbox', ''); frame.src = a.url; body.appendChild(frame);
  } else {
    body.innerHTML = '<div class="tb-detail-empty"><strong>暂未提供文件内容</strong><span>该产物目前只记录了名称，关联文件后即可预览正文。</span></div>';
  }
  document.body.appendChild(dialog);
  const trigger = document.activeElement;
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { dialog.remove(); trigger?.focus(); });
  dialog.showModal();
}
function taskStageId(t) { return t.stage || stagePlanFor(t)[0]?.id; }
function stageLabel(id) { return (stagePlanFor(tbGetSelected() || {}).find(s => s.id === id) || STAGES.find(s => s.id === id) || {}).name || '未设置'; }
function nextStageId(t) {
  const plan = stagePlanFor(t);
  const i = plan.findIndex(s => s.id === taskStageId(t));
  return i >= 0 ? plan[i + 1]?.id : null;
}
function currentUserName() { return document.getElementById('userName')?.textContent?.trim() || '当前用户'; }
function nowStr() { return new Date().toLocaleString('zh-CN', { hour12: false }); }
function reviewArtifact(a, index) {
  return { id: String(a.id || a.name || 'artifact-' + index), name: String(a.name || a.file || a || '未命名产物'), version: String(a.version || '当前版本') };
}
function taskArtifacts(t) {
  runtimeArtifacts(t);
  const normalize = a => typeof a === 'string' ? { name: a } : a;
  const direct = (t.artifacts || []).map(normalize);
  const stage = (t.stagePlan || []).flatMap(sp => (sp.artifacts || []).map(a => ({ ...normalize(a), stageId: sp.id })));
  const reviewed = (t.reviews || []).flatMap(r => (r.artifacts || []).map(a => ({ ...normalize(a), stageId: r.stageId })));
  const linked = CV_ARTIFACTS.filter(a => a.project === t.project && a.src === t.title).map(a => ({ ...a, centerName: a.name, name: a.file || a.name, version: a.date }));
  const result = new Map();
  [...reviewed, ...stage, ...direct, ...linked].forEach(a => {
    const key = (a.name || a.file) + ':' + (a.version || '当前版本');
    result.set(key, { ...result.get(key), ...a, key });
  });
  return [...result.values()];
}
function artifactsForStage(t, sp) {
  return taskArtifacts(t).filter(a => a.stageId === sp.id || (!a.stageId && a.workItemId === sp.id));
}
/* 当前环节产出的产物：全部产物里排除已经在之前环节评审过的，剩下的就是这个环节新产出的——
   评审不是从全量产物里挑一个，而是审这一环节实际产出的全部。 */
function stageArtifactsForReview(t) {
  const reviewed = new Set((t.reviews || []).flatMap(r => (r.artifacts || []).map(a => a.name)));
  return artifactsForStage(t, { id: taskStageId(t) }).map(reviewArtifact).filter(a => !reviewed.has(a.name));
}
function hasApprovedDelivery(t) {
  const last = stagePlanFor(t).at(-1);
  const latest = (t.reviews || []).slice().reverse().find(r => r.stageId === last.id || r.type === '交付评审');
  return latest?.status === 'approved';
}
function canDecideReview(r) { return document.body.dataset.role === 'owner' || r.reviewer === currentUserName(); }
function reviewStatus(status) {
  return status === 'approved' ? ['已通过', 'approved'] : status === 'changes_requested' ? ['要求修改', 'changes'] : ['待决策', 'pending'];
}
function reviewScopeHtml(r) {
  if (r.artifacts?.length) return '<div class="tb-review-scope">' + r.artifacts.map(a => '<span><b>' + xesc(a.name) + '</b><small>' + xesc(a.version) + '</small></span>').join('') + '</div>';
  return '<div class="tb-review-snapshot"><strong>任务说明与验收标准</strong><div><small>任务描述</small><p>' + xesc(r.subject?.desc || '未填写') + '</p></div><div><small>验收标准</small><p>' + xesc(r.subject?.acceptance || '未填写') + '</p></div></div>';
}
function reviewCardHtml(r, current) {
  const state = reviewStatus(r.status);
  const decisions = (r.decisions || []).map(d => '<div class="tb-review-decision"><i>' + xesc((d.by || '评')[0]) + '</i><div><strong>' + xesc(d.by) + ' · ' + (d.action === 'approve' ? '通过' : '要求修改') + '</strong>' + (d.comment ? '<p>' + xesc(d.comment) + '</p>' : '') + '<small>' + xesc(d.at || '') + '</small></div></div>').join('');
  const reviewerTag = r.reviewer === currentUserName() ? '（本人）' : '';
  return '<article class="tb-review-card' + (current ? ' is-current' : '') + '"><header><div><span class="tb-review-state" data-state="' + state[1] + '">' + state[0] + '</span><strong>' + xesc(r.type) + ' · 第 ' + r.round + ' 轮</strong></div><small>' + xesc(r.createdAt || '') + '</small></header><dl><div><dt>评审人</dt><dd>' + xesc(r.reviewer) + reviewerTag + '</dd></div></dl>' + reviewScopeHtml(r) + (decisions ? '<div class="tb-review-decisions">' + decisions + '</div>' : '') + '</article>';
}
/* 阶段流程：清楚展示每个环节的负责人、当前状态与该环节产出的产物；
   待评审的环节直接在节点内查看产物并发起 / 处理评审，不用再跳到单独的评审 tab。 */
function stagePlanFor(t) {
  if (t.stagePlan?.length) return t.stagePlan;
  if (t.runtime?.workItems?.length) return t.runtime.workItems.map(w => ({ id: w.id, name: w.title, assignee: t.assignee }));
  return tbTeamStages(tbMatchedTeam(t)).map(s => ({ id: s.id, name: s.name, assignee: t.assignee }));
}
function stageArtifactsHtml(latest, state) {
  if (latest?.artifacts?.length) return '<div class="tb-stage-artifacts">' + latest.artifacts.map(a => '<span>' + xesc(a.name) + '</span>').join('') + '</div>';
  return state === 'upcoming' ? '' : '<div class="tb-stage-artifacts tb-stage-artifacts--empty">暂无产物</div>';
}
function stageDecisionHtml(latest) {
  const decisions = (latest?.decisions || []).map(d => '<div class="tb-review-decision"><i>' + xesc((d.by || '评')[0]) + '</i><div><strong>' + xesc(d.by) + ' · ' + (d.action === 'approve' ? '通过' : '要求修改') + '</strong>' + (d.comment ? '<p>' + xesc(d.comment) + '</p>' : '') + '<small>' + xesc(d.at || '') + '</small></div></div>').join('');
  return decisions ? '<div class="tb-review-decisions">' + decisions + '</div>' : '';
}
function stageReviewStartHtml(t, stg) {
  const artifacts = stageArtifactsForReview(t);
  const artifactList = artifacts.length ? '<div class="tb-review-scope-k">本环节产出的产物</div><div class="tb-review-scope">' + artifacts.map(a => '<span><b>' + xesc(a.name) + '</b><small>' + xesc(a.version) + '</small></span>').join('') + '</div>' : '<div class="tb-review-no-artifact">当前环节还没有产出新的产物，可先在任务对话中推进执行。</div>';
  return '<div class="tb-review-start"><p>评审「' + xesc(stg) + '」环节产出的产物，通过后提交 Git 并流转到下一个环节。</p>' + artifactList + (artifacts.length ? '<button type="button" class="tb-primary tb-review-start-btn" data-review-start>发起评审</button>' : '') + '</div>';
}
function stageReviewPendingHtml(pending) {
  const allowed = canDecideReview(pending);
  return reviewCardHtml(pending, true) + '<div class="tb-review-action">' + (allowed ? '<label>评审意见<textarea id="tb-review-comment" rows="3" placeholder="说明通过依据，或指出需要修改的内容"></textarea></label><div><button type="button" data-review-decision="changes">要求修改</button><button type="button" class="tb-primary" data-review-decision="approve">通过并提交 Git</button></div><p class="tb-review-note">通过后提交代码到 Git，并流转到下一个环节。</p>' : '<p>等待 ' + xesc(pending.reviewer) + ' 给出评审结论。</p>') + '</div>';
}
/* 兼容旧数据：评审的 stageId 可能是本地缓存里的老值（不在当前阶段计划里），
   这种情况一律归到「当前环节」，避免评审卡片在流程图里找不到归属节点而消失。 */
function reviewStageId(t, r, plan) { return plan.some(s => s.id === r.stageId) ? r.stageId : taskStageId(t); }
/* 阶段隔离：只有该阶段的处理人能看到评审详情与产物；自己处理完的阶段仍保留只读可见，
   跟自己无关的阶段（不是处理人，也没参与过评审）一律折叠成一行占位。 */
function canSeeStageDetail(t, sp, plan) {
  if (document.body.dataset.role === 'owner') return true;
  const me = currentUserName();
  if (sp.assignee === me) return true;
  const stageReviews = (t.reviews || []).filter(r => reviewStageId(t, r, plan) === sp.id);
  return stageReviews.some(r => r.reviewer === me || (r.decisions || []).some(d => d.by === me));
}
function stageTimelineHtml(t) {
  const plan = stagePlanFor(t);
  const curIdx = plan.findIndex(s => s.id === taskStageId(t));
  const reviews = t.reviews || [];
  const pending = reviews.slice().reverse().find(r => r.status === 'pending');
  const pendingStageId = pending ? reviewStageId(t, pending, plan) : null;
  return '<div class="tb-stage-timeline">' + plan.map((sp, i) => {
    const stageReviews = reviews.filter(r => reviewStageId(t, r, plan) === sp.id);
    const latest = stageReviews[stageReviews.length - 1];
    const wi = t.runtime?.workItems?.find(w => w.stageId === sp.id || w.id === sp.id);
    const state = t.status === '已完成' || wi?.status === 'completed' || latest?.status === 'approved' ? 'done' : (wi?.status === 'running' || (i === curIdx && !['待办','待规划','已取消'].includes(t.status))) ? 'current' : 'upcoming';
    const stateLabel = state === 'done' ? '已完成' : state === 'current' ? (latest?.status === 'pending' ? '待评审' : latest?.status === 'changes_requested' ? '要求修改' : '进行中') : '未开始';
    const canSee = canSeeStageDetail(t, sp, plan);
    let body;
    if (state === 'upcoming') body = '';
    else if (!canSee) body = '<div class="tb-stage-restricted"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>仅「' + xesc(sp.assignee || '处理人') + '」可见该阶段的评审详情与产物</div>';
    else if (state === 'current' && pending && pendingStageId === sp.id) body = stageReviewPendingHtml(pending);
    else if (state === 'current' && !pending && t.status !== '已完成') body = stageReviewStartHtml(t, sp.name);
    else body = stageArtifactsHtml(latest, state) + stageDecisionHtml(latest);
    const outputs = artifactsForStage(t, sp);
    const artifactBody = '<div class="tb-artifacts">' + (outputs.map(artifactLink).join('') || '<div class="tb-detail-empty">该节点暂无产物</div>') + '</div>';
    return '<details class="tb-stage-step tb-stage-collapse" data-state="' + state + '"><summary>'
      + '<span class="tb-stage-dot">' + (state === 'done' ? '✓' : (i + 1)) + '</span>'
      + '<span class="tb-stage-body"><span class="tb-stage-top"><b>' + xesc(sp.name) + '</b><span class="tb-stage-state">' + stateLabel + '</span></span>'
      + '<span class="tb-stage-owner">处理人 · ' + xesc(sp.assignee || t.assignee) + ' · ' + outputs.length + ' 项产物</span></span><span class="tb-stage-chevron">›</span></summary>'
      + '<div class="tb-stage-expanded">' + (artifactBody + (canSee ? (state === 'current' ? body : stageDecisionHtml(latest)) : body || '')) + '</div></details>';
  }).join('') + '</div>';
}
function stageOwnerOf(t) { return (stagePlanFor(t).find(s => s.id === taskStageId(t)) || {}).assignee || t.assignee; }
/* 当前环节条：放在 tab 之上，切到任何 tab 都能看到自己是不是当前处理人；是本人时可直接进对话处理。 */
function stageStatusBarHtml(t) {
  const pending = (t.reviews || []).slice().reverse().find(r => r.status === 'pending');
  const curOwner = stageOwnerOf(t);
  const mine = curOwner === currentUserName();
  return '<div class="tb-review-status-banner"><span class="tb-review-status-k">当前环节</span><b>' + xesc(stageLabel(taskStageId(t))) + '</b><span class="tb-review-status-k">处理人</span><b>' + xesc(curOwner) + (mine ? '<em>本人</em>' : '') + '</b><span class="tb-review-status-k">状态</span><b>' + xesc(pending ? '审核中' : (t.status === '已完成' ? '已完成' : tbLabel(t.status))) + '</b>'
    + (mine && t.status !== '已完成' ? '<button type="button" class="tb-stage-handle" data-detail-jump="conversations">立即处理 ↗</button>' : '')
    + '</div>';
}
function activityPaneHtml(t) {
  const closedBanner = t.status === '已完成' ? '<div class="tb-review-closed"><i>✓</i><div><strong>任务已完成</strong><p>展开流程节点回看交付产物与评审记录。</p></div></div>' : '';
  return closedBanner + stageTimelineHtml(t);
}
/* 日志 tab：任务全生命周期的流转记录——字段修改、状态流转、转交、评审发起与结论都在这里，独立于按阶段查看的「动态」。 */
function logPaneHtml(t) {
  const rows = (t.activity || []).slice().reverse();
  if (!rows.length) return '<div class="tb-detail-empty">暂无流转记录</div>';
  return '<div class="tb-activity">' + rows.map(a => '<p><i>' + xesc((a.author || '系')[0]) + '</i><b>' + xesc(a.author || '系统') + '</b><span>' + xesc(a.text) + '</span>' + (a.time ? '<small>' + xesc(a.time) + '</small>' : '<small></small>') + '</p>').join('') + '</div>';
}
let formSnapshot = '';
function detailSnapshot() { return JSON.stringify([...new FormData(document.getElementById('tb-form'))]); }
function confirmLeave() { return document.getElementById('tb-workspace').hidden || detailSnapshot() === formSnapshot || window.confirm('有尚未保存的修改，确定放弃这些修改吗？'); }
function selectDetailTab(name) {
  const ws = document.getElementById('tb-workspace');
  ws.querySelectorAll('[data-detail-tab]').forEach(b => {
    const active = b.dataset.detailTab === name;
    b.setAttribute('aria-selected', String(active)); b.tabIndex = active ? 0 : -1;
  });
  ws.querySelectorAll('[data-detail-pane]').forEach(p => p.hidden = p.dataset.detailPane !== name);
}
function reopenTaskTab(t, tab) {
  renderTaskBoard(); cvUpdateCounts(); openTask(CV_TASKS.indexOf(t)); selectDetailTab(tab);
}
function startTaskReview() {
  const t = tbGetSelected(); if (!t) return;
  if (detailSnapshot() !== formSnapshot) { window.alert('请先保存任务修改，再发起评审。'); return; }
  if (t.status === '已完成') { window.alert('已完成任务如需继续，请先将状态改为“进行中”并保存。'); return; }
  if ((t.reviews || []).some(r => r.status === 'pending')) { window.alert('当前已有一轮评审等待处理。'); return; }
  const stg = stageLabel(taskStageId(t));
  const artifacts = stageArtifactsForReview(t);
  if (!artifacts.length) { window.alert('当前环节还没有产出新的产物，暂时无法发起评审。'); return; }
  t.reviews ||= [];
  const stageOwner = (stagePlanFor(t).find(s => s.id === taskStageId(t)) || {}).assignee;
  const reviewer = stageOwner && stageOwner !== '待分配' ? stageOwner : currentUserName();
  const round = t.reviews.filter(r => r.stageId === taskStageId(t)).length + 1;
  t.reviews.push({ id: crypto.randomUUID(), stageId: taskStageId(t), type: stg + '评审', round, status: 'pending', reviewer, requestedBy: currentUserName(), createdAt: new Date().toLocaleString('zh-CN', { hour12: false }), artifacts, subject: { title: t.title, desc: t.desc || '', acceptance: t.acceptance || '' }, decisions: [] });
  t.status = '审核中';
  t.activity ||= []; t.activity.push({ author: currentUserName(), text: '发起「' + stg + '」环节评审，由 ' + reviewer + (reviewer === currentUserName() ? '（本人）' : '') + ' 评审', time: nowStr() });
  tbSave(); reopenTaskTab(t, 'activity');
}
function decideTaskReview(action) {
  const t = tbGetSelected(); if (!t) return;
  if (detailSnapshot() !== formSnapshot) { window.alert('请先保存任务修改，再处理评审。'); return; }
  const review = (t.reviews || []).slice().reverse().find(r => r.status === 'pending');
  if (!review || !canDecideReview(review)) return;
  const comment = (document.getElementById('tb-review-comment')?.value || '').trim();
  if (action === 'changes' && !comment) { window.alert('请说明需要修改的内容。'); return; }
  review.status = action === 'approve' ? 'approved' : 'changes_requested';
  review.decidedAt = new Date().toLocaleString('zh-CN', { hour12: false });
  review.decisions ||= []; review.decisions.push({ by: currentUserName(), action, comment, at: review.decidedAt });
  t.activity ||= [];
  if (action === 'approve') {
    const next = nextStageId(t);
    const commit = 'git-' + Date.now().toString(36).slice(-6);
    if (next) {
      t.stage = next;
      t.status = '进行中';
      const nextOwner = (stagePlanFor(t).find(s => s.id === next) || {}).assignee;
      let advanceNote = review.type + '通过，已提交 Git（' + commit + '），流转到「' + stageLabel(next) + '」环节';
      if (nextOwner && nextOwner !== t.assignee) { t.assignee = nextOwner; advanceNote += '，负责人变更为 ' + nextOwner; }
      t.activity.push({ author: currentUserName(), text: advanceNote, time: nowStr() });
    } else {
      t.status = '已完成';
      t.progress = 100;
      t.activity.push({ author: currentUserName(), text: review.type + '通过，已提交 Git（' + commit + '），任务完成交付', time: nowStr() });
    }
  } else {
    t.status = '进行中';
    t.activity.push({ author: currentUserName(), text: review.type + '要求修改：' + comment, time: nowStr() });
  }
  tbSave(); reopenTaskTab(t, 'activity');
}
export function openTask(index, status = '待办') {
  const selected = index === null ? null : CV_TASKS[index];
  if(selected&&!cvProjectInWorkspace(selected.project))return;
  tbSetSelected(selected);
  const project = CV_PROJECTS.find(p => p.id === cvProject && cvProjectInWorkspace(p.id)) || CV_PROJECTS.find(p=>cvProjectInWorkspace(p.id));
  if(!project)return;
  const t = selected || { title: '', desc: '', status, assignee: cvPeopleInProject(project)[0]?.name || '', priority: '中', project: project.id, type: '需求', mode: '多人协作' };
  const assigneeOptions = [...new Set([...cvPeopleInProject(CV_PROJECTS.find(p => p.id === t.project)).map(person => person.name), t.assignee].filter(Boolean))];
  const selectedTeamId = tbCurrentTeamId(CV_PROJECTS.find(p => p.id === t.project)?.defaultTeam);
  const selectedTeam = TEAMS.find(team => team.id === selectedTeamId);
  const canSee = selected && window.tbCanSeeConv ? window.tbCanSeeConv(selected) : false;
  const convArea = !selected ? '<div class="tb-detail-empty">创建任务后，就可以在这里发起会话。</div>'
    : canSee ? window.tbConvListHtml(selected) : '<div class="tb-detail-empty"><strong>会话仅处理人可见</strong><span>请联系当前负责人，或转交给自己后继续协作。</span></div>';
  const artifacts = taskArtifacts(t);
  const reviews = t.reviews || [];
  const pendingReview = reviews.find(r => r.status === 'pending');
  const canComplete = t.status === '已完成' || hasApprovedDelivery(t);
  const col = tbColumns.find(c => c[0] === t.status) || tbBoardColumns[0];
  const hints = {
    '待规划': ['已搁置', '还未排入计划，编辑目标与验收标准后可移入待办。'],
    '待办': ['准备开始', '明确任务目标与验收标准，确认负责人后发起会话。'],
    '进行中': ['正在推进', '通过任务对话同步进展，在交付产物中查看输出。'],
    '审核中': ['等待确认', '核对交付内容与验收标准，再决定下一步。'],
    '已完成': ['任务已标记完成', '可回看交付产物与任务动态。'],
    '已阻塞': ['需要介入', '在任务对话中确认阻塞原因，必要时转交负责人。'],
    '已取消': ['已取消', '决定不做，可回看历史记录。'],
  };
  const hint = hints[t.status] || hints['待办'];
  const workspace = document.getElementById('tb-workspace');
  if (workspace.hidden) returnFocus = document.activeElement;
  workspace.innerHTML = `
    <form id="tb-form" class="tb-detail-form">
      <header class="tb-detail-head">
        <button type="button" data-tb-close aria-label="返回任务看板">←</button>
        <span class="tb-detail-crumb">${xesc(cvProjectName(t.project))}<span>/</span><b>${xesc(t.sourceId || '新建任务')}</b></span>
        <div class="tb-detail-actions"><span id="tb-save-state" role="status">修改后保存</span>${selected ? '<button type="button" data-tb-transfer>转交</button>' : ''}<button class="tb-primary" type="submit">${selected ? '保存修改' : '创建任务'}</button></div>
      </header>
      <div class="tb-detail-layout">
        <main class="tb-detail-main">
          <div class="tb-task-heading">
            <div class="tb-task-kicker"><span class="tb-status-pill" data-tone="${col[2]}">${col[3]} ${col[1]}</span><span>${xesc(t.type)} · ${xesc(t.sourceId || '待生成编号')}</span></div>
            <input class="tb-task-title" name="title" aria-label="任务标题" required maxlength="120" placeholder="这项任务要达成什么目标？" value="${xesc(t.title)}">
            <div class="tb-task-byline">负责人 · ${xesc(tbOwner(t))}<span>／</span>${xesc(tbTeamName(t))}</div>
          </div>
          <div class="tb-next-step"><i>${col[3]}</i><div><strong>${hint[0]}</strong><p>${hint[1]}</p></div>${canSee ? '<button type="button" data-detail-jump="conversations">进入对话 ↗</button>' : ''}</div>
          ${selected ? stageStatusBarHtml(t) : ''}
          <div class="tb-detail-tabs" role="tablist" aria-label="任务内容">
            ${[['overview','概览'],['conversations','任务对话'],['artifacts','交付产物 <small>' + artifacts.length + '</small>']].map(([id,label],i) => '<button type="button" role="tab" id="tb-tab-' + id + '" aria-controls="tb-pane-' + id + '" aria-selected="' + !i + '" tabindex="' + (i ? -1 : 0) + '" data-detail-tab="' + id + '">' + label + '</button>').join('')}
          </div>
          <section class="tb-detail-pane" role="tabpanel" id="tb-pane-overview" aria-labelledby="tb-tab-overview" data-detail-pane="overview">
            <label class="tb-description-field"><span>任务描述</span><textarea name="desc" rows="3" placeholder="说明业务背景、目标与交付范围">${xesc(t.desc || '')}</textarea></label>
            <label class="tb-acceptance-field"><span>验收标准 <small>怎样才算完成</small></span><textarea name="acceptance" rows="3" placeholder="写下可核验的结果，每行一条">${xesc(t.acceptance || '')}</textarea></label>
            <section class="tb-detail-section tb-attachments"><h3>参考附件 <small>${(t.files || []).length}</small></h3><div class="tb-files" id="tb-files">${(t.files || []).map(f => '<span class="tb-file">' + xesc(f) + '</span>').join('')}</div>
            ${selected ? '<button type="button" class="tb-dropzone" data-tb-dropzone><span>＋ 添加参考文件</span><small>或拖拽到此处</small></button>' : ''}
            <p class="tb-file-note">本地演示仅记录文件名，文件内容不会上传。</p></section>
          </section>
          <section class="tb-detail-pane" role="tabpanel" id="tb-pane-conversations" aria-labelledby="tb-tab-conversations" data-detail-pane="conversations" hidden>
            <div class="tb-pane-heading"><div><h3>任务对话</h3><p>围绕任务沟通，每次会话独立保留。</p></div>${canSee ? '<button type="button" class="tb-conv-new-btn" data-conv-new>＋ 新会话</button>' : ''}</div><div id="tb-conv-area">${convArea}</div>
          </section>
          <section class="tb-detail-pane" role="tabpanel" id="tb-pane-artifacts" aria-labelledby="tb-tab-artifacts" data-detail-pane="artifacts" hidden>
            <div class="tb-pane-heading"><div><h3>交付产物</h3><p>汇总本任务各流程节点的产物，点击即可预览。</p></div><div class="tb-pane-actions"><span class="tb-readonly">只读</span></div></div>
            <div class="tb-artifacts">${artifacts.map(artifactLink).join('') || '<div class="tb-detail-empty"><span class="tb-empty-icon">▤</span><strong>还没有交付产物</strong><span>执行产物关联后，会出现在这里。</span></div>'}</div>
          </section>
        </main>
        <aside class="tb-detail-aside" aria-label="任务属性">
          <h3>任务属性</h3>
          <div class="tb-aside-group-k">可编辑</div>
          ${t.runtime ? '<div class="tb-inherited-field"><span>状态</span><b>' + xesc(tbLabel(t.status)) + '</b><small>由 Runtime 与评审结论汇总</small></div>' : (pendingReview ? '<label>状态<select name="status" disabled><option selected>' + xesc(tbLabel(t.status)) + '</option></select><small class="tb-field-lock">评审中 · 将按评审结论自动流转，暂不可手动修改</small></label>' : '<label>状态<select name="status">' + tbBoardColumns.map(c => '<option value="' + c[0] + '" ' + (t.status === c[0] ? 'selected' : '') + (c[0] === '已完成' && !canComplete ? ' disabled' : '') + '>' + c[1] + (c[0] === '已完成' && !canComplete ? '（需交付评审）' : '') + '</option>').join('') + '</select></label>')}
          ${tbMode(t) === '多人协作' && t.stagePlan?.length ? '' : '<label>负责人<select name="assignee" data-person-select aria-label="任务负责人">' + options(assigneeOptions,t.assignee) + '</select></label>'}
          <label>优先级<select name="priority">${options([...new Set(['高','中','低',tbPriority(t)])],tbPriority(t))}</select></label>
          <label>任务类型<select name="type">${options(['需求','Bug','任务','改进'],t.type)}</select></label>
          <div class="tb-aside-group-k tb-aside-group-k--ro">只读 · 系统维护</div>
          <div class="tb-inherited-field"><span>当前环节</span><b>${xesc(stageLabel(taskStageId(t)))}</b><small>评审通过后流转到下一环节</small></div>
          ${t.stagePlan?.length ? '<div class="tb-inherited-field tb-inherited-field--stages"><span>阶段执行人</span>' + t.stagePlan.map(sp => '<div class="tb-stage-owner-row' + (sp.id === taskStageId(t) ? ' is-current' : '') + '"><b>' + xesc(sp.name) + '</b><span>' + xesc(sp.assignee) + '</span></div>').join('') + '<small>创建时按专家团覆盖的阶段分工，每人只启动并负责自己那一段</small></div>' : ''}
          <h3 class="tb-aside-divider">项目与协作</h3>
          <div class="tb-aside-group-k">可编辑</div>
          <label>所属项目<select name="project">${CV_PROJECTS.filter(p=>cvProjectInWorkspace(p.id)).map(p => '<option value="' + p.id + '" ' + (p.id === t.project ? 'selected' : '') + '>' + xesc(p.name) + '</option>').join('')}</select></label>
          <label>执行模式<select name="mode">${options(['单人执行','多人协作'],tbMode(t))}</select></label>
          <div class="tb-aside-group-k tb-aside-group-k--ro">只读 · 系统维护</div>
          <div class="tb-inherited-field"><span>专家团</span><b>${xesc(selectedTeam?.name || '未绑定')}</b><small>继承自项目 · 任务执行统一使用</small></div>
          <div class="tb-detail-meta"><span>来源</span><b>${xesc(t.source || '对话自建')}</b><span>任务编号</span><b>${xesc(t.sourceId || '创建后生成')}</b></div>
          <div class="tb-local-note">本地演示 · 修改保存在当前浏览器<br>“已完成”由交付评审通过后自动进入。</div>
        </aside>
      </div>
    </form>`;
  /* 任务启动后转只读：锁定所有表单字段，隐藏保存/转交/添加附件入口 */
  if (selected && tbIsStarted(selected)) {
    workspace.classList.add('tb-detail-readonly');
    workspace.querySelectorAll('#tb-form input:not([type="button"]):not([type="submit"]), #tb-form textarea').forEach(el => { el.readOnly = true; });
    workspace.querySelectorAll('#tb-form select').forEach(el => { el.disabled = true; });
    const submitBtn = workspace.querySelector('#tb-form button[type="submit"]');
    if (submitBtn) submitBtn.hidden = true;
    const transferBtn = workspace.querySelector('[data-tb-transfer]');
    if (transferBtn) transferBtn.hidden = true;
    const dropzone = workspace.querySelector('[data-tb-dropzone]');
    if (dropzone) dropzone.hidden = true;
    const saveState = document.getElementById('tb-save-state');
    if (saveState) saveState.textContent = '任务已启动 · 只读';
    workspace.querySelectorAll('.tb-aside-group-k:not(.tb-aside-group-k--ro)').forEach(k => { k.textContent = '只读'; });
  } else {
    workspace.classList.remove('tb-detail-readonly');
  }
  document.getElementById('tb-board-view').hidden = true;
  workspace.hidden = false;
  document.getElementById('cv-tasks').classList.add('tb-detail-open');
  formSnapshot = detailSnapshot();
  workspace.querySelector('[data-tb-close]').focus({ preventScroll: true });
}
function closeTask() {
  if (!tbShowBoard()) return;
}
export function tbShowBoard() {
  if (!confirmLeave()) return false;
  document.getElementById('tb-workspace').hidden = true;
  document.getElementById('tb-board-view').hidden = false;
  document.getElementById('cv-tasks').classList.remove('tb-detail-open');
  if (returnFocus?.isConnected) returnFocus.focus(); else document.getElementById('tb-create').focus();
  return true;
}
export function tbFilterToTask(taskId) {
  const task = CV_TASKS.find(t => t.boardId === taskId && t.kind !== 'epic');
  if (!task) return false;
  const search = document.getElementById('tb-search');
  search.value = task.sourceId || task.title;
  search.dataset.focusTaskId = taskId;
  document.getElementById('tb-mode').value = '';
  document.getElementById('tb-layout').value = 'list';
  scope = 'all';
  document.querySelectorAll('#cv-tasks [data-tb-scope]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tbScope === 'all')));
  renderTaskBoard();
  return true;
}
function submitTask(event) {
  event.preventDefault();
  const selected = tbGetSelected();
  const f = new FormData(event.target);
  const title = f.get('title').trim();
  if (!title) { event.target.elements.title.setCustomValidity('请输入任务标题'); event.target.elements.title.reportValidity(); return; }
  const previous = selected && { status: selected.status, assignee: selected.assignee };
  const requestedStatus = f.get('status') || selected?.status || '待办';
  const pendingReview = selected && (selected.reviews || []).some(r => r.status === 'pending');
  if (pendingReview && requestedStatus !== '审核中') { window.alert('当前评审尚未处理，任务需要保持“审核中”。'); selectDetailTab('overview'); return; }
  if (previous?.status !== '已完成' && requestedStatus === '已完成' && !hasApprovedDelivery(selected)) { window.alert('任务完成前需要通过交付评审。'); selectDetailTab('overview'); return; }
  const t = selected || { boardId: crypto.randomUUID(), source: '对话自建', sourceId: 'TASK-' + Date.now().toString().slice(-6), size: '小', exec: '专家团', progress: 0, activity: [], artifacts: [] };
  ['assignee', 'mode', 'priority', 'project', 'type'].forEach(key => { if (f.has(key)) t[key] = f.get(key); });
  if (f.has('status')) t.status = requestedStatus;
  delete t.teamId;
  if (t.mode === '单人执行') (t.stagePlan || []).forEach(sp => { sp.assignee = t.assignee; });
  t.acceptance = (f.get('acceptance') || '').trim();
  t.title = title; t.desc = f.get('desc').trim(); t.collab = t.mode === '单人执行' ? '无需协作' : '人Agent协作';
  t.activity ||= []; t.artifacts ||= [];
  if (previous && previous.status !== t.status) t.activity.push({ author: '张工', text: tbLabel(previous.status) + ' → ' + tbLabel(t.status), time: nowStr() });
  if (previous && previous.assignee !== t.assignee) t.activity.push({ author: '张工', text: '负责人变更为 ' + tbOwner(t), time: nowStr() });
  const comment = (f.get('comment') || '').trim();
  if (comment) t.activity.push({ author: '张工', text: comment, time: nowStr() });
  if (!selected) { t.activity.push({ author: '张工', text: '创建了任务', time: nowStr() }); CV_TASKS.unshift(t); }
  if (t.status === '已完成') t.progress = 100;
  else if (previous?.status === '已完成') t.progress = 0;
  const tab = document.querySelector('[data-detail-tab][aria-selected="true"]')?.dataset.detailTab || 'overview';
  const saved = tbSave(); renderTaskBoard(); cvUpdateCounts();
  openTask(CV_TASKS.indexOf(t)); selectDetailTab(tab);
  document.getElementById('tb-save-state').textContent = saved ? '已保存到本地' : '未持久保存';
}
export function initTaskBoard() {
  /* 先给内置任务补稳定 id，再合并本地快照。旧快照可能没有 boardId，
     因此同时用来源、编号和项目识别同一业务任务，避免刷新后生成重复卡片。 */
  cvSeedTaskDetails();
  let restored = false;
  try {
    const saved = JSON.parse(localStorage.getItem('lingee_task_board_v1') || 'null');
    if (Array.isArray(saved)) { restored = true; saved.forEach(t => {
      if (!t || typeof t.title !== 'string' || !tbColumns.some(c => c[0] === t.status)) return;
      t.kind = t.kind || 'task';
      delete t.teamId;
      const existing = CV_TASKS.find(row => tbTaskId(row) === tbTaskId(t) || (
        row.source === t.source && row.sourceId === t.sourceId && row.project === t.project
      ));
      if (existing) Object.assign(existing, t); else CV_TASKS.push(t);
    }); }
  } catch { /* A damaged local snapshot must not prevent the demo from opening. */ }
  cvSeedTaskDetails();
  /* 为「进行中」种子任务预置 Runtime：所有执行阶段设为运行中，
     展示多阶段并行推进时各阶段均为「进行中」的状态。 */
  CV_TASKS.forEach(t => {
    if (t.kind === 'epic' || t.status !== '进行中') return;
    const runtime = ensureTaskRuntime(t);
    if (!runtime || runtime.status !== 'ready') return;
    runtime.workItems.forEach((wi, idx) => {
      wi.status = 'running';
      wi.dependsOn = [];
      wi.runs.push({ id: 'run-seed-' + idx + '-' + Date.now().toString(36), attempt: 1, status: 'running', startedAt: new Date().toLocaleString('zh-CN', { hour12: false }) });
    });
    runtime.status = 'running';
  });
  CV_TASKS.forEach(t => { if (t.runtime) syncTaskFromRuntime(t); });
  if (restored) tbSave();
  const panel = document.getElementById('cv-tasks');
  panel.addEventListener('click', event => {
    if (event.target.closest('[data-tb-dropzone]')) { if (window.tbAddFile) window.tbAddFile(); return; }
    const assignBtn = event.target.closest('[data-tb-assign]');
    if (assignBtn) { tbQuickAssign(Number(assignBtn.dataset.tbAssign)); return; }
    const handoffBtn = event.target.closest('[data-tb-handoff]');
    if (handoffBtn) { tbQuickTransfer(Number(handoffBtn.dataset.tbHandoff)); return; }
    const fold = event.target.closest('[data-tb-fold]');
    if (fold) { const col = fold.closest('.tb-column'); if (col) col.classList.toggle('collapsed'); return; }
    const button = event.target.closest('button');
    if (button) {
      if (button.dataset.tbScope) {
        scope = button.dataset.tbScope;
        panel.querySelectorAll('[data-tb-scope]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
        renderTaskBoard();
      } else if (button.dataset.tbAdd) window.cvOpenNewTask && window.cvOpenNewTask(button.dataset.tbAdd);
      else if (button.id === 'tb-create') window.cvOpenNewTask && window.cvOpenNewTask();
      else if (button.hasAttribute('data-tb-close')) closeTask();
      else if (button.hasAttribute('data-task-artifact')) previewTaskArtifact(button.dataset.taskArtifact);
      else if (button.hasAttribute('data-review-start')) startTaskReview();
      else if (button.dataset.reviewDecision) decideTaskReview(button.dataset.reviewDecision);
      else if (button.dataset.detailTab || button.dataset.detailJump) selectDetailTab(button.dataset.detailTab || button.dataset.detailJump);
      else if (button.hasAttribute('data-runtime-retry')) { const t = tbGetSelected(); if (t) { retryTaskRuntime(t); tbSave(); openTask(CV_TASKS.indexOf(t)); selectDetailTab('overview'); renderTaskBoard(); } }
      else if (button.dataset.conv) { if (confirmLeave()) window.tbOpenConv && window.tbOpenConv(button.dataset.conv); }
      else if (button.hasAttribute('data-conv-back')) window.tbBackConv && window.tbBackConv();
      else if (button.hasAttribute('data-conv-new')) { if (confirmLeave()) window.tbNewConv && window.tbNewConv(); }
      else if (button.hasAttribute('data-tb-exec')) {
        event.stopPropagation();
        const idx = Number(button.dataset.tbExec);
        const task = CV_TASKS[idx];
        if (task && task.status === '待办') {
          task.status = '进行中';
          if (!task.activity) task.activity = [];
          task.activity.push({ author: cvCurrentUserName(), text: '点击「开始执行」启动任务', time: new Date().toLocaleString('zh-CN', { hour12: false }) });
          tbSave();
          renderTaskBoard();
          cvUpdateCounts();
        }
      }
      else if (button.hasAttribute('data-tb-transfer')) {
        if (confirmLeave()) { openTask(CV_TASKS.indexOf(tbGetSelected())); window.tbOpenTransfer && window.tbOpenTransfer(); }
      }
      else if (button.id === 'tb-chat-send') window.tbChatSend && window.tbChatSend();
      else if (button.id === 'tb-reset') {
        document.getElementById('tb-search').value = ''; delete document.getElementById('tb-search').dataset.focusTaskId; document.getElementById('tb-mode').value = '';
        cvSetProject('');
        panel.querySelector('[data-tb-scope="all"]').click();
      }
      return;
    }
    const card = event.target.closest('.tb-card');
    if (card && card.dataset.tbTask !== undefined) openTask(Number(card.dataset.tbTask));
  });
  const search = document.getElementById('tb-search');
  const enableSearch = () => search.removeAttribute('readonly');
  search.addEventListener('pointerdown', enableSearch, { once: true });
  search.addEventListener('keydown', enableSearch, { once: true });
  search.addEventListener('input', () => { delete search.dataset.focusTaskId; renderTaskBoard(); });
  ['tb-mode', 'tb-layout'].forEach(id => document.getElementById(id).addEventListener('change', renderTaskBoard));
  const ws = document.getElementById('tb-workspace');
  ws.addEventListener('submit', submitTask);
  ws.addEventListener('input', e => {
    if (e.target.name === 'title') e.target.setCustomValidity('');
    document.getElementById('tb-save-state').textContent = detailSnapshot() === formSnapshot ? '修改后保存' : '有未保存修改';
  });
  ws.addEventListener('keydown', e => {
    const tab = e.target.closest('[data-detail-tab]');
    if (!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    e.preventDefault();
    const tabs = [...ws.querySelectorAll('[data-detail-tab]')];
    const index = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectDetailTab(tabs[index].dataset.detailTab); tabs[index].focus();
  });
}

export { closeTask, openTask as tbOpenTask };
