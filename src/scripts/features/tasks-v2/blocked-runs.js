/* 阻塞任务的本地演示运行记录；步骤和失败原因均为模拟数据。 */
import { CV_PROJECTS } from '../collab/data.js';
import { TEAMS } from '../expert/store.js';
import { EXPERTS } from '../expert/data.js';

const BLOCKED_RUNS = {
  4: { agent:'cosmic-api', duration:'2分18秒', reason:'ERP 测试账套缺少期初余额，借贷平衡校验未通过。', next:'请运维补齐测试账套后重新执行增量拉取。', steps:[['读取 ERP 总账接口定义','已确认多账套、币种及科目编码映射。'],['拉取测试账套数据','已取得总账明细，发现期初余额记录缺失。'],['执行落库前校验','借贷余额不平，停止同步以避免写入错误报表数据。']] },
  16: { agent:'cosmic-api', duration:'1分42秒', reason:'集团统一身份认证中心的权限接口尚未开放联调。', next:'等待对方接口排期确认后重试角色和部门权限校验。', steps:[['解析权限矩阵','已整理高管、主管、业务员的可见范围。'],['准备行列级权限规则','已标记成本价与利润率等敏感列。'],['连接统一身份认证中心','联调接口尚不可用，无法验证角色与部门映射。']] },
  25: { agent:'cosmic-api', duration:'2分06秒', reason:'e签宝测试密钥仍在法务审批，签署接口无法完成鉴权。', next:'获取测试密钥并配置回调地址后重新发起联调。', steps:[['生成合同签署流程','已整理 PDF 上传、签署方和签署位置参数。'],['校验回调与归档规则','已准备签署状态回调和归档字段。'],['调用测试环境鉴权','缺少已批准的测试密钥，执行中止。']] },
  40: { agent:'cosmic-workflow', duration:'1分57秒', reason:'SLA 规则引擎依赖的调度集群尚未完成扩容审批。', next:'调度集群扩容完成后重试倒计时和超时升级验证。', steps:[['加载 SLA 时效配置','已匹配四档优先级的响应与解决时效。'],['检查预警与升级节点','已定义提前 15 分钟预警及超时升级规则。'],['启动定时调度验证','集群容量不足且扩容审批未完成，未启动定时任务。']] },
  46: { agent:'cosmic-api', duration:'1分34秒', reason:'HR 系统开放 API 尚未提供，无法抽取花名册和考勤数据。', next:'待 HR API 开通后重试字段映射与首次全量抽取。', steps:[['检查 ETL 字段映射','已整理花名册、考勤、薪酬和绩效字段。'],['准备清洗与异常队列','已定义空值、越界和编码不匹配规则。'],['连接 HR 开放 API','接口排期未到，抽取阶段暂停。']] },
  63: { agent:'software-qa-engineer', duration:'3分12秒', reason:'任务列表按状态排序时复现偶发乱序，回归验证未通过。', next:'请检查排序稳定性与状态变更后的列表重排，再运行回归测试。', steps:[['构造多状态任务样本','已覆盖待办、执行中、审核中和阻塞状态。'],['切换状态排序并刷新','发现同状态任务顺序偶发变化。'],['运行回归断言','排序结果与预期不一致，保留复现记录并标记失败。']] },
};

export function createDemoBlockedRun(task) {
  if (task.status !== 'blocked') return null;
  var content = BLOCKED_RUNS[task.id];
  if (!content) return null;
  var project = CV_PROJECTS.find(function (row) { return row.id === task.project; });
  var team = TEAMS.find(function (row) { return row.id === task.teamId || project?.defaultTeam; });
  var expertId = team?.members.includes(content.agent) ? content.agent : team?.leadId;
  var expert = EXPERTS.find(function (row) { return row.id === expertId; });
  return {
    agentName:expert?.name || team?.name || '任务智能体',
    teamName:team?.name || '专家团',
    failedAt:task.createDate + ' 14:12',
    duration:content.duration,
    reason:content.reason,
    next:content.next,
    steps:content.steps,
  };
}
