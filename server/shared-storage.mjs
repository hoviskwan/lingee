import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SHARED_STORAGE_KEYS } from '../src/scripts/core/shared-keys.js';

const allowed = new Set(SHARED_STORAGE_KEYS);
const maxValueBytes = 10 * 1024 * 1024;

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  let chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxValueBytes + 4096) throw new Error('请求数据过大');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createSharedStorage(dbPath) {
  mkdirSync(dirname(dbPath), { recursive:true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY, value TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL) STRICT; CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;');
  const get = db.prepare('SELECT key, value, revision FROM storage WHERE key = ?');
  const all = db.prepare('SELECT key, value, revision FROM storage ORDER BY key');
  const insert = db.prepare("INSERT INTO storage (key,value,revision,updated_at) VALUES (?,?,1,datetime('now'))");
  const update = db.prepare("UPDATE storage SET value=?, revision=revision+1, updated_at=datetime('now') WHERE key=?");
  const remove = db.prepare('DELETE FROM storage WHERE key=?');
  const count = db.prepare('SELECT COUNT(*) AS count FROM storage');
  const initialized = db.prepare("SELECT value FROM meta WHERE key='initialized'");
  const markInitialized = db.prepare("INSERT INTO meta (key,value) VALUES ('initialized','1')");

  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  async function middleware(req, res, next) {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path !== '/lingee/api/storage') return next();
    if (req.method === 'POST' && req.headers?.origin && new URL(req.headers.origin).host !== req.headers.host) {
      send(res, 403, { error:'cross_origin_denied' }); return;
    }
    if (req.method === 'GET') {
      send(res, 200, { entries:all.all(), empty:!initialized.get() });
      return;
    }
    if (req.method !== 'POST') { send(res, 405, { error:'method_not_allowed' }); return; }
    try {
      const body = await readJson(req);
      if (body?.action === 'initialize') {
        const entries = body.entries;
        if (!Array.isArray(entries) || entries.some(row => !allowed.has(row?.key) || typeof row.value !== 'string' || Buffer.byteLength(row.value) > maxValueBytes)) {
          send(res, 400, { error:'invalid_entries' }); return;
        }
        const result = transaction(() => {
          if (initialized.get() || count.get().count) return false;
          for (const row of entries) insert.run(row.key, row.value);
          markInitialized.run();
          return true;
        });
        send(res, result ? 200 : 409, result ? { entries:all.all() } : { error:'already_initialized', entries:all.all() });
        return;
      }
      if (body?.action === 'batch') {
        const operations = body.operations;
        if (!Array.isArray(operations) || !operations.length || operations.length > allowed.size
          || new Set(operations.map(row => row?.key)).size !== operations.length
          || operations.some(row => !allowed.has(row?.key) || !['set','remove'].includes(row.action)
            || !Number.isInteger(row.expectedRevision) || row.expectedRevision < 0
            || row.action === 'set' && (typeof row.value !== 'string' || Buffer.byteLength(row.value) > maxValueBytes))) {
          send(res, 400, { error:'invalid_batch' }); return;
        }
        const result = transaction(() => {
          const conflicts = operations.filter(row => {
            const current = get.get(row.key);
            if (row.action === 'set' && current?.value === row.value) return false;
            if (row.action === 'remove' && !current) return false;
            return (current?.revision || 0) !== row.expectedRevision;
          });
          if (conflicts.length) return { conflicts:conflicts.map(row => ({ key:row.key, current:get.get(row.key) })) };
          for (const row of operations) {
            if (row.action === 'remove') { remove.run(row.key); continue; }
            const current = get.get(row.key);
            if (current?.value === row.value) continue;
            if (current) update.run(row.value,row.key); else insert.run(row.key,row.value);
          }
          return { revisions:Object.fromEntries(operations.map(row => [row.key,get.get(row.key)?.revision || 0])) };
        });
        send(res, result.conflicts ? 409 : 200, result);
        return;
      }
      if (body?.action !== 'set' && body?.action !== 'remove' || !allowed.has(body.key)
        || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0
        || body.action === 'set' && (typeof body.value !== 'string' || Buffer.byteLength(body.value) > maxValueBytes)) {
        send(res, 400, { error:'invalid_write' }); return;
      }
      const result = transaction(() => {
        const current = get.get(body.key);
        if ((current?.revision || 0) !== body.expectedRevision) return { conflict:true, current };
        if (body.action === 'remove') { if (current) remove.run(body.key); return { revision:0 }; }
        if (current) update.run(body.value, body.key); else insert.run(body.key, body.value);
        return { revision:get.get(body.key).revision };
      });
      send(res, result.conflict ? 409 : 200, result);
    } catch (error) { send(res, 400, { error:'invalid_request', message:error.message }); }
  }

  return { middleware, close:() => db.close() };
}
