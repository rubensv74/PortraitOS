"use strict";

/* Fachada de persistencia de evidencias; mantiene el backend actual sustituible. */
const PhotoStorage = (() => {
    const STRATEGY = "profile-inline-localstorage";
    const TARGET_STRATEGY = "indexeddb-binary-v1";

    function persistActive() {
        if (!window.ProfileManager?.saveActive) return false;

        try {
            ProfileManager.saveActive();
            return true;
        } catch (cause) {
            const quota = cause?.name === "QuotaExceededError" || cause?.code === 22 || cause?.code === 1014;
            const error = new Error(quota
                ? "No hay espacio local suficiente para guardar las fotografías."
                : "No se pudieron guardar las fotografías.");
            error.name = "PhotoStorageError";
            error.code = quota ? "PHOTO_STORAGE_QUOTA" : "PHOTO_STORAGE_FAILED";
            error.cause = cause;
            throw error;
        }
    }

    function describe() {
        return Object.freeze({
            strategy: STRATEGY,
            targetStrategy: TARGET_STRATEGY,
            storesBinaryInline: true,
            migrationReady: true
        });
    }

    return Object.freeze({ persistActive, describe });
})();

window.PhotoStorage = PhotoStorage;
