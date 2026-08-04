"use strict";

/* ============================================================
   PortraitOS
   Storage Integrity
   ------------------------------------------------------------
   Informe estructurado de integridad referencial entre la
   biblioteca de perfiles, los binarios y las imágenes de Review.

   Contrato de salida:
   {
     valid: false,
     findings: [{ code, profileId, photoId, binaryId, detail }],
     orphanedRecords: [...],
     missingRecords: [...],
     migratedRecords: [...],
     repairedRecords: []
   }

   Códigos: missing_binary, orphan_binary, missing_thumbnail,
   wrong_profile, checksum_mismatch, legacy_inline,
   stale_object_reference, invalid_primary, missing_profile.

   Esta capa nunca borra datos por sí misma: reporta. La única
   operación de limpieza es cleanup(), explícita y probada.
   ============================================================ */

const StorageIntegrity = (() => {

    const REVIEW_BINARY_KIND = "review-image";

    function report(library, binaries, reviewsState = null) {
        const findings = [];
        const orphanedRecords = [];
        const missingRecords = [];
        const migratedRecords = [];
        const repairedRecords = [];
        const profiles = new Map((library?.profiles || []).map(profile => [profile.id, profile]));
        const binaryById = new Map((binaries || []).map(binary => [binary.binaryId, binary]));
        const referenced = new Set();
        const reviewRefs = collectReviewReferences(reviewsState);

        reviewRefs.forEach(binaryId => referenced.add(binaryId));

        for (const profile of profiles.values()) {
            let primaryCount = 0;
            for (const photo of profile.identity?.photos || []) {
                const photoContext = { profileId: profile.id, photoId: photo.id };
                if (typeof photo.source?.dataUrl === "string") {
                    findings.push({ code: "legacy_inline", ...photoContext, detail: "source.dataUrl presente en el agregado confirmado." });
                }
                if (typeof photo.thumbnail?.dataUrl === "string") {
                    findings.push({ code: "legacy_inline", ...photoContext, detail: "thumbnail.dataUrl presente en el agregado confirmado." });
                }

                const sourceBinary = inspectHolder("source", photo, binaryById, referenced, findings, missingRecords, photoContext);
                const thumbnailBinary = inspectHolder("thumbnail", photo, binaryById, referenced, findings, missingRecords, photoContext, true);

                if (photo.isPrimary) {
                    primaryCount += 1;
                    if (!photo.source?.binaryId || !sourceBinary) {
                        findings.push({ code: "invalid_primary", ...photoContext, detail: "La fotografía principal no tiene binario original." });
                    }
                }
                if (thumbnailBinary && !sourceBinary) {
                    findings.push({ code: "missing_binary", ...photoContext, detail: "Miniatura sin binario original asociado." });
                }
                if (!photo.thumbnail?.binaryId && !photo.thumbnail?.dataUrl) {
                    findings.push({ code: "missing_thumbnail", ...photoContext, detail: "La fotografía no tiene miniatura." });
                }
            }
            if (profile.identity?.photos?.length && primaryCount === 0) {
                findings.push({ code: "invalid_primary", profileId: profile.id, detail: "El perfil no tiene fotografía principal." });
            }
        }

        for (const binary of binaries || []) {
            const profile = profiles.get(binary.profileId);
            if (!profile) {
                orphanedRecords.push({ code: "missing_profile", binaryId: binary.binaryId, profileId: binary.profileId });
                continue;
            }
            if (binary.kind === REVIEW_BINARY_KIND) {
                if (!referenced.has(binary.binaryId)) {
                    orphanedRecords.push({ code: "orphan_binary", binaryId: binary.binaryId, profileId: binary.profileId });
                } else {
                    migratedRecords.push({ binaryId: binary.binaryId, profileId: binary.profileId });
                }
                continue;
            }
            if (!referenced.has(binary.binaryId)) {
                orphanedRecords.push({ code: "orphan_binary", binaryId: binary.binaryId, profileId: binary.profileId });
            }
        }

        const stale = findStaleObjectReferences(library, reviewsState);
        stale.forEach(item => findings.push(item));

        return {
            valid: findings.length === 0 && orphanedRecords.length === 0,
            findings,
            orphanedRecords,
            missingRecords,
            migratedRecords,
            repairedRecords,
            totals: {
                findings: findings.length,
                orphanedRecords: orphanedRecords.length,
                missingRecords: missingRecords.length,
                migratedRecords: migratedRecords.length,
                repairedRecords: repairedRecords.length
            }
        };
    }

    function inspectHolder(kind, photo, binaryById, referenced, findings, missingRecords, context, isThumbnail = false) {
        const holder = photo[kind];
        if (!holder || typeof holder !== "object") return null;
        const binaryId = holder.binaryId;
        if (!binaryId) {
            if (isThumbnail) findings.push({ code: "missing_thumbnail", ...context, detail: "Falta binaryId de miniatura." });
            return null;
        }
        referenced.add(binaryId);
        const binary = binaryById.get(binaryId);
        if (!binary) {
            const code = isThumbnail ? "missing_thumbnail" : "missing_binary";
            findings.push({ code, ...context, binaryId, detail: `Binario ${code} no encontrado.` });
            missingRecords.push({ code, ...context, binaryId });
            return null;
        }
        if (binary.profileId && binary.profileId !== context.profileId) {
            findings.push({ code: "wrong_profile", ...context, binaryId, detail: "El binario pertenece a otro perfil." });
        }
        if (kind === "source" && photo.checksum && binary.checksum && photo.checksum !== binary.checksum) {
            findings.push({ code: "checksum_mismatch", ...context, binaryId, detail: "Checksum del binario no coincide con la foto." });
        }
        return binary;
    }

    function collectReviewReferences(reviewsState) {
        const refs = [];
        const reviews = reviewsState?.reviews || {};
        for (const profileId of Object.keys(reviews)) {
            for (const review of reviews[profileId] || []) {
                const image = review?.image;
                if (image && typeof image === "object" && image.binaryId) {
                    refs.push(image.binaryId);
                }
            }
        }
        return refs;
    }

    function findStaleObjectReferences(library, reviewsState) {
        const findings = [];
        const walk = (value, path) => {
            if (typeof value === "string") {
                if (/^blob:/i.test(value)) {
                    findings.push({ code: "stale_object_reference", detail: `Referencia blob: persistida en ${path}.` });
                }
                return;
            }
            if (Array.isArray(value)) {
                value.forEach((item, index) => walk(item, `${path}[${index}]`));
                return;
            }
            if (value && typeof value === "object") {
                Object.entries(value).forEach(([key, item]) => walk(item, path ? `${path}.${key}` : key));
            }
        };
        walk(library, "library");
        const reviews = reviewsState?.reviews || {};
        for (const profileId of Object.keys(reviews)) {
            for (const review of reviews[profileId] || []) {
                if (typeof review?.image === "string" && /^blob:/i.test(review.image)) {
                    findings.push({ code: "stale_object_reference", profileId, reviewId: review.id, detail: "Imagen de revisión persistida como Object URL." });
                }
            }
        }
        return findings;
    }

    function cleanupOrphans(library, binaries, reviewsState = null) {
        const base = report(library, binaries, reviewsState);
        const removals = base.orphanedRecords
            .filter(item => item.code === "orphan_binary" || item.code === "missing_profile")
            .map(item => item.binaryId);
        return { base, removals };
    }

    return Object.freeze({
        report,
        cleanupOrphans,
        REVIEW_BINARY_KIND
    });

})();

window.StorageIntegrity = StorageIntegrity;
