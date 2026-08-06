# PortraitOS — RC1 Runtime Fix Progress

## Estado

**IN PROGRESS**

## Rama

`fix/rc1-history-runtime`

## Issue

`#9 — RC1 Runtime Fix — Integrar HistoryBinding y añadir smoke test real`

## Trabajo iniciado

1. Se creó un runtime gate que carga `app/index.html` real.
2. El gate comprueba globals críticos, presencia del DOM History, inicialización de `HistoryBinding`, idempotencia y ausencia de errores de consola.
3. Se creó un lanzador PowerShell con servidor HTTP local, Chrome/Edge headless, timeout y cleanup determinista.
4. El gate está diseñado para permanecer rojo hasta que History esté integrado en producción.

## Archivos creados

- `tests/rc1-runtime-runner.html`
- `tests/run-rc1-runtime.ps1`

## Siguiente bloque

Integrar History en el runtime:

- DOM `data-history*` dentro del workspace de generación;
- carga de `js/bindings/history.binding.js`;
- llamada única a `HistoryBinding.init()`;
- compatibilidad con el perfil activo;
- refresco tras generación, restauración y eliminación.

## Condición de cierre

No declarar `RC1_RUNTIME_READY` hasta que:

- el runtime gate pase dos veces consecutivas;
- las suites Sprint 0–6 sigan verdes;
- `git diff --check` y sintaxis JavaScript pasen;
- no existan listeners duplicados ni errores de consola.
