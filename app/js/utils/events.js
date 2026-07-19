"use strict";

/* ============================================================
   PortraitOS
   Events Utility
   ------------------------------------------------------------
   Responsabilidad:
   - Centralizar eventos de aplicación.
   - Publicar y escuchar cambios del dominio.
   - Evitar acoplamiento directo entre UI, wizard y servicios.
   - Permitir suscripciones únicas y eliminación de listeners.
   ============================================================ */

const AppEvents = (() => {

    const registry =
        new Map();

    const EVENT_NAMES = Object.freeze({
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

    /* ========================================================
       PUBLICACIÓN
       ======================================================== */

    function emit(
        eventName,
        detail = null,
        options = {}
    ) {
        const name =
            normalizeEventName(
                eventName
            );

        const event =
            new CustomEvent(
                name,
                {
                    detail:
                        cloneSafe(detail),

                    bubbles:
                        options.bubbles ===
                        true,

                    cancelable:
                        options.cancelable ===
                        true
                }
            );

        window.dispatchEvent(event);

        return event;
    }

    function emitError(
        error,
        context = {}
    ) {
        const normalized =
            normalizeError(
                error,
                context
            );

        emit(
            EVENT_NAMES.APP_ERROR,
            normalized
        );

        return normalized;
    }

    function notify(
        message,
        options = {}
    ) {
        const detail = {
            message:
                normalizeText(message),

            type:
                normalizeNotificationType(
                    options.type
                ),

            title:
                normalizeText(
                    options.title
                ),

            duration:
                normalizeDuration(
                    options.duration
                ),

            dismissible:
                options.dismissible !==
                false,

            createdAt:
                new Date().toISOString()
        };

        emit(
            EVENT_NAMES.UI_NOTIFICATION,
            detail
        );

        return detail;
    }

    /* ========================================================
       SUSCRIPCIÓN
       ======================================================== */

    function on(
        eventName,
        handler,
        options = {}
    ) {
        const name =
            normalizeEventName(
                eventName
            );

        validateHandler(handler);

        const wrappedHandler =
            event => {
                handler(
                    event.detail,
                    event
                );
            };

        const listenerOptions = {
            capture:
                options.capture === true,

            passive:
                options.passive === true,

            once:
                options.once === true
        };

        window.addEventListener(
            name,
            wrappedHandler,
            listenerOptions
        );

        register(
            name,
            handler,
            wrappedHandler,
            listenerOptions
        );

        return () =>
            off(
                name,
                handler
            );
    }

    function once(
        eventName,
        handler,
        options = {}
    ) {
        return on(
            eventName,
            handler,
            {
                ...options,
                once: true
            }
        );
    }

    function off(
        eventName,
        handler
    ) {
        const name =
            normalizeEventName(
                eventName
            );

        const entries =
            registry.get(name);

        if (!entries?.length) {
            return false;
        }

        const matches =
            entries.filter(
                entry =>
                    !handler ||
                    entry.original ===
                    handler
            );

        matches.forEach(entry => {
            window.removeEventListener(
                name,
                entry.wrapped,
                entry.options
            );
        });

        const remaining =
            entries.filter(
                entry =>
                    !matches.includes(
                        entry
                    )
            );

        if (remaining.length) {
            registry.set(
                name,
                remaining
            );
        } else {
            registry.delete(name);
        }

        return matches.length > 0;
    }

    function clear(eventName = "") {
        if (eventName) {
            return off(eventName);
        }

        registry.forEach(
            (entries, name) => {
                entries.forEach(
                    entry => {
                        window.removeEventListener(
                            name,
                            entry.wrapped,
                            entry.options
                        );
                    }
                );
            }
        );

        registry.clear();

        return true;
    }

    /* ========================================================
       PROMESAS DE EVENTO
       ======================================================== */

    function waitFor(
        eventName,
        options = {}
    ) {
        const timeout =
            normalizeTimeout(
                options.timeout
            );

        return new Promise(
            (resolve, reject) => {
                let timer = null;

                const unsubscribe =
                    once(
                        eventName,
                        detail => {
                            if (timer) {
                                clearTimeout(
                                    timer
                                );
                            }

                            resolve(detail);
                        }
                    );

                if (timeout > 0) {
                    timer =
                        setTimeout(
                            () => {
                                unsubscribe();

                                reject(
                                    createError(
                                        "EVENT_TIMEOUT",
                                        `No se recibió el evento "${eventName}" dentro del tiempo esperado.`
                                    )
                                );
                            },
                            timeout
                        );
                }
            }
        );
    }

    /* ========================================================
       CONSULTAS
       ======================================================== */

    function listenerCount(
        eventName = ""
    ) {
        if (eventName) {
            const name =
                normalizeEventName(
                    eventName
                );

            return (
                registry.get(name)
                    ?.length || 0
            );
        }

        let count = 0;

        registry.forEach(
            entries => {
                count +=
                    entries.length;
            }
        );

        return count;
    }

    function listEvents() {
        return Array.from(
            registry.entries()
        ).map(
            ([name, entries]) => ({
                name,
                listeners:
                    entries.length
            })
        );
    }

    function hasListeners(
        eventName
    ) {
        return (
            listenerCount(
                eventName
            ) > 0
        );
    }

    /* ========================================================
       REGISTRO INTERNO
       ======================================================== */

    function register(
        eventName,
        original,
        wrapped,
        options
    ) {
        const entries =
            registry.get(
                eventName
            ) || [];

        entries.push({
            original,
            wrapped,
            options
        });

        registry.set(
            eventName,
            entries
        );
    }

    /* ========================================================
       NORMALIZACIÓN
       ======================================================== */

    function normalizeEventName(
        value
    ) {
        const name =
            normalizeText(value);

        if (!name) {
            throw createError(
                "EVENT_NAME_REQUIRED",
                "Debe indicarse el nombre del evento."
            );
        }

        return name;
    }

    function normalizeNotificationType(
        value
    ) {
        const allowed = [
            "info",
            "success",
            "warning",
            "error"
        ];

        const normalized =
            normalizeText(value)
                .toLowerCase();

        return allowed.includes(
            normalized
        )
            ? normalized
            : "info";
    }

    function normalizeDuration(value) {
        const numeric =
            Number(value);

        if (
            !Number.isFinite(numeric) ||
            numeric < 0
        ) {
            return 4000;
        }

        return numeric;
    }

    function normalizeTimeout(value) {
        const numeric =
            Number(value);

        if (
            !Number.isFinite(numeric) ||
            numeric < 0
        ) {
            return 0;
        }

        return numeric;
    }

    function normalizeError(
        error,
        context
    ) {
        if (
            error instanceof Error
        ) {
            return {
                name:
                    error.name ||
                    "Error",

                code:
                    error.code ||
                    "UNEXPECTED_ERROR",

                message:
                    error.message ||
                    "Se ha producido un error.",

                stack:
                    error.stack || "",

                context:
                    cloneSafe(
                        context
                    ),

                createdAt:
                    new Date()
                        .toISOString()
            };
        }

        return {
            name:
                "Error",

            code:
                "UNEXPECTED_ERROR",

            message:
                normalizeText(error) ||
                "Se ha producido un error.",

            stack: "",

            context:
                cloneSafe(
                    context
                ),

            createdAt:
                new Date()
                    .toISOString()
        };
    }

    function normalizeText(value) {
        return String(value || "")
            .trim();
    }

    /* ========================================================
       VALIDACIÓN
       ======================================================== */

    function validateHandler(
        handler
    ) {
        if (
            typeof handler !==
            "function"
        ) {
            throw createError(
                "INVALID_EVENT_HANDLER",
                "El manejador del evento debe ser una función."
            );
        }
    }

    /* ========================================================
       CLONADO SEGURO
       ======================================================== */

    function cloneSafe(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }

        try {
            if (
                typeof structuredClone ===
                "function"
            ) {
                return structuredClone(
                    value
                );
            }

            return JSON.parse(
                JSON.stringify(value)
            );
        } catch {
            return value;
        }
    }

    /* ========================================================
       ERRORES
       ======================================================== */

    function createError(
        code,
        message
    ) {
        const error =
            new Error(message);

        error.name =
            "AppEventsError";

        error.code = code;

        return error;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        emit,
        emitError,
        notify,

        on,
        once,
        off,
        clear,

        waitFor,

        listenerCount,
        listEvents,
        hasListeners,

        constants: Object.freeze({
            EVENT_NAMES
        })
    });

})();

window.AppEvents = AppEvents;
