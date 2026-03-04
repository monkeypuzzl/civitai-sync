import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'dev/ui/src';
const DIST = 'src/ui';
const watch = process.argv.includes('--watch');

fs.mkdirSync(DIST, { recursive: true });

fs.copyFileSync(path.join(SRC, 'index.html'), path.join(DIST, 'index.html'));

const ctx = await esbuild.context({
  entryPoints: [
    path.join(SRC, 'app.jsx'),
    path.join(SRC, 'styles', 'main.css')
  ],
  bundle: true,
  outdir: DIST,
  format: 'esm',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.jsx': 'jsx', '.js': 'js', '.css': 'css' },
  logLevel: 'info'
});

if (watch) {
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
