import { $ } from '../../core/dom.js';
import { toast } from '../../core/toast.js';
import { CV_MEMBERS, CV_PROJECTS, CV_TASKS, CV_WORKSPACES, cvIsMe, cvPeopleInWorkspace, cvPersistProjects, cvPersistWorkspaces, cvPersonById, cvWorkspace, cvWorkspaceById, cvWorkspaceRole } from './data.js';
import { cvRenderProjectDetail, cvRenderProjectList } from './project-view.js';
import { xesc } from '../expert/data.js';
import { cvLinkLingeePerson, cvLinkedLingeePerson, cvLoginPeople, cvPeopleSearchIsDemo, cvSearchLingeePeople } from './people-search.js';
import { recordConfigAudit } from './audit-log.js';
/* 设置：关联灵基用户并维护协作角色；原型使用明确标记的演示搜索数据。 */

var cvSelectedPerson=null,cvSearchResults=[],cvSearchTimer=0,cvSearchSeq=0;
var PS_COLORS=['#7c5cfc','#4d89ff','#08a040','#ff8d42','#e04a3a','#c06010','#08cc50','#5b8def'];
function cvPsNum(pid){ return parseInt(String(pid).replace(/\D/g,''))||0; }
function cvPsColor(pid){ return PS_COLORS[cvPsNum(pid)%PS_COLORS.length]; }
function cvPersonAvHtml(p,cls){
  var color=cvIsMe(p)?'#08a040':cvPsColor(p.id);
  return '<span class="'+cls+'" style="background:'+color+'">'+xesc(p.name[0]||'?')+'</span>';
}

function cvRenderPeopleSearch(rows){
  var el=$('#cv-ps-results');if(!el)return;
  cvSearchResults=Array.isArray(rows)?rows.filter(function(person){return person&&person.id&&person.name;}):[];
  el.innerHTML=cvSearchResults.length?cvSearchResults.map(function(person,index){
    var linked=!!cvLinkedLingeePerson(person.id,person.name);
    return '<button type="button" role="option" data-cv-person-result="'+index+'"'+(linked?' disabled aria-disabled="true"':'')+'><span class="cv-person-result-avatar">'+xesc(person.name[0]||'?')+'</span><span class="cv-person-result-info"><strong>'+xesc(person.name)+'</strong><small>ID '+xesc(person.id)+' · '+xesc(person.phone||'无手机号')+' · '+xesc(person.email||'无邮箱')+'</small></span>'+(linked?'<em>已添加</em>':'')+'</button>';
  }).join(''):'<div class="cv-person-search-empty">没有匹配的灵基用户</div>';
}
function cvSearchPersonInput(){
  var query=($('#cv-ps-search')||{}).value?.trim()||'',el=$('#cv-ps-results');
  clearTimeout(cvSearchTimer);cvSearchSeq++;
  cvSelectedPerson=null;
  var selected=$('#cv-ps-selected');if(selected){selected.classList.add('hidden');selected.innerHTML='';}
  var add=$('#cv-ps-add');if(add)add.disabled=true;
  if(!query){cvSearchResults=[];if(el)el.innerHTML='<div class="cv-person-search-empty">输入姓名、手机号或邮箱开始搜索</div>';return;}
  var seq=cvSearchSeq;
  if(el)el.innerHTML='<div class="cv-person-search-empty">搜索中…</div>';
  cvSearchTimer=setTimeout(async function(){
    try{var rows=await cvSearchLingeePeople(query);if(seq===cvSearchSeq)cvRenderPeopleSearch(rows);}
    catch(error){if(seq===cvSearchSeq&&el)el.innerHTML='<div class="cv-person-search-empty">搜索失败，请稍后重试</div>';}
  },250);
}
function cvOpenPersonNew(){
  clearTimeout(cvSearchTimer);
  cvSelectedPerson=null;cvSearchResults=[];cvSearchSeq++;
  var note=$('#cv-ps-note');if(note)note.textContent=cvPeopleSearchIsDemo()?'可搜索当前原型的登录账号和演示人员；灵基人员接口待接入。':'从当前租户的灵基用户中搜索并添加。';
  var search=$('#cv-ps-search');if(search)search.value='';
  var results=$('#cv-ps-results');if(results)results.innerHTML='<div class="cv-person-search-empty">输入姓名、手机号或邮箱开始搜索</div>';
  var selected=$('#cv-ps-selected');if(selected){selected.classList.add('hidden');selected.innerHTML='';}
  var add=$('#cv-ps-add');if(add)add.disabled=true;
  var ov=$('#cv-personedit-overlay'); if(ov) ov.style.display='flex';
  search?.focus();
}
function cvClosePersonEdit(){
  clearTimeout(cvSearchTimer);cvSearchSeq++;
  var ov=$('#cv-personedit-overlay'); if(ov) ov.style.display='none';
}
function cvSavePersonEdit(){
  var person=cvSelectedPerson;
  if(!person){toast('请先选择灵基用户','warning');return;}
  if(cvLinkedLingeePerson(person.id,person.name)){toast('该用户已添加','warning');return;}
  if(!cvLinkLingeePerson(person)){toast('无法保存工作区人员关联','error');return;}
  recordConfigAudit('person','添加协作人员「'+person.name+'」');
  cvClosePersonEdit();
  cvRenderProjectDetail();cvRenderProjectList();cvRenderPermTable();
  toast('已添加协作人员：'+person.name);
}

function cvDeletePerson(pid){
  var p=cvPersonById(pid); if(!p) return;
  if(cvIsMe(p)){ toast('不能移除自己','warning'); return; }
  var workspace=cvWorkspaceById(cvWorkspace)||CV_WORKSPACES.find(function(w){return (w.peopleIds||[]).includes(pid);});
  if(!workspace?.peopleIds?.includes(pid))return;
  var inScope=function(project){return !cvWorkspace||project.workspace===cvWorkspace;};
  if(cvWorkspaceRole(p)==='system_admin'&&cvPeopleInWorkspace().filter(function(row){return cvWorkspaceRole(row)==='system_admin';}).length<=1){toast('需保留至少一名管理员','warning');return;}
  if(CV_PROJECTS.some(function(project){return inScope(project)&&project.owner===p.name;})){toast('该人员仍是项目负责人，请先移交项目','warning');return;}
  if(CV_TASKS.some(function(task){return task.kind!=='epic'&&CV_PROJECTS.some(function(project){return project.id===task.project&&inScope(project);})&&!['已完成','已取消'].includes(task.status)&&(task.assignee===p.name||(task.stagePlan||[]).some(function(stage){return stage.assignee===p.name;}));})){toast('该人员有待处理任务，请先完成或转交','warning');return;}
  if(CV_PROJECTS.some(function(project){return inScope(project)&&(project.members||[]).length===1&&project.members[0]===pid;})){
    toast('该人员是某项目的唯一成员，请先为项目添加其他成员','warning');return;
  }
  if(!window.confirm('确定移除「'+p.name+'」的协作关联吗？此操作不会删除灵基账号。'))return;
  var affected=CV_PROJECTS.filter(function(project){return inScope(project)&&project.members?.includes(pid);});
  var previousMembers=affected.map(function(project){return project.members.slice();});
  var previousPeople=workspace.peopleIds.slice();
  var previousRoles={...workspace.roles};
  affected.forEach(function(pr){pr.members=pr.members.filter(function(id){return id!==pid;});});
  workspace.peopleIds=workspace.peopleIds.filter(function(id){return id!==pid;});
  if(workspace.roles)delete workspace.roles[pid];
  if(!cvPersistProjects()||!cvPersistWorkspaces()){
    affected.forEach(function(project,index){project.members=previousMembers[index];});
    workspace.peopleIds=previousPeople;workspace.roles=previousRoles;
    cvPersistProjects();cvPersistWorkspaces();
    toast('移除失败，工作区关联未变更','error');return;
  }
  recordConfigAudit('person','移除协作人员「'+p.name+'」');
  cvRenderProjectDetail(); cvRenderProjectList(); cvRenderPermTable();
  toast('已移除协作关联：'+p.name,'info');
}

function cvSetWorkspaceRole(pid,role){
  var person=cvPersonById(pid);
  var workspace=cvWorkspaceById(cvWorkspace)||CV_WORKSPACES.find(function(w){return (w.peopleIds||[]).includes(pid);});
  if(!person||!workspace?.peopleIds?.includes(pid)||!['member','system_admin'].includes(role))return;
  var previousRole=cvWorkspaceRole(person);
  if(previousRole===role)return;
  if(previousRole==='system_admin'&&role!=='system_admin'&&cvPeopleInWorkspace().filter(function(row){return cvWorkspaceRole(row)==='system_admin';}).length<=1){toast('需保留至少一名管理员','warning');cvRenderPermTable();return;}
  workspace.roles=workspace.roles||{};
  workspace.roles[pid]=role;
  if(!cvPersistWorkspaces()){workspace.roles[pid]=previousRole;toast('工作区角色保存失败','error');cvRenderPermTable();return;}
  cvRenderPermTable();cvRenderProjectList();
  var labels={member:'成员',system_admin:'管理员'};
  recordConfigAudit('person','修改「'+person.name+'」的工作区角色：'+(labels[previousRole]||'成员')+' → '+labels[role]);
  toast('已设置 '+person.name+' 的工作区角色');
}

/* ---------- 协作人员映射与角色 ---------- */
function cvRenderPermTable(){
  var el=$('#cv-perm-table'); if(!el) return;
  var people=cvPeopleInWorkspace();
  var cnt=$('#cv-perm-count'); if(cnt) cnt.textContent=people.length;
  var accounts=$('#cv-login-people');
  if(accounts)accounts.innerHTML='<div class="cfg-table">'
    +'<div class="cfg-table-head cv-login-head"><span>人员</span><span>登录账号</span><span>工作区</span></div>'
    +cvLoginPeople().map(function(person,index){
      var linked=!!cvLinkedLingeePerson(person.id,person.name);
      return '<div class="cfg-table-row cv-login-row"><span class="cfg-t-name">'+cvPersonAvHtml(person,'ps-av')+'<b>'+xesc(person.name)+'</b></span>'
        +'<span class="cv-perm-meta">'+xesc(person.account)+'</span><span>'+(linked?'<span class="cv-login-linked">已加入</span>':'<button type="button" class="act-btn" data-ps-login-add="'+index+'">加入工作区</button>')+'</span></div>';
    }).join('')+'</div>';
  el.innerHTML='<div class="cfg-table">'
    +'<div class="cfg-table-head cv-perm-head"><span>人员</span><span>手机号</span><span>邮箱</span><span>工作区角色</span><span>操作</span></div>'
    +people.map(function(p){
      return '<div class="cfg-table-row cv-perm-row">'
        +'<span class="cfg-t-name">'+cvPersonAvHtml(p,'ps-av')+'<span class="cv-proj-desc-wrap"><b>'+xesc(p.name)+(cvIsMe(p)?'<span class="ps-me">我</span>':'')+'</b><em class="cv-proj-desc">ID '+xesc(p.userId||p.id)+'</em></span></span>'
        +'<span class="cv-perm-meta">'+xesc(p.phone||'—')+'</span><span class="cv-perm-meta">'+xesc(p.email||'—')+'</span>'
        +'<span><select class="cv-perm-role" data-ps-workspace-role="'+xesc(p.id)+'" aria-label="'+xesc(p.name)+'的工作区角色">'+[['member','成员'],['system_admin','管理员']].map(function(option){return '<option value="'+option[0]+'"'+(cvWorkspaceRole(p)===option[0]?' selected':'')+'>'+option[1]+'</option>';}).join('')+'</select></span>'
        +'<span class="cv-perm-acts">'
        +(cvIsMe(p)?'':'<button type="button" class="act-btn act-btn--danger" data-ps-del="'+xesc(p.id)+'">移除</button>')+'</span>'
        +'</div>';
    }).join('')
    +'</div>';
}

export function initCollabPersons(){
  var search=$('#cv-ps-search'),results=$('#cv-ps-results');
  if(search)search.addEventListener('input',cvSearchPersonInput);
  if(results)results.addEventListener('click',function(e){
    var option=e.target.closest('[data-cv-person-result]');if(!option||option.disabled)return;
    var person=cvSearchResults[Number(option.getAttribute('data-cv-person-result'))];if(!person)return;
    cvSelectedPerson=person;
    var selected=$('#cv-ps-selected');if(selected){selected.innerHTML='<strong>已选择：'+xesc(person.name)+'</strong><span>ID '+xesc(person.id)+' · '+xesc(person.phone||'无手机号')+' · '+xesc(person.email||'无邮箱')+'</span>';selected.classList.remove('hidden');}
    var add=$('#cv-ps-add');if(add)add.disabled=false;
    results.querySelectorAll('[data-cv-person-result]').forEach(function(row){row.setAttribute('aria-selected',String(row===option));});
  });
  var permTable=$('#cv-perm-table');
  $('#cv-login-people')?.addEventListener('click',function(e){
    var add=e.target.closest('[data-ps-login-add]');if(!add)return;
    var person=cvLoginPeople()[Number(add.getAttribute('data-ps-login-add'))];if(!person)return;
    if(!cvLinkLingeePerson(person)){toast('无法保存工作区人员关联','error');return;}
    recordConfigAudit('person','添加协作人员「'+person.name+'」');
    cvRenderPermTable();cvRenderProjectDetail();cvRenderProjectList();
    toast('已添加协作人员：'+person.name);
  });
  if(permTable) permTable.addEventListener('click',function(e){
    var del=e.target.closest('[data-ps-del]');
    if(del){ cvDeletePerson(del.getAttribute('data-ps-del')); return; }
  });
  if(permTable)permTable.addEventListener('change',function(e){var role=e.target.closest('[data-ps-workspace-role]');if(role)cvSetWorkspaceRole(role.getAttribute('data-ps-workspace-role'),role.value);});
}

export { cvClosePersonEdit, cvDeletePerson, cvOpenPersonNew, cvRenderPermTable, cvSavePersonEdit };
