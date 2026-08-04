# Sprint 6 — Portrait Review Completion: análisis previo

Fecha: 2026-08-04. Base: `02ffee8` (Sprint 5 merge). Branch: `feature/sprint-6-portrait-review-completion`.

## Inventario de propietarios

| Datos | Clave/store actual | Propietario | Contrato |
|---|---|---|---|
| Review entries | `portraitos.reviews.v1` (ProfileStorage.review) | PortraitReviewService | CRUD síncrono por perfil; `list/save/remove/clear/calculateStatus/resolveImage` |
| Review binding state | Variables locales `ReviewBinding` | ReviewBinding | UI de checklist; importación de imagen vía Data URL; historial en DOM |
| Binary image | `binaryId` (referencia) o Data URL embebida | ProfileStorage.binary / ReviewBinding | `resolveImage()` intenta binario, fallback string |
| Generation context | No existe | — | Sin asociación a generationId, contractId, hash |
| Checklist schema | 8 categorías planas: `face/age/hair/beard/skin/features/accessories/direction` | ReviewBinding/CHECKS | Valores: `pending/fail/review/approved` |
| Status calculation | `calculateStatus(checks)` | PortraitReviewService | Estados: `pending/review/approved/rejected` |
| History | Lista en memoria desde localStorage | PortraitReviewService.list() | Sin persistencia atómica ni rollback |

## Estado actual del contrato Review

### DTO actual (`normalizeReview`)

```javascript
{
  id: string,           // UUID o fallback
  profileId: string,    // normalizado
  image: string,        // Data URL o ""
  imageName: string,    // nombre de archivo
  checks: {             // objeto plano, 8 claves
    face: "pending|fail|review|approved",
    age: "pending|fail|review|approved",
    hair: "pending|fail|review|approved",
    beard: "pending|fail|review|approved",
    skin: "pending|fail|review|approved",
    features: "pending|fail|review|approved",
    accessories: "pending|fail|review|approved",
    direction: "pending|fail|review|approved"
  },
  status: string,       // calculado: pending|review|approved|rejected
  notes: string,
  createdAt: string,    // ISO
  updatedAt: string,    // ISO
  version: "1.0"
}
```

### Deficiencias del contrato actual

1. **Sin generationId/contractId/hash**: No hay vínculo con la generación o contrato que originó la imagen.
2. **Sin binary storage nativo**: `resolveImage()` busca `binaryId` pero `normalizeReview` nunca lo genera; todo pasa como Data URL en `image`.
3. **Sin severity/scoring**: Los checks son binarios (pass/fail) sin severidad (critical/major/minor/informational) ni cálculo de score.
4. **Sin estados draft/needs_review**: Solo `pending → review → approved/rejected`; no hay ciclo de revisión iterativo.
5. **Sin checklist estructurado**: Las 8 categorías son planas; no hay sub-items, pesos, ni resultado por categoría.
6. **Sin atomicidad**: `write()` escribe directo a ProfileStorage sin backup ni rollback.
7. **Sin limpieza de binarios**: Al eliminar review, no se elimina la imagen binaria asociada.
8. **Sin integración con PromptHistory**: No hay referencia cruzada entre historial de prompts y reviews.
9. **Sin export/import**: Las reviews no se incluyen en paquetes exportados.
10. **Sin eventos tipificados**: Emite `portraitos:review:saved/removed/cleared` pero no hay constantes en AppEvents/AppConstants.

## Consumidores actuales

| Consumidor | Uso | Dependencia |
|---|---|---|
| `ReviewBinding` | UI: checklist, imagen, historial, guardado | PortraitReviewService |
| `AppConstants` | No define REVIEW section | — |
| `AppEvents` | No define review events | — |
| `ProfileService` | No integra reviews | — |
| `PromptHistoryService` | No referencia reviews | — |
| `PromptExportService` | No exporta reviews | — |
| `Wizard` | No tiene paso de review | — |
| `index.html` | Sección `[data-review-binding]` con 8 categorías | ReviewBinding |

## Persistencia actual

```
ProfileStorage.review.load("portraitos.reviews.v1")
  → { version: "1.0", reviews: { [profileId]: ReviewEntry[] } }
ProfileStorage.review.save("portraitos.reviews.v1", JSON.stringify(state))
```

- **Límite**: 25 reviews por perfil (`reviews.slice(0, 25)`)
- **Resolución de imagen**: `resolveImage()` → si `binaryId` usa `ProfileStorage.binary.get()`, si no devuelve string directo
- **Sin backup**: No hay journal ni snapshot antes de escritura
- **Sin rollback**: Si falla `write()`, se lanza error pero el estado previo no se restaura

## Eventos actuales

```javascript
"portraitos:review:saved"    // detail: ReviewEntry normalizado
"portraitos:review:removed"  // detail: { profileId, reviewId }
"portraitos:review:cleared"  // detail: { profileId }
```

No hay constantes en `AppEvents.constants.EVENT_NAMES` ni en `AppConstants.EVENTS`.

## Gaps para Sprint 6

### Requeridos (del plan)

1. **Review Contract canónico**: DTO con `reviewId, profileId, generationId, contractId, contractHash, imageBinaryId, status, checklist, summary, observations, decisionReason, timestamps, schemaVersion, reviewVersion`
2. **Binary image obligatoria**: Sin Data URLs; imagen persistida en `binary-assets` store
3. **Asociación generation/contract**: `generationId, contractId, contractHash` como campos requeridos
4. **Checklist con severidad**: `identity/hair/skin/proportions/distinctiveFeatures/permanentAccessories/creativeDirection/composition/technicalQuality` con `critical/major/minor/informational` y resultado `pass/fail/not_applicable/not_reviewed`
5. **Estados expandidos**: `draft, needs_review, approved, rejected` con transiciones válidas
6. **Scoring**: Cálculo de score basado en severidad y resultados del checklist
7. **Persistencia atómica**: Backup antes de escritura, rollback en fallo
8. **Integración con historial**: Referencia cruzada generationId ↔ reviewId
9. **Export/import**: Reviews incluidas en paquetes exportados
10. **Eventos tipificados**: Constantes en AppEvents/AppConstants
11. **Limpieza de binarios**: Al eliminar review, eliminar imagen binaria asociada
12. **Legacy compatibility**: Migración de formato antiguo a nuevo

### Restricciones

- Sin cambios a: ProfileService, ProfileStorage, Photos contract, Identity Evidence, generation pipeline, readiness, Design System
- Sin frameworks, dependencias, backend, cloud, AI
- Sin auto-scoring; checklist es manual
- Tests Sprint 0-5 deben pasar sin regresión
- Sprint 6 debe pasar 2 veces consecutivas

## Patrones existentes a seguir

| Patrón | Fuente | Aplicación en Review |
|---|---|---|
| IIFE + `Object.freeze` | Todos los servicios | ReviewService sigue este patrón |
| `normalizeText/clone/createError` | Utilidades internas | Ya existen en PortraitReviewService |
| `ProfileStorage.*.load/save` | ProfileStorage | Para persistencia review/binary |
| `AppEvents.emit/on` | events.js | Para eventos review |
| `structuredClone/JSON.parse(JSON.stringify())` | Clonado seguro | Ya usado en clone() |
| `deepFreeze` | prompt.export.js | Para objetos inmutables |
| `fnv1aHash` | prompt.export.js | Para checksums |
| Schema + schemaVersion + serviceVersion | PromptHistoryService | Para review state |
| `ensureInitialized()` | PromptHistoryService | Para lazy init |
| `validatePackage/importPackage` | PromptExportService | Para export/import reviews |

## Riesgos

1. **Data URL en reviews existentes**: Las reviews guardadas con Data URLs deben migrarse a binary storage sin pérdida
2. **Compatibilidad con HTML actual**: El HTML tiene 8 categorías; el nuevo checklist tiene 9 categorías diferentes
3. **Límite de 25 reviews**: Puede necesitar ajuste o eliminación
4. **Eventos window vs AppEvents**: `emit()` actual usa fallback a `window.dispatchEvent` si `AppEvents` no existe
5. **Persistencia atómica**: IndexedDB no soporta transacciones cruzadas fácilmente desde ProfileStorage facade
