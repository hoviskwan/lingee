import { $, $$ } from '../../core/dom.js';
import { toast } from '../../core/toast.js';
import { xesc } from '../expert/data.js';
import { forgetWorkspaceAudit, initConfigAudit, recordConfigAudit, renderAuditLog } from './audit-log.js';
import { CV_WORKSPACES, cvCanAccessWorkspace, cvCurrentUserName, cvDeleteWorkspaceData, cvPersistWorkspaces, cvWorkspace, cvWorkspaceById } from './data.js';
import { cvIsWorkspaceAdmin, cvRenderWorkspaceEntry, cvRenderWsMenu, cvSetWorkspace } from './projects.js';
import { cvSwitchView } from './view.js';
import { tkPruneOrphanTasks } from '../tasks-v2/data.js';

/* 设置：人员与第三方任务来源。单文件原型仅保存连接元数据，不保存应用密钥。 */
const INTEGRATION_KEY='lingee-collab-integrations-v1';
const PROVIDERS={devops:'DevOps',zentao:'禅道'};
let mappings=[];
function workspaceMappings(){return cvWorkspace?mappings.filter(row=>(row.workspace||'ws-build')===cvWorkspace):mappings;}

function renderWorkspaceSettings(){
  const workspace=cvWorkspaceById(cvWorkspace);
  if(!workspace)return;
  $('#cv-ws-settings-name').value=workspace.name;
  $('#cv-ws-settings-desc').value=workspace.desc||'';
  $('#cv-ws-settings-meta').textContent=workspace.creatorName?'创建者：'+workspace.creatorName:'预置工作区';
  const editable=cvIsWorkspaceAdmin();
  $('#cv-ws-settings-form').classList.toggle('hidden',!editable);
  const save=$('#cv-config .cv-ws-settings-heading button');
  if(save)save.classList.toggle('hidden',!editable);
  $('#cv-ws-danger')?.classList.toggle('hidden',!editable);
}

function openWorkspaceDelete(){
  const workspace=cvWorkspaceById(cvWorkspace),dialog=$('#cv-ws-delete-dialog');
  if(!workspace||!cvIsWorkspaceAdmin()||!dialog){toast('只有工作区创建者或管理员可以删除工作区','warning');return;}
  $('#cv-ws-delete-target').textContent=workspace.name;
  $('#cv-ws-delete-name').value='';
  $('#cv-ws-delete-confirm').disabled=true;
  dialog.showModal();
  $('#cv-ws-delete-name').focus();
}

function confirmWorkspaceDelete(){
  const workspace=cvWorkspaceById(cvWorkspace),dialog=$('#cv-ws-delete-dialog');
  if(!workspace||!cvIsWorkspaceAdmin()||!dialog?.open)return;
  if($('#cv-ws-delete-name').value!==workspace.name){toast('请输入完整的工作区名称以确认删除','warning');return;}
  const name=workspace.name,id=workspace.id;
  const result=cvDeleteWorkspaceData(id);
  if(!result.ok){toast('删除失败，工作区数据未变更；请检查浏览器存储','error');return;}
  tkPruneOrphanTasks(result.projectIds);
  mappings=mappings.filter(row=>(row.workspace||'ws-build')!==id);
  forgetWorkspaceAudit(id);
  dialog.close();
  const next=CV_WORKSPACES.find(row=>cvCanAccessWorkspace(row.id,cvCurrentUserName()));
  if(next)cvSetWorkspace(next.id);
  else{
    cvRenderWorkspaceEntry();cvRenderWsMenu();
    document.dispatchEvent(new CustomEvent('cv-workspace-change',{detail:{workspaceId:''}}));
    cvSwitchView('members');
  }
  toast('已删除工作区「'+name+'」','success');
}

function saveWorkspaceSettings(event){
  event.preventDefault();
  const workspace=cvWorkspaceById(cvWorkspace);
  if(!workspace||!cvIsWorkspaceAdmin()){toast('只有工作区创建者或管理员可以修改设置','warning');return;}
  const name=$('#cv-ws-settings-name').value.trim(),desc=$('#cv-ws-settings-desc').value.trim();
  if(!name){toast('请填写工作区名称','warning');return;}
  if(CV_WORKSPACES.some(row=>row.id!==workspace.id&&row.name===name)){toast('工作区名称已存在','warning');return;}
  if(workspace.name===name&&(workspace.desc||'')===desc)return;
  const previous={name:workspace.name,desc:workspace.desc};
  workspace.name=name;workspace.desc=desc;
  if(!cvPersistWorkspaces()){
    Object.assign(workspace,previous);
    toast('工作区设置保存失败，请检查浏览器存储空间','error');return;
  }
  $('#cvWsLabel').textContent=name;
  cvRenderWsMenu();
  recordConfigAudit('workspace','修改工作区「'+name+'」：'+[previous.name!==name?'名称':'',previous.desc!==desc?'描述':''].filter(Boolean).join('、'));
  toast('工作区设置已保存','success');
}

function restoreMappings(){
  try{
    const rows=JSON.parse(localStorage.getItem(INTEGRATION_KEY)||'[]');
    if(Array.isArray(rows)) mappings=rows.filter(row=>PROVIDERS[row.type] && row.url && row.externalProject);
  }catch(e){ mappings=[]; }
}
function saveMappings(rows){
  try{localStorage.setItem(INTEGRATION_KEY,JSON.stringify(rows));return true;}
  catch(e){toast('浏览器无法保存任务来源配置','error');return false;}
}
function renderMappings(){
  const list=$('#cv-integration-list');if(!list)return;
  const visible=workspaceMappings();
  list.innerHTML=visible.length?visible.map(row=>{
    return '<div class="cv-integration-row"><span class="cv-integration-mark">'+(row.type==='devops'?'D':'禅')+'</span><span class="cv-integration-row-main"><b>'+PROVIDERS[row.type]+' · '+xesc(row.externalProject)+'</b><small>'+xesc(row.url)+' · 应用 ID：'+xesc(row.appId||'待补充')+'</small></span><span class="cv-integration-status">待接入</span><button type="button" data-cv-integration-edit="'+xesc(row.id)+'">编辑配置</button><button type="button" data-cv-integration-remove="'+xesc(row.id)+'">移除</button></div>';
  }).join(''):'<div class="cv-integration-empty">还没有任务来源配置。选择上方系统开始配置。</div>';
}
function openMapping(type,id){
  const row=id?workspaceMappings().find(item=>item.id===id):null;
  if(!PROVIDERS[type])return;
  const form=$('#cv-integration-form');if(!form)return;
  $('#cv-integration-form-title').textContent=(row?'编辑':'配置')+PROVIDERS[type]+'任务来源';
  $('#cv-integration-id').value=row?.id||'';
  $('#cv-integration-type').value=type;
  $('#cv-integration-url').value=row?.url||'';
  $('#cv-integration-project').value=row?.externalProject||'';
  $('#cv-integration-app-id').value=row?.appId||'';
  $('#cv-integration-secret').value='';
  form.classList.remove('hidden');
  $('#cv-integration-url').focus();
}
function submitMapping(event){
  event.preventDefault();
  const type=$('#cv-integration-type').value;
  const externalProject=$('#cv-integration-project').value.trim();
  const appId=$('#cv-integration-app-id').value.trim();
  const secretInput=$('#cv-integration-secret');
  let parsed;
  try{parsed=new URL($('#cv-integration-url').value.trim());}catch(e){toast('请输入有效的系统地址','warning');return;}
  if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash){toast('系统地址只填写站点 URL，不要包含账号、令牌或参数','warning');return;}
  if(!PROVIDERS[type]||!externalProject||!appId||!secretInput.value.trim()){toast('请填写外部项目标识、应用 ID 和密钥','warning');return;}
  const url=parsed.origin+parsed.pathname.replace(/\/$/,'');
  const id=$('#cv-integration-id').value;
  const duplicate=workspaceMappings().find(row=>row.type===type&&row.url===url&&row.externalProject===externalProject&&row.id!==id);
  if(duplicate){toast('这个任务来源已配置，请编辑现有配置','warning');return;}
  const row={id:id||('mapping-'+Date.now()),workspace:cvWorkspace,type,url,externalProject,appId};
  const index=mappings.findIndex(item=>item.id===id&&(item.workspace||'ws-build')===cvWorkspace);
  const previous=index>=0?mappings[index]:null;
  const next=mappings.slice();
  if(index>=0)next[index]=row;else next.push(row);
  if(!saveMappings(next))return;
  mappings=next;
  if(previous){
    const changed=[];
    if(previous.url!==url)changed.push('系统地址');
    if(previous.externalProject!==externalProject)changed.push('外部项目标识');
    if(previous.appId!==appId)changed.push('应用 ID');
    recordConfigAudit('integration','修改 '+PROVIDERS[type]+' 任务来源「'+externalProject+'」'+(changed.length?'：'+changed.join('、'):'：重新保存配置'));
  }else recordConfigAudit('integration','新增 '+PROVIDERS[type]+' 任务来源「'+externalProject+'」');
  secretInput.value='';
  renderMappings();
  $('#cv-integration-form').classList.add('hidden');
  toast('任务来源已保存；密钥未留存，真实接入需服务端支持');
}

export function initCollabConfig(){
  restoreMappings();renderMappings();
  renderWorkspaceSettings();
  initConfigAudit();
  $('#cv-ws-settings-form')?.addEventListener('submit',saveWorkspaceSettings);
  $('#cv-ws-delete-open')?.addEventListener('click',openWorkspaceDelete);
  $('#cv-ws-delete-cancel')?.addEventListener('click',()=>$('#cv-ws-delete-dialog')?.close());
  $('#cv-ws-delete-name')?.addEventListener('input',()=>{
    const workspace=cvWorkspaceById(cvWorkspace);
    $('#cv-ws-delete-confirm').disabled=!workspace||$('#cv-ws-delete-name').value!==workspace.name;
  });
  $('#cv-ws-delete-confirm')?.addEventListener('click',confirmWorkspaceDelete);
  document.addEventListener('cv-workspace-change',()=>{
    $('#cv-integration-form')?.classList.add('hidden');
    $('#cv-integration-secret').value='';
    renderWorkspaceSettings();renderMappings();
  });
  const nav=$('#cv-config .config-nav');
  if(nav)nav.addEventListener('click',event=>{
    const item=event.target.closest('[data-config-nav]');if(!item)return;
    $$('#cv-config .config-nav-item').forEach(button=>button.classList.toggle('on',button===item));
    const which=item.getAttribute('data-config-nav');
    $$('#cv-config .config-pane').forEach(pane=>pane.classList.toggle('hidden',pane.getAttribute('data-config-pane')!==which));
    if(which==='perm'&&window.cvRenderPermTable)window.cvRenderPermTable();
    if(which==='workspace')renderWorkspaceSettings();
    if(which==='integration')renderMappings();
    if(which==='audit')renderAuditLog();
  });
  const panel=$('#cv-config');
  if(panel)panel.addEventListener('click',event=>{
    const provider=event.target.closest('[data-cv-integration-provider]');
    if(provider){openMapping(provider.getAttribute('data-cv-integration-provider'));return;}
    const edit=event.target.closest('[data-cv-integration-edit]');
    if(edit){const row=workspaceMappings().find(item=>item.id===edit.getAttribute('data-cv-integration-edit'));if(row)openMapping(row.type,row.id);return;}
    const remove=event.target.closest('[data-cv-integration-remove]');
    if(remove){
      const row=workspaceMappings().find(item=>item.id===remove.getAttribute('data-cv-integration-remove'));
      if(!row)return;
      const next=mappings.filter(item=>item.id!==row.id||(item.workspace||'ws-build')!==cvWorkspace);
      if(saveMappings(next)){
        mappings=next;
        recordConfigAudit('integration','移除 '+PROVIDERS[row.type]+' 任务来源「'+row.externalProject+'」');
        renderMappings();toast('已移除任务来源配置');
      }
      return;
    }
    if(event.target.closest('#cv-integration-cancel')){$('#cv-integration-secret').value='';$('#cv-integration-form').classList.add('hidden');}
  });
  const form=$('#cv-integration-form');if(form)form.addEventListener('submit',submitMapping);
}
