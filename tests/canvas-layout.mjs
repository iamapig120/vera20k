// Browser regression for winit's desktop minimum being applied to a mobile canvas.
// Run with: node tests/canvas-layout.mjs R:/path/to/test-output
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {launchHeadless} from './headless.mjs';
const css=await readFile(new URL('../templates/launcher.css',import.meta.url),'utf8');
const browser=await launchHeadless(process.argv[2]);
try {
 await browser.call('Page.navigate',{url:'data:text/html,'+encodeURIComponent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body class="playing"><div id="game"><canvas style="width:800px;height:600px;min-width:640px;min-height:480px"></canvas></div>')});
 for(const [width,height] of [[844,390],[390,844],[1280,900]]) {
  await browser.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
  const size=await browser.evaluate('(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return [r.width,r.height]})()');
  assert.deepEqual(size,[width,height]);
 }
 console.log('PASS: landscape, portrait, desktop canvas fit despite desktop inline minimum');
} finally { await browser.close(); }