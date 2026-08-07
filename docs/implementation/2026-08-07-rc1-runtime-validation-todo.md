# RC1 Runtime Validation Todo

Estado: **PENDING LOCAL EXECUTION**

Ejecutar en Windows:

1. Sprint 0–6 completos.
2. `tests/run-rc1-runtime.ps1` dos veces consecutivas.
3. `git diff --check`.
4. Sintaxis de todos los JavaScript.
5. Revisar consola: cero excepciones y cero `unhandledrejection`.
6. Confirmar un único `[data-history]` tras reinicializar.
7. Confirmar aislamiento de History entre perfiles.

No declarar `RC1_RUNTIME_READY` antes de disponer de esta evidencia.