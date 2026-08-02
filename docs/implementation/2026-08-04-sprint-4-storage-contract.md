# Sprint 4 — Storage Contract

1. `ProfileStorage` es la única API pública de persistencia.
2. `STORAGE_MODE`: `auto`, `indexeddb` o `localstorage`; valor oficial por defecto `auto`.
3. Stores IndexedDB: `profile-library`, `binary-assets`, `legacy-consumers`.
4. `ready()` espera apertura, recuperación y migraciones iniciales.
5. `flush()` espera debounce, biblioteca, binarios y consumidores legacy.
6. `getStatus()` expone pendingWrites, lastCommittedAt, journalState, backend, degraded y lastError.
7. `getQuotaEstimate()` devuelve quota, usage y available.
8. `binary` ofrece `put/get/remove/exists/list` sin exponer IndexedDB.
9. `history`, `review`, `knowledge`, `wizard` y `legacy` preservan contratos síncronos mediante caché y journal.
10. Backup incluye manifest, biblioteca, consumidores y binarios; restore valida checksum antes de mutar.
11. Errores intermedios abortan la transacción; el record anterior y journal permanecen recuperables.
12. Eventos permitidos: ready, migrated, recovered, error, quota-warning, degraded y flush-complete.

