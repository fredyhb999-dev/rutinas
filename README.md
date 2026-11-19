# Rutinas

App personal para seguir rutinas de ejercicio desde el celular: planes por día,
tiempos guiados (bajada y subida, en el orden que elijas, con aguantes), descansos,
fotos de cada movimiento, voz en español, vibración e historial.

Es una PWA sin frameworks ni compilación: se sirve tal cual desde GitHub Pages, con los archivos en la carpeta `docs/`.

## Usar en el Android

1. Abrir `https://fredyhb999-dev.github.io/rutinas/` en Chrome.
2. Menú (⋮) → **Instalar app** / **Añadir a pantalla de inicio**.
3. Abrir desde el icono. Funciona sin internet una vez instalada.
Nota: La app está en `docs/` y GitHub Pages la publica desde ahí.

Durante el entrenamiento la app pide mantener la pantalla encendida y se pausa
sola si sales o el teléfono se bloquea.

## APK (Capacitor)

El proyecto también se empaqueta como APK con Capacitor. La carpeta `docs/` es a la
vez la app web y lo que se copia al APK: se edita una sola vez.

Dentro del APK la app no es Chrome, es un WebView, y le faltan cosas del navegador.
Por eso se usan los plugins nativos, con la versión web como respaldo:

| Función | En la PWA | En el APK |
|---|---|---|
| Vibración | `navigator.vibrate` | `@capacitor/haptics` |
| Voz | `speechSynthesis` | `@capacitor-community/text-to-speech` |
| Pantalla encendida | `wakeLock` | respaldo con audio silencioso |
| Botón atrás | historial del navegador | `@capacitor/app` |

Para recompilar el APK después de cambiar `docs/`:

```powershell
npx cap sync android
cd android
.\gradlew.bat assembleRelease
```

El APK firmado queda en `android/app/build/outputs/apk/release/app-release.apk`.
La llave de firma y sus cuidados están en `AGENTS.md`.

## Pantallas

- **Inicio**: plan de hoy, duración, racha, semana, historial reciente y el botón
  de ejercicio rápido (🏃) para improvisar una sesión sin crear un plan.
- **Entrenar**: vista previa del plan y botón para comenzar.
- **Runner**: foto del movimiento, cuenta atrás, series/reps, pausa, saltar,
  +30 s de descanso y botón para silenciar la voz.
- **Configuración** (engranaje): Ejercicios (con buscador y deslizar para
  eliminar), Planes y Ajustes. En Ajustes están **Idioma y voz** y **Probar voz**.

## Ejercicios

Cada ejercicio tiene dos fotos (posición inicial y final), repeticiones y
tiempos: bajada y subida, cada una con su aguante. Los aguantes son parte del
tiempo de cada fase (si están en 0, la fase es solo movimiento). El ejercicio
elige si empieza bajando o subiendo, y los dos movimientos pueden llamarse
distinto (ABAJO/ARRIBA, ATRÁS/ADELANTE). También puede llevar un peso opcional,
que solo se muestra mientras se entrena.

"Descanso" es un ejercicio más: se puede insertar donde quieras, repetirlo
tantas veces como necesites y ajustar sus segundos. Además, cada serie tiene su
propio "descanso después".

## Datos y respaldo

Todo (ejercicios, fotos, planes, historial) se guarda en el navegador del
teléfono con IndexedDB. **No se sube nada a GitHub.**

Para no perderlo: **Ajustes → Exportar respaldo**. Guarda ese `.json` fuera de
esta carpeta (no lo subas al repo). Para restaurar: **Importar respaldo**.

Además, en Ajustes se puede **exportar/importar un solo plan**. El archivo
incluye el plan y los ejercicios que usa, con sus fotos. Al importar, si el plan
o un ejercicio ya existen se actualizan con lo que trae el archivo (los campos
vacíos o en 0 respetan lo que ya hay); si no, se agregan. La semana, el historial
y los ajustes solo van en el respaldo completo. El formato del archivo está en
[`FORMATO-PLAN.md`](FORMATO-PLAN.md).

## Publicar cambios

1. Editar los archivos de esta carpeta.
2. En GitHub Desktop: escribir el resumen → **Commit to main** → **Push origin**.
3. Si cambió algún archivo cacheado, subir la versión en `sw.js`
   (`const CACHE = "rutinas-v2";`) para que el teléfono reciba la actualización.
4. En GitHub Pages tarda 1–2 minutos.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | Estructura de las pantallas |
| `estilos.css` | Diseño oscuro/deportivo, mobile-first |
| `app.js` | Lógica, cronómetro, voz, pantalla encendida |
| `db.js` | IndexedDB y datos iniciales |
| `manifest.webmanifest` | Instalación como app |
| `sw.js` | Funcionamiento sin internet |
| `iconos/` | Iconos de la app |

## Notas técnicas

- Pantalla encendida: Screen Wake Lock API (requiere HTTPS; GitHub Pages lo da).
  Si el navegador no la soporta, se usa audio silencioso como respaldo.
- La voz prefiere español de México, luego español de EE. UU., luego inglés de
  EE. UU.; si no hay ninguno, usa la voz por defecto del teléfono.
- En Ajustes → Idioma y voz se puede elegir un idioma o una voz concreta de las
  instaladas; si no se elige nada, se usa el orden automático.
- Si la voz efectiva es inglesa, las frases fijas se dicen en inglés; los nombres
  de ejercicios y las etiquetas propias se quedan como están.
- El botón **Atrás** del teléfono navega hacia el inicio y cierra las hojas; en el
  inicio pide un segundo atrás para salir.
- El cronómetro se basa en `performance.now()` y se pausa al ocultar la app.
- Los tiempos son orientativos: no sustituyen supervisión profesional.
