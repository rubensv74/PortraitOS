"use strict";

/* ============================================================
   PortraitOS
   Direction Binding
   ------------------------------------------------------------
   Responsabilidad:
   - Sincronizar el formulario de dirección creativa.
   - Gestionar campos anidados mediante data-direction-field.
   - Aplicar presets sin modificar la identidad.
   - Ejecutar validaciones de campo y validaciones globales.
   - Detectar conflictos mediante CreativeEngine.
   - Calcular el grado de completitud.
   - Gestionar autoguardado.
   - Mantener sincronizados formulario, perfil, wizard y UI.
   ============================================================ */

const DirectionBinding = (() => {

    /* ========================================================
       CONFIGURACIÓN
       ======================================================== */

    const SELECTORS = Object.freeze({
        FIELD:
            "[data-direction-field]",

        PANEL:
            "[data-step-panel='direction']",

        STATUS:
            "[data-direction-status]",

        COMPLETENESS:
            "[data-direction-completeness]",

        PRESET_SELECT:
            "[data-direction-preset]",

        PRESET_ACTION:
            "[data-action='direction-apply-preset']",

        CLEAR_PRESET_ACTION:
            "[data-action='direction-clear-preset']",

        VALIDATE_ACTION:
            "[data-action='direction-validate']",

        RESET_ACTION:
            "[data-action='direction-reset']",

        CATEGORY_STATUS:
            "[data-direction-category]",

        VALIDATION_RESULTS:
            "[data-direction-validation-results]"
    });

    const CLASSES = Object.freeze({
        INVALID:
            "is-invalid",

        VALID:
            "is-valid",

        DIRTY:
            "is-dirty",

        SAVING:
            "is-saving",

        SAVED:
            "is-saved",

        COMPLETE:
            "is-complete",

        WARNING:
            "is-warning",

        ERROR:
            "is-error",

        ACTIVE:
            "is-active"
    });

    const AUTOSAVE_DELAY = 700;

    const REQUIRED_PATHS = Object.freeze([
        "lighting.type",
        "camera.shotType",
        "camera.angle",
        "composition.format",
        "background.type",
        "wardrobe.style",
        "pose.position",
        "pose.expression",
        "treatment.mood",
        "treatment.realism"
    ]);

    const RECOMMENDED_PATHS = Object.freeze([
        "lighting.contrast",
        "lighting.notes",
        "camera.lens",
        "camera.depthOfField",
        "composition.framing",
        "composition.notes",
        "background.depth",
        "background.description",
        "wardrobe.colors",
        "wardrobe.description",
        "pose.notes",
        "treatment.notes"
    ]);

    const CATEGORY_PATHS = Object.freeze({
        lighting: [
            "lighting.type",
            "lighting.contrast",
            "lighting.notes"
        ],

        camera: [
            "camera.shotType",
            "camera.angle",
            "camera.lens",
            "camera.depthOfField"
        ],

        composition: [
            "composition.format",
            "composition.framing",
            "composition.notes"
        ],

        background: [
            "background.type",
            "background.depth",
            "background.description"
        ],

        wardrobe: [
            "wardrobe.style",
            "wardrobe.colors",
            "wardrobe.description"
        ],

        pose: [
            "pose.position",
            "pose.expression",
            "pose.notes"
        ],

        treatment: [
            "treatment.mood",
            "treatment.realism",
            "treatment.notes"
        ]
    });

    const PRESETS = Object.freeze({
        corporate: {
            id:
                "corporate",

            name:
                "Corporate Portrait",

            description:
                "Retrato corporativo profesional, sobrio y cercano.",

            direction: {
                lighting: {
                    type:
                        "soft",
                    contrast:
                        "medium",
                    notes:
                        "Iluminación suave y controlada, con modelado facial natural y sombras discretas."
                },

                camera: {
                    shotType:
                        "head-and-shoulders",
                    angle:
                        "eye-level",
                    lens:
                        "85 mm",
                    depthOfField:
                        "Reducida, con ambos ojos perfectamente enfocados."
                },

                composition: {
                    format:
                        "portrait-4-5",
                    framing:
                        "Encuadre centrado, con espacio limpio alrededor del rostro.",
                    notes:
                        "Composición ordenada, equilibrada y adecuada para comunicación corporativa."
                },

                background: {
                    type:
                        "office",
                    depth:
                        "Fondo suavemente desenfocado.",
                    description:
                        "Oficina contemporánea, luminosa y sin elementos visualmente distractores."
                },

                wardrobe: {
                    style:
                        "Ejecutivo contemporáneo",
                    colors:
                        "Azul marino, gris, blanco y tonos neutros",
                    description:
                        "Vestuario profesional bien ajustado, elegante y sin patrones dominantes."
                },

                pose: {
                    position:
                        "Ligero giro de hombros con el rostro orientado hacia cámara.",
                    expression:
                        "Segura, serena y accesible.",
                    notes:
                        "Postura erguida pero natural. Evitar rigidez excesiva."
                },

                treatment: {
                    mood:
                        "professional",
                    realism:
                        "photorealistic",
                    notes:
                        "Retoque discreto. Mantener piel, edad, textura y rasgos reales."
                }
            }
        },

        executive: {
            id:
                "executive",

            name:
                "Executive",

            description:
                "Retrato ejecutivo con presencia, autoridad y credibilidad.",

            direction: {
                lighting: {
                    type:
                        "rembrandt",
                    contrast:
                        "medium",
                    notes:
                        "Luz lateral refinada con sombras controladas y volumen facial."
                },

                camera: {
                    shotType:
                        "medium-close-up",
                    angle:
                        "eye-level",
                    lens:
                        "85 mm",
                    depthOfField:
                        "Moderadamente reducida."
                },

                composition: {
                    format:
                        "portrait-4-5",
                    framing:
                        "Sujeto ligeramente desplazado del centro.",
                    notes:
                        "Composición ejecutiva con presencia y espacio negativo equilibrado."
                },

                background: {
                    type:
                        "architectural",
                    depth:
                        "Profundidad media.",
                    description:
                        "Arquitectura corporativa premium, líneas limpias y materiales sobrios."
                },

                wardrobe: {
                    style:
                        "Alta dirección",
                    colors:
                        "Azul oscuro, gris carbón, blanco",
                    description:
                        "Prendas estructuradas, materiales de calidad y accesorios discretos."
                },

                pose: {
                    position:
                        "Postura firme con hombros relajados.",
                    expression:
                        "Determinada, segura y contenida.",
                    notes:
                        "Transmitir liderazgo sin dureza ni teatralidad."
                },

                treatment: {
                    mood:
                        "confident",
                    realism:
                        "editorial-realism",
                    notes:
                        "Acabado editorial sobrio y realista, sin rejuvenecimiento."
                }
            }
        },

        linkedin: {
            id:
                "linkedin",

            name:
                "LinkedIn",

            description:
                "Retrato claro, profesional y reconocible para perfil profesional.",

            direction: {
                lighting: {
                    type:
                        "soft",
                    contrast:
                        "low",
                    notes:
                        "Luz frontal lateral suave, uniforme y favorecedora sin borrar textura."
                },

                camera: {
                    shotType:
                        "headshot",
                    angle:
                        "eye-level",
                    lens:
                        "85 mm",
                    depthOfField:
                        "Fondo desenfocado, rostro completamente nítido."
                },

                composition: {
                    format:
                        "square-1-1",
                    framing:
                        "Rostro centrado con margen adecuado para recorte circular.",
                    notes:
                        "Evitar encuadres demasiado cerrados en laterales y parte superior."
                },

                background: {
                    type:
                        "plain",
                    depth:
                        "Plano o ligeramente separado.",
                    description:
                        "Fondo neutro claro, limpio y sin distracciones."
                },

                wardrobe: {
                    style:
                        "Profesional accesible",
                    colors:
                        "Tonos sólidos y neutros",
                    description:
                        "Vestuario coherente con el sector profesional y la posición objetivo."
                },

                pose: {
                    position:
                        "Frontal o ligero tres cuartos.",
                    expression:
                        "Cercana, competente y natural.",
                    notes:
                        "Contacto visual directo con cámara."
                },

                treatment: {
                    mood:
                        "approachable",
                    realism:
                        "photorealistic",
                    notes:
                        "Acabado natural y limpio. Conservar marcas personales y edad real."
                }
            }
        },

        editorial: {
            id:
                "editorial",

            name:
                "Editorial",

            description:
                "Retrato editorial sofisticado con composición y luz expresivas.",

            direction: {
                lighting: {
                    type:
                        "editorial",
                    contrast:
                        "high",
                    notes:
                        "Iluminación direccional con intención narrativa y sombras controladas."
                },

                camera: {
                    shotType:
                        "medium-shot",
                    angle:
                        "three-quarter",
                    lens:
                        "70–105 mm",
                    depthOfField:
                        "Profundidad selectiva con transición suave."
                },

                composition: {
                    format:
                        "portrait-2-3",
                    framing:
                        "Composición asimétrica intencionada.",
                    notes:
                        "Uso editorial del espacio negativo y líneas del entorno."
                },

                background: {
                    type:
                        "editorial",
                    depth:
                        "Profundidad visual marcada.",
                    description:
                        "Escenario contemporáneo con textura, capas y coherencia cromática."
                },

                wardrobe: {
                    style:
                        "Editorial contemporáneo",
                    colors:
                        "Paleta coordinada con el escenario",
                    description:
                        "Prendas con estructura visual, textura y carácter."
                },

                pose: {
                    position:
                        "Pose natural dirigida, con gesto corporal expresivo.",
                    expression:
                        "Serena, introspectiva o segura.",
                    notes:
                        "Evitar poses genéricas de banco de imágenes."
                },

                treatment: {
                    mood:
                        "editorial",
                    realism:
                        "editorial-realism",
                    notes:
                        "Color grading editorial, textura orgánica y retoque contenido."
                }
            }
        },

        cinematic: {
            id:
                "cinematic",

            name:
                "Cinematic",

            description:
                "Retrato cinematográfico narrativo, realista y atmosférico.",

            direction: {
                lighting: {
                    type:
                        "cinematic",
                    contrast:
                        "high",
                    notes:
                        "Iluminación motivada, lateral o contraluz, con separación clara del fondo."
                },

                camera: {
                    shotType:
                        "medium-close-up",
                    angle:
                        "three-quarter",
                    lens:
                        "85 mm",
                    depthOfField:
                        "Reducida con bokeh natural y profundidad cinematográfica."
                },

                composition: {
                    format:
                        "landscape-16-9",
                    framing:
                        "Sujeto situado en uno de los tercios.",
                    notes:
                        "Composición narrativa con espacio visual en la dirección de la mirada."
                },

                background: {
                    type:
                        "urban",
                    depth:
                        "Profundidad amplia con capas.",
                    description:
                        "Entorno realista con luces prácticas y atmósfera discreta."
                },

                wardrobe: {
                    style:
                        "Contemporáneo narrativo",
                    colors:
                        "Tonos oscuros, terrosos o desaturados",
                    description:
                        "Prendas realistas con textura y sin estilización artificial."
                },

                pose: {
                    position:
                        "Postura relajada con leve giro corporal.",
                    expression:
                        "Reflexiva y contenida.",
                    notes:
                        "La pose debe sugerir una historia sin resultar teatral."
                },

                treatment: {
                    mood:
                        "cinematic",
                    realism:
                        "cinematic-realism",
                    notes:
                        "Color cinematográfico, contraste orgánico y grano fino."
                }
            }
        },

        speaker: {
            id:
                "speaker",

            name:
                "Conference Speaker",

            description:
                "Retrato profesional para ponencias, conferencias y eventos.",

            direction: {
                lighting: {
                    type:
                        "studio",
                    contrast:
                        "medium",
                    notes:
                        "Luz limpia y definida que mantenga una presencia profesional."
                },

                camera: {
                    shotType:
                        "medium-shot",
                    angle:
                        "eye-level",
                    lens:
                        "70–85 mm",
                    depthOfField:
                        "Moderada, con separación clara del entorno."
                },

                composition: {
                    format:
                        "landscape-3-2",
                    framing:
                        "Sujeto en un tercio, dejando espacio para texto.",
                    notes:
                        "Composición apta para cartelería, agenda y materiales del evento."
                },

                background: {
                    type:
                        "architectural",
                    depth:
                        "Profundidad media.",
                    description:
                        "Espacio profesional contemporáneo o escenario sobrio."
                },

                wardrobe: {
                    style:
                        "Profesional con personalidad",
                    colors:
                        "Colores sólidos compatibles con la identidad profesional",
                    description:
                        "Vestuario reconocible y apropiado para una intervención pública."
                },

                pose: {
                    position:
                        "Postura abierta, segura y ligeramente dinámica.",
                    expression:
                        "Enérgica, cercana y competente.",
                    notes:
                        "Transmitir capacidad de comunicación y liderazgo."
                },

                treatment: {
                    mood:
                        "confident",
                    realism:
                        "editorial-realism",
                    notes:
                        "Acabado profesional con contraste moderado y detalle natural."
                }
            }
        },

        podcast: {
            id:
                "podcast",

            name:
                "Podcast",

            description:
                "Retrato íntimo y reconocible para portada o comunicación de podcast.",

            direction: {
                lighting: {
                    type:
                        "cinematic",
                    contrast:
                        "medium",
                    notes:
                        "Iluminación lateral cálida con ambiente de estudio."
                },

                camera: {
                    shotType:
                        "head-and-shoulders",
                    angle:
                        "three-quarter",
                    lens:
                        "85 mm",
                    depthOfField:
                        "Reducida con fondo de estudio desenfocado."
                },

                composition: {
                    format:
                        "square-1-1",
                    framing:
                        "Sujeto centrado o ligeramente lateral.",
                    notes:
                        "Reservar espacio suficiente para título y elementos gráficos."
                },

                background: {
                    type:
                        "studio",
                    depth:
                        "Fondo con capas suaves.",
                    description:
                        "Estudio de grabación, micrófono discreto y ambiente profesional."
                },

                wardrobe: {
                    style:
                        "Smart casual",
                    colors:
                        "Paleta coherente con la identidad visual del podcast",
                    description:
                        "Vestuario natural, reconocible y con personalidad."
                },

                pose: {
                    position:
                        "Pose relajada frente al micrófono o ligeramente girada.",
                    expression:
                        "Conversacional, cercana y segura.",
                    notes:
                        "Evitar una expresión publicitaria o excesivamente posada."
                },

                treatment: {
                    mood:
                        "approachable",
                    realism:
                        "cinematic-realism",
                    notes:
                        "Acabado cálido, íntimo y realista."
                }
            }
        },

        author: {
            id:
                "author",

            name:
                "Book Author",

            description:
                "Retrato de autor con profundidad, personalidad y sobriedad.",

            direction: {
                lighting: {
                    type:
                        "natural",
                    contrast:
                        "medium",
                    notes:
                        "Luz natural lateral, suave y con textura."
                },

                camera: {
                    shotType:
                        "medium-close-up",
                    angle:
                        "three-quarter",
                    lens:
                        "85 mm",
                    depthOfField:
                        "Reducida y orgánica."
                },

                composition: {
                    format:
                        "portrait-2-3",
                    framing:
                        "Composición sobria, con espacio negativo controlado.",
                    notes:
                        "Encuadre apropiado para solapas, prensa y comunicación editorial."
                },

                background: {
                    type:
                        "home",
                    depth:
                        "Profundidad media.",
                    description:
                        "Biblioteca, despacho o entorno de trabajo realista y no escenográfico."
                },

                wardrobe: {
                    style:
                        "Elegante informal",
                    colors:
                        "Tonos naturales y sobrios",
                    description:
                        "Vestuario con textura, carácter y discreción."
                },

                pose: {
                    position:
                        "Pose relajada y reflexiva.",
                    expression:
                        "Serena, inteligente y cercana.",
                    notes:
                        "Evitar gestos grandilocuentes."
                },

                treatment: {
                    mood:
                        "authentic",
                    realism:
                        "editorial-realism",
                    notes:
                        "Tratamiento editorial natural con textura y profundidad."
                }
            }
        },

        lifestyle: {
            id:
                "lifestyle",

            name:
                "Natural Lifestyle",

            description:
                "Retrato espontáneo y natural en un entorno cotidiano.",

            direction: {
                lighting: {
                    type:
                        "natural",
                    contrast:
                        "low",
                    notes:
                        "Luz natural suave, preferentemente de ventana o exterior sombreado."
                },

                camera: {
                    shotType:
                        "medium-shot",
                    angle:
                        "eye-level",
                    lens:
                        "50–85 mm",
                    depthOfField:
                        "Natural, con entorno reconocible pero no dominante."
                },

                composition: {
                    format:
                        "portrait-4-5",
                    framing:
                        "Composición relajada y aparentemente espontánea.",
                    notes:
                        "Evitar simetrías rígidas o aspecto de fotografía de estudio."
                },

                background: {
                    type:
                        "home",
                    depth:
                        "Profundidad natural.",
                    description:
                        "Entorno cotidiano auténtico, limpio y coherente con la persona."
                },

                wardrobe: {
                    style:
                        "Casual cuidado",
                    colors:
                        "Tonos naturales y armoniosos",
                    description:
                        "Prendas cómodas y reales, sin apariencia de estilismo artificial."
                },

                pose: {
                    position:
                        "Postura relajada, sentado o en movimiento suave.",
                    expression:
                        "Natural, tranquila y cercana.",
                    notes:
                        "Evitar mirada o sonrisa forzada."
                },

                treatment: {
                    mood:
                        "natural",
                    realism:
                        "photorealistic",
                    notes:
                        "Color natural, contraste suave y mínima intervención estética."
                }
            }
        },

        blackStudio: {
            id:
                "blackStudio",

            name:
                "Black Background Studio",

            description:
                "Retrato de estudio con fondo negro y modelado escultórico.",

            direction: {
                lighting: {
                    type:
                        "rembrandt",
                    contrast:
                        "high",
                    notes:
                        "Luz lateral controlada con separación sutil de cabello y hombros."
                },

                camera: {
                    shotType:
                        "head-and-shoulders",
                    angle:
                        "three-quarter",
                    lens:
                        "85–105 mm",
                    depthOfField:
                        "Reducida, con máxima nitidez facial."
                },

                composition: {
                    format:
                        "portrait-4-5",
                    framing:
                        "Encuadre limpio, centrado y de fuerte presencia.",
                    notes:
                        "Mantener separación suficiente entre el contorno y el fondo negro."
                },

                background: {
                    type:
                        "studio",
                    depth:
                        "Fondo completamente limpio.",
                    description:
                        "Fondo negro mate uniforme, sin textura ni degradado artificial."
                },

                wardrobe: {
                    style:
                        "Minimalista elegante",
                    colors:
                        "Negro, gris oscuro o tonos profundos",
                    description:
                        "Prendas con textura suficiente para diferenciarse del fondo."
                },

                pose: {
                    position:
                        "Postura firme y ligeramente girada.",
                    expression:
                        "Serena, intensa y contenida.",
                    notes:
                        "No exagerar el dramatismo."
                },

                treatment: {
                    mood:
                        "elegant",
                    realism:
                        "editorial-realism",
                    notes:
                        "Negros profundos, detalle de piel conservado y retoque mínimo."
                }
            }
        }
    });

    let initialized = false;
    let root = document;

    let fields = [];
    let panel = null;
    let statusElement = null;
    let completenessElement = null;
    let presetSelect = null;
    let validationResultsElement = null;

    let subscriptions = [];
    let autosaveTimer = null;

    let dirty = false;
    let syncing = false;
    let activePresetId = null;

    /* ========================================================
       INICIALIZACIÓN
       ======================================================== */

    function init(options = {}) {
        if (initialized) {
            return getState();
        }

        validateDependencies();

        root =
            options.root ||
            document;

        cacheElements();
        populatePresetSelect();
        bindDomEvents();
        bindApplicationEvents();

        load();

        initialized = true;

        emit(
            "binding:direction-ready",
            {
                fieldCount:
                    fields.length,

                presetCount:
                    Object.keys(
                        PRESETS
                    ).length,

                completeness:
                    calculateCompleteness()
            }
        );

        return getState();
    }

    function destroy() {
        fields.forEach(
            field => {
                field.removeEventListener(
                    "input",
                    handleFieldInput
                );

                field.removeEventListener(
                    "change",
                    handleFieldChange
                );

                field.removeEventListener(
                    "blur",
                    handleFieldBlur
                );
            }
        );

        presetSelect
            ?.removeEventListener(
                "change",
                handlePresetSelection
            );

        root
            .querySelector(
                SELECTORS.PRESET_ACTION
            )
            ?.removeEventListener(
                "click",
                handleApplyPreset
            );

        root
            .querySelector(
                SELECTORS.CLEAR_PRESET_ACTION
            )
            ?.removeEventListener(
                "click",
                handleClearPreset
            );

        root
            .querySelector(
                SELECTORS.VALIDATE_ACTION
            )
            ?.removeEventListener(
                "click",
                handleValidate
            );

        root
            .querySelector(
                SELECTORS.RESET_ACTION
            )
            ?.removeEventListener(
                "click",
                handleReset
            );

        subscriptions.forEach(
            unsubscribe => {
                if (
                    typeof unsubscribe ===
                    "function"
                ) {
                    unsubscribe();
                }
            }
        );

        subscriptions = [];

        clearAutosave();

        fields = [];
        panel = null;
        statusElement = null;
        completenessElement = null;
        presetSelect = null;
        validationResultsElement = null;

        initialized = false;
        dirty = false;
        syncing = false;
        activePresetId = null;

        return true;
    }

    function cacheElements() {
        fields = [
            ...root.querySelectorAll(
                SELECTORS.FIELD
            )
        ];

        panel =
            root.querySelector(
                SELECTORS.PANEL
            );

        statusElement =
            root.querySelector(
                SELECTORS.STATUS
            );

        completenessElement =
            root.querySelector(
                SELECTORS.COMPLETENESS
            );

        presetSelect =
            root.querySelector(
                SELECTORS.PRESET_SELECT
            );

        validationResultsElement =
            root.querySelector(
                SELECTORS.VALIDATION_RESULTS
            );
    }

    /* ========================================================
       CARGA Y SINCRONIZACIÓN
       ======================================================== */

    function load(profile = null) {
        const source =
            profile ||
            getActiveProfile();

        const direction =
            normalizeDirection(
                source?.direction
            );

        syncing = true;

        fields.forEach(
            field => {
                const path =
                    normalizeText(
                        field.dataset
                            .directionField
                    );

                if (!path) {
                    return;
                }

                writeFieldValue(
                    field,
                    getPathValue(
                        direction,
                        path
                    )
                );

                clearFieldValidation(
                    field
                );
            }
        );

        activePresetId =
            normalizeText(
                direction.presetId
            ) ||
            null;

        if (presetSelect) {
            presetSelect.value =
                activePresetId || "";
        }

        syncing = false;
        dirty = false;

        renderCompleteness();
        renderCategoryStatus();
        renderStatus();
        renderValidationResults(
            direction.validation
        );

        emit(
            "binding:direction-loaded",
            {
                direction:
                    clone(direction)
            }
        );

        return clone(direction);
    }

    /* ========================================================
       EVENTOS DOM
       ======================================================== */

    function bindDomEvents() {
        fields.forEach(
            field => {
                field.addEventListener(
                    "input",
                    handleFieldInput
                );

                field.addEventListener(
                    "change",
                    handleFieldChange
                );

                field.addEventListener(
                    "blur",
                    handleFieldBlur
                );
            }
        );

        presetSelect
            ?.addEventListener(
                "change",
                handlePresetSelection
            );

        root
            .querySelector(
                SELECTORS.PRESET_ACTION
            )
            ?.addEventListener(
                "click",
                handleApplyPreset
            );

        root
            .querySelector(
                SELECTORS.CLEAR_PRESET_ACTION
            )
            ?.addEventListener(
                "click",
                handleClearPreset
            );

        root
            .querySelector(
                SELECTORS.VALIDATE_ACTION
            )
            ?.addEventListener(
                "click",
                handleValidate
            );

        root
            .querySelector(
                SELECTORS.RESET_ACTION
            )
            ?.addEventListener(
                "click",
                handleReset
            );
    }

    function handleFieldInput(event) {
        if (syncing) {
            return;
        }

        updateField(
            event.currentTarget,
            {
                validate: false,
                autosave: true
            }
        );
    }

    function handleFieldChange(event) {
        if (syncing) {
            return;
        }

        updateField(
            event.currentTarget,
            {
                validate: true,
                autosave: true,
                validateDirection: true
            }
        );
    }

    function handleFieldBlur(event) {
        if (syncing) {
            return;
        }

        validateField(
            event.currentTarget
        );
    }

    function handlePresetSelection() {
        if (syncing) {
            return;
        }

        activePresetId =
            normalizeText(
                presetSelect?.value
            ) ||
            null;

        renderStatus();
    }

    async function handleApplyPreset() {
        const presetId =
            normalizeText(
                presetSelect?.value
            );

        if (!presetId) {
            notify(
                "Selecciona un preset de dirección creativa.",
                "warning"
            );

            return;
        }

        await applyPreset(
            presetId
        );
    }

    async function handleClearPreset() {
        await clearPreset();
    }

    function handleValidate() {
        const result =
            validateAll();

        showValidation(result);
    }

    async function handleReset() {
        await reset();
    }

    /* ========================================================
       ACTUALIZACIÓN DE CAMPOS
       ======================================================== */

    function updateField(
        field,
        options = {}
    ) {
        const path =
            normalizeText(
                field.dataset
                    .directionField
            );

        if (!path) {
            return null;
        }

        const value =
            normalizeFieldValue(
                readFieldValue(
                    field
                )
            );

        const profile =
            getActiveProfile();

        if (!profile) {
            throw createError(
                "PROFILE_NOT_AVAILABLE",
                "No existe un perfil activo."
            );
        }

        const updated =
            clone(profile);

        updated.direction =
            normalizeDirection(
                updated.direction
            );

        setPathValue(
            updated.direction,
            path,
            value
        );

        /*
         * Una modificación manual invalida la asociación estricta
         * con el preset aplicado, aunque se conserva como origen.
         */
        if (
            updated.direction.presetId
        ) {
            updated.direction.presetModified =
                true;
        }

        updated.direction.status =
            "draft";

        updated.direction.updatedAt =
            new Date()
                .toISOString();

        updated.direction.completeness =
            calculateDirectionCompleteness(
                updated.direction
            );

        persistDirection(
            updated.direction,
            updated
        );

        dirty = true;

        field.classList.add(
            CLASSES.DIRTY
        );

        if (
            options.validate === true
        ) {
            validateField(field);
        }

        if (
            options.validateDirection ===
                true
        ) {
            validateCreativeConstraints({
                persist: true,
                render: true,
                notify: false
            });
        }

        renderCompleteness();
        renderCategoryStatus();
        renderStatus();

        if (
            options.autosave !==
                false
        ) {
            scheduleAutosave();
        }

        emit(
            "direction:field-updated",
            {
                path,

                value:
                    clone(value),

                direction:
                    clone(
                        updated.direction
                    )
            }
        );

        return clone(
            updated.direction
        );
    }

    function persistDirection(
        direction,
        profile = null
    ) {
        const service =
            getDirectionService();

        if (
            typeof service.update ===
                "function"
        ) {
            service.update(
                direction
            );

            return;
        }

        if (
            typeof service.set ===
                "function"
        ) {
            service.set(
                direction
            );

            return;
        }

        if (
            typeof service
                .setDirection ===
                "function"
        ) {
            service.setDirection(
                direction
            );

            return;
        }

        const updated =
            profile ||
            clone(
                getActiveProfile()
            );

        updated.direction =
            clone(direction);

        persistProfile(updated);
    }

    /* ========================================================
       PRESETS
       ======================================================== */

    async function applyPreset(
        presetId,
        options = {}
    ) {
        const preset =
            getPreset(presetId);

        if (!preset) {
            throw createError(
                "PRESET_NOT_FOUND",
                `No existe el preset «${presetId}».`
            );
        }

        let confirmed = true;

        if (
            options.confirm !== false &&
            hasDirectionContent(
                getDirection()
            ) &&
            window.UI &&
            typeof UI.confirm ===
                "function"
        ) {
            confirmed =
                await UI.confirm({
                    title:
                        "Aplicar preset",

                    message:
                        `Se reemplazará la dirección creativa actual por «${preset.name}». La identidad permanente no se modificará.`,

                    acceptLabel:
                        "Aplicar preset",

                    cancelLabel:
                        "Cancelar"
                });
        }

        if (!confirmed) {
            return {
                applied: false,
                reason:
                    "cancelled"
            };
        }

        const profile =
            getActiveProfile();

        if (!profile) {
            throw createError(
                "PROFILE_NOT_AVAILABLE",
                "No existe un perfil activo."
            );
        }

        const updated =
            clone(profile);

        /*
         * Se sustituye exclusivamente la dirección creativa.
         * La identidad no se lee, modifica ni vuelve a guardar.
         */
        updated.direction =
            normalizeDirection(
                clone(
                    preset.direction
                )
            );

        updated.direction.presetId =
            preset.id;

        updated.direction.presetName =
            preset.name;

        updated.direction.presetModified =
            false;

        updated.direction.status =
            "draft";

        updated.direction.appliedAt =
            new Date()
                .toISOString();

        updated.direction.updatedAt =
            updated.direction.appliedAt;

        updated.direction.completeness =
            calculateDirectionCompleteness(
                updated.direction
            );

        persistDirection(
            updated.direction,
            updated
        );

        activePresetId =
            preset.id;

        if (presetSelect) {
            presetSelect.value =
                preset.id;
        }

        dirty = true;

        load(updated);

        const validation =
            validateAll({
                notify: false
            });

        scheduleAutosave();

        notify(
            `Preset «${preset.name}» aplicado correctamente.`,
            "success"
        );

        emit(
            "direction:preset-applied",
            {
                presetId:
                    preset.id,

                presetName:
                    preset.name,

                direction:
                    clone(
                        updated.direction
                    ),

                validation:
                    clone(validation)
            }
        );

        return {
            applied: true,
            preset:
                clone(preset),
            direction:
                clone(
                    updated.direction
                ),
            validation
        };
    }

    async function clearPreset(
        options = {}
    ) {
        const direction =
            getDirection();

        if (
            !direction.presetId &&
            !activePresetId
        ) {
            return {
                cleared: false,
                reason:
                    "no-preset"
            };
        }

        let confirmed = true;

        if (
            options.confirm !== false &&
            window.UI &&
            typeof UI.confirm ===
                "function"
        ) {
            confirmed =
                await UI.confirm({
                    title:
                        "Desvincular preset",

                    message:
                        "La configuración actual se conservará, pero dejará de estar asociada al preset.",

                    acceptLabel:
                        "Desvincular",

                    cancelLabel:
                        "Cancelar"
                });
        }

        if (!confirmed) {
            return {
                cleared: false,
                reason:
                    "cancelled"
            };
        }

        direction.presetId =
            null;

        direction.presetName =
            null;

        direction.presetModified =
            false;

        direction.updatedAt =
            new Date()
                .toISOString();

        persistDirection(direction);

        activePresetId = null;

        if (presetSelect) {
            presetSelect.value = "";
        }

        dirty = true;

        scheduleAutosave();
        renderStatus();

        emit(
            "direction:preset-cleared",
            {
                direction:
                    clone(direction)
            }
        );

        notify(
            "La dirección creativa se ha desvinculado del preset.",
            "info"
        );

        return {
            cleared: true,
            direction:
                clone(direction)
        };
    }

    function populatePresetSelect() {
        if (!presetSelect) {
            return;
        }

        const currentValue =
            presetSelect.value;

        const initialOption =
            presetSelect.querySelector(
                "option[value='']"
            );

        presetSelect.innerHTML = "";

        if (initialOption) {
            presetSelect.appendChild(
                initialOption
            );
        } else {
            const option =
                document.createElement(
                    "option"
                );

            option.value = "";
            option.textContent =
                "Seleccionar preset";

            presetSelect.appendChild(
                option
            );
        }

        Object.values(PRESETS)
            .forEach(
                preset => {
                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        preset.id;

                    option.textContent =
                        preset.name;

                    option.title =
                        preset.description;

                    presetSelect.appendChild(
                        option
                    );
                }
            );

        presetSelect.value =
            currentValue;
    }

    function getPreset(presetId) {
        const normalized =
            normalizeText(
                presetId
            );

        return (
            PRESETS[normalized] ||
            Object.values(PRESETS)
                .find(
                    preset =>
                        preset.id ===
                        normalized
                ) ||
            null
        );
    }

    function listPresets() {
        return Object.values(
            PRESETS
        ).map(
            clone
        );
    }

    /* ========================================================
       AUTOGUARDADO
       ======================================================== */

    function scheduleAutosave() {
        clearAutosave();

        autosaveTimer =
            window.setTimeout(
                save,
                AUTOSAVE_DELAY
            );
    }

    function clearAutosave() {
        if (
            autosaveTimer !== null
        ) {
            window.clearTimeout(
                autosaveTimer
            );

            autosaveTimer = null;
        }
    }

    function save() {
        clearAutosave();

        if (!dirty) {
            return {
                saved: false,
                reason:
                    "no-changes"
            };
        }

        panel?.classList.add(
            CLASSES.SAVING
        );

        try {
            const profile =
                getActiveProfile();

            if (
                typeof ProfileService
                    .save ===
                    "function"
            ) {
                ProfileService.save(
                    profile
                );
            }

            dirty = false;

            fields.forEach(
                field => {
                    field.classList.remove(
                        CLASSES.DIRTY
                    );
                }
            );

            panel?.classList.remove(
                CLASSES.SAVING
            );

            panel?.classList.add(
                CLASSES.SAVED
            );

            window.setTimeout(
                () => {
                    panel?.classList.remove(
                        CLASSES.SAVED
                    );
                },
                1200
            );

            emit(
                "direction:autosaved",
                {
                    direction:
                        clone(
                            getDirection()
                        )
                }
            );

            return {
                saved: true
            };
        } catch (error) {
            panel?.classList.remove(
                CLASSES.SAVING
            );

            panel?.classList.add(
                CLASSES.ERROR
            );

            emitError(
                error,
                {
                    action:
                        "direction-autosave"
                }
            );

            return {
                saved: false,
                error
            };
        }
    }

    /* ========================================================
       VALIDACIÓN DE CAMPOS
       ======================================================== */

    function validateField(field) {
        const path =
            normalizeText(
                field.dataset
                    .directionField
            );

        const value =
            readFieldValue(field);

        const required =
            REQUIRED_PATHS.includes(
                path
            );

        let result =
            createValidationResult();

        if (required) {
            result =
                validateRequiredValue(
                    value,
                    {
                        field:
                            path,

                        label:
                            getFieldLabel(
                                field
                            )
                    }
                );
        }

        if (
            result.valid &&
            hasValue(value) &&
            typeof value ===
                "string"
        ) {
            const maximum =
                field.tagName ===
                    "TEXTAREA"
                    ? 2000
                    : 300;

            result =
                validateTextLength(
                    value,
                    {
                        field:
                            path,

                        label:
                            getFieldLabel(
                                field
                            ),

                        min:
                            required
                                ? 2
                                : 0,

                        max:
                            maximum
                    }
                );
        }

        renderFieldValidation(
            field,
            result
        );

        return result;
    }

    function validateAll(options = {}) {
        const fieldResults =
            fields.map(
                field => ({
                    path:
                        field.dataset
                            .directionField,

                    result:
                        validateField(
                            field
                        )
                })
            );

        const errors =
            fieldResults.flatMap(
                item =>
                    item.result.errors ||
                    []
            );

        const direction =
            getDirection();

        const warnings =
            RECOMMENDED_PATHS
                .filter(
                    path =>
                        !hasValue(
                            getPathValue(
                                direction,
                                path
                            )
                        )
                )
                .map(
                    path => ({
                        code:
                            "DIRECTION_RECOMMENDED_FIELD_EMPTY",

                        field:
                            path,

                        message:
                            `Se recomienda completar «${getPathLabel(path)}».`
                    })
                );

        const creativeValidation =
            validateCreativeConstraints({
                persist: false,
                render: false,
                notify: false
            });

        errors.push(
            ...creativeValidation.errors
        );

        warnings.push(
            ...creativeValidation.warnings
        );

        const result = {
            valid:
                errors.length === 0,

            errors:
                uniqueMessages(
                    errors
                ),

            warnings:
                uniqueMessages(
                    warnings
                ),

            completeness:
                calculateCompleteness(),

            categories:
                calculateCategoryCompleteness(),

            fieldResults,

            direction:
                clone(direction),

            validatedAt:
                new Date()
                    .toISOString()
        };

        updateValidationState(
            result
        );

        renderValidationResults(
            result
        );

        renderStatus();

        if (
            options.notify === true
        ) {
            showValidation(result);
        }

        emit(
            result.valid
                ? "direction:validation-succeeded"
                : "direction:validation-failed",
            clone(result)
        );

        return result;
    }

    /* ========================================================
       RESTRICCIONES CREATIVAS
       ======================================================== */

    function validateCreativeConstraints(
        options = {}
    ) {
        const direction =
            getDirection();

        const errors = [];
        const warnings = [];

        const engineResult =
            validateWithCreativeEngine(
                direction
            );

        errors.push(
            ...engineResult.errors
        );

        warnings.push(
            ...engineResult.warnings
        );

        const localResult =
            validateLocalConstraints(
                direction
            );

        errors.push(
            ...localResult.errors
        );

        warnings.push(
            ...localResult.warnings
        );

        const result = {
            valid:
                errors.length === 0,

            errors:
                uniqueMessages(
                    errors
                ),

            warnings:
                uniqueMessages(
                    warnings
                ),

            direction:
                clone(direction)
        };

        if (
            options.persist === true
        ) {
            const updated =
                getDirection();

            updated.constraintValidation = {
                valid:
                    result.valid,

                errors:
                    clone(
                        result.errors
                    ),

                warnings:
                    clone(
                        result.warnings
                    ),

                validatedAt:
                    new Date()
                        .toISOString()
            };

            persistDirection(updated);
        }

        if (
            options.render === true
        ) {
            renderValidationResults(
                result
            );
        }

        if (
            options.notify === true &&
            (
                result.errors.length ||
                result.warnings.length
            )
        ) {
            showValidation(result);
        }

        return result;
    }

    function validateWithCreativeEngine(
        direction
    ) {
        if (
            !window.CreativeEngine ||
            typeof CreativeEngine
                .validate !==
                "function"
        ) {
            return {
                errors: [],
                warnings: []
            };
        }

        try {
            const result =
                CreativeEngine.validate(
                    direction,
                    {
                        profile:
                            getActiveProfile(),

                        identity:
                            getActiveProfile()
                                ?.identity
                    }
                );

            return {
                errors:
                    normalizeValidationMessages(
                        result?.errors
                    ),

                warnings:
                    normalizeValidationMessages(
                        result?.warnings
                    )
            };
        } catch (error) {
            emitError(
                error,
                {
                    action:
                        "creative-engine-validation"
                }
            );

            return {
                errors: [],

                warnings: [
                    {
                        code:
                            "CREATIVE_ENGINE_VALIDATION_FAILED",

                        message:
                            "No se pudo completar la validación avanzada de la dirección creativa."
                    }
                ]
            };
        }
    }

    function validateLocalConstraints(
        direction
    ) {
        const errors = [];
        const warnings = [];

        const shotType =
            normalizeText(
                direction.camera
                    ?.shotType
            );

        const lens =
            normalizeText(
                direction.camera
                    ?.lens
            ).toLowerCase();

        const background =
            normalizeText(
                direction.background
                    ?.type
            );

        const lighting =
            normalizeText(
                direction.lighting
                    ?.type
            );

        const contrast =
            normalizeText(
                direction.lighting
                    ?.contrast
            );

        const format =
            normalizeText(
                direction.composition
                    ?.format
            );

        const realism =
            normalizeText(
                direction.treatment
                    ?.realism
            );

        const treatmentNotes =
            normalizeText(
                direction.treatment
                    ?.notes
            ).toLowerCase();

        if (
            shotType ===
                "full-body" &&
            format ===
                "square-1-1"
        ) {
            warnings.push({
                code:
                    "FULL_BODY_SQUARE_FORMAT",

                field:
                    "composition.format",

                message:
                    "Un plano de cuerpo completo en formato cuadrado puede producir un encuadre excesivamente abierto."
            });
        }

        if (
            shotType ===
                "headshot" &&
            (
                format ===
                    "landscape-16-9" ||
                format ===
                    "landscape-3-2"
            )
        ) {
            warnings.push({
                code:
                    "HEADSHOT_LANDSCAPE_FORMAT",

                field:
                    "composition.format",

                message:
                    "Un headshot en formato horizontal requiere definir claramente el uso del espacio negativo."
            });
        }

        if (
            containsLensValue(
                lens,
                value =>
                    value <= 35
            ) &&
            (
                shotType ===
                    "headshot" ||
                shotType ===
                    "close-up"
            )
        ) {
            warnings.push({
                code:
                    "WIDE_LENS_CLOSE_PORTRAIT",

                field:
                    "camera.lens",

                message:
                    "Una óptica angular en primer plano puede deformar las proporciones faciales."
            });
        }

        if (
            containsLensValue(
                lens,
                value =>
                    value >= 135
            ) &&
            shotType ===
                "full-body"
        ) {
            warnings.push({
                code:
                    "LONG_LENS_FULL_BODY",

                field:
                    "camera.lens",

                message:
                    "Una óptica muy larga para cuerpo completo puede exigir una distancia de cámara poco práctica."
            });
        }

        if (
            background ===
                "office" &&
            lighting ===
                "cinematic" &&
            contrast ===
                "high"
        ) {
            warnings.push({
                code:
                    "OFFICE_EXTREME_CINEMATIC_LIGHTING",

                field:
                    "lighting.type",

                message:
                    "La iluminación cinematográfica de alto contraste puede resultar incoherente con un retrato corporativo de oficina."
            });
        }

        if (
            background ===
                "plain" &&
            lighting ===
                "natural" &&
            !hasValue(
                direction.background
                    ?.description
            )
        ) {
            warnings.push({
                code:
                    "PLAIN_NATURAL_BACKGROUND_UNDEFINED",

                field:
                    "background.description",

                message:
                    "Conviene especificar cómo se obtiene el fondo liso mediante iluminación natural."
            });
        }

        if (
            realism ===
                "photorealistic" &&
            (
                treatmentNotes.includes(
                    "beauty"
                ) ||
                treatmentNotes.includes(
                    "piel perfecta"
                ) ||
                treatmentNotes.includes(
                    "sin arrugas"
                ) ||
                treatmentNotes.includes(
                    "rejuvenecer"
                )
            )
        ) {
            errors.push({
                code:
                    "IDENTITY_ALTERING_RETOUCH",

                field:
                    "treatment.notes",

                message:
                    "El tratamiento solicitado puede alterar la edad, la textura real de la piel o los rasgos permanentes."
            });
        }

        if (
            treatmentNotes.includes(
                "cambiar rostro"
            ) ||
            treatmentNotes.includes(
                "modificar facciones"
            ) ||
            treatmentNotes.includes(
                "afinar nariz"
            ) ||
            treatmentNotes.includes(
                "agrandar ojos"
            ) ||
            treatmentNotes.includes(
                "eliminar canas"
            )
        ) {
            errors.push({
                code:
                    "IDENTITY_MODIFICATION_REQUESTED",

                field:
                    "treatment.notes",

                message:
                    "La dirección creativa no puede incluir modificaciones de identidad."
            });
        }

        return {
            errors,
            warnings
        };
    }

    function containsLensValue(
        lens,
        predicate
    ) {
        const values =
            String(lens || "")
                .match(
                    /\d+(?:[.,]\d+)?/g
                )
                ?.map(
                    value =>
                        Number(
                            value.replace(
                                ",",
                                "."
                            )
                        )
                )
                .filter(
                    Number.isFinite
                ) ||
            [];

        return values.some(
            predicate
        );
    }

    /* ========================================================
       ESTADO DE VALIDACIÓN
       ======================================================== */

    function updateValidationState(
        result
    ) {
        const profile =
            getActiveProfile();

        if (!profile) {
            return;
        }

        const updated =
            clone(profile);

        updated.direction =
            normalizeDirection(
                updated.direction
            );

        updated.direction.validation = {
            valid:
                result.valid,

            errors:
                clone(
                    result.errors
                ),

            warnings:
                clone(
                    result.warnings
                ),

            validatedAt:
                result.validatedAt ||
                new Date()
                    .toISOString()
        };

        updated.direction.completeness =
            result.completeness;

        updated.direction.status =
            result.valid
                ? "validated"
                : "draft";

        persistDirection(
            updated.direction,
            updated
        );
    }

    /* ========================================================
       COMPLETITUD
       ======================================================== */

    function calculateCompleteness() {
        return calculateDirectionCompleteness(
            getDirection()
        );
    }

    function calculateDirectionCompleteness(
        direction
    ) {
        const requiredWeight =
            0.8;

        const recommendedWeight =
            0.2;

        const completedRequired =
            REQUIRED_PATHS.filter(
                path =>
                    hasValue(
                        getPathValue(
                            direction,
                            path
                        )
                    )
            ).length;

        const completedRecommended =
            RECOMMENDED_PATHS.filter(
                path =>
                    hasValue(
                        getPathValue(
                            direction,
                            path
                        )
                    )
            ).length;

        const requiredScore =
            REQUIRED_PATHS.length
                ? completedRequired /
                  REQUIRED_PATHS.length
                : 1;

        const recommendedScore =
            RECOMMENDED_PATHS.length
                ? completedRecommended /
                  RECOMMENDED_PATHS.length
                : 1;

        return clamp(
            Math.round(
                (
                    requiredScore *
                        requiredWeight +
                    recommendedScore *
                        recommendedWeight
                ) *
                    100
            ),
            0,
            100
        );
    }

    function calculateCategoryCompleteness() {
        const direction =
            getDirection();

        return Object.fromEntries(
            Object.entries(
                CATEGORY_PATHS
            ).map(
                ([category, paths]) => {
                    const completed =
                        paths.filter(
                            path =>
                                hasValue(
                                    getPathValue(
                                        direction,
                                        path
                                    )
                                )
                        ).length;

                    return [
                        category,
                        {
                            completed,
                            total:
                                paths.length,
                            percentage:
                                paths.length
                                    ? Math.round(
                                        completed /
                                        paths.length *
                                        100
                                    )
                                    : 100,
                            complete:
                                completed ===
                                paths.length
                        }
                    ];
                }
            )
        );
    }

    function renderCompleteness() {
        const value =
            calculateCompleteness();

        if (
            completenessElement
        ) {
            completenessElement.textContent =
                `${value} %`;

            completenessElement.setAttribute(
                "aria-label",
                `Dirección creativa completada al ${value} por ciento`
            );
        }

        panel?.style.setProperty(
            "--direction-completeness",
            `${value}%`
        );

        return value;
    }

    function renderCategoryStatus() {
        const categories =
            calculateCategoryCompleteness();

        root.querySelectorAll(
            SELECTORS.CATEGORY_STATUS
        )
            .forEach(
                element => {
                    const category =
                        normalizeText(
                            element.dataset
                                .directionCategory
                        );

                    const state =
                        categories[category];

                    if (!state) {
                        return;
                    }

                    element.classList.toggle(
                        CLASSES.COMPLETE,
                        state.complete
                    );

                    element.classList.toggle(
                        CLASSES.WARNING,
                        !state.complete &&
                        state.completed > 0
                    );

                    element.textContent =
                        state.complete
                            ? "Completo"
                            : `${state.percentage} %`;

                    element.setAttribute(
                        "aria-label",
                        `${getCategoryLabel(category)}: ${state.percentage} por ciento`
                    );
                }
            );

        return categories;
    }

    /* ========================================================
       ESTADO VISUAL GENERAL
       ======================================================== */

    function renderStatus() {
        if (!statusElement) {
            return;
        }

        const direction =
            getDirection();

        const completeness =
            calculateCompleteness();

        statusElement.classList.remove(
            CLASSES.COMPLETE,
            CLASSES.WARNING,
            CLASSES.ERROR,
            CLASSES.ACTIVE
        );

        if (
            direction.validation
                ?.valid === true
        ) {
            statusElement.textContent =
                "Validada";

            statusElement.classList.add(
                CLASSES.COMPLETE
            );

            return;
        }

        if (
            direction.validation
                ?.errors?.length
        ) {
            statusElement.textContent =
                `${direction.validation.errors.length} conflicto${direction.validation.errors.length === 1 ? "" : "s"}`;

            statusElement.classList.add(
                CLASSES.ERROR
            );

            return;
        }

        if (
            activePresetId ||
            direction.presetId
        ) {
            const preset =
                getPreset(
                    activePresetId ||
                    direction.presetId
                );

            statusElement.textContent =
                direction.presetModified
                    ? `${preset?.name || "Preset"} · modificado`
                    : preset?.name ||
                      "Preset aplicado";

            statusElement.classList.add(
                CLASSES.ACTIVE
            );

            return;
        }

        if (completeness >= 80) {
            statusElement.textContent =
                "Lista para validar";

            statusElement.classList.add(
                CLASSES.COMPLETE
            );

            return;
        }

        if (completeness > 0) {
            statusElement.textContent =
                `Borrador · ${completeness} %`;

            statusElement.classList.add(
                CLASSES.WARNING
            );

            return;
        }

        statusElement.textContent =
            "Sin configurar";
    }

    function renderFieldValidation(
        field,
        result
    ) {
        clearFieldValidation(
            field
        );

        field.classList.toggle(
            CLASSES.INVALID,
            result.valid === false
        );

        field.classList.toggle(
            CLASSES.VALID,
            result.valid === true &&
            hasValue(
                readFieldValue(
                    field
                )
            )
        );

        field.setAttribute(
            "aria-invalid",
            String(
                result.valid === false
            )
        );

        if (result.valid) {
            return;
        }

        const feedback =
            document.createElement(
                "span"
            );

        feedback.className =
            "form-field__error";

        feedback.dataset
            .directionError =
            field.dataset
                .directionField ||
            "";

        feedback.textContent =
            result.errors?.[0]
                ?.message ||
            "El valor no es válido.";

        field
            .closest(
                ".form-field"
            )
            ?.appendChild(
                feedback
            );
    }

    function clearFieldValidation(
        field
    ) {
        field.classList.remove(
            CLASSES.INVALID,
            CLASSES.VALID
        );

        field.removeAttribute(
            "aria-invalid"
        );

        field
            .closest(
                ".form-field"
            )
            ?.querySelector(
                "[data-direction-error]"
            )
            ?.remove();
    }

    function renderValidationResults(
        validation
    ) {
        if (!validationResultsElement) {
            return;
        }

        const errors =
            normalizeValidationMessages(
                validation?.errors
            );

        const warnings =
            normalizeValidationMessages(
                validation?.warnings
            );

        if (
            !errors.length &&
            !warnings.length
        ) {
            validationResultsElement.innerHTML =
                `
                <div class="validation-inline validation-inline--success">
                    <strong>Sin conflictos creativos detectados.</strong>
                    <span>La configuración actual es coherente.</span>
                </div>
                `;

            return;
        }

        validationResultsElement.innerHTML =
            `
            <div class="validation-inline">

                ${
                    errors.length
                        ? `
                            <section class="validation-inline__group validation-inline__group--error">
                                <strong>
                                    Errores · ${errors.length}
                                </strong>

                                <ul>
                                    ${errors
                                        .map(
                                            item =>
                                                `<li>${escapeHtml(item.message)}</li>`
                                        )
                                        .join("")}
                                </ul>
                            </section>
                          `
                        : ""
                }

                ${
                    warnings.length
                        ? `
                            <section class="validation-inline__group validation-inline__group--warning">
                                <strong>
                                    Advertencias · ${warnings.length}
                                </strong>

                                <ul>
                                    ${warnings
                                        .map(
                                            item =>
                                                `<li>${escapeHtml(item.message)}</li>`
                                        )
                                        .join("")}
                                </ul>
                            </section>
                          `
                        : ""
                }

            </div>
            `;
    }

    function showValidation(result) {
        if (
            window.UI &&
            typeof UI.showValidation ===
                "function"
        ) {
            UI.showValidation({
                valid:
                    result.valid,

                errors:
                    result.errors,

                warnings:
                    result.warnings
            });

            return;
        }

        if (result.valid) {
            notify(
                "La dirección creativa es válida.",
                "success"
            );

            return;
        }

        notify(
            `La dirección creativa contiene ${result.errors.length} conflicto${result.errors.length === 1 ? "" : "s"}.`,
            "warning"
        );
    }

    /* ========================================================
       REINICIO
       ======================================================== */

    async function reset(options = {}) {
        let confirmed = true;

        if (
            options.confirm !== false &&
            hasDirectionContent(
                getDirection()
            ) &&
            window.UI &&
            typeof UI.confirm ===
                "function"
        ) {
            confirmed =
                await UI.confirm({
                    title:
                        "Restablecer dirección creativa",

                    message:
                        "Se eliminará toda la configuración creativa. La identidad permanente no se modificará.",

                    acceptLabel:
                        "Restablecer",

                    cancelLabel:
                        "Cancelar"
                });
        }

        if (!confirmed) {
            return {
                reset: false,
                reason:
                    "cancelled"
            };
        }

        const profile =
            getActiveProfile();

        if (!profile) {
            return {
                reset: false,
                reason:
                    "profile-not-available"
            };
        }

        const updated =
            clone(profile);

        updated.direction =
            createEmptyDirection();

        persistDirection(
            updated.direction,
            updated
        );

        activePresetId = null;
        dirty = true;

        load(updated);
        scheduleAutosave();

        notify(
            "La dirección creativa se ha restablecido.",
            "success"
        );

        emit(
            "direction:reset",
            {
                direction:
                    clone(
                        updated.direction
                    )
            }
        );

        return {
            reset: true,
            direction:
                clone(
                    updated.direction
                )
        };
    }

    /* ========================================================
       EVENTOS DE APLICACIÓN
       ======================================================== */

    function bindApplicationEvents() {
        if (
            !window.AppEvents ||
            typeof AppEvents.on !==
                "function"
        ) {
            return;
        }

        subscriptions.push(
            AppEvents.on(
                "profile:loaded",
                detail => {
                    load(
                        detail?.profile
                    );
                }
            )
        );

        subscriptions.push(
            AppEvents.on(
                "profile:imported",
                detail => {
                    load(
                        detail?.profile
                    );
                }
            )
        );

        subscriptions.push(
            AppEvents.on(
                "direction:updated",
                () => {
                    if (!syncing) {
                        load();
                    }
                }
            )
        );

        subscriptions.push(
            AppEvents.on(
                "binding:direction-validate",
                validateAll
            )
        );

        subscriptions.push(
            AppEvents.on(
                "binding:direction-apply-preset",
                detail =>
                    applyPreset(
                        detail?.presetId,
                        detail?.options
                    )
            )
        );

        subscriptions.push(
            AppEvents.on(
                "binding:direction-clear-preset",
                clearPreset
            )
        );

        subscriptions.push(
            AppEvents.on(
                "binding:direction-reset",
                reset
            )
        );
    }

    /* ========================================================
       ACCESO A SERVICIOS
       ======================================================== */

    function getDirectionService() {
        return (
            ProfileService.direction ||
            window.ProfileDirection ||
            {}
        );
    }

    function getActiveProfile() {
        return (
            typeof ProfileService
                .getActive ===
                "function"
                ? ProfileService
                    .getActive()
                : null
        );
    }

    function getDirection() {
        const service =
            getDirectionService();

        if (
            typeof service.get ===
                "function"
        ) {
            return normalizeDirection(
                service.get()
            );
        }

        if (
            typeof service
                .getDirection ===
                "function"
        ) {
            return normalizeDirection(
                service.getDirection()
            );
        }

        return normalizeDirection(
            getActiveProfile()
                ?.direction
        );
    }

    function persistProfile(profile) {
        if (
            typeof ProfileService
                .update ===
                "function"
        ) {
            ProfileService.update(
                profile
            );

            return;
        }

        if (
            typeof ProfileService
                .setActive ===
                "function"
        ) {
            ProfileService.setActive(
                profile
            );

            return;
        }

        throw createError(
            "PROFILE_UPDATE_UNAVAILABLE",
            "No existe un método para actualizar el perfil."
        );
    }

    /* ========================================================
       LECTURA Y ESCRITURA DE CONTROLES
       ======================================================== */

    function readFieldValue(field) {
        if (
            field.type ===
                "checkbox"
        ) {
            return field.checked;
        }

        if (
            field.type ===
                "number" ||
            field.type ===
                "range"
        ) {
            return field.value === ""
                ? null
                : Number(
                    field.value
                );
        }

        return field.value;
    }

    function writeFieldValue(
        field,
        value
    ) {
        if (
            field.type ===
                "checkbox"
        ) {
            field.checked =
                value === true;

            return;
        }

        field.value =
            value ?? "";
    }

    function normalizeFieldValue(
        value
    ) {
        if (
            typeof value ===
                "string"
        ) {
            return value.trim();
        }

        return value;
    }

    /* ========================================================
       MODELO
       ======================================================== */

    function createEmptyDirection() {
        return {
            lighting: {
                type: "",
                contrast: "",
                notes: ""
            },

            camera: {
                shotType: "",
                angle: "",
                lens: "",
                depthOfField: ""
            },

            composition: {
                format: "",
                framing: "",
                notes: ""
            },

            background: {
                type: "",
                depth: "",
                description: ""
            },

            wardrobe: {
                style: "",
                colors: "",
                description: ""
            },

            pose: {
                position: "",
                expression: "",
                notes: ""
            },

            treatment: {
                mood: "",
                realism: "",
                notes: ""
            },

            presetId: null,
            presetName: null,
            presetModified: false,

            status:
                "draft",

            completeness:
                0,

            validation: {
                valid: false,
                errors: [],
                warnings: [],
                validatedAt: null
            },

            createdAt:
                new Date()
                    .toISOString(),

            updatedAt:
                new Date()
                    .toISOString()
        };
    }

    function normalizeDirection(
        direction
    ) {
        const source =
            direction &&
            typeof direction ===
                "object" &&
            !Array.isArray(direction)
                ? clone(direction)
                : createEmptyDirection();

        source.lighting =
            normalizeObject(
                source.lighting
            );

        source.camera =
            normalizeObject(
                source.camera
            );

        source.composition =
            normalizeObject(
                source.composition
            );

        source.background =
            normalizeObject(
                source.background
            );

        source.wardrobe =
            normalizeObject(
                source.wardrobe
            );

        source.pose =
            normalizeObject(
                source.pose
            );

        source.treatment =
            normalizeObject(
                source.treatment
            );

        source.validation =
            normalizeObject(
                source.validation
            );

        source.constraintValidation =
            normalizeObject(
                source.constraintValidation
            );

        source.status =
            normalizeText(
                source.status
            ) ||
            "draft";

        source.presetId =
            normalizeText(
                source.presetId
            ) ||
            null;

        source.presetName =
            normalizeText(
                source.presetName
            ) ||
            null;

        source.presetModified =
            source.presetModified ===
                true;

        source.completeness =
            Number.isFinite(
                Number(
                    source.completeness
                )
            )
                ? Number(
                    source.completeness
                )
                : calculateDirectionCompleteness(
                    source
                );

        return source;
    }

    function hasDirectionContent(
        direction
    ) {
        return [
            ...REQUIRED_PATHS,
            ...RECOMMENDED_PATHS
        ].some(
            path =>
                hasValue(
                    getPathValue(
                        direction,
                        path
                    )
                )
        );
    }

    /* ========================================================
       VALIDADORES COMPATIBLES
       ======================================================== */

    function createValidationResult(
        valid = true,
        errors = []
    ) {
        return {
            valid,
            errors
        };
    }

    function validateRequiredValue(
        value,
        options
    ) {
        if (
            window.Validators &&
            typeof Validators
                .requiredText ===
                "function"
        ) {
            return normalizeValidatorResult(
                Validators.requiredText(
                    value,
                    options
                )
            );
        }

        const valid =
            hasValue(value);

        return createValidationResult(
            valid,
            valid
                ? []
                : [
                    {
                        code:
                            "REQUIRED_FIELD",

                        field:
                            options.field,

                        message:
                            `${options.label} es obligatorio.`
                    }
                ]
        );
    }

    function validateTextLength(
        value,
        options
    ) {
        if (
            window.Validators &&
            typeof Validators
                .textLength ===
                "function"
        ) {
            return normalizeValidatorResult(
                Validators.textLength(
                    value,
                    options
                )
            );
        }

        const text =
            normalizeText(value);

        const tooShort =
            Number.isFinite(
                options.min
            ) &&
            text.length <
                options.min;

        const tooLong =
            Number.isFinite(
                options.max
            ) &&
            text.length >
                options.max;

        if (
            !tooShort &&
            !tooLong
        ) {
            return createValidationResult();
        }

        return createValidationResult(
            false,
            [
                {
                    code:
                        tooShort
                            ? "TEXT_TOO_SHORT"
                            : "TEXT_TOO_LONG",

                    field:
                        options.field,

                    message:
                        tooShort
                            ? `${options.label} debe contener al menos ${options.min} caracteres.`
                            : `${options.label} no puede superar ${options.max} caracteres.`
                }
            ]
        );
    }

    function normalizeValidatorResult(
        result
    ) {
        if (result === true) {
            return createValidationResult();
        }

        if (result === false) {
            return createValidationResult(
                false,
                [
                    {
                        message:
                            "El valor no es válido."
                    }
                ]
            );
        }

        return {
            valid:
                result?.valid !==
                false,

            errors:
                normalizeValidationMessages(
                    result?.errors
                )
        };
    }

    function normalizeValidationMessages(
        items
    ) {
        if (!Array.isArray(items)) {
            return [];
        }

        return items
            .filter(Boolean)
            .map(
                item => {
                    if (
                        typeof item ===
                            "string"
                    ) {
                        return {
                            message:
                                item
                        };
                    }

                    return {
                        ...item,

                        message:
                            normalizeText(
                                item.message
                            ) ||
                            "Se ha detectado un problema de validación."
                    };
                }
            );
    }

    /* ========================================================
       ETIQUETAS
       ======================================================== */

    function getFieldLabel(field) {
        return (
            field
                .closest(
                    ".form-field"
                )
                ?.querySelector(
                    "label"
                )
                ?.textContent
                ?.trim() ||
            getPathLabel(
                field.dataset
                    .directionField
            )
        );
    }

    function getPathLabel(path) {
        const labels = {
            "lighting.type":
                "Tipo de iluminación",

            "lighting.contrast":
                "Contraste",

            "lighting.notes":
                "Indicaciones de iluminación",

            "camera.shotType":
                "Plano",

            "camera.angle":
                "Ángulo de cámara",

            "camera.lens":
                "Óptica",

            "camera.depthOfField":
                "Profundidad de campo",

            "composition.format":
                "Formato",

            "composition.framing":
                "Encuadre",

            "composition.notes":
                "Indicaciones de composición",

            "background.type":
                "Tipo de fondo",

            "background.depth":
                "Profundidad del fondo",

            "background.description":
                "Descripción del fondo",

            "wardrobe.style":
                "Estilo de vestuario",

            "wardrobe.colors":
                "Colores del vestuario",

            "wardrobe.description":
                "Descripción del vestuario",

            "pose.position":
                "Pose",

            "pose.expression":
                "Expresión",

            "pose.notes":
                "Indicaciones de pose",

            "treatment.mood":
                "Atmósfera",

            "treatment.realism":
                "Nivel de realismo",

            "treatment.notes":
                "Indicaciones de tratamiento"
        };

        return (
            labels[path] ||
            path ||
            "Campo"
        );
    }

    function getCategoryLabel(
        category
    ) {
        const labels = {
            lighting:
                "Iluminación",

            camera:
                "Cámara",

            composition:
                "Composición",

            background:
                "Fondo",

            wardrobe:
                "Vestuario",

            pose:
                "Pose y expresión",

            treatment:
                "Tratamiento visual"
        };

        return (
            labels[category] ||
            category
        );
    }

    /* ========================================================
       UTILIDADES GENERALES
       ======================================================== */

    function normalizeObject(value) {
        return (
            value &&
            typeof value ===
                "object" &&
            !Array.isArray(value)
        )
            ? value
            : {};
    }

    function getPathValue(
        source,
        path
    ) {
        return normalizeText(path)
            .split(".")
            .filter(Boolean)
            .reduce(
                (current, key) =>
                    current?.[key],
                source
            );
    }

    function setPathValue(
        target,
        path,
        value
    ) {
        const keys =
            normalizeText(path)
                .split(".")
                .filter(Boolean);

        let current =
            target;

        keys.forEach(
            (key, index) => {
                const isLast =
                    index ===
                    keys.length - 1;

                if (isLast) {
                    current[key] =
                        value;

                    return;
                }

                if (
                    !current[key] ||
                    typeof current[key] !==
                        "object" ||
                    Array.isArray(
                        current[key]
                    )
                ) {
                    current[key] = {};
                }

                current =
                    current[key];
            }
        );

        return target;
    }

    function hasValue(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return false;
        }

        if (
            typeof value ===
                "string"
        ) {
            return value.trim()
                .length > 0;
        }

        if (
            Array.isArray(value)
        ) {
            return value.length > 0;
        }

        return true;
    }

    function uniqueMessages(items) {
        const seen =
            new Set();

        return normalizeValidationMessages(
            items
        ).filter(
            item => {
                const key =
                    [
                        item.code || "",
                        item.field || "",
                        item.message || ""
                    ].join("|");

                if (seen.has(key)) {
                    return false;
                }

                seen.add(key);

                return true;
            }
        );
    }

    function clamp(
        value,
        minimum,
        maximum
    ) {
        return Math.min(
            maximum,
            Math.max(
                minimum,
                value
            )
        );
    }

    function notify(
        message,
        type = "info"
    ) {
        if (
            window.UI &&
            typeof UI.notify ===
                "function"
        ) {
            UI.notify(
                message,
                {
                    type
                }
            );

            return;
        }

        emit(
            "ui:notification",
            {
                message,
                type
            }
        );
    }

    function emit(
        eventName,
        detail
    ) {
        if (
            window.AppEvents &&
            typeof AppEvents.emit ===
                "function"
        ) {
            AppEvents.emit(
                eventName,
                detail
            );
        }
    }

    function emitError(
        error,
        context
    ) {
        if (
            window.AppEvents &&
            typeof AppEvents
                .emitError ===
                "function"
        ) {
            AppEvents.emitError(
                error,
                context
            );
        }
    }

    function normalizeText(value) {
        return String(
            value ?? ""
        ).trim();
    }

    function escapeHtml(value) {
        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }

    function clone(value) {
        if (
            value === undefined
        ) {
            return undefined;
        }

        if (
            typeof structuredClone ===
                "function"
        ) {
            return structuredClone(
                value
            );
        }

        return JSON.parse(
            JSON.stringify(value)
        );
    }

    function getState() {
        return {
            initialized,
            dirty,
            syncing,

            fieldCount:
                fields.length,

            activePresetId,

            completeness:
                calculateCompleteness(),

            categories:
                calculateCategoryCompleteness(),

            direction:
                clone(
                    getDirection()
                )
        };
    }

    function validateDependencies() {
        const required = [
            "ProfileService"
        ];

        const missing =
            required.filter(
                dependency =>
                    !window[dependency]
            );

        if (missing.length) {
            throw createError(
                "MISSING_DIRECTION_BINDING_DEPENDENCY",
                `Faltan dependencias: ${missing.join(", ")}.`
            );
        }
    }

    function createError(
        code,
        message
    ) {
        const error =
            new Error(message);

        error.name =
            "DirectionBindingError";

        error.code =
            code;

        return error;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        init,
        destroy,

        load,
        save,
        reset,

        updateField,

        validateField,
        validateAll,
        validateCreativeConstraints,

        applyPreset,
        clearPreset,
        getPreset,
        listPresets,

        calculateCompleteness,
        calculateCategoryCompleteness,

        renderCompleteness,
        renderCategoryStatus,
        renderStatus,
        renderValidationResults,

        getState
    });

})();

window.DirectionBinding =
    DirectionBinding;
