# Sprint 0 — Contratos canónicos

Fecha: 2026-08-02  
Rama: `fix/sprint-0-portrait-contract-flow`

## Creative Direction

- **DTO de dominio:** `profile.direction`, inicializado por `ProfileDirection.initialize()` en `app/js/services/profile.direction.js`. Contiene estado, objetivo/formato/mood, bloques `lighting`, `camera`, `composition`, `background`, `wardrobe`, `pose`, `treatment`, constraints, references y timestamps.
- **Servicio:** `ProfileDirection`; fachada activa `ProfileService.direction` en `app/js/services/profile.service.js`.
- **Binding:** `DirectionBinding` en `app/js/bindings/direction.binding.js`; conecta exactamente los 22 controles `[data-direction-field]`.
- **Persistencia:** `ProfileService.direction.replace()` sustituye únicamente la dirección del perfil activo y emite `direction:updated`. El debounce de `DirectionBinding.save()` llama `ProfileManager.saveActive()`, que sincroniza el clon activo y persiste `portraitos.profiles.v1`.
- **Aislamiento:** `ProfileManager.select()` sincroniza el perfil saliente, carga el entrante mediante `ProfileService.load()` y emite `profile:loaded`; DirectionBinding recarga entonces sus controles.
- **Evento normalizado:** `direction:updated`, emitido una vez por `ProfileService.direction.replace()` por mutación.

### Mapper UI → dominio

El HTML conserva cinco alias históricos. `DirectionBinding.mapDirectionToDomain()` es la única frontera y conserva ambos nombres por compatibilidad:

| UI | Dominio |
|---|---|
| `composition.format` | `direction.format` y `composition.aspectRatio` |
| `treatment.mood` | `direction.mood` |
| `camera.lens` | `camera.focalLength` |
| `pose.position` | `pose.bodyPosition` |
| `wardrobe.description` | `wardrobe.notes` |
| `wardrobe.colors` texto CSV | `wardrobe.colors[]` |
| perfil `description`/`name` | fallback de `direction.objective` cuando no existe campo específico |

`DirectionBinding.validateAll()` marca `direction.status="ready"` solo si el formulario y restricciones creativas son válidos; cualquier edición empieza en `draft`.

## Validation

- **Servicio canónico:** `ProfileValidation.getGenerationReadiness(profile, options)` en `app/js/services/profile.validation.js`.
- **Consumidores:** `ValidationBinding.validate()`, `PromptBinding.runPipeline()` y `PromptBinding.updateReadinessPanel()`.
- **Adaptador:** ValidationBinding transforma findings/rules del servicio exclusivamente para renderizar secciones; no recalcula score ni readiness.

### DTO canónico de readiness

| Campo | Semántica |
|---|---|
| `ready` | autorización canónica para generar |
| `valid` | ausencia de errores de reglas |
| `status` | `ready`, `blocked` o `warning` |
| `score` | score calculado por ProfileValidation |
| `blockers` | errores que bloquean generación |
| `errors` | alias compatible de errores históricos |
| `warnings` | findings warning |
| `info` / `information` | findings informativos; alias compatible |
| `recommendations` | warnings + información para presentación |
| `summary` | conteos `blockers`, `errors`, `warnings`, `info`, `total` |
| `rules` | resultados de reglas por sección |
| `generatedAt` | timestamp de validación |
| `report` | informe completo, solo con `includeReport:true` |

ValidationBinding escucha cambios de perfil, fotos, identidad, `direction:updated` y Knowledge Pack; invalida el estado visible y revalida con debounce de cero milisegundos. Emite `validation:completed` con el mismo readiness que Prompt muestra.

## Prompt

- **Fachada canónica:** `PromptBinding.generate(profile, options)`.
- **Entrada:** clon del perfil activo + opciones normalizadas + Knowledge Pack aplicado.
- **Compatibilidad de referencias:** `normalizePipelineProfile()` expone `identity.photos` como `photos` al Builder y adjunta el readiness canónico al snapshot del pipeline.
- **Transformaciones:** `PromptBuilder.build()` → `PromptCompiler.compile()` → como máximo un `PromptOptimizer.optimize()`.
- **Salida:** resultado con `contract`, `compiled`, `optimized`, prompt positivo/negativo, parámetros, comando y `historyEntry`.
- **Historial:** exactamente una llamada a `PromptHistoryService.addOptimized()` o `addCompiled()` cuando `saveHistory !== false`; preview usa `saveHistory:false`.
- **Evento final:** `prompt:generated`; el error usa `prompt:failed`.
- **UI:** `UI.handleGenerate()` llama exclusivamente a PromptBinding. Ya no ejecuta fallback a PromptEngine ni reemite un segundo evento.
- **Wizard:** `validatePromptStep()` usa `PromptBinding.preview()`, por lo que valida la misma ruta sin crear historial.

## Ruta alternativa conservada

`PromptEngine.generate()` continúa público y cargado por compatibilidad, pero deja de ser consumidor de Wizard/UI en este sprint. No se eliminó ni se creó un tercer pipeline. La ruta canónica de aplicación es PromptBinding; PromptEngine queda como API heredada no usada por la acción visible.

## Propiedad de listeners

- UI es el único propietario del click `[data-action="prompt-generate"]`.
- ValidationBinding solo actualiza `disabled`, `aria-disabled` y el título del botón.
- Los `init()` de DirectionBinding, ValidationBinding, PromptBinding y UI son idempotentes.
- DirectionBinding inhibe su recarga durante `replace()` para evitar ciclos al recibir su propio `direction:updated`.
