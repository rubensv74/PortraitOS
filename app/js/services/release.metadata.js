"use strict";

const ReleaseMetadata = (() => {
    const DEFAULT_PATH = "version.json";
    let cached = null;

    async function load(options = {}) {
        if (cached && options.force !== true) {
            return clone(cached);
        }

        const path = String(options.path || DEFAULT_PATH);

        try {
            const response = await fetch(path, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const parsed = await response.json();
            cached = normalize(parsed);
            return clone(cached);
        } catch (error) {
            cached = fallback(error);
            return clone(cached);
        }
    }

    function getCached() {
        return cached ? clone(cached) : null;
    }

    function formatLabel(metadata = cached) {
        const value = metadata || fallback();
        return `${value.name} ${value.version}`;
    }

    function normalize(value = {}) {
        return Object.freeze({
            name: text(value.name) || "PortraitOS",
            version: text(value.version) || "1.0.0-rc.1",
            channel: text(value.channel) || "rc",
            build: text(value.build) || "unknown",
            schemaVersion: text(value.schemaVersion) || "unknown",
            storageVersion: Number.isFinite(Number(value.storageVersion)) ? Number(value.storageVersion) : null,
            baseCommit: text(value.baseCommit) || null,
            environment: text(value.environment) || window.AppConstants?.APP?.ENVIRONMENT || "local",
            releasedAt: text(value.releasedAt) || null,
            source: "version.json"
        });
    }

    function fallback(error) {
        return Object.freeze({
            name: window.AppConstants?.APP?.NAME || "PortraitOS",
            version: window.AppConstants?.APP?.VERSION || "unknown",
            channel: "local",
            build: "unavailable",
            schemaVersion: window.AppConstants?.PROFILE?.VERSION || "unknown",
            storageVersion: window.AppConstants?.STORAGE?.VERSION ?? null,
            baseCommit: null,
            environment: window.AppConstants?.APP?.ENVIRONMENT || "local",
            releasedAt: null,
            source: "fallback",
            error: error?.message || null
        });
    }

    function text(value) {
        return String(value ?? "").trim();
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    return Object.freeze({ load, getCached, formatLabel });
})();

window.ReleaseMetadata = ReleaseMetadata;
