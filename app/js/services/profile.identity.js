"use strict";

/* ============================================================
   PortraitOS
   Profile Identity Service
   ------------------------------------------------------------
   Responsabilidad:
   - Gestionar la identidad visual permanente del perfil.
   - Registrar rasgos inmutables.
   - Mantener observaciones y nivel de confianza.
   - Bloquear la identidad cuando esté validada.
   - No gestiona fotografías.
   - No gestiona dirección creativa.
   ============================================================ */

const ProfileIdentity = (() => {

    const IDENTITY_STATUS = Object.freeze({
        DRAFT: "draft",
        REVIEW: "review",
        VALIDATED: "validated",
        LOCKED: "locked"
    });

    const CONFIDENCE_LEVELS = Object.freeze({
        UNKNOWN: "unknown",
        LOW: "low",
        MEDIUM: "medium",
        HIGH: "high",
        VERIFIED: "verified"
    });

    const IDENTITY_SECTIONS = Object.freeze({
        GENERAL: "general",
        FACE: "face",
        SKIN: "skin",
        HAIR: "hair",
        EYES: "eyes",
        NOSE: "nose",
        MOUTH: "mouth",
        JAW: "jaw",
        FACIAL_HAIR: "facial-hair",
        AGE_MARKERS: "age-markers",
        ASYMMETRIES: "asymmetries",
        DISTINCTIVE_FEATURES: "distinctive-features"
    });

    const DEFAULT_IDENTITY = Object.freeze({
        status: IDENTITY_STATUS.DRAFT,
        locked: false,
        lockedAt: null,
        lockedBy: null,

        summary: "",
        ageAppearance: "",
        genderPresentation: "",

        sections: {
            general: createEmptySection(),
            face: createEmptySection(),
            skin: createEmptySection(),
            hair: createEmptySection(),
            eyes: createEmptySection(),
            nose: createEmptySection(),
            mouth: createEmptySection(),
            jaw: createEmptySection(),
            "facial-hair": createEmptySection(),
            "age-markers": createEmptySection(),
            asymmetries: createEmptySection(),
            "distinctive-features": createEmptySection()
        },

        validation: {
            completeness: 0,
            missingSections: [],
            warnings: [],
            validatedAt: null,
            validatedBy: null
        },

        createdAt: null,
        updatedAt: null
    });

    /* ========================================================
       INICIALIZACIÓN
       ======================================================== */

    function initialize(profile) {
        validateProfile(profile);

        if (
            !profile.identity ||
            typeof profile.identity !== "object" ||
            Array.isArray(profile.identity)
        ) {
            profile.identity = {};
        }

        const currentPhotos =
            Array.isArray(profile.identity.photos)
                ? profile.identity.photos
                : [];

        const identity =
            mergeIdentity(
                clone(DEFAULT_IDENTITY),
                profile.identity
            );

        identity.photos = currentPhotos;

        const now =
            new Date().toISOString();

        identity.createdAt =
            identity.createdAt || now;

        identity.updatedAt =
            identity.updatedAt || now;

        profile.identity = identity;

        recalculateValidation(profile);

        return clone(identity);
    }

    function reset(profile, options = {}) {
        validateProfile(profile);

        const preservePhotos =
            options.preservePhotos !== false;

        const photos =
            preservePhotos &&
            Array.isArray(profile.identity?.photos)
                ? profile.identity.photos
                : [];

        profile.identity =
            clone(DEFAULT_IDENTITY);

        profile.identity.photos = photos;

        const now =
            new Date().toISOString();

        profile.identity.createdAt = now;
        profile.identity.updatedAt = now;

        touchProfile(profile);

        return clone(profile.identity);
    }

    /* ========================================================
       DATOS GENERALES
       ======================================================== */

    function updateGeneral(profile, changes = {}) {
        const identity =
            getMutableIdentity(profile);

        assertUnlocked(identity);

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "summary"
            )
        ) {
            identity.summary =
                normalizeText(changes.summary);
        }

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "ageAppearance"
            )
        ) {
            identity.ageAppearance =
                normalizeText(
                    changes.ageAppearance
                );
        }

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "genderPresentation"
            )
        ) {
            identity.genderPresentation =
                normalizeText(
                    changes.genderPresentation
                );
        }

        markUpdated(profile);

        return clone(identity);
    }

    /* ========================================================
       SECCIONES DE IDENTIDAD
       ======================================================== */

    function updateSection(
        profile,
        sectionName,
        changes = {}
    ) {
        const identity =
            getMutableIdentity(profile);

        assertUnlocked(identity);

        const normalizedSection =
            normalizeSectionName(sectionName);

        const section =
            identity.sections[normalizedSection];

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "description"
            )
        ) {
            section.description =
                normalizeText(
                    changes.description
                );
        }

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "confidence"
            )
        ) {
            section.confidence =
                normalizeConfidence(
                    changes.confidence
                );
        }

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "sourcePhotoIds"
            )
        ) {
            section.sourcePhotoIds =
                normalizeIds(
                    changes.sourcePhotoIds
                );
        }

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "notes"
            )
        ) {
            section.notes =
                normalizeText(
                    changes.notes
                );
        }

        section.updatedAt =
            new Date().toISOString();

        markUpdated(profile);

        return clone(section);
    }

    function clearSection(
        profile,
        sectionName
    ) {
        const identity =
            getMutableIdentity(profile);

        assertUnlocked(identity);

        const normalizedSection =
            normalizeSectionName(sectionName);

        identity.sections[normalizedSection] =
            createEmptySection();

        identity.sections[
            normalizedSection
        ].updatedAt =
            new Date().toISOString();

        markUpdated(profile);

        return clone(
            identity.sections[
                normalizedSection
            ]
        );
    }

    function getSection(
        profile,
        sectionName
    ) {
        const identity =
            getIdentity(profile);

        const normalizedSection =
            normalizeSectionName(sectionName);

        return clone(
            identity.sections[
                normalizedSection
            ]
        );
    }

    function listSections(profile) {
        const identity =
            getIdentity(profile);

        return Object.entries(
            identity.sections
        ).map(
            ([name, section]) => ({
                name,
                ...clone(section)
            })
        );
    }

    /* ========================================================
       VALIDACIÓN
       ======================================================== */

    function recalculateValidation(profile) {
        const identity =
            getMutableIdentity(profile);

        const sectionNames =
            Object.values(
                IDENTITY_SECTIONS
            );

        const completedSections =
            sectionNames.filter(
                name =>
                    isSectionComplete(
                        identity.sections[name]
                    )
            );

        const missingSections =
            sectionNames.filter(
                name =>
                    !isSectionComplete(
                        identity.sections[name]
                    )
            );

        const warnings = [];

        if (!identity.summary) {
            warnings.push(
                "Falta el resumen general de identidad."
            );
        }

        if (!identity.ageAppearance) {
            warnings.push(
                "No se ha definido la edad aparente."
            );
        }

        if (
            identity.sections.face.confidence ===
            CONFIDENCE_LEVELS.LOW
        ) {
            warnings.push(
                "La descripción facial tiene baja confianza."
            );
        }

        const completeness =
            Math.round(
                (
                    completedSections.length /
                    sectionNames.length
                ) * 100
            );

        identity.validation.completeness =
            completeness;

        identity.validation.missingSections =
            missingSections;

        identity.validation.warnings =
            warnings;

        return clone(
            identity.validation
        );
    }

    function validate(profile, validatedBy = "") {
        const identity =
            getMutableIdentity(profile);

        assertUnlocked(identity);

        const validation =
            recalculateValidation(profile);

        if (
            validation.completeness < 70
        ) {
            throw createError(
                "IDENTITY_INCOMPLETE",
                "La identidad debe alcanzar al menos un 70 % de completitud."
            );
        }

        if (!identity.summary) {
            throw createError(
                "SUMMARY_REQUIRED",
                "El resumen de identidad es obligatorio."
            );
        }

        const now =
            new Date().toISOString();

        identity.status =
            IDENTITY_STATUS.VALIDATED;

        identity.validation.validatedAt =
            now;

        identity.validation.validatedBy =
            normalizeText(validatedBy);

        identity.updatedAt = now;

        touchProfile(profile);

        return clone(identity);
    }

    /* ========================================================
       BLOQUEO DE IDENTIDAD
       ======================================================== */

    function lock(profile, lockedBy = "") {
        const identity =
            getMutableIdentity(profile);

        if (
            identity.status !==
            IDENTITY_STATUS.VALIDATED
        ) {
            throw createError(
                "IDENTITY_NOT_VALIDATED",
                "La identidad debe validarse antes de bloquearla."
            );
        }

        const now =
            new Date().toISOString();

        identity.locked = true;
        identity.lockedAt = now;
        identity.lockedBy =
            normalizeText(lockedBy);

        identity.status =
            IDENTITY_STATUS.LOCKED;

        identity.updatedAt = now;

        touchProfile(profile);

        return clone(identity);
    }

    function unlock(
        profile,
        options = {}
    ) {
        const identity =
            getMutableIdentity(profile);

        if (!identity.locked) {
            return clone(identity);
        }

        if (
            options.confirm !== true
        ) {
            throw createError(
                "UNLOCK_CONFIRMATION_REQUIRED",
                "Se requiere confirmación explícita para desbloquear la identidad."
            );
        }

        identity.locked = false;
        identity.lockedAt = null;
        identity.lockedBy = null;

        identity.status =
            IDENTITY_STATUS.REVIEW;

        markUpdated(profile);

        return clone(identity);
    }

    function isLocked(profile) {
        return getIdentity(profile).locked === true;
    }

    /* ========================================================
       CONSULTAS
       ======================================================== */

    function get(profile) {
        return clone(
            getIdentity(profile)
        );
    }

    function getSummary(profile) {
        const identity =
            getIdentity(profile);

        return {
            status:
                identity.status,

            locked:
                identity.locked,

            completeness:
                identity.validation
                    .completeness,

            missingSections:
                clone(
                    identity.validation
                        .missingSections
                ),

            warningCount:
                identity.validation
                    .warnings.length,

            completedSections:
                Object.values(
                    identity.sections
                ).filter(
                    isSectionComplete
                ).length,

            totalSections:
                Object.keys(
                    identity.sections
                ).length
        };
    }

    function buildIdentityContract(profile) {
        const identity =
            getIdentity(profile);

        const traits =
            Object.entries(
                identity.sections
            )
                .filter(
                    ([, section]) =>
                        isSectionComplete(
                            section
                        )
                )
                .map(
                    ([name, section]) => ({
                        category: name,
                        description:
                            section.description,
                        confidence:
                            section.confidence
                    })
                );

        return {
            immutable: true,

            status:
                identity.status,

            summary:
                identity.summary,

            ageAppearance:
                identity.ageAppearance,

            genderPresentation:
                identity.genderPresentation,

            traits,

            constraints: [
                "No modificar la edad aparente.",
                "No alterar las proporciones faciales.",
                "No eliminar arrugas, canas, textura o asimetrías.",
                "No sustituir ni reinterpretar la identidad.",
                "No modificar ojos, nariz, boca, mandíbula o estructura facial."
            ]
        };
    }

    /* ========================================================
       UTILIDADES INTERNAS
       ======================================================== */

    function createEmptySection() {
        return {
            description: "",
            confidence:
                CONFIDENCE_LEVELS.UNKNOWN,
            sourcePhotoIds: [],
            notes: "",
            updatedAt: null
        };
    }

    function mergeIdentity(
        target,
        source
    ) {
        const result = {
            ...target,
            ...source
        };

        result.validation = {
            ...target.validation,
            ...(source.validation || {})
        };

        result.sections = {
            ...target.sections
        };

        Object.keys(
            target.sections
        ).forEach(name => {
            result.sections[name] = {
                ...target.sections[name],
                ...(
                    source.sections?.[name] ||
                    {}
                )
            };
        });

        return result;
    }

    function isSectionComplete(section) {
        return Boolean(
            section &&
            normalizeText(
                section.description
            )
        );
    }

    function normalizeSectionName(value) {
        const normalized =
            String(value || "")
                .trim()
                .toLowerCase();

        if (
            !Object.values(
                IDENTITY_SECTIONS
            ).includes(normalized)
        ) {
            throw createError(
                "INVALID_IDENTITY_SECTION",
                "La sección de identidad indicada no existe."
            );
        }

        return normalized;
    }

    function normalizeConfidence(value) {
        const normalized =
            String(value || "")
                .trim()
                .toLowerCase();

        return Object.values(
            CONFIDENCE_LEVELS
        ).includes(normalized)
            ? normalized
            : CONFIDENCE_LEVELS.UNKNOWN;
    }

    function normalizeIds(values) {
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

    function getIdentity(profile) {
        validateProfile(profile);

        if (
            !profile.identity ||
            typeof profile.identity !==
                "object"
        ) {
            initialize(profile);
        }

        return profile.identity;
    }

    function getMutableIdentity(profile) {
        return getIdentity(profile);
    }

    function assertUnlocked(identity) {
        if (identity.locked) {
            throw createError(
                "IDENTITY_LOCKED",
                "La identidad está bloqueada y no puede modificarse."
            );
        }
    }

    function markUpdated(profile) {
        const identity =
            getMutableIdentity(profile);

        identity.updatedAt =
            new Date().toISOString();

        if (
            identity.status ===
            IDENTITY_STATUS.VALIDATED
        ) {
            identity.status =
                IDENTITY_STATUS.REVIEW;

            identity.validation.validatedAt =
                null;

            identity.validation.validatedBy =
                null;
        }

        recalculateValidation(profile);

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
            "ProfileIdentityError";

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
        updateSection,
        clearSection,

        get,
        getSection,
        listSections,
        getSummary,

        recalculateValidation,
        validate,

        lock,
        unlock,
        isLocked,

        buildIdentityContract,

        constants: Object.freeze({
            IDENTITY_STATUS,
            CONFIDENCE_LEVELS,
            IDENTITY_SECTIONS
        })
    });

})();

window.ProfileIdentity = ProfileIdentity;
