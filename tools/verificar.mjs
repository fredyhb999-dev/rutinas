// Verificación única de Rutinas.
// Se corre con:  npm run verificar
// Revisa que no se haya roto nada y sale con código 1 si algo está mal.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const problemas = [];
const avisos = [];

const ruta = (...partes) => join(raiz, ...partes);
const leer = (...partes) => readFileSync(ruta(...partes), "utf8");

/* 1. Sintaxis de los JavaScript de la app */
const ARCHIVOS_JS = ["docs/app.js", "docs/db.js", "docs/sw.js"];
for (const archivo of ARCHIVOS_JS) {
  if (!existsSync(ruta(archivo))) {
    problemas.push(`Falta el archivo ${archivo}`);
    continue;
  }
  try {
    execFileSync(process.execPath, ["--check", ruta(archivo)], { stdio: "pipe" });
  } catch (error) {
    const lineas = String(error.stderr || error.message || "")
      .trim()
      .split("\n")
      .map((linea) => linea.trim())
      .filter(Boolean);
    const referencia = (lineas[0] || "").split("\\").pop();
    const mensaje = lineas.find((linea) => /Error/.test(linea)) || "";
    problemas.push(
      `Error de sintaxis en ${archivo}` +
        (mensaje ? `: ${mensaje}` : "") +
        (referencia ? `\n    ${referencia}` : "")
    );
  }
}

/* 2. JSON bien formados */
const ARCHIVOS_JSON = ["package.json", "capacitor.config.json", "docs/manifest.webmanifest"];
for (const archivo of ARCHIVOS_JSON) {
  if (!existsSync(ruta(archivo))) {
    problemas.push(`Falta el archivo ${archivo}`);
    continue;
  }
  try {
    JSON.parse(leer(archivo));
  } catch (error) {
    problemas.push(`JSON mal formado en ${archivo}: ${error.message}`);
  }
}

/* 3. La versión del caché tiene que coincidir con el ?v= del index.html.
      Si no coinciden, el teléfono se queda con la versión vieja de app.js. */
let versionCache = null;
let versionHtml = null;
if (existsSync(ruta("docs/sw.js"))) {
  const encontrado = leer("docs/sw.js").match(/const\s+CACHE\s*=\s*"rutinas-v(\d+)"/);
  if (encontrado) versionCache = encontrado[1];
  else problemas.push('docs/sw.js no tiene una línea como: const CACHE = "rutinas-vN";');
}
if (existsSync(ruta("docs/index.html"))) {
  const encontrado = leer("docs/index.html").match(/app\.js\?v=(\d+)/);
  if (encontrado) versionHtml = encontrado[1];
  else problemas.push('docs/index.html no pide app.js?v=N (sin eso, el caché puede servir la versión vieja).');
}
if (versionCache && versionHtml && versionCache !== versionHtml) {
  problemas.push(
    `La versión no coincide: sw.js dice v${versionCache} y index.html pide v${versionHtml}. ` +
      "Sube las dos al mismo número."
  );
}

/* 4. Lo que está en docs/ tiene que ser lo mismo que quedó dentro del APK.
      Si cambió y no se corrió "npx cap sync android", el APK lleva el código viejo. */
const CARPETA_APK = "android/app/src/main/assets/public";
const ARCHIVOS_APK = ["app.js", "db.js", "sw.js", "index.html", "estilos.css"];
if (existsSync(ruta(CARPETA_APK))) {
  for (const archivo of ARCHIVOS_APK) {
    const origen = ruta("docs", archivo);
    const copia = ruta(CARPETA_APK, archivo);
    if (!existsSync(copia)) {
      problemas.push(`El APK no tiene ${archivo}. Corre: npx cap sync android`);
      continue;
    }
    if (!readFileSync(origen).equals(readFileSync(copia))) {
      problemas.push(`docs/${archivo} cambió y el APK quedó con la versión vieja. Corre: npx cap sync android`);
    }
  }
} else {
  avisos.push("No hay carpeta de Android: se saltó la comparación con el APK.");
}

/* Resultado */
if (problemas.length) {
  console.log("");
  console.log("PROBLEMAS:");
  for (const problema of problemas) console.log("  - " + problema);
  console.log("");
  process.exit(1);
}

for (const aviso of avisos) console.log("Aviso: " + aviso);
console.log(
  `Todo bien: ${ARCHIVOS_JS.length} archivos de JavaScript, ${ARCHIVOS_JSON.length} JSON, ` +
    `caché v${versionCache || "?"} y APK al día.`
);
