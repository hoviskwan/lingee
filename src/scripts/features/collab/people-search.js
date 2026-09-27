import { CV_MEMBERS, cvAddPersonToWorkspace, cvPeopleInWorkspace, cvPersistPersons, cvWorkspace } from './data.js';

/* 待接入：宿主提供 search(query) → [{id,name,phone,email,dept}]，服务端按当前租户和权限过滤。 */
var CV_LINGEE_DEMO_USERS=[
  {id:'lingee-demo-101',name:'王晓妹',phone:'13800001001',email:'wang.xiaomei@example.com'},
  {id:'lingee-demo-102',name:'王晓萌',phone:'13800001002',email:'wang.xiaomeng@example.com'},
  {id:'lingee-demo-103',name:'李明',phone:'13800001003',email:'li.ming@example.com'},
  {id:'lingee-demo-104',name:'陈雨',phone:'13800001004',email:'chen.yu@example.com'},
  {id:'lingee-demo-105',name:'赵宁',phone:'13800001005',email:'zhao.ning@example.com'}
];

function cvPeopleSearchIsDemo(){return typeof window.cvSearchLingeePeople!=='function';}
async function cvSearchLingeePeople(query){
  if(!cvPeopleSearchIsDemo()){
    var rows=await window.cvSearchLingeePeople(query);
    return Array.isArray(rows)?rows.filter(function(person){return person&&person.id!=null&&person.name;}).map(function(person){return {id:String(person.id),name:String(person.name),phone:person.phone||'',email:person.email||'',dept:person.dept||''};}):[];
  }
  var keyword=query.toLocaleLowerCase();
  return CV_LINGEE_DEMO_USERS.filter(function(person){return [person.name,person.phone,person.email].some(function(value){return value.toLocaleLowerCase().includes(keyword);});});
}
function cvLinkedLingeePerson(id,name){
  return cvPeopleInWorkspace().find(function(row){return row.id===id||row.userId===id||(row.linkedUserIds||[]).includes(id)||(name==='吴宏超'&&row.name===name);})||null;
}
function cvLinkLingeePerson(person){
  if(!person||!person.id||!person.name)return null;
  var linked=cvLinkedLingeePerson(person.id,person.name);if(linked)return linked;
  linked=CV_MEMBERS.find(function(row){return row.id===person.id||row.userId===person.id;});
  if(!linked){
    linked={id:person.id,userId:person.id,name:person.name,phone:person.phone||'',email:person.email||'',dept:person.dept||'',workspaceRole:'member',workspaceIds:[cvWorkspace],roles:[],status:'available',source:cvPeopleSearchIsDemo()?'灵基用户（演示）':'灵基用户'};
    CV_MEMBERS.push(linked);
    if(!cvPersistPersons()){CV_MEMBERS.pop();return null;}
  }
  if(!cvAddPersonToWorkspace(linked))return null;
  return linked;
}

/* 项目成员属于项目；远程用户只需在本地建立身份映射，无需加入工作区。 */
function cvEnsureProjectPerson(person){
  if(!person||!person.id||!person.name)return null;
  var linked=CV_MEMBERS.find(function(row){return row.id===person.id||row.userId===person.id||(row.linkedUserIds||[]).includes(person.id);});
  if(linked)return linked;
  linked={id:String(person.id),userId:String(person.id),name:String(person.name),phone:person.phone||'',email:person.email||'',dept:person.dept||'',roles:[],status:'available',source:cvPeopleSearchIsDemo()?'灵基用户（演示）':'灵基用户'};
  CV_MEMBERS.push(linked);
  if(!cvPersistPersons()){CV_MEMBERS.pop();return null;}
  return linked;
}

export { cvEnsureProjectPerson, cvLinkLingeePerson, cvLinkedLingeePerson, cvPeopleSearchIsDemo, cvSearchLingeePeople };
