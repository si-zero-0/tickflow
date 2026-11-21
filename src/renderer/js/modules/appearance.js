/* ===== 外观层 v1.13：9 套配色 × 浅/深/系统 · 字号 · 内容宽度 · 强调色 · 交互特效 =====
   职责边界：
   - 唯一写 <html> 的 data-mode / data-scheme / data-font / data-width 与颜色变量；
   - 读 Store.data.settings.appearance（Store 是唯一事实源）；
   - 不重建任何 DOM，只改变量（不闪白、不丢滚动）。
   数据：data/schemes.json（构建时随 www 一起复制）。
*/
(function () {
  const TF = (window.TF = window.TF || {});

  const DEFAULTS = {
    mode: 'dark',
    scheme: 'kun-default',
    accentOverride: null,
    fontSize: 82,
    contentWidth: 896,
    highlight: true,
    custom: { bg: '#0A1220', panel: '#0F1A2B', border: '#1E2F47', accent: '#5AA7FF' }
  };
  const RANGES = { fontSize: [70, 120], contentWidth: [640, 1200] };
  const SCHEME_IDS = ['kun-default', 'sky', 'parchment', 'mint', 'sakura', 'dusk', 'amber', 'ink', 'custom'];

  /* 首屏兜底：schemes.json 未加载前也能正确应用 Kun 默认两档 */
  const FALLBACK = {
    'kun-default': {
      dark: {
        bg: '#0A1220', panel: '#0F1A2B', panel2: '#13223A', panel3: '#182A45',
        border: '#1E2F47', borderStrong: '#2B405C',
        text: '#E6EDF7', text2: '#9AAEC8', text3: '#7A8DA8',
        accent: '#5AA7FF', accent2: '#8CC8FF', accentInk: '#07101E',
        accentSoft: 'rgba(90,167,255,.14)',
        success: '#3DDC97', warning: '#F5B544', danger: '#FF6B81', selection: '#16294A'
      },
      light: {
        bg: '#F4F6FA', panel: '#FFFFFF', panel2: '#F7F9FC', panel3: '#EEF3FA',
        border: '#E2E8F0', borderStrong: '#CBD5E1',
        text: '#16202F', text2: '#52627A', text3: '#5F6F82',
        accent: '#2768C2', accent2: '#5FA8F5', accentInk: '#FFFFFF',
        accentSoft: 'rgba(47,124,224,.12)',
        success: '#0E8F62', warning: '#9A5B00', danger: '#C62F4A', selection: '#E8F1FF'
      }
    }
  };

  const SCHEMES = Object.assign({}, FALLBACK);

  let loaded = false;
  let readyResolve;
  TF.appearanceReady = new Promise((res) => { readyResolve = res; });

  /* schemes.json 的 camelCase 键 → 组件实际消费的 CSS 变量名（唯一映射表） */
  const TOKEN_VARS = {
    bg: '--bg', panel: '--panel', panel2: '--panel-2', panel3: '--panel-3',
    border: '--border', borderStrong: '--border-strong',
    text: '--text', text2: '--text-2', text3: '--text-3',
    accent: '--accent', accent2: '--accent-2', accentInk: '--accent-ink', accentSoft: '--accent-soft',
    success: '--success', warning: '--warning', danger: '--danger', selection: '--selection'
  };
  TF.TOKEN_VARS = TOKEN_VARS;

  function kebab(k) { return k.replace(/([A-Z])/g, m => '-' + m.toLowerCase()); }

  function clamp(n, lo, hi, fallback) {
    const v = Number(n);
    if (!Number.isFinite(v)) return fallback;
    return Math.min(hi, Math.max(lo, Math.round(v)));
  }

  function isHex(v) { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || '').trim()); }

  /* 任意输出 → 规范化，非法值回默认（T1.2 的钳制规则） */
  function norm(a) {
    a = Object.assign({}, DEFAULTS, a || {});
    a.mode = (a.mode === 'light' || a.mode === 'system') ? a.mode : 'dark';
    a.scheme = SCHEME_IDS.indexOf(a.scheme) >= 0 ? a.scheme : 'kun-default';
    a.fontSize = clamp(a.fontSize, RANGES.fontSize[0], RANGES.fontSize[1], DEFAULTS.fontSize);
    a.contentWidth = clamp(a.contentWidth, RANGES.contentWidth[0], RANGES.contentWidth[1], DEFAULTS.contentWidth);
    a.accentOverride = isHex(a.accentOverride) ? a.accentOverride : null;
    a.highlight = a.highlight !== false;
    /* 旧版本可能存有 appearance.ripple；该字段已废弃，归一后不再保留，老数据不会报错 */
    a.custom = Object.assign({}, DEFAULTS.custom, a.custom || {});
    ['bg', 'panel', 'border', 'accent'].forEach(k => {
      if (!isHex(a.custom[k])) a.custom[k] = DEFAULTS.custom[k];
    });
    return a;
  }

  function currentSettings() {
    const S = TF.Store;
    if (!S || !S.data || !S.data.settings) return null;
    return S.data.settings;
  }

  function resolveMode(a) {
    if (a.mode !== 'system') return a.mode;
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) { return 'dark'; }
  }

  function hexToRgba(hex, alpha) {
    let s = hex.replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const r = parseInt(s.slice(0, 2), 16), g = parseInt(s.slice(2, 4), 16), b = parseInt(s.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function lumHex(hex) {
    let s = String(hex || '').replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const c = i => { const v = parseInt(s.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * c(0) + 0.7152 * c(2) + 0.0722 * c(4);
  }

  /* 自定义方案：明暗由用户选的背景亮度决定，避免「浅色模式 + 深色底」混搭出低对比 */
  function customMode(a) {
    return lumHex(a.custom.bg) > 0.42 ? 'light' : 'dark';
  }

  /* 计算某一方案在某一明暗下的 token（自定义方案以 Kun 默认派生） */
  function tokensFor(a, mode) {
    let base = (SCHEMES[a.scheme] && SCHEMES[a.scheme][mode]) || SCHEMES['kun-default'][mode];
    if (a.scheme === 'custom') base = SCHEMES['kun-default'][customMode(a)];
    const t = Object.assign({}, base);
    if (a.scheme === 'custom') {
      t.bg = a.custom.bg;
      t.panel = a.custom.panel;
      t.border = a.custom.border;
      t.panel2 = mix(t.panel, t.bg, 0.18);
      t.panel3 = mix(t.panel, t.bg, 0.36);
      t.borderStrong = mix(a.custom.border, t.text || '#888888', 0.35);
      t.accent = a.custom.accent;
      t.accentSoft = hexToRgba(a.custom.accent, 0.14);
      t.accentInk = customMode(a) === 'dark' ? '#07101E' : '#FFFFFF';
      t.accent2 = a.custom.accent;
    }
    if (a.accentOverride) {
      t.accent = a.accentOverride;
      t.accent2 = a.accentOverride;
      t.accentSoft = hexToRgba(a.accentOverride, mode === 'dark' ? 0.14 : 0.12);
      t.accentInk = mode === 'dark' ? '#07101E' : '#FFFFFF';
    }
    return t;
  }

  function mix(c1, c2, w) {
    const p = h => {
      let s = String(h || '').replace('#', '');
      if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
      return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
    };
    try {
      const a = p(c1), b = p(c2);
      const v = a.map((x, i) => Math.round(x * (1 - w) + b[i] * w));
      return '#' + v.map(x => String(Math.min(255, Math.max(0, x)).toString(16)).padStart(2, '0')).join('');
    } catch (e) { return c1 || c2; }
  }

  let animTimer = 0;

  /* 核心：只写 dataset + CSS 变量；返回本次实际使用的 token（便于测试/断言） */
  function paint(a, opts) {
    const o = opts || {};
    const mode = a.scheme === 'custom' ? customMode(a) : resolveMode(a);
    const tokens = tokensFor(a, mode);
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (!root) return { mode, tokens };

    root.dataset.mode = mode;
    root.dataset.scheme = a.scheme;
    root.dataset.font = String(a.fontSize);
    root.dataset.width = String(a.contentWidth);

    Object.keys(tokens).forEach(k => {
      const v = TOKEN_VARS[k] || ('--' + kebab(k));
      if (tokens[k]) root.style.setProperty(v, tokens[k]);
    });
    root.style.setProperty('--font-scale', String(a.fontSize / 82));
    root.style.setProperty('--content-w', a.contentWidth + 'px');

    if (o.anim && root.classList && !prefersReduce()) {
      root.classList.add('theme-anim');
      clearTimeout(animTimer);
      animTimer = setTimeout(() => root.classList.remove('theme-anim'), 180);
    }
    return { mode, tokens };
  }

  function prefersReduce() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /* 当前外观快照（Store 未就绪时返回规范化默认值） */
  TF.getAppearance = function () {
    const s = currentSettings();
    return norm(s && s.appearance);
  };

  /* 写 Store + 应用 + 广播。patch 为部分字段；不传则只重绘当前值 */
  TF.applyAppearance = function (patch, opts) {
    const s = currentSettings();
    if (!s) {
      /* Store 未 load：只做首屏兜底应用 */
      const a0 = norm(patch);
      paint(a0, opts);
      return a0;
    }
    s.appearance = norm(Object.assign({}, s.appearance || {}, patch || {}));
    if (patch) s.appearance.accentOverride = isHex(s.appearance.accentOverride) ? s.appearance.accentOverride : null;
    paint(s.appearance, opts);
    if (patch) {
      if (typeof TF.Store.save === 'function') TF.Store.save();
    }
    try {
      document.dispatchEvent(new CustomEvent('tf:appearance', { detail: s.appearance }));
    } catch (e) { }
    return s.appearance;
  };

  /* 只应用不落盘（设置页 hover 预览用；Esc 时可回滚） */
  TF.previewAppearance = function (patch) {
    const a = norm(Object.assign({}, TF.getAppearance(), patch || {}));
    paint(a, { anim: true });
    return a;
  };
  TF.setAppearance = TF.applyAppearance;

  TF.appearanceTokens = function (patch) {
    const a = norm(Object.assign({}, TF.getAppearance(), patch || {}));
    return tokensFor(a, a.scheme === 'custom' ? customMode(a) : resolveMode(a));
  };

  /* 设置页卡片预取色：某方案的浅/深两档 */
  TF.schemePreview = function (id) {
    const scheme = SCHEME_IDS.indexOf(id) >= 0 ? id : 'kun-default';
    const a = norm(Object.assign({}, TF.getAppearance(), { scheme: scheme }));
    return { dark: tokensFor(a, 'dark'), light: tokensFor(a, 'light') };
  };
  TF.SCHEME_IDS = SCHEME_IDS;
  TF.APPEARANCE_DEFAULTS = DEFAULTS;
  TF.APPEARANCE_RANGES = RANGES;

  /* ---------- 方案注册：schemes.json → SCHEMES（单测可直接注入，不依赖网络） ---------- */
  TF.registerSchemes = function (json) {
    if (!json || !json.schemes) return false;
    Object.keys(json.schemes).forEach(k => {
      const v = json.schemes[k];
      if (v && v.dark && v.light) SCHEMES[k] = { dark: v.dark, light: v.light, name: v.name, desc: v.desc };
    });
    if (json.defaults) Object.assign(DEFAULTS, {
      mode: json.defaults.mode, scheme: json.defaults.scheme,
      fontSize: json.defaults.fontSize, contentWidth: json.defaults.contentWidth
    });
    TF.SCHEMES = SCHEMES;
    loaded = true;
    return true;
  };

  /* ---------- 异步加载 schemes.json（失败则用兜底） ---------- */
  (function loadSchemes() {
    try {
      if (typeof fetch !== 'function' || typeof document === 'undefined') { readyResolve(false); return; }
      fetch('data/schemes.json', { cache: 'no-cache' })
        .then(r => r.ok ? r.json() : null)
        .then(json => {
          TF.registerSchemes(json);
          readyResolve(true);
          TF.applyAppearance();              // 用真实色板重绘一次（无动画）
          if (typeof TF.renderSettingsIfOpen === 'function') TF.renderSettingsIfOpen();
        })
        .catch(() => { loaded = true; TF.SCHEMES = SCHEMES; readyResolve(false); });
    } catch (e) {
      readyResolve(false);
    }
  })();

  /* ---------- 系统明暗跟随 ---------- */
  function bindSystem() {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const fn = () => {
        const a = TF.getAppearance();
        if (a.mode === 'system') TF.applyAppearance();
        document.documentElement.classList.toggle('reduce-motion', prefersReduce());
      };
      if (mq.addEventListener) mq.addEventListener('change', fn);
      else if (mq.addListener) mq.addListener(fn);
    } catch (e) { }
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.classList.toggle('reduce-motion', prefersReduce());
    }
  }
  bindSystem();
  TF.appearanceLoaded = () => loaded;
})();
