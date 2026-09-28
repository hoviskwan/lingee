import { SHARED_STORAGE_KEYS } from './core/shared-keys.js';

const api = '/lingee/api/storage';
const sharedStorageEnabled = import.meta.env.DEV && import.meta.env.VITE_SHARED_STORAGE === '1';
const shared = new Set(SHARED_STORAGE_KEYS);
const nativeGet = Storage.prototype.getItem;
const nativeSet = Storage.prototype.setItem;
const nativeRemove = Storage.prototype.removeItem;

function notice(message, action) {
  let bar = document.getElementById('lingee-shared-storage-notice');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'lingee-shared-storage-notice';
    Object.assign(bar.style, {position:'fixed',bottom:'12px',left:'12px',right:'12px',zIndex:'10000',padding:'12px 16px',background:'#fff4de',color:'#513700',border:'1px solid #e6bd6d',borderRadius:'8px',font:'14px sans-serif',boxShadow:'0 4px 18px #0002'});
    document.body.appendChild(bar);
  }
  bar.replaceChildren(document.createTextNode(message));
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.style.marginLeft = '12px';
    button.addEventListener('click', action.click);
    bar.appendChild(button);
  }
}

async function request(body) {
  const response = await fetch(api, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const result = await response.json();
  return { status:response.status, result };
}

async function startSharedStorage(snapshot) {
  window.lingeeStorageMode = 'sqlite';
  if (snapshot.empty) {
    const existing = SHARED_STORAGE_KEYS.flatMap(key => {
      const value = nativeGet.call(localStorage, key);
      return value === null ? [] : [{key,value}];
    });
    const importLocal = existing.length && window.confirm('共享数据库尚无数据。是否把此浏览器中现有的原型业务数据导入，作为局域网的初始数据？取消则从演示数据开始；原浏览器数据不会删除。');
    const initialized = await request({action:'initialize',entries:importLocal ? existing : []});
    if (initialized.status !== 200 && initialized.status !== 409) throw new Error('共享数据库初始化失败');
    snapshot = {entries:initialized.result.entries};
  }

  const values = new Map(snapshot.entries.map(row => [row.key,row.value]));
  const revisions = new Map(snapshot.entries.map(row => [row.key,row.revision]));
  const dirty = new Set();
  const conflicts = new Map();
  let sending = false;
  let timer = null;
  let remoteChanged = false;

  document.addEventListener('lingee:shared-storage-saved',() => {
    if (dirty.size || sending || conflicts.size) return;
    const state = document.getElementById('tb-save-state');
    if (state?.textContent === '正在同步到共享数据库') state.textContent = '已保存到共享数据库';
  });

  function downloadConflicts() {
    const blob = new Blob([JSON.stringify(Object.fromEntries(conflicts), null, 2)], {type:'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'lingee-unsaved-' + new Date().toISOString().replace(/[:.]/g,'-') + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function schedule(delay = 0) {
    if (timer !== null || sending || !dirty.size) return;
    timer = setTimeout(() => { timer = null; void flush(); },delay);
  }

  async function flush() {
    if (sending || !dirty.size) return;
    const keys = [...dirty].filter(key => !conflicts.has(key));
    if (!keys.length) return;
    const operations = keys.map(key => {
      const value = values.get(key);
      return {action:value === undefined ? 'remove' : 'set',key,value,expectedRevision:revisions.get(key) || 0};
    });
    keys.forEach(key => dirty.delete(key));
    sending = true;
    try {
      const {status,result} = await request({action:'batch',operations});
      if (status === 200) {
        operations.forEach(row => row.action === 'remove' ? revisions.delete(row.key) : revisions.set(row.key,result.revisions[row.key]));
      } else if (status >= 400 && status < 500) {
        operations.forEach(row => {
          const value = values.get(row.key);
          conflicts.set(row.key,value === undefined ? null : value);
          try { nativeSet.call(localStorage,'lingee-shared-conflict-' + Date.now() + '-' + row.key,JSON.stringify({key:row.key,value})); } catch (_) {}
        });
        notice(status === 409 ? '共享数据已被其他人修改，本次更改未覆盖对方。请先下载本地未保存内容，再刷新核对。' : '共享数据保存被拒绝（' + (result?.message || result?.error || status) + '），请下载未保存内容并核对。',{label:'下载未保存数据',click:downloadConflicts});
      } else { throw new Error(result?.error || '保存失败'); }
    } catch (error) {
      keys.forEach(key => dirty.add(key));
      notice('共享数据库暂时无法保存，本次更改尚未保存；服务恢复后会自动重试。');
      sending = false;
      schedule(3000);
      return;
    }
    sending = false;
    if (!dirty.size && !conflicts.size) document.dispatchEvent(new Event('lingee:shared-storage-saved'));
    schedule();
  }

  Storage.prototype.getItem = function(key) {
    return this === localStorage && shared.has(String(key)) ? values.get(String(key)) ?? null : nativeGet.call(this,key);
  };
  Storage.prototype.setItem = function(key,value) {
    if (this !== localStorage || !shared.has(String(key))) return nativeSet.call(this,key,value);
    values.set(String(key),String(value));
    if (conflicts.has(String(key))) conflicts.set(String(key),String(value));
    dirty.add(String(key));
    schedule();
  };
  Storage.prototype.removeItem = function(key) {
    if (this !== localStorage || !shared.has(String(key))) return nativeRemove.call(this,key);
    values.delete(String(key));
    if (conflicts.has(String(key))) conflicts.set(String(key),null);
    dirty.add(String(key));
    schedule();
  };

  window.addEventListener('beforeunload',event => {
    if (!dirty.size && !sending && !conflicts.size) return;
    event.preventDefault();
    event.returnValue = '';
  });
  setInterval(async () => {
    if (remoteChanged || conflicts.size) return;
    try {
      const response = await fetch(api,{cache:'no-store'});
      if (!response.ok) return;
      const latest = await response.json();
      if (latest.entries.some(row => !dirty.has(row.key) && !sending && row.revision !== (revisions.get(row.key) || 0))
        || !sending && [...revisions.keys()].some(key => !latest.entries.some(row => row.key === key))) {
        remoteChanged = true;
        notice('共享数据已有更新，请刷新页面查看。',{label:'刷新',click:() => location.reload()});
      }
    } catch (_) { /* 下一轮继续检查 */ }
  },10000);
}

async function boot() {
  window.lingeeStorageMode = 'local';
  if (sharedStorageEnabled && location.protocol !== 'file:') {
    try {
      const response = await fetch(api,{cache:'no-store'});
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('本地 SQLite 服务未启动');
      }
      await startSharedStorage(await response.json());
    } catch (error) {
      notice('无法连接本地 SQLite 服务：' + error.message + '。请检查 npm run dev:shared 的终端输出并刷新。');
      throw error;
    }
  }
  await import('./main.js');
}
void boot();
