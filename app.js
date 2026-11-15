'use strict';

/* ============ 基础工具 ============ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** 本地日期 YYYY-MM-DD（不要用 toISOString，会差时区） */
function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "2026-11-20" -> 距今天数（今天=0，昨天=-1） */
function daysFromToday(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - todayStart()) / 86400000);
}

function formatCN(key) {
  const [y, m, d] = key.split('-').map(Number);
  return `${m}月${d}日`;
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ============ 本地存储 ============ */
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('读取失败', key, e);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('保存失败', key, e);
      toast('保存失败，存储空间可能已满');
      return false;
    }
  }
};

const KEY_HW = 'ct.homework';
const KEY_DUTY = 'ct.duty';
const KEY_EXAM = 'ct.exams';
const KEY_SCHEDULE = 'ct.schedule';
const KEY_FOCUS = 'ct.focus';
const KEY_GRADES = 'ct.grades';
const KEY_HABITS = 'ct.habits';
const KEY_WORDS = 'ct.words';
const KEY_NOTES = 'ct.notes';
const KEY_MONEY = 'ct.money';
const KEY_MOOD = 'ct.mood';
const BACKUP_KEYS = [KEY_HW, KEY_DUTY, KEY_EXAM, KEY_SCHEDULE, KEY_FOCUS, KEY_GRADES, KEY_HABITS, KEY_WORDS, KEY_NOTES, KEY_MONEY, KEY_MOOD, 'ct.theme', 'ct.homepage'];

const WEEK = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const todayWeekIndex = () => (new Date().getDay() + 6) % 7;

/* ============ 主题 ============ */
(function initTheme() {
  const saved = localStorage.getItem('ct.theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark');
  }
  $('#themeBtn').addEventListener('click', () => {
    const dark = document.body.classList.toggle('dark');
    localStorage.setItem('ct.theme', dark ? 'dark' : 'light');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#0e1320' : '#4f7cff');
    if (currentView === 'grades') drawGradeChart();
  });
})();

$('#todayText').textContent = (() => {
  const d = new Date();
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[todayWeekIndex()]}`;
})();

/* ========================================================
   视图路由（hash 驱动，浏览器返回键可用）
   ======================================================== */
const VIEW_TITLES = {
  home: '班级学习工具箱',
  homework: '作业清单',
  schedule: '课程表',
  duty: '值日表',
  exam: '考试倒计时',
  mistake: '错题本',
  review: '错题复习',
  focus: '专注计时',
  grades: '成绩记录',
  habit: '习惯打卡',
  calendar: '日历',
  words: '单词本',
  notes: '便签墙',
  money: '记账',
  mood: '心情日记',
  settings: '我的'
};
let currentView = 'home';

function go(name) {
  if (!VIEW_TITLES[name]) name = 'home';
  const hash = '#/' + name;
  if (location.hash === hash) show(name);
  else location.hash = hash;
}

function show(name) {
  if (!VIEW_TITLES[name]) name = 'home';
  currentView = name;
  $$('.view').forEach((v) => { v.hidden = v.id !== 'view-' + name; });
  $('#viewTitle').textContent = VIEW_TITLES[name];
  $('#backBtn').hidden = name === 'home';
  const activeTab = (name === 'focus' || name === 'settings') ? name : 'home';
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
  window.scrollTo({ top: 0 });

  if (name === 'home') renderHome();
  if (name === 'homework') renderHomework();
  if (name === 'schedule') renderSchedule();
  if (name === 'duty') renderDuty();
  if (name === 'exam') renderExams();
  if (name === 'mistake') renderMistakes();
  if (name === 'review') renderReview();
  if (name === 'grades') renderGrades();
  if (name === 'habit') renderHabits();
  if (name === 'calendar') renderCalendar();
  if (name === 'words') renderWords();
  if (name === 'notes') renderNotes();
  if (name === 'money') renderMoney();
  if (name === 'mood') renderMood();
  if (name === 'focus') renderFocusStats();
}

window.addEventListener('hashchange', () => {
  show(location.hash.replace(/^#\//, '') || 'home');
});

$$('[data-go]').forEach((el) => {
  el.addEventListener('click', () => go(el.dataset.go));
});
$$('.feature').forEach((el, i) => el.style.setProperty('--i', String(i)));
$$('.tab').forEach((btn) => btn.addEventListener('click', () => go(btn.dataset.tab)));
$('#backBtn').addEventListener('click', () => go('home'));

/* ========================================================
   全局搜索
   ======================================================== */
const searchOverlay = $('#searchOverlay');
const searchInput = $('#searchInput');
const searchResults = $('#searchResults');

function openSearch() {
  searchOverlay.hidden = false;
  setTimeout(() => searchInput.focus(), 50);
  doSearch('');
}
function closeSearch() {
  searchOverlay.hidden = true;
  searchInput.value = '';
}

$('#searchBtn').addEventListener('click', openSearch);
$('#searchClose').addEventListener('click', closeSearch);
searchInput.addEventListener('input', () => doSearch(searchInput.value.trim()));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !searchOverlay.hidden) closeSearch();
});

async function doSearch(q) {
  searchResults.innerHTML = '';
  if (!q) {
    const hint = document.createElement('p');
    hint.className = 'search-empty';
    hint.textContent = '输入关键词搜索作业、单词、便签、账目、成绩…';
    searchResults.appendChild(hint);
    return;
  }

  const lq = q.toLowerCase();
  const groups = [];

  // 作业
  const hw = loadHomework().filter((x) =>
    x.title.toLowerCase().includes(lq) || (x.subject || '').toLowerCase().includes(lq)
  );
  if (hw.length) groups.push({ title: '作业', icon: '📕', items: hw.map((x) => ({ title: x.title, sub: `${x.subject}${x.due ? ' · ' + x.due : ''}`, go: 'homework' })) });

  // 单词
  const words = loadWords().filter((x) => x.term.toLowerCase().includes(lq) || x.def.toLowerCase().includes(lq));
  if (words.length) groups.push({ title: '单词', icon: '🔤', items: words.map((x) => ({ title: x.term, sub: x.def, go: 'words' })) });

  // 便签
  const notes = loadNotes().filter((x) => x.title.toLowerCase().includes(lq) || x.body.toLowerCase().includes(lq));
  if (notes.length) groups.push({ title: '便签', icon: '📝', items: notes.map((x) => ({ title: x.title || x.body.slice(0, 12), sub: x.body, go: 'notes' })) });

  // 账目
  const money = loadMoney().filter((x) => (x.note || '').toLowerCase().includes(lq));
  if (money.length) groups.push({ title: '账目', icon: '💰', items: money.slice(0, 10).map((x) => ({ title: `${x.type === 'income' ? '+' : '-'}${x.amount}`, sub: `${x.note || ''} ${x.date}`.trim(), go: 'money' })) });

  // 成绩
  const grades = store.get(KEY_GRADES, []).filter((x) => (x.subject || '').toLowerCase().includes(lq) || (x.name || '').toLowerCase().includes(lq));
  if (grades.length) groups.push({ title: '成绩', icon: '📊', items: grades.slice(0, 10).map((x) => ({ title: `${x.score}/${x.full} ${x.subject}`, sub: x.name, go: 'grades' })) });

  if (!groups.length) {
    const empty = document.createElement('p');
    empty.className = 'search-empty';
    empty.textContent = '没找到相关内容。';
    searchResults.appendChild(empty);
    return;
  }

  groups.forEach((g) => {
    const title = document.createElement('div');
    title.className = 'search-group-title';
    title.textContent = g.title;
    searchResults.appendChild(title);
    g.items.forEach((it) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'search-item';
      item.innerHTML = `<span class="si-icon">${g.icon}</span><div class="si-body"><div class="si-title"></div><div class="si-sub"></div></div>`;
      item.querySelector('.si-title').textContent = it.title;
      item.querySelector('.si-sub').textContent = it.sub || '';
      item.addEventListener('click', () => { closeSearch(); go(it.go); });
      searchResults.appendChild(item);
    });
  });
}

/* ========================================================
   左滑删除（移动端核心交互）
   ======================================================== */
function enableSwipeDelete(listEl, onDelete) {
  let startX = 0, currentX = 0, dragging = false, openEl = null;

  function closeOpen() {
    if (openEl) {
      openEl.style.transform = '';
      openEl.style.transition = 'transform .2s';
      openEl = null;
    }
  }

  listEl.addEventListener('touchstart', (e) => {
    const item = e.target.closest('.hw-item, .word-item, .money-item, .mood-item');
    if (!item) return;
    if (openEl && openEl !== item) closeOpen();
    startX = e.touches[0].clientX;
    dragging = true;
    item.style.transition = 'none';
  }, { passive: true });

  listEl.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const item = e.target.closest('.hw-item, .word-item, .money-item, .mood-item');
    if (!item) return;
    currentX = e.touches[0].clientX;
    const dx = currentX - startX;
    if (dx < 0) {
      item.style.transform = `translateX(${Math.max(dx, -90)}px)`;
    }
  }, { passive: true });

  listEl.addEventListener('touchend', (e) => {
    if (!dragging) return;
    dragging = false;
    const item = e.target.closest('.hw-item, .word-item, .money-item, .mood-item');
    if (!item) return;
    const dx = currentX - startX;
    item.style.transition = 'transform .2s';
    if (dx < -60) {
      item.style.transform = 'translateX(-90px)';
      openEl = item;
      let delBtn = item.querySelector('.swipe-del');
      if (!delBtn) {
        delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'swipe-del';
        delBtn.textContent = '删除';
        delBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const id = item.dataset.id;
          if (id) onDelete(id);
        });
        item.appendChild(delBtn);
      }
    } else {
      item.style.transform = '';
      if (openEl === item) openEl = null;
    }
  });

  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.hw-item, .word-item, .money-item, .mood-item');
    if (!item || item !== openEl) closeOpen();
  });
}

function trashIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>';
}

/* ========================================================
   首页仪表盘
   ======================================================== */
async function renderHome() {
  const hour = new Date().getHours();
  $('#heroHi').textContent = hour < 6 ? '夜深了' : hour < 9 ? '早上好' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

  const hw = loadHomework();
  const undone = hw.filter((x) => !x.done).length;
  const donePct = hw.length ? Math.round(((hw.length - undone) / hw.length) * 100) : 0;
  $('#heroProgressBar').style.width = donePct + '%';
  $('#heroProgressText').textContent = hw.length
    ? `作业完成 ${donePct}% · 共 ${hw.length} 项`
    : '还没有作业，去「作业清单」加一条。';

  let dueReview = 0;
  try {
    const all = await dbAll();
    const today = dateKey();
    dueReview = all.filter((x) => reviewState(x).next <= today).length;
  } catch (e) { /* 忽略，首页只是概览 */ }

  $('#heroTip').textContent = undone || dueReview
    ? `今天还有 ${undone} 项作业、${dueReview} 道错题要复习。`
    : '今天的任务都清空了，去专注一会儿吧。';

  $('#statHw').textContent = String(undone);
  $('#statReview').textContent = String(dueReview);

  const upcoming = loadExams()
    .map((x) => ({ ...x, diff: daysFromToday(x.date) }))
    .filter((x) => x.diff >= 0)
    .sort((a, b) => a.diff - b.diff)[0];
  $('#statExam').textContent = upcoming ? String(upcoming.diff) : '—';
  $('#statExamLabel').textContent = upcoming ? `${upcoming.name} / 天后` : '最近考试';

  $('#statFocus').textContent = String(focusLog().filter((x) => x.date === dateKey()).reduce((s, x) => s + x.minutes, 0));

  const duty = loadDuty();
  $('#todayDuty').textContent = '值日：' + (duty.days[todayWeekIndex()] || '未安排');

  // 今日待办聚合：今天到期的作业 + 今天的考试 + 今天该复习的错题
  const todayList = $('#todayList');
  todayList.innerHTML = '';
  const today = dateKey();
  const todayHw = hw.filter((x) => !x.done && x.due === today);
  const todayExam = loadExams().filter((x) => x.date === today);

  let reviewToday = 0;
  try {
    const all = await dbAll();
    reviewToday = all.filter((x) => reviewState(x).next <= today).length;
  } catch (e) {}

  const items = [];
  if (todayHw.length) items.push({ icon: '📕', label: `作业 ${todayHw.length} 项到期`, go: 'homework', urgent: true });
  if (todayExam.length) items.push({ icon: '📝', label: `考试：${todayExam.map((e) => e.name).join('、')}`, go: 'exam', urgent: true });
  if (reviewToday) items.push({ icon: '🔁', label: `错题复习 ${reviewToday} 道`, go: 'review' });
  if (duty.days[todayWeekIndex()]) items.push({ icon: '🧹', label: `值日：${duty.days[todayWeekIndex()]}`, go: 'duty' });

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = '今天没有待办，可以专注学习。';
    todayList.appendChild(empty);
  } else {
    items.forEach((it) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'today-item' + (it.urgent ? ' urgent' : '');
      btn.textContent = `${it.icon}  ${it.label}`;
      btn.addEventListener('click', () => go(it.go));
      todayList.appendChild(btn);
    });
  }

  const classes = loadSchedule().days[todayWeekIndex()].filter(Boolean);
  const box = $('#todayClasses');
  box.innerHTML = '';
  if (!classes.length) {
    const span = document.createElement('span');
    span.className = 'muted';
    span.textContent = '今天还没排课，去「课程表」填一下。';
    box.appendChild(span);
  } else {
    const label = document.createElement('span');
    label.className = 'muted';
    label.style.marginRight = '6px';
    label.textContent = '课程';
    box.appendChild(label);
    classes.forEach((name) => {
      const tag = document.createElement('span');
      tag.className = 'subject-tag';
      tag.textContent = name;
      box.appendChild(tag);
    });
  }
}

/* ========================================================
   作业清单
   ======================================================== */
const hwForm = $('#hwForm');
const hwList = $('#hwList');

function loadHomework() {
  const list = store.get(KEY_HW, []);
  return Array.isArray(list) ? list : [];
}

hwForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('#hwTitle').value.trim();
  if (!title) return;
  const list = loadHomework();
  list.push({
    id: uid(),
    subject: $('#hwSubject').value.trim() || '其他',
    title,
    due: $('#hwDue').value || '',
    done: false,
    createdAt: Date.now()
  });
  store.set(KEY_HW, list);
  $('#hwTitle').value = '';
  renderHomework();
  toast('已添加');
});

function renderHomework() {
  const today = dateKey();
  const list = loadHomework().slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ad = a.due || '9999';
    const bd = b.due || '9999';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.createdAt - b.createdAt;
  });

  const undone = list.filter((x) => !x.done).length;
  const dueToday = list.filter((x) => !x.done && x.due === today).length;
  const doneCount = list.length - undone;

  $('#hwStats').innerHTML = '';
  if (list.length) {
    [
      { text: `未完成 ${undone}`, cls: undone ? '' : 'done' },
      { text: `今天到期 ${dueToday}`, cls: dueToday ? 'urgent' : '' },
      { text: `已完成 ${doneCount}`, cls: 'done' }
    ].forEach((c) => {
      const span = document.createElement('span');
      span.className = 'chip' + (c.cls ? ' ' + c.cls : '');
      span.textContent = c.text;
      $('#hwStats').appendChild(span);
    });
  }

  const pct = list.length ? Math.round((doneCount / list.length) * 100) : 0;
  $('#hwProgress').hidden = list.length === 0;
  $('#hwProgressBar').style.width = pct + '%';

  hwList.innerHTML = '';
  list.forEach((item, index) => {
    const li = document.createElement('li');
    li.style.setProperty('--i', String(Math.min(index, 8)));
    li.dataset.id = item.id;
    const overdue = !item.done && item.due && item.due < today;
    li.className = 'hw-item' + (item.done ? ' done' : '') + (overdue ? ' overdue' : '');

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'check';
    check.setAttribute('role', 'checkbox');
    check.setAttribute('aria-checked', String(item.done));
    check.setAttribute('aria-label', item.done ? '标记为未完成' : '标记为完成');
    check.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
    check.addEventListener('click', () => {
      const arr = loadHomework();
      const target = arr.find((x) => x.id === item.id);
      if (target) {
        target.done = !target.done;
        store.set(KEY_HW, arr);
        renderHomework();
      }
    });

    const body = document.createElement('div');
    body.className = 'hw-body';

    const title = document.createElement('div');
    title.className = 'hw-title';
    title.textContent = item.title;

    const meta = document.createElement('div');
    meta.className = 'hw-meta';

    const tag = document.createElement('span');
    tag.className = 'subject-tag';
    tag.textContent = item.subject;
    meta.appendChild(tag);

    if (item.due) {
      const due = document.createElement('span');
      const diff = daysFromToday(item.due);
      if (item.done) due.textContent = formatCN(item.due);
      else if (diff < 0) { due.textContent = `逾期 ${-diff} 天`; due.className = 'due-bad'; }
      else if (diff === 0) { due.textContent = '今天截止'; due.className = 'due-bad'; }
      else if (diff === 1) { due.textContent = '明天截止'; due.className = 'due-bad'; }
      else due.textContent = `${formatCN(item.due)}截止（${diff} 天后）`;
      meta.appendChild(due);
    }

    body.appendChild(title);
    body.appendChild(meta);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.setAttribute('aria-label', '删除这条作业');
    del.innerHTML = trashIcon();
    del.addEventListener('click', () => {
      store.set(KEY_HW, loadHomework().filter((x) => x.id !== item.id));
      renderHomework();
      toast('已删除');
    });

    li.appendChild(check);
    li.appendChild(body);
    li.appendChild(del);
    hwList.appendChild(li);
  });

  $('#hwEmpty').hidden = list.length > 0;
  hwList.hidden = list.length === 0;
}

function trashIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>';
}

/* ========================================================
   课程表
   ======================================================== */
let scheduleIndex = todayWeekIndex();

function loadSchedule() {
  const data = store.get(KEY_SCHEDULE, null);
  if (data && Array.isArray(data.days) && data.days.length === 7) {
    data.days = data.days.map((d) => (Array.isArray(d) ? d : []));
    return data;
  }
  return { days: Array.from({ length: 7 }, () => []) };
}

function saveSchedule(data) {
  store.set(KEY_SCHEDULE, data);
}

function renderSchedule() {
  const week = $('#scheduleWeek');
  week.innerHTML = '';
  WEEK.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = name.replace('周', '');
    btn.className = (i === scheduleIndex ? 'active' : '') + (i === todayWeekIndex() ? ' today' : '');
    btn.setAttribute('aria-label', name);
    btn.addEventListener('click', () => {
      scheduleIndex = i;
      renderSchedule();
    });
    week.appendChild(btn);
  });

  const data = loadSchedule();
  const list = data.days[scheduleIndex];
  const day = $('#scheduleDay');
  day.innerHTML = '';

  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = `${WEEK[scheduleIndex]}还没排课，点下面「加一节课」。`;
    day.appendChild(empty);
  }

  list.forEach((subject, i) => {
    const row = document.createElement('div');
    row.className = 'schedule-row';
    row.style.setProperty('--i', String(Math.min(i, 8)));

    const no = document.createElement('span');
    no.className = 'no';
    no.textContent = `第 ${i + 1} 节`;

    const input = document.createElement('input');
    input.className = 'input';
    input.value = subject;
    input.placeholder = '课程名称';
    input.maxLength = 12;
    input.setAttribute('aria-label', `${WEEK[scheduleIndex]}第${i + 1}节`);
    input.addEventListener('change', () => {
      const cur = loadSchedule();
      cur.days[scheduleIndex][i] = input.value.trim();
      saveSchedule(cur);
      renderScheduleTodayText();
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.setAttribute('aria-label', '删除这节课');
    del.innerHTML = trashIcon();
    del.addEventListener('click', () => {
      const cur = loadSchedule();
      cur.days[scheduleIndex].splice(i, 1);
      saveSchedule(cur);
      renderSchedule();
    });

    row.appendChild(no);
    row.appendChild(input);
    row.appendChild(del);
    day.appendChild(row);
  });

  renderScheduleTodayText();
}

function renderScheduleTodayText() {
  const classes = loadSchedule().days[todayWeekIndex()].filter(Boolean);
  $('#scheduleTodayText').textContent = classes.length ? classes.join('、') : '未安排';
}

$('#scheduleAdd').addEventListener('click', () => {
  const cur = loadSchedule();
  cur.days[scheduleIndex].push('');
  saveSchedule(cur);
  renderSchedule();
  const inputs = $$('#scheduleDay .input');
  if (inputs.length) inputs[inputs.length - 1].focus();
});

/* ========================================================
   值日表
   ======================================================== */
const dutyGrid = $('#dutyGrid');

function loadDuty() {
  const data = store.get(KEY_DUTY, null);
  if (data && Array.isArray(data.days) && data.days.length === 7) return data;
  return { days: Array(7).fill('') };
}

function renderDuty() {
  const data = loadDuty();
  const todayIndex = todayWeekIndex();
  dutyGrid.innerHTML = '';

  data.days.forEach((value, i) => {
    const card = document.createElement('div');
    card.className = 'duty-day' + (i === todayIndex ? ' today' : '');
    card.style.setProperty('--i', String(i));

    const label = document.createElement('div');
    label.className = 'duty-name';
    const dot = document.createElement('span');
    dot.className = 'dot';
    const text = document.createElement('span');
    text.textContent = WEEK[i] + (i === todayIndex ? ' · 今天' : '');
    label.appendChild(dot);
    label.appendChild(text);

    const input = document.createElement('input');
    input.className = 'duty-input';
    input.value = value;
    input.placeholder = '点这里填写';
    input.maxLength = 20;
    input.setAttribute('aria-label', `${WEEK[i]}值日生`);
    input.addEventListener('change', () => {
      const cur = loadDuty();
      cur.days[i] = input.value.trim();
      store.set(KEY_DUTY, cur);
      $('#dutyToday').textContent = cur.days[todayIndex] || '未安排';
      toast('已保存');
    });

    card.appendChild(label);
    card.appendChild(input);
    dutyGrid.appendChild(card);
  });

  $('#dutyToday').textContent = data.days[todayIndex] || '未安排';
}

/* ========================================================
   考试倒计时
   ======================================================== */
const examForm = $('#examForm');
const examList = $('#examList');

function loadExams() {
  const list = store.get(KEY_EXAM, []);
  return Array.isArray(list) ? list : [];
}

examForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#examName').value.trim();
  const date = $('#examDate').value;
  if (!name || !date) return;
  const list = loadExams();
  list.push({ id: uid(), name, date });
  store.set(KEY_EXAM, list);
  $('#examName').value = '';
  $('#examDate').value = '';
  renderExams();
  toast('已添加');
});

function renderExams() {
  const list = loadExams().sort((a, b) => (a.date < b.date ? -1 : 1));
  examList.innerHTML = '';

  list.forEach((item, index) => {
    const diff = daysFromToday(item.date);
    const row = document.createElement('div');
    row.className = 'exam-item' + (diff < 0 ? ' past' : diff <= 3 ? ' soon' : '');
    row.style.setProperty('--i', String(Math.min(index, 8)));

    const count = document.createElement('div');
    count.className = 'exam-count';
    const num = document.createElement('b');
    const unit = document.createElement('span');
    if (diff > 0) { num.textContent = String(diff); unit.textContent = '天后'; }
    else if (diff === 0) { num.textContent = '今天'; unit.textContent = '就是这一天'; }
    else { num.textContent = '已过'; unit.textContent = `${-diff} 天`; }
    count.appendChild(num);
    count.appendChild(unit);

    const main = document.createElement('div');
    main.className = 'exam-main';
    const name = document.createElement('div');
    name.className = 'exam-name';
    name.textContent = item.name;
    const date = document.createElement('div');
    date.className = 'exam-date';
    date.textContent = `${item.date.replace(/-/g, '/')} · ${WEEK[(new Date(item.date + 'T00:00:00').getDay() + 6) % 7]}`;
    main.appendChild(name);
    main.appendChild(date);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.setAttribute('aria-label', `删除考试 ${item.name}`);
    del.innerHTML = trashIcon();
    del.addEventListener('click', () => {
      if (!confirm(`删除「${item.name}」？`)) return;
      store.set(KEY_EXAM, loadExams().filter((x) => x.id !== item.id));
      renderExams();
      toast('已删除');
    });

    row.appendChild(count);
    row.appendChild(main);
    row.appendChild(del);
    examList.appendChild(row);
  });

  $('#examEmpty').hidden = list.length > 0;
  examList.hidden = list.length === 0;
}

/* ========================================================
   错题本（IndexedDB 存图片，localStorage 放不下）
   ======================================================== */
const DB_NAME = 'class-toolbox';
const DB_STORE = 'mistakes';
let dbPromise = null;
let pendingBlob = null;
let objectUrls = [];

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        const os = db.createObjectStore(DB_STORE, { keyPath: 'id' });
        os.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function dbAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 压缩图片：最长边 1200px，JPEG 0.78，控制体积 */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1200;
      let { width, height } = img;
      if (width > max || height > max) {
        const scale = max / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('图片处理失败'));
      }, 'image/jpeg', 0.78);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败'));
    };
    img.src = url;
  });
}

$('#mistakeFile').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('请选择图片文件');
    return;
  }
  compressImage(file)
    .then((blob) => {
      pendingBlob = blob;
      const preview = $('#mistakePreview');
      if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
      preview.src = URL.createObjectURL(blob);
      preview.hidden = false;
      $('#uploadTip').hidden = true;
    })
    .catch(() => toast('图片处理失败，换一张试试'));
});

$('#mistakeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const subject = $('#mistakeSubject').value.trim() || '未分类';
  const note = $('#mistakeNote').value.trim();
  if (!pendingBlob && !note) {
    toast('至少写一句错因，或选一张图片');
    return;
  }
  const btn = $('#mistakeSubmit');
  btn.disabled = true;
  try {
    await dbPut({
      id: uid(),
      subject,
      note,
      image: pendingBlob || null,
      createdAt: Date.now(),
      level: 0,
      nextReview: dateKey(),
      reviewCount: 0
    });
    pendingBlob = null;
    const preview = $('#mistakePreview');
    preview.hidden = true;
    preview.removeAttribute('src');
    $('#uploadTip').hidden = false;
    $('#mistakeNote').value = '';
    $('#mistakeFile').value = '';
    await renderMistakes();
    toast('已保存');
  } catch (err) {
    console.error(err);
    toast('保存失败，请重试');
  } finally {
    btn.disabled = false;
  }
});

function openLightbox(url) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  const img = document.createElement('img');
  img.src = url;
  img.alt = '错题大图';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lightbox-close';
  close.setAttribute('aria-label', '关闭');
  close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  const shut = () => {
    box.remove();
    document.body.style.overflow = '';
  };
  box.addEventListener('click', (ev) => {
    if (ev.target === box) shut();
  });
  close.addEventListener('click', shut);
  document.addEventListener('keydown', function esc(ev) {
    if (ev.key === 'Escape') {
      shut();
      document.removeEventListener('keydown', esc);
    }
  });
  box.appendChild(img);
  box.appendChild(close);
  document.body.appendChild(box);
  document.body.style.overflow = 'hidden';
}

async function renderMistakes() {
  const grid = $('#mistakeGrid');
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls = [];
  grid.innerHTML = '';

  let list = [];
  try {
    list = await dbAll();
  } catch (err) {
    console.warn(err);
    const box = document.createElement('div');
    box.className = 'empty';
    box.innerHTML = '<span class="empty-emoji">⚠️</span><p>浏览器不允许本地存储图片，换个浏览器试试。</p>';
    grid.appendChild(box);
    return;
  }

  list.sort((a, b) => b.createdAt - a.createdAt);

  list.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'mistake-card';
    card.style.setProperty('--i', String(Math.min(index, 8)));

    let url = null;
    if (item.image) {
      url = URL.createObjectURL(item.image);
      objectUrls.push(url);
      const img = document.createElement('img');
      img.src = url;
      img.alt = item.note || item.subject;
      img.loading = 'lazy';
      img.addEventListener('click', () => openLightbox(url));
      card.appendChild(img);
    }

    const info = document.createElement('div');
    info.className = 'mistake-info';
    const tag = document.createElement('span');
    tag.className = 'subject-tag';
    tag.textContent = item.subject;
    info.appendChild(tag);

    if (item.note) {
      const note = document.createElement('div');
      note.className = 'mistake-note';
      note.textContent = item.note;
      info.appendChild(note);
    }

    const time = document.createElement('div');
    time.className = 'mistake-time';
    const d = new Date(item.createdAt);
    time.textContent = `${d.getMonth() + 1}月${d.getDate()}日`;
    info.appendChild(time);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'mistake-del';
    del.setAttribute('aria-label', '删除这道错题');
    del.innerHTML = trashIcon();
    del.addEventListener('click', async () => {
      if (!confirm('删除这道错题？')) return;
      await dbDelete(item.id);
      await renderMistakes();
      toast('已删除');
    });

    card.appendChild(info);
    card.appendChild(del);
    grid.appendChild(card);
  });

  $('#mistakeEmpty').hidden = list.length > 0;
  grid.hidden = list.length === 0;
}

/* ========================================================
   错题复习（遗忘曲线）
   ======================================================== */
const REVIEW_INTERVALS = [1, 2, 4, 7, 15];
const MASTER_DAYS = 60;
const MASTER_LEVEL = 5;

function reviewState(item) {
  const level = typeof item.level === 'number' ? item.level : 0;
  const next = typeof item.nextReview === 'string' && item.nextReview
    ? item.nextReview
    : dateKey(new Date(item.createdAt || Date.now()));
  return { level, next };
}

async function renderReview() {
  const stage = $('#reviewStage');
  const done = $('#reviewDone');
  const empty = $('#reviewEmpty');
  const stats = $('#reviewStats');
  const today = dateKey();

  let all = [];
  try {
    all = await dbAll();
  } catch (err) {
    console.warn(err);
    stage.innerHTML = '';
    empty.hidden = false;
    done.hidden = true;
    return;
  }

  const due = all
    .filter((x) => reviewState(x).next <= today)
    .sort((a, b) => (reviewState(a).next < reviewState(b).next ? -1 : 1));
  const mastered = all.filter((x) => reviewState(x).level >= MASTER_LEVEL).length;

  stats.innerHTML = '';
  if (all.length) {
    [
      { text: `待复习 ${due.length}`, cls: due.length ? 'urgent' : 'done' },
      { text: `已掌握 ${mastered}`, cls: 'done' },
      { text: `共 ${all.length} 道`, cls: '' }
    ].forEach((c) => {
      const span = document.createElement('span');
      span.className = 'chip' + (c.cls ? ' ' + c.cls : '');
      span.textContent = c.text;
      stats.appendChild(span);
    });
  }

  if (!all.length) {
    stage.innerHTML = '';
    stage.hidden = true;
    done.hidden = true;
    empty.hidden = false;
    return;
  }

  empty.hidden = true;

  if (!due.length) {
    stage.innerHTML = '';
    stage.hidden = true;
    done.hidden = false;
    const future = all
      .map((x) => reviewState(x).next)
      .filter((d) => d > today)
      .sort()[0];
    $('#reviewDoneText').textContent = future
      ? `下一道安排在 ${formatCN(future)}，先去干点别的吧。`
      : '所有错题都掌握了。';
    return;
  }

  stage.hidden = false;
  done.hidden = true;
  renderReviewCard(due[0], due.length, all.length);
}

function renderReviewCard(item, remain, total) {
  const stage = $('#reviewStage');
  stage.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'review-card';

  const top = document.createElement('div');
  top.className = 'review-top';

  const tag = document.createElement('span');
  tag.className = 'subject-tag';
  tag.textContent = item.subject || '未分类';

  const counter = document.createElement('span');
  counter.className = 'review-count';
  counter.textContent = `剩 ${remain} / 共 ${total}`;

  top.appendChild(tag);
  top.appendChild(counter);

  const levels = document.createElement('div');
  levels.className = 'levels';
  levels.setAttribute('aria-label', `熟练度 ${reviewState(item).level} / ${MASTER_LEVEL}`);
  for (let i = 0; i < MASTER_LEVEL; i++) {
    const dot = document.createElement('i');
    if (i < reviewState(item).level) dot.className = 'on';
    levels.appendChild(dot);
  }
  top.appendChild(levels);

  card.appendChild(top);

  if (item.image) {
    const url = URL.createObjectURL(item.image);
    objectUrls.push(url);
    const img = document.createElement('img');
    img.src = url;
    img.alt = item.note || '错题图片';
    img.addEventListener('click', () => openLightbox(url));
    card.appendChild(img);
  }

  const note = document.createElement('p');
  note.className = 'review-note';
  note.textContent = item.note || '（这道题没写错因）';
  card.appendChild(note);

  const actions = document.createElement('div');
  actions.className = 'review-actions';

  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'btn ghost';
  again.textContent = '再练一次';
  again.addEventListener('click', () => gradeReview(item.id, false));

  const good = document.createElement('button');
  good.type = 'button';
  good.className = 'btn primary';
  good.textContent = '记住了';
  good.addEventListener('click', () => gradeReview(item.id, true));

  actions.appendChild(again);
  actions.appendChild(good);
  card.appendChild(actions);
  stage.appendChild(card);
}

async function gradeReview(id, ok) {
  let all;
  try {
    all = await dbAll();
  } catch (err) {
    toast('读取失败');
    return;
  }
  const record = all.find((x) => x.id === id);
  if (!record) return;

  const state = reviewState(record);
  let days;
  if (ok) {
    record.level = Math.min(state.level + 1, MASTER_LEVEL);
    days = record.level >= MASTER_LEVEL
      ? MASTER_DAYS
      : REVIEW_INTERVALS[Math.min(state.level, REVIEW_INTERVALS.length - 1)];
  } else {
    record.level = 0;
    days = 1;
  }
  record.nextReview = dateKey(new Date(Date.now() + days * 86400000));
  record.reviewCount = (record.reviewCount || 0) + 1;
  record.lastReview = Date.now();

  try {
    await dbPut(record);
  } catch (err) {
    toast('保存失败');
    return;
  }

  const card = document.querySelector('.review-card');
  if (card) {
    card.classList.add('leaving');
    await wait(180);
  }

  if (!ok) toast('明天再练一次');
  else if (record.level >= MASTER_LEVEL) toast('已掌握，60 天后再见');
  else toast(`${days} 天后再复习`);

  await renderReview();
}

/* ========================================================
   专注计时
   ======================================================== */
const RING_LEN = 540.35;
const focus = { minutes: 25, remaining: 25 * 60, running: false, endAt: 0, timer: null };

function focusLog() {
  const data = store.get(KEY_FOCUS, { log: [] });
  return Array.isArray(data.log) ? data.log : [];
}

function saveFocusLog(log) {
  store.set(KEY_FOCUS, { log: log.slice(-200) });
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateFocusUI() {
  $('#focusTime').textContent = fmtTime(focus.remaining);
  $('#ringFg').style.strokeDashoffset = String(RING_LEN * (1 - focus.remaining / (focus.minutes * 60)));
  $('.focus-card').classList.toggle('running', focus.running);
  $('#focusToggle').textContent = focus.running ? '暂停' : (focus.remaining < focus.minutes * 60 ? '继续' : '开始专注');
}

function focusTick() {
  focus.remaining = Math.max(0, Math.round((focus.endAt - Date.now()) / 1000));
  updateFocusUI();
  if (focus.remaining <= 0) finishFocus();
}

function finishFocus() {
  clearInterval(focus.timer);
  focus.running = false;
  const log = focusLog();
  log.push({ date: dateKey(), minutes: focus.minutes, ts: Date.now() });
  saveFocusLog(log);
  focus.remaining = focus.minutes * 60;
  $('#focusState').textContent = '完成了一次';
  updateFocusUI();
  renderFocusStats();
  toast(`完成 ${focus.minutes} 分钟专注`);
  if (navigator.vibrate) navigator.vibrate(200);
}

$('#focusToggle').addEventListener('click', () => {
  if (focus.running) {
    clearInterval(focus.timer);
    focus.running = false;
    $('#focusState').textContent = '已暂停';
  } else {
    focus.endAt = Date.now() + focus.remaining * 1000;
    focus.timer = setInterval(focusTick, 250);
    focus.running = true;
    $('#focusState').textContent = '专注中';
  }
  updateFocusUI();
});

$('#focusReset').addEventListener('click', () => {
  clearInterval(focus.timer);
  focus.running = false;
  focus.remaining = focus.minutes * 60;
  $('#focusState').textContent = '准备开始';
  updateFocusUI();
});

$$('#focusModes button').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (focus.running) {
      toast('先暂停再换时长');
      return;
    }
    focus.minutes = Number(btn.dataset.min);
    focus.remaining = focus.minutes * 60;
    $$('#focusModes button').forEach((b) => b.classList.toggle('active', b === btn));
    $('#focusState').textContent = '准备开始';
    updateFocusUI();
  });
});

function renderFocusStats() {
  const log = focusLog();
  const today = dateKey();
  const weekStart = todayStart() - todayWeekIndex() * 86400000;
  const todayMin = log.filter((x) => x.date === today).reduce((s, x) => s + x.minutes, 0);
  const weekMin = log.filter((x) => x.ts >= weekStart).reduce((s, x) => s + x.minutes, 0);

  const stats = $('#focusStats');
  stats.innerHTML = '';
  [
    { text: `今日 ${todayMin} 分钟`, cls: todayMin ? 'done' : '' },
    { text: `本周 ${weekMin} 分钟`, cls: '' },
    { text: `累计 ${log.length} 次`, cls: '' }
  ].forEach((c) => {
    const span = document.createElement('span');
    span.className = 'chip' + (c.cls ? ' ' + c.cls : '');
    span.textContent = c.text;
    stats.appendChild(span);
  });

  const list = $('#focusLog');
  list.innerHTML = '';
  log.slice(-5).reverse().forEach((item) => {
    const li = document.createElement('li');
    li.className = 'focus-log-item';
    const left = document.createElement('span');
    left.textContent = `${item.date.slice(5).replace('-', '月')}日`;
    const right = document.createElement('b');
    right.textContent = `${item.minutes} 分钟`;
    li.appendChild(left);
    li.appendChild(right);
    list.appendChild(li);
  });

  updateFocusUI();
}

/* ========================================================
   成绩记录
   ======================================================== */
function loadGrades() {
  const list = store.get(KEY_GRADES, []);
  return Array.isArray(list) ? list : [];
}

$('#gradeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const subject = $('#gradeSubject').value.trim();
  const name = $('#gradeName').value.trim();
  const score = Number($('#gradeScore').value);
  const full = Number($('#gradeFull').value);
  const date = $('#gradeDate').value;
  if (!subject || !name || !date || !full) return;
  if (Number.isNaN(score) || score < 0) {
    toast('分数不对');
    return;
  }
  if (score > full) {
    toast('得分不能超过满分');
    return;
  }
  const list = loadGrades();
  list.push({ id: uid(), subject, name, score, full, date });
  store.set(KEY_GRADES, list);
  $('#gradeName').value = '';
  $('#gradeScore').value = '';
  renderGrades();
  toast('已记录');
});

function renderGrades() {
  const list = loadGrades().sort((a, b) => (a.date < b.date ? 1 : -1));
  const stats = $('#gradeStats');
  stats.innerHTML = '';

  if (list.length) {
    const avg = list.reduce((s, x) => s + (x.score / x.full) * 100, 0) / list.length;
    [
      { text: `平均得分率 ${avg.toFixed(1)}%`, cls: avg >= 60 ? 'done' : 'urgent' },
      { text: `共 ${list.length} 次记录`, cls: '' }
    ].forEach((c) => {
      const span = document.createElement('span');
      span.className = 'chip' + (c.cls ? ' ' + c.cls : '');
      span.textContent = c.text;
      stats.appendChild(span);
    });
  }

  $('#chartCard').hidden = list.length < 2;

  const ul = $('#gradeList');
  ul.innerHTML = '';
  list.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'grade-item';
    li.style.setProperty('--i', String(Math.min(index, 8)));

    const score = document.createElement('div');
    score.className = 'grade-score';
    score.textContent = String(item.score);
    const full = document.createElement('em');
    full.textContent = ` / ${item.full}`;
    score.appendChild(full);

    const main = document.createElement('div');
    main.className = 'grade-main';
    const title = document.createElement('div');
    title.className = 'grade-title';
    title.textContent = `${item.subject} · ${item.name}`;
    const meta = document.createElement('div');
    meta.className = 'grade-meta';
    meta.textContent = `${item.date} · 得分率 ${((item.score / item.full) * 100).toFixed(0)}%`;
    main.appendChild(title);
    main.appendChild(meta);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.setAttribute('aria-label', '删除这条成绩');
    del.innerHTML = trashIcon();
    del.addEventListener('click', () => {
      if (!confirm('删除这条成绩？')) return;
      store.set(KEY_GRADES, loadGrades().filter((x) => x.id !== item.id));
      renderGrades();
    });

    li.appendChild(score);
    li.appendChild(main);
    li.appendChild(del);
    ul.appendChild(li);
  });

  $('#gradeEmpty').hidden = list.length > 0;
  ul.hidden = list.length === 0;

  if (list.length >= 2) drawGradeChart();
}

function drawGradeChart() {
  const canvas = $('#gradeChart');
  if (!canvas || $('#chartCard').hidden) return;

  const points = loadGrades()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-12);
  if (points.length < 2) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.parentElement.clientWidth - 32;
  const height = 180;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const css = getComputedStyle(document.body);
  const primary = css.getPropertyValue('--primary').trim() || '#4f7cff';
  const muted = css.getPropertyValue('--muted').trim() || '#79839a';
  const line = css.getPropertyValue('--line').trim() || '#e5e8f0';

  const padL = 30, padR = 8, padT = 12, padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const x = (i) => padL + (innerW * i) / (points.length - 1);
  const y = (pct) => padT + innerH * (1 - pct / 100);

  ctx.font = '10px sans-serif';
  ctx.fillStyle = muted;
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  [0, 50, 100].forEach((pct) => {
    ctx.beginPath();
    ctx.moveTo(padL, y(pct));
    ctx.lineTo(width - padR, y(pct));
    ctx.stroke();
    ctx.fillText(String(pct), 6, y(pct) + 3);
  });

  ctx.strokeStyle = primary;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((p, i) => {
    const pct = (p.score / p.full) * 100;
    if (i === 0) ctx.moveTo(x(i), y(pct));
    else ctx.lineTo(x(i), y(pct));
  });
  ctx.stroke();

  ctx.fillStyle = primary;
  points.forEach((p, i) => {
    const pct = (p.score / p.full) * 100;
    ctx.beginPath();
    ctx.arc(x(i), y(pct), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = muted;
  ctx.textAlign = 'center';
  points.forEach((p, i) => {
    if (points.length > 6 && i % 2 === 1) return;
    ctx.fillText(p.date.slice(5).replace('-', '/'), x(i), height - 6);
  });
  ctx.textAlign = 'left';
}

/* ========================================================
   习惯打卡
   ======================================================== */
function loadHabits() {
  const list = store.get(KEY_HABITS, []);
  return Array.isArray(list) ? list : [];
}

function habitStreak(habit) {
  const days = habit.days || {};
  let streak = 0;
  let offset = days[dateKey()] ? 0 : 1; // 今天没打就从昨天算起
  while (days[dateKey(new Date(Date.now() - (offset + streak) * 86400000))]) streak++;
  return streak;
}

$('#habitForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#habitName').value.trim();
  if (!name) return;
  const list = loadHabits();
  list.push({ id: uid(), name, days: {}, createdAt: Date.now() });
  store.set(KEY_HABITS, list);
  $('#habitName').value = '';
  renderHabits();
  toast('已添加');
});

function renderHabits() {
  const list = loadHabits();
  const today = dateKey();
  const ul = $('#habitList');
  ul.innerHTML = '';

  list.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'habit-item';
    li.style.setProperty('--i', String(Math.min(index, 8)));

    const main = document.createElement('div');
    main.className = 'habit-main';
    const name = document.createElement('div');
    name.className = 'habit-name';
    name.textContent = item.name;
    const streak = document.createElement('div');
    streak.className = 'habit-streak';
    const total = Object.keys(item.days || {}).length;
    streak.textContent = `连续 ${habitStreak(item)} 天 · 共 ${total} 次`;
    main.appendChild(name);
    main.appendChild(streak);

    const check = document.createElement('button');
    check.type = 'button';
    const doneToday = !!(item.days && item.days[today]);
    check.className = 'habit-check' + (doneToday ? ' done' : '');
    check.textContent = doneToday ? '已打卡' : '打卡';
    check.addEventListener('click', () => {
      const arr = loadHabits();
      const target = arr.find((x) => x.id === item.id);
      if (!target) return;
      target.days = target.days || {};
      if (target.days[today]) delete target.days[today];
      else target.days[today] = true;
      store.set(KEY_HABITS, arr);
      renderHabits();
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.setAttribute('aria-label', `删除习惯 ${item.name}`);
    del.innerHTML = trashIcon();
    del.addEventListener('click', () => {
      if (!confirm(`删除「${item.name}」？`)) return;
      store.set(KEY_HABITS, loadHabits().filter((x) => x.id !== item.id));
      renderHabits();
    });

    li.appendChild(main);
    li.appendChild(check);
    li.appendChild(del);
    ul.appendChild(li);
  });

  $('#habitEmpty').hidden = list.length > 0;
  ul.hidden = list.length === 0;
}

/* ========================================================
   日历
   ======================================================== */
let calDate = new Date();
calDate.setDate(1);

function renderCalendar() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  $('#calTitle').textContent = `${year} 年 ${month + 1} 月`;

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysPrevMonth = new Date(year, month, 0).getDate();

  const today = dateKey();
  const hw = loadHomework();
  const exams = loadExams();
  const duty = loadDuty().days;

  const cells = [];
  // 上个月填充
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ day: daysPrevMonth - i, other: true, date: dateKey(new Date(year, month - 1, daysPrevMonth - i)) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, other: false, date: dateKey(new Date(year, month, d)) });
  }
  while (cells.length % 7) {
    const next = cells.length - firstWeekday - daysInMonth + 1;
    cells.push({ day: next, other: true, date: dateKey(new Date(year, month + 1, next)) });
  }

  const grid = $('#calGrid');
  grid.innerHTML = '';
  cells.forEach((c, i) => {
    const cell = document.createElement('div');
    cell.className = 'cal-cell' + (c.other ? ' other' : '') + (c.date === today ? ' today' : '');
    cell.style.setProperty('--i', String(i % 7));
    cell.textContent = String(c.day);

    const dots = [];
    if (hw.some((h) => h.due === c.date)) dots.push('hw');
    if (exams.some((e) => e.date === c.date)) dots.push('exam');
    // 值日按星期几（month 固定，用 date 的星期）
    const w = (new Date(c.date).getDay() + 6) % 7;
    if (duty[w] && !c.other) dots.push('duty');

    if (dots.length) {
      const dotBox = document.createElement('div');
      dotBox.className = 'cal-dots';
      dots.forEach((cls) => {
        const d = document.createElement('i');
        d.className = cls;
        dotBox.appendChild(d);
      });
      cell.appendChild(dotBox);
    }

    cell.addEventListener('click', () => {
      $$('.cal-cell').forEach((cc) => cc.classList.remove('selected'));
      cell.classList.add('selected');
      renderCalDetail(c.date);
    });
    grid.appendChild(cell);
  });

  // 默认选中今天
  const todayCell = $$('.cal-cell').find((c) => c.textContent.split('\n')[0] && c.classList.contains('today'));
  if (todayCell) {
    todayCell.classList.add('selected');
    renderCalDetail(today);
  } else {
    $('#calDetail').hidden = true;
  }
}

function renderCalDetail(dateKeyOrCell) {
  const date = typeof dateKeyOrCell === 'string' ? dateKeyOrCell : null;
  let target = date;
  if (!target) {
    // 从 cell 的日期推算
    const cellText = dateKeyOrCell.textContent.split('\n')[0].trim();
    // 简单处理：取第一个选中 cell 的 date 属性（我们没存）——改用事件中的 date
    return;
  }

  const hw = loadHomework().filter((h) => h.due === target);
  const exams = loadExams().filter((e) => e.date === target);
  const w = (new Date(target).getDay() + 6) % 7;
  const dutyName = loadDuty().days[w] || '';
  const classes = loadSchedule().days[w].filter(Boolean);

  $('#calDetail').hidden = false;
  $('#calDetailTitle').textContent = formatCN(target);
  const body = $('#calDetailBody');
  body.innerHTML = '';

  if (classes.length) {
    body.appendChild(makeDetailItem('📚', `课程：${classes.join('、')}`));
  }
  if (dutyName) body.appendChild(makeDetailItem('🧹', `值日：${dutyName}`));
  hw.forEach((h) => body.appendChild(makeDetailItem('📕', `作业：${h.subject} ${h.title}`)));
  exams.forEach((e) => body.appendChild(makeDetailItem('📝', `考试：${e.name}`)));

  if (!body.children.length) {
    body.innerHTML = '<p class="muted">这天没有安排。</p>';
  }
}

function makeDetailItem(icon, text) {
  const div = document.createElement('div');
  div.className = 'cal-detail-item';
  div.textContent = `${icon}  ${text}`;
  return div;
}

$('#calPrev').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() - 1);
  renderCalendar();
});
$('#calNext').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() + 1);
  renderCalendar();
});

/* ========================================================
   单词本
   ======================================================== */
function loadWords() {
  const list = store.get(KEY_WORDS, []);
  return Array.isArray(list) ? list : [];
}

let reviewQueue = [];
let reviewCursor = 0;

$('#wordForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const term = $('#wordTerm').value.trim();
  const def = $('#wordDef').value.trim();
  if (!term || !def) return;
  const list = loadWords();
  list.push({ id: uid(), term, def, known: false, createdAt: Date.now() });
  store.set(KEY_WORDS, list);
  $('#wordTerm').value = '';
  $('#wordDef').value = '';
  renderWords();
  toast('已添加');
});

function renderWords() {
  const list = loadWords();
  const known = list.filter((w) => w.known).length;

  const stats = $('#wordStats');
  stats.innerHTML = '';
  if (list.length) {
    [
      { text: `共 ${list.length} 个`, cls: '' },
      { text: `已掌握 ${known}`, cls: 'done' },
      { text: `待复习 ${list.length - known}`, cls: list.length - known ? 'urgent' : 'done' }
    ].forEach((c) => {
      const span = document.createElement('span');
      span.className = 'chip' + (c.cls ? ' ' + c.cls : '');
      span.textContent = c.text;
      stats.appendChild(span);
    });
    if (list.length - known > 0) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn primary';
      btn.textContent = '开始复习';
      btn.style.minHeight = '30px';
      btn.style.padding = '0 12px';
      btn.style.fontSize = '13px';
      btn.addEventListener('click', startWordReview);
      stats.appendChild(btn);
    }
  }

  const ul = $('#wordList');
  ul.innerHTML = '';
  list.slice().reverse().forEach((w, idx) => {
    const li = document.createElement('li');
    li.dataset.id = w.id;
    li.className = 'word-item' + (w.known ? ' known' : '');
    li.style.setProperty('--i', String(Math.min(idx, 8)));

    const term = document.createElement('span');
    term.className = 'term';
    term.textContent = w.term;

    const def = document.createElement('span');
    def.className = 'def';
    def.textContent = w.def;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.setAttribute('aria-label', `删除单词 ${w.term}`);
    del.innerHTML = trashIcon();
    del.addEventListener('click', () => {
      store.set(KEY_WORDS, loadWords().filter((x) => x.id !== w.id));
      renderWords();
    });

    li.appendChild(term);
    li.appendChild(def);
    li.appendChild(del);
    ul.appendChild(li);
  });

  $('#wordEmpty').hidden = list.length > 0;
  ul.hidden = list.length === 0;
}

function startWordReview() {
  reviewQueue = loadWords().filter((w) => !w.known);
  reviewCursor = 0;
  if (!reviewQueue.length) {
    $('#wordReview').hidden = true;
    toast('没有待复习的单词');
    return;
  }
  $('#wordReview').hidden = false;
  $('#wordReviewDef').hidden = true;
  showReviewWord();
}

function showReviewWord() {
  if (reviewCursor >= reviewQueue.length) {
    $('#wordReview').hidden = true;
    toast('这轮复习完了');
    renderWords();
    return;
  }
  const w = reviewQueue[reviewCursor];
  $('#wordReviewTerm').textContent = w.term;
  $('#wordReviewDef').textContent = w.def;
  $('#wordReviewDef').hidden = true;
  $('#wordReviewCount').textContent = `第 ${reviewCursor + 1} / ${reviewQueue.length} 个`;
}

$('#wordShow').addEventListener('click', () => {
  $('#wordReviewDef').hidden = false;
});
$('#wordKnow').addEventListener('click', () => {
  const w = reviewQueue[reviewCursor];
  if (w) {
    const list = loadWords();
    const target = list.find((x) => x.id === w.id);
    if (target) {
      target.known = true;
      store.set(KEY_WORDS, list);
    }
  }
  reviewCursor++;
  showReviewWord();
  if ($('#wordReview').hidden) renderWords();
});

// 在单词本视图里，用「看答案 / 记住了」按钮开始复习
document.addEventListener('view-words', () => {}); // placeholder

/* ========================================================
   便签墙
   ======================================================== */
function loadNotes() {
  const list = store.get(KEY_NOTES, []);
  return Array.isArray(list) ? list : [];
}

$('#noteForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('#noteTitle').value.trim();
  const body = $('#noteBody').value.trim();
  const color = $('#noteColor').value || '#ffe08a';
  if (!body && !title) return;
  const list = loadNotes();
  list.push({ id: uid(), title, body, color, createdAt: Date.now() });
  store.set(KEY_NOTES, list);
  $('#noteTitle').value = '';
  $('#noteBody').value = '';
  renderNotes();
  toast('已添加');
});

function renderNotes() {
  const list = loadNotes();
  const wall = $('#noteWall');
  wall.innerHTML = '';
  list.slice().reverse().forEach((note, idx) => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.style.background = note.color;
    card.style.setProperty('--i', String(Math.min(idx, 8)));

    if (note.title) {
      const h4 = document.createElement('h4');
      h4.textContent = note.title;
      card.appendChild(h4);
    }
    if (note.body) {
      const p = document.createElement('p');
      p.textContent = note.body;
      card.appendChild(p);
    }

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.setAttribute('aria-label', '删除便签');
    del.innerHTML = trashIcon();
    del.addEventListener('click', () => {
      store.set(KEY_NOTES, loadNotes().filter((n) => n.id !== note.id));
      renderNotes();
    });
    card.appendChild(del);
    wall.appendChild(card);
  });

  $('#noteEmpty').hidden = list.length > 0;
  wall.hidden = list.length === 0;
}

/* ========================================================
   记账
   ======================================================== */
function loadMoney() {
  const list = store.get(KEY_MONEY, []);
  return Array.isArray(list) ? list : [];
}

$('#moneyDate').value = dateKey();

$('#moneyForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const type = document.querySelector('input[name="moneyType"]:checked').value;
  const amount = Number($('#moneyAmount').value);
  const note = $('#moneyNote').value.trim();
  const date = $('#moneyDate').value;
  if (!amount || amount <= 0 || !date) return;
  const list = loadMoney();
  list.push({ id: uid(), type, amount, note, date, createdAt: Date.now() });
  store.set(KEY_MONEY, list);
  $('#moneyAmount').value = '';
  $('#moneyNote').value = '';
  renderMoney();
  toast('已记录');
});

function renderMoney() {
  const list = loadMoney().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthItems = list.filter((x) => x.date.startsWith(thisMonth));
  const income = monthItems.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0);
  const expense = monthItems.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
  $('#moneyIncome').textContent = income.toFixed(2);
  $('#moneyExpense').textContent = expense.toFixed(2);
  $('#moneyBalance').textContent = (income - expense).toFixed(2);

  const ul = $('#moneyList');
  ul.innerHTML = '';
  list.slice(0, 50).forEach((item, idx) => {
    const li = document.createElement('li');
    li.dataset.id = item.id;
    li.className = 'money-item';
    li.style.setProperty('--i', String(Math.min(idx, 8)));

    const amount = document.createElement('span');
    amount.className = 'amount ' + item.type;
    amount.textContent = (item.type === 'income' ? '+' : '-') + item.amount.toFixed(2);

    const info = document.createElement('div');
    info.className = 'info';
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = item.note || (item.type === 'income' ? '收入' : '支出');
    const date = document.createElement('div');
    date.className = 'date';
    date.textContent = item.date.replace(/-/g, '/');
    info.appendChild(note);
    info.appendChild(date);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.setAttribute('aria-label', '删除这笔');
    del.innerHTML = trashIcon();
    del.addEventListener('click', () => {
      store.set(KEY_MONEY, loadMoney().filter((x) => x.id !== item.id));
      renderMoney();
    });

    li.appendChild(amount);
    li.appendChild(info);
    li.appendChild(del);
    ul.appendChild(li);
  });

  $('#moneyEmpty').hidden = list.length > 0;
  ul.hidden = list.length === 0;
}

/* ========================================================
   心情日记
   ======================================================== */
const MOOD_OPTIONS = [
  { emoji: '😄', label: '开心' },
  { emoji: '😊', label: '平静' },
  { emoji: '😐', label: '一般' },
  { emoji: '😔', label: '低落' },
  { emoji: '😡', label: '生气' }
];
let selectedMood = null;

function loadMoods() {
  const list = store.get(KEY_MOOD, []);
  return Array.isArray(list) ? list : [];
}

function renderMoodEmojis(preselected) {
  const box = $('#moodEmojis');
  box.innerHTML = '';
  MOOD_OPTIONS.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mood-emoji' + (opt.emoji === preselected ? ' active' : '');
    btn.textContent = opt.emoji;
    btn.setAttribute('aria-label', opt.label);
    btn.addEventListener('click', () => {
      selectedMood = opt.emoji;
      $$('.mood-emoji').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
    box.appendChild(btn);
  });
}

$('#moodSave').addEventListener('click', () => {
  const text = $('#moodText').value.trim();
  if (!selectedMood && !text) {
    toast('选个心情或者写句话');
    return;
  }
  const today = dateKey();
  const list = loadMoods();
  const existing = list.find((x) => x.date === today);
  if (existing) {
    existing.mood = selectedMood || existing.mood;
    existing.text = text;
  } else {
    list.push({ date: today, mood: selectedMood || '', text });
  }
  store.set(KEY_MOOD, list);
  selectedMood = null;
  $('#moodText').value = '';
  renderMood();
  toast('已保存');
});

function renderMood() {
  const list = loadMoods().sort((a, b) => (a.date < b.date ? 1 : -1));
  const today = list.find((x) => x.date === dateKey());

  $('#moodTodayLabel').textContent = today ? '今天（已有记录，可覆盖）' : '今天';
  selectedMood = today ? today.mood : null;
  $('#moodText').value = today ? today.text || '' : '';
  renderMoodEmojis(today ? today.mood : null);

  const stats = $('#moodStats');
  stats.innerHTML = '';
  if (list.length) {
    const counts = {};
    list.forEach((x) => { if (x.mood) counts[x.mood] = (counts[x.mood] || 0) + 1; });
    Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([emoji, n]) => {
      const span = document.createElement('span');
      span.className = 'chip';
      span.textContent = `${emoji} ${n} 次`;
      stats.appendChild(span);
    });
  }

  const ul = $('#moodList');
  ul.innerHTML = '';
  list.slice(0, 30).forEach((item, idx) => {
    const li = document.createElement('li');
    li.dataset.id = item.date;
    li.className = 'mood-item';
    li.style.setProperty('--i', String(Math.min(idx, 8)));

    const mood = document.createElement('span');
    mood.className = 'mood';
    mood.textContent = item.mood || '📝';

    const body = document.createElement('div');
    body.className = 'body';
    const date = document.createElement('div');
    date.className = 'date';
    date.textContent = item.date.replace(/-/g, '/');
    body.appendChild(date);
    if (item.text) {
      const text = document.createElement('div');
      text.className = 'text';
      text.textContent = item.text;
      body.appendChild(text);
    }

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.setAttribute('aria-label', '删除这条心情');
    del.innerHTML = trashIcon();
    del.addEventListener('click', () => {
      store.set(KEY_MOOD, loadMoods().filter((x) => x.date !== item.date));
      renderMood();
    });

    li.appendChild(mood);
    li.appendChild(body);
    li.appendChild(del);
    ul.appendChild(li);
  });

  $('#moodEmpty').hidden = list.length > 0;
  ul.hidden = list.length === 0;
}

/* ========================================================
   数据备份 / 清空
   ======================================================== */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataURL) {
  const [head, body] = dataURL.split(',');
  const mime = (head.match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function downloadFile(content, filename, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#exportData').addEventListener('click', async () => {
  const btn = $('#exportData');
  btn.disabled = true;
  try {
    const data = {};
    BACKUP_KEYS.forEach((k) => {
      const raw = localStorage.getItem(k);
      if (raw !== null) data[k] = raw;
    });

    const mistakes = [];
    try {
      const all = await dbAll();
      for (const item of all) {
        mistakes.push({
          id: item.id,
          subject: item.subject,
          note: item.note,
          createdAt: item.createdAt,
          level: item.level || 0,
          nextReview: item.nextReview || '',
          reviewCount: item.reviewCount || 0,
          image: item.image ? await blobToDataURL(item.image) : null
        });
      }
    } catch (e) {
      console.warn('错题读取失败', e);
    }

    const payload = { app: 'class-toolbox', version: 3, exportedAt: new Date().toISOString(), data, mistakes };
    downloadFile(JSON.stringify(payload), `学习工具箱备份-${dateKey()}.json`, 'application/json');
    toast('已导出备份文件');
  } finally {
    btn.disabled = false;
  }
});

$('#importData').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  e.target.value = '';
  try {
    const payload = JSON.parse(await file.text());
    if (!payload || payload.app !== 'class-toolbox' || typeof payload.data !== 'object') {
      toast('这不是本工具的备份文件');
      return;
    }
    if (!confirm('导入会覆盖当前数据，确定继续吗？')) return;

    Object.entries(payload.data).forEach(([k, v]) => {
      if (BACKUP_KEYS.includes(k) && typeof v === 'string') localStorage.setItem(k, v);
    });

    if (Array.isArray(payload.mistakes)) {
      await dbClear();
      for (const item of payload.mistakes) {
        await dbPut({
          id: item.id || uid(),
          subject: item.subject || '未分类',
          note: item.note || '',
          createdAt: item.createdAt || Date.now(),
          level: item.level || 0,
          nextReview: item.nextReview || dateKey(),
          reviewCount: item.reviewCount || 0,
          image: item.image ? dataURLToBlob(item.image) : null
        });
      }
    }
    toast('导入完成');
    show(currentView);
  } catch (err) {
    console.error(err);
    toast('导入失败，文件可能损坏');
  }
});

$('#wipeData').addEventListener('click', async () => {
  if (!confirm('确定清空本机全部数据？此操作不可恢复。')) return;
  if (!confirm('再确认一次：作业、错题、成绩、打卡都会被删掉。')) return;
  BACKUP_KEYS.forEach((k) => localStorage.removeItem(k));
  try { await dbClear(); } catch (e) { console.warn(e); }
  toast('已清空');
  setTimeout(() => location.reload(), 600);
});

/* ========================================================
   初始化
   ======================================================== */
updateFocusUI();
show(location.hash.replace(/^#\//, '') || 'home');

// 左滑删除（每个列表只绑定一次，列表容器在 DOM 中常驻）
enableSwipeDelete($('#hwList'), (id) => {
  store.set(KEY_HW, loadHomework().filter((x) => x.id !== id));
  renderHomework();
  toast('已删除');
});
enableSwipeDelete($('#wordList'), (id) => {
  store.set(KEY_WORDS, loadWords().filter((x) => x.id !== id));
  renderWords();
  toast('已删除');
});
enableSwipeDelete($('#moneyList'), (id) => {
  store.set(KEY_MONEY, loadMoney().filter((x) => x.id !== id));
  renderMoney();
  toast('已删除');
});
enableSwipeDelete($('#moodList'), (id) => {
  store.set(KEY_MOOD, loadMoods().filter((x) => x.date !== id));
  renderMood();
  toast('已删除');
});

// 页面从后台回来时刷新倒计时/日期（跨天不至于显示错）
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') show(currentView);
});

// Service Worker：离线也能打开
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW 注册失败', err));
  });
}
