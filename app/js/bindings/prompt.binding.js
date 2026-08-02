"use strict";

/* ============================================================
   PortraitOS
   Prompt Binding
   ------------------------------------------------------------
   Responsabilidad:
   - Orquestar el pipeline Portrait Contract -> compilación.
   - Aplicar optimización sin sustituir los motores existentes.
   - Registrar generaciones válidas en el historial.
   - Exponer un resultado compatible con la UI heredada.
   ============================================================ */

const PromptBinding = (() => {

    const VERSION = "1.0.0";

    const EVENTS = Object.freeze({
        GENERATED: "prompt:generated",
        FAILED: "prompt:failed"
    });

    const DEFAULT_OPTIONS = Object.freeze({
        provider: "generic",
        level: "professional",
        language: "es",
        optimize: true,
        saveHistory: true
    });

    let initialized = false;
    let lastResult = null;
    let preferences = { ...DEFAULT_OPTIONS, outputMode: "full" };
    let bound = false;

    function init() {
        if (initialized) {
            return getState();
        }

        validateDependencies();

        if (
            window.PromptHistoryService &&
            typeof PromptHistoryService.init === "function"
        ) {
            PromptHistoryService.init();
        }

        bindWorkspace();
        updateWorkspaceStatus();
        updateReadinessPanel();
        updateHistoryCount();

        initialized = true;

        return getState();
    }

    function destroy() {
        initialized = false;
        lastResult = null;
        bound = false;
        return true;
    }

    function generate(profile, options = {}) {
        ensureInitialized();

        try {
            const result = runPipeline(profile, { ...getOptions(), ...options });

            lastResult = deepFreeze(clone(result));

            emit(EVENTS.GENERATED, {
                result: lastResult
            });

            return clone(lastResult);
        } catch (error) {
            emit(EVENTS.FAILED, {
                error: serializeError(error)
            });

            throw error;
        }
    }

    function preview(profile, options = {}) {
        ensureInitialized();

        return runPipeline(profile, {
            ...getOptions(),
            ...options,
            saveHistory: false
        });
    }

    function runPipeline(profile, options = {}) {
        const resolvedProfile = resolveProfile(profile);
        const readiness = validateGenerationReadiness(resolvedProfile);

        if (!readiness.ready) {
            updateReadinessPanel(readiness);
            throw createReadinessError(readiness);
        }

        const sourceProfile = normalizePipelineProfile(
            applyKnowledgePack(
                resolvedProfile,
                options
            ),
            readiness
        );
        const normalizedOptions = normalizeOptions(options);

        const contract = PromptBuilder.build(
            sourceProfile,
            normalizedOptions
        );

        const compiled = PromptCompiler.compile(
            contract,
            normalizedOptions
        );

        const optimized = normalizedOptions.optimize
            ? PromptOptimizer.optimize(
                compiled,
                normalizedOptions
            )
            : null;

        const output = optimized || compiled;
        const historyEntry = normalizedOptions.saveHistory
            ? saveHistory(
                output,
                sourceProfile,
                contract,
                normalizedOptions,
                Boolean(optimized)
            )
            : null;

        return clone({
            bindingVersion: VERSION,
            contract,
            compiled,
            optimized,
            historyEntry,
            provider: output.provider,
            level: output.level,
            prompt: output.prompt,
            positivePrompt: output.prompt,
            negativePrompt: output.negativePrompt,
            parameters: clone(output.parameters || {}),
            command: output.command || "",
            generatedAt: new Date().toISOString(),
            isPreview: normalizedOptions.saveHistory === false
        });
    }

    function saveHistory(
        output,
        profile,
        contract,
        options,
        optimized
    ) {
        if (!window.PromptHistoryService) {
            return null;
        }

        const context = {
            profileId: profile.id || profile.profileId || null,
            profileName: profile.name || profile.profileName || "",
            builderVersion: PromptBuilder.VERSION,
            title: options.title || profile.name || "Generación PortraitOS",
            tags: options.tags || [],
            notes: options.notes || "",
            metadata: {
                contractSchema: contract.schema,
                contractSchemaVersion: contract.schemaVersion
            }
        };

        return optimized
            ? PromptHistoryService.addOptimized(output, context)
            : PromptHistoryService.addCompiled(output, context);
    }

    function getLastResult() {
        return clone(lastResult);
    }

    function getOptions() {
        return clone(preferences);
    }

    function getOutputMode() {
        return preferences.outputMode || "full";
    }

    function getState() {
        return deepFreeze(clone({
            initialized,
            hasResult: Boolean(lastResult),
            lastResult,
            preferences
        }));
    }

    function bindWorkspace() {
        if (bound || typeof document === "undefined") return;

        document.querySelectorAll("[data-prompt-option]").forEach(control => {
            const key = control.dataset.promptOption;
            if (!key) return;

            if (control.type === "checkbox") {
                control.checked = preferences[key] !== false;
            } else if (preferences[key] !== undefined) {
                control.value = String(preferences[key]);
            }

            control.addEventListener("change", () => {
                preferences[key] = control.type === "checkbox"
                    ? control.checked
                    : control.value;

                updateWorkspaceStatus();
                emit("portraitos:prompt:options-changed", { options: getOptions() });
            });
        });

        window.addEventListener(EVENTS.GENERATED, updateHistoryCount);
        window.addEventListener("portraitos:prompt-history:changed", updateHistoryCount);

        [
            "profile:loaded",
            "profile:cleared",
            "profile:updated",
            "profile:photo-added",
            "profile:photo-removed",
            "identity:updated",
            "identity:locked",
            "identity:unlocked",
            "direction:updated",
            "knowledge-pack:changed"
        ].forEach(eventName => {
            window.addEventListener(eventName, () => {
                if (
                    eventName === "profile:loaded" ||
                    eventName === "profile:cleared"
                ) {
                    lastResult = null;
                }
                updateWorkspaceStatus();
                updateReadinessPanel();
            });
        });

        window.addEventListener(
            "validation:completed",
            event => {
                updateReadinessPanel(
                    event.detail
                        ?.readiness
                );
            }
        );

        bound = true;
    }

    function updateWorkspaceStatus() {
        if (typeof document === "undefined") return;
        const target = document.querySelector("[data-prompt-workspace-status]");
        if (!target) return;

        try {
            const profile = window.ProfileService?.getActive?.();
            target.textContent = profile ? "Preparado" : "Sin perfil activo";
            target.classList.toggle("is-ready", Boolean(profile));
            target.classList.toggle("is-error", !profile);
        } catch {
            target.textContent = "Revisión necesaria";
            target.classList.remove("is-ready");
            target.classList.add("is-error");
        }
    }

    function validateGenerationReadiness(profile) {
        if (
            !window.ProfileValidation ||
            typeof ProfileValidation.getGenerationReadiness !== "function"
        ) {
            throw createError(
                "VALIDATION_SERVICE_REQUIRED",
                "El servicio de validación no está disponible."
            );
        }

        return ProfileValidation.getGenerationReadiness(profile);
    }

    function updateReadinessPanel(readiness = null) {
        if (typeof document === "undefined") return null;

        const panel = document.querySelector("[data-prompt-readiness]");
        if (!panel) return null;

        let result = readiness;

        try {
            if (!result) {
                result = ProfileValidation.getGenerationReadiness();
            }
        } catch (error) {
            result = {
                ready: false,
                status: "blocked",
                score: 0,
                summary: { errors: 1, warnings: 0, info: 0 },
                errors: [{ message: error.message }]
            };
        }

        const score = Number.isFinite(Number(result.score))
            ? Math.max(0, Math.min(100, Number(result.score)))
            : 0;
        const status = result.ready
            ? "ready"
            : result.status === "warning"
                ? "warning"
                : "blocked";

        panel.dataset.status = status;
        panel.querySelector("[data-prompt-readiness-score]")?.replaceChildren(
            document.createTextNode(String(score))
        );
        panel.querySelector("[data-prompt-readiness-label]")?.replaceChildren(
            document.createTextNode(
                status === "ready"
                    ? "Listo para generar"
                    : status === "warning"
                        ? "Listo con advertencias"
                        : "Generación bloqueada"
            )
        );
        panel.querySelector("[data-prompt-readiness-errors]")?.replaceChildren(
            document.createTextNode(String(result.summary?.errors || 0))
        );
        panel.querySelector("[data-prompt-readiness-warnings]")?.replaceChildren(
            document.createTextNode(String(result.summary?.warnings || 0))
        );

        const generateButton = document.querySelector("[data-action='prompt-generate']");
        if (generateButton) {
            generateButton.disabled = !result.ready;
            generateButton.setAttribute(
                "aria-disabled",
                String(!result.ready)
            );
            generateButton.title = result.ready
                ? "Generar contrato"
                : result.errors?.[0]?.message || "Completa la validación antes de generar.";
        }

        return clone(result);
    }

    function createReadinessError(readiness) {
        const error = createError(
            "PROFILE_NOT_READY",
            readiness.errors?.[0]?.message ||
                "El perfil no está preparado para generar un prompt."
        );
        error.validation = clone(readiness);
        return error;
    }

    function updateHistoryCount() {
        if (typeof document === "undefined") return;
        const target = document.querySelector("[data-prompt-history-count]");
        if (!target) return;

        let count = 0;
        try {
            const snapshot = window.PromptHistoryService?.getSnapshot?.();
            count = Number.isFinite(
                Number(
                    snapshot?.entryCount
                )
            )
                ? Number(
                    snapshot.entryCount
                )
                : 0;
        } catch {
            count = 0;
        }
        target.textContent = `${count} ${count === 1 ? "generación guardada" : "generaciones guardadas"}`;
    }

    function resolveProfile(profile) {
        if (profile && typeof profile === "object") {
            return clone(profile);
        }

        if (
            window.ProfileService &&
            typeof ProfileService.getActive === "function"
        ) {
            const active = ProfileService.getActive();
            if (active) {
                return active;
            }
        }

        throw createError(
            "PROFILE_REQUIRED",
            "No existe ningún perfil disponible para generar el prompt."
        );
    }


    function applyKnowledgePack(profile, options = {}) {
        if (
            options.applyKnowledgePack === false ||
            !window.KnowledgePackService ||
            typeof KnowledgePackService.apply !== "function"
        ) {
            return profile;
        }

        return KnowledgePackService.apply(
            profile,
            options.knowledgePackId
        );
    }

    function normalizePipelineProfile(
        profile,
        readiness
    ) {
        const source = clone(profile);

        if (
            !Array.isArray(source.photos)
        ) {
            source.photos = clone(
                source.identity?.photos ||
                []
            );
        }

        source.validation = {
            ...(source.validation || {}),
            score: readiness.score,
            status: readiness.status,
            canGeneratePrompt:
                readiness.ready === true,
            validatedAt:
                readiness.generatedAt
        };

        return source;
    }

    function normalizeOptions(options) {
        const source = options && typeof options === "object"
            ? options
            : {};

        return {
            ...DEFAULT_OPTIONS,
            ...source,
            provider: normalizeText(source.provider) || DEFAULT_OPTIONS.provider,
            level: normalizeText(source.level) || DEFAULT_OPTIONS.level,
            language: normalizeText(source.language) || DEFAULT_OPTIONS.language,
            optimize: source.optimize !== false,
            saveHistory: source.saveHistory !== false
        };
    }

    function validateDependencies() {
        const required = [
            "PromptBuilder",
            "PromptCompiler",
            "PromptOptimizer"
        ];

        const missing = required.filter(name => !window[name]);

        if (missing.length) {
            throw createError(
                "MISSING_DEPENDENCY",
                `Faltan dependencias del pipeline: ${missing.join(", ")}.`
            );
        }
    }

    function ensureInitialized() {
        if (!initialized) {
            init();
        }
    }

    function emit(name, detail) {
        if (
            typeof window !== "undefined" &&
            typeof window.dispatchEvent === "function" &&
            typeof CustomEvent === "function"
        ) {
            window.dispatchEvent(
                new CustomEvent(name, {
                    detail: clone(detail)
                })
            );
        }
    }

    function serializeError(error) {
        return {
            name: error?.name || "Error",
            code: error?.code || "PROMPT_PIPELINE_ERROR",
            message: error?.message || "No se pudo generar el prompt.",
            validation: clone(error?.validation || null)
        };
    }

    function createError(code, message) {
        const error = new Error(message);
        error.name = "PromptBindingError";
        error.code = code;
        return error;
    }

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function clone(value) {
        if (value === undefined) {
            return undefined;
        }

        if (typeof structuredClone === "function") {
            return structuredClone(value);
        }

        return JSON.parse(JSON.stringify(value));
    }

    function deepFreeze(value) {
        if (
            !value ||
            typeof value !== "object" ||
            Object.isFrozen(value)
        ) {
            return value;
        }

        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
        return value;
    }

    return Object.freeze({
        VERSION,
        EVENTS,
        init,
        destroy,
        generate,
        preview,
        getLastResult,
        getOptions,
        getOutputMode,
        getState,
        updateReadinessPanel
    });

})();

window.PromptBinding = PromptBinding;
