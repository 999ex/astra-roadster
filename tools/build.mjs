import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export async function buildHtml() {
  const result = await build({
    entryPoints: [path.join(ROOT, 'src/main.js')],
    bundle: true,
    format: 'esm',
    write: false,
    target: 'es2022',
    external: ['three', 'three/addons/*'],
    legalComments: 'none',
  });
  const js = result.outputFiles[0].text;
  const template = await fs.readFile(path.join(ROOT, 'index.template.html'), 'utf8');
  return template.replace('<!-- BUNDLE -->', () => `<script type="module">\n${js}</script>`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const html = await buildHtml();
  await fs.writeFile(path.join(ROOT, 'index.html'), html);
  console.log(`index.html written (${(html.length / 1024).toFixed(1)} KB)`);
}
