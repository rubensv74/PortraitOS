"use strict";

/* ============================================================
   PortraitOS
   Prompt Export Service
   ------------------------------------------------------------
   Responsabilidad:
   - Serializar prompts, contratos, historial y paquetes.
   - Mantener la lógica de exportación fuera de la interfaz.
   - Generar nombres de archivo, MIME types y metadatos.
   - Proporcionar descarga y copia al portapapeles.
   ============================================================ */

const PromptExportService = (() => {

    const VERSION = "1.0.0";
    const PACKAGE_SCHEMA = "portraitos.export-package";
    const PACKAGE_VERSION = "1.0";

    const EXPORT_TYPES = Object.freeze({
        PROMPT: "prompt",
        COMPILED_PROMPT: "compiled-prompt",
        OPTIMIZED_PROMPT: "optimized-prompt",
        CONTRACT: "contract",
        HISTORY_ENTRY: "history-entry",
        HISTORY: "history",
        PACKAGE: "package",
        DATA: "data"
    });

    const FORMATS = Object.freeze({
        TXT: "txt",
        MARKDOWN: "md",
        JSON: "json",
        PORTRAITOS: "portraitos"
    });

    const MIME_TYPES = Object.freeze({
        [FORMATS.TXT]: "text/plain;charset=utf-8",
        [FORMATS.MARKDOWN]: "text/markdown;charset=utf-8",
        [FORMATS.JSON]: "application/json;charset=utf-8",
        [FORMATS.PORTRAITOS]: "application/json;charset=utf-8"
    });

    async function exportPromptOnly(source, options = {}) {
        const normalized = normalizePrompt(source);
        return createExportResult(
            EXPORT_TYPES.PROMPT,
            normalized,
            resolveOptions(options, FORMATS.TXT),
            serializePrompt
        );
    }

    async function exportCompiledPrompt(source, options = {}) {
        assertObject(source, "COMPILED_PROMPT_INVALID", "El prompt compilado no es válido.");
        return createExportResult(
            EXPORT_TYPES.COMPILED_PROMPT,
            source,
            resolveOptions(options, FORMATS.TXT),
            serializePromptArtifact
        );
    }

    async function exportOptimizedPrompt(source, options = {}) {
        assertObject(source, "OPTIMIZED_PROMPT_INVALID", "El prompt optimizado no es válido.");
        return createExportResult(
            EXPORT_TYPES.OPTIMIZED_PROMPT,
            source,
            resolveOptions(options, FORMATS.TXT),
            serializePromptArtifact
        );
    }

    async function exportContract(source, options = {}) {
        assertObject(source, "CONTRACT_INVALID", "El Portrait Contract no es válido.");
        return createExportResult(
            EXPORT_TYPES.CONTRACT,
            source,
            resolveOptions(options, FORMATS.JSON),
            serializeStructured
        );
    }

    async function exportHistoryEntry(source, options = {}) {
        assertObject(source, "HISTORY_ENTRY_INVALID", "La versión de historial no es válida.");
        return createExportResult(
            EXPORT_TYPES.HISTORY_ENTRY,
            source,
            resolveOptions(options, FORMATS.JSON),
            serializeStructured
        );
    }

    async function exportHistory(source, options = {}) {
        const history = normalizeHistory(source);
        return createExportResult(
            EXPORT_TYPES.HISTORY,
            history,
            resolveOptions(options, FORMATS.JSON),
            serializeStructured
        );
    }

    async function exportPackage(source, options = {}) {
        const resolvedOptions = resolveOptions(options, FORMATS.PORTRAITOS);
        const portablePackage = buildPackage(source, resolvedOptions);
        const result = await createExportResult(
            EXPORT_TYPES.PACKAGE,
            portablePackage,
            resolvedOptions,
            serializeStructured
        );
        return deepFreeze({ ...result, package: portablePackage });
    }

    async function exportData(source, options = {}) {
        const detectedType = detectExportType(source);
        switch (detectedType) {
            case EXPORT_TYPES.PROMPT:
                return exportPromptOnly(source, options);
            case EXPORT_TYPES.COMPILED_PROMPT:
                return exportCompiledPrompt(source, options);
            case EXPORT_TYPES.OPTIMIZED_PROMPT:
                return exportOptimizedPrompt(source, options);
            case EXPORT_TYPES.CONTRACT:
                return exportContract(source, options);
            case EXPORT_TYPES.HISTORY_ENTRY:
                return exportHistoryEntry(source, options);
            case EXPORT_TYPES.HISTORY:
                return exportHistory(source, options);
            case EXPORT_TYPES.PACKAGE:
                return exportPackage(source, options);
            default:
                return createExportResult(
                    EXPORT_TYPES.DATA,
                    source,
                    resolveOptions(options, inferDefaultFormat(source)),
                    serializeStructured
                );
        }
    }

    function buildPackage(source = {}, options = {}) {
        const input = isPlainObject(source) ? clone(source) : { data: clone(source) };
        const packageContent = {
            schema: PACKAGE_SCHEMA,
            version: PACKAGE_VERSION,
            application: "PortraitOS",
            createdAt: new Date().toISOString(),
            exportServiceVersion: VERSION,
            profile: input.profile || null,
            contract: options.includeContract === false ? null : (input.contract || null),
            compiledPrompt: input.compiledPrompt || null,
            optimizedPrompt: input.optimizedPrompt || null,
            result: input.result || null,
            history: options.includeHistory === false ? [] : normalizeHistory(input.history || []),
            metadata: {
                ...(isPlainObject(input.metadata) ? input.metadata : {}),
                format: FORMATS.PORTRAITOS
            }
        };
        return deepFreeze(packageContent);
    }

    function detectExportType(source) {
        if (Array.isArray(source)) return EXPORT_TYPES.HISTORY;
        if (typeof source === "string") return EXPORT_TYPES.PROMPT;
        if (!isPlainObject(source)) return EXPORT_TYPES.DATA;
        if (source.schema === PACKAGE_SCHEMA || source.package || source.profile && source.history) {
            return EXPORT_TYPES.PACKAGE;
        }
        if (source.identity && (source.creativeDirection || source.creative)) {
            return EXPORT_TYPES.CONTRACT;
        }
        if (source.optimizedPrompt || source.optimization || source.metrics && source.prompt) {
            return EXPORT_TYPES.OPTIMIZED_PROMPT;
        }
        if (source.compiledPrompt || source.provider && source.prompt || source.sections) {
            return EXPORT_TYPES.COMPILED_PROMPT;
        }
        if (source.id && (source.createdAt || source.timestamp) && (source.prompt || source.result || source.contract)) {
            return EXPORT_TYPES.HISTORY_ENTRY;
        }
        if (source.prompt || source.positivePrompt || source.text) {
            return EXPORT_TYPES.PROMPT;
        }
        if (Array.isArray(source.items) || Array.isArray(source.history)) {
            return EXPORT_TYPES.HISTORY;
        }
        return EXPORT_TYPES.DATA;
    }

    async function createExportResult(type, source, options, serializer) {
        const content = serializer(source, options, type);
        const fileName = resolveFileName(type, options.format, options.fileName, source);
        const mimeType = MIME_TYPES[options.format] || MIME_TYPES[FORMATS.TXT];

        if (options.download !== false) {
            await downloadContent(content, fileName, mimeType);
        }
        if (options.copy === true) {
            await copyText(content);
        }

        return deepFreeze({
            type,
            format: options.format,
            fileName,
            mimeType,
            content,
            size: calculateSize(content),
            createdAt: new Date().toISOString(),
            metadata: options.includeMetadata === false ? null : {
                application: "PortraitOS",
                exportServiceVersion: VERSION
            }
        });
    }

    function serializePrompt(source, options) {
        if (options.format === FORMATS.JSON || options.format === FORMATS.PORTRAITOS) {
            return stringify(source, options.prettyPrint);
        }
        return serializePromptArtifact(source, options);
    }

    function serializePromptArtifact(source, options) {
        if (options.format === FORMATS.JSON || options.format === FORMATS.PORTRAITOS) {
            return stringify(source, options.prettyPrint);
        }

        const prompt = firstText(
            source.optimizedPrompt,
            source.compiledPrompt,
            source.prompt,
            source.positivePrompt,
            source.text,
            source.result?.prompt
        );
        const negativePrompt = firstText(
            source.negativePrompt,
            source.negative,
            source.result?.negativePrompt
        );
        const parameters = source.parameters || source.settings || source.providerParameters || null;
        const command = firstText(source.command, source.providerCommand);
        const sections = [];

        if (options.format === FORMATS.MARKDOWN) {
            sections.push("# PortraitOS Prompt", "", prompt || "");
            if (options.includeNegativePrompt !== false && negativePrompt) {
                sections.push("", "## Negative prompt", "", negativePrompt);
            }
            if (options.includeParameters !== false && parameters) {
                sections.push("", "## Parameters", "", "```json", stringify(parameters, true), "```");
            }
            if (options.includeCommand === true && command) {
                sections.push("", "## Command", "", "```text", command, "```");
            }
            return sections.join("\n").trim();
        }

        sections.push(prompt || "");
        if (options.includeNegativePrompt !== false && negativePrompt) {
            sections.push("", "NEGATIVE PROMPT", negativePrompt);
        }
        if (options.includeParameters !== false && parameters) {
            sections.push("", "PARAMETERS", stringify(parameters, true));
        }
        if (options.includeCommand === true && command) {
            sections.push("", "COMMAND", command);
        }
        return sections.join("\n").trim();
    }

    function serializeStructured(source, options, type) {
        if (options.format === FORMATS.JSON || options.format === FORMATS.PORTRAITOS) {
            return stringify(source, options.prettyPrint);
        }
        if (type === EXPORT_TYPES.HISTORY && options.format === FORMATS.MARKDOWN) {
            return serializeHistoryMarkdown(source);
        }
        if (type === EXPORT_TYPES.CONTRACT && options.format === FORMATS.MARKDOWN) {
            return serializeObjectMarkdown("Portrait Contract", source);
        }
        return stringify(source, options.prettyPrint);
    }

    function serializeHistoryMarkdown(history) {
        const items = normalizeHistory(history);
        const lines = ["# PortraitOS Prompt History", ""];
        items.forEach((entry, index) => {
            lines.push(`## ${entry.name || entry.title || `Version ${index + 1}`}`);
            if (entry.createdAt || entry.timestamp) lines.push("", `Created: ${entry.createdAt || entry.timestamp}`);
            const prompt = firstText(entry.optimizedPrompt, entry.compiledPrompt, entry.prompt, entry.result?.prompt);
            if (prompt) lines.push("", prompt);
            lines.push("");
        });
        return lines.join("\n").trim();
    }

    function serializeObjectMarkdown(title, value) {
        return [`# ${title}`, "", "```json", stringify(value, true), "```"].join("\n");
    }

    async function downloadContent(content, fileName, mimeType = MIME_TYPES[FORMATS.TXT]) {
        if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
            return false;
        }
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        return true;
    }

    async function copyText(content) {
        const text = String(content ?? "");
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        if (typeof document === "undefined") {
            throw createExportError("CLIPBOARD_UNAVAILABLE", "El portapapeles no está disponible.");
        }
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw createExportError("COPY_FAILED", "No se pudo copiar el contenido.");
        return true;
    }

    function resolveOptions(options, defaultFormat) {
        const normalized = isPlainObject(options) ? options : {};
        return {
            ...normalized,
            format: normalizeFormat(normalized.format || defaultFormat),
            prettyPrint: normalized.prettyPrint !== false,
            includeMetadata: normalized.includeMetadata !== false,
            includeNegativePrompt: normalized.includeNegativePrompt !== false,
            includeParameters: normalized.includeParameters !== false,
            includeCommand: normalized.includeCommand === true,
            includeContract: normalized.includeContract !== false,
            includeHistory: normalized.includeHistory !== false,
            download: normalized.download !== false,
            copy: normalized.copy === true
        };
    }

    function resolveFileName(type, format, requestedName, source) {
        const extension = format === FORMATS.MARKDOWN ? "md" : format;
        if (normalizeText(requestedName)) return ensureExtension(sanitizeFileName(requestedName), extension);
        const subject = sanitizeFileName(
            source?.name || source?.title || source?.profile?.name || type
        );
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        return `${subject || "portraitos-export"}-${timestamp}.${extension}`;
    }

    function normalizePrompt(source) {
        if (typeof source === "string") return { prompt: source };
        assertObject(source, "PROMPT_INVALID", "El prompt no es válido.");
        return source;
    }

    function normalizeHistory(source) {
        if (Array.isArray(source)) return clone(source);
        if (Array.isArray(source?.items)) return clone(source.items);
        if (Array.isArray(source?.history)) return clone(source.history);
        return [];
    }

    function normalizeFormat(value) {
        const normalized = normalizeText(value).toLowerCase().replace(/^\./, "");
        const aliases = { markdown: FORMATS.MARKDOWN, text: FORMATS.TXT, package: FORMATS.PORTRAITOS };
        const resolved = aliases[normalized] || normalized;
        return Object.values(FORMATS).includes(resolved) ? resolved : FORMATS.TXT;
    }

    function inferDefaultFormat(source) {
        return typeof source === "string" ? FORMATS.TXT : FORMATS.JSON;
    }

    function ensureExtension(fileName, extension) {
        const normalized = sanitizeFileName(fileName);
        return normalized.toLowerCase().endsWith(`.${extension}`) ? normalized : `${normalized}.${extension}`;
    }

    function sanitizeFileName(value) {
        return normalizeText(value)
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^[-.]+|[-.]+$/g, "")
            .slice(0, 120) || "portraitos-export";
    }

    function calculateSize(content) {
        if (typeof Blob !== "undefined") return new Blob([content]).size;
        return String(content ?? "").length;
    }

    function stringify(value, prettyPrint) {
        return JSON.stringify(value, null, prettyPrint ? 2 : 0);
    }

    function firstText(...values) {
        return values.map(normalizeText).find(Boolean) || "";
    }

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function assertObject(value, code, message) {
        if (!isPlainObject(value)) throw createExportError(code, message);
    }

    function isPlainObject(value) {
        return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }

    function createExportError(code, message, details = null) {
        const error = new Error(message);
        error.name = "PromptExportError";
        error.code = code;
        error.details = clone(details);
        return error;
    }

    function clone(value) {
        if (value === undefined) return undefined;
        if (typeof structuredClone === "function") return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function deepFreeze(value) {
        if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
        return value;
    }

    return Object.freeze({
        VERSION,
        PACKAGE_SCHEMA,
        PACKAGE_VERSION,
        EXPORT_TYPES,
        FORMATS,
        MIME_TYPES,
        exportPromptOnly,
        exportCompiledPrompt,
        exportOptimizedPrompt,
        exportContract,
        exportHistoryEntry,
        exportHistory,
        exportPackage,
        exportData,
        buildPackage,
        detectExportType,
        downloadContent,
        copyText
    });

})();

window.PromptExportService = PromptExportService;
