import { tkGetTaskArtifacts } from '../tasks-v2/data.js';
import { escapeHtml } from '../tasks-v2/ui-utils.js';

/* T06 产物展示入口。T00 保留当前演示产物，真实关联由 T01/T06 替换。 */
export function renderIssueArtifacts(task) {
  var artifacts = tkGetTaskArtifacts(task);
  return '<section class="tk-drawer-artifacts"><div class="tk-artifacts-heading"><span>产物</span><span>' + artifacts.length + ' 项</span></div>' +
    '<div class="tk-artifacts-list">' + artifacts.map(function (artifact) {
      return '<details class="tk-artifact">' +
        '<summary class="tk-artifact-summary">' +
          '<span class="tk-artifact-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg></span>' +
          '<span class="tk-artifact-title">' + escapeHtml(artifact.docTitle || (task.title + ' · ' + artifact.type)) + '</span>' +
          '<span class="tk-artifact-type">' + escapeHtml(artifact.type) + '</span>' +
          '<svg class="tk-artifact-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>' +
        '</summary>' +
        '<div class="tk-artifact-preview">' +
          '<p class="tk-artifact-subtitle">' + escapeHtml(artifact.summary) + '</p><div class="tk-artifact-meta">' + escapeHtml(artifact.author) + ' · ' + escapeHtml(artifact.date) + '</div>' +
          artifact.sections.map(function (section) {
            return '<div class="tk-artifact-section"><strong>' + escapeHtml(section.heading) + '</strong>' + renderArtifactBlocks(section) + '</div>';
          }).join('') +
        '</div></details>';
    }).join('') + '</div></section>';
}

// 供工作详情和审核面板共用；只渲染传入快照，不读写别页 DOM。
export function renderArtifactPreview(artifact, headingTag = 'strong') {
  if (!artifact) return '';
  if (typeof artifact.content === 'string') return '<pre>' + escapeHtml(artifact.content) + '</pre>';
  var tag = headingTag === 'h2' ? 'h2' : 'strong';
  return (artifact.sections || []).map(function (section) {
    return '<div class="tk-artifact-section"><' + tag + '>' + escapeHtml(section.heading) + '</' + tag + '>' + renderArtifactBlocks(section) + '</div>';
  }).join('');
}

/* 产物正文块：p 段落、ul/ol 列表、table 表格、code 代码、note 提示；兼容旧的 text 字段。 */
export function renderArtifactBlocks(section) {
  var blocks = section.blocks || (section.text ? [{ p: section.text }] : []);
  return blocks.map(function (b) {
    if (b.p) return '<p class="tk-doc-p">' + escapeHtml(b.p) + '</p>';
    if (b.ul || b.ol) {
      var tag = b.ul ? 'ul' : 'ol';
      return '<' + tag + ' class="tk-doc-list">' + (b.ul || b.ol).map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</' + tag + '>';
    }
    if (b.table) {
      return '<div class="tk-doc-table-wrap"><table class="tk-doc-table"><thead><tr>' +
        b.table.head.map(function (h) { return '<th>' + escapeHtml(h) + '</th>'; }).join('') +
        '</tr></thead><tbody>' +
        b.table.rows.map(function (row) { return '<tr>' + row.map(function (cell) { return '<td>' + escapeHtml(cell) + '</td>'; }).join('') + '</tr>'; }).join('') +
        '</tbody></table></div>';
    }
    if (b.app) {
      var app = b.app;
      return '<div class="tk-demo-app" aria-label="' + escapeHtml(app.title) + ' 页面预览">' +
        '<div class="tk-demo-app-head"><div><small>' + escapeHtml(app.subtitle) + '</small><strong>' + escapeHtml(app.title) + '</strong></div><span class="tk-demo-app-primary">＋ 新建</span></div>' +
        '<div class="tk-demo-app-stats">' + app.stats.map(function (item) { return '<div><span>' + escapeHtml(item[0]) + '</span><strong>' + escapeHtml(item[1]) + '</strong></div>'; }).join('') + '</div>' +
        '<div class="tk-demo-app-toolbar">' + app.filters.map(function (filter) { return '<span>' + escapeHtml(filter) + '</span>'; }).join('') + '<b>查询</b></div>' +
        '<div class="tk-doc-table-wrap"><table class="tk-doc-table"><thead><tr>' + app.head.map(function (h) { return '<th>' + escapeHtml(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + app.rows.map(function (row) { return '<tr>' + row.map(function (cell) { return '<td>' + escapeHtml(cell) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
        '<div class="tk-demo-app-foot">共 ' + app.rows.length + ' 条演示记录 <span>上一页　1　下一页</span></div></div>';
    }
    if (b.code) return '<pre class="tk-doc-code"><code>' + escapeHtml(b.code) + '</code></pre>';
    if (b.note) return '<div class="tk-doc-note">' + escapeHtml(b.note) + '</div>';
    return '';
  }).join('');
}
