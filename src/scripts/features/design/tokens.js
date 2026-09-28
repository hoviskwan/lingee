/* Design System：全局样式（色彩/字体/阴影/圆角）
   拆分自 src/scripts/main.js，逻辑逐行保留；副作用集中在下方 init* 函数里，
   由 main.js 按拆分前的原始顺序调用。 */

/* ---------- 全局样式渲染（合并表格） ---------- */
function renderGlobalStyles(){
  var html='';
  /* === 1. 色彩 === */
  /* 色值从 :root 实时读取，杜绝文档与代码漂移 */
  var _rootStyle=getComputedStyle(document.documentElement);
  function tok(name){ return _rootStyle.getPropertyValue(name).trim(); }
  function T(name,label,desc){ return {name:label,val:tok(name),varName:name,desc:desc}; }
  var colorGroups=[
    {title:'主色',colors:[
      T('--brand','Primary','品牌主色，用于主按钮、选中态、强调'),
      T('--brand-hover','Primary Hover','主色悬浮态'),
      T('--brand-active','Primary Active','主色按下态'),
      T('--brand-fill','Primary Light','主色浅背景，用于标签、行悬浮'),
      T('--focus-ring','Focus Ring','焦点环色，输入框聚焦、链接高亮')
    ]},
    {title:'文字色',colors:[
      T('--text','Text Primary','正文主文字色'),
      T('--text-secondary','Text Secondary','次级文字（对比度 4.5:1），表单标签、表头、未选中页签'),
      T('--text-muted','Text Muted','辅助文字，描述与说明'),
      T('--text-soft','Text Soft','最弱文字，禁用态、占位符')
    ]},
    {title:'背景与填充',colors:[
      T('--bg','Background','页面主背景'),
      T('--sidebar-bg','Sidebar BG','侧边栏背景'),
      T('--fill-1','Fill 1','浅填充，表头与合计行'),
      T('--fill-2','Fill 2','更浅填充，表格斑马纹'),
      T('--hover','Hover BG','列表项悬浮背景'),
      T('--active','Active BG','列表项选中背景')
    ]},
    {title:'描边',colors:[
      T('--border','Border','默认边框，卡片与分割线'),
      T('--border-hover','Border Hover','边框悬浮态'),
      T('--border-focus','Border Focus','边框聚焦态'),
      T('--divider','Divider','弱分隔线，卡片内分区、表格行线')
    ]},
    {title:'状态色',colors:[
      T('--success','Success','成功色'),
      T('--success-bg','Success BG','成功浅背景'),
      T('--warning','Warning','警示色'),
      T('--warning-bg','Warning BG','警示浅背景'),
      T('--danger','Danger','危险色，同时用于金额强调'),
      T('--danger-bg','Danger BG','危险浅背景'),
      T('--dot-blue','Dot Blue','蓝点，执行中'),
      T('--dot-orange','Dot Orange','橙点，等待中'),
      T('--dot-green','Dot Green','绿点，已完成')
    ]},
    {title:'滚动条',colors:[
      T('--scroll-thumb','Scroll Thumb','滚动条滑块'),
      T('--scroll-thumb-hover','Scroll Thumb Hover','滑块悬浮态')
    ]}
  ];
  var tc=0;colorGroups.forEach(function(g){tc+=g.colors.length});
  html+='<div class="ds-table-group"><div class="ds-table-group-title">色彩 Color</div>';
  html+='<table class="ds-table"><colgroup><col style="width:44px"><col><col style="width:80px"><col style="width:140px"><col></colgroup><thead><tr><th></th><th>名称</th><th>色值</th><th>CSS 变量</th><th>描述</th></tr></thead><tbody>';
  colorGroups.forEach(function(g){
    html+='<tr><td colspan="5" style="font-weight:600;background:#f9f9f9;color:var(--text-muted);font-size:14px;padding:4px 10px">'+g.title+'</td></tr>';
    g.colors.forEach(function(c){
      var bd=['#ffffff','#fbfbfb','#f0f0f0','#ebebeb','#efefef','#eef3ff','#e8faef','#fff1e8','#fee'].indexOf(c.val)>-1?'border:1px solid #ddd':'';
      html+='<tr><td><span class="ds-swatch-sm" style="background:'+c.val+';'+bd+'"></span></td><td>'+c.name+'</td><td style="font-family:Monaco,Menlo,monospace">'+c.val+'</td><td style="font-family:Monaco,Menlo,monospace;color:var(--text-muted)">'+(c.varName||'—')+'</td><td>'+c.desc+'</td></tr>';
    });
  });
  html+='</tbody></table></div>';

  /* === 2. 字体 === */
  var fontFam='-apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", "Microsoft YaHei", sans-serif';
  var sizes=[
    {px:'11px',use:'辅助标签 · 版本号'},{px:'12px',use:'描述文字 · 标签'},
    {px:'13px',use:'正文小 · 导航项'},{px:'14px',use:'正文 · 菜单项 (base)'},
    {px:'15px',use:'卡片标题 · 弹窗标题'},{px:'16px',use:'弹窗标题 · 模态框'},
    {px:'17px',use:'品牌名 · 导航品牌'},{px:'19px',use:'侧边栏品牌'},
    {px:'23px',use:'页面标题'},{px:'28px',use:'首页 Logo'},{px:'32px',use:'Hero 标题'}
  ];
  var weights=[{w:'400',name:'Regular',desc:'正文、描述文字默认字重'},{w:'500',name:'Medium',desc:'导航项、标签、按钮文字'},{w:'600',name:'Semibold',desc:'卡片标题、分组标题'},{w:'700',name:'Bold',desc:'页面标题、品牌名'}];
  html+='<div class="ds-table-group"><div class="ds-table-group-title">字体 Typography</div>';
  var monoFam='Monaco, Menlo, Consolas, "Courier New", monospace';
  var mono='font-family:Monaco,Menlo,monospace;font-size:14px';
  html+='<table class="ds-table"><colgroup><col style="width:100px"><col><col style="width:260px"></colgroup><thead><tr><th>属性</th><th>值</th><th>使用场景</th></tr></thead><tbody>';
  html+='<tr><td>Font Family</td><td style="'+mono+'">'+fontFam+'</td><td>全站默认，界面所有文字</td></tr>';
  html+='<tr><td>Mono Family</td><td style="'+mono+'">'+monoFam+'</td><td>仅用于代码、类名、标识符</td></tr>';
  html+='<tr><td>Numeric</td><td style="'+mono+'">font-variant-numeric: tabular-nums</td><td>金额、编号、日期等需列对齐的数字；在 body 全局开启，不要只加在单列</td></tr>';
  html+='</tbody></table>';
  html+='<div class="ds-note">数字对齐使用 <code>tabular-nums</code> 等宽数字特性，不要改用等宽字体族 — 同一页面混用两套字形会造成视觉不一致。</div>';
  html+='<table class="ds-table" style="margin-top:12px"><colgroup><col style="width:60px"><col><col style="width:200px"></colgroup><thead><tr><th>字号</th><th>示例</th><th>描述</th></tr></thead><tbody>';
  sizes.forEach(function(s){html+='<tr><td style="font-family:Monaco,Menlo,monospace">'+s.px+'</td><td class="ds-type-sample" style="font-size:'+s.px+'">Lingee 设计系统</td><td>'+s.use+'</td></tr>'});
  html+='</tbody></table>';
  html+='<table class="ds-table" style="margin-top:12px"><colgroup><col style="width:60px"><col style="width:100px"><col><col></colgroup><thead><tr><th>字重</th><th>名称</th><th>示例</th><th>描述</th></tr></thead><tbody>';
  weights.forEach(function(wt){html+='<tr><td style="font-family:Monaco,Menlo,monospace">'+wt.w+'</td><td>'+wt.name+'</td><td style="font-weight:'+wt.w+';font-size:14px">Lingee — AI 编程伙伴</td><td>'+wt.desc+'</td></tr>'});
  html+='</tbody></table></div>';

  /* === 3. 阴影 === */
  var shadows=[
    {name:'Pill Shadow',val:'0 1px 2px rgba(0,0,0,.06),0 1px 3px rgba(0,0,0,.04)',varName:'--pill-shadow',use:'分段控件 · 标签页'},
    {name:'Card Hover',val:'0 4px 16px rgba(0,0,0,.07)',use:'首页卡片悬浮'},
    {name:'Composer',val:'0 4px 24px rgba(0,0,0,.05)',use:'输入框投影'},
    {name:'Menu Shadow',val:'0 8px 28px rgba(0,0,0,.12),0 2px 6px rgba(0,0,0,.06)',varName:'--menu-shadow',use:'下拉菜单 · 右键菜单'},
    {name:'Modal',val:'0 12px 40px rgba(0,0,0,.15),0 4px 12px rgba(0,0,0,.08)',use:'弹窗投影'},
    {name:'Panel',val:'0 16px 48px rgba(0,0,0,.18)',use:'快捷键面板 · 抽屉'},
    {name:'Button Glow',val:'0 2px 8px rgba(73,93,255,.28)',use:'主按钮投影'},
    {name:'Tooltip',val:'0 2px 8px rgba(0,0,0,.15)',use:'提示气泡'}
  ];
  html+='<div class="ds-table-group"><div class="ds-table-group-title">阴影 Shadow</div>';
  html+='<table class="ds-table"><colgroup><col style="width:44px"><col style="width:120px"><col><col style="width:160px"></colgroup><thead><tr><th></th><th>名称</th><th>CSS 值</th><th>描述</th></tr></thead><tbody>';
  shadows.forEach(function(s){
    html+='<tr><td><span class="ds-shadow-sm" style="box-shadow:'+s.val+'"></span></td><td>'+s.name+'</td><td style="font-family:Monaco,Menlo,monospace;font-size:14px;color:var(--text-muted)">'+s.val+(s.varName?' <span style="color:#7c7cf0">var('+s.varName+')</span>':'')+'</td><td>'+s.use+'</td></tr>';
  });
  html+='</tbody></table></div>';

  /* === 4. 圆角 === */
  var radii=[
    {px:'4px',use:'标签 · kbd'},{px:'6px',use:'徽标 · 小按钮'},
    {px:'8px',use:'导航项 · chip · 图标按钮'},{px:'10px',use:'搜索框 · 标签页 · 按钮组'},
    {px:'12px',use:'消息气泡 · 右键菜单'},{px:'14px',use:'弹窗 · 下拉菜单 · 组件卡'},
    {px:'16px',use:'首页卡片 · 应用卡片 · 通知面板'},{px:'20px',use:'输入框 (Composer)'}
  ];
  html+='<div class="ds-table-group"><div class="ds-table-group-title">圆角 Radius</div>';
  html+='<table class="ds-table"><colgroup><col style="width:44px"><col style="width:60px"><col></colgroup><thead><tr><th></th><th>值</th><th>描述</th></tr></thead><tbody>';
  radii.forEach(function(r){
    html+='<tr><td><span class="ds-radius-sm" style="border-radius:'+r.px+'"></span></td><td style="font-family:Monaco,Menlo,monospace">'+r.px+'</td><td>'+r.use+'</td></tr>';
  });
  html+='</tbody></table></div>';
  return html;
}

export { renderGlobalStyles };
