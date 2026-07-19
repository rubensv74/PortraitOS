"use strict";

/* ============================================================
   PortraitOS
   Identity Engine
   ------------------------------------------------------------
   Responsabilidad:
   - Convertir la identidad validada en instrucciones operativas.
   - Priorizar rasgos permanentes.
   - Consolidar secciones, evidencias y restricciones.
   - Generar un bloque reutilizable por PromptEngine.
   ============================================================ */

const IdentityEngine = (() => {

    const ENGINE_VERSION = "1.0.0";

    const PRIORITY = Object.freeze({
        CRITICAL: "critical",
        HIGH: "high",
        MEDIUM: "medium"
    });

    const SECTION_LABELS = Object.freeze({
        general: "Identidad general",
        face: "Rostro y estructura facial",
        skin: "Piel y textura",
        hair: "Cabello",
        eyes: "Ojos",
        nose: "Nariz",
        mouth: "Boca y labios",
        jaw: "Mandíbula y mentón",
        "facial-hair": "Vello facial",
        "age-markers": "Edad y marcadores naturales",
        asymmetries: "Asimetrías naturales",
        "distinctive-features": "Rasgos distintivos"
    });

    const CRITICAL_SECTIONS = Object.freeze([
        "face",
        "skin",
        "hair",
        "eyes",
        "nose",
        "mouth",
        "jaw",
        "age-markers",
        "asymmetries",
        "distinctive-features"
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

        const validation =
            validateIdentity(source, config);

        const contract =
            ProfileIdentity
                .buildIdentityContract(source);

        const sections =
            buildSections(
                source.identity.sections,
                config
            );

        const photos =
            buildPhotoEvidence(source);

        const constraints =
            buildConstraints(
                contract,
                config
            );

        const directives =
            buildDirectives(
                contract,
                sections,
                constraints
            );

        return {
            engine: "IdentityEngine",
            version: ENGINE_VERSION,

            profile: {
                id:
                    source.id || null,
                name:
                    source.name || "",
                version:
                    source.version || ""
            },

            status: {
                identityStatus:
                    source.identity.status,
                locked:
                    source.identity.locked === true,
                completeness:
                    Number(
                        source.identity
                            .validation
                            ?.completeness || 0
                    ),
                valid:
                    validation.valid
            },

            summary:
                normalizeText(
                    contract.summary
                ),

            ageAppearance:
                normalizeText(
                    contract.ageAppearance
                ),

            genderPresentation:
                normalizeText(
                    contract.genderPresentation
                ),

            sections,
            photos,
            constraints,
            directives,

            text:
                buildText({
                    contract,
                    sections,
                    constraints,
                    photos,
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

    function validateIdentity(
        profile,
        options
    ) {
        const errors = [];
        const warnings = [];

        if (
            !profile.identity ||
            typeof profile.identity !==
                "object"
        ) {
            errors.push(
                "El perfil no contiene identidad."
            );
        }

        if (
            !normalizeText(
                profile.identity?.summary
            )
        ) {
            errors.push(
                "Falta el resumen de identidad."
            );
        }

        if (
            options.requireLocked &&
            profile.identity?.locked !== true
        ) {
            errors.push(
                "La identidad debe estar bloqueada."
            );
        }

        const completeness =
            Number(
                profile.identity
                    ?.validation
                    ?.completeness || 0
            );

        if (
            completeness <
            options.minimumCompleteness
        ) {
            errors.push(
                `La identidad debe alcanzar al menos un ${options.minimumCompleteness} % de completitud.`
            );
        }

        if (
            !Array.isArray(
                profile.identity?.photos
            ) ||
            profile.identity.photos.length === 0
        ) {
            warnings.push(
                "No existen fotografías de referencia."
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
                "IDENTITY_ENGINE_VALIDATION_FAILED",
                errors.join(" ")
            );
        }

        return result;
    }

    /* ========================================================
       SECCIONES
       ======================================================== */

    function buildSections(
        sourceSections,
        options
    ) {
        if (
            !sourceSections ||
            typeof sourceSections !==
                "object"
        ) {
            return [];
        }

        return Object.entries(
            sourceSections
        )
            .filter(
                ([, section]) =>
                    Boolean(
                        normalizeText(
                            section?.description
                        )
                    )
            )
            .map(
                ([key, section]) => ({
                    key,
                    label:
                        SECTION_LABELS[key] ||
                        key,

                    description:
                        normalizeText(
                            section.description
                        ),

                    confidence:
                        normalizeText(
                            section.confidence
                        ) ||
                        "unknown",

                    priority:
                        getSectionPriority(key),

                    sourcePhotoIds:
                        options.includePhotoReferences
                            ? normalizeList(
                                section.sourcePhotoIds
                            )
                            : [],

                    notes:
                        options.includeNotes
                            ? normalizeText(
                                section.notes
                            )
                            : ""
                })
            );
    }

    function getSectionPriority(
        sectionName
    ) {
        if (
            CRITICAL_SECTIONS.includes(
                sectionName
            )
        ) {
            return PRIORITY.CRITICAL;
        }

        if (
            sectionName === "general"
        ) {
            return PRIORITY.HIGH;
        }

        return PRIORITY.MEDIUM;
    }

    /* ========================================================
       EVIDENCIAS FOTOGRÁFICAS
       ======================================================== */

    function buildPhotoEvidence(profile) {
        const photos =
            Array.isArray(
                profile.identity?.photos
            )
                ? profile.identity.photos
                : [];

        return photos.map(
            photo => ({
                id:
                    photo.id,
                name:
                    photo.name,
                role:
                    photo.role,
                primary:
                    photo.isPrimary === true,
                order:
                    Number(photo.order || 0),
                width:
                    Number(
                        photo.dimensions
                            ?.width || 0
                    ),
                height:
                    Number(
                        photo.dimensions
                            ?.height || 0
                    ),
                orientation:
                    photo.dimensions
                        ?.orientation || "",
                quality:
                    photo.metadata
                        ?.quality
                        ?.level || ""
            })
        );
    }

    /* ========================================================
       RESTRICCIONES
       ======================================================== */

    function buildConstraints(
        contract,
        options
    ) {
        const base = [
            "Mantener exactamente la misma identidad visual.",
            "No reinterpretar ni sustituir a la persona.",
            "No rejuvenecer ni envejecer el rostro.",
            "No alterar las proporciones faciales.",
            "No cambiar ojos, nariz, boca, mandíbula o mentón.",
            "No eliminar arrugas, canas, poros, textura o marcas naturales.",
            "No corregir ni ocultar asimetrías naturales.",
            "No aplicar embellecimiento que modifique la identidad.",
            "No convertir el rostro en una versión genérica o idealizada."
        ];

        const contractConstraints =
            Array.isArray(
                contract.constraints
            )
                ? contract.constraints
                : [];

        const additional =
            normalizeList(
                options.additionalConstraints
            );

        return unique([
            ...base,
            ...contractConstraints,
            ...additional
        ]);
    }

    /* ========================================================
       DIRECTIVAS
       ======================================================== */

    function buildDirectives(
        contract,
        sections,
        constraints
    ) {
        const preserve =
            sections.map(
                section => ({
                    category:
                        section.key,
                    instruction:
                        `Preservar ${section.label.toLowerCase()}: ${section.description}`,
                    priority:
                        section.priority
                })
            );

        return {
            subject:
                normalizeText(
                    contract.summary
                ),

            preserve,

            prohibit:
                constraints.map(
                    constraint => ({
                        instruction:
                            constraint,
                        priority:
                            PRIORITY.CRITICAL
                    })
                )
        };
    }

    /* ========================================================
       GENERACIÓN DE TEXTO
       ======================================================== */

    function buildText(context) {
        const lines = [];

        lines.push(
            "IDENTIDAD PERMANENTE — PRIORIDAD MÁXIMA"
        );

        if (context.contract.summary) {
            lines.push(
                context.contract.summary
            );
        }

        if (
            context.contract.ageAppearance
        ) {
            lines.push(
                `Edad aparente: ${context.contract.ageAppearance}.`
            );
        }

        if (
            context.contract
                .genderPresentation
        ) {
            lines.push(
                `Presentación: ${context.contract.genderPresentation}.`
            );
        }

        if (context.sections.length) {
            lines.push("");
            lines.push(
                "RASGOS QUE DEBEN CONSERVARSE"
            );

            context.sections.forEach(
                section => {
                    lines.push(
                        `- ${section.label}: ${section.description}.`
                    );
                }
            );
        }

        if (
            context.config
                .includePhotoReferences &&
            context.photos.length
        ) {
            lines.push("");
            lines.push(
                "REFERENCIAS FOTOGRÁFICAS"
            );

            context.photos.forEach(
                photo => {
                    const primary =
                        photo.primary
                            ? " — referencia principal"
                            : "";

                    lines.push(
                        `- ${photo.name || photo.id}${primary}.`
                    );
                }
            );
        }

        lines.push("");
        lines.push(
            "RESTRICCIONES DE IDENTIDAD"
        );

        context.constraints.forEach(
            constraint => {
                lines.push(
                    `- ${constraint}`
                );
            }
        );

        return lines.join("\n");
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

            requireLocked:
                source.requireLocked !==
                false,

            minimumCompleteness:
                Number.isFinite(
                    Number(
                        source.minimumCompleteness
                    )
                )
                    ? Number(
                        source.minimumCompleteness
                    )
                    : 70,

            includeNotes:
                source.includeNotes === true,

            includePhotoReferences:
                source
                    .includePhotoReferences !==
                false,

            additionalConstraints:
                normalizeList(
                    source
                        .additionalConstraints
                )
        };
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
                values
                    .map(normalizeText)
                    .filter(Boolean)
            )
        ];
    }

    function validateDependencies() {
        if (
            !window.ProfileIdentity
        ) {
            throw createError(
                "MISSING_DEPENDENCY",
                "Falta ProfileIdentity."
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
            "IdentityEngineError";

        error.code = code;

        return error;
    }

    return Object.freeze({
        generate,
        generateText,
        validateIdentity,

        constants: Object.freeze({
            ENGINE_VERSION,
            PRIORITY,
            SECTION_LABELS
        })
    });

})();

window.IdentityEngine = IdentityEngine;
