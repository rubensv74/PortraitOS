"use strict";

/* ============================================================
   PortraitOS — History Binding
   RC1 runtime integration
   ============================================================ */

const HistoryBinding = (() => {
    const VERSION = "1.1.0";
    const EVENTS = Object.freeze({
        INITIALIZED: "portraitos:history-binding:initialized",
        CHANGED: "portraitos:history-binding:changed",
        FILTER_CHANGED: "portraitos:history-binding:filter-changed",
        SEARCH_CHANGED: "portraitos:history-binding:search-changed",
        RESTORED: "portraitos:history-binding:restored",
        COMPARE: "portraitos:history-binding:compare"
    });

    const SELECTORS = Object.freeze({
        root: "[data-history]",
        search: "[data-history-search]",
        provider: "[data-history-provider]",
        level: "[data-history-level]",
        favorites: "[data-history-favorites]",
        tags: "[data-history-tags]",
        list: "[data-history-list]",
        pagination: "[data-history-pagination]",
        empty: "[data-history-empty]",
        counter: "[data-history-counter]",
        diff: "[data-history-diff]"
    });

    let initialized = false;
    let root = null;
    let listeners = [];
    let state = createState();

    function createState() {
        return {
            search: "",
            provider: "",
            level: "",
            tag: "",
            onlyFavorites: false,
            page: 1,
            pageSize: 20,
            totalPages: 1,
            totalItems: 0,
            selected: new Set(),
            history: [],
            filtered: []
        };
    }

    function init(options = {}) {
        if (initialized) {
            refresh();
            return api();
        }
        validateDependencies();
        root = ensureRoot(options.root || document);
        state.pageSize = Number(options.pageSize || 20) || 20;
        bindDom();
        bindApplicationEvents();
        refresh();
        initialized = true;
        root.dataset.historyInitialized = "true";
        emit(EVENTS.INITIALIZED, { version: VERSION, profileId: getActiveProfileId() });
        return api();
    }

    function destroy() {
        listeners.forEach(off => {
            try { off(); } catch (_) { /* no-op */ }
        });
        listeners = [];
        if (root) delete root.dataset.historyInitialized;
        root = null;
        initialized = false;
        state = createState();
    }

    function validateDependencies() {
        if (!window.PromptHistoryService) throw new Error("HistoryBinding requiere PromptHistoryService.");
    }

    function ensureRoot(scope) {
        const existing = scope.querySelector?.(SELECTORS.root) || document.querySelector(SELECTORS.root);
        if (existing) return existing;

        const promptPanel = document.querySelector("[data-step-panel='prompt']");
        if (!promptPanel) throw new Error("No existe el panel de Generación para integrar History.");

        const section = document.createElement("section");
        section.className = "history-studio";
        section.dataset.history = "";
        section.setAttribute("aria-labelledby", "history-studio-title");
        section.innerHTML = `
            <div class="panel-heading history-studio__heading">
                <div>
                    <span class="panel-heading__eyebrow">History Studio</span>
                    <h2 id="history-studio-title">Historial de generaciones</h2>
                    <p>Consulta, filtra, compara y restaura Portrait Contracts del perfil activo.</p>
                </div>
                <span class="status-badge" data-history-counter>0 generaciones</span>
            </div>
            <article class="card history-studio__controls">
                <div class="card__body">
                    <div class="form-grid">
                        <div class="form-field form-field--full">
                            <label for="history-search">Buscar</label>
                            <input id="history-search" type="search" data-history-search placeholder="Título, notas o proveedor" autocomplete="off">
                        </div>
                        <div class="form-field">
                            <label for="history-provider">Proveedor</label>
                            <select id="history-provider" data-history-provider>
                                <option value="">Todos</option>
                                <option value="generic">Genérico</option>
                                <option value="openai">OpenAI</option>
                                <option value="gpt-image">GPT Image</option>
                                <option value="midjourney">Midjourney</option>
                                <option value="flux">Flux</option>
                                <option value="stable-diffusion">Stable Diffusion</option>
                                <option value="ideogram">Ideogram</option>
                                <option value="firefly">Adobe Firefly</option>
                            </select>
                        </div>
                        <div class="form-field">
                            <label for="history-level">Nivel</label>
                            <select id="history-level" data-history-level>
                                <option value="">Todos</option>
                                <option value="short">Breve</option>
                                <option value="standard">Estándar</option>
                                <option value="professional">Profesional</option>
                                <option value="contract">Contrato</option>
                            </select>
                        </div>
                        <div class="form-field">
                            <label for="history-tag">Etiqueta</label>
                            <select id="history-tag" data-history-tags><option value="">Todas</option></select>
                        </div>
                        <div class="form-field">
                            <label class="checkbox-row">
                                <input type="checkbox" data-history-favorites>
                                <span>Solo favoritos</span>
                            </label>
                        </div>
                    </div>
                </div>
            </article>
            <div class="empty-state" data-history-empty>
                <strong>No hay generaciones para este perfil.</strong>
                <span>Genera un Portrait Contract y aparecerá aquí.</span>
            </div>
            <div class="history-studio__list" data-history-list aria-live="polite"></div>
            <nav class="history-studio__pagination" data-history-pagination aria-label="Paginación del historial"></nav>
            <article class="card history-studio__diff" data-history-diff hidden></article>
        `;

        const exportStudio = promptPanel.querySelector("[data-export-binding]");
        if (exportStudio) exportStudio.insertAdjacentElement("beforebegin", section);
        else promptPanel.appendChild(section);
        return section;
    }

    function bindDom() {
        const search = root.querySelector(SELECTORS.search);
        const provider = root.querySelector(SELECTORS.provider);
        const level = root.querySelector(SELECTORS.level);
        const favorites = root.querySelector(SELECTORS.favorites);
        const tags = root.querySelector(SELECTORS.tags);

        const onSearch = event => {
            state.search = event.target.value || "";
            state.page = 1;
            applyFilters();
            render();
            emit(EVENTS.SEARCH_CHANGED, state.search);
        };
        const onProvider = event => setProvider(event.target.value);
        const onLevel = event => setLevel(event.target.value);
        const onFavorites = event => {
            state.onlyFavorites = Boolean(event.target.checked);
            state.page = 1;
            applyFilters();
            render();
        };
        const onTag = event => setTag(event.target.value);

        search?.addEventListener("input", onSearch);
        provider?.addEventListener("change", onProvider);
        level?.addEventListener("change", onLevel);
        favorites?.addEventListener("change", onFavorites);
        tags?.addEventListener("change", onTag);

        listeners.push(() => search?.removeEventListener("input", onSearch));
        listeners.push(() => provider?.removeEventListener("change", onProvider));
        listeners.push(() => level?.removeEventListener("change", onLevel));
        listeners.push(() => favorites?.removeEventListener("change", onFavorites));
        listeners.push(() => tags?.removeEventListener("change", onTag));
    }

    function bindApplicationEvents() {
        const changedEvent = window.PromptHistoryService?.EVENTS?.CHANGED;
        if (changedEvent) {
            const handler = () => refresh();
            window.addEventListener(changedEvent, handler);
            listeners.push(() => window.removeEventListener(changedEvent, handler));
        }

        if (window.AppEvents?.on) {
            ["profile-manager:changed", "profile:loaded"].forEach(name => {
                const off = window.AppEvents.on(name, () => {
                    clearSelection();
                    state.page = 1;
                    refresh();
                });
                if (typeof off === "function") listeners.push(off);
            });
        }
    }

    function getActiveProfileId() {
        return window.ProfileService?.getActive?.()?.id || window.ProfileManager?.getState?.()?.activeProfileId || null;
    }

    function refresh() {
        loadHistory();
        populateTags();
        applyFilters();
        render();
        return getState();
    }

    function loadHistory() {
        const profileId = getActiveProfileId();
        if (!profileId) {
            state.history = [];
            return;
        }
        const result = window.PromptHistoryService.list({
            profileId,
            limit: Number.MAX_SAFE_INTEGER
        });
        state.history = clone(result.items || []);
    }

    function populateTags() {
        const select = root?.querySelector(SELECTORS.tags);
        if (!select) return;
        const tags = [...new Set(state.history.flatMap(item => item.tags || []))].sort((a, b) => a.localeCompare(b, "es"));
        const current = state.tag;
        select.innerHTML = `<option value="">Todas</option>${tags.map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("")}`;
        select.value = tags.includes(current) ? current : "";
        if (current && !tags.includes(current)) state.tag = "";
    }

    function applyFilters() {
        let items = [...state.history];
        const search = state.search.trim().toLowerCase();
        if (search) {
            items = items.filter(item => [item.title, item.notes, item.provider, item.prompt]
                .some(value => String(value || "").toLowerCase().includes(search)));
        }
        if (state.provider) items = items.filter(item => item.provider === state.provider);
        if (state.level) items = items.filter(item => item.level === state.level);
        if (state.onlyFavorites) items = items.filter(item => item.favorite === true);
        if (state.tag) items = items.filter(item => (item.tags || []).includes(state.tag));
        state.filtered = items;
        state.totalItems = items.length;
        state.totalPages = Math.max(1, Math.ceil(items.length / state.pageSize));
        state.page = Math.min(Math.max(1, state.page), state.totalPages);
    }

    function render() {
        const counter = root?.querySelector(SELECTORS.counter);
        const empty = root?.querySelector(SELECTORS.empty);
        const list = root?.querySelector(SELECTORS.list);
        const pagination = root?.querySelector(SELECTORS.pagination);
        if (counter) counter.textContent = `${state.totalItems} ${state.totalItems === 1 ? "generación" : "generaciones"}`;
        if (empty) empty.hidden = state.totalItems !== 0;
        if (list) {
            list.innerHTML = "";
            currentPageItems().forEach(item => list.appendChild(createCard(item)));
        }
        renderPagination(pagination);
        emit(EVENTS.CHANGED, { total: state.totalItems, page: state.page, profileId: getActiveProfileId() });
    }

    function currentPageItems() {
        const start = (state.page - 1) * state.pageSize;
        return state.filtered.slice(start, start + state.pageSize);
    }

    function createCard(item) {
        const article = document.createElement("article");
        article.className = "card portrait-history-card";
        article.dataset.id = item.id;
        if (state.selected.has(item.id)) article.classList.add("selected");
        article.innerHTML = `
            <header class="card__header history-card-header">
                <div class="history-card-title">
                    <h3>${escapeHtml(item.title || `Versión ${item.version || ""}`)}</h3>
                    <small>${escapeHtml(buildMetadata(item))}</small>
                </div>
                <button type="button" class="button button--tertiary" data-history-action="favorite" title="Favorito">${item.favorite ? "★" : "☆"}</button>
            </header>
            <div class="card__body">
                <p class="history-preview">${escapeHtml(truncate(item.prompt || "", 300))}</p>
                <div class="history-tags">${(item.tags || []).map(tag => `<button type="button" class="history-tag" data-history-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}</div>
            </div>
            <footer class="card__footer history-footer">
                <button type="button" class="button button--secondary" data-history-action="restore">Restaurar</button>
                <button type="button" class="button button--secondary" data-history-action="compare">Comparar</button>
                <button type="button" class="button button--secondary" data-history-action="duplicate">Duplicar</button>
                <button type="button" class="button button--secondary" data-history-action="export">Exportar</button>
                <button type="button" class="button button--tertiary" data-history-action="delete">Eliminar</button>
            </footer>`;

        article.addEventListener("click", event => {
            const tagButton = event.target.closest("[data-history-tag]");
            if (tagButton) return setTag(tagButton.dataset.historyTag || "");
            const button = event.target.closest("[data-history-action]");
            if (!button) return;
            handleCardAction(button.dataset.historyAction, item);
        });
        return article;
    }

    function handleCardAction(action, item) {
        if (action === "favorite") window.PromptHistoryService.toggleFavorite(item.id);
        if (action === "restore") restoreHistoryEntry(item.id);
        if (action === "compare") toggleSelection(item.id);
        if (action === "duplicate") duplicateEntry(item);
        if (action === "export") exportEntry(item);
        if (action === "delete") {
            if (!window.confirm("¿Eliminar esta generación del historial?")) return;
            window.PromptHistoryService.remove(item.id);
        }
        refresh();
    }

    function renderPagination(container) {
        if (!container) return;
        container.innerHTML = "";
        if (state.totalPages <= 1) return;
        const previous = createButton("Anterior", () => previousPage());
        previous.disabled = state.page <= 1;
        container.appendChild(previous);
        const current = document.createElement("span");
        current.textContent = `${state.page} / ${state.totalPages}`;
        container.appendChild(current);
        const next = createButton("Siguiente", () => nextPage());
        next.disabled = state.page >= state.totalPages;
        container.appendChild(next);
    }

    function createButton(label, handler) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button button--tertiary";
        button.textContent = label;
        button.addEventListener("click", handler);
        return button;
    }

    function restoreHistoryEntry(id) {
        if (!window.PromptBinding?.restoreHistoryEntry) return null;
        const result = window.PromptBinding.restoreHistoryEntry(id);
        emit(EVENTS.RESTORED, { id, profileId: getActiveProfileId() });
        return result;
    }

    function toggleSelection(id) {
        if (state.selected.has(id)) state.selected.delete(id);
        else {
            if (state.selected.size >= 2) state.selected.delete(state.selected.values().next().value);
            state.selected.add(id);
        }
        render();
        if (state.selected.size === 2) compareSelection();
    }

    function compareSelection() {
        const ids = [...state.selected];
        if (ids.length !== 2) return null;
        const first = window.PromptHistoryService.getById(ids[0]);
        const second = window.PromptHistoryService.getById(ids[1]);
        if (!first || !second || first.profileId !== getActiveProfileId() || second.profileId !== getActiveProfileId()) return null;
        const comparison = window.PromptHistoryService.compare(first.id, second.id);
        renderDiff(comparison);
        emit(EVENTS.COMPARE, comparison);
        return comparison;
    }

    function renderDiff(diff) {
        const viewer = root?.querySelector(SELECTORS.diff);
        if (!viewer) return;
        viewer.hidden = false;
        viewer.innerHTML = `<header class="card__header"><div><h3>Comparación de versiones</h3></div></header><div class="card__body"><strong>${Number(diff?.statistics?.similarity || 0)}% similitud</strong><pre class="history-diff">${escapeHtml(diff?.diffText || diff?.diff || "")}</pre></div>`;
    }

    function exportEntry(entry) {
        window.PromptExportService?.exportHistoryEntry?.(entry, { format: "json", download: true });
    }

    function exportSelection() {
        const profileId = getActiveProfileId();
        const entries = [...state.selected]
            .map(id => window.PromptHistoryService.getById(id))
            .filter(entry => entry && entry.profileId === profileId);
        return window.PromptExportService?.exportHistory?.(entries, { format: "json", download: true });
    }

    function duplicateEntry(entry) {
        if (!entry || entry.profileId !== getActiveProfileId()) return null;
        const duplicate = clone(entry);
        delete duplicate.id;
        duplicate.title = `${entry.title || "Versión"} (copia)`;
        duplicate.createdAt = new Date().toISOString();
        duplicate.updatedAt = duplicate.createdAt;
        return window.PromptHistoryService.add(duplicate, { skipDuplicate: false });
    }

    function renameEntry(id) {
        const entry = window.PromptHistoryService.getById(id);
        if (!entry || entry.profileId !== getActiveProfileId()) return null;
        const title = window.prompt("Nuevo título", entry.title || "");
        if (!title) return null;
        const result = window.PromptHistoryService.rename(id, title);
        refresh();
        return result;
    }

    function addTag(id, tag) {
        const entry = window.PromptHistoryService.getById(id);
        if (!entry || entry.profileId !== getActiveProfileId()) return null;
        const result = window.PromptHistoryService.addTag(id, tag);
        refresh();
        return result;
    }

    function removeTag(id, tag) {
        const entry = window.PromptHistoryService.getById(id);
        if (!entry || entry.profileId !== getActiveProfileId()) return null;
        const result = window.PromptHistoryService.removeTag(id, tag);
        refresh();
        return result;
    }

    function updateNotes(id, notes) {
        const entry = window.PromptHistoryService.getById(id);
        if (!entry || entry.profileId !== getActiveProfileId()) return null;
        const result = window.PromptHistoryService.setNotes(id, notes);
        refresh();
        return result;
    }

    function setSearch(value) { state.search = String(value || ""); syncControl(SELECTORS.search, state.search); state.page = 1; applyFilters(); render(); }
    function setProvider(value) { state.provider = String(value || ""); syncControl(SELECTORS.provider, state.provider); state.page = 1; applyFilters(); render(); }
    function setLevel(value) { state.level = String(value || ""); syncControl(SELECTORS.level, state.level); state.page = 1; applyFilters(); render(); }
    function setTag(value) { state.tag = String(value || ""); syncControl(SELECTORS.tags, state.tag); state.page = 1; applyFilters(); render(); }
    function syncControl(selector, value) { const element = root?.querySelector(selector); if (element) element.value = value; }

    function clearFilters() {
        state.search = "";
        state.provider = "";
        state.level = "";
        state.tag = "";
        state.onlyFavorites = false;
        state.page = 1;
        syncControl(SELECTORS.search, "");
        syncControl(SELECTORS.provider, "");
        syncControl(SELECTORS.level, "");
        syncControl(SELECTORS.tags, "");
        const favorite = root?.querySelector(SELECTORS.favorites);
        if (favorite) favorite.checked = false;
        applyFilters();
        render();
    }

    function nextPage() { if (state.page < state.totalPages) { state.page += 1; render(); } }
    function previousPage() { if (state.page > 1) { state.page -= 1; render(); } }
    function goToPage(page) { state.page = Math.min(Math.max(1, Number(page) || 1), state.totalPages); render(); }
    function clearSelection() { state.selected.clear(); render(); }
    function reset() { state = createState(); if (initialized) refresh(); }

    function getState() {
        return {
            initialized,
            profileId: getActiveProfileId(),
            search: state.search,
            provider: state.provider,
            level: state.level,
            tag: state.tag,
            onlyFavorites: state.onlyFavorites,
            page: state.page,
            pageSize: state.pageSize,
            totalPages: state.totalPages,
            totalItems: state.totalItems,
            selected: [...state.selected]
        };
    }

    function getHistory() { return clone(state.history); }
    function getFilteredHistory() { return clone(state.filtered); }
    function getSelection() { return [...state.selected]; }
    function isInitialized() { return initialized; }

    function buildMetadata(item) {
        return [item.provider, item.level, item.createdAt ? new Date(item.createdAt).toLocaleString("es-ES") : ""].filter(Boolean).join(" • ");
    }
    function truncate(value, length) { const text = String(value || ""); return text.length > length ? `${text.slice(0, length)}…` : text; }
    function clone(value) { return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
    function escapeHtml(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
    function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }

    function api() {
        return Object.freeze({
            VERSION, EVENTS, init, destroy, isInitialized, refresh, reset,
            getState, getHistory, getFilteredHistory, getSelection,
            setSearch, setProvider, setLevel, setTag, clearFilters,
            nextPage, previousPage, goToPage, compareSelection,
            restoreHistoryEntry, exportSelection, clearSelection,
            renameEntry, addTag, removeTag, updateNotes, duplicateEntry
        });
    }

    return api();
})();

window.HistoryBinding = HistoryBinding;
