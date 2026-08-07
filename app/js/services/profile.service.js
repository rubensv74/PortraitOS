"use strict";

/* ============================================================
   PortraitOS
   Profile Service
   ------------------------------------------------------------
   Fachada principal del dominio Profile.

   Responsabilidad:
   - Crear y gestionar el perfil activo.
   - Unificar fotografías, identidad y dirección creativa.
   - Coordinar validación, persistencia e importación/exportación.
   - Evitar que la interfaz acceda directamente a servicios internos.
   ============================================================ */

const ProfileService = (() => {

    const PROFILE_VERSION = "1.0.0";

    let activeProfile = null;

    /* ========================================================
       CICLO DE VIDA
       ======================================================== */

    function create(data = {}) {
        validateDependencies();

        const now =
            new Date().toISOString();

        const profile = {
            id:
                normalizeText(data.id) ||
                createProfileId(),

            name:
                normalizeText(data.name) ||
                "Nuevo perfil",

            description:
                normalizeText(data.description),

            version:
                PROFILE_VERSION,

            tags:
                normalizeList(data.tags),

            identity: {
                photos: [],
                evidenceVersion:
                    ProfileIdentity.constants
                        .EVIDENCE_VERSION,
                evidence: {}
            },

            direction: {},

            meta: {
                createdBy:
                    normalizeText(
                        data.createdBy
                    ),

                updatedBy:
                    normalizeText(
                        data.createdBy
                    ),

                source:
                    normalizeText(
                        data.source
                    ) ||
                    "PortraitOS",

                createdAt: now,
                updatedAt: now
            },

            createdAt: now,
            updatedAt: now
        };

        ProfileIdentity.initialize(profile);
        ProfileDirection.initialize(profile);

        activeProfile = profile;

        emit(
            "profile:created",
            clone(profile)
        );

        return clone(profile);
    }

    function load(profile) {
        validateDependencies();
        validateProfile(profile);

        const loaded =
            clone(profile);

        normalizeProfile(loaded);

        ProfileIdentity.initialize(loaded);
        ProfileDirection.initialize(loaded);

        activeProfile = loaded;

        emit(
            "profile:loaded",
            clone(activeProfile)
        );

        return clone(activeProfile);
    }

    function getActive() {
        return activeProfile
            ? clone(activeProfile)
            : null;
    }

    function getMutableActive() {
        assertActiveProfile();

        return activeProfile;
    }

    function setActive(profile) {
        return load(profile);
    }

    function clearActive() {
        const previous =
            activeProfile
                ? clone(activeProfile)
                : null;

        activeProfile = null;

        emit(
            "profile:cleared",
            previous
        );

        return previous;
    }

    function duplicate(options = {}) {
        const source =
            getMutableActive();

        const copy =
            clone(source);

        const now =
            new Date().toISOString();

        copy.id =
            createProfileId();

        copy.name =
            normalizeText(options.name) ||
            `${source.name} — copia`;

        copy.createdAt = now;
        copy.updatedAt = now;

        copy.meta = {
            ...(copy.meta || {}),
            createdAt: now,
            updatedAt: now,
            sourceProfileId:
                source.id
        };

        if (
            options.unlockIdentity !== false &&
            copy.identity
        ) {
            copy.identity.locked = false;
            copy.identity.lockedAt = null;
            copy.identity.lockedBy = null;
            copy.identity.lockedEvidenceVersion = null;

            if (
                copy.identity.status ===
                "locked"
            ) {
                copy.identity.status =
                    "review";
            }
        }

        if (copy.identity?.evidence) {
            Object.values(copy.identity.evidence).forEach(records => {
                if (!Array.isArray(records)) return;
                records.forEach(record => {
                    record.profileId = copy.id;
                });
            });
        }

        activeProfile = copy;

        emit(
            "profile:duplicated",
            clone(copy)
        );

        return clone(copy);
    }

    /* ========================================================
       INFORMACIÓN GENERAL
       ======================================================== */

    function update(changes = {}) {
        const profile =
            getMutableActive();

        const allowedFields = [
            "name",
            "description"
        ];

        allowedFields.forEach(field => {
            if (
                Object.prototype.hasOwnProperty.call(
                    changes,
                    field
                )
            ) {
                profile[field] =
                    normalizeText(
                        changes[field]
                    );
            }
        });

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "tags"
            )
        ) {
            profile.tags =
                normalizeList(
                    changes.tags
                );
        }

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "updatedBy"
            )
        ) {
            ensureMeta(profile);

            profile.meta.updatedBy =
                normalizeText(
                    changes.updatedBy
                );
        }

        touch(profile);

        emit(
            "profile:updated",
            clone(profile)
        );

        return clone(profile);
    }

    function getSummary() {
        const profile =
            getMutableActive();

        return {
            id:
                profile.id,

            name:
                profile.name,

            description:
                profile.description,

            version:
                profile.version,

            tags:
                clone(profile.tags || []),

            photos:
                ProfilePhotos.getSummary(
                    profile
                ),

            identity:
                ProfileIdentity.getSummary(
                    profile
                ),

            direction:
                ProfileDirection.getSummary(
                    profile
                ),

            validation:
                ProfileValidation.validateForDraft(
                    profile
                ).summary,

            createdAt:
                profile.createdAt,

            updatedAt:
                profile.updatedAt
        };
    }

    /* ========================================================
       FOTOGRAFÍAS
       ======================================================== */

    const photos = Object.freeze({

        add:
            async function (
                file,
                options = {}
            ) {
                const profile =
                    getMutableActive();

                const photo =
                    await ProfilePhotos.add(
                        profile,
                        file,
                        options
                    );

                if (getMutableActive().id !== profile.id) {
                    throw createError(
                        "PHOTO_IMPORT_CANCELLED",
                        "La importación se canceló porque cambió el perfil activo."
                    );
                }

                commitPhotosChange(
                    "add",
                    { photoId: photo.id }
                );

                return photo;
            },

        addMany:
            async function (
                files,
                options = {}
            ) {
                const profile =
                    getMutableActive();

                const added =
                    await ProfilePhotos.addMany(
                        profile,
                        files,
                        options
                    );

                if (getMutableActive().id !== profile.id) {
                    throw createError(
                        "PHOTO_IMPORT_CANCELLED",
                        "La importación se canceló porque cambió el perfil activo."
                    );
                }

                commitPhotosChange(
                    "add-many",
                    { photoIds: added.map(photo => photo.id) }
                );

                return added;
            },

        update:
            function (
                photoId,
                changes
            ) {
                const result =
                    ProfilePhotos.update(
                        getMutableActive(),
                        photoId,
                        changes
                    );

                commitPhotosChange(
                    "update",
                    { photoId: result.id }
                );

                return result;
            },

        remove:
            function (photoId) {
                const result =
                    ProfilePhotos.remove(
                        getMutableActive(),
                        photoId
                    );

                commitPhotosChange(
                    "remove",
                    { photoId: result.id }
                );

                return result;
            },

        setPrimary:
            function (photoId) {
                const result =
                    ProfilePhotos.setPrimary(
                        getMutableActive(),
                        photoId
                    );

                commitPhotosChange(
                    "set-primary",
                    { photoId: result.id }
                );

                return result;
            },

        reorder:
            function (orderedIds) {
                const result = ProfilePhotos.reorder(
                    getMutableActive(),
                    orderedIds
                );

                commitPhotosChange(
                    "reorder",
                    { order: result.map(photo => photo.id) }
                );

                return result;
            },

        move:
            function (
                photoId,
                targetIndex
            ) {
                const result = ProfilePhotos.move(
                    getMutableActive(),
                    photoId,
                    targetIndex
                );

                commitPhotosChange(
                    "move",
                    { photoId, targetIndex }
                );

                return result;
            },

        get:
            function (photoId) {
                return ProfilePhotos.get(
                    getMutableActive(),
                    photoId
                );
            },

        getPrimary:
            function () {
                return ProfilePhotos.getPrimary(
                    getMutableActive()
                );
            },

        list:
            function () {
                return ProfilePhotos.list(
                    getMutableActive()
                );
            },

        clear:
            function () {
                const result = ProfilePhotos.clear(
                    getMutableActive()
                );

                commitPhotosChange(
                    "clear",
                    { photoIds: result.map(photo => photo.id) }
                );

                return result;
            },

        summary:
            function () {
                return ProfilePhotos.getSummary(
                    getMutableActive()
                );
            }

    });

    function commitPhotosChange(operation, detail = {}) {
        if (window.PhotoStorage?.persistActive) {
            PhotoStorage.persistActive();
        }

        const profile = getMutableActive();
        const summary = ProfilePhotos.getSummary(profile);

        emit("photos:changed", {
            profileId: profile.id,
            operation,
            ...clone(detail),
            primaryPhoto: ProfilePhotos.getPrimary(profile),
            summary
        });
    }

    /* ========================================================
       IDENTIDAD
       ======================================================== */

    const identity = Object.freeze({

        updateGeneral:
            function (changes) {
                return ProfileIdentity.updateGeneral(
                    getMutableActive(),
                    changes
                );
            },

        updateSection:
            function (
                sectionName,
                changes
            ) {
                return ProfileIdentity.updateSection(
                    getMutableActive(),
                    sectionName,
                    changes
                );
            },

        clearSection:
            function (sectionName) {
                return ProfileIdentity.clearSection(
                    getMutableActive(),
                    sectionName
                );
            },

        get:
            function () {
                return ProfileIdentity.get(
                    getMutableActive()
                );
            },

        getSection:
            function (sectionName) {
                return ProfileIdentity.getSection(
                    getMutableActive(),
                    sectionName
                );
            },

        listSections:
            function () {
                return ProfileIdentity.listSections(
                    getMutableActive()
                );
            },

        summary:
            function () {
                return ProfileIdentity.getSummary(
                    getMutableActive()
                );
            },

        validate:
            function (validatedBy = "") {
                const result = ProfileIdentity.validate(
                    getMutableActive(),
                    validatedBy
                );

                return commitIdentityChange(
                    "identity:updated",
                    "validate",
                    result
                );
            },

        lock:
            function (options = {}) {
                const result = ProfileIdentity.lock(
                    getMutableActive(),
                    options
                );

                return commitIdentityChange(
                    "identity:locked",
                    "lock",
                    result
                );
            },

        unlock:
            function (options = {}) {
                const result = ProfileIdentity.unlock(
                    getMutableActive(),
                    options
                );

                return commitIdentityChange(
                    "identity:unlocked",
                    "unlock",
                    result
                );
            },

        isLocked:
            function () {
                return ProfileIdentity.isLocked(
                    getMutableActive()
                );
            },

        contract:
            function () {
                return ProfileIdentity
                    .buildIdentityContract(
                        getMutableActive()
                    );
            },

        linkEvidence:
            function (section, photoId, options = {}) {
                const result = ProfileIdentity.linkEvidence(
                    getMutableActive(),
                    section,
                    photoId,
                    options
                );

                return commitIdentityChange(
                    "identity:evidence-updated",
                    "link-evidence",
                    result,
                    { section, photoId }
                );
            },

        unlinkEvidence:
            function (section, photoId) {
                const result = ProfileIdentity.unlinkEvidence(
                    getMutableActive(),
                    section,
                    photoId
                );

                return commitIdentityChange(
                    "identity:evidence-updated",
                    "unlink-evidence",
                    result,
                    { section, photoId }
                );
            },

        getEvidence:
            function (section = null) {
                return ProfileIdentity.getEvidence(
                    getMutableActive(),
                    section
                );
            },

        getEvidenceState:
            function () {
                return ProfileIdentity.getEvidenceState(
                    getMutableActive()
                );
            },

        reset:
            function (options = {}) {
                return ProfileIdentity.reset(
                    getMutableActive(),
                    options
                );
            }

    });

    function commitIdentityChange(
        eventName,
        operation,
        result,
        detail = {}
    ) {
        if (window.ProfileManager?.saveActive) {
            ProfileManager.saveActive();
        }

        const profile = getMutableActive();
        emit(eventName, {
            profileId: profile.id,
            operation,
            ...clone(detail),
            identity: ProfileIdentity.get(profile),
            evidenceState:
                ProfileIdentity.getEvidenceState(profile)
        });

        return result;
    }

    /* ========================================================
       DIRECCIÓN CREATIVA
       ======================================================== */

    const direction = Object.freeze({

        replace:
            changes => {
                const profile =
                    getMutableActive();

                profile.direction =
                    clone(
                        changes &&
                        typeof changes === "object"
                            ? changes
                            : {}
                    );

                ProfileDirection.initialize(
                    profile
                );

                const result =
                    ProfileDirection.get(
                        profile
                    );

                return commitDirectionChange(
                    "replace",
                    result
                );
            },

        updateGeneral:
            changes =>
                commitDirectionChange(
                    "update-general",
                    ProfileDirection.updateGeneral(
                        getMutableActive(),
                        changes
                    )
                ),

        updateLighting:
            changes =>
                commitDirectionChange(
                    "update-lighting",
                    ProfileDirection.updateLighting(
                        getMutableActive(),
                        changes
                    )
                ),

        updateCamera:
            changes =>
                commitDirectionChange(
                    "update-camera",
                    ProfileDirection.updateCamera(
                        getMutableActive(),
                        changes
                    )
                ),

        updateComposition:
            changes =>
                commitDirectionChange(
                    "update-composition",
                    ProfileDirection.updateComposition(
                        getMutableActive(),
                        changes
                    )
                ),

        updateBackground:
            changes =>
                commitDirectionChange(
                    "update-background",
                    ProfileDirection.updateBackground(
                        getMutableActive(),
                        changes
                    )
                ),

        updateWardrobe:
            changes =>
                commitDirectionChange(
                    "update-wardrobe",
                    ProfileDirection.updateWardrobe(
                        getMutableActive(),
                        changes
                    )
                ),

        updatePose:
            changes =>
                commitDirectionChange(
                    "update-pose",
                    ProfileDirection.updatePose(
                        getMutableActive(),
                        changes
                    )
                ),

        updateTreatment:
            changes =>
                commitDirectionChange(
                    "update-treatment",
                    ProfileDirection.updateTreatment(
                        getMutableActive(),
                        changes
                    )
                ),

        addConstraint:
            value =>
                commitDirectionChange(
                    "add-constraint",
                    ProfileDirection.addConstraint(
                        getMutableActive(),
                        value
                    )
                ),

        removeConstraint:
            value =>
                commitDirectionChange(
                    "remove-constraint",
                    ProfileDirection.removeConstraint(
                        getMutableActive(),
                        value
                    )
                ),

        addReference:
            reference =>
                commitDirectionChange(
                    "add-reference",
                    ProfileDirection.addReference(
                        getMutableActive(),
                        reference
                    )
                ),

        removeReference:
            referenceId =>
                commitDirectionChange(
                    "remove-reference",
                    ProfileDirection.removeReference(
                        getMutableActive(),
                        referenceId
                    )
                ),

        markReady:
            () =>
                commitDirectionChange(
                    "mark-ready",
                    ProfileDirection.markReady(
                        getMutableActive()
                    )
                ),

        archive:
            () =>
                commitDirectionChange(
                    "archive",
                    ProfileDirection.archive(
                        getMutableActive()
                    )
                ),

        validate:
            () =>
                ProfileDirection.validateDirection(
                    getMutableActive()
                ),

        get:
            () =>
                ProfileDirection.get(
                    getMutableActive()
                ),

        getBlock:
            blockName =>
                ProfileDirection.getBlock(
                    getMutableActive(),
                    blockName
                ),

        summary:
            () =>
                ProfileDirection.getSummary(
                    getMutableActive()
                ),

        contract:
            () =>
                ProfileDirection
                    .buildCreativeContract(
                        getMutableActive()
                    ),

        reset:
            () =>
                commitDirectionChange(
                    "reset",
                    ProfileDirection.reset(
                        getMutableActive()
                    )
                )

    });

    function commitDirectionChange(operation, result) {
        if (window.ProfileManager?.saveActive) {
            ProfileManager.saveActive();
        }

        const profile = getMutableActive();
        emit(
            "direction:updated",
            {
                profileId: profile.id,
                operation,
                direction: ProfileDirection.get(profile)
            }
        );

        return result;
    }

    /* ========================================================
       VALIDACIÓN
       ======================================================== */

    function validate(options = {}) {
        return ProfileValidation.validate(
            getMutableActive(),
            options
        );
    }

    function validateForPrompt() {
        return ProfileValidation.validateForPrompt(
            getMutableActive()
        );
    }

    function validateForDraft() {
        return ProfileValidation.validateForDraft(
            getMutableActive()
        );
    }

    function readiness() {
        return ProfileValidation.getGenerationReadiness(
            getMutableActive()
        );
    }

    /* ========================================================
       PERSISTENCIA / EXPORTACIÓN
       ======================================================== */

    function save() {
        const profile = getMutableActive();
        ProfileManager?.saveActive?.();
        emit("profile:saved", clone(profile));
        return clone(profile);
    }

    function exportProfile(options = {}) {
        return ProfileImportExport.exportProfile(
            getMutableActive(),
            options
        );
    }

    function importProfile(source, options = {}) {
        const imported = ProfileImportExport.importProfile(
            source,
            options
        );

        return load(imported);
    }

    /* ========================================================
       UTILIDADES INTERNAS
       ======================================================== */

    function assertActiveProfile() {
        if (!activeProfile) {
            throw createError(
                "PROFILE_REQUIRED",
                "No existe ningún perfil activo."
            );
        }
    }

    function validateDependencies() {
        const required = [
            "ProfilePhotos",
            "ProfileIdentity",
            "ProfileDirection",
            "ProfileValidation"
        ];

        const missing = required.filter(
            dependency =>
                !window[dependency]
        );

        if (missing.length) {
            throw createError(
                "MISSING_DEPENDENCY",
                `Faltan dependencias de ProfileService: ${missing.join(", ")}.`
            );
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
                "El perfil no es válido."
            );
        }
    }

    function normalizeProfile(profile) {
        profile.name = normalizeText(profile.name) || "Perfil sin nombre";
        profile.description = normalizeText(profile.description);
        profile.tags = normalizeList(profile.tags);
        ensureMeta(profile);
        profile.version = normalizeText(profile.version) || PROFILE_VERSION;
        profile.createdAt = profile.createdAt || profile.meta.createdAt || new Date().toISOString();
        profile.updatedAt = profile.updatedAt || profile.meta.updatedAt || profile.createdAt;
    }

    function ensureMeta(profile) {
        if (!profile.meta || typeof profile.meta !== "object" || Array.isArray(profile.meta)) {
            profile.meta = {};
        }

        profile.meta.createdAt = profile.meta.createdAt || profile.createdAt || new Date().toISOString();
        profile.meta.updatedAt = profile.meta.updatedAt || profile.updatedAt || profile.meta.createdAt;
        profile.meta.source = normalizeText(profile.meta.source) || "PortraitOS";
    }

    function touch(profile) {
        profile.updatedAt = new Date().toISOString();
        ensureMeta(profile);
        profile.meta.updatedAt = profile.updatedAt;
    }

    function createProfileId() {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function emit(name, detail) {
        if (window.AppEvents?.emit) AppEvents.emit(name, detail);
        else window.dispatchEvent(new CustomEvent(name, { detail }));
    }

    function normalizeText(value) {
        return String(value || "").trim();
    }

    function normalizeList(values) {
        if (!Array.isArray(values)) return [];
        return [...new Set(values.map(normalizeText).filter(Boolean))];
    }

    function clone(value) {
        return typeof structuredClone === "function"
            ? structuredClone(value)
            : JSON.parse(JSON.stringify(value));
    }

    function createError(code, message) {
        const error = new Error(message);
        error.name = "ProfileServiceError";
        error.code = code;
        return error;
    }

    return Object.freeze({
        create,
        load,
        setActive,
        clearActive,
        getActive,
        duplicate,
        update,
        getSummary,
        photos,
        identity,
        direction,
        validate,
        validateForPrompt,
        validateForDraft,
        readiness,
        save,
        exportProfile,
        importProfile
    });
})();

window.ProfileService = ProfileService;
