/* ===== 灵动岛：底部居中胶囊 / 展开面板 / 到点提醒三态 =====
   纯渲染层，零 IPC、零 require。数据只读 TF.Store，写操作走既有 Store API。
   三态：collapsed（收起）→ expanded（展开）→ remind（到点）。
   当前任务判定全部交给 parse.js 的 TF.pickCurrentTask（R1–R5，纯函数），本文件只管 DOM。
*/
(function () {
  const TF = window.TF, S = () => TF.Store, esc = TF.esc;
  const pad2 = n => String(n).padStart(2, '0');

  const Island = TF.Island = {
    state: 'collapsed',
    prevState: null,
    taskId: null,
    queue: [],
    remIdx: 0,
    merged: 0,
    remTimer: 0,
    tickTimer: 0,
    doneTip: 0,
    underScrim: false,
    _tickKey: ''
  };

  function st() { return S().data.settings; }
  function islandConf() {
    const s = st().island || {};
    return { enabled: s.enabled !== false, autoExpand: s.autoExpand !== false };
  }
  function root() { return document.getElementById('island'); }
  function nowHM() {
    const d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function pick() {
    if (typeof TF.pickCurrentTask !== 'function') return null;
    return TF.pickCurrentTask(S().data.tasks, new Date());
  }
  function fmtSec(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
  }
  function listName(id) {
    const l = S().list(id);
    return l ? l.name : '';
  }

  /* ---------------- 文案规则（R1–R5 → dot / 标题 / 右侧） ---------------- */
  function pillView(r) {
    const t = r.taskId ? S().task(r.taskId) : null;
    const allDone = r.todayCount === 0 && r.overdueCount === 0 && r.doneToday > 0;
    if (allDone) return { dot: 'ok', title: '今日全部完成', right: '今日 ' + r.doneToday + ' 项' };
    if (r.rule === 'R5' || !t) return { dot: 'muted', title: '今日无进行中任务', right: '今日 ' + r.todayCount + ' 项' };
    if (r.rule === 'R1') return { dot: 'warn', title: t.title, right: fmtSec(r.remainSec) };
    if (r.rule === 'R2') return { dot: 'warn', title: t.title, right: '逾期 ' + (r.overdueMin || 0) + ' 分' };
    return { dot: 'accent', title: t.title, right: '今日 ' + r.todayCount + ' 项' };
  }

  /* ---------------- DOM 骨架 ---------------- */
  function ensureDom(el) {
    if (el.querySelector('.is-pill')) return;
    /* 顺序很重要： #island 是 column-reverse，第一个子元素落在最下（胶囊贴底），
       面板在其上方向生长。写成 panel 在前会让面板跑到胶囊下面。 */
    el.innerHTML = `<button class="is-pill" data-act="island-toggle" aria-expanded="false">
        <span class="is-dot"></span><span class="is-title"></span><span class="is-right"></span>
      </button>
      <div class="is-panel" id="is-panel" hidden><div class="is-body" id="is-body"></div></div>`;
  }

  /* ---------------- 三块内容 ---------------- */
  function curMeta(t) {
    const parts = [];
    if (t.dueTime) parts.push(t.dueEnd ? t.dueTime + '–' + t.dueEnd : t.dueTime);
    const ln = listName(t.listId);
    if (ln) parts.push(ln);
    if (t.priority > 0) parts.push(TF.priName[t.priority] + '优先级');
    return parts.join(' · ');
  }

  function expandedHTML(r) {
    const t = r.taskId ? S().task(r.taskId) : null;
    const allDone = r.todayCount === 0 && r.overdueCount === 0;

    const curCard = t
      ? `<div class="is-cur" id="is-cur">
           <b class="is-cur-t">${esc(t.title)}</b>
           <span class="is-cur-m">${esc(curMeta(t))}</span>
         </div>`
      : `<div class="is-cur empty" id="is-cur">
           <b class="is-cur-t">今日无进行中任务</b>
           <span class="is-cur-m">按 N 新建一个</span>
         </div>`;

    const items = (r.todayTasks || []).map(x => `<div class="is-item">
        <div class="cbx" data-act="island-item" data-id="${x.id}" title="完成"><svg class="ic"><use href="#i-check"/></svg></div>
        <span class="is-item-t">${esc(x.title)}</span>
      </div>`).join('') || '<div class="is-item-empty">今天没有待办</div>';

    const more = r.todayCount > 5 ? `<div class="is-more-n" id="is-more-n">还有 ${r.todayCount - 5} 项</div>` : '';

    /* R5 / 今日全完成：前 5 个操作禁用；全完成时直接隐藏，只留「新建任务」 */
    const hide = allDone ? ' style="display:none"' : '';
    const dis = (cond) => (cond ? ' disabled' : '');
    const noTask = !t;

    return `<div class="is-head"><h3 class="is-lab">现在进行</h3>
        <button class="is-x" data-act="island-collapse" title="收起"><svg class="ic xs"><use href="#i-chevron-down"/></svg></button>
      </div>
      ${curCard}
      <div class="is-sec"><h3>今日待办</h3><span id="is-today-n">${r.todayCount}</span></div>
      <div class="is-list" id="is-list">${items}${more}</div>
      <div class="is-acts" id="is-acts">
        <button class="btn sm pri" data-act="island-done"${dis(noTask)}${hide}>完成</button>
        <button class="btn sm" data-act="island-snooze"${dis(noTask)}${hide}>推迟 10 分钟</button>
        <button class="btn sm" data-act="island-tomorrow"${dis(noTask)}${hide}>明天</button>
        <button class="btn sm" data-act="island-focus"${dis(noTask)}${hide}>开始专注</button>
        <button class="btn sm ghost" data-act="island-open"${dis(noTask)}${hide}>打开详情</button>
        <button class="btn sm ghost" data-act="island-new">新建任务</button>
      </div>
      <button class="is-all" data-act="island-all">打开全部待办 →</button>`;
  }

  function remindTask() {
    const item = Island.queue[Island.remIdx];
    return item ? S().task(item.taskId) : null;
  }

  function remindHTML() {
    const t = remindTask();
    const waiting = Math.max(0, Island.queue.length - 1) + Island.merged;
    const moreBtn = waiting > 0
      ? `<button class="is-rem-next" data-act="island-rem-next">还有 ${waiting} 条提醒</button>` : '';
    if (!t) {
      return `<div class="is-remind" id="is-remind">
          <div class="is-rem-h"><svg class="ic xs"><use href="#i-clock"/></svg>到点了${moreBtn}</div>
          <b class="is-rem-t">这条任务已不存在</b>
          <div class="is-acts">
            <button class="btn sm ghost" data-act="island-rem-know">知道了</button>
          </div>
        </div>`;
    }
    return `<div class="is-remind" id="is-remind">
        <div class="is-rem-h"><svg class="ic xs"><use href="#i-clock"/></svg>到点了${moreBtn}</div>
        <b class="is-rem-t">${esc(t.title)}</b>
        <span class="is-rem-m">${esc(curMeta(t) || '今日')}</span>
        <div class="is-acts">
          <button class="btn sm pri" data-act="island-rem-done">完成</button>
          <button class="btn sm" data-act="island-rem-later">10 分钟后</button>
          <button class="btn sm ghost" data-act="island-rem-know">知道了</button>
        </div>
      </div>`;
  }

  /* ---------------- 绘制 ---------------- */
  function stopTick() {
    if (Island.tickTimer) { clearInterval(Island.tickTimer); Island.tickTimer = 0; }
  }
  function startTick() {
    if (Island.tickTimer) return;
    /* 单次 tick 出错不能让倒计时静默停摆：记一笔错误计数供烟测读取 */
    Island.tickTimer = setInterval(() => {
      try {
        TF.islandTick();
      } catch (e) {
        Island.tickErrors = (Island.tickErrors || 0) + 1;
        Island.tickError = e && e.message ? e.message : String(e);
      }
    }, 1000);
  }

  function applyState(el, state) {
    el.dataset.state = state;
    const panel = document.getElementById('is-panel');
    const pill = el.querySelector('.is-pill');
    if (pill) pill.setAttribute('aria-expanded', state !== 'collapsed' ? 'true' : 'false');
    if (!panel) return;
    if (state === 'collapsed') {
      if (!panel.hidden && !panel.classList.contains('closing')) {
        panel.classList.add('closing');
        setTimeout(() => {
          const p = document.getElementById('is-panel');
          if (p && Island.state === 'collapsed') {
            p.hidden = true;
            p.classList.remove('closing');
            /* 收起动画结束后高度才真正变小，这里补写一次，让 toast 跟着降下来 */
            const box = root();
            if (box) document.body.style.setProperty('--island-h', Math.round(box.getBoundingClientRect().height) + 'px');
          }
        }, 180);
      }
    } else {
      panel.classList.remove('closing');
      panel.hidden = false;
    }
  }

  function paintPill(el, r) {
    const dot = el.querySelector('.is-dot');
    const title = el.querySelector('.is-title');
    const right = el.querySelector('.is-right');

    /* 提醒态：胶囊直接显示正在提醒的那一条，避免与面板文案打架 */
    if (Island.state === 'remind') {
      const rt = remindTask();
      if (dot) dot.className = 'is-dot remind';
      if (title) title.textContent = rt ? rt.title : '到点了';
      if (right) right.textContent = rt && rt.dueTime ? rt.dueTime : '到点了';
      return;
    }

    const v = pillView(r);
    /* 收起态但队列非空：是「到点未处理」，状态点亮提醒色并给出真实条数 */
    const pendingRemind = Island.queue.length > 0;
    if (dot) dot.className = 'is-dot ' + (pendingRemind ? 'remind' : v.dot);
    if (title) title.textContent = v.title;
    if (right) right.textContent = pendingRemind ? (Island.queue.length + Island.merged) + ' 条到点' : v.right;
  }

  /* ---------- 全量绘制（状态切换 / 数据变化） ---------- */
  TF.islandRender = function () {
    const el = root();
    if (!el) return;
    const conf = islandConf();
    const body = document.body;

    if (!conf.enabled) {
      el.hidden = true;
      el.removeAttribute('data-state');
      body.classList.remove('island-on');
      body.style.removeProperty('--island-h');
      if (Island.state !== 'collapsed') Island.state = 'collapsed';
      clearTimeout(Island.remTimer);
      Island.remTimer = 0;
      stopTick();
      el.classList.remove('dim');
      return;
    }

    el.hidden = false;
    body.classList.add('island-on');
    ensureDom(el);
    startTick();

    /* 抽屉打开时压在遮罩下：强制收起（遮罩 z=35 > 岛 z=30，天然被压暗） */
    if (Island.underScrim && Island.state !== 'collapsed') Island.state = 'collapsed';

    const r = pick();
    if (!r) return;
    Island.taskId = r.taskId;
    paintPill(el, r);

    const isBody = document.getElementById('is-body');
    if (isBody && Island.state !== 'collapsed') {
      isBody.innerHTML = Island.state === 'remind' ? remindHTML() : expandedHTML(r);
    }
    applyState(el, Island.state);

    /* 把岛的实际高度写回 --island-h，让 toast 始终贴在岛上沿（展开时自动让位） */
    const h = Math.round(el.getBoundingClientRect().height);
    if (h > 0) document.body.style.setProperty('--island-h', h + 'px');
  };

  /* ---------- 只改文本（1s tick，禁止整块重绘） ---------- */
  TF.islandPatch = function () {
    const el = root();
    if (!el || el.hidden) return;
    const r = pick();
    if (!r) return;
    Island.taskId = r.taskId;
    paintPill(el, r);
    const n = document.getElementById('is-today-n');
    if (n) n.textContent = String(r.todayCount);
  };

  TF.islandTick = function () {
    const el = root();
    if (!el || el.hidden || Island.state !== 'collapsed') return;
    const r = pick();
    if (!r) return;
    /* R1 每秒刷倒计时；其余规则每分钟一次即可（节流靠 key 比较） */
    const key = r.rule === 'R1'
      ? 'R1|' + r.remainSec
      : r.rule + '|' + nowHM().slice(0, 4) + '|' + r.taskId;
    if (key === Island._tickKey) return;
    Island._tickKey = key;
    Island.taskId = r.taskId;
    paintPill(el, r);
  };

  /* ---------- 状态切换 ---------- */
  TF.islandExpand = function () {
    if (!islandConf().enabled) return;
    if (Island.state === 'remind') clearTimeout(Island.remTimer);
    Island.state = 'expanded';
    TF.islandRender();
  };

  TF.islandCollapse = function (opts) {
    const o = opts || {};
    if (o.from === 'remind') {
      clearTimeout(Island.remTimer);
      Island.remTimer = 0;
      /* 只收起，**不清队列**：后面几条还没被逐条确认，清了它们当天就再也不会被提醒
         （app.js 入队时已为它们写过 notifiedOn）。胶囊会显示「N 条到点」，点它可回到当前条。 */
    }
    /* 收起绝不碰 notifiedOn（R-07：否则下一轮 30s 轮询会重复提醒） */
    Island.state = 'collapsed';
    TF.islandRender();
  };

  TF.islandRestore = function () {
    Island.state = Island.prevState || 'collapsed';
    Island.prevState = null;
    TF.islandRender();
  };

  /* 抽屉/弹窗打开时把岛压到遮罩之下 */
  TF.islandUnderScrim = function (on) {
    Island.underScrim = !!on;
    const el = root();
    if (Island.underScrim) {
      if (Island.state !== 'collapsed') { Island.prevState = Island.state; Island.state = 'collapsed'; }
      if (el) el.classList.add('under-scrim');
      TF.islandRender();
    } else {
      if (el) el.classList.remove('under-scrim');
      if (Island.prevState) TF.islandRestore();
    }
  };

  /* 弹窗打开时整体变暗（modal z=60 本来就盖住岛，这里只做视觉弱化 + 不响应点击） */
  TF.islandDim = function (on) {
    const el = root();
    if (el) el.classList.toggle('dim', !!on);
  };

  /* ---------- 到点提醒 ---------- */
  /* 队列硬上限：超过 20 条才真做「合并计数」（此前是 3，第 4 条起只加 merged 不存 id，
     导致「还有 N 条提醒」永远轮不到第 4 条以后 —— 而 app.js 已为它们写过 notifiedOn，
     当天不会再重入队，等于静默吞掉）。 */
  const MAX_QUEUE = 20;

  /* 进入/刷新提醒态：展示 queue[remIdx] 并重置 8s 自动收起 */
  function enterRemind() {
    if (!Island.queue.length) return;
    if (Island.remIdx >= Island.queue.length) Island.remIdx = 0;
    if (Island.remIdx < 0) Island.remIdx = 0;
    Island.state = 'remind';
    TF.islandRender();
    clearTimeout(Island.remTimer);
    Island.remTimer = setTimeout(() => { TF.islandCollapse({ from: 'remind' }); }, 8000);
  }

  /* 只移除「当前正在提醒的那一条」并前进：
     - 还有下一条 → 保持 remind、指向下一条、重置 8s
     - 没有下一条 → 收起；队列清空后胶囊自然回到普通态 */
  function dropCurrentRemind() {
    if (Island.queue.length) Island.queue.splice(Island.remIdx, 1);
    if (!Island.queue.length) {
      Island.merged = 0;
      Island.remIdx = 0;
      clearTimeout(Island.remTimer);
      Island.remTimer = 0;
      Island.state = 'collapsed';
      TF.islandRender();
      return false;
    }
    if (Island.remIdx >= Island.queue.length) Island.remIdx = 0;
    enterRemind();
    return true;
  }

  /* 返回 true = 已接管（调用方不再调 TF.reminderPopup）；false = 岛不可用，回退旧卡 */
  TF.islandRemind = function (task) {
    const el = root();
    if (!task || !el || !islandConf().enabled) return false;
    if (el.hidden) return false;

    /* 入队：同一 taskId 不重复；超过上限只做合并计数 */
    const dup = Island.queue.findIndex(q => q.taskId === task.id);
    if (dup >= 0) {
      Island.remIdx = dup;
    } else if (Island.queue.length >= MAX_QUEUE) {
      Island.merged++;
    } else {
      Island.queue.push({ taskId: task.id, at: Date.now() });
      Island.remIdx = Island.queue.length - 1;
    }

    if (!islandConf().autoExpand && Island.state !== 'remind') {
      /* 不自动展开：只在胶囊上亮状态点 + 显示条数，点胶囊才进提醒态 */
      if (Island.state !== 'collapsed') Island.state = 'collapsed';
      TF.islandRender();
      return true;
    }

    enterRemind();
    return true;
  };

  /* ---------- 数据变化后重算 ---------- */
  TF.islandRefresh = function () {
    const el = root();
    if (!el) return;
    if (!islandConf().enabled) { TF.islandRender(); return; }
    const r = pick();
    if (!r) return;
    /* 提醒态不因数据刷新而退出；展开/收起态重算当前任务 */
    if (Island.state !== 'remind') Island.taskId = r.taskId;
    TF.islandRender();
  };

  /* ---------------- 动作 ---------------- */
  function padTime(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

  function snooze(t) {
    if (!t) return;
    if (t.dueTime) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(t.dueTime);
      const total = m ? (+m[1]) * 60 + (+m[2]) : 0;
      let next = total + 10;
      if (next >= 1440) { next -= 1440; t.due = TF.addDays(t.due || TF.today(), 1); }
      else t.due = t.due || TF.today();
      t.dueTime = pad2(Math.floor(next / 60)) + ':' + pad2(next % 60);
    } else {
      const d = new Date(Date.now() + 10 * 60000);
      t.due = TF.ymd(d);
      t.dueTime = padTime(d);
    }
    t.notifiedOn = null;
    S().save();
  }

  function completeTask(id) {
    if (!id) return;
    const before = pick();
    const left = Math.max(0, (before ? before.todayCount : 1) - 1);
    S().toggleTask(id);
    if (TF.App && TF.App.renderListOnly) TF.App.renderListOnly();
    TF.islandRender();
    showDoneTip('已完成 · 剩余 ' + left + ' 项');
  }

  function showDoneTip(text) {
    const body = document.getElementById('is-body');
    if (!body) return;
    let el = body.querySelector('.is-done-tip');
    if (!el) {
      el = document.createElement('div');
      el.className = 'is-done-tip';
      body.appendChild(el);
    }
    el.textContent = text;
    clearTimeout(Island.doneTip);
    Island.doneTip = setTimeout(() => {
      const x = document.querySelector('.is-done-tip');
      if (x) x.remove();
    }, 1800);
  }

  function act(name, el) {
    const id = el.dataset.id;
    const t = Island.taskId ? S().task(Island.taskId) : null;

    switch (name) {
      case 'island-toggle':
        /* 收起态点胶囊：有未处理的到点提醒就直接进提醒态，否则展开面板 */
        if (Island.state === 'collapsed') {
          if (Island.queue.length) enterRemind();
          else TF.islandExpand();
        } else {
          TF.islandCollapse();
        }
        break;
      case 'island-collapse':
        TF.islandCollapse();
        break;
      case 'island-item':
        completeTask(id);
        break;
      case 'island-done':
        if (!t) break;
        S().toggleTask(t.id);
        if (TF.App && TF.App.renderListOnly) TF.App.renderListOnly();
        TF.islandCollapse();
        TF.toast('已完成');
        break;
      case 'island-snooze':
        if (!t) break;
        snooze(t);
        TF.islandCollapse();
        TF.toast('10 分钟后再提醒');
        break;
      case 'island-tomorrow':
        if (!t) break;
        t.due = TF.addDays(TF.today(), 1);
        S().save();
        TF.islandCollapse();
        TF.toast('已改到明天');
        break;
      case 'island-focus':
        if (!t || !TF.Pomo) break;
        TF.Pomo.taskId = t.id;
        TF.Pomo.mode = 'work';
        TF.Pomo.remain = TF.pomoTotal();
        TF.Pomo.running = false;
        TF.App.view = { type: 'pomodoro' };
        TF.App.render();
        TF.islandCollapse();
        TF.pomoStart();
        break;
      case 'island-open':
        if (!t) break;
        TF.openTask(t.id);
        break;
      case 'island-new': {
        TF.islandCollapse();
        if (!document.getElementById('qa-input')) {
          TF.App.view = { type: 'today' };
          TF.App.render();
        }
        setTimeout(() => {
          const q = document.getElementById('qa-input');
          if (q) { q.focus(); q.scrollIntoView({ block: 'center' }); }
        }, 30);
        break;
      }
      case 'island-all':
        TF.App.view = { type: 'today' };
        TF.App.filter = 'all';
        TF.App.render();
        TF.islandCollapse();
        break;
      case 'island-rem-next':
        if (Island.queue.length > 1) {
          Island.remIdx = (Island.remIdx + 1) % Island.queue.length;
          /* 只轮换指针，不动 merged —— 否则「还有 N 条」会凭空消失 */
          TF.islandRender();
        }
        break;
      case 'island-rem-done': {
        const rt = remindTask();
        if (rt) {
          S().toggleTask(rt.id);
          if (TF.App && TF.App.renderListOnly) TF.App.renderListOnly();
          TF.toast('已完成');
        }
        dropCurrentRemind();
        break;
      }
      case 'island-rem-later': {
        const rt = remindTask();
        if (rt) snooze(rt);
        dropCurrentRemind();
        TF.toast('10 分钟后再提醒');
        break;
      }
      case 'island-rem-know':
        /* 只确认当前这一条；还有下一条就继续提醒，没有才收起。绝不整队清空。 */
        dropCurrentRemind();
        break;
      default:
        break;
    }
  }

  /* 岛内点击与「点面板外收起」必须放在同一个监听里：
     岛内按钮点下去会立刻触发重绘（innerHTML 替换），被点的节点随之脱离文档；
     若分成两个 document 监听，后一个再用 e.target.closest('#island') 判断"是否在岛内"，
     拿到的一定是 null → 每次点岛内按钮都会被误判成"点了外面"而收起面板。
     这里在重绘**之前**先把结论算出来。 */
  document.addEventListener('click', e => {
    const tg = e.target;
    if (!tg || typeof tg.closest !== 'function') return;
    const inside = !!tg.closest('#island');

    if (inside) {
      const el = tg.closest('#island [data-act]');
      if (el) {
        e.stopPropagation();
        act(el.dataset.act, el);
      }
      return;                    // 岛内任何点击都不算「点外部」
    }

    if (Island.state === 'collapsed') return;
    if (document.getElementById('modal-host').classList.contains('open')) return;
    TF.islandCollapse({ from: 'remind' });
  });

  /* 启动时先画一次（app.js boot 末尾也会调，重复调用是幂等的） */
  TF.islandReady = function () {
    TF.islandRender();
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && TF.islandRefresh) TF.islandRefresh();
  });
})();
