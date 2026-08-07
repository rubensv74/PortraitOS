# PortraitOS — Sprint 7 Demo Experience Contract

## Estado

**CONTRACT FROZEN FOR IMPLEMENTATION**

## Propósito

Demo Mode existe para demostrar PortraitOS sin preparar manualmente un perfil completo y sin utilizar imágenes ni datos personales reales.

No es una segunda arquitectura, un fixture oculto ni una ruta alternativa de negocio. Debe utilizar las fachadas públicas ya existentes y producir un estado equivalente al que generaría un usuario real.

## Principios obligatorios

1. **Aislamiento:** nunca modifica un perfil real existente.
2. **Reversibilidad:** toda la demo puede eliminarse de forma explícita.
3. **Datos sintéticos:** no incluye personas reales ni datos biométricos reales.
4. **Fachadas canónicas:** usa ProfileManager/ProfileService, Photos, Identity, Direction, Validation, Prompt, History, Export y Review mediante sus contratos públicos.
5. **Persistencia normal:** el perfil demo puede sobrevivir a reload exactamente como un perfil normal.
6. **Marcado inequívoco:** nombre, descripción y/o metadata identifican el perfil como demostración.
7. **Idempotencia:** lanzar Demo Mode de nuevo no duplica silenciosamente un escenario existente.
8. **Sin bypass en producción:** no se utilizará `skipReadinessCheck` ni flags equivalentes para simular éxito.

## Escenario Demo RC1

### Perfil

Nombre recomendado: `Demo RC1 — Retrato editorial`

Debe incluir descripción y tags que indiquen que los datos son sintéticos.

### Fotografías

Generar al menos cinco imágenes sintéticas mediante Canvas/browser APIs.

Objetivo de los fixtures:

- permitir probar Photos;
- ofrecer diferentes ángulos/roles conceptuales;
- no intentar representar a una persona real;
- producir archivos válidos para el pipeline actual.

### Identity

Completar únicamente los campos necesarios para demostrar el contrato vigente.

Las evidencias deben vincularse a las fotografías sintéticas mediante IDs/checksums reales creados por Photos.

### Lock

La identidad debe alcanzar los requisitos formales de cobertura y principal establecidos por el dominio antes de bloquearse.

No relajar reglas.

### Creative Direction

Completar un escenario editorial profesional utilizando valores válidos de la UI actual.

### Validation

Ejecutar la misma validación canónica del producto.

El perfil demo debe alcanzar readiness suficiente por méritos propios.

### Generation

Generar exactamente un Portrait Contract mediante `PromptBinding`.

Debe producir:

- `generationId`;
- resultado visible;
- una entrada de History;
- trazabilidad con el perfil demo.

### Export

Preparar un PortraitOS package válido sin forzar una descarga automática durante la construcción de la demo.

### Review

Demo Mode puede preparar la sección Review y sus metadatos de generación/contrato. No debe inventar una imagen generada por un proveedor externo como si fuera un resultado real.

Si Sprint 7 necesita demostrar Review end-to-end, debe utilizar una imagen sintética claramente marcada como fixture de revisión.

## UX del modo demo

Entrada recomendada: acción secundaria `Demo` visible pero no dominante.

Antes de crear datos debe informar:

- que se crearán datos sintéticos;
- que no se modificarán perfiles reales;
- que el perfil demo podrá eliminarse.

Durante ejecución:

- mostrar progreso/estado;
- bloquear dobles ejecuciones;
- no congelar la UI;
- informar del paso actual.

Al terminar:

- seleccionar el perfil demo;
- llevar al usuario a una vista útil del recorrido;
- mostrar confirmación de que el escenario está preparado.

## Limpieza

Debe existir una acción explícita para eliminar el perfil Demo actual.

La limpieza debe respetar las mismas reglas de eliminación y lifecycle de binarios del producto.

No borrar bases de datos completas, localStorage global ni otros perfiles.

## Errores

Si cualquier fase falla:

- detener el flujo;
- mostrar el paso fallido;
- no presentar el demo como completado;
- intentar rollback/limpieza solo mediante APIs existentes;
- mantener los perfiles reales intactos.

## Tests obligatorios

Sprint 7 debe demostrar:

1. Crear demo desde estado con perfil real existente no altera el perfil real.
2. Cinco fotografías sintéticas válidas.
3. Principal válida.
4. Evidencias válidas.
5. Identity lock válido.
6. Direction ready.
7. Validation ready.
8. Una generación y una única entrada History.
9. Package exportable.
10. Review fixture opcional claramente sintético.
11. Reload conserva demo.
12. Eliminar demo no afecta perfiles reales.
13. Segunda ejecución no crea duplicados inesperados.
14. Cero errores runtime.

## Fuera de alcance

- llamada a proveedores externos;
- generar una imagen real mediante IA;
- descargar assets desde Internet;
- simular identidad de una persona;
- añadir reglas de dominio especiales para Demo Mode.
