/* ===== 设置页 v1.13：全屏 · 左 8 分类 + 右卡片 · 搜索跳转 · 不重建外层 =====
   职责：
   - 打开/关闭 #settings-view；切分类只替换右栏内容（保留滚动位置）；
   - 外观页（3 主题卡 + 9 配色卡 + 字号/宽度 + 强调色 + 特效 + 自定义）；
   - 数据页复用 v1.12 的导入/导出/快照能力（app.js 已有的 data-act）。
   所有修改即时生效并写入 Store，不设“保存”按钮。
*/
(function () {
  const TF = window.TF, S = () => TF.Store, esc = TF.esc;
  const App = () => TF.App;

  const TABS = [
    { id: 'general', name: '常规', icon: 'settings', tone: 'work' },
    { id: 'appearance', name: '外观', icon: 'palette', tone: 'set' },
    { id: 'notify', name: '通知', icon: 'alert', tone: 'tool' },
    { id: 'shortcut', name: '快捷键', icon: 'bolt', tone: 'work' },
    { id: 'wishes', name: '愿望', icon: 'spark', tone: 'wish' },
    { id: 'data', name: '数据', icon: 'layers', tone: 'view' },
    { id: 'about', name: '关于', icon: 'file', tone: 'help' }
  ];

  const Settings = TF.Settings = {
    open: false,
    tab: 'general',
    scroll: {},
    q: ''
  };

  function st() { return S().data.settings; }
  function ap() { return st().appearance; }

  /* ---------- 更新状态（只在内存里，不写 Store） ---------- */
  const UPD = { phase: 'idle', message: '尚未检查更新', version: '', notes: '', progress: 0, code: '' };
  function updb() { return window.tfBridge && window.tfBridge.update; }
  function updLabel() {
    if (UPD.phase === 'checking') return '正在检查…';
    if (UPD.phase === 'available') return '发现新版本 v' + UPD.version;
    if (UPD.phase === 'downloading') return '下载中 ' + Math.round((UPD.progress || 0) * 100) + '%';
    if (UPD.phase === 'downloaded') return '已下载，SHA256 校验通过';
    if (UPD.phase === 'installing') return '正在静默安装…';
    if (UPD.phase === 'error') return UPD.message || '更新失败';
    return UPD.message || '已是最新版本';
  }
  function rerenderAbout() {
    if (Settings.open && Settings.tab === 'about') renderBody();
  }
  function initUpdateBridge() {
    const u = updb();
    if (!u) return;
    u.onStatus((s) => {
      if (!s || typeof s !== 'object') return;
      UPD.phase = String(s.phase || UPD.phase);
      UPD.message = String(s.message || UPD.message || '');
      UPD.version = String(s.version || UPD.version || '');
      UPD.notes = String(s.notes || '');
      UPD.progress = Number(s.progress) || 0;
      UPD.code = String(s.code || '');
      rerenderAbout();
      if (UPD.phase === 'available' && s.justFound !== false) {
        const key = 'tf:upd-toast:' + UPD.version;
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            if (TF.toast) TF.toast('发现新版本 v' + UPD.version + '，可在 设置 › 关于 更新', 'info');
          }
        } catch (e) { }
      }
    });
  }

  /* ---------- 通用小控件 ---------- */
  function sw(on, key) {
    return `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${on ? 'true' : 'false'}"
      data-sact="toggle" data-k="${key}"><i></i></button>`;
  }
  function row(title, desc, control) {
    return `<div class="set-row"><div class="set-k"><b>${title}</b>${desc ? `<small>${desc}</small>` : ''}</div><div class="set-c">${control}</div></div>`;
  }
  function card(title, desc, body) {
    return `<section class="set-card"><header class="set-card-h"><h3>${title}</h3>${desc ? `<span>${desc}</span>` : ''}</header>${body}</section>`;
  }

  function schemeName(id) {
    const p = TF.schemePreview ? TF.schemePreview(id) : null;
    const names = { 'kun-default': '默认', sky: '晴空蓝白', parchment: '羊皮纸', mint: '薄荷', sakura: '樱粉', dusk: '暮紫', amber: '琥珀', ink: '墨石', custom: '自定义' };
    return names[id] || (p ? id : id);
  }

  /* ---------- 外观：主题卡 ---------- */
  function themeCards() {
    const a = ap();
    const pv = TF.schemePreview(a.scheme);
    const mode = ['light', 'dark', 'system'].map(m => {
      const on = a.mode === m;
      const label = m === 'light' ? '浅色' : m === 'dark' ? '深色' : '跟随系统';
      /* 预览用当前配色方案在对应明暗下的真实 token，而不是当前页面的 var() */
      const bgL = pv.light.bg, pL = pv.light.panel, acL = pv.light.accent;
      const bgD = pv.dark.bg, pD = pv.dark.panel, acD = pv.dark.accent;
      const block = (bg, p, ac) => `<i style="background:${bg};border-color:${p}"><b style="background:${p}"></b><u style="background:${ac}"></u></i>`;
      const inner = m === 'light' ? block(bgL, pL, acL)
        : m === 'dark' ? block(bgD, pD, acD)
          : `<span class="th-split">${block(bgL, pL, acL)}${block(bgD, pD, acD)}</span>`;
      return `<button class="th-card ${on ? 'on' : ''}" data-sact="mode" data-v="${m}" aria-label="${label}">
        <span class="th-preview ${m}">${inner}</span>
        <span class="th-label">${label}</span>
        ${on ? `<span class="th-check"><svg class="ic xs"><use href="#i-check"/></svg></span>` : ''}
      </button>`;
    }).join('');
    return `<div class="th-grid">${mode}</div>`;
  }

  /* ---------- 外观：9 张配色卡（浅/深双预览） ---------- */
  function schemeCards() {
    const a = ap();
    const cards = TF.SCHEME_IDS.map(id => {
      const pv = TF.schemePreview(id);
      const on = a.scheme === id;
      return `<button class="sc-card ${on ? 'on' : ''}" data-sact="scheme" data-v="${id}" aria-label="${schemeName(id)}">
        <span class="sc-pv">
          <i class="sc-light" style="background:${pv.light.bg};border-color:${pv.light.border}">
            <b style="background:${pv.light.panel}"></b><u style="background:${pv.light.accent}"></u></i>
          <i class="sc-dark" style="background:${pv.dark.bg};border-color:${pv.dark.border}">
            <b style="background:${pv.dark.panel}"></b><u style="background:${pv.dark.accent}"></u></i>
        </span>
        <span class="sc-name">${schemeName(id)}</span>
        <span class="sc-desc">${id === 'custom' ? '背景 / 面板 / 边框 / 强调色' : (TF.SCHEMES && TF.SCHEMES[id] ? TF.SCHEMES[id].desc : '')}</span>
        ${on ? `<span class="sc-check"><svg class="ic xs"><use href="#i-check"/></svg></span>` : ''}
      </button>`;
    }).join('');
    const cur = schemeName(a.scheme) + ' · ' + (a.mode === 'light' ? '浅色' : a.mode === 'dark' ? '深色' : '跟随系统');
    return `<div class="sc-head"><span class="sc-cur">当前：${cur}</span></div><div class="sc-grid">${cards}</div>`;
  }

  /* ---------- 外观：自定义配色（P1 简化版四项） ---------- */
  function customEditor() {
    const c = ap().custom;
    const item = (k, label) => `<div class="custom-i">
      <span>${label}</span>
      <input type="color" value="${c[k]}" data-sact="custom" data-k="${k}" aria-label="${label}">
      <code>${c[k]}</code>
    </div>`;
    return `<div class="custom-row">${item('bg', '背景')}${item('panel', '面板')}${item('border', '边框')}${item('accent', '强调色')}</div>
      <div class="set-note">切到「自定义」方案后生效；未设置的档位从「默认」派生。</div>`;
  }

  /* ---------- 外观：字号 / 宽度 ---------- */
  function fontRow() {
    const a = ap();
    return `<div class="slider-line">
        <span class="sl-a">A</span>
        <input type="range" id="set-font" min="70" max="120" step="1" value="${a.fontSize}" data-sact="font">
        <span class="sl-b">A</span>
        <span class="stepper"><button data-sact="font-step" data-v="-1" aria-label="减小字号">−</button><output id="font-out">${a.fontSize}%</output><button data-sact="font-step" data-v="1" aria-label="增大字号">＋</button></span>
      </div>
      <div class="set-note">82% 与 v1.12 正文一致；100% 才放大。</div>`;
  }
  function widthRow() {
    const a = ap();
    return `<div class="slider-line">
        <span class="sl-a">窄</span>
        <input type="range" id="set-width" min="640" max="1200" step="16" value="${a.contentWidth}" data-sact="width">
        <span class="sl-b">宽</span>
        <span class="stepper"><button data-sact="width-step" data-v="-16" aria-label="减小宽度">−</button><output id="width-out">${a.contentWidth}px</output><button data-sact="width-step" data-v="16" aria-label="增大宽度">＋</button></span>
      </div>`;
  }

  /* ---------- 外观：强调色 ---------- */
  const ACCENT_BAND = ['#7D8BA1', '#4C9AFF', '#37C2AE', '#3DDC97', '#F5A623', '#FF7A95', '#A78BFA'];
  function accentRow() {
    const a = ap();
    const cur = a.accentOverride || TF.appearanceTokens().accent;
    return `<div class="ac-line">
        <input type="color" id="set-accent" value="${cur}" data-sact="accent" aria-label="强调色">
        <input type="text" id="set-accent-hex" value="${cur}" data-sact="accent-hex" spellcheck="false" aria-label="强调色 hex">
        <button class="btn sm ghost" data-sact="accent-reset">默认</button>
      </div>
      <div class="ac-band">${ACCENT_BAND.map(h => `<button data-sact="accent-pick" data-v="${h}" style="background:${h}" aria-label="${h}"></button>`).join('')}</div>
      <div class="set-note">默认跟随当前配色方案；设为具体颜色后覆盖。</div>`;
  }

  /* ---------- 分类内容 ---------- */
  function bodyGeneral() {
    const s = st();
    return card('通用', '本地优先，无账号与云同步', `
        ${row('界面密度', '紧凑模式能多显示约 30% 的行', `<div class="seg" id="set-density">
          <button data-sact="density" data-v="normal" class="${s.density !== 'compact' ? 'on' : ''}">标准</button>
          <button data-sact="density" data-v="compact" class="${s.density === 'compact' ? 'on' : ''}">紧凑</button></div>`)}
        ${row('语言', '当前仅提供简体中文', `<span class="set-val">简体中文</span>`)}
        ${row('本地配置', `${S().profiles().length} 个配置 · 数据互不干扰`, `<button class="btn sm" data-act="profile-menu">切换配置</button>`)}
      `) + card('专注', '番茄钟时长（分钟）', `
        ${row('专注时长', '', `<input type="number" class="num-in" id="set-work" value="${s.pomo.work}" min="1" max="120">`)}
        ${row('短休息', '', `<input type="number" class="num-in" id="set-short" value="${s.pomo.short}" min="1" max="60">`)}
        ${row('长休息', '', `<input type="number" class="num-in" id="set-long" value="${s.pomo.long}" min="1" max="60">`)}
      `);
  }

  function bodyAppearance() {
    const a = ap();
    return `<div class="set-page-h"><div><h2>外观</h2><span>主题、文字大小和界面配色。修改会自动生效。</span></div></div>
      ${card('主题', '配色方案会自动切换到对应版本', themeCards())}
      ${card('配色方案', '8 套预设 + 自定义', schemeCards())}
      ${card('自定义配色', '四项基础色，切换后即时生效', customEditor())}
      ${card('文字与布局', '', `${row('字体大小', '70% – 120%', fontRow())}${row('内容宽度', '640px – 1200px', widthRow())}`)}
      ${card('交互特效', '', `
        ${row('侧栏 / 顶栏跟随高光', '鼠标移动时绘制柔和径向光', sw(a.highlight, 'highlight'))}
        ${row('强调色', '选中、主按钮、滑杆、开关', accentRow())}
      `)}`;
  }

  function bodyNotify() {
    const s = st();
    return card('通知', '提醒都来自本地任务，不上传任何数据', `
        ${row('系统通知', (window.Notification && Notification.permission === 'granted') ? '已授权' : '未授权时只在应用内提醒',
          `<button class="btn sm" data-act="ask-notify">${(window.Notification && Notification.permission === 'granted') ? '已开启' : '开启系统通知'}</button>`)}
        ${row('免打扰', '关闭后到点不响铃', `<span class="set-val">跟随系统专注模式</span>`)}
      `);
  }

  function bodyShortcut() {
    const list = [
      ['N', '新建任务（聚焦快速添加）'],
      ['Ctrl + K', '命令面板'],
      ['/', '聚焦搜索框'],
      ['Ctrl + Alt + Space', '全局快速捕获'],
      ['Esc', '关闭抽屉 / 弹窗 / 面板'],
      ['F11', '切换全屏']
    ];
    return card('快捷键', '固定快捷键，暂不支持自定义', `<div class="key-list">${list.map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div>`);
  }

  function bodyWishes() {
    const ws = S().wishStats();
    return card('愿望', '写下来，慢慢实现', `
        ${row('愿望总数', '', `<span class="set-val">${ws.total} 个</span>`)}
        ${row('已实现', '实现率', `<span class="set-val">${ws.done} 个 · ${ws.rate}%</span>`)}
        ${row('进行中', '', `<span class="set-val">${ws.undone} 个</span>`)}
      `) + card('默认分类', '愿望卡片的分类来自每张卡片自身', `<div class="set-note">新建愿望时可填写分类；分类只影响筛选，不写入全局设置。</div>`);
  }

  function bodyData() {
    const d = S().data;
    return card('本地数据', `任务 ${d.tasks.length} · 愿望 ${d.wishes.length} · 进程 ${d.processes.length}`, `
        ${row('导出', 'JSON 备份 / Markdown / CSV', `<div class="btn-row"><button class="btn sm" data-act="export">JSON</button><button class="btn sm ghost" data-act="export-md">Markdown</button><button class="btn sm ghost" data-act="export-csv">CSV</button></div>`)}
        ${row('导入', 'JSON 备份或 CSV', `<div class="btn-row"><button class="btn sm" data-act="import">JSON</button><button class="btn sm ghost" data-act="import-csv">CSV</button></div>`)}
        ${row('快照', '每天首次启动自动备份，保留最近 3 份', `<div class="btn-row"><button class="btn sm" data-act="snap-now">立即备份</button><button class="btn sm ghost" data-act="snap-list">恢复…</button></div>`)}
        ${row('数据目录', '只存在本机', `<button class="btn sm ghost" data-act="open-data-dir">打开目录</button>`)}
      `) + card('重置', '清空全部并恢复示例数据', `<div class="btn-row"><button class="btn sm danger" data-act="reset">重置数据</button></div>`);
  }

  function bodyAbout() {
    const t = TF.timing || {};
    const u = updb();
    const btns = [
      '<button class="btn sm" data-sact="update-check">检查更新</button>',
      UPD.phase === 'available' ? '<button class="btn sm" data-sact="update-download">下载并校验</button>' : '',
      UPD.phase === 'downloaded' ? '<button class="btn sm" data-sact="update-install">安装并重启</button>' : '',
      '<button class="btn sm ghost" data-sact="update-open">打开发布页</button>'
    ].filter(Boolean).join('');
    return card('关于', '', `<div class="about-box">
        <div class="ab-row"><b>刻度 TickFlow</b><span>v${TF.VERSION}</span></div>
        <div class="ab-line">开发者：<b>硅基零号机</b></div>
        <div class="ab-line">本地优先：无账号、无云端、无内购，所有功能免费。</div>
        <div class="ab-line">数据只存在本机（Electron 用户数据目录）。换设备或重置前请先导出 JSON 备份。</div>
        <div class="ab-line">反馈：B 站是主要入口，GitHub Issues 作为另一条渠道。</div>
        <div class="btn-row">
          <button class="btn sm" data-sact="open-link" data-url="https://space.bilibili.com/1138070117">B 站反馈</button>
          <button class="btn sm ghost" data-sact="open-link" data-url="https://github.com/si-zero-0/tickflow/issues">GitHub Issues</button>
        </div>
      </div>`) + card('更新', '整包更新；下载后校验 SHA256，失败不会影响当前版本', `
        ${row('当前版本', '安装包来自 GitHub Releases', `<span class="set-val">v${TF.VERSION}</span>`)}
        ${row('状态', u ? '清单 jsDelivr → raw → GitHub API' : '浏览器预览不支持自动更新',
          `<span class="set-val upd-status">${esc(updLabel())}</span>`)}
        <div class="btn-row">${btns}</div>
      `) + card('诊断', '用于排查启动与性能问题', `
        ${row('启动耗时', 'load / render / total (ms)', `<span class="set-val">${t.load || 0} / ${t.render || 0} / ${t.total || 0}</span>`)}
        ${row('渲染进程', 'Electron', `<span class="set-val">${/Electron/i.test(navigator.userAgent) ? 'Electron' : '浏览器预览'}</span>`)}
      `);
  }

  const BODIES = {
    general: bodyGeneral, appearance: bodyAppearance, notify: bodyNotify, shortcut: bodyShortcut,
    wishes: bodyWishes, data: bodyData, about: bodyAbout
  };

  /* ---------- 壳 ---------- */
  function navHTML() {
    return TABS.map(t => `<button class="sv-nav ${Settings.tab === t.id ? 'on' : ''}" data-sact="tab" data-v="${t.id}">
        <span class="sb-ic tone-${t.tone}"><svg class="ic"><use href="#i-${t.icon}"/></svg></span>
        <span>${t.name}</span></button>`).join('');
  }

  function shellHTML() {
    return `<div class="sv">
      <aside class="sv-side">
        <div class="sv-head">
          <button class="icon-btn sv-back" data-sact="close" title="返回" aria-label="返回"><svg class="ic"><use href="#i-chevron-left"/></svg></button>
          <h1>设置</h1>
        </div>
        <div class="sv-search">
          <svg class="ic sm"><use href="#i-search"/></svg>
          <input id="sv-q" placeholder="搜索设置" value="${esc(Settings.q)}" aria-label="搜索设置">
        </div>
        <nav class="sv-nav-list" id="sv-nav">${navHTML()}</nav>
      </aside>
      <main class="sv-main" id="sv-main"><div class="sv-body" id="settings-body"></div></main>
    </div>`;
  }

  function renderBody() {
    const box = document.getElementById('settings-body');
    if (!box) return;
    const fn = BODIES[Settings.tab] || BODIES.general;
    box.innerHTML = fn();
    bindInline();
  }
  /* 外观变更后整页重绘，但保留右栏滚动位置：
     主题卡/配色卡/「当前」文案必须始终等于实际应用的 Store 状态 */
  function rerenderBody() {
    const main = document.getElementById('sv-main');
    const top = main ? main.scrollTop : 0;
    renderBody();
    if (main) main.scrollTop = top;
  }

  function renderNav() {
    const nav = document.getElementById('sv-nav');
    if (nav) nav.innerHTML = navHTML();
  }

  /* ---------- 打开 / 关闭 / 切页 ---------- */
  TF.openSettings = function (tab) {
    const host = document.getElementById('settings-view');
    if (!host) return;
    if (!Settings.open) {
      Settings.open = true;
      host.hidden = false;
      host.innerHTML = shellHTML();
      const q = document.getElementById('sv-q');
      if (q) q.addEventListener('input', onSearch);
    }
    Settings.tab = (tab && BODIES[tab]) ? tab : Settings.tab;
    /* 打开时按 Store 重新落一遍颜色：避免外部/旧窗口状态让页面停留在过期明暗 */
    if (TF.applyAppearance) { try { TF.applyAppearance(); } catch (e) { } }
    renderNav();
    renderBody();
    host.classList.add('on');
    requestAnimationFrame(() => host.classList.add('show'));
  };

  TF.closeSettings = function () {
    const host = document.getElementById('settings-view');
    if (!host || !Settings.open) return;
    Settings.open = false;
    host.classList.remove('show');
    setTimeout(() => {
      if (!Settings.open) { host.classList.remove('on'); host.hidden = true; host.innerHTML = ''; }
    }, 200);
    if (TF.App && TF.App.render) TF.App.render();
  };

  TF.renderSettingsIfOpen = function () {
    if (Settings.open) { renderNav(); renderBody(); }
  };
  TF.resetSettingsView = function () {
    Settings.open = false;
    const host = document.getElementById('settings-view');
    if (host) { host.hidden = true; host.innerHTML = ''; host.classList.remove('on', 'show'); }
  };

  function switchTab(id) {
    if (!BODIES[id] || id === Settings.tab) return;
    const main = document.getElementById('sv-main');
    if (main) Settings.scroll[Settings.tab] = main.scrollTop;
    Settings.tab = id;
    renderNav();
    renderBody();
    if (main) main.scrollTop = Settings.scroll[id] || 0;
  }

  function onSearch(e) {
    Settings.q = e.target.value.trim();
    if (!Settings.q) return;
    const keys = {
      general: ['常规', '密度', '语言', '配置', '专注'],
      appearance: ['外观', '主题', '配色', '字号', '宽度', '强调', '特效', '高光'],
      notify: ['通知', '提醒', '声音', '免打扰'],
      shortcut: ['快捷键', '捕获', '命令'],
      wishes: ['愿望', '实现'],
      data: ['数据', '导入', '导出', '快照', '重置'],
      about: ['关于', '版本', '诊断', '许可', '更新', '检查']
    };
    const hit = TABS.find(t => keys[t.id] && keys[t.id].some(k => k.includes(Settings.q) || Settings.q.includes(k)));
    if (hit) switchTab(hit.id);
  }

  /* ---------- 外观控件即时生效 ---------- */
  function applyAp(patch) {
    TF.applyAppearance(patch, { anim: true });
    if (TF.App && TF.App.renderStatusbar) TF.App.renderStatusbar();
  }

  function bindInline() {
    ['work', 'short', 'long'].forEach(k => {
      const el = document.getElementById('set-' + k);
      if (!el) return;
      el.addEventListener('change', () => {
        const v = Math.max(1, Math.min(120, +el.value || 1));
        st().pomo[k] = v; S().save();
        if (TF.Pomo && !TF.Pomo.running) { TF.Pomo.remain = TF.pomoTotal(); App().render(); }
      });
    });
    const f = document.getElementById('set-font');
    if (f) f.addEventListener('input', () => {
      const v = +f.value;
      applyAp({ fontSize: v });
      const o = document.getElementById('font-out'); if (o) o.textContent = v + '%';
      const w = document.getElementById('set-width');
      if (w) w.value = ap().contentWidth;
    });
    const w = document.getElementById('set-width');
    if (w) w.addEventListener('input', () => {
      const v = +w.value;
      applyAp({ contentWidth: v });
      const o = document.getElementById('width-out'); if (o) o.textContent = v + 'px';
    });
    const hex = document.getElementById('set-accent-hex');
    if (hex) hex.addEventListener('change', () => {
      const v = String(hex.value || '').trim();
      if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) { TF.toast('颜色格式应为 #RRGGBB', 'warn'); hex.value = ap().accentOverride || TF.appearanceTokens().accent; return; }
      applyAp({ accentOverride: v });
      if (Settings.tab === 'appearance') renderBody();
    });
  }

  /* ---------- 点击委托（独立于 app.js 的 data-act） ---------- */
  function handle(el) {
    const a = el.dataset.sact;
    if (!a) return;
    switch (a) {
      case 'close': TF.closeSettings(); break;
      case 'tab': switchTab(el.dataset.v); break;
      case 'mode': applyAp({ mode: el.dataset.v }); renderNav(); rerenderBody(); break;
      case 'scheme': applyAp({ scheme: el.dataset.v }); renderNav(); rerenderBody(); break;
      case 'toggle': {
        const k = el.dataset.k;
        const patch = {};
        if (k === 'highlight') patch.highlight = !ap().highlight;

        if (Object.keys(patch).length) applyAp(patch);
        renderBody();
        break;
      }
      case 'font-step': {
        const v = Math.max(70, Math.min(120, ap().fontSize + Number(el.dataset.v)));
        applyAp({ fontSize: v }); renderBody();
        break;
      }
      case 'width-step': {
        const v = Math.max(640, Math.min(1200, ap().contentWidth + Number(el.dataset.v)));
        applyAp({ contentWidth: v }); renderBody();
        break;
      }
      case 'accent': applyAp({ accentOverride: el.value }); renderBody(); break;
      case 'accent-pick': applyAp({ accentOverride: el.dataset.v }); renderBody(); break;
      case 'accent-reset': applyAp({ accentOverride: null }); renderBody(); break;
      case 'custom': {
        const c = Object.assign({}, ap().custom);
        c[el.dataset.k] = el.value;
        applyAp({ custom: c });
        const code = el.parentElement && el.parentElement.querySelector('code');
        if (code) code.textContent = el.value;
        break;
      }
      case 'density': {
        st().density = el.dataset.v === 'compact' ? 'compact' : 'normal';
        S().save(); TF.applyTheme(); renderBody();
        break;
      }
      case 'update-check': updateAction('check'); break;
      case 'update-download': updateAction('download'); break;
      case 'update-install': updateAction('install'); break;
      case 'update-open': {
        const u = updb();
        if (u) u.openReleasePage();
        break;
      }
      case 'open-link': {
        const url = String(el.dataset.url || '');
        const b = window.tfBridge;
        if (b && b.shell && b.shell.openExternal) b.shell.openExternal(url);
        else if (url) window.open(url, '_blank', 'noopener');
        break;
      }
    }
  }

  async function updateAction(kind) {
    const u = updb();
    if (!u) { if (TF.toast) TF.toast('浏览器预览不支持自动更新', 'warn'); return; }
    try {
      if (kind === 'check') {
        UPD.phase = 'checking'; UPD.message = '正在检查…'; rerenderAbout();
        const r = await u.check(true);
        if (!r || !r.ok) {
          UPD.phase = 'error'; UPD.message = (r && r.message) || '检查失败';
        } else if (r.status === 'no-update') {
          UPD.phase = 'idle'; UPD.message = '已是最新版本 v' + TF.VERSION;
        } else {
          UPD.phase = 'available'; UPD.version = r.version; UPD.notes = r.notes || ''; UPD.message = '发现新版本 v' + r.version;
        }
        rerenderAbout();
      } else if (kind === 'download') {
        UPD.phase = 'downloading'; UPD.progress = 0; UPD.message = '准备下载…'; rerenderAbout();
        const r = await u.download();
        if (!r || !r.ok) {
          UPD.phase = 'error'; UPD.message = (r && r.message) || '下载失败';
          if (TF.toast) TF.toast(UPD.message, 'warn');
        } else {
          UPD.phase = 'downloaded'; UPD.progress = 1; UPD.message = '已下载，SHA256 校验通过';
        }
        rerenderAbout();
      } else if (kind === 'install') {
        const r = await u.install();
        if (!r || !r.ok) {
          UPD.phase = 'error'; UPD.message = (r && r.message) || '安装失败';
          if (TF.toast) TF.toast(UPD.message, 'warn');
        } else {
          UPD.phase = 'installing'; UPD.message = '正在静默安装…';
        }
        rerenderAbout();
      }
    } catch (e) {
      UPD.phase = 'error'; UPD.message = String(e && e.message || e);
      rerenderAbout();
    }
  }

  document.addEventListener('click', e => {
    const tg = e.target;
    if (!tg || typeof tg.closest !== 'function') return;
    if (!tg.closest('#settings-view')) return;
    if (tg.closest('.sv-search input')) return;
    /* 设置页内的 data-act 交给 app.js；data-sact 由本文件处理 */
    const el = tg.closest('[data-sact]');
    if (el) handle(el);
  }, true);

  document.addEventListener('keydown', e => {
    if (!Settings.open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); TF.closeSettings(); }
  }, true);

  initUpdateBridge();
})();
