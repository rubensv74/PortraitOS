"use strict";

/* ============================================================
   PortraitOS
   Wizard Controller
   ------------------------------------------------------------
   Responsabilidad:
   - Gestionar el flujo principal de creación del perfil.
   - Controlar navegación, progreso y validación por pasos.
   - Sincronizar estado con ProfileService y Router.
   - Persistir el progreso localmente.
   ============================================================ */

const Wizard = (() => {

    const STORAGE_KEY =
        window.AppConstants
            ?.WIZARD
            ?.STORAGE_KEY ||
        "portraitos.wizard";

    const DEFAULT_STEP =
        window.AppConstants
            ?.WIZARD
            ?.DEFAULT_STEP ||
        "profile";

    const DEFAULT_STEPS =
        window.AppConstants
            ?.WIZARD
            ?.STEPS || [
                {
                    id: "profile",
                    index: 0,
                    title: "Perfil"
                },
                {
                    id: "photos",
                    index: 1,
                    title: "Fotografías"
                },
                {
                    id: "identity",
                    index: 2,
                    title: "Identidad"
                },
                {
                    id: "direction",
                    index: 3,
                    title: "Dirección creativa"
                },
                {
                    id: "validation",
                    index: 4,
                    title: "Validación"
                },
                {
                    id: "prompt",
                    index: 5,
                    title: "Generación"
                }
            ];

    let state =
        createInitialState();

    let initialized = false;

    /* ========================================================
       INICIALIZACIÓN
       ======================================================== */

    function init(options = {}) {
        if (initialized) {
            return getState();
        }

        validateDependencies();

        state.steps =
            normalizeSteps(
                options.steps ||
                DEFAULT_STEPS
            );

        restoreState();

        normalizeState();

        bindApplicationEvents();

        initialized = true;

        emitChanged(
            "initialized"
        );

        return getState();
    }

    function destroy() {
        initialized = false;

        state =
            createInitialState();

        removeStoredState();

        return true;
    }

    /* ========================================================
       ESTADO
       ======================================================== */

    function createInitialState() {
        return {
            currentStepId:
                DEFAULT_STEP,

            completedSteps:
                [],

            visitedSteps:
                [DEFAULT_STEP],

            invalidSteps:
                [],

            skippedSteps:
                [],

            steps:
                normalizeSteps(
                    DEFAULT_STEPS
                ),

            startedAt:
                null,

            updatedAt:
                null,

            completedAt:
                null,

            completed:
                false,

            busy:
                false,

            lastAction:
                ""
        };
    }

    function getState() {
        return clone(state);
    }

    function getCurrentStep() {
        return getStep(
            state.currentStepId
        );
    }

    function getStep(stepId) {
        const normalized =
            normalizeText(stepId);

        return (
            state.steps.find(
                step =>
                    step.id === normalized
            ) || null
        );
    }

    function getStepIndex(stepId) {
        const step =
            getStep(stepId);

        return step
            ? step.index
            : -1;
    }

    function getProgress() {
        const total =
            state.steps.length;

        if (!total) {
            return {
                completed: 0,
                total: 0,
                percentage: 0
            };
        }

        const completed =
            state.completedSteps.length;

        return {
            completed,
            total,
            percentage:
                Math.round(
                    completed /
                    total *
                    100
                )
        };
    }

    /* ========================================================
       NAVEGACIÓN
       ======================================================== */

    function goTo(
        stepId,
        options = {}
    ) {
        assertInitialized();

        const target =
            getStep(stepId);

        if (!target) {
            throw createError(
                "UNKNOWN_WIZARD_STEP",
                `El paso "${stepId}" no existe.`
            );
        }

        const current =
            getCurrentStep();

        if (
            options.validateCurrent !==
                false &&
            current &&
            current.id !== target.id
        ) {
            const validation =
                validateStep(
                    current.id,
                    {
                        silent: true
                    }
                );

            if (
                !validation.valid &&
                options.force !== true
            ) {
                markInvalid(
                    current.id
                );

                emitValidationFailed(
                    current.id,
                    validation
                );

                return {
                    changed: false,
                    reason:
                        "current-step-invalid",
                    validation
                };
            }
        }

        state.currentStepId =
            target.id;

        addUnique(
            state.visitedSteps,
            target.id
        );

        touch("navigate");

        persistState();

        syncRoute(
            target.id
        );

        emitChanged(
            "navigate"
        );

        return {
            changed: true,
            step:
                clone(target)
        };
    }

    function next(options = {}) {
        assertInitialized();

        const current =
            getCurrentStep();

        if (!current) {
            return goTo(
                state.steps[0]?.id
            );
        }

        const validation =
            validateStep(
                current.id,
                {
                    silent: true
                }
            );

        if (
            !validation.valid &&
            options.force !== true
        ) {
            markInvalid(
                current.id
            );

            emitValidationFailed(
                current.id,
                validation
            );

            return {
                changed: false,
                reason:
                    "step-invalid",
                validation
            };
        }

        markCompleted(
            current.id,
            {
                silent: true
            }
        );

        const nextStep =
            state.steps.find(
                step =>
                    step.index >
                    current.index
            );

        if (!nextStep) {
            return complete();
        }

        return goTo(
            nextStep.id,
            {
                validateCurrent: false
            }
        );
    }

    function previous() {
        assertInitialized();

        const current =
            getCurrentStep();

        if (!current) {
            return {
                changed: false
            };
        }

        const previousStep =
            [...state.steps]
                .reverse()
                .find(
                    step =>
                        step.index <
                        current.index
                );

        if (!previousStep) {
            return {
                changed: false,
                reason:
                    "first-step"
            };
        }

        return goTo(
            previousStep.id,
            {
                validateCurrent: false
            }
        );
    }

    function first() {
        const firstStep =
            state.steps[0];

        return firstStep
            ? goTo(
                firstStep.id,
                {
                    validateCurrent: false
                }
            )
            : null;
    }

    function last() {
        const lastStep =
            state.steps[
                state.steps.length - 1
            ];

        return lastStep
            ? goTo(
                lastStep.id,
                {
                    validateCurrent: false
                }
            )
            : null;
    }

    /* ========================================================
       VALIDACIÓN POR PASOS
       ======================================================== */

    function validateStep(
        stepId,
        options = {}
    ) {
        assertInitialized();

        const step =
            getStep(stepId);

        if (!step) {
            throw createError(
                "UNKNOWN_WIZARD_STEP",
                `El paso "${stepId}" no existe.`
            );
        }

        let result;

        switch (step.id) {
            case "profile":
                result =
                    validateProfileStep();
                break;

            case "photos":
                result =
                    validatePhotosStep();
                break;

            case "identity":
                result =
                    validateIdentityStep();
                break;

            case "direction":
                result =
                    validateDirectionStep();
                break;

            case "validation":
                result =
                    validateValidationStep();
                break;

            case "prompt":
                result =
                    validatePromptStep();
                break;

            default:
                result =
                    createValidationResult(
                        true
                    );
        }

        if (result.valid) {
            removeValue(
                state.invalidSteps,
                step.id
            );
        } else {
            addUnique(
                state.invalidSteps,
                step.id
            );
        }

        if (options.silent !== true) {
            emit(
                "wizard:step-validated",
                {
                    stepId:
                        step.id,
                    result:
                        clone(result)
                }
            );
        }

        return result;
    }

    function validateAll() {
        const results =
            state.steps.map(
                step => ({
                    stepId:
                        step.id,
                    result:
                        validateStep(
                            step.id,
                            {
                                silent: true
                            }
                        )
                })
            );

        const errors =
            results.flatMap(
                item =>
                    item.result.errors
            );

        const valid =
            errors.length === 0;

        state.invalidSteps =
            results
                .filter(
                    item =>
                        !item.result.valid
                )
                .map(
                    item =>
                        item.stepId
                );

        touch("validate-all");

        persistState();

        emit(
            "wizard:validated",
            {
                valid,
                results:
                    clone(results),
                errors:
                    clone(errors)
            }
        );

        return {
            valid,
            results,
            errors
        };
    }

    function validateProfileStep() {
        const profile =
            ProfileService.getActive();

        const errors = [];

        if (!profile) {
            errors.push(
                createFinding(
                    "PROFILE_REQUIRED",
                    "Debe crear o cargar un perfil."
                )
            );
        } else if (
            !normalizeText(
                profile.name
            )
        ) {
            errors.push(
                createFinding(
                    "PROFILE_NAME_REQUIRED",
                    "El perfil debe tener un nombre."
                )
            );
        }

        return createValidationResult(
            errors.length === 0,
            errors
        );
    }

    function validatePhotosStep() {
        const summary =
            ProfileService.photos
                .summary();

        const errors = [];

        if (
            Number(summary.count || 0) < 1
        ) {
            errors.push(
                createFinding(
                    "PHOTO_REQUIRED",
                    "Debe añadir al menos una fotografía."
                )
            );
        }

        if (
            !summary.primaryPhotoId
        ) {
            errors.push(
                createFinding(
                    "PRIMARY_PHOTO_REQUIRED",
                    "Debe seleccionar una fotografía principal."
                )
            );
        }

        return createValidationResult(
            errors.length === 0,
            errors
        );
    }

    function validateIdentityStep() {
        const report =
            ProfileService.identity
                .summary();

        const errors = [];

        if (
            Number(
                report.completeness || 0
            ) < 70
        ) {
            errors.push(
                createFinding(
                    "IDENTITY_INCOMPLETE",
                    "La identidad debe alcanzar al menos un 70 % de completitud."
                )
            );
        }

        if (
            report.locked !== true
        ) {
            errors.push(
                createFinding(
                    "IDENTITY_NOT_LOCKED",
                    "La identidad debe validarse y bloquearse."
                )
            );
        }

        return createValidationResult(
            errors.length === 0,
            errors
        );
    }

    function validateDirectionStep() {
        const result =
            ProfileService.direction
                .validate();

        return createValidationResult(
            result.valid === true,
            result.errors || [],
            result.warnings || []
        );
    }

    function validateValidationStep() {
        const report =
            ProfileService
                .validateForPrompt();

        return createValidationResult(
            report.valid === true,
            report.errors || [],
            report.warnings || []
        );
    }

    function validatePromptStep() {
        const errors = [];

        try {
            PromptEngine.generate(
                ProfileService.getActive(),
                {
                    strict: true
                }
            );
        } catch (error) {
            errors.push(
                createFinding(
                    error.code ||
                    "PROMPT_GENERATION_FAILED",
                    error.message
                )
            );
        }

        return createValidationResult(
            errors.length === 0,
            errors
        );
    }

    /* ========================================================
       FINALIZACIÓN
       ======================================================== */

    function markCompleted(
        stepId,
        options = {}
    ) {
        const step =
            getStep(stepId);

        if (!step) {
            throw createError(
                "UNKNOWN_WIZARD_STEP",
                `El paso "${stepId}" no existe.`
            );
        }

        addUnique(
            state.completedSteps,
            step.id
        );

        removeValue(
            state.invalidSteps,
            step.id
        );

        touch("step-completed");

        persistState();

        if (options.silent !== true) {
            emit(
                "wizard:step-completed",
                {
                    step:
                        clone(step),
                    progress:
                        getProgress()
                }
            );
        }

        return getState();
    }

    function skip(stepId) {
        const step =
            getStep(stepId);

        if (!step) {
            throw createError(
                "UNKNOWN_WIZARD_STEP",
                `El paso "${stepId}" no existe.`
            );
        }

        addUnique(
            state.skippedSteps,
            step.id
        );

        touch("step-skipped");

        persistState();

        return next({
            force: true
        });
    }

    function complete() {
        const validation =
            validateAll();

        if (!validation.valid) {
            const firstInvalid =
                state.invalidSteps[0];

            if (firstInvalid) {
                goTo(
                    firstInvalid,
                    {
                        force: true,
                        validateCurrent: false
                    }
                );
            }

            return {
                completed: false,
                validation
            };
        }

        state.completed = true;

        state.completedAt =
            new Date().toISOString();

        state.completedSteps =
            state.steps.map(
                step =>
                    step.id
            );

        touch("completed");

        persistState();

        emit(
            "wizard:completed",
            {
                state:
                    getState(),
                profile:
                    ProfileService
                        .getActive()
            }
        );

        return {
            completed: true,
            state:
                getState()
        };
    }

    function reset(options = {}) {
        const preservedSteps =
            state.steps;

        state =
            createInitialState();

        state.steps =
            preservedSteps;

        if (
            options.keepProfile !== true
        ) {
            ProfileService
                .clearActive();
        }

        removeStoredState();

        emitChanged(
            "reset"
        );

        return getState();
    }

    /* ========================================================
       PERSISTENCIA
       ======================================================== */

    function persistState() {
        const serialized =
            JSON.stringify(state);

        if (
            window.StorageService &&
            typeof StorageService.set ===
                "function"
        ) {
            StorageService.set(
                STORAGE_KEY,
                serialized
            );
        } else {
            localStorage.setItem(
                STORAGE_KEY,
                serialized
            );
        }
    }

    function restoreState() {
        let serialized = null;

        if (
            window.StorageService &&
            typeof StorageService.get ===
                "function"
        ) {
            serialized =
                StorageService.get(
                    STORAGE_KEY
                );
        } else {
            serialized =
                localStorage.getItem(
                    STORAGE_KEY
                );
        }

        if (!serialized) {
            return false;
        }

        try {
            const restored =
                typeof serialized ===
                    "string"
                    ? JSON.parse(
                        serialized
                    )
                    : serialized;

            if (
                restored &&
                typeof restored ===
                    "object"
            ) {
                state = {
                    ...state,
                    ...restored,
                    steps:
                        state.steps
                };

                return true;
            }
        } catch (error) {
            emitError(
                error,
                {
                    action:
                        "restore-wizard-state"
                }
            );
        }

        return false;
    }

    function removeStoredState() {
        if (
            window.StorageService &&
            typeof StorageService.remove ===
                "function"
        ) {
            StorageService.remove(
                STORAGE_KEY
            );
        } else {
            localStorage.removeItem(
                STORAGE_KEY
            );
        }
    }

    /* ========================================================
       EVENTOS
       ======================================================== */

    function bindApplicationEvents() {
        if (
            !window.AppEvents ||
            typeof AppEvents.on !==
                "function"
        ) {
            return;
        }

        AppEvents.on(
            "profile:cleared",
            () => {
                reset({
                    keepProfile: true
                });
            }
        );

        AppEvents.on(
            "profile:photo-added",
            () => {
                invalidateFollowing(
                    "photos"
                );
            }
        );

        AppEvents.on(
            "profile:photo-removed",
            () => {
                invalidateFollowing(
                    "photos"
                );
            }
        );

        AppEvents.on(
            "identity:updated",
            () => {
                invalidateFollowing(
                    "identity"
                );
            }
        );

        AppEvents.on(
            "direction:updated",
            () => {
                invalidateFollowing(
                    "direction"
                );
            }
        );
    }

    function invalidateFollowing(
        stepId
    ) {
        const index =
            getStepIndex(stepId);

        state.completedSteps =
            state.completedSteps
                .filter(
                    completedId =>
                        getStepIndex(
                            completedId
                        ) < index
                );

        state.completed = false;
        state.completedAt = null;

        touch(
            "invalidate-following"
        );

        persistState();
    }

    function emitChanged(reason) {
        emit(
            "wizard:changed",
            {
                reason,
                state:
                    getState(),
                currentStep:
                    getCurrentStep(),
                progress:
                    getProgress()
            }
        );
    }

    function emitValidationFailed(
        stepId,
        validation
    ) {
        emit(
            "wizard:validation-failed",
            {
                stepId,
                validation:
                    clone(validation)
            }
        );
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
                {
                    detail
                }
            )
        );
    }

    function emitError(
        error,
        context
    ) {
        if (
            window.AppEvents &&
            typeof AppEvents.emitError ===
                "function"
        ) {
            AppEvents.emitError(
                error,
                context
            );
        }
    }

    /* ========================================================
       UTILIDADES
       ======================================================== */

    function normalizeSteps(steps) {
        if (!Array.isArray(steps)) {
            return [];
        }

        return steps
            .map(
                (step, index) => ({
                    id:
                        normalizeText(
                            step.id
                        ),

                    index:
                        Number.isFinite(
                            Number(
                                step.index
                            )
                        )
                            ? Number(
                                step.index
                            )
                            : index,

                    title:
                        normalizeText(
                            step.title
                        ),

                    description:
                        normalizeText(
                            step.description
                        ),

                    optional:
                        step.optional ===
                        true
                })
            )
            .filter(
                step =>
                    step.id
            )
            .sort(
                (a, b) =>
                    a.index -
                    b.index
            );
    }

    function normalizeState() {
        if (
            !getStep(
                state.currentStepId
            )
        ) {
            state.currentStepId =
                state.steps[0]?.id ||
                DEFAULT_STEP;
        }

        state.completedSteps =
            normalizeStepIdList(
                state.completedSteps
            );

        state.visitedSteps =
            normalizeStepIdList(
                state.visitedSteps
            );

        state.invalidSteps =
            normalizeStepIdList(
                state.invalidSteps
            );

        state.skippedSteps =
            normalizeStepIdList(
                state.skippedSteps
            );

        if (!state.startedAt) {
            state.startedAt =
                new Date().toISOString();
        }
    }

    function normalizeStepIdList(
        values
    ) {
        return [
            ...new Set(
                (
                    Array.isArray(values)
                        ? values
                        : []
                )
                    .map(
                        normalizeText
                    )
                    .filter(
                        id =>
                            Boolean(
                                getStep(id)
                            )
                    )
            )
        ];
    }

    function createValidationResult(
        valid,
        errors = [],
        warnings = []
    ) {
        return {
            valid:
                valid === true,

            errors:
                normalizeFindings(
                    errors
                ),

            warnings:
                normalizeFindings(
                    warnings
                )
        };
    }

    function normalizeFindings(
        findings
    ) {
        const list =
            Array.isArray(findings)
                ? findings
                : findings
                    ? [findings]
                    : [];

        return list.map(
            finding => {
                if (
                    typeof finding ===
                    "string"
                ) {
                    return createFinding(
                        "VALIDATION_ERROR",
                        finding
                    );
                }

                return {
                    code:
                        normalizeText(
                            finding.code
                        ) ||
                        "VALIDATION_ERROR",

                    message:
                        normalizeText(
                            finding.message
                        ) ||
                        "El paso no es válido.",

                    field:
                        normalizeText(
                            finding.field
                        )
                };
            }
        );
    }

    function createFinding(
        code,
        message,
        field = ""
    ) {
        return {
            code,
            message,
            field
        };
    }

    function addUnique(
        list,
        value
    ) {
        if (!list.includes(value)) {
            list.push(value);
        }
    }

    function removeValue(
        list,
        value
    ) {
        const index =
            list.indexOf(value);

        if (index >= 0) {
            list.splice(
                index,
                1
            );
        }
    }

    function touch(action) {
        const now =
            new Date().toISOString();

        state.updatedAt = now;
        state.lastAction = action;

        if (!state.startedAt) {
            state.startedAt = now;
        }
    }

    function syncRoute(stepId) {
        if (
            window.Router &&
            typeof Router.navigate ===
                "function"
        ) {
            Router.navigate(
                stepId,
                {
                    silent: true
                }
            );
        }
    }

    function normalizeText(value) {
        return String(
            value ?? ""
        ).trim();
    }

    function clone(value) {
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
    }

    function assertInitialized() {
        if (!initialized) {
            init();
        }
    }

    function validateDependencies() {
        const required = [
            "ProfileService",
            "PromptEngine"
        ];

        const missing =
            required.filter(
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

    function createError(
        code,
        message
    ) {
        const error =
            new Error(message);

        error.name =
            "WizardError";

        error.code = code;

        return error;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        init,
        destroy,
        reset,

        getState,
        getCurrentStep,
        getStep,
        getStepIndex,
        getProgress,

        goTo,
        next,
        previous,
        first,
        last,

        validateStep,
        validateAll,

        markCompleted,
        skip,
        complete
    });

})();

window.Wizard = Wizard;
