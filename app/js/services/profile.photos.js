"use strict";

/* ============================================================
   PortraitOS
   Profile Photos Service
   ------------------------------------------------------------
   Responsabilidad:
   - Gestionar las fotografías asociadas a un perfil.
   - Validar archivos antes de incorporarlos.
   - Generar miniaturas.
   - Extraer metadatos.
   - Añadir, actualizar, ordenar y eliminar fotografías.
   - Mantener una fotografía principal.
   ============================================================ */

const ProfilePhotos = (() => {

    const DEFAULT_ROLE = "reference";

    const PHOTO_ROLES = Object.freeze({
        REFERENCE: "reference",
        FRONT: "front",
        THREE_QUARTER: "three-quarter",
        PROFILE_LEFT: "profile-left",
        PROFILE_RIGHT: "profile-right",
        FULL_BODY: "full-body",
        DETAIL: "detail"
    });

    const PHOTO_STATUS = Object.freeze({
        READY: "ready",
        PROCESSING: "processing",
        ERROR: "error"
    });

    /* ========================================================
       API PRINCIPAL
       ======================================================== */

    async function add(profile, file, options = {}) {
        validateProfile(profile);

        const photos = ensurePhotoCollection(profile);

        validateDependencies();

        PhotoValidation.validateCollection(
            profile,
            1
        );

        PhotoValidation.validateFile(file);

        const dimensions =
            await PhotoValidation.validateResolution(
                file
            );

        const metadata =
            await PhotoMetadata.extract(file);

        const dataUrl =
            await PhotoReader.readAsDataURL(file);

        const thumbnail =
            await PhotoThumbnail.createSquare(
                file,
                normalizeThumbnailSize(
                    options.thumbnailSize
                ),
                {
                    mimeType: "image/jpeg",
                    quality: 0.86,
                    backgroundColor: "#ffffff"
                }
            );

        const now =
            new Date().toISOString();

        const photo = {
            id: createPhotoId(),

            name:
                normalizeName(
                    options.name ||
                    file.name
                ),

            role:
                normalizeRole(
                    options.role
                ),

            notes:
                normalizeText(
                    options.notes
                ),

            isPrimary:
                shouldBePrimary(
                    photos,
                    options.isPrimary
                ),

            order:
                photos.length,

            status:
                PHOTO_STATUS.READY,

            source: {
                dataUrl,
                type:
                    file.type || "",
                size:
                    file.size || 0,
                originalName:
                    file.name || ""
            },

            thumbnail: {
                dataUrl: thumbnail,
                size:
                    normalizeThumbnailSize(
                        options.thumbnailSize
                    )
            },

            dimensions: {
                width:
                    dimensions.width,
                height:
                    dimensions.height,
                orientation:
                    dimensions.orientation
            },

            metadata,

            createdAt: now,
            updatedAt: now
        };

        if (photo.isPrimary) {
            clearPrimaryFlag(photos);
        }

        photos.push(photo);

        normalizeOrder(photos);

        touchProfile(profile);

        return clone(photo);
    }

    async function addMany(
        profile,
        files,
        options = {}
    ) {
        validateProfile(profile);

        const collection =
            normalizeFiles(files);

        PhotoValidation.validateCollection(
            profile,
            collection.length
        );

        const results = [];

        for (
            let index = 0;
            index < collection.length;
            index += 1
        ) {
            const file =
                collection[index];

            const photoOptions = {
                ...options,
                isPrimary:
                    Boolean(
                        options.isPrimary &&
                        index === 0
                    )
            };

            const photo =
                await add(
                    profile,
                    file,
                    photoOptions
                );

            results.push(photo);
        }

        return results;
    }

    function remove(profile, photoId) {
        validateProfile(profile);

        const photos =
            ensurePhotoCollection(profile);

        const index =
            findPhotoIndex(
                photos,
                photoId
            );

        if (index < 0) {
            throw createError(
                "PHOTO_NOT_FOUND",
                "No se encontró la fotografía indicada."
            );
        }

        const removed =
            photos.splice(index, 1)[0];

        if (
            removed.isPrimary &&
            photos.length
        ) {
            photos[0].isPrimary = true;
            photos[0].updatedAt =
                new Date().toISOString();
        }

        normalizeOrder(photos);

        touchProfile(profile);

        return clone(removed);
    }

    function update(
        profile,
        photoId,
        changes = {}
    ) {
        validateProfile(profile);

        const photos =
            ensurePhotoCollection(profile);

        const photo =
            findPhoto(
                photos,
                photoId
            );

        if (!photo) {
            throw createError(
                "PHOTO_NOT_FOUND",
                "No se encontró la fotografía indicada."
            );
        }

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "name"
            )
        ) {
            photo.name =
                normalizeName(
                    changes.name
                );
        }

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "role"
            )
        ) {
            photo.role =
                normalizeRole(
                    changes.role
                );
        }

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "notes"
            )
        ) {
            photo.notes =
                normalizeText(
                    changes.notes
                );
        }

        if (
            changes.isPrimary === true
        ) {
            clearPrimaryFlag(photos);
            photo.isPrimary = true;
        }

        photo.updatedAt =
            new Date().toISOString();

        touchProfile(profile);

        return clone(photo);
    }

    function setPrimary(
        profile,
        photoId
    ) {
        validateProfile(profile);

        const photos =
            ensurePhotoCollection(profile);

        const photo =
            findPhoto(
                photos,
                photoId
            );

        if (!photo) {
            throw createError(
                "PHOTO_NOT_FOUND",
                "No se encontró la fotografía indicada."
            );
        }

        clearPrimaryFlag(photos);

        photo.isPrimary = true;
        photo.updatedAt =
            new Date().toISOString();

        touchProfile(profile);

        return clone(photo);
    }

    function reorder(
        profile,
        orderedIds
    ) {
        validateProfile(profile);

        const photos =
            ensurePhotoCollection(profile);

        if (
            !Array.isArray(orderedIds)
        ) {
            throw createError(
                "INVALID_ORDER",
                "El orden de fotografías no es válido."
            );
        }

        const currentIds =
            photos.map(photo => photo.id);

        if (
            orderedIds.length !==
            currentIds.length
        ) {
            throw createError(
                "INCOMPLETE_ORDER",
                "El nuevo orden debe incluir todas las fotografías."
            );
        }

        const uniqueIds =
            new Set(orderedIds);

        if (
            uniqueIds.size !==
            currentIds.length
        ) {
            throw createError(
                "DUPLICATED_PHOTO_ID",
                "El nuevo orden contiene identificadores duplicados."
            );
        }

        const hasUnknownId =
            orderedIds.some(
                id =>
                    !currentIds.includes(id)
            );

        if (hasUnknownId) {
            throw createError(
                "UNKNOWN_PHOTO_ID",
                "El nuevo orden contiene una fotografía desconocida."
            );
        }

        const photoMap =
            new Map(
                photos.map(
                    photo => [
                        photo.id,
                        photo
                    ]
                )
            );

        profile.identity.photos =
            orderedIds.map(
                (id, index) => {
                    const photo =
                        photoMap.get(id);

                    photo.order = index;
                    photo.updatedAt =
                        new Date().toISOString();

                    return photo;
                }
            );

        touchProfile(profile);

        return list(profile);
    }

    function move(
        profile,
        photoId,
        targetIndex
    ) {
        validateProfile(profile);

        const photos =
            ensurePhotoCollection(profile);

        const currentIndex =
            findPhotoIndex(
                photos,
                photoId
            );

        if (currentIndex < 0) {
            throw createError(
                "PHOTO_NOT_FOUND",
                "No se encontró la fotografía indicada."
            );
        }

        const normalizedTarget =
            Math.max(
                0,
                Math.min(
                    Number(targetIndex),
                    photos.length - 1
                )
            );

        if (
            !Number.isInteger(
                normalizedTarget
            )
        ) {
            throw createError(
                "INVALID_TARGET_INDEX",
                "La posición de destino no es válida."
            );
        }

        const [photo] =
            photos.splice(
                currentIndex,
                1
            );

        photos.splice(
            normalizedTarget,
            0,
            photo
        );

        normalizeOrder(photos);

        touchProfile(profile);

        return list(profile);
    }

    function get(
        profile,
        photoId
    ) {
        validateProfile(profile);

        const photo =
            findPhoto(
                ensurePhotoCollection(
                    profile
                ),
                photoId
            );

        return photo
            ? clone(photo)
            : null;
    }

    function getPrimary(profile) {
        validateProfile(profile);

        const photos =
            ensurePhotoCollection(profile);

        const primary =
            photos.find(
                photo => photo.isPrimary
            );

        return primary
            ? clone(primary)
            : null;
    }

    function list(profile) {
        validateProfile(profile);

        return ensurePhotoCollection(profile)
            .slice()
            .sort(
                (a, b) =>
                    a.order - b.order
            )
            .map(clone);
    }

    function count(profile) {
        validateProfile(profile);

        return ensurePhotoCollection(
            profile
        ).length;
    }

    function clear(profile) {
        validateProfile(profile);

        const removed =
            list(profile);

        profile.identity.photos = [];

        touchProfile(profile);

        return removed;
    }

    /* ========================================================
       ESTADÍSTICAS
       ======================================================== */

    function getSummary(profile) {
        validateProfile(profile);

        const photos =
            ensurePhotoCollection(profile);

        const byRole = {};

        Object.values(
            PHOTO_ROLES
        ).forEach(role => {
            byRole[role] = 0;
        });

        photos.forEach(photo => {
            if (
                Object.prototype.hasOwnProperty.call(
                    byRole,
                    photo.role
                )
            ) {
                byRole[photo.role] += 1;
            }
        });

        return {
            total:
                photos.length,

            hasPrimary:
                photos.some(
                    photo =>
                        photo.isPrimary
                ),

            primaryId:
                photos.find(
                    photo =>
                        photo.isPrimary
                )?.id || null,

            byRole,

            remaining:
                Math.max(
                    0,
                    PhotoValidation
                        .constants
                        .MAX_PHOTOS -
                    photos.length
                )
        };
    }

    /* ========================================================
       ESTRUCTURA DEL PERFIL
       ======================================================== */

    function ensurePhotoCollection(
        profile
    ) {
        if (
            !profile.identity ||
            typeof profile.identity !==
                "object"
        ) {
            profile.identity = {};
        }

        if (
            !Array.isArray(
                profile.identity.photos
            )
        ) {
            profile.identity.photos = [];
        }

        return profile.identity.photos;
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

    /* ========================================================
       UTILIDADES INTERNAS
       ======================================================== */

    function findPhoto(
        photos,
        photoId
    ) {
        return photos.find(
            photo =>
                photo.id === photoId
        ) || null;
    }

    function findPhotoIndex(
        photos,
        photoId
    ) {
        return photos.findIndex(
            photo =>
                photo.id === photoId
        );
    }

    function clearPrimaryFlag(
        photos
    ) {
        photos.forEach(photo => {
            if (photo.isPrimary) {
                photo.isPrimary = false;
                photo.updatedAt =
                    new Date().toISOString();
            }
        });
    }

    function shouldBePrimary(
        photos,
        requested
    ) {
        if (!photos.length) {
            return true;
        }

        return requested === true;
    }

    function normalizeOrder(
        photos
    ) {
        photos.forEach(
            (photo, index) => {
                photo.order = index;
            }
        );
    }

    function normalizeRole(role) {
        const value =
            String(
                role || DEFAULT_ROLE
            )
                .trim()
                .toLowerCase();

        return Object.values(
            PHOTO_ROLES
        ).includes(value)
            ? value
            : DEFAULT_ROLE;
    }

    function normalizeName(value) {
        const text =
            normalizeText(value);

        return text ||
            "Fotografía sin nombre";
    }

    function normalizeText(value) {
        return String(value || "")
            .trim();
    }

    function normalizeThumbnailSize(
        value
    ) {
        const numeric =
            Number(value);

        if (
            !Number.isInteger(numeric) ||
            numeric < 120 ||
            numeric > 1200
        ) {
            return 480;
        }

        return numeric;
    }

    function normalizeFiles(files) {
        const collection =
            Array.from(files || []);

        if (!collection.length) {
            throw createError(
                "EMPTY_FILE_COLLECTION",
                "No se han seleccionado fotografías."
            );
        }

        return collection;
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
            "PhotoValidation",
            "PhotoReader",
            "PhotoThumbnail",
            "PhotoMetadata"
        ];

        const missing =
            dependencies.filter(
                dependency =>
                    !window[dependency]
            );

        if (missing.length) {
            throw createError(
                "MISSING_DEPENDENCY",
                `Faltan dependencias: ${missing.join(", ")}.`
            );
        }
    }

    function createPhotoId() {
        if (
            window.crypto &&
            typeof crypto.randomUUID ===
                "function"
        ) {
            return crypto.randomUUID();
        }

        return [
            "photo",
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
            "ProfilePhotosError";

        error.code = code;

        return error;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        add,
        addMany,
        remove,
        update,
        setPrimary,
        reorder,
        move,
        get,
        getPrimary,
        list,
        count,
        clear,
        getSummary,

        constants: Object.freeze({
            PHOTO_ROLES,
            PHOTO_STATUS
        })
    });

})();

window.ProfilePhotos = ProfilePhotos;
