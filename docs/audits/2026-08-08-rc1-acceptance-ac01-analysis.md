# PortraitOS — RC1 Acceptance AC-01 Analysis

**Fecha:** 2026-08-08  
**Rama:** `fix/rc1-acceptance-ac01-photos`

## Estado

**AC-01 CONFIRMED — P0 / RC1 BLOCKER**

Durante el RC1 Acceptance Pass manual se confirmó que el paso Fotografías presenta tres síntomas visibles:

1. la tarjeta y miniatura de una fotografía importada se muestran;
2. la previsualización modal no es utilizable;
3. la confirmación de eliminación no es utilizable;
4. el botón Siguiente no permite pasar de Fotografías a Identidad pese a existir una fotografía principal.

## Causas raíz confirmadas

### 1. Modal renderizado detrás del backdrop

`UI.openModal()` y `UI.confirm()` crean dentro de `data-modal-root` dos hermanos: `.modal-backdrop` y `.modal`.

En `app/css/app.css` el backdrop es `position: fixed` con `z-index: 900`, mientras `.modal` no tiene posicionamiento ni z-index superior. El resultado visual es exactamente el observado en acceptance: toda la aplicación queda oscurecida/desenfocada, pero el contenido del modal queda detrás del backdrop.

Esto afecta simultáneamente a:

- previsualización de fotografías (`PhotosBinding.inspectPhoto()` → `UI.openModal()`);
- eliminación (`PhotosBinding.removePhoto()` → `UI.confirm()`);
- cualquier otra confirmación/modal basado en la misma infraestructura.

### 2. Contrato incompatible entre Wizard y Photo summary

`Wizard.validatePhotosStep()` espera:

- `summary.count`
- `summary.primaryPhotoId`

pero `ProfileService.photos.summary()` delega en `ProfilePhotos.getSummary()`, cuyo contrato real devuelve:

- `summary.total`
- `summary.primaryId`
- `summary.hasPrimary`

Por tanto, aunque exista una fotografía y esté marcada como principal, el Wizard interpreta `count` como 0 y `primaryPhotoId` como ausente, bloqueando el paso 2.

## Decisión de corrección

No modificar almacenamiento ni modelo de fotografía.

Aplicar dos cambios mínimos:

1. corregir la capa visual del modal mediante `.modal-root`, backdrop absoluto y modal con z-index superior;
2. hacer `Wizard.validatePhotosStep()` compatible con el contrato real de `ProfilePhotos.getSummary()`, aceptando `total/count` y `primaryId/primaryPhotoId`.

## Criterios de aceptación

AC-01 queda cerrado únicamente si en navegador real se confirma:

- Preview abre modal visible con la fotografía.
- El botón Cerrar funciona.
- Eliminar abre confirmación visible.
- Confirmar elimina realmente la fotografía.
- Con una fotografía principal, Siguiente avanza a Identidad.
- La corrección no altera Sprint 0–7.

## Alcance

- Sin cambios de arquitectura.
- Sin dependencias nuevas.
- Sin cambios en `ProfileStorage`.
- Sin cambios en persistencia binaria.
- Sin cambios de dominio Identity/Direction.
