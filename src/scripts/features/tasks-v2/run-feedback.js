/* 新版任务详情的演示运行记录。仅提供可重复的样例数据，不模拟真实的后端流。 */

const ACTIVE_RUN_VARIANTS = {
  8:'queued', 11:'dispatched', 15:'waiting_local_directory',
  56:'running', 64:'dispatched', 66:'waiting_local_directory', 69:'queued',
};

function implementationAction(title) {
  if (/报表|看板|统计|指标|大屏|导出/.test(title)) return '正在核对报表取数口径与筛选联动…';
  if (/流程|审批|流转|派单/.test(title)) return '正在配置流程节点与异常分支…';
  if (/接口|集成|同步|数据源|持久化/.test(title)) return '正在核对接口映射、幂等与失败重试…';
  if (/插件|二开|扩展/.test(title)) return '正在检查扩展点与插件生命周期…';
  if (/页面|列表|交互|原型|侧边栏|标签/.test(title)) return '正在实现页面交互与状态反馈…';
  return '正在实现主流程并检查异常分支…';
}

function stageSteps(task, stageId) {
  const title = task.title || '当前任务';
  const steps = {
    requirements:[
      ['thinking','梳理业务目标与验收边界',`从「${title}」的任务描述提取目标、非目标和验收条件。`],
      ['tool','核对业务入口与异常场景',`检查「${title}」涉及的入口、角色权限和失败恢复路径。`],
      ['result','形成需求清单',`已整理「${title}」的需求范围及可观察的验收条件。`],
    ],
    design:[
      ['thinking','分析模块边界与依赖',`确认「${title}」与现有页面、服务和数据模型的关系。`],
      ['tool','核对数据流与接口约定',`检查关键字段、状态流转、错误返回和回退路径。`],
      ['result','完成方案设计',`记录「${title}」的方案取舍及待联调依赖。`],
    ],
    planning:[
      ['thinking','拆解可交付工作项',`把「${title}」拆为实现、验证和交付工作项。`],
      ['tool','检查依赖与责任分工',`核对专家团成员的职责和工作项先后顺序。`],
      ['result','形成实施计划',`已排定「${title}」的执行顺序与验收门禁。`],
    ],
    implementation:[
      ['thinking','读取任务上下文',`核对「${title}」的需求、方案和实施计划。`],
      ['tool','检查实现约定',`确认输入输出字段、页面状态与异常处理约定。`],
      ['tool',implementationAction(title),`围绕「${title}」处理主流程，并记录待验证的边界情况。`],
    ],
    verification:[
      ['thinking','整理验收与回归场景',`从「${title}」的需求和实现记录提取验证点。`],
      ['tool','执行主流程与边界检查',`检查正常路径、权限边界、重复操作和异常恢复。`],
      ['result','记录验证结论',`已形成「${title}」的检查结果和剩余风险。`],
    ],
    delivery:[
      ['thinking','汇总阶段产物',`收集「${title}」各阶段的说明和验证证据。`],
      ['tool','核对交付范围与遗留项',`确认交付内容、尚待人工决定的事项和后续观察点。`],
      ['result','提交交付说明',`已整理「${title}」的交付材料与验收结论。`],
    ],
  };
  return (steps[stageId] || steps.implementation).map(([kind, summary, detail]) => ({kind, summary, detail, state:'done'}));
}

function duration(task, stageId) {
  const stageNumber = ['requirements','design','planning','implementation','verification','delivery'].indexOf(stageId) + 1;
  const seconds = 65 + ((Number(task.id) || 0) * 13 + stageNumber * 17) % 128;
  return `${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, '0')}秒`;
}

export function getDemoStageRun(task, entry) {
  const steps = stageSteps(task, entry.stageId);
  const run = {status:'completed', label:'已完成', summary:'', duration:duration(task, entry.stageId), steps};
  if (entry.state === 'running') {
    run.status = ACTIVE_RUN_VARIANTS[task.id] || 'running';
    run.label = ({queued:'排队中',dispatched:'启动中',waiting_local_directory:'等待本地目录释放',running:'正在工作'})[run.status];
    if (run.status === 'queued') { run.summary = '等待可用的智能体。'; run.steps = []; }
    else if (run.status === 'dispatched') { run.summary = '正在准备智能体会话。'; run.steps = []; }
    else if (run.status === 'waiting_local_directory') { run.summary = '等待其他运行释放工作目录。'; run.steps = []; }
    else {
      run.steps[2].state = 'running';
      run.summary = run.steps[2].summary;
    }
  } else if (entry.state === 'blocked') {
    run.status = 'failed';
    run.label = '失败';
    const reason = task.blockedRun?.reason || '所需依赖尚未就绪，执行已中断。';
    run.steps[2] = {kind:'error',summary:'执行中断：' + reason,detail:reason,state:'failed'};
  } else if (entry.state === 'review') {
    run.steps[2] = {kind:'result',summary:`${entry.stage}结果已生成，等待人工审核。`,detail:`「${task.title}」的${entry.stage}执行记录与阶段产物已生成，等待项目负责人确认。`,state:'done'};
  }
  return run;
}

export function getDemoPreRun(task) {
  const messages = {
    planned:{label:'待规划',summary:'等待确认交付范围，尚未创建智能体运行。'},
    cancelled:{label:'已取消',summary:'任务已取消，当前没有正在运行的智能体。'},
  };
  return messages[task.status] || null;
}
