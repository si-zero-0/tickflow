/* ===== 命令面板 / 快速捕获 / 到点提醒弹窗 ===== */
(function () {
  const TF = window.TF, S = () => TF.Store, esc = TF.esc;

  /* ---------------- 命令面板 ---------------- */
  const VIEWS = [
    ['inbox', '收集箱', 'inbox'], ['today', '今天', 'today'], ['next7', '最近 7 天', 'calendar'],
    ['timeline', '今日时间轴', 'clock'], ['calendar', '日历', 'calendar'], ['all', '全部', 'layers'],
    ['completed', '已完成', 'check-circle'], ['process', '进程', 'map'], ['habits', '习惯', 'repeat'],
    ['pomodoro', '番茄钟', 'timer'], ['quadrants', '四象限', 'grid'], ['stats', '统计', 'chart'],
    ['wishes', '愿望', 'spark']
  ];

  TF.openPalette = function () {
    if (document.getElementById('pal')) return TF.closePalette();
    const mask = document.createElement('div');
    mask.className = 'pal-mask';
    mask.id = 'pal';
    mask.innerHTML = `<div class="pal">
      <div class="pal-in">
        <svg class="ic sm"><use href="#i-search"/></svg>
        <input id="pal-q" placeholder="搜索任务、跳转视图、执行命令…" autocomplete="off">
        <kbd>Esc</kbd>
      </div>
      <div class="pal-list" id="pal-list"></div>
    </div>`;
    document.body.appendChild(mask);
    requestAnimationFrame(() => mask.classList.add('on'));

    const input = document.getElementById('pal-q');
    let idx = 0, items = [];

    function commands() {
      const base = [
        { k: 'cmd', t: '新建任务', h: 'N', i: 'plus', run: () => { TF.closePalette(); TF.App.view = { type: 'today' }; TF.App.render(); setTimeout(() => { const q = document.getElementById('qa-input'); if (q) q.focus(); }, 40); } },
        { k: 'cmd', t: '快速捕获到收集箱', h: 'Ctrl+Alt+Space', i: 'bolt', run: () => { TF.closePalette(); TF.openCapture(); } },
        { k: 'cmd', t: '新建清单', i: 'folder', run: () => { TF.closePalette(); document.querySelector('[data-act="new-list"]') ? document.querySelector('[data-act="new-list"]').click() : TF.App.newList(); } },
        { k: 'cmd', t: '新建进程', i: 'map', run: () => { TF.closePalette(); TF.App.view = { type: 'process' }; TF.App.render(); setTimeout(() => TF.modalProcess(null), 60); } },
        { k: 'cmd', t: '从模板新建进程', i: 'layers', run: () => { TF.closePalette(); TF.openTemplates(); } },
        { k: 'cmd', t: '新建习惯', i: 'repeat', run: () => { TF.closePalette(); TF.App.view = { type: 'habits' }; TF.App.render(); setTimeout(() => document.querySelector('[data-act="new-habit"]').click(), 60); } },
        { k: 'cmd', t: '开始番茄钟', i: 'timer', run: () => { TF.closePalette(); TF.App.view = { type: 'pomodoro' }; TF.App.render(); setTimeout(() => TF.pomoStart(), 120); } },
        { k: 'cmd', t: '打开愿望', i: 'spark', run: () => { TF.closePalette(); TF.App.view = { type: 'wishes' }; TF.App.group = 'none'; TF.App.filter = 'all'; TF.App.render(); } },
        { k: 'cmd', t: '新建愿望', i: 'plus', run: () => { TF.closePalette(); if (TF.App.view.type !== 'wishes') { TF.App.view = { type: 'wishes' }; TF.App.render(); } setTimeout(() => TF.openWish(null), 60); } },
        { k: 'cmd', t: '切换外观（6 套主题）', i: 'palette', run: () => { TF.closePalette(); TF.cycleTheme(); } },
        { k: 'cmd', t: '显示/隐藏灵动岛', h: 'Ctrl+Alt+I', i: 'bolt', run: () => {
          TF.closePalette();
          if (!TF.setIslandSetting) return;
          const s = TF.Store.data.settings;
          const on = !(s.island && s.island.enabled !== false);
          TF.setIslandSetting('enabled', on);
        } },
        { k: 'cmd', t: '切换密度（标准 / 紧凑）', i: 'grid', run: () => { TF.closePalette(); TF.cycleDensity(); } },
        { k: 'cmd', t: '导入 / 导出数据', i: 'download', run: () => { TF.closePalette(); document.querySelector('[data-act="settings"]').click(); } },
        { k: 'cmd', t: '切换本地配置', i: 'folder', run: () => { TF.closePalette(); TF.openProfileMenu(); } }
      ];
      // 插件贡献的命令排在原生命令之后（ext 未就绪时退回原生列表）
      const extra = (TF.ext && TF.ext.list) ? TF.ext.list('commands') : [];
      return extra.length ? base.concat(extra) : base;
    }

    function build(q) {
      const query = (q || '').trim().toLowerCase();
      const out = [];
      const cmds = commands().filter(c => !query || c.t.toLowerCase().includes(query));
      cmds.forEach(c => out.push(Object.assign({ type: 'cmd' }, c)));
      if (!query) {
        VIEWS.forEach(([v, n, ic]) => out.push({ type: 'view', t: n, i: ic, view: v }));
      } else if (S().data) {
        const hits = S().data.tasks.filter(x => (x.title + ' ' + (x.notes || '')).toLowerCase().includes(query)).slice(0, 6);
        hits.forEach(x => out.push({ type: 'task', t: x.title, i: x.done ? 'check-circle' : 'file', id: x.id }));
        VIEWS.filter(([v, n]) => n.toLowerCase().includes(query)).forEach(([v, n, ic]) => out.push({ type: 'view', t: n, i: ic, view: v }));
      }
      return out;
    }

    function paint() {
      const q = input.value;
      items = build(q);
      idx = Math.min(idx, Math.max(0, items.length - 1));
      const head = t => `<div class="pal-h">${t}</div>`;
      let html = '', lastType = '';
      if (!items.length) html = `<div class="pal-empty">没有匹配项</div>`;
      items.forEach((it, i) => {
        if (it.type !== lastType) {
          html += head(it.type === 'cmd' ? '命令' : it.type === 'view' ? '跳转' : '任务');
          lastType = it.type;
        }
        html += `<button class="pal-i ${i === idx ? 'on' : ''}" data-i="${i}">
          <svg class="ic sm"><use href="#i-${it.i || 'chevron-right'}"/></svg>
          <span class="pal-t">${esc(it.t)}</span>
          ${it.h ? `<kbd>${esc(it.h)}</kbd>` : ''}
        </button>`;
      });
      document.getElementById('pal-list').innerHTML = html;
      const on = document.querySelector('.pal-i.on');
      if (on) on.scrollIntoView({ block: 'nearest' });
    }

    function run(it) {
      if (!it) return;
      TF.closePalette();
      if (it.type === 'cmd') return it.run();
      if (it.type === 'view') {
        TF.App.view = it.view === 'process' ? { type: 'process' } : { type: it.view };
        TF.App.stagger = true; TF.App.render(); return;
      }
      if (it.type === 'task') return TF.openTask(it.id);
    }

    input.addEventListener('input', () => { idx = 0; paint(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); paint(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(items[idx]); }
      else if (e.key === 'Escape') { e.preventDefault(); TF.closePalette(); }
    });
    mask.addEventListener('mousedown', e => {
      if (e.target === mask) return TF.closePalette();
      const b = e.target.closest('.pal-i');
      if (b) run(items[+b.dataset.i]);
    });
    paint();
    setTimeout(() => input.focus(), 30);
  };

  TF.closePalette = function () {
    const el = document.getElementById('pal');
    if (!el) return;
    el.classList.remove('on');
    setTimeout(() => { const x = document.getElementById('pal'); if (x && !x.classList.contains('on')) x.remove(); }, 160);
  };

  /* ---------------- 快速捕获 ---------------- */
  TF.openCapture = function () {
    if (document.getElementById('cap')) { document.getElementById('cap-q').focus(); return; }
    const box = document.createElement('div');
    box.className = 'cap';
    box.id = 'cap';
    box.innerHTML = `<div class="cap-in">
        <svg class="ic"><use href="#i-bolt"/></svg>
        <input id="cap-q" placeholder="记一笔，回车存进收集箱…" autocomplete="off">
      </div>
      <div class="cap-hint"><kbd>Enter</kbd> 保存 · <kbd>Esc</kbd> 取消 · 支持 #标签 !1~!3</div>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add('on'));
    const input = document.getElementById('cap-q');
    const close = () => { box.classList.remove('on'); setTimeout(() => box.remove(), 180); };
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Enter') {
        const v = input.value.trim();
        if (!v) return close();
        // 与快速添加共用同一解析器（R-19：不能只改 quickAdd 不改这里）
        const now = new Date();
        const r = TF.parseTaskInput(v, {
          today: TF.today(),
          now: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
          lists: S().data.lists.map(l => ({ id: l.id, name: l.name })),
          defaultListId: (S().inbox() || {}).id,
          viewDue: null
        });
        if (r.title) {
          S().addTask({
            title: r.title, tags: r.tags, priority: r.priority,
            listId: r.listId || (S().inbox() || {}).id,
            due: r.due, dueTime: r.dueTime
          });
          TF.App.render();
          TF.toast(r.listMiss ? '@' + r.listMiss + ' 不存在，已存入收集箱' : '已存入收集箱', r.listMiss ? 'warn' : 'success');
        } else {
          TF.toast('还需要一个标题', 'warn');
        }
        close();
      }
    });
    setTimeout(() => input.focus(), 40);
  };

  /* ---------------- 到点提醒 ---------------- */
  TF.reminderPopup = function (task, onOpen) {
    document.querySelectorAll('.rem').forEach(x => x.remove());
    const box = document.createElement('div');
    box.className = 'rem';
    const l = S().list(task.listId) || {};
    box.innerHTML = `<div class="rem-i" style="background:${l.color || '#5b8cff'}22;color:${l.color || '#5b8cff'}">
        <svg class="ic"><use href="#i-clock"/></svg></div>
      <div class="rem-main">
        <div class="rem-k">任务提醒 · ${esc(task.dueTime || '')}${task.dueEnd ? '–' + esc(task.dueEnd) : ''}</div>
        <b>${esc(task.title)}</b>
        <span>${esc(l.name || '')}${task.notes ? ' · ' + esc(task.notes.slice(0, 24)) : ''}</span>
      </div>
      <div class="rem-acts">
        <button class="btn sm pri" data-r="done">完成</button>
        <button class="btn sm ghost" data-r="later">10 分钟后</button>
        <button class="ic-btns"><svg class="ic"><use href="#i-x"/></svg></button>
      </div>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add('on'));

    const close = () => { box.classList.remove('on'); setTimeout(() => box.remove(), 200); };
    box.addEventListener('click', e => {
      const r = e.target.closest('[data-r]');
      if (r) {
        e.stopPropagation();
        if (r.dataset.r === 'done') { S().toggleTask(task.id); TF.App.render(); close(); TF.toast('已完成'); }
        if (r.dataset.r === 'later') {
          const d = new Date(Date.now() + 10 * 60000);
          task.dueTime = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
          task.notifiedOn = null;
          S().save(); close(); TF.toast('10 分钟后再提醒');
        }
        return;
      }
      close();
      TF.App.view = { type: 'day', date: task.due || TF.today() };
      TF.App.render();
      TF.openTask(task.id);
    });
  };
})();
