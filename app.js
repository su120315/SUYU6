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

/** 今天零点的时间戳 */
function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "2026-11-20" -> 距今天数（今天=0，昨天=-1） */
function daysFromToday(key) {
  const [y, m, d] = key.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  return Math.round((target - todayStart()) / 86400000);
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

const WEEK = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

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
  });
})();

/* ============ 顶部日期 ============ */
(function initToday() {
  const d = new Date();
  $('#todayText').textContent = `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[(d.getDay() + 6) % 7]}`;
})();

/* ============ 底部导航 ============ */
$$('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    $$('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    $$('.panel').forEach((p) => { p.hidden = p.id !== `panel-${tab}`; });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'duty') renderDuty();
    if (tab === 'exam') renderExams();
    if (tab === 'mistake') renderMistakes();
    if (tab === 'review') renderReview();
  });
});

/* ========================================================
   作业清单
   ======================================================== */
const hwForm = $('#hwForm');
const hwList = $('#hwList');

function loadHomework() {
  const list = store.get(KEY_HW, []);
  return Array.isArray(list) ? list : [];
}

function saveHomework(list) {
  store.set(KEY_HW, list);
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
  saveHomework(list);
  $('#hwTitle').value = '';
  renderHomework();
  toast('已添加');
});

function sortHomework(list) {
  const today = dateKey();
  return list.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ad = a.due || '9999-99-99';
    const bd = b.due || '9999-99-99';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
}

function renderHomework() {
  const list = sortHomework(loadHomework());
  const today = dateKey();

  const undone = list.filter((x) => !x.done).length;
  const dueToday = list.filter((x) => !x.done && x.due === today).length;
  const doneCount = list.length - undone;

  $('#hwStats').innerHTML = '';
  if (list.length) {
    const chips = [
      { text: `未完成 ${undone}`, cls: undone ? '' : 'done' },
      { text: `今天到期 ${dueToday}`, cls: dueToday ? 'urgent' : '' },
      { text: `已完成 ${doneCount}`, cls: 'done' }
    ];
    chips.forEach((c) => {
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
        saveHomework(arr);
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
      if (item.done) {
        due.textContent = formatCN(item.due);
      } else if (diff < 0) {
        due.textContent = `逾期 ${-diff} 天`;
        due.className = 'due-bad';
      } else if (diff === 0) {
        due.textContent = '今天截止';
        due.className = 'due-bad';
      } else if (diff === 1) {
        due.textContent = '明天截止';
        due.className = 'due-bad';
      } else {
        due.textContent = `${formatCN(item.due)}截止（${diff} 天后）`;
      }
      meta.appendChild(due);
    }

    body.appendChild(title);
    body.appendChild(meta);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.setAttribute('aria-label', '删除这条作业');
    del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>';
    del.addEventListener('click', () => {
      saveHomework(loadHomework().filter((x) => x.id !== item.id));
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
  const todayIndex = (new Date().getDay() + 6) % 7; // 周一=0
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
    if (diff > 0) {
      num.textContent = String(diff);
      unit.textContent = '天后';
    } else if (diff === 0) {
      num.textContent = '今天';
      unit.textContent = '就是这一天';
    } else {
      num.textContent = '已过';
      unit.textContent = `${-diff} 天`;
    }
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
    del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>';
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
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
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
    grid.innerHTML = '';
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
    del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>';
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
// 连续答对 1/2/3/4 次后分别隔 1/2/4/7 天，第 5 次算掌握，60 天后再见
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  renderMistakes();
}

/* ========================================================
   初始化
   ======================================================== */
renderHomework();
renderExams();
renderMistakes();
renderReview();

// 页面从后台回来时刷新倒计时/日期（跨天不至于显示错）
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    renderHomework();
    renderExams();
  }
});

// Service Worker：离线也能打开
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW 注册失败', err));
  });
}
