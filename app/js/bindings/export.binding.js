"use strict";

/* ============================================================
   PortraitOS
   Export Binding
   ------------------------------------------------------------
   Responsabilidad:
   - Conectar PromptExportService con la interfaz.
   - Exportar prompts, contratos, historial y paquetes.
   - Copiar contenido al portapapeles.
   - Gestionar formato, alcance y opciones de exportación.
   - Mostrar previsualización, estado, errores y resultados.
   - Evitar lógica de serialización dentro del DOM.
   ============================================================ */

const ExportBinding = (() => {

    /* ========================================================
       CONFIGURACIÓN
       ======================================================== */

    const VERSION = "1.0.0";

    const EVENTS = Object.freeze({
        INITIALIZED:
            "portraitos:export-binding:initialized",

        STATE_CHANGED:
            "portraitos:export-binding:state-changed",

        EXPORT_STARTED:
            "portraitos:export-binding:export-started",

        EXPORT_COMPLETED:
            "portraitos:export-binding:export-completed",

        EXPORT_FAILED:
            "portraitos:export-binding:export-failed",

        PREVIEW_UPDATED:
            "portraitos:export-binding:preview-updated",

        COPIED:
            "portraitos:export-binding:copied",

        PACKAGE_CREATED:
            "portraitos:export-binding:package-created"
    });

    const STATUS = Object.freeze({
        IDLE:
            "idle",

        PREPARING:
            "preparing",

        EXPORTING:
            "exporting",

        COPYING:
            "copying",

        READY:
            "ready",

        ERROR:
            "error"
    });

    const EXPORT_TYPES = Object.freeze({
        AUTO:
            "auto",

        PROMPT:
            "prompt",

        COMPILED_PROMPT:
            "compiled-prompt",

        OPTIMIZED_PROMPT:
            "optimized-prompt",

        CONTRACT:
            "contract",

        HISTORY_ENTRY:
            "history-entry",

        HISTORY:
            "history",

        PACKAGE:
            "package"
    });

    const FORMATS = Object.freeze({
        TXT:
            "txt",

        MARKDOWN:
            "md",

        JSON:
            "json",

        PORTRAITOS:
            "portraitos"
    });

    const DEFAULT_SELECTORS = Object.freeze({
        root:
            "[data-export-binding]",

        exportButton:
            "[data-action='export-current']",

        copyButton:
            "[data-action='copy-export']",

        previewButton:
            "[data-action='preview-export']",

        packageButton:
            "[data-action='export-package']",

        promptButton:
            "[data-action='export-prompt']",

        contractButton:
            "[data-action='export-contract']",

        historyButton:
            "[data-action='export-history']",

        selectedHistoryButton:
            "[data-action='export-selected-history']",

        clearButton:
            "[data-action='clear-export-preview']",

        type:
            "[data-export-field='type']",

        format:
            "[data-export-field='format']",

        fileName:
            "[data-export-field='file-name']",

        includeMetadata:
            "[data-export-field='include-metadata']",

        includeNegativePrompt:
            "[data-export-field='include-negative-prompt']",

        includeParameters:
            "[data-export-field='include-parameters']",

        includeCommand:
            "[data-export-field='include-command']",

        includeContract:
            "[data-export-field='include-contract']",

        includeHistory:
            "[data-export-field='include-history']",

        download:
            "[data-export-field='download']",

        copy:
            "[data-export-field='copy']",

        prettyPrint:
            "[data-export-field='pretty-print']",

        preview:
            "[data-export-preview]",

        previewWrapper:
            "[data-export-preview-wrapper]",

        status:
            "[data-export-status]",

        statusMessage:
            "[data-export-status-message]",

        loading:
            "[data-export-loading]",

        error:
            "[data-export-error]",

        result:
            "[data-export-result]",

        fileNameOutput:
            "[data-export-file-name]",

        formatOutput:
            "[data-export-format]",

        sizeOutput:
            "[data-export-size]",

        typeOutput:
            "[data-export-type]",

        empty:
            "[data-export-empty]"
    });

    const DEFAULT_OPTIONS = Object.freeze({
        selectors:
            DEFAULT_SELECTORS,

        type:
            EXPORT_TYPES.AUTO,

        format:
            FORMATS.TXT,

        includeMetadata:
            true,

        includeNegativePrompt:
            true,

        includeParameters:
            true,

        includeCommand:
            true,

        includeContract:
            true,

        includeHistory:
            false,

        download:
            true,

        copy:
            false,

        prettyPrint:
            true,

        autoPreview:
            false,

        notify:
            true,

        sourceResolver:
            null
    });

    /* ========================================================
       ESTADO
       ======================================================== */

    let initialized =
        false;

    let options =
        clone(DEFAULT_OPTIONS);

    let rootElement =
        null;

    let elements =
        {};

    let listeners =
        [];

    let operationSequence =
        0;

    let state =
        createInitialState();

    /* ========================================================
       INICIALIZACIÓN
       ======================================================== */

    function init(config = {}) {
        if (initialized) {
            destroy();
        }

        options =
            normalizeOptions(config);

        rootElement =
            resolveRoot(
                options.root
            );

        elements =
            collectElements(
                rootElement,
                options.selectors
            );

        validateDependencies();

        state =
            createInitialState();

        hydrateControls();

        bindEvents();

        render();

        initialized =
            true;

        emit(
            EVENTS.INITIALIZED,
            {
                version:
                    VERSION,

                state:
                    getState()
            }
        );

        if (
            options.autoPreview
        ) {
            window.setTimeout(
                () => {
                    preview()
                        .catch(
                            handleUnhandledError
                        );
                },
                0
            );
        }

        return getState();
    }

    function destroy() {
        listeners.forEach(
            unsubscribe => {
                try {
                    unsubscribe();
                } catch {
                    // No bloquear destrucción.
                }
            }
        );

        listeners =
            [];

        elements =
            {};

        rootElement =
            null;

        initialized =
            false;

        state =
            createInitialState();
    }

    function ensureInitialized() {
        if (!initialized) {
            init();
        }
    }

    /* ========================================================
       EXPORTACIÓN PRINCIPAL
       ======================================================== */

    async function exportCurrent(
        overrides = {}
    ) {
        ensureInitialized();

        const operationId =
            ++operationSequence;

        const exportOptions =
            resolveExportOptions(
                overrides
            );

        transition(
            STATUS.PREPARING,
            {
                error:
                    null
            }
        );

        emit(
            EVENTS.EXPORT_STARTED,
            {
                operationId,

                options:
                    clone(
                        exportOptions
                    )
            }
        );

        try {
            const source =
                await resolveSource(
                    exportOptions
                );

            assertOperationCurrent(
                operationId
            );

            const resolvedType =
                resolveExportType(
                    source,
                    exportOptions.type
                );

            transition(
                STATUS.EXPORTING,
                {
                    source,

                    exportType:
                        resolvedType
                }
            );

            const result =
                await executeExport(
                    resolvedType,
                    source,
                    exportOptions
                );

            assertOperationCurrent(
                operationId
            );

            state = {
                ...state,

                status:
                    STATUS.READY,

                source,

                exportType:
                    resolvedType,

                format:
                    exportOptions.format,

                result,

                preview:
                    resolveResultContent(
                        result
                    ),

                fileName:
                    resolveResultFileName(
                        result
                    ),

                size:
                    calculateContentSize(
                        resolveResultContent(
                            result
                        )
                    ),

                completedAt:
                    new Date()
                        .toISOString(),

                error:
                    null,

                operationId
            };

            render();

            emitStateChanged();

            emit(
                EVENTS.EXPORT_COMPLETED,
                {
                    operationId,

                    type:
                        resolvedType,

                    format:
                        exportOptions.format,

                    result:
                        clone(result)
                }
            );

            showNotification(
                buildSuccessMessage(
                    resolvedType,
                    exportOptions.format
                ),
                "success"
            );

            return deepFreeze(
                clone(result)
            );
        } catch (error) {
            if (
                error?.code ===
                "OPERATION_SUPERSEDED"
            ) {
                return null;
            }

            const normalizedError =
                normalizeError(error);

            state = {
                ...state,

                status:
                    STATUS.ERROR,

                error:
                    normalizedError,

                operationId
            };

            render();

            emitStateChanged();

            emit(
                EVENTS.EXPORT_FAILED,
                {
                    operationId,

                    error:
                        clone(
                            normalizedError
                        )
                }
            );

            showNotification(
                normalizedError.message,
                "error"
            );

            throw error;
        }
    }

    async function executeExport(
        type,
        source,
        exportOptions
    ) {
        const service =
            window
                .PromptExportService;

        switch (type) {
            case EXPORT_TYPES.PROMPT:
                return service
                    .exportPromptOnly(
                        normalizePromptSource(
                            source
                        ),
                        exportOptions
                    );

            case EXPORT_TYPES.COMPILED_PROMPT:
                return service
                    .exportCompiledPrompt(
                        source,
                        exportOptions
                    );

            case EXPORT_TYPES.OPTIMIZED_PROMPT:
                return service
                    .exportOptimizedPrompt(
                        source,
                        exportOptions
                    );

            case EXPORT_TYPES.CONTRACT:
                return service
                    .exportContract(
                        source,
                        exportOptions
                    );

            case EXPORT_TYPES.HISTORY_ENTRY:
                return service
                    .exportHistoryEntry(
                        source,
                        exportOptions
                    );

            case EXPORT_TYPES.HISTORY:
                return service
                    .exportHistory(
                        normalizeHistorySource(
                            source
                        ),
                        exportOptions
                    );

            case EXPORT_TYPES.PACKAGE:
                return exportPackage(
                    source,
                    exportOptions
                );

            default:
                return service
                    .exportData(
                        source,
                        exportOptions
                    );
        }
    }

    /* ========================================================
       EXPORTACIONES ESPECIALIZADAS
       ======================================================== */

    function exportPrompt(
        overrides = {}
    ) {
        return exportCurrent({
            ...overrides,

            type:
                resolvePromptType()
        });
    }

    function exportContract(
        overrides = {}
    ) {
        return exportCurrent({
            ...overrides,

            type:
                EXPORT_TYPES
                    .CONTRACT,

            format:
                overrides.format ||
                FORMATS.JSON
        });
    }

    function exportHistory(
        overrides = {}
    ) {
        return exportCurrent({
            ...overrides,

            type:
                EXPORT_TYPES
                    .HISTORY,

            format:
                overrides.format ||
                FORMATS.JSON
        });
    }

    function exportSelectedHistory(
        overrides = {}
    ) {
        const selection =
            window
                .HistoryBinding
                ?.getSelection?.() ||
            [];

        if (!selection.length) {
            throw createBindingError(
                "HISTORY_SELECTION_EMPTY",
                "No hay versiones seleccionadas para exportar."
            );
        }

        const entries =
            selection
                .map(
                    id =>
                        window
                            .PromptHistoryService
                            ?.getById(id)
                )
                .filter(Boolean);

        return exportCurrent({
            ...overrides,

            type:
                EXPORT_TYPES
                    .HISTORY,

            source:
                entries,

            format:
                overrides.format ||
                FORMATS.JSON
        });
    }

    async function exportPackage(
        source = null,
        overrides = {}
    ) {
        ensureInitialized();

        const service =
            window
                .PromptExportService;

        const packageSource =
            source ||
            await resolvePackageSource();

        const exportOptions = {
            ...readControlOptions(),

            ...normalizeObject(
                overrides
            ),

            type:
                EXPORT_TYPES
                    .PACKAGE,

            format:
                FORMATS
                    .PORTRAITOS
        };

        if (
            typeof service
                .exportPackage ===
                "function"
        ) {
            return service
                .exportPackage(
                    packageSource,
                    exportOptions
                );
        }

        const portablePackage =
            service.buildPackage(
                packageSource,
                exportOptions
            );

        const content =
            JSON.stringify(
                portablePackage,
                null,
                exportOptions
                    .prettyPrint
                    ? 2
                    : 0
            );

        const fileName =
            resolvePackageFileName(
                exportOptions
            );

        if (
            exportOptions.download !==
            false
        ) {
            await service
                .downloadContent(
                    content,
                    fileName,
                    "application/json"
                );
        }

        if (
            exportOptions.copy ===
            true
        ) {
            await service
                .copyText(
                    content
                );
        }

        const result = {
            type:
                EXPORT_TYPES
                    .PACKAGE,

            format:
                FORMATS
                    .PORTRAITOS,

            fileName,

            content,

            package:
                portablePackage
        };

        emit(
            EVENTS.PACKAGE_CREATED,
            {
                result:
                    clone(result)
            }
        );

        return result;
    }

    /* ========================================================
       PREVISUALIZACIÓN
       ======================================================== */

    async function preview(
        overrides = {}
    ) {
        ensureInitialized();

        const operationId =
            ++operationSequence;

        const previewOptions = {
            ...resolveExportOptions(
                overrides
            ),

            download:
                false,

            copy:
                false
        };

        transition(
            STATUS.PREPARING,
            {
                error:
                    null
            }
        );

        try {
            const source =
                await resolveSource(
                    previewOptions
                );

            assertOperationCurrent(
                operationId
            );

            const resolvedType =
                resolveExportType(
                    source,
                    previewOptions.type
                );

            const result =
                await executeExport(
                    resolvedType,
                    source,
                    previewOptions
                );

            assertOperationCurrent(
                operationId
            );

            const content =
                resolveResultContent(
                    result
                );

            state = {
                ...state,

                status:
                    STATUS.READY,

                source,

                exportType:
                    resolvedType,

                format:
                    previewOptions
                        .format,

                result,

                preview:
                    content,

                fileName:
                    resolveResultFileName(
                        result
                    ),

                size:
                    calculateContentSize(
                        content
                    ),

                completedAt:
                    new Date()
                        .toISOString(),

                error:
                    null,

                operationId
            };

            render();

            emitStateChanged();

            emit(
                EVENTS.PREVIEW_UPDATED,
                {
                    type:
                        resolvedType,

                    format:
                        previewOptions
                            .format,

                    content,

                    result:
                        clone(result)
                }
            );

            return content;
        } catch (error) {
            const normalizedError =
                normalizeError(error);

            state = {
                ...state,

                status:
                    STATUS.ERROR,

                error:
                    normalizedError
            };

            render();

            throw error;
        }
    }

    function clearPreview() {
        state = {
            ...state,

            status:
                STATUS.IDLE,

            result:
                null,

            preview:
                "",

            fileName:
                "",

            size:
                0,

            error:
                null
        };

        render();

        emitStateChanged();
    }

    /* ========================================================
       COPIAR
       ======================================================== */

    async function copyCurrent(
        overrides = {}
    ) {
        ensureInitialized();

        transition(
            STATUS.COPYING,
            {
                error:
                    null
            }
        );

        try {
            let content =
                state.preview;

            if (
                !content ||
                overrides.regenerate ===
                    true
            ) {
                content =
                    await preview(
                        overrides
                    );
            }

            if (!content) {
                throw createBindingError(
                    "EXPORT_CONTENT_EMPTY",
                    "No hay contenido para copiar."
                );
            }

            await window
                .PromptExportService
                .copyText(content);

            state = {
                ...state,

                status:
                    STATUS.READY,

                error:
                    null
            };

            render();

            emitStateChanged();

            emit(
                EVENTS.COPIED,
                {
                    characterCount:
                        content.length,

                    type:
                        state.exportType,

                    format:
                        state.format
                }
            );

            showNotification(
                "Contenido copiado al portapapeles.",
                "success"
            );

            return true;
        } catch (error) {
            const normalizedError =
                normalizeError(error);

            state = {
                ...state,

                status:
                    STATUS.ERROR,

                error:
                    normalizedError
            };

            render();

            showNotification(
                normalizedError.message,
                "error"
            );

            throw error;
        }
    }

    /* ========================================================
       RESOLUCIÓN DE DATOS
       ======================================================== */

    async function resolveSource(
        exportOptions
    ) {
        if (
            exportOptions.source !==
            undefined &&
            exportOptions.source !==
            null
        ) {
            return clone(
                exportOptions.source
            );
        }

        if (
            typeof options
                .sourceResolver ===
            "function"
        ) {
            const resolved =
                await options
                    .sourceResolver(
                        exportOptions
                    );

            if (
                resolved !==
                undefined &&
                resolved !==
                null
            ) {
                return resolved;
            }
        }

        switch (
            exportOptions.type
        ) {
            case EXPORT_TYPES.CONTRACT:
                return resolveContract();

            case EXPORT_TYPES.HISTORY:
                return resolveHistory();

            case EXPORT_TYPES.HISTORY_ENTRY:
                return resolveHistoryEntry(
                    exportOptions
                        .historyEntryId
                );

            case EXPORT_TYPES.PACKAGE:
                return resolvePackageSource();

            case EXPORT_TYPES.COMPILED_PROMPT:
                return resolveCompiledPrompt();

            case EXPORT_TYPES.OPTIMIZED_PROMPT:
                return resolveOptimizedPrompt();

            case EXPORT_TYPES.PROMPT:
                return resolvePrompt();

            case EXPORT_TYPES.AUTO:
            default:
                return resolveAutomaticSource();
        }
    }

    function resolveAutomaticSource() {
        const promptState =
            window
                .PromptBinding
                ?.getState?.();

        if (
            promptState
                ?.optimized
        ) {
            return promptState
                .optimized;
        }

        if (
            promptState
                ?.compiled
        ) {
            return promptState
                .compiled;
        }

        if (
            promptState
                ?.result
        ) {
            return promptState
                .result;
        }

        if (
            promptState
                ?.contract
        ) {
            return promptState
                .contract;
        }

        const latest =
            window
                .PromptHistoryService
                ?.getLatest?.();

        if (latest) {
            return latest;
        }

        throw createBindingError(
            "EXPORT_SOURCE_UNAVAILABLE",
            "No hay contenido disponible para exportar."
        );
    }

    function resolvePrompt() {
        const result =
            window
                .PromptBinding
                ?.getResult?.();

        if (!result) {
            throw createBindingError(
                "PROMPT_UNAVAILABLE",
                "No hay ningún prompt generado."
            );
        }

        return result;
    }

    function resolveCompiledPrompt() {
        const compiled =
            window
                .PromptBinding
                ?.getState?.()
                ?.compiled;

        if (!compiled) {
            throw createBindingError(
                "COMPILED_PROMPT_UNAVAILABLE",
                "No hay ningún prompt compilado."
            );
        }

        return compiled;
    }

    function resolveOptimizedPrompt() {
        const optimized =
            window
                .PromptBinding
                ?.getState?.()
                ?.optimized;

        if (!optimized) {
            throw createBindingError(
                "OPTIMIZED_PROMPT_UNAVAILABLE",
                "No hay ningún prompt optimizado."
            );
        }

        return optimized;
    }

    function resolveContract() {
        const contract =
            window
                .PromptBinding
                ?.getContract?.();

        if (!contract) {
            throw createBindingError(
                "CONTRACT_UNAVAILABLE",
                "No hay ningún Portrait Contract disponible."
            );
        }

        return contract;
    }

    function resolveHistory() {
        if (
            window
                .HistoryBinding
                ?.getFilteredHistory
        ) {
            const filtered =
                window
                    .HistoryBinding
                    .getFilteredHistory();

            if (filtered.length) {
                return filtered;
            }
        }

        const result =
            window
                .PromptHistoryService
                ?.list?.({
                    limit:
                        Number
                            .MAX_SAFE_INTEGER
                });

        return result?.items ||
            [];
    }

    function resolveHistoryEntry(
        entryId
    ) {
        const resolvedId =
            entryId ||
            window
                .PromptBinding
                ?.getState?.()
                ?.historyEntryId;

        const entry =
            resolvedId
                ? window
                    .PromptHistoryService
                    ?.getById?.(
                        resolvedId
                    )
                : window
                    .PromptHistoryService
                    ?.getLatest?.();

        if (!entry) {
            throw createBindingError(
                "HISTORY_ENTRY_UNAVAILABLE",
                "No hay ninguna versión de historial disponible."
            );
        }

        return entry;
    }

    async function resolvePackageSource() {
        const promptState =
            window
                .PromptBinding
                ?.getState?.() ||
            {};

        const profile =
            await resolveCurrentProfile();

        return {
            profile,

            contract:
                promptState.contract ||
                null,

            compiledPrompt:
                promptState.compiled ||
                null,

            optimizedPrompt:
                promptState.optimized ||
                null,

            result:
                promptState.result ||
                null,

            history:
                options.includeHistory
                    ? resolveHistory()
                    : [],

            metadata: {
                application:
                    "PortraitOS",

                bindingVersion:
                    VERSION,

                createdAt:
                    new Date()
                        .toISOString()
            }
        };
    }

    async function resolveCurrentProfile() {
        if (
            window
                .ProfileBinding
                ?.getProfile
        ) {
            return window
                .ProfileBinding
                .getProfile();
        }

        if (
            window
                .ProfileService
                ?.getActive
        ) {
            return await window
                .ProfileService
                .getActive();
        }

        if (
            window
                .ProfileService
                ?.getCurrent
        ) {
            return await window
                .ProfileService
                .getCurrent();
        }

        return null;
    }

    /* ========================================================
       DETECCIÓN DE TIPO
       ======================================================== */

    function resolveExportType(
        source,
        requestedType
    ) {
        if (
            requestedType &&
            requestedType !==
            EXPORT_TYPES.AUTO
        ) {
            return requestedType;
        }

        const service =
            window
                .PromptExportService;

        if (
            typeof service
                .detectExportType ===
            "function"
        ) {
            const detected =
                service
                    .detectExportType(
                        source
                    );

            return normalizeDetectedType(
                detected
            );
        }

        if (Array.isArray(source)) {
            return EXPORT_TYPES
                .HISTORY;
        }

        if (
            source?.identity &&
            source?.creativeDirection
        ) {
            return EXPORT_TYPES
                .CONTRACT;
        }

        if (
            source?.optimizedPrompt ||
            source?.optimization
        ) {
            return EXPORT_TYPES
                .OPTIMIZED_PROMPT;
        }

        if (
            source?.compiledPrompt ||
            source?.compilerVersion
        ) {
            return EXPORT_TYPES
                .COMPILED_PROMPT;
        }

        if (
            source?.history ||
            source?.profile &&
            source?.contract
        ) {
            return EXPORT_TYPES
                .PACKAGE;
        }

        if (
            source?.version &&
            source?.createdAt &&
            source?.prompt
        ) {
            return EXPORT_TYPES
                .HISTORY_ENTRY;
        }

        return EXPORT_TYPES
            .PROMPT;
    }

    function normalizeDetectedType(
        type
    ) {
        const aliases = {
            prompt:
                EXPORT_TYPES.PROMPT,

            compiled:
                EXPORT_TYPES
                    .COMPILED_PROMPT,

            "compiled-prompt":
                EXPORT_TYPES
                    .COMPILED_PROMPT,

            optimized:
                EXPORT_TYPES
                    .OPTIMIZED_PROMPT,

            "optimized-prompt":
                EXPORT_TYPES
                    .OPTIMIZED_PROMPT,

            contract:
                EXPORT_TYPES.CONTRACT,

            history:
                EXPORT_TYPES.HISTORY,

            "history-entry":
                EXPORT_TYPES
                    .HISTORY_ENTRY,

            package:
                EXPORT_TYPES.PACKAGE
        };

        return aliases[type] ||
            EXPORT_TYPES.PROMPT;
    }

    function resolvePromptType() {
        const promptState =
            window
                .PromptBinding
                ?.getState?.();

        if (
            promptState
                ?.optimized
        ) {
            return EXPORT_TYPES
                .OPTIMIZED_PROMPT;
        }

        if (
            promptState
                ?.compiled
        ) {
            return EXPORT_TYPES
                .COMPILED_PROMPT;
        }

        return EXPORT_TYPES
            .PROMPT;
    }

    /* ========================================================
       CONTROLES
       ======================================================== */

    function bindEvents() {
        bindClick(
            elements.exportButton,
            () =>
                exportCurrent()
        );

        bindClick(
            elements.copyButton,
            () =>
                copyCurrent()
        );

        bindClick(
            elements.previewButton,
            () =>
                preview()
        );

        bindClick(
            elements.packageButton,
            () =>
                exportCurrent({
                    type:
                        EXPORT_TYPES
                            .PACKAGE,

                    format:
                        FORMATS
                            .PORTRAITOS
                })
        );

        bindClick(
            elements.promptButton,
            () =>
                exportPrompt()
        );

        bindClick(
            elements.contractButton,
            () =>
                exportContract()
        );

        bindClick(
            elements.historyButton,
            () =>
                exportHistory()
        );

        bindClick(
            elements
                .selectedHistoryButton,
            () =>
                exportSelectedHistory()
        );

        bindClick(
            elements.clearButton,
            () =>
                clearPreview()
        );

        [
            elements.type,
            elements.format,
            elements.fileName,
            elements.includeMetadata,
            elements
                .includeNegativePrompt,
            elements.includeParameters,
            elements.includeCommand,
            elements.includeContract,
            elements.includeHistory,
            elements.download,
            elements.copy,
            elements.prettyPrint
        ]
            .filter(Boolean)
            .forEach(
                element => {
                    bindDomEvent(
                        element,
                        "change",
                        handleControlChange
                    );
                }
            );

        bindWindowEvent(
            "portraitos:prompt-binding:generation-completed",
            handleSourceChanged
        );

        bindWindowEvent(
            "portraitos:prompt-binding:history-restored",
            handleSourceChanged
        );

        bindWindowEvent(
            "portraitos:history-binding:changed",
            handleSourceChanged
        );
    }

    function handleControlChange() {
        state = {
            ...state,

            controls:
                readControlOptions()
        };

        renderControlsMetadata();

        emitStateChanged();

        if (
            options.autoPreview
        ) {
            preview()
                .catch(
                    handleUnhandledError
                );
        }
    }

    function handleSourceChanged() {
        if (
            options.autoPreview
        ) {
            preview()
                .catch(
                    handleUnhandledError
                );
        }
    }

    function bindClick(
        element,
        handler
    ) {
        if (!element) {
            return;
        }

        bindDomEvent(
            element,
            "click",
            event => {
                event.preventDefault();

                Promise.resolve(
                    handler(event)
                )
                    .catch(
                        handleUnhandledError
                    );
            }
        );
    }

    function bindDomEvent(
        element,
        eventName,
        handler
    ) {
        element.addEventListener(
            eventName,
            handler
        );

        listeners.push(
            () => {
                element
                    .removeEventListener(
                        eventName,
                        handler
                    );
            }
        );
    }

    function bindWindowEvent(
        eventName,
        handler
    ) {
        window.addEventListener(
            eventName,
            handler
        );

        listeners.push(
            () => {
                window
                    .removeEventListener(
                        eventName,
                        handler
                    );
            }
        );
    }

    /* ========================================================
       RENDER
       ======================================================== */

    function render() {
        renderStatus();
        renderPreview();
        renderResultMetadata();
        renderVisibility();
        renderButtons();
        renderControlsMetadata();
    }

    function renderStatus() {
        if (elements.status) {
            elements.status
                .dataset
                .exportStatus =
                    state.status;

            elements.status
                .setAttribute(
                    "aria-busy",
                    isBusyStatus(
                        state.status
                    )
                        ? "true"
                        : "false"
                );
        }

        setText(
            elements.statusMessage,
            getStatusMessage(
                state.status
            )
        );

        setHidden(
            elements.loading,
            !isBusyStatus(
                state.status
            )
        );

        const errorMessage =
            state.error?.message ||
            "";

        setText(
            elements.error,
            errorMessage
        );

        setHidden(
            elements.error,
            !errorMessage
        );
    }

    function renderPreview() {
        setOutputValue(
            elements.preview,
            state.preview ||
            ""
        );

        if (
            elements.previewWrapper
        ) {
            elements
                .previewWrapper
                .dataset
                .hasPreview =
                    state.preview
                        ? "true"
                        : "false";
        }
    }

    function renderResultMetadata() {
        setText(
            elements.fileNameOutput,
            state.fileName ||
            "—"
        );

        setText(
            elements.formatOutput,
            state.format
                ? state.format
                    .toUpperCase()
                : "—"
        );

        setText(
            elements.typeOutput,
            state.exportType ||
            "—"
        );

        setText(
            elements.sizeOutput,
            formatBytes(
                state.size ||
                0
            )
        );
    }

    function renderVisibility() {
        const hasPreview =
            Boolean(
                state.preview
            );

        setHidden(
            elements.empty,
            hasPreview
        );

        setHidden(
            elements.result,
            !hasPreview
        );
    }

    function renderButtons() {
        const busy =
            isBusyStatus(
                state.status
            );

        [
            elements.exportButton,
            elements.copyButton,
            elements.previewButton,
            elements.packageButton,
            elements.promptButton,
            elements.contractButton,
            elements.historyButton,
            elements
                .selectedHistoryButton
        ]
            .filter(Boolean)
            .forEach(
                element => {
                    setDisabled(
                        element,
                        busy
                    );
                }
            );

        setDisabled(
            elements.clearButton,
            busy ||
            !state.preview
        );
    }

    function renderControlsMetadata() {
        const controls =
            readControlOptions();

        if (elements.root) {
            elements.root
                .dataset
                .exportType =
                    controls.type;

            elements.root
                .dataset
                .exportFormat =
                    controls.format;
        }
    }

    /* ========================================================
       ESTADO
       ======================================================== */

    function transition(
        status,
        changes = {}
    ) {
        state = {
            ...state,

            ...changes,

            status
        };

        renderStatus();
        renderButtons();

        emitStateChanged();
    }

    function getState() {
        return deepFreeze(
            clone({
                status:
                    state.status,

                exportType:
                    state.exportType,

                format:
                    state.format,

                fileName:
                    state.fileName,

                size:
                    state.size,

                preview:
                    state.preview,

                result:
                    state.result,

                completedAt:
                    state.completedAt,

                controls:
                    state.controls,

                error:
                    state.error
            })
        );
    }

    function getPreview() {
        return state.preview ||
            "";
    }

    function getResult() {
        return state.result
            ? deepFreeze(
                clone(
                    state.result
                )
            )
            : null;
    }

    function emitStateChanged() {
        emit(
            EVENTS.STATE_CHANGED,
            {
                state:
                    getState()
            }
        );
    }

    /* ========================================================
       OPCIONES
       ======================================================== */

    function hydrateControls() {
        setControlValue(
            elements.type,
            options.type
        );

        setControlValue(
            elements.format,
            options.format
        );

        setControlValue(
            elements.includeMetadata,
            options.includeMetadata
        );

        setControlValue(
            elements
                .includeNegativePrompt,
            options
                .includeNegativePrompt
        );

        setControlValue(
            elements.includeParameters,
            options.includeParameters
        );

        setControlValue(
            elements.includeCommand,
            options.includeCommand
        );

        setControlValue(
            elements.includeContract,
            options.includeContract
        );

        setControlValue(
            elements.includeHistory,
            options.includeHistory
        );

        setControlValue(
            elements.download,
            options.download
        );

        setControlValue(
            elements.copy,
            options.copy
        );

        setControlValue(
            elements.prettyPrint,
            options.prettyPrint
        );

        state.controls =
            readControlOptions();
    }

    function readControlOptions() {
        return {
            type:
                readControlValue(
                    elements.type,
                    options.type
                ),

            format:
                normalizeFormat(
                    readControlValue(
                        elements.format,
                        options.format
                    )
                ),

            fileName:
                readControlValue(
                    elements.fileName,
                    ""
                ) ||
                null,

            includeMetadata:
                readBooleanControl(
                    elements.includeMetadata,
                    options.includeMetadata
                ),

            includeNegativePrompt:
                readBooleanControl(
                    elements
                        .includeNegativePrompt,
                    options
                        .includeNegativePrompt
                ),

            includeParameters:
                readBooleanControl(
                    elements.includeParameters,
                    options.includeParameters
                ),

            includeCommand:
                readBooleanControl(
                    elements.includeCommand,
                    options.includeCommand
                ),

            includeContract:
                readBooleanControl(
                    elements.includeContract,
                    options.includeContract
                ),

            includeHistory:
                readBooleanControl(
                    elements.includeHistory,
                    options.includeHistory
                ),

            download:
                readBooleanControl(
                    elements.download,
                    options.download
                ),

            copy:
                readBooleanControl(
                    elements.copy,
                    options.copy
                ),

            prettyPrint:
                readBooleanControl(
                    elements.prettyPrint,
                    options.prettyPrint
                )
        };
    }

    function resolveExportOptions(
        overrides
    ) {
        return {
            ...readControlOptions(),

            ...normalizeObject(
                overrides
            ),

            format:
                normalizeFormat(
                    overrides.format ||
                    readControlOptions()
                        .format
                )
        };
    }

    /* ========================================================
       DEPENDENCIAS
       ======================================================== */

    function validateDependencies() {
        if (
            !window
                .PromptExportService
        ) {
            throw createBindingError(
                "EXPORT_SERVICE_UNAVAILABLE",
                "PromptExportService no está disponible."
            );
        }
    }

    /* ========================================================
       DOM
       ======================================================== */

    function resolveRoot(root) {
        if (
            root instanceof
            Element
        ) {
            return root;
        }

        if (
            typeof root ===
                "string"
        ) {
            return (
                document
                    .querySelector(
                        root
                    ) ||
                document
            );
        }

        return (
            document
                .querySelector(
                    DEFAULT_SELECTORS
                        .root
                ) ||
            document
        );
    }

    function collectElements(
        root,
        selectors
    ) {
        const result =
            {};

        Object.entries(
            selectors
        )
            .forEach(
                ([key, selector]) => {
                    if (
                        key ===
                        "root"
                    ) {
                        result.root =
                            root;

                        return;
                    }

                    result[key] =
                        root.querySelector(
                            selector
                        );
                }
            );

        return result;
    }

    function setOutputValue(
        element,
        value
    ) {
        if (!element) {
            return;
        }

        if (
            "value" in element
        ) {
            element.value =
                value;
        } else {
            element.textContent =
                value;
        }
    }

    function setText(
        element,
        value
    ) {
        if (!element) {
            return;
        }

        element.textContent =
            value ?? "";
    }

    function setHidden(
        element,
        hidden
    ) {
        if (!element) {
            return;
        }

        element.hidden =
            Boolean(hidden);
    }

    function setDisabled(
        element,
        disabled
    ) {
        if (!element) {
            return;
        }

        element.disabled =
            Boolean(disabled);

        element.setAttribute(
            "aria-disabled",
            disabled
                ? "true"
                : "false"
        );
    }

    function setControlValue(
        element,
        value
    ) {
        if (!element) {
            return;
        }

        if (
            element.type ===
            "checkbox"
        ) {
            element.checked =
                Boolean(value);

            return;
        }

        element.value =
            value ?? "";
    }

    function readControlValue(
        element,
        fallback
    ) {
        if (!element) {
            return fallback;
        }

        return normalizeText(
            element.value
        ) || fallback;
    }

    function readBooleanControl(
        element,
        fallback
    ) {
        if (!element) {
            return fallback;
        }

        if (
            element.type ===
            "checkbox"
        ) {
            return element.checked;
        }

        const value =
            normalizeText(
                element.value
            ).toLowerCase();

        if (
            [
                "true",
                "1",
                "yes",
                "si",
                "sí",
                "on"
            ].includes(value)
        ) {
            return true;
        }

        if (
            [
                "false",
                "0",
                "no",
                "off"
            ].includes(value)
        ) {
            return false;
        }

        return fallback;
    }

    /* ========================================================
       UTILIDADES
       ======================================================== */

    function createInitialState() {
        return {
            status:
                STATUS.IDLE,

            source:
                null,

            exportType:
                null,

            format:
                null,

            result:
                null,

            preview:
                "",

            fileName:
                "",

            size:
                0,

            completedAt:
                null,

            controls:
                null,

            error:
                null,

            operationId:
                0
        };
    }

    function normalizeOptions(
        config
    ) {
        const source =
            normalizeObject(
                config
            );

        return {
            ...DEFAULT_OPTIONS,

            ...source,

            selectors: {
                ...DEFAULT_SELECTORS,

                ...normalizeObject(
                    source.selectors
                )
            },

            root:
                source.root ||
                DEFAULT_SELECTORS
                    .root
        };
    }

    function normalizeFormat(
        format
    ) {
        const value =
            normalizeText(
                format
            ).toLowerCase();

        const aliases = {
            text:
                FORMATS.TXT,

            plain:
                FORMATS.TXT,

            txt:
                FORMATS.TXT,

            markdown:
                FORMATS.MARKDOWN,

            md:
                FORMATS.MARKDOWN,

            json:
                FORMATS.JSON,

            portraitos:
                FORMATS.PORTRAITOS,

            package:
                FORMATS.PORTRAITOS
        };

        return aliases[value] ||
            FORMATS.TXT;
    }

    function normalizePromptSource(
        source
    ) {
        if (
            typeof source ===
            "string"
        ) {
            return {
                prompt:
                    source
            };
        }

        return source;
    }

    function normalizeHistorySource(
        source
    ) {
        if (
            Array.isArray(source)
        ) {
            return source;
        }

        if (
            Array.isArray(
                source?.items
            )
        ) {
            return source.items;
        }

        if (
            Array.isArray(
                source?.history
            )
        ) {
            return source.history;
        }

        return [];
    }

    function resolveResultContent(
        result
    ) {
        if (
            typeof result ===
            "string"
        ) {
            return result;
        }

        return (
            result?.content ||
            result?.text ||
            result?.data ||
            ""
        );
    }

    function resolveResultFileName(
        result
    ) {
        return (
            result?.fileName ||
            result?.filename ||
            ""
        );
    }

    function resolvePackageFileName(
        exportOptions
    ) {
        if (
            exportOptions.fileName
        ) {
            return ensureExtension(
                exportOptions.fileName,
                FORMATS.PORTRAITOS
            );
        }

        const timestamp =
            new Date()
                .toISOString()
                .replace(
                    /[:.]/g,
                    "-"
                );

        return `portraitos-package-${timestamp}.portraitos`;
    }

    function ensureExtension(
        fileName,
        extension
    ) {
        const normalized =
            normalizeText(
                fileName
            );

        if (
            normalized
                .toLowerCase()
                .endsWith(
                    `.${extension}`
                )
        ) {
            return normalized;
        }

        return `${normalized}.${extension}`;
    }

    function calculateContentSize(
        content
    ) {
        if (!content) {
            return 0;
        }

        if (
            typeof Blob !==
            "undefined"
        ) {
            return new Blob(
                [content]
            ).size;
        }

        return content.length;
    }

    function formatBytes(
        bytes
    ) {
        const value =
            Number(bytes) ||
            0;

        if (value === 0) {
            return "0 B";
        }

        const units = [
            "B",
            "KB",
            "MB",
            "GB"
        ];

        const index =
            Math.min(
                Math.floor(
                    Math.log(value) /
                    Math.log(1024)
                ),
                units.length - 1
            );

        const amount =
            value /
            Math.pow(
                1024,
                index
            );

        return `${amount.toLocaleString(
            "es-ES",
            {
                maximumFractionDigits:
                    index === 0
                        ? 0
                        : 2
            }
        )} ${units[index]}`;
    }

    function buildSuccessMessage(
        type,
        format
    ) {
        const labels = {
            prompt:
                "Prompt",

            "compiled-prompt":
                "Prompt compilado",

            "optimized-prompt":
                "Prompt optimizado",

            contract:
                "Portrait Contract",

            "history-entry":
                "Versión del historial",

            history:
                "Historial",

            package:
                "Paquete PortraitOS"
        };

        return `${labels[type] || "Contenido"} exportado como ${format.toUpperCase()}.`;
    }

    function getStatusMessage(
        status
    ) {
        const messages = {
            idle:
                "Preparado para exportar.",

            preparing:
                "Preparando el contenido…",

            exporting:
                "Generando la exportación…",

            copying:
                "Copiando el contenido…",

            ready:
                "Exportación preparada.",

            error:
                "No se pudo completar la exportación."
        };

        return messages[status] ||
            "";
    }

    function isBusyStatus(
        status
    ) {
        return [
            STATUS.PREPARING,
            STATUS.EXPORTING,
            STATUS.COPYING
        ].includes(status);
    }

    function assertOperationCurrent(
        operationId
    ) {
        if (
            operationId !==
            operationSequence
        ) {
            throw createBindingError(
                "OPERATION_SUPERSEDED",
                "La operación fue sustituida por una exportación posterior."
            );
        }
    }

    function createBindingError(
        code,
        message,
        details = null
    ) {
        const error =
            new Error(message);

        error.name =
            "ExportBindingError";

        error.code =
            code;

        error.details =
            details;

        return error;
    }

    function normalizeError(
        error
    ) {
        return {
            name:
                error?.name ||
                "Error",

            code:
                error?.code ||
                "EXPORT_BINDING_ERROR",

            message:
                error?.message ||
                "Se ha producido un error inesperado.",

            details:
                clone(
                    error?.details ||
                    null
                )
        };
    }

    function handleUnhandledError(
        error
    ) {
        if (
            error?.code ===
            "OPERATION_SUPERSEDED"
        ) {
            return;
        }

        console.error(
            "[PortraitOS] ExportBinding:",
            error
        );
    }

    function showNotification(
        message,
        type
    ) {
        if (!options.notify) {
            return;
        }

        if (
            window.UI &&
            typeof window.UI
                .notify ===
                "function"
        ) {
            window.UI.notify(
                message,
                type
            );

            return;
        }

        if (
            window.UI &&
            typeof window.UI
                .toast ===
                "function"
        ) {
            window.UI.toast({
                message,
                type
            });

            return;
        }

        emit(
            "portraitos:notification",
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
        window.dispatchEvent(
            new CustomEvent(
                eventName,
                {
                    detail
                }
            )
        );
    }

    function on(
        eventName,
        handler
    ) {
        window.addEventListener(
            eventName,
            handler
        );

        return () => {
            window.removeEventListener(
                eventName,
                handler
            );
        };
    }

    function normalizeObject(
        value
    ) {
        return (
            value &&
            typeof value ===
                "object" &&
            !Array.isArray(value)
        )
            ? value
            : {};
    }

    function normalizeText(
        value
    ) {
        return String(
            value ?? ""
        ).trim();
    }

    function clone(
        value
    ) {
        if (
            value ===
            undefined
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
            JSON.stringify(
                value
            )
        );
    }

    function deepFreeze(
        value
    ) {
        if (
            !value ||
            typeof value !==
                "object" ||
            Object.isFrozen(value)
        ) {
            return value;
        }

        Object.freeze(value);

        Object.values(value)
            .forEach(
                deepFreeze
            );

        return value;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        VERSION,

        EVENTS,
        STATUS,
        EXPORT_TYPES,
        FORMATS,

        init,
        destroy,

        exportCurrent,
        exportPrompt,
        exportContract,
        exportHistory,
        exportSelectedHistory,
        exportPackage,

        preview,
        clearPreview,
        copyCurrent,

        getState,
        getPreview,
        getResult,

        on
    });

})();

window.ExportBinding =
    ExportBinding;
