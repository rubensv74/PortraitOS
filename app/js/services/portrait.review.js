"use strict";

/* ============================================================
   PortraitOS
   Portrait Review Service
   ------------------------------------------------------------
   Responsabilidad:
   - Gestión de revisiones de retratos con checklist estructurado.
   - Persistencia atómica con backup y rollback.
   - Binary storage para imágenes.
   - Asociación con generación y contrato.
   - Scoring basado en severidad.
   - Eventos tipificados.
   - Migración desde formato legacy v1.
   ============================================================ */

const PortraitReviewService = (() => {

    const VERSION = "1.0";
    const SCHEMA = "portraitos.reviews";
    const SCHEMA_VERSION = "1.0";
    const STORAGE_KEY = "portraitos.reviews.v2";
    const BACKUP_KEY = "portraitos.reviews.backup";
    const BACKUP_TTL = 30 * 24 * 60 * 60 * 1000;

    const EVENTS = Object.freeze({
        CREATED: "portraitos:review:created",
        UPDATED: "portraitos:review:updated",
        STATUS_CHANGED: "portraitos:review:status-changed",
        CHECKLIST_UPDATED: "portraitos:review:checklist-updated",
        DELETED: "portraitos:review:deleted",
        CLEARED: "portraitos:review:cleared",
        IMAGE_UPLOADED: "portraitos:review:image-uploaded",
        IMAGE_REMOVED: "portraitos:review:image-removed"
    });

    let initialized = false;
    let state = createEmptyState();

    function init() {
        if (initialized) return getSnapshot();
        state = loadState();
        state = migrateState(state);
        state = normalizeState(state);
        cleanupOldBackups();
        initialized = true;
        return getSnapshot();
    }

    function ensureInitialized() {
        if (!initialized) init();
    }

    function create(profileId, input = {}) {
        ensureInitialized();
        const id = normalizeText(input.reviewId) || createId();
        const pid = normalizeText(profileId);
        if (!pid) throw createError("PROFILE_REQUIRED", "Selecciona un perfil antes de crear la revisión.");

        const now = new Date().toISOString();
        const checklist = normalizeChecklist(input.checklist);
        const status = input.status || "draft";

        const review = {
            reviewId: id,
            profileId: pid,
            generationId: normalizeNullableText(input.generationId),
            contractId: normalizeNullableText(input.contractId),
            contractHash: normalizeNullableText(input.contractHash),
            imageBinaryId: normalizeText(input.imageBinaryId),
            imageName: normalizeText(input.imageName),
            status,
            checklist,
            summary: normalizeText(input.summary),
            observations: normalizeArray(input.observations).map(normalizeObservation).filter(Boolean),
            decisionReason: normalizeText(input.decisionReason),
            score: calculateScore(checklist),
            createdAt: normalizeText(input.createdAt) || now,
            updatedAt: now,
            completedAt: status === "approved" || status === "rejected" ? now : null,
            schemaVersion: SCHEMA_VERSION,
            reviewVersion: VERSION
        };

        if (!state.entries[pid]) state.entries[pid] = [];
        state.entries[pid].unshift(review);
        state.entries[pid] = state.entries[pid].slice(0, 50);
        state.updatedAt = now;

        persist();
        emit(EVENTS.CREATED, { review: clone(review) });
        return deepFreeze(clone(review));
    }

    function update(reviewId, changes = {}) {
        ensureInitialized();
        const pid = normalizeText(changes.profileId);
        const review = findReview(reviewId, pid);
        if (!review) throw createError("REVIEW_NOT_FOUND", "No se ha encontrado la revisión solicitada.");

        const now = new Date().toISOString();
        const oldStatus = review.status;

        if (changes.generationId !== undefined) review.generationId = normalizeNullableText(changes.generationId);
        if (changes.contractId !== undefined) review.contractId = normalizeNullableText(changes.contractId);
        if (changes.contractHash !== undefined) review.contractHash = normalizeNullableText(changes.contractHash);
        if (changes.imageBinaryId !== undefined) review.imageBinaryId = normalizeText(changes.imageBinaryId);
        if (changes.imageName !== undefined) review.imageName = normalizeText(changes.imageName);
        if (changes.summary !== undefined) review.summary = normalizeText(changes.summary);
        if (changes.decisionReason !== undefined) review.decisionReason = normalizeText(changes.decisionReason);

        if (changes.checklist) {
            review.checklist = normalizeChecklist(changes.checklist);
            review.score = calculateScore(review.checklist);
            emit(EVENTS.CHECKLIST_UPDATED, { reviewId: review.reviewId, checklist: clone(review.checklist), score: clone(review.score) });
        }

        if (changes.status) {
            validateTransition(oldStatus, changes.status);
            review.status = changes.status;
            if (changes.status === "approved" || changes.status === "rejected") {
                review.completedAt = now;
            }
            emit(EVENTS.STATUS_CHANGED, { reviewId: review.reviewId, oldStatus, newStatus: changes.status });
        }

        if (changes.observations !== undefined) {
            review.observations = normalizeArray(changes.observations).map(normalizeObservation).filter(Boolean);
        }

        review.updatedAt = now;
        state.updatedAt = now;

        persist();
        emit(EVENTS.UPDATED, { review: clone(review) });
        return deepFreeze(clone(review));
    }

    function save(profileId, reviewData) {
        ensureInitialized();
        const pid = normalizeText(profileId);
        const existingId = normalizeText(reviewData?.id) || normalizeText(reviewData?.reviewId);
        if (existingId) {
            const existing = findReview(existingId, pid);
            if (existing) return update(existingId, { ...reviewData, profileId: pid });
        }
        return create(pid, reviewData);
    }

    function remove(reviewId, profileId) {
        ensureInitialized();
        const pid = normalizeText(profileId);
        const review = findReview(reviewId, pid);
        if (!review) return false;

        const targetPid = pid || review.profileId;
        if (review.imageBinaryId) {
            try { ProfileStorage.binary.remove(review.imageBinaryId); } catch (e) { /* ignore */ }
        }

        state.entries[targetPid] = (state.entries[targetPid] || []).filter(r => r.reviewId !== reviewId);
        state.updatedAt = new Date().toISOString();

        persist();
        emit(EVENTS.DELETED, { reviewId, profileId: targetPid });
        return true;
    }

    function clear(profileId) {
        ensureInitialized();
        const pid = normalizeText(profileId);
        if (!pid) return;

        const reviews = state.entries[pid] || [];
        reviews.forEach(r => {
            if (r.imageBinaryId) {
                try { ProfileStorage.binary.remove(r.imageBinaryId); } catch (e) { /* ignore */ }
            }
        });

        delete state.entries[pid];
        state.updatedAt = new Date().toISOString();

        persist();
        emit(EVENTS.CLEARED, { profileId: pid });
    }

    function getById(reviewId, profileId) {
        ensureInitialized();
        return findReview(reviewId, profileId) ? deepFreeze(clone(findReview(reviewId, profileId))) : null;
    }

    function list(profileId, options = {}) {
        ensureInitialized();
        const pid = normalizeText(profileId);
        if (!pid) return [];
        const reviews = state.entries[pid] || [];
        let filtered = reviews;
        if (options.status) filtered = filtered.filter(r => r.status === options.status);
        if (options.generationId) filtered = filtered.filter(r => r.generationId === normalizeText(options.generationId));
        if (options.contractId) filtered = filtered.filter(r => r.contractId === normalizeText(options.contractId));
        return deepFreeze(clone(filtered));
    }

    function getByGeneration(generationId) {
        ensureInitialized();
        const pid = normalizeText(generationId);
        if (!pid) return [];
        const results = [];
        Object.values(state.entries).forEach(reviews => {
            reviews.forEach(r => {
                if (r.generationId === pid) results.push(r);
            });
        });
        return deepFreeze(clone(results));
    }

    function getByContract(contractId) {
        ensureInitialized();
        const cid = normalizeText(contractId);
        if (!cid) return [];
        const results = [];
        Object.values(state.entries).forEach(reviews => {
            reviews.forEach(r => {
                if (r.contractId === cid) results.push(r);
            });
        });
        return deepFreeze(clone(results));
    }

    function calculateScore(checklist) {
        const items = Object.values(checklist || {});
        const weights = { critical: 4, major: 3, minor: 2, informational: 1 };
        let earnedPoints = 0;
        let maxPoints = 0;
        let criticalFailures = 0;
        let passed = 0;
        let failed = 0;
        let notApplicable = 0;
        let notReviewed = 0;

        items.forEach(item => {
            if (item.result === "not_applicable") { notApplicable++; return; }
            if (item.result === "not_reviewed") { notReviewed++; return; }
            const weight = weights[item.severity] || 1;
            maxPoints += weight;
            if (item.result === "pass") { earnedPoints += weight; passed++; }
            if (item.result === "fail") {
                failed++;
                if (item.severity === "critical") criticalFailures++;
            }
        });

        return {
            total: maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0,
            passed,
            failed,
            notApplicable,
            notReviewed,
            criticalFailures,
            hasBlockingIssues: criticalFailures > 0
        };
    }

    function calculateStatus(checklist, currentStatus) {
        const score = calculateScore(checklist);
        if (currentStatus === "draft") {
            if (score.notReviewed === 0 && score.total > 0) return "needs_review";
        }
        if (currentStatus === "needs_review" || currentStatus === "draft") {
            if (score.hasBlockingIssues) return "rejected";
        }
        return currentStatus;
    }

    async function resolveImage(review) {
        const binaryId = review?.imageBinaryId || review?.image?.binaryId;
        if (!binaryId) return "";
        try {
            const binary = await ProfileStorage.binary.get(binaryId);
            return binary?.blob ? await blobToDataUrl(binary.blob) : "";
        } catch (error) {
            console.warn("PortraitOS: no se pudo resolver la imagen de la revisión.", error);
            return "";
        }
    }

    async function setImage(reviewId, file, profileId) {
        ensureInitialized();
        const pid = normalizeText(profileId);
        const review = findReview(reviewId, pid);
        if (!review) throw createError("REVIEW_NOT_FOUND", "No se ha encontrado la revisión.");

        if (review.imageBinaryId) {
            try { ProfileStorage.binary.remove(review.imageBinaryId); } catch (e) { /* ignore */ }
        }

        const binaryId = `${pid}:review:${reviewId}:original`;
        let blob;
        if (file instanceof Blob) {
            blob = file;
        } else if (file instanceof ArrayBuffer || file instanceof Uint8Array) {
            blob = new Blob([file], { type: "image/png" });
        } else {
            blob = new Blob([file], { type: file?.type || "image/png" });
        }
        await ProfileStorage.binary.put({ binaryId, blob });

        review.imageBinaryId = binaryId;
        review.imageName = normalizeText(file?.name) || review.imageName;
        review.updatedAt = new Date().toISOString();
        state.updatedAt = review.updatedAt;

        persist();
        emit(EVENTS.IMAGE_UPLOADED, { reviewId, binaryId });
        return binaryId;
    }

    function exportReviews(profileId, options = {}) {
        ensureInitialized();
        const pid = normalizeText(profileId);
        const reviews = pid ? (state.entries[pid] || []) : getAllReviews();
        return deepFreeze({
            schema: "portraitos.review-export",
            schemaVersion: SCHEMA_VERSION,
            serviceVersion: VERSION,
            exportedAt: new Date().toISOString(),
            profileId: pid || null,
            count: reviews.length,
            entries: clone(reviews)
        });
    }

    function importReviews(payload, options = {}) {
        ensureInitialized();
        const source = normalizeImportPayload(payload);
        const strategy = normalizeText(options.strategy).toLowerCase() || "merge";
        if (!["merge", "replace", "append"].includes(strategy)) {
            throw createError("INVALID_IMPORT_STRATEGY", "La estrategia de importación no es válida.");
        }

        const profileId = normalizeText(options.profileId) || source.profileId;
        if (!profileId) throw createError("PROFILE_REQUIRED", "Debe indicarse el perfil destino.");

        const importedEntries = source.entries.map(e => normalizeStoredReview(e, profileId)).filter(Boolean);
        if (strategy === "replace") state.entries[profileId] = [];

        let imported = 0;
        let skipped = 0;

        importedEntries.forEach(entry => {
            const existing = (state.entries[profileId] || []).find(r => r.reviewId === entry.reviewId);
            if (strategy === "append" && existing) entry.reviewId = createId();
            if (strategy === "merge" && existing) {
                if (new Date(entry.updatedAt).getTime() <= new Date(existing.updatedAt).getTime()) { skipped++; return; }
            }
            if (!state.entries[profileId]) state.entries[profileId] = [];
            state.entries[profileId].push(entry);
            imported++;
        });

        state.updatedAt = new Date().toISOString();
        persist();
        return { imported, skipped, total: (state.entries[profileId] || []).length };
    }

    function getSnapshot() {
        return deepFreeze({
            schema: SCHEMA,
            schemaVersion: SCHEMA_VERSION,
            serviceVersion: VERSION,
            createdAt: state.createdAt,
            updatedAt: state.updatedAt,
            profileCount: Object.keys(state.entries).length,
            totalReviews: Object.values(state.entries).reduce((sum, arr) => sum + arr.length, 0)
        });
    }

    function loadState() {
        try {
            const stored = ProfileStorage.review.load(STORAGE_KEY);
            if (!stored) return createEmptyState();
            const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
            return parsed && typeof parsed === "object" ? parsed : createEmptyState();
        } catch (error) {
            console.warn("PortraitOS: no se pudo cargar el historial de revisiones.", error);
            return createEmptyState();
        }
    }

    function persist() {
        try {
            const current = readStorage();
            if (current) writeBackup(current);
            writeStorage(clone(state));
        } catch (error) {
            rollback();
            throw createError("STORAGE_FAILED", "No se pudo guardar la revisión. Se realizó rollback.", { cause: error });
        }
    }

    function readStorage() {
        try {
            return ProfileStorage.review.load(STORAGE_KEY) || null;
        } catch (e) { return null; }
    }

    function writeStorage(value) {
        ProfileStorage.review.save(STORAGE_KEY, JSON.stringify(value));
    }

    function writeBackup(data) {
        try {
            const backup = { data, timestamp: new Date().toISOString() };
            ProfileStorage.review.save(BACKUP_KEY, JSON.stringify(backup));
        } catch (e) { /* ignore backup failure */ }
    }

    function rollback() {
        try {
            const stored = ProfileStorage.review.load(BACKUP_KEY);
            if (stored) {
                const backup = JSON.parse(stored);
                if (backup?.data) {
                    state = backup.data;
                    writeStorage(state);
                }
            }
        } catch (e) { /* ignore rollback failure */ }
    }

    function cleanupOldBackups() {
        try {
            const stored = ProfileStorage.review.load(BACKUP_KEY);
            if (stored) {
                const backup = JSON.parse(stored);
                if (backup?.timestamp) {
                    const age = Date.now() - new Date(backup.timestamp).getTime();
                    if (age > BACKUP_TTL) ProfileStorage.review.save(BACKUP_KEY, "");
                }
            }
        } catch (e) { /* ignore cleanup failure */ }
    }

    function createEmptyState() {
        const now = new Date().toISOString();
        return { schema: SCHEMA, schemaVersion: SCHEMA_VERSION, serviceVersion: VERSION, createdAt: now, updatedAt: now, entries: {} };
    }

    function migrateState(value) {
        const source = normalizeObject(value);
        if (!source.schemaVersion) {
            const migrated = migrateFromV1(source);
            return { ...createEmptyState(), ...migrated, schemaVersion: SCHEMA_VERSION };
        }
        return source;
    }

    function migrateFromV1(oldState) {
        const entries = {};
        const oldEntries = oldState.reviews || {};
        Object.entries(oldEntries).forEach(([profileId, reviews]) => {
            entries[profileId] = reviews.map(r => migrateReviewV1(r, profileId)).filter(Boolean);
        });
        return { entries };
    }

    function migrateReviewV1(oldEntry, profileId) {
        if (!oldEntry?.id) return null;
        const checklist = {
            identity: { result: mapOldCheckResult(oldEntry.checks?.face), severity: "critical", notes: "", imageBinaryId: null, updatedAt: oldEntry.updatedAt || new Date().toISOString() },
            hair: { result: mapOldCheckResult(oldEntry.checks?.hair), severity: "major", notes: "", imageBinaryId: null, updatedAt: oldEntry.updatedAt || new Date().toISOString() },
            skin: { result: mapOldCheckResult(oldEntry.checks?.skin), severity: "major", notes: "", imageBinaryId: null, updatedAt: oldEntry.updatedAt || new Date().toISOString() },
            proportions: { result: "not_reviewed", severity: "critical", notes: "", imageBinaryId: null, updatedAt: oldEntry.updatedAt || new Date().toISOString() },
            distinctiveFeatures: { result: mapOldCheckResult(oldEntry.checks?.features), severity: "critical", notes: "", imageBinaryId: null, updatedAt: oldEntry.updatedAt || new Date().toISOString() },
            permanentAccessories: { result: mapOldCheckResult(oldEntry.checks?.accessories), severity: "minor", notes: "", imageBinaryId: null, updatedAt: oldEntry.updatedAt || new Date().toISOString() },
            creativeDirection: { result: mapOldCheckResult(oldEntry.checks?.direction), severity: "major", notes: "", imageBinaryId: null, updatedAt: oldEntry.updatedAt || new Date().toISOString() },
            composition: { result: "not_reviewed", severity: "major", notes: "", imageBinaryId: null, updatedAt: oldEntry.updatedAt || new Date().toISOString() },
            technicalQuality: { result: "not_reviewed", severity: "critical", notes: "", imageBinaryId: null, updatedAt: oldEntry.updatedAt || new Date().toISOString() }
        };
        return {
            reviewId: oldEntry.id,
            profileId,
            generationId: null,
            contractId: null,
            contractHash: null,
            imageBinaryId: "",
            imageName: oldEntry.imageName || "",
            status: mapOldStatus(oldEntry.status),
            checklist,
            summary: oldEntry.notes || "",
            observations: [],
            decisionReason: "",
            score: calculateScore(checklist),
            createdAt: oldEntry.createdAt || new Date().toISOString(),
            updatedAt: oldEntry.updatedAt || new Date().toISOString(),
            completedAt: null,
            schemaVersion: SCHEMA_VERSION,
            reviewVersion: VERSION
        };
    }

    function mapOldCheckResult(value) {
        if (value === "approved" || value === "pass") return "pass";
        if (value === "fail" || value === "rejected") return "fail";
        if (value === "review") return "not_reviewed";
        return "not_reviewed";
    }

    function mapOldStatus(oldStatus) {
        const map = { pending: "draft", review: "needs_review", approved: "approved", rejected: "rejected" };
        return map[oldStatus] || "draft";
    }

    function normalizeChecklist(value) {
        const categories = ["identity", "hair", "skin", "proportions", "distinctiveFeatures", "permanentAccessories", "creativeDirection", "composition", "technicalQuality"];
        const defaultSeverity = { identity: "critical", hair: "major", skin: "major", proportions: "critical", distinctiveFeatures: "critical", permanentAccessories: "minor", creativeDirection: "major", composition: "major", technicalQuality: "critical" };
        const result = {};
        categories.forEach(cat => {
            const item = value?.[cat] || {};
            result[cat] = {
                result: normalizeCheckResult(item.result),
                severity: normalizeCheckSeverity(item.severity) || defaultSeverity[cat] || "major",
                notes: normalizeText(item.notes),
                imageBinaryId: normalizeNullableText(item.imageBinaryId),
                updatedAt: normalizeText(item.updatedAt) || new Date().toISOString()
            };
        });
        return result;
    }

    function normalizeCheckResult(value) {
        const allowed = ["pass", "fail", "not_applicable", "not_reviewed"];
        const normalized = normalizeText(value).toLowerCase();
        return allowed.includes(normalized) ? normalized : "not_reviewed";
    }

    function normalizeCheckSeverity(value) {
        const allowed = ["critical", "major", "minor", "informational"];
        const normalized = normalizeText(value).toLowerCase();
        return allowed.includes(normalized) ? normalized : null;
    }

    function normalizeObservation(value) {
        if (!value || typeof value !== "object") return null;
        return {
            id: normalizeText(value.id) || createId(),
            category: normalizeText(value.category),
            severity: normalizeCheckSeverity(value.severity) || "informational",
            description: normalizeText(value.description),
            imageBinaryId: normalizeNullableText(value.imageBinaryId),
            createdAt: normalizeText(value.createdAt) || new Date().toISOString()
        };
    }

    function validateTransition(from, to) {
        const valid = { draft: ["needs_review", "approved", "rejected"], needs_review: ["draft", "approved", "rejected"], approved: ["draft"], rejected: ["draft"] };
        if (!valid[from]?.includes(to)) throw createError("INVALID_TRANSITION", `Transición no válida: ${from} → ${to}`);
    }

    function findReview(reviewId, profileId) {
        const pid = normalizeText(profileId);
        if (pid) return (state.entries[pid] || []).find(r => r.reviewId === reviewId) || null;
        for (const reviews of Object.values(state.entries)) {
            const found = reviews.find(r => r.reviewId === reviewId);
            if (found) return found;
        }
        return null;
    }

    function getAllReviews() {
        return Object.values(state.entries).flat();
    }

    function normalizeState(value) {
        const source = normalizeObject(value);
        return {
            schema: SCHEMA,
            schemaVersion: SCHEMA_VERSION,
            serviceVersion: VERSION,
            createdAt: normalizeText(source.createdAt) || new Date().toISOString(),
            updatedAt: normalizeText(source.updatedAt) || new Date().toISOString(),
            entries: normalizeObject(source.entries)
        };
    }

    function normalizeImportPayload(payload) {
        if (!payload || typeof payload !== "object") throw createError("INVALID_IMPORT", "El payload de importación no es válido.");
        return {
            schema: normalizeText(payload.schema),
            profileId: normalizeNullableText(payload.profileId),
            entries: normalizeArray(payload.entries)
        };
    }

    function normalizeStoredReview(value, profileId) {
        if (!value || typeof value !== "object") return null;
        const reviewId = normalizeText(value.reviewId) || normalizeText(value.id);
        if (!reviewId) return null;
        return {
            reviewId,
            profileId: normalizeText(value.profileId) || profileId,
            generationId: normalizeNullableText(value.generationId),
            contractId: normalizeNullableText(value.contractId),
            contractHash: normalizeNullableText(value.contractHash),
            imageBinaryId: normalizeText(value.imageBinaryId),
            imageName: normalizeText(value.imageName),
            status: normalizeText(value.status) || "draft",
            checklist: normalizeChecklist(value.checklist),
            summary: normalizeText(value.summary),
            observations: normalizeArray(value.observations).map(normalizeObservation).filter(Boolean),
            decisionReason: normalizeText(value.decisionReason),
            score: calculateScore(normalizeChecklist(value.checklist)),
            createdAt: normalizeText(value.createdAt) || new Date().toISOString(),
            updatedAt: normalizeText(value.updatedAt) || new Date().toISOString(),
            completedAt: normalizeNullableText(value.completedAt),
            schemaVersion: normalizeText(value.schemaVersion) || SCHEMA_VERSION,
            reviewVersion: normalizeText(value.reviewVersion) || VERSION
        };
    }

    function createId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `review-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }

    function normalizeText(value) { return String(value || "").trim(); }
    function normalizeNullableText(value) { const v = normalizeText(value); return v || null; }
    function normalizeArray(value) { return Array.isArray(value) ? value : []; }
    function normalizeObject(value) { return (value && typeof value === "object" && !Array.isArray(value)) ? value : {}; }
    function clone(value) { return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
    function deepFreeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(deepFreeze); return value; }
    function createError(code, message, details) { const error = new Error(message); error.name = "PortraitReviewError"; error.code = code; if (details) error.details = details; return error; }
    function emit(name, detail) { if (window.AppEvents?.emit) AppEvents.emit(name, detail); else window.dispatchEvent(new CustomEvent(name, { detail })); }

    return Object.freeze({
        VERSION,
        SCHEMA,
        SCHEMA_VERSION,
        EVENTS,
        init,
        create,
        update,
        save,
        remove,
        clear,
        getById,
        list,
        getByGeneration,
        getByContract,
        calculateScore,
        calculateStatus,
        resolveImage,
        setImage,
        exportReviews,
        importReviews,
        getSnapshot
    });

})();

window.PortraitReviewService = PortraitReviewService;
