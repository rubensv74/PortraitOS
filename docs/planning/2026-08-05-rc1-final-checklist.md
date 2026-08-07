# PortraitOS — RC1 Final Checklist

**Fecha:** 2026-08-05
**Rama:** `feature/sprint-7-rc1-integration`

---

## Estado: RC1_BLOCKED

---

## Checklist de Bloqueadores

### MUST-FIX antes de RC1

| # | Elemento | Archivo | Acción | Estado |
|---|---|---|---|---|
| B1 | HistoryBinding no cargado | `app/index.html` | Añadir `<script src="js/bindings/history.binding.js"></script>` después de `review.binding.js` | PENDIENTE |
| B2 | HistoryBinding no inicializado | `app/index.html` | Añadir `HistoryBinding.init()` en DOMContentLoaded después de `ReviewBinding.init()` | PENDIENTE |
| B3 | Sin sprint-6-runner.html | `tests/` | Crear `tests/sprint-6-runner.html` con tests para Export, Review, Knowledge Packs | PENDIENTE |
| B4 | Sin run-sprint-6.ps1 | `tests/` | Crear `tests/run-sprint-6.ps1` | PENDIENTE |
| B5 | Verificación de tests | — | Ejecutar Sprint 0-6 y confirmar 100% PASS × 2 | PENDIENTE |

---

## Checklist de Calidad (RECOMENDADO para RC1)

| # | Elemento | Archivo | Acción | Prioridad |
|---|---|---|---|---|
| Q1 | Review checklist 8/9 | `app/js/bindings/review.binding.js` | Confirmar si falta un noveno check y añadirlo si es necesario | P2 |
| Q2 | Validation binding business logic | `app/js/bindings/validation.binding.js` | Mover lógica de validación a servicio dedicado | P1 |
| Q3 | Direction binding business logic | `app/js/bindings/direction.binding.js` | Mover lógica de negocio a servicios | P1 |
| Q4 | DOM en servicios | `prompt.export.js`, `profile.importexport.js`, `photo.thumbnail.js` | Añadir guards `typeof document` o extraer DOM a utilidad | P1 |
| Q5 | Photos binding business logic | `app/js/bindings/photos.binding.js` | Mover `validatePhotoFile()`, `createPhotoRecord()` a servicios | P2 |
| Q6 | Prompt binding business logic | `app/js/bindings/prompt.binding.js` | Mover `validateGenerationReadiness()`, `computeHistoryHash()` a servicios | P2 |
| Q7 | Atomic writes metadata | `app/js/services/profile.storage.js` | Renombrar `atomicWrites` o implementar API `atomic()` | P3 |

---

## Checklist de Verificación Final

| # | Verificación | Comando/Método | Estado |
|---|---|---|---|
| V1 | Sprint 0 tests PASS | `run-sprint-0.ps1` | PENDIENTE |
| V2 | Sprint 1 tests PASS | `run-sprint-1.ps1` | PENDIENTE |
| V3 | Sprint 2 tests PASS (determinístico ×2) | `run-sprint-2.ps1` | PENDIENTE |
| V4 | Sprint 3 tests PASS | `run-sprint-3.ps1` | PENDIENTE |
| V5 | Sprint 4 tests PASS | `run-sprint-4.ps1` | PENDIENTE |
| V6 | Sprint 5 tests PASS | `run-sprint-5.ps1` | PENDIENTE |
| V7 | Sprint 6 tests PASS (nuevo runner) | `run-sprint-6.ps1` | PENDIENTE |
| V8 | HistoryBinding carga en app | Abrir app, ir a Historial, verificar que muestra datos | PENDIENTE |
| V9 | Export funciona | Previsualizar, copiar, descargar desde Export Studio | PENDIENTE |
| V10 | Review funciona | Cargar imagen, marcar checks, guardar revisión, ver historial | PENDIENTE |
| V11 | Knowledge Packs funciona | Buscar, filtrar, seleccionar pack, verificar compatibilidad | PENDIENTE |
| V12 | Flujo completo end-to-end | Profile → Photos → Identity → Direction → Validation → Generation → History → Export → Import → Review → Reload | PENDIENTE |

---

## Archivos a Modificar (Bloqueadores)

```
app/index.html
  - Línea ~2539: añadir <script src="js/bindings/history.binding.js"></script>
  - Línea ~2561: añadir HistoryBinding.init();

tests/ (nuevos)
  - tests/sprint-6-runner.html
  - tests/run-sprint-6.ps1
```

---

## Resumen

| Categoría | Bloqueadores | Recomendados | Totales |
|---|---|---|---|
| Integración | 2 (B1, B2) | 0 | 2 |
| Testing | 3 (B3, B4, B5) | 0 | 3 |
| Arquitectura | 0 | 4 (Q2-Q4, Q6) | 4 |
| Calidad | 0 | 3 (Q1, Q5, Q7) | 3 |
| **Total** | **5** | **7** | **12** |

**Para declarar RC1:** Completar los 5 bloqueadores (B1-B5) y verificar los 12 puntos de verificación (V1-V12).
