/* ===== 纯函数层：快速添加解析 / 当前任务判定 / 愿望统计 =====
   铁律：本文件不碰 document、不读 Store、不读时钟（today / now 一律由调用方注入），
        以便 tests/harness.mjs 的假 window 直接跑单测。
*/
(function () {
  const TF = (window.TF = window.TF || {});

  const pad2 = n => String(n).padStart(2, '0');
  const WD = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
  const WD_NAME = ['日', '一', '二', '三', '四', '五', '六'];
  const PRI_WORD = { '1': 1, '2': 2, '3': 3, '高': 3, '中': 2, '低': 1 };
  const WISH_STATUS = ['idea', 'doing', 'done'];

  /* ---------- 日期工具（只做算术，不读当前时间） ---------- */
  function isYmd(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s == null ? '' : s)); }
  function ymd(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }
  function toDate(s) { const p = String(s || '').split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
  function addDays(s, n) { const d = toDate(s); d.setDate(d.getDate() + n); return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function dayOf(s) { return toDate(s).getDay(); }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
  function diffDays(a, b) { return Math.round((toDate(a) - toDate(b)) / 86400000); }

  /* 'HH:MM' → 分钟数；非法（含 25:00）返回 -1，调用方据此放弃解析 */
  function toMin(t) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(t == null ? '' : t));
    if (!m) return -1;
    const h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return -1;
    return h * 60 + mi;
  }

  /* ---------- 愿望统计（纯） ---------- */
  /* rate 为整数百分比：total 为 0 时按 0 处理 */
  TF.wishStats = function (wishes) {
    const list = Array.isArray(wishes) ? wishes : [];
    let idea = 0, doing = 0, done = 0;
    list.forEach(w => {
      const s = w && w.status;
      if (s === 'done') done++;
      else if (s === 'doing') doing++;
      else idea++;
    });
    const total = list.length;
    return { total, idea, doing, done, undone: total - done, rate: total ? Math.round((done / total) * 100) : 0 };
  };

  /* ---------- 快速添加：L1 前缀词表（只从字符串开头匹配，命中即从标题里摘掉） ---------- */
  /* 每个规则 run(m, st) 返回 {due?, time?}；返回 null 表示「正则命中了但不合法」，
     此时该片段不解析、原样留在标题里（如 25:00、下午13点）。 */
  const PREFIX_RULES = [
    { // 下月 D 日：超出当月天数取该月最后一天
      re: /^下月(\d{1,2})\s*[日号]/,
      run: (m, st) => {
        const p = st.today.split('-').map(Number);
        const y = p[1] === 12 ? p[0] + 1 : p[0];
        const mo = p[1] === 12 ? 1 : p[1] + 1;
        const day = +m[1];
        if (day < 1) return null;
        return { due: ymd(y, mo, Math.min(day, daysInMonth(y, mo))) };
      }
    },
    { // YYYY-MM-DD
      re: /^(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/,
      run: (m, st) => {
        const y = +m[1], mo = +m[2], d = +m[3];
        if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
        return { due: ymd(y, mo, d) };
      }
    },
    { // M 月 D 日：早于今天则归到次年
      re: /^(\d{1,2})月(\d{1,2})\s*[日号]/,
      run: (m, st) => {
        const mo = +m[1], d = +m[2];
        if (mo < 1 || mo > 12) return null;
        let y = +st.today.slice(0, 4);
        if (d < 1 || d > daysInMonth(y, mo)) return null;
        let out = ymd(y, mo, d);
        if (out < st.today) out = ymd(y + 1, mo, d);
        return { due: out };
      }
    },
    { // M-D / M/D 同上
      re: /^(\d{1,2})[-/](\d{1,2})(?!\d)/,
      run: (m, st) => {
        const mo = +m[1], d = +m[2];
        if (mo < 1 || mo > 12) return null;
        let y = +st.today.slice(0, 4);
        if (d < 1 || d > daysInMonth(y, mo)) return null;
        let out = ymd(y, mo, d);
        if (out < st.today) out = ymd(y + 1, mo, d);
        return { due: out };
      }
    },
    { // 今晚：日期今天 + 默认 20:00（后面若还写了时间会被覆盖）
      re: /^今晚(?!上|天)/,
      run: (m, st) => ({ due: st.today, time: '20:00' })
    },
    { re: /^大后天/, run: (m, st) => ({ due: addDays(st.today, 3) }) },
    { re: /^后天/, run: (m, st) => ({ due: addDays(st.today, 2) }) },
    { re: /^明天/, run: (m, st) => ({ due: addDays(st.today, 1) }) },
    { re: /^今天/, run: (m, st) => ({ due: st.today }) },
    { // 下周X：以「下周一」为基准 + (X 为周几)
      re: /^下周([一二三四五六日天])/,
      run: (m, st) => {
        const back = (dayOf(st.today) + 6) % 7;          // 距本周一的天数
        const nextMon = addDays(st.today, 7 - back);      // 下周一
        const target = WD[m[1]];
        const off = target === 0 ? 6 : target - 1;        // 周日排在本周第 7 天
        return { due: addDays(nextMon, off) };
      }
    },
    { // 周X / 星期X / 礼拜X：未来最近一次（含今天）
      re: /^(?:周|星期|礼拜)([一二三四五六日天])/,
      run: (m, st) => {
        const target = WD[m[1]];
        const off = (target - dayOf(st.today) + 7) % 7;
        return { due: addDays(st.today, off) };
      }
    },
    { // 上午/下午/晚上 H 点（可带 半 / N分）
      re: /^(上午|下午|晚上)\s*(\d{1,2})\s*[点时](半|\d{1,2}分)?/,
      run: (m, st) => {
        const period = m[1], h = +m[2];
        const mi = m[3] ? (m[3] === '半' ? 30 : +String(m[3]).replace('分', '')) : 0;
        if (h < 1 || h > 12 || mi > 59) return null;
        const out = {};
        if (period === '上午') {
          out.time = pad2(h === 12 ? 12 : h) + ':' + pad2(mi);
        } else if (period === '下午') {
          out.time = pad2(h === 12 ? 12 : h + 12) + ':' + pad2(mi);
        } else if (h === 12) {
          // 晚上 12 点 → 次日 00:00
          out.time = '00:' + pad2(mi);
          out.due = addDays(st.due || st.today, 1);
        } else {
          out.time = pad2(h + 12) + ':' + pad2(mi);
        }
        return out;
      }
    },
    { // 裸 H 点
      re: /^(\d{1,2})\s*[点时](半|\d{1,2}分)?/,
      run: (m, st) => {
        const h = +m[1];
        const mi = m[2] ? (m[2] === '半' ? 30 : +String(m[2]).replace('分', '')) : 0;
        if (h > 23 || h < 0 || mi > 59) return null;
        return { time: pad2(h) + ':' + pad2(mi) };
      }
    },
    { // HH:MM（25:00 之类不解析）
      re: /^(\d{1,2}):(\d{2})(?!\d)/,
      run: (m, st) => {
        const h = +m[1], mi = +m[2];
        if (h > 23 || mi > 59) return null;
        return { time: pad2(h) + ':' + pad2(mi) };
      }
    }
  ];

  /* 相对日期的人话标签：今天/明天/后天/大后天/周X，更远的直接用 YYYY-MM-DD */
  function humanDue(due, today) {
    if (!due) return '';
    if (isYmd(today)) {
      const d = diffDays(due, today);
      if (d === 0) return '今天';
      if (d === 1) return '明天';
      if (d === 2) return '后天';
      if (d === 3) return '大后天';
      if (d > 3 && d <= 13) return '周' + WD_NAME[dayOf(due)];
    }
    return due;
  }
  TF.humanDue = humanDue;

  /* L2 符号 token：#标签 / !优先级 / @清单（全局匹配，符号紧贴内容） */
  function takeSymbols(text, ctx) {
    let rest = text;

    // 优先级：多处出现以最后出现者为准
    let priority = 0;
    const priRe = /!([1-3]|高|中|低)/g;
    let mm;
    while ((mm = priRe.exec(rest))) priority = PRI_WORD[mm[1]] || 0;
    rest = rest.replace(/!([1-3]|高|中|低)/g, ' ');

    // 标签：可多个，去重保序
    const tags = [];
    rest = rest.replace(/#([^\s#!@]+)/g, (m, g) => {
      const clean = g.replace(/[，。、；;：:,.]+$/, '');
      if (clean && tags.indexOf(clean) < 0) tags.push(clean);
      return ' ';
    });

    // 清单：与当前清单名精确匹配；不匹配只记 listMiss，不自动创建
    let listId = null, listMiss = null;
    const lists = Array.isArray(ctx.lists) ? ctx.lists : [];
    rest = rest.replace(/@([^\s@#!]+)/g, (m, g) => {
      const name = g.replace(/[，。、；;：:,.]+$/, '');
      const hit = lists.find(l => l && l.name === name);
      if (hit) { listId = hit.id; listMiss = null; }
      else if (name) listMiss = name;
      return ' ';
    });

    return { rest, tags, priority, listId, listMiss };
  }

  /* 快速添加解析：返回 { title, tags, priority, due, dueTime, listId, listMiss, chips, error } */
  TF.parseTaskInput = function (text, ctx) {
    const c = Object.assign({ today: '', now: '', lists: [], defaultListId: '', viewDue: null }, ctx || {});
    const today = isYmd(c.today) ? c.today : (typeof TF.today === 'function' ? TF.today() : '');
    const raw = String(text == null ? '' : text);

    // L1：位置锚定，只吃开头的日期/时间 token
    let rest = raw.replace(/^\s+/, '');
    const st = { today: today, due: null, dueTime: null };
    if (today) {
      for (let guard = 0; guard < 12; guard++) {
        let hit = false;
        for (let i = 0; i < PREFIX_RULES.length; i++) {
          const rule = PREFIX_RULES[i];
          const m = rule.re.exec(rest);
          if (!m) continue;
          const out = rule.run(m, st);
          if (!out) continue;                       // 命中但不合法 → 留给标题
          rest = rest.slice(m[0].length).replace(/^\s+/, '');
          if (out.due) st.due = out.due;
          if (out.time) st.dueTime = out.time;
          hit = true;
          break;
        }
        if (!hit) break;
      }
    }

    // L2：符号 token
    const sym = takeSymbols(rest, c);

    // L3：剩下的就是标题
    const title = sym.rest.replace(/\s+/g, ' ').trim();

    // chip 顺序固定：日期 → 时间 → 优先级 → 标签 → 清单
    const chips = [];
    if (st.due) chips.push({ k: 'date', text: humanDue(st.due, today) });
    if (st.dueTime) chips.push({ k: 'time', text: st.dueTime });
    if (sym.priority) chips.push({ k: 'pri', text: (TF.priName ? TF.priName[sym.priority] : ['', '低', '中', '高'][sym.priority]) + '优先级' });
    sym.tags.forEach(g => chips.push({ k: 'tag', text: '#' + g }));
    if (sym.listId) {
      const l = (c.lists || []).find(x => x && x.id === sym.listId);
      chips.push({ k: 'list', text: '@' + (l ? l.name : ''), warn: false });
    } else if (sym.listMiss) {
      chips.push({ k: 'list', text: '@' + sym.listMiss + ' 不存在', warn: true });
    }

    return {
      title: title,
      tags: sym.tags,
      priority: sym.priority,
      due: st.due || null,
      dueTime: st.dueTime || null,
      listId: sym.listId || null,
      listMiss: sym.listMiss || null,
      chips: chips,
      error: title ? '' : 'no-title'
    };
  };

  /* 兼容包装：旧调用点只消费 { title, tags, priority }（due/dueTime/listId 由 T4 接线） */
  TF.parseQuick = function (text) {
    const S = TF.Store;
    const now = new Date();
    const r = TF.parseTaskInput(text, {
      today: typeof TF.today === 'function' ? TF.today() : '',
      now: pad2(now.getHours()) + ':' + pad2(now.getMinutes()),
      lists: (S && S.data && S.data.lists) || [],
      defaultListId: '',
      viewDue: null
    });
    return { title: r.title, tags: r.tags, priority: r.priority };
  };

  /* ---------- 灵动岛「当前任务」判定（纯） ---------- */
  function tsOf(iso) {
    const t = Date.parse(String(iso == null ? '' : iso));
    return isFinite(t) ? t : 0;
  }
  function byPriorityThenNew(a, b) {
    const pa = a.priority || 0, pb = b.priority || 0;
    if (pa !== pb) return pb - pa;
    return tsOf(b.createdAt) - tsOf(a.createdAt);
  }
  /* 今日待办展示序：有时刻的在前 → 时刻升序 → 优先级降序 → 创建新者在前 */
  function byTodayOrder(a, b) {
    const ka = a.dueTime ? 0 : 1, kb = b.dueTime ? 0 : 1;
    if (ka !== kb) return ka - kb;
    const ta = a.dueTime || '99:99', tb = b.dueTime || '99:99';
    if (ta !== tb) return ta < tb ? -1 : 1;
    return byPriorityThenNew(a, b);
  }

  /* 返回 { rule, taskId, todayCount, overdueCount, doneToday, todayIds, todayTasks, remainSec, overdueMin } */
  TF.pickCurrentTask = function (tasks, now) {
    const list = Array.isArray(tasks) ? tasks : [];
    // 用鸭子类型判 Date：单测里传入的是宿主 realm 的 Date，跨 realm 的 instanceof 会失败
    const at = (now && typeof now.getTime === 'function' && !isNaN(now.getTime())) ? now : new Date();
    const today = ymd(at.getFullYear(), at.getMonth() + 1, at.getDate());
    const curMin = at.getHours() * 60 + at.getMinutes();
    const curSec = curMin * 60 + at.getSeconds();

    const open = list.filter(t => t && !t.done);
    const todayOpen = open.filter(t => t.due === today);
    const overdue = open.filter(t => t.due && t.due < today);
    const doneToday = list.filter(t => t && t.done && t.due === today).length;
    const sortedToday = todayOpen.slice().sort(byTodayOrder);

    const base = {
      todayCount: todayOpen.length,
      overdueCount: overdue.length,
      doneToday: doneToday,
      todayIds: sortedToday.map(t => t.id),
      todayTasks: sortedToday.slice(0, 5),
      remainSec: 0,
      overdueMin: 0
    };

    // R1：正在进行的时段任务（有开始与结束时间，且 now 落在区间内）
    const c1 = todayOpen.filter(t => {
      const s = toMin(t.dueTime), e = toMin(t.dueEnd);
      return s >= 0 && e >= 0 && s <= curMin && curMin <= e;
    });
    if (c1.length) {
      let pick = c1[0];
      c1.forEach(t => { if (toMin(t.dueTime) >= toMin(pick.dueTime)) pick = t; });
      return Object.assign(base, { rule: 'R1', taskId: pick.id, remainSec: Math.max(0, toMin(pick.dueEnd) * 60 - curSec) });
    }

    // R2：只有到点时间且已到点
    const c2 = todayOpen.filter(t => {
      const s = toMin(t.dueTime);
      return s >= 0 && toMin(t.dueEnd) < 0 && s <= curMin;
    });
    if (c2.length) {
      let pick = c2[0];
      c2.forEach(t => { if (toMin(t.dueTime) >= toMin(pick.dueTime)) pick = t; });
      return Object.assign(base, { rule: 'R2', taskId: pick.id, overdueMin: Math.max(0, curMin - toMin(pick.dueTime)) });
    }

    // R3：今日未命中 R1/R2 的全部任务（已按 PRD Q3 放宽候选集），优先级 → 创建时间
    const c3 = todayOpen.filter(t => c1.indexOf(t) < 0 && c2.indexOf(t) < 0);
    if (c3.length) {
      const pick = c3.slice().sort(byPriorityThenNew)[0];
      return Object.assign(base, { rule: 'R3', taskId: pick.id });
    }

    // R4：逾期兜底
    if (overdue.length) {
      const pick = overdue.slice().sort(byPriorityThenNew)[0];
      return Object.assign(base, { rule: 'R4', taskId: pick.id });
    }

    // R5：空态
    return Object.assign(base, { rule: 'R5', taskId: null });
  };

  TF.WISH_STATUS = WISH_STATUS;
})();
