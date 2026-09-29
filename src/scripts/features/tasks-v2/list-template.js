import { tkGetPerson, tkGetPriorityObj, tkGetProjectName, tkGetStatusObj } from './data.js';

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

function renderTaskListRow(t, opts, context) {
  var depth = opts.depth || 0;
  var hasChildren = !!opts.hasChildren;
  var isCollapsed = !!opts.isCollapsed;
  var childCount = opts.childCount || 0;
  var pri = tkGetPriorityObj(t.priority);
  var st = tkGetStatusObj(t.status);
  var person = tkGetPerson(t.assignee);
  var sel = context.selectedIds.has(t.id) ? ' selected' : '';
  var toggle = hasChildren ? '<button class="tk-row-toggle' + (isCollapsed ? ' is-collapsed' : '') + '" data-tk-toggle="' + t.id + '" aria-expanded="' + !isCollapsed + '" aria-label="' + (isCollapsed ? '展开子任务' : '折叠子任务') + '"><svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 7.5 5 5 5-5"/></svg></button>' : '';
  var spacer = !hasChildren ? '<span class="tk-row-spacer"></span>' : '';
  var childBadge = hasChildren ? '<span class="tk-row-child-count"' + (isCollapsed ? '' : ' style="visibility:hidden"') + '>' + childCount + '</span>' : '';
  var indentStyle = depth > 0 ? ' style="padding-left:calc(10px + ' + depth + 'em)"' : '';
  return '<tr class="tk-row' + sel + (context.drawerTaskId === t.id ? ' detail-active' : '') + (depth ? ' tk-row--child' : '') + (hasChildren ? ' tk-row--parent' : '') + '" data-task-id="' + t.id + '" data-depth="' + depth + '">'
    + '<td class="tk-col-check"><input type="checkbox" class="tk-row-check" data-task-id="' + t.id + '"' + (context.selectedIds.has(t.id) ? ' checked' : '') + '></td>'
    + '<td class="tk-col-code"><span class="tk-row-code">' + context.escapeHtml(t.code) + '</span></td>'
    + '<td class="tk-col-title"' + indentStyle + '><div class="tk-row-title-wrap">' + toggle + spacer + '<span class="tk-row-title-text">' + context.escapeHtml(t.title) + '</span>' + childBadge + '</div></td>'
    + '<td class="tk-col-status"><span class="tk-row-status">' + context.statusSvg(t.status) + context.escapeHtml(st.name) + '</span></td>'
    + '<td class="tk-col-type">' + (t.issueType ? '<span class="tk-row-type" data-type="' + context.escapeHtml(t.issueType) + '">' + context.escapeHtml(t.issueType) + '</span>' : '—') + '</td>'
    + '<td class="tk-col-priority"><span class="tk-row-priority">' + context.escapeHtml(pri.name) + '</span></td>'
    + '<td class="tk-col-assignee"><div class="tk-row-assignee">' + context.avatarSm(t.assignee) + '<span>' + context.escapeHtml(person.name) + '</span></div></td>'
    + '<td class="tk-col-project">' + context.escapeHtml(tkGetProjectName(t.project)) + '</td>'
    + '<td class="tk-col-created">' + context.fmtDate(t.createDate) + '</td>'
    + '<td class="tk-col-desc">' + (t.desc ? '<span class="tk-row-desc" title="' + context.escapeHtml(String(t.desc).replace(/\s+/g, ' ')) + '">' + context.escapeHtml(t.desc) + '</span>' : '—') + '</td>'
    + '<td class="tk-col-actions"><button class="tk-card-more" data-card-more="' + t.id + '" data-tooltip="更多操作" aria-label="更多操作"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button></td></tr>';
}

export function taskListVisibleColumnCount(order, visibility) {
  return order.filter(function(id) { return id === 'title' || visibility[id] !== false; }).length + 2;
}

function taskListFieldKey(cell) {
  var match = cell.className.match(/(?:^|\s)tk-col-(code|title|module|status|type|priority|assignee|project|created|desc)(?:\s|$)/);
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
