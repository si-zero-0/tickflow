/* ===== 工具：习惯 / 番茄钟 / 统计 ===== */
(function () {
  const TF = window.TF, S = () => TF.Store, esc = TF.esc;

  /* ================= 习惯 ================= */
  TF.renderHabits = function () {
    const hs = S().data.habits;
    const t = TF.today();
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(TF.addDays(t, -i));

    const rows = hs.map(h => {
      const streak = S().habitStreak(h);
      let last30 = 0;
      for (let i = 0; i < 30; i++) if (h.records[TF.addDays(t, -i)]) last30++;
      return `<div class="habit">
        <div class="h-ico" style="background:${h.color}22;color:${h.color}">${h.icon}</div>
        <div class="h-main"><b>${esc(h.name)}</b><span>近 30 天 ${last30} 次 · ${Math.round(last30 / 30 * 100)}%</span></div>
        <div class="days">
          ${days.map(d => `<div class="hd ${h.records[d] ? 'on' : ''} ${d === t ? 'today' : ''}" data-act="habit-toggle" data-id="${h.id}" data-day="${d}">
            <span>${TF.weekNames[TF.parseDate(d).getDay()]}</span>
            <svg class="ic"><use href="#i-check"/></svg></div>`).join('')}
        </div>
        <div class="h-streak"><b>${streak}</b> 天</div>
        <button class="icon-btn" data-act="habit-del" data-id="${h.id}" title="删除"><svg class="ic sm"><use href="#i-trash"/></svg></button>
      </div>`;
    }).join('');

    return `<div class="wrap">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="font-size:12.5px;color:var(--tx3)">每天点一下，连续天数会累积。全部本地记录。</div>
        <button class="btn sm pri" style="margin-left:auto" data-act="new-habit"><svg class="ic xs"><use href="#i-plus"/></svg>新建习惯</button>
      </div>
      <div class="card" style="padding:6px 16px">
        ${rows || `<div class="empty"><svg class="ic"><use href="#i-repeat"/></svg><b>还没有习惯</b>先加一个想坚持的小事</div>`}
      </div>
      <div style="margin-top:10px;font-size:11.5px;color:var(--tx3)">提示：习惯打卡与任务完成都会计入统计页。</div>
    </div>`;
  };

  /* ================= 番茄钟 ================= */
  TF.Pomo = { mode: 'work', remain: 25 * 60, running: false, endAt: 0, taskId: '', rounds: 0 };

  TF.pomoTotal = function () {
    const s = S().data.settings.pomo;
    return (TF.Pomo.mode === 'work' ? s.work : TF.Pomo.mode === 'short' ? s.short : s.long) * 60;
  };

  TF.renderPomodoro = function () {
    const P = TF.Pomo, total = TF.pomoTotal();
    const done = S().pomoToday();
    const mins = done.reduce((a, b) => a + b.minutes, 0);
    const tasks = S().data.tasks.filter(t => !t.done);
    const pct = P.remain / total;
    const size = 288, r = 132, c = 2 * Math.PI * r;

    return `<div class="wrap">
      <div class="pomo-wrap">
        <div>
          <div class="pomo-ring">
            <svg viewBox="0 0 ${size} ${size}">
              <circle cx="144" cy="144" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/>
              <circle id="pomo-arc" cx="144" cy="144" r="${r}" fill="none" stroke="${P.mode === 'work' ? 'var(--ac)' : 'var(--ok)'}"
                stroke-width="6" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"
                style="transition:stroke-dashoffset .5s linear"/>
            </svg>
            <div class="pomo-face">
              <div class="lb">${P.mode === 'work' ? '专注' : P.mode === 'short' ? '短休息' : '长休息'}</div>
              <div class="tm" id="pomo-time">${fmt(P.remain)}</div>
              <div class="rd" id="pomo-hint">${P.running ? '进行中 · 保持专注' : '按空格或点击开始'}</div>
            </div>
          </div>
          <div class="pomo-ctl">
            <button class="btn pri" data-act="pomo-toggle" style="min-width:104px;justify-content:center">
              <svg class="ic sm"><use href="#${P.running ? 'i-pause' : 'i-play'}"/></svg>${P.running ? '暂停' : '开始'}</button>
            <button class="btn" data-act="pomo-reset"><svg class="ic sm"><use href="#i-repeat"/></svg>重置</button>
            <button class="btn ghost" data-act="pomo-skip">跳过</button>
          </div>
          <div style="display:flex;justify-content:center;gap:2px;margin-top:14px" class="seg">
            ${[['work', '专注'], ['short', '短休 5′'], ['long', '长休 15′']].map(([k, n]) =>
              `<button data-act="pomo-mode" data-v="${k}" class="${P.mode === k ? 'on' : ''}">${n}</button>`).join('')}
          </div>
        </div>

        <div class="pomo-side">
          <div class="card" style="padding:14px">
            <div class="card-h"><h3>今日专注</h3><span class="r">${done.length} 个番茄</span></div>
            <div style="display:flex;align-items:baseline;gap:6px"><span style="font-size:32px;font-weight:700;letter-spacing:-1px">${mins}</span><span style="color:var(--tx3);font-size:12px">分钟</span></div>
            <div class="bar thick" style="margin-top:10px"><i style="width:${Math.min(100, mins / 120 * 100)}%"></i></div>
            <div style="font-size:11px;color:var(--tx3);margin-top:6px">目标 120 分钟 / 天</div>
          </div>
          <div class="card" style="padding:14px">
            <div class="card-h"><h3>本次专注的任务</h3></div>
            <select id="pomo-task" style="width:100%;background:var(--panel2);border:1px solid var(--line);border-radius:7px;padding:6px 8px;font-size:12.5px">
              <option value="">不关联任务</option>
              ${tasks.map(t => `<option value="${t.id}" ${P.taskId === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}
            </select>
            <div style="font-size:11px;color:var(--tx3);margin-top:7px">完成的番茄会记录到该任务上。</div>
          </div>
          <div class="card" style="padding:14px">
            <div class="card-h"><h3>今日记录</h3></div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              ${done.length ? done.map(p => `<span class="pill" style="background:color-mix(in srgb,var(--ok) 14%,transparent);color:var(--ok);border-color:transparent">🍅 ${new Date(p.ts).getHours().toString().padStart(2, '0')}:${new Date(p.ts).getMinutes().toString().padStart(2, '0')}</span>`).join('') : `<span style="font-size:12px;color:var(--tx3)">今天还没有番茄</span>`}
            </div>
          </div>
        </div>
      </div>
    </div>`;
  };

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }
  TF.fmtTime = fmt;

  TF.pomoStart = function () {
    const P = TF.Pomo;
    if (P.running) { P.running = false; P.remain = Math.max(0, (P.endAt - Date.now()) / 1000); }
    else {
      if (P.remain <= 0) P.remain = TF.pomoTotal();
      P.running = true; P.endAt = Date.now() + P.remain * 1000;
    }
    TF.App.render();
  };
  TF.pomoReset = function () {
    const P = TF.Pomo;
    P.running = false; P.remain = TF.pomoTotal(); TF.App.render();
  };
  TF.pomoSetMode = function (m) {
    const P = TF.Pomo;
    P.mode = m; P.running = false; P.remain = TF.pomoTotal(); TF.App.render();
  };
  TF.pomoSkip = function () {
    const P = TF.Pomo;
    P.running = false;
    P.mode = P.mode === 'work' ? 'short' : 'work';
    P.remain = TF.pomoTotal();
    TF.App.render();
  };
  TF.pomoTick = function () {
    const P = TF.Pomo;
    if (!P.running) return;
    const left = (P.endAt - Date.now()) / 1000;
    P.remain = Math.max(0, left);
    const el = document.getElementById('pomo-time');
    const arc = document.getElementById('pomo-arc');
    if (el) {
      el.textContent = fmt(P.remain);
      const total = TF.pomoTotal();
      if (arc) {
        const c = 2 * Math.PI * 132;
        arc.style.strokeDashoffset = c * (1 - P.remain / total);
      }
    }
    if (left <= 0) {
      P.running = false;
      if (P.mode === 'work') {
        S().logPomo(S().data.settings.pomo.work, P.taskId);
        P.rounds++;
        const long = P.rounds % S().data.settings.pomo.rounds === 0;
        TF.toast('🍅 专注完成，' + (long ? '来个长休息' : '休息 5 分钟'));
        P.mode = long ? 'long' : 'short';
      } else {
        TF.toast('休息结束，继续专注');
        P.mode = 'work';
      }
      P.remain = TF.pomoTotal();
      TF.App.render();
      TF.beep();
    }
  };

  /* ================= 统计 ================= */
  TF.renderStats = function () {
    const d = S().data;
    const t = TF.today();
    const todayDone = d.tasks.filter(x => x.done && x.doneAt && TF.ymd(new Date(x.doneAt)) === t).length;
    const week = d.tasks.filter(x => x.done && x.doneAt && TF.diffDays(t, TF.ymd(new Date(x.doneAt))) < 7).length;
    const active = d.tasks.filter(x => !x.done).length;
    const totalDone = d.tasks.filter(x => x.done).length;

    // 连续完成天数
    let streak = 0;
    for (let i = 0; ; i++) {
      const day = TF.addDays(t, -i);
      const n = d.tasks.filter(x => x.done && x.doneAt && TF.ymd(new Date(x.doneAt)) === day).length;
      if (n > 0) streak++;
      else if (i > 0) break;
      else if (i === 0) { /* 今天还没完成也允许从昨天算 */ }
      if (i > 400) break;
    }

    // 14 天
    const days = [], vals = [];
    for (let i = 13; i >= 0; i--) {
      const day = TF.addDays(t, -i);
      days.push(day);
      vals.push(d.tasks.filter(x => x.done && x.doneAt && TF.ymd(new Date(x.doneAt)) === day).length);
    }
    const maxV = Math.max(3, ...vals);
    const CW = 660, CH = 170, padB = 22, padT = 6, plotH = CH - padB - padT, slot = CW / 14;
    let bars = '';
    for (let g = 1; g <= 2; g++) {
      const y = padT + plotH - plotH * g / 2;
      bars += `<line x1="0" x2="${CW}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 5"/>`;
    }
    vals.forEach((v, i) => {
      const w = slot * 0.46, x = i * slot + (slot - w) / 2;
      const h = v === 0 ? 2 : Math.max(4, v / maxV * plotH);
      const y = padT + plotH - h;
      const today = i === 13;
      bars += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"
        fill="${v ? (today ? 'var(--ac)' : 'var(--ac)') : 'var(--line2)'}" opacity="${v ? (today ? 1 : .42 + .4 * (v / maxV)) : .8}">
        <title>${days[i]}：${v} 项</title></rect>`;
      if (v) bars += `<text x="${x + w / 2}" y="${y - 5}" text-anchor="middle" font-size="9.5" fill="var(--tx2)">${v}</text>`;
      if (i % 3 === 0 || today) {
        const wd = TF.weekNames[TF.parseDate(days[i]).getDay()];
        bars += `<text x="${x + w / 2}" y="${CH - 6}" text-anchor="middle" font-size="9.5" fill="${today ? 'var(--ac)' : 'var(--tx3)'}">${today ? '今天' : wd}</text>`;
      }
    });

    const listBars = d.lists.map(l => {
      const total = d.tasks.filter(x => x.listId === l.id).length;
      const done = d.tasks.filter(x => x.listId === l.id && x.done).length;
      const pct = total ? Math.round(done / total * 100) : 0;
      return `<div style="display:flex;align-items:center;gap:9px;margin-bottom:9px">
        <span style="width:56px;font-size:12px;color:var(--tx2);display:flex;align-items:center;gap:5px;overflow:hidden"><i style="width:6px;height:6px;border-radius:2px;background:${l.color};flex:none"></i>${esc(l.name)}</span>
        <div class="bar" style="flex:1"><i style="width:${pct}%;background:${l.color}"></i></div>
        <span style="width:56px;text-align:right;font-size:11.5px;color:var(--tx3)">${done}/${total}</span>
      </div>`;
    }).join('') || `<div style="font-size:12px;color:var(--tx3)">没有清单</div>`;

    const proc = d.processes.map(p => {
      const st = S().processStats(p);
      return `<div style="margin-bottom:11px;cursor:pointer" data-act="nav" data-view="process" data-id="${p.id}">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;font-size:12.5px">
          <span>${p.icon}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</span>
          <span style="color:var(--tx3);font-size:11px">${Math.round(st.pct * 100)}%</span></div>
        <div class="bar"><i style="width:${Math.round(st.pct * 100)}%;background:${p.color}"></i></div>
      </div>`;
    }).join('') || `<div style="font-size:12px;color:var(--tx3)">还没有进程</div>`;

    const pomo = d.pomoLog.filter(p => TF.ymd(new Date(p.ts)) === t).reduce((a, b) => a + b.minutes, 0);
    const habitToday = d.habits.filter(h => h.records[t]).length;

    return `<div class="wrap-wide">
      <div class="stat-grid">
        <div class="stat accent"><div class="k">今日完成</div><div class="v">${todayDone}<small>项</small></div></div>
        <div class="stat"><div class="k">近 7 天完成</div><div class="v">${week}<small>项</small></div></div>
        <div class="stat"><div class="k">连续完成</div><div class="v">${streak}<small>天</small></div></div>
        <div class="stat"><div class="k">待办总数</div><div class="v">${active}<small>项</small></div></div>
      </div>

      <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:12px;margin-bottom:12px" class="stats-cols">
        <div class="card">
          <div class="card-h"><h3>近 14 天完成趋势</h3><span class="r">共 ${vals.reduce((a, b) => a + b, 0)} 项</span></div>
          <svg viewBox="0 0 ${CW} ${CH}" style="width:100%;height:auto;display:block;overflow:visible">${bars}</svg>
          <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--tx3);margin-top:6px">
            <span>${days[0].slice(5)} 起 · 近 14 天</span><span>峰值 ${maxV} 项/天</span></div>
        </div>
        <div class="card">
          <div class="card-h"><h3>清单完成度</h3><span class="r">累计 ${totalDone} 项</span></div>
          ${listBars}
          <div style="border-top:1px solid var(--line);margin-top:12px;padding-top:11px;display:flex;gap:16px;font-size:12px;color:var(--tx2)">
            <span>🍅 ${pomo} 分钟</span><span>✅ 习惯 ${habitToday}/${d.habits.length}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>进程推进</h3><span class="r">${d.processes.length} 个进程</span></div>
        ${proc}
      </div>
    </div>`;
  };
})();
