import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHtml } from '../tools/build.mjs';

test('buildHtml は importmap とバンドル済み module script を含む', async () => {
  const html = await buildHtml();
  assert.match(html, /<script type="importmap">/);
  assert.match(html, /three@0\.170\.0\/build\/three\.module\.js/);
  assert.match(html, /three@0\.170\.0\/examples\/jsm\//);
  assert.doesNotMatch(html, /<!-- BUNDLE -->/);
  assert.match(html, /<script type="module">[\s\S]+<\/script>/);
});

test('UI の要素IDと文言がそろっている', async () => {
  const html = await buildHtml();
  for (const id of ['stage', 'btn-drive', 'btn-explode', 'btn-reset', 'tooltip', 'part-count']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  for (const text of ['ROADSTER · No.01', 'Astra Roadster', '始動', 'パーツ分解', '視点リセット', '展示室', 'スタジオ', '上', '横', '正面']) {
    assert.ok(html.includes(text), text);
  }
});
