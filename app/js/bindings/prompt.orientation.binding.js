"use strict";

const PromptOrientationBinding = (() => {
    const ROOT_SELECTOR = "[data-step-panel='prompt']";
    const NAV_MARKER = "data-prompt-orientation";
    const SECTIONS = Object.freeze([
        { id: "generate", label: "Generar", selector: ".prompt-workspace-controls" },
        { id: "history", label: "Historial", selector: "[data-history]" },
        { id: "export", label: "Exportar", selector: ".export-studio" },
        { id: "review", label: "Revisar", selector: ".review-studio" }
    ]);

    let initialized = false;
    let root = null;
    let nav = null;
    let observer = null;

    function init(options = {}) {
        if (initialized) return getState();

        root = (options.root || document).querySelector(ROOT_SELECTOR);
        if (!root) {
            throw createError("PROMPT_WORKSPACE_NOT_FOUND", "No se encontró el workspace de Generación.");
        }

        const available = SECTIONS.filter(item => root.querySelector(item.selector));
        if (!available.length) {
            throw createError("PROMPT_SECTIONS_NOT_FOUND", "No se encontraron secciones internas de Generación.");
        }

        nav = root.querySelector(`[${NAV_MARKER}]`) || createNavigation(available);
        bindNavigation();
        observeSections(available);

        initialized = true;
        root.setAttribute("data-prompt-orientation-ready", "true");
        return getState();
    }

    function destroy() {
        observer?.disconnect();
        observer = null;
        nav?.removeEventListener("click", handleClick);
        root?.removeAttribute("data-prompt-orientation-ready");
        initialized = false;
        root = null;
        nav = null;
        return true;
    }

    function createNavigation(items) {
        const element = document.createElement("nav");
        element.className = "prompt-orientation";
        element.setAttribute(NAV_MARKER, "");
        element.setAttribute("aria-label", "Áreas del paso Generación");
        element.innerHTML = items.map((item, index) => `
            <button
                type="button"
                class="prompt-orientation__item${index === 0 ? " is-active" : ""}"
                data-prompt-orientation-target="${item.id}"
                aria-current="${index === 0 ? "true" : "false"}"
            >
                <span class="prompt-orientation__index">0${index + 1}</span>
                <span>${item.label}</span>
            </button>
        `).join("");

        const heading = root.querySelector(":scope > .panel-heading");
        if (heading?.nextSibling) root.insertBefore(element, heading.nextSibling);
        else if (heading) root.appendChild(element);
        else root.prepend(element);
        return element;
    }

    function bindNavigation() {
        nav.addEventListener("click", handleClick);
    }

    function handleClick(event) {
        const button = event.target.closest("[data-prompt-orientation-target]");
        if (!button || !nav.contains(button)) return;
        const item = SECTIONS.find(section => section.id === button.dataset.promptOrientationTarget);
        const target = item ? root.querySelector(item.selector) : null;
        if (!target) return;
        setActive(item.id);
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        window.setTimeout(() => target.removeAttribute("tabindex"), 800);
    }

    function observeSections(items) {
        if (!("IntersectionObserver" in window)) return;
        observer = new IntersectionObserver(entries => {
            const visible = entries
                .filter(entry => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (!visible) return;
            const item = items.find(candidate => root.querySelector(candidate.selector) === visible.target);
            if (item) setActive(item.id);
        }, { rootMargin: "-20% 0px -65% 0px", threshold: [0.05, 0.25, 0.5] });

        items.forEach(item => {
            const section = root.querySelector(item.selector);
            if (section) observer.observe(section);
        });
    }

    function setActive(id) {
        nav.querySelectorAll("[data-prompt-orientation-target]").forEach(button => {
            const active = button.dataset.promptOrientationTarget === id;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-current", active ? "true" : "false");
        });
    }

    function getState() {
        return {
            initialized,
            ready: root?.getAttribute("data-prompt-orientation-ready") === "true",
            sections: nav ? nav.querySelectorAll("[data-prompt-orientation-target]").length : 0
        };
    }

    function createError(code, message) {
        const error = new Error(message);
        error.name = "PromptOrientationBindingError";
        error.code = code;
        return error;
    }

    return Object.freeze({ init, destroy, getState });
})();

window.PromptOrientationBinding = PromptOrientationBinding;
