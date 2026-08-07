# PortraitOS — RC1 Runtime Validation Report

## Estado

**RC1_RUNTIME_READY — FULL REGRESSION PENDING**

## Rama

`fix/rc1-history-runtime`

## Evidencia ejecutada en Windows

### Sprint 2

- Resultado: **45/45 PASS**
- Chrome exit: `0`
- Estado: determinista en la ejecución posterior al cambio de rama.

### Sprint 6

- Resultado: **66/66 PASS**
- Estado: verde sobre la rama RC1 runtime.

### RC1 Runtime Gate

El gate se ejecutó dos veces consecutivas sobre la aplicación real.

#### Ejecución 1

- `STEP=complete`
- `TEST_STATUS=passed`
- `RC1_RUNTIME_READY`

#### Ejecución 2

- `STEP=complete`
- `TEST_STATUS=passed`
- `RC1_RUNTIME_READY`

## Qué queda demostrado

1. La aplicación real alcanza `data-portraitos-ready=true`.
2. `HistoryBinding` existe en runtime.
3. `HistoryBinding` queda inicializado.
4. El marcador `data-history-runtime-ready=true` está presente.
5. El workspace History y sus selectores están disponibles.
6. El historial se filtra por perfil activo.
7. Cambio A → B → A funciona mediante `ProfileManager`.
8. Búsqueda, filtros, restauración, comparación y eliminación son ejercitados por el gate.
9. El gate termina sin bloqueo en dos ejecuciones consecutivas.

## Correcciones realizadas durante la validación

- El lanzador RC1 fue ajustado para reportar el `step` real del runner.
- El runner fue corregido para cambiar perfiles a través de `ProfileManager`, que es la API canónica para selección por ID.

## Validación todavía pendiente antes de merge

La evidencia actual NO incluye una nueva ejecución completa de todas las suites sobre la rama final.

Pendiente ejecutar en esta misma rama:

- Sprint 0
- Sprint 1
- Sprint 3
- Sprint 4
- Sprint 5
- `git diff --check`
- comprobación sintáctica de todos los JavaScript

Sprint 2 y Sprint 6 ya están confirmados en verde sobre la rama actual.

## Criterio de merge

La PR puede pasar a `MERGE_READY` únicamente cuando la regresión completa Sprint 0–6 y las validaciones estáticas estén verdes en el HEAD final.
