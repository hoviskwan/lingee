/* T00 结构拆分：list。保留原交互；事件在 init* 中按原顺序注册。 */
import { taskViewState, els, LIST_FIELDS, DEFAULT_LIST_FIELD_ORDER } from './ui-state.js';
import { tkGetViews, tkGetTasks, TK_PEOPLE, tkProjectsForCurrentUser, tkDeleteTask, tkAddTask, tkCurrentUserId, tkCanStartTask, tkCanViewTask, tkParticipatesCurrentUser, tkWasTaskHandler, TK_STATUSES, tkGetPerson, tkGetProjectName, TK_PRIORITIES, tkGetPriorityObj, TK_FILTER_FIELDS, TK_OPERATORS, tkSyncPeople, tkPeopleInProject, TK_LABELS, tkAddView, tkUpdateTask, tkDeleteView, tkRenameView, TK_PROJECTS, tkGetStatusObj } from './data.js';
import { TEAMS } from '../expert/store.js';
import { AV_KEYS, EX, EXPERTS, xav } from '../expert/data.js';
import { createDeliveryActivity } from '../collab/delivery-activity.js';
import { taskStartLegacy, TASK_START_CHAT_ICON, TASK_START_PLAY_ICON, closeDrawer, openTaskConversationWithTask, openDrawer, syncDrawerClickaway } from './issue-detail.js';
import { priWeight, isOverdue, escapeHtml, stClass, priClass, avatarSm, fmtDate, positionPopover, filterAssigneeOptions, chooseFirstAssignee } from './ui-utils.js';
import { taskListVisibleColumnCount, applyTaskListFieldSettings } from './list-template.js';
import { renderListPageTabs } from '../shared/list-page-tabs.js';
import { $$ } from '../../core/dom.js';
import { toast } from '../../core/toast.js';
import { openTaskModal, refreshFormAssignees } from './create.js';
import { scheduleTaskStageStartedNotice, startTaskStage } from './task-execution.js';

var projectListMode = false;

var projectListProjectId = '';

var layoutBeforeProjectList = null;
var viewBeforeProjectList = null;

var collapsedParents = new Set();

var VIEW_STATE_STORAGE_KEY = 'lingee_tasks_view_state';
var CARD_PROP_REV = 2; /* 与 index.js 保持同值：卡片显示属性默认值版本 */

function persistViewState() {
  try {
    localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify({
      activeViewId:projectListMode ? viewBeforeProjectList?.activeViewId : taskViewState.activeViewId,
      layout:projectListMode ? layoutBeforeProjectList : taskViewState.layout,
      viewMode:projectListMode ? viewBeforeProjectList?.viewMode : taskViewState.viewMode,
      groupBy:taskViewState.groupBy,
      sortBy:taskViewState.sortBy,
      sortDir:taskViewState.sortDir,
      filters:projectListMode ? viewBeforeProjectList?.filters : taskViewState.filters,
      showSubtasks:taskViewState.showSubtasks,
      collapsedTaskIds:Array.from(collapsedParents),
      collapsedBoardGroups:Array.from(taskViewState.collapsedBoardGroups),
      cardProperties:taskViewState.cardProperties,
      cardPropRev:CARD_PROP_REV,
      listFieldOrder:taskViewState.listFieldOrder,
      listFieldVisibility:taskViewState.listFieldVisibility,
    }));
  } catch (e) { /* 本地存储不可用时仍可在当前页面切换视图 */ }
}

function restoreViewState() {
  var saved;
  try { saved = JSON.parse(localStorage.getItem(VIEW_STATE_STORAGE_KEY) || 'null'); }
  catch (e) { return; }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
  var view = tkGetViews().find(function (v) { return v.id === saved.activeViewId; });
  if (saved.activeViewId && !view) return;
  taskViewState.activeViewId = view ? view.id : 'all';
  taskViewState.scope = view && ['all','members','agents','my_assigned','my_created'].includes(view.scope) ? view.scope : 'all';
  if (['board','list'].includes(saved.layout)) taskViewState.layout = saved.layout;
  if (['slide','full','split'].includes(saved.viewMode)) taskViewState.viewMode = saved.viewMode;
  if (['status','priority','assignee','project','none'].includes(saved.groupBy)) taskViewState.groupBy = saved.groupBy;
  if (['status','priority','dueDate','createDate','updatedAt','title','module','code','assignee','project'].includes(saved.sortBy)) taskViewState.sortBy = saved.sortBy;
  if (['asc','desc'].includes(saved.sortDir)) taskViewState.sortDir = saved.sortDir;
  if (typeof saved.showSubtasks === 'boolean') taskViewState.showSubtasks = saved.showSubtasks;
  if (Array.isArray(saved.collapsedTaskIds)) {
    var taskIds = new Set(tkGetTasks().map(function (t) { return t.id; }));
    collapsedParents = new Set(saved.collapsedTaskIds.filter(function (id) {
      return Number.isInteger(id) && taskIds.has(id);
    }));
  }
  if (saved.cardProperties && typeof saved.cardProperties === 'object') {
    Object.keys(taskViewState.cardProperties).forEach(function (key) {
      if (typeof saved.cardProperties[key] === 'boolean') taskViewState.cardProperties[key] = saved.cardProperties[key];
    });
  }
  if (saved.cardPropRev !== CARD_PROP_REV) {
    /* v2：卡片项目名改默认不显示，旧存量配置一次性回落新默认；此后用户显式开启仍被尊重 */
    taskViewState.cardProperties.project = false;
  }
  if (Array.isArray(saved.listFieldOrder)) {
    taskViewState.listFieldOrder = Array.from(new Set(saved.listFieldOrder.filter(function(id) { return DEFAULT_LIST_FIELD_ORDER.includes(id); }))).concat(DEFAULT_LIST_FIELD_ORDER.filter(function(id) { return !saved.listFieldOrder.includes(id); }));
  }
  if (saved.listFieldVisibility && typeof saved.listFieldVisibility === 'object') {
    LIST_FIELDS.forEach(function(field) {
      if (!field.required && typeof saved.listFieldVisibility[field.id] === 'boolean') taskViewState.listFieldVisibility[field.id] = saved.listFieldVisibility[field.id];
    });
  }
  if (Array.isArray(saved.filters)) {
    var fields = ['status','priority','dueDate','assignee','creator','project','label','keyword'];
    var operators = ['eq','neq','contains','not_contains','today','overdue','before','after'];
    taskViewState.filters = saved.filters.slice(0, 30).filter(function (f) {
      return f && fields.includes(f.field) && operators.includes(f.op) && typeof f.value === 'string';
    }).map(function (f) { return { field:f.field, op:f.op, value:f.value }; }).filter(function (f) {
      if (f.field === 'assignee' || f.field === 'creator') return TK_PEOPLE.some(function (person) { return person.id === f.value; });
      return f.field !== 'project' || tkProjectsForCurrentUser().some(function (project) { return project.id === f.value; });
    });
  }
}

function showCardMenu(taskId, anchorEl, detailOnly) {
  document.querySelectorAll('.tk-card-menu').forEach(function(m){m.remove();});
  var menu = document.createElement('div');
  menu.className = 'tk-card-menu' + (detailOnly ? ' tk-drawer-more-menu' : '') + ' show';
  var itemSvg = {
    chat: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    subtask: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    delete: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
  };
  menu.innerHTML = ''
    + (detailOnly || !tkCanStartTask(tkGetTasks().find(function (task) { return task.id === Number(taskId); })) ? '' : '<div class="tk-card-menu-item" data-card-task="' + taskId + '" data-card-action="chat">' + (taskStartLegacy ? TASK_START_CHAT_ICON : TASK_START_PLAY_ICON) + '<span>' + (taskStartLegacy ? '发起会话' : '开始任务') + '</span></div>')
    + (detailOnly ? '' : '<div class="tk-card-menu-item" data-card-task="' + taskId + '" data-card-action="subtask">' + itemSvg.subtask + '<span>创建子任务</span></div>')
    + '<div class="tk-card-menu-item" data-card-task="' + taskId + '" data-card-action="copy">' + itemSvg.copy + '<span>复制</span></div>'
    + '<div class="tk-card-menu-item danger" data-card-task="' + taskId + '" data-card-action="delete">' + itemSvg.delete + '<span>删除</span></div>';
  document.body.appendChild(menu);
  menu.querySelectorAll('[data-card-action]').forEach(function(item) {
    item.addEventListener('click', function() {
      var act = item.getAttribute('data-card-action');
      var aid = parseInt(item.getAttribute('data-card-task'), 10);
      if (detailOnly && act === 'delete' && taskViewState.drawerTaskId === aid) closeDrawer();
      handleCardAction(act, aid);
      document.querySelectorAll('.tk-card-menu').forEach(function(m){m.remove();});
      if (detailOnly) els.tkDrawerMore.setAttribute('aria-expanded', 'false');
    });
  });
  var rect = anchorEl.getBoundingClientRect();
  var top = rect.bottom + 4;
  var left = rect.right - menu.offsetWidth;
  if (left < 8) left = 8;
  if (top + menu.offsetHeight > window.innerHeight) top = rect.top - menu.offsetHeight - 4;
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
}

function startTaskExec(taskId) {
  var task = tkGetTasks().find(function(t) { return t.id === taskId; });
  if (!task) return;
  var started = startTaskStage(task);
  if (!started.ok) { if (started.message) toast(started.message,'warning'); else openDrawer(taskId); return; }
  scheduleTaskStageStartedNotice(taskId, started.stage?.id);
  render();
  openTaskConversationWithTask(taskId, true);
  toast('已进入' + (started.stage?.name || '当前节点') + '，会话已发起并运行中','success');
}

function handleCardAction(act, aid) {
  if (act === 'chat') { startTaskExec(aid); }
  else if (act === 'edit') { openDrawer(aid); }
  else if (act === 'delete') { tkDeleteTask(aid); render(); toast('删除成功', 'success'); }
  else if (act === 'copy') {
    var src = tkGetTasks().find(function(x){return x.id===aid;});
    if (src) { tkAddTask(Object.assign({}, src, {labels:(src.labels||[]).slice(), createDate:new Date().toISOString().slice(0,10)})); render(); toast('复制成功', 'success'); }
  }
  else if (act === 'subtask') {
    var parent = tkGetTasks().find(function(x){return x.id===aid;});
    if (parent) {
      tkAddTask({ title: parent.title + ' - 子任务', desc:'', status:'backlog', priority: parent.priority || 'medium',
        assignee: parent.assignee || tkCurrentUserId(), project: parent.project || tkProjectsForCurrentUser()[0]?.id || '',
        labels:(parent.labels||[]).slice(), dueDate:'', createDate:new Date().toISOString().slice(0,10),
        parentId: parent.id });
      render();
      toast('创建成功', 'success');
    }
  }
}

function getFilteredTasks(skipField) {
  var tasks = tkGetTasks();
  tasks = tasks.filter(tkCanViewTask);
  if (projectListMode && projectListProjectId) tasks = tasks.filter(function (task) { return task.project === projectListProjectId; });
  if (skipField !== 'assignee' && !taskViewState.filters.some(function (f) { return f.field === 'assignee'; })) tasks = tasks.filter(tkParticipatesCurrentUser);
  var scope = taskViewState.scope;
  if (scope === 'members') tasks = tasks.filter(function (t) { return !t.assignee || t.assignee.charAt(0) !== 'a'; });
  else if (scope === 'agents') tasks = tasks.filter(function (t) { return t.assignee && t.assignee.charAt(0) === 'a'; });
  else if (scope === 'my_assigned') tasks = tasks.filter(tkWasTaskHandler);
  else if (scope === 'my_created') tasks = tasks.filter(function (t) { return t.createdBy === tkCurrentUserId(); });
  if (taskViewState.search) {
    var q = taskViewState.search.toLowerCase();
    tasks = tasks.filter(function (t) {
      return t.title.toLowerCase().indexOf(q) >= 0 || t.code.toLowerCase().indexOf(q) >= 0 || (t.desc && t.desc.toLowerCase().indexOf(q) >= 0);
    });
  }
  if (!taskViewState.showSubtasks) tasks = tasks.filter(function (t) { return !t.parentId; });
  var fields = [...new Set(taskViewState.filters.map(function (f) { return f.field; }).filter(function (field) { return field !== skipField; }))];
  fields.forEach(function (field) {
    var choices = taskViewState.filters.filter(function (f) { return f.field === field; });
    tasks = tasks.filter(function (t) { return choices.some(function (f) { return matchFilter(t, f); }); });
  });
  return tasks.slice().sort(function (a, b) {
    var sortKey = taskViewState.sortDir === 'none' ? 'updatedAt' : taskViewState.sortBy;
    var sortDir = taskViewState.sortDir === 'none' ? 'desc' : taskViewState.sortDir;
    var va, vb;
    switch (sortKey) {
      case 'priority': va = priWeight(a.priority); vb = priWeight(b.priority); break;
      case 'dueDate': va = a.dueDate || '9999'; vb = b.dueDate || '9999'; break;
      case 'createDate': va = a.createDate || ''; vb = b.createDate || ''; break;
      case 'updatedAt': va = a.updatedAt || ''; vb = b.updatedAt || ''; break;
      case 'status': va = TK_STATUSES.findIndex(function (s) { return s.id === a.status; }); vb = TK_STATUSES.findIndex(function (s) { return s.id === b.status; }); break;
      case 'code': va = a.code; vb = b.code; break;
      case 'title': va = a.title; vb = b.title; break;
      case 'module': va = a.module || ''; vb = b.module || ''; break;
      case 'assignee': va = tkGetPerson(a.assignee).name; vb = tkGetPerson(b.assignee).name; break;
      case 'project': va = tkGetProjectName(a.project); vb = tkGetProjectName(b.project); break;
      default: va = 0; vb = 0;
    }
    if (va === vb) {
      var ia = typeof a.id === 'number' ? a.id : 0;
      var ib = typeof b.id === 'number' ? b.id : 0;
      return sortDir === 'asc' ? ia - ib : ib - ia;
    }
    return va < vb ? (sortDir === 'asc' ? -1 : 1) : (sortDir === 'asc' ? 1 : -1);
  });
}

function matchFilter(task, filter) {
  var field = filter.field, op = filter.op, val = filter.value;
  if (!val && op !== 'today' && op !== 'overdue') return true;
  if (field === 'creator') return task.createdBy === val;
  if (field === 'label' && op === 'eq') return (task.labels || []).includes(val);
  if (field === 'keyword') {
    if (op === 'contains') return (task.title + task.desc + task.code).toLowerCase().indexOf(String(val).toLowerCase()) >= 0;
    if (op === 'not_contains') return (task.title + task.desc + task.code).toLowerCase().indexOf(String(val).toLowerCase()) < 0;
  }
  if (field === 'dueDate') {
    var d = task.dueDate;
    if (!d) return false;
    if (op === 'before') return d < val;
    if (op === 'after') return d > val;
    if (op === 'today') { var today = '2026-09-23'; return d === today; }
    if (op === 'overdue') return isOverdue(d) && task.status !== 'done';
  }
  if (op === 'eq') return String(task[field]) === String(val);
  if (op === 'neq') return String(task[field]) !== String(val);
  if (op === 'contains') {
    var arr = task[field] || (typeof task[field] === 'string' ? task[field] : []);
    return Array.isArray(arr) ? arr.indexOf(val) >= 0 : String(arr).toLowerCase().indexOf(String(val).toLowerCase()) >= 0;
  }
  if (op === 'not_contains') {
    var arr2 = task[field] || [];
    return Array.isArray(arr2) ? arr2.indexOf(val) < 0 : String(arr2).toLowerCase().indexOf(String(val).toLowerCase()) < 0;
  }
  return true;
}

function buildTaskTree(tasks) {
  var taskMap = new Map();
  tasks.forEach(function (t) { taskMap.set(t.id, t); });
  var childrenMap = new Map();
  var roots = [];
  tasks.forEach(function (t) {
    if (t.parentId && taskMap.has(t.parentId)) {
      if (!childrenMap.has(t.parentId)) childrenMap.set(t.parentId, []);
      childrenMap.get(t.parentId).push(t);
    } else roots.push(t);
  });
  return { roots: roots, childrenMap: childrenMap };
}

function renderTreeNodes(tasks, childrenMap, depth) {
  return tasks.map(function (t) {
    var id = t.id;
    var children = childrenMap.get(id) || [];
    var hasChildren = children.length > 0;
    var isCollapsed = collapsedParents.has(id);
    var html = renderCard(t, { depth: depth, hasChildren: hasChildren, isCollapsed: isCollapsed, childCount: children.length });
    if (hasChildren && !isCollapsed) html += renderTreeNodes(children, childrenMap, depth + 1);
    return html;
  }).join('');
}

function statusSvg(status) {
  var s = TK_STATUSES.find(function(x){return x.id===status;});
  var icon = (s && s.icon) || 'circle';
  var colorMap={gray:'#9f9fa9',orange:'#cb9400',green:'#4aa651',red:'#ff6467',blue:'#0f92f7'};
  var color=colorMap[(s&&s.color)||'gray'];
  var CX=7,CY=7,OR=6,FR=3.5;
  function pie(p){var a=2*Math.PI*p;var ex=CX+FR*Math.sin(a);var ey=CY-FR*Math.cos(a);var la=p>0.5?1:0;return 'M'+CX+','+CY+' L'+CX+','+(CY-FR)+' A'+FR+','+FR+' 0 '+la+',1 '+ex.toFixed(2)+','+ey.toFixed(2)+' Z';}
  var dots='';for(var i=0;i<16;i++){var a=(i/16)*Math.PI*2-Math.PI/2;dots+='<circle cx="'+(CX+OR*Math.cos(a)).toFixed(2)+'" cy="'+(CY+OR*Math.sin(a)).toFixed(2)+'" r="0.55" fill="currentColor"/>';}
  var ring='<circle cx="'+CX+'" cy="'+CY+'" r="'+OR+'" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3.14 0" stroke-dashoffset="-0.7"/>';
  var paths={
    dotted:dots,
    circle:ring,
    half:ring+'<path d="'+pie(0.5)+'" fill="currentColor"/>',
    three_quarters:ring+'<path d="'+pie(0.75)+'" fill="currentColor"/>',
    check:'<circle cx="'+CX+'" cy="'+CY+'" r="'+OR+'" fill="currentColor"/><path d="M10.951 4.249C11.283 4.581 11.283 5.119 10.951 5.451L5.951 10.451C5.619 10.783 5.081 10.783 4.749 10.451L2.749 8.451C2.417 8.119 2.417 7.581 2.749 7.249C3.081 6.917 3.619 6.917 3.951 7.249L5.35 8.648L9.749 4.249C10.081 3.917 10.619 3.917 10.951 4.249Z" fill="white" stroke="none"/>',
    slash:ring+'<line x1="'+(CX+FR*Math.cos(Math.PI*0.75)).toFixed(2)+'" y1="'+(CY-FR*Math.sin(Math.PI*0.75)).toFixed(2)+'" x2="'+(CX+FR*Math.cos(-Math.PI*0.25)).toFixed(2)+'" y2="'+(CY-FR*Math.sin(-Math.PI*0.25)).toFixed(2)+'" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    cross:ring+'<path d="M5 5 L9 9 M9 5 L5 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  };
  return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="color:'+color+';flex:none">'+(paths[icon]||paths.circle)+'</svg>';
}

function renderListTreeNodes(tasks, childrenMap, depth) {
  var ctx = {
    collapsedParents:collapsedParents, selectedIds:taskViewState.selectedIds, drawerTaskId:taskViewState.drawerTaskId,
    escapeHtml:escapeHtml, isOverdue:isOverdue, stClass:stClass, priClass:priClass,
    avatarSm:avatarSm, fmtDate:fmtDate, statusSvg:statusSvg, rowCounter:0,
  };
  return tasks.map(function (task) {
    var children = childrenMap.get(task.id) || [];
    var hasChildren = children.length > 0;
    var isCollapsed = ctx.collapsedParents.has(task.id);
    var rowNum = ++ctx.rowCounter;
    var html = renderListRow(task, { depth:depth, hasChildren:hasChildren, isCollapsed:isCollapsed, childCount:children.length, rowNum:rowNum }, ctx);
    if (hasChildren && !isCollapsed) html += renderListTreeNodes(children, childrenMap, depth + 1);
    return html;
  }).join('');
}

function renderListRow(t, opts, ctx) {
  var depth = opts.depth || 0;
  var hasChildren = !!opts.hasChildren;
  var isCollapsed = !!opts.isCollapsed;
  var childCount = opts.childCount || 0;
  var pri = tkGetPriorityObj(t.priority);
  var st = tkGetStatusObj(t.status);
  var person = tkGetPerson(t.assignee);
  var overdue = ctx.isOverdue(t.dueDate) && t.status !== 'done';
  var sel = ctx.selectedIds.has(t.id) ? ' selected' : '';
  var toggle = hasChildren ? '<button class="tk-row-toggle' + (isCollapsed ? ' is-collapsed' : '') + '" data-tk-toggle="' + t.id + '" aria-expanded="' + !isCollapsed + '" aria-label="' + (isCollapsed ? '展开子任务' : '折叠子任务') + '"><svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 7.5 5 5 5-5"/></svg></button>' : '';
  var spacer = !hasChildren ? '<span class="tk-row-spacer"></span>' : '';
  var childBadge = hasChildren ? '<span class="tk-row-child-count"' + (isCollapsed ? '' : ' style="visibility:hidden"') + '>' + childCount + '</span>' : '';
  var indentStyle = depth > 0 ? ' style="padding-left:calc(10px + ' + depth + 'em)"' : '';
  return '<tr class="tk-row' + sel + (ctx.drawerTaskId === t.id ? ' detail-active' : '') + (depth ? ' tk-row--child' : '') + (hasChildren ? ' tk-row--parent' : '') + '" data-task-id="' + t.id + '" data-depth="' + depth + '">'
    + '<td class="tk-col-check"><input type="checkbox" class="tk-row-check" data-task-id="' + t.id + '"' + (ctx.selectedIds.has(t.id) ? ' checked' : '') + '></td>'
    + '<td class="tk-col-code"><span class="tk-row-code">' + (opts.rowNum || '') + '</span></td>'
    + '<td class="tk-col-title"' + indentStyle + '><div class="tk-row-title-wrap">' + toggle + spacer + '<span class="tk-row-title-text">' + ctx.escapeHtml(t.title) + '</span>' + childBadge + '</div></td>'
    + '<td class="tk-col-status"><span class="tk-row-status">' + ctx.statusSvg(t.status) + ctx.escapeHtml(st.name) + '</span></td>'
    + '<td class="tk-col-priority"><span class="tk-row-priority">' + ctx.escapeHtml(pri.name) + '</span></td>'

    + '<td class="tk-col-project">' + ctx.escapeHtml(tkGetProjectName(t.project)) + '</td>'
    + '<td class="tk-col-due"><span class="tk-row-due' + (overdue ? ' overdue' : '') + '">' + (t.dueDate ? ctx.fmtDate(t.dueDate) : '—') + '</span></td>'
    + '<td class="tk-col-created">' + ctx.fmtDate(t.createDate) + '</td>'
    + '<td class="tk-col-labels">' + ((t.labels || []).length ? t.labels.map(function(name) { return '<span class="tk-row-label">' + ctx.escapeHtml(name) + '</span>'; }).join('') : '—') + '</td>'
    + '<td class="tk-col-actions"><button class="tk-card-more" data-card-more="' + t.id + '" data-tooltip="更多操作" aria-label="更多操作"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button></td></tr>';
}

function getGroupedTasks(tasks) {
  if (taskViewState.groupBy === 'none') return [{ key: 'all', name: '全部', tasks: tasks }];
  var groups = {}, keys = [];
  if (taskViewState.groupBy === 'status') {
    /* 「待规划」先隐藏：不单独成列，该状态任务并入「待开始」列；「已取消」先隐藏，不上板 */
    TK_STATUSES.forEach(function (s) { if (s.id === 'planned' || s.id === 'cancelled') return; groups[s.id] = { name: s.name, color: s.color, tasks: [] }; keys.push(s.id); });
  } else if (taskViewState.groupBy === 'priority') {
    TK_PRIORITIES.forEach(function (p) { groups[p.id] = { name: p.name, color: p.color, tasks: [] }; keys.push(p.id); });
  } else if (taskViewState.groupBy === 'assignee') {
    TK_PEOPLE.forEach(function (p) { groups[p.id] = { name: p.name, color: p.color, tasks: [] }; keys.push(p.id); });
    groups.unassigned = { name: '未分配', color: 'gray', tasks: [] }; keys.push('unassigned');
  } else if (taskViewState.groupBy === 'project') {
    tkProjectsForCurrentUser().forEach(function (p) { groups[p.id] = { name: p.name, color: 'blue', tasks: [] }; keys.push(p.id); });
    groups.none = { name: '无项目', color: 'gray', tasks: [] }; keys.push('none');
  }
  tasks.forEach(function (t) {
    var k = t[taskViewState.groupBy];
    if (taskViewState.groupBy === 'status' && k === 'planned') k = 'backlog';
    /* 已取消的任务不上板，展示方式后续再规划 */
    if (t.status === 'cancelled') return;
    if (!k) {
      if (taskViewState.groupBy === 'assignee') k = 'unassigned';
      else if (taskViewState.groupBy === 'project') k = 'none';
      else k = keys[0];
    }
    if (!groups[k]) { groups[k] = { name: k, color: 'gray', tasks: [] }; keys.push(k); }
    groups[k].tasks.push(t);
  });
  /* 按状态分组时保留空列：状态卡片即使没有任务也显示，便于了解全部状态并拖拽流转 */
  var keepEmptyGroups = taskViewState.groupBy === 'status';
  return keys.filter(function (k) { return keepEmptyGroups || groups[k].tasks.length > 0; }).map(function (k) {
    return { key: k, name: groups[k].name, color: groups[k].color, tasks: groups[k].tasks };
  });
}

function renderViewBar() {
  els.tkViewTabs.innerHTML = renderListPageTabs(tkGetViews().map(function(view){return {id:view.id,name:view.name,removable:!view.builtin};}),taskViewState.activeViewId,'data-view-id');
}

function renderBoard() {
  var tasks = getFilteredTasks();
  if (tasks.length === 0) { showEmpty(); return; }
  showBoardOrList();
  var groups = getGroupedTasks(tasks);
  var html = groups.map(function (g) {
    var tree = buildTaskTree(g.tasks);
    var cards = renderTreeNodes(tree.roots, tree.childrenMap, 0);
    var collapsed = taskViewState.collapsedBoardGroups.has(g.key);
    var toggleLabel = collapsed ? '展开分组' : '折叠分组';
    var arrow = collapsed ? '18 15 12 9 6 15' : '6 9 12 15 18 9';
    return '<div class="tk-board-col' + (collapsed ? ' is-collapsed' : '') + '" data-group-key="' + g.key + '">'
      + '<div class="tk-board-col-head"><div class="tk-board-col-head-left">'
      + '<span class="tk-board-col-dot tk-st-' + (g.color || 'gray') + '"></span>'
      + '<span class="tk-board-col-name">' + escapeHtml(g.name) + '</span>'
      + '<span class="tk-board-col-count">' + g.tasks.length + '</span>'
      + '</div><div class="tk-board-col-head-right">'
      + '<button class="tk-board-col-toggle" data-toggle-col data-tooltip="' + toggleLabel + '" aria-label="' + toggleLabel + '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="' + arrow + '"/></svg></button>'
      + '<button class="tk-board-col-add" data-add-group="' + g.key + '" data-tooltip="新建任务" aria-label="新建任务"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'
      + '</div></div>'
      + '<div class="tk-board-col-body' + (collapsed ? ' collapsed' : '') + '">' + cards + '</div>'
      + '</div>';
  }).join('');
  els.tkBoardScroll.innerHTML = html;
}

function renderCard(t, opts) {
  opts = opts || {};
  var depth = opts.depth || 0;
  var hasChildren = !!opts.hasChildren;
  var isCollapsed = !!opts.isCollapsed;
  var childCount = opts.childCount || 0;
  var pri = tkGetPriorityObj(t.priority);
  var overdue = isOverdue(t.dueDate) && t.status !== 'done';
  var props = taskViewState.cardProperties;
  var labels = props.labels ? (t.labels || []).map(function (l) { return '<span class="tk-card-label">' + escapeHtml(l) + '</span>'; }).join('') : '';
  var sel = taskViewState.selectedIds.has(t.id) ? ' selected' : '';
  var toggle = hasChildren ? '<button class="tk-card-toggle' + (isCollapsed ? ' is-collapsed' : '') + '" data-tk-toggle="' + t.id + '" aria-expanded="' + !isCollapsed + '" aria-label="' + (isCollapsed ? '展开子任务' : '折叠子任务') + '"><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 7.5 5 5 5-5"/></svg></button>' : '';
  var spacer = !hasChildren ? '<span class="tk-card-spacer"></span>' : '';
  var childBadge = hasChildren ? '<span class="tk-card-child-count"' + (isCollapsed ? '' : ' style="visibility:hidden"') + '>' + childCount + '</span>' : '';
  var extraCls = (depth ? ' tk-card--child' : '') + (hasChildren ? ' tk-card--parent' : '');
  var project = TK_PROJECTS.find(function(r){ return r.id === t.project; });
  var team = (function(){ var tid = t.teamId || (project && project.defaultTeam); return TEAMS.find(function(tm){ return tm.id === tid; }); })();
  var isBacklog = t.status === 'backlog';
  var teamAvatarHtml, footExtraHtml;
  if (isBacklog) {
    var members = team ? (team.members || []).map(function(id){ return EX[id]; }).filter(Boolean) : [];
    teamAvatarHtml = members.length
      ? '<span class="tk-card-team-avatars">' + members.slice(0, 4).map(function(m){ return '<img class="tk-card-team-avatar" src="' + xav(m.k) + '" alt="" title="' + escapeHtml(m.name) + '">'; }).join('') + (members.length > 4 ? '<span class="tk-card-team-avatars-more">+' + (members.length - 4) + '</span>' : '') + '</span>'
      : (team ? '<img class="tk-card-team-avatar" src="' + xav(AV_KEYS[Math.abs(t.id) % AV_KEYS.length]) + '" alt="" title="' + escapeHtml(team.name) + '">' : '');
    footExtraHtml = (labels ? '<div class="tk-card-labels">' + labels + '</div>' : '')
      + (props.priority ? '<span class="tk-card-priority ' + priClass(t.priority) + '">' + escapeHtml(pri.name) + '</span>' : '')
      + (props.startDate && t.startDate ? '<span class="tk-card-due">' + fmtDate(t.startDate) + '</span>' : '')
      + (props.dueDate && t.dueDate ? '<span class="tk-card-due' + (overdue ? ' overdue' : '') + '"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + fmtDate(t.dueDate) + '</span>' : '')
      + (props.project && t.project ? '<span class="tk-card-project">' + escapeHtml(tkGetProjectName(t.project)) + '</span>' : '');
  } else {
    teamAvatarHtml = team ? '<img class="tk-card-team-avatar" src="' + xav(AV_KEYS[Math.abs(t.id) % AV_KEYS.length]) + '" alt="" title="' + escapeHtml(team.name) + '">' : '';
    var activity = createDeliveryActivity(t, project || {});
    var stages = activity.filter(function(e){ return e.expertId; });
    var latest = stages.length ? stages[stages.length - 1] : null;
    footExtraHtml = latest ? '<span class="tk-card-stage">' + escapeHtml(latest.stage) + '</span>' : '';
  }
  /* 待开始卡片不再渲染「开始」按钮，开始入口收到右上角三点菜单 */
  return '<div class="tk-card' + sel + extraCls + '" draggable="true" data-task-id="' + t.id + '">'
    + '<button class="tk-card-more" data-card-more="' + t.id + '" data-tooltip="更多操作" aria-label="更多操作"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button>'
    + '<div class="tk-card-top-row">' + toggle + spacer + '<div class="tk-card-code">' + escapeHtml(t.code) + '</div>' + childBadge + '</div>'
    + '<div class="tk-card-title">' + escapeHtml(t.title) + '</div>'
    + (props.description && t.desc ? '<div class="tk-card-description">' + escapeHtml(t.desc) + '</div>' : '')
    + '<div class="tk-card-foot"><div class="tk-card-foot-left">' + teamAvatarHtml + footExtraHtml
    + '</div></div></div>';
}

function visibleListColumnCount() {
  return taskListVisibleColumnCount(taskViewState.listFieldOrder, taskViewState.listFieldVisibility);
}

function applyListFieldSettings() {
  applyTaskListFieldSettings(els.tkListHead, els.tkListBody, taskViewState.listFieldOrder, taskViewState.listFieldVisibility);
}

function renderList(tasks) {
  tasks = tasks || getFilteredTasks();
  if (tasks.length === 0 && taskViewState.viewMode === 'split') {
    showBoardOrList();
    els.tkListBody.innerHTML = '<tr class="tk-row-create"><td colspan="' + visibleListColumnCount() + '">没有匹配的任务</td></tr>';
    updateSortArrows();
    return;
  }
  if (tasks.length === 0) { showEmpty(); return; }
  showBoardOrList();
  var tree = buildTaskTree(tasks);
  var html = renderListTreeNodes(tree.roots, tree.childrenMap, 0);
  els.tkListBody.innerHTML = '<tr class="tk-row-create" id="tkRowCreate"><td colspan="' + visibleListColumnCount() + '"><button class="tk-inline-create-btn" id="tkInlineCreateBtn">+ 快速新建</button></td></tr>' + html;
  updateSortArrows();
}

function animateListSubtasks(toggleBtn) {
  var taskId = Number(toggleBtn.getAttribute('data-tk-toggle'));
  var opening = collapsedParents.has(taskId);
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 折叠箭头旋转 */
  function animateArrow() {
    var svg = els.tkListBody.querySelector('[data-tk-toggle="' + taskId + '"] svg');
    if (svg) svg.animate([
      { transform: opening ? 'rotate(-90deg)' : 'rotate(0deg)' },
      { transform: opening ? 'rotate(0deg)' : 'rotate(-90deg)' },
    ], { duration: 200, easing: 'cubic-bezier(.4,0,.2,0)' });
  }

  if (reduceMotion) {
    if (opening) collapsedParents.delete(taskId);
    else collapsedParents.add(taskId);
    render();
    return;
  }

  var parentRow = toggleBtn.closest('tr.tk-row');
  var parentDepth = Number(parentRow.getAttribute('data-depth'));

  function getChildRows(row) {
    var rows = [];
    var next = row.nextElementSibling;
    while (next && next.classList.contains('tk-row') && Number(next.getAttribute('data-depth')) > parentDepth) {
      rows.push(next);
      next = next.nextElementSibling;
    }
    return rows;
  }

  /* 设置 / 清除行内动画辅助样式（overflow + padding + border 归零） */
  function prepRow(row, height) {
    row.style.overflow = 'hidden';
    row.style.height = height + 'px';
    row.querySelectorAll('td').forEach(function (td) {
      td.style.overflow = 'hidden';
      td.style.paddingTop = '0px';
      td.style.paddingBottom = '0px';
      td.style.borderBottomWidth = '0px';
    });
  }
  function cleanupRow(row) {
    row.style.overflow = '';
    row.style.height = '';
    row.querySelectorAll('td').forEach(function (td) {
      td.style.overflow = '';
      td.style.paddingTop = '';
      td.style.paddingBottom = '';
      td.style.borderBottomWidth = '';
    });
  }

  if (!opening) {
    /* 折叠：子行从自然高度收缩到 0，下方行随高度减小自然上移 */
    var childRows = getChildRows(parentRow);
    var heights = childRows.map(function (r) { return r.getBoundingClientRect().height; });
    childRows.forEach(function (r, i) { prepRow(r, heights[i]); });
    var anims = childRows.map(function (r) {
      return r.animate([
        { opacity: 1 },
        { height: '0px', opacity: 0 },
      ], { duration: 200, easing: 'cubic-bezier(.4,0,.2,0)', fill: 'forwards' });
    });
    animateArrow();
    Promise.all(anims.map(function (a) { return a.finished; })).then(function () {
      collapsedParents.add(taskId);
      render();
    });
    return;
  }

  /* 展开：先渲染子行，再从高度 0 平滑展开到自然高度 */
  collapsedParents.delete(taskId);
  render();
  var newParentRow = els.tkListBody.querySelector('[data-tk-toggle="' + taskId + '"]');
  if (newParentRow) newParentRow = newParentRow.closest('tr.tk-row');
  if (!newParentRow) { animateArrow(); return; }
  parentDepth = Number(newParentRow.getAttribute('data-depth'));
  var newChildRows = getChildRows(newParentRow);
  var naturalHeights = newChildRows.map(function (r) { return r.getBoundingClientRect().height; });
  newChildRows.forEach(function (r) { prepRow(r, 0); });
  els.tkListBody.offsetHeight; /* 强制 reflow，确保 height:0 生效 */
  newChildRows.forEach(function (r, i) {
    r.animate([
      { opacity: 0 },
      { height: naturalHeights[i] + 'px', opacity: 1 },
    ], { duration: 240, easing: 'cubic-bezier(.4,0,.2,0)', fill: 'forwards' });
  });
  setTimeout(function () {
    newChildRows.forEach(cleanupRow);
  }, 280);
  animateArrow();
}

function updateSortArrows() {
  $$('#tkListHead th[data-sort]').forEach(function (th) {
    th.classList.remove('sorted');
    var arrow = th.querySelector('.tk-sort-arrow');
    if (arrow) arrow.remove();
    var hint = th.querySelector('.tk-sort-hint');
    if (!hint) {
      hint = document.createElement('span');
      hint.className = 'tk-sort-hint';
      hint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
      th.appendChild(hint);
    }
    if (th.getAttribute('data-sort') === taskViewState.sortBy && taskViewState.sortDir !== 'none' && !((taskViewState.sortBy === 'createDate' || taskViewState.sortBy === 'updatedAt') && taskViewState.sortDir === 'desc')) {
      th.classList.add('sorted');
      var span = document.createElement('span');
      span.className = 'tk-sort-arrow';
      span.textContent = taskViewState.sortDir === 'asc' ? '↑' : '↓';
      th.appendChild(span);
    }
  });
}

function renderFilterChips() {
  if (taskViewState.filters.length === 0) { els.tkFilterChips.classList.add('hidden'); els.tkFilterChips.innerHTML = ''; return; }
  els.tkFilterChips.classList.remove('hidden');
  var html = taskViewState.filters.map(function (f, i) {
    var fieldDef = TK_FILTER_FIELDS.find(function (fd) { return fd.id === f.field; });
    var sectionDef = filterSections.find(function (section) { return section[0] === f.field; });
    var fieldName = sectionDef ? sectionDef[1] : fieldDef ? fieldDef.name : f.field;
    var ops = TK_OPERATORS[fieldDef ? fieldDef.type : 'text'] || [];
    var opDef = ops.find(function (o) { return o.value === f.op; });
    var opLabel = opDef ? opDef.label : f.op === 'eq' ? '是' : f.op;
    var val = f.value;
    var menuOpt = filterOptionsFor(f.field).find(function (o) { return o.value === f.value; });
    if (menuOpt) val = menuOpt.label;
    if (f.op === 'today') val = '今天';
    if (f.op === 'overdue') val = '已逾期';
    return '<span class="tk-chip"><span class="tk-chip-field">' + escapeHtml(fieldName) + '</span><span class="tk-chip-op">' + escapeHtml(opLabel) + '</span><span class="tk-chip-val">' + escapeHtml(val) + '</span><button class="tk-chip-remove" data-chip-idx="' + i + '" data-tooltip="移除筛选" aria-label="移除筛选"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>';
  }).join('') + '<button class="tk-chip-clear-all" id="tkChipClearAll">清除全部</button>';
  els.tkFilterChips.innerHTML = html;
}

function showEmpty() {
  els.tkBoard.classList.add('hidden'); els.tkList.classList.add('hidden'); els.tkEmpty.classList.remove('hidden');
  var projects=tkProjectsForCurrentUser(),projectIds=new Set(projects.map(function(project){return project.id;}));
  var hasTasks=tkGetTasks().some(function(task){return tkCanViewTask(task)&&projectIds.has(task.project)&&(!projectListMode||task.project===projectListProjectId);});
  var message=els.tkEmpty.querySelector('p');
  if(message)message.textContent=!projects.length?'还没有可参与的项目，请先到「项目」页创建项目或联系管理员':hasTasks?'没有匹配的任务':'项目中还没有任务，点击右上「新建」开始';
  els.tkResetFilter.classList.toggle('hidden',!hasTasks);
}

function showBoardOrList() {
  els.tkEmpty.classList.add('hidden');
  if (taskViewState.layout === 'board') { els.tkBoard.classList.remove('hidden'); els.tkList.classList.add('hidden'); }
  else { els.tkList.classList.remove('hidden'); els.tkBoard.classList.add('hidden'); }
}

function updateBulkBar() {
  var count = taskViewState.selectedIds.size;
  if (count === 0) { els.tkBulkBar.classList.add('hidden'); return; }
  els.tkBulkBar.classList.remove('hidden'); els.tkBulkCount.textContent = count;
}

function render() {
  tkSyncPeople();
  taskViewState.selectedIds.forEach(function (id) {
    var task = tkGetTasks().find(function (item) { return item.id === id; });
    if (!tkCanViewTask(task)) taskViewState.selectedIds.delete(id);
  });
  if (taskViewState.drawerTaskId) {
    var openTask = tkGetTasks().find(function (item) { return item.id === taskViewState.drawerTaskId; });
    if (!tkCanViewTask(openTask)) closeDrawer();
  }
  var split = taskViewState.viewMode === 'split';
  if (split) taskViewState.layout = 'list';
  els.tkToolbarNewGroup.classList.remove('hidden');
  els.tkBody.classList.toggle('is-split', split);
  els.tkDrawer.classList.toggle('mode-full', taskViewState.viewMode === 'full');
  $$('[data-layout]', els.tkLayoutToggle).forEach(function (btn) {
    var active = btn.getAttribute('data-layout') === taskViewState.layout;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  renderDisplayControls();
  updateFilterButton();
  renderViewBar();
  if (split) {
    var visibleTasks = getFilteredTasks();
    if (!visibleTasks.some(function (t) { return t.id === taskViewState.drawerTaskId; })) {
      taskViewState.drawerTaskId = visibleTasks.length ? visibleTasks[0].id : null;
    }
    renderList(visibleTasks);
    if (taskViewState.drawerTaskId) {
      els.tkSplitEmpty.classList.add('hidden');
      if (els.tkDrawer.getAttribute('data-task-id') !== String(taskViewState.drawerTaskId) || els.tkDrawer.classList.contains('hidden') || !els.tkDrawer.classList.contains('show')) openDrawer(taskViewState.drawerTaskId);
    } else {
      closeDrawer();
      els.tkSplitEmpty.classList.remove('hidden');
    }
  } else {
    els.tkSplitEmpty.classList.add('hidden');
    if (taskViewState.layout === 'board') renderBoard(); else renderList();
  }
  applyListFieldSettings();
  renderFilterChips(); updateBulkBar(); updateCheckAll();
  syncDrawerClickaway();
  persistViewState();
}

function tkSetProjectListMode(active, projectId) {
  if (active === projectListMode && (!active || projectListProjectId === projectId)) return;
  if (active) {
    if (!projectListMode) {
      layoutBeforeProjectList = taskViewState.layout;
      viewBeforeProjectList = {activeViewId:taskViewState.activeViewId,scope:taskViewState.scope,filters:taskViewState.filters,search:taskViewState.search,viewMode:taskViewState.viewMode};
    }
    projectListMode = true;
    projectListProjectId = projectId || '';
    taskViewState.layout = 'list';
    taskViewState.activeViewId='all';taskViewState.scope='all';taskViewState.filters=[];taskViewState.search='';taskViewState.viewMode='slide';
    if(els.tkSearch)els.tkSearch.value='';
  } else {
    projectListMode = false;
    projectListProjectId = '';
    taskViewState.layout = layoutBeforeProjectList || taskViewState.layout;
    layoutBeforeProjectList = null;
    if(viewBeforeProjectList){Object.assign(taskViewState,viewBeforeProjectList);if(els.tkSearch)els.tkSearch.value=taskViewState.search;viewBeforeProjectList=null;}
  }
  if (els.tkBody) render();
}

var cardPropertyOptions = [
  ['priority','优先级'],['description','描述'],['assignee','负责人'],['startDate','开始日期'],
  ['dueDate','截止日期'],['project','项目'],['labels','标签'],['childProgress','子任务进度'],
];

var displayGroupOptions = [
  ['status','状态'],['priority','优先级'],['assignee','处理人'],['project','项目'],['none','不分组'],
];

var displaySortOptions = [
  ['status','状态'],['priority','优先级'],['dueDate','截止日期'],['updatedAt','修改时间'],['createDate','创建时间'],
  ['code','#'],['title','标题'],['module','模块'],['project','项目'],
];

var displayChoiceMenu = null;

var displayChoiceTrigger = null;

function closeDisplayChoiceMenu(restoreFocus) {
  if (displayChoiceMenu) displayChoiceMenu.remove();
  displayChoiceMenu = null;
  if (displayChoiceTrigger) {
    displayChoiceTrigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) displayChoiceTrigger.focus({ preventScroll:true });
  }
  displayChoiceTrigger = null;
}

function openDisplayChoiceMenu(trigger, kind, focusEdge) {
  if (displayChoiceMenu && displayChoiceTrigger === trigger) { closeDisplayChoiceMenu(true); return; }
  closeDisplayChoiceMenu();
  var options = kind === 'group' ? displayGroupOptions : displaySortOptions;
  var selected = kind === 'group' ? taskViewState.groupBy : taskViewState.sortBy;
  var menu = document.createElement('div');
  menu.className = 'tk-flow-field-menu tk-display-choice-menu show';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', kind === 'group' ? '分组字段' : '排序字段');
  menu.innerHTML = options.map(function(option) {
    var active = option[0] === selected;
    return '<button type="button" class="tk-flow-field-menu-item tk-display-choice-option' + (active ? ' active' : '') + '" role="option" aria-selected="' + active + '" data-value="' + option[0] + '"><span>' + option[1] + '</span><span class="tk-display-choice-check" aria-hidden="true">' + (active ? '✓' : '') + '</span></button>';
  }).join('');
  document.body.appendChild(menu);
  displayChoiceMenu = menu;
  displayChoiceTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  var rect = trigger.getBoundingClientRect();
  menu.style.minWidth = rect.width + 'px';
  menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - 8)) + 'px';
  menu.addEventListener('click', function(e) {
    e.stopPropagation();
    var option = e.target.closest('[data-value]');
    if (!option) return;
    if (kind === 'group') taskViewState.groupBy = option.getAttribute('data-value');
    else {
      taskViewState.sortBy = option.getAttribute('data-value');
      taskViewState.sortDir = (taskViewState.sortBy === 'createDate' || taskViewState.sortBy === 'updatedAt' || taskViewState.sortBy === 'priority') ? 'desc' : 'asc';
    }
    closeDisplayChoiceMenu(true);
    render();
  });
  menu.addEventListener('keydown', function(e) {
    var items = Array.from(menu.querySelectorAll('.tk-display-choice-option'));
    var index = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDisplayChoiceMenu(true); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      var next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    }
  });
  var items = menu.querySelectorAll('.tk-display-choice-option');
  var activeOption = menu.querySelector('.tk-display-choice-option.active');
  (focusEdge === 'first' ? items[0] : focusEdge === 'last' ? items[items.length - 1] : activeOption || items[0]).focus({ preventScroll:true });
}

function renderDisplayControls() {
  els.tkGroupSelect.querySelector('.tk-display-choice-text').textContent = (displayGroupOptions.find(function(option) { return option[0] === taskViewState.groupBy; }) || displayGroupOptions[0])[1];
  els.tkViewModeSelect.value = taskViewState.viewMode;
  els.tkSortSelect.querySelector('.tk-display-choice-text').textContent = (displaySortOptions.find(function(option) { return option[0] === taskViewState.sortBy; }) || displaySortOptions[0])[1];
  els.tkSortDirection.dataset.direction = taskViewState.sortDir;
  var directionHint = taskViewState.sortDir === 'none' ? '未排序，点击切换为升序' : '当前' + (taskViewState.sortDir === 'asc' ? '升序，点击切换为降序' : '降序，点击切换为升序');
  els.tkSortDirection.setAttribute('aria-label', directionHint);
  els.tkSortDirection.setAttribute('data-tooltip', directionHint);
  els.tkShowSubtasks.checked = taskViewState.showSubtasks;
  els.tkCardPropsSection.classList.toggle('hidden', taskViewState.layout !== 'board');
  els.tkCardProperties.innerHTML = cardPropertyOptions.map(function (opt) {
    return '<button type="button" class="tk-display-property" data-card-property="' + opt[0] + '" aria-pressed="' + !!taskViewState.cardProperties[opt[0]] + '">' + opt[1] + '</button>';
  }).join('');
  els.tkFieldsSummary.textContent = taskViewState.listFieldOrder.filter(function(id) { return id === 'title' || taskViewState.listFieldVisibility[id] !== false; }).length + ' 个字段';
}

function renderFieldSettings() {
  var query = els.tkFieldsSearch.value.trim().toLocaleLowerCase();
  var fields = taskViewState.listFieldOrder.map(function(id) { return LIST_FIELDS.find(function(field) { return field.id === id; }); }).filter(function(field) {
    return field && field.name.toLocaleLowerCase().includes(query);
  });
  els.tkFieldsList.innerHTML = fields.length ? fields.map(function(field) {
    var checked = field.required || taskViewState.listFieldVisibility[field.id] !== false;
    return '<div class="tk-fields-item" data-field-id="' + field.id + '" draggable="true">' +
      '<span class="tk-fields-grip" role="button" tabindex="0" aria-label="调整' + field.name + '顺序">⋮⋮</span>' +
      '<label><input type="checkbox" data-field-visible="' + field.id + '"' + (checked ? ' checked' : '') + (field.required ? ' disabled' : '') + '><span>' + field.name + '</span></label>' +
      '</div>';
  }).join('') : '<div class="tk-fields-empty">没有匹配的字段</div>';
}

function closeFieldSettings() {
  els.tkFieldsPopover.classList.add('hidden');
  els.tkFieldsBtn.setAttribute('aria-expanded', 'false');
}

function saveInlineTask() {
  var ti = els.tkListBody.querySelector('#tkInlineTitle');
  var saveBtn = els.tkListBody.querySelector('#tkInlineSave');
  if (!ti || !saveBtn || saveBtn.disabled) return;
  var title = ti.value.trim();
  if (!title) { ti.focus(); return; }
  var aw = els.tkListBody.querySelector('#tkInlineAssigneeWrap');
  var av = aw ? aw.getAttribute('data-value') : '';
  saveBtn.disabled = true;
  saveBtn.classList.add('is-loading');
  saveBtn.setAttribute('aria-busy', 'true');
  saveBtn.innerHTML = '<span class="tk-inline-save-spinner" aria-hidden="true"></span>确定中…';
  ti.disabled = true;
  var assigneeBtn = els.tkListBody.querySelector('#tkInlineAssigneeBtn');
  var cancelBtn = els.tkListBody.querySelector('#tkInlineCancel');
  if (assigneeBtn) assigneeBtn.querySelector('input').disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
  setTimeout(function () {
    var mx = Math.max.apply(null, tkGetTasks().map(function(x){return x.id;}));
     var projectId = projectListProjectId;
     if (!projectId || !tkProjectsForCurrentUser().some(function (project) { return project.id === projectId; })) { toast('请先加入项目再创建任务', 'warning'); render(); return; }
     tkAddTask({ id:mx+1, code:'T'+String(1000000+mx+1), title:title, desc:'', status:'backlog', priority:'medium', assignee: av || tkPeopleInProject(projectId)[0]?.id || '', project:projectId, labels:[], dueDate:'', createDate:new Date().toISOString().slice(0,10) });
    render();
    toast('创建成功', 'success');
  }, 400);
}

function updateCheckAll() {
  if (els.tkCheckAll) {
    var tasks = getFilteredTasks();
    els.tkCheckAll.checked = tasks.length > 0 && tasks.every(function (t) { return taskViewState.selectedIds.has(t.id); });
  }
}

var activeFilterSection = 'status';

var filterSections = [
  ['status','状态','<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>'],
  ['issueType','任务类型','<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>'],
  ['priority','优先级','<path d="M4 19v-2M9 19v-6M14 19V9M19 19V4"/>'],
  ['dueDate','日期','<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>'],
  ['assignee','处理人','<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'],
  ['creator','创建者','<circle cx="10" cy="8" r="4"/><path d="M3 21v-2a7 7 0 0 1 12-5M16 20l5-5M18 13l3 3"/>'],
  ['project','项目','<path d="M3 5h7l2 2h9v13H3z"/>'],
  ['label','标签','<path d="M3 3h9l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1"/>'],
];

function filterOptionsFor(section) {
  /* 计数与列表实际结果同口径：按当前视图可见基准统计（跳过本分类已选筛选） */
  var tasks = getFilteredTasks(section);
  if (section === 'status') return [
    ['planned','待规划'],['backlog','待开始'],['in_progress','执行中'],['in_review','待审核'],
    ['blocked','已阻塞'],['done','已完成'],
    /* 「已取消」先隐藏，不提供筛选入口 */
  ].map(function (o) { return { value:o[0], label:o[1], count:tasks.filter(function (t) { return t.status === o[0]; }).length }; });
  if (section === 'issueType') return [['需求','需求'],['缺陷','缺陷']].map(function (o) { return { value:o[0], label:o[1], count:tasks.filter(function (t) { return t.issueType === o[0]; }).length }; });
  if (section === 'priority') return TK_PRIORITIES.map(function (p) { return { value:p.id, label:p.name, count:tasks.filter(function (t) { return t.priority === p.id; }).length }; });
  if (section === 'assignee') return TK_PEOPLE.map(function (p) { return { value:p.id, label:p.name, count:tasks.filter(function (t) { return t.assignee === p.id; }).length }; });
  if (section === 'creator') return TK_PEOPLE.map(function (p) { return { value:p.id, label:p.name, count:tasks.filter(function (t) { return t.createdBy === p.id; }).length }; });
  if (section === 'project') return tkProjectsForCurrentUser().map(function (p) { return { value:p.id, label:p.name, count:tasks.filter(function (t) { return t.project === p.id; }).length }; });
  if (section === 'label') return TK_LABELS.map(function (l) { return { value:l, label:l, count:tasks.filter(function (t) { return (t.labels || []).includes(l); }).length }; });
  return [];
}

function updateFilterButton() {
  var count = taskViewState.filters.length;
  els.tkFilterLabel.textContent = count ? count + ' 个筛选' : '筛选';
  els.tkFilterBtn.classList.toggle('has-filters', count > 0);
}

function renderFilterMenu() {
  els.tkFilterPanelBody.innerHTML = filterSections.map(function (section) {
    var count = taskViewState.filters.filter(function (f) { return f.field === section[0]; }).length;
    return '<button type="button" class="tk-filter-category' + (activeFilterSection === section[0] ? ' active' : '') + '" data-filter-section="' + section[0] + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + section[2] + '</svg><span>' + section[1] + '</span>' + (count ? '<span class="tk-filter-count">' + count + '</span>' : '') + '<svg class="tk-filter-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 4 8 8-8 8"/></svg></button>';
  }).join('') + (taskViewState.filters.length ? '<button type="button" class="tk-filter-reset" id="tkFilterReset">重置全部筛选</button>' : '');
  renderFilterSubmenu();
  positionFilterSubmenu();
}

function renderFilterSubmenu() {
  if (!activeFilterSection) { els.tkFilterSubmenu.classList.add('hidden'); return; }
  els.tkFilterSubmenu.classList.remove('hidden');
  if (activeFilterSection === 'dueDate') {
    var exact = taskViewState.filters.find(function (f) { return f.field === 'dueDate' && f.op === 'eq'; });
    els.tkFilterSubmenu.innerHTML = '<div class="tk-filter-date"><label for="tkFilterDate">截止日期</label><input type="date" id="tkFilterDate" value="' + (exact ? escapeHtml(exact.value) : '') + '"><button type="button" data-filter-date="today">今天</button><button type="button" data-filter-date="overdue">已逾期</button></div>';
    return;
  }
  els.tkFilterSubmenu.innerHTML = filterOptionsFor(activeFilterSection).map(function (option) {
    var checked = taskViewState.filters.some(function (f) { return f.field === activeFilterSection && f.value === option.value; });
    return '<button type="button" class="tk-filter-option" data-filter-value="' + escapeHtml(option.value) + '" aria-pressed="' + checked + '"><span class="tk-filter-check">' + (checked ? '✓' : '') + '</span>' + (activeFilterSection === 'status' ? '<span class="tk-filter-status-icon ' + option.value + '"></span>' : '') + '<span>' + escapeHtml(option.label) + '</span>' + (option.count ? '<span class="tk-filter-count">' + option.count + ' 个任务</span>' : '') + '</button>';
  }).join('');
}

function positionFilterSubmenu() {
  var activeBtn = els.tkFilterPanelBody.querySelector('.tk-filter-category.active');
  if (!activeBtn) { els.tkFilterSubmenu.style.top = ''; return; }
  var panelRect = els.tkFilterPanel.getBoundingClientRect();
  var btnRect = activeBtn.getBoundingClientRect();
  var borderTop = parseFloat(getComputedStyle(els.tkFilterPanel).borderTopWidth) || 0;
  var top = btnRect.top - panelRect.top - borderTop;
  var subH = els.tkFilterSubmenu.offsetHeight;
  if (panelRect.top + top + subH > window.innerHeight - 8) {
    top = Math.max(0, window.innerHeight - 8 - panelRect.top - subH);
  }
  els.tkFilterSubmenu.style.top = top + 'px';
}

function openFilterPanel() {
  closeDisplayChoiceMenu();
  closeFieldSettings();
  els.tkDisplayPopover.classList.add('hidden');
  els.tkDisplayBtn.classList.remove('active');
  els.tkDisplayBtn.setAttribute('aria-expanded', 'false');
  els.tkFilterPanel.classList.remove('hidden');
  els.tkFilterBtn.classList.add('active');
  els.tkFilterBtn.setAttribute('aria-expanded', 'true');
  activeFilterSection = 'status';
  renderFilterMenu();
  positionPopover(els.tkFilterPanel, els.tkFilterBtn, true);
  var rect = els.tkFilterPanel.getBoundingClientRect();
  els.tkFilterSubmenu.classList.toggle('flip', rect.right + 200 > window.innerWidth);
  positionFilterSubmenu();
}

function closeFilterPanel() {
  els.tkFilterPanel.classList.add('hidden');
  els.tkFilterBtn.classList.remove('active');
  els.tkFilterBtn.setAttribute('aria-expanded', 'false');
}

function toggleFilterValue(field, value) {
  var index = taskViewState.filters.findIndex(function (f) { return f.field === field && f.value === value; });
  if (index >= 0) taskViewState.filters.splice(index, 1);
  else taskViewState.filters.push({ field:field, op:'eq', value:value });
  updateFilterButton(); render(); renderFilterMenu();
}

function openSaveView() {
  els.tkSaveViewName.value = '';
  els.tkSaveViewScope.value = taskViewState.scope;
  els.tkSaveViewLayout.value = taskViewState.layout;
  els.tkSaveViewVisibility.value = 'private';
  els.tkSaveViewSummary.textContent = taskViewState.filters.length ? '已包含 ' + taskViewState.filters.length + ' 个筛选条件和当前显示设置' : '已包含当前显示设置';
  els.tkSaveViewOverlay.classList.remove('hidden');
  requestAnimationFrame(function () { els.tkSaveViewOverlay.classList.add('show'); });
  els.tkSaveViewName.focus();
}

function closeSaveView() {
  els.tkSaveViewOverlay.classList.remove('show');
  setTimeout(function () { els.tkSaveViewOverlay.classList.add('hidden'); }, 200);
}

function confirmSaveView() {
  var name = els.tkSaveViewName.value.trim();
  if (!name) { els.tkSaveViewName.focus(); return; }
  var v = tkAddView(name, {
    scope: els.tkSaveViewScope.value,
    visibility: els.tkSaveViewVisibility.value,
    layout: els.tkSaveViewLayout.value,
    filters: taskViewState.filters.map(function (f) { return Object.assign({}, f); }),
    groupBy: taskViewState.groupBy,
    viewMode: taskViewState.viewMode,
    sortBy: taskViewState.sortBy,
    sortDir: taskViewState.sortDir,
    showSubtasks: taskViewState.showSubtasks,
    cardProperties: Object.assign({}, taskViewState.cardProperties),
    listFieldOrder: taskViewState.listFieldOrder.slice(),
    listFieldVisibility: Object.assign({}, taskViewState.listFieldVisibility),
  });
  taskViewState.activeViewId = v.id;
  taskViewState.scope = v.scope;
  taskViewState.layout = v.layout;
  closeSaveView();
  render();
  toast('保存成功', 'success');
}

function openManageViews() {
  var views = tkGetViews();
  els.tkManageList.innerHTML = views.map(function (v) {
    return '<div class="tk-manage-item" data-view-id="' + v.id + '"><div><span class="tk-manage-item-name">' + escapeHtml(v.name) + '</span>' + (v.builtin ? '<span class="tk-manage-item-builtin">内置</span>' : '') + '</div><div class="tk-manage-item-actions">'
      + (v.builtin ? '' : '<button data-rename-view="' + v.id + '" data-tooltip="重命名" aria-label="重命名"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>')
      + (v.builtin ? '' : '<button class="tk-manage-del" data-del-view="' + v.id + '" data-tooltip="删除" aria-label="删除"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>')
      + '</div></div>';
  }).join('');
  els.tkManageViewsOverlay.classList.remove('hidden');
  requestAnimationFrame(function () { els.tkManageViewsOverlay.classList.add('show'); });
}

function closeManageViews() {
  els.tkManageViewsOverlay.classList.remove('show');
  setTimeout(function () { els.tkManageViewsOverlay.classList.add('hidden'); }, 200);
}

var activePopover = null;

function showPopover(el, anchor) {
  hidePopover();
  var rect = anchor.getBoundingClientRect();
  el.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  el.style.left = (rect.left + window.scrollX) + 'px';
  el.classList.add('show');
  activePopover = el;
}

function hidePopover() {
  if (activePopover) { activePopover.classList.remove('show'); activePopover = null; }
}

var dragTaskId = null;

function handleDragStart(e) {
  var card = e.target.closest('.tk-card');
  if (card) {
    dragTaskId = parseInt(card.getAttribute('data-task-id'), 10);
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }
}

function handleDragEnd(e) {
  var card = e.target.closest('.tk-card');
  if (card) card.classList.remove('dragging');
  $$('.tk-board-col-body').forEach(function (col) { col.classList.remove('drag-over'); });
  dragTaskId = null;
}

function handleDragOver(e) {
  if (dragTaskId !== null) {
    e.preventDefault();
    var col = e.target.closest('.tk-board-col-body');
    if (col) col.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  var col = e.target.closest('.tk-board-col-body');
  if (col) col.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  var col = e.target.closest('.tk-board-col-body');
  if (!col || dragTaskId === null) return;
  col.classList.remove('drag-over');
  var boardCol = col.closest('.tk-board-col');
  var groupKey = boardCol.getAttribute('data-group-key');
  var patch = {};
  if (taskViewState.groupBy === 'status') patch.status = groupKey;
  else if (taskViewState.groupBy === 'priority') patch.priority = groupKey;
  else if (taskViewState.groupBy === 'assignee') patch.assignee = groupKey === 'unassigned' ? '' : groupKey;
  else if (taskViewState.groupBy === 'project') patch.project = groupKey === 'none' ? '' : groupKey;
  tkUpdateTask(dragTaskId, patch);
  render();
}

var COL_WIDTHS_KEY = 'lingee_tasks_col_widths';

function loadColumnWidths() {
  try { return JSON.parse(localStorage.getItem(COL_WIDTHS_KEY) || '{}'); }
  catch (e) { return {}; }
}

function saveColumnWidths(widths) {
  try { localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(widths)); }
  catch (e) { /* 本地存储不可用时保留当前页面宽度 */ }
}

function initColumnResize() {
  if (!els.tkListHead) return;
  var saved = loadColumnWidths();
  els.tkListHead.querySelectorAll('th').forEach(function (th) {
    if (th.classList.contains('tk-col-check') || th.classList.contains('tk-col-actions')) return;
    if (th.querySelector('.tk-col-resize')) return; /* 已初始化 */
    var colKey = (th.className.match(/tk-col-(\w+)/) || [])[1];
    if (!colKey) return;
    if (saved[colKey]) th.style.width = saved[colKey] + 'px';
    var handle = document.createElement('div');
    handle.className = 'tk-col-resize';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      var startX = e.clientX;
      var startWidth = th.getBoundingClientRect().width;
      var pointerId = e.pointerId;
      handle.setPointerCapture(pointerId);
      handle.classList.add('dragging');
      th.classList.add('resizing');
      document.body.classList.add('tk-col-resizing');
      function move(ev) {
        if (ev.pointerId !== pointerId) return;
        th.style.width = Math.max(50, Math.round(startWidth + (ev.clientX - startX))) + 'px';
      }
      function end(ev) {
        if (ev.pointerId !== pointerId) return;
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        handle.classList.remove('dragging');
        th.classList.remove('resizing');
        document.body.classList.remove('tk-col-resizing');
        var w = loadColumnWidths();
        w[colKey] = Math.round(th.getBoundingClientRect().width);
        saveColumnWidths(w);
      }
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
    th.appendChild(handle);
  });
}

function closeViewMenu() {
    els.tkViewMenu.classList.add('hidden');
    els.tkViewAdd.setAttribute('aria-expanded', 'false');
  }

function initTaskListDisplayEvents() {
var enableTaskSearch = function () { els.tkSearch.removeAttribute('readonly'); };
els.tkSearch.addEventListener('pointerdown', enableTaskSearch, { once:true });
els.tkSearch.addEventListener('keydown', enableTaskSearch, { once:true });
els.tkSearch.addEventListener('input', function () { taskViewState.search = this.value; render(); });
$$('.tk-layout-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      taskViewState.layout = this.getAttribute('data-layout');
      if (taskViewState.viewMode === 'split' && taskViewState.layout === 'board') taskViewState.viewMode = 'slide';
      render();
    });
  });
els.tkDisplayBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (els.tkDisplayPopover.classList.contains('hidden')) {
      closeFilterPanel();
      closeDisplayChoiceMenu();
      closeFieldSettings();
      els.tkDisplayPopover.classList.remove('hidden');
      els.tkDisplayBtn.classList.add('active');
      els.tkDisplayBtn.setAttribute('aria-expanded', 'true');
      renderDisplayControls();
      positionPopover(els.tkDisplayPopover, els.tkDisplayBtn, true);
    } else {
      closeDisplayChoiceMenu();
      closeFieldSettings();
      els.tkDisplayPopover.classList.add('hidden');
      els.tkDisplayBtn.classList.remove('active');
      els.tkDisplayBtn.setAttribute('aria-expanded', 'false');
    }
  });
els.tkFieldsBtn.addEventListener('click', function () {
    closeDisplayChoiceMenu();
    var opening = els.tkFieldsPopover.classList.contains('hidden');
    if (!opening) { closeFieldSettings(); return; }
    els.tkFieldsPopover.classList.remove('hidden');
    els.tkFieldsPopover.classList.toggle('flip', els.tkDisplayPopover.getBoundingClientRect().left < 320);
    els.tkFieldsPopover.style.maxHeight = Math.max(240, window.innerHeight - els.tkDisplayPopover.getBoundingClientRect().top - 12) + 'px';
    els.tkFieldsBtn.setAttribute('aria-expanded', 'true');
    els.tkFieldsSearch.value = '';
    renderFieldSettings();
    els.tkFieldsSearch.focus({ preventScroll:true });
  });
els.tkFieldsClose.addEventListener('click', closeFieldSettings);
var enableFieldsSearch = function() { els.tkFieldsSearch.removeAttribute('readonly'); };
els.tkFieldsSearch.addEventListener('pointerdown', enableFieldsSearch, { once:true });
els.tkFieldsSearch.addEventListener('keydown', enableFieldsSearch, { once:true });
els.tkFieldsSearch.addEventListener('input', renderFieldSettings);
els.tkFieldsList.addEventListener('change', function(e) {
    var id = e.target.getAttribute('data-field-visible');
    if (!id || id === 'title') return;
    taskViewState.listFieldVisibility[id] = e.target.checked;
    render();
  });
var draggedFieldId = null;
els.tkFieldsList.addEventListener('dragstart', function(e) {
    var item = e.target.closest('.tk-fields-item');
    if (!item) return;
    draggedFieldId = item.getAttribute('data-field-id');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedFieldId);
    item.classList.add('dragging');
  });
els.tkFieldsList.addEventListener('dragover', function(e) {
    var item = e.target.closest('.tk-fields-item');
    if (!draggedFieldId || !item || item.getAttribute('data-field-id') === draggedFieldId) return;
    e.preventDefault();
    els.tkFieldsList.querySelectorAll('.drop-before,.drop-after').forEach(function(row) { row.classList.remove('drop-before','drop-after'); });
    item.classList.add(e.clientY < item.getBoundingClientRect().top + item.offsetHeight / 2 ? 'drop-before' : 'drop-after');
  });
els.tkFieldsList.addEventListener('drop', function(e) {
    var item = e.target.closest('.tk-fields-item');
    if (!draggedFieldId || !item) return;
    e.preventDefault();
    var targetId = item.getAttribute('data-field-id');
    if (targetId !== draggedFieldId) {
      var after = item.classList.contains('drop-after');
      taskViewState.listFieldOrder = taskViewState.listFieldOrder.filter(function(id) { return id !== draggedFieldId; });
      taskViewState.listFieldOrder.splice(taskViewState.listFieldOrder.indexOf(targetId) + (after ? 1 : 0), 0, draggedFieldId);
      renderFieldSettings();
      render();
    }
    draggedFieldId = null;
  });
els.tkFieldsList.addEventListener('dragend', function() {
    draggedFieldId = null;
    els.tkFieldsList.querySelectorAll('.dragging,.drop-before,.drop-after').forEach(function(row) { row.classList.remove('dragging','drop-before','drop-after'); });
  });
els.tkFieldsList.addEventListener('keydown', function(e) {
    var grip = e.target.closest('.tk-fields-grip');
    if (!grip || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    var item = grip.closest('.tk-fields-item');
    var id = item.getAttribute('data-field-id');
    var next = e.key === 'ArrowUp' ? item.previousElementSibling : item.nextElementSibling;
    if (!next || !next.classList.contains('tk-fields-item')) return;
    var targetId = next.getAttribute('data-field-id');
    taskViewState.listFieldOrder = taskViewState.listFieldOrder.filter(function(key) { return key !== id; });
    taskViewState.listFieldOrder.splice(taskViewState.listFieldOrder.indexOf(targetId) + (e.key === 'ArrowDown' ? 1 : 0), 0, id);
    renderFieldSettings();
    render();
    var moved = els.tkFieldsList.querySelector('[data-field-id="' + id + '"] .tk-fields-grip');
    if (moved) moved.focus();
  });
els.tkGroupSelect.addEventListener('click', function () { openDisplayChoiceMenu(this, 'group'); });
els.tkGroupSelect.addEventListener('keydown', function(e) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openDisplayChoiceMenu(this, 'group', e.key === 'ArrowDown' ? 'first' : 'last'); } });
els.tkViewModeSelect.addEventListener('change', function () {
    taskViewState.viewMode = this.value;
    if (taskViewState.viewMode === 'split') taskViewState.layout = 'list';
    render();
  });
els.tkSortSelect.addEventListener('click', function () { openDisplayChoiceMenu(this, 'sort'); });
els.tkSortSelect.addEventListener('keydown', function(e) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openDisplayChoiceMenu(this, 'sort', e.key === 'ArrowDown' ? 'first' : 'last'); } });
els.tkSortDirection.addEventListener('click', function () {
    closeDisplayChoiceMenu();
    taskViewState.sortDir = taskViewState.sortDir === 'asc' ? 'desc' : 'asc';
    renderDisplayControls();
    render();
  });
els.tkShowSubtasks.addEventListener('change', function () {
    taskViewState.showSubtasks = this.checked;
    render();
  });
els.tkCardProperties.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-card-property]');
    if (!btn) return;
    var key = btn.getAttribute('data-card-property');
    taskViewState.cardProperties[key] = !taskViewState.cardProperties[key];
    renderDisplayControls();
    render();
  });
els.tkDisplayPopover.addEventListener('click', function (e) {
    if (!e.target.closest('#tkGroupSelect,#tkSortSelect')) closeDisplayChoiceMenu();
    e.stopPropagation();
  });
document.addEventListener('click', function () {
    closeDisplayChoiceMenu();
    if (!els.tkDisplayPopover.classList.contains('hidden')) {
      closeFieldSettings();
      els.tkDisplayPopover.classList.add('hidden');
      els.tkDisplayBtn.classList.remove('active');
      els.tkDisplayBtn.setAttribute('aria-expanded', 'false');
    }
  });
document.addEventListener('focusin', function(e) {
    if (displayChoiceMenu && !displayChoiceMenu.contains(e.target) && e.target !== displayChoiceTrigger) closeDisplayChoiceMenu();
  });
}

function initTaskListFilterEvents() {
els.tkFilterBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (els.tkFilterPanel.classList.contains('hidden')) openFilterPanel();
    else closeFilterPanel();
  });
els.tkFilterPanel.addEventListener('click', function (e) { e.stopPropagation(); });
els.tkFilterPanelBody.addEventListener('mouseover', function (e) {
    var btn = e.target.closest('[data-filter-section]');
    if (btn && btn.getAttribute('data-filter-section') !== activeFilterSection) {
      activeFilterSection = btn.getAttribute('data-filter-section');
      renderFilterMenu();
    }
  });
els.tkFilterPanelBody.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-filter-section]');
    if (btn) { activeFilterSection = btn.getAttribute('data-filter-section'); renderFilterMenu(); return; }
    if (e.target.closest('#tkFilterReset')) {
      taskViewState.filters = []; updateFilterButton(); render(); renderFilterMenu();
    }
  });
els.tkFilterSubmenu.addEventListener('click', function (e) {
    var option = e.target.closest('[data-filter-value]');
    if (option) { toggleFilterValue(activeFilterSection, option.getAttribute('data-filter-value')); return; }
    var dateBtn = e.target.closest('[data-filter-date]');
    if (dateBtn) {
      var op = dateBtn.getAttribute('data-filter-date');
      taskViewState.filters = taskViewState.filters.filter(function (f) { return f.field !== 'dueDate'; });
      taskViewState.filters.push({ field:'dueDate', op:op, value:'' });
      updateFilterButton(); render(); renderFilterMenu();
    }
  });
els.tkFilterSubmenu.addEventListener('change', function (e) {
    if (e.target.id !== 'tkFilterDate') return;
    taskViewState.filters = taskViewState.filters.filter(function (f) { return f.field !== 'dueDate'; });
    if (e.target.value) taskViewState.filters.push({ field:'dueDate', op:'eq', value:e.target.value });
    updateFilterButton(); render(); renderFilterMenu();
  });
document.addEventListener('click', function (e) {
    if (!e.target.closest('#tkFilterPanel') && !e.target.closest('#tkFilterBtn')) closeFilterPanel();
  });
els.tkFilterChips.addEventListener('click', function (e) {
    var chipBtn = e.target.closest('[data-chip-idx]');
    if (chipBtn) {
      var idx = parseInt(chipBtn.getAttribute('data-chip-idx'), 10);
      taskViewState.filters.splice(idx, 1);
      updateFilterButton();
      render();
      return;
    }
    if (e.target.id === 'tkChipClearAll' || e.target.closest('#tkChipClearAll')) {
      taskViewState.filters = [];
      updateFilterButton();
      render();
    }
  });
els.tkListHead.addEventListener('click', function (e) {
    var th = e.target.closest('th[data-sort]');
    if (th) {
      var sortKey = th.getAttribute('data-sort');
      if (taskViewState.sortBy === sortKey) taskViewState.sortDir = taskViewState.sortDir === 'asc' ? 'desc' : taskViewState.sortDir === 'desc' ? 'none' : 'asc';
      else { taskViewState.sortBy = sortKey; taskViewState.sortDir = 'asc'; }
      render();
    }
  });
els.tkCheckAll.addEventListener('change', function () {
    var tasks = getFilteredTasks();
    if (this.checked) tasks.forEach(function (t) { taskViewState.selectedIds.add(t.id); });
    else tasks.forEach(function (t) { taskViewState.selectedIds.delete(t.id); });
    render();
  });
els.tkViewAdd.addEventListener('click', function (e) {
    e.stopPropagation();
    var opening = els.tkViewMenu.classList.contains('hidden');
    els.tkViewMenu.classList.toggle('hidden', !opening);
    els.tkViewAdd.setAttribute('aria-expanded', String(opening));
    closeFilterPanel();
    closeDisplayChoiceMenu();
    closeFieldSettings();
    els.tkDisplayPopover.classList.add('hidden');
    els.tkDisplayBtn.classList.remove('active');
    els.tkDisplayBtn.setAttribute('aria-expanded', 'false');
  });
els.tkViewMenu.addEventListener('click', function (e) { e.stopPropagation(); });
els.tkViewMenuNew.addEventListener('click', function () { closeViewMenu(); openSaveView(); });
els.tkViewManage.addEventListener('click', function () { closeViewMenu(); openManageViews(); });
document.addEventListener('click', function (e) { if (!e.target.closest('.tk-view-action')) closeViewMenu(); });
els.tkViewTabs.addEventListener('click', function (e) {
    var delBtn = e.target.closest('[data-del-view]');
    if (delBtn) {
      e.stopPropagation();
      var viewId = delBtn.getAttribute('data-del-view');
      tkDeleteView(viewId);
      if (taskViewState.activeViewId === viewId) { taskViewState.activeViewId = 'all'; taskViewState.scope = 'all'; }
      render();
      toast('删除成功', 'success');
      return;
    }
    var tab = e.target.closest('.list-page-tab');
    if (tab) {
      var viewId = tab.getAttribute('data-view-id');
      taskViewState.activeViewId = viewId;
      var view = tkGetViews().find(function (v) { return v.id === viewId; });
      if (view && view.scope) {
        taskViewState.scope = view.scope;
      }
      if (view && !view.builtin) {
        taskViewState.filters = (view.filters || []).map(function (f) { return Object.assign({}, f); });
        taskViewState.groupBy = view.groupBy || 'status';
        taskViewState.viewMode = ['slide','full','split'].includes(view.viewMode) ? view.viewMode : 'slide';
        taskViewState.sortBy = view.sortBy || 'updatedAt';
        taskViewState.sortDir = view.sortDir || 'desc';
        taskViewState.layout = view.layout || 'board';
        taskViewState.showSubtasks = view.showSubtasks !== false;
        taskViewState.cardProperties = Object.assign({}, taskViewState.cardProperties, view.cardProperties || {});
        if (Array.isArray(view.listFieldOrder)) taskViewState.listFieldOrder = Array.from(new Set(view.listFieldOrder.filter(function(id) { return DEFAULT_LIST_FIELD_ORDER.includes(id); }))).concat(DEFAULT_LIST_FIELD_ORDER.filter(function(id) { return !view.listFieldOrder.includes(id); }));
        if (view.listFieldVisibility) taskViewState.listFieldVisibility = Object.assign({ labels:false }, view.listFieldVisibility);
        $$('[data-layout]', els.tkLayoutToggle).forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-layout') === taskViewState.layout); });
      }
      updateFilterButton();
      render();
    }
  });
els.tkViewTabs.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.list-page-tab')) { e.preventDefault(); e.target.click(); }
  });
els.tkSaveViewClose.addEventListener('click', closeSaveView);
els.tkSaveViewCancel.addEventListener('click', closeSaveView);
els.tkSaveViewConfirm.addEventListener('click', confirmSaveView);
els.tkSaveViewOverlay.addEventListener('click', function (e) { if (e.target === this) closeSaveView(); });
els.tkManageViewsClose.addEventListener('click', closeManageViews);
els.tkManageViewsCancel.addEventListener('click', closeManageViews);
els.tkManageViewsOverlay.addEventListener('click', function (e) { if (e.target === this) closeManageViews(); });
els.tkManageList.addEventListener('click', function (e) {
    var delBtn = e.target.closest('[data-del-view]');
    if (delBtn) {
      var viewId = delBtn.getAttribute('data-del-view');
      tkDeleteView(viewId);
      if (taskViewState.activeViewId === viewId) { taskViewState.activeViewId = 'all'; taskViewState.scope = 'all'; }
      openManageViews();
      render();
      toast('删除成功', 'success');
      return;
    }
    var renameBtn = e.target.closest('[data-rename-view]');
    if (renameBtn) {
      var viewId = renameBtn.getAttribute('data-rename-view');
      var view = tkGetViews().find(function (v) { return v.id === viewId; });
      if (view) {
        var newName = prompt('输入新名称', view.name);
        if (newName && newName.trim()) { tkRenameView(viewId, newName.trim()); openManageViews(); renderViewBar(); toast('重命名成功', 'success'); }
      }
    }
  });
els.tkBulkClear.addEventListener('click', function () { taskViewState.selectedIds.clear(); render(); });
$$('[data-bulk]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var action = this.getAttribute('data-bulk');
      if (action === 'status') { showPopover(els.tkBulkStatusMenu, this); return; }
      if (action === 'assignee') {
        var selectedTasks = tkGetTasks().filter(function (task) { return taskViewState.selectedIds.has(task.id); });
        var candidates = selectedTasks.length ? tkPeopleInProject(selectedTasks[0].project).filter(function (person) {
          return selectedTasks.every(function (task) { return tkPeopleInProject(task.project).some(function (member) { return member.id === person.id; }); });
        }) : [];
        els.tkBulkAssigneeMenu.innerHTML = candidates.map(function (person) { return '<div class="tk-popover-item" data-assignee="' + person.id + '">' + escapeHtml(person.name) + '</div>'; }).join('') || '<div class="tk-popover-item">所选任务没有共同的项目成员</div>';
        showPopover(els.tkBulkAssigneeMenu, this);
        return;
      }
      if (action === 'delete') {
        var delCount = taskViewState.selectedIds.size;
        taskViewState.selectedIds.forEach(function (id) { tkDeleteTask(id); });
        taskViewState.selectedIds.clear();
        hidePopover();
        render();
        toast('成功删除 ' + delCount + ' 个任务', 'success');
      }
    });
  });
  els.tkBulkStatusMenu.addEventListener('click', function (e) {
    var item = e.target.closest('[data-status]');
    if (item) {
      var status = item.getAttribute('data-status');
      var statusName = (TK_STATUSES.find(function (s) { return s.id === status; }) || {}).name || status;
      var updateCount = taskViewState.selectedIds.size;
      els.tkBulkStatusMenu.innerHTML = TK_STATUSES.map(function (s) {
        return '<div class="tk-popover-item" data-status="' + s.id + '">' + escapeHtml(s.name) + '</div>';
      }).join('');
      taskViewState.selectedIds.forEach(function (id) { tkUpdateTask(id, { status: status }); });
      hidePopover();
      render();
      toast('成功更新 ' + updateCount + ' 个任务状态为「' + statusName + '」', 'success');
    }
  });
  els.tkBulkAssigneeMenu.addEventListener('click', function (e) {
    var item = e.target.closest('[data-assignee]');
    if (item) {
      var assignee = item.getAttribute('data-assignee');
      var assigneeName = tkGetPerson(assignee).name;
      var assignCount = taskViewState.selectedIds.size;
      taskViewState.selectedIds.forEach(function (id) { var task = tkGetTasks().find(function (row) { return row.id === id; }); if (task && tkPeopleInProject(task.project).some(function (person) { return person.id === assignee; })) tkUpdateTask(id, { assignee: assignee }); });
      hidePopover();
      render();
      toast('成功指派 ' + assignCount + ' 个任务给「' + assigneeName + '」', 'success');
    }
  });
}

function initTaskListRowEvents() {
els.tkResetFilter.addEventListener('click', function () {
    taskViewState.filters = []; taskViewState.search = ''; els.tkSearch.value = ''; updateFilterButton(); render();
  });
els.tkBoardScroll.addEventListener('click', function (e) {
    var toggleBtn = e.target.closest('[data-tk-toggle]');
    if (toggleBtn) {
      var tid = parseInt(toggleBtn.getAttribute('data-tk-toggle'), 10);
      var wasCollapsed = collapsedParents.has(tid);
      if (wasCollapsed) {
        collapsedParents.delete(tid);
        render();
        els.tkBoardScroll.classList.add('tk-just-expanded');
        setTimeout(function () { els.tkBoardScroll.classList.remove('tk-just-expanded'); }, 320);
      } else {
        var parentCard = toggleBtn.closest('.tk-card');
        if (parentCard) {
          var next = parentCard.nextElementSibling;
          while (next && next.classList.contains('tk-card--child')) {
            next.classList.add('tk-leaving');
            next = next.nextElementSibling;
          }
        }
        collapsedParents.add(tid);
        setTimeout(function () { render(); }, 260);
      }
      return;
    }
    var addBtn = e.target.closest('[data-add-group]');
    if (addBtn) {
      var groupKey = addBtn.getAttribute('data-add-group');
      openTaskModal(null);
      if (taskViewState.groupBy === 'status') els.tkFormStatus.value = groupKey;
      else if (taskViewState.groupBy === 'priority') els.tkFormPriority.value = groupKey;
      else if (taskViewState.groupBy === 'assignee' && groupKey !== 'unassigned') { var memberProject = tkProjectsForCurrentUser().find(function (project) { return tkPeopleInProject(project.id).some(function (person) { return person.id === groupKey; }); }); if (memberProject) { els.tkFormProject.value = memberProject.id; refreshFormAssignees(groupKey); } }
      else if (taskViewState.groupBy === 'project' && groupKey !== 'none') { els.tkFormProject.value = groupKey; refreshFormAssignees(); }
      return;
    }
    var playBtnB = e.target.closest('[data-card-play]');
    if (playBtnB) { startTaskExec(parseInt(playBtnB.getAttribute('data-card-play'), 10)); return; }
    var moreBtnB = e.target.closest('[data-card-more]');
    if (moreBtnB) { showCardMenu(moreBtnB.getAttribute('data-card-more'), moreBtnB); return; }
    var cardAct = e.target.closest('[data-card-action]');
    if (cardAct) {
      var aid = cardAct.getAttribute('data-card-task');
      var act = cardAct.getAttribute('data-card-action');
      if (act === 'chat') { startTaskExec(parseInt(aid, 10)); } else if (act === 'edit') { openDrawer(aid); }
      else if (act === 'delete') { tkDeleteTask(aid); render(); }
      else if (act === 'copy') { var src = tkGetTasks().find(function(x){return x.id==aid;}); if (src) { var c = Object.assign({}, src, {id: Date.now(), code: 'T' + String(1000000 + Date.now() % 1000000)}); tkAddTask(c); render(); } }
      else if (act === 'subtask') { openTaskModal(null, parseInt(aid, 10)); document.querySelectorAll('.tk-card-menu').forEach(function(m){m.remove();}); return; }
      document.querySelectorAll('.tk-card-menu').forEach(function(m){m.remove();});
      return;
    }
    document.querySelectorAll('.tk-card-menu').forEach(function(m){m.remove();});
    var card = e.target.closest('.tk-card');
    if (card) {
      var id = parseInt(card.getAttribute('data-task-id'), 10);
      if (e.ctrlKey || e.metaKey) {
        if (taskViewState.selectedIds.has(id)) taskViewState.selectedIds.delete(id);
        else taskViewState.selectedIds.add(id);
        render();
      } else {
        openDrawer(id);
      }
    }
  });
els.tkBoardScroll.addEventListener('dragstart', handleDragStart);
els.tkBoardScroll.addEventListener('dragend', handleDragEnd);
els.tkBoardScroll.addEventListener('dragover', handleDragOver);
els.tkBoardScroll.addEventListener('dragleave', handleDragLeave);
els.tkBoardScroll.addEventListener('drop', handleDrop);
els.tkListBody.addEventListener('click', function (e) {
    var toggleBtn = e.target.closest('[data-tk-toggle]');
    if (toggleBtn) {
      animateListSubtasks(toggleBtn);
      return;
    }
    var inlineCreateRow = e.target.closest('#tkRowCreate');
    if (inlineCreateRow && inlineCreateRow.querySelector('#tkInlineCreateBtn')) {
      if (taskViewState.viewMode === 'split') { openTaskModal(null); return; }
      inlineCreateRow.classList.add('is-editing');
      inlineCreateRow.innerHTML = '<td colspan="' + visibleListColumnCount() + '"><div class="tk-inline-create-form"><input type="text" class="tk-inline-input" id="tkInlineTitle" placeholder="输入任务标题"><div class="tk-inline-dropdown" data-value="" id="tkInlineAssigneeWrap"><div class="tk-inline-select is-placeholder" id="tkInlineAssigneeBtn"><input type="text" id="tkInlineAssigneeInput" placeholder="处理人" aria-label="处理人" role="combobox" aria-expanded="false" autocomplete="off"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></div><div class="tk-inline-dropdown-menu" id="tkInlineAssigneeMenu" hidden>' + tkPeopleInProject(projectListProjectId || tkProjectsForCurrentUser()[0]?.id).map(function(p){return '<div class="tk-inline-dropdown-item" data-assignee="'+p.id+'">'+p.name+'</div>';}).join('') + '</div></div><button class="tk-inline-save" id="tkInlineSave">确定</button><button class="tk-inline-cancel" id="tkInlineCancel">取消</button></div></td>';
      setTimeout(function(){ var i=els.tkListBody.querySelector('#tkInlineTitle'); if(i) i.focus(); },0);
      return;
    }
    var inlineSave = e.target.closest('#tkInlineSave');
    if (inlineSave) {
      saveInlineTask();
      return;
    }
    var inlineAssigneeBtn = e.target.closest('#tkInlineAssigneeBtn');
    if (inlineAssigneeBtn) {
      var amenu = els.tkListBody.querySelector('#tkInlineAssigneeMenu');
      if (amenu) {
        if (e.target.id !== 'tkInlineAssigneeInput') amenu.hidden = !amenu.hidden;
        else amenu.hidden = false;
        var quickInput = inlineAssigneeBtn.querySelector('input');
        quickInput.setAttribute('aria-expanded', String(!amenu.hidden));
        if (!amenu.hidden) {
          filterAssigneeOptions(amenu, '.tk-inline-dropdown-item', '');
          quickInput.focus({ preventScroll: true });
        }
      }
      return;
    }
    var inlineAssigneeItem = e.target.closest('[data-assignee]');
    if (inlineAssigneeItem) {
      var awrap = els.tkListBody.querySelector('#tkInlineAssigneeWrap');
      var abtn = els.tkListBody.querySelector('#tkInlineAssigneeBtn');
      var amnu = els.tkListBody.querySelector('#tkInlineAssigneeMenu');
      if (awrap) awrap.setAttribute('data-value', inlineAssigneeItem.getAttribute('data-assignee'));
      if (abtn) {
        abtn.querySelector('input').value = inlineAssigneeItem.textContent;
        abtn.classList.remove('is-placeholder');
        abtn.querySelector('input').setAttribute('aria-expanded', 'false');
      }
      if (amnu) amnu.hidden = true;
      if (abtn) abtn.querySelector('input').focus();
      return;
    }
    var inlineCancel = e.target.closest('#tkInlineCancel');
    if (inlineCancel) { render(); return; }
    if (inlineCreateRow) return;
    if (e.target.classList.contains('tk-row-check')) {
      var id = parseInt(e.target.getAttribute('data-task-id'), 10);
      if (e.target.checked) taskViewState.selectedIds.add(id);
      else taskViewState.selectedIds.delete(id);
      render();
      return;
    }
    var moreBtn2 = e.target.closest('[data-card-more]');
    if (moreBtn2) { showCardMenu(moreBtn2.getAttribute('data-card-more'), moreBtn2); return; }
    var cardAct2 = e.target.closest('[data-card-action]');
    if (cardAct2) {
      var aid2 = cardAct2.getAttribute('data-card-task');
      var act2 = cardAct2.getAttribute('data-card-action');
      if (act2 === 'chat') { startTaskExec(parseInt(aid2, 10)); } else if (act2 === 'edit') { openDrawer(aid2); }
      else if (act2 === 'delete') { tkDeleteTask(aid2); render(); }
      else if (act2 === 'copy') { var src2 = tkGetTasks().find(function(x){return x.id==aid2;}); if (src2) { var c2 = Object.assign({}, src2, {id: Date.now(), code: 'T' + String(1000000 + Date.now() % 1000000)}); tkAddTask(c2); render(); } }
      else if (act2 === 'subtask') { openTaskModal(null, parseInt(aid2, 10)); document.querySelectorAll('.tk-card-menu').forEach(function(m){m.remove();}); return; }
      document.querySelectorAll('.tk-card-menu').forEach(function(m){m.remove();});
      return;
    }
    document.querySelectorAll('.tk-card-menu').forEach(function(m){m.remove();});
    var row = e.target.closest('tr');
    if (row) {
      var id = parseInt(row.getAttribute('data-task-id'), 10);
      if (e.ctrlKey || e.metaKey) {
        if (taskViewState.selectedIds.has(id)) taskViewState.selectedIds.delete(id);
        else taskViewState.selectedIds.add(id);
        render();
      } else {
        openDrawer(id);
      }
    }
  });
els.tkListBody.addEventListener('input', function (e) {
    if (e.target.id !== 'tkInlineAssigneeInput') return;
    var menu = els.tkListBody.querySelector('#tkInlineAssigneeMenu');
    var wrap = els.tkListBody.querySelector('#tkInlineAssigneeWrap');
    wrap.setAttribute('data-value', '');
    menu.hidden = false;
    e.target.setAttribute('aria-expanded', 'true');
    filterAssigneeOptions(menu, '.tk-inline-dropdown-item', e.target.value);
  });
els.tkListBody.addEventListener('keydown', function (e) {
    if (e.target.id === 'tkInlineTitle' && e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      saveInlineTask();
    }
    if (e.target.id === 'tkInlineAssigneeInput') chooseFirstAssignee(els.tkListBody.querySelector('#tkInlineAssigneeMenu'), '.tk-inline-dropdown-item', e);
  });
els.tkBoardScroll.addEventListener('click', function (e) {
    var toggleBtn = e.target.closest('[data-toggle-col]');
    if (toggleBtn) {
      var col = toggleBtn.closest('.tk-board-col');
      var body = col.querySelector('.tk-board-col-body');
      body.classList.toggle('collapsed');
      col.classList.toggle('is-collapsed');
      var toggleLabel = body.classList.contains('collapsed') ? '展开分组' : '折叠分组';
      toggleBtn.setAttribute('data-tooltip', toggleLabel);
      toggleBtn.setAttribute('aria-label', toggleLabel);
      var svg = toggleBtn.querySelector('svg');
      if (body.classList.contains('collapsed')) svg.innerHTML = '<polyline points="18 15 12 9 6 15"/>';
      else svg.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
    }
  });
}

export { restoreViewState, initColumnResize, initTaskListDisplayEvents, initTaskListFilterEvents, initTaskListRowEvents, render, projectListProjectId, showCardMenu, hidePopover, displayChoiceMenu, closeDisplayChoiceMenu, closeFilterPanel, closeViewMenu, closeFieldSettings, tkSetProjectListMode };
