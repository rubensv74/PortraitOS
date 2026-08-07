"use strict";

const ReleaseMetadataBinding = (() => {
    let initialized = false;
    let metadata = null;

    async function init(options = {}) {
        if (initialized && options.force !== true) return getState();
        if (!window.ReleaseMetadata) {
            throw createError("MISSING_RELEASE_METADATA", "ReleaseMetadata no está disponible.");
        }

        metadata = await ReleaseMetadata.load({ force: options.force === true });
        render(options.root || document);
        initialized = true;
        document.documentElement.setAttribute("data-release-metadata-ready", "true");
        return getState();
    }

    function render(root) {
        const version = root.querySelector("[data-release-version]");
        const details = root.querySelector("[data-release-details]");

        if (version) {
            version.textContent = `${metadata.name} ${metadata.version}`;
        }

        if (details) {
            const storage = metadata.storageVersion == null ? "?" : metadata.storageVersion;
            details.textContent = `Build ${metadata.build} · Storage v${storage} · ${metadata.environment}`;
        }
    }

    function getState() {
        return { initialized, metadata: metadata ? { ...metadata } : null };
    }

    function createError(code, message) {
        const error = new Error(message);
        error.name = "ReleaseMetadataBindingError";
        error.code = code;
        return error;
    }

    return Object.freeze({ init, getState });
})();

window.ReleaseMetadataBinding = ReleaseMetadataBinding;
