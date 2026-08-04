"use strict";

/* ============================================================
   PortraitOS
   Object URL Registry
   ------------------------------------------------------------
   Responsabilidad única de gestionar los previews Blob.
   - create(binaryId): carga el Blob vía ProfileStorage y crea
     una Object URL solo cuando no existe una activa válida.
   - get(binaryId): devuelve la URL activa si existe.
   - revoke(binaryId): revoca y olvida una URL (idempotente).
   - revokeProfile(profileId): revoca todas las URLs del perfil.
   - revokeAll(): revoca todas las URLs activas.
   - getStats(): instrumentación de tests.
   Las Object URLs son transitorias: nunca se persisten, nunca
   viajan dentro de DTOs y tras una recarga se regeneran.
   ============================================================ */

const ObjectURLRegistry = (() => {

    const registry = new Map();

    let createdCount = 0;
    let revokedCount = 0;

    async function create(binaryId, profileIdHint = "") {
        const id = normalize(binaryId);
        if (!id) return null;

        const active = registry.get(id);
        if (active && typeof active.url === "string") return active.url;

        let record = null;
        try {
            record = await ProfileStorage.binary.get(id);
        } catch (error) {
            return null;
        }
        if (!record || !(record.blob instanceof Blob)) return null;

        const url = URL.createObjectURL(record.blob);
        registry.set(id, {
            url,
            blob: record.blob,
            profileId: normalize(record.profileId) || normalize(profileIdHint),
            createdAt: Date.now()
        });
        createdCount += 1;
        return url;
    }

    function get(binaryId) {
        const id = normalize(binaryId);
        const active = registry.get(id);
        return active && typeof active.url === "string" ? active.url : null;
    }

    function has(binaryId) {
        return registry.has(normalize(binaryId));
    }

    function revoke(binaryId) {
        const id = normalize(binaryId);
        const active = registry.get(id);
        if (!active) return false;
        try {
            URL.revokeObjectURL(active.url);
        } catch (error) {
            /* Revocar dos veces es seguro: no se propaga ninguna excepción. */
        }
        revokedCount += 1;
        registry.delete(id);
        return true;
    }

    function revokeProfile(profileId) {
        const id = normalize(profileId);
        if (!id) return 0;
        let count = 0;
        for (const binaryId of [...registry.keys()]) {
            const active = registry.get(binaryId);
            if (active && normalize(active.profileId) === id) {
                if (revoke(binaryId)) count += 1;
            }
        }
        return count;
    }

    function revokeAll() {
        const ids = [...registry.keys()];
        ids.forEach(binaryId => revoke(binaryId));
        return ids.length;
    }

    function getStats() {
        return {
            created: createdCount,
            revoked: revokedCount,
            active: registry.size,
            activeIds: [...registry.keys()],
            entries: [...registry.entries()].map(([binaryId, entry]) => ({
                binaryId,
                profileId: entry.profileId,
                url: entry.url,
                createdAt: entry.createdAt
            }))
        };
    }

    function reset() {
        revokeAll();
        createdCount = 0;
        revokedCount = 0;
    }

    function normalize(value) {
        return String(value || "").trim();
    }

    return Object.freeze({
        create,
        get,
        has,
        revoke,
        revokeProfile,
        revokeAll,
        getStats,
        reset
    });

})();

window.ObjectURLRegistry = ObjectURLRegistry;
