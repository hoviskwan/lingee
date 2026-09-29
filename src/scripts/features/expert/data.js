/* 专家 / 专家团：内置数据、能力项字典、开工输入
   拆分自 src/scripts/main.js，逻辑逐行保留；副作用集中在下方 init* 函数里，
   由 main.js 按拆分前的原始顺序调用。 */

/* ============================================================
   专家 / 专家团
   数据取自 lingee-build/packages/opencode/builtin-experts/
   技能名取自 packages/opencode/builtin-skills/
   ============================================================ */
import _av01 from '../../../assets/avatars/avatar-01.png';
import _av02 from '../../../assets/avatars/avatar-02.png';
import _av03 from '../../../assets/avatars/avatar-03.png';
import _av04 from '../../../assets/avatars/avatar-04.png';
import _av05 from '../../../assets/avatars/avatar-05.png';
import _av06 from '../../../assets/avatars/avatar-06.png';
import _av07 from '../../../assets/avatars/avatar-07.png';
import _av08 from '../../../assets/avatars/avatar-08.png';
import _av09 from '../../../assets/avatars/avatar-09.png';
import _av10 from '../../../assets/avatars/avatar-10.png';
import _av11 from '../../../assets/avatars/avatar-11.png';
import _av12 from '../../../assets/avatars/avatar-12.png';
var EXPERT_AV = {
  lead:_av01, pm:_av02, arch:_av03, eng:_av04, qa:_av05,
  cr:_av06, sec:_av07, ana:_av08, fe:_av09, ux:_av10,
  form:_av11, flow:_av12, rpt:_av01, plug:_av02, api:_av03
};
function xav(k){ return EXPERT_AV[k] || _av01; }
function xesc(v){ return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}); }

/* 技能是专家可直接调用的工作方法；详情页用中文名与描述展示，机器 id 只用于内部绑定。 */
var SKILL_META={
  'delivery-planner':{name:'交付规划',desc:'拆解交付目标、范围、分工与验收门禁，形成可追踪的执行计划。',tone:'blue'},
  'integration-review':{name:'集成收口',desc:'汇总各角色产物与验证证据，判断交付是否可关闭或需升级风险。',tone:'green'},
  'requirements-design':{name:'需求设计',desc:'把用户目标整理成有边界、有优先级且可执行的需求清单。',tone:'orange'},
  'task-creator':{name:'任务创建',desc:'通过对话确认项目、任务类型和执行计划，创建可执行的任务。',tone:'blue'},
  'acceptance-criteria':{name:'验收标准设计',desc:'为需求补齐可观察、可测量、可回归的验收条件。',tone:'green'},
  'architecture-design':{name:'系统架构设计',desc:'设计系统边界、数据流、接口契约与失败处理方案。',tone:'purple'},
  'implementation-planning':{name:'实现计划',desc:'把架构方案拆成可编码、可验证、有依赖关系的开发任务。',tone:'blue'},
  'cosmic-app-builder':{name:'苍穹应用开发',desc:'围绕苍穹表单、流程、报表、插件与开放接口交付企业应用。',tone:'cyan'},
  'general-app-builder':{name:'通用应用开发',desc:'从需求到实现和验证，交付可运行的 Web 或业务应用。',tone:'green'},
  'site-builder':{name:'网站交付',desc:'构建完整网站、业务门户或内部工具，并完成响应式适配。',tone:'blue'},
  'test-design':{name:'测试设计',desc:'按风险设计功能、异常、边界与端到端验收场景。',tone:'orange'},
  'regression-verification':{name:'回归验证',desc:'执行构建、接口与用例验证，输出带证据的质量结论。',tone:'green'},
  'code-review':{name:'代码评审',desc:'检查实现正确性、并发安全、契约落实与可维护性风险。',tone:'purple'},
  'threat-modeling':{name:'威胁建模',desc:'识别信任边界，演练滥用、竞态与绕过路径，给出安全风险判定。',tone:'red'},
  'codebase-analysis':{name:'代码库分析',desc:'在不修改工作区的前提下追踪实现路径，给出有边界的证据结论。',tone:'gray'},
  'cosmic-kwc-builder':{name:'KWC 组件开发',desc:'按金蝶前端规范实现可复用组件、交互与响应式布局。',tone:'cyan'},
  'frontend-design':{name:'前端设计实现',desc:'从信息层级、排版、间距与交互反馈出发，实现有意图的界面。',tone:'purple'},
  'prototype-builder':{name:'交互原型设计',desc:'把产品需求转成可点击、可走查、可交付开发的高保真原型。',tone:'orange'},
  'cosmic-requirements-spec':{name:'苍穹需求规格',desc:'将业务需求转成苍穹单据、字段、权限与配置规格。',tone:'cyan'},
  'cosmic-form-builder':{name:'苍穹表单搭建',desc:'配置单据字段、校验、联动、布局和字段级权限。',tone:'green'},
  'cosmic-workflow-builder':{name:'苍穹工作流',desc:'设计并调试审批链、条件流转、加签、会签与异常节点。',tone:'purple'},
  'cosmic-report-builder':{name:'苍穹报表搭建',desc:'设计报表数据模型、取数口径、图表展示与查询性能优化。',tone:'orange'},
  'cosmic-reverse-engineering':{name:'苍穹二开分析',desc:'定位扩展点、插件注册与生命周期，支持二开实现与排障。',tone:'purple'},
  'cosmic-api-integration':{name:'苍穹接口集成',desc:'完成开放接口契约、鉴权、数据映射、幂等同步与异常重试。',tone:'cyan'}
};
function skillInfo(id){ return SKILL_META[id]||{name:id,desc:'该技能已挂载，暂无补充说明。',tone:'gray'}; }
function skillCatalog(){
  return Object.keys(SKILL_META).map(function(id){
    var skill=skillInfo(id);
    return {id:id,name:skill.name,desc:skill.desc,tone:skill.tone};
  });
}

var EXPERTS=[
  {id:'software-team-lead',k:'lead',name:'软件团队负责人',role:'交付负责人',by:'Lingee 内置',
   desc:'协调范围、分工、集成、风险与交付闭环，是专家团里唯一能开 kickoff 与做最终集成确认的角色。',
   tags:['交付管理','团队协调'],modes:['分析','设计','集成','评审','验证','恢复'],
   comp:['delivery.orchestration · principal','delivery.integration · advanced'],
   skills:['delivery-planner','integration-review'],
   cmds:[['帮我把[交付目标]拆成范围、非目标和验收门禁','闭合范围，明确谁负责、做到什么算完'],
         ['这次交付复盘一下，还有哪些残余风险','汇总各角色证据，给出关闭或升级建议']]},
  {id:'software-product-manager',k:'pm',name:'软件产品经理',role:'产品经理',by:'Lingee 内置',
   desc:'把用户目标翻译成有优先级、可观察的需求与验收条件。',
   tags:['需求分析','验收设计'],modes:['分析','设计','评审'],
   comp:['product.requirements · principal','product.acceptance-design · advanced'],
   skills:['requirements-design','acceptance-criteria','task-creator'],
   cmds:[['把[用户目标]拆成一份带验收条件的清单','把目标整理成有范围、可验收的需求'],
         ['帮我给这些需求补齐验收标准','补上可观察、可验证的验收条件'],
         ['这次哪些事不做？帮我列一下非目标','明确边界，防止范围蔓延']]},
  {id:'software-architect',k:'arch',name:'软件架构师',role:'软件架构师',by:'Lingee 内置',
   desc:'设计可演进的系统边界、合同、数据流与失败处理，产出架构文档与可执行的实现计划。',
   tags:['软件架构','可靠性'],modes:['分析','设计','集成','评审','恢复'],
   comp:['architecture.system-design · principal','architecture.reliability · advanced'],
   skills:['architecture-design','implementation-planning'],
   cmds:[['按[需求]设计系统的边界、合同和失败处理','从需求产出可演进的架构方案与迁移路径'],
         ['这几个方案怎么选？帮我做技术选型','按质量属性评估备选方案并记录取舍'],
         ['把架构拆成可以直接开工的实现计划','产出带可执行验证命令的编码任务图']]},
  {id:'software-engineer',k:'eng',name:'软件工程师',role:'软件工程师',by:'Lingee 内置',
   desc:'实现可维护的软件变更并完成针对性验证，只改授权范围内的代码。',
   tags:['软件实现','系统集成'],modes:['分析','设计','实现','集成','验证','恢复'],
   comp:['engineering.implementation · advanced','engineering.integration · advanced'],
   skills:['cosmic-app-builder','general-app-builder','site-builder'],
   cmds:[['按[验收条件]把功能实现出来','完成最小完整变更并跑通验证'],
         ['这个 bug 帮我复现并修掉','定位根因、修复并补回归测试'],
         ['做一个单页小工具，一次写完','小应用一次性写完全部代码 + build 验证']]},
  {id:'software-qa-engineer',k:'qa',name:'软件测试工程师',role:'质量工程师',by:'Lingee 内置',
   desc:'独立验证验收行为、回归影响与交付风险，给出基于证据的质量结论。',
   tags:['质量保障','独立验证'],modes:['分析','设计','评审','验证'],
   comp:['quality.verification · principal','quality.regression-analysis · advanced'],
   skills:['test-design','regression-verification'],
   cmds:[['针对[变更说明]出一份验证计划','按风险模型设计验收与回归场景'],
         ['帮我端到端跑一遍，看看能不能过','实际跑 build、请求与用例并留存证据'],
         ['这个版本能发吗？给个质量结论','给出 pass / pass-with-risk / fail 与理由']]},
  {id:'code-reviewer',k:'cr',name:'代码评审专家',role:'实现代码评审',by:'Lingee 内置',ro:true,
   desc:'独立评审实现代码的正确性、并发安全与合同落实情况，只读不改。',
   tags:['只读评审','正确性'],modes:['评审','验证'],
   comp:['implementation-correctness · principal','concurrent-commit-model · principal'],
   skills:['code-review'],
   cmds:[['帮我评审这段代码有没有正确性问题','把合同义务追溯到代码路径，报告可复现的缺陷']]},
  {id:'security-reviewer',k:'sec',name:'安全评审专家',role:'应用安全评审',by:'Lingee 内置',ro:true,
   desc:'基于信任边界建立威胁模型，演练滥用、竞态与绕过场景并给出风险判定。',
   tags:['只读评审','威胁建模'],modes:['评审','验证'],
   comp:['application-security · principal','filesystem-safety · advanced'],
   skills:['threat-modeling'],
   cmds:[['这个功能有安全风险吗？帮我做威胁建模','演练滥用与绕过场景，判断风险是否可接受']]},
  {id:'read-only-analyst',k:'ana',name:'只读分析专家',role:'软件分析',by:'Lingee 内置',ro:true,
   desc:'在不改动工作区的前提下做有边界的源码分析与结论交叉验证。',
   tags:['只读分析'],modes:['分析','评审','验证'],
   comp:['software.analysis · advanced'],
   skills:['codebase-analysis'],
   cmds:[['帮我读一下这块代码是怎么跑的','有边界地读源码，给出结论与证据，不改文件']]},
  {id:'frontend-engineer',k:'fe',name:'前端工程专家',role:'前端工程师',by:'Lingee 内置',
   desc:'金蝶前端规范下的组件实现、响应式布局与交互调试。',
   tags:['React','响应式','组件库'],modes:['设计','实现','验证'],
   comp:['engineering.frontend · advanced'],skills:['cosmic-kwc-builder','frontend-design'],
   cmds:[['按[设计稿与规范]把页面实现出来','实现响应式页面与交互'],
         ['帮我抽一个可复用的组件','产出符合金蝶前端规范的组件'],
         ['页面和设计稿对不上，帮我调一下','把实现调到与设计稿一致']]},
  {id:'ux-designer',k:'ux',name:'界面设计专家',role:'交互 / 视觉设计',by:'Lingee 内置',
   desc:'信息架构、交互流程与视觉规范，产出可直接交付前端的设计说明。',
   tags:['交互设计','视觉规范'],modes:['分析','设计','评审'],
   comp:['design.interaction · advanced'],skills:['prototype-builder','frontend-design'],
   cmds:[['围绕[用户目标]先对齐设计目标','产出设计简报，对齐业务目标与设计策略'],
         ['帮我梳理这个模块的信息架构','理清导航、层级与页面骨架'],
         ['帮我走查一下这个页面','对已实现页面做规范与可用性检查']]},
  {id:'cosmic-form',k:'form',name:'苍穹表单专家',role:'苍穹表单',by:'Lingee 内置',
   desc:'KDDP 表单引擎的字段、校验、联动与权限配置。',
   tags:['表单设计','字段校验'],modes:['分析','设计','实现'],
   comp:['cosmic.form-design · advanced'],skills:['cosmic-requirements-spec','cosmic-form-builder'],
   cmds:[['按[已确认需求]建一张苍穹单据','设计表单结构与字段'],
         ['这几个字段要联动，帮我配一下','配置校验规则与字段联动逻辑'],
         ['这张单据的权限怎么配？','设置单据与字段级权限']]},
  {id:'cosmic-workflow',k:'flow',name:'苍穹工作流专家',role:'苍穹工作流',by:'Lingee 内置',
   desc:'审批链配置与流程调试，处理加签、会签、条件流转等复杂场景。',
   tags:['审批链','流程调试'],modes:['分析','设计','实现','验证'],
   comp:['cosmic.workflow · advanced'],
   skills:['cosmic-workflow-builder'],
   cmds:[['按[已确认需求]设计一条苍穹审批流程','梳理审批场景并配置工作流'],
         ['我的审批流节点卡住了，帮我排查','定位节点为什么不流转']]},
  {id:'cosmic-report',k:'rpt',name:'苍穹报表专家',role:'苍穹报表',by:'Lingee 内置',
   desc:'报表建模、取数逻辑与图表配置，兼顾查询性能与交互式分析。',
   tags:['报表建模','取数逻辑'],modes:['分析','设计','实现'],
   comp:['cosmic.report · advanced'],
   skills:['cosmic-report-builder'],
   cmds:[['按[已确认需求]做一张报表','设计报表数据模型与取数逻辑'],
         ['报表查得太慢了，帮我优化','优化取数与查询性能']]},
  {id:'cosmic-plugin',k:'plug',name:'苍穹二开插件专家',role:'苍穹二开',by:'Lingee 内置',
   desc:'基于扩展点开发二开插件，处理注册、生命周期调试与升级兼容。',
   tags:['插件开发','扩展点'],modes:['设计','实现','验证','恢复'],
   comp:['cosmic.plugin · advanced'],skills:['cosmic-reverse-engineering'],
   cmds:[['在[应用编码]里基于扩展点写一个二开插件','定位扩展点并实现插件逻辑'],
         ['插件注册了但不生效，帮我看看','排查注册与生命周期问题']]},
  {id:'cosmic-api',k:'api',name:'苍穹集成接口专家',role:'苍穹集成',by:'Lingee 内置',
   desc:'开放接口对接、鉴权配置与数据同步，含异常重试与幂等设计。',
   tags:['接口对接','鉴权'],modes:['设计','实现','集成','验证'],
   comp:['cosmic.integration · advanced'],
   skills:['cosmic-api-integration'],
   cmds:[['按[接口契约]对接苍穹开放接口','确认契约与鉴权方式并实现对接'],
         ['接口鉴权怎么配？','配置鉴权与安全策略'],
         ['两边数据要同步，帮我设计方案','设计幂等同步任务与异常重试']]}
];
var BUILTIN_EXPERTS=EXPERTS;
var MY_EXPERTS=[];                 /* 我自己创建的专家，落 localStorage */
var EX={};
function rebuildExperts(){
  EXPERTS=BUILTIN_EXPERTS.concat(MY_EXPERTS);
  EX={}; EXPERTS.forEach(function(e){EX[e.id]=e});
}

/* 专家头像：复用内置的一套图形 */
var AV_KEYS=['lead','pm','arch','eng','qa','cr','sec','ana','fe','ux','form','flow','rpt','plug','api'];
var WORK_MODES=['分析','设计','实现','集成','评审','验证','恢复'];

/* ---------- 专家团流程阶段 ----------
   专家团沿这条流程推进交付：requirements / design / planning /
   implementation / verification / delivery，各阶段由对应工作模式的成员认领。 */
var STAGES=[
  {id:'requirements',name:'需求分析',desc:'明确目标、范围与验收条件'},
  {id:'design',name:'方案设计',desc:'设计系统边界、接口与数据流'},
  {id:'planning',name:'实现规划',desc:'拆解任务、排定依赖与分工'},
  {id:'implementation',name:'编码实现',desc:'实现功能并完成针对性验证'},
  {id:'verification',name:'测试验证',desc:'独立验证验收行为与回归影响'},
  {id:'delivery',name:'部署交付',desc:'集成收口、上线发布与交付确认'}
];
/* 阶段 → 认领该阶段所需的工作模式（选人时按阶段过滤成员） */
var STAGE_MODES={
  requirements:['分析'],
  design:['设计'],
  planning:['设计'],
  implementation:['实现'],
  verification:['验证'],
  delivery:['集成']
};
function stageById(id){ for(var i=0;i<STAGES.length;i++){ if(STAGES[i].id===id) return STAGES[i]; } return null; }

/* 模型级别：智能体运行时用哪个推理档位 */
var MODEL_TIERS=[
  {id:'auto',  label:'自动', desc:'按任务复杂度自动选择'},
  {id:'fast',  label:'快速', desc:'响应最快，适合简单明确的任务'},
  {id:'expert',label:'专家', desc:'更强推理，适合复杂任务'},
  {id:'deep',  label:'深度', desc:'深度思考，适合高难度任务'}
];
function tierInfo(id){ for(var i=0;i<MODEL_TIERS.length;i++) if(MODEL_TIERS[i].id===id) return MODEL_TIERS[i]; return MODEL_TIERS[0]; }

/* ---------- 能力项字典 ----------
   定义文件里能力项是机器标识（architecture.system-design · principal），
   直接摆到界面上没人看得懂。这里翻成中文名 + 等级，字典没覆盖的回退显示原串。 */
var COMP_NAMES={
  'delivery.orchestration':'交付编排','delivery.integration':'集成收口',
  'product.requirements':'需求定义','product.acceptance-design':'验收设计',
  'architecture.system-design':'系统设计','architecture.reliability':'可靠性设计',
  'engineering.implementation':'编码实现','engineering.integration':'工程集成',
  'engineering.frontend':'前端工程',
  'quality.verification':'质量验证','quality.regression-analysis':'回归分析',
  'implementation-correctness':'实现正确性','concurrent-commit-model':'并发与提交模型',
  'application-security':'应用安全','filesystem-safety':'文件系统安全',
  'software.analysis':'源码分析','design.interaction':'交互设计',
  'cosmic.form-design':'苍穹表单设计','cosmic.workflow':'苍穹工作流',
  'cosmic.report':'苍穹报表','cosmic.plugin':'苍穹二开插件','cosmic.integration':'苍穹集成'
};
var COMP_LEVELS={principal:'资深',advanced:'精通',practitioner:'熟练',awareness:'了解'};

/* ---------- 开工前需要的输入 ----------
   不再单独维护字段：需要什么输入，直接写进触发词的 [占位符] 里。
   发出去时占位符没被替换，就在会话里追问，而不是让专家拿着空输入硬跑。 */
var ASK={
  '验收条件':{q:'这次做到什么程度算完成？',
    o:['用软件产品经理刚出的验收条件','我直接说，你记下来','先不定，按最小可用实现']},
  '架构决策':{q:'按哪份架构方案做？',
    o:['用软件架构师刚出的方案','我把方案贴给你','还没有方案，你先出一版']},
  '用户目标':{q:'这次要解决谁的什么问题？',
    o:['我描述一下','用项目里已有的需求文档']},
  '交付目标':{q:'这次交付要达成什么？',
    o:['我说一下目标和时间','沿用上一轮没做完的范围']},
  '需求':{q:'需求从哪来？',
    o:['用软件产品经理的需求清单','我直接说','先读代码反推现状']},
  '已确认需求':{q:'这次按哪份已确认的需求做？',
    o:['用苍穹产品经理确认过的需求规格','我直接说','还没确认，先帮我理一版']},
  '变更说明':{q:'这次改了什么？',
    o:['用软件工程师提交的变更说明','读本次提交自己判断','我列一下改动点']},
  '设计稿与规范':{q:'按哪份设计稿实现？',
    o:['用界面设计专家出的设计说明','我贴 Figma 链接','没有设计稿，你按设计系统发挥']},
  '接口契约':{q:'对接哪个接口？',
    o:['我贴接口文档','用苍穹开放平台上已注册的接口','先帮我查一下有哪些可用']},
  '应用编码':{q:'在哪个苍穹应用里开发？',
    o:['用当前会话关联的应用','我填应用编码']}
};
var ASK_FALLBACK={q:'这一项从哪来？', o:['我直接说','用上一步的产出','先跳过，你按默认处理']};
function askFor(name){ return ASK[name]||ASK_FALLBACK; }
/* 文本里没被替换掉的 [占位符] */
function pendingInputs(text){
  var out=[], re=/\[([^\[\]\n]{1,20})\]/g, m;
  while((m=re.exec(String(text||'')))){ if(out.indexOf(m[1])<0) out.push(m[1]); }
  return out;
}
/* 触发词里的占位符高亮显示 */
function phraseHtml(t){
  return xesc(t).replace(/\[([^\[\]]{1,20})\]/g,'<em class="x-ph">[$1]</em>');
}
var COMP_RANK={principal:4,advanced:3,practitioner:2,awareness:1};
/* 'architecture.system-design · principal' → 结构化 */
function parseComp(v){
  var p=String(v==null?'':v).split('\u00b7');
  var id=(p[0]||'').trim(), lv=(p[1]||'').trim();
  return {id:id,name:COMP_NAMES[id]||id,lv:lv,level:COMP_LEVELS[lv]||lv,rank:COMP_RANK[lv]||0};
}
function compChip(v){
  var c=(v&&typeof v==='object')?v:parseComp(v);
  return '<span class="ptag ptag-comp" title="'+xesc(c.id)+'">'+xesc(c.name)
    +(c.level?'<i class="ptag-lv lv-'+xesc(c.lv)+'">'+xesc(c.level)+'</i>':'')+'</span>';
}
var PRESET_TEAMS=[
  {id:'cosmic-app-dev',preset:true,name:'苍穹应用开发专家团',by:'Lingee 内置',
   desc:'面向苍穹应用完整交付，覆盖需求、表单、流程、报表、二开插件、接口与质量验证。',
   domains:['苍穹应用','表单','工作流','报表','集成'],
   leadId:'software-team-lead',
   members:['software-team-lead','software-product-manager','cosmic-form','cosmic-workflow','cosmic-report','cosmic-plugin','cosmic-api','software-qa-engineer'],
   cmds:[['帮我在苍穹上做一套请假申请，从单据到审批','表单、流程、报表、接口一体化交付'],
         ['这个业务要在苍穹落地，帮我出方案并实现','先出需求规格，再按依赖拆分实现与验证'],
         ['苍穹单据、流程和报表都要改，帮我排一下','按依赖顺序编排配置、二开与验证任务']]},
  {id:'general-app-dev',preset:true,name:'通用应用开发专家团',by:'Lingee 内置',
   desc:'面向 Web 与通用业务应用，覆盖产品、架构、体验、前后端实现、测试与集成交付。',
   domains:['通用应用','Web','前端','产品设计'],
   leadId:'software-team-lead',
   members:['software-team-lead','software-product-manager','software-architect','software-engineer','frontend-engineer','ux-designer','software-qa-engineer'],
   cmds:[['帮我把购物车支持优惠券做成能上线的功能','从需求、设计、实现到验收走完整闭环'],
         ['做一个业务管理 Web 应用','产品、架构、体验与工程协同交付'],
         ['按这份设计稿把页面实现出来并走查一遍','实现页面并完成设计与质量验证']]},
  {id:'kingdee-saas-implementation',preset:true,name:'金蝶 SaaS 实施专家团',by:'Lingee 内置',
   desc:'面向金蝶 SaaS 业务落地，梳理实施需求并完成表单、流程、报表和系统集成配置。',
   domains:['金蝶 SaaS','实施','流程配置','业务集成'],
   leadId:'software-team-lead',
   members:['software-team-lead','software-product-manager','cosmic-form','cosmic-workflow','cosmic-report','cosmic-api'],
   cmds:[['帮我梳理费用报销的 SaaS 实施方案','从业务需求到配置清单形成实施方案'],
         ['这套审批业务要在金蝶 SaaS 落地','完成表单、流程、报表与接口配置'],
         ['帮我检查当前实施配置还缺什么','核对需求覆盖、配置结果和集成风险']]},
  {id:'kingdee-secondary-dev',preset:true,name:'金蝶二次开发专家团',by:'Lingee 内置',
   desc:'面向金蝶产品扩展开发，覆盖技术方案、插件与接口实现、前端扩展、测试和升级兼容。',
   domains:['金蝶二开','插件','开放接口','前端扩展'],
   leadId:'software-architect',
   members:['software-architect','software-engineer','frontend-engineer','cosmic-plugin','cosmic-api','software-qa-engineer'],
   cmds:[['现有金蝶应用要增加一个二开功能','定位扩展点，完成方案、实现与验证'],
         ['帮我开发并联调这个苍穹插件','完成插件、接口和前端扩展的协同交付'],
         ['这次升级会不会影响已有二开','检查扩展点、接口契约和回归风险']]}
];

export function initExpertData() {
  rebuildExperts();
}

/* MY_EXPERTS 由其它模块写回；import 绑定只读，所以走这个 setter */
export function set_MY_EXPERTS(v){ MY_EXPERTS=v; return v; }

export { AV_KEYS, EX, EXPERTS, MODEL_TIERS, MY_EXPERTS, PRESET_TEAMS, STAGE_MODES, STAGES, WORK_MODES, askFor, compChip, parseComp, pendingInputs, phraseHtml, rebuildExperts, skillCatalog, skillInfo, stageById, tierInfo, xav, xesc };
