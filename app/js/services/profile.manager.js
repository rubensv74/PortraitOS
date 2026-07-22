"use strict";

const ProfileManager = (() => {
    const STORAGE_KEY = "portraitos.profiles.v1";
    const SCHEMA = "portraitos.profile-library";
    const VERSION = "1.0";
    let state = { schema: SCHEMA, version: VERSION, activeProfileId: null, profiles: [] };

    function init() {
        validateDependencies();
        state = readState();

        if (!state.profiles.length) {
            const active = ProfileService.getActive();
            const profile = active || ProfileService.create({ name: "Nuevo perfil" });
            state.profiles = [clone(profile)];
            state.activeProfileId = profile.id;
            persist();
        }

        const active = state.profiles.find(profile => profile.id === state.activeProfileId) || state.profiles[0];
        state.activeProfileId = active.id;
        ProfileService.load(active);
        persist();
        emit("profile-manager:ready", getState());
        return getState();
    }

    function list() {
        syncActiveProfile();
        return state.profiles.map(profile => ({
            id: profile.id,
            name: profile.name || "Perfil sin nombre",
            description: profile.description || "",
            updatedAt: profile.updatedAt || profile.meta?.updatedAt || null,
            active: profile.id === state.activeProfileId
        }));
    }

    function getState() {
        return { activeProfileId: state.activeProfileId, profiles: list() };
    }

    function create(options = {}) {
        syncActiveProfile();
        const profile = ProfileService.create({
            name: normalizeText(options.name) || nextProfileName(),
            description: normalizeText(options.description)
        });
        state.profiles.push(clone(profile));
        state.activeProfileId = profile.id;
        persist();
        emit("profile-manager:changed", getState());
        return clone(profile);
    }

    function duplicate(profileId, options = {}) {
        select(profileId || state.activeProfileId);
        const profile = ProfileService.duplicate({
            name: normalizeText(options.name) || `${ProfileService.getActive().name} — copia`
        });
        state.profiles.push(clone(profile));
        state.activeProfileId = profile.id;
        persist();
        emit("profile-manager:changed", getState());
        return clone(profile);
    }

    function rename(profileId, name) {
        const cleanName = normalizeText(name);
        if (!cleanName) throw createError("PROFILE_NAME_REQUIRED", "El nombre del perfil es obligatorio.");
        const profile = requireProfile(profileId);
        profile.name = cleanName;
        profile.updatedAt = new Date().toISOString();
        if (profile.meta) profile.meta.updatedAt = profile.updatedAt;
        if (profile.id === state.activeProfileId) ProfileService.update({ name: cleanName });
        persist();
        emit("profile-manager:changed", getState());
        return clone(profile);
    }

    function remove(profileId) {
        const profile = requireProfile(profileId);
        if (state.profiles.length === 1) {
            throw createError("LAST_PROFILE", "No se puede eliminar el único perfil disponible.");
        }
        state.profiles = state.profiles.filter(item => item.id !== profile.id);
        if (state.activeProfileId === profile.id) {
            const next = state.profiles[0];
            state.activeProfileId = next.id;
            ProfileService.load(next);
        }
        persist();
        emit("profile-manager:changed", getState());
        return clone(profile);
    }

    function select(profileId) {
        syncActiveProfile();
        const profile = requireProfile(profileId);
        state.activeProfileId = profile.id;
        ProfileService.load(profile);
        persist();
        emit("profile-manager:changed", getState());
        return clone(profile);
    }

    function saveActive() {
        syncActiveProfile();
        persist();
        emit("profile-manager:saved", getState());
        return clone(requireProfile(state.activeProfileId));
    }

    function syncActiveProfile() {
        const active = ProfileService.getActive();
        if (!active) return;
        const index = state.profiles.findIndex(profile => profile.id === active.id);
        if (index >= 0) state.profiles[index] = clone(active);
        else state.profiles.push(clone(active));
        state.activeProfileId = active.id;
    }

    function readState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return clone(state);
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.profiles)) return clone(state);
            return {
                schema: SCHEMA,
                version: VERSION,
                activeProfileId: normalizeText(parsed.activeProfileId) || null,
                profiles: parsed.profiles.filter(profile => profile && typeof profile === "object").map(clone)
            };
        } catch (error) {
            console.warn("PortraitOS: no se pudo recuperar la biblioteca de perfiles.", error);
            return clone(state);
        }
    }

    function persist() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function requireProfile(profileId) {
        const id = normalizeText(profileId);
        const profile = state.profiles.find(item => item.id === id);
        if (!profile) throw createError("PROFILE_NOT_FOUND", "No se encontró el perfil solicitado.");
        return profile;
    }

    function nextProfileName() {
        return `Nuevo perfil ${state.profiles.length + 1}`;
    }

    function validateDependencies() {
        if (!window.ProfileService) throw createError("MISSING_PROFILE_SERVICE", "ProfileService no está disponible.");
    }

    function emit(name, detail) {
        if (window.AppEvents?.emit) AppEvents.emit(name, detail);
        else window.dispatchEvent(new CustomEvent(name, { detail }));
    }

    function normalizeText(value) { return String(value || "").trim(); }
    function clone(value) { return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
    function createError(code, message) { const error = new Error(message); error.name = "ProfileManagerError"; error.code = code; return error; }

    return Object.freeze({ init, list, getState, create, duplicate, rename, remove, select, saveActive });
})();

window.ProfileManager = ProfileManager;
