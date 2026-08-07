# PortraitOS — Sprint 7 RC1 Polish Analysis

## Estado

**ANALYSIS COMPLETE — IMPLEMENTATION NOT STARTED**

## Base auditada

- Rama: `feature/sprint-7-rc1-polish`
- Base: merge RC1 runtime `d9017ad427c15aebbd66f5889b8f543f072366bd`
- `main` ya contiene la integración de History y el RC1 Runtime Gate validado.

## Objetivo del Sprint 7

No ampliar el dominio. Convertir el MVP técnicamente estable en una RC1 presentable, comprensible y demostrable para una persona que no conozca la arquitectura interna.

## Lo que ya está sólido

1. El flujo principal está organizado como wizard de seis pasos: Perfil, Fotografías, Identidad, Dirección creativa, Validación y Generación.
2. Existe progreso visible y navegación lateral.
3. Existen estados vacíos en Profile, Photos, Validation, Export, Review e History.
4. UI dispone de notificaciones, modal root y busy overlay.
5. Generation integra Readiness, History, Export y Review.
6. History ya está integrado en runtime y aislado por perfil.
7. Export/Import y Review están integrados en el paso final.
8. El arranque muestra un error operativo si la inicialización falla.

## Brechas RC1 confirmadas

### P0 — ninguna

No se ha identificado en el análisis estático inicial ningún nuevo bloqueo funcional equivalente al problema de History.

### P1 — experiencia y demostrabilidad

#### UX-01 — El paso 6 concentra demasiadas responsabilidades

`Generación` contiene el contrato, History Studio, Export Studio y Portrait Review. Técnicamente funciona, pero para una persona nueva son cuatro etapas conceptuales diferentes dentro de un único paso del wizard.

Impacto: el usuario puede interpretar que History, Export y Review son herramientas secundarias o no descubrirlas.

Decisión Sprint 7: no crear nuevas rutas ni cambiar la arquitectura. Mejorar la jerarquía interna del paso 6 y la orientación del usuario.

#### UX-02 — No existe Demo Mode

No existe ninguna capacidad `demo` en el repositorio. Actualmente demostrar el producto exige preparar manualmente un perfil completo.

Impacto: alto para presentaciones y validación de RC1.

Decisión: crear un modo demostración explícito y reversible usando únicamente fixtures sintéticos; nunca fotografías reales.

#### UX-03 — La versión visible está hardcodeada

El sidebar muestra `PortraitOS v1.0` directamente en HTML. No existe una fuente de build/release visible en la UI.

Impacto: medio. Dificulta saber qué RC/build se está probando y documentar incidencias.

Decisión: establecer una única fuente de versión para RC1 y renderizarla en UI sin duplicar contratos.

#### UX-04 — Acciones globales y acciones del paso pueden competir

La cabecera mantiene `Exportar` y `Guardar` independientemente del paso, mientras Generation incluye su propio Export Studio. Esto puede generar ambigüedad sobre qué se exporta y cuándo.

Decisión: clarificar copy/estado y evitar acciones redundantes sin eliminar capacidades existentes.

### P2 — pulido

#### UX-05 — El lenguaje de producto mezcla español e inglés

Ejemplos visibles: `Portrait workflow`, `Portrait Readiness`, `History Studio`, `Portrait Review`, `Generation ID`, `Contract ID`, `Contract Hash`, mientras el resto de la UI está en español.

No es un bug, pero reduce cohesión editorial.

Decisión: conservar términos de producto que sean nombres propios y traducir ayudas/acciones cuando no aporten precisión técnica.

#### UX-06 — Review expone metadatos técnicos en primer plano

Generation ID, Contract ID y Contract Hash aparecen como inputs visibles para el usuario final.

Impacto: medio en experiencia. Son útiles para trazabilidad, pero deberían presentarse como información avanzada o autocompletada cuando sea posible.

#### UX-07 — Import Package usa un `label` estilizado como botón con estilo inline

Funciona, pero rompe consistencia del Design System y debe normalizarse durante el polish.

## Recorrido RC1 objetivo

1. Crear/seleccionar perfil.
2. Importar evidencias fotográficas.
3. Completar identidad y evidencias.
4. Bloquear identidad.
5. Completar dirección creativa.
6. Validar readiness.
7. Generar Portrait Contract.
8. Consultar History.
9. Exportar/Importar paquete.
10. Cargar resultado y completar Portrait Review.
11. Recargar y recuperar el estado.

## Plan de implementación

### Incremento A — RC1 orientation layer

- Clarificar jerarquía visual y textual del paso 6.
- Añadir marcadores internos Generación → Historial → Exportación → Review.
- Normalizar microcopy de estados y acciones.
- No crear nuevas pantallas.

### Incremento B — Demo Mode

- Añadir entrada visible `Demo`.
- Generar perfil demostración aislado.
- Usar fotografías Canvas sintéticas.
- Completar automáticamente un escenario compatible con los contratos actuales.
- Marcar inequívocamente los datos como demo.
- Permitir limpiar demo sin afectar perfiles reales.

### Incremento C — Release metadata

- Una única fuente de versión/build.
- Mostrar `1.0.0-rc.1` y build en el producto.
- Documentar schema/storage versions sin hardcodes divergentes.

### Incremento D — UX polish

- Estados busy/disabled coherentes.
- Feedback de acciones.
- Accesibilidad de foco y teclado.
- Eliminar estilos inline introducidos por funcionalidades recientes.
- Revisar responsive sin rediseño integral.

### Incremento E — Sprint 7 runner

El runner debe cargar `app/index.html` real y validar un recorrido RC1, incluido Demo Mode, navegación, generación, History, Export y Review, sin saltarse las fachadas canónicas.

## Fuera de alcance

- Refactor de bindings por tamaño.
- Router nuevo.
- Frameworks o dependencias.
- Backend/cloud.
- IA automática.
- Reconocimiento facial.
- Nuevas funciones de negocio.

## Gate de cierre

Solo `SPRINT COMPLETE` cuando:

- Sprint 7 pase dos veces consecutivas.
- Sprint 0–6 permanezcan verdes.
- Demo Mode sea aislado y reversible.
- el recorrido RC1 sea comprensible y ejecutable.
- no existan errores de consola ni `unhandledrejection`.
- `git diff --check` pase.
