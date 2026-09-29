/* 新版任务界面原型。复用当前任务数据；执行计划只在当前页面会话中保存。 */
import { escapeHtml } from './ui-utils.js';
import { TK_STATUSES, tkAddTask, tkCurrentUserId, tkGetTasks, tkPeopleInProject, tkProjectsForCurrentUser, tkUpdateTask } from './data.js';
import { CV_MEMBERS, CV_PROJECTS } from '../collab/data.js';
import { defaultStageAssigneeId } from './stage-owner.js';
import { tbTeamStages } from '../collab/tb-core.js';
import { TEAMS } from '../expert/store.js';
import { toast } from '../../core/toast.js';
import { startTaskCreationChat } from '../composer.js';
import taskFlowHtml from '../../../../outputs/task-state-flow.html?raw';

let renderTasks = () => {};
let refreshTaskDetail = () => {};
let currentTaskId = null;
let editingTaskId = null;
let initialPlanSnapshot = '[]';
let draftStages = [];
let draftConfirmed = false;
let selectedOwnerId = '';
let selectedProjectId = '';
let personPopupTarget = '';
let personPopupStageId = '';
let activePlanScope = 'existing';
const byId = id => document.getElementById(id);
const currentTask = () => activePlanScope === 'create'
  ? { project: byId('niuProject').value, assignee: selectedOwnerId, title: byId('niuTitle').value, desc: byId('niuDescription').value, issueType: byId('niuType').value }
  : tkGetTasks().find(task => task.id === currentTaskId);
const projectName = id => tkProjectsForCurrentUser().find(project => project.id === id)?.name || '项目';
const personName = (projectId, id) => tkPeopleInProject(projectId).find(person => person.id === id)?.name || '待分配';
const hasTaskStarted = task => !['planned', 'backlog'].includes(task.status)
  || !['planned', 'backlog'].includes(task.initialStatus || task.status)
  || (task.statusHistory || []).some(change => !['planned', 'backlog'].includes(change.from) || !['planned', 'backlog'].includes(change.to));
const planLocked = () => {
  const taskId = activePlanScope === 'create' ? editingTaskId : currentTaskId;
  const task = tkGetTasks().find(item => item.id === taskId);
  return !!task && hasTaskStarted(task);
};

function closeOverlays() {
  closePersonPopup();
  closeProjectPopup();
  byId('niuCreateOverlay').hidden = true;
  byId('niuPlanOverlay').hidden = true;
}

function closeTaskFlowHelp() {
  byId('tkFlowHelpOverlay').hidden = true;
  byId('tkFlowHelpFrame').srcdoc = '';
}

function sizeTaskFlowHelp() {
  if (byId('tkFlowHelpOverlay').hidden) return;
  const frame = byId('tkFlowHelpFrame');
  const svg = frame.contentDocument?.querySelector('svg');
  if (svg) frame.style.height = `${Math.ceil(svg.getBoundingClientRect().height)}px`;
}

function openTaskFlowHelp() {
  const frame = byId('tkFlowHelpFrame');
  frame.style.height = '0px';
  frame.srcdoc = taskFlowHtml;
  byId('tkFlowHelpOverlay').hidden = false;
  byId('tkFlowHelpClose').focus();
}

function closePersonPopup() {
  byId('niuPersonPopup').hidden = true;
  document.querySelectorAll('[data-niu-owner-stage]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  personPopupTarget = '';
  personPopupStageId = '';
}

function closeProjectPopup() {
  byId('niuProjectPopup').hidden = true;
  byId('niuProjectTrigger').setAttribute('aria-expanded', 'false');
}

function renderProjectOptions() {
  const query = byId('niuProjectSearch').value.trim().toLocaleLowerCase();
  const projects = tkProjectsForCurrentUser().filter(project => project.name.toLocaleLowerCase().includes(query));
  byId('niuProjectOptions').innerHTML = projects.length ? projects.map(project => '<button type="button" role="option" aria-selected="' + (project.id === selectedProjectId) + '" data-niu-project="' + escapeHtml(project.id) + '"><span>' + escapeHtml(project.name) + '</span><b>' + (project.id === selectedProjectId ? '✓' : '') + '</b></button>').join('') : '<p>没有匹配的项目</p>';
}

function openProjectPopup() {
  byId('niuProjectSearch').value = '';
  renderProjectOptions();
  const popup = byId('niuProjectPopup');
  const trigger = byId('niuProjectTrigger');
  trigger.setAttribute('aria-expanded', 'true');
  popup.hidden = false;
  const rect = trigger.getBoundingClientRect();
  const ph = popup.offsetHeight;
  const goDown = rect.bottom + ph + 8 <= window.innerHeight;
  popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 260)) + 'px';
  if (goDown) {
    popup.style.top = (rect.bottom + 4) + 'px';
    popup.style.bottom = 'auto';
  } else {
    popup.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    popup.style.top = 'auto';
  }
  byId('niuProjectSearch').focus();
}

function selectProject(projectId) {
  if (projectId === selectedProjectId) {
    byId('niuSmartProject').value = projectId;
    closeProjectPopup();
    return;
  }
  if (planLocked() && draftStages.some(stage => !tkPeopleInProject(projectId).some(person => person.id === stage.assigneeId))) {
    const task = tkGetTasks().find(item => item.id === editingTaskId);
    if (task) projectId = task.project;
    toast('执行计划已锁定，阶段确认人不属于新项目', 'warning');
  }
  selectedProjectId = projectId;
  byId('niuProject').value = projectId;
  byId('niuProjectName').textContent = projectId ? projectName(projectId) : '选择项目';
  byId('niuSmartProject').value = projectId;
  setDefaultStageOwner(projectId);
  if (!planLocked()) {
    draftStages = defaultPlanStages(projectId);
    draftConfirmed = false;
    byId('niuCreateStageCount').textContent = String(draftStages.length);
  }
  closePersonPopup();
  closeProjectPopup();
  if (projectId) { try { localStorage.setItem('lingee_task_last_project', projectId); } catch(e) {} }
}

function renderPersonOptions() {
  const projectId = currentTask()?.project;
  const chosen = draftStages.find(stage => stage.id === personPopupStageId)?.assigneeId;
  const query = byId('niuPersonSearch').value.trim().toLocaleLowerCase();
  const people = tkPeopleInProject(projectId).filter(person => person.name.toLocaleLowerCase().includes(query));
  byId('niuPersonOptions').innerHTML = people.length ? people.map(person => '<button type="button" role="option" aria-selected="' + (person.id === chosen) + '" data-niu-person="' + escapeHtml(person.id) + '"><span class="niu-person-avatar">' + escapeHtml(person.name.slice(0, 1)) + '</span><span>' + escapeHtml(person.name) + '</span><b>' + (person.id === chosen ? '✓' : '') + '</b></button>').join('') : '<p>没有匹配的项目成员</p>';
}

function openPersonPopup(target, stageId) {
  if (target === 'stage' && planLocked()) return;
  const projectId = currentTask()?.project;
  if (!projectId) { toast('请先选择项目', 'warning'); byId('niuProject').focus(); return; }
  personPopupTarget = target;
  personPopupStageId = stageId || '';
  const list = byId(activePlanScope === 'create' ? 'niuCreateStageList' : 'niuStageList');
  const trigger = list.querySelector('[data-niu-owner-stage="' + CSS.escape(stageId) + '"]');
  if (!trigger) return;
  const popup = byId('niuPersonPopup');
  byId('niuPersonSearch').value = '';
  renderPersonOptions();
  popup.hidden = false;
  const rect = trigger.getBoundingClientRect();
  const ph = popup.offsetHeight;
  const goDown = rect.bottom + ph + 8 <= window.innerHeight;
  popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 250)) + 'px';
  if (goDown) {
    popup.style.top = (rect.bottom + 4) + 'px';
    popup.style.bottom = 'auto';
  } else {
    popup.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    popup.style.top = 'auto';
  }
  trigger.setAttribute('aria-expanded', 'true');
  byId('niuPersonSearch').focus();
}

/* 执行计划阶段的默认负责人：当前用户属于项目成员时用本人。 */
function setDefaultStageOwner(projectId) {
  const people = tkPeopleInProject(projectId);
  const creatorId = tkCurrentUserId();
  selectedOwnerId = people.some(person => person.id === creatorId) ? creatorId : '';
}

/* 执行计划的执行阶段选项：项目对应专家团的每个交付阶段一项，逐个预置、不重复。 */
const projectTeamOf = projectId => TEAMS.find(item => item.id === CV_PROJECTS.find(project => project.id === projectId)?.defaultTeam) || null;
const planStageOptions = projectId => tbTeamStages(projectTeamOf(projectId)).map(stage => ({ name: stage.name, desc: stage.desc || '' }));

/* 默认执行计划：按项目成员角色预选每个阶段的确认人；同角色多人先选第一人。 */
function defaultPlanStages(projectId) {
  const project = CV_PROJECTS.find(item => item.id === projectId);
  const people = tkPeopleInProject(projectId);
  return planStageOptions(projectId).map(stage => ({
    id: crypto.randomUUID(), workType: stage.name, title: stage.name, description: stage.desc,
    assigneeId: defaultStageAssigneeId(project, people, CV_MEMBERS, stage.name),
    status: 'pending',
  }));
}

function setWizardStep(step) {
  const plan = step === 'plan';
  byId('niuInfoPane').hidden = plan;
  byId('niuCreatePlanPane').hidden = !plan;
  byId('niuCreateMode').hidden = plan || editingTaskId !== null;
  byId('niuWizardBack').hidden = !plan;
  byId('niuWizardNext').hidden = plan;
  byId('niuCreateSubmit').hidden = !plan;
  byId('niuCreateOverlay').querySelectorAll('[data-niu-wizard-step]').forEach(item => {
    if (item.dataset.niuWizardStep === step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
    item.toggleAttribute('data-complete', plan && item.dataset.niuWizardStep === 'info');
  });
  byId('niuCreateScroll').scrollTop = 0;
  if (plan) renderPlan();
}

function renderSmartProjectOptions() {
  const projects = tkProjectsForCurrentUser();
  byId('niuSmartProject').innerHTML = '<option value="">请选择所属项目</option>' + projects.map(project => '<option value="' + escapeHtml(project.id) + '">' + escapeHtml(project.name) + '</option>').join('');
  byId('niuSmartProject').value = projects.some(project => project.id === selectedProjectId) ? selectedProjectId : '';
}

function setCreateMode(mode) {
  const smart = mode === 'smart';
  closeProjectPopup();
  closePersonPopup();
  byId('niuSmartPane').hidden = !smart;
  byId('niuWizardProgress').hidden = smart;
  byId('niuManualFooter').hidden = smart;
  byId('niuSmartFooter').hidden = !smart;
  byId('niuCreateMode').hidden = smart || editingTaskId !== null;
  byId('niuSmartBackHead').hidden = !smart;
  if (!smart) {
    byId('niuCreateHeading').textContent = editingTaskId === null ? '新建任务' : '编辑任务';
    setWizardStep('info');
    byId(selectedProjectId ? 'niuTitle' : 'niuProjectTrigger').focus();
    return;
  }
  byId('niuInfoPane').hidden = true;
  byId('niuCreatePlanPane').hidden = true;
  byId('niuCreateHeading').innerHTML = '<span class="niu-smart-star">✦</span> 智能创建任务';
  renderSmartProjectOptions();
  byId('niuCreateScroll').scrollTop = 0;
  byId(selectedProjectId ? 'niuSmartPrompt' : 'niuSmartProject').focus();
}

function submitSmartCreate() {
  const projectId = byId('niuSmartProject').value;
  const prompt = byId('niuSmartPrompt').value.trim();
  if (!tkProjectsForCurrentUser().some(project => project.id === projectId)) { toast('请选择所属项目', 'warning'); byId('niuSmartProject').focus(); return; }
  if (!prompt) { toast('请输入任务描述', 'warning'); byId('niuSmartPrompt').focus(); return; }
  selectProject(projectId);
  closeOverlays();
  startTaskCreationChat(projectId, prompt);
}

function renderOwner(projectId) {
  const name = selectedOwnerId ? personName(projectId, selectedOwnerId) : '选择负责人';
  byId('niuOwnerName').textContent = name;
  byId('niuOwnerAvatar').textContent = selectedOwnerId ? name.slice(0, 1) : '人';
}

export function openNewIssueCreate(projectId) {
  const projects = tkProjectsForCurrentUser();
  if (!projects.length) { toast('请先加入项目再创建任务', 'warning'); return; }
  closeOverlays();
  activePlanScope = 'create';
  currentTaskId = null;
  editingTaskId = null;
  initialPlanSnapshot = '[]';
  draftStages = [];
  draftConfirmed = false;
  byId('niuCreateStageCount').textContent = '0';
  var lastProjectId = projectId || '';
  if (!lastProjectId) { try { lastProjectId = localStorage.getItem('lingee_task_last_project') || ''; } catch(e) {} }
  selectedProjectId = projects.some(project => project.id === lastProjectId) ? lastProjectId : '';
  byId('niuProject').value = selectedProjectId;
  byId('niuProjectName').textContent = selectedProjectId ? projectName(selectedProjectId) : '选择项目';
  byId('niuTitle').value = '';
  byId('niuDescription').value = '';
  byId('niuType').value = '';
  byId('niuPriority').value = 'medium';
  setDefaultStageOwner(selectedProjectId);
  draftStages = selectedProjectId ? defaultPlanStages(selectedProjectId) : [];
  initialPlanSnapshot = JSON.stringify(draftStages);
  byId('niuCreateStageCount').textContent = String(draftStages.length);
  byId('niuCreateSubmit').textContent = '保存';
  byId('niuSmartPrompt').value = '';
  renderSmartProjectOptions();
  byId('niuCreateOverlay').hidden = false;
  setCreateMode('manual');
  renderPlan();
  byId('niuCreateScroll').scrollTop = 0;
}

export function openNewIssueEdit(taskId) {
  const task = tkGetTasks().find(item => item.id === Number(taskId));
  if (!task) { toast('未找到任务', 'warning'); return; }
  const projects = tkProjectsForCurrentUser();
  if (!projects.some(project => project.id === task.project)) { toast('未加入该项目，无法编辑任务', 'warning'); return; }
  closeOverlays();
  activePlanScope = 'create';
  currentTaskId = task.id;
  editingTaskId = task.id;
  draftStages = (task.executionPlan || []).map(stage => ({ ...stage }));
  initialPlanSnapshot = JSON.stringify(draftStages);
  draftConfirmed = task.planStatus === 'confirmed';
  selectedProjectId = task.project;
  byId('niuProject').value = task.project;
  byId('niuProjectName').textContent = projectName(task.project);
  byId('niuTitle').value = task.title || '';
  byId('niuDescription').value = task.desc || '';
  byId('niuType').value = task.issueType || '';
  byId('niuPriority').value = task.priority || 'medium';
  selectedOwnerId = task.assignee || '';
  byId('niuCreateSubmit').textContent = '保存修改';
  byId('niuCreateStageCount').textContent = String(draftStages.length);
  byId('niuCreateOverlay').hidden = false;
  setCreateMode('manual');
  renderPlan();
  byId('niuCreateScroll').scrollTop = 0;
}

function selectCreateTab(tab) {
  setWizardStep(tab);
}

function validateTaskInfo() {
  const title = byId('niuTitle').value.trim();
  const description = byId('niuDescription').value.trim();
  const project = byId('niuProject').value;
  const issueType = byId('niuType').value;
  if (!tkProjectsForCurrentUser().some(item => item.id === project)) { toast('请选择所属项目', 'warning'); selectCreateTab('info'); byId('niuProjectTrigger').focus(); return false; }
  if (!title) { toast('请输入任务标题', 'warning'); selectCreateTab('info'); byId('niuTitle').focus(); return false; }
  if (!description) { toast('请输入任务描述', 'warning'); selectCreateTab('info'); byId('niuDescription').focus(); return false; }
  if (!issueType) { toast('请选择任务类型', 'warning'); selectCreateTab('info'); byId('niuType').focus(); return false; }
  return true;
}

function createTask() {
  if (!validateTaskInfo()) return;
  const title = byId('niuTitle').value.trim();
  const description = byId('niuDescription').value.trim();
  const project = byId('niuProject').value;
  const issueType = byId('niuType').value;
  const owner = selectedOwnerId;
  if (!planLocked() && !draftStages.length) { toast('请至少添加一个执行阶段', 'warning'); selectCreateTab('plan'); byId('niuCreateAdd').focus(); return; }
  const originalProject = editingTaskId === null ? null : tkGetTasks().find(item => item.id === editingTaskId)?.project;
  const unassignedStage = (!planLocked() || project !== originalProject) && draftStages.find(stage => stage.requiresConfirmation !== false && !tkPeopleInProject(project).some(person => person.id === stage.assigneeId));
  if (unassignedStage) { toast('请为节点选择当前项目的审核人', 'warning'); selectCreateTab('plan'); byId('niuCreateStageList').querySelector('[data-niu-owner-stage="' + CSS.escape(unassignedStage.id) + '"]')?.focus(); return; }
  if (editingTaskId !== null) {
    const task = tkGetTasks().find(item => item.id === editingTaskId);
    if (!task) { toast('未找到任务', 'warning'); closeOverlays(); return; }
    const patch = { title, desc: description, issueType,
      priority: byId('niuPriority').value, assignee: owner, project };
    if (project !== task.project) patch.teamId = CV_PROJECTS.find(item => item.id === project)?.defaultTeam || '';
    if (!planLocked() && JSON.stringify(draftStages) !== initialPlanSnapshot) {
      patch.executionPlan = draftStages.map(stage => ({ ...stage }));
      patch.planStatus = 'draft';
    }
    tkUpdateTask(task.id, patch);
    renderTasks();
    refreshTaskDetail(task.id);
    closeOverlays();
    toast('任务已保存', 'success');
    return;
  }
  tkAddTask({
    title, desc: description, issueType,
    status: 'backlog', priority: byId('niuPriority').value, dueDate: '',
    assignee: owner, createdBy: tkCurrentUserId(), project, teamId: CV_PROJECTS.find(item => item.id === project)?.defaultTeam || '', labels: [],
    executionPlan: draftStages.map(stage => ({ ...stage })),
    planStatus: 'draft',
  });
  renderTasks();
  closeOverlays();
  toast('任务和执行计划草案已创建', 'success');
}

function renderPlan() {
  const task = currentTask();
  if (!task) return;
  const locked = planLocked();
  const disabled = locked ? ' disabled' : '';
  const completed = draftStages.filter(stage => stage.status === 'done').length;
  const banner = '<span class="niu-plan-state"><i></i>' + (draftConfirmed ? '已确认' : '计划草案') + ' · ' + draftStages.length + ' 个阶段</span><span>' + (locked ? '任务已启动，执行计划已锁定' : draftStages.every(stage => stage.assigneeId) ? '✓ 各阶段已分配确认人' : '部分阶段待分配确认人') + '</span>';
  const stageOptions = planStageOptions(task.project);
  const stageList = draftStages.length ? draftStages.map((stage, index) => {
    const options = stageOptions.map(row => '<option value="' + escapeHtml(row.name) + '"' + (row.name === stage.workType ? ' selected' : '') + '>' + escapeHtml(row.name) + '</option>').join('')
      + (stageOptions.some(row => row.name === stage.workType) || !stage.workType ? '' : '<option value="' + escapeHtml(stage.workType) + '" selected>' + escapeHtml(stage.workType) + '</option>');
    const confirmation = stage.requiresConfirmation !== false;
    const owner = confirmation ? '<button type="button" class="niu-stage-owner" data-niu-owner-stage="' + escapeHtml(stage.id) + '" aria-haspopup="listbox" aria-expanded="false" aria-label="选择第 ' + (index + 1) + ' 节点审核人"' + disabled + '>' + escapeHtml(personName(task.project, stage.assigneeId)) + '<span aria-hidden="true">⌄</span></button>' : '<span class="niu-stage-continuous">完成后直接进入下一节点</span>';
    const fields = '<div class="niu-stage-fields"><label><span>执行阶段</span><select data-niu-work-type="' + escapeHtml(stage.id) + '" aria-label="第 ' + (index + 1) + ' 执行阶段"' + disabled + '>' + options + '</select></label><label><span>阶段工作说明</span><input data-niu-description="' + escapeHtml(stage.id) + '" value="' + escapeHtml(stage.description || '') + '" placeholder="填写本节点要完成的工作" aria-label="第 ' + (index + 1) + ' 阶段工作说明"' + disabled + '></label></div>';
    const completion = '<div class="niu-stage-completion"><span class="niu-stage-label">完成方式</span><div class="niu-stage-choice" role="group" aria-label="第 ' + (index + 1) + ' 节点完成方式"><button type="button" data-niu-confirm-mode="' + escapeHtml(stage.id) + '" data-required="false" aria-pressed="' + (!confirmation) + '"' + disabled + '>直接继续</button><button type="button" data-niu-confirm-mode="' + escapeHtml(stage.id) + '" data-required="true" aria-pressed="' + confirmation + '"' + disabled + '>需要确认</button></div>' + owner + '</div>';
    const remove = locked ? '' : '<button type="button" class="niu-stage-remove" data-niu-remove="' + escapeHtml(stage.id) + '" aria-label="移除第 ' + (index + 1) + ' 节点">×</button>';
    if (activePlanScope === 'create') {
      return '<div class="niu-stage niu-stage--compact" data-niu-stage="' + escapeHtml(stage.id) + '"><span class="niu-stage-index">' + String(index + 1).padStart(2, '0') + '</span><label class="niu-stage-inline-field"><span>执行阶段</span><select data-niu-work-type="' + escapeHtml(stage.id) + '" aria-label="第 ' + (index + 1) + ' 执行阶段"' + disabled + '>' + options + '</select></label><div class="niu-stage-inline-field"><span>审核人</span>' + (confirmation ? owner : '<span class="niu-stage-continuous">无需审核</span>') + '</div>' + remove + '</div>';
    }
    return '<div class="niu-stage" data-niu-stage="' + escapeHtml(stage.id) + '"><span class="niu-stage-index">' + String(index + 1).padStart(2, '0') + '</span>' + fields + completion + remove + '</div>';
  }).join('') : '<div class="niu-plan-empty">还没有工作阶段。添加阶段后可直接在分录中编辑。</div>';
  if (activePlanScope === 'create') {
    byId('niuCreateAdd').disabled = locked;
    byId('niuCreateStageCount').textContent = String(draftStages.length);
    byId('niuCreateStageList').innerHTML = stageList;
    return;
  }
  byId('niuBreadcrumb').textContent = '项目  /  ' + projectName(task.project) + '  /  ' + task.code;
  byId('niuPlanHeading').textContent = task.title;
  byId('niuPlanCode').textContent = task.code + ' · ' + (task.issueType || '未设置类型') + ' · 当前页面演示数据';
  byId('niuPlanTab').textContent = '执行计划 ' + draftStages.length;
  byId('niuPlanBanner').innerHTML = banner;
  byId('niuPlanConfirm').disabled = !draftStages.length || draftStages.some(stage => !stage.assigneeId);
  byId('niuPlanSave').disabled = locked;
  if (locked) byId('niuPlanConfirm').disabled = true;
  byId('niuAddToggle').disabled = locked;
  byId('niuPlanConfirm').textContent = draftConfirmed ? '已确认计划' : '确认计划';
  byId('niuStageList').innerHTML = stageList;
  const teamName = TEAMS.find(team => team.id === task.teamId)?.name || '未设置';
  const statusName = TK_STATUSES.find(status => status.id === task.status)?.name || '待办';
  byId('niuPlanAside').innerHTML = '<dl><div><dt>状态</dt><dd>' + escapeHtml(statusName) + '</dd></div><div><dt>所属项目</dt><dd>' + escapeHtml(projectName(task.project)) + '</dd></div><div><dt>专家团</dt><dd>' + escapeHtml(teamName) + '</dd></div><div><dt>任务负责人</dt><dd>' + escapeHtml(personName(task.project, task.assignee)) + '</dd></div><div><dt>计划进度</dt><dd>' + completed + ' / ' + draftStages.length + '</dd></div></dl><div class="niu-progress"><span style="width:' + (draftStages.length ? completed / draftStages.length * 100 : 0) + '%"></span></div><p>工作类型决定每个阶段的职责。计划确认后再开始执行。</p>';
}

export function openNewIssuePlan(taskId) {
  const task = tkGetTasks().find(item => item.id === Number(taskId));
  if (!task) { toast('未找到任务', 'warning'); return; }
  currentTaskId = task.id;
  activePlanScope = 'existing';
  draftStages = (task.executionPlan || []).map(stage => ({ ...stage }));
  draftConfirmed = task.planStatus === 'confirmed';
  closeOverlays();
  byId('niuPlanOverlay').hidden = false;
  renderPlan();
}

function addStage() {
  if (planLocked()) { toast('任务已启动，执行计划已锁定', 'warning'); return; }
  const task = currentTask();
  if (!task?.project) { toast('请先选择所属项目', 'warning'); selectCreateTab('info'); byId('niuProjectTrigger').focus(); return; }
  const used = new Set(draftStages.map(stage => stage.workType));
  const next = planStageOptions(task.project).find(stage => !used.has(stage.name));
  if (!next) { toast('专家团的交付阶段已全部加入执行计划', 'warning'); return; }
  draftStages.push({ id: crypto.randomUUID(), workType: next.name, title: next.name, description: next.desc, assigneeId: defaultStageAssigneeId(CV_PROJECTS.find(project => project.id === task.project), tkPeopleInProject(task.project), CV_MEMBERS, next.name), status: 'pending' });
  draftConfirmed = false;
  renderPlan();
  const list = byId(activePlanScope === 'create' ? 'niuCreateStageList' : 'niuStageList');
  list.querySelector('.niu-stage:last-child select')?.focus();
}

function savePlan(confirm) {
  const task = currentTask();
  if (!task) return;
  if (planLocked()) { toast('任务已启动，执行计划已锁定', 'warning'); return; }
  if (confirm && (!draftStages.length || draftStages.some(stage => !stage.assigneeId))) { toast('请先为每个阶段指定确认人', 'warning'); return; }
  draftConfirmed = !!confirm;
  tkUpdateTask(task.id, { executionPlan: draftStages.map(stage => ({ ...stage })), planStatus: draftConfirmed ? 'confirmed' : 'draft' });
  renderPlan();
  renderTasks();
  toast(confirm ? '执行计划已确认' : '执行计划已保存', 'success');
}

export function initNewIssueUI(renderCallback, detailCallback) {
  renderTasks = renderCallback;
  refreshTaskDetail = detailCallback;
  byId('niuProjectTrigger').addEventListener('click', openProjectPopup);
  byId('niuProjectSearch').addEventListener('input', renderProjectOptions);
  byId('niuPersonSearch').addEventListener('input', renderPersonOptions);
  byId('niuCreateSubmit').addEventListener('click', createTask);
  byId('niuWizardNext').addEventListener('click', () => {
    if (validateTaskInfo()) { setWizardStep('plan'); byId('niuCreatePlanPane').focus({ preventScroll: true }); }
  });
  byId('niuWizardBack').addEventListener('click', () => { setWizardStep('info'); byId('niuInfoPane').focus({ preventScroll: true }); });
  byId('niuSmartCreate').addEventListener('click', () => setCreateMode('smart'));
  byId('niuSmartBackHead').addEventListener('click', () => setCreateMode('manual'));
  byId('niuSmartSubmit').addEventListener('click', submitSmartCreate);
  byId('niuSmartProject').addEventListener('change', event => selectProject(event.target.value));
  byId('niuSmartPrompt').addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submitSmartCreate(); }
  });
  byId('niuAddToggle').addEventListener('click', () => addStage());
  byId('niuCreateAdd').addEventListener('click', () => addStage());
  byId('niuPlanSave').addEventListener('click', () => savePlan(false));
  byId('niuPlanConfirm').addEventListener('click', () => savePlan(true));
  byId('tkFlowHelpClose').addEventListener('click', closeTaskFlowHelp);
  byId('tkFlowHelpFrame').addEventListener('load', sizeTaskFlowHelp);
  window.addEventListener('resize', sizeTaskFlowHelp);
  byId('tkFlowHelpOverlay').addEventListener('click', event => {
    if (event.target === byId('tkFlowHelpOverlay')) closeTaskFlowHelp();
  });
  document.addEventListener('input', event => {
    const input = event.target.closest('[data-niu-description]');
    if (!input || planLocked()) return;
    const stage = draftStages.find(item => item.id === input.dataset.niuDescription);
    if (stage) { stage.description = input.value; draftConfirmed = false; }
  });
  document.addEventListener('change', event => {
    if (event.target.closest('[data-niu-description]')) { renderPlan(); return; }
    const select = event.target.closest('[data-niu-work-type]');
    if (!select || planLocked()) return;
    const stage = draftStages.find(item => item.id === select.dataset.niuWorkType);
    if (!stage) return;
    if (select.value !== stage.workType && draftStages.some(item => item.id !== stage.id && item.workType === select.value)) {
      toast('「' + select.value + '」阶段已在执行计划中，请选择其他交付阶段', 'warning');
      renderPlan();
      return;
    }
    const stageOptions = planStageOptions(currentTask()?.project);
    const previousDefault = stageOptions.find(row => row.name === stage.workType)?.desc || '';
    const updateDescription = !stage.description || stage.description === previousDefault;
    stage.workType = select.value;
    stage.title = select.value;
    if (updateDescription) stage.description = stageOptions.find(row => row.name === select.value)?.desc || '';
    stage.assigneeId = defaultStageAssigneeId(CV_PROJECTS.find(project => project.id === currentTask()?.project), tkPeopleInProject(currentTask()?.project), CV_MEMBERS, select.value);
    draftConfirmed = false;
    renderPlan();
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-task-flow-help]')) { openTaskFlowHelp(); return; }
    const person = event.target.closest('[data-niu-person]');
    if (person && personPopupTarget) {
      if (planLocked()) { closePersonPopup(); return; }
      const stage = draftStages.find(item => item.id === personPopupStageId);
      if (stage) { stage.assigneeId = person.dataset.niuPerson; draftConfirmed = false; }
      closePersonPopup();
      renderPlan();
      return;
    }
    const owner = event.target.closest('[data-niu-owner-stage]');
    if (owner) { openPersonPopup('stage', owner.dataset.niuOwnerStage); return; }
    const remove = event.target.closest('[data-niu-remove]');
    if (remove) {
      if (planLocked()) return;
      draftStages = draftStages.filter(stage => stage.id !== remove.dataset.niuRemove);
      draftConfirmed = false;
      renderPlan();
      return;
    }
    if (event.target.closest('[data-niu-close]')) closeOverlays();
    const projectOption = event.target.closest('[data-niu-project]');
    if (projectOption) { selectProject(projectOption.dataset.niuProject); return; }
    const plan = event.target.closest('[data-niu-plan]');
    if (plan) openNewIssuePlan(plan.dataset.niuPlan);
    if (personPopupTarget && !event.target.closest('#niuPersonPopup')) closePersonPopup();
    if (!byId('niuProjectPopup').hidden && !event.target.closest('#niuProjectPopup, #niuProjectTrigger')) closeProjectPopup();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!byId('tkFlowHelpOverlay').hidden) closeTaskFlowHelp();
    else if (!byId('niuPersonPopup').hidden) closePersonPopup();
    else if (!byId('niuProjectPopup').hidden) closeProjectPopup();
    else if (!byId('niuCreateOverlay').hidden || !byId('niuPlanOverlay').hidden) closeOverlays();
  });
  [byId('niuCreateOverlay'), byId('niuPlanOverlay')].forEach(overlay => overlay.addEventListener('click', event => { if (event.target === overlay) closeOverlays(); }));
}
