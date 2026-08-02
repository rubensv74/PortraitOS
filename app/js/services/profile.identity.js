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

    const EVIDENCE_VERSION =
        "portraitos.identity-evidence.v1";

    const EVIDENCE_INTEGRITY = Object.freeze({
        VALID: "valid",
        MISSING: "missing",
        CHECKSUM_MISMATCH: "checksum_mismatch",
        LEGACY_UNVERIFIED: "legacy_unverified",
        WRONG_PROFILE: "wrong_profile"
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

    const EVIDENCE_WEIGHTS = Object.freeze({
        general: 4,
        face: 15,
        skin: 12,
        hair: 10,
        eyes: 12,
        nose: 10,
        mouth: 10,
        jaw: 10,
        "facial-hair": 1,
        "age-markers": 2,
        asymmetries: 3,
        "distinctive-features": 11
    });

    const CRITICAL_EVIDENCE_SECTIONS = Object.freeze([
        "face",
        "eyes",
        "nose",
        "mouth",
        "jaw",
        "skin",
        "hair",
        "distinctive-features"
    ]);

    const MINIMUM_EVIDENCE_COVERAGE = 75;

    const DEFAULT_IDENTITY = Object.freeze({
        status: IDENTITY_STATUS.DRAFT,
        locked: false,
        lockedAt: null,
        lockedBy: null,
        lockedEvidenceVersion: null,

        evidenceVersion: EVIDENCE_VERSION,
        evidence: createEmptyEvidenceMap(),

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

        const sourceIdentity =
            profile.identity;

        const hadEvidenceContract =
            sourceIdentity.evidenceVersion ===
                EVIDENCE_VERSION &&
            sourceIdentity.evidence &&
            typeof sourceIdentity.evidence === "object";

        const identity =
            mergeIdentity(
                clone(DEFAULT_IDENTITY),
                sourceIdentity
            );

        identity.photos = currentPhotos;
        identity.evidenceVersion = EVIDENCE_VERSION;
        identity.evidenceLegacy =
            sourceIdentity.evidenceLegacy === true ||
            !hadEvidenceContract;

        normalizeEvidence(
            profile,
            identity
        );

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
       EVIDENCIAS DE IDENTIDAD
       ======================================================== */

    function linkEvidence(
        profile,
        sectionName,
        photoId,
        options = {}
    ) {
        const identity = getMutableIdentity(profile);
        assertUnlocked(identity);

        const section = normalizeSectionName(sectionName);
        const normalizedPhotoId = normalizeText(photoId);
        const photo = getPhoto(profile, normalizedPhotoId);

        if (!photo) {
            throw createError(
                "IDENTITY_EVIDENCE_PHOTO_NOT_FOUND",
                "La fotografía indicada no existe en el perfil activo."
            );
        }

        const evidence = identity.evidence[section];
        const existing = evidence.find(
            item => item.photoId === normalizedPhotoId
        );
        const now = new Date().toISOString();
        const record = {
            photoId: normalizedPhotoId,
            checksum: normalizeText(photo.checksum),
            profileId: normalizeText(profile.id),
            role: photo.isPrimary === true
                ? "primary"
                : "reference",
            note: normalizeText(options.note).slice(0, 160),
            createdAt: existing?.createdAt || now
        };

        if (existing) {
            Object.assign(existing, record);
        } else {
            evidence.push(record);
        }

        syncLegacySourcePhotoIds(identity, section);
        identity.evidenceLegacy = false;
        markUpdated(profile);

        return clone(record);
    }

    function unlinkEvidence(
        profile,
        sectionName,
        photoId
    ) {
        const identity = getMutableIdentity(profile);
        assertUnlocked(identity);
        const section = normalizeSectionName(sectionName);
        const normalizedPhotoId = normalizeText(photoId);
        const index = identity.evidence[section].findIndex(
            item => item.photoId === normalizedPhotoId
        );

        if (index < 0) {
            throw createError(
                "IDENTITY_EVIDENCE_NOT_FOUND",
                "La evidencia indicada no está vinculada a esta sección."
            );
        }

        const removed = identity.evidence[section].splice(index, 1)[0];
        syncLegacySourcePhotoIds(identity, section);
        markUpdated(profile);
        return clone(removed);
    }

    function getEvidence(
        profile,
        sectionName = null
    ) {
        const identity = getIdentity(profile);

        if (sectionName !== null) {
            const section = normalizeSectionName(sectionName);
            return clone(identity.evidence[section]);
        }

        return clone(identity.evidence);
    }

    function getEvidenceState(profile) {
        const identity = getIdentity(profile);
        const photos = Array.isArray(identity.photos)
            ? identity.photos
            : [];
        const sections = {};
        const missingSections = [];
        const criticalMissingSections = [];
        let score = 0;
        let validEvidenceCount = 0;
        let invalidEvidenceCount = 0;
        let legacyEvidenceCount = 0;
        let totalEvidenceCount = 0;

        Object.keys(EVIDENCE_WEIGHTS).forEach(section => {
            const entries = identity.evidence[section].map(record => {
                const integrity = getEvidenceIntegrity(
                    profile,
                    record,
                    photos
                );

                totalEvidenceCount += 1;
                if (integrity === EVIDENCE_INTEGRITY.VALID) validEvidenceCount += 1;
                else if (integrity === EVIDENCE_INTEGRITY.LEGACY_UNVERIFIED) legacyEvidenceCount += 1;
                else invalidEvidenceCount += 1;

                return { ...clone(record), integrity };
            });
            const covered = entries.some(
                entry => entry.integrity === EVIDENCE_INTEGRITY.VALID
            );

            if (covered) score += EVIDENCE_WEIGHTS[section];
            else {
                missingSections.push(section);
                if (CRITICAL_EVIDENCE_SECTIONS.includes(section)) {
                    criticalMissingSections.push(section);
                }
            }

            sections[section] = {
                weight: EVIDENCE_WEIGHTS[section],
                critical: CRITICAL_EVIDENCE_SECTIONS.includes(section),
                covered,
                evidence: entries
            };
        });

        const criticalInvalid = CRITICAL_EVIDENCE_SECTIONS.some(
            section => sections[section].evidence.some(
                entry => ![
                    EVIDENCE_INTEGRITY.VALID,
                    EVIDENCE_INTEGRITY.LEGACY_UNVERIFIED
                ].includes(entry.integrity)
            )
        );
        const hasPrimaryPhoto = photos.some(photo => photo.isPrimary === true);

        return clone({
            score,
            coveredSections: Object.keys(EVIDENCE_WEIGHTS).length - missingSections.length,
            requiredSections: Object.keys(EVIDENCE_WEIGHTS).length,
            missingSections,
            criticalMissingSections,
            invalidEvidenceCount,
            legacyEvidenceCount,
            validEvidenceCount,
            totalEvidenceCount,
            hasPrimaryPhoto,
            readyForLock:
                score >= MINIMUM_EVIDENCE_COVERAGE &&
                criticalMissingSections.length === 0 &&
                !criticalInvalid &&
                hasPrimaryPhoto,
            sections
        });
    }

    function getEvidenceIntegrity(profile, record, photos = null) {
        if (
            record.profileId &&
            record.profileId !== profile.id
        ) return EVIDENCE_INTEGRITY.WRONG_PROFILE;

        const collection = photos || profile.identity?.photos || [];
        const photo = collection.find(item => item.id === record.photoId);
        if (!photo) return EVIDENCE_INTEGRITY.MISSING;

        const evidenceChecksum = normalizeText(record.checksum);
        const photoChecksum = normalizeText(photo.checksum);
        if (!evidenceChecksum || !photoChecksum) {
            return EVIDENCE_INTEGRITY.LEGACY_UNVERIFIED;
        }
        if (evidenceChecksum !== photoChecksum) {
            return EVIDENCE_INTEGRITY.CHECKSUM_MISMATCH;
        }
        return EVIDENCE_INTEGRITY.VALID;
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

    function lock(profile, options = {}) {
        const identity =
            getMutableIdentity(profile);

        if (options.confirm !== true) {
            throw createError(
                "LOCK_CONFIRMATION_REQUIRED",
                "Se requiere confirmación explícita para bloquear la identidad."
            );
        }

        if (
            identity.status !==
            IDENTITY_STATUS.VALIDATED
        ) {
            throw createError(
                "IDENTITY_NOT_VALIDATED",
                "La identidad debe validarse antes de bloquearla."
            );
        }

        const evidenceState =
            getEvidenceState(profile);

        if (!evidenceState.hasPrimaryPhoto) {
            throw createError(
                "IDENTITY_PRIMARY_PHOTO_REQUIRED",
                "Se necesita una fotografía principal para bloquear la identidad."
            );
        }

        if (!evidenceState.readyForLock) {
            throw createError(
                "IDENTITY_EVIDENCE_NOT_READY",
                "La cobertura visual o la integridad de evidencias no permite bloquear la identidad."
            );
        }

        const now =
            new Date().toISOString();

        identity.locked = true;
        identity.lockedAt = now;
        identity.lockedBy =
            normalizeText(options.lockedBy);
        identity.lockedEvidenceVersion =
            EVIDENCE_VERSION;

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
        identity.lockedEvidenceVersion = null;

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

        const evidenceState =
            getEvidenceState(profile);

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

            evidence: {
                version: EVIDENCE_VERSION,
                coverage: evidenceState.score,
                verified: evidenceState.readyForLock,
                validEvidenceCount:
                    evidenceState.validEvidenceCount,
                coveredSections:
                    Object.entries(evidenceState.sections)
                        .filter(([, value]) => value.covered)
                        .map(([name]) => name)
            },

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

    function createEmptyEvidenceMap() {
        return Object.values(IDENTITY_SECTIONS).reduce(
            (result, section) => {
                result[section] = [];
                return result;
            },
            {}
        );
    }

    function normalizeEvidence(profile, identity) {
        const source = identity.evidence &&
            typeof identity.evidence === "object"
            ? identity.evidence
            : {};
        const normalized = createEmptyEvidenceMap();

        Object.keys(normalized).forEach(section => {
            const seen = new Set();
            const records = Array.isArray(source[section])
                ? source[section]
                : [];

            records.forEach(record => {
                const photoId = normalizeText(record?.photoId);
                if (!photoId || seen.has(photoId)) return;
                seen.add(photoId);
                normalized[section].push({
                    photoId,
                    checksum: normalizeText(record.checksum),
                    profileId: normalizeText(record.profileId),
                    role: record.role === "primary" ? "primary" : "reference",
                    note: normalizeText(record.note),
                    createdAt: normalizeText(record.createdAt) || new Date().toISOString()
                });
            });

            const legacyIds = normalizeIds(
                identity.sections[section]?.sourcePhotoIds
            );
            legacyIds.forEach(photoId => {
                if (seen.has(photoId)) return;
                seen.add(photoId);
                normalized[section].push({
                    photoId,
                    checksum: "",
                    profileId: normalizeText(profile.id),
                    role: "reference",
                    note: "",
                    createdAt: identity.sections[section]?.updatedAt || identity.createdAt || new Date().toISOString()
                });
            });
        });

        identity.evidence = normalized;
        Object.keys(normalized).forEach(
            section => syncLegacySourcePhotoIds(identity, section)
        );
    }

    function syncLegacySourcePhotoIds(identity, section) {
        identity.sections[section].sourcePhotoIds =
            identity.evidence[section].map(record => record.photoId);
    }

    function getPhoto(profile, photoId) {
        return (profile.identity?.photos || []).find(
            photo => photo.id === photoId
        ) || null;
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

        linkEvidence,
        unlinkEvidence,
        getEvidence,
        getEvidenceState,
        getEvidenceIntegrity,

        recalculateValidation,
        validate,

        lock,
        unlock,
        isLocked,

        buildIdentityContract,

        constants: Object.freeze({
            IDENTITY_STATUS,
            CONFIDENCE_LEVELS,
            IDENTITY_SECTIONS,
            EVIDENCE_VERSION,
            EVIDENCE_INTEGRITY,
            EVIDENCE_WEIGHTS,
            CRITICAL_EVIDENCE_SECTIONS,
            MINIMUM_EVIDENCE_COVERAGE
        })
    });

})();

window.ProfileIdentity = ProfileIdentity;
