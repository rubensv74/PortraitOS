# Backlog de reactivación del MVP de PortraitOS

Fecha: 2026-08-02  
Regla: el backlog describe trabajo futuro; esta auditoría no lo implementa.

## Definición operativa del MVP

El MVP queda cerrado cuando, desde una instalación local limpia, una persona puede:

1. crear y seleccionar un perfil;
2. importar al menos una referencia válida y elegir la principal;
3. definir, validar y bloquear identidad;
4. configurar dirección creativa;
5. obtener un reporte de readiness coherente;
6. generar un prompt por el pipeline canónico;
7. copiarlo o exportarlo;
8. recargar y recuperar el perfil, referencias, identidad, dirección y último resultado necesario para continuar.

### Imprescindible

Perfil y aislamiento, fotos mínimas, identidad lock, dirección, validación única, generación, copia/export básico, persistencia/recarga, errores visibles y un E2E del flujo.

### Importante pero aplazable

Importación gráfica de backup, selector completo de historial, migraciones avanzadas, accesibilidad y responsive exhaustivos, paquete con checksum.

### Post-MVP

History Studio completo (comparación/favoritos/tags), múltiples presets/catálogos externos, Portrait Review avanzado, análisis automático de imagen, cambios de arquitectura/modularización y almacenamiento binario definitivo.

## P0 — Bloqueadores del MVP

### P0-01 — Conectar Creative Direction al perfil activo

- **Problema:** 22 campos HTML no tienen binding cargado.
- **Objetivo:** hacer editable y persistente el modelo creativo existente.
- **Alcance:** carga/init del binding, dependencias, autosave, carga por perfil, eventos y recarga.
- **Fuera de alcance:** nuevos campos, rediseño, nuevos presets.
- **Archivos probables:** `app/index.html`, `app/js/bindings/direction.binding.js`, `profile.direction.js`, `profile.service.js`.
- **Dependencias:** ninguna funcional nueva; contrato actual.
- **Riesgos:** listeners duplicados, escritura sobre otro perfil, valores por defecto que parezcan guardados.
- **Criterios de aceptación:** los 22 controles escriben/leen; cambio de perfil aísla valores; recarga conserva; validación creativa responde a cambios.
- **Tamaño:** M
- **Prioridad:** P0-1

### P0-02 — Conectar dashboard de Validation y unificar el DTO

- **Problema:** botón/dashboard inertes y rutas de reglas potencialmente divergentes.
- **Objetivo:** una validación visible y canónica.
- **Alcance:** carga/init del binding, consumo exclusivo de DTO de `ProfileValidation`, actualización por eventos, control de botón Generate.
- **Fuera de alcance:** nuevas reglas o nueva fórmula de score salvo corrección aprobada.
- **Archivos probables:** `index.html`, `validation.binding.js`, `profile.validation.js`, `prompt.binding.js`, `wizard.js`.
- **Dependencias:** P0-01.
- **Riesgos:** cambiar accidentalmente umbrales; doble listener de Generate.
- **Criterios de aceptación:** reporte y readiness coinciden; cambios invalidan; blockers deshabilitan Generate; sin doble generación.
- **Tamaño:** M
- **Prioridad:** P0-2

### P0-03 — Elegir y aplicar una única fachada de generación

- **Problema:** Wizard usa PromptEngine mientras UI usa PromptBinding.
- **Objetivo:** misma validación, contrato y errores en preview/guarda/generación.
- **Alcance:** decisión registrada, llamadas del Wizard/UI alineadas, compatibilidad con historial/export.
- **Fuera de alcance:** reescribir engines, añadir proveedores.
- **Archivos probables:** `wizard.js`, `ui.js`, `prompt.binding.js`, `prompt.engine.js`.
- **Dependencias:** P0-02.
- **Riesgos:** romper consumidores heredados o formato de exportación.
- **Criterios de aceptación:** un fixture válido genera por una ruta; uno inválido devuelve el mismo código/mensaje en validación y generación; una entrada produce una sola entrada de historial.
- **Tamaño:** M
- **Prioridad:** P0-3

### P0-04 — Crear smoke y E2E reproducibles del flujo mínimo

- **Problema:** no hay pruebas ni runtime configurado.
- **Objetivo:** demostrar el MVP y proteger reactivación.
- **Alcance:** servidor/test runner mínimo aprobado, fixture pequeño, flujo completo, recarga y aserciones de localStorage/UI.
- **Fuera de alcance:** cobertura total o visual regression completa.
- **Archivos probables:** nueva configuración/scripts/tests; código funcional solo si un fallo confirmado se aprueba aparte.
- **Dependencias:** P0-01 a P0-03.
- **Riesgos:** introducir tooling excesivo; tests frágiles por temporización.
- **Criterios de aceptación:** comando documentado, PASS en limpio, captura consola/404, falla ante binding ausente y comprueba recarga.
- **Tamaño:** M
- **Prioridad:** P0-4

## P1 — Integración esencial

### P1-01 — Garantizar persistencia y aislamiento multi-perfil

- **Problema:** objeto activo, biblioteca y PortraitStorage pueden divergir.
- **Objetivo:** una fuente de escritura canónica para el MVP.
- **Alcance:** contrato de repositorio, sincronización de cada dominio, pruebas editar/cambiar/recargar/eliminar.
- **Fuera de alcance:** migración a IndexedDB.
- **Archivos probables:** `profile.manager.js`, `profile.service.js`, `storage.js`, bindings de dominio.
- **Dependencias:** P0-04.
- **Riesgos:** pérdida de perfiles existentes.
- **Criterios de aceptación:** datos no cruzan perfiles; todos sobreviven recarga; fixture de formato anterior se conserva o migra sin pérdida.
- **Tamaño:** L
- **Prioridad:** P1-1

### P1-02 — Estabilizar fotos dentro del presupuesto local

- **Problema:** hasta 12×10 MB como Data URL no caben de forma fiable.
- **Objetivo:** importación mínima robusta y fallo recuperable.
- **Alcance:** prueba de tipo/tamaño/resolución/duplicado/principal/orden/eliminación; política de cuota y mensaje.
- **Fuera de alcance:** backend, nube, análisis facial, migración completa de storage.
- **Archivos probables:** servicios `photo.*`, `profile.photos.js`, `photos.binding.js`, manager/storage.
- **Dependencias:** P1-01.
- **Riesgos:** navegadores con cuotas distintas; memoria Canvas.
- **Criterios de aceptación:** fixture válido/duplicado/inválido; cuota no corrompe perfil; principal y orden sobreviven recarga.
- **Tamaño:** L
- **Prioridad:** P1-2

### P1-03 — Cerrar Identity Contract mínimo

- **Problema:** código conectado pero flujo real no probado.
- **Objetivo:** edición, validación y lock fiables, consumidos por pipeline.
- **Alcance:** campos obligatorios existentes, lock/unlock, mutación bloqueada, recarga y contrato del engine.
- **Fuera de alcance:** inferencia automática desde fotos.
- **Archivos probables:** `profile.identity.js`, `identity.binding.js`, `identity.engine.js`, `profile.validation.js`.
- **Dependencias:** P1-01/P1-02.
- **Riesgos:** umbral 70 % frente a readiness global.
- **Criterios de aceptación:** incompleto no bloquea incorrectamente/según contrato; locked impide edición; Builder recibe identidad exacta.
- **Tamaño:** M
- **Prioridad:** P1-3

### P1-04 — Verificar Knowledge Pack en dirección y prompt

- **Problema:** integración estática presente, no demostrada E2E.
- **Objetivo:** selección por perfil aplicada una vez y persistente.
- **Alcance:** catálogo actual, búsqueda/selección, cambio de perfil, `apply()` y salida de Builder.
- **Fuera de alcance:** packs externos/editor de packs.
- **Archivos probables:** `knowledge.pack.service.js`, `knowledge.binding.js`, `prompt.binding.js`, `profile.direction.js`.
- **Dependencias:** P0-01/P0-03/P1-01.
- **Riesgos:** mutar perfil o duplicar restricciones en cada generación.
- **Criterios de aceptación:** pack A/B produce diferencia esperada, no altera identidad, no acumula aplicación y se recupera por perfil.
- **Tamaño:** S
- **Prioridad:** P1-4

### P1-05 — Cerrar copy/export mínimo

- **Problema:** UI/servicio existen, pero dependen de un prompt no demostrado.
- **Objetivo:** copiar y descargar el resultado canónico.
- **Alcance:** TXT y JSON o PortraitOS mínimo, nombre saneado, errores de clipboard/download, contenido coherente.
- **Fuera de alcance:** checksum, import UI, export masivo de historial.
- **Archivos probables:** `prompt.export.js`, `export.binding.js`, `ui.js`, `index.html`.
- **Dependencias:** P0-03/P0-04.
- **Riesgos:** formatos duplicados en service/binding; datos sensibles.
- **Criterios de aceptación:** texto copiado igual al preview; archivo parseable con nombre seguro; metadata/negative toggles respetados.
- **Tamaño:** M
- **Prioridad:** P1-5

### P1-06 — Persistir y recuperar el resultado mínimo

- **Problema:** history service guarda, pero UI de gestión no está integrada.
- **Objetivo:** que recargar no pierda la continuidad MVP.
- **Alcance:** auto-save existente, contador y recuperación del último resultado del perfil para export/copy.
- **Fuera de alcance:** búsqueda, favoritos, tags, compare y restore múltiple.
- **Archivos probables:** `prompt.history.js`, `prompt.binding.js`, `export.binding.js`, prompt HTML.
- **Dependencias:** P0-03/P1-01.
- **Riesgos:** esquema de historial grande; asociación incorrecta.
- **Criterios de aceptación:** una generación crea una versión del perfil; recarga recupera último resultado; perfiles no comparten historial.
- **Tamaño:** M
- **Prioridad:** P1-6

## P2 — Estabilización

### P2-01 — Política uniforme ante localStorage corrupto/cuota

- **Problema:** manejo desigual y posible pérdida silenciosa.
- **Objetivo:** arranque seguro y errores recuperables.
- **Alcance:** contrato de error, backup/fallback no destructivo, notificación y fixtures corruptos.
- **Fuera de alcance:** cambio de motor de almacenamiento.
- **Archivos probables:** storage y servicios persistentes, UI.
- **Dependencias:** P1-01/P1-02.
- **Riesgos:** compatibilidad histórica desconocida.
- **Criterios de aceptación:** cada clave corrupta tiene resultado probado; ninguna limpia datos sin confirmación.
- **Tamaño:** M
- **Prioridad:** P2-1

### P2-02 — Resolver Router frente a Wizard

- **Problema:** dos vocabularios y Router inactivo.
- **Objetivo:** navegación única con URL/back/forward coherentes o retirada explícita.
- **Alcance:** decisión y seis rutas MVP; foco al cambiar panel.
- **Fuera de alcance:** routing multipágina.
- **Archivos probables:** `router.js`, `wizard.js`, `ui.js`, `index.html`.
- **Dependencias:** E2E estable.
- **Riesgos:** restauración de estado vs hash.
- **Criterios de aceptación:** un estado canónico; deep-link y back/forward probados; rutas inválidas controladas.
- **Tamaño:** M
- **Prioridad:** P2-2

### P2-03 — Seguridad de render/import/export y privacidad

- **Problema:** datos sensibles, innerHTML y paquetes sin política.
- **Objetivo:** reducir exposición razonable del MVP local.
- **Alcance:** revisar sinks, payloads hostiles, aviso de datos locales/export, nombres seguros.
- **Fuera de alcance:** cifrado/autenticación/cloud.
- **Archivos probables:** bindings con innerHTML, import/export, README/privacidad.
- **Dependencias:** alcance de import/export cerrado.
- **Riesgos:** CSP incompatible con scripts inline actuales.
- **Criterios de aceptación:** pruebas XSS básicas, contenido escapado y aviso claro de imágenes/datos persistidos.
- **Tamaño:** M
- **Prioridad:** P2-3

### P2-04 — Accesibilidad, teclado y responsive esenciales

- **Problema:** no validados.
- **Objetivo:** flujo MVP utilizable con teclado y viewport móvil básico.
- **Alcance:** foco, hidden/aria, labels, errores, contraste/overflow principal.
- **Fuera de alcance:** certificación formal WCAG completa.
- **Archivos probables:** `index.html`, CSS, `ui.js` y bindings.
- **Dependencias:** P2-02.
- **Riesgos:** regresión visual.
- **Criterios de aceptación:** sin issues críticos automatizados, recorrido por teclado y viewports objetivo documentados.
- **Tamaño:** M
- **Prioridad:** P2-4

### P2-05 — Alinear versión y documentación de ejecución

- **Problema:** README 0.1.0 vs UI 1.0; árbol ficticio.
- **Objetivo:** build/release reproducible y documentación veraz.
- **Alcance:** versión única, instrucciones locales/tests, claves/esquemas.
- **Fuera de alcance:** documentación comercial.
- **Archivos probables:** `README.md`, HTML, nuevo documento/version file si se aprueba.
- **Dependencias:** alcance RC.
- **Riesgos:** ninguno material.
- **Criterios de aceptación:** una versión visible, comando de arranque/pruebas y arquitectura real documentada.
- **Tamaño:** S
- **Prioridad:** P2-5

## P3 — Post-MVP

### P3-01 — Integrar History Studio completo

- **Problema:** binding de 34 KB y capacidades avanzadas inaccesibles.
- **Objetivo:** búsqueda, favoritos, tags, restore, compare, borrado y paginación.
- **Alcance:** DOM/CSS/binding/service y pruebas por perfil.
- **Fuera de alcance:** sincronización cloud.
- **Archivos probables:** `history.binding.js`, `prompt.history.js`, `index.html`, CSS.
- **Dependencias:** P1-06.
- **Riesgos:** gran superficie UX y acciones destructivas.
- **Criterios de aceptación:** todas las acciones con confirmación, persistencia y aislamiento probados.
- **Tamaño:** L
- **Prioridad:** P3-1

### P3-02 — Exponer importación segura de perfiles/paquetes

- **Problema:** APIs sin UI.
- **Objetivo:** restauración explícita y no destructiva.
- **Alcance:** selector, preview, validación/migración y creación de perfil nuevo.
- **Fuera de alcance:** merge automático complejo.
- **Archivos probables:** profile/importexport/storage, bindings, HTML.
- **Dependencias:** P1-01/P2-03.
- **Riesgos:** corrupción, XSS, sobrescritura.
- **Criterios de aceptación:** round trip de fixture válido; inválido no muta estado.
- **Tamaño:** M
- **Prioridad:** P3-2

### P3-03 — Diseñar almacenamiento de imágenes escalable

- **Problema:** localStorage/Data URL no escala.
- **Objetivo:** separar binarios y datos estructurados.
- **Alcance:** ADR, prototipo/migración y política de cuota/borrado.
- **Fuera de alcance:** backend remoto salvo nuevo encargo.
- **Archivos probables:** nueva capa storage y servicios de fotos/review.
- **Dependencias:** telemetría/medición de P1-02.
- **Riesgos:** migración de datos y compatibilidad.
- **Criterios de aceptación:** diseño aprobado, migración reversible y pruebas de cuota.
- **Tamaño:** XL
- **Prioridad:** P3-3

### P3-04 — Evolucionar Portrait Review

- **Problema:** alcance actual exclusivamente manual.
- **Objetivo:** decidir si el producto necesita análisis automático o solo checklist.
- **Alcance:** discovery/ADR y, si se aprueba, implementación separada.
- **Fuera de alcance:** cualquier IA automática dentro del MVP.
- **Archivos probables:** review service/binding y futuros adaptadores.
- **Dependencias:** definición de producto y privacidad.
- **Riesgos:** coste, datos biométricos, falsos positivos.
- **Criterios de aceptación:** decisión de producto y criterios medibles antes de código.
- **Tamaño:** XL
- **Prioridad:** P3-4

### P3-05 — Modularización técnica

- **Problema:** globals, scripts por orden y archivos monolíticos.
- **Objetivo:** mejorar testabilidad sin alterar contratos funcionales.
- **Alcance:** ADR entre ES modules/build, migración incremental aprobada.
- **Fuera de alcance:** reescritura frontend.
- **Archivos probables:** transversal.
- **Dependencias:** MVP/RC estable y tests.
- **Riesgos:** regresión extensa.
- **Criterios de aceptación:** ADR aprobado, migración por slices y mismo E2E verde.
- **Tamaño:** XL
- **Prioridad:** P3-5

## Orden recomendado

`P0-01 → P0-02 → P0-03 → P0-04 → P1-01 → P1-02/P1-03 → P1-04 → P1-05/P1-06 → P2 → RC → P3`

El orden reduce primero incertidumbre de integración, después garantiza datos y finalmente estabiliza experiencia. No debe iniciarse P3 antes de cerrar los criterios del MVP.
