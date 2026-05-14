// ============================================================
// Manu — Deep Jungle Web-App
// Single-file Vanilla-JS, localStorage + IndexedDB
// ============================================================
'use strict';

// -------- Konstanten ----------
const STORE_KEY = 'manu.v1';
const DB_NAME = 'manu-files';
const DB_VERSION = 1;
const STORE_FILES = 'receipts';

const FORMATTER = new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'});
const fmtEur = n => FORMATTER.format(n || 0);
const fmtNum = n => new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
const fmtDate = iso => {
  if(!iso) return '';
  const [y,m,d] = String(iso).slice(0,10).split('-');
  return `${d}.${m}.${y}`;
};
const todayIso = () => new Date().toISOString().slice(0,10);
const monthKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const uid = (p='id') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = sel => document.querySelector(sel);

// -------- Count-Up-Animation für große Beträge ----------
function animateCountUp(el, target, duration=620){
  if(!el || typeof target !== 'number' || !isFinite(target)) return;
  const start = 0;
  const startTime = performance.now();
  const sign = target < 0 ? '-' : '';
  const abs = Math.abs(target);
  function step(now){
    const t = Math.min(1, (now - startTime) / duration);
    // easeOutCubic
    const eased = 1 - Math.pow(1 - t, 3);
    const value = start + (abs - start) * eased;
    el.textContent = sign + FORMATTER.format(value).replace('-','');
    if(t < 1) requestAnimationFrame(step);
    else el.textContent = FORMATTER.format(target);
  }
  requestAnimationFrame(step);
}
function applyCountUpToView(root){
  root.querySelectorAll('[data-count-up]').forEach(el => {
    const target = Number(el.dataset.countUp);
    animateCountUp(el, target);
  });
}

// -------- Konfetti (CSS-only) ----------
function fireConfetti(durationMs=1400){
  tap([10, 30, 10]);
  const colors = ['#10B981','#A47A29','#1FAB89','#F4F0E8','#4A7C59'];
  const host = document.createElement('div');
  host.className = 'confetti-host';
  document.body.appendChild(host);
  for(let i=0;i<60;i++){
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random()*100 + 'vw';
    piece.style.top = -Math.random()*20 + 'px';
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = (Math.random()*0.3) + 's';
    piece.style.transform = `rotate(${Math.random()*360}deg)`;
    host.appendChild(piece);
  }
  setTimeout(() => host.remove(), durationMs);
}
// `icon('plus')` → <svg class="icon icon-md"><use href="#i-plus"/></svg>
function icon(name, size='md', extra=''){
  return `<svg class="icon icon-${size} ${extra}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}
// `tap()` — kurzer haptischer Tick wo der Browser es kann
function tap(pattern=12){
  try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch{}
}
// `cardTitle('icon', 'Label', 'gold' | 'berry')` → standardisierter Card-Header
function cardTitle(iconName, label, tone=''){
  const cls = tone ? ` ${tone}` : '';
  return `<div class="card-title"><h2><span class="ti-icon${cls}">${icon(iconName,'md')}</span>${escapeHtml(label)}</h2></div>`;
}
// `iconBtn('upload', 'Hochladen', 'primary', 'id="bk-export"')` → Icon + Text-Button
function iconBtn(iconName, label, extraClass='', dataAttrs=''){
  return `<button class="${extraClass}"${dataAttrs ? ' '+dataAttrs : ''}>${icon(iconName,'sm')}<span>${escapeHtml(label)}</span></button>`;
}
// `helpHint('Wohnfläche', 'Erklärung …')` → ?-Icon mit Hover/Click-Tooltip
function helpHint(body){
  return `<span class="help-hint" tabindex="0" data-hint="${escapeHtml(body)}" aria-label="Hilfe">?</span>`;
}

// -------- Toast-Notifications ----------
const Toast = (() => {
  let host = null;
  const ensureHost = () => host || (host = document.getElementById('toast-host'));
  // show(msg, type, timeout, actions) — actions: [{label, onClick}]
  function show(message, type='info', timeout=3200, actions=null){
    const h = ensureHost(); if(!h) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const ic = type==='success' ? 'check-circle' : type==='error' ? 'alert-circle' : 'info';
    let body = `${icon(ic,'md')}<span class="toast-msg">${escapeHtml(message)}</span>`;
    if(actions && actions.length){
      body += `<div class="toast-actions">${actions.map((a,i) => `<button data-act="${i}">${escapeHtml(a.label)}</button>`).join('')}</div>`;
    }
    el.innerHTML = body;
    h.appendChild(el);
    let timer = setTimeout(dismiss, timeout);
    function dismiss(){
      clearTimeout(timer);
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 240);
    }
    // Hover stoppt Timer (User möchte vermutlich klicken)
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 1500); });
    if(actions){
      el.querySelectorAll('[data-act]').forEach(btn => {
        btn.onclick = () => {
          const action = actions[Number(btn.dataset.act)];
          dismiss();
          if(action?.onClick) action.onClick();
        };
      });
    }
    return { dismiss };
  }
  return {
    show,
    info: (m) => show(m, 'info'),
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error', 4500),
    undo: (msg, onUndo) => show(msg, 'info', 6000, [{label:'Rückgängig', onClick:onUndo}]),
  };
})();

// -------- Built-in Kategorien ----------
const BUILTIN_CATEGORIES = [
  {id:'cat-miete',         label:'Mieteinnahmen',        emoji:'',  group:'emerald', taxRelevant:true,  income:true},
  {id:'cat-nk',            label:'Nebenkosten',          emoji:'',  group:'emerald', taxRelevant:true,  income:true},
  {id:'cat-strom',         label:'Strom',                emoji:'',  group:'moss',    taxRelevant:true},
  {id:'cat-wasser',        label:'Wasser',               emoji:'',  group:'moss',    taxRelevant:true},
  {id:'cat-gas',           label:'Gas / Heizung',        emoji:'',  group:'moss',    taxRelevant:true},
  {id:'cat-hausgeld',      label:'Hausgeld',             emoji:'',  group:'moss',    taxRelevant:true},
  {id:'cat-gez',           label:'Rundfunk (GEZ)',       emoji:'',  group:'moss',    taxRelevant:true},
  {id:'cat-versicherung',  label:'Versicherung',         emoji:'',  group:'moss',    taxRelevant:true},
  {id:'cat-grundsteuer',   label:'Grundsteuer',          emoji:'',  group:'moss',    taxRelevant:true},
  {id:'cat-internet',      label:'Internet / Telefon',   emoji:'',  group:'moss',    taxRelevant:false},
  {id:'cat-reparatur',     label:'Reparatur / Instandhaltung', emoji:'',  group:'sage', taxRelevant:true},
  {id:'cat-renovierung',   label:'Renovierung',          emoji:'',  group:'sage',    taxRelevant:true},
  {id:'cat-kredit',        label:'Kredit / Zinsen',      emoji:'',  group:'moss',    taxRelevant:true},
  {id:'cat-afa',           label:'AfA',                  emoji:'',  group:'moss',    taxRelevant:true},
  {id:'cat-steuerberater', label:'Steuerberater',        emoji:'',  group:'moss',    taxRelevant:true},
  {id:'cat-werbung',       label:'Werbungskosten Sonstige', emoji:'', group:'moss',  taxRelevant:true},
  {id:'cat-einkauf',       label:'Einkauf',              emoji:'',  group:'neutral', taxRelevant:false},
  {id:'cat-freizeit',      label:'Freizeit',             emoji:'',  group:'neutral', taxRelevant:false},
  {id:'cat-restaurant',    label:'Restaurant',           emoji:'',  group:'neutral', taxRelevant:false},
  {id:'cat-sonstiges',     label:'Sonstiges',            emoji:'',  group:'neutral', taxRelevant:false},
];

// -------- Store ----------
const Store = (() => {
  const defaults = () => ({
    version:1,
    currentMonth: monthKey(),
    properties:[],
    bookings:[],
    tenants:[],
    craftsmen:[],
    receipts:[],
    documents:[],
    categories: BUILTIN_CATEGORIES.map(c => ({...c})),
    tags:[],
    subscriptions:[],
    contracts:[],
    goals:[],
    assets:[],
    liabilities:[],
    budgets:[],
    investments:[],
    debtPlans:[],
    maintenanceLogs:[],
    splits:[],
    reminders:[],
    handovers:[],
    vacancies:[],
    datevMapping:[],
    meterReadings:[],
    templates:[],
    rules:[],
    trash:[],
    achievements:{ unlocked:[], streak:0, totalBookings:0 },
    settings:{
      pinHash: null,
      pinSalt: null,
      pinIter: 0,
      pinAttempts: 0,
      pinLockedUntil: 0,
      autoLockMinutes:0,
      onboardingDone:false,
      colorScheme:'light',
      locale:'de',
      advisorMode:false,
      fontScale:'normal',
      activeTab:'dashboard',
      helpHintsEnabled:true,
    },
  });

  let state = loadInitial();
  const listeners = new Set();

  function mergeBase(parsed){
    const base = defaults();
    return {...base, ...parsed,
      settings:{...base.settings, ...(parsed.settings||{})},
      achievements:{...base.achievements, ...(parsed.achievements||{})},
    };
  }

  function loadInitial(){
    // Tresor verschlüsselt? Dann erst nach Unlock laden.
    if(isEncrypted()) return defaults();
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if(!raw) return defaults();
      return mergeBase(JSON.parse(raw));
    }catch(e){ console.warn('Store load failed',e); return defaults(); }
  }

  async function loadVault(){
    const raw = localStorage.getItem(VAULT_KEY);
    if(!raw) return defaults();
    const env = JSON.parse(raw);
    const data = await decryptWithMaster(env);
    return mergeBase(data);
  }

  async function persist(){
    try{
      if(hasMasterKey() && isEncrypted()){
        const env = await encryptWithMaster(state);
        localStorage.setItem(VAULT_KEY, JSON.stringify(env));
        // Klartext-Reste entfernen
        localStorage.removeItem(STORE_KEY);
      } else if(!isEncrypted()){
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
      }
      // Wenn verschlüsselt aber kein Master-Key (locked) → kein Schreiben.
    }catch(e){
      if(e && e.name === 'QuotaExceededError'){
        Toast.error('Speicher voll. Bitte alte Belege löschen oder Backup machen.');
      } else {
        console.warn('persist failed', e);
      }
    }
  }

  // Schreibvorgänge serialisieren, damit zwei schnelle Updates nicht
  // race-en (persist ist async wegen AES-GCM-encryptWithMaster).
  let writeChain = Promise.resolve();
  function schedulePersist(){
    writeChain = writeChain.then(persist, persist);
    return writeChain;
  }

  function notify(){ for(const l of listeners) l(state); }

  return {
    get(){ return state; },
    set(patch){ state = {...state, ...patch}; schedulePersist(); notify(); },
    update(fn){ state = fn(state); schedulePersist(); notify(); },
    on(fn){ listeners.add(fn); return () => listeners.delete(fn); },
    reset(){ state = defaults(); schedulePersist(); notify(); },
    replace(snapshot){ state = mergeBase(snapshot); schedulePersist(); notify(); },
    flush(){ return writeChain; },
    // Tresor-API:
    async hydrateFromVault(){
      state = await loadVault();
      notify();
    },
    setStateRaw(s){ state = s; notify(); },
  };
})();

// -------- IndexedDB für Belege ----------
const FilesDB = (() => {
  let dbPromise = null;
  function open(){
    if(!dbPromise) dbPromise = new Promise((resolve,reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  async function putRaw(id, blob){
    const db = await open();
    return new Promise((resolve,reject) => {
      const tx = db.transaction(STORE_FILES,'readwrite');
      tx.objectStore(STORE_FILES).put(blob, id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  async function getRaw(id){
    const db = await open();
    return new Promise((resolve,reject) => {
      const tx = db.transaction(STORE_FILES,'readonly');
      const r = tx.objectStore(STORE_FILES).get(id);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  }
  async function put(id, blob){
    if(hasMasterKey()){
      const enc = await encryptBlobWithMaster(blob);
      return putRaw(id, enc);
    }
    return putRaw(id, blob);
  }
  async function get(id){
    const raw = await getRaw(id);
    if(!raw) return null;
    if(hasMasterKey() && await isEncryptedBlob(raw)){
      try{ return await decryptBlobWithMaster(raw); }
      catch(e){ console.warn('blob decrypt failed', e); return null; }
    }
    return raw;
  }
  async function remove(id){
    const db = await open();
    return new Promise((resolve,reject) => {
      const tx = db.transaction(STORE_FILES,'readwrite');
      tx.objectStore(STORE_FILES).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  async function asDataURL(id){
    const blob = await get(id);
    if(!blob) return null;
    return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  }
  async function listIds(){
    const db = await open();
    return new Promise((resolve,reject) => {
      const tx = db.transaction(STORE_FILES,'readonly');
      const r = tx.objectStore(STORE_FILES).getAllKeys();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  }
  return { put, get, remove, asDataURL, open, putRaw, getRaw, listIds };
})();

// -------- Modal-Helper ----------
function openModal(title, bodyHtml, onMount){
  const host = $('#modal-host');
  host.innerHTML = `
    <div class="modal-overlay" data-overlay>
      <div class="modal">
        <div class="card-title"><h2>${escapeHtml(title)}</h2>
          <button class="icon" data-close>×</button></div>
        <div data-body>${bodyHtml}</div>
      </div>
    </div>`;
  const close = () => host.innerHTML = '';
  host.querySelector('[data-close]').onclick = close;
  host.querySelector('[data-overlay]').onclick = (e) => { if(e.target.matches('[data-overlay]')) close(); };
  if(onMount) onMount(host.querySelector('[data-body]'), close);
  return close;
}
function confirmAlert(msg, onYes){
  openModal('Bestätigen',`
    <p style="margin:0 0 16px">${escapeHtml(msg)}</p>
    <div class="row" style="justify-content:flex-end;gap:8px">
      <button data-no>Abbrechen</button>
      <button class="primary" data-yes>Bestätigen</button>
    </div>
  `, (body, close) => {
    body.querySelector('[data-no]').onclick = close;
    body.querySelector('[data-yes]').onclick = () => { close(); onYes(); };
  });
}

// ============================================================
// SEARCH-PALETTE (Cmd/Ctrl + K)
// ============================================================
function buildSearchIndex(st){
  const idx = [];
  for(const b of st.bookings){
    const cat = st.categories?.find(c => c.id === b.categoryId) || BUILTIN_CATEGORIES.find(c => c.id === b.categoryId);
    idx.push({
      kind:'Buchung', icon:'receipt', tab:'bookings',
      label: `${escapeHtml(b.counterparty || '(ohne Empfänger)')} · ${fmtEur(b.amount)}`,
      meta: `${fmtDate(b.date)} · ${cat?.label || ''}`,
      search: `${b.counterparty||''} ${b.note||''} ${b.amount} ${b.date} ${cat?.label||''}`.toLowerCase(),
    });
  }
  for(const p of st.properties){
    idx.push({
      kind:'Eiche', icon:'tree', tab:'oak',
      label: escapeHtml(p.name),
      meta: p.address ? escapeHtml(p.address) : '',
      search: `${p.name||''} ${p.address||''}`.toLowerCase(),
      onSelect: () => Store.update(s => ({...s, _filterPropertyId: p.id})),
    });
  }
  for(const t of (st.tenants||[])){
    idx.push({
      kind:'Mieter', icon:'users', tab:'oak',
      label: escapeHtml(t.name),
      meta: t.iban ? `IBAN ${escapeHtml(t.iban)}` : '',
      search: `${t.name||''} ${t.iban||''}`.toLowerCase(),
    });
  }
  for(const c of (st.craftsmen||[])){
    idx.push({
      kind:'Handwerker', icon:'hammer', tab:'tools',
      label: escapeHtml(c.name),
      meta: c.phone ? escapeHtml(c.phone) : '',
      search: `${c.name||''} ${c.phone||''}`.toLowerCase(),
    });
  }
  const cats = [...BUILTIN_CATEGORIES, ...(st.categories||[])];
  for(const c of cats){
    idx.push({
      kind:'Kategorie', icon:'list', tab:'bookings',
      label: escapeHtml(c.label),
      meta: c.taxRelevant ? 'steuerrelevant' : '',
      search: `${c.label||''}`.toLowerCase(),
    });
  }
  return idx;
}

let _searchOpen = false;
function openSearchPalette(){
  if(_searchOpen) return;
  _searchOpen = true;
  const st = Store.get();
  const all = buildSearchIndex(st);
  const host = $('#modal-host');
  host.innerHTML = `
    <div class="modal-overlay" data-overlay>
      <div class="modal search-palette mxw-560">
        <div class="search-bar">${icon('search','md')}
          <input id="sp-input" placeholder="Buchung, Eiche, Mieter, Kategorie suchen …" autofocus />
          <button class="ghost icon" data-close-sp aria-label="Schließen">${icon('x','sm')}</button>
        </div>
        <div class="search-results" id="sp-results"></div>
        <div class="muted center mt-md" style="font-size:12px">↑ ↓ navigieren · Enter öffnen · Esc schließen</div>
      </div>
    </div>
  `;
  const input = host.querySelector('#sp-input');
  const results = host.querySelector('#sp-results');
  let selected = 0;
  let filtered = [];

  const close = () => { _searchOpen = false; host.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  host.querySelector('[data-close-sp]').onclick = close;
  host.querySelector('[data-overlay]').onclick = (e) => { if(e.target === e.currentTarget) close(); };

  const renderResults = () => {
    if(!filtered.length){
      results.innerHTML = `<div class="muted center" style="padding:20px">Keine Treffer</div>`;
      return;
    }
    results.innerHTML = filtered.slice(0, 30).map((r,i) => `
      <div class="search-result ${i===selected?'active':''}" data-idx="${i}">
        <span class="sr-icon">${icon(r.icon,'md')}</span>
        <div class="sr-body">
          <div class="sr-label">${r.label} <span class="muted" style="font-size:11px">· ${r.kind}</span></div>
          ${r.meta ? `<div class="sr-meta">${r.meta}</div>` : ''}
        </div>
      </div>
    `).join('');
    results.querySelectorAll('[data-idx]').forEach(el => {
      el.onclick = () => { selectAt(Number(el.dataset.idx)); commit(); };
    });
  };
  const selectAt = (i) => { selected = Math.max(0, Math.min(filtered.length-1, i)); renderResults(); };
  const commit = () => {
    const r = filtered[selected];
    if(!r) return;
    close();
    Store.update(s => ({...s, settings:{...s.settings, activeTab: r.tab}}));
    if(r.onSelect) r.onSelect();
    render();
  };
  const update = () => {
    const q = input.value.trim().toLowerCase();
    if(!q){
      filtered = all.slice(0, 12);
    } else {
      filtered = all.filter(r => r.search.includes(q)).slice(0, 50);
    }
    selected = 0;
    renderResults();
  };
  const onKey = (e) => {
    if(e.key === 'Escape'){ close(); }
    else if(e.key === 'ArrowDown'){ e.preventDefault(); selectAt(selected+1); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); selectAt(selected-1); }
    else if(e.key === 'Enter'){ e.preventDefault(); commit(); }
  };
  input.oninput = update;
  document.addEventListener('keydown', onKey);
  update();
}

// =============================================================
// Duplikat-Erkennung — gleicher Betrag (±1 ct), Empfänger, ±2 Tg Datum
function findDuplicate(draft, st){
  if(!draft.amount) return null;
  const dDate = new Date(draft.date + 'T12:00:00').getTime();
  const key = (draft.counterparty||'').trim().toLowerCase();
  for(const b of st.bookings){
    if(b.type !== draft.type) continue;
    if(Math.abs(b.amount - draft.amount) > 0.01) continue;
    if((b.counterparty||'').trim().toLowerCase() !== key) continue;
    const bDate = new Date(b.date + 'T12:00:00').getTime();
    if(Math.abs(bDate - dDate) > 2 * 24 * 3600 * 1000) continue;
    return b;
  }
  return null;
}

// =============================================================
// SMART-Kategorie-Vorschlag
// =============================================================
// Liefert die häufigste Kategorie, die zu einem Empfänger in der
// Historie verwendet wurde. Returns {id, label, count} oder null.
function suggestCategoryFor(counterparty, st){
  const key = (counterparty||'').trim().toLowerCase();
  if(!key) return null;
  const matches = st.bookings.filter(b =>
    b.categoryId && (b.counterparty||'').trim().toLowerCase() === key
  );
  if(!matches.length) return null;
  const counts = {};
  for(const b of matches){ counts[b.categoryId] = (counts[b.categoryId]||0) + 1; }
  const best = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  if(!best) return null;
  const allCats = [...BUILTIN_CATEGORIES, ...(st.categories||[])];
  const cat = allCats.find(c => c.id === best[0]);
  if(!cat) return null;
  return { id: cat.id, label: cat.label, count: best[1] };
}

// openProgressModal — zeigt Skeleton + Live-Text, returns {update, close}.
function openProgressModal(title, initialMsg=''){
  let bodyEl = null, closeFn = () => {};
  openModal(title, `
    <div id="pm-msg" class="muted mb-md">${escapeHtml(initialMsg)}</div>
    <div class="stack">
      <div class="skeleton" style="height:16px"></div>
      <div class="skeleton" style="height:16px;width:70%"></div>
      <div class="skeleton" style="height:16px;width:85%"></div>
    </div>
  `, (body, close) => { bodyEl = body; closeFn = close; });
  return {
    update(msg){ if(bodyEl){ const m = bodyEl.querySelector('#pm-msg'); if(m) m.textContent = msg; } },
    close(){ closeFn(); },
  };
}

// promptModal — Eingabe-Modal mit ein oder zwei Inputs.
// Returns Promise<{value, value2} | null>.
function promptModal({title, description, label, label2, confirmLabel='OK', type='text', minLen}){
  return new Promise(resolve => {
    const dual = !!label2;
    openModal(title, `
      ${description ? `<p style="margin:0 0 14px">${escapeHtml(description)}</p>` : ''}
      <div class="form">
        <div><label>${escapeHtml(label)}</label><input id="pm-input" type="${type}" autofocus /></div>
        ${dual ? `<div><label>${escapeHtml(label2)}</label><input id="pm-input2" type="${type}" /></div>` : ''}
        <p class="lock-error" id="pm-err"></p>
      </div>
      <div class="modal-actions">
        <button data-cancel>Abbrechen</button>
        <button class="primary" data-ok>${escapeHtml(confirmLabel)}</button>
      </div>
    `, (body, close) => {
      let done = false;
      const finish = (result) => { if(done) return; done = true; close(); resolve(result); };
      body.querySelector('[data-cancel]').onclick = () => finish(null);
      const inputEl = body.querySelector('#pm-input');
      const input2El = dual ? body.querySelector('#pm-input2') : null;
      const errEl = body.querySelector('#pm-err');
      const submit = () => {
        const v = inputEl.value;
        const v2 = input2El ? input2El.value : undefined;
        if(minLen && v.length < minLen){ errEl.textContent = `Mindestens ${minLen} Zeichen`; return; }
        if(dual && v !== v2){ errEl.textContent = 'Eingaben stimmen nicht überein'; return; }
        finish({ value: v, value2: v2 });
      };
      body.querySelector('[data-ok]').onclick = submit;
      inputEl.onkeydown = (e) => { if(e.key === 'Enter' && !dual) submit(); };
      if(input2El) input2El.onkeydown = (e) => { if(e.key === 'Enter') submit(); };
    });
  });
}

// -------- PIN-Hash (lokal, simpel) ----------
// ---- Secure PIN-Hashing (PBKDF2 + per-install Salt) ----
const PIN_ITER = 200000;
function bytesToB64(bytes){
  let s=''; for(const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBytes(b64){
  const s = atob(b64); const out = new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) out[i] = s.charCodeAt(i);
  return out;
}
function randomBytes(n){
  const a = new Uint8Array(n); crypto.getRandomValues(a); return a;
}
async function derivePinBits(pin, saltB64, iter=PIN_ITER){
  const salt = b64ToBytes(saltB64);
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {name:'PBKDF2', salt, iterations:iter, hash:'SHA-256'}, baseKey, 256
  );
  return bytesToB64(new Uint8Array(bits));
}
async function hashPin(pin){
  const salt = bytesToB64(randomBytes(16));
  const hash = await derivePinBits(pin, salt, PIN_ITER);
  return { pinHash: hash, pinSalt: salt, pinIter: PIN_ITER };
}
async function verifyPin(pin, settings){
  // Migration: alter SHA-256 + '|manu-salt' Hash (hex, 64 Zeichen)
  if(!settings.pinSalt && settings.pinHash && /^[0-9a-f]{64}$/i.test(settings.pinHash)){
    const legacy = await sha256(pin + '|manu-salt');
    if(legacy === settings.pinHash) return { ok:true, migrate:true };
    return { ok:false };
  }
  if(!settings.pinHash || !settings.pinSalt) return { ok:false };
  const h = await derivePinBits(pin, settings.pinSalt, settings.pinIter || PIN_ITER);
  return { ok: h === settings.pinHash };
}

// ---- Brute-Force-Schutz: gestaffeltes Lockout ----
function lockoutDelayMs(attempts){
  if(attempts < 5)  return 0;
  if(attempts < 10) return 30 * 1000;          // 30 s
  if(attempts < 15) return 5 * 60 * 1000;      // 5 min
  if(attempts < 20) return 30 * 60 * 1000;     // 30 min
  if(attempts < 25) return 2 * 60 * 60 * 1000; // 2 h
  return 24 * 60 * 60 * 1000;                  // 24 h
}
function formatRemaining(ms){
  if(ms <= 0) return '';
  const s = Math.ceil(ms / 1000);
  if(s < 60) return `${s} s`;
  const m = Math.ceil(s/60); if(m < 60) return `${m} min`;
  const h = Math.ceil(m/60); return `${h} h`;
}

// ---- AES-GCM Backup-Verschlüsselung ----
async function deriveAesKey(passphrase, saltB64, iter=PIN_ITER){
  const salt = b64ToBytes(saltB64);
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt, iterations:iter, hash:'SHA-256'},
    base,
    {name:'AES-GCM', length:256},
    false,
    ['encrypt','decrypt']
  );
}
async function encryptJson(obj, passphrase){
  const salt = bytesToB64(randomBytes(16));
  const iv = randomBytes(12);
  const key = await deriveAesKey(passphrase, salt, PIN_ITER);
  const plain = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, plain);
  return { v:2, app:'manu-web', kdf:'PBKDF2-SHA256', iter:PIN_ITER, salt, iv:bytesToB64(iv), ct:bytesToB64(new Uint8Array(ct)) };
}
async function decryptJson(envelope, passphrase){
  if(envelope.v !== 2) throw new Error('Unbekanntes Backup-Format');
  const key = await deriveAesKey(passphrase, envelope.salt, envelope.iter || PIN_ITER);
  const plain = await crypto.subtle.decrypt(
    {name:'AES-GCM', iv:b64ToBytes(envelope.iv)},
    key,
    b64ToBytes(envelope.ct)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

async function sha256(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// =============================================================
// Tresor — Master-Key + Envelopes
// =============================================================
// Master-Key wird im Speicher gehalten, sobald entweder PIN oder
// Recovery-Code erfolgreich entschlüsselt wurde. Beim Auto-Lock
// und beim Hidden-Tab wird er gewipt.

const META_KEY = 'manu.meta';
const VAULT_KEY = 'manu.v2';   // verschlüsselter State
let _masterKey = null;          // CryptoKey | null
function setMasterKey(k){ _masterKey = k; }
function clearMasterKey(){ _masterKey = null; }
function hasMasterKey(){ return _masterKey !== null; }

function loadMeta(){
  try{ const r = localStorage.getItem(META_KEY); return r ? JSON.parse(r) : null; }
  catch{ return null; }
}
function saveMeta(meta){ localStorage.setItem(META_KEY, JSON.stringify(meta)); }
function patchMeta(patch){ const m = loadMeta() || {}; saveMeta({...m, ...patch}); return {...m, ...patch}; }

function isEncrypted(){
  const m = loadMeta();
  return !!(m && m.pinEnvelope);
}

async function generateMasterKey(){
  return crypto.subtle.generateKey({name:'AES-GCM', length:256}, true, ['encrypt','decrypt']);
}
async function importRawMaster(rawBytes){
  return crypto.subtle.importKey('raw', rawBytes, {name:'AES-GCM', length:256}, true, ['encrypt','decrypt']);
}
async function exportRawMaster(key){
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}
async function deriveAesKeyBits(passphrase, saltB64, iter){
  const salt = b64ToBytes(saltB64);
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt, iterations:iter, hash:'SHA-256'},
    base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']
  );
}
async function wrapMaster(master, passphrase){
  const salt = bytesToB64(randomBytes(16));
  const iter = PIN_ITER;
  const wrapKey = await deriveAesKeyBits(passphrase, salt, iter);
  const iv = randomBytes(12);
  const rawMaster = await exportRawMaster(master);
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, wrapKey, rawMaster);
  return { salt, iter, iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
}
async function unwrapMaster(envelope, passphrase){
  const wrapKey = await deriveAesKeyBits(passphrase, envelope.salt, envelope.iter || PIN_ITER);
  const raw = await crypto.subtle.decrypt(
    {name:'AES-GCM', iv:b64ToBytes(envelope.iv)},
    wrapKey,
    b64ToBytes(envelope.ct)
  );
  return importRawMaster(new Uint8Array(raw));
}
const STATE_AAD = new TextEncoder().encode('manu.v2:state');
const BLOB_AAD  = new TextEncoder().encode('manu.v2:blob');
async function encryptWithMaster(plainObj){
  if(!_masterKey) throw new Error('Master-Key fehlt');
  const iv = randomBytes(12);
  const plain = new TextEncoder().encode(JSON.stringify(plainObj));
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:STATE_AAD}, _masterKey, plain);
  return { iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
}
async function decryptWithMaster(envelope){
  if(!_masterKey) throw new Error('Master-Key fehlt');
  // Backwards-compat: ältere v2-States ohne AAD lesen (Fallback)
  try{
    const plain = await crypto.subtle.decrypt(
      {name:'AES-GCM', iv:b64ToBytes(envelope.iv), additionalData:STATE_AAD},
      _masterKey,
      b64ToBytes(envelope.ct)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }catch(e){
    const plain = await crypto.subtle.decrypt(
      {name:'AES-GCM', iv:b64ToBytes(envelope.iv)},
      _masterKey,
      b64ToBytes(envelope.ct)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }
}
const BLOB_MAGIC = 'MANU2\n'; // 6 Bytes Präfix vor JSON-Envelope
async function encryptBlobWithMaster(blob){
  if(!_masterKey) throw new Error('Master-Key fehlt');
  const buf = new Uint8Array(await blob.arrayBuffer());
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:BLOB_AAD}, _masterKey, buf);
  const payload = BLOB_MAGIC + JSON.stringify({v:2, mime: blob.type || '', iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct))});
  return new Blob([payload], {type:'application/x-manu-enc'});
}
async function isEncryptedBlob(blob){
  if(!blob || blob.size < BLOB_MAGIC.length) return false;
  try{
    const head = await blob.slice(0, BLOB_MAGIC.length).text();
    return head === BLOB_MAGIC;
  }catch{ return false; }
}
async function decryptBlobWithMaster(blob){
  if(!_masterKey) throw new Error('Master-Key fehlt');
  const text = await blob.text();
  if(!text.startsWith(BLOB_MAGIC)) throw new Error('Beleg beschädigt: kein Manu-Header');
  let env; try{ env = JSON.parse(text.slice(BLOB_MAGIC.length)); }catch{ throw new Error('Beleg beschädigt: kein JSON-Header'); }
  if(!env || env.v !== 2 || !env.iv || !env.ct) throw new Error('Beleg beschädigt: ungültiger Envelope');
  // AAD-Versuch zuerst, Fallback auf legacy (ohne AAD) für alte Blobs
  let plain;
  try{
    plain = await crypto.subtle.decrypt(
      {name:'AES-GCM', iv:b64ToBytes(env.iv), additionalData:BLOB_AAD},
      _masterKey,
      b64ToBytes(env.ct)
    );
  }catch{
    plain = await crypto.subtle.decrypt(
      {name:'AES-GCM', iv:b64ToBytes(env.iv)},
      _masterKey,
      b64ToBytes(env.ct)
    );
  }
  return new Blob([plain], {type: env.mime || 'application/octet-stream'});
}

// Recovery-Code: 24 Zeichen aus Crockford-Base32 (32 Chars), in 4er-Gruppen
const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 Chars, ohne I, L, O, U
function generateRecoveryCode(){
  const bytes = randomBytes(15); // 15 * 8 = 120 Bit -> 24 Chars Base32
  let bits = 0n; for(const b of bytes) bits = (bits << 8n) | BigInt(b);
  let out = ''; for(let i=0;i<24;i++){ out = RECOVERY_ALPHABET[Number(bits & 31n)] + out; bits >>= 5n; }
  return out.match(/.{1,4}/g).join('-'); // ABCD-EFGH-... insgesamt 6 Gruppen
}
function normalizeRecovery(code){
  return String(code || '').toUpperCase()
    .replace(/[IL]/g,'1').replace(/O/g,'0').replace(/U/g,'V')
    .replace(/[^0-9A-HJ-NP-TV-Z]/g,'');
}

// ---- Tresor-Setup, Unlock, Recovery ----
async function setupVault(pin, opts={}){
  // Erstellt PIN- und Recovery-Envelopes, verschlüsselt State + Belege.
  // Bei erstmaligem Setup wird ein Master-Key erzeugt; bei einer
  // PIN-Änderung übernimmt der bestehende Master-Key.
  if(!_masterKey) setMasterKey(await generateMasterKey());

  const pinEnvelope = await wrapMaster(_masterKey, pin);
  const recoveryCode = opts.keepRecovery ? null : generateRecoveryCode();
  const meta = loadMeta() || {};
  const patch = {
    pinEnvelope,
    pinAttempts: 0,
    pinLockedUntil: 0,
  };
  if(recoveryCode){
    patch.recoveryEnvelope = await wrapMaster(_masterKey, normalizeRecovery(recoveryCode));
    patch.recoveryHint = recoveryCode.slice(0,4);
    patch.setupAt = new Date().toISOString();
  }
  patchMeta(patch);

  // Belege verschlüsseln, falls noch unverschlüsselt
  try{
    const ids = await FilesDB.listIds();
    for(const id of ids){
      const raw = await FilesDB.getRaw(id);
      if(raw && !(await isEncryptedBlob(raw))){
        const enc = await encryptBlobWithMaster(raw);
        await FilesDB.putRaw(id, enc);
      }
    }
  }catch(e){ console.warn('blob migration failed', e); }

  // State verschlüsselt schreiben, alten Klartext löschen
  const envState = await encryptWithMaster(Store.get());
  localStorage.setItem(VAULT_KEY, JSON.stringify(envState));
  localStorage.removeItem(STORE_KEY);
  sessionStorage.setItem('manu.unlocked','1');

  return recoveryCode;
}

async function unlockWithPin(pin){
  const meta = loadMeta();
  if(!meta || !meta.pinEnvelope) return { ok:false, reason:'no-envelope' };
  if((meta.pinLockedUntil || 0) > Date.now()) return { ok:false, reason:'locked' };
  try{
    const master = await unwrapMaster(meta.pinEnvelope, pin);
    setMasterKey(master);
    await Store.hydrateFromVault();
    patchMeta({ pinAttempts: 0, pinLockedUntil: 0 });
    sessionStorage.setItem('manu.unlocked','1');
    try{ runAutoBookings(); }catch{}
    return { ok:true };
  }catch(e){
    const attempts = (meta.pinAttempts || 0) + 1;
    const delay = lockoutDelayMs(attempts);
    patchMeta({
      pinAttempts: attempts,
      pinLockedUntil: delay > 0 ? Date.now() + delay : 0,
    });
    return { ok:false, reason:'pin', attempts };
  }
}

async function recoverWithCode(recoveryInput, newPin){
  const meta = loadMeta();
  if(!meta || !meta.recoveryEnvelope) throw new Error('Kein Recovery-Envelope vorhanden');
  const normalized = normalizeRecovery(recoveryInput);
  const master = await unwrapMaster(meta.recoveryEnvelope, normalized);
  setMasterKey(master);
  await Store.hydrateFromVault();
  // Neuen PIN-Envelope erzeugen, Recovery-Envelope behalten
  const pinEnvelope = await wrapMaster(_masterKey, newPin);
  patchMeta({ pinEnvelope, pinAttempts:0, pinLockedUntil:0 });
  sessionStorage.setItem('manu.unlocked','1');
  try{ runAutoBookings(); }catch{}
}

async function removeVaultProtection(){
  // PIN-Schutz entfernen: State entschlüsseln und Klartext schreiben,
  // Belege entschlüsseln, Meta löschen.
  if(isEncrypted() && !hasMasterKey()) throw new Error('Erst entsperren');
  // Belege entschlüsseln
  try{
    const ids = await FilesDB.listIds();
    for(const id of ids){
      const raw = await FilesDB.getRaw(id);
      if(raw && hasMasterKey() && await isEncryptedBlob(raw)){
        const plain = await decryptBlobWithMaster(raw);
        await FilesDB.putRaw(id, plain);
      }
    }
  }catch(e){ console.warn('blob unwrap failed', e); }
  // Meta zurücksetzen
  localStorage.removeItem(META_KEY);
  localStorage.removeItem(VAULT_KEY);
  clearMasterKey();
  // State im Klartext speichern
  localStorage.setItem(STORE_KEY, JSON.stringify(Store.get()));
}

// -------- Recurring & Auto-Booking ----------
function runAutoBookings(){
  const st = Store.get();
  const today = todayIso();
  const fresh = [];
  for(const tpl of st.templates){
    if(!tpl.recurrence || tpl.recurrence === 'none' || !tpl.autoBook) continue;
    const last = st.bookings.filter(b => b.templateId === tpl.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
    if(!last) continue;
    const next = nextDue(last.date, tpl.recurrence);
    if(next && next <= today){
      fresh.push({
        ...newBookingDraft(),
        id: uid('bkg'),
        date: next,
        type: tpl.type,
        amount: tpl.amount,
        propertyId: tpl.propertyId,
        categoryId: tpl.categoryId,
        counterparty: tpl.counterparty,
        note: tpl.note,
        recurrence: tpl.recurrence,
        templateId: tpl.id,
        autoBook: true,
        createdAt: new Date().toISOString(),
      });
    }
  }
  if(fresh.length) Store.update(s => ({...s, bookings: [...s.bookings, ...fresh]}));
  return fresh.length;
}
function nextDue(lastDate, recurrence){
  const [y,m,d] = lastDate.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  if(recurrence === 'monthly') dt.setMonth(dt.getMonth()+1);
  else if(recurrence === 'yearly') dt.setFullYear(dt.getFullYear()+1);
  else return null;
  return dt.toISOString().slice(0,10);
}
function newBookingDraft(){
  return {
    id:'', type:'expense', amount:0, date: todayIso(),
    propertyId: null, categoryId: null, counterparty:'', note:'',
    recurrence:'none', tagIds:[], receiptId:null, createdAt:'',
  };
}

// -------- Helpers ----------
function categoryById(id){ return Store.get().categories.find(c => c.id === id) || null; }
function propertyById(id){ return Store.get().properties.find(p => p.id === id) || null; }
function isTaxRelevant(b){
  const c = categoryById(b.categoryId);
  return !!(c && c.taxRelevant);
}
function monthLabel(m){
  const [y,mn] = m.split('-').map(Number);
  return ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'][mn-1] + ' ' + y;
}

// -------- Calculator-Parser ----------
function evalExpression(input){
  if(!input) return null;
  const norm = String(input).replace(/\s/g,'').replace(/,/g,'.');
  if(!/^-?\d/.test(norm)) return null;
  if(!/[+\-*/]/.test(norm)) {
    const n = Number(norm);
    return Number.isFinite(n) ? n : null;
  }
  const tokens = norm.split(/([+\-*/])/).map(s=>s.trim()).filter(Boolean);
  if(!tokens.length) return null;
  let acc = Number(tokens[0]);
  if(!Number.isFinite(acc)) return null;
  for(let i=1;i<tokens.length;i+=2){
    const op = tokens[i], next = Number(tokens[i+1]);
    if(!Number.isFinite(next)) return null;
    if(op === '+') acc += next;
    else if(op === '-') acc -= next;
    else if(op === '*') acc *= next;
    else if(op === '/'){ if(next === 0) return null; acc /= next; }
  }
  return Math.round(acc * 100) / 100;
}

// ============================================================
// ROUTING + VIEWS
// ============================================================
const TABS = [
  {id:'dashboard',  label:'Hauptsaal',    icon:'dashboard'},
  {id:'bookings',   label:'Buchungen',    icon:'receipt'},
  {id:'oak',        label:'Eiche',        icon:'tree'},
  {id:'receipts',   label:'Belege',       icon:'file-text'},
  {id:'advisor',    label:'Steuer',       icon:'landmark'},
  {id:'tools',      label:'Werkzeuge',    icon:'wrench'},
  {id:'settings',   label:'Einstellungen',icon:'settings'},
];

function tabBadgeCount(tabId, st){
  if(tabId === 'receipts') return (st.receipts || []).filter(r => !r.bookingId).length;
  if(tabId === 'tools'){
    const now = Date.now();
    const threshold = 30 * 24 * 3600 * 1000;
    return (st.contracts || []).filter(c => {
      if(!c.endsAt) return false;
      const t = new Date(c.endsAt + 'T12:00:00').getTime();
      return t - now < threshold && t - now > -threshold;
    }).length;
  }
  return 0;
}
function renderTabs(active){
  const st = Store.get();
  const html = TABS.map(t => {
    const badge = tabBadgeCount(t.id, st);
    const badgeHtml = badge > 0 ? `<span class="tab-badge">${badge}</span>` : '';
    return `<button data-tab="${t.id}" class="${active===t.id?'active':''}"><span class="tab-content">${icon(t.icon,'md')}<span>${t.label}</span></span>${badgeHtml}</button>`;
  }).join('');
  $('#tabs').innerHTML = html;
  $('#tabs').querySelectorAll('button').forEach(b => {
    b.onclick = () => setTab(b.dataset.tab);
  });
}
function setTab(id){
  Store.update(s => ({...s, settings:{...s.settings, activeTab:id}}));
  location.hash = '#/'+id;
  tap(8);
  render();
}

function render(){
  const st = Store.get();
  // Tresor noch verschlüsselt? Lock-Screen zeigen.
  if(isEncrypted() && !hasMasterKey()){ renderLockScreen(); return; }
  // Legacy: PIN-Hash in settings vorhanden, aber noch kein Envelope angelegt.
  const legacyLocked = !!st.settings.pinHash && !isEncrypted() && !sessionStorage.getItem('manu.unlocked');
  if(legacyLocked){ renderLockScreen(); return; }
  // Onboarding-Wizard: bei frischer Installation oder mitten im Wizard
  const hasAnyData = st.properties.length + st.bookings.length + st.receipts.length + st.tenants.length > 0;
  if(!st.settings.onboardingDone && !hasAnyData){
    renderOnboarding();
    return;
  }
  const tab = st.settings.activeTab || 'dashboard';
  renderTabs(tab);
  const view = $('#view');
  const renderer = VIEWS[tab] || VIEWS.dashboard;
  view.innerHTML = renderer(st);
  // Bind nach jedem Render
  if(BINDERS[tab]) BINDERS[tab](view, st);
  bindCommonActions(view);
  // Micro-Interactions: Count-Up
  applyCountUpToView(view);
  // Berater-Modus syncen
  $('#advisorToggle').checked = !!st.settings.advisorMode;
  document.body.classList.toggle('advisor', !!st.settings.advisorMode);
  // Theme: light = :root default (kein Attribut), dark / auto explizit
  const scheme = st.settings.colorScheme || 'light';
  if(scheme === 'dark' || scheme === 'auto'){
    document.documentElement.setAttribute('data-theme', scheme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  // Font-Scale
  const scale = st.settings.fontScale === 'large' ? 1.15 : st.settings.fontScale === 'xlarge' ? 1.3 : 1;
  document.documentElement.style.setProperty('--scale', String(scale));
}

function bindCommonActions(root){
  root.querySelectorAll('[data-action="new-booking"]').forEach(b => b.onclick = () => openBookingModal());
  root.querySelectorAll('[data-action="new-property"]').forEach(b => b.onclick = () => openPropertyModal());
}

// ============================================================
// VIEWS
// ============================================================
const VIEWS = {};
const BINDERS = {};

// ---- Dashboard / Hauptsaal -----
VIEWS.dashboard = (st) => {
  const mb = st.bookings.filter(b => b.date.startsWith(st.currentMonth));
  const income = mb.filter(b => b.type==='income').reduce((s,b)=>s+b.amount,0);
  const expense = mb.filter(b => b.type==='expense').reduce((s,b)=>s+b.amount,0);
  const saldo = income - expense;
  const taxYearAmount = st.bookings.filter(b => b.date.startsWith(String(new Date().getFullYear())) && isTaxRelevant(b)).reduce((s,b)=>s+b.amount,0);

  // Property cards
  const propsHtml = st.properties.length ? st.properties.map(p => {
    const pb = mb.filter(b => b.propertyId === p.id);
    const pi = pb.filter(b => b.type==='income').reduce((s,b)=>s+b.amount,0);
    const pe = pb.filter(b => b.type==='expense').reduce((s,b)=>s+b.amount,0);
    return `<div class="oak ${pi+pe>0&&hasTax(pb)?'taxed':''}" data-property-id="${p.id}">
      <div class="oak-head">
        <span class="oak-name">${escapeHtml(p.name)}</span>
        <span class="pill emerald">${fmtEur(pi-pe)}</span>
      </div>
      ${p.address ? `<div class="muted">${escapeHtml(p.address)}</div>` : ''}
      <div class="oak-meta">
        <span>+${fmtEur(pi)}</span>
        <span>−${fmtEur(pe)}</span>
        <span>${pb.length} Buchung(en)</span>
      </div>
    </div>`;
  }).join('') : `<div class="empty">
    <span class="icon">${icon('tree','lg')}</span>
    <h3>Noch keine Imperien</h3>
    <p>Lege Dein erstes Objekt an (Haus, Wohnung oder einfach „Privat-Beet").</p>
    <button class="primary" data-action="new-property">+ Erstes Objekt</button>
  </div>`;

  // Bar Chart letzte 6 Monate
  const months = [];
  const now = new Date();
  for(let i=5;i>=0;i--){ const d = new Date(now.getFullYear(), now.getMonth()-i, 1); months.push(monthKey(d)); }
  const maxBar = Math.max(1, ...months.flatMap(m => {
    const mm = st.bookings.filter(b=>b.date.startsWith(m));
    return [mm.filter(b=>b.type==='income').reduce((s,b)=>s+b.amount,0), mm.filter(b=>b.type==='expense').reduce((s,b)=>s+b.amount,0)];
  }));
  const barsHtml = `<div class="bar-chart">${months.map(m => {
    const mm = st.bookings.filter(b=>b.date.startsWith(m));
    const ii = mm.filter(b=>b.type==='income').reduce((s,b)=>s+b.amount,0);
    const ee = mm.filter(b=>b.type==='expense').reduce((s,b)=>s+b.amount,0);
    return `<div class="bar-col"><div class="bar-pair">
      <div class="bar income" style="height:${(ii/maxBar)*100}%" title="+${fmtEur(ii)}"></div>
      <div class="bar expense" style="height:${(ee/maxBar)*100}%" title="−${fmtEur(ee)}"></div>
    </div><div class="bar-label">${m.slice(5)}</div></div>`;
  }).join('')}</div>`;

  return `
    <h1 class="serif mb-xs">Hauptsaal</h1>
    <div class="muted mb-3">${monthLabel(st.currentMonth)}</div>

    <div class="grid cols-3 hide-on-advisor">
      <div class="card"><div class="muted">Einnahmen</div><div class="amount lg income" data-count-up="${income}">${fmtEur(income)}</div></div>
      <div class="card"><div class="muted">Ausgaben</div><div class="amount lg expense" data-count-up="${expense}">${fmtEur(expense)}</div></div>
      <div class="card" style="border-color:var(--gold-ring);background:linear-gradient(160deg,var(--surface),rgba(212,175,55,.08))">
        <div class="muted">Saldo</div>
        <div class="amount lg" style="color:${saldo>=0?'var(--accent)':'var(--berry)'}" data-count-up="${saldo}">${fmtEur(saldo)}</div>
      </div>
    </div>

    <div class="grid cols-2 hide-on-advisor mt-md">
      <div class="card">
        ${cardTitle('bar-chart', 'Letzte 6 Monate')}
        ${barsHtml}
      </div>
      <div class="card" style="border-color:var(--gold-ring)">
        <div class="card-title"><h2 class="gold-text">★ Steuerrelevant ${new Date().getFullYear()}</h2></div>
        <div class="amount lg gold-text" data-count-up="${taxYearAmount}">${fmtEur(taxYearAmount)}</div>
        <p class="muted mt-sm">Summe aller Buchungen in steuerrelevanten Kategorien für ${new Date().getFullYear()}.</p>
        <button class="gold mt-2" data-action="open-advisor">Berater-Modus öffnen →</button>
      </div>
    </div>

    <div class="card mt-md">
      <div class="card-title">
        <h2>Immobilien-Eiche</h2>
        <div class="actions"><button data-action="new-property">+ Objekt</button></div>
      </div>
      ${propsHtml}
    </div>

    <div class="card mt-md">
      ${cardTitle('zap', 'Schnellaktionen')}
      <div class="row">
        <button class="primary" data-action="new-booking">+ Neue Buchung</button>
        <button data-action="goto-receipts">${icon('file-text','sm')}<span>Beleg hochladen</span></button>
        <button data-action="goto-bookings">🎰 Alle Buchungen</button>
        <button data-action="goto-tools">${icon('wrench','sm')}<span>Werkzeuge</span></button>
        <button class="gold" data-action="open-advisor">${icon('star','sm')}<span>Berater-Modus</span></button>
      </div>
    </div>
  `;
};
BINDERS.dashboard = (root, st) => {
  root.querySelectorAll('[data-property-id]').forEach(el => el.onclick = () => {
    Store.update(s => ({...s, _filterPropertyId: el.dataset.propertyId, settings:{...s.settings,activeTab:'oak'}}));
    location.hash = '#/oak';
    render();
  });
  root.querySelectorAll('[data-action="open-advisor"]').forEach(b => b.onclick = () => {
    Store.update(s => ({...s, settings:{...s.settings, advisorMode:true, activeTab:'advisor'}}));
    render();
  });
  root.querySelectorAll('[data-action="goto-bookings"]').forEach(b => b.onclick = () => setTab('bookings'));
  root.querySelectorAll('[data-action="goto-receipts"]').forEach(b => b.onclick = () => setTab('receipts'));
  root.querySelectorAll('[data-action="goto-tools"]').forEach(b => b.onclick = () => setTab('tools'));
};
function hasTax(bookings){ return bookings.some(b => isTaxRelevant(b)); }

// ---- Buchungen -----
let _bookingsFilter = { typ:'all', propId:'all', q:'', month:'', taxOnly:false, sortKey:'date', sortDir:'desc' };
let _bulkMode = false;
let _selected = new Set();

VIEWS.bookings = (st) => {
  if(!_bookingsFilter.month) _bookingsFilter.month = st.currentMonth;
  const months = uniq(st.bookings.map(b => b.date.slice(0,7))).sort().reverse();
  if(!months.includes(_bookingsFilter.month)) months.unshift(_bookingsFilter.month);

  const propOpts = st.properties.map(p => `<option value="${p.id}" ${_bookingsFilter.propId===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('');
  const monthOpts = months.map(m => `<option value="${m}" ${_bookingsFilter.month===m?'selected':''}>${monthLabel(m)}</option>`).join('');

  let list = st.bookings.slice();
  if(_bookingsFilter.month && _bookingsFilter.month !== 'all') list = list.filter(b => b.date.startsWith(_bookingsFilter.month));
  if(_bookingsFilter.typ !== 'all') list = list.filter(b => b.type === _bookingsFilter.typ);
  if(_bookingsFilter.propId !== 'all') list = list.filter(b => b.propertyId === _bookingsFilter.propId);
  if(_bookingsFilter.taxOnly) list = list.filter(isTaxRelevant);
  if(_bookingsFilter.q){
    const q = _bookingsFilter.q.toLowerCase();
    list = list.filter(b => (b.counterparty||'').toLowerCase().includes(q) || (b.note||'').toLowerCase().includes(q));
  }
  // Sortierung via _bookingsFilter.sortKey + sortDir
  const sk = _bookingsFilter.sortKey, sd = _bookingsFilter.sortDir;
  const cmp = (a, b) => {
    let av, bv;
    if(sk === 'date'){ av = a.date; bv = b.date; }
    else if(sk === 'amount'){ av = a.amount; bv = b.amount; }
    else if(sk === 'counterparty'){ av = (a.counterparty||'').toLowerCase(); bv = (b.counterparty||'').toLowerCase(); }
    else if(sk === 'category'){
      av = (categoryById(a.categoryId)?.label||'').toLowerCase();
      bv = (categoryById(b.categoryId)?.label||'').toLowerCase();
    } else { av = a.date; bv = b.date; }
    if(av < bv) return sd === 'asc' ? -1 : 1;
    if(av > bv) return sd === 'asc' ? 1 : -1;
    return 0;
  };
  list.sort(cmp);

  const sumIn = list.filter(b=>b.type==='income').reduce((s,b)=>s+b.amount,0);
  const sumOut = list.filter(b=>b.type==='expense').reduce((s,b)=>s+b.amount,0);

  // Group-by-Day nur wenn nach Datum desc sortiert
  const groupByDay = sk === 'date' && sd === 'desc';

  let rows = '';
  if(!list.length){
    rows = `<tr><td colspan="6"><div class="empty"><span class="icon">${icon('receipt','lg')}</span><h3>Keine Buchungen</h3><p>Klick auf „+ Neue Buchung" zum Anlegen.</p></div></td></tr>`;
  } else {
    let lastDate = '';
    for(const b of list){
      if(groupByDay && b.date !== lastDate){
        // Tages-Header: Datum + Tages-Saldo
        const dayItems = list.filter(x => x.date === b.date);
        const daySum = dayItems.reduce((s,x) => s + (x.type==='income' ? x.amount : -x.amount), 0);
        const daySign = daySum >= 0 ? '+' : '−';
        const dayCls = daySum >= 0 ? 'income' : 'expense';
        rows += `<tr class="day-header"><td colspan="5"><span class="serif">${fmtDate(b.date)}</span> <span class="muted">· ${dayItems.length} ${dayItems.length===1?'Buchung':'Buchungen'}</span></td><td class="right amount ${dayCls}">${daySign} ${fmtEur(Math.abs(daySum))}</td></tr>`;
        lastDate = b.date;
      }
      const cat = categoryById(b.categoryId);
      const prop = propertyById(b.propertyId);
      const tax = isTaxRelevant(b);
      const sign = b.type==='income' ? '+' : '−';
      const cls = b.type==='income' ? 'income' : 'expense';
      const cb = _bulkMode ? `<input type="checkbox" data-bulk="${b.id}" ${_selected.has(b.id)?'checked':''} />` : '';
      rows += `<tr class="${tax?'gold-row':''}" data-edit="${b.id}">
        <td>${cb} <span class="serif">${fmtDate(b.date)}</span></td>
        <td>${escapeHtml(b.counterparty || '—')}${b.note?`<div class="muted">${escapeHtml(b.note)}</div>`:''}</td>
        <td>${cat ? `<span class="pill ${cat.group||'neutral'}">${escapeHtml(cat.label)}</span>${tax?'<span class="tax-dot" title="steuerrelevant"></span>':''}` : '—'}</td>
        <td>${prop ? escapeHtml(prop.name) : '<span class="muted">Privat-Beet</span>'}</td>
        <td class="right amount ${cls}">${sign} ${fmtEur(b.amount)}</td>
        <td class="right"><button class="icon" data-del="${b.id}" title="In Papierkorb">${icon('trash','sm')}</button></td>
      </tr>`;
    }
  }

  const sortIndicator = (k) => sk === k ? (sd === 'asc' ? ' ▲' : ' ▼') : '';
  const sortable = (k, label) => `<button class="th-sort" data-sort="${k}">${label}${sortIndicator(k)}</button>`;

  const chip = (val, label, key='typ', current=_bookingsFilter.typ) =>
    `<button class="chip ${current===val?'active':''}" data-${key}="${val}">${label}</button>`;
  return `
    <h1 class="serif">Buchungen</h1>
    <div class="card mt-md">
      <div class="chip-row mb-md">
        ${chip('all','Alle')}
        ${chip('income', `${icon('trending-up','sm')}<span>Einnahmen</span>`)}
        ${chip('expense', `${icon('coins','sm')}<span>Ausgaben</span>`)}
        <span class="chip-sep"></span>
        <button class="chip ${_bookingsFilter.taxOnly?'active':''}" data-tax-toggle>${icon('star','sm')}<span>nur steuerrelevant</span></button>
      </div>
      <div class="row mb-md">
        <select id="f-month" class="mxw-200"><option value="all">Alle Monate</option>${monthOpts}</select>
        <select id="f-prop" class="mxw-200">
          <option value="all">Alle Objekte</option>
          <option value="">Privat-Beet</option>
          ${propOpts}
        </select>
        <div class="search-input flex-1 mxw-300">${icon('search','sm')}<input id="f-q" placeholder="Empfänger oder Notiz…" value="${escapeHtml(_bookingsFilter.q)}" /></div>
        <span style="flex:1"></span>
        <label class="toggle"><input type="checkbox" id="bulk-toggle" ${_bulkMode?'checked':''} /><span class="switch"></span><span>Auswahl-Modus</span></label>
        <button class="primary" data-action="new-booking">${icon('plus','sm')}<span>Neue Buchung</span></button>
      </div>
      ${_bulkMode && _selected.size > 0 ? `
        <div class="banner">
          <span>${_selected.size} ausgewählt</span>
          <div class="row" style="gap:6px">
            <button data-bulk-cat>Kategorie zuweisen</button>
            <button data-bulk-prop>Objekt zuweisen</button>
            <button class="danger" data-bulk-del>Löschen</button>
          </div>
        </div>` : ''}
      <table class="data sortable">
        <thead><tr>
          <th>${_bulkMode?`<input type="checkbox" id="bulk-all" ${list.length>0&&list.every(b=>_selected.has(b.id))?'checked':''} /> `:''}${sortable('date','Datum')}</th>
          <th>${sortable('counterparty','Empfänger / Notiz')}</th>
          <th>${sortable('category','Kategorie')}</th>
          <th>Objekt</th>
          <th class="right">${sortable('amount','Betrag')}</th>
          <th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="font-weight:700">
            <td colspan="4" style="text-align:right">Summe sichtbar:</td>
            <td class="right">
              <span class="income">+${fmtEur(sumIn)}</span>
              &nbsp;&nbsp;
              <span class="expense">−${fmtEur(sumOut)}</span>
            </td>
            <td class="right amount" style="color:${sumIn-sumOut>=0?'var(--accent)':'var(--berry)'}">${fmtEur(sumIn-sumOut)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <button class="fab" data-action="new-booking" title="Neue Buchung" aria-label="Neue Buchung">${icon('plus','lg')}</button>
  `;
};
BINDERS.bookings = (root, st) => {
  const refilter = (patch) => { _bookingsFilter = {..._bookingsFilter, ...patch}; render(); };
  root.querySelector('#f-month').onchange = e => refilter({month: e.target.value});
  root.querySelector('#f-prop').onchange = e => refilter({propId: e.target.value});
  root.querySelector('#f-q').oninput = e => { _bookingsFilter.q = e.target.value; if(e.target.value.length===0 || e.target.value.length>=2) render(); };
  root.querySelectorAll('[data-typ]').forEach(b => b.onclick = () => refilter({typ: b.dataset.typ}));
  const taxBtn = root.querySelector('[data-tax-toggle]');
  if(taxBtn) taxBtn.onclick = () => refilter({taxOnly: !_bookingsFilter.taxOnly});
  // Sortable Spaltenköpfe
  root.querySelectorAll('button[data-sort]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const key = b.dataset.sort;
    if(_bookingsFilter.sortKey === key){
      _bookingsFilter.sortDir = _bookingsFilter.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      _bookingsFilter.sortKey = key;
      _bookingsFilter.sortDir = (key === 'date' || key === 'amount') ? 'desc' : 'asc';
    }
    render();
  });
  root.querySelector('#bulk-toggle').onchange = e => { _bulkMode = e.target.checked; _selected.clear(); render(); };
  const allCb = root.querySelector('#bulk-all');
  if(allCb) allCb.onchange = e => {
    if(e.target.checked) root.querySelectorAll('[data-bulk]').forEach(c => _selected.add(c.dataset.bulk));
    else _selected.clear();
    render();
  };
  root.querySelectorAll('[data-bulk]').forEach(c => c.onchange = e => {
    if(e.target.checked) _selected.add(c.dataset.bulk); else _selected.delete(c.dataset.bulk);
    render();
  });
  root.querySelectorAll('[data-edit]').forEach(tr => {
    tr.onclick = (e) => {
      if(e.target.matches('input,button,a,svg,use')) return;
      if(_bulkMode){
        const id = tr.dataset.edit;
        if(_selected.has(id)) _selected.delete(id); else _selected.add(id);
        render();
        return;
      }
      openBookingModal(st.bookings.find(b => b.id === tr.dataset.edit));
    };
    tr.oncontextmenu = (e) => {
      e.preventDefault();
      openBookingContextMenu(e.clientX, e.clientY, tr.dataset.edit);
    };
    // Long-Press auf Mobile
    let pressTimer = null;
    tr.ontouchstart = (e) => {
      pressTimer = setTimeout(() => {
        const t = e.touches[0];
        openBookingContextMenu(t.clientX, t.clientY, tr.dataset.edit);
      }, 500);
    };
    tr.ontouchend = () => clearTimeout(pressTimer);
    tr.ontouchmove = () => clearTimeout(pressTimer);
  });
  root.querySelectorAll('[data-del]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    softDeleteBooking(b.dataset.del);
  });
  const bulkDel = root.querySelector('[data-bulk-del]');
  if(bulkDel) bulkDel.onclick = () => {
    confirmAlert(`${_selected.size} Buchungen wirklich löschen?`, () => {
      const ids = Array.from(_selected);
      const trashIds = ids.map(() => uid('trash'));
      Store.update(s => {
        const trash = ids.map((id, i) => ({
          id: trashIds[i], entityType:'booking', deletedAt: new Date().toISOString(),
          payload: s.bookings.find(b => b.id === id),
        }));
        return {...s, bookings: s.bookings.filter(b => !_selected.has(b.id)), trash:[...s.trash, ...trash]};
      });
      const count = ids.length;
      _selected.clear(); render();
      Toast.undo(`${count} Buchung${count===1?'':'en'} gelöscht`, () => {
        trashIds.forEach(t => restoreFromTrash(t));
        render();
      });
    });
  };
  const bulkCat = root.querySelector('[data-bulk-cat]');
  if(bulkCat) bulkCat.onclick = () => pickCategoryModal(catId => {
    Store.update(s => ({...s, bookings: s.bookings.map(b => _selected.has(b.id) ? {...b, categoryId: catId} : b)}));
    _selected.clear(); render();
  });
  const bulkProp = root.querySelector('[data-bulk-prop]');
  if(bulkProp) bulkProp.onclick = () => pickPropertyModal(pid => {
    Store.update(s => ({...s, bookings: s.bookings.map(b => _selected.has(b.id) ? {...b, propertyId: pid} : b)}));
    _selected.clear(); render();
  });
};

function softDeleteBooking(id){
  const st = Store.get();
  const b = st.bookings.find(x => x.id === id);
  if(!b) return;
  const trashId = uid('trash');
  Store.update(s => ({...s,
    bookings: s.bookings.filter(x => x.id !== id),
    trash:[...s.trash, {id: trashId, entityType:'booking', deletedAt: new Date().toISOString(), payload: b}],
  }));
  render();
  const label = b.counterparty ? `„${b.counterparty}"` : 'Buchung';
  Toast.undo(`${label} gelöscht`, () => { restoreFromTrash(trashId); render(); });
}

function uniq(arr){ return Array.from(new Set(arr)); }

// ---- Booking Modal -----
function openBookingModal(booking){
  const st = Store.get();
  const draft = booking ? {...booking} : {...newBookingDraft(), propertyId: st.properties[0]?.id ?? null};
  const cats = st.categories;
  const props = st.properties;
  const tags = st.tags;
  const html = `
    <div class="form">
      <div>
        <label>Typ</label>
        <div class="row">
          <label class="toggle"><input type="radio" name="type" value="income" ${draft.type==='income'?'checked':''} /><span class="pill emerald" style="cursor:pointer">+ Einnahme</span></label>
          <label class="toggle"><input type="radio" name="type" value="expense" ${draft.type==='expense'?'checked':''} /><span class="pill berry" style="cursor:pointer">− Ausgabe</span></label>
        </div>
      </div>
      <div class="grid cols-2">
        <div>
          <label>Betrag (€) — Rechnung erlaubt: <span class="muted">z.B. 100+50/2</span></label>
          <input id="m-amount" placeholder="0,00" value="${draft.amount?fmtNum(draft.amount).replace(/\./g,''):''}" inputmode="decimal" />
          <div class="muted" id="m-amount-preview"></div>
        </div>
        <div>
          <label>Datum</label>
          <input id="m-date" type="date" value="${draft.date}" />
        </div>
      </div>
      <div class="grid cols-2">
        <div>
          <label>Kategorie</label>
          <select id="m-cat">
            <option value="">— keine —</option>
            ${cats.map(c => `<option value="${c.id}" ${draft.categoryId===c.id?'selected':''}>${c.taxRelevant?'★ ':''}${escapeHtml(c.label)}</option>`).join('')}
          </select>
          <div class="muted" id="m-cat-tax"></div>
        </div>
        <div>
          <label>Objekt (Ast)</label>
          <select id="m-prop">
            <option value="">Privat-Beet</option>
            ${props.map(p => `<option value="${p.id}" ${draft.propertyId===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label>Empfänger / Absender</label>
        <input id="m-cp" value="${escapeHtml(draft.counterparty||'')}" placeholder="z.B. Stadtwerke, Müller, Amazon" />
        <div id="m-cp-sug"></div>
      </div>
      <div>
        <label>Notiz</label>
        <textarea id="m-note" rows="2">${escapeHtml(draft.note||'')}</textarea>
      </div>
      <div class="grid cols-2">
        <div>
          <label>Wiederholung</label>
          <select id="m-rec">
            <option value="none" ${draft.recurrence==='none'?'selected':''}>Einmalig</option>
            <option value="monthly" ${draft.recurrence==='monthly'?'selected':''}>Monatlich</option>
            <option value="yearly" ${draft.recurrence==='yearly'?'selected':''}>Jährlich</option>
          </select>
        </div>
        <div>
          <label>Tags</label>
          <select id="m-tags" multiple style="height:80px">
            ${tags.map(t => `<option value="${t.id}" ${(draft.tagIds||[]).includes(t.id)?'selected':''}>#${escapeHtml(t.label)}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="modal-actions">
      ${booking ? `<button class="danger" data-rm>🗑 Löschen</button>` : ''}
      <button data-cancel>Abbrechen</button>
      <button class="primary" data-save>${booking?'Speichern':'Buchen'}</button>
    </div>
  `;
  openModal(booking?'Buchung bearbeiten':'Neue Buchung', html, (body, close) => {
    const $a = body.querySelector('#m-amount');
    const $aP = body.querySelector('#m-amount-preview');
    const updatePreview = () => {
      const v = evalExpression($a.value);
      $aP.textContent = v !== null && /[+\-*/]/.test($a.value) ? `= ${fmtEur(v)}` : '';
    };
    $a.oninput = updatePreview;
    updatePreview();
    const $cp = body.querySelector('#m-cp');
    const $cpS = body.querySelector('#m-cp-sug');
    const $cat = body.querySelector('#m-cat');
    const $catSug = body.querySelector('#m-cat-tax');
    const refreshCpSuggest = () => {
      const q = $cp.value.trim().toLowerCase();
      if(q.length < 2){ $cpS.innerHTML = ''; return; }
      const matches = uniq(Store.get().bookings.map(b => b.counterparty).filter(Boolean).filter(c => c.toLowerCase().includes(q))).slice(0,5);
      $cpS.innerHTML = matches.map(m => `<span class="pill" style="cursor:pointer;margin:6px 4px 0 0" data-pick="${escapeHtml(m)}">${escapeHtml(m)}</span>`).join('');
      $cpS.querySelectorAll('[data-pick]').forEach(p => p.onclick = () => { $cp.value = p.dataset.pick; $cpS.innerHTML=''; refreshCatSuggest(); });
    };
    const refreshCatSuggest = () => {
      const s = suggestCategoryFor($cp.value, Store.get());
      const c = categoryById($cat.value);
      const tax = c?.taxRelevant ? `<div class="gold-text mt-xs">${icon('star','sm')} Diese Buchung erscheint im Berater-Modus</div>` : '';
      const sug = (s && s.id !== $cat.value) ? `<div class="cat-suggest" data-apply-cat>${icon('zap','sm')}<span>Vorschlag: <strong>${escapeHtml(s.label)}</strong> (${s.count}× verwendet)</span></div>` : '';
      $catSug.innerHTML = sug + tax;
      const apply = $catSug.querySelector('[data-apply-cat]');
      if(apply && s) apply.onclick = () => { $cat.value = s.id; refreshCatSuggest(); };
    };
    $cp.oninput = () => { refreshCpSuggest(); refreshCatSuggest(); };
    $cat.onchange = refreshCatSuggest;
    refreshCatSuggest();
    body.querySelector('[data-cancel]').onclick = close;
    if(booking){
      body.querySelector('[data-rm]').onclick = () => { confirmAlert('Buchung in Papierkorb verschieben?', () => { softDeleteBooking(booking.id); close(); }); };
    }
    body.querySelector('[data-save]').onclick = () => {
      const amount = evalExpression($a.value);
      if(amount === null || amount <= 0){ Toast.info('Bitte Betrag eingeben'); return; }
      const type = body.querySelector('input[name="type"]:checked').value;
      const date = body.querySelector('#m-date').value;
      const categoryId = $cat.value || null;
      const propertyId = body.querySelector('#m-prop').value || null;
      const counterparty = $cp.value.trim();
      const note = body.querySelector('#m-note').value.trim();
      const recurrence = body.querySelector('#m-rec').value;
      const tagIds = Array.from(body.querySelector('#m-tags').selectedOptions).map(o => o.value);
      const data = {type, amount, date, categoryId, propertyId, counterparty, note, recurrence, tagIds};
      const persist = () => {
        if(booking){
          Store.update(s => ({...s, bookings: s.bookings.map(b => b.id===booking.id ? {...b, ...data} : b)}));
        } else {
          Store.update(s => ({...s, bookings: [...s.bookings, {...newBookingDraft(), ...data, id: uid('bkg'), createdAt: new Date().toISOString()}]}));
        }
        close();
      };
      // Duplikat-Check nur bei NEUEN Buchungen
      const dup = booking ? null : findDuplicate(data, Store.get());
      if(dup){
        close();
        const cat = categoryById(dup.categoryId);
        openModal('Möglicher Duplikat-Fund', `
          <p class="mb-md">Wir haben eine ähnliche Buchung gefunden:</p>
          <div class="card mb-md">
            <div class="row" style="justify-content:space-between">
              <strong>${escapeHtml(dup.counterparty || '(ohne Empfänger)')}</strong>
              <span class="amount ${dup.type==='income'?'income':'expense'}">${dup.type==='income'?'+':'−'} ${fmtEur(dup.amount)}</span>
            </div>
            <div class="muted">${fmtDate(dup.date)} · ${cat?escapeHtml(cat.label):'—'}</div>
          </div>
          <p class="mb-md muted">Trotzdem als neue Buchung speichern, oder vorhandene Buchung verwenden?</p>
          <div class="modal-actions">
            <button data-cancel-dup>Abbrechen</button>
            <button class="primary" data-save-dup>Trotzdem speichern</button>
          </div>
        `, (b, c) => {
          b.querySelector('[data-cancel-dup]').onclick = c;
          b.querySelector('[data-save-dup]').onclick = () => { c(); persist(); };
        });
        return;
      }
      persist();
    };
  });
}

function pickCategoryModal(onPick){
  const cats = Store.get().categories;
  const html = `<div class="row">${cats.map(c => `<button data-cat="${c.id}" class="pill ${c.group||'neutral'}" style="cursor:pointer">${c.taxRelevant?'★ ':''}${escapeHtml(c.label)}</button>`).join('')}</div>`;
  openModal('Kategorie auswählen', html, (body, close) => {
    body.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { onPick(b.dataset.cat); close(); });
  });
}
function pickPropertyModal(onPick){
  const props = Store.get().properties;
  const html = `<div class="row">
    <button data-prop="" class="pill" style="cursor:pointer">Privat-Beet</button>
    ${props.map(p => `<button data-prop="${p.id}" class="pill emerald" style="cursor:pointer">${escapeHtml(p.name)}</button>`).join('')}
  </div>`;
  openModal('Objekt auswählen', html, (body, close) => {
    body.querySelectorAll('[data-prop]').forEach(b => b.onclick = () => { onPick(b.dataset.prop || null); close(); });
  });
}

// ---- Property Modal -----
function openPropertyModal(property){
  const colors = ['#1FAB89','#4A7C59','#8FA88B','#D4AF37','#A88A4A','#9B5A4B','#4F73A8','#7A4F8B'];
  const draft = property || {id:'', name:'', address:'', color: colors[0], totalLivingArea:null, afa:{}};
  const html = `
    <div class="form">
      <div>
        <label>Name *</label>
        <input id="p-name" value="${escapeHtml(draft.name||'')}" placeholder="z.B. Südstraße 12" />
      </div>
      <div>
        <label>Adresse</label>
        <input id="p-addr" value="${escapeHtml(draft.address||'')}" placeholder="Straße, PLZ, Ort" />
      </div>
      <div class="grid cols-2">
        <div>
          <label>Wohnfläche gesamt (m²) ${helpHint('Verteilungsschlüssel für Nebenkosten- und Mieter-Splits. Bei Mehrfamilienhäusern die Summe aller vermieteten Einheiten.')}</label>
          <input id="p-area" type="number" value="${draft.totalLivingArea||''}" />
        </div>
        <div>
          <label>Farbe (Ast)</label>
          <div class="row" id="color-grid">
            ${colors.map(c => `<button type="button" data-color="${c}" style="width:32px;height:32px;border-radius:50%;border:${draft.color===c?'3px solid var(--text)':'1px solid var(--border)'};background:${c}"></button>`).join('')}
          </div>
        </div>
      </div>
      <div class="grid cols-2">
        <div>
          <label>AfA-Anschaffungswert (€) ${helpHint('Gebäudewert ohne Grundstücksanteil. Anschaffungs- oder Herstellungskosten, von denen jedes Jahr ein Prozentsatz als Abschreibung abgezogen wird.')}</label>
          <input id="p-afa-val" type="number" value="${draft.afa?.acquisitionValue||''}" placeholder="Gebäudewert" />
        </div>
        <div>
          <label>AfA-Satz (%) ${helpHint('Standard 2 % linear (Gebäude nach 1925). Bei Denkmalschutz oder Sonder-AfA andere Sätze. Im Zweifel Steuerberater fragen.')}</label>
          <input id="p-afa-rate" type="number" step="0.1" value="${draft.afa?.ratePercent||'2'}" />
        </div>
      </div>
    </div>
    <div class="modal-actions">
      ${property ? `<button class="danger" data-rm>🗑 Löschen</button>` : ''}
      <button data-cancel>Abbrechen</button>
      <button class="primary" data-save>Speichern</button>
    </div>
  `;
  openModal(property?'Objekt bearbeiten':'Neues Objekt', html, (body, close) => {
    let pickedColor = draft.color;
    body.querySelectorAll('[data-color]').forEach(b => b.onclick = () => {
      pickedColor = b.dataset.color;
      body.querySelectorAll('[data-color]').forEach(x => x.style.border = '1px solid var(--border)');
      b.style.border = '3px solid var(--text)';
    });
    body.querySelector('[data-cancel]').onclick = close;
    if(property){
      body.querySelector('[data-rm]').onclick = () => confirmAlert('Objekt + zugehörige Daten in Papierkorb?', () => {
        const trashId = uid('trash');
        Store.update(s => {
          const trash = [{id:trashId, entityType:'property', deletedAt: new Date().toISOString(), payload: property}];
          return {...s,
            properties: s.properties.filter(p => p.id !== property.id),
            bookings: s.bookings.map(b => b.propertyId === property.id ? {...b, propertyId: null} : b),
            tenants: s.tenants.filter(t => t.propertyId !== property.id),
            trash: [...s.trash, ...trash],
          };
        });
        close();
        Toast.undo(`„${property.name}" gelöscht`, () => { restoreFromTrash(trashId); render(); });
      });
    }
    body.querySelector('[data-save]').onclick = () => {
      const name = body.querySelector('#p-name').value.trim();
      if(!name){ Toast.info('Name fehlt'); return; }
      const data = {
        name,
        address: body.querySelector('#p-addr').value.trim(),
        totalLivingArea: Number(body.querySelector('#p-area').value) || null,
        color: pickedColor,
        afa: {
          acquisitionValue: Number(body.querySelector('#p-afa-val').value) || null,
          ratePercent: Number(body.querySelector('#p-afa-rate').value) || null,
        },
      };
      if(property){
        Store.update(s => ({...s, properties: s.properties.map(p => p.id===property.id?{...p, ...data}:p)}));
      } else {
        Store.update(s => ({...s, properties: [...s.properties, {...data, id: uid('obj'), createdAt: new Date().toISOString()}]}));
      }
      close();
    };
  });
}

// ---- Eiche (Objekt-Ansicht) -----
VIEWS.oak = (st) => {
  const filterPropId = st._filterPropertyId;
  if(filterPropId && st.properties.find(p=>p.id===filterPropId)){
    const p = st.properties.find(pp => pp.id === filterPropId);
    const bks = st.bookings.filter(b => b.propertyId === p.id);
    const tenants = st.tenants.filter(t => t.propertyId === p.id);
    const maint = st.maintenanceLogs.filter(m => m.propertyId === p.id);
    const meter = st.meterReadings.filter(m => m.propertyId === p.id);
    const docs = st.documents.filter(d => d.propertyId === p.id);

    const m1Iso = monthKey(), now = new Date();
    const m3 = [m1Iso, monthKey(new Date(now.getFullYear(), now.getMonth()-1, 1)), monthKey(new Date(now.getFullYear(), now.getMonth()-2, 1))];
    const y1 = []; for(let i=0;i<12;i++) y1.push(monthKey(new Date(now.getFullYear(), now.getMonth()-i, 1)));
    const inc = ms => bks.filter(b => b.type==='income' && ms.some(m => b.date.startsWith(m))).reduce((s,b)=>s+b.amount,0);
    const exp = ms => bks.filter(b => b.type==='expense' && ms.some(m => b.date.startsWith(m))).reduce((s,b)=>s+b.amount,0);

    const recentBks = bks.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(b => {
      const tax = isTaxRelevant(b);
      const cat = categoryById(b.categoryId);
      return `<tr class="${tax?'gold-row':''}" data-edit="${b.id}">
        <td>${fmtDate(b.date)}</td>
        <td>${escapeHtml(b.counterparty||'—')}</td>
        <td>${cat?escapeHtml(cat.label):'—'}${tax?'<span class="tax-dot"></span>':''}</td>
        <td class="right amount ${b.type==='income'?'income':'expense'}">${b.type==='income'?'+':'−'} ${fmtEur(b.amount)}</td>
      </tr>`;
    }).join('');

    return `
      <button class="ghost" onclick="(function(){const s=Manu.Store.get();Manu.Store.update(x=>({...x,_filterPropertyId:null}));Manu.render();})()">← zurück zur Eiche</button>
      <h1 class="serif mt-md">${escapeHtml(p.name)}</h1>
      <div class="muted">${escapeHtml(p.address||'')}</div>

      <div class="grid cols-3 mt-md">
        <div class="card"><div class="muted">1 Monat</div><div class="amount md income">+${fmtEur(inc([m1Iso]))}</div><div class="amount md expense">−${fmtEur(exp([m1Iso]))}</div></div>
        <div class="card"><div class="muted">3 Monate</div><div class="amount md income">+${fmtEur(inc(m3))}</div><div class="amount md expense">−${fmtEur(exp(m3))}</div></div>
        <div class="card"><div class="muted">12 Monate</div><div class="amount md income">+${fmtEur(inc(y1))}</div><div class="amount md expense">−${fmtEur(exp(y1))}</div></div>
      </div>

      <div class="grid cols-2 mt-md">
        <div class="card">
          <div class="card-title"><h2>Mieter</h2><div class="actions"><button data-new-tenant>+ Mieter</button></div></div>
          ${tenants.length ? tenants.map(t => `
            <div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
              <div>
                <div class="serif">${escapeHtml(t.name)}</div>
                <div class="muted">${t.unit?escapeHtml(t.unit):''} ${t.rentCold?` · Kalt: ${fmtEur(t.rentCold)}`:''}</div>
              </div>
              <button class="icon" data-edit-tenant="${t.id}">✏️</button>
            </div>
          `).join('') : '<div class="muted">Keine Mieter</div>'}
        </div>
        <div class="card">
          <div class="card-title"><h2>Wartungs-Historie</h2><div class="actions"><button data-new-maint>+ Eintrag</button></div></div>
          ${maint.length ? maint.slice(0,5).map(m => `
            <div style="padding:6px 0;border-bottom:1px solid var(--border)">
              <div class="serif">${escapeHtml(m.description)}</div>
              <div class="muted">${fmtDate(m.date)} ${m.cost?` · ${fmtEur(m.cost)}`:''}</div>
            </div>
          `).join('') : '<div class="muted">Noch keine Wartungen</div>'}
        </div>
      </div>

      <div class="card mt-md">
        ${cardTitle('history', 'Letzte Buchungen')}
        <table class="data">
          <thead><tr><th>Datum</th><th>Empfänger</th><th>Kategorie</th><th class="right">Betrag</th></tr></thead>
          <tbody>${recentBks || '<tr><td colspan="4"><div class="muted">Noch keine Buchungen</div></td></tr>'}</tbody>
        </table>
      </div>

      <div class="row" style="margin-top:14px;gap:8px">
        <button data-edit-property>✏️ Objekt bearbeiten</button>
        <button class="gold" data-anlage-v>★ Anlage V für ${new Date().getFullYear()-1}</button>
        <button data-nk>NK-Abrechnung</button>
      </div>
    `;
  }

  // Eichen-Übersicht
  const cards = st.properties.length ? st.properties.map(p => {
    const bk = st.bookings.filter(b => b.propertyId === p.id);
    const inc = bk.filter(b => b.type==='income').reduce((s,b)=>s+b.amount,0);
    const exp = bk.filter(b => b.type==='expense').reduce((s,b)=>s+b.amount,0);
    const tenantCount = st.tenants.filter(t => t.propertyId === p.id).length;
    return `<div class="oak ${hasTax(bk)?'taxed':''}" style="border-left-color:${p.color||'var(--moss)'}" data-prop="${p.id}">
      <div class="oak-head">
        <span class="oak-name">${escapeHtml(p.name)}</span>
        <div class="row" style="gap:8px"><span class="pill ${inc>=exp?'emerald':'berry'}">${fmtEur(inc-exp)}</span><button class="icon" data-edit-prop="${p.id}">✏️</button></div>
      </div>
      <div class="muted">${escapeHtml(p.address||'')}</div>
      <div class="oak-meta"><span>${tenantCount} Mieter</span><span>+${fmtEur(inc)}</span><span>−${fmtEur(exp)}</span></div>
    </div>`;
  }).join('') : `<div class="empty"><span class="icon">${icon('tree','lg')}</span><h3>Noch keine Eichen</h3><p>Jeder Ast ist ein Objekt — leg den ersten an.</p></div>`;

  return `
    <h1 class="serif">Immobilien-Eiche</h1>
    <div class="muted mb-md">Jedes Objekt ist ein Ast. Klick auf einen Ast für die Details.</div>
    <div class="row mb-md"><button class="primary" data-action="new-property">+ Neuer Ast</button></div>
    ${cards}
  `;
};
BINDERS.oak = (root, st) => {
  root.querySelectorAll('[data-prop]').forEach(el => el.onclick = (e) => {
    if(e.target.matches('[data-edit-prop],[data-edit-prop] *')) return;
    Store.update(s => ({...s, _filterPropertyId: el.dataset.prop}));
    render();
  });
  root.querySelectorAll('[data-edit-prop]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    openPropertyModal(propertyById(b.dataset.editProp));
  });
  const ep = root.querySelector('[data-edit-property]');
  if(ep) ep.onclick = () => openPropertyModal(propertyById(st._filterPropertyId));
  const nt = root.querySelector('[data-new-tenant]');
  if(nt) nt.onclick = () => openTenantModal(null, st._filterPropertyId);
  root.querySelectorAll('[data-edit-tenant]').forEach(b => b.onclick = () => openTenantModal(st.tenants.find(t => t.id === b.dataset.editTenant)));
  const nm = root.querySelector('[data-new-maint]');
  if(nm) nm.onclick = () => openMaintenanceModal(st._filterPropertyId);
  root.querySelectorAll('[data-edit]').forEach(tr => tr.onclick = (e) => {
    if(e.target.matches('button')) return;
    openBookingModal(st.bookings.find(b => b.id === tr.dataset.edit));
  });
  const av = root.querySelector('[data-anlage-v]');
  if(av) av.onclick = () => openAnlageV(st._filterPropertyId);
  const nk = root.querySelector('[data-nk]');
  if(nk) nk.onclick = () => openNkAbrechnung(st._filterPropertyId);
};

// ---- Tenant Modal -----
function openTenantModal(tenant, defaultPropId){
  const st = Store.get();
  const draft = tenant || {id:'', name:'', email:'', phone:'', iban:'', propertyId: defaultPropId||null, unit:'', rentCold:'', rentWarm:'', deposit:'', depositPaid:false, contractStart:'', contractEnd:'', livingArea:'', personCount:'', notes:''};
  const html = `
    <div class="form">
      <div class="grid cols-2">
        <div><label>Name *</label><input id="t-name" value="${escapeHtml(draft.name||'')}" /></div>
        <div><label>Objekt</label>
          <select id="t-prop">
            <option value="">— keines —</option>
            ${st.properties.map(p => `<option value="${p.id}" ${draft.propertyId===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid cols-2">
        <div><label>E-Mail</label><input id="t-email" value="${escapeHtml(draft.email||'')}" /></div>
        <div><label>Telefon</label><input id="t-phone" value="${escapeHtml(draft.phone||'')}" /></div>
      </div>
      <div class="grid cols-2">
        <div><label>IBAN</label><input id="t-iban" value="${escapeHtml(draft.iban||'')}" /></div>
        <div><label>Wohneinheit</label><input id="t-unit" value="${escapeHtml(draft.unit||'')}" placeholder="z.B. EG links" /></div>
      </div>
      <div class="grid cols-3">
        <div><label>Kaltmiete €</label><input id="t-rc" type="number" value="${draft.rentCold||''}" /></div>
        <div><label>Warmmiete €</label><input id="t-rw" type="number" value="${draft.rentWarm||''}" /></div>
        <div><label>Kaution €</label><input id="t-dep" type="number" value="${draft.deposit||''}" /></div>
      </div>
      <div class="grid cols-2">
        <div><label>Vertragsbeginn</label><input id="t-start" type="date" value="${draft.contractStart||''}" /></div>
        <div><label>Vertragsende</label><input id="t-end" type="date" value="${draft.contractEnd||''}" /></div>
      </div>
      <div class="grid cols-2">
        <div><label>Wohnfläche m²</label><input id="t-area" type="number" value="${draft.livingArea||''}" /></div>
        <div><label>Personen</label><input id="t-pers" type="number" value="${draft.personCount||''}" /></div>
      </div>
      <div><label>Notizen</label><textarea id="t-notes" rows="2">${escapeHtml(draft.notes||'')}</textarea></div>
    </div>
    <div class="modal-actions">
      ${tenant ? `<button class="danger" data-rm>🗑 Löschen</button>` : ''}
      <button data-cancel>Abbrechen</button>
      <button class="primary" data-save>Speichern</button>
    </div>
  `;
  openModal(tenant?'Mieter bearbeiten':'Neuer Mieter', html, (body, close) => {
    body.querySelector('[data-cancel]').onclick = close;
    if(tenant) body.querySelector('[data-rm]').onclick = () => confirmAlert('Mieter in Papierkorb?', () => {
      const trashId = uid('trash');
      Store.update(s => ({...s,
        tenants: s.tenants.filter(t => t.id !== tenant.id),
        trash:[...s.trash, {id:trashId, entityType:'tenant', deletedAt: new Date().toISOString(), payload: tenant}],
      }));
      close();
      Toast.undo(`„${tenant.name}" gelöscht`, () => { restoreFromTrash(trashId); render(); });
    });
    body.querySelector('[data-save]').onclick = () => {
      const name = body.querySelector('#t-name').value.trim();
      if(!name){ Toast.info('Name fehlt'); return; }
      const data = {
        name,
        propertyId: body.querySelector('#t-prop').value || null,
        email: body.querySelector('#t-email').value.trim(),
        phone: body.querySelector('#t-phone').value.trim(),
        iban: body.querySelector('#t-iban').value.trim(),
        unit: body.querySelector('#t-unit').value.trim(),
        rentCold: Number(body.querySelector('#t-rc').value) || null,
        rentWarm: Number(body.querySelector('#t-rw').value) || null,
        deposit: Number(body.querySelector('#t-dep').value) || null,
        contractStart: body.querySelector('#t-start').value || null,
        contractEnd: body.querySelector('#t-end').value || null,
        livingArea: Number(body.querySelector('#t-area').value) || null,
        personCount: Number(body.querySelector('#t-pers').value) || null,
        notes: body.querySelector('#t-notes').value.trim(),
      };
      if(tenant){
        Store.update(s => ({...s, tenants: s.tenants.map(t => t.id===tenant.id?{...t, ...data}:t)}));
      } else {
        Store.update(s => ({...s, tenants: [...s.tenants, {...data, id: uid('tnt'), createdAt: new Date().toISOString()}]}));
      }
      close();
    };
  });
}

// ---- Maintenance Modal -----
function openMaintenanceModal(propId){
  const st = Store.get();
  const html = `
    <div class="form">
      <div class="grid cols-2">
        <div><label>Datum</label><input id="ma-date" type="date" value="${todayIso()}" /></div>
        <div><label>Objekt</label><select id="ma-prop">${st.properties.map(p=>`<option value="${p.id}" ${propId===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select></div>
      </div>
      <div><label>Beschreibung</label><textarea id="ma-desc" rows="2"></textarea></div>
      <div class="grid cols-2">
        <div><label>Handwerker</label><select id="ma-cm"><option value="">—</option>${st.craftsmen.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div>
        <div><label>Kosten €</label><input id="ma-cost" type="number" /></div>
      </div>
      <label class="toggle"><input type="checkbox" id="ma-book" checked /><span class="switch"></span><span>Direkt als Buchung (★ Reparatur) erfassen</span></label>
    </div>
    <div class="modal-actions"><button data-cancel>Abbrechen</button><button class="primary" data-save>Speichern</button></div>
  `;
  openModal('Wartung erfassen', html, (body, close) => {
    body.querySelector('[data-cancel]').onclick = close;
    body.querySelector('[data-save]').onclick = () => {
      const propertyId = body.querySelector('#ma-prop').value;
      const date = body.querySelector('#ma-date').value;
      const description = body.querySelector('#ma-desc').value.trim();
      const cost = Number(body.querySelector('#ma-cost').value) || null;
      const craftsmanId = body.querySelector('#ma-cm').value || null;
      const bookIt = body.querySelector('#ma-book').checked;
      if(!description){ Toast.info('Beschreibung fehlt'); return; }
      Store.update(s => {
        let bookingId = null;
        if(bookIt && cost){
          const b = {...newBookingDraft(), id: uid('bkg'), type:'expense', amount:cost, date, propertyId, categoryId:'cat-reparatur', note: description, counterparty: craftsmanId ? s.craftsmen.find(c=>c.id===craftsmanId)?.name : '', createdAt: new Date().toISOString()};
          bookingId = b.id;
          s = {...s, bookings: [...s.bookings, b]};
        }
        return {...s, maintenanceLogs:[...s.maintenanceLogs, {id: uid('mnt'), propertyId, date, description, cost, craftsmanId, bookingId, createdAt: new Date().toISOString()}]};
      });
      close();
    };
  });
}

// ---- Belege (Receipts) -----
VIEWS.receipts = (st) => {
  const grid = st.receipts.length ? `<div class="leaf-grid">${st.receipts.slice().reverse().map(r => {
    const cat = categoryById(r.categoryId);
    const prop = propertyById(r.propertyId);
    const tax = cat && cat.taxRelevant;
    return `<div class="leaf" data-receipt="${r.id}">
      <div class="leaf-name">${escapeHtml(r.filename)}</div>
      <div class="leaf-meta">${fmtDate(r.createdAt)}${r.amount?` · ${fmtEur(r.amount)}`:''}${cat?` · ${escapeHtml(cat.label)}`:''}${prop?` · ${escapeHtml(prop.name)}`:''}</div>
      ${tax?'<div class="mt-xs"><span class="pill gold">★ steuerrelevant</span></div>':''}
    </div>`;
  }).join('')}</div>` : `<div class="empty"><span class="icon">${icon('file-text','lg')}</span><h3>Noch keine Belege</h3><p>Hänge Rechnungen als Blätter an Deine Eiche.</p></div>`;

  return `
    <h1 class="serif">Belege</h1>
    <div class="muted">Belege werden als Blätter an die Äste geheftet — der Steuer-Akzent (★) kommt automatisch aus der Kategorie.</div>
    <div class="card mt-md">
      <div class="row">
        <input id="rcp-file" type="file" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple class="mxw-340" />
        <label class="btn-like camera-only show-on-mobile" title="Foto direkt mit Kamera">
          <input id="rcp-camera" type="file" accept="image/*" capture="environment" hidden />
          ${icon('plus','sm')}<span>Kamera</span>
        </label>
        <button class="primary" id="rcp-upload">${icon('paperclip','sm')}<span>Hochladen</span></button>
        <span class="muted" id="rcp-info"></span>
      </div>
    </div>
    <div class="card mt-md">${grid}</div>
  `;
};
BINDERS.receipts = (root, st) => {
  // Foto aus Kamera direkt verarbeiten
  const cameraInput = root.querySelector('#rcp-camera');
  if(cameraInput) cameraInput.onchange = async (e) => {
    const files = e.target.files;
    if(!files || !files.length) return;
    const info = root.querySelector('#rcp-info');
    for(const f of files){
      const id = uid('rcp');
      await FilesDB.put(id, f);
      const parsed = parseFilename(f.name);
      Store.update(s => ({...s, receipts: [...s.receipts, {
        id, filename: f.name || `foto-${Date.now()}.jpg`, size: f.size, mimeType: f.type,
        amount: parsed.amount, date: parsed.date, counterparty: parsed.counterparty, categoryId: parsed.categoryId || null,
        propertyId: null, bookingId: null, createdAt: new Date().toISOString(),
      }]}));
      info.textContent = `Foto gespeichert`;
    }
    setTimeout(render, 500);
  };

  root.querySelector('#rcp-upload').onclick = async () => {
    const files = root.querySelector('#rcp-file').files;
    if(!files || files.length === 0){ Toast.info('Bitte Datei wählen'); return; }
    const info = root.querySelector('#rcp-info');
    let n = 0;
    for(const f of files){
      const id = uid('rcp');
      await FilesDB.put(id, f);
      const parsed = parseFilename(f.name);
      Store.update(s => ({...s, receipts: [...s.receipts, {
        id, filename: f.name, size: f.size, mimeType: f.type,
        amount: parsed.amount, date: parsed.date, counterparty: parsed.counterparty, categoryId: parsed.categoryId || null,
        propertyId: null, bookingId: null, createdAt: new Date().toISOString(),
      }]}));
      n++;
      info.textContent = `${n} von ${files.length} hochgeladen`;
    }
    info.textContent = `✓ ${n} Beleg(e) gespeichert`;
    setTimeout(render, 600);
  };
  root.querySelectorAll('[data-receipt]').forEach(el => el.onclick = () => openReceiptModal(el.dataset.receipt));
};
function parseFilename(name){
  const cleaned = name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ');
  const amountMatch = cleaned.match(/(\d{1,5}[.,]\d{2})/);
  const amount = amountMatch ? Number(amountMatch[1].replace(',','.')) : null;
  const dateMatch = cleaned.match(/(\d{4})[-_./]?(\d{2})[-_./]?(\d{2})/);
  const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;
  const vendors = [
    {k:['stadtwerk'],            cat:'cat-strom',         name:'Stadtwerke'},
    {k:['telekom','vodafone'],    cat:'cat-internet',      name:'Telekom'},
    {k:['versich','allianz','huk'], cat:'cat-versicherung', name:'Versicherung'},
    {k:['gez','beitragsservice'], cat:'cat-gez',           name:'Rundfunkbeitrag'},
    {k:['grundsteuer'],           cat:'cat-grundsteuer',   name:'Grundsteuer'},
    {k:['hausgeld','verwalt'],    cat:'cat-hausgeld',      name:'Hausverwaltung'},
    {k:['miete'],                 cat:'cat-miete',         name:'Mieteinnahme'},
  ];
  const lower = cleaned.toLowerCase();
  let counterparty = null, categoryId = null;
  for(const v of vendors){
    if(v.k.some(k => lower.includes(k))){ counterparty = v.name; categoryId = v.cat; break; }
  }
  return {amount, date, counterparty, categoryId};
}
async function openReceiptModal(id){
  const r = Store.get().receipts.find(x => x.id === id);
  if(!r) return;
  const dataUrl = await FilesDB.asDataURL(r.id);
  const isPdf = (r.mimeType||'').includes('pdf') || r.filename.toLowerCase().endsWith('.pdf');
  const preview = !dataUrl ? '<div class="muted">Datei nicht gefunden</div>' :
    isPdf ? `<embed src="${dataUrl}" type="application/pdf" style="width:100%;height:380px;border-radius:8px;background:#fff" />` :
    `<img src="${dataUrl}" style="max-width:100%;border-radius:8px;background:var(--surface-2);padding:8px" />`;
  const st = Store.get();
  const html = `
    <div style="background:linear-gradient(135deg,var(--surface-2),#1F140C);padding:14px;border-radius:8px;margin-bottom:14px">
      ${preview}
    </div>
    <div class="form">
      <div class="grid cols-2">
        <div><label>Betrag €</label><input id="r-amount" type="number" step="0.01" value="${r.amount||''}" /></div>
        <div><label>Datum</label><input id="r-date" type="date" value="${r.date||''}" /></div>
      </div>
      <div><label>Empfänger</label><input id="r-cp" value="${escapeHtml(r.counterparty||'')}" /></div>
      <div class="grid cols-2">
        <div><label>Kategorie</label><select id="r-cat"><option value="">—</option>${st.categories.map(c=>`<option value="${c.id}" ${r.categoryId===c.id?'selected':''}>${c.taxRelevant?'★ ':''}${escapeHtml(c.label)}</option>`).join('')}</select></div>
        <div><label>Objekt</label><select id="r-prop"><option value="">—</option>${st.properties.map(p=>`<option value="${p.id}" ${r.propertyId===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select></div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="danger" data-rm>🗑 Beleg löschen</button>
      <button class="primary" data-book>📌 Als Buchung übernehmen</button>
      <button class="primary" data-save>Speichern</button>
    </div>
  `;
  openModal('Beleg: ' + r.filename, html, (body, close) => {
    body.querySelector('[data-rm]').onclick = () => confirmAlert('Beleg endgültig löschen?', async () => {
      await FilesDB.remove(r.id);
      Store.update(s => ({...s, receipts: s.receipts.filter(x => x.id !== r.id)}));
      close();
    });
    body.querySelector('[data-save]').onclick = () => {
      const patch = {
        amount: Number(body.querySelector('#r-amount').value) || null,
        date: body.querySelector('#r-date').value || null,
        counterparty: body.querySelector('#r-cp').value.trim(),
        categoryId: body.querySelector('#r-cat').value || null,
        propertyId: body.querySelector('#r-prop').value || null,
      };
      Store.update(s => ({...s, receipts: s.receipts.map(x => x.id === r.id ? {...x, ...patch} : x)}));
      close();
    };
    body.querySelector('[data-book]').onclick = () => {
      const amount = Number(body.querySelector('#r-amount').value);
      const date = body.querySelector('#r-date').value || todayIso();
      const counterparty = body.querySelector('#r-cp').value.trim();
      const categoryId = body.querySelector('#r-cat').value || null;
      const propertyId = body.querySelector('#r-prop').value || null;
      if(!amount){ Toast.info('Betrag fehlt'); return; }
      Store.update(s => ({...s,
        bookings: [...s.bookings, {...newBookingDraft(), id: uid('bkg'), type:'expense', amount, date, categoryId, propertyId, counterparty, note:'aus Beleg: '+r.filename, receiptId: r.id, createdAt: new Date().toISOString()}],
        receipts: s.receipts.map(x => x.id === r.id ? {...x, amount, date, counterparty, categoryId, propertyId} : x),
      }));
      close();
    };
  });
}

// ---- Steuer-Berater-Modus -----
VIEWS.advisor = (st) => {
  const year = new Date().getFullYear();
  const ranges = [year, year-1, year-2];
  const currentYear = st._advisorYear || year;
  const yearBks = st.bookings.filter(b => b.date.startsWith(String(currentYear)) && isTaxRelevant(b));
  const byCat = {};
  for(const b of yearBks){
    const c = b.categoryId || 'sonstiges';
    byCat[c] = byCat[c] || {sum:0, n:0};
    byCat[c].sum += b.amount * (b.type==='income' ? 1 : -1);
    byCat[c].n += 1;
  }
  const inc = yearBks.filter(b=>b.type==='income').reduce((s,b)=>s+b.amount,0);
  const exp = yearBks.filter(b=>b.type==='expense').reduce((s,b)=>s+b.amount,0);

  const rows = yearBks.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(b => {
    const c = categoryById(b.categoryId);
    const p = propertyById(b.propertyId);
    return `<tr class="gold-row">
      <td>${fmtDate(b.date)}</td>
      <td>${escapeHtml(b.counterparty||'—')}</td>
      <td>${c?escapeHtml(c.label):'—'}</td>
      <td>${p?escapeHtml(p.name):''}</td>
      <td class="right amount ${b.type==='income'?'income':'expense'}">${b.type==='income'?'+':'−'} ${fmtEur(b.amount)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5"><div class="muted">Keine steuerrelevanten Buchungen in '+currentYear+'</div></td></tr>';

  const groupRows = Object.entries(byCat).sort((a,b) => Math.abs(b[1].sum) - Math.abs(a[1].sum)).map(([cid, {sum, n}]) => {
    const c = categoryById(cid);
    return `<tr>
      <td>${c?escapeHtml(c.label):cid}</td>
      <td class="right">${n}</td>
      <td class="right amount ${sum>=0?'income':'expense'}">${fmtEur(sum)}</td>
    </tr>`;
  }).join('');

  return `
    <div class="card" style="margin-bottom:14px;border-color:var(--gold-ring)">
      <div class="card-title">
        <h1 class="serif gold-text">★ Berater-Modus — Steuerjahr ${currentYear}</h1>
        <div class="actions">
          <select id="ad-year">${ranges.map(y => `<option value="${y}" ${y===currentYear?'selected':''}>${y}</option>`).join('')}</select>
          <button class="gold" id="ernte-pdf">${icon('download','sm')}<span>Ernte-Korb → PDF</span></button>
          <button id="ernte-csv">CSV</button>
        </div>
      </div>
      <div class="grid cols-3">
        <div><div class="muted">Mieteinnahmen / Einnahmen</div><div class="amount lg income">+${fmtEur(inc)}</div></div>
        <div><div class="muted">Werbungskosten / Ausgaben</div><div class="amount lg expense">−${fmtEur(exp)}</div></div>
        <div><div class="muted">Einkünfte aus V+V</div><div class="amount lg" style="color:${inc-exp>=0?'var(--accent)':'var(--berry)'}">${fmtEur(inc-exp)}</div></div>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card">
        ${cardTitle('list', 'Pro Kategorie')}
        <table class="data">
          <thead><tr><th>Kategorie</th><th class="right">#</th><th class="right">Saldo</th></tr></thead>
          <tbody>${groupRows || '<tr><td colspan="3" class="muted">Keine Daten</td></tr>'}</tbody>
        </table>
      </div>
      <div class="card">
        ${cardTitle('tree', 'Pro Objekt')}
        <table class="data">
          <thead><tr><th>Objekt</th><th class="right">Einnahmen</th><th class="right">Ausgaben</th><th class="right">Saldo</th></tr></thead>
          <tbody>${
            st.properties.map(p => {
              const yb = yearBks.filter(b => b.propertyId === p.id);
              const pi = yb.filter(b=>b.type==='income').reduce((s,b)=>s+b.amount,0);
              const pe = yb.filter(b=>b.type==='expense').reduce((s,b)=>s+b.amount,0);
              return `<tr><td>${escapeHtml(p.name)}</td><td class="right">+${fmtEur(pi)}</td><td class="right">−${fmtEur(pe)}</td><td class="right amount ${pi-pe>=0?'income':'expense'}">${fmtEur(pi-pe)}</td></tr>`;
            }).join('') || '<tr><td colspan="4" class="muted">Keine Objekte</td></tr>'
          }</tbody>
        </table>
      </div>
    </div>

    <div class="card mt-md">
      <div class="card-title">
        <h2>★ Alle steuerrelevanten Buchungen ${currentYear}</h2>
        <span class="muted">${yearBks.length} Einträge</span>
      </div>
      <table class="data">
        <thead><tr><th>Datum</th><th>Empfänger</th><th>Kategorie</th><th>Objekt</th><th class="right">Betrag</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="card" style="margin-top:14px;border-color:var(--gold-ring)">
      <div class="card-title"><h2 class="gold-text">🧺 Ernte-Korb (Berater-Export)</h2></div>
      <div class="muted">Alle gold markierten Daten in einer Datei — schickfertig für den Steuerberater.</div>
      <div class="row mt-md">
        <button class="gold" id="export-pdf">${icon('printer','sm')}<span>PDF drucken</span></button>
        <button id="export-csv">📊 CSV-Download</button>
        <button id="export-datev">DATEV-CSV</button>
        <button id="export-anlage-v">Anlage V (alle Objekte)</button>
      </div>
    </div>
  `;
};
BINDERS.advisor = (root, st) => {
  root.querySelector('#ad-year').onchange = e => { Store.update(s => ({...s, _advisorYear: Number(e.target.value)})); render(); };
  const doPdf = () => { Store.update(s => ({...s, settings:{...s.settings, advisorMode:true}})); document.body.classList.add('advisor'); setTimeout(()=>window.print(), 100); };
  root.querySelector('#ernte-pdf').onclick = doPdf;
  root.querySelector('#export-pdf').onclick = doPdf;
  root.querySelector('#ernte-csv').onclick = root.querySelector('#export-csv').onclick = () => exportCsv(st._advisorYear || new Date().getFullYear());
  root.querySelector('#export-datev').onclick = () => exportDatev(st._advisorYear || new Date().getFullYear());
  root.querySelector('#export-anlage-v').onclick = () => exportAnlageVAll(st._advisorYear || new Date().getFullYear());
};
function exportCsv(year){
  const st = Store.get();
  const list = st.bookings.filter(b => b.date.startsWith(String(year)) && isTaxRelevant(b));
  const lines = ['Datum;Typ;Betrag;Empfänger;Kategorie;Objekt;Notiz'];
  for(const b of list){
    const c = categoryById(b.categoryId);
    const p = propertyById(b.propertyId);
    lines.push([
      b.date,
      b.type==='income'?'Einnahme':'Ausgabe',
      b.amount.toFixed(2).replace('.',','),
      csvEscape(b.counterparty),
      csvEscape(c?c.label:''),
      csvEscape(p?p.name:''),
      csvEscape(b.note),
    ].join(';'));
  }
  downloadBlob(lines.join('\r\n'), `manu-steuer-${year}.csv`, 'text/csv');
}
function csvEscape(s){ if(s==null) return ''; const str=String(s); return /[";\n]/.test(str) ? `"${str.replace(/"/g,'""')}"` : str; }
function exportDatev(year){
  const st = Store.get();
  const list = st.bookings.filter(b => b.date.startsWith(String(year)) && isTaxRelevant(b));
  const map = new Map(st.datevMapping.map(m => [m.categoryId, m.account]));
  const lines = ['"Umsatz";"S/H";"Konto";"Gegenkonto";"Belegdatum";"Belegfeld 1";"Buchungstext";"Objekt"'];
  for(const b of list){
    const acc = (b.categoryId && map.get(b.categoryId)) || (b.type==='income' ? '8400' : '4900');
    const date = b.date.slice(8,10)+b.date.slice(5,7);
    lines.push([
      `"${b.amount.toFixed(2).replace('.',',')}"`,
      '"S"',
      `"${b.type==='income'?'1200':acc}"`,
      `"${b.type==='income'?acc:'1200'}"`,
      `"${date}"`,
      `"${b.id.slice(-10)}"`,
      `"${(b.counterparty||b.note||'').slice(0,60).replace(/"/g,'""')}"`,
      `"${propertyById(b.propertyId)?.name||''}"`,
    ].join(';'));
  }
  downloadBlob(lines.join('\r\n'), `manu-datev-${year}.csv`, 'text/csv');
}
function downloadBlob(text, filename, type){
  const blob = new Blob([text], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportAnlageVAll(year){
  const st = Store.get();
  if(!st.properties.length){ Toast.info('Keine Objekte angelegt'); return; }
  for(const p of st.properties) openAnlageV(p.id, year);
}

// ---- Anlage V -----
const ANLAGE_V_MAP = {
  'cat-miete':       {row:'Zeile 9 — Mieteinnahmen', side:'income'},
  'cat-nk':          {row:'Zeile 12 — Umlagen', side:'income'},
  'cat-strom':       {row:'Zeile 47 — Sonstige Werbungskosten', side:'expense'},
  'cat-wasser':      {row:'Zeile 47 — Sonstige Werbungskosten', side:'expense'},
  'cat-gas':         {row:'Zeile 47 — Sonstige Werbungskosten', side:'expense'},
  'cat-hausgeld':    {row:'Zeile 47 — Verwaltungskosten', side:'expense'},
  'cat-gez':         {row:'Zeile 47 — Sonstige Werbungskosten', side:'expense'},
  'cat-versicherung':{row:'Zeile 47 — Versicherungen', side:'expense'},
  'cat-grundsteuer': {row:'Zeile 47 — Grundsteuer', side:'expense'},
  'cat-reparatur':   {row:'Zeile 39 — Erhaltungsaufwand', side:'expense'},
  'cat-renovierung': {row:'Zeile 39 — Erhaltungsaufwand', side:'expense'},
  'cat-kredit':      {row:'Zeile 36 — Schuldzinsen', side:'expense'},
  'cat-afa':         {row:'Zeile 35 — AfA', side:'expense'},
  'cat-steuerberater':{row:'Zeile 47 — Sonstige Werbungskosten', side:'expense'},
};
function openAnlageV(propId, year){
  const st = Store.get();
  const p = propertyById(propId);
  if(!p){ Toast.error('Objekt nicht gefunden'); return; }
  const yr = year || (st._advisorYear || new Date().getFullYear());
  const bks = st.bookings.filter(b => b.propertyId === p.id && b.date.startsWith(String(yr)));
  const grouped = {};
  for(const b of bks){
    const mapping = ANLAGE_V_MAP[b.categoryId] || {row:'Zeile 47 — Sonstige Werbungskosten', side:b.type};
    grouped[mapping.row] = grouped[mapping.row] || {sum:0, side:mapping.side};
    grouped[mapping.row].sum += b.amount;
  }
  // AfA addieren
  if(p.afa?.acquisitionValue && p.afa?.ratePercent){
    const afa = p.afa.acquisitionValue * p.afa.ratePercent / 100;
    grouped['Zeile 35 — AfA'] = {sum: (grouped['Zeile 35 — AfA']?.sum||0) + afa, side:'expense'};
  }
  const incomeRows = Object.entries(grouped).filter(([,v])=>v.side==='income');
  const expenseRows = Object.entries(grouped).filter(([,v])=>v.side==='expense');
  const sumIn = incomeRows.reduce((s,[,v])=>s+v.sum,0);
  const sumEx = expenseRows.reduce((s,[,v])=>s+v.sum,0);
  const html = `
    <h3>Anlage V · ${escapeHtml(p.name)} · ${yr}</h3>
    <table class="data mt-md">
      <thead><tr><th>Zeile</th><th class="right">Betrag</th></tr></thead>
      <tbody>
        <tr><th colspan="2">Einnahmen</th></tr>
        ${incomeRows.map(([r,v]) => `<tr><td>${r}</td><td class="right">${fmtEur(v.sum)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">—</td></tr>'}
        <tr style="font-weight:700"><td>Summe Einnahmen</td><td class="right income">${fmtEur(sumIn)}</td></tr>
        <tr><th colspan="2">Werbungskosten</th></tr>
        ${expenseRows.map(([r,v]) => `<tr><td>${r}</td><td class="right">${fmtEur(v.sum)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">—</td></tr>'}
        <tr style="font-weight:700"><td>Summe Werbungskosten</td><td class="right expense">${fmtEur(sumEx)}</td></tr>
        <tr style="font-weight:700;background:var(--gold-soft)"><td>Einkünfte aus V+V</td><td class="right amount ${sumIn-sumEx>=0?'income':'expense'}">${fmtEur(sumIn-sumEx)}</td></tr>
      </tbody>
    </table>
    <div class="modal-actions"><button data-close-av>Schließen</button><button class="gold" data-print-av>${icon('printer','sm')}<span>Drucken</span></button></div>
  `;
  openModal('Anlage V', html, (body, close) => {
    body.querySelector('[data-close-av]').onclick = close;
    body.querySelector('[data-print-av]').onclick = () => window.print();
  });
}

// ---- NK-Abrechnung -----
function openNkAbrechnung(propId){
  const st = Store.get();
  const p = propertyById(propId);
  if(!p){ Toast.error('Objekt nicht gefunden'); return; }
  const tenants = st.tenants.filter(t => t.propertyId === p.id);
  if(!tenants.length){ Toast.info('Keine Mieter für dieses Objekt'); return; }
  const year = (st._advisorYear || new Date().getFullYear()) - 1;
  const nkCats = ['cat-strom','cat-wasser','cat-gas','cat-hausgeld','cat-gez'];
  const total = nkCats.reduce((acc, cid) => {
    const sum = st.bookings.filter(b => b.propertyId === p.id && b.categoryId === cid && b.date.startsWith(String(year))).reduce((s,b)=>s+b.amount,0);
    return {...acc, [cid]: sum};
  }, {});
  const totalArea = p.totalLivingArea || tenants.reduce((s,t)=>s+(t.livingArea||0),0) || 1;
  const tenantsHtml = tenants.map(t => {
    const share = (t.livingArea||0) / totalArea;
    const cost = Object.values(total).reduce((s,v)=>s+v*share,0);
    const prepay = ((t.rentWarm||0)-(t.rentCold||0)) * 12;
    const diff = cost - prepay;
    return `<tr>
      <td>${escapeHtml(t.name)}</td>
      <td class="right">${t.livingArea||0} m²</td>
      <td class="right">${(share*100).toFixed(1)}%</td>
      <td class="right">${fmtEur(cost)}</td>
      <td class="right">${fmtEur(prepay)}</td>
      <td class="right amount ${diff>0?'expense':'income'}">${diff>0?'+':''}${fmtEur(diff)}</td>
    </tr>`;
  }).join('');
  const totalRow = nkCats.map(cid => `<tr><td>${categoryById(cid)?.label||cid}</td><td class="right">${fmtEur(total[cid])}</td></tr>`).join('');
  const html = `
    <h3>NK-Abrechnung · ${escapeHtml(p.name)} · ${year}</h3>
    <table class="data mt-md">
      <thead><tr><th>Kostenart</th><th class="right">Gesamt ${year}</th></tr></thead>
      <tbody>${totalRow}<tr style="font-weight:700"><td>Summe umlagefähig</td><td class="right">${fmtEur(Object.values(total).reduce((s,v)=>s+v,0))}</td></tr></tbody>
    </table>
    <p class="muted mt-md">Verteilerschlüssel: Wohnfläche</p>
    <table class="data">
      <thead><tr><th>Mieter</th><th class="right">m²</th><th class="right">Anteil</th><th class="right">Kosten</th><th class="right">Vorauszahlung</th><th class="right">Nach-/Rückzahlung</th></tr></thead>
      <tbody>${tenantsHtml}</tbody>
    </table>
    <div class="modal-actions"><button data-close-nk>Schließen</button><button class="gold" data-print-nk>${icon('printer','sm')}<span>Drucken</span></button></div>
  `;
  openModal('NK-Abrechnung', html, (body, close) => {
    body.querySelector('[data-close-nk]').onclick = close;
    body.querySelector('[data-print-nk]').onclick = () => window.print();
  });
}

// ---- Tools -----
VIEWS.tools = (st) => {
  // Subscription Detection
  const counterpartyMap = {};
  for(const b of st.bookings){
    if(b.type !== 'expense' || !b.counterparty) continue;
    const k = b.counterparty.trim().toLowerCase();
    counterpartyMap[k] = counterpartyMap[k] || {name:b.counterparty, count:0, sum:0, months:new Set()};
    counterpartyMap[k].count++;
    counterpartyMap[k].sum += b.amount;
    counterpartyMap[k].months.add(b.date.slice(0,7));
  }
  const subs = Object.values(counterpartyMap).filter(s => s.months.size >= 2 && s.count >= 2).slice(0,10);

  // Top Kategorien (12 Monate)
  const yearAgo = new Date(); yearAgo.setMonth(yearAgo.getMonth()-12);
  const yearAgoIso = yearAgo.toISOString().slice(0,10);
  const catSum = {};
  for(const b of st.bookings){
    if(b.type !== 'expense' || b.date < yearAgoIso) continue;
    const c = categoryById(b.categoryId);
    if(!c) continue;
    catSum[c.label] = (catSum[c.label]||0) + b.amount;
  }
  const topCats = Object.entries(catSum).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxCat = topCats[0]?.[1] || 1;

  return `
    <h1 class="serif">Werkzeuge</h1>
    <div class="grid cols-2">
      <div class="card">
        ${cardTitle('repeat', 'Erkannte Abos')}
        ${subs.length ? subs.map(s => `
          <div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <div><div class="serif">${escapeHtml(s.name)}</div><div class="muted">${s.count}× in ${s.months.size} Monaten</div></div>
            <div class="amount md expense">${fmtEur(s.sum/s.count)}/Mt</div>
          </div>`).join('') : '<div class="muted">Noch keine wiederkehrenden Empfänger erkannt.</div>'}
      </div>
      <div class="card">
        ${cardTitle('trending-up', 'Top-Ausgaben Kategorien (12 Mt)')}
        ${topCats.length ? topCats.map(([n,v]) => `
          <div style="padding:6px 0">
            <div class="row" style="justify-content:space-between"><span>${escapeHtml(n)}</span><span class="amount md">${fmtEur(v)}</span></div>
            <div style="height:6px;background:var(--surface-3);border-radius:3px;margin-top:4px"><div style="width:${(v/maxCat)*100}%;height:100%;background:var(--moss);border-radius:3px"></div></div>
          </div>`).join('') : '<div class="muted">Noch keine Daten</div>'}
      </div>
    </div>

    <div class="grid cols-3 mt-md">
      <div class="card">
        ${cardTitle('target', 'Sparziele')}
        ${st.goals.length ? st.goals.map(g => `
          <div style="padding:6px 0;border-bottom:1px solid var(--border)">
            <div class="row" style="justify-content:space-between"><span class="serif">${escapeHtml(g.label)}</span><span>${fmtEur(g.saved)}/${fmtEur(g.target)}</span></div>
            <div style="height:6px;background:var(--surface-3);border-radius:3px;margin-top:4px"><div style="width:${Math.min(100,(g.saved/g.target)*100)}%;height:100%;background:var(--accent);border-radius:3px"></div></div>
          </div>`).join('') : '<div class="muted">Keine Sparziele</div>'}
        <button class="primary mt-2" data-new-goal>+ Sparziel</button>
      </div>
      <div class="card">
        ${cardTitle('file-text', 'Verträge')}
        ${st.contracts.length ? st.contracts.map(c => `
          <div style="padding:6px 0;border-bottom:1px solid var(--border)">
            <div class="serif">${escapeHtml(c.label)}</div>
            <div class="muted">${c.category}${c.earliestEndDate?` · Ende: ${fmtDate(c.earliestEndDate)}`:''}</div>
          </div>`).join('') : '<div class="muted">Keine Verträge</div>'}
        <button class="primary mt-2" data-new-contract>+ Vertrag</button>
      </div>
      <div class="card">
        ${cardTitle('hammer', 'Handwerker')}
        ${st.craftsmen.length ? st.craftsmen.map(c => `
          <div style="padding:6px 0;border-bottom:1px solid var(--border)">
            <div class="serif">${escapeHtml(c.name)}</div>
            <div class="muted">${escapeHtml(c.trade||'')}${c.phone?` · ${escapeHtml(c.phone)}`:''}</div>
          </div>`).join('') : '<div class="muted">Keine Einträge</div>'}
        <button class="primary mt-2" data-new-cm>+ Handwerker</button>
      </div>
    </div>

    <div class="grid cols-2 mt-md">
      <div class="card">
        ${cardTitle('calculator', 'Brutto / Netto Rechner')}
        <div class="form mt-sm">
          <input id="bn-brutto" type="number" placeholder="Brutto monatlich €" />
          <select id="bn-class"><option value="1">Steuerklasse 1</option><option value="2">2</option><option value="3">3</option><option value="4" selected>4</option><option value="5">5</option><option value="6">6</option></select>
          <div id="bn-result" class="muted"></div>
        </div>
      </div>
      <div class="card">
        ${cardTitle('database', 'CSV-Import')}
        <p class="muted">Bank-Export einlesen (DKB / Sparkasse / ING / N26)</p>
        <input id="csv-file" type="file" accept=".csv,text/csv,text/plain" />
        <button class="primary mt-2" id="csv-import">Importieren</button>
        <div id="csv-info" class="muted mt-sm"></div>
      </div>
    </div>
  `;
};
BINDERS.tools = (root, st) => {
  root.querySelector('[data-new-goal]').onclick = () => openSimpleEntityModal('Sparziel', [
    {key:'label', label:'Bezeichnung'}, {key:'target', label:'Zielbetrag €', type:'number'}, {key:'saved', label:'Bereits gespart €', type:'number'}, {key:'deadline', label:'Deadline', type:'date'},
  ], data => Store.update(s => ({...s, goals:[...s.goals, {...data, target:Number(data.target)||0, saved:Number(data.saved)||0, id:uid('gol'), emoji:'🎯', createdAt: new Date().toISOString()}]})));
  root.querySelector('[data-new-contract]').onclick = () => openSimpleEntityModal('Vertrag', [
    {key:'label', label:'Bezeichnung'}, {key:'category', label:'Kategorie', type:'select', options:['Strom','Gas','Internet','Telefon','Versicherung','Streaming','Sonstiges']}, {key:'vendor', label:'Anbieter'}, {key:'monthlyCost', label:'Monatskosten €', type:'number'}, {key:'earliestEndDate', label:'Vertragsende', type:'date'}, {key:'noticePeriodDays', label:'Kündigungsfrist (Tage)', type:'number'},
  ], data => Store.update(s => ({...s, contracts:[...s.contracts, {...data, monthlyCost:Number(data.monthlyCost)||null, noticePeriodDays:Number(data.noticePeriodDays)||90, id:uid('ctr'), createdAt: new Date().toISOString()}]})));
  root.querySelector('[data-new-cm]').onclick = () => openSimpleEntityModal('Handwerker', [
    {key:'name', label:'Name'}, {key:'trade', label:'Gewerk', type:'select', options:['Heizung','Elektrik','Sanitär','Maler','Schreiner','Dach','Garten','Reinigung','Schornsteinfeger','Sonstiges']}, {key:'phone', label:'Telefon'}, {key:'email', label:'E-Mail'}, {key:'website', label:'Website'}, {key:'hours', label:'Öffnungszeiten'},
  ], data => Store.update(s => ({...s, craftsmen:[...s.craftsmen, {...data, id:uid('crf'), createdAt: new Date().toISOString()}]})));
  const bnB = root.querySelector('#bn-brutto');
  const bnC = root.querySelector('#bn-class');
  const bnR = root.querySelector('#bn-result');
  const compute = () => {
    const b = Number(bnB.value);
    if(!b){ bnR.textContent=''; return; }
    const cls = Number(bnC.value);
    const sv = b * (cls===3?0.04:cls===5?0.10:cls===6?0.16:0.07);
    const sva = b * 0.205;
    const netto = b - sv - sva;
    bnR.innerHTML = `<div>Lohnsteuer ca: <b>${fmtEur(sv)}</b></div><div>Sozialversicherung ca: <b>${fmtEur(sva)}</b></div><div class="amount md income mt-xs">Netto ≈ ${fmtEur(netto)}</div>`;
  };
  bnB.oninput = compute; bnC.onchange = compute;

  root.querySelector('#csv-import').onclick = async () => {
    const f = root.querySelector('#csv-file').files[0];
    const info = root.querySelector('#csv-info');
    if(!f){ Toast.info('Datei wählen'); return; }
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    let imported = 0;
    const buchungen = [];
    // Einfache Heuristik: finde Header-Zeile mit "Datum" und "Betrag"
    let delim = ';'; let headerIdx = -1;
    for(let i=0;i<Math.min(15,lines.length);i++){
      const l = lines[i].toLowerCase();
      if(l.includes('datum') && (l.includes('betrag')||l.includes('umsatz')||l.includes('wert'))){
        headerIdx = i;
        delim = lines[i].split(';').length > lines[i].split(',').length ? ';' : ',';
        break;
      }
    }
    if(headerIdx < 0){ info.textContent='Kein Banking-Format erkannt'; return; }
    const headers = splitCSV(lines[headerIdx], delim).map(h => h.toLowerCase());
    const idxDate = headers.findIndex(h => h.includes('datum')||h.includes('buchungstag'));
    const idxAmount = headers.findIndex(h => h.includes('betrag')||h.includes('umsatz'));
    const idxCp = headers.findIndex(h => h.includes('empfänger')||h.includes('auftraggeber')||h.includes('name'));
    const idxNote = headers.findIndex(h => h.includes('verwendung')||h.includes('text'));
    for(let i=headerIdx+1;i<lines.length;i++){
      const cols = splitCSV(lines[i], delim);
      if(cols.length < 2) continue;
      const d = parseGermanDate(cols[idxDate]);
      const amount = parseGermanAmount(cols[idxAmount]);
      if(!d || amount==null) continue;
      buchungen.push({...newBookingDraft(), id:uid('imp'), type: amount<0?'expense':'income', amount: Math.abs(amount), date:d, counterparty: cols[idxCp]||'', note: cols[idxNote]||'', createdAt: new Date().toISOString()});
      imported++;
    }
    if(!imported){ info.textContent='Keine Buchungen erkannt'; return; }
    confirmAlert(`${imported} Buchungen importieren?`, () => {
      Store.update(s => ({...s, bookings:[...s.bookings, ...buchungen]}));
      info.textContent = `✓ ${imported} importiert`;
    });
  };
};
function splitCSV(line, d){
  const out=[]; let cur=''; let q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){ if(q && line[i+1]==='"'){ cur+='"'; i++; } else q=!q; }
    else if(ch===d && !q){ out.push(cur); cur=''; }
    else cur+=ch;
  }
  out.push(cur); return out.map(s=>s.trim());
}
function parseGermanDate(s){
  if(!s) return null;
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if(!m) return null;
  let y = m[3]; if(y.length===2) y = (Number(y)>50?'19':'20')+y;
  return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
}
function parseGermanAmount(s){
  if(!s) return null;
  const c = String(s).replace(/\s/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.\-+]/g,'');
  const n = Number(c); return Number.isFinite(n) ? n : null;
}

function openSimpleEntityModal(title, fields, onSave){
  const html = `
    <div class="form">${fields.map(f => `
      <div>
        <label>${escapeHtml(f.label)}</label>
        ${f.type==='select' ? `<select id="se-${f.key}">${(f.options||[]).map(o=>`<option>${escapeHtml(o)}</option>`).join('')}</select>` :
          f.type==='date' ? `<input id="se-${f.key}" type="date" />` :
          f.type==='number' ? `<input id="se-${f.key}" type="number" step="0.01" />` :
          `<input id="se-${f.key}" />`}
      </div>`).join('')}
    </div>
    <div class="modal-actions"><button data-cancel>Abbrechen</button><button class="primary" data-save>Speichern</button></div>
  `;
  openModal(title, html, (body, close) => {
    body.querySelector('[data-cancel]').onclick = close;
    body.querySelector('[data-save]').onclick = () => {
      const data = {};
      for(const f of fields){
        const el = body.querySelector('#se-'+f.key);
        data[f.key] = el ? el.value.trim() : '';
      }
      onSave(data);
      close();
    };
  });
}

// ---- Settings -----
VIEWS.settings = (st) => {
  return `
    <h1 class="serif">Einstellungen</h1>

    <div class="card mt-md">
      <div class="card-title"><h2><span class="ti-icon gold">${icon('shield-check','md')}</span>Sicherheit</h2></div>
      <div class="row">
        ${(isEncrypted() || st.settings.pinHash) ? '<span class="pill emerald">✓ Tresor verschlüsselt</span>' : '<span class="pill berry">Kein PIN</span>'}
        <button id="pin-set">${(isEncrypted() || st.settings.pinHash)?'PIN ändern':'PIN setzen'}</button>
        ${(isEncrypted() || st.settings.pinHash) ? '<button class="danger" id="pin-rm">PIN entfernen</button>' : ''}
      </div>
      ${isEncrypted() ? '<p class="muted mt-sm">Belege + Buchungen werden mit AES-GCM-256 verschlüsselt. Master-Key liegt nie auf der Festplatte.</p>' : ''}
      <div class="row mt-md">
        <label>Auto-Lock</label>
        <select id="auto-lock">
          ${[0,1,5,15,30].map(m => `<option value="${m}" ${st.settings.autoLockMinutes===m?'selected':''}>${m===0?'Aus':m+' Minuten'}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="card mt-md">
      <div class="card-title"><h2><span class="ti-icon">${icon('settings','md')}</span>Erscheinungsbild</h2></div>
      <div class="row mb-2">
        <label>Thema</label>
        ${[{k:'light',l:'Hell'},{k:'dark',l:'Dunkel'},{k:'auto',l:'Automatisch'}].map(t => `<button class="${st.settings.colorScheme===t.k?'primary':''}" data-theme="${t.k}">${t.l}</button>`).join('')}
      </div>
      <div class="row mb-2">
        <label>Sprache</label>
        ${['de','en'].map(l => `<button class="${st.settings.locale===l?'primary':''}" data-lang="${l}">${l==='de'?'Deutsch':'English'}</button>`).join('')}
      </div>
      <div class="row">
        <label>Schriftgröße</label>
        ${['normal','large','xlarge'].map(s => `<button class="${st.settings.fontScale===s?'primary':''}" data-font="${s}">${s==='normal'?'Normal':s==='large'?'Groß':'Sehr Groß'}</button>`).join('')}
      </div>
    </div>

    <div class="card mt-md">
      <div class="card-title"><h2><span class="ti-icon">${icon('download','md')}</span>Daten</h2></div>
      <p class="muted">Backup als JSON-Datei mit allen Buchungen, Mietern, Belegen. Lokal speichern oder per AirDrop verschicken.</p>
      <div class="row mt-md">
        <button class="primary" id="bk-export">${icon('download','sm')}<span>Backup erstellen</span></button>
        <input id="bk-file" type="file" accept=".json,application/json" class="mxw-260" />
        <button id="bk-import">${icon('upload','sm')}<span>Backup laden</span></button>
      </div>
      <div class="row mt-3">
        <span class="pill ${st.trash.length?'berry':''}">🗑 Papierkorb: ${st.trash.length}</span>
        <button id="trash-open">Öffnen</button>
        <button id="trash-purge">Auto-Bereinigung (>30 Tg)</button>
      </div>
    </div>

    <div class="card mt-md">
      <div class="card-title"><h2><span class="ti-icon">${icon('wrench','md')}</span>Kategorien</h2></div>
      <p class="muted">Goldener Stern (★) = steuerrelevant. Diese Buchungen erscheinen automatisch im Berater-Modus.</p>
      <table class="data mt-2">
        <thead><tr><th>Kategorie</th><th>Gruppe</th><th class="right">★ Steuerrelevant</th></tr></thead>
        <tbody>${st.categories.map(c => `
          <tr><td>${escapeHtml(c.label)}</td><td><span class="pill ${c.group||'neutral'}">${c.group||'neutral'}</span></td>
            <td class="right"><label class="toggle"><input type="checkbox" data-tax="${c.id}" ${c.taxRelevant?'checked':''} /><span class="switch"></span></label></td></tr>
        `).join('')}</tbody>
      </table>
      <button id="cat-add" class="mt-2">+ Eigene Kategorie</button>
    </div>

    <div class="card mt-md">
      <div class="card-title"><h2><span class="ti-icon berry">${icon('alert-circle','md')}</span>Zurücksetzen</h2></div>
      <p class="muted">Löscht alle lokalen Daten. Bitte vorher Backup machen!</p>
      <button class="danger" id="reset-all">🗑 Alle Daten löschen</button>
    </div>
  `;
};
BINDERS.settings = (root, st) => {
  root.querySelector('#pin-set').onclick = () => {
    const meta = loadMeta();
    const isChange = isEncrypted();
    const title = isChange ? 'PIN ändern' : 'PIN setzen';
    openModal(title, `
      <div class="form">
        ${isChange ? '<div><label>Aktueller PIN</label><input id="cp" type="password" inputmode="numeric" /></div>' : ''}
        <div><label>Neuer PIN (min. 4 Stellen)</label><input id="np" type="password" inputmode="numeric" /></div>
        <div><label>Wiederholen</label><input id="np2" type="password" inputmode="numeric" /></div>
        <p class="lock-error" id="np-err"></p>
      </div>
      <div class="modal-actions"><button data-cancel>Abbrechen</button><button class="primary" data-save>${isChange?'Ändern':'Setzen'}</button></div>
    `, (body, close) => {
      body.querySelector('[data-cancel]').onclick = close;
      body.querySelector('[data-save]').onclick = async () => {
        const errEl = body.querySelector('#np-err'); errEl.textContent = '';
        const p = body.querySelector('#np').value;
        const p2 = body.querySelector('#np2').value;
        if(p.length < 4){ errEl.textContent = 'Mindestens 4 Zeichen'; return; }
        if(p !== p2){ errEl.textContent = 'PIN stimmt nicht überein'; return; }
        if(isChange){
          const cp = body.querySelector('#cp').value;
          try{ await unwrapMaster(loadMeta().pinEnvelope, cp); }
          catch{ errEl.textContent = 'Aktueller PIN falsch'; return; }
          // _masterKey ist bereits gesetzt (entsperrt) — Re-Wrap mit neuer PIN
          const newEnv = await wrapMaster(_masterKey, p);
          patchMeta({ pinEnvelope: newEnv, pinAttempts:0, pinLockedUntil:0 });
          close();
          Toast.success('PIN geändert');
        } else {
          // Erstmaliges Setup
          const code = await setupVault(p);
          // Backwards-compat: alten settings.pinHash auch füllen
          const { pinHash, pinSalt, pinIter } = await hashPin(p);
          Store.update(s => ({...s, settings:{...s.settings, pinHash, pinSalt, pinIter, pinAttempts:0, pinLockedUntil:0}}));
          close();
          showRecoveryCodeModal(code);
        }
      };
    });
  };
  const pinRm = root.querySelector('#pin-rm');
  if(pinRm) pinRm.onclick = () => confirmAlert('PIN entfernen — die App startet danach ohne Schutz. Belege werden wieder im Klartext gespeichert.', async () => {
    try{
      await removeVaultProtection();
      Store.update(s => ({...s, settings:{...s.settings, pinHash:null, pinSalt:null, pinIter:0, pinAttempts:0, pinLockedUntil:0}}));
      Toast.success('PIN-Schutz entfernt');
    }catch(e){ Toast.error('Fehler beim Entfernen: '+e.message); }
  });
  root.querySelector('#auto-lock').onchange = e => Store.update(s => ({...s, settings:{...s.settings, autoLockMinutes: Number(e.target.value)}}));

  root.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => Store.update(s => ({...s, settings:{...s.settings, colorScheme: b.dataset.theme}})));
  root.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => Store.update(s => ({...s, settings:{...s.settings, locale: b.dataset.lang}})));
  root.querySelectorAll('[data-font]').forEach(b => b.onclick = () => Store.update(s => ({...s, settings:{...s.settings, fontScale: b.dataset.font}})));

  root.querySelector('#bk-export').onclick = async () => {
    const r = await promptModal({
      title: 'Backup verschlüsseln',
      description: 'Wähle eine Passphrase (min. 8 Zeichen). Ohne sie lässt sich das Backup nicht wiederherstellen — bewahre sie sicher auf.',
      label: 'Passphrase',
      label2: 'Wiederholen',
      type: 'password',
      minLen: 8,
      confirmLabel: 'Backup erstellen',
    });
    if(!r) return;
    const pass = r.value;
    const st2 = Store.get();
    const receipts = await Promise.all(st2.receipts.map(async r => {
      const dataUri = await FilesDB.asDataURL(r.id);
      return {...r, dataUri};
    }));
    const snapshot = {...st2, receipts};
    delete snapshot.hydrated; delete snapshot.unlocked; delete snapshot.clipboardHint; delete snapshot._filterPropertyId;
    const payload = { app:'manu-web', createdAt: new Date().toISOString(), data: snapshot };
    const envelope = await encryptJson(payload, pass);
    const json = JSON.stringify(envelope);
    downloadBlob(json, `manu-backup-${todayIso()}.json`, 'application/json');
  };
  root.querySelector('#bk-import').onclick = async () => {
    const f = root.querySelector('#bk-file').files[0];
    if(!f){ Toast.info('Backup-Datei wählen'); return; }
    const text = await f.text();
    let parsed;
    try{ parsed = JSON.parse(text); }catch{ Toast.error('Backup ungültig: keine JSON-Datei'); return; }
    confirmAlert('Backup einspielen? Alle aktuellen Daten werden ersetzt.', async () => {
      let progress = null;
      try{
        let payload;
        if(parsed && parsed.v === 2 && parsed.ct){
          const r = await promptModal({
            title: 'Backup entschlüsseln',
            description: 'Gib die Passphrase ein, mit der das Backup erstellt wurde.',
            label: 'Passphrase',
            type: 'password',
            confirmLabel: 'Entschlüsseln',
          });
          if(!r) return;
          progress = openProgressModal('Backup wird wiederhergestellt', 'Entschlüssele Daten …');
          payload = await decryptJson(parsed, r.value);
        } else {
          progress = openProgressModal('Backup wird wiederhergestellt', 'Lese Daten …');
          payload = parsed;
        }
        const data = payload.data || payload;
        const receipts = data.receipts || [];
        let n = 0;
        for(const r of receipts){
          if(r.dataUri){
            n++;
            progress.update(`Beleg ${n} von ${receipts.length} wird gespeichert …`);
            const blob = await (await fetch(r.dataUri)).blob();
            await FilesDB.put(r.id, blob);
            delete r.dataUri;
          }
        }
        progress.update('Datenmodell wird übernommen …');
        Store.replace(data);
        progress.close(); progress = null;
        Toast.success('Backup eingespielt');
        fireConfetti(1100);
      }catch(e){
        if(progress) progress.close();
        Toast.error('Backup konnte nicht entschlüsselt werden. Falsche Passphrase oder beschädigte Datei.');
      }
    });
  };

  root.querySelector('#trash-open').onclick = () => {
    const st2 = Store.get();
    const html = st2.trash.length ? `<table class="data"><thead><tr><th>Typ</th><th>Beschreibung</th><th>Gelöscht am</th><th></th></tr></thead><tbody>${st2.trash.map(t => `
      <tr><td>${t.entityType}</td><td>${escapeHtml(t.payload?.label || t.payload?.name || t.payload?.counterparty || t.id)}</td><td class="muted">${fmtDate(t.deletedAt)}</td>
        <td class="right"><button data-restore="${t.id}">↩ Wiederherstellen</button> <button class="danger" data-purge="${t.id}">×</button></td></tr>`).join('')}</tbody></table>` : '<div class="muted">Papierkorb ist leer</div>';
    openModal('Papierkorb', html + '<div class="modal-actions"><button data-empty>Alles löschen</button><button data-close>Schließen</button></div>', (body, close) => {
      body.querySelector('[data-close]').onclick = close;
      body.querySelector('[data-empty]').onclick = () => confirmAlert('Papierkorb leeren?', () => Store.update(s => ({...s, trash:[]})));
      body.querySelectorAll('[data-restore]').forEach(b => b.onclick = () => restoreFromTrash(b.dataset.restore));
      body.querySelectorAll('[data-purge]').forEach(b => b.onclick = () => Store.update(s => ({...s, trash: s.trash.filter(t => t.id !== b.dataset.purge)})));
    });
  };
  root.querySelector('#trash-purge').onclick = () => {
    const cutoff = Date.now() - 30*86400000;
    let n = 0;
    Store.update(s => ({...s, trash: s.trash.filter(t => { const keep = new Date(t.deletedAt).getTime() >= cutoff; if(!keep) n++; return keep; })}));
    Toast.success(`${n} alte Einträge entfernt`);
  };

  root.querySelectorAll('[data-tax]').forEach(c => c.onchange = e => {
    const id = c.dataset.tax;
    Store.update(s => ({...s, categories: s.categories.map(x => x.id===id?{...x, taxRelevant: e.target.checked}:x)}));
  });
  root.querySelector('#cat-add').onclick = () => openSimpleEntityModal('Neue Kategorie', [
    {key:'label', label:'Bezeichnung'}, {key:'group', label:'Gruppe', type:'select', options:['neutral','moss','emerald','sage']}
  ], data => Store.update(s => ({...s, categories:[...s.categories, {id: uid('cat'), label: data.label, group: data.group, taxRelevant:false}]})));

  root.querySelector('#reset-all').onclick = () => confirmAlert('WIRKLICH alles löschen? Diese Aktion kann nicht rückgängig gemacht werden.', () => {
    Store.reset();
    sessionStorage.removeItem('manu.unlocked');
    location.reload();
  });
};
function restoreFromTrash(trashId){
  const st = Store.get();
  const t = st.trash.find(x => x.id === trashId);
  if(!t) return;
  const collectionMap = {booking:'bookings', tenant:'tenants', craftsman:'craftsmen', property:'properties', receipt:'receipts', document:'documents'};
  const key = collectionMap[t.entityType];
  if(!key) return;
  Store.update(s => ({...s, [key]: [...s[key], t.payload], trash: s.trash.filter(x => x.id !== trashId)}));
}

// ---- Lock Screen -----
function renderLockScreen(){
  const meta = loadMeta();
  const hasRecovery = !!(meta && meta.recoveryEnvelope);
  $('#view').innerHTML = `
    <div class="lock-screen">
      <div class="seal">M</div>
      <h1 class="serif">Manu</h1>
      <p>Bitte PIN eingeben, um den Tresor zu öffnen.</p>
      <div class="lock-form">
        <input id="lock-pin" type="password" inputmode="numeric" autofocus placeholder="••••" />
        <button class="primary" id="lock-go">Tresor öffnen</button>
        <p id="lock-err" class="lock-error"></p>
        ${hasRecovery ? '<button id="lock-recover" class="lock-link">PIN vergessen? Recovery-Code eingeben</button>' : ''}
      </div>
    </div>
  `;
  document.body.classList.remove('advisor');
  const goBtn = $('#lock-go');
  const errEl = $('#lock-err');
  let cooldownTimer = null;

  const currentLockState = () => {
    if(isEncrypted()){
      const m = loadMeta() || {};
      return { attempts: m.pinAttempts || 0, lockedUntil: m.pinLockedUntil || 0 };
    }
    const s = Store.get().settings;
    return { attempts: s.pinAttempts || 0, lockedUntil: s.pinLockedUntil || 0 };
  };

  const updateCooldown = () => {
    const { lockedUntil } = currentLockState();
    const left = lockedUntil - Date.now();
    if(left > 0){
      goBtn.disabled = true;
      $('#lock-pin').disabled = true;
      errEl.textContent = `Zu viele Fehlversuche. Bitte ${formatRemaining(left)} warten.`;
      cooldownTimer = setTimeout(updateCooldown, 1000);
    } else {
      goBtn.disabled = false;
      $('#lock-pin').disabled = false;
      if(cooldownTimer){ clearTimeout(cooldownTimer); cooldownTimer = null; }
    }
  };
  updateCooldown();

  const tryUnlock = async () => {
    const v = $('#lock-pin').value;
    if(currentLockState().lockedUntil > Date.now()){ updateCooldown(); return; }
    if(!v){ errEl.textContent = 'Bitte PIN eingeben'; return; }
    errEl.textContent = '';

    if(isEncrypted()){
      const r = await unlockWithPin(v);
      if(r.ok){ render(); return; }
      if(r.reason === 'pin'){
        $('#lock-pin').value = '';
        const m = loadMeta() || {};
        if(m.pinLockedUntil > Date.now()) updateCooldown();
        else errEl.textContent = `PIN falsch (${r.attempts}/5 vor Sperre)`;
      } else if(r.reason === 'locked'){
        updateCooldown();
      } else {
        errEl.textContent = 'Tresor-Fehler. Bitte App neu laden.';
      }
      return;
    }

    // Legacy-Pfad: alter PIN-Hash in settings, kein Envelope
    const settings = Store.get().settings;
    const { ok } = await verifyPin(v, settings);
    if(ok){
      // Legacy bestätigt → sofort auf Envelope-Modell migrieren + Recovery zeigen
      const code = await setupVault(v);
      Store.update(s => ({...s, settings:{...s.settings, pinAttempts:0, pinLockedUntil:0}}));
      showRecoveryCodeModal(code, () => render());
    } else {
      const attempts = (settings.pinAttempts || 0) + 1;
      const delay = lockoutDelayMs(attempts);
      const pinLockedUntil = delay > 0 ? Date.now() + delay : 0;
      Store.update(s => ({...s, settings:{...s.settings, pinAttempts: attempts, pinLockedUntil}}));
      $('#lock-pin').value = '';
      if(pinLockedUntil) updateCooldown();
      else errEl.textContent = `PIN falsch (${attempts}/5 vor Sperre)`;
    }
  };
  goBtn.onclick = tryUnlock;
  $('#lock-pin').onkeydown = e => { if(e.key === 'Enter') tryUnlock(); };

  const recoverBtn = $('#lock-recover');
  if(recoverBtn){
    recoverBtn.onclick = () => openRecoveryModal();
  }
}

function showRecoveryCodeModal(code, onClose){
  if(!code){ if(onClose) onClose(); return; }
  openModal('Notfall-Schlüssel', `
    <p>Schreibe diesen Code an einen sicheren Ort.
    Mit ihm — und nur mit ihm — kannst Du Deinen Tresor öffnen,
    wenn Du den PIN vergessen solltest. <strong>Ohne Code sind Deine Daten verloren.</strong></p>
    <div class="recovery-code">${escapeHtml(code)}</div>
    <label class="toggle"><input type="checkbox" id="rc-ack" /><span class="switch"></span><span>Ich habe den Code an einen sicheren Ort geschrieben.</span></label>
    <div class="modal-actions"><button class="primary" id="rc-done" disabled>Weiter</button></div>
  `, (body, close) => {
    body.querySelector('#rc-ack').onchange = (e) => {
      body.querySelector('#rc-done').disabled = !e.target.checked;
    };
    body.querySelector('#rc-done').onclick = () => {
      close();
      fireConfetti();
      Toast.success('Tresor eingerichtet · Daten verschlüsselt');
      if(onClose) onClose();
    };
  });
}

function openRecoveryModal(){
  openModal('PIN zurücksetzen', `
    <p>Gib Deinen 24-stelligen Recovery-Code ein und setze danach einen neuen PIN.</p>
    <div class="form">
      <div><label>Recovery-Code</label><input id="rc-input" placeholder="ABCD-EFGH-…" /></div>
      <div><label>Neuer PIN</label><input id="rc-pin" type="password" inputmode="numeric" /></div>
      <div><label>PIN wiederholen</label><input id="rc-pin2" type="password" inputmode="numeric" /></div>
      <p class="lock-error" id="rc-err"></p>
    </div>
    <div class="modal-actions"><button data-cancel>Abbrechen</button><button class="primary" id="rc-go">PIN setzen</button></div>
  `, (body, close) => {
    body.querySelector('[data-cancel]').onclick = close;
    body.querySelector('#rc-go').onclick = async () => {
      const code = body.querySelector('#rc-input').value;
      const pin = body.querySelector('#rc-pin').value;
      const pin2 = body.querySelector('#rc-pin2').value;
      const errEl = body.querySelector('#rc-err');
      errEl.textContent = '';
      if(pin.length < 4){ errEl.textContent = 'PIN min. 4 Zeichen'; return; }
      if(pin !== pin2){ errEl.textContent = 'PINs stimmen nicht überein'; return; }
      try{
        await recoverWithCode(code, pin);
        close();
        render();
      }catch(e){
        errEl.textContent = 'Recovery-Code ungültig oder beschädigt';
      }
    };
  });
}

// ============================================================
// ONBOARDING-WIZARD
// ============================================================
function setOnboardingStep(n){
  Store.update(s => ({...s, settings:{...s.settings, onboardingStep: n}}));
}
function renderOnboarding(){
  const st = Store.get();
  const step = st.settings.onboardingStep || 0;
  const view = $('#view');
  const dots = [0,1,2].map(i => `<div class="dot ${i===step?'active':''}"></div>`).join('');

  let body = '';
  if(step === 0){
    body = `
      <h1>Willkommen bei <span class="serif" style="font-style:italic">Manu</span></h1>
      <p class="lead">Dein lokaler Vermieter- und Finanz-Tresor. Daten bleiben auf Deinem Gerät — kein Server, keine Cloud.</p>
      <div class="form">
        <div>
          <label>Aussehen</label>
          <div class="row">
            ${[{k:'light',l:'Hell'},{k:'dark',l:'Dunkel'},{k:'auto',l:'Automatisch'}].map(t =>
              `<button class="${(st.settings.colorScheme||'light')===t.k?'primary':''}" data-ob-theme="${t.k}">${t.l}</button>`).join('')}
          </div>
        </div>
        <div>
          <label>Sprache</label>
          <div class="row">
            ${['de','en'].map(l => `<button class="${st.settings.locale===l?'primary':''}" data-ob-lang="${l}">${l==='de'?'Deutsch':'English'}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="ghost" data-ob-skip>Überspringen</button>
        <button class="primary" data-ob-next>Weiter</button>
      </div>
    `;
  } else if(step === 1){
    body = `
      <h1>Schutz einrichten</h1>
      <p class="lead">Setze einen PIN, damit niemand außer Dir Deine Daten sehen kann. Beim nächsten Schritt zeigen wir Dir einen einmaligen <strong>Recovery-Code</strong> als Notschlüssel.</p>
      <div class="form">
        <div><label>PIN (min. 4 Stellen)</label><input id="ob-pin" type="password" inputmode="numeric" autofocus /></div>
        <div><label>PIN wiederholen</label><input id="ob-pin2" type="password" inputmode="numeric" /></div>
        <p class="lock-error" id="ob-err"></p>
      </div>
      <div class="modal-actions">
        <button class="ghost" data-ob-skip-pin>Ohne PIN starten</button>
        <button class="primary" data-ob-set-pin>PIN setzen</button>
      </div>
    `;
  } else {
    body = `
      <h1>Erste Eiche pflanzen</h1>
      <p class="lead">Eine „Eiche" ist Dein Objekt — z. B. eine Wohnung oder ein Haus. Du kannst es auch später anlegen.</p>
      <div class="form">
        <div><label>Name / Adresse</label><input id="ob-prop-name" placeholder="z. B. Hauptstr. 12" autofocus /></div>
      </div>
      <div class="modal-actions">
        <button class="ghost" data-ob-finish>Später anlegen</button>
        <button class="primary" data-ob-add-prop>Eiche pflanzen</button>
      </div>
    `;
  }

  view.innerHTML = `
    <div class="onboarding">
      <div class="onboarding-card">
        <div class="step-dots">${dots}</div>
        ${body}
      </div>
    </div>
  `;
  document.documentElement.removeAttribute('data-theme');
  // Theme im Wizard schon anwenden
  const scheme = st.settings.colorScheme || 'light';
  if(scheme === 'dark' || scheme === 'auto') document.documentElement.setAttribute('data-theme', scheme);

  // Bindings
  view.querySelectorAll('[data-ob-theme]').forEach(b => b.onclick = () => {
    Store.update(s => ({...s, settings:{...s.settings, colorScheme:b.dataset.obTheme}}));
  });
  view.querySelectorAll('[data-ob-lang]').forEach(b => b.onclick = () => {
    Store.update(s => ({...s, settings:{...s.settings, locale:b.dataset.obLang}}));
  });
  const next = view.querySelector('[data-ob-next]');
  if(next) next.onclick = () => { setOnboardingStep(1); render(); };
  const skip = view.querySelector('[data-ob-skip]');
  if(skip) skip.onclick = () => { setOnboardingStep(2); render(); };

  const setPin = view.querySelector('[data-ob-set-pin]');
  if(setPin) setPin.onclick = async () => {
    const p = view.querySelector('#ob-pin').value;
    const p2 = view.querySelector('#ob-pin2').value;
    const err = view.querySelector('#ob-err'); err.textContent = '';
    if(p.length < 4){ err.textContent = 'Mindestens 4 Zeichen'; return; }
    if(p !== p2){ err.textContent = 'PINs stimmen nicht überein'; return; }
    setPin.disabled = true; setPin.textContent = 'Tresor wird eingerichtet …';
    try{
      const code = await setupVault(p);
      const { pinHash, pinSalt, pinIter } = await hashPin(p);
      Store.update(s => ({...s, settings:{...s.settings, pinHash, pinSalt, pinIter}}));
      showRecoveryCodeModal(code, () => { setOnboardingStep(2); render(); });
    }catch(e){
      err.textContent = 'Setup fehlgeschlagen: ' + (e && e.message ? e.message : e);
      setPin.disabled = false; setPin.textContent = 'PIN setzen';
    }
  };
  const skipPin = view.querySelector('[data-ob-skip-pin]');
  if(skipPin) skipPin.onclick = () => { setOnboardingStep(2); render(); };

  const finish = view.querySelector('[data-ob-finish]');
  if(finish) finish.onclick = () => {
    Store.update(s => ({...s, settings:{...s.settings, onboardingDone:true}}));
    setOnboardingStep(0);
    render();
  };
  const addProp = view.querySelector('[data-ob-add-prop]');
  if(addProp) addProp.onclick = () => {
    const name = (view.querySelector('#ob-prop-name').value || '').trim();
    if(!name){ finish.click(); return; }
    const property = {
      id: uid('prop'),
      name, color:'#4A7C59', address:'',
      wohnflaeche:null, anschaffungswert:null, afaSatz:null,
      createdAt: new Date().toISOString(),
    };
    Store.update(s => ({...s, properties:[...s.properties, property], settings:{...s.settings, onboardingDone:true}}));
    setOnboardingStep(0);
    render();
  };
}

// ============================================================
// EVENTS + BOOT
// ============================================================
$('#advisorToggle').onchange = (e) => {
  Store.update(s => ({...s, settings:{...s.settings, advisorMode: e.target.checked}}));
};

// =============================================================
// DRAG-AND-DROP für Belege
// =============================================================
async function ingestReceiptFiles(fileList){
  const accepted = ['image/', 'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const files = Array.from(fileList).filter(f => accepted.some(a => f.type.startsWith(a) || f.name.match(/\.(jpe?g|png|webp|heic|pdf|docx?)$/i)));
  if(!files.length){ Toast.info('Keine unterstützten Dateien'); return; }
  let n = 0;
  for(const f of files){
    const id = uid('rcp');
    await FilesDB.put(id, f);
    const parsed = parseFilename(f.name);
    Store.update(s => ({...s, receipts: [...s.receipts, {
      id, filename: f.name, size: f.size, mimeType: f.type,
      amount: parsed.amount, date: parsed.date, counterparty: parsed.counterparty, categoryId: parsed.categoryId || null,
      propertyId: null, bookingId: null, createdAt: new Date().toISOString(),
    }]}));
    n++;
  }
  render();
  Toast.success(`${n} Beleg${n===1?'':'e'} hinzugefügt`);
}
let _dragDepth = 0;
function setupDragDrop(){
  const overlay = document.createElement('div');
  overlay.className = 'drop-overlay';
  overlay.innerHTML = `
    <div class="drop-card">
      ${icon('upload','lg')}
      <h2>Beleg fallen lassen</h2>
      <p class="muted">PDF, JPG, PNG oder Word-Datei</p>
    </div>
  `;
  document.body.appendChild(overlay);
  window.addEventListener('dragenter', (e) => {
    if(!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    _dragDepth++;
    overlay.classList.add('active');
  });
  window.addEventListener('dragover', (e) => {
    if(!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
  });
  window.addEventListener('dragleave', (e) => {
    if(!e.dataTransfer) return;
    _dragDepth = Math.max(0, _dragDepth - 1);
    if(_dragDepth === 0) overlay.classList.remove('active');
  });
  window.addEventListener('drop', async (e) => {
    if(!e.dataTransfer || !e.dataTransfer.files?.length) return;
    e.preventDefault();
    _dragDepth = 0;
    overlay.classList.remove('active');
    await ingestReceiptFiles(e.dataTransfer.files);
  });
}
setupDragDrop();

// =============================================================
// Help-Hint-Tooltip (delegated)
// =============================================================
function setupHelpHints(){
  let tip = null;
  const hide = () => { tip?.remove(); tip = null; };
  const show = (el) => {
    hide();
    tip = document.createElement('div');
    tip.className = 'help-tip';
    tip.textContent = el.dataset.hint;
    document.body.appendChild(tip);
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = r.left + r.width/2 - tw/2;
    let top = r.bottom + 8;
    if(top + th > window.innerHeight - 12) top = r.top - th - 8;
    left = Math.max(8, Math.min(window.innerWidth - tw - 8, left));
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  };
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest?.('.help-hint');
    if(el) show(el);
  });
  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest?.('.help-hint');
    if(el) hide();
  });
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('.help-hint');
    if(el){ e.stopPropagation(); show(el); setTimeout(hide, 3500); }
    else hide();
  });
}
setupHelpHints();

// =============================================================
// Right-Click-Kontextmenü auf Buchungs-Zeilen
// =============================================================
function openBookingContextMenu(x, y, bookingId){
  document.querySelectorAll('.context-menu').forEach(el => el.remove());
  const b = Store.get().bookings.find(x => x.id === bookingId);
  if(!b) return;
  const cat = categoryById(b.categoryId);
  const taxLabel = cat?.taxRelevant ? '★ Steuerrelevant entfernen' : '★ Steuerrelevant markieren';
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <button data-act="edit">${icon('edit-2','sm')}<span>Bearbeiten</span></button>
    <button data-act="duplicate">${icon('copy','sm')}<span>Duplizieren</span></button>
    <button data-act="tax">${icon('star','sm')}<span>${taxLabel}</span></button>
    <div class="ctx-sep"></div>
    <button data-act="delete" class="danger">${icon('trash','sm')}<span>Löschen</span></button>
  `;
  document.body.appendChild(menu);
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = Math.min(x, window.innerWidth - mw - 8) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - mh - 8) + 'px';
  const close = () => { menu.remove(); document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
  const onDoc = (e) => { if(!menu.contains(e.target)) close(); };
  const onKey = (e) => { if(e.key === 'Escape') close(); };
  setTimeout(() => { document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey); }, 0);
  menu.querySelector('[data-act="edit"]').onclick = () => { close(); openBookingModal(b); };
  menu.querySelector('[data-act="duplicate"]').onclick = () => {
    close();
    const dup = {...b, id: uid('bkg'), createdAt: new Date().toISOString(), date: todayIso()};
    Store.update(s => ({...s, bookings: [...s.bookings, dup]}));
    render();
    Toast.success('Buchung dupliziert');
  };
  menu.querySelector('[data-act="tax"]').onclick = () => {
    close();
    if(!cat){ Toast.info('Keine Kategorie zum Markieren'); return; }
    Store.update(s => ({...s, categories: s.categories.map(c => c.id === cat.id ? {...c, taxRelevant: !c.taxRelevant} : c)}));
    render();
  };
  menu.querySelector('[data-act="delete"]').onclick = () => { close(); softDeleteBooking(b.id); };
}

// Such-Palette: Ctrl/Cmd+K + Topbar-Button
$('#search-trigger').onclick = () => openSearchPalette();

// Globale Tastatur-Shortcuts
const SHORTCUTS = [
  { key: 'Cmd/Ctrl + K', desc: 'Suche öffnen' },
  { key: '/', desc: 'Filter-Suche / Such-Palette' },
  { key: 'N', desc: 'Neue Buchung' },
  { key: '1 – 7', desc: 'Tab wechseln (Hauptsaal … Einstellungen)' },
  { key: 'Esc', desc: 'Modal schließen' },
  { key: '?', desc: 'Diese Hilfe anzeigen' },
];
function openShortcutHelp(){
  const html = `
    <div class="shortcut-grid">
      ${SHORTCUTS.map(s => `<div class="shortcut-row">
        <kbd>${escapeHtml(s.key)}</kbd>
        <span>${escapeHtml(s.desc)}</span>
      </div>`).join('')}
    </div>
    <p class="muted mt-md" style="font-size:12px">Shortcuts greifen nicht in Eingabefeldern.</p>
  `;
  openModal('Tastatur-Shortcuts', html);
}
function isTypingTarget(el){
  if(!el) return false;
  const tag = el.tagName;
  if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if(el.isContentEditable) return true;
  return false;
}
document.addEventListener('keydown', (e) => {
  if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    openSearchPalette();
    return;
  }
  // Esc schließt das oberste offene Modal
  if(e.key === 'Escape'){
    const overlay = document.querySelector('#modal-host .modal-overlay');
    if(overlay){
      const closeBtn = overlay.querySelector('[data-cancel],[data-close-sp],[data-overlay]');
      if(closeBtn) closeBtn.click();
      else document.getElementById('modal-host').innerHTML = '';
    }
    return;
  }
  if(isTypingTarget(e.target)) return;
  if(e.metaKey || e.ctrlKey || e.altKey) return;

  if(e.key === 'n' || e.key === 'N'){
    e.preventDefault(); openBookingModal(); return;
  }
  if(e.key === '/'){
    e.preventDefault();
    const fq = document.getElementById('f-q');
    if(fq){ fq.focus(); fq.select?.(); }
    else openSearchPalette();
    return;
  }
  if(e.key === '?'){
    e.preventDefault(); openShortcutHelp(); return;
  }
  if(/^[1-9]$/.test(e.key)){
    const idx = Number(e.key) - 1;
    if(idx < TABS.length){
      e.preventDefault();
      setTab(TABS[idx].id);
    }
  }
});

// Auto-Lock
let idleTimer = null;
function lockNow(){
  sessionStorage.removeItem('manu.unlocked');
  clearMasterKey();
  tap(30);
  render();
}
function isProtected(){
  return isEncrypted() || !!Store.get().settings.pinHash;
}
function resetIdle(){
  if(idleTimer) clearTimeout(idleTimer);
  const min = Store.get().settings.autoLockMinutes;
  if(!min || !isProtected()) return;
  idleTimer = setTimeout(lockNow, min * 60000);
}
['click','keydown','scroll','touchstart','mousemove'].forEach(ev => document.addEventListener(ev, resetIdle, {passive:true}));
document.addEventListener('visibilitychange', () => {
  if(document.hidden && isProtected()){
    sessionStorage.removeItem('manu.unlocked');
    clearMasterKey();
  } else if(!document.hidden){
    render();
  }
});

// Hash-Routing
window.addEventListener('hashchange', () => {
  const id = location.hash.replace('#/','') || 'dashboard';
  if(TABS.find(t => t.id === id)){
    Store.update(s => ({...s, settings:{...s.settings, activeTab:id}}));
    render();
  }
});

// Initial-Boot
const created = runAutoBookings();
if(location.hash.replace('#/','')){
  Store.update(s => ({...s, settings:{...s.settings, activeTab: location.hash.replace('#/','')}}));
}
render();
resetIdle();

// Globale API für Inline-Onclicks
window.Manu = { Store, render, FilesDB };

console.log('🌳 Manu Deep Jungle ist bereit. localStorage-Key: '+STORE_KEY);
