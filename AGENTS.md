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
- La voz usa el **motor del teléfono**; si no tiene español, se avisa y se sigue.
- El APK se instala **por fuera de la tienda**; no hay Play Store de por medio.

## Pendiente

- **Flujo de GitHub Actions** (`apk.yml` está roto y no se usa todavía).
