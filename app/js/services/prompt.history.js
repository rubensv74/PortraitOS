"use strict";

/* ============================================================
   PortraitOS
   Prompt History Service
   ------------------------------------------------------------
   Responsabilidad:
   - Persistir prompts generados y optimizados.
   - Mantener versiones por perfil y Portrait Contract.
   - Recuperar, buscar, filtrar y ordenar generaciones.
   - Gestionar favoritos, etiquetas y notas.
   - Comparar versiones.
   - Restaurar prompts anteriores.
   - Mantener estadísticas básicas de uso.
   - Evitar duplicados consecutivos.
   ============================================================ */

const PromptHistoryService = (() => {

    /* ========================================================
       CONFIGURACIÓN
       ======================================================== */

    const VERSION =
        "1.0.0";

    const STORAGE_KEY =
        "portraitos.prompt-history";

    const STORAGE_SCHEMA =
        "portraitos.prompt-history";

    const STORAGE_SCHEMA_VERSION =
        "1.0";

    const MAX_ENTRIES =
        250;

    const MAX_ENTRIES_PER_PROFILE =
        100;

    const DEFAULT_QUERY = Object.freeze({
        profileId:
            null,

        contractId:
            null,

        provider:
            null,

        level:
            null,

        mode:
            null,

        favorite:
            null,

        tags:
            [],

        search:
            "",

        from:
            null,

        to:
            null,

        sortBy:
            "createdAt",

        sortDirection:
            "desc",

        offset:
            0,

        limit:
            50
    });

    const SORT_FIELDS = Object.freeze([
        "createdAt",
        "updatedAt",
        "version",
        "provider",
        "level",
        "profileName",
        "characterCount"
    ]);

    const EVENTS = Object.freeze({
        CHANGED:
            "portraitos:prompt-history:changed",

        ADDED:
            "portraitos:prompt-history:added",

        UPDATED:
            "portraitos:prompt-history:updated",

        DELETED:
            "portraitos:prompt-history:deleted",

        CLEARED:
            "portraitos:prompt-history:cleared",

        RESTORED:
            "portraitos:prompt-history:restored"
    });

    /* ========================================================
       ESTADO
       ======================================================== */

    let initialized =
        false;

    let state =
        createEmptyState();

    /* ========================================================
       INICIALIZACIÓN
       ======================================================== */

    function init() {
        if (initialized) {
            return getSnapshot();
        }

        state =
            loadState();

        state =
            migrateState(state);

        state =
            normalizeState(state);

        enforceLimits();

        persist();

        initialized =
            true;

        return getSnapshot();
    }

    function ensureInitialized() {
        if (!initialized) {
            init();
        }
    }

    /* ========================================================
       ALTA DE GENERACIONES
       ======================================================== */

    function add(input, options = {}) {
        ensureInitialized();

        const normalized =
            normalizeEntryInput(
                input,
                options
            );

        const validation =
            validateEntryInput(
                normalized
            );

        if (!validation.valid) {
            throw createHistoryError(
                "INVALID_HISTORY_ENTRY",
                "No se puede guardar la generación en el historial.",
                validation
            );
        }

        if (
            options.skipDuplicate !==
                false
        ) {
            const duplicate =
                findLatestDuplicate(
                    normalized
                );

            if (duplicate) {
                return deepFreeze(
                    clone(duplicate)
                );
            }
        }

        const version =
            resolveNextVersion(
                normalized.profileId,
                normalized.contractId
            );

        const now =
            new Date()
                .toISOString();

        const entry = {
            id:
                createId(),

            schema:
                "portraitos.prompt-history-entry",

            schemaVersion:
                "1.0",

            version,

            profileId:
                normalized.profileId,

            profileName:
                normalized.profileName,

            contractId:
                normalized.contractId,

            contractFingerprint:
                normalized.contractFingerprint,

            provider:
                normalized.provider,

            level:
                normalized.level,

            mode:
                normalized.mode,

            prompt:
                normalized.prompt,

            negativePrompt:
                normalized.negativePrompt,

            parameters:
                normalized.parameters,

            command:
                normalized.command,

            source: {
                compilerVersion:
                    normalized
                        .compilerVersion,

                optimizerVersion:
                    normalized
                        .optimizerVersion,

                builderVersion:
                    normalized
                        .builderVersion
            },

            metrics:
                normalizeMetrics(
                    normalized.metrics,
                    normalized.prompt,
                    normalized
                        .negativePrompt
                ),

            favorite:
                normalized.favorite,

            tags:
                normalized.tags,

            title:
                normalized.title ||
                buildDefaultTitle(
                    normalized,
                    version
                ),

            notes:
                normalized.notes,

            metadata:
                normalized.metadata,

            createdAt:
                now,

            updatedAt:
                now
        };

        state.entries.unshift(
            entry
        );

        state.updatedAt =
            now;

        enforceLimits();

        persist();

        emit(
            EVENTS.ADDED,
            {
                entry:
                    clone(entry)
            }
        );

        emitChanged();

        return deepFreeze(
            clone(entry)
        );
    }

    function addCompiled(
        compiled,
        context = {}
    ) {
        return add(
            {
                ...compiled,

                profileId:
                    context.profileId,

                profileName:
                    context.profileName,

                builderVersion:
                    context.builderVersion,

                title:
                    context.title,

                tags:
                    context.tags,

                notes:
                    context.notes,

                metadata:
                    context.metadata
            }
        );
    }

    function addOptimized(
        optimized,
        context = {}
    ) {
        return add(
            {
                ...optimized,

                compilerVersion:
                    optimized
                        .sourceCompilerVersion,

                profileId:
                    context.profileId,

                profileName:
                    context.profileName,

                builderVersion:
                    context.builderVersion,

                title:
                    context.title,

                tags:
                    context.tags,

                notes:
                    context.notes,

                metadata:
                    {
                        ...normalizeObject(
                            context.metadata
                        ),

                        changes:
                            clone(
                                optimized.changes ||
                                []
                            )
                    }
            }
        );
    }

    /* ========================================================
       CONSULTAS
       ======================================================== */

    function getById(id) {
        ensureInitialized();

        const entry =
            state.entries.find(
                item =>
                    item.id ===
                    normalizeText(id)
            );

        return entry
            ? deepFreeze(
                clone(entry)
            )
            : null;
    }

    function getLatest(
        profileId = null,
        contractId = null
    ) {
        ensureInitialized();

        const normalizedProfileId =
            normalizeNullableText(
                profileId
            );

        const normalizedContractId =
            normalizeNullableText(
                contractId
            );

        const entry =
            state.entries.find(
                item =>
                    (
                        !normalizedProfileId ||
                        item.profileId ===
                            normalizedProfileId
                    ) &&
                    (
                        !normalizedContractId ||
                        item.contractId ===
                            normalizedContractId
                    )
            );

        return entry
            ? deepFreeze(
                clone(entry)
            )
            : null;
    }

    function list(query = {}) {
        ensureInitialized();

        const normalizedQuery =
            normalizeQuery(query);

        let results =
            state.entries.filter(
                entry =>
                    matchesQuery(
                        entry,
                        normalizedQuery
                    )
            );

        results =
            sortEntries(
                results,
                normalizedQuery
            );

        const total =
            results.length;

        results =
            results.slice(
                normalizedQuery.offset,
                normalizedQuery.offset +
                    normalizedQuery.limit
            );

        return deepFreeze({
            items:
                clone(results),

            total,

            offset:
                normalizedQuery.offset,

            limit:
                normalizedQuery.limit,

            hasMore:
                normalizedQuery.offset +
                    results.length <
                total
        });
    }

    function search(text, options = {}) {
        return list({
            ...options,

            search:
                text
        });
    }

    function getByProfile(
        profileId,
        options = {}
    ) {
        return list({
            ...options,

            profileId
        });
    }

    function getByContract(
        contractId,
        options = {}
    ) {
        return list({
            ...options,

            contractId
        });
    }

    function getFavorites(
        options = {}
    ) {
        return list({
            ...options,

            favorite:
                true
        });
    }

    function getTags() {
        ensureInitialized();

        const counts =
            new Map();

        state.entries
            .flatMap(
                entry =>
                    entry.tags
            )
            .forEach(
                tag => {
                    counts.set(
                        tag,
                        (
                            counts.get(
                                tag
                            ) ||
                            0
                        ) + 1
                    );
                }
            );

        return deepFreeze(
            [...counts.entries()]
                .map(
                    ([name, count]) => ({
                        name,
                        count
                    })
                )
                .sort(
                    (a, b) =>
                        a.name.localeCompare(
                            b.name,
                            "es",
                            {
                                sensitivity:
                                    "base"
                            }
                        )
                )
        );
    }

    /* ========================================================
       ACTUALIZACIÓN
       ======================================================== */

    function update(id, changes = {}) {
        ensureInitialized();

        const index =
            findIndexById(id);

        if (index < 0) {
            throw createHistoryError(
                "ENTRY_NOT_FOUND",
                "No se ha encontrado la generación solicitada."
            );
        }

        const current =
            state.entries[index];

        const updated = {
            ...current,

            title:
                changes.title !==
                    undefined
                    ? normalizeNullableText(
                        changes.title
                    )
                    : current.title,

            notes:
                changes.notes !==
                    undefined
                    ? normalizeText(
                        changes.notes
                    )
                    : current.notes,

            favorite:
                changes.favorite !==
                    undefined
                    ? Boolean(
                        changes.favorite
                    )
                    : current.favorite,

            tags:
                changes.tags !==
                    undefined
                    ? normalizeTags(
                        changes.tags
                    )
                    : current.tags,

            metadata:
                changes.metadata !==
                    undefined
                    ? {
                        ...current.metadata,

                        ...normalizeObject(
                            changes.metadata
                        )
                    }
                    : current.metadata,

            updatedAt:
                new Date()
                    .toISOString()
        };

        state.entries[index] =
            updated;

        state.updatedAt =
            updated.updatedAt;

        persist();

        emit(
            EVENTS.UPDATED,
            {
                entry:
                    clone(updated)
            }
        );

        emitChanged();

        return deepFreeze(
            clone(updated)
        );
    }

    function toggleFavorite(id) {
        const entry =
            getRequiredEntry(id);

        return update(
            id,
            {
                favorite:
                    !entry.favorite
            }
        );
    }

    function setFavorite(
        id,
        favorite
    ) {
        return update(
            id,
            {
                favorite:
                    Boolean(favorite)
            }
        );
    }

    function setTags(id, tags) {
        return update(
            id,
            {
                tags
            }
        );
    }

    function addTag(id, tag) {
        const entry =
            getRequiredEntry(id);

        return update(
            id,
            {
                tags:
                    [
                        ...entry.tags,
                        tag
                    ]
            }
        );
    }

    function removeTag(id, tag) {
        const entry =
            getRequiredEntry(id);

        const target =
            normalizeComparableText(
                tag
            );

        return update(
            id,
            {
                tags:
                    entry.tags.filter(
                        item =>
                            normalizeComparableText(
                                item
                            ) !==
                            target
                    )
            }
        );
    }

    function setNotes(id, notes) {
        return update(
            id,
            {
                notes
            }
        );
    }

    function rename(id, title) {
        return update(
            id,
            {
                title
            }
        );
    }

    /* ========================================================
       ELIMINACIÓN
       ======================================================== */

    function remove(id) {
        ensureInitialized();

        const index =
            findIndexById(id);

        if (index < 0) {
            return false;
        }

        const [removed] =
            state.entries.splice(
                index,
                1
            );

        state.updatedAt =
            new Date()
                .toISOString();

        persist();

        emit(
            EVENTS.DELETED,
            {
                entry:
                    clone(removed)
            }
        );

        emitChanged();

        return true;
    }

    function removeMany(ids) {
        ensureInitialized();

        const targets =
            new Set(
                normalizeArray(ids)
                    .map(normalizeText)
                    .filter(Boolean)
            );

        if (!targets.size) {
            return 0;
        }

        const removed =
            state.entries.filter(
                entry =>
                    targets.has(
                        entry.id
                    )
            );

        state.entries =
            state.entries.filter(
                entry =>
                    !targets.has(
                        entry.id
                    )
            );

        if (!removed.length) {
            return 0;
        }

        state.updatedAt =
            new Date()
                .toISOString();

        persist();

        removed.forEach(
            entry => {
                emit(
                    EVENTS.DELETED,
                    {
                        entry:
                            clone(entry)
                    }
                );
            }
        );

        emitChanged();

        return removed.length;
    }

    function clear(options = {}) {
        ensureInitialized();

        const profileId =
            normalizeNullableText(
                options.profileId
            );

        const contractId =
            normalizeNullableText(
                options.contractId
            );

        const preserveFavorites =
            options
                .preserveFavorites ===
            true;

        const before =
            state.entries.length;

        state.entries =
            state.entries.filter(
                entry => {
                    const scopeMatches =
                        (
                            !profileId ||
                            entry.profileId ===
                                profileId
                        ) &&
                        (
                            !contractId ||
                            entry.contractId ===
                                contractId
                        );

                    if (!scopeMatches) {
                        return true;
                    }

                    if (
                        preserveFavorites &&
                        entry.favorite
                    ) {
                        return true;
                    }

                    return false;
                }
            );

        const removedCount =
            before -
            state.entries.length;

        if (!removedCount) {
            return 0;
        }

        state.updatedAt =
            new Date()
                .toISOString();

        persist();

        emit(
            EVENTS.CLEARED,
            {
                removedCount,

                profileId,

                contractId,

                preserveFavorites
            }
        );

        emitChanged();

        return removedCount;
    }

    /* ========================================================
       RESTAURACIÓN
       ======================================================== */

    function restore(id) {
        const entry =
            getRequiredEntry(id);

        const restored = {
            prompt:
                entry.prompt,

            negativePrompt:
                entry.negativePrompt,

            parameters:
                clone(
                    entry.parameters
                ),

            command:
                entry.command,

            provider:
                entry.provider,

            level:
                entry.level,

            mode:
                entry.mode,

            contractId:
                entry.contractId,

            contractFingerprint:
                entry
                    .contractFingerprint,

            historyEntryId:
                entry.id,

            historyVersion:
                entry.version
        };

        emit(
            EVENTS.RESTORED,
            {
                entry:
                    clone(entry),

                restored:
                    clone(restored)
            }
        );

        return deepFreeze(
            restored
        );
    }

    /* ========================================================
       COMPARACIÓN DE VERSIONES
       ======================================================== */

    function compare(
        firstId,
        secondId
    ) {
        const first =
            getRequiredEntry(
                firstId
            );

        const second =
            getRequiredEntry(
                secondId
            );

        return deepFreeze({
            first:
                summarizeEntry(
                    first
                ),

            second:
                summarizeEntry(
                    second
                ),

            prompt:
                compareTexts(
                    first.prompt,
                    second.prompt
                ),

            negativePrompt:
                compareTexts(
                    first.negativePrompt,
                    second.negativePrompt
                ),

            parameters:
                compareObjects(
                    first.parameters,
                    second.parameters
                ),

            metadata: {
                providerChanged:
                    first.provider !==
                    second.provider,

                levelChanged:
                    first.level !==
                    second.level,

                modeChanged:
                    first.mode !==
                    second.mode,

                contractChanged:
                    first.contractId !==
                    second.contractId,

                characterDifference:
                    second.metrics
                        .characterCount -
                    first.metrics
                        .characterCount,

                wordDifference:
                    second.metrics
                        .wordCount -
                    first.metrics
                        .wordCount
            }
        });
    }

    function compareTexts(
        firstText,
        secondText
    ) {
        const firstLines =
            splitComparisonUnits(
                firstText
            );

        const secondLines =
            splitComparisonUnits(
                secondText
            );

        const matrix =
            buildLcsMatrix(
                firstLines,
                secondLines
            );

        const changes =
            backtrackDiff(
                firstLines,
                secondLines,
                matrix
            );

        const added =
            changes.filter(
                item =>
                    item.type ===
                    "added"
            );

        const removed =
            changes.filter(
                item =>
                    item.type ===
                    "removed"
            );

        const unchanged =
            changes.filter(
                item =>
                    item.type ===
                    "unchanged"
            );

        return {
            changed:
                added.length > 0 ||
                removed.length > 0,

            added,

            removed,

            unchanged,

            changes,

            firstCharacterCount:
                normalizeText(
                    firstText
                ).length,

            secondCharacterCount:
                normalizeText(
                    secondText
                ).length
        };
    }

    function compareObjects(
        first,
        second
    ) {
        const left =
            flattenObject(
                normalizeObject(
                    first
                )
            );

        const right =
            flattenObject(
                normalizeObject(
                    second
                )
            );

        const keys =
            [
                ...new Set([
                    ...Object.keys(left),
                    ...Object.keys(right)
                ])
            ].sort();

        const changes =
            keys
                .map(
                    key => {
                        const before =
                            left[key];

                        const after =
                            right[key];

                        if (
                            valuesEqual(
                                before,
                                after
                            )
                        ) {
                            return {
                                key,

                                type:
                                    "unchanged",

                                before:
                                    clone(before),

                                after:
                                    clone(after)
                            };
                        }

                        if (
                            before ===
                            undefined
                        ) {
                            return {
                                key,

                                type:
                                    "added",

                                before:
                                    undefined,

                                after:
                                    clone(after)
                            };
                        }

                        if (
                            after ===
                            undefined
                        ) {
                            return {
                                key,

                                type:
                                    "removed",

                                before:
                                    clone(before),

                                after:
                                    undefined
                            };
                        }

                        return {
                            key,

                            type:
                                "changed",

                            before:
                                clone(before),

                            after:
                                clone(after)
                        };
                    }
                );

        return {
            changed:
                changes.some(
                    item =>
                        item.type !==
                        "unchanged"
                ),

            changes
        };
    }

    /* ========================================================
       ESTADÍSTICAS
       ======================================================== */

    function getStatistics(
        options = {}
    ) {
        ensureInitialized();

        const entries =
            list({
                ...options,

                offset:
                    0,

                limit:
                    Number.MAX_SAFE_INTEGER
            }).items;

        const byProvider =
            countBy(
                entries,
                entry =>
                    entry.provider ||
                    "unknown"
            );

        const byLevel =
            countBy(
                entries,
                entry =>
                    entry.level ||
                    "unknown"
            );

        const byProfile =
            countBy(
                entries,
                entry =>
                    entry.profileName ||
                    entry.profileId ||
                    "Sin perfil"
            );

        const totalCharacters =
            entries.reduce(
                (sum, entry) =>
                    sum +
                    entry.metrics
                        .characterCount,
                0
            );

        const totalWords =
            entries.reduce(
                (sum, entry) =>
                    sum +
                    entry.metrics
                        .wordCount,
                0
            );

        return deepFreeze({
            total:
                entries.length,

            favorites:
                entries.filter(
                    entry =>
                        entry.favorite
                ).length,

            profiles:
                new Set(
                    entries
                        .map(
                            entry =>
                                entry.profileId
                        )
                        .filter(Boolean)
                ).size,

            contracts:
                new Set(
                    entries
                        .map(
                            entry =>
                                entry.contractId
                        )
                        .filter(Boolean)
                ).size,

            totalCharacters,

            totalWords,

            averageCharacters:
                entries.length
                    ? Math.round(
                        totalCharacters /
                        entries.length
                    )
                    : 0,

            averageWords:
                entries.length
                    ? Math.round(
                        totalWords /
                        entries.length
                    )
                    : 0,

            byProvider,

            byLevel,

            byProfile,

            oldestEntryAt:
                entries.length
                    ? entries[
                        entries.length -
                        1
                    ].createdAt
                    : null,

            newestEntryAt:
                entries.length
                    ? entries[0]
                        .createdAt
                    : null
        });
    }

    /* ========================================================
       IMPORTACIÓN Y EXPORTACIÓN
       ======================================================== */

    function exportHistory(
        options = {}
    ) {
        ensureInitialized();

        const queryResult =
            list({
                ...options,

                offset:
                    0,

                limit:
                    Number.MAX_SAFE_INTEGER
            });

        return deepFreeze({
            schema:
                STORAGE_SCHEMA,

            schemaVersion:
                STORAGE_SCHEMA_VERSION,

            serviceVersion:
                VERSION,

            exportedAt:
                new Date()
                    .toISOString(),

            count:
                queryResult.total,

            entries:
                clone(
                    queryResult.items
                )
        });
    }

    function importHistory(
        payload,
        options = {}
    ) {
        ensureInitialized();

        const source =
            normalizeImportPayload(
                payload
            );

        const strategy =
            normalizeText(
                options.strategy
            ).toLowerCase() ||
            "merge";

        if (
            ![
                "merge",
                "replace",
                "append"
            ].includes(strategy)
        ) {
            throw createHistoryError(
                "INVALID_IMPORT_STRATEGY",
                "La estrategia de importación no es válida."
            );
        }

        const importedEntries =
            source.entries
                .map(
                    normalizeStoredEntry
                )
                .filter(Boolean);

        if (
            strategy ===
            "replace"
        ) {
            state.entries =
                [];
        }

        let imported =
            0;

        let skipped =
            0;

        importedEntries.forEach(
            entry => {
                const existingIndex =
                    state.entries
                        .findIndex(
                            current =>
                                current.id ===
                                entry.id
                        );

                if (
                    strategy ===
                        "append" &&
                    existingIndex >= 0
                ) {
                    entry.id =
                        createId();
                }

                if (
                    strategy ===
                        "merge" &&
                    existingIndex >= 0
                ) {
                    const current =
                        state.entries[
                            existingIndex
                        ];

                    if (
                        new Date(
                            entry.updatedAt
                        ).getTime() <=
                        new Date(
                            current.updatedAt
                        ).getTime()
                    ) {
                        skipped += 1;
                        return;
                    }

                    state.entries[
                        existingIndex
                    ] = entry;

                    imported += 1;
                    return;
                }

                state.entries.push(
                    entry
                );

                imported += 1;
            }
        );

        state.entries =
            sortEntries(
                state.entries,
                {
                    sortBy:
                        "createdAt",

                    sortDirection:
                        "desc"
                }
            );

        state.updatedAt =
            new Date()
                .toISOString();

        enforceLimits();

        persist();

        emitChanged();

        return {
            imported,
            skipped,
            total:
                state.entries.length
        };
    }

    /* ========================================================
       PERSISTENCIA
       ======================================================== */

    function loadState() {
        const stored =
            readStorage();

        if (!stored) {
            return createEmptyState();
        }

        try {
            const parsed =
                typeof stored ===
                    "string"
                    ? JSON.parse(
                        stored
                    )
                    : stored;

            return parsed &&
                typeof parsed ===
                    "object"
                ? parsed
                : createEmptyState();
        } catch (error) {
            console.warn(
                "[PortraitOS] No se pudo cargar el historial de prompts.",
                error
            );

            return createEmptyState();
        }
    }

    function persist() {
        state.entryCount =
            state.entries.length;

        state.updatedAt =
            state.updatedAt ||
            new Date()
                .toISOString();

        writeStorage(
            clone(state)
        );
    }

    function readStorage() {
        try {
            if (
                window.PortraitStorage &&
                typeof window
                    .PortraitStorage
                    .get ===
                    "function"
            ) {
                return window
                    .PortraitStorage
                    .get(
                        STORAGE_KEY
                    );
            }

            if (
                window.StorageService &&
                typeof window
                    .StorageService
                    .get ===
                    "function"
            ) {
                return window
                    .StorageService
                    .get(
                        STORAGE_KEY
                    );
            }

            return window
                .localStorage
                .getItem(
                    STORAGE_KEY
                );
        } catch (error) {
            console.warn(
                "[PortraitOS] Error leyendo Prompt History.",
                error
            );

            return null;
        }
    }

    function writeStorage(value) {
        try {
            if (
                window.PortraitStorage &&
                typeof window
                    .PortraitStorage
                    .set ===
                    "function"
            ) {
                window
                    .PortraitStorage
                    .set(
                        STORAGE_KEY,
                        value
                    );

                return;
            }

            if (
                window.StorageService &&
                typeof window
                    .StorageService
                    .set ===
                    "function"
            ) {
                window
                    .StorageService
                    .set(
                        STORAGE_KEY,
                        value
                    );

                return;
            }

            window
                .localStorage
                .setItem(
                    STORAGE_KEY,
                    JSON.stringify(
                        value
                    )
                );
        } catch (error) {
            throw createHistoryError(
                "HISTORY_PERSISTENCE_FAILED",
                "No se pudo guardar el historial de prompts.",
                {
                    cause:
                        error
                }
            );
        }
    }

    /* ========================================================
       NORMALIZACIÓN DE ESTADO
       ======================================================== */

    function createEmptyState() {
        const now =
            new Date()
                .toISOString();

        return {
            schema:
                STORAGE_SCHEMA,

            schemaVersion:
                STORAGE_SCHEMA_VERSION,

            serviceVersion:
                VERSION,

            createdAt:
                now,

            updatedAt:
                now,

            entryCount:
                0,

            entries:
                []
        };
    }

    function normalizeState(value) {
        const source =
            normalizeObject(value);

        return {
            schema:
                STORAGE_SCHEMA,

            schemaVersion:
                STORAGE_SCHEMA_VERSION,

            serviceVersion:
                VERSION,

            createdAt:
                normalizeDate(
                    source.createdAt
                ) ||
                new Date()
                    .toISOString(),

            updatedAt:
                normalizeDate(
                    source.updatedAt
                ) ||
                new Date()
                    .toISOString(),

            entryCount:
                0,

            entries:
                normalizeArray(
                    source.entries
                )
                    .map(
                        normalizeStoredEntry
                    )
                    .filter(Boolean)
                    .sort(
                        (
                            first,
                            second
                        ) =>
                            new Date(
                                second.createdAt
                            ).getTime() -
                            new Date(
                                first.createdAt
                            ).getTime()
                    )
        };
    }

    function migrateState(value) {
        const source =
            normalizeObject(value);

        if (
            !source.schemaVersion
        ) {
            return {
                ...source,

                schema:
                    STORAGE_SCHEMA,

                schemaVersion:
                    STORAGE_SCHEMA_VERSION
            };
        }

        return source;
    }

    function normalizeStoredEntry(
        value
    ) {
        if (
            !value ||
            typeof value !==
                "object" ||
            Array.isArray(value)
        ) {
            return null;
        }

        const prompt =
            normalizeText(
                value.prompt
            );

        if (!prompt) {
            return null;
        }

        const createdAt =
            normalizeDate(
                value.createdAt
            ) ||
            new Date()
                .toISOString();

        return {
            id:
                normalizeText(
                    value.id
                ) ||
                createId(),

            schema:
                "portraitos.prompt-history-entry",

            schemaVersion:
                "1.0",

            version:
                normalizePositiveInteger(
                    value.version,
                    1
                ),

            profileId:
                normalizeNullableText(
                    value.profileId
                ),

            profileName:
                normalizeNullableText(
                    value.profileName
                ),

            contractId:
                normalizeNullableText(
                    value.contractId
                ),

            contractFingerprint:
                normalizeNullableText(
                    value
                        .contractFingerprint
                ),

            provider:
                normalizeText(
                    value.provider
                ).toLowerCase() ||
                "generic",

            level:
                normalizeText(
                    value.level
                ).toLowerCase() ||
                "professional",

            mode:
                normalizeNullableText(
                    value.mode
                ),

            prompt,

            negativePrompt:
                normalizeText(
                    value
                        .negativePrompt
                ),

            parameters:
                clone(
                    normalizeObject(
                        value.parameters
                    )
                ),

            command:
                normalizeText(
                    value.command
                ) ||
                prompt,

            source: {
                compilerVersion:
                    normalizeNullableText(
                        value.source
                            ?.compilerVersion ||
                        value
                            .compilerVersion
                    ),

                optimizerVersion:
                    normalizeNullableText(
                        value.source
                            ?.optimizerVersion ||
                        value
                            .optimizerVersion
                    ),

                builderVersion:
                    normalizeNullableText(
                        value.source
                            ?.builderVersion ||
                        value
                            .builderVersion
                    )
            },

            metrics:
                normalizeMetrics(
                    value.metrics,
                    prompt,
                    value
                        .negativePrompt
                ),

            favorite:
                value.favorite ===
                    true,

            tags:
                normalizeTags(
                    value.tags
                ),

            title:
                normalizeNullableText(
                    value.title
                ),

            notes:
                normalizeText(
                    value.notes
                ),

            metadata:
                clone(
                    normalizeObject(
                        value.metadata
                    )
                ),

            createdAt,

            updatedAt:
                normalizeDate(
                    value.updatedAt
                ) ||
                createdAt
        };
    }

    function normalizeEntryInput(
        input,
        options
    ) {
        const source =
            normalizeObject(input);

        const context =
            normalizeObject(options);

        return {
            profileId:
                normalizeNullableText(
                    firstValue(
                        source.profileId,
                        context.profileId
                    )
                ),

            profileName:
                normalizeNullableText(
                    firstValue(
                        source.profileName,
                        context.profileName
                    )
                ),

            contractId:
                normalizeNullableText(
                    source.contractId
                ),

            contractFingerprint:
                normalizeNullableText(
                    source
                        .contractFingerprint
                ),

            provider:
                normalizeText(
                    source.provider
                ).toLowerCase() ||
                "generic",

            level:
                normalizeText(
                    source.level
                ).toLowerCase() ||
                "professional",

            mode:
                normalizeNullableText(
                    source.mode
                ),

            prompt:
                normalizeText(
                    source.prompt
                ),

            negativePrompt:
                normalizeText(
                    source
                        .negativePrompt
                ),

            parameters:
                clone(
                    normalizeObject(
                        source.parameters
                    )
                ),

            command:
                normalizeText(
                    source.command
                ) ||
                normalizeText(
                    source.prompt
                ),

            compilerVersion:
                normalizeNullableText(
                    firstValue(
                        source
                            .compilerVersion,
                        source
                            .sourceCompilerVersion
                    )
                ),

            optimizerVersion:
                normalizeNullableText(
                    source
                        .optimizerVersion
                ),

            builderVersion:
                normalizeNullableText(
                    source
                        .builderVersion
                ),

            metrics:
                normalizeObject(
                    source.metrics
                ),

            favorite:
                source.favorite ===
                    true,

            tags:
                normalizeTags(
                    firstValue(
                        source.tags,
                        context.tags
                    )
                ),

            title:
                normalizeNullableText(
                    firstValue(
                        source.title,
                        context.title
                    )
                ),

            notes:
                normalizeText(
                    firstValue(
                        source.notes,
                        context.notes
                    )
                ),

            metadata:
                clone({
                    ...normalizeObject(
                        context.metadata
                    ),

                    ...normalizeObject(
                        source.metadata
                    )
                })
        };
    }

    function validateEntryInput(
        entry
    ) {
        const errors = [];
        const warnings = [];

        if (!entry.prompt) {
            errors.push(
                createIssue(
                    "PROMPT_REQUIRED",
                    "El prompt está vacío."
                )
            );
        }

        if (!entry.provider) {
            errors.push(
                createIssue(
                    "PROVIDER_REQUIRED",
                    "No se ha especificado el proveedor."
                )
            );
        }

        if (
            !entry.profileId
        ) {
            warnings.push(
                createIssue(
                    "PROFILE_ID_MISSING",
                    "La generación no está asociada a un perfil."
                )
            );
        }

        if (
            !entry.contractId
        ) {
            warnings.push(
                createIssue(
                    "CONTRACT_ID_MISSING",
                    "La generación no está asociada a un Portrait Contract."
                )
            );
        }

        return {
            valid:
                errors.length ===
                0,

            errors,

            warnings
        };
    }

    function normalizeMetrics(
        metrics,
        prompt,
        negativePrompt
    ) {
        const source =
            normalizeObject(metrics);

        const characterCount =
            normalizeText(
                prompt
            ).length;

        const wordCount =
            countWords(prompt);

        return {
            characterCount:
                normalizeFiniteNumber(
                    firstValue(
                        source
                            .optimizedCharacters,
                        source
                            .characterCount
                    ),
                    characterCount
                ),

            wordCount:
                normalizeFiniteNumber(
                    firstValue(
                        source
                            .optimizedWords,
                        source.wordCount
                    ),
                    wordCount
                ),

            negativeCharacterCount:
                normalizeFiniteNumber(
                    firstValue(
                        source
                            .optimizedNegativeCharacters,
                        source
                            .negativeCharacterCount
                    ),
                    normalizeText(
                        negativePrompt
                    ).length
                ),

            estimatedTokenCount:
                normalizeFiniteNumber(
                    source
                        .estimatedTokenCount,
                    Math.ceil(
                        characterCount /
                        4
                    )
                ),

            identityCoverage:
                normalizeFiniteNumber(
                    source
                        .identityCoverage,
                    null
                ),

            reductionPercent:
                normalizeFiniteNumber(
                    source
                        .reductionPercent,
                    0
                )
        };
    }

    function normalizeQuery(query) {
        const source = {
            ...DEFAULT_QUERY,

            ...normalizeObject(
                query
            )
        };

        const sortBy =
            SORT_FIELDS.includes(
                source.sortBy
            )
                ? source.sortBy
                : DEFAULT_QUERY
                    .sortBy;

        return {
            profileId:
                normalizeNullableText(
                    source.profileId
                ),

            contractId:
                normalizeNullableText(
                    source.contractId
                ),

            provider:
                normalizeNullableText(
                    source.provider
                )?.toLowerCase() ||
                null,

            level:
                normalizeNullableText(
                    source.level
                )?.toLowerCase() ||
                null,

            mode:
                normalizeNullableText(
                    source.mode
                )?.toLowerCase() ||
                null,

            favorite:
                typeof source.favorite ===
                    "boolean"
                    ? source.favorite
                    : null,

            tags:
                normalizeTags(
                    source.tags
                ),

            search:
                normalizeComparableText(
                    source.search
                ),

            from:
                normalizeDate(
                    source.from
                ),

            to:
                normalizeDate(
                    source.to
                ),

            sortBy,

            sortDirection:
                normalizeText(
                    source.sortDirection
                ).toLowerCase() ===
                    "asc"
                    ? "asc"
                    : "desc",

            offset:
                normalizeNonNegativeInteger(
                    source.offset,
                    0
                ),

            limit:
                normalizePositiveInteger(
                    source.limit,
                    50
                )
        };
    }

    /* ========================================================
       FILTRADO Y ORDENACIÓN
       ======================================================== */

    function matchesQuery(
        entry,
        query
    ) {
        if (
            query.profileId &&
            entry.profileId !==
                query.profileId
        ) {
            return false;
        }

        if (
            query.contractId &&
            entry.contractId !==
                query.contractId
        ) {
            return false;
        }

        if (
            query.provider &&
            entry.provider !==
                query.provider
        ) {
            return false;
        }

        if (
            query.level &&
            entry.level !==
                query.level
        ) {
            return false;
        }

        if (
            query.mode &&
            entry.mode !==
                query.mode
        ) {
            return false;
        }

        if (
            query.favorite !==
                null &&
            entry.favorite !==
                query.favorite
        ) {
            return false;
        }

        if (
            query.tags.length &&
            !query.tags.every(
                tag =>
                    entry.tags.some(
                        entryTag =>
                            normalizeComparableText(
                                entryTag
                            ) ===
                            normalizeComparableText(
                                tag
                            )
                    )
            )
        ) {
            return false;
        }

        const timestamp =
            new Date(
                entry.createdAt
            ).getTime();

        if (
            query.from &&
            timestamp <
                new Date(
                    query.from
                ).getTime()
        ) {
            return false;
        }

        if (
            query.to &&
            timestamp >
                new Date(
                    query.to
                ).getTime()
        ) {
            return false;
        }

        if (query.search) {
            const searchable =
                normalizeComparableText(
                    [
                        entry.title,
                        entry.profileName,
                        entry.provider,
                        entry.level,
                        entry.mode,
                        entry.prompt,
                        entry
                            .negativePrompt,
                        entry.notes,
                        ...entry.tags
                    ]
                        .filter(Boolean)
                        .join(" ")
                );

            if (
                !searchable.includes(
                    query.search
                )
            ) {
                return false;
            }
        }

        return true;
    }

    function sortEntries(
        entries,
        query
    ) {
        const direction =
            query.sortDirection ===
                "asc"
                ? 1
                : -1;

        const sortBy =
            query.sortBy ||
            "createdAt";

        return [...entries]
            .sort(
                (first, second) => {
                    const left =
                        getSortValue(
                            first,
                            sortBy
                        );

                    const right =
                        getSortValue(
                            second,
                            sortBy
                        );

                    if (
                        typeof left ===
                            "number" &&
                        typeof right ===
                            "number"
                    ) {
                        return (
                            left -
                            right
                        ) * direction;
                    }

                    return String(
                        left ?? ""
                    ).localeCompare(
                        String(
                            right ?? ""
                        ),
                        "es",
                        {
                            numeric:
                                true,

                            sensitivity:
                                "base"
                        }
                    ) * direction;
                }
            );
    }

    function getSortValue(
        entry,
        field
    ) {
        if (
            field ===
                "createdAt" ||
            field ===
                "updatedAt"
        ) {
            return new Date(
                entry[field]
            ).getTime();
        }

        if (
            field ===
            "characterCount"
        ) {
            return entry.metrics
                .characterCount;
        }

        return entry[field];
    }

    /* ========================================================
       VERSIONADO Y DUPLICADOS
       ======================================================== */

    function resolveNextVersion(
        profileId,
        contractId
    ) {
        const versions =
            state.entries
                .filter(
                    entry =>
                        (
                            profileId &&
                            entry.profileId ===
                                profileId
                        ) ||
                        (
                            !profileId &&
                            contractId &&
                            entry.contractId ===
                                contractId
                        )
                )
                .map(
                    entry =>
                        entry.version
                );

        return versions.length
            ? Math.max(
                ...versions
            ) + 1
            : 1;
    }

    function findLatestDuplicate(
        input
    ) {
        const latest =
            state.entries.find(
                entry =>
                    entry.profileId ===
                        input.profileId &&
                    entry.contractId ===
                        input.contractId
            );

        if (!latest) {
            return null;
        }

        const samePrompt =
            normalizeComparableText(
                latest.prompt
            ) ===
            normalizeComparableText(
                input.prompt
            );

        const sameNegative =
            normalizeComparableText(
                latest
                    .negativePrompt
            ) ===
            normalizeComparableText(
                input
                    .negativePrompt
            );

        const sameParameters =
            valuesEqual(
                latest.parameters,
                input.parameters
            );

        const sameProvider =
            latest.provider ===
            input.provider;

        const sameLevel =
            latest.level ===
            input.level;

        return (
            samePrompt &&
            sameNegative &&
            sameParameters &&
            sameProvider &&
            sameLevel
        )
            ? latest
            : null;
    }

    function enforceLimits() {
        const protectedIds =
            new Set(
                state.entries
                    .filter(
                        entry =>
                            entry.favorite
                    )
                    .map(
                        entry =>
                            entry.id
                    )
            );

        const profileCounts =
            new Map();

        state.entries =
            state.entries.filter(
                entry => {
                    if (
                        protectedIds.has(
                            entry.id
                        )
                    ) {
                        return true;
                    }

                    const key =
                        entry.profileId ||
                        "__unassigned__";

                    const current =
                        profileCounts.get(
                            key
                        ) ||
                        0;

                    if (
                        current >=
                        MAX_ENTRIES_PER_PROFILE
                    ) {
                        return false;
                    }

                    profileCounts.set(
                        key,
                        current + 1
                    );

                    return true;
                }
            );

        if (
            state.entries.length <=
            MAX_ENTRIES
        ) {
            return;
        }

        const favorites =
            state.entries.filter(
                entry =>
                    entry.favorite
            );

        const regular =
            state.entries.filter(
                entry =>
                    !entry.favorite
            );

        const availableRegularSlots =
            Math.max(
                0,
                MAX_ENTRIES -
                favorites.length
            );

        state.entries = [
            ...favorites,
            ...regular.slice(
                0,
                availableRegularSlots
            )
        ]
            .sort(
                (
                    first,
                    second
                ) =>
                    new Date(
                        second.createdAt
                    ).getTime() -
                    new Date(
                        first.createdAt
                    ).getTime()
            );
    }

    /* ========================================================
       ALGORITMO DE DIFERENCIAS
       ======================================================== */

    function splitComparisonUnits(
        text
    ) {
        return normalizeText(text)
            .split(
                /\n+|(?<=[.!?])\s+/
            )
            .map(normalizeText)
            .filter(Boolean);
    }

    function buildLcsMatrix(
        first,
        second
    ) {
        const matrix =
            Array.from(
                {
                    length:
                        first.length + 1
                },
                () =>
                    Array(
                        second.length +
                        1
                    ).fill(0)
            );

        for (
            let firstIndex = 1;
            firstIndex <=
                first.length;
            firstIndex += 1
        ) {
            for (
                let secondIndex = 1;
                secondIndex <=
                    second.length;
                secondIndex += 1
            ) {
                if (
                    normalizeComparableText(
                        first[
                            firstIndex -
                            1
                        ]
                    ) ===
                    normalizeComparableText(
                        second[
                            secondIndex -
                            1
                        ]
                    )
                ) {
                    matrix[
                        firstIndex
                    ][
                        secondIndex
                    ] =
                        matrix[
                            firstIndex -
                            1
                        ][
                            secondIndex -
                            1
                        ] + 1;
                } else {
                    matrix[
                        firstIndex
                    ][
                        secondIndex
                    ] =
                        Math.max(
                            matrix[
                                firstIndex -
                                1
                            ][
                                secondIndex
                            ],

                            matrix[
                                firstIndex
                            ][
                                secondIndex -
                                1
                            ]
                        );
                }
            }
        }

        return matrix;
    }

    function backtrackDiff(
        first,
        second,
        matrix
    ) {
        const changes = [];

        let firstIndex =
            first.length;

        let secondIndex =
            second.length;

        while (
            firstIndex > 0 ||
            secondIndex > 0
        ) {
            if (
                firstIndex > 0 &&
                secondIndex > 0 &&
                normalizeComparableText(
                    first[
                        firstIndex -
                        1
                    ]
                ) ===
                normalizeComparableText(
                    second[
                        secondIndex -
                        1
                    ]
                )
            ) {
                changes.unshift({
                    type:
                        "unchanged",

                    value:
                        second[
                            secondIndex -
                            1
                        ]
                });

                firstIndex -= 1;
                secondIndex -= 1;

                continue;
            }

            if (
                secondIndex > 0 &&
                (
                    firstIndex === 0 ||
                    matrix[
                        firstIndex
                    ][
                        secondIndex -
                        1
                    ] >=
                    matrix[
                        firstIndex -
                        1
                    ][
                        secondIndex
                    ]
                )
            ) {
                changes.unshift({
                    type:
                        "added",

                    value:
                        second[
                            secondIndex -
                            1
                        ]
                });

                secondIndex -= 1;

                continue;
            }

            if (
                firstIndex > 0
            ) {
                changes.unshift({
                    type:
                        "removed",

                    value:
                        first[
                            firstIndex -
                            1
                        ]
                });

                firstIndex -= 1;
            }
        }

        return changes;
    }

    /* ========================================================
       EVENTOS
       ======================================================== */

    function emitChanged() {
        emit(
            EVENTS.CHANGED,
            {
                snapshot:
                    getSnapshot()
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

    /* ========================================================
       SNAPSHOT
       ======================================================== */

    function getSnapshot() {
        ensureInitialized();

        return deepFreeze({
            schema:
                state.schema,

            schemaVersion:
                state.schemaVersion,

            serviceVersion:
                VERSION,

            createdAt:
                state.createdAt,

            updatedAt:
                state.updatedAt,

            entryCount:
                state.entries.length
        });
    }

    /* ========================================================
       UTILIDADES
       ======================================================== */

    function getRequiredEntry(id) {
        const entry =
            getById(id);

        if (!entry) {
            throw createHistoryError(
                "ENTRY_NOT_FOUND",
                "No se ha encontrado la generación solicitada."
            );
        }

        return entry;
    }

    function findIndexById(id) {
        const normalizedId =
            normalizeText(id);

        return state.entries
            .findIndex(
                entry =>
                    entry.id ===
                    normalizedId
            );
    }

    function buildDefaultTitle(
        entry,
        version
    ) {
        const provider =
            entry.provider
                ? entry.provider
                    .replace(
                        /(^|-)(\w)/g,
                        (
                            _,
                            separator,
                            character
                        ) =>
                            `${separator}${character.toUpperCase()}`
                    )
                : "Generic";

        return (
            `${entry.profileName || "Portrait"} · ` +
            `${provider} · v${version}`
        );
    }

    function summarizeEntry(entry) {
        return {
            id:
                entry.id,

            version:
                entry.version,

            title:
                entry.title,

            profileId:
                entry.profileId,

            profileName:
                entry.profileName,

            contractId:
                entry.contractId,

            provider:
                entry.provider,

            level:
                entry.level,

            mode:
                entry.mode,

            favorite:
                entry.favorite,

            tags:
                clone(
                    entry.tags
                ),

            metrics:
                clone(
                    entry.metrics
                ),

            createdAt:
                entry.createdAt,

            updatedAt:
                entry.updatedAt
        };
    }

    function flattenObject(
        object,
        prefix = "",
        result = {}
    ) {
        Object.entries(object)
            .forEach(
                ([key, value]) => {
                    const path =
                        prefix
                            ? `${prefix}.${key}`
                            : key;

                    if (
                        value &&
                        typeof value ===
                            "object" &&
                        !Array.isArray(
                            value
                        )
                    ) {
                        flattenObject(
                            value,
                            path,
                            result
                        );

                        return;
                    }

                    result[path] =
                        clone(value);
                }
            );

        return result;
    }

    function countBy(
        entries,
        selector
    ) {
        const counts = {};

        entries.forEach(
            entry => {
                const key =
                    selector(entry);

                counts[key] =
                    (
                        counts[key] ||
                        0
                    ) + 1;
            }
        );

        return Object.entries(
            counts
        )
            .map(
                ([name, count]) => ({
                    name,
                    count
                })
            )
            .sort(
                (first, second) =>
                    second.count -
                    first.count
            );
    }

    function normalizeImportPayload(
        payload
    ) {
        let source =
            payload;

        if (
            typeof payload ===
            "string"
        ) {
            try {
                source =
                    JSON.parse(
                        payload
                    );
            } catch {
                throw createHistoryError(
                    "INVALID_IMPORT_PAYLOAD",
                    "El archivo de historial no contiene JSON válido."
                );
            }
        }

        if (
            Array.isArray(source)
        ) {
            return {
                entries:
                    source
            };
        }

        if (
            source &&
            Array.isArray(
                source.entries
            )
        ) {
            return source;
        }

        throw createHistoryError(
            "INVALID_IMPORT_PAYLOAD",
            "El contenido importado no contiene generaciones de prompts."
        );
    }

    function normalizeTags(value) {
        const tags =
            Array.isArray(value)
                ? value
                : typeof value ===
                    "string"
                    ? value.split(
                        /[,;\n]+/
                    )
                    : [];

        const seen =
            new Set();

        return tags
            .map(normalizeText)
            .filter(Boolean)
            .filter(
                tag => {
                    const key =
                        normalizeComparableText(
                            tag
                        );

                    if (
                        seen.has(key)
                    ) {
                        return false;
                    }

                    seen.add(key);

                    return true;
                }
            )
            .slice(
                0,
                20
            );
    }

    function normalizeDate(value) {
        if (!value) {
            return null;
        }

        const date =
            new Date(value);

        return Number.isNaN(
            date.getTime()
        )
            ? null
            : date.toISOString();
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

    function normalizeArray(value) {
        return Array.isArray(value)
            ? value
            : [];
    }

    function normalizeText(value) {
        return String(
            value ?? ""
        ).trim();
    }

    function normalizeNullableText(
        value
    ) {
        const normalized =
            normalizeText(value);

        return normalized ||
            null;
    }

    function normalizeComparableText(
        value
    ) {
        return normalizeText(value)
            .toLowerCase()
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    function normalizePositiveInteger(
        value,
        fallback
    ) {
        const number =
            Number.parseInt(
                value,
                10
            );

        return Number.isFinite(
            number
        ) &&
        number > 0
            ? number
            : fallback;
    }

    function normalizeNonNegativeInteger(
        value,
        fallback
    ) {
        const number =
            Number.parseInt(
                value,
                10
            );

        return Number.isFinite(
            number
        ) &&
        number >= 0
            ? number
            : fallback;
    }

    function normalizeFiniteNumber(
        value,
        fallback
    ) {
        const number =
            Number(value);

        return Number.isFinite(
            number
        )
            ? number
            : fallback;
    }

    function countWords(value) {
        const text =
            normalizeText(value);

        return text
            ? text.split(
                /\s+/
            ).length
            : 0;
    }

    function firstValue(...values) {
        return values.find(
            value =>
                value !==
                    undefined &&
                value !==
                    null &&
                value !==
                    ""
        );
    }

    function valuesEqual(
        first,
        second
    ) {
        return stableStringify(
            first
        ) ===
        stableStringify(
            second
        );
    }

    function stableStringify(value) {
        if (
            value === null ||
            typeof value !==
                "object"
        ) {
            return JSON.stringify(
                value
            );
        }

        if (
            Array.isArray(value)
        ) {
            return (
                "[" +
                value
                    .map(
                        stableStringify
                    )
                    .join(",") +
                "]"
            );
        }

        return (
            "{" +
            Object.keys(value)
                .sort()
                .map(
                    key =>
                        `${JSON.stringify(key)}:${stableStringify(value[key])}`
                )
                .join(",") +
            "}"
        );
    }

    function createIssue(
        code,
        message
    ) {
        return {
            code:
                normalizeText(code),

            message:
                normalizeText(
                    message
                )
        };
    }

    function createHistoryError(
        code,
        message,
        details = null
    ) {
        const error =
            new Error(message);

        error.name =
            "PromptHistoryError";

        error.code =
            code;

        error.details =
            clone(details);

        return error;
    }

    function createId() {
        if (
            window.crypto &&
            typeof window.crypto
                .randomUUID ===
                "function"
        ) {
            return window.crypto
                .randomUUID();
        }

        return (
            "prompt-history-" +
            Date.now()
                .toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 10)
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

    function deepFreeze(value) {
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
        STORAGE_KEY,
        EVENTS,

        init,
        getSnapshot,

        add,
        addCompiled,
        addOptimized,

        getById,
        getLatest,
        list,
        search,
        getByProfile,
        getByContract,
        getFavorites,
        getTags,

        update,
        rename,
        toggleFavorite,
        setFavorite,
        setTags,
        addTag,
        removeTag,
        setNotes,

        remove,
        removeMany,
        clear,

        restore,
        compare,
        compareTexts,
        compareObjects,

        getStatistics,

        exportHistory,
        importHistory,

        on
    });

})();

window.PromptHistoryService =
    PromptHistoryService;
