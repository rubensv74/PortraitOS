"use strict";

/* Fachada canónica de persistencia de PortraitOS. */
const ProfileStorage = (() => {
    const CONFIG = window.AppConstants?.STORAGE || {};
    const DB_NAME = CONFIG.DATABASE || "portraitos";
    const DB_VERSION = CONFIG.VERSION || 2;
    const STORES = { library: "profile-library", binary: "binary-assets", legacy: "legacy-consumers", ...(CONFIG.STORES || {}) };
    const RECORD_ID = "active", BACKUP_ID = "backup";
    const LEGACY_LIBRARY_KEY = "portraitos.profiles.v1";
    const FALLBACK_KEY = "portraitos.storage.library.v2", FALLBACK_BACKUP_KEY = "portraitos.storage.backup.v2";
    const MIGRATION_KEY = "portraitos.storage.migration.v2", BINARY_FALLBACK_PREFIX = "portraitos.storage.binary.";
    const STORAGE_VERSION = "2.1.0", PROFILE_STORAGE_VERSION = "2.0.0", SCHEMA_VERSION = "1.0.0", DEBOUNCE_MS = 180;
    let db = null, cache = null, confirmedCache = null, pendingLibrary = null, timer = null;
    let mode = CONFIG.MODE || "auto", backend = "uninitialized", degraded = false;
    let pendingLegacy = new Map(), flushChain = Promise.resolve(), readyPromise = null;
    let lastCommittedAt = null, lastError = null, journalState = "clean", pendingWrites = 0;
    let recoveryReport = emptyRecoveryReport();
    const testing = { quotaLimit: null, failPoint: null, indexedDBAvailable: true };

    function init(options = {}) {
        if (readyPromise) return readyPromise;
        mode = normalizeMode(options.mode || mode);
        primeCache();
        backend = mode === "localstorage" ? "localstorage" : "indexeddb-pending";
        readyPromise = initializeBackend();
        return readyPromise;
    }

    async function initializeBackend() {
        if (mode !== "localstorage") {
            try {
                if (!testing.indexedDBAvailable) throw createError("INDEXEDDB_UNAVAILABLE", "IndexedDB no está disponible.");
                db = await openDatabase(); backend = "indexeddb";
            } catch (error) {
                if (mode === "indexeddb") { backend = "failed"; lastError = detail(error, "INDEXEDDB_REQUIRED"); emit("storage:error", lastError); throw createError("INDEXEDDB_REQUIRED", "El modo indexeddb exige un backend disponible.", error); }
                backend = "localstorage"; degraded = true; lastError = detail(error, "INDEXEDDB_UNAVAILABLE"); emit("storage:degraded", lastError);
            }
        }
        await recoverOrMigrate();
        await hydrateLegacyCache();
        emit("storage:ready", getStatus());
        return getStatus();
    }

    function ready() { return readyPromise || init(); }

    function primeCache() {
        for (const raw of [safeGet(FALLBACK_KEY), safeGet(FALLBACK_BACKUP_KEY)]) {
            try { const record = parseRecord(raw); if (record) { cache = validateRecord(record).payload; return; } } catch { /* recovery follows */ }
        }
        try { const raw = safeGet(LEGACY_LIBRARY_KEY); if (raw) cache = normalizeLibrary(JSON.parse(raw), true); } catch { /* recovery follows */ }
    }

    async function recoverOrMigrate() {
        const candidates = [];
        if (db) { candidates.push({ source: "indexeddb", record: await idbGet(STORES.library, RECORD_ID) }); candidates.push({ source: "indexeddb-backup", record: await idbGet(STORES.library, BACKUP_ID) }); }
        candidates.push({ source: "fallback", record: parseRecord(safeGet(FALLBACK_KEY)) });
        candidates.push({ source: "fallback-backup", record: parseRecord(safeGet(FALLBACK_BACKUP_KEY)) });
        for (const candidate of candidates) {
            if (!candidate.record) continue;
            try {
                cache = validateRecord(candidate.record).payload; confirmedCache = clone(cache);
                if (candidate.source.includes("backup")) { recoveryReport.recovered += 1; recoveryReport.rolledBack += 1; emit("storage:recovered", { source: candidate.source, report: clone(recoveryReport) }); }
                return cache;
            } catch (error) { recoveryReport.errors.push(detail(error, "STORAGE_CORRUPT", { source: candidate.source })); }
        }
        return migrate();
    }

    async function migrate() {
        const raw = safeGet(LEGACY_LIBRARY_KEY); if (!raw) return null;
        try {
            const payload = normalizeLibrary(JSON.parse(raw), true);
            cache = clone(payload); pendingLibrary = clone(payload); await flush();
            safeSet(MIGRATION_KEY, JSON.stringify({ from: "localstorage-v1", to: STORAGE_VERSION, status: "completed", migratedAt: now() }));
            recoveryReport.migratedRecords += payload.profiles.length;
            emit("storage:migrated", { from: LEGACY_LIBRARY_KEY, to: backend, profileCount: payload.profiles.length });
            return clone(cache);
        } catch (error) { recoveryReport.errors.push(detail(error, "STORAGE_MIGRATION_FAILED")); emit("storage:error", recoveryReport.errors.at(-1)); return null; }
    }

    function loadLibrary() { return cache ? clone(cache) : null; }
    function saveLibrary(library, options = {}) {
        const normalized = normalizeLibrary(library, false); cache = clone(normalized); pendingLibrary = clone(normalized);
        pendingWrites += 1; journalState = "pending";
        const serialized = stable(normalized);
        safeSet(FALLBACK_KEY, JSON.stringify(makeRecord(normalized, serialized, true)));
        if (options.immediate) return flush();
        clearTimeout(timer); timer = setTimeout(() => flush().catch(() => {}), DEBOUNCE_MS);
        return clone(normalized);
    }

    async function flush() {
        clearTimeout(timer); timer = null;
        if (!pendingLibrary && pendingLegacy.size === 0) return cache ? clone(cache) : null;
        const library = pendingLibrary; const legacyWrites = new Map(pendingLegacy); pendingLibrary = null; pendingLegacy.clear();
        journalState = "in_progress";
        flushChain = flushChain.catch(() => null).then(async () => {
            if (library) await commitLibrary(library, legacyWrites); else await commitLegacy(legacyWrites);
            pendingWrites = Math.max(0, pendingWrites - 1); lastCommittedAt = now(); journalState = pendingLibrary || pendingLegacy.size ? "pending" : "clean"; lastError = null;
            emit("storage:flush-complete", getStatus());
        }).catch(error => {
            if (library) pendingLibrary = library; legacyWrites.forEach((value, key) => pendingLegacy.set(key, value));
            if (confirmedCache) cache = clone(confirmedCache);
            journalState = "failed"; lastError = detail(error, error.code || "STORAGE_WRITE_FAILED"); emit("storage:error", lastError); throw error;
        });
        await flushChain; return clone(cache);
    }

    async function commitLibrary(payload, legacyWrites) {
        const migration = await extractBinaries(normalizeLibrary(payload, false));
        const serialized = stable(migration.library); const binaryBytes = migration.binaries.reduce((sum, item) => sum + item.size, 0);
        await assertCapacity(serialized.length * 2 + binaryBytes);
        const record = makeRecord(migration.library, serialized, false);
        const previous = db ? await idbGet(STORES.library, RECORD_ID) : parseRecord(safeGet(FALLBACK_KEY));
        if (testing.failPoint === "before_commit") throw createError("STORAGE_INJECTED_FAILURE", "Fallo controlado antes del commit.");
        try {
            if (db) await idbCommit(record, previous, migration.binaries, legacyWrites); else { localPutAtomic(record, previous); await writeFallbackBinaries(migration.binaries); writeFallbackLegacy(legacyWrites); }
            safeSet(FALLBACK_BACKUP_KEY, previous ? JSON.stringify(previous) : ""); safeSet(FALLBACK_KEY, JSON.stringify(record));
            cache = clone(migration.library); confirmedCache = clone(cache);
            if (migration.migrated) emit("storage:migrated", { type: "binary", count: migration.binaries.length, status: "completed" });
        } catch (cause) {
            recoveryReport.rolledBack += 1;
            if (previous) { try { cache = clone(validateRecord(previous).payload); safeSet(FALLBACK_KEY, JSON.stringify(previous)); } catch { /* se conserva el journal fallido */ } }
            throw createError(isQuota(cause) ? "STORAGE_QUOTA" : "STORAGE_WRITE_FAILED", "No se pudo confirmar; se conserva la versión anterior.", cause);
        }
    }

    async function extractBinaries(library) {
        const binaries = []; let migrated = false;
        for (const profile of library.profiles) {
            const photos = Array.isArray(profile.identity?.photos) ? profile.identity.photos : [];
            for (const photo of photos) {
                for (const [kind, holder] of [["original", photo.source], ["thumbnail", photo.thumbnail]]) {
                    if (!holder || typeof holder.dataUrl !== "string" || !holder.dataUrl.startsWith("data:")) continue;
                    const binaryId = `${profile.id}:${photo.id}:${kind}`; const blob = dataUrlToBlob(holder.dataUrl);
                    binaries.push({ binaryId, profileId: profile.id, photoId: photo.id, kind, mimeType: blob.type, size: blob.size, checksum: kind === "original" ? photo.checksum || "" : checksum(holder.dataUrl), createdAt: photo.createdAt || now(), updatedAt: now(), blob });
                    delete holder.dataUrl; holder.binaryId = binaryId; holder.kind = kind; migrated = true;
                }
            }
            if (migrated) {
                profile.migrationHistory ||= [];
                if (!profile.migrationHistory.some(entry => entry?.type === "binary-v1" && entry?.status === "completed")) profile.migrationHistory.push({ type: "binary-v1", status: "completed", migratedAt: now() });
            }
        }
        return { library, binaries, migrated };
    }

    async function save(profile) { const library = loadLibrary() || { profiles: [], activeProfileId: profile.id }; const index = library.profiles.findIndex(item => item.id === profile.id); if (index >= 0) library.profiles[index] = clone(profile); else library.profiles.push(clone(profile)); library.activeProfileId = profile.id; saveLibrary(library); return clone(profile); }
    function load(profileId) { return clone(loadLibrary()?.profiles.find(item => item.id === profileId) || null); }
    function exists(profileId) { return Boolean(load(profileId)); }
    function remove(profileId) { const library = loadLibrary(); if (!library) return false; const before = library.profiles.length; library.profiles = library.profiles.filter(item => item.id !== profileId); if (before === library.profiles.length) return false; if (library.activeProfileId === profileId) library.activeProfileId = library.profiles[0]?.id || null; saveLibrary(library); return true; }

    async function backup() {
        await flush(); if (!cache) throw createError("STORAGE_NOT_FOUND", "No existe una biblioteca para respaldar.");
        const binaries = await listBinaries({ encode: true }); const consumers = await listLegacy();
        const body = { library: clone(cache), binaries, consumers };
        return JSON.stringify({ format: "portraitos-backup", storageVersion: STORAGE_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: now(), manifest: { profiles: cache.profiles.length, binaries: binaries.length, consumers: Object.keys(consumers).length }, checksum: checksum(stable(body)), ...body });
    }
    const exportData = backup; const exportStorage = backup;
    async function restore(input) {
        const object = typeof input === "string" ? JSON.parse(input) : clone(input); if (!object || object.format !== "portraitos-backup") throw createError("STORAGE_INVALID", "Respaldo incompatible.");
        const body = object.binaries || object.consumers ? { library: object.library, binaries: object.binaries || [], consumers: object.consumers || {} } : object.library;
        const valid = object.checksum === checksum(stable(body)) || (!object.binaries && object.checksum === checksum(stable(object.library)));
        if (!valid) throw createError("STORAGE_CHECKSUM", "El checksum del respaldo no coincide.");
        for (const item of object.binaries || []) await binaryPut({ ...item, blob: dataUrlToBlob(item.dataUrl) });
        Object.entries(object.consumers || {}).forEach(([key, value]) => namespaceSave(key, value));
        saveLibrary(object.library); await flush(); return loadLibrary();
    }
    const importData = restore; const importStorage = restore;

    async function binaryPut(record) { const normalized = { ...record, binaryId: String(record.binaryId || ""), updatedAt: now() }; if (!normalized.binaryId || !(normalized.blob instanceof Blob)) throw createError("BINARY_INVALID", "El binario no es válido."); if (db) await idbPut(STORES.binary, normalized); else safeSet(BINARY_FALLBACK_PREFIX + normalized.binaryId, await blobToDataUrl(normalized.blob)); return { ...normalized, blob: undefined }; }
    async function binaryGet(id) { if (db) return idbGet(STORES.binary, id); const dataUrl = safeGet(BINARY_FALLBACK_PREFIX + id); return dataUrl ? { binaryId: id, blob: dataUrlToBlob(dataUrl) } : null; }
    async function binaryRemove(id) { if (db) return idbDelete(STORES.binary, id); safeRemove(BINARY_FALLBACK_PREFIX + id); return true; }
    async function binaryExists(id) { return Boolean(await binaryGet(id)); }
    async function listBinaries(options = {}) { const list = db ? await idbGetAll(STORES.binary) : fallbackBinaryList(); if (!options.encode) return list; return Promise.all(list.map(async item => ({ ...item, blob: undefined, dataUrl: await blobToDataUrl(item.blob) }))); }

    function namespaceLoad(key) { return safeGet(key); }
    function namespaceSave(key, value) { const serialized = typeof value === "string" ? value : JSON.stringify(value); safeSet(key, serialized); pendingLegacy.set(key, serialized); pendingWrites += 1; scheduleFlush(); return true; }
    function namespaceRemove(key) { safeRemove(key); pendingLegacy.set(key, null); pendingWrites += 1; scheduleFlush(); return true; }
    function makeNamespace() { return Object.freeze({ load: namespaceLoad, save: namespaceSave, remove: namespaceRemove }); }
    const history = makeNamespace(), review = makeNamespace(), knowledge = makeNamespace(), wizard = makeNamespace();
    const legacy = Object.freeze({ getItem: namespaceLoad, setItem: namespaceSave, removeItem: namespaceRemove });
    function setLegacy(key, value) { return namespaceSave(key, value); } function getLegacy(key) { return namespaceLoad(key); } function removeLegacy(key) { return namespaceRemove(key); }

    async function commitLegacy(writes) { if (!writes.size) return; if (db) { const tx = db.transaction(STORES.legacy, "readwrite"), store = tx.objectStore(STORES.legacy); writes.forEach((value, key) => value === null ? store.delete(key) : store.put({ key, value, updatedAt: now() })); await transactionDone(tx); } else writeFallbackLegacy(writes); }
    function writeFallbackLegacy(writes) { writes.forEach((value, key) => value === null ? safeRemove(key) : safeSet(key, value)); }
    async function hydrateLegacyCache() { if (!db) return; for (const item of await idbGetAll(STORES.legacy)) if (safeGet(item.key) === null) safeSet(item.key, item.value); }
    async function listLegacy() { const result = {}; if (db) (await idbGetAll(STORES.legacy)).forEach(item => result[item.key] = item.value); return result; }

    async function validateIntegrity() {
        const report = emptyRecoveryReport(), library = loadLibrary() || { profiles: [] }, binaries = await listBinaries();
        const profiles = new Map(library.profiles.map(profile => [profile.id, profile])); const referenced = new Set();
        for (const profile of library.profiles) for (const photo of profile.identity?.photos || []) for (const holder of [photo.source, photo.thumbnail]) if (holder?.binaryId) { referenced.add(holder.binaryId); const binary = binaries.find(item => item.binaryId === holder.binaryId); if (!binary) report.errors.push({ code: "missing_binary", profileId: profile.id, photoId: photo.id, binaryId: holder.binaryId }); else if (binary.profileId !== profile.id) report.errors.push({ code: "wrong_profile", binaryId: holder.binaryId }); }
        for (const binary of binaries) { if (!profiles.has(binary.profileId)) report.orphanedRecords.push({ code: "missing_profile", binaryId: binary.binaryId }); else if (!referenced.has(binary.binaryId)) report.orphanedRecords.push({ code: "orphan_binary", binaryId: binary.binaryId }); }
        return report;
    }

    async function getQuotaEstimate() { const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : {}; const quota = Number(estimate.quota || 0), usage = Number(estimate.usage || 0); return { quota, usage, available: Math.max(0, quota - usage), testLimit: testing.quotaLimit }; }
    async function assertCapacity(bytes) { const estimate = await getQuotaEstimate(); const available = testing.quotaLimit == null ? estimate.available : Math.min(estimate.available || Infinity, testing.quotaLimit); if ((estimate.quota || testing.quotaLimit != null) && available < bytes * 1.15) { emit("storage:quota-warning", { required: bytes, available }); throw createError("STORAGE_QUOTA", "No hay cuota suficiente para guardar."); } }
    function configureForTests(options = {}) { if (options.reset) { try { db?.close(); } catch {} db = null; readyPromise = null; backend = "uninitialized"; degraded = false; lastError = null; pendingLibrary = null; pendingLegacy.clear(); flushChain = Promise.resolve(); clearTimeout(timer); timer = null; journalState = "clean"; pendingWrites = 0; } if (options.mode) mode = normalizeMode(options.mode); if ("quotaLimit" in options) testing.quotaLimit = options.quotaLimit; if ("failPoint" in options) testing.failPoint = options.failPoint; if ("indexedDBAvailable" in options) testing.indexedDBAvailable = Boolean(options.indexedDBAvailable); }

    function normalizeLibrary(value, migrated) { if (!value || !Array.isArray(value.profiles)) throw createError("STORAGE_INVALID", "Biblioteca inválida."); const stamp = now(); const profiles = value.profiles.filter(Boolean).map(item => { const profile = clone(item); if (!String(profile.id || "").trim()) throw createError("STORAGE_INVALID", "Perfil sin ID."); profile.storageVersion = PROFILE_STORAGE_VERSION; profile.schemaVersion = String(profile.schemaVersion || profile.version || SCHEMA_VERSION); profile.createdAt ||= profile.meta?.createdAt || stamp; profile.updatedAt = migrated ? (profile.updatedAt || profile.meta?.updatedAt || stamp) : stamp; profile.migrationHistory = Array.isArray(profile.migrationHistory) ? profile.migrationHistory : []; return profile; }); return { schema: "portraitos.profile-library", version: "1.0", storageVersion: STORAGE_VERSION, schemaVersion: SCHEMA_VERSION, activeProfileId: value.activeProfileId || profiles[0]?.id || null, profiles }; }
    function makeRecord(payload, serialized = stable(payload), journal = false) { return { id: RECORD_ID, storageVersion: STORAGE_VERSION, schemaVersion: SCHEMA_VERSION, checksum: checksum(serialized), payload, writtenAt: now(), journal }; }
    function validateRecord(record) { if (!record || !["2.0.0", STORAGE_VERSION].includes(record.storageVersion)) throw createError("STORAGE_VERSION_UNSUPPORTED", "Versión incompatible."); normalizeLibrary(record.payload, false); if (record.checksum !== checksum(stable(record.payload))) throw createError("STORAGE_CHECKSUM", "Checksum inválido."); return record; }

    function openDatabase() { return new Promise((resolve, reject) => { if (!window.indexedDB) return reject(createError("INDEXEDDB_UNAVAILABLE", "IndexedDB no está disponible.")); const request = indexedDB.open(DB_NAME, DB_VERSION); request.onupgradeneeded = () => { const target = request.result; if (!target.objectStoreNames.contains(STORES.library)) target.createObjectStore(STORES.library, { keyPath: "id" }); if (!target.objectStoreNames.contains(STORES.binary)) { const store = target.createObjectStore(STORES.binary, { keyPath: "binaryId" }); store.createIndex("profileId", "profileId", { unique: false }); store.createIndex("photoId", "photoId", { unique: false }); } if (!target.objectStoreNames.contains(STORES.legacy)) target.createObjectStore(STORES.legacy, { keyPath: "key" }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onblocked = () => reject(createError("INDEXEDDB_BLOCKED", "IndexedDB bloqueado.")); }); }
    function idbGet(store, id) { return new Promise((resolve, reject) => { const request = db.transaction(store, "readonly").objectStore(store).get(id); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); }); }
    function idbGetAll(store) { return new Promise((resolve, reject) => { const request = db.transaction(store, "readonly").objectStore(store).getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error); }); }
    function idbPut(store, value) { return new Promise((resolve, reject) => { const request = db.transaction(store, "readwrite").objectStore(store).put(value); request.onsuccess = () => resolve(value); request.onerror = () => reject(request.error); }); }
    function idbDelete(store, id) { return new Promise((resolve, reject) => { const request = db.transaction(store, "readwrite").objectStore(store).delete(id); request.onsuccess = () => resolve(true); request.onerror = () => reject(request.error); }); }
    function idbCommit(record, previous, binaries, legacyWrites) { const names = [STORES.library, STORES.binary, STORES.legacy]; const tx = db.transaction(names, "readwrite"), library = tx.objectStore(STORES.library); if (previous) library.put({ ...previous, id: BACKUP_ID, backedUpAt: now() }); library.put(record); const binaryStore = tx.objectStore(STORES.binary); binaries.forEach(item => binaryStore.put(item)); const legacyStore = tx.objectStore(STORES.legacy); legacyWrites.forEach((value, key) => value === null ? legacyStore.delete(key) : legacyStore.put({ key, value, updatedAt: now() })); if (testing.failPoint === "mid_transaction") tx.abort(); return transactionDone(tx); }
    function transactionDone(tx) { return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || createError("STORAGE_TRANSACTION_ABORTED", "Transacción abortada.")); }); }
    function localPutAtomic(record, previous) { try { if (previous) safeSet(FALLBACK_BACKUP_KEY, JSON.stringify(previous)); safeSet(FALLBACK_KEY, JSON.stringify(record)); } catch (error) { if (previous) safeSet(FALLBACK_KEY, JSON.stringify(previous)); throw error; } }
    async function writeFallbackBinaries(items) { for (const item of items) safeSet(BINARY_FALLBACK_PREFIX + item.binaryId, await blobToDataUrl(item.blob)); }
    function fallbackBinaryList() { const result = []; try { for (let i = 0; i < localStorage.length; i += 1) { const key = localStorage.key(i); if (key?.startsWith(BINARY_FALLBACK_PREFIX)) result.push({ binaryId: key.slice(BINARY_FALLBACK_PREFIX.length), blob: dataUrlToBlob(safeGet(key)) }); } } catch {} return result; }
    function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } } function safeSet(key, value) { try { if (value !== undefined && value !== null) localStorage.setItem(key, String(value)); } catch (cause) { throw createError(isQuota(cause) ? "STORAGE_QUOTA" : "STORAGE_WRITE_FAILED", "No se pudo escribir almacenamiento local.", cause); } } function safeRemove(key) { try { localStorage.removeItem(key); } catch {} }
    function dataUrlToBlob(dataUrl) { const [header, data] = String(dataUrl).split(",", 2), mime = header.match(/^data:([^;]+)/)?.[1] || "application/octet-stream", binary = atob(data || ""), bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i); return new Blob([bytes], { type: mime }); }
    function blobToDataUrl(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); }); }
    function scheduleFlush() { clearTimeout(timer); timer = setTimeout(() => flush().catch(() => {}), DEBOUNCE_MS); }
    function parseRecord(raw) { try { return raw ? JSON.parse(raw) : null; } catch { return null; } } function stable(value) { return JSON.stringify(value); } function checksum(text) { let hash = 2166136261; for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); } return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`; }
    function clone(value) { if (value == null) return value; return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); } function now() { return new Date().toISOString(); } function normalizeMode(value) { const result = String(value || "auto").toLowerCase(); if (!["auto", "indexeddb", "localstorage"].includes(result)) throw createError("STORAGE_MODE_INVALID", "Modo de storage inválido."); return result; }
    function isQuota(error) { return error?.name === "QuotaExceededError" || error?.code === 22 || error?.code === 1014 || error?.code === "STORAGE_QUOTA"; } function createError(code, message, cause) { const error = new Error(message); error.name = "ProfileStorageError"; error.code = code; if (cause) error.cause = cause; return error; } function detail(error, fallback, extra = {}) { return { code: error?.code || fallback, message: error?.message || "Error de persistencia.", ...extra }; }
    function emit(name, value) { if (window.AppEvents?.emit) AppEvents.emit(name, value); else window.dispatchEvent(new CustomEvent(name, { detail: value })); } function emptyRecoveryReport() { return { recovered: 0, rolledBack: 0, warnings: [], errors: [], orphanedRecords: [], migratedRecords: 0 }; }
    function getStatus() { return Object.freeze({ pendingWrites, lastCommittedAt, journalState, backend, degraded, lastError, mode, recovery: clone(recoveryReport) }); }
    function describe() { return Object.freeze({ ...getStatus(), database: DB_NAME, stores: clone(STORES), storageVersion: STORAGE_VERSION, schemaVersion: SCHEMA_VERSION, pending: Boolean(pendingLibrary || pendingLegacy.size), migrationReady: true, atomicWrites: true }); }

    return Object.freeze({ init, ready, loadLibrary, saveLibrary, flush, backup, restore, export: exportStorage, import: importStorage, exportData, importData, getStatus, getQuotaEstimate, describe, save, load, remove, exists, migrate, validateIntegrity, binary: Object.freeze({ put: binaryPut, get: binaryGet, remove: binaryRemove, exists: binaryExists, list: listBinaries }), history, review, knowledge, wizard, legacy, setLegacy, getLegacy, removeLegacy, configureForTests });
})();

window.ProfileStorage = ProfileStorage;
