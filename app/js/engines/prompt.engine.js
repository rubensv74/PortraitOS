"use strict";

/* ============================================================
   PortraitOS
   Prompt Engine
   ------------------------------------------------------------
   Responsabilidad:
   - Combinar identidad y dirección creativa.
   - Generar un contrato final de generación.
   - Producir prompt positivo y prompt negativo.
   - Mantener la identidad por encima de la creatividad.
   ============================================================ */

const PromptEngine = (() => {

    const ENGINE_VERSION = "1.0.0";

    const OUTPUT_MODES = Object.freeze({
        STRUCTURED: "structured",
        COMPACT: "compact",
        JSON: "json"
    });

    const DEFAULT_NEGATIVE = Object.freeze([
        "persona diferente",
        "rostro genérico",
        "identidad reinterpretada",
        "cambio de edad",
        "rejuvenecimiento",
        "envejecimiento artificial",
        "proporciones faciales alteradas",
        "ojos modificados",
        "nariz modificada",
        "labios modificados",
        "mandíbula modificada",
        "piel de plástico",
        "piel excesivamente suavizada",
        "eliminación de arrugas",
        "eliminación de canas",
        "asimetría corregida",
        "embellecimiento artificial",
        "filtro de belleza",
        "rostro perfecto",
        "efecto muñeca",
        "rasgos irreales",
        "artefactos faciales",
        "ojos deformes",
        "manos deformes",
        "dedos adicionales",
        "baja resolución",
        "desenfoque no intencionado"
    ]);

    /* ========================================================
       GENERACIÓN PRINCIPAL
       ======================================================== */

    function generate(profile, options = {}) {
        validateDependencies();

        const source =
            resolveProfile(profile);

        const config =
            normalizeOptions(options);

        if (config.validateProfile) {
            validateProfileForGeneration(
                source,
                config
            );
        }

        const identity =
            IdentityEngine.generate(
                source,
                {
                    strict:
                        config.strict,
                    requireLocked:
                        config.requireLockedIdentity,
                    minimumCompleteness:
                        config.minimumCompleteness,
                    includePhotoReferences:
                        config.includePhotoReferences,
                    includeNotes:
                        config.includeIdentityNotes,
                    additionalConstraints:
                        config.identityConstraints
                }
            );

        const creative =
            CreativeEngine.generate(
                source,
                {
                    strict:
                        config.strict,
                    requireReady:
                        config.requireReadyDirection,
                    additionalConstraints:
                        config.creativeConstraints
                }
            );

        const positivePrompt =
            buildPositivePrompt(
                identity,
                creative,
                config
            );

        const negativePrompt =
            buildNegativePrompt(
                config
            );

        const contract = {
            engine:
                "PromptEngine",

            version:
                ENGINE_VERSION,

            profile: {
                id:
                    source.id || null,
                name:
                    source.name || "",
                version:
                    source.version || ""
            },

            hierarchy: [
                "identity",
                "identity-constraints",
                "creative-direction",
                "technical-quality"
            ],

            identity,
            creative,

            prompts: {
                positive:
                    positivePrompt,
                negative:
                    negativePrompt
            },

            settings: {
                language:
                    config.language,
                outputMode:
                    config.outputMode
            },

            generatedAt:
                new Date().toISOString()
        };

        contract.text =
            serialize(
                contract,
                config.outputMode
            );

        return contract;
    }

    function generateText(
        profile,
        options = {}
    ) {
        return generate(
            profile,
            options
        ).text;
    }

    function generatePositive(
        profile,
        options = {}
    ) {
        return generate(
            profile,
            options
        ).prompts.positive;
    }

    function generateNegative(
        profile,
        options = {}
    ) {
        return generate(
            profile,
            options
        ).prompts.negative;
    }

    /* ========================================================
       PROMPT POSITIVO
       ======================================================== */

    function buildPositivePrompt(
        identity,
        creative,
        config
    ) {
        if (
            config.outputMode ===
            OUTPUT_MODES.COMPACT
        ) {
            return buildCompactPrompt(
                identity,
                creative,
                config
            );
        }

        const lines = [];

        lines.push(
            "Crear un retrato fotográfico de alta fidelidad."
        );

        lines.push("");
        lines.push(identity.text);

        lines.push("");
        lines.push(creative.text);

        lines.push("");
        lines.push(
            "JERARQUÍA DE DECISIONES"
        );

        lines.push(
            "- La identidad tiene prioridad absoluta sobre cualquier decisión creativa."
        );

        lines.push(
            "- La iluminación, el vestuario, la pose, la cámara y el fondo pueden variar."
        );

        lines.push(
            "- Ninguna decisión creativa puede modificar los rasgos permanentes de la persona."
        );

        if (
            config.technicalQuality.length
        ) {
            lines.push("");
            lines.push(
                "CALIDAD TÉCNICA"
            );

            config.technicalQuality.forEach(
                instruction => {
                    lines.push(
                        `- ${instruction}`
                    );
                }
            );
        }

        if (config.finalInstruction) {
            lines.push("");
            lines.push(
                config.finalInstruction
            );
        }

        return lines.join("\n");
    }

    function buildCompactPrompt(
        identity,
        creative,
        config
    ) {
        const parts = [];

        parts.push(
            "Retrato fotográfico de alta fidelidad."
        );

        if (identity.summary) {
            parts.push(
                identity.summary
            );
        }

        identity.sections.forEach(
            section => {
                parts.push(
                    `${section.label}: ${section.description}.`
                );
            }
        );

        parts.push(
            "Mantener exactamente la identidad, edad, textura de piel, proporciones y asimetrías naturales."
        );

        if (creative.objective) {
            parts.push(
                `Objetivo: ${creative.objective}.`
            );
        }

        if (creative.mood) {
            parts.push(
                `Atmósfera: ${creative.mood}.`
            );
        }

        Object.entries(
            creative.blocks
        ).forEach(
            ([blockName, block]) => {
                const values =
                    Object.values(block)
                        .flat()
                        .filter(Boolean);

                if (values.length) {
                    parts.push(
                        `${formatLabel(blockName)}: ${values.join(", ")}.`
                    );
                }
            }
        );

        config.technicalQuality.forEach(
            instruction => {
                parts.push(
                    instruction
                );
            }
        );

        return parts.join(" ");
    }

    /* ========================================================
       PROMPT NEGATIVO
       ======================================================== */

    function buildNegativePrompt(config) {
        return unique([
            ...DEFAULT_NEGATIVE,
            ...config.negativeTerms
        ]).join(", ");
    }

    /* ========================================================
       SERIALIZACIÓN
       ======================================================== */

    function serialize(
        contract,
        outputMode
    ) {
        switch (outputMode) {
            case OUTPUT_MODES.JSON:
                return JSON.stringify(
                    {
                        positive:
                            contract.prompts
                                .positive,
                        negative:
                            contract.prompts
                                .negative,
                        profile:
                            contract.profile,
                        generatedAt:
                            contract.generatedAt
                    },
                    null,
                    2
                );

            case OUTPUT_MODES.COMPACT:
                return [
                    contract.prompts
                        .positive,
                    "",
                    "NEGATIVE PROMPT",
                    contract.prompts
                        .negative
                ].join("\n");

            case OUTPUT_MODES.STRUCTURED:
            default:
                return [
                    "PROMPT POSITIVO",
                    "",
                    contract.prompts
                        .positive,
                    "",
                    "PROMPT NEGATIVO",
                    "",
                    contract.prompts
                        .negative
                ].join("\n");
        }
    }

    /* ========================================================
       VALIDACIÓN GLOBAL
       ======================================================== */

    function validateProfileForGeneration(
        profile,
        config
    ) {
        if (
            !window.ProfileValidation
        ) {
            return;
        }

        const report =
            ProfileValidation.validate(
                profile,
                {
                    requirePhotos:
                        config.requirePhotos,
                    requireLockedIdentity:
                        config
                            .requireLockedIdentity,
                    requireReadyDirection:
                        config
                            .requireReadyDirection,
                    requirePrimaryPhoto:
                        config
                            .requirePrimaryPhoto
                }
            );

        if (
            !report.valid &&
            config.strict
        ) {
            const message =
                report.errors
                    .map(
                        error =>
                            error.message
                    )
                    .join(" ");

            throw createError(
                "PROFILE_NOT_READY",
                message ||
                "El perfil no está preparado."
            );
        }

        return report;
    }

    /* ========================================================
       OPCIONES
       ======================================================== */

    function normalizeOptions(options) {
        const source =
            options &&
            typeof options === "object"
                ? options
                : {};

        return {
            strict:
                source.strict !== false,

            validateProfile:
                source.validateProfile !==
                false,

            requirePhotos:
                source.requirePhotos !==
                false,

            requirePrimaryPhoto:
                source
                    .requirePrimaryPhoto !==
                false,

            requireLockedIdentity:
                source
                    .requireLockedIdentity !==
                false,

            requireReadyDirection:
                source
                    .requireReadyDirection !==
                false,

            minimumCompleteness:
                Number.isFinite(
                    Number(
                        source
                            .minimumCompleteness
                    )
                )
                    ? Number(
                        source
                            .minimumCompleteness
                    )
                    : 70,

            includePhotoReferences:
                source
                    .includePhotoReferences !==
                false,

            includeIdentityNotes:
                source
                    .includeIdentityNotes ===
                true,

            language:
                normalizeText(
                    source.language
                ) ||
                "es",

            outputMode:
                normalizeOutputMode(
                    source.outputMode
                ),

            identityConstraints:
                normalizeList(
                    source
                        .identityConstraints
                ),

            creativeConstraints:
                normalizeList(
                    source
                        .creativeConstraints
                ),

            negativeTerms:
                normalizeList(
                    source.negativeTerms
                ),

            technicalQuality:
                normalizeList(
                    source.technicalQuality
                ).length
                    ? normalizeList(
                        source
                            .technicalQuality
                    )
                    : [
                        "Alta resolución.",
                        "Detalle facial natural.",
                        "Textura de piel realista.",
                        "Iluminación coherente.",
                        "Anatomía correcta.",
                        "Sin artefactos visuales."
                    ],

            finalInstruction:
                normalizeText(
                    source
                        .finalInstruction
                )
        };
    }

    function normalizeOutputMode(
        value
    ) {
        const normalized =
            normalizeText(value)
                .toLowerCase();

        return Object.values(
            OUTPUT_MODES
        ).includes(normalized)
            ? normalized
            : OUTPUT_MODES.STRUCTURED;
    }

    /* ========================================================
       UTILIDADES
       ======================================================== */

    function resolveProfile(profile) {
        if (
            profile &&
            typeof profile === "object"
        ) {
            return profile;
        }

        if (
            window.ProfileService &&
            typeof ProfileService
                .getActive === "function"
        ) {
            const active =
                ProfileService.getActive();

            if (active) {
                return active;
            }
        }

        throw createError(
            "PROFILE_REQUIRED",
            "No existe ningún perfil disponible."
        );
    }

    function formatLabel(value) {
        return String(value || "")
            .replace(
                /([a-z])([A-Z])/g,
                "$1 $2"
            )
            .replace(
                /[-_]+/g,
                " "
            )
            .replace(
                /^\w/,
                character =>
                    character.toUpperCase()
            );
    }

    function normalizeText(value) {
        return String(value || "")
            .trim();
    }

    function normalizeList(values) {
        if (!Array.isArray(values)) {
            return [];
        }

        return values
            .map(normalizeText)
            .filter(Boolean);
    }

    function unique(values) {
        return [
            ...new Set(
                normalizeList(values)
            )
        ];
    }

    function validateDependencies() {
        const dependencies = [
            "IdentityEngine",
            "CreativeEngine"
        ];

        const missing =
            dependencies.filter(
                name =>
                    !window[name]
            );

        if (missing.length) {
            throw createError(
                "MISSING_DEPENDENCY",
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
            "PromptEngineError";

        error.code = code;

        return error;
    }

    return Object.freeze({
        generate,
        generateText,
        generatePositive,
        generateNegative,

        constants: Object.freeze({
            ENGINE_VERSION,
            OUTPUT_MODES,
            DEFAULT_NEGATIVE
        })
    });

})();

window.PromptEngine = PromptEngine;
