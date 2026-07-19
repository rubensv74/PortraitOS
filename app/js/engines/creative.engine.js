"use strict";

/* ============================================================
   PortraitOS
   Creative Engine
   ------------------------------------------------------------
   Responsabilidad:
   - Transformar la dirección creativa en instrucciones visuales.
   - Normalizar cámara, luz, pose, fondo y vestuario.
   - Mantener la creatividad separada de la identidad.
   - Generar un bloque reutilizable por PromptEngine.
   ============================================================ */

const CreativeEngine = (() => {

    const ENGINE_VERSION = "1.0.0";

    const BLOCK_LABELS = Object.freeze({
        lighting: "Iluminación",
        camera: "Cámara",
        composition: "Composición",
        background: "Fondo",
        wardrobe: "Vestuario",
        pose: "Pose y expresión",
        treatment: "Tratamiento visual"
    });

    /* ========================================================
       GENERACIÓN PRINCIPAL
       ======================================================== */

    function generate(profile, options = {}) {
        validateDependencies();

        const source =
            resolveProfile(profile);

        const config =
            normalizeOptions(options);

        const validation =
            validateDirection(
                source,
                config
            );

        const contract =
            ProfileDirection
                .buildCreativeContract(
                    source
                );

        const blocks = {
            lighting:
                cleanBlock(
                    contract.lighting
                ),

            camera:
                cleanBlock(
                    contract.camera
                ),

            composition:
                cleanBlock(
                    contract.composition
                ),

            background:
                cleanBlock(
                    contract.background
                ),

            wardrobe:
                cleanBlock(
                    contract.wardrobe
                ),

            pose:
                cleanBlock(
                    contract.pose
                ),

            treatment:
                cleanBlock(
                    contract.treatment
                )
        };

        const constraints =
            buildConstraints(
                contract,
                config
            );

        return {
            engine:
                "CreativeEngine",

            version:
                ENGINE_VERSION,

            profile: {
                id:
                    source.id || null,
                name:
                    source.name || ""
            },

            status: {
                directionStatus:
                    source.direction.status,
                valid:
                    validation.valid
            },

            objective:
                normalizeText(
                    contract.objective
                ),

            audience:
                normalizeText(
                    contract.audience
                ),

            platform:
                normalizeText(
                    contract.destination
                        ?.platform
                ),

            format:
                normalizeText(
                    contract.destination
                        ?.format
                ),

            mood:
                normalizeText(
                    contract.mood
                ),

            blocks,
            constraints,

            text:
                buildText({
                    contract,
                    blocks,
                    constraints,
                    config
                }),

            generatedAt:
                new Date().toISOString()
        };
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

    /* ========================================================
       VALIDACIÓN
       ======================================================== */

    function validateDirection(
        profile,
        options
    ) {
        const errors = [];
        const warnings = [];

        if (
            !profile.direction ||
            typeof profile.direction !==
                "object"
        ) {
            errors.push(
                "El perfil no contiene dirección creativa."
            );
        }

        if (
            !normalizeText(
                profile.direction
                    ?.objective
            )
        ) {
            errors.push(
                "Falta el objetivo creativo."
            );
        }

        if (
            options.requireReady &&
            profile.direction
                ?.status !== "ready"
        ) {
            errors.push(
                "La dirección creativa debe estar preparada."
            );
        }

        if (
            !normalizeText(
                profile.direction
                    ?.pose
                    ?.expression
            )
        ) {
            warnings.push(
                "No se ha definido la expresión."
            );
        }

        if (
            !normalizeText(
                profile.direction
                    ?.format
            )
        ) {
            warnings.push(
                "No se ha definido el formato."
            );
        }

        const result = {
            valid:
                errors.length === 0,
            errors,
            warnings
        };

        if (
            !result.valid &&
            options.strict
        ) {
            throw createError(
                "CREATIVE_ENGINE_VALIDATION_FAILED",
                errors.join(" ")
            );
        }

        return result;
    }

    /* ========================================================
       RESTRICCIONES
       ======================================================== */

    function buildConstraints(
        contract,
        options
    ) {
        return unique([
            ...normalizeList(
                contract.constraints
            ),

            ...normalizeList(
                options.additionalConstraints
            )
        ]);
    }

    /* ========================================================
       GENERACIÓN DE TEXTO
       ======================================================== */

    function buildText(context) {
        const lines = [];

        lines.push(
            "DIRECCIÓN CREATIVA"
        );

        if (context.contract.objective) {
            lines.push(
                `Objetivo: ${context.contract.objective}.`
            );
        }

        if (context.contract.audience) {
            lines.push(
                `Audiencia: ${context.contract.audience}.`
            );
        }

        if (
            context.contract
                .destination
                ?.platform
        ) {
            lines.push(
                `Plataforma: ${context.contract.destination.platform}.`
            );
        }

        if (
            context.contract
                .destination
                ?.format
        ) {
            lines.push(
                `Formato: ${context.contract.destination.format}.`
            );
        }

        if (context.contract.mood) {
            lines.push(
                `Atmósfera: ${context.contract.mood}.`
            );
        }

        Object.entries(
            context.blocks
        ).forEach(
            ([blockName, block]) => {
                const descriptions =
                    formatBlock(block);

                if (!descriptions.length) {
                    return;
                }

                lines.push("");
                lines.push(
                    BLOCK_LABELS[
                        blockName
                    ] ||
                    blockName
                );

                descriptions.forEach(
                    description => {
                        lines.push(
                            `- ${description}`
                        );
                    }
                );
            }
        );

        if (
            context.constraints.length
        ) {
            lines.push("");
            lines.push(
                "RESTRICCIONES CREATIVAS"
            );

            context.constraints.forEach(
                constraint => {
                    lines.push(
                        `- ${constraint}`
                    );
                }
            );
        }

        return lines.join("\n");
    }

    function formatBlock(block) {
        if (
            !block ||
            typeof block !== "object"
        ) {
            return [];
        }

        return Object.entries(block)
            .filter(
                ([, value]) =>
                    hasValue(value)
            )
            .map(
                ([key, value]) => {
                    const label =
                        formatLabel(key);

                    if (
                        Array.isArray(value)
                    ) {
                        return `${label}: ${value.join(", ")}.`;
                    }

                    return `${label}: ${value}.`;
                }
            );
    }

    /* ========================================================
       LIMPIEZA DE BLOQUES
       ======================================================== */

    function cleanBlock(block) {
        if (
            !block ||
            typeof block !== "object"
        ) {
            return {};
        }

        return Object.entries(block)
            .reduce(
                (result, [key, value]) => {
                    if (!hasValue(value)) {
                        return result;
                    }

                    if (
                        Array.isArray(value)
                    ) {
                        result[key] =
                            unique(value);

                        return result;
                    }

                    result[key] =
                        normalizeText(value);

                    return result;
                },
                {}
            );
    }

    function hasValue(value) {
        if (Array.isArray(value)) {
            return value.length > 0;
        }

        if (
            value === null ||
            value === undefined
        ) {
            return false;
        }

        return Boolean(
            normalizeText(value)
        );
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

    function normalizeOptions(options) {
        const source =
            options &&
            typeof options === "object"
                ? options
                : {};

        return {
            strict:
                source.strict !== false,

            requireReady:
                source.requireReady !==
                false,

            additionalConstraints:
                normalizeList(
                    source
                        .additionalConstraints
                )
        };
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
        if (
            !window.ProfileDirection
        ) {
            throw createError(
                "MISSING_DEPENDENCY",
                "Falta ProfileDirection."
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
            "CreativeEngineError";

        error.code = code;

        return error;
    }

    return Object.freeze({
        generate,
        generateText,
        validateDirection,

        constants: Object.freeze({
            ENGINE_VERSION,
            BLOCK_LABELS
        })
    });

})();

window.CreativeEngine = CreativeEngine;
