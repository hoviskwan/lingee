import { $, $$ } from '../core/dom.js';
import { applyMode, setNavActive, showView } from '../core/view.js';
import { openAppDropdown } from './attach-app.js';
/* 更新日志页面
   拆分自 src/scripts/main.js，逻辑逐行保留；副作用集中在下方 init* 函数里，
   由 main.js 按拆分前的原始顺序调用。 */


/* ---------- Changelog / 更新日志 ---------- */
var changelogData=[
  {id:'57',date:'2026-09-28',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'协作开发',author:'wuhc2023',body:'功能·协作开发：新建任务按专家团生成执行计划并按成员分工预填各阶段负责人，开始执行即发起会话，执行结束可在会话内确认产物并流转下一阶段；看板已办列改为展示本人处理或审核过且已流转的任务，协作开发菜单显示待审核数，新建任务可查看状态与处理人流程图；项目成员改在独立弹窗逐人设置角色，项目表单随内容调整高度。'},
  {id:'56',date:'2026-09-28',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'任务管理',author:'wuhc2023',body:'功能·任务管理：任务执行会话支持连续流式输出，展示专家团头像和可恢复产物；产物生成后自动转待审核，并同步显示任务状态。'},
  {id:'55',date:'2026-09-27',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'任务管理',author:'wuhc2023',body:'功能·任务管理：新版任务与项目支持成员权限、项目删除及阶段流转，执行会话按项目归档并模拟流式输出、关联任务与产物，本机开发服务新增 SQLite 局域网共享数据。'},
  {id:'54',date:'2026-09-27',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'修复',module:'任务管理',author:'wuhc2023',body:'任务执行按计划逐节点进行 AI 对话和人工审核，详情在阶段节点集中展示处理人、专家头像、状态与可展开的产物；新建任务刷新后可恢复，项目卡片进度实时更新。'},
  {id:'53',date:'2026-09-27',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'项目管理',author:'Joe',body:'项目列表默认卡片视图，整卡进入详情；项目概览仅负责人可修改，其他人只读，代码仓库和描述必填，项目编码不可修改；新建任务须明确所属项目。'},
  {id:'52',date:'2026-09-26',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'优化',module:'任务管理',author:'Joe wu',body:'移除废弃版本功能：从侧边栏及右键菜单彻底移除废弃页面入口，清理相关样式与代码。'},
  {id:'51',date:'2026-09-26',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'任务管理',author:'Joe wu',team:'新建任务专家团确认人',body:'新建任务专家团确认人：新建任务弹窗悬停展开专家团交付阶段二级面板，各阶段可用自定义下拉指定产物确认人，选择后面板保持展开以继续配置。'},
  {id:'50',date:'2026-09-26',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'任务管理',author:'liangpingxian',team:'任务会话与产物预览',body:'任务会话与产物预览：任务详情新增「我的会话」，可查看并回到自己围绕任务发起的会话；交付物文档改为右侧弹出预览并按任务生成内容；侧边栏新增专家团演示会话。'},
  {id:'49',date:'2026-09-26',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'优化',module:'任务管理',author:'Joe wu',team:'任务创建与详情优化',body:'任务创建与详情优化：多人协作改为按专家分工指定负责人，交付物改为侧边栏预览并扩充内容，异常任务可查看历史会话，审核退回跳转会话二次修改。'},
  {id:'48',date:'2026-09-26',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'任务管理',author:'Joe wu',team:'任务创建与执行概览',body:'任务创建与执行概览：新建任务可选择专家团，统一展示交付进度与结果；示例任务覆盖不同执行阶段，并按运行、审核和最终验收流转。'},
  {id:'47',date:'2026-09-25',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'系统通知',author:'吴晓峰',body:'系统通知与任务详情：新增系统通知收件箱，支持聚合展示、筛选与任务详情跳转。'},
  {id:'46',date:'2026-09-25',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'协作开发',author:'吴宏超',team:'项目与设置体验优化',body:'项目与设置体验优化：项目新增只读编码和六色文件夹图标，卡片按状态分组；设置新增配置审计日志，角色收敛为成员和管理员；支持工作区创建、切换与删除确认，并按工作区隔离协作数据。'},
  {id:'45',date:'2026-09-25',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'优化',module:'任务管理',author:'吴宏超',body:'内置视图「我创建」改为「进行中」，筛选范围同步更新。'},
  {id:'44',date:'2026-09-25',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'优化',module:'项目管理',author:'吴宏超',body:'项目列表 UI 精简优化：按钮文案、图标及视图栏优化。'},
  {id:'43',date:'2026-09-25',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'任务管理',author:'吴宏超',body:'Lingee 原型开发平台演示任务：接入 20 条模拟任务，优化动态展示、评论输入与项目内嵌列表。'},
  {id:'42',date:'2026-09-25',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'协作开发',author:'吴晓峰',body:'Lingee 原型开发平台演示项目：新增模拟项目及宽幅新建任务弹窗，支持手动/智能体双模式。'},
  {id:'41',date:'2026-09-24',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'优化',module:'任务管理',author:'吴晓峰',body:'任务列表与详情交互优化：模块列、子任务动效及通用模板。'},
  {id:'40',date:'2026-09-24',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'优化',module:'协作开发',author:'吴宏超',body:'项目任务、详情与成员管理优化：项目任务、详情与成员管理优化，支持一句话创建任务。'},
  {id:'39',date:'2026-09-23',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'优化',module:'项目管理',author:'吴宏超',body:'新建任务体验优化：采用宽幅写作区，配置负责人和执行阶段。'},
  {id:'38',date:'2026-09-23 21:15',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'任务管理',author:'吴晓峰',body:'子任务创建与父子嵌套展示：任务支持子任务创建与父子嵌套分组展示。'},
  {id:'37',date:'2026-09-23 20:30',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'任务管理',author:'吴晓峰',body:'任务管理页面全新重构：支持看板与列表双视图。'},
  {id:'36',date:'2026-09-23 20:00',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'更新日志',author:'吴晓峰',body:'更新日志改为独立页面：支持表格展示与筛选。'},
  {id:'29',date:'2026-09-22 16:45',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'功能',module:'项目管理',author:'吴宏超',body:'项目管理重构：项目详情改为标签页+右侧属性栏布局。'},
  {id:'27',date:'2026-09-22 16:45',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'优化',module:'项目管理',author:'吴宏超',body:'任务详情、评审与运行期协作链路优化：任务详情与评审协作链路优化，支持特性组织。'},
  {id:'26',date:'2026-09-21 14:20',iconBg:'#eaf1ff',iconColor:'#3d63dd',type:'功能',module:'项目管理',author:'吴宏超',body:'协作开发重构：工作区固定顶部，项目管理三层组织。'},
  {id:'25',date:'2026-09-21 14:20',iconBg:'var(--brand-fill)',iconColor:'var(--brand)',type:'优化',module:'项目管理',author:'吴宏超',body:'协作开发体验升级：任务管理升级为看板，专家新增技能页签。'},
  {id:'24',date:'2026-09-21 14:20',iconBg:'#e6f7f0',iconColor:'#0d9d6c',type:'功能',module:'项目管理',author:'吴宏超',body:'协作人员改为团队模型：协作人员管理重构为团队模型。'},
  {id:'23',date:'2026-09-21 14:20',iconBg:'#eef3ff',iconColor:'#3d63dd',type:'优化',module:'专家团',author:'吴宏超',body:'专家知识左树右表布局：专家详情知识页签改为左树右表布局。'},
  {id:'22',date:'2026-09-21 14:20',iconBg:'#eef3ff',iconColor:'#3d63dd',type:'修复',module:'专家团',author:'吴宏超',body:'知识搜索修复：修复专家知识搜索框无法输入中文的问题。'},
  {id:'21',date:'2026-09-20 10:15',iconBg:'#eaf1ff',iconColor:'#3d63dd',type:'优化',module:'专家团',author:'吴宏超',body:'知识界面统一为目录模型：支持预置与扩展。'},
  {id:'20',date:'2026-09-20 10:15',iconBg:'#e6f7f0',iconColor:'#0d9d6c',type:'功能',module:'专家团',author:'吴宏超',body:'专家知识分预置与自己上传：分预置与上传两层，优化交互体验。'},
  {id:'19',date:'2026-09-20 10:15',iconBg:'#f0e6ff',iconColor:'#7c3aed',type:'优化',module:'专家团',author:'吴宏超',body:'专家团弹窗改成单页：配置弹窗取消页签，合并为单页布局。'},
  {id:'18',date:'2026-09-20 10:15',iconBg:'#fef3ea',iconColor:'#e8792d',type:'优化',module:'专家团',author:'吴宏超',body:'专家团去掉固定运行流程：改为动态组队。'},
  {id:'17',date:'2026-09-20 10:15',iconBg:'#e8f4ff',iconColor:'#1a73e8',type:'功能',module:'专家团',author:'吴宏超',body:'专家新增知识页签：支持目录关联与文档预览。'},
  {id:'16',date:'2026-09-18 11:00',iconBg:'#f0e6ff',iconColor:'#7c3aed',type:'功能',module:'系统通知',author:'吴晓峰',body:'新增用户行为分析页面：含六大统计模块。'},
  {id:'15',date:'2026-09-14 09:30',iconBg:'#fff1e8',iconColor:'#ff8d42',type:'优化',module:'应用开发',author:'吴晓峰',body:'应用开发列表新建体验优化：新建应用流程改为下拉选择类型后跳转会话。'},
  {id:'14',date:'2026-09-14 09:30',iconBg:'#e8faef',iconColor:'#08a040',type:'功能',module:'专家团',author:'吴宏超',body:'专家团支持人工审核确认节点与能力项中文展示。'},
  {id:'13',date:'2026-09-11 14:00',iconBg:'#fce4ec',iconColor:'#e53935',type:'功能',module:'新会话',author:'吴晓峰',body:'会话加号下拉菜单：会话加号按钮改为三级下拉菜单。'},
  {id:'12',date:'2026-09-09 10:45',iconBg:'#e0f7fa',iconColor:'#00838f',type:'功能',module:'协作开发',author:'吴晓峰',body:'新增协作开发模块：下设六个功能页签。'},
  {id:'11',date:'2026-09-08 16:20',iconBg:'#eef3ff',iconColor:'#495dff',type:'功能',module:'系统通知',author:'吴晓峰',body:'原型新增登录页：新增登录页，需账号密码验证。'},
  {id:'10',date:'2026-08-27 09:15',iconBg:'#eef3ff',iconColor:'#495dff',type:'功能',module:'应用开发',author:'吴晓峰',body:'苍穹应用开发·预览区新增列表页签：预览面板新增列表页签。'},
  {id:'9',date:'2026-08-27 09:15',iconBg:'#e8faef',iconColor:'#08a040',type:'功能',module:'应用开发',author:'吴晓峰',body:'苍穹应用开发·历史版本：新增历史版本面板，支持回退。'},
  {id:'8',date:'2026-07-30 13:40',iconBg:'#fff1e8',iconColor:'#ff8d42',type:'功能',module:'系统通知',author:'吴晓峰',body:'新增 Design System 模块：涵盖 6 类 67 个组件。'},
  {id:'7',date:'2026-07-28 10:30',iconBg:'#eef3ff',iconColor:'#495dff',type:'优化',module:'应用开发',author:'吴晓峰',body:'应用开发关联应用交互优化：项目与应用选择分开展示。'},
];
// 每个数据条目对应的 avatar SVG 图标（与 Build_demo 的 lucide 图标一致）
var changelogIcons={
  '57':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M4 6h16M4 12h10M4 18h6"/><path d="M16 15l2 2 4-4"/></svg>',
  '56':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="7" cy="12" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 21v-2a5 5 0 0 1 10 0v2m0 0v-3a5 5 0 0 1 10 0v3"/></svg>',
  '55':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 14h5"/><path d="M17 13v5m-2.5-2.5h5"/></svg>',
  '54':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M4 12l5 5L20 6"/><path d="M4 5h8M4 20h16"/></svg>',
  '53':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z"/><path d="M8 14h8m-4-4v8"/></svg>',
  '52':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>',
  '51':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>',
  '50':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  '49':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',
  '48':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 12h3m4 0h3"/></svg>',
  '47':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/></svg>',
  '46':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  '45':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>',
  '44':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><circle cx="12" cy="13" r="3"/><path d="M12 10v1m0 2v1"/></svg>',
  '43':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  '42':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  '41':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M3 6h18M3 12h12M3 18h6"/></svg>',
  '40':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="1" fill="currentColor"/><circle cx="8" cy="12" r="1" fill="currentColor"/><circle cx="8" cy="17" r="1" fill="currentColor"/></svg>',
  '39':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 12h3m4 0h3"/></svg>',
  '38':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
  '37':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="8" rx="1"/></svg>',
  '36':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg>',
  '35':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>',
  '34':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
  '33':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M3 6h12M3 12h7M3 18h4"/><path d="M17 8V4m0 0l-3 3m0 0l3-3m0 0l3 3"/><path d="M17 16v4m0 0l-3-3m3 3l3-3"/></svg>',
  '32':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  '31':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg>',
  '29':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  '28':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
  '27':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  '26':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  '25':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/></svg>',
  '24':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  '23':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  '22':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
  '16':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M4 6h10M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h4M12 12h8"/><circle cx="10" cy="12" r="2"/><path d="M4 18h10M18 18h2"/><circle cx="16" cy="18" r="2"/></svg>',
  '15':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M12 5v14M5 12h14"/></svg>',
  '14':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/></svg>',
  '13':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M12 5v14M5 12h14"/></svg>',
  '12':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
  '11':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>',
  '9':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M3 12a9 9 0 1 0 9-9 9.9 0 0 0-6.36 2.64L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>',
  '10':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
  '8':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125 0-.945.748-1.688 1.688-1.688h1.999c3.586 0 6.539-2.918 6.539-6.5C22 6.48 17.5 2 12 2z"/></svg>',
  '7':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  '6':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M12 3a9 9 0 0 0 0 18M3 12h18"/></svg>',
  '5':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
};
var changelogReadIds=(function(){
  try{ return JSON.parse(localStorage.getItem('changelog_read_ids')||'[]'); }catch(e){return [];}
})();
function saveReadIds(){ localStorage.setItem('changelog_read_ids',JSON.stringify(changelogReadIds)); }
function getUnreadCount(){ return changelogData.filter(function(l){return changelogReadIds.indexOf(l.id)===-1;}).length; }
function formatRelativeDate(dateStr){
  return dateStr;
}
var menuBadge=$('#changelogMenuBadge'),changelogBody=$('#changelogBody');
var currentType='all',currentModule='all',currentAuthor='all';
var typeColors={'功能':['var(--brand-fill)','var(--brand)'],'优化':['#fff1e8','#e8792d'],'修复':['#fef0f0','#e33']};
function updateBadge(){
  var c=getUnreadCount();
  if(!menuBadge) return;
  if(c>0){ menuBadge.style.display=''; }
  else{ menuBadge.style.display='none'; }
}
function getFilteredData(){
  return changelogData.filter(function(l){
    if(currentType!=='all'&&l.type!==currentType) return false;
    if(currentModule!=='all'&&l.module!==currentModule) return false;
    if(currentAuthor!=='all'&&l.author!==currentAuthor) return false;
    return true;
  });
}
function renderChangelog(){
  var list=getFilteredData();
  if(list.length===0){
    changelogBody.innerHTML='<div class="changelog-empty">暂无通知</div>';
    return;
  }
  var html='<table class="changelog-table">';
  html+='<thead><tr><th class="c-type">类型</th><th class="c-module">模块</th><th class="c-content">更新内容</th><th class="c-author">更新人</th><th class="c-date">时间</th></tr></thead><tbody>';
  list.forEach(function(log){
    var tc=typeColors[log.type]||['#eee','#333'];
    html+='<tr class="changelog-row" data-id="'+log.id+'">';
    html+='<td class="c-type"><span class="changelog-type-tag" style="background:'+tc[0]+';color:'+tc[1]+'">'+log.type+'</span></td>';
    html+='<td class="c-module">'+log.module+'</td>';
    html+='<td class="c-content">';
    log.body.split('\n').forEach(function(line,li){
      if(line==='') html+='<br>';
      else html+='<span>'+line.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,function(m,text,url){
        return '<a href="'+url+'" target="_blank" class="changelog-link">'+text+'</a>';
      })+'</span> ';
    });
    html+='</td>';
    html+='<td class="c-author">'+log.author+'</td>';
    html+='<td class="c-date">'+formatRelativeDate(log.date)+'</td>';
    html+='</tr>';
  });
  html+='</tbody></table>';
  changelogBody.innerHTML=html;
  var demoLink=changelogBody.querySelector('a[href="#demo"]');
  if(demoLink){
    demoLink.addEventListener('click',function(e){
      e.preventDefault();
      showView('newtask');
      setNavActive('新会话');
      applyMode('苍穹应用',true);
      setTimeout(function(){ openAppDropdown(); },250);
    });
  }
}
function initFilters(){
  var typeFilter=$('#changelogTypeFilter');
  var moduleFilter=$('#changelogModuleFilter');
  var authorFilter=$('#changelogAuthorFilter');
  if(typeFilter){
    var types=['功能','优化','修复'];
    var allBtn0=document.createElement('button');
    allBtn0.className='changelog-filter-chip active';allBtn0.textContent='全部';allBtn0.dataset.value='all';
    typeFilter.appendChild(allBtn0);
    types.forEach(function(t){
      var btn=document.createElement('button');
      btn.className='changelog-filter-chip';btn.textContent=t;btn.dataset.value=t;
      typeFilter.appendChild(btn);
    });
    typeFilter.addEventListener('click',function(e){
      var chip=e.target.closest('.changelog-filter-chip');if(!chip) return;
      typeFilter.querySelectorAll('.changelog-filter-chip').forEach(function(c){c.classList.remove('active');});
      chip.classList.add('active');currentType=chip.dataset.value;renderChangelog();
    });
  }
  if(moduleFilter){
    var modules=[];
    changelogData.forEach(function(l){ if(modules.indexOf(l.module)===-1) modules.push(l.module); });
    var allBtn=document.createElement('button');
    allBtn.className='changelog-filter-chip active';allBtn.textContent='全部';allBtn.dataset.value='all';
    moduleFilter.appendChild(allBtn);
    modules.forEach(function(m){
      var btn=document.createElement('button');
      btn.className='changelog-filter-chip';btn.textContent=m;btn.dataset.value=m;
      moduleFilter.appendChild(btn);
    });
    moduleFilter.addEventListener('click',function(e){
      var chip=e.target.closest('.changelog-filter-chip');if(!chip) return;
      moduleFilter.querySelectorAll('.changelog-filter-chip').forEach(function(c){c.classList.remove('active');});
      chip.classList.add('active');currentModule=chip.dataset.value;renderChangelog();
    });
  }
  if(authorFilter){
    var authors=[];
    changelogData.forEach(function(l){ if(authors.indexOf(l.author)===-1) authors.push(l.author); });
    var allBtn2=document.createElement('button');
    allBtn2.className='changelog-filter-chip active';allBtn2.textContent='全部';allBtn2.dataset.value='all';
    authorFilter.appendChild(allBtn2);
    authors.forEach(function(a){
      var btn=document.createElement('button');
      btn.className='changelog-filter-chip';btn.textContent=a;btn.dataset.value=a;
      authorFilter.appendChild(btn);
    });
    authorFilter.addEventListener('click',function(e){
      var chip=e.target.closest('.changelog-filter-chip');if(!chip) return;
      authorFilter.querySelectorAll('.changelog-filter-chip').forEach(function(c){c.classList.remove('active');});
      chip.classList.add('active');currentAuthor=chip.dataset.value;renderChangelog();
    });
  }
}
export function openChangelog(){
  showView('changelog');
  $$('.nav-item').forEach(function(n){n.classList.remove('active')});
  renderChangelog();
  changelogData.forEach(function(l){ if(changelogReadIds.indexOf(l.id)===-1) changelogReadIds.push(l.id); });
  saveReadIds(); updateBadge();
}
export function initChangelog() {
  initFilters();
  updateBadge();
}
