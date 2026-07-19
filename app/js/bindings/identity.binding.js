"use strict";

/* ============================================================
   PortraitOS
   Identity Binding
   ------------------------------------------------------------
   Responsabilidad:
   - Sincronizar el formulario de identidad con el perfil activo.
   - Actualizar campos anidados mediante rutas data-identity-field.
   - Calcular la completitud del contrato de identidad.
   - Ejecutar validaciones.
   - Bloquear y desbloquear la identidad.
   - Impedir cambios cuando la identidad está bloqueada.
   - Mantener sincronizados formulario, servicios y wizard.
   ============================================================ */

const IdentityBinding = (() => {

    const SELECTORS = Object.freeze({
        FIELD:
            "[data-identity-field]",

        STATUS:
            "[data-identity-status]",

        COMPLETENESS:
            "[data-identity-completeness]",

        VALIDATE_ACTION:
            "[data-action='identity-validate']",

        LOCK_ACTION:
            "[data-action='identity-lock']",

        UNLOCK_ACTION:
            "[data-action='identity-unlock']",

        PANEL:
            "[data-step-panel='identity']"
    });

    const CLASSES = Object.freeze({
        INVALID:
            "is-invalid",

        VALID:
            "is-valid",

        DIRTY:
            "is-dirty",

        LOCKED:
            "is-locked",

        COMPLETE:
            "is-complete",

        WARNING:
            "is-warning"
    });

    const AUTOSAVE_DELAY = 700;

    const REQUIRED_PATHS = Object.freeze([
        "general.age",
        "face.shape",
        "face.proportions",
        "skin.description",
        "eyes.description",
        "nose.description",
        "mouth.description",
        "jaw.description",
        "hair.description",
        "distinctive-features.description"
    ]);

    const RECOMMENDED_PATHS = Object.freeze([
        "asymmetries.description",
        "age-markers.description",
        "facial-hair.description"
    ]);

    let initialized = false;
    let root = document;

    let fields = [];
    let statusElement = null;
    let completenessElement = null;
    let panel = null;

    let subscriptions = [];
    let autosaveTimer = null;

    let dirty = false;
    let syncing = false;
    let locked = false;

    /* ========================================================
       INICIALIZACIÓN
       ======================================================== */

    function init(options = {}) {
        if (initialized) {
            return getState();
        }

        validateDependencies();

        root =
            options.root ||
            document;

        cacheElements();
        bindDomEvents();
        bindApplicationEvents();

        load();

        initialized = true;

        emit(
            "binding:identity-ready",
            {
                fieldCount:
                    fields.length,
                locked,
                completeness:
                    calculateCompleteness()
            }
        );

        return getState();
    }

    function destroy() {
        fields.forEach(
            field => {
                field.removeEventListener(
                    "input",
                    handleFieldInput
                );

                field.removeEventListener(
                    "change",
                    handleFieldChange
                );

                field.removeEventListener(
                    "blur",
                    handleFieldBlur
                );
            }
        );

        root
            .querySelector(
                SELECTORS.VALIDATE_ACTION
            )
            ?.removeEventListener(
                "click",
                handleValidate
            );

        root
            .querySelector(
                SELECTORS.LOCK_ACTION
            )
            ?.removeEventListener(
                "click",
                handleLock
            );

        root
            .querySelector(
                SELECTORS.UNLOCK_ACTION
            )
            ?.removeEventListener(
                "click",
                handleUnlock
            );

        subscriptions.forEach(
            unsubscribe => {
                if (
                    typeof unsubscribe ===
                    "function"
                ) {
                    unsubscribe();
                }
            }
        );

        subscriptions = [];

        clearAutosave();

        fields = [];
        statusElement = null;
        completenessElement = null;
        panel = null;

        initialized = false;
        dirty = false;
        syncing = false;
        locked = false;

        return true;
    }

    function cacheElements() {
        fields =
            [
                ...root.querySelectorAll(
                    SELECTORS.FIELD
                )
            ];

        statusElement =
            root.querySelector(
                SELECTORS.STATUS
            );

        completenessElement =
            root.querySelector(
                SELECTORS.COMPLETENESS
            );

        panel =
            root.querySelector(
                SELECTORS.PANEL
            );
    }

    /* ========================================================
       CARGA
       ======================================================== */

    function load(profile = null) {
        const source =
            profile ||
            getActiveProfile();

        const identity =
            normalizeIdentity(
                source?.identity
            );

        syncing = true;

        fields.forEach(
            field => {
                const path =
                    normalizeText(
                        field.dataset
                            .identityField
                    );

                const value =
                    getPathValue(
                        identity,
                        path
                    );

                writeFieldValue(
                    field,
                    value
                );

                clearFieldValidation(
                    field
                );
            }
        );

        locked =
            identity.locked ===
                true ||
            identity.status ===
                "locked";

        syncing = false;
        dirty = false;

        renderLockState();
        renderCompleteness();
        renderStatus();

        emit(
            "binding:identity-loaded",
            {
                identity:
                    clone(identity)
            }
        );

        return clone(identity);
    }

    /* ========================================================
       EVENTOS DOM
       ======================================================== */

    function bindDomEvents() {
        fields.forEach(
            field => {
                field.addEventListener(
                    "input",
                    handleFieldInput
                );

                field.addEventListener(
                    "change",
                    handleFieldChange
                );

                field.addEventListener(
                    "blur",
                    handleFieldBlur
                );
            }
        );

        root
            .querySelector(
                SELECTORS.VALIDATE_ACTION
            )
            ?.addEventListener(
                "click",
                handleValidate
            );

        root
            .querySelector(
                SELECTORS.LOCK_ACTION
            )
            ?.addEventListener(
                "click",
                handleLock
            );

        root
            .querySelector(
                SELECTORS.UNLOCK_ACTION
            )
            ?.addEventListener(
                "click",
                handleUnlock
            );
    }

    function handleFieldInput(event) {
        if (
            syncing ||
            locked
        ) {
            return;
        }

        updateField(
            event.currentTarget,
            {
                validate: false,
                autosave: true
            }
        );
    }

    function handleFieldChange(event) {
        if (
            syncing ||
            locked
        ) {
            return;
        }

        updateField(
            event.currentTarget,
            {
                validate: true,
                autosave: true
            }
        );
    }

    function handleFieldBlur(event) {
        if (
            syncing ||
            locked
        ) {
            return;
        }

        validateField(
            event.currentTarget
        );
    }

    function handleValidate() {
        const result =
            validateAll();

        renderValidationSummary(
            result
        );

        if (result.valid) {
            notify(
                "El contrato de identidad es válido.",
                "success"
            );
        } else {
            notify(
                `La identidad contiene ${result.errors.length} campos que requieren revisión.`,
                "warning"
            );
        }
    }

    async function handleLock() {
        await lock();
    }

    async function handleUnlock() {
        await unlock();
    }

    /* ========================================================
       ACTUALIZACIÓN
       ======================================================== */

    function updateField(
        field,
        options = {}
    ) {
        if (locked) {
            notify(
                "La identidad está bloqueada y no puede modificarse.",
                "warning"
            );

            load();

            return null;
        }

        const path =
            normalizeText(
                field.dataset
                    .identityField
            );

        if (!path) {
            return null;
        }

        const value =
            normalizeFieldValue(
                readFieldValue(field)
            );

        const profile =
            getActiveProfile();

        if (!profile) {
            throw createError(
                "PROFILE_NOT_AVAILABLE",
                "No existe un perfil activo."
            );
        }

        const updated =
            clone(profile);

        updated.identity =
            normalizeIdentity(
                updated.identity
            );

        setPathValue(
            updated.identity,
            path,
            value
        );

        updated.identity.status =
            "draft";

        updated.identity.locked =
            false;

        updated.identity.updatedAt =
            new Date()
                .toISOString();

        updated.identity.completeness =
            calculateIdentityCompleteness(
                updated.identity
            );

        persistIdentity(
            updated.identity,
            updated
        );

        dirty = true;

        field.classList.add(
            CLASSES.DIRTY
        );

        if (
            options.validate ===
                true
        ) {
            validateField(field);
        }

        renderCompleteness();
        renderStatus();

        if (
            options.autosave !==
                false
        ) {
            scheduleAutosave();
        }

        emit(
            "identity:field-updated",
            {
                path,
                value:
                    clone(value),
                identity:
                    clone(
                        updated.identity
                    )
            }
        );

        return clone(
            updated.identity
        );
    }

    function persistIdentity(
        identity,
        profile = null
    ) {
        const service =
            getIdentityService();

        if (
            typeof service.update ===
                "function"
        ) {
            service.update(
                identity
            );

            return;
        }

        if (
            typeof service.set ===
                "function"
        ) {
            service.set(
                identity
            );

            return;
        }

        const updated =
            profile ||
            clone(
                getActiveProfile()
            );

        updated.identity =
            clone(identity);

        persistProfile(updated);
    }

    /* ========================================================
       AUTOGUARDADO
       ======================================================== */

    function scheduleAutosave() {
        clearAutosave();

        autosaveTimer =
            window.setTimeout(
                save,
                AUTOSAVE_DELAY
            );
    }

    function clearAutosave() {
        if (
            autosaveTimer !== null
        ) {
            window.clearTimeout(
                autosaveTimer
            );

            autosaveTimer = null;
        }
    }

    function save() {
        clearAutosave();

        if (!dirty) {
            return {
                saved: false,
                reason:
                    "no-changes"
            };
        }

        try {
            const profile =
                getActiveProfile();

            if (
                typeof ProfileService.save ===
                    "function"
            ) {
                ProfileService.save(
                    profile
                );
            }

            dirty = false;

            fields.forEach(
                field => {
                    field.classList
                        .remove(
                            CLASSES.DIRTY
                        );
                }
            );

            emit(
                "identity:autosaved",
                {
                    identity:
                        clone(
                            getIdentity()
                        )
                }
            );

            return {
                saved: true
            };
        } catch (error) {
            emitError(
                error,
                {
                    action:
                        "identity-autosave"
                }
            );

            return {
                saved: false,
                error
            };
        }
    }

    /* ========================================================
       VALIDACIÓN
       ======================================================== */

    function validateField(field) {
        const path =
            normalizeText(
                field.dataset
                    .identityField
            );

        const value =
            readFieldValue(field);

        const required =
            REQUIRED_PATHS.includes(
                path
            );

        let result =
            Validators.valid(value);

        if (required) {
            result =
                Validators.requiredText(
                    value,
                    {
                        field:
                            path,
                        label:
                            getFieldLabel(
                                field
                            )
                    }
                );
        }

        if (
            result.valid &&
            normalizeText(value)
        ) {
            result =
                Validators.textLength(
                    value,
                    {
                        field:
                            path,
                        label:
                            getFieldLabel(
                                field
                            ),
                        min:
                            required
                                ? 3
                                : 0,
                        max:
                            field.tagName ===
                                "TEXTAREA"
                                ? 2000
                                : 300
                    }
                );
        }

        renderFieldValidation(
            field,
            result
        );

        return result;
    }

    function validateAll() {
        const fieldResults =
            fields.map(
                field => ({
                    path:
                        field.dataset
                            .identityField,

                    result:
                        validateField(
                            field
                        )
                })
            );

        const errors =
            fieldResults.flatMap(
                item =>
                    item.result.errors ||
                    []
            );

        const identity =
            getIdentity();

        const warnings =
            RECOMMENDED_PATHS
                .filter(
                    path =>
                        !normalizeText(
                            getPathValue(
                                identity,
                                path
                            )
                        )
                )
                .map(
                    path => ({
                        code:
                            "IDENTITY_RECOMMENDED_FIELD_EMPTY",
                        field:
                            path,
                        message:
                            `Se recomienda completar «${getPathLabel(path)}».`
                    })
                );

        const engineValidation =
            validateWithEngine(
                identity
            );

        errors.push(
            ...(
                engineValidation.errors ||
                []
            )
        );

        warnings.push(
            ...(
                engineValidation.warnings ||
                []
            )
        );

        const result = {
            valid:
                errors.length === 0,

            errors:
                uniqueMessages(errors),

            warnings:
                uniqueMessages(
                    warnings
                ),

            completeness:
                calculateCompleteness(),

            identity:
                clone(identity),

            fieldResults
        };

        updateValidationState(
            result
        );

        emit(
            result.valid
                ? "identity:validation-succeeded"
                : "identity:validation-failed",
            clone(result)
        );

        return result;
    }

    function validateWithEngine(
        identity
    ) {
        if (
            window.IdentityEngine &&
            typeof IdentityEngine
                .validate ===
                "function"
        ) {
            const result =
                IdentityEngine.validate(
                    identity
                );

            return {
                errors:
                    Array.isArray(
                        result?.errors
                    )
                        ? result.errors
                        : [],

                warnings:
                    Array.isArray(
                        result?.warnings
                    )
                        ? result.warnings
                        : []
            };
        }

        return {
            errors: [],
            warnings: []
        };
    }

    function updateValidationState(
        result
    ) {
        const profile =
            getActiveProfile();

        if (!profile) {
            return;
        }

        const updated =
            clone(profile);

        updated.identity =
            normalizeIdentity(
                updated.identity
            );

        updated.identity.validation = {
            valid:
                result.valid,
            errors:
                clone(
                    result.errors
                ),
            warnings:
                clone(
                    result.warnings
                ),
            validatedAt:
                new Date()
                    .toISOString()
        };

        updated.identity.completeness =
            result.completeness;

        updated.identity.status =
            result.valid
                ? "validated"
                : "draft";

        persistIdentity(
            updated.identity,
            updated
        );

        renderStatus();
    }

    /* ========================================================
       BLOQUEO
       ======================================================== */

    async function lock(options = {}) {
        if (locked) {
            return {
                locked: true,
                reason:
                    "already-locked"
            };
        }

        const validation =
            validateAll();

        if (!validation.valid) {
            renderValidationSummary(
                validation
            );

            notify(
                "La identidad no puede bloquearse hasta corregir los errores.",
                "warning"
            );

            return {
                locked: false,
                validation
            };
        }

        let confirmed = true;

        if (
            options.confirm !==
                false &&
            window.UI &&
            typeof UI.confirm ===
                "function"
        ) {
            confirmed =
                await UI.confirm({
                    title:
                        "Bloquear identidad",
                    message:
                        "Los rasgos permanentes quedarán protegidos contra modificaciones accidentales.",
                    acceptLabel:
                        "Bloquear identidad",
                    cancelLabel:
                        "Cancelar"
                });
        }

        if (!confirmed) {
            return {
                locked: false,
                reason:
                    "cancelled"
            };
        }

        const identity =
            getIdentity();

        identity.locked =
            true;

        identity.status =
            "locked";

        identity.lockedAt =
            new Date()
                .toISOString();

        identity.completeness =
            calculateIdentityCompleteness(
                identity
            );

        const service =
            getIdentityService();

        if (
            typeof service.lock ===
                "function"
        ) {
            service.lock(
                identity
            );
        } else {
            persistIdentity(
                identity
            );
        }

        locked = true;
        dirty = false;

        renderLockState();
        renderStatus();

        notify(
            "La identidad ha quedado bloqueada.",
            "success"
        );

        emit(
            "identity:locked",
            {
                identity:
                    clone(identity)
            }
        );

        return {
            locked: true,
            identity:
                clone(identity)
        };
    }

    async function unlock(options = {}) {
        if (!locked) {
            return {
                locked: false,
                reason:
                    "already-unlocked"
            };
        }

        let confirmed = true;

        if (
            options.confirm !==
                false &&
            window.UI &&
            typeof UI.confirm ===
                "function"
        ) {
            confirmed =
                await UI.confirm({
                    title:
                        "Desbloquear identidad",
                    message:
                        "La identidad volverá a ser editable. Los cambios pueden afectar a la consistencia de futuros retratos.",
                    acceptLabel:
                        "Desbloquear",
                    cancelLabel:
                        "Mantener bloqueada"
                });
        }

        if (!confirmed) {
            return {
                locked: true,
                reason:
                    "cancelled"
            };
        }

        const identity =
            getIdentity();

        identity.locked =
            false;

        identity.status =
            "draft";

        identity.unlockedAt =
            new Date()
                .toISOString();

        const service =
            getIdentityService();

        if (
            typeof service.unlock ===
                "function"
        ) {
            service.unlock(
                identity
            );
        } else {
            persistIdentity(
                identity
            );
        }

        locked = false;

        renderLockState();
        renderStatus();

        notify(
            "La identidad vuelve a estar editable.",
            "info"
        );

        emit(
            "identity:unlocked",
            {
                identity:
                    clone(identity)
            }
        );

        return {
            locked: false,
            identity:
                clone(identity)
        };
    }

    /* ========================================================
       COMPLETITUD
       ======================================================== */

    function calculateCompleteness() {
        return calculateIdentityCompleteness(
            getIdentity()
        );
    }

    function calculateIdentityCompleteness(
        identity
    ) {
        const allPaths = [
            ...REQUIRED_PATHS,
            ...RECOMMENDED_PATHS
        ];

        const requiredWeight =
            0.85;

        const recommendedWeight =
            0.15;

        const completedRequired =
            REQUIRED_PATHS.filter(
                path =>
                    hasValue(
                        getPathValue(
                            identity,
                            path
                        )
                    )
            ).length;

        const completedRecommended =
            RECOMMENDED_PATHS.filter(
                path =>
                    hasValue(
                        getPathValue(
                            identity,
                            path
                        )
                    )
            ).length;

        const requiredScore =
            REQUIRED_PATHS.length
                ? completedRequired /
                  REQUIRED_PATHS.length
                : 1;

        const recommendedScore =
            RECOMMENDED_PATHS.length
                ? completedRecommended /
                  RECOMMENDED_PATHS.length
                : 1;

        const percentage =
            Math.round(
                (
                    requiredScore *
                        requiredWeight +
                    recommendedScore *
                        recommendedWeight
                ) *
                    100
            );

        return Math.min(
            100,
            Math.max(
                0,
                percentage
            )
        );
    }

    function renderCompleteness() {
        const value =
            calculateCompleteness();

        if (
            completenessElement
        ) {
            completenessElement
                .textContent =
                `${value} %`;

            completenessElement
                .setAttribute(
                    "aria-label",
                    `Identidad completada al ${value} por ciento`
                );
        }

        panel?.style
            .setProperty(
                "--identity-completeness",
                `${value}%`
            );

        return value;
    }

    /* ========================================================
       ESTADO VISUAL
       ======================================================== */

    function renderLockState() {
        fields.forEach(
            field => {
                field.disabled =
                    locked;

                field.setAttribute(
                    "aria-disabled",
                    String(locked)
                );
            }
        );

        panel?.classList
            .toggle(
                CLASSES.LOCKED,
                locked
            );

        const lockButton =
            root.querySelector(
                SELECTORS.LOCK_ACTION
            );

        const unlockButton =
            root.querySelector(
                SELECTORS.UNLOCK_ACTION
            );

        if (lockButton) {
            lockButton.hidden =
                locked;
        }

        if (unlockButton) {
            unlockButton.hidden =
                !locked;
        }
    }

    function renderStatus() {
        if (!statusElement) {
            return;
        }

        const identity =
            getIdentity();

        const completeness =
            calculateCompleteness();

        statusElement.classList
            .remove(
                CLASSES.LOCKED,
                CLASSES.COMPLETE,
                CLASSES.WARNING
            );

        if (locked) {
            statusElement.textContent =
                "Identidad bloqueada";

            statusElement.classList
                .add(
                    CLASSES.LOCKED
                );

            return;
        }

        if (
            identity.validation
                ?.valid === true
        ) {
            statusElement.textContent =
                "Validada";

            statusElement.classList
                .add(
                    CLASSES.COMPLETE
                );

            return;
        }

        if (completeness >= 85) {
            statusElement.textContent =
                "Lista para validar";

            statusElement.classList
                .add(
                    CLASSES.COMPLETE
                );

            return;
        }

        if (completeness > 0) {
            statusElement.textContent =
                `Borrador · ${completeness} %`;

            statusElement.classList
                .add(
                    CLASSES.WARNING
                );

            return;
        }

        statusElement.textContent =
            "Borrador";
    }

    function renderFieldValidation(
        field,
        result
    ) {
        clearFieldValidation(
            field
        );

        field.classList.toggle(
            CLASSES.INVALID,
            result.valid === false
        );

        field.classList.toggle(
            CLASSES.VALID,
            result.valid === true &&
            hasValue(
                readFieldValue(
                    field
                )
            )
        );

        field.setAttribute(
            "aria-invalid",
            String(
                result.valid === false
            )
        );

        if (result.valid) {
            return;
        }

        const feedback =
            document.createElement(
                "span"
            );

        feedback.className =
            "form-field__error";

        feedback.dataset
            .identityError =
            field.dataset
                .identityField ||
            "";

        feedback.textContent =
            result.errors?.[0]
                ?.message ||
            "El valor no es válido.";

        field
            .closest(
                ".form-field"
            )
            ?.appendChild(
                feedback
            );
    }

    function clearFieldValidation(
        field
    ) {
        field.classList.remove(
            CLASSES.INVALID,
            CLASSES.VALID
        );

        field.removeAttribute(
            "aria-invalid"
        );

        field
            .closest(
                ".form-field"
            )
            ?.querySelector(
                "[data-identity-error]"
            )
            ?.remove();
    }

    function renderValidationSummary(
        result
    ) {
        if (
            !window.UI ||
            typeof UI.showValidation !==
                "function"
        ) {
            return;
        }

        UI.showValidation({
            valid:
                result.valid,
            errors:
                result.errors,
            warnings:
                result.warnings
        });
    }

    /* ========================================================
       EVENTOS DE APLICACIÓN
       ======================================================== */

    function bindApplicationEvents() {
        if (
            !window.AppEvents ||
            typeof AppEvents.on !==
                "function"
        ) {
            return;
        }

        subscriptions.push(
            AppEvents.on(
                "profile:loaded",
                detail => {
                    load(
                        detail?.profile
                    );
                }
            )
        );

        subscriptions.push(
            AppEvents.on(
                "profile:imported",
                detail => {
                    load(
                        detail?.profile
                    );
                }
            )
        );

        subscriptions.push(
            AppEvents.on(
                "identity:updated",
                () => {
                    if (!syncing) {
                        load();
                    }
                }
            )
        );

        subscriptions.push(
            AppEvents.on(
                "binding:identity-validate",
                validateAll
            )
        );

        subscriptions.push(
            AppEvents.on(
                "binding:identity-lock",
                lock
            )
        );

        subscriptions.push(
            AppEvents.on(
                "binding:identity-unlock",
                unlock
            )
        );
    }

    /* ========================================================
       SERVICIOS
       ======================================================== */

    function getIdentityService() {
        return (
            ProfileService.identity ||
            window.ProfileIdentity ||
            {}
        );
    }

    function getActiveProfile() {
        return (
            typeof ProfileService
                .getActive ===
                "function"
                ? ProfileService
                    .getActive()
                : null
        );
    }

    function getIdentity() {
        const service =
            getIdentityService();

        if (
            typeof service.get ===
                "function"
        ) {
            return normalizeIdentity(
                service.get()
            );
        }

        if (
            typeof service.getIdentity ===
                "function"
        ) {
            return normalizeIdentity(
                service.getIdentity()
            );
        }

        return normalizeIdentity(
            getActiveProfile()
                ?.identity
        );
    }

    function persistProfile(profile) {
        if (
            typeof ProfileService.update ===
                "function"
        ) {
            ProfileService.update(
                profile
            );

            return;
        }

        if (
            typeof ProfileService.setActive ===
                "function"
        ) {
            ProfileService.setActive(
                profile
            );

            return;
        }

        throw createError(
            "PROFILE_UPDATE_UNAVAILABLE",
            "No existe un método para actualizar el perfil."
        );
    }

    /* ========================================================
       CAMPOS
       ======================================================== */

    function readFieldValue(field) {
        if (
            field.type ===
                "checkbox"
        ) {
            return field.checked;
        }

        return field.value;
    }

    function writeFieldValue(
        field,
        value
    ) {
        if (
            field.type ===
                "checkbox"
        ) {
            field.checked =
                value === true;

            return;
        }

        field.value =
            value ?? "";
    }

    function normalizeFieldValue(
        value
    ) {
        return typeof value ===
            "string"
            ? value.trim()
            : value;
    }

    function getFieldLabel(field) {
        return (
            field
                .closest(
                    ".form-field"
                )
                ?.querySelector(
                    "label"
                )
                ?.textContent
                ?.trim() ||
            getPathLabel(
                field.dataset
                    .identityField
            )
        );
    }

    function getPathLabel(path) {
        const labels = {
            "general.age":
                "Edad aparente",

            "face.shape":
                "Forma del rostro",

            "face.proportions":
                "Proporciones faciales",

            "asymmetries.description":
                "Asimetrías",

            "skin.description":
                "Piel",

            "age-markers.description":
                "Marcadores de edad",

            "hair.description":
                "Cabello",

            "facial-hair.description":
                "Vello facial",

            "eyes.description":
                "Ojos",

            "nose.description":
                "Nariz",

            "mouth.description":
                "Boca y labios",

            "jaw.description":
                "Mandíbula y mentón",

            "distinctive-features.description":
                "Rasgos distintivos"
        };

        return (
            labels[path] ||
            path ||
            "Campo"
        );
    }

    /* ========================================================
       UTILIDADES
       ======================================================== */

    function normalizeIdentity(
        identity
    ) {
        const source =
            identity &&
            typeof identity ===
                "object"
                ? clone(identity)
                : {};

        source.general =
            normalizeObject(
                source.general
            );

        source.face =
            normalizeObject(
                source.face
            );

        source.asymmetries =
            normalizeObject(
                source.asymmetries
            );

        source.skin =
            normalizeObject(
                source.skin
            );

        source["age-markers"] =
            normalizeObject(
                source["age-markers"]
            );

        source.hair =
            normalizeObject(
                source.hair
            );

        source["facial-hair"] =
            normalizeObject(
                source["facial-hair"]
            );

        source.eyes =
            normalizeObject(
                source.eyes
            );

        source.nose =
            normalizeObject(
                source.nose
            );

        source.mouth =
            normalizeObject(
                source.mouth
            );

        source.jaw =
            normalizeObject(
                source.jaw
            );

        source["distinctive-features"] =
            normalizeObject(
                source["distinctive-features"]
            );

        source.validation =
            normalizeObject(
                source.validation
            );

        source.locked =
            source.locked ===
                true;

        source.status =
            normalizeText(
                source.status
            ) ||
            (
                source.locked
                    ? "locked"
                    : "draft"
            );

        return source;
    }

    function normalizeObject(value) {
        return (
            value &&
            typeof value ===
                "object" &&
            !Array.isArray(value)
        )
            ? value
            : {};
    }

    function getPathValue(
        source,
        path
    ) {
        return normalizeText(path)
            .split(".")
            .reduce(
                (current, key) =>
                    current?.[key],
                source
            );
    }

    function setPathValue(
        target,
        path,
        value
    ) {
        const keys =
            normalizeText(path)
                .split(".")
                .filter(Boolean);

        let current =
            target;

        keys.forEach(
            (key, index) => {
                const last =
                    index ===
                    keys.length - 1;

                if (last) {
                    current[key] =
                        value;

                    return;
                }

                if (
                    !current[key] ||
                    typeof current[key] !==
                        "object" ||
                    Array.isArray(
                        current[key]
                    )
                ) {
                    current[key] = {};
                }

                current =
                    current[key];
            }
        );

        return target;
    }

    function hasValue(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return false;
        }

        if (
            typeof value ===
                "string"
        ) {
            return value.trim()
                .length > 0;
        }

        if (
            Array.isArray(value)
        ) {
            return value.length > 0;
        }

        return true;
    }

    function uniqueMessages(items) {
        const seen =
            new Set();

        return (
            Array.isArray(items)
                ? items
                : []
        ).filter(
            item => {
                const key =
                    `${item.code || ""}|${item.field || ""}|${item.message || ""}`;

                if (
                    seen.has(key)
                ) {
                    return false;
                }

                seen.add(key);

                return true;
            }
        );
    }

    function notify(
        message,
        type = "info"
    ) {
        if (
            window.UI &&
            typeof UI.notify ===
                "function"
        ) {
            UI.notify(
                message,
                {
                    type
                }
            );

            return;
        }

        emit(
            "ui:notification",
            {
                message,
                type
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
        }
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

    function normalizeText(value) {
        return String(
            value ?? ""
        ).trim();
    }

    function clone(value) {
        if (
            value === undefined
        ) {
            return undefined;
        }

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

    function getState() {
        return {
            initialized,
            dirty,
            syncing,
            locked,
            fieldCount:
                fields.length,
            completeness:
                calculateCompleteness(),
            identity:
                clone(
                    getIdentity()
                )
        };
    }

    function validateDependencies() {
        const required = [
            "ProfileService",
            "Validators"
        ];

        const missing =
            required.filter(
                name =>
                    !window[name]
            );

        if (missing.length) {
            throw createError(
                "MISSING_IDENTITY_BINDING_DEPENDENCY",
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
            "IdentityBindingError";

        error.code =
            code;

        return error;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        init,
        destroy,

        load,
        save,

        updateField,

        validateField,
        validateAll,

        lock,
        unlock,

        calculateCompleteness,

        renderStatus,
        renderCompleteness,

        getState
    });

})();

window.IdentityBinding =
    IdentityBinding;
