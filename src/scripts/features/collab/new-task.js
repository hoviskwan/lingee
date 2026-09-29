import { CV_TASKS, CV_PROJECTS, cvProject, cvPeopleInProject } from './data.js';
import { TEAMS } from '../expert/store.js';
import { EX, STAGES, STAGE_MODES, xav, xesc } from '../expert/data.js';
import { cvUpdateCounts } from './projects.js';
import { tbSave, tbTeamStages } from './tb-core.js';
import { renderTaskBoard } from './task-board.js';
import { toast } from '../../core/toast.js';
/* 新建任务弹窗：手动创建 / 一句话草拟。
   手动：关联项目 → 选定专家团 → 按专家逐一指定负责人。
   一句话：本地规则整理可编辑草稿，创建前由用户确认项目、执行人与内容。
   从 task-board.js 拆出，副作用集中在 initNewTask()。 */


let ntMode = 'manual';
let ntStatus = '待办';
let ntFiles = [];
let ntTags = [];
let ntProjectId = '';
let ntTeamId = '';
let ntAssignee = '';
let ntExecMode = '单人执行';

/* 标签：与任务详情 labelPicker 共用同一套调色板、哈希算法和预设目录 */
const NT_LABEL_PALETTE = ['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#6366f1','#a855f7','#ec4899','#64748b'];
const NT_LABELS = ['需求', '缺陷'];
const ntLabelColors = {};
let ntLabelMenu = null;
function ntLabelColor(name) {
  if (ntLabelColors[name]) return ntLabelColors[name];
  var hash = 0;
  for (var i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return NT_LABEL_PALETTE[hash % NT_LABEL_PALETTE.length];
}
function ntLabelTextColor(color) {
  var r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
  return (r * .299 + g * .587 + b * .114) / 255 > .55 ? '#111827' : '#f9fafb';
}
function ntLabelCatalog() {
  var set = new Set(NT_LABELS.concat(ntTags));
  CV_TASKS.forEach(function(t) { (t.tags || []).forEach(function(tag) { set.add(tag); }); });
  return Array.from(set);
}
let ntExpertPlan = [];
let ntParentTaskId = '';
let ntParentIsGroup = false;
let ntDraftReady = false;

const NT_STATUS_LABELS = { '待规划': '待规划', '待办': '待开始', '进行中': '执行中', '审核中': '审核中', '已完成': '已完成', '已阻塞': '已阻塞', '已取消': '已取消' };

function ntRenderFiles() {
  const el = document.getElementById('cv-nt-file-list');
  if (!el) return;
  const count = document.getElementById('cv-nt-attach-count');
  if (count) count.textContent = ntFiles.length ? String(ntFiles.length) : '';
  if (!ntFiles.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="nt-attach-grid">' + ntFiles.map((f, i) => '<span class="nt-attach-chip"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg><span class="nt-attach-name">' + xesc(f) + '</span><button type="button" class="nt-attach-x" data-nt-file="' + i + '">×</button></span>').join('') + '<button type="button" class="nt-attach-more" data-nt-attach-trigger title="继续添加"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button></div>';
}
function ntAddFile() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.multiple = true;
  inp.onchange = () => { Array.from(inp.files || []).forEach(f => ntFiles.push(f.name)); ntRenderFiles(); };
  inp.click();
}

/* 标签：弹出层选择器，与任务详情 labelPicker 交互一致 */
function ntRenderTags() {
  var el = document.getElementById('cv-nt-tags-trigger');
  if (!el) return;
  el.innerHTML = ntTags.length ? ntTags.map(function(name) {
    var color = ntLabelColor(name);
    return '<span class="tk-drawer-label" style="background:' + color + ';color:' + ntLabelTextColor(color) + '"><span>' + xesc(name) + '</span><button type="button" class="tk-drawer-label-remove" data-nt-label-remove="' + xesc(name) + '" aria-label="移除标签 ' + xesc(name) + '">×</button></span>';
  }).join('') : '<span class="tk-label-placeholder"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3h9l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1"/></svg>添加标签</span>';
}
function ntCloseLabelPicker() {
  if (ntLabelMenu) ntLabelMenu.remove();
  ntLabelMenu = null;
  var trigger = document.getElementById('cv-nt-tags-trigger');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}
function ntRenderLabelChoices(query) {
  if (!ntLabelMenu) return;
  var normalized = (query || '').trim().toLocaleLowerCase();
  var labels = ntLabelCatalog().filter(function(name) { return name.toLocaleLowerCase().includes(normalized); });
  var list = ntLabelMenu.querySelector('.tk-label-picker-options');
  list.innerHTML = labels.map(function(name) {
    var selected = ntTags.includes(name);
    return '<button type="button" class="tk-label-option' + (selected ? ' selected' : '') + '" data-nt-label-option="' + xesc(name) + '" role="option" aria-selected="' + selected + '"><span class="tk-label-color" style="background:' + ntLabelColor(name) + '"></span><span class="tk-label-option-name">' + xesc(name) + '</span><span class="tk-label-check">' + (selected ? '✓' : '') + '</span></button>';
  }).join('');
  var exact = ntLabelCatalog().some(function(name) { return name.toLocaleLowerCase() === normalized; });
  if (normalized && !exact) list.innerHTML += '<button type="button" class="tk-label-option tk-label-create" data-nt-label-create="' + xesc(query.trim()) + '"><span class="tk-label-create-plus">＋</span><span class="tk-label-option-name">创建“' + xesc(query.trim()) + '”</span><span class="tk-label-color" style="background:' + ntLabelColor(query.trim()) + '"></span></button>';
  if (!list.innerHTML) list.innerHTML = '<div class="tk-label-picker-empty">没有匹配的标签</div>';
}
function ntOpenLabelPicker() {
  console.log('[new-task] ntOpenLabelPicker 被调用');
  ntCloseLabelPicker();
  var trigger = document.getElementById('cv-nt-tags-trigger');
  if (!trigger) return;
  ntLabelMenu = document.createElement('div');
  ntLabelMenu.className = 'tk-label-popover';
  ntLabelMenu.innerHTML = '<div class="tk-label-search-wrap"><input type="search" class="tk-label-search" placeholder="搜索标签…" aria-label="搜索标签" autocomplete="off"></div><div class="tk-label-picker-options" role="listbox" aria-multiselectable="true"></div>';
  ntRenderLabelChoices('');
  ntLabelMenu.addEventListener('input', function(e) {
    if (e.target.classList.contains('tk-label-search')) ntRenderLabelChoices(e.target.value);
  });
  ntLabelMenu.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ntCloseLabelPicker(); return; }
    if (e.isComposing) return;
    if (e.key === 'Enter' && e.target.classList.contains('tk-label-search')) {
      var first = ntLabelMenu.querySelector('.tk-label-option');
      if (first) { e.preventDefault(); first.click(); }
    }
    if (e.key === 'ArrowDown' && e.target.classList.contains('tk-label-search')) {
      var opt = ntLabelMenu.querySelector('.tk-label-option');
      if (opt) { e.preventDefault(); opt.focus(); }
    }
    var focusedOption = e.target.closest('.tk-label-option');
    if (focusedOption && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      var options = Array.from(ntLabelMenu.querySelectorAll('.tk-label-option'));
      var idx = options.indexOf(focusedOption) + (e.key === 'ArrowDown' ? 1 : -1);
      if (options[idx]) options[idx].focus();
      else ntLabelMenu.querySelector('.tk-label-search').focus();
    }
  });
  ntLabelMenu.addEventListener('click', function(e) {
    var option = e.target.closest('[data-nt-label-option]');
    var create = e.target.closest('[data-nt-label-create]');
    if (!option && !create) return;
    var name = option ? option.getAttribute('data-nt-label-option') : create.getAttribute('data-nt-label-create');
    if (ntTags.indexOf(name) >= 0) ntTags = ntTags.filter(function(t) { return t !== name; });
    else ntTags.push(name);
    ntRenderTags();
    var search = ntLabelMenu.querySelector('.tk-label-search');
    if (search) {
      if (create) search.value = '';
      ntRenderLabelChoices(search.value);
      search.focus({ preventScroll: true });
    }
  });
  document.body.appendChild(ntLabelMenu);
  console.log('[new-task] 标签弹出层已挂载到 body, offsetWidth:', ntLabelMenu.offsetWidth, 'offsetHeight:', ntLabelMenu.offsetHeight);
  ntRenderLabelChoices('');
  var rect = trigger.getBoundingClientRect();
  ntLabelMenu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - ntLabelMenu.offsetWidth - 8)) + 'px';
  ntLabelMenu.style.top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - ntLabelMenu.offsetHeight - 8)) + 'px';
  trigger.setAttribute('aria-expanded', 'true');
  ntLabelMenu.querySelector('input').focus({ preventScroll: true });
}

/* 项目 → 专家团：一个项目只绑定一个专家团 */
function ntTeamOfProject(pid) {
  const proj = CV_PROJECTS.find(p => p.id === pid);
  const tid = (proj && proj.defaultTeam) || (TEAMS[0] && TEAMS[0].id);
  return TEAMS.find(t => t.id === tid) || TEAMS[0] || null;
}
/* Task 只选业务负责人（实际的人）。 */
function ntPeopleOfProject(pid) {
  const proj = CV_PROJECTS.find(p => p.id === pid);
  return proj ? cvPeopleInProject(proj) : [];
}
/* 项目 → 默认专家团：一个项目绑定一个团，用户可在弹窗内改选 */
function ntRenderTeam() {
  const sel = document.getElementById('cv-nt-team');
  const team = ntProjectId ? ntTeamOfProject(ntProjectId) : null;
  ntTeamId = team ? team.id : (TEAMS[0] ? TEAMS[0].id : '');
  if (sel) {
    sel.innerHTML = TEAMS.map(t => '<option value="' + xesc(t.id) + '">' + xesc(t.name) + ' · ' + (t.members || []).length + ' 人</option>').join('');
    sel.value = ntTeamId;
    sel.disabled = !TEAMS.length;
  }
}
function ntRenderGroups() {
  const field = document.getElementById('cv-nt-group-field');
  const select = document.getElementById('cv-nt-group');
  if (!field || !select) return;
  field.classList.toggle('hidden', !!ntParentTaskId);
  select.innerHTML = '<option value="">无上级任务</option>' + CV_TASKS.filter(t => t.project === ntProjectId && t.kind === 'epic').map(t => '<option value="' + xesc(t.boardId) + '">' + xesc(t.title) + '</option>').join('');
  select.disabled = !ntProjectId;
}
/* 负责人：从项目成员中选人。 */
function ntRenderPeople() {
  const members = ntPeopleOfProject(ntProjectId);
  const menu = document.getElementById('cv-nt-people-menu');
  const nameEl = document.getElementById('cv-nt-people-name');
  const avatarEl = document.getElementById('cv-nt-people-avatar');
  const btn = document.getElementById('cv-nt-people-btn');
  if (!menu) return;
  if (!ntProjectId || !members.length) {
    ntAssignee = '';
    if (nameEl) nameEl.textContent = ntProjectId ? '请先添加成员' : '请先选择项目';
    if (avatarEl) avatarEl.textContent = '人';
    if (btn) btn.disabled = true;
    menu.innerHTML = '';
    return;
  }
  if (btn) btn.disabled = false;
  if (!members.some(m => m.name === ntAssignee)) ntAssignee = members[0].name;
  const sel = members.find(m => m.name === ntAssignee) || members[0];
  if (nameEl) nameEl.textContent = sel.name;
  if (avatarEl) avatarEl.textContent = sel.name[0] || '?';
  menu.innerHTML = members.map(m => '<button type="button" class="nt-person-item' + (m.name === ntAssignee ? ' selected' : '') + '" data-person="' + xesc(m.name) + '"><span class="person-avatar-sm">' + xesc(m.name[0] || '?') + '</span><span class="person-name-sm">' + xesc(m.name) + '</span></button>').join('');
}
/* 多人协作：按专家团成员逐一指定负责人，每人只负责并启动自己那一段。 */
function ntExpertsFieldVisible() {
  return ntExecMode === '多人协作';
}
function ntSetExecMode(m) {
  ntExecMode = m === '多人协作' ? '多人协作' : '单人执行';
  document.querySelectorAll('#cv-nt-exec-mode .nt-seg-btn').forEach(b => {
    const selected = b.getAttribute('data-nt-exec') === ntExecMode;
    b.classList.toggle('on', selected);
    b.setAttribute('aria-checked', String(selected));
    b.tabIndex = selected ? 0 : -1;
  });
  const single = document.getElementById('cv-nt-single-field');
  const expertsField = document.getElementById('cv-nt-experts-field');
  if (single) single.classList.toggle('hidden', ntExecMode !== '单人执行');
  if (expertsField) expertsField.classList.toggle('hidden', !ntExpertsFieldVisible());
  if (ntExecMode === '多人协作') {
    ntRenderExperts();
    expertsField?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
/* 专家覆盖的阶段：由「工作模式 → 阶段」映射反查，作为只读信息展示 */
function ntStagesOfExpert(id) {
  const modes = (EX[id] || {}).modes || [];
  return STAGES.filter(s => (STAGE_MODES[s.id] || []).some(m => modes.indexOf(m) >= 0));
}
/* 专家分工 → 阶段执行人。团长往往覆盖大部分阶段，因此按「覆盖阶段越少越专一」排序，
   同专一度才让团长靠前，保证 stagePlan 落到真正做这件事的人身上，且仍是单执行人。 */
function ntDeriveStagePlan(team, plan, fallback) {
  const coverage = {};
  plan.forEach(e => { coverage[e.id] = ntStagesOfExpert(e.id).length; });
  return tbTeamStages(team).map(s => {
    const owners = plan
      .filter(e => (STAGE_MODES[s.id] || []).some(m => e.modes.indexOf(m) >= 0))
      .sort((a, b) => (coverage[a.id] - coverage[b.id]) || (Number(b.lead) - Number(a.lead)));
    const owner = owners[0];
    return { id: s.id, name: s.name, assignee: (owner && owner.assignee) || fallback };
  });
}
function ntRenderExperts() {
  const el = document.getElementById('cv-nt-expert-list');
  if (!el) return;
  const team = ntTeamId ? TEAMS.find(t => t.id === ntTeamId) : null;
  const members = ntPeopleOfProject(ntProjectId);
  const count = document.getElementById('cv-nt-expert-count');
  const teamEl = document.getElementById('cv-nt-expert-team');
  if (teamEl) teamEl.textContent = team ? (team.name + ' · ' + (team.members || []).length + ' 位专家') : '未选择专家团';
  if (!team) { el.innerHTML = '<span class="nt-people-empty">请先选择专家团</span>'; ntExpertPlan = []; if (count) count.textContent = ''; return; }
  if (!ntProjectId || !members.length) { el.innerHTML = '<span class="nt-people-empty">' + (ntProjectId ? '请先为项目添加成员' : '请先选择项目') + '</span>'; ntExpertPlan = []; if (count) count.textContent = ''; return; }
  const roster = (team.members || []).filter(id => EX[id]);
  if (!roster.length) { el.innerHTML = '<span class="nt-people-empty">该专家团暂无专家</span>'; ntExpertPlan = []; if (count) count.textContent = ''; return; }
  if (!ntExpertPlan.length || ntExpertPlan[0].teamId !== ntTeamId) {
    ntExpertPlan = roster.map((id, i) => ({ id, teamId: ntTeamId, lead: id === team.leadId, assignee: members[i % members.length].name }));
  }
  if (count) count.textContent = ntExpertPlan.filter(e => e.assignee).length + ' / ' + ntExpertPlan.length;
  el.innerHTML = ntExpertPlan.map(e => {
    const ex = EX[e.id] || {};
    const name = ex.name || e.id;
    return '<div class="nt-expert-row' + (e.assignee ? '' : ' is-unassigned') + '" data-expert="' + xesc(e.id) + '">'
      + '<img class="nt-expert-av" src="' + xav(ex.k) + '" alt="">'
      + '<span class="nt-expert-id"><span class="nt-expert-name">' + xesc(name) + (e.lead ? '<em class="nt-expert-badge">团长</em>' : '') + '</span><span class="nt-expert-role">' + xesc(ex.role || '') + '</span></span>'
      + '<span class="nt-expert-modes">' + ntStagesOfExpert(e.id).map(s => '<span class="nt-expert-chip">' + xesc(s.name) + '</span>').join('') + '</span>'
      + '<select class="nt-expert-person" data-nt-expert-assignee="' + xesc(e.id) + '" aria-label="' + xesc(name) + ' 负责人">'
      + '<option value="">待指定</option>'
      + members.map(m => '<option value="' + xesc(m.name) + '"' + (m.name === e.assignee ? ' selected' : '') + '>' + xesc(m.name) + '</option>').join('')
      + '</select></div>';
  }).join('');
}
/* 一键铺默认值：按项目成员依次分配，与打开弹窗时的初始分工一致 */
function ntAutoAssignExperts() {
  const members = ntPeopleOfProject(ntProjectId);
  if (!members.length || !ntExpertPlan.length) return;
  ntExpertPlan.forEach((e, i) => { e.assignee = members[i % members.length].name; });
  ntRenderExperts();
}
function ntOnProjectChange() {
  const sel = document.getElementById('cv-nt-project');
  ntProjectId = sel ? sel.value : '';
  ntAssignee = '';
  ntExpertPlan = [];
  ntRenderTeam(); ntRenderPeople(); ntRenderGroups();
  if (ntExecMode === '多人协作') ntRenderExperts();
}
/* 原型仅根据项目名称匹配归属，不调用模型服务。 */
function ntInferProject(prompt) {
  const p = prompt || '';
  for (const proj of CV_PROJECTS) { if (p.indexOf(proj.name) >= 0) return proj.id; }
  return ntProjectId || cvProject || (CV_PROJECTS[0] && CV_PROJECTS[0].id);
}
function ntAppendDraftMessage(kind, text) {
  const log = document.getElementById('cv-nt-agent-messages');
  if (!log) return;
  const item = document.createElement('p');
  item.className = 'nt-agent-message nt-agent-message--' + kind;
  item.textContent = text;
  log.appendChild(item);
  log.scrollTop = log.scrollHeight;
}
function ntBuildDraft(message) {
  const first = message.split(/[。！？\n]/)[0].replace(/^(?:请帮我|帮我|我想|我要|我希望)\s*/, '').replace(/^(?:做一个|开发一个|实现一个)/, '实现 ');
  if (/CRM/i.test(message) && /客户管理/.test(message)) {
    return {
      title: '实现 CRM 客户管理',
      desc: '实现 CRM 系统的客户管理模块，建议覆盖以下功能（请确认范围）：\n\n1. 客户信息：创建、编辑、查询与详情查看\n2. 联系人：为客户维护姓名、职位、电话和邮箱\n3. 跟进记录：记录沟通内容、时间和方式\n4. 客户标签：按标签筛选与分组\n5. 数据导入导出：支持 Excel/CSV 批量导入和导出',
      question: '草稿列出了客户信息、联系人、跟进记录、标签和导入导出。这些都要放进第一期吗？'
    };
  }
  return { title: (first || message).slice(0, 120), desc: message, question: '已整理到左侧草稿。还需要哪些功能或完成标准？可以继续补充，也可以直接确认创建。' };
}
function ntSendDraftMessage() {
  const input = document.getElementById('cv-nt-prompt');
  const message = (input?.value || '').trim();
  if (!message) { input?.focus(); return false; }
  ntAppendDraftMessage('user', message);
  input.value = '';
  if (!ntDraftReady) {
    ntDraftReady = true;
    const draft = ntBuildDraft(message);
    document.getElementById('cv-nt-draft-title').value = draft.title;
    document.getElementById('cv-nt-draft-desc').value = draft.desc;
    document.getElementById('cv-nt-draft-empty').classList.add('hidden');
    document.getElementById('cv-nt-draft-content').classList.remove('hidden');
    ntUpdateSubmitState();
    document.getElementById('cv-nt-continue').disabled = false;
    const project = ntInferProject(message);
    const select = document.getElementById('cv-nt-project');
    if (select && project) { select.value = project; ntOnProjectChange(); }
    ntAppendDraftMessage('assistant', draft.question);
  } else {
    const desc = document.getElementById('cv-nt-draft-desc');
    if (/^(都需要|都要|全部需要|全部都要)[。！!]?$/i.test(message) && desc.value.includes('建议覆盖以下功能（请确认范围）')) {
      desc.value = desc.value.replace('建议覆盖以下功能（请确认范围）', '包含以下功能');
      ntAppendDraftMessage('assistant', '好的，已确认这些功能都在范围内。它们要全部放进第一期，还是分阶段交付？');
    } else {
      desc.value = (desc.value.trim() + '\n\n补充要求：' + message).trim();
      ntAppendDraftMessage('assistant', '已补充到任务描述。请核对左侧草稿与下方属性。');
    }
  }
  input.focus();
  return true;
}
function ntUpdateSubmitState() {
  const btn = document.getElementById('cv-nt-submit');
  if (!btn) return;
  const titleEl = document.getElementById(ntMode === 'agent' ? 'cv-nt-draft-title' : 'cv-nt-title');
  btn.disabled = ntMode === 'agent' ? (!ntDraftReady || !titleEl.value.trim()) : !titleEl.value.trim();
}
export function cvOpenNewTask(status, ctx) {
  ntMode = 'manual';
  ntStatus = status || '待办';
  ntParentTaskId = ctx?.parentTaskId || '';
  ntParentIsGroup = !!ntParentTaskId && CV_TASKS.some(t => t.boardId === ntParentTaskId && t.kind === 'epic');
  ntProjectId = ctx?.projectId || cvProject || '';
  ntAssignee = '';
  ntFiles = [];
  ntTags = [];
  ntExpertPlan = [];
  ntDraftReady = false;
  const psel = document.getElementById('cv-nt-project');
  if (psel) {
    psel.innerHTML = '<option value="">请选择项目</option>' + CV_PROJECTS.map(p => '<option value="' + p.id + '"' + (p.id === ntProjectId ? ' selected' : '') + '>' + xesc(p.name) + '</option>').join('');
    psel.disabled = !!ntParentTaskId;
  }
  document.getElementById('cv-nt-title').value = '';
  document.getElementById('cv-nt-desc').value = '';
  document.getElementById('cv-nt-prompt').value = '';
  document.getElementById('cv-nt-draft-title').value = '';
  document.getElementById('cv-nt-draft-desc').value = '';
  document.getElementById('cv-nt-draft-empty').classList.remove('hidden');
  document.getElementById('cv-nt-draft-content').classList.add('hidden');
  document.getElementById('cv-nt-agent-messages').innerHTML = '<p class="nt-agent-welcome">说出想完成的事，我会先整理成草稿。你可以继续补充，也可以直接编辑左侧内容。</p>';
  document.getElementById('cv-nt-priority').value = '中';
  var _moreBtn = document.getElementById('cv-nt-more-trigger'); var _morePanel = document.getElementById('cv-nt-more-body'); if (_moreBtn) _moreBtn.setAttribute('aria-expanded', 'false'); if (_morePanel) _morePanel.hidden = true;
  ntCloseLabelPicker();
  const chip = document.getElementById('cv-nt-status-chip');
  if (chip) chip.textContent = NT_STATUS_LABELS[ntStatus] || '待开始';
  const statusProperty = document.getElementById('cv-nt-status-property');
  if (statusProperty) statusProperty.textContent = NT_STATUS_LABELS[ntStatus] || '待开始';
  const modes = document.getElementById('cv-nt-modes');
  if (modes) modes.classList.toggle('hidden', !!ntParentTaskId);
  ['cv-nt-agent-trigger', 'cv-nt-manual-trigger'].forEach(id => {
    const trigger = document.getElementById(id);
    if (trigger) trigger.classList.toggle('hidden', !!ntParentTaskId || id === 'cv-nt-manual-trigger');
  });
  const parentBanner = document.getElementById('cv-nt-parent-banner');
  if (parentBanner) {
    parentBanner.classList.toggle('hidden', !ntParentTaskId);
    const t = document.getElementById('cv-nt-parent-title');
    if (t) t.textContent = ctx?.parentTitle || '';
    const label = document.getElementById('cv-nt-parent-label');
    if (label) label.textContent = ntParentIsGroup ? '正在' : '正在为';
    const suffix = document.getElementById('cv-nt-parent-suffix');
    if (suffix) suffix.textContent = ntParentIsGroup ? '下创建子任务' : '新增子任务';
  }
  ntRenderTags();
  ntRenderTeam(); ntRenderPeople(); ntRenderGroups();
  const groupSelect = document.getElementById('cv-nt-group');
  if (groupSelect && ctx?.groupId && Array.from(groupSelect.options).some(option => option.value === ctx.groupId)) groupSelect.value = ctx.groupId;
  ntRenderFiles();
  ntSetExecMode('单人执行');
  cvSetNewTaskMode('manual');
  const continueToggle = document.getElementById('cv-nt-continue-toggle');
  if (continueToggle) continueToggle.checked = false;
  document.getElementById('cv-newtask-overlay').classList.remove('nt-fullscreen');
  document.getElementById('cv-newtask-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById(ntMode === 'agent' ? 'cv-nt-prompt' : 'cv-nt-title').focus(), 0);
}
export function cvCloseNewTask() { document.getElementById('cv-newtask-overlay').style.display = 'none'; }
function cvSetNewTaskMode(m) {
  ntMode = m;
  const modal = document.querySelector('#cv-newtask-overlay .nt-modal');
  if (modal) modal.classList.toggle('nt-modal--agent', m === 'agent');
  document.getElementById('cv-nt-manual').classList.toggle('hidden', m !== 'manual');
  document.getElementById('cv-nt-agent').classList.toggle('hidden', m !== 'agent');
  const properties = document.getElementById('cv-nt-properties');
  if (properties) properties.classList.remove('hidden');
  const expertsField = document.getElementById('cv-nt-experts-field');
  if (expertsField) (m === 'agent' ? document.getElementById('cv-nt-draft-content') : document.getElementById('cv-nt-manual')).appendChild(expertsField);
  if (expertsField) expertsField.classList.toggle('hidden', !ntExpertsFieldVisible());
  document.getElementById('cv-nt-mode-label').textContent = ntParentTaskId ? (ntParentIsGroup ? '新建任务' : '新增子任务') : (m === 'agent' ? '一句话创建' : '手动创建');
  const agentTrigger = document.getElementById('cv-nt-agent-trigger');
  const manualTrigger = document.getElementById('cv-nt-manual-trigger');
  if (agentTrigger) agentTrigger.classList.toggle('hidden', m === 'agent' || !!ntParentTaskId);
  if (manualTrigger) manualTrigger.classList.toggle('hidden', m !== 'agent' || !!ntParentTaskId);
  if (agentTrigger) agentTrigger.setAttribute('aria-pressed', String(m === 'agent'));
  if (manualTrigger) manualTrigger.setAttribute('aria-pressed', String(m === 'manual'));
  ntUpdateSubmitState();
  if (document.getElementById('cv-newtask-overlay').style.display !== 'none') {
    document.getElementById(m === 'agent' ? 'cv-nt-prompt' : 'cv-nt-title').focus();
  }
}
function cvSubmitNewTask(keepOpen) {
  const fromAgent = ntMode === 'agent';
  let title, desc, assignee, priority, projectId, team, stagePlan, expertPlan, mode;
  if (fromAgent) {
    if (!ntDraftReady) { window.alert('请先输入一句话描述任务'); return; }
    if (document.getElementById('cv-nt-prompt').value.trim()) { ntSendDraftMessage(); return; }
    title = (document.getElementById('cv-nt-draft-title').value || '').trim();
    desc = (document.getElementById('cv-nt-draft-desc').value || '').trim();
  } else {
    title = (document.getElementById('cv-nt-title').value || '').trim();
    desc = (document.getElementById('cv-nt-desc').value || '').trim();
  }
  if (!ntProjectId) { window.alert('请先关联一个项目'); return; }
  if (!title) { window.alert('请输入任务标题'); return; }
  projectId = ntProjectId;
  team = TEAMS.find(t => t.id === ntTeamId) || TEAMS[0];
  const pv = document.getElementById('cv-nt-priority').value;
  priority = pv === '无优先级' ? '中' : pv;
  mode = ntExecMode;
  if (!['单人执行', '多人协作'].includes(mode)) { window.alert('请选择执行方式'); return; }
  if (!ntPeopleOfProject(projectId).length) { window.alert('请先为项目添加成员，再选择执行人'); return; }
  if (mode === '多人协作') {
    if (!ntExpertPlan.length) { window.alert('请先为专家团选择专家'); return; }
    const fallback = (ntExpertPlan.find(e => e.assignee) || {}).assignee || ntAssignee;
    if (!fallback) { window.alert('请至少为一位专家指定负责人'); return; }
    const pending = ntExpertPlan.filter(e => !e.assignee);
    if (pending.length) toast('还有 ' + pending.length + ' 位专家未指定负责人，将继承「' + fallback + '」', 'warning');
    expertPlan = ntExpertPlan.map(e => ({ id: e.id, name: (EX[e.id] || {}).name || e.id, lead: !!e.lead, modes: ((EX[e.id] || {}).modes || []).slice(), assignee: e.assignee || fallback }));
    stagePlan = ntDeriveStagePlan(team, expertPlan, fallback);
    // 任务详情的负责人代表当前环节的执行人，需与阶段分工保持一致。
    assignee = stagePlan[0]?.assignee || fallback;
  } else {
    if (!ntAssignee) { window.alert('请选择任务负责人'); return; }
    assignee = ntAssignee;
  }
  if (!stagePlan) stagePlan = tbTeamStages(team).map(s => ({ id: s.id, name: s.name, assignee }));
  const proj = CV_PROJECTS.find(p => p.id === projectId) || CV_PROJECTS[0];
  const stageActivity = expertPlan
    ? ('各专家负责人：' + expertPlan.map(e => e.name + '·' + e.assignee).join('、'))
    : ('各阶段执行人：' + stagePlan.map(s => s.name + '·' + s.assignee).join('、'));
  const parentTaskId = ntParentTaskId || document.getElementById('cv-nt-group')?.value || undefined;
  const parentIsGroup = !!parentTaskId && CV_TASKS.some(t => t.boardId === parentTaskId && t.project === proj.id && t.kind === 'epic');
  const t = { boardId: crypto.randomUUID(), kind: 'task', parentTaskId, source: fromAgent ? '一句话创建' : (parentTaskId ? (parentIsGroup ? '父任务下创建' : '父任务下推') : '手动创建'), sourceId: 'TASK-' + Date.now().toString().slice(-6), size: '小', exec: '专家团', collab: mode === '单人执行' ? '无需协作' : '人Agent协作', progress: 0, status: ntStatus, mode, stage: stagePlan ? stagePlan[0].id : undefined, stagePlan, expertPlan: expertPlan || null, team: ntTeamId, type: '需求', project: proj.id, title, desc, assignee, priority, tags: ntTags.slice(), files: ntFiles.slice(), activity: [{ author: '张工', text: fromAgent ? ('根据草稿创建任务，由 ' + assignee + ' 负责') : '创建了任务', time: new Date().toLocaleString('zh-CN', { hour12: false }) }].concat(stageActivity ? [{ author: '张工', text: stageActivity, time: new Date().toLocaleString('zh-CN', { hour12: false }) }] : []), artifacts: [] };
  CV_TASKS.unshift(t);
  tbSave(); renderTaskBoard(); cvUpdateCounts();
  if (parentTaskId) window.cvRenderProjectDetail && window.cvRenderProjectDetail();
  const reopenCtx = ntParentTaskId
    ? { parentTaskId: ntParentTaskId, projectId: proj.id, parentTitle: document.getElementById('cv-nt-parent-title')?.textContent }
    : { projectId: proj.id, groupId: parentIsGroup ? parentTaskId : '' };
  if (keepOpen) {
    cvOpenNewTask(ntStatus, reopenCtx);
    if (fromAgent) cvSetNewTaskMode('agent');
  } else { cvCloseNewTask(); }
  if (parentTaskId && !parentIsGroup && !keepOpen && window.tbReopenTask) window.tbReopenTask(parentTaskId);
}

export function initNewTask() {
  window.cvOpenNewTask = cvOpenNewTask;
  window.cvCloseNewTask = cvCloseNewTask;
  if (!document.getElementById('cv-newtask-overlay')) { console.error('[new-task] overlay 不存在，initNewTask 中止'); return; }
  try {
  document.querySelectorAll('#cv-newtask-overlay [data-nt-mode]').forEach(button => {
    button.addEventListener('click', () => cvSetNewTaskMode(button.getAttribute('data-nt-mode')));
  });
  document.getElementById('cv-nt-draft-send').addEventListener('click', ntSendDraftMessage);
  document.getElementById('cv-nt-prompt').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ntSendDraftMessage(); }
  });
  document.getElementById('cv-nt-submit').addEventListener('click', () => {
    const keepOpen = document.getElementById('cv-nt-continue-toggle')?.checked || false;
    cvSubmitNewTask(keepOpen);
  });
  document.getElementById('cv-nt-title').addEventListener('input', ntUpdateSubmitState);
  const draftTitle = document.getElementById('cv-nt-draft-title');
  if (draftTitle) draftTitle.addEventListener('input', ntUpdateSubmitState);
  document.getElementById('cv-newtask-overlay').addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      const keepOpen = document.getElementById('cv-nt-continue-toggle')?.checked || false;
      cvSubmitNewTask(keepOpen);
    }
    if (e.key === 'Escape') cvCloseNewTask();
  });
  const expandBtn = document.getElementById('cv-nt-expand');
  if (expandBtn) expandBtn.addEventListener('click', () => {
    document.getElementById('cv-newtask-overlay').classList.toggle('nt-fullscreen');
  });
  document.getElementById('cv-nt-project').addEventListener('change', ntOnProjectChange);
  const execMode = document.getElementById('cv-nt-exec-mode');
  if (execMode) execMode.addEventListener('click', e => {
    const b = e.target.closest('[data-nt-exec]');
    if (b) ntSetExecMode(b.getAttribute('data-nt-exec'));
  });
  if (execMode) execMode.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    const options = Array.from(execMode.querySelectorAll('[data-nt-exec]'));
    const current = options.indexOf(document.activeElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (current + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : options.length - 1)) % options.length;
    e.preventDefault();
    options[next].focus();
    ntSetExecMode(options[next].getAttribute('data-nt-exec'));
  });
  const expertList = document.getElementById('cv-nt-expert-list');
  if (expertList) {
    expertList.addEventListener('change', e => {
      const sel = e.target.closest('[data-nt-expert-assignee]');
      if (!sel) return;
      const item = ntExpertPlan.find(x => x.id === sel.getAttribute('data-nt-expert-assignee'));
      if (!item) return;
      item.assignee = sel.value;
      sel.closest('.nt-expert-row')?.classList.toggle('is-unassigned', !item.assignee);
      const count = document.getElementById('cv-nt-expert-count');
      if (count) count.textContent = ntExpertPlan.filter(x => x.assignee).length + ' / ' + ntExpertPlan.length;
    });
  }
  const expertAuto = document.getElementById('cv-nt-expert-auto');
  if (expertAuto) expertAuto.addEventListener('click', ntAutoAssignExperts);
  const teamSelect = document.getElementById('cv-nt-team');
  if (teamSelect) teamSelect.addEventListener('change', () => {
    ntTeamId = teamSelect.value;
    ntExpertPlan = [];
    if (ntExecMode === '多人协作') ntRenderExperts();
  });
  const attachDrop = document.getElementById('cv-nt-file-list');
  if (attachDrop) {
    attachDrop.addEventListener('click', e => { if (e.target.closest('[data-nt-attach-trigger]')) ntAddFile(); });
    attachDrop.addEventListener('dragover', e => { e.preventDefault(); attachDrop.classList.add('is-dragover'); });
    attachDrop.addEventListener('dragleave', () => attachDrop.classList.remove('is-dragover'));
    attachDrop.addEventListener('drop', e => {
      e.preventDefault(); attachDrop.classList.remove('is-dragover');
      Array.from(e.dataTransfer?.files || []).forEach(f => ntFiles.push(f.name));
      ntRenderFiles();
    });
  }
  const tagsTrigger = document.getElementById('cv-nt-tags-trigger');
  console.log('[new-task] tagsTrigger 元素:', tagsTrigger ? '存在' : '不存在');
  if (tagsTrigger) {
    tagsTrigger.addEventListener('click', function(e) {
      console.log('[new-task] 标签触发器被点击');
      if (e.target.closest('[data-nt-label-remove]')) {
        var name = e.target.closest('[data-nt-label-remove]').getAttribute('data-nt-label-remove');
        ntTags = ntTags.filter(function(t) { return t !== name; });
        ntRenderTags();
        return;
      }
      ntOpenLabelPicker();
    });
    tagsTrigger.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ntOpenLabelPicker(); }
    });
  }
  document.getElementById('cv-nt-addtag')?.addEventListener('click', function() {
    var _mb = document.getElementById('cv-nt-more-trigger'); var _mp = document.getElementById('cv-nt-more-body'); if (_mb) _mb.setAttribute('aria-expanded', 'true'); if (_mp) _mp.hidden = false;
    ntOpenLabelPicker();
  });
  document.addEventListener('click', function(e) {
    if (ntLabelMenu && !ntLabelMenu.contains(e.target) && !tagsTrigger?.contains(e.target) && !e.target.closest('#cv-nt-addtag')) ntCloseLabelPicker();
  });
  /* 三点「更多设置」面板：点击切换 + 外部点击关闭（对齐 Multica DropdownMenu 行为） */
  (function () {
    var moreBox = document.getElementById('cv-nt-more');
    var moreBtn = document.getElementById('cv-nt-more-trigger');
    var morePanel = document.getElementById('cv-nt-more-body');
    if (!moreBtn || !morePanel) return;
    function toggleMore(open) {
      var isOpen = moreBtn.getAttribute('aria-expanded') === 'true';
      var next = open == null ? !isOpen : open;
      moreBtn.setAttribute('aria-expanded', String(next));
      morePanel.hidden = !next;
    }
    moreBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleMore(); });
    document.addEventListener('click', function (e) {
      if (moreBtn.getAttribute('aria-expanded') !== 'true') return;
      if (!moreBox.contains(e.target)) toggleMore(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && moreBtn.getAttribute('aria-expanded') === 'true') toggleMore(false);
    });
  })();
  document.getElementById('cv-nt-attach-trigger')?.addEventListener('click', ntAddFile);
  const peopleBtn = document.getElementById('cv-nt-people-btn');
  const peopleMenu = document.getElementById('cv-nt-people-menu');
  if (peopleBtn) {
    peopleBtn.addEventListener('click', function(e){ e.stopPropagation(); if(peopleMenu) peopleMenu.hidden = !peopleMenu.hidden; });
    peopleMenu?.addEventListener('click', function(e){
      var item = e.target.closest('[data-person]'); if (!item) return;
      ntAssignee = item.getAttribute('data-person');
      ntRenderPeople();
      peopleMenu.hidden = true;
    });
    document.addEventListener('click', function(e){ if (peopleMenu && !peopleMenu.hidden && !peopleBtn.contains(e.target) && !peopleMenu.contains(e.target)) peopleMenu.hidden = true; });
  }
  const fileList = document.getElementById('cv-nt-file-list');
  if (fileList) fileList.addEventListener('click', e => { const x = e.target.closest('[data-nt-file]'); if (x) { ntFiles.splice(+x.getAttribute('data-nt-file'), 1); ntRenderFiles(); } });
  console.log('[new-task] initNewTask 标签绑定完成');
  } catch(e) { console.error('[initNewTask] 执行中断:', e.message, e.stack); }
}
