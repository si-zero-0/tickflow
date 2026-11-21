/* ===== 今日时间轴：把带时刻的任务摆到 24 小时刻度上 ===== */
(function () {
  const TF = window.TF, S = () => TF.Store, esc = TF.esc;
  const PX = 1.05;          // 每分钟像素
  const H24 = 24 * 60 * PX; // 总高度

  function toMin(s) {
    if (!s) return null;
    const m = String(s).match(/^(\d{1,2}):(\d{2})/);
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  function fmt(min) {
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  TF.renderTimeline = function () {
    const t = TF.today();
    const all = S().data.tasks.filter(x => !x.done && x.due === t);
    const timed = all.filter(x => x.dueTime).map(x => {
      const start = toMin(x.dueTime);
      let end = x.dueEnd ? toMin(x.dueEnd) : null;
      if (end != null && end <= start) end = start + 30;
      if (end == null) end = start + 30;
      return { task: x, start, end: Math.min(1440, end) };
    }).sort((a, b) => a.start - b.start || b.end - a.end);
    const loose = all.filter(x => !x.dueTime);

    // 重叠分列：按「重叠簇」单独分配列宽，互不重叠的簇占满整行
    let cluster = [], clusterEnd = -1;
    const flush = () => {
      if (!cluster.length) return;
      const colEnd = [];
      cluster.forEach(b => {
        let ci = colEnd.findIndex(e => e <= b.start);
        if (ci < 0) { colEnd.push(b.end); ci = colEnd.length - 1; }
        else colEnd[ci] = b.end;
        b.col = ci;
      });
      const width = 100 / colEnd.length;
      cluster.forEach(b => { b.cols = colEnd.length; b.w = width; });
      cluster = []; clusterEnd = -1;
    };
    timed.forEach(b => {
      if (!cluster.length || b.start < clusterEnd) {
        cluster.push(b);
        clusterEnd = Math.max(clusterEnd, b.end);
      } else { flush(); cluster.push(b); clusterEnd = b.end; }
    });
    flush();
    const conflicts = timed.length - new Set(timed.map(b => b.col)).size > 0 ? 1 : 0;

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const hours = [];
    for (let h = 0; h <= 24; h++) {
      hours.push(`<div class="tl-hour" style="top:${h * 60 * PX}px"><span>${String(h).padStart(2, '0')}:00</span></div>`);
    }

    const blocks = timed.map(b => {
      const l = S().list(b.task.listId) || { color: 'var(--ac)', name: '' };
      const top = b.start * PX;
      const h = Math.max(26, (b.end - b.start) * PX - 3);
      const w = b.w || 100;
      const small = h < 40;
      return `<div class="tl-block ${small ? 'small' : ''}" data-open="${b.task.id}"
          style="top:${top}px;height:${h}px;left:calc(${b.col * w}% + 2px);width:calc(${w}% - 4px);--lc:${l.color}">
        <span class="tl-time">${esc(b.task.dueTime)}${b.task.dueEnd ? '–' + esc(b.task.dueEnd) : ''}</span>
        <span class="tl-title">${esc(b.task.title)}</span>
        ${b.task.dueEnd && !small ? `<span class="tl-sub">${esc(l.name || '')}</span>` : ''}
      </div>`;
    }).join('');

    return `<div class="wrap-wide tl-wrap">
      <div class="tl-head">
        <div class="tl-date">${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日 · 周${TF.weekNames[new Date().getDay()]}</div>
        <div class="tl-stat"><b>${timed.length}</b> 项已排时间 · <b>${loose.length}</b> 项未排</div>
        <button class="btn sm ghost" data-act="tl-now">回到此刻</button>
      </div>
      ${loose.length ? `<div class="tl-allday">
          <span class="tl-ad-h">全天 · 未排时间</span>
          <div class="tl-ad-list">${loose.map(x => {
            const l = S().list(x.listId) || { color: 'var(--tx3)' };
            return `<button class="tl-ad-c" data-open="${x.id}"><i style="background:${l.color}"></i>${esc(x.title)}</button>`;
          }).join('')}</div>
        </div>` : ''}
      <div class="tl-body">
        <div class="tl-scroll" id="tl-scroll">
          <div class="tl-canvas" style="height:${H24 + 20}px">
            ${hours.join('')}
            <div class="tl-now" style="top:${nowMin * PX}px"><span>${fmt(nowMin)}</span></div>
            <div class="tl-lane">${blocks}</div>
            ${timed.length ? '' : `<div class="tl-empty">今天还没有排定时刻的任务<br><span>在任务详情里把「时间」设成时间点或时段即可出现在这里</span></div>`}
          </div>
        </div>
      </div>
    </div>`;
  };

  TF.bindTimeline = function () {
    const box = document.getElementById('tl-scroll');
    if (!box) return;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    box.scrollTop = Math.max(0, nowMin * PX - 140);
  };
})();
