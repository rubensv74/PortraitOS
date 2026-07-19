"use strict";

/* ============================================================
   PortraitOS
   Profile Import / Export Service
   ------------------------------------------------------------
   Responsabilidad:
   - Exportar perfiles.
   - Importar perfiles.
   - Versionado.
   - Compatibilidad entre versiones.
   - Serialización JSON.
   - No modifica el modelo interno salvo import().
   ============================================================ */

const ProfileImportExport = (() => {

    const CURRENT_SCHEMA = "1.0.0";

    const EXPORT_FORMAT = "PortraitOS";

    /* ============================================================
       EXPORTACIÓN
       ============================================================ */

    function exportProfile(profile, options = {}) {

        validateProfile(profile);

        const payload = buildPayload(
            profile,
            options
        );

        return JSON.stringify(
            payload,
            null,
            2
        );

    }

    function exportObject(profile, options = {}) {

        validateProfile(profile);

        return buildPayload(
            profile,
            options
        );

    }

    function download(profile, filename) {

        const json =
            exportProfile(profile);

        const blob =
            new Blob(
                [json],
                {
                    type: "application/json"
                }
            );

        const url =
            URL.createObjectURL(blob);

        const anchor =
            document.createElement("a");

        anchor.href = url;

        anchor.download =
            normalizeFilename(
                filename ||
                profile.name ||
                "portrait-profile"
            );

        anchor.click();

        URL.revokeObjectURL(url);

    }

    /* ============================================================
       IMPORTACIÓN
       ============================================================ */

    function importProfile(json) {

        const object =
            parse(json);

        return importObject(object);

    }

    function importObject(object) {

        validatePayload(object);

        const profile =
            clone(object.profile);

        migrate(profile);

        initialize(profile);

        return profile;

    }

    function parse(json) {

        if (
            typeof json !== "string"
        ) {

            throw createError(
                "INVALID_JSON",
                "El contenido recibido no es texto."
            );

        }

        try {

            return JSON.parse(json);

        }

        catch {

            throw createError(
                "JSON_PARSE_ERROR",
                "No se pudo interpretar el JSON."
            );

        }

    }

    /* ============================================================
       MIGRACIONES
       ============================================================ */

    function migrate(profile) {

        if (
            !profile.version
        ) {

            profile.version =
                "0.0.0";

        }

        switch (profile.version) {

            case CURRENT_SCHEMA:
                break;

            default:
                migrateToCurrent(profile);

        }

        profile.version =
            CURRENT_SCHEMA;

    }

    function migrateToCurrent(profile) {

        if (
            !profile.meta
        ) {

            profile.meta = {};

        }

        if (
            !profile.createdAt
        ) {

            profile.createdAt =
                new Date().toISOString();

        }

        if (
            !profile.updatedAt
        ) {

            profile.updatedAt =
                profile.createdAt;

        }

    }

    /* ============================================================
       VALIDACIÓN
       ============================================================ */

    function validatePayload(payload) {

        if (
            !payload ||
            typeof payload !== "object"
        ) {

            throw createError(
                "INVALID_PAYLOAD",
                "El fichero no contiene un perfil válido."
            );

        }

        if (
            payload.format !== EXPORT_FORMAT
        ) {

            throw createError(
                "UNKNOWN_FORMAT",
                "Formato de fichero no reconocido."
            );

        }

        if (
            !payload.profile
        ) {

            throw createError(
                "PROFILE_NOT_FOUND",
                "No existe información del perfil."
            );

        }

    }

    function validateProfile(profile) {

        if (
            !profile ||
            typeof profile !== "object"
        ) {

            throw createError(
                "INVALID_PROFILE",
                "Perfil no válido."
            );

        }

    }

    /* ============================================================
       INICIALIZACIÓN
       ============================================================ */

    function initialize(profile) {

        if (
            window.ProfileIdentity
        ) {

            ProfileIdentity.initialize(
                profile
            );

        }

        if (
            window.ProfileDirection
        ) {

            ProfileDirection.initialize(
                profile
            );

        }

        if (
            window.ProfileValidation
        ) {

            ProfileValidation.validateForDraft(
                profile
            );

        }

    }

    /* ============================================================
       INFORMACIÓN
       ============================================================ */

    function buildPayload(
        profile,
        options
    ) {

        return {

            format:
                EXPORT_FORMAT,

            schema:
                CURRENT_SCHEMA,

            exportedAt:
                new Date().toISOString(),

            application:
                "PortraitOS",

            includePhotos:
                options.includePhotos !== false,

            profile:
                sanitize(
                    profile,
                    options
                )

        };

    }

    function sanitize(
        profile,
        options
    ) {

        const copy =
            clone(profile);

        if (
            options.includePhotos === false &&
            copy.identity
        ) {

            copy.identity.photos = [];

        }

        return copy;

    }

    /* ============================================================
       UTILIDADES
       ============================================================ */

    function normalizeFilename(name) {

        return (
            String(name)
                .trim()
                .replace(/[^\w\-]+/g, "_") +
            ".json"
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
            "ProfileImportExportError";

        error.code =
            code;

        return error;

    }

    /* ============================================================
       API
       ============================================================ */

    return Object.freeze({

        exportProfile,

        exportObject,

        download,

        importProfile,

        importObject,

        parse,

        constants: Object.freeze({

            CURRENT_SCHEMA,

            EXPORT_FORMAT

        })

    });

})();

window.ProfileImportExport =
    ProfileImportExport;
