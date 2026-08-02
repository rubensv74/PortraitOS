# Sprint 0 — Informe de validación

Fecha: 2026-08-02  
Estado: **SPRINT COMPLETE**

## Entorno y estado inicial

- Rama inicial: `main`.
- Commit inicial: `50b91e0dea4403b4b4d9311c3511ec8bab52a86d`.
- Working tree inicial: limpio.
- Relación conocida con `origin/main`: 0 ahead / 0 behind antes de crear la rama.
- Rama de trabajo: `fix/sprint-0-portrait-contract-flow`.

## Pruebas ejecutadas

### E2E headless reproducible

Comando:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\run-sprint-0.ps1
```

Resultado: **20/20 PASS**, Chrome exit 0, `TEST_STATUS=passed`.

Evidencias cubiertas:

1. La aplicación alcanza `data-portraitos-ready="true"`.
2. DirectionBinding y ValidationBinding están disponibles.
3. DirectionBinding registra 22 campos.
4. Perfil inválido: bloqueado; no genera; historial no cambia.
5. Validation y Prompt muestran el mismo score inválido.
6. Dos cambios reales (`lighting.type`, `camera.lens`) llegan al perfil activo.
7. Perfil válido: readiness sin blockers.
8. Validation y Prompt muestran el mismo score válido.
9. Tras navegar repetidamente, un click produce un resultado visible.
10. Se emite un solo `prompt:generated`.
11. El historial aumenta exactamente en una entrada.
12. El resultado anterior se limpia al cambiar de perfil.
13. Perfil A y B mantienen direcciones diferentes.
14. No se capturan errores ni rejections durante el escenario.
15. Tras recargar se conserva perfil activo, `lighting.type="rembrandt"` y `camera.lens="105 mm"`.
16. Los bindings siguen inicializados.

### Sintaxis

Los JavaScript modificados se comprobaron con el runtime Electron/JavaScript disponible mediante `Code.exe --check`: 7/7 sin diagnósticos durante la implementación. La validación final amplía el control a todos los `.js` del repositorio y queda registrada al cierre.

### Análisis estático y Git

- `git diff --check` requerido al cierre.
- Lista de scripts verificada contra `index.html`.
- Historial medido mediante el contrato real `PromptHistoryService.getSnapshot().entryCount`.
- No se añadieron dependencias ni `package.json`.

## Criterios de aceptación

| Criterio | Resultado | Evidencia |
|---|---|---|
| Arranque sin excepciones | PASS | smoke `data-portraitos-ready`; sin `error`/`unhandledrejection` en escenario |
| DirectionBinding cargado una vez | PASS | global disponible; `init()` idempotente; estado inicializado |
| 22 campos cargan/guardan | PASS | `fieldCount=22`; cambios de lighting/lens observados en ProfileService |
| Aislamiento por perfil | PASS | Perfil A `rembrandt/105 mm`, B `cinematic/50 mm`; retorno a A correcto |
| Persistencia tras recarga | PASS | tres aserciones de reload |
| ValidationBinding cargado | PASS | global/estado inicializado y dashboard actualizado |
| Readiness único | PASS | ValidationBinding y Prompt comparan el mismo score de ProfileValidation |
| Inválido no genera | PASS | `PROFILE_NOT_READY`; historial sin cambios |
| Válido genera un resultado | PASS | un `[data-prompt-preview]` |
| Una entrada de historial | PASS | `entryCount 0→1` |
| Un evento final | PASS | contador `prompt:generated=1` |
| Sin listeners duplicados | PASS | init repetido + navegación repetida; evento e historial permanecen unitarios |
| Smoke reproducible | PASS | `tests/run-sprint-0.ps1` |
| E2E válido e inválido | PASS | runner 20/20 |
| Arquitectura compatible | PASS | globals/IIFE conservados; adaptadores localizados |
| Sin alcance adicional | PASS | no se integró History UI, Router, import/export ni funcionalidades nuevas |

## Limitaciones

- El escenario usa un fixture de fotografía Data URL mínimo para validar el contrato; no reaudita importación real, Canvas ni límites de cuota, que pertenecen a Sprint 1.
- Chrome se ejecuta sobre archivos locales con `--allow-file-access-from-files`; no se añadió servidor ni dependencia porque no eran imprescindibles.
- `PromptEngine` se conserva como API pública heredada; no es invocado por Wizard/UI.
- La implementación histórica de validación por secciones permanece como adaptador compatible interno, pero la ruta pública `validate()` usa exclusivamente ProfileValidation.

## Estado final del sprint

**SPRINT COMPLETE.** Los criterios obligatorios del Sprint 0 están demostrados por el runner reproducible y las comprobaciones finales. No se realizó commit ni push.
