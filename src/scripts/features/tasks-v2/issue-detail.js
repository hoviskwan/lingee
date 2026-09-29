import { renderIssueArtifacts } from '../collab/run-artifacts.js';
import { cvSwitchView } from '../collab/view.js';
/* T00 结构拆分：issue-detail。保留原交互；事件在 init* 中按原顺序注册。 */
import { els, taskViewState, setTaskViewState } from './ui-state.js';
import { showView, setNavActive, input } from '../../core/view.js';
import { tkGetTasks, tkPeopleInProject, TK_PEOPLE, TK_AGENTS, TK_LABELS, tkUpdateTask, tkGetStatusObj, tkGetPerson, tkGetStatusName, tkProjectsForCurrentUser, tkCanStartTask, tkCanViewTask, TK_STATUSES, TK_PRIORITIES, tkDeleteTask, tkAddTask, tkCurrentUserId } from './data.js';
import { escapeHtml, stClass, filterAssigneeOptions, chooseFirstAssignee } from './ui-utils.js';
import { render, showCardMenu, hidePopover, displayChoiceMenu, closeDisplayChoiceMenu, closeFilterPanel, closeViewMenu, closeFieldSettings } from './list.js';
import { toast } from '../../core/toast.js';
import { openTaskModal } from './create.js';
import { CV_PROJECTS } from '../collab/data.js';
import { set_activePick } from '../expert/store.js';
import { renderExpertChips } from '../expert/chips.js';
import { setComposerTaskReference, sendComposerText } from '../composer.js';
import { tkAddTaskSession, tkTaskSessionOpeningMessage } from './task-sessions.js';
import { taskStageHandoffPatch } from './task-execution.js';

var drawerPreferredWidth = null;

var subtaskSectionExpanded = new Map();

var flowAssigneeDraft = { taskId: null, assigneeId: '' };

var drawerCloseTimer = null;

var drawerOpenFrame = null;

var DRAWER_WIDTH_STORAGE_KEY = 'lingee_tasks_drawer_width';

var TASK_START_LEGACY_KEY = 'lingee_tasks_start_action_legacy';

var TASK_START_PLAY_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4.7a1 1 0 0 1 1.52-.85l11 7.3a1 1 0 0 1 0 1.7l-11 7.3A1 1 0 0 1 7 19.3V4.7Z"/></svg>';

var TASK_START_CHAT_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

var taskStartLegacy = false;

function renderTaskStartAction() {
  var button = els.tkDrawerChat;
  if (!button) return;
  var task = tkGetTasks().find(function (row) { return row.id === taskViewState.drawerTaskId; });
  button.hidden = task?.status === 'backlog' && !tkCanStartTask(task);
  var label = taskStartLegacy ? '发起会话' : '开始任务';
  button.innerHTML = '<span>' + label + '</span>';
  button.setAttribute('aria-label', label);
}

function openTaskConversation() {
  showView('newtask');
  setNavActive('新会话');
}

/* autoSend 为 true 时（任务「开始执行」）直接发起会话并进入运行中，不再跳输入框等手动发送 */
function openTaskConversationWithTask(taskId, autoSend) {
  var t = tkGetTasks().find(function (x) { return x.id === taskId; });
  if (t) tkAddTaskSession(t, 'start', t.executionStageId || null);
  closeDrawer();
  if (t && autoSend) {
    var project = CV_PROJECTS.find(function(p){ return p.id === t.project; });
    var teamId = t.teamId || (project && project.defaultTeam);
    if (teamId) { set_activePick({kind:'team', id:teamId, auto:false}); renderExpertChips(); }
    setComposerTaskReference(t.id);
    setNavActive('新会话');
    sendComposerText(tkTaskSessionOpeningMessage(t, 'start', t.executionStageId || null));
    return;
  }
  openTaskConversation();
  if (!t) return;
  var project = CV_PROJECTS.find(function(p){ return p.id === t.project; });
  var teamId = t.teamId || (project && project.defaultTeam);
  if (teamId) { set_activePick({kind:'team', id:teamId, auto:false}); renderExpertChips(); }
  setComposerTaskReference(t.id);
  var tags = document.getElementById('ntTags');
  if (tags) {
    tags.innerHTML = '<span class="ctag"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><span class="ctag-label">' + escapeHtml(t.code) + ' ' + escapeHtml(t.title) + '</span><button type="button" class="ctag-x" data-clear-task-ref data-tooltip="移除任务关联" aria-label="移除任务关联"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></span>';
    tags.classList.remove('hidden');
  }
  input.focus();
}

var mentionPanel = null;

var mentionItems = [];

var mentionIndex = 0;

function createMentionPanel(textarea, query) {
  var mentionTask = tkGetTasks().find(function (task) { return task.id === taskViewState.drawerTaskId; });
  var people = (mentionTask ? tkPeopleInProject(mentionTask.project) : TK_PEOPLE).filter(function (p) {
    return !query || p.name.toLowerCase().indexOf(query.toLowerCase()) >= 0;
  });
  var agents = TK_AGENTS.filter(function (a) {
    return !query || a.name.toLowerCase().indexOf(query.toLowerCase()) >= 0;
  });
  var html = '';
  if (people.length > 0) {
    html += '<div class="tk-mention-group"><div class="tk-mention-group-label">人员</div>';
    people.forEach(function (p) {
      html += '<div class="tk-mention-item" data-mention-name="' + escapeHtml(p.name) + '"><span class="tk-mention-avatar" style="background:' + p.color + '">' + escapeHtml(p.avatar) + '</span><span class="tk-mention-name">' + escapeHtml(p.name) + '</span><span class="tk-mention-type">人员</span></div>';
    });
    html += '</div>';
  }
  if (agents.length > 0) {
    html += '<div class="tk-mention-group"><div class="tk-mention-group-label">智能体</div>';
    agents.forEach(function (a) {
      html += '<div class="tk-mention-item" data-mention-name="' + escapeHtml(a.name) + '"><span class="tk-mention-avatar" style="background:' + a.color + '">' + escapeHtml(a.avatar) + '</span><span class="tk-mention-name">' + escapeHtml(a.name) + '</span><span class="tk-mention-type">智能体</span></div>';
    });
    html += '</div>';
  }
  if (!html) html = '<div class="tk-mention-empty">无匹配结果</div>';
  if (!mentionPanel) {
    mentionPanel = document.createElement('div');
    mentionPanel.className = 'tk-mention-panel';
    mentionPanel.addEventListener('click', function (e) {
      var item = e.target.closest('.tk-mention-item');
      if (item) {
        var ta = els.tkDrawerBody.querySelector('textarea');
        if (ta) insertMention(ta, item.getAttribute('data-mention-name'));
      }
    });
    document.body.appendChild(mentionPanel);
  }
  mentionPanel.innerHTML = html;
  var rect = textarea.getBoundingClientRect();
  mentionPanel.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  mentionPanel.style.left = (rect.left + window.scrollX + 12) + 'px';
  mentionPanel.classList.add('show');
  mentionItems = mentionPanel.querySelectorAll('.tk-mention-item');
  mentionIndex = 0;
  if (mentionItems.length > 0) mentionItems[0].classList.add('active');
}

function closeMentionPanel() {
  if (mentionPanel) mentionPanel.classList.remove('show');
}

function insertMention(ta, name) {
  var pos = ta.selectionStart;
  var text = ta.value;
  var atPos = text.lastIndexOf('@', pos);
  if (atPos < 0) { closeMentionPanel(); return; }
  var before = text.substring(0, atPos);
  var after = text.substring(pos);
  ta.value = before + '@' + name + ' ' + after;
  var newPos = atPos + name.length + 2;
  ta.focus();
  ta.setSelectionRange(newPos, newPos);
  closeMentionPanel();
}

var propPickerOptions = {};

var propFieldKeys = { '状态':'status', '处理人':'assignee', '项目':'project', '模块':'module', '优先级':'priority', '截止日期':'dueDate' };

var taskLabelColors = Object.create(null);

var labelPickerMenu = null;

var labelPickerTaskId = null;

var labelPickerMode = 'pick';

var LABEL_PALETTE = ['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#6366f1','#a855f7','#ec4899','#64748b'];

function persistTaskLabelCatalog() {
  try { localStorage.setItem('lingee_task_label_catalog', JSON.stringify({ labels:TK_LABELS, colors:taskLabelColors })); }
  catch (e) { /* 本地存储不可用时仍可在当前页面编辑 */ }
}

function restoreTaskLabelCatalog() {
  try {
    var saved = JSON.parse(localStorage.getItem('lingee_task_label_catalog') || 'null');
    if (!saved || !Array.isArray(saved.labels)) return;
    if (saved.colors && typeof saved.colors === 'object') Object.keys(saved.colors).forEach(function(name) {
      if (/^#[0-9a-f]{6}$/i.test(saved.colors[name])) taskLabelColors[name] = saved.colors[name];
    });
  } catch (e) { /* 忽略损坏的本地缓存 */ }
}

function taskLabelColor(name) {
  if (taskLabelColors[name]) return taskLabelColors[name];
  var hash = 0;
  for (var i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return LABEL_PALETTE[hash % LABEL_PALETTE.length];
}

function taskLabelTextColor(color) {
  var r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
  return (r * .299 + g * .587 + b * .114) / 255 > .55 ? '#111827' : '#f9fafb';
}

function taskLabelCatalog() {
  return Array.from(new Set(TK_LABELS.concat(tkGetTasks().flatMap(function(t) { return t.labels || []; }))));
}

function renderTaskLabelTrigger(task) {
  var labels = task.labels || [];
  return '<div class="tk-label-picker" role="button" tabindex="0" aria-haspopup="listbox" aria-expanded="false" aria-label="编辑标签">' +
    (labels.length ? labels.map(function(name) {
      var color = taskLabelColor(name);
      return '<span class="tk-drawer-label" style="background:' + color + ';color:' + taskLabelTextColor(color) + '"><span>' + escapeHtml(name) + '</span><button type="button" class="tk-drawer-label-remove" data-label-remove="' + escapeHtml(name) + '" aria-label="移除标签 ' + escapeHtml(name) + '">×</button></span>';
    }).join('') : '<span class="tk-label-placeholder"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3h9l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1"/></svg>添加标签</span>') +
    '</div>';
}

function closeTaskLabelPicker() {
  if (labelPickerMenu) labelPickerMenu.remove();
  labelPickerMenu = null;
  labelPickerTaskId = null;
  labelPickerMode = 'pick';
  var trigger = els.tkDrawerBody && els.tkDrawerBody.querySelector('.tk-label-picker');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function updateTaskLabels(task, labels) {
  tkUpdateTask(task.id, { labels: labels });
  var row = els.tkDrawerBody.querySelector('.tk-label-picker');
  if (row) row.outerHTML = renderTaskLabelTrigger(task);
  if (labelPickerMenu) els.tkDrawerBody.querySelector('.tk-label-picker').setAttribute('aria-expanded', 'true');
  render();
}

function renderTaskLabelChoices(query) {
  if (!labelPickerMenu || labelPickerMode !== 'pick') return;
  var task = tkGetTasks().find(function(t) { return t.id === labelPickerTaskId; });
  if (!task) return;
  var normalized = query.trim().toLocaleLowerCase();
  var labels = taskLabelCatalog().filter(function(name) { return name.toLocaleLowerCase().includes(normalized); });
  var list = labelPickerMenu.querySelector('.tk-label-picker-options');
  list.innerHTML = labels.map(function(name) {
    var selected = (task.labels || []).includes(name);
    return '<button type="button" class="tk-label-option' + (selected ? ' selected' : '') + '" data-label-option="' + escapeHtml(name) + '" role="option" aria-selected="' + selected + '"><span class="tk-label-color" style="background:' + taskLabelColor(name) + '"></span><span class="tk-label-option-name">' + escapeHtml(name) + '</span><span class="tk-label-check">' + (selected ? '✓' : '') + '</span></button>';
  }).join('');
  var exact = taskLabelCatalog().some(function(name) { return name.toLocaleLowerCase() === normalized; });
  if (normalized && !exact) list.innerHTML += '<button type="button" class="tk-label-option tk-label-create" data-label-create="' + escapeHtml(query.trim()) + '"><span class="tk-label-create-plus">＋</span><span class="tk-label-option-name">创建“' + escapeHtml(query.trim()) + '”</span><span class="tk-label-color" style="background:' + taskLabelColor(query.trim()) + '"></span></button>';
  if (!list.innerHTML) list.innerHTML = '<div class="tk-label-picker-empty">没有匹配的标签</div>';
}

function renderTaskLabelPickerBody() {
  labelPickerMode = 'pick';
  labelPickerMenu.innerHTML = '<div class="tk-label-search-wrap"><input type="search" class="tk-label-search" placeholder="搜索标签…" aria-label="搜索标签" autocomplete="off"></div><div class="tk-label-picker-options" role="listbox" aria-multiselectable="true"></div><div class="tk-label-popover-footer"><button type="button" data-label-manage>⚙ 管理标签</button></div>';
  renderTaskLabelChoices('');
  labelPickerMenu.querySelector('input').focus({ preventScroll:true });
}

function renderTaskLabelManager() {
  labelPickerMode = 'manage';
  labelPickerMenu.innerHTML = '<div class="tk-label-manager-head"><button type="button" data-label-back aria-label="返回标签选择">‹</button><strong>管理标签</strong></div>' +
    '<div class="tk-label-manager-list">' + taskLabelCatalog().map(function(name) {
      return '<div class="tk-label-manager-row"><input type="color" data-label-color="' + escapeHtml(name) + '" value="' + taskLabelColor(name) + '" aria-label="标签颜色 ' + escapeHtml(name) + '"><input type="text" data-label-rename="' + escapeHtml(name) + '" value="' + escapeHtml(name) + '" aria-label="标签名称"><button type="button" data-label-delete="' + escapeHtml(name) + '" aria-label="删除标签 ' + escapeHtml(name) + '">×</button></div>';
    }).join('') + '</div><div class="tk-label-manager-add"><input type="text" class="tk-label-manager-new" placeholder="新标签名称" aria-label="新标签名称"><button type="button" data-label-add>添加</button></div>';
}

function refreshTaskLabelDisplay() {
  var task = tkGetTasks().find(function(t) { return t.id === taskViewState.drawerTaskId; });
  var row = els.tkDrawerBody.querySelector('.tk-label-picker');
  if (task && row) {
    row.outerHTML = renderTaskLabelTrigger(task);
    els.tkDrawerBody.querySelector('.tk-label-picker').setAttribute('aria-expanded', 'true');
  }
  render();
}

function openTaskLabelPicker(trigger) {
  closeTaskLabelPicker();
  labelPickerTaskId = taskViewState.drawerTaskId;
  labelPickerMenu = document.createElement('div');
  labelPickerMenu.className = 'tk-label-popover';
  renderTaskLabelPickerBody();
  labelPickerMenu.addEventListener('input', function(e) {
    if (e.target.classList.contains('tk-label-search')) renderTaskLabelChoices(e.target.value);
  });
  labelPickerMenu.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeTaskLabelPicker(); return; }
    if (e.isComposing) return;
    if (e.key === 'Enter' && e.target.classList.contains('tk-label-manager-new')) {
      e.preventDefault();
      labelPickerMenu.querySelector('[data-label-add]').click();
      return;
    }
    if (e.key === 'Enter' && e.target.classList.contains('tk-label-search')) {
      var first = labelPickerMenu.querySelector('.tk-label-option');
      if (first) { e.preventDefault(); first.click(); }
    }
    if (e.key === 'ArrowDown' && e.target.classList.contains('tk-label-search')) {
      var option = labelPickerMenu.querySelector('.tk-label-option');
      if (option) { e.preventDefault(); option.focus(); }
    }
    var focusedOption = e.target.closest('.tk-label-option');
    if (focusedOption) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var options = Array.from(labelPickerMenu.querySelectorAll('.tk-label-option'));
        var index = options.indexOf(focusedOption) + (e.key === 'ArrowDown' ? 1 : -1);
        if (options[index]) options[index].focus();
        else labelPickerMenu.querySelector('.tk-label-search').focus();
      }
    }
  });
  labelPickerMenu.addEventListener('click', function(e) {
    if (e.target.closest('[data-label-manage]')) { renderTaskLabelManager(); return; }
    if (e.target.closest('[data-label-back]')) { renderTaskLabelPickerBody(); return; }
    var add = e.target.closest('[data-label-add]');
    if (add) {
      var newName = labelPickerMenu.querySelector('.tk-label-manager-new').value.trim();
      if (newName && !taskLabelCatalog().some(function(name) { return name.toLocaleLowerCase() === newName.toLocaleLowerCase(); })) {
        TK_LABELS.push(newName);
        persistTaskLabelCatalog();
        renderTaskLabelManager();
      }
      return;
    }
    var removeCatalog = e.target.closest('[data-label-delete]');
    if (removeCatalog) {
      var oldName = removeCatalog.getAttribute('data-label-delete');
      var index = TK_LABELS.indexOf(oldName);
      if (index >= 0) TK_LABELS.splice(index, 1);
      tkGetTasks().forEach(function(task) {
        if ((task.labels || []).includes(oldName)) tkUpdateTask(task.id, { labels: task.labels.filter(function(name) { return name !== oldName; }) });
      });
      delete taskLabelColors[oldName];
      persistTaskLabelCatalog();
      refreshTaskLabelDisplay();
      if (labelPickerMenu) renderTaskLabelManager();
      return;
    }
    var option = e.target.closest('[data-label-option]');
    var create = e.target.closest('[data-label-create]');
    if (!option && !create) return;
    var task = tkGetTasks().find(function(t) { return t.id === labelPickerTaskId; });
    if (!task) return;
    var name = option ? option.getAttribute('data-label-option') : create.getAttribute('data-label-create');
    var selected = task.labels || [];
    if (create && !TK_LABELS.includes(name)) { TK_LABELS.push(name); persistTaskLabelCatalog(); }
    updateTaskLabels(task, selected.includes(name) ? selected.filter(function(label) { return label !== name; }) : selected.concat(name));
    var search = labelPickerMenu && labelPickerMenu.querySelector('.tk-label-search');
    if (search) {
      if (create) search.value = '';
      renderTaskLabelChoices(search.value);
      search.focus({ preventScroll:true });
    }
  });
  labelPickerMenu.addEventListener('change', function(e) {
    var colorName = e.target.getAttribute('data-label-color');
    if (colorName) {
      taskLabelColors[colorName] = e.target.value;
      persistTaskLabelCatalog();
      refreshTaskLabelDisplay();
      return;
    }
    var oldName = e.target.getAttribute('data-label-rename');
    if (!oldName) return;
    var nextName = e.target.value.trim();
    if (!nextName || nextName === oldName || taskLabelCatalog().some(function(name) { return name.toLocaleLowerCase() === nextName.toLocaleLowerCase(); })) {
      e.target.value = oldName;
      return;
    }
    var index = TK_LABELS.indexOf(oldName);
    if (index >= 0) TK_LABELS[index] = nextName;
    else TK_LABELS.push(nextName);
    tkGetTasks().forEach(function(task) {
      if ((task.labels || []).includes(oldName)) tkUpdateTask(task.id, { labels: task.labels.map(function(name) { return name === oldName ? nextName : name; }) });
    });
    taskLabelColors[nextName] = taskLabelColors[oldName] || taskLabelColor(oldName);
    delete taskLabelColors[oldName];
    persistTaskLabelCatalog();
    refreshTaskLabelDisplay();
    if (labelPickerMenu) renderTaskLabelManager();
  });
  document.body.appendChild(labelPickerMenu);
  renderTaskLabelChoices('');
  var rect = trigger.getBoundingClientRect();
  labelPickerMenu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - labelPickerMenu.offsetWidth - 8)) + 'px';
  labelPickerMenu.style.top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - labelPickerMenu.offsetHeight - 8)) + 'px';
  trigger.setAttribute('aria-expanded', 'true');
  labelPickerMenu.querySelector('input').focus({ preventScroll:true });
}

function propPicker(name, currentVal, options, isDate) {
  var display = isDate ? (currentVal || '—') : (options.find(function (o) { return o.value === currentVal; }) || {}).label || '—';
  if (isDate) {
    return '<div class="tk-prop-row"><span>' + name + '</span><input type="date" class="tk-prop-edit" data-prop="' + propFieldKeys[name] + '" value="' + escapeHtml(currentVal || '') + '"></div>';
  }
  propPickerOptions[name] = { options: options, currentVal: currentVal, key: propFieldKeys[name] };
  return '<div class="tk-prop-row"><span>' + name + '</span><div class="tk-prop-display" data-prop-name="' + escapeHtml(name) + '">' + (name === '处理人' ? '<input class="tk-prop-assignee-input" type="text" value="' + escapeHtml(display === '—' ? '' : display) + '" placeholder="处理人" aria-label="处理人" role="combobox" aria-expanded="false" autocomplete="off">' : escapeHtml(display)) + '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div></div>';
}

function drawerWidthBounds() {
  return { min:480, max:window.innerWidth - 100 };
}

function setDrawerWidth(width, remember) {
  var bounds = drawerWidthBounds();
  var next = Math.round(Math.min(bounds.max, Math.max(bounds.min, width)));
  els.tkDrawer.style.setProperty('--tk-drawer-width', next + 'px');
  els.tkDrawerResize.setAttribute('aria-valuemin', String(bounds.min));
  els.tkDrawerResize.setAttribute('aria-valuemax', String(bounds.max));
  els.tkDrawerResize.setAttribute('aria-valuenow', String(next));
  if (remember) {
    drawerPreferredWidth = next;
    try { localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(next)); }
    catch (e) { /* 本地存储不可用时保留当前页面的偏好 */ }
  }
  return next;
}

function applyDrawerWidth() {
  if (window.innerWidth <= 760) return;
  setDrawerWidth(drawerPreferredWidth || Math.min(900, window.innerWidth * .75), false);
}

function syncDrawerClickaway() {
  els.tkDrawerClickaway.classList.toggle('hidden', taskViewState.viewMode !== 'slide' || !els.tkDrawer.classList.contains('show'));
}

function renderSubtasksSection(t) {
  var children = tkGetTasks().filter(function (c) { return c.parentId === t.id && tkCanViewTask(c); });
  if (!children.length) {
    return '<div class="tk-subtasks tk-subtasks-empty"><button type="button" class="tk-subtask-empty-add" data-drawer-subtask="' + t.id + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>添加子任务</span></button></div>';
  }
  var expanded = subtaskSectionExpanded.has(t.id) ? subtaskSectionExpanded.get(t.id) : true;
  var doneCount = children.filter(function (c) { return c.status === 'done'; }).length;
  var prog = children.length ? Math.round(doneCount / children.length * 100) : 0;
  var ringR = 7, ringC = 2 * Math.PI * ringR;
  var ringOffset = ringC * (1 - prog / 100);
  return '<div class="tk-subtasks' + (expanded ? '' : ' is-collapsed') + '">'
    + '<div class="tk-subtask-head">'
    + '<button type="button" class="tk-subtask-toggle" data-subtask-toggle="' + t.id + '" aria-expanded="' + expanded + '" aria-controls="tkSubtaskList"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg><span>子任务</span></button>'
    + '<svg class="tk-subtask-progress-ring" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="' + ringR + '" fill="none" stroke="var(--fill-2)" stroke-width="2"/><circle cx="8" cy="8" r="' + ringR + '" fill="none" stroke="var(--brand)" stroke-width="2" stroke-dasharray="' + ringC.toFixed(1) + '" stroke-dashoffset="' + ringOffset.toFixed(1) + '" stroke-linecap="round" transform="rotate(-90 8 8)"/></svg><span class="tk-subtask-badge">' + doneCount + '/' + children.length + '</span>'
    + '<button type="button" class="tk-subtask-add-btn" data-drawer-subtask="' + t.id + '" data-tooltip="添加子任务" aria-label="添加子任务"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'
    + '</div>'
    + '<div class="tk-subtask-list" id="tkSubtaskList"' + (expanded ? '' : ' hidden') + '>'
    + children.map(function (c) {
        var st = tkGetStatusObj(c.status);
        return '<button type="button" class="tk-subtask-row" data-subtask-open="' + c.id + '"><span class="tk-subtask-status" data-tooltip="' + escapeHtml(st.name || '待处理') + '" role="img" aria-label="' + escapeHtml(st.name || '待处理') + '"><span class="tk-subtask-status-dot ' + stClass(c.status) + '"></span></span><span class="tk-subtask-title">' + escapeHtml(c.title) + '</span><span class="tk-subtask-meta">' + escapeHtml(tkGetPerson(c.assignee).name) + '</span></button>';
      }).join('')
    + '</div></div>';
}

function renderTaskComments(t) {
  var comments = t.comments || [];
  if (!comments.length) return '<div class="tk-drawer-comments-empty">暂无动态</div>';
  return comments.slice().reverse().map(function (entry) {
    var author = tkGetPerson(entry.authorId).name;
    var summary = '流转至「' + tkGetStatusName(entry.status) + '」，处理人「' + tkGetPerson(entry.assignee).name + '」';
    return '<div class="tk-drawer-comment">'
      + '<div class="tk-drawer-comment-head"><span class="tk-drawer-comment-author">' + escapeHtml(author) + '</span><span class="tk-drawer-comment-time">' + escapeHtml(entry.createdAt) + '</span></div>'
      + '<div class="tk-drawer-comment-action">' + escapeHtml(summary) + '</div>'
      + (entry.text ? '<div class="tk-drawer-comment-text">' + escapeHtml(entry.text) + '</div>' : '')
      + '</div>';
  }).join('');
}

/* 流转操作记录：kind 为 'flow'；历史数据没有 kind，用 assignee 字段识别。 */
function isFlowRecord(entry) {
  return entry && (entry.kind === 'flow' || (!entry.kind && entry.assignee));
}
function flowRecordAction(entry) {
  var action = '将任务流转给「' + tkGetPerson(entry.assignee).name + '」';
  if (entry.fromStatus && entry.status && entry.fromStatus !== entry.status) {
    action = '状态从「' + tkGetStatusName(entry.fromStatus) + '」变更为「' + tkGetStatusName(entry.status) + '」，并流转给「' + tkGetPerson(entry.assignee).name + '」';
  }
  return entry.text ? action + '：' + entry.text : action;
}
function renderTaskChangelog(t) {
  var entries = [{
    time: t.createdAt || (t.createDate + ' 09:30'),
    user: tkGetPerson(t.createdBy).name,
    action: '创建了任务',
  }];
  (t.statusHistory || []).forEach(function (change) {
    entries.push({
      time: change.time,
      user: tkGetPerson(change.authorId).name,
      action: '状态从「' + tkGetStatusName(change.from) + '」变更为「' + tkGetStatusName(change.to) + '」',
    });
  });
  (t.comments || []).forEach(function (entry) {
    if (!isFlowRecord(entry)) return;
    entries.push({ time: entry.createdAt, user: tkGetPerson(entry.authorId).name, action: flowRecordAction(entry) });
  });
  entries.sort(function (left, right) { return String(left.time).localeCompare(String(right.time)); });
  return entries.map(function (entry) {
    return '<div class="tk-drawer-changelog-item"><span class="tk-drawer-changelog-time">' + escapeHtml(entry.time) + '</span><span class="tk-drawer-changelog-user">' + escapeHtml(entry.user) + '</span>' + escapeHtml(entry.action) + '</div>';
  }).join('');
}

function taskCommentTimestamp() {
  var now = new Date();
  function pad(value) { return String(value).padStart(2, '0'); }
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' '
    + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
}

function openDrawer(taskId) {
  closeTaskLabelPicker();
  var t = tkGetTasks().find(function (x) { return x.id === taskId; });
  if (!t) return;
  if (!tkCanViewTask(t)) { toast('未参与该任务，无法查看', 'warning'); return; }
  if (flowAssigneeDraft.taskId !== taskId) {
    var savedAssignee = tkPeopleInProject(t.project).some(function (person) { return person.id === t.flowAssignee; }) ? t.flowAssignee : '';
    flowAssigneeDraft = { taskId: taskId, assigneeId: savedAssignee };
  }
  setTaskViewState({ drawerTaskId: taskId });
  els.tkDrawer.setAttribute('data-task-id', String(taskId));
  var person = tkGetPerson(t.assignee);
  var creator = tkGetPerson(t.createdBy);
  var statusOpts = TK_STATUSES.map(function (s) { return { value: s.id, label: s.name }; });
  var priOpts = TK_PRIORITIES.map(function (p) { return { value: p.id, label: p.name }; });
  var peopleOpts = tkPeopleInProject(t.project).map(function (p) { return { value: p.id, label: p.name }; });
  var projOpts = tkProjectsForCurrentUser().map(function (p) { return { value: p.id, label: p.name }; });
  var moduleOpts = Array.from(new Set(tkGetTasks().filter(function (task) { return task.project === t.project && task.module; }).map(function (task) { return task.module; }))).sort().map(function (name) { return { value:name, label:name }; });
  els.tkDrawerTitle.textContent = t.title;
  els.tkDrawerCode.textContent = '#' + t.code;
  els.tkDrawerBody.innerHTML =
    '<div class="tk-drawer-main"><div class="tk-drawer-main-inner">' +
      '<div class="tk-drawer-tabs">' +
        '<button type="button" class="tk-drawer-tab active" data-tab="info">基础信息</button>' +
        '<button type="button" class="tk-drawer-tab" data-tab="changelog">变更日志</button>' +
      '</div>' +
      '<div class="tk-drawer-tab-content active" data-tab-content="info">' +
        '<div class="tk-drawer-desc" contenteditable="true" data-field="desc">' + escapeHtml(t.desc || '点击添加描述…') + '</div>' +
        '<div class="tk-drawer-attachments">' +
          '<div class="tk-attach-dropzone" id="tkAttachDropzone" role="button" tabindex="0" data-tooltip="添加附件（支持粘贴、拖拽）" aria-label="添加附件（支持粘贴、拖拽）">' +
            '<input type="file" id="tkAttachInput" multiple style="display:none">' +
            '<svg class="tk-attach-btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>' +
          '</div>' +
          '<div class="tk-attach-list" id="tkAttachList"></div>' +
        '</div>' +
        renderIssueArtifacts(t) +
        renderSubtasksSection(t) +
        '<div class="tk-drawer-comments"><div class="tk-drawer-comments-title">动态</div>' +
          renderTaskComments(t) +
          '<div class="tk-drawer-flow-fields">' +
            '<div class="tk-flow-field"><span class="tk-flow-field-label">状态</span><div class="tk-flow-pills">' +
              TK_STATUSES.map(function(s) { return '<button type="button" class="tk-flow-pill' + (s.id === t.status ? ' active' : '') + '" data-flow-status="' + s.id + '">' + s.name + '</button>'; }).join('') +
            '</div></div>' +
            '<div class="tk-flow-field"><span class="tk-flow-field-label">处理人</span><div class="tk-flow-field-value tk-flow-field-lg' + (flowAssigneeDraft.assigneeId ? '' : ' is-placeholder') + '" data-flow-prop="assignee"><input class="tk-flow-field-text" type="text" value="' + (flowAssigneeDraft.assigneeId ? escapeHtml(tkGetPerson(flowAssigneeDraft.assigneeId).name) : '') + '" placeholder="请选择" aria-label="处理人" role="combobox" aria-expanded="false" autocomplete="off"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></div></div>' +
          '</div>' +
          '<div class="tk-drawer-comment-input"><textarea placeholder="输入评论… 使用 @ 提及人员"></textarea></div>' +
          '<button class="tk-drawer-flow-btn" data-action="flow">流转</button>' +
        '</div>' +
      '</div>' +
      '<div class="tk-drawer-tab-content" data-tab-content="changelog" hidden>' +
        '<div class="tk-drawer-changelog-list">' + renderTaskChangelog(t) + '</div>' +
      '</div>' +
    '</div></div>' +
    '<div class="tk-drawer-sidebar" id="tkDrawerSidebar">' +
      '<div class="tk-drawer-prop-list" id="tkDrawerPropList">' +
        propPicker('状态', t.status, statusOpts) +
        propPicker('处理人', t.assignee, peopleOpts) +
        propPicker('项目', t.project, projOpts) +
        propPicker('模块', t.module, moduleOpts) +
        propPicker('优先级', t.priority, priOpts) +
        propPicker('截止日期', t.dueDate, null, true) +
        '<div class="tk-prop-row"><span>标签</span>' + renderTaskLabelTrigger(t) + '</div>' +
      '</div>' +
      '<div class="tk-prop-row"><span>创建者</span><span class="tk-prop-val">' + escapeHtml(creator.name) + '</span></div>' +
      '<div class="tk-prop-row"><span>创建时间</span><span class="tk-prop-val">' + escapeHtml(t.createdAt || t.createDate) + '</span></div>' +
      '<div class="tk-prop-row"><span>更新时间</span><span class="tk-prop-val">' + escapeHtml(t.updatedAt || t.createdAt || t.createDate) + '</span></div>' +
    '</div>';
  /* 附件上传初始化 */
  (function(){
    var dz = els.tkDrawerBody.querySelector('#tkAttachDropzone');
    var fi = els.tkDrawerBody.querySelector('#tkAttachInput');
    var al = els.tkDrawerBody.querySelector('#tkAttachList');
    if (!dz || !fi || !al) return;
    function renderFiles(files) {
      Array.prototype.forEach.call(files, function(f) {
        var item = document.createElement('div');
        item.className = 'tk-attach-item';
        var sz = f.size < 1024 ? f.size + 'B' : f.size < 1048576 ? (f.size/1024).toFixed(1)+'KB' : (f.size/1048576).toFixed(1)+'MB';
        item.innerHTML = '<span class="tk-attach-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span><span class="tk-attach-item-name">' + escapeHtml(f.name) + '</span>' + (sz ? '<span class="tk-attach-item-size">' + sz + '</span>' : '') + '<button class="tk-attach-item-btn" data-tooltip="预览" aria-label="预览"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></button><button class="tk-attach-item-btn" data-tooltip="下载" aria-label="下载"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button><button class="tk-attach-item-btn tk-attach-item-remove" data-attach-remove data-tooltip="删除" aria-label="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
        al.appendChild(item);
      });
    }
    fi.onchange = function() { renderFiles(fi.files); fi.value=''; };
    dz.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); }
    };
    dz.ondragover = function(e) { e.preventDefault(); dz.classList.add('dragover'); };
    dz.ondragleave = function() { dz.classList.remove('dragover'); };
    dz.ondrop = function(e) { e.preventDefault(); dz.classList.remove('dragover'); renderFiles(e.dataTransfer.files); };
    els.tkDrawer.onpaste = function(e) {
      if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
      var files = Array.from((e.clipboardData && e.clipboardData.items) || []).map(function(item) {
        return item.kind === 'file' ? item.getAsFile() : null;
      }).filter(Boolean);
      if (files.length) { e.preventDefault(); renderFiles(files); }
    };
  })();
  clearTimeout(drawerCloseTimer);
  cancelAnimationFrame(drawerOpenFrame);
  els.tkDrawer.classList.remove('hidden');
  if (taskViewState.viewMode === 'split') {
    els.tkDrawer.classList.add('show');
    syncDrawerClickaway();
    els.tkSplitEmpty.classList.add('hidden');
    els.tkListBody.querySelectorAll('tr[data-task-id]').forEach(function (row) {
      row.classList.toggle('detail-active', row.getAttribute('data-task-id') === String(taskId));
    });
    return;
  }
  drawerOpenFrame = requestAnimationFrame(function () {
    els.tkDrawer.classList.add('show');
    syncDrawerClickaway();
  });
}

function closeDrawer() {
  closeTaskLabelPicker();
  document.querySelectorAll('.tk-drawer-more-menu').forEach(function (m) { m.remove(); });
  els.tkDrawerMore.setAttribute('aria-expanded', 'false');
  flowAssigneeDraft = { taskId: null, assigneeId: '' };
  cancelAnimationFrame(drawerOpenFrame);
  els.tkDrawer.classList.remove('show');
  syncDrawerClickaway();
  clearTimeout(drawerCloseTimer);
  if (taskViewState.viewMode === 'split') {
    els.tkDrawer.classList.add('hidden');
    els.tkSplitEmpty.classList.remove('hidden');
    els.tkListBody.querySelectorAll('tr.detail-active').forEach(function (row) { row.classList.remove('detail-active'); });
    setTaskViewState({ drawerTaskId: null });
    return;
  }
  drawerCloseTimer = setTimeout(function () {
    els.tkDrawer.classList.add('hidden');
  }, 250);
  setTaskViewState({ drawerTaskId: null });
}

function initTaskDetailEvents() {
els.tkDrawerClose.addEventListener('click', closeDrawer);
els.tkDrawerClickaway.addEventListener('click', closeDrawer);
els.tkDrawerMore.addEventListener('click', function (e) {
    e.stopPropagation();
    var openMenu = document.querySelector('.tk-drawer-more-menu');
    if (openMenu) {
      openMenu.remove();
      this.setAttribute('aria-expanded', 'false');
    } else if (taskViewState.drawerTaskId) {
      showCardMenu(taskViewState.drawerTaskId, this, true);
      this.setAttribute('aria-expanded', 'true');
    }
  });
document.addEventListener('click', function (e) {
    if (e.target.closest('.tk-drawer-more-menu') || e.target.closest('#tkDrawerMore')) return;
    document.querySelectorAll('.tk-drawer-more-menu').forEach(function (m) { m.remove(); });
    els.tkDrawerMore.setAttribute('aria-expanded', 'false');
  });
els.tkDrawerResize.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || window.innerWidth <= 760 || taskViewState.viewMode !== 'slide') return;
    e.preventDefault();
    var handle = this;
    var pointerId = e.pointerId;
    var startX = e.clientX;
    var startWidth = els.tkDrawer.getBoundingClientRect().width;
    handle.setPointerCapture(pointerId);
    els.tkDrawer.classList.add('resizing');
    document.body.classList.add('tk-drawer-resizing');
    function move(ev) {
      if (ev.pointerId !== pointerId) return;
      setDrawerWidth(startWidth + startX - ev.clientX, false);
    }
    function end(ev) {
      if (ev.pointerId !== pointerId) return;
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      els.tkDrawer.classList.remove('resizing');
      document.body.classList.remove('tk-drawer-resizing');
      setDrawerWidth(els.tkDrawer.getBoundingClientRect().width, true);
    }
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
els.tkDrawerResize.addEventListener('keydown', function (e) {
    if (window.innerWidth <= 760 || taskViewState.viewMode !== 'slide' || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    setDrawerWidth(els.tkDrawer.getBoundingClientRect().width + (e.key === 'ArrowLeft' ? 24 : -24), true);
  });
window.addEventListener('resize', applyDrawerWidth);
if (els.tkDrawerChat) {
    els.tkDrawerChat.addEventListener('click', function () {
      if (!taskViewState.drawerTaskId) return;
      var task = tkGetTasks().find(function (row) { return row.id === taskViewState.drawerTaskId; });
      if (task?.status === 'backlog' && !tkCanStartTask(task)) return;
      openTaskConversationWithTask(taskViewState.drawerTaskId, true);
    });
    var lastRightClickToggle = 0;
    function toggleTaskStartAction() {
      taskStartLegacy = !taskStartLegacy;
      try { localStorage.setItem(TASK_START_LEGACY_KEY, taskStartLegacy ? '1' : '0'); } catch (err) { /* 本地存储不可用时仅在当前页面生效 */ }
      renderTaskStartAction();
      lastRightClickToggle = Date.now();
    }
    els.tkDrawerChat.addEventListener('pointerdown', function (e) {
      if (e.button !== 2) return;
      e.preventDefault();
      toggleTaskStartAction();
    });
    els.tkDrawerChat.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (Date.now() - lastRightClickToggle > 500) toggleTaskStartAction();
    });
  }
els.tkDrawerBody.addEventListener('input', function (e) {
    if (!e.target.matches('textarea')) return;
    var ta = e.target;
    var pos = ta.selectionStart;
    var text = ta.value.substring(0, pos);
    var atPos = text.lastIndexOf('@');
    if (atPos < 0) { closeMentionPanel(); return; }
    if (atPos > 0 && text[atPos - 1] !== ' ' && text[atPos - 1] !== '\n') { closeMentionPanel(); return; }
    var query = text.substring(atPos + 1);
    if (/\s/.test(query)) { closeMentionPanel(); return; }
    createMentionPanel(ta, query);
  });
els.tkDrawerBody.addEventListener('keydown', function (e) {
    if (!mentionPanel || !mentionPanel.classList.contains('show')) return;
    if (!e.target.matches('textarea')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      mentionIndex = Math.min(mentionIndex + 1, mentionItems.length - 1);
      mentionItems.forEach(function (item, i) { item.classList.toggle('active', i === mentionIndex); });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      mentionIndex = Math.max(mentionIndex - 1, 0);
      mentionItems.forEach(function (item, i) { item.classList.toggle('active', i === mentionIndex); });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (mentionItems[mentionIndex]) insertMention(e.target, mentionItems[mentionIndex].getAttribute('data-mention-name'));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMentionPanel();
    }
  });
els.tkDrawerBody.addEventListener('click', function (e) {
    var labelRemove = e.target.closest('[data-label-remove]');
    if (labelRemove && taskViewState.drawerTaskId) {
      var taskForRemove = tkGetTasks().find(function(t) { return t.id === taskViewState.drawerTaskId; });
      if (taskForRemove) updateTaskLabels(taskForRemove, (taskForRemove.labels || []).filter(function(name) { return name !== labelRemove.getAttribute('data-label-remove'); }));
      if (labelPickerMenu && labelPickerMode === 'pick') renderTaskLabelChoices(labelPickerMenu.querySelector('.tk-label-search').value);
      return;
    }
    var labelTrigger = e.target.closest('.tk-label-picker');
    if (labelTrigger) {
      if (labelPickerMenu) closeTaskLabelPicker();
      else openTaskLabelPicker(labelTrigger);
      return;
    }
    var toggle = e.target.closest('#tkDrawerPropToggle');
    if (toggle) {
      toggle.classList.toggle('collapsed');
      var list = els.tkDrawerBody.querySelector('#tkDrawerPropList');
      if (list) list.classList.toggle('collapsed');
      return;
    }
    /* 属性 Popover Picker（菜单添加到 body，避免侧边栏 overflow 裁切） */
    var display = e.target.closest('.tk-prop-display');
    if (display) {
      var propName = display.getAttribute('data-prop-name');
      var data = propPickerOptions[propName];
      var existing = document.querySelector('.tk-prop-menu.show');
      if (existing) {
        if (propName === '处理人' && e.target.closest('input')) return;
        existing.remove();
        if (propName === '处理人') return;
        return;
      }
      if (!data) return;
      var menu = document.createElement('div');
      menu.className = 'tk-prop-menu show';
      menu.setAttribute('data-prop', propName);
      menu.innerHTML = data.options.map(function (o) {
        return '<div class="tk-prop-menu-item' + (o.value === data.currentVal ? ' active' : '') + '" data-value="' + escapeHtml(o.value) + '">' + escapeHtml(o.label) + '</div>';
      }).join('');
      if (propName === '处理人') filterAssigneeOptions(menu, '.tk-prop-menu-item', '');
      menu.addEventListener('click', function (ev) {
        var item = ev.target.closest('.tk-prop-menu-item');
        if (item) {
          var prop = (propPickerOptions[menu.getAttribute('data-prop')] || {}).key;
          var val = item.getAttribute('data-value');
          if (taskViewState.drawerTaskId && prop && val) {
            var patch = {}; patch[prop] = val;
            if (prop === 'project') {
              var task = tkGetTasks().find(function (row) { return row.id === taskViewState.drawerTaskId; });
              if (task && !tkPeopleInProject(val).some(function (person) { return person.id === task.assignee; })) patch.assignee = tkPeopleInProject(val)[0]?.id || '';
            }
            tkUpdateTask(taskViewState.drawerTaskId, patch);
            render();
            openDrawer(taskViewState.drawerTaskId);
          }
          menu.remove();
        }
      });
      document.body.appendChild(menu);
      var rect = display.getBoundingClientRect();
      menu.style.top = (rect.bottom + 4) + 'px';
      menu.style.left = rect.left + 'px';
      if (propName === '处理人') {
        var propInput = display.querySelector('input');
        propInput.setAttribute('aria-expanded', 'true');
        if (e.target !== propInput) propInput.focus({ preventScroll: true });
      }
      return;
    }
    /* 三点菜单按钮 */
    var moreBtn = e.target.closest('[data-card-more]');
    if (moreBtn) { showCardMenu(moreBtn.getAttribute('data-card-more'), moreBtn); return; }
    /* 下拉菜单项 */
    var cardAct = e.target.closest('[data-card-action]');
    if (cardAct) {
      var aid = cardAct.getAttribute('data-card-task');
      var act = cardAct.getAttribute('data-card-action');
      if (act === 'chat') { openTaskConversationWithTask(parseInt(aid, 10), true); }
      else if (act === 'delete') { tkDeleteTask(aid); render(); toast('删除成功', 'success'); }
      else if (act === 'copy') { var src = tkGetTasks().find(function(x){return x.id==aid;}); if (src) { var c = Object.assign({}, src, {id: Date.now(), code: 'T' + String(1000000 + Date.now() % 1000000)}); tkAddTask(c); render(); toast('复制成功', 'success'); } }
      else if (act === 'subtask') { openTaskModal(null, parseInt(aid, 10)); document.querySelectorAll('.tk-card-menu').forEach(function(m){m.remove();}); return; }
      document.querySelectorAll('.tk-card-menu').forEach(function(m){m.remove();});
      return;
    }
    /* 状态胶囊按钮 */
    var flowPill = e.target.closest('[data-flow-status]');
    if (flowPill) {
      if (taskViewState.drawerTaskId) {
        tkUpdateTask(taskViewState.drawerTaskId, { status: flowPill.getAttribute('data-flow-status') });
        render();
        openDrawer(taskViewState.drawerTaskId);
      }
      return;
    }
    /* 处理人快捷选择：面板悬浮定位，不挤开内容 */
    var flowField = e.target.closest('[data-flow-prop]');
    if (flowField) {
      var existingFieldMenu = document.querySelector('.tk-flow-field-menu.show');
      if (existingFieldMenu) {
        if (e.target.closest('input')) return;
        existingFieldMenu.remove();
        return;
      }
      var fprop = flowField.getAttribute('data-flow-prop');
      var flowTask = tkGetTasks().find(function (task) { return task.id === taskViewState.drawerTaskId; });
      var fopts = fprop === 'status' ? TK_STATUSES : tkPeopleInProject(flowTask?.project);
      var fieldMenu = document.createElement('div');
      fieldMenu.className = 'tk-flow-field-menu show';
      fopts.forEach(function (o) {
        var fieldItem = document.createElement('div');
        fieldItem.className = 'tk-flow-field-menu-item';
        if (fprop === 'assignee' && o.avatar) {
          fieldItem.innerHTML = '<span class="tk-avatar-sm" style="background:' + o.color + '">' + escapeHtml(o.avatar) + '</span><span>' + escapeHtml(o.name) + '</span>';
        } else {
          fieldItem.textContent = o.name;
        }
        fieldItem.addEventListener('click', function () {
          if (taskViewState.drawerTaskId) {
            if (fprop === 'assignee') {
              flowAssigneeDraft = { taskId: taskViewState.drawerTaskId, assigneeId: o.id };
              tkUpdateTask(taskViewState.drawerTaskId, { flowAssignee: o.id });
              flowField.querySelector('.tk-flow-field-text').value = o.name;
              flowField.classList.remove('is-placeholder');
            } else {
              tkUpdateTask(taskViewState.drawerTaskId, (function (p) { var obj = {}; obj[p] = o.id; return obj; })(fprop));
              render();
              openDrawer(taskViewState.drawerTaskId);
            }
          }
          fieldMenu.remove();
          var fieldInput = flowField.querySelector('input');
          if (fieldInput) fieldInput.setAttribute('aria-expanded', 'false');
        });
        fieldMenu.appendChild(fieldItem);
      });
      if (fprop === 'assignee') filterAssigneeOptions(fieldMenu, '.tk-flow-field-menu-item', '');
      document.body.appendChild(fieldMenu);
      var fRect = flowField.getBoundingClientRect();
      fieldMenu.style.top = (fRect.bottom + 4) + 'px';
      fieldMenu.style.left = fRect.left + 'px';
      if (fprop === 'assignee') {
        var flowInput = flowField.querySelector('input');
        flowInput.setAttribute('aria-expanded', 'true');
        if (e.target !== flowInput) flowInput.focus({ preventScroll: true });
      }
      return;
    }
    /* 附件上传 */
    var dropzone = e.target.closest('#tkAttachDropzone');
    if (dropzone) {
      els.tkDrawerBody.querySelector('#tkAttachInput').click();
      return;
    }
    var attachRemove = e.target.closest('[data-attach-remove]');
    if (attachRemove) {
      attachRemove.closest('.tk-attach-item').remove();
      return;
    }
    /* 页签切换 */
    var drawerTab = e.target.closest('[data-tab]');
    if (drawerTab) {
      var tabName = drawerTab.getAttribute('data-tab');
      var tabContainer = drawerTab.parentElement;
      var contentContainer = tabContainer.parentElement;
      tabContainer.querySelectorAll('.tk-drawer-tab').forEach(function(t){t.classList.remove('active');});
      drawerTab.classList.add('active');
      contentContainer.querySelectorAll('.tk-drawer-tab-content').forEach(function(c){
        c.classList.toggle('active', c.getAttribute('data-tab-content') === tabName);
        c.hidden = c.getAttribute('data-tab-content') !== tabName;
      });
      return;
    }
    /* 流转按钮 */
    var flowBtn = e.target.closest('[data-action="flow"]');
    if (flowBtn) {
      if (taskViewState.drawerTaskId) {
        var flowTask = tkGetTasks().find(function (x) { return x.id === taskViewState.drawerTaskId; });
        if (flowTask) {
          if (!flowAssigneeDraft.assigneeId) {
            toast('请选择处理人', 'error');
            els.tkDrawerBody.querySelector('.tk-flow-field-text').focus();
            return;
          }
          var commentInput = els.tkDrawerBody.querySelector('.tk-drawer-comment-input textarea');
          var commentText = commentInput ? commentInput.value.trim() : '';
          var handoffPatch = taskStageHandoffPatch(flowTask, flowAssigneeDraft.assigneeId);
          var newComment = {
            kind: 'flow',
            authorId: tkCurrentUserId(),
            createdAt: taskCommentTimestamp(),
            fromStatus: flowTask.status,
            fromAssignee: flowTask.assignee,
            status: handoffPatch.status || flowTask.status,
            assignee: flowAssigneeDraft.assigneeId,
            text: commentText,
          };
          tkUpdateTask(taskViewState.drawerTaskId, {
            ...handoffPatch,
            comments: (flowTask.comments || []).concat(newComment),
          });
          if (commentInput) commentInput.value = '';
          closeMentionPanel();
          flowAssigneeDraft = { taskId: taskViewState.drawerTaskId, assigneeId: '' };
          render();
          openDrawer(taskViewState.drawerTaskId);
          toast('流转成功', 'success');
        }
      }
      return;
    }
    /* 点击其他区域关闭属性菜单和处理人下拉 */
    var openMenu = document.querySelector('.tk-prop-menu.show');
    if (openMenu && !e.target.closest('.tk-prop-menu') && !e.target.closest('.tk-prop-display')) {
      openMenu.remove();
    }
    var ffm = document.querySelector('.tk-flow-field-menu.show');
    if (ffm && !e.target.closest('.tk-flow-field-menu') && !e.target.closest('[data-flow-prop]')) {
      ffm.remove();
    }
  });
els.tkDrawerBody.addEventListener('input', function (e) {
    if (e.target.matches('.tk-prop-assignee-input')) {
      var propMenu = document.querySelector('.tk-prop-menu.show');
      if (!propMenu) { e.target.closest('.tk-prop-display').click(); propMenu = document.querySelector('.tk-prop-menu.show'); }
      filterAssigneeOptions(propMenu, '.tk-prop-menu-item', e.target.value);
    } else if (e.target.matches('.tk-flow-field-text')) {
      flowAssigneeDraft = { taskId: taskViewState.drawerTaskId, assigneeId: '' };
      var flowMenu = document.querySelector('.tk-flow-field-menu.show');
      if (!flowMenu) { e.target.closest('[data-flow-prop]').click(); flowMenu = document.querySelector('.tk-flow-field-menu.show'); }
      filterAssigneeOptions(flowMenu, '.tk-flow-field-menu-item', e.target.value);
    }
  });
els.tkDrawerBody.addEventListener('keydown', function (e) {
    if (e.target.matches('.tk-label-picker') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (labelPickerMenu) closeTaskLabelPicker(); else openTaskLabelPicker(e.target);
    }
    if (e.target.matches('.tk-prop-assignee-input')) chooseFirstAssignee(document.querySelector('.tk-prop-menu.show'), '.tk-prop-menu-item', e);
    if (e.target.matches('.tk-flow-field-text')) chooseFirstAssignee(document.querySelector('.tk-flow-field-menu.show'), '.tk-flow-field-menu-item', e);
  });
els.tkDrawerBody.addEventListener('change', function (e) {
    if (!taskViewState.drawerTaskId) return;
    var sel = e.target.closest('[data-prop]');
    if (!sel) return;
    var prop = sel.getAttribute('data-prop');
    var patch = {}; patch[prop] = sel.value;
    tkUpdateTask(taskViewState.drawerTaskId, patch);
    render();
    openDrawer(taskViewState.drawerTaskId);
  });
els.tkDrawer.addEventListener('blur', function (e) {
    if (!taskViewState.drawerTaskId) return;
    var el = e.target.closest('[data-field]');
    if (!el) return;
    var field = el.getAttribute('data-field');
    var val = el.textContent.trim();
    var t = tkGetTasks().find(function (x) { return x.id === taskViewState.drawerTaskId; });
    if (t && t[field] !== val) {
      var patch = {}; patch[field] = val;
      tkUpdateTask(taskViewState.drawerTaskId, patch);
      render();
      openDrawer(taskViewState.drawerTaskId);
    }
  }, true);
}

function initTaskDetailSubtaskEvents() {
els.tkDrawerBody.addEventListener('click', function (e) {
    var subToggle = e.target.closest('[data-subtask-toggle]');
    if (subToggle) {
      var subSection = subToggle.closest('.tk-subtasks');
      var subList = subSection.querySelector('.tk-subtask-list');
      var expanded = subToggle.getAttribute('aria-expanded') !== 'true';
      subtaskSectionExpanded.set(parseInt(subToggle.getAttribute('data-subtask-toggle'), 10), expanded);
      subToggle.setAttribute('aria-expanded', String(expanded));
      subSection.classList.toggle('is-collapsed', !expanded);
      subList.hidden = !expanded;
      return;
    }
    var addSubBtn = e.target.closest('[data-drawer-subtask]');
    if (addSubBtn) {
      var pid = parseInt(addSubBtn.getAttribute('data-drawer-subtask'), 10);
      openTaskModal(null, pid);
      return;
    }
    var openSub = e.target.closest('[data-subtask-open]');
    if (openSub) {
      var sid = parseInt(openSub.getAttribute('data-subtask-open'), 10);
      openDrawer(sid);
      return;
    }
  });
}

function initTaskDetailGlobalEvents() {
document.addEventListener('click', function (e) {
    if (e.target.closest('[data-clear-task-ref]')) {
      var tags = document.getElementById('ntTags');
      if (tags) { tags.innerHTML = ''; tags.classList.add('hidden'); }
    }
  });
document.addEventListener('click', function (e) {
    hidePopover();
    if (labelPickerMenu && !e.target.closest('.tk-label-popover') && !e.target.closest('.tk-label-picker')) closeTaskLabelPicker();
    var ffm = document.querySelector('.tk-flow-field-menu.show');
    if (ffm && !e.target.closest('.tk-flow-field-menu') && !e.target.closest('[data-flow-prop]')) {
      ffm.remove();
    }
  });
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var hadOpen = false;
    if (displayChoiceMenu) { closeDisplayChoiceMenu(true); e.preventDefault(); return; }
    if (!els.tkFilterPanel.classList.contains('hidden')) { closeFilterPanel(); hadOpen = true; }
    if (els.tkViewMenu && !els.tkViewMenu.classList.contains('hidden')) { closeViewMenu(); hadOpen = true; }
    if (!els.tkFieldsPopover.classList.contains('hidden')) { closeFieldSettings(); e.preventDefault(); return; }
    if (!els.tkDisplayPopover.classList.contains('hidden')) {
      els.tkDisplayPopover.classList.add('hidden');
      els.tkDisplayBtn.classList.remove('active');
      els.tkDisplayBtn.setAttribute('aria-expanded', 'false');
      hadOpen = true;
    }
    var ffm = document.querySelector('.tk-flow-field-menu.show');
    if (ffm) { ffm.remove(); hadOpen = true; }
    if (!hadOpen && taskViewState.drawerTaskId && els.tkDrawer && els.tkDrawer.classList.contains('show')) {
      closeDrawer();
      e.preventDefault();
    }
  });
window.addEventListener('scroll', function () {
    if (displayChoiceMenu) closeDisplayChoiceMenu();
    var ffm = document.querySelector('.tk-flow-field-menu.show');
    if (ffm) ffm.remove();
  }, true);
window.addEventListener('resize', function () {
    if (displayChoiceMenu) closeDisplayChoiceMenu();
    var ffm = document.querySelector('.tk-flow-field-menu.show');
    if (ffm) ffm.remove();
  });
}

function initTaskDetailPreferences() {
  try { taskStartLegacy = localStorage.getItem(TASK_START_LEGACY_KEY) === '1'; } catch (e) { taskStartLegacy = false; }
  renderTaskStartAction();
}
function initTaskDetailWidth() {
  try {
    var storedWidth = Number(localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY));
    if (Number.isFinite(storedWidth) && storedWidth >= 480) drawerPreferredWidth = storedWidth;
  } catch (e) { /* 本地存储不可用时使用默认宽度 */ }
  applyDrawerWidth();
}

export { restoreTaskLabelCatalog, initTaskDetailPreferences, initTaskDetailWidth, initTaskDetailEvents, initTaskDetailSubtaskEvents, initTaskDetailGlobalEvents, taskStartLegacy, TASK_START_CHAT_ICON, TASK_START_PLAY_ICON, closeDrawer, openTaskConversationWithTask, openDrawer, syncDrawerClickaway };

// 新公共入口的兼容适配：T00 只支持现有基础信息/变更日志页签。
export function openIssueDetail(issueId, options = {}) {
  var task = tkGetTasks().find(function (row) { return String(row.id) === String(issueId); });
  if (!task) return { ok: false, error: { code: 'NOT_FOUND', message: '未找到任务' } };
  if (!tkCanViewTask(task)) {
    return { ok: false, error: { code: 'FORBIDDEN', message: '未参与该任务' } };
  }
  var tab = options.tab || 'info';
  if (!['info', 'changelog'].includes(tab) || options.workItemId) {
    return { ok: false, error: { code: 'NOT_IMPLEMENTED', message: '执行计划和工作项导航待接入' } };
  }
  showView('collab');
  setNavActive('协作开发');
  cvSwitchView('tasks');
  openDrawer(task.id);
  var trigger = els.tkDrawerBody.querySelector('[data-tab="' + tab + '"]');
  if (trigger) trigger.click();
  return { ok: true, data: { issueId: task.id } };
}
