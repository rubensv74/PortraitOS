# Sprint 4 — Storage Hardening: análisis previo

Fecha: 2026-08-04. Base: `5ef94663cfd39f4267d26a51d9a784771fc77f8e`, árbol limpio, `0/0` respecto a `origin/main`. Rama: `feature/sprint-4-storage-hardening`.

## Inventario de propietarios

| Datos | Clave/store previo | Propietario | Contrato |
|---|---|---|---|
| Biblioteca Profile/Photos/Identity/Direction | `portraitos.profiles.v1`, `portraitos.storage.library.v2` | ProfileManager/ProfileStorage | API Manager síncrona; flush asíncrono |
| Wizard | `portraitos.wizard` | Wizard | lectura/escritura síncrona |
| Knowledge selection | `portraitos.knowledge-pack.selected`, `portraitos.knowledge-pack.by-profile.v1` | KnowledgePackService | síncrono y aislado por perfil |
| Prompt History | clave `STORAGE_KEY` del servicio | PromptHistoryService | API pública síncrona |
| Reviews | `portraitos.reviews.v1` | PortraitReviewService | síncrono por perfil |
| Perfil/settings/session legacy | claves de `storage.js` | PortraitStorage | adaptador histórico síncrono |
| Originales/miniaturas | Data URLs en `profile.identity.photos` | ProfilePhotos | importación asíncrona, lectura UI síncrona |

## Decisión

`ProfileStorage` permanece como única fachada. Los consumidores síncronos usan namespaces especializados respaldados por caché/journal y réplica IndexedDB; no conocen ningún backend. La biblioteca sigue siendo el agregado de metadatos. En `flush()`, toda Data URL transitoria se convierte a Blob, se escribe en stores binarios y se sustituye por referencia. La transacción incluye biblioteca, backup y binarios nuevos.

Stores: `profile-library`, `binary-assets` y `legacy-consumers`. Los binarios no se cargan al arranque. Las miniaturas y originales comparten store y se distinguen mediante `kind`.

El source histórico no se elimina automáticamente. La migración es idempotente por `binaryId = profileId:photoId:kind`; perfiles parcialmente migrados se reanudan. `localStorage` queda confinado a `profile.storage.js` como fallback/journal/migración.

## Riesgos y compatibilidad

- Los tests Sprint 1 inspeccionan Data URL inmediatamente tras importar; se conserva sólo en el objeto activo hasta `flush()`, nunca en el agregado confirmado.
- Las APIs legacy son síncronas; IndexedDB se replica en segundo plano y `flush()` confirma todas las réplicas.
- El modo `localstorage` no puede guardar Blob nativo; serializa Data URL exclusivamente dentro de la capa oficial como fallback degradado.
- El documento solicitado de Sprint 3 figura realmente versionado como `sprint-3-storage-validation-report.md`; se utilizó ese nombre real.

