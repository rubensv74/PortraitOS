"use strict";

/* ============================================================
   PortraitOS
   UI Controller
   ------------------------------------------------------------
   Responsabilidad:
   - Inicializar la interfaz.
   - Renderizar el wizard.
   - Gestionar navegación y estados visuales.
   - Mostrar notificaciones, modales y confirmaciones.
   - Coordinar la UI con Wizard, Router y AppEvents.
   ============================================================ */

const UI = (() => {

    const SELECTORS = Object.freeze({
        APP:
            "[data-app]",

        VIEW:
            "[data-view]",

        WIZARD_NAV:
            "[data-wizard-nav]",

        WIZARD_STEP:
            "[data-wizard-step]",

        STEP_PANEL:
            "[data-step-panel]",

        NEXT:
            "[data-action='wizard-next']",

        PREVIOUS:
            "[data-action='wizard-previous']",

        SAVE:
            "[data-action='profile-save']",

        GENERATE:
            "[data-action='prompt-generate']",

        NOTIFICATIONS:
            "[data-notifications]",

        MODAL_ROOT:
            "[data-modal-root]",

        BUSY_OVERLAY:
            "[data-busy-overlay]",

        PROGRESS:
            "[data-wizard-progress]",

        PROGRESS_LABEL:
            "[data-wizard-progress-label]",

        CURRENT_STEP_TITLE:
            "[data-current-step-title]",

        CURRENT_STEP_DESCRIPTION:
            "[data-current-step-description]"
    });

    const CLASSES = Object.freeze({
        ACTIVE:
            "is-active",

        COMPLETE:
            "is-complete",

        INVALID:
            "is-invalid",

        VISITED:
            "is-visited",

        DISABLED:
            "is-disabled",

        BUSY:
            "is-busy",

        VISIBLE:
            "is-visible",

        HIDDEN:
            "is-hidden"
    });

    let initialized = false;

    let elements =
        createElementRegistry();

    let subscriptions = [];

    let notificationCounter = 0;

    let promptPreviewTimer = null;

    let activePromptPreviewStage = "optimized";

    /* ========================================================
       INICIALIZACIÓN
       ======================================================== */

    function init(options = {}) {
        if (initialized) {
            return getState();
        }

        validateDependencies();

        cacheElements(
            options.root ||
            document
        );

        bindDomEvents();
        bindApplicationEvents();

        Wizard.init(
            options.wizard || {}
        );

        render();

        initialized = true;

        document.documentElement
            .setAttribute(
                "data-portraitos-ready",
                "true"
            );

        return getState();
    }

    function destroy() {
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

        if (promptPreviewTimer) {
            window.clearTimeout(promptPreviewTimer);
            promptPreviewTimer = null;
        }

        activePromptPreviewStage = "optimized";

        initialized = false;

        elements =
            createElementRegistry();

        return true;
    }

    function createElementRegistry() {
        return {
            root: null,
            view: null,
            wizardNav: null,
            wizardSteps: [],
            stepPanels: [],
            nextButton: null,
            previousButton: null,
            saveButton: null,
            generateButton: null,
            notifications: null,
            modalRoot: null,
            busyOverlay: null,
            progress: null,
            progressLabel: null,
            currentStepTitle: null,
            currentStepDescription: null
        };
    }

    function cacheElements(root) {
        elements.root =
            root.querySelector(
                SELECTORS.APP
            ) ||
            root.body ||
            root.documentElement;

        elements.view =
            root.querySelector(
                SELECTORS.VIEW
            );

        elements.wizardNav =
            root.querySelector(
                SELECTORS.WIZARD_NAV
            );

        elements.wizardSteps =
            [
                ...root.querySelectorAll(
                    SELECTORS.WIZARD_STEP
                )
            ];

        elements.stepPanels =
            [
                ...root.querySelectorAll(
                    SELECTORS.STEP_PANEL
                )
            ];

        elements.nextButton =
            root.querySelector(
                SELECTORS.NEXT
            );

        elements.previousButton =
            root.querySelector(
                SELECTORS.PREVIOUS
            );

        elements.saveButton =
            root.querySelector(
                SELECTORS.SAVE
            );

        elements.generateButton =
            root.querySelector(
                SELECTORS.GENERATE
            );

        elements.notifications =
            root.querySelector(
                SELECTORS.NOTIFICATIONS
            );

        elements.modalRoot =
            root.querySelector(
                SELECTORS.MODAL_ROOT
            );

        elements.busyOverlay =
            root.querySelector(
                SELECTORS.BUSY_OVERLAY
            );

        elements.progress =
            root.querySelector(
                SELECTORS.PROGRESS
            );

        elements.progressLabel =
            root.querySelector(
                SELECTORS.PROGRESS_LABEL
            );

        elements.currentStepTitle =
            root.querySelector(
                SELECTORS.CURRENT_STEP_TITLE
            );

        elements.currentStepDescription =
            root.querySelector(
                SELECTORS.CURRENT_STEP_DESCRIPTION
            );
    }

    /* ========================================================
       EVENTOS DOM
       ======================================================== */

    function bindDomEvents() {
        elements.wizardNav
            ?.addEventListener(
                "click",
                handleWizardNavigation
            );

        elements.nextButton
            ?.addEventListener(
                "click",
                handleNext
            );

        elements.previousButton
            ?.addEventListener(
                "click",
                handlePrevious
            );

        elements.saveButton
            ?.addEventListener(
                "click",
                handleSave
            );

        elements.generateButton
            ?.addEventListener(
                "click",
                handleGenerate
            );

        document.addEventListener(
            "keydown",
            handleKeyboard
        );

        document.addEventListener(
            "click",
            handleGlobalActions
        );
    }

    function handleWizardNavigation(event) {
        const button =
            event.target.closest(
                SELECTORS.WIZARD_STEP
            );

        if (!button) {
            return;
        }

        const stepId =
            normalizeText(
                button.dataset
                    .wizardStep
            );

        if (!stepId) {
            return;
        }

        const result =
            Wizard.goTo(stepId);

        if (
            result.changed === false &&
            result.validation
        ) {
            showValidation(
                result.validation
            );
        }
    }

    function handleNext() {
        const result =
            Wizard.next();

        if (
            result?.changed === false &&
            result.validation
        ) {
            showValidation(
                result.validation
            );
        }
    }

    function handlePrevious() {
        Wizard.previous();
    }

    async function handleSave() {
        try {
            setBusy(
                true,
                "Guardando perfil..."
            );

            ProfileService.save();

            notify(
                "Perfil guardado correctamente.",
                {
                    type:
                        "success"
                }
            );
        } catch (error) {
            handleError(
                error,
                {
                    action:
                        "save-profile"
                }
            );
        } finally {
            setBusy(false);
        }
    }

    async function handleGenerate() {
        try {
            setBusy(
                true,
                "Generando contrato..."
            );

            const profile =
                ProfileService
                    .getActive();

            const result =
                window.PromptBinding &&
                typeof PromptBinding.generate ===
                    "function"
                    ? PromptBinding.generate(
                        profile,
                        {
                            provider: "generic",
                            level: "professional",
                            optimize: true,
                            saveHistory: true
                        }
                    )
                    : PromptEngine.generate(
                        profile,
                        {
                            strict: true
                        }
                    );

            emit(
                "prompt:generated",
                {
                    result
                }
            );

            notify(
                "Contrato de retrato generado.",
                {
                    type:
                        "success"
                }
            );

            renderPromptResult(result);
        } catch (error) {
            handleError(
                error,
                {
                    action:
                        "generate-prompt"
                }
            );
        } finally {
            setBusy(false);
        }
    }

    function handleKeyboard(event) {
        if (
            event.defaultPrevented ||
            isEditableElement(
                event.target
            )
        ) {
            return;
        }

        if (
            event.altKey &&
            event.key ===
                "ArrowRight"
        ) {
            event.preventDefault();
            handleNext();
        }

        if (
            event.altKey &&
            event.key ===
                "ArrowLeft"
        ) {
            event.preventDefault();
            handlePrevious();
        }

        if (
            event.key ===
                "Escape"
        ) {
            closeModal();
        }
    }

    function handleGlobalActions(event) {
        const actionElement =
            event.target.closest(
                "[data-action]"
            );

        if (!actionElement) {
            return;
        }

        const action =
            actionElement.dataset
                .action;

        switch (action) {
            case "notification-dismiss":
                dismissNotification(
                    actionElement.closest(
                        "[data-notification]"
                    )
                );
                break;

            case "modal-close":
                closeModal();
                break;

            case "copy-prompt":
                copyPrompt(
                    actionElement.closest(
                        "[data-prompt-stage-panel]"
                    )
                );
                break;

            case "prompt-preview-tab":
                activatePromptPreviewTab(
                    actionElement.dataset.promptStage
                );
                break;

            case "download-profile":
                ProfileService
                    .download();
                break;

            default:
                break;
        }
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
                "wizard:changed",
                render
            )
        );

        subscriptions.push(
            AppEvents.on(
                "wizard:step-completed",
                render
            )
        );

        subscriptions.push(
            AppEvents.on(
                "wizard:validation-failed",
                detail => {
                    showValidation(
                        detail.validation
                    );
                }
            )
        );

        subscriptions.push(
            AppEvents.on(
                "ui:notification",
                detail => {
                    notify(
                        detail.message,
                        detail
                    );
                }
            )
        );

        subscriptions.push(
            AppEvents.on(
                "app:error",
                detail => {
                    notify(
                        detail.message,
                        {
                            type:
                                "error",
                            title:
                                "Error"
                        }
                    );
                }
            )
        );

        subscriptions.push(
            AppEvents.on(
                "profile:loaded",
                render
            )
        );

        subscriptions.push(
            AppEvents.on(
                "profile:updated",
                render
            )
        );


        [
            "profile:loaded",
            "profile:updated",
            "identity:updated",
            "direction:updated",
            "knowledge-pack:changed"
        ].forEach(eventName => {
            subscriptions.push(
                AppEvents.on(
                    eventName,
                    schedulePromptPreview
                )
            );
        });

        subscriptions.push(
            AppEvents.on(
                "wizard:changed",
                schedulePromptPreview
            )
        );
    }

    /* ========================================================
       RENDER PRINCIPAL
       ======================================================== */

    function render() {
        if (!window.Wizard) {
            return;
        }

        const state =
            Wizard.getState();

        const current =
            Wizard.getCurrentStep();

        const progress =
            Wizard.getProgress();

        renderWizardNavigation(
            state
        );

        renderStepPanels(
            current?.id
        );

        renderProgress(
            progress
        );

        renderStepHeader(
            current
        );

        renderActions(
            state,
            current
        );

        renderProfileSummary();
    }

    function renderWizardNavigation(
        state
    ) {
        elements.wizardSteps
            .forEach(
                element => {
                    const stepId =
                        element.dataset
                            .wizardStep;

                    toggleClass(
                        element,
                        CLASSES.ACTIVE,
                        stepId ===
                        state.currentStepId
                    );

                    toggleClass(
                        element,
                        CLASSES.COMPLETE,
                        state.completedSteps
                            .includes(stepId)
                    );

                    toggleClass(
                        element,
                        CLASSES.INVALID,
                        state.invalidSteps
                            .includes(stepId)
                    );

                    toggleClass(
                        element,
                        CLASSES.VISITED,
                        state.visitedSteps
                            .includes(stepId)
                    );

                    element.setAttribute(
                        "aria-current",
                        stepId ===
                        state.currentStepId
                            ? "step"
                            : "false"
                    );
                }
            );
    }

    function renderStepPanels(
        currentStepId
    ) {
        elements.stepPanels
            .forEach(
                panel => {
                    const panelStep =
                        panel.dataset
                            .stepPanel;

                    const active =
                        panelStep ===
                        currentStepId;

                    toggleClass(
                        panel,
                        CLASSES.ACTIVE,
                        active
                    );

                    panel.hidden =
                        !active;

                    panel.setAttribute(
                        "aria-hidden",
                        String(!active)
                    );
                }
            );
    }

    function renderProgress(
        progress
    ) {
        if (
            elements.progress
        ) {
            const percentage =
                Number(
                    progress.percentage ||
                    0
                );

            elements.progress
                .style
                .setProperty(
                    "--progress",
                    `${percentage}%`
                );

            elements.progress
                .setAttribute(
                    "aria-valuenow",
                    String(percentage)
                );
        }

        if (
            elements.progressLabel
        ) {
            elements.progressLabel
                .textContent =
                `${progress.completed} de ${progress.total} pasos completados`;
        }
    }

    function renderStepHeader(
        step
    ) {
        if (!step) {
            return;
        }

        if (
            elements.currentStepTitle
        ) {
            elements
                .currentStepTitle
                .textContent =
                step.title || "";
        }

        if (
            elements
                .currentStepDescription
        ) {
            elements
                .currentStepDescription
                .textContent =
                step.description || "";
        }
    }

    function renderActions(
        state,
        current
    ) {
        const currentIndex =
            current?.index ?? 0;

        const lastIndex =
            state.steps.length - 1;

        setDisabled(
            elements.previousButton,
            currentIndex <= 0
        );

        if (
            elements.nextButton
        ) {
            elements.nextButton
                .textContent =
                currentIndex >= lastIndex
                    ? "Finalizar"
                    : "Siguiente";
        }

        setVisible(
            elements.generateButton,
            current?.id ===
                "prompt"
        );
    }

    function renderProfileSummary() {
        const target =
            document.querySelector(
                "[data-profile-summary]"
            );

        if (!target) {
            return;
        }

        const profile =
            ProfileService
                .getActive();

        if (!profile) {
            target.innerHTML =
                `
                <div class="empty-state">
                    <strong>No hay ningún perfil activo.</strong>
                    <span>Crea o importa un perfil para comenzar.</span>
                </div>
                `;

            return;
        }

        const summary =
            ProfileService
                .getSummary();

        target.innerHTML =
            `
            <div class="profile-summary">
                <div class="profile-summary__main">
                    <strong>${escapeHtml(summary.name || "Perfil sin nombre")}</strong>
                    <span>${escapeHtml(summary.description || "")}</span>
                </div>

                <div class="profile-summary__metrics">
                    <span>${Number(summary.photoCount || 0)} fotografías</span>
                    <span>${Number(summary.identityCompleteness || 0)} % identidad</span>
                </div>
            </div>
            `;
    }

    function renderPromptResult(
        result,
        options = {}
    ) {
        const target =
            document.querySelector(
                "[data-prompt-output]"
            );

        if (!target) {
            return;
        }

        const stages = buildPromptStages(result);
        const activeStage = resolveActivePromptStage(stages);
        const metrics = activeStage.metrics;
        const previewLabel = options.preview === true || result.isPreview
            ? "Vista previa automática"
            : "Contrato generado";

        target.innerHTML = `
            <section class="prompt-preview" data-prompt-preview>
                <div class="prompt-preview__summary">
                    <div>
                        <span class="prompt-preview__eyebrow">${previewLabel}</span>
                        <strong>${escapeHtml(result.provider || "generic")}</strong>
                    </div>
                    <div class="prompt-preview__metrics" aria-label="Métricas de la etapa activa">
                        <span><strong data-prompt-metric="characters">${metrics.positiveCharacters}</strong> caracteres</span>
                        <span><strong data-prompt-metric="words">${metrics.positiveWords}</strong> palabras</span>
                        <span><strong data-prompt-metric="negative">${metrics.negativeCharacters}</strong> negativos</span>
                    </div>
                </div>

                <div class="prompt-preview__tabs" role="tablist" aria-label="Etapas del pipeline">
                    ${stages.map(stage => `
                        <button
                            type="button"
                            class="prompt-preview__tab${stage.id === activeStage.id ? " is-active" : ""}"
                            data-action="prompt-preview-tab"
                            data-prompt-stage="${stage.id}"
                            role="tab"
                            aria-selected="${stage.id === activeStage.id}"
                            ${stage.available ? "" : "disabled"}>
                            ${stage.label}
                        </button>
                    `).join("")}
                </div>

                ${stages.map(stage => `
                    <section
                        class="prompt-preview__stage${stage.id === activeStage.id ? " is-active" : ""}"
                        data-prompt-stage-panel="${stage.id}"
                        data-prompt-characters="${stage.metrics.positiveCharacters}"
                        data-prompt-words="${stage.metrics.positiveWords}"
                        data-prompt-negative="${stage.metrics.negativeCharacters}"
                        ${stage.id === activeStage.id ? "" : "hidden"}>
                        <div class="prompt-result__header">
                            <h3>${stage.label}</h3>
                            <button
                                type="button"
                                class="button button--secondary"
                                data-action="copy-prompt">
                                Copiar
                            </button>
                        </div>
                        <textarea readonly data-positive-prompt>${escapeHtml(stage.prompt)}</textarea>
                        <h3>Prompt negativo</h3>
                        <textarea readonly data-negative-prompt>${escapeHtml(stage.negativePrompt)}</textarea>
                    </section>
                `).join("")}
            </section>
        `;
    }

    function buildPromptStages(result) {
        const compiled = result.compiled || {};
        const optimized = result.optimized || {};
        const contract = result.contract || {};

        return [
            createPromptStage(
                "contract",
                "Contrato base",
                JSON.stringify(contract, null, 2),
                "",
                Object.keys(contract).length > 0
            ),
            createPromptStage(
                "compiled",
                "Compilado",
                normalizeText(compiled.prompt || result.positivePrompt || ""),
                normalizeText(compiled.negativePrompt || result.negativePrompt || ""),
                Boolean(compiled.prompt || result.positivePrompt)
            ),
            createPromptStage(
                "optimized",
                "Optimizado",
                normalizeText(optimized.prompt || ""),
                normalizeText(optimized.negativePrompt || ""),
                Boolean(optimized.prompt)
            )
        ];
    }

    function createPromptStage(id, label, prompt, negativePrompt, available) {
        return {
            id,
            label,
            prompt,
            negativePrompt,
            available,
            metrics: calculatePromptMetrics(prompt, negativePrompt)
        };
    }

    function resolveActivePromptStage(stages) {
        const selected = stages.find(
            stage => stage.id === activePromptPreviewStage && stage.available
        );

        const fallback = selected
            || stages.find(stage => stage.id === "optimized" && stage.available)
            || stages.find(stage => stage.id === "compiled" && stage.available)
            || stages.find(stage => stage.available)
            || stages[0];

        activePromptPreviewStage = fallback.id;
        return fallback;
    }

    function calculatePromptMetrics(positive, negative) {
        return {
            positiveCharacters: positive.length,
            positiveWords: positive ? positive.split(/\s+/).filter(Boolean).length : 0,
            negativeCharacters: negative.length
        };
    }

    function activatePromptPreviewTab(stageId) {
        if (!stageId) {
            return;
        }

        const selectedTab = document.querySelector(
            `[data-prompt-stage="${stageId}"]:not(:disabled)`
        );

        if (!selectedTab) {
            return;
        }

        activePromptPreviewStage = stageId;

        document.querySelectorAll("[data-prompt-stage]").forEach(tab => {
            const active = tab.dataset.promptStage === stageId;
            tab.classList.toggle("is-active", active);
            tab.setAttribute("aria-selected", String(active));
        });

        let selectedPanel = null;

        document.querySelectorAll("[data-prompt-stage-panel]").forEach(panel => {
            const active = panel.dataset.promptStagePanel === stageId;
            panel.classList.toggle("is-active", active);
            panel.hidden = !active;

            if (active) {
                selectedPanel = panel;
            }
        });

        updatePromptPreviewMetrics(selectedPanel);
    }

    function updatePromptPreviewMetrics(panel) {
        if (!panel) {
            return;
        }

        const values = {
            characters: panel.dataset.promptCharacters || "0",
            words: panel.dataset.promptWords || "0",
            negative: panel.dataset.promptNegative || "0"
        };

        Object.entries(values).forEach(([metric, value]) => {
            const target = document.querySelector(
                `[data-prompt-metric="${metric}"]`
            );

            if (target) {
                target.textContent = value;
            }
        });
    }

    function schedulePromptPreview() {
        if (promptPreviewTimer) {
            window.clearTimeout(promptPreviewTimer);
        }

        promptPreviewTimer = window.setTimeout(
            renderAutomaticPromptPreview,
            250
        );
    }

    function renderAutomaticPromptPreview() {
        promptPreviewTimer = null;

        const currentStep = window.Wizard && Wizard.getCurrentStep
            ? Wizard.getCurrentStep()
            : null;

        if (
            currentStep?.id !== "prompt" ||
            !window.PromptBinding ||
            typeof PromptBinding.preview !== "function"
        ) {
            return;
        }

        try {
            const profile = ProfileService.getActive();
            const result = PromptBinding.preview(profile, {
                provider: "generic",
                level: "professional",
                optimize: true
            });

            renderPromptResult(result, { preview: true });
        } catch (error) {
            const target = document.querySelector("[data-prompt-output]");
            if (target) {
                target.innerHTML = `
                    <div class="empty-state">
                        <strong>Vista previa no disponible.</strong>
                        <span>${escapeHtml(error.message || "Completa los datos obligatorios para construir el contrato.")}</span>
                    </div>
                `;
            }
        }
    }

    /* ========================================================
       VALIDACIÓN
       ======================================================== */

    function showValidation(
        validation
    ) {
        const errors =
            Array.isArray(
                validation?.errors
            )
                ? validation.errors
                : [];

        const warnings =
            Array.isArray(
                validation?.warnings
            )
                ? validation.warnings
                : [];

        if (!errors.length) {
            if (warnings.length) {
                notify(
                    warnings
                        .map(
                            item =>
                                item.message
                        )
                        .join(" "),
                    {
                        type:
                            "warning"
                    }
                );
            }

            return;
        }

        openModal({
            title:
                "Revisión necesaria",

            content:
                buildValidationMarkup(
                    errors,
                    warnings
                ),

            closeLabel:
                "Entendido"
        });
    }

    function buildValidationMarkup(
        errors,
        warnings
    ) {
        const errorMarkup =
            errors.length
                ? `
                    <section class="validation-group">
                        <h4>Errores</h4>
                        <ul>
                            ${errors
                                .map(
                                    item =>
                                        `<li>${escapeHtml(item.message || "Valor no válido.")}</li>`
                                )
                                .join("")}
                        </ul>
                    </section>
                  `
                : "";

        const warningMarkup =
            warnings.length
                ? `
                    <section class="validation-group">
                        <h4>Advertencias</h4>
                        <ul>
                            ${warnings
                                .map(
                                    item =>
                                        `<li>${escapeHtml(item.message || "")}</li>`
                                )
                                .join("")}
                        </ul>
                    </section>
                  `
                : "";

        return (
            errorMarkup +
            warningMarkup
        );
    }

    /* ========================================================
       NOTIFICACIONES
       ======================================================== */

    function notify(
        message,
        options = {}
    ) {
        const container =
            ensureNotificationContainer();

        const id =
            `notification-${++notificationCounter}`;

        const type =
            normalizeNotificationType(
                options.type
            );

        const duration =
            normalizeDuration(
                options.duration
            );

        const element =
            document.createElement(
                "article"
            );

        element.className =
            `notification notification--${type}`;

        element.dataset
            .notification =
            id;

        element.setAttribute(
            "role",
            type === "error"
                ? "alert"
                : "status"
        );

        element.innerHTML =
            `
            <div class="notification__content">
                ${
                    options.title
                        ? `<strong>${escapeHtml(options.title)}</strong>`
                        : ""
                }

                <p>${escapeHtml(message)}</p>
            </div>

            ${
                options.dismissible ===
                false
                    ? ""
                    : `
                      <button
                          type="button"
                          class="notification__close"
                          data-action="notification-dismiss"
                          aria-label="Cerrar">
                          ×
                      </button>
                      `
            }
            `;

        container.appendChild(
            element
        );

        requestAnimationFrame(
            () => {
                element.classList
                    .add(
                        CLASSES.VISIBLE
                    );
            }
        );

        if (duration > 0) {
            window.setTimeout(
                () => {
                    dismissNotification(
                        element
                    );
                },
                duration
            );
        }

        return id;
    }

    function dismissNotification(
        element
    ) {
        if (!element) {
            return false;
        }

        element.classList
            .remove(
                CLASSES.VISIBLE
            );

        window.setTimeout(
            () => {
                element.remove();
            },
            220
        );

        return true;
    }

    function ensureNotificationContainer() {
        if (
            elements.notifications
        ) {
            return elements.notifications;
        }

        const container =
            document.createElement(
                "div"
            );

        container.className =
            "notifications";

        container.dataset
            .notifications =
            "";

        container.setAttribute(
            "aria-live",
            "polite"
        );

        document.body
            .appendChild(
                container
            );

        elements.notifications =
            container;

        return container;
    }

    /* ========================================================
       MODALES
       ======================================================== */

    function openModal(
        options = {}
    ) {
        const root =
            ensureModalRoot();

        root.innerHTML =
            `
            <div
                class="modal-backdrop"
                data-action="modal-close">
            </div>

            <section
                class="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title">

                <header class="modal__header">
                    <h2 id="modal-title">
                        ${escapeHtml(options.title || "Información")}
                    </h2>

                    <button
                        type="button"
                        class="modal__close"
                        data-action="modal-close"
                        aria-label="Cerrar">
                        ×
                    </button>
                </header>

                <div class="modal__body">
                    ${options.content || ""}
                </div>

                <footer class="modal__footer">
                    <button
                        type="button"
                        class="button button--primary"
                        data-action="modal-close">
                        ${escapeHtml(options.closeLabel || "Cerrar")}
                    </button>
                </footer>
            </section>
            `;

        root.hidden = false;

        requestAnimationFrame(
            () => {
                root.classList
                    .add(
                        CLASSES.VISIBLE
                    );
            }
        );

        root.querySelector(
            ".modal__close"
        )?.focus();

        return root;
    }

    function closeModal() {
        const root =
            elements.modalRoot;

        if (
            !root ||
            root.hidden
        ) {
            return false;
        }

        root.classList
            .remove(
                CLASSES.VISIBLE
            );

        window.setTimeout(
            () => {
                root.hidden = true;
                root.innerHTML = "";
            },
            200
        );

        return true;
    }

    function confirm(options = {}) {
        return new Promise(
            resolve => {
                const root =
                    ensureModalRoot();

                root.innerHTML =
                    `
                    <div class="modal-backdrop"></div>

                    <section
                        class="modal"
                        role="dialog"
                        aria-modal="true">

                        <header class="modal__header">
                            <h2>
                                ${escapeHtml(options.title || "Confirmar")}
                            </h2>
                        </header>

                        <div class="modal__body">
                            <p>
                                ${escapeHtml(options.message || "¿Deseas continuar?")}
                            </p>
                        </div>

                        <footer class="modal__footer">
                            <button
                                type="button"
                                class="button button--secondary"
                                data-confirm="cancel">
                                ${escapeHtml(options.cancelLabel || "Cancelar")}
                            </button>

                            <button
                                type="button"
                                class="button button--primary"
                                data-confirm="accept">
                                ${escapeHtml(options.acceptLabel || "Confirmar")}
                            </button>
                        </footer>
                    </section>
                    `;

                root.hidden = false;

                requestAnimationFrame(
                    () => {
                        root.classList
                            .add(
                                CLASSES.VISIBLE
                            );
                    }
                );

                const resolveModal =
                    value => {
                        closeModal();
                        resolve(value);
                    };

                root.querySelector(
                    "[data-confirm='accept']"
                )?.addEventListener(
                    "click",
                    () =>
                        resolveModal(true),
                    {
                        once: true
                    }
                );

                root.querySelector(
                    "[data-confirm='cancel']"
                )?.addEventListener(
                    "click",
                    () =>
                        resolveModal(false),
                    {
                        once: true
                    }
                );
            }
        );
    }

    function ensureModalRoot() {
        if (
            elements.modalRoot
        ) {
            return elements.modalRoot;
        }

        const root =
            document.createElement(
                "div"
            );

        root.className =
            "modal-root";

        root.dataset.modalRoot =
            "";

        root.hidden = true;

        document.body
            .appendChild(root);

        elements.modalRoot =
            root;

        return root;
    }

    /* ========================================================
       ESTADO BUSY
       ======================================================== */

    function setBusy(
        busy,
        message = ""
    ) {
        elements.root
            ?.classList
            .toggle(
                CLASSES.BUSY,
                busy === true
            );

        elements.root
            ?.setAttribute(
                "aria-busy",
                String(
                    busy === true
                )
            );

        if (
            elements.busyOverlay
        ) {
            elements.busyOverlay
                .hidden =
                busy !== true;

            const label =
                elements.busyOverlay
                    .querySelector(
                        "[data-busy-message]"
                    );

            if (label) {
                label.textContent =
                    message ||
                    "Procesando...";
            }
        }

        return busy === true;
    }

    /* ========================================================
       PORTAPAPELES
       ======================================================== */

    async function copyPrompt(scope = document) {
        const root = scope || document;

        const positive =
            root.querySelector(
                "[data-positive-prompt]"
            )?.value || "";

        const negative =
            root.querySelector(
                "[data-negative-prompt]"
            )?.value || "";

        const text =
            [
                "PROMPT POSITIVO",
                positive,
                "",
                "PROMPT NEGATIVO",
                negative
            ].join("\n");

        try {
            await navigator.clipboard
                .writeText(text);

            notify(
                "Prompt copiado al portapapeles.",
                {
                    type:
                        "success"
                }
            );
        } catch {
            notify(
                "No se pudo copiar el prompt.",
                {
                    type:
                        "error"
                }
            );
        }
    }

    /* ========================================================
       ERRORES
       ======================================================== */

    function handleError(
        error,
        context = {}
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

            return;
        }

        notify(
            error?.message ||
            "Se ha producido un error.",
            {
                type:
                    "error"
            }
        );
    }

    /* ========================================================
       UTILIDADES
       ======================================================== */

    function getState() {
        return {
            initialized,
            wizard:
                window.Wizard
                    ? Wizard.getState()
                    : null,
            busy:
                elements.root
                    ?.classList
                    .contains(
                        CLASSES.BUSY
                    ) ||
                false
        };
    }

    function setDisabled(
        element,
        disabled
    ) {
        if (!element) {
            return;
        }

        element.disabled =
            disabled === true;

        element.classList
            .toggle(
                CLASSES.DISABLED,
                disabled === true
            );

        element.setAttribute(
            "aria-disabled",
            String(
                disabled === true
            )
        );
    }

    function setVisible(
        element,
        visible
    ) {
        if (!element) {
            return;
        }

        element.hidden =
            visible !== true;

        element.classList
            .toggle(
                CLASSES.HIDDEN,
                visible !== true
            );
    }

    function toggleClass(
        element,
        className,
        enabled
    ) {
        element?.classList
            .toggle(
                className,
                enabled === true
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

    function isEditableElement(
        element
    ) {
        if (!element) {
            return false;
        }

        return (
            element.matches(
                "input, textarea, select, [contenteditable='true']"
            )
        );
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

    function normalizeDuration(
        value
    ) {
        const numeric =
            Number(value);

        return Number.isFinite(
            numeric
        )
            ? Math.max(
                0,
                numeric
            )
            : 4000;
    }

    function normalizeText(
        value
    ) {
        return String(
            value ?? ""
        ).trim();
    }

    function escapeHtml(
        value
    ) {
        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }

    function validateDependencies() {
        const dependencies = [
            "Wizard",
            "ProfileService",
            "PromptEngine"
        ];

        const missing =
            dependencies.filter(
                name =>
                    !window[name]
            );

        if (missing.length) {
            throw createError(
                "MISSING_UI_DEPENDENCY",
                `Faltan dependencias de UI: ${missing.join(", ")}.`
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
            "UIError";

        error.code = code;

        return error;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        init,
        destroy,
        render,

        notify,
        dismissNotification,

        openModal,
        closeModal,
        confirm,

        showValidation,
        renderPromptResult,

        setBusy,
        getState
    });

})();

window.UI = UI;
