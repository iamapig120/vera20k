const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto');
const dist=path.resolve(process.argv[2]||'site'), mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.png':'image/png'};
const local=()=>new Promise(async resolve=>{
  const server=http.createServer(async(req,res)=>{
    try{
      const pathname = new URL(req.url,'http://localhost').pathname;
      if (!pathname.startsWith('/toy/yr-test/')) throw Error('path required');
      const name=pathname.slice('/toy/yr-test/'.length)||'index.html';
      const file=path.resolve(dist,name);
      assert(file.startsWith(dist+'/'));
      res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
      res.end(await fs.readFile(file));
    }catch{res.statusCode=404;res.end();}
  });
  server.listen(0,'127.0.0.1',()=>resolve(server));
});
const manifest=(base)=>{
  const manifestFiles=['ra2.mix','ra2md.mix','mapsmd03.mix'].map(path=>({path,size:4,sha256:crypto.createHash('sha256').update('fake').digest('hex'),url:base+'/fixture/'+path}));
  return JSON.stringify({format:'vera20k-resources',version:1,files:manifestFiles,profiles:{bootstrap:manifestFiles.map(x=>x.path)}});
};
(async()=>{
  const site=await local(),base='http://127.0.0.1:'+site.address().port;
  const host=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}iframe{width:100vw;height:100vh;border:none}</style><iframe allow="fullscreen" sandbox="allow-scripts allow-same-origin allow-downloads" src="'+base+'/toy/yr-test/index.html"></iframe>')});
  await new Promise(r=>host.listen(0,'127.0.0.1',r));
  const chrome=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-webgpu','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const report=[];
    for (const [name,width,height,touch] of [['desktop',1040,890,false],['mobile',390,844,true]]) {
      const context=await chrome.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
      const page=await context.newPage();const requests=[];const errors=[];let routeYrPayloads=0;let selectedFileCount=0;
      page.on('pageerror',err=>errors.push(String(err)));
      page.on('request',request=>requests.push(request.url()));
      await page.route('https://s1.hdslb.com/**',route=>route.fulfill({body:'window.toy={onContainerChange(){},setContainerMode(){return Promise.reject(new Error("simulated web mode"));}};',contentType:'text/javascript'}));
      await page.route('**/*/manifest.json',route=>route.fulfill({body:manifest('https://cdn.simpad.store'),contentType:'application/json',headers:{'access-control-allow-origin':'*'}}));
      await page.route('**/fixture/*.mix',route=>{++routeYrPayloads;return route.fulfill({body:'fake',headers:{'access-control-allow-origin':'*'}});});
      await page.goto('http://127.0.0.1:'+host.address().port);
      const iframe=page.frameLocator('iframe');
      const root=iframe.locator('html');
      const start=iframe.getByRole('button',{name:'启动游戏',exact:true});
      const radioYr=iframe.locator('input[value=yr]'),radioRa2=iframe.locator('input[value=ra2]');
      const choose=mode=>iframe.locator('.edition-'+mode+' .edition-card').click();
      await radioYr.waitFor({state:'attached'});
      await start.evaluate(el=>new Promise((r,j)=>{const end=Date.now()+45000;const tick=()=>el.disabled?Date.now()>end?j(Error('YR not ready')):setTimeout(tick,100):r();tick();}));
      assert(await radioYr.isChecked());
      assert.equal(await radioRa2.isChecked(),false);
      assert.equal(await start.count(),1);
      assert(!requests.some(u=>u.includes('/pkg/vera20k-ra2.')));
      assert.equal(routeYrPayloads,0);
      if(!touch) await page.screenshot({path:'desktop-yr.png'});
      if(touch) await iframe.locator('.edition-ra2 .edition-card').tap(); else {
        await radioYr.focus();await page.keyboard.press('ArrowLeft');
      }
      assert(await radioRa2.isChecked());
      assert(!(await radioYr.isChecked()));
      assert(await start.isDisabled());
      assert(await iframe.getByRole('button',{name:'选择游戏文件夹'}).isVisible());
      const fileChooser = page.waitForEvent('filechooser');
      await iframe.getByRole('button',{name:'手动选择文件'}).click();
      const handle=await fileChooser;
      const files=names=>names.map(name=>({name,buffer:Buffer.from('TEST-NOT-RETAIL'),mimeType:'application/octet-stream'}));
      await handle.setFiles(files(['RA2.MIX','RA2MD.MIX','LANGUAGE.MIX']));
      assert.match(await iframe.locator('#ra2-feedback').innerText(),/multi.mix/i);
      assert(await start.isDisabled());
      await iframe.locator('#ra2-files').setInputFiles(files(['RA2.MIX','RA2MD.MIX','LANGUAGE.MIX','MULTI.MIX','GAME.EXE']));
      await start.evaluate(el=>new Promise((r,j)=>{const end=Date.now()+45000;const tick=()=>el.disabled?Date.now()>end?j(Error('RA2 not ready')):setTimeout(tick,100):r();tick();}));
      selectedFileCount=Number((await iframe.locator('#ra2-feedback').innerText()).match(/(\d+) 个/)[1]);assert.equal(selectedFileCount,4);
      assert(requests.some(u=>u.endsWith('/pkg/vera20k-ra2.7c64fb691ca2ff7d.wasm')));
      assert.equal(routeYrPayloads,0);
      if(touch) await page.screenshot({path:'mobile-ra2.png'});
      else await page.screenshot({path:'desktop-ra2.png'});
      const hasHorizontalOverflow=await root.evaluate(el=>el.scrollWidth>el.clientWidth);
      assert.equal(hasHorizontalOverflow,false);
      await choose('yr');
      assert(await radioYr.isChecked());
      assert(await start.isEnabled());
      if(!touch){
        await start.click();
        await page.waitForTimeout(900);
        assert.equal(routeYrPayloads,3);
      }else{
        await choose('ra2');await start.click();
        await iframe.getByRole('button',{name:'返回版本选择'}).waitFor({timeout:45000});
        assert.match(await iframe.locator('#ra2-feedback').innerText(),/未能启动/);
        assert.equal(routeYrPayloads,0);
        const databases=await root.evaluate(async()=> (await indexedDB.databases()).map(x=>x.name));
        assert(databases.includes('vera20k-toy-ra2-layout-d6c75d57-users'));
        assert(databases.includes('vera20k-web-layout-d6c75d57-users'));
      }
      // Malformed fixture is deliberate. No JS uncaught page errors are acceptable.
      assert.deepEqual(errors,[]);
      report.push({name,width,modeDefault:'YR',nativeRadio:true,pairedWasmFetchedOnlyOnRA2:true,ownedFileChooser:true,missingMultiBlocks:true,invalidRetailReachesEngineProbe:touch,YRRemotePayloads:routeYrPayloads,RA2FilesAccepted:selectedFileCount,realRetailAssets:false,reportErrors:errors});
      await context.close();
    }
    console.log(JSON.stringify(report,null,2));
  }finally{await chrome.close();site.close();host.close();}
})().catch(error=>{console.error(error);process.exit(1)});
