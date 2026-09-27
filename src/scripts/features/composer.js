import { billTemplateWithTokens } from '../core/bill-template.js';
import { $, $$ } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { input, showView, viewChat } from '../core/view.js';
import { addBtn, appChip, appDd, attachModal, chatAddBtn, chatAppDd, closeAttach, openFilePicker, selectChatApp } from './attach-app.js';
import { syncTogglePreviewBtn } from './chat.js';
import { closeAll } from './dropdown.js';
import { appendAskCard, appendAutoNote, autoMatch } from './expert/automatch.js';
import { renderExpertChips } from './expert/chips.js';
import { pendingInputs } from './expert/data.js';
import { pickValid, set_activePick } from './expert/store.js';
import { set__prevWishW } from './sidebar.js';
import { CV_PROJECTS } from './collab/data.js';
import { tkGetTasks } from './tasks-v2/data.js';
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
  if (panel) panel.remove();
  if (back) back.remove();
  if (taskExceptionPreviousTitle) $('#chatTitle').textContent = taskExceptionPreviousTitle;
  taskExceptionBack = null;
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
try {
  var savedSessions = JSON.parse(localStorage.getItem(CHAT_SESSIONS_KEY) || '[]');
  if (Array.isArray(savedSessions)) chatSessions = savedSessions.filter(function (session) {
    return session && /^[a-z0-9]+$/i.test(session.id) && typeof session.title === 'string' && Array.isArray(session.exchanges);
  }).slice(0, 30).map(function (session) {
    session.exchanges = session.exchanges.filter(function (exchange) { return exchange && typeof exchange.prompt === 'string'; });
    return session;
  });
} catch (e) {}
function saveChatSessions() {
  try { localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(chatSessions.slice(0, 30))); } catch (e) {}
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
    var running = session.exchanges.some(function (exchange) { return !exchange.done && !exchange.waiting; });
    var waiting = session.exchanges.some(function (exchange) { return !!exchange.waiting; });
    return '<button type="button" class="chat-session-entry' + (session.id === activeSessionId ? ' active' : '') + '" data-chat-session="' + session.id + '"><span class="dot ' + (running ? 'blue' : waiting ? 'orange' : 'green') + '"></span><span class="txt">' + escapeHtml(String(session.title)) + '</span></button>';
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
    return '<div class="chat-project-folder' + (collapsed ? ' collapsed' : '') + '" data-chat-project="' + escapeHtml(String(id)).replace(/"/g, '&quot;') + '">'
      + '<button type="button" class="chat-project-title" aria-expanded="' + !collapsed + '"><span class="chat-project-chevron">⌄</span><svg class="chat-project-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1.5 4.5h4l1.4 1.5h7.6v6.5H1.5z"/><path d="M1.5 4.5V3h4.8l1.4 1.5"/></svg><span class="txt">' + escapeHtml(name) + '</span></button>'
      + '<div class="chat-project-sessions">' + entry[1].map(sessionHtml).join('') + '</div></div>';
  }).join('');
}
function createChatSession(title, taskId) {
  var task = tkGetTasks().find(function (row) { return row.id === taskId; });
  var projectId = task?.project || '';
  var session = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title: title, taskId: taskId, projectId: projectId, exchanges: [] };
  if (projectId) collapsedChatProjects.delete(projectId);
  chatSessions.unshift(session);
  chatSessions = chatSessions.slice(0, 30);
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
function openChatSession(sessionId) {
  var session = chatSessions.find(function (row) { return row.id === sessionId; });
  if (!session) return;
  activeResponseRun++;
  activeSessionId = session.id;
  activeSessionTaskId = session.taskId == null ? null : Number(session.taskId);
  showView('chat');
  $('#chatHeaderTask')?.classList.add('hidden');
  messagesList.innerHTML = '';
  document.getElementById('chatTaskArtifacts').innerHTML = '<span class="chat-task-pending">对话完成后显示产物</span>';
  renderChatTaskSide();
  setComposerTaskReference(activeSessionTaskId);
  $('#chatTitle').textContent = session.title;
  var task = tkGetTasks().find(function (row) { return row.id === activeSessionTaskId; });
  session.exchanges.forEach(function (exchange, index) {
    appendUserMessage(exchange.prompt);
    if (exchange.waiting) { appendAskCard(pendingInputs(exchange.prompt)); return; }
    var response = appendAssistantMessage();
    simulateAIResponse(response, !!exchange.done, task, exchange.prompt, function () { finishSessionExchange(session.id, index); });
  });
  renderChatSessions();
  scrollChatBottom();
}
function getConversationTask() {
  return conversationTaskId == null ? null : tkGetTasks().find(function (task) { return task.id === conversationTaskId; }) || null;
}
function renderConversationTaskReference() {
  var task = getConversationTask();
  ['ntTags', 'chatTags'].forEach(function (id) {
    var tags = document.getElementById(id);
    if (!tags) return;
    tags.classList.toggle('hidden', !task);
    tags.innerHTML = task ? '<span class="ctag" data-task-ref-id="' + task.id + '"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><span class="ctag-label">' + escapeHtml(task.code || '') + ' ' + escapeHtml(task.title || '') + '</span><button type="button" class="ctag-x" data-clear-task-ref aria-label="移除任务关联"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></span>' : '';
  });
  if (task && !viewChat.classList.contains('hidden')) $('#chatTitle').textContent = task.title;
}
function renderChatTaskSide() {
  var task = tkGetTasks().find(function (row) { return row.id === activeSessionTaskId; });
  var side = document.getElementById('chatTaskSide');
  side.hidden = !task;
  viewChat.classList.toggle('task-context-open', !!task);
  if (task) viewChat.classList.remove('preview-open');
  if (!task) return;
  var link = document.getElementById('chatTaskLink');
  link.dataset.taskId = String(task.id);
  link.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><span>' + escapeHtml(String(task.code || '')) + ' ' + escapeHtml(String(task.title || '')) + '</span>';
}
function clearChatTaskSide() {
  activeSessionTaskId = null;
  activeSessionId = null;
  activeResponseRun++;
  document.getElementById('chatTaskArtifacts').innerHTML = '<span class="chat-task-pending">对话完成后显示产物</span>';
  renderChatTaskSide();
  renderChatSessions();
}
function taskArtifactText(task, prompt) {
  return '# ' + task.title + ' · 需求分析\n\n'
    + '关联任务：' + (task.code || '') + '\n'
    + '本轮指令：' + prompt + '\n\n'
    + '## 任务背景\n' + (task.desc || task.title) + '\n\n'
    + '## 建议下一步\n1. 确认业务范围与边界条件。\n2. 按任务描述拆分实现和验收项。\n3. 与任务负责人确认后进入下一阶段。\n';
}
function appendTaskArtifact(result, task, prompt) {
  var text = taskArtifactText(task, prompt);
  var card = document.createElement('button');
  card.type = 'button';
  card.className = 'chat-task-artifact';
  card.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg><span>需求分析.md</span>';
  function showDocument() {
    var output = document.getElementById('chatTaskArtifacts');
    if (!output || activeSessionTaskId !== task.id) return;
    var doc = output.querySelector('.chat-task-document');
    if (!doc) { doc = document.createElement('div'); doc.className = 'chat-task-document'; output.appendChild(doc); }
    doc.textContent = text;
  }
  card.addEventListener('click', showDocument);
  result.appendChild(card);
  if (activeSessionTaskId === task.id) {
    var output = document.getElementById('chatTaskArtifacts');
    output.innerHTML = '';
    output.appendChild(card.cloneNode(true));
    output.firstChild.addEventListener('click', showDocument);
  }
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

function appendAssistantMessage(){
  var msg=document.createElement('div');
  msg.className='message assistant';
  msg.innerHTML='<div class="message-content"><div class="assistant-response"></div></div>';
  messagesList.appendChild(msg);
  return msg.querySelector('.assistant-response');
}

function createWorkStep(title,status){
  var step=document.createElement('div');
  step.className='work-step '+status;
  var iconHtml=status==='done'
    ?'<svg class="step-icon done" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
    :'<svg class="step-icon running" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
  var statusHtml=status==='running'?'<span class="step-status">执行中…</span>':'';
  step.innerHTML='<div class="step-header">'
    +'<div class="step-left">'+iconHtml+'<span class="step-title">'+title+'</span></div>'
    +'<div class="step-right">'+statusHtml+'</div>'
    +'</div>';
  return step;
}

function createFinalResult(){
  var result=document.createElement('div');
  result.className='work-step done final-step';
  result.innerHTML='<div class="step-header">'
    +'<div class="step-left">'
    +'<svg class="step-icon done" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'
    +'<span class="step-title">生成结果</span></div>'
    +'</div>'
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

function streamText(targetEl,text,onDone){
  var idx=0;
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
    if(idx<text.length){
      cursor.insertAdjacentText('beforebegin',text.slice(idx,idx+10));
      idx+=10;
      scrollChatBottom();
      timer=setTimeout(typeNext,30);
    }else{
      finish();
    }
  }
  typeNext();
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
function simulateAIResponse(responseEl,instant,task,prompt,onDone){
  var run = activeResponseRun;
  var steps=task ? [
    {title:'读取关联任务', detail:'已读取 ' + (task.code || '') + '「' + task.title + '」。\n任务背景：' + String(task.desc || task.title).slice(0, 140) + (String(task.desc || '').length > 140 ? '…' : '')},
    {title:'梳理需求与范围', detail:'本轮指令：' + String(prompt || '开始分析').slice(0, 120) + '\n正在整理目标、范围和待确认项。'},
    {title:'整理分析产物', detail:'已形成需求分析草稿，包含任务背景、本轮指令和建议下一步。'}
  ] : [{title:'需求分析'},{title:'开发页面'},{title:'测试验收'}];
  var taskResultText=task ? '关联任务 **' + task.code + ' ' + task.title + '** 的需求分析已整理完成。\n\n产物：需求分析.md（原型模拟）。点击产物可查看具体内容。' : '';
  var timeline=document.createElement('div');
  timeline.className='work-steps';
  responseEl.appendChild(timeline);

  if(instant){
    steps.forEach(function(s){
      timeline.appendChild(createWorkStep(s.title,'done'));
    });
    var result=createFinalResult();
    timeline.appendChild(result);
    var mc=result.querySelector('.markdown-content');
    var text=task ? taskResultText : mockReplies[Math.floor(Math.random()*mockReplies.length)];
    mc.innerHTML=renderMarkdown(text);
    var artifact=task ? null : createArtifactCard();
    if (task) appendTaskArtifact(result,task,prompt || ''); else result.appendChild(artifact);
    scrollChatBottom(); /* 预览区保持收起，等待用户点击产物卡片 */
    /* 预览区开关完全由 chatPreviewOpen 决定；默认收起 */
    if (!task) syncPreviewOpen(artifact);
    if (onDone) onDone();
    return;
  }

  var currentStepIdx=0;

  function addNextStep(){
    if (run !== activeResponseRun || !responseEl.isConnected) return;
    if(currentStepIdx>=steps.length){
      var result=createFinalResult();
      timeline.appendChild(result);
      var mc=result.querySelector('.markdown-content');
      var text=task ? taskResultText : mockReplies[Math.floor(Math.random()*mockReplies.length)];
      streamText(mc,text,function(){
        if (run !== activeResponseRun || !responseEl.isConnected) return;
        if (task) appendTaskArtifact(result,task,prompt || '');
        else result.appendChild(createArtifactCard());
        scrollChatBottom();
        if (onDone) onDone();
      });
      return;
    }
    var step=createWorkStep(steps[currentStepIdx].title,'running');
    timeline.appendChild(step);
    scrollChatBottom();
    function finishStep(){
      if (run !== activeResponseRun || !responseEl.isConnected) return;
      step.classList.remove('running');
      step.classList.add('done');
      var icon=step.querySelector('.step-icon');
      icon.className='step-icon done';
      icon.innerHTML='<path d="M20 6 9 17l-5-5"/>';
      step.querySelector('.step-status')&&step.querySelector('.step-status').remove();
      currentStepIdx++;
      setTimeout(addNextStep,120);
    }
    if (task) {
      var detail=document.createElement('div');
      detail.className='step-detail streaming-content';
      step.appendChild(detail);
      streamText(detail,steps[currentStepIdx].detail,finishStep);
    } else setTimeout(finishStep,350);
  }
  addNextStep();
}

function doSend(){
  var t=input.textContent.trim();
  if(!t){ input.focus(); return; }
  /* 苍穹应用模式未选择关联应用时拦截 */
  var modeEl=$('.mode-item.checked');
  var currentMode=modeEl?modeEl.getAttribute('data-val'):'';
  if(currentMode==='苍穹应用' && appChip.classList.contains('muted')){
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
  document.getElementById('chatTaskArtifacts').innerHTML = '<span class="chat-task-pending">对话完成后显示产物</span>';
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
  var pend=pendingInputs(t);
  if(pend.length && appendAskCard(pend)){
    /* 缺输入就停在追问上，确认完再执行 */
    session.exchanges[exchangeIndex].waiting = true;
    saveChatSessions();
    renderChatSessions();
  }else{
    var responseEl=appendAssistantMessage();
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

/* ---------- chat composer 发送 ---------- */
var chatInput=$('#chatInput');
var chatSendBtn=$('#chatSendBtn');
function refreshChatSend(){ chatSendBtn.classList.toggle('active', chatInput.textContent.trim().length>0); }
function chatDoSend(){
  var t=chatInput.textContent.trim();
  if(!t){ chatInput.focus(); return; }
  var session = chatSessions.find(function (row) { return row.id === activeSessionId; }) || createChatSession($('#chatTitle').textContent || t.slice(0, 60),activeSessionTaskId);
  var exchangeIndex = addSessionExchange(t);
  renderChatTaskSide();
  var empty=$('#chatEmpty');
  if(empty) empty.remove();
  appendUserMessage(t);
  chatInput.innerHTML=''; refreshChatSend();
  var responseEl=appendAssistantMessage();
  activeResponseRun++;
  simulateAIResponse(responseEl,false,tkGetTasks().find(function (task) { return task.id === activeSessionTaskId; }),t,function () { finishSessionExchange(session.id, exchangeIndex); });
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
    var title = event.target.closest('.chat-project-title');
    if (!title) return;
    var id = title.closest('[data-chat-project]').getAttribute('data-chat-project');
    if (collapsedChatProjects.has(id)) collapsedChatProjects.delete(id); else collapsedChatProjects.add(id);
    renderChatSessions();
  });
  document.addEventListener('lingee:new-conversation', closeTaskExceptionHistory);
  document.addEventListener('lingee:new-conversation', clearChatTaskSide);
  document.addEventListener('lingee:task-updated', function (event) {
    if (event.detail?.task?.id === conversationTaskId) renderConversationTaskReference();
    if (event.detail?.task?.id === activeSessionTaskId) renderChatTaskSide();
  });
  document.getElementById('chatTaskLink').addEventListener('click', function () {
    if (activeSessionTaskId == null) return;
    import('./tasks-v2/index.js').then(function (module) { module.openTaskDetailFromSession(activeSessionTaskId); });
  });
  document.addEventListener('lingee:new-conversation', function () { setComposerTaskReference(null); });
  document.addEventListener('click', function (event) {
    if (event.target.closest('#ntTags [data-clear-task-ref], #chatTags [data-clear-task-ref]')) setComposerTaskReference(null);
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
