# Sprint 2 — Análisis previo de Identity Evidence

Fecha: 2026-08-03  
Rama: `feature/sprint-2-identity-evidence-integration`  
Commit inicial: `bebe5df14b388bb7a2b5b6bcd964e844c24c87d8`

## Estado inicial

- Working tree limpio en la rama obligatoria.
- `git fetch origin` ejecutado antes de trabajar.
- `HEAD`, `origin/main` y `main` apuntan al merge `bebe5df`, que integra Sprint 1.
- Relación verificada con `origin/main`: `0` ahead / `0` behind.

## Arquitectura real

```text
Identity Workspace
  → IdentityBinding
    → ProfileService.identity
      → ProfileIdentity
        ↔ profile.identity
        → ProfileManager/localStorage (guardado desde binding)

ProfileValidation ← profile.identity + profile.identity.photos
IdentityEngine    ← ProfileIdentity.buildIdentityContract + photos
PromptBinding     → PromptBuilder → PromptCompiler
Wizard            ← eventos identity:* / readiness
```

Se conserva el patrón IIFE/global. `ProfileService` es la fachada activa; `ProfileIdentity` muta el DTO y `ProfilePhotos` sigue siendo la fuente exclusiva de fotografías.

## DTO real de Identity

`ProfileIdentity.initialize()` normaliza `profile.identity` y preserva `identity.photos`. El DTO contiene:

```text
status: draft | review | validated | locked
locked, lockedAt, lockedBy
summary, ageAppearance, genderPresentation
sections: {
  general, face, skin, hair, eyes, nose, mouth, jaw,
  facial-hair, age-markers, asymmetries, distinctive-features
}
section: { description, confidence, sourcePhotoIds[], notes, updatedAt }
validation: {
  completeness, missingSections, warnings, validatedAt, validatedBy
}
createdAt, updatedAt
photos[]
```

`sourcePhotoIds` constituye un contrato previo de evidencia, pero no valida checksum, perfil propietario ni existencia. Es consumido por `ProfileValidation.validateIdentitySections()` y por `IdentityEngine.buildSections()`.

## Campos y mapper de interfaz

`IdentityBinding.PATH_MAP` traduce 14 controles:

| UI | DTO |
| --- | --- |
| `summary` | `identity.summary` |
| `general.age` | `identity.ageAppearance` |
| `face.shape` + `face.proportions` | `sections.face.description` con dos líneas prefijadas |
| `skin.description` | `sections.skin.description` |
| `hair.description` | `sections.hair.description` |
| `eyes.description` | `sections.eyes.description` |
| `nose.description` | `sections.nose.description` |
| `mouth.description` | `sections.mouth.description` |
| `jaw.description` | `sections.jaw.description` |
| `facial-hair.description` | `sections.facial-hair.description` |
| `age-markers.description` | `sections.age-markers.description` |
| `asymmetries.description` | `sections.asymmetries.description` |
| `distinctive-features.description` | `sections.distinctive-features.description` |

El modelo no separa cejas de ojos, tono/textura dentro de piel, canas dentro de cabello ni labios de boca. Tampoco existe un rasgo editable de accesorios permanentes. Sprint 2 conservará esas agrupaciones y no inventará campos.

## Persistencia y eventos actuales

- Ediciones llaman `ProfileService.identity.updateGeneral/updateSection`; el binding hace autosave a los 650 ms con `ProfileManager.saveActive()`.
- `ProfileService.identity` no persiste ni emite eventos por sí mismo.
- El binding emite `identity:validated`, `identity:locked`, `identity:unlocked` y `identity:autosaved`; las mutaciones por campo se originan desde métodos de ProfileIdentity sin evento canónico.
- `IdentityBinding` escucha perfil/importación/`photos:changed` y recarga todo el formulario. No recalcula integridad porque no existe ese contrato.
- El bloqueo actual solo exige `status=validated`; no exige confirmación, principal, cobertura ni referencias íntegras.
- El desbloqueo de dominio exige `options.confirm=true`, pero el binding la proporciona automáticamente sin preguntar al usuario.

## Validación y consumidores

- `ProfileIdentity.recalculateValidation()` calcula completitud como número de secciones con descripción / 12. No considera evidencias.
- `ProfileIdentity.validate()` exige 70 % y resumen.
- `ProfileValidation.validateIdentity()` comprueba resumen, edad, completitud y lock según opciones.
- `validateIdentitySections()` revisa forma de cada sección y tipo de `sourcePhotoIds`.
- `validateCrossDependencies()` detecta IDs de fotos inexistentes, pero no checksum, cobertura, legacy ni perfil incorrecto.
- `IdentityEngine` genera traits y copia `sourcePhotoIds`; `buildPhotoEvidence()` resume fotografías del perfil.
- `PromptBuilder` normaliza identidad y fotos por separado; `PromptCompiler` convierte los rasgos en texto. No necesita IDs/checksums en el prompt visible.

## Divergencias y riesgos

1. `sourcePhotoIds` demuestra intención de vínculo, pero carece de integridad verificable.
2. El bloqueo puede declarar válida una identidad sin evidencia o fotografía principal.
3. El binding confirma desbloqueo implícitamente, incumpliendo confirmación explícita.
4. El cálculo de completitud y la validación global no comparten una métrica de cobertura.
5. Eliminar una foto deja IDs rotos; no se borran silenciosamente, pero solo se detectan en validación cruzada general.
6. Identity no registra perfil propietario en sus referencias; una importación manipulada podría introducir un ID ajeno.
7. El engine puede exponer IDs de evidencia en su contrato heredado; Prompt no debe convertirlos en texto visible.
8. Los listeners por `photos:changed` recargan todo el formulario y podrían descartar foco; la nueva UI separará render de estado y campos.
9. Autosave, eventos del binding y mutaciones del servicio pueden producir señales no unitarias.
10. Perfiles históricos pueden tener `sourcePhotoIds` sin checksum; bloquearlos automáticamente sería incompatible.

## Contrato canónico adoptado

`identity.evidence` será un objeto indexado por los doce nombres reales de sección. Cada registro contendrá solo referencia y contexto mínimo:

```js
{
  photoId,
  checksum,
  profileId,
  role,
  note,
  createdAt
}
```

`sourcePhotoIds` pasa a ser un adaptador derivado de `identity.evidence[section]`. Para perfiles históricos, `initialize()` migrará idempotentemente IDs existentes a registros sin checksum, cuyo estado será `legacy_unverified`. No se eliminará el array por compatibilidad con consumidores versionados.

## Mapeo de evidencias

| Necesidad del sprint | Sección real |
| --- | --- |
| Rostro general | `face` |
| Edad aparente | `general` y texto `ageAppearance` |
| Ojos y cejas | `eyes` |
| Nariz | `nose` |
| Labios | `mouth` |
| Mandíbula | `jaw` |
| Tono y textura de piel | `skin` |
| Cabello y canas | `hair` |
| Barba/bigote | `facial-hair` |
| Asimetrías | `asymmetries` |
| Rasgos distintivos | `distinctive-features` |
| Marcadores de edad | `age-markers` |
| Accesorios permanentes | No existe campo; no se crea en Sprint 2 |

## Archivos afectados y decisiones

- `profile.identity.js`: normalización, evidencia, integridad, cobertura y lock canónicos.
- `profile.service.js`: frontera de persistencia/evento unitario para Identity.
- `identity.binding.js` + `index.html` + Design System: selección/vínculo/estado sin biblioteca paralela.
- `profile.validation.js`: consumir el resultado canónico; no recalcular.
- `identity.engine.js`: contexto estructural resumido sin datos binarios.
- `prompt.binding.js`/Wizard: reaccionar a eventos canónicos; no cambiar pipeline.
- `constants.js`/`events.js`: registrar evento si se adopta.
- Prompt Builder/Compiler no se modificarán salvo que las pruebas demuestren que filtran evidencia al texto visible de forma incorrecta.

Este análisis y la definición del contrato se realizaron antes de modificar código funcional.
