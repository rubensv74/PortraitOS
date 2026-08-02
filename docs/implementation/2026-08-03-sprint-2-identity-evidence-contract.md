# Sprint 2 — Contrato canónico de Identity Evidence

Fecha: 2026-08-03  
Versión: `portraitos.identity-evidence.v1`

## DTO canónico

```js
identity: {
  evidenceVersion: "portraitos.identity-evidence.v1",
  evidence: {
    general: [],
    face: [],
    skin: [],
    hair: [],
    eyes: [],
    nose: [],
    mouth: [],
    jaw: [],
    "facial-hair": [],
    "age-markers": [],
    asymmetries: [],
    "distinctive-features": []
  }
}
```

Registro:

```js
{
  photoId: "photo-id",          // obligatorio y estable
  checksum: "sha256...",        // obligatorio para fotos Sprint 1; vacío en legado
  profileId: "profile-id",      // propietario esperado
  role: "primary" | "reference",
  note: "Referencia frontal",   // opcional y breve
  createdAt: "ISO-8601"
}
```

No contiene Data URLs, thumbnails ni metadatos completos. La sección es explícita por el bucket. La clave de unicidad es `section + photoId`; una misma foto puede respaldar varias secciones, pero no repetirse dentro de una.

## Estados de integridad

| Estado | Regla |
| --- | --- |
| `valid` | ID existente, mismo perfil y checksum coincidente |
| `missing` | `photoId` no existe en Photos activo |
| `checksum_mismatch` | Existen ambos checksums y no coinciden |
| `legacy_unverified` | La referencia o foto histórica carece de checksum |
| `wrong_profile` | `profileId` de la referencia no coincide con el activo |

Una evidencia legacy permanece visible y no rompe por sí sola perfiles históricos. No cuenta como evidencia verificada para bloquear una identidad nueva.

## Secciones, pesos y criticidad

Los pesos representan importancia relativa en el contrato de identidad existente y suman 100:

| Sección | Peso | Crítica | Agrupación UI |
| --- | ---: | :---: | --- |
| `face` | 15 | sí | rostro y proporciones |
| `eyes` | 12 | sí | ojos y cejas |
| `nose` | 10 | sí | nariz |
| `mouth` | 10 | sí | boca y labios |
| `jaw` | 10 | sí | mandíbula y mentón |
| `skin` | 12 | sí | tono y textura |
| `hair` | 10 | sí | cabello y canas |
| `distinctive-features` | 11 | sí | rasgos distintivos |
| `general` | 4 | no | edad aparente/contexto general |
| `asymmetries` | 3 | no | asimetrías naturales |
| `age-markers` | 2 | no | líneas y marcadores de edad |
| `facial-hair` | 1 | no | barba/bigote |

No se crean buckets separados para cejas, labios, textura, canas o accesorios porque el modelo actual los agrupa o no los contiene.

## Coverage

```js
{
  score: 78,
  coveredSections: 9,
  requiredSections: 12,
  missingSections: ["skin", "asymmetries"],
  invalidEvidenceCount: 1,
  legacyEvidenceCount: 2,
  validEvidenceCount: 10,
  totalEvidenceCount: 13,
  criticalMissingSections: ["skin"],
  readyForLock: false
}
```

- Una sección se considera cubierta si posee al menos una evidencia `valid`.
- Score = suma de pesos de secciones cubiertas.
- Umbral de lock: `score >= 75`, todas las secciones críticas descritas deben tener evidencia válida, cero evidencias rotas en secciones críticas y fotografía principal válida.
- `legacy_unverified` se informa, pero no suma coverage verificada.
- `readyForLock` combina cobertura e integridad; la validación formal del texto se evalúa además al bloquear.

## Lock state

El lock es funcional, no criptográfico. Requiere:

1. confirmación explícita;
2. estado validado;
3. fotografía principal;
4. coverage lista para lock;
5. identidad perteneciente al perfil activo.

Al bloquear se conservan `locked`, `lockedAt`, `lockedBy` y se añade `lockedEvidenceVersion`. Desbloquear requiere confirmación, conserva evidencia y vuelve a `review`.

## Eventos

- `identity:updated`: cambios generales o de rasgos.
- `identity:evidence-updated`: vínculo, desvínculo o reconciliación por `photos:changed`.
- `identity:locked`.
- `identity:unlocked`.

Una mutación pública produce una persistencia y un evento final. La reconciliación por Photos solo emite si cambia el estado de integridad observado; no borra registros ni genera prompts.

## Compatibilidad legacy

`ProfileIdentity.initialize()` es idempotente:

1. crea buckets vacíos si `evidence` no existe;
2. adapta cada `sections[name].sourcePhotoIds` ausente en Evidence a un registro sin checksum;
3. conserva descripciones, lock, timestamps y fotos;
4. sincroniza `sourcePhotoIds` desde el contrato canónico;
5. no cambia automáticamente el lock histórico.

La actualización de una referencia legacy consiste en desvincularla y volver a vincular la foto disponible, incorporando checksum y profileId.

## Consumidores

- `IdentityBinding`: render y comandos; no calcula coverage.
- `ProfileValidation`: findings derivados del estado canónico.
- `IdentityEngine`: traits, lock y resumen de coverage; no Data URLs/checksums en texto.
- `PromptBuilder/Compiler`: mantienen texto de rasgos; Evidence solo refuerza readiness y auditoría interna.
- `Wizard`: representa estado ya calculado.

## Ejemplos

Vínculo válido:

```js
ProfileService.identity.linkEvidence("eyes", photoId, {
  note: "Vista frontal"
});
```

Desvínculo:

```js
ProfileService.identity.unlinkEvidence("eyes", photoId);
```

Consulta:

```js
ProfileService.identity.getEvidenceState();
```

## Antipatrones

- Copiar `source.dataUrl` o `thumbnail.dataUrl` a Identity.
- Guardar índices de galería en lugar de IDs.
- Calcular coverage en binding, HTML o Wizard.
- Borrar evidencias al eliminar una foto.
- Tratar legacy sin checksum como mismatch.
- Emitir `identity:updated` y `identity:evidence-updated` para una misma vinculación.
- Incluir IDs/checksums en el prompt visible.
