import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/app.tsx'], bundle: true, minify: true,
  outfile: 'dist/app.js', loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' }, jsx: 'automatic', target: ['es2020'] });
await copyFile('src/index.html', 'dist/index.html');
