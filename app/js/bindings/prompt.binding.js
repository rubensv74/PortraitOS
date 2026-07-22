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
        GENERATED: "portraitos:prompt:generated",
        FAILED: "portraitos:prompt:failed"
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

        initialized = true;

        return getState();
    }

    function destroy() {
        initialized = false;
        lastResult = null;
        return true;
    }

    function generate(profile, options = {}) {
        ensureInitialized();

        try {
            const result = runPipeline(profile, options);

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
            ...options,
            saveHistory: false
        });
    }

    function runPipeline(profile, options = {}) {
        const sourceProfile = resolveProfile(profile);
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

    function getState() {
        return deepFreeze(clone({
            initialized,
            hasResult: Boolean(lastResult),
            lastResult
        }));
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
        getState
    });

})();

window.PromptBinding = PromptBinding;
