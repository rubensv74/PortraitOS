"use strict";

const PortraitReviewService = (() => {
    const STORAGE_KEY = "portraitos.reviews.v1";
    const VERSION = "1.0";

    function list(profileId) {
        const id = normalizeText(profileId);
        if (!id) return [];
        const state = read();
        return clone(state.reviews[id] || []);
    }

    function save(profileId, review) {
        const id = normalizeText(profileId);
        if (!id) throw createError("PROFILE_REQUIRED", "Selecciona un perfil antes de guardar la revisión.");
        const normalized = normalizeReview(review, id);
        const state = read();
        const reviews = state.reviews[id] || [];
        const index = reviews.findIndex(item => item.id === normalized.id);
        if (index >= 0) reviews[index] = normalized;
        else reviews.unshift(normalized);
        state.reviews[id] = reviews.slice(0, 25);
        write(state);
        emit("portraitos:review:saved", normalized);
        return clone(normalized);
    }

    function remove(profileId, reviewId) {
        const id = normalizeText(profileId);
        const targetId = normalizeText(reviewId);
        const state = read();
        state.reviews[id] = (state.reviews[id] || []).filter(item => item.id !== targetId);
        write(state);
        emit("portraitos:review:removed", { profileId: id, reviewId: targetId });
        return list(id);
    }

    function clear(profileId) {
        const id = normalizeText(profileId);
        const state = read();
        delete state.reviews[id];
        write(state);
        emit("portraitos:review:cleared", { profileId: id });
    }

    function calculateStatus(checks) {
        const values = Object.values(checks || {});
        if (!values.length || values.every(value => value === "pending")) return "pending";
        if (values.some(value => value === "fail")) return "rejected";
        if (values.some(value => value === "review" || value === "pending")) return "review";
        return "approved";
    }

    function normalizeReview(review, profileId) {
        const now = new Date().toISOString();
        const checks = review?.checks && typeof review.checks === "object" ? { ...review.checks } : {};
        return {
            id: normalizeText(review?.id) || createId(),
            profileId,
            image: normalizeText(review?.image),
            imageName: normalizeText(review?.imageName),
            checks,
            status: calculateStatus(checks),
            notes: normalizeText(review?.notes),
            createdAt: normalizeText(review?.createdAt) || now,
            updatedAt: now,
            version: VERSION
        };
    }

    function read() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (parsed && parsed.reviews && typeof parsed.reviews === "object") return parsed;
        } catch (error) {
            console.warn("PortraitOS: no se pudo leer el historial de revisiones.", error);
        }
        return { version: VERSION, reviews: {} };
    }

    function write(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            throw createError("STORAGE_FAILED", "No se pudo guardar la revisión. La imagen puede ser demasiado grande para el almacenamiento local.");
        }
    }

    function createId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `review-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function normalizeText(value) { return String(value || "").trim(); }
    function clone(value) { return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
    function createError(code, message) { const error = new Error(message); error.name = "PortraitReviewError"; error.code = code; return error; }
    function emit(name, detail) {
        if (window.AppEvents?.emit) AppEvents.emit(name, detail);
        else window.dispatchEvent(new CustomEvent(name, { detail }));
    }

    return Object.freeze({ list, save, remove, clear, calculateStatus });
})();

window.PortraitReviewService = PortraitReviewService;
