# Sprint 3 — Storage Contract

Fecha: 2026-08-03.

1. `ProfileStorage` es la única fachada nueva para persistencia del agregado de perfil.
2. `init()` debe completarse antes de inicializar bindings y emite `storage:ready`.
3. IndexedDB (`portraitos`, store `profile-library`) es primario; `localStorage` es fallback/journal compatible.
4. La unidad atómica es la biblioteca completa `portraitos.profile-library`; una transacción sustituye el registro activo conservando el anterior como backup.
5. Toda escritura normaliza `storageVersion`, `schemaVersion`, `createdAt`, `updatedAt` y `migrationHistory` en cada perfil.
6. Toda carga y escritura valida estructura y checksum; una copia inválida nunca sustituye a la última válida.
7. `saveLibrary()` actualiza caché y coalesce escrituras; `flush()` resuelve sólo tras confirmación o rechaza con error tipado.
8. Antes de confirmar se consulta `navigator.storage.estimate()` cuando exista; insuficiencia produce `STORAGE_QUOTA` y preserva la versión anterior.
9. Ante interrupción/corrupción se intenta, en orden, registro primario, backup IndexedDB y journal válido; la recuperación emite `storage:recovered`.
10. La migración desde `portraitos.profiles.v1` copia y verifica sin borrar el origen, registra historial y emite `storage:migrated`.
11. `backup()`/`export()` excluyen claves temporales y contienen perfiles completos; `restore()`/`import()` validan antes de sustituir.
12. Eventos públicos permitidos: `storage:ready`, `storage:migrated`, `storage:recovered`, `storage:error`, `storage:quota-warning`.

## API

`init`, `save`, `load`, `remove`, `exists`, `migrate`, `exportData`, `importData`, `backup`, `restore`, `saveLibrary`, `loadLibrary`, `flush`, `describe`.

Los errores usan `ProfileStorageError` con códigos estables (`STORAGE_INVALID`, `STORAGE_CHECKSUM`, `STORAGE_QUOTA`, `STORAGE_WRITE_FAILED`, `STORAGE_NOT_FOUND`, `STORAGE_VERSION_UNSUPPORTED`).

