#!/usr/bin/env node
/* 本地预览服务器：服务 dist 构建产物。
   原型用 path 路由（/chat、/tasks 等），直接访问或刷新这些路径时
   回退到 index.html，避免静态文件服务返回 404。用法：node scripts/preview-server.mjs [端口]
   产物更新自动刷新：HTML 注入轮询脚本，/__live 返回产物 mtime，
   浏览器发现 mtime 变化即 location.reload()，npm run build 后页面自动刷新。 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

var root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
var port = Number(process.argv[2]) || 4173;
var mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json'
};

var liveReloadScript = '<script>(function(){var m0=null;function check(){'
  + 'fetch(\'/__live\',{cache:\'no-store\'}).then(function(r){return r.json()}).then(function(d){'
  + 'if(d&&typeof d.mtime===\'number\'){if(m0===null)m0=d.mtime;else if(d.mtime>m0)location.reload();}'
  + '}).catch(function(){});}check();setInterval(check,2000);})();</script>';

function injectLiveReload(html) {
  var idx = html.lastIndexOf('</body>');
  return idx === -1 ? html + liveReloadScript : html.slice(0, idx) + liveReloadScript + html.slice(idx);
}

async function entryMtime() {
  try { return Math.round((await stat(path.join(root, 'index.html'))).mtimeMs); } catch { return 0; }
}

http.createServer(async function (req, res) {
  try {
    var urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (urlPath === '/__live') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ mtime: await entryMtime() }));
      return;
    }
    var filePath = path.normalize(path.join(root, urlPath));
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    var file = filePath;
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    } catch {
      file = path.join(root, 'index.html'); /* 路由路径（如 /chat）回退到单页入口 */
    }
    var data = await readFile(file);
    var type = mime[path.extname(file).toLowerCase()] || 'application/octet-stream';
    if (type === 'text/html; charset=utf-8') data = Buffer.from(injectLiveReload(data.toString()));
    res.writeHead(200, { 'content-type': type });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(port, '127.0.0.1', function () {
  console.log('Preview: serving ' + root + ' at http://127.0.0.1:' + port + '/ (auto reload on rebuild)');
});
