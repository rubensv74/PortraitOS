"use strict";

const ProfileManagerBinding = (() => {
    let initialized = false;
    let root = document;
    let subscriptions = [];

    function init(options = {}) {
        if (initialized) return ProfileManager.getState();
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
        return state;
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

    return Object.freeze({ init, render });
})();

window.ProfileManagerBinding = ProfileManagerBinding;
