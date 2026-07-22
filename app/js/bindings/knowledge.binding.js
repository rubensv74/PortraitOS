"use strict";

/* ============================================================
   PortraitOS
   Knowledge Pack Binding
   ============================================================ */

const KnowledgeBinding = (() => {
    const SELECTOR = "[data-knowledge-pack-select]";
    let initialized = false;
    let selectElement = null;

    function init(root = document) {
        if (initialized) {
            render();
            return getState();
        }

        if (!window.KnowledgePackService) {
            throw new Error("Falta KnowledgePackService.");
        }

        selectElement = root.querySelector(SELECTOR);
        if (selectElement) {
            selectElement.addEventListener("change", handleChange);
            render();
        }

        initialized = true;
        return getState();
    }

    function render() {
        if (!selectElement) {
            return;
        }

        const packs = KnowledgePackService.list();
        selectElement.innerHTML = packs
            .map(pack => `<option value="${escapeHtml(pack.id)}">${escapeHtml(pack.name)}</option>`)
            .join("");
        selectElement.value = KnowledgePackService.getSelectedId();
        updateDescription();
    }

    function handleChange() {
        KnowledgePackService.select(selectElement.value);
        updateDescription();
    }

    function updateDescription() {
        const description = document.querySelector("[data-knowledge-pack-description]");
        if (!description) {
            return;
        }
        description.textContent = KnowledgePackService.get(selectElement.value).description;
    }

    function getState() {
        return {
            initialized,
            selectedId: KnowledgePackService.getSelectedId()
        };
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    return Object.freeze({ init, render, getState });
})();

window.KnowledgeBinding = KnowledgeBinding;
