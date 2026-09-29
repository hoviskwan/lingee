import { $, $$ } from '../../core/dom.js';
import { renderListPageTabs } from '../shared/list-page-tabs.js';
import { toast } from '../../core/toast.js';
import { CV_MEMBERS, CV_PROJECTS, CV_TASKS, cvCurrentUserName, cvDeleteProjectRecord, cvPeopleInProject, cvPersistProjects, cvProject, cvProjectById, cvProjectInWorkspace } from './data.js';
import { getLoginPersonId } from '../login.js';
import { xesc } from '../expert/data.js';
import { tbSave } from './tb-core.js';
import { renderTaskBoard, tbOpenTask, tbShowBoard } from './task-board.js';
import { cvMayEditProject, cvRenderProjMenu, cvRenderProjectSettings, cvSetProject, cvUpdateCounts } from './projects.js';
import { cvSwitchView } from './view.js';
import { openTaskDetail, tkOpenProjectTaskCreate, tkSetProjectListMode } from '../tasks-v2/index.js';
import { tkCanViewTask, tkGetPerson, tkGetTaskArtifacts, tkGetTasks } from '../tasks-v2/data.js';
import { createDeliveryActivity } from './delivery-activity.js';
import { renderArtifactPreview } from './run-artifacts.js';
import { TEAMS } from '../expert/store.js';
import { cvProjectFolderIcon, cvProjectIconColor, cvProjectIconOptions } from './project-icons.js';
import { cvEnsureProjectPerson, cvSearchLingeePeople } from './people-search.js';
import { recordProjectConfigAudit } from './audit-log.js';
/* 项目列表与详情；详情展示项目资料和成员，成员管理保留在弹窗。 */

var cvProjCur='';           /* 项目详情正在看的项目 id，空 = 项目列表 */
var cvProjectDetailTab='overview';
var cvArtifactPreviewTrigger=null;
var cvProjectTaskReturnId='';
var cvProjectTaskReturnTab='overview';
var cvProjectListView='cards';
var cvProjectScope='all';
var cvProjectFilters=[],cvActiveProjectFilter='status';
var cvModuleView='table', cvModuleFilter='all';
var cvMembersPageOpen=false;
var cvMemberPickerSelected=new Set(),cvMemberPickerProject='',cvMemberPickerPopup=null;
var cvMemberSearchRows=new Map(),cvMemberSearchSeq=0,cvMemberSearchTimer=0;
var cvPendingMemberRemoval=null;
var cvProjectDetailDraft=null,cvDetailIconColor='blue',cvDetailOwnerSelected=null,cvDetailOwnerRows=[],cvDetailOwnerSearchSeq=0,cvDetailOwnerSearchTimer=0;
function cvCanManageProject(project){
  return cvMayEditProject(project);
}
var PJ_STATUS={planned:{c:'#6b7280',bg:'#f3f4f6',t:'规划中'},in_progress:{c:'#ff8d42',bg:'#fff4ed',t:'执行中'},paused:{c:'#6b7280',bg:'#f3f4f6',t:'已暂停'},completed:{c:'#4d89ff',bg:'#eef3ff',t:'已完成'},cancelled:{c:'#e04a3a',bg:'#fdeae8',t:'已取消'}};
var PJ_CARD_ICONS={
  team:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 1.5v3M13 1.5v3M7 15.5v3M13 15.5v3M1.5 7h3M1.5 13h3M15.5 7h3M15.5 13h3M7 7h6v6H7z"/></svg>'
};
var PJ_FILTER_FIELDS=[
  ['status','状态','<circle cx="12" cy="12" r="9"/>'],
  ['priority','优先级','<path d="M4 19v-4m5 4V9m5 10V5m5 14V2"/>'],
  ['owner','负责人','<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'],
  ['progress','任务进度','<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9"/>'],
];
var CV_PROJ_DOT_COLORS={blue:'#4d89ff',orange:'#ff8d42',green:'#08cc50'};
function cvProjectProgress(project){
  var tasks=tkGetTasks().filter(function(task){return task.project===project.id&&task.kind!=='epic';});
  if(!tasks.length)return 'none';
  var done=tasks.filter(function(task){return task.status==='done';}).length;
  return done===0?'zero':done===tasks.length?'done':'partial';
}
function cvProjectFieldValue(project,field){
  if(field==='status')return project.status||'planned';
  if(field==='priority')return project.priority||'中';
  if(field==='owner')return project.owner||'';
  if(field==='progress')return cvProjectProgress(project);
  return '';
}
/* 当前登录人可见的项目：本人负责或为项目成员；项目列表与筛选统计共用 */
function cvMyProjects(){
  var currentPerson=CV_MEMBERS.find(function(person){return person.id===getLoginPersonId()&&person.status!=='disabled';});
  return currentPerson?CV_PROJECTS.filter(function(p){return cvProjectInWorkspace(p.id)&&(p.owner===currentPerson.name||(p.members||[]).includes(currentPerson.id));}):[];
}
function cvProjectFilterChoices(field){
  var query=(($('#cvProjectSearch')||{}).value||'').trim().toLocaleLowerCase();
  var currentName=cvCurrentUserName();
  var projects=cvMyProjects().filter(function(project){return (cvProjectScope==='all'||(cvProjectScope==='owned'&&project.owner===currentName)||(cvProjectScope==='joined'&&project.owner!==currentName))
    &&(!query||[project.name,project.desc||''].join(' ').toLocaleLowerCase().includes(query));});
  var pairs=field==='status'?Object.keys(PJ_STATUS).map(function(id){return [id,PJ_STATUS[id].t];})
    :field==='priority'?['高','中','低'].map(function(value){return [value,value];})
    :field==='owner'?Array.from(new Set(projects.map(function(project){return project.owner||'';}).filter(Boolean))).sort().map(function(value){return [value,value];})
    :[['none','无任务'],['zero','0%'],['partial','1%–99%'],['done','100%']];
  return pairs.map(function(pair){return {value:pair[0],label:pair[1],count:projects.filter(function(project){return cvProjectFieldValue(project,field)===pair[0];}).length};}).filter(function(choice){return choice.count>0;});
}
/* 兼容旧版 p.features：首次读取时迁移为 ProjectTask(kind=epic)，
   之后 Epic / Task / Subtask 统一存放在 CV_TASKS，并用 parentTaskId 建树。 */
function cvProjectEpics(p){
  var changed=false;
  (p.features||[]).forEach(function(f){
    var epicId=f.projectTaskId||('epic-'+f.id);
    var epic=CV_TASKS.find(function(t){return t.boardId===epicId;});
    if(!epic){
      epic={boardId:epicId,kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-'+String(epicId).slice(-6).toUpperCase(),status:'待规划',title:f.title,desc:f.desc||'',acceptance:f.acceptance||'',files:(f.files||[]).slice(),assignee:p.owner||'待分配',priority:p.priority||'中',project:p.id,progress:0,artifacts:[],activity:[]};
      CV_TASKS.push(epic); changed=true;
    }
    f.projectTaskId=epicId;
    (f.taskIds||[]).forEach(function(tid){ var child=CV_TASKS.find(function(t){return t.boardId===tid;}); if(child&&!child.parentTaskId){child.parentTaskId=epicId; child.kind=child.kind||'task'; changed=true;} });
  });
  if((p.features||[]).length){ delete p.features; changed=true; }
  if(changed){ tbSave(); cvPersistProjects(); }
  return CV_TASKS.filter(function(t){return t.project===p.id&&t.kind==='epic';});
}

/* ---------- 项目列表 ---------- */
function cvRenderProjectList(){
  var el=$('#cv-proj-list'); if(!el) return;
  el.classList.toggle('is-list',cvProjectListView==='list');
  cvRenderProjectFilters();
  var currentName=cvCurrentUserName();
  var list=cvMyProjects();
  var query=(($('#cvProjectSearch')||{}).value||'').trim().toLocaleLowerCase();
  var filters=cvProjectFilters;
  var visible=list.filter(function(p){return (cvProjectScope==='all'||(cvProjectScope==='owned'&&p.owner===currentName)||(cvProjectScope==='joined'&&p.owner!==currentName))
    &&(!query||[p.name,p.desc||''].join(' ').toLocaleLowerCase().includes(query))
    &&PJ_FILTER_FIELDS.every(function(field){var selected=filters.filter(function(item){return item.field===field[0];});return !selected.length||selected.some(function(item){return cvProjectFieldValue(p,field[0])===item.value;});});}).sort(function(a,b){return (b.updatedAt||0)-(a.updatedAt||0);});
  var switcher=$('#cv-project-view-switch');
  var scopeTabs=$('#cv-project-tabs');if(scopeTabs)scopeTabs.innerHTML=renderListPageTabs([{id:'all',name:'全部'},{id:'owned',name:'我负责'},{id:'joined',name:'我参与'}],cvProjectScope,'data-pj-scope');
  if(switcher) switcher.innerHTML='<button type="button" data-pj-view="cards" class="'+(cvProjectListView==='cards'?'on':'')+'" aria-pressed="'+(cvProjectListView==='cards'?'true':'false')+'">卡片</button><button type="button" data-pj-view="list" class="'+(cvProjectListView==='list'?'on':'')+'" aria-pressed="'+(cvProjectListView==='list'?'true':'false')+'">列表</button>';
  var chips=$('#cvProjectFilterChips'),filterLabel=$('#cvProjectFilterLabel'),filterBtn=$('#cvProjectFilterBtn');
  if(filterLabel)filterLabel.textContent=filters.length?filters.length+' 个筛选':'筛选';
  if(filterBtn)filterBtn.classList.toggle('has-filters',filters.length>0);
  if(chips){chips.classList.toggle('hidden',!filters.length);chips.innerHTML=filters.map(function(item,index){var field=PJ_FILTER_FIELDS.find(function(entry){return entry[0]===item.field;});var option=cvProjectFilterChoices(item.field).find(function(choice){return choice.value===item.value;});return '<span class="tk-chip"><span class="tk-chip-field">'+xesc(field?field[1]:item.field)+'</span><span class="tk-chip-val">'+xesc(option?option.label:item.value)+'</span><button type="button" class="tk-chip-remove" data-pj-clear="'+index+'" aria-label="移除'+xesc(option?option.label:item.value)+'筛选">×</button></span>';}).join('')+(filters.length>1?'<button type="button" class="tk-chip-clear-all" data-pj-clear="all">清除全部</button>':'');}
  if(!visible.length){ el.innerHTML='<div class="x-empty">'+(list.length?'没有匹配的项目':'还没有项目，点右上「新建」')+'</div>'; return; }
  if(cvProjectListView==='list'){
    el.innerHTML='<div class="pj-projects-list"><div class="pj-list-head"><span>项目</span><span>状态</span><span>优先级</span><span>项目成员</span><span>负责人</span><span>开始时间</span><span>结束时间</span><span>任务进度</span></div>'
      +visible.map(function(p){
        var members=cvPeopleInProject(p);
        var tasks=tkGetTasks().filter(function(t){return t.project===p.id&&t.kind!=='epic';});
        var done=tasks.filter(function(t){return t.status==='done';}).length;
        var progress=tasks.length?Math.round(done/tasks.length*100):0;
        var sc=PJ_STATUS[p.status||'planned']||PJ_STATUS.planned;
        return '<div class="pj-list-row" data-pj-row="'+xesc(p.id)+'">'
          +'<button type="button" class="pj-list-name" data-pj-open="'+xesc(p.id)+'" aria-label="查看项目：'+xesc(p.name)+'">'+cvProjectFolderIcon(p.dot)+'<span><b class="card-title">'+xesc(p.name)+'</b><small>'+xesc(p.desc||'暂无描述')+'</small></span></button>'
          +'<span class="pj-status" style="color:'+sc.c+';background:'+sc.bg+'">'+sc.t+'</span>'
          +'<span>'+xesc(p.priority||'中')+'</span>'
          +'<span class="pj-list-members" title="'+xesc(members.length?members.map(function(m){return m.name;}).join('、'):'暂无成员')+'"><span class="pj-list-member-avatars">'+members.slice(0,3).map(function(m){return '<span class="pj-list-member-avatar" aria-hidden="true">'+xesc(m.name[0]||'?')+'</span>';}).join('')+'</span><span class="pj-list-member-count">'+members.length+' 人</span></span>'
          +'<span>'+xesc(p.owner||'未设置')+'</span>'
          +'<span>'+xesc(p.start||'—')+'</span>'
          +'<span>'+xesc(p.end||'—')+'</span>'
          +'<span class="pj-list-progress" aria-label="任务进度 '+done+' / '+tasks.length+'"><span class="pj-list-progress-track"><i style="width:'+progress+'%"></i></span><small>'+done+' / '+tasks.length+'</small></span></div>';
      }).join('')+'</div>';
    return;
  }
  el.innerHTML='<div class="pj-projects-cards">'+visible.map(function(p){
    var members=cvPeopleInProject(p);
    var tasks=tkGetTasks().filter(function(t){return t.project===p.id&&t.kind!=='epic';});
    var done=tasks.filter(function(t){return t.status==='done';}).length;
    var progress=tasks.length?Math.round(done/tasks.length*100):0;
    var sc=PJ_STATUS[p.status||'planned']||PJ_STATUS.planned;
    var statusKey=PJ_STATUS[p.status]?p.status:'planned';
    var teamName=TEAMS.find(function(team){return team.id===p.defaultTeam;})?.name||'未设置专家团';
    var memberNames=members.map(function(member){return member.name;}).join('、')||'暂无成员';
    var avatars=members.slice(0,3).map(function(member,index){return '<span class="pj-card-avatar pj-card-avatar--'+index+'" aria-hidden="true">'+xesc((member.name||'?').slice(0,1))+'</span>';}).join('');
    if(members.length>3)avatars+='<span class="pj-card-avatar pj-card-avatar--more" aria-hidden="true">+'+(members.length-3)+'</span>';
    return '<div class="pj-card" data-pj-row="'+xesc(p.id)+'" data-pj-open="'+xesc(p.id)+'" role="button" tabindex="0" aria-label="查看项目：'+xesc(p.name)+'">'
      +'<div class="pj-card-main"><div class="pj-card-head"><div class="pj-card-identity">'+cvProjectFolderIcon(p.dot)+'<span class="pj-card-title" title="'+xesc(p.name)+'">'+xesc(p.name)+'</span></div>'
      +'<span class="pj-card-status pj-card-status--'+statusKey+'"><i aria-hidden="true"></i>'+sc.t+'</span></div>'
      +'<p class="pj-card-desc" title="'+xesc(p.desc||'暂无描述')+'">'+xesc(p.desc||'暂无描述')+'</p>'
      +'<div class="pj-card-fields"><span>负责人 <b title="'+xesc(p.owner||'未设置')+'">'+xesc(p.owner||'未设置')+'</b></span><span>优先级 <b>'+xesc(p.priority||'中')+'</b></span></div>'
      +'<div class="pj-card-progress" role="progressbar" aria-label="任务进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+progress+'"><span>任务进度</span><span class="pj-card-progress-track"><i style="width:'+progress+'%"></i></span><b>'+done+' / '+tasks.length+'</b></div>'
      +'<div class="pj-card-bottom"><div class="pj-card-meta"><span class="pj-card-team" title="'+xesc(teamName)+'">'+PJ_CARD_ICONS.team+'<b>'+xesc(teamName)+'</b></span></div><div class="pj-card-avatars" aria-label="项目成员：'+xesc(memberNames)+'">'+avatars+'</div></div></div>'
      +'</div>';
  }).join('')+'</div>';
}

function cvRenderProjectFilters(){
  var fields=$('#cvProjectFilterFields'),options=$('#cvProjectFilterOptions');
  if(!fields||!options)return;
  fields.innerHTML=PJ_FILTER_FIELDS.map(function(field){
    var count=cvProjectFilters.filter(function(item){return item.field===field[0];}).length;
    return '<button type="button" class="pj-filter-category'+(field[0]===cvActiveProjectFilter?' active':'')+'" data-pj-filter-field="'+field[0]+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+field[2]+'</svg><span>'+field[1]+'</span>'+(count?'<span class="pj-filter-count">'+count+'</span>':'')+'<svg class="pj-filter-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 4 8 8-8 8"/></svg></button>';
  }).join('')+(cvProjectFilters.length?'<button type="button" class="pj-filter-reset" id="cvProjectFilterReset">重置全部筛选</button>':'');
  var choices=cvProjectFilterChoices(cvActiveProjectFilter);
  options.innerHTML=choices.map(function(choice){var selected=cvProjectFilters.some(function(item){return item.field===cvActiveProjectFilter&&item.value===choice.value;});return '<button type="button" class="pj-filter-option" data-pj-filter-value="'+xesc(choice.value)+'" aria-pressed="'+selected+'"><span class="pj-filter-check">'+(selected?'✓':'')+'</span><span>'+xesc(choice.label)+'</span><span class="pj-filter-option-count">'+choice.count+' 个项目</span></button>';}).join('')||'<div class="pj-filter-empty">暂无可选值</div>';
  options.classList.remove('hidden');
}

/* ---------- 项目详情：基本信息 + 成员 ---------- */
function cvCaptureProjectDetailDraft(){
  var form=$('#pj-project-form');
  if(!form||form.dataset.projectId!==cvProjCur)return;
  var values={};
  form.querySelectorAll('[data-pj-field]').forEach(function(field){values[field.dataset.pjField]=field.value;});
  cvProjectDetailDraft={projectId:cvProjCur,values:values,dot:cvDetailIconColor,ownerSelected:cvDetailOwnerSelected};
}
function cvProjectDetailField(label,field,value,display,editable,wide){
  var id='pj-detail-'+field;
  var html='<div class="pj-info-field'+(wide?' pj-info-field--wide':'')+'">';
  html+=editable&&field!=='dot'?'<label for="'+id+'">'+label+(['name','owner','defaultTeam','repo','desc'].includes(field)?' <span class="pj-required-mark" aria-hidden="true">*</span>':'')+'</label>':'<span>'+label+'</span>';
  if(!editable||field==='code')return html+(field==='dot'?'<b>'+cvProjectFolderIcon(value)+'</b>':'<b>'+xesc(display||value||'—')+'</b>')+'</div>';
  if(field==='dot')return html+'<div class="pj-detail-icon-options" role="group" aria-label="项目图标">'+cvProjectIconOptions(value,'data-pj-detail-icon')+'</div></div>';
  if(field==='status')html+='<select id="'+id+'" data-pj-field="status">'+Object.keys(PJ_STATUS).map(function(key){return '<option value="'+key+'"'+(key===value?' selected':'')+'>'+PJ_STATUS[key].t+'</option>';}).join('')+'</select>';
  else if(field==='priority')html+='<select id="'+id+'" data-pj-field="priority">'+['高','中','低'].map(function(item){return '<option'+(item===value?' selected':'')+'>'+item+'</option>';}).join('')+'</select>';
  else if(field==='defaultTeam')html+='<select id="'+id+'" data-pj-field="defaultTeam" required><option value="">请选择专家团</option>'+TEAMS.map(function(team){return '<option value="'+xesc(team.id)+'"'+(team.id===value?' selected':'')+'>'+xesc(team.name)+'</option>';}).join('')+'</select>';
  else if(field==='owner')html+='<input id="'+id+'" data-pj-field="owner" type="search" value="'+xesc(value)+'" autocomplete="off" placeholder="搜索项目负责人" aria-controls="pj-detail-owner-results" aria-expanded="false" required><div id="pj-detail-owner-results" class="pj-detail-owner-results hidden"></div>';
  else if(field==='desc')html+='<textarea id="'+id+'" data-pj-field="'+field+'" rows="2" required>'+xesc(value)+'</textarea>';
  else html+='<input id="'+id+'" data-pj-field="'+field+'" type="'+(['start','end'].includes(field)?'date':field==='repo'?'url':'text')+'" value="'+xesc(value)+'"'+(['name','repo'].includes(field)?' required':'')+'>';
  return html+'</div>';
}
function cvProjectArtifactRows(projectId){
  return tkGetTasks().filter(function(task){return task.project===projectId&&tkCanViewTask(task);}).flatMap(function(task){
    var project=cvProjectById(projectId);
    var activity=createDeliveryActivity(task,project,{creator:tkGetPerson(task.createdBy).name,assigneeName:tkGetPerson(task.assignee).name,blockedReason:task.blockedRun?.reason});
    var delivered=new Set(activity.filter(function(entry){return entry.expertId&&(entry.state==='done'||entry.state==='review');}).map(function(entry){return entry.stageId;}));
    return tkGetTaskArtifacts(task).filter(function(artifact){return delivered.has(artifact.stageId);}).map(function(artifact){return {task:task,artifact:artifact,demo:!(task.executionArtifacts||[]).includes(artifact)};});
  }).sort(function(a,b){return String(b.artifact.date||'').localeCompare(String(a.artifact.date||''));});
}
function cvProjectArtifactContent(artifact){
  if(typeof artifact.content==='string'&&!artifact.content.trim())return '';
  return renderArtifactPreview(artifact);
}
function cvProjectArtifactFormat(artifact){
  if(!cvProjectArtifactContent(artifact))return '—';
  return typeof artifact.content==='string'?'TXT':'HTML';
}
function cvProjectArtifactFileIcon(format){
  var label=format==='—'?'FILE':format;
  return '<svg class="pj-artifacts-file-icon" viewBox="0 0 30 34" aria-hidden="true" focusable="false"><path d="M6 2.5h12l6 6V31H6a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M18 2.5V9h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><text x="14" y="27" fill="currentColor" font-size="8" font-family="Arial,sans-serif" font-weight="700" text-anchor="middle">'+label+'</text></svg>';
}
function cvRenderProjectArtifacts(projectId){
  var rows=cvProjectArtifactRows(projectId);
  var types=[...new Set(rows.map(function(row){return cvProjectArtifactFormat(row.artifact);}))];
  return '<section class="pj-artifacts-list-pane"><div class="pj-artifacts-heading"><div><h2>项目产物 <small>'+rows.length+' 项</small></h2></div>'
    +(rows.length?'<div class="pj-artifacts-tools"><select data-pj-artifact-type aria-label="按产物类型筛选"><option value="">全部类型</option>'+types.map(function(type){return '<option value="'+xesc(type)+'">'+xesc(type)+'</option>';}).join('')+'</select></div>':'')+'</div>'
    +(rows.length?'<div class="pj-artifacts-table"><div class="pj-artifacts-head"><span>成果</span><span>类型</span><span>生成日期</span><span>操作</span></div>'
      +rows.map(function(row,index){var a=row.artifact,t=row.task,name=a.name||t.title+' · '+(a.type||'产物'),type=cvProjectArtifactFormat(a),downloadable=!!cvProjectArtifactContent(a);return '<div class="pj-artifacts-row" data-pj-artifact-row data-pj-artifact-row-type="'+xesc(type)+'">'
        +'<div class="pj-artifacts-name">'+cvProjectArtifactFileIcon(type)+'<a href="#pj-artifact-preview" data-pj-artifact-preview="'+index+'" title="'+xesc(name)+'" aria-label="预览'+xesc(name)+'">'+xesc(name)+'</a></div>'
        +'<span class="pj-artifacts-type">'+xesc(type)+'</span><time>'+xesc(a.date||'—')+'</time><button type="button" class="pj-artifacts-download-btn" data-pj-artifact-download="'+index+'" aria-label="下载'+xesc(name)+'" title="'+(downloadable?'下载':'暂无可下载内容')+'"'+(downloadable?'':' disabled')+'>下载 ↓</button></div>';}).join('')+'<div class="pj-artifacts-filter-empty" hidden>没有符合条件的产物</div></div>'
      :'<div class="pj-artifacts-empty">本项目还没有已产生的任务产物。任务提交产物后会显示在这里。</div>')
    +'</section><aside id="pj-artifact-preview" class="pj-artifact-preview" data-pj-preview-pane aria-label="产物预览" tabindex="-1" hidden></aside>';
}
function cvFilterProjectArtifacts(){
  var panel=$('#cv-proj-detail'),type=panel?.querySelector('[data-pj-artifact-type]')?.value||'',visible=0;
  panel?.querySelectorAll('[data-pj-artifact-row]').forEach(function(row){var show=!type||row.dataset.pjArtifactRowType===type;row.hidden=!show;if(show)visible++;});
  var empty=panel?.querySelector('.pj-artifacts-filter-empty');if(empty)empty.hidden=visible>0;
}
function cvPreviewProjectArtifact(index,trigger){
  var row=cvProjectArtifactRows(cvProjCur)[index];
  if(!row||!tkCanViewTask(row.task))return;
  var a=row.artifact,t=row.task,name=a.name||t.title+' · '+(a.type||'产物'),pane=$('#cv-proj-detail [data-pj-preview-pane]');
  if(!pane)return;
  var content=cvProjectArtifactContent(a);
  var expanded=pane.classList.contains('is-fullscreen');
  pane.innerHTML='<div class="pj-artifact-preview-head"><div class="pj-artifact-preview-title"><h2>'+xesc(name)+'</h2><p>来源任务：'+xesc(t.title||'未命名任务')+' · '+xesc(cvProjectArtifactFormat(a))+' · '+xesc(a.version||'当前版本')+' · '+xesc(a.date||'日期未记录')+(row.demo?' · 演示产物':'')+'</p></div><div class="pj-artifact-preview-actions"><button type="button" data-pj-preview-download aria-label="下载产物" title="'+(content?'下载产物':'暂无可下载内容')+'"'+(content?'':' disabled')+'>下载 ↓</button><button type="button" data-pj-preview-fullscreen aria-label="'+(expanded?'退出全屏':'全屏预览')+'" aria-pressed="'+expanded+'" title="'+(expanded?'退出全屏':'全屏预览')+'">'+(expanded?'退出全屏':'全屏 ⛶')+'</button><button type="button" data-pj-preview-close aria-label="关闭预览" title="关闭预览">×</button></div></div>'
    +'<div class="pj-artifact-preview-body">'+(content||'<p>该产物目前只有名称，暂无可预览的内容。</p>')+'</div>';
  pane.dataset.artifactIndex=String(index);
  pane.hidden=false;
  pane.closest('.pj-detail-main').classList.add('has-preview');
  cvArtifactPreviewTrigger=trigger;
  pane.focus();
}
function cvCloseProjectArtifactPreview(){
  var pane=$('#cv-proj-detail [data-pj-preview-pane]');
  if(!pane)return;
  pane.hidden=true;pane.classList.remove('is-fullscreen');pane.innerHTML='';
  pane.closest('.pj-detail-main').classList.remove('has-preview','has-fullscreen');
  if(cvArtifactPreviewTrigger?.isConnected)cvArtifactPreviewTrigger.focus();
  cvArtifactPreviewTrigger=null;
}
function cvDownloadProjectArtifact(index){
  var row=cvProjectArtifactRows(cvProjCur)[index];
  if(!row||!tkCanViewTask(row.task))return;
  var a=row.artifact,content=cvProjectArtifactContent(a);
  if(!content)return;
  var name=a.name||row.task.title+' · '+(a.type||'产物'),plain=typeof a.content==='string';
  var base=name.replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').trim()||'项目产物';
  var body=plain?a.content:'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>'+xesc(name)+'</title><style>body{max-width:900px;margin:40px auto;padding:0 24px;font:14px/1.7 sans-serif;color:#222}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}pre{overflow:auto;padding:12px;background:#f5f5f7}h1{font-size:22px}</style></head><body><h1>'+xesc(name)+'</h1>'+content+'</body></html>';
  var url=URL.createObjectURL(new Blob([body],{type:plain?'text/plain;charset=utf-8':'text/html;charset=utf-8'}));
  var link=document.createElement('a');link.href=url;link.download=base+(plain?'.txt':'.html');document.body.appendChild(link);link.click();link.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},1000);
}
function cvRenderProjectDetail(resetDraft){
  cvCloseMemberPicker();
  clearTimeout(cvDetailOwnerSearchTimer);cvDetailOwnerSearchSeq++;
  if(resetDraft)cvProjectDetailDraft=null;
  else cvCaptureProjectDetailDraft();
  var el=$('#cv-proj-detail'); if(!el) return;
  var p=cvProjectById(cvProjCur);
  if(!p){cvResetProjectListState();return;}
  var editable=cvMayEditProject(p),draft=cvProjectDetailDraft?.projectId===p.id?cvProjectDetailDraft:null;
  var values=Object.assign({name:p.name||'',status:p.status||'planned',priority:p.priority||'中',owner:p.owner||'',defaultTeam:p.defaultTeam||'',start:p.start||'',end:p.end||'',repo:p.repo||'',desc:p.desc||''},draft?.values||{});
  cvDetailIconColor=draft?.dot||cvProjectIconColor(p.dot);
  cvDetailOwnerSelected=draft?.ownerSelected||null;
  var members=cvPeopleInProject(p);
  el.innerHTML='<div class="pj-crumb">'
    +'<button type="button" class="pj-back" data-pj-back>项目</button>'
    +'<span class="pj-crumb-sep">›</span>'
    +cvProjectFolderIcon(p.dot)
    +'<span class="pj-crumb-name">'+xesc(p.name)+'</span>'
    +'<span class="pj-crumb-sep">›</span><span class="pj-crumb-current">'+(cvProjectDetailTab==='artifacts'?'项目产物':'项目概览')+'</span>'
    +(editable&&cvProjectDetailTab==='overview'?'<button type="button" class="pj-detail-delete" data-pj-delete>删除项目</button>':'')
    +'</div>'
    +'<div class="pj-detail-tabs" role="tablist" aria-label="项目详情"><button type="button" role="tab" data-pj-detail-tab="overview" aria-selected="'+(cvProjectDetailTab==='overview')+'">概览</button><button type="button" role="tab" data-pj-detail-tab="artifacts" aria-selected="'+(cvProjectDetailTab==='artifacts')+'">产物</button></div>'
    +'<div class="pj-detail-main'+(cvProjectDetailTab==='artifacts'?' pj-detail-main--artifacts':'')+'">'
    +(cvProjectDetailTab==='artifacts'?cvRenderProjectArtifacts(p.id):'' )
    +(cvProjectDetailTab==='overview'?
    '<div class="pj-info-section"><div class="pj-info-section-head"><h2>基本信息</h2>'+(editable?'<button type="submit" form="pj-project-form" class="pj-detail-save">保存</button>':'')+'</div>'
    +(editable?'<form id="pj-project-form" class="pj-info-grid" data-project-id="'+xesc(p.id)+'">':'<div class="pj-info-grid">')
    +cvProjectDetailField('项目名称','name',values.name,values.name,editable,false)
    +cvProjectDetailField('项目编码','code',p.code||'—',p.code||'—',false,false)
    +cvProjectDetailField('项目图标','dot',cvDetailIconColor,cvProjectFolderIcon(p.dot),editable,false)
    +cvProjectDetailField('状态','status',values.status,(PJ_STATUS[p.status||'planned']||PJ_STATUS.planned).t,editable,false)
    +cvProjectDetailField('优先级','priority',values.priority,p.priority||'中',editable,false)
    +cvProjectDetailField('负责人','owner',values.owner,p.owner||'未设置',editable,false)
    +cvProjectDetailField('专家团','defaultTeam',values.defaultTeam,TEAMS.find(function(team){return team.id===p.defaultTeam;})?.name||'未设置',editable,false)
    +cvProjectDetailField('开始时间','start',values.start,p.start||'—',editable,false)
    +cvProjectDetailField('结束时间','end',values.end,p.end||'—',editable,false)
    +cvProjectDetailField('代码仓库','repo',values.repo,p.repo||'未设置',editable,true)
    +cvProjectDetailField('项目描述','desc',values.desc,p.desc||'暂无',editable,true)
    +(editable?'</form>':'</div>')+'</div>'
    +'<div class="pj-info-section pj-info-section--members"><div class="pj-info-section-head"><h2>成员信息 <small>'+members.length+' 人</small></h2>'+(cvCanManageProject(p)?'<button type="button" class="pj-members-open" data-pj-members-open aria-controls="cv-project-members-overlay">＋ 添加</button>':'')+'</div>'
    +'<div class="pj-detail-members'+(cvCanManageProject(p)?' pj-detail-members--manage':'')+'">'+(members.length?members.map(function(person){var isOwner=person.name===p.owner;return '<div class="pj-detail-member"><span class="pj-member-avatar">'+xesc(person.name[0]||'?')+'</span><b>'+xesc(person.name)+'</b><span class="pj-detail-member-dept">'+xesc(person.dept||'未填写部门')+'</span>'+cvProjectMemberRoleHtml(p,person)+(cvCanManageProject(p)?(isOwner?'<span></span>':'<button type="button" class="pj-detail-member-remove" data-pj-member-remove="'+xesc(person.id)+'" aria-label="移除成员 '+xesc(person.name)+'">移除</button>'):'')+'</div>';}).join(''):'<div class="pj-members-empty">暂无项目成员</div>')+'</div></div>'
    :'')
    +'</div>';
  cvRenderProjectMembersModal();
}
function cvPositionDetailOwnerResults(){
  var input=$('#pj-detail-owner'),results=$('#pj-detail-owner-results');
  if(!input||!results||results.classList.contains('hidden'))return;
  var rect=input.getBoundingClientRect(),below=window.innerHeight-rect.bottom-12,above=rect.top-12;
  var openAbove=below<220&&above>below;
  results.style.left=rect.left+'px';results.style.width=rect.width+'px';
  results.style.maxHeight=Math.max(80,Math.min(220,openAbove?above:below))+'px';
  results.style.top=openAbove?'auto':rect.bottom+5+'px';
  results.style.bottom=openAbove?window.innerHeight-rect.top+5+'px':'auto';
}
function cvSearchDetailOwner(query){
  clearTimeout(cvDetailOwnerSearchTimer);
  var seq=++cvDetailOwnerSearchSeq,results=$('#pj-detail-owner-results'),input=$('#pj-detail-owner');
  cvDetailOwnerSelected=null;
  if(!results||!input)return;
  if(!query){results.classList.add('hidden');input.setAttribute('aria-expanded','false');return;}
  results.classList.remove('hidden');input.setAttribute('aria-expanded','true');results.textContent='搜索中…';
  cvPositionDetailOwnerResults();
  cvDetailOwnerSearchTimer=setTimeout(async function(){
    try{
      var rows=await cvSearchLingeePeople(query);
      if(seq!==cvDetailOwnerSearchSeq||!$('#pj-detail-owner-results'))return;
      cvDetailOwnerRows=rows;
      results.innerHTML=rows.length?rows.map(function(person,index){return '<button type="button" data-pj-detail-owner="'+index+'"><b>'+xesc(person.name)+'</b><small>'+xesc(person.dept||person.email||person.phone||'')+'</small></button>';}).join(''):'<div class="pj-detail-owner-empty">没有匹配的人员</div>';
    }catch(error){if(seq===cvDetailOwnerSearchSeq)results.textContent='搜索失败，请稍后重试';}
  },250);
}
function cvSaveProjectDetail(){
  var form=$('#pj-project-form'),project=cvProjectById(cvProjCur);
  if(!form||!project)return;
  if(!cvMayEditProject(project)){toast('只有项目负责人可以保存项目','warning');cvRenderProjectDetail(true);return;}
  if(!form.reportValidity())return;
  var get=function(field){return form.querySelector('[data-pj-field="'+field+'"]')?.value.trim()||'';};
  var name=get('name'),ownerName=get('owner'),teamId=get('defaultTeam'),repo=get('repo'),desc=get('desc');
  if(!name){toast('请填写项目名称','warning');$('#pj-detail-name')?.focus();return;}
  if(!repo){toast('请填写代码仓库','warning');$('#pj-detail-repo')?.focus();return;}
  if(!desc){toast('请填写项目描述','warning');$('#pj-detail-desc')?.focus();return;}
  if(!TEAMS.some(function(team){return team.id===teamId;})){toast('请选择专家团','warning');$('#pj-detail-defaultTeam')?.focus();return;}
  if(get('start')&&get('end')&&get('end')<get('start')){toast('结束时间不能早于开始时间','warning');$('#pj-detail-end')?.focus();return;}
  var ownerChanged=ownerName!==project.owner,ownerPerson=null;
  if(ownerChanged){
    if(!cvDetailOwnerSelected||cvDetailOwnerSelected.name!==ownerName){toast('请搜索并选择项目负责人','warning');$('#pj-detail-owner')?.focus();return;}
    if(!window.confirm('确定将「'+project.name+'」的负责人由「'+(project.owner||'未设置')+'」变更为「'+ownerName+'」吗？'))return;
    ownerPerson=cvEnsureProjectPerson(cvDetailOwnerSelected);
    if(!ownerPerson||ownerPerson.status==='disabled'){toast('无法保存项目负责人','error');return;}
  }
  var fields=['name','status','priority','owner','defaultTeam','start','end','repo','desc','dot'];
  var before=Object.fromEntries(fields.map(function(field){return [field,project[field]||''];}));
  var previousMembers=(project.members||[]).slice();
  project.name=name;project.status=get('status');project.priority=get('priority');project.owner=ownerName;project.defaultTeam=teamId;
  project.start=get('start');project.end=get('end');project.repo=repo;project.desc=desc;project.dot=cvDetailIconColor;project.updatedAt=Date.now();
  if(ownerPerson)project.members=Array.from(new Set(previousMembers.concat(ownerPerson.id)));
  if(!cvPersistProjects()){
    fields.forEach(function(field){project[field]=before[field];});project.members=previousMembers;
    toast('保存失败，请重试','error');return;
  }
  recordProjectConfigAudit(project,fields.filter(function(field){return String(before[field])!==String(project[field]||'');}),before.name);
  cvRenderProjMenu();cvRenderProjectSettings();cvRenderProjectList();cvRenderProjectDetail(true);
  toast('项目已保存');
}
function cvDeleteCurrentProject(){
  var project=cvProjectById(cvProjCur);
  if(!project)return;
  if(!cvMayEditProject(project)){toast('只有项目负责人可以删除项目','warning');return;}
  if(tkGetTasks().some(function(task){return task.project===project.id;})
    || CV_TASKS.some(function(task){return task.project===project.id;})){
    toast('项目下还有任务，不能删除（含已完成任务）','warning');return;
  }
  if(!window.confirm('确定删除项目「'+project.name+'」吗？此操作无法撤销。'))return;
  if(!cvMayEditProject(project)
    || tkGetTasks().some(function(task){return task.project===project.id;})
    || CV_TASKS.some(function(task){return task.project===project.id;})){
    toast('项目权限或任务已变化，请重新检查','warning');return;
  }
  if(!cvDeleteProjectRecord(project.id)){toast('删除失败，请重试','error');return;}
  if(cvProjectTaskReturnId===project.id)cvProjectTaskReturnId='';
  if(cvProject===project.id)cvSetProject('');
  cvResetProjectListState();cvRenderProjMenu();cvRenderProjectSettings();
  toast('项目已删除','success');
}
/* ---------- 项目规划：智能拆解 ----------
   project 模式规划项目任务；epic 模式把单个任务拆成可执行子任务。 */
var cvSplitItems=[];
var cvSplitMode='project';   /* 'project' | 'epic' */
var cvSplitEpicId='';
function cvSplitCandidates(p){
  var base=p.desc||p.name;
  return [
    {title:'核心业务',desc:'围绕「'+base+'」的核心业务场景、单据与主流程'},
    {title:'审批与流程',desc:'审批链、条件流转与异常节点处理'},
    {title:'查询与报表',desc:'列表查询、条件筛选与统计报表'},
    {title:'系统集成',desc:'与外部系统的接口对接与数据同步'},
    {title:'权限与安全',desc:'角色分级、数据权限与操作审计'}
  ];
}
function cvEpicSplitCandidates(f){
  var base=f.title;
  return [
    {title:base+' · 需求确认与设计',desc:'明确「'+base+'」的具体交互、数据结构与依赖，输出可执行的实现方案',acceptance:'关键页面与接口设计通过评审'},
    {title:base+' · 功能实现',desc:f.desc||('实现「'+base+'」的核心功能'),acceptance:'功能按方案跑通，主流程无阻断缺陷'},
    {title:base+' · 联调与验收',desc:'完成「'+base+'」与关联模块的联调，并对照验收标准自测',acceptance:'验收标准逐条通过，具备交付条件'}
  ];
}
function cvSplitHeadEls(){
  return {agent:document.getElementById('cv-split-agent'),confirm:document.getElementById('cv-split-confirm-btn')};
}
function cvOpenProjectSplit(){
  var p=cvProjectById(cvProjCur); if(!p) return;
  cvSplitMode='project'; cvSplitEpicId='';
  cvSplitItems=cvSplitCandidates(p);
  var head=cvSplitHeadEls();
  if(head.agent) head.agent.textContent='产品经理 · 任务规划';
  if(head.confirm) head.confirm.textContent='确认生成任务';
  var body=document.getElementById('cv-split-body'); if(!body) return;
  body.innerHTML='<div class="split-msg split-msg--user">基于项目目标「'+xesc(p.goal||p.name)+'」规划任务</div>'
    +'<div class="split-msg split-msg--agent" id="cv-split-agent-msg"><div class="split-thinking"><i></i><i></i><i></i></div><span class="split-thinking-t">正在思考…</span></div>';
  var ov=document.getElementById('cv-splittask-overlay'); if(ov) ov.style.display='flex';
  setTimeout(cvRenderSplitResult, 900);
}
function cvOpenEpicSplit(fid){
  var f=cvCurFeature(fid); if(!f) return;
  cvSplitMode='epic'; cvSplitEpicId=fid;
  cvSplitItems=cvEpicSplitCandidates(f);
  var head=cvSplitHeadEls();
  if(head.agent) head.agent.textContent='产品经理 · 任务拆解';
  if(head.confirm) head.confirm.textContent='确认生成任务';
  var body=document.getElementById('cv-split-body'); if(!body) return;
  body.innerHTML='<div class="split-msg split-msg--user">基于任务「'+xesc(f.title)+'」拆解可执行任务</div>'
    +'<div class="split-msg split-msg--agent" id="cv-split-agent-msg"><div class="split-thinking"><i></i><i></i><i></i></div><span class="split-thinking-t">正在思考…</span></div>';
  var ov=document.getElementById('cv-splittask-overlay'); if(ov) ov.style.display='flex';
  setTimeout(cvRenderSplitResult, 900);
}
function cvRenderSplitResult(){
  var msg=document.getElementById('cv-split-agent-msg'); if(!msg) return;
  var noun=cvSplitMode==='epic'?'子任务':'任务';
  msg.innerHTML='<div class="split-agent-t">已拆解出 '+cvSplitItems.length+' 个'+noun+'，请逐项确认（不需要的取消勾选）：</div>'
    +'<div class="split-list">'+cvSplitItems.map(function(t,i){
      return '<label class="split-item"><input type="checkbox" checked data-split-idx="'+i+'">'
        +'<span class="split-item-body"><span class="split-item-title">'+xesc(t.title)+'</span><span class="split-item-desc">'+xesc(t.desc)+'</span></span></label>';
    }).join('')+'</div>';
  cvUpdateSplitCount();
}
function cvUpdateSplitCount(){
  var n=document.querySelectorAll('#cv-split-body input[data-split-idx]:checked').length;
  var c=document.getElementById('cv-split-count'); if(c) c.textContent=n;
}
function cvCloseProjectSplit(){ var ov=document.getElementById('cv-splittask-overlay'); if(ov) ov.style.display='none'; }
function cvConfirmProjectSplit(){
  var p=cvProjectById(cvProjCur); if(!p) return;
  var checked=document.querySelectorAll('#cv-split-body input[data-split-idx]:checked');
  var noun=cvSplitMode==='epic'?'子任务':'任务';
  if(!checked.length){ toast('请至少确认一个'+noun,'warning'); return; }
  var n=0;
  if(cvSplitMode==='epic'){
    var f=cvCurFeature(cvSplitEpicId);
    if(!f){ cvCloseProjectSplit(); return; }
    checked.forEach(function(cb){
      var t=cvSplitItems[+cb.getAttribute('data-split-idx')]; if(!t) return;
      var boardId=crypto.randomUUID();
      CV_TASKS.unshift({boardId:boardId,kind:'task',parentTaskId:f.boardId,type:'需求',size:'小',source:'智能拆解',sourceId:'TASK-'+Date.now().toString().slice(-6)+'-'+(n+1),exec:'专家团',status:'待办',collab:'人Agent协作',mode:'多人协作',priority:p.priority||'中',title:t.title,desc:t.desc,acceptance:t.acceptance||'',assignee:'待分配',progress:0,project:p.id,files:[],artifacts:[],activity:[{author:'系统',text:'由任务「'+f.title+'」智能拆解生成子任务'}],tags:[]});
      n++;
    });
  }else{
    checked.forEach(function(cb){
      var t=cvSplitItems[+cb.getAttribute('data-split-idx')]; if(!t) return;
      var id='epic-'+Date.now().toString(36)+'-'+n;
      CV_TASKS.push({boardId:id,kind:'epic',parentTaskId:null,type:'特性',source:'智能规划',sourceId:'FEAT-'+Date.now().toString().slice(-6)+'-'+(n+1),status:'待规划',title:t.title,desc:t.desc,files:[],assignee:p.owner||'待分配',priority:p.priority||'中',project:p.id,progress:0,artifacts:[],activity:[{author:'系统',text:'由项目目标智能规划生成任务'}]});
      n++;
    });
  }
  tbSave();
  cvCloseProjectSplit();
  cvRenderProjectDetail();
  if(cvSplitMode==='epic'){ renderTaskBoard(); cvUpdateCounts(); }
  toast('已生成 '+n+' 个'+noun,'success');
}

/* ---------- ProjectTask 树展示 + 操作 ---------- */
function cvTaskRowHtml(t){
  var sc={'待规划':'pending','待办':'pending','进行中':'running','审核中':'review','已完成':'done','已阻塞':'fail','已取消':'fail'}[t.status]||'pending';
  return '<button type="button" class="pj-task" data-pj-task="'+xesc(t.boardId)+'" title="查看任务详情">'
    +'<span class="badge-status badge-status--'+sc+'"><span class="badge-status-dot"></span>'+(t.status==='待办'?'待开始':t.status)+'</span>'
    +'<span class="pj-task-title">'+xesc(t.title)+'</span>'
    +'<span class="pj-task-meta">'+xesc(t.type)+' · '+xesc(t.sourceId)+'</span>'
    +'</button>';
}
var cvCollapsedEpics={};
function cvModuleTasksCollapsed(id){
  return cvCollapsedEpics[id]===undefined?true:cvCollapsedEpics[id];
}
function cvModuleTasksHtml(f){
  var children=CV_TASKS.filter(function(t){return t.parentTaskId===f.boardId&&t.kind!=='epic';});
  if(cvModuleTasksCollapsed(f.boardId)) return '';
  return '<div class="pj-module-children">'+(children.length?children.map(cvTaskRowHtml).join(''):'<div class="pj-module-children-empty">该任务下暂无子任务</div>')+'</div>';
}
function cvModuleMetrics(f){
  var children=CV_TASKS.filter(function(t){return t.parentTaskId===f.boardId&&t.kind!=='epic';});
  var done=children.filter(function(t){return t.status==='已完成';}).length;
  var active=children.some(function(t){return ['进行中','审核中','已阻塞'].includes(t.status);});
  return {total:children.length,done:done,progress:children.length?Math.round(done/children.length*100):0,state:children.length&&done===children.length?'done':done||active?'doing':'todo'};
}
function cvRenderModuleResults(epics){
  var el=document.getElementById('pj-module-results'); if(!el) return;
  var list=epics.filter(function(f){
    return cvModuleFilter==='all'||cvModuleMetrics(f).state===cvModuleFilter;
  });
  var ungrouped=CV_TASKS.filter(function(t){return t.project===cvProjCur&&t.kind!=='epic'&&!t.parentTaskId;});
  var ungroupedHtml=cvModuleFilter==='all'&&ungrouped.length
    ?'<section class="pj-ungrouped"><div class="pj-ungrouped-head"><strong>未关联任务</strong><span>'+ungrouped.length+' 个任务</span></div><div class="pj-ungrouped-list">'+ungrouped.map(cvTaskRowHtml).join('')+'</div></section>'
    :'';
  if(!list.length){el.innerHTML='<div class="pj-module-empty">'+(epics.length?'没有符合进度筛选的任务。':'还没有任务，可按需创建。')+'</div>'+ungroupedHtml;return;}
  if(cvModuleView==='list'){el.innerHTML=cvFeaturesHtml(list)+ungroupedHtml;return;}
  el.innerHTML='<div class="pj-module-table" role="table" aria-label="任务列表"><div class="pj-module-tr pj-module-th" role="row"><span role="columnheader">任务</span><span role="columnheader">子任务</span><span role="columnheader">进度</span><span role="columnheader">操作</span></div>'
    +list.map(function(f){var m=cvModuleMetrics(f);var id=xesc(f.boardId);return '<div class="pj-module-tr" role="row"><div class="pj-module-name" role="cell"><button type="button" class="pj-module-open" data-ft-tasks-toggle="'+id+'" aria-expanded="'+!cvModuleTasksCollapsed(f.boardId)+'" aria-label="查看'+xesc(f.title)+'下的子任务"><b>'+xesc(f.title)+'</b><small>'+xesc(f.desc||'暂无描述')+'</small></button></div><span role="cell"><button type="button" class="pj-module-count" data-ft-tasks-toggle="'+id+'" aria-expanded="'+!cvModuleTasksCollapsed(f.boardId)+'">'+m.total+' 个子任务 · '+m.done+' 已完成 '+(cvModuleTasksCollapsed(f.boardId)?'▸':'▾')+'</button></span><span class="pj-module-progress" role="cell"><i><em style="width:'+m.progress+'%"></em></i>'+m.progress+'%</span><span class="pj-module-actions" role="cell"><button type="button" data-ft-split="'+id+'" title="智能拆解">✧</button><button type="button" data-ft-push="'+id+'" title="新增任务">＋</button><button type="button" data-ft-edit="'+id+'" title="编辑任务">✎</button><button type="button" data-ft-del="'+id+'" title="删除任务">×</button></span></div>'+cvModuleTasksHtml(f);}).join('')+'</div>'+ungroupedHtml;
}
function cvFeaturesHtml(epics){
  if(!epics||!epics.length) return '';
  return '<div class="ft-list">'+epics.map(function(f){
    var children=CV_TASKS.filter(function(t){return t.parentTaskId===f.boardId;});
    var doneCnt=children.filter(function(t){return t.status==='已完成';}).length;
    var prog=children.length?Math.round(doneCnt/children.length*100):0;
    return '<div class="ft-item ft-item--row">'
      +'<div class="ft-item-main"><button type="button" class="ft-item-open" data-ft-tasks-toggle="'+xesc(f.boardId)+'" aria-expanded="'+!cvModuleTasksCollapsed(f.boardId)+'" aria-label="查看'+xesc(f.title)+'下的子任务"><b>'+xesc(f.title)+'</b>'
      +(f.desc?'<small>'+xesc(f.desc)+'</small>':'')+'</button>'
      +'<button type="button" class="ft-item-meta ft-item-task-toggle" data-ft-tasks-toggle="'+xesc(f.boardId)+'" aria-expanded="'+!cvModuleTasksCollapsed(f.boardId)+'">'+children.length+' 个子任务 · '+doneCnt+' 已完成 · '+prog+'% '+(cvModuleTasksCollapsed(f.boardId)?'▸':'▾')+'</button></div>'
      +'<div class="ft-item-acts">'
      +'<button type="button" class="ft-act ft-act--split" data-ft-split="'+f.boardId+'" title="智能拆解"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/></svg></button>'
      +'<button type="button" class="ft-act ft-act--push" data-ft-push="'+f.boardId+'" title="新增任务"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'
      +'<button type="button" class="ft-act" data-ft-edit="'+f.boardId+'" title="编辑"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>'
      +'<button type="button" class="ft-act ft-act--del" data-ft-del="'+f.boardId+'" title="删除"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
      +'</div>'+cvModuleTasksHtml(f)
      +'</div>';
  }).join('')+'</div>';
}
function cvCurFeature(fid){
  return CV_TASKS.find(function(t){return t.boardId===fid&&t.project===cvProjCur&&t.kind==='epic';})||null;
}

/* ---------- 人工规划：每次创建一个 Epic ---------- */
function cvOpenManualSplit(){
  var p=cvProjectById(cvProjCur); if(!p) return;
  document.getElementById('cv-ms-title').value='';
  document.getElementById('cv-ms-desc').value='';
  var ov=document.getElementById('cv-manualsplit-overlay'); if(ov) ov.style.display='flex';
}
function cvCloseManualSplit(){ var ov=document.getElementById('cv-manualsplit-overlay'); if(ov) ov.style.display='none'; }
function cvConfirmManualSplit(){
  var p=cvProjectById(cvProjCur); if(!p) return;
  var title=(document.getElementById('cv-ms-title').value||'').trim();
  if(!title){ toast('请填写任务名称','warning'); return; }
  CV_TASKS.push({boardId:'epic-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5),kind:'epic',parentTaskId:null,type:'特性',source:'人工规划',sourceId:'FEAT-'+Date.now().toString().slice(-6),status:'待规划',title:title,desc:(document.getElementById('cv-ms-desc').value||'').trim(),files:[],assignee:p.owner||'待分配',priority:p.priority||'中',project:p.id,progress:0,artifacts:[],activity:[{author:'当前用户',text:'手动创建任务'}]});
  tbSave();
  cvCloseManualSplit();
  cvModuleFilter='all';
  cvRenderProjectDetail();
  toast('已创建任务：'+title,'success');
}

/* ---------- 任务编辑 / 删除 / 创建任务 ---------- */
var cvFeatureEditId='';
function cvOpenFeatureEdit(fid){
  var f=cvCurFeature(fid); if(!f) return;
  cvFeatureEditId=fid;
  document.getElementById('cv-fe-title').value=f.title||'';
  document.getElementById('cv-fe-desc').value=f.desc||'';
  var ov=document.getElementById('cv-featureedit-overlay'); if(ov) ov.style.display='flex';
}
function cvCloseFeatureEdit(){ var ov=document.getElementById('cv-featureedit-overlay'); if(ov) ov.style.display='none'; }
function cvSaveFeatureEdit(){
  var f=cvCurFeature(cvFeatureEditId); if(!f) return;
  var title=(document.getElementById('cv-fe-title').value||'').trim();
  if(!title){ toast('请填写任务名称','warning'); return; }
  f.title=title;
  f.desc=(document.getElementById('cv-fe-desc').value||'').trim();
  tbSave();
  cvCloseFeatureEdit();
  cvRenderProjectDetail();
  toast('已保存任务：'+title,'success');
}
function cvDeleteFeature(fid){
  var p=cvProjectById(cvProjCur); if(!p) return;
  var f=cvCurFeature(fid); if(!f) return;
  var children=CV_TASKS.filter(function(t){return t.parentTaskId===fid;});
  if(!window.confirm('删除任务「'+f.title+'」？其 '+children.length+' 个子任务会保留为独立任务。')) return;
  children.forEach(function(t){t.parentTaskId=null;});
  CV_TASKS.splice(CV_TASKS.indexOf(f),1);
  tbSave();
  cvRenderProjectDetail();
  toast('已删除任务：'+f.title,'info');
}
/* 从任务创建任务：复用任务管理的「新建任务」弹窗；复杂拆解交给 cvOpenEpicSplit。 */
function cvPushFeatureToTask(fid){
  var p=cvProjectById(cvProjCur); if(!p) return;
  var f=cvCurFeature(fid); if(!f) return;
  window.cvOpenNewTask && window.cvOpenNewTask('待办',{parentTaskId:f.boardId,projectId:p.id,parentTitle:f.title});
}
/* 关联查看：从项目管理跳到任务详情 */
function cvOpenTaskById(taskId){
  var task=CV_TASKS.find(function(t){ return t.boardId===taskId&&t.kind!=='epic'; });
  if(!task||!tbShowBoard()) return;
  cvSwitchView('tasks');
  cvSetProject(task.project);
  tbOpenTask(CV_TASKS.indexOf(task));
}
function cvOpenProjectDetail(id,tab){
  if(!cvProjectById(id)){toast('项目不存在或已移除','warning');cvResetProjectListState();return;}
  var pageScroll=$('#cv-members .scroll');if(pageScroll)pageScroll.classList.remove('pj-list-mode');
  cvCloseProjectMembersModal(false);
  cvMemberPickerSelected.clear();
  cvProjCur=id;
  cvProjectDetailTab=tab==='artifacts'?'artifacts':'overview';
  cvModuleFilter='all';cvModuleView='table';
  var list=$('#cv-proj-list'),detail=$('#cv-proj-detail');
  var head=$('#cv-project-head'),toolbar=$('#cv-project-toolbar'),viewBar=$('#cv-project-view-bar'),chips=$('#cvProjectFilterChips');
  if(head) head.classList.add('hidden');
  if(toolbar) toolbar.classList.add('hidden');
  if(viewBar)viewBar.classList.add('hidden');
  if(chips)chips.classList.add('hidden');
  if(list) list.classList.add('hidden');
  if(detail){ detail.classList.remove('hidden'); cvRenderProjectDetail(); }
}
function cvLeaveProjectTasks(){
  if(!cvProjectTaskReturnId)return;
  cvProjectTaskReturnId='';
  $('#tkProjectContext')?.classList.add('hidden');
  var heading=$('#view-tasks .tk-header h2');if(heading)heading.textContent='任务';
  tkSetProjectListMode(false);
}
function cvOpenProjectTasks(){
  var project=cvProjectById(cvProjCur);
  if(!project)return;
  cvSwitchView('tasks');
  cvProjectTaskReturnId=project.id;
  cvProjectTaskReturnTab=cvProjectDetailTab;
  var context=$('#tkProjectContext'),name=$('#tkProjectContextName');
  if(name)name.textContent=project.name;
  context?.classList.remove('hidden');
  var heading=$('#view-tasks .tk-header h2');if(heading)heading.textContent='项目任务';
  tkSetProjectListMode(true,project.id);
}
function cvNewProjectTask(){
  var project=cvProjectById(cvProjCur);
  if(!project)return;
  cvOpenProjectTasks();
  tkOpenProjectTaskCreate(project.id);
}
function cvHideProjectDetail(){
  cvCloseProjectMembersModal(false);
  cvResetProjectListState();
}
function cvResetProjectListState(){
  cvCloseProjectMembersModal(false);
  cvProjectDetailDraft=null;cvDetailOwnerSelected=null;
  var pageScroll=$('#cv-members .scroll');if(pageScroll)pageScroll.classList.add('pj-list-mode');
  cvCloseMemberPicker();cvMemberPickerSelected.clear();cvMemberPickerProject='';
  cvProjCur='';
  cvProjectDetailTab='overview';
  var list=$('#cv-proj-list'),detail=$('#cv-proj-detail');
  var head=$('#cv-project-head'),toolbar=$('#cv-project-toolbar'),viewBar=$('#cv-project-view-bar');
  if(detail) detail.classList.add('hidden');
  if(head) head.classList.remove('hidden');
  if(toolbar && $('#cv-projedit-overlay')?.style.display!=='flex') toolbar.classList.remove('hidden');
  if(viewBar)viewBar.classList.remove('hidden');
  if(list){ list.classList.remove('hidden'); cvRenderProjectList(); }
}

var CV_PROJECT_MEMBER_ROLES=[['product','产品'],['development','开发'],['testing','测试']];
function cvProjectMemberRoleLabel(role){
  if(role==='owner')return '项目负责人';
  return CV_PROJECT_MEMBER_ROLES.find(function(option){return option[0]===role;})?.[1]||'待设置';
}
function cvProjectMemberRoleValue(project,person){
  var assigned=project.memberRoles?.[person.id];
  if(CV_PROJECT_MEMBER_ROLES.some(function(option){return option[0]===assigned;}))return assigned;
  var roles=(person.roles||[]).map(function(role){return role.text;});
  if(roles.includes('产品')||roles.includes('需求')||person.dept==='产品部')return 'product';
  if(roles.includes('测试')||person.dept==='测试部')return 'testing';
  if(roles.includes('开发')||roles.includes('架构')||person.dept==='研发部')return 'development';
  return '';
}
function cvProjectMemberRoleHtml(project,person){
  if(person.name===project.owner)return '<span class="pj-detail-member-role">项目负责人</span>';
  var role=cvProjectMemberRoleValue(project,person);
  if(!cvCanManageProject(project))return '<span class="pj-detail-member-role">'+xesc(cvProjectMemberRoleLabel(role))+'</span>';
  return '<select class="pj-member-role-select" data-pj-member-role="'+xesc(person.id)+'" aria-label="'+xesc(person.name)+'的项目角色">'
    +'<option value=""'+(!role?' selected':'')+'>待设置</option>'
    +CV_PROJECT_MEMBER_ROLES.map(function(option){return '<option value="'+option[0]+'"'+(role===option[0]?' selected':'')+'>'+option[1]+'</option>';}).join('')+'</select>';
}
function cvSaveProjectMemberRole(personId,role){
  var project=cvProjectById(cvProjCur);
  if(!cvCanManageProject(project)){toast('只有项目负责人可以设置成员角色','warning');return;}
  var person=CV_MEMBERS.find(function(row){return row.id===personId;});
  if(!person||(project.members||[]).indexOf(personId)<0||person.name===project.owner){toast('该成员不能修改角色','warning');return;}
  if(!CV_PROJECT_MEMBER_ROLES.some(function(option){return option[0]===role;})){toast('请选择产品、开发或测试角色','warning');return;}
  var previous=project.memberRoles?{...project.memberRoles}:null,previousUpdatedAt=project.updatedAt;
  project.memberRoles={...project.memberRoles,[personId]:role};
  project.updatedAt=Date.now();
  if(!cvPersistProjects()){
    if(previous)project.memberRoles=previous;else delete project.memberRoles;
    project.updatedAt=previousUpdatedAt;
    cvRenderProjectDetail();
    toast('角色保存失败，请重试','error');return;
  }
  cvRenderProjectDetail();
  toast('项目角色已更新','success');
}
function cvCloseMemberPicker(){
  clearTimeout(cvMemberSearchTimer);cvMemberSearchSeq++;cvMemberSearchRows.clear();
  if(cvMemberPickerPopup){cvMemberPickerPopup.remove();cvMemberPickerPopup=null;}
  cvMemberPickerSelected.clear();
  var search=$('#cv-project-member-search');
  if(search){search.value='';search.setAttribute('aria-expanded','false');}
  cvUpdateMemberPickerSelection();
}
function cvRenderProjectMembersModal(){
  var overlay=$('#cv-project-members-overlay'),project=cvProjectById(cvProjCur);
  if(!overlay)return;
  if(!project){overlay.style.display='none';overlay.setAttribute('aria-hidden','true');return;}
  var members=cvPeopleInProject(project),title=$('#cv-project-members-title'),name=$('#cv-project-members-project-name');
  if(title)title.textContent='成员（'+members.length+'）';
  if(name)name.textContent=project.name;
  var searchRow=$('#cv-project-member-search-row');
  if(searchRow)searchRow.classList.toggle('hidden',!cvCanManageProject(project));
  var list=$('#cv-project-members-list');
  if(list)list.innerHTML=cvRenderProjectMemberRows(project,members);
}
function cvCloseProjectMembersModal(restoreFocus){
  var overlay=$('#cv-project-members-overlay');
  if(!overlay)return;
  cvCloseMemberPicker();
  overlay.style.display='none';overlay.setAttribute('aria-hidden','true');
  if(restoreFocus!==false)$('#cv-proj-detail [data-pj-members-open]')?.focus();
}
function cvOpenProjectMembersModal(){
  var project=cvProjectById(cvProjCur),overlay=$('#cv-project-members-overlay');
  if(!project||!overlay)return;
  cvRenderProjectMembersModal();
  overlay.style.display='flex';overlay.setAttribute('aria-hidden','false');
  var focusTarget=cvCanManageProject(project)?$('#cv-project-member-search'):overlay.querySelector('[data-pj-members-close]');
  (focusTarget||overlay.querySelector('[role="dialog"]'))?.focus();
}
function cvUpdateMemberPickerSelection(){
  var add=$('#cv-project-member-add');
  var role=$('#cv-project-member-role')?.value||'';
  if(add){add.disabled=!cvMemberPickerSelected.size||!CV_PROJECT_MEMBER_ROLES.some(function(option){return option[0]===role;});add.textContent=cvMemberPickerSelected.size?'添加 '+cvMemberPickerSelected.size+' 人':'添加';}
  if(cvMemberPickerPopup){
    var count=cvMemberPickerPopup.querySelector('[data-pj-picker-count]');
    if(count)count.textContent='已选 '+cvMemberPickerSelected.size+' 人';
  }
}
function cvOpenMemberPicker(){
  var project=cvProjectById(cvProjCur),search=$('#cv-project-member-search');
  if(!cvCanManageProject(project)||!search||cvMemberPickerPopup)return;
  var popup=document.createElement('div');
  popup.id='pj-member-picker-popup';popup.className='pj-members-picker';
  popup.innerHTML='<div class="pj-picker-source-note">搜索人员并多选</div>'
    +'<div class="pj-members-candidates" role="group" aria-label="人员搜索结果"></div>'
    +'<div class="pj-members-picker-footer"><span data-pj-picker-count>已选 0 人</span></div>';
  $('#cv-project-members-overlay').appendChild(popup);
  cvMemberPickerPopup=popup;
  var rect=search.closest('.pj-member-search-field').getBoundingClientRect(),width=Math.min(rect.width,window.innerWidth-24);
  popup.style.width=width+'px';
  popup.style.left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12))+'px';
  var below=window.innerHeight-rect.bottom-12,above=rect.top-12;
  var openAbove=below<240&&above>below;
  popup.style.maxHeight=Math.max(120,Math.min(300,openAbove?above:below))+'px';
  popup.style.top=(openAbove?Math.max(12,rect.top-popup.getBoundingClientRect().height-6):rect.bottom+6)+'px';
  search.setAttribute('aria-expanded','true');
  cvSearchProjectMemberCandidates(search.value.trim());
  popup.addEventListener('change',function(event){
    if(event.target.type!=='checkbox')return;
    if(event.target.checked)cvMemberPickerSelected.add(event.target.value);
    else cvMemberPickerSelected.delete(event.target.value);
    cvUpdateMemberPickerSelection();
  });
}
function cvSearchProjectMemberCandidates(query){
  var project=cvProjectById(cvProjCur),popup=cvMemberPickerPopup;
  if(!project||!popup)return;
  var results=popup.querySelector('.pj-members-candidates');
  clearTimeout(cvMemberSearchTimer);
  var seq=++cvMemberSearchSeq;
  if(!query){results.innerHTML='<div class="pj-picker-no-results">输入姓名、手机号或邮箱开始搜索</div>';return;}
  results.innerHTML='<div class="pj-picker-no-results">搜索中…</div>';
  cvMemberSearchTimer=setTimeout(async function(){
    try{
      var rows=await cvSearchLingeePeople(query);
      if(seq!==cvMemberSearchSeq||!cvMemberPickerPopup)return;
      rows.forEach(function(person){cvMemberSearchRows.set(person.id,person);});
      results.innerHTML=rows.length?rows.map(function(person){
        var local=CV_MEMBERS.find(function(row){return row.id===person.id||row.userId===person.id;});
        var inProject=!!local&&(project.members||[]).includes(local.id),disabled=inProject||local?.status==='disabled';
        return '<label><input type="checkbox" value="'+xesc(person.id)+'"'+(cvMemberPickerSelected.has(person.id)?' checked':'')+(disabled?' disabled':'')+'><span class="pj-member-candidate-name">'+xesc(person.name)+'</span><small>'+xesc(person.dept||'未填写部门')+' · '+xesc(person.phone||person.email||'无联系方式')+(inProject?' · 已加入':'')+'</small></label>';
      }).join(''):'<div class="pj-picker-no-results">没有匹配的人员</div>';
    }catch(error){if(seq===cvMemberSearchSeq&&cvMemberPickerPopup)results.innerHTML='<div class="pj-picker-no-results">搜索失败，请稍后重试</div>';}
  },250);
}
function cvRenderProjectMemberRows(project,members){
  return members.length?'<div class="pj-members-list">'+members.map(function(person){
    var isOwner=person.name===project.owner;
    var actions=isOwner||!cvCanManageProject(project)?'':'<button type="button" class="pj-member-remove-btn" data-pj-member-remove="'+xesc(person.id)+'" aria-label="移除成员 '+xesc(person.name)+'">移除</button>';
    var contact=[person.phone,person.email].filter(Boolean).join(' · ');
    return '<div class="pj-members-row"><span class="pj-member-avatar">'+xesc(person.name[0]||'?')+'</span><span class="pj-members-info"><b>'+xesc(person.name)+'</b><small>部门：'+xesc(person.dept||'未填写')+' · '+xesc(contact||'暂无联系方式')+'</small></span>'+cvProjectMemberRoleHtml(project,person)+actions+'</div>';
  }).join('')+'</div>':'<div class="pj-members-empty">还没有项目成员，请新增成员。</div>';
}
function cvAddProjectMember(){
  var project=cvProjectById(cvProjCur);
  if(!cvCanManageProject(project)){toast('只有项目负责人可以添加成员','warning');return;}
  if(!cvMemberPickerSelected.size){toast('请先搜索并选择人员','warning');return;}
  var role=$('#cv-project-member-role')?.value||'';
  if(!CV_PROJECT_MEMBER_ROLES.some(function(option){return option[0]===role;})){toast('请先选择新增成员的项目角色','warning');return;}
  var people=Array.from(cvMemberPickerSelected).map(function(id){return cvEnsureProjectPerson(cvMemberSearchRows.get(id));}).filter(function(person){return person&&!(project.members||[]).includes(person.id)&&person.status!=='disabled';});
  if(!people.length){toast('所选人员无法添加','warning');return;}
  var previousMembers=(project.members||[]).slice(),previousRoles=project.memberRoles?{...project.memberRoles}:null,previousUpdatedAt=project.updatedAt;
  project.members=previousMembers.slice();
  project.memberRoles={...project.memberRoles};
  people.forEach(function(person){project.members.push(person.id);project.memberRoles[person.id]=role;});
  project.updatedAt=Date.now();
  if(!cvPersistProjects()){
    project.members=previousMembers;
    if(previousRoles)project.memberRoles=previousRoles;else delete project.memberRoles;
    project.updatedAt=previousUpdatedAt;
    toast('添加失败，请重试','error');return;
  }
  cvCloseMemberPicker();
  $('#cv-project-member-role').value='';
  cvRenderProjectDetail();cvRenderProjectList();
  toast('已添加 '+people.length+' 名项目成员');
}
function cvProjectMemberRemovalError(project,person){
  if(!cvCanManageProject(project))return '只有项目负责人可以移除成员';
  if(person.name===project.owner)return '请先更换项目负责人，再移除该成员';
  var pending=CV_TASKS.filter(function(task){
    if(task.project!==project.id||task.kind==='epic'||['已完成','已取消'].includes(task.status))return false;
    return task.assignee===person.name||(task.stagePlan||[]).some(function(stage){return stage.assignee===person.name;});
  });
  if(pending.length)return person.name+' 还有 '+pending.length+' 个未完成任务，请先完成或转交后再移除';
  var ids=Array.isArray(project.members)?project.members:[];
  if(ids.length<=1)return '项目至少需要 1 名成员';
  if(!ids.includes(person.id))return '该成员已不在项目中';
  return '';
}
function cvCloseMemberRemoveModal(restoreFocus){
  var overlay=$('#cv-project-member-remove-overlay'),trigger=cvPendingMemberRemoval?.trigger;
  if(overlay){overlay.style.display='none';overlay.setAttribute('aria-hidden','true');}
  cvPendingMemberRemoval=null;
  if(restoreFocus!==false&&trigger?.isConnected)trigger.focus();
}
function cvRemoveProjectMember(personId){
  var project=cvProjectById(cvProjCur),person=CV_MEMBERS.find(function(row){return row.id===personId;});
  if(!project||!person)return;
  var error=cvProjectMemberRemovalError(project,person);
  if(error){toast(error,'warning');return;}
  var overlay=$('#cv-project-member-remove-overlay'),message=$('#cv-project-member-remove-message');
  if(!overlay||!message)return;
  cvPendingMemberRemoval={projectId:project.id,personId:personId,trigger:document.activeElement};
  message.textContent='确定将「'+person.name+'」从「'+project.name+'」中移除吗？';
  overlay.style.display='flex';overlay.setAttribute('aria-hidden','false');
  overlay.querySelector('[data-pj-remove-cancel]')?.focus();
}
function cvConfirmProjectMemberRemoval(){
  var pending=cvPendingMemberRemoval;
  if(!pending)return;
  var project=cvProjectById(pending.projectId),person=CV_MEMBERS.find(function(row){return row.id===pending.personId;});
  if(!project||!person){cvCloseMemberRemoveModal(false);toast('项目或成员已不存在','warning');return;}
  var error=cvProjectMemberRemovalError(project,person);
  if(error){cvCloseMemberRemoveModal(false);toast(error,'warning');return;}
  var trigger=pending.trigger;
  cvCloseMemberRemoveModal(false);
  var ids=project.members,previousRoles=project.memberRoles?{...project.memberRoles}:null;
  project.members=ids.filter(function(id){return id!==person.id;});
  project.updatedAt=Date.now();
  if(project.memberRoles)delete project.memberRoles[person.id];
  if(!cvPersistProjects()){
    project.members=ids;
    if(previousRoles)project.memberRoles=previousRoles;
    if(trigger?.isConnected)trigger.focus();
    toast('移除失败，请重试','error');
    return;
  }
  cvRenderProjectDetail();
  cvRenderProjectList();
  var focusSelector=$('#cv-project-members-overlay')?.getAttribute('aria-hidden')==='false'
    ?'#cv-project-members-overlay [data-pj-members-close]':'#cv-proj-detail [data-pj-members-open]';
  $(focusSelector)?.focus();
}

export function initCollabProjectView(){
  window.cvLeaveProjectTasks=cvLeaveProjectTasks;
  document.addEventListener('lingee:tasks-changed',cvRenderProjectList);
  cvRenderProjectFilters();
  var projectSearch=$('#cvProjectSearch');
  if(projectSearch){ projectSearch.value=''; projectSearch.addEventListener('input',cvRenderProjectList); }
  var scope=$('#cv-project-tabs');if(scope){scope.addEventListener('click',function(event){var tab=event.target.closest('[data-pj-scope]');if(!tab)return;cvProjectScope=tab.getAttribute('data-pj-scope');cvRenderProjectList();});scope.addEventListener('keydown',function(event){if((event.key==='Enter'||event.key===' ')&&event.target.closest('[data-pj-scope]')){event.preventDefault();event.target.click();}});}
  function closeProjectPopovers(){
    [['#cvProjectFilterBtn','#cvProjectFilterPanel'],['#cvProjectDisplayBtn','#cvProjectDisplayPanel']].forEach(function(pair){var button=$(pair[0]),panel=$(pair[1]);if(button){button.setAttribute('aria-expanded','false');button.classList.remove('active');}if(panel)panel.classList.add('hidden');});
  }
  [['#cvProjectFilterBtn','#cvProjectFilterPanel'],['#cvProjectDisplayBtn','#cvProjectDisplayPanel']].forEach(function(pair){
    var button=$(pair[0]),panel=$(pair[1]);if(!button||!panel)return;
    button.addEventListener('click',function(event){event.stopPropagation();var opening=panel.classList.contains('hidden');closeProjectPopovers();panel.classList.toggle('hidden',!opening);button.setAttribute('aria-expanded',String(opening));button.classList.toggle('active',opening);if(opening&&panel.id==='cvProjectFilterPanel'){cvActiveProjectFilter='status';cvRenderProjectFilters();var rect=button.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-150))+'px';panel.style.top=Math.min(rect.bottom+4,window.innerHeight-160)+'px';$('#cvProjectFilterOptions').classList.toggle('flip',rect.left<225);}});
    panel.addEventListener('click',function(event){event.stopPropagation();});
  });
  document.addEventListener('click',function(event){if(!event.target.closest('#cv-project-toolbar'))closeProjectPopovers();});
  document.addEventListener('keydown',function(event){if(event.key==='Escape')closeProjectPopovers();});
  var projectFilterPanel=$('#cvProjectFilterPanel');if(projectFilterPanel){
    projectFilterPanel.addEventListener('mouseover',function(event){var field=event.target.closest('[data-pj-filter-field]');if(field&&field.getAttribute('data-pj-filter-field')!==cvActiveProjectFilter){cvActiveProjectFilter=field.getAttribute('data-pj-filter-field');cvRenderProjectFilters();}});
    projectFilterPanel.addEventListener('click',function(event){
      var field=event.target.closest('[data-pj-filter-field]');if(field){cvActiveProjectFilter=field.getAttribute('data-pj-filter-field');cvRenderProjectFilters();return;}
      var option=event.target.closest('[data-pj-filter-value]');if(option){var value=option.getAttribute('data-pj-filter-value');var index=cvProjectFilters.findIndex(function(item){return item.field===cvActiveProjectFilter&&item.value===value;});if(index>=0)cvProjectFilters.splice(index,1);else cvProjectFilters.push({field:cvActiveProjectFilter,value:value});cvRenderProjectList();return;}
      if(event.target.closest('#cvProjectFilterReset')){cvProjectFilters=[];cvRenderProjectList();}
    });
  }
  var projectChips=$('#cvProjectFilterChips');if(projectChips)projectChips.addEventListener('click',function(event){var clear=event.target.closest('[data-pj-clear]');if(!clear)return;var key=clear.getAttribute('data-pj-clear');if(key==='all')cvProjectFilters=[];else cvProjectFilters.splice(Number(key),1);cvRenderProjectList();});
  var viewSwitch=$('#cv-project-view-switch');
  if(viewSwitch) viewSwitch.addEventListener('click',function(e){
    var view=e.target.closest('[data-pj-view]');
    if(view){ cvProjectListView=view.getAttribute('data-pj-view'); cvRenderProjectList(); }
  });
  var plist=$('#cv-proj-list');
  if(plist) plist.addEventListener('click',function(e){
    var open=e.target.closest('[data-pj-open]');
    if(open){ cvOpenProjectDetail(open.getAttribute('data-pj-open')); return; }
  });
  if(plist) plist.addEventListener('keydown',function(e){
    var card=e.target.closest('.pj-card[data-pj-open]');
    if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();cvOpenProjectDetail(card.getAttribute('data-pj-open'));}
  });
  var pdetail=$('#cv-proj-detail');
  if(pdetail) pdetail.addEventListener('submit',function(event){
    if(event.target.id!=='pj-project-form')return;
    event.preventDefault();cvSaveProjectDetail();
  });
  if(pdetail) pdetail.addEventListener('input',function(event){
    if(event.target.id==='pj-detail-owner')cvSearchDetailOwner(event.target.value.trim());
  });
  if(pdetail) pdetail.addEventListener('change',function(event){
    var role=event.target.closest('[data-pj-member-role]');
    if(role)cvSaveProjectMemberRole(role.getAttribute('data-pj-member-role'),role.value);
    if(event.target.matches('[data-pj-artifact-type]'))cvFilterProjectArtifacts();
  });
  if(pdetail) pdetail.addEventListener('focusin',function(event){
    if(event.target.id==='pj-detail-owner'&&event.target.value.trim())cvSearchDetailOwner(event.target.value.trim());
  });
  if(pdetail) pdetail.addEventListener('click',function(e){
    if(e.target.closest('[data-pj-back]')){ cvHideProjectDetail(); return; }
    var detailTab=e.target.closest('[data-pj-detail-tab]');
    if(detailTab){cvProjectDetailTab=detailTab.getAttribute('data-pj-detail-tab');cvRenderProjectDetail();return;}
    var artifactPreview=e.target.closest('[data-pj-artifact-preview]');
    if(artifactPreview){e.preventDefault();cvPreviewProjectArtifact(Number(artifactPreview.getAttribute('data-pj-artifact-preview')),artifactPreview);return;}
    var artifactDownload=e.target.closest('[data-pj-artifact-download]');
    if(artifactDownload){cvDownloadProjectArtifact(Number(artifactDownload.getAttribute('data-pj-artifact-download')));return;}
    var previewPane=e.target.closest('[data-pj-preview-pane]');
    if(previewPane){
      if(e.target.closest('[data-pj-preview-close]')){cvCloseProjectArtifactPreview();return;}
      if(e.target.closest('[data-pj-preview-download]')){cvDownloadProjectArtifact(Number(previewPane.dataset.artifactIndex));return;}
      var fullscreen=e.target.closest('[data-pj-preview-fullscreen]');
      if(fullscreen){var expanded=previewPane.classList.toggle('is-fullscreen');previewPane.closest('.pj-detail-main').classList.toggle('has-fullscreen',expanded);fullscreen.setAttribute('aria-pressed',String(expanded));fullscreen.setAttribute('aria-label',expanded?'退出全屏':'全屏预览');fullscreen.title=expanded?'退出全屏':'全屏预览';fullscreen.textContent=expanded?'退出全屏':'全屏 ⛶';return;}
    }
    if(e.target.closest('[data-pj-delete]')){cvDeleteCurrentProject();return;}
    var icon=e.target.closest('[data-pj-detail-icon]');
    if(icon){cvDetailIconColor=cvProjectIconColor(icon.getAttribute('data-pj-detail-icon'));pdetail.querySelectorAll('[data-pj-detail-icon]').forEach(function(button){button.setAttribute('aria-pressed',String(button===icon));});return;}
    var ownerChoice=e.target.closest('[data-pj-detail-owner]');
    if(ownerChoice){var person=cvDetailOwnerRows[Number(ownerChoice.getAttribute('data-pj-detail-owner'))],input=$('#pj-detail-owner');if(person&&input){clearTimeout(cvDetailOwnerSearchTimer);cvDetailOwnerSearchSeq++;cvDetailOwnerSelected=person;input.value=person.name;input.setAttribute('aria-expanded','false');$('#pj-detail-owner-results')?.classList.add('hidden');}return;}
    if(e.target.closest('[data-pj-members-open]')){cvOpenProjectMembersModal();return;}
    var memberRemove=e.target.closest('[data-pj-member-remove]');
    if(memberRemove){cvRemoveProjectMember(memberRemove.getAttribute('data-pj-member-remove'));return;}
    var moduleView=e.target.closest('[data-pj-module-view]');
    if(moduleView){cvModuleView=moduleView.getAttribute('data-pj-module-view');cvRenderProjectDetail();return;}
    if(e.target.closest('[data-pj-split]')){ cvOpenProjectSplit(); return; }
    if(e.target.closest('[data-pj-split-manual]')){ cvOpenManualSplit(); return; }
    var esplit=e.target.closest('[data-ft-split]');
    if(esplit){ cvOpenEpicSplit(esplit.getAttribute('data-ft-split')); return; }
    var ftoggle=e.target.closest('[data-ft-tasks-toggle]');
    if(ftoggle){ var fid=ftoggle.getAttribute('data-ft-tasks-toggle'); cvCollapsedEpics[fid]=!cvModuleTasksCollapsed(fid); var activeProject=cvProjectById(cvProjCur); if(activeProject) cvRenderModuleResults(cvProjectEpics(activeProject)); return; }
    var push=e.target.closest('[data-ft-push]');
    if(push){ cvPushFeatureToTask(push.getAttribute('data-ft-push')); return; }
    var fedit=e.target.closest('[data-ft-edit]');
    if(fedit){ cvOpenFeatureEdit(fedit.getAttribute('data-ft-edit')); return; }
    var fdel=e.target.closest('[data-ft-del]');
    if(fdel){ cvDeleteFeature(fdel.getAttribute('data-ft-del')); return; }
    var tv=e.target.closest('[data-pj-task]');
    if(tv){ cvOpenTaskById(tv.getAttribute('data-pj-task')); return; }
  });
  if(pdetail)pdetail.addEventListener('scroll',cvPositionDetailOwnerResults,true);
  window.addEventListener('resize',cvPositionDetailOwnerResults);
  document.addEventListener('click',function(event){
    if(event.target.closest('#pj-detail-owner, #pj-detail-owner-results'))return;
    $('#pj-detail-owner-results')?.classList.add('hidden');$('#pj-detail-owner')?.setAttribute('aria-expanded','false');
  });
  $('#tkProjectBack')?.addEventListener('click',function(){
    var projectId=cvProjectTaskReturnId;
    var tab=cvProjectTaskReturnTab;
    cvSwitchView('members');
    if(projectId)cvOpenProjectDetail(projectId,tab);
  });
  var membersOverlay=$('#cv-project-members-overlay');
  var removeOverlay=$('#cv-project-member-remove-overlay');
  if(removeOverlay){
    removeOverlay.addEventListener('click',function(event){
      if(event.target.closest('[data-pj-remove-confirm]')){cvConfirmProjectMemberRemoval();return;}
      if(event.target===removeOverlay||event.target.closest('[data-pj-remove-cancel]'))cvCloseMemberRemoveModal();
    });
    removeOverlay.addEventListener('keydown',function(event){
      if(event.key==='Escape'){event.preventDefault();cvCloseMemberRemoveModal();return;}
      if(event.key!=='Tab')return;
      var cancel=removeOverlay.querySelector('[data-pj-remove-cancel]'),confirm=removeOverlay.querySelector('[data-pj-remove-confirm]');
      if(event.shiftKey&&document.activeElement===cancel){event.preventDefault();confirm.focus();}
      else if(!event.shiftKey&&document.activeElement===confirm){event.preventDefault();cancel.focus();}
    });
  }
  if(membersOverlay){
    membersOverlay.addEventListener('change',function(e){
      if(e.target.id==='cv-project-member-role'){cvUpdateMemberPickerSelection();return;}
      var role=e.target.closest('[data-pj-member-role]');
      if(role)cvSaveProjectMemberRole(role.getAttribute('data-pj-member-role'),role.value);
    });
    membersOverlay.addEventListener('click',function(e){
      if(e.target===membersOverlay||e.target.closest('[data-pj-members-close]')){cvCloseProjectMembersModal();return;}
      if(e.target.closest('[data-pj-add-member]')){cvAddProjectMember();return;}
      var remove=e.target.closest('[data-pj-member-remove]');
      if(remove){cvRemoveProjectMember(remove.getAttribute('data-pj-member-remove'));return;}
    });
    membersOverlay.addEventListener('focusin',function(e){
      if(e.target.id==='cv-project-member-search')cvOpenMemberPicker();
    });
    membersOverlay.addEventListener('input',function(e){
      if(e.target.id!=='cv-project-member-search')return;
      cvOpenMemberPicker();
      cvSearchProjectMemberCandidates(e.target.value.trim());
    });
    membersOverlay.addEventListener('keydown',function(e){
      if(e.key!=='Tab'||cvMemberPickerPopup)return;
      var focusable=Array.from(membersOverlay.querySelectorAll('button:not(:disabled):not(.hidden)')).filter(function(button){return button.getClientRects().length;});
      if(!focusable.length)return;
      var first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    });
  }
  document.addEventListener('click',function(event){
    if(cvMemberPickerPopup&&!cvMemberPickerPopup.contains(event.target)&&!event.target.closest('.pj-member-search-field, #cv-project-member-role, #cv-project-member-add'))cvCloseMemberPicker();
  });
  document.addEventListener('keydown',function(event){
    if(event.key==='Escape'&&cvMemberPickerPopup){cvCloseMemberPicker();event.stopPropagation();return;}
    if(event.key==='Escape'&&membersOverlay&&membersOverlay.style.display==='flex'){cvCloseProjectMembersModal();event.stopPropagation();}
  });
  document.addEventListener('scroll',function(event){
    if(cvMemberPickerPopup&&!cvMemberPickerPopup.contains(event.target))cvCloseMemberPicker();
  },true);
  window.addEventListener('resize',cvCloseMemberPicker);
  var splitBody=$('#cv-split-body');
  if(splitBody) splitBody.addEventListener('change',function(e){
    if(e.target.closest('[data-split-idx]')) cvUpdateSplitCount();
  });
}

/* ---------- 项目视图管理 ---------- */
function cvInitProjectViewMenu(){
  var addBtn=$('#cvProjectViewAdd'),menu=$('#cvProjectViewMenu');
  if(!addBtn||!menu)return;
  addBtn.addEventListener('click',function(e){
    e.stopPropagation();
    var opening=menu.classList.contains('hidden');
    menu.classList.toggle('hidden',!opening);
    addBtn.setAttribute('aria-expanded',String(opening));
  });
  menu.addEventListener('click',function(e){e.stopPropagation();});
  $('#cvProjectViewMenuNew')&&$('#cvProjectViewMenuNew').addEventListener('click',function(){
    menu.classList.add('hidden');addBtn.setAttribute('aria-expanded','false');
    toast('视图管理功能开发中','info');
  });
  $('#cvProjectViewManage')&&$('#cvProjectViewManage').addEventListener('click',function(){
    menu.classList.add('hidden');addBtn.setAttribute('aria-expanded','false');
    toast('视图管理功能开发中','info');
  });
  document.addEventListener('click',function(){
    if(menu&&!menu.classList.contains('hidden')){menu.classList.add('hidden');addBtn.setAttribute('aria-expanded','false');}
  });
}
document.addEventListener('DOMContentLoaded',cvInitProjectViewMenu);

export { cvCloseFeatureEdit, cvCloseManualSplit, cvCloseProjectSplit, cvConfirmManualSplit, cvConfirmProjectSplit, cvHideProjectDetail, cvOpenManualSplit, cvOpenProjectDetail, cvOpenProjectSplit, cvRenderProjectDetail, cvRenderProjectList, cvResetProjectListState, cvSaveFeatureEdit };
