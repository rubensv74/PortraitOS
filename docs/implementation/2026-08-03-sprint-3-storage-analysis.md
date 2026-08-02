# Sprint 3 — Análisis de persistencia

Fecha: 2026-08-03. Rama de partida: `feature/sprint-3-persistence-recovery-platform`. Commit inicial: `24ce47c6c5b43a130d4e8ea79b48ffc31635ce12` (`origin/main`). El árbol estaba limpio y la rama local quedó creada desde ese commit.

## Evidencia encontrada

- `app/js/services/profile.manager.js` era el propietario efectivo de la biblioteca `portraitos.profiles.v1`: `readState()` y `persist()` accedían directamente a `localStorage`; el contrato público (`init`, `create`, `duplicate`, `select`, `saveActive`) era síncrono.
- `app/js/services/profile.service.js`, funciones `save`, `restore` y `removeSaved`, contenía un fallback directo a `localStorage` para claves `portraitos.profile.<id>`.
- `app/js/services/photo.storage.js` no almacenaba por sí mismo: delegaba en `ProfileManager.saveActive()` y anunciaba `profile-inline-localstorage`.
- Fotos, identidad, validación y dirección viven dentro del agregado de perfil que clona `ProfileManager`; por tanto una escritura de biblioteca preserva conjuntamente esos bloques.
- `app/index.html` inicializaba bindings inmediatamente en `DOMContentLoaded`; no existía barrera para abrir IndexedDB o migrar antes de cargar perfiles.
- Persisten accesos directos ajenos al agregado en `wizard.js`, `knowledge.pack.service.js`, `portrait.review.js`, `prompt.history.js` y la fachada histórica `storage.js`. Modificarlos implicaría Wizard/Prompt/Review/Knowledge fuera del alcance expreso. Se registran como deuda y no se presentan como migrados por Sprint 3.

## Restricción arquitectónica y decisión

IndexedDB es asíncrono y `ProfileManager` es consumido de forma síncrona por bindings y pruebas. Se mantiene ese contrato mediante una caché de biblioteca inicializada antes de los bindings. `ProfileStorage.init()` abre y recupera el backend; después `ProfileManager` opera en memoria y agenda escrituras coalescidas. `ProfileStorage.flush()` confirma la escritura atómica y permite pruebas/backup/reload deterministas.

El backend primario es IndexedDB. `localStorage` se conserva como origen de migración, journal de recuperación y fallback cuando IndexedDB no está disponible. La migración copia, normaliza, verifica checksum, escribe y marca versión; no elimina automáticamente la fuente histórica.

## Riesgos previos

1. Perfiles con fotografías base64 pueden superar cuota; antes no había estimación ni rollback.
2. JSON corrupto se descartaba silenciosamente mediante un estado vacío.
3. No había checksum, historial de migración, versión de storage ni transacción duradera.
4. Una recarga inmediata podía observar una escritura incompleta al introducir asincronía; `flush()` y el journal cubren ese límite.
5. Los accesos directos fuera del agregado siguen siendo deuda por la prohibición de modificar esos módulos.

