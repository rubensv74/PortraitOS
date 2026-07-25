"use strict";

/* ============================================================
   PortraitOS
   Knowledge Pack Workspace Binding
   ============================================================ */

const KnowledgeBinding = (() => {
    const SELECTORS = Object.freeze({
        workspace: "[data-knowledge-workspace]",
        select: "[data-knowledge-pack-select]",
        grid: "[data-knowledge-pack-grid]",
        search: "[data-knowledge-search]",
        filter: "[data-knowledge-filter]",
        empty: "[data-knowledge-empty]",
        summary: "[data-knowledge-active-summary]",
        detail: "[data-knowledge-detail]"
    });

    let initialized = false;
    let rootElement = null;
    let elements = {};
    let selectedForDetail = null;

    function init(root = document) {
        validateDependencies();
        rootElement = root.querySelector(SELECTORS.workspace);
        if (!rootElement) return getState();

        elements = {
            select: rootElement.querySelector(SELECTORS.select),
            grid: rootElement.querySelector(SELECTORS.grid),
            search: rootElement.querySelector(SELECTORS.search),
            filter: rootElement.querySelector(SELECTORS.filter),
            empty: rootElement.querySelector(SELECTORS.empty),
            summary: rootElement.querySelector(SELECTORS.summary),
            detail: rootElement.querySelector(SELECTORS.detail)
        };

        if (!initialized) {
            rootElement.addEventListener("click", handleClick);
            elements.search?.addEventListener("input", render);
            elements.filter?.addEventListener("change", render);
            elements.select?.addEventListener("change", handleLegacySelect);
            subscribe("profile-manager:changed", handleProfileChanged);
            subscribe("profile:loaded", handleProfileChanged);
            subscribe("profile:imported", handleProfileChanged);
            subscribe("knowledge-pack:changed", render);
            initialized = true;
        }

        render();
        return getState();
    }

    function render() {
        if (!rootElement) return;
        const profile = getActiveProfile();
        const selectedId = KnowledgePackService.getSelectedId(profile);
        const packs = KnowledgePackService.search(elements.search?.value || "", {
            filter: elements.filter?.value || "all",
            profile
        });

        syncLegacySelect(profile, selectedId);
        elements.grid.innerHTML = packs.map(pack => renderCard(pack, selectedId)).join("");
        elements.empty.hidden = packs.length > 0;

        const activePack = KnowledgePackService.get(selectedId, profile);
        if (!selectedForDetail || !KnowledgePackService.get(selectedForDetail, profile)) selectedForDetail = selectedId;
        updateSummary(activePack);
        updateDetail(KnowledgePackService.get(selectedForDetail || selectedId, profile), selectedId);
    }

    function renderCard(pack, selectedId) {
        const active = pack.id === selectedId;
        return `
            <article class="knowledge-pack${active ? " is-active" : ""}${pack.compatible ? "" : " is-incompatible"}" data-knowledge-pack-id="${escapeHtml(pack.id)}">
                <button type="button" class="knowledge-pack__surface" data-action="knowledge-inspect" data-pack-id="${escapeHtml(pack.id)}" aria-label="Ver detalles de ${escapeHtml(pack.name)}">
                    <span class="knowledge-pack__category">${escapeHtml(pack.category)}</span>
                    <span class="knowledge-pack__status">${active ? "Activo" : pack.compatible ? "Disponible" : "No compatible"}</span>
                    <strong>${escapeHtml(pack.name)}</strong>
                    <span class="knowledge-pack__description">${escapeHtml(pack.description)}</span>
                    <span class="knowledge-pack__version">v${escapeHtml(pack.version)}</span>
                </button>
                <button type="button" class="button ${active ? "button--secondary" : "button--primary"} knowledge-pack__action" data-action="knowledge-select" data-pack-id="${escapeHtml(pack.id)}" ${pack.compatible ? "" : "disabled"}>
                    ${active ? "Seleccionado" : "Activar pack"}
                </button>
            </article>`;
    }

    function handleClick(event) {
        const action = event.target.closest("[data-action]");
        if (!action) return;
        const packId = action.dataset.packId;
        if (action.dataset.action === "knowledge-inspect") {
            selectedForDetail = packId;
            updateDetail(KnowledgePackService.get(packId, getActiveProfile()), KnowledgePackService.getSelectedId(getActiveProfile()));
            return;
        }
        if (action.dataset.action === "knowledge-select") activate(packId);
    }

    function activate(packId) {
        const profile = getActiveProfile();
        const pack = KnowledgePackService.get(packId, profile);
        if (!pack.compatible) return;
        selectedForDetail = pack.id;
        KnowledgePackService.select(pack.id, profile);
        render();
        notify(`Knowledge Pack «${pack.name}» activado.`, "success");
    }

    function handleLegacySelect() { activate(elements.select.value); }
    function handleProfileChanged() { selectedForDetail = null; render(); }

    function syncLegacySelect(profile, selectedId) {
        if (!elements.select) return;
        elements.select.innerHTML = KnowledgePackService.list(profile)
            .map(pack => `<option value="${escapeHtml(pack.id)}">${escapeHtml(pack.name)}</option>`).join("");
        elements.select.value = selectedId;
    }

    function updateSummary(pack) {
        if (!elements.summary) return;
        const strong = elements.summary.querySelector("strong");
        if (strong) strong.textContent = pack.name;
    }

    function updateDetail(pack, selectedId) {
        if (!elements.detail) return;
        setText("[data-knowledge-detail-name]", pack.name);
        setText("[data-knowledge-pack-description]", pack.description);
        setText("[data-knowledge-detail-version]", pack.version);
        setText("[data-knowledge-detail-compatibility]", pack.compatible ? "Compatible" : "No compatible");
        setText("[data-knowledge-detail-status]", pack.id === selectedId ? "Activo" : "Disponible");
    }

    function setText(selector, value) {
        const node = elements.detail.querySelector(selector);
        if (node) node.textContent = value;
    }

    function subscribe(name, handler) {
        if (window.AppEvents?.on) AppEvents.on(name, handler);
        else window.addEventListener(name, handler);
    }

    function notify(message, type) {
        if (window.UI?.notify) UI.notify(message, type);
    }

    function getActiveProfile() { return window.ProfileService?.getActive?.() || null; }
    function validateDependencies() { if (!window.KnowledgePackService) throw new Error("Falta KnowledgePackService."); }
    function getState() { return { initialized, selectedId: window.KnowledgePackService?.getSelectedId?.(getActiveProfile()) || "none" }; }
    function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

    return Object.freeze({ init, render, getState });
})();

window.KnowledgeBinding = KnowledgeBinding;
