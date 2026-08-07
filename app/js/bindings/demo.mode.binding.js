"use strict";

const DemoModeBinding = (() => {
    let initialized = false;
    let running = false;
    let host = null;

    function init() {
        if (initialized) {
            render();
            return getState();
        }
        if (!window.DemoModeService) throw new Error("DemoModeBinding requiere DemoModeService.");

        host = ensureControls();
        host.addEventListener("click", handleClick);
        initialized = true;
        document.documentElement.setAttribute("data-demo-mode-ready", "true");
        render();
        return getState();
    }

    function ensureControls() {
        const existing = document.querySelector("[data-demo-mode-controls]");
        if (existing) return existing;

        const headerActions = document.querySelector(".app-header__actions");
        if (!headerActions) throw new Error("No se encontró el área de acciones principal.");

        const wrapper = document.createElement("div");
        wrapper.className = "demo-mode-controls";
        wrapper.dataset.demoModeControls = "";
        wrapper.innerHTML = `
            <button type="button" class="button button--secondary" data-demo-action="prepare">Demo RC1</button>
            <button type="button" class="button button--tertiary" data-demo-action="remove" hidden>Eliminar demo</button>
            <span class="demo-mode-controls__status" data-demo-status aria-live="polite"></span>
        `;
        headerActions.prepend(wrapper);
        return wrapper;
    }

    async function handleClick(event) {
        const button = event.target.closest("[data-demo-action]");
        if (!button || !host.contains(button) || running) return;

        if (button.dataset.demoAction === "prepare") {
            const ok = window.confirm(
                "Se creará o reutilizará un perfil Demo RC1 con datos e imágenes sintéticas. No se modificarán tus perfiles reales. ¿Continuar?"
            );
            if (!ok) return;
            await prepareDemo();
        }

        if (button.dataset.demoAction === "remove") {
            const ok = window.confirm(
                "Se eliminará únicamente el perfil Demo RC1. Los demás perfiles no se modificarán. ¿Continuar?"
            );
            if (!ok) return;
            removeDemo();
        }
    }

    async function prepareDemo() {
        running = true;
        render();
        try {
            const result = await DemoModeService.prepare({
                onProgress(step, message) {
                    setStatus(message || step);
                }
            });
            window.HistoryBinding?.refresh?.();
            window.PromptOrientationBinding?.refresh?.();
            window.ProfileManagerBinding?.render?.();
            window.UI?.render?.();
            setStatus(result.reused ? "Demo existente seleccionada." : "Demo RC1 preparada.");
            window.UI?.notify?.(
                result.reused
                    ? "Se ha seleccionado el perfil Demo RC1 existente."
                    : "Demo RC1 preparada correctamente.",
                { type: "success", title: "Demo Mode" }
            );
            document.querySelector("[data-wizard-step='prompt']")?.click();
        } catch (error) {
            setStatus(`Error: ${error.message}`);
            window.UI?.notify?.(error.message, { type: "error", title: "Demo Mode" });
            if (!window.UI?.notify) console.error(error);
        } finally {
            running = false;
            render();
        }
    }

    function removeDemo() {
        running = true;
        render();
        try {
            const result = DemoModeService.remove();
            window.ProfileManagerBinding?.render?.();
            window.HistoryBinding?.refresh?.();
            setStatus(result.removed ? "Demo eliminada." : "No existe una demo activa.");
            window.UI?.notify?.(
                result.removed ? "Perfil Demo RC1 eliminado." : "No existe un perfil Demo RC1.",
                { type: result.removed ? "success" : "info", title: "Demo Mode" }
            );
        } catch (error) {
            setStatus(`Error: ${error.message}`);
            window.UI?.notify?.(error.message, { type: "error", title: "Demo Mode" });
        } finally {
            running = false;
            render();
        }
    }

    function render() {
        if (!host) return;
        const state = DemoModeService.getState();
        const prepare = host.querySelector("[data-demo-action='prepare']");
        const remove = host.querySelector("[data-demo-action='remove']");
        if (prepare) {
            prepare.disabled = running;
            prepare.textContent = running ? "Preparando demo…" : state.exists ? "Abrir Demo RC1" : "Demo RC1";
        }
        if (remove) {
            remove.hidden = !state.exists;
            remove.disabled = running;
        }
        if (!running && state.exists) setStatus("Demo disponible");
        if (!running && !state.exists) setStatus("");
    }

    function setStatus(message) {
        const target = host?.querySelector("[data-demo-status]");
        if (target) target.textContent = message || "";
    }

    function getState() {
        return Object.freeze({
            initialized,
            running,
            service: window.DemoModeService?.getState?.() || null
        });
    }

    return Object.freeze({ init, render, getState });
})();

window.DemoModeBinding = DemoModeBinding;
