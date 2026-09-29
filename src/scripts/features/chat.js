import { $, $$ } from '../core/dom.js';
import { toast } from '../core/toast.js';
/* 会话页：产物预览、预览展开、历史版本面板
   拆分自 src/scripts/main.js，逻辑逐行保留；副作用集中在下方 init* 函数里，
   由 main.js 按拆分前的原始顺序调用。 */


/* ---------- 预览：编辑 / 选择元素按钮 ---------- */
function previewDoc(){
  var f=$('#chatPreviewFrame');
  try{ return f&&f.contentDocument }catch(e){ return null }
}
var previewEditBtn=$('#previewEdit'), previewPickBtn=$('#previewPick');
function setPickMode(on){
  var d=previewDoc(); if(!d||!d.body)return;
  d.body.classList.toggle('pick-mode',on);
  if(on&&!d._pickBound){
    d._pickBound=true;
    d.addEventListener('mouseover',function(e){
      if(!d.body.classList.contains('pick-mode'))return;
      if(d._hovered) d._hovered.style.outline='';
      d._hovered=e.target;
      e.target.style.outline='2px solid #495dff';
      e.target.style.outlineOffset='-2px';
    },true);
    d.addEventListener('click',function(e){
      if(!d.body.classList.contains('pick-mode'))return;
      e.preventDefault(); e.stopPropagation();
      var t=e.target;
      var n=t.tagName.toLowerCase()+(t.className?'.'+String(t.className).split(' ').join('.'):'');
      toast('已选中 '+n);
    },true);
  }
  if(!on&&d._hovered){ d._hovered.style.outline=''; d._hovered=null; }
}

/* ---------- 标题栏：切换预览展开 / 收起 ---------- */
var togglePreviewBtn=$('#togglePreviewBtn');
function syncTogglePreviewBtn(){
  if(!togglePreviewBtn)return;
  var view=$('#view-chat');
  var open=view.classList.contains('preview-open')||view.classList.contains('doc-open');
  togglePreviewBtn.classList.toggle('on',open);
  togglePreviewBtn.setAttribute('aria-pressed',open?'true':'false');
  togglePreviewBtn.setAttribute('data-tooltip',open?'收起产物预览':'显示预览');
}
/* ---------- 历史版本面板 ---------- */
var historyBtn=$('#historyBtn');
var historyPanel=$('#historyPanel');
var historyOverlay=$('#historyOverlay');
function closeHistory(){
  historyPanel.classList.remove('show');
  historyOverlay.classList.remove('show');
  historyBtn.classList.remove('on');
}

/* ---------- 预览导航历史 ---------- */
var previewHistory=[];
function pushPreviewUrl(url){
  var f=$('#chatPreviewFrame');
  var cur=f&&f.getAttribute('src')||'';
  if(cur) previewHistory.push(cur);
  if(f) f.src=url;
  var back=$('#previewBack');
  if(back) back.removeAttribute('disabled');
  var urlInput=$('#previewUrlText');
  if(urlInput) urlInput.value=url;
}
var previewBackBtn;
function popPreviewUrl(){
  if(!previewHistory.length)return;
  var f=$('#chatPreviewFrame'); if(!f)return;
  var url=previewHistory.pop();
  f.src=url;
  var urlInput=$('#previewUrlText');
  if(urlInput) urlInput.value=url;
  var back=$('#previewBack');
  if(back) back.disabled=!previewHistory.length;
}

export function initPreview() {
  previewBackBtn=$('#previewBack');
  if(previewBackBtn) previewBackBtn.addEventListener('click',popPreviewUrl);
  if(previewEditBtn){
    previewEditBtn.addEventListener('click',function(){
      var on=!previewEditBtn.classList.contains('on');
      previewEditBtn.classList.toggle('on',on);
      previewEditBtn.setAttribute('aria-pressed',on?'true':'false');
      var d=previewDoc(); if(d) d.designMode=on?'on':'off';
      if(on&&previewPickBtn&&previewPickBtn.classList.contains('on')){
        previewPickBtn.classList.remove('on');
        previewPickBtn.setAttribute('aria-pressed','false');
        setPickMode(false);
      }
      if(on) pushPreviewUrl('https://feature.kingdee.com:1026/feature_vb/?byPageId=root1e74498fa8d347ae969274e1708de3cb&isCosmicUI=true');
      else popPreviewUrl();
    });
  }
  if(previewPickBtn){
    previewPickBtn.addEventListener('click',function(){
      var on=!previewPickBtn.classList.contains('on');
      previewPickBtn.classList.toggle('on',on);
      previewPickBtn.setAttribute('aria-pressed',on?'true':'false');
      if(on&&previewEditBtn&&previewEditBtn.classList.contains('on')){
        previewEditBtn.classList.remove('on');
        previewEditBtn.setAttribute('aria-pressed','false');
        var d=previewDoc(); if(d) d.designMode='off';
      }
      setPickMode(on);
    });
  }
  if(togglePreviewBtn){
    togglePreviewBtn.addEventListener('click',function(){
      var view=$('#view-chat');
      if(view.classList.contains('doc-open')){
        var docClose=$('#chatDocViewerClose'); if(docClose) docClose.click();
      }else if(view.classList.contains('preview-open')){
        var cb=$('#chatPreviewClose'); if(cb) cb.click();
      }else{
        var card=$('.artifact-card');
        if(card) card.click(); else return;
      }
      syncTogglePreviewBtn();
    });
  }
}

export function initHistoryPanel() {
  if(historyBtn){
    historyBtn.addEventListener('click',function(){
      var isShow=historyPanel.classList.contains('show');
      if(isShow){ closeHistory(); }
      else{ historyPanel.classList.add('show'); historyOverlay.classList.add('show'); historyBtn.classList.add('on'); }
    });
    $('#historyPanelClose').addEventListener('click',closeHistory);
    historyOverlay.addEventListener('click',closeHistory);
    $$('.history-item-time').forEach(function(el){
      var t=el.dataset.time; if(!t) return;
      var d=new Date(t),now=new Date(),diff=(now-d)/60000;
      if(diff<1) el.textContent='刚刚';
      else if(diff<60) el.textContent=Math.floor(diff)+' 分钟前';
      else if(diff<1440) el.textContent=Math.floor(diff/60)+' 小时前';
      else if(diff<2880) el.textContent='昨天';
      else if(diff<10080) el.textContent=Math.floor(diff/1440)+' 天前';
    });
    var restoreModal=$('#historyRestoreModal');
    $$('.history-item-restore').forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        var item=btn.closest('.history-item');
        var ver=item.querySelector('.history-item-version').textContent.trim();
        restoreModal.classList.add('show');
        $('#historyRestoreText').textContent='确定回退到 '+ver+'？回退后当前版本将被覆盖。';
        var close=function(){restoreModal.classList.remove('show')};
        $('#historyRestoreClose').onclick=close;
        $('#historyRestoreCancel').onclick=close;
        restoreModal.onclick=function(ev){if(ev.target===restoreModal)close()};
        $('#historyRestoreConfirm').onclick=function(){
          close();
          closeHistory();
          var pl=$('#previewLoading');
          if(pl){pl.classList.add('show');setTimeout(function(){pl.classList.remove('show');toast('已恢复 '+ver);},1200);}
          else toast('已恢复 '+ver);
        };
      });
    });
  }
}

export { closeHistory, historyBtn, historyPanel, syncTogglePreviewBtn };
