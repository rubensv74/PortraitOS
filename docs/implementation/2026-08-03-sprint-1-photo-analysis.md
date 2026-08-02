# Sprint 1 — Análisis previo del dominio Photos

Fecha: 2026-08-03  
Rama: `feature/sprint-1-visual-evidence-platform`  
Commit inicial: `cd7b9c7ed43c8d6320e4e57e2d89822624f8e95c`

## Estado inicial

- `git status --short --branch`: `## main...origin/main`, sin cambios locales.
- Relación conocida con `origin/main`: `0` ahead / `0` behind mediante `git rev-list --left-right --count HEAD...origin/main`.
- Se creó la rama de trabajo obligatoria desde ese estado limpio. No se ejecutó `fetch`; la relación se refiere a la referencia remota local.
- UI-0 está integrado en `main` por `cd7b9c7` (merge de `eceb8a3`).

## Arquitectura observada

El flujo cargado conserva el patrón global/IIFE del repositorio:

```text
index.html
  → PhotosBinding
    → ProfileService.photos
      → ProfilePhotos
        → PhotoValidation
        → PhotoReader
        → PhotoThumbnail
        → PhotoMetadata
    → ProfileManager (persistencia del perfil activo)
      → localStorage: portraitos.profiles.v1
```

El modelo canónico actual está en `profile.identity.photos`; Validation (`profile.validation.js:370-375`), IdentityEngine (`identity.engine.js:342-350`) y el adaptador de Prompt (`prompt.binding.js:449-455`) leen esa colección. No existe un repositorio binario independiente: original y miniatura son Data URLs embebidas en el perfil.

## Responsabilidades y contratos por módulo

### `app/js/bindings/photos.binding.js`

- Inicializa una sola vez, registra input múltiple, drag & drop, delegación de acciones y drag para ordenar (`init`, `bindDomEvents`, líneas 78-256).
- Importa secuencialmente con `addFiles()` y limita a 12 (`DEFAULT_MAX_FILES`, `getAvailableSlots`).
- Renderiza tarjetas con miniatura, nombre, resumen técnico, principal, inspección, eliminación y orden (`render`, `buildPhotoCard`, líneas 1428-1593).
- Consume `ProfileService.photos` preferentemente (`getPhotoService`, líneas 1713-1721).
- Escucha seis eventos `profile:*` para renderizar (`bindApplicationEvents`, líneas 1679-1710).
- También emite eventos propios `binding:photos-added`, `binding:photo-primary-changed`, `binding:photo-removed` y `binding:photos-reordered`; esto duplica la señal de dominio producida por ProfileService.

### `app/js/services/profile.photos.js`

- Es el dominio de colección: `add`, `addMany`, `remove`, `update`, `setPrimary`, `reorder`, `move`, `get`, `getPrimary`, `list`, `clear` y `getSummary` (API pública, líneas 865-887).
- `add()` valida, obtiene dimensiones/metadatos, lee el original y crea thumbnail cuadrado; persiste todo dentro del objeto foto (`source.dataUrl`, `thumbnail.dataUrl`, líneas 40-155).
- `remove()` reasigna principal al primer elemento si elimina la principal (líneas 205-241).
- `reorder()` exige el conjunto exacto de IDs y actualiza `order`/`updatedAt` (líneas 350-434).
- No emite eventos ni persiste directamente; muta el perfil entregado por la fachada.

### `app/js/services/photo.reader.js`

- Fachada de lectura para Data URL, texto, ArrayBuffer, object URL e imagen decodificada.
- Expone cancelación segura de FileReader mediante `onabort` y errores normalizados (`readAsDataURL`, líneas 22-74).
- `loadImage()` valida la decodificación real, útil para bloquear imágenes corruptas (líneas 253-313).
- No mantiene caché ni modifica perfiles.

### `app/js/services/photo.thumbnail.js`

- Genera miniaturas proporcionales o cuadradas mediante Canvas (`create`, `createSquare`).
- Normaliza dimensiones, calidad, MIME y color; puede devolver Data URL o Blob.
- No persiste; cada invocación regenera el resultado.

### `app/js/services/photo.validation.js`

- Límites actuales: 12 fotos, 10 MB, 640×640 y MIME JPEG/PNG/WEBP.
- `validateFile()` valida instancia, tipo y tamaño, pero devuelve `true` o lanza; no devuelve `{valid, errors}` (`líneas 37-54`).
- `validateResolution()` decodifica vía una segunda lectura Data URL (`líneas 83-104`, `132-198`).
- No detecta archivo vacío explícitamente antes del tipo/tamaño, checksum, duplicados ni corrupción más allá de `Image.onerror`.

### `app/js/services/photo.metadata.js`

- Decodifica la imagen, extrae dimensiones, orientación, ratio, megapíxeles, nivel de resolución y calidad (`extract`, líneas 35-104).
- Conserva metadatos en estructura anidada `file`/`image`; genera un ID derivado de nombre, tamaño y lastModified, no un checksum del contenido.
- No modifica perfil ni cachea resultados.

## Modelo persistido actual

Cada elemento de `profile.identity.photos` contiene:

```text
id, name, role, notes, isPrimary, order, status,
source { dataUrl, type, size, originalName },
thumbnail { dataUrl, size },
dimensions { width, height, orientation },
metadata { id, file, image, quality, extractedAt },
createdAt, updatedAt
```

El contrato no expone en primer nivel todos los campos obligatorios de Sprint 1 (`filename`, `mime`, `width`, `height`, `orientation`, `filesize`, `checksum`). Hay duplicación: nombre/tipo/tamaño/dimensiones existen en más de una rama y `metadata.file` repite datos de `source`.

## Eventos e integración

`ProfileService.photos` emite eventos distintos por operación:

- `profile:photo-added`
- `profile:photos-added`
- `profile:photo-updated`
- `profile:photo-removed`
- `profile:primary-photo-changed`

Sin embargo, `reorder`, `move` y `clear` no emiten desde ProfileService (`profile.service.js:418-464`). PhotosBinding compensa algunos casos con eventos `binding:*`, creando dos familias. PromptBinding solo escucha add/remove (`prompt.binding.js:239-249`); por ello el cambio de principal u orden no invalida readiness desde ese consumidor. ValidationBinding escucha add/remove/primary/reorder según su lista actual, pero la señal no es uniforme. IdentityEngine sí obtiene la principal desde `profile.identity.photos` cuando se ejecuta, pero no posee un mecanismo propio de invalidación.

## Persistencia y aislamiento

- `ProfilePhotos` muta exclusivamente el perfil activo entregado por `ProfileService`; esto permite aislamiento lógico por perfil.
- La persistencia física depende de sincronizar el activo mediante `ProfileManager.saveActive()`/`persist()` hacia `portraitos.profiles.v1`.
- La colección completa, originales y miniaturas se serializan en `localStorage`. El límite de cuota puede interrumpir guardados y contiene evidencia biométrica en claro.
- No existe una fachada específica de blobs/fotos que permita cambiar el backend sin alterar el dominio.

## Defectos y riesgos demostrados antes de implementar

1. **Procesamiento duplicado:** PhotosBinding ejecuta lectura, thumbnail y metadata en `createPhotoRecord()` y luego `persistPhoto()` llama `ProfileService.photos.add(file)`, que repite esas tres operaciones y descarta el record preliminar (`photos.binding.js:734-963`; `profile.photos.js:40-155`).
2. **Contrato de validación incompatible:** el binding normaliza un resultado, pero `PhotoValidation.validateFile()` lanza. La llamada ocurre antes del `try` por archivo, por lo que un archivo inválido puede abortar el lote completo (`photos.binding.js:586-611`, `678-731`).
3. **Sin checksum:** no se calculan ni bloquean duplicados exactos; el ID de metadata no representa contenido.
4. **Modelo duplicado:** `source`, `dimensions` y `metadata` repiten tipo, tamaño y dimensiones.
5. **Eventos redundantes/incompletos:** eventos `profile:*` y `binding:*` coexisten; reorder/move/clear carecen de evento canónico en la fachada.
6. **Persistencia implícita:** las mutaciones de Photos no garantizan por sí mismas una única escritura de ProfileManager.
7. **Regeneración innecesaria:** no hay caché explícita; el pipeline duplicado genera dos thumbnails por importación.
8. **Corrupción y vacío:** la decodificación puede detectar corrupción, pero la gestión de lote no transforma uniformemente el error en un rechazo visible; el archivo vacío no tiene código dedicado en PhotoValidation.
9. **Cancelación:** FileReader soporta `abort`, pero el binding no expone un token de cancelación ni cancela un lote al cambiar de perfil/destruirse.
10. **Cuota:** Data URLs seguirán en localStorage por restricción del sprint; 12 originales de hasta 10 MB no son compatibles con cuotas habituales.

## Dirección de implementación dentro de la arquitectura existente

- Mantener `ProfilePhotos` como única fuente de verdad del dominio y `ProfileService.photos` como fachada activa.
- Introducir una fachada de almacenamiento de evidencias cargada antes de ProfilePhotos, inicialmente respaldada por el perfil/localStorage y con contrato preparado para IndexedDB, sin migrar datos en este sprint.
- Normalizar el modelo una vez al entrar al dominio; conservar aliases de lectura solo donde sean necesarios para perfiles existentes.
- Calcular SHA-256 del ArrayBuffer una sola vez y bloquear checksum repetido antes de añadir.
- Hacer que una operación de dominio produzca un único `photos:changed` con `profileId`, `operation`, snapshot/resumen y principal; consumidores reaccionan a esa señal, no recalculan desde UI.
- Hacer que la fachada persista una sola vez por operación/lote.
- Reutilizar thumbnail y metadata ya calculados; no regenerarlos al renderizar, cambiar perfil, ordenar o cambiar principal.
- Mantener todos los controles dentro de las clases y tokens de UI-0.

Este documento se creó antes de modificar código funcional, conforme al requisito de auditoría previa.
