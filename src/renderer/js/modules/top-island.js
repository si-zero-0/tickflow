/* 顶部迷你岛渲染层（独立窗口，无 Store、无 require）。
   只做三件事：接收快照 → 画像素；接收提醒 → 展开；点击 → 发送动作。
   所有颜色由快照注入到 :root，保证与主窗同一套 schemes.json 值。 */
(function () {
  const bridge = window.islandBridge || null;
  const root = document.documentElement;
  const el = {
    isl: document.getElementById('island'),
    head: document.getElementById('head'),
    dot: document.getElementById('dot'),
    task: document.getElementById('task'),
    right: document.getElementById('right'),
    chev: document.getElementById('chev'),
    panel: document.getElementById('panel'),
    line: document.getElementById('line'),
    reminders: document.getElementById('reminders'),
    focusBtn: document.getElementById('focus-btn')
  };

  const COLLAPSED_H = 52;
  let snap = null;
  let expanded = false;
  let remind = null;
  let collapseTimer = 0;
  /* 同步延迟采样：点击动作 → 主窗执行 → 快照回到岛，用岛自己的时钟计时（T2.4 实测） */
  let actAt = 0;
  window.__syncStats = { samples: [], last: 0, p95: 0 };
  function recordSync(ms) {
    if (!(ms > 0)) return;
    const st = window.__syncStats;
    st.last = Math.round(ms * 10) / 10;
    st.samples.push(st.last);
    if (st.samples.length > 40) st.samples.shift();
    const arr = st.samples.slice().sort((a, b) => a - b);
    st.p95 = arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.95))] || 0;
  }

  function injectTheme(t) {
    if (!t) return;
    root.dataset.mode = t.mode === 'light' ? 'light' : 'dark';
    const map = {
      bg: '--bg', text: '--text',
      text2: '--text2', text3: '--text3', accent: '--accent', accentInk: '--accent-ink'
    };
    Object.keys(map).forEach(k => { if (t[k]) root.style.setProperty(map[k], t[k]); });
    /* 灵动岛固定纯黑底：面板与文字固定为深色档的高对比组合，强调色仍跟随方案 */
    root.style.setProperty('--panel', '#000000');
    root.style.setProperty('--text', '#E9EEF6');
    root.style.setProperty('--text2', '#A9B5C8');
    root.style.setProperty('--text3', '#7E8A9D');
    root.style.setProperty('--warn', '#F5B544');
    root.style.setProperty('--success', '#3DDC97');
  }

  function applyShape() {
    if (!snap) return;
    root.style.setProperty('--isl-radius', (snap.m3 && snap.m3.radius ? snap.m3.radius : 26) + 'px');
  }

  function fmt(sec) {
    const s = Math.max(0, Math.round(sec || 0));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function paint() {
    if (!snap) return;
    const c = snap.m3 && snap.m3.content ? snap.m3.content : {};
    const task = snap.task;
    const focus = snap.focus || {};
    const counts = snap.counts || {};

    let dot = 'muted';
    let title = '今日无进行中任务';
    let right = '';

    if (focus.rule === 'R1') { dot = 'warn'; title = task ? task.title : '正在专注'; right = focus.remainSec ? '剩 ' + Math.ceil(focus.remainSec / 60) + ' 分' : ''; }
    else if (focus.rule === 'R2') { dot = 'warn'; title = task ? task.title : ''; right = '已逾期'; }
    else if (task) { dot = 'accent'; title = task.title; right = '今日 ' + (counts.today || 0) + ' 项'; }
    else if ((counts.doneToday || 0) > 0) { dot = 'ok'; title = '今日全部完成'; right = '完成 ' + counts.doneToday + ' 项'; }
    else { right = '今日 ' + (counts.today || 0) + ' 项'; }

    el.dot.className = 'isl-dot ' + dot;
    el.task.textContent = c.task === false ? '刻度 TickFlow' : title;
    el.right.textContent = c.countdown !== false ? right : (c.count === false ? '' : '今日 ' + (counts.today || 0) + ' 项');
    el.right.classList.toggle('focus', focus.running === true);
    if (focus.running) el.right.textContent = fmt(focus.remain);

    el.line.innerHTML = [
      c.count === false ? '' : `<span>待办 <b>${counts.open || 0}</b></span>`,
      c.count === false ? '' : `<span>今天 <b>${counts.today || 0}</b></span>`,
      c.count === false ? '' : `<span>完成 <b>${counts.doneToday || 0}</b></span>`,
      snap.view && snap.view.label ? `<span>${escapeHTML(snap.view.label)}</span>` : ''
    ].filter(Boolean).join('');
    el.focusBtn.textContent = focus.running ? '暂停专注' : '开始专注';

    renderReminders();
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function renderReminders() {
    if (!snap) return;
    const c = snap.m3 && snap.m3.content ? snap.m3.content : {};
    const items = [];
    if (remind) items.push(remind);
    if (c.reminders !== false && snap.reminders) {
      snap.reminders.forEach(r => { if (!remind || r.id !== remind.id) items.push(r); });
    }
    el.reminders.innerHTML = items.slice(0, 3).map(r => `
      <div class="isl-rem" data-id="${escapeHTML(r.id)}">
        <span>${escapeHTML(r.title)}${r.dueTime ? ' · ' + escapeHTML(r.dueTime) : ''}</span>
        <button data-rem="done">完成</button>
        <button data-rem="close" aria-label="关闭">×</button>
      </div>`).join('');
    if (expanded) requestAnimationFrame(resize);
  }

  function resize() {
    if (!bridge || !bridge.resize) return;
    /* 岛元素始终占满窗口（height:100%），因此高度按内容块累加，
       不能用 isl.scrollHeight（窗口变高后会跟着窗口长，导致逐个 +2 的漂移）。
       内容在动画期间不重排：窗口只改高度，面板布局以顶部为锚点。 */
    const head = el.head.offsetHeight || 52;
    const panelH = expanded && !el.panel.hidden ? el.panel.offsetHeight : 0;
    const h = expanded ? Math.min(420, Math.max(140, head + panelH)) : COLLAPSED_H;
    bridge.resize(h);
  }

  function setExpanded(on) {
    expanded = !!on;
    el.panel.hidden = !expanded;
    el.head.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    el.chev.style.transform = expanded ? 'rotate(180deg)' : 'none';
    el.isl.classList.toggle('off', !expanded);
    /* 等面板完成布局后再量高度，避免把按钮裁掉 */
    requestAnimationFrame(resize);
    clearTimeout(collapseTimer);
    if (expanded && !remind) {
      collapseTimer = setTimeout(() => setExpanded(false), 8000);
    }
  }

  function act(type, id) {
    if (bridge && bridge.act) {
      actAt = performance.now();
      bridge.act({ type, id: id || '' });
    }
  }
  /* 冒烟/自测钩子：与真实点击走同一路径，便于测同步延迟 */
  window.__act = act;
  window.__dbg = function () {
    return {
      expanded: expanded, hasRemind: !!remind,
      panelHidden: el.panel.hidden, islClass: el.isl.className,
      html: el.reminders.children.length, snapReminders: snap ? (snap.reminders || []).length : -1
    };
  };

  /* ---------- 事件 ---------- */
  el.head.addEventListener('click', (e) => {
    if (e.target.closest('.isl-chev')) return;
    setExpanded(!expanded);
  });
  el.head.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); }
  });
  el.chev.addEventListener('click', (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button[data-act]');
    if (b) {
      const a = b.dataset.act;
      if (a === 'open-main') { if (bridge) bridge.openMain(); }
      else if (a === 'toggle-focus') act('toggle-focus');
      return;
    }
    const r = e.target.closest && e.target.closest('[data-rem]');
    if (r) {
      const box = r.closest('.isl-rem');
      const id = box ? box.dataset.id : '';
      if (r.dataset.rem === 'done') act('toggle-task', id);
      else if (bridge && bridge.dismissed) bridge.dismissed(id);
      if (remind && remind.id === id) { remind = null; setExpanded(false); renderReminders(); }
      return;
    }
    const row = e.target.closest && e.target.closest('.isl-rem');
    if (row) {
      act('open-task', row.dataset.id);
      return;
    }
  });

  /* ---------- 桥 ---------- */
  if (bridge) {
    bridge.onSnapshot(s => {
      if (actAt) { recordSync(performance.now() - actAt); actAt = 0; }
      snap = s;
      injectTheme(s.theme);
      applyShape();
      paint();
      if (!expanded) resize();
    });
    bridge.onRemind(t => {
      remind = t;
      setExpanded(true);
      renderReminders();
      try { new window.AudioContext(); } catch (e) { }
    });
    bridge.onDismiss(id => {
      if (remind && remind.id === id) remind = null;
      if (snap && snap.reminders) snap.reminders = snap.reminders.filter(r => r.id !== id);
      renderReminders();
      if (!remind && !(snap && snap.reminders && snap.reminders.length)) setExpanded(false);
    });
    bridge.ready();
  }

  /* 兜底：无桥（浏览器预览）时给一份静态快照，方便截图检查 */
  setTimeout(() => {
    if (snap) return;
    snap = {
      theme: { mode: 'dark', bg: '#0A1220', panel: '#0F1A2B', border: '#1E2F47', text: '#E6EDF7', text2: '#9AAEC8', text3: '#7A8DA8', accent: '#5AA7FF', accentInk: '#07101E' },
      m3: { width: 360, opacity: 1, radius: 26, content: { task: true, count: true, countdown: true, reminders: true, focus: true } },
      view: { type: 'today', label: '今天' },
      task: { id: 'demo', title: '整理 PRD 第 3 章', due: '', dueTime: '', pri: 2 },
      counts: { open: 4, doneToday: 2, today: 4 },
      focus: { running: false, remain: 0, rule: 'R4', remainSec: 0 },
      reminders: [{ id: 'r1', title: '周会材料', due: '', dueTime: '14:30' }]
    };
    injectTheme(snap.theme);
    applyShape();
    paint();
  }, 600);
})();
