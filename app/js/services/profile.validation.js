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

    const RULE_DEFINITIONS = Object.freeze({
        PROFILE_ID_MISSING: rule("profile", VALIDATION_LEVELS.WARNING),
        PROFILE_NAME_REQUIRED: rule("profile", VALIDATION_LEVELS.ERROR),
        IDENTITY_STRUCTURE_MISSING: rule("identity", VALIDATION_LEVELS.ERROR),
        DIRECTION_STRUCTURE_MISSING: rule("direction", VALIDATION_LEVELS.ERROR),
        INVALID_CREATED_AT: rule("profile", VALIDATION_LEVELS.WARNING),
        INVALID_UPDATED_AT: rule("profile", VALIDATION_LEVELS.WARNING),
        INVALID_PROFILE_VERSION: rule("profile", VALIDATION_LEVELS.WARNING),
        REFERENCE_PHOTO_REQUIRED: rule("photos", VALIDATION_LEVELS.ERROR),
        PHOTO_LIMIT_EXCEEDED: rule("photos", VALIDATION_LEVELS.ERROR),
        INVALID_PHOTO_OBJECT: rule("photos", VALIDATION_LEVELS.ERROR),
        PHOTO_ID_REQUIRED: rule("photos", VALIDATION_LEVELS.ERROR),
        DUPLICATED_PHOTO_ID: rule("photos", VALIDATION_LEVELS.ERROR),
        PHOTO_SOURCE_MISSING: rule("photos", VALIDATION_LEVELS.ERROR),
        PHOTO_THUMBNAIL_MISSING: rule("photos", VALIDATION_LEVELS.WARNING),
        PHOTO_DIMENSIONS_MISSING: rule("photos", VALIDATION_LEVELS.WARNING),
        PHOTO_QUALITY_INSUFFICIENT: rule("photos", VALIDATION_LEVELS.WARNING),
        MULTIPLE_PRIMARY_PHOTOS: rule("photos", VALIDATION_LEVELS.ERROR),
        PRIMARY_PHOTO_REQUIRED: rule("photos", VALIDATION_LEVELS.ERROR),
        IDENTITY_SUMMARY_REQUIRED: rule("identity", VALIDATION_LEVELS.ERROR),
        AGE_APPEARANCE_MISSING: rule("identity", VALIDATION_LEVELS.WARNING),
        IDENTITY_INCOMPLETE: rule("identity", VALIDATION_LEVELS.ERROR),
        IDENTITY_NOT_LOCKED: rule("identity", VALIDATION_LEVELS.ERROR),
        IDENTITY_STATUS_INCONSISTENT: rule("identity", VALIDATION_LEVELS.WARNING),
        IDENTITY_SECTIONS_MISSING: rule("identity", VALIDATION_LEVELS.WARNING),
        INVALID_IDENTITY_SECTION: rule("identity", VALIDATION_LEVELS.WARNING),
        INVALID_SOURCE_PHOTO_IDS: rule("identity", VALIDATION_LEVELS.WARNING),
        CREATIVE_OBJECTIVE_REQUIRED: rule("direction", VALIDATION_LEVELS.ERROR),
        OUTPUT_FORMAT_MISSING: rule("direction", VALIDATION_LEVELS.WARNING),
        DIRECTION_NOT_READY: rule("direction", VALIDATION_LEVELS.ERROR),
        EXPRESSION_MISSING: rule("direction", VALIDATION_LEVELS.WARNING),
        WARDROBE_MISSING: rule("direction", VALIDATION_LEVELS.WARNING),
        UNKNOWN_SOURCE_PHOTO: rule("contract", VALIDATION_LEVELS.WARNING),
        LOCKED_IDENTITY_WITHOUT_PHOTOS: rule("contract", VALIDATION_LEVELS.WARNING)
    });

    function rule(section, severity) {
        return Object.freeze({
            section,
            severity,
            enabled: true
        });
    }

    /* ========================================================
       VALIDACIÓN PRINCIPAL
       ======================================================== */

    function validate(profile, options = {}) {
        validateProfileObject(profile);

        const config =
            normalizeOptions(options);

        const findings = [];

        Object.defineProperties(findings, {
            ruleConfig: {
                value: config.rules,
                enumerable: false
            }
        });

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

    function getGenerationReadiness(profileOrId = null, options = {}) {
        const profile = resolveProfileForReadiness(profileOrId);
        const report = validateForPrompt(profile);

        return deepFreeze(clone({
            ready: report.ready === true,
            valid: report.valid === true,
            status: report.ready
                ? "ready"
                : report.summary.errorCount > 0
                    ? "blocked"
                    : "warning",
            score: report.score,
            profileId: profile.id || profile.profileId || null,
            profileName: profile.name || profile.profileName || "",
            summary: {
                blockers: report.summary.errorCount,
                errors: report.summary.errorCount,
                warnings: report.summary.warningCount,
                info: report.summary.infoCount,
                total: report.summary.totalFindings
            },
            blockers: clone(report.errors),
            errors: clone(report.errors),
            warnings: clone(report.warnings),
            info: clone(report.information),
            information: clone(report.information),
            recommendations: clone([
                ...report.warnings,
                ...report.information
            ]),
            rules: clone(report.rules),
            generatedAt: report.validatedAt,
            report: options.includeReport === true ? clone(report) : undefined
        }));
    }

    function resolveProfileForReadiness(profileOrId) {
        if (profileOrId && typeof profileOrId === "object" && !Array.isArray(profileOrId)) {
            return profileOrId;
        }

        const activeProfile =
            typeof window !== "undefined" &&
            window.ProfileService &&
            typeof ProfileService.getActive === "function"
                ? ProfileService.getActive()
                : null;

        if (!activeProfile) {
            throw createError(
                "PROFILE_REQUIRED",
                "No existe ningún perfil activo para validar."
            );
        }

        if (
            typeof profileOrId === "string" &&
            normalizeText(profileOrId) &&
            activeProfile.id !== profileOrId &&
            activeProfile.profileId !== profileOrId
        ) {
            throw createError(
                "PROFILE_NOT_ACTIVE",
                "El perfil solicitado no coincide con el perfil activo."
            );
        }

        return activeProfile;
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

        validateIdentityEvidence(
            profile,
            findings
        );
    }

    function validateIdentityEvidence(
        profile,
        findings
    ) {
        if (!window.ProfileIdentity?.getEvidenceState) return;

        const identity = profile.identity;
        const evidenceState =
            ProfileIdentity.getEvidenceState(profile);
        const legacyContract =
            identity.evidenceLegacy === true ||
            (identity.locked === true && !identity.lockedEvidenceVersion);

        if (legacyContract) {
            addFinding(
                findings,
                VALIDATION_LEVELS.WARNING,
                "IDENTITY_EVIDENCE_LEGACY",
                "La identidad usa referencias históricas todavía no verificadas por checksum.",
                "profile.identity.evidence"
            );
        } else if (
            evidenceState.score <
            ProfileIdentity.constants.MINIMUM_EVIDENCE_COVERAGE
        ) {
            addFinding(
                findings,
                VALIDATION_LEVELS.ERROR,
                "IDENTITY_EVIDENCE_COVERAGE_INSUFFICIENT",
                `La cobertura visual es ${evidenceState.score} %; se requiere al menos ${ProfileIdentity.constants.MINIMUM_EVIDENCE_COVERAGE} % y cubrir todas las secciones críticas.`,
                "profile.identity.evidence"
            );
        }

        Object.entries(evidenceState.sections).forEach(
            ([sectionName, section]) => {
                section.evidence.forEach(record => {
                    if (record.integrity === "legacy_unverified") {
                        addFinding(
                            findings,
                            VALIDATION_LEVELS.WARNING,
                            "IDENTITY_EVIDENCE_LEGACY_UNVERIFIED",
                            `La evidencia de "${sectionName}" no tiene checksum verificable.`,
                            `profile.identity.evidence.${sectionName}`
                        );
                    } else if (["missing", "checksum_mismatch", "wrong_profile"].includes(record.integrity)) {
                        addFinding(
                            findings,
                            legacyContract
                                ? VALIDATION_LEVELS.WARNING
                                : VALIDATION_LEVELS.ERROR,
                            `IDENTITY_EVIDENCE_${record.integrity.toUpperCase()}`,
                            `La evidencia de "${sectionName}" tiene estado ${record.integrity}.`,
                            `profile.identity.evidence.${sectionName}`
                        );
                    }
                });
            }
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

        const rules =
            buildRuleResults(findings);

        const score =
            calculateScore(rules);

        return {
            valid,
            ready,
            status,
            score,

            summary: {
                errorCount:
                    errors.length,
                warningCount:
                    warnings.length,
                infoCount:
                    information.length,
                totalFindings:
                    findings.length,
                errors:
                    errors.length,
                warnings:
                    warnings.length,
                info:
                    information.length
            },

            errors,
            warnings,
            information,

            rules,

            findings:
                clone(Array.from(findings)),

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
        const configuredRule =
            findings.ruleConfig?.[code];

        if (configuredRule?.enabled === false) {
            return;
        }

        const configuredLevel =
            normalizeLevel(
                configuredRule?.severity
            );

        findings.push({
            id: code,
            level:
                configuredLevel || level,
            severity:
                configuredLevel || level,
            code,
            message,
            path,
            section:
                configuredRule?.section ||
                RULE_DEFINITIONS[code]?.section ||
                "profile"
        });
    }

    function buildRuleResults(findings) {
        const findingsByCode =
            new Map();

        findings.forEach(item => {
            if (!findingsByCode.has(item.code)) {
                findingsByCode.set(item.code, []);
            }

            findingsByCode.get(item.code).push(item);
        });

        const config =
            findings.ruleConfig || {};

        return Object.entries(RULE_DEFINITIONS)
            .map(([id, definition]) => {
                const override =
                    config[id] || {};

                const enabled =
                    override.enabled !== false;

                const severity =
                    normalizeLevel(override.severity) ||
                    definition.severity;

                const matches =
                    findingsByCode.get(id) || [];

                return {
                    id,
                    section:
                        override.section ||
                        definition.section,
                    severity,
                    enabled,
                    passed:
                        enabled && matches.length === 0,
                    findingCount:
                        matches.length,
                    findings:
                        clone(matches)
                };
            });
    }

    function calculateScore(rules) {
        const penalties = Object.freeze({
            error: 20,
            warning: 7,
            info: 2
        });

        const penalty = rules
            .filter(ruleResult =>
                ruleResult.enabled &&
                !ruleResult.passed
            )
            .reduce((total, ruleResult) => {
                return total +
                    (penalties[ruleResult.severity] || 0) *
                    Math.max(1, ruleResult.findingCount);
            }, 0);

        return Math.max(0, 100 - penalty);
    }

    function normalizeLevel(value) {
        const level =
            normalizeText(value).toLowerCase();

        return Object.values(VALIDATION_LEVELS)
            .includes(level)
                ? level
                : "";
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
                true,

            rules:
                normalizeRuleOverrides(
                    source.rules
                )
        };
    }

    function normalizeRuleOverrides(value) {
        const source =
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
                ? value
                : {};

        return Object.fromEntries(
            Object.entries(source)
                .filter(([id]) =>
                    Object.prototype.hasOwnProperty.call(
                        RULE_DEFINITIONS,
                        id
                    )
                )
                .map(([id, override]) => {
                    const safeOverride =
                        override &&
                        typeof override === "object" &&
                        !Array.isArray(override)
                            ? override
                            : {};

                    return [id, {
                        enabled:
                            safeOverride.enabled !== false,
                        severity:
                            normalizeLevel(
                                safeOverride.severity
                            ) ||
                            RULE_DEFINITIONS[id].severity,
                        section:
                            normalizeText(
                                safeOverride.section
                            ) ||
                            RULE_DEFINITIONS[id].section
                    }];
                })
        );
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

    function deepFreeze(value) {
        if (
            !value ||
            typeof value !== "object" ||
            Object.isFrozen(value)
        ) {
            return value;
        }

        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
        return value;
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
        getGenerationReadiness,

        assertValid,
        assertReadyForPrompt,

        constants: Object.freeze({
            VALIDATION_LEVELS,
            PROFILE_STATUS,
            MINIMUM_IDENTITY_COMPLETENESS,
            MINIMUM_REFERENCE_PHOTOS,
            RULE_DEFINITIONS
        })
    });

})();

window.ProfileValidation = ProfileValidation;
