import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import htmlInclude from './build/vite-plugin-html-include.js';
import spaFallback from './build/vite-plugin-spa-fallback.js';
import pages404 from './build/vite-plugin-pages-404.js';
import { resolve } from 'node:path';

function localSqlite() {
  return {
    name:'lingee-local-sqlite',
    apply:'serve',
    async configureServer(server) {
      const { createSharedStorage } = await import('./server/shared-storage.mjs');
      const storage = createSharedStorage(resolve(process.env.LINGEE_SQLITE_PATH || 'data/lingee.sqlite'));
      server.middlewares.use(storage.middleware);
      server.httpServer?.on('close',storage.close);
    },
  };
}

// 演示原型：构建产出单个可双击打开的 index.html
export default defineConfig({
  base: '/lingee/',
  plugins: [
    localSqlite(),
    spaFallback(),
    htmlInclude(),
    viteSingleFile(),
    {
      // viteSingleFile 的 config 钩子(enforce:post)会把 base 覆盖为 './'，
      // 导致 dev 模式下 base 被解析为 '/'，baseMiddleware 不注册，
      // /lingee/ 前缀的 CSS/JS 请求全部 fallback 到 index.html。
      // 这里在它之后恢复 dev 模式的 base；build 模式保持 './'。
      name: 'restore-dev-base',
      enforce: 'post',
      config(_, { command }) {
        if (command === 'serve') return { base: '/lingee/' };
      },
    },
    pages404(),
  ],
  server: { host:'0.0.0.0', port: Number(process.env.PORT) || 5199, open: true },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
