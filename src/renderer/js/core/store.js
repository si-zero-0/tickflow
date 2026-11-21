/* ===== 数据层：全部本地，localStorage 持久化，无任何网络请求 ===== */
(function () {
  const TF = (window.TF = window.TF || {});

  /* ---------- 工具 ---------- */
  const pad = n => String(n).padStart(2, '0');
  TF.uid = (p) => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);
  TF.ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  TF.today = () => TF.ymd(new Date());
  TF.parseDate = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  TF.addDays = (s, n) => { const d = TF.parseDate(s); d.setDate(d.getDate() + n); return TF.ymd(d); };
  TF.diffDays = (a, b) => Math.round((TF.parseDate(a) - TF.parseDate(b)) / 86400000);
  TF.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  TF.weekNames = ['日', '一', '二', '三', '四', '五', '六'];
  TF.cnDate = (s) => {
    if (!s) return '';
    const t = TF.today(), d = TF.diffDays(s, t);
    if (d === 0) return '今天';
    if (d === 1) return '明天';
    if (d === -1) return '昨天';
    if (d === 2) return '后天';
    const dt = TF.parseDate(s);
    const y = dt.getFullYear() === new Date().getFullYear() ? '' : dt.getFullYear() + '年';
    if (d > 0 && d < 7) return '周' + TF.weekNames[dt.getDay()];
    return y + (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
  };
  TF.colors = ['#5b8cff', '#a06bff', '#2bd4a3', '#f5a623', '#ff5f7a', '#25c2d4', '#8fbf3f', '#d174e8', '#7d8ba1'];
  TF.priName = ['无', '低', '中', '高'];

  /* ---------- v1.12：主题 / 强调色 / 设置默认值 ---------- */
  const THEME_IDS = ['graphite', 'night', 'tundra', 'dawn', 'mist', 'paper'];
  const THEME_ALIAS = { dark: 'graphite', light: 'mist' };   // 旧值 → 新值（paper 自身保留）
  const ACCENT_IDS = ['blue', 'cyan', 'green', 'purple', 'orange', 'rose'];
  const ACCENT_HEX = { blue: '#5B8CFF', cyan: '#25C2D4', green: '#2BD4A3', purple: '#A06BFF', orange: '#F5A623', rose: '#FF5F7A' };
  const ACCENT_HUE = [['blue', 222], ['cyan', 187], ['green', 162], ['purple', 265], ['orange', 36], ['rose', 350]];
  const DEFAULT_ACCENT_HEX = ACCENT_HEX.blue;
  const WISH_STATUS = ['idea', 'doing', 'done'];
  const IS_HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

  /* v1.13 外观模型（04-DESIGN-TOKENS §1；范围 04 §2 / 02 §5.3） */
  const APPEARANCE_DEFAULTS = {
    mode: 'dark',
    scheme: 'kun-default',
    accentOverride: null,
    fontSize: 82,
    contentWidth: 896,
    highlight: true,
    custom: { bg: '#0A1220', panel: '#0F1A2B', border: '#1E2F47', accent: '#5AA7FF' }
  };
  const APPEARANCE_SCHEMES = ['kun-default', 'sky', 'parchment', 'mint', 'sakura', 'dusk', 'amber', 'ink', 'custom'];
  const FONT_RANGE = [70, 120];
  const WIDTH_RANGE = [640, 1200];

  /* v1.13 M3 顶部岛（03-M3-DUAL-ISLAND §6；默认关闭） */
  const M3_DEFAULTS = {
    enabled: false,
    position: 'top-center',
    monitor: 'primary',
    offsetX: 0,
    offsetY: 8,
    width: 360,
    opacity: 1,
    radius: 26,
    content: { task: true, count: true, countdown: true, reminders: true, focus: true },
    reminderOwner: 'top',
    autoExpand: true,
    hideOnFullscreen: true,
    minimal: false
  };

  /* v1.12 theme → v1.13 scheme/mode 映射（04 §6 / PRD §8.1） */
  const THEME_TO_SCHEME = {
    graphite: ['kun-default', 'dark'],
    night: ['ink', 'dark'],
    tundra: ['mint', 'dark'],
    dawn: ['parchment', 'light'],
    mist: ['sky', 'light'],
    paper: ['parchment', 'light']
  };

  const DEFAULT_SETTINGS = {
    theme: 'graphite',
    accent: 'blue',
    density: 'normal',
    showDone: true,
    island: { enabled: true, autoExpand: true },
    pomo: { work: 25, short: 5, long: 15, rounds: 4 },
    lastBackup: null,
    appearance: APPEARANCE_DEFAULTS,
    m3: M3_DEFAULTS
  };

  /* settings 每次都要全新对象：嵌套对象不得在 seed / blank / migrate 之间共享引用 */
  function cloneSettings() {
    return {
      theme: DEFAULT_SETTINGS.theme,
      accent: DEFAULT_SETTINGS.accent,
      density: DEFAULT_SETTINGS.density,
      showDone: DEFAULT_SETTINGS.showDone,
      island: { enabled: DEFAULT_SETTINGS.island.enabled, autoExpand: DEFAULT_SETTINGS.island.autoExpand },
      pomo: Object.assign({}, DEFAULT_SETTINGS.pomo),
      lastBackup: DEFAULT_SETTINGS.lastBackup,
      appearance: cloneAppearance(),
      m3: cloneM3()
    };
  }
  function cloneAppearance() {
    return {
      mode: APPEARANCE_DEFAULTS.mode,
      scheme: APPEARANCE_DEFAULTS.scheme,
      accentOverride: APPEARANCE_DEFAULTS.accentOverride,
      fontSize: APPEARANCE_DEFAULTS.fontSize,
      contentWidth: APPEARANCE_DEFAULTS.contentWidth,
      highlight: APPEARANCE_DEFAULTS.highlight,
      custom: Object.assign({}, APPEARANCE_DEFAULTS.custom)
    };
  }
  function cloneM3() {
    return Object.assign({}, M3_DEFAULTS, { content: Object.assign({}, M3_DEFAULTS.content) });
  }
  function clampNum(v, lo, hi, fb) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fb;
    return Math.min(hi, Math.max(lo, Math.round(n)));
  }
  function normHex(v, fb) {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || '').trim()) ? String(v).trim() : fb;
  }

  /* appearance 归一：范围钳制 + 枚举校验 + 自定义色四项（T1.2） */
  function normAppearance(a, fallback) {
    const src = Object.assign({}, cloneAppearance(), a || {});
    const out = {
      mode: (src.mode === 'light' || src.mode === 'system') ? src.mode : (fallback ? fallback.mode : 'dark'),
      scheme: APPEARANCE_SCHEMES.indexOf(src.scheme) >= 0 ? src.scheme : (fallback ? fallback.scheme : 'kun-default'),
      accentOverride: normHex(src.accentOverride, null),
      fontSize: clampNum(src.fontSize, FONT_RANGE[0], FONT_RANGE[1], fallback ? fallback.fontSize : 82),
      contentWidth: clampNum(src.contentWidth, WIDTH_RANGE[0], WIDTH_RANGE[1], fallback ? fallback.contentWidth : 896),
      highlight: src.highlight !== false,
      /* appearance.ripple 已废弃：旧值直接忽略，不再写回 Store */
      custom: Object.assign({}, APPEARANCE_DEFAULTS.custom)
    };
    ['bg', 'panel', 'border', 'accent'].forEach(k => {
      out.custom[k] = normHex(src.custom && src.custom[k], APPEARANCE_DEFAULTS.custom[k]);
    });
    return out;
  }

  /* m3 归一：默认关闭；数值范围钳制；归属枚举 */
  function normM3(m) {
    const src = Object.assign({}, cloneM3(), m || {});
    return {
      enabled: src.enabled === true,
      position: src.position === 'top-center' ? 'top-center' : 'top-center',
      monitor: src.monitor === 'cursor' ? 'cursor' : 'primary',
      offsetX: clampNum(src.offsetX, -2000, 2000, 0),
      offsetY: clampNum(src.offsetY, 0, 800, 8),
      width: clampNum(src.width, 280, 640, 360),
      opacity: clampNum((Number(src.opacity) || 1) * 100, 60, 100, 100) / 100,
      radius: clampNum(src.radius, 8, 40, 26),
      content: {
        task: (src.content || {}).task !== false,
        count: (src.content || {}).count !== false,
        countdown: (src.content || {}).countdown !== false,
        reminders: (src.content || {}).reminders !== false,
        focus: (src.content || {}).focus !== false
      },
      reminderOwner: ['top', 'bottom', 'follow-focus'].indexOf(src.reminderOwner) >= 0 ? src.reminderOwner : 'top',
      autoExpand: src.autoExpand !== false,
      hideOnFullscreen: src.hideOnFullscreen !== false,
      minimal: src.minimal === true
    };
  }


  /* hex → 强调色枚举：优先委托 theme.js 的 TF.hexToAccent，
     但本文件先于 theme.js 加载，故内置同一映射兜底（色相取最短弧） */
  function accentFromHex(hex) {
    if (typeof TF.hexToAccent === 'function') return TF.hexToAccent(hex);
    const m = IS_HEX.exec(String(hex == null ? '' : hex).trim());
    if (!m) return 'blue';
    let s = m[1];
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const r = parseInt(s.slice(0, 2), 16) / 255;
    const g = parseInt(s.slice(2, 4), 16) / 255;
    const b = parseInt(s.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d === 0) return 'blue';                       // 灰阶无色相 → 兜底
    let h;
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    h = (h + 360) % 360;
    let best = 'blue', bestD = 361;
    ACCENT_HUE.forEach(([id, hue]) => {
      let dist = Math.abs(h - hue);
      if (dist > 180) dist = 360 - dist;
      if (dist < bestD) { bestD = dist; best = id; }
    });
    return best;
  }

  /* 重复规则：{type:'daily|weekday|weekly|monthly', days:[0-6], mode:'fixed|after'} */
  TF.repNorm = function (r) {
    if (!r) return null;
    if (typeof r === 'string') return { type: r, days: [], mode: 'fixed' };
    return { type: r.type || 'daily', days: r.days || [], mode: r.mode || 'fixed' };
  };
  TF.repLabel = function (r) {
    const o = TF.repNorm(r);
    if (!o) return '';
    const wd = ['日', '一', '二', '三', '四', '五', '六'];
    if (o.type === 'daily') return '每天';
    if (o.type === 'weekday') return '工作日';
    if (o.type === 'weekly') return o.days.length ? '每周' + o.days.slice().sort().map(d => wd[d]).join('、') : '每周';
    if (o.type === 'monthly') return '每月';
    return '';
  };
  TF.repNext = function (r, from) {
    const o = TF.repNorm(r);
    const base = TF.parseDate(from);
    if (!o) return from;
    if (o.type === 'daily') return TF.addDays(from, 1);
    if (o.type === 'weekday') {
      let d = TF.addDays(from, 1);
      while ([0, 6].includes(TF.parseDate(d).getDay())) d = TF.addDays(d, 1);
      return d;
    }
    if (o.type === 'weekly') {
      const days = o.days.length ? o.days.slice().sort((a, b) => a - b) : [base.getDay()];
      for (let i = 1; i <= 14; i++) {
        const d = TF.addDays(from, i);
        if (days.includes(TF.parseDate(d).getDay())) return d;
      }
      return TF.addDays(from, 7);
    }
    if (o.type === 'monthly') {
      const y = base.getFullYear(), m = base.getMonth();
      const dim = new Date(y, m + 2, 0).getDate();
      const dd = Math.min(base.getDate(), dim);
      return TF.ymd(new Date(y, m + 1, dd));
    }
    return TF.addDays(from, 1);
  };

  /* 路线图默认排布：每个轨道内按顺序横排 */
  TF.RM_ROW = 156; TF.RM_STEP = 262; TF.RM_PAD_L = 44; TF.RM_PAD_TOP = 30;
  /* 每条轨道可单独纵向拉伸：l.h 缺省 = 156，范围 120~420 */
  TF.RM_MIN_H = 120; TF.RM_MAX_H = 420;
  TF.laneH = function (l) {
    const h = l && typeof l.h === 'number' ? l.h : TF.RM_ROW;
    return Math.max(TF.RM_MIN_H, Math.min(TF.RM_MAX_H, h));
  };
  TF.laneTops = function (p) {
    const out = [];
    let y = 0;
    p.lanes.forEach(l => { out.push(y); y += TF.laneH(l); });
    return out;
  };
  TF.layoutProcess = function (p) {
    const tops = TF.laneTops(p);
    p.lanes.forEach((l, li) => {
      p.nodes.filter(n => n.laneId === l.id).forEach((n, i) => {
        n.x = TF.RM_PAD_L + i * TF.RM_STEP;
        n.y = tops[li] + TF.RM_PAD_TOP;
      });
    });
  };

  /* ---------- 种子数据 ---------- */
  function seed() {
    const t = TF.today();
    const L = {
      inbox: { id: 'l_inbox', name: '收集箱', color: '#7d8ba1', icon: 'inbox', order: -1, inbox: true, archived: false },
      work: { id: 'l_work', name: '工作', color: '#5b8cff', icon: 'briefcase', order: 0, archived: false },
      life: { id: 'l_life', name: '个人', color: '#2bd4a3', icon: 'home', order: 1, archived: false },
      study: { id: 'l_study', name: '学习', color: '#a06bff', icon: 'book', order: 2, archived: false }
    };
    const mk = (o) => Object.assign({
      id: TF.uid('t'), listId: 'l_work', title: '', notes: '', done: false, doneAt: null,
      createdAt: new Date().toISOString(), due: null, dueTime: null, priority: 0, tags: [],
      subtasks: [], repeat: null, nodeId: null, pomo: 0, order: 0
    }, o);

    const tasks = [
      mk({ listId: 'l_inbox', title: '记一下：周末想去看的那个展', priority: 0, due: null }),
      mk({ listId: 'l_inbox', title: '研究一下本地优先的笔记工具', priority: 0, due: null, tags: ['想法'] }),
      mk({ listId: 'l_work', title: '梳理新版本需求清单', priority: 3, due: t, tags: ['产品'], notes: '对着用户反馈逐条过一遍，标注优先级。' }),
      mk({
        listId: 'l_work', title: '完成 MVP 首页原型', priority: 2, due: t, tags: ['设计'], nodeId: 'n_proto',
        subtasks: [
          { id: TF.uid('s'), title: '信息架构草稿', done: true },
          { id: TF.uid('s'), title: '首页线框图', done: true },
          { id: TF.uid('s'), title: '交互动效标注', done: false }
        ]
      }),
      mk({ listId: 'l_work', title: '周会同步进度（周五 15:00）', priority: 1, due: TF.addDays(t, 2), dueTime: '15:00', repeat: 'weekly', tags: ['会议'] }),
      mk({ listId: 'l_work', title: '给合作方回邮件', priority: 0, due: TF.addDays(t, -1), tags: ['沟通'] }),
      mk({ listId: 'l_life', title: '预约体检', priority: 2, due: TF.addDays(t, 1) }),
      mk({ listId: 'l_life', title: '买咖啡豆 + 牛奶', priority: 0, due: t, tags: ['采购'] }),
      mk({ listId: 'l_life', title: '整理书桌和硬盘', priority: 1, due: null }),
      mk({ listId: 'l_study', title: '读完《深度工作》第 3 章', priority: 2, due: TF.addDays(t, 3), tags: ['阅读'] }),
      mk({ listId: 'l_study', title: 'TypeScript 泛型练习 5 题', priority: 1, due: TF.addDays(t, 4), tags: ['编程'] }),
      mk({ listId: 'l_study', title: '复盘上周时间分配', priority: 0, done: true, doneAt: new Date(Date.now() - 864e5).toISOString(), due: TF.addDays(t, -1) })
    ];

    /* 进程示例：这是一个「游戏任务日志」式的路线图 */
    const process1 = {
      id: 'p_main', name: '把作品从 0 做到 1', icon: '🚀', color: '#5b8cff',
      desc: '一个为期一季度的主线：从需求验证到正式发布。支线并行推进增长与技术底座。',
      createdAt: new Date().toISOString(),
      lanes: [
        { id: 'ln_main', name: '主线', color: '#5b8cff' },
        { id: 'ln_grow', name: '增长支线', color: '#2bd4a3' },
        { id: 'ln_tech', name: '技术支线', color: '#a06bff' }
      ],
      nodes: []
    };
    const N = (o) => Object.assign({
      id: TF.uid('n'), processId: 'p_main', laneId: 'ln_main', title: '', desc: '',
      x: 0, y: 0, requires: [], checklist: [], status: 'auto', due: null, createdAt: new Date().toISOString()
    }, o);
    const ck = (txt, done) => ({ id: TF.uid('s'), title: txt, done: !!done, taskId: null });

    process1.nodes = [
      N({ id: 'n_validate', laneId: 'ln_main', title: '需求验证', desc: '找到 10 个真实用户，确认痛点存在', due: TF.addDays(t, -40), status: 'done',
        checklist: [ck('访谈 10 位目标用户', true), ck('整理痛点清单', true), ck('确认付费意愿', true)] }),
      N({ id: 'n_research', laneId: 'ln_main', title: '竞品调研', desc: '拆解 3 个同类产品的功能与定价', requires: ['n_validate'], due: TF.addDays(t, -28), status: 'done',
        checklist: [ck('功能矩阵对比', true), ck('定价策略分析', true)] }),
      N({ id: 'n_proto', laneId: 'ln_main', title: '原型设计', desc: '可点击的高保真原型，覆盖核心 3 条路径', requires: ['n_research'], due: TF.addDays(t, -12), status: 'active',
        checklist: [ck('信息架构', true), ck('首页与详情页', true), ck('交互动效', false), ck('可用性测试 3 人', false)] }),
      N({ id: 'n_mvp', laneId: 'ln_main', title: 'MVP 开发', desc: '最小闭环：创建 / 完成 / 本地持久化', requires: ['n_proto'], due: TF.addDays(t, 12), status: 'active',
        checklist: [ck('数据层与本地存储', true), ck('任务增删改查', true), ck('进程路线图', false), ck('打包与自测', false)] }),
      N({ id: 'n_beta', laneId: 'ln_main', title: '内测上线', desc: '邀请 20 位种子用户试用并收集反馈', requires: ['n_mvp'], due: TF.addDays(t, 26),
        checklist: [ck('内测邀请页', false), ck('反馈收集表', false), ck('首轮问题修复', false)] }),
      N({ id: 'n_launch', laneId: 'ln_main', title: '正式发布', desc: '对外公开，发布说明与演示视频', requires: ['n_beta'], due: TF.addDays(t, 45),
        checklist: [ck('发布说明', false), ck('演示视频', false), ck('上线检查清单', false)] }),

      N({ laneId: 'ln_grow', title: '落地页', desc: '一句话说清价值，含等待名单', due: TF.addDays(t, -18), status: 'done',
        checklist: [ck('文案', true), ck('页面开发', true), ck('埋点', true)] }),
      N({ laneId: 'ln_grow', title: '内容账号启动', desc: '每周 2 篇，聚焦真实使用场景', requires: ['n_proto'], due: TF.addDays(t, 8), status: 'active',
        checklist: [ck('账号定位', true), ck('首批 5 篇选题', false), ck('发布节奏表', false)] }),
      N({ laneId: 'ln_grow', title: '首批种子用户', desc: '目标 50 人，建立反馈群', requires: ['n_beta'], due: TF.addDays(t, 30),
        checklist: [ck('邀请话术', false), ck('反馈群运营', false)] }),

      N({ laneId: 'ln_tech', title: '技术选型', desc: '本地优先、零后端依赖', due: TF.addDays(t, -34), status: 'done',
        checklist: [ck('方案对比', true), ck('验证 PoC', true)] }),
      N({ laneId: 'ln_tech', title: '本地数据层', desc: '单文件存储 + 导入导出', requires: ['n_tech'], due: TF.addDays(t, -6), status: 'done',
        checklist: [ck('读写封装', true), ck('迁移策略', true)] }),
      N({ laneId: 'ln_tech', title: '自动备份', desc: '每日快照，随时回滚', requires: ['n_tech'], due: TF.addDays(t, 18),
        checklist: [ck('快照机制', false), ck('恢复入口', false)] })
    ];
    // 修正技术支线的依赖引用（用标题定位）
    const techSel = process1.nodes.find(n => n.title === '技术选型');
    process1.nodes.forEach(n => { if (n.laneId === 'ln_tech' && n.title !== '技术选型') n.requires = [techSel.id]; });
    process1.nodes.find(n => n.title === '本地数据层').requires = [techSel.id];

    const process2 = {
      id: 'p_life', name: '2026 生活支线', icon: '🌱', color: '#2bd4a3',
      desc: '身体、关系和输入，是长期产出的地基。',
      createdAt: new Date().toISOString(),
      lanes: [{ id: 'ln_health', name: '身体', color: '#2bd4a3' }, { id: 'ln_mind', name: '输入', color: '#f5a623' }],
      nodes: [
        { id: TF.uid('n'), laneId: 'ln_health', title: '稳定作息 23:30', desc: '连续 30 天', x: 0, y: 0, requires: [], status: 'active', checklist: [ck('连续 7 天', true), ck('连续 21 天', false)], due: TF.addDays(t, 20) },
        { id: TF.uid('n'), laneId: 'ln_health', title: '每周 3 次运动', desc: '跑步或力量', x: 0, y: 0, requires: [], status: 'auto', checklist: [ck('办健身卡', true), ck('连续 4 周打卡', false)], due: null },
        { id: TF.uid('n'), laneId: 'ln_mind', title: '读完 12 本书', desc: '每月一本，写短评', x: 0, y: 0, requires: [], status: 'auto', checklist: [ck('已读 3 本', true), ck('已读 6 本', false), ck('已读 12 本', false)], due: null }
      ]
    };

    const habits = [
      { id: TF.uid('h'), name: '早起 7:00', icon: '☀️', color: '#f5a623', records: {}, createdAt: t },
      { id: TF.uid('h'), name: '阅读 30 分钟', icon: '📖', color: '#5b8cff', records: {}, createdAt: t },
      { id: TF.uid('h'), name: '运动', icon: '🏃', color: '#2bd4a3', records: {}, createdAt: t },
      { id: TF.uid('h'), name: '不熬夜', icon: '🌙', color: '#a06bff', records: {}, createdAt: t }
    ];
    // 造一点历史打卡
    habits.forEach((h, hi) => {
      for (let i = 1; i < 12; i++) if ((i + hi) % 3 !== 0) h.records[TF.addDays(t, -i)] = 1;
      if (hi < 2) h.records[t] = 1;
    });

    /* 愿望示例：3 条，其中 1 条已实现（PRD P0-06 验收要求） */
    const W = (o) => Object.assign({
      id: TF.uid('w'), title: '', desc: '', category: '', status: 'idea', priority: 0,
      targetDate: null, color: DEFAULT_ACCENT_HEX, createdAt: new Date().toISOString(),
      doneAt: null, order: 0
    }, o);
    const wishes = [
      W({
        title: '看一次极光', desc: '在冰岛或挪威的冬夜，等一次绿色的天。', category: '旅行',
        status: 'doing', priority: 2, targetDate: (new Date().getFullYear() + 1) + '-02-01'
      }),
      W({ title: '学陶艺', desc: '拉一个能真的拿来喝水的杯子。', category: '体验', status: 'idea', priority: 1 }),
      W({
        title: '换一把舒服的椅子', desc: '久坐不塌腰，能撑住整个下午。', category: '物品',
        status: 'done', priority: 0, doneAt: new Date(Date.now() - 30 * 864e5).toISOString()
      })
    ];

    const db = {
      version: 1,
      settings: cloneSettings(),
      lists: [L.inbox, L.work, L.life, L.study],
      tasks,
      wishes,
      habits,
      processes: [process1, process2],
      pomoLog: [],
      created: new Date().toISOString()
    };
    db.processes.forEach(TF.layoutProcess);
    return db;
  }
  /* 全新配置：空数据，只有默认清单 */
  function blank() {
    return {
      version: 1,
      settings: cloneSettings(),
      lists: [
        { id: 'l_inbox', name: '收集箱', color: '#7d8ba1', icon: 'inbox', order: -1, inbox: true, archived: false },
        { id: 'l_work', name: '工作', color: '#5b8cff', icon: 'briefcase', order: 0, archived: false },
        { id: 'l_life', name: '个人', color: '#2bd4a3', icon: 'home', order: 1, archived: false }
      ],
      tasks: [], wishes: [], habits: [], processes: [], pomoLog: [],
      created: new Date().toISOString()
    };
  }

  /* ---------- Store ---------- */
  const PKEY = 'tickflow.profiles.v1';
  const LEGACY = 'tickflow.db.v1';
  const dbKey = id => 'tickflow.db.' + id;

  const Store = {
    data: null,
    meta: null,
    _dirty: false,
    _timer: null,

    /* 启动：读取/建立本地配置，再挂载当前配置的数据 */
    load() {
      let meta = null;
      try { meta = JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch (e) { meta = null; }
      if (!meta || !Array.isArray(meta.list) || !meta.list.length) {
        let legacy = null;
        try { legacy = JSON.parse(localStorage.getItem(LEGACY) || 'null'); } catch (e) { legacy = null; }
        const id = 'p_' + Date.now().toString(36);
        meta = {
          active: id,
          list: [{
            id, name: '我的配置', emoji: '🦊', color: '#5b8cff',
            createdAt: Date.now(), lastPlayed: Date.now(), tasks: 0, done: 0
          }]
        };
        if (legacy && legacy.tasks) {
          try { localStorage.setItem(dbKey(id), JSON.stringify(legacy)); } catch (e) { }
        }
        try { localStorage.setItem(PKEY, JSON.stringify(meta)); } catch (e) { }
      }
      this.meta = meta;
      const raw = this.raw(meta.active);
      this.data = raw && raw.tasks && raw.processes ? this.migrate(raw) : (meta.list.length === 1 && !raw ? seed() : blank());
      if (!raw) { this._dirty = true; this.flush(); } else { this._dirty = false; }
      setTimeout(() => this.snapshot(true), 1600);
    },

    raw(id) {
      try { return JSON.parse(localStorage.getItem(dbKey(id)) || 'null'); } catch (e) { return null; }
    },

    /* ---------- 本地配置（类似账户） ---------- */
    profiles() { return this.meta.list; },
    activeId() { return this.meta.active; },
    activeProfile() { return this.meta.list.find(p => p.id === this.meta.active) || this.meta.list[0]; },

    _saveMeta() {
      try { localStorage.setItem(PKEY, JSON.stringify(this.meta)); } catch (e) { }
    },

    switchProfile(id) {
      if (!id || id === this.meta.active) return false;
      const p = this.meta.list.find(x => x.id === id);
      if (!p) return false;
      this.flush();
      this.meta.active = id;
      p.lastPlayed = Date.now();
      this._saveMeta();
      const raw = this.raw(id);
      this.data = raw && raw.tasks && raw.processes ? this.migrate(raw) : blank();
      this._dirty = !raw;
      this.flush();
      return true;
    },

    createProfile(name, emoji, color, withDemo) {
      const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const p = {
        id, name: name || '新配置', emoji: emoji || '🗂️', color: color || '#5b8cff',
        createdAt: Date.now(), lastPlayed: Date.now(), tasks: 0, done: 0
      };
      this.meta.list.push(p);
      this._saveMeta();
      const d = withDemo ? seed() : blank();
      try { localStorage.setItem(dbKey(id), JSON.stringify(d)); } catch (e) { }
      this.switchProfile(id);
      return p;
    },

    updateProfile(id, patch) {
      const p = this.meta.list.find(x => x.id === id);
      if (!p) return;
      Object.assign(p, patch);
      this._saveMeta();
    },

    deleteProfile(id) {
      if (this.meta.list.length <= 1) return false;
      const i = this.meta.list.findIndex(x => x.id === id);
      if (i < 0) return false;
      this.meta.list.splice(i, 1);
      try { localStorage.removeItem(dbKey(id)); } catch (e) { }
      if (this.meta.active === id) {
        this.meta.active = this.meta.list[0].id;
        this.meta.list[0].lastPlayed = Date.now();
        const raw = this.raw(this.meta.active);
        this.data = raw && raw.tasks ? this.migrate(raw) : blank();
        this._dirty = true;
      }
      this._saveMeta();
      this.flush();
      return true;
    },
    migrate(d) {
      const hadAppearance = !!(d.settings && d.settings.appearance);
      d.settings = Object.assign(cloneSettings(), d.settings || {});
      const s = d.settings;
      s.pomo = Object.assign({ work: 25, short: 5, long: 15, rounds: 4 }, s.pomo || {});

      /* M1 主题归一：dark→graphite、light→mist、paper 保留、六值直通、其它→graphite */
      if (THEME_ALIAS[s.theme]) s.theme = THEME_ALIAS[s.theme];
      else if (THEME_IDS.indexOf(s.theme) < 0) s.theme = 'graphite';

      /* M2 强调色归一：六枚举直通；hex → 色相最近；缺失/非法 → blue */
      if (ACCENT_IDS.indexOf(s.accent) < 0) s.accent = IS_HEX.test(String(s.accent || '')) ? accentFromHex(s.accent) : 'blue';

      /* M3 灵动岛开关补全（enabled/autoExpand 强制布尔） */
      s.island = Object.assign({ enabled: true, autoExpand: true }, s.island || {});
      s.island.enabled = !!s.island.enabled;
      s.island.autoExpand = !!s.island.autoExpand;

      /* M4 密度只允许 normal / compact */
      s.density = s.density === 'compact' ? 'compact' : 'normal';

      /* M4.5 v1.12 → v1.13 外观迁移（04 §6 / PRD §8.1）：
         只有「老数据里没有 appearance」时才按旧 theme/accent 推导；
         旧字段 theme/accent 保留一年，方便回滚。 */
      if (!hadAppearance) {
        const map = THEME_TO_SCHEME[s.theme] || ['kun-default', 'dark'];
        s.appearance = normAppearance({
          mode: map[1],
          scheme: map[0],
          /* 旧 accent 若被用户显式改过（不是默认 blue），保留为覆盖色，避免升级后变味 */
          accentOverride: s.accent && s.accent !== 'blue' ? (ACCENT_HEX[s.accent] || null) : null
        });
      } else {
        s.appearance = normAppearance(s.appearance);
      }
      s.m3 = normM3(s.m3);

      /* M5 愿望集合补全：缺失/非数组 → []，逐条补字段 + 修正枚举 */
      d.wishes = Array.isArray(d.wishes) ? d.wishes : [];
      d.wishes = d.wishes.filter(w => w && typeof w === 'object' && String(w.title || '').trim());
      d.wishes.forEach(w => {
        w.id = w.id || TF.uid('w');
        w.desc = w.desc || '';
        w.category = w.category || '';
        w.status = WISH_STATUS.indexOf(w.status) >= 0 ? w.status : 'idea';
        w.priority = Math.max(0, Math.min(3, Number(w.priority) || 0));
        w.targetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(w.targetDate || '')) ? w.targetDate : null;
        w.color = w.color || DEFAULT_ACCENT_HEX;
        w.createdAt = w.createdAt || new Date().toISOString();
        // 已实现但缺 doneAt 时用 createdAt 兜底，避免「已实现 + doneAt:null」的脏数据
        w.doneAt = w.status === 'done' ? (w.doneAt || w.createdAt) : null;
        w.order = typeof w.order === 'number' ? w.order : 0;
      });

      /* M6 任务保持原样：只补挡板字段，不改语义 */
      d.tasks = Array.isArray(d.tasks) ? d.tasks : [];
      d.lists = d.lists || [];
      if (!d.lists.some(l => l.inbox)) {
        d.lists.unshift({ id: 'l_inbox', name: '收集箱', color: '#7d8ba1', icon: 'inbox', order: -1, inbox: true, archived: false });
      }
      d.tasks.forEach(t => {
        if (!Array.isArray(t.blockedBy)) t.blockedBy = [];
        if (typeof t.order !== 'number') t.order = 0;
        if (t.repeat && typeof t.repeat === 'string') t.repeat = TF.repNorm(t.repeat);
      });
      d.habits = d.habits || [];
      d.pomoLog = d.pomoLog || [];
      d.processes = (d.processes || []).map(p => {
        p.lanes = p.lanes || [{ id: TF.uid('ln'), name: '主线', color: '#5b8cff' }];
        p.lanes.forEach(l => { if (typeof l.h !== 'number') l.h = TF.RM_ROW; });
        p.nodes = (p.nodes || []).map(n => Object.assign({ requires: [], checklist: [], status: 'auto', x: 0, y: 0 }, n));
        p.nodes.forEach(n => { if (!p.lanes.some(l => l.id === n.laneId)) n.laneId = p.lanes[0].id; });
        if (p.nodes.length && p.nodes.every(n => !n.x && !n.y)) TF.layoutProcess(p);
        return p;
      });
      return d;
    },
    /* ---------- 每日快照（本地保险） ---------- */
    snapKey(id) { return 'tickflow.snaps.' + id; },
    snaps() {
      try { return JSON.parse(localStorage.getItem(this.snapKey(this.meta.active)) || '[]'); } catch (e) { return []; }
    },
    snapshot(auto) {
      if (!this.data) return;
      try {
        const key = this.snapKey(this.meta.active);
        let arr = this.snaps();
        const d = TF.today();
        if (!auto || !arr.length || arr[0].d !== d) {
          arr.unshift({ d, ts: Date.now(), data: JSON.parse(JSON.stringify(this.data)) });
          arr = arr.slice(0, 3);
          localStorage.setItem(key, JSON.stringify(arr));
        }
      } catch (e) { }
    },
    restoreSnapshot(ts) {
      const arr = this.snaps();
      const s0 = arr.find(x => x.ts === ts);
      if (!s0) return false;
      this.snapshot(false);
      this.data = this.migrate(JSON.parse(JSON.stringify(s0.data)));
      delete this.data.profile;
      this.save(true);
      return true;
    },

    /* 写入合并：连续编辑只在空闲 280ms 后落盘一次 */
    save(now) {
      this._dirty = true;
      if (now) return this.flush();
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.flush(), 280);
    },
    flush() {
      if (!this._dirty || !this.data) return;
      clearTimeout(this._timer);
      this._dirty = false;
      try {
        localStorage.setItem(dbKey(this.meta.active), JSON.stringify(this.data));
        const p = this.activeProfile();
        if (p) {
          p.tasks = this.data.tasks.length;
          p.done = this.data.tasks.filter(t => t.done).length;
          p.lastPlayed = Date.now();
          this._saveMeta();
        }
      } catch (e) {
        if (TF.toast) TF.toast('本地存储写入失败：' + e.message);
      }
    },

    /* --- 查询 --- */
    list(id) { return this.data.lists.find(l => l.id === id); },
    inbox() { return this.data.lists.find(l => l.inbox) || this.data.lists[0]; },
    task(id) { return this.data.tasks.find(t => t.id === id); },
    process(id) { return this.data.processes.find(p => p.id === id); },
    node(id) { for (const p of this.data.processes) { const n = p.nodes.find(n => n.id === id); if (n) return n; } return null; },
    nodeProcess(id) { return this.data.processes.find(p => p.nodes.some(n => n.id === id)); },
    activeTasks() { return this.data.tasks.filter(t => !t.done); },
    listTasks(listId) { return this.data.tasks.filter(t => t.listId === listId); },

    /* --- 任务 --- */
    addTask(patch) {
      const t = Object.assign({
        id: TF.uid('t'), listId: (this.inbox() || {}).id, title: '', notes: '', done: false, doneAt: null,
        createdAt: new Date().toISOString(), due: null, dueTime: null, priority: 0, tags: [],
        subtasks: [], repeat: null, nodeId: null, pomo: 0, order: 0, blockedBy: []
      }, patch);
      this.data.tasks.unshift(t);
      this.save(); return t;
    },
    updateTask(id, patch) {
      const t = this.task(id); if (!t) return;
      Object.assign(t, patch); this.save();
    },
    toggleTask(id) {
      const t = this.task(id); if (!t) return null;
      t.done = !t.done;
      t.doneAt = t.done ? new Date().toISOString() : null;
      let created = null;
      if (t.done) {
        this.syncNodeFromTask(t);
        if (t.repeat) created = this.spawnRepeat(t);
      }
      this.save();
      return { task: t, next: created };
    },
    spawnRepeat(t) {
      const o = TF.repNorm(t.repeat);
      if (!o) return null;
      const base = o.mode === 'after' ? TF.today() : (t.due || TF.today());
      const nt = Object.assign({}, t, {
        id: TF.uid('t'), done: false, doneAt: null, createdAt: new Date().toISOString(),
        due: TF.repNext(o, base), pomo: 0, blockedBy: [],
        subtasks: (t.subtasks || []).map(s => ({ id: TF.uid('s'), title: s.title, done: false }))
      });
      this.data.tasks.unshift(nt);
      return nt;
    },
    removeTask(id) { this.data.tasks = this.data.tasks.filter(t => t.id !== id); this.save(); },

    /* --- 愿望（v1.12 独立集合：进 JSON 导出/导入、快照、重置） --- */
    wishes() { return (this.data && Array.isArray(this.data.wishes)) ? this.data.wishes : []; },
    wish(id) { return this.wishes().find(w => w.id === id) || null; },
    /* 统计恒指全集（不受筛选影响）；rate 为整数百分比 */
    wishStats() {
      const list = this.wishes();
      if (typeof TF.wishStats === 'function') return TF.wishStats(list);
      const total = list.length;
      const done = list.filter(w => w && w.status === 'done').length;
      return {
        total: total,
        idea: list.filter(w => w && w.status !== 'doing' && w.status !== 'done').length,
        doing: list.filter(w => w && w.status === 'doing').length,
        done: done,
        undone: total - done,
        rate: total ? Math.round((done / total) * 100) : 0
      };
    },
    addWish(patch) {
      const w = Object.assign({
        id: TF.uid('w'), title: '', desc: '', category: '', status: 'idea', priority: 0,
        targetDate: null, color: DEFAULT_ACCENT_HEX, createdAt: new Date().toISOString(),
        doneAt: null, order: 0
      }, patch);
      w.title = String(w.title || '');
      w.desc = String(w.desc || '');
      w.category = String(w.category || '');
      w.status = WISH_STATUS.indexOf(w.status) >= 0 ? w.status : 'idea';
      w.priority = Math.max(0, Math.min(3, Number(w.priority) || 0));
      w.doneAt = w.status === 'done' ? (w.doneAt || new Date().toISOString()) : null;
      if (!Array.isArray(this.data.wishes)) this.data.wishes = [];
      this.data.wishes.unshift(w);
      this.save();
      return w;
    },
    updateWish(id, patch) {
      const w = this.wish(id);
      if (!w) return null;
      Object.assign(w, patch);
      w.priority = Math.max(0, Math.min(3, Number(w.priority) || 0));
      this.save();
      return w;
    },
    /* 状态切换时同步维护 doneAt：置 done 写实现时间，取消实现清空 */
    setWishStatus(id, status) {
      const w = this.wish(id);
      if (!w) return null;
      const next = WISH_STATUS.indexOf(status) >= 0 ? status : 'idea';
      const was = w.status;
      w.status = next;
      if (next === 'done') {
        if (was !== 'done' || !w.doneAt) w.doneAt = new Date().toISOString();
      } else {
        w.doneAt = null;
      }
      this.save();
      return w;
    },
    removeWish(id) {
      const arr = this.wishes();
      const i = arr.findIndex(w => w.id === id);
      if (i < 0) return false;
      arr.splice(i, 1);
      this.save();
      return true;
    },

    /* 任务依赖：blockedBy 里有未完成的，就算被卡住 */
    blockers(t) {
      return (t.blockedBy || [])
        .map(id => this.task(id))
        .filter(x => x && !x.done);
    },
    isBlocked(t) { return this.blockers(t).length > 0; },

    /* 任务完成 → 反推进程节点检查项 */
    syncNodeFromTask(task) {
      if (!task.nodeId) return;
      const n = this.node(task.nodeId); if (!n) return;
      const c = (n.checklist || []).find(c => c.taskId === task.id);
      if (c) c.done = !!task.done;
    },

    /* --- 清单 --- */
    addList(name, color) {
      const l = { id: TF.uid('l'), name: name || '新清单', color: color || TF.colors[this.data.lists.length % TF.colors.length], icon: 'folder', order: this.data.lists.length, archived: false };
      this.data.lists.push(l); this.save(); return l;
    },
    removeList(id) {
      this.data.tasks = this.data.tasks.filter(t => t.listId !== id);
      this.data.lists = this.data.lists.filter(l => l.id !== id);
      this.save();
    },

    /* --- 进程 --- */
    addProcess(name, desc, icon, color) {
      const p = {
        id: TF.uid('p'), name: name || '新进程', desc: desc || '', icon: icon || '🎯', color: color || '#5b8cff',
        createdAt: new Date().toISOString(),
        lanes: [
          { id: TF.uid('ln'), name: '主线', color: color || '#5b8cff' },
          { id: TF.uid('ln'), name: '支线', color: '#2bd4a3' }
        ],
        nodes: []
      };
      this.data.processes.push(p); this.save(); return p;
    },
    addNode(processId, laneId, title) {
      const p = this.process(processId); if (!p) return null;
      const lane = p.lanes.find(l => l.id === laneId) || p.lanes[0];
      const sib = p.nodes.filter(n => n.laneId === lane.id);
      const n = {
        id: TF.uid('n'), processId, laneId: lane.id, title: title || '新节点', desc: '',
        x: 40 + sib.length * 262, y: 0, requires: [], checklist: [], status: 'auto', due: null,
        createdAt: new Date().toISOString()
      };
      p.nodes.push(n); this.save(); return n;
    },
    removeNode(id) {
      this.data.processes.forEach(p => {
        p.nodes = p.nodes.filter(n => n.id !== id);
        p.nodes.forEach(n => { n.requires = (n.requires || []).filter(r => r !== id); });
      });
      this.data.tasks.forEach(t => { if (t.nodeId === id) t.nodeId = null; });
      this.save();
    },
    /* 节点状态求解：done > 手动 active > 依赖满足 available > locked */
    nodeState(n, p) {
      if (n.status === 'done') return 'done';
      const reqs = (n.requires || []).map(id => p.nodes.find(x => x.id === id)).filter(Boolean);
      const ready = reqs.every(r => r.status === 'done');
      if (n.status === 'active') return 'active';
      return ready ? 'available' : 'locked';
    },
    nodeProgress(n) {
      const ck = n.checklist || [];
      if (n.status === 'done') return 1;
      if (!ck.length) return 0;
      return ck.filter(c => c.done).length / ck.length;
    },
    processStats(p) {
      const total = p.nodes.length;
      const done = p.nodes.filter(n => n.status === 'done').length;
      const avail = p.nodes.filter(n => this.nodeState(n, p) === 'available').length;
      const active = p.nodes.filter(n => this.nodeState(n, p) === 'active').length;
      const locked = p.nodes.filter(n => this.nodeState(n, p) === 'locked').length;
      const laneStats = p.lanes.map(l => {
        const ns = p.nodes.filter(n => n.laneId === l.id);
        const d = ns.filter(n => n.status === 'done').length;
        return { lane: l, total: ns.length, done: d, pct: ns.length ? d / ns.length : 0 };
      });
      // 综合进度：已完成节点 + 进行中节点的检查项进度
      let sum = 0;
      p.nodes.forEach(n => {
        if (n.status === 'done') sum += 1;
        else if (n.checklist && n.checklist.length) sum += this.nodeProgress(n) * 0.9;
      });
      return { total, done, avail, active, locked, pct: total ? sum / total : 0, laneStats };
    },

    /* --- 习惯 --- */
    addHabit(name, icon, color) {
      const h = { id: TF.uid('h'), name, icon: icon || '✅', color: color || '#5b8cff', records: {}, createdAt: TF.today() };
      this.data.habits.push(h); this.save(); return h;
    },
    toggleHabit(id, date) {
      const h = this.data.habits.find(x => x.id === id); if (!h) return;
      if (h.records[date]) delete h.records[date]; else h.records[date] = 1;
      this.save();
    },
    habitStreak(h) {
      let n = 0, d = TF.today();
      if (!h.records[d]) d = TF.addDays(d, -1);
      while (h.records[d]) { n++; d = TF.addDays(d, -1); }
      return n;
    },

    /* --- 番茄 --- */
    logPomo(minutes, taskId) {
      this.data.pomoLog.push({ ts: Date.now(), minutes, taskId: taskId || null });
      if (taskId) { const t = this.task(taskId); if (t) t.pomo = (t.pomo || 0) + 1; }
      this.save();
    },
    pomoToday() {
      const t = TF.today();
      return this.data.pomoLog.filter(p => TF.ymd(new Date(p.ts)) === t);
    },

    /* --- 备份 --- */
    exportMarkdown() {
      const d = this.data;
      const lines = ['# ' + (this.activeProfile() ? this.activeProfile().name : 'TickFlow') + ' · ' + TF.today(), ''];
      d.lists.forEach(l => {
        const arr = d.tasks.filter(t => t.listId === l.id);
        if (!arr.length) return;
        lines.push('## ' + l.name, '');
        arr.sort((a, b) => (a.done - b.done) || (a.due || '9999').localeCompare(b.due || '9999'));
        arr.forEach(t => {
          const meta = [t.due ? TF.cnDate(t.due) + (t.dueTime ? ' ' + t.dueTime : '') : '', (t.tags || []).map(g => '#' + g).join(' ')].filter(Boolean).join(' · ');
          lines.push('- [' + (t.done ? 'x' : ' ') + '] ' + t.title + (meta ? '  `' + meta + '`' : ''));
          if (t.notes) lines.push('  > ' + t.notes.replace(/\n/g, ' '));
          (t.subtasks || []).forEach(sb => lines.push('  - [' + (sb.done ? 'x' : ' ') + '] ' + sb.title));
        });
        lines.push('');
      });

      /* 愿望小节：状态中文 + 期望日期（已实现取实现日期）；CSV 保持表头兼容，不动 */
      const wishes = this.wishes();
      if (wishes.length) {
        const stName = { idea: '想做', doing: '进行中', done: '已实现' };
        lines.push('## 愿望', '');
        wishes.forEach(w => {
          const parts = [stName[w.status] || '想做'];
          if (w.status === 'done') {
            if (w.doneAt) parts.push(String(w.doneAt).slice(0, 10));
          } else if (w.targetDate) {
            parts.push('期望 ' + w.targetDate);
          }
          if (w.category) parts.push(w.category);
          lines.push('- [' + (w.status === 'done' ? 'x' : ' ') + '] ' + w.title + '  `' + parts.join(' · ') + '`');
        });
        lines.push('');
      }

      const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tickflow-' + TF.today() + '.md';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    },

    exportCSV() {
      const rows = [['标题', '清单', '完成', '日期', '开始', '结束', '优先级', '标签', '备注']];
      this.data.tasks.forEach(t => {
        const l = this.list(t.listId);
        rows.push([t.title, l ? l.name : '', t.done ? '1' : '0', t.due || '', t.dueTime || '', t.dueEnd || '',
          t.priority, (t.tags || []).join(' '), (t.notes || '').replace(/\n/g, ' ')]);
      });
      const csv = rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tickflow-' + TF.today() + '.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    },

    /* 导入 CSV：自动识别标题/日期/优先级等列 */
    importCSV(text) {
      const rows = [];
      let cur = '', row = [], q = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
          if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
          else if (c === '"') q = false;
          else cur += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else if (c !== '\r') cur += c;
      }
      if (cur || row.length) { row.push(cur); rows.push(row); }
      if (!rows.length) return 0;
      const head = rows[0].map(h => h.trim());
      const find = keys => head.findIndex(h => keys.some(k => h.includes(k)));
      const iTitle = find(['标题', '任务', 'title', '内容']);
      const iDate = find(['日期', '到期', 'due', 'date']);
      const iPri = find(['优先级', 'priority']);
      const iList = find(['清单', '列表', 'list']);
      const iTag = find(['标签', 'tag']);
      if (iTitle < 0) return 0;
      let n = 0;
      for (let r = 1; r < rows.length; r++) {
        const cells = rows[r];
        const title = (cells[iTitle] || '').trim();
        if (!title) continue;
        let listId = (this.inbox() || {}).id;
        if (iList >= 0 && cells[iList]) {
          const nm = cells[iList].trim();
          let l = this.data.lists.find(x => x.name === nm);
          if (!l) l = this.addList(nm, TF.colors[this.data.lists.length % TF.colors.length]);
          listId = l.id;
        }
        let due = null;
        if (iDate >= 0 && cells[iDate]) {
          const m = cells[iDate].match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
          if (m) due = m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
        }
        const pri = iPri >= 0 ? Math.max(0, Math.min(3, parseInt(cells[iPri], 10) || 0)) : 0;
        const tags = iTag >= 0 && cells[iTag] ? cells[iTag].split(/[\s,]+/).filter(Boolean) : [];
        this.addTask({ title, listId, due, priority: pri, tags, order: n });
        n++;
      }
      return n;
    },

    exportJSON() {
      const p = this.activeProfile();
      const bundle = { app: 'TickFlow', profile: p ? p.name : '', exportedAt: new Date().toISOString(), data: this.data };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tickflow-' + (p ? p.name.replace(/[\\/:*?"<>|]/g, '') + '-' : '') + TF.today() + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    },
    importJSON(text) {
      const o = JSON.parse(text);
      const d = o && o.data ? o.data : o;
      if (!d || !Array.isArray(d.tasks)) throw new Error('文件格式不正确');
      this.data = this.migrate(d); this.save(true);
    },
    reset() { this.data = seed(); this.save(true); }
  };

  TF.Store = Store;
})();
