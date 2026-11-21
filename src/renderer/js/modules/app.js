/* ===== 应用外壳：路由 / 侧边栏 / 顶栏 / 抽屉 / 交互 ===== */
(function () {
  const TF = window.TF, S = () => TF.Store, esc = TF.esc;
  // 版本号：与 src/main/package.json 保持一致；build.mjs 在打 stage 时按 package.json 覆盖此值
  TF.VERSION = '1.13.1';

  const App = TF.App = {
    view: { type: 'today' },
    group: 'date',
    sort: 'smart',
    search: '',
    selTask: null,
    calMonth: TF.today().slice(0, 7),
    hideDoneBefore: Date.now(),
    drawerMode: null,
    /* v1.12 新增交互态（全部在内存，不落 Store） */
    filter: 'all',
    qaCtx: { today: false, tomorrow: false, high: false },
    wishFilter: 'all',
    wishSort: 'target',
    selWish: null,
    rowMenuTask: null,
    renderListOnly() {
      const v = this.view;
      const raw = TF.tasksFor(v);
      const shown = TF.applyTaskFilter(raw);
      const box = document.getElementById('task-list');
      if (box) {
        box.innerHTML = shown.length
          ? TF.renderList(shown, { empty: '没有匹配的任务' })
          : (this.filter !== 'all' ? TF.filterEmptyHTML() : TF.emptyBlock('这里很干净', '按 N 或点击上方输入框添加任务'));
      }
      const tb = document.getElementById('tb-count');
      if (tb) tb.textContent = countText(v);
      const tv = document.getElementById('tv-count');
      if (tv) tv.textContent = shown.length + ' 项待办';
      const fb = document.getElementById('filter-bar');
      if (fb) fb.innerHTML = TF.filterChipsHTML(raw);
      // 局部刷新后重新绑定手动拖拽（R-18）
      if (this.sort === 'manual') TF.bindTaskDnD();
      this.updateSidebarCounts();
    },
    /* 只改文本，不重建 sidebar（重建会丢滚动位置、并把展开中的 profile-chip 收起） */
    updateSidebarCounts() {
      const c = counts();
      const map = {
        inbox: c.inbox,
        today: c.today,
        next7: c.next7,
        all: c.all,
        completed: c.completed,
        wishes: S().wishStats().undone,
        profile: S().data.tasks.filter(t => !t.done).length
      };
      document.querySelectorAll('#sidebar [data-count]').forEach(el => {
        const k = el.dataset.count;
        const v = map[k];
        if (v === undefined) return;
        /* 两处既有规则不同：导航计数空时留白（`n || ''`），profile-chip 始终显示数字 */
        el.textContent = k === 'profile' ? String(v) : (v ? String(v) : '');
      });
    },

    render() {
      this.renderSidebar();
      this.renderTopbar();
      this.renderContent();
      this.renderRightRail();
      this.renderStatusbar();
    },
    renderSidebar() {
      document.getElementById('sidebar').innerHTML = sidebarHTML();
    },
    renderTopbar() {
      document.getElementById('topbar').innerHTML = topbarHTML();
    },
    /* 右侧图标栏：6 个图标按钮，1060 由 CSS 隐藏 */
    renderRightRail() {
      const box = document.getElementById('right-rail');
      if (!box) return;
      box.innerHTML = `<button class="rail-btn" data-act="rail-search" title="搜索（Ctrl+K）" aria-label="搜索"><svg class="ic"><use href="#i-search"/></svg></button>
        <button class="rail-btn" data-act="rail-palette" title="命令面板（Ctrl+K）" aria-label="命令面板"><svg class="ic"><use href="#i-bolt"/></svg></button>
        <button class="rail-btn" data-act="rail-focus" title="开始专注" aria-label="开始专注"><svg class="ic"><use href="#i-timer"/></svg></button>
        <button class="rail-btn" data-act="appearance-open" title="外观" aria-label="外观"><svg class="ic"><use href="#i-palette"/></svg></button>
        <button class="rail-btn" data-act="settings" title="设置" aria-label="设置"><svg class="ic"><use href="#i-settings"/></svg></button>
        <button class="rail-btn rail-collapse" data-act="rail-collapse" title="收起侧栏" aria-label="收起侧栏"><svg class="ic"><use href="#i-chevron-right"/></svg></button>`;
    },
    /* 底部状态栏：专注 · 计数 · 同步/版本（1060 下不换行） */
    renderStatusbar() {
      const box = document.getElementById('statusbar');
      if (!box) return;
      const S2 = S();
      const open = S2.data.tasks.filter(t => !t.done).length;
      const running = TF.Pomo && TF.Pomo.running;
      box.innerHTML = `<span class="st-focus ${running ? 'on' : ''}" data-act="st-focus" role="button" tabindex="0" title="${running ? '暂停专注' : '开始专注'}">
          <i class="st-dot"></i>${running ? '专注中 ' + fmtPomo() : '专注'}</span>
        <span class="st-count">${open} 项待办</span>
        <span class="st-mid">数据仅存本机</span>
        <span class="st-right">v${TF.VERSION}</span>`;
    },
    renderContent() {
      const c = document.getElementById('content');
      const v = this.view;
      let html = '';
      switch (v.type) {
        case 'inbox':
        case 'today':
        case 'next7':
        case 'all':
        case 'completed':
        case 'list':
        case 'day':
        case 'search':
          html = taskViewHTML(v);
          break;
        case 'timeline': html = TF.renderTimeline(); break;
        case 'calendar': html = TF.renderCalendar(); break;
        case 'quadrants': html = TF.renderQuadrants(); break;
        case 'process': html = TF.renderProcess(); break;
        case 'habits': html = TF.renderHabits(); break;
        case 'pomodoro': html = TF.renderPomodoro(); break;
        case 'stats': html = TF.renderStats(); break;
        case 'wishes': html = TF.renderWishes(); break;
        default: html = taskViewHTML(v);
      }
      // 视图切换才复位滚动；在写入新 DOM 之前做，避免对未布局的新内容强制重排
      const vk = JSON.stringify(v) + '|' + this.group + '|' + this.search;
      const changed = vk !== this._viewKey;
      if (changed) {
        if (this._viewKey !== undefined && c.scrollTop !== 0) c.scrollTop = 0;
        this._viewKey = vk;
      }
      c.innerHTML = html;
      if (this.stagger) {
        const w = c.querySelector('.wrap');
        if (w) w.classList.add('stagger');
        this.stagger = false;
      }
      /* 每个视图只演一次入场（任务列表用错峰入场，其余视图用整体入场） */
      const isTaskView = ['inbox', 'today', 'next7', 'all', 'list', 'day', 'search', 'completed'].includes(v.type);
      if (changed && !isTaskView) {
        c.classList.remove('view-enter');
        void c.offsetWidth;
        c.classList.add('view-enter');
      }
      if (v.type === 'process') TF.bindRoadmap();
      if (v.type === 'timeline') TF.bindTimeline();
      if (['inbox', 'today', 'next7', 'all', 'list', 'day'].includes(v.type)) TF.bindTaskDnD();
      if (v.type === 'pomodoro') {
        const sel = document.getElementById('pomo-task');
        if (sel) sel.addEventListener('change', e => { TF.Pomo.taskId = e.target.value; });
      }
      bindQuickAdd();
    }
  };

  /* ================= 快速添加：解析预览 + 连续录入 ================= */
  /* 状态栏专注剩余时间：mm:ss（Pomo 未加载时安全回退） */
  function fmtPomo() {
    const p = TF.Pomo;
    if (!p || typeof p.remain !== 'number') return '25:00';
    const s = Math.max(0, p.remain);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  /* 顶栏/底部的计数文案（renderListOnly 只更新文本，不重建 topbar） */
  function countText(v) {    const d = S().data;
    if (v.type === 'list') return d.tasks.filter(t => !t.done && t.listId === v.listId).length + ' 项待办';
    if (v.type === 'day') return d.tasks.filter(t => t.due === v.date && !t.done).length + ' 项';
    if (['today', 'next7', 'all', 'inbox', 'completed'].includes(v.type)) return TF.tasksFor(v).filter(x => !x.done).length + ' 项';
    if (v.type === 'wishes') return S().wishStats().undone + ' 未实现';
    return '';
  }

  /* 解析上下文：today / now / lists / defaultListId / viewDue 全部显式注入（parseTaskInput 是纯函数） */
  function qaCtxObj() {
    const v = App.view, now = new Date();
    return {
      today: TF.today(),
      now: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
      lists: S().data.lists.map(l => ({ id: l.id, name: l.name })),
      defaultListId: v.type === 'list' ? v.listId : (S().inbox() || {}).id,
      viewDue: v.type === 'day' ? v.date : (v.type === 'today' ? TF.today() : null)
    };
  }

  /* 粘性 chip 的日期（与手写 token 冲突时手写优先） */
  function stickyDue() {
    const qa = App.qaCtx;
    if (qa.today) return TF.today();
    if (qa.tomorrow) return TF.addDays(TF.today(), 1);
    return null;
  }

  /* 预览区：固定高度，无内容时不显示但占位（P0-10 连续输入不抖动） */
  function renderPrev(r, errText) {
    const box = document.getElementById('qa-prev');
    if (!box) return;
    if (errText) {
      box.innerHTML = `<span class="qa-chip warn">${esc(errText)}</span>`;
      box.classList.add('has');
      return;
    }
    const chips = (r && r.chips) || [];
    if (!chips.length) { box.innerHTML = ''; box.classList.remove('has'); return; }
    box.innerHTML = chips.map(c => `<span class="qa-chip${c.warn ? ' warn' : ''}">${esc(c.text)}</span>`).join('');
    box.classList.add('has');
  }

  function previewNow() {
    const inp = document.getElementById('qa-input');
    if (!inp) return null;
    const text = inp.value;
    if (!text.trim()) { renderPrev(null); return null; }
    const r = TF.parseTaskInput(text, qaCtxObj());
    renderPrev(r, r.error === 'no-title' ? '还需要一个标题' : '');
    return r;
  }

  /* Enter 保存：不重建 #qa-host，只局部替换 #task-list，焦点留在原 input（P0-11） */
  function submitQuickAdd() {
    const inp = document.getElementById('qa-input');
    if (!inp) return;
    const text = inp.value;
    if (!text.trim()) return;
    const ctx = qaCtxObj();
    const r = TF.parseTaskInput(text, ctx);
    if (r.error === 'no-title') { renderPrev(r, '还需要一个标题'); TF.toast('还需要一个标题', 'warn'); return; }
    const due = r.due || stickyDue() || ctx.viewDue || null;
    S().addTask({
      title: r.title,
      tags: r.tags,
      priority: r.priority || (App.qaCtx.high ? 3 : 0),
      listId: r.listId || ctx.defaultListId,
      due: due,
      dueTime: r.dueTime || null
    });
    inp.value = '';
    renderPrev(null);
    App.renderListOnly();
    inp.focus();
    if (r.listMiss) TF.toast('@' + r.listMiss + ' 不存在，已放入当前清单', 'warn');
    else TF.toast('已添加');
  }

  function bindQuickAdd() {
    const inp = document.getElementById('qa-input');
    if (!inp || inp.dataset.bound === '1') return;
    inp.dataset.bound = '1';
    inp.addEventListener('input', previewNow);
    inp.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); submitQuickAdd(); return; }
      if (ev.key === 'Escape') {
        ev.preventDefault(); ev.stopPropagation();
        if (inp.value) { inp.value = ''; renderPrev(null); }
        else inp.blur();
      }
    });
    previewNow();
  }

  /* ================= 侧边栏 ================= */
  function counts() {
    const d = S().data, t = TF.today();
    return {
      inbox: d.tasks.filter(x => !x.done && x.listId === (S().inbox() || {}).id).length,
      today: d.tasks.filter(x => !x.done && x.due && x.due <= t).length,
      next7: d.tasks.filter(x => !x.done && x.due && x.due >= t && x.due <= TF.addDays(t, 6)).length,
      all: d.tasks.filter(x => !x.done).length,
      completed: d.tasks.filter(x => x.done).length
    };
  }

  /* 计数钩子：只给需要随局部刷新更新的项挂 data-count */

  function sidebarHTML() {
    const d = S().data, v = App.view, c = counts();
    const pf = S().activeProfile() || { name: '本地配置', emoji: '🗂️', color: '#5b8cff' };
    const pfCount = d.tasks.filter(t => !t.done).length;

    /* 每个导航项：24×24 彩色图标块 + 文本 + 计数徽章（选中＝整行 pill） */
    const item = (view, icon, label, n, key, tone, extra) => `<div class="sb-item ${v.type === view ? 'active' : ''}" data-act="nav" data-view="${view}"${extra || ''} title="${label}" role="button" tabindex="0">
      <span class="sb-ic tone-${tone || 'work'}"><svg class="ic"><use href="#i-${icon}"/></svg></span>
      <span class="sb-lb">${label}</span><span class="sb-cnt"${key ? ` data-count="${key}"` : ''}>${n || ''}</span></div>`;

    const lists = d.lists.filter(l => !l.inbox).map(l => {
      const n = d.tasks.filter(t => !t.done && t.listId === l.id).length;
      const on = v.type === 'list' && v.listId === l.id;
      return `<div class="sb-item ${on ? 'active' : ''}" data-act="nav" data-view="list" data-list="${l.id}" title="${esc(l.name)}" role="button" tabindex="0">
        <span class="sb-dot" style="background:${l.color}"></span><span class="sb-lb">${esc(l.name)}</span>
        <span class="sb-cnt">${n || ''}</span>
        <button class="sb-del" data-act="del-list" data-id="${l.id}" title="删除清单" aria-label="删除清单"><svg class="ic xs"><use href="#i-trash"/></svg></button>
      </div>`;
    }).join('');

    return `<div class="sb-brand">
        <span class="brand-mark">刻</span>
        <span class="sb-brand-tx"><b>刻度 TickFlow</b><span>本地 · 免账号</span></span>
      </div>
      <button class="sb-quick" data-act="new-task" title="新建任务（N）">
        <svg class="ic sm"><use href="#i-plus"/></svg><span>快速添加</span><span class="sb-kbd">N</span>
      </button>
      <div class="sb-scroll">
        <div class="sb-group"><span>工作台</span></div>
        ${item('inbox', 'inbox', '收件箱', c.inbox, 'inbox', 'work')}
        ${item('today', 'today', '今天', c.today, 'today', 'work')}
        ${item('next7', 'calendar', '未来 7 天', c.next7, 'next7', 'work')}
        ${item('all', 'layers', '全部', c.all, 'all', 'work')}
        ${item('completed', 'check-circle', '已完成', c.completed, 'completed', 'work')}

        <div class="sb-group"><span>视图</span></div>
        ${item('timeline', 'clock', '时间轴', '', '', 'view')}
        ${item('calendar', 'calendar', '日历', '', '', 'view')}
        ${item('quadrants', 'grid', '四象限', '', '', 'view')}
        ${item('habits', 'repeat', '习惯', d.habits.length, '', 'view')}
        ${item('stats', 'chart', '统计', '', '', 'view')}
        ${item('process', 'map', '进程', d.processes.length, '', 'view')}

        <div class="sb-group"><span>工具</span></div>
        ${item('wishes', 'spark', '愿望', S().wishStats().undone, 'wishes', 'wish')}
        ${item('pomodoro', 'timer', '专注', '', '', 'tool')}
        <div class="sb-item" data-act="palette" title="命令面板（Ctrl+K）" role="button" tabindex="0">
          <span class="sb-ic tone-tool"><svg class="ic"><use href="#i-bolt"/></svg></span>
          <span class="sb-lb">命令面板</span><span class="sb-kbd">K</span></div>

        <div class="sb-group"><span>清单</span><button class="sb-add" data-act="new-list" title="新建清单" aria-label="新建清单"><svg class="ic xs"><use href="#i-plus"/></svg></button></div>
        ${lists}
      </div>
      <div class="sb-foot">
        <div class="sb-prefs" role="group" aria-label="偏好入口">
          <div class="sb-item" data-act="appearance-open" title="外观" role="button" tabindex="0">
            <span class="sb-ic tone-set"><svg class="ic"><use href="#i-palette"/></svg></span><span class="sb-lb">外观</span></div>
          <div class="sb-item" data-act="settings" title="设置" role="button" tabindex="0">
            <span class="sb-ic tone-set"><svg class="ic"><use href="#i-settings"/></svg></span><span class="sb-lb">设置</span></div>
          <div class="sb-item" data-act="help" title="帮助" role="button" tabindex="0">
            <span class="sb-ic tone-help"><svg class="ic"><use href="#i-alert"/></svg></span><span class="sb-lb">帮助</span></div>
          <button class="profile-chip" data-act="profile-menu" title="配置：${esc(pf.name)} · ${pfCount} 项待办">
            <span class="pf-av" style="background:${pf.color}22;color:${pf.color}">${esc(pf.emoji || '🗂️')}</span>
            <span class="sb-lb">配置</span>
          </button>
        </div>
      </div>`;
  }


  /* ================= 本地配置 ================= */
  TF.closeProfileMenu = function () {
    const pop = document.getElementById('pf-pop');
    if (!pop) return;
    pop.classList.remove('on');
    setTimeout(() => { const x = document.getElementById('pf-pop'); if (x && !x.classList.contains('on')) x.remove(); }, 180);
    const chip = document.querySelector('.profile-chip');
    if (chip) chip.classList.remove('open');
  };

  TF.openProfileMenu = function () {
    const exist = document.getElementById('pf-pop');
    if (exist) return TF.closeProfileMenu();
    const chip = document.querySelector('.profile-chip');
    if (!chip) return;
    const S2 = S();
    const act = S2.activeId();
    const rows = S2.profiles().map(p => `<button class="pf-row ${p.id === act ? 'on' : ''}" data-act="pf-switch" data-id="${p.id}">
        <span class="pf-av" style="background:${p.color}22;color:${p.color}">${esc(p.emoji || '🗂️')}</span>
        <span class="pf-row-tx"><b>${esc(p.name)}</b><span>${p.tasks || 0} 项 · ${p.done || 0} 完成</span></span>
        ${p.id === act ? '<svg class="ic sm pf-check"><use href="#i-check"/></svg>' : ''}
        <span class="pf-row-act" data-act="pf-edit" data-id="${p.id}" title="重命名"><svg class="ic xs"><use href="#i-settings"/></svg></span>
      </button>`).join('');

    const pop = document.createElement('div');
    pop.id = 'pf-pop';
    pop.className = 'pop pop-up';
    pop.innerHTML = `<div class="pop-h">本地配置<span>数据互不干扰</span></div>
      <div class="pop-list">${rows}</div>
      <div class="pop-f">
        <button class="pop-btn" data-act="pf-new"><svg class="ic sm"><use href="#i-plus"/></svg>新建配置</button>
        <button class="pop-btn ghost" data-act="pf-export"><svg class="ic sm"><use href="#i-download"/></svg>导出当前</button>
      </div>`;
    document.body.appendChild(pop);
    /* 锚在「配置」按钮上方、向上展开；先量高度再定位，靠近顶部时贴边 */
    const r = chip.getBoundingClientRect();
    const pw = pop.offsetWidth || 302;
    const ph = pop.offsetHeight;
    pop.style.left = Math.max(10, Math.min(Math.round(r.left), window.innerWidth - pw - 10)) + 'px';
    pop.style.top = Math.max(8, Math.round(r.top - ph - 6)) + 'px';
    requestAnimationFrame(() => pop.classList.add('on'));
    chip.classList.add('open');
  };

  function profileModal(p) {
    const isNew = !p;
    const emojis = ['🦊', '🌱', '🚀', '📚', '💼', '🎧', '🧪', '🏔️', '🎯', '🌙', '🧩', '🗂️'];
    TF.modal(isNew ? '新建本地配置' : '编辑配置', `
      <div class="field"><label>名称</label><input type="text" id="pf-name" value="${esc(p ? p.name : '')}" placeholder="例如：工作、个人、某个客户"></div>
      <div class="field"><label>头像</label><div class="emoji-pick" id="pf-emojis">${emojis.map(e => `<button data-e="${e}" class="${(p ? p.emoji : '🦊') === e ? 'on' : ''}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>颜色</label><div class="swatches" id="pf-colors">${TF.colors.map(c => `<div class="sw ${(p ? p.color : TF.colors[0]) === c ? 'on' : ''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div></div>
      ${isNew ? `<label class="pf-demo"><input type="checkbox" id="pf-demo"> 带上示例数据（任务 / 进程 / 习惯）</label>` : ''}
      ${!isNew ? `<div class="field" style="margin-top:14px;color:var(--dan);font-size:12px">删除配置会连同其中的任务一起删除，且不可恢复。</div>` : ''}
    `, [
      ...(isNew ? [] : [{ label: '删除', fn: () => {
        if (S().profiles().length <= 1) return TF.toast('至少保留一个配置');
        if (!confirm(`删除配置「${p.name}」？其中的数据会一起删除。`)) return;
        const id = p.id;
        TF.closeModal(); TF.closeProfileMenu();
        S().deleteProfile(id);
        App.view = { type: 'today' }; App.render();
        TF.toast('配置已删除');
      } }]),
      { label: isNew ? '创建并切换' : '保存', pri: true, fn: () => {
        const nm = document.getElementById('pf-name').value.trim();
        if (!nm) return TF.toast('请输入名称');
        const em = document.querySelector('#pf-emojis button.on');
        const co = document.querySelector('#pf-colors .sw.on');
        if (isNew) {
          const demo = document.getElementById('pf-demo').checked;
          TF.closeModal();
          S().createProfile(nm, em ? em.dataset.e : '🗂️', co ? co.dataset.c : TF.colors[0], demo);
          App.view = { type: 'today' }; App.render();
          TF.toast('已切换到「' + nm + '」');
        } else {
          S().updateProfile(p.id, { name: nm, emoji: em ? em.dataset.e : p.emoji, color: co ? co.dataset.c : p.color });
          TF.closeModal(); TF.closeProfileMenu(); App.render();
        }
      } },
      { label: '取消', fn: TF.closeModal }
    ]);
    document.querySelectorAll('#pf-emojis button').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#pf-emojis button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    }));
    document.querySelectorAll('#pf-colors .sw').forEach(sw => sw.addEventListener('click', () => {
      document.querySelectorAll('#pf-colors .sw').forEach(x => x.classList.remove('on'));
      sw.classList.add('on');
    }));
    setTimeout(() => { const el = document.getElementById('pf-name'); if (el) { el.focus(); el.select(); } }, 60);
  }

  /* ================= 顶栏 ================= */
  const TITLES = {
    inbox: ['收集箱', '所有未完成的任务都在这里'],
    today: ['今天', ''],
    next7: ['最近 7 天', '包含今天起一周内到期的任务'],
    all: ['全部', '按时间分组查看所有未完成任务'],
    completed: ['已完成', '回顾你完成过的事情'],
    timeline: ['今日时间轴', '把排定时刻的任务摆到一天里'],
    calendar: ['日历', '按月份总览任务'],
    quadrants: ['四象限', '重要 / 紧急，自动分桶'],
    process: ['进程', '主线、支线与节点的推进地图'],
    habits: ['习惯', '连续打卡，别断'],
    pomodoro: ['番茄钟', '25 分钟专注，5 分钟休息'],
    stats: ['统计', '你的产出与节奏'],
    wishes: ['愿望', '写下来，慢慢实现']
  };

  const VIEW_GROUP = {
    inbox: '工作台', today: '工作台', next7: '工作台', all: '工作台', completed: '工作台',
    timeline: '视图', calendar: '视图', quadrants: '视图', habits: '视图', stats: '视图', process: '视图',
    wishes: '工具', pomodoro: '工具', list: '清单', day: '日历', search: '搜索'
  };

  function topbarHTML() {
    const v = App.view, d = S().data;
    let title, sub = '', count = '';
    if (v.type === 'list') {
      const l = S().list(v.listId);
      title = l ? l.name : '清单';
      count = countText(v);
    } else if (v.type === 'day') {
      title = TF.cnDate(v.date);
      count = countText(v);
    } else if (v.type === 'wishes') {
      const t = TITLES.wishes;
      title = t[0]; sub = t[1];
      count = countText(v);
    } else {
      const T = TITLES[v.type] || ['', ''];
      title = T[0]; sub = T[1];
      if (['today', 'next7', 'all', 'inbox', 'completed'].includes(v.type)) count = countText(v);
    }
    const isTaskView = ['inbox', 'today', 'next7', 'all', 'completed', 'list', 'day', 'search'].includes(v.type);
    const crumb = VIEW_GROUP[v.type] || '工作台';

    return `<div class="tb-left">
        <span class="tb-crumb">${crumb}</span><span class="tb-sep">/</span>
        <b class="tb-page">${esc(title)}</b>
        ${v.type === 'today' ? `<span class="tb-today">${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日 周${TF.weekNames[new Date().getDay()]}</span>` : ''}
        ${sub && v.type !== 'today' ? `<span class="tb-sub">${esc(sub)}</span>` : ''}
        <span class="tb-count" id="tb-count">${count}</span>
      </div>
      <div class="tb-center">
        <div class="tb-search">
          <svg class="ic sm"><use href="#i-search"/></svg>
          <input id="search" placeholder="搜索任务、标签、备注…" value="${esc(App.search)}" aria-label="搜索任务">
          <span class="kbd">Ctrl K</span>
        </div>
      </div>
      <div class="tb-right">
        ${isTaskView && v.type !== 'search' ? `<select class="tb-sel" id="group-sel" title="分组" aria-label="分组">
            <option value="none" ${App.group === 'none' ? 'selected' : ''}>不分组</option>
            <option value="date" ${App.group === 'date' ? 'selected' : ''}>按日期</option>
            <option value="list" ${App.group === 'list' ? 'selected' : ''}>按清单</option>
            <option value="priority" ${App.group === 'priority' ? 'selected' : ''}>按优先级</option>
          </select>
          <select class="tb-sel" id="sort-sel" title="排序" aria-label="排序">
            <option value="smart" ${App.sort === 'smart' ? 'selected' : ''}>智能排序</option>
            <option value="manual" ${App.sort === 'manual' ? 'selected' : ''}>手动排序</option>
            <option value="priority" ${App.sort === 'priority' ? 'selected' : ''}>优先级</option>
            <option value="created" ${App.sort === 'created' ? 'selected' : ''}>创建时间</option>
            <option value="title" ${App.sort === 'title' ? 'selected' : ''}>标题</option>
          </select>` : ''}
        ${isTaskView && v.type !== 'completed' ? (() => {
          const dn = TF.tasksFor(v).filter(x => x.done).length;
          return `<button class="btn sm tb-flush ${dn ? 'has' : ''}" data-act="flush-done" title="隐藏已完成的任务">
            <svg class="ic sm"><use href="#i-check-circle"/></svg><span>刷新</span>${dn ? `<span class="tb-badge">${dn}</span>` : ''}</button>`;
        })() : ''}
        ${v.type === 'process'
          ? `<button class="btn pri" data-act="new-node"><svg class="ic sm"><use href="#i-plus"/></svg>新建节点</button>`
          : v.type === 'habits'
            ? `<button class="btn pri" data-act="new-habit"><svg class="ic sm"><use href="#i-plus"/></svg>新建习惯</button>`
            : v.type === 'wishes'
              ? `<button class="btn pri" data-act="wish-new"><svg class="ic sm"><use href="#i-plus"/></svg>新建愿望</button>`
              : `<button class="btn pri" data-act="new-task"><svg class="ic sm"><use href="#i-plus"/></svg>新建任务</button>`}
      </div>`;
  }


  /* ================= 任务视图 ================= */
  function taskViewHTML(v) {
    const raw = TF.tasksFor(v);
    const shown = TF.applyTaskFilter(raw);
    const hasFilter = TF.FILTER_VIEWS.includes(v.type);
    let head = '';
    if (hasFilter) {
      const ctx = v.type === 'list' ? { listId: v.listId }
        : v.type === 'day' ? { due: v.date }
          : { due: v.type === 'today' ? TF.today() : '' };
      head = TF.quickAdd({
        listId: ctx.listId || '', due: ctx.due || '', qa: App.qaCtx,
        placeholder: v.type === 'list'
          ? '添加到「' + (S().list(v.listId) || {}).name + '」…'
          : '明天下午3点给张总回邮件 !高 #沟通 @工作'
      });
      head += TF.filterBarHTML(raw);
    }
    if (v.type === 'search') {
      head = `<div class="card" style="margin-bottom:12px;padding:12px 14px;font-size:12.5px;color:var(--tx2)">
        搜索 “<b>${esc(App.search)}</b>” — 找到 ${raw.length} 条结果</div>`;
    }
    const done = v.type === 'completed';
    let body;
    if (shown.length) body = TF.renderList(shown, { empty: done ? '还没有完成记录' : '没有匹配的任务' });
    else if (hasFilter && App.filter !== 'all') body = TF.filterEmptyHTML();
    else if (done) body = TF.emptyBlock('还没有完成记录', '完成第一个任务后会出现在这里');
    else if (v.type === 'search') body = TF.emptyBlock('没有找到', '换个关键词试试');
    else body = TF.emptyBlock('这里很干净', '按 N 或点击上方输入框添加任务');

    return `<div class="wrap">${head}
      <div id="task-list">${body}</div>
      ${done ? '' : `<div style="margin-top:26px;font-size:11.5px;color:var(--tx3);display:flex;gap:14px;flex-wrap:wrap">
        <span id="tv-count">${shown.length} 项待办</span>
        <span><kbd>N</kbd> 新建</span><span><kbd>/</kbd> 搜索</span><span><kbd>Esc</kbd> 关闭面板</span>
      </div>`}
    </div>`;
  }

  /* ================= 任务抽屉 ================= */
  TF.openTask = function (id) {
    const t = S().task(id); if (!t) return;
    App.drawerMode = 'task';
    App.selWish = null;
    App.selTask = id;
    TF.RM.selected = null;
    const box = document.getElementById('drawer');
    box.classList.add('open');
    box.setAttribute('aria-hidden', 'false');
    TF.scrim(true);
    box.innerHTML = taskDrawerHTML(t);
    bindTaskDrawer(t);
    App.render();
  };

  function taskDrawerHTML(t) {
    const listOpts = S().data.lists.map(l => `<option value="${l.id}" ${l.id === t.listId ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
    const subs = (t.subtasks || []).map(s => `<div class="sub-i ${s.done ? 'done' : ''}">
      <div class="cbx" data-act="sub-toggle" data-id="${s.id}"><svg class="ic"><use href="#i-check"/></svg></div>
      <span class="st">${esc(s.title)}</span>
      <button class="icon-btn" data-act="sub-del" data-id="${s.id}"><svg class="ic xs"><use href="#i-x"/></svg></button>
    </div>`).join('');
    const rep = TF.repNorm(t.repeat);
    const tags = (t.tags || []).map(g => `<span class="tag-chip">#${esc(g)}<button data-act="tag-del" data-tag="${esc(g)}"><svg class="ic xs"><use href="#i-x"/></svg></button></span>`).join('');
    const nodeOpts = S().data.processes.map(p => `<optgroup label="${esc(p.name)}">${p.nodes.map(n => {
      const done = n.status === 'done' ? ' ✓' : '';
      return `<option value="${n.id}" ${t.nodeId === n.id ? 'selected' : ''}>${esc(n.title)}${done}</option>`;
    }).join('')}</optgroup>`).join('');

    return `<div class="dw-head">
        <div class="cbx" data-act="toggle" data-id="${t.id}" style="margin-top:0"><svg class="ic"><use href="#i-check"/></svg></div>
        <h2 class="t">${t.done ? '已完成' : '任务详情'}</h2>
        <button class="icon-btn" data-act="del-task" data-id="${t.id}" title="删除"><svg class="ic sm"><use href="#i-trash"/></svg></button>
        <button class="icon-btn" data-act="close-drawer"><svg class="ic"><use href="#i-x"/></svg></button>
      </div>
      <div class="dw-body">
        <textarea class="dw-title" id="dw-title" placeholder="要做什么？">${esc(t.title)}</textarea>
        <div class="dw-row"><span class="lab"><svg class="ic xs"><use href="#i-folder"/></svg>清单</span><span class="val"><select id="dw-list">${listOpts}</select></span></div>
        <div class="dw-row"><span class="lab"><svg class="ic xs"><use href="#i-calendar"/></svg>日期</span><span class="val">
          <input type="date" id="dw-due" value="${t.due || ''}">
          ${t.due ? `<button class="btn sm ghost" data-act="clear-due">清除</button>` : ''}
        </span></div>
        <div class="dw-row" style="align-items:flex-start">
          <span class="lab" style="padding-top:6px"><svg class="ic xs"><use href="#i-clock"/></svg>时间</span>
          <span class="val" style="flex-direction:column;align-items:flex-start;gap:8px">
            <div class="seg" id="dw-tmode">
              <button data-v="none" class="${!t.dueTime ? 'on' : ''}">不设</button>
              <button data-v="point" class="${t.dueTime && !t.dueEnd ? 'on' : ''}">时间点</button>
              <button data-v="range" class="${t.dueEnd ? 'on' : ''}">时段</button>
            </div>
            ${t.dueTime ? `<div class="time-line">
              <input type="time" id="dw-time" value="${t.dueTime}">
              ${t.dueEnd ? `<span style="color:var(--tx3)">–</span><input type="time" id="dw-time-end" value="${t.dueEnd}">` : ''}
              <span class="tl-hint">${t.dueEnd ? '时段' : '具体时刻'}</span>
            </div>` : `<span class="tl-hint">只看日期，不设具体时刻</span>`}
          </span>
        </div>
        <div class="dw-row"><span class="lab"><svg class="ic xs"><use href="#i-flag"/></svg>优先级</span><span class="val">
          <div class="seg" id="dw-pri">
            <button data-v="0" class="${t.priority === 0 ? 'on' : ''}">无</button>
            <button data-v="1" class="${t.priority === 1 ? 'on p1' : ''}">低</button>
            <button data-v="2" class="${t.priority === 2 ? 'on p2' : ''}">中</button>
            <button data-v="3" class="${t.priority === 3 ? 'on p3' : ''}">高</button>
          </div>
        </span></div>
        <div class="dw-row" style="align-items:flex-start">
          <span class="lab" style="padding-top:6px"><svg class="ic xs"><use href="#i-repeat"/></svg>重复</span>
          <span class="val" style="flex-direction:column;align-items:flex-start;gap:7px">
            <select id="dw-repeat">
              <option value="" ${!t.repeat ? 'selected' : ''}>不重复</option>
              <option value="daily" ${rep && rep.type === 'daily' ? 'selected' : ''}>每天</option>
              <option value="weekday" ${rep && rep.type === 'weekday' ? 'selected' : ''}>工作日</option>
              <option value="weekly" ${rep && rep.type === 'weekly' ? 'selected' : ''}>每周</option>
              <option value="monthly" ${rep && rep.type === 'monthly' ? 'selected' : ''}>每月</option>
            </select>
            ${rep && rep.type === 'weekly' ? `<div class="wd-pick" id="wd-pick">
              ${[[1, '一'], [2, '二'], [3, '三'], [4, '四'], [5, '五'], [6, '六'], [0, '日']].map(([d, n]) =>
                `<button data-wd="${d}" class="${rep.days.includes(d) ? 'on' : ''}">${n}</button>`).join('')}
            </div>` : ''}
            ${rep ? `<div class="seg" id="dw-rmode">
              <button data-v="fixed" class="${rep.mode !== 'after' ? 'on' : ''}">按计划</button>
              <button data-v="after" class="${rep.mode === 'after' ? 'on' : ''}">完成后顺延</button>
            </div>` : ''}
          </span>
        </div>
        <div class="dw-row"><span class="lab"><svg class="ic xs"><use href="#i-lock"/></svg>前置依赖</span><span class="val">
          <button class="btn sm" data-act="dep-pick">${(t.blockedBy || []).length ? `等待 ${(t.blockedBy || []).length} 项` : '无依赖'}</button>
          ${(t.blockedBy || []).length ? `<span style="font-size:11px;color:var(--tx3)">完成前会被标记为阻塞</span>` : ''}
        </span></div>
        <div class="dw-row"><span class="lab"><svg class="ic xs"><use href="#i-map"/></svg>进程节点</span><span class="val">
          <select id="dw-node"><option value="">不关联</option>${nodeOpts}</select>
        </span></div>
        <div class="dw-row" style="align-items:flex-start"><span class="lab" style="padding-top:5px"><svg class="ic xs"><use href="#i-tag"/></svg>标签</span>
          <span class="val"><div class="chip-in">${tags}<input id="dw-tag" placeholder="加标签，回车" style="width:96px;font-size:12.5px"></div></span></div>

        <div class="dw-sec">
          <h3 class="dw-sec-h">子任务 <span style="color:var(--tx3);font-weight:400">${(t.subtasks || []).filter(s => s.done).length}/${(t.subtasks || []).length}</span>
            <span class="r"><button class="btn sm ghost" data-act="sub-add">+ 添加</button></span></h3>
          ${subs || `<div style="font-size:12px;color:var(--tx3);padding:2px">拆成小步骤更容易开始</div>`}
        </div>

        <div class="dw-sec">
          <h3 class="dw-sec-h">备注</h3>
          <textarea class="dw-note" id="dw-notes" placeholder="补充信息、链接、想法…">${esc(t.notes || '')}</textarea>
        </div>
      </div>
      <div class="dw-foot">
        <span>创建于 ${new Date(t.createdAt).toLocaleDateString('zh-CN')}</span>
        ${t.doneAt ? `<span>· 完成于 ${new Date(t.doneAt).toLocaleDateString('zh-CN')}</span>` : ''}
        ${t.pomo ? `<span>· 🍅 ${t.pomo}</span>` : ''}
        <button class="btn sm ghost" style="margin-left:auto" data-act="copy-task">复制任务</button>
        <button class="btn sm ghost" data-act="close-drawer">关闭</button>
      </div>`;
  }

  function bindTaskDrawer(t) {
    const box = document.getElementById('drawer');
    const ti = box.querySelector('#dw-title');
    const auto = () => { ti.style.height = 'auto'; ti.style.height = ti.scrollHeight + 'px'; };
    setTimeout(auto, 0);
    ti.addEventListener('input', () => {
      t.title = ti.value; S().save(); auto();
      const row = document.querySelector('.task[data-open="' + t.id + '"] .t-title > span');
      if (row) row.textContent = t.title;
    });
    box.querySelector('#dw-list').addEventListener('change', e => { t.listId = e.target.value; S().save(); App.render(); });
    box.querySelector('#dw-due').addEventListener('change', e => { t.due = e.target.value || null; S().save(); TF.openTask(t.id); });
    const wt = box.querySelector('#dw-time');
    if (wt) wt.addEventListener('change', e => { t.dueTime = e.target.value || t.dueTime; S().save(); App.render(); });
    const we = box.querySelector('#dw-time-end');
    if (we) we.addEventListener('change', e => { t.dueEnd = e.target.value || t.dueEnd; S().save(); App.render(); });
    box.querySelectorAll('#dw-tmode button').forEach(b => b.addEventListener('click', () => {
      const m = b.dataset.v;
      if (m === 'none') { t.dueTime = null; t.dueEnd = null; }
      if (m === 'point') { t.dueTime = t.dueTime || '09:00'; t.dueEnd = null; }
      if (m === 'range') { t.dueTime = t.dueTime || '09:00'; t.dueEnd = t.dueEnd || '10:00'; }
      S().save(); TF.openTask(t.id);
    }));
    box.querySelector('#dw-repeat').addEventListener('change', e => {
      const v = e.target.value;
      t.repeat = v ? { type: v, days: v === 'weekly' ? [TF.parseDate(t.due || TF.today()).getDay()] : [], mode: (TF.repNorm(t.repeat) || {}).mode || 'fixed' } : null;
      S().save(); TF.openTask(t.id);
    });
    box.querySelectorAll('#wd-pick button').forEach(b => b.addEventListener('click', () => {
      const d = +b.dataset.wd;
      const r0 = TF.repNorm(t.repeat) || { type: 'weekly', days: [], mode: 'fixed' };
      r0.days = r0.days.includes(d) ? r0.days.filter(x => x !== d) : r0.days.concat([d]);
      t.repeat = r0; S().save(); TF.openTask(t.id);
    }));
    box.querySelectorAll('#dw-rmode button').forEach(b => b.addEventListener('click', () => {
      const r0 = TF.repNorm(t.repeat) || { type: 'daily', days: [], mode: 'fixed' };
      r0.mode = b.dataset.v; t.repeat = r0; S().save(); TF.openTask(t.id);
    }));
    box.querySelector('#dw-node').addEventListener('change', e => { t.nodeId = e.target.value || null; S().save(); App.render(); });
    box.querySelector('#dw-notes').addEventListener('input', e => { t.notes = e.target.value; S().save(); });
    box.querySelectorAll('#dw-pri button').forEach(b => b.addEventListener('click', () => {
      t.priority = +b.dataset.v; S().save(); TF.openTask(t.id);
    }));
    const tagIn = box.querySelector('#dw-tag');
    tagIn.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const v = tagIn.value.trim().replace(/^#/, '');
      if (v && !t.tags.includes(v)) { t.tags.push(v); S().save(); TF.openTask(t.id); }
      tagIn.value = '';
    });
    /* Ctrl/Cmd+Enter 完成任务：与勾选复选框走同一条流程（含重复顺延）。
       isComposing 保护是硬要求 —— 中文输入法用回车确认候选词时不能误完成。 */
    box.addEventListener('keydown', ev => {
      if (ev.isComposing || ev.keyCode === 229) return;
      if (!(ev.ctrlKey || ev.metaKey) || ev.key !== 'Enter') return;
      ev.preventDefault();
      handleAct({ dataset: { act: 'toggle', id: t.id } }, ev);
    });
  }

  /* 复制任务：字段保留规则见 DESIGN §5.4.6；不复制 repeat / 依赖 / 进程节点 */
  TF.copyTask = function (id) {
    const t = S().task(id);
    if (!t) return null;
    return S().addTask({
      title: t.title,
      listId: t.listId,
      notes: t.notes || '',
      due: t.due || null,
      dueTime: t.dueTime || null,
      dueEnd: t.dueEnd || null,
      priority: t.priority || 0,
      tags: [].concat(t.tags || []),
      subtasks: (t.subtasks || []).map(s => ({ id: TF.uid('s'), title: s.title, done: false })),
      repeat: null,
      done: false,
      doneAt: null,
      notifiedOn: null,
      nodeId: null,
      blockedBy: [],
      pomo: 0,
      order: 0
    });
  };

  TF.closeDrawer = function () {
    const box = document.getElementById('drawer');
    if (App.drawerMode === 'wish' && TF.closeWishDrawer) TF.closeWishDrawer();
    box.classList.remove('open');
    TF.scrim(false);
    box.setAttribute('aria-hidden', 'true');
    /* 双模式统一清理（R-04：三个字段必须同帧清，否则下次开抽屉会走错分支） */
    App.selTask = null;
    App.selWish = null;
    App.drawerMode = null;
    TF.RM.selected = null;
    setTimeout(() => { if (!box.classList.contains('open')) box.innerHTML = ''; }, 240);
    App.render();
  };

  /* ================= 任务行「⋯」快捷菜单 ================= */
  TF.closeRowMenu = function () {
    const m = document.getElementById('row-menu');
    if (m) m.remove();
    document.querySelectorAll('.task.menu-on').forEach(x => x.classList.remove('menu-on'));
    document.querySelectorAll('[data-act="row-menu"].active').forEach(x => x.classList.remove('active'));
    App.rowMenuTask = null;
  };

  TF.openRowMenu = function (id, anchor) {
    TF.closeRowMenu();
    if (!id || !anchor) return;
    const t = S().task(id);
    if (!t) return;
    App.rowMenuTask = id;
    const el = document.createElement('div');
    el.id = 'row-menu';
    el.className = 'pop row-menu';
    el.setAttribute('role', 'menu');
    el.innerHTML = `<button class="row-mi" role="menuitem" data-act="row-today" data-id="${id}">今天</button>
      <button class="row-mi" role="menuitem" data-act="row-tomorrow" data-id="${id}">明天</button>
      <button class="row-mi" role="menuitem" data-act="row-week" data-id="${id}">本周</button>
      <span class="row-sep"></span>
      <button class="row-mi" role="menuitem" data-act="row-done" data-id="${id}">完成</button>
      <button class="row-mi danger" role="menuitem" data-act="row-del" data-id="${id}">删除</button>
      <span class="row-sep"></span>
      <button class="row-mi" role="menuitem" data-act="row-open" data-id="${id}">打开详情</button>`;
    document.body.appendChild(el);

    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth || 172;
    const h = el.offsetHeight || 232;
    let left = r.right + 6;
    if (left + w > window.innerWidth - 8) left = Math.max(8, r.left - w - 6);
    const top = Math.max(8, Math.min(r.top - 4, window.innerHeight - h - 8));
    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(top) + 'px';
    requestAnimationFrame(() => el.classList.add('on'));
    anchor.classList.add('active');
    const row = document.querySelector('.task[data-open="' + id + '"]');
    if (row) row.classList.add('menu-on');
  };

  /* ================= 弹窗 ================= */
  TF.modal = function (title, body, buttons) {
    const host = document.getElementById('modal-host');
    host.classList.add('open');
    host.innerHTML = `<div class="modal">
      <h2 class="modal-h">${esc(title)}</h2>
      <div class="modal-b">${body}</div>
      <div class="modal-f">${(buttons || []).map((b, i) => `<button class="btn ${b.pri ? 'pri' : ''}" data-mbtn="${i}">${esc(b.label)}</button>`).join('')}</div>
    </div>`;
    (buttons || []).forEach((b, i) => {
      host.querySelector(`[data-mbtn="${i}"]`).addEventListener('click', b.fn);
    });
    host.onclick = e => { if (e.target === host) TF.closeModal(); };
  };
  TF.closeModal = function () {
    const host = document.getElementById('modal-host');
    if (!host.classList.contains('open')) return;
    host.classList.remove('open');
    setTimeout(() => {
      if (!host.classList.contains('open')) host.innerHTML = '';
    }, 220);
  };

  /* 遮罩显隐。rAF 延迟点亮是为了拿到 0→1 的过渡；
     若同一帧内先 scrim(true) 再 scrim(false)（如愿望面板里"打开→立即删除关闭"），
     必须用 wantOn 拦掉迟到的 rAF，否则遮罩会永久留在主内容区上。 */
  let scrimWant = false;
  TF.scrim = function (on) {
    scrimWant = !!on;
    let s = document.getElementById('scrim');
    if (on) {
      if (!s) {
        s = document.createElement('div');
        s.id = 'scrim';
        s.className = 'scrim';
        s.addEventListener('click', () => TF.closeDrawer());
        document.body.appendChild(s);
      }
      requestAnimationFrame(() => {
        if (!scrimWant) return;
        const x = document.getElementById('scrim');
        if (x) x.classList.add('on');
      });
    } else if (s) {
      s.classList.remove('on');
      setTimeout(() => {
        const x = document.getElementById('scrim');
        if (x && !x.classList.contains('on') && !scrimWant) x.remove();
      }, 260);
    }
  };

  /* toast 三态：success（默认，向后兼容）/ warn / info。同一时刻最多 3 条，超出丢最旧 */
  TF.toast = function (msg, tone) {
    const wrap = document.getElementById('toast-wrap');
    if (!wrap) return;
    const t = tone === 'warn' || tone === 'info' ? tone : 'success';
    while (wrap.children.length >= 3) wrap.removeChild(wrap.firstChild);
    const el = document.createElement('div');
    el.className = 'toast toast-' + t;
    const icon = t === 'warn' ? '<svg class="ic sm"><use href="#i-alert"/></svg>'
      : t === 'info' ? '<i class="toast-dot"></i>'
        : '<svg class="ic sm"><use href="#i-check"/></svg>';
    el.innerHTML = icon + '<span>' + esc(msg) + '</span>';
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    }, t === 'warn' ? 2600 : 2000);
  };

  TF.beep = function () {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 660;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.52);
      setTimeout(() => ctx.close(), 900);
    } catch (e) { }
  };

  /* ================= 设置 ================= */
  /* v1.13：设置改为全屏 #settings-view（左分类 + 右卡片），实现在 settings.js。
     app.js 只保留入口 TF.openSettings 的兜底与底部岛开关。 */

  /* 外观委托：12 处既有调用点不动，实现全部搬到 theme.js / appearance.js（D-4 / §5.2.4） */
  function applyTheme() {
    const root = document.documentElement;
    root.dataset.density = S().data.settings.density === 'compact' ? 'compact' : 'normal';
    TF.applyTheme();
    syncFxFlags();
  }

  /* 特效开关：外观设置 → html 上的 fx-* class（CSS 里没有设置也安全） */
  function syncFxFlags() {
    const a = TF.getAppearance ? TF.getAppearance() : { highlight: true };
    document.documentElement.classList.toggle('fx-highlight', !!a.highlight);
  }

  /* 侧栏/顶栏跟随鼠标高光（点击特效已移除，保留高光） */
  function initEffects() {
    syncFxFlags();
    document.addEventListener('tf:appearance', syncFxFlags);
    const move = e => {
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    };
    const side = document.getElementById('sidebar');
    const top = document.getElementById('topbar');
    if (side) side.addEventListener('mousemove', move);
    if (top) top.addEventListener('mousemove', move);

    /* 键盘可访问：侧栏 role=button 的行支持 Enter / Space（T1.12） */
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tg = e.target;
      if (!tg || typeof tg.closest !== 'function') return;
      const it = tg.closest('.sb-item[role="button"]');
      if (!it) return;
      e.preventDefault();
      it.click();
    });
  }

  /* 命令面板「切换外观」：循环 9 套配色（保持当前明暗） */
  TF.cycleTheme = function () {
    const ids = TF.SCHEME_IDS || ['kun-default'];
    const cur = TF.getAppearance().scheme;
    const i = Math.max(0, ids.indexOf(cur));
    TF.applyAppearance({ scheme: ids[(i + 1) % ids.length] }, { anim: true });
    TF.toast('配色：' + ids[(i + 1) % ids.length]);
  };
  TF.cycleDensity = function () {
    S().data.settings.density = (S().data.settings.density === 'compact') ? 'normal' : 'compact';
    S().save(); applyTheme(); App.render();
    TF.toast('密度：' + (S().data.settings.density === 'compact' ? '紧凑' : '标准'), 'info');
  };


  /* ================= 事件 ================= */
  function handleAct(el, e) {
    const act = el.dataset.act, id = el.dataset.id;
    const v = App.view;
    switch (act) {
      case 'profile-menu': TF.openProfileMenu(); break;
      case 'pf-switch': {
        const id = el.dataset.id;
        TF.closeProfileMenu();
        if (S().switchProfile(id)) {
          App.view = { type: 'today' }; App.selTask = null;
          applyTheme(); App.render();
          TF.toast('已切换到「' + S().activeProfile().name + '」');
        }
        break;
      }
      case 'pf-edit': {
        e.stopPropagation();
        const p = S().profiles().find(x => x.id === el.dataset.id);
        TF.closeProfileMenu();
        if (p) setTimeout(() => profileModal(p), 140);
        break;
      }
      case 'pf-new': TF.closeProfileMenu(); setTimeout(() => profileModal(null), 140); break;
      case 'pf-export': TF.closeProfileMenu(); S().flush(); S().exportJSON(); TF.toast('已导出当前配置'); break;
      case 'nav': {
        const view = el.dataset.view;
        if (view === 'list') App.view = { type: 'list', listId: el.dataset.list };
        else if (view === 'process') { if (el.dataset.id) TF.RM.processId = el.dataset.id; App.view = { type: 'process' }; }
        else App.view = { type: view };
        App.group = { all: 'date', today: 'date', next7: 'date', inbox: 'none', list: 'none', completed: 'none', wishes: 'none' }[view] || App.group;
        App.search = '';
        App.stagger = true;
        /* 切视图重置瞬时筛选与粘性 chip，避免带着隐形上下文进新视图 */
        App.filter = 'all';
        App.qaCtx = { today: false, tomorrow: false, high: false };
        if (view !== 'process') TF.closeDrawer();
        App.render();
        break;
      }
      case 'toggle': {
        const r = S().toggleTask(id);
        if (r && r.next) TF.toast('已完成后自动生成下一次：' + TF.cnDate(r.next.due));
        /* A1：勾选完成的对勾与淡出反馈（重绘前打标，重绘后自动带上 .just-done） */
        App._justDone = id;
        setTimeout(() => { if (App._justDone === id) App._justDone = null; }, 400);
        if (App.selTask) { const t = S().task(App.selTask); if (t) TF.openTask(t.id); else App.render(); }
        else App.renderListOnly();
        break;
      }
      case 'del-task': {
        if (!confirm('删除这个任务？')) return;
        S().removeTask(id);
        if (App.selTask === id) TF.closeDrawer(); else App.render();
        TF.toast('已删除');
        break;
      }
      case 'postpone': {
        const t = S().task(id); if (!t) return;
        t.due = t.due ? TF.addDays(t.due, 1) : TF.today();
        S().save(); App.render(); TF.toast('推迟到 ' + TF.cnDate(t.due));
        break;
      }
      case 'dep-pick': {
        const t = S().task(App.selTask); if (!t) return;
        const cand = S().data.tasks.filter(x => x.id !== t.id && !x.done).slice(0, 60);
        TF.modal('设置前置依赖', `
          <div class="field"><label>等这些任务完成后才能做</label>
            <input type="text" id="dep-q" placeholder="搜索任务…" style="margin-bottom:8px">
            <div class="dep-pick-list" id="dep-list">
              ${cand.map(x => `<label class="dep-i ${(t.blockedBy || []).includes(x.id) ? 'on' : ''}" data-id="${x.id}" data-t="${esc(x.title.toLowerCase())}">
                <span class="bx"><svg class="ic"><use href="#i-check"/></svg></span>
                <span class="nm">${esc(x.title)}</span>
                <span class="st">${esc((S().list(x.listId) || {}).name || '')}</span>
              </label>`).join('') || '<div style="padding:8px;font-size:12px;color:var(--tx3)">没有可选任务</div>'}
            </div></div>
        `, [{ label: '完成', pri: true, fn: () => {
          const ids = [].slice.call(document.querySelectorAll('#dep-list .dep-i.on')).map(x => x.dataset.id);
          t.blockedBy = ids; S().save(); TF.closeModal(); TF.openTask(t.id); App.render();
        } }, { label: '取消', fn: TF.closeModal }]);
        document.getElementById('dep-q').addEventListener('input', e => {
          const q = e.target.value.toLowerCase();
          document.querySelectorAll('#dep-list .dep-i').forEach(x => {
            x.style.display = !q || x.dataset.t.includes(q) ? '' : 'none';
          });
        });
        document.querySelectorAll('#dep-list .dep-i').forEach(x => x.addEventListener('click', e => {
          e.preventDefault(); x.classList.toggle('on');
        }));
        break;
      }
      case 'flush-done': {
        const n = TF.tasksFor(App.view).filter(x => x.done).length;
        App.hideDoneBefore = Date.now();
        App.render();
        TF.toast(n ? `已隐藏 ${n} 项已完成` : '没有需要隐藏的任务');
        break;
      }
      case 'new-task': {
        const qa = document.getElementById('qa-input');
        if (qa) { qa.focus(); qa.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        else { App.view = { type: 'today' }; App.render(); setTimeout(() => { const q = document.getElementById('qa-input'); if (q) q.focus(); }, 30); }
        break;
      }
      case 'new-list': {
        TF.modal('新建清单', `<div class="field"><label>名称</label><input type="text" id="nl-name" placeholder="例如：读书计划"></div>
          <div class="field"><label>颜色</label><div class="swatches" id="nl-colors">${TF.colors.map((c, i) => `<div class="sw ${i === 0 ? 'on' : ''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div></div>`,
          [{ label: '创建', pri: true, fn: () => {
            const nm = document.getElementById('nl-name').value.trim();
            if (!nm) return TF.toast('请输入清单名称');
            const c = document.querySelector('#nl-colors .sw.on').dataset.c;
            const l = S().addList(nm, c);
            TF.closeModal(); App.view = { type: 'list', listId: l.id }; App.render();
          } }, { label: '取消', fn: TF.closeModal }]);
        document.querySelectorAll('#nl-colors .sw').forEach(sw => sw.addEventListener('click', () => {
          document.querySelectorAll('#nl-colors .sw').forEach(x => x.classList.remove('on')); sw.classList.add('on');
        }));
        setTimeout(() => document.getElementById('nl-name').focus(), 50);
        break;
      }
      case 'del-list': {
        e.stopPropagation();
        const l = S().list(id); if (!l) return;
        if (l.inbox) return TF.toast('收集箱不能删除');
        if (S().data.lists.length <= 1) return TF.toast('至少保留一个清单');
        if (!confirm(`删除清单「${l.name}」？其中的任务也会被删除。`)) return;
        S().removeList(id);
        if (v.type === 'list' && v.listId === id) App.view = { type: 'today' };
        App.render();
        break;
      }
      case 'cal-prev': case 'cal-next': {
        const [y, m] = App.calMonth.split('-').map(Number);
        const d2 = new Date(y, m - 1 + (act === 'cal-next' ? 1 : -1), 1);
        App.calMonth = TF.ymd(d2).slice(0, 7); App.render(); break;
      }
      case 'cal-today': App.calMonth = TF.today().slice(0, 7); App.render(); break;
      case 'close-drawer': TF.closeDrawer(); break;
      case 'theme-open': {
        if (e && e.stopPropagation) e.stopPropagation();
        TF.openThemePopover(el);
        break;
      }
      case 'theme-pick': TF.setTheme(el.dataset.themeId); break;
      case 'accent-pick': TF.setAccent(el.dataset.accentId); break;
      case 'set-density': {
        const dens = el.dataset.v === 'compact' ? 'compact' : 'normal';
        S().data.settings.density = dens;
        S().save();
        applyTheme();
        document.querySelectorAll('#set-density button').forEach(b => b.classList.toggle('on', b.dataset.v === dens));
        break;
      }
      /* --- 右栏 / 状态栏 --- */
      case 'rail-search': {
        const sb = document.getElementById('search');
        if (sb) { sb.focus(); sb.select(); }
        break;
      }
      case 'rail-palette':
      case 'palette': {
        if (document.getElementById('pal')) TF.closePalette();
        else if (typeof TF.openPalette === 'function') TF.openPalette();
        break;
      }
      case 'rail-focus':
      case 'st-focus': {
        App.view = { type: 'pomodoro' };
        App.render();
        if (typeof TF.pomoStart === 'function') TF.pomoStart();
        break;
      }
      case 'rail-collapse': {
        const shell = document.getElementById('app-shell');
        if (shell) shell.classList.toggle('sb-collapsed');
        break;
      }
      case 'appearance-open': TF.openSettings('appearance'); break;
      case 'settings': TF.openSettings(); break;
      case 'help': {
        TF.modal('使用说明', `<div class="help-list">
          <div><b>N</b><span>新建任务（聚焦快速添加）</span></div>
          <div><b>Ctrl + K</b><span>命令面板</span></div>
          <div><b>/</b><span>聚焦搜索框</span></div>
          <div><b>Ctrl + Alt + Space</b><span>全局快速捕获</span></div>
          <div><b>Esc</b><span>关闭抽屉 / 弹窗 / 面板</span></div>
          <div style="border:0;padding-top:10px;color:var(--text-3)">数据只存在本机；换设备或重置前请先导出 JSON 备份。</div>
        </div>`, [{ label: '知道了', pri: true, fn: TF.closeModal }]);
        break;
      }
      case 'ask-notify': {
        if (!window.Notification) return TF.toast('当前浏览器不支持系统通知');
        Notification.requestPermission().then(p => {
          TF.toast(p === 'granted' ? '系统通知已开启' : '未授权，将只在应用内提醒');
          if (TF.Settings && TF.Settings.open) TF.renderSettingsIfOpen();
        });
        break;
      }
      case 'snap-now': S().snapshot(false); TF.toast('已保存一份本地快照'); break;
      case 'snap-list': {
        const arr = S().snaps();
        if (!arr.length) return TF.toast('还没有快照');
        TF.modal('恢复本地快照', `
          <div class="snap-list">${arr.map((x, i) => `<div class="snap-i">
            <div class="snap-t"><b>${x.d}</b><span>${new Date(x.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · ${(x.data.tasks || []).length} 个任务</span></div>
            <button class="btn sm" data-snap="${x.ts}">恢复</button>
          </div>`).join('')}</div>
          <div style="font-size:11.5px;color:var(--tx3);margin-top:10px">恢复会覆盖当前配置的数据，且会先把当前状态另存为一份快照。</div>
        `, [{ label: '关闭', fn: TF.closeModal }]);
        document.querySelectorAll('[data-snap]').forEach(b => b.addEventListener('click', () => {
          if (!confirm('用这份快照覆盖当前数据？')) return;
          const ok = S().restoreSnapshot(+b.dataset.snap);
          TF.closeModal();
          if (ok) { App.view = { type: 'today' }; App.render(); TF.toast('已恢复快照'); }
          else TF.toast('恢复失败');
        }));
        break;
      }
      case 'export': S().exportJSON(); TF.toast('已导出备份文件'); break;
      case 'export-md': S().exportMarkdown(); TF.toast('已导出 Markdown'); break;
      case 'export-csv': S().exportCSV(); TF.toast('已导出 CSV'); break;
      case 'import-csv': {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.csv,text/csv';
        inp.onchange = () => {
          const f = inp.files[0]; if (!f) return;
          const fr = new FileReader();
          fr.onload = () => {
            try {
              const n = S().importCSV(String(fr.result));
              TF.closeModal(); App.render();
              TF.toast(n ? `已导入 ${n} 条任务` : '没有识别到任务，请检查表头');
            } catch (err) { TF.toast('导入失败：' + err.message); }
          };
          fr.readAsText(f, 'utf-8');
        };
        inp.click(); break;
      }
      case 'import': {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.json,application/json';
        inp.onchange = () => {
          const f = inp.files[0]; if (!f) return;
          const fr = new FileReader();
          fr.onload = () => {
            try { S().importJSON(fr.result); TF.closeModal(); applyTheme(); App.render(); TF.toast('导入成功'); }
            catch (err) { TF.toast('导入失败：' + err.message); }
          };
          fr.readAsText(f);
        };
        inp.click(); break;
      }
      case 'reset': {
        if (!confirm('确定重置？所有本地数据会被示例数据替换。')) return;
        S().reset(); TF.closeModal(); applyTheme(); App.view = { type: 'today' }; App.render(); TF.toast('已重置'); break;
      }
      /* --- 子任务 --- */
      case 'sub-toggle': {
        const t = S().task(App.selTask); if (!t) return;
        const s = t.subtasks.find(x => x.id === id); if (!s) return;
        s.done = !s.done;
        if (t.done !== (t.subtasks.every(x => x.done))) { /* 保持手动 */ }
        S().save(); TF.openTask(t.id); break;
      }
      case 'sub-del': {
        const t = S().task(App.selTask); if (!t) return;
        t.subtasks = t.subtasks.filter(x => x.id !== id); S().save(); TF.openTask(t.id); break;
      }
      case 'sub-add': {
        const t = S().task(App.selTask); if (!t) return;
        const s = { id: TF.uid('s'), title: '新子任务', done: false };
        t.subtasks.push(s); S().save(); TF.openTask(t.id);
        setTimeout(() => {
          const box = document.querySelectorAll('#drawer .sub-i .st');
          const last = box[box.length - 1];
          if (!last) return;
          const inp = document.createElement('input');
          inp.value = s.title; inp.style.width = '100%'; inp.style.fontSize = '13px';
          last.replaceWith(inp); inp.focus(); inp.select();
          const fin = () => { const vv = inp.value.trim() || '新子任务'; const tt = S().task(App.selTask); const ss = tt.subtasks.find(x => x.id === s.id); ss.title = vv; S().save(); TF.openTask(tt.id); };
          inp.addEventListener('blur', fin);
          inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { inp.blur(); } });
        }, 30);
        break;
      }
      case 'clear-due': { const t = S().task(App.selTask); t.due = null; S().save(); TF.openTask(t.id); break; }
      case 'tag-del': {
        const t = S().task(App.selTask); if (!t) return;
        t.tags = t.tags.filter(x => x !== el.dataset.tag); S().save(); TF.openTask(t.id); break;
      }
      /* --- 进程 --- */
      case 'rm-switch': TF.RM.processId = id; TF.RM.selected = null; App.render(); break;
      case 'rm-layout': TF.rmAutoLayout(); TF.toast('已重新排列'); break;
      case 'rm-zoom-in': TF.rmZoom(0.1); break;
      case 'rm-zoom-out': TF.rmZoom(-0.1); break;
      case 'rm-zoom-fit': {
        const p = TF.curProcess();
        const wrap = document.getElementById('rm-wrap');
        if (p && wrap) {
          const need = Math.max(1, ...p.lanes.map(l => p.nodes.filter(n => n.laneId === l.id).length)) * TF.RM_STEP + 104;
          TF.RM.userZoom = true;
          TF.RM.zoom = Math.max(0.5, Math.min(1.2, Math.round((wrap.clientWidth - 12) / need * 10) / 10));
          App.render();
        }
        break;
      }
      case 'tpl': TF.openTemplates(); break;
      case 'new-process': TF.modalProcess(null); break;
      case 'rm-edit-process': TF.modalProcess(TF.curProcess()); break;
      case 'new-node': TF.modalNode(TF.curProcess()); break;
      case 'node-toggle': {
        e.stopPropagation();
        const n = S().node(id); if (!n) return;
        n.status = n.status === 'done' ? 'auto' : 'done';
        if (n.status === 'done') (n.checklist || []).forEach(c => c.done = true);
        S().save(); App.render(); if (TF.RM.selected === id) TF.openNode(id);
        break;
      }
      case 'node-dep': {
        const n = S().node(TF.RM.selected); if (!n) return;
        const rid = id;
        n.requires = n.requires || [];
        if (n.requires.includes(rid)) n.requires = n.requires.filter(x => x !== rid);
        else n.requires.push(rid);
        S().save(); TF.openNode(n.id); break;
      }
      case 'ck-toggle': {
        const n = S().node(TF.RM.selected); if (!n) return;
        const c = n.checklist.find(x => x.id === id); if (!c) return;
        c.done = !c.done;
        if (c.taskId) { const t = S().task(c.taskId); if (t && t.done !== c.done) { t.done = c.done; t.doneAt = c.done ? new Date().toISOString() : null; } }
        S().save(); TF.openNode(n.id); break;
      }
      case 'ck-del': {
        const n = S().node(TF.RM.selected); if (!n) return;
        n.checklist = n.checklist.filter(x => x.id !== id); S().save(); TF.openNode(n.id); break;
      }
      case 'ck-add': {
        const n = S().node(TF.RM.selected); if (!n) return;
        n.checklist = n.checklist || [];
        n.checklist.push({ id: TF.uid('s'), title: '新检查项', done: false, taskId: null });
        S().save(); TF.openNode(n.id);
        setTimeout(() => {
          const items = document.querySelectorAll('#drawer .ck-i .t');
          const last = items[items.length - 1];
          if (!last) return;
          const inp = document.createElement('input');
          inp.value = '新检查项'; inp.style.width = '100%'; inp.style.fontSize = '13px';
          last.replaceWith(inp); inp.focus(); inp.select();
          inp.addEventListener('blur', () => {
            const vv = inp.value.trim() || '检查项';
            const nn = S().node(TF.RM.selected);
            nn.checklist[nn.checklist.length - 1].title = vv;
            S().save(); TF.openNode(nn.id);
          });
          inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') inp.blur(); });
        }, 30);
        break;
      }
      case 'ck-to-tasks': {
        const n = S().node(id); if (!n) return;
        const p = S().nodeProcess(n.id);
        let count = 0;
        n.checklist.forEach(c => {
          if (c.done || c.taskId) return;
          const t = S().addTask({ title: c.title, listId: (S().data.lists[0] || {}).id, nodeId: n.id, due: n.due || null, tags: ['进程'] });
          c.taskId = t.id; count++;
        });
        S().save(); TF.toast(count ? `已生成 ${count} 个任务` : '没有可生成的检查项');
        TF.openNode(n.id); break;
      }
      case 'node-del': {
        if (!confirm('删除该节点？依赖它的节点会自动解除依赖。')) return;
        S().removeNode(id); TF.closeDrawer(); App.render(); TF.toast('节点已删除'); break;
      }
      case 'node-clear-due': { const n = S().node(TF.RM.selected); n.due = null; S().save(); TF.openNode(n.id); break; }
      case 'node-auto': { const n = S().node(id); n.status = 'auto'; S().save(); TF.openNode(n.id); break; }
      /* --- 习惯 --- */
      case 'habit-toggle': S().toggleHabit(id, el.dataset.day); App.render(); break;
      case 'habit-del': {
        if (!confirm('删除这个习惯？')) return;
        S().data.habits = S().data.habits.filter(h => h.id !== id); S().save(); App.render(); break;
      }
      case 'new-habit': {
        TF.modal('新建习惯', `<div class="field"><label>名称</label><input type="text" id="nh-name" placeholder="例如：每天读 20 页"></div>
          <div class="field"><label>图标（emoji）</label><input type="text" id="nh-icon" value="✅" style="width:70px;text-align:center"></div>
          <div class="field"><label>颜色</label><div class="swatches" id="nh-colors">${TF.colors.map((c, i) => `<div class="sw ${i === 0 ? 'on' : ''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div></div>`,
          [{ label: '创建', pri: true, fn: () => {
            const nm = document.getElementById('nh-name').value.trim();
            if (!nm) return TF.toast('请输入名称');
            S().addHabit(nm, document.getElementById('nh-icon').value.trim() || '✅', document.querySelector('#nh-colors .sw.on').dataset.c);
            TF.closeModal(); App.render();
          } }, { label: '取消', fn: TF.closeModal }]);
        setTimeout(() => document.getElementById('nh-name').focus(), 50);
        break;
      }
      /* --- 番茄 --- */
      case 'pomo-toggle': TF.pomoStart(); break;
      case 'pomo-reset': TF.pomoReset(); break;
      case 'pomo-skip': TF.pomoSkip(); break;
      case 'pomo-mode': TF.pomoSetMode(el.dataset.v); break;

      /* --- 外观 --- */
      /* theme-open / theme-pick / accent-pick / set-density 见上方「抽屉/外观」分支 */

      /* --- 快速添加：粘性 chip --- */
      case 'qa-chip': {
        const k = el.dataset.k;
        if (k === 'high') App.qaCtx.high = !App.qaCtx.high;
        else if (k === 'today') { App.qaCtx.today = !App.qaCtx.today; if (App.qaCtx.today) App.qaCtx.tomorrow = false; }
        else if (k === 'tomorrow') { App.qaCtx.tomorrow = !App.qaCtx.tomorrow; if (App.qaCtx.tomorrow) App.qaCtx.today = false; }
        document.querySelectorAll('#qa-chips .qa-chip').forEach(b => b.classList.toggle('on', !!App.qaCtx[b.dataset.k]));
        previewNow();
        break;
      }

      /* --- 即时筛选条（只改展示，不写 Store） --- */
      case 'filter-pick': App.filter = el.dataset.filter || 'all'; App.renderListOnly(); break;
      case 'filter-clear': App.filter = 'all'; App.renderListOnly(); break;

      /* --- 任务行「⋯」菜单 --- */
      case 'row-menu': { if (e && e.stopPropagation) e.stopPropagation(); TF.openRowMenu(id, el); break; }
      case 'row-today':
      case 'row-tomorrow':
      case 'row-week': {
        const tid = App.rowMenuTask || id;
        const t2 = S().task(tid); if (!t2) return;
        const td = TF.today();
        if (act === 'row-today') t2.due = td;
        else if (act === 'row-tomorrow') t2.due = TF.addDays(td, 1);
        else t2.due = TF.addDays(td, (7 - TF.parseDate(td).getDay()) % 7);
        S().save();
        TF.closeRowMenu();
        App.renderListOnly();
        TF.toast(t2.repeat ? '已改期（仅本次）：' + TF.cnDate(t2.due) : '已改到 ' + TF.cnDate(t2.due));
        break;
      }
      case 'row-done': {
        const tid = App.rowMenuTask || id;
        const r2 = S().toggleTask(tid);
        TF.closeRowMenu();
        App.renderListOnly();
        if (r2 && r2.next) TF.toast('已完成后自动生成下一次：' + TF.cnDate(r2.next.due));
        break;
      }
      case 'row-del': {
        const tid = App.rowMenuTask || id;
        if (!confirm('删除这个任务？')) return;
        S().removeTask(tid);
        TF.closeRowMenu();
        App.renderListOnly();
        TF.toast('已删除');
        break;
      }
      case 'row-open': {
        const tid = App.rowMenuTask || id;
        TF.closeRowMenu();
        TF.openTask(tid);
        break;
      }

      /* --- 抽屉：复制任务 --- */
      case 'copy-task': {
        if (!App.selTask) return;
        const c2 = TF.copyTask(App.selTask);
        if (!c2) return;
        App.renderListOnly();
        TF.toast('已复制任务');
        break;
      }

      /* --- 愿望 --- */
      case 'wish-open': TF.openWish(el.dataset.id); break;
      case 'wish-new': TF.openWish(null); break;
      case 'wish-del': {
        const wid = App.selWish;
        if (!wid || wid === 'new') return;
        const w = S().wish(wid); if (!w) return;
        if (!confirm('删除愿望「' + w.title + '」？不可恢复。')) return;
        S().removeWish(wid);
        TF.closeDrawer();
        TF.toast('愿望已删除', 'info');
        break;
      }
      case 'wish-filter': {
        App.wishFilter = el.dataset.filter || 'all';
        TF.wishesRenderListOnly();
        break;
      }
      case 'wish-done':
      case 'wish-undone': {
        const wid = el.dataset.id || App.selWish;
        if (!wid || wid === 'new') return;
        const w = S().setWishStatus(wid, act === 'wish-done' ? 'done' : 'doing');
        if (!w) return;
        if (App.view.type === 'wishes') {
          TF.wishesRenderListOnly();
          if (act === 'wish-done') TF.wishCelebrate(wid);
        }
        const footBtn = document.querySelector('#drawer .dw-foot [data-act="wish-done"],#drawer .dw-foot [data-act="wish-undone"]');
        if (footBtn) {
          footBtn.dataset.act = w.status === 'done' ? 'wish-undone' : 'wish-done';
          footBtn.textContent = w.status === 'done' ? '取消实现' : '标记实现';
        }
        document.querySelectorAll('#drawer #dw-w-status button').forEach(b => b.classList.toggle('on', b.dataset.v === w.status));
        TF.toast(act === 'wish-done' ? '愿望达成' : '已取消实现', act === 'wish-done' ? 'success' : 'info');
        break;
      }
      case 'wish-to-task': {
        const wid = App.selWish;
        if (!wid || wid === 'new') return TF.toast('先给愿望起个名字', 'warn');
        const w = S().wish(wid); if (!w) return;
        S().addTask({
          title: w.title,
          notes: w.desc || '',
          listId: (S().inbox() || {}).id,
          due: w.targetDate || null,
          priority: w.priority || 0,
          tags: ['愿望'].concat(w.category ? [w.category] : [])
        });
        TF.toast('已生成任务');
        break;
      }
    }
  }

  document.addEventListener('click', e => {
    /* 合成事件（或插件）可能把 target 派发到 document 上，做一次防御再 closest */
    const tg = (e.target && typeof e.target.closest === 'function') ? e.target : null;
    if (!tg) return;
    if (document.getElementById('pf-pop') && !tg.closest('#pf-pop') && !tg.closest('.profile-chip')) {
      TF.closeProfileMenu();
    }
    if (document.getElementById('theme-pop') && !tg.closest('#theme-pop') && !tg.closest('[data-act="theme-open"]')) {
      TF.closeThemePopover();
    }
    if (document.getElementById('row-menu') && !tg.closest('#row-menu') && !tg.closest('[data-act="row-menu"]')) {
      TF.closeRowMenu();
    }
    const actEl = tg.closest('[data-act]');
    if (actEl) { handleAct(actEl, e); return; }
    const openEl = tg.closest('[data-open]');
    if (openEl) { TF.openTask(openEl.dataset.open); return; }
    const dayEl = tg.closest('[data-day]');
    if (dayEl) { App.view = { type: 'day', date: dayEl.dataset.day }; App.group = 'none'; App.filter = 'all'; App.render(); return; }
    if (tg.closest('#drawer') === null && document.getElementById('drawer').classList.contains('open')) {
      // 点击主区域收起抽屉
      if (tg.closest('.main')) TF.closeDrawer();
    }
  });

  /* 内容区滚动时直接关闭行菜单（比"跟随"更确定） */
  document.addEventListener('scroll', e => {
    const m = document.getElementById('row-menu');
    if (!m) return;
    if (e.target && e.target.id === 'content') TF.closeRowMenu();
  }, true);

  document.addEventListener('change', e => {
    if (e.target.id === 'group-sel') { App.group = e.target.value; App.render(); }
    if (e.target.id === 'sort-sel') { App.sort = e.target.value; App.render(); }
    if (e.target.id === 'wish-sort') { App.wishSort = e.target.value; TF.wishesRenderListOnly(); }
  });

  document.addEventListener('input', e => {
    if (e.target.id !== 'search') return;
    App.search = e.target.value;
    if (App.view.type !== 'search' && App.search.trim()) { App.prevView = App.view; App.view = { type: 'search' }; }
    if (App.view.type === 'search') {
      if (!App.search.trim() && App.prevView) {
        App.view = App.prevView; App.render();
        const s2 = document.getElementById('search');
        if (s2) { s2.focus(); s2.setSelectionRange(0, 0); }
        return;
      }
      document.getElementById('content').innerHTML = taskViewHTML({ type: 'search' });
      document.getElementById('topbar').innerHTML = topbarHTML();
      const s = document.getElementById('search');
      if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    } else App.renderContent();
  });

  document.addEventListener('keydown', e => {
    const ae = document.activeElement;
    if (ae && ae.classList && ae.classList.contains('task')) {
      if (e.key === 'Enter') { e.preventDefault(); TF.openTask(ae.dataset.open); return; }
      if (e.key === ' ') { e.preventDefault(); const cb = ae.querySelector('[data-act="toggle"]'); if (cb) cb.click(); return; }
    }
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (e.key === 'F11') {
      e.preventDefault();
      if (!document.fullscreenElement) { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); }
      else { document.exitFullscreen && document.exitFullscreen(); }
      return;
    }
    if (e.key === 'Escape') {
      if (document.getElementById('modal-host').classList.contains('open')) return TF.closeModal();
      if (document.getElementById('row-menu')) return TF.closeRowMenu();
      if (document.getElementById('theme-pop')) return TF.closeThemePopover();
      const dw = document.getElementById('drawer');
      if (dw.classList.contains('open')) {
        // 抽屉内先失焦输入，再关闭面板
        if (typing && dw.contains(document.activeElement)) { document.activeElement.blur(); return; }
        return TF.closeDrawer();
      }
      if (typing) document.activeElement.blur();
      return;
    }
    if (typing) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); handleAct({ dataset: { act: 'new-task' } }); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (document.getElementById('pal')) return TF.closePalette();
      TF.openPalette();
      return;
    }
    if (e.key === '/') {
      e.preventDefault();
      const sb = document.getElementById('search');
      if (sb) { sb.focus(); sb.select(); }
    }
    if (e.key === ' ' && App.view.type === 'pomodoro') { e.preventDefault(); TF.pomoStart(); }
  });

  /* 四象限拖拽 */
  document.addEventListener('dragstart', e => {
    const row = e.target.closest('.task');
    if (row) e.dataTransfer.setData('text/plain', row.dataset.open);
  });
  document.addEventListener('dragover', e => {
    const q = e.target.closest('.quad');
    if (q) { e.preventDefault(); q.classList.add('over'); }
  });
  document.addEventListener('dragleave', e => {
    const q = e.target.closest('.quad');
    if (q && !q.contains(e.relatedTarget)) q.classList.remove('over');
  });
  document.addEventListener('drop', e => {
    const q = e.target.closest('.quad');
    if (!q) return;
    e.preventDefault(); q.classList.remove('over');
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    TF.applyQuad(q.dataset.quad, id);
    App.render();
    TF.toast('已移到「' + q.querySelector('b').textContent + '」');
  });

  /* 点击外部关闭弹窗 */
  document.addEventListener('mousedown', e => {
    const host = document.getElementById('modal-host');
    if (e.target === host) TF.closeModal();
  });

  /* ================= 启动 ================= */
  const t0 = performance.now();
  S().load();
  const tLoad = performance.now();
  // 到点提醒：回到 v1.12 常规方式（应用内提醒卡 + 系统通知），按 notifiedOn 去重
  setInterval(function () {
    const d = S().data, now = new Date(), t = TF.today();
    const due = [];
    d.tasks.forEach(tk => {
      if (tk.done || !tk.due || !tk.dueTime || tk.notifiedOn === t) return;
      const when = new Date(tk.due + 'T' + tk.dueTime);
      if (when <= now && now - when < 3600e3) due.push(tk);
    });
    if (!due.length) return;

    // 同一次检测只 beep 一次
    TF.beep();
    due.forEach(tk => {
      tk.notifiedOn = t;
      S().save();
      TF.reminderPopup(tk);
    });

    if (document.hidden && window.Notification && Notification.permission === 'granted') {
      const first = due[0];
      try {
        const n = new Notification('刻度 · 任务提醒', { body: first.title + ' · ' + (first.dueTime || '') });
        n.onclick = () => { window.focus(); TF.openTask(first.id); };
      } catch (e) { }
    }
  }, 30000);

  // 轻量深链：file:///…/index.html#process / #stats / #list:l_work
  (function () {
    const h = (location.hash || '').replace(/^#\/?/, '');
    if (!h) return;
    const [k, v] = h.split(':');
    const plain = ['inbox', 'today', 'next7', 'all', 'completed', 'calendar', 'quadrants', 'process', 'habits', 'pomodoro', 'stats'];
    if (plain.includes(k)) App.view = { type: k };
    if (k === 'list' && v) App.view = { type: 'list', listId: v };
    if (k === 'day' && v) App.view = { type: 'day', date: v };
  })();
  applyTheme();
  App.render();
  initEffects();
  TF.timing = {
    load: Math.round(tLoad - t0),
    render: Math.round(performance.now() - tLoad),
    total: Math.round(performance.now() - t0)
  };
  TF.bootMs = TF.timing.total;
  window.addEventListener('beforeunload', () => S().flush());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) S().flush();
  });
  setInterval(TF.pomoTick, 400);
  /* 状态栏专注计时每秒刷新；只在运行时重绘，避免空转 */
  setInterval(() => { if (TF.Pomo && TF.Pomo.running) App.renderStatusbar(); }, 1000);
  // 扩展点收尾：挂载所有已注册模块（无模块时是空转，开销可忽略）
  if (TF.start) { try { TF.start(); } catch (e) { console.error('[boot]', e); } }
  window.TF.App = App;
})();
