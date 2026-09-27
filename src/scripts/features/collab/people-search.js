import { CV_MEMBERS, cvAddPersonToWorkspace, cvPeopleInWorkspace, cvPersistPersons, cvWorkspace } from './data.js';
import { getLoginPeople } from '../login.js';

/* 待接入：宿主提供 search(query) → [{id,name,phone,email,dept}]，服务端按当前租户和权限过滤。 */
var CV_LINGEE_DEMO_USERS=[
  {id:'lingee-demo-101',name:'王晓妹',phone:'13800001001',email:'wang.xiaomei@example.com'},
  {id:'lingee-demo-102',name:'王晓萌',phone:'13800001002',email:'wang.xiaomeng@example.com'},
  {id:'lingee-demo-103',name:'李明',phone:'13800001003',email:'li.ming@example.com'},
  {id:'lingee-demo-104',name:'陈雨',phone:'13800001004',email:'chen.yu@example.com'},
  {id:'lingee-demo-105',name:'赵宁',phone:'13800001005',email:'zhao.ning@example.com'},
  {id:'p24',name:'需求',dept:'产品部'},
  {id:'p25',name:'架构',dept:'架构部'},
  {id:'p26',name:'开发',dept:'研发部'},
  {id:'p27',name:'测试',dept:'测试部'},
  {id:'p28',name:'部署',dept:'运维部'}
];

function cvPeopleSearchIsDemo(){return typeof window.cvSearchLingeePeople!=='function';}
function cvLoginPeople(){return getLoginPeople();}
async function cvSearchLingeePeople(query){
  var keyword=String(query||'').trim().toLocaleLowerCase();
  if(!keyword)return [];
  var local=CV_MEMBERS.concat(cvLoginPeople(),CV_LINGEE_DEMO_USERS).filter(function(person){
    return person&&person.id!=null&&person.name&&[person.name,person.account,person.phone,person.email].some(function(value){return value&&String(value).toLocaleLowerCase().includes(keyword);});
  });
  var remote=[];
  if(!cvPeopleSearchIsDemo()){
    try{
      var rows=await window.cvSearchLingeePeople(query);
      if(Array.isArray(rows))remote=rows.filter(function(person){return person&&person.id!=null&&person.name;});
    }catch(error){if(!local.length)throw error;}
  }
  var seen=new Set();
  return local.concat(remote).filter(function(person){
    var linked=CV_MEMBERS.find(function(row){return row.id===String(person.id)||row.userId===String(person.id)||(row.linkedUserIds||[]).includes(String(person.id));});
    var id=linked?.id||String(person.id);
    if(seen.has(id))return false;
    seen.add(id);
    return true;
  }).map(function(person){
    var linked=CV_MEMBERS.find(function(row){return row.id===String(person.id)||row.userId===String(person.id)||(row.linkedUserIds||[]).includes(String(person.id));});
    return {id:linked?.id||String(person.id),name:linked?.name||String(person.name),phone:person.phone||linked?.phone||'',email:person.email||linked?.email||'',dept:person.dept||linked?.dept||''};
  });
}
function cvLinkedLingeePerson(id,name){
  return cvPeopleInWorkspace().find(function(row){return row.id===id||row.userId===id||(row.linkedUserIds||[]).includes(id)||(name==='吴宏超'&&row.name===name);})||null;
}
function cvLinkLingeePerson(person){
  if(!person||!person.id||!person.name)return null;
  var linked=cvLinkedLingeePerson(person.id,person.name);if(linked)return linked;
  linked=CV_MEMBERS.find(function(row){return row.id===person.id||row.userId===person.id;});
  if(!linked){
    linked={id:person.id,userId:person.id,name:person.name,phone:person.phone||'',email:person.email||'',dept:person.dept||'',workspaceRole:'member',workspaceIds:[cvWorkspace],roles:[],status:'available',source:person.account?'原型登录账号':cvPeopleSearchIsDemo()?'灵基用户（演示）':'灵基用户'};
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
  linked={id:String(person.id),userId:String(person.id),name:String(person.name),phone:person.phone||'',email:person.email||'',dept:person.dept||'',roles:[],status:'available',source:person.account?'原型登录账号':cvPeopleSearchIsDemo()?'灵基用户（演示）':'灵基用户'};
  CV_MEMBERS.push(linked);
  if(!cvPersistPersons()){CV_MEMBERS.pop();return null;}
  return linked;
}

export { cvEnsureProjectPerson, cvLinkLingeePerson, cvLinkedLingeePerson, cvLoginPeople, cvPeopleSearchIsDemo, cvSearchLingeePeople };
