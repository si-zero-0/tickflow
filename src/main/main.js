const { app, BrowserWindow, protocol, net, Menu, shell, globalShortcut, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const ipc = require('./ipc');
const topIsland = require('./ipc/top-island');
const update = require('./ipc/update');

const APP_DIR = path.join(__dirname, 'www');
const ICON = path.join(__dirname, 'build', 'icon.ico');
const SMOKE = process.argv.includes('--smoke');
/* 冒烟模式用软件渲染：透明/离屏截图在部分机器上会拿到旧帧 */
if (SMOKE) app.disableHardwareAcceleration();
let win = null;
let tray = null;
let quitting = false;

protocol.registerSchemesAsPrivileged([
  { scheme: 'tf', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.cur': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function serve(req) {
  const u = new URL(req.url);
  let rel = decodeURIComponent(u.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(APP_DIR, rel));
  if (!file.startsWith(APP_DIR)) return new Response('forbidden', { status: 403 });
  try {
    const buf = fs.readFileSync(file);
    return new Response(buf, {
      status: 200,
      headers: {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-cache'
      }
    });
  } catch (e) {
    return new Response('not found: ' + rel, { status: 404 });
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1060,
    minHeight: 700,
    backgroundColor: '#0a0d12',
    title: '刻度 TickFlow',
    icon: fs.existsSync(ICON) ? ICON : undefined,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.once('ready-to-show', () => {
    win.show();
    if (!SMOKE) win.focus();
  });

  if (SMOKE) {
    const log = [];
    win.webContents.on('console-message', (e) => { if (e && e.level >= 2) log.push(e.message); });
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        let probe = {}, sceneResult = '';
        try {
          const scene = String(process.env.TF_SMOKE_SCENE || 'main');
          if (scene.indexOf('update:') === 0) {
            const which = scene.slice(7);
            sceneResult = await win.webContents.executeJavaScript(`(async()=>{
              TF.openSettings('about');
              await new Promise(r=>setTimeout(r,250));
              const u=window.tfBridge&&window.tfBridge.update;
              if(!u) return JSON.stringify({error:'no-bridge'});
              let check=null, download=null, state=null, ui='';
              try{ check=await u.check(true); }catch(e){ check={error:String(e&&e.message||e)}; }
              if(check && check.status==='available'){
                try{ download=await u.download(); }catch(e){ download={error:String(e&&e.message||e)}; }
              }
              await new Promise(r=>setTimeout(r,350));
              try{ state=await u.state(); }catch(e){ }
              const el=document.querySelector('.upd-status'); if(el) ui=el.textContent.trim();
              return JSON.stringify({which:${JSON.stringify(which)},check:check&&check.status||check&&check.code||null,checkVersion:check&&check.version||null,
                download:download&&download.status||download&&download.code||null,ui,phase:state&&state.phase,frame:state&&state.progress});
            })()`);
          }
          else if (scene === 'settings') sceneResult = await win.webContents.executeJavaScript("TF.openSettings('appearance'); 'ok'");
          else if (scene === 'settings-fx') sceneResult = await win.webContents.executeJavaScript(`(async()=>{
            TF.openSettings('appearance');
            await new Promise(r=>setTimeout(r,300));
            const m=document.getElementById('sv-main'); if(m) m.scrollTop=m.scrollHeight;
            await new Promise(r=>setTimeout(r,400));
            return JSON.stringify({rippleRow:document.body.innerHTML.includes('主页点击涟漪'),
              highlightRow:document.body.innerHTML.includes('跟随高光')});
          })()`);
          else if (scene === 'no-fx') sceneResult = await win.webContents.executeJavaScript(`(async()=>{
            await new Promise(r=>setTimeout(r,300));
            const content=document.getElementById('content');
            const rr=content.getBoundingClientRect();
            content.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:rr.left+rr.width/2,clientY:rr.top+rr.height/2,pointerId:1}));
            await new Promise(r=>setTimeout(r,500));
            return JSON.stringify({fxNodes:document.querySelectorAll('.tf-wave,.tf-ripple').length,
              fxRipple:document.documentElement.classList.contains('fx-ripple'),
              fxHighlight:document.documentElement.classList.contains('fx-highlight'),
              pointer:true});
          })()`);
          else if (scene === 'profile-open') sceneResult = await win.webContents.executeJavaScript(`(async()=>{
            const chip=document.querySelector('.sb-prefs .profile-chip');
            if(chip) chip.dispatchEvent(new MouseEvent('click',{bubbles:true}));
            await new Promise(r=>setTimeout(r,320));
            const p=document.getElementById('pf-pop'); const rp=p&&p.getBoundingClientRect();
            const rc=chip&&chip.getBoundingClientRect();
            return JSON.stringify({pop:!!p,above:!!rp&&!!rc&&rp.bottom<=rc.top+1,
              pop:{top:rp&&Math.round(rp.top),bottom:rp&&Math.round(rp.bottom)},
              chip:{top:rc&&Math.round(rc.top)},cols:getComputedStyle(document.querySelector('.sb-prefs')).gridTemplateColumns});
          })()`);
          else if (scene === 'theme-matrix') sceneResult = await win.webContents.executeJavaScript(`(async()=>{
            TF.openSettings('appearance');
            await new Promise(r=>setTimeout(r,300));
            const out=[];
            for (const id of TF.SCHEME_IDS) for (const mode of ['dark','light']) {
              TF.applyAppearance({scheme:id, mode});
              await new Promise(r=>setTimeout(r,60));
              const cs=getComputedStyle(document.documentElement);
              const sv=document.querySelector('.settings-view');
              const sel=[...document.querySelectorAll('.th-card')].find(b=>b.classList.contains('on'));
              out.push({id, mode, domMode:document.documentElement.dataset.mode,
                bg:cs.getPropertyValue('--bg').trim(), panel:cs.getPropertyValue('--panel').trim(),
                text:cs.getPropertyValue('--text').trim(), svBg:getComputedStyle(sv).backgroundColor,
                modeCard:sel?sel.dataset.v:null});
            }
            return JSON.stringify(out);
          })()`);
          else if (scene === 'theme-ui-real') {
            /* 用 sendInputEvent 走真实命中测试，排除 dispatchEvent 绕过遮挡的可能 */
            await win.webContents.executeJavaScript("TF.openSettings('appearance'); 'ok'");
            await new Promise(r => setTimeout(r, 350));
            const clickAt = async (sel) => {
              const pt = JSON.parse(await win.webContents.executeJavaScript(
                `(()=>{const b=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return JSON.stringify({x:Math.round(b.left+b.width/2),y:Math.round(b.top+b.height/2)})})()`));
              win.webContents.sendInputEvent({ type: 'mouseMove', x: pt.x, y: pt.y });
              win.webContents.sendInputEvent({ type: 'mouseDown', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
              win.webContents.sendInputEvent({ type: 'mouseUp', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
              await new Promise(r => setTimeout(r, 450));
            };
            await clickAt('.th-card[data-v="light"]');
            await clickAt('.sc-card[data-v="sakura"]');
            await new Promise(r => setTimeout(r, 500));
            sceneResult = await win.webContents.executeJavaScript(`(()=>{const a=TF.getAppearance();return JSON.stringify({
              storeMode:a.mode,storeScheme:a.scheme,domMode:document.documentElement.dataset.mode,
              bg:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
              text:getComputedStyle(document.documentElement).getPropertyValue('--text').trim(),
              modeCard:[...document.querySelectorAll('.th-card')].find(b=>b.classList.contains('on'))?.dataset.v,
              cur:(document.querySelector('.sc-cur')||{}).textContent});})()`);
          }
          else if (scene === 'theme-ui-rev') sceneResult = await win.webContents.executeJavaScript(`(async()=>{
            const click=sel=>{const el=document.querySelector(sel); if(el) el.dispatchEvent(new MouseEvent('click',{bubbles:true}));};
            TF.openSettings('appearance');
            await new Promise(r=>setTimeout(r,300));
            click('.th-card[data-v="dark"]');
            await new Promise(r=>setTimeout(r,300));
            click('.sc-card[data-v="sakura"]');
            await new Promise(r=>setTimeout(r,300));
            click('.th-card[data-v="light"]');
            await new Promise(r=>setTimeout(r,500));
            const a=TF.getAppearance();
            return JSON.stringify({storeMode:a.mode,storeScheme:a.scheme,domMode:document.documentElement.dataset.mode,
              bg:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
              modeCard:[...document.querySelectorAll('.th-card')].find(b=>b.classList.contains('on'))?.dataset.v,
              cur:(document.querySelector('.sc-cur')||{}).textContent});
          })()`);
          else if (scene === 'theme-ui') sceneResult = await win.webContents.executeJavaScript(`(async()=>{
            TF.openSettings('appearance');
            await new Promise(r=>setTimeout(r,300));
            const light=document.querySelector('.th-card[data-v="light"]');
            if(light) light.dispatchEvent(new MouseEvent('click',{bubbles:true}));
            await new Promise(r=>setTimeout(r,300));
            const sak=document.querySelector('.sc-card[data-v="sakura"]');
            if(sak) sak.dispatchEvent(new MouseEvent('click',{bubbles:true}));
            await new Promise(r=>setTimeout(r,500));
            const a=TF.getAppearance();
            return JSON.stringify({storeMode:a.mode,storeScheme:a.scheme,domMode:document.documentElement.dataset.mode,
              domScheme:document.documentElement.dataset.scheme,
              bg:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
              panel:getComputedStyle(document.documentElement).getPropertyValue('--panel').trim(),
              text:getComputedStyle(document.documentElement).getPropertyValue('--text').trim()});
          })()`);
          else if (scene === 'light') sceneResult = await win.webContents.executeJavaScript("TF.applyAppearance({mode:'light'}); document.documentElement.dataset.mode + ':' + getComputedStyle(document.documentElement).getPropertyValue('--bg')");
          else if (scene === 'island') sceneResult = await win.webContents.executeJavaScript("TF.App.view={type:'quadrants'};TF.App.render(); 'ok'");
          else if (scene === 'm3') sceneResult = await win.webContents.executeJavaScript("TF.Store.data.settings.m3.enabled=true;TF.Store.save();TF.applyM3Settings(); 'm3-on:'+document.documentElement.dataset.scheme");
          else if (scene === 'm3-remind') sceneResult = await win.webContents.executeJavaScript("TF.Store.data.settings.m3.enabled=true;TF.Store.save();TF.applyM3Settings(); setTimeout(()=>window.tfBridge.topIsland.remind({id:'rem1',title:'周会材料',due:'2026-11-20',dueTime:'15:00'}),700); 'm3-remind'");
          else if (scene === 'm3-off') sceneResult = await win.webContents.executeJavaScript("TF.Store.data.settings.m3.enabled=true;TF.applyM3Settings(); setTimeout(()=>{TF.Store.data.settings.m3.enabled=false;TF.Store.save();TF.applyM3Settings();},600); 'm3-off'");
          else if (scene === 'views') sceneResult = await win.webContents.executeJavaScript(`(async()=>{
            const list=['inbox','today','next7','all','completed','timeline','calendar','quadrants','habits','stats','process','wishes','pomodoro','inbox'];
            const out=[];
            for (const v of list){ TF.App.view={type:v}; TF.App.render(); await new Promise(r=>setTimeout(r,130));
              out.push({v, tasks:document.querySelectorAll('.task').length, cards:document.querySelectorAll('.card,.stat,.wish-card,.quad,.cal-grid,.tl-wrap,.proc-row,.proc-node').length}); }
            const l=TF.Store.data.lists.find(x=>!x.inbox);
            if (l){ TF.App.view={type:'list',listId:l.id}; TF.App.render(); await new Promise(r=>setTimeout(r,130)); out.push({v:'list',tasks:document.querySelectorAll('.task').length}); }
            TF.App.view={type:'day',date:'2026-11-20'}; TF.App.render(); await new Promise(r=>setTimeout(r,130)); out.push({v:'day',tasks:document.querySelectorAll('.task').length});
            TF.App.search='需求'; TF.App.view={type:'search'}; TF.App.render(); await new Promise(r=>setTimeout(r,130)); out.push({v:'search',tasks:document.querySelectorAll('.task').length});
            TF.App.search='';
            TF.App.view={type:'today'}; TF.App.render();
            return JSON.stringify(out);})()`);
          else if (scene === 'schemes') sceneResult = await win.webContents.executeJavaScript(`(async()=>{
            const ids=TF.SCHEME_IDS.slice(); const out=[];
            for (const id of ids) for (const mode of ['dark','light']){
              TF.applyAppearance({scheme:id,mode});
              await new Promise(r=>setTimeout(r,60));
              const bg=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
              out.push(id+'.'+mode+'='+bg);
            }
            TF.applyAppearance({scheme:'kun-default',mode:'dark'});
            return out.join(' ');})()`);
          else if (scene === 'persist') sceneResult = await win.webContents.executeJavaScript(`(()=>{
            TF.applyAppearance({fontSize:100,contentWidth:1000});
            const fs=getComputedStyle(document.body).fontSize;
            const w=document.querySelector('.wrap')?Math.round(document.querySelector('.wrap').getBoundingClientRect().width):0;
            return 'font='+fs+' wrap='+w+' stored='+JSON.stringify(TF.getAppearance());})()`);
          else if (scene === 'persist-reload') {
            /* 同一会话内 reload：localStorage 里写过的字号/宽度必须还在（持久化验收） */
            await win.webContents.executeJavaScript("TF.applyAppearance({fontSize:100,contentWidth:1000}); TF.Store.save(true); 'set'");
            await new Promise(res => { win.webContents.once('did-finish-load', res); win.webContents.reload(); });
            await new Promise(res => setTimeout(res, 900));
            sceneResult = await win.webContents.executeJavaScript("'after-reload '+JSON.stringify(TF.getAppearance())+' font='+getComputedStyle(document.body).fontSize+' wrap='+Math.round((document.querySelector('.wrap')||{getBoundingClientRect:()=>({width:0})}).getBoundingClientRect().width)");
          }
          else if (scene === 'system-light' || scene === 'system-dark') {
            const { nativeTheme } = require('electron');
            nativeTheme.themeSource = scene === 'system-light' ? 'light' : 'dark';
            await new Promise(r => setTimeout(r, 200));
            sceneResult = await win.webContents.executeJavaScript("TF.Store.data.settings.appearance.mode='system';TF.Store.save();TF.applyAppearance(); 'sys='+document.documentElement.dataset.mode+' bg='+getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()");
          }
          else if (scene === 'm3-dedupe') {
            await win.webContents.executeJavaScript("TF.Store.data.settings.m3.enabled=true;TF.Store.save();TF.applyM3Settings(); 'on'");
            await new Promise(r => setTimeout(r, 800));
            await win.webContents.executeJavaScript("window.tfBridge.topIsland.remind({id:'dup',title:'重复提醒',due:'2026-11-20',dueTime:'10:00'})");
            await new Promise(r => setTimeout(r, 250));
            await win.webContents.executeJavaScript("window.tfBridge.topIsland.remind({id:'dup',title:'重复提醒',due:'2026-11-20',dueTime:'10:00'})");
            await new Promise(r => setTimeout(r, 400));
            const isl0 = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && /顶部岛/.test(w.getTitle()));
            sceneResult = isl0 ? await isl0.webContents.executeJavaScript("'dup-count='+document.querySelectorAll('.isl-rem[data-id=\"dup\"]').length+' total='+document.querySelectorAll('.isl-rem').length") : 'island-missing';
          }
          else if (scene === 'perf') sceneResult = await win.webContents.executeJavaScript(`(()=>{
            const out=[]; const list=['today','inbox','all','completed','next7','timeline','calendar','quadrants','habits','stats','process','wishes','pomodoro'];
            for (const v of list){ const t0=performance.now(); TF.App.view={type:v}; TF.App.render(); out.push(v+'='+Math.round((performance.now()-t0)*10)/10); }
            TF.App.view={type:'today'}; TF.App.render();
            return out.join(' ');})()`);
          else if (scene === 'reset') sceneResult = await win.webContents.executeJavaScript("TF.applyAppearance({fontSize:82,contentWidth:896,mode:'dark',scheme:'kun-default',accentOverride:null}); TF.Store.data.settings.m3.enabled=false; TF.Store.save(true); TF.applyM3Settings(); 'reset'");
          else if (scene === 'ls-write') sceneResult = await win.webContents.executeJavaScript("localStorage.setItem('tf:qa','yes-'+Date.now()); 'wrote keys='+Object.keys(localStorage).length");
          else if (scene === 'ls-read') sceneResult = await win.webContents.executeJavaScript("'qa='+localStorage.getItem('tf:qa')+' keys='+Object.keys(localStorage).join(',')");
          else if (scene.startsWith('view:')) {
            const v = scene.slice(5);
            sceneResult = await win.webContents.executeJavaScript(`TF.App.view={type:'${v}'};TF.App.render(); '${v}'`);
          }
        } catch (err) { sceneResult = 'scene-failed: ' + String(err); }

        try {
          probe = await win.webContents.executeJavaScript(
            `({title: document.title,
               tasks: document.querySelectorAll('.task').length,
               sidebar: document.getElementById('sidebar').children.length,
               store: !!(window.TF && TF.Store && TF.Store.data),
               bootMs: window.TF ? TF.timing : null,
               profiles: window.TF ? TF.Store.profiles().length : 0,
               appearance: window.TF && TF.getAppearance ? TF.getAppearance() : null,
               styles: { mode: document.documentElement.dataset.mode,
                 bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
                 bodyFont: getComputedStyle(document.body).fontSize,
                 wrapW: document.querySelector('.wrap') ? Math.round(document.querySelector('.wrap').getBoundingClientRect().width) : 0 },
               modules: window.TF ? ['renderTimeline','openPalette','openCapture','reminderPopup','openTemplates'].filter(k=>typeof TF[k]==='function') : []})`
          );
        } catch (err) { probe = { error: String(err) }; }
        /* 冒烟截图：TF_SMOKE_SIZE=1060x700 / 1400x900 / 3840x2160 各出一张；
           TF_SMOKE_SCENE=settings|light|island 可切到指定场景再截图 */
        let shot = '';
        try {
          const size = String(process.env.TF_SMOKE_SIZE || '1400x900').split('x').map(Number);
          if (size[0] >= 1060 && size[1] >= 700) win.setSize(size[0], size[1]);
          await new Promise(r => setTimeout(r, 500));
          const img = await win.webContents.capturePage();
          const scene = String(process.env.TF_SMOKE_SCENE || 'main').replace(/[\\/:*?"<>|]/g, '-');
          shot = path.join(app.getPath('temp'), `tickflow-smoke-${scene}-${size[0]}x${size[1]}.png`);
          fs.writeFileSync(shot, img.toPNG());
          /* M3 场景额外截取顶部岛独立窗口（透明 PNG） */
          if (String(process.env.TF_SMOKE_SCENE || '').startsWith('m3')) {
            const isl = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && /顶部岛/.test(w.getTitle()));
            if (isl) {
              sceneResult += ` focusable=${typeof isl.isFocusable === 'function' ? isl.isFocusable() : 'n/a'} onTop=${isl.isAlwaysOnTop()} bounds=${JSON.stringify(isl.getBounds())}`;
              await new Promise(r => setTimeout(r, 500));
              /* 展开三态中的「展开」：模拟点击胶囊 */
              /* 提醒场景已自动展开，不要再点（否则会切回收起态）；普通 m3 场景点一下展开 */
              if (String(process.env.TF_SMOKE_SCENE || '') === 'm3' && !process.env.TF_SMOKE_IDLE) {
                try { await isl.webContents.executeJavaScript("document.querySelector('.isl-head').dispatchEvent(new MouseEvent('click',{bubbles:true})); 'ok'"); } catch (e) { }
                await new Promise(r => setTimeout(r, 400));
              }
              /* 展开/提醒态下的窗口高度：三态测量用 */
              sceneResult += ' boundsAfter=' + JSON.stringify(isl.getBounds());
              try { sceneResult += ' dbg=' + await isl.webContents.executeJavaScript("JSON.stringify(window.__dbg && window.__dbg())"); } catch (e) { }
              /* 同步延迟实测：岛发起动作 → 主窗执行 → 快照回岛，测 5 次 */
              try {
                for (let i = 0; i < 5; i++) {
                  await isl.webContents.executeJavaScript("window.__act && window.__act('toggle-focus')");
                  await new Promise(r => setTimeout(r, 120));
                }
                await new Promise(r => setTimeout(r, 300));
                const stats = await isl.webContents.executeJavaScript("JSON.stringify(window.__syncStats)");
                sceneResult += ' ' + stats;
              } catch (e) { sceneResult += ' sync-failed:' + String(e); }
              await new Promise(r => setTimeout(r, 300));
              const shot2 = path.join(app.getPath('temp'), 'tickflow-smoke-m3-island.png');
              fs.writeFileSync(shot2, (await isl.capturePage()).toPNG());
            } else {
              sceneResult += ' island-window-missing';
            }
          }
        } catch (err) { shot = 'shot-failed: ' + String(err); }
        fs.writeFileSync(path.join(app.getPath('temp'), 'tickflow-smoke.json'),
          JSON.stringify({ url: win.webContents.getURL(), sceneResult, probe, consoleErrors: log, shot }, null, 2));
        /* 给 Chromium 一点时间把 localStorage 落盘（否则冒烟验证“持久化”会假失败） */
        await new Promise(r => setTimeout(r, 1200));
        app.quit();
      }, 1600);
    });
  }

  win.loadURL('tf://app/index.html');

  // 关闭窗口 → 收进托盘（真正退出走托盘菜单）
  win.on('close', (e) => {
    if (quitting || SMOKE || !tray) return;
    e.preventDefault();
    win.hide();
    if (tray && process.platform === 'win32') {
      try { tray.displayBalloon({ title: '刻度 TickFlow', content: '已收进托盘，双击图标可重新打开' }); } catch (err) { }
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

function buildTray() {
  if (!fs.existsSync(ICON)) return;
  try { tray = new Tray(nativeImage.createFromPath(ICON)); } catch (e) { return; }
  const menu = Menu.buildFromTemplate([
    { label: '打开刻度', click: () => { win.show(); win.focus(); } },
    { label: '快速捕获（Ctrl+Alt+Space）', click: capture },
    {
      label: '顶部迷你岛',
      type: 'checkbox',
      checked: !!(topIsland.getState && topIsland.getState().enabled),
      click: () => {
        /* 托盘只发动作，真正改 Store 由主窗完成（主窗是唯一事实源） */
        if (win && !win.isDestroyed()) win.webContents.send('tf:island:action', { type: 'toggle-m3' });
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]);
  tray.setToolTip('刻度 TickFlow');
  tray.setContextMenu(menu);
  tray.on('double-click', () => { win.show(); win.focus(); });
}

function capture() {
  if (!win) return;
  win.show();
  win.focus();
  win.webContents.executeJavaScript('TF.openCapture && TF.openCapture()').catch(() => { });
}

function registerShortcut() {
  try { globalShortcut.register('Control+Alt+Space', capture); } catch (e) { }
}

app.whenReady().then(() => {
  protocol.handle('tf', serve);
  ipc.register();
  Menu.setApplicationMenu(null);
  createWindow();
  topIsland.attachHost(win);
  update.init({ beforeInstall: () => { quitting = true; } });
  if (!SMOKE) { buildTray(); registerShortcut(); update.startAutoCheck(); }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else { win.show(); win.focus(); }
  });
});

app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => { globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && quitting) app.quit(); });
