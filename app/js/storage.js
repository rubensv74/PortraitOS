/* ===========================================================
   PortraitOS
   Storage Service
   =========================================================== */

"use strict";

const PortraitStorage = (() => {

    /* =======================================================
       CONFIGURACIÓN
       ======================================================= */

    const STORAGE_KEY = "portraitos.profile.v1";

    const SETTINGS_KEY = "portraitos.settings.v1";

    const SESSION_KEY = "portraitos.session.v1";

    const SCHEMA_VERSION = "1.0.0";


    /* =======================================================
       UTILIDADES INTERNAS
       ======================================================= */

    function isStorageAvailable() {

        try {

            const testKey = "__portraitos_storage_test__";

            localStorage.setItem(testKey, testKey);

            localStorage.removeItem(testKey);

            return true;

        } catch (error) {

            console.error(
                "PortraitOS: Local Storage no está disponible.",
                error
            );

            return false;

        }

    }


    function safeParse(value, fallback = null) {

        if (!value) {

            return fallback;

        }

        try {

            return JSON.parse(value);

        } catch (error) {

            console.error(
                "PortraitOS: no se pudo interpretar el contenido almacenado.",
                error
            );

            return fallback;

        }

    }


    function deepClone(value) {

        if (
            typeof structuredClone === "function"
        ) {

            return structuredClone(value);

        }

        return JSON.parse(
            JSON.stringify(value)
        );

    }


    function createId(prefix = "profile") {

        const randomPart = Math.random()
            .toString(36)
            .substring(2, 10);

        const timestamp = Date.now()
            .toString(36);

        return `${prefix}_${timestamp}_${randomPart}`;

    }


    function nowISO() {

        return new Date().toISOString();

    }


    /* =======================================================
       PERFIL POR DEFECTO
       ======================================================= */

    function createDefaultProfile() {

        const createdAt = nowISO();

        return {

            schema: "PortraitOS.Profile",

            schemaVersion: SCHEMA_VERSION,

            id: createId("portrait"),

            metadata: {

                name: "Nuevo perfil",

                description: "",

                createdAt,

                updatedAt: createdAt,

                applicationVersion: "0.1.0",

                status: "draft"

            },

            identity: {

                photos: [],

                primaryPhotoId: null,

                contract: {

                    apparentAge: {

                        preserve: true,

                        label: "Edad aparente",

                        notes:
                            "Mantener la edad real y la edad percibida de las fotografías de referencia."

                    },

                    hair: {

                        preserve: true,

                        label: "Cabello",

                        notes:
                            "Preservar color, densidad, textura, patrón, volumen y línea del cabello."

                    },

                    grayHair: {

                        preserve: true,

                        label: "Canas",

                        notes:
                            "No eliminar, ocultar ni reducir la presencia natural de canas."

                    },

                    skinTone: {

                        preserve: true,

                        label: "Tono de piel",

                        notes:
                            "Mantener el tono y subtono natural de la piel."

                    },

                    skinTexture: {

                        preserve: true,

                        label: "Textura de piel",

                        notes:
                            "Conservar poros, textura y apariencia natural. Evitar el efecto de piel plástica."

                    },

                    wrinkles: {

                        preserve: true,

                        label: "Arrugas y líneas",

                        notes:
                            "Mantener arrugas, líneas de expresión y marcas naturales."

                    },

                    eyes: {

                        preserve: true,

                        label: "Ojos",

                        notes:
                            "Preservar forma, tamaño, separación, color y expresión natural."

                    },

                    eyebrows: {

                        preserve: true,

                        label: "Cejas",

                        notes:
                            "Mantener forma, grosor, color, densidad y asimetrías."

                    },

                    nose: {

                        preserve: true,

                        label: "Nariz",

                        notes:
                            "Preservar exactamente la forma, anchura, longitud y proporciones."

                    },

                    mouth: {

                        preserve: true,

                        label: "Boca y labios",

                        notes:
                            "Mantener forma, volumen, proporciones, expresión y sonrisa."

                    },

                    teeth: {

                        preserve: true,

                        label: "Dentadura",

                        notes:
                            "No alterar alineación, forma, tamaño ni color natural de los dientes."

                    },

                    jaw: {

                        preserve: true,

                        label: "Mandíbula",

                        notes:
                            "No afinar, ampliar ni redefinir la mandíbula o el contorno facial."

                    },

                    faceShape: {

                        preserve: true,

                        label: "Forma del rostro",

                        notes:
                            "Mantener proporciones, volumen y geometría general del rostro."

                    },

                    facialAsymmetry: {

                        preserve: true,

                        label: "Asimetrías",

                        notes:
                            "Conservar las asimetrías naturales que forman parte de la identidad."

                    },

                    facialHair: {

                        preserve: true,

                        label: "Barba y vello facial",

                        notes:
                            "Mantener estilo, longitud, densidad, textura y color."

                    },

                    distinctiveFeatures: {

                        preserve: true,

                        label: "Rasgos distintivos",

                        notes:
                            "Preservar lunares, cicatrices, marcas y otros elementos identificativos."

                    }

                },

                faceLock: {

                    value: 100,

                    mode: "maximum",

                    label: "Máxima fidelidad",

                    description:
                        "La identidad prevalece sobre cualquier decisión estética."

                }

            },

            direction: {

                goal: null,

                perceptions: [],

                customPerception: "",

                notes: ""

            },

            prompt: {

                targetModel: "chatgpt-images",

                language: "es",

                compiledText: "",

                compiledAt: null,

                compilerVersion: "1.0.0"

            },

            review: {

                generatedPortraits: [],

                latestReview: null

            }

        };

    }


    /* =======================================================
       NORMALIZACIÓN
       ======================================================= */

    function normalizeProfile(profile) {

        const defaultProfile =
            createDefaultProfile();

        if (
            !profile ||
            typeof profile !== "object"
        ) {

            return defaultProfile;

        }

        const normalized = {

            ...defaultProfile,

            ...profile,

            metadata: {

                ...defaultProfile.metadata,

                ...(profile.metadata || {})

            },

            identity: {

                ...defaultProfile.identity,

                ...(profile.identity || {}),

                contract: {

                    ...defaultProfile.identity.contract,

                    ...(profile.identity?.contract || {})

                },

                faceLock: {

                    ...defaultProfile.identity.faceLock,

                    ...(profile.identity?.faceLock || {})

                }

            },

            direction: {

                ...defaultProfile.direction,

                ...(profile.direction || {})

            },

            prompt: {

                ...defaultProfile.prompt,

                ...(profile.prompt || {})

            },

            review: {

                ...defaultProfile.review,

                ...(profile.review || {})

            }

        };

        normalized.identity.photos =
            Array.isArray(
                normalized.identity.photos
            )
                ? normalized.identity.photos
                : [];

        normalized.direction.perceptions =
            Array.isArray(
                normalized.direction.perceptions
            )
                ? normalized.direction.perceptions
                : [];

        normalized.review.generatedPortraits =
            Array.isArray(
                normalized.review.generatedPortraits
            )
                ? normalized.review.generatedPortraits
                : [];

        normalized.identity.faceLock.value =
            Math.min(
                100,
                Math.max(
                    70,
                    Number(
                        normalized.identity.faceLock.value
                    ) || 100
                )
            );

        return normalized;

    }


    /* =======================================================
       GUARDADO DEL PERFIL
       ======================================================= */

    function saveProfile(profile) {

        if (!isStorageAvailable()) {

            return {

                success: false,

                error:
                    "El navegador no permite utilizar Local Storage."

            };

        }

        try {

            const normalized =
                normalizeProfile(
                    deepClone(profile)
                );

            normalized.metadata.updatedAt =
                nowISO();

            localStorage.setItem(

                STORAGE_KEY,

                JSON.stringify(normalized)

            );

            return {

                success: true,

                profile: normalized

            };

        } catch (error) {

            console.error(
                "PortraitOS: error al guardar el perfil.",
                error
            );

            return {

                success: false,

                error:
                    "No se pudo guardar el perfil en el navegador."

            };

        }

    }


    /* =======================================================
       LECTURA DEL PERFIL
       ======================================================= */

    function loadProfile() {

        if (!isStorageAvailable()) {

            return createDefaultProfile();

        }

        const rawProfile =
            localStorage.getItem(
                STORAGE_KEY
            );

        if (!rawProfile) {

            const newProfile =
                createDefaultProfile();

            saveProfile(newProfile);

            return newProfile;

        }

        const parsedProfile =
            safeParse(
                rawProfile,
                null
            );

        if (!parsedProfile) {

            const recoveryProfile =
                createDefaultProfile();

            saveProfile(recoveryProfile);

            return recoveryProfile;

        }

        return normalizeProfile(
            parsedProfile
        );

    }


    /* =======================================================
       ELIMINACIÓN DEL PERFIL
       ======================================================= */

    function clearProfile() {

        if (!isStorageAvailable()) {

            return false;

        }

        localStorage.removeItem(
            STORAGE_KEY
        );

        return true;

    }


    function resetProfile() {

        const profile =
            createDefaultProfile();

        saveProfile(profile);

        return profile;

    }


    /* =======================================================
       CONFIGURACIÓN
       ======================================================= */

    function createDefaultSettings() {

        return {

            schema: "PortraitOS.Settings",

            version: "1.0.0",

            appearance: {

                theme: "light",

                density: "comfortable",

                animations: true

            },

            autosave: {

                enabled: true,

                delay: 500

            },

            locale: {

                language: "es",

                dateFormat: "DD/MM/YYYY"

            },

            privacy: {

                storePhotoPreviews: false,

                confirmBeforeReset: true

            }

        };

    }


    function saveSettings(settings) {

        if (!isStorageAvailable()) {

            return false;

        }

        try {

            localStorage.setItem(

                SETTINGS_KEY,

                JSON.stringify(settings)

            );

            return true;

        } catch (error) {

            console.error(
                "PortraitOS: error al guardar la configuración.",
                error
            );

            return false;

        }

    }


    function loadSettings() {

        if (!isStorageAvailable()) {

            return createDefaultSettings();

        }

        const savedSettings =
            safeParse(

                localStorage.getItem(
                    SETTINGS_KEY
                ),

                null

            );

        if (!savedSettings) {

            const defaults =
                createDefaultSettings();

            saveSettings(defaults);

            return defaults;

        }

        return {

            ...createDefaultSettings(),

            ...savedSettings,

            appearance: {

                ...createDefaultSettings()
                    .appearance,

                ...(savedSettings.appearance || {})

            },

            autosave: {

                ...createDefaultSettings()
                    .autosave,

                ...(savedSettings.autosave || {})

            },

            locale: {

                ...createDefaultSettings()
                    .locale,

                ...(savedSettings.locale || {})

            },

            privacy: {

                ...createDefaultSettings()
                    .privacy,

                ...(savedSettings.privacy || {})

            }

        };

    }


    /* =======================================================
       SESIÓN DEL WIZARD
       ======================================================= */

    function createDefaultSession() {

        return {

            currentStep: 0,

            completedSteps: [],

            lastVisitedAt: nowISO()

        };

    }


    function saveSession(session) {

        if (!isStorageAvailable()) {

            return false;

        }

        try {

            localStorage.setItem(

                SESSION_KEY,

                JSON.stringify({

                    ...session,

                    lastVisitedAt: nowISO()

                })

            );

            return true;

        } catch (error) {

            console.error(
                "PortraitOS: error al guardar la sesión.",
                error
            );

            return false;

        }

    }


    function loadSession() {

        if (!isStorageAvailable()) {

            return createDefaultSession();

        }

        const session =
            safeParse(

                localStorage.getItem(
                    SESSION_KEY
                ),

                null

            );

        if (!session) {

            return createDefaultSession();

        }

        return {

            ...createDefaultSession(),

            ...session,

            completedSteps:
                Array.isArray(
                    session.completedSteps
                )
                    ? session.completedSteps
                    : []

        };

    }


    function clearSession() {

        if (!isStorageAvailable()) {

            return false;

        }

        localStorage.removeItem(
            SESSION_KEY
        );

        return true;

    }


    /* =======================================================
       IMPORTACIÓN
       ======================================================= */

    function importProfileFromText(text) {

        try {

            const parsedProfile =
                JSON.parse(text);

            if (
                !parsedProfile ||
                typeof parsedProfile !== "object"
            ) {

                throw new Error(
                    "El contenido no representa un perfil válido."
                );

            }

            if (
                parsedProfile.schema !==
                "PortraitOS.Profile"
            ) {

                throw new Error(
                    "El archivo no pertenece al esquema PortraitOS.Profile."
                );

            }

            const normalized =
                normalizeProfile(
                    parsedProfile
                );

            normalized.metadata.updatedAt =
                nowISO();

            const result =
                saveProfile(
                    normalized
                );

            if (!result.success) {

                throw new Error(
                    result.error
                );

            }

            return {

                success: true,

                profile:
                    result.profile

            };

        } catch (error) {

            console.error(
                "PortraitOS: error al importar el perfil.",
                error
            );

            return {

                success: false,

                error:
                    error.message ||
                    "No se pudo importar el perfil."

            };

        }

    }


    function importProfileFromFile(file) {

        return new Promise(
            (resolve) => {

                if (!file) {

                    resolve({

                        success: false,

                        error:
                            "No se ha seleccionado ningún archivo."

                    });

                    return;

                }

                const reader =
                    new FileReader();

                reader.onload = () => {

                    resolve(

                        importProfileFromText(
                            reader.result
                        )

                    );

                };

                reader.onerror = () => {

                    resolve({

                        success: false,

                        error:
                            "No se pudo leer el archivo seleccionado."

                    });

                };

                reader.readAsText(
                    file,
                    "UTF-8"
                );

            }
        );

    }


    /* =======================================================
       EXPORTACIÓN
       ======================================================= */

    function createExportFileName(profile) {

        const profileName =
            profile?.metadata?.name ||
            "perfil";

        const sanitizedName =
            profileName

                .normalize("NFD")

                .replace(
                    /[\u0300-\u036f]/g,
                    ""
                )

                .replace(
                    /[^a-zA-Z0-9-_]+/g,
                    "-"
                )

                .replace(
                    /-+/g,
                    "-"
                )

                .replace(
                    /^-|-$/g,
                    ""
                )

                .toLowerCase() ||
            "perfil";

        const date =
            new Date()
                .toISOString()
                .slice(0, 10);

        return `portraitos-${sanitizedName}-${date}.json`;

    }


    function exportProfile(profile) {

        try {

            const normalized =
                normalizeProfile(
                    deepClone(profile)
                );

            const content =
                JSON.stringify(
                    normalized,
                    null,
                    2
                );

            const blob =
                new Blob(
                    [content],
                    {
                        type:
                            "application/json;charset=utf-8"
                    }
                );

            const url =
                URL.createObjectURL(
                    blob
                );

            const anchor =
                document.createElement(
                    "a"
                );

            anchor.href = url;

            anchor.download =
                createExportFileName(
                    normalized
                );

            document.body.appendChild(
                anchor
            );

            anchor.click();

            anchor.remove();

            URL.revokeObjectURL(
                url
            );

            return {

                success: true

            };

        } catch (error) {

            console.error(
                "PortraitOS: error al exportar el perfil.",
                error
            );

            return {

                success: false,

                error:
                    "No se pudo exportar el perfil."

            };

        }

    }


    /* =======================================================
       FOTOGRAFÍAS
       ======================================================= */

    function createPhotoMetadata(file) {

        return {

            id: createId("photo"),

            name:
                file?.name ||
                "fotografia",

            type:
                file?.type ||
                "image/*",

            size:
                Number(
                    file?.size
                ) || 0,

            lastModified:
                Number(
                    file?.lastModified
                ) || null,

            addedAt:
                nowISO(),

            role:
                "reference",

            angle:
                "unknown",

            notes:
                ""

        };

    }


    function removePhoto(
        profile,
        photoId
    ) {

        const updatedProfile =
            deepClone(profile);

        updatedProfile.identity.photos =
            updatedProfile
                .identity
                .photos
                .filter(
                    photo =>
                        photo.id !== photoId
                );

        if (
            updatedProfile
                .identity
                .primaryPhotoId ===
            photoId
        ) {

            updatedProfile
                .identity
                .primaryPhotoId =

                updatedProfile
                    .identity
                    .photos[0]
                    ?.id || null;

        }

        return updatedProfile;

    }


    function setPrimaryPhoto(
        profile,
        photoId
    ) {

        const updatedProfile =
            deepClone(profile);

        const exists =
            updatedProfile
                .identity
                .photos
                .some(
                    photo =>
                        photo.id === photoId
                );

        if (exists) {

            updatedProfile
                .identity
                .primaryPhotoId =
                photoId;

        }

        return updatedProfile;

    }


    /* =======================================================
       API PÚBLICA
       ======================================================= */

    return {

        STORAGE_KEY,

        SETTINGS_KEY,

        SESSION_KEY,

        SCHEMA_VERSION,

        isStorageAvailable,

        createDefaultProfile,

        normalizeProfile,

        saveProfile,

        loadProfile,

        clearProfile,

        resetProfile,

        createDefaultSettings,

        saveSettings,

        loadSettings,

        createDefaultSession,

        saveSession,

        loadSession,

        clearSession,

        importProfileFromText,

        importProfileFromFile,

        exportProfile,

        createPhotoMetadata,

        removePhoto,

        setPrimaryPhoto,

        deepClone,

        createId,

        nowISO

    };

})();


/* ===========================================================
   EXPOSICIÓN GLOBAL
   =========================================================== */

window.PortraitStorage =
    PortraitStorage;
