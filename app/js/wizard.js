/* ===========================================================
   PortraitOS
   Wizard Engine
   =========================================================== */

"use strict";

const PortraitWizard = (() => {

    /* =======================================================
       ESTADO
       ======================================================= */

    let profile = null;

    let settings = null;

    let session = null;

    let currentStep = 0;

    let initialized = false;

    let autoSaveTimer = null;

    const listeners = new Set();


    /* =======================================================
       PASOS
       ======================================================= */

    const STEPS = Object.freeze([

        {
            id: "photos",
            title: "Fotografías",
            required: true
        },

        {
            id: "identity",
            title: "Identity Contract™",
            required: true
        },

        {
            id: "faceLock",
            title: "Face Lock™",
            required: true
        },

        {
            id: "goal",
            title: "Objetivo",
            required: true
        },

        {
            id: "perception",
            title: "Percepción",
            required: true
        },

        {
            id: "summary",
            title: "Resumen",
            required: false
        }

    ]);


    /* =======================================================
       INICIALIZACIÓN
       ======================================================= */

    function initialize() {

        if (initialized) {

            return;

        }

        profile =
            PortraitStorage.loadProfile();

        settings =
            PortraitStorage.loadSettings();

        session =
            PortraitStorage.loadSession();

        currentStep =
            session.currentStep || 0;

        PortraitRouter.start();

        PortraitRouter.subscribe(onRouteChanged);

        initialized = true;

        emitChange();

    }


    /* =======================================================
       EVENTOS
       ======================================================= */

    function subscribe(callback) {

        listeners.add(callback);

        return () => listeners.delete(callback);

    }


    function emitChange() {

        const state = getState();

        listeners.forEach(listener => {

            listener(state);

        });

    }


    /* =======================================================
       ESTADO PÚBLICO
       ======================================================= */

    function getState() {

        return {

            profile,

            settings,

            session,

            currentStep,

            totalSteps: STEPS.length,

            step:

                STEPS[currentStep],

            route:

                PortraitRouter.getCurrentRoute()

        };

    }


    /* =======================================================
       CAMBIO DE RUTA
       ======================================================= */

    function onRouteChanged(event) {

        currentStep = event.route.step;

        session.currentStep = currentStep;

        PortraitStorage.saveSession(session);

        emitChange();

    }


    /* =======================================================
       API
       ======================================================= */

    return {

        initialize,

        subscribe,

        getState

    };

})();

window.PortraitWizard = PortraitWizard;
