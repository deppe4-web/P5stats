(() => {
  'use strict';

  /* ============ Datos fijos ============ */
  const KEY = 'estrella.v1';

  const STATS = [
    { id: 'conocimiento', name: 'CONOCIMIENTO', short: 'CONOC.',
      hint: 'Estudiar, leer, cursos, practicar una habilidad nueva.' },
    { id: 'coraje', name: 'CORAJE', short: 'CORAJE',
      hint: 'Algo que te da miedo o pereza social: iniciar una charla, proponer un plan, opinar, ir solo a un lugar nuevo, exponerte (subir un video).' },
    { id: 'fisico', name: 'FÍSICO', short: 'FÍSICO',
      hint: 'Entrenar o moverte. Semana completa de gym sin fallar = 1 punto; una sesión suelta no pinta.' },
    { id: 'gentileza', name: 'GENTILEZA', short: 'GENTIL.',
      hint: 'Acciones concretas hacia otros: escuchar de verdad, ayudar, escribirle a alguien que lo está pasando mal.' },
    { id: 'encanto', name: 'ENCANTO', short: 'ENCANTO',
      hint: 'Presentación y habilidades sociales: arreglarte, contar bien una anécdota, curiosidad genuina, contacto visual.' }
  ];

  const SLOTS = [
    { id: 'm', label: 'MAÑANA' },
    { id: 't', label: 'TARDE' },
    { id: 'n', label: 'NOCHE' }
  ];

  // Arcanos (confidentes): catálogo en arcanos.js; estos son los 16 de la pizarra
  const ARCANA = window.ARCANA || [];
  const DEFAULT_ARC = ['priestess', 'empress', 'emperor', 'hierophant', 'lovers', 'chariot', 'hermit', 'fortune',
    'justice', 'hanged', 'death', 'temperance', 'devil', 'tower', 'star', 'sun'];
  // rayitas ya marcadas en la pizarra (base); los nombres se cargan a mano desde la app
  const ARC_PREFILL = { hierophant: { person: '', base: 5 }, justice: { person: '', base: 3 } };

  function defaultArcanos(prefill) {
    return DEFAULT_ARC.map((id) => {
      const p = prefill ? ARC_PREFILL[id] : null;
      return { id, person: p ? p.person : '', base: p ? p.base : 0, ticks: [] };
    });
  }

  // color de acento por nivel y color de texto que contrasta con él
  const LEVEL_THEME = [
    { accent: '#e60012', on: '#ffffff' },
    { accent: '#14c8ff', on: '#0a0a0a' },
    { accent: '#ffd400', on: '#0a0a0a' },
    { accent: '#b455ff', on: '#ffffff' },
    { accent: '#2ee66b', on: '#0a0a0a' }
  ];

  const DEFAULT_NEXT = 'Más exigente: cada punto tiene que ser algo que antes evitabas. Lo que ya es cómodo no cuenta.';

  const GATE_FAIL = {
    cost: () => ({
      why: 'No te costó nada. Si no incomoda, es mantenimiento, no progreso.',
      fix: 'Subile la vara: más tiempo, más exposición, o hacelo con alguien o frente a alguien. Si no, queda como rutina sin pintar.'
    }),
    auto: () => ({
      why: 'Piloto automático: lo hiciste dormido.',
      fix: 'Definí antes qué parte te va a costar y hacelo a propósito. Ahí sí cuenta.'
    }),
    week: () => ({
      why: 'Es demasiado grande: no se cierra en una semana.',
      fix: 'Partilo en un paso que puedas cerrar en 7 días y anotá ese paso.'
    }),
    harder: () => ({
      why: `Nivel ${state.level} pide más que lo anterior y esto ya lo dominabas.`,
      fix: 'Subí un escalón: más exposición, más duración, o algo que hasta ahora evitabas.'
    })
  };

  /* ============ Estado ============ */
  function blankState(prefill = true) {
    const zones = {};
    STATS.forEach((s) => { zones[s.id] = 0; });
    return {
      v: 2, level: 1, franjas: 10, zones, log: [], history: [], nextCriteria: DEFAULT_NEXT,
      arcMax: 10, arcanos: defaultArcanos(prefill)
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blankState();
      return normalize(JSON.parse(raw));
    } catch (e) {
      return blankState();
    }
  }

  function normalize(s) {
    const b = blankState();
    const out = Object.assign(b, s || {});
    out.zones = Object.assign(blankState().zones, (s && s.zones) || {});
    if (!Array.isArray(out.log)) out.log = [];
    if (!Array.isArray(out.history)) out.history = [];
    out.level = Math.max(1, parseInt(out.level, 10) || 1);
    out.franjas = Math.min(30, Math.max(3, parseInt(out.franjas, 10) || 10));
    if (typeof out.nextCriteria !== 'string' || !out.nextCriteria.trim()) out.nextCriteria = DEFAULT_NEXT;

    out.arcMax = Math.min(30, Math.max(3, parseInt(out.arcMax, 10) || 10));
    // datos viejos (sin arcanos) arrancan con los 16 de la pizarra
    if (!Array.isArray(s && s.arcanos)) out.arcanos = defaultArcanos(true);
    const seen = {};
    out.arcanos = out.arcanos
      .filter((a) => a && typeof a.id === 'string' && !seen[a.id] && (seen[a.id] = true) && (!ARCANA.length || ARCANA.some((x) => x.id === a.id)))
      .map((a) => ({
        id: a.id,
        person: String(a.person || '').slice(0, 30),
        base: Math.max(0, parseInt(a.base, 10) || 0),
        ticks: Array.isArray(a.ticks)
          ? a.ticks.filter((t) => t && t.date).map((t) => ({ date: String(t.date), note: String(t.note || '').slice(0, 160), ts: t.ts || 0 }))
          : []
      }));
    out.v = 2;
    return out;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* sin almacenamiento: sigue andando en memoria */ }
  }

  let state = load();
  let flash = null;        // {stat, from, to} para animar lo recién pintado
  let logFilter = 'all';
  let form = null;         // formulario del nuevo punto

  /* ============ Utilidades ============ */
  const $ = (sel, root = document) => root.querySelector(sel);

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === false || v == null) return;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    kids.flat(Infinity).forEach((c) => { if (c != null) n.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return n;
  }

  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const statById = (id) => STATS.find((s) => s.id === id);
  const slotLabel = (id) => (SLOTS.find((s) => s.id === id) || {}).label || '';
  const theme = () => LEVEL_THEME[(state.level - 1) % LEVEL_THEME.length];
  const usedToday = () => state.log.filter((e) => e.date === dateStr());

  function currentSlot() {
    const h = new Date().getHours();
    return h < 12 ? 'm' : h < 19 ? 't' : 'n';
  }

  function prettyDate(ds) {
    const [y, m, d] = ds.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const dias = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const hoy = ds === dateStr();
    return `${hoy ? 'HOY · ' : ''}${dias[dt.getDay()]} ${d} ${meses[m - 1]}`;
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* ============ Estrella (SVG) ============ */
  const RR = 0.42; // radio interno relativo de la estrella

  function pt(cx, cy, ang, rad) {
    return [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
  }

  function armPath(i, s, cx, cy, R) {
    const a = ((-90 + 72 * i) * Math.PI) / 180;
    const d36 = (36 * Math.PI) / 180;
    const T = pt(cx, cy, a, R * s);
    const L = pt(cx, cy, a - d36, R * RR * s);
    const Rp = pt(cx, cy, a + d36, R * RR * s);
    const f = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    return `M${cx},${cy} L${f(L)} L${f(T)} L${f(Rp)} Z`;
  }

  function outlinePath(cx, cy, R) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = ((-90 + 36 * i) * Math.PI) / 180;
      const p = pt(cx, cy, a, i % 2 === 0 ? R : R * RR);
      pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
    }
    return `M${pts.join(' L')} Z`;
  }

  function renderStar() {
    const N = state.franjas;
    const W = 420, H = 440, cx = 210, cy = 232, R = 138;
    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Estrella de stats">`;

    STATS.forEach((st, i) => {
      const filled = Math.min(state.zones[st.id], N);
      svg += `<g class="arm" data-stat="${st.id}">`;
      for (let k = N - 1; k >= 0; k--) {
        const on = k < filled;
        const fresh = flash && flash.stat === st.id && k >= flash.from && k < flash.to;
        svg += `<path class="band${on ? ' on' : ''}${fresh ? ' fresh' : ''}" d="${armPath(i, (k + 1) / N, cx, cy, R)}"/>`;
      }
      // etiqueta
      const a = ((-90 + 72 * i) * Math.PI) / 180;
      const lx = cx + Math.cos(a) * (R + 16);
      let ly = cy + Math.sin(a) * (R + 16);
      const c = Math.cos(a);
      const anchor = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle';
      if (i === 0) ly -= 14;
      else if (Math.sin(a) > 0.5) ly += 8;
      svg += `<text class="lbl-name" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}">${st.name}</text>`;
      svg += `<text class="lbl-count" x="${lx.toFixed(1)}" y="${(ly + 16).toFixed(1)}" text-anchor="${anchor}">${filled}/${N}</text>`;
      svg += '</g>';
    });

    svg += `<path class="star-outline" d="${outlinePath(cx, cy, R)}"/>`;
    svg += `<circle class="core-a" cx="${cx}" cy="${cy}" r="15"/><circle class="core-b" cx="${cx}" cy="${cy}" r="9.5"/><circle class="core-c" cx="${cx}" cy="${cy}" r="4.5"/>`;
    svg += '</svg>';
    $('#starWrap').innerHTML = svg;
    flash = null;
  }

  /* ============ Pantalla: inicio ============ */
  function renderHome() {
    const used = usedToday();
    $('#todayCount').textContent = `${used.length}/3`;

    const wrap = $('#slots');
    wrap.replaceChildren();
    const cur = currentSlot();
    SLOTS.forEach((sl) => {
      const e = used.find((x) => x.slot === sl.id);
      const val = e ? `${statById(e.stat).short}${e.value > 1 ? ' ×2' : ''}` : '—';
      wrap.append(el('div', { class: `slot${e ? ' used' : ''}${!e && sl.id === cur ? ' now' : ''}` },
        el('span', { class: 'slot-name' }, sl.label),
        el('span', { class: 'slot-val' }, val)));
    });

    let note;
    if (used.length >= 3) note = 'Tope del día. Mañana seguimos.';
    else if (used.length >= 1) note = 'Meta del día cumplida. Lo que sigue es bonus.';
    else note = 'Meta mínima: 1 punto. Un día en cero no borra nada.';
    $('#goalNote').textContent = note;
    $('#btnNew').disabled = used.length >= 3;
  }

  function renderHeader() {
    const t = theme();
    const root = document.documentElement.style;
    root.setProperty('--accent', t.accent);
    root.setProperty('--on-accent', t.on);
    $('#levelTag').textContent = `NIVEL ${state.level}`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#0a0a0a');
  }

  /* ============ Pantalla: historial ============ */
  function renderLog() {
    const chips = $('#logFilters');
    chips.replaceChildren();
    [{ id: 'all', short: 'TODOS' }, ...STATS].forEach((s) => {
      chips.append(el('button', {
        type: 'button', class: `chip${logFilter === s.id ? ' is-on' : ''}`,
        onclick: () => { logFilter = s.id; renderLog(); }
      }, s.short));
    });

    const list = $('#logList');
    list.replaceChildren();
    const rows = state.log.filter((e) => logFilter === 'all' || e.stat === logFilter).slice().reverse();
    if (!rows.length) {
      list.append(el('li', { class: 'empty' }, 'Todavía no hay nada acá. El primer punto es el que más cuesta.'));
      return;
    }
    let lastDay = '';
    rows.forEach((e) => {
      if (e.date !== lastDay) {
        lastDay = e.date;
        list.append(el('li', { class: 'log-day' }, prettyDate(e.date)));
      }
      list.append(el('li', { class: 'entry' },
        el('div', { class: 'entry-top' },
          el('span', { class: 'entry-stat' }, statById(e.stat).name),
          el('span', { class: 'entry-slot' }, `${slotLabel(e.slot)} · NIV ${e.level}`),
          el('span', { class: 'entry-plus' }, `+${e.value}`)),
        el('p', { class: 'entry-text' }, e.text)));
    });
  }

  /* ============ Pantalla: ajustes ============ */
  function renderSettings() {
    $('#cfgFranjas').value = state.franjas;
    $('#cfgArcMax').value = state.arcMax;
    $('#cfgCriteria').value = state.nextCriteria;
  }

  function renderAll() {
    renderHeader();
    renderStar();
    renderHome();
    renderLog();
    renderArcanos();
    renderSettings();
  }

  /* ============ Navegación ============ */
  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('is-active', v.id === `view-${name}`));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === name));
    $('main').scrollTop = 0;
    if (name === 'log') renderLog();
  }

  /* ============ Nuevo punto ============ */
  function gateDefs() {
    const g = [
      { id: 'cost', q: '¿Me costó algo? (esfuerzo, incomodidad, salir de la comodidad)', need: true },
      { id: 'auto', q: '¿Lo hice en piloto automático?', need: false },
      { id: 'week', q: '¿Lo cerré en una semana o menos? (si tomaría meses, hay que partirlo)', need: true }
    ];
    if (state.level >= 2) {
      g.push({ id: 'harder', q: `Nivel ${state.level}: ¿esto es más difícil que lo que ya hacía antes?`, need: true });
    }
    g.push({ id: 'special', q: '¿Es primera vez, algo escaso o un hito?', need: null });
    return g;
  }

  function newForm() { return { text: '', stat: null, slot: null, gates: {} }; }

  function buildStatPick() {
    const wrap = $('#fStats');
    wrap.replaceChildren();
    STATS.forEach((s) => {
      const full = state.zones[s.id] >= state.franjas;
      wrap.append(el('button', {
        type: 'button', 'data-id': s.id, disabled: full,
        class: form.stat === s.id ? 'is-on' : '',
        onclick: () => { form.stat = s.id; buildStatPick(); $('#fHint').textContent = s.hint; updateEvalBtn(); }
      }, s.short));
    });
  }

  function buildSlotPick() {
    const used = usedToday().map((e) => e.slot);
    const wrap = $('#fSlots');
    wrap.replaceChildren();
    SLOTS.forEach((s) => {
      wrap.append(el('button', {
        type: 'button', disabled: used.includes(s.id),
        class: form.slot === s.id ? 'is-on' : '',
        onclick: () => { form.slot = s.id; buildSlotPick(); updateEvalBtn(); }
      }, s.label));
    });
  }

  function buildGates() {
    const wrap = $('#fGates');
    wrap.replaceChildren();
    gateDefs().forEach((g) => {
      const mk = (val, label) => el('button', {
        type: 'button', class: 'seg-btn', 'data-v': String(val),
        onclick: () => { form.gates[g.id] = val; refreshGates(); updateEvalBtn(); }
      }, label);
      wrap.append(el('div', { class: 'gate', 'data-gate': g.id },
        el('p', { class: 'gate-q' }, g.q),
        el('div', { class: 'seg' }, mk(true, 'SÍ'), mk(false, 'NO'))));
    });
  }

  function refreshGates() {
    document.querySelectorAll('#fGates .gate').forEach((row) => {
      const id = row.dataset.gate;
      row.querySelectorAll('.seg-btn').forEach((b) => {
        b.classList.toggle('is-on', String(form.gates[id]) === b.dataset.v);
      });
    });
  }

  function updateEvalBtn() {
    const allAnswered = gateDefs().every((g) => form.gates[g.id] === true || form.gates[g.id] === false);
    const ok = form.text.trim().length >= 4 && form.stat && form.slot && allAnswered;
    $('#btnEval').disabled = !ok;
  }

  function openSheet() {
    const used = usedToday().map((e) => e.slot);
    if (used.length >= 3) { toast('Ya pintaste las 3 franjas de hoy.'); return; }
    form = newForm();
    const cur = currentSlot();
    form.slot = !used.includes(cur) ? cur : (SLOTS.find((s) => !used.includes(s.id)) || {}).id;
    $('#fText').value = '';
    $('#fHint').textContent = '';
    buildStatPick();
    buildSlotPick();
    buildGates();
    $('#sheetForm').hidden = false;
    $('#sheetVerdict').hidden = true;
    $('#sheet').hidden = false;
    updateEvalBtn();
  }

  function closeSheet() { $('#sheet').hidden = true; }

  function evaluate() {
    const stat = statById(form.stat);
    const text = form.text.trim();
    const items = [];
    const notes = [];

    if (usedToday().length >= 3) {
      items.push({ why: 'Ya pintaste las 3 franjas de hoy.', fix: 'Tope del día. Guardalo para mañana.' });
    }
    if (state.zones[stat.id] >= state.franjas) {
      items.push({ why: `La zona ${stat.name} ya está llena.`, fix: 'Pintá otra zona: la estrella se completa pareja.' });
    }
    gateDefs().forEach((g) => {
      if (g.need !== null && form.gates[g.id] !== g.need) items.push(GATE_FAIL[g.id](stat));
    });
    if (stat.id === 'fisico' && /gym|gimnasio/i.test(text) && !/semana/i.test(text)) {
      items.push({
        why: 'Una sesión suelta de gym no pinta: ya es rutina.',
        fix: 'El punto de gym es una semana completa sin fallar: anotalo al cerrarla. O sumá algo fuera de rutina (caminata larga, rutina nueva).'
      });
    }
    if (items.length) return { ok: false, items };

    let value = 1;
    if (form.gates.special === true) {
      const norm = (t) => t.toLowerCase().replace(/\s+/g, ' ').trim();
      const repeated = state.log.some((e) => norm(e.text) === norm(text));
      if (repeated) {
        notes.push('Decís que es primera vez, pero ya lo anotaste antes: vale una franja normal.');
      } else {
        value = 2;
        notes.push('Primera vez o hito: doble franja.');
      }
    }
    const room = state.franjas - state.zones[stat.id];
    const n = Math.min(value, room);
    if (n < value) notes.push('Solo quedaba lugar para una franja en esta zona.');
    return { ok: true, n, notes, stat, text };
  }

  function showVerdict() {
    const res = evaluate();
    const box = $('#sheetVerdict');
    box.replaceChildren();

    if (res.ok) {
      box.append(el('div', { class: 'verdict ok' },
        el('div', { class: 'v-word' }, 'CUENTA'),
        el('p', { class: 'v-line' }, `+${res.n} franja${res.n > 1 ? 's' : ''} de ${res.stat.name}`),
        res.notes.map((n) => el('p', { class: 'v-note' }, n)),
        el('div', { class: 'v-actions' },
          el('button', { class: 'btn-main', type: 'button', onclick: () => commit(res) }, el('span', {}, 'PINTAR')),
          el('button', { class: 'btn-main dark', type: 'button', onclick: backToForm }, el('span', {}, 'VOLVER')))));
    } else {
      box.append(el('div', { class: 'verdict no' },
        el('div', { class: 'v-word' }, 'NO CUENTA'),
        res.items.map((it) => [
          el('p', { class: 'v-why' }, it.why),
          el('p', { class: 'v-fix' }, it.fix)
        ]),
        el('div', { class: 'v-actions' },
          el('button', { class: 'btn-main', type: 'button', onclick: backToForm }, el('span', {}, 'AJUSTAR')))));
    }
    $('#sheetForm').hidden = true;
    box.hidden = false;
    $('.sheet-inner').scrollTop = 0;
  }

  function backToForm() {
    $('#sheetVerdict').hidden = true;
    $('#sheetForm').hidden = false;
  }

  function commit(res) {
    const sid = res.stat.id;
    const from = state.zones[sid];
    state.zones[sid] = from + res.n;
    state.log.push({
      id: Date.now().toString(36), date: dateStr(), slot: form.slot, stat: sid,
      text: res.text, value: res.n, level: state.level, ts: Date.now()
    });
    flash = { stat: sid, from, to: from + res.n };
    save();
    closeSheet();
    renderAll();
    showView('home');
    if (navigator.vibrate) navigator.vibrate(40);
    toast(`+${res.n} ${res.stat.name}`);
    checkLevelUp();
  }

  /* ============ Nivel siguiente ============ */
  function isComplete() {
    return STATS.every((s) => state.zones[s.id] >= state.franjas);
  }

  function checkLevelUp() {
    if (isComplete()) showLevelUp();
  }

  function showLevelUp() {
    const next = state.level + 1;
    const nt = LEVEL_THEME[(next - 1) % LEVEL_THEME.length];
    const ov = $('#overlay');
    ov.style.background = nt.accent;
    ov.style.color = nt.on;
    ov.replaceChildren(el('div', { class: 'lvlup' },
      el('p', { class: 'lvlup-k' }, 'ESTRELLA COMPLETA'),
      el('h2', { class: 'lvlup-big' }, `NIVEL ${next}`),
      el('p', { class: 'lvlup-t' }, 'Cambia el color y sube la vara:'),
      el('p', { class: 'lvlup-c' }, state.nextCriteria),
      el('button', {
        class: 'btn-main', type: 'button',
        onclick: () => {
          state.history.push({ level: state.level, ts: Date.now() });
          state.level = next;
          STATS.forEach((s) => { state.zones[s.id] = 0; });
          save();
          ov.hidden = true;
          flash = null;
          renderAll();
          showView('home');
        }
      }, el('span', {}, `PASAR A NIVEL ${next}`))));
    ov.hidden = false;
  }

  /* ============ Respaldo ============ */
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `estrella-respaldo-${dateStr()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Respaldo descargado');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object' || !data.zones || !Array.isArray(data.log)) throw new Error('formato');
        if (!window.confirm('Esto reemplaza todo lo que tenés ahora. ¿Seguimos?')) return;
        state = normalize(data);
        save();
        renderAll();
        showView('home');
        toast('Respaldo importado');
        checkLevelUp();
      } catch (e) {
        toast('Ese archivo no sirve');
      }
    };
    reader.readAsText(file);
  }

  /* ============ Arcanos (confidentes) ============ */
  const arcInfo = (id) => ARCANA.find((x) => x.id === id);
  const arcState = (id) => state.arcanos.find((a) => a.id === id);
  const arcCount = (a) => (a.base || 0) + a.ticks.length;
  const emblemSVG = (info) => `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${info.draw()}</svg>`;

  // rayitas: grupos de 5 (cuatro palitos y el tachón)
  function tallySVG(n) {
    if (n <= 0) return '<svg class="tally" viewBox="0 0 34 34" aria-label="sin rayitas"><path d="M6 17 L28 17" stroke="currentColor" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round"/></svg>';
    const groups = Math.ceil(n / 5);
    let s = `<svg class="tally" viewBox="0 0 ${groups * 34} 34" role="img" aria-label="${n} rayitas">`;
    for (let g = 0; g < groups; g++) {
      const x0 = g * 34;
      const cnt = Math.min(5, n - g * 5);
      for (let i = 0; i < Math.min(cnt, 4); i++) {
        const x = x0 + 5 + i * 7;
        s += `<path d="M${x} 4 L${x} 30" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>`;
      }
      if (cnt === 5) s += `<path d="M${x0 + 2} 27 L${x0 + 31} 7" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>`;
    }
    return s + '</svg>';
  }

  function renderArcanos() {
    const grid = $('#arcGrid');
    grid.replaceChildren();
    const rows = state.arcanos
      .map((a) => ({ a, info: arcInfo(a.id) }))
      .filter((r) => r.info)
      .sort((x, y) => x.info.num - y.info.num);
    if (!rows.length) grid.append(el('p', { class: 'empty' }, 'No hay arcanos. Agregá uno abajo.'));

    const max = state.arcMax;
    rows.forEach(({ a, info }) => {
      const n = arcCount(a);
      const done = n >= max;
      const em = el('span', { class: 'arc-em' });
      em.innerHTML = emblemSVG(info);
      grid.append(el('button', {
        type: 'button',
        class: `arc-card${n === 0 ? ' unmet' : ''}${done ? ' done' : ''}`,
        'aria-label': `${info.name}${a.person ? ', ' + a.person : ''}, ${n} de ${max}`,
        onclick: () => openArc(a.id)
      },
      el('span', { class: 'arc-roman' }, info.roman),
      em,
      el('span', { class: 'arc-name' }, info.name.toUpperCase()),
      el('span', { class: 'arc-person' }, a.person || 'sin asignar'),
      el('span', { class: 'arc-bar' }, el('i', { style: `width:${Math.min(100, (n / max) * 100)}%` })),
      el('span', { class: 'arc-n' }, done ? 'COMPLETO' : `${n}/${max}`)));
    });

    const left = ARCANA.filter((x) => !state.arcanos.some((a) => a.id === x.id));
    $('#btnArcAdd').hidden = !left.length;
    const known = state.arcanos.filter((a) => arcCount(a) > 0).length;
    const full = state.arcanos.filter((a) => arcCount(a) >= max).length;
    $('#arcSummary').textContent = `${known}/${state.arcanos.length} conocidos · ${full} completos`;
  }

  let arcOpen = null;
  let arcForm = { note: '', real: undefined, auto: undefined };

  function openArc(id) {
    arcOpen = id;
    arcForm = { note: '', real: undefined, auto: undefined };
    renderArcSheet();
    $('#arcSheet').hidden = false;
    $('.sheet-inner', $('#arcSheet')).scrollTop = 0;
  }

  function closeArc() {
    $('#arcSheet').hidden = true;
    arcOpen = null;
  }

  function verdictBox(ok, title, lines, items) {
    return el('div', { class: `verdict ${ok ? 'ok' : 'no'}` },
      el('div', { class: 'v-word' }, title),
      (lines || []).map((t) => el('p', { class: 'v-line' }, t)),
      (items || []).map((it) => [el('p', { class: 'v-why' }, it.why), el('p', { class: 'v-fix' }, it.fix)]));
  }

  function renderArcSheet(okMsg) {
    const a = arcState(arcOpen);
    const info = arcInfo(arcOpen);
    if (!a || !info) { closeArc(); return; }
    const n = arcCount(a);
    const max = state.arcMax;
    const done = n >= max;
    const body = $('#arcBody');
    body.replaceChildren();

    const mini = el('div', { class: 'arc-mini' });
    mini.innerHTML = emblemSVG(info);
    body.append(el('div', { class: 'arc-head' }, mini,
      el('div', { class: 'arc-title' }, el('small', {}, info.roman), info.name.toUpperCase())));

    // persona
    const person = el('input', { type: 'text', maxlength: '30', placeholder: '¿Quién es?', value: a.person, 'aria-label': 'Persona' });
    person.addEventListener('change', () => { a.person = person.value.trim(); save(); renderArcanos(); });
    body.append(el('span', { class: 'lbl' }, 'PERSONA'), person);

    // rango
    const tally = el('div', { class: 'tally-wrap' });
    tally.innerHTML = tallySVG(n);
    body.append(el('p', { class: 'rank-line' }, 'RANGO ', el('b', {}, `${Math.min(n, max)}/${max}`)), tally);
    if (a.base) body.append(el('p', { class: 'tally-note' }, `Incluye ${a.base} rayita${a.base > 1 ? 's' : ''} que ya tenías en la pizarra.`));
    if (done) body.append(el('div', { class: 'arc-full' }, 'ARCANO COMPLETO'));

    // nueva rayita
    if (!done) {
      const note = el('textarea', { rows: '2', maxlength: '160', placeholder: 'Qué hicieron, de qué hablaron, qué pasó.', 'aria-label': 'Qué pasó' });
      note.value = arcForm.note;
      note.addEventListener('input', () => { arcForm.note = note.value; refreshBtn(); });

      const mkGate = (key, q) => {
        const row = el('div', { class: 'gate' }, el('p', { class: 'gate-q' }, q));
        const seg = el('div', { class: 'seg' });
        [[true, 'SÍ'], [false, 'NO']].forEach(([val, label]) => {
          const b = el('button', { type: 'button', class: 'seg-btn' }, label);
          if (arcForm[key] === val) b.classList.add('is-on');
          b.addEventListener('click', () => {
            arcForm[key] = val;
            seg.querySelectorAll('.seg-btn').forEach((x) => x.classList.remove('is-on'));
            b.classList.add('is-on');
            refreshBtn();
          });
          seg.append(b);
        });
        row.append(seg);
        return row;
      };

      const btn = el('button', { class: 'btn-main', type: 'button', onclick: submitTick }, el('span', {}, 'ANOTAR RAYITA'));
      const refreshBtn = () => {
        btn.disabled = !(arcForm.note.trim().length >= 4 && typeof arcForm.real === 'boolean' && typeof arcForm.auto === 'boolean');
      };

      body.append(
        el('span', { class: 'lbl' }, 'NUEVA RAYITA'), note,
        el('span', { class: 'lbl' }, 'SÉ HONESTO'),
        mkGate('real', '¿Fue tiempo real con esa persona (en persona, llamada o charla de verdad), no solo un like o un mensaje al pasar?'),
        mkGate('auto', '¿Estuve a medias, en piloto automático (celu en la mano, cabeza en otra parte)?'),
        btn);
      refreshBtn();
    }

    body.append(el('div', { id: 'arcVerdict' }));
    if (okMsg) $('#arcVerdict').append(verdictBox(true, 'CUENTA', [okMsg]));

    // historial del arcano
    if (a.ticks.length) {
      body.append(el('span', { class: 'lbl' }, 'MOMENTOS'));
      const ul = el('ul', { class: 'arc-hist' });
      a.ticks.slice().reverse().forEach((t) => {
        ul.append(el('li', {}, el('span', { class: 'd' }, prettyDate(t.date)), t.note));
      });
      body.append(ul);
    }

    body.append(el('button', {
      class: 'btn-sm btn-red', type: 'button',
      onclick: () => {
        if (!window.confirm(`¿Quitar el arcano ${info.name}? Se pierden sus rayitas.`)) return;
        state.arcanos = state.arcanos.filter((x) => x.id !== a.id);
        save();
        closeArc();
        renderArcanos();
        toast(`${info.name} quitado`);
      }
    }, 'QUITAR ARCANO'));
  }

  function submitTick() {
    const a = arcState(arcOpen);
    const info = arcInfo(arcOpen);
    if (!a || !info) return;
    const items = [];
    if (arcCount(a) >= state.arcMax) {
      items.push({ why: 'Este arcano ya está completo.', fix: 'La barra está llena. Dedicale ese tiempo a otro arcano.' });
    }
    if (!a.person.trim()) {
      items.push({ why: 'No dijiste con quién.', fix: 'Poné el nombre de la persona arriba y volvé a intentar.' });
    }
    if (a.ticks.some((t) => t.date === dateStr())) {
      items.push({ why: 'Ya anotaste una rayita hoy con este arcano.', fix: 'Una por día. Mañana otra, si hay un momento real.' });
    }
    if (arcForm.real !== true) {
      items.push({ why: 'No fue tiempo real con esa persona.', fix: 'Un like o un "jaja" no cuenta. Escribile algo de verdad, llamala o juntate, y ahí sí lo anotás.' });
    }
    if (arcForm.auto !== false) {
      items.push({ why: 'Estabas a medias: celu en mano, cabeza en otra parte.', fix: 'Repetilo con atención completa, aunque sean diez minutos, y ahí cuenta.' });
    }

    if (items.length) {
      const box = $('#arcVerdict');
      box.replaceChildren(verdictBox(false, 'NO CUENTA', [], items));
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    a.ticks.push({ date: dateStr(), note: arcForm.note.trim(), ts: Date.now() });
    save();
    arcForm = { note: '', real: undefined, auto: undefined };
    const n = arcCount(a);
    renderArcanos();
    renderArcSheet(`+1 rayita con ${a.person}. Rango ${Math.min(n, state.arcMax)}/${state.arcMax}.`);
    $('#arcVerdict').scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (navigator.vibrate) navigator.vibrate(40);
    if (n >= state.arcMax) toast(`${info.name} COMPLETO`);
    else toast(`+1 ${info.name.toUpperCase()}`);
  }

  function openArcPicker() {
    const left = ARCANA.filter((x) => !state.arcanos.some((a) => a.id === x.id)).sort((x, y) => x.num - y.num);
    if (!left.length) return;
    arcOpen = null;
    const body = $('#arcBody');
    body.replaceChildren(
      el('h2', { class: 'h-slant dark' }, el('span', {}, 'AGREGAR')),
      el('p', { class: 'muted' }, 'Elegí el arcano de la persona que querés sumar.'),
      el('div', { class: 'picker' }, left.map((x) => el('button', {
        type: 'button',
        onclick: () => {
          state.arcanos.push({ id: x.id, person: '', base: 0, ticks: [] });
          save();
          renderArcanos();
          openArc(x.id);
        }
      }, el('small', {}, x.roman), x.name.toUpperCase()))));
    $('#arcSheet').hidden = false;
    $('.sheet-inner', $('#arcSheet')).scrollTop = 0;
  }

  /* ============ Eventos ============ */
  function bind() {
    $('#arcClose').addEventListener('click', closeArc);
    $('#arcSheet').addEventListener('click', (e) => { if (e.target.id === 'arcSheet') closeArc(); });
    $('#btnArcAdd').addEventListener('click', openArcPicker);
    $('#cfgArcMax').addEventListener('change', (e) => {
      state.arcMax = Math.min(30, Math.max(3, parseInt(e.target.value, 10) || state.arcMax));
      save();
      renderArcanos();
      renderSettings();
    });

    $('#btnNew').addEventListener('click', openSheet);
    $('#sheetClose').addEventListener('click', closeSheet);
    $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
    $('#btnEval').addEventListener('click', showVerdict);
    $('#fText').addEventListener('input', (e) => { form.text = e.target.value; updateEvalBtn(); });

    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

    $('#starWrap').addEventListener('click', (e) => {
      const g = e.target.closest('.arm');
      if (!g) return;
      const st = statById(g.dataset.stat);
      $('#starInfo').textContent = `${st.name} (${Math.min(state.zones[st.id], state.franjas)}/${state.franjas}): ${st.hint}`;
    });

    $('#cfgFranjas').addEventListener('change', (e) => {
      const v = Math.min(30, Math.max(3, parseInt(e.target.value, 10) || state.franjas));
      state.franjas = v;
      STATS.forEach((s) => { state.zones[s.id] = Math.min(state.zones[s.id], v); });
      save();
      renderAll();
      checkLevelUp();
    });
    $('#cfgCriteria').addEventListener('change', (e) => {
      state.nextCriteria = e.target.value.trim() || DEFAULT_NEXT;
      save();
    });

    $('#btnExport').addEventListener('click', exportData);
    $('#btnImport').addEventListener('click', () => $('#fileImport').click());
    $('#fileImport').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importData(f);
      e.target.value = '';
    });
    $('#btnReset').addEventListener('click', () => {
      if (!window.confirm('Se borra TODO: estrella, historial y nivel. ¿Seguro?')) return;
      if (!window.confirm('Última: esto no se puede deshacer.')) return;
      state = blankState(false);
      save();
      renderAll();
      showView('home');
      toast('Todo en cero');
    });

    // instalar
    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      $('#btnInstall').hidden = false;
    });
    $('#btnInstall').addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      try { await deferred.userChoice; } catch (err) { /* ignorar */ }
      deferred = null;
      $('#btnInstall').hidden = true;
    });
    window.addEventListener('appinstalled', () => { $('#btnInstall').hidden = true; toast('Instalada'); });

    // si cambia el día con la app abierta
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { renderHome(); }
    });
  }

  /* ============ Arranque ============ */
  bind();
  renderAll();
  checkLevelUp();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* sin offline, pero funciona */ });
    });
  }
})();
