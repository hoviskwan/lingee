# Helpdesk 企业服务台系统 · 项目说明

> 本文档依据工作台(Workbench)界面截图整理,描述系统的定位、功能架构与核心数据模型。
> 标注「推测」的条目为根据界面信息合理推断、尚未在截图中直接证实的部分。

## 1. 项目概述

Helpdesk 是面向 **Chin Hin Group** 集团的企业级共享服务台(工单管理)系统,统一承接并流转
集团内部的 IT、HR、薪酬(HR Services / Payroll)等服务请求。系统以「工单」为核心对象,
围绕工单提供受理、分配、SLA 时效管控、升级告警、审计追踪与智能辅助的完整闭环。

- **服务对象**:集团全体员工(提单人)、各职能服务团队(受理人/处理人)、系统管理员
- **典型服务团队**:Service Desk Team(IT 支持)、HR Services Team(人力资源)、Payroll Team(薪酬)
- **当前界面角色**:System Admin(系统管理员视角,可见全部部门工单)
- **多语言能力**:工单主题支持中英双语(如「电脑无法开机 - PC/Laptop not turning on」)

## 2. 功能架构

依据左侧导航,系统划分为四个功能区:

### 2.1 主菜单(Main Menu)
| 模块 | 说明 |
| --- | --- |
| Workbench | 工单工作台,工单总览、筛选、分配与处理的主操作界面 |
| Dashboard | 数据仪表盘(推测:工单量、SLA 达成率、团队负载等统计) |

### 2.2 协作(Collaboration)
| 模块 | 说明 |
| --- | --- |
| Audit log | 审计日志,追踪工单及系统配置的操作记录 |
| SLA alerts | SLA 告警中心,集中呈现超时/即将超时的工单 |

### 2.3 系统管理(System)
| 模块 | 说明 |
| --- | --- |
| Companies | 公司管理,支持集团下多公司(多租户)架构 |
| Users | 用户管理 |
| Departments | 部门管理 |
| Catalog | 服务目录,定义可发起的标准化服务项 |
| Assignment rules | 工单自动分配规则 |
| SLA config | SLA 时效配置(首次响应时限、解决时限等) |
| Calendar | 日历(推测:用于排班或 SLA 工作日历计算) |
| AI Agent | 智能体(推测:智能客服/工单自动应答与辅助处理) |

### 2.4 全局辅助能力
- **全局搜索**:支持 `⌘K` 快捷键唤起
- **Notifications**:消息通知中心(截图显示 9+ 未读)
- **Getting started**:新手引导清单(共 7 步,含「Start now」入口)
- **租户/身份切换**:顶部切换集团(Chin Hin Group)与角色(Admin)

## 3. Workbench 工作台(核心页面)

### 3.1 页面摘要区
- 个性化问候:`Hello System Admin, here is your ticket overview`
- 全局概览指标:当前数据范围(All departments)、**4 条待分配工单**、**110 条 SLA 告警**
- 主操作:`Export`(导出)、`New ticket`(新建工单)

### 3.2 视图页签
| 页签 | 说明 |
| --- | --- |
| All | 全部工单 |
| Pending assign | 待分配工单,徽标实时显示数量(4) |
| SLA Alerts | SLA 告警工单,徽标实时显示数量(110) |

页签右侧提供部门范围切换(All departments),控制整个列表的数据可见范围。

### 3.3 筛选体系
支持多维度组合筛选与排序:

- 关键字搜索:工单号(Ticket No.)或主题(Subject)
- 工单属性:Category(分类)、Priority(优先级)、Status(状态)、SLA(时效状态)
- 组织维度:**Group → BG → BU** 三级业务架构,叠加 Assignee(处理人)
- 排序:Updated at(按更新时间)

### 3.4 工单列表
| 列 | 说明 |
| --- | --- |
| 复选框 | 支持批量选择(推测:批量分配/导出/关闭) |
| Ticket No. | 工单编号,规则 `TK-年份-六位序号`(如 TK-2026-000247),兼容历史编号(如 TK-00112) |
| Subject | 工单主题,副行显示当前受理团队(如 Service Desk Team) |
| Priority | 优先级,采用 P 级体系(截图示例均为 P2) |
| Status | 工单状态:Draft(草稿)、Assigned(已分配)、In progress(处理中)、Closed(已关闭) |
| SLA - First Response | 首次响应时效:Normal / **Overdue**(红色标签并注明逾期时长,如 Overdue by 23d 7h) |
| SLA - Resolution | 解决时效(截图右侧截断,结构与首次响应一致) |

## 4. 工单数据模型(依据界面归纳)

```
Ticket
├── Ticket No.     工单编号(TK-YYYY-NNNNNN)
├── Subject        主题(支持中英双语)
├── Category       分类(来自服务目录 Catalog)
├── Priority       优先级(P 级,示例为 P2)
├── Status         状态:Draft → Assigned → In progress → Closed
├── Assignee       处理人
├── Team           受理团队(Service Desk / HR Services / Payroll)
├── 组织归属        Group / BG / BU / Department / Company
├── SLA
│   ├── First Response   首次响应时限 → Normal / Overdue(含逾期时长)
│   └── Resolution       解决时限 → Normal / Overdue(含逾期时长)
└── Updated at     最近更新时间
```

## 5. SLA 时效管理

SLA 是本系统的核心管控机制,形成「配置 → 监控 → 告警」闭环:

1. **配置**:SLA config 定义首次响应与解决两阶段时限(推测:可按优先级/目录差异化配置)
2. **监控**:列表内联显示每张工单的 SLA 状态,逾期以红色 Overdue 标签 + 精确逾期时长呈现
3. **告警**:SLA alerts 模块与 Workbench 页签双重入口集中追踪(当前累计 110 条告警)

## 6. 自动化与智能化

- **Assignment rules**:按规则自动分配工单,配合 Pending assign 队列处理分配异常
- **AI Agent**:智能体辅助(推测:自动应答、工单分类建议、知识库推荐)
- **Notifications**:分配、超时、状态变更等事件的消息推送

## 7. 典型业务场景(来自真实工单示例)

| 业务域 | 工单示例 |
| --- | --- |
| IT 支持 | 重置密码(reset password)、恶意软件检测(detect malware)、电脑无法开机、笔记本硬件故障 |
| HR 服务 | 请假申请流程咨询(How to Apply for Leave)、工作时间咨询、员工福利咨询 |
| 薪酬服务 | Payroll 相关问题(ddd、员工福利权益咨询由 Payroll Team 受理) |

## 8. 非功能特性

- **多组织/多公司**:Companies + Group/BG/BU/Department 多级架构,适应集团化管控
- **权限与审计**:基于角色(System Admin / Admin)的数据范围控制,Audit log 全程留痕
- **可观测性**:列表支持导出(Export),满足线下汇报与数据分析需要
- ** onboarding**:7 步新手引导降低管理员上手成本
