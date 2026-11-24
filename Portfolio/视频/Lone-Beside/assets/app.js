'use strict';

/* ============================== helpers ============================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const IC = {
  play: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg>',
  down: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/></svg>',
  heart: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20s-7-4.6-9.2-8.4C.9 8 2.6 4.5 6.2 4.5c2 0 3.4 1.1 4.3 2.4.9-1.3 2.3-2.4 4.3-2.4 3.6 0 5.3 3.5 3.4 7.1C19 15.4 12 20 12 20z"/></svg>',
  book: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12v18l-6-4-6 4V3z"/></svg>',
  camera: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h3l2-3h6l2 3h3v11H4V8z"/><circle cx="12" cy="13" r="3.2"/></svg>',
  trash: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  up: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  edit: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
  film: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5"/></svg>'
};

const LIKES_KEY = 'lb_likes';
const FAVS_KEY = 'lb_favs';
const NAME_KEY = 'lb_name';

const likes = new Set(loadSet(LIKES_KEY));
const favs = new Set(loadSet(FAVS_KEY));

/* ============ offline mode: works when index.html is opened directly ============ */
const STATIC = location.protocol === 'file:';
const OFFLINE_KEY = 'lb_offline_v1';
let offlineDB = null;
let mediaHandle = null;

function cloneSeed() {
  const seed = (window.LB_LIBRARY && typeof window.LB_LIBRARY === 'object')
    ? window.LB_LIBRARY : { series: [], videos: [], comments: [] };
  const data = JSON.parse(JSON.stringify({
    series: seed.series || [], videos: seed.videos || [], comments: seed.comments || []
  }));
  const rel = u => (typeof u === 'string' && u.charAt(0) === '/' ? u.slice(1) : u);
  data.series.forEach(s => { if (s.cover) s.cover = rel(s.cover); });
  data.videos.forEach(v => { if (v.file) v.file = rel(v.file); });
  return data;
}
function db() {
  if (offlineDB) return offlineDB;
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    if (raw) offlineDB = JSON.parse(raw);
  } catch (e) {}
  if (!offlineDB || !Array.isArray(offlineDB.series)) offlineDB = cloneSeed();
  return offlineDB;
}
function saveDB() {
  try { localStorage.setItem(OFFLINE_KEY, JSON.stringify(offlineDB)); }
  catch (e) { toast('本地存储空间不足，部分改动可能未保存'); }
}
function offlineStats() {
  const d = db();
  return {
    bytes: d.videos.reduce((n, v) => n + (Number(v.size) || 0), 0),
    files: d.videos.length, free: 0, total: 0
  };
}
function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function toTags(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  return String(v || '').split(/[,，、\s]+/).map(x => x.trim()).filter(Boolean);
}

async function localApi(path, options) {
  const opts = options || {};
  const method = String(opts.method || 'GET').toUpperCase();
  const body = opts.json || {};
  const url = new URL(path, 'http://offline.local');
  const parts = url.pathname.split('/').filter(Boolean);
  const d = db();

  if (parts[1] === 'state' && method === 'GET') {
    return { series: d.series, videos: d.videos, stats: offlineStats() };
  }
  if (parts[1] === 'series') {
    const id = parts[2];
    if (!id && method === 'POST') {
      const s = {
        id: uid('s'), title: String(body.title || '未命名系列').slice(0, 60),
        original: String(body.original || ''), tags: toTags(body.tags),
        desc: String(body.desc || ''), cover: '', likes: 0,
        createdAt: Date.now(), updatedAt: Date.now()
      };
      d.series.push(s); saveDB(); return s;
    }
    const s = d.series.find(x => x.id === id);
    if (!s) throw new Error('系列不存在');
    if (method === 'PATCH') {
      if (body.title !== undefined) s.title = String(body.title).slice(0, 60);
      if (body.original !== undefined) s.original = String(body.original);
      if (body.tags !== undefined) s.tags = toTags(body.tags);
      if (body.desc !== undefined) s.desc = String(body.desc);
      s.updatedAt = Date.now(); saveDB(); return s;
    }
    if (method === 'POST' && parts[3] === 'like') {
      const delta = Number(body.delta) || 0;
      s.likes = Math.max(0, (Number(s.likes) || 0) + delta); saveDB();
      return { likes: s.likes };
    }
    if (method === 'DELETE') {
      const gone = d.videos.filter(v => v.seriesId === id).map(v => v.id);
      d.series = d.series.filter(x => x.id !== id);
      d.videos = d.videos.filter(v => v.seriesId !== id);
      d.comments = d.comments.filter(c => gone.indexOf(c.vid) < 0);
      saveDB(); return { ok: true };
    }
  }
  if (parts[1] === 'videos') {
    const id = parts[2];
    const v = id ? d.videos.find(x => x.id === id) : null;
    if (!id) throw new Error('离线模式不支持该请求');
    if (!v) throw new Error('视频不存在');
    if (method === 'POST' && parts[3] === 'view') {
      v.views = (Number(v.views) || 0) + 1; saveDB(); return { views: v.views };
    }
    if (method === 'PATCH') {
      if (body.title !== undefined) v.title = String(body.title).slice(0, 80);
      if (body.ep !== undefined) v.ep = Math.max(1, Number(body.ep) || 1);
      const s = d.series.find(x => x.id === v.seriesId);
      if (s) s.updatedAt = Date.now();
      saveDB(); return v;
    }
    if (method === 'DELETE') {
      d.videos = d.videos.filter(x => x.id !== id);
      d.comments = d.comments.filter(c => c.vid !== id);
      saveDB(); return { ok: true };
    }
  }
  if (parts[1] === 'comments') {
    if (method === 'GET') {
      const vid = url.searchParams.get('vid') || '';
      const list = d.comments.filter(c => c.vid === vid).sort((a, b) => a.createdAt - b.createdAt);
      return { comments: list, count: list.length };
    }
    if (method === 'POST') {
      const c = {
        id: uid('c'), vid: String(body.vid || ''),
        name: String(body.name || '我').slice(0, 20),
        text: String(body.text || '').slice(0, 300),
        createdAt: Date.now()
      };
      d.comments.push(c); saveDB(); return c;
    }
  }
  throw new Error('离线模式暂不支持该操作');
}

function shrinkCover(file) {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const max = 900;
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const g = cv.getContext('2d');
        g.fillStyle = '#1a1214'; g.fillRect(0, 0, w, h);
        g.drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', 0.86));
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(src); }
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('图片读取失败')); };
    img.src = src;
  });
}

async function offlineMediaDir() {
  if (mediaHandle) return mediaHandle;
  if (!window.showDirectoryPicker) {
    throw new Error('当前浏览器不支持离线保存，请改用 Chrome / Edge 打开');
  }
  const picked = await window.showDirectoryPicker({ mode: 'readwrite', id: 'lb-media' });
  let media = picked;
  if (picked.name !== 'media') {
    try { media = await picked.getDirectoryHandle('media'); }
    catch (e) { throw new Error('请在弹窗里选中项目内的 media 文件夹'); }
  }
  mediaHandle = media;
  return media;
}

async function offlineUploadOne(file, sid, onProgress) {
  const media = await offlineMediaDir();
  const vdir = await media.getDirectoryHandle('videos', { create: true });
  const ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.mp4'])[0].toLowerCase();
  const base = safeName(file.name).replace(/\.[a-z0-9]+$/i, '') || 'video';
  const fname = base + '-' + Date.now().toString(36) + ext;
  const fh = await vdir.getFileHandle(fname, { create: true });
  const w = await fh.createWritable();
  await w.write(file);
  await w.close();
  if (onProgress) onProgress(1);

  const d = db();
  const s = d.series.find(x => x.id === sid);
  const ep = d.videos.filter(v => v.seriesId === sid)
    .reduce((n, v) => Math.max(n, Number(v.ep) || 0), 0) + 1;
  const v = {
    id: uid('v'), seriesId: sid, title: '第 ' + pad2(ep) + ' 话', ep,
    file: 'media/videos/' + fname, name: file.name, size: file.size,
    mime: file.type || 'video/mp4', views: 0, createdAt: Date.now()
  };
  d.videos.push(v);
  if (s) s.updatedAt = Date.now();
  saveDB();
  return v;
}

const state = {
  series: [], videos: [], stats: { bytes: 0, files: 0, free: 0, total: 0 },
  cat: '全部', sort: 'new', keyword: '',
  currentSid: null, currentVid: null,
  pendingCoverSid: null, uploadFiles: [], newCoverFile: null, submitting: false
};

function loadSet(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
}
function saveSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch (e) {}
}
function esc(v) {
  return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function pad2(n) { return String(n || 0).padStart(2, '0'); }
function fmtBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}
function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
function timeAgo(ts) {
  const d = Date.now() - (Number(ts) || 0);
  if (!ts || d < 0) return '刚刚';
  const m = Math.floor(d / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return m + ' 分钟前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' 小时前';
  const day = Math.floor(h / 24);
  if (day < 30) return day + ' 天前';
  const mo = Math.floor(day / 30);
  if (mo < 12) return mo + ' 个月前';
  return Math.floor(mo / 12) + ' 年前';
}
function safeName(s) {
  return String(s || 'video').replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 90);
}
function fileExt(v) {
  const name = (v && v.name) || '';
  const m = /\.([a-z0-9]+)$/i.exec(name);
  if (m) return m[1].toLowerCase();
  const mime = (v && v.mime) || '';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('matroska')) return 'mkv';
  if (mime.includes('quicktime')) return 'mov';
  return 'mp4';
}

/* ============================== data ============================== */
function findSeries(id) { return state.series.find(s => s.id === id) || null; }
function videoById(id) { return state.videos.find(v => v.id === id) || null; }
function videosOf(sid) { return state.videos.filter(v => v.seriesId === sid).sort((a, b) => (a.ep || 0) - (b.ep || 0)); }
function epLabel(v) { return v.title || ('第 ' + pad2(v.ep) + ' 话'); }
function totalBytes(vids) { return vids.reduce((n, v) => n + (Number(v.size) || 0), 0); }
function seriesScore(s) { return (s.likes || 0) * 2 + videosOf(s.id).reduce((n, v) => n + (v.views || 0), 0); }
function coverMarkup(s) {
  if (!s) return '';
  const initial = esc((s.title || '番').trim()[0] || '番');
  return `<div class="ph">${initial}</div>` +
    (s.cover ? `<img src="${esc(s.cover)}" alt="${esc(s.title)}" loading="lazy">` : '');
}

async function api(path, options) {
  if (STATIC && path.indexOf('/api/') === 0) return localApi(path, options);
  const opts = Object.assign({}, options || {});
  if (opts.json !== undefined) {
    opts.body = JSON.stringify(opts.json);
    opts.headers = { 'Content-Type': 'application/json' };
    delete opts.json;
  }
  const res = await fetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((data && data.error) || ('请求失败（' + res.status + '）'));
  return data;
}

async function loadState() {
  if (STATIC) {
    const d = await localApi('/api/state');
    state.series = d.series || [];
    state.videos = d.videos || [];
    state.stats = d.stats || state.stats;
    renderAll();
    return;
  }
  const d = await api('/api/state');
  state.series = d.series || [];
  state.videos = d.videos || [];
  state.stats = d.stats || state.stats;
  renderAll();
}

/* ============================== render ============================== */
function updateCounts() {
  const has = state.series.filter(s => videosOf(s.id).length > 0).length;
  const fav = state.series.filter(s => favs.has(s.id)).length;
  $('#cntAll').textContent = state.series.length;
  $('#cntHas').textContent = has;
  $('#cntEmpty').textContent = state.series.length - has;
  $('#cntFav').textContent = fav;
  $('#navFavN').textContent = fav;
  $('#statSeries').textContent = state.series.length;
  $('#statVideos').textContent = state.videos.length;
  $('#statFavs').textContent = fav;
}

function filteredSeries() {
  const kw = state.keyword.trim().toLowerCase();
  let list = state.series.filter(s => {
    const vids = videosOf(s.id);
    const has = vids.length > 0;
    let ok = state.cat === '全部' ||
      (state.cat === '有视频' && has) ||
      (state.cat === '暂无视频' && !has) ||
      (state.cat === '我的收藏' && favs.has(s.id));
    if (ok && kw) {
      const hay = [s.title, s.original, s.desc, (s.tags || []).join(' '), vids.map(v => v.title).join(' ')]
        .join(' ').toLowerCase();
      ok = hay.includes(kw);
    }
    return ok;
  });
  if (state.sort === 'videos') list = list.slice().sort((a, b) => videosOf(b.id).length - videosOf(a.id).length);
  else if (state.sort === 'hot') list = list.slice().sort((a, b) => seriesScore(b) - seriesScore(a));
  else if (state.sort === 'name') list = list.slice().sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh'));
  else list = list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return list;
}

function cardHTML(s, i) {
  const vids = videosOf(s.id);
  const has = vids.length > 0;
  const liked = likes.has(s.id);
  const faved = favs.has(s.id);
  return `
    <article class="card" data-sid="${esc(s.id)}" style="animation-delay:${Math.min(i * 40, 320)}ms">
      <div class="poster">
        ${coverMarkup(s)}
        <div class="shade"></div>
        <span class="badge-status ${has ? '' : 'done'}"><i></i>${has ? vids.length + ' 集' : '暂无视频'}</span>
        <button class="cover-edit" data-cover="${esc(s.id)}" title="更换封面" aria-label="更换封面">${IC.camera}</button>
        <div class="quick"><button class="quick-btn" data-open="${esc(s.id)}">${IC.play}<span>进入系列</span></button></div>
        <div class="poster-bottom">
          <span class="epbadge">${has ? fmtBytes(totalBytes(vids)) : '等待上传'}</span>
          <span class="epcount">${vids.length}<small>集</small></span>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">
          <h3>${esc(s.title)}<em>${esc(s.original || ' ')}</em></h3>
        </div>
        <div class="card-meta">
          ${(s.tags || []).slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
          <span class="sep"></span>
          <span>${has ? timeAgo(s.updatedAt) + '更新' : '待上传'}</span>
        </div>
        <div class="card-actions">
          <button class="act-btn like-btn ${liked ? 'on' : ''}" data-like="${esc(s.id)}" title="点赞">${IC.heart}<b>${fmtNum(s.likes)}</b></button>
          <button class="act-btn fav-btn ${faved ? 'on' : ''}" data-fav="${esc(s.id)}" title="收藏">${IC.book}<span>${faved ? '已收藏' : '收藏'}</span></button>
        </div>
      </div>
    </article>`;
}

function renderGrid() {
  const list = filteredSeries();
  $('#grid').innerHTML = list.map(cardHTML).join('');
  $('#resultCount').textContent = list.length;
  $('#empty').classList.toggle('show', list.length === 0);
  $$('#grid .poster img').forEach(img => {
    img.addEventListener('error', () => { img.style.display = 'none'; });
  });
}

function renderUpdates() {
  const list = state.videos.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  const box = $('#updateList');
  if (!list.length) {
    box.innerHTML = '<div class="comment-empty">还没有视频<br>上传后会出现在这里</div>';
    $('#latestHint').textContent = '共 0 个视频';
    return;
  }
  box.innerHTML = list.map(v => {
    const s = findSeries(v.seriesId);
    if (!s) return '';
    return `
      <div class="update-row" data-play="${esc(v.id)}">
        <div class="update-thumb">${coverMarkup(s)}</div>
        <div class="update-info">
          <h4>${esc(s.title)} <em>${esc(epLabel(v))}</em></h4>
          <p>${fmtBytes(v.size)} · ${timeAgo(v.createdAt)}</p>
        </div>
        <div class="update-meta">
          <time>${fmtNum(v.views)} 次播放</time>
          <span class="mini-dlbtn">${IC.play}播放</span>
        </div>
      </div>`;
  }).join('');
  $$('#updateList img').forEach(img => img.addEventListener('error', () => { img.style.display = 'none'; }));
  $('#latestHint').textContent = `共 ${state.videos.length} 个视频`;
}

function renderRank() {
  const list = state.series.filter(s => videosOf(s.id).length > 0)
    .map(s => ({ s, views: videosOf(s.id).reduce((n, v) => n + (v.views || 0), 0) }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);
  $('#rankList').innerHTML = list.length ? list.map(({ s, views }, i) => `
    <div class="rank-row" data-open="${esc(s.id)}">
      <span class="rank-num">${pad2(i + 1)}</span>
      <span class="rank-name">${esc(s.title)}</span>
      <span class="rank-hot"><b>${fmtNum(views)}</b> 次播放</span>
    </div>`).join('') : '<div class="comment-empty">暂无播放数据</div>';
}

function updateMiniStorage() {
  const bytes = state.stats.bytes || 0;
  const free = state.stats.free || 0;
  $('#storePct').textContent = fmtBytes(bytes);
  $('#storeBar').style.width = Math.max(2, Math.min(100, bytes / (5 * 1024 * 1024 * 1024) * 100)) + '%';
  $('#storeUsed').textContent = `${state.stats.files || 0} 个视频`;
  $('#storeMeta').textContent = free ? `剩余 ${fmtBytes(free)}` : '本机保存';
}

function renderAll() {
  updateCounts();
  renderGrid();
  renderUpdates();
  renderRank();
  updateMiniStorage();
}

/* ============================== social ============================== */
function paintSocial(s) {
  $$(`[data-like="${s.id}"]`).forEach(el => {
    el.classList.toggle('on', likes.has(s.id));
    const b = el.querySelector('b');
    if (b) b.textContent = fmtNum(s.likes);
  });
  $$(`[data-fav="${s.id}"]`).forEach(el => {
    el.classList.toggle('on', favs.has(s.id));
    const sp = el.querySelector('span');
    if (sp) sp.textContent = favs.has(s.id) ? '已收藏' : '收藏';
  });
  if (state.currentSid === s.id) {
    const wLike = $('#wLike'), wFav = $('#wFav');
    if (wLike) {
      wLike.classList.toggle('on', likes.has(s.id));
      $('#wLikeN').textContent = fmtNum(s.likes);
    }
    if (wFav) {
      wFav.classList.toggle('on', favs.has(s.id));
      $('#wFavTxt').textContent = favs.has(s.id) ? '已收藏' : '收藏';
    }
  }
  updateCounts();
}

async function toggleLike(sid) {
  const s = findSeries(sid);
  if (!s) return;
  const wasLiked = likes.has(sid);
  const delta = wasLiked ? -1 : 1;
  if (wasLiked) likes.delete(sid); else likes.add(sid);
  s.likes = Math.max(0, (Number(s.likes) || 0) + delta);
  saveSet(LIKES_KEY, likes);
  paintSocial(s);
  try {
    const r = await api(`/api/series/${sid}/like`, { method: 'POST', json: { delta } });
    s.likes = r.likes;
    paintSocial(s);
    if (state.sort === 'hot') renderGrid();
  } catch (e) {
    if (wasLiked) likes.add(sid); else likes.delete(sid);
    s.likes = Math.max(0, s.likes - delta);
    saveSet(LIKES_KEY, likes);
    paintSocial(s);
    toast(e.message);
  }
}

function toggleFav(sid) {
  const s = findSeries(sid);
  if (!s) return;
  const on = favs.has(sid);
  if (on) favs.delete(sid); else favs.add(sid);
  saveSet(FAVS_KEY, favs);
  paintSocial(s);
  if (state.cat === '我的收藏') renderGrid();
  toast(on ? '已取消收藏' : '已加入我的收藏');
}

/* ============================== overlays ============================== */
function openDrawer(el) {
  $$('.drawer.on').forEach(d => d.classList.remove('on'));
  el.classList.add('on');
  el.setAttribute('aria-hidden', 'false');
  $('#scrim').classList.add('on');
  document.body.classList.add('locked');
}
function closeDrawers() {
  if (state.submitting) { toast('正在上传，请稍候…'); return; }
  $$('.drawer.on').forEach(d => {
    d.classList.remove('on');
    d.setAttribute('aria-hidden', 'true');
  });
  $('#scrim').classList.remove('on');
  if (!$('#watch').classList.contains('on')) document.body.classList.remove('locked');
}
function toast(msg) {
  $('#toastText').textContent = msg;
  const el = $('#toast');
  el.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('on'), 2600);
}

/* ============================== series drawer ============================== */
function openSeries(sid) {
  const s = findSeries(sid);
  if (!s) return;
  state.currentSid = sid;
  renderSeriesDrawer(s);
  openDrawer($('#seriesDrawer'));
}

function renderSeriesDrawer(s) {
  const vids = videosOf(s.id);
  const liked = likes.has(s.id);
  const faved = favs.has(s.id);
  const rows = vids.map(v => `
    <div class="ep-row">
      <span class="ep-no">${pad2(v.ep)}</span>
      <div class="ep-txt">
        <b>${esc(epLabel(v))}</b>
        <small>${fmtBytes(v.size)} · ${fmtNum(v.views)} 次播放 · ${timeAgo(v.createdAt)}</small>
      </div>
      <div class="ep-btns">
        <button class="play" data-play="${esc(v.id)}" title="播放">${IC.play}</button>
        <button data-dl="${esc(v.id)}" title="下载">${IC.down}</button>
        <button data-edvideo="${esc(v.id)}" title="改名">${IC.edit}</button>
        <button class="del" data-delvid="${esc(v.id)}" title="删除">${IC.trash}</button>
      </div>
    </div>`).join('');

  $('#seriesDrawer').innerHTML = `
    <div class="drawer-head">
      <button class="drawer-close" data-close-drawer aria-label="关闭">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div class="drawer-cover">${coverMarkup(s)}</div>
      <div class="drawer-title">
        <h3>${esc(s.title)}</h3>
        <div class="sub">${esc(s.original || '无原名')} · ${vids.length} 集 · ${fmtBytes(totalBytes(vids))}</div>
        <div class="tags"><span class="green">${vids.length ? '已收录' : '空系列'}</span>${(s.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}</div>
      </div>
    </div>
    <div class="drawer-body">
      <div class="drawer-actions">
        <button class="act-lg ${liked ? 'on' : ''}" data-like="${esc(s.id)}">${IC.heart} 点赞 <b>${fmtNum(s.likes)}</b></button>
        <button class="act-lg fav ${faved ? 'on' : ''}" data-fav="${esc(s.id)}">${IC.book} <span>${faved ? '已收藏' : '收藏'}</span></button>
        <button class="act-lg" data-cover="${esc(s.id)}">${IC.camera} 更换封面</button>
        <button class="act-lg" data-editseries="${esc(s.id)}">${IC.edit} 编辑系列</button>
      </div>
      <div class="fld-head"><label>剧集 · ${vids.length}</label><span>按集数排序</span></div>
      ${vids.length ? rows : `<div class="series-empty">这个系列还没有视频<br><button class="btn-primary" data-addvideo="${esc(s.id)}">${IC.up} 上传第一个视频</button></div>`}
    </div>
    <div class="drawer-foot">
      <div class="sum">
        <div class="l"><small>本系列共</small><b>${vids.length} 集 · ${fmtBytes(totalBytes(vids))}</b></div>
        <div class="r" style="text-align:right"><small>最后更新</small><b>${timeAgo(s.updatedAt)}</b></div>
      </div>
      <button class="cta" data-addvideo="${esc(s.id)}">${IC.up} 上传视频到本系列</button>
      <button class="danger-link" data-delseries="${esc(s.id)}">删除本系列</button>
    </div>`;

  const img = $('#seriesDrawer .drawer-cover img');
  if (img) img.addEventListener('error', () => { img.style.display = 'none'; });
  $('#seriesDrawer .drawer-body').scrollTop = 0;
}

async function deleteSeries(sid) {
  const s = findSeries(sid);
  if (!s) return;
  const vids = videosOf(sid);
  if (!confirm(`确定删除系列「${s.title}」及其 ${vids.length} 个视频？\n视频原文件也会被删除，不可恢复。`)) return;
  try {
    await api(`/api/series/${sid}`, { method: 'DELETE' });
    if (state.currentSid === sid && $('#watch').classList.contains('on')) closeWatch();
    closeDrawers();
    await loadState();
    toast('系列已删除');
  } catch (e) { toast(e.message); }
}

async function deleteVideo(vid) {
  const v = videoById(vid);
  if (!v) return;
  const s = findSeries(v.seriesId);
  if (!confirm(`确定删除「${s ? s.title : ''} · ${epLabel(v)}」？\n视频原文件会被删除，不可恢复。`)) return;
  try {
    await api(`/api/videos/${vid}`, { method: 'DELETE' });
    if (state.currentVid === vid) closeWatch();
    await loadState();
    if ($('#seriesDrawer').classList.contains('on') && state.currentSid === (s ? s.id : '')) {
      const fresh = findSeries(state.currentSid);
      if (fresh) renderSeriesDrawer(fresh);
    }
    toast('视频已删除');
  } catch (e) { toast(e.message); }
}

/* ============================== download ============================== */
function downloadVideo(vid) {
  const v = videoById(vid);
  if (!v) { toast('视频不存在'); return; }
  const s = findSeries(v.seriesId);
  const name = safeName(`${s ? s.title : 'video'}_${epLabel(v)}`) + '.' + fileExt(v);
  const a = document.createElement('a');
  a.href = STATIC ? v.file : (v.file + '?download=1&name=' + encodeURIComponent(name));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('已开始下载');
}

/* ============================== watch ============================== */
async function openWatch(vid) {
  const v = videoById(vid);
  if (!v) return;
  const s = findSeries(v.seriesId);
  if (!s) return;
  state.currentVid = vid;
  state.currentSid = s.id;

  $('#wSeries').textContent = s.title;
  $('#wEp').textContent = epLabel(v);
  $('#wTitle').textContent = epLabel(v);
  $('#wMeta').textContent = `${s.title} · ${fmtBytes(v.size)} · ${fmtNum(v.views)} 次播放 · ${timeAgo(v.createdAt)}`;
  $('#wCover').innerHTML = coverMarkup(s);
  $('#wSeriesName').textContent = s.title;
  $('#wSeriesDesc').textContent = s.desc || '暂无简介';

  renderWatchEps(s, vid);

  const player = $('#player');
  player.src = v.file;
  player.load();

  paintSocial(s);
  $('#watch').classList.add('on');
  $('#watch').setAttribute('aria-hidden', 'false');
  document.body.classList.add('locked');
  loadComments(vid);

  try {
    const r = await api(`/api/videos/${vid}/view`, { method: 'POST', json: {} });
    v.views = r.views;
    if (state.currentVid === vid) {
      $('#wMeta').textContent = `${s.title} · ${fmtBytes(v.size)} · ${fmtNum(v.views)} 次播放 · ${timeAgo(v.createdAt)}`;
    }
    renderUpdates();
    renderRank();
  } catch (e) {}
}

function closeWatch() {
  const player = $('#player');
  player.pause();
  player.removeAttribute('src');
  player.load();
  $('#watch').classList.remove('on');
  $('#watch').setAttribute('aria-hidden', 'true');
  state.currentVid = null;
  if (!$('.drawer.on')) document.body.classList.remove('locked');
}

function renderWatchEps(s, activeVid) {
  const vids = videosOf(s.id);
  $('#wEpsCount').textContent = vids.length + ' 集';
  $('#wEpList').innerHTML = vids.map(x => `
    <button class="ep-chip ${x.id === activeVid ? 'on' : ''}" data-play="${esc(x.id)}">
      <span class="n">${pad2(x.ep)}</span><span>${esc(epLabel(x))}</span>
    </button>`).join('');
}

async function loadComments(vid) {
  const box = $('#commentList');
  box.innerHTML = '<div class="comment-empty">正在加载评论…</div>';
  try {
    const d = await api('/api/comments?vid=' + encodeURIComponent(vid));
    renderComments(d.comments || [], d.count);
  } catch (e) {
    box.innerHTML = '<div class="comment-empty">评论加载失败</div>';
  }
}

function renderComments(list, count) {
  const box = $('#commentList');
  $('#wCommentCount').textContent = (count === undefined ? list.length : count) + ' 条';
  if (!list.length) {
    box.innerHTML = '<div class="comment-empty">还没有评论<br>来留下第一句吧</div>';
    return;
  }
  box.innerHTML = list.map(c => `
    <div class="comment">
      <div class="c-avatar">${esc((c.name || '访')[0])}</div>
      <div class="c-main">
        <div class="c-top"><b>${esc(c.name)}</b><time>${timeAgo(c.createdAt)}</time></div>
        <p>${esc(c.text)}</p>
      </div>
    </div>`).join('');
}

async function submitComment(e) {
  e.preventDefault();
  const input = $('#commentInput');
  const text = input.value.trim();
  if (!text || !state.currentVid) return;
  const name = (localStorage.getItem(NAME_KEY) || '我').slice(0, 20);
  const btn = $('#commentForm button');
  btn.disabled = true;
  try {
    const c = await api('/api/comments', { method: 'POST', json: { vid: state.currentVid, name, text } });
    input.value = '';
    const d = await api('/api/comments?vid=' + encodeURIComponent(state.currentVid));
    renderComments(d.comments || [], d.count);
    toast('评论已发布');
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
  }
}

/* ============================== cover ============================== */
async function uploadCover(sid, file) {
  if (STATIC) {
    const dataUrl = await shrinkCover(file);
    const s = db().series.find(x => x.id === sid) || findSeries(sid);
    if (s) { s.cover = dataUrl; s.updatedAt = Date.now(); saveDB(); }
    return { cover: dataUrl };
  }
  const res = await fetch(`/api/series/${sid}/cover`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'image/jpeg',
      'X-File-Name': encodeURIComponent(file.name)
    },
    body: file
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((data && data.error) || '封面保存失败');
  const s = findSeries(sid);
  if (s) s.cover = data.cover;
  return data;
}

$('#coverInput').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  const sid = state.pendingCoverSid;
  e.target.value = '';
  state.pendingCoverSid = null;
  if (!file || !sid) return;
  if (!file.type.startsWith('image/')) { toast('请选择图片文件'); return; }
  try {
    await uploadCover(sid, file);
    const s = findSeries(sid);
    if (s) s.updatedAt = Date.now();
    renderGrid();
    renderUpdates();
    renderRank();
    if ($('#seriesDrawer').classList.contains('on') && state.currentSid === sid) {
      const fresh = findSeries(sid);
      if (fresh) renderSeriesDrawer(fresh);
    }
    if (state.currentSid === sid && $('#watch').classList.contains('on')) {
      const fresh = findSeries(sid);
      if (fresh) $('#wCover').innerHTML = coverMarkup(fresh);
    }
    toast('封面已更新');
  } catch (err) { toast(err.message); }
});

/* ============================== edit modal ============================== */
const editState = { kind: null, id: null };

function openEdit(kind, id) {
  editState.kind = kind;
  editState.id = id;
  const body = $('#editBody');
  if (kind === 'series') {
    const s = findSeries(id);
    if (!s) return;
    $('#editHeading').textContent = '编辑系列信息';
    $('#editSub').textContent = '总封面、剧集与点赞收藏不受影响';
    body.innerHTML = `
      <div class="up-field">
        <div class="up-label">系列名称 *</div>
        <input class="dark-input" id="editSeriesTitle" maxlength="60" value="${esc(s.title)}">
      </div>
      <div class="up-field">
        <div class="up-label">原名</div>
        <input class="dark-input" id="editSeriesOriginal" maxlength="80" value="${esc(s.original || '')}" placeholder="可选">
      </div>
      <div class="up-field">
        <div class="up-label">标签</div>
        <input class="dark-input" id="editSeriesTags" value="${esc((s.tags || []).join(', '))}" placeholder="用逗号分隔，例如：奇幻, 音乐">
      </div>
      <div class="up-field">
        <div class="up-label">简介</div>
        <textarea class="dark-input" id="editSeriesDesc" rows="3" maxlength="300" placeholder="会显示在播放页右侧">${esc(s.desc || '')}</textarea>
      </div>`;
  } else {
    const v = videoById(id);
    if (!v) return;
    $('#editHeading').textContent = '修改剧集名称';
    $('#editSub').textContent = '只改变显示名称，视频文件与集数保持不变';
    body.innerHTML = `
      <div class="up-field">
        <div class="up-label">剧集名称 *</div>
        <input class="dark-input" id="editVideoTitle" maxlength="100" value="${esc(v.title)}">
      </div>`;
  }
  const modal = $('#editModal');
  modal.classList.add('on');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('locked');
  setTimeout(() => {
    const input = body.querySelector('input');
    if (input) { input.focus(); input.select && input.select(); }
  }, 70);
}

function closeEdit() {
  const modal = $('#editModal');
  modal.classList.remove('on');
  modal.setAttribute('aria-hidden', 'true');
  editState.kind = null;
  editState.id = null;
  if (!$('#watch').classList.contains('on') && !$('.drawer.on')) {
    document.body.classList.remove('locked');
  }
}

function paintWatchMeta(s, v) {
  $('#wMeta').textContent = `${s.title} · ${fmtBytes(v.size)} · ${fmtNum(v.views)} 次播放 · ${timeAgo(v.createdAt)}`;
}

function afterSeriesEdit(s) {
  if (!s) return;
  renderGrid();
  renderUpdates();
  renderRank();
  if ($('#seriesDrawer').classList.contains('on') && state.currentSid === s.id) {
    renderSeriesDrawer(s);
  }
  if (state.currentSid === s.id && $('#watch').classList.contains('on')) {
    const v = videoById(state.currentVid);
    $('#wSeries').textContent = s.title;
    $('#wSeriesName').textContent = s.title;
    $('#wSeriesDesc').textContent = s.desc || '暂无简介';
    $('#wCover').innerHTML = coverMarkup(s);
    if (v) paintWatchMeta(s, v);
    renderWatchEps(s, state.currentVid);
  }
  paintSocial(s);
}

function afterVideoEdit(v) {
  if (!v) return;
  const s = findSeries(v.seriesId);
  renderUpdates();
  renderRank();
  if (s && $('#seriesDrawer').classList.contains('on') && state.currentSid === s.id) {
    renderSeriesDrawer(s);
  }
  if (state.currentVid === v.id && $('#watch').classList.contains('on')) {
    $('#wTitle').textContent = epLabel(v);
    $('#wEp').textContent = epLabel(v);
    if (s) {
      paintWatchMeta(s, v);
      renderWatchEps(s, v.id);
    }
  }
}

async function saveEdit() {
  if (!editState.kind) return;
  const btn = $('#editSave');
  btn.disabled = true;
  try {
    if (editState.kind === 'series') {
      const title = $('#editSeriesTitle').value.trim();
      if (!title) { toast('系列名称不能为空'); $('#editSeriesTitle').focus(); return; }
      const res = await api(`/api/series/${editState.id}`, {
        method: 'PATCH',
        json: {
          title,
          original: $('#editSeriesOriginal').value.trim(),
          tags: $('#editSeriesTags').value.trim(),
          desc: $('#editSeriesDesc').value.trim()
        }
      });
      const s = findSeries(editState.id);
      if (s) Object.assign(s, res);
      afterSeriesEdit(s);
      toast('系列信息已更新');
    } else {
      const title = $('#editVideoTitle').value.trim();
      if (!title) { toast('剧集名称不能为空'); $('#editVideoTitle').focus(); return; }
      const res = await api(`/api/videos/${editState.id}`, {
        method: 'PATCH',
        json: { title }
      });
      const v = videoById(editState.id);
      if (v) Object.assign(v, res);
      afterVideoEdit(v);
      toast('剧集名称已更新');
    }
    closeEdit();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
}

/* ============================== upload ============================== */
function openUpload(sid) {
  if (state.submitting) { toast('正在上传，请稍候…'); return; }
  state.uploadFiles = [];
  state.newCoverFile = null;
  renderFileList();
  renderSeriesOptions();
  $('#newSeriesFields').classList.add('hidden');
  $('#nsTitle').value = '';
  $('#nsOriginal').value = '';
  $('#nsTags').value = '';
  $('#nsDesc').value = '';
  $('#nsCoverName').textContent = '未选择，之后也可更换';
  const sel = $('#seriesSelect');
  if (sid && findSeries(sid)) {
    sel.value = sid;
  } else {
    sel.value = state.series.length ? state.series[0].id : '__new';
  }
  toggleNewSeries();
  $('#upProgress').classList.remove('on');
  $('#upProgress i').style.width = '0%';
  $('#uploadHint').textContent = '选择视频后即可上传';
  $('#uploadSubmit').disabled = false;
  if ($('#seriesDrawer').classList.contains('on')) closeDrawers();
  openDrawer($('#uploadDrawer'));
}

function renderSeriesOptions() {
  const sel = $('#seriesSelect');
  sel.innerHTML = state.series.map(s =>
    `<option value="${esc(s.id)}">${esc(s.title)}（${videosOf(s.id).length} 集）</option>`
  ).join('') + '<option value="__new">＋ 新建系列</option>';
  if (!state.series.length) sel.value = '__new';
}

function toggleNewSeries() {
  $('#newSeriesFields').classList.toggle('hidden', $('#seriesSelect').value !== '__new');
}

function addUploadFiles(fileList) {
  const files = Array.from(fileList || []).filter(f => f.type.startsWith('video/') || /\.(mp4|webm|mkv|mov|m4v|avi|ogv)$/i.test(f.name));
  if (!files.length) { toast('请选择视频文件'); return; }
  files.forEach(f => state.uploadFiles.push({ file: f, status: 'pending', error: '' }));
  renderFileList();
  if (!state.uploadFiles.length) return;
  const sel = $('#seriesSelect');
  if (!state.series.length) sel.value = '__new';
  toggleNewSeries();
}

function renderFileList() {
  const box = $('#fileList');
  const total = state.uploadFiles.reduce((n, x) => n + x.file.size, 0);
  $('#pendingCount').textContent = state.uploadFiles.length + ' 个文件';
  $('#pendingSize').textContent = fmtBytes(total);
  if (!state.uploadFiles.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = state.uploadFiles.map((x, i) => `
    <div class="file-item ${x.status === 'done' ? 'done' : ''}">
      <span class="fico">${IC.film}</span>
      <div class="fmeta">
        <b>${esc(x.file.name)}</b>
        <small>${fmtBytes(x.file.size)}${x.status === 'error' ? ' · ' + esc(x.error) : ''}</small>
      </div>
      ${x.status === 'done' ? '<span class="fstat">已上传</span>' : ''}
      ${x.status === 'pending' ? `<button class="fdel" data-fremove="${i}" title="移除">✕</button>` : ''}
    </div>`).join('');
}

function uploadOne(file, sid, onProgress) {
  if (STATIC) return offlineUploadOne(file, sid, onProgress);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `/api/videos?sid=${encodeURIComponent(sid)}&name=${encodeURIComponent(file.name)}`;
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch (e) {}
        resolve(data || {});
      } else {
        let msg = '上传失败';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch (e) {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('网络中断，上传失败'));
    xhr.onabort = () => reject(new Error('上传已取消'));
    xhr.send(file);
  });
}

async function submitUpload() {
  if (state.submitting) return;
  const files = state.uploadFiles.filter(x => x.status === 'pending' || x.status === 'error');
  if (!files.length) { toast('请先选择视频文件'); return; }
  let sid = $('#seriesSelect').value;
  if (!sid) { toast('请选择归属系列'); return; }

  if (STATIC) {
    try { await offlineMediaDir(); }
    catch (e) {
      toast(e && e.name === 'AbortError' ? '已取消选择 media 文件夹' : (e.message || '无法写入 media 文件夹'));
      return;
    }
  }

  if (sid === '__new') {
    const title = $('#nsTitle').value.trim();
    if (!title) { toast('请填写新系列名称'); $('#nsTitle').focus(); return; }
    try {
      const s = await api('/api/series', {
        method: 'POST',
        json: {
          title,
          original: $('#nsOriginal').value.trim(),
          tags: $('#nsTags').value.trim(),
          desc: $('#nsDesc').value.trim()
        }
      });
      sid = s.id;
      if (state.newCoverFile) {
        try { await uploadCover(s.id, state.newCoverFile); s.cover = (findSeries(s.id) || s).cover || s.cover; }
        catch (e) { toast('封面保存失败：' + e.message); }
      }
      if (!state.series.some(x => x.id === s.id)) state.series.push(s);
      state.newCoverFile = null;
    } catch (e) { toast(e.message); return; }
  }

  state.submitting = true;
  $('#uploadSubmit').disabled = true;
  $('#upProgress').classList.add('on');
  const progressEl = $('#upProgress i');
  let done = 0;

  for (const item of files) {
    item.status = 'uploading';
    renderFileList();
    try {
      await uploadOne(item.file, sid, p => {
        const overall = ((done + p) / files.length) * 100;
        progressEl.style.width = overall.toFixed(1) + '%';
        $('#uploadHint').textContent = `正在上传 ${done + 1}/${files.length} · ${Math.round(p * 100)}%`;
      });
      item.status = 'done';
      done += 1;
      progressEl.style.width = (done / files.length * 100).toFixed(1) + '%';
    } catch (e) {
      item.status = 'error';
      item.error = e.message;
    }
    renderFileList();
  }

  state.submitting = false;
  $('#uploadSubmit').disabled = false;
  const failed = files.filter(x => x.status === 'error').length;

  try {
    await loadState();
  } catch (e) {}

  state.uploadFiles = state.uploadFiles.filter(x => x.status === 'error');
  renderFileList();
  $('#uploadHint').textContent = failed ? `${failed} 个文件上传失败，可重试` : '全部上传完成';
  progressEl.style.width = '100%';

  if (done > 0) {
    toast(failed ? `已上传 ${done} 个，${failed} 个失败` : `已上传 ${done} 个视频`);
    closeDrawers();
    setTimeout(() => openSeries(sid), 260);
  }
}

/* ============================== search / filter ============================== */
function doSearch(val) {
  state.keyword = val;
  renderGrid();
  $('#library').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function setCat(cat) {
  state.cat = cat;
  $$('#catChips .chip').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  renderGrid();
}

/* ============================== events ============================== */
function bindGlobal() {
  document.addEventListener('click', e => {
    const editSeriesBtn = e.target.closest('[data-editseries]');
    if (editSeriesBtn) { openEdit('series', editSeriesBtn.dataset.editseries); return; }
    const editVideoBtn = e.target.closest('[data-edvideo]');
    if (editVideoBtn) { openEdit('video', editVideoBtn.dataset.edvideo); return; }
    const coverBtn = e.target.closest('[data-cover]');
    if (coverBtn) {
      state.pendingCoverSid = coverBtn.dataset.cover;
      $('#coverInput').click();
      return;
    }
    const likeBtn = e.target.closest('[data-like]');
    if (likeBtn) { toggleLike(likeBtn.dataset.like); return; }
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) { toggleFav(favBtn.dataset.fav); return; }
    const upBtn = e.target.closest('[data-upload]');
    if (upBtn) { openUpload(); return; }
    const addBtn = e.target.closest('[data-addvideo]');
    if (addBtn) { openUpload(addBtn.dataset.addvideo); return; }
    const closeBtn = e.target.closest('[data-close-drawer]');
    if (closeBtn) { closeDrawers(); return; }
    const playBtn = e.target.closest('[data-play]');
    if (playBtn) { openWatch(playBtn.dataset.play); return; }
    const dlBtn = e.target.closest('[data-dl]');
    if (dlBtn) { downloadVideo(dlBtn.dataset.dl); return; }
    const delVid = e.target.closest('[data-delvid]');
    if (delVid) { deleteVideo(delVid.dataset.delvid); return; }
    const delSeries = e.target.closest('[data-delseries]');
    if (delSeries) { deleteSeries(delSeries.dataset.delseries); return; }
    const openBtn = e.target.closest('[data-open]');
    if (openBtn) { openSeries(openBtn.dataset.open); return; }
    const card = e.target.closest('.card');
    if (card) { openSeries(card.dataset.sid); }
  });

  $('#scrim').addEventListener('click', closeDrawers);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if ($('#editModal').classList.contains('on')) { closeEdit(); return; }
    if ($('#watch').classList.contains('on')) { closeWatch(); return; }
    closeDrawers();
    $('#sortMenu').classList.remove('open');
  });

  // drag & drop anywhere: prevent accidental navigation
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => e.preventDefault());

  $('#commentForm').addEventListener('submit', submitComment);
}

function bindStatic() {
  window.addEventListener('scroll', () => {
    $('#nav').classList.toggle('scrolled', window.scrollY > 18);
  }, { passive: true });

  $('#catChips').addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (btn) setCat(btn.dataset.cat);
  });

  $('#sortBtn').addEventListener('click', e => {
    e.stopPropagation();
    $('#sortMenu').classList.toggle('open');
  });
  $('#sortMenu').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    $$('#sortMenu button').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    state.sort = btn.dataset.sort;
    $('#sortLabel').textContent = btn.textContent;
    $('#sortMenu').classList.remove('open');
    renderGrid();
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.sort-wrap')) $('#sortMenu').classList.remove('open');
  });

  const heroSearch = $('#heroSearch'), navSearch = $('#navSearch');
  $('#heroGo').addEventListener('click', () => doSearch(heroSearch.value));
  heroSearch.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(heroSearch.value); });
  heroSearch.addEventListener('input', () => { state.keyword = heroSearch.value; renderGrid(); });
  navSearch.addEventListener('input', () => { state.keyword = navSearch.value; renderGrid(); });
  navSearch.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(navSearch.value); });

  $$('.quick-tags button').forEach(b => b.addEventListener('click', () => {
    heroSearch.value = b.dataset.tag;
    state.keyword = b.dataset.tag;
    setCat('全部');
    renderGrid();
    $('#library').scrollIntoView({ behavior: 'smooth' });
  }));

  ['navUpload', 'heroUpload', 'uploadFab'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => openUpload());
  });

  const goFav = e => {
    e.preventDefault();
    setCat('我的收藏');
    $('#library').scrollIntoView({ behavior: 'smooth' });
  };
  $('#navFav').addEventListener('click', goFav);
  $('#footFav').addEventListener('click', goFav);
  $('#railFav').addEventListener('click', goFav);
  $('#footHelp').addEventListener('click', () => {
    toast('双击 index.html 即可打开；视频在 media 文件夹，评论与收藏保存在浏览器本地');
  });
  $('#railHelp').addEventListener('click', e => {
    e.preventDefault();
    toast('双击 index.html 即可打开；视频在 media 文件夹，评论与收藏保存在浏览器本地');
  });
  $('#railUpload').addEventListener('click', e => {
    e.preventDefault();
    openUpload();
  });

  // watch
  $('#watchBack').addEventListener('click', closeWatch);
  $('#watchClose').addEventListener('click', closeWatch);
  $('#wPanelToggle').addEventListener('click', () => $('#watch').classList.toggle('side-off'));
  $('#wLike').addEventListener('click', () => { if (state.currentSid) toggleLike(state.currentSid); });
  $('#wFav').addEventListener('click', () => { if (state.currentSid) toggleFav(state.currentSid); });
  $('#wDownload').addEventListener('click', () => { if (state.currentVid) downloadVideo(state.currentVid); });
  $('#wEditTitle').addEventListener('click', () => { if (state.currentVid) openEdit('video', state.currentVid); });

  // edit modal
  $('#editForm').addEventListener('submit', e => { e.preventDefault(); saveEdit(); });
  $('#editCancel').addEventListener('click', closeEdit);
  $('#editCancelX').addEventListener('click', closeEdit);
  $('#editModal').addEventListener('click', e => { if (e.target === $('#editModal')) closeEdit(); });

  // upload
  $('#videoInput').addEventListener('change', e => {
    addUploadFiles(e.target.files);
    e.target.value = '';
  });
  $('#drop').addEventListener('click', () => $('#videoInput').click());
  $('#drop').addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
    $('#drop').classList.add('over');
  });
  $('#drop').addEventListener('dragleave', () => $('#drop').classList.remove('over'));
  $('#drop').addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    $('#drop').classList.remove('over');
    if (e.dataTransfer && e.dataTransfer.files) addUploadFiles(e.dataTransfer.files);
  });
  $('#fileList').addEventListener('click', e => {
    const btn = e.target.closest('[data-fremove]');
    if (!btn) return;
    const i = Number(btn.dataset.fremove);
    state.uploadFiles.splice(i, 1);
    renderFileList();
  });
  $('#seriesSelect').addEventListener('change', toggleNewSeries);
  $('#pickCoverBtn').addEventListener('click', () => $('#nsCover').click());
  $('#nsCover').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast('请选择图片文件'); return; }
    state.newCoverFile = f;
    $('#nsCoverName').textContent = f.name;
  });
  $('#uploadSubmit').addEventListener('click', submitUpload);
}

function observeReveal() {
  if (!('IntersectionObserver' in window)) {
    $$('.reveal').forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal:not(.in)').forEach(el => io.observe(el));
}

/* ============================== init ============================== */
document.addEventListener('DOMContentLoaded', async () => {
  bindGlobal();
  bindStatic();
  if (STATIC) {
    try {
      await loadState();
      observeReveal();
      const note = $('.up-note');
      if (note) {
        note.innerHTML = '离线模式：新增视频时会请你选择项目内的 <code>media</code> 文件夹，文件直接保存到 <code>media/videos</code>；评论、点赞与收藏保存在浏览器本地。';
      }
      toast('离线模式已就绪 · 双击 index.html 即可打开');
    } catch (err) {
      toast('离线数据读取失败：' + err.message);
    }
    return;
  }
  try {
    await loadState();
    observeReveal();
  } catch (err) {
    $('#notice').classList.add('on');
    toast('无法连接本地服务：' + err.message);
  }
});
