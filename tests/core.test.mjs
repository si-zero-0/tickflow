import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRenderer } from './harness.mjs';

const TF = loadRenderer(['js/core/store.js', 'js/modules/parse.js', 'js/modules/theme.js']);

/* ---------- 迁移矩阵 ---------- */
/* 构造 v1.11 风格的历史数据：可以指定 settings 的哪些键存在 / 缺失 */
function legacy(settings, extra) {
  const d = {
    version: 1,
    settings: settings,
    lists: [{ id: 'l_inbox', name: '收集箱', inbox: true, color: '#7d8ba1', icon: 'inbox', order: -1, archived: false }],
    tasks: [
      { id: 't1', listId: 'l_inbox', title: '任务一', done: false, subtasks: [], tags: [] },
      { id: 't2', listId: 'l_inbox', title: '任务二', done: true, subtasks: [], tags: [] }
    ],
    habits: [],
    processes: [],
    pomoLog: [],
    created: '2026-01-01T00:00:00.000Z'
  };
  return Object.assign(d, extra || {});
}

test('迁移：theme 四种旧值 + 未知 + 缺失 全部按映射表回退，任务数不变', () => {
  const cases = [
    [{ theme: 'dark' }, 'graphite'],
    [{ theme: 'light' }, 'mist'],
    [{ theme: 'paper' }, 'paper'],
    [{ theme: 'tundra' }, 'tundra'],
    [{ theme: 'moonlight' }, 'graphite'],
    [{}, 'graphite']
  ];
  cases.forEach(([settings, want]) => {
    const d = TF.Store.migrate(legacy(settings));
    assert.equal(d.settings.theme, want, `theme ${JSON.stringify(settings)} 应回退为 ${want}`);
    assert.equal(d.tasks.length, 2, '任务数不得因迁移变化');
  });
});

test('迁移：accent 枚举 / hex / 缺失 / 非法 全部归一', () => {
  const cases = [
    [{ accent: '#5B8CFF' }, 'blue'],
    [{ accent: '#5b8cff' }, 'blue'],
    [{ accent: '#ff00aa' }, 'rose'],
    [{ accent: 'cyan' }, 'cyan'],
    [{}, 'blue'],
    [{ accent: 'chartreuse' }, 'blue']
  ];
  cases.forEach(([settings, want]) => {
    const d = TF.Store.migrate(legacy(settings));
    assert.equal(d.settings.accent, want, `accent ${JSON.stringify(settings)} 应归一为 ${want}`);
    assert.equal(d.tasks.length, 2);
  });
});

test('迁移：缺失 wishes 补空数组，density / pomo 补齐，tasks 不动', () => {
  const d = TF.Store.migrate(legacy({ theme: 'dark', accent: '#5B8CFF' }));
  assert.ok(Array.isArray(d.wishes), 'wishes 应为数组');
  assert.equal(d.wishes.length, 0);
  assert.equal(d.settings.density, 'normal');
  assert.deepEqual(Object.keys(d.settings.pomo).sort(), ['long', 'rounds', 'short', 'work']);
  assert.equal(d.tasks.length, 2);
  assert.equal(d.tasks[0].title, '任务一');
});

test('迁移：density 只接受 normal / compact；旧 island / m3 字段被丢弃且不报错', () => {
  const d = TF.Store.migrate(legacy({ density: 'huge', island: { enabled: false }, m3: { enabled: true } }));
  assert.equal(d.settings.density, 'normal');
  assert.equal(d.settings.island, undefined, '旧 island 不残留');
  assert.equal(d.settings.m3, undefined, '旧 m3 不残留');
});

test('迁移：愿望逐条归一（非法状态、缺 doneAt、priority 越界、targetDate 非法、缺 color）', () => {
  const d = TF.Store.migrate(legacy({}, {
    wishes: [
      { title: '看极光', status: 'done' },                          // 已实现但缺 doneAt → 用 createdAt
      { title: '学陶艺', status: '不存在的状态', priority: 9, targetDate: '2027/02/01', order: 'x' },
      { title: '   ' },                                             // 空标题 → 丢弃
      null
    ]
  }));
  assert.equal(d.wishes.length, 2, '空标题与非对象应被过滤');
  const [a, b] = d.wishes;
  assert.equal(a.status, 'done');
  assert.ok(a.doneAt, '已实现愿望必须有 doneAt');
  assert.equal(a.doneAt, a.createdAt, '缺 doneAt 时用 createdAt 兜底');
  assert.equal(b.status, 'idea', '非法状态回退 idea');
  assert.equal(b.priority, 3, 'priority 夹到 0~3');
  assert.equal(b.targetDate, null, '非法日期归 null');
  assert.equal(b.doneAt, null, '非 done 的 doneAt 必须为 null');
  assert.equal(typeof b.order, 'number');
  assert.match(b.color, /^#[0-9A-F]{6}$/i, '缺 color 时给强调色默认值');
});

test('迁移：accent 不可用时 store 内置的 hex 映射与 theme.js 逐点一致', () => {
  /* 10 个锚点：6 个枚举亮色 + 1 个非常规 hex + 灰阶 + 枚举直通 + 垃圾输入。
     #F5A623(36°) 与 #FF5F7A(350°) 色相只差 46°，是最容易漂移的一对，必须留。
     只加载 store.js（没有 theme.js）→ 走内置兜底映射，与 theme.js 的 TF.hexToAccent 对比。 */
  const Only = loadRenderer(['js/core/store.js']);
  const anchor = [
    ['#5B8CFF', 'blue'],
    ['#25C2D4', 'cyan'],
    ['#2BD4A3', 'green'],
    ['#A06BFF', 'purple'],
    ['#F5A623', 'orange'],
    ['#FF5F7A', 'rose'],
    ['#ff00aa', 'rose'],
    ['#888888', 'blue'],      // 灰阶无色相 → 兜底
    ['blue', 'blue'],         // 已是枚举，直通
    ['nonsense', 'blue']      // 非法 → 兜底
  ];
  anchor.forEach(([hex, want]) => {
    const viaStore = Only.Store.migrate({ settings: { accent: hex }, lists: [], tasks: [] }).settings.accent;
    const viaTheme = TF.hexToAccent(hex);
    assert.equal(viaStore, want, `store 兜底映射：${hex} 应为 ${want}`);
    assert.equal(viaTheme, want, `theme.js 映射：${hex} 应为 ${want}`);
    assert.equal(viaStore, viaTheme, `两处映射漂移：${hex} → store=${viaStore} / theme=${viaTheme}`);
  });
});

/* ---------- 愿望 CRUD（走真实 Store，seed 数据） ---------- */
function store() {
  if (!TF.Store.data) TF.Store.load();
  return TF.Store;
}

test('seed 含 3 条愿望，其中 1 条已实现且带 doneAt', () => {
  const S = store();
  assert.equal(S.wishes().length, 3);
  const doneList = S.wishes().filter((w) => w.status === 'done');
  assert.equal(doneList.length, 1);
  assert.ok(doneList[0].doneAt, '已实现愿望必须有 doneAt');
  assert.ok(S.wishes().some((w) => w.status === 'doing'));
});

test('wishStats：统计口径为全集，实现率为整数百分比', () => {
  const S = store();
  const st = S.wishStats();
  assert.equal(st.total, 3);
  assert.equal(st.done, 1);
  assert.equal(st.undone, 2);
  assert.equal(st.rate, 33);
  assert.equal(Number.isInteger(st.rate), true);
  assert.equal(TF.wishStats([]).rate, 0);
  assert.equal(JSON.stringify(TF.wishStats([])), JSON.stringify({ total: 0, idea: 0, doing: 0, done: 0, undone: 0, rate: 0 }));
  assert.equal(TF.wishStats([{ status: 'done' }, { status: 'done' }]).rate, 100);
});

test('addWish / updateWish / wish 补默认值并落库', () => {
  const S = store();
  const before = S.wishes().length;
  const w = S.addWish({ title: '跑一次半马' });
  assert.equal(S.wishes().length, before + 1);
  assert.equal(S.wishes()[0].id, w.id, 'addWish 应 unshift 到最前');
  assert.equal(w.status, 'idea');
  assert.equal(w.priority, 0);
  assert.equal(w.desc, '');
  assert.equal(w.category, '');
  assert.equal(w.targetDate, null);
  assert.equal(w.doneAt, null);
  assert.match(w.color, /^#[0-9A-F]{6}$/i);
  assert.ok(w.createdAt);
  assert.equal(S.wish(w.id).title, '跑一次半马');
  assert.equal(S.wish('w_不存在'), null);

  S.updateWish(w.id, { title: '跑一次全马', priority: 2 });
  assert.equal(S.wish(w.id).title, '跑一次全马');
  assert.equal(S.wish(w.id).priority, 2);
  assert.equal(S.updateWish('w_不存在', { title: 'x' }), null);
});

test('setWishStatus：置 done 写 doneAt，取消实现清空；removeWish 返回布尔', () => {
  const S = store();
  const w = S.addWish({ title: '学会游泳' });
  assert.equal(w.doneAt, null);

  const done = S.setWishStatus(w.id, 'done');
  assert.equal(done.status, 'done');
  assert.ok(done.doneAt, '置 done 必须写 doneAt');

  const undone = S.setWishStatus(w.id, 'doing');
  assert.equal(undone.status, 'doing');
  assert.equal(undone.doneAt, null, '取消实现必须清空 doneAt');

  const ideaAgain = S.setWishStatus(w.id, '乱写的状态');
  assert.equal(ideaAgain.status, 'idea', '非法状态回退 idea');

  assert.equal(S.setWishStatus('w_不存在', 'done'), null);
  assert.equal(S.removeWish(w.id), true);
  assert.equal(S.wish(w.id), null);
  assert.equal(S.removeWish(w.id), false);
});

/* ---------- parseTaskInput ---------- */
const CTX = {
  today: '2026-03-05',                                   // 周四
  now: '09:00',
  lists: [{ id: 'l_work', name: '工作' }, { id: 'l_life', name: '个人' }],
  defaultListId: 'l_work',
  viewDue: null
};
const P = (text, extra) => TF.parseTaskInput(text, Object.assign({}, CTX, extra || {}));

test('日期解析：今天 / 明天 / 后天 / 大后天', () => {
  const cases = [
    ['今天买菜', '2026-03-05', '买菜'],
    ['明天开会', '2026-03-06', '开会'],
    ['后天跑步', '2026-03-07', '跑步'],
    ['大后天交稿', '2026-03-08', '交稿']
  ];
  cases.forEach(([text, due, title]) => {
    const r = P(text);
    assert.equal(r.due, due, `${text} 的 due`);
    assert.equal(r.title, title, `${text} 的 title`);
    assert.equal(r.error, '');
  });
});

test('日期解析：周X / 星期X / 礼拜X / 下周X', () => {
  assert.equal(P('周五聚餐').due, '2026-03-06', '周五 = 明天');
  assert.equal(P('周三复盘').due, '2026-03-11', '周三 = 下周三（最近的未来）');
  assert.equal(P('星期日休息').due, '2026-03-08');
  assert.equal(P('星期三写文档').due, '2026-03-11');
  assert.equal(P('礼拜一晨会').due, '2026-03-09');
  assert.equal(P('下周五复盘').due, '2026-03-13', '下周五 = 本周五 + 7');
  assert.equal(P('下周一汇报').due, '2026-03-09');
  assert.equal(P('下周日放松').due, '2026-03-15');
});

test('日期解析：M月D日（跨年）/ M-D / YYYY-MM-DD', () => {
  assert.equal(P('3月20日体检').due, '2026-03-20');
  assert.equal(P('1月5日复查').due, '2027-01-05', '早于今天的 MD 归次年');
  assert.equal(P('3-20 交表').due, '2026-03-20');
  assert.equal(P('3/20 交表').due, '2026-03-20');
  assert.equal(P('2027-01-05 复盘').due, '2027-01-05');
  assert.equal(P('2027-01-05 复盘').title, '复盘');
});

test('时间解析：HH:MM / 上午 / 下午 / 晚上（含 12 点特判）', () => {
  assert.equal(P('明天15:30开会').dueTime, '15:30');
  assert.equal(P('明天15:30开会').due, '2026-03-06');
  assert.equal(P('上午10点例会').dueTime, '10:00');
  assert.equal(P('上午12点午饭').dueTime, '12:00');
  assert.equal(P('下午3点打电话').dueTime, '15:00');
  assert.equal(P('下午12点吃饭').dueTime, '12:00');
  assert.equal(P('晚上8点跑步').dueTime, '20:00');
  assert.equal(P('9点半站会').dueTime, '09:30');
});

test('晚上 12 点顺延到次日 00:00', () => {
  const r = P('晚上12点睡觉');
  assert.equal(r.dueTime, '00:00');
  assert.equal(r.due, '2026-03-06', '晚上 12 点 = 次日零点');
});

test('非法时间不解析，原样留在标题里', () => {
  const r = P('明天 25:00 交表');
  assert.equal(r.dueTime, null);
  assert.ok(r.title.includes('25:00'), `标题应保留 25:00，实际：${r.title}`);
  assert.equal(P('25点开会').dueTime, null);
  assert.ok(P('25点开会').title.includes('25点'));
});

test('优先级：!1~!3 与 !高/中/低，同时出现取最后出现者', () => {
  assert.equal(P('买菜 !3').priority, 3);
  assert.equal(P('买菜 !1').priority, 1);
  assert.equal(P('开会 !高').priority, 3);
  assert.equal(P('开会 !中').priority, 2);
  assert.equal(P('开会 !低').priority, 1);
  assert.equal(P('写周报 !1 !高').priority, 3, '以最后出现者为准');
  assert.equal(P('写周报 !高 !2').priority, 2, '以最后出现者为准');
  assert.ok(!P('写周报 !1 !高').title.includes('!'), '优先级 token 不得进标题');
});

test('标签：可多个、去重、不进标题', () => {
  const r = P('写文档 #沟通 #设计 #沟通');
  assert.equal(r.title, '写文档');
  assert.equal(r.tags.length, 2);
  assert.equal(Array.from(r.tags).join(','), '沟通,设计');
});

test('清单：@命中取 id，未命中记 listMiss 且不下发 listId', () => {
  const hit = P('回邮件 @工作');
  assert.equal(hit.listId, 'l_work');
  assert.equal(hit.listMiss, null);
  assert.equal(hit.title, '回邮件');

  const miss = P('回邮件 @量子力学');
  assert.equal(miss.listId, null, '未命中不得自动创建清单');
  assert.equal(miss.listMiss, '量子力学');
  assert.equal(miss.title, '回邮件');
  const lastChip = miss.chips[miss.chips.length - 1];
  assert.equal(lastChip.k, 'list');
  assert.equal(lastChip.warn, true);
  assert.ok(lastChip.text.indexOf('不存在') > 0);
});

test('只输入 #标签 时标题为空，调用方可据此拒绝保存', () => {
  const r = P('#沟通');
  assert.equal(r.title, '');
  assert.equal(r.error, 'no-title');
  assert.equal(P('   ').error, 'no-title');
});

test('解析出的内容不进标题，chip 顺序固定为 日期→时间→优先级→标签→清单', () => {
  const r = P('明天下午3点给张总回邮件 !高 #沟通 @工作');
  assert.equal(r.title, '给张总回邮件');
  assert.equal(r.due, '2026-03-06');
  assert.equal(r.dueTime, '15:00');
  assert.equal(r.priority, 3);
  assert.equal(Array.from(r.tags).join(','), '沟通');
  assert.equal(r.listId, 'l_work');
  assert.equal(Array.from(r.chips, (c) => c.k).join(','), 'date,time,pri,tag,list');
  assert.ok(r.chips.every((c) => !c.warn));
});

test('解析是纯函数：不读时钟、不改入参、可重复调用', () => {
  const ctx = Object.assign({}, CTX);
  const a = TF.parseTaskInput('明天 15:00 开会', ctx);
  const b = TF.parseTaskInput('明天 15:00 开会', ctx);
  assert.equal(a.title, b.title);
  assert.equal(a.due, b.due);
  assert.deepEqual(ctx, CTX, 'ctx 不应被修改');
});

/* ---------- pickCurrentTask ---------- */
const NOW = new Date(2026, 2, 5, 10, 0, 0);   // 2026-03-05 周四 10:00
const T = (o) => Object.assign({
  id: 't', title: '任务', due: '2026-03-05', dueTime: null, dueEnd: null,
  done: false, priority: 0, createdAt: '2026-03-01T00:00:00.000Z'
}, o);

test('R1：进行中的时段任务，取开始时间最晚的一条，remainSec 精确到秒', () => {
  const tasks = [
    T({ id: 'a', title: '早会', dueTime: '09:00', dueEnd: '09:30' }),        // 已结束
    T({ id: 'b', title: '写方案', dueTime: '09:30', dueEnd: '11:00', priority: 1 }),
    T({ id: 'c', title: '讨论', dueTime: '10:00', dueEnd: '12:00', priority: 0 })
  ];
  const r = TF.pickCurrentTask(tasks, NOW);
  assert.equal(r.rule, 'R1');
  assert.equal(r.taskId, 'c', '开始时间最晚的一条');
  assert.equal(r.remainSec, 2 * 3600, '12:00 距 10:00 还有 7200 秒');
  assert.equal(r.todayCount, 3);
});

test('R2：已到点的点任务，overdueMin 为已过分钟数', () => {
  const tasks = [
    T({ id: 'a', title: '提交周报', dueTime: '09:00' }),
    T({ id: 'b', title: '回邮件', dueTime: '09:40' }),
    T({ id: 'c', title: '晚上的事', dueTime: '20:00' })
  ];
  const r = TF.pickCurrentTask(tasks, NOW);
  assert.equal(r.rule, 'R2');
  assert.equal(r.taskId, 'b', '到点时间最晚的一条');
  assert.equal(r.overdueMin, 20);
});

test('R3：未命中 R1/R2 的今日任务全部进候选，优先级 → 创建时间', () => {
  const tasks = [
    T({ id: 'a', title: '晚上写文档', dueTime: '20:00', priority: 1 }),
    T({ id: 'b', title: '无时间低优', priority: 0 }),
    T({ id: 'c', title: '无时间高优', priority: 3 })
  ];
  const r = TF.pickCurrentTask(tasks, NOW);
  assert.equal(r.rule, 'R3');
  assert.equal(r.taskId, 'c');
  assert.equal(r.todayCount, 3);

  // 同优先级取创建时间最新
  const tie = [
    T({ id: 'old', priority: 2, createdAt: '2026-03-01T00:00:00.000Z' }),
    T({ id: 'new', priority: 2, createdAt: '2026-03-04T00:00:00.000Z' })
  ];
  assert.equal(TF.pickCurrentTask(tie, NOW).taskId, 'new');
});

test('R4：今日无事但存在逾期，取逾期里优先级最高者', () => {
  const tasks = [
    T({ id: 'a', due: '2026-03-03', priority: 1 }),
    T({ id: 'b', due: '2026-03-04', priority: 3 }),
    T({ id: 'done', due: '2026-03-05', done: true })
  ];
  const r = TF.pickCurrentTask(tasks, NOW);
  assert.equal(r.rule, 'R4');
  assert.equal(r.taskId, 'b');
  assert.equal(r.overdueCount, 2);
  assert.equal(r.todayCount, 0);
});

test('R5：今日无任务且无逾期 → 空态', () => {
  const r = TF.pickCurrentTask([T({ id: 'x', done: true })], NOW);
  assert.equal(r.rule, 'R5');
  assert.equal(r.taskId, null);
  assert.equal(r.todayCount, 0);
  assert.equal(r.overdueCount, 0);
  assert.equal(TF.pickCurrentTask([], NOW).rule, 'R5');
});

test('今日全部完成特例：todayCount 为 0 但 doneToday 有计数', () => {
  const tasks = [T({ id: 'a', done: true }), T({ id: 'b', done: true })];
  const r = TF.pickCurrentTask(tasks, NOW);
  assert.equal(r.rule, 'R5');
  assert.equal(r.todayCount, 0);
  assert.equal(r.doneToday, 2, '收起态据 doneToday 显示「今日全部完成」');
});

test('今日待办展示序：有时刻的在前、时刻升序、最多 5 条', () => {
  const tasks = [
    T({ id: 'n1' }), T({ id: 'n2' }),
    T({ id: 'w1', dueTime: '18:00' }), T({ id: 'w2', dueTime: '09:00' }),
    T({ id: 'w3', dueTime: '12:00' }), T({ id: 'w4', dueTime: '07:00' })
  ];
  const r = TF.pickCurrentTask(tasks, NOW);
  assert.equal(r.todayTasks.length, 5, '最多 5 条');
  assert.equal(Array.from(r.todayTasks, (t) => t.id).join(','), 'w4,w2,w3,w1,n1');
  assert.equal(r.todayIds.length, 6, 'todayIds 保留完整排序');
  assert.equal(r.todayCount, 6);
});

test('pickCurrentTask 不改入参（纯函数）', () => {
  const tasks = [T({ id: 'a', priority: 3 }), T({ id: 'b', priority: 1 })];
  const snapshot = JSON.stringify(tasks);
  TF.pickCurrentTask(tasks, NOW);
  assert.equal(JSON.stringify(tasks), snapshot);
});
