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
                photos: []
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

            if (
                copy.identity.status ===
                "locked"
            ) {
                copy.identity.status =
                    "review";
            }
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

                emit(
                    "profile:photo-added",
                    photo
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

                emit(
                    "profile:photos-added",
                    clone(added)
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

                emit(
                    "profile:photo-updated",
                    result
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

                emit(
                    "profile:photo-removed",
                    result
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

                emit(
                    "profile:primary-photo-changed",
                    result
                );

                return result;
            },

        reorder:
            function (orderedIds) {
                return ProfilePhotos.reorder(
                    getMutableActive(),
                    orderedIds
                );
            },

        move:
            function (
                photoId,
                targetIndex
            ) {
                return ProfilePhotos.move(
                    getMutableActive(),
                    photoId,
                    targetIndex
                );
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
                return ProfilePhotos.clear(
                    getMutableActive()
                );
            },

        summary:
            function () {
                return ProfilePhotos.getSummary(
                    getMutableActive()
                );
            }

    });

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
                return ProfileIdentity.validate(
                    getMutableActive(),
                    validatedBy
                );
            },

        lock:
            function (lockedBy = "") {
                return ProfileIdentity.lock(
                    getMutableActive(),
                    lockedBy
                );
            },

        unlock:
            function (options = {}) {
                return ProfileIdentity.unlock(
                    getMutableActive(),
                    options
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

        reset:
            function (options = {}) {
                return ProfileIdentity.reset(
                    getMutableActive(),
                    options
                );
            }

    });

    /* ========================================================
       DIRECCIÓN CREATIVA
       ======================================================== */

    const direction = Object.freeze({

        updateGeneral:
            changes =>
                ProfileDirection.updateGeneral(
                    getMutableActive(),
                    changes
                ),

        updateLighting:
            changes =>
                ProfileDirection.updateLighting(
                    getMutableActive(),
                    changes
                ),

        updateCamera:
            changes =>
                ProfileDirection.updateCamera(
                    getMutableActive(),
                    changes
                ),

        updateComposition:
            changes =>
                ProfileDirection.updateComposition(
                    getMutableActive(),
                    changes
                ),

        updateBackground:
            changes =>
                ProfileDirection.updateBackground(
                    getMutableActive(),
                    changes
                ),

        updateWardrobe:
            changes =>
                ProfileDirection.updateWardrobe(
                    getMutableActive(),
                    changes
                ),

        updatePose:
            changes =>
                ProfileDirection.updatePose(
                    getMutableActive(),
                    changes
                ),

        updateTreatment:
            changes =>
                ProfileDirection.updateTreatment(
                    getMutableActive(),
                    changes
                ),

        addConstraint:
            value =>
                ProfileDirection.addConstraint(
                    getMutableActive(),
                    value
                ),

        removeConstraint:
            value =>
                ProfileDirection.removeConstraint(
                    getMutableActive(),
                    value
                ),

        addReference:
            reference =>
                ProfileDirection.addReference(
                    getMutableActive(),
                    reference
                ),

        removeReference:
            referenceId =>
                ProfileDirection.removeReference(
                    getMutableActive(),
                    referenceId
                ),

        markReady:
            () =>
                ProfileDirection.markReady(
                    getMutableActive()
                ),

        archive:
            () =>
                ProfileDirection.archive(
                    getMutableActive()
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
                ProfileDirection.reset(
                    getMutableActive()
                )

    });

    /* ========================================================
       VALIDACIÓN
       ======================================================== */

    function validate(options = {}) {
        return ProfileValidation.validate(
            getMutableActive(),
            options
        );
    }

    function validateDraft() {
        return ProfileValidation
            .validateForDraft(
                getMutableActive()
            );
    }

    function validateForPrompt() {
        return ProfileValidation
            .validateForPrompt(
                getMutableActive()
            );
    }

    function assertReadyForPrompt() {
        return ProfileValidation
            .assertReadyForPrompt(
                getMutableActive()
            );
    }

    /* ========================================================
       CONTRATOS
       ======================================================== */

    function buildContracts() {
        const profile =
            getMutableActive();

        return {
            profile: {
                id:
                    profile.id,
                name:
                    profile.name,
                version:
                    profile.version
            },

            identity:
                ProfileIdentity
                    .buildIdentityContract(
                        profile
                    ),

            creative:
                ProfileDirection
                    .buildCreativeContract(
                        profile
                    ),

            generatedAt:
                new Date().toISOString()
        };
    }

    /* ========================================================
       IMPORTACIÓN Y EXPORTACIÓN
       ======================================================== */

    function exportProfile(options = {}) {
        return ProfileImportExport
            .exportProfile(
                getMutableActive(),
                options
            );
    }

    function exportObject(options = {}) {
        return ProfileImportExport
            .exportObject(
                getMutableActive(),
                options
            );
    }

    function download(filename) {
        ProfileImportExport.download(
            getMutableActive(),
            filename
        );
    }

    function importProfile(json) {
        const profile =
            ProfileImportExport
                .importProfile(json);

        return load(profile);
    }

    function importObject(object) {
        const profile =
            ProfileImportExport
                .importObject(object);

        return load(profile);
    }

    /* ========================================================
       PERSISTENCIA
       ======================================================== */

    function save(storageKey) {
        const profile =
            getMutableActive();

        const key =
            normalizeText(storageKey) ||
            buildStorageKey(profile.id);

        const serialized =
            ProfileImportExport
                .exportProfile(profile);

        if (
            window.StorageService &&
            typeof StorageService.set ===
                "function"
        ) {
            StorageService.set(
                key,
                serialized
            );
        } else {
            localStorage.setItem(
                key,
                serialized
            );
        }

        emit(
            "profile:saved",
            {
                key,
                profileId:
                    profile.id
            }
        );

        return key;
    }

    function restore(storageKey) {
        const key =
            normalizeText(storageKey);

        if (!key) {
            throw createError(
                "STORAGE_KEY_REQUIRED",
                "Debe indicarse una clave de almacenamiento."
            );
        }

        let serialized = null;

        if (
            window.StorageService &&
            typeof StorageService.get ===
                "function"
        ) {
            serialized =
                StorageService.get(key);
        } else {
            serialized =
                localStorage.getItem(key);
        }

        if (!serialized) {
            throw createError(
                "PROFILE_NOT_FOUND",
                "No se encontró el perfil guardado."
            );
        }

        return importProfile(serialized);
    }

    function removeSaved(storageKey) {
        const key =
            normalizeText(storageKey);

        if (!key) {
            throw createError(
                "STORAGE_KEY_REQUIRED",
                "Debe indicarse una clave de almacenamiento."
            );
        }

        if (
            window.StorageService &&
            typeof StorageService.remove ===
                "function"
        ) {
            StorageService.remove(key);
        } else {
            localStorage.removeItem(key);
        }

        emit(
            "profile:storage-removed",
            { key }
        );

        return true;
    }

    /* ========================================================
       UTILIDADES INTERNAS
       ======================================================== */

    function normalizeProfile(profile) {
        const now =
            new Date().toISOString();

        profile.id =
            normalizeText(profile.id) ||
            createProfileId();

        profile.name =
            normalizeText(profile.name) ||
            "Perfil sin nombre";

        profile.description =
            normalizeText(
                profile.description
            );

        profile.version =
            normalizeText(profile.version) ||
            PROFILE_VERSION;

        profile.tags =
            normalizeList(profile.tags);

        profile.createdAt =
            profile.createdAt || now;

        profile.updatedAt =
            profile.updatedAt || now;

        ensureMeta(profile);
    }

    function ensureMeta(profile) {
        if (
            !profile.meta ||
            typeof profile.meta !== "object"
        ) {
            profile.meta = {};
        }

        profile.meta.createdAt =
            profile.meta.createdAt ||
            profile.createdAt;

        profile.meta.updatedAt =
            profile.meta.updatedAt ||
            profile.updatedAt;
    }

    function touch(profile) {
        const now =
            new Date().toISOString();

        profile.updatedAt = now;

        ensureMeta(profile);

        profile.meta.updatedAt = now;
    }

    function assertActiveProfile() {
        if (!activeProfile) {
            throw createError(
                "NO_ACTIVE_PROFILE",
                "No existe ningún perfil activo."
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
                "El perfil indicado no es válido."
            );
        }
    }

    function validateDependencies() {
        const dependencies = [
            "ProfilePhotos",
            "ProfileIdentity",
            "ProfileDirection",
            "ProfileValidation",
            "ProfileImportExport"
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

    function buildStorageKey(profileId) {
        return `portraitos.profile.${profileId}`;
    }

    function normalizeText(value) {
        return String(value || "")
            .trim();
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

    function createProfileId() {
        if (
            window.crypto &&
            typeof crypto.randomUUID ===
                "function"
        ) {
            return crypto.randomUUID();
        }

        return [
            "profile",
            Date.now(),
            Math.random()
                .toString(36)
                .slice(2, 10)
        ].join("-");
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

            return;
        }

        window.dispatchEvent(
            new CustomEvent(
                eventName,
                { detail }
            )
        );
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
            "ProfileServiceError";

        error.code = code;

        return error;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        create,
        load,
        setActive,
        getActive,
        clearActive,
        duplicate,
        update,
        getSummary,

        photos,
        identity,
        direction,

        validate,
        validateDraft,
        validateForPrompt,
        assertReadyForPrompt,

        buildContracts,

        exportProfile,
        exportObject,
        download,
        importProfile,
        importObject,

        save,
        restore,
        removeSaved,

        constants: Object.freeze({
            PROFILE_VERSION
        })
    });

})();

window.ProfileService = ProfileService;
