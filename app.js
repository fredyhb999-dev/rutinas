"use strict";
/* RUTINAS · aplicación */
(() => {

const $ = (sel, raiz) => (raiz || document).querySelector(sel);
const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];
const DIAS_LARGOS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const COLORES = ["#c6ff3d", "#ff7a3d", "#3ddcff", "#ff4d7e", "#b78bff", "#ffd23d"];
const CLAVE_SNAPSHOT = "rutinas-snapshot";

const estado = {
  config: Object.assign({}, CONFIG_DEFECTO),
  ejercicios: [],
  planes: [],
  semana: { clave: CLAVE_SEMANA },
  historial: [],
  tab: "ejercicios",
  planId: null,
  borradorEj: null,
  planBorrador: null,
  hojaTipo: null,
  fotoEditando: null
};

const urlsBlob = new Map();
function urlBlob(blob) {
  if (!blob) return null;
  if (urlsBlob.has(blob)) return urlsBlob.get(blob);
  const url = URL.createObjectURL(blob);
  urlsBlob.set(blob, url);
  return url;
}

/* ---------------- utilidades ---------------- */

function esc(t) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function fmtTiempo(seg) {
  seg = Math.max(0, Math.round(seg));
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m + ":" + String(s).padStart(2, "0");
}

function fmtDuracion(seg) {
  seg = Math.max(0, Math.round(seg));
  if (seg < 60) return seg + " s";
  const m = Math.round(seg / 60);
  if (m < 60) return m + " min";
  const h = Math.floor(m / 60);
  const resto = m % 60;
  return h + " h" + (resto ? " " + resto + " min" : "");
}

function claveHoy() {
  const d = new Date().getDay();
  return DIAS[(d + 6) % 7];
}

function fechaClave(dt) {
  const d = dt || new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + dia;
}

function ejercicioPorId(id) { return estado.ejercicios.find(e => e.id === id) || null; }
function planPorId(id) { return estado.planes.find(p => p.id === id) || null; }
function nombrePlan(id) {
  const p = planPorId(id);
  return p ? p.nombre : "Descanso";
}

function vibrar(patron) {
  if (estado.config.vibracion && navigator.vibrate) {
    try { navigator.vibrate(patron); } catch (e) {}
  }
}

let avisoTimer = 0;
function aviso(texto) {
  const el = $("#toast");
  el.textContent = texto;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("visible"));
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => {
    el.classList.remove("visible");
    setTimeout(() => { el.hidden = true; }, 220);
  }, 1900);
}

function mostrar(pantalla) {
  $$(".pantalla").forEach(p => {
    p.classList.toggle("activa", p.dataset.pantalla === pantalla);
  });
  const activa = $(".pantalla.activa .contenido");
  if (activa) activa.scrollTop = 0;
}
/* ---------------- carga ---------------- */

async function cargarTodo() {
  await abrirDB();
  await sembrarSiHaceFalta();

  const res = await Promise.all([
    dbUno("ajustes", CLAVE_CONFIG),
    dbTodos("ejercicios"),
    dbTodos("planes"),
    dbUno("semana", CLAVE_SEMANA),
    dbTodos("historial")
  ]);

  estado.config = Object.assign({}, CONFIG_DEFECTO, res[0] || {});
  estado.ejercicios = res[1].sort((a, b) => (a.orden || 99) - (b.orden || 99) || String(a.nombre).localeCompare(String(b.nombre)));
  estado.planes = res[2].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
  estado.semana = res[3] || { clave: CLAVE_SEMANA };
  estado.historial = res[4].sort((a, b) => b.fecha - a.fecha);

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

async function guardarConfig() { await dbGuardar("ajustes", estado.config); }
async function guardarSemana() { await dbGuardar("semana", estado.semana); }

/* ---------------- cálculos ---------------- */

function esDescanso(ej) { return ej && ej.tipo === "descanso"; }

function duracionEntrada(ent, ej, esUltima) {
  if (!ej) return 0;
  if (esDescanso(ej)) return Math.max(1, Number(ent.segundos) || Number(ej.segundos) || 60);
  const reps = Math.max(1, Number(ent.reps) || 1);
  const ciclo = reps * (Number(ent.bajadaSeg) + Number(ent.subidaSeg));
  const descanso = esUltima ? 0 : Math.max(0, Number(ent.descansoSeg) || 0);
  return ciclo + descanso;
}

function estimarPlan(plan) {
  if (!plan || !plan.entradas) return 0;
  let total = 0;
  plan.entradas.forEach((ent, i) => {
    const ej = ejercicioPorId(ent.ejercicioId);
    total += duracionEntrada(ent, ej, i === plan.entradas.length - 1);
    if (ej && !esDescanso(ej)) total += estado.config.prepSeg;
  });
  return total;
}

function contarSeries(plan) {
  if (!plan) return 0;
  return plan.entradas.filter(e => {
    const ej = ejercicioPorId(e.ejercicioId);
    return ej && !esDescanso(ej);
  }).length;
}

function contarReps(plan) {
  if (!plan) return 0;
  return plan.entradas.reduce((acc, e) => {
    const ej = ejercicioPorId(e.ejercicioId);
    return acc + (ej && !esDescanso(ej) ? (Number(e.reps) || 0) : 0);
  }, 0);
}

function calcularRacha() {
  const dias = new Set(estado.historial.map(h => h.fechaClave));
  let racha = 0;
  const d = new Date();
  if (!dias.has(fechaClave(d))) d.setDate(d.getDate() - 1);
  while (dias.has(fechaClave(d))) {
    racha++;
    d.setDate(d.getDate() - 1);
  }
  return racha;
}

function historialDelDia(clave) {
  return estado.historial.filter(h => h.fechaClave === clave);
}

/* ---------------- inicio ---------------- */

function pintarInicio() {
  const hora = new Date().getHours();
  $("#saludo-texto").textContent = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const hoy = claveHoy();
  const fecha = new Date();
  $("#saludo-sub").textContent = DIAS_LARGOS[DIAS.indexOf(hoy)] + " " + fecha.getDate() + " · a entrenar";

  const racha = calcularRacha();
  const chip = $("#chip-racha");
  if (racha > 0) {
    chip.hidden = false;
    chip.textContent = "🔥 " + racha;
  } else {
    chip.hidden = true;
  }

  const plan = planPorId(estado.semana[hoy]);
  $("#hoy-etiqueta").textContent = DIAS_LARGOS[DIAS.indexOf(hoy)].toUpperCase();
  $("#hoy-punto").style.background = plan ? plan.color : "#3a4356";
  $("#hoy-punto").style.color = plan ? plan.color : "#3a4356";

  if (plan) {
    $("#hoy-nombre").textContent = plan.nombre;
    const sets = contarSeries(plan);
    $("#hoy-meta").textContent = sets + " series · " + fmtDuracion(estimarPlan(plan)) + " · " + contarReps(plan) + " reps";
    $("#btn-comenzar").hidden = false;
    $("#btn-elegir").textContent = "Cambiar plan";
  } else {
    $("#hoy-nombre").textContent = "Día libre";
    $("#hoy-meta").textContent = "Hoy no tienes plan asignado";
    $("#btn-comenzar").hidden = true;
    $("#btn-elegir").textContent = "Elegir plan";
  }

  const snap = leerSnapshot();
  const btnRe = $("#btn-reanudar");
  if (snap && planPorId(snap.planId)) {
    btnRe.hidden = false;
    btnRe.textContent = "Reanudar: " + planPorId(snap.planId).nombre;
  } else {
    btnRe.hidden = true;
  }

  pintarSemana();
  pintarHistorialInicio();
}

function pintarSemana() {
  const hoy = claveHoy();
  $("#tira-semana").innerHTML = DIAS.map((d, i) => {
    const plan = planPorId(estado.semana[d]);
    const hecho = historialDelDia(fechaClaveDe(d)).length > 0;
    return '<button class="dia' + (d === hoy ? " hoy" : "") + '" data-accion="dia-semana" data-dia="' + d + '" style="--color:' + (plan ? plan.color : "rgba(255,255,255,.12)") + '">' +
      '<span class="dia-letra">' + DIAS_CORTOS[i] + '</span>' +
      '<span class="dia-punto"></span>' +
      '<span class="dia-check">' + (hecho ? "✓" : "") + '</span>' +
      '</button>';
  }).join("");
}

function fechaClaveDe(nombreDia) {
  const hoy = new Date();
  const objetivo = DIAS.indexOf(nombreDia);
  const actual = (hoy.getDay() + 6) % 7;
  const dif = objetivo - actual;
  const d = new Date(hoy);
  d.setDate(hoy.getDate() + dif);
  return fechaClave(d);
}

function pintarHistorialInicio() {
  const bloque = $("#bloque-historial");
  const lista = estado.historial.slice(0, 3);
  bloque.hidden = lista.length === 0;
  if (!lista.length) return;
  $("#lista-historial").innerHTML = lista.map(h => {
    const d = new Date(h.fecha);
    const cuando = fechaClave(d) === fechaClave(new Date())
      ? "Hoy"
      : d.getDate() + "/" + (d.getMonth() + 1);
    return '<div class="fila-historial"><b>' + esc(h.planNombre) + '</b><small>' + cuando + ' · ' + fmtDuracion(h.realSeg) + '</small></div>';
  }).join("");
}
/* ---------------- vista previa ---------------- */

function irEntrenar(planId) {
  const plan = planPorId(planId);
  if (!plan) { aviso("Ese plan no existe"); return; }
  estado.planId = planId;
  pintarEntrenar();
  mostrar("entrenar");
}

function pintarEntrenar() {
  const plan = planPorId(estado.planId);
  if (!plan) { mostrar("inicio"); return; }
  $("#entrenar-titulo").textContent = plan.nombre;
  $("#ent-tiempo").textContent = fmtDuracion(estimarPlan(plan));
  $("#ent-sets").textContent = contarSeries(plan);
  $("#ent-reps").textContent = contarReps(plan);

  if (!plan.entradas.length) {
    $("#lista-entradas").innerHTML = '<p class="nota">Este plan está vacío. Añade ejercicios desde Configuración → Planes.</p>';
    $("#btn-iniciar").disabled = true;
    return;
  }

  const totalSets = {};
  plan.entradas.forEach(e => {
    const ej = ejercicioPorId(e.ejercicioId);
    if (ej && !esDescanso(ej)) totalSets[e.ejercicioId] = (totalSets[e.ejercicioId] || 0) + 1;
  });
  const vistos = {};

  $("#lista-entradas").innerHTML = plan.entradas.map((ent, i) => {
    const ej = ejercicioPorId(ent.ejercicioId);
    if (!ej) {
      return '<div class="fila-entrada"><span class="num">' + (i + 1) + '</span><span class="emoji">⚠️</span><span class="fila-texto"><strong>Ejercicio eliminado</strong><small>Edita el plan para quitarlo</small></span></div>';
    }
    let detalle;
    let lado = "";
    if (esDescanso(ej)) {
      detalle = "Descanso";
      lado = Math.max(1, Number(ent.segundos) || 60) + " s";
    } else {
      vistos[ej.id] = (vistos[ej.id] || 0) + 1;
      detalle = ent.reps + " reps · " + ent.bajadaSeg + "s + " + ent.subidaSeg + "s";
      lado = "Serie " + vistos[ej.id] + "/" + totalSets[ej.id];
    }
    return '<div class="fila-entrada">' +
      '<span class="num">' + (i + 1) + '</span>' +
      '<span class="emoji">' + esc(ej.emoji || "💪") + '</span>' +
      '<span class="fila-texto"><strong>' + esc(ej.nombre) + '</strong><small>' + detalle + '</small></span>' +
      '<span class="lado">' + lado + '</span>' +
      '</div>';
  }).join("");

  $("#btn-iniciar").disabled = false;
}

/* ---------------- snapshot ---------------- */

function leerSnapshot() {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE_SNAPSHOT) || "null");
    if (!s || !s.planId) return null;
    if (Date.now() - s.fecha > 12 * 3600 * 1000) return null;
    return s;
  } catch (e) { return null; }
}

function guardarSnapshot() {
  if (!runner.activo || !runner.plan) return;
  try {
    localStorage.setItem(CLAVE_SNAPSHOT, JSON.stringify({ planId: runner.plan.id, idx: runner.idx, fecha: Date.now() }));
  } catch (e) {}
}

function borrarSnapshot() {
  try { localStorage.removeItem(CLAVE_SNAPSHOT); } catch (e) {}
}

/* ---------------- audio, voz y pantalla ---------------- */

const runner = {
  activo: false,
  plan: null,
  pasos: [],
  idx: 0,
  restanteMs: 0,
  finPaso: 0,
  corriendo: false,
  pausado: false,
  audio: null,
  wake: null,
  silencio: null,
  raf: 0,
  ultimoSeg: -1,
  avisoAguante: false,
  voz: true,
  iniciadoEn: 0,
  pausadoMs: 0,
  pausaInicio: 0,
  completadas: null,
  repsHechas: 0,
  estimado: 0,
  totalMs: 0,
  sufijo: [],
  autoPausa: false
};

function desbloquearAudio() {
  if (!runner.audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      try { runner.audio = new Ctx(); } catch (e) { runner.audio = null; }
    }
  }
  if (runner.audio && runner.audio.state === "suspended") runner.audio.resume().catch(() => {});
}

function pitido(freq, dur, vol) {
  if (!estado.config.pitidos || !runner.audio) return;
  try {
    const ctx = runner.audio;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.25, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  } catch (e) {}
}

let voces = [];
function cargarVoces() {
  if (!("speechSynthesis" in window)) return;
  voces = window.speechSynthesis.getVoices() || [];
}
if ("speechSynthesis" in window) {
  cargarVoces();
  window.speechSynthesis.addEventListener("voiceschanged", cargarVoces);
}

function hablar(texto) {
  if (!runner.voz || !estado.config.voz || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "es-ES";
    u.rate = 1.18;
    u.pitch = 1;
    const v = voces.find(v => /^es[-_]ES/i.test(v.lang)) || voces.find(v => /^es/i.test(v.lang));
    if (v) u.voice = v;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

async function pedirWakeLock() {
  if (!estado.config.wakeLock || !("wakeLock" in navigator)) { audioSilencioso(true); return; }
  if (runner.wake) return;
  try {
    runner.wake = await navigator.wakeLock.request("screen");
    runner.wake.addEventListener("release", () => { runner.wake = null; });
    audioSilencioso(false);
  } catch (e) {
    audioSilencioso(true);
  }
}

function liberarWakeLock() {
  if (runner.wake) {
    try { runner.wake.release(); } catch (e) {}
    runner.wake = null;
  }
  audioSilencioso(false);
}

function audioSilencioso(activar) {
  if (!activar) {
    if (runner.silencio) {
      try { runner.silencio.o.stop(); } catch (e) {}
      try { runner.silencio.o.disconnect(); } catch (e) {}
      runner.silencio = null;
    }
    return;
  }
  if (runner.silencio || !runner.audio) return;
  try {
    const g = runner.audio.createGain();
    g.gain.value = 0.0008;
    const o = runner.audio.createOscillator();
    o.frequency.value = 42;
    o.connect(g).connect(runner.audio.destination);
    o.start();
    runner.silencio = { o: o, g: g };
  } catch (e) {}
}
/* ---------------- motor de entrenamiento ---------------- */

function construirPasos(plan) {
  const pasos = [];
  const totalPorEj = {};
  const vistos = {};
  plan.entradas.forEach(e => {
    const ej = ejercicioPorId(e.ejercicioId);
    if (ej && !esDescanso(ej)) totalPorEj[e.ejercicioId] = (totalPorEj[e.ejercicioId] || 0) + 1;
  });

  plan.entradas.forEach((ent, i) => {
    const ej = ejercicioPorId(ent.ejercicioId);
    if (!ej) return;
    vistos[ent.ejercicioId] = (vistos[ent.ejercicioId] || 0) + 1;
    const esUltima = i === plan.entradas.length - 1;
    const base = {
      entradaIdx: i,
      entradaId: ent.uid,
      ent: ent,
      ej: ej,
      setNum: vistos[ent.ejercicioId],
      setTotal: totalPorEj[ent.ejercicioId] || 1
    };

    if (esDescanso(ej)) {
      pasos.push(Object.assign({}, base, {
        tipo: "descanso",
        dur: Math.max(1, Number(ent.segundos) || Number(ej.segundos) || 60),
        aguante: 0
      }));
      return;
    }

    if (estado.config.prepSeg > 0) {
      pasos.push(Object.assign({}, base, { tipo: "prep", dur: estado.config.prepSeg, aguante: 0 }));
    }

    const reps = Math.max(1, Number(ent.reps) || 1);
    const bajada = Math.max(0, Number(ent.bajadaSeg) || 0);
    const subida = Math.max(0, Number(ent.subidaSeg) || 0);
    for (let r = 1; r <= reps; r++) {
      if (bajada > 0) pasos.push(Object.assign({}, base, { tipo: "abajo", dur: bajada, aguante: Math.min(bajada, Number(ent.aguanteAbajoSeg) || 0), rep: r, reps: reps }));
      if (subida > 0) pasos.push(Object.assign({}, base, { tipo: "arriba", dur: subida, aguante: Math.min(subida, Number(ent.aguanteArribaSeg) || 0), rep: r, reps: reps }));
    }

    if (!esUltima && Number(ent.descansoSeg) > 0) {
      pasos.push(Object.assign({}, base, { tipo: "descanso", dur: Number(ent.descansoSeg), aguante: 0 }));
    }
  });
  return pasos;
}

function iniciarEntrenamiento(plan, desdeIdx) {
  desbloquearAudio();
  const pasos = construirPasos(plan);
  if (!pasos.length) { aviso("El plan está vacío"); return; }

  runner.activo = true;
  runner.plan = plan;
  runner.pasos = pasos;
  runner.idx = clamp(desdeIdx || 0, 0, pasos.length - 1);
  runner.corriendo = false;
  runner.pausado = false;
  runner.pausadoMs = 0;
  runner.completadas = new Set();
  runner.repsHechas = 0;
  runner.voz = estado.config.voz;
  runner.estimado = estimarPlan(plan);
  runner.iniciadoEn = performance.now();
  runner.autoPausa = false;
  runner.ultimoSeg = -1;
  runner.sufijo = new Array(pasos.length + 1).fill(0);
  for (let i = pasos.length - 1; i >= 0; i--) {
    runner.sufijo[i] = runner.sufijo[i + 1] + pasos[i].dur;
  }
  runner.totalMs = runner.sufijo[0] * 1000;

  $("#pantalla-runner").classList.remove("pausado");
  $("#runner-plan").textContent = plan.nombre;
  $("#btn-voz").classList.toggle("mute", !runner.voz);
  mostrar("runner");
  pedirWakeLock();
  empezarPaso();
  programarBucle();
}

function programarBucle() {
  clearTimeout(runner.raf);
  runner.raf = setTimeout(bucle, 100);
}

function empezarPaso() {
  const paso = runner.pasos[runner.idx];
  if (!paso) { terminarEntrenamiento(false); return; }
  runner.restanteMs = paso.dur * 1000;
  runner.finPaso = performance.now() + runner.restanteMs;
  runner.corriendo = true;
  runner.pausado = false;
  runner.ultimoSeg = -1;
  runner.avisoAguante = false;
  pintarPaso(paso);

  if (paso.tipo === "prep") {
    hablar("Prepárate");
  } else if (paso.tipo === "descanso") {
    hablar("Descanso");
  } else if (paso.tipo === "abajo") {
    hablar(paso.ej.etiquetaAbajo ? paso.ej.etiquetaAbajo.toLowerCase() : "abajo");
  } else {
    hablar(paso.ej.etiquetaArriba ? paso.ej.etiquetaArriba.toLowerCase() : "arriba");
  }
  guardarSnapshot();
}

function pintarPaso(paso) {
  const pantalla = $("#pantalla-runner");
  const etiqueta = $("#fase-etiqueta");
  const fotoBox = $("#runner-foto");
  const fotoA = $("#foto-a");
  const fotoB = $("#foto-b");
  const emoji = $("#runner-emoji");

  pantalla.classList.remove("pausado");
  pantalla.dataset.fase = paso.tipo === "prep" ? "prep" : (paso.tipo === "descanso" ? "descanso" : "reps");

  if (paso.tipo === "prep") etiqueta.textContent = "PREPÁRATE";
  else if (paso.tipo === "descanso") etiqueta.textContent = "DESCANSO";
  else etiqueta.textContent = paso.tipo === "abajo"
    ? (paso.ej.etiquetaAbajo || "ABAJO")
    : (paso.ej.etiquetaArriba || "ARRIBA");

  const urlI = urlBlob(paso.ej.fotoInicial);
  const urlF = urlBlob(paso.ej.fotoFinal);
  fotoA.src = urlI || "";
  fotoB.src = urlF || "";

  let mostrarF = paso.tipo === "abajo" && urlF;
  let mostrarI = (paso.tipo === "arriba" || paso.tipo === "prep" || paso.tipo === "descanso") && urlI;
  if (paso.tipo === "descanso" && !urlI) mostrarI = false;
  fotoA.classList.toggle("visible", !!mostrarI);
  fotoB.classList.toggle("visible", !!mostrarF);
  fotoBox.classList.toggle("con-foto", !!(mostrarI || mostrarF));
  emoji.textContent = paso.ej.emoji || "💪";

  $("#runner-ejercicio").textContent = (paso.ej.emoji || "💪") + " " + paso.ej.nombre;
  if (paso.tipo === "descanso") {
    $("#runner-detalle").textContent = "Recupera el aire";
  } else if (paso.tipo === "prep") {
    $("#runner-detalle").textContent = "Acomódate para empezar";
  } else {
    $("#runner-detalle").textContent = "Rep " + paso.rep + "/" + paso.reps + " · Serie " + paso.setNum + "/" + paso.setTotal;
  }

  $("#btn-extra").hidden = paso.tipo !== "descanso";
  $("#runner-progreso-barra").style.width = "0%";
  actualizarTiempo(paso.dur * 1000, paso);
}

function actualizarTiempo(restanteMs, paso) {
  const seg = Math.max(0, Math.ceil(restanteMs / 1000));
  $("#runner-tiempo").textContent = seg;
  const durMs = Math.max(1, paso.dur * 1000);
  const avance = clamp(1 - restanteMs / durMs, 0, 1);
  $("#anillo-valor").style.strokeDashoffset = String(339.292 * (1 - avance));

  const restanteTotal = (restanteMs / 1000) + runner.sufijo[runner.idx + 1];
  $("#runner-restante-total").textContent = fmtTiempo(restanteTotal);
  $("#runner-progreso-barra").style.width = (clamp(1 - (restanteTotal * 1000) / Math.max(1, runner.totalMs), 0, 1) * 100) + "%";
}

function bucle() {
  if (!runner.activo || !runner.corriendo) return;
  const paso = runner.pasos[runner.idx];
  if (!paso) return;
  const restante = Math.max(0, runner.finPaso - performance.now());

  if (restante <= 0) {
    avanzar();
    if (runner.activo && runner.corriendo) programarBucle();
    return;
  }

  actualizarTiempo(restante, paso);

  const seg = Math.ceil(restante / 1000);
  if (seg !== runner.ultimoSeg) {
    runner.ultimoSeg = seg;
    if (seg >= 1 && seg <= 3) pitido(690, 0.07, 0.2);
  }

  if (paso.aguante > 0 && !runner.avisoAguante && restante <= paso.aguante * 1000 + 30) {
    runner.avisoAguante = true;
    hablar("Aguanta");
    pitido(1020, 0.1, 0.28);
    vibrar(20);
  }

  programarBucle();
}
function avanzar() {
  const paso = runner.pasos[runner.idx];
  if (!paso) { terminarEntrenamiento(false); return; }

  if (paso.tipo === "abajo") runner.repsHechas++;
  else if (paso.tipo === "arriba" && !(Number(paso.ent.bajadaSeg) > 0)) runner.repsHechas++;

  const siguiente = runner.pasos[runner.idx + 1];
  if (paso.tipo === "abajo" || paso.tipo === "arriba") {
    let j = runner.idx + 1;
    let quedaEjercicio = false;
    while (j < runner.pasos.length && runner.pasos[j].entradaId === paso.entradaId) {
      if (runner.pasos[j].tipo !== "descanso") quedaEjercicio = true;
      j++;
    }
    if (!quedaEjercicio && paso.entradaId) runner.completadas.add(paso.entradaId);
  } else if (!siguiente || siguiente.entradaId !== paso.entradaId) {
    if (paso.entradaId) runner.completadas.add(paso.entradaId);
  }

  if (paso.tipo !== "descanso") {
    pitido(980, 0.06, 0.16);
    vibrar(22);
  }

  runner.idx++;
  if (runner.idx >= runner.pasos.length) { terminarEntrenamiento(false); return; }
  empezarPaso();
}

function pausar() {
  if (!runner.activo) return;
  if (runner.corriendo) {
    runner.restanteMs = Math.max(0, runner.finPaso - performance.now());
    runner.corriendo = false;
    clearTimeout(runner.raf);
    runner.pausado = true;
    runner.pausaInicio = performance.now();
    $("#pantalla-runner").classList.add("pausado");
    $("#fase-etiqueta").textContent = "EN PAUSA";
    $("#btn-extra").hidden = true;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  } else if (runner.pausado) {
    runner.pausadoMs += performance.now() - runner.pausaInicio;
    runner.pausado = false;
    runner.corriendo = true;
    runner.finPaso = performance.now() + runner.restanteMs;
    pintarPaso(runner.pasos[runner.idx]);
    bucle();
  }
}

function saltar() {
  if (!runner.activo) return;
  const paso = runner.pasos[runner.idx];
  let j = runner.idx + 1;
  while (j < runner.pasos.length && runner.pasos[j].entradaIdx === paso.entradaIdx) j++;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  runner.idx = j;
  if (runner.idx >= runner.pasos.length) { terminarEntrenamiento(false); return; }
  empezarPaso();
}

function masTiempo() {
  if (!runner.activo || !runner.corriendo) return;
  const paso = runner.pasos[runner.idx];
  if (!paso || paso.tipo !== "descanso") return;
  paso.dur += 30;
  runner.finPaso += 30000;
  for (let i = 0; i <= runner.idx; i++) runner.sufijo[i] += 30;
  runner.totalMs += 30000;
  aviso("+30 s de descanso");
}

async function terminarEntrenamiento(abandonado) {
  if (!runner.activo && !abandonado) return;
  const plan = runner.plan;
  const completadas = runner.completadas || new Set();
  const totalMs = runner.totalMs;

  runner.activo = false;
  runner.corriendo = false;
  runner.pausado = false;
  clearTimeout(runner.raf);
  liberarWakeLock();
  borrarSnapshot();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();

  const setsTotal = plan ? contarSeries(plan) : 0;
  let setsHechos = 0;
  if (plan) {
    const entradas = new Map(plan.entradas.map(e => [e.uid, e]));
    completadas.forEach(uidEnt => {
      const ent = entradas.get(uidEnt);
      const ej = ent && ejercicioPorId(ent.ejercicioId);
      if (ej && !esDescanso(ej)) setsHechos++;
    });
  }

  if (abandonado || !plan) {
    mostrar("inicio");
    pintarInicio();
    return;
  }

  pitido(1180, 0.18, 0.3);
  vibrar([70, 50, 90]);
  hablar("Entrenamiento terminado");

  const realSeg = Math.round((performance.now() - runner.iniciadoEn - runner.pausadoMs) / 1000);
  const ahora = Date.now();
  const registro = {
    id: ahora,
    fecha: ahora,
    fechaClave: fechaClave(new Date()),
    planId: plan.id,
    planNombre: plan.nombre,
    realSeg: realSeg,
    estimadoSeg: runner.estimado,
    setsHechos: setsHechos,
    setsTotal: setsTotal,
    reps: runner.repsHechas
  };
  try { await dbGuardar("historial", registro); } catch (e) {}
  estado.historial.unshift(registro);

  $("#resumen-plan").textContent = plan.nombre;
  $("#res-tiempo").textContent = fmtDuracion(realSeg);
  $("#res-estimado").textContent = fmtDuracion(runner.estimado);
  $("#res-sets").textContent = setsHechos + "/" + setsTotal;
  $("#res-reps").textContent = runner.repsHechas;
  const racha = calcularRacha();
  $("#resumen-racha").textContent = racha > 1 ? "🔥 " + racha + " días seguidos" : "Sesión guardada";
  pintarInicio();
  mostrar("resumen");
  void totalMs;
}

function pedirSalirRunner() {
  confirmar("Salir del entrenamiento", "Se perderá el progreso de esta sesión. ¿Salir?", "Salir", () => {
    terminarEntrenamiento(true);
  });
}

function confirmar(titulo, texto, textoAccion, accion) {
  estado.confirmarAccion = accion;
  abrirHoja(titulo,
    '<p class="nota">' + esc(texto) + '</p>' +
    '<div class="acciones-editor">' +
    '<button type="button" class="btn btn-secundario" data-accion="cerrar-hoja">Cancelar</button>' +
    '<button type="button" class="btn btn-peligro" data-accion="confirmar-accion">' + esc(textoAccion) + '</button>' +
    '</div>');
}
/* ---------------- configuración ---------------- */

function irConfig(tab) {
  if (tab) estado.tab = tab;
  pintarConfig();
  mostrar("config");
}

function pintarConfig() {
  $$("#tabs-config .tab").forEach(t => t.classList.toggle("activo", t.dataset.tab === estado.tab));
  $$("#pantalla-config .tab-panel").forEach(p => p.classList.remove("activo"));
  const panel = $("#panel-" + estado.tab);
  if (panel) panel.classList.add("activo");

  if (estado.tab === "ejercicios") pintarEjercicios();
  else if (estado.tab === "planes") pintarPlanes();
  else pintarAjustes();
}

function metaEjercicio(ej) {
  if (esDescanso(ej)) return (ej.segundos || 60) + " s de descanso";
  const partes = [];
  partes.push((ej.reps || 8) + " reps");
  partes.push((ej.bajadaSeg || 0) + "s + " + (ej.subidaSeg || 0) + "s");
  const aguante = (ej.aguanteAbajoSeg || 0) + (ej.aguanteArribaSeg || 0);
  if (aguante > 0) partes.push("aguante " + (ej.aguanteAbajoSeg || 0) + "/" + (ej.aguanteArribaSeg || 0) + " s");
  return partes.join(" · ");
}

function pintarEjercicios() {
  const cont = $("#panel-ejercicios");
  let html = '<div class="panel-cab"><span>' + estado.ejercicios.length + ' ejercicios</span>' +
    '<button type="button" class="btn btn-chico" data-accion="nuevo-ejercicio">＋ Nuevo</button></div>';
  html += '<div class="lista">';
  estado.ejercicios.forEach(ej => {
    const url = urlBlob(ej.fotoInicial);
    html += '<button type="button" class="fila-ejercicio" data-accion="editar-ejercicio" data-id="' + esc(ej.id) + '">' +
      '<span class="miniatura">' + (url ? '<img src="' + url + '" alt="">' : '<span>' + esc(ej.emoji || "💪") + '</span>') + '</span>' +
      '<span class="fila-texto"><strong>' + esc(ej.nombre) + '</strong><small>' + esc(metaEjercicio(ej)) + '</small></span>' +
      '<span class="fila-flecha">›</span>' +
      '</button>';
  });
  html += '</div>';
  html += '<p class="nota">Las fotos se guardan solo en este teléfono. Toca un ejercicio para cambiar sus tiempos, repeticiones o fotos.</p>';
  cont.innerHTML = html;
}

function pintarPlanes() {
  const cont = $("#panel-planes");
  let html = '<div class="panel-cab"><span>' + estado.planes.length + ' planes</span>' +
    '<button type="button" class="btn btn-chico" data-accion="nuevo-plan">＋ Nuevo</button></div>';

  if (!estado.planes.length) {
    html += '<p class="nota">Todavía no tienes planes. Crea uno y añade ejercicios.</p>';
  } else {
    html += '<div class="lista">';
    estado.planes.forEach(p => {
      const dias = DIAS.filter(d => estado.semana[d] === p.id).map(d => DIAS_CORTOS[DIAS.indexOf(d)]).join(" · ");
      html += '<button type="button" class="fila-plan" data-accion="editar-plan" data-id="' + esc(p.id) + '">' +
        '<span class="punto" style="background:' + esc(p.color) + ';color:' + esc(p.color) + '"></span>' +
        '<span class="fila-texto"><strong>' + esc(p.nombre) + '</strong>' +
        '<small>' + contarSeries(p) + ' series · ' + fmtDuracion(estimarPlan(p)) + (dias ? ' · ' + dias : '') + '</small></span>' +
        '<span class="fila-flecha">›</span></button>';
    });
    html += '</div>';
  }

  html += '<div class="seccion-ajustes"><h2>Asignar a la semana</h2><div class="semana-config">';
  DIAS.forEach((d, i) => {
    const plan = planPorId(estado.semana[d]);
    html += '<button type="button" class="dia-config" data-accion="semana-dia" data-dia="' + d + '">' +
      '<span>' + DIAS_LARGOS[i] + '</span>' +
      '<small' + (plan ? ' style="color:' + esc(plan.color) + '"' : '') + '>' + esc(plan ? plan.nombre : "Descanso") + '</small>' +
      '</button>';
  });
  html += '</div></div>';
  cont.innerHTML = html;
}

function pintarAjustes() {
  const c = estado.config;
  const cont = $("#panel-ajustes");
  const filaToggle = (clave, titulo, desc) =>
    '<button type="button" class="fila-ajuste" data-accion="toggle-config" data-clave="' + clave + '">' +
    '<span class="fila-texto"><strong>' + titulo + '</strong><small>' + desc + '</small></span>' +
    '<span class="switch' + (c[clave] ? " on" : "") + '"></span></button>';

  const filaStepper = (clave, titulo, desc, unidad, min, max) =>
    '<div class="fila-ajuste">' +
    '<span class="fila-texto"><strong>' + titulo + '</strong><small>' + desc + '</small></span>' +
    stepperHTML(clave, c[clave], unidad, min, max, { accion: "step-config", scope: "config" }) +
    '</div>';

  let html = '<div class="seccion-ajustes"><h2>Durante el entrenamiento</h2>';
  html += filaToggle("voz", "Voz", "Dice abajo, arriba, aguanta y descanso");
  html += filaToggle("pitidos", "Pitidos", "Cuenta regresiva 3, 2, 1");
  html += filaToggle("vibracion", "Vibración", "Aviso al cambiar de movimiento");
  html += filaToggle("wakeLock", "Mantener pantalla encendida", "Evita que el teléfono se duerma");
  html += filaStepper("prepSeg", "Preparación", "Antes de cada ejercicio", " s", 0, 30);
  html += filaStepper("descansoSeg", "Descanso por defecto", "Para ejercicios nuevos", " s", 5, 300);
  html += '</div>';

  html += '<div class="seccion-ajustes"><h2>Datos</h2>';
  html += '<button type="button" class="btn btn-secundario btn-grande" data-accion="exportar">Exportar respaldo</button>';
  html += '<button type="button" class="btn btn-secundario btn-grande" style="margin-top:8px" data-accion="importar">Importar respaldo</button>';
  html += '<p class="nota">El respaldo incluye ejercicios, fotos, planes e historial. Guárdalo fuera de la carpeta del proyecto y hazlo de vez en cuando.</p>';
  html += '</div>';

  html += '<div class="seccion-ajustes"><h2>Historial</h2>';
  html += '<button type="button" class="btn btn-peligro btn-grande" data-accion="borrar-historial">Borrar historial (' + estado.historial.length + ')</button>';
  html += '</div>';

  cont.innerHTML = html;
}
/* ---------------- hojas ---------------- */

function abrirHoja(titulo, html, completa) {
  $("#hoja-titulo").textContent = titulo;
  $("#hoja-cuerpo").innerHTML = html;
  $("#hoja").classList.toggle("completa", !!completa);
  const fondo = $("#hoja-fondo");
  fondo.hidden = false;
  requestAnimationFrame(() => fondo.classList.add("abierta"));
}

function cerrarHoja() {
  const fondo = $("#hoja-fondo");
  fondo.classList.remove("abierta");
  setTimeout(() => {
    fondo.hidden = true;
    $("#hoja-cuerpo").innerHTML = "";
  }, 220);
  estado.hojaTipo = null;
  estado.borradorEj = null;
  estado.planBorrador = null;
  estado.confirmarAccion = null;
}

function abrirSelectorPlan(dia) {
  estado.hojaTipo = "selector-plan";
  estado.diaSelector = dia || null;
  const actual = dia ? estado.semana[dia] : estado.planId;
  let html = '<p class="nota">' +
    (dia ? "Elige el plan para el " + DIAS_LARGOS[DIAS.indexOf(dia)].toLowerCase() : "Elige el plan que quieres entrenar") +
    '</p><div class="lista">';

  if (dia) {
    html += '<button type="button" class="fila-plan" data-accion="asignar-dia" data-id="">' +
      '<span class="punto" style="background:#3a4356;color:#3a4356"></span>' +
      '<span class="fila-texto"><strong>Descanso</strong><small>Sin entrenamiento</small></span>' +
      (actual ? '<span class="fila-flecha">›</span>' : '<span class="fila-flecha">✓</span>') +
      '</button>';
  }

  estado.planes.forEach(p => {
    html += '<button type="button" class="fila-plan" data-accion="' + (dia ? "asignar-dia" : "entrenar-plan") + '" data-id="' + esc(p.id) + '">' +
      '<span class="punto" style="background:' + esc(p.color) + ';color:' + esc(p.color) + '"></span>' +
      '<span class="fila-texto"><strong>' + esc(p.nombre) + '</strong><small>' + contarSeries(p) + ' series · ' + fmtDuracion(estimarPlan(p)) + '</small></span>' +
      (p.id === actual ? '<span class="fila-flecha">✓</span>' : '<span class="fila-flecha">›</span>') +
      '</button>';
  });

  html += '</div>';
  abrirHoja(dia ? "Plan del día" : "Elegir plan", html);
}

/* ---------------- editor de ejercicio ---------------- */

function abrirEditorEjercicio(id) {
  estado.hojaTipo = "editor-ejercicio";
  if (id) {
    const ej = ejercicioPorId(id);
    if (!ej) return;
    estado.borradorEj = Object.assign({}, ej);
  } else {
    estado.borradorEj = {
      id: null, nombre: "", tipo: "reps", emoji: "💪", grupo: "",
      reps: 8, bajadaSeg: 2, subidaSeg: 2, aguanteAbajoSeg: 1, aguanteArribaSeg: 1,
      descansoSeg: estado.config.descansoSeg, segundos: 60,
      fotoInicial: null, fotoFinal: null,
      etiquetaAbajo: "ABAJO", etiquetaArriba: "ARRIBA",
      orden: estado.ejercicios.length + 1
    };
  }
  abrirHoja(id ? "Editar ejercicio" : "Nuevo ejercicio", htmlEditorEjercicio(), true);
}

function stepperHTML(campo, valor, sufijo, min, max, opciones) {
  const op = opciones || {};
  const accion = op.accion || "editor-step";
  const scope = op.scope || "ejercicio";
  const unidad = sufijo ? '<span class="stepper-unidad">' + sufijo.trim() + '</span>' : "";
  return '<div class="stepper">' +
    '<button type="button" data-accion="' + accion + '" data-campo="' + campo + '" data-delta="-1" data-min="' + min + '" data-max="' + max + '">−</button>' +
    '<input type="number" class="stepper-input" inputmode="numeric" data-campo="' + campo + '" data-scope="' + scope + '" data-min="' + min + '" data-max="' + max + '" min="' + min + '" max="' + max + '" step="1" value="' + (Number(valor) || 0) + '">' +
    unidad +
    '<button type="button" data-accion="' + accion + '" data-campo="' + campo + '" data-delta="1" data-min="' + min + '" data-max="' + max + '">＋</button>' +
    '</div>';
}

function filaEditor(titulo, campo, valor, sufijo, min, max, scope, accion) {
  return '<div class="fila-ajuste-editor"><span>' + titulo + '</span>' +
    stepperHTML(campo, valor, sufijo, min, max, { scope: scope || "ejercicio", accion: accion || "editor-step" }) + '</div>';
}

function htmlEditorEjercicio() {
  const ej = estado.borradorEj;
  if (!ej) return "";
  const esDesc = ej.tipo === "descanso";
  const urlI = urlBlob(ej.fotoInicial);
  const urlF = urlBlob(ej.fotoFinal);

  const fotos = esDesc ? "" :
    '<div class="fotos">' +
    '<label class="foto-caja"><input type="file" accept="image/*" data-foto="inicial">' +
    (urlI ? '<img src="' + urlI + '" alt="">' : '<span class="foto-emoji">' + esc(ej.emoji || "💪") + '</span>') +
    '<span class="foto-etiqueta">Inicial</span></label>' +
    '<label class="foto-caja"><input type="file" accept="image/*" data-foto="final">' +
    (urlF ? '<img src="' + urlF + '" alt="">' : '<span class="foto-emoji">' + esc(ej.emoji || "💪") + '</span>') +
    '<span class="foto-etiqueta">Final</span></label>' +
    '</div>';

  const campos = esDesc
    ? filaEditor("Duración", "segundos", ej.segundos || 60, " s", 5, 900)
    : filaEditor("Repeticiones", "reps", ej.reps || 1, "", 1, 200) +
      filaEditor("Bajada / atrás", "bajadaSeg", ej.bajadaSeg || 0, " s", 0, 60) +
      filaEditor("Aguantar abajo", "aguanteAbajoSeg", ej.aguanteAbajoSeg || 0, " s", 0, 60) +
      filaEditor("Subida / adelante", "subidaSeg", ej.subidaSeg || 0, " s", 0, 60) +
      filaEditor("Aguantar arriba", "aguanteArribaSeg", ej.aguanteArribaSeg || 0, " s", 0, 60) +
      filaEditor("Descanso tras la serie", "descansoSeg", ej.descansoSeg || 0, " s", 0, 900);

  return '<div class="editor">' +
    '<label class="campo"><span>Nombre</span><input type="text" id="ej-nombre" value="' + esc(ej.nombre) + '" placeholder="Ej. Sentadillas" maxlength="40"></label>' +
    '<div class="fila-campos">' +
    '<label class="campo"><span>Emoji</span><input type="text" id="ej-emoji" value="' + esc(ej.emoji) + '" maxlength="6"></label>' +
    '<label class="campo"><span>Grupo</span><input type="text" id="ej-grupo" value="' + esc(ej.grupo) + '" placeholder="Piernas" maxlength="24"></label>' +
    '</div>' +
    '<div class="segmentado">' +
    '<button type="button" class="' + (!esDesc ? "activo" : "") + '" data-accion="tipo-ejercicio" data-tipo="reps">Ejercicio</button>' +
    '<button type="button" class="' + (esDesc ? "activo" : "") + '" data-accion="tipo-ejercicio" data-tipo="descanso">Descanso</button>' +
    '</div>' +
    fotos +
    campos +
    '<div class="acciones-editor">' +
    (ej.id ? '<button type="button" class="btn btn-peligro" data-accion="borrar-ejercicio">Eliminar</button>' : '') +
    '<button type="button" class="btn btn-principal" data-accion="guardar-ejercicio">Guardar</button>' +
    '</div></div>';
}
/* ---------------- editor de plan ---------------- */

async function abrirEditorPlan(id) {
  estado.hojaTipo = "editor-plan";
  if (id) {
    const plan = planPorId(id);
    if (!plan) return;
    estado.planBorrador = plan;
  } else {
    const nuevo = {
      id: uid(),
      nombre: "Plan nuevo",
      color: COLORES[estado.planes.length % COLORES.length],
      entradas: []
    };
    await dbGuardar("planes", nuevo);
    estado.planes.push(nuevo);
    ordenarPlanes();
    estado.planBorrador = nuevo;
  }
  abrirHoja("Editar plan", htmlEditorPlan(), true);
}

function ordenarPlanes() {
  estado.planes.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
}

async function persistirPlan() {
  const plan = estado.planBorrador;
  if (!plan) return;
  await dbGuardar("planes", plan);
  ordenarPlanes();
}

function htmlEditorPlan() {
  const plan = estado.planBorrador;
  if (!plan) return "";

  const colores = COLORES.map(c =>
    '<button type="button" class="color-btn' + (plan.color === c ? " activo" : "") + '" data-accion="plan-color" data-color="' + c + '" style="background:' + c + '" aria-label="Color"></button>'
  ).join("");

  const dias = DIAS.map((d, i) =>
    '<button type="button" class="dia-chip' + (estado.semana[d] === plan.id ? " on" : "") + '" data-accion="plan-dia" data-dia="' + d + '">' + DIAS_CORTOS[i] + '</button>'
  ).join("");

  let filas = "";
  plan.entradas.forEach((ent, i) => {
    const ej = ejercicioPorId(ent.ejercicioId);
    if (!ej) {
      filas += '<div class="fila-editor"><span class="emoji">⚠️</span><span class="fila-texto"><strong>Ejercicio eliminado</strong><small>Tócalo para quitarlo</small></span>' +
        '<span class="acciones-fila"><button type="button" data-accion="plan-borrar-entrada" data-uid="' + ent.uid + '">✕</button></span></div>';
      return;
    }
    const detalle = esDescanso(ej)
      ? (Number(ent.segundos) || 60) + " s"
      : ent.reps + " reps · " + ent.bajadaSeg + "s + " + ent.subidaSeg + "s";
    filas += '<div class="fila-editor">' +
      '<span class="emoji">' + esc(ej.emoji || "💪") + '</span>' +
      '<button type="button" class="fila-texto" data-accion="editar-entrada" data-uid="' + ent.uid + '">' +
      '<strong>' + esc(ej.nombre) + '</strong><small>' + detalle + '</small></button>' +
      '<span class="acciones-fila">' +
      '<button type="button" data-accion="plan-subir" data-uid="' + ent.uid + '" aria-label="Subir">↑</button>' +
      '<button type="button" data-accion="plan-bajar" data-uid="' + ent.uid + '" aria-label="Bajar">↓</button>' +
      '<button type="button" data-accion="plan-duplicar" data-uid="' + ent.uid + '" aria-label="Duplicar">⧉</button>' +
      '<button type="button" data-accion="plan-borrar-entrada" data-uid="' + ent.uid + '" aria-label="Quitar">✕</button>' +
      '</span></div>';
  });

  const total = estimarPlan(plan);

  return '<div class="editor">' +
    '<label class="campo"><span>Nombre del plan</span><input type="text" id="plan-nombre" value="' + esc(plan.nombre) + '" maxlength="32"></label>' +
    '<div class="campo"><span>Color</span><div class="colores">' + colores + '</div></div>' +
    '<div class="campo"><span>Días de la semana</span><div class="dias-chips">' + dias + '</div></div>' +
    '<div class="panel-cab" style="margin-bottom:0"><span>' + plan.entradas.length + ' series</span>' +
    '<button type="button" class="btn btn-chico" data-accion="añadir-entrada">＋ Añadir</button></div>' +
    '<div class="total-plan"><span>Duración estimada</span><strong>' + fmtDuracion(total) + '</strong></div>' +
    '<div>' + (filas || '<p class="nota">Aún no hay ejercicios. Toca "Añadir" para elegir de tu lista.</p>') + '</div>' +
    '<div class="acciones-editor"><button type="button" class="btn btn-peligro" data-accion="borrar-plan">Eliminar plan</button>' +
    '<button type="button" class="btn btn-principal" data-accion="cerrar-hoja">Listo</button></div>' +
    '</div>';
}

/* ---------------- editor de serie ---------------- */

function abrirEditorEntrada(uidEnt) {
  const plan = estado.planBorrador;
  if (!plan) return;
  const ent = plan.entradas.find(e => e.uid === uidEnt);
  if (!ent) return;
  const ej = ejercicioPorId(ent.ejercicioId);
  if (!ej) return;
  estado.hojaTipo = "editor-entrada";
  estado.entradaUid = uidEnt;
  abrirHoja(ej.nombre, htmlEditorEntrada(ent, ej), true);
}

function htmlEditorEntrada(ent, ej) {
  const fila = (titulo, campo, valor, sufijo, min, max) =>
    filaEditor(titulo, campo, valor, sufijo, min, max, "entrada", "entrada-step");
  let campos;
  if (esDescanso(ej)) {
    campos = fila("Duración", "segundos", Number(ent.segundos) || 60, " s", 5, 900);
  } else {
    campos =
      fila("Repeticiones", "reps", ent.reps, "", 1, 200) +
      fila("Bajada / atrás", "bajadaSeg", ent.bajadaSeg, " s", 0, 60) +
      fila("Aguantar abajo", "aguanteAbajoSeg", ent.aguanteAbajoSeg || 0, " s", 0, 60) +
      fila("Subida / adelante", "subidaSeg", ent.subidaSeg, " s", 0, 60) +
      fila("Aguantar arriba", "aguanteArribaSeg", ent.aguanteArribaSeg || 0, " s", 0, 60) +
      fila("Descanso después", "descansoSeg", ent.descansoSeg || 0, " s", 0, 900);
  }

  const tiempoSerie = esDescanso(ej)
    ? (Number(ent.segundos) || 60)
    : (Number(ent.reps) || 1) * ((Number(ent.bajadaSeg) || 0) + (Number(ent.subidaSeg) || 0));

  return '<div class="editor">' +
    '<p class="nota">' + esc(ej.nombre) + (esDescanso(ej) ? "" : " · Serie " + ent.reps + " reps") + '</p>' +
    campos +
    '<div class="total-plan"><span>Tiempo de esta serie</span><strong>' + fmtTiempo(tiempoSerie) + '</strong></div>' +
    '<div class="acciones-editor">' +
    '<button type="button" class="btn btn-peligro" data-accion="entrada-borrar">Quitar serie</button>' +
    '<button type="button" class="btn btn-principal" data-accion="volver-plan">Volver al plan</button>' +
    '</div></div>';
}

function refrescarEditorEntrada() {
  const plan = estado.planBorrador;
  if (!plan) return;
  const ent = plan.entradas.find(e => e.uid === estado.entradaUid);
  if (!ent) return;
  const ej = ejercicioPorId(ent.ejercicioId);
  if (!ej) return;
  $("#hoja-titulo").textContent = ej.nombre;
  $("#hoja-cuerpo").innerHTML = htmlEditorEntrada(ent, ej);
}

/* ---------------- elegir ejercicio para el plan ---------------- */

function abrirSelectorEjercicio() {
  estado.hojaTipo = "selector-ejercicio";
  let html = '<p class="nota">Elige un ejercicio para añadir al plan</p><div class="lista">';
  estado.ejercicios.forEach(ej => {
    html += '<button type="button" class="fila-ejercicio" data-accion="agregar-entrada" data-id="' + esc(ej.id) + '">' +
      '<span class="miniatura"><span>' + esc(ej.emoji || "💪") + '</span></span>' +
      '<span class="fila-texto"><strong>' + esc(ej.nombre) + '</strong><small>' + esc(metaEjercicio(ej)) + '</small></span>' +
      '<span class="fila-flecha">＋</span></button>';
  });
  html += '</div>';
  abrirHoja("Añadir al plan", html);
}

async function agregarEntrada(ejercicioId) {
  const plan = estado.planBorrador;
  const ej = ejercicioPorId(ejercicioId);
  if (!plan || !ej) return;
  const ent = {
    uid: uid(),
    ejercicioId: ej.id,
    reps: ej.reps || 8,
    bajadaSeg: Number(ej.bajadaSeg) || 0,
    subidaSeg: Number(ej.subidaSeg) || 0,
    aguanteAbajoSeg: Number(ej.aguanteAbajoSeg) || 0,
    aguanteArribaSeg: Number(ej.aguanteArribaSeg) || 0,
    descansoSeg: estado.config.descansoSeg,
    segundos: Number(ej.segundos) || 60
  };
  plan.entradas.push(ent);
  await persistirPlan();
  estado.hojaTipo = "editor-plan";
  $("#hoja-titulo").textContent = "Editar plan";
  $("#hoja-cuerpo").innerHTML = htmlEditorPlan();
  aviso("Añadido a " + plan.nombre);
}
/* ---------------- guardar / borrar ejercicio ---------------- */

async function guardarEjercicio() {
  const ej = estado.borradorEj;
  if (!ej) return;
  ej.nombre = String(ej.nombre || "").trim();
  if (!ej.nombre) { aviso("Ponle un nombre"); return; }
  if (!ej.id) ej.id = uid();
  if (ej.tipo === "descanso") {
    ej.emoji = ej.emoji || "⏸️";
    ej.bajadaSeg = 0;
    ej.subidaSeg = 0;
    ej.aguanteAbajoSeg = 0;
    ej.aguanteArribaSeg = 0;
  }
  await dbGuardar("ejercicios", ej);
  const i = estado.ejercicios.findIndex(e => e.id === ej.id);
  if (i >= 0) estado.ejercicios[i] = ej;
  else estado.ejercicios.push(ej);
  estado.ejercicios.sort((a, b) => (a.orden || 99) - (b.orden || 99) || String(a.nombre).localeCompare(String(b.nombre)));
  cerrarHoja();
  pintarEjercicios();
  aviso("Ejercicio guardado");
}

function borrarEjercicio() {
  const ej = estado.borradorEj;
  if (!ej || !ej.id) return;
  const planes = estado.planes.filter(p => p.entradas.some(e => e.ejercicioId === ej.id));
  const mensaje = planes.length
    ? "Se usa en " + planes.length + " plan(es) y se quitará de ellos. ¿Eliminar de todos modos?"
    : "¿Eliminar este ejercicio?";
  confirmar("Eliminar ejercicio", mensaje, "Eliminar", async () => {
    for (const p of planes) {
      p.entradas = p.entradas.filter(e => e.ejercicioId !== ej.id);
      await dbGuardar("planes", p);
    }
    await dbBorrar("ejercicios", ej.id);
    estado.ejercicios = estado.ejercicios.filter(e => e.id !== ej.id);
    cerrarHoja();
    pintarEjercicios();
    aviso("Ejercicio eliminado");
  });
}

/* ---------------- fotos ---------------- */

function comprimirImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const max = 900;
          const escala = Math.min(1, max / Math.max(img.width, img.height));
          const lienzo = document.createElement("canvas");
          lienzo.width = Math.max(1, Math.round(img.width * escala));
          lienzo.height = Math.max(1, Math.round(img.height * escala));
          const ctx = lienzo.getContext("2d");
          ctx.fillStyle = "#0a0f18";
          ctx.fillRect(0, 0, lienzo.width, lienzo.height);
          ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
          lienzo.toBlob(b => b ? resolver(b) : rechazar(new Error("sin blob")), "image/jpeg", 0.82);
        } catch (e) { rechazar(e); }
      };
      img.onerror = () => rechazar(new Error("imagen inválida"));
      img.src = lector.result;
    };
    lector.onerror = () => rechazar(lector.error);
    lector.readAsDataURL(archivo);
  });
}

/* ---------------- exportar / importar ---------------- */

function descargar(blob, nombre) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1200);
}

function blobADataURL(blob) {
  return new Promise(res => {
    if (!blob) { res(null); return; }
    const lector = new FileReader();
    lector.onload = () => res(lector.result);
    lector.onerror = () => res(null);
    lector.readAsDataURL(blob);
  });
}

async function dataURLABlob(dataUrl) {
  if (!dataUrl) return null;
  const r = await fetch(dataUrl);
  return await r.blob();
}

async function exportar() {
  aviso("Preparando respaldo…");
  const ejercicios = [];
  for (const ej of estado.ejercicios) {
    ejercicios.push(Object.assign({}, ej, {
      fotoInicial: await blobADataURL(ej.fotoInicial),
      fotoFinal: await blobADataURL(ej.fotoFinal)
    }));
  }
  const datos = {
    app: "rutinas",
    version: 1,
    exportado: new Date().toISOString(),
    config: estado.config,
    semana: estado.semana,
    planes: estado.planes,
    ejercicios: ejercicios,
    historial: estado.historial
  };
  const blob = new Blob([JSON.stringify(datos)], { type: "application/json" });
  descargar(blob, "rutinas-respaldo-" + fechaClave() + ".json");
  aviso("Respaldo descargado");
}

async function importarArchivo(archivo) {
  const texto = await archivo.text();
  let datos;
  try { datos = JSON.parse(texto); } catch (e) { aviso("El archivo no es válido"); return; }
  if (!datos || !Array.isArray(datos.ejercicios) || !Array.isArray(datos.planes)) {
    aviso("El respaldo no tiene el formato esperado");
    return;
  }
  confirmar("Importar respaldo", "Se reemplazarán tus ejercicios, planes, historial y ajustes actuales. ¿Continuar?", "Importar", async () => {
    await dbLimpiar("ejercicios");
    await dbLimpiar("planes");
    await dbLimpiar("ajustes");
    await dbLimpiar("semana");
    await dbLimpiar("historial");

    for (const ej of datos.ejercicios) {
      const copia = Object.assign({}, ej);
      copia.fotoInicial = await dataURLABlob(ej.fotoInicial);
      copia.fotoFinal = await dataURLABlob(ej.fotoFinal);
      await dbGuardar("ejercicios", copia);
    }
    for (const p of datos.planes) await dbGuardar("planes", p);
    await dbGuardar("ajustes", Object.assign({}, CONFIG_DEFECTO, datos.config || {}));
    await dbGuardar("semana", datos.semana || { clave: CLAVE_SEMANA });
    if (Array.isArray(datos.historial)) {
      for (const h of datos.historial) {
        if (h && typeof h.id === "number") await dbGuardar("historial", h);
      }
    }
    await cargarTodo();
    cerrarHoja();
    pintarInicio();
    pintarConfig();
    aviso("Respaldo importado");
  });
}
/* ---------------- eventos ---------------- */

let planNombreTimer = 0;

document.addEventListener("click", async (ev) => {
  const el = ev.target.closest("[data-accion]");
  if (!el) return;
  const accion = el.dataset.accion;
  const id = el.dataset.id;
  const uidEnt = el.dataset.uid;

  switch (accion) {
    case "ir-config": irConfig(); break;
    case "ir-inicio": mostrar("inicio"); pintarInicio(); break;
    case "ir-planes": irConfig("planes"); break;
    case "tab": estado.tab = el.dataset.tab; pintarConfig(); break;

    case "comenzar": {
      const plan = planPorId(estado.semana[claveHoy()]);
      if (plan) irEntrenar(plan.id);
      else abrirSelectorPlan(null);
      break;
    }
    case "elegir-plan": abrirSelectorPlan(null); break;
    case "reanudar": {
      const snap = leerSnapshot();
      const plan = snap && planPorId(snap.planId);
      if (!plan) { aviso("No hay entrenamiento pendiente"); break; }
      iniciarEntrenamiento(plan, snap.idx);
      break;
    }
    case "dia-semana": abrirSelectorPlan(el.dataset.dia); break;
    case "semana-dia": abrirSelectorPlan(el.dataset.dia); break;
    case "asignar-dia": {
      const dia = estado.diaSelector;
      if (!dia) break;
      estado.semana[dia] = id || null;
      await guardarSemana();
      cerrarHoja();
      pintarInicio();
      if (estado.tab === "planes") pintarPlanes();
      aviso(id ? "Plan asignado al " + DIAS_LARGOS[DIAS.indexOf(dia)].toLowerCase() : "Día de descanso");
      break;
    }
    case "entrenar-plan": {
      cerrarHoja();
      if (id) irEntrenar(id);
      break;
    }

    case "iniciar": {
      const plan = planPorId(estado.planId);
      if (plan) iniciarEntrenamiento(plan, 0);
      break;
    }
    case "pausa": pausar(); break;
    case "saltar": saltar(); break;
    case "extra": masTiempo(); break;
    case "voz": {
      runner.voz = !runner.voz;
      estado.config.voz = runner.voz;
      $("#btn-voz").classList.toggle("mute", !runner.voz);
      if (!runner.voz && "speechSynthesis" in window) window.speechSynthesis.cancel();
      await guardarConfig();
      aviso(runner.voz ? "Voz activada" : "Voz silenciada");
      break;
    }
    case "salir-runner": pedirSalirRunner(); break;
    case "cerrar-resumen": mostrar("inicio"); pintarInicio(); break;

    case "nuevo-ejercicio": abrirEditorEjercicio(null); break;
    case "editar-ejercicio": abrirEditorEjercicio(id); break;
    case "tipo-ejercicio": {
      if (!estado.borradorEj) break;
      estado.borradorEj.tipo = el.dataset.tipo;
      $("#hoja-cuerpo").innerHTML = htmlEditorEjercicio();
      break;
    }
    case "editor-step": {
      const ej = estado.borradorEj;
      if (!ej) break;
      const campo = el.dataset.campo;
      const delta = Number(el.dataset.delta);
      const min = Number(el.dataset.min);
      const max = Number(el.dataset.max);
      ej[campo] = clamp((Number(ej[campo]) || 0) + delta, min, max);
      ej.aguanteAbajoSeg = clamp(Number(ej.aguanteAbajoSeg) || 0, 0, Number(ej.bajadaSeg) || 0);
      ej.aguanteArribaSeg = clamp(Number(ej.aguanteArribaSeg) || 0, 0, Number(ej.subidaSeg) || 0);
      $("#hoja-cuerpo").innerHTML = htmlEditorEjercicio();
      break;
    }
    case "guardar-ejercicio": await guardarEjercicio(); break;
    case "borrar-ejercicio": borrarEjercicio(); break;

    case "nuevo-plan": await abrirEditorPlan(null); break;
    case "editar-plan": await abrirEditorPlan(id); break;
    case "plan-color": {
      if (!estado.planBorrador) break;
      estado.planBorrador.color = el.dataset.color;
      await persistirPlan();
      $("#hoja-cuerpo").innerHTML = htmlEditorPlan();
      break;
    }
    case "plan-dia": {
      const plan = estado.planBorrador;
      if (!plan) break;
      const dia = el.dataset.dia;
      if (estado.semana[dia] === plan.id) estado.semana[dia] = null;
      else estado.semana[dia] = plan.id;
      await guardarSemana();
      $("#hoja-cuerpo").innerHTML = htmlEditorPlan();
      break;
    }
    case "plan-subir":
    case "plan-bajar": {
      const plan = estado.planBorrador;
      if (!plan) break;
      const i = plan.entradas.findIndex(e => e.uid === uidEnt);
      const j = accion === "plan-subir" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= plan.entradas.length) break;
      const aux = plan.entradas[i];
      plan.entradas[i] = plan.entradas[j];
      plan.entradas[j] = aux;
      await persistirPlan();
      $("#hoja-cuerpo").innerHTML = htmlEditorPlan();
      break;
    }
    case "plan-duplicar": {
      const plan = estado.planBorrador;
      if (!plan) break;
      const i = plan.entradas.findIndex(e => e.uid === uidEnt);
      if (i < 0) break;
      const copia = Object.assign({}, plan.entradas[i], { uid: uid() });
      plan.entradas.splice(i + 1, 0, copia);
      await persistirPlan();
      $("#hoja-cuerpo").innerHTML = htmlEditorPlan();
      aviso("Serie duplicada");
      break;
    }
    case "plan-borrar-entrada": {
      const plan = estado.planBorrador;
      if (!plan) break;
      plan.entradas = plan.entradas.filter(e => e.uid !== uidEnt);
      await persistirPlan();
      $("#hoja-cuerpo").innerHTML = htmlEditorPlan();
      break;
    }
    case "editar-entrada": abrirEditorEntrada(uidEnt); break;
    case "añadir-entrada": abrirSelectorEjercicio(); break;
    case "agregar-entrada": await agregarEntrada(id); break;
    case "volver-plan":
      estado.hojaTipo = "editor-plan";
      $("#hoja-titulo").textContent = "Editar plan";
      $("#hoja-cuerpo").innerHTML = htmlEditorPlan();
      break;
    case "borrar-plan": {
      const plan = estado.planBorrador;
      if (!plan) break;
      confirmar("Eliminar plan", "¿Eliminar el plan \"" + plan.nombre + "\" de la lista y de la semana?", "Eliminar", async () => {
        DIAS.forEach(d => { if (estado.semana[d] === plan.id) estado.semana[d] = null; });
        await guardarSemana();
        await dbBorrar("planes", plan.id);
        estado.planes = estado.planes.filter(p => p.id !== plan.id);
        cerrarHoja();
        pintarPlanes();
        pintarInicio();
        aviso("Plan eliminado");
      });
      break;
    }
    case "entrada-step": {
      const plan = estado.planBorrador;
      const ent = plan && plan.entradas.find(e => e.uid === estado.entradaUid);
      if (!ent) break;
      const campo = el.dataset.campo;
      const delta = Number(el.dataset.delta);
      const min = Number(el.dataset.min);
      const max = Number(el.dataset.max);
      ent[campo] = clamp((Number(ent[campo]) || 0) + delta, min, max);
      ent.aguanteAbajoSeg = clamp(Number(ent.aguanteAbajoSeg) || 0, 0, Number(ent.bajadaSeg) || 0);
      ent.aguanteArribaSeg = clamp(Number(ent.aguanteArribaSeg) || 0, 0, Number(ent.subidaSeg) || 0);
      await persistirPlan();
      refrescarEditorEntrada();
      break;
    }
    case "entrada-borrar": {
      const plan = estado.planBorrador;
      if (!plan) break;
      plan.entradas = plan.entradas.filter(e => e.uid !== estado.entradaUid);
      await persistirPlan();
      estado.hojaTipo = "editor-plan";
      $("#hoja-titulo").textContent = "Editar plan";
      $("#hoja-cuerpo").innerHTML = htmlEditorPlan();
      break;
    }
    case "toggle-config": {
      const clave = el.dataset.clave;
      estado.config[clave] = !estado.config[clave];
      if (clave === "voz") runner.voz = estado.config.voz;
      await guardarConfig();
      pintarAjustes();
      break;
    }
    case "step-config": {
      const clave = el.dataset.clave || el.dataset.campo;
      const delta = Number(el.dataset.delta);
      const min = Number(el.dataset.min);
      const max = Number(el.dataset.max);
      estado.config[clave] = clamp((Number(estado.config[clave]) || 0) + delta, min, max);
      await guardarConfig();
      pintarAjustes();
      break;
    }
    case "exportar": await exportar(); break;
    case "importar": $("#input-importar").click(); break;
    case "borrar-historial": {
      confirmar("Borrar historial", "Se eliminarán todos los entrenamientos guardados y la racha. ¿Continuar?", "Borrar", async () => {
        await dbLimpiar("historial");
        estado.historial = [];
        pintarAjustes();
        pintarInicio();
        aviso("Historial borrado");
      });
      break;
    }
    case "cerrar-hoja": cerrarHoja(); break;
    case "confirmar-accion": {
      const fn = estado.confirmarAccion;
      estado.confirmarAccion = null;
      if (fn) await fn();
      cerrarHoja();
      break;
    }

    default: break;
  }
});

/* ---------------- campos de texto y archivos ---------------- */

function objetoStepper(scope) {
  if (scope === "config") return estado.config;
  if (scope === "ejercicio") return estado.borradorEj;
  if (scope === "entrada") {
    const plan = estado.planBorrador;
    if (!plan) return null;
    return plan.entradas.find(e => e.uid === estado.entradaUid) || null;
  }
  return null;
}

function sincronizarSteppers(scope) {
  const obj = objetoStepper(scope);
  if (!obj) return;
  $$(".stepper-input").forEach(inp => {
    if (inp.dataset.scope !== scope) return;
    inp.value = String(Number(obj[inp.dataset.campo]) || 0);
  });
}

function actualizarTotalEntrada() {
  const plan = estado.planBorrador;
  const ent = plan && plan.entradas.find(e => e.uid === estado.entradaUid);
  if (!ent) return;
  const ej = ejercicioPorId(ent.ejercicioId);
  if (!ej) return;
  const tiempo = esDescanso(ej)
    ? Math.max(1, Number(ent.segundos) || 60)
    : Math.max(1, Number(ent.reps) || 1) * ((Number(ent.bajadaSeg) || 0) + (Number(ent.subidaSeg) || 0));
  const total = $("#hoja-cuerpo .total-plan strong");
  if (total) total.textContent = fmtTiempo(tiempo);
  const nota = $("#hoja-cuerpo .editor > .nota");
  if (nota) nota.textContent = ej.nombre + (esDescanso(ej) ? "" : " · Serie " + (Number(ent.reps) || 1) + " reps");
}

function normalizarStepper(input) {
  const scope = input.dataset.scope;
  const campo = input.dataset.campo;
  const obj = objetoStepper(scope);
  if (!obj) return;
  const min = Number(input.dataset.min) || 0;
  const max = Number(input.dataset.max);
  let v = Math.round(Number(input.value));
  if (input.value === "" || !isFinite(v)) v = min;
  obj[campo] = clamp(v, min, isFinite(max) ? max : 900);
  if (scope !== "config") {
    obj.aguanteAbajoSeg = clamp(Number(obj.aguanteAbajoSeg) || 0, 0, Number(obj.bajadaSeg) || 0);
    obj.aguanteArribaSeg = clamp(Number(obj.aguanteArribaSeg) || 0, 0, Number(obj.subidaSeg) || 0);
  }
  sincronizarSteppers(scope);
  if (scope === "config") {
    guardarConfig();
  } else if (scope === "entrada") {
    persistirPlan();
    actualizarTotalEntrada();
  }
}

document.addEventListener("input", (ev) => {
  const t = ev.target;
  if (t.classList && t.classList.contains("stepper-input")) {
    const obj = objetoStepper(t.dataset.scope);
    if (!obj) return;
    const n = Number(t.value);
    obj[t.dataset.campo] = t.value === "" ? 0 : (isFinite(n) ? n : 0);
    if (t.dataset.scope === "entrada") actualizarTotalEntrada();
    return;
  }
  if (t.id === "ej-nombre" && estado.borradorEj) estado.borradorEj.nombre = t.value;
  else if (t.id === "ej-emoji" && estado.borradorEj) estado.borradorEj.emoji = t.value;
  else if (t.id === "ej-grupo" && estado.borradorEj) estado.borradorEj.grupo = t.value;
  else if (t.id === "plan-nombre" && estado.planBorrador) {
    const plan = estado.planBorrador;
    plan.nombre = t.value;
    clearTimeout(planNombreTimer);
    planNombreTimer = setTimeout(() => {
      dbGuardar("planes", plan).then(ordenarPlanes).catch(() => {});
    }, 400);
  }
});

document.addEventListener("change", async (ev) => {
  const t = ev.target;

  if (t.classList && t.classList.contains("stepper-input")) {
    normalizarStepper(t);
    return;
  }

  if (t.matches("[data-foto]")) {
    const archivo = t.files && t.files[0];
    if (!archivo || !estado.borradorEj) return;
    try {
      const blob = await comprimirImagen(archivo);
      if (t.dataset.foto === "inicial") estado.borradorEj.fotoInicial = blob;
      else estado.borradorEj.fotoFinal = blob;
      $("#hoja-cuerpo").innerHTML = htmlEditorEjercicio();
      aviso("Foto lista");
    } catch (e) {
      aviso("No se pudo leer la imagen");
    }
    t.value = "";
    return;
  }

  if (t.id === "input-importar") {
    const archivo = t.files && t.files[0];
    t.value = "";
    if (archivo) await importarArchivo(archivo);
  }
});

/* ---------------- pantalla y bloqueo ---------------- */

document.addEventListener("visibilitychange", () => {
  if (!runner.activo) return;
  if (document.hidden) {
    if (runner.corriendo) {
      pausar();
      runner.autoPausa = true;
    }
  } else {
    pedirWakeLock();
    if (runner.autoPausa) {
      runner.autoPausa = false;
      aviso("Entrenamiento en pausa");
    }
  }
});

/* ---------------- arranque ---------------- */

async function iniciarApp() {
  try {
    await cargarTodo();
  } catch (e) {
    aviso("No se pudieron cargar los datos");
  }
  pintarInicio();
  mostrar("inicio");

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

iniciarApp();

})();

