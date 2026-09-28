import { renderTaskBoard, renderTaskSummary } from './task-board.js';
import { cvOpenConversation } from './chat.js';
import { STAGES } from '../expert/data.js';
/* 协作开发：项目 / 任务 / 评审 / 人员数据与卡片渲染
   拆分自 src/scripts/main.js，逻辑逐行保留；副作用集中在下方 init* 函数里，
   由 main.js 按拆分前的原始顺序调用。 */


/* ============================================================
   协作开发（任务管理 / 待评审 / 协作人员 / 专家 / 专家团 / 设置）
   任务、评审、协作人员数据与交互移植自协作开发原型稿
   ============================================================ */
/* 项目维度：任务 / 评审 / 协作人员按项目分；专家与专家团为全局资产，项目内只绑定默认专家团
   协作人员为「引用」关系：项目通过 members 引用人员基础资料（CV_MEMBERS）的 id，不再由成员反向挂项目
   项目归属工作区（workspace），工作区为顶层组织单元 */
var CV_PROJECTS=[
  {id:'expense',name:'费用报销应用',desc:'报销、审批与支付集成全流程开发',goal:'实现费用报销全流程线上化，覆盖申请、审批、支付集成与预算控制',dot:'blue',defaultTeam:'kingdee-saas-implementation',status:'in_progress',priority:'高',owner:'吴宏超',repo:'https://github.com/kingdee/expense-app',start:'2026-08-01',end:'2026-11-30',milestones:[{name:'需求确认',date:'2026-08-15'},{name:'方案评审通过',date:'2026-09-10'},{name:'开发完成',date:'2026-10-31'},{name:'上线发布',date:'2026-11-30'}],members:['p22','p01','p02','p03','p04','p05','p07','p08','p09','p10','p12','p15','p20','p21'],workspace:'ws-app'},
  {id:'purchase',name:'采购管理系统',desc:'采购订单、入库与供应商协同重构',goal:'重构采购从下单到入库的协同流程，提升供应商协同效率与数据准确率',dot:'orange',defaultTeam:'cosmic-app-dev',status:'in_progress',priority:'中',owner:'李工',repo:'https://github.com/kingdee/purchase-ms',start:'2026-09-01',end:'2027-01-31',milestones:[{name:'需求定稿',date:'2026-09-20'},{name:'核心流程开发',date:'2026-11-30'},{name:'集成测试',date:'2026-12-31'},{name:'上线',date:'2027-01-31'}],members:['p22','p01','p02','p06','p07','p11','p12','p14','p15','p17','p19','p20','p21'],workspace:'ws-app'},
  {id:'supply',name:'供应链协同平台',desc:'供应商评级、订单协同与交付预测',goal:'搭建供应商协同与评级平台，支持订单协同、资质管理与交付预测',dot:'green',defaultTeam:'general-app-dev',status:'planned',priority:'低',owner:'赵琳',repo:'',start:'2026-10-15',end:'2027-03-31',milestones:[{name:'方案设计',date:'2026-11-15'},{name:'门户对接',date:'2027-01-31'},{name:'评级模型上线',date:'2027-03-31'}],members:['p22','p01','p03','p04','p13','p14','p15','p16','p18','p20','p21'],workspace:'ws-build'},
  {id:'production',name:'生产制造执行系统',desc:'生产排程、工单管理与产能分析',goal:'实现生产全流程数字化，覆盖工单派发、工序跟踪、产能分析与质量追溯',dot:'blue',defaultTeam:'cosmic-app-dev',status:'in_progress',priority:'高',owner:'吴宏超',repo:'https://github.com/kingdee/mes-app',start:'2026-08-15',end:'2026-12-31',milestones:[{name:'需求调研',date:'2026-08-30'},{name:'核心功能开发',date:'2026-10-31'},{name:'联调测试',date:'2026-11-30'},{name:'上线交付',date:'2026-12-31'}],members:['p22','p01','p02','p03','p04','p05','p07'],workspace:'ws-app'},
  {id:'service',name:'客户服务工单平台',desc:'工单流转、SLA监控与客户满意度分析',goal:'搭建客户服务工单全生命周期管理平台，支持多渠道接入、智能派单与SLA自动监控',dot:'orange',defaultTeam:'general-app-dev',status:'in_progress',priority:'中',owner:'吴宏超',repo:'',start:'2026-09-01',end:'2027-01-15',milestones:[{name:'需求确认',date:'2026-09-25'},{name:'工单引擎开发',date:'2026-11-15'},{name:'渠道对接',date:'2026-12-15'},{name:'上线',date:'2027-01-15'}],members:['p22','p01','p04','p05','p07'],workspace:'ws-app'},
  {id:'hr-analytics',name:'人力数据分析平台',desc:'组织画像、人效指标与离职预测',goal:'构建人力数据自助分析平台，支持组织画像可视化、人效指标看板与离职风险预警',dot:'green',defaultTeam:'general-app-dev',status:'planned',priority:'中',owner:'赵琳',repo:'',start:'2026-10-01',end:'2027-02-28',milestones:[{name:'指标体系设计',date:'2026-10-20'},{name:'数据管道搭建',date:'2026-12-15'},{name:'看板上线',date:'2027-02-28'}],members:['p22','p03','p04','p05'],workspace:'ws-build'},
  {id:'warehouse',name:'智能仓储管理平台',desc:'库位优化、出入库协同与库存预警',goal:'搭建智能仓储管理平台，支持库位动态优化、扫码出入库协同与库存实时预警',dot:'blue',defaultTeam:'cosmic-app-dev',status:'in_progress',priority:'高',owner:'李工',repo:'',start:'2026-08-20',end:'2026-12-20',milestones:[{name:'仓储模型设计',date:'2026-09-15'},{name:'出入库开发',date:'2026-10-31'},{name:'预警上线',date:'2026-11-30'},{name:'验收交付',date:'2026-12-20'}],members:['p22','p01','p02','p03','p07'],workspace:'ws-app'},
  {id:'lingee-prototype',name:'Lingee Build',desc:'高保真交互原型与协作开发平台建设',goal:'构建 Lingee 高保真原型，支持协作开发、任务管理与专家协作全流程',dot:'green',defaultTeam:'cosmic-app-dev',status:'in_progress',priority:'高',owner:'吴晓锋',repo:'https://github.com/kingdee/lingee-prototype',start:'2026-07-01',end:'2026-12-31',milestones:[{name:'需求与设计定稿',date:'2026-08-01'},{name:'核心功能开发',date:'2026-10-15'},{name:'联调测试',date:'2026-11-30'},{name:'上线交付',date:'2026-12-31'}],members:['p01','p02','p03','p04','p05','p06','p07','p08','p09','p10','p11','p12','p13','p14','p15','p16','p17','p18','p19','p20','p21','p22','p23','p29','p31','p32','p33','p35','p36','p37','p38','p39','p40','p41'],workspace:'ws-build'},
{id:'cosmic-app-dev',name:'苍穹应用开发',desc:'基于苍穹设计器元模型的应用开发平台，覆盖属性、操作与规则元模型驱动开发',goal:'建设苍穹应用开发平台，基于设计器属性元模型与操作元模型实现元数据驱动的表单开发、操作配置与规则编排',dot:'blue',defaultTeam:'cosmic-app-dev',status:'in_progress',priority:'高',owner:'吴晓锋',repo:'https://github.com/kingdee/cosmic-app-dev',start:'2026-08-01',end:'2026-12-31',milestones:[{name:'元模型抽取完成',date:'2026-09-15'},{name:'属性操作集成',date:'2026-10-31'},{name:'规则引擎上线',date:'2026-11-30'},{name:'平台验收发布',date:'2026-12-31'}],members:['p23','p29','p30','p31','p22','p32','p33','p35','p36','p37','p38','p39','p40'],workspace:'ws-app'}
];

/* 项目范围演示：吴宏超负责费用报销应用和智能合同工作台，参与其余项目。 */
var CV_ROLE_DEMO_PROJECTS=[
  {id:'demo-contract',name:'智能合同工作台',desc:'合同起草、审批和归档流程优化',goal:'缩短合同处理周期，统一审批与归档记录',dot:'blue',defaultTeam:'general-app-dev',status:'in_progress',priority:'中',owner:'吴宏超',repo:'',start:'2026-09-01',end:'2026-12-31',members:['p22','p04','p05'],workspace:'ws-app'},
  {id:'demo-inventory',name:'库存协同门户',desc:'仓储、采购和业务团队共享库存动态',goal:'统一库存查询和补货协作',dot:'orange',defaultTeam:'cosmic-app-dev',status:'planned',priority:'中',owner:'李工',repo:'',start:'2026-09-15',end:'2027-01-31',members:['p02','p22','p07'],workspace:'ws-app'},
  {id:'demo-quality',name:'质量巡检平台',desc:'巡检计划、问题跟踪和整改闭环',goal:'让质量问题从发现到处理可追踪',dot:'green',defaultTeam:'general-app-dev',status:'in_progress',priority:'高',owner:'赵琳',repo:'',start:'2026-08-20',end:'2026-12-15',members:['p04','p22','p05'],workspace:'ws-app'}
];
CV_PROJECTS.push(...CV_ROLE_DEMO_PROJECTS.map(function(project){return {...project,members:project.members.slice()};}));
/* 种子项目快照：cvRestoreProjects 用 localStorage 覆盖 CV_PROJECTS 后，据此补回缺失的种子项目 */
var CV_SEED_PROJECT_SNAPSHOT=CV_PROJECTS.map(function(p){return Object.assign({},p,{members:(p.members||[]).slice(),milestones:(p.milestones||[]).map(function(m){return Object.assign({},m);})});});

/* 工作区：顶层的组织单元，项目归属工作区 */
var CV_WORKSPACES=[
  {id:'ws-build',name:'灵基Build'},
  {id:'ws-app',name:'Build应用开发组'},
  {id:'ws-quality',name:'Build质量与安全组'},
  {id:'ws-skill',name:'Build智能体/Skills开发组'}
];
/* 内置工作区快照：用户可能曾删除内置工作区，据此恢复 */
var CV_SEED_WORKSPACE_SNAPSHOT=CV_WORKSPACES.map(function(w){return Object.assign({},w);});
var CV_WORKSPACE_STORE_KEY='lingee-collab-workspaces-v1';
var CV_ACTIVE_WORKSPACE_KEY='lingee-collab-active-workspace-v1';
var CV_DELETED_WORKSPACE_KEY='lingee-collab-deleted-workspaces-v1';
function cvDeletedWorkspaceIds(){
  try{var ids=JSON.parse(localStorage.getItem(CV_DELETED_WORKSPACE_KEY)||'[]');return Array.isArray(ids)?ids.filter(function(id){return typeof id==='string';}):[];}catch(e){return [];}
}
function cvPersistWorkspaces(){
  try{localStorage.setItem(CV_WORKSPACE_STORE_KEY,JSON.stringify(CV_WORKSPACES));return true;}
  catch(e){return false;}
}
function cvRestoreWorkspaces(){
  try{
    var deleted=new Set(cvDeletedWorkspaceIds());
    for(var i=CV_WORKSPACES.length-1;i>=0;i--)if(deleted.has(CV_WORKSPACES[i].id))CV_WORKSPACES.splice(i,1);
    var rows=JSON.parse(localStorage.getItem(CV_WORKSPACE_STORE_KEY)||'null');
    if(Array.isArray(rows)){
      rows.forEach(function(row){
        if(!row||!row.id||deleted.has(row.id)||typeof row.name!=='string')return;
        var existing=CV_WORKSPACES.find(function(w){return w.id===row.id;});
        if(existing)Object.assign(existing,{name:row.name,desc:row.desc||'',creatorId:row.creatorId||'',creatorName:row.creatorName||'',peopleIds:row.peopleIds,roles:row.roles||{},demoInitialized:!!row.demoInitialized});
        else CV_WORKSPACES.push({id:row.id,name:row.name,desc:row.desc||'',creatorId:row.creatorId||'',creatorName:row.creatorName||'',peopleIds:Array.isArray(row.peopleIds)?row.peopleIds:[],roles:row.roles||{},demoInitialized:!!row.demoInitialized});
      });
    }
    /* 工作区入口已隐藏：不再恢复上次选中的工作区，cvWorkspace 保持空串 = 全部工作区 */
  }catch(e){}
}
var cvProject='';                    /* 空串 = 全部项目（个人视角的聚合视图） */
var cvWorkspace='';                  /* 空串 = 全部工作区；工作区为项目上层组织单元 */
var cvConfigOverride={};             /* {项目id:{配置卡 key:是否项目覆盖}} */
function cvProjectById(id){
  for(var i=0;i<CV_PROJECTS.length;i++){ if(CV_PROJECTS[i].id===id) return CV_PROJECTS[i]; }
  return null;
}
function cvProjectName(id){ var p=cvProjectById(id); return p?p.name:'未归属项目'; }
function cvWorkspaceById(id){
  for(var i=0;i<CV_WORKSPACES.length;i++){ if(CV_WORKSPACES[i].id===id) return CV_WORKSPACES[i]; }
  return null;
}
function cvWorkspaceName(id){ var w=cvWorkspaceById(id); return w?w.name:'未归属工作区'; }
/* 始终展示全部项目，不按工作区筛选 */
function cvProjectInWorkspace(projId){
  var p=cvProjectById(projId);
  return !!p;
}
function cvInProject(row){
  /* 工作区过滤：任务/评审所属项目须属于当前工作区 */
  if(row.project && !cvProjectInWorkspace(row.project)) return false;
  if(!cvProject) return true;
  if(row.projects) return row.projects==='*'||row.projects.indexOf(cvProject)>=0;
  return row.project===cvProject;
}
function cvProjectTag(row){
  if(cvProject) return '';           /* 项目态下不必重复显示项目名 */
  return '<span class="cv-proj-tag">'+cvProjectName(row.project)+'</span>';
}

var CV_TASKS = [
  {type:'需求',size:'大',source:'Jira',sourceId:'PROJ-42',exec:'专家团',status:'待评审',collab:'Agent间协作',title:'审批流插件代码审查',desc:'审查费用报销审批流的插件实现，包括多级审批流转逻辑和异常处理',assignee:'王工',progress:0,project:'expense',parentTaskId:'epic-expense-approval'},
  {type:'Bug',size:'小',source:'TAPD',sourceId:'BUG-7831',exec:'自动执行',status:'进行中',collab:'人Agent协作',title:'报销金额精度丢失修复',desc:'当报销金额含小数时，后端 BigDecimal 序列化后精度丢失',assignee:'郑凯',progress:62,project:'expense',parentTaskId:'epic-expense-core'},
  {type:'需求',size:'小',source:'对话自建',sourceId:'CNV-001',exec:'自动执行',status:'已完成',collab:'无需协作',title:'费用类型新增团建费选项',desc:'在费用类型下拉中增加团建费选项，归属部门活动费用类别',assignee:'吴芳',progress:100,project:'expense',parentTaskId:'epic-expense-core'},
  {type:'任务',size:'大',source:'Jira',sourceId:'PROJ-56',exec:'专家团',status:'未开始',collab:'人人协作',title:'权限体系重构',desc:'基于 RBAC 模型重构权限体系，支持角色分级、数据权限和功能权限分离',assignee:'宋宇',progress:0,project:'expense',parentTaskId:'epic-expense-perm'},
  {type:'改进',size:'小',source:'API',sourceId:'API-12',exec:'自动执行',status:'已完成',collab:'无需协作',title:'批量导出 Excel 格式支持',desc:'当前仅支持 CSV 导出，需要增加 Excel 格式导出功能',assignee:'蒋雯',progress:100,project:'expense',parentTaskId:'epic-expense-misc'},
  {type:'Bug',size:'小',source:'Jira',sourceId:'BUG-7845',exec:'自动执行',status:'未开始',collab:'人Agent协作',title:'附件上传偶发 502 错误',desc:'附件上传在弱网环境下偶发 502 错误，需要增加重试机制',assignee:'待分配',progress:0,project:'expense',parentTaskId:'epic-expense-misc'},
  {type:'需求',size:'大',source:'Jira',sourceId:'PROJ-61',exec:'专家团',status:'未开始',collab:'人人协作',title:'多级审批流性能优化',desc:'当前审批流在多级审批场景下存在性能瓶颈，需要优化审批流转逻辑',assignee:'待分配',progress:0,project:'expense',parentTaskId:'epic-expense-approval'},
  {type:'任务',size:'大',source:'TAPD',sourceId:'TASK-203',exec:'专家团',status:'待评审',collab:'Agent间协作',title:'审批流多级流转设计',desc:'设计多级审批流转逻辑，支持串行、并行、会签等多种审批模式',assignee:'王工',progress:0,project:'expense',parentTaskId:'epic-expense-approval'},
  {type:'改进',size:'小',source:'对话自建',sourceId:'CNV-003',exec:'自动执行',status:'进行中',collab:'人Agent协作',title:'打印模板优化',desc:'优化报销单打印模板，支持自定义页眉页脚和水印',assignee:'陈晨',progress:35,project:'expense',parentTaskId:'epic-expense-core'},
  {type:'Bug',size:'小',source:'TAPD',sourceId:'BUG-7852',exec:'自动执行',status:'已完成',collab:'无需协作',title:'列表搜索响应慢修复',desc:'当报销单数据量超过 5000 条时，列表页搜索响应时间超过 10 秒',assignee:'唐辉',progress:100,project:'expense',parentTaskId:'epic-expense-core'},
  {type:'需求',size:'大',source:'Jira',sourceId:'PROJ-68',exec:'专家团',status:'未开始',collab:'人人协作',title:'多币种报销支持',desc:'支持多币种报销，包括汇率转换、币种选择和金额展示逻辑',assignee:'待分配',progress:0,project:'expense',parentTaskId:'epic-expense-misc'},
  {type:'任务',size:'小',source:'对话自建',sourceId:'CNV-005',exec:'自动执行',status:'已完成',collab:'人Agent协作',title:'数据字典维护',desc:'维护费用类型、审批层级、权限角色等数据字典',assignee:'梁平',progress:100,project:'expense',parentTaskId:'epic-expense-core'},
  {type:'Bug',size:'大',source:'Jira',sourceId:'BUG-7901',exec:'专家团',status:'已失败',collab:'Agent间协作',title:'审批流死锁问题修复',desc:'并发审批场景下出现死锁，需要重构审批流的锁机制',assignee:'孙明',progress:0,project:'expense',parentTaskId:'epic-expense-approval'},
  {type:'改进',size:'小',source:'API',sourceId:'API-18',exec:'自动执行',status:'未开始',collab:'无需协作',title:'移动端审批页面适配',desc:'当前审批页面在移动端显示异常，需要做响应式适配',assignee:'待分配',progress:0,project:'expense',parentTaskId:'epic-expense-approval'},
  {type:'需求',size:'大',source:'Jira',sourceId:'PROJ-75',exec:'专家团',status:'进行中',collab:'人人协作',title:'预算控制模块开发',desc:'新增预算控制模块，支持按部门/项目/月份设置预算上限，超标自动拦截',assignee:'李工',progress:45,project:'expense',parentTaskId:'epic-expense-perm'},
  {type:'任务',size:'小',source:'TAPD',sourceId:'TASK-215',exec:'自动执行',status:'未开始',collab:'人Agent协作',title:'审批日志查询接口',desc:'开发审批日志查询接口，支持按时间、人员、状态筛选',assignee:'待分配',progress:0,project:'expense',parentTaskId:'epic-expense-approval'},
  {type:'Bug',size:'小',source:'对话自建',sourceId:'CNV-008',exec:'自动执行',status:'已完成',collab:'无需协作',title:'日期格式显示不一致',desc:'不同页面日期格式不一致，有的显示 yyyy-MM-dd 有的显示 yyyy/MM/dd',assignee:'张工',progress:100,project:'expense',parentTaskId:'epic-expense-core'},
  {type:'需求',size:'大',source:'飞书',sourceId:'FS-33',exec:'专家团',status:'未开始',collab:'Agent间协作',title:'移动端审批流开发',desc:'开发移动端审批流程，支持微信/钉钉/飞书消息通知和审批操作',assignee:'周杰',progress:0,project:'expense',parentTaskId:'epic-expense-approval'},
  {type:'需求',size:'大',source:'Jira',sourceId:'PUR-18',exec:'专家团',status:'进行中',collab:'人人协作',title:'采购订单批量导入',desc:'支持 Excel 批量导入采购订单，含供应商匹配、价格校验与错误行回执',assignee:'李工',progress:38,project:'purchase',parentTaskId:'epic-purchase-order'},
  {type:'Bug',size:'小',source:'TAPD',sourceId:'BUG-8102',exec:'自动执行',status:'待评审',collab:'人Agent协作',title:'采购入库单反审核报错',desc:'反审核已关联付款单的入库单时抛空指针，需补充关联校验与提示',assignee:'刘洋',progress:0,project:'purchase',parentTaskId:'epic-purchase-flow'},
  {type:'任务',size:'小',source:'对话自建',sourceId:'CNV-011',exec:'自动执行',status:'已完成',collab:'无需协作',title:'采购订单列表新增供应商筛选',desc:'列表页筛选区增加供应商下拉，支持按编码与名称模糊匹配',assignee:'韩梅',progress:100,project:'purchase',parentTaskId:'epic-purchase-order'},
  {type:'改进',size:'大',source:'Jira',sourceId:'PUR-25',exec:'专家团',status:'未开始',collab:'人人协作',title:'采购价格审批链重构',desc:'按金额分级审批，超阈值自动加签采购总监，并保留完整审批留痕',assignee:'待分配',progress:0,project:'purchase',parentTaskId:'epic-purchase-flow'},
  {type:'需求',size:'大',source:'飞书',sourceId:'FS-52',exec:'专家团',status:'进行中',collab:'Agent间协作',title:'供应商协同门户对接',desc:'打通供应商门户的订单确认与交期回复，含消息推送与状态回写',assignee:'冯远',progress:52,project:'supply',parentTaskId:'epic-supply-collab'},
  {type:'任务',size:'小',source:'API',sourceId:'API-31',exec:'自动执行',status:'未开始',collab:'人Agent协作',title:'交期变更消息推送',desc:'交期变更时向采购员推送企业微信消息，推送失败进入重试队列',assignee:'待分配',progress:0,project:'supply',parentTaskId:'epic-supply-collab'},
  {type:'Bug',size:'小',source:'Jira',sourceId:'BUG-8155',exec:'自动执行',status:'已失败',collab:'Agent间协作',title:'供应商评级定时任务超时',desc:'评级任务在供应商超 2 万条时超时中断，需要改为分片执行',assignee:'罗静',progress:0,project:'supply',parentTaskId:'epic-supply-rating'},
  {type:'需求',size:'小',source:'对话自建',sourceId:'CNV-014',exec:'自动执行',status:'已完成',collab:'无需协作',title:'供应商档案资质到期提醒',desc:'资质到期前 30 天在档案列表标红，并向对接采购员推送提醒',assignee:'何欣',progress:100,project:'supply',parentTaskId:'epic-supply-rating'},
  /* 历史任务的父任务：把种子数据里原本独立的任务按业务主题挂到父任务下 */
  {boardId:'epic-expense-approval',kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-EXPAPR',status:'进行中',title:'审批流引擎',desc:'费用报销的多级审批流转、性能与移动端审批能力',acceptance:'支持串行/并行/会签，大并发下响应达标，移动端可正常审批',files:[],assignee:'吴宏超',priority:'高',project:'expense',progress:0,artifacts:[],activity:[]},
  {boardId:'epic-expense-core',kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-EXPCORE',status:'进行中',title:'报销单基础功能',desc:'报销单录入、打印、查询与数据字典等基础能力',acceptance:'核心录入与查询链路无阻断缺陷，打印与格式展示一致',files:[],assignee:'吴宏超',priority:'高',project:'expense',progress:0,artifacts:[],activity:[]},
  {boardId:'epic-expense-perm',kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-EXPPERM',status:'未开始',title:'权限与预算管控',desc:'基于 RBAC 的权限体系重构与部门/项目预算控制',acceptance:'权限变更实时生效，预算超标可自动拦截',files:[],assignee:'吴宏超',priority:'高',project:'expense',progress:0,artifacts:[],activity:[]},
  {boardId:'epic-expense-misc',kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-EXPMISC',status:'未开始',title:'多币种与附件优化',desc:'多币种报销、批量导出与附件上传稳定性优化',acceptance:'多币种报销可正常提交审批，附件上传弱网下可重试成功',files:[],assignee:'吴宏超',priority:'高',project:'expense',progress:0,artifacts:[],activity:[]},
  {boardId:'epic-purchase-order',kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-PURORD',status:'进行中',title:'采购订单管理',desc:'采购订单的批量导入与列表筛选能力',acceptance:'批量导入含校验与错误行回执，列表筛选按供应商准确命中',files:[],assignee:'李工',priority:'中',project:'purchase',progress:0,artifacts:[],activity:[]},
  {boardId:'epic-purchase-flow',kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-PURFLOW',status:'未开始',title:'采购流程优化',desc:'采购入库反审核与价格审批链的流程重构',acceptance:'反审核关联校验通过，价格审批按金额分级并留痕',files:[],assignee:'李工',priority:'中',project:'purchase',progress:0,artifacts:[],activity:[]},
  {boardId:'epic-supply-collab',kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-SUPCOLLAB',status:'进行中',title:'供应商协同对接',desc:'供应商门户对接与交期变更消息推送',acceptance:'订单确认与交期回复状态可正确回写，推送失败可重试',files:[],assignee:'赵琳',priority:'低',project:'supply',progress:0,artifacts:[],activity:[]},
  {boardId:'epic-supply-rating',kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-SUPRATE',status:'未开始',title:'供应商评级与档案',desc:'供应商评级定时任务与资质到期提醒',acceptance:'评级任务分片执行不超时，资质到期前可提前提醒',files:[],assignee:'赵琳',priority:'低',project:'supply',progress:0,artifacts:[],activity:[]},
  /* 苍穹应用开发：基于 designer-metamodel 产物的父任务与子任务 */
  {boardId:'epic-cosmic-property',kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-COSPROP',status:'进行中',title:'属性元模型抽取与集成',desc:'从 bos-metadata jar 离线抽取 839 条属性 style 记录（708 个属性名），建立属性→编辑器类型→取值域→序列化形状的完整契约',acceptance:'属性元模型覆盖 708 个属性名与 34 个模型类型，编辑器类型与取值域可查',files:[],assignee:'冯远',priority:'高',project:'cosmic-app-dev',progress:0,artifacts:[],activity:[]},
  {boardId:'epic-cosmic-operation',kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-COSOP',status:'进行中',title:'操作元模型抽取与集成',desc:'扫描 5300+ jar 提取 256 个操作类型、92 个预置操作、174 个业务规则类型与 33 个校验器类型，建立操作目录与参数形状',acceptance:'操作注册表完整，参数形状可查，操作可配置',files:[],assignee:'冯远',priority:'高',project:'cosmic-app-dev',progress:0,artifacts:[],activity:[]},
  {boardId:'epic-cosmic-rule',kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-COSRULE',status:'进行中',title:'规则与动作引擎',desc:'集成 32 个规则动作类型，实现 FormRule 完整序列化形状与规则编排引擎',acceptance:'规则动作可编排，序列化形状符合平台契约',files:[],assignee:'宋宇',priority:'中',project:'cosmic-app-dev',progress:0,artifacts:[],activity:[]},
  {boardId:'epic-cosmic-editor',kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-COSEDIT',status:'进行中',title:'设计器编辑器集成',desc:'9 类编辑器派发规则、150 个 btnedit 复杂属性写入路由与 100 个转换器注册表集成',acceptance:'编辑器派发正确，复杂属性可写入，转换器可查',files:[],assignee:'许诺',priority:'高',project:'cosmic-app-dev',progress:0,artifacts:[],activity:[]},
  {boardId:'epic-cosmic-crosscheck',kind:'epic',parentTaskId:null,type:'特性',source:'项目规划',sourceId:'FEAT-COSXC',status:'进行中',title:'应用开发契约校验',desc:'与 app-build 属性契约交叉比对，集成 545 条扩展属性锁定规则，标记元模型与端点缺口',acceptance:'契约差异可检测，属性锁定规则生效，缺口有记录',files:[],assignee:'宋宇',priority:'中',project:'cosmic-app-dev',progress:0,artifacts:[],activity:[]},
  {type:'需求',size:'大',source:'Jira',sourceId:'COSMIC-001',exec:'专家团',status:'已完成',collab:'人人协作',title:'属性元模型抽取脚本开发',desc:'从 bos-metadata-8.0.jar 离线抽取 839 条属性 style 记录，覆盖 708 个属性名与 34 个模型类型的资源继承链',assignee:'冯远',progress:100,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-property'},
  {type:'任务',size:'大',source:'Jira',sourceId:'COSMIC-002',exec:'专家团',status:'进行中',collab:'Agent间协作',title:'复杂属性形状解析与写入路由映射',desc:'解析 150 个 btnedit 属性的 ide_* 参数表单与转换器，建立 setComplexProperty 写入路由表',assignee:'许诺',progress:55,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-property'},
  {type:'任务',size:'中',source:'TAPD',sourceId:'COSMIC-003',exec:'专家团',status:'进行中',collab:'人Agent协作',title:'编辑器值形状校验规则实现',desc:'实现 checkbox/combo/text/integer/ecombo/dimension/mcombo/color/btnedit 共 9 类编辑器的设计器提交形状与校验规则',assignee:'郑凯',progress:38,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-property'},
  {type:'改进',size:'小',source:'对话自建',sourceId:'CNV-COSMIC-01',exec:'自动执行',status:'待评审',collab:'人Agent协作',title:'属性取值域随模型类型变化处理',desc:'37 个属性的取值域随模型类型变化，需按 DomainModelTypeDefiners 继承链正确解析覆盖关系',assignee:'吴芳',progress:0,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-property'},
  {type:'需求',size:'中',source:'Jira',sourceId:'COSMIC-004',exec:'专家团',status:'未开始',collab:'人人协作',title:'扩展表单属性锁定规则集成',desc:'集成 545 条扩展表单属性锁定规则（lock 341 / unlock 160 / speciallock 44），支持按扩展控件类型筛选',assignee:'待分配',progress:0,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-property'},
  {type:'Bug',size:'小',source:'TAPD',sourceId:'COSMIC-BUG-01',exec:'自动执行',status:'已完成',collab:'无需协作',title:'Visible 属性取值域类型修正',desc:'Visible 是 mcombo 而非 boolean，Invisible/Hidden 为 checkbox，修正属性元模型取值域类型标注',assignee:'钱涛',progress:100,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-property'},
  {type:'需求',size:'大',source:'Jira',sourceId:'COSMIC-005',exec:'专家团',status:'已完成',collab:'人人协作',title:'操作类型注册表扫描与集成',desc:'扫描 mservice/lib 与 mservice-cosmic/lib 下 5300+ jar，提取 256 个操作类型（20 个云）与 92 个平台预置操作',assignee:'冯远',progress:100,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-operation'},
  {type:'任务',size:'大',source:'Jira',sourceId:'COSMIC-006',exec:'专家团',status:'进行中',collab:'Agent间协作',title:'操作参数形状抽取与映射',desc:'抽取 66 个操作/校验 Java 类的序列化槽位，建立 38 条操作类型→参数类官方映射',assignee:'许诺',progress:62,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-operation'},
  {type:'任务',size:'小',source:'API',sourceId:'API-COSMIC-01',exec:'自动执行',status:'已完成',collab:'无需协作',title:'平台预置操作清单集成',desc:'集成 92 个平台预置操作实例，支持按模型类型筛选可用操作',assignee:'郑凯',progress:100,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-operation'},
  {type:'需求',size:'中',source:'Jira',sourceId:'COSMIC-007',exec:'专家团',status:'进行中',collab:'人人协作',title:'操作业务规则类型目录构建',desc:'集成 174 个操作业务规则类型，含 RunClass 与 SettingFormId 映射，支持操作挂载业务规则',assignee:'宋宇',progress:45,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-operation'},
  {type:'任务',size:'小',source:'TAPD',sourceId:'COSMIC-008',exec:'专家团',status:'待评审',collab:'人Agent协作',title:'校验器类型注册表构建',desc:'集成 33 个校验器类型，含 OpWhiteList/OpBlackList 与 ErrorLevel 配置',assignee:'陈晨',progress:0,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-operation'},
  {type:'Bug',size:'大',source:'Jira',sourceId:'COSMIC-BUG-02',exec:'专家团',status:'已失败',collab:'Agent间协作',title:'操作参数 Complex 注解支持修复',desc:'Operation.Parameter 是 @ComplexPropertyAttribute，现有抽取器只认 Simple/Collection 两种注解，需补充第三种注解支持',assignee:'孙明',progress:0,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-operation'},
  {type:'需求',size:'中',source:'Jira',sourceId:'COSMIC-009',exec:'专家团',status:'已完成',collab:'人人协作',title:'规则动作类型清单集成',desc:'集成 32 个规则动作类型，含由字节码注解得到的序列化槽位',assignee:'蒋雯',progress:100,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-rule'},
  {type:'任务',size:'大',source:'Jira',sourceId:'COSMIC-010',exec:'专家团',status:'进行中',collab:'人人协作',title:'FormRule 序列化形状实现',desc:'实现 FormRule 完整形状（RuleType/ExtProps/Id/Seq/Description/Enabled/RET/PreDescription/PreCondition/TriggerField/TrueActions[]/FalseActions[]）',assignee:'宋宇',progress:50,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-rule'},
  {type:'Bug',size:'小',source:'TAPD',sourceId:'COSMIC-BUG-03',exec:'自动执行',status:'已完成',collab:'无需协作',title:'LockFieldAction 序列化形状修复',desc:'LockFieldAction 序列化形状应为 Fields:List<FieldId> + GroupName/RET/Description/ActionType/Id/Seq',assignee:'郑凯',progress:100,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-rule'},
  {type:'Bug',size:'小',source:'TAPD',sourceId:'COSMIC-BUG-04',exec:'自动执行',status:'已完成',collab:'无需协作',title:'SummaryToField 四槽位结构实现',desc:'修复 SummaryToField 为四槽位 {FieldId,FieldKey,FieldName,SumType:int}，字符串写法结构性不生效',assignee:'钱涛',progress:100,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-rule'},
  {type:'需求',size:'大',source:'Jira',sourceId:'COSMIC-011',exec:'专家团',status:'进行中',collab:'Agent间协作',title:'编辑器派发规则集成',desc:'实现 upperFirst(Editor.type)+PropertyEditor 派发规则，支持 9 类编辑器解析与前端组件映射',assignee:'许诺',progress:45,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-editor'},
  {type:'任务',size:'中',source:'Jira',sourceId:'COSMIC-012',exec:'专家团',status:'进行中',collab:'人Agent协作',title:'转换器注册表构建',desc:'集成 100 个转换器与 ide_*→转换器官方注册表，支持复杂属性序列化与反序列化',assignee:'冯远',progress:55,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-editor'},
  {type:'改进',size:'小',source:'对话自建',sourceId:'CNV-COSMIC-02',exec:'自动执行',status:'已完成',collab:'无需协作',title:'设计器只读属性处理',desc:'处理 7 个设计器只读属性（ChildrenPropertyCollection/ExecuteActions/FieldName/JSPlugins/PermissionControl/PermissionDimension/ThumbnailsParam）',assignee:'吴芳',progress:100,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-editor'},
  {type:'Bug',size:'小',source:'TAPD',sourceId:'COSMIC-BUG-05',exec:'自动执行',status:'进行中',collab:'人Agent协作',title:'EntryId 冲突裁决实现',desc:'解决 EntryId 在 property 与 complex shape 间的冲突，按共享规则裁决写入路由',assignee:'郑凯',progress:30,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-editor'},
  {type:'任务',size:'大',source:'Jira',sourceId:'COSMIC-013',exec:'专家团',status:'进行中',collab:'人人协作',title:'与 app-build 属性契约交叉比对',desc:'将元模型与 app-build 的 property-input-index.json 及 property-guides 差异清单输出，标记缺口与冲突',assignee:'宋宇',progress:40,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-crosscheck'},
  {type:'需求',size:'中',source:'飞书',sourceId:'FS-COSMIC-01',exec:'专家团',status:'进行中',collab:'Agent间协作',title:'后端端点探测与缺口分析',desc:'探测 ai-meta 端点可用性，标记元模型证实但端点不存在的属性写入缺口',assignee:'冯远',progress:35,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-crosscheck'},
  {type:'任务',size:'中',source:'TAPD',sourceId:'COSMIC-014',exec:'专家团',status:'待评审',collab:'人Agent协作',title:'前端编辑器提交形状验证',desc:'验证 789 条 style 的设计器提交形状与校验规则，关闭 359 条未证实取值域',assignee:'陈晨',progress:0,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-crosscheck'},
  {type:'改进',size:'小',source:'API',sourceId:'API-COSMIC-02',exec:'自动执行',status:'已完成',collab:'无需协作',title:'两个运行时构建差异记录',desc:'记录 mservice/lib 与 mservice-cosmic/lib 的 bos-metadata jar 字节差异及 3 个差异操作类型',assignee:'钱涛',progress:100,project:'cosmic-app-dev',parentTaskId:'epic-cosmic-crosscheck'}
];

var CV_REVIEW_ARTIFACTS={
0:{tabs:['源代码','技术方案'],content:{
'源代码':'<h1>审批流插件 - 源代码</h1><p>文件: ApprovalFlowPlugin.java</p><pre>public class ApprovalFlowPlugin extends AbstractPlugin {\n  @Override\n  public void execute(ExecutionContext ctx) {\n    ApprovalContext ac = ctx.getApprovalContext();\n    List&lt;ApprovalNode&gt; nodes = ac.getApprovalNodes();\n    for (ApprovalNode node : nodes) {\n      if (node.isTimeout(30, TimeUnit.MINUTES)) {\n        handleTimeout(node, ac);\n        continue;\n      }\n      if (node.getStatus() == NodeStatus.PENDING) {\n        notifyApprover(node);\n      }\n    }\n    // 多级审批流转\n    if (ac.allNodesProcessed()) {\n      ctx.complete();\n    }\n  }\n  private void handleTimeout(ApprovalNode node, ApprovalContext ac) {\n    // 超时自动升级\n    ac.escalateToSuperior(node);\n  }\n}</pre><p>文件: ApprovalFlowService.java</p><pre>public class ApprovalFlowService {\n  public ApprovalResult submit(ExpenseReport report) {\n    ApprovalFlow flow = buildFlow(report);\n    flow.start();\n    return flow.getResult();\n  }\n}</pre>',
'技术方案':'<h1>审批流插件技术方案</h1><h2>1. 概述</h2><p>基于苍穹插件机制实现费用报销多级审批流转，支持串行/并行审批、超时自动升级、异常回退。</p><h2>2. 核心设计</h2><h3>2.1 审批节点模型</h3><table><tr><th>字段</th><th>类型</th><th>说明</th></tr><tr><td>nodeId</td><td>String</td><td>节点唯一标识</td></tr><tr><td>approver</td><td>String</td><td>审批人ID</td></tr><tr><td>status</td><td>Enum</td><td>PENDING/APPROVED/REJECTED</td></tr><tr><td>timeout</td><td>int</td><td>超时时间(分钟)</td></tr></table><h3>2.2 流转规则</h3><ul><li>串行模式：按节点顺序依次审批</li><li>并行模式：同级节点同时审批，全部通过后进入下一级</li><li>超时处理：超过 timeout 分钟自动升级到上级</li></ul><h2>3. 异常处理</h2><ul><li>审批人离职：自动转交代理人</li><li>审批人拒绝：流程回退到发起人</li><li>系统异常：记录日志并发送告警</li></ul>'}},
1:{tabs:['技术方案','需求规格'],content:{
'技术方案':'<h1>多级审批流性能优化方案</h1><h2>1. 性能问题分析</h2><p>当前审批流在 5000+ 并发场景下平均响应时间 > 3s，瓶颈在数据库查询和节点状态同步。</p><h2>2. 优化方案</h2><h3>2.1 缓存优化</h3><ul><li>审批节点状态缓存到 Redis，TTL 5 分钟</li><li>批量查询替代循环单条查询</li></ul><h3>2.2 异步化</h3><ul><li>通知发送改为异步消息队列</li><li>超时检查改为定时任务批量扫描</li></ul><h3>2.3 数据库优化</h3><table><tr><th>优化项</th><th>预计提升</th></tr><tr><td>索引优化</td><td>40%</td></tr><tr><td>分页查询</td><td>30%</td></tr><tr><td>读写分离</td><td>20%</td></tr></table>',
'需求规格':'<h1>需求规格说明书 - PRD</h1><h2>1. 背景与目标</h2><p>随着报销业务量增长，现有审批流在高峰期出现严重性能瓶颈，需要优化以支持千人并发审批。</p><h2>2. 功能需求</h2><h3>2.1 性能指标</h3><ul><li>支持 1000+ 并发审批</li><li>平均响应时间 < 500ms</li><li>99.9% 请求在 1s 内完成</li></ul><h3>2.2 兼容性</h3><ul><li>向下兼容现有审批流配置</li><li>支持灰度发布</li></ul>'}},
2:{tabs:['技术方案','需求规格','源代码'],content:{
'技术方案':'<h1>权限体系重构技术方案 - Spec</h1><h2>1. 设计目标</h2><p>基于 RBAC 模型重构权限体系，实现数据权限与功能权限分离，支持角色继承和细粒度授权。</p><h2>2. 权限模型</h2><h3>2.1 角色层级</h3><table><tr><th>层级</th><th>角色</th><th>权限范围</th></tr><tr><td>L1</td><td>系统管理员</td><td>全部</td></tr><tr><td>L2</td><td>部门管理员</td><td>本部门</td></tr><tr><td>L3</td><td>普通用户</td><td>个人数据</td></tr></table><h3>2.2 权限类型</h3><ul><li>功能权限：菜单、按钮、API 接口</li><li>数据权限：行级、列级过滤</li><li>字段权限：字段可见/可编辑</li></ul>',
'需求规格':'<h1>权限体系重构需求规格</h1><h2>1. 业务背景</h2><p>当前权限体系不支持角色继承，数据权限与功能权限耦合，维护成本高。</p><h2>2. 功能需求</h2><ul><li>支持角色继承，子角色自动继承父角色权限</li><li>数据权限支持行级过滤（按部门/项目）</li><li>支持字段级权限控制</li><li>权限变更实时生效，无需重新登录</li></ul>',
'源代码':'<h1>权限服务 - 源代码</h1><pre>public class PermissionService {\n  public boolean hasPermission(String userId, String resource, String action) {\n    List&lt;Role&gt; roles = roleService.getUserRoles(userId);\n    return roles.stream().anyMatch(r ->\n      r.hasPermission(resource, action) ||\n      (r.getParent() != null && r.getParent().hasPermission(resource, action))\n    );\n  }\n  public DataFilter getDataFilter(String userId, String resource) {\n    List&lt;Role&gt; roles = roleService.getUserRoles(userId);\n    return DataFilterComposer.compose(roles, resource);\n  }\n}</pre>'}},
3:{tabs:['源代码','技术方案'],content:{
'源代码':'<h1>打印模板优化 - 源代码</h1><pre>public class PrintTemplateRenderer {\n  public byte[] render(ExpenseReport report, TemplateConfig config) {\n    Workbook wb = new XSSFWorkbook();\n    Sheet header = wb.createSheet("报销单");\n    // 页眉\n    if (config.hasHeader()) {\n      renderHeader(header, config.getHeader());\n    }\n    // 水印\n    if (config.hasWatermark()) {\n      addWatermark(wb, config.getWatermark());\n    }\n    // 数据行\n    renderRows(header, report.getItems());\n    return wb.getBytes();\n  }\n}</pre>',
'技术方案':'<h1>打印模板优化方案</h1><h2>1. 需求</h2><p>支持自定义页眉页脚、水印、多页打印、Excel 格式输出。</p><h2>2. 技术选型</h2><ul><li>基于 Apache POI 5.x 生成 Excel</li><li>水印通过 Sheet 背景图实现</li><li>页眉页脚通过 HeaderFooter API</li></ul>'}},
4:{tabs:['源代码','单元测试'],content:{
'源代码':'<h1>附件上传 502 修复 - 源代码</h1><pre>public class AttachmentUploadHandler {\n  @Override\n  public UploadResult handle(UploadRequest req) {\n    int maxRetry = 3;\n    for (int i = 0; i &lt; maxRetry; i++) {\n      try {\n        return uploadToStorage(req.getFile());\n      } catch (StorageException e) {\n        if (i == maxRetry - 1) throw e;\n        Thread.sleep(1000 * (i + 1)); // 指数退避\n      }\n    }\n    throw new StorageException("Upload failed after retries");\n  }\n}</pre>',
'单元测试':'<h1>附件上传 - 单元测试报告</h1><h2>测试用例</h2><table><tr><th>用例</th><th>输入</th><th>预期</th><th>结果</th></tr><tr><td>正常上传</td><td>1MB 文件</td><td>成功</td><td>✅ 通过</td></tr><tr><td>弱网重试</td><td>模拟 502</td><td>重试 3 次后成功</td><td>✅ 通过</td></tr><tr><td>超时</td><td>10s 超时</td><td>返回超时错误</td><td>✅ 通过</td></tr><tr><td>空文件</td><td>0 字节</td><td>拒绝上传</td><td>✅ 通过</td></tr></table><p>覆盖率: 95% | 通过: 4/4</p>'}},
5:{tabs:['需求规格','源代码'],content:{
'需求规格':'<h1>需求规格 - 团建费选项</h1><h2>1. 需求描述</h2><p>在费用类型下拉中增加"团建费"选项，归属"部门活动费用"类别。</p><h2>2. 验收标准</h2><ul><li>费用类型下拉列表中可见"团建费"</li><li>选择后归属类别显示为"部门活动费用"</li><li>报销统计报表中可按团建费维度统计</li></ul>'}},
6:{tabs:['需求规格'],content:{
'需求规格':'<h1>多币种报销需求规格 - PRD</h1><h2>1. 业务背景</h2><p>随着国际化业务扩展，员工出差涉及多币种报销，需支持原币金额与本位币金额双重记录。</p><h2>2. 功能需求</h2><h3>2.1 币种管理</h3><ul><li>支持人民币(CNY)、美元(USD)、欧元(EUR)、日元(JPY)、港币(HKD)</li><li>币种汇率每日自动更新，支持手动调整</li></ul><h3>2.2 报销录入</h3><ul><li>选择币种后自动带出当日汇率</li><li>原币金额 + 汇率 = 本位币金额（自动计算，可手动修正）</li><li>同一报销单支持多币种明细行</li></ul><h2>3. 验收标准</h2><table><tr><th>场景</th><th>预期</th></tr><tr><td>单币种报销</td><td>正常提交审批</td></tr><tr><td>多币种混合报销</td><td>按行汇总本位币金额</td></tr><tr><td>汇率手动修正</td><td>记录修正人和修正时间</td></tr></table>'}},
7:{tabs:['测试用例','测试报告','源代码'],content:{
'测试用例':'<h1>费用明细列表页 - 测试用例</h1><h2>测试场景</h2><table><tr><th>用例</th><th>输入</th><th>预期</th><th>优先级</th></tr><tr><td>正常分页查询</td><td>page=1,size=20</td><td>返回 20 条数据</td><td>P0</td></tr><tr><td>大数据量查询</td><td>10000 条数据</td><td>响应 &lt; 500ms</td><td>P0</td></tr><tr><td>模糊搜索</td><td>keyword="差旅"</td><td>返回含"差旅"的记录</td><td>P1</td></tr><tr><td>时间范围筛选</td><td>startDate ~ endDate</td><td>返回范围内数据</td><td>P1</td></tr><tr><td>空结果处理</td><td>查无数据</td><td>显示"暂无数据"</td><td>P2</td></tr><tr><td>权限过滤</td><td>普通用户</td><td>仅返回本人数据</td><td>P0</td></tr></table>',
'测试报告':'<h1>费用明细列表页 - 测试报告</h1><h2>执行结果</h2><table><tr><th>用例</th><th>结果</th><th>备注</th></tr><tr><td>正常分页查询</td><td>✅ 通过</td><td>-</td></tr><tr><td>大数据量查询</td><td>✅ 通过</td><td>平均 280ms</td></tr><tr><td>模糊搜索</td><td>✅ 通过</td><td>-</td></tr><tr><td>时间范围筛选</td><td>✅ 通过</td><td>-</td></tr><tr><td>空结果处理</td><td>✅ 通过</td><td>-</td></tr><tr><td>权限过滤</td><td>❌ 失败</td><td>部门管理员可见下级数据，实际返回空</td></tr></table><p>通过: 5/6 | 覆盖率: 87%</p>',
'源代码':'<h1>费用明细列表页 - 源代码</h1><pre>public class ExpenseDetailListService {\n  public PageResult&lt;ExpenseDetail&gt; query(ExpenseQuery query) {\n    // 权限过滤\n    if (!query.getUser().isAdmin()) {\n      query.setUserId(query.getUser().getId());\n    }\n    // 分页查询\n    return expenseDetailDao.selectByPage(query, query.getPage(), query.getSize());\n  }\n}</pre>'}},
 8:{tabs:['部署方案','运维手册'],content:{
 '部署方案':'<h1>审批流插件部署方案</h1><h2>1. 部署策略</h2><h3>1.1 灰度发布</h3><ul><li>第一阶段：10% 流量灰度，观察 2 小时</li><li>第二阶段：50% 流量，观察 4 小时</li><li>第三阶段：100% 全量发布</li></ul><h3>1.2 回滚方案</h3><ul><li>自动回滚：错误率 &gt; 5% 时自动触发</li><li>手动回滚：一键切换到旧版本</li><li>数据回滚：审批流状态数据不回滚，仅回滚插件代码</li></ul><h2>2. 监控告警</h2><table><tr><th>指标</th><th>阈值</th><th>告警方式</th></tr><tr><td>审批流错误率</td><td>&gt; 1%</td><td>钉钉 + 邮件</td></tr><tr><td>审批响应时间</td><td>&gt; 2s</td><td>钉钉</td></tr><tr><td>审批队列积压</td><td>&gt; 100 条</td><td>钉钉 + 短信</td></tr></table>',
 '运维手册':'<h1>审批流插件 - 运维手册</h1><h2>1. 常用命令</h2><pre># 查看插件状态\nkubectl get pods -l app=approval-flow-plugin\n\n# 查看插件日志\nkubectl logs -f deployment/approval-flow-plugin\n\n# 回滚到上一版本\nkubectl rollout undo deployment/approval-flow-plugin</pre><h2>2. 常见问题</h2><h3>2.1 审批流卡住</h3><ul><li>检查 Redis 连接是否正常</li><li>检查审批节点状态是否为 PENDING</li><li>查看审批超时配置是否生效</li></ul><h3>2.2 性能下降</h3><ul><li>检查数据库索引是否生效</li><li>检查缓存命中率</li><li>查看是否有慢查询</li></ul>'}},
 12:{tabs:['技术方案','源代码'],content:{
 '技术方案':'<h1>复杂属性写入路由方案</h1><h2>1. 背景</h2><p>150 个 btnedit 属性没有标量端点，设计器通过 ide_* 参数表单编辑，写入必须走 setComplexProperty 整体提交。</p><h2>2. 路由设计</h2><h3>2.1 ide_* 表单 → 转换器映射</h3><p>从 PropertyConverterFactory 静态初始化块获取官方注册关系，建立 editorFormId → aliasConverter 映射表。</p><h3>2.2 converterKeys 来源</h3><p>转换器常量池的字符串字面量作为候选键，需实测确认非闭合 schema。</p><h3>2.3 contextSentToEditor</h3><p>部分属性编辑器需要实体元数据上下文（_Type_/Id/ParentId/Key/Name/TableName），写入时需一并传递。</p>',
 '源代码':'<h1>复杂属性路由 - 源代码</h1><pre>public class ComplexPropertyRouter {\n  private static final Map&lt;String,String&gt; FORM_TO_CONVERTER;\n  static {\n    FORM_TO_CONVERTER = PropertyConverterFactory.getRegistry();\n  }\n  public WriteResult setComplexProperty(String entityId, String property, Object payload) {\n    String editorFormId = metamodel.getEditorFormId(property);\n    String converterName = FORM_TO_CONVERTER.get(editorFormId);\n    AliasConverter converter = converterFactory.get(converterName);\n    Object serialized = converter.serialize(payload, metamodel.getContext(entityId));\n    return metaService.write(entityId, property, serialized);\n  }\n}</pre>'}},
 13:{tabs:['技术方案'],content:{
 '技术方案':'<h1>操作参数形状抽取方案</h1><h2>1. 目标</h2><p>从 Java 元数据类抽取 Operation 本体 17 槽位与每种操作一个 *Parameter 值对象的序列化形状。</p><h2>2. 注解处理</h2><p>Operation.Parameter 标注了 @ComplexPropertyAttribute，现有抽取器只认 Simple/Collection 两种注解，需补充第三种。</p><h2>3. 参数类映射</h2><table><tr><th>resolution</th><th>数量</th><th>说明</th></tr><tr><td>new</td><td>34</td><td>分支直接实例化</td></tr><tr><td>static-factory</td><td>2</td><td>print/printexportexcel 走工厂方法</td></tr><tr><td>op-parameter-plugin</td><td>2</td><td>push/pushandsave 运行时插件</td></tr></table><p>56 个带参数表单的云自定义操作不在设计器 switch 中，参数对象由云自带。</p>'}},
 14:{tabs:['源代码','技术方案'],content:{
 '源代码':'<h1>FormRule 序列化 - 源代码</h1><pre>public class FormRuleSerializer {\n  public JsonObject serialize(FormRule rule) {\n    JsonObject obj = new JsonObject();\n    obj.addProperty("RuleType", rule.getRuleType());\n    obj.addProperty("Id", rule.getId());\n    obj.addProperty("Seq", rule.getSeq());\n    obj.addProperty("Description", rule.getDescription());\n    obj.addProperty("Enabled", rule.isEnabled());\n    obj.add("RET", serializeRET(rule.getRET()));\n    obj.add("PreDescription", rule.getPreDescription());\n    obj.add("PreCondition", rule.getPreCondition());\n    obj.addProperty("TriggerField", rule.getTriggerField());\n    obj.add("TrueActions", serializeActions(rule.getTrueActions()));\n    obj.add("FalseActions", serializeActions(rule.getFalseActions()));\n    obj.add("ExtProps", rule.getExtProps());\n    return obj;\n  }\n}</pre>',
 '技术方案':'<h1>FormRule 序列化形状方案</h1><h2>1. 完整槽位</h2><p>RuleType/ExtProps/Id/Seq/Description/Enabled/RET/PreDescription/PreCondition/TriggerField/TrueActions[]/FalseActions[]</p><h2>2. listRules 差异</h2><p>listRules 只回 9 个字段是客户端投影，不是模型上限。序列化时需写入全部 12 个槽位。</p>'}},
 15:{tabs:['源代码','单元测试'],content:{
 '源代码':'<h1>EntryId 冲突裁决 - 源代码</h1><pre>public class EntryIdAdjudicator {\n  public String resolveEntryId(PropertyStyle style, ComplexShape shape) {\n    if (style.hasEntryId() && shape.hasEntryId()) {\n      return sharedRule.getStyleEntryId();\n    }\n    if (style.hasEntryId()) return style.getEntryId();\n    if (shape.hasEntryId()) return shape.getEntryId();\n    return null;\n  }\n}</pre>',
 '单元测试':'<h1>EntryId 冲突裁决 - 单元测试</h1><table><tr><th>用例</th><th>输入</th><th>预期</th><th>结果</th></tr><tr><td>双方都有 EntryId</td><td>style+shape</td><td>取共享规则值</td><td>✅ 通过</td></tr><tr><td>仅 style 有</td><td>style only</td><td>取 style 值</td><td>✅ 通过</td></tr><tr><td>仅 shape 有</td><td>shape only</td><td>取 shape 值</td><td>✅ 通过</td></tr><tr><td>双方都没有</td><td>none</td><td>返回 null</td><td>✅ 通过</td></tr></table><p>覆盖率: 100% | 通过: 4/4</p>'}},
 16:{tabs:['测试用例','测试报告'],content:{
 '测试用例':'<h1>编辑器值形状校验 - 测试用例</h1><h2>测试场景</h2><table><tr><th>编辑器类型</th><th>用例数</th><th>关键场景</th></tr><tr><td>checkbox</td><td>12</td><td>boolean 值域</td></tr><tr><td>combo</td><td>85</td><td>enum-single 取值域</td></tr><tr><td>text</td><td>42</td><td>长度限制</td></tr><tr><td>integer</td><td>28</td><td>数值边界</td></tr><tr><td>ecombo</td><td>35</td><td>enum-multi 取值域</td></tr><tr><td>mcombo</td><td>18</td><td>逗号连接字符串</td></tr><tr><td>dimension</td><td>15</td><td>单位声明</td></tr><tr><td>color</td><td>8</td><td>颜色值格式</td></tr><tr><td>btnedit</td><td>150</td><td>参数表单入参</td></tr></table>',
 '测试报告':'<h1>编辑器值形状校验 - 测试报告</h1><h2>执行结果</h2><table><tr><th>编辑器类型</th><th>通过</th><th>失败</th><th>备注</th></tr><tr><td>checkbox</td><td>12</td><td>0</td><td>-</td></tr><tr><td>combo</td><td>83</td><td>2</td><td>2 条未声明 items</td></tr><tr><td>text</td><td>42</td><td>0</td><td>-</td></tr><tr><td>integer</td><td>28</td><td>0</td><td>-</td></tr><tr><td>ecombo</td><td>35</td><td>0</td><td>-</td></tr><tr><td>mcombo</td><td>18</td><td>0</td><td>-</td></tr><tr><td>dimension</td><td>14</td><td>1</td><td>单位声明缺失</td></tr><tr><td>color</td><td>8</td><td>0</td><td>-</td></tr><tr><td>btnedit</td><td>150</td><td>0</td><td>-</td></tr></table><p>通过: 390/396 | 覆盖率: 98.5%</p>'}}
 };
var CV_REVIEW_COMMENTS={
0:[{author:'李工',avatar:'李',type:'comment',text:'代码结构清晰，但建议将审批超时逻辑抽离为独立的 TimeoutHandler 类，提高可测试性。',time:'今日 14:20'},{author:'陈晨',avatar:'陈',type:'comment',text:'单元测试覆盖了多级审批场景，但缺少异常分支测试（审批人离职、系统异常等）。',time:'今日 15:30'}],
1:[{author:'王工',avatar:'王',type:'comment',text:'缓存方案合理，但需要考虑 Redis 宕机时的降级策略。建议增加本地缓存兜底。',time:'昨日 16:00'},{author:'张工',avatar:'张',type:'pass',text:'方案整体可行，性能指标满足要求。同意推进。',time:'今日 09:15'}],
2:[{author:'王工',avatar:'王',type:'comment',text:'RBAC 模型设计合理，角色继承逻辑需要补充循环依赖检测。',time:'2 天前 10:00'},{author:'陈晨',avatar:'陈',type:'comment',text:'数据权限行级过滤方案需要验证大数据量下的性能。',time:'昨日 14:30'},{author:'李工',avatar:'李',type:'reject',text:'PermissionService.hasPermission 方法在角色链较深时性能有问题，建议增加缓存。',time:'今日 11:00'}],
3:[{author:'陈晨',avatar:'陈',type:'comment',text:'水印实现方案可行，但多页打印时页眉需要每页重复渲染。',time:'3 小时前'}],
4:[{author:'刘洋',avatar:'刘',type:'comment',text:'指数退避策略合理，但建议增加熔断机制，避免连续重试拖垮系统。',time:'1 小时前'}],
5:[{author:'吴芳',avatar:'吴',type:'pass',text:'需求简单明确，实现完整，同意合入。',time:'昨日 14:30'}],
6:[{author:'王工',avatar:'王',type:'comment',text:'多币种需求描述清晰，但汇率自动更新的时间需要明确（每日凌晨还是实时？）',time:'今日 10:00'}],
7:[{author:'李工',avatar:'李',type:'reject',text:'权限过滤用例失败，部门管理员可见下级数据的逻辑有 Bug，需要修复后重新提交。',time:'今日 14:00'},{author:'陈晨',avatar:'陈',type:'comment',text:'测试用例覆盖了主要场景，建议增加并发查询的用例。',time:'今日 15:30'}],
 8:[{author:'王工',avatar:'王',type:'comment',text:'灰度发布策略合理，建议第一阶段缩短到 1 小时。',time:'昨日 16:00'}],
 12:[{author:'冯远',avatar:'冯',type:'comment',text:'converterKeys 作为候选键需要实测确认，建议增加一个最小写入+读回的验证流程。',time:'今日 10:45'},{author:'许诺',avatar:'许',type:'comment',text:'contextSentToEditor 的 entitymeta 上下文字段已覆盖，但 entityrootitem 类型需补充。',time:'今日 11:20'}],
 13:[{author:'王工',avatar:'王',type:'comment',text:'参数类映射的三种成因分析清晰，push/pushandsave 的运行时插件缺口需标注为已知限制。',time:'今日 14:35'},{author:'陈晨',avatar:'陈',type:'pass',text:'方案可行，56 个云自定义操作的缺口有记录。同意推进。',time:'今日 15:00'}],
 14:[{author:'陈晨',avatar:'陈',type:'comment',text:'listRules 客户端投影差异需在文档中明确标注，避免下游误用 9 字段投影。',time:'昨日 16:30'},{author:'李工',avatar:'李',type:'comment',text:'TrueActions/FalseActions 数组序列化需验证空数组与 null 的区分。',time:'今日 09:00'}],
 15:[{author:'张工',avatar:'张',type:'comment',text:'共享规则裁决逻辑清晰，建议补充日志记录裁决来源（style vs shape）。',time:'1 小时前'},{author:'陈晨',avatar:'陈',type:'pass',text:'测试覆盖完整，4/4 通过。同意合入。',time:'30 分钟前'}],
 16:[{author:'陈晨',avatar:'陈',type:'comment',text:'combo 和 dimension 各有失败用例，需修复后重新提交。',time:'今日 11:30'},{author:'郑凯',avatar:'郑',type:'comment',text:'2 条 combo 未声明 items 是设计器源码遗漏，已在 editor-value-shapes 中标记。',time:'今日 12:00'}]
 };

var CV_REVIEWS = [
  {type:'任务',size:'大',source:'Jira',exec:'专家团',priority:'紧急',reviewType:'代码评审',title:'审批流插件代码审查',desc:'审查费用报销审批流的插件实现，包括多级审批流转逻辑和异常处理',reviewer:'王工',reviewerRole:'架构人员',deadline:'今日 18:00',deadlineColor:'var(--danger)',borderColor:'var(--danger)',from:'张工',fromTime:'今日 10:30',artifacts:['源代码','单元测试','技术方案'],project:'expense'},
  {type:'需求',size:'大',source:'Jira',exec:'专家团',priority:'高',reviewType:'方案评审',title:'多级审批流性能优化方案',desc:'当前审批流在多级审批场景下存在性能瓶颈，需要优化审批流转逻辑',reviewer:'王工',reviewerRole:'架构人员',deadline:'明日 12:00',deadlineColor:'var(--warning)',borderColor:'var(--warning)',from:'张工',fromTime:'昨日 16:20',artifacts:['技术方案','需求规格'],project:'expense'},
  {type:'任务',size:'大',source:'Jira',exec:'专家团',priority:'中',reviewType:'方案评审',title:'权限体系重构方案评审',desc:'基于 RBAC 模型重构权限体系，支持角色分级、数据权限和功能权限分离',reviewer:'张工',reviewerRole:'开发人员',deadline:'3 天后',deadlineColor:'var(--dot-blue)',borderColor:'var(--dot-blue)',from:'赵琳',fromTime:'2 天前',artifacts:['技术方案','需求规格','源代码'],project:'expense'},
  {type:'改进',size:'小',source:'对话自建',exec:'自动执行',priority:'中',reviewType:'代码评审',title:'打印模板优化方案评审',desc:'优化报销单打印模板，支持自定义页眉页脚和水印',reviewer:'陈晨',reviewerRole:'测试人员',deadline:'2 天后',deadlineColor:'var(--dot-blue)',borderColor:'var(--dot-blue)',from:'陈晨',fromTime:'3 小时前',artifacts:['源代码','技术方案'],project:'expense'},
  {type:'Bug',size:'小',source:'TAPD',exec:'自动执行',priority:'紧急',reviewType:'代码评审',title:'附件上传 502 修复方案评审',desc:'附件上传在弱网环境下偶发 502 错误的重试机制实现',reviewer:'张工',reviewerRole:'开发人员',deadline:'今日 20:00',deadlineColor:'var(--danger)',borderColor:'var(--danger)',from:'孙明',fromTime:'1 小时前',artifacts:['源代码','单元测试'],project:'expense'},
  {type:'需求',size:'小',source:'对话自建',exec:'自动执行',priority:'低',reviewType:'需求评审',title:'费用类型新增选项评审',desc:'在费用类型下拉中增加团建费选项的实现',reviewer:'吴芳',reviewerRole:'需求人员',deadline:'5 天后',deadlineColor:'var(--success)',borderColor:'var(--dot-blue)',from:'吴芳',fromTime:'昨日 14:00',artifacts:['需求规格','源代码'],project:'expense'},
  {type:'需求',size:'大',source:'Jira',exec:'专家团',priority:'高',reviewType:'需求评审',title:'多币种报销需求规格评审',desc:'支持多币种报销，含汇率转换、原币金额与本位币金额双重记录',reviewer:'赵琳',reviewerRole:'需求人员',deadline:'明日 18:00',deadlineColor:'var(--warning)',borderColor:'var(--warning)',from:'王工',fromTime:'今日 09:00',artifacts:['需求规格'],project:'expense'},
  {type:'任务',size:'大',source:'Jira',exec:'专家团',priority:'中',reviewType:'测试评审',title:'费用明细列表页测试用例评审',desc:'审查费用明细列表页的测试用例覆盖度，包括边界值、异常场景、性能场景',reviewer:'陈晨',reviewerRole:'测试人员',deadline:'3 天后',deadlineColor:'var(--dot-blue)',borderColor:'var(--dot-blue)',from:'李工',fromTime:'昨日 11:00',artifacts:['测试用例','测试报告','源代码'],project:'expense'},
  {type:'任务',size:'中',source:'TAPD',exec:'专家团',priority:'中',reviewType:'部署评审',title:'审批流插件部署方案评审',desc:'审批流插件灰度发布方案，含回滚策略和监控告警配置',reviewer:'周杰',reviewerRole:'运维人员',deadline:'4 天后',deadlineColor:'var(--dot-blue)',borderColor:'var(--dot-blue)',from:'王工',fromTime:'2 天前 15:00',artifacts:['部署方案','运维手册'],project:'expense'},
  {type:'需求',size:'大',source:'Jira',exec:'专家团',priority:'高',reviewType:'方案评审',title:'采购价格审批链重构方案',desc:'按金额分级审批与超阈值自动加签的流程设计，含审批留痕方案',reviewer:'冯远',reviewerRole:'架构人员',deadline:'明日 10:00',deadlineColor:'var(--warning)',borderColor:'var(--warning)',from:'李工',fromTime:'今日 09:20',artifacts:['技术方案','需求规格'],project:'purchase'},
  {type:'Bug',size:'小',source:'TAPD',exec:'自动执行',priority:'中',reviewType:'代码评审',title:'采购入库单反审核校验补充',desc:'反审核关联付款单的校验实现与回归用例',reviewer:'张工',reviewerRole:'开发人员',deadline:'3 天后',deadlineColor:'var(--dot-blue)',borderColor:'var(--dot-blue)',from:'刘洋',fromTime:'今日 11:40',artifacts:['源代码','单元测试'],project:'purchase'},
  {type:'需求',size:'大',source:'飞书',exec:'专家团',priority:'紧急',reviewType:'需求评审',title:'供应商协同门户对接需求规格',desc:'订单确认与交期回复的字段口径、异常处理与状态回写规则',reviewer:'张工',reviewerRole:'开发人员',deadline:'今日 20:00',deadlineColor:'var(--danger)',borderColor:'var(--danger)',from:'冯远',fromTime:'今日 08:50',artifacts:['需求规格','技术方案'],project:'supply'},
  {type:'任务',size:'大',source:'Jira',exec:'专家团',priority:'高',reviewType:'方案评审',title:'复杂属性写入路由方案评审',desc:'150 个 btnedit 属性的 ide_* 参数表单与 setComplexProperty 写入路由设计',reviewer:'冯远',reviewerRole:'架构人员',deadline:'明日 12:00',deadlineColor:'var(--warning)',borderColor:'var(--warning)',from:'许诺',fromTime:'今日 10:30',artifacts:['技术方案','源代码'],project:'cosmic-app-dev'},
  {type:'任务',size:'大',source:'Jira',exec:'专家团',priority:'高',reviewType:'方案评审',title:'操作参数形状抽取方案评审',desc:'66 个操作/校验 Java 类的序列化槽位与 38 条操作类型→参数类映射的设计',reviewer:'王工',reviewerRole:'架构人员',deadline:'明日 18:00',deadlineColor:'var(--warning)',borderColor:'var(--warning)',from:'许诺',fromTime:'今日 14:20',artifacts:['技术方案'],project:'cosmic-app-dev'},
  {type:'任务',size:'中',source:'TAPD',exec:'专家团',priority:'中',reviewType:'代码评审',title:'FormRule 序列化形状实现评审',desc:'FormRule 完整 12 槽位序列化形状与 listRules 客户端投影差异的处理',reviewer:'陈晨',reviewerRole:'测试人员',deadline:'3 天后',deadlineColor:'var(--dot-blue)',borderColor:'var(--dot-blue)',from:'宋宇',fromTime:'昨日 16:00',artifacts:['源代码','技术方案'],project:'cosmic-app-dev'},
  {type:'Bug',size:'小',source:'TAPD',exec:'自动执行',priority:'紧急',reviewType:'代码评审',title:'EntryId 冲突裁决实现评审',desc:'EntryId 在 property 与 complex shape 间冲突的共享规则裁决方案',reviewer:'张工',reviewerRole:'开发人员',deadline:'今日 20:00',deadlineColor:'var(--danger)',borderColor:'var(--danger)',from:'郑凯',fromTime:'2 小时前',artifacts:['源代码','单元测试'],project:'cosmic-app-dev'},
  {type:'任务',size:'中',source:'TAPD',exec:'专家团',priority:'中',reviewType:'测试评审',title:'编辑器值形状校验规则测试评审',desc:'9 类编辑器 789 条 style 的提交形状校验规则覆盖度与边界值测试',reviewer:'陈晨',reviewerRole:'测试人员',deadline:'2 天后',deadlineColor:'var(--dot-blue)',borderColor:'var(--dot-blue)',from:'郑凯',fromTime:'昨日 11:00',artifacts:['测试用例','测试报告'],project:'cosmic-app-dev'}
];

/* 人员基础资料（全局主数据，独立维护）：项目/团队通过 id（pid）引用，不在人员身上挂项目 */
var CV_MEMBERS = [
  {id:'p01',name:'张工',email:'zhang***@kingdee.com',dept:'研发部',workspaceRole:'system_admin',roles:[{tag:'member-tag--dev',text:'开发'},{tag:'member-tag--arch',text:'架构'}],status:'available',source:'直接成员',isMe:true},
  {id:'p02',name:'李工',email:'li***@kingdee.com',dept:'研发部',roles:[{tag:'member-tag--dev',text:'开发'}],status:'available',source:'直接成员'},
  {id:'p03',name:'王工',email:'wang***@kingdee.com',dept:'研发部',roles:[{tag:'member-tag--dev',text:'开发'},{tag:'member-tag--arch',text:'架构'}],status:'busy',source:'直接成员'},
  {id:'p04',name:'赵琳',email:'zha***@kingdee.com',dept:'产品部',workspaceRole:'project_manager',roles:[{tag:'member-tag--pm',text:'需求'},{tag:'member-tag--pm',text:'产品'}],status:'available',source:'继承自 灵基AIOS'},
  {id:'p05',name:'陈晨',email:'chen***@kingdee.com',dept:'测试部',roles:[{tag:'member-tag--qa',text:'测试'}],status:'available',source:'直接成员'},
  {id:'p06',name:'刘洋',email:'liu***@kingdee.com',dept:'测试部',roles:[{tag:'member-tag--qa',text:'测试'}],status:'busy',source:'直接成员'},
  {id:'p07',name:'周杰',email:'zhou***@kingdee.com',dept:'运维部',roles:[{tag:'member-tag--ops',text:'运维'}],status:'available',source:'直接成员'},
  {id:'p08',name:'孙明',email:'sun***@kingdee.com',dept:'运维部',roles:[{tag:'member-tag--ops',text:'运维'}],status:'available',source:'继承自 灵基AIOS'},
  {id:'p09',name:'吴芳',email:'wu***@kingdee.com',dept:'产品部',roles:[{tag:'member-tag--pm',text:'需求'}],status:'available',source:'直接成员'},
  {id:'p10',name:'郑凯',email:'zheng***@kingdee.com',dept:'研发部',roles:[{tag:'member-tag--dev',text:'开发'}],status:'busy',source:'直接成员'},
  {id:'p11',name:'钱涛',email:'qian***@kingdee.com',dept:'研发部',roles:[{tag:'member-tag--dev',text:'开发'}],status:'available',source:'直接成员'},
  {id:'p12',name:'宋宇',email:'song***@kingdee.com',dept:'产品部',roles:[{tag:'member-tag--pm',text:'产品'}],status:'available',source:'继承自 灵基AIOS'},
  {id:'p13',name:'冯远',email:'feng***@kingdee.com',dept:'架构部',roles:[{tag:'member-tag--arch',text:'架构'}],status:'available',source:'直接成员'},
  {id:'p14',name:'许诺',email:'xu***@kingdee.com',dept:'研发部',roles:[{tag:'member-tag--dev',text:'开发'},{tag:'member-tag--arch',text:'架构'}],status:'busy',source:'直接成员'},
  {id:'p15',name:'蒋雯',email:'jiang***@kingdee.com',dept:'产品部',roles:[{tag:'member-tag--pm',text:'需求'},{tag:'member-tag--pm',text:'产品'}],status:'available',source:'继承自 灵基AIOS'},
  {id:'p16',name:'何欣',email:'he***@kingdee.com',dept:'产品部',roles:[{tag:'member-tag--pm',text:'需求'}],status:'available',source:'直接成员'},
  {id:'p17',name:'韩梅',email:'han***@kingdee.com',dept:'测试部',roles:[{tag:'member-tag--qa',text:'测试'}],status:'available',source:'直接成员'},
  {id:'p18',name:'罗静',email:'luo***@kingdee.com',dept:'测试部',roles:[{tag:'member-tag--qa',text:'测试'}],status:'busy',source:'直接成员'},
  {id:'p19',name:'杨帆',email:'yang***@kingdee.com',dept:'运维部',roles:[{tag:'member-tag--ops',text:'运维'}],status:'available',source:'直接成员'},
  {id:'p20',name:'唐辉',email:'tang***@kingdee.com',dept:'运维部',roles:[{tag:'member-tag--ops',text:'运维'}],status:'available',source:'继承自 灵基AIOS'},
  {id:'p21',name:'梁平',email:'liang***@kingdee.com',dept:'产品部',roles:[{tag:'member-tag--pm',text:'产品'},{tag:'member-tag--owner',text:'所有者'}],status:'available',source:'直接成员'},
  {id:'p22',name:'吴宏超',email:'',dept:'产品部',workspaceRole:'system_admin',roles:[],status:'available',source:'演示人员'},
  {id:'p23',name:'吴晓锋',email:'6686612@qq.com',dept:'产品部',workspaceRole:'system_admin',roles:[{tag:'member-tag--pm',text:'产品'},{tag:'member-tag--owner',text:'所有者'}],status:'available',source:'直接成员'},
  {id:'p24',name:'需求',email:'',dept:'产品部',roles:[{tag:'member-tag--pm',text:'需求'}],status:'available',source:'直接成员'},
  {id:'p25',name:'架构',email:'',dept:'架构部',roles:[{tag:'member-tag--arch',text:'架构'}],status:'available',source:'直接成员'},
  {id:'p26',name:'开发',email:'',dept:'研发部',roles:[{tag:'member-tag--dev',text:'开发'}],status:'available',source:'直接成员'},
  {id:'p27',name:'测试',email:'',dept:'测试部',roles:[{tag:'member-tag--qa',text:'测试'}],status:'available',source:'直接成员'},
  {id:'p28',name:'部署',email:'',dept:'运维部',roles:[{tag:'member-tag--ops',text:'部署'}],status:'available',source:'直接成员'},
  /* 团队人员（登录账号=姓名，密码统一 lingee520） */
  {id:'p29',name:'部伟',email:'',dept:'',roles:[],status:'available',source:'直接成员'},
  {id:'p30',name:'张利军',email:'',dept:'',roles:[],status:'available',source:'直接成员'},
  {id:'p31',name:'王育权',email:'',dept:'',roles:[],status:'available',source:'直接成员'},
  {id:'p32',name:'付鹏城',email:'',dept:'',roles:[],status:'available',source:'直接成员'},
  {id:'p33',name:'陈惠琼',email:'',dept:'',roles:[],status:'available',source:'直接成员'},
  {id:'p35',name:'钟伟纯',email:'',dept:'',roles:[],status:'available',source:'直接成员'},
  {id:'p36',name:'刘鉴洲',email:'',dept:'',roles:[],status:'available',source:'直接成员'},
  {id:'p37',name:'陈瑾',email:'',dept:'',roles:[],status:'available',source:'直接成员'},
  {id:'p38',name:'陈来珍',email:'',dept:'',roles:[],status:'available',source:'直接成员'},
  {id:'p39',name:'暴福音',email:'',dept:'',roles:[],status:'available',source:'直接成员'},
  {id:'p40',name:'荆龙刚',email:'',dept:'',roles:[],status:'available',source:'直接成员'},
  {id:'p41',name:'梁平贤',email:'',dept:'',roles:[],status:'available',source:'直接成员'}
];
var CV_SEED_PERSONS=[
  {id:'p24',name:'需求',email:'',dept:'产品部',roles:[{tag:'member-tag--pm',text:'需求'}],status:'available',source:'直接成员'},
  {id:'p25',name:'架构',email:'',dept:'架构部',roles:[{tag:'member-tag--arch',text:'架构'}],status:'available',source:'直接成员'},
  {id:'p26',name:'开发',email:'',dept:'研发部',roles:[{tag:'member-tag--dev',text:'开发'}],status:'available',source:'直接成员'},
  {id:'p27',name:'测试',email:'',dept:'测试部',roles:[{tag:'member-tag--qa',text:'测试'}],status:'available',source:'直接成员'},
  {id:'p28',name:'部署',email:'',dept:'运维部',roles:[{tag:'member-tag--ops',text:'部署'}],status:'available',source:'直接成员'}
];
function cvEnsureSeedPersons(){
  var changed=false;
  CV_SEED_PERSONS.forEach(function(seed){
    if(!CV_MEMBERS.some(function(person){return person.id===seed.id;})){
      CV_MEMBERS.push(Object.assign({},seed));
      changed=true;
    }
  });
  if(changed)cvPersistPersons();
}
/* 团队人员种子：localStorage 恢复人员目录后，补回缺失的团队成员（人员记录不由 UI 删除，幂等安全） */
var CV_TEAM_SEED_IDS=['p29','p30','p31','p32','p33','p35','p36','p37','p38','p39','p40','p41'];
var CV_TEAM_SEED_PERSONS=CV_TEAM_SEED_IDS.map(function(id){return CV_MEMBERS.find(function(person){return person.id===id;});}).filter(Boolean);
function cvEnsureTeamPersons(){
  var changed=false;
  CV_TEAM_SEED_PERSONS.forEach(function(seed){
    var existing=CV_MEMBERS.find(function(person){return person.id===seed.id;});
    if(!existing){
      CV_MEMBERS.push(Object.assign({},seed));
      changed=true;
    }else if(existing.name!==seed.name){
      existing.name=seed.name;
      changed=true;
    }
  });
  /* 名字统一与并入：p23「吴晓峰」改为「吴晓锋」；p34（早期误建的重复记录）并入 p23 */
  var p23=CV_MEMBERS.find(function(person){return person.id==='p23';});
  if(p23&&p23.name==='吴晓峰'){p23.name='吴晓锋';changed=true;}
  var stale=CV_MEMBERS.findIndex(function(person){return person.id==='p34';});
  if(stale>-1){CV_MEMBERS.splice(stale,1);changed=true;}
  CV_PROJECTS.forEach(function(project){
    if(project.owner==='吴晓峰'){project.owner='吴晓锋';changed=true;}
    if(Array.isArray(project.members)&&project.members.includes('p34')){
      project.members=project.members.filter(function(id){return id!=='p34';});
      changed=true;
    }
  });
  if(changed){cvPersistPersons();cvPersistProjects();}
}
function cvWorkspaceMembers(workspace){
  if(!workspace)return [];
  if(Array.isArray(workspace.peopleIds))return workspace.peopleIds;
  return Array.from(new Set(CV_PROJECTS.filter(function(project){return project.workspace===workspace.id;})
    .flatMap(function(project){return project.members||[];})));
}
function cvPeopleInWorkspace(){
  if(!cvWorkspace) return CV_MEMBERS.slice();
  var workspace=cvWorkspaceById(cvWorkspace);
  var ids=cvWorkspaceMembers(workspace);
  return CV_MEMBERS.filter(function(person){return ids.includes(person.id);});
}
function cvWorkspaceRole(person){
  var workspace=cvWorkspaceById(cvWorkspace);
  return workspace?.roles?.[person?.id]||person?.workspaceRole||'member';
}
function cvCanAccessWorkspace(id,name){
  var workspace=cvWorkspaceById(id);
  if(!workspace||!name)return false;
  if(workspace.creatorName===name)return true;
  var person=CV_MEMBERS.find(function(row){return row.name===name;});
  return !!person&&cvWorkspaceMembers(workspace).includes(person.id);
}
function cvAddPersonToWorkspace(person,role){
  var workspace=cvWorkspaceById(cvWorkspace);
  if(!workspace||!person?.id)return false;
  var previous=workspace.peopleIds;
  var previousRoles=workspace.roles;
  var ids=cvWorkspaceMembers(workspace);
  workspace.peopleIds=Array.from(new Set(ids.concat(person.id)));
  workspace.roles={...(workspace.roles||{})};
  if(role)workspace.roles[person.id]=role;
  if(cvPersistWorkspaces())return true;
  workspace.peopleIds=previous;
  workspace.roles=previousRoles;
  return false;
}
function cvCreateWorkspace(name,desc,creator){
  if(!name||!creator?.id)return null;
  var workspace={id:'ws-'+Date.now(),name:name,desc:desc||'',creatorName:creator.name,peopleIds:[creator.id],roles:{[creator.id]:'system_admin'}};
  CV_WORKSPACES.push(workspace);
  if(cvPersistWorkspaces())return workspace;
  CV_WORKSPACES.pop();
  return null;
}
function cvGenProjectCode(project){
  var match=String(project?.repo||'').match(/\/([^/]+?)(?:\.git)?\/?$/);
  return (match?match[1]:String(project?.id||'PROJECT')).replace(/[^a-zA-Z0-9-]/g,'-').toUpperCase();
}

/* ---------- 人员基础资料：引用与查询 ---------- */
function cvPersonById(id){
  if(!id)return null;
  for(var i=0;i<CV_MEMBERS.length;i++){ if(CV_MEMBERS[i].id===id||CV_MEMBERS[i].userId===id||(CV_MEMBERS[i].linkedUserIds||[]).includes(id)) return CV_MEMBERS[i]; }
  return null;
}
function cvPersonName(id){ var p=cvPersonById(id); return p?p.name:'已移除'; }
/* 当前登录用户姓名（演示数据按登录账号挂钩，不再写死某个人） */
function cvCurrentUserName(){
  try{ var n=(document.getElementById('userName')||{}).textContent||''; return n.trim(); }catch(e){ return ''; }
}
function cvIsMe(p){ return !!(p && p.name && p.name===cvCurrentUserName()); }
/* 当前项目（或「全部项目」）引用的协作人员，人员管理跟着项目走 */
function cvProjectPersons(){
  if(!cvProject) return CV_MEMBERS.slice();
  var proj=cvProjectById(cvProject);
  var ids=proj?(proj.members||[]):[];
  return CV_MEMBERS.filter(function(m){ return ids.indexOf(m.id)>=0; });
}
function cvPeopleInProject(project){
  var ids=project&&Array.isArray(project.members)?project.members:[];
  return CV_MEMBERS.filter(function(person){return ids.includes(person.id);});
}
var CV_PERSON_STORE_KEY='lingee-collab-persons-v1';
function cvPersistPersons(){
  try{ localStorage.setItem(CV_PERSON_STORE_KEY,JSON.stringify(CV_MEMBERS)); return true; }catch(e){return false;}
}
function cvRestorePersons(){
  try{
    var raw=localStorage.getItem(CV_PERSON_STORE_KEY); if(!raw) return;
    var arr=JSON.parse(raw);
    if(Array.isArray(arr)&&arr.length){ CV_MEMBERS.length=0; arr.forEach(function(m){if(!m.workspaceRole&&m.id==='p01')m.workspaceRole='system_admin';if(!m.workspaceRole&&m.id==='p04')m.workspaceRole='project_manager';CV_MEMBERS.push(m);}); }
    cvMergeDuplicateCurrentUser();
  }catch(e){}
}
/* 旧版演示数据曾按不同登录标识重复加入同一账号，统一回 p22 并保留外部 ID 映射。 */
function cvMergeDuplicateCurrentUser(){
  var matches=CV_MEMBERS.filter(function(person){return person.name==='吴宏超';});
  if(!matches.length)return;
  var primary=matches.find(function(person){return person.id==='p22';})||matches[0];
  if(matches.length===1&&primary.id==='p22')return;
  var oldIds=matches.map(function(person){return person.id;});
  var aliases=new Set();
  matches.forEach(function(person){
    [person.id,person.userId].concat(person.linkedUserIds||[]).filter(Boolean).forEach(function(id){aliases.add(id);});
    if(!primary.phone&&person.phone)primary.phone=person.phone;
    if(!primary.email&&person.email)primary.email=person.email;
  });
  var linked=matches.find(function(person){return person.email==='wuhc2023@gmail.com'&&person.userId;})||matches.find(function(person){return person.userId;});
  if(!primary.userId&&linked)primary.userId=linked.userId;
  primary.id='p22';
  primary.workspaceRole='system_admin';
  primary.linkedUserIds=Array.from(aliases).filter(function(id){return id!=='p22'&&id!==primary.userId;});
  CV_MEMBERS.splice(0,CV_MEMBERS.length,...CV_MEMBERS.filter(function(person){return person===primary||person.name!=='吴宏超';}));
  var projectsChanged=false;
  CV_PROJECTS.forEach(function(project){
    var ids=project.members||[];
    var next=Array.from(new Set(ids.map(function(id){return oldIds.includes(id)?'p22':id;})));
    if(next.length!==ids.length||next.some(function(id,index){return id!==ids[index];})){project.members=next;projectsChanged=true;}
  });
  cvPersistPersons();
  if(projectsChanged)cvPersistProjects();
}

/* 项目增改落 localStorage，刷新页面不丢（持久化与数据同源，放这里避免模块循环依赖） */
var CV_PROJ_STORE_KEY='lingee-collab-projects-v2';
var CV_DELETED_PROJECTS_KEY='lingee-collab-deleted-projects-v1';
function cvDeletedProjectIds(){
  try{var ids=JSON.parse(localStorage.getItem(CV_DELETED_PROJECTS_KEY)||'[]');return Array.isArray(ids)?ids.filter(function(id){return typeof id==='string';}):[];}catch(e){return [];}
}
function cvDeleteProjectRecord(id){
  var index=CV_PROJECTS.findIndex(function(project){return project.id===id;});
  if(index<0)return false;
  var previousProjects=localStorage.getItem(CV_PROJ_STORE_KEY);
  var previousDeleted=localStorage.getItem(CV_DELETED_PROJECTS_KEY);
  var nextProjects=CV_PROJECTS.filter(function(project){return project.id!==id;});
  var nextDeleted=Array.from(new Set(cvDeletedProjectIds().concat(id)));
  try{
    localStorage.setItem(CV_DELETED_PROJECTS_KEY,JSON.stringify(nextDeleted));
    localStorage.setItem(CV_PROJ_STORE_KEY,JSON.stringify(nextProjects));
  }catch(e){
    try{if(previousDeleted===null)localStorage.removeItem(CV_DELETED_PROJECTS_KEY);else localStorage.setItem(CV_DELETED_PROJECTS_KEY,previousDeleted);}catch(_){}
    try{if(previousProjects===null)localStorage.removeItem(CV_PROJ_STORE_KEY);else localStorage.setItem(CV_PROJ_STORE_KEY,previousProjects);}catch(_){}
    return false;
  }
  CV_PROJECTS.splice(index,1);
  return true;
}
function cvPersistProjects(){
  try{ localStorage.setItem(CV_PROJ_STORE_KEY,JSON.stringify(CV_PROJECTS)); return true; }catch(e){return false;}
}
function cvRestoreProjects(){
  cvRestoreWorkspaces();
  try{
    var raw=localStorage.getItem(CV_PROJ_STORE_KEY);
    var arr=raw?JSON.parse(raw):CV_PROJECTS.slice();
    if(Array.isArray(arr)){var deleted=new Set(cvDeletedProjectIds());CV_PROJECTS.length=0;arr.forEach(function(p){if(deleted.has(p.id))return;if(!p.code)p.code=cvGenProjectCode(p);CV_PROJECTS.push(p);}); }
  }catch(e){}
}
/* 旧缓存覆盖源码预置数组时，只增补一次新样例，不覆盖已编辑项目，也不反复复活已删除样例。 */
function cvEnsureWorkspaceDemoProjects(){
  var key='lingee-collab-workspace-demos-v2';
  try{if(localStorage.getItem(key))return;}catch(e){}
  var changed=false;
  CV_WORKSPACE_DEMO_PROJECTS.forEach(function(sample){
    if(cvDeletedProjectIds().includes(sample.id))return;
    if(!cvWorkspaceById(sample.workspace))return;
    if(CV_PROJECTS.some(function(project){return project.id===sample.id;}))return;
    CV_PROJECTS.push({...sample,members:sample.members.slice()});
    changed=true;
  });
  if(changed&&!cvPersistProjects())return;
  try{localStorage.setItem(key,'1');}catch(e){}
}
/* 本地原型没有服务端事务：先计算并写入所有快照，失败时回滚；内存最后才更新。 */
function cvDeleteWorkspaceData(id){
  var workspace=cvWorkspaceById(id);
  if(!workspace||id!==cvWorkspace)return {ok:false};
  var projectIds=CV_PROJECTS.filter(function(project){return project.workspace===id;}).map(function(project){return project.id;});
  var removed=new Set(projectIds);
  var nextWorkspaces=CV_WORKSPACES.filter(function(row){return row.id!==id;});
  var nextProjects=CV_PROJECTS.filter(function(row){return row.workspace!==id;});
  var nextTasks=CV_TASKS.filter(function(row){return !removed.has(row.project);});
  var keys=[CV_DELETED_WORKSPACE_KEY,CV_WORKSPACE_STORE_KEY,CV_PROJ_STORE_KEY,CV_ACTIVE_WORKSPACE_KEY,'lingee_task_board_v1','build_tasks','lingee-collab-integrations-v1','lingee-collab-config-audit-v1'];
  var previous={};
  try{
    keys.forEach(function(key){previous[key]=localStorage.getItem(key);});
    var readRows=function(key){var value=JSON.parse(previous[key]||'[]');if(!Array.isArray(value))throw new Error('Invalid '+key);return value;};
    var changes={};
    changes[CV_DELETED_WORKSPACE_KEY]=JSON.stringify(Array.from(new Set(cvDeletedWorkspaceIds().concat(id))));
    changes[CV_WORKSPACE_STORE_KEY]=JSON.stringify(nextWorkspaces);
    changes[CV_PROJ_STORE_KEY]=JSON.stringify(nextProjects);
    changes[CV_ACTIVE_WORKSPACE_KEY]='';
    changes['lingee_task_board_v1']=JSON.stringify(readRows('lingee_task_board_v1').filter(function(row){return !removed.has(row.project);}));
    changes['build_tasks']=JSON.stringify(readRows('build_tasks').filter(function(row){return !removed.has(row.project);}));
    changes['lingee-collab-integrations-v1']=JSON.stringify(readRows('lingee-collab-integrations-v1').filter(function(row){return (row.workspace||'ws-build')!==id;}));
    changes['lingee-collab-config-audit-v1']=JSON.stringify(readRows('lingee-collab-config-audit-v1').filter(function(row){return (row.workspace||'ws-build')!==id;}));
    var written=[];
    try{keys.forEach(function(key){localStorage.setItem(key,changes[key]);written.push(key);});}
    catch(error){written.reverse().forEach(function(key){try{if(previous[key]===null)localStorage.removeItem(key);else localStorage.setItem(key,previous[key]);}catch(e){}});throw error;}
  }catch(e){return {ok:false};}
  CV_WORKSPACES.splice(0,CV_WORKSPACES.length,...nextWorkspaces);
  CV_PROJECTS.splice(0,CV_PROJECTS.length,...nextProjects);
  CV_TASKS.splice(0,CV_TASKS.length,...nextTasks);
  projectIds.forEach(function(projectId){delete cvConfigOverride[projectId];});
  cvProject='';cvWorkspace='';
  return {ok:true,projectIds:projectIds};
}
/* 预置数据由源码加载；已删除的工作区不应在下次打开时重新生成任务。 */
function cvPruneDeletedWorkspaceData(){
  var deleted=new Set(cvDeletedWorkspaceIds());
  var seedIds=new Set(CV_SEED_PROJECT_SNAPSHOT.map(function(p){return p.id;}));
  for(var i=CV_PROJECTS.length-1;i>=0;i--){
    if(deleted.has(CV_PROJECTS[i].workspace)&&!seedIds.has(CV_PROJECTS[i].id))CV_PROJECTS.splice(i,1);
  }
  var valid=new Set(CV_PROJECTS.map(function(project){return project.id;}));
  for(var j=CV_TASKS.length-1;j>=0;j--)if(!valid.has(CV_TASKS[j].project))CV_TASKS.splice(j,1);
}
function cvEnsureProjectRoleDemoData(){
  var key='lingee-collab-project-role-demos-v1';
  try{if(localStorage.getItem(key))return;}catch(e){}
  var person=CV_MEMBERS.find(function(row){return row.name==='吴宏超';});
  if(!person){
    var personId='p22';
    if(CV_MEMBERS.some(function(row){return row.id===personId;}))personId='p-demo-wuhc';
    person={id:personId,name:'吴宏超',email:'',dept:'产品部',workspaceRole:'system_admin',roles:[],status:'available',source:'演示人员'};
    CV_MEMBERS.push(person);cvPersistPersons();
  }
  var changed=false;
  CV_ROLE_DEMO_PROJECTS.forEach(function(sample){
    if(cvDeletedProjectIds().includes(sample.id))return;
    if(!cvWorkspaceById(sample.workspace))return;
    var existing=CV_PROJECTS.find(function(project){return project.id===sample.id;});
    if(existing){
      if(person.id!=='p22'&&Array.isArray(existing.members)&&existing.members.includes('p22')){
        existing.members=existing.members.map(function(id){return id==='p22'?person.id:id;});
        changed=true;
      }
      return;
    }
    CV_PROJECTS.push({...sample,members:sample.members.map(function(id){return id==='p22'?person.id:id;})});
    changed=true;
  });
  if(changed)cvPersistProjects();
  try{localStorage.setItem(key,'1');}catch(e){}
}
/* 对已保存的演示项目执行一次成员补齐；之后由项目成员管理正常维护。 */
function cvEnsureCurrentUserProjectDemoData(){
  var key='lingee-collab-current-user-projects-v1';
  try{if(localStorage.getItem(key))return;}catch(e){}
  var person=CV_MEMBERS.find(function(row){return row.id==='p22'&&row.name==='吴宏超';});
  if(!person)return;
  var changed=false;
  CV_PROJECTS.forEach(function(project){
    if(!Array.isArray(project.members))project.members=[];
    if(!project.members.includes(person.id)){project.members.push(person.id);changed=true;}
  });
  var ownedCount=CV_PROJECTS.filter(function(project){return project.owner===person.name;}).length;
  ['expense','demo-contract'].forEach(function(id){
    if(ownedCount>=2)return;
    var project=CV_PROJECTS.find(function(row){return row.id===id;});
    if(project&&project.owner!==person.name){project.owner=person.name;ownedCount++;changed=true;}
  });
  if(changed)cvPersistProjects();
  try{localStorage.setItem(key,'1');}catch(e){}
}

/* 一次性补齐：把团队人员加入 Lingee Build 项目成员，姓名账号登录后可见该项目；之后由项目成员管理正常维护 */
function cvEnsureTeamProjectMembers(){
  var key='lingee-collab-team-project-members-v1';
  try{if(localStorage.getItem(key))return;}catch(e){}
  var changed=false;
  var project=CV_PROJECTS.find(function(row){return row.id==='lingee-prototype';});
  if(project){
    if(!Array.isArray(project.members))project.members=[];
    CV_TEAM_SEED_PERSONS.filter(function(seed){return seed.id!=='p30';}).forEach(function(seed){
      if(!project.members.includes(seed.id)){project.members.push(seed.id);changed=true;}
    });
    if(changed)cvPersistProjects();
  }
  try{localStorage.setItem(key,'1');}catch(e){}
}
/* 旧演示种子曾自动给张利军授予 Lingee Build 成员资格；撤销该默认授权一次。 */
export function cvRemoveZhangAutoProjectMember(){
  var key='lingee-collab-zhang-project-access-v1';
  try{if(localStorage.getItem(key))return;}catch(e){}
  var project=CV_PROJECTS.find(function(row){return row.id==='lingee-prototype';});
  if(project&&Array.isArray(project.members)&&project.members.includes('p30')){
    project.members=project.members.filter(function(id){return id!=='p30';});
    if(!cvPersistProjects())return;
  }
  try{localStorage.setItem(key,'1');}catch(e){}
}

/* 一次性清理：Lingee Build 项目任务数据已整体去除，同步清掉本地保存的任务与看板快照。 */
export function cvRemoveLingeePrototypeTasks(){
  var key='lingee-collab-remove-lingee-tasks-v1';
  try{if(localStorage.getItem(key))return;}catch(e){}
  ['lingee_task_board_v1','build_tasks'].forEach(function(storeKey){
    try{
      var rows=JSON.parse(localStorage.getItem(storeKey)||'null');
      if(!Array.isArray(rows))return;
      var next=rows.filter(function(row){return row&&row.project!=='lingee-prototype';});
      if(next.length!==rows.length)localStorage.setItem(storeKey,JSON.stringify(next));
    }catch(e){ /* 快照损坏时跳过该键 */ }
  });
  try{localStorage.setItem(key,'1');}catch(e){}
}

var CV_WORKFLOW = ['需求分析','方案设计','开发实现','代码审查','测试验证','部署发布'];
var CV_WORKFLOW_ROLES = {'需求分析':'需求人员','方案设计':'架构人员','开发实现':'开发人员','代码审查':'开发人员','测试验证':'测试人员','部署发布':'运维人员'};
var CV_THIRD_PARTY_MEMBERS=[
  {name:'钱涛',email:'qian***@kingdee.com',role:'开发',tag:'member-tag--dev',dept:'研发部'},
  {name:'宋宇',email:'song***@kingdee.com',role:'开发',tag:'member-tag--dev',dept:'研发部'},
  {name:'冯远',email:'feng***@kingdee.com',role:'架构',tag:'member-tag--arch',dept:'架构部'},
  {name:'许诺',email:'xu***@kingdee.com',role:'开发',tag:'member-tag--dev',dept:'研发部'},
  {name:'韩梅',email:'han***@kingdee.com',role:'测试',tag:'member-tag--qa',dept:'测试部'},
  {name:'罗静',email:'luo***@kingdee.com',role:'测试',tag:'member-tag--qa',dept:'测试部'},
  {name:'杨帆',email:'yang***@kingdee.com',role:'运维',tag:'member-tag--ops',dept:'运维部'},
  {name:'唐辉',email:'tang***@kingdee.com',role:'运维',tag:'member-tag--ops',dept:'运维部'},
  {name:'蒋雯',email:'jiang***@kingdee.com',role:'需求',tag:'member-tag--pm',dept:'产品部'},
  {name:'何欣',email:'he***@kingdee.com',role:'需求',tag:'member-tag--pm',dept:'产品部'},
  {name:'梁平',email:'liang***@kingdee.com',role:'产品',tag:'member-tag--pm',dept:'产品部'},
  {name:'范晨',email:'fan***@kingdee.com',role:'开发',tag:'member-tag--dev',dept:'研发部'},
  {name:'董睿',email:'dong***@kingdee.com',role:'架构',tag:'member-tag--arch',dept:'架构部'},
  {name:'贾旭',email:'jia***@kingdee.com',role:'测试',tag:'member-tag--qa',dept:'测试部'},
  {name:'武威',email:'wu***@kingdee.com',role:'运维',tag:'member-tag--ops',dept:'运维部'}
];

function cvRenderTaskStats(){
  renderTaskSummary();
}
function cvRenderTasks(){
  renderTaskBoard();
}

function cvBuildTaskCard(t,i){
  var typeCls={'需求':'badge-type','Bug':'badge-bug','任务':'badge-task','改进':'badge-improve'}[t.type]||'badge-type';
  var sizeCls=t.size==='大'?'badge-size-l':'badge-size-s';
  var srcCls={'Jira':'source-tag--jira','TAPD':'source-tag--tapd','对话自建':'source-tag--build','API':'source-tag--api','飞书':'source-tag--feishu'}[t.source]||'source-tag--build';
  var execCls=t.exec==='专家团'?'badge-expert':'badge-auto';
  var statusMap={'未开始':'pending','待评审':'review','进行中':'running','已完成':'done','已失败':'fail'};
  var sc=statusMap[t.status]||'pending';
  var nodeMap={'未开始':'需求分析','待评审':'代码审查','进行中':'开发实现','已完成':'部署发布','已失败':'开发实现'};
  var node=nodeMap[t.status]||'需求分析';
  return '<div class="card" data-type="'+t.type+'" data-status="'+t.status+'" data-collab="'+t.collab+'" data-size="'+t.size+'" data-idx="'+i+'">'
    +'<div class="card-top"><div class="card-row">'
    +'<span class="badge '+typeCls+'">'+t.type+'</span>'
    +'<span class="badge '+sizeCls+'">'+t.size+'</span>'
    +'<span class="source-tag '+srcCls+'">'+t.source+'</span>'
    +'<span class="badge-status badge-status--'+sc+'"><span class="badge-status-dot"></span>'+t.status+'</span>'
    +cvProjectTag(t)
    +'</div><span class="badge '+execCls+'">'+t.exec+'</span></div>'
    +'<div class="card-title">'+t.title+'</div>'
    +'<div class="card-desc">'+t.desc+'</div>'
    +'<div class="card-footer"><div class="assignee"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'+t.assignee+'</div><span style="font-size:11px;color:var(--text-soft)">'+t.source+' '+t.sourceId+'</span></div>'
    +'</div>';
}
function cvRenderReviewStats(){
  var el=document.getElementById('cv-review-stats');if(!el)return;
  var rows=CV_REVIEWS.filter(cvInProject);
  var urgent=rows.filter(function(r){return r.priority==='紧急';}).length;
  var mine=rows.filter(function(r){return r.from==='张工';}).length;
  var assigned=rows.filter(function(r){return r.reviewer==='张工';}).length;
  var stats=[
    {num:rows.length,label:'待评审',color:'var(--warning)',filter:'全部待评审'},
    {num:urgent,label:'即将到期',color:'var(--danger)',filter:'紧急'},
    {num:mine,label:'我发起的',color:'var(--dot-blue)',filter:'我发起的'},
    {num:assigned,label:'分配给我',color:'var(--success)',filter:'分配给我的'}
  ];
  el.innerHTML=stats.map(function(s){
    return '<div class="stat" onclick="cvClickReviewStat(this,\''+s.filter+'\')"><div class="stat-num" style="color:'+s.color+'">'+s.num+'</div><div class="stat-label">'+s.label+'</div></div>';
  }).join('');
}
function cvRenderReviews(){
  var grid=document.getElementById('cv-review-grid');if(!grid)return;
  grid.innerHTML=CV_REVIEWS.map(function(r,i){return cvInProject(r)?cvBuildReviewCard(r,i):'';}).join('');
  if(!grid.innerHTML) grid.innerHTML='<div class="x-empty">该项目下没有待评审的内容</div>';
}
function cvBuildReviewCard(r,i){
  var typeCls={'需求':'badge-type','Bug':'badge-bug','任务':'badge-task','改进':'badge-improve'}[r.type]||'badge-type';
  var sizeCls=r.size==='大'?'badge-size-l':'badge-size-s';
  var srcCls={'Jira':'source-tag--jira','TAPD':'source-tag--tapd','对话自建':'source-tag--build','API':'source-tag--api','飞书':'source-tag--feishu'}[r.source]||'source-tag--build';
  var artHtml=r.artifacts.map(function(a){return '<span class="review-artifact">'+a+'</span>';}).join(' · ');
  return '<div class="card" data-idx="'+i+'" onclick="cvOpenReviewDetail('+i+')">'
    +'<div class="card-top"><div class="card-row">'
    +'<span class="badge '+typeCls+'">'+r.type+'</span>'
    +'<span class="badge '+sizeCls+'">'+r.size+'</span>'
    +'<span class="source-tag '+srcCls+'">'+r.source+'</span>'
    +'<span class="badge-status badge-status--review"><span class="badge-status-dot"></span>待评审</span>'
    +cvProjectTag(r)
    +'</div><span class="badge badge-expert">'+r.exec+'</span></div>'
    +'<div class="card-title">'+r.title+'</div>'
    +'<div class="card-desc">'+r.desc+'</div>'
    +'<div class="review-info">'
    +'<div class="review-info-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>评审人: <b>'+r.reviewer+'</b> <span>('+r.reviewerRole+')</span></div>'
    +'<div class="review-info-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="'+r.deadlineColor+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>截止: <b style="color:'+r.deadlineColor+'">'+r.deadline+'</b></div>'
    +'<div class="review-info-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>产物: '+artHtml+'</div>'
    +'</div>'
    +'<div class="card-actions"><span class="card-node"><span class="card-node-dot"></span>'+r.reviewType+'</span><div style="display:flex;gap:4px;margin-left:auto">'
    +'<button class="act-btn act-btn--exec" onclick="event.stopPropagation();cvReviewPass('+i+')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>通过</button>'
    +'<button class="act-btn act-btn--reject" onclick="event.stopPropagation();cvReviewReject('+i+')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>驳回</button>'
    +'<button class="card-view-btn" onclick="event.stopPropagation();cvOpenReviewDetail('+i+')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>查看对话</button>'
    +'</div></div></div>';
}
function cvInjectCardActions(){
  if(document.getElementById('tb-layout')) return;
  document.querySelectorAll('#cv-task-grid .card').forEach(function(card){
    if(card.querySelector('.card-actions'))return;
    var idx=parseInt(card.getAttribute('data-idx'));
    var t=CV_TASKS[idx];if(!t)return;
    var status=t.status;
    var nodeMap={'未开始':'需求分析','待评审':'代码审查','进行中':'开发实现','已完成':'部署发布','已失败':'开发实现'};
    var node=nodeMap[status]||'需求分析';
    var execBtn='<button class="act-btn act-btn--exec" onclick="event.stopPropagation();window.cvCard=this.closest(\'.card\');cvOpenTaskModal(\'cv-exec-overlay\')" title="执行任务"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 9-14 9V3z"/></svg>执行</button>';
    var transferBtn='<button class="act-btn act-btn--transfer" onclick="event.stopPropagation();window.cvCard=this.closest(\'.card\');cvOpenTaskModal(\'cv-transfer-overlay\')" title="转交任务"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>转交</button>';
    var twistBtn='<button class="act-btn act-btn--twist" onclick="event.stopPropagation();window.cvCard=this.closest(\'.card\');cvOpenTaskModal(\'cv-twist-overlay\')" title="流转任务"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.5 2.7"/><polyline points="21 3 21 9 15 9"/></svg>流转</button>';
    var reviewBtn='<button class="act-btn act-btn--review" onclick="event.stopPropagation();window.cvCard=this.closest(\'.card\');cvOpenTaskModal(\'cv-review-overlay\')" title="发起评审"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>评审</button>';
    var viewBtn='<button class="card-view-btn" onclick="event.stopPropagation();cvOpenConversation(this.closest(\'.card\'))" title="查看对话"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>查看对话</button>';
    var btns='';
    if(status==='未开始'){btns=execBtn+transferBtn+twistBtn+reviewBtn;}
    else if(status==='待评审'){btns=reviewBtn+viewBtn;}
    else{btns=viewBtn;card.classList.add('card--clickable');card.onclick=function(e){if(!e.target.closest('.act-btn')&&!e.target.closest('.card-view-btn'))cvOpenConversation(card);};}
    var ad=document.createElement('div');ad.className='card-actions';
    ad.innerHTML='<span class="card-node"><span class="card-node-dot"></span>'+node+'</span><div style="display:flex;gap:4px;margin-left:auto">'+btns+'</div>';
    card.appendChild(ad);
    if(status==='进行中'){}
  });
}

/* cvProject 由其它模块写回；import 绑定只读，所以走这个 setter */
export function set_cvProject(v){ cvProject=v; return v; }
/* cvWorkspace 由其它模块写回；import 绑定只读，所以走这个 setter */
export function set_cvWorkspace(v){ cvWorkspace=v; return v; }

/* ---------- 产物中心：交付物按项目沉淀（左项目右清单，跟着项目走）
   单文件产物用 file（带后缀名）；代码类产物是目录，用 files 列多个文件 ---------- */
var CV_ARTIFACTS=[
  {name:'采购订单列表页',file:'采购订单列表页.html',typeCls:'art-type--doc',typeLabel:'网页',src:'采购订单批量导入',date:'2026-09-21 14:20',project:'purchase'},
  {name:'审批流插件源代码',typeCls:'art-type--code',typeLabel:'代码',src:'审批流插件代码审查',date:'2026-09-21 10:05',project:'expense',files:['ApprovalFlowPlugin.java','ApprovalFlowService.java','ApprovalContext.java','ExpenseReport.java','ApprovalFlowPluginTest.java','plugin.xml','README.md']},
  {name:'多币种报销需求规格',file:'多币种报销需求规格.md',typeCls:'art-type--doc',typeLabel:'文档',src:'多币种报销需求规格评审',date:'2026-09-20 16:30',project:'expense'},
  {name:'费用明细测试用例集',file:'费用明细测试用例集.xlsx',typeCls:'art-type--test',typeLabel:'用例',src:'费用明细列表页测试用例评审',date:'2026-09-19 11:00',project:'expense'},
  {name:'审批流插件部署方案',file:'审批流插件部署方案.md',typeCls:'art-type--plan',typeLabel:'方案',src:'审批流插件部署方案评审',date:'2026-09-19 09:40',project:'expense'},
  {name:'采购订单开放接口定义',file:'采购订单开放接口定义.yaml',typeCls:'art-type--api',typeLabel:'接口',src:'供应商协同门户对接',date:'2026-09-18 15:12',project:'supply'},
  {name:'属性元模型抽取报告',file:'property-metamodel.json',typeCls:'art-type--code',typeLabel:'代码',src:'属性元模型抽取脚本开发',date:'2026-09-10 14:20',project:'cosmic-app-dev',files:['property-metamodel.json','property-by-model-type.json','element-property-map.json','extraction-report.json']},
  {name:'复杂属性形状与写入路由',file:'complex-property-shapes.json',typeCls:'art-type--code',typeLabel:'代码',src:'复杂属性形状解析与写入路由映射',date:'2026-09-15 10:05',project:'cosmic-app-dev',files:['complex-property-shapes.json','complex-property-routes.json','alias-converters.json']},
  {name:'编辑器值形状校验规则',file:'editor-value-shapes.json',typeCls:'art-type--code',typeLabel:'代码',src:'编辑器值形状校验规则实现',date:'2026-09-16 11:30',project:'cosmic-app-dev'},
  {name:'操作元模型注册表',file:'operation-metamodel.json',typeCls:'art-type--code',typeLabel:'代码',src:'操作类型注册表扫描与集成',date:'2026-09-12 16:00',project:'cosmic-app-dev',files:['operation-metamodel.json','operation-shapes.json']},
  {name:'扩展属性锁定规则',file:'extension-locked-properties.json',typeCls:'art-type--doc',typeLabel:'文档',src:'扩展表单属性锁定规则集成',date:'2026-09-14 09:30',project:'cosmic-app-dev'},
  {name:'app-build 契约交叉比对',file:'appbuild-crosscheck.json',typeCls:'art-type--doc',typeLabel:'文档',src:'与 app-build 属性契约交叉比对',date:'2026-09-18 14:00',project:'cosmic-app-dev'},
  {name:'规则动作类型清单',file:'rule-action-types.json',typeCls:'art-type--doc',typeLabel:'文档',src:'规则动作类型清单集成',date:'2026-09-13 15:00',project:'cosmic-app-dev'}
];

/* ============================================================
   演示数据：为种子任务补齐「交付产物 / 评审 / 动态」
   种子任务原本没有这三块字段，这里按任务类型与状态补一份可展示的演示数据；
   只补缺失项（undefined / 空数组），不覆盖新建任务里用户操作产生的真实数据。
   ============================================================ */
var CV_ARTIFACT_BY_TYPE={
  '需求':['需求规格说明书.md','验收标准.md','交互原型.html'],
  'Bug':['问题定位报告.md','修复补丁.java','回归测试报告.md'],
  '任务':['技术方案.md','实现代码.java','部署说明.md'],
  '改进':['优化方案.md','改动说明.md','验证报告.md']
};
function cvSeedArtifacts(t){
  var pool=CV_ARTIFACT_BY_TYPE[t.type]||CV_ARTIFACT_BY_TYPE['任务'];
  if(t.status==='待规划'||t.status==='待办'||t.status==='已阻塞'||t.status==='已取消') return [];
  var n=t.status==='已完成'?pool.length:(t.status==='进行中'?1:2);
  return pool.slice(0,n).map(function(name){ return {name:name,stageId:STAGES[0].id,content:'# '+name+'\n\n本地演示产物\n\n任务：'+t.title+'\n任务目标：'+(t.desc||'未填写')+'\n\n此内容用于原型预览，尚未关联实际交付文件。'}; });
}
function cvSeedActivity(t){
  var owner=(t.assignee==='待分配')?'张工':t.assignee;
  var act=[{author:'张工',text:'创建了任务'}];
  if(t.status!=='待规划'&&t.status!=='待办') act.push({author:owner,text:'开始执行任务'});
  if(t.status==='进行中') act.push({author:owner,text:'正在推进实现，当前进度 '+(t.progress||0)+'%'});
  if(t.status==='审核中') act.push({author:owner,text:'提交产出，发起评审'});
  if(t.status==='已完成') act.push({author:'陈晨',text:'评审通过，任务完成'});
  if(t.status==='已阻塞') act.push({author:owner,text:'执行失败，等待人工介入'});
  return act;
}
function cvSeedReviewArtifacts(t){
  return (t.artifacts||[]).map(function(a,i){
    var name=(typeof a==='string')?a:a.name;
    var ver=(typeof a==='string')?'当前版本':(a.version||'当前版本');
    return {id:'ra-'+i,name:name,version:ver};
  });
}
function cvSeedReviewer(t){
  if(t.type==='需求') return '赵琳';
  if(t.type==='Bug') return '张工';
  if(t.type==='改进') return '陈晨';
  return '王工';
}
function cvSeedReviews(t){
  var rt={'需求':'需求评审','Bug':'代码评审','任务':'方案评审','改进':'代码评审'}[t.type]||'代码评审';
  var stageId=STAGES[0].id; /* 种子任务的 t.stage 每次加载都会被重置为第一个环节，评审也挂在同一环节上，保持时间线一致 */
  if(t.status==='审核中'){
    return [{id:'seed-rv-'+t.sourceId+'-1',stageId:stageId,type:rt,round:1,status:'pending',reviewer:cvSeedReviewer(t),requestedBy:'张工',deadline:'2026-09-25',createdAt:'2026-09-22 10:30',artifacts:cvSeedReviewArtifacts(t),subject:{title:t.title,desc:t.desc||'',acceptance:t.acceptance||''},decisions:[]}];
  }
  if(t.status==='进行中'){
    return [{id:'seed-rv-'+t.sourceId+'-1',stageId:stageId,type:'方案评审',round:1,status:'approved',reviewer:'王工',requestedBy:'张工',deadline:'2026-09-19',createdAt:'2026-09-18 15:00',artifacts:cvSeedReviewArtifacts(t),subject:{title:t.title,desc:t.desc||'',acceptance:t.acceptance||''},decisions:[{by:'王工',action:'approve',comment:'方案可行，进入实现。',at:'2026-09-19 10:00'}]}];
  }
  if(t.status==='已完成'){
    return [{id:'seed-rv-'+t.sourceId+'-1',stageId:stageId,type:'代码评审',round:1,status:'approved',reviewer:cvSeedReviewer(t),requestedBy:'张工',deadline:'2026-09-20',createdAt:'2026-09-20 14:00',artifacts:cvSeedReviewArtifacts(t),subject:{title:t.title,desc:t.desc||'',acceptance:t.acceptance||''},decisions:[{by:cvSeedReviewer(t),action:'approve',comment:'实现完整，符合验收标准。',at:'2026-09-20 16:20'}]},{id:'seed-rv-'+t.sourceId+'-2',stageId:stageId,type:'交付评审',round:1,status:'approved',reviewer:'陈晨',requestedBy:'张工',deadline:'2026-09-22',createdAt:'2026-09-22 09:00',artifacts:cvSeedReviewArtifacts(t),subject:{title:t.title,desc:t.desc||'',acceptance:t.acceptance||''},decisions:[{by:'陈晨',action:'approve',comment:'交付产物齐全，通过。',at:'2026-09-22 11:00'}]}];
  }
  return [];
}
/* 自愈迁移：状态枚举改版（未开始/待评审/已失败 -> 待办/审核中/已阻塞），
   把种子数据和 localStorage 里的旧状态值统一换成新枚举，随每次加载自动修正。 */
var CV_STATUS_MIGRATION={'未开始':'待办','待评审':'审核中','已失败':'已阻塞'};
function cvMigrateTaskStatus(t){
  var next=CV_STATUS_MIGRATION[t.status];
  if(next) t.status=next;
}
/* 自愈迁移：把历史遗留在 localStorage 里的「AI开发Agent」占位负责人换成实际的人，
   不管缓存是哪个版本写入的，每次加载都会自动修正，不需要用户手动清缓存。 */
function cvMigrateAgentAssignee(t){
  if(t.assignee && !['AI开发Agent','待分配'].includes(t.assignee)) return;
  var proj=CV_PROJECTS.find(function(p){return p.id===t.project;});
  var members=((proj&&proj.members)||[]).map(cvPersonById).filter(Boolean);
  var pool=members.length?members:CV_MEMBERS;
  var seed=String(t.sourceId||t.boardId||t.title||'').split('').reduce(function(a,c){return a+c.charCodeAt(0);},0);
  t.assignee=(t.stagePlan||[]).find(function(sp){return sp.id===t.stage&&sp.assignee&&sp.assignee!=='待分配';})?.assignee||pool[seed%pool.length].name;
}
function cvSeedTaskDetails(){
  CV_TASKS.forEach(function(t){
    t.kind=t.kind||'task';
    t.boardId=t.boardId||('task-'+String(t.project||'none')+'-'+String(t.sourceId||Date.now()).replace(/[^a-zA-Z0-9_-]/g,'-'));
    delete t.teamId;
    cvMigrateTaskStatus(t);
    cvMigrateAgentAssignee(t);
    (t.stagePlan||[]).forEach(function(sp){ if(!sp.assignee||sp.assignee==='待分配') sp.assignee=t.assignee; });
    if(t.artifacts===undefined) t.artifacts=cvSeedArtifacts(t);
    if(t.activity===undefined||!t.activity.length) t.activity=cvSeedActivity(t);
    if(t.reviews===undefined) t.reviews=cvSeedReviews(t);
    /* 老版演示产物只有文件名，保留名称并补明确标记的预览内容。 */
    t.artifacts=(t.artifacts||[]).map(function(a){
      if(typeof a!=='string'||!Object.values(CV_ARTIFACT_BY_TYPE).some(function(names){return names.includes(a);})) return a;
      return {name:a,stageId:(t.reviews||[]).find(function(r){return (r.artifacts||[]).some(function(x){return x.name===a;});})?.stageId||t.stagePlan?.[0]?.id||STAGES[0].id,content:'# '+a+'\n\n本地演示产物\n\n任务：'+t.title+'\n任务目标：'+(t.desc||'未填写')+'\n\n此内容用于原型预览，尚未关联实际交付文件。'};
    });
  });
}

/* 自愈：确保 Lingee Build项目在 localStorage 恢复后仍然存在 */
var CV_PROJ_SEED_LINGEE={id:'lingee-prototype',name:'Lingee Build',desc:'高保真交互原型与协作开发平台建设',goal:'构建 Lingee 高保真原型，支持协作开发、任务管理与专家协作全流程',dot:'green',defaultTeam:'cosmic-app-dev',status:'in_progress',priority:'高',owner:'吴晓锋',repo:'https://github.com/kingdee/lingee-prototype',start:'2026-07-01',end:'2026-12-31',milestones:[{name:'需求与设计定稿',date:'2026-08-01'},{name:'核心功能开发',date:'2026-10-15'},{name:'联调测试',date:'2026-11-30'},{name:'上线交付',date:'2026-12-31'}],members:['p01','p02','p03','p04','p05','p06','p07','p08','p09','p10','p11','p12','p13','p14','p15','p16','p17','p18','p19','p20','p21','p22','p23','p29','p31','p32','p33','p35','p36','p37','p38','p39','p40','p41'],workspace:'ws-build'};
function cvEnsureLingeePrototypeData(){
  if(cvDeletedProjectIds().includes('lingee-prototype'))return;
  var changed=false;
  var existing=CV_PROJECTS.find(function(p){return p.id==='lingee-prototype';});
  if(!existing){
    CV_PROJECTS.push(Object.assign({},CV_PROJ_SEED_LINGEE,{members:CV_PROJ_SEED_LINGEE.members.slice()}));
    changed=true;
  }
  if(changed)cvPersistProjects();
}

/* 自愈：确保苍穹应用开发项目在 localStorage 恢复后仍然存在 */
var CV_PROJ_SEED_COSMIC={id:'cosmic-app-dev',name:'苍穹应用开发',desc:'基于苍穹设计器元模型的应用开发平台，覆盖属性、操作与规则元模型驱动开发',goal:'建设苍穹应用开发平台，基于设计器属性元模型与操作元模型实现元数据驱动的表单开发、操作配置与规则编排',dot:'blue',defaultTeam:'cosmic-app-dev',status:'in_progress',priority:'高',owner:'吴晓锋',repo:'https://github.com/kingdee/cosmic-app-dev',start:'2026-08-01',end:'2026-12-31',milestones:[{name:'元模型抽取完成',date:'2026-09-15'},{name:'属性操作集成',date:'2026-10-31'},{name:'规则引擎上线',date:'2026-11-30'},{name:'平台验收发布',date:'2026-12-31'}],members:['p23','p29','p30','p31','p22','p32','p33','p35','p36','p37','p38','p39','p40'],workspace:'ws-app'};
function cvEnsureCosmicAppDevData(){
  if(cvDeletedProjectIds().includes('cosmic-app-dev'))return;
  var changed=false;
  var existing=CV_PROJECTS.find(function(p){return p.id==='cosmic-app-dev';});
  if(!existing){
    CV_PROJECTS.push(Object.assign({},CV_PROJ_SEED_COSMIC,{members:CV_PROJ_SEED_COSMIC.members.slice()}));
    changed=true;
  }else if(existing.members.join(',')!==CV_PROJ_SEED_COSMIC.members.join(',')){
    /* 成员名单随种子数据演化：localStorage 恢复出旧名单时同步为最新成员 */
    existing.members=CV_PROJ_SEED_COSMIC.members.slice();
    changed=true;
  }
  if(changed)cvPersistProjects();
}

/* 通用自愈：localStorage 恢复后，补回未被明确删除的种子项目。 */
function cvEnsureSeedProjects(){
  var changed=false;
  var deleted=new Set(cvDeletedProjectIds());
  CV_SEED_PROJECT_SNAPSHOT.forEach(function(seed){
    if(deleted.has(seed.id))return;
    if(!CV_PROJECTS.find(function(p){return p.id===seed.id;})){
      CV_PROJECTS.push(Object.assign({},seed,{members:seed.members.slice(),milestones:seed.milestones.map(function(m){return Object.assign({},m);})}));
      changed=true;
    }
  });
  if(changed)cvPersistProjects();
}

/* 恢复内置工作区：从删除列表中移除内置工作区 ID，并补回缺失的内置工作区 */
function cvEnsureSeedWorkspaces(){
  var seedIds=CV_SEED_WORKSPACE_SNAPSHOT.map(function(w){return w.id;});
  var current=cvDeletedWorkspaceIds();
  var cleaned=current.filter(function(id){return !seedIds.includes(id);});
  if(cleaned.length!==current.length){
    try{localStorage.setItem(CV_DELETED_WORKSPACE_KEY,JSON.stringify(cleaned));}catch(e){}
  }
  CV_SEED_WORKSPACE_SNAPSHOT.forEach(function(seed){
    if(!cvWorkspaceById(seed.id))CV_WORKSPACES.push(Object.assign({},seed));
  });
}

export { CV_MEMBERS, CV_PROJECTS, CV_ARTIFACTS, CV_REVIEWS, CV_REVIEW_ARTIFACTS, CV_REVIEW_COMMENTS, CV_TASKS, CV_THIRD_PARTY_MEMBERS, CV_WORKFLOW, CV_WORKFLOW_ROLES, CV_WORKSPACES, cvAddPersonToWorkspace, cvCanAccessWorkspace, cvConfigOverride, cvCreateWorkspace, cvCurrentUserName, cvDeleteProjectRecord, cvDeleteWorkspaceData, cvEnsureCosmicAppDevData, cvEnsureCurrentUserProjectDemoData, cvEnsureTeamPersons, cvEnsureTeamProjectMembers, cvEnsureLingeePrototypeData, cvEnsureProjectRoleDemoData, cvEnsureSeedPersons, cvEnsureSeedProjects, cvEnsureSeedWorkspaces, cvEnsureWorkspaceDemoProjects, cvGenProjectCode, cvInProject, cvInjectCardActions, cvIsMe, cvPeopleInProject, cvPeopleInWorkspace, cvPersistPersons, cvPersistProjects, cvPersistWorkspaces, cvPersonById, cvPersonName, cvProject, cvProjectById, cvProjectInWorkspace, cvProjectName, cvProjectPersons, cvPruneDeletedWorkspaceData, cvRenderReviewStats, cvRenderReviews, cvRenderTaskStats, cvRenderTasks, cvRestorePersons, cvRestoreProjects, cvRestoreWorkspaces, cvSeedTaskDetails, cvWorkspace, cvWorkspaceById, cvWorkspaceName, cvWorkspaceRole };
