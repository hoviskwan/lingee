import { tkGetPerson, tkPeopleInProject } from './data.js';
import { taskExecutionStages } from './task-execution.js';

let confirmAction = null;
let previousFocus = null;

function closeTaskConfirm(confirmed) {
  const overlay = document.getElementById('tkConfirmOverlay');
  if (overlay.hidden) return;
  overlay.hidden = true;
  const action = confirmAction;
  confirmAction = null;
  if (previousFocus?.isConnected) previousFocus.focus();
  previousFocus = null;
  if (confirmed && action) action();
}

export function showTaskConfirm(message, action, title, confirmLabel, tone) {
  const overlay = document.getElementById('tkConfirmOverlay');
  previousFocus = document.activeElement;
  confirmAction = action;
  document.getElementById('tkConfirmTitle').textContent = title || '确认删除';
  document.getElementById('tkConfirmMessage').textContent = message;
  document.getElementById('tkConfirmOk').textContent = confirmLabel || '删除';
  overlay.dataset.tone = tone || 'danger';
  overlay.hidden = false;
  document.getElementById('tkConfirmCancel').focus();
}

export function showTaskStageConfirm(task, action) {
  const stages = taskExecutionStages(task);
  let index = stages.findIndex(stage => stage.id === task.executionStageId);
  if (index < 0 && task.executionPlan?.length) {
    index = stages.findIndex(stage => task.executionPlan.find(row => row.id === stage.id)?.status !== 'done');
  }
  if (index < 0) return;
  const next = stages[index + 1];
  const assigneeId = next && (task.flowAssignee || next.assigneeId || (!task.executionPlan?.length ? task.assignee : ''));
  const assigneeName = assigneeId ? tkPeopleInProject(task.project).find(person => person.id === assigneeId)?.name || tkGetPerson(assigneeId).name : '未指定';
  const message = next ? '通过后进入「' + next.name + '」，处理人：' + assigneeName + '。' : '通过后任务完成。';
  showTaskConfirm(message, action, '确认产物', '确认', 'primary');
}

export function initTaskConfirm() {
  const overlay = document.getElementById('tkConfirmOverlay');
  if (overlay.parentNode !== document.body) document.body.appendChild(overlay);
  document.getElementById('tkConfirmCancel').addEventListener('click', () => closeTaskConfirm(false));
  document.getElementById('tkConfirmOk').addEventListener('click', () => closeTaskConfirm(true));
  overlay.addEventListener('click', event => { if (event.target === overlay) closeTaskConfirm(false); });
  document.addEventListener('keydown', event => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeTaskConfirm(false); }
    if (event.key === 'Tab') {
      const cancel = document.getElementById('tkConfirmCancel');
      const ok = document.getElementById('tkConfirmOk');
      if (event.shiftKey && document.activeElement === cancel) { event.preventDefault(); ok.focus(); }
      else if (!event.shiftKey && document.activeElement === ok) { event.preventDefault(); cancel.focus(); }
    }
  });
}
