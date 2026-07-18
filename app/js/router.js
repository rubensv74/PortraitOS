/* ===========================================================
   PortraitOS
   Router
   =========================================================== */

"use strict";

const PortraitRouter = (() => {

    /* =======================================================
       CONFIGURACIÓN
       ======================================================= */

    const DEFAULT_ROUTE = "photos";

    const ROUTES = Object.freeze({

        photos: {

            id: "photos",

            path: "#/photos",

            title: "Fotografías",

            eyebrow: "Identidad visual",

            description:
                "Carga las fotografías que actuarán como referencia de identidad para todo el proceso.",

            step: 0

        },

        identity: {

            id: "identity",

            path: "#/identity",

            title: "Identity Contract™",

            eyebrow: "Contrato de identidad",

            description:
                "Define qué rasgos deben conservarse de forma estricta en cualquier retrato generado.",

            step: 1

        },

        faceLock: {

            id: "faceLock",

            path: "#/face-lock",

            title: "Face Lock™",

            eyebrow: "Control de fidelidad",

            description:
                "Configura el nivel de bloqueo facial y la prioridad absoluta de la identidad.",

            step: 2

        },

        goal: {

            id: "goal",

            path: "#/goal",

            title: "Objetivo",

            eyebrow: "Dirección del retrato",

            description:
                "Selecciona el propósito profesional, editorial o personal del retrato.",

            step: 3

        },

        perception: {

            id: "perception",

            path: "#/perception",

            title: "Percepción",

            eyebrow: "Lectura visual",

            description:
                "Define cómo debe percibirse la persona sin alterar su identidad real.",

            step: 4

        },

        summary: {

            id: "summary",

            path: "#/summary",

            title: "Resumen",

            eyebrow: "Compilación final",

            description:
                "Revisa el contrato de identidad y la dirección creativa antes de generar el resultado.",

            step: 5

        }

    });


    /* =======================================================
       ESTADO
       ======================================================= */

    let currentRoute = null;

    let started = false;

    const listeners = new Set();


    /* =======================================================
       UTILIDADES
       ======================================================= */

    function normalizeHash(hash) {

        const value =
            String(hash || "")
                .trim()
                .toLowerCase();

        if (
            value === "" ||
            value === "#" ||
            value === "#/"
        ) {

            return ROUTES[DEFAULT_ROUTE].path;

        }

        if (!value.startsWith("#")) {

            return `#/${value.replace(/^\/+/, "")}`;

        }

        if (value.startsWith("#/")) {

            return value;

        }

        return `#/${value.substring(1).replace(/^\/+/, "")}`;

    }


    function getRouteByPath(path) {

        const normalizedPath =
            normalizeHash(path);

        return Object.values(ROUTES)
            .find(
                route =>
                    route.path.toLowerCase() ===
                    normalizedPath
            ) || null;

    }


    function getRouteById(routeId) {

        return ROUTES[routeId] || null;

    }


    function getRouteByStep(step) {

        const numericStep =
            Number(step);

        return Object.values(ROUTES)
            .find(
                route =>
                    route.step === numericStep
            ) || null;

    }


    function getCurrentHash() {

        return normalizeHash(
            window.location.hash
        );

    }


    function cloneRoute(route) {

        if (!route) {

            return null;

        }

        return {
            ...route
        };

    }


    /* =======================================================
       EVENTOS
       ======================================================= */

    function emit(route, previousRoute = null) {

        const event = {

            route:
                cloneRoute(route),

            previousRoute:
                cloneRoute(previousRoute),

            timestamp:
                new Date().toISOString()

        };

        listeners.forEach(
            listener => {

                try {

                    listener(event);

                } catch (error) {

                    console.error(
                        "PortraitOS Router: error en un listener.",
                        error
                    );

                }

            }
        );

        window.dispatchEvent(
            new CustomEvent(
                "portraitos:routechange",
                {
                    detail: event
                }
            )
        );

    }


    function subscribe(listener) {

        if (
            typeof listener !== "function"
        ) {

            throw new TypeError(
                "PortraitOS Router: el listener debe ser una función."
            );

        }

        listeners.add(listener);

        return function unsubscribe() {

            listeners.delete(listener);

        };

    }


    /* =======================================================
       RESOLUCIÓN
       ======================================================= */

    function resolveCurrentRoute() {

        const hash =
            getCurrentHash();

        const route =
            getRouteByPath(hash);

        return (
            route ||
            ROUTES[DEFAULT_ROUTE]
        );

    }


    function applyRoute(route, options = {}) {

        const {

            replace = false,

            force = false,

            emitEvent = true

        } = options;

        if (!route) {

            return false;

        }

        const previousRoute =
            currentRoute;

        const isSameRoute =
            previousRoute?.id === route.id;

        if (
            isSameRoute &&
            !force
        ) {

            return true;

        }

        currentRoute =
            cloneRoute(route);

        if (
            window.location.hash !== route.path
        ) {

            if (replace) {

                const url =
                    `${window.location.pathname}${window.location.search}${route.path}`;

                window.history.replaceState(
                    null,
                    "",
                    url
                );

            } else {

                window.location.hash =
                    route.path;

            }

        }

        updateDocumentTitle(route);

        if (emitEvent) {

            emit(
                route,
                previousRoute
            );

        }

        return true;

    }


    function handleHashChange() {

        const resolvedRoute =
            resolveCurrentRoute();

        const hash =
            getCurrentHash();

        const routeIsValid =
            Boolean(
                getRouteByPath(hash)
            );

        if (!routeIsValid) {

            applyRoute(
                ROUTES[DEFAULT_ROUTE],
                {
                    replace: true,
                    force: true
                }
            );

            return;

        }

        const previousRoute =
            currentRoute;

        currentRoute =
            cloneRoute(
                resolvedRoute
            );

        updateDocumentTitle(
            resolvedRoute
        );

        emit(
            resolvedRoute,
            previousRoute
        );

    }


    /* =======================================================
       NAVEGACIÓN
       ======================================================= */

    function navigateTo(routeId, options = {}) {

        const route =
            getRouteById(routeId);

        if (!route) {

            console.warn(
                `PortraitOS Router: la ruta "${routeId}" no existe.`
            );

            return false;

        }

        return applyRoute(
            route,
            options
        );

    }


    function navigateToStep(step, options = {}) {

        const route =
            getRouteByStep(step);

        if (!route) {

            console.warn(
                `PortraitOS Router: el paso "${step}" no existe.`
            );

            return false;

        }

        return applyRoute(
            route,
            options
        );

    }


    function next(options = {}) {

        const route =
            currentRoute ||
            resolveCurrentRoute();

        const nextRoute =
            getRouteByStep(
                route.step + 1
            );

        if (!nextRoute) {

            return false;

        }

        return applyRoute(
            nextRoute,
            options
        );

    }


    function previous(options = {}) {

        const route =
            currentRoute ||
            resolveCurrentRoute();

        const previousRoute =
            getRouteByStep(
                route.step - 1
            );

        if (!previousRoute) {

            return false;

        }

        return applyRoute(
            previousRoute,
            options
        );

    }


    function goToFirst(options = {}) {

        return applyRoute(
            ROUTES[DEFAULT_ROUTE],
            options
        );

    }


    function goToLast(options = {}) {

        return applyRoute(
            ROUTES.summary,
            options
        );

    }


    /* =======================================================
       BLOQUEO POR PASOS
       ======================================================= */

    function canNavigateToStep(
        targetStep,
        session
    ) {

        const numericStep =
            Number(targetStep);

        if (
            !Number.isInteger(numericStep) ||
            numericStep < 0
        ) {

            return false;

        }

        if (numericStep === 0) {

            return true;

        }

        const completedSteps =
            Array.isArray(
                session?.completedSteps
            )
                ? session.completedSteps
                : [];

        for (
            let step = 0;
            step < numericStep;
            step += 1
        ) {

            if (
                !completedSteps.includes(step)
            ) {

                return false;

            }

        }

        return true;

    }


    function navigateWithGuard(
        routeId,
        session,
        options = {}
    ) {

        const route =
            getRouteById(routeId);

        if (!route) {

            return {

                success: false,

                reason: "route-not-found"

            };

        }

        const allowed =
            canNavigateToStep(
                route.step,
                session
            );

        if (!allowed) {

            return {

                success: false,

                reason: "step-locked",

                route:
                    cloneRoute(route)

            };

        }

        applyRoute(
            route,
            options
        );

        return {

            success: true,

            route:
                cloneRoute(route)

        };

    }


    /* =======================================================
       DOCUMENTO
       ======================================================= */

    function updateDocumentTitle(route) {

        const title =
            route?.title ||
            "PortraitOS";

        document.title =
            `${title} · PortraitOS`;

    }


    /* =======================================================
       INICIALIZACIÓN
       ======================================================= */

    function start() {

        if (started) {

            return cloneRoute(
                currentRoute
            );

        }

        started = true;

        window.addEventListener(
            "hashchange",
            handleHashChange
        );

        const resolvedRoute =
            resolveCurrentRoute();

        const currentHash =
            getCurrentHash();

        const routeIsValid =
            Boolean(
                getRouteByPath(
                    currentHash
                )
            );

        if (!routeIsValid) {

            applyRoute(
                ROUTES[DEFAULT_ROUTE],
                {
                    replace: true,
                    force: true
                }
            );

        } else {

            currentRoute =
                cloneRoute(
                    resolvedRoute
                );

            updateDocumentTitle(
                resolvedRoute
            );

            emit(
                resolvedRoute,
                null
            );

        }

        return cloneRoute(
            currentRoute
        );

    }


    function stop() {

        if (!started) {

            return;

        }

        window.removeEventListener(
            "hashchange",
            handleHashChange
        );

        started = false;

    }


    /* =======================================================
       CONSULTAS
       ======================================================= */

    function getCurrentRoute() {

        return cloneRoute(
            currentRoute ||
            resolveCurrentRoute()
        );

    }


    function getRoutes() {

        return Object.values(ROUTES)
            .map(cloneRoute);
    }


    function isFirstRoute() {

        return (
            getCurrentRoute()?.step === 0
        );

    }


    function isLastRoute() {

        return (
            getCurrentRoute()?.step ===
            getRoutes().length - 1
        );

    }


    /* =======================================================
       API PÚBLICA
       ======================================================= */

    return {

        DEFAULT_ROUTE,

        ROUTES,

        start,

        stop,

        subscribe,

        navigateTo,

        navigateToStep,

        navigateWithGuard,

        next,

        previous,

        goToFirst,

        goToLast,

        getCurrentRoute,

        getRoutes,

        getRouteById,

        getRouteByPath,

        getRouteByStep,

        canNavigateToStep,

        isFirstRoute,

        isLastRoute

    };

})();


/* ===========================================================
   EXPOSICIÓN GLOBAL
   =========================================================== */

window.PortraitRouter =
    PortraitRouter;
