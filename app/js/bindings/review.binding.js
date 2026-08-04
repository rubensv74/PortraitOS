"use strict";

/* ============================================================
   PortraitOS
   Review Binding
   ------------------------------------------------------------
   Responsabilidad:
   - UI del sistema de revisión de retratos.
   - Checklist estructurado con 9 categorías.
   - Binary storage para imágenes.
   - Asociación con generación y contrato.
   - Score y status display.
   - Historial con scores.
   ============================================================ */

const ReviewBinding = (() => {

    const CHECKLIST_CATEGORIES = [
        "identity", "hair", "skin", "proportions", "distinctiveFeatures",
        "permanentAccessories", "creativeDirection", "composition", "technicalQuality"
    ];

    const CATEGORY_LABELS = {
        identity: "Identidad",
        hair: "Cabello",
        skin: "Piel",
        proportions: "Proporciones",
        distinctiveFeatures: "Rasgos distintivos",
        permanentAccessories: "Accesorios permanentes",
        creativeDirection: "Dirección creativa",
        composition: "Composición",
        technicalQuality: "Calidad técnica"
    };

    const SEVERITY_LABELS = {
        critical: "Crítico",
        major: "Mayor",
        minor: "Menor",
        informational: "Informativo"
    };

    const RESULT_LABELS = {
        pass: "Aprobado",
        fail: "Rechazado",
        not_applicable: "No aplica",
        not_reviewed: "Sin revisar"
    };

    const STATUS_LABELS = {
        draft: "Borrador",
        needs_review: "Requiere revisión",
        approved: "Aprobada",
        rejected: "Rechazada"
    };

    let root = null;
    let currentReviewId = null;
    let currentProfileId = null;
    let listeners = [];

    function init() {
        root = document.querySelector("[data-review-binding]");
        if (!root || !window.PortraitReviewService) return false;

        currentProfileId = getProfileId();
        bindEvents();
        renderForm();
        renderHistory();
        registerListeners();
        return true;
    }

    function destroy() {
        listeners.forEach(off => off());
        listeners = [];
        root = null;
        currentReviewId = null;
        currentProfileId = null;
    }

    function registerListeners() {
        if (window.AppEvents?.on) {
            listeners.push(window.AppEvents.on("portraitos:review:created", handleReviewChanged));
            listeners.push(window.AppEvents.on("portraitos:review:updated", handleReviewChanged));
            listeners.push(window.AppEvents.on("portraitos:review:deleted", handleReviewChanged));
            listeners.push(window.AppEvents.on("portraitos:review:cleared", handleReviewChanged));
            listeners.push(window.AppEvents.on("profile-manager:changed", handleProfileChange));
            listeners.push(window.AppEvents.on("profile-manager:saved", handleProfileChange));
        } else {
            window.addEventListener("portraitos:review:created", handleReviewChanged);
            window.addEventListener("portraitos:review:updated", handleReviewChanged);
            window.addEventListener("portraitos:review:deleted", handleReviewChanged);
            window.addEventListener("portraitos:review:cleared", handleReviewChanged);
            window.addEventListener("profile-manager:changed", handleProfileChange);
            window.addEventListener("profile-manager:saved", handleProfileChange);
        }
    }

    function bindEvents() {
        root.querySelector("[data-review-image]")?.addEventListener("change", handleImage);
        root.querySelector("[data-action='save-review']")?.addEventListener("click", saveReview);
        root.querySelector("[data-action='reset-review']")?.addEventListener("click", resetForm);
        root.querySelector("[data-action='clear-review-history']")?.addEventListener("click", clearHistory);
        root.addEventListener("change", event => {
            if (event.target.matches("[data-review-check]") || event.target.matches("[data-review-severity]")) updateScore();
        });
        root.addEventListener("click", event => {
            const loadButton = event.target.closest("[data-review-load]");
            const deleteButton = event.target.closest("[data-review-delete]");
            if (loadButton) loadReview(loadButton.dataset.reviewLoad);
            if (deleteButton) deleteReview(deleteButton.dataset.reviewDelete);
        });
    }

    async function handleImage(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) return showMessage("Selecciona un archivo de imagen válido.", true);
        try {
            const reader = new FileReader();
            reader.onload = () => {
                renderImagePreview(reader.result);
                showMessage("Imagen preparada para revisión.");
            };
            reader.onerror = () => showMessage("No se pudo leer la imagen.", true);
            reader.readAsDataURL(file);
        } catch (error) {
            showMessage("Error al procesar la imagen.", true);
        }
    }

    async function saveReview() {
        try {
            const profileId = getProfileId();
            if (!profileId) throw new Error("Selecciona un perfil.");

            const imageInput = root.querySelector("[data-review-image]");
            const file = imageInput?.files?.[0];

            const checklist = collectChecklist();
            const status = root.querySelector("[data-review-status-select]")?.value || "draft";

            const reviewData = {
                reviewId: currentReviewId,
                generationId: normalizeNullableText(root.querySelector("[data-review-generation-id]")?.value),
                contractId: normalizeNullableText(root.querySelector("[data-review-contract-id]")?.value),
                contractHash: normalizeNullableText(root.querySelector("[data-review-contract-hash]")?.value),
                imageName: file?.name || "",
                status,
                checklist,
                summary: root.querySelector("[data-review-summary]")?.value || "",
                decisionReason: root.querySelector("[data-review-decision-reason]")?.value || ""
            };

            let review;
            if (currentReviewId) {
                review = await PortraitReviewService.update(currentReviewId, { ...reviewData, profileId });
            } else {
                review = await PortraitReviewService.create(profileId, reviewData);
            }

            if (file) {
                await PortraitReviewService.setImage(review.reviewId, file, profileId);
            }

            currentReviewId = review.reviewId;
            updateStatusDisplay(review.status);
            updateScoreDisplay(review.score);
            renderHistory();
            showMessage("Revisión guardada correctamente.");
        } catch (error) {
            showMessage(error.message || "No se pudo guardar la revisión.", true);
        }
    }

    function collectChecklist() {
        const checklist = {};
        CHECKLIST_CATEGORIES.forEach(category => {
            const resultInput = root.querySelector(`[name='review-${category}-result']:checked`);
            const severityInput = root.querySelector(`[name='review-${category}-severity']:checked`);
            const notesInput = root.querySelector(`[data-review-check-notes='${category}']`);
            checklist[category] = {
                result: resultInput?.value || "not_reviewed",
                severity: severityInput?.value || "major",
                notes: notesInput?.value || "",
                imageBinaryId: null,
                updatedAt: new Date().toISOString()
            };
        });
        return checklist;
    }

    function updateScore() {
        const checklist = collectChecklist();
        const score = PortraitReviewService.calculateScore(checklist);
        updateScoreDisplay(score);
    }

    function updateScoreDisplay(score) {
        const output = root.querySelector("[data-review-score]");
        if (output) {
            output.textContent = score.total;
            output.dataset.hasBlocking = String(score.hasBlockingIssues);
        }
        const details = root.querySelector("[data-review-score-details]");
        if (details) {
            details.textContent = `${score.passed} aprobados, ${score.failed} rechazados, ${score.notApplicable} no aplica, ${score.notReviewed} sin revisar`;
        }
    }

    function updateStatusDisplay(status) {
        const output = root.querySelector("[data-review-status]");
        if (output) {
            output.textContent = STATUS_LABELS[status] || STATUS_LABELS.draft;
            output.dataset.status = status;
        }
        const select = root.querySelector("[data-review-status-select]");
        if (select) select.value = status;
    }

    function renderForm() {
        if (!root) return;
        CHECKLIST_CATEGORIES.forEach(category => {
            renderChecklistCategory(category);
        });
        updateScore();
        updateStatusDisplay("draft");
    }

    function renderChecklistCategory(category) {
        const container = root.querySelector(`[data-review-category='${category}']`);
        if (!container) return;

        const label = container.querySelector("[data-category-label]");
        if (label) label.textContent = CATEGORY_LABELS[category] || category;

        const severityBadge = container.querySelector("[data-category-severity]");
        if (severityBadge) {
            const defaultSeverity = PortraitReviewService.calculateScore({ [category]: { result: "pass", severity: "major" } });
            severityBadge.textContent = SEVERITY_LABELS["major"];
            severityBadge.dataset.severity = "major";
        }
    }

    function renderHistory() {
        const list = root.querySelector("[data-review-history]");
        if (!list) return;
        const profileId = getProfileId();
        const reviews = PortraitReviewService.list(profileId);

        if (!reviews.length) {
            list.innerHTML = `<div class="empty-state"><strong>No hay revisiones guardadas.</strong><span>Las revisiones aparecerán aquí.</span></div>`;
            return;
        }

        list.innerHTML = reviews.map(item => `
            <article class="review-history__item">
                <div class="review-history__info">
                    <strong>${escapeHtml(item.imageName || "Imagen sin nombre")}</strong>
                    <small>${formatDate(item.updatedAt)}</small>
                    <span class="review-status" data-status="${item.status}">${STATUS_LABELS[item.status] || STATUS_LABELS.draft}</span>
                    <span class="review-score" data-has-blocking="${item.score?.hasBlockingIssues || false}">${item.score?.total || 0}</span>
                </div>
                <div class="review-history__actions">
                    <button type="button" class="button button--tertiary" data-review-load="${item.reviewId}">Abrir</button>
                    <button type="button" class="button button--tertiary" data-review-delete="${item.reviewId}">Eliminar</button>
                </div>
            </article>
        `).join("");

        reviews.forEach(item => {
            PortraitReviewService.resolveImage(item).then(src => {
                const thumb = list.querySelector(`[data-review-thumb='${item.reviewId}']`);
                if (thumb && src) thumb.src = src;
            });
        });
    }

    async function loadReview(reviewId) {
        const profileId = getProfileId();
        const review = PortraitReviewService.getById(reviewId, profileId);
        if (!review) return;

        currentReviewId = review.reviewId;

        root.querySelector("[data-review-generation-id]") && (root.querySelector("[data-review-generation-id]").value = review.generationId || "");
        root.querySelector("[data-review-contract-id]") && (root.querySelector("[data-review-contract-id]").value = review.contractId || "");
        root.querySelector("[data-review-contract-hash]") && (root.querySelector("[data-review-contract-hash]").value = review.contractHash || "");
        root.querySelector("[data-review-summary]") && (root.querySelector("[data-review-summary]").value = review.summary || "");
        root.querySelector("[data-review-decision-reason]") && (root.querySelector("[data-review-decision-reason]").value = review.decisionReason || "");

        CHECKLIST_CATEGORIES.forEach(category => {
            const item = review.checklist[category];
            if (!item) return;
            const resultInput = root.querySelector(`[name='review-${category}-result'][value='${item.result}']`);
            if (resultInput) resultInput.checked = true;
            const severityInput = root.querySelector(`[name='review-${category}-severity'][value='${item.severity}']`);
            if (severityInput) severityInput.checked = true;
            const notesInput = root.querySelector(`[data-review-check-notes='${category}']`);
            if (notesInput) notesInput.value = item.notes || "";
        });

        const src = await PortraitReviewService.resolveImage(review);
        renderImagePreview(src);

        updateStatusDisplay(review.status);
        updateScoreDisplay(review.score);
        showMessage("Revisión cargada.");
    }

    function deleteReview(reviewId) {
        if (!window.confirm("¿Eliminar esta revisión?")) return;
        PortraitReviewService.remove(reviewId, getProfileId());
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
        const image = root?.querySelector("[data-review-image]");
        if (image) image.value = "";
        root?.querySelectorAll("[data-review-preview]")?.forEach(el => { el.src = ""; el.hidden = true; });
        root?.querySelectorAll("[data-review-preview-empty]")?.forEach(el => { el.hidden = false; });
        root?.querySelectorAll("[data-review-check-result]").forEach(input => { if (input.value === "not_reviewed") input.checked = true; });
        root?.querySelectorAll("[data-review-check-severity]").forEach(input => { if (input.value === "major") input.checked = true; });
        root?.querySelectorAll("[data-review-check-notes]").forEach(input => { input.value = ""; });
        root?.querySelectorAll("[data-review-generation-id], [data-review-contract-id], [data-review-contract-hash]").forEach(input => { input.value = ""; });
        root?.querySelector("[data-review-summary]") && (root.querySelector("[data-review-summary]").value = "");
        root?.querySelector("[data-review-decision-reason]") && (root.querySelector("[data-review-decision-reason]").value = "");
        renderImagePreview("");
        updateStatusDisplay("draft");
        updateScore();
    }

    function renderImagePreview(src) {
        root?.querySelectorAll("[data-review-preview]").forEach(el => {
            el.src = src || "";
            el.hidden = !src;
        });
        root?.querySelectorAll("[data-review-preview-empty]").forEach(el => {
            el.hidden = Boolean(src);
        });
    }

    function handleReviewChanged() { renderHistory(); }
    function handleProfileChange() { currentProfileId = getProfileId(); resetForm(); renderHistory(); }
    function getProfileId() { return window.ProfileService?.getActive?.()?.id || window.ProfileManager?.getState?.()?.activeProfileId || "default"; }
    function normalizeNullableText(value) { const v = String(value || "").trim(); return v || null; }
    function showMessage(message, isError = false) {
        const output = root.querySelector("[data-review-message]");
        if (!output) return;
        output.textContent = message;
        output.dataset.error = String(isError);
    }
    function formatDate(value) { try { return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value || ""; } }
    function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character])); }

    return Object.freeze({ init, destroy });

})();

window.ReviewBinding = ReviewBinding;
