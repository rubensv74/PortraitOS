"use strict";

/* Persistencia transaccional del agregado de perfil. */
const ProfileStorage = (() => {
    const DB_NAME = "portraitos";
    const DB_VERSION = 1;
    const STORE = "profile-library";
    const RECORD_ID = "active";
    const BACKUP_ID = "backup";
    const LEGACY_KEY = "portraitos.profiles.v1";
    const FALLBACK_KEY = "portraitos.storage.library.v2";
    const FALLBACK_BACKUP_KEY = "portraitos.storage.backup.v2";
    const MIGRATION_KEY = "portraitos.storage.migration.v2";
    const STORAGE_VERSION = "2.0.0";
    const SCHEMA_VERSION = "1.0.0";
    const DEBOUNCE_MS = 180;
    let db = null;
    let backend = "uninitialized";
    let cache = null;
    let pending = null;
    let timer = null;
    let flushPromise = Promise.resolve();

    async function init() {
        if (backend !== "uninitialized") return describe();
        primeCache();
        backend = "indexeddb-pending";
        try { db = await openDatabase(); backend = "indexeddb"; }
        catch (error) { backend = "localstorage"; emit("storage:error", detail(error, "INDEXEDDB_UNAVAILABLE")); }
        await recoverOrMigrate();
        emit("storage:ready", describe());
        return describe();
    }

    function primeCache() {
        const fallback = parseRecord(safeGet(FALLBACK_KEY));
        try { if (fallback) { cache = validateRecord(fallback).payload; return; } } catch { /* recuperación asíncrona */ }
        try {
            const raw = safeGet(LEGACY_KEY);
            if (raw) cache = normalizeLibrary(JSON.parse(raw), true);
        } catch { /* recuperación asíncrona */ }
    }

    async function recoverOrMigrate() {
        const candidates = [];
        if (db) {
            candidates.push({ source: "indexeddb", record: await idbGet(RECORD_ID) });
            candidates.push({ source: "indexeddb-backup", record: await idbGet(BACKUP_ID) });
        }
        candidates.push({ source: "fallback", record: parseRecord(safeGet(FALLBACK_KEY)) });
        candidates.push({ source: "fallback-backup", record: parseRecord(safeGet(FALLBACK_BACKUP_KEY)) });
        for (const candidate of candidates) {
            if (!candidate.record) continue;
            try {
                cache = validateRecord(candidate.record).payload;
                if (candidate.source.includes("backup")) emit("storage:recovered", { source: candidate.source });
                return cache;
            } catch (error) { emit("storage:error", detail(error, "STORAGE_CORRUPT", { source: candidate.source })); }
        }
        return migrate();
    }

    async function migrate() {
        const raw = safeGet(LEGACY_KEY);
        if (!raw) return null;
        try {
            const legacy = JSON.parse(raw);
            const payload = normalizeLibrary(legacy, true);
            await commit(payload);
            cache = payload;
            safeSet(MIGRATION_KEY, JSON.stringify({ from: "localstorage-v1", to: STORAGE_VERSION, migratedAt: now(), checksum: checksum(stable(payload)) }));
            emit("storage:migrated", { from: LEGACY_KEY, to: backend, profileCount: payload.profiles.length });
            return clone(payload);
        } catch (error) {
            emit("storage:error", detail(error, "STORAGE_MIGRATION_FAILED"));
            return null;
        }
    }

    function loadLibrary() { return cache ? clone(cache) : null; }

    function saveLibrary(library, options = {}) {
        const normalized = normalizeLibrary(library, false);
        cache = clone(normalized);
        pending = clone(normalized);
        /* Journal síncrono: protege recargas/cierres antes de que venza el debounce. */
        const serialized = stable(normalized);
        safeSet(FALLBACK_KEY, JSON.stringify({ id: RECORD_ID, storageVersion: STORAGE_VERSION, schemaVersion: SCHEMA_VERSION, checksum: checksum(serialized), payload: normalized, writtenAt: now(), journal: true }));
        if (options.immediate) return flush();
        clearTimeout(timer);
        timer = setTimeout(() => { flush().catch(() => {}); }, DEBOUNCE_MS);
        return clone(normalized);
    }

    async function flush() {
        clearTimeout(timer); timer = null;
        if (!pending) return cache ? clone(cache) : null;
        const value = pending; pending = null;
        flushPromise = flushPromise.catch(() => null).then(() => commit(value)).catch(error => {
            pending = value;
            emit("storage:error", detail(error, error.code || "STORAGE_WRITE_FAILED"));
            throw error;
        });
        await flushPromise;
        return clone(cache);
    }

    async function commit(payload) {
        const normalized = normalizeLibrary(payload, false);
        const serialized = stable(normalized);
        await assertCapacity(serialized.length * 2);
        const record = { id: RECORD_ID, storageVersion: STORAGE_VERSION, schemaVersion: SCHEMA_VERSION, checksum: checksum(serialized), payload: normalized, writtenAt: now() };
        validateRecord(record);
        const previous = db ? await idbGet(RECORD_ID) : parseRecord(safeGet(FALLBACK_KEY));
        try {
            if (db) await idbPutAtomic(record, previous);
            else localPutAtomic(record, previous);
            /* Una confirmación antigua nunca puede sobrescribir un journal más reciente. */
            if (!cache || checksum(stable(cache)) === record.checksum) {
                safeSet(FALLBACK_BACKUP_KEY, previous ? JSON.stringify(previous) : "");
                safeSet(FALLBACK_KEY, JSON.stringify(record));
                cache = clone(normalized);
            }
            return clone(normalized);
        } catch (cause) {
            if (previous && (!cache || checksum(stable(cache)) === checksum(stable(normalized)))) cache = clone(validateRecord(previous).payload);
            throw createError(isQuota(cause) ? "STORAGE_QUOTA" : "STORAGE_WRITE_FAILED", "No se pudo confirmar el perfil; se conserva la versión anterior.", cause);
        }
    }

    async function save(profile) {
        const library = loadLibrary() || { schema: "portraitos.profile-library", version: "1.0", activeProfileId: profile.id, profiles: [] };
        const index = library.profiles.findIndex(item => item.id === profile.id);
        if (index >= 0) library.profiles[index] = clone(profile); else library.profiles.push(clone(profile));
        library.activeProfileId = profile.id;
        saveLibrary(library);
        return clone(profile);
    }
    function load(profileId) { const library = loadLibrary(); return clone(library?.profiles.find(item => item.id === profileId) || null); }
    function exists(profileId) { return Boolean(load(profileId)); }
    function remove(profileId) { const library = loadLibrary(); if (!library) return false; const count = library.profiles.length; library.profiles = library.profiles.filter(item => item.id !== profileId); if (count === library.profiles.length) return false; if (library.activeProfileId === profileId) library.activeProfileId = library.profiles[0]?.id || null; saveLibrary(library); return true; }
    async function backup() { await flush(); if (!cache) throw createError("STORAGE_NOT_FOUND", "No existe una biblioteca para respaldar."); return JSON.stringify({ format: "portraitos-backup", storageVersion: STORAGE_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: now(), checksum: checksum(stable(cache)), library: clone(cache) }); }
    const exportData = backup;
    async function restore(input) { const object = typeof input === "string" ? JSON.parse(input) : clone(input); if (!object || object.format !== "portraitos-backup") throw createError("STORAGE_INVALID", "El respaldo no tiene un formato compatible."); if (object.checksum !== checksum(stable(object.library))) throw createError("STORAGE_CHECKSUM", "El checksum del respaldo no coincide."); saveLibrary(object.library); await flush(); return loadLibrary(); }
    const importData = restore;

    /* Compatibilidad de claves individuales; todo acceso físico queda dentro de la fachada. */
    function setLegacy(key, value) { safeSet(key, value); return true; }
    function getLegacy(key) { return safeGet(key); }
    function removeLegacy(key) { try { localStorage.removeItem(key); return true; } catch { return false; } }

    function normalizeLibrary(value, migrated) {
        if (!value || !Array.isArray(value.profiles)) throw createError("STORAGE_INVALID", "La biblioteca no contiene perfiles válidos.");
        const stamp = now();
        const profiles = value.profiles.filter(item => item && typeof item === "object").map(item => {
            const profile = clone(item);
            if (!String(profile.id || "").trim()) throw createError("STORAGE_INVALID", "Un perfil no tiene identificador.");
            profile.storageVersion = STORAGE_VERSION;
            profile.schemaVersion = String(profile.schemaVersion || profile.version || SCHEMA_VERSION);
            profile.createdAt = profile.createdAt || profile.meta?.createdAt || stamp;
            profile.updatedAt = migrated ? (profile.updatedAt || profile.meta?.updatedAt || stamp) : stamp;
            profile.migrationHistory = Array.isArray(profile.migrationHistory) ? profile.migrationHistory : [];
            if (migrated && !profile.migrationHistory.some(entry => entry?.to === STORAGE_VERSION)) profile.migrationHistory.push({ from: "localstorage-v1", to: STORAGE_VERSION, migratedAt: stamp });
            return profile;
        });
        return { schema: "portraitos.profile-library", version: "1.0", storageVersion: STORAGE_VERSION, schemaVersion: SCHEMA_VERSION, activeProfileId: value.activeProfileId || profiles[0]?.id || null, profiles };
    }

    function validateRecord(record) {
        if (!record || record.storageVersion !== STORAGE_VERSION) throw createError("STORAGE_VERSION_UNSUPPORTED", "Versión de almacenamiento incompatible.");
        const payload = normalizeLibrary(record.payload, false);
        /* updatedAt cambia al normalizar; validar contra payload original ya estructuralmente comprobado. */
        if (record.checksum !== checksum(stable(record.payload))) throw createError("STORAGE_CHECKSUM", "La integridad del perfil no es válida.");
        return { ...record, payload: clone(record.payload), validated: payload.profiles.length };
    }

    async function assertCapacity(bytes) {
        if (!navigator.storage?.estimate) return;
        const estimate = await navigator.storage.estimate();
        const available = Math.max(0, Number(estimate.quota || 0) - Number(estimate.usage || 0));
        if (estimate.quota && available < bytes * 1.15) { emit("storage:quota-warning", { required: bytes, available }); throw createError("STORAGE_QUOTA", "No hay cuota suficiente para guardar el perfil."); }
    }

    function openDatabase() { return new Promise((resolve, reject) => { if (!window.indexedDB) return reject(createError("INDEXEDDB_UNAVAILABLE", "IndexedDB no está disponible.")); const request = indexedDB.open(DB_NAME, DB_VERSION); request.onupgradeneeded = () => { const target = request.result; if (!target.objectStoreNames.contains(STORE)) target.createObjectStore(STORE, { keyPath: "id" }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onblocked = () => reject(createError("INDEXEDDB_BLOCKED", "IndexedDB está bloqueado.")); }); }
    function idbGet(id) { return new Promise((resolve, reject) => { const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); }); }
    function idbPutAtomic(record, previous) { return new Promise((resolve, reject) => { const transaction = db.transaction(STORE, "readwrite"); const store = transaction.objectStore(STORE); if (previous) store.put({ ...previous, id: BACKUP_ID, backedUpAt: now() }); store.put(record); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error || createError("STORAGE_WRITE_FAILED", "Transacción abortada.")); }); }
    function localPutAtomic(record, previous) { try { if (previous) safeSet(FALLBACK_BACKUP_KEY, JSON.stringify(previous)); safeSet(FALLBACK_KEY, JSON.stringify(record)); } catch (error) { if (previous) safeSet(FALLBACK_KEY, JSON.stringify(previous)); throw error; } }
    function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
    function safeSet(key, value) { try { if (value) localStorage.setItem(key, value); } catch (cause) { throw createError(isQuota(cause) ? "STORAGE_QUOTA" : "STORAGE_WRITE_FAILED", "No se pudo escribir almacenamiento local.", cause); } }
    function parseRecord(raw) { try { return raw ? JSON.parse(raw) : null; } catch { return null; } }
    function stable(value) { return JSON.stringify(value); }
    function checksum(text) { let hash = 2166136261; for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); } return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`; }
    function clone(value) { if (value == null) return value; return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
    function now() { return new Date().toISOString(); }
    function isQuota(error) { return error?.name === "QuotaExceededError" || error?.code === 22 || error?.code === 1014 || error?.code === "STORAGE_QUOTA"; }
    function createError(code, message, cause) { const error = new Error(message); error.name = "ProfileStorageError"; error.code = code; if (cause) error.cause = cause; return error; }
    function detail(error, fallback, context = {}) { return { code: error?.code || fallback, message: error?.message || "Error de persistencia.", ...context }; }
    function emit(name, value) { if (window.AppEvents?.emit) AppEvents.emit(name, value); else window.dispatchEvent(new CustomEvent(name, { detail: value })); }
    function describe() { return Object.freeze({ backend, database: DB_NAME, store: STORE, storageVersion: STORAGE_VERSION, schemaVersion: SCHEMA_VERSION, pending: Boolean(pending), migrationReady: true, atomicWrites: true }); }

    return Object.freeze({ init, save, load, remove, exists, migrate, exportData, importData, backup, restore, saveLibrary, loadLibrary, flush, describe, setLegacy, getLegacy, removeLegacy });
})();

window.ProfileStorage = ProfileStorage;
