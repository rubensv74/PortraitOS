# Hallazgos de auditoría de PortraitOS

Fecha: 2026-08-02  
Orden: severidad descendente; dentro de cada severidad, impacto sobre el MVP.

## BLOCKER

### POS-B001 — Creative Direction no está conectada a la aplicación

- **Severidad:** BLOCKER
- **Tipo:** Integration, Functional, Persistence
- **Estado:** Confirmed
- **Descripción:** el HTML contiene 22 controles `data-direction-field`, pero `direction.binding.js` no aparece entre los scripts ni se inicializa. Los controles no actualizan `ProfileService` y la dirección requerida para readiness permanece en su estado inicial.
- **Evidencia:** `app/index.html:1212-1892`; lista de scripts `app/index.html:2430-2473`; `DirectionBinding.init()` y listeners en `app/js/bindings/direction.binding.js:963-1089`.
- **Impacto:** impide definir/persistir dirección creativa y bloquea validación/generación del prompt desde un perfil real.
- **Recomendación:** en el sprint de recuperación, integrar el binding respetando el orden de dependencias y verificar autosave, cambio de perfil y recarga. No se implementó.
- **Archivos afectados:** `app/index.html`, `app/js/bindings/direction.binding.js`, `app/js/services/profile.direction.js`, `app/js/services/profile.service.js`.
- **Dependencias:** `ProfileDirection`, `ProfileService`, `CreativeEngine`, `AppEvents`, Wizard.
- **Criterio de aceptación:** cada uno de los 22 controles carga el perfil activo, persiste su cambio, se aísla al cambiar perfil y se recupera tras recarga; cero listeners duplicados.

### POS-B002 — Dashboard y acción de validación están inertes

- **Severidad:** BLOCKER
- **Tipo:** Integration, Functional, UX
- **Estado:** Confirmed
- **Descripción:** `validation.binding.js` no se carga ni inicializa. El botón `data-action="validate-profile"` y el dashboard existen, pero su listener/render están exclusivamente en ese binding.
- **Evidencia:** botón `app/index.html:1940`; dashboard `:1913-2018`; selector/listener `app/js/bindings/validation.binding.js:21-61,148-220`; ausencia del script en `index.html:2430-2473`.
- **Impacto:** el usuario no puede ejecutar ni interpretar la validación exigida antes del prompt; score, severidades y recomendaciones quedan en valores de maqueta.
- **Recomendación:** cargar/inicializar el binding después de sus servicios y unificar su contrato con `ProfileValidation.getGenerationReadiness()`.
- **Archivos afectados:** `app/index.html`, `app/js/bindings/validation.binding.js`, `app/js/services/profile.validation.js`.
- **Dependencias:** perfil, fotos, identidad, dirección, Wizard, PromptBinding.
- **Criterio de aceptación:** el botón produce un reporte actualizado; cambios de perfil invalidan/recalculan; bloqueos deshabilitan generación; score y contadores coinciden con el contrato del servicio.

### POS-B003 — No existe un recorrido E2E demostrable del MVP

- **Severidad:** BLOCKER
- **Tipo:** Testability, Functional
- **Estado:** Confirmed
- **Descripción:** no hay pruebas, fixtures, servidor ni scripts. La prueba headless confirma arranque, pero los blockers B001/B002 impiden validar el recorrido perfil → fotos → identidad → dirección → validación → prompt → export → recarga.
- **Evidencia:** inventario `rg --files` contiene solo README y app; no hay `package.json` ni tests. Chrome: exit 0, `data-portraitos-ready=true`, stderr vacío; flujo completo NOT TESTED.
- **Impacto:** no puede declararse operativo ningún dominio central ni prevenir regresiones al reactivar.
- **Recomendación:** crear primero un smoke test reproducible y después un E2E mínimo con fixture de imagen pequeño, sin ampliar funcionalidad.
- **Archivos afectados:** futuros archivos de pruebas/configuración (a aprobar); todos los módulos del flujo.
- **Dependencias:** resolución de B001/B002 y decisión de runtime de pruebas.
- **Criterio de aceptación:** ejecución única automatizada recorre el MVP, recarga y comprueba aislamiento/persistencia, con salida no cero ante fallo.

## CRITICAL

### POS-C001 — Dos pipelines de prompt pueden validar y generar resultados distintos

- **Severidad:** CRITICAL
- **Tipo:** Architecture, Integration, Data
- **Estado:** Confirmed
- **Descripción:** la UI genera mediante `PromptBinding` (Builder → Compiler → Optimizer), pero `Wizard.validatePromptStep()` usa `PromptEngine` (IdentityEngine → CreativeEngine). El fallback de UI también usa PromptEngine.
- **Evidencia:** `app/js/ui.js:413-449`; `app/js/bindings/prompt.binding.js:93-147`; `app/js/wizard.js:700-727`; `app/js/engines/prompt.engine.js:52-150`.
- **Impacto:** un perfil puede superar la guarda de Wizard y fallar en generación, o producir contratos con validaciones/formatos diferentes.
- **Recomendación:** escoger una fachada de aplicación; se recomienda que Wizard previsualice/valide mediante el mismo `PromptBinding` usado para generar, manteniendo engines internos.
- **Archivos afectados:** `wizard.js`, `ui.js`, `prompt.binding.js`, `prompt.engine.js`, engines del pipeline.
- **Dependencias:** contrato de `ProfileValidation`, historial y exportación.
- **Criterio de aceptación:** validación y generación usan el mismo contrato/entrada; una matriz de perfiles produce idéntico resultado de readiness y errores en ambos accesos.

### POS-C002 — Persistencia de perfil fragmentada y susceptible a divergencia

- **Severidad:** CRITICAL
- **Tipo:** Architecture, Persistence, Data
- **Estado:** Probable
- **Descripción:** conviven `PortraitStorage` (`portraitos.profile.v1`), biblioteca `ProfileManager` (`portraitos.profiles.v1`) y `ProfileService.save(storageKey)`. ProfileManager mantiene clones y solo sincroniza el activo en operaciones concretas.
- **Evidencia:** `app/js/storage.js:14,537-639`; `app/js/services/profile.manager.js:4-7,112-145`; `app/js/services/profile.service.js:844-940`.
- **Impacto:** cambios recientes pueden no quedar en la biblioteca antes de recarga/cambio de perfil; migraciones y fuente de verdad son ambiguas.
- **Recomendación:** definir un repositorio canónico y pruebas de transición. Para MVP, conservar formato existente y centralizar todas las escrituras sin migración destructiva.
- **Archivos afectados:** `storage.js`, `profile.manager.js`, `profile.service.js`, bindings de dominio.
- **Dependencias:** todos los datos por perfil, import/export, wizard.
- **Criterio de aceptación:** una secuencia de editar/cambiar/recargar conserva exactamente cada perfil; una única API controla escritura y versión de esquema.

### POS-C003 — Fotos biométricas en Data URL compiten por la cuota de localStorage

- **Severidad:** CRITICAL
- **Tipo:** Persistence, Data, Security, Performance
- **Estado:** Confirmed
- **Descripción:** referencias y reviews almacenan imágenes completas como Data URL dentro de objetos serializados. El HTML permite hasta 12 fotos de 10 MB cada una, muy por encima de la cuota habitual de localStorage.
- **Evidencia:** límites declarados `app/index.html:625-633`; lectura/Data URL `profile.photos.js:62-126`; review `review.binding.js:38-51`; persistencia review `portrait.review.js:74-86`.
- **Impacto:** `QuotaExceededError`, pérdida de persistencia y exposición local de datos biométricos/personales en claro.
- **Recomendación:** para MVP, imponer/presentar un presupuesto persistible y manejar cuota de forma consistente; post-MVP evaluar IndexedDB/almacenamiento separado. Requiere aprobación arquitectónica.
- **Archivos afectados:** servicios de fotos, manager/storage, review, UI de errores.
- **Dependencias:** thumbnails, exportación, multi-perfil.
- **Criterio de aceptación:** límites realistas medidos, fallo de cuota no corrompe estado, mensaje recuperable y política de datos documentada.

## HIGH

### POS-H001 — History UI está implementada pero no existe en el producto accesible

- **Severidad:** HIGH
- **Tipo:** Integration, Functional, UX
- **Estado:** Confirmed
- **Descripción:** `history.binding.js` implementa búsqueda, filtros, favoritos, tags, restore y compare, pero no se carga, no se inicializa y no hay raíz `[data-history]` en HTML. Solo existe un contador.
- **Evidencia:** selectors `app/js/bindings/history.binding.js:48-84`; script ausente; `app/index.html:2121` contiene solo `data-prompt-history-count`.
- **Impacto:** el historial se guarda, pero el usuario no puede gestionar ni recuperar versiones desde la UI.
- **Recomendación:** excluir UI avanzada del MVP salvo recuperación mínima del último prompt; planificar integración completa en P3.
- **Archivos afectados:** `history.binding.js`, `prompt.history.js`, `index.html`, CSS.
- **Dependencias:** PromptBinding, ProfileManager, ExportBinding.
- **Criterio de aceptación:** para MVP, último resultado/contador persisten o alcance se documenta; para P3, todos los selectors y acciones tienen UI y pruebas.

### POS-H002 — Importación de perfiles y paquetes no es accesible

- **Severidad:** HIGH
- **Tipo:** Integration, Functional, UX
- **Estado:** Confirmed
- **Descripción:** existen APIs de importación/migración en Storage, ProfileImportExport, ProfileService y PromptExportService, pero el HTML no ofrece input/action de importación.
- **Evidencia:** `storage.js:944-1052`; `profile.importexport.js:92-171`; `profile.service.js:824-835`; ausencia de `data-import`/input JSON en `index.html`.
- **Impacto:** exportar no completa un ciclo de backup/restauración desde la aplicación.
- **Recomendación:** aplazar importación de paquete prompt si no es MVP; decidir si importación de perfil es requisito de recuperación antes de exponer una única API.
- **Archivos afectados:** servicios citados, `index.html`, binding de perfil/export.
- **Dependencias:** esquema/migración, ProfileManager.
- **Criterio de aceptación:** un archivo exportado válido se importa a un perfil nuevo sin sobrescribir datos; inválidos muestran error visible.

### POS-H003 — Router cargado, no iniciado y semánticamente divergente

- **Severidad:** HIGH
- **Tipo:** Architecture, Integration, UX
- **Estado:** Confirmed
- **Descripción:** Router define `photos`, `identity`, `faceLock`, `goal`, `perception`, `summary`; Wizard/HTML usan `profile`, `photos`, `identity`, `direction`, `validation`, `prompt`. No hay inicio del router.
- **Evidencia:** `app/js/router.js:14-116`; `app/js/wizard.js:22-63`; atributos en `index.html:99-244`; bootstrap sin Router.
- **Impacto:** URLs profundas, back/forward y restauración por hash no son fiables; aumenta acoplamiento y confusión de mantenimiento.
- **Recomendación:** adaptar Router a los IDs actuales o retirarlo tras decisión; recomendación: adaptador de URL sobre Wizard, sin segundo estado.
- **Archivos afectados:** `router.js`, `wizard.js`, `ui.js`, `index.html`.
- **Dependencias:** guardas, progreso, accesibilidad/foco.
- **Criterio de aceptación:** seis rutas canónicas, back/forward coherente, ruta inválida controlada y un único estado de paso.

### POS-H004 — Validation presenta contratos y rutas de reglas potencialmente duplicados

- **Severidad:** HIGH
- **Tipo:** Architecture, Technical debt, Data
- **Estado:** Probable
- **Descripción:** Wizard valida por métodos de ProfileService; PromptBinding usa `getGenerationReadiness`; ValidationBinding consolida sus propios pesos/severidades y engines. Sin pruebas contractuales pueden divergir.
- **Evidencia:** `wizard.js:660-735`; `prompt.binding.js:273-295`; `validation.binding.js:67-123`; `profile.validation.js` contiene reglas y score.
- **Impacto:** score visible, botón habilitado y error de generación pueden no coincidir.
- **Recomendación:** definir un DTO de validación único producido por ProfileValidation; bindings solo renderizan.
- **Archivos afectados:** validation service/binding, wizard, prompt binding.
- **Dependencias:** todos los dominios del perfil.
- **Criterio de aceptación:** snapshots contractuales demuestran igualdad de severidad, score, blockers y readiness para los mismos fixtures.

### POS-H005 — Export PortraitOS no proporciona integridad verificable

- **Severidad:** HIGH
- **Tipo:** Data, Security, Functional
- **Estado:** Confirmed
- **Descripción:** el paquete incluye schema/version y se puede parsear, pero no se encontró checksum/firma. La UI tampoco expone importación posterior.
- **Evidencia:** paquete `app/js/services/prompt.export.js:106-190`; búsqueda de `checksum/hash` sin implementación en export; formats `:31-42`.
- **Impacto:** corrupción o manipulación no se detecta de forma explícita; promesa de paquete reimportable es parcial.
- **Recomendación:** documentar el formato como JSON sin integridad en MVP o añadir checksum en un sprint posterior con versionado.
- **Archivos afectados:** `prompt.export.js`, `export.binding.js`, importador futuro.
- **Dependencias:** esquema y compatibilidad.
- **Criterio de aceptación:** alcance MVP documentado; si se añade checksum, corrupción de un byte se rechaza con error legible.

## MEDIUM

### POS-M001 — No hay estrategia de versiones coherente

- **Severidad:** MEDIUM
- **Tipo:** Documentation, Technical debt
- **Estado:** Confirmed
- **Descripción:** README declara `0.1.0 Foundation`, la UI `v1.0` y los módulos mantienen versiones independientes.
- **Evidencia:** `README.md`; `app/index.html:281`; constantes VERSION en engines/services.
- **Impacto:** soporte, migración y release candidate no tienen identificador inequívoco.
- **Recomendación:** establecer una versión de producto y mantener versiones de esquema separadas.
- **Archivos afectados:** README, HTML, futuras notas de release.
- **Dependencias:** RC y migraciones.
- **Criterio de aceptación:** una única versión de producto visible y versionada; esquemas documentados por clave.

### POS-M002 — localStorage corrupto se recupera de forma desigual

- **Severidad:** MEDIUM
- **Tipo:** Persistence, Data
- **Estado:** Probable
- **Descripción:** ProfileManager captura parse y vuelve a estado inicial; otros servicios varían entre fallback, warning y throw. No hay informe/migración transversal.
- **Evidencia:** `profile.manager.js:123-140`; `portrait.review.js:72-86`; `knowledge.pack.service.js:163-176`; `storage.js:944-1024`.
- **Impacto:** pérdida silenciosa o experiencia distinta según módulo.
- **Recomendación:** política común de lectura, backup y error visible.
- **Archivos afectados:** todos los servicios persistentes.
- **Dependencias:** repositorio canónico (C002).
- **Criterio de aceptación:** fixtures corruptos por clave no rompen el arranque ni borran silenciosamente datos recuperables.

### POS-M003 — Renderizado con innerHTML amplía la superficie XSS local

- **Severidad:** MEDIUM
- **Tipo:** Security
- **Estado:** Requires runtime validation
- **Descripción:** varios bindings construyen HTML. Algunos escapan valores explícitamente, pero no existe CSP ni prueba sistemática de payloads importados.
- **Evidencia:** asignaciones en `ui.js:901-1557`, `knowledge.binding.js:66`, `profile.manager.binding.js:67`, `review.binding.js:94-108`, `validation.binding.js:1702-1892`.
- **Impacto:** un perfil/paquete importado malicioso podría inyectar markup si atraviesa un render no escapado.
- **Recomendación:** inventariar cada sink, preferir `textContent`/DOM APIs y añadir casos de importación hostil; no modificar arquitectura sin aprobación.
- **Archivos afectados:** UI y bindings citados.
- **Dependencias:** importación y exportación.
- **Criterio de aceptación:** payloads `<img onerror>` y atributos escapados se muestran como texto y CSP compatible bloquea ejecución inline tras plan específico.

### POS-M004 — Accesibilidad y responsive carecen de validación reproducible

- **Severidad:** MEDIUM
- **Tipo:** Accessibility, UX, Testability
- **Estado:** Requires runtime validation
- **Descripción:** hay ARIA, foco y botones tipados, pero no hay auditoría axe, matriz de teclado ni viewport. La navegación dinámica debe validar foco/hidden.
- **Evidencia:** 26/26 botones con `type`, 0 IDs duplicados; `aria-live`, progressbar y `aria-hidden` en HTML; sin tests.
- **Impacto:** bloqueos de teclado/lector o mobile pueden aparecer al integrar bindings.
- **Recomendación:** añadir chequeo básico en estabilización P2.
- **Archivos afectados:** `index.html`, CSS, `ui.js`, bindings.
- **Dependencias:** navegación estabilizada.
- **Criterio de aceptación:** flujo MVP por teclado, foco visible, sin errores axe críticos y viewports definidos sin overflow bloqueante.

## LOW

### POS-L001 — README describe una arquitectura física inexistente

- **Severidad:** LOW
- **Tipo:** Documentation
- **Estado:** Confirmed
- **Descripción:** README lista `identity/`, `prompt/`, `creative/`, `knowledge/`, `assets/`, `docs/`, `profiles/`, pero el árbol real se concentra en `app/js/{bindings,engines,services,utils}`.
- **Evidencia:** `README.md` frente a `rg --files`.
- **Impacto:** orientación inicial errónea.
- **Recomendación:** actualizar después de decidir arquitectura, sin usar README como evidencia de completitud.
- **Archivos afectados:** `README.md`.
- **Dependencias:** decisión del sprint de recuperación.
- **Criterio de aceptación:** árbol y punto de entrada documentados coinciden con el repositorio.

### POS-L002 — No hay formulario semántico ni fallback de submit

- **Severidad:** LOW
- **Tipo:** Accessibility, UX
- **Estado:** Confirmed
- **Descripción:** existen 0 `<form>`; toda gestión depende de listeners JS.
- **Evidencia:** análisis HTML: `FORMS=0`, 26 botones tipados.
- **Impacto:** Enter/submit y semántica de agrupación no están disponibles de manera estándar.
- **Recomendación:** evaluar en P2 tras estabilizar listeners; no es blocker del MVP local JS.
- **Archivos afectados:** `app/index.html`, bindings.
- **Dependencias:** comportamiento de autosave/validación.
- **Criterio de aceptación:** decisión documentada y navegación/submit de teclado consistente.

## Resumen cuantitativo

| Severidad | Cantidad |
|---|---:|
| BLOCKER | 3 |
| CRITICAL | 3 |
| HIGH | 5 |
| MEDIUM | 4 |
| LOW | 2 |
| **Total** | **17** |
