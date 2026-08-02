"use strict";

/* PortraitOS — Identity Workspace binding. Domain calculations stay in ProfileIdentity. */
const IdentityBinding = (() => {
    const FIELD_SELECTOR = "[data-identity-field]";
    const AUTOSAVE_DELAY = 650;
    const PATH_MAP = Object.freeze({
        summary: { type: "general", key: "summary" },
        "general.age": { type: "general", key: "ageAppearance" },
        "face.shape": { type: "section", section: "face" },
        "face.proportions": { type: "section", section: "face" },
        "asymmetries.description": { type: "section", section: "asymmetries" },
        "skin.description": { type: "section", section: "skin" },
        "age-markers.description": { type: "section", section: "age-markers" },
        "hair.description": { type: "section", section: "hair" },
        "facial-hair.description": { type: "section", section: "facial-hair" },
        "eyes.description": { type: "section", section: "eyes" },
        "nose.description": { type: "section", section: "nose" },
        "mouth.description": { type: "section", section: "mouth" },
        "jaw.description": { type: "section", section: "jaw" },
        "distinctive-features.description": { type: "section", section: "distinctive-features" }
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
        document.querySelector("[data-identity-evidence-section]")?.addEventListener("change", renderEvidence);
        document.querySelector("[data-identity-evidence-photos]")?.addEventListener("click", handleEvidencePhotoAction);
        document.querySelector("[data-identity-evidence-list]")?.addEventListener("click", handleEvidenceListAction);
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

    function onBlur(event) { validateField(event.currentTarget); }

    function writeValue(path, rawValue) {
        const map = PATH_MAP[path];
        if (!map) return;
        const value = String(rawValue || "").trim();
        if (map.type === "general") {
            ProfileService.identity.updateGeneral({ [map.key]: value });
            return;
        }
        let description = value;
        if (map.section === "face") {
            const shape = String(document.querySelector('[data-identity-field="face.shape"]')?.value || "").trim();
            const proportions = String(document.querySelector('[data-identity-field="face.proportions"]')?.value || "").trim();
            description = [shape ? `Forma del rostro: ${shape}` : "", proportions ? `Proporciones: ${proportions}` : ""].filter(Boolean).join("\n");
        }
        ProfileService.identity.updateSection(map.section, { description });
    }

    function readValue(identity, path) {
        const map = PATH_MAP[path];
        if (!map) return "";
        if (map.type === "general") return identity[map.key] || "";
        const description = identity.sections?.[map.section]?.description || "";
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
        if (!fields.every(validateField)) {
            notify("Completa los campos obligatorios antes de validar.", "warning");
            return { valid: false };
        }
        try {
            const identity = ProfileService.identity.validate("PortraitOS Studio");
            render(identity);
            notify("Identidad validada correctamente.", "success");
            return { valid: true, identity };
        } catch (error) {
            notify(error.message || "No se pudo validar la identidad.", "warning");
            return { valid: false, error };
        }
    }

    async function lock() {
        const confirmed = await requestConfirmation({
            title: "Bloquear identidad",
            message: "El bloqueo impedirá editar rasgos y evidencias hasta que vuelvas a desbloquearla.",
            acceptLabel: "Bloquear"
        });
        if (!confirmed) return null;
        try {
            const identity = ProfileService.identity.lock({ confirm: true, lockedBy: "PortraitOS Studio" });
            notify("Identidad bloqueada.", "success");
            return identity;
        } catch (error) {
            notify(error.message || "Valida la identidad y su cobertura antes de bloquearla.", "warning");
            return null;
        }
    }

    async function unlock() {
        const confirmed = await requestConfirmation({
            title: "Desbloquear identidad",
            message: "La identidad volverá a estado de revisión y cualquier cambio actualizará Validation y Prompt Readiness.",
            acceptLabel: "Desbloquear"
        });
        if (!confirmed) return null;
        try {
            const identity = ProfileService.identity.unlock({ confirm: true, reason: "Edición desde Identity Workspace" });
            notify("Identidad desbloqueada para revisión.", "success");
            return identity;
        } catch (error) {
            notify(error.message || "No se pudo desbloquear la identidad.", "warning");
            return null;
        }
    }

    function handleEvidencePhotoAction(event) {
        const button = event.target.closest("[data-evidence-link-photo]");
        if (!button) return;
        const section = getSelectedEvidenceSection();
        const note = document.querySelector("[data-identity-evidence-note]")?.value || "";
        try {
            ProfileService.identity.linkEvidence(section, button.dataset.evidenceLinkPhoto, { note });
            const noteInput = document.querySelector("[data-identity-evidence-note]");
            if (noteInput) noteInput.value = "";
            notify("Evidencia vinculada.", "success");
        } catch (error) {
            notify(error.message || "No se pudo vincular la evidencia.", "warning");
        }
    }

    function handleEvidenceListAction(event) {
        const button = event.target.closest("[data-evidence-unlink-photo]");
        if (!button) return;
        try {
            ProfileService.identity.unlinkEvidence(getSelectedEvidenceSection(), button.dataset.evidenceUnlinkPhoto);
            notify("Evidencia desvinculada.", "success");
        } catch (error) {
            notify(error.message || "No se pudo desvincular la evidencia.", "warning");
        }
    }

    function render(identity) {
        const completeness = Number(identity.validation?.completeness || 0);
        const evidenceState = ProfileService.identity.getEvidenceState();
        setText("[data-identity-completeness]", `${completeness} % completado`);
        setText("[data-identity-coverage]", `${evidenceState.score} % cobertura`);
        setText("[data-identity-evidence-count]", String(evidenceState.totalEvidenceCount));
        setText("[data-identity-broken-count]", String(evidenceState.invalidEvidenceCount));
        const status = document.querySelector("[data-identity-status]");
        if (status) {
            status.textContent = evidenceState.invalidEvidenceCount
                ? "Evidencia rota"
                : identity.locked
                    ? "Identidad bloqueada"
                    : identity.status === "validated"
                        ? (evidenceState.readyForLock ? "Lista para bloquear" : "Validada · cobertura pendiente")
                        : completeness
                            ? `Borrador · ${completeness} %`
                            : "Borrador";
            status.dataset.status = evidenceState.invalidEvidenceCount
                ? "error"
                : identity.locked
                    ? "valid"
                    : "pending";
        }
        const lockButton = document.querySelector("[data-action='identity-lock']");
        const unlockButton = document.querySelector("[data-action='identity-unlock']");
        if (lockButton) {
            lockButton.hidden = identity.locked === true;
            lockButton.disabled = identity.status !== "validated" || !evidenceState.readyForLock;
        }
        if (unlockButton) unlockButton.hidden = identity.locked !== true;
        fields.forEach(field => { field.disabled = identity.locked === true; });
        renderEvidence();
    }

    function renderEvidence() {
        const section = getSelectedEvidenceSection();
        const identity = ProfileService.identity.get();
        const state = ProfileService.identity.getEvidenceState();
        const photos = ProfileService.photos.list();
        const linked = state.sections[section]?.evidence || [];
        const locked = identity.locked === true;
        const photoRoot = document.querySelector("[data-identity-evidence-photos]");
        const listRoot = document.querySelector("[data-identity-evidence-list]");
        if (!photoRoot || !listRoot) return;
        photoRoot.replaceChildren();
        listRoot.replaceChildren();

        if (!photos.length) photoRoot.append(createEmptyState("No hay fotografías disponibles.", "Importa evidencias en el paso Fotografías."));
        photos.forEach(photo => {
            const linkedRecord = linked.find(item => item.photoId === photo.id);
            const card = createElement("button", "identity-evidence-photo");
            card.type = "button";
            card.dataset.evidenceLinkPhoto = photo.id;
            card.disabled = locked || Boolean(linkedRecord);
            card.setAttribute("aria-pressed", String(Boolean(linkedRecord)));
            const image = createElement("img", "identity-evidence-photo__image");
            image.src = photo.thumbnail?.dataUrl || photo.source?.dataUrl || "";
            image.alt = photo.name || photo.filename || "Fotografía de evidencia";
            const name = createElement("strong");
            name.textContent = photo.name || photo.filename || "Fotografía";
            const meta = createElement("span");
            meta.textContent = photo.isPrimary ? "Principal" : linkedRecord ? "Vinculada" : "Disponible";
            card.append(image, name, meta);
            photoRoot.append(card);
        });

        if (!linked.length) listRoot.append(createEmptyState("Sin evidencia vinculada.", "Selecciona una fotografía de la biblioteca."));
        linked.forEach(record => {
            const row = createElement("article", "identity-evidence-record");
            row.dataset.integrity = record.integrity;
            const photo = photos.find(item => item.id === record.photoId);
            if (photo) {
                const image = createElement("img", "identity-evidence-record__image");
                image.src = photo.thumbnail?.dataUrl || photo.source?.dataUrl || "";
                image.alt = photo.name || photo.filename || "Evidencia";
                row.append(image);
            }
            const content = createElement("div", "identity-evidence-record__content");
            const name = createElement("strong");
            name.textContent = photo?.name || photo?.filename || `Referencia ${record.photoId}`;
            const status = createElement("span", "status-badge");
            status.dataset.status = record.integrity;
            status.textContent = integrityLabel(record.integrity);
            const note = createElement("small");
            note.textContent = record.note || "Sin nota";
            content.append(name, status, note);
            const remove = createElement("button", "button button--tertiary");
            remove.type = "button";
            remove.dataset.evidenceUnlinkPhoto = record.photoId;
            remove.disabled = locked;
            remove.textContent = "Desvincular";
            row.append(content, remove);
            listRoot.append(row);
        });
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
        emit("identity:updated", { operation: "edit", identity: ProfileService.identity.get(), evidenceState: ProfileService.identity.getEvidenceState() });
        return true;
    }

    function bindEvents() {
        if (!window.AppEvents?.on) return;
        ["profile:loaded", "profile-manager:changed", "profile:imported"].forEach(name => subscribe(name, load));
        ["photos:changed", "identity:evidence-updated"].forEach(name => subscribe(name, () => render(ProfileService.identity.get())));
        ["identity:locked", "identity:unlocked"].forEach(name => subscribe(name, load));
    }

    function subscribe(name, handler) {
        const unsubscribe = AppEvents.on(name, handler);
        if (typeof unsubscribe === "function") subscriptions.push(unsubscribe);
    }

    function getState() {
        const identity = ProfileService.identity.get();
        const evidenceState = ProfileService.identity.getEvidenceState();
        return { initialized, fieldCount: fields.length, locked: identity.locked === true, completeness: identity.validation?.completeness || 0, coverage: evidenceState.score, evidenceCount: evidenceState.totalEvidenceCount, invalidEvidenceCount: evidenceState.invalidEvidenceCount, readyForLock: evidenceState.readyForLock };
    }

    function getSelectedEvidenceSection() { return document.querySelector("[data-identity-evidence-section]")?.value || "face"; }
    function setText(selector, value) { const element = document.querySelector(selector); if (element) element.textContent = value; }
    function createElement(tag, className = "") { const element = document.createElement(tag); if (className) element.className = className; return element; }
    function createEmptyState(title, description) { const root = createElement("div", "empty-state"); const strong = createElement("strong"); strong.textContent = title; const span = createElement("span"); span.textContent = description; root.append(strong, span); return root; }
    function integrityLabel(value) { return ({ valid: "Válida", missing: "Referencia ausente", checksum_mismatch: "Checksum no coincide", legacy_unverified: "Legacy sin verificar", wrong_profile: "Otro perfil" })[value] || "Desconocida"; }
    function requestConfirmation(options) { return window.UI?.confirm ? UI.confirm(options) : Promise.resolve(window.confirm(options.message)); }
    function notify(message, type) { if (window.UI?.notify) UI.notify(message, type); else console[type === "warning" ? "warn" : "log"](message); }
    function emit(name, detail) { if (window.AppEvents?.emit) AppEvents.emit(name, detail); else window.dispatchEvent(new CustomEvent(name, { detail })); }
    function requireDependencies() { if (!window.ProfileService?.identity) throw new Error("ProfileService.identity no está disponible."); }

    return Object.freeze({ init, load, validate, lock, unlock, save: saveNow, renderEvidence, getState });
})();

window.IdentityBinding = IdentityBinding;
