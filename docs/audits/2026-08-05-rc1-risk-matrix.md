# PortraitOS — RC1 Risk Matrix

**Fecha:** 2026-08-05
**Rama:** `feature/sprint-7-rc1-integration`

---

## Resumen por Prioridad

| Prioridad | Cantidad |
|---|---|
| P0 (Blocker) | 2 |
| P1 (Alto) | 3 |
| P2 (Medio) | 2 |
| P3 (Bajo) | 1 |

---

## P0 — Blockers

### RIESGO-001: HistoryBinding no cargado

| Campo | Detalle |
|---|---|
| **Causa** | Falta `<script src="js/bindings/history.binding.js"></script>` en `index.html` y `HistoryBinding.init()` en el bloque DOMContentLoaded. El archivo existe (1768 líneas) pero nunca se integra a la aplicación. |
| **Impacto** | La sección de Historial del wizard está completamente muerta. Los usuarios no pueden ver, buscar, filtrar, restaurar, comparar, ni interactuar con el historial de generaciones. El flujo completo del usuario se rompe en el bloque "History". |
| **Probabilidad** | 100% (confirmado por grep: "history.binding" no aparece en index.html) |
| **Evidencia** | `app/js/bindings/history.binding.js` — 1768 líneas, existe pero no en `<script>` tags de `index.html`, no en bloque DOMContentLoaded init. |
| **Propuesta de resolución** | 1) Añadir `<script src="js/bindings/history.binding.js"></script>` después de `review.binding.js` en `index.html`. 2) Añadir `HistoryBinding.init()` en el bloque DOMContentLoaded después de `ReviewBinding.init()`. 3) Verificar que el historial carga y muestra datos correctamente. |

### RIESGO-002: Sin test runner para Sprint 6

| Campo | Detalle |
|---|---|
| **Causa** | El runner de tests de Sprint 6 (`sprint-6-runner.html`, `run-sprint-6.ps1`) nunca fue creado en esta rama. Los últimos runners son Sprint 0-5. |
| **Impacto** | No hay evidencia automatizada de que las features de Sprint 6 (Export, Review, Knowledge Packs) funcionen. No se puede ejecutar regresión completa. |
| **Probabilidad** | 100% (confirmado por glob: no existe `sprint-6-runner.html`) |
| **Evidencia** | `tests/sprint-6-runner.html` no existe. `tests/run-sprint-6.ps1` no existe. Último runner: `tests/sprint-5-runner.html`. |
| **Propuesta de resolución** | 1) Crear `tests/sprint-6-runner.html` con tests para Export (preview, copy, download, import), Review (checklist 8 checks, save, status, history, image), Knowledge Packs (search, filter, select, compatibility). 2) Crear `tests/run-sprint-6.ps1`. 3) Ejecutar y verificar 100% PASS. |

---

## P1 — Alto

### RIESGO-003: validation.binding.js contiene motor de validación completo (~3500 líneas)

| Campo | Detalle |
|---|---|
| **Causa** | La lógica de validación fue implementada en el binding en lugar del servicio. |
| **Impacto** | Violación de separación de capas. Cambios en reglas de validación requieren editar tanto `ProfileValidation` como `validation.binding.js`. Riesgo de inconsistencia. |
| **Probabilidad** | 100% (confirmado por inspección de código) |
| **Evidencia** | `app/js/bindings/validation.binding.js` contiene `calculateScore()`, `createCanonicalSections()`, `calculatePhotosCompleteness()`, `calculateContractCompleteness()`, `createIssue()`, `createSectionResult()`, `normalizeSeverity()`, `validateDependencies()`. |
| **Propuesta de resolución** | Extraer toda lógica de validación a `ProfileValidation` o crear un servicio dedicado. El binding solo debe delegar y renderizar. No bloqueante para RC1 pero alto riesgo de mantenimiento. |

### RIESGO-004: direction.binding.js contiene lógica de negocio (~4400 líneas)

| Campo | Detalle |
|---|---|
| **Causa** | Cálculos de completitud, normalización y validadores implementados en el binding. |
| **Impacto** | Mismo que RIESGO-003. Archivo excesivamente grande dificulta mantenimiento y revisión. |
| **Probabilidad** | 100% |
| **Evidencia** | `app/js/bindings/direction.binding.js` contiene `calculateCompleteness()`, `calculateDirectionCompleteness()`, `calculateCategoryCompleteness()`, `normalizeDirection()`, `normalizeFieldValue()`, `createEmptyDirection()`, `validateRequiredValue()`, `validateTextLength()`, `validateLocalConstraints()`, `validateCreativeConstraints()`, `validateWithCreativeEngine()`. |
| **Propuesta de resolución** | Mover lógica de negocio a servicios. Reducir binding a orquestación DOM + delegación. |

### RIESGO-005: 3 servicios contienen DOM directo

| Campo | Detalle |
|---|---|
| **Causa** | Llamadas a APIs de navegador (download, clipboard, canvas) en capa de servicio. |
| **Impacto** | Servicios no ejecutables en Node.js/workers. Testabilidad reducida. Parcialmente mitigado por guards en `prompt.export.js` pero no consistente. |
| **Probabilidad** | 100% |
| **Evidencia** | `prompt.export.js:337-364` — `document.createElement`, `document.body.appendChild`. `profile.importexport.js:71` — `document.createElement("a")`. `photo.thumbnail.js:463` — `document.createElement("canvas")`. |
| **Propuesta de resolución** | Envolver calls DOM con `typeof document !== "undefined"` o extraer a utilidad DOM dedicada. |

---

## P2 — Medio

### RIESGO-006: Checklist de review 8/9 checks

| Campo | Detalle |
|---|---|
| **Causa** | `CHECKS` array en `review.binding.js:4` tiene 8 elementos. El noveno check no está definido. |
| **Impacto** | Un criterio de revisión puede estar ausente. Desviación de especificación. |
| **Probabilidad** | 100% |
| **Evidencia** | `app/js/bindings/review.binding.js:4` — `CHECKS = ["face", "age", "hair", "beard", "skin", "features", "accessories", "direction"]`. HTML muestra 8 radio groups. |
| **Propuesta de resolución** | Confirmar si el noveno check es requerido. Si sí, añadirlo al CHECKS array y al HTML. |

### RIESGO-007: photos.binding.js contiene validación y creación de registros

| Campo | Detalle |
|---|---|
| **Causa** | `validatePhotoFile()` y `createPhotoRecord()` implementados en binding. |
| **Impacto** | Lógica duplicada entre binding y servicio. |
| **Probabilidad** | 100% |
| **Evidencia** | `app/js/bindings/photos.binding.js` — `validatePhotoFile()`, `createPhotoRecord()`. |
| **Propuesta de resolución** | Mover a `PhotoValidation` o `ProfilePhotos`. |

---

## P3 — Bajo

### RIESGO-008: ProfileStorage.describe() reporta `atomicWrites: true` sin API pública `atomic()`

| Campo | Detalle |
|---|---|
| **Causa** | El método `describe()` incluye `atomicWrites: true` como flag informativo, pero no existe método `atomic()` en el contrato público. |
| **Impacto** | Metadata engañosa. No hay API de transacciones expuesta. |
| **Probabilidad** | 100% |
| **Evidencia** | `app/js/services/profile.storage.js:447` — `atomicWrites: true` en describe(). No hay `atomic()` en `return Object.freeze({...})`. |
| **Propuesta de resolución** | Renombrar a `journalBasedWrites: true` o implementar API `atomic()` expuesta. |
