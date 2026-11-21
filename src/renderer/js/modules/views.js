/* ===== 视图层：任务列表 / 日历 / 四象限 ===== */
(function () {
  const TF = window.TF, S = () => TF.Store;
  const esc = TF.esc;

  /* ---------- 排序 & 筛选 ---------- */
  function smartCmp(a, b) {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    const ad = a.due || '9999-99-99', bd = b.due || '9999-99-99';
    if (ad !== bd) return ad < bd ? -1 : 1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1;
  }
  TF.sortTasks = function (arr) {
    const mode = TF.App.sort;
    const a = arr.slice();
    if (mode === 'manual') a.sort((x, y) => (y.done - x.done) || ((x.order || 0) - (y.order || 0)) || smartCmp(x, y));
    else if (mode === 'priority') a.sort((x, y) => y.priority - x.priority || smartCmp(x, y));
    else if (mode === 'created') a.sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''));
    else if (mode === 'title') a.sort((x, y) => x.title.localeCompare(y.title, 'zh'));
    else a.sort(smartCmp);
    return a;
  };

  /* 刚勾选的完成项先留在原位，点「刷新」才隐藏 */
  const keep = x => !x.done || (x.doneAt && new Date(x.doneAt).getTime() > (TF.App.hideDoneBefore || 0));
  TF.keepDone = keep;

  TF.tasksFor = function (view) {
    const all = S().data.tasks;
    const t = TF.today();
    switch (view.type) {
      case 'inbox': { const ib = S().inbox(); return all.filter(x => keep(x) && ib && x.listId === ib.id); }
      case 'today': return all.filter(x => keep(x) && x.due && x.due <= t);
      case 'next7': return all.filter(x => keep(x) && x.due && x.due <= TF.addDays(t, 6) && x.due >= t);
      case 'all': return all.filter(x => keep(x));
      case 'completed': return all.filter(x => x.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
      case 'list': return all.filter(x => keep(x) && x.listId === view.listId);
      case 'day': return all.filter(x => keep(x) && x.due === view.date);
      case 'search': {
        const q = (TF.App.search || '').trim().toLowerCase();
        if (!q) return [];
        return all.filter(x => (x.title + ' ' + (x.notes || '') + ' ' + (x.tags || []).join(' ')).toLowerCase().includes(q));
      }
      default: return all.filter(x => keep(x));
    }
  };

  /* ---------- 即时筛选条（只改展示，不写 Store） ---------- */
  const FILTER_PRED = {
    today: t => t.due === TF.today(),
    overdue: t => !!t.due && t.due < TF.today(),
    week7: t => !!t.due && t.due >= TF.today() && t.due <= TF.addDays(TF.today(), 6),
    high: t => (t.priority || 0) >= 3
  };
  TF.FILTER_KEYS = ['all', 'today', 'overdue', 'week7', 'high'];
  TF.FILTER_NAMES = { all: '全部', today: '今天', overdue: '逾期', week7: '7 天内', high: '高优先级' };
  /* 出现筛选条的视图（已完成 / 搜索 不显示） */
  TF.FILTER_VIEWS = ['inbox', 'today', 'next7', 'all', 'list', 'day'];

  /* 计数口径：全部 = 未完成条数；其余 = 未完成且命中谓词 */
  TF.filterCounts = function (tasks) {
    const arr = Array.isArray(tasks) ? tasks : [];
    const open = arr.filter(t => !t.done);
    const out = { all: open.length };
    ['today', 'overdue', 'week7', 'high'].forEach(k => { out[k] = open.filter(FILTER_PRED[k]).length; });
    return out;
  };

  /* all 时原样返回（保留「刚勾选先留在原位」的既有行为）；
     其余筛选下已完成项一并隐藏 —— 满足「勾选后即时消失」的筛选语义 */
  TF.applyTaskFilter = function (tasks) {
    const f = (TF.App && TF.App.filter) || 'all';
    const arr = Array.isArray(tasks) ? tasks : [];
    if (f === 'all') return arr;
    const pred = FILTER_PRED[f];
    if (!pred) return arr;
    return arr.filter(t => !t.done && pred(t));
  };

  TF.filterChipsHTML = function (tasks) {
    const c = TF.filterCounts(tasks);
    const cur = (TF.App && TF.App.filter) || 'all';
    return TF.FILTER_KEYS.map(k =>
      `<button class="f-chip ${cur === k ? 'on' : ''}" data-act="filter-pick" data-filter="${k}">${TF.FILTER_NAMES[k]} <i>${c[k]}</i></button>`).join('');
  };

  TF.filterBarHTML = function (tasks) {
    return `<div class="filter-bar" id="filter-bar">${TF.filterChipsHTML(tasks)}</div>`;
  };

  /* 筛选空态：给出明确的「清除筛选」出口 */
  TF.filterEmptyHTML = function () {
    return `<div class="empty"><div class="e-ico"><svg class="ic"><use href="#i-search"/></svg></div>
      <b>当前筛选下没有任务</b><span>筛选只影响当前列表，不会改动任何数据</span>
      <button class="btn sm" style="margin-top:12px" data-act="filter-clear">清除筛选</button></div>`;
  };

  /* ---------- 行渲染 ---------- */
  TF.taskRow = function (t) {
    const list = S().list(t.listId);
    const t2 = TF.today();
    const overdue = !t.done && t.due && t.due < t2;
    const isToday = t.due === t2;
    const doneSub = (t.subtasks || []).filter(s => s.done).length;
    const prFlag = '';
    const meta = [];
    if (t.due) {
      const tm = t.dueTime ? (t.dueEnd ? ` ${t.dueTime}–${t.dueEnd}` : ` ${t.dueTime}`) : '';
      meta.push(`<span class="mi due ${overdue ? 'over' : isToday ? 'today' : ''}"><svg class="ic xs"><use href="#i-calendar"/></svg>${esc(TF.cnDate(t.due))}${esc(tm)}</span>`);
    }
    if (t.subtasks && t.subtasks.length) meta.push(`<span class="mi"><svg class="ic xs"><use href="#i-list"/></svg>${doneSub}/${t.subtasks.length}</span>`);
    if (t.repeat) meta.push(`<span class="mi"><svg class="ic xs"><use href="#i-repeat"/></svg>${esc(TF.repLabel(t.repeat))}</span>`);
    const blocked = TF.Store.isBlocked(t) ? TF.Store.blockers(t) : [];
    if (blocked.length) meta.push(`<span class="mi blocked" title="等待：${esc(blocked.map(x => x.title).join('、'))}"><svg class="ic xs"><use href="#i-lock"/></svg>前置 ${blocked.length}</span>`);
    if (t.notes) meta.push(`<span class="mi"><svg class="ic xs"><use href="#i-file"/></svg></span>`);
    if (t.pomo) meta.push(`<span class="mi">🍅${t.pomo}</span>`);
    if (t.nodeId) {
      const n = S().node(t.nodeId);
      if (n) meta.push(`<span class="mi node" title="进程节点"><svg class="ic xs"><use href="#i-map"/></svg>${esc(n.title)}</span>`);
    }
    (t.tags || []).forEach(g => meta.unshift(`<span class="tag">#${esc(g)}</span>`));
    if (TF.App.group === 'list' && list && TF.App.view.type === 'all')
      meta.push(`<span class="mi" style="color:${list.color}">● ${esc(list.name)}</span>`);

    return `<div class="task ${t.done ? 'done' : ''} ${blocked.length ? 'blocked' : ''} ${TF.App.selTask === t.id ? 'sel' : ''}${TF.App._justDone === t.id ? ' just-done' : ''}" data-p="${t.priority || 0}" data-open="${t.id}" tabindex="0" draggable="true">
      <div class="cbx" data-act="toggle" data-id="${t.id}" title="完成"><svg class="ic"><use href="#i-check"/></svg></div>
      <div class="t-body">
        <div class="t-title">${prFlag}<span>${esc(t.title)}</span></div>
        ${meta.length ? `<div class="t-meta">${meta.join('')}</div>` : ''}
      </div>
      <div class="t-more">
        <button class="icon-btn" data-act="row-menu" data-id="${t.id}" title="更多操作" aria-haspopup="menu" draggable="false"><svg class="ic sm"><use href="#i-more"/></svg></button>
      </div>
    </div>`;
  };

  TF.renderList = function (tasks, opts) {
    opts = opts || {};
    if (!tasks.length) {
      if (opts.emptyAct === 'filter-clear') return TF.filterEmptyHTML();
      return TF.emptyBlock(opts.empty || '这里很干净');
    }
    const g = TF.App.group;
    let html = '';
    if (g === 'list') {
      const groups = new Map();
      tasks.forEach(t => { const k = t.listId; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); });
      [...groups.entries()].sort((a, b) => {
        const la = S().list(a[0]), lb = S().list(b[0]);
        return (la ? la.order : 99) - (lb ? lb.order : 99);
      }).forEach(([lid, arr]) => {
        const l = S().list(lid);
        html += `<div class="group-h"><span style="color:${l ? l.color : 'var(--tx3)'}">●</span> ${esc(l ? l.name : '未分类')}<span class="n">${arr.length}</span><span class="line"></span></div>`;
        html += TF.sortTasks(arr).map(TF.taskRow).join('');
      });
    } else if (g === 'priority') {
      [3, 2, 1, 0].forEach(p => {
        const arr = tasks.filter(t => t.priority === p);
        if (!arr.length) return;
        html += `<div class="group-h">${p ? `<svg class="ic sm" style="color:var(--p${p})"><use href="#i-flag"/></svg>` : ''}${TF.priName[p]}优先级<span class="n">${arr.length}</span><span class="line"></span></div>`;
        html += TF.sortTasks(arr).map(TF.taskRow).join('');
      });
    } else if (g === 'date') {
      const t = TF.today();
      const buckets = [
        ['已逾期', x => x.due && x.due < t],
        ['今天', x => x.due === t],
        ['明天', x => x.due === TF.addDays(t, 1)],
        ['未来 7 天', x => x.due && x.due > TF.addDays(t, 1) && x.due <= TF.addDays(t, 7)],
        ['更远', x => x.due && x.due > TF.addDays(t, 7)],
        ['无日期', x => !x.due]
      ];
      buckets.forEach(([nm, fn]) => {
        const arr = tasks.filter(fn);
        if (!arr.length) return;
        html += `<div class="group-h">${nm}<span class="n">${arr.length}</span><span class="line"></span></div>`;
        html += TF.sortTasks(arr).map(TF.taskRow).join('');
      });
    } else {
      html = TF.sortTasks(tasks).map(TF.taskRow).join('');
    }
    return html;
  };

  TF.emptyBlock = function (title, sub, icon) {
    return `<div class="empty"><div class="e-ico"><svg class="ic"><use href="#i-${icon || 'check-circle'}"/></svg></div>
      <b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
  };

  /* ---------- 快速添加 ---------- */
  /* #qa-host / #qa-prev / #qa-chips 三个稳定节点：
     #qa-prev 固定高度（默认 visibility:hidden），保证连续输入不抖动（P0-10） */
  TF.quickAdd = function (ctx) {
    ctx = ctx || {};
    const qa = ctx.qa || (TF.App && TF.App.qaCtx) || { today: false, tomorrow: false, high: false };
    const ph = ctx.placeholder || '明天下午3点给张总回邮件 !高 #沟通 @工作';
    return `<div class="quick-add" id="qa-host">
      <div class="qa-row">
        <svg class="ic"><use href="#i-plus"/></svg>
        <input id="qa-input" autocomplete="off" placeholder="${esc(ph)}"
          data-qa-list="${ctx.listId || ''}" data-qa-due="${ctx.due || ''}">
        <span class="kbd">N</span>
      </div>
      <div class="qa-prev" id="qa-prev"></div>
      <div class="qa-chips" id="qa-chips">
        <button class="qa-chip ${qa.today ? 'on' : ''}" data-act="qa-chip" data-k="today">今天</button>
        <button class="qa-chip ${qa.tomorrow ? 'on' : ''}" data-act="qa-chip" data-k="tomorrow">明天</button>
        <button class="qa-chip ${qa.high ? 'on' : ''}" data-act="qa-chip" data-k="high">高优先级</button>
      </div>
    </div>`;
  };

  /* ---------- 日历 ---------- */
  TF.renderCalendar = function () {
    const A = TF.App;
    const [y, m] = (A.calMonth || TF.today().slice(0, 7)).split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const t = TF.today();
    const byDay = {};
    S().data.tasks.forEach(x => { if (x.due) (byDay[x.due] = byDay[x.due] || []).push(x); });

    let cells = '';
    for (let i = 0; i < startPad; i++) {
      const d = new Date(y, m - 1, -startPad + i + 1);
      cells += `<div class="cal-cell out" data-day="${TF.ymd(d)}"><span class="d">${d.getDate()}</span></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const list = (byDay[iso] || []).slice().sort((a, b) => (a.done - b.done) || (b.priority - a.priority));
      const evs = list.slice(0, 3).map(x => {
        const l = S().list(x.listId);
        return `<div class="ev ${x.done ? 'done' : ''}"><i style="background:${l ? l.color : '#888'}"></i>${esc(x.title)}</div>`;
      }).join('');
      cells += `<div class="cal-cell ${iso === t ? 'today' : ''}" data-day="${iso}">
        <span class="d">${d}</span>${evs}${list.length > 3 ? `<div class="more">+${list.length - 3}</div>` : ''}</div>`;
    }
    const total = startPad + daysInMonth;
    const tail = (7 - total % 7) % 7;
    for (let i = 1; i <= tail; i++) {
      const d = new Date(y, m, i);
      cells += `<div class="cal-cell out" data-day="${TF.ymd(d)}"><span class="d">${d.getDate()}</span></div>`;
    }

    return `<div class="wrap-wide">
      <div class="cal-head">
        <button class="icon-btn" data-act="cal-prev"><svg class="ic"><use href="#i-chevron-left"/></svg></button>
        <div class="m">${y} 年 ${m} 月</div>
        <button class="icon-btn" data-act="cal-next"><svg class="ic"><use href="#i-chevron-right"/></svg></button>
        <button class="btn sm ghost" data-act="cal-today">回到今天</button>
      </div>
      <div class="cal-grid">
        ${['日', '一', '二', '三', '四', '五', '六'].map(w => `<div class="cal-dow">${w}</div>`).join('')}
        ${cells}
      </div>
      <div style="margin-top:10px;font-size:11.5px;color:var(--tx3)">点击任意日期查看当天任务 · 拖动任务到日历暂未支持</div>
    </div>`;
  };

  /* ---------- 四象限 ---------- */
  const QUADS = [
    { k: 'q1', name: '重要 · 紧急', sub: '马上做', dot: 'var(--dan)', test: t => t.priority >= 3 || (t.priority >= 2 && t.due && t.due <= TF.today()) },
    { k: 'q2', name: '重要 · 不紧急', sub: '计划做', dot: 'var(--ac)', test: t => t.priority === 2 && !(t.due && t.due <= TF.today()) },
    { k: 'q3', name: '紧急 · 不重要', sub: '尽快处理', dot: 'var(--warn)', test: t => t.priority <= 1 && t.due && t.due <= TF.today() },
    { k: 'q4', name: '不重要 · 不紧急', sub: '有空再说', dot: 'var(--tx3)', test: t => t.priority <= 1 && !(t.due && t.due <= TF.today()) }
  ];
  TF.renderQuadrants = function () {
    const tasks = S().data.tasks.filter(t => !t.done);
    const bucket = {};
    QUADS.forEach(q => { bucket[q.k] = []; });
    tasks.forEach(t => { const q = QUADS.find(x => x.test(t)); if (q) bucket[q.k].push(t); });
    let html = `<div class="wrap-wide"><div class="quad-grid">`;
    QUADS.forEach(q => {
      const uniq = bucket[q.k];
      html += `<div class="quad ${q.k}" data-quad="${q.k}">
        <div class="quad-h"><span class="dot" style="background:${q.dot}"></span><b>${q.name}</b>
          <span class="pill" style="height:19px">${q.sub}</span><span class="cnt">${uniq.length}</span></div>
        <div class="quad-b">${uniq.length ? uniq.sort(smartCmp).map(TF.taskRow).join('') : `<div style="padding:26px;text-align:center;color:var(--tx3);font-size:12px">拖任务到这里</div>`}</div>
      </div>`;
    });
    return html + `</div><div style="margin-top:10px;font-size:11.5px;color:var(--tx3)">按优先级 + 截止日期自动分桶；把任务拖进不同象限会自动改写其优先级/日期。</div></div>`;
  };

  TF.applyQuad = function (quad, taskId) {
    const t = S().task(taskId); if (!t) return;
    const t2 = TF.today();
    if (quad === 'q1') { t.priority = 3; if (!t.due || t.due > t2) t.due = t2; }
    if (quad === 'q2') { t.priority = 2; if (t.due && t.due <= t2) t.due = TF.addDays(t2, 3); }
    if (quad === 'q3') { t.priority = 1; if (!t.due || t.due > t2) t.due = t2; }
    if (quad === 'q4') { t.priority = 0; }
    S().save();
  };

  /* ---------- 行拖拽排序 ---------- */
  TF.bindTaskDnD = function () {
    const wrap = document.querySelector('#content .wrap');
    if (!wrap || TF.App.sort !== 'manual') return;
    let dragEl = null;
    const clearMarks = () => wrap.querySelectorAll('.drop-before,.drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after'));

    wrap.querySelectorAll('.task').forEach(el => {
      el.addEventListener('dragstart', e => {
        dragEl = el;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', el.dataset.open);
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        dragEl = null;
        clearMarks();
      });
      el.addEventListener('dragover', e => {
        if (!dragEl || dragEl === el) return;
        e.preventDefault();
        const r = el.getBoundingClientRect();
        const after = e.clientY - r.top > r.height / 2;
        clearMarks();
        el.classList.add(after ? 'drop-after' : 'drop-before');
      });
      el.addEventListener('drop', e => {
        if (!dragEl || dragEl === el) return;
        e.preventDefault();
        const after = el.classList.contains('drop-after');
        const r = el.getBoundingClientRect();
        clearMarks();
        const ids = [].slice.call(wrap.querySelectorAll('.task')).map(x => x.dataset.open);
        const from = ids.indexOf(dragEl.dataset.open);
        if (from < 0) return;
        ids.splice(from, 1);
        let to = ids.indexOf(el.dataset.open);
        if (to < 0) to = ids.length;
        ids.splice(after ? to + 1 : to, 0, dragEl.dataset.open);
        ids.forEach((id, i) => {
          const t = S().task(id);
          if (t) t.order = i;
        });
        S().save();
        TF.App.render();
      });
    });
  };
})();
