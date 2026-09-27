import { $ } from '../../core/dom.js';
import { toast } from '../../core/toast.js';
import { xesc } from '../expert/data.js';
import { cvWorkspace } from './data.js';

/* 单文件原型的本地配置审计；正式审计应由服务端按已认证用户写入。 */
const AUDIT_KEY='lingee-collab-config-audit-v1';
const CATEGORIES={workspace:'工作区',person:'人员',integration:'系统集成',project:'项目配置'};
const PROJECT_FIELDS={name:'名称',desc:'描述',goal:'目标',status:'状态',priority:'优先级',owner:'负责人',repo:'代码仓库',dot:'图标颜色',start:'开始时间',end:'结束时间',defaultTeam:'专家团'};
let entries=[];

function restoreAuditLog(){
  try{
    const rows=JSON.parse(localStorage.getItem(AUDIT_KEY)||'[]');
    entries=Array.isArray(rows)?rows.filter(row=>row&&CATEGORIES[row.category]&&typeof row.detail==='string'&&typeof row.at==='string'):[];
  }catch(e){entries=[];}
}

function recordConfigAudit(category,detail){
  if(!CATEGORIES[category]||!detail)return false;
  const entry={id:'audit-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),at:new Date().toISOString(),actor:($('#userName')?.textContent||'').trim()||'当前用户',workspace:cvWorkspace,category,detail};
  const next=[entry,...entries];
  try{localStorage.setItem(AUDIT_KEY,JSON.stringify(next));}
  catch(e){toast('配置已保存，但审计日志未能写入当前浏览器','warning');return false;}
  entries=next;
  renderAuditLog();
  return true;
}

function recordProjectConfigAudit(project,fields,previousName){
  const labels=fields.map(field=>PROJECT_FIELDS[field]).filter(Boolean);
  if(project&&labels.length)recordConfigAudit('project','修改项目「'+(previousName&&previousName!==project.name?previousName+' → '+project.name:project.name)+'」：'+labels.join('、'));
}
function forgetWorkspaceAudit(id){
  entries=entries.filter(row=>(row.workspace||'ws-build')!==id);
  renderAuditLog();
}

function filteredAuditLog(){
  const category=$('#cv-audit-category')?.value||'';
  const query=($('#cv-audit-search')?.value||'').trim().toLocaleLowerCase();
  return entries.filter(row=>(!cvWorkspace||(row.workspace||'ws-build')===cvWorkspace)&&(!category||row.category===category)&&(!query||[row.actor,row.detail,CATEGORIES[row.category]].join(' ').toLocaleLowerCase().includes(query)));
}

function auditTime(iso){
  const date=new Date(iso);
  if(Number.isNaN(date.getTime()))return '—';
  const pad=value=>String(value).padStart(2,'0');
  return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+' '+pad(date.getHours())+':'+pad(date.getMinutes());
}

function renderAuditLog(){
  const body=$('#cv-audit-rows'),count=$('#cv-audit-count');
  if(!body)return;
  const rows=filteredAuditLog();
  if(count)count.textContent=String(rows.length);
  body.innerHTML=rows.length?rows.map(row=>'<tr><td><time datetime="'+xesc(row.at)+'">'+xesc(auditTime(row.at))+'</time></td><td>'+xesc(row.actor||'当前用户')+'</td><td>'+CATEGORIES[row.category]+'</td><td>'+xesc(row.detail)+'</td></tr>').join('')
    :'<tr><td colspan="4" class="cv-audit-empty">'+(entries.some(row=>!cvWorkspace||(row.workspace||'ws-build')===cvWorkspace)?'没有匹配的配置记录':'暂无配置变更记录。')+'</td></tr>';
}

function csvCell(value){
  const safe=String(value??'').replace(/^[\s]*[=+\-@]/,"'$&");
  return '"'+safe.replace(/"/g,'""')+'"';
}

function exportAuditLog(){
  const rows=filteredAuditLog();
  if(!rows.length){toast('当前没有可导出的审计记录','warning');return;}
  const csv='\ufeff'+[['时间','操作人','类别','详情'],...rows.map(row=>[auditTime(row.at),row.actor,CATEGORIES[row.category],row.detail])].map(row=>row.map(csvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;link.download='lingee-config-audit-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),0);
}

function initConfigAudit(){
  restoreAuditLog();
  renderAuditLog();
  $('#cv-audit-category')?.addEventListener('change',renderAuditLog);
  $('#cv-audit-search')?.addEventListener('input',renderAuditLog);
  $('#cv-audit-export')?.addEventListener('click',exportAuditLog);
  document.addEventListener('cv-workspace-change',renderAuditLog);
}

export { forgetWorkspaceAudit, initConfigAudit, recordConfigAudit, recordProjectConfigAudit, renderAuditLog };
