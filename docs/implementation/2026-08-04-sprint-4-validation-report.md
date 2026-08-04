# Sprint 4 — Validation Report

Estado: **SPRINT BLOCKED**.

## Validaciones confirmadas

- Sprint 0: 20/20 PASS.
- Sprint 1: 31/31 PASS.
- Sprint 2: 45/45 PASS.
- Sprint 3: 19/19 PASS tras conservar `profile.storageVersion = 2.0.0`.
- `git diff --check`: sin errores en la pasada previa al runner.
- Búsqueda global: `localStorage`, `sessionStorage` e `indexedDB` quedaron confinados a `app/js/services/profile.storage.js`.
- Sprint 4 confirmó individualmente: IndexedDB disponible bajo HTTP; Data URL transitoria → Blob; agregado confirmado sin Data URLs; referencias binarias; checksum; cuota instrumentada; rollback; recuperación tras liberar cuota; aborto real mediante `transaction.abort()`; recuperación del estado anterior; namespaces Wizard/Knowledge/History/Review; adaptador `storage.js`; manifest y binarios de backup.

## Bloqueo reproducido

Chrome bajo `file://` no completa IndexedDB. Se instrumentó un origen HTTP local mediante `HttpListener`. El servidor temporal dejó procesos PowerShell bloqueados al finalizar y Windows pasó a denegar la eliminación/renombrado de `tests/run-sprint-4-temp.ps1` y la recreación de `tests/run-sprint-4.ps1`, incluso con ejecución elevada. Las ejecuciones conjuntas se detuvieron después de escenarios distintos, sin producir un `SUMMARY .../... passed` final reproducible.

Por tanto no se declara que Sprint 4 pase, no se declara restore destructivo completo, ni se certifican en una misma ejecución A–J. Los cambios permanecen sin commit para revisión/continuación segura.

## Riesgos funcionales pendientes

1. Eliminación de una foto todavía no elimina explícitamente sus dos registros binarios en la misma transacción; `validateIntegrity()` los reporta, pero no hay compensación completa.
2. Review puede contener imágenes históricas inline dentro de su payload legacy; el consumidor fue delegado, pero esa migración binaria específica no está demostrada.
3. La hidratación de previews desde Blob/Object URL tras recarga no está integrada en el binding; el agregado es limpio, pero una foto recargada puede mostrar placeholder.
4. El runner obligatorio no terminó de forma reproducible y su lanzador exacto quedó bloqueado por el filesystem/seguridad local.

