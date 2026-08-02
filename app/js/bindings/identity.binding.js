"use strict";

/* ============================================================
   PortraitOS — Identity Binding
   Sprint 041
   ------------------------------------------------------------
   Conecta el formulario de identidad con ProfileIdentity sin
   duplicar el modelo de dominio. El formulario usa rutas de UI
   y este binding las traduce al contrato real del servicio.
   ============================================================ */

const IdentityBinding = (() => {
    const FIELD_SELECTOR = "[data-identity-field]";
    const AUTOSAVE_DELAY = 650;

    const PATH_MAP = Object.freeze({
        summary: { type: "general", key: "summary" },
        "general.age": { type: "general", key: "ageAppearance" },
        "face.shape": { type: "section", section: "face", key: "description", prefix: "Forma del rostro: " },
        "face.proportions": { type: "section", section: "face", key: "notes", prefix: "Proporciones: " },
        "asymmetries.description": { type: "section", section: "asymmetries", key: "description" },
        "skin.description": { type: "section", section: "skin", key: "description" },
        "age-markers.description": { type: "section", section: "age-markers", key: "description" },
        "hair.description": { type: "section", section: "hair", key: "description" },
        "facial-hair.description": { type: "section", section: "facial-hair", key: "description" },
        "eyes.description": { type: "section", section: "eyes", key: "description" },
        "nose.description": { type: "section", section: "nose", key: "description" },
        "mouth.description": { type: "section", section: "mouth", key: "description" },
        "jaw.description": { type: "section", section: "jaw", key: "description" },
        "distinctive-features.description": { type: "section", section: "distinctive-features", key: "description" }
    });

    let initialized = false;
    let fields = [];
    let timer = null;
    let syncing = false;
    let subscriptions = [];

    function init() {
        if (initialized) return getState();
        requireDependencies();
        fields = [...document.querySelectorAll(FIELD_SELECTOR)];
        fields.forEach(field => {
            field.addEventListener("input", onInput);
            field.addEventListener("blur", onBlur);
        });
        document.querySelector("[data-action='identity-validate']")?.addEventListener("click", validate);
        document.querySelector("[data-action='identity-lock']")?.addEventListener("click", lock);
        document.querySelector("[data-action='identity-unlock']")?.addEventListener("click", unlock);
        bindEvents();
        load();
        initialized = true;
        emit("binding:identity-ready", getState());
        return getState();
    }

    function load() {
        const identity = ProfileService.identity.get();
        syncing = true;
        fields.forEach(field => {
            field.value = readValue(identity, field.dataset.identityField) || "";
            field.disabled = identity.locked === true;
            field.classList.remove("is-invalid", "is-valid", "is-dirty");
            field.removeAttribute("aria-invalid");
        });
        syncing = false;
        render(identity);
        return identity;
    }

    function onInput(event) {
        if (syncing) return;
        const identity = ProfileService.identity.get();
        if (identity.locked) {
            load();
            notify("La identidad está bloqueada.", "warning");
            return;
        }
        writeValue(event.currentTarget.dataset.identityField, event.currentTarget.value);
        event.currentTarget.classList.add("is-dirty");
        scheduleSave();
        render(ProfileService.identity.get());
    }

    function onBlur(event) {
        validateField(event.currentTarget);
    }

    function writeValue(path, rawValue) {
        const map = PATH_MAP[path];
        if (!map) return;
        const value = String(rawValue || "").trim();
        if (map.type === "general") {
            ProfileService.identity.updateGeneral({ [map.key]: value });
            return;
        }
        const current = ProfileService.identity.getSection(map.section);
        let description = current.description || "";
        if (map.section === "face") {
            const shape = String(document.querySelector('[data-identity-field="face.shape"]')?.value || "").trim();
            const proportions = String(document.querySelector('[data-identity-field="face.proportions"]')?.value || "").trim();
            description = [shape ? `Forma del rostro: ${shape}` : "", proportions ? `Proporciones: ${proportions}` : ""].filter(Boolean).join("\n");
        } else {
            description = value;
        }
        ProfileService.identity.updateSection(map.section, { description });
    }

    function readValue(identity, path) {
        const map = PATH_MAP[path];
        if (!map) return "";
        if (map.type === "general") return identity[map.key] || "";
        const section = identity.sections?.[map.section] || {};
        const description = section.description || "";
        if (path === "face.shape") return extractLine(description, "Forma del rostro:");
        if (path === "face.proportions") return extractLine(description, "Proporciones:");
        return description;
    }

    function extractLine(value, prefix) {
        const line = String(value || "").split(/\r?\n/).find(item => item.trim().startsWith(prefix));
        return line ? line.trim().slice(prefix.length).trim() : "";
    }

    function validateField(field) {
        const required = ["summary", "general.age", "face.shape", "skin.description", "eyes.description", "nose.description", "mouth.description", "jaw.description", "hair.description", "distinctive-features.description"].includes(field.dataset.identityField);
        const valid = !required || String(field.value || "").trim().length >= 3;
        field.classList.toggle("is-invalid", !valid);
        field.classList.toggle("is-valid", valid && Boolean(String(field.value || "").trim()));
        field.setAttribute("aria-invalid", String(!valid));
        return valid;
    }

    function validate() {
        const localValid = fields.every(validateField);
        if (!localValid) {
            notify("Completa los campos obligatorios antes de validar.", "warning");
            return { valid: false };
        }
        try {
            const identity = ProfileService.identity.validate("PortraitOS Studio");
            saveNow();
            render(identity);
            notify("Identidad validada correctamente.", "success");
            emit("identity:validated", { identity });
            return { valid: true, identity };
        } catch (error) {
            notify(error.message || "No se pudo validar la identidad.", "warning");
            return { valid: false, error };
        }
    }

    function lock() {
        try {
            const identity = ProfileService.identity.lock("PortraitOS Studio");
            saveNow();
            load();
            notify("Identidad bloqueada.", "success");
            emit("identity:locked", { identity });
            return identity;
        } catch (error) {
            notify(error.message || "Valida la identidad antes de bloquearla.", "warning");
            return null;
        }
    }

    function unlock() {
        try {
            const identity = ProfileService.identity.unlock({ confirm: true, reason: "Edición desde Identity Workspace" });
            saveNow();
            load();
            notify("Identidad desbloqueada para revisión.", "success");
            emit("identity:unlocked", { identity });
            return identity;
        } catch (error) {
            notify(error.message || "No se pudo desbloquear la identidad.", "warning");
            return null;
        }
    }

    function scheduleSave() {
        window.clearTimeout(timer);
        timer = window.setTimeout(saveNow, AUTOSAVE_DELAY);
    }

    function saveNow() {
        window.clearTimeout(timer);
        timer = null;
        if (window.ProfileManager?.saveActive) ProfileManager.saveActive();
        fields.forEach(field => field.classList.remove("is-dirty"));
        emit("identity:autosaved", { identity: ProfileService.identity.get() });
        return true;
    }

    function render(identity) {
        const completeness = Number(identity.validation?.completeness || 0);
        const status = document.querySelector("[data-identity-status]");
        const meter = document.querySelector("[data-identity-completeness]");
        const lockButton = document.querySelector("[data-action='identity-lock']");
        const unlockButton = document.querySelector("[data-action='identity-unlock']");
        if (meter) meter.textContent = `${completeness} % completado`;
        if (status) {
            status.textContent = identity.locked ? "Identidad bloqueada" : identity.status === "validated" ? "Validada" : completeness >= 70 ? "Lista para validar" : completeness ? `Borrador · ${completeness} %` : "Borrador";
        }
        if (lockButton) lockButton.hidden = identity.locked === true;
        if (unlockButton) unlockButton.hidden = identity.locked !== true;
        fields.forEach(field => field.disabled = identity.locked === true);
    }

    function bindEvents() {
        if (!window.AppEvents?.on) return;
        ["profile:loaded", "profile-manager:changed", "profile:imported", "photos:changed"].forEach(name => {
            const unsubscribe = AppEvents.on(name, load);
            if (typeof unsubscribe === "function") subscriptions.push(unsubscribe);
        });
    }

    function getState() {
        const identity = ProfileService.identity.get();
        return { initialized, fieldCount: fields.length, locked: identity.locked === true, completeness: identity.validation?.completeness || 0 };
    }

    function notify(message, type) {
        if (window.UI?.notify) UI.notify(message, type);
        else console[type === "warning" ? "warn" : "log"](message);
    }

    function emit(name, detail) {
        if (window.AppEvents?.emit) AppEvents.emit(name, detail);
        else window.dispatchEvent(new CustomEvent(name, { detail }));
    }

    function requireDependencies() {
        if (!window.ProfileService?.identity) throw new Error("ProfileService.identity no está disponible.");
    }

    return Object.freeze({ init, load, validate, lock, unlock, save: saveNow, getState });
})();

window.IdentityBinding = IdentityBinding;
