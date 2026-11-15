'use strict';

const $ = (sel) => document.querySelector(sel);
const KEY = 'ct.homepage';

const DEFAULT_STATE = {
  name: '',
  school: '',
  intro: '',
  tags: '',
  emoji: '🐟',
  color: '#4f7cff'
};

let state = { ...DEFAULT_STATE };

// 跟随系统深浅色
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.body.classList.add('dark');
}

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ---------- 读取草稿 ---------- */
(function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('草稿读取失败', e);
  }
  $('#name').value = state.name;
  $('#school').value = state.school;
  $('#intro').value = state.intro;
  $('#tags').value = state.tags;
  document.querySelectorAll('.emoji-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.emoji === state.emoji);
  });
  document.querySelectorAll('.color-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.color === state.color);
  });
})();

/* ---------- 渲染预览 ---------- */
function parseTags(raw) {
  return raw
    .split(/[,，、\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function render() {
  document.documentElement.style.setProperty('--accent', state.color);

  $('#avatar').textContent = state.emoji;
  $('#pName').textContent = state.name.trim() || '你的名字';
  $('#pSchool').textContent = state.school.trim() || '学校 · 年级';
  $('#pIntro').textContent = state.intro.trim() || '一句话介绍会出现在这里。';

  const tags = parseTags(state.tags);
  const box = $('#pTags');
  box.innerHTML = '';
  if (!tags.length) {
    ['兴趣', '标签'].forEach((t) => {
      const span = document.createElement('span');
      span.textContent = t;
      span.style.opacity = '.5';
      box.appendChild(span);
    });
  } else {
    tags.forEach((tag, i) => {
      const span = document.createElement('span');
      span.textContent = tag;
      span.style.animationDelay = `${i * 40}ms`;
      box.appendChild(span);
    });
  }
}

function bindText(id, key) {
  $(id).addEventListener('input', (e) => {
    state[key] = e.target.value;
    render();
  });
}

bindText('#name', 'name');
bindText('#school', 'school');
bindText('#intro', 'intro');
bindText('#tags', 'tags');

document.querySelectorAll('.emoji-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.emoji = btn.dataset.emoji;
    document.querySelectorAll('.emoji-btn').forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });
});

document.querySelectorAll('.color-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.color = btn.dataset.color;
    document.querySelectorAll('.color-btn').forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });
});

/* ---------- 保存草稿 ---------- */
$('#saveBtn').addEventListener('click', () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    toast('已保存到本机');
  } catch (e) {
    toast('保存失败');
  }
});

/* ---------- 导出 HTML ---------- */
function buildHTML() {
  const name = state.name.trim() || '我的主页';
  const school = state.school.trim() || '';
  const intro = state.intro.trim() || '';
  const tags = parseTags(state.tags);
  const color = /^#[0-9a-fA-F]{6}$/.test(state.color) ? state.color : '#4f7cff';

  const tagsHTML = tags.map((t) => `<span>${esc(t)}</span>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(name)}</title>
<style>
  :root { --accent: ${color}; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    display: grid; place-items: center;
    padding: 24px;
    background: #f2f4f9;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #1b2233;
  }
  .card {
    width: 100%; max-width: 360px;
    text-align: center;
    padding: 36px 24px 26px;
    border-radius: 24px;
    background: #fff;
    border: 1px solid #e5e8f0;
    box-shadow: 0 10px 40px rgba(24, 39, 75, .10);
    position: relative;
    overflow: hidden;
  }
  .glow {
    position: absolute; top: -80px; left: 50%; transform: translateX(-50%);
    width: 260px; height: 180px;
    background: radial-gradient(ellipse at center, ${color}55, transparent 70%);
  }
  .avatar {
    position: relative;
    width: 84px; height: 84px; margin: 0 auto 16px;
    display: grid; place-items: center;
    font-size: 42px; line-height: 1;
    border-radius: 50%;
    background: #fff;
    border: 2px solid ${color}55;
  }
  h1 { position: relative; margin: 0 0 6px; font-size: 26px; letter-spacing: .5px; }
  .school { position: relative; margin: 0 0 16px; font-size: 14px; color: #79839a; }
  .intro { position: relative; margin: 0 0 20px; font-size: 15px; line-height: 1.6; opacity: .85; }
  .tags { position: relative; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .tags span {
    padding: 5px 13px; border-radius: 999px;
    font-size: 13px; font-weight: 600;
    color: ${color};
    background: ${color}22;
    border: 1px solid ${color}44;
  }
  .foot { position: relative; margin: 26px 0 0; font-size: 11px; color: #79839a; }
</style>
</head>
<body>
  <div class="card">
    <div class="glow"></div>
    <div class="avatar">${esc(state.emoji || '🙂')}</div>
    <h1>${esc(name)}</h1>
    ${school ? `<p class="school">${esc(school)}</p>` : ''}
    ${intro ? `<p class="intro">${esc(intro)}</p>` : ''}
    ${tagsHTML ? `<div class="tags">${tagsHTML}</div>` : ''}
    <p class="foot">通过「学生主页生成器」制作</p>
  </div>
</body>
</html>`;
}

$('#exportBtn').addEventListener('click', () => {
  if (!state.name.trim()) {
    toast('先写个名字吧');
    $('#name').focus();
    return;
  }
  const html = buildHTML();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = state.name.trim().replace(/[\\/:*?"<>|]/g, '');
  a.href = url;
  a.download = `${safeName || '我的'}-主页.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('已导出，打开就能看');
});

render();
