'use strict';

const MONTHS = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const WEEKDAYS = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
const CATEGORIES = [
  { label: 'Anniversario', color: '#cf4d73' },
  { label: 'Cena',         color: '#e07a3f' },
  { label: 'Viaggio',      color: '#3a9bb5' },
  { label: 'Serata',       color: '#8a5cc4' },
  { label: 'Regalo',       color: '#d99b4e' },
  { label: 'Compleanno',   color: '#e85f8f' },
  { label: 'Altro',        color: '#a97c8d' },
];
function catColor(c) { const f = CATEGORIES.find(x => x.label === c); return f ? f.color : '#c78aa0'; }

let settings = { anniversary: '', reunion: '', name1: '', name2: '' };
let events = [];
let reasonsCache = [];
let current = new Date(); current.setDate(1);
let selectedDate = null;
const isMobile = () => window.matchMedia('(max-width: 640px)').matches;

// ---------- util ----------
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function todayYmd() { return ymd(new Date()); }
function parseYmd(s) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
function prettyDate(s) { if (!s) return ''; const d = parseYmd(s); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }

selectedDate = todayYmd();

// ---------- config / tabs / logout ----------
fetch('/api/config').then(r => r.json()).then(c => {
  if (c.coupleName) document.getElementById('coupleName').textContent = c.coupleName;
});
document.getElementById('logout').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
});

const loaders = {
  home: loadHome, calendar: loadEvents, photos: loadPhotos,
  notes: loadNotes, wishes: loadWishes, reasons: loadReasons,
};
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    const view = tab.dataset.view;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-' + view).classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (loaders[view]) loaders[view]();
  });
});

// ---------- HOME ----------
async function loadHome() {
  settings = await fetch('/api/settings').then(r => r.json());

  const daysEl = document.getElementById('togetherDays');
  const detailEl = document.getElementById('togetherDetail');
  const annNote = document.getElementById('anniversaryNote');
  if (settings.anniversary) {
    const start = parseYmd(settings.anniversary);
    const today = parseYmd(todayYmd());
    const days = Math.max(0, daysBetween(start, today));
    daysEl.textContent = days.toLocaleString('it-IT');
    detailEl.textContent = days === 1 ? 'giorno' : 'giorni';
    annNote.textContent = breakdown(start, today) + ' • dal ' + prettyDate(settings.anniversary);
  } else {
    daysEl.textContent = '—';
    detailEl.textContent = '';
    annNote.innerHTML = 'Imposta la vostra data nelle <b>Impostazioni</b> per vedere il contatore.';
  }

  const cardR = document.getElementById('cardReunion');
  if (settings.reunion) {
    const today = parseYmd(todayYmd());
    const rd = parseYmd(settings.reunion);
    const diff = daysBetween(today, rd);
    if (diff >= 0) {
      cardR.style.display = '';
      document.getElementById('reunionDays').textContent = diff === 0 ? 'Oggi' : diff;
      document.getElementById('reunionDate').textContent = diff === 0 ? 'vi rivedete oggi' : (diff === 1 ? 'giorno' : 'giorni') + ' • ' + prettyDate(settings.reunion);
    } else cardR.style.display = 'none';
  } else cardR.style.display = 'none';

  events = await fetch('/api/events').then(r => r.json());
  const t = todayYmd();
  const next = events.filter(e => e.date >= t).sort((a,b) => a.date < b.date ? -1 : 1)[0];
  const ne = document.getElementById('nextEvent');
  if (next) {
    const diff = daysBetween(parseYmd(t), parseYmd(next.date));
    const when = diff === 0 ? 'oggi' : diff === 1 ? 'domani' : 'tra ' + diff + ' giorni';
    ne.innerHTML =
      '<div class="ne-title">' + esc(next.title) + '</div>' +
      (next.category ? '<div class="ne-cat" style="color:' + catColor(next.category) + '">' + esc(next.category) + '</div>' : '') +
      '<div class="ne-when">' + when + ' — ' + prettyDate(next.date) + '</div>' +
      (next.note ? '<div class="ne-note">' + esc(next.note) + '</div>' : '');
  } else {
    ne.innerHTML = '<p class="muted">Niente in programma. Aggiungete qualcosa dal calendario.</p>';
  }

  reasonsCache = await fetch('/api/reasons').then(r => r.json());
  showRandomReason();

  const photos = await fetch('/api/photos').then(r => r.json());
  const cardP = document.getElementById('cardLastPhoto');
  if (photos.length) {
    cardP.style.display = '';
    const img = document.getElementById('lastPhoto');
    img.src = '/media/' + photos[0].file;
    img.onclick = () => openLightbox('/media/' + photos[0].file, photos[0].caption);
  } else cardP.style.display = 'none';
}

function breakdown(start, end) {
  let y = end.getFullYear() - start.getFullYear();
  let m = end.getMonth() - start.getMonth();
  let d = end.getDate() - start.getDate();
  if (d < 0) { m--; const prev = new Date(end.getFullYear(), end.getMonth(), 0); d += prev.getDate(); }
  if (m < 0) { y--; m += 12; }
  const parts = [];
  if (y) parts.push(y + (y === 1 ? ' anno' : ' anni'));
  if (m) parts.push(m + (m === 1 ? ' mese' : ' mesi'));
  if (d) parts.push(d + (d === 1 ? ' giorno' : ' giorni'));
  return parts.join(', ') || 'oggi';
}

function showRandomReason() {
  const el = document.getElementById('randomReason');
  if (!reasonsCache.length) { el.textContent = 'Aggiungine uno nella sezione Motivi.'; return; }
  const r = reasonsCache[Math.floor(Math.random()*reasonsCache.length)];
  el.textContent = '“' + r.text + '”';
}
document.getElementById('shuffleReason').addEventListener('click', showRandomReason);

// ============================================================
//  CALENDARIO
// ============================================================
async function loadEvents() {
  events = await fetch('/api/events').then(r => r.json());
  // parti sul mese del giorno selezionato
  const sd = parseYmd(selectedDate);
  current = new Date(sd.getFullYear(), sd.getMonth(), 1);
  renderCalendar();
  renderAgenda();
}
function eventsOn(dateStr) { return events.filter(e => e.date === dateStr).sort((a,b)=> ((a.category||'')<(b.category||'')?-1:1)); }

function renderCalendar() {
  const y = current.getFullYear(), m = current.getMonth();
  document.getElementById('monthLabel').textContent = MONTHS[m] + ' ' + y;
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  let startDay = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const today = todayYmd();

  for (let i = 0; i < startDay; i++) {
    const f = document.createElement('div'); f.className = 'cell filler'; grid.appendChild(f);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = y + '-' + String(m+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const list = eventsOn(dateStr);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    if (dateStr === today) cell.classList.add('today');
    if (dateStr === selectedDate) cell.classList.add('selected');

    const num = document.createElement('span'); num.className = 'daynum'; num.textContent = d; cell.appendChild(num);

    const dots = document.createElement('div'); dots.className = 'dots';
    list.slice(0, 4).forEach(e => {
      const dot = document.createElement('span'); dot.className = 'dot';
      dot.style.background = catColor(e.category);
      dots.appendChild(dot);
    });
    cell.appendChild(dots);

    cell.addEventListener('click', () => selectDay(dateStr));
    grid.appendChild(cell);
  }
}

function selectDay(dateStr) {
  selectedDate = dateStr;
  renderCalendar();
  renderAgenda();
  if (isMobile()) document.getElementById('dayPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderAgenda() {
  const panel = document.getElementById('dayPanel');
  const d = parseYmd(selectedDate);
  const list = eventsOn(selectedDate);
  const isToday = selectedDate === todayYmd();

  let html = '<div class="dp-head"><h3>' + WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + '</h3>' +
    (isToday ? '<span class="dp-today">oggi</span>' : '') + '</div>';

  if (list.length) {
    html += '<div class="dp-events">' + list.map(e =>
      '<div class="event-item" data-id="' + e.id + '">' +
        '<span class="ev-bar" style="background:' + catColor(e.category) + '"></span>' +
        '<div class="txt"><strong>' + esc(e.title) + '</strong>' +
          (e.category ? '<span class="ev-cat-tag" style="color:' + catColor(e.category) + '">' + esc(e.category) + '</span>' : '') +
          (e.note ? '<span class="ev-note">' + esc(e.note) + '</span>' : '') + '</div>' +
        '<button class="del" title="Elimina">×</button></div>'
    ).join('') + '</div>';
  } else {
    html += '<p class="muted dp-empty">Nessun evento in questo giorno.</p>';
  }

  html += '<form class="event-form">' +
    '<input type="text" class="ev-title" placeholder="Aggiungi un evento…" required />' +
    '<div class="event-form-row">' +
      '<select class="ev-cat"><option value="">categoria</option>' +
        CATEGORIES.map(c => '<option value="' + esc(c.label) + '">' + esc(c.label) + '</option>').join('') +
      '</select>' +
      '<input type="text" class="ev-note-in" placeholder="nota (opzionale)" />' +
    '</div>' +
    '<button type="submit" class="btn">Aggiungi</button></form>';

  panel.innerHTML = html;

  panel.querySelectorAll('.del').forEach(btn => btn.addEventListener('click', async (e) => {
    const id = e.target.closest('.event-item').dataset.id;
    await fetch('/api/events/' + id, { method: 'DELETE' });
    events = await fetch('/api/events').then(r => r.json());
    renderCalendar(); renderAgenda();
  }));
  panel.querySelector('.event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = panel.querySelector('.ev-title').value.trim();
    if (!title) return;
    await fetch('/api/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDate, title, category: panel.querySelector('.ev-cat').value, note: panel.querySelector('.ev-note-in').value.trim() }),
    });
    events = await fetch('/api/events').then(r => r.json());
    renderCalendar(); renderAgenda();
  });
}

document.getElementById('prevMonth').addEventListener('click', () => { current.setMonth(current.getMonth()-1); renderCalendar(); });
document.getElementById('nextMonth').addEventListener('click', () => { current.setMonth(current.getMonth()+1); renderCalendar(); });

// swipe tra i mesi
(function () {
  const grid = document.getElementById('calGrid');
  let x0 = null, y0 = null;
  grid.addEventListener('touchstart', (e) => { x0 = e.changedTouches[0].clientX; y0 = e.changedTouches[0].clientY; }, { passive: true });
  grid.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      current.setMonth(current.getMonth() + (dx < 0 ? 1 : -1));
      renderCalendar();
    }
    x0 = y0 = null;
  }, { passive: true });
})();

// ---------- FOTO ----------
async function loadPhotos() {
  const photos = await fetch('/api/photos').then(r => r.json());
  const gallery = document.getElementById('gallery');
  document.getElementById('galleryEmpty').classList.toggle('hidden', photos.length > 0);
  gallery.innerHTML = '';
  photos.forEach(p => {
    const fig = document.createElement('figure');
    const img = document.createElement('img');
    img.src = '/media/' + p.file; img.alt = p.caption || 'foto'; img.loading = 'lazy';
    img.addEventListener('click', () => openLightbox('/media/' + p.file, p.caption));
    fig.appendChild(img);
    if (p.caption || p.date) {
      const cap = document.createElement('figcaption');
      cap.innerHTML = (p.date ? '<span class="cap-date">' + esc(prettyDate(p.date)) + '</span>' : '') + (p.caption ? esc(p.caption) : '');
      fig.appendChild(cap);
    }
    const del = document.createElement('button');
    del.className = 'del-photo'; del.title = 'Elimina'; del.textContent = '×';
    del.addEventListener('click', async () => { await fetch('/api/photos/' + p.id, { method: 'DELETE' }); loadPhotos(); });
    fig.appendChild(del);
    gallery.appendChild(fig);
  });
}
document.getElementById('photoInput').addEventListener('change', async (e) => {
  const files = e.target.files; if (!files.length) return;
  const status = document.getElementById('uploadStatus'); status.textContent = 'Caricamento…';
  const fd = new FormData();
  for (const f of files) fd.append('photos', f);
  fd.append('caption', document.getElementById('caption').value.trim());
  fd.append('date', document.getElementById('photoDate').value);
  const res = await fetch('/api/photos', { method: 'POST', body: fd });
  if (res.ok) {
    status.textContent = 'Caricata';
    document.getElementById('caption').value = ''; document.getElementById('photoDate').value = ''; e.target.value = '';
    loadPhotos(); setTimeout(() => status.textContent = '', 2000);
  } else {
    const d = await res.json().catch(() => ({})); status.textContent = d.error || 'Qualcosa è andato storto.';
  }
});

// ---------- BACHECA ----------
async function loadNotes() {
  const notes = await fetch('/api/notes').then(r => r.json());
  const wall = document.getElementById('notesWall');
  document.getElementById('notesEmpty').classList.toggle('hidden', notes.length > 0);
  wall.innerHTML = notes.map(n => {
    const when = new Date(n.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    return '<div class="note" data-id="' + n.id + '">' +
      '<button class="del-btn" title="Elimina">×</button>' +
      '<div class="note-text">' + esc(n.text) + '</div>' +
      '<div class="note-meta"><span class="who">' + (n.author ? esc(n.author) : '·') + '</span><span>' + when + '</span></div>' +
    '</div>';
  }).join('');
  wall.querySelectorAll('.del-btn').forEach(b => b.addEventListener('click', async (e) => {
    const id = e.target.closest('.note').dataset.id;
    await fetch('/api/notes/' + id, { method: 'DELETE' }); loadNotes();
  }));
}
document.getElementById('noteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = document.getElementById('noteText').value.trim(); if (!text) return;
  const author = document.getElementById('noteAuthor').value.trim();
  await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, author }) });
  document.getElementById('noteText').value = '';
  loadNotes();
});

// ---------- DESIDERI ----------
async function loadWishes() {
  const wishes = await fetch('/api/wishes').then(r => r.json());
  const ul = document.getElementById('wishList');
  document.getElementById('wishesEmpty').classList.toggle('hidden', wishes.length > 0);
  const done = wishes.filter(w => w.done).length;
  document.getElementById('wishBar').style.width = wishes.length ? (done/wishes.length*100) + '%' : '0%';
  document.getElementById('wishCount').textContent = wishes.length ? done + ' / ' + wishes.length + ' fatti' : '';
  ul.innerHTML = wishes.map(w =>
    '<li class="wish-item ' + (w.done ? 'done' : '') + '" data-id="' + w.id + '">' +
      '<button class="check">' + (w.done ? '✓' : '') + '</button>' +
      '<span class="wtext">' + esc(w.text) + '</span>' +
      '<button class="del-btn" title="Elimina">×</button>' +
    '</li>'
  ).join('');
  ul.querySelectorAll('.wish-item').forEach(li => {
    const id = li.dataset.id;
    li.querySelector('.check').addEventListener('click', async () => {
      const done = !li.classList.contains('done');
      await fetch('/api/wishes/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done }) });
      loadWishes();
    });
    li.querySelector('.del-btn').addEventListener('click', async () => {
      await fetch('/api/wishes/' + id, { method: 'DELETE' }); loadWishes();
    });
  });
}
document.getElementById('wishForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = document.getElementById('wishText').value.trim(); if (!text) return;
  await fetch('/api/wishes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  document.getElementById('wishText').value = ''; loadWishes();
});

// ---------- MOTIVI ----------
async function loadReasons() {
  const reasons = await fetch('/api/reasons').then(r => r.json());
  reasonsCache = reasons;
  const box = document.getElementById('reasonList');
  document.getElementById('reasonsEmpty').classList.toggle('hidden', reasons.length > 0);
  box.innerHTML = reasons.map(r =>
    '<div class="reason-chip" data-id="' + r.id + '">' + esc(r.text) +
      '<button class="del-btn" title="Elimina">×</button></div>'
  ).join('');
  box.querySelectorAll('.del-btn').forEach(b => b.addEventListener('click', async (e) => {
    const id = e.target.closest('.reason-chip').dataset.id;
    await fetch('/api/reasons/' + id, { method: 'DELETE' }); loadReasons();
  }));
}
document.getElementById('reasonForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = document.getElementById('reasonText').value.trim(); if (!text) return;
  await fetch('/api/reasons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  document.getElementById('reasonText').value = ''; loadReasons();
});

// ---------- Lightbox ----------
function openLightbox(src, caption) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightboxCap').textContent = caption || '';
  document.getElementById('lightbox').classList.remove('hidden');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  document.getElementById('lightboxImg').src = '';
}
document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') closeLightbox(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeLightbox(); closeSettings(); } });

// ---------- Impostazioni ----------
const settingsModal = document.getElementById('settingsModal');
document.getElementById('settingsBtn').addEventListener('click', async () => {
  settings = await fetch('/api/settings').then(r => r.json());
  document.getElementById('setName1').value = settings.name1 || '';
  document.getElementById('setName2').value = settings.name2 || '';
  document.getElementById('setAnniversary').value = settings.anniversary || '';
  document.getElementById('setReunion').value = settings.reunion || '';
  settingsModal.classList.remove('hidden');
});
function closeSettings() { settingsModal.classList.add('hidden'); }
document.querySelector('.modal-close').addEventListener('click', closeSettings);
settingsModal.addEventListener('click', (e) => { if (e.target.id === 'settingsModal') closeSettings(); });
document.getElementById('saveSettings').addEventListener('click', async () => {
  const body = {
    name1: document.getElementById('setName1').value.trim(),
    name2: document.getElementById('setName2').value.trim(),
    anniversary: document.getElementById('setAnniversary').value,
    reunion: document.getElementById('setReunion').value,
  };
  const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (res.ok) {
    document.getElementById('settingsStatus').textContent = 'Salvato';
    setTimeout(() => { document.getElementById('settingsStatus').textContent = ''; closeSettings(); loadHome(); }, 800);
  }
});

// avvio
loadHome();