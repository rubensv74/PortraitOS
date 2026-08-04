# Sprint 6 — Portrait Review Contract

Fecha: 2026-08-04. Branch: `feature/sprint-6-portrait-review-completion`.

## Canonical Review DTO

```javascript
{
  // Identificadores
  reviewId: string,           // UUID v4, requerido
  profileId: string,          // normalizado, requerido
  generationId: string | null, // vinculado a PromptHistory entry
  contractId: string | null,   // vinculado a Portrait Contract
  contractHash: string | null, // hash del contrato al momento de la revisión

  // Imagen (binary storage obligatorio)
  imageBinaryId: string,      // clave en binary-assets store, requerido
  imageName: string,          // nombre original del archivo

  // Estado
  status: ReviewStatus,       // draft | needs_review | approved | rejected

  // Checklist estructurado
  checklist: ReviewChecklist,

  // Resumen y observaciones
  summary: string,            // max 2000 chars
  observations: ReviewObservation[],
  decisionReason: string,     // max 1000 chars, requerido si status es approved/rejected

  // Métricas
  score: ReviewScore,         // calculado del checklist

  // Timestamps
  createdAt: string,          // ISO 8601
  updatedAt: string,          // ISO 8601
  completedAt: string | null, // ISO 8601, cuando status llega a approved/rejected

  // Versionado
  schemaVersion: "1.0",
  reviewVersion: "1.0"
}
```

## ReviewStatus

```javascript
const REVIEW_STATUS = Object.freeze({
  DRAFT: "draft",             // revisión creada, checklist incompleto
  NEEDS_REVIEW: "needs_review", // checklist completo, pendiente de decisión
  APPROVED: "approved",       // revisión aprobada
  REJECTED: "rejected"        // revisión rechazada
});
```

### Transiciones válidas

```
draft → needs_review    (cuando todos los checklist items tienen resultado)
draft → approved        (solo si no hay critical failures)
draft → rejected        (siempre permitido)
needs_review → approved (si no hay critical failures)
needs_review → rejected (siempre permitido)
needs_review → draft    (para editar)
rejected → draft        (para re-evaluar)
approved → draft        (para re-evaluar, requiere reason)
```

## ReviewChecklist

```javascript
{
  identity: ReviewCheckItem,           // identidad del sujeto
  hair: ReviewCheckItem,               // cabello
  skin: ReviewCheckItem,               // piel
  proportions: ReviewCheckItem,        // proporciones faciales/corporales
  distinctiveFeatures: ReviewCheckItem, // rasgos distintivos (pecas, cicatrices, etc.)
  permanentAccessories: ReviewCheckItem, // accesorios permanentes (gafas, piercings)
  creativeDirection: ReviewCheckItem,  // dirección creativa (iluminación, pose, estilo)
  composition: ReviewCheckItem,        // composición de la imagen
  technicalQuality: ReviewCheckItem    // calidad técnica (resolución, enfoque, ruido)
}
```

### ReviewCheckItem

```javascript
{
  result: CheckResult,     // pass | fail | not_applicable | not_reviewed
  severity: CheckSeverity, // critical | major | minor | informational
  notes: string,           // max 500 chars, opcional
  imageBinaryId: string | null, // evidencia visual del check (crop, anotación)
  updatedAt: string        // ISO 8601
}
```

### CheckResult

```javascript
const CHECK_RESULT = Object.freeze({
  PASS: "pass",
  FAIL: "fail",
  NOT_APPLICABLE: "not_applicable",
  NOT_REVIEWED: "not_reviewed"
});
```

### CheckSeverity

```javascript
const CHECK_SEVERITY = Object.freeze({
  CRITICAL: "critical",     // bloquea aprobación
  MAJOR: "major",           // afecta calidad significativamente
  MINOR: "minor",           // defecto menor
  INFORMATIONAL: "informational" // observación sin impacto
});
```

### Mapeo de severidad por defecto por categoría

| Categoría | Severidad por defecto |
|---|---|
| identity | critical |
| hair | major |
| skin | major |
| proportions | critical |
| distinctiveFeatures | critical |
| permanentAccessories | minor |
| creativeDirection | major |
| composition | major |
| technicalQuality | critical |

## ReviewScore

```javascript
{
  total: number,           // 0-100, calculado
  passed: number,          // count de items con result=pass
  failed: number,          // count de items con result=fail
  notApplicable: number,   // count de items con result=not_applicable
  notReviewed: number,     // count de items con result=not_reviewed
  criticalFailures: number, // count de items con severity=critical AND result=fail
  hasBlockingIssues: boolean // true si criticalFailures > 0
}
```

### Algoritmo de scoring

```javascript
function calculateScore(checklist) {
  const items = Object.values(checklist);
  const relevantItems = items.filter(i => i.result !== "not_applicable" && i.result !== "not_reviewed");
  
  if (relevantItems.length === 0) return { total: 0, ... };

  const weights = { critical: 4, major: 3, minor: 2, informational: 1 };
  let earnedPoints = 0;
  let maxPoints = 0;
  let criticalFailures = 0;

  items.forEach(item => {
    if (item.result === "not_applicable" || item.result === "not_reviewed") return;
    const weight = weights[item.severity] || 1;
    maxPoints += weight;
    if (item.result === "pass") earnedPoints += weight;
    if (item.result === "fail" && item.severity === "critical") criticalFailures++;
  });

  return {
    total: maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0,
    passed: items.filter(i => i.result === "pass").length,
    failed: items.filter(i => i.result === "fail").length,
    notApplicable: items.filter(i => i.result === "not_applicable").length,
    notReviewed: items.filter(i => i.result === "not_reviewed").length,
    criticalFailures,
    hasBlockingIssues: criticalFailures > 0
  };
}
```

## ReviewObservation

```javascript
{
  id: string,              // UUID
  category: string,        // nombre del checklist item
  severity: CheckSeverity,
  description: string,     // max 1000 chars
  imageBinaryId: string | null, // evidencia visual
  createdAt: string        // ISO 8601
}
```

## Persistencia

### Store

Reviews se almacenan en `ProfileStorage.review` bajo la clave `portraitos.reviews.v2`.

### State schema

```javascript
{
  schema: "portraitos.reviews",
  schemaVersion: "1.0",
  serviceVersion: "1.0",
  createdAt: string,
  updatedAt: string,
  entries: {
    [profileId]: ReviewEntry[]  // max 50 por perfil
  }
}
```

### Atomicidad

1. **Backup**: Antes de cada `save()`, serializar estado actual en `portraitos.reviews.backup`
2. **Write**: Escribir nuevo estado
3. **Verify**: Leer y comparar
4. **Rollback**: Si verificación falla, restaurar desde backup
5. **Cleanup**: Eliminar backup después de 30 días

### Binary storage

Las imágenes se almacenan en `binary-assets` store con clave `{profileId}:review:{reviewId}:original`. Al eliminar review, eliminar también el binario asociado.

## Eventos

```javascript
const REVIEW_EVENTS = Object.freeze({
  CREATED: "portraitos:review:created",
  UPDATED: "portraitos:review:updated",
  STATUS_CHANGED: "portraitos:review:status-changed",
  CHECKLIST_UPDATED: "portraitos:review:checklist-updated",
  DELETED: "portraitos:review:deleted",
  CLEARED: "portraitos:review:cleared",
  IMAGE_UPLOADED: "portraitos:review:image-uploaded",
  IMAGE_REMOVED: "portraitos:review:image-removed"
});
```

### Deduplicación de listeners

Usar `AppEvents.on()` que ya soporta `off()` y registro interno. No registrar listeners duplicados en `init()`.

## Export/Import

### Inclusión en paquetes

`PromptExportService.buildPackage()` debe incluir campo `reviews`:

```javascript
{
  ...existingPackage,
  reviews: ReviewEntry[] | null  //Reviews del perfil activo
}
```

### Formato de exportación

```javascript
{
  schema: "portraitos.review-export",
  schemaVersion: "1.0",
  serviceVersion: "1.0",
  exportedAt: string,
  profileId: string,
  count: number,
  entries: ReviewEntry[]
}
```

### Importación

Soportar estrategias `merge`, `replace`, `append` como PromptHistoryService.

## Legacy Compatibility

### Migración desde v1

```javascript
function migrateFromV1(oldEntry, profileId) {
  // Mapear checks planos a checklist estructurado
  const checklist = {
    identity: { result: oldEntry.checks.face || "not_reviewed", severity: "critical", ... },
    hair: { result: oldEntry.checks.hair || "not_reviewed", severity: "major", ... },
    skin: { result: oldEntry.checks.skin || "not_reviewed", severity: "major", ... },
    proportions: { result: "not_reviewed", severity: "critical", ... },
    distinctiveFeatures: { result: oldEntry.checks.features || "not_reviewed", severity: "critical", ... },
    permanentAccessories: { result: oldEntry.checks.accessories || "not_reviewed", severity: "minor", ... },
    creativeDirection: { result: oldEntry.checks.direction || "not_reviewed", severity: "major", ... },
    composition: { result: "not_reviewed", severity: "major", ... },
    technicalQuality: { result: "not_reviewed", severity: "critical", ... }
  };

  // Migrar imagen Data URL a binary storage
  let imageBinaryId = "";
  if (oldEntry.image && typeof oldEntry.image === "string" && oldEntry.image.startsWith("data:")) {
    // Convertir Data URL a Blob, guardar en binary-assets
    imageBinaryId = `${profileId}:review:${oldEntry.id}:original`;
    // ProfileStorage.binary.put(imageBinaryId, blob, metadata)
  }

  return {
    reviewId: oldEntry.id,
    profileId,
    generationId: null,
    contractId: null,
    contractHash: null,
    imageBinaryId,
    imageName: oldEntry.imageName || "",
    status: mapOldStatus(oldEntry.status),
    checklist,
    summary: oldEntry.notes || "",
    observations: [],
    decisionReason: "",
    score: calculateScore(checklist),
    createdAt: oldEntry.createdAt,
    updatedAt: oldEntry.updatedAt,
    completedAt: null,
    schemaVersion: "1.0",
    reviewVersion: "1.0"
  };
}

function mapOldStatus(oldStatus) {
  const map = { pending: "draft", review: "needs_review", approved: "approved", rejected: "rejected" };
  return map[oldStatus] || "draft";
}
```

## Ejemplo completo

```javascript
{
  reviewId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  profileId: "mi-perfil",
  generationId: "gen-uuid-1234",
  contractId: "contract-uuid-5678",
  contractHash: "a1b2c3d4",
  imageBinaryId: "mi-perfil:review:a1b2c3d4:original",
  imageName: "portrait-studio.jpg",
  status: "approved",
  checklist: {
    identity: { result: "pass", severity: "critical", notes: "", imageBinaryId: null, updatedAt: "2026-08-04T12:00:00Z" },
    hair: { result: "pass", severity: "major", notes: "", imageBinaryId: null, updatedAt: "2026-08-04T12:00:00Z" },
    skin: { result: "pass", severity: "major", notes: "", imageBinaryId: null, updatedAt: "2026-08-04T12:00:00Z" },
    proportions: { result: "pass", severity: "critical", notes: "", imageBinaryId: null, updatedAt: "2026-08-04T12:00:00Z" },
    distinctiveFeatures: { result: "pass", severity: "critical", notes: "", imageBinaryId: null, updatedAt: "2026-08-04T12:00:00Z" },
    permanentAccessories: { result: "not_applicable", severity: "minor", notes: "No usa accesorios", imageBinaryId: null, updatedAt: "2026-08-04T12:00:00Z" },
    creativeDirection: { result: "pass", severity: "major", notes: "", imageBinaryId: null, updatedAt: "2026-08-04T12:00:00Z" },
    composition: { result: "pass", severity: "major", notes: "", imageBinaryId: null, updatedAt: "2026-08-04T12:00:00Z" },
    technicalQuality: { result: "pass", severity: "critical", notes: "", imageBinaryId: null, updatedAt: "2026-08-04T12:00:00Z" }
  },
  summary: "Imagen aprobada. Identidad verificada, calidad técnica excelente.",
  observations: [],
  decisionReason: "La imagen cumple con todos los criterios de identidad y calidad técnica.",
  score: { total: 96, passed: 7, failed: 0, notApplicable: 1, notReviewed: 0, criticalFailures: 0, hasBlockingIssues: false },
  createdAt: "2026-08-04T12:00:00Z",
  updatedAt: "2026-08-04T12:05:00Z",
  completedAt: "2026-08-04T12:05:00Z",
  schemaVersion: "1.0",
  reviewVersion: "1.0"
}
```

## Anti-patrones prohibidos

1. **Data URLs en almacenamiento persistente**: Solo para preview temporal en UI
2. **Checks sin severidad**: Todo check debe tener severity asignado
3. **Status sin transición válida**: Validar transiciones en `save()`
4. **Scoring manual**: Siempre calcular desde checklist
5. **Binarios huérfanos**: Al eliminar review, eliminar binario asociado
6. **Listeners duplicados**: Usar AppEvents.on() con cleanup en destroy()
7. **Persistencia sin backup**: Siempre backup antes de write
8. **Export sin reviews**: Paquetes deben incluir reviews del perfil
