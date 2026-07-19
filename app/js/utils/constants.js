"use strict";

/* ============================================================
   PortraitOS
   Constants Utility
   ------------------------------------------------------------
   Responsabilidad:
   - Centralizar constantes globales.
   - Evitar valores duplicados entre módulos.
   - Mantener estados, límites, rutas y claves de almacenamiento.
   ============================================================ */

const AppConstants = (() => {

    const APP = Object.freeze({
        NAME:
            "PortraitOS",

        VERSION:
            "1.0.0",

        LANGUAGE:
            "es",

        LOCALE:
            "es-ES",

        ENVIRONMENT:
            "local",

        DEBUG:
            false
    });

    const PROFILE = Object.freeze({
        VERSION:
            "1.0.0",

        DEFAULT_NAME:
            "Nuevo perfil",

        DEFAULT_DESCRIPTION:
            "",

        STORAGE_PREFIX:
            "portraitos.profile.",

        ACTIVE_PROFILE_KEY:
            "portraitos.active-profile",

        INDEX_KEY:
            "portraitos.profile-index",

        AUTOSAVE_KEY:
            "portraitos.autosave",

        AUTOSAVE_DELAY:
            800,

        MAX_NAME_LENGTH:
            120,

        MAX_DESCRIPTION_LENGTH:
            1000,

        MAX_TAGS:
            20,

        MAX_TAG_LENGTH:
            40
    });

    const PHOTO = Object.freeze({
        MAX_COUNT:
            12,

        MAX_FILE_SIZE:
            15 * 1024 * 1024,

        MIN_WIDTH:
            640,

        MIN_HEIGHT:
            640,

        RECOMMENDED_WIDTH:
            1600,

        RECOMMENDED_HEIGHT:
            1600,

        THUMBNAIL_WIDTH:
            480,

        THUMBNAIL_HEIGHT:
            480,

        THUMBNAIL_QUALITY:
            0.86,

        ALLOWED_TYPES:
            Object.freeze([
                "image/jpeg",
                "image/png",
                "image/webp"
            ]),

        ALLOWED_EXTENSIONS:
            Object.freeze([
                "jpg",
                "jpeg",
                "png",
                "webp"
            ]),

        ROLES:
            Object.freeze({
                PRIMARY:
                    "primary",

                FRONT:
                    "front",

                THREE_QUARTER:
                    "three-quarter",

                PROFILE:
                    "profile",

                DETAIL:
                    "detail",

                EXPRESSION:
                    "expression",

                GENERAL:
                    "general"
            })
    });

    const IDENTITY = Object.freeze({
        MINIMUM_COMPLETENESS:
            70,

        RECOMMENDED_COMPLETENESS:
            90,

        MINIMUM_REFERENCE_PHOTOS:
            1,

        RECOMMENDED_REFERENCE_PHOTOS:
            3,

        STATUS:
            Object.freeze({
                DRAFT:
                    "draft",

                REVIEW:
                    "review",

                VALIDATED:
                    "validated",

                LOCKED:
                    "locked"
            }),

        CONFIDENCE:
            Object.freeze({
                UNKNOWN:
                    "unknown",

                LOW:
                    "low",

                MEDIUM:
                    "medium",

                HIGH:
                    "high",

                VERIFIED:
                    "verified"
            }),

        SECTIONS:
            Object.freeze([
                "general",
                "face",
                "skin",
                "hair",
                "eyes",
                "nose",
                "mouth",
                "jaw",
                "facial-hair",
                "age-markers",
                "asymmetries",
                "distinctive-features"
            ]),

        CRITICAL_SECTIONS:
            Object.freeze([
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
            ])
    });

    const DIRECTION = Object.freeze({
        STATUS:
            Object.freeze({
                DRAFT:
                    "draft",

                READY:
                    "ready",

                ARCHIVED:
                    "archived"
            }),

        BLOCKS:
            Object.freeze([
                "lighting",
                "camera",
                "composition",
                "background",
                "wardrobe",
                "pose",
                "treatment"
            ]),

        LIGHTING_TYPES:
            Object.freeze([
                "natural",
                "studio",
                "soft",
                "hard",
                "window",
                "rembrandt",
                "split",
                "loop",
                "butterfly",
                "rim",
                "backlight",
                "low-key",
                "high-key",
                "cinematic",
                "editorial"
            ]),

        SHOT_TYPES:
            Object.freeze([
                "extreme-close-up",
                "close-up",
                "headshot",
                "head-and-shoulders",
                "medium-close-up",
                "medium-shot",
                "three-quarter",
                "full-body"
            ]),

        CAMERA_ANGLES:
            Object.freeze([
                "eye-level",
                "high-angle",
                "low-angle",
                "three-quarter",
                "profile",
                "frontal",
                "overhead"
            ]),

        BACKGROUND_TYPES:
            Object.freeze([
                "plain",
                "studio",
                "interior",
                "office",
                "home",
                "urban",
                "nature",
                "architectural",
                "editorial",
                "abstract",
                "environmental"
            ]),

        MOODS:
            Object.freeze([
                "natural",
                "professional",
                "confident",
                "approachable",
                "serene",
                "intimate",
                "editorial",
                "cinematic",
                "dramatic",
                "warm",
                "minimalist",
                "reflective",
                "energetic",
                "elegant",
                "authentic"
            ]),

        FORMATS:
            Object.freeze([
                "square-1-1",
                "portrait-4-5",
                "portrait-2-3",
                "vertical-9-16",
                "landscape-3-2",
                "landscape-16-9"
            ])
    });

    const VALIDATION = Object.freeze({
        LEVELS:
            Object.freeze({
                ERROR:
                    "error",

                WARNING:
                    "warning",

                INFO:
                    "info"
            }),

        STATUS:
            Object.freeze({
                INVALID:
                    "invalid",

                INCOMPLETE:
                    "incomplete",

                READY:
                    "ready"
            })
    });

    const PROMPT = Object.freeze({
        OUTPUT_MODES:
            Object.freeze({
                STRUCTURED:
                    "structured",

                COMPACT:
                    "compact",

                JSON:
                    "json"
            }),

        DEFAULT_LANGUAGE:
            "es",

        TECHNICAL_QUALITY:
            Object.freeze([
                "Alta resolución.",
                "Detalle facial natural.",
                "Textura de piel realista.",
                "Iluminación coherente.",
                "Anatomía correcta.",
                "Sin artefactos visuales."
            ]),

        DEFAULT_NEGATIVE:
            Object.freeze([
                "persona diferente",
                "rostro genérico",
                "identidad reinterpretada",
                "cambio de edad",
                "rejuvenecimiento",
                "envejecimiento artificial",
                "proporciones faciales alteradas",
                "ojos modificados",
                "nariz modificada",
                "labios modificados",
                "mandíbula modificada",
                "piel de plástico",
                "piel excesivamente suavizada",
                "eliminación de arrugas",
                "eliminación de canas",
                "asimetría corregida",
                "embellecimiento artificial",
                "filtro de belleza",
                "rostro perfecto",
                "efecto muñeca",
                "rasgos irreales",
                "artefactos faciales",
                "ojos deformes",
                "manos deformes",
                "dedos adicionales",
                "baja resolución",
                "desenfoque no intencionado"
            ])
    });

    const WIZARD = Object.freeze({
        DEFAULT_STEP:
            "profile",

        STORAGE_KEY:
            "portraitos.wizard",

        STEPS:
            Object.freeze([
                {
                    id:
                        "profile",

                    index:
                        0,

                    title:
                        "Perfil",

                    description:
                        "Información general del perfil."
                },
                {
                    id:
                        "photos",

                    index:
                        1,

                    title:
                        "Fotografías",

                    description:
                        "Referencias visuales de identidad."
                },
                {
                    id:
                        "identity",

                    index:
                        2,

                    title:
                        "Identidad",

                    description:
                        "Definición de rasgos permanentes."
                },
                {
                    id:
                        "direction",

                    index:
                        3,

                    title:
                        "Dirección creativa",

                    description:
                        "Decisiones visuales variables."
                },
                {
                    id:
                        "validation",

                    index:
                        4,

                    title:
                        "Validación",

                    description:
                        "Revisión de integridad del perfil."
                },
                {
                    id:
                        "prompt",

                    index:
                        5,

                    title:
                        "Generación",

                    description:
                        "Contrato y prompt final."
                }
            ])
    });

    const ROUTES = Object.freeze({
        HOME:
            "home",

        PROFILE:
            "profile",

        PHOTOS:
            "photos",

        IDENTITY:
            "identity",

        DIRECTION:
            "direction",

        VALIDATION:
            "validation",

        PROMPT:
            "prompt",

        SETTINGS:
            "settings"
    });

    const UI = Object.freeze({
        NOTIFICATION_DURATION:
            4000,

        DEBOUNCE_DELAY:
            300,

        MODAL_TRANSITION:
            200,

        SIDEBAR_STORAGE_KEY:
            "portraitos.sidebar",

        THEME_STORAGE_KEY:
            "portraitos.theme",

        THEMES:
            Object.freeze({
                LIGHT:
                    "light",

                DARK:
                    "dark",

                SYSTEM:
                    "system"
            }),

        NOTIFICATION_TYPES:
            Object.freeze({
                INFO:
                    "info",

                SUCCESS:
                    "success",

                WARNING:
                    "warning",

                ERROR:
                    "error"
            })
    });

    const EVENTS = Object.freeze({
        PROFILE_CREATED:
            "profile:created",

        PROFILE_LOADED:
            "profile:loaded",

        PROFILE_UPDATED:
            "profile:updated",

        PROFILE_CLEARED:
            "profile:cleared",

        PROFILE_DUPLICATED:
            "profile:duplicated",

        PROFILE_SAVED:
            "profile:saved",

        PROFILE_STORAGE_REMOVED:
            "profile:storage-removed",

        PHOTO_ADDED:
            "profile:photo-added",

        PHOTOS_ADDED:
            "profile:photos-added",

        PHOTO_UPDATED:
            "profile:photo-updated",

        PHOTO_REMOVED:
            "profile:photo-removed",

        PRIMARY_PHOTO_CHANGED:
            "profile:primary-photo-changed",

        IDENTITY_UPDATED:
            "identity:updated",

        IDENTITY_VALIDATED:
            "identity:validated",

        IDENTITY_LOCKED:
            "identity:locked",

        IDENTITY_UNLOCKED:
            "identity:unlocked",

        DIRECTION_UPDATED:
            "direction:updated",

        DIRECTION_READY:
            "direction:ready",

        VALIDATION_COMPLETED:
            "validation:completed",

        PROMPT_GENERATED:
            "prompt:generated",

        WIZARD_CHANGED:
            "wizard:changed",

        WIZARD_COMPLETED:
            "wizard:completed",

        ROUTE_CHANGED:
            "router:changed",

        UI_NOTIFICATION:
            "ui:notification",

        APP_ERROR:
            "app:error"
    });

    const FILES = Object.freeze({
        EXPORT_EXTENSION:
            ".json",

        EXPORT_MIME_TYPE:
            "application/json",

        EXPORT_FORMAT:
            "PortraitOS",

        EXPORT_SCHEMA:
            "1.0.0",

        DEFAULT_EXPORT_NAME:
            "portrait-profile.json"
    });

    const LIMITS = Object.freeze({
        SHORT_TEXT:
            120,

        MEDIUM_TEXT:
            500,

        LONG_TEXT:
            2000,

        NOTES:
            4000,

        MAX_REFERENCES:
            20,

        MAX_CONSTRAINTS:
            50
    });

    function getWizardStep(
        stepId
    ) {
        return (
            WIZARD.STEPS.find(
                step =>
                    step.id === stepId
            ) || null
        );
    }

    function getWizardStepByIndex(
        index
    ) {
        return (
            WIZARD.STEPS.find(
                step =>
                    step.index ===
                    Number(index)
            ) || null
        );
    }

    function getProfileStorageKey(
        profileId
    ) {
        const normalized =
            String(profileId || "")
                .trim();

        if (!normalized) {
            return "";
        }

        return (
            PROFILE.STORAGE_PREFIX +
            normalized
        );
    }

    function isAllowedPhotoType(
        mimeType
    ) {
        return PHOTO.ALLOWED_TYPES.includes(
            String(mimeType || "")
                .trim()
                .toLowerCase()
        );
    }

    function isIdentitySection(
        sectionName
    ) {
        return IDENTITY.SECTIONS.includes(
            String(sectionName || "")
                .trim()
        );
    }

    function isDirectionBlock(
        blockName
    ) {
        return DIRECTION.BLOCKS.includes(
            String(blockName || "")
                .trim()
        );
    }

    return Object.freeze({
        APP,
        PROFILE,
        PHOTO,
        IDENTITY,
        DIRECTION,
        VALIDATION,
        PROMPT,
        WIZARD,
        ROUTES,
        UI,
        EVENTS,
        FILES,
        LIMITS,

        getWizardStep,
        getWizardStepByIndex,
        getProfileStorageKey,
        isAllowedPhotoType,
        isIdentitySection,
        isDirectionBlock
    });

})();

window.AppConstants = AppConstants;
