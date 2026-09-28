import { $, $$ } from '../core/dom.js';
import { showView } from '../core/view.js';
import { toast } from '../core/toast.js';
/* 用户行为分析看板
   渲染 KPI、趋势图、模式分布、功能排行、事件流、热力图 */

var range7=[85,120,95,140,110,135];
var range30=Array.from({length:12},function(_,i){return 60+Math.round(Math.sin(i/2)*30+Math.random()*20+Math.pow(i/11,2)*50)});
/* 用户增长数据 */
var userRange7=[520,580,650,720,790,860];
var userRange30=[320,380,420,480,520,560,600,640,680,720,780,860];
var custRange7=[350,380,410,440,470,500];
var custRange30=[250,280,310,340,370,400,420,440,460,480,500,520];

var modeData=[
  {name:'苍穹应用',count:342,color:'#495dff'},
  {name:'通用应用',count:198,color:'#08a040'},
  {name:'技能开发',count:87,color:'#ff8d42'},
  {name:'智能体开发',count:56,color:'#e04a3a'},
  {name:'原型探索',count:28,color:'#767676'}
];

var errorData=[
  {page:'应用开发',button:'部署',error:'应用配置校验失败：缺少必填参数',count:128},
  {page:'技能开发',button:'保存技能',error:'技能名称不能包含特殊字符',count:96},
  {page:'会话',button:'发送',error:'任务描述不能为空',count:85},
  {page:'智能体开发',button:'发布',error:'技能未绑定，无法发布智能体',count:72},
  {page:'协作开发',button:'邀请成员',error:'邮箱格式不正确',count:64},
  {page:'设置',button:'测试连接',error:'数据库连接超时，请检查网络配置',count:48},
  {page:'编辑详情弹窗',button:'保存',error:'名称不能为空',count:45},
  {page:'删除确认弹窗',button:'确认删除',error:'该记录已被引用，无法删除',count:38},
  {page:'应用开发',button:'生成代码',error:'模板解析失败：字段映射不完整',count:36},
  {page:'技能开发',button:'导出技能',error:'未选择导出格式，无法导出',count:28},
  {page:'会话',button:'停止生成',error:'当前无执行中的任务',count:22},
  {page:'协作开发',button:'提交评审',error:'评审人不能为空',count:18}
];

function renderPie(){
  var el=$('#pieChart'); if(!el) return;
  var leg=$('#pieLegend'); if(!leg) return;
  var total=modeData.reduce(function(s,d){return s+d.count},0);
  var r=70,cx=80,cy=80;
  var startAngle=-90;
  var paths='';
  modeData.forEach(function(d){
    var pct=d.count/total;
    var pctR=Math.round(pct*100);
    var endAngle=startAngle+pct*360;
    var sRad=startAngle*Math.PI/180;
    var eRad=endAngle*Math.PI/180;
    var x1=cx+r*Math.cos(sRad),y1=cy+r*Math.sin(sRad);
    var x2=cx+r*Math.cos(eRad),y2=cy+r*Math.sin(eRad);
    var large=pct>0.5?1:0;
    paths+='<path d="M'+cx+','+cy+' L'+x1+','+y1+' A'+r+','+r+' 0 '+large+' 1 '+x2+','+y2+' Z" fill="'+d.color+'" opacity=".85" stroke="#fff" stroke-width="1.5" class="pie-slice" data-name="'+d.name+'" data-count="'+d.count+'" style="cursor:pointer;transition:opacity .15s"/>';
    if(pct>=0.08){
      var midAngle=(startAngle+endAngle)/2;
      var midRad=midAngle*Math.PI/180;
      var tx=cx+(r*0.62)*Math.cos(midRad);
      var ty=cy+(r*0.62)*Math.sin(midRad);
      paths+='<text x="'+tx+'" y="'+ty+'" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="600" fill="#fff" pointer-events="none">'+pctR+'%</text>';
    }
    startAngle=endAngle;
  });
  paths+='<circle cx="'+cx+'" cy="'+cy+'" r="30" fill="#fff"/>';
  paths+='<text x="'+cx+'" y="'+(cy-2)+'" text-anchor="middle" font-size="15" font-weight="600" fill="#2d2d2d">'+total+'</text>';
  paths+='<text x="'+cx+'" y="'+(cy+13)+'" text-anchor="middle" font-size="9" fill="#767676">总数</text>';
  el.innerHTML='<svg width="160" height="160" viewBox="0 0 160 160">'+paths+'</svg>';
  var slices=$$('.pie-slice',el);
  slices.forEach(function(s){
    s.addEventListener('mouseenter',function(){
      s.style.opacity='1';
      var name=s.getAttribute('data-name');
      var count=s.getAttribute('data-count');
      var tip=document.createElement('div');
      tip.className='pie-tooltip';
      tip.textContent=name+'：'+count+' 次';
      tip.style.cssText='position:fixed;background:#2d2d2d;color:#fff;padding:4px 10px;border-radius:6px;font-size:12px;pointer-events:none;z-index:9999;white-space:nowrap;';
      document.body.appendChild(tip);
      s._tip=tip;
      document.addEventListener('mousemove',function mv(e){
        if(s._tip){s._tip.style.left=(e.clientX+12)+'px';s._tip.style.top=(e.clientY-8)+'px';}
      });
      s._mv=mv;
    });
    s.addEventListener('mouseleave',function(){
      s.style.opacity='.85';
      if(s._tip){s._tip.remove();s._tip=null;}
      if(s._mv){document.removeEventListener('mousemove',s._mv);s._mv=null;}
    });
  });
  var lh='';
  modeData.forEach(function(d){
    lh+='<div class="pie-leg-item"><span class="pie-dot" style="background:'+d.color+'"></span><span class="pie-leg-name">'+d.name+'</span></div>';
  });
  leg.innerHTML=lh;
}

function buildLine(data,color,w,h,padL,padR,padT,padB,yMax,yMin){
  var cw=w-padL-padR,ch=h-padT-padB;
  var stepX=cw/(data.length-1);
  var pts=data.map(function(v,i){
    var x=padL+i*stepX;
    var y=padT+ch-(v-yMin)/(yMax-yMin||1)*ch;
    return {x:x,y:y};
  });
  var dots=pts.map(function(p){
    return '<circle cx="'+p.x+'" cy="'+p.y+'" r="3" fill="'+color+'" opacity="0" style="animation:dotPop .3s ease forwards;animation-delay:'+(i*40)+'ms"/>';
  }).join('');
  /* 平滑曲线 path */
  var d='M '+pts[0].x+','+pts[0].y;
  for(var i=0;i<pts.length-1;i++){
    var p0=pts[i],p1=pts[i+1];
    var cpx=(p0.x+p1.x)/2;
    d+=' C '+cpx+','+p0.y+' '+cpx+','+p1.y+' '+p1.x+','+p1.y;
  }
  var pathLen=2000;
  return '<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="'+pathLen+'" stroke-dashoffset="'+pathLen+'" style="animation:drawPath .8s ease forwards"/>'+dots;
}

function renderTrend(data){
  var el=$('#trendChart'); if(!el) return;
  var w=el.offsetWidth||400,h=220;
  var padL=40,padR=15,padT=15,padB=25;
  var ud=(data===range7)?userRange7:userRange30;
  var cd=(data===range7)?custRange7:custRange30;
  var allVals=ud.concat(cd);
  var yMax=Math.max.apply(null,allVals)*1.1;
  var yMin=Math.min.apply(null,allVals)*0.9;
  /* Y 轴标签 */
  var yLabels='';
  for(var yi=0;yi<=4;yi++){
    var val=Math.round(yMin+(yMax-yMin)*yi/4);
    var yp=padT+(h-padT-padB)-(yi/4)*(h-padT-padB);
    yLabels+='<text x="'+(padL-6)+'" y="'+(yp+4)+'" text-anchor="end" font-size="13" fill="#b8b8b8">'+val+'</text>';
    yLabels+='<line x1="'+padL+'" y1="'+yp+'" x2="'+(w-padR)+'" y2="'+yp+'" stroke="#f0f0f0" stroke-width="1"/>';
  }
  /* X 轴标签 */
  var xLabels='';
  var labels7=['4月','5月','6月','7月','8月','9月'];
  var labels30=['10月','11月','12月','1月','2月','3月','4月','5月','6月','7月','8月','9月'];
  var xLabelsArr=(data===range7)?labels7:labels30;
  var stepX=(w-padL-padR)/(data.length-1);
  xLabelsArr.forEach(function(lbl,i){
    if(lbl==='.')return;
    var xp=padL+i*stepX;
    xLabels+='<text x="'+xp+'" y="'+(h-5)+'" text-anchor="middle" font-size="13" fill="#b8b8b8">'+lbl+'</text>';
  });
  /* 图例 - 使用 HTML 而非 SVG text，避免字号异常 */
  var legendHtml='<div style="position:absolute;top:-36px;right:0;display:flex;gap:12px;font-size:13px;color:#767676">'+
    '<span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;background:#495dff;border-radius:1px;display:inline-block"></span>用户数</span>'+
    '<span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;background:#08a040;border-radius:1px;display:inline-block"></span>客户数</span>'+
    '</div>';
  el.style.opacity='0';
  el.style.transform='translateY(8px)';
  el.style.position='relative';
  el.innerHTML=legendHtml+'<svg width="100%" height="'+h+'" viewBox="0 0 '+w+' '+h+'">'+
    yLabels+xLabels+
    buildLine(ud,'#495dff',w,h,padL,padR,padT,padB,yMax,yMin)+
    buildLine(cd,'#08a040',w,h,padL,padR,padT,padB,yMax,yMin)+
    '</svg>';
  requestAnimationFrame(function(){
    el.style.transition='opacity .25s ease, transform .25s ease';
    el.style.opacity='1';
    el.style.transform='translateY(0)';
  });
}

function renderHeatmap(){
  var el=$('#heatmap'); if(!el) return;
  var days=['周一','周二','周三','周四','周五','周六','周日'];
  var html='';
  /* 表头 */
  html+='<div class="heatmap-label"></div>';
  for(var h2=0;h2<24;h2++){html+='<div class="heatmap-label" style="text-align:center;font-size:10px">'+h2+'</div>'}
  /* 数据行 */
  days.forEach(function(d,di){
    html+='<div class="heatmap-label">'+d+'</div>';
    for(var hi=0;hi<24;hi++){
      var v=Math.random();
      var bg;
      if(v<0.15)bg='rgba(73,93,255,.06)';
      else if(v<0.35)bg='rgba(73,93,255,.18)';
      else if(v<0.6)bg='rgba(73,93,255,.35)';
      else if(v<0.85)bg='rgba(73,93,255,.55)';
      else bg='rgba(73,93,255,.8)';
      var peak=(hi>=9&&hi<=18&&di<5)?1.5:0.5;
      if(v*peak<0.15)bg='rgba(73,93,255,.06)';
      html+='<div class="heatmap-cell" style="background:'+bg+'" title="'+d+' '+hi+':00"></div>';
    }
  });
  el.innerHTML=html;
}

function renderErrorTable(){
  var body=$('#errorTableBody'); if(!body) return;
  var html='';
  errorData.forEach(function(d){
    html+='<tr><td>'+d.page+'</td><td>'+d.button+'</td><td class="error-msg">'+d.error+'</td><td class="error-count">'+d.count+'</td></tr>';
  });
  body.innerHTML=html;
}

export function initAnalytics(){
  var rangeBtns=$$('.range-btn');
  renderTrend(range7);
  renderHeatmap();
  renderPie();
  renderErrorTable();
  rangeBtns.forEach(function(btn){
    btn.addEventListener('click',function(){
      rangeBtns.forEach(function(b){b.classList.remove('active')});
      btn.classList.add('active');
      var r=btn.getAttribute('data-range');
      if(r==='7')renderTrend(range7);
      else renderTrend(range30);
    });
  });
}
