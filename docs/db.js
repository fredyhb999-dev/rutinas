"use strict";
/* RUTINAS · capa de datos (IndexedDB) */

const DB_NOMBRE = "rutinas-db";
const DB_VERSION = 1;
const CLAVE_CONFIG = "config";
const CLAVE_SEMANA = "semana";

const DIAS_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

const CONFIG_DEFECTO = {
  clave: CLAVE_CONFIG,
  voz: true,
  pitidos: true,
  vibracion: true,
  prepSeg: 3,
  descansoSeg: 60,
  wakeLock: true
};

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

let _db = null;

function abrirDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolver, rechazar) => {
    const req = indexedDB.open(DB_NOMBRE, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("ejercicios")) db.createObjectStore("ejercicios", { keyPath: "id" });
      if (!db.objectStoreNames.contains("planes")) db.createObjectStore("planes", { keyPath: "id" });
      if (!db.objectStoreNames.contains("ajustes")) db.createObjectStore("ajustes", { keyPath: "clave" });
      if (!db.objectStoreNames.contains("semana")) db.createObjectStore("semana", { keyPath: "clave" });
      if (!db.objectStoreNames.contains("historial")) db.createObjectStore("historial", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => { _db = req.result; resolver(_db); };
    req.onerror = () => rechazar(req.error);
  });
}

async function dbTodos(tabla) {
  const db = await abrirDB();
  return new Promise((res, rej) => {
    const r = db.transaction(tabla, "readonly").objectStore(tabla).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function dbUno(tabla, clave) {
  const db = await abrirDB();
  return new Promise((res, rej) => {
    const r = db.transaction(tabla, "readonly").objectStore(tabla).get(clave);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function dbGuardar(tabla, valor) {
  const db = await abrirDB();
  return new Promise((res, rej) => {
    const t = db.transaction(tabla, "readwrite");
    t.objectStore(tabla).put(valor);
    t.oncomplete = () => res(valor);
    t.onerror = () => rej(t.error);
  });
}

async function dbBorrar(tabla, clave) {
  const db = await abrirDB();
  return new Promise((res, rej) => {
    const t = db.transaction(tabla, "readwrite");
    t.objectStore(tabla).delete(clave);
    t.oncomplete = () => res(true);
    t.onerror = () => rej(t.error);
  });
}

async function dbLimpiar(tabla) {
  const db = await abrirDB();
  return new Promise((res, rej) => {
    const t = db.transaction(tabla, "readwrite");
    t.objectStore(tabla).clear();
    t.oncomplete = () => res(true);
    t.onerror = () => rej(t.error);
  });
}
/* ---------- datos iniciales ---------- */

function entradaInicial(ejercicioId, reps, bajadaSeg, subidaSeg, aguanteAbajoSeg, aguanteArribaSeg, descansoSeg) {
  return {
    uid: uid(),
    ejercicioId: ejercicioId,
    reps: reps,
    bajadaSeg: bajadaSeg,
    subidaSeg: subidaSeg,
    aguanteAbajoSeg: aguanteAbajoSeg,
    aguanteArribaSeg: aguanteArribaSeg,
    descansoSeg: descansoSeg,
    segundos: 60
  };
}

const EJERCICIOS_INICIALES = [
  { id: "ej-lagartijas", nombre: "Lagartijas inclinadas", tipo: "reps", emoji: "💪", grupo: "Tren superior", reps: 8, bajadaSeg: 2, subidaSeg: 2, aguanteAbajoSeg: 1, aguanteArribaSeg: 1, descansoSeg: 60, orden: 1, fotoInicial: null, fotoFinal: null, etiquetaAbajo: "ABAJO", etiquetaArriba: "ARRIBA" },
  { id: "ej-puentes", nombre: "Puentes", tipo: "reps", emoji: "🌉", grupo: "Glúteos y core", reps: 10, bajadaSeg: 2, subidaSeg: 2, aguanteAbajoSeg: 1, aguanteArribaSeg: 1, descansoSeg: 60, orden: 2, fotoInicial: null, fotoFinal: null, etiquetaAbajo: "ABAJO", etiquetaArriba: "ARRIBA" },
  { id: "ej-sentadillas", nombre: "Sentadillas", tipo: "reps", emoji: "🦵", grupo: "Piernas", reps: 8, bajadaSeg: 3, subidaSeg: 3, aguanteAbajoSeg: 2, aguanteArribaSeg: 2, descansoSeg: 60, orden: 3, fotoInicial: null, fotoFinal: null, etiquetaAbajo: "ABAJO", etiquetaArriba: "ARRIBA" },
  { id: "ej-desplantes", nombre: "Desplantes alternados", tipo: "reps", emoji: "🚶", grupo: "Piernas", reps: 16, bajadaSeg: 4, subidaSeg: 2, aguanteAbajoSeg: 3, aguanteArribaSeg: 1, descansoSeg: 60, orden: 4, fotoInicial: null, fotoFinal: null, etiquetaAbajo: "ATRÁS", etiquetaArriba: "ADELANTE" },
  { id: "ej-descanso", nombre: "Descanso", tipo: "descanso", emoji: "⏸️", grupo: "", segundos: 60, orden: 10, fotoInicial: null, fotoFinal: null }
];

function planInicial() {
  const entradas = [];
  let i;
  for (i = 0; i < 3; i++) entradas.push(entradaInicial("ej-lagartijas", 8, 2, 2, 1, 1, 60));
  for (i = 0; i < 3; i++) entradas.push(entradaInicial("ej-puentes", 10, 2, 2, 1, 1, 60));
  for (i = 0; i < 4; i++) entradas.push(entradaInicial("ej-sentadillas", 8, 3, 3, 2, 2, 60));
  for (i = 0; i < 3; i++) entradas.push(entradaInicial("ej-desplantes", 16, 4, 2, 3, 1, 60));
  return {
    id: "plan-cuerpo-completo",
    nombre: "Cuerpo completo",
    color: "#c6ff3d",
    entradas: entradas
  };
}

async function sembrarSiHaceFalta() {
  const config = await dbUno("ajustes", CLAVE_CONFIG);
  if (config) return false;

  await dbGuardar("ajustes", Object.assign({}, CONFIG_DEFECTO));

  let i;
  for (i = 0; i < EJERCICIOS_INICIALES.length; i++) {
    await dbGuardar("ejercicios", Object.assign({}, EJERCICIOS_INICIALES[i]));
  }

  await dbGuardar("planes", planInicial());

  const semana = { clave: CLAVE_SEMANA };
  const dias = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
  for (i = 0; i < dias.length; i++) {
    const d = dias[i];
    semana[d] = (d === "lunes" || d === "miercoles" || d === "viernes") ? "plan-cuerpo-completo" : null;
  }
  await dbGuardar("semana", semana);
  return true;
}

