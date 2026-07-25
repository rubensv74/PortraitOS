"use strict";

const ReviewBinding = (() => {
    const CHECKS = ["face", "age", "hair", "beard", "skin", "features", "accessories", "direction"];
    let root = null;
    let currentImage = "";
    let currentImageName = "";
    let currentReviewId = null;

    function init() {
        root = document.querySelector("[data-review-binding]");
        if (!root || !window.PortraitReviewService) return false;
        bindEvents();
        resetForm();
        renderHistory();
        window.addEventListener("profile-manager:changed", handleProfileChange);
        window.addEventListener("profile-manager:saved", handleProfileChange);
        return true;
    }

    function bindEvents() {
        root.querySelector("[data-review-image]")?.addEventListener("change", handleImage);
        root.querySelector("[data-action='save-review']")?.addEventListener("click", saveReview);
        root.querySelector("[data-action='reset-review']")?.addEventListener("click", resetForm);
        root.querySelector("[data-action='clear-review-history']")?.addEventListener("click", clearHistory);
        root.addEventListener("change", event => {
            if (event.target.matches("[data-review-check]")) updateStatus();
        });
        root.addEventListener("click", event => {
            const loadButton = event.target.closest("[data-review-load]");
            const deleteButton = event.target.closest("[data-review-delete]");
            if (loadButton) loadReview(loadButton.dataset.reviewLoad);
            if (deleteButton) deleteReview(deleteButton.dataset.reviewDelete);
        });
    }

    function handleImage(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) return showMessage("Selecciona un archivo de imagen válido.", true);
        const reader = new FileReader();
        reader.onload = () => {
            currentImage = String(reader.result || "");
            currentImageName = file.name;
            renderImage();
            showMessage("Imagen preparada para revisión.");
        };
        reader.onerror = () => showMessage("No se pudo leer la imagen.", true);
        reader.readAsDataURL(file);
    }

    function saveReview() {
        try {
            const profileId = getProfileId();
            if (!currentImage) throw new Error("Importa una imagen antes de guardar la revisión.");
            const review = PortraitReviewService.save(profileId, {
                id: currentReviewId,
                image: currentImage,
                imageName: currentImageName,
                checks: collectChecks(),
                notes: root.querySelector("[data-review-notes]")?.value || ""
            });
            currentReviewId = review.id;
            updateStatus(review.status);
            renderHistory();
            showMessage("Revisión guardada correctamente.");
        } catch (error) {
            showMessage(error.message || "No se pudo guardar la revisión.", true);
        }
    }

    function collectChecks() {
        return CHECKS.reduce((result, key) => {
            result[key] = root.querySelector(`[name='review-${key}']:checked`)?.value || "pending";
            return result;
        }, {});
    }

    function updateStatus(forcedStatus) {
        const status = forcedStatus || PortraitReviewService.calculateStatus(collectChecks());
        const labels = { pending: "Sin evaluar", approved: "Aprobada", review: "Requiere revisión", rejected: "Rechazada" };
        const output = root.querySelector("[data-review-status]");
        if (output) {
            output.textContent = labels[status] || labels.pending;
            output.dataset.status = status;
        }
    }

    function renderHistory() {
        const list = root.querySelector("[data-review-history]");
        if (!list) return;
        const reviews = PortraitReviewService.list(getProfileId());
        if (!reviews.length) {
            list.innerHTML = `<div class="empty-state"><strong>No hay revisiones guardadas.</strong><span>Las revisiones aparecerán aquí.</span></div>`;
            return;
        }
        const labels = { approved: "Aprobada", review: "Requiere revisión", rejected: "Rechazada", pending: "Sin evaluar" };
        list.innerHTML = reviews.map(item => `
            <article class="review-history__item">
                <img src="${escapeAttribute(item.image)}" alt="${escapeAttribute(item.imageName || "Imagen revisada")}">
                <div><strong>${escapeHtml(item.imageName || "Imagen sin nombre")}</strong><small>${formatDate(item.updatedAt)}</small><span class="review-status" data-status="${item.status}">${labels[item.status] || labels.pending}</span></div>
                <div class="review-history__actions"><button type="button" class="button button--tertiary" data-review-load="${item.id}">Abrir</button><button type="button" class="button button--tertiary" data-review-delete="${item.id}">Eliminar</button></div>
            </article>`).join("");
    }

    function loadReview(reviewId) {
        const review = PortraitReviewService.list(getProfileId()).find(item => item.id === reviewId);
        if (!review) return;
        currentReviewId = review.id;
        currentImage = review.image;
        currentImageName = review.imageName;
        renderImage();
        CHECKS.forEach(key => {
            const input = root.querySelector(`[name='review-${key}'][value='${review.checks?.[key] || "pending"}']`);
            if (input) input.checked = true;
        });
        const notes = root.querySelector("[data-review-notes]");
        if (notes) notes.value = review.notes || "";
        updateStatus(review.status);
        showMessage("Revisión cargada.");
    }

    function deleteReview(reviewId) {
        if (!window.confirm("¿Eliminar esta revisión?")) return;
        PortraitReviewService.remove(getProfileId(), reviewId);
        if (currentReviewId === reviewId) resetForm();
        renderHistory();
        showMessage("Revisión eliminada.");
    }

    function clearHistory() {
        if (!window.confirm("¿Eliminar todo el historial de revisiones del perfil activo?")) return;
        PortraitReviewService.clear(getProfileId());
        resetForm();
        renderHistory();
        showMessage("Historial eliminado.");
    }

    function resetForm() {
        currentReviewId = null;
        currentImage = "";
        currentImageName = "";
        const file = root?.querySelector("[data-review-image]");
        if (file) file.value = "";
        root?.querySelectorAll("[data-review-check][value='pending']").forEach(input => { input.checked = true; });
        const notes = root?.querySelector("[data-review-notes]");
        if (notes) notes.value = "";
        renderImage();
        updateStatus("pending");
    }

    function renderImage() {
        const image = root.querySelector("[data-review-preview]");
        const empty = root.querySelector("[data-review-preview-empty]");
        if (image) { image.src = currentImage || ""; image.hidden = !currentImage; }
        if (empty) empty.hidden = Boolean(currentImage);
    }

    function handleProfileChange() { resetForm(); renderHistory(); }
    function getProfileId() { return window.ProfileService?.getActive?.()?.id || window.ProfileManager?.getState?.()?.activeProfileId || "default"; }
    function showMessage(message, isError = false) {
        const output = root.querySelector("[data-review-message]");
        if (!output) return;
        output.textContent = message;
        output.dataset.error = String(isError);
    }
    function formatDate(value) { try { return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value || ""; } }
    function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character])); }
    function escapeAttribute(value) { return escapeHtml(value); }

    return Object.freeze({ init });
})();

window.ReviewBinding = ReviewBinding;
