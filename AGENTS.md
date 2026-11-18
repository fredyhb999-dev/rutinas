# AGENTS.md — Rutinas

Lo general (cómo trabajamos) está en el `AGENTS.md` global. Aquí solo lo de este
proyecto.

## Qué es

App personal para seguir rutinas de ejercicio: planes por día, tiempos guiados con
voz y vibración, fotos de cada movimiento e historial.

## Cómo está hecha

- **HTML, CSS y JavaScript puro** en `docs/`. Sin framework, sin bundler, sin build.
- **Capacitor 8** empaqueta `docs/` en un APK de Android.
- La carpeta `docs/` es **la única fuente**: es la web (GitHub Pages) y también lo
  que se copia al APK. No hay dos versiones del código.
- Los datos viven en **IndexedDB**, en el teléfono. No se sube nada a ningún
  servidor.

## APK no es igual a PWA (lo más importante de este proyecto)

Dentro del APK la app corre en un **WebView**, que no es Chrome y le faltan APIs.
Por eso cada función dudosa lleva dos caminos:

| Función | En la PWA | En el APK |
|---|---|---|
| Vibración | `navigator.vibrate` | `@capacitor/haptics` |
| Voz | `speechSynthesis` | `@capacitor-community/text-to-speech` |
| Pantalla encendida | `wakeLock` | audio silencioso de respaldo |

Los plugins se leen con `pluginNativo("Nombre")` en `docs/app.js`: si no hay
Capacitor, cae a la versión web. **Ninguna función nativa se deja sin respaldo
web**, o la PWA se rompe.

## Compilar el APK

```powershell
npx cap sync android
cd android
.\gradlew.bat assembleRelease
```

Queda en `android/app/build/outputs/apk/release/app-release.apk`.

`npx cap sync` es obligatorio después de tocar `docs/`; si no, el APK lleva el
código viejo. `assembleDebug` sigue sirviendo para pruebas rápidas, pero **el APK
que se instala es el release**.

## Firma (llave)

- La llave está **fuera del repositorio**: `C:\Users\Fred\Llaves\rutinas.jks`,
  alias `rutinas`.
- Sus datos están en `android/keystore.properties`, que está en `.gitignore` y
  **nunca se sube**.
- `android/app/build.gradle` lee ese archivo. Si no existe (otra computadora, o
  GitHub Actions sin configurar), compila con la firma de prueba en vez de
  romperse.
- **Esta llave es la única que puede actualizar la app instalada.** Si se pierde,
  esa app ya no se puede actualizar: habría que desinstalar y perder los datos.
  La contraseña no va en la documentación ni en el repositorio.

## Iconos

La imagen de origen es `docs/iconos/icono-512.png`; de ahí salen los iconos de la
web y los del APK (`android/app/src/main/res/mipmap-*`). Los del APK son **tres
variantes** por resolución: cuadrado, redondo y el adaptativo (fondo + frente
recortable), porque Android 8 en adelante recorta el icono con una máscara.

Si se cambia la imagen de origen, hay que regenerar los dos juegos y recompilar. El
icono que se ve al abrir la app es aparte: es el *splash* (`res/drawable*/splash.png`).

## Caché (el error que más cuesta)

El `sw.js` guarda los archivos para funcionar sin internet, y ese caché
**sobrevive a las actualizaciones**. Al cambiar un archivo cacheado:

1. Subir la versión en `docs/sw.js`: `const CACHE = "rutinas-vN"`.
2. Subir el `?v=N` del `<script>` de `app.js` en `docs/index.html`.

Dentro del APK el service worker se apaga y se limpia; ahí no aplica.

## Publicar la web

GitHub Desktop → commit → push. Pages publica `docs/` y tarda 1–2 minutos.

## Verificación

Después de cada cambio se corre **un solo comando** (`npm run verificar`) y tiene
que salir en verde. Revisa la sintaxis de los `.js`, que los `.json` estén bien
formados, que la versión del `sw.js` coincida con el `?v=` del `index.html`, y que
lo que hay en `docs/` sea lo mismo que quedó dentro del APK.

## Decisiones tomadas (no volver a preguntar)

- Los datos son **locales**: sin cuentas, sin servidor, sin nube.
- El respaldo es **exportar/importar un JSON**; no se sincroniza solo.
- La voz usa el **motor del teléfono**. Prefiere español de México, luego español
  de EE. UU., luego inglés de EE. UU.; si no hay ninguno, el idioma por defecto.
  En Ajustes se puede elegir un idioma o una voz concreta. Si la voz es inglesa,
  las frases fijas se dicen en inglés.
- El APK se instala **por fuera de la tienda**; no hay Play Store de por medio.
- Cada ejercicio elige si empieza por la bajada o por la subida, y sus dos movimientos
  pueden llamarse distinto (ABAJO/ARRIBA, ATRÁS/ADELANTE). Las series copian el orden
  del ejercicio y pueden cambiarlo.
- El peso es un dato informativo del ejercicio: se captura al crearlo o editarlo y solo
  se muestra durante el entrenamiento. No entra en cálculos ni en el historial.
- El botón de ejercicio rápido del inicio no guarda el ejercicio: hace una sesión de una
  sola serie y en el historial aparece como ⚡ Improvisado.

## Pendiente

- **Flujo de GitHub Actions**: hoy no hay workflow. El APK se compila en la
  computadora con los comandos de arriba; la web se publica sola con el push.
