import { tkGetProjectName, tkGetStatusObj } from './data.js';
import { taskExecutionStages } from './task-execution.js';

/* 任务列表的共用行模板与列设置。任务页和项目详情挂载同一个列表实例，
   排序、折叠、选择、快捷新建及详情事件均由任务页的控制器处理。 */
export function renderTaskListTreeNodes(tasks, childrenMap, depth, context) {
  return tasks.map(function (task) {
    var children = childrenMap.get(task.id) || [];
    var hasChildren = children.length > 0;
    var isCollapsed = context.collapsedParents.has(task.id);
    var html = renderTaskListRow(task, { depth:depth, hasChildren:hasChildren, isCollapsed:isCollapsed, childCount:children.length }, context);
    if (hasChildren && !isCollapsed) html += renderTaskListTreeNodes(children, childrenMap, depth + 1, context);
    return html;
  }).join('');
}

function currentTaskStage(task) {
  var stages = taskExecutionStages(task);
  if (!stages.length) return {name:'未规划', index:0, total:0};
  var currentIndex = stages.findIndex(function (stage) { return stage.id === task.executionStageId; });
  if (task.status === 'done') currentIndex = stages.length - 1;
  if (currentIndex < 0 && Array.isArray(task.executionPlan)) {
    currentIndex = task.executionPlan.findIndex(function (stage) { return stage.status !== 'done'; });
  }
  if (currentIndex < 0) currentIndex = 0;
  var current = stages[currentIndex] || stages[0];
  return {name:current.name, index:currentIndex + 1, total:stages.length};
}

function taskListSummary(task, stage) {
  if (task.status === 'blocked') return 'AI 执行已暂停 · 检查点已保存';
  if (task.status === 'in_review') return 'AI 已提交交付物 · 等待你审核';
  if (task.status === 'in_progress') return 'AI 正在执行 · ' + stage.name;
  if (task.status === 'done') return 'AI 已完成交付 · 结果已归档';
  if (task.status === 'cancelled') return '任务已取消';
  if (task.status === 'planned') return '等待确认任务计划';
  return '等待开始处理';
}

function taskDueLabel(task) {
  if (!task.dueDate) return '暂无截止日期';
  var today = new Date();
  var todayKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  if (task.dueDate === todayKey) return '今日截止';
  var parts = task.dueDate.split('-');
  return parts.length === 3 ? Number(parts[1]) + '/' + Number(parts[2]) + ' 截止' : task.dueDate + ' 截止';
}

function renderAdaptiveStageProgress(task, stage, escapeValue) {
  if (!stage.total) return '';
  var stages = taskExecutionStages(task);
  var details = stages.map(function (item, index) {
    var number = index + 1;
    var planStage = Array.isArray(task.executionPlan) ? task.executionPlan.find(function (row) { return row.id === item.id; }) : null;
    var complete = task.status === 'done' || planStage?.status === 'done' || number < stage.index;
    var state = complete ? ' is-complete' : number === stage.index ? ' is-current' : ' is-pending';
    var stateName = complete ? '已完成' : number === stage.index ? '当前阶段' : '待开始';
    return '<li class="tk-stage-popover-item' + state + '"><i aria-hidden="true"></i><span>' + escapeValue(item.name) + '</span><em>' + stateName + '</em></li>';
  }).join('');
  var percent = Math.round(stage.index / stage.total * 100);
  return '<span class="tk-stage-progress-wrap" tabindex="0" aria-label="阶段进度 ' + stage.index + '/' + stage.total + '，当前' + escapeValue(stage.name) + '">'
    + '<span class="tk-stage-progress-track" role="progressbar" aria-valuemin="1" aria-valuemax="' + stage.total + '" aria-valuenow="' + stage.index + '"><i style="width:' + percent + '%"></i></span>'
    + '<span class="tk-stage-progress-count">' + stage.index + '/' + stage.total + '</span>'
    + '<span class="tk-stage-popover" role="tooltip"><span class="tk-stage-popover-head"><strong>任务阶段</strong><b>' + stage.index + '/' + stage.total + '</b></span><ol>' + details + '</ol></span></span>';
}

export function renderTaskListRow(t, opts, context) {
  var depth = opts.depth || 0;
  var hasChildren = !!opts.hasChildren;
  var isCollapsed = !!opts.isCollapsed;
  var childCount = opts.childCount || 0;
  var st = tkGetStatusObj(t.status);
  var sel = context.selectedIds.has(t.id) ? ' selected' : '';
  var stage = currentTaskStage(t);
  var toggle = hasChildren ? '<button class="tk-row-toggle' + (isCollapsed ? ' is-collapsed' : '') + '" data-tk-toggle="' + t.id + '" aria-expanded="' + !isCollapsed + '" aria-label="' + (isCollapsed ? '展开子任务' : '折叠子任务') + '"><svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 7.5 5 5 5-5"/></svg></button>' : '';
  var childBadge = hasChildren ? '<span class="tk-row-child-count"' + (isCollapsed ? '' : ' style="visibility:hidden"') + '>' + childCount + '</span>' : '';
  return '<tr class="tk-row' + sel + (context.drawerTaskId === t.id ? ' detail-active' : '') + (depth ? ' tk-row--child' : '') + (hasChildren ? ' tk-row--parent' : '') + '" data-task-id="' + t.id + '" data-depth="' + depth + '">'
    + '<td class="tk-compact-cell" colspan="12"><div class="tk-compact-task" style="--tk-task-indent:' + (depth * 20) + 'px">'
    + '<div class="tk-compact-main"><div class="tk-compact-title">' + toggle + '<strong>' + context.escapeHtml(t.title) + '</strong>' + childBadge + '</div>'
    + '<div class="tk-compact-meta"><span>' + context.escapeHtml(t.code) + '</span><i>·</i><span>' + context.escapeHtml(tkGetProjectName(t.project)) + '</span><i>/</i><span>' + context.escapeHtml(stage.name) + '</span></div>'
    + '<div class="tk-compact-summary-row"><div class="tk-compact-summary">' + context.escapeHtml(taskListSummary(t, stage)) + '</div>' + renderAdaptiveStageProgress(t, stage, context.escapeHtml) + '</div></div>'
    + '<div class="tk-compact-side"><span class="tk-compact-status" data-status="' + context.escapeHtml(t.status) + '">' + context.escapeHtml(st.name) + '</span><span class="tk-compact-due">' + context.escapeHtml(taskDueLabel(t)) + '</span></div>'
    + '</div></td></tr>';
}

export function taskListVisibleColumnCount(order, visibility) {
  return order.filter(function(id) { return id === 'title' || visibility[id] !== false; }).length + 2;
}

function taskListFieldKey(cell) {
  var match = cell.className.match(/(?:^|\s)tk-col-(code|title|stage|module|status|type|priority|assignee|project|created|desc)(?:\s|$)/);
  return match && match[1];
}

export function applyTaskListFieldSettings(head, body, order, visibility) {
  var rows = [head].concat(Array.from(body.querySelectorAll('tr.tk-row')));
  rows.forEach(function(row) {
    var cells = Array.from(row.children);
    var byKey = Object.create(null);
    cells.forEach(function(cell) { var key = taskListFieldKey(cell); if (key) byKey[key] = cell; });
    order.forEach(function(id) {
      var cell = byKey[id];
      if (!cell) return;
      cell.hidden = id !== 'title' && visibility[id] === false;
      row.appendChild(cell);
    });
    var actions = cells.find(function(cell) { return cell.classList.contains('tk-col-actions'); });
    if (actions) row.appendChild(actions);
  });
  body.querySelectorAll('.tk-row-create td[colspan]').forEach(function(cell) { cell.colSpan = taskListVisibleColumnCount(order, visibility); });
  /* 数据行多于表头一列(操作列)，表头不包含该列以消除空列视觉干扰 */
}
