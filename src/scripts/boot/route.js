import { $, $$ } from '../core/dom.js';
import { navItems, setNavActive, showView } from '../core/view.js';
import { chatAppDd, selectChatApp } from '../features/attach-app.js';
import { set_cvPendingProj, set_cvPendingTab } from '../features/collab/view.js';
import { appendAssistantMessage, appendUserMessage, messagesList, restoreChatSession, simulateAIResponse } from '../features/composer.js';
import { dsNavEl, renderOverview } from '../features/design/index.js';
import { stripBase } from '../core/base-path.js';
import { openChangelog } from '../features/changelog.js';
/* 启动路由：从路径 / 旧链接 / localStorage 还原视图
   拆分自 src/scripts/main.js，逻辑逐行保留；副作用集中在下方 init* 函数里，
   由 main.js 按拆分前的原始顺序调用。 */


/* 路径优先解析视图，兼容旧 ?view= 链接，无则从 localStorage 恢复 */
var _savedPath=localStorage.getItem('lingeeUrlState')||'';
var _pathParts=stripBase(location.pathname).replace(/^\/+|\/+$/g,'').split('/');
/* showView() 里的 setUrlState 会把查询串抹掉，所以在任何视图切换之前先存下来 */
var _origSearch=location.search;
/* showView() 对认不出的名字会把九个视图全部隐藏（线上曾因此登录后一片空白），
   所以路径段必须先过白名单，认不出就按「没指定」处理，走默认/localStorage 恢复 */
var VIEW_NAMES=['home','newtask','chat','apps','collab','skills','agents','settings','design','experts','tasks','changelog','inbox'];
var _seg=_pathParts[0]||'';
var dsViewParam=VIEW_NAMES.indexOf(_seg)>=0 ? _seg : '';
var dsSearch;
var dsTokenParam;

export function initRoute() {
  if(!dsViewParam){
    var _oldView=new URLSearchParams(location.search).get('view');
    if(_oldView) dsViewParam=_oldView;
    else if(_savedPath){ var _m=_savedPath.match(/\/([^\/?]+)/); if(_m) dsViewParam=_m[1]; }
  }
  /* 专家视图已并入协作开发，兼容旧链接 */
  if(dsViewParam==='experts') dsViewParam='collab';
  dsSearch='?'+(dsViewParam?'view='+dsViewParam:'');
  dsTokenParam=new URLSearchParams(location.search).get('token')||new URLSearchParams(dsSearch).get('token');
  if(dsViewParam==='design'){
    showView('design');
    if(navItems) navItems.forEach(function(n){n.classList.remove('active')});
    if(dsTokenParam){
      var tokenLink=$$('.ds-nav-link',dsNavEl).filter(function(l){return l.getAttribute('data-comp')===dsTokenParam;})[0];
      if(tokenLink) tokenLink.click();
      else renderOverview();
    }else{
      renderOverview();
    }
  }else if(dsViewParam==='chat'){
    showView('chat');
    setNavActive('新会话');
    if(!restoreChatSession()){
      /* 没有可恢复的会话时保留原有演示内容 */
      var title='采购订单管理应用开发';
      $('#chatTitle').textContent=title;
      if(messagesList) messagesList.innerHTML='';
      appendUserMessage('帮我开发'+title+'功能');
      var responseEl=appendAssistantMessage();
      simulateAIResponse(responseEl,true);
      selectChatApp('采购订单管理');
      if(chatAppDd) chatAppDd.classList.add('disabled');
    }
  }else if(dsViewParam==='changelog'){
    openChangelog();
  }else if(dsViewParam && dsViewParam!=='newtask'){
    showView(dsViewParam);
    if(dsViewParam==='skills') setNavActive('技能开发');
    else if(dsViewParam==='agents') setNavActive('智能体开发');
    else if(dsViewParam==='apps') setNavActive('应用开发');
    else if(dsViewParam==='tasks') setNavActive('任务');
    else if(dsViewParam==='collab'){
      setNavActive('协作开发');
      /* 协作开发模块最后才初始化，这里只记下要打开的页签。
         取真实的 location.search：dsSearch 是为兼容旧 ?view= 链接合成的，
         只含 view=，读不到 setUrlState 写进地址栏的 tab= / proj=。 */
      var cvQuery=new URLSearchParams(_origSearch);
      set_cvPendingTab(cvQuery.get('tab')||'tasks');
      set_cvPendingProj(cvQuery.get('proj')||'');
    }
  }else{
    /* 默认显示新会话 */
    showView('newtask');
    setNavActive('新会话');
  }
  /* 清除防闪烁标记：showView() 已设置好各视图的 hidden class，
     后续视图切换完全由 class 控制，不再需要内联 CSS 介入 */
  document.documentElement.removeAttribute('data-initial-view');
}
