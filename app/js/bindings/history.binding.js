"use strict";

/* ============================================================
   PortraitOS
   History Binding
   ------------------------------------------------------------
   UI Layer

   Responsabilidad

   - Conectar PromptHistoryService con la interfaz.
   - Renderizar el historial.
   - Gestionar filtros.
   - Gestionar búsqueda.
   - Restaurar versiones.
   - Comparar versiones.
   - Favoritos.
   - Etiquetas.
   - Paginación.
   - Selección múltiple.
   ============================================================ */

const HistoryBinding = (() => {

    /* ========================================================
       VERSION
       ======================================================== */

    const VERSION = "1.0.0";

    /* ========================================================
       EVENTOS
       ======================================================== */

    const EVENTS = Object.freeze({

        INITIALIZED:
            "portraitos:history-binding:initialized",

        CHANGED:
            "portraitos:history-binding:changed",

        FILTER_CHANGED:
            "portraitos:history-binding:filter-changed",

        SEARCH_CHANGED:
            "portraitos:history-binding:search-changed",

        RESTORED:
            "portraitos:history-binding:restored",

        COMPARE:
            "portraitos:history-binding:compare"

    });

    /* ========================================================
       SELECTORES
       ======================================================== */

    const DEFAULT_SELECTORS = Object.freeze({

        root:
            "[data-history]",

        search:
            "[data-history-search]",

        provider:
            "[data-history-provider]",

        level:
            "[data-history-level]",

        favorites:
            "[data-history-favorites]",

        tags:
            "[data-history-tags]",

        list:
            "[data-history-list]",

        pagination:
            "[data-history-pagination]",

        empty:
            "[data-history-empty]",

        counter:
            "[data-history-counter]"

    });

    /* ========================================================
       CONFIG
       ======================================================== */

    const DEFAULT_OPTIONS = Object.freeze({

        pageSize:
            20,

        selectors:
            DEFAULT_SELECTORS,

        autoRefresh:
            true

    });

    /* ========================================================
       ESTADO
       ======================================================== */

    let initialized = false;

    let options = clone(DEFAULT_OPTIONS);

    let elements = {};

    let listeners = [];

    let state = {

        search: "",

        provider: "",

        level: "",

        onlyFavorites: false,

        tag: "",

        page: 1,

        pageSize: 20,

        totalPages: 1,

        totalItems: 0,

        selected: new Set(),

        history: [],

        filtered: []

    };

    /* ========================================================
       INIT
       ======================================================== */

    function init(config = {}) {

        if (initialized)
            destroy();

        options = normalizeOptions(config);

        state.pageSize =
            options.pageSize;

        elements =
            collectElements(
                options.selectors
            );

        bindEvents();

        refresh();

        initialized = true;

        emit(EVENTS.INITIALIZED, {
            version: VERSION
        });

        return api();

    }

    /* ========================================================
       DESTROY
       ======================================================== */

    function destroy() {

        listeners.forEach(fn => fn());

        listeners = [];

        elements = {};

        initialized = false;

    }

    /* ========================================================
       REFRESH
       ======================================================== */

    function refresh() {

        loadHistory();

        applyFilters();

        render();

    }

    /* ========================================================
       LOAD
       ======================================================== */

    function loadHistory() {

        if (!window.PromptHistoryService) {

            state.history = [];

            return;

        }

        const result =
            window
            .PromptHistoryService
            .list({

                limit: Number.MAX_SAFE_INTEGER

            });

        state.history =
            clone(result.items);

    }

    /* ========================================================
       FILTRADO
       ======================================================== */

    function applyFilters() {

        let items =
            [...state.history];

        if (state.search.length) {

            const value =
                state.search.toLowerCase();

            items =
                items.filter(item => {

                    return (
                        (item.title || "")
                        .toLowerCase()
                        .includes(value)

                        ||

                        (item.notes || "")
                        .toLowerCase()
                        .includes(value)

                        ||

                        (item.provider || "")
                        .toLowerCase()
                        .includes(value)

                    );

                });

        }

        if (state.provider.length) {

            items =
                items.filter(item =>
                    item.provider ===
                    state.provider);

        }

        if (state.level.length) {

            items =
                items.filter(item =>
                    item.level ===
                    state.level);

        }

        if (state.onlyFavorites) {

            items =
                items.filter(item =>
                    item.favorite);

        }

        if (state.tag.length) {

            items =
                items.filter(item =>
                    (item.tags || [])
                    .includes(state.tag));

        }

        state.filtered = items;

        state.totalItems =
            items.length;

        state.totalPages =
            Math.max(
                1,
                Math.ceil(
                    items.length /
                    state.pageSize
                )
            );

        if (state.page >
            state.totalPages)

            state.page =
                state.totalPages;

    }

    /* ========================================================
       PAGINA ACTUAL
       ======================================================== */

    function currentPageItems() {

        const start =
            (state.page - 1)
            * state.pageSize;

        return state.filtered.slice(

            start,

            start + state.pageSize

        );

    }

    /* ========================================================
       RENDER
       ======================================================== */

    function render() {

        renderCounter();

        renderEmpty();

        renderList();

        renderPagination();

        emit(EVENTS.CHANGED, {

            total:
                state.totalItems,

            page:
                state.page

        });

    }

    /* ========================================================
       CONTADOR
       ======================================================== */

    function renderCounter() {

        if (!elements.counter)
            return;

        elements.counter.textContent =
            `${state.totalItems} prompts`;

    }

    /* ========================================================
       EMPTY
       ======================================================== */

    function renderEmpty() {

        if (!elements.empty)
            return;

        elements.empty.hidden =
            state.totalItems !== 0;

    }

    /* ========================================================
       LISTA
       ======================================================== */

    function renderList() {

        if (!elements.list)
            return;

        elements.list.innerHTML = "";

        const fragment =
            document.createDocumentFragment();

        currentPageItems()

            .forEach(item => {

                fragment.appendChild(

                    createHistoryCard(item)

                );

            });

        elements.list.appendChild(fragment);

    }
    /* ========================================================
       HISTORY CARD
       ======================================================== */

    function createHistoryCard(item) {

        const article =
            document.createElement("article");

        article.className =
            "portrait-history-card";

        article.dataset.id =
            item.id;

        if (item.favorite)
            article.classList.add(
                "favorite"
            );

        /*----------------------------------
            Header
        ----------------------------------*/

        const header =
            document.createElement("header");

        header.className =
            "history-card-header";

        const left =
            document.createElement("div");

        left.className =
            "history-card-title";

        const title =
            document.createElement("h4");

        title.textContent =
            item.title ||
            `Version ${item.version}`;

        const meta =
            document.createElement("small");

        meta.textContent =
            buildMetadata(item);

        left.append(
            title,
            meta
        );

        /*----------------------------------
            Favorite
        ----------------------------------*/

        const favorite =
            document.createElement("button");

        favorite.type = "button";

        favorite.className =
            "history-favorite";

        favorite.textContent =
            item.favorite
                ? "★"
                : "☆";

        favorite.title =
            "Favorite";

        favorite.addEventListener(
            "click",
            () => {

                window
                    .PromptHistoryService
                    .toggleFavorite(
                        item.id
                    );

                refresh();

            });

        header.append(
            left,
            favorite
        );

        /*----------------------------------
            Preview
        ----------------------------------*/

        const preview =
            document.createElement("div");

        preview.className =
            "history-preview";

        preview.textContent =
            truncate(
                item.prompt || "",
                260
            );

        /*----------------------------------
            Tags
        ----------------------------------*/

        const tags =
            createTags(item);

        /*----------------------------------
            Footer
        ----------------------------------*/

        const footer =
            document.createElement("footer");

        footer.className =
            "history-footer";

        footer.append(

            createRestoreButton(item),

            createCompareButton(item),

            createDuplicateButton(item),

            createExportButton(item),

            createDeleteButton(item)

        );

        article.append(

            header,

            preview,

            tags,

            footer

        );

        return article;

    }

    /* ========================================================
       TAGS
       ======================================================== */

    function createTags(item){

        const container =
            document.createElement("div");

        container.className =
            "history-tags";

        (item.tags || [])

            .forEach(tag=>{

                const badge =
                    document.createElement("span");

                badge.className =
                    "history-tag";

                badge.textContent =
                    tag;

                badge.addEventListener(

                    "click",

                    ()=>{

                        state.tag = tag;

                        applyFilters();

                        render();

                    }

                );

                container.appendChild(
                    badge
                );

            });

        return container;

    }

    /* ========================================================
       RESTORE BUTTON
       ======================================================== */

    function createRestoreButton(item){

        const button =
            createButton(

                "Restore",

                "history-action"

            );

        button.addEventListener(

            "click",

            ()=>{

                if(window.PromptBinding){

                    window.PromptBinding
                        .restoreHistoryEntry(
                            item.id
                        );

                }

                emit(
                    EVENTS.RESTORED,
                    item
                );

            }

        );

        return button;

    }

    /* ========================================================
       COMPARE BUTTON
       ======================================================== */

    function createCompareButton(item){

        const button =
            createButton(

                "Compare",

                "history-action"

            );

        button.addEventListener(

            "click",

            ()=>{

                toggleSelection(item.id);

            }

        );

        return button;

    }

    /* ========================================================
       EXPORT
       ======================================================== */

    function createExportButton(item){

        const button =
            createButton(

                "Export",

                "history-action"

            );

        button.addEventListener(

            "click",

            ()=>{

                exportEntry(item);

            }

        );

        return button;

    }

    /* ========================================================
       DUPLICATE
       ======================================================== */

    function createDuplicateButton(item){

        const button =
            createButton(

                "Duplicate",

                "history-action"

            );

        button.addEventListener(

            "click",

            ()=>{

                duplicateEntry(item);

            }

        );

        return button;

    }

    /* ========================================================
       DELETE
       ======================================================== */

    function createDeleteButton(item){

        const button =
            createButton(

                "Delete",

                "history-danger"

            );

        button.addEventListener(

            "click",

            ()=>{

                if(

                    !confirm(
                        "Delete this version?"
                    )

                )
                    return;

                window
                    .PromptHistoryService
                    .remove(item.id);

                refresh();

            }

        );

        return button;

    }

    /* ========================================================
       PAGINATION
       ======================================================== */

    function renderPagination(){

        if(!elements.pagination)
            return;

        elements.pagination.innerHTML="";

        if(state.totalPages<=1)
            return;

        const previous =
            createButton("<");

        previous.disabled =
            state.page===1;

        previous.onclick=()=>{

            state.page--;

            render();

        };

        elements.pagination.appendChild(previous);

        for(

            let i=1;

            i<=state.totalPages;

            i++

        ){

            const page =
                createButton(i);

            if(i===state.page)
                page.classList.add(
                    "active"
                );

            page.onclick=()=>{

                state.page=i;

                render();

            };

            elements.pagination
                .appendChild(page);

        }

        const next =
            createButton(">");

        next.disabled =
            state.page===state.totalPages;

        next.onclick=()=>{

            state.page++;

            render();

        };

        elements.pagination
            .appendChild(next);

    }

    /* ========================================================
       SEARCH
       ======================================================== */

    function bindSearch(){

        if(!elements.search)
            return;

        elements.search.addEventListener(

            "input",

            e=>{

                state.search=
                    e.target.value;

                applyFilters();

                render();

                emit(

                    EVENTS.SEARCH_CHANGED,

                    state.search

                );

            }

        );

    }

    /* ========================================================
       PROVIDER FILTER
       ======================================================== */

    function bindProviderFilter(){

        if(!elements.provider)
            return;

        elements.provider.onchange=e=>{

            state.provider=e.target.value;

            applyFilters();

            render();

        };

    }

    /* ========================================================
       LEVEL FILTER
       ======================================================== */

    function bindLevelFilter(){

        if(!elements.level)
            return;

        elements.level.onchange=e=>{

            state.level=e.target.value;

            applyFilters();

            render();

        };

    }

    /* ========================================================
       FAVORITES FILTER
       ======================================================== */

    function bindFavoriteFilter(){

        if(!elements.favorites)
            return;

        elements.favorites.onchange=e=>{

            state.onlyFavorites=
                e.target.checked;

            applyFilters();

            render();

        };

    }
      /* ========================================================
       MULTI SELECTION
       ======================================================== */

    function toggleSelection(id) {

        if (state.selected.has(id)) {

            state.selected.delete(id);

        } else {

            if (state.selected.size >= 2) {

                const oldest =
                    state.selected.values().next().value;

                state.selected.delete(oldest);

            }

            state.selected.add(id);

        }

        updateSelection();

    }

    function clearSelection() {

        state.selected.clear();

        updateSelection();

    }

    function updateSelection() {

        if (elements.list) {

            elements.list
                .querySelectorAll("[data-id]")
                .forEach(card => {

                    const selected =
                        state.selected.has(
                            card.dataset.id
                        );

                    card.classList.toggle(
                        "selected",
                        selected
                    );

                });

        }

        if (state.selected.size === 2) {

            compareSelection();

        }

    }

    /* ========================================================
       COMPARE
       ======================================================== */

    function compareSelection() {

        const ids =
            [...state.selected];

        const first =
            window.PromptHistoryService
                .getById(ids[0]);

        const second =
            window.PromptHistoryService
                .getById(ids[1]);

        if (!first || !second)
            return;

        const comparison =
            window.PromptHistoryService.compare(
                first.id,
                second.id
            );

        emit(
            EVENTS.COMPARE,
            comparison
        );

        renderDiffViewer(comparison);

    }

    /* ========================================================
       DIFF VIEWER
       ======================================================== */

    function renderDiffViewer(diff) {

        const viewer =
            document.querySelector(
                "[data-history-diff]"
            );

        if (!viewer)
            return;

        viewer.innerHTML = "";

        const title =
            document.createElement("h3");

        title.textContent =
            "Version Comparison";

        viewer.appendChild(title);

        const summary =
            document.createElement("div");

        summary.className =
            "history-diff-summary";

        summary.innerHTML = `

            <strong>${diff.statistics.similarity}%</strong>
            similarity

            <br>

            Added:
            ${diff.statistics.added}

            <br>

            Removed:
            ${diff.statistics.removed}

            <br>

            Changed:
            ${diff.statistics.changed}

        `;

        viewer.appendChild(summary);

        const pre =
            document.createElement("pre");

        pre.className =
            "history-diff";

        pre.textContent =
            diff.diffText ||
            diff.diff ||
            "";

        viewer.appendChild(pre);

    }

    /* ========================================================
       NOTES
       ======================================================== */

    function updateNotes(id, notes) {

        window.PromptHistoryService
            .setNotes(
                id,
                notes
            );

        refresh();

    }

    /* ========================================================
       TAGS
       ======================================================== */

    function addTag(id, tag) {

        if (!tag)
            return;

        window.PromptHistoryService
            .addTag(
                id,
                tag
            );

        refresh();

    }

    function removeTag(id, tag) {

        window.PromptHistoryService
            .removeTag(
                id,
                tag
            );

        refresh();

    }

    /* ========================================================
       RENAME
       ======================================================== */

    function renameEntry(id) {

        const entry =
            window.PromptHistoryService
                .getById(id);

        if (!entry)
            return;

        const title =
            prompt(
                "New title",
                entry.title || ""
            );

        if (!title)
            return;

        window.PromptHistoryService
            .rename(
                id,
                title
            );

        refresh();

    }

    /* ========================================================
       DUPLICATE
       ======================================================== */

    function duplicateEntry(entry) {

        const duplicate =
            structuredClone(entry);

        delete duplicate.id;

        duplicate.title =
            `${entry.title || "Version"} (Copy)`;

        duplicate.createdAt =
            new Date().toISOString();

        window.PromptHistoryService
            .add(
                duplicate
            );

        refresh();

    }

    /* ========================================================
       EXPORT
       ======================================================== */

    function exportEntry(entry) {

        if (!window.PromptExportService)
            return;

        window.PromptExportService
            .exportHistoryEntry(
                entry,
                {
                    format: "json",
                    download: true
                }
            );

    }

    function exportSelection() {

        if (!window.PromptExportService)
            return;

        const entries =
            [...state.selected]

                .map(id =>
                    window
                    .PromptHistoryService
                    .getById(id)
                )

                .filter(Boolean);

        window.PromptExportService
            .exportHistory(
                entries,
                {
                    format: "json",
                    download: true
                }
            );

    }

    /* ========================================================
       UTILITIES
       ======================================================== */

    function buildMetadata(item) {

        return [

            item.provider,

            item.level,

            formatDate(item.createdAt)

        ]

        .filter(Boolean)

        .join(" • ");

    }

    function truncate(text, length) {

        if (!text)
            return "";

        return text.length > length

            ? text.substring(
                0,
                length
              ) + "..."

            : text;

    }

    function formatDate(date) {

        if (!date)
            return "";

        return new Date(date)
            .toLocaleString();

    }

    function createButton(
        text,
        css = ""
    ) {

        const button =
            document.createElement(
                "button"
            );

        button.type = "button";

        button.textContent =
            text;

        if (css)
            button.className = css;

        return button;

    }

    function collectElements(selectors) {

        const root =
            document.querySelector(
                selectors.root
            ) || document;

        const result = {};

        Object.entries(selectors)

            .forEach(([key, selector]) => {

                if (key === "root")
                    return;

                result[key] =
                    root.querySelector(selector);

            });

        return result;

    }

    function normalizeOptions(config) {

        return {

            ...DEFAULT_OPTIONS,

            ...config,

            selectors: {

                ...DEFAULT_SELECTORS,

                ...(config.selectors || {})

            }

        };

    }

    function clone(value) {

        return structuredClone
            ? structuredClone(value)
            : JSON.parse(JSON.stringify(value));

    }

    function emit(event, detail) {

        window.dispatchEvent(

            new CustomEvent(

                event,

                { detail }

            )

        );

    }
      /* ========================================================
       BIND EVENTS
       ======================================================== */

    function bindEvents() {

        bindSearch();

        bindProviderFilter();

        bindLevelFilter();

        bindFavoriteFilter();

        if (
            options.autoRefresh &&
            window.PromptHistoryService?.EVENTS?.CHANGED
        ) {

            const handler = () => refresh();

            window.addEventListener(
                window.PromptHistoryService.EVENTS.CHANGED,
                handler
            );

            listeners.push(() => {

                window.removeEventListener(
                    window.PromptHistoryService.EVENTS.CHANGED,
                    handler
                );

            });

        }

    }

    /* ========================================================
       PUBLIC FILTERS
       ======================================================== */

    function setSearch(value){

        state.search = value || "";

        applyFilters();

        render();

    }

    function setProvider(provider){

        state.provider = provider || "";

        applyFilters();

        render();

    }

    function setLevel(level){

        state.level = level || "";

        applyFilters();

        render();

    }

    function setTag(tag){

        state.tag = tag || "";

        applyFilters();

        render();

    }

    function clearFilters(){

        state.search = "";

        state.provider = "";

        state.level = "";

        state.tag = "";

        state.onlyFavorites = false;

        state.page = 1;

        applyFilters();

        render();

    }

    /* ========================================================
       PAGINATION API
       ======================================================== */

    function nextPage(){

        if(state.page < state.totalPages){

            state.page++;

            render();

        }

    }

    function previousPage(){

        if(state.page>1){

            state.page--;

            render();

        }

    }

    function goToPage(page){

        if(page<1)
            page=1;

        if(page>state.totalPages)
            page=state.totalPages;

        state.page=page;

        render();

    }

    /* ========================================================
       GETTERS
       ======================================================== */

    function getSelection(){

        return [...state.selected];

    }

    function getHistory(){

        return clone(state.history);

    }

    function getFilteredHistory(){

        return clone(state.filtered);

    }

    function getState(){

        return {

            search:
                state.search,

            provider:
                state.provider,

            level:
                state.level,

            tag:
                state.tag,

            onlyFavorites:
                state.onlyFavorites,

            page:
                state.page,

            totalPages:
                state.totalPages,

            totalItems:
                state.totalItems,

            selected:
                [...state.selected]

        };

    }

    /* ========================================================
       RESET
       ======================================================== */

    function reset(){

        clearSelection();

        clearFilters();

        refresh();

    }

    /* ========================================================
       PUBLIC API
       ======================================================== */

    function api(){

        return {

            VERSION,

            EVENTS,

            refresh,

            reset,

            getState,

            getHistory,

            getFilteredHistory,

            getSelection,

            setSearch,

            setProvider,

            setLevel,

            setTag,

            clearFilters,

            nextPage,

            previousPage,

            goToPage,

            compareSelection,

            restoreHistoryEntry:
                id=>{

                    if(window.PromptBinding){

                        return window
                            .PromptBinding
                            .restoreHistoryEntry(id);

                    }

                },

            exportSelection,

            clearSelection,

            renameEntry,

            addTag,

            removeTag,

            updateNotes,

            duplicateEntry

        };

    }

    /* ========================================================
       EXPORT
       ======================================================== */

    return api();

})();

window.HistoryBinding =
    HistoryBinding;
