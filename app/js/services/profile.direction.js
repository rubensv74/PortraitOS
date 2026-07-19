"use strict";

/* ============================================================
   PortraitOS
   Profile Direction Service
   ------------------------------------------------------------
   Responsabilidad:
   - Gestionar la dirección creativa del perfil.
   - Separar identidad permanente de variables creativas.
   - Definir iluminación, cámara, composición, fondo,
     vestuario, pose y tratamiento visual.
   - Generar un contrato creativo normalizado.
   ============================================================ */

const ProfileDirection = (() => {

    const DIRECTION_STATUS = Object.freeze({
        DRAFT: "draft",
        READY: "ready",
        ARCHIVED: "archived"
    });

    const LIGHTING_TYPES = Object.freeze({
        NATURAL: "natural",
        STUDIO: "studio",
        WINDOW: "window",
        REMBRANDT: "rembrandt",
        LOOP: "loop",
        SPLIT: "split",
        BUTTERFLY: "butterfly",
        RIM: "rim",
        HIGH_KEY: "high-key",
        LOW_KEY: "low-key",
        CINEMATIC: "cinematic",
        CUSTOM: "custom"
    });

    const SHOT_TYPES = Object.freeze({
        EXTREME_CLOSE_UP: "extreme-close-up",
        CLOSE_UP: "close-up",
        HEADSHOT: "headshot",
        BUST: "bust",
        HALF_BODY: "half-body",
        THREE_QUARTER: "three-quarter",
        FULL_BODY: "full-body"
    });

    const CAMERA_ANGLES = Object.freeze({
        EYE_LEVEL: "eye-level",
        HIGH_ANGLE: "high-angle",
        LOW_ANGLE: "low-angle",
        THREE_QUARTER: "three-quarter",
        PROFILE: "profile",
        FRONTAL: "frontal"
    });

    const BACKGROUND_TYPES = Object.freeze({
        SOLID: "solid",
        GRADIENT: "gradient",
        STUDIO: "studio",
        INTERIOR: "interior",
        EXTERIOR: "exterior",
        ARCHITECTURAL: "architectural",
        NATURAL: "natural",
        ABSTRACT: "abstract",
        ENVIRONMENTAL: "environmental",
        CUSTOM: "custom"
    });

    const MOODS = Object.freeze({
        NEUTRAL: "neutral",
        CONFIDENT: "confident",
        APPROACHABLE: "approachable",
        SERENE: "serene",
        INTENSE: "intense",
        ELEGANT: "elegant",
        WARM: "warm",
        CONTEMPLATIVE: "contemplative",
        AUTHORITATIVE: "authoritative",
        CREATIVE: "creative"
    });

    const DEFAULT_DIRECTION = Object.freeze({
        status: DIRECTION_STATUS.DRAFT,

        objective: "",
        audience: "",
        platform: "",
        format: "",
        mood: MOODS.NEUTRAL,

        lighting: {
            type: LIGHTING_TYPES.NATURAL,
            direction: "",
            softness: "",
            contrast: "",
            colorTemperature: "",
            notes: ""
        },

        camera: {
            shotType: SHOT_TYPES.HEADSHOT,
            angle: CAMERA_ANGLES.EYE_LEVEL,
            focalLength: "",
            aperture: "",
            lensStyle: "",
            depthOfField: "",
            notes: ""
        },

        composition: {
            framing: "",
            crop: "",
            subjectPosition: "",
            headroom: "",
            negativeSpace: "",
            eyeLine: "",
            aspectRatio: "",
            notes: ""
        },

        background: {
            type: BACKGROUND_TYPES.STUDIO,
            description: "",
            color: "",
            texture: "",
            depth: "",
            context: "",
            notes: ""
        },

        wardrobe: {
            style: "",
            garments: [],
            colors: [],
            materials: [],
            accessories: [],
            restrictions: [],
            notes: ""
        },

        pose: {
            bodyPosition: "",
            headPosition: "",
            gaze: "",
            hands: "",
            shoulders: "",
            expression: "",
            movement: "",
            notes: ""
        },

        treatment: {
            realism: "",
            colorGrading: "",
            skinTreatment: "",
            retouching: "",
            grain: "",
            sharpness: "",
            contrast: "",
            notes: ""
        },

        constraints: [],
        references: [],

        createdAt: null,
        updatedAt: null
    });

    /* ========================================================
       INICIALIZACIÓN
       ======================================================== */

    function initialize(profile) {
        validateProfile(profile);

        if (
            !profile.direction ||
            typeof profile.direction !== "object" ||
            Array.isArray(profile.direction)
        ) {
            profile.direction = {};
        }

        profile.direction =
            mergeDirection(
                clone(DEFAULT_DIRECTION),
                profile.direction
            );

        const now =
            new Date().toISOString();

        profile.direction.createdAt =
            profile.direction.createdAt || now;

        profile.direction.updatedAt =
            profile.direction.updatedAt || now;

        touchProfile(profile);

        return clone(profile.direction);
    }

    function reset(profile) {
        validateProfile(profile);

        profile.direction =
            clone(DEFAULT_DIRECTION);

        const now =
            new Date().toISOString();

        profile.direction.createdAt = now;
        profile.direction.updatedAt = now;

        touchProfile(profile);

        return clone(profile.direction);
    }

    /* ========================================================
       DATOS GENERALES
       ======================================================== */

    function updateGeneral(
        profile,
        changes = {}
    ) {
        const direction =
            getMutableDirection(profile);

        const fields = [
            "objective",
            "audience",
            "platform",
            "format"
        ];

        fields.forEach(field => {
            if (
                Object.prototype.hasOwnProperty.call(
                    changes,
                    field
                )
            ) {
                direction[field] =
                    normalizeText(
                        changes[field]
                    );
            }
        });

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "mood"
            )
        ) {
            direction.mood =
                normalizeEnum(
                    changes.mood,
                    MOODS,
                    MOODS.NEUTRAL
                );
        }

        markUpdated(profile);

        return clone(direction);
    }

    /* ========================================================
       BLOQUES CREATIVOS
       ======================================================== */

    function updateLighting(
        profile,
        changes = {}
    ) {
        return updateBlock(
            profile,
            "lighting",
            changes,
            {
                type: value =>
                    normalizeEnum(
                        value,
                        LIGHTING_TYPES,
                        LIGHTING_TYPES.NATURAL
                    )
            }
        );
    }

    function updateCamera(
        profile,
        changes = {}
    ) {
        return updateBlock(
            profile,
            "camera",
            changes,
            {
                shotType: value =>
                    normalizeEnum(
                        value,
                        SHOT_TYPES,
                        SHOT_TYPES.HEADSHOT
                    ),

                angle: value =>
                    normalizeEnum(
                        value,
                        CAMERA_ANGLES,
                        CAMERA_ANGLES.EYE_LEVEL
                    )
            }
        );
    }

    function updateComposition(
        profile,
        changes = {}
    ) {
        return updateBlock(
            profile,
            "composition",
            changes
        );
    }

    function updateBackground(
        profile,
        changes = {}
    ) {
        return updateBlock(
            profile,
            "background",
            changes,
            {
                type: value =>
                    normalizeEnum(
                        value,
                        BACKGROUND_TYPES,
                        BACKGROUND_TYPES.STUDIO
                    )
            }
        );
    }

    function updateWardrobe(
        profile,
        changes = {}
    ) {
        return updateBlock(
            profile,
            "wardrobe",
            changes,
            {
                garments: normalizeList,
                colors: normalizeList,
                materials: normalizeList,
                accessories: normalizeList,
                restrictions: normalizeList
            }
        );
    }

    function updatePose(
        profile,
        changes = {}
    ) {
        return updateBlock(
            profile,
            "pose",
            changes
        );
    }

    function updateTreatment(
        profile,
        changes = {}
    ) {
        return updateBlock(
            profile,
            "treatment",
            changes
        );
    }

    function updateBlock(
        profile,
        blockName,
        changes,
        normalizers = {}
    ) {
        const direction =
            getMutableDirection(profile);

        const block =
            direction[blockName];

        if (
            !block ||
            typeof block !== "object"
        ) {
            throw createError(
                "INVALID_DIRECTION_BLOCK",
                "El bloque creativo indicado no existe."
            );
        }

        Object.keys(block).forEach(field => {
            if (
                !Object.prototype.hasOwnProperty.call(
                    changes,
                    field
                )
            ) {
                return;
            }

            const normalizer =
                normalizers[field] ||
                normalizeText;

            block[field] =
                normalizer(
                    changes[field]
                );
        });

        markUpdated(profile);

        return clone(block);
    }

    /* ========================================================
       RESTRICCIONES Y REFERENCIAS
       ======================================================== */

    function addConstraint(
        profile,
        value
    ) {
        const direction =
            getMutableDirection(profile);

        const constraint =
            normalizeText(value);

        if (!constraint) {
            throw createError(
                "EMPTY_CONSTRAINT",
                "La restricción no puede estar vacía."
            );
        }

        if (
            !direction.constraints.includes(
                constraint
            )
        ) {
            direction.constraints.push(
                constraint
            );
        }

        markUpdated(profile);

        return clone(
            direction.constraints
        );
    }

    function removeConstraint(
        profile,
        value
    ) {
        const direction =
            getMutableDirection(profile);

        const constraint =
            normalizeText(value);

        direction.constraints =
            direction.constraints.filter(
                item =>
                    item !== constraint
            );

        markUpdated(profile);

        return clone(
            direction.constraints
        );
    }

    function addReference(
        profile,
        reference
    ) {
        const direction =
            getMutableDirection(profile);

        const normalized =
            normalizeReference(
                reference
            );

        direction.references.push(
            normalized
        );

        markUpdated(profile);

        return clone(normalized);
    }

    function removeReference(
        profile,
        referenceId
    ) {
        const direction =
            getMutableDirection(profile);

        const index =
            direction.references.findIndex(
                item =>
                    item.id === referenceId
            );

        if (index < 0) {
            throw createError(
                "REFERENCE_NOT_FOUND",
                "No se encontró la referencia indicada."
            );
        }

        const removed =
            direction.references.splice(
                index,
                1
            )[0];

        markUpdated(profile);

        return clone(removed);
    }

    /* ========================================================
       ESTADO Y VALIDACIÓN
       ======================================================== */

    function markReady(profile) {
        const direction =
            getMutableDirection(profile);

        const validation =
            validateDirection(profile);

        if (!validation.valid) {
            throw createError(
                "DIRECTION_INCOMPLETE",
                validation.errors.join(" ")
            );
        }

        direction.status =
            DIRECTION_STATUS.READY;

        markUpdated(profile);

        return clone(direction);
    }

    function archive(profile) {
        const direction =
            getMutableDirection(profile);

        direction.status =
            DIRECTION_STATUS.ARCHIVED;

        markUpdated(profile);

        return clone(direction);
    }

    function validateDirection(profile) {
        const direction =
            getDirection(profile);

        const errors = [];
        const warnings = [];

        if (!direction.objective) {
            errors.push(
                "Debe definirse el objetivo creativo."
            );
        }

        if (!direction.format) {
            warnings.push(
                "No se ha definido el formato de salida."
            );
        }

        if (
            !direction.pose.expression
        ) {
            warnings.push(
                "No se ha definido la expresión."
            );
        }

        if (
            !direction.wardrobe.style &&
            !direction.wardrobe
                .garments.length
        ) {
            warnings.push(
                "No se ha definido el vestuario."
            );
        }

        return {
            valid:
                errors.length === 0,
            errors,
            warnings
        };
    }

    /* ========================================================
       CONSULTAS
       ======================================================== */

    function get(profile) {
        return clone(
            getDirection(profile)
        );
    }

    function getBlock(
        profile,
        blockName
    ) {
        const direction =
            getDirection(profile);

        if (
            !Object.prototype.hasOwnProperty.call(
                direction,
                blockName
            )
        ) {
            throw createError(
                "INVALID_DIRECTION_BLOCK",
                "El bloque creativo indicado no existe."
            );
        }

        return clone(
            direction[blockName]
        );
    }

    function getSummary(profile) {
        const direction =
            getDirection(profile);

        const validation =
            validateDirection(profile);

        return {
            status:
                direction.status,

            objective:
                direction.objective,

            platform:
                direction.platform,

            format:
                direction.format,

            mood:
                direction.mood,

            valid:
                validation.valid,

            errorCount:
                validation.errors.length,

            warningCount:
                validation.warnings.length,

            constraintCount:
                direction.constraints.length,

            referenceCount:
                direction.references.length
        };
    }

    function buildCreativeContract(profile) {
        const direction =
            getDirection(profile);

        return {
            status:
                direction.status,

            objective:
                direction.objective,

            audience:
                direction.audience,

            destination: {
                platform:
                    direction.platform,
                format:
                    direction.format
            },

            mood:
                direction.mood,

            lighting:
                clone(
                    direction.lighting
                ),

            camera:
                clone(
                    direction.camera
                ),

            composition:
                clone(
                    direction.composition
                ),

            background:
                clone(
                    direction.background
                ),

            wardrobe:
                clone(
                    direction.wardrobe
                ),

            pose:
                clone(
                    direction.pose
                ),

            treatment:
                clone(
                    direction.treatment
                ),

            constraints:
                clone(
                    direction.constraints
                ),

            references:
                clone(
                    direction.references
                )
        };
    }

    /* ========================================================
       UTILIDADES INTERNAS
       ======================================================== */

    function mergeDirection(
        target,
        source
    ) {
        const result = {
            ...target,
            ...source
        };

        const blocks = [
            "lighting",
            "camera",
            "composition",
            "background",
            "wardrobe",
            "pose",
            "treatment"
        ];

        blocks.forEach(block => {
            result[block] = {
                ...target[block],
                ...(source[block] || {})
            };
        });

        result.constraints =
            normalizeList(
                source.constraints ||
                target.constraints
            );

        result.references =
            Array.isArray(
                source.references
            )
                ? source.references.map(
                    normalizeReference
                )
                : [];

        return result;
    }

    function normalizeReference(
        reference
    ) {
        if (
            !reference ||
            typeof reference !== "object"
        ) {
            throw createError(
                "INVALID_REFERENCE",
                "La referencia indicada no es válida."
            );
        }

        return {
            id:
                normalizeText(
                    reference.id
                ) ||
                createReferenceId(),

            title:
                normalizeText(
                    reference.title
                ),

            type:
                normalizeText(
                    reference.type
                ),

            source:
                normalizeText(
                    reference.source
                ),

            notes:
                normalizeText(
                    reference.notes
                )
        };
    }

    function normalizeEnum(
        value,
        enumObject,
        fallback
    ) {
        const normalized =
            normalizeText(value)
                .toLowerCase();

        return Object.values(
            enumObject
        ).includes(normalized)
            ? normalized
            : fallback;
    }

    function normalizeList(values) {
        if (!Array.isArray(values)) {
            return [];
        }

        return [
            ...new Set(
                values
                    .map(normalizeText)
                    .filter(Boolean)
            )
        ];
    }

    function normalizeText(value) {
        return String(value || "")
            .trim();
    }

    function getDirection(profile) {
        validateProfile(profile);

        if (
            !profile.direction ||
            typeof profile.direction !==
                "object"
        ) {
            initialize(profile);
        }

        return profile.direction;
    }

    function getMutableDirection(
        profile
    ) {
        return getDirection(profile);
    }

    function markUpdated(profile) {
        const direction =
            getMutableDirection(profile);

        direction.updatedAt =
            new Date().toISOString();

        if (
            direction.status ===
            DIRECTION_STATUS.READY
        ) {
            direction.status =
                DIRECTION_STATUS.DRAFT;
        }

        touchProfile(profile);
    }

    function touchProfile(profile) {
        profile.updatedAt =
            new Date().toISOString();

        if (
            profile.meta &&
            typeof profile.meta ===
                "object"
        ) {
            profile.meta.updatedAt =
                profile.updatedAt;
        }
    }

    function validateProfile(profile) {
        if (
            !profile ||
            typeof profile !== "object" ||
            Array.isArray(profile)
        ) {
            throw createError(
                "INVALID_PROFILE",
                "El perfil indicado no es válido."
            );
        }
    }

    function createReferenceId() {
        if (
            window.crypto &&
            typeof crypto.randomUUID ===
                "function"
        ) {
            return crypto.randomUUID();
        }

        return [
            "reference",
            Date.now(),
            Math.random()
                .toString(36)
                .slice(2, 10)
        ].join("-");
    }

    function clone(value) {
        if (
            typeof structuredClone ===
                "function"
        ) {
            return structuredClone(value);
        }

        return JSON.parse(
            JSON.stringify(value)
        );
    }

    function createError(
        code,
        message
    ) {
        const error =
            new Error(message);

        error.name =
            "ProfileDirectionError";

        error.code = code;

        return error;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        initialize,
        reset,

        updateGeneral,
        updateLighting,
        updateCamera,
        updateComposition,
        updateBackground,
        updateWardrobe,
        updatePose,
        updateTreatment,

        addConstraint,
        removeConstraint,

        addReference,
        removeReference,

        markReady,
        archive,
        validateDirection,

        get,
        getBlock,
        getSummary,

        buildCreativeContract,

        constants: Object.freeze({
            DIRECTION_STATUS,
            LIGHTING_TYPES,
            SHOT_TYPES,
            CAMERA_ANGLES,
            BACKGROUND_TYPES,
            MOODS
        })
    });

})();

window.ProfileDirection = ProfileDirection;
