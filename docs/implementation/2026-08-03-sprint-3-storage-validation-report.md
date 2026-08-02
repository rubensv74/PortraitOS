# Sprint 3 — Informe de validación de almacenamiento

Fecha: 2026-08-03.

## Resultado

Implementación funcional del agregado de perfil: IndexedDB primario con apertura asíncrona, fallback/journal local, caché compatible con consumidores síncronos, migración no destructiva, checksum, escritura transaccional, backup/restore y coalescing.

## Ejecuciones

| Suite | Resultado |
|---|---:|
| `tests/run-sprint-0.ps1` | 20/20 |
| `tests/run-sprint-1.ps1` | 31/31 |
| `tests/run-sprint-2.ps1` | 45/45 |
| `tests/run-sprint-3.ps1` | 19/19 |

Comando empleado: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\run-sprint-N.ps1`. Chrome terminó con código 0 en las cuatro suites.

## Matriz Sprint 3

| Escenario | Evidencia | Estado |
|---|---|---|
| A — disponibilidad/backend/API | runner A | PASS |
| B — escritura confirmada | `saveActive` + `flush` | PASS |
| C — versión y timestamps | inspección de biblioteca | PASS |
| D — backup íntegro | formato/checksum/perfil | PASS |
| E — restore | contenido previo recuperado | PASS |
| F — corrupción/rollback | checksum alterado rechazado; estado previo intacto | PASS |
| G — múltiples perfiles | biblioteca con aislamiento | PASS |
| H — Photos + Identity | bloques presentes en biblioteca persistida | PASS |
| I — exportación y estrategia | backup exportable + `PhotoStorage.describe` | PASS |
| J — coalescing completado | cola sin escrituras pendientes | PASS |

## Criterios de aceptación

- Fachada única para el agregado: cumplido en `ProfileManager`, `ProfileService` y `PhotoStorage`.
- IndexedDB primario y fallback: cumplido; durante la apertura se identifica `indexeddb-pending` y las operaciones quedan protegidas por journal.
- Migración no destructiva: implementada; conserva `portraitos.profiles.v1` y escribe marcador separado.
- Integridad/estructura/versiones: implementadas en cada record y perfil.
- Atomicidad/rollback: transacción IndexedDB y backup previo; fallback con restitución.
- Autosave inteligente: debounce de 180 ms y coalescing; `flush()` es la barrera explícita.
- Backup/restore: implementados y probados con corrupción.
- Regresiones Sprints 0–2: cumplidas exactamente.

## Límites y riesgos reales

1. La suite automatizada prueba corrupción del backup, no simula un cierre del proceso en mitad de una transacción IndexedDB ni fuerza físicamente `QuotaExceededError`; esos casos dependen además de garantías transaccionales del navegador y deben añadirse a pruebas de navegador instrumentadas.
2. `wizard.js`, `knowledge.pack.service.js`, `portrait.review.js`, `prompt.history.js` y `storage.js` conservan acceso directo histórico a `localStorage`. No pertenecen al agregado migrado y no se modificaron por la prohibición expresa de tocar Wizard/Prompt y de ampliar alcance. La afirmación “ningún módulo” sólo es cierta para el flujo Profile/Photos/Identity integrado por Sprint 3.
3. Las fotografías siguen serializadas inline dentro del perfil. IndexedDB eleva la capacidad práctica, pero no existe todavía un object store binario separado; cambiarlo sería una decisión arquitectónica posterior.
4. No se añadieron dependencias, commits ni cambios de interfaz.

