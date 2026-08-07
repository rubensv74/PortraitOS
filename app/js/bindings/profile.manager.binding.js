"use strict";

const ProfileManagerBinding = (() => {
    let initialized = false;
    let root = document;
    let subscriptions = [];
    let historyRuntimePromise = null;

    function init(options = {}) {
        if (initialized) {
            ensureHistoryRuntime().catch(reportHistoryRuntimeError);
            return ProfileManager.getState();
        }
        root = options.root || document;
        validateDependencies();
        root.addEventListener("click", handleClick);
        root.addEventListener("change", handleChange);
        if (window.AppEvents?.on) {
            ["profile-manager:changed", "profile:updated", "profile:loaded"].forEach(name => {
                subscriptions.push(AppEvents.on(name, render));
            });
        }
        const state = ProfileManager.init();
        render();
        initialized = true;
        ensureHistoryRuntime().catch(reportHistoryRuntimeError);
        return state;
    }

    function ensureHistoryRuntime() {
        if (window.HistoryBinding) {
            window.HistoryBinding.init();
            return Promise.resolve(window.HistoryBinding);
        }
        if (historyRuntimePromise) return historyRuntimePromise;

        historyRuntimePromise = new Promise((resolve, reject) => {
            const existing = document.querySelector("script[data-portraitos-history-binding]");
            if (existing) {
                const finish = () => {
                    if (!window.HistoryBinding) return reject(new Error("HistoryBinding no quedó disponible tras cargar el script."));
                    window.HistoryBinding.init();
                    resolve(window.HistoryBinding);
                };
                if (existing.dataset.loaded === "true") finish();
                else {
                    existing.addEventListener("load", finish, { once: true });
                    existing.addEventListener("error", () => reject(new Error("No se pudo cargar HistoryBinding.")), { once: true });
                }
                return;
            }

            const script = document.createElement("script");
            script.src = "js/bindings/history.binding.js";
            script.async = false;
            script.dataset.portraitosHistoryBinding = "";
            script.addEventListener("load", () => {
                script.dataset.loaded = "true";
                try {
                    if (!window.HistoryBinding) throw new Error("HistoryBinding no expuso su API global.");
                    window.HistoryBinding.init();
                    document.documentElement.setAttribute("data-history-runtime-ready", "true");
                    resolve(window.HistoryBinding);
                } catch (error) {
                    reject(error);
                }
            }, { once: true });
            script.addEventListener("error", () => reject(new Error("No se pudo cargar js/bindings/history.binding.js.")), { once: true });
            document.head.appendChild(script);
        }).catch(error => {
            historyRuntimePromise = null;
            throw error;
        });

        return historyRuntimePromise;
    }

    function reportHistoryRuntimeError(error) {
        console.error("PortraitOS: History runtime no pudo inicializarse.", error);
        window.AppEvents?.emit?.("app:error", {
            code: "HISTORY_RUNTIME_FAILED",
            message: "No se pudo inicializar el historial de generaciones.",
            error
        });
    }

    function handleChange(event) {
        const select = event.target.closest("[data-profile-manager-select]");
        if (!select) return;
        run(() => ProfileManager.select(select.value), "Perfil activo cambiado.");
    }

    function handleClick(event) {
        const action = event.target.closest("[data-profile-manager-action]");
        if (!action) return;
        const type = action.dataset.profileManagerAction;
        const active = ProfileManager.getState().activeProfileId;
        if (type === "create") run(() => ProfileManager.create(), "Perfil creado.");
        if (type === "duplicate") run(() => ProfileManager.duplicate(active), "Perfil duplicado.");
        if (type === "rename") {
            const current = ProfileService.getActive();
            const name = window.prompt("Nuevo nombre del perfil", current?.name || "");
            if (name !== null) run(() => ProfileManager.rename(active, name), "Perfil renombrado.");
        }
        if (type === "delete") {
            const current = ProfileService.getActive();
            if (window.confirm(`¿Eliminar el perfil «${current?.name || "Perfil"}»?`)) {
                run(() => ProfileManager.remove(active), "Perfil eliminado.");
            }
        }
    }

    function run(operation, message) {
        try {
            operation();
            render();
            window.HistoryBinding?.refresh?.();
            window.UI?.notify?.(message, { type: "success" });
        } catch (error) {
            window.UI?.notify?.(error.message, { type: "error", title: "Profile Manager" });
            if (!window.UI?.notify) console.error(error);
        }
    }

    function render() {
        const select = root.querySelector("[data-profile-manager-select]");
        const count = root.querySelector("[data-profile-manager-count]");
        if (!select) return;
        const state = ProfileManager.getState();
        select.innerHTML = state.profiles.map(profile =>
            `<option value="${escapeHtml(profile.id)}"${profile.active ? " selected" : ""}>${escapeHtml(profile.name)}</option>`
        ).join("");
        if (count) count.textContent = `${state.profiles.length} ${state.profiles.length === 1 ? "perfil" : "perfiles"}`;
        const deleteButton = root.querySelector("[data-profile-manager-action='delete']");
        if (deleteButton) deleteButton.disabled = state.profiles.length <= 1;
    }

    function validateDependencies() {
        if (!window.ProfileManager || !window.ProfileService) throw new Error("Faltan dependencias de Profile Manager.");
    }
    function escapeHtml(value) { return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }

    return Object.freeze({ init, render, ensureHistoryRuntime });
})();

window.ProfileManagerBinding = ProfileManagerBinding;
