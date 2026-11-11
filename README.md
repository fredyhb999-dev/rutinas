# Rutinas

App personal para seguir rutinas de ejercicio desde el celular: planes por día,
tiempos guiados (bajada, aguante, subida), descansos, fotos de cada movimiento,
voz en español, vibración e historial.

Es una PWA sin frameworks ni compilación: se sirve tal cual desde GitHub Pages.

## Usar en el Android

1. Abrir `https://fredyhb999-dev.github.io/rutinas/` en Chrome.
2. Menú (⋮) → **Instalar app** / **Añadir a pantalla de inicio**.
3. Abrir desde el icono. Funciona sin internet una vez instalada.

Durante el entrenamiento la app pide mantener la pantalla encendida y se pausa
sola si sales o el teléfono se bloquea.

## Pantallas

- **Inicio**: plan de hoy, duración, racha, semana e historial reciente.
- **Entrenar**: vista previa del plan y botón para comenzar.
- **Runner**: foto del movimiento, cuenta atrás, series/reps, pausa, saltar,
  +30 s de descanso y botón para silenciar la voz.
- **Configuración** (engranaje): Ejercicios, Planes y Ajustes.

## Ejercicios

Cada ejercicio tiene dos fotos (posición inicial y final), repeticiones y
tiempos: bajada, aguante abajo, subida y aguante arriba. Los aguantes son parte
del tiempo de cada fase (si están en 0, la fase es solo movimiento).

"Descanso" es un ejercicio más: se puede insertar donde quieras, repetirlo
tantas veces como necesites y ajustar sus segundos. Además, cada serie tiene su
propio "descanso después".

## Datos y respaldo

Todo (ejercicios, fotos, planes, historial) se guarda en el navegador del
teléfono con IndexedDB. **No se sube nada a GitHub.**

Para no perderlo: **Ajustes → Exportar respaldo**. Guarda ese `.json` fuera de
esta carpeta (no lo subas al repo). Para restaurar: **Importar respaldo**.

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
- El cronómetro se basa en `performance.now()` y se pausa al ocultar la app.
- Los tiempos son orientativos: no sustituyen supervisión profesional.
