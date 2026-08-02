# Sprint 2 — Informe de validación de Identity Evidence Integration

Fecha: 2026-08-03  
Rama: `feature/sprint-2-identity-evidence-integration`  
Estado: **SPRINT COMPLETE**

## Arquitectura y contrato

- Se mantiene `IdentityBinding → ProfileService.identity → ProfileIdentity → ProfileManager`.
- Photos permanece en `ProfilePhotos`; Identity solo almacena referencias `photoId/checksum/profileId` y contexto mínimo.
- `identity.evidence` es canónico; `section.sourcePhotoIds` es un adaptador sincronizado para consumidores históricos.
- Integridad y coverage se calculan exclusivamente en `ProfileIdentity`.
- Validation consume `getEvidenceState()` y Prompt recibe únicamente coverage/estado/conteos estructurales.
- `identity:evidence-updated` representa link/unlink; una operación produce una persistencia y un evento final.

## Cobertura implementada

Pesos: face 15, eyes 12, nose 10, mouth 10, jaw 10, skin 12, hair 10, distinctive-features 11, general 4, asymmetries 3, age-markers 2 y facial-hair 1. Total: 100.

Umbral de lock: 75 %, las ocho secciones críticas cubiertas, fotografía principal y cero referencias críticas rotas. En el fixture principal, ocho secciones críticas producen 90 %.

Estados de integridad probados: `valid`, `missing`, `checksum_mismatch` y `legacy_unverified`. `wrong_profile` está implementado mediante comparación del `profileId` propietario; la duplicación reasigna explícitamente el propietario.

## Pruebas ejecutadas

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\run-sprint-0.ps1
```

Resultado: **20/20 PASS**, Chrome exit 0.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\run-sprint-1.ps1
```

Resultado: **31/31 PASS**, Chrome exit 0.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\run-sprint-2.ps1
```

Resultado: **45/45 PASS**, Chrome exit 0.

```text
Code.exe --check <todos los JavaScript>
```

Resultado: **41/41 PASS**.

`git diff --check`: sin errores; solo avisos informativos LF/CRLF configurados por Git.

## Escenarios Sprint 2

### A — Evidencias válidas

- Cinco PNG sintéticos importados mediante el flujo real de Sprint 1.
- Ocho secciones críticas vinculadas a una foto principal con checksum real.
- Coverage 90 %, validación formal, confirmación obligatoria, lock y recarga persistente.
- Builder conserva coverage; Compiler registra auditoría sin IDs/checksums en prompt visible.

### B — Eliminación vinculada

- Ocho referencias conservadas como `missing`.
- Coverage 90→0; Validation y Prompt Readiness actualizados.
- El rasgo textual permanece intacto.

### C — Aislamiento

- A y B mantienen fotografías, referencias y propietarios diferentes.
- Cambios repetidos no mezclan Evidence.
- Duplicar B reasigna `profileId` y desbloquea la copia.

### D — Perfil histórico

- DTO sin `evidence/evidenceVersion` normalizado idempotentemente.
- Rasgo histórico preservado.
- Nueva evidencia vinculada, guardada y recuperada tras recarga.

### E — Checksum mismatch

- Evidencia manipulada detectada como `checksum_mismatch`.
- Lock bloqueado y finding canónico presente.

### F — Desbloqueo

- Edición bloqueada mientras `locked=true`.
- Modal de confirmación aceptado explícitamente.
- Un evento `identity:unlocked`; edición posterior y persistencia correctas.

### G — Listeners

- Navegación repetida e `init()` repetido.
- Una vinculación, un evento y un registro.
- Binding sigue único tras recarga.

## Criterios de aceptación

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| Evidencias reales por IDs | PASS | cinco fotos y ocho vínculos |
| Checksum verificado | PASS | valid + mismatch |
| Sin Data URLs en Identity | PASS | aserción DTO/contract |
| Coverage de servicio | PASS | score 90→0 |
| Secciones críticas | PASS | ocho declaradas y cubiertas |
| Referencias rotas | PASS | ocho `missing` conservadas |
| Validation canónica | PASS | findings coverage/missing/mismatch |
| Prompt Readiness | PASS | actualización automática |
| Lock válido | PASS | formal + coverage + principal + confirmación |
| Unlock confirmado | PASS | modal + evento único |
| Persistencia | PASS | recargas A e histórica |
| Aislamiento | PASS | perfiles A/B/copia |
| Compatibilidad histórica | PASS | normalización sin pérdida |
| Evento unitario | PASS | 1 vínculo / 1 evento / 1 registro |
| Sin consola | PASS | cero errores/rejections |
| Sprint 0 | PASS | 20/20 |
| Sprint 1 | PASS | 31/31 |
| Sprint 2 | PASS | 45/45 |
| Arquitectura/dependencias | PASS | IIFE/globals; sin paquetes |

## Limitaciones y riesgos reales

1. Evidence hereda el riesgo de privacidad y cuota de las fotografías Data URL de Sprint 1, aunque Identity no las copia.
2. Referencias legacy sin checksum permanecen `legacy_unverified`; requieren desvincular/revincular para quedar verificadas.
3. El lock es una protección funcional de UI/servicio, no inmutabilidad criptográfica.
4. El modelo histórico agrupa ojos/cejas, piel tono/textura, cabello/canas y boca/labios; no se añadieron campos nuevos.
5. No existe un campo de accesorios permanentes en el DTO actual, por lo que no se creó una sección artificial.

## Archivos adicionales justificados

No se modificaron archivos fuera de la lista probable. Los únicos archivos nuevos son los tres documentos obligatorios y el runner solicitado. `photo.storage.js` no fue modificado.

## Recomendación

Siguiente sprint: **MVP Storage Safety & Recovery**. Debe medir cuota antes de importar, definir recuperación ante `QuotaExceededError` y preparar la migración aprobable a IndexedDB sin ejecutarla junto a dominios de producto.
