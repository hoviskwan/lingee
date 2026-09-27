import { showView, setUrlState, setNavActive } from '../../core/view.js';
import { CV_PROJECTS, CV_WORKSPACES } from '../collab/data.js';
import { tkGetTasks, tkGetStatusName, tkGetPriorityName, tkGetPerson, tkCanViewTask } from '../tasks-v2/data.js';
import { openTaskDetail } from '../tasks-v2/index.js';
import { inboxItems as allInboxItems, inboxPersist, inboxAddFromTaskChange, inboxAddTaskStageStartedNotice } from './data.js';

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const labels = {
  agent_started:'智能体已启动',
  review_requested:'请求审核', agent_completed:'智能体已完成', agent_blocked:'智能体已阻塞',
  task_failed:'任务执行失败', task_completed:'任务已完成', new_comment:'新评论', mentioned:'提到了你',
  issue_assigned:'分配给你', assignee_changed:'负责人已变更', status_changed:'状态已变更',
  priority_changed:'优先级已变更', due_date_changed:'截止日期已变更',
  quick_create_done:'通过智能体创建', quick_create_failed:'通过智能体创建失败', autopilot_paused:'自动化已暂停',
};
const initialLocation = {path:location.pathname,search:location.search};
let archived = false;
let selected = '';
let menuKey = '';
let panelTab = 'all';
const filters = {unread:false,status:'',priority:'',actor:''};
const inboxItems = () => allInboxItems().filter((item) => !item.issue_id || tkCanViewTask(tkGetTasks().find((task) => String(task.id) === String(item.issue_id))));
const taskOf = (item) => tkGetTasks().find((task) => String(task.id) === String(item.issue_id));
const projectOf = (task) => CV_PROJECTS.find((project) => project.id === task?.project);
const relative = (date) => {
  const minutes = Math.max(0,Math.floor((Date.now()-new Date(date).getTime())/60000));
  return minutes < 1 ? '刚刚' : minutes < 60 ? `${minutes} 分钟` : minutes < 1440 ? `${Math.floor(minutes/60)} 小时` : `${Math.floor(minutes/1440)} 天`;
};
const time = (date) => new Date(date).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
function visibleGroups() {
  const all = inboxItems().filter((item) => item.archived === archived).sort((a,b) => b.created_at.localeCompare(a.created_at));
  const groups = new Map();
  all.forEach((item) => {
    const key = item.issue_id ? `issue:${item.workspace_id}:${item.issue_id}` : `notice:${item.id}`;
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(item);
  });
  return [...groups.entries()].map(([key,items]) => ({key,items,item:items[0]})).filter(({item,items}) => {
    if (filters.unread && !items.some((row) => !row.read)) return false;
    if (filters.status && item.issue_status !== filters.status) return false;
    if (filters.priority && item.issue_priority !== filters.priority) return false;
    if (filters.actor && !items.some((row) => row.actor_id === filters.actor)) return false;
    return true;
  });
}
function updateUrl() {
  if ($('#view-inbox').classList.contains('hidden')) return;
  const params = new URLSearchParams();
  if (archived) params.set('view','archived');
  if (selected) params.set('issue',selected.startsWith('issue:') ? selected.split(':').at(-1) : selected);
  setUrlState('/inbox'+(params.size ? '?'+params.toString() : ''));
}
function renderFilters() {
  const status = $('#inboxStatusFilter'), priority = $('#inboxPriorityFilter'), actor = $('#inboxActorFilter');
  status.innerHTML = '<option value="">全部状态</option>' + [...new Set(inboxItems().map((item) => item.issue_status).filter(Boolean))].map((id) => `<option value="${esc(id)}">${esc(tkGetStatusName(id))}</option>`).join('');
  priority.innerHTML = '<option value="">全部优先级</option>' + [...new Set(inboxItems().map((item) => item.issue_priority).filter(Boolean))].map((id) => `<option value="${esc(id)}">${esc(tkGetPriorityName(id))}</option>`).join('');
  actor.innerHTML = '<option value="">全部发起人</option>' + [...new Set(inboxItems().map((item) => item.actor_id).filter(Boolean))].map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  status.value = filters.status; priority.value = filters.priority; actor.value = filters.actor;
}
function renderList() {
  const groups = visibleGroups();
  if (selected && !groups.some((group) => group.key === selected)) selected = '';
  if (!selected && groups.length) selected = groups[0].key;
  $('#inboxListHeading').textContent = archived ? '已归档' : '收件箱';
  $('#inboxBack').hidden = !archived;
  $('#inboxArchiveLink').hidden = archived;
  const archivedCount = new Set(inboxItems().filter((item) => item.archived).map((item) => item.issue_id || item.id)).size;
  $('#inboxArchiveCount').textContent = archivedCount || '';
  const unreadCount = new Set(inboxItems().filter((item) => !item.archived && !item.read).map((item) => item.issue_id || item.id)).size;
  $('#inboxUnreadCount').textContent = unreadCount || '';
  const badge = $('#inboxBellBadge');
  badge.textContent = unreadCount > 99 ? '99+' : unreadCount || '';
  badge.hidden = !unreadCount;
  $('#notificationBell').classList.toggle('has-unread', !!unreadCount);
  $('#inboxList').innerHTML = groups.length ? groups.map(({key,item,items}) => {
    const unread = !archived && items.some((row) => !row.read);
    const task = taskOf(item), project = projectOf(task);
    const workspace = CV_WORKSPACES.find((row) => row.id === item.workspace_id);
    const actor = item.actor_id || '系统';
    return `<div class="inbox-row ${key===selected?'selected':''} ${unread?'unread':''}" role="option" tabindex="0" aria-selected="${key===selected}" data-key="${esc(key)}">
      <span class="inbox-avatar ${item.actor_type==='agent'?'agent':''}">${esc(actor.slice(0,1))}</span>
      <span class="inbox-row-main"><span class="inbox-row-title">${unread?'<i class="inbox-unread-dot"></i>':''}${esc(item.title)}</span>
      <span class="inbox-row-sub"><span class="inbox-status-dot ${esc(item.issue_status || 'system')}"></span>${esc(labels[item.type] || '通知')} · ${esc(actor)}</span>
      <span class="inbox-row-context">${esc(workspace?.name || '')}${project?' · '+esc(project.name):''}</span></span>
      <span class="inbox-row-end"><time>${esc(relative(item.created_at))}</time><button type="button" class="inbox-row-archive" data-action="${archived?'restore':'archive'}" data-key="${esc(key)}" title="${archived?'恢复':'归档'}" aria-label="${archived?'恢复':'归档'}">${archived?'↺':'▣'}</button></span>
    </div>`;
  }).join('') : `<div class="inbox-empty-list">${archived?'没有已归档通知':'没有符合条件的通知'}</div>`;
  renderDetail();
}
function renderDetail() {
  const group = visibleGroups().find((row) => row.key === selected);
  if (!group) { $('#inboxDetail').innerHTML = '<div class="inbox-detail-empty"><span>▣</span><p>选择一条通知查看详情</p></div>'; return; }
  const {item,items} = group;
  const task = taskOf(item), project = projectOf(task);
  const workspace = CV_WORKSPACES.find((row) => row.id === item.workspace_id);
  const status = task?.status || item.issue_status;
  $('#inboxDetail').innerHTML = `<div class="inbox-detail-top">
    <span>${esc(workspace?.name || '系统通知')}${project?' / '+esc(project.name):''}</span>
    <div><button type="button" class="inbox-text-action" data-detail-action="read">${items.every((row) => row.read)?'标为未读':'标为已读'}</button>
    <button type="button" class="inbox-icon-btn" data-detail-action="${archived?'restore':'archive'}" title="${archived?'恢复':'归档'}">${archived?'↺':'▣'}</button></div>
  </div><div class="inbox-detail-scroll"><div class="inbox-detail-content">
    <div class="inbox-detail-kicker">${esc(task?.code || '系统通知')}</div>
    <h1>${esc(task?.title || item.title)}</h1>
    ${task ? `<div class="inbox-properties"><span><i class="inbox-status-dot ${esc(status)}"></i>${esc(tkGetStatusName(status))}</span><span>优先级 · ${esc(tkGetPriorityName(task.priority))}</span><span>负责人 · ${esc(tkGetPerson(task.assignee).name)}</span>${task.dueDate?`<span>截止 · ${esc(task.dueDate)}</span>`:''}</div>
    <p class="inbox-task-description">${esc(task.desc || task.description || '暂无描述')}</p>
    <button type="button" class="inbox-open-task" data-detail-action="open">打开任务详情 ↗</button>` : ''}
    <div class="inbox-activity-title">通知动态 <span>${items.length}</span></div>
    <div class="inbox-activity">${items.map((entry) => `<article class="inbox-activity-item"><span class="inbox-avatar ${entry.actor_type==='agent'?'agent':''}">${esc((entry.actor_id || '系').slice(0,1))}</span><div><div class="inbox-activity-line"><b>${esc(entry.actor_id || '系统')}</b><span>${esc(labels[entry.type] || '通知')}</span><time>${esc(time(entry.created_at))}</time></div><p>${esc(entry.body)}</p></div></article>`).join('')}</div>
  </div></div>`;
}
function renderPanel() {
  const panel = $('#inboxPopup');
  if (!panel) return;
  const all = inboxItems().filter((item) => !item.archived).sort((a,b) => b.created_at.localeCompare(a.created_at));
  const items = panelTab === 'unread' ? all.filter((item) => !item.read) : all;
  panel.querySelector('#inboxPopupList').innerHTML = items.length ? items.map((item) =>
    `<button type="button" class="inbox-popup-item${item.read?'':' unread'}" data-notice-id="${esc(item.id)}">
      <span class="inbox-avatar ${item.actor_type==='agent'?'agent':''}">${esc((item.actor_id || '系').slice(0,1))}</span>
      <span class="inbox-popup-content"><strong>${esc(item.title)}</strong><span>${esc(item.body)}</span><small>${esc(labels[item.type] || '通知')} · ${esc(relative(item.created_at))}</small></span>
      ${item.read?'':'<i class="inbox-popup-dot" aria-label="未读"></i>'}
    </button>`).join('') : '<div class="inbox-popup-empty">暂无通知</div>';
  panel.querySelectorAll('[data-popup-tab]').forEach((button) => {
    const active = button.dataset.popupTab === panelTab;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
  });
}
function positionPanel() {
  const panel = $('#inboxPopup'), rect = $('#notificationBell').getBoundingClientRect();
  panel.style.left = Math.max(8,Math.min(rect.right + 10,window.innerWidth - panel.offsetWidth - 8)) + 'px';
  panel.style.bottom = Math.max(8,window.innerHeight - rect.bottom) + 'px';
}
function openPanel() {
  const panel = $('#inboxPopup');
  panel.hidden = false;
  $('#notificationBell').setAttribute('aria-expanded','true');
  renderPanel();
  positionPanel();
}
function closePanel() {
  $('#inboxPopup').hidden = true;
  $('#notificationBell').setAttribute('aria-expanded','false');
}
function renderInbox() { renderFilters(); renderList(); renderPanel(); updateUrl(); }
function select(key) {
  selected = key;
  const group = visibleGroups().find((row) => row.key === key);
  if (group && !archived) { group.items.forEach((row) => { row.read = true; }); inboxPersist(); }
  renderInbox();
}
function act(key,action) {
  const group = visibleGroups().find((row) => row.key === key);
  if (!group) return;
  const markRead = !group.items.every((item) => item.read);
  group.items.forEach((row) => { if (action==='archive') row.archived=true; if (action==='restore') row.archived=false; if (action==='read') row.read=markRead; });
  inboxPersist();
  renderInbox();
}
export function initInbox() {
  const bell = $('#notificationBell');
  bell.insertAdjacentHTML('beforeend','<span class="inbox-bell-badge" id="inboxBellBadge" hidden></span>');
  bell.setAttribute('aria-haspopup','dialog');
  bell.setAttribute('aria-expanded','false');
  document.body.insertAdjacentHTML('beforeend','<section class="inbox-popup" id="inboxPopup" role="dialog" aria-label="收件箱" hidden><div class="inbox-popup-head"><strong>收件箱</strong><button type="button" id="inboxPopupReadAll">全部已读</button></div><div class="inbox-popup-tabs" role="tablist"><button type="button" data-popup-tab="all" role="tab">全部</button><button type="button" data-popup-tab="unread" role="tab">未读</button></div><div class="inbox-popup-list" id="inboxPopupList"></div></section>');
  bell.addEventListener('click',() => { if ($('#inboxPopup').hidden) openPanel(); else closePanel(); });
  $('#inboxPopup').addEventListener('click',(event) => {
    const tab = event.target.closest('[data-popup-tab]');
    if (tab) { panelTab=tab.dataset.popupTab; renderPanel(); return; }
    if (event.target.closest('#inboxPopupReadAll')) { inboxItems().forEach((item) => { if (!item.archived) item.read=true; }); inboxPersist(); renderInbox(); return; }
    const row = event.target.closest('[data-notice-id]');
    if (!row) return;
    const item = inboxItems().find((entry) => entry.id === row.dataset.noticeId);
    if (!item) return;
    item.read = true;
    inboxPersist();
    closePanel();
    renderInbox();
    if (item.issue_id && taskOf(item)) { showView('tasks'); setNavActive('任务'); openTaskDetail(item.issue_id); }
  });
  document.addEventListener('click',(event) => { if (!event.target.closest('#inboxPopup, #notificationBell') && !$('#inboxPopup').hidden) closePanel(); });
  document.addEventListener('keydown',(event) => { if (event.key==='Escape' && !$('#inboxPopup').hidden) { closePanel(); bell.focus(); } });
  window.addEventListener('resize',() => { if (!$('#inboxPopup').hidden) positionPanel(); });
  const params = new URLSearchParams(initialLocation.search);
  if (initialLocation.path.endsWith('/inbox')) {
    archived=params.get('view')==='archived';
    const issue=params.get('issue');
    if (issue) selected=inboxItems().find((item) => String(item.issue_id)===issue)?.issue_id ? `issue:${inboxItems().find((item) => String(item.issue_id)===issue).workspace_id}:${issue}` : issue;
  }
  $('#inboxArchiveLink').addEventListener('click',() => { archived=true; selected=''; renderInbox(); });
  $('#inboxBack').addEventListener('click',() => { archived=false; selected=''; renderInbox(); });
  $('#inboxFilterButton').addEventListener('click',() => { const el=$('#inboxFilters'); el.hidden=!el.hidden; $('#inboxFilterButton').setAttribute('aria-expanded',String(!el.hidden)); });
  $('#inboxBulkButton').addEventListener('click',() => { const el=$('#inboxBulkMenu'); el.hidden=!el.hidden; $('#inboxBulkButton').setAttribute('aria-expanded',String(!el.hidden)); });
  $('#inboxBulkMenu').addEventListener('click',(event) => {
    const action=event.target.closest('[data-bulk]')?.dataset.bulk; if (!action) return;
    inboxItems().filter((item) => !item.archived).forEach((item) => {
      if (action==='read') item.read=true;
      if (action==='archive-read' && item.read) item.archived=true;
      if (action==='archive-done' && item.issue_status==='done') item.archived=true;
      if (action==='archive-all') item.archived=true;
    });
    $('#inboxBulkMenu').hidden=true; inboxPersist(); renderInbox();
  });
  $('#inboxList').addEventListener('click',(event) => { const button=event.target.closest('[data-action]'); if (button) { act(button.dataset.key,button.dataset.action); return; } const row=event.target.closest('[data-key]'); if (row) select(row.dataset.key); });
  $('#inboxList').addEventListener('contextmenu',(event) => {
    const row=event.target.closest('.inbox-row'); if (!row) return;
    event.preventDefault(); menuKey=row.dataset.key;
    const menu=$('#inboxRowMenu');
    menu.querySelector('[data-row-action="read"]').textContent=visibleGroups().find((group) => group.key===menuKey)?.items.every((item) => item.read) ? '标为未读' : '标为已读';
    menu.querySelector('[data-row-action="archive"]').textContent=archived ? '取消归档' : '归档';
    menu.style.left=Math.max(6,Math.min(event.clientX-$('#inboxList').getBoundingClientRect().left,100))+'px';
    menu.style.top=Math.max(48,event.clientY-$('#inboxListPane').getBoundingClientRect().top)+'px';
    menu.hidden=false;
  });
  $('#inboxRowMenu').addEventListener('click',(event) => { const action=event.target.closest('[data-row-action]')?.dataset.rowAction; if (!action) return; $('#inboxRowMenu').hidden=true; act(menuKey,action==='archive'&&archived?'restore':action); });
  document.addEventListener('click',(event) => { if (!event.target.closest('#inboxRowMenu')) $('#inboxRowMenu').hidden=true; });
  $('#inboxList').addEventListener('keydown',(event) => {
    const row=event.target.closest('.inbox-row'); if (!row) return;
    if (event.key==='Enter' || event.key===' ') {event.preventDefault();select(row.dataset.key);return;}
    if (event.key==='ArrowDown' || event.key==='ArrowUp') {event.preventDefault();const rows=[...$('#inboxList').querySelectorAll('.inbox-row')];rows[Math.max(0,Math.min(rows.length-1,rows.indexOf(row)+(event.key==='ArrowDown'?1:-1)))]?.focus();}
  });
  $('#inboxDetail').addEventListener('click',(event) => {
    const action=event.target.closest('[data-detail-action]')?.dataset.detailAction; if (!action) return;
    if (action==='open') { const item=visibleGroups().find((row) => row.key===selected)?.item; if (item?.issue_id) { showView('tasks'); setNavActive('任务'); openTaskDetail(item.issue_id); } }
    else act(selected,action);
  });
  [['#inboxUnreadOnly','unread'],['#inboxStatusFilter','status'],['#inboxPriorityFilter','priority'],['#inboxActorFilter','actor']].forEach(([selector,key]) => $(selector).addEventListener('change',(event) => {filters[key]=key==='unread'?event.target.checked:event.target.value; selected='';renderInbox();}));
  document.addEventListener('lingee:task-updated',(event) => { if (inboxAddFromTaskChange(event.detail)) renderInbox(); });
  document.addEventListener('lingee:auth-changed', renderInbox);
  document.addEventListener('lingee:task-stage-started-notice',(event) => {
    inboxAddTaskStageStartedNotice(event.detail.taskId,event.detail.stageId);
    renderInbox();
  });
  renderInbox();
}
