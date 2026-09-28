/* 任务详情 AI 产物的演示文档：按任务标题、描述与项目成员生成结构化正文。
   正文由 blocks 组成：p 段落、ul/ol 列表、table 表格、code 代码、note 提示。 */

var RESOURCE_WORDS = [
  ['采购订单', 'purchase-orders'], ['订单', 'orders'], ['供应商', 'suppliers'], ['入库', 'inbound-receipts'],
  ['出库', 'outbound-orders'], ['库存', 'inventory'], ['盘点', 'stocktakes'], ['报表', 'reports'],
  ['审批', 'approvals'], ['合同', 'contracts'], ['发票', 'invoices'], ['付款', 'payments'],
  ['报销', 'expense-claims'], ['费用', 'expenses'], ['预算', 'budgets'], ['客户', 'customers'],
  ['工单', 'tickets'], ['生产', 'work-orders'], ['排产', 'schedules'], ['质检', 'inspections'],
  ['物料', 'materials'], ['权限', 'permissions'], ['用户', 'users'], ['通知', 'notifications'],
];

function resourceOf(text) {
  var hit = RESOURCE_WORDS.find(function (pair) { return text.indexOf(pair[0]) >= 0; });
  return hit ? hit[1] : 'records';
}

/* 把任务描述切成可逐条验收的需求点；描述过短时补齐通用需求点。 */
export function requirementPoints(task) {
  var points = String(task.desc || '')
    .split(/[。；;\n]/)
    .map(function (s) { return s.replace(/^[\s\d.、]+/, '').trim(); })
    .filter(function (s) { return s.length >= 6 && !/^阻塞原因/.test(s); });
  var fallback = [
    '完成「' + task.title + '」主流程：录入、校验、提交与结果反馈',
    '关键字段提供格式、必填与唯一性校验，错误就地提示',
    '提供列表查询与筛选，支持分页和按时间排序',
    '操作留痕，状态变更可在操作日志中追溯',
  ];
  return points.length >= 3 ? points.slice(0, 6) : points.concat(fallback).slice(0, 4);
}

function blockedReason(task) {
  var m = String(task.desc || '').match(/阻塞原因[:：]([^。]+)/);
  return m ? m[1].trim() : '';
}

/* 需求文档「待确认问题」行数：固定两行，任务描述带阻塞原因时追加一行 */
export function openIssueCount(task) {
  return 2 + (blockedReason(task) ? 1 : 0);
}

function addDays(base, days) {
  var d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildTaskArtifactDocs(ctx) {
  var task = ctx.task;
  var title = task.title;
  var code = task.code || ('T' + task.id);
  var project = ctx.projectName;
  var base = task.createDate || '2026-09-20';
  var due = task.dueDate || addDays(base, 10);
  var P = ctx.people; // product / dev / arch / test / owner
  var points = requirementPoints(task);
  var res = resourceOf(title + (task.desc || ''));
  var api = '/api/v1/' + (task.project || 'app') + '/' + res;
  var table = (task.project || 'app') + '_' + res.replace(/-/g, '_');
  var blocked = blockedReason(task);
  var urgent = task.priority === 'urgent' || task.priority === 'high';
  function at(days, hhmm) { return addDays(base, days) + ' ' + hhmm; }
  function fr(i) { return 'FR-' + String(i + 1).padStart(2, '0'); }
  function tc(i) { return 'TC-' + String(i + 1).padStart(3, '0'); }

  var passCount = points.length * 3 + 14;
  var failCount = urgent ? 2 : 1;
  var skipCount = blocked ? 3 : 1;
  var totalCases = passCount + failCount + skipCount;

  return [
    {
      id:'requirements', stageId:'requirements', type:'需求文档', summary:'业务背景、功能需求与验收标准',
      docNo:'PRD-' + code, version:'v1.2', status:'已评审', reviewer:P.owner,
      date:at(0, '09:40'), author:P.product,
      sections:[
        { heading:'1. 背景与目标', blocks:[
          { p:'「' + title + '」隶属' + project + '项目。' + (points[0] ? '本需求的核心诉求是：' + points[0] + '。' : '') + '当前该环节依赖人工处理，存在录入重复、校验滞后、处理进度不可追踪的问题。' },
          { ul:[
            '业务目标：将单据处理时长从平均 25 分钟降至 8 分钟以内',
            '质量目标：提交后被退回的比例从 18% 降至 5% 以下',
            '可追溯：每一次状态变更都能在操作日志中查到操作人与时间',
          ] },
        ] },
        { heading:'2. 用户与场景', blocks:[
          { table:{ head:['角色', '典型场景', '频次'], rows:[
            ['业务操作员', '日常录入与提交，处理退回单据', '每天 30–80 次'],
            ['业务主管', '查看待办、审核与批量处理', '每天 10–20 次'],
            ['项目负责人', '查看统计概览与异常清单', '每周 2–3 次'],
          ] } },
        ] },
        { heading:'3. 功能需求', blocks:[
          { table:{ head:['编号', '需求描述', '优先级'], rows:points.map(function (p, i) {
            return [fr(i), p, i < 2 ? 'P0' : (i < 4 ? 'P1' : 'P2')];
          }) } },
        ] },
        { heading:'4. 非功能需求', blocks:[
          { ul:[
            '性能：列表查询 500 条数据响应 ≤ 1 秒，首屏加载 ≤ 2 秒',
            '权限：按项目成员与角色控制数据可见范围，越权访问返回 403',
            '兼容：支持 Chrome / Edge 最新两个大版本，最小宽度 1280px',
            '审计：新增、修改、删除操作全部写入操作日志，保留 180 天',
          ] },
        ] },
        { heading:'5. 验收标准', blocks:[
          { ol:points.slice(0, 4).map(function (p, i) { return fr(i) + '：' + p + '，在测试环境按用例走通，无 P0/P1 缺陷'; }) },
        ] },
        { heading:'6. 待确认问题', blocks:[
          { table:{ head:['问题', '负责人', '期望答复'], rows:[
            ['历史数据是否需要迁移到新流程', P.owner, addDays(base, 2)],
            ['导出文件是否需要带水印', P.product, addDays(base, 2)],
          ].concat(blocked ? [[blocked, P.arch, addDays(base, 1)]] : []) } },
        ] },
      ],
    },
    {
      id:'architecture', stageId:'design', type:'架构设计', summary:'模块划分、数据模型与依赖风险',
      docNo:'ARC-' + code, version:'v1.0', status:'已评审', reviewer:P.owner,
      date:at(0, '10:25'), author:P.arch,
      sections:[
        { heading:'1. 模块划分', blocks:[
          { table:{ head:['模块', '职责', '负责人'], rows:[
            ['展示层', '页面、表单与列表组件，负责交互与状态展示', P.dev],
            ['业务服务', '参数校验、状态流转、权限判断', P.dev],
            ['数据访问', '读写 ' + table + '，封装分页与缓存', P.arch],
            ['集成适配', '对接消息通知与操作日志服务', P.arch],
          ] } },
        ] },
        { heading:'2. 数据流', blocks:[
          { ol:[
            '用户在页面提交操作，前端完成必填与格式校验',
            '业务服务校验权限与状态，写入 ' + table + ' 并记录版本号',
            '状态变更事件推送到通知服务，相关人员收到待办',
            '操作日志服务异步落库，失败时进入重试队列（最多 3 次）',
          ] },
        ] },
        { heading:'3. 数据模型', blocks:[
          { code:'CREATE TABLE ' + table + ' (\n  id            BIGINT PRIMARY KEY,\n  bill_no       VARCHAR(32)  NOT NULL UNIQUE,\n  project_id    VARCHAR(32)  NOT NULL,\n  status        VARCHAR(16)  NOT NULL DEFAULT \'draft\',\n  amount        DECIMAL(18,2),\n  owner_id      VARCHAR(32)  NOT NULL,\n  version       INT          NOT NULL DEFAULT 0,\n  created_at    DATETIME     NOT NULL,\n  updated_at    DATETIME     NOT NULL,\n  INDEX idx_project_status (project_id, status)\n);' },
          { note:'version 字段用于乐观锁：更新时校验版本号，冲突返回 409，前端提示刷新后重试。' },
        ] },
        { heading:'4. 外部依赖', blocks:[
          { table:{ head:['依赖', '用途', '状态'], rows:[
            ['统一认证', '获取当前用户与项目角色', '已就绪'],
            ['消息通知', '状态变更推送待办', '已就绪'],
            ['操作日志', '记录关键操作', '接口联调中'],
          ].concat(blocked ? [['上游数据源', '取数与校验', '阻塞：' + blocked]] : []) } },
        ] },
        { heading:'5. 风险与对策', blocks:[
          { table:{ head:['风险', '影响', '对策'], rows:[
            ['后端接口排期不确定', '前后端联调延后', '先锁定接口契约，前端按 Mock 并行开发'],
            ['大批量操作卡顿', '页面无响应', '超过 100 条改为异步任务，完成后通知'],
            ['并发修改同一单据', '数据被覆盖', '乐观锁 + 冲突提示'],
          ] } },
        ] },
      ],
    },
    {
      id:'plan', stageId:'planning', type:'实施计划', summary:'工作项拆分、排期与里程碑',
      docNo:'PLN-' + code, version:'v1.1', status:'执行中', reviewer:P.owner,
      date:at(0, '11:10'), author:P.product,
      sections:[
        { heading:'1. 工作项拆分', blocks:[
          { table:{ head:['编号', '工作项', '负责人', '工时', '计划完成'], rows:[
            ['W1', '接口契约与数据模型评审', P.arch, '0.5 人日', addDays(base, 1)],
          ].concat(points.slice(0, 4).map(function (p, i) {
            return ['W' + (i + 2), p.length > 22 ? p.slice(0, 22) + '…' : p, P.dev, (i < 2 ? '2' : '1.5') + ' 人日', addDays(base, 3 + i)];
          })).concat([
            ['W' + (Math.min(points.length, 4) + 2), '联调、测试与缺陷修复', P.test, '2 人日', addDays(due, -1)],
          ]) } },
        ] },
        { heading:'2. 执行顺序', blocks:[
          { ol:[
            '锁定接口契约与字段定义，契约评审通过后才进入开发',
            '前端基于 Mock 实现主流程，后端同步实现服务与数据表',
            '补齐异常分支与权限控制，完成自测',
            '提测后按测试报告修复缺陷，回归通过后发布',
          ] },
        ] },
        { heading:'3. 里程碑', blocks:[
          { table:{ head:['里程碑', '日期', '出口标准'], rows:[
            ['需求与契约锁定', addDays(base, 1), '评审纪要确认，接口文档定稿'],
            ['主流程可演示', addDays(base, 4), '测试环境走通 P0 需求'],
            ['提测', addDays(due, -3), '自测通过，冒烟用例全部通过'],
            ['发布', due, '无 P0/P1 缺陷，交付说明归档'],
          ] } },
        ] },
      ],
    },
    {
      id:'technical', stageId:'implementation', type:'技术文档', summary:'接口定义、请求示例与错误码',
      docNo:'TEC-' + code, version:'v1.0', status:'草稿', reviewer:P.arch,
      date:at(0, '13:45'), author:P.dev,
      sections:[
        { heading:'1. 接口清单', blocks:[
          { table:{ head:['方法', '路径', '说明'], rows:[
            ['GET', api, '分页查询，支持 status / keyword / 日期范围筛选'],
            ['GET', api + '/{id}', '查询详情'],
            ['POST', api, '新建，返回新记录 id'],
            ['PATCH', api + '/{id}', '部分更新，需携带 version'],
            ['POST', api + '/batch', '批量操作，单次最多 100 条'],
            ['GET', api + '/export', '按当前筛选条件导出 Excel'],
          ] } },
        ] },
        { heading:'2. 请求示例', blocks:[
          { code:'PATCH ' + api + '/10086\nContent-Type: application/json\n\n{\n  "version": 3,\n  "status": "submitted",\n  "remark": "' + title + '"\n}' },
          { code:'{\n  "code": 0,\n  "message": "ok",\n  "data": { "id": 10086, "version": 4, "status": "submitted" }\n}' },
        ] },
        { heading:'3. 错误码', blocks:[
          { table:{ head:['错误码', 'HTTP', '含义', '前端处理'], rows:[
            ['40001', '400', '参数校验失败', '高亮对应字段并提示'],
            ['40301', '403', '无项目权限', '跳转无权限提示页'],
            ['40901', '409', '版本冲突', '提示刷新后重试'],
            ['50001', '500', '服务内部错误', '保留已填数据，提示稍后重试'],
          ] } },
        ] },
        { heading:'4. 实现要点', blocks:[
          { ul:[
            '列表超过 200 行启用虚拟滚动；筛选输入 300ms 防抖',
            '请求失败按指数退避重试 3 次，仍失败时提示并保留表单内容',
            '批量接口返回逐条结果，前端展示成功数与失败明细',
            '所有接口透传 X-Request-Id，便于日志联查',
          ] },
        ] },
      ],
    },
    {
      id:'prototype', stageId:'implementation', type:'原型图', summary:'页面结构、关键状态与交互说明',
      docNo:'UX-' + code, version:'v0.9', status:'评审中', reviewer:P.product,
      date:at(0, '14:10'), author:P.product,
      sections:[
        { heading:'1. 页面结构', blocks:[
          { ul:[
            '顶部操作栏（56px）：标题、面包屑、主按钮「新建」与更多菜单',
            '筛选区：状态、负责人、日期范围，可折叠并记住上次条件',
            '数据列表：固定表头，支持列排序与列宽拖拽',
            '右侧详情抽屉：点击行打开，可编辑关键字段',
          ] },
        ] },
        { heading:'2. 关键状态', blocks:[
          { table:{ head:['状态', '触发条件', '界面表现'], rows:[
            ['加载中', '首次进入或翻页', '骨架屏占位，保持表头'],
            ['空数据', '无记录', '插画 + 「新建」按钮'],
            ['筛选无结果', '条件过窄', '提示调整条件 + 「清空筛选」'],
            ['错误', '接口失败', '错误说明 + 「重试」按钮'],
          ] } },
        ] },
        { heading:'3. 交互说明', blocks:[
          { ol:points.slice(0, 3).map(function (p) { return p; }).concat([
            '保存成功后 toast 提示 3 秒，列表定位到当前记录',
            'Esc 关闭抽屉；有未保存修改时二次确认',
          ]) },
        ] },
      ],
    },
    {
      id:'test', stageId:'verification', type:'测试报告', summary:'用例执行结果、缺陷与结论',
      docNo:'TST-' + code, version:'v1.0', status:failCount > 1 ? '有待修复缺陷' : '待审核', reviewer:P.owner,
      date:at(0, '15:05'), author:P.test,
      sections:[
        { heading:'1. 执行概览', blocks:[
          { table:{ head:['用例总数', '通过', '失败', '阻塞/跳过', '通过率'], rows:[
            [String(totalCases), String(passCount), String(failCount), String(skipCount), (passCount / totalCases * 100).toFixed(1) + '%'],
          ] } },
          { p:'测试环境：' + project + ' SIT 环境，Chrome 128；执行时间 ' + at(0, '14:20') + ' – ' + at(0, '15:00') + '。' },
        ] },
        { heading:'2. 用例明细', blocks:[
          { table:{ head:['用例', '覆盖需求', '结果'], rows:points.map(function (p, i) {
            var result = i === points.length - 1 && failCount ? '失败' : '通过';
            return [tc(i), fr(i) + ' ' + (p.length > 20 ? p.slice(0, 20) + '…' : p), result];
          }).concat([
            [tc(points.length), '并发修改同一单据', '通过'],
            [tc(points.length + 1), '无权限用户访问详情', '通过'],
          ]).concat(blocked ? [[tc(points.length + 2), '上游数据取数', '阻塞']] : []) } },
        ] },
        { heading:'3. 缺陷列表', blocks:[
          { table:{ head:['编号', '描述', '级别', '状态'], rows:[
            ['BUG-' + String(task.id).padStart(3, '0') + '1', fr(points.length - 1) + ' 边界值处理与预期不符', urgent ? 'P1' : 'P2', '修复中'],
          ].concat(failCount > 1 ? [['BUG-' + String(task.id).padStart(3, '0') + '2', '分页切换后筛选条件丢失', 'P2', '待修复']] : []) } },
        ] },
        { heading:'4. 结论', blocks:[
          { p:'主流程与权限控制验证通过，性能指标达标（首屏 1.8s，500 条查询 0.7s）。' + (failCount > 1 ? '仍有 ' + failCount + ' 个缺陷待修复，建议修复回归后再发布。' : '剩余 1 个 P2 缺陷不阻塞发布，建议随下个版本修复。') },
        ] },
      ],
    },
    {
      id:'delivery', stageId:'delivery', type:'交付说明', summary:'交付清单、验证结论与已知限制',
      docNo:'DLV-' + code, version:'v1.0.0', status:'已交付', reviewer:P.owner,
      date:at(0, '16:20'), author:P.dev,
      sections:[
        { heading:'1. 交付清单', blocks:[
          { table:{ head:['交付物', '位置', '说明'], rows:[
            ['前端代码', 'release/' + code.toLowerCase(), '已合入主干，tag v1.0.0'],
            ['后端服务', table + ' 服务', '含数据库迁移脚本'],
            ['接口文档', 'TEC-' + code, '含错误码与示例'],
            ['测试报告', 'TST-' + code, totalCases + ' 条用例执行记录'],
            ['操作手册', '项目知识库', '面向业务操作员'],
          ] } },
        ] },
        { heading:'2. 验证结论', blocks:[
          { ul:points.slice(0, 3).map(function (p, i) { return fr(i) + ' 已验证通过：' + p; }).concat([
            '5 种角色组合下的数据可见范围符合预期',
          ]) },
        ] },
        { heading:'3. 已知限制', blocks:[
          { ul:[
            '批量操作单次上限 100 条，超出需分批执行',
            '导出暂只支持 Excel，CSV 在下个版本提供',
            '列表列配置只支持排序，显示/隐藏列入下期规划',
          ] },
        ] },
        { heading:'4. 上线检查', blocks:[
          { ol:[
            '执行数据库迁移脚本并核对表结构',
            '配置项目角色权限，抽查 2 个账号的可见范围',
            '观察上线首日接口超时率（告警阈值 2%）',
          ] },
        ] },
      ],
    },
  ];
}
