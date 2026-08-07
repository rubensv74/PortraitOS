# PortraitOS — RC1 Runtime Fix Progress

## Estado

**IMPLEMENTATION IN PROGRESS — VALIDATION PENDING**

## Rama

`fix/rc1-history-runtime`

## Issue

`#9 — RC1 Runtime Fix — Integrar HistoryBinding y añadir smoke test real`

## Trabajo implementado

1. `HistoryBinding` se ha consolidado como binding de runtime con inicialización idempotente.
2. El binding crea su workspace History dentro del paso Generación cuando el DOM aún no existe.
3. El historial se filtra por `profileId` del perfil activo.
4. Cambio de perfil fuerza refresh y limpia la selección de comparación.
5. Se mantienen búsqueda, proveedor, nivel, favoritos, etiquetas, paginación, comparación, restauración, duplicado, export y eliminación.
6. La restauración usa `PromptHistoryService.restore()` y representa el prompt restaurado en el área de resultado.
7. `ProfileManagerBinding` incorpora un bootstrap asíncrono y único para cargar `history.binding.js` en el runtime real.
8. Se añade el marcador `data-history-runtime-ready="true"` cuando la integración termina correctamente.
9. El RC1 runtime runner carga `app/index.html` real y valida History end-to-end a nivel de runtime.
10. El runner comprueba aislamiento entre dos perfiles, filtros, restore, comparación, eliminación e idempotencia.

## Archivos modificados

- `app/js/bindings/history.binding.js`
- `app/js/bindings/profile.manager.binding.js`
- `tests/rc1-runtime-runner.html`

## Archivos del gate ya presentes en la rama

- `tests/run-rc1-runtime.ps1`

## Pendiente de validación local

Ejecutar en Windows desde la raíz del repositorio:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\run-sprint-0.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\run-sprint-1.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\run-sprint-2.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\run-sprint-3.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\run-sprint-4.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\run-sprint-5.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\run-sprint-6.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\run-rc1-runtime.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\run-rc1-runtime.ps1
```

Además:

```powershell
git diff --check
```

y comprobación sintáctica de todos los JavaScript.

## Condición de cierre

No declarar `RC1_RUNTIME_READY` hasta que:

- el runtime gate pase dos veces consecutivas;
- las suites Sprint 0–6 sigan verdes;
- `git diff --check` y sintaxis JavaScript pasen;
- no existan listeners duplicados ni errores de consola.
