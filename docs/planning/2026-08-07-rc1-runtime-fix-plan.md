# PortraitOS — RC1 Runtime Fix Plan

## Objetivo

Resolver exclusivamente el bloqueo de integración de History y añadir una puerta de runtime que evite módulos muertos con tests verdes.

## Alcance mínimo

### FIX-01 — Integrar History UI

1. Definir ubicación de History:
   - panel secundario dentro de Generación; o
   - workspace accesible desde navegación secundaria.
2. Incorporar el DOM requerido por `HistoryBinding`.
3. Cargar `js/bindings/history.binding.js` después de:
   - `prompt.history.js`;
   - `prompt.binding.js`, si se usa restauración.
4. Ejecutar `HistoryBinding.init()` una sola vez.
5. Garantizar `destroy()`/reinicialización sin listeners duplicados.
6. Actualizar el historial cuando se genere, elimine, restaure o cambie de perfil.

### FIX-02 — Trazabilidad por perfil

Comprobar:

- listado solo del perfil activo;
- cambio de perfil refresca la UI;
- una generación crea una entrada visual;
- restaurar mantiene `generationId`, `contractId/hash` y `profileId`;
- eliminar no afecta a otros perfiles.

### FIX-03 — RC1 Runtime Smoke Test

Crear:

- `tests/rc1-runtime-runner.html`
- `tests/run-rc1-runtime.ps1`

El runner debe cargar `app/index.html` real y afirmar:

- app ready;
- todos los globals críticos;
- todos los bindings críticos;
- roots DOM;
- HistoryBinding inicializado;
- una generación aparece en la lista real;
- cambio de perfil aísla History;
- restaurar y eliminar funcionan desde UI;
- consola limpia;
- sin listeners duplicados.

## Archivos probables

- `app/index.html`
- `app/js/bindings/history.binding.js` solo para correcciones de compatibilidad demostradas
- `app/js/services/prompt.history.js` solo si falta filtrado por perfil
- `tests/rc1-runtime-runner.html`
- `tests/run-rc1-runtime.ps1`
- documentación RC1

## Fuera de alcance

- refactor de bindings grandes;
- rediseño del router;
- nueva arquitectura;
- optimización general;
- deuda técnica cosmética;
- cambios en Photos, Identity, Storage o Review no relacionados.

## Criterios de aceptación

1. `history.binding.js` cargado.
2. `HistoryBinding.init()` ejecutado una vez.
3. Root y selectores History presentes.
4. History accesible desde el producto.
5. Una generación aparece en History UI.
6. Filtros y búsqueda funcionan.
7. Restaurar, comparar, favoritos, etiquetas y eliminación no arrojan errores.
8. Aislamiento por perfil.
9. Recarga conserva datos.
10. RC1 runtime smoke pasa dos veces.
11. Sprints 0–6 siguen verdes.
12. Sin errores de consola.
13. Sin listeners duplicados.
14. Sin dependencias nuevas.

## Recomendación

Ejecutar un **RC1 Runtime Fix** corto. No abrir un Sprint 7 amplio hasta superar esta puerta.
