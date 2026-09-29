import { billTemplateWithTokens } from '../core/bill-template.js';
import { $, $$ } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { input, showView, viewChat } from '../core/view.js';
import { addBtn, appChip, appDd, attachModal, chatAddBtn, chatAppDd, closeAttach, openFilePicker, selectChatApp } from './attach-app.js';
import { syncTogglePreviewBtn } from './chat.js';
import { closeAll } from './dropdown.js';
import { appendAskCard, appendAutoNote, autoMatch } from './expert/automatch.js';
import { renderExpertChips } from './expert/chips.js';
import { EX, pendingInputs, xav, xesc } from './expert/data.js';
import { activePick, pickValid, set_activePick, teamById } from './expert/store.js';
import { set__prevWishW } from './sidebar.js';
import { CV_MEMBERS, CV_PROJECTS } from './collab/data.js';
import { tbTeamStages } from './collab/tb-core.js';
import { tkAddTask, tkCurrentUserId, tkGetTasks, tkGetTaskArtifacts, tkPeopleInProject, tkProjectsForCurrentUser } from './tasks-v2/data.js';
import { defaultStageAssigneeId } from './tasks-v2/stage-owner.js';
import { openIssueCount, requirementPoints } from './tasks-v2/artifact-docs.js';
import { renderArtifactPreview } from './collab/run-artifacts.js';
import { reviewTaskStage, submitTaskStage, taskExecutionStages } from './tasks-v2/task-execution.js';
import { tkAnswerTaskSessionQuestion, tkGetMySessions, tkTaskSessionOpeningMessage } from './tasks-v2/task-sessions.js';
/* 输入框、发送、＋按钮下拉菜单
   拆分自 src/scripts/main.js，逻辑逐行保留；副作用集中在下方 init* 函数里，
   由 main.js 按拆分前的原始顺序调用。 */


/* ---------- composer input + send ---------- */
var sendBtn=$('#sendBtn');
function refreshSend(){ sendBtn.classList.toggle('active', input.textContent.trim().length>0); }
var chatMessages=$('#chatMessages');
var messagesList=$('#messagesList');
function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
var taskExceptionBack = null;
var taskExceptionPreviousTitle = '';
function closeTaskExceptionHistory() {
  var panel = document.getElementById('taskExceptionHistory');
  var back = document.getElementById('taskExceptionBack');
  viewChat.classList.remove('task-exception-open');
  closeChatDocViewer();
  if (panel) panel.remove();
  if (back) back.remove();
  if (taskExceptionPreviousTitle) $('#chatTitle').textContent = taskExceptionPreviousTitle;
  taskExceptionBack = null;
  /* 关闭异常回看后按当前会话是否任务会话恢复历史版本入口。 */
  $('#historyBtn').classList.toggle('hidden', !!tkGetTasks().find(function (row) { return row.id === activeSessionTaskId; }));
}
export function openTaskExceptionHistory(task, onBack) {
  if (!task) return;
  closeTaskExceptionHistory();
  taskExceptionPreviousTitle = $('#chatTitle').textContent;
  taskExceptionBack = onBack;
  var run = task.blockedRun;
  var reason = run?.reason || '本次执行未完成，请查看任务动态中的异常信息。';
  var steps = Array.isArray(run?.steps) ? run.steps : [];
  var header = document.querySelector('#view-chat .chat-header');
  var back = document.createElement('button');
  back.type = 'button';
  back.id = 'taskExceptionBack';
  back.className = 'header-btn';
  back.setAttribute('aria-label', '返回任务详情');
  back.textContent = '←';
  back.addEventListener('click', function () {
    var callback = taskExceptionBack;
    closeTaskExceptionHistory();
    if (callback) callback();
  });
  header.prepend(back);
  var panel = document.createElement('div');
  panel.id = 'taskExceptionHistory';
  panel.className = 'task-exception-history';
  panel.innerHTML = '<div class="task-exception-intro"><span>历史会话 · ' + escapeHtml(String(task.code || '')) + '</span><strong>' + escapeHtml(String(task.title || '任务')) + '</strong><small>' + escapeHtml(String(run?.failedAt || task.createDate || '')) + '</small></div>'
    + '<div class="task-exception-message task-exception-user"><span>任务指令</span><p>' + escapeHtml(String(task.desc || task.title || '执行任务')) + '</p></div>'
    + '<div class="task-exception-message task-exception-agent"><span>' + escapeHtml(String(run?.agentName || '执行专家')) + ' · 执行过程</span>'
    + (steps.length ? '<ol>' + steps.map(function (step, index) { return '<li class="' + (index === steps.length - 1 ? 'is-error' : '') + '"><strong>' + escapeHtml(String(step[0] || '执行步骤')) + '</strong><p>' + escapeHtml(String(step[1] || '')) + '</p></li>'; }).join('') + '</ol>' : '<p>运行在当前阶段停止，未产生完整步骤记录。</p>')
    + '<div class="task-exception-error"><strong>执行异常</strong><p>' + escapeHtml(String(reason)) + '</p></div>'
    + (run?.next ? '<p class="task-exception-next">建议处理：' + escapeHtml(String(run.next)) + '</p>' : '') + '</div>';
  chatMessages.appendChild(panel);
  $('#chatTitle').textContent = '异常会话 · ' + (task.title || '任务');
  viewChat.classList.add('task-exception-open');
  $('#historyBtn').classList.add('hidden');
  showView('chat');
  chatMessages.scrollTop = 0;
}
/* 任务详情「我的会话」的回看：与异常回放共用面板和返回按钮，可继续会话。 */
export function openTaskSessionHistory(task, session, onBack, onContinue) {
  if (!task || !session) return;
  closeTaskExceptionHistory();
  taskExceptionPreviousTitle = $('#chatTitle').textContent;
  taskExceptionBack = onBack;
  var header = document.querySelector('#view-chat .chat-header');
  var back = document.createElement('button');
  back.type = 'button';
  back.id = 'taskExceptionBack';
  back.className = 'header-btn';
  back.setAttribute('aria-label', '返回任务详情');
  back.textContent = '←';
  back.addEventListener('click', function () {
    var callback = taskExceptionBack;
    closeTaskExceptionHistory();
    if (callback) callback();
  });
  header.prepend(back);
  var steps = Array.isArray(session.steps) ? session.steps : [];
  var panel = document.createElement('div');
  panel.id = 'taskExceptionHistory';
  panel.className = 'task-exception-history task-session-history';
  panel.innerHTML = '<div class="task-exception-intro"><span>我的会话 · ' + escapeHtml(String(task.code || '')) + '</span><strong>' + escapeHtml(String(session.title || task.title || '任务')) + '</strong><small>' + escapeHtml(String(session.startedAt || '')) + (session.lastAt && session.lastAt !== session.startedAt ? ' – ' + escapeHtml(String(session.lastAt)) : '') + ' · ' + escapeHtml(String(session.statusLabel || '')) + '</small></div>'
    + session.messages.map(function (message) {
      return message.role === 'user'
        ? '<div class="task-exception-message task-exception-user"><span>我</span><p>' + escapeHtml(String(message.text || '')) + '</p></div>'
        : '<div class="task-exception-message task-exception-agent"><span>' + escapeHtml(String(session.agentName || '执行专家')) + '</span><p>' + escapeHtml(String(message.text || '')) + '</p></div>';
    }).join('')
    + (steps.length || session.error ? '<div class="task-exception-message task-exception-agent"><span>' + escapeHtml(String(session.agentName || '执行专家')) + ' · 执行过程</span>'
      + (steps.length ? '<ol>' + steps.map(function (step, index) { return '<li class="' + (session.error && index === steps.length - 1 ? 'is-error' : '') + '"><strong>' + escapeHtml(String(step[0] || '执行步骤')) + '</strong><p>' + escapeHtml(String(step[1] || '')) + '</p></li>'; }).join('') + '</ol>' : '')
      + (session.error ? '<div class="task-exception-error"><strong>执行异常</strong><p>' + escapeHtml(String(session.error)) + '</p></div>' : '')
      + (session.next ? '<p class="task-exception-next">建议处理：' + escapeHtml(String(session.next)) + '</p>' : '') + '</div>' : '')
    + (onContinue ? '<div class="task-session-continue"><button type="button" class="task-session-continue-btn">继续这个会话</button></div>' : '');
  panel.querySelector('.task-session-continue-btn')?.addEventListener('click', function () {
    closeTaskExceptionHistory();
    onContinue();
  });
  chatMessages.appendChild(panel);
  $('#chatTitle').textContent = '我的会话 · ' + (task.title || '任务');
  viewChat.classList.add('task-exception-open');
  $('#historyBtn').classList.add('hidden');
  showView('chat');
  chatMessages.scrollTop = 0;
}
var conversationTaskId = null;
var activeSessionTaskId = null;
var activeResponseRun = 0;
var activeSessionId = null;
var CHAT_SESSIONS_KEY = 'lingee-chat-sessions-v1';
var chatSessions = [];
var collapsedChatProjects = new Set();
/* 项目会话超过 5 条时默认收起，点第 5 条下的「展开显示」查看全部（参考 Codex） */
var CHAT_PROJECT_SESSION_LIMIT = 5;
var expandedChatProjects = new Set();
try {
  var savedSessions = JSON.parse(localStorage.getItem(CHAT_SESSIONS_KEY) || '[]');
  if (Array.isArray(savedSessions)) chatSessions = savedSessions.filter(function (session) {
    return session && /^[a-z0-9]+$/i.test(session.id) && typeof session.title === 'string' && Array.isArray(session.exchanges);
  }).slice(0, 60).map(function (session) {
    session.exchanges = session.exchanges.filter(function (exchange) { return exchange && typeof exchange.prompt === 'string'; });
    return session;
  });
} catch (e) {}
/* 苍穹项目会话样本：稳定 ID 让已有本地会话与用户回复在刷新后保留。
   response 仅为任务数据缺失时的兜底，正常展示由 demoExchangeText 按统一文案格式生成。 */
var COSMIC_DEMO_SESSIONS = [
  {id:'cosmicdemo1',title:'操作元模型四张注册表抽取方案设计',taskId:1201,demoState:'running',exchanges:[{prompt:'开始执行操作元模型四张注册表抽取方案设计。',done:false,response:'当前阶段正在执行，完成后提交产物。'}]},
  {id:'cosmicdemo2',title:'编辑器提交形状与 EntryId 冲突裁决实现',taskId:1202,demoState:'running',demoArtifact:true,exchanges:[{prompt:'开始执行编辑器提交形状与 EntryId 冲突裁决实现。',done:false,response:'当前阶段正在执行，完成后提交产物。'}]},
  {id:'cosmicdemo3',title:'规则动作类型序列化槽位验证',taskId:1203,demoState:'ended',demoArtifact:true,exchanges:[{prompt:'开始执行规则动作类型序列化槽位验证。',done:true,response:'当前阶段已执行完成，请确认产物。'}]},
  {id:'cosmicdemo4',title:'属性继承链取值域合并验证',taskId:1207,demoState:'review',demoArtifact:true,exchanges:[{prompt:'开始执行属性继承链取值域合并验证。',done:true,response:'当前阶段已执行完成，请确认产物。'}]},
  {id:'cosmicdemo5',title:'采购订单规则配置清单交付',taskId:1205,demoState:'question',exchanges:[],demoQuestion:{text:'归档 evidence 时，系统导出的动作参数映射与项目手工维护版本有差异。交付清单应以哪份为准？',options:['以当前系统导出的注册表为准，记录手工版本差异','保留项目手工维护版本，标注与注册表的差异'],answer:''}},
  {id:'cosmicdemo6',title:'扩展表单属性锁定规则解析修复',taskId:1204,demoState:'blocked',exchanges:[{prompt:'开始执行扩展表单属性锁定规则解析修复。',done:true,response:'当前阶段执行中断，请查看失败原因。'}]},
  {id:'cosmicdemo7',title:'属性元模型与 app-build 契约交叉比对集成',taskId:1206,demoState:'confirmed',demoArtifact:true,exchanges:[{prompt:'开始执行属性元模型与 app-build 契约交叉比对集成。',done:true,response:'当前阶段已确认，任务交付完成。'}]},
  {id:'cosmicdemo8',title:'操作业务规则类型目录构建',taskId:84,demoState:'question',exchanges:[],demoQuestion:{
    prompt:'执行「需求分析」：整理 174 个操作业务规则类型及 RunClass、SettingFormId 映射。',
    intro:'正在核对操作业务规则类型目录的映射来源。',
    steps:[
      ['已扫描规则类型注册表','识别出 174 个操作业务规则类型及其挂载关系。'],
      ['正在核对参数映射','RunClass 与 SettingFormId 已完成初步关联，发现双运行时差异。'],
      ['等待映射口径确认','部分规则类型在两套运行时中的 RunClass 不一致，需确认目录采用的口径。'],
    ],
    closing:'确定映射口径后，我会继续生成目录并提交产物。',
    text:'部分操作业务规则类型在两套运行时中的 RunClass 不一致。目录应以哪套映射为准？',
    options:['以当前苍穹运行时的映射为准，另列差异项','同时保留两套运行时映射，并标注适用版本'],
    acknowledgement:'收到，我会按你选择的映射口径继续构建目录。',answer:'',
  }},
];
var cosmicDemoChanged = false;
COSMIC_DEMO_SESSIONS.forEach(function (sample) {
  var existing = chatSessions.find(function (session) { return session.id === sample.id; });
  if (existing) {
    existing.title = sample.title;
    existing.demoArtifact = !!sample.demoArtifact || !!existing.demoQuestion?.continuationDone;
    var progressed = sample.demoState === 'running' && existing.demoState === 'review' && existing.exchanges[0]?.done;
    var confirmedHere = Array.isArray(existing.stageEndMarkers) && existing.stageEndMarkers.length > 0;
    if (!progressed && !confirmedHere) {
      existing.demoState = sample.demoState;
      if (sample.exchanges.length) existing.exchanges[0] = sample.exchanges[0];
    } else existing.demoArtifact = true;
    if (sample.demoQuestion) existing.demoQuestion = Object.assign({}, sample.demoQuestion, existing.demoQuestion || {});
    cosmicDemoChanged = true;
    return;
  }
  chatSessions.push(Object.assign({projectId:'cosmic-app-dev',teamId:'cosmic-app-dev'}, sample));
  cosmicDemoChanged = true;
});
if (cosmicDemoChanged) saveChatSessions();
function saveChatSessions() {
  try { localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(chatSessions.slice(0, 60))); } catch (e) {}
}
export function taskConversationNeedsReply(task) {
  return task?.status === 'in_progress' && chatSessions.some(function (session) {
    return Number(session.taskId) === task.id && !!session.demoQuestion && !session.demoQuestion.answer;
  });
}
function renderChatSessions() {
  var list = document.getElementById('chatSessionList');
  var section = document.getElementById('chatSessionSection');
  var folders = document.getElementById('chatProjectFolders');
  if (!list || !section || !folders) return;
  var query = String(document.getElementById('sbSearchInput')?.value || '').trim().toLowerCase();
  function projectId(session) {
    var task = tkGetTasks().find(function (row) { return row.id === Number(session.taskId); });
    return session.projectId || task?.project || '';
  }
  function projectName(id) { return CV_PROJECTS.find(function (project) { return project.id === id; })?.name || id; }
  function sessionHtml(session) {
    var running = session.demoState === 'running' || session.exchanges.some(function (exchange) { return !exchange.done && !exchange.waiting; });
    var waiting = session.demoState === 'question' && !session.demoQuestion?.answer || session.exchanges.some(function (exchange) { return !!exchange.waiting; });
    var state = session.demoState === 'blocked' ? 'red' : running ? 'blue' : waiting || session.demoState === 'review' ? 'orange' : 'green';
    return '<button type="button" class="chat-session-entry' + (session.id === activeSessionId ? ' active' : '') + '" data-chat-session="' + session.id + '"><span class="dot ' + state + '"></span><span class="txt">' + escapeHtml(String(session.title)) + '</span></button>';
  }
  var ungrouped = chatSessions.filter(function (session) { return !projectId(session) && (!query || session.title.toLowerCase().includes(query)); });
  section.hidden = !ungrouped.length;
  list.innerHTML = ungrouped.map(sessionHtml).join('');
  var groups = new Map();
  chatSessions.forEach(function (session) {
    var id = projectId(session);
    if (!id || (query && !session.title.toLowerCase().includes(query) && !projectName(id).toLowerCase().includes(query))) return;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(session);
  });
  folders.innerHTML = Array.from(groups, function (entry) {
    var id = entry[0], name = projectName(id), collapsed = collapsedChatProjects.has(id);
    var sessions = entry[1];
    var attrId = escapeHtml(String(id)).replace(/"/g, '&quot;');
    /* 搜索中或当前会话落在收起段时全部展开，保证结果与正在使用的会话可见 */
    var activeIndex = sessions.findIndex(function (session) { return session.id === activeSessionId; });
    var expandAll = !!query || expandedChatProjects.has(id) || activeIndex >= CHAT_PROJECT_SESSION_LIMIT;
    var overflow = sessions.length - CHAT_PROJECT_SESSION_LIMIT;
    var folderIcon = collapsed
      ? '<svg class="chat-project-icon" viewBox="0 0 16 16" fill="none"><path d="M6.26036 2C7.03874 2.00002 7.77849 2.34003 8.2851 2.93099L9.08783 3.86784C9.34114 4.1633 9.71102 4.33333 10.1002 4.33333H12.5136C12.5637 4.33334 12.6125 4.33912 12.6594 4.34961C14.0645 4.50628 15.1265 5.75221 15.0195 7.19727L14.649 12.1973C14.5457 13.5896 13.3857 14.6666 11.9895 14.6667H3.70437C2.30813 14.6667 1.14815 13.5897 1.04487 12.1973L0.674423 7.19727C0.600705 6.20208 1.08157 5.30192 1.84695 4.78646V4.66667C1.84695 3.19391 3.04086 2 4.51361 2H6.26036ZM3.33393 5.66667C2.5588 5.66667 1.94734 6.32532 2.0045 7.09831L2.37429 12.0983C2.42587 12.7946 3.0062 13.3333 3.70437 13.3333H11.9895C12.6876 13.3333 13.268 12.7945 13.3196 12.0983L13.6894 7.09831C13.7465 6.32536 13.135 5.66673 12.36 5.66667H3.33393ZM4.51361 3.33333C3.89154 3.33333 3.3705 3.75975 3.22325 4.33594C3.25991 4.33445 3.29688 4.33333 3.33393 4.33333H7.73041L7.27273 3.79883C7.01943 3.50337 6.64953 3.33335 6.26036 3.33333H4.51361Z" fill="currentColor"/></svg>'
      : '<svg class="chat-project-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 7V4.5A1.5 1.5 0 0 1 3 3h3l1.5 1.5H12A1.5 1.5 0 0 1 13.5 6v1"/><path d="M2.7 7h10.8a1 1 0 0 1 .97 1.24l-1.15 4.6a1 1 0 0 1-.97.76H2.5a1 1 0 0 1-.97-.76L.76 9.76A2.2 2.2 0 0 1 2.7 7Z"/></svg>';
    var chevronIcon = '<path d="M11.8619 5.5287C12.1223 5.26835 12.5443 5.26835 12.8046 5.5287C13.0649 5.78905 13.065 6.21109 12.8046 6.47141L9.03706 10.239C8.46432 10.8117 7.53562 10.8117 6.96284 10.239L3.19526 6.47141C2.93491 6.21106 2.93491 5.78905 3.19526 5.5287C3.45561 5.26835 3.87762 5.26835 4.13797 5.5287L7.90555 9.29628C7.95763 9.34825 8.04232 9.34831 8.09435 9.29628L11.8619 5.5287Z" fill="currentColor"/>';
    /* 展开后不再显示按钮；只有收起态且超过 5 条时出现「展开显示」 */
    var sessionsHtml = expandAll
      ? sessions.map(sessionHtml).join('')
      : sessions.slice(0, CHAT_PROJECT_SESSION_LIMIT).map(sessionHtml).join('')
        + (overflow > 0
          ? '<button type="button" class="chat-project-more" data-chat-project-toggle="' + attrId + '"><span class="txt">展开显示</span></button>'
          : '');
    return '<div class="chat-project-folder' + (collapsed ? ' collapsed' : '') + '" data-chat-project="' + attrId + '">'
      + '<button type="button" class="chat-project-title" aria-expanded="' + !collapsed + '">' + folderIcon + '<span class="txt">' + escapeHtml(name) + '</span><span class="chat-project-chevron"><svg viewBox="0 0 16 16" fill="none">' + chevronIcon + '</svg></span></button>'
      + '<div class="chat-project-sessions">' + sessionsHtml + '</div></div>';
  }).join('');
}
function createChatSession(title, taskId) {
  var task = tkGetTasks().find(function (row) { return row.id === taskId; });
  var projectId = task?.project || '';
  var project = CV_PROJECTS.find(function (row) { return row.id === projectId; });
  var teamId = task?.teamId || project?.defaultTeam || (activePick.kind === 'team' ? activePick.id : '');
  var session = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title: title, taskId: taskId, projectId: projectId, teamId: teamId, exchanges: [] };
  if (projectId) collapsedChatProjects.delete(projectId);
  chatSessions.unshift(session);
  var regularCount = 0;
  chatSessions = chatSessions.filter(function (row) { return row.demoState || ++regularCount <= 30; });
  activeSessionId = session.id;
  saveChatSessions();
  renderChatSessions();
  return session;
}
function addSessionExchange(prompt) {
  var session = chatSessions.find(function (row) { return row.id === activeSessionId; });
  if (!session) return null;
  session.exchanges.forEach(function (exchange) { exchange.done = true; });
  session.exchanges.push({ prompt: prompt, done: false });
  saveChatSessions();
  renderChatSessions();
  return session.exchanges.length - 1;
}
function finishSessionExchange(sessionId, index) {
  var session = chatSessions.find(function (row) { return row.id === sessionId; });
  if (!session || !session.exchanges[index]) return;
  session.exchanges[index].done = true;
  saveChatSessions();
  renderChatSessions();
  if (sessionId === activeSessionId) renderChatTaskSide();
}
function appendChatStageEndMarker(marker) {
  var line = document.createElement('div');
  line.className = 'chat-stage-end';
  line.dataset.stageId = marker.stageId;
  line.setAttribute('role', 'status');
  var icon = document.createElement('span');
  icon.className = 'chat-stage-end-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<svg viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="currentColor"/><path d="M10.951 4.249C11.283 4.581 11.283 5.119 10.951 5.451L5.951 10.451C5.619 10.783 5.081 10.783 4.749 10.451L2.749 8.451C2.417 8.119 2.417 7.581 2.749 7.249C3.081 6.917 3.619 6.917 3.951 7.249L5.35 8.648L9.749 4.249C10.081 3.917 10.619 3.917 10.951 4.249Z" fill="white"/></svg>';
  var label = document.createElement('span');
  label.textContent = '「' + marker.stageName + '」已完成';
  line.appendChild(icon);
  line.appendChild(label);
  var responses = messagesList.querySelectorAll('.message.assistant .assistant-response');
  (responses[responses.length - 1] || messagesList).appendChild(line);
}
function renderChatStageEndMarkers(session, exchangeIndex, afterQuestion) {
  (session.stageEndMarkers || []).forEach(function (marker) {
    if (marker.afterExchangeIndex === exchangeIndex && !!marker.afterQuestion === !!afterQuestion) appendChatStageEndMarker(marker);
  });
}

/* 新建任务技能的本地原型：沿用会话与追问卡片，回答完成后才写入任务。 */
function setTaskCreateChipLabel() {
  var label = document.getElementById('chatExpertLabel');
  if (label) label.textContent = '任务创建智能体';
}
function taskCreateStages(draft) {
  var project = CV_PROJECTS.find(function (row) { return row.id === draft.projectId; });
  var team = teamById(project?.defaultTeam || '');
  var people = tkPeopleInProject(draft.projectId);
  return tbTeamStages(team).map(function (stage) {
    return {
      workType:stage.name, title:stage.name, description:stage.desc || '',
      assigneeId:draft.reviewers?.[stage.name] || defaultStageAssigneeId(project, people, CV_MEMBERS, stage.name),
      status:'pending',
    };
  });
}
function taskCreateMissingReviewer(draft) {
  return taskCreateStages(draft).find(function (stage) { return !stage.assigneeId; });
}
function appendTaskCreateAgent(html) {
  var response = appendAssistantMessage(null);
  response.innerHTML = '<div class="chat-agent-identity"><img class="task-create-avatar" src="' + xav('pm') + '" alt=""><strong>任务创建智能体</strong><span class="chat-agent-state">任务创建 Skill · 原型</span></div>' + html;
}
function renderTaskCreateChat(session) {
  var draft = session.taskCreate;
  var projects = tkProjectsForCurrentUser();
  messagesList.innerHTML = '';
  var projectOptions = '<option value="">选择项目</option>' + projects.map(function (project) {
    return '<option value="' + xesc(project.id) + '"' + (draft.projectId === project.id ? ' selected' : '') + '>' + escapeHtml(project.name) + '</option>';
  }).join('');
  appendTaskCreateAgent('<p>' + (draft.status === 'prompt' ? '先选择项目，再用一句话告诉我要创建什么任务。需要确认的信息，我会在对话中逐项询问。' : '任务归属项目如下；创建前可以调整。') + '</p>'
    + '<label class="task-create-project">所属项目 <select id="chatTaskCreateProject" aria-label="选择任务所属项目"' + (draft.status === 'done' ? ' disabled' : '') + '>' + projectOptions + '</select></label>');
  if (draft.prompt) appendUserMessage(draft.prompt);
  if (draft.status === 'type') {
    appendTaskCreateAgent('<div class="ask-card"><div class="ask-head">创建任务前确认一项</div><div class="ask-q"><div class="ask-q-t">这项任务属于哪种类型？</div><div class="ask-opts">'
      + ['需求', '缺陷'].map(function (type) { return '<button type="button" class="ask-opt' + (draft.suggestedType === type ? ' on' : '') + '" data-task-create-type="' + type + '">' + type + (draft.suggestedType === type ? ' · 建议' : '') + '</button>'; }).join('')
      + '</div></div></div>');
  } else if (draft.status === 'reviewer') {
    var missing = taskCreateMissingReviewer(draft);
    var people = tkPeopleInProject(draft.projectId);
    appendTaskCreateAgent('<div class="ask-card"><div class="ask-head">需要确认审核人</div><div class="ask-q"><div class="ask-q-t">「' + escapeHtml(missing?.workType || '当前节点') + '」由谁审核？</div><div class="ask-opts">'
      + (people.length ? people.map(function (person) { return '<button type="button" class="ask-opt" data-task-create-reviewer="' + xesc(person.id) + '">' + escapeHtml(person.name) + '</button>'; }).join('') : '<span>该项目暂无成员，请先为项目添加成员或更换项目。</span>')
      + '</div></div></div>');
  } else if (draft.status === 'confirm') {
    var stages = taskCreateStages(draft);
    appendTaskCreateAgent('<div class="task-create-preview"><strong>请核对任务草稿</strong><dl><div><dt>标题</dt><dd>' + escapeHtml(draft.title) + '</dd></div><div><dt>项目</dt><dd>' + escapeHtml(projects.find(function (row) { return row.id === draft.projectId; })?.name || '') + '</dd></div><div><dt>类型</dt><dd>' + escapeHtml(draft.issueType) + '</dd></div></dl><p>' + escapeHtml(draft.description) + '</p><ol>' + stages.map(function (stage) { return '<li>' + escapeHtml(stage.workType) + ' · 审核人 ' + escapeHtml(tkPeopleInProject(draft.projectId).find(function (person) { return person.id === stage.assigneeId; })?.name || '待分配') + '</li>'; }).join('') + '</ol><button type="button" data-task-create-confirm>确认创建任务</button></div>');
  } else if (draft.status === 'done') {
    appendTaskCreateAgent('<div class="task-create-preview"><strong>任务已创建</strong><p>' + escapeHtml(session.title) + '</p><button type="button" data-task-create-open>查看任务</button></div>');
  }
  chatInput.setAttribute('data-placeholder', draft.status === 'prompt' ? '一句话描述任务…' : draft.status === 'confirm' ? '补充任务要求，或点击确认创建…' : '也可以直接输入你的回答…');
  setTaskCreateChipLabel();
  scrollChatBottom();
}
function advanceTaskCreate(session) {
  var draft = session.taskCreate;
  draft.status = taskCreateMissingReviewer(draft) ? 'reviewer' : 'confirm';
  saveChatSessions();
  renderTaskCreateChat(session);
}
function answerTaskCreateMessage(session, message) {
  var draft = session.taskCreate;
  if (draft.status === 'prompt') {
    if (!draft.projectId) { toast('请先选择项目', 'warning'); return false; }
    draft.prompt = message;
    draft.title = (message.split(/[。！？\n]/)[0].replace(/^(?:请帮我|帮我|我想|我要|我希望)\s*/, '').trim() || message).slice(0, 120);
    draft.description = message;
    draft.suggestedType = /缺陷|Bug|报错|故障|修复/i.test(message) ? '缺陷' : '需求';
    draft.status = 'type';
  } else if (draft.status === 'type') {
    if (!/^(需求|缺陷)$/.test(message)) { toast('请选择任务类型：需求或缺陷', 'warning'); return false; }
    draft.issueType = message;
    advanceTaskCreate(session);
    return true;
  } else if (draft.status === 'reviewer') {
    var person = tkPeopleInProject(draft.projectId).find(function (row) { return row.name === message; });
    if (!person) { toast('请选择当前项目成员作为审核人', 'warning'); return false; }
    draft.reviewers[taskCreateMissingReviewer(draft).workType] = person.id;
    advanceTaskCreate(session);
    return true;
  } else if (draft.status === 'confirm') {
    draft.description += '\n\n补充要求：' + message;
  } else return false;
  saveChatSessions();
  renderTaskCreateChat(session);
  return true;
}
function confirmTaskCreate(session) {
  var draft = session.taskCreate;
  if (draft.status !== 'confirm' || !tkProjectsForCurrentUser().some(function (row) { return row.id === draft.projectId; })) { toast('请先确认所属项目', 'warning'); return; }
  var stages = taskCreateStages(draft);
  if (!stages.length || stages.some(function (stage) { return !stage.assigneeId; })) { toast('执行计划尚未匹配审核人', 'warning'); return; }
  var owner = tkPeopleInProject(draft.projectId).some(function (row) { return row.id === tkCurrentUserId(); }) ? tkCurrentUserId() : '';
  var task = tkAddTask({ title:draft.title, desc:draft.description, issueType:draft.issueType, status:'backlog', priority:'medium', dueDate:'',
    assignee:owner, createdBy:tkCurrentUserId(), project:draft.projectId, teamId:CV_PROJECTS.find(function (row) { return row.id === draft.projectId; })?.defaultTeam || '',
    labels:[], executionPlan:stages.map(function (stage) { return {...stage, id:crypto.randomUUID()}; }), planStatus:'draft' });
  session.taskId = task.id;
  session.title = task.title;
  draft.status = 'done';
  activeSessionTaskId = task.id;
  saveChatSessions();
  renderChatSessions();
  renderChatTaskSide();
  setComposerTaskReference(task.id);
  renderTaskCreateChat(session);
  document.dispatchEvent(new Event('lingee:tasks-changed'));
}
export function startTaskCreationChat(projectId, initialPrompt) {
  var projects = tkProjectsForCurrentUser();
  if (!projects.length) { toast('请先加入项目再创建任务', 'warning'); return; }
  set_activePick({kind:'expert', id:'software-product-manager', auto:false});
  renderExpertChips();
  setTaskCreateChipLabel();
  activeSessionTaskId = null;
  setComposerTaskReference(null);
  var selectedProjectId = projects.some(function (row) { return row.id === projectId; }) ? projectId : '';
  var session = createChatSession('创建任务', null);
  session.taskCreate = {projectId:selectedProjectId, prompt:'', title:'', description:'', issueType:'', suggestedType:'', reviewers:{}, status:'prompt'};
  session.projectId = selectedProjectId;
  session.teamId = CV_PROJECTS.find(function (row) { return row.id === selectedProjectId; })?.defaultTeam || '';
  saveChatSessions();
  showView('chat');
  closeChatDocViewer();
  $('#chatTitle').textContent = '创建任务';
  renderChatTaskSide();
  if (String(initialPrompt || '').trim()) answerTaskCreateMessage(session, String(initialPrompt).trim());
  else renderTaskCreateChat(session);
  chatInput.focus();
}
function openChatSession(sessionId) {
  var session = chatSessions.find(function (row) { return row.id === sessionId; });
  if (!session) return;
  activeResponseRun++;
  activeSessionId = session.id;
  activeSessionTaskId = session.taskId == null ? null : Number(session.taskId);
  showView('chat');
  messagesList.innerHTML = '';
  closeChatDocViewer();
  chatViewerTabs = [];
  chatViewerActiveKey = null;
  renderChatTaskSide();
  setComposerTaskReference(activeSessionTaskId);
  $('#chatTitle').textContent = session.title;
  if (session.taskCreate) {
    set_activePick({kind:'expert', id:'software-product-manager', auto:false});
    renderExpertChips();
    setTaskCreateChipLabel();
    renderTaskCreateChat(session);
    renderChatSessions();
    return;
  }
  chatInput.setAttribute('data-placeholder', '输入消息…');
  var task = tkGetTasks().find(function (row) { return row.id === activeSessionTaskId; });
  $('#chatTitle').textContent = task ? task.title : session.title;
  if (session.demoState && session.demoState !== 'running') {
    if (session.demoState !== 'question') session.exchanges.forEach(function (exchange, index) {
      if (!exchange) return;
      appendUserMessage(exchange.prompt);
      var response = appendAssistantMessage(resolveChatTeam(session, task));
      if (task) appendTaskReadingSummary(response, task);
      var timeline = document.createElement('div');
      timeline.className = 'work-steps';
      response.appendChild(timeline);
      var result = createFinalResult(false);
      result.querySelector('.markdown-content').innerHTML = renderMarkdown(demoExchangeText(session, task, exchange));
      timeline.appendChild(result);
      if (session.demoState === 'blocked') {
        var failure = document.createElement('div');
        failure.className = 'task-exception-error';
        failure.innerHTML = '<strong>执行失败</strong><p>' + escapeHtml(session.demoFailure || 'AI 点数不足，无法继续解析扩展属性锁定规则。补充点数后可重试本阶段。') + '</p>';
        result.appendChild(failure);
      }
      if (task && session.demoArtifact) {
        var artifact = taskStageArtifact(task);
        if (artifact) result.appendChild(createChatResultArtifactCard(task, artifact));
      }
      renderChatStageEndMarkers(session, index, false);
    });
    if (session.demoQuestion) {
      renderTaskQuestion(session, task);
      if (session.demoQuestion.answer && task) {
        var continuation = appendAssistantMessage(resolveChatTeam(session, task));
        simulateAIResponse(continuation, !!session.demoQuestion.continuationDone, task, session.demoQuestion.answer, function () {
          session.demoQuestion.continuationDone = true;
          session.demoArtifact = true;
          saveChatSessions();
          renderChatSessions();
        });
      }
    }
    else document.getElementById('chatTaskQuestionPanel')?.remove();
    if (session.demoArtifact && task) {
      var previewArtifact = taskStageArtifact(task);
      if (previewArtifact) openChatDocViewer(task, previewArtifact);
    }
    if (session.demoQuestion) renderChatStageEndMarkers(session, session.exchanges.length - 1, true);
    else if (!session.exchanges.length) renderChatStageEndMarkers(session, -1, false);
    renderChatSessions();
    refreshChatStageConfirm();
    scrollChatBottom();
    return;
  }
  session.exchanges.forEach(function (exchange, index) {
    appendUserMessage(exchange.prompt);
    if (exchange.waiting) { appendAskCard(pendingInputs(exchange.prompt)); return; }
    var response = appendAssistantMessage(resolveChatTeam(session, task));
    simulateAIResponse(response, !!exchange.done, task, exchange.prompt, function () { finishSessionExchange(session.id, index); });
    renderChatStageEndMarkers(session, index, false);
  });
  if (session.demoState === 'running' && task?.status === 'in_review' && session.exchanges.some(function (exchange) { return exchange.done; })) {
    var readyArtifact = taskStageArtifact(task);
    if (readyArtifact) openChatDocViewer(task, readyArtifact);
  }
  if (session.demoQuestion) renderTaskQuestion(session, task);
  else document.getElementById('chatTaskQuestionPanel')?.remove();
  if (session.demoQuestion) renderChatStageEndMarkers(session, session.exchanges.length - 1, true);
  else if (!session.exchanges.length) renderChatStageEndMarkers(session, -1, false);
  renderChatSessions();
  scrollChatBottom();
}
/* 任务状态卡片回到对应的聊天；旧数据没有聊天记录时只补建一次。 */
export function openTaskStatusConversation(task) {
  if (!task) return;
  var linked = chatSessions.filter(function (session) { return Number(session.taskId) === task.id; });
  var session = task.status === 'blocked'
    ? linked.find(function (row) { return row.demoState === 'blocked'; })
    : task.status === 'in_review'
      ? linked.find(function (row) { return row.demoState === 'question' && row.demoQuestion?.continuationDone; })
        || linked.find(function (row) { return row.demoState === 'review' || row.demoState === 'ended'; })
        || linked.find(function (row) { return !row.demoState && row.exchanges.some(function (exchange) { return exchange?.done; }); })
      : linked.find(function (row) { return row.demoState === 'question' && !row.demoQuestion?.answer; })
        || linked.find(function (row) { return row.demoState === 'question' && row.demoQuestion?.answer && !row.demoQuestion.continuationDone; })
        || linked.find(function (row) { return row.exchanges.some(function (exchange) { return exchange && !exchange.done && !exchange.waiting; }); })
        || linked.find(function (row) { return row.demoState === 'running'; });
  var created = false;
  if (!session) {
    created = true;
    session = createChatSession(task.title, task.id);
    var finished = task.status === 'in_review' || task.status === 'blocked';
    session.exchanges.push({
      prompt:tkTaskSessionOpeningMessage(task, 'start', task.executionStageId), done:finished,
      ...(task.status === 'blocked' ? {response:statusConversationOpeningText(task, true)}
        : task.status === 'in_review' ? {response:statusConversationOpeningText(task, false)} : {}),
    });
    if (finished) session.demoState = task.status === 'blocked' ? 'blocked' : 'review';
    if (task.status === 'blocked') session.demoFailure = task.blockedRun?.reason || '本次执行失败，请检查任务中的阻塞原因。';
    if (task.status === 'in_review') session.demoArtifact = true;
    saveChatSessions();
  }
  if (task.status === 'in_progress' && session.demoState === 'running' && session.exchanges.at(-1)?.done) {
    session.exchanges.at(-1).done = false;
    saveChatSessions();
  }
  if (session.demoQuestion && !session.demoQuestion.taskSessionId) {
    var taskSession = tkGetMySessions(task).find(function (row) { return row.stageId === task.executionStageId && row.status === 'active'; });
    if (taskSession) {
      session.demoQuestion.taskSessionId = taskSession.id;
      saveChatSessions();
    }
  }
  if (!created && activeSessionId === session.id && messagesList.querySelector('.message') && $('#chatTitle').textContent === task.title) {
    showView('chat');
    if (session.demoArtifact) {
      var existingArtifact = taskStageArtifact(task);
      if (existingArtifact) openChatDocViewer(task, existingArtifact);
    }
    renderChatSessions();
    return;
  }
  openChatSession(session.id);
}
function renderTaskQuestion(session, task) {
  var question = session.demoQuestion;
  appendUserMessage(question.prompt || '执行「部署交付」：完成采购订单规则配置清单，整理说明并归档 evidence 证据。');
  var response = appendAssistantMessage(resolveChatTeam(session, task));
  if (task) appendTaskReadingSummary(response, task);
  var process = document.createElement('div');
  response.appendChild(process);
  var steps = question.steps || [
    ['已核对规则动作类型与参数取值形状','清单字段与当前注册表逐项对齐。'],
    ['正在整理采购订单规则配置清单','已核对字段口径，尚未提交最终文件。'],
    ['归档 evidence 时发现冲突','系统导出映射与项目手工维护版本存在差异，等待确认采用哪份作为交付依据。'],
  ];
  process.innerHTML = '<div class="chat-task-process"><p>' + escapeHtml(question.intro || '正在完成采购订单规则配置清单的交付收口。') + '</p><ol>'
    + steps.map(function (step) { return '<li><strong>' + escapeHtml(step[0]) + '</strong><span>' + escapeHtml(step[1]) + '</span></li>'; }).join('')
    + '</ol><p>' + escapeHtml(question.closing || '归档前需要你确认一项取舍。') + '</p></div>';
  document.getElementById('chatTaskQuestionPanel')?.remove();
  if (!question.answer) {
    var panel = document.createElement('section');
    panel.id = 'chatTaskQuestionPanel';
    panel.className = 'chat-task-question-panel';
    panel.setAttribute('aria-label', 'AI 提问');
    panel.innerHTML = '<div class="chat-task-question-panel-inner"><div class="chat-task-question-panel-head"><strong>需要你的决定</strong><span>1 个问题</span></div>'
      + '<p>' + escapeHtml(question.text) + '</p><div class="chat-task-question-options">'
      + question.options.map(function (option, index) { return '<button type="button" data-task-question-option="' + index + '"><span>' + (index + 1) + '</span>' + escapeHtml(option) + '</button>'; }).join('')
      + '</div><small>也可以在下方输入自己的答复</small></div>';
    document.querySelector('#view-chat .chat-container').insertBefore(panel, document.getElementById('chatComposerWrap'));
  }
  if (question.answer) {
    appendUserMessage(question.answer);
    var acknowledgement = appendAssistantMessage(resolveChatTeam(session, task));
    acknowledgement.textContent = question.acknowledgement || '收到，将按你的决定整理 evidence 归档和交付说明，继续完成当前阶段。';
  }
}
function answerTaskQuestion(answer) {
  var session = chatSessions.find(function (row) { return row.id === activeSessionId; });
  if (!session?.demoQuestion || session.demoQuestion.answer) return false;
  session.demoQuestion.answer = answer;
  if (session.demoQuestion.taskSessionId) tkAnswerTaskSessionQuestion(session.demoQuestion.taskSessionId);
  saveChatSessions();
  openChatSession(session.id);
  return true;
}
export function openTaskQuestionConversation(task, taskSession) {
  if (!task || !taskSession) return;
  closeTaskExceptionHistory();
  var session = chatSessions.find(function (row) { return row.taskId === task.id && row.demoQuestion?.taskSessionId === taskSession.id; });
  if (!session) {
    session = createChatSession(task.title, task.id);
    session.demoQuestion = {
      taskSessionId:taskSession.id,
      text:'归档 evidence 时，系统导出的动作参数映射与项目手工维护版本有差异。交付清单应以哪份为准？',
      options:['以当前系统导出的注册表为准，记录手工版本差异','保留项目手工维护版本，标注与注册表的差异'], answer:'',
    };
    saveChatSessions();
  }
  if (!session.demoQuestion.answer) {
    session.demoQuestion.text = '归档 evidence 时，系统导出的动作参数映射与项目手工维护版本有差异。交付清单应以哪份为准？';
    session.demoQuestion.options = ['以当前系统导出的注册表为准，记录手工版本差异','保留项目手工维护版本，标注与注册表的差异'];
    saveChatSessions();
  }
  openChatSession(session.id);
}
function getConversationTask() {
  return conversationTaskId == null ? null : tkGetTasks().find(function (task) { return task.id === conversationTaskId; }) || null;
}
function renderConversationTaskReference() {
  var task = getConversationTask();
  /* 任务发起的会话详情由标题旁的关联任务标签承载上下文。 */
  var tags = document.getElementById('ntTags');
  if (tags) {
    tags.classList.toggle('hidden', !task);
    tags.innerHTML = task ? '<span class="ctag" data-task-ref-id="' + task.id + '"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><span class="ctag-label">' + escapeHtml(task.code || '') + ' ' + escapeHtml(task.title || '') + '</span><button type="button" class="ctag-x" data-clear-task-ref aria-label="移除任务关联"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></span>' : '';
  }
  if (task && !viewChat.classList.contains('hidden')) $('#chatTitle').textContent = task.title;
}
function renderChatTaskSide() {
  var task = tkGetTasks().find(function (row) { return row.id === activeSessionTaskId; });
  if (task) {
    viewChat.classList.remove('preview-open');
    var preview = document.getElementById('chatPreviewSide');
    if (preview) { preview.style.width = ''; preview.style.maxWidth = ''; }
    syncTogglePreviewBtn();
  }
  var title = document.getElementById('chatTitle');
  title.classList.toggle('is-task', !!task);
  title.setAttribute('aria-label', task ? '打开任务详情：' + task.title : '会话标题');
  if (task) title.setAttribute('data-tooltip', '打开任务详情');
  else title.removeAttribute('data-tooltip');
  if (task) title.textContent = task.title;
  /* 任务会话不提供历史版本入口，应用开发的 workspace 会话保留。 */
  document.getElementById('historyBtn')?.classList.toggle('hidden', !!task || viewChat.classList.contains('task-exception-open'));
  refreshChatStageConfirm();
  /* 任务会话确认流转/完成后任务不再处于执行态，隐藏输入区；任务重新执行时恢复。 */
  document.getElementById('chatComposerWrap')?.classList.toggle('hidden', !!task && !['in_progress', 'in_review', 'blocked'].includes(task.status));
}
/* ---------- 任务会话「确认」按钮：执行结束确认产物、流转下一阶段 ---------- */
/* 只在本轮回复结束、任务进入待审核后显示；点击与任务详情「通过审核」同一条流转链路。 */
function chatStageConfirmInfo() {
  if (viewChat.classList.contains('task-exception-open')) return null;
  var task = tkGetTasks().find(function (row) { return row.id === activeSessionTaskId; });
  if (!task) return null;
  var stages = taskExecutionStages(task);
  var index = stages.findIndex(function (stage) { return stage.id === task.executionStageId; });
  if (index < 0 && task.executionPlan?.length) index = stages.findIndex(function (stage) { return task.executionPlan.find(function (row) { return row.id === stage.id; })?.status !== 'done'; });
  if (index < 0) return null;
  var visible = ['in_progress', 'in_review'].includes(task.status);
  if (!visible) return null;
  var session = chatSessions.find(function (row) { return row.id === activeSessionId; });
  if (session?.demoState && !['running','review','ended'].includes(session.demoState)
    && !(session.demoState === 'question' && session.demoQuestion?.continuationDone)) return null;
  var lastExchange = session?.exchanges.at(-1);
  var ready = task.status === 'in_review' && (session?.demoQuestion?.continuationDone || !!lastExchange && lastExchange.done && !lastExchange.waiting);
  return { task: task, ready: ready, nextStage: stages[index + 1] || null };
}
function chatStageConfirmTooltip(task, nextStage) {
  if (!nextStage) return '确认产物，完成任务';
  return '确认产物，进入「' + (nextStage.name || '下一阶段') + '」';
}
function refreshChatStageConfirm() {
  var btn = document.getElementById('chatStageConfirmBtn');
  if (!btn) return;
  var info = chatStageConfirmInfo();
  document.getElementById('chatStageGuide')?.classList.toggle('hidden', !info?.ready);
  btn.disabled = !info?.ready;
  if (!info?.ready) return;
  var label = document.getElementById('chatStageConfirmLabel');
  var title = document.getElementById('chatStageGuideTitle');
  var guide = document.getElementById('chatStageGuideText');
  var isLast = !info.nextStage;
  var currentStage = taskExecutionStages(info.task).find(function (stage) { return stage.id === info.task.executionStageId; });
  if (title) title.textContent = '「' + (currentStage?.name || '当前阶段') + '」已执行完成，请确认产物。';
  if (guide) guide.textContent = isLast ? '确认后任务完成。' : '确认后流转至「' + (info.nextStage?.name || '下一阶段') + '」。';
  if (label) label.textContent = isLast ? '完成' : '确认';
  btn.setAttribute('aria-label', chatStageConfirmTooltip(info.task, info.nextStage));
  btn.setAttribute('data-tooltip', chatStageConfirmTooltip(info.task, info.nextStage));
}
function confirmChatStage() {
  var info = chatStageConfirmInfo();
  if (!info?.ready) return;
  var reviewed = reviewTaskStage(info.task, true);
  if (!reviewed.ok) {
    if (reviewed.message) toast(reviewed.message, 'warning');
    return;
  }
  var session = chatSessions.find(function (row) { return row.id === activeSessionId; });
  if (session && reviewed.stage) {
    session.demoState = reviewed.done ? 'confirmed' : 'ended';
    if (!Array.isArray(session.stageEndMarkers)) session.stageEndMarkers = [];
    if (!session.stageEndMarkers.some(function (marker) { return marker.stageId === reviewed.stage.id; })) {
      var marker = {
        stageId: reviewed.stage.id,
        stageName: reviewed.stage.name,
        afterExchangeIndex: session.exchanges.length - 1,
        afterQuestion: !!session.demoQuestion,
      };
      session.stageEndMarkers.push(marker);
      saveChatSessions();
      appendChatStageEndMarker(marker);
      scrollChatBottom();
    }
    renderChatSessions();
  }
  /* 流转后任务状态已变，lingee:task-updated 会触发 renderChatTaskSide 收起按钮 */
  toast(reviewed.done ? '任务完成' : '流转成功', 'success');
}
function clearChatTaskSide() {
  document.getElementById('chatTaskQuestionPanel')?.remove();
  activeSessionTaskId = null;
  activeSessionId = null;
  activeResponseRun++;
  renderChatTaskSide();
  renderChatSessions();
}
var chatDocViewerCloseTimer = null;
var chatViewerTabs = [];
var chatViewerActiveKey = null;
var chatTaskMountVersion = 0;
function unmountChatTaskDrawer() {
  var drawer = document.querySelector('#chatDocViewerBody > #tkDrawer');
  if (!drawer) return;
  drawer.querySelector('#tkDrawerClose')?.click();
  drawer.classList.remove('chat-task-embedded');
  drawer.classList.add('chat-task-drawer-parked');
  document.body.appendChild(drawer);
  document.body.classList.remove('chat-task-preview-mounted');
}
function mountChatTaskDrawer(taskId, version) {
  import('./tasks-v2/index.js').then(function (module) {
    var selected = chatViewerTabs.find(function (tab) { return tab.key === chatViewerActiveKey; });
    if (version !== chatTaskMountVersion || selected?.kind !== 'task' || selected.taskId !== taskId) return;
    module.openTaskDetailFromSession(taskId);
    var drawer = document.getElementById('tkDrawer');
    var body = document.getElementById('chatDocViewerBody');
    if (!drawer || !body || drawer.getAttribute('data-task-id') !== String(taskId)) return;
    drawer.classList.remove('chat-task-drawer-parked');
    drawer.classList.add('chat-task-embedded');
    body.replaceChildren(drawer);
    document.body.classList.add('chat-task-preview-mounted');
    document.getElementById('tkDrawerClickaway')?.classList.add('hidden');
  });
}
function renderChatViewerTab() {
  chatTaskMountVersion++;
  unmountChatTaskDrawer();
  var tabs = document.getElementById('chatDocViewerTabs');
  var body = document.getElementById('chatDocViewerBody');
  if (!tabs || !body) return;
  tabs.innerHTML = chatViewerTabs.map(function (tab, index) {
    var active = tab.key === chatViewerActiveKey;
    var icon = tab.kind === 'task' ? '<path d="M8 6h11M8 12h11M8 18h7M3 6h.01M3 12h.01M3 18h.01"/>' : '<path d="M6 3h9l5 5v13H6zM15 3v6h5M9 14h8M9 18h6"/>';
    return '<div class="chat-doc-viewer-tab' + (active ? ' is-active' : '') + '" role="presentation"><button type="button" role="tab" aria-selected="' + active + '" class="chat-doc-viewer-tab-main" data-chat-preview-tab="' + index + '" title="' + escapeHtml(tab.title) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg><span>' + escapeHtml(tab.title) + '</span></button><button type="button" class="chat-doc-viewer-tab-remove" data-chat-preview-close="' + index + '" aria-label="关闭' + escapeHtml(tab.title) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>';
  }).join('');
  var selected = chatViewerTabs.find(function (tab) { return tab.key === chatViewerActiveKey; });
  if (!selected) { body.innerHTML = ''; return; }
  var task = tkGetTasks().find(function (row) { return row.id === selected.taskId; });
  body.innerHTML = selected.kind === 'task' ? (task ? '' : '<p>任务已不存在</p>')
    : '<article class="chat-artifact-markdown"><h1>' + escapeHtml(String(selected.artifact.docTitle || selected.artifact.type || '产物预览')) + '</h1>' + renderArtifactPreview(selected.artifact, 'h2') + '</article>';
  if (selected.kind === 'task' && task) mountChatTaskDrawer(task.id, chatTaskMountVersion);
  body.scrollTop = 0;
}
function showChatViewer(keepConversationAtBottom) {
  var viewer = document.getElementById('chatDocViewer');
  if (!viewer) return;
  clearTimeout(chatDocViewerCloseTimer);
  renderChatViewerTab();
  viewer.hidden = false;
  viewChat.classList.add('doc-open');
  syncTogglePreviewBtn();
  if (keepConversationAtBottom) {
    scrollChatBottom();
    var scrollObserver = new ResizeObserver(scrollChatBottom);
    scrollObserver.observe(chatMessages);
    setTimeout(function () { scrollObserver.disconnect(); scrollChatBottom(); }, 350);
  }
  if (viewer.classList.contains('show')) { setChatDocViewerWidth(viewer); return; }
  viewer.style.width = '';
  requestAnimationFrame(function () { setChatDocViewerWidth(viewer); viewer.classList.add('show'); });
}
function openChatDocViewer(task, artifact, keepConversationAtBottom) {
  var key = 'artifact:' + task.id + ':' + (artifact.id || artifact.type || 'result') + ':' + (artifact.stageId || '');
  var tab = { key: key, kind: 'artifact', taskId: task.id, artifact: artifact, title: String(artifact.type || '产物预览') };
  var existing = chatViewerTabs.findIndex(function (row) { return row.key === key; });
  if (existing < 0) chatViewerTabs.push(tab); else chatViewerTabs[existing] = tab;
  chatViewerActiveKey = key;
  showChatViewer(keepConversationAtBottom);
}
function openChatTaskViewer(task) {
  var key = 'task:' + task.id;
  if (!chatViewerTabs.some(function (row) { return row.key === key; })) chatViewerTabs.push({ key: key, kind: 'task', taskId: task.id, title: task.title || '任务详情' });
  chatViewerActiveKey = key;
  showChatViewer(false);
}
function closeChatDocViewer() {
  chatTaskMountVersion++;
  unmountChatTaskDrawer();
  var viewer = document.getElementById('chatDocViewer');
  if (!viewer || viewer.hidden) return;
  clearTimeout(chatDocViewerCloseTimer);
  viewer.classList.remove('show');
  viewChat.classList.remove('doc-open');
  syncTogglePreviewBtn();
  chatDocViewerCloseTimer = setTimeout(function () {
    viewer.hidden = true;
    viewer.style.width = '';
  }, 250);
}
/* 默认保留约 500px 会话区，其余空间给产物预览；拖拽时会话区保底 360px。 */
function chatDocViewerWidthBounds() {
  var view = document.getElementById('view-chat');
  return { min: 320, max: Math.max(320, view.clientWidth - 360) };
}
function setChatDocViewerWidth(viewer) {
  var bounds = chatDocViewerWidthBounds();
  viewer.style.width = Math.min(bounds.max, Math.max(bounds.min, document.getElementById('view-chat').clientWidth - 500)) + 'px';
}
function initChatDocViewerResize(handle, viewer) {
  handle.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    var pointerId = e.pointerId;
    var startX = e.clientX;
    var startWidth = viewer.getBoundingClientRect().width;
    handle.setPointerCapture(pointerId);
    viewer.classList.add('resizing');
    function move(ev) {
      if (ev.pointerId !== pointerId) return;
      var bounds = chatDocViewerWidthBounds();
      viewer.style.width = Math.round(Math.min(bounds.max, Math.max(bounds.min, startWidth + startX - ev.clientX))) + 'px';
    }
    function end(ev) {
      if (ev.pointerId !== pointerId) return;
      handle.releasePointerCapture(pointerId);
      viewer.classList.remove('resizing');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    }
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
  handle.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    var bounds = chatDocViewerWidthBounds();
    var current = viewer.getBoundingClientRect().width;
    viewer.style.width = Math.round(Math.min(bounds.max, Math.max(bounds.min, current + (e.key === 'ArrowLeft' ? 24 : -24)))) + 'px';
  });
}
/* ---------- 任务会话统一文案格式 ----------
   提示语里的阶段名与产物一律从当前任务数据解析，不单独写死，
   保证「XX已完成，请确认」与产物卡片指向同一份阶段产物。 */
/* 阶段名 → 六阶段语义；「实现规划」须先于「实现」判断，避免误入编码实现 */
function stageSemantic(name) {
  var text = String(name || '');
  if (/需求/.test(text)) return 'requirements';
  if (/规划/.test(text)) return 'planning';
  if (/设计/.test(text)) return 'design';
  if (/编码|实现|开发/.test(text)) return 'implementation';
  if (/测试|验证/.test(text)) return 'verification';
  if (/部署|交付|发布/.test(text)) return 'delivery';
  return '';
}
/* 语义 → 标准产物模板 id：实现规划暂无独立产物，并入技术文档（与 submitTaskStage 的模板口径一致） */
var STAGE_ARTIFACT_TEMPLATE = { requirements:'requirements', design:'technical', planning:'technical', implementation:'implementation', verification:'test', delivery:'delivery' };
function taskStageArtifact(task) {
  var artifacts = tkGetTaskArtifacts(task);
  var exact = artifacts.find(function (artifact) { return artifact.stageId === task.executionStageId; });
  if (exact) return exact;
  var stage = taskExecutionStages(task).find(function (row) { return row.id === task.executionStageId; });
  var templateId = stage ? STAGE_ARTIFACT_TEMPLATE[stageSemantic(stage.name)] : '';
  return (templateId && artifacts.find(function (artifact) { return artifact.id === templateId; })) || artifacts[0];
}
function taskStageName(task) {
  var stage = taskExecutionStages(task).find(function (row) { return row.id === task.executionStageId; });
  return stage?.name || '当前阶段';
}
/* 模拟会话静态提示语：按会话状态套统一句式「{阶段}+状态+行动指令」，阶段名从任务数据解析 */
function demoExchangeText(session, task, exchange) {
  if (!task) return exchange?.response || '';
  var stageName = taskStageName(task);
  switch (session.demoState) {
    case 'running': return '「' + stageName + '」正在执行，完成后提交产物。';
    case 'review': case 'ended': return '「' + stageName + '」已执行完成，请确认产物。';
    case 'confirmed': return '「' + stageName + '」已确认，任务交付完成。';
    case 'blocked': return '「' + stageName + '」执行中断，请查看失败原因。';
    default: return exchange?.response || '';
  }
}
/* 任务状态卡片回看补建的会话开场提示，同口径生成 */
function statusConversationOpeningText(task, blocked) {
  var stageName = taskStageName(task);
  if (blocked) return '「' + stageName + '」执行中断，请查看失败原因。';
  return '「' + stageName + '」已执行完成，请确认产物。';
}
function appendTaskArtifact(result, task, autoOpen) {
  var artifact = taskStageArtifact(task);
  if (!artifact) return;
  result.appendChild(createChatResultArtifactCard(task, artifact));
  var stages = taskExecutionStages(task);
  var next = stages[stages.findIndex(function (stage) { return stage.id === task.executionStageId; }) + 1];
  var closing = document.createElement('p');
  closing.className = 'chat-task-result-closing';
  closing.textContent = '「' + taskStageName(task) + '」产物已生成，' + (next ? '确认后提交并进入「' + next.name + '」。' : '确认后提交并完成任务。');
  result.appendChild(closing);
  if (autoOpen) openChatDocViewer(task, artifact, true);
}
/* 任务会话结果产物卡片：视觉与采购订单会话的 artifact-card 保持一致，点击打开产物预览。 */
function createChatResultArtifactCard(task, artifact) {
  var card = document.createElement('div');
  card.className = 'artifact-card';
  card.innerHTML = '<div class="artifact-preview"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>'
    + '<div class="artifact-info"><div class="artifact-title">' + escapeHtml(artifact.type) + '</div></div>'
    + '<div class="artifact-action"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg></div>';
  card.addEventListener('click', function () { openChatDocViewer(task, artifact); });
  return card;
}
export function setComposerTaskReference(taskId) {
  conversationTaskId = taskId == null ? null : Number(taskId);
  renderConversationTaskReference();
}
function scrollChatBottom(){ chatMessages.scrollTop=chatMessages.scrollHeight; }

function appendUserMessage(text){
  var msg=document.createElement('div');
  msg.className='message user';
  msg.innerHTML='<div class="message-content"><p>'+escapeHtml(text)+'</p></div>';
  messagesList.appendChild(msg);
  scrollChatBottom();
}

function resolveChatTeam(session, task){
  var project = CV_PROJECTS.find(function (row) { return row.id === (task?.project || session?.projectId); });
  return teamById(session?.teamId || task?.teamId || project?.defaultTeam || '');
}
function teamAvatarHtml(team){
  var members = (team.members || []).map(function (id) { return EX[id]; }).filter(Boolean).slice(0, 3);
  return '<span class="chat-team-avatars" role="img" aria-label="' + xesc(team.name) + '成员头像">'
    + members.map(function (member) { return '<img src="' + xesc(xav(member.k)) + '" alt="" title="' + xesc(member.name) + '">'; }).join('') + '</span>';
}
function appendAssistantMessage(team){
  var msg=document.createElement('div');
  msg.className='message assistant';
  msg.innerHTML='<div class="message-content">'
    + (team ? '<div class="chat-agent-identity">' + teamAvatarHtml(team) + '<strong>' + escapeHtml(team.name) + '</strong></div>' : '')
    + '<div class="assistant-response"></div></div>';
  messagesList.appendChild(msg);
  return msg.querySelector('.assistant-response');
}

function createFinalResult(withHeader){
  var result=document.createElement('div');
  result.className='work-step done final-step' + (withHeader ? '' : ' bare');
  result.innerHTML=(withHeader?'<div class="step-header">'
    +'<div class="step-left">'
    +'<svg class="step-icon done" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'
    +'<span class="step-title">生成结果</span></div>'
    +'</div>':'')
    +'<div class="markdown-content"></div>';
  return result;
}

function createArtifactCard(){
  var card=document.createElement('div');
  card.className='artifact-card';
  card.innerHTML='<div class="artifact-preview"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></div>'
    +'<div class="artifact-info"><div class="artifact-title">采购订单</div></div>'
    +'<div class="artifact-action"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg></div>';
  function openPreview(){
    var view=document.getElementById('view-chat');
    var frame=document.getElementById('chatPreviewFrame');
    if(frame){
      var html=billTemplateWithTokens;
      var blob=new Blob([html],{type:'text/html'});
      frame.src=URL.createObjectURL(blob);
      view.classList.add('preview-open');
      if(typeof syncTogglePreviewBtn==='function') syncTogglePreviewBtn();
      try{localStorage.setItem('chatPreviewOpen','1')}catch(e){}
      var savedW=localStorage.getItem('chatPreviewWidth');
      var ps=document.getElementById('chatPreviewSide');
      if(savedW&&ps){ps.style.width=savedW;}
    }
  }
  card.addEventListener('click',openPreview); /* 仅点击卡片时展开预览 */
  card._openPreview=openPreview;
  return card;
}
/* 预览面板关闭按钮 */
var chatPreviewCloseBtn=$('#chatPreviewClose');
/* 预览面板页签切换 */
function switchPreviewTab(target){
  $$('.preview-tab').forEach(function(t){t.classList.toggle('active',t.getAttribute('data-tab')===target)});
  var bodies={preview:$('#previewBodyPreview'),list:$('#previewBodyList'),entity:$('#previewBodyEntity'),plugin:$('#previewBodyPlugin'),api:$('#previewBodyApi'),mcp:$('#previewBodyMcp')};
  Object.keys(bodies).forEach(function(k){
    if(bodies[k]){bodies[k].classList.toggle('hidden',k!==target)}
  });
  var nav=$('#previewNav');
  if(nav){nav.classList.toggle('hidden',target!=='preview')}
  try{localStorage.setItem('chatPreviewTab',target)}catch(e){}
}
/* MCP 工具列表渲染 */
var mcpData=[
  {id:1,act:'新增',tool:'create_purchase_order',toolUniqueID:'post_v2_scm_po_save',desc:'新增采购订单，校验必填字段与金额上限',status:'published',actionType:'保存操作',domain:'采购管理',module:'purchase_order',sensitive:false,serviceSource:'系统内置',customParams:false,errorLog:'—',precond:'[{"condition":"用户具有采购订单新增权限"},{"condition":"供应商基础资料有效"},{"condition":"物料编码有效"}]',postcond:'[{"effect":"保存后数据状态为暂存","field":"billstatus","to_value":"A"}]',recovery:'{"open.100001":{"hint":"必填字段缺失","cause":"请求参数校验失败","suggestion":"请检查必填字段后重试","auto_recoverable":true}}',targetAPI:'POST /kapi/v2/scm/pm/purchaseorder'},
  {id:2,act:'提交',tool:'submit_purchase_order',toolUniqueID:'post_v2_scm_po_submit',desc:'提交采购订单审批，触发三级审批流程',status:'published',actionType:'提交操作',domain:'采购管理',module:'purchase_order',sensitive:false,serviceSource:'系统内置',customParams:false,errorLog:'—',precond:'[{"condition":"订单状态为暂存"},{"condition":"金额>10万需总经理审批"}]',postcond:'[{"effect":"订单状态变为审批中","field":"billstatus","to_value":"B"},{"effect":"通知相关审批人"}]',recovery:'{"flow.1001":{"hint":"审批流程异常","cause":"审批节点配置异常","suggestion":"联系管理员检查审批流配置","auto_recoverable":false}}',targetAPI:'POST /kapi/v2/scm/pm/purchaseorder/{id}/submit'},
  {id:3,act:'审核',tool:'audit_purchase_order',toolUniqueID:'post_v2_scm_po_audit',desc:'审核采购订单，写入审核人与审核时间',status:'published',actionType:'审核操作',domain:'采购管理',module:'purchase_order',sensitive:true,serviceSource:'系统内置',customParams:false,errorLog:'—',precond:'[{"condition":"订单状态为审批中"},{"condition":"当前用户具有审核权限"}]',postcond:'[{"effect":"订单状态变为已审核","field":"billstatus","to_value":"C"},{"effect":"记录审核人与审核时间"}]',recovery:'{"audit.1001":{"hint":"审核失败","cause":"订单金额超出您的审批额度","suggestion":"请联系上级审批人处理","auto_recoverable":false}}',targetAPI:'POST /kapi/v2/scm/pm/purchaseorder/{id}/audit'},
  {id:4,act:'反审核',tool:'unaudit_purchase_order',toolUniqueID:'post_v2_scm_po_unaudit',desc:'反审核已审核的采购订单',status:'published',actionType:'反审核操作',domain:'采购管理',module:'purchase_order',sensitive:true,serviceSource:'系统内置',customParams:false,errorLog:'—',precond:'[{"condition":"订单状态为已审核"},{"condition":"下游未生成入库单"}]',postcond:'[{"effect":"订单状态变为暂存","field":"billstatus","to_value":"A"}]',recovery:'{"audit.1002":{"hint":"反审核拒绝","cause":"下游已生成入库单","suggestion":"请先删除入库单后重试","auto_recoverable":false}}',targetAPI:'POST /kapi/v2/scm/pm/purchaseorder/{id}/unaudit'},
  {id:5,act:'下推',tool:'push_purchase_order',toolUniqueID:'post_v2_scm_po_push',desc:'按未入库数量下推生成入库单',status:'draft',actionType:'下推操作',domain:'采购管理',module:'purchase_order',sensitive:false,serviceSource:'自定义',customParams:true,errorLog:'2026-09-11 下推超时',precond:'[{"condition":"订单状态为已审核"},{"condition":"存在未入库数量"}]',postcond:'[{"effect":"生成入库单草稿"},{"effect":"更新已下推数量"}]',recovery:'{"push.1001":{"hint":"下推失败","cause":"无可下推的未入库数量","suggestion":"请检查采购数量","auto_recoverable":true}}',targetAPI:'POST /kapi/v2/scm/pm/purchaseorder/{id}/push'},
  {id:6,act:'删除',tool:'delete_purchase_order',toolUniqueID:'delete_v2_scm_po',desc:'删除草稿态的采购订单',status:'published',actionType:'删除操作',domain:'采购管理',module:'purchase_order',sensitive:true,serviceSource:'系统内置',customParams:false,errorLog:'—',precond:'[{"condition":"订单状态为暂存"}]',postcond:'[{"effect":"订单被物理删除不可恢复"}]',recovery:'{"delete.1001":{"hint":"删除失败","cause":"订单不是草稿态","suggestion":"请先反审核后删除","auto_recoverable":false}}',targetAPI:'DELETE /kapi/v2/scm/pm/purchaseorder/{id}'},
  {id:7,act:'修改',tool:'update_purchase_order',toolUniqueID:'put_v2_scm_po_update',desc:'修改草稿态的采购订单',status:'published',actionType:'保存操作',domain:'采购管理',module:'purchase_order',sensitive:false,serviceSource:'系统内置',customParams:false,errorLog:'—',precond:'[{"condition":"订单状态为暂存"}]',postcond:'[{"effect":"更新订单数据"},{"effect":"记录修改日志"}]',recovery:'{"update.1001":{"hint":"修改失败","cause":"订单不是草稿态","suggestion":"请先反审核后修改","auto_recoverable":false}}',targetAPI:'PUT /kapi/v2/scm/pm/purchaseorder/{id}'},
  {id:8,act:'查询列表',tool:'query_purchase_order_list',toolUniqueID:'get_v2_scm_po_list',desc:'分页查询采购订单列表，支持按状态/供应商/日期过滤',status:'published',actionType:'查询操作',domain:'采购管理',module:'purchase_order',sensitive:false,serviceSource:'系统内置',customParams:false,errorLog:'—',precond:'[{"condition":"用户具有查询权限"}]',postcond:'[{"effect":"返回采购订单分页列表"}]',recovery:'',targetAPI:'GET /kapi/v2/scm/pm/purchaseorder'},
  {id:9,act:'查询详情',tool:'query_purchase_order_detail',toolUniqueID:'get_v2_scm_po_detail',desc:'查询采购订单详情，返回单头+明细行完整数据',status:'published',actionType:'查询操作',domain:'采购管理',module:'purchase_order',sensitive:false,serviceSource:'系统内置',customParams:false,errorLog:'—',precond:'[{"condition":"用户具有查询权限"}]',postcond:'[{"effect":"返回订单完整数据"}]',recovery:'',targetAPI:'GET /kapi/v2/scm/pm/purchaseorder/{id}'}
];
function renderMcpList(){
  var el=$('#mcpList'); if(!el)return;
  el.innerHTML='<table class="plugin-table mcp-table">'
    +'<colgroup><col style="width:33%"><col style="width:36%"><col style="width:12%"><col style="width:11%"><col style="width:8%"></colgroup>'
    +'<thead><tr><th>工具名称</th><th>说明</th><th>操作类型</th><th>注册状态</th><th></th></tr></thead><tbody>'
    +mcpData.map(function(d){
      var statusText='<span style="color:var(--text)">'+(d.status==='published'?'已发布':'失败')+'</span>';
      var detail='<div style="padding:4px 0;font-size:12px;line-height:1.8;display:grid;grid-template-columns:auto 1fr;gap:4px 16px">'
        +'<span style="color:var(--text-muted)">工具唯一标识</span><span class="code">'+d.toolUniqueID+'</span>'
        +'<span style="color:var(--text-muted)">目标API</span><span class="code">'+d.targetAPI+'</span>'
        +'<span style="color:var(--text-muted)">所属领域</span><span>'+d.domain+'</span>'
        +'<span style="color:var(--text-muted)">所属模块</span><span>'+d.module+'</span>'
        +'<span style="color:var(--text-muted)">是否敏感操作</span><span>'+(d.sensitive?'<span style="color:#e04a3a">敏感</span>':'否')+'</span>'
        +'<span style="color:var(--text-muted)">服务来源</span><span>'+d.serviceSource+'</span>'
        +'<span style="color:var(--text-muted)">自定义参数扩展</span><span>'+(d.customParams?'已配置':'—')+'</span>'
        +'<span style="color:var(--text-muted)">异常日志</span><span>'+d.errorLog+'</span>'
        +(d.precond?'<span style="color:var(--text-muted);align-self:start">前置条件</span><pre style="margin:0;white-space:pre-wrap;font-size:11px;background:var(--fill-1);padding:6px 8px;border-radius:4px">'+d.precond+'</pre>':'')
        +(d.postcond?'<span style="color:var(--text-muted);align-self:start">后置效果</span><pre style="margin:0;white-space:pre-wrap;font-size:11px;background:var(--fill-1);padding:6px 8px;border-radius:4px">'+d.postcond+'</pre>':'')
        +(d.recovery?'<span style="color:var(--text-muted);align-self:start">错误恢复</span><pre style="margin:0;white-space:pre-wrap;font-size:11px;background:var(--fill-1);padding:6px 8px;border-radius:4px">'+d.recovery+'</pre>':'')
        +'</div>';
      return '<tr style="cursor:pointer" onclick="var r=this.nextElementSibling;if(r&&r.classList.contains(\'mcp-detail-row\')){r.classList.toggle(\'hidden\');this.querySelector(\'.mcp-arrow\').classList.toggle(\'open\')}">'
        +'<td class="mcp-tool">'+d.tool+'</td>'
        +'<td class="mcp-desc">'+d.desc+'</td>'
        +'<td style="color:var(--text)">'+d.actionType+'</td>'
        +'<td>'+statusText+'</td>'
        +'<td style="text-align:center;padding:0 12px">'
        +'<svg class="ic mcp-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--text-muted);transition:transform .15s"><polyline points="9 18 15 12 9 6"/></svg>'
        +'</td>'
        +'</tr>'
        +'<tr class="mcp-detail-row hidden"><td colspan="5">'+detail+'</td></tr>';
    }).join('')
    +'</tbody></table>';
}
var listBodyEl=$('#listBody');
var listCheckAll=$('#listCheckAll');
/* 列表点击表头排序 */
var sortState={col:-1,dir:''};
var sortTypeMap={0:'text',1:'text',2:'text',3:'text',4:'date',5:'num',6:'text'};
/* 预览尺寸切换：桌面 / 移动 */
var previewVp=$('#previewViewport');
/* 顶部网址可编辑 */
var previewUrlInput=$('#previewUrlText');
/* 预览面板刷新按钮 */
var previewRefreshBtn=$('#previewRefresh');
/* 分栏拖拽 + localStorage 缓存 */
var chatResizer=$('#chatResizer');

var mockReplies=[
  '已完成采购订单管理应用的开发，以下是实现方案：\n\n## 功能模块\n\n**1. 采购订单创建**\n- 支持选择供应商、采购员、币别、付款条件\n- 明细行可添加物料编码、名称、规格、数量、单价\n- 自动计算含税金额、折扣金额、总金额\n\n**2. 审批流程**\n- 草稿 → 提交 → 部门主管审核 → 财务复核 → 总经理审批（金额>10万触发）\n- 审批意见可追溯，支持驳回退回至草稿\n\n**3. 变更与关闭**\n- 已审核订单支持变更，记录变更前后差异\n- 支持手工关闭和自动关闭（到货完成后自动关闭）\n\n## 技术要点\n- 基于苍穹平台 DynamicObject 实现单据模型，主表 + 明细表关联\n- 使用 QFilter 构建多维度查询（供应商、日期范围、单据状态）\n- 审批流集成 ProcessPlugin，支持节点回退和会签\n\n如需调整字段或流程配置，随时告诉我。',
  '采购订单管理应用开发完成，核心交付内容如下：\n\n**已完成模块：**\n1. 采购订单单据模型（含 32 个字段，覆盖供应商、采购组织、明细行等）\n2. 列表页与详情页（支持批量审核、按状态筛选、模糊搜索）\n3. 审批流程（三级审核：部门主管 → 财务 → 总经理）\n4. 报表导出（PDF / Excel，支持自定义模板）\n\n**关键实现：**\n- 明细行金额自动计算：含税金额 = 数量 × 含税单价，折扣金额自动倒算\n- 供应商联动带出付款条件、币别、默认税率\n- 采购订单与入库单上下游联动，支持部分到货和分批入库\n\n**性能指标：**\n- 列表查询响应 < 200ms（万级数据量）\n- 审批提交 < 500ms\n\n可以直接发布到测试环境验证，或需要我调整某些细节？',
  '基于采购订单管理需求，已完成应用搭建，以下是关键设计：\n\n## 数据模型\n- **采购订单主表**：单据编号、供应商、采购组织、币别、付款条件、交货日期、采购员\n- **采购订单明细**：物料编码、物料名称、规格型号、采购数量、单位、含税单价、金额、税率\n\n## 页面布局\n- 列表页：按单据状态（草稿 → 已提交 → 已审核 → 已关闭）分类筛选\n- 详情页：头信息 + 明细行 + 审批记录三段式布局\n- 支持从采购申请单下推生成采购订单，自动带出明细行\n\n## 业务规则\n1. 同一供应商同月采购金额超 50 万，自动触发总经理审批\n2. 含税金额 = 数量 × 含税单价，折扣金额 = 不含税金额 × 折扣率\n3. 到货数量不可超过采购数量，超量时拦截并提示\n4. 已关闭订单不允许生成入库单\n\n需要我针对哪个模块进一步展开说明？'
];

/* simple markdown → HTML renderer */
function renderMarkdown(text){
  var html=escapeHtml(text);
  html=html.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  html=html.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  html=html.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  html=html.replace(/`([^`]+)`/g,'<code>$1</code>');
  var lines=html.split('\n');
  var out=[];
  var inUl=false,inOl=false;
  for(var i=0;i<lines.length;i++){
    var line=lines[i];
    if(/^\- (.+)$/.test(line)){
      if(!inUl){out.push('<ul>');inUl=true;}
      out.push('<li>'+line.replace(/^\- /,'')+'</li>');
    } else if(/^\d+\. (.+)$/.test(line)){
      if(!inOl){out.push('<ol>');inOl=true;}
      out.push('<li>'+line.replace(/^\d+\. /,'')+'</li>');
    } else {
      if(inUl){out.push('</ul>');inUl=false;}
      if(inOl){out.push('</ol>');inOl=false;}
      if(line.trim()===''){out.push('');}
      else if(/^<(h[23]|ul|ol|li)/.test(line)){out.push(line);}
      else out.push('<p>'+line+'</p>');
    }
  }
  if(inUl)out.push('</ul>');
  if(inOl)out.push('</ol>');
  return out.join('\n');
}

/* 任务会话结果较长，流式节奏需比普通会话慢，避免整段内容一闪而过 */
var TASK_STREAM_PACE={chunkSize:8,interval:80};
function streamText(targetEl,text,onDone,pace){
  var idx=0;
  var chunkSize=pace&&pace.chunkSize?Math.max(1,pace.chunkSize):0;
  var interval=(pace&&pace.interval)||60;
  var cursor=document.createElement('span');
  cursor.className='cursor-blink';
  cursor.textContent='▌';
  targetEl.appendChild(cursor);
  targetEl.style.whiteSpace='pre-wrap';
  targetEl.style.wordBreak='break-word';
  var timer=null,done=false;
  function finish(){
    if(done) return;
    done=true;
    clearTimeout(timer);
    cursor.remove();
    targetEl.innerHTML=renderMarkdown(text);
    targetEl.style.whiteSpace='';
    targetEl.style.wordBreak='';
    if(onDone) onDone();
  }
  function typeNext(){
    if(done) return;
    if(!targetEl.isConnected){done=true;return;}
    if(idx<text.length){
      var chunk=chunkSize
        ? text.slice(idx,idx+chunkSize)
        : text.slice(idx,idx+Math.max(2,Math.ceil(text.length/16)));
      cursor.insertAdjacentText('beforebegin',chunk);
      idx+=chunk.length;
      scrollChatBottom();
      timer=setTimeout(typeNext,interval);
    }else{
      finish();
    }
  }
  typeNext();
  return function(){done=true;clearTimeout(timer);};
}

/* 预览区开关状态：以 localStorage 为唯一来源，默认收起 */
function syncPreviewOpen(artifact){
  var apply=function(){
    var v=document.getElementById('view-chat');
    if(!v)return;
    if(localStorage.getItem('chatPreviewOpen')==='1'){
      if(!v.classList.contains('preview-open')&&artifact&&artifact._openPreview) artifact._openPreview();
      /* 恢复预览页签选择 */
      var savedTab='preview';
      try{savedTab=localStorage.getItem('chatPreviewTab')||'preview'}catch(e){}
      switchPreviewTab(savedTab);
    }else{
      v.classList.remove('preview-open');
      var ps=document.getElementById('chatPreviewSide');
      if(ps){ps.style.width='';ps.style.maxWidth='';}
    }
  };
  apply();
  /* 初始化中若有其它逻辑改动了面板，再以存储值校正一次 */
  requestAnimationFrame(apply);
}
/* 任务会话结果汇报：按任务数据生成正文，需求点数、待确认问题数等口径与产物文档一致 */
function buildTaskResultText(task){
  var stages=taskExecutionStages(task);
  var stage=stages.find(function(s){return s.id===task.executionStageId;})||stages[0]||{};
  var points=requirementPoints(task);
  var core=String(task.desc||'').split(/[。；;\n]/)[0].trim()||('完成「'+task.title+'」主流程');
  var details={
    requirements:['明确业务目标、使用角色与验收边界','拆分 '+points.length+' 条功能需求，并标记优先级与验收条件','登记 '+openIssueCount(task)+' 个待确认问题，供项目负责人核对'],
    design:['确定页面、业务服务、数据访问和外部集成的职责边界','梳理关键字段、状态流转与接口依赖','记录并发修改和外部接口联调风险'],
    planning:['把交付范围拆为可验收的工作项','安排依赖、负责人和阶段里程碑','预留联调、回归与发布检查时间'],
    implementation:['按已确认方案实现页面交互与业务接口','补齐输入校验、状态反馈和异常处理','记录关键接口与组件的实现说明'],
    verification:['验证主流程、边界条件与权限场景','复测异常输入和失败恢复路径','汇总缺陷、回归结果与验收结论'],
    delivery:['核对交付文件、部署配置和接口清单','整理上线验证步骤与回滚说明','汇总已知限制和后续维护事项'],
  }[stageSemantic(stage.name) || stage.id] || ['核对当前阶段的目标与交付边界','按任务描述完成执行和自检','整理可审核的阶段产物'];
  return '我已读取任务「'+task.title+'」的说明。'+(core ? '本次重点是：'+core+'。' : '')+'接下来按「'+(stage.name||'当前阶段')+'」的目标整理交付内容。\n\n'
    +'**'+(stage.name||'当前阶段')+'要点说明：**\n'
    +details.map(function (item) { return '- '+item; }).join('\n')
    +'\n\n「'+(stage.name||'当前阶段')+'」已执行完成，请确认产物：';
}

function appendTaskReadingSummary(responseEl, task) {
  var thinking = document.createElement('details');
  thinking.className = 'chat-task-thinking';
  thinking.open = true;
  thinking.innerHTML = '<summary><span class="chat-task-thinking-mark" aria-hidden="true">✧</span><span>思考了 1 秒</span><span class="chat-task-thinking-toggle">收起</span></summary>'
    + '<div class="chat-task-thinking-content"><strong>✧ 读取附件</strong><p>已读取「' + escapeHtml(task.title) + '」的任务描述与当前阶段资料，正在核对交付范围、依赖和验收要求。</p></div>';
  thinking.addEventListener('toggle', function () { thinking.querySelector('.chat-task-thinking-toggle').textContent = thinking.open ? '收起' : '展开'; });
  responseEl.appendChild(thinking);
}

function simulateAIResponse(responseEl,instant,task,prompt,onDone){
  var run = activeResponseRun;
  /* 所有会话直接流式输出结果，不展示打钩进度。 */
  var taskResultText=task ? buildTaskResultText(task) : '';
  var timeline=document.createElement('div');
  timeline.className='work-steps';
  if(task)appendTaskReadingSummary(responseEl,task);
  responseEl.appendChild(timeline);
  var completed=false;
  var cancelStream=null;
  var watchdog=null;
  function finishRun(){
    if(completed)return;
    completed=true;
    clearTimeout(watchdog);
    if(onDone)onDone();
    var currentTask = !instant && task && tkGetTasks().find(function (row) { return row.id === task.id; });
    var submitted = currentTask?.status === 'in_progress' ? submitTaskStage(currentTask) : null;
    if(submitted?.ok) document.dispatchEvent(new CustomEvent('lingee:task-stage-submitted', {detail:{taskId:task.id}}));
    var runningSession = chatSessions.find(function (session) { return session.id === activeSessionId; });
    if (submitted?.ok && runningSession?.demoState === 'running') {
      runningSession.demoState = 'review';
      runningSession.demoArtifact = true;
      if (runningSession.exchanges.at(-1)) runningSession.exchanges.at(-1).response = taskResultText;
      saveChatSessions();
      renderChatSessions();
    }
  }
  function showCompletedResult(){
    if(completed || run !== activeResponseRun || !responseEl.isConnected)return;
    if(cancelStream)cancelStream();
    timeline.replaceChildren();
    var result=createFinalResult(!task);
    timeline.appendChild(result);
    var artifact=task ? null : createArtifactCard();
    result.querySelector('.markdown-content').innerHTML=renderMarkdown(task ? taskResultText : mockReplies[Math.floor(Math.random()*mockReplies.length)]);
    if(task)appendTaskArtifact(result,task,true);else { result.appendChild(artifact); artifact._openPreview(); }
    scrollChatBottom();
    finishRun();
  }

  if(instant){
    showCompletedResult();
    return;
  }

  watchdog=setTimeout(showCompletedResult,8000);

  function beginStream(){
    if (run !== activeResponseRun || !responseEl.isConnected) return;
    if (completed) return;
    var result=createFinalResult(!task);
    timeline.appendChild(result);
    var mc=result.querySelector('.markdown-content');
    var text=task ? taskResultText : mockReplies[Math.floor(Math.random()*mockReplies.length)];
    cancelStream=streamText(mc,text,function(){
      if (completed || run !== activeResponseRun || !responseEl.isConnected) return;
      if (task) appendTaskArtifact(result,task,true);
      else { var completedArtifact=createArtifactCard(); result.appendChild(completedArtifact); completedArtifact._openPreview(); }
      scrollChatBottom();
      finishRun();
    }, task ? TASK_STREAM_PACE : null);
  }
  if (task) setTimeout(beginStream, 500);
  else beginStream();
}

function doSend(automatic){
  var t=input.textContent.trim();
  if(!t){ input.focus(); return; }
  /* 苍穹应用模式未选择关联应用时拦截；带任务关联的会话不依赖关联应用 */
  var modeEl=$('.mode-item.checked');
  var currentMode=modeEl?modeEl.getAttribute('data-val'):'';
  if(automatic !== true && currentMode==='苍穹应用' && appChip.classList.contains('muted') && !getConversationTask()){
    toast('请先选择关联应用','error');
    appDd.classList.remove('error');
    void appDd.offsetWidth;
    appDd.classList.add('error');
    return;
  }
  var autoPicked=false;
  if(!pickValid()){
    var am=autoMatch(t);
    if(am){ set_activePick(am); renderExpertChips(); autoPicked=true; }
  }
  showView('chat');
  var linkedTask = getConversationTask();
  messagesList.innerHTML = '';
  activeSessionTaskId = linkedTask ? linkedTask.id : null;
  activeResponseRun++;
  closeChatDocViewer();
  chatViewerTabs = [];
  chatViewerActiveKey = null;
  $('#chatTitle').textContent = linkedTask ? linkedTask.title : t.slice(0, 60);
  var session = createChatSession($('#chatTitle').textContent, activeSessionTaskId);
  var exchangeIndex = addSessionExchange(t);
  renderChatTaskSide();
  renderConversationTaskReference();
  var empty=$('#chatEmpty');
  if(empty) empty.remove();
  appendUserMessage(t);
  if(autoPicked) appendAutoNote();
  input.innerHTML=''; refreshSend();
  var pend=linkedTask ? [] : pendingInputs(t);
  if(pend.length && appendAskCard(pend)){
    /* 缺输入就停在追问上，确认完再执行 */
    session.exchanges[exchangeIndex].waiting = true;
    saveChatSessions();
    renderChatSessions();
  }else{
    var responseEl=appendAssistantMessage(resolveChatTeam(session, linkedTask));
    simulateAIResponse(responseEl,false,linkedTask,t,function () { finishSessionExchange(session.id, exchangeIndex); });
  }
  chatInput.innerHTML='';
  var chatSend=$('#chatSendBtn');
  chatSend.classList.remove('active');
  chatInput.focus();
  if (linkedTask) {
    selectChatApp('');
    chatAppDd.classList.remove('disabled');
  } else {
    /* 独立演示会话沿用示例应用。 */
    selectChatApp('采购订单管理');
    chatAppDd.classList.add('disabled');
  }
}

export function startTaskConversationSimulation(taskId) {
  if (getConversationTask()?.id !== taskId) return;
  var task = getConversationTask();
  input.textContent = task.desc || task.title || '开始执行任务';
  refreshSend();
  doSend(true);
}

/* 任务「开始执行」等入口直接以指定文本发起会话：不进输入框，落到聊天页即运行中 */
export function sendComposerText(text){
  text=String(text||'').trim();
  if(!text) return;
  closeTaskExceptionHistory();
  input.textContent=text;
  refreshSend();
  doSend();
}

/* ---------- chat composer 发送 ---------- */
var chatInput=$('#chatInput');
var chatSendBtn=$('#chatSendBtn');
function refreshChatSend(){ chatSendBtn.classList.toggle('active', chatInput.textContent.trim().length>0); }
function chatDoSend(){
  var t=chatInput.textContent.trim();
  if(!t){ chatInput.focus(); return; }
  var creation = chatSessions.find(function (row) { return row.id === activeSessionId && row.taskCreate; });
  if (creation) { if (answerTaskCreateMessage(creation, t)) { chatInput.innerHTML=''; refreshChatSend(); } chatInput.focus(); return; }
  if (answerTaskQuestion(t)) { chatInput.innerHTML=''; refreshChatSend(); return; }
  var session = chatSessions.find(function (row) { return row.id === activeSessionId; }) || createChatSession($('#chatTitle').textContent || t.slice(0, 60),activeSessionTaskId);
  var exchangeIndex = addSessionExchange(t);
  renderChatTaskSide();
  var empty=$('#chatEmpty');
  if(empty) empty.remove();
  appendUserMessage(t);
  chatInput.innerHTML=''; refreshChatSend();
  var task = tkGetTasks().find(function (row) { return row.id === activeSessionTaskId; });
  var responseEl=appendAssistantMessage(resolveChatTeam(session, task));
  activeResponseRun++;
  simulateAIResponse(responseEl,false,task,t,function () { finishSessionExchange(session.id, exchangeIndex); });
  chatInput.focus();
}
/* ---------- ＋按钮下拉菜单 ---------- */
function bindAddDropdown(btn){
  if(!btn) return;
  var dd=btn.closest('.dropdown');
  if(!dd) return;
  btn.addEventListener('click',function(e){
    e.stopPropagation();
    e.preventDefault();
    var isOpen=dd.classList.contains('open');
    closeAll(null);
    if(!isOpen) dd.classList.add('open');
  });
  $$('.menu-item',dd).forEach(function(item){
    item.addEventListener('click',function(){
      if(item.classList.contains('add-item--submenu')) return;
      var action=item.getAttribute('data-action');
      dd.classList.remove('open');
      if(action==='attach'){ openFilePicker(); }
      else if(action==='folder'){ toast('引用文件夹'); }
      else if(action==='knowledge'){ toast('知识库'); }
      else if(action==='connector'){ toast('连接器'); }
      else if(action==='spec'){ toast('Spec'); }
      else if(action==='goal'){ toast('目标'); }
    });
  });
  /* 连接器子菜单交互 */
  var connColors={腾讯云:'#00a4ff',阿里云:'#ff6a00',华为云:'#ff0000'};
  var connLetters={腾讯云:'☁',阿里云:'☁',华为云:'☁'};
  function addConnBadge(dd,name){
    var badges=dd.closest('.composer-bar').querySelector('.connector-badges');
    if(!badges||badges.querySelector('[data-conn="'+name+'"]')) return;
    var b=document.createElement('span');b.className='conn-badge';
    b.setAttribute('data-conn',name);b.title=name;
    b.style.background=connColors[name]||'#888';
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" style="width:12px;height:12px;display:block"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" fill="#fff" stroke="#fff" stroke-width=".5"/></svg>';
    badges.appendChild(b);
  }
  function removeConnBadge(dd,name){
    var badges=dd.closest('.composer-bar').querySelector('.connector-badges');
    if(!badges) return;
    var b=badges.querySelector('[data-conn="'+name+'"]');if(b)b.remove();
  }
  $$('.connector-btn',dd).forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var name=btn.closest('.connector-item').querySelector('.connector-name').textContent;
      btn.textContent='正在连接';
      btn.style.background='var(--hover)';
      btn.style.color='var(--text-muted)';
      btn.style.borderColor='var(--border)';
      btn.style.pointerEvents='none';
      setTimeout(function(){
        window.open('https://tcb.cloud.tencent.com/login?cliAuth=1&_redirect_uri=https%3A%2F%2Ftcb.cloud.tencent.com%2Fdev%23%2Fcli-auth%3Fport%3D9012%26hash%3Dcbcbb3ce8c291a411c00cf7099fdc5ea%26mac%3D80%253Ad1%253Ace%253A0d%253Ae6%253A37%26os%3DM2607-0081.local%252FmacOS%252016.6%26from%3Dcli&authCallbackUrl=http%3A%2F%2F127.0.0.1%3A9012&port=9012&hash=cbcbb3ce8c291a411c00cf7099fdc5ea&mac=80%3Ad1%3Ace%3A0d%3Ae6%3A37&os=M2607-0081.local%2FmacOS%2016.6&from=cli','_blank');
        toast('请完成网站授权','info');
        setTimeout(function(){
          var tg=document.createElement('div');
          tg.className='connector-toggle on';
          btn.replaceWith(tg);
          bindToggle(tg);
          addConnBadge(dd,name);
          toast('连接器 '+name+' 已连接','success');
        },3000);
      },1000);
    });
  });
  function bindToggle(t){
    t.addEventListener('click',function(e){
      e.stopPropagation();
      var name=t.closest('.connector-item').querySelector('.connector-name').textContent;
      if(t.classList.contains('on')){
        t.classList.remove('on');
        removeConnBadge(dd,name);
      }else{
        t.classList.add('connecting');
        toast('连接器 '+name+' 连接中','info');
        setTimeout(function(){
          t.classList.remove('connecting');
          t.classList.add('on');
          addConnBadge(dd,name);
          toast('连接器 '+name+' 已连接','success');
        },1500);
      }
    });
  }
  $$('.connector-toggle',dd).forEach(bindToggle);
  var cm=dd.querySelector('.connector-manage');
  if(cm) cm.addEventListener('click',function(){dd.classList.remove('open');toast('管理连接器');});
  var connectorItem=dd.querySelector('[data-action="connector"]');
  if(connectorItem) connectorItem.addEventListener('mouseenter',function(){
    var input=connectorItem.querySelector('.connector-search input');
    if(input) setTimeout(function(){input.focus();},50);
  });
  /* 连接器搜索过滤 */
  var searchInput=dd.querySelector('.connector-search input');
  if(searchInput && !searchInput._filterBound){
    searchInput._filterBound=true;
    searchInput.addEventListener('input',function(){
      var q=this.value.trim().toLowerCase();
      var items=dd.querySelectorAll('.connector-item');
      items.forEach(function(item){
        var name=item.querySelector('.connector-name').textContent.toLowerCase();
        item.style.display=(!q||name.indexOf(q)>-1)?'':'none';
      });
    });
  }
}

/* ---------- # 唤起任务选择 ---------- */
var taskPicker = null;
var taskPickerItems = [];
var taskPickerIdx = -1;
var taskPickerRange = null;

function ensureTaskPicker() {
  if (taskPicker) return taskPicker;
  taskPicker = document.createElement('div');
  taskPicker.className = 'tk-mention-picker';
  taskPicker.hidden = true;
  document.body.appendChild(taskPicker);
  taskPicker.addEventListener('mousedown', function (e) {
    var item = e.target.closest('.tk-mention-item');
    if (item) { e.preventDefault(); confirmTaskMention(parseInt(item.dataset.idx, 10)); }
  });
  return taskPicker;
}

function showTaskPicker(anchorEl, query) {
  var picker = ensureTaskPicker();
  var tasks = tkGetTasks();
  var q = query.trim().toLowerCase();
  var matches = q ? tasks.filter(function (t) {
    return (t.code || '').toLowerCase().indexOf(q) > -1 || (t.title || '').toLowerCase().indexOf(q) > -1;
  }) : tasks;
  matches = matches.slice(0, 20);
  taskPickerItems = matches;
  taskPickerIdx = matches.length ? 0 : -1;
  if (!matches.length) {
    picker.innerHTML = '<div class="tk-mention-empty">没有匹配的任务</div>';
  } else {
    picker.innerHTML = matches.map(function (t, i) {
      var sel = i === 0 ? ' selected' : '';
      return '<div class="tk-mention-item' + sel + '" data-idx="' + i + '">'
        + '<span class="tk-mention-code">' + escapeHtml(t.code || '') + '</span>'
        + '<span class="tk-mention-title">' + escapeHtml(t.title || '') + '</span>'
        + '</div>';
    }).join('');
  }
  var rect = anchorEl.getBoundingClientRect();
  picker.style.left = rect.left + 'px';
  picker.style.top = (rect.bottom + 4) + 'px';
  picker.style.minWidth = Math.max(280, rect.width) + 'px';
  picker.hidden = false;
}

function hideTaskPicker() {
  if (taskPicker) taskPicker.hidden = true;
  taskPickerItems = [];
  taskPickerIdx = -1;
  taskPickerRange = null;
}

function highlightPickerItem(idx) {
  if (!taskPicker) return;
  var items = taskPicker.querySelectorAll('.tk-mention-item');
  items.forEach(function (el, i) { el.classList.toggle('selected', i === idx); });
  if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
}

function confirmTaskMention(idx) {
  var task = taskPickerItems[idx];
  if (!task || !taskPickerRange) { hideTaskPicker(); return; }
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(taskPickerRange);
  taskPickerRange.deleteContents();
  var chip = document.createElement('span');
  chip.className = 'ctag';
  chip.contentEditable = 'false';
  chip.dataset.taskId = String(task.id);
  chip.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
    + '<span class="ctag-label">' + escapeHtml(task.code || '') + ' ' + escapeHtml(task.title || '') + '</span>'
    + '<button type="button" class="ctag-x" contenteditable="false" aria-label="移除任务关联"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
  taskPickerRange.insertNode(chip);
  var sp = document.createTextNode('\u00A0');
  chip.parentNode.insertBefore(sp, chip.nextSibling);
  var r = document.createRange();
  r.setStartAfter(sp);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
  hideTaskPicker();
}

function detectMention(ed) {
  var sel = window.getSelection();
  if (!sel.rangeCount) return null;
  var range = sel.getRangeAt(0);
  if (!ed.contains(range.startContainer)) return null;
  var node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  var text = node.textContent.substring(0, range.startOffset);
  var m = text.match(/(?:^|\s)#([^\s#]{0,30})$/);
  if (!m) return null;
  var hashOffset = range.startOffset - m[0].length + (m[1].length ? 0 : 0);
  var prefix = m[0];
  var atIdx = prefix.lastIndexOf('#');
  hashOffset = range.startOffset - prefix.length + atIdx;
  var r = document.createRange();
  r.setStart(node, hashOffset);
  r.setEnd(node, range.startOffset);
  return { query: m[1], range: r };
}

function initTaskMention(ed) {
  if (!ed) return;
  ed.addEventListener('input', function () {
    var hit = detectMention(ed);
    if (hit) {
      taskPickerRange = hit.range;
      showTaskPicker(ed, hit.query);
    } else {
      hideTaskPicker();
    }
  });
  ed.addEventListener('keydown', function (e) {
    if (!taskPicker || taskPicker.hidden) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (taskPickerIdx < taskPickerItems.length - 1) { taskPickerIdx++; highlightPickerItem(taskPickerIdx); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (taskPickerIdx > 0) { taskPickerIdx--; highlightPickerItem(taskPickerIdx); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (taskPickerIdx >= 0) confirmTaskMention(taskPickerIdx);
    } else if (e.key === 'Escape') {
      hideTaskPicker();
      e.preventDefault();
    }
  });
  ed.addEventListener('blur', function () { setTimeout(hideTaskPicker, 150); });
  ed.addEventListener('click', function (e) {
    var x = e.target.closest('.ctag-x');
    if (!x) return;
    e.preventDefault();
    var tag = x.closest('.ctag');
    if (!tag) return;
    var sp = tag.nextSibling;
    tag.remove();
    if (sp && sp.nodeType === Node.TEXT_NODE && sp.textContent === '\u00A0') sp.remove();
  });
}

export function initComposer() {
  document.querySelector('#view-chat .chat-container').addEventListener('click', function (event) {
    var creation = chatSessions.find(function (row) { return row.id === activeSessionId && row.taskCreate; });
    var type = event.target.closest('[data-task-create-type]');
    if (creation && type) { answerTaskCreateMessage(creation, type.dataset.taskCreateType); return; }
    var reviewer = event.target.closest('[data-task-create-reviewer]');
    if (creation && reviewer) {
      var person = tkPeopleInProject(creation.taskCreate.projectId).find(function (row) { return row.id === reviewer.dataset.taskCreateReviewer; });
      if (person) answerTaskCreateMessage(creation, person.name);
      return;
    }
    if (creation && event.target.closest('[data-task-create-confirm]')) { confirmTaskCreate(creation); return; }
    if (creation && event.target.closest('[data-task-create-open]')) {
      import('./tasks-v2/index.js').then(function (module) { module.openTaskDetailFromSession(creation.taskId); });
      return;
    }
    var option = event.target.closest('[data-task-question-option]');
    if (!option) return;
    var session = chatSessions.find(function (row) { return row.id === activeSessionId; });
    var answer = session?.demoQuestion?.options[Number(option.getAttribute('data-task-question-option'))];
    if (answer) answerTaskQuestion(answer);
  });
  document.getElementById('chatMessages').addEventListener('change', function (event) {
    if (event.target.id !== 'chatTaskCreateProject') return;
    var session = chatSessions.find(function (row) { return row.id === activeSessionId && row.taskCreate; });
    if (!session || session.taskCreate.status === 'done') return;
    var projectId = event.target.value;
    if (projectId && !tkProjectsForCurrentUser().some(function (row) { return row.id === projectId; })) return;
    session.projectId = projectId;
    session.teamId = CV_PROJECTS.find(function (row) { return row.id === projectId; })?.defaultTeam || '';
    session.taskCreate.projectId = projectId;
    session.taskCreate.reviewers = {};
    if (session.taskCreate.prompt) session.taskCreate.status = 'type';
    collapsedChatProjects.delete(projectId);
    saveChatSessions();
    renderChatSessions();
    renderTaskCreateChat(session);
    chatInput.focus();
  });
  renderChatSessions();
  queueMicrotask(renderChatSessions);
  document.addEventListener('lingee:sidebar-filter', renderChatSessions);
  document.getElementById('chatSessionList').addEventListener('click', function (event) {
    var entry = event.target.closest('[data-chat-session]');
    if (entry) openChatSession(entry.getAttribute('data-chat-session'));
  });
  document.getElementById('chatProjectFolders').addEventListener('click', function (event) {
    var entry = event.target.closest('[data-chat-session]');
    if (entry) { openChatSession(entry.getAttribute('data-chat-session')); return; }
    var toggle = event.target.closest('[data-chat-project-toggle]');
    if (toggle) {
      expandedChatProjects.add(toggle.getAttribute('data-chat-project-toggle'));
      renderChatSessions();
      return;
    }
    var title = event.target.closest('.chat-project-title');
    if (!title) return;
    var id = title.closest('[data-chat-project]').getAttribute('data-chat-project');
    if (collapsedChatProjects.has(id)) collapsedChatProjects.delete(id); else collapsedChatProjects.add(id);
    title.closest('.chat-project-folder').classList.toggle('collapsed', collapsedChatProjects.has(id));
    title.setAttribute('aria-expanded', String(!collapsedChatProjects.has(id)));
    setTimeout(renderChatSessions, 180);
  });
  document.addEventListener('lingee:new-conversation', closeTaskExceptionHistory);
  document.addEventListener('lingee:new-conversation', clearChatTaskSide);
  document.addEventListener('lingee:task-updated', function (event) {
    if (event.detail?.task?.id === conversationTaskId) renderConversationTaskReference();
    if (event.detail?.task?.id === activeSessionTaskId) renderChatTaskSide();
  });
  document.getElementById('chatStageConfirmBtn').addEventListener('click', confirmChatStage);
  document.getElementById('chatTitle').addEventListener('click', function () {
    var task = tkGetTasks().find(function (row) { return row.id === activeSessionTaskId; });
    if (task) openChatTaskViewer(task);
  });
  var chatDocViewer = document.getElementById('chatDocViewer');
  if (chatDocViewer) {
    document.getElementById('chatDocViewerClose').addEventListener('click', closeChatDocViewer);
    document.getElementById('chatDocViewerTabs').addEventListener('click', function (event) {
      var remove = event.target.closest('[data-chat-preview-close]');
      if (remove) {
        var index = Number(remove.dataset.chatPreviewClose);
        var removed = chatViewerTabs.splice(index, 1)[0];
        if (removed?.key === chatViewerActiveKey) chatViewerActiveKey = chatViewerTabs[Math.min(index, chatViewerTabs.length - 1)]?.key || null;
        if (chatViewerTabs.length) renderChatViewerTab(); else closeChatDocViewer();
        return;
      }
      var tab = event.target.closest('[data-chat-preview-tab]');
      if (tab) { chatViewerActiveKey = chatViewerTabs[Number(tab.dataset.chatPreviewTab)]?.key || null; renderChatViewerTab(); }
    });
    var chatDocResize = document.getElementById('chatDocViewerResize');
    if (chatDocResize) initChatDocViewerResize(chatDocResize, chatDocViewer);
    window.addEventListener('resize', function () {
      if (!chatDocViewer.hidden) setChatDocViewerWidth(chatDocViewer);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !chatDocViewer.hidden) closeChatDocViewer();
    });
  }
  document.addEventListener('lingee:new-conversation', function () { setComposerTaskReference(null); });
  document.addEventListener('click', function (event) {
    if (event.target.closest('#ntTags [data-clear-task-ref]')) setComposerTaskReference(null);
  });
  input.addEventListener('input',refreshSend);
  input.addEventListener('keydown',function(e){
    if(e.key==='Enter' && !e.shiftKey){
      if(taskPicker && !taskPicker.hidden) return;
      e.preventDefault(); doSend();
    }
  });
  sendBtn.addEventListener('click',doSend);
  initTaskMention(input);
  initTaskMention(chatInput);
  if(chatPreviewCloseBtn){
    chatPreviewCloseBtn.addEventListener('click',function(){
      var view=document.getElementById('view-chat');
      var ps=document.getElementById('chatPreviewSide');
      view.classList.remove('preview-open');
      if(typeof syncTogglePreviewBtn==='function') syncTogglePreviewBtn();
      try{localStorage.setItem('chatPreviewOpen','0')}catch(e){}
      if(ps){ps.style.width='';ps.style.maxWidth='';}
    });
  }
  $$('.preview-tab').forEach(function(tab){
    tab.addEventListener('click',function(){
      switchPreviewTab(tab.getAttribute('data-tab'));
    });
  });
  renderMcpList();
  if(listBodyEl){
    listBodyEl.addEventListener('change',function(e){
      if(e.target.tagName!=='INPUT'||e.target.type!=='checkbox')return;
      var tr=e.target.closest('tr');
      if(!tr)return;
      tr.classList.toggle('on',e.target.checked);
    });
  }
  if(listCheckAll&&listBodyEl){
    listCheckAll.addEventListener('change',function(){
      var checked=listCheckAll.checked;
      $$('input[type=checkbox]',listBodyEl).forEach(function(cb){
        cb.checked=checked;
        var tr=cb.closest('tr');
        if(tr)tr.classList.toggle('on',checked);
      });
    });
  }
  $$('.list-table th.sortable').forEach(function(th){
    th.addEventListener('click',function(){
      var col=parseInt(th.getAttribute('data-col'),10);
      if(sortState.col===col){
        if(sortState.dir==='asc')sortState.dir='desc';
        else if(sortState.dir==='desc'){sortState.dir='';sortState.col=-1;}
        else sortState.dir='asc';
      }else{
        sortState.col=col;sortState.dir='asc';
      }
      $$('.list-table th.sortable').forEach(function(h){
        h.classList.remove('sort-asc','sort-desc');
        var arrow=h.querySelector('.sort-arrow');
        if(arrow)arrow.className='sort-arrow';
      });
      if(sortState.dir){
        th.classList.add('sort-'+sortState.dir);
        var arrow=th.querySelector('.sort-arrow');
        if(arrow)arrow.className='sort-arrow '+sortState.dir;
      }
      if(sortState.col>=0&&sortState.dir){
        var rows=Array.prototype.slice.call(listBodyEl.querySelectorAll('tr'));
        var type=sortTypeMap[sortState.col]||'text';
        rows.sort(function(a,b){
          var ca=a.children[sortState.col+1].textContent.trim();
          var cb=b.children[sortState.col+1].textContent.trim();
          var va,vb;
          if(type==='num'){
            va=parseFloat(ca.replace(/,/g,''))||0;
            vb=parseFloat(cb.replace(/,/g,''))||0;
          }else if(type==='date'){
            va=new Date(ca).getTime();
            vb=new Date(cb).getTime();
          }else{
            va=ca;vb=cb;
          }
          if(va<vb)return sortState.dir==='asc'?-1:1;
          if(va>vb)return sortState.dir==='asc'?1:-1;
          return 0;
        });
        rows.forEach(function(r){listBodyEl.appendChild(r)});
      }
    });
  });
  /* 实体节点切换 */
  $$('.entity-left-item').forEach(function(node){
    node.addEventListener('click',function(){
      $$('.entity-left-item').forEach(function(n){n.classList.remove('active')});
      node.classList.add('active');
    });
  });
  if(previewVp){
    previewVp.addEventListener('click',function(){
      var mobile=!previewVp.classList.contains('mobile');
      previewVp.classList.toggle('mobile',mobile);
      previewVp.setAttribute('aria-pressed',mobile?'true':'false');
      previewVp.setAttribute('data-tooltip',mobile?'切换到桌面尺寸':'切换到移动尺寸');
      var body=$('#previewBodyPreview');
      if(body) body.classList.toggle('vp-mobile',mobile);
    });
  }
  if(previewUrlInput){
    previewUrlInput.addEventListener('focus',function(){ this.select(); });
    previewUrlInput.addEventListener('keydown',function(e){
      if(e.key==='Enter'){
        var v=this.value.trim();
        if(!v) return;
        if(!/^[a-z][a-z0-9+.-]*:/i.test(v)) v='https://'+v;
        this.value=v;
        var f=$('#chatPreviewFrame');
        if(f){ var cur=f.getAttribute('src'); if(cur&&cur!==v) f.src=v; else f.src=v; }
        this.blur();
      }else if(e.key==='Escape'){
        this.blur();
      }
    });
  }
  if(previewRefreshBtn){
    previewRefreshBtn.addEventListener('click',function(){
      var frame=document.getElementById('chatPreviewFrame');
      if(frame&&frame.src){frame.src=frame.src}
    });
  }
  if(chatResizer){
    var _dragging=false;
    var _startX=0;
    var _startW=0;
    var _maxW=0;
    chatResizer.addEventListener('mousedown',function(e){
      _dragging=true;
      chatResizer.classList.add('dragging');
      document.body.style.cursor='col-resize';
      document.body.style.userSelect='none';
      var view=document.getElementById('view-chat');
      var ps=document.getElementById('chatPreviewSide');
      var cc=view.querySelector('.chat-container');
      view.classList.add('resizing');
      _startX=e.clientX;
      _startW=ps.offsetWidth;
      _maxW=view.offsetWidth-360-chatResizer.offsetWidth;
      if(_maxW<200)_maxW=200;
      if(cc)cc.style.minWidth='0';
      e.preventDefault();
    });
    document.addEventListener('mousemove',function(e){
      if(!_dragging)return;
      var delta=_startX-e.clientX;
      var w=_startW+delta;
      if(w<200)w=200;
      if(w>_maxW)w=_maxW;
      document.getElementById('chatPreviewSide').style.width=w+'px';
    });
    document.addEventListener('mouseup',function(){
      if(_dragging){
        _dragging=false;
        chatResizer.classList.remove('dragging');
        var view=document.getElementById('view-chat');
        view.classList.remove('resizing');
        var cc=view.querySelector('.chat-container');
        if(cc)cc.style.minWidth='';
        document.body.style.cursor='';
        document.body.style.userSelect='';
        var ps=document.getElementById('chatPreviewSide');
        set__prevWishW(null);
        if(ps&&ps.style.width)localStorage.setItem('chatPreviewWidth',ps.style.width);
      }
    });
  }
  /* 所有下拉面板关闭时恢复焦点到输入框 */
  $$('.dropdown').forEach(function(dd){
    new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        if(m.attributeName==='class'){
          var wasOpen=m.oldValue&&m.oldValue.indexOf('open')>-1;
          if(wasOpen&&!dd.classList.contains('open')){
            if(!viewChat.classList.contains('hidden')){ chatInput.focus(); }
            else{ input.focus(); }
          }
        }
      });
    }).observe(dd,{attributes:true,attributeFilter:['class'],attributeOldValue:true});
  });
  chatInput.addEventListener('input',function(){
    refreshChatSend();
    if((this.textContent||'').trim()==='') this.innerHTML='';
  });
  chatInput.addEventListener('keydown',function(e){
    if(e.key==='Enter' && !e.shiftKey){
      if(taskPicker && !taskPicker.hidden) return;
      e.preventDefault(); chatDoSend();
    }
  });
  chatSendBtn.addEventListener('click',chatDoSend);
}

export function initPlusMenu() {
  bindAddDropdown(addBtn);
  bindAddDropdown(chatAddBtn);
  $('.modal-close',attachModal) && $('.modal-close',attachModal).addEventListener('click',closeAttach);
  attachModal.addEventListener('click',function(e){
    if(e.target===attachModal) closeAttach();
  });
  $$('.attach-item',attachModal).forEach(function(item){
    item.addEventListener('click',function(){
      var name=$('.attach-name',item).textContent.trim();
      closeAttach();
      toast('已选择：'+name);
    });
  });

  /* header + footer small affordances */
  $$('.sb-head-icons .ic').forEach(function(i,idx){ i.addEventListener('click',function(){ toast(idx===0?'搜索':'折叠侧栏'); }); });
}

export { appendAssistantMessage, appendUserMessage, chatResizer, createArtifactCard, doSend, messagesList, refreshSend, scrollChatBottom, simulateAIResponse };
