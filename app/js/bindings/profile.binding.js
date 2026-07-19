"use strict";

/* ============================================================
   PortraitOS
   Profile Binding
   ------------------------------------------------------------
   Responsabilidad:
   - Conectar los campos generales del perfil con ProfileService.
   - Cargar el perfil activo en el formulario.
   - Actualizar el modelo al modificar los controles.
   - Gestionar autoguardado y validación visual.
   - Mantener la UI sincronizada con los eventos del perfil.
   ============================================================ */

const ProfileBinding = (() => {

    const SELECTORS = Object.freeze({
        FIELD:
            "[data-profile-field]",

        FORM:
            "[data-profile-form]",

        SUMMARY:
            "[data-profile-summary]",

        SAVE_STATUS:
            "[data-profile-save-status]"
    });

    const CLASSES = Object.freeze({
        INVALID:
            "is-invalid",

        VALID:
            "is-valid",

        DIRTY:
            "is-dirty",

        SAVING:
            "is-saving",

        SAVED:
            "is-saved"
    });

    const AUTOSAVE_DELAY = 700;

    let initialized = false;
    let root = document;
    let fields = [];
    let subscriptions = [];
    let autosaveTimer = null;
    let dirty = false;
    let syncing = false;

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

        fields =
            [
                ...root.querySelectorAll(
                    SELECTORS.FIELD
                )
            ];

        bindDomEvents();
        bindApplicationEvents();

        ensureActiveProfile();
        load();

        initialized = true;

        emit(
            "binding:profile-ready",
            {
                fields:
                    fields.length
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
        initialized = false;
        dirty = false;
        syncing = false;

        return true;
    }

    /* ========================================================
       CARGA DEL PERFIL
       ======================================================== */

    function ensureActiveProfile() {
        const active =
            getActiveProfile();

        if (active) {
            return active;
        }

        if (
            typeof ProfileService.create ===
            "function"
        ) {
            const created =
                ProfileService.create({
                    name: "",
                    description: "",
                    language: "es",
                    tags: []
                });

            if (
                created &&
                typeof ProfileService
                    .setActive ===
                    "function"
            ) {
                ProfileService.setActive(
                    created
                );
            }

            return (
                getActiveProfile() ||
                created
            );
        }

        return null;
    }

    function load(profile = null) {
        const source =
            profile ||
            getActiveProfile();

        syncing = true;

        fields.forEach(
            field => {
                const path =
                    normalizeText(
                        field.dataset
                            .profileField
                    );

                if (!path) {
                    return;
                }

                const value =
                    getPathValue(
                        source,
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

        syncing = false;
        dirty = false;

        renderSaveStatus(
            "saved",
            "Perfil sincronizado"
        );

        emit(
            "binding:profile-loaded",
            {
                profile:
                    clone(source)
            }
        );

        return clone(source);
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
    }

    function handleFieldInput(event) {
        if (syncing) {
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
        if (syncing) {
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
        if (syncing) {
            return;
        }

        validateField(
            event.currentTarget
        );
    }

    /* ========================================================
       ACTUALIZACIÓN DEL MODELO
       ======================================================== */

    function updateField(
        field,
        options = {}
    ) {
        const path =
            normalizeText(
                field.dataset
                    .profileField
            );

        if (!path) {
            return null;
        }

        const value =
            readFieldValue(field);

        const profile =
            getActiveProfile() ||
            ensureActiveProfile();

        if (!profile) {
            throw createError(
                "PROFILE_NOT_AVAILABLE",
                "No existe un perfil activo."
            );
        }

        const updated =
            clone(profile) || {};

        setPathValue(
            updated,
            path,
            normalizeProfileValue(
                path,
                value
            )
        );

        persistProfileModel(
            updated
        );

        dirty = true;

        field.classList.add(
            CLASSES.DIRTY
        );

        renderSaveStatus(
            "dirty",
            "Cambios pendientes"
        );

        if (
            options.validate === true
        ) {
            validateField(field);
        }

        if (
            options.autosave !== false
        ) {
            scheduleAutosave();
        }

        emit(
            "profile:field-updated",
            {
                field:
                    path,

                value:
                    clone(value),

                profile:
                    clone(updated)
            }
        );

        return updated;
    }

    function persistProfileModel(
        profile
    ) {
        if (
            typeof ProfileService
                .update ===
                "function"
        ) {
            ProfileService.update(
                profile
            );

            return;
        }

        if (
            typeof ProfileService
                .setActive ===
                "function"
        ) {
            ProfileService.setActive(
                profile
            );

            return;
        }

        const active =
            getActiveProfile();

        if (active) {
            Object.keys(active)
                .forEach(
                    key => {
                        delete active[key];
                    }
                );

            Object.assign(
                active,
                profile
            );
        }
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

        renderSaveStatus(
            "saving",
            "Guardando..."
        );

        try {
            const profile =
                getActiveProfile();

            let result = profile;

            if (
                typeof ProfileService
                    .save ===
                    "function"
            ) {
                result =
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

            renderSaveStatus(
                "saved",
                "Guardado"
            );

            emit(
                "profile:autosaved",
                {
                    profile:
                        clone(
                            getActiveProfile()
                        )
                }
            );

            return {
                saved: true,
                result
            };
        } catch (error) {
            renderSaveStatus(
                "error",
                "Error al guardar"
            );

            emitError(
                error,
                {
                    action:
                        "profile-autosave"
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
                    .profileField
            );

        const value =
            readFieldValue(field);

        let result =
            Validators.valid(value);

        switch (path) {
            case "name":
                result =
                    Validators.requiredText(
                        value,
                        {
                            field:
                                path,
                            label:
                                "El nombre del perfil"
                        }
                    );

                if (result.valid) {
                    result =
                        Validators.textLength(
                            value,
                            {
                                field:
                                    path,
                                label:
                                    "El nombre del perfil",
                                min: 3,
                                max: 120
                            }
                        );
                }
                break;

            case "description":
                if (
                    normalizeText(value)
                ) {
                    result =
                        Validators.textLength(
                            value,
                            {
                                field:
                                    path,
                                label:
                                    "La descripción",
                                max: 1000
                            }
                        );
                }
                break;

            case "language":
                result =
                    Validators.valuesInSet(
                        value,
                        [
                            "es",
                            "en"
                        ],
                        {
                            field:
                                path,
                            label:
                                "El idioma"
                        }
                    );
                break;

            case "tags":
                result =
                    Validators.array(
                        normalizeTags(value),
                        {
                            field:
                                path,
                            label:
                                "Las etiquetas",
                            max: 20
                        }
                    );
                break;

            default:
                break;
        }

        renderFieldValidation(
            field,
            result
        );

        return result;
    }

    function validateAll() {
        const results =
            fields.map(
                field => ({
                    field:
                        field.dataset
                            .profileField,

                    result:
                        validateField(
                            field
                        )
                })
            );

        const errors =
            results.flatMap(
                item =>
                    item.result.errors ||
                    []
            );

        return {
            valid:
                errors.length === 0,

            errors,
            results
        };
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
            !isEmptyField(field)
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

        const message =
            result.errors?.[0]
                ?.message ||
            "El valor no es válido.";

        const feedback =
            document.createElement(
                "span"
            );

        feedback.className =
            "form-field__error";

        feedback.dataset
            .fieldError =
            field.dataset
                .profileField ||
            "";

        feedback.textContent =
            message;

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
                "[data-field-error]"
            )
            ?.remove();
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
                "profile:cleared",
                () => {
                    ensureActiveProfile();
                    load();
                }
            )
        );

        subscriptions.push(
            AppEvents.on(
                "binding:profile-save",
                save
            )
        );
    }

    /* ========================================================
       ESTADO VISUAL
       ======================================================== */

    function renderSaveStatus(
        status,
        message
    ) {
        const element =
            root.querySelector(
                SELECTORS.SAVE_STATUS
            );

        if (!element) {
            return;
        }

        element.classList.remove(
            CLASSES.SAVING,
            CLASSES.SAVED,
            CLASSES.DIRTY,
            CLASSES.INVALID
        );

        switch (status) {
            case "saving":
                element.classList.add(
                    CLASSES.SAVING
                );
                break;

            case "saved":
                element.classList.add(
                    CLASSES.SAVED
                );
                break;

            case "dirty":
                element.classList.add(
                    CLASSES.DIRTY
                );
                break;

            case "error":
                element.classList.add(
                    CLASSES.INVALID
                );
                break;

            default:
                break;
        }

        element.textContent =
            message || "";
    }

    /* ========================================================
       LECTURA Y ESCRITURA DE CONTROLES
       ======================================================== */

    function readFieldValue(field) {
        if (
            field.type ===
                "checkbox"
        ) {
            return field.checked;
        }

        if (
            field.type ===
                "radio"
        ) {
            const selected =
                root.querySelector(
                    `input[name="${escapeSelector(field.name)}"]:checked`
                );

            return (
                selected?.value ||
                ""
            );
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

        if (
            field.type ===
                "radio"
        ) {
            field.checked =
                field.value ===
                String(value ?? "");

            return;
        }

        if (
            field.dataset
                .profileField ===
                "tags"
        ) {
            field.value =
                Array.isArray(value)
                    ? value.join(", ")
                    : String(
                        value ?? ""
                    );

            return;
        }

        field.value =
            value ?? "";
    }

    function normalizeProfileValue(
        path,
        value
    ) {
        switch (path) {
            case "tags":
                return normalizeTags(
                    value
                );

            case "language":
                return (
                    normalizeText(value)
                        .toLowerCase() ||
                    "es"
                );

            default:
                return typeof value ===
                    "string"
                    ? value.trim()
                    : value;
        }
    }

    function normalizeTags(value) {
        if (
            Array.isArray(value)
        ) {
            return [
                ...new Set(
                    value
                        .map(
                            normalizeText
                        )
                        .filter(Boolean)
                )
            ];
        }

        return [
            ...new Set(
                String(value ?? "")
                    .split(",")
                    .map(
                        normalizeText
                    )
                    .filter(Boolean)
            )
        ];
    }

    /* ========================================================
       UTILIDADES
       ======================================================== */

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

        let current = target;

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

    function isEmptyField(field) {
        const value =
            readFieldValue(field);

        return (
            value === null ||
            value === undefined ||
            normalizeText(value) === ""
        );
    }

    function getState() {
        return {
            initialized,
            fieldCount:
                fields.length,
            dirty,
            syncing,
            profile:
                clone(
                    getActiveProfile()
                )
        };
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
            typeof AppEvents
                .emitError ===
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

    function escapeSelector(value) {
        if (
            window.CSS &&
            typeof CSS.escape ===
                "function"
        ) {
            return CSS.escape(
                value || ""
            );
        }

        return String(
            value || ""
        ).replace(
            /["\\]/g,
            "\\$&"
        );
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
                "MISSING_PROFILE_BINDING_DEPENDENCY",
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
            "ProfileBindingError";

        error.code = code;

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

        getState
    });

})();

window.ProfileBinding =
    ProfileBinding;
