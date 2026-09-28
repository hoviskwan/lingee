# Lingee 高保真原型

演示用原型。开发时模块化，构建产出**单个可双击打开的 HTML**，无需依赖。

## 命令

```bash
npm install
npm run dev          # 开发服务器（固定 5199 端口），使用浏览器 localStorage
npm run dev:shared   # 开发服务器，启用本机 SQLite 共享数据
npm run check        # 模块自检：import/export 是否对得上
npm run build        # 产出 dist/index.html（零外链单文件）
npm run format       # 格式化 src
```

演示时直接分发 `dist/index.html` 即可。

## 本机共享数据

`npm run dev`、线上静态页面和双击打开的 HTML 都使用浏览器 `localStorage`。如需临时启用局域网多人共享，运行 `npm run dev:shared`，再通过终端显示的局域网地址访问 `/lingee/`。共享模式会把业务数据保存在 `data/lingee.sqlite`；登录信息、当前工作区和界面偏好仍留在各自浏览器。

首次打开空数据库时，可选择把当前浏览器已有的业务数据导入；原有浏览器数据不会删除。数据库文件已被 Git 忽略，备份时先停止开发服务，再复制 `data/lingee.sqlite`。共享模式目前只适合可信网络；同一条业务数据被多人同时修改时，后提交者会看到冲突提示，其未保存内容可下载核对。

## 目录

| 目录 | 用途 |
| --- | --- |
| `src/` | 源码。视图片段、弹窗片段、样式、脚本、产物模板 |
| `build/` | 构建插件与自检脚本 |
| `dist/` | 构建产物，单文件 |
| `docs/` | 需求说明书，交付给开发实现 |

## 源码结构

改哪个界面，就改对应的那个文件——这是拆分的全部目的。

协作开发的五个页签在 `src/views/collab/` 各有 HTML 片段，导航容器保留在
`src/views/collab.html`；相关弹窗在 `src/modals/collab/`。样式按原层叠顺序
拆到 `src/styles/parts/collab/`，由 `src/styles/parts/collab.css` 引入。
项目列表与详情的交互在 `src/scripts/features/collab/project-view.js`，人员设置
在同目录的 `persons.js`。这些片段构建后仍合为一个 `dist/index.html`。

```
index.html                    只有 47 行：外壳 + <!--#include --> 清单

src/
├─ views/                     9 个视图各一份 HTML 片段
│  ├─ login.html  sidebar.html  home.html  newtask.html  chat.html
│  └─ apps.html   collab.html   skills.html  agents.html  settings.html
│                 design.html  overlays.html
├─ modals/                    15 个弹窗各一份 HTML 片段
│  ├─ team.html               专家团配置（单页：团队 + 触发词，没有运行流程）
│  ├─ expert-detail.html      专家详情
│  ├─ expert-edit.html        创建 / 编辑我的专家
│  ├─ member.html             专家团加成员
│  ├─ knowledge-pick.html     专家知识页签「＋ 添加」弹出的目录选择器
│  ├─ env-*.html              ERP 环境配置 / 授权 / 断开（5 个）
│  └─ attach.html  new-app.html  shortcut.html  collab.html  …
├─ styles/
│  ├─ tokens.css              设计令牌，全站唯一来源
│  ├─ app.css                 只剩一份有序的 @import 清单
│  └─ parts/                  22 个分区样式，顺序即层叠顺序
├─ scripts/
│  ├─ main.js                 入口：只做 import + 按原顺序调用各模块的 init
│  ├─ core/                   dom / toast / view（视图切换、侧边栏导航）
│  ├─ boot/                   route（启动路由）、test-param
│  └─ features/
│     ├─ login.js  sidebar.js  changelog.js  dropdown.js  tooltip.js
│     ├─ composer.js          输入框、发送、＋按钮菜单
│     ├─ chat.js  apps.js  attach-app.js  shortcuts.js  env.js
│     ├─ design/              Design System：交互 / 令牌 / 图标 / 组件预览
│     ├─ expert/              专家与专家团：data / store / library /
│     │                       automatch / editor / knowledge /
│     │                       team-modal / chips
│     └─ collab/              协作开发：data / view / tasks / reviews /
│                             chat / experts / projects / config / index
└─ artifacts/
   └─ purchase-order.html     单据产物模板，经 ?raw 导入
```

## 约定

- **改颜色、字号、圆角只动 `tokens.css`**，勿在组件里写死色值
- 产物模板是独立 HTML 文件，不要再内联回 JS 字符串
- 每次改动前确认工作区干净，便于回退

## 注意事项

### HTML 片段是构建期拼接的，不是运行时注入

`index.html` 里的 `<!--#include "src/views/home.html" -->` 由
[build/vite-plugin-html-include.js](build/vite-plugin-html-include.js) 在
`transformIndexHtml` 阶段替换成文件内容。页面最终仍是一份完整的静态 HTML，
脚本执行时 DOM 已经就绪——和拆分前逐字节一致，没有任何运行时注入。

新增一个视图 / 弹窗：在 `src/views/` 或 `src/modals/` 放一个片段，
再去 `index.html` 加一行 `<!--#include -->`。位置就是它在 DOM 里的位置。

### 部署路径与刷新

线上走 **GitHub Pages**（`.github/workflows/deploy.yml`，push main 自动构建），
地址是 `https://joe005.github.io/lingee/`——**带 `/lingee/` 这层前缀**。

也可部署到 **腾讯云 CloudBase Hosting**：

```bash
npm run build
tcb hosting deploy ./dist --env-id lingee-d8gwl813k240a7a68 --yes
```

访问地址 `https://lingee-d8gwl813k240a7a68-1256137603.tcloudbaseapp.com/`。
CloudBase Hosting 自动用 `404.html` 处理 SPA 刷新，无需额外配置错误文档。

两件相关的事：

**地址前缀。** 应用内部按「站点在根目录」写地址（`setUrlState('/collab')`），
由 [src/scripts/core/base-path.js](src/scripts/core/base-path.js) 统一补上和剥掉
部署前缀。前缀从首屏文档所在目录推导，不能用 `import.meta.env.BASE_URL`——
`vite-plugin-singlefile` 会把 base 改写成 `'./'`。

**刷新。** 原型用 `replaceState` 把地址改成 `/collab` 这类干净路径，但服务器上
并没有这些文件，直接刷新会去请求它：

- 开发时由 [build/vite-plugin-spa-fallback.js](build/vite-plugin-spa-fallback.js)
  把这类请求重写回 `/`
- 线上由 [build/vite-plugin-pages-404.js](build/vite-plugin-pages-404.js) 构建出
  一份 `404.html`（index.html 的副本）。Pages 对站内未知路径返回它，浏览器照常
  渲染，应用正常启动。HTTP 状态码仍是 404，对演示原型没有影响。

另外 `boot/route.js` 里的视图名过白名单：`showView()` 对认不出的名字会把九个
视图**全部隐藏**，线上曾因此登录后一片空白。认不出就按「没指定」处理。

### CSS 依赖源码顺序

`.menu{display:none}` 与 `.app-menu{display:flex}` 等选择器特异性相同，
谁在后面谁生效。[src/styles/app.css](src/styles/app.css) 现在只剩一份
`@import` 清单，**这个顺序等于拆分前单文件里的行顺序，不可随意调整**。

新增样式优先放进 `parts/` 里对应的那个文件；确实是全局兜底，才追加到
`parts/expert-extra.css` 末尾。

### JS 模块只声明，接线在入口

每个模块只有声明（变量、函数），副作用（事件注册、初始化调用）集中在
导出的 `init*()` 函数里，由 [src/scripts/main.js](src/scripts/main.js)
按拆分前的原始顺序调用——入口里每行后面的注释就是它在原 6515 行
`main.js` 里的行号。**调整调用顺序前先确认没有依赖**。

跨模块共享的可变状态（`activePick`、`TEAMS`、`cvProject` 等）用 ES module
的 live binding 读取；ES 的 import 绑定是只读的，所以写入要走对应模块导出的
`set_xxx()`。`npm run check` 会把「导入了对方没导出的名字」「给 import
绑定赋值」「用了却没 import」这三类问题挡在浏览器之前。
