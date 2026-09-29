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

function buildEngineeringArtifactDocs(ctx) {
  var task = ctx.task;
  var title = task.title;
  var code = task.code || ('T' + task.id);
  var desc = String(task.desc || '');
  var points = desc.split(/[。；;\n]/).map(function (part) { return part.trim(); }).filter(function (part) { return part.length >= 6; }).slice(0, 5);
  if (!points.length) points = ['解析输入文件并保留来源信息', '输出结构化结果与异常报告', '对重复执行和边界输入提供可核对结果'];
  var people = ctx.people;
  var date = task.createDate || '2026-09-20';
  var script = (desc.match(/[\w-]+\.py/) || [null])[0] || 'extract_project_data.py';
  var output = (desc.match(/[\w-]+\.json/) || [null])[0] || 'extraction-result.json';
  var scope = title.replace(/[。；].*$/, '');
  var records = points.map(function (point, i) { return ['REQ-' + String(i + 1).padStart(2, '0'), point, i < 2 ? '必须' : '建议']; });
  return [
    {id:'requirements',stageId:'requirements',type:'需求文档',docTitle:'《' + scope + '》需求与验收说明',summary:'输入范围、输出要求、异常边界与验收条件',docNo:'PRD-' + code,version:'v1.0',status:'待确认',author:people.product,reviewer:people.owner,date:date,
      sections:[
        {heading:'1. 任务目标',blocks:[{p:desc || title},{note:'本任务的交付对象为结构化数据与可重复执行的处理脚本；示例值需在真实运行后核对。'}]},
        {heading:'2. 需求清单',blocks:[{table:{head:['编号','要求','级别'],rows:records}}]},
        {heading:'3. 输入与输出',blocks:[{table:{head:['项目','约定'],rows:[['输入','项目内的源文件、配置或运行日志；输入路径由运行参数指定'],['输出',output + ' 与执行报告'],['失败处理','保留错误位置和原因，非零退出码表示处理未完成'],['重复执行','同一输入与配置应产生一致的结果']]} } ]},
        {heading:'4. 验收标准',blocks:[{ol:points.slice(0,4).map(function (point,i) {return 'REQ-' + String(i+1).padStart(2,'0') + '：' + point + '；提供可核对的输出样例与检查结果。';})}]},
      ]},
    {id:'technical',stageId:'design',type:'技术文档',docTitle:'《' + scope + '》技术方案与数据契约',summary:'处理流程、输出结构、异常策略与校验方式',docNo:'TEC-' + code,version:'v1.0',status:'待评审',author:people.arch,reviewer:people.owner,date:date,
      sections:[
        {heading:'1. 处理流程',blocks:[{ol:['扫描输入路径，建立待处理文件清单并记录来源','解析内容并归一化标识、类型和引用关系','按优先级合并重复定义，输出冲突与缺失项','写入 ' + output + '，生成计数和结构校验结果']}]},
        {heading:'2. 输出数据契约',blocks:[{code:'{\n  "source": "<输入路径>",\n  "generatedAt": "<ISO 8601>",\n  "records": [\n    { "id": "sample-001", "type": "<类型>", "properties": {} }\n  ],\n  "warnings": []\n}'},{table:{head:['字段','类型','约束'],rows:[['source','string','可追溯到输入位置'],['records','array','id 非空且在结果中唯一'],['warnings','array','包含位置、原因与处理建议']]} }]},
        {heading:'3. 异常与幂等',blocks:[{table:{head:['场景','处理'],rows:[['输入缺失','终止并报告缺失路径，不覆盖既有结果'],['解析失败','记录文件与行号，继续处理其他独立文件'],['标识冲突','按约定优先级裁决，并写入 warnings'],['输出写入失败','使用临时文件写入，成功后原子替换']]} }]},
        {heading:'4. 验证方式',blocks:[{ul:['用固定样本验证结构字段与类型','对同一输入重复执行并比较规范化输出','抽查边界样本和冲突记录','对源文件变更生成差异清单，避免无意漂移']}]},
      ]},
    {id:'implementation',stageId:'implementation',type:'开发成果',docTitle:script + ' · 处理结果与样例',summary:'可运行脚本、输出样例和关键处理记录',docNo:'DEV-' + code,version:'v1.0.0-rc1',status:'待验收',author:people.dev,reviewer:people.owner,date:date,
      sections:[
        {heading:'1. 交付文件',blocks:[{table:{head:['文件','作用','核对方式'],rows:[['scripts/' + script,'读取与解析源数据','运行命令并检查退出码'],['out/' + output,'结构化结果','按技术文档校验字段与计数'],['out/extraction-report.json','错误、警告与差异摘要','检查未处理项']]} }]},
        {heading:'2. 运行方式',blocks:[{code:'python scripts/' + script + ' --input ./source --output ./out/' + output + '\npython -m json.tool ./out/' + output + ' > /dev/null'},{note:'以上为交付命令示例；具体输入路径和参数以项目运行环境为准。'}]},
        {heading:'3. 输出预览',blocks:[{code:'{\n  "source": "./source",\n  "records": [\n    { "id": "sample-001", "type": "normalized", "properties": { "status": "active" } }\n  ],\n  "warnings": []\n}'},{table:{head:['核对项','预期'],rows:[['JSON 可解析','无语法错误'],['标识唯一','无重复 id'],['来源可追溯','每条记录可定位输入来源'],['异常记录','失败项写入报告，不静默丢弃']]} }]},
      ]},
    {id:'test',stageId:'verification',type:'测试报告',docTitle:'《' + scope + '》验证与回归报告',summary:'输入样本、边界验证、输出核对与遗留风险',docNo:'TST-' + code,version:'v1.0',status:'待回归',author:people.test,reviewer:people.owner,date:date,
      sections:[
        {heading:'1. 验证范围',blocks:[{p:'针对 ' + script + ' 的解析、去重、异常处理和 ' + output + ' 输出结构进行验证。报告中的结果为演示样例，实际结论以运行记录为准。'}]},
        {heading:'2. 用例记录',blocks:[{table:{head:['编号','场景','输入','预期','状态'],rows:[['TC-001','正常样本','有效源文件','输出记录结构正确','待执行'],['TC-002','重复标识','两条相同 id','按优先级保留并记录冲突','待执行'],['TC-003','缺失引用','引用目标不存在','写入 warnings 并标明来源','待执行'],['TC-004','重复运行','同一输入运行两次','规范化结果一致','待执行'],['TC-005','输出权限不足','只读目录','非零退出且保留原文件','待执行']]} }]},
        {heading:'3. 验收结论',blocks:[{note:'待补充真实运行日志、记录计数及差异报告后，才能将本报告标记为通过。'}]},
      ]},
    {id:'delivery',stageId:'delivery',type:'交付报告',docTitle:'《' + scope + '》交付验收报告',summary:'交付包、操作说明、验收状态与后续事项',docNo:'DLV-' + code,version:'v1.0',status:'待验收',author:people.dev,reviewer:people.owner,date:date,
      sections:[
        {heading:'1. 交付清单',blocks:[{table:{head:['交付物','路径','验收依据'],rows:[['处理脚本','scripts/' + script,'可运行且有参数说明'],['结果数据','out/' + output,'符合数据契约'],['执行报告','out/extraction-report.json','记录警告与失败项'],['验证报告','TST-' + code,'用例与运行日志可追溯']]} }]},
        {heading:'2. 操作与回滚',blocks:[{ol:['备份既有输出和配置','按技术文档设置输入与输出路径并执行脚本','核对退出码、结构校验与警告数量','发现差异超出预期时恢复备份并定位源文件变更']}]},
        {heading:'3. 验收状态',blocks:[{table:{head:['检查项','状态','后续动作'],rows:[['输出结构','待核对','使用固定样本验证字段'],['运行记录','待补充','附加真实日志与计数'],['异常清单','待确认','逐项关闭或登记限制']]} }]},
      ]},
  ];
}

export function buildTaskArtifactDocs(ctx) {
  var task = ctx.task;
  if (/抽取|元数据|字节码|继承链|规则动作|解析器|流水线|数据字典/.test(task.title + (task.desc || ''))) return buildEngineeringArtifactDocs(ctx);
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

  var caseItems = points.map(function (point, index) {
    return [tc(index), fr(index) + ' ' + point, '提交并核对结果', '字段、状态与需求一致', '通过'];
  }).concat([
    [tc(points.length), '列表关键词与状态组合筛选', '输入关键词并切换状态', '结果与筛选条件一致', '通过'],
    [tc(points.length + 1), '无权限用户访问详情', '使用无项目权限账号访问', '返回 403 且页面不泄露数据', '通过'],
    [tc(points.length + 2), '并发更新同一记录', '两个账号先后保存旧版本', '第二次更新返回 409', '通过'],
    [tc(points.length + 3), '导出与当前筛选条件一致', '筛选后导出文件', '导出数量和列表一致', urgent ? '待修复' : '通过'],
  ]);
  if (blocked) caseItems.push([tc(points.length + 4), '上游数据同步', '触发上游数据读取', '数据完整且可追溯', '阻塞']);
  var passCount = caseItems.filter(function (row) { return row[4] === '通过'; }).length;
  var failCount = caseItems.filter(function (row) { return row[4] === '待修复'; }).length;
  var skipCount = caseItems.filter(function (row) { return row[4] === '阻塞'; }).length;
  var totalCases = caseItems.length;

  return [
    {
      id:'requirements', stageId:'requirements', type:'需求文档', docTitle:'《' + title + '》需求规格说明书', summary:'业务背景、功能范围、验收标准与待确认事项',
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
      id:'technical', stageId:'design', type:'技术文档', docTitle:'《' + title + '》技术设计与接口说明', summary:'模块边界、数据模型、接口契约与异常处理',
      docNo:'TEC-' + code, version:'v1.0', status:'草稿', reviewer:P.arch,
      date:at(0, '13:45'), author:P.dev,
      sections:[
        { heading:'1. 方案概览', blocks:[
          { p:'本方案为「' + title + '」提供页面、业务服务和数据访问三个层次。页面负责输入与结果展示；业务服务处理权限、校验和状态；数据访问层管理 ' + table + '。' },
          { table:{ head:['模块', '职责', '关键约束'], rows:[
            ['页面与交互', '列表筛选、详情查看、提交反馈', '保留筛选条件；失败时不丢失已输入数据'],
            ['业务服务', '字段校验、状态流转、并发控制', '按项目角色授权；更新需校验 version'],
            ['数据访问', '分页查询与持久化', '按项目和状态建立复合索引'],
          ] } },
        ] },
        { heading:'2. 数据模型', blocks:[
          { table:{ head:['字段', '类型', '说明'], rows:[
            ['id', 'BIGINT', '主键'], ['bill_no', 'VARCHAR(32)', '业务编号，项目内唯一'],
            ['project_id', 'VARCHAR(32)', '所属项目'], ['status', 'VARCHAR(16)', '当前业务状态'],
            ['owner_id', 'VARCHAR(32)', '当前处理人'], ['version', 'INT', '乐观锁版本号'],
            ['created_at / updated_at', 'DATETIME', '创建与更新时间'],
          ] } },
          { note:'写入时使用 WHERE id = ? AND version = ?；影响行数为 0 时返回 409，避免覆盖他人的修改。' },
        ] },
        { heading:'3. 接口清单', blocks:[
          { table:{ head:['方法', '路径', '说明'], rows:[
            ['GET', api, '分页查询，支持 status / keyword / 日期范围筛选'],
            ['GET', api + '/{id}', '查询详情'],
            ['POST', api, '新建，返回新记录 id'],
            ['PATCH', api + '/{id}', '部分更新，需携带 version'],
            ['POST', api + '/batch', '批量操作，单次最多 100 条'],
            ['GET', api + '/export', '按当前筛选条件导出 Excel'],
          ] } },
        ] },
        { heading:'4. 请求与响应示例', blocks:[
          { code:'PATCH ' + api + '/10086\nContent-Type: application/json\n\n{\n  "version": 3,\n  "status": "submitted",\n  "remark": "' + title + '"\n}' },
          { code:'{\n  "code": 0,\n  "message": "ok",\n  "data": { "id": 10086, "version": 4, "status": "submitted" }\n}' },
        ] },
        { heading:'5. 错误码与处理', blocks:[
          { table:{ head:['错误码', 'HTTP', '含义', '前端处理'], rows:[
            ['40001', '400', '参数校验失败', '高亮对应字段并提示'],
            ['40301', '403', '无项目权限', '跳转无权限提示页'],
            ['40901', '409', '版本冲突', '提示刷新后重试'],
            ['50001', '500', '服务内部错误', '保留已填数据，提示稍后重试'],
          ] } },
        ] },
        { heading:'6. 实现与观测要点', blocks:[
          { ul:[
            '列表超过 200 行启用虚拟滚动；筛选输入 300ms 防抖',
            '请求失败按指数退避重试 3 次，仍失败时提示并保留表单内容',
            '批量接口返回逐条结果，前端展示成功数与失败明细',
            '所有接口透传 X-Request-Id，便于日志联查',
            '分页查询记录请求耗时与总数；接口错误按项目、路径和错误码聚合监测',
          ] },
        ] },
      ],
    },
    {
      id:'implementation', stageId:'implementation', type:'开发成果',
      docTitle:(res === 'purchase-orders' ? '采购订单列表' : title.replace(/^(实现|开发|完成|新增|构建)/, '').trim()) + ' · 功能预览',
      summary:'可操作页面、关键状态、接口联调结果与交付文件',
      docNo:'DEV-' + code, version:'v1.0.0-rc1', status:'待验收', reviewer:P.owner,
      date:at(0, '14:30'), author:P.dev,
      sections:[
        { heading:'1. 功能页面', blocks:[
          { app:{
            title:res === 'purchase-orders' ? '采购订单列表' : title.replace(/^(实现|开发|完成|新增|构建)/, '').trim(),
            subtitle:project + ' · 业务管理',
            stats:[['本月单据','128'],['待处理','17'],['本月金额','¥ 1,284,650.00']],
            filters:['关键词 / 单据编号','状态：全部','日期：本月'],
            head:res === 'purchase-orders' ? ['订单编号','供应商','采购员','订单日期','含税金额','状态'] : ['业务编号','事项名称','负责人','更新时间','处理金额','状态'],
            rows:res === 'purchase-orders' ? [
              ['PO-2026-0048','深圳恒达科技有限公司','张伟',addDays(base,-1),'¥ 145,205.00','已审核'],
              ['PO-2026-0047','上海博远电子有限公司','李敏',addDays(base,-2),'¥ 89,350.00','待审核'],
              ['PO-2026-0046','广州华信科技有限公司','张伟',addDays(base,-3),'¥ 216,800.00','已审核'],
              ['PO-2026-0045','北京天元科技有限公司','王强',addDays(base,-4),'¥ 56,320.00','草稿'],
            ] : [
              [code + '-001',title,P.dev,addDays(base,-1),'¥ 12,800.00','已完成'],
              [code + '-002',points[0] || title,P.product,addDays(base,-2),'¥ 8,450.00','处理中'],
              [code + '-003',points[1] || title,P.dev,addDays(base,-3),'¥ 3,200.00','待确认'],
            ],
          } },
          { note:'此处为交付界面的演示数据。实际业务数据由项目接口读取，列表字段与权限遵循本任务的技术文档。' },
        ] },
        { heading:'2. 已实现能力', blocks:[
          { table:{ head:['能力', '交互结果', '对应需求'], rows:[
            ['查询与筛选', '关键词、状态和日期组合查询；切换页码保留筛选条件', fr(0)],
            ['查看详情', '点击业务编号打开详情，展示基础信息与操作记录', fr(Math.min(1,points.length-1))],
            ['新增与编辑', '字段就地校验；保存后刷新列表并定位记录', fr(Math.min(2,points.length-1))],
            ['异常反馈', '403 提示权限不足；409 提示数据已更新并允许刷新', '非功能需求'],
          ] } },
        ] },
        { heading:'3. 交付文件', blocks:[
          { table:{ head:['文件 / 模块', '用途', '状态'], rows:[
            ['src/features/' + res + '/list', '列表、筛选及分页交互', '已完成'],
            ['src/features/' + res + '/detail', '详情与编辑表单', '已完成'],
            [api, '查询、创建、更新接口契约', '已联调'],
          ] } },
          { p:'本次交付已覆盖主流程和异常反馈。待测试报告回归完成后，将候选版本转为正式发布版本。' },
        ] },
      ],
    },
    {
      id:'test', stageId:'verification', type:'测试报告', docTitle:'《' + title + '》系统测试报告', summary:'测试范围、用例记录、缺陷跟踪与发布建议',
      docNo:'TST-' + code, version:'v1.0', status:failCount || skipCount ? '待回归' : '已通过', reviewer:P.owner,
      date:at(0, '15:05'), author:P.test,
      sections:[
        { heading:'1. 测试范围与环境', blocks:[
          { note:'以下用例和结果用于展示报告格式；正式结论应以实际执行记录替换。' },
          { p:'覆盖「' + title + '」的主流程、筛选查询、权限校验、并发更新和导出。测试依据为 PRD-' + code + ' v1.2 与 TEC-' + code + ' v1.0。' },
          { table:{ head:['环境', '版本', '执行人', '执行日期'], rows:[
            [project + ' SIT', 'v1.0.0-rc1 / Chrome 128', P.test, addDays(base,0)],
          ] } },
        ] },
        { heading:'2. 执行结果', blocks:[
          { table:{ head:['总数', '通过', '待修复', '阻塞', '通过率'], rows:[
            [String(totalCases), String(passCount), String(failCount), String(skipCount), (passCount / totalCases * 100).toFixed(1) + '%'],
          ] } },
          { table:{ head:['用例编号', '验证点', '操作', '预期结果', '结果'], rows:caseItems } },
        ] },
        { heading:'3. 缺陷与阻塞', blocks:[
          { table:{ head:['编号', '问题', '级别', '处理建议'], rows:(failCount ? [
            ['BUG-' + code + '-01', '导出数量与当前筛选结果不一致', 'P2', '修复导出条件传递后回归'],
          ] : [['—', '本轮未发现待修复缺陷', '—', '保持回归验证']]).concat(blocked ? [
            ['BLOCK-' + code + '-01', blocked, '阻塞', '上游数据恢复后补测'],
          ] : []) } },
        ] },
        { heading:'4. 结论与发布建议', blocks:[
          { p:failCount || skipCount ? '主流程与权限用例通过；仍有 ' + failCount + ' 项待修复、' + skipCount + ' 项阻塞。修复并完成回归前，不建议将候选版本标记为正式验收通过。' : '本轮 ' + totalCases + ' 条用例全部通过，关键业务流程、权限和并发控制符合验收标准，可进入交付验收。' },
        ] },
      ],
    },
    {
      id:'delivery', stageId:'delivery', type:'交付报告', docTitle:'《' + title + '》交付验收报告', summary:'版本清单、上线核对、验收结论与后续事项',
      docNo:'DLV-' + code, version:'v1.0.0', status:failCount || skipCount ? '待验收' : '已交付', reviewer:P.owner,
      date:at(0, '16:20'), author:P.dev,
      sections:[
        { heading:'1. 交付清单', blocks:[
          { table:{ head:['交付物', '位置', '说明'], rows:[
            ['前端代码', 'release/' + code.toLowerCase(), '已合入主干，tag v1.0.0'],
            ['后端服务', table + ' 服务', '含数据库迁移脚本'],
            ['接口文档', 'TEC-' + code, '含错误码与示例'],
            ['测试报告', 'TST-' + code, totalCases + ' 条用例；' + (failCount + skipCount) + ' 条待关闭'],
            ['操作手册', '项目知识库', '面向业务操作员'],
          ] } },
        ] },
        { heading:'2. 验证结论', blocks:[
          { ul:points.slice(0, 3).map(function (p, i) { return fr(i) + ' 已验证通过：' + p; }).concat([
            '无权限访问与并发冲突处理已按技术文档核对',
          ]) },
        ] },
        { heading:'3. 验收状态与待办', blocks:[
          { table:{ head:['项目', '当前结论', '下一步'], rows:[
            ['功能验收', failCount || skipCount ? '条件通过' : '通过', failCount || skipCount ? '关闭测试报告中的待办后复验' : '归档验收记录'],
            ['上线准备', '待确认', '核对环境变量、权限和回滚方案'],
          ] } },
        ] },
        { heading:'4. 已知限制', blocks:[
          { ul:[
            '批量操作单次上限 100 条，超出需分批执行',
            '导出暂只支持 Excel，CSV 在下个版本提供',
            '列表列配置只支持排序，显示/隐藏列入下期规划',
          ] },
        ] },
        { heading:'5. 上线检查', blocks:[
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
