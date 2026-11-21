/* ===== 进程：游戏任务日志式路线图 ===== */
(function () {
  const TF = window.TF, S = () => TF.Store, esc = TF.esc;
  const CARD_W = 214, STEP = TF.RM_STEP, ROW_H = TF.RM_ROW, PAD_L = TF.RM_PAD_L, PAD_TOP = TF.RM_PAD_TOP;

  TF.RM = { processId: null, zoom: 1, selected: null };

  const stateText = { done: '已完成', active: '进行中', available: '可开始', locked: '未解锁' };
  const stateCls = { done: 'o', active: 'w', available: 'a', locked: 'l' };

  function curProcess() {
    const d = S().data;
    if (!d.processes.length) return null;
    let p = d.processes.find(x => x.id === TF.RM.processId);
    if (!p) { p = d.processes[0]; TF.RM.processId = p.id; }
    return p;
  }
  TF.curProcess = curProcess;

  /* ---------- 主视图 ---------- */
  TF.renderProcess = function () {
    const d = S().data;
    if (!d.processes.length) {
      return `<div class="wrap-wide"><div class="card" style="text-align:center;padding:56px 20px">
        <div style="font-size:34px;margin-bottom:10px">🗺️</div>
        <b style="font-size:15px">还没有进程</b>
        <p style="color:var(--tx3);font-size:12.5px;margin:8px 0 16px">把长期目标拆成主线与支线，像游戏任务日志一样看到每个节点是否解锁。</p>
        <button class="btn pri" data-act="new-process"><svg class="ic sm"><use href="#i-plus"/></svg>新建进程</button>
      </div></div>`;
    }
    const p = curProcess();
    const st = S().processStats(p);

    // 首次进入自动缩放到适合宽度
    if (!TF.RM.userZoom) {
      const cw = (document.getElementById('content') || {}).clientWidth || 900;
      const need = PAD_L + Math.max(1, ...p.lanes.map(l => p.nodes.filter(n => n.laneId === l.id).length)) * STEP + 60;
      TF.RM.zoom = Math.max(0.72, Math.min(1, Math.round((cw - 26) / need * 20) / 20));
    }

    const tabs = d.processes.map(x => `<button class="rm-tab ${x.id === p.id ? 'on' : ''}" data-act="rm-switch" data-id="${x.id}">
      <span class="dot" style="background:${x.color}"></span>${esc(x.name)}
      <span style="color:var(--tx3);font-size:11px">${Math.round(S().processStats(x).pct * 100)}%</span>
    </button>`).join('');

    const laneRows = st.laneStats.map(ls => `<div class="rm-lane-row">
      <span class="nm"><i style="background:${ls.lane.color}"></i>${esc(ls.lane.name)}</span>
      <div class="bar"><i style="width:${Math.round(ls.pct * 100)}%;background:${ls.lane.color}"></i></div>
      <span class="pc">${ls.done}/${ls.total}</span>
    </div>`).join('');

    const lastDue = p.nodes.filter(n => n.due).map(n => n.due).sort().pop();
    return `<div class="wrap-wide">
      <div class="rm-top">
        <div class="rm-tabs">${tabs}<button class="rm-tab" data-act="new-process"><svg class="ic xs"><use href="#i-plus"/></svg>新进程</button></div>
      </div>

      <div class="rm-sum">
        <div class="rm-prog-card">
          ${ring(st.pct, 64, p.color, Math.round(st.pct * 100) + '%')}
          <div class="rm-pinfo">
            <div class="rm-pname">${esc(p.icon)} ${esc(p.name)}</div>
            <div class="rm-pdesc">${esc(p.desc || '共 ' + st.total + ' 个节点')}</div>
            <div class="rm-pmeta">${st.total} 节点 · 主线 ${Math.round((st.laneStats[0] ? st.laneStats[0].pct : 0) * 100)}%</div>
          </div>
        </div>
        <div class="rm-lanes">
          <div class="rm-cnt-row">
            <span class="pill" style="border-color:transparent;background:color-mix(in srgb,var(--ok) 13%,transparent);color:var(--ok)">✓ ${st.done} 完成</span>
            <span class="pill" style="border-color:transparent;background:var(--ac-soft);color:var(--ac)">▶ ${st.avail + st.active} 可推进</span>
            <span class="pill" style="border-color:transparent;background:var(--panel2);color:var(--tx3)">🔒 ${st.locked} 锁定</span>
            <span style="margin-left:auto;font-size:11px;color:var(--tx3)">${lastDue ? '最近节点 ' + esc(TF.cnDate(lastDue)) : ''}</span>
          </div>
          ${laneRows}
        </div>
      </div>

      <div class="rm-bar-tools">
        <button class="btn sm" data-act="new-node"><svg class="ic xs"><use href="#i-plus"/></svg>节点</button>
        <button class="btn sm ghost" data-act="tpl"><svg class="ic xs"><use href="#i-layers"/></svg>模板</button>
        <button class="btn sm ghost" data-act="rm-layout" title="按当前左右顺序对齐，并把每条轨道的节点统一贴到轨道顶部"><svg class="ic xs"><use href="#i-grid"/></svg>整理</button>
        <button class="btn sm ghost" data-act="rm-edit-process"><svg class="ic xs"><use href="#i-settings"/></svg>进程设置</button>
        <div class="sp"></div>
        <button class="icon-btn" data-act="rm-zoom-out" title="缩小">−</button>
        <span style="font-size:11.5px;color:var(--tx3);width:38px;text-align:center" id="rm-zoom-label">${Math.round(TF.RM.zoom * 100)}%</span>
        <button class="icon-btn" data-act="rm-zoom-in" title="放大">＋</button>
        <button class="icon-btn" data-act="rm-zoom-fit" title="适应宽度"><svg class="ic sm"><use href="#i-grid"/></svg></button>
      </div>

      <div class="rm-stage-wrap" id="rm-wrap">
        <div id="rm-zoom" style="width:${stageW(p) * TF.RM.zoom}px;height:${stageH(p) * TF.RM.zoom}px">
          <div class="rm-stage" id="rm-stage" style="width:${stageW(p)}px;height:${stageH(p)}px;transform:scale(${TF.RM.zoom})">
            ${laneBands(p)}<div class="rm-rails">${rails(p)}</div>
            <svg class="rm-edges" width="${stageW(p)}" height="${stageH(p)}">${edges(p)}</svg>
            ${p.nodes.map(n => nodeCard(p, n)).join('')}
            ${p.nodes.length ? '' : `<div class="rm-hint">还没有节点 — 点上方「节点」把这条路线的第一关建出来</div>`}
          </div>
        </div>
      </div>
      <div class="rm-legend">
        <span class="li"><i style="border-color:var(--ac);background:var(--ac-soft)"></i>可开始</span>
        <span class="li"><i style="border-color:var(--warn);background:color-mix(in srgb,var(--warn) 25%,transparent)"></i>进行中</span>
        <span class="li"><i style="border-color:var(--ok);background:var(--ok)"></i>已完成</span>
        <span class="li"><i style="border-color:var(--line2);border-style:dashed"></i>依赖未满足</span>
        <span style="margin-left:auto">拖动节点摆放 · 拖轨道下沿拉伸高度（双击复位） · Alt 拖拽框选放大 · Ctrl 滚轮缩放</span>
      </div>
    </div>`;
  };

  function stageW(p) {
    const maxN = Math.max(1, ...p.lanes.map(l => p.nodes.filter(n => n.laneId === l.id).length));
    return PAD_L + maxN * STEP + 60;
  }
  /* 画布尺寸取「内容所需」与「可视区」的较大值：
     缩放变小或窗口变大时，轨道色带仍然铺满，不会露出右侧/下方的空白点阵 */
  function fitStage() {
    const wrap = document.getElementById('rm-wrap');
    const stage = document.getElementById('rm-stage');
    const zl = document.getElementById('rm-zoom');
    if (!wrap || !stage) return;
    const p = curProcess();
    if (!p) return;
    const z = TF.RM.zoom || 1;
    const w = Math.max(stageW(p), Math.ceil((wrap.clientWidth + 1) / z));
    const h = Math.max(stageH(p), Math.ceil((wrap.clientHeight + 1) / z));
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    if (zl) {
      zl.style.width = w * z + 'px';
      zl.style.height = h * z + 'px';
    }
    const svg = stage.querySelector('.rm-edges');
    if (svg) { svg.setAttribute('width', w); svg.setAttribute('height', h); }
  }

  function stageH(p) {
    const tops = TF.laneTops(p);
    const last = p.lanes.length - 1;
    return (last >= 0 ? tops[last] + TF.laneH(p.lanes[last]) : 0) + 20;
  }

  function laneBands(p) {
    const tops = TF.laneTops(p);
    return p.lanes.map((l, i) => {
      const h = TF.laneH(l);
      return `<div class="rm-lane${i === p.lanes.length - 1 ? ' last' : ''}" data-lane="${l.id}" style="top:${tops[i]}px;height:${h}px;background:color-mix(in srgb,${l.color} 4%,transparent)">
        <span class="rm-lane-lb"><i style="background:${l.color}"></i>${esc(l.name)}<em>${h}px</em></span>
        <div class="rm-lane-grip" data-lane="${l.id}" title="拖动调整「${esc(l.name)}」高度（双击复位）"><i></i></div>
      </div>`;
    }).join('');
  }
  function rails(p) {
    const tops = TF.laneTops(p);
    return p.lanes.map((l, i) => {
      const ns = p.nodes.filter(n => n.laneId === l.id);
      if (ns.length < 2) return '';
      const y = tops[i] + PAD_TOP + 48;
      const x1 = Math.min(...ns.map(n => n.x)), x2 = Math.max(...ns.map(n => n.x)) + CARD_W;
      return `<div class="rm-rail" style="top:${y}px;left:${x1}px;width:${Math.max(0, x2 - x1)}px;opacity:.5"></div>`;
    }).join('');
  }

  function nodeCard(p, n) {
    const st = S().nodeState(n, p);
    const pr = S().nodeProgress(n);
    const ck = n.checklist || [];
    const lane = p.lanes.find(l => l.id === n.laneId) || p.lanes[0];
    const idx = p.nodes.filter(x => x.laneId === n.laneId).indexOf(n) + 1;
    return `<div class="rm-node st-${st} ${TF.RM.selected === n.id ? 'sel' : ''}" data-node="${n.id}"
        style="left:${n.x}px;top:${n.y}px">
      <div class="rm-n-h">
        <div class="rm-n-dot" data-act="node-toggle" data-id="${n.id}" title="切换完成"><svg class="ic"><use href="#i-check"/></svg></div>
        <span class="rm-n-idx">${String(idx).padStart(2, '0')}</span>
        <div class="rm-n-t">${esc(n.title)}</div>
      </div>
      <p class="rm-n-d">${esc(n.desc || '—')}</p>
      <div class="rm-n-f">
        <div class="bar thin"><i style="width:${Math.round(pr * 100)}%;background:${lane.color}"></i></div>
        <span>${ck.filter(c => c.done).length}/${ck.length}</span>
        <span class="st ${stateCls[st]}">${stateText[st]}</span>
      </div>
    </div>`;
  }

  function edges(p) {
    let out = `<defs>
      <marker id="rm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/>
      </marker></defs>`;
    const H = 104;
    p.nodes.forEach(n => {
      (n.requires || []).forEach(rid => {
        const a = p.nodes.find(x => x.id === rid);
        if (!a) return;
        let x1, y1, x2, y2, d;
        /* 智能锚点：按目标相对源的位置选择出入边，保证线"从卡片某条边出、垂直进另一条边" */
        const ax = a.x + CARD_W / 2, ay = a.y + H / 2;
        const nx = n.x + CARD_W / 2, ny = n.y + H / 2;
        const dx = nx - ax, dy = ny - ay;
        if (Math.abs(dx) > Math.abs(dy) * 0.55) {
          // 横向：右→左 或 左→右
          if (dx >= 0) { x1 = a.x + CARD_W; y1 = a.y + H / 2; x2 = n.x; y2 = n.y + H / 2; }
          else { x1 = a.x; y1 = a.y + H / 2; x2 = n.x + CARD_W; y2 = n.y + H / 2; }
          const k = Math.max(34, Math.abs(x2 - x1) * 0.45) * (x2 >= x1 ? 1 : -1);
          d = `M${x1},${y1} C${x1 + k},${y1} ${x2 - k},${y2} ${x2},${y2}`;
        } else {
          // 纵向：下→上 或 上→下
          if (dy >= 0) { x1 = a.x + CARD_W / 2; y1 = a.y + H; x2 = n.x + CARD_W / 2; y2 = n.y; }
          else { x1 = a.x + CARD_W / 2; y1 = a.y; x2 = n.x + CARD_W / 2; y2 = n.y + H; }
          const k = Math.max(26, Math.abs(y2 - y1) * 0.42) * (y2 >= y1 ? 1 : -1);
          d = `M${x1},${y1} C${x1},${y1 + k} ${x2},${y2 - k} ${x2},${y2}`;
        }
        const done = a.status === 'done';
        const col = done ? 'var(--ok)' : (S().nodeState(a, p) === 'active' ? 'var(--warn)' : 'var(--edge)');
        out += `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" stroke-dasharray="${done ? '0' : '5 4'}"
          marker-end="url(#rm-arrow)" opacity="${done ? .85 : .75}"/>`;
      });
    });
    return out;
  }

  function ring(pct, size, color, label) {
    const r = (size - 7) / 2, c = 2 * Math.PI * r;
    return `<div class="ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="5"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="5"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, pct))}"/>
      </svg><div class="rv">${label}</div></div>`;
  }
  TF.ring = ring;

  /* ---------- 交互：拖拽 / 缩放 ---------- */
  TF.bindRoadmap = function () {
    const stage = document.getElementById('rm-stage');
    if (!stage) return;
    const p = curProcess();

    stage.querySelectorAll('.rm-node').forEach(el => {
      el.addEventListener('pointerdown', ev => {
        if (ev.button !== 0) return;
        if (ev.target.closest('[data-act]')) return;
        const n = S().node(el.dataset.node);
        if (!n) return;
        const zoom = TF.RM.zoom;
        const sx = ev.clientX, sy = ev.clientY, ox = n.x, oy = n.y;
        let moved = false;
        el.setPointerCapture(ev.pointerId);
        const mv = e => {
          const dx = (e.clientX - sx) / zoom, dy = (e.clientY - sy) / zoom;
          if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
          moved = true; el.classList.add('dragging');
          const li = p.lanes.findIndex(l => l.id === n.laneId);
          const lane = p.lanes[li] || p.lanes[0];
          const top = TF.laneTops(p)[li] || 0;
          const maxX = stageW(p) - CARD_W - 8;
          n.x = Math.max(6, Math.min(maxX, Math.round((ox + dx) / 4) * 4));
          n.y = Math.max(top + 8, Math.min(top + TF.laneH(lane) - 114, Math.round((oy + dy) / 4) * 4));
          el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
          const svg = stage.querySelector('.rm-edges');
          if (svg) svg.innerHTML = edges(p);
        };
        const up = () => {
          el.removeEventListener('pointermove', mv);
          el.removeEventListener('pointerup', up);
          el.classList.remove('dragging');
          if (moved) { S().save(); }
          else { TF.openNode(n.id); }
        };
        el.addEventListener('pointermove', mv);
        el.addEventListener('pointerup', up);
      });
    });

    // 画布空白点击
    stage.addEventListener('click', e => {
      if (e.target.closest('.rm-node')) return;
    });

    /* ---------- 轨道纵向拉伸 ---------- */
    const syncGeom = () => {
      const tops = TF.laneTops(p);
      p.lanes.forEach((l, i) => {
        const b = stage.querySelector('.rm-lane[data-lane="' + l.id + '"]');
        if (b) {
          b.style.top = tops[i] + 'px';
          b.style.height = TF.laneH(l) + 'px';
          const em = b.querySelector('.rm-lane-lb em');
          if (em) em.textContent = TF.laneH(l) + 'px';
        }
      });
      p.nodes.forEach(n => {
        const el = stage.querySelector('.rm-node[data-node="' + n.id + '"]');
        if (el) el.style.top = n.y + 'px';
      });
      const railsBox = stage.querySelector('.rm-rails');
      if (railsBox) railsBox.innerHTML = rails(p);
      const svg = stage.querySelector('.rm-edges');
      if (svg) { svg.innerHTML = edges(p); }
      fitStage();
    };

    const shiftBelow = (li, delta) => {
      p.lanes.slice(li + 1).forEach(l2 => {
        p.nodes.filter(n => n.laneId === l2.id).forEach(n => { n.y += delta; });
      });
    };

    stage.querySelectorAll('.rm-lane-grip').forEach(g => {
      g.addEventListener('pointerdown', ev => {
        if (ev.button !== 0) return;
        ev.preventDefault(); ev.stopPropagation();
        const lane = p.lanes.find(l => l.id === g.dataset.lane);
        if (!lane) return;
        const li = p.lanes.indexOf(lane);
        const startY = ev.clientY, startH = TF.laneH(lane);
        try { g.setPointerCapture(ev.pointerId); } catch (err) { }
        g.classList.add('on');
        document.body.classList.add('rm-resizing');
        if (!TF._rmUpBound) {
          TF._rmUpBound = true;
          const clear = () => { document.body.classList.remove('rm-resizing'); };
          window.addEventListener('pointerup', clear, true);
          window.addEventListener('pointercancel', clear, true);
          window.addEventListener('blur', clear);
        }
        const mv = e => {
          const dy = (e.clientY - startY) / TF.RM.zoom;
          const h = Math.round(Math.max(TF.RM_MIN_H, Math.min(TF.RM_MAX_H, startH + dy)) / 2) * 2;
          const delta = h - TF.laneH(lane);
          if (!delta) return;
          lane.h = h;
          shiftBelow(li, delta);
          syncGeom();
        };
        const up = () => {
          g.removeEventListener('pointermove', mv);
          g.removeEventListener('pointerup', up);
          g.classList.remove('on');
          document.body.classList.remove('rm-resizing');
          S().save(); TF.App.render();
        };
        g.addEventListener('pointermove', mv);
        g.addEventListener('pointerup', up);
      });
      g.addEventListener('dblclick', ev => {
        ev.stopPropagation();
        const lane = p.lanes.find(l => l.id === g.dataset.lane);
        if (!lane) return;
        const li = p.lanes.indexOf(lane);
        const delta = TF.RM_ROW - TF.laneH(lane);
        lane.h = TF.RM_ROW;
        shiftBelow(li, delta);
        S().save(); TF.App.render();
        TF.toast('「' + lane.name + '」已复位为 ' + TF.RM_ROW + 'px');
      });
    });

    /* ---------- 区域放大：Alt + 拖拽框选 ---------- */
    stage.addEventListener('pointerdown', ev => {
      if (!ev.altKey || ev.button !== 0) return;
      if (ev.target.closest('.rm-node') || ev.target.closest('.rm-lane-grip')) return;
      ev.preventDefault();
      const sr = stage.getBoundingClientRect();
      const zoom = TF.RM.zoom;
      const x0 = (ev.clientX - sr.left) / zoom, y0 = (ev.clientY - sr.top) / zoom;
      let x1 = x0, y1 = y0;
      const box = document.createElement('div');
      box.className = 'rm-marquee';
      box.style.left = x0 + 'px'; box.style.top = y0 + 'px';
      stage.appendChild(box);
      const mv = e => {
        x1 = (e.clientX - sr.left) / zoom; y1 = (e.clientY - sr.top) / zoom;
        box.style.left = Math.min(x0, x1) + 'px';
        box.style.top = Math.min(y0, y1) + 'px';
        box.style.width = Math.abs(x1 - x0) + 'px';
        box.style.height = Math.abs(y1 - y0) + 'px';
      };
      const up = () => {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
        const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
        box.remove();
        if (w < 60 || h < 50) return;
        const wrap = document.getElementById('rm-wrap');
        const nz = Math.max(0.5, Math.min(1.6, Math.min(wrap.clientWidth / (w + 70), wrap.clientHeight / (h + 70))));
        TF.RM.zoom = Math.round(nz * 10) / 10;
        TF.RM.userZoom = true;
        TF.RM.scroll = {
          l: Math.max(0, Math.min(x0, x1) * TF.RM.zoom - 24),
          t: Math.max(0, Math.min(y0, y1) * TF.RM.zoom - 24)
        };
        TF.App.render();
        setTimeout(() => {
          const w2 = document.getElementById('rm-wrap');
          if (w2) { w2.scrollLeft = TF.RM.scroll.l; w2.scrollTop = TF.RM.scroll.t; }
        }, 0);
        TF.toast('已放大到 ' + Math.round(TF.RM.zoom * 100) + '%');
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });

    fitStage();
    if (!TF._rmResizeBound) {
      TF._rmResizeBound = true;
      let rt = null;
      window.addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(() => {
          if (TF.App && TF.App.view && TF.App.view.type === 'process') {
            try { fitStage(); } catch (e) { }
          }
        }, 120);
      });
    }

    // 缩放
    const wrap = document.getElementById('rm-wrap');
    if (wrap) {
      wrap.scrollLeft = (TF.RM.scroll || {}).l || 0;
      wrap.scrollTop = (TF.RM.scroll || {}).t || 0;
      wrap.addEventListener('scroll', () => { TF.RM.scroll = { l: wrap.scrollLeft, t: wrap.scrollTop }; });
      wrap.addEventListener('wheel', e => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        TF.rmZoom(e.deltaY > 0 ? -0.1 : 0.1);
      }, { passive: false });
    }
  };

  TF.rmZoom = function (delta) {
    TF.RM.userZoom = true;
    TF.RM.zoom = Math.max(0.5, Math.min(1.4, Math.round((TF.RM.zoom + delta) * 10) / 10));
    const z = document.getElementById('rm-zoom'), s = document.getElementById('rm-stage');
    const p = curProcess();
    if (z && s) {
      z.style.width = stageW(p) * TF.RM.zoom + 'px';
      z.style.height = stageH(p) * TF.RM.zoom + 'px';
      s.style.transform = `scale(${TF.RM.zoom})`;
    }
    const lb = document.getElementById('rm-zoom-label');
    if (lb) lb.textContent = Math.round(TF.RM.zoom * 100) + '%';
  };

  /* 整理：按依赖关系分层（树状），同层同轨道的节点纵向堆叠 */
  TF.rmAutoLayout = function () {
    const p = curProcess();
    const byId = {};
    p.nodes.forEach(n => { byId[n.id] = n; });

    const depth = {};
    const calc = (n, stack) => {
      if (depth[n.id] != null) return depth[n.id];
      if (stack[n.id]) return 0;
      stack[n.id] = true;
      const pres = (n.requires || []).map(id => byId[id]).filter(x => x && x.id !== n.id);
      const d = pres.length ? Math.max.apply(null, pres.map(x => calc(x, stack))) + 1 : 0;
      stack[n.id] = false;
      depth[n.id] = d;
      return d;
    };
    p.nodes.forEach(n => calc(n, {}));

    const CARD_H = 104, GAP = 24;
    /* 同轨道 + 同深度 → 一组，纵向堆叠 */
    const groups = {};
    p.nodes.forEach(n => {
      const key = n.laneId + '#' + depth[n.id];
      (groups[key] = groups[key] || []).push(n);
    });

    /* 先按堆叠层数撑高轨道，再落位 */
    p.lanes.forEach(l => {
      const cnt = Math.max(0, ...p.nodes.filter(n => n.laneId === l.id)
        .map(n => groups[n.laneId + '#' + depth[n.id]].length));
      const need = cnt ? TF.RM_PAD_TOP + cnt * CARD_H + (cnt - 1) * GAP + TF.RM_PAD_TOP : 0;
      l.h = Math.max(TF.RM_MIN_H, Math.min(TF.RM_MAX_H, need || TF.RM_ROW));
    });

    const tops = TF.laneTops(p);
    Object.keys(groups).forEach(key => {
      const parts = key.split('#');
      const laneId = parts[0], d = +parts[1];
      const li = p.lanes.findIndex(l => l.id === laneId);
      const arr = groups[key].sort((a, b) => (a.y - b.y) || (a.x - b.x));
      const base = (tops[li] || 0) + TF.RM_PAD_TOP;
      arr.forEach((n, i) => {
        n.x = TF.RM_PAD_L + d * TF.RM_STEP;
        n.y = base + i * (CARD_H + GAP);
      });
    });

    S().save(); TF.App.render();
    TF.toast('已整理：按依赖分层，并列节点纵向排列');
  };

  /* ---------- 节点详情抽屉 ---------- */
  TF.openNode = function (id) {
    const n = S().node(id); if (!n) return;
    const p = S().nodeProcess(id);
    TF.RM.selected = id;
    const box = document.getElementById('drawer');
    box.classList.add('open');
    box.setAttribute('aria-hidden', 'false');
    if (TF.scrim) TF.scrim(true);
    TF.openTaskId = null;
    TF.App.selTask = null;

    const deps = p.nodes.filter(x => x.id !== n.id);
    const depHtml = deps.length ? deps.map(d => {
      const on = (n.requires || []).includes(d.id);
      const st = S().nodeState(d, p);
      return `<label class="dep-i ${on ? 'on' : ''}" data-act="node-dep" data-id="${d.id}">
        <span class="bx"><svg class="ic"><use href="#i-check"/></svg></span>
        <span class="nm">${esc(d.title)}</span>
        <span class="st">${stateText[st]}</span></label>`;
    }).join('') : `<div style="font-size:12px;color:var(--tx3);padding:6px">该进程下没有其他节点</div>`;

    const cks = (n.checklist || []).map(c => {
      const task = c.taskId ? S().task(c.taskId) : null;
      return `<div class="ck-i ${c.done ? 'done' : ''}">
        <div class="cbx" data-act="ck-toggle" data-id="${c.id}"><svg class="ic"><use href="#i-check"/></svg></div>
        <span class="t">${esc(c.title)}</span>
        ${task ? `<span class="gen" title="已生成任务">已建任务</span>` : ''}
        <button class="icon-btn" data-act="ck-del" data-id="${c.id}" style="width:22px;height:22px"><svg class="ic xs"><use href="#i-x"/></svg></button>
      </div>`;
    }).join('') || `<div style="font-size:12px;color:var(--tx3);padding:4px 2px">还没有检查项。检查项是节点进度的来源。</div>`;

    box.innerHTML = `
      <div class="dw-head">
        <h2 class="t">进程节点</h2>
        <button class="btn sm" data-act="node-auto" data-id="${n.id}" title="保存并自动定状态">自动</button>
        <button class="icon-btn" data-act="close-drawer"><svg class="ic"><use href="#i-x"/></svg></button>
      </div>
      <div class="dw-body">
        <input class="dw-title" id="node-title" value="${esc(n.title)}" placeholder="节点名称">
        <div class="dw-row"><span class="lab">所属轨道</span><span class="val">
          <select id="node-lane">${p.lanes.map(l => `<option value="${l.id}" ${l.id === n.laneId ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>
        </span></div>
        <div class="dw-row"><span class="lab">状态</span><span class="val">
          <div class="seg" id="node-status">
            <button data-v="auto" class="${n.status === 'auto' ? 'on' : ''}">自动</button>
            <button data-v="active" class="${n.status === 'active' ? 'on' : ''}">进行中</button>
            <button data-v="done" class="${n.status === 'done' ? 'on' : ''}">已完成</button>
          </div>
          <span style="font-size:11px;color:var(--tx3)">${stateText[S().nodeState(n, p)]}</span>
        </span></div>
        <div class="dw-row"><span class="lab">目标日期</span><span class="val">
          <input type="date" id="node-due" value="${n.due || ''}">
          ${n.due ? `<button class="btn sm ghost" data-act="node-clear-due">清除</button>` : ''}
        </span></div>

        <div class="dw-sec">
          <h3 class="dw-sec-h">描述</h3>
          <textarea class="dw-note" id="node-desc" placeholder="完成标准、验收条件…">${esc(n.desc || '')}</textarea>
        </div>

        <div class="dw-sec">
          <h3 class="dw-sec-h">检查项
            <span style="color:var(--tx3);font-weight:400">${(n.checklist || []).filter(c => c.done).length}/${(n.checklist || []).length}</span>
            <span class="r"><button class="btn sm ghost" data-act="ck-add">+ 添加</button></span>
          </h3>
          ${cks}
        </div>

        <div class="dw-sec">
          <h3 class="dw-sec-h">前置依赖（完成后才解锁）
            <span class="r"><span style="font-size:11px;color:var(--tx3)">${(n.requires || []).length} 个</span></span>
          </h3>
          <div class="dep-list">${depHtml}</div>
        </div>

        <div class="dw-sec">
          <h3 class="dw-sec-h">关联任务</h3>
          <div id="node-tasks">${(() => {
            const arr = S().data.tasks.filter(t => t.nodeId === n.id);
            if (!arr.length) return `<div style="font-size:12px;color:var(--tx3);padding:2px">没有关联任务</div>`;
            return arr.map(t => `<div class="ck-i ${t.done ? 'done' : ''}">
              <div class="cbx" data-act="toggle" data-id="${t.id}"><svg class="ic"><use href="#i-check"/></svg></div>
              <span class="t">${esc(t.title)}</span></div>`).join('');
          })()}</div>
          <button class="btn sm ghost" data-act="ck-to-tasks" data-id="${n.id}" style="margin-top:8px">
            <svg class="ic xs"><use href="#i-plus"/></svg>把未完成检查项生成任务</button>
        </div>
      </div>
      <div class="dw-foot">
        <button class="btn sm danger" data-act="node-del" data-id="${n.id}"><svg class="ic xs"><use href="#i-trash"/></svg>删除节点</button>
        <span style="margin-left:auto">${esc(p.name)}</span>
      </div>`;

    TF.bindDrawerNode(n, p);
    TF.App.render();
  };

  TF.bindDrawerNode = function (n, p) {
    const box = document.getElementById('drawer');
    const ti = box.querySelector('#node-title');
    ti.addEventListener('input', () => {
      n.title = ti.value; S().save();
      ti.style.height = 'auto'; ti.style.height = ti.scrollHeight + 'px';
      TF.App.render();
    });
    setTimeout(() => { ti.style.height = ti.scrollHeight + 'px'; }, 0);
    box.querySelector('#node-desc').addEventListener('input', e => { n.desc = e.target.value; S().save(); });
    box.querySelector('#node-lane').addEventListener('change', e => {
      const lane = p.lanes.find(l => l.id === e.target.value);
      n.laneId = lane.id;
      const li = p.lanes.indexOf(lane);
      n.y = li * ROW_H + PAD_TOP;
      const sib = p.nodes.filter(x => x.laneId === lane.id && x.id !== n.id);
      n.x = Math.max(n.x, PAD_L + sib.length * 0);
      S().save(); TF.App.render();
    });
    box.querySelector('#node-due').addEventListener('change', e => { n.due = e.target.value || null; S().save(); TF.App.render(); });
    box.querySelectorAll('#node-status button').forEach(b => b.addEventListener('click', () => {
      n.status = b.dataset.v; S().save(); TF.openNode(n.id);
    }));
  };

  /* ---------- 弹窗：新建 / 编辑进程 ---------- */
  TF.modalProcess = function (p) {
    const isNew = !p;
    TF.modal(isNew ? '新建进程' : '进程设置', `
      <div class="field"><label>名称</label>
        <input type="text" id="mp-name" value="${esc(p ? p.name : '')}" placeholder="例如：把作品从 0 做到 1"></div>
      <div class="field"><label>一句话说明</label>
        <textarea id="mp-desc" placeholder="这个进程的终点是什么？">${esc(p ? p.desc : '')}</textarea></div>
      <div class="field"><label>图标</label>
        <input type="text" id="mp-icon" value="${esc(p ? p.icon : '🎯')}" style="width:70px;text-align:center"></div>
      <div class="field"><label>颜色</label>
        <div class="swatches" id="mp-colors">${TF.colors.map((c, i) => `<div class="sw ${(p ? p.color : TF.colors[0]) === c ? 'on' : ''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div></div>
      ${isNew ? `<div class="field"><label>轨道</label>
        <input type="text" id="mp-lanes" value="主线, 支线" placeholder="用逗号分隔">
        <div class="hint">主线在前；支线可以并行推进。</div></div>` : ''}
    `, [isNew ? { label: '创建', pri: true, fn: () => {
      const name = document.getElementById('mp-name').value.trim() || '新进程';
      const desc = document.getElementById('mp-desc').value.trim();
      const icon = document.getElementById('mp-icon').value.trim() || '🎯';
      const color = document.querySelector('#mp-colors .sw.on').dataset.c;
      const lanes = (document.getElementById('mp-lanes').value || '主线').split(/[,，]/).map(s => s.trim()).filter(Boolean);
      const np = S().addProcess(name, desc, icon, color);
      np.lanes = lanes.map((nm, i) => ({ id: TF.uid('ln'), name: nm, color: i === 0 ? color : TF.colors[(i + 2) % TF.colors.length] }));
      S().save(); TF.RM.processId = np.id; TF.closeModal(); TF.App.render();
    } } : { label: '保存', pri: true, fn: () => {
      p.name = document.getElementById('mp-name').value.trim() || p.name;
      p.desc = document.getElementById('mp-desc').value.trim();
      p.icon = document.getElementById('mp-icon').value.trim() || '🎯';
      p.color = document.querySelector('#mp-colors .sw.on').dataset.c;
      S().save(); TF.closeModal(); TF.App.render();
    } }, { label: '取消', fn: TF.closeModal }]);
    document.querySelectorAll('#mp-colors .sw').forEach(sw => sw.addEventListener('click', () => {
      document.querySelectorAll('#mp-colors .sw').forEach(x => x.classList.remove('on'));
      sw.classList.add('on');
    }));
  };

  TF.modalNode = function (p) {
    const laneOpts = p.lanes.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
    TF.modal('新建节点', `
      <div class="field"><label>节点名称</label><input type="text" id="mn-title" placeholder="例如：MVP 开发"></div>
      <div class="field"><label>轨道</label><select id="mn-lane">${laneOpts}</select></div>
      <div class="field"><label>完成标准（可留空）</label><textarea id="mn-desc" placeholder="做到什么程度算完成？"></textarea></div>
      <div class="field"><label>依赖</label>
        <select id="mn-req"><option value="">无（开局即可开始）</option>
        ${p.nodes.map(n => `<option value="${n.id}">${esc(n.title)}</option>`).join('')}</select>
        <div class="hint">也可以建完再到右侧面板里勾选多个前置。</div></div>
    `, [{ label: '创建', pri: true, fn: () => {
      const lane = document.getElementById('mn-lane').value;
      const n = S().addNode(p.id, lane, document.getElementById('mn-title').value.trim() || '新节点');
      n.desc = document.getElementById('mn-desc').value.trim();
      const req = document.getElementById('mn-req').value;
      if (req) n.requires = [req];
      S().save(); TF.closeModal(); TF.App.render(); TF.openNode(n.id);
    } }, { label: '取消', fn: TF.closeModal }]);
    setTimeout(() => document.getElementById('mn-title').focus(), 60);
  };

  /* ---------------- 进程模板 ---------------- */
  const TPL = [
    {
      id: 'kaoyan', name: '考研上岸', icon: '📚', color: '#5b8cff',
      desc: '从择校到复试，一条完整的主线 + 两条支撑支线',
      lanes: [['主线', '#5b8cff'], ['公共课', '#2bd4a3'], ['状态', '#f5a623']],
      nodes: [
        ['主线', '确定目标院校', '看 3 所院校的分数线与真题风格', ['收集近 3 年分数线', '对比专业课难度', '定 1 所主申 + 1 所保底']],
        ['主线', '基础阶段', '数学与专业课过一遍教材', ['数学基础 30 讲', '专业课教材 1 轮', '整理错题本']],
        ['主线', '强化阶段', '真题 + 专项突破', ['真题 1 刷', '薄弱章节专项', '开始背诵手册']],
        ['主线', '冲刺阶段', '模拟 + 查漏', ['全真模拟 3 套', '背诵 3 轮', '考场流程演练']],
        ['主线', '初试', '两天考试', ['准考证与证件', '提前踩点', '考后估分']],
        ['主线', '复试 / 调剂', '准备面试与材料', ['简历与个人陈述', '英文自我介绍', '模拟面试 2 次']],
        ['公共课', '英语单词', '每天 100 词，滚动复习', ['核心词 1 轮', '核心词 2 轮', '真题词汇']],
        ['公共课', '政治选择题', '8 月启动，刷选择题', ['精讲精练', '1000 题 1 刷', '1000 题 2 刷']],
        ['状态', '稳定作息', '固定起床与睡觉时间', ['连续 7 天 7:00 起', '连续 21 天']],
        ['状态', '每周运动 3 次', '跑步或力量，别熬垮', ['办卡或装备', '连续 4 周']]
      ]
    },
    {
      id: 'fitness', name: '健身 12 周', icon: '💪', color: '#2bd4a3',
      desc: '把体能与体型目标拆成可执行的 12 周',
      lanes: [['训练', '#2bd4a3'], ['饮食', '#f5a623'], ['记录', '#a06bff']],
      nodes: [
        ['训练', '体测与基线', '记录体重、围度、1RM', ['晨起体重', '三围', '深蹲/卧推/硬拉测试']],
        ['训练', '适应期 1-4 周', '建立动作模式', ['每周 3 练', '学会 6 个基础动作', '记录训练日志']],
        ['训练', '增力期 5-8 周', '线性加重', ['深蹲 +10kg', '卧推 +5kg', '每周复盘']],
        ['训练', '冲刺期 9-12 周', '强度与容量提升', ['周期化安排', '最后一次体测']],
        ['饮食', '蛋白质达标', '每天 1.6g/kg', ['记录 3 天饮食', '连续 4 周达标']],
        ['饮食', '控糖', '减少含糖饮料', ['替换为零卡', '连续 21 天']],
        ['记录', '每周照片', '同角度同光线', ['第 1 周', '第 6 周', '第 12 周']]
      ]
    },
    {
      id: 'side', name: '副业变现', icon: '🚀', color: '#a06bff',
      desc: '从想法到第一笔收入，主线加增长支线',
      lanes: [['主线', '#a06bff'], ['增长', '#5b8cff'], ['交付', '#2bd4a3']],
      nodes: [
        ['主线', '找准需求', '和 10 个潜在用户聊', ['列 20 个候选方向', '访谈 10 人', '选一个']],
        ['主线', '做一个能卖的东西', '最小可交付版本', ['定义交付物', '定价', '做出来']],
        ['主线', '卖出第一单', '不靠朋友，靠陌生人', ['发布渠道', '成交 1 单']],
        ['主线', '复盘与迭代', '看数据改产品', ['收集反馈', '改 3 个点']],
        ['增长', '内容账号', '每周 2 条真实记录', ['定平台', '发 8 条', '找到爆款结构']],
        ['增长', '私域沉淀', '把流量变成可触达的人', ['建群或通讯录', '每周一次触达']],
        ['交付', 'SOP', '把交付流程写下来', ['流程图', '模板化', '第一次外包']]
      ]
    },
    {
      id: 'product', name: '产品上线', icon: '🧩', color: '#5b8cff',
      desc: '需求 → MVP → 内测 → 发布',
      lanes: [['主线', '#5b8cff'], ['技术', '#a06bff']],
      nodes: [
        ['主线', '需求验证', '确认痛点真实存在', ['访谈 10 人', '确认付费意愿']],
        ['主线', '原型', '可点击的核心路径', ['信息架构', '关键页', '可用性测试']],
        ['主线', 'MVP', '最小闭环', ['核心功能', '自测']],
        ['主线', '内测', '20 位种子用户', ['邀请页', '收集反馈', '修首轮问题']],
        ['主线', '正式发布', '对外公开', ['发布说明', '演示视频', '上线清单']],
        ['技术', '技术选型', '先定不返工', ['方案对比', 'PoC 验证']],
        ['技术', '数据层', '本地优先', ['存储封装', '迁移策略']],
        ['技术', '自动化', '构建与发布脚本', ['一键打包', '版本号规范']]
      ]
    },
    {
      id: 'read', name: '一年读 12 本', icon: '📖', color: '#d174e8',
      desc: '每月一本，输出短评与卡片',
      lanes: [['阅读', '#d174e8'], ['输出', '#f5a623']],
      nodes: [
        ['阅读', '列书单', '12 本，难易搭配', ['3 本硬书', '3 本轻松', '定顺序']],
        ['阅读', '第 1 季度', '3 本', ['读完 1', '读完 2', '读完 3']],
        ['阅读', '第 2 季度', '3 本', ['读完 4', '读完 5', '读完 6']],
        ['阅读', '第 3 季度', '3 本', ['读完 7', '读完 8', '读完 9']],
        ['阅读', '第 4 季度', '3 本', ['读完 10', '读完 11', '读完 12']],
        ['输出', '每月短评', '不少于 300 字', ['写 6 篇', '写 12 篇']]
      ]
    },
    {
      id: 'skill', name: '学一门新技能', icon: '🧪', color: '#25c2d4',
      desc: '任何技能都能套的 8 关：从模仿到作品',
      lanes: [['学习', '#25c2d4'], ['实践', '#2bd4a3']],
      nodes: [
        ['学习', '搞清楚地图', '这个领域的高手在做什么', ['找 3 个标杆', '拆解他们的路径']],
        ['学习', '最小知识集', '20% 的核心概念', ['列出 10 个概念', '逐个吃透']],
        ['学习', '跟做一遍', '照着教程做一次', ['完成 1 个跟练']],
        ['学习', '脱离教程', '不看资料重做', ['独立完成 1 次']],
        ['实践', '做个小作品', '能给别人看的', ['定题目', '做出来']],
        ['实践', '公开它', '接受反馈', ['发出去', '收集 5 条反馈']]
      ]
    }
  ];

  TF.PROCESS_TEMPLATES = TPL;

  TF.openTemplates = function () {
    TF.modal('从模板新建进程', `
      <div class="tpl-grid">
        ${TPL.map(t => `<button class="tpl" data-tpl="${t.id}">
          <div class="tpl-ico" style="background:${t.color}22;color:${t.color}">${t.icon}</div>
          <div class="tpl-tx"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span>
            <em>${t.nodes.length} 个节点 · ${t.lanes.length} 条轨道</em></div>
        </button>`).join('')}
      </div>`, [{ label: '取消', fn: TF.closeModal }]);
    document.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => {
      const t = TPL.find(x => x.id === b.dataset.tpl);
      TF.closeModal();
      const p = S().addProcess(t.name, t.desc, t.icon, t.color);
      p.lanes = t.lanes.map(([nm, c]) => ({ id: TF.uid('ln'), name: nm, color: c }));
      const byTitle = {};
      p.nodes = [];
      t.nodes.forEach(([laneName, title, desc, ck], i) => {
        const lane = p.lanes.find(l => l.name === laneName) || p.lanes[0];
        const n = {
          id: TF.uid('n'), processId: p.id, laneId: lane.id, title, desc,
          x: 0, y: 0, requires: [], checklist: (ck || []).map(x => ({ id: TF.uid('s'), title: x, done: false, taskId: null })),
          status: 'auto', due: null, createdAt: new Date().toISOString()
        };
        byTitle[title] = n;
        p.nodes.push(n);
      });
      // 同轨道串行：前一个节点是后一个的前置
      p.lanes.forEach(l => {
        const ns = p.nodes.filter(n => n.laneId === l.id);
        ns.forEach((n, i) => { if (i > 0) n.requires = [ns[i - 1].id]; });
      });
      TF.layoutProcess(p);
      S().save();
      TF.RM.processId = p.id;
      TF.App.view = { type: 'process' };
      TF.App.render();
      TF.toast('已创建「' + t.name + '」');
    }));
  };

})();
