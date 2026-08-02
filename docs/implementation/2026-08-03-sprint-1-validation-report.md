# Sprint 1 — Informe de validación de Visual Evidence Platform

Fecha: 2026-08-03  
Rama: `feature/sprint-1-visual-evidence-platform`  
Estado: **SPRINT COMPLETE**

## Arquitectura implementada

Se conserva el patrón de PortraitOS:

```text
UI Photos → PhotosBinding → ProfileService.photos → ProfilePhotos
                                      ↓
                                 PhotoStorage
                                      ↓
                       ProfileManager / localStorage actual
```

- `ProfilePhotos` es la única fuente de verdad de la colección `profile.identity.photos`.
- `ProfileService.photos` es la frontera de mutación: persiste una vez y emite un único `photos:changed` por operación completada.
- `PhotosBinding` valida entrada, representa progreso/rechazos y renderiza; no calcula readiness ni mantiene un segundo modelo.
- Validation, Identity, Prompt Readiness y Wizard reaccionan al evento canónico.
- `PhotoStorage` encapsula el backend actual `profile-inline-localstorage` y declara el destino futuro `indexeddb-binary-v1` sin realizar la migración prohibida en este sprint.

## Implementación verificada

1. Selección múltiple y drag & drop conservan un único flujo `addFiles()`.
2. Validación estructurada bloquea archivo vacío, MIME no admitido y tamaño excesivo antes de procesar.
3. La decodificación real mediante `Image` bloquea archivos corruptos.
4. Cada fichero se lee, analiza y miniaturiza una sola vez en `ProfilePhotos.add()`.
5. SHA-256 del contenido identifica duplicados exactos; existe fallback determinista para runtimes sin Web Crypto.
6. El modelo almacena `id`, `filename`, `mime`, `width`, `height`, `orientation`, `filesize`, `checksum`, `createdAt` y `updatedAt`, manteniendo ramas heredadas requeridas por consumidores existentes.
7. Primera imagen principal automática; cambio y eliminación mantienen siempre una referencia válida mientras existan fotos.
8. Orden y principal persisten tras recarga.
9. Cambio de perfil durante una lectura cancela el alta antes de persistir o emitir evento en el perfil nuevo.
10. La biblioteca visual usa tarjetas, botones, badges, empty state, foco y tokens de UI-0; no usa tablas ni dependencias.

## Pruebas ejecutadas

### Sprint 1 E2E

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\run-sprint-1.ps1
```

Resultado: **31/31 PASS**, Chrome exit 0, `TEST_STATUS=passed`.

Cobertura observable:

- smoke y carga de fachada;
- input múltiple y zona drag & drop;
- importación de 10 PNG reales generados por Canvas;
- miniaturas JPEG, metadatos y checksums únicos;
- principal automática y cambio de principal;
- orden, eliminación de dos elementos y principal válida;
- rechazo de duplicado exacto, vacío, MIME inválido e imagen corrupta;
- actualización automática de Validation y Prompt Readiness;
- disponibilidad de principal para Identity;
- cancelación por cambio de perfil;
- aislamiento A/B;
- 15 mutaciones completadas y exactamente 15 eventos `photos:changed`;
- cero excepciones o rejections de escenario;
- recarga con perfil, 8 fotos, principal, orden y metadatos conservados;
- binding inicializado una sola vez.

### Regresión Sprint 0

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\run-sprint-0.ps1
```

Resultado: **20/20 PASS**, Chrome exit 0, `TEST_STATUS=passed`.

### Sintaxis JavaScript

Se ejecutó `Code.exe --check` como proceso independiente sobre los 41 `.js` versionados o nuevos. Resultado: **41/41 PASS**.

### Integridad Git

`git diff --check` no reportó errores; únicamente avisos informativos de conversión LF/CRLF configurada por Git para archivos existentes.

## Criterios de aceptación

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| Importación múltiple | PASS | escenario 10/10 |
| Drag & drop | PASS | dropzone y listeners inicializados; misma API de importación |
| Biblioteca moderna | PASS | tarjetas responsive en `design-system.css` |
| Miniaturas automáticas | PASS | 10/10 Data URLs JPEG |
| Principal persistente | PASS | cambio + recarga |
| Orden persistente | PASS | reverse order + recarga |
| Eliminación segura | PASS | 10→8; principal válida |
| Aislamiento por perfil | PASS | A=8, B=1, retorno estable |
| Rechazos profesionales | PASS | `DUPLICATE_PHOTO`, `EMPTY_FILE`, `INVALID_FORMAT`, `IMAGE_LOAD_FAILED` |
| Integración automática | PASS | Validation, Identity y Prompt Readiness |
| Evento único | PASS | 15 operaciones / 15 eventos |
| Cancelación segura | PASS | cambio de perfil durante lectura |
| Sin consola | PASS | cero errores/rejections |
| Regresión Sprint 0 | PASS | 20/20 |
| Sin dependencias/arquitectura nueva | PASS | globals/IIFE y capas existentes conservadas |

## Limitaciones actuales

1. Los originales y miniaturas siguen embebidos como Data URLs en `portraitos.profiles.v1`; es una decisión temporal impuesta por el alcance.
2. El límite funcional de 12×10 MB supera la cuota habitual de localStorage. `PhotoStorage` convierte el fallo de cuota en `PHOTO_STORAGE_QUOTA`, pero no puede ampliar la capacidad.
3. Los perfiles históricos sin checksum no pueden compararse por contenido hasta una futura migración; las nuevas importaciones sí quedan protegidas.
4. Se mantienen estructuras anidadas heredadas (`source`, `thumbnail`, `dimensions`, `metadata`) junto a los campos canónicos de Sprint 1 porque Identity, Validation y Prompt Builder las consumen. Eliminarlas requeriría una migración de contrato fuera de este sprint.
5. El checksum fallback no es criptográfico; SHA-256 se usa siempre que Web Crypto está disponible.

## Estrategia de migración a IndexedDB

1. Crear backend `indexeddb-binary-v1` detrás de `PhotoStorage`, conservando su API.
2. Guardar Blob original y thumbnail por `profileId/photoId`; el perfil conserva únicamente metadatos y referencias.
3. Migrar de forma incremental al abrir cada perfil, verificando checksum antes de retirar Data URLs.
4. Mantener lectura dual durante una versión y rollback a inline si una transacción falla.
5. Medir cuota y solicitar persistencia del navegador antes de lotes grandes.

Impacto esperado: menor tamaño de `portraitos.profiles.v1`, escrituras de perfil más rápidas y capacidad binaria superior. El coste será gestión asíncrona de disponibilidad, migración y limpieza transaccional al eliminar perfiles.

## Riesgos y recomendación para Sprint 2

El riesgo real pendiente es la cuota/privacidad de Data URLs. Se recomienda como Sprint 2 **Identity Evidence Integration**: consolidar las referencias de cada sección de identidad contra IDs/checksums válidos del dominio Photos, mostrar cobertura por ángulo y probar bloqueo/recuperación sin ampliar todavía Prompt o Export. La migración a IndexedDB debe planificarse como trabajo de infraestructura aprobado, no mezclarse con ese dominio.
