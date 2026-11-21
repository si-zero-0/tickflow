/* ===== 愿望模块：列表 / 统计 / 筛选 / 编辑抽屉（复用 #drawer 第二模式） =====
   数据全部走 TF.Store 的 wish API；本文件只产出字符串与局部刷新：
   - 列表区（统计条 / 筛选项 / 网格 / 空态）用 TF.wishesRenderListOnly() 整体替换
   - 抽屉内字段即时保存，不重建面板（否则会丢焦点与滚动位置）
*/
(function () {
  const TF = window.TF, S = () => TF.Store, esc = TF.esc;

  const ST_NAME = { idea: '想做', doing: '进行中', done: '已实现' };
  const ST_KEYS = ['idea', 'doing', 'done'];
  const CATS = ['旅行', '物品', '体验', '学习', '生活'];
  const PRI_KEYS = [0, 1, 2, 3];
  const PRI_NAMES = ['无', '低', '中', '高'];

  function A() { return TF.App; }
  function mode() {
    const t = TF.themeDef(S().data.settings.theme);
    return t ? t.mode : 'dark';
  }
  function accentColor() { return TF.accentHex(S().data.settings.accent, mode()); }

  /* ---------- 排序 ---------- */
  /* 期望日期：升序，null 排最后；兜底创建时间倒序。优先级：3→0。创建时间：倒序 */
  function sortWishes(arr, sort) {
    const out = arr.slice();
    if (sort === 'priority') {
      out.sort((a, b) => ((b.priority || 0) - (a.priority || 0)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    } else if (sort === 'created') {
      out.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    } else {
      out.sort((a, b) => {
        const ad = a.targetDate || '9999-99-99';
        const bd = b.targetDate || '9999-99-99';
        if (ad !== bd) return ad < bd ? -1 : 1;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
    }
    return out;
  }

  function visibleWishes() {
    const f = A().wishFilter || 'all';
    const list = S().wishes();
    return sortWishes(f === 'all' ? list : list.filter(w => w.status === f), A().wishSort || 'target');
  }

  /* ---------- 片段 ---------- */
  function statsHTML() {
    const st = S().wishStats();
    return `<div class="wish-stats" id="wish-stats">
      <div class="ws-i"><b>${st.total}</b><span>总数</span></div>
      <div class="ws-i"><b>${st.doing}</b><span>进行中</span></div>
      <div class="ws-i"><b>${st.done}</b><span>已实现</span></div>
      <div class="ws-i ws-rate"><b>${st.rate}%</b><span>实现率</span></div>
    </div>`;
  }

  function filterHTML() {
    const st = S().wishStats();
    const cur = A().wishFilter || 'all';
    const chip = (k, label, n) => `<button class="f-chip ${cur === k ? 'on' : ''}" data-act="wish-filter" data-filter="${k}">${label} <i>${n}</i></button>`;
    const sort = A().wishSort || 'target';
    return `<div class="filter-bar" id="wish-filter">
      ${chip('all', '全部', st.total)}${chip('idea', '想做', st.idea)}${chip('doing', '进行中', st.doing)}${chip('done', '已实现', st.done)}
      <span class="f-sp"></span>
      <select class="tb-sel" id="wish-sort" title="排序">
        <option value="target" ${sort === 'target' ? 'selected' : ''}>期望日期</option>
        <option value="priority" ${sort === 'priority' ? 'selected' : ''}>优先级</option>
        <option value="created" ${sort === 'created' ? 'selected' : ''}>创建时间</option>
      </select>
    </div>`;
  }

  TF.wishCardHTML = function (w) {
    const st = ST_KEYS.indexOf(w.status) >= 0 ? w.status : 'idea';
    return `<button class="wish-card ${st === 'done' ? 'is-done' : ''}" data-act="wish-open" data-id="${w.id}" data-wish="${w.id}">
      <span class="wc-bar" style="background:${esc(w.color || accentColor())}"></span>
      <b class="wc-t">${esc(w.title)}</b>
      <span class="wc-d">${esc(w.desc || '')}</span>
      <span class="wc-f">
        <em>${esc(w.category || '未分类')}</em>
        ${w.targetDate ? `<i>${esc(w.targetDate)}</i>` : ''}
        <u class="wc-st ${st}">${ST_NAME[st]}${st === 'done' ? '<svg class="ic xs"><use href="#i-check"/></svg>' : ''}</u>
      </span>
    </button>`;
  };

  function gridHTML() {
    const list = visibleWishes();
    return `<div class="wish-grid" id="wish-grid">
      ${list.map(TF.wishCardHTML).join('')}
      <button class="wish-card wish-new-card" data-act="wish-new">
        <svg class="ic"><use href="#i-plus"/></svg><span>新建愿望</span></button>
    </div>`;
  }

  function emptyHTML() {
    const st = S().wishStats();
    if (!st.total) {
      return `<div class="wish-empty" id="wish-empty">
        <div class="we-ico"><svg class="ic"><use href="#i-spark"/></svg></div>
        <b>还没有愿望</b>
        <span>写下一个想了很久但一直没做的事</span>
        <button class="btn pri" style="margin-top:14px" data-act="wish-new">记下第一个愿望</button>
      </div>`;
    }
    if (!visibleWishes().length) {
      return `<div class="wish-empty" id="wish-empty">
        <div class="we-ico"><svg class="ic"><use href="#i-search"/></svg></div>
        <b>这个状态下还没有愿望</b>
        <button class="btn sm ghost" style="margin-top:12px" data-act="wish-filter" data-filter="all">看全部</button>
      </div>`;
    }
    return '<div class="wish-empty" id="wish-empty" hidden></div>';
  }

  /* ---------- 页面 ---------- */
  TF.renderWishes = function () {
    return `<div class="wrap-wide wish-wrap">
      ${statsHTML()}
      ${filterHTML()}
      ${gridHTML()}
      ${emptyHTML()}
    </div>`;
  };

  /* 局部刷新：只换统计条 / 筛选项 / 网格 / 空态，不碰顶栏与输入框 */
  TF.wishesRenderListOnly = function () {
    const parts = [
      ['wish-stats', statsHTML()],
      ['wish-filter', filterHTML()],
      ['wish-grid', gridHTML()],
      ['wish-empty', emptyHTML()]
    ];
    parts.forEach(([id, html]) => {
      const el = document.getElementById(id);
      if (el) el.outerHTML = html;
    });
    // 空态与网格互斥：有卡片就把空态隐藏
    const empty = document.getElementById('wish-empty');
    if (empty) {
      const has = S().wishStats().total > 0 && visibleWishes().length > 0;
      empty.hidden = has;
    }
    // 侧栏「愿望」计数（未实现数）跟着变，避免局部刷新后侧栏与筛选条不一致
    if (TF.App && TF.App.updateSidebarCounts) TF.App.updateSidebarCounts();
  };

  /* ---------- 抽屉 ---------- */
  function draft() {
    return {
      id: 'new', title: '', desc: '', category: '', status: 'idea', priority: 0,
      targetDate: null, color: accentColor(), createdAt: null, doneAt: null, order: 0
    };
  }

  function drawerHTML(w) {
    const isNew = w.id === 'new';
    const cats = CATS.map(c =>
      `<button class="${w.category === c ? 'on' : ''}" data-act="wish-cat" data-v="${c}">${c}</button>`).join('');
    const colors = TF.ACCENTS.map(a =>
      `<div class="sw ${(w.color || '').toLowerCase() === a.dark.toLowerCase() ? 'on' : ''}" data-c="${a.dark}" style="background:${a.dark}"></div>`).join('');
    return `<div class="dw-head">
        <span class="wc-bar lg" style="background:${esc(w.color || accentColor())}"></span>
        <h2 class="t">${isNew ? '新建愿望' : '愿望'}</h2>
        <button class="icon-btn" data-act="wish-del" title="删除" style="${isNew ? 'display:none' : ''}"><svg class="ic sm"><use href="#i-trash"/></svg></button>
        <button class="icon-btn" data-act="close-drawer" title="关闭"><svg class="ic"><use href="#i-x"/></svg></button>
      </div>
      <div class="dw-body">
        <input class="dw-title" id="dw-w-title" placeholder="想做的事…" value="${esc(w.title)}" autocomplete="off">
        <div class="wish-hint" id="dw-w-hint" hidden>给愿望起个名字</div>
        <textarea class="dw-note" id="dw-w-desc" placeholder="为什么想，什么时候，和谁…">${esc(w.desc || '')}</textarea>
        <div class="dw-row"><span class="lab">分类</span><span class="val">
          <input id="dw-w-cat" placeholder="未分类" value="${esc(w.category || '')}" style="flex:1">
        </span></div>
        <div class="cat-sug" id="dw-w-cats">${cats}</div>
        <div class="dw-row"><span class="lab">状态</span><span class="val">
          <div class="seg" id="dw-w-status">
            ${ST_KEYS.map(k => `<button data-v="${k}" class="${w.status === k ? 'on' : ''}">${ST_NAME[k]}</button>`).join('')}
          </div></span></div>
        <div class="dw-row"><span class="lab">优先级</span><span class="val">
          <div class="seg" id="dw-w-pri">
            ${PRI_KEYS.map(p => `<button data-v="${p}" class="${(w.priority || 0) === p ? 'on' + (p ? ' p' + p : '') : ''}">${PRI_NAMES[p]}</button>`).join('')}
          </div></span></div>
        <div class="dw-row"><span class="lab">期望</span><span class="val">
          <input type="date" id="dw-w-date" value="${w.targetDate || ''}"></span></div>
        <div class="dw-row"><span class="lab">颜色</span><span class="val">
          <div class="swatches" id="dw-w-colors">${colors}</div></span></div>
      </div>
      <div class="dw-foot">
        <span data-created>${w.createdAt ? '创建于 ' + new Date(w.createdAt).toLocaleDateString('zh-CN') : '未保存的草稿'}</span>
        <button class="btn sm ghost" style="margin-left:auto" data-act="wish-to-task">转成任务</button>
        <button class="btn sm" data-act="${w.status === 'done' ? 'wish-undone' : 'wish-done'}">${w.status === 'done' ? '取消实现' : '标记实现'}</button>
        <button class="btn sm ghost" data-act="close-drawer">关闭</button>
      </div>`;
  }

  /* 当前抽屉绑定的愿望；懒创建后由 new 切换到真实 id */
  let cur = null;

  function paintCard(w) {
    if (!w || w.id === 'new') return;
    const el = document.querySelector('#wish-grid .wish-card[data-id="' + w.id + '"]');
    if (!el) return;
    const t = el.querySelector('.wc-t');
    const d = el.querySelector('.wc-d');
    if (t) t.textContent = w.title;
    if (d) d.textContent = w.desc || '';
  }

  function setHint(on) {
    const h = document.getElementById('dw-w-hint');
    if (h) h.hidden = !on;
  }

  function switchFooter(status) {
    const btn = document.querySelector('#drawer .dw-foot [data-act="wish-done"],#drawer .dw-foot [data-act="wish-undone"]');
    if (!btn) return;
    const done = status === 'done';
    btn.dataset.act = done ? 'wish-undone' : 'wish-done';
    btn.textContent = done ? '取消实现' : '标记实现';
  }

  function bindDrawer(w0) {
    cur = w0;
    const box = document.getElementById('drawer');
    const ti = box.querySelector('#dw-w-title');
    const desc = box.querySelector('#dw-w-desc');
    const cat = box.querySelector('#dw-w-cat');

    /* 懒创建：首次输入非空标题才落库，未命名草稿永不产生对象 */
    function ensure(title) {
      if (cur.id !== 'new') return cur;
      const w = S().addWish({ title: title, color: cur.color || accentColor() });
      cur = w;
      A().selWish = w.id;
      const del = box.querySelector('[data-act="wish-del"]');
      if (del) del.style.display = '';
      const cr = box.querySelector('[data-created]');
      if (cr) cr.textContent = '创建于 ' + new Date(w.createdAt).toLocaleDateString('zh-CN');
      return w;
    }

    ti.addEventListener('input', () => {
      const v = ti.value;
      if (!v.trim()) { setHint(true); return; }   // 空标题不写 Store，保留上一个非空值
      setHint(false);
      ensure(v);
      S().updateWish(cur.id, { title: v });
      paintCard(cur);
    });
    ti.addEventListener('blur', () => {
      if (ti.value.trim()) return;
      ti.value = cur.id === 'new' ? '' : ((S().wish(cur.id) || {}).title || '');
      if (cur.id === 'new') setHint(true);
      TF.toast('给愿望起个名字', 'warn');
    });

    desc.addEventListener('input', () => {
      if (cur.id === 'new') return;
      S().updateWish(cur.id, { desc: desc.value });
      paintCard(cur);
    });

    cat.addEventListener('input', () => {
      if (cur.id === 'new') return;
      S().updateWish(cur.id, { category: cat.value });
      box.querySelectorAll('#dw-w-cats button').forEach(b => b.classList.toggle('on', b.dataset.v === cat.value));
    });
    box.querySelectorAll('#dw-w-cats button').forEach(b => b.addEventListener('click', () => {
      if (cur.id === 'new') return;
      cat.value = b.dataset.v;
      S().updateWish(cur.id, { category: b.dataset.v });
      box.querySelectorAll('#dw-w-cats button').forEach(x => x.classList.toggle('on', x === b));
    }));

    box.querySelectorAll('#dw-w-status button').forEach(b => b.addEventListener('click', () => {
      if (cur.id === 'new') { cur.status = b.dataset.v; }
      else cur = S().setWishStatus(cur.id, b.dataset.v) || cur;
      box.querySelectorAll('#dw-w-status button').forEach(x => x.classList.toggle('on', x === b));
      switchFooter(cur.status);
      if (A().view.type === 'wishes') TF.wishesRenderListOnly();
    }));

    box.querySelectorAll('#dw-w-pri button').forEach(b => b.addEventListener('click', () => {
      const p = +b.dataset.v;
      if (cur.id === 'new') cur.priority = p;
      else cur = S().updateWish(cur.id, { priority: p }) || cur;
      box.querySelectorAll('#dw-w-pri button').forEach(x => {
        x.classList.toggle('on', x === b);
        x.classList.toggle('p' + x.dataset.v, x === b && +x.dataset.v > 0);
      });
    }));

    const date = box.querySelector('#dw-w-date');
    date.addEventListener('change', () => {
      if (cur.id === 'new') return;
      cur = S().updateWish(cur.id, { targetDate: date.value || null }) || cur;
      if (A().view.type === 'wishes') TF.wishesRenderListOnly();
    });

    box.querySelectorAll('#dw-w-colors .sw').forEach(sw => sw.addEventListener('click', () => {
      if (cur.id === 'new') return;
      cur = S().updateWish(cur.id, { color: sw.dataset.c }) || cur;
      box.querySelectorAll('#dw-w-colors .sw').forEach(x => x.classList.toggle('on', x === sw));
      const bar = box.querySelector('.wc-bar');
      if (bar) bar.style.background = sw.dataset.c;
      const el = document.querySelector('#wish-grid .wish-card[data-id="' + cur.id + '"] .wc-bar');
      if (el) el.style.background = sw.dataset.c;
    }));

    setTimeout(() => ti.focus(), 40);
  }

  TF.openWish = function (id) {
    const box = document.getElementById('drawer');
    if (!box) return;
    let w;
    if (id) {
      w = S().wish(id);
      if (!w) return;
    } else {
      w = draft();
    }
    A().drawerMode = 'wish';
    A().selWish = id || 'new';
    A().selTask = null;
    box.classList.add('open');
    box.setAttribute('aria-hidden', 'false');
    TF.scrim(true);
    box.innerHTML = drawerHTML(w);
    bindDrawer(w);
  };

  /* 由 TF.closeDrawer 内部调用；未命名草稿在此处丢弃（不产生空愿望） */
  TF.closeWishDrawer = function () {
    cur = null;
    A().drawerMode = null;
    A().selWish = null;
  };

  /* 愿望达成后的庆祝：卡片对勾绘制 + 轻微上浮回弹（A5，240ms） */
  TF.wishCelebrate = function (id) {
    const card = document.querySelector('#wish-grid .wish-card[data-id="' + id + '"]');
    if (!card) return;
    card.classList.add('just-done');
    setTimeout(() => card.classList.remove('just-done'), 600);
  };
})();
