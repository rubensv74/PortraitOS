# PortraitOS Design System — UI-0

Fecha: 2026-08-02  
Estado: base visual oficial  
Implementación canónica: `app/css/design-system.css`

## Principios

PortraitOS debe sentirse como una herramienta editorial de precisión: serena, legible y centrada en la identidad. La interfaz prioriza el contenido del contrato sobre la decoración.

1. **Jerarquía explícita.** El flujo global vive en el rail oscuro; la tarea activa y sus decisiones viven en el lienzo claro.
2. **Densidad controlada.** La información relacionada se agrupa en tarjetas; el espacio distingue niveles, no rellena vacíos.
3. **Color con significado.** El violeta identifica acción y foco. Verde, ámbar y rojo quedan reservados para estados semánticos.
4. **Profundidad mínima.** Bordes suaves y una única sombra elevada distinguen superficies sin convertir la aplicación en un dashboard.
5. **Movimiento discreto.** Solo se animan cambios de estado breves; `prefers-reduced-motion` elimina movimiento no esencial.
6. **Sistema local.** La tipografía usa fuentes del sistema y no depende de red, frameworks ni librerías visuales.

## Tokens

Los tokens usan el prefijo `--po-`. Las variables históricas (`--color-primary`, `--bg-surface`, etc.) se mantienen como alias de compatibilidad para no alterar módulos funcionales existentes.

### Color

| Rol | Token | Valor |
| --- | --- | --- |
| Texto principal | `--po-ink-950` | `#17151f` |
| Texto secundario | `--po-ink-600` | `#625e6f` |
| Lienzo | `--po-canvas` | `#f5f3f1` |
| Superficie | `--po-surface` | `#fffefd` |
| Borde | `--po-line` | `#e6e1de` |
| Acción/foco | `--po-accent` | `#6d4aff` |
| Éxito | `--po-success` | `#257a63` |
| Aviso | `--po-warning` | `#9a641c` |
| Error | `--po-danger` | `#b14343` |
| Navegación | `--po-sidebar` | `#1b1922` |

### Tipografía

- Familia de interfaz: `--po-font`, basada en Segoe UI Variable/Segoe UI y fallbacks nativos.
- Familia técnica: `--po-mono`, para índices, métricas y contenido estructurado.
- Escala: `--po-text-xs`, `sm`, `md`, `lg`, `xl` y `display`.
- Los títulos usan tracking negativo moderado; etiquetas operativas y eyebrows usan tracking positivo.

### Espacio, radios y elevación

- Escala espacial: `--po-space-1` a `--po-space-10`, basada en múltiplos de 4 px.
- Radios: `--po-radius-sm` (controles), `md` (grupos) y `lg` (superficies).
- Elevación: `--po-shadow-raised` es la única sombra principal. No se eleva una tarjeta adicionalmente al hacer hover.

## Componentes

### App shell y navegación

`.app-shell` establece el rail fijo de 17 rem y el lienzo flexible. `.wizard-navigation__item` presenta índice, nombre, descripción y estado. Los estados aceptados por la capa visual son `active`, `is-active`, `[aria-current="step"]`, `completed` e `is-complete`, preservando las convenciones existentes.

### Encabezado y progreso

`.app-header` concentra contexto y acciones globales. `.wizard-progress-card` muestra progreso sin competir con el contenido; la anchura funcional de `.wizard-progress__bar` sigue perteneciendo al wizard.

### Botones

- `.button--primary`: siguiente paso o guardado principal.
- `.button--secondary`: acción segura de apoyo.
- `.button--tertiary`: acción de baja prioridad o contextual.

Todos comparten altura, radio, peso y tratamiento de foco. La capa visual no decide habilitación, visibilidad ni resultado de una acción.

### Tarjetas y formularios

`.card` es la superficie base; `card__header`, `card__body` y `card__footer` definen sus regiones. `.form-grid` usa dos columnas y colapsa a una; `form-field--full` y `form-field--wide` abarcan el ancho. Los estilos de foco son perceptibles sin modificar validación o eventos.

### Estados

Badges y estados parten de una apariencia neutral. Los colores semánticos solo deben aplicarse cuando el módulo funcional exponga un estado inequívoco. Los estados vacíos, dropzones, overlays y spinners comparten tokens y respetan reducción de movimiento.

## Responsive

- Más de 1120 px: rail completo y contenido en dos columnas cuando corresponde.
- Entre 832 y 1120 px: rail compacto y contenido principal en una columna.
- Menos de 832 px: navegación superior en rejilla y lienzo de una columna.
- Menos de 608 px: formularios, cabecera y acciones se apilan.

PortraitOS sigue siendo un producto desktop-first; estos breakpoints protegen accesibilidad y revisión local en ventanas estrechas, no redefinen el flujo.

## Límites funcionales

UI-0 no cambia IDs, atributos `data-*`, orden del wizard, persistencia, readiness, contratos, eventos ni lógica JavaScript. `design-system.css` se carga al final para alinear el marcado real con el sistema sin reescribir reglas históricas de módulos. La consolidación o eliminación futura de CSS legado requiere una auditoría separada y aprobación explícita.
