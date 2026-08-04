# Sprint 4 — Migration Contract

## Data URL → Blob

1. Detectar `source.dataUrl` y `thumbnail.dataUrl`.
2. Derivar IDs deterministas `profileId:photoId:original|thumbnail`.
3. Convertir a Blob y comprobar MIME/tamaño/checksum de la foto.
4. Escribir binarios y biblioteca en una transacción multi-store.
5. Sustituir Data URLs por `{binaryId, kind}` en el agregado confirmado.
6. Registrar `pending → in_progress → completed`; ante error `failed → rolled_back`.
7. Conservar journal y claves legacy; no borrar automáticamente el origen.

La operación es idempotente, reanudable y admite mezcla de fotos migradas y legacy. Un ID ya existente se sustituye idempotentemente. Un fallo antes del commit no deja biblioteca apuntando a un binario ausente.

## Integridad

Se informan `missing_binary`, `orphan_binary`, `missing_profile`, `wrong_profile`, `checksum_mismatch` y `legacy_unverified`. Los huérfanos se reportan, no se borran sin una política posterior aprobada.

