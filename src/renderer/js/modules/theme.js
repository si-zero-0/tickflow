/* ===== 主题层：6 套配色主题 + 6 种强调色（纯表 + 取色/应用函数） ===== */
(function () {
  const TF = (window.TF = window.TF || {});

  /* 每套主题的完整 token（设置卡/浮层预览直接取色，避免 getComputedStyle）。
     色值逐字来自 DESIGN §5.2.2，与 css/theme.css 一一对应。
     tokens 15 项 = 12 个中性色 + 3 个阴影；ac 为「该主题 + 默认蓝」的真实生效值。 */
  const THEMES = [
    {
      id: 'graphite', name: '石墨', mode: 'dark', bg: '#080B10', panel: '#10151E', ac: '#5B8CFF',
      tokens: {
        bg: '#080B10', bg2: '#0C1017', panel: '#10151E', panel2: '#151C27', elev: '#1A2230',
        line: '#1E2733', line2: '#2B3644', cbx: '#4B5768', edge: '#39455A',
        tx: '#E9EFF8', tx2: '#9FADC0', tx3: '#74808F', ac: '#5B8CFF',
        sh1: '0 1px 2px rgba(0,0,0,.28)',
        sh2: '0 10px 28px rgba(0,0,0,.34)',
        sh3: '0 26px 64px rgba(0,0,0,.52)'
      }
    },
    {
      id: 'night', name: '极夜', mode: 'dark', bg: '#070910', panel: '#0E131D', ac: '#5B8CFF',
      tokens: {
        bg: '#070910', bg2: '#0A0D15', panel: '#0E131D', panel2: '#131926', elev: '#18202E',
        line: '#1B2434', line2: '#293344', cbx: '#4E596B', edge: '#374359',
        tx: '#E6EDF7', tx2: '#A2AFC2', tx3: '#7A8699', ac: '#5B8CFF',
        sh1: '0 1px 2px rgba(0,0,0,.30)',
        sh2: '0 10px 28px rgba(0,0,0,.36)',
        sh3: '0 26px 64px rgba(0,0,0,.56)'
      }
    },
    {
      id: 'tundra', name: '苔原', mode: 'dark', bg: '#090D0C', panel: '#101714', ac: '#5B8CFF',
      tokens: {
        bg: '#090D0C', bg2: '#0C1210', panel: '#101714', panel2: '#161E1A', elev: '#1B2420',
        line: '#1E2723', line2: '#2C3833', cbx: '#4C5A54', edge: '#3A4842',
        tx: '#E7EFEA', tx2: '#A0AFA6', tx3: '#75857B', ac: '#5B8CFF',
        sh1: '0 1px 2px rgba(0,0,0,.28)',
        sh2: '0 10px 28px rgba(0,0,0,.34)',
        sh3: '0 26px 64px rgba(0,0,0,.52)'
      }
    },
    {
      id: 'dawn', name: '晨光', mode: 'light', bg: '#F7F6F3', panel: '#FFFFFF', ac: '#3D6FE0',
      tokens: {
        bg: '#F7F6F3', bg2: '#F0EFEB', panel: '#FFFFFF', panel2: '#F6F5F1', elev: '#FFFFFF',
        line: '#E6E3DC', line2: '#D5D1C8', cbx: '#B5B0A5', edge: '#C8C3B8',
        tx: '#15171A', tx2: '#4E5157', tx3: '#6A6D74', ac: '#3D6FE0',
        sh1: '0 1px 2px rgba(60,55,40,.06)',
        sh2: '0 10px 26px rgba(60,55,40,.10)',
        sh3: '0 26px 60px rgba(60,55,40,.16)'
      }
    },
    {
      id: 'mist', name: '雾蓝', mode: 'light', bg: '#F4F7FB', panel: '#FFFFFF', ac: '#3D6FE0',
      tokens: {
        bg: '#F4F7FB', bg2: '#ECF1F8', panel: '#FFFFFF', panel2: '#F5F8FC', elev: '#FFFFFF',
        line: '#E2E8F1', line2: '#D0D9E5', cbx: '#B4BECD', edge: '#C6D0DE',
        tx: '#0F172A', tx2: '#4B5768', tx3: '#667186', ac: '#3D6FE0',
        sh1: '0 1px 2px rgba(16,26,45,.06)',
        sh2: '0 10px 26px rgba(16,26,45,.10)',
        sh3: '0 26px 60px rgba(16,26,45,.18)'
      }
    },
    {
      id: 'paper', name: '纸感', mode: 'light', bg: '#F2F1EE', panel: '#FDFCFA', ac: '#3D6FE0',
      tokens: {
        bg: '#F2F1EE', bg2: '#EBE9E5', panel: '#FDFCFA', panel2: '#F4F3F0', elev: '#FFFFFF',
        line: '#E4E1DB', line2: '#D2CEC6', cbx: '#B3ADA2', edge: '#C7C2B8',
        tx: '#24221F', tx2: '#5C5A54', tx3: '#6B6862', ac: '#3D6FE0',
        sh1: '0 1px 2px rgba(80,66,44,.06)',
        sh2: '0 10px 26px rgba(80,66,44,.10)',
        sh3: '0 26px 60px rgba(80,66,44,.16)'
      }
    }
  ];

  /* 六种强调色：dark 用亮色块、light 用深色块；hue 供 hex → 枚举的色相就近映射。
     色值逐字来自 DESIGN §5.2.3。 */
  const ACCENTS = [
    { id: 'blue', name: '蓝', dark: '#5B8CFF', light: '#3D6FE0', dark2: '#8B6BFF', light2: '#7B4CE0', hue: 222 },
    { id: 'cyan', name: '青', dark: '#25C2D4', light: '#0B7D8F', dark2: '#3AA8E8', light2: '#1C7FB8', hue: 187 },
    { id: 'green', name: '绿', dark: '#2BD4A3', light: '#0B8060', dark2: '#57C46B', light2: '#2F8F45', hue: 162 },
    { id: 'purple', name: '紫', dark: '#A06BFF', light: '#7B4CE0', dark2: '#C86BD8', light2: '#9A45AC', hue: 265 },
    { id: 'orange', name: '橙', dark: '#F5A623', light: '#A65F00', dark2: '#F07B3C', light2: '#B85417', hue: 36 },
    { id: 'rose', name: '玫红', dark: '#FF5F7A', light: '#D63A57', dark2: '#F062A0', light2: '#B33A72', hue: 350 }
  ];

  TF.THEMES = THEMES;
  TF.ACCENTS = ACCENTS;

  const FALLBACK_THEME = 'graphite';
  const FALLBACK_ACCENT = 'blue';

  /* 按 id 取主题定义，非法的 id 返回 null（调用方自行兜底） */
  TF.themeDef = function (id) {
    return THEMES.find(t => t.id === id) || null;
  };

  /* 按 id 取强调色定义，非法的 id 返回 null */
  TF.accentDef = function (id) {
    return ACCENTS.find(a => a.id === id) || null;
  };

  /* 强调色的真实生效 hex（按当前明暗档位取 dark / light 值） */
  TF.accentHex = function (id, mode) {
    const a = TF.accentDef(id) || ACCENTS[0];
    return mode === 'light' ? a.light : a.dark;
  };

  /* '#RRGGBB' | '#RGB' → 0~360 色相；非法或灰阶返回 -1 */
  function hueOf(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex == null ? '' : hex).trim());
    if (!m) return -1;
    let s = m[1];
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const r = parseInt(s.slice(0, 2), 16) / 255;
    const g = parseInt(s.slice(2, 4), 16) / 255;
    const b = parseInt(s.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d === 0) return -1;
    let h;
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    return (h + 360) % 360;
  }

  /* 任意颜色值 → 六个强调色之一（色相最近；非 hex / 灰阶 / 非法 → blue） */
  TF.hexToAccent = function (hex) {
    const raw = String(hex == null ? '' : hex).trim().toLowerCase();
    if (ACCENTS.some(a => a.id === raw)) return raw;      // 已是枚举，直接放行
    const h = hueOf(raw);
    if (h < 0) return FALLBACK_ACCENT;
    let best = FALLBACK_ACCENT, bestD = 361;
    ACCENTS.forEach(a => {
      let d = Math.abs(h - a.hue);
      if (d > 180) d = 360 - d;                          // 色相环取最短弧
      if (d < bestD) { bestD = d; best = a.id; }
    });
    return best;
  };

  /* 当前外观的中文标签，toast 文案用：'苔原 · 紫' */
  TF.themeLabel = function () {
    const S = TF.Store;
    const st = (S && S.data && S.data.settings) || {};
    const th = TF.themeDef(st.theme) || THEMES[0];
    const ac = TF.accentDef(st.accent) || ACCENTS[0];
    return th.name + ' · ' + ac.name;
  };

  let animTimer = 0;

  /* 把外观写进 <html>。v1.13 起颜色由 appearance.js 统一注入（9 套方案 × 浅/深），
     本函数只保留兼容别名：旧调用点（12 处）继续有效，内部转到 TF.applyAppearance。 */
  TF.applyTheme = function (opts) {
    if (typeof TF.applyAppearance === 'function') {
      TF.applyAppearance(null, { anim: !!(opts && opts.anim) });
      return;
    }
    const r = typeof document !== 'undefined' ? document.documentElement : null;
    if (!r || !r.dataset) return;
    const st = curSettings();
    r.dataset.theme = (TF.themeDef(st.theme) || THEMES[0]).id;
    r.dataset.mode = (TF.themeDef(st.theme) || THEMES[0]).mode;
  };

  /* 当前设置的快照（Store 未就绪时给默认值） */
  function curSettings() {
    const S = TF.Store;
    return (S && S.data && S.data.settings) || { theme: FALLBACK_THEME, accent: FALLBACK_ACCENT, density: 'normal' };
  }
  function curTheme() {
    return TF.themeDef(curSettings().theme) || THEMES[0];
  }

  /* 只切换 .on 与预览色块，不重建任何 DOM（P0-05：设置面板不关闭、不闪、不丢滚动） */
  function syncOn() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    const st = curSettings();
    document.querySelectorAll('[data-theme-id]').forEach(b => {
      b.classList.toggle('on', b.dataset.themeId === st.theme);
    });
    document.querySelectorAll('[data-accent-id]').forEach(b => {
      b.classList.toggle('on', b.dataset.accentId === st.accent);
    });
    // 预览卡第三块用「当前 accent + 该主题的明暗档」的真实生效值
    document.querySelectorAll('.th-card[data-theme-id]').forEach(b => {
      const t = TF.themeDef(b.dataset.themeId);
      const sw = b.querySelector('.th-sw i:nth-child(3)');
      if (t && sw) sw.style.background = TF.accentHex(st.accent, t.mode);
    });
  }
  TF.syncThemeOn = syncOn;

  /* v1.13：旧主题 id → 新方案（04 §6），保留旧 API 供命令面板/浮层调用 */
  const OLD_TO_NEW = {
    graphite: ['kun-default', 'dark'],
    night: ['ink', 'dark'],
    tundra: ['mint', 'dark'],
    dawn: ['parchment', 'light'],
    mist: ['sky', 'light'],
    paper: ['parchment', 'light']
  };

  TF.setTheme = function (id) {
    if (!TF.themeDef(id)) return;
    const S = TF.Store;
    if (!S || !S.data) return;
    S.data.settings.theme = id;
    const map = OLD_TO_NEW[id];
    if (map && typeof TF.applyAppearance === 'function') {
      TF.applyAppearance({ scheme: map[0], mode: map[1] }, { anim: true });
    } else {
      S.save();
      TF.applyTheme({ anim: true });
    }
    syncOn();
    if (TF.toast) TF.toast(TF.themeLabel(), 'info');
  };

  TF.setAccent = function (id) {
    if (!TF.accentDef(id)) return;
    const S = TF.Store;
    if (!S || !S.data) return;
    S.data.settings.accent = id;
    if (typeof TF.applyAppearance === 'function') {
      /* 旧强调色 → 新覆盖色；blue 是方案默认，视作「不覆盖」 */
      TF.applyAppearance({ accentOverride: id === 'blue' ? null : TF.accentHex(id, 'dark') }, { anim: true });
    } else {
      S.save();
      TF.applyTheme({ anim: true });
    }
    syncOn();
    if (TF.toast) TF.toast(TF.themeLabel(), 'info');
  };

  function thPills() {
    const st = curSettings();
    return THEMES.map(t =>
      `<button class="th-pill ${st.theme === t.id ? 'on' : ''}" data-act="theme-pick" data-theme-id="${t.id}">${t.name}</button>`).join('');
  }

  function acDots(small) {
    const st = curSettings();
    const mode = curTheme().mode;
    return ACCENTS.map(a =>
      `<button class="ac-dot ${st.accent === a.id ? 'on' : ''}${small ? ' sm' : ''}" data-act="accent-pick" data-accent-id="${a.id}"
        style="--d:${TF.accentHex(a.id, mode)}" title="${a.name}" aria-label="${a.name}"></button>`).join('');
  }

  /* 侧栏底部「外观」浮层：复用 #theme-pop，按锚点向上展开（bottom 定位，避免高度变化导致出界） */
  TF.openThemePopover = function (anchor) {
    if (typeof document === 'undefined') return;
    if (document.getElementById('theme-pop')) return TF.closeThemePopover();
    if (!anchor) return;
    const pop = document.createElement('div');
    pop.id = 'theme-pop';
    pop.className = 'pop th-pop';
    pop.innerHTML = `<div class="pop-h">外观<span>点击即生效</span></div>
      <div class="th-pills">${thPills()}</div>
      <div class="ac-row ac-row-sm"><span class="ac-lab">强调色</span>${acDots(true)}</div>`;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const h = pop.offsetHeight || 150;
    pop.style.left = Math.round(Math.max(8, r.left)) + 'px';
    pop.style.bottom = Math.round(Math.max(8, window.innerHeight - r.top + 6)) + 'px';
    if (h > window.innerHeight - 80) pop.style.maxHeight = 'min(320px, calc(100vh - 80px))';
    requestAnimationFrame(() => pop.classList.add('on'));
  };

  TF.closeThemePopover = function () {
    if (typeof document === 'undefined') return;
    const pop = document.getElementById('theme-pop');
    if (!pop) return;
    pop.classList.remove('on');
    setTimeout(() => {
      const x = document.getElementById('theme-pop');
      if (x && !x.classList.contains('on')) x.remove();
    }, 180);
  };
})();
