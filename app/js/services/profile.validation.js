"use strict";

/* ============================================================
   PortraitOS
   Profile Validation Service
   ------------------------------------------------------------
   Responsabilidad:
   - Validar la estructura global del perfil.
   - Verificar identidad, fotografías y dirección creativa.
   - Consolidar errores, advertencias y métricas.
   - Determinar si el perfil puede utilizarse para generar
     un contrato visual o un prompt.
   ============================================================ */

const ProfileValidation = (() => {

    const VALIDATION_LEVELS = Object.freeze({
        ERROR: "error",
        WARNING: "warning",
        INFO: "info"
    });

    const PROFILE_STATUS = Object.freeze({
        INVALID: "invalid",
        INCOMPLETE: "incomplete",
        READY: "ready"
    });

    const MINIMUM_IDENTITY_COMPLETENESS = 70;
    const MINIMUM_REFERENCE_PHOTOS = 1;

    /* ========================================================
       VALIDACIÓN PRINCIPAL
       ======================================================== */

    function validate(profile, options = {}) {
        validateProfileObject(profile);

        const config =
            normalizeOptions(options);

        const findings = [];

        validateBaseStructure(
            profile,
            findings
        );

        validateProfileMetadata(
            profile,
            findings
        );

        validatePhotos(
            profile,
            findings,
            config
        );

        validateIdentity(
            profile,
            findings,
            config
        );

        validateDirection(
            profile,
            findings,
            config
        );

        validateCrossDependencies(
            profile,
            findings,
            config
        );

        return buildReport(
            profile,
            findings
        );
    }

    function validateForPrompt(profile) {
        return validate(profile, {
            requirePhotos: true,
            requireLockedIdentity: true,
            requireReadyDirection: true,
            requirePrimaryPhoto: true
        });
    }

    function validateForDraft(profile) {
        return validate(profile, {
            requirePhotos: false,
            requireLockedIdentity: false,
            requireReadyDirection: false,
            requirePrimaryPhoto: false
        });
    }

    function assertValid(
        profile,
        options = {}
    ) {
        const report =
            validate(profile, options);

        if (!report.valid) {
            throw createValidationError(
                report
            );
        }

        return report;
    }

    function assertReadyForPrompt(profile) {
        const report =
            validateForPrompt(profile);

        if (!report.ready) {
            throw createValidationError(
                report,
                "El perfil no está preparado para generar un prompt."
            );
        }

        return report;
    }

    /* ========================================================
       ESTRUCTURA GLOBAL
       ======================================================== */

    function validateBaseStructure(
        profile,
        findings
    ) {
        if (
            !profile.id ||
            !normalizeText(profile.id)
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.WARNING,
                "PROFILE_ID_MISSING",
                "El perfil no tiene identificador.",
                "profile.id"
            );
        }

        if (
            !profile.name ||
            !normalizeText(profile.name)
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "PROFILE_NAME_REQUIRED",
                "El nombre del perfil es obligatorio.",
                "profile.name"
            );
        }

        if (
            !profile.identity ||
            typeof profile.identity !== "object" ||
            Array.isArray(profile.identity)
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "IDENTITY_STRUCTURE_MISSING",
                "El perfil no contiene una estructura de identidad válida.",
                "profile.identity"
            );
        }

        if (
            !profile.direction ||
            typeof profile.direction !== "object" ||
            Array.isArray(profile.direction)
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "DIRECTION_STRUCTURE_MISSING",
                "El perfil no contiene una dirección creativa válida.",
                "profile.direction"
            );
        }
    }

    function validateProfileMetadata(
        profile,
        findings
    ) {
        if (
            profile.createdAt &&
            !isValidDate(profile.createdAt)
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.WARNING,
                "INVALID_CREATED_AT",
                "La fecha de creación del perfil no es válida.",
                "profile.createdAt"
            );
        }

        if (
            profile.updatedAt &&
            !isValidDate(profile.updatedAt)
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.WARNING,
                "INVALID_UPDATED_AT",
                "La fecha de actualización del perfil no es válida.",
                "profile.updatedAt"
            );
        }

        if (
            profile.version &&
            typeof profile.version !== "string"
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.WARNING,
                "INVALID_PROFILE_VERSION",
                "La versión del perfil debe ser una cadena de texto.",
                "profile.version"
            );
        }
    }

    /* ========================================================
       FOTOGRAFÍAS
       ======================================================== */

    function validatePhotos(
        profile,
        findings,
        options
    ) {
        const photos =
            Array.isArray(
                profile.identity?.photos
            )
                ? profile.identity.photos
                : [];

        if (
            options.requirePhotos &&
            photos.length <
                MINIMUM_REFERENCE_PHOTOS
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "REFERENCE_PHOTO_REQUIRED",
                "Debe añadirse al menos una fotografía de referencia.",
                "profile.identity.photos"
            );
        }

        if (
            window.PhotoValidation &&
            PhotoValidation.constants &&
            photos.length >
                PhotoValidation.constants
                    .MAX_PHOTOS
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "PHOTO_LIMIT_EXCEEDED",
                `El perfil supera el límite de ${PhotoValidation.constants.MAX_PHOTOS} fotografías.`,
                "profile.identity.photos"
            );
        }

        const photoIds =
            new Set();

        let primaryCount = 0;

        photos.forEach(
            (photo, index) => {
                const path =
                    `profile.identity.photos[${index}]`;

                if (
                    !photo ||
                    typeof photo !== "object"
                ) {
                    addFinding(
                        findings,
                        VALIDATION_LEVELS.ERROR,
                        "INVALID_PHOTO_OBJECT",
                        "La fotografía no tiene una estructura válida.",
                        path
                    );

                    return;
                }

                if (!normalizeText(photo.id)) {
                    addFinding(
                        findings,
                        VALIDATION_LEVELS.ERROR,
                        "PHOTO_ID_REQUIRED",
                        "La fotografía no tiene identificador.",
                        `${path}.id`
                    );
                } else if (
                    photoIds.has(photo.id)
                ) {
                    addFinding(
                        findings,
                        VALIDATION_LEVELS.ERROR,
                        "DUPLICATED_PHOTO_ID",
                        "Existen fotografías con identificadores duplicados.",
                        `${path}.id`
                    );
                } else {
                    photoIds.add(photo.id);
                }

                if (photo.isPrimary) {
                    primaryCount += 1;
                }

                if (
                    !photo.source ||
                    !normalizeText(
                        photo.source.dataUrl
                    )
                ) {
                    addFinding(
                        findings,
                        VALIDATION_LEVELS.ERROR,
                        "PHOTO_SOURCE_MISSING",
                        "La fotografía no contiene una fuente de imagen.",
                        `${path}.source.dataUrl`
                    );
                }

                if (
                    !photo.thumbnail ||
                    !normalizeText(
                        photo.thumbnail.dataUrl
                    )
                ) {
                    addFinding(
                        findings,
                        VALIDATION_LEVELS.WARNING,
                        "PHOTO_THUMBNAIL_MISSING",
                        "La fotografía no contiene una miniatura.",
                        `${path}.thumbnail.dataUrl`
                    );
                }

                if (
                    !photo.dimensions ||
                    !isPositiveNumber(
                        photo.dimensions.width
                    ) ||
                    !isPositiveNumber(
                        photo.dimensions.height
                    )
                ) {
                    addFinding(
                        findings,
                        VALIDATION_LEVELS.WARNING,
                        "PHOTO_DIMENSIONS_MISSING",
                        "No se han registrado correctamente las dimensiones de la fotografía.",
                        `${path}.dimensions`
                    );
                }

                if (
                    photo.metadata?.quality
                        ?.suitableForIdentity ===
                    false
                ) {
                    addFinding(
                        findings,
                        VALIDATION_LEVELS.WARNING,
                        "PHOTO_QUALITY_INSUFFICIENT",
                        "La calidad de una fotografía puede ser insuficiente para analizar la identidad.",
                        path
                    );
                }
            }
        );

        if (primaryCount > 1) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "MULTIPLE_PRIMARY_PHOTOS",
                "Solo puede existir una fotografía principal.",
                "profile.identity.photos"
            );
        }

        if (
            options.requirePrimaryPhoto &&
            photos.length &&
            primaryCount === 0
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "PRIMARY_PHOTO_REQUIRED",
                "Debe seleccionarse una fotografía principal.",
                "profile.identity.photos"
            );
        }
    }

    /* ========================================================
       IDENTIDAD
       ======================================================== */

    function validateIdentity(
        profile,
        findings,
        options
    ) {
        const identity =
            profile.identity;

        if (
            !identity ||
            typeof identity !== "object"
        ) {
            return;
        }

        if (!normalizeText(identity.summary)) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "IDENTITY_SUMMARY_REQUIRED",
                "Debe definirse un resumen general de identidad.",
                "profile.identity.summary"
            );
        }

        if (
            !normalizeText(
                identity.ageAppearance
            )
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.WARNING,
                "AGE_APPEARANCE_MISSING",
                "No se ha definido la edad aparente.",
                "profile.identity.ageAppearance"
            );
        }

        const completeness =
            Number(
                identity.validation
                    ?.completeness || 0
            );

        if (
            completeness <
            MINIMUM_IDENTITY_COMPLETENESS
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "IDENTITY_INCOMPLETE",
                `La identidad debe alcanzar al menos un ${MINIMUM_IDENTITY_COMPLETENESS} % de completitud.`,
                "profile.identity.validation.completeness"
            );
        }

        if (
            options.requireLockedIdentity &&
            identity.locked !== true
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "IDENTITY_NOT_LOCKED",
                "La identidad debe estar validada y bloqueada.",
                "profile.identity.locked"
            );
        }

        if (
            identity.locked === true &&
            identity.status !== "locked"
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.WARNING,
                "IDENTITY_STATUS_INCONSISTENT",
                "El estado de identidad no coincide con su condición de bloqueo.",
                "profile.identity.status"
            );
        }

        validateIdentitySections(
            identity,
            findings
        );
    }

    function validateIdentitySections(
        identity,
        findings
    ) {
        if (
            !identity.sections ||
            typeof identity.sections !==
                "object"
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "IDENTITY_SECTIONS_MISSING",
                "No existen secciones de identidad.",
                "profile.identity.sections"
            );

            return;
        }

        Object.entries(
            identity.sections
        ).forEach(
            ([name, section]) => {
                if (
                    !section ||
                    typeof section !==
                        "object"
                ) {
                    addFinding(
                        findings,
                        VALIDATION_LEVELS.WARNING,
                        "INVALID_IDENTITY_SECTION",
                        `La sección de identidad "${name}" no es válida.`,
                        `profile.identity.sections.${name}`
                    );

                    return;
                }

                if (
                    section.sourcePhotoIds &&
                    !Array.isArray(
                        section.sourcePhotoIds
                    )
                ) {
                    addFinding(
                        findings,
                        VALIDATION_LEVELS.WARNING,
                        "INVALID_SOURCE_PHOTO_IDS",
                        `Las fotografías de origen de la sección "${name}" no son válidas.`,
                        `profile.identity.sections.${name}.sourcePhotoIds`
                    );
                }
            }
        );
    }

    /* ========================================================
       DIRECCIÓN CREATIVA
       ======================================================== */

    function validateDirection(
        profile,
        findings,
        options
    ) {
        const direction =
            profile.direction;

        if (
            !direction ||
            typeof direction !== "object"
        ) {
            return;
        }

        if (
            !normalizeText(
                direction.objective
            )
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "CREATIVE_OBJECTIVE_REQUIRED",
                "Debe definirse el objetivo creativo.",
                "profile.direction.objective"
            );
        }

        if (
            !normalizeText(
                direction.format
            )
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.WARNING,
                "OUTPUT_FORMAT_MISSING",
                "No se ha definido el formato de salida.",
                "profile.direction.format"
            );
        }

        if (
            options.requireReadyDirection &&
            direction.status !== "ready"
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "DIRECTION_NOT_READY",
                "La dirección creativa debe estar marcada como preparada.",
                "profile.direction.status"
            );
        }

        if (
            !normalizeText(
                direction.pose?.expression
            )
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.WARNING,
                "EXPRESSION_MISSING",
                "No se ha definido la expresión del retrato.",
                "profile.direction.pose.expression"
            );
        }

        if (
            !normalizeText(
                direction.wardrobe?.style
            ) &&
            !direction.wardrobe
                ?.garments?.length
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.WARNING,
                "WARDROBE_MISSING",
                "No se ha definido el vestuario.",
                "profile.direction.wardrobe"
            );
        }
    }

    /* ========================================================
       DEPENDENCIAS CRUZADAS
       ======================================================== */

    function validateCrossDependencies(
        profile,
        findings
    ) {
        const photos =
            Array.isArray(
                profile.identity?.photos
            )
                ? profile.identity.photos
                : [];

        const availablePhotoIds =
            new Set(
                photos.map(
                    photo => photo.id
                )
            );

        const sections =
            profile.identity?.sections;

        if (
            sections &&
            typeof sections === "object"
        ) {
            Object.entries(
                sections
            ).forEach(
                ([sectionName, section]) => {
                    const sourceIds =
                        Array.isArray(
                            section.sourcePhotoIds
                        )
                            ? section.sourcePhotoIds
                            : [];

                    sourceIds.forEach(
                        photoId => {
                            if (
                                !availablePhotoIds.has(
                                    photoId
                                )
                            ) {
                                addFinding(
                                    findings,
                                    VALIDATION_LEVELS.WARNING,
                                    "UNKNOWN_SOURCE_PHOTO",
                                    `La sección "${sectionName}" referencia una fotografía inexistente.`,
                                    `profile.identity.sections.${sectionName}.sourcePhotoIds`
                                );
                            }
                        }
                    );
                }
            );
        }

        if (
            profile.identity?.locked &&
            !photos.length
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.WARNING,
                "LOCKED_IDENTITY_WITHOUT_PHOTOS",
                "La identidad está bloqueada pero no conserva fotografías de referencia.",
                "profile.identity"
            );
        }
    }

    /* ========================================================
       INFORME
       ======================================================== */

    function buildReport(
        profile,
        findings
    ) {
        const errors =
            findings.filter(
                item =>
                    item.level ===
                    VALIDATION_LEVELS.ERROR
            );

        const warnings =
            findings.filter(
                item =>
                    item.level ===
                    VALIDATION_LEVELS.WARNING
            );

        const information =
            findings.filter(
                item =>
                    item.level ===
                    VALIDATION_LEVELS.INFO
            );

        const valid =
            errors.length === 0;

        const ready =
            valid &&
            profile.identity?.locked === true &&
            profile.direction?.status ===
                "ready" &&
            Array.isArray(
                profile.identity?.photos
            ) &&
            profile.identity.photos.length > 0;

        let status =
            PROFILE_STATUS.INVALID;

        if (valid && ready) {
            status =
                PROFILE_STATUS.READY;
        } else if (valid) {
            status =
                PROFILE_STATUS.INCOMPLETE;
        }

        return {
            valid,
            ready,
            status,

            summary: {
                errorCount:
                    errors.length,
                warningCount:
                    warnings.length,
                infoCount:
                    information.length,
                totalFindings:
                    findings.length
            },

            errors,
            warnings,
            information,

            findings:
                clone(findings),

            validatedAt:
                new Date().toISOString()
        };
    }

    function addFinding(
        findings,
        level,
        code,
        message,
        path = ""
    ) {
        findings.push({
            level,
            code,
            message,
            path
        });
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
            requirePhotos:
                source.requirePhotos === true,

            requireLockedIdentity:
                source.requireLockedIdentity ===
                true,

            requireReadyDirection:
                source.requireReadyDirection ===
                true,

            requirePrimaryPhoto:
                source.requirePrimaryPhoto ===
                true
        };
    }

    /* ========================================================
       VALIDADORES BÁSICOS
       ======================================================== */

    function validateProfileObject(
        profile
    ) {
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

    function isPositiveNumber(value) {
        const numeric =
            Number(value);

        return (
            Number.isFinite(numeric) &&
            numeric > 0
        );
    }

    function isValidDate(value) {
        const date =
            new Date(value);

        return !Number.isNaN(
            date.getTime()
        );
    }

    function normalizeText(value) {
        return String(value || "")
            .trim();
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

    /* ========================================================
       ERRORES
       ======================================================== */

    function createValidationError(
        report,
        fallbackMessage = ""
    ) {
        const message =
            fallbackMessage ||
            report.errors
                .map(item => item.message)
                .join(" ") ||
            "El perfil no es válido.";

        const error =
            createError(
                "PROFILE_VALIDATION_FAILED",
                message
            );

        error.report = report;

        return error;
    }

    function createError(
        code,
        message
    ) {
        const error =
            new Error(message);

        error.name =
            "ProfileValidationError";

        error.code = code;

        return error;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        validate,
        validateForDraft,
        validateForPrompt,

        assertValid,
        assertReadyForPrompt,

        constants: Object.freeze({
            VALIDATION_LEVELS,
            PROFILE_STATUS,
            MINIMUM_IDENTITY_COMPLETENESS,
            MINIMUM_REFERENCE_PHOTOS
        })
    });

})();

window.ProfileValidation = ProfileValidation;
