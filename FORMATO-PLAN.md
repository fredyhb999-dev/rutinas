# Formato del archivo de un plan

Es el `.json` que usa **Ajustes → Importar plan de ejercicio** y el que genera
**Exportar plan de ejercicio**. Se puede editar a mano.

## Lo mínimo que necesita el archivo

Con esto ya se puede importar un plan de una serie:

```json
{
  "app": "rutinas",
  "tipo": "plan",
  "plan": {
    "nombre": "Mi plan",
    "entradas": [
      {
        "ejercicioId": "ej-sentadillas",
        "reps": 10,
        "bajadaSeg": 3,
        "subidaSeg": 3
      }
    ]
  },
  "ejercicios": [
    {
      "id": "ej-sentadillas",
      "nombre": "Sentadillas",
      "tipo": "reps",
      "reps": 10,
      "bajadaSeg": 3,
      "subidaSeg": 3
    }
  ]
}
```

Los campos que faltan toman valores por defecto. El nombre del plan y el nombre
y tipo del ejercicio son los que se usan para saber si ya existen y hay que
actualizarlos.

## Ejemplo completo

```json
{
  "app": "rutinas",
  "tipo": "plan",
  "version": 1,
  "exportado": "2026-11-18T20:00:00.000Z",
  "plan": {
    "id": "plan-ejemplo",
    "nombre": "Ejemplo",
    "color": "#c6ff3d",
    "entradas": [
      {
        "uid": "serie-1",
        "ejercicioId": "ej-sentadillas",
        "reps": 10,
        "bajadaSeg": 3,
        "subidaSeg": 3,
        "aguanteAbajoSeg": 1,
        "aguanteArribaSeg": 1,
        "descansoSeg": 60,
        "segundos": 60,
        "ordenFases": "bajada"
      },
      {
        "uid": "serie-2",
        "ejercicioId": "ej-descanso",
        "reps": 1,
        "bajadaSeg": 0,
        "subidaSeg": 0,
        "aguanteAbajoSeg": 0,
        "aguanteArribaSeg": 0,
        "descansoSeg": 0,
        "segundos": 30,
        "ordenFases": "bajada"
      }
    ]
  },
  "ejercicios": [
    {
      "id": "ej-sentadillas",
      "nombre": "Sentadillas",
      "tipo": "reps",
      "emoji": "🦵",
      "grupo": "Piernas",
      "reps": 10,
      "bajadaSeg": 3,
      "subidaSeg": 3,
      "aguanteAbajoSeg": 1,
      "aguanteArribaSeg": 1,
      "descansoSeg": 60,
      "segundos": 60,
      "etiquetaAbajo": "ABAJO",
      "etiquetaArriba": "ARRIBA",
      "ordenFases": "bajada",
      "peso": "10 kg",
      "fotoInicial": null,
      "fotoFinal": null
    },
    {
      "id": "ej-descanso",
      "nombre": "Descanso",
      "tipo": "descanso",
      "emoji": "⏸️",
      "grupo": "",
      "reps": 8,
      "bajadaSeg": 0,
      "subidaSeg": 0,
      "aguanteAbajoSeg": 0,
      "aguanteArribaSeg": 0,
      "descansoSeg": 0,
      "segundos": 30,
      "etiquetaAbajo": "ABAJO",
      "etiquetaArriba": "ARRIBA",
      "ordenFases": "bajada",
      "peso": "",
      "fotoInicial": null,
      "fotoFinal": null
    }
  ]
}
```

## Campos de arriba

| Campo | Obligatorio | Qué es |
|---|---|---|
| `app` | Sí | Tiene que ser exactamente `"rutinas"`. |
| `tipo` | Sí | Tiene que ser exactamente `"plan"`. Si no, se rechaza el archivo. |
| `version` | No | Versión del formato. Hoy es `1`. |
| `exportado` | No | Fecha en que se exportó. Es informativa. |
| `plan` | Sí | El plan (ver abajo). |
| `ejercicios` | Sí | La lista de ejercicios que usan las series del plan. |

## El plan

| Campo | Obligatorio | Qué es |
|---|---|---|
| `id` | No | Identificador del plan. Al importar **no se usa**: el plan se busca por nombre; si ya existe se conserva su identificador y sus días. |
| `nombre` | Sí | Nombre del plan. Es la clave para actualizar uno existente (no distingue mayúsculas ni acentos). |
| `color` | No | Color en formato `#RRGGBB`. Si falta o no es válido, se conserva el que ya tenía o se pone uno de la app. |
| `entradas` | Sí | Las series del plan. Debe tener al menos una. |

## Cada serie (`entradas`)

| Campo | Obligatorio | Qué es |
|---|---|---|
| `uid` | No | Identificador interno de la serie. Al importar se genera uno nuevo. |
| `ejercicioId` | Sí | Tiene que coincidir con el `id` de un ejercicio de la lista `ejercicios`. |
| `reps` | Sí | Repeticiones de la serie. Número entero, mínimo 1. |
| `bajadaSeg` | No | Segundos del movimiento de bajada. `0` significa que no hay bajada. |
| `subidaSeg` | No | Segundos del movimiento de subida. `0` significa que no hay subida. |
| `aguanteAbajoSeg` | No | Segundos de aguante al final de la bajada. No puede ser mayor que `bajadaSeg`. |
| `aguanteArribaSeg` | No | Segundos de aguante al final de la subida. No puede ser mayor que `subidaSeg`. |
| `descansoSeg` | No | Segundos de descanso después de esta serie. En la última serie no se usa. |
| `segundos` | No | Duración de la serie cuando el ejercicio es de tipo `descanso`. En ejercicios normales no se usa. |
| `ordenFases` | No | `"bajada"` o `"subida"`: con qué movimiento empieza la repetición. Si falta, es `"bajada"`. |

## Cada ejercicio (`ejercicios`)

| Campo | Obligatorio | Qué es |
|---|---|---|
| `id` | Sí | Identificador interno. Las series lo usan en `ejercicioId`. Si ya existe uno con el mismo `id` y el mismo tipo, se actualiza. |
| `nombre` | Sí | Nombre visible. Si no coincide el `id`, se busca por nombre y tipo para actualizar en vez de duplicar. |
| `tipo` | No | `"reps"` o `"descanso"`. Si falta, `"reps"`. |
| `emoji` | No | El emoji del ejercicio. Si falta, se pone 💪 (o ⏸️ si es descanso). |
| `grupo` | No | Grupo para organizarlo (por ejemplo `"Piernas"`). |
| `reps` | No | Repeticiones por defecto para series nuevas. La serie del plan manda con su propio `reps`. |
| `bajadaSeg` | No | Tiempo por defecto de la bajada para series nuevas. |
| `subidaSeg` | No | Tiempo por defecto de la subida para series nuevas. |
| `aguanteAbajoSeg` | No | Aguante por defecto al final de la bajada. |
| `aguanteArribaSeg` | No | Aguante por defecto al final de la subida. |
| `descansoSeg` | No | Descanso por defecto para series nuevas. |
| `segundos` | No | Duración cuando el ejercicio es de tipo `descanso`. |
| `orden` | No | Orden en la lista. **Al importar se ignora**: el que ya existe conserva su lugar y el nuevo se agrega al final. |
| `fotoInicial` | No | Foto de la posición inicial, como texto `data:image/...` o `null`. |
| `fotoFinal` | No | Foto de la posición final, como texto `data:image/...` o `null`. |
| `etiquetaAbajo` | No | Cómo se llama el movimiento de bajada. Si falta, `"ABAJO"`. |
| `etiquetaArriba` | No | Cómo se llama el movimiento de subida. Si falta, `"ARRIBA"`. |
| `ordenFases` | No | `"bajada"` o `"subida"`. Si falta, `"bajada"`. |
| `peso` | No | Texto libre con el peso (por ejemplo `"10 kg"`). |

## Qué pasa al importar

- El plan se busca **por nombre** (sin distinguir mayúsculas ni acentos).
  - Si existe: se actualiza y **conserva los días de la semana** que ya tenía.
  - Si no existe: se agrega, sin días asignados.
- Los ejercicios se buscan **por `id` y tipo**; si no, **por nombre y tipo**.
  - Si existen: se actualizan con lo que traiga el archivo.
  - Si no: se agregan al final de la lista.
- **Lo que trae valor en el archivo manda.** Si un campo viene vacío o en `0`,
  se conserva lo que ya tenía el ejercicio en la app.
- Las fotos solo se reemplazan si el archivo trae una foto; si vienen en `null`,
  se conserva la que ya tenías.
- Las series del plan **se reemplazan** por las del archivo.
- No se borran ejercicios ni planes que no vengan en el archivo.
- La semana, el historial y los ajustes **no** viajan en este archivo; eso es solo
  del respaldo completo.
- Antes de aplicar nada sale un resumen de qué se va a actualizar y qué se va a
  agregar.

## Qué se ignora

- `plan.id`, `entrada.uid` y `ejercicio.orden`: se generan o conservan en la app.
- `version` y `exportado`: son informativos.
- Cualquier campo que no esté en esta lista.

## Consejos

- Lo más seguro es **exportar un plan desde la app y editar esa copia**; ya trae
  todos los campos con el formato correcto.
- Para las fotos, lo normal es dejarlas en `null` y ponerlas desde la app; un
  `data:image/...` es un texto muy largo.
- El archivo debe ser JSON válido, en UTF-8 y sin comentarios.
- El nombre del archivo no importa; la app reconoce el contenido por `"tipo": "plan"`.
