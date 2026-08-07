# PortraitOS — Sprint 7 Demo Experience Contract

## Estado

**IMPLEMENTED — VALIDATION PENDING**

## Propósito

Demo Mode existe para demostrar PortraitOS sin preparar manualmente un perfil completo y sin utilizar imágenes ni datos personales reales.

No es una segunda arquitectura, un fixture oculto ni una ruta alternativa de negocio. Utiliza las fachadas públicas existentes y produce un estado equivalente al que generaría un usuario real.

## Principios obligatorios

1. **Aislamiento:** nunca modifica un perfil real existente.
2. **Reversibilidad:** toda la demo puede eliminarse de forma explícita.
3. **Datos sintéticos:** no incluye personas reales ni datos biométricos reales.
4. **Fachadas canónicas:** usa ProfileManager/ProfileService, Photos, Identity, Direction, Validation, Prompt, History y Export mediante sus contratos públicos.
5. **Persistencia normal:** el perfil demo puede sobrevivir a reload exactamente como un perfil normal.
6. **Marcado inequívoco:** nombre, descripción y tags identifican el perfil como demostración.
7. **Idempotencia:** lanzar Demo Mode de nuevo reutiliza el escenario existente y no duplica silenciosamente History.
8. **Sin bypass en producción:** no utiliza `skipReadinessCheck` ni flags equivalentes.

## Implementación

### Servicio

`app/js/services/demo.mode.service.js`

Responsabilidades:

- localizar/reutilizar el perfil Demo RC1;
- crear un perfil aislado mediante `ProfileManager`;
- generar cinco imágenes abstractas válidas mediante Canvas;
- importarlas mediante `ProfileService.photos`;
- completar Identity y vincular evidencias mediante `ProfileService.identity`;
- validar y bloquear Identity con confirmación explícita;
- preparar Direction mediante `ProfileService.direction`;
- exigir readiness real con `ProfileValidation`;
- generar exactamente una versión mediante `PromptBinding`;
- construir un paquete con `PromptExportService` sin descarga automática;
- eliminar únicamente el perfil demo mediante `ProfileManager`.

### Binding

`app/js/bindings/demo.mode.binding.js`

Añade acciones secundarias en la cabecera:

- `Demo RC1` / `Abrir Demo RC1`;
- `Eliminar demo`.

Antes de crear o eliminar datos exige confirmación y explica el alcance. Durante la preparación muestra el paso actual y bloquea dobles ejecuciones.

### Fixtures visuales

Las cinco imágenes son composiciones Canvas abstractas de 720 × 720 px con rotulación `PORTRAITOS DEMO`.

No representan rostros, sujetos ni identidades reales.

## Escenario Demo RC1

### Perfil

Nombre: `Demo RC1 — Retrato editorial`

Tags:

- `portraitos-demo-rc1`
- `demo`
- `rc1`
- `editorial`

### Fotografías

Cinco imágenes sintéticas con roles conceptuales frontal, tres cuartos, perfiles y detalle.

### Identity

Las doce secciones reciben descripciones sintéticas. Las ocho secciones críticas reciben evidencias con IDs/checksums creados por Photos.

El servicio no altera reglas: primero valida Identity y después ejecuta `lock({ confirm: true })`.

### Creative Direction

Escenario editorial profesional con iluminación Rembrandt, cámara de retrato, composición 4:5, fondo de estudio, vestuario profesional y tratamiento realista.

### Validation

Se utiliza `ProfileValidation.getGenerationReadiness()` sin bypass.

### Generation

`PromptBinding.generate()` produce una generación real del pipeline local y una única entrada History.

### Export

`PromptExportService.exportPackage()` construye un `.portraitos` lógico completo con `download: false` durante la demo.

### Review

Sprint 7 no inventa un resultado de proveedor externo. Review permanece disponible para que el usuario cargue posteriormente una imagen real o un fixture explícito.

## Tests obligatorios

`tests/sprint-7-runner.html` cubre ahora:

1. Release metadata RC1.
2. Orientation Layer con cuatro áreas.
3. DemoModeService y DemoModeBinding cargados.
4. Perfil real inicial preservado.
5. Cinco fotografías sintéticas.
6. Evidencia visual válida.
7. Identity lock válido.
8. Direction ready.
9. Validation ready.
10. Una generación y una única entrada History.
11. Package exportable.
12. Segunda ejecución idempotente.
13. Persistencia de demo y perfil real al abrir una segunda instancia de `app/index.html`.
14. Cleanup elimina demo y conserva el perfil real.

## Gate pendiente

La implementación no se declara cerrada hasta obtener:

- `SPRINT_7_READY` dos veces consecutivas;
- regresión Sprint 0–6 verde;
- RC1 Runtime Gate verde;
- `git diff --check` PASS;
- working tree controlado.
