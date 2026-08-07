"use strict";

const DemoModeService = (() => {
    const DEMO_NAME = "Demo RC1 — Retrato editorial";
    const DEMO_TAG = "portraitos-demo-rc1";
    const DEMO_SOURCE = "PortraitOS Demo Mode";

    const IDENTITY_SECTIONS = Object.freeze([
        "general",
        "face",
        "skin",
        "hair",
        "eyes",
        "nose",
        "mouth",
        "jaw",
        "facial-hair",
        "age-markers",
        "asymmetries",
        "distinctive-features"
    ]);

    const CRITICAL_EVIDENCE = Object.freeze({
        face: 0,
        eyes: 0,
        nose: 0,
        mouth: 0,
        jaw: 0,
        skin: 1,
        hair: 2,
        "distinctive-features": 3
    });

    let running = false;

    function getState() {
        const existing = findExistingDemo();
        return Object.freeze({
            running,
            exists: Boolean(existing),
            profileId: existing?.id || null,
            profileName: existing?.name || null
        });
    }

    async function prepare(options = {}) {
        if (running) throw createError("DEMO_ALREADY_RUNNING", "La demo ya se está preparando.");
        validateDependencies();
        running = true;
        const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};

        try {
            const existing = findExistingDemo();
            if (existing && options.replace !== true) {
                onProgress("existing", "Se reutiliza el perfil demo existente.");
                ProfileManager.select(existing.id);
                ProfileManager.saveActive();
                return buildResult({ reused: true });
            }

            if (existing && options.replace === true) {
                onProgress("cleanup", "Eliminando demo anterior.");
                removeProfileSafely(existing.id);
            }

            onProgress("profile", "Creando perfil de demostración.");
            const profile = ProfileManager.create({
                name: DEMO_NAME,
                description: "Escenario sintético RC1 para demostrar PortraitOS. No contiene datos ni fotografías de personas reales."
            });
            ProfileService.update({
                tags: [DEMO_TAG, "demo", "rc1", "editorial"],
                updatedBy: DEMO_SOURCE
            });
            ProfileManager.saveActive();

            onProgress("photos", "Generando cinco fotografías sintéticas.");
            const files = await createSyntheticFiles();
            const photos = await ProfileService.photos.addMany(files);
            const roles = ["front", "three-quarter", "profile-left", "profile-right", "detail"];
            photos.forEach((photo, index) => {
                ProfileService.photos.update(photo.id, {
                    role: roles[index],
                    name: `Referencia sintética ${index + 1}`,
                    notes: "Fixture visual abstracto de Demo Mode. No representa una persona real."
                });
            });
            ProfileService.photos.setPrimary(photos[0].id);
            ProfileManager.saveActive();

            onProgress("identity", "Construyendo contrato de identidad sintético.");
            ProfileService.identity.updateGeneral({
                summary: "Identidad sintética de demostración: rasgos estables descritos para validar el flujo, sin corresponder a ninguna persona real.",
                ageAppearance: "adulto",
                genderPresentation: "neutral"
            });

            IDENTITY_SECTIONS.forEach(section => {
                ProfileService.identity.updateSection(section, {
                    description: identityDescription(section),
                    confidence: "verified",
                    notes: "Dato sintético RC1."
                });
            });

            Object.entries(CRITICAL_EVIDENCE).forEach(([section, photoIndex]) => {
                ProfileService.identity.linkEvidence(section, photos[photoIndex].id, {
                    note: "Evidencia sintética vinculada por Demo Mode."
                });
            });

            ProfileService.identity.validate(DEMO_SOURCE);
            const evidenceState = ProfileService.identity.getEvidenceState();
            if (!evidenceState.readyForLock) {
                throw createError("DEMO_EVIDENCE_NOT_READY", "La evidencia sintética no alcanzó los requisitos de bloqueo.");
            }
            ProfileService.identity.lock({ confirm: true, lockedBy: DEMO_SOURCE });
            ProfileManager.saveActive();

            onProgress("direction", "Preparando dirección creativa editorial.");
            ProfileService.direction.updateGeneral({
                objective: "Retrato editorial profesional de demostración RC1",
                audience: "revisión interna de producto",
                platform: "demo-local",
                format: "portrait-4-5",
                mood: "confident"
            });
            ProfileService.direction.updateLighting({
                type: "rembrandt",
                direction: "lateral suave",
                softness: "media",
                contrast: "moderado",
                colorTemperature: "neutral",
                notes: "Esquema editorial sintético."
            });
            ProfileService.direction.updateCamera({
                shotType: "headshot",
                angle: "eye-level",
                focalLength: "85 mm",
                aperture: "f/4",
                lensStyle: "portrait",
                depthOfField: "moderada",
                notes: "Cámara a la altura de los ojos."
            });
            ProfileService.direction.updateComposition({
                framing: "centrado",
                crop: "head-and-shoulders",
                subjectPosition: "center",
                headroom: "balanced",
                negativeSpace: "minimal",
                eyeLine: "upper-third",
                aspectRatio: "4:5",
                notes: "Composición limpia para demo."
            });
            ProfileService.direction.updateBackground({
                type: "studio",
                description: "Fondo neutro de estudio",
                color: "gris cálido",
                texture: "sutil",
                depth: "media",
                context: "editorial",
                notes: "Sin elementos distractores."
            });
            ProfileService.direction.updateWardrobe({
                style: "editorial-professional",
                garments: ["chaqueta estructurada", "camisa lisa"],
                colors: ["azul marino", "blanco"],
                materials: ["lana", "algodón"],
                accessories: [],
                restrictions: ["sin logotipos"],
                notes: "Vestuario sintético de demostración."
            });
            ProfileService.direction.updatePose({
                bodyPosition: "frontal con ligero giro",
                headPosition: "frontal",
                gaze: "directa a cámara",
                hands: "fuera de encuadre",
                shoulders: "relajados",
                expression: "serena y segura",
                movement: "estático",
                notes: "Pose editorial neutra."
            });
            ProfileService.direction.updateTreatment({
                realism: "editorial-realism",
                colorGrading: "natural",
                skinTreatment: "textura conservada",
                retouching: "mínimo",
                grain: "sutil",
                sharpness: "natural",
                contrast: "moderado",
                notes: "Sin embellecimiento ni alteración de identidad."
            });
            ProfileService.direction.markReady();
            ProfileManager.saveActive();
            window.AppEvents?.emit?.("direction:updated", {
                profileId: profile.id,
                direction: ProfileService.direction.get()
            });

            onProgress("validation", "Validando readiness canónico.");
            const readiness = ProfileValidation.getGenerationReadiness();
            if (!readiness.ready) {
                const blockerCodes = Array.isArray(readiness.errors)
                    ? readiness.errors.map(item => item.code).filter(Boolean)
                    : [];
                throw createError(
                    "DEMO_NOT_READY",
                    `${readiness.errors?.[0]?.message || "El perfil demo no está listo para generar."}${blockerCodes.length ? ` [${blockerCodes.join(", ")}]` : ""}`
                );
            }

            onProgress("generation", "Generando Portrait Contract.");
            const beforeHistory = getDemoHistory(profile.id).length;
            const generation = PromptBinding.generate(null, {
                provider: "generic",
                level: "professional",
                language: "es",
                optimize: true,
                saveHistory: true,
                title: "Demo RC1 — Contrato editorial",
                tags: [DEMO_TAG, "demo"],
                notes: "Generación sintética RC1."
            });
            const afterHistory = getDemoHistory(profile.id);
            if (afterHistory.length !== beforeHistory + 1) {
                throw createError("DEMO_HISTORY_COUNT_INVALID", "Demo Mode no produjo exactamente una nueva entrada de historial.");
            }

            onProgress("export", "Preparando paquete PortraitOS.");
            const exportResult = await PromptExportService.exportPackage({
                profile: ProfileService.getActive(),
                contract: generation.contract,
                compiledPrompt: generation.compiled,
                optimizedPrompt: generation.optimized,
                result: generation,
                history: afterHistory,
                metadata: {
                    demo: true,
                    demoTag: DEMO_TAG,
                    generationId: generation.generationId
                }
            }, {
                download: false,
                copy: false,
                includeContract: true,
                includeHistory: true,
                includeReviews: true
            });

            ProfileManager.saveActive();
            window.HistoryBinding?.refresh?.();
            onProgress("complete", "Demo RC1 preparada.");

            return buildResult({
                reused: false,
                readiness,
                generation,
                exportResult
            });
        } catch (error) {
            onProgress("error", error.message || "Error preparando demo.");
            throw error;
        } finally {
            running = false;
        }
    }

    function remove() {
        validateDependencies();
        const existing = findExistingDemo();
        if (!existing) return { removed: false, profileId: null };
        removeProfileSafely(existing.id);
        return { removed: true, profileId: existing.id };
    }

    function findExistingDemo() {
        return ProfileManager.list().find(profile => profile.name === DEMO_NAME) || null;
    }

    function removeProfileSafely(profileId) {
        const state = ProfileManager.getState();
        if (state.profiles.length === 1) {
            ProfileManager.create({ name: "Nuevo perfil", description: "" });
        }
        ProfileManager.remove(profileId);
    }

    function getDemoHistory(profileId) {
        return PromptHistoryService.list({ profileId, limit: Number.MAX_SAFE_INTEGER }).items || [];
    }

    function buildResult(extra = {}) {
        const active = ProfileService.getActive();
        const readiness = active ? ProfileValidation.getGenerationReadiness(active) : null;
        const history = active ? getDemoHistory(active.id) : [];
        return Object.freeze({
            profileId: active?.id || null,
            profileName: active?.name || null,
            photoCount: active?.identity?.photos?.length || 0,
            evidence: active ? ProfileService.identity.getEvidenceState() : null,
            identityLocked: active ? ProfileService.identity.isLocked() : false,
            direction: active ? ProfileService.direction.summary() : null,
            readiness,
            historyCount: history.length,
            ...extra
        });
    }

    async function createSyntheticFiles() {
        const specs = [
            ["Frontal", "#e7ddd2", "#5b6b7a"],
            ["Tres cuartos", "#dfe6e9", "#7f8c8d"],
            ["Perfil izquierdo", "#e8e3f1", "#6c5b7b"],
            ["Perfil derecho", "#e5efe8", "#52796f"],
            ["Detalle", "#f1e8df", "#9c6644"]
        ];
        const files = [];
        for (let index = 0; index < specs.length; index += 1) {
            files.push(await createSyntheticFile(index, specs[index]));
        }
        return files;
    }

    function createSyntheticFile(index, spec) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement("canvas");
            canvas.width = 720;
            canvas.height = 720;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(createError("DEMO_CANVAS_UNAVAILABLE", "Canvas no está disponible."));

            ctx.fillStyle = spec[1];
            ctx.fillRect(0, 0, 720, 720);
            ctx.fillStyle = spec[2];
            ctx.beginPath();
            ctx.arc(360, 310, 155 + index * 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(230, 470, 260, 150);
            ctx.fillStyle = "rgba(255,255,255,.9)";
            ctx.font = "bold 28px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("PORTRAITOS DEMO", 360, 660);
            ctx.font = "20px sans-serif";
            ctx.fillText(spec[0], 360, 690);

            canvas.toBlob(blob => {
                if (!blob) return reject(createError("DEMO_CANVAS_BLOB_FAILED", "No se pudo crear el fixture sintético."));
                resolve(new File([blob], `portraitos-demo-${index + 1}.png`, {
                    type: "image/png",
                    lastModified: Date.now() + index
                }));
            }, "image/png");
        });
    }

    function identityDescription(section) {
        const descriptions = {
            general: "Presencia sintética neutra y coherente para validar el contrato.",
            face: "Estructura facial sintética estable y no asociada a una persona real.",
            skin: "Textura visual sintética con detalle natural conservado.",
            hair: "Cabello sintético de longitud media y textura definida.",
            eyes: "Ojos sintéticos proporcionados y simétricos dentro del fixture.",
            nose: "Nariz sintética de proporciones estables.",
            mouth: "Boca sintética de expresión neutra.",
            jaw: "Mandíbula sintética definida de forma estable.",
            "facial-hair": "Sin vello facial permanente en el escenario demo.",
            "age-markers": "Marcadores de edad sintéticos conservados sin rejuvenecimiento.",
            asymmetries: "Asimetrías sintéticas leves preservadas como parte del contrato.",
            "distinctive-features": "Rasgos distintivos sintéticos definidos únicamente para trazabilidad de demo."
        };
        return descriptions[section] || `Rasgo sintético ${section}.`;
    }

    function validateDependencies() {
        [
            "ProfileManager",
            "ProfileService",
            "ProfileValidation",
            "PromptBinding",
            "PromptHistoryService",
            "PromptExportService"
        ].forEach(name => {
            if (!window[name]) throw createError("DEMO_DEPENDENCY_MISSING", `Demo Mode requiere ${name}.`);
        });
    }

    function createError(code, message) {
        const error = new Error(message);
        error.name = "DemoModeError";
        error.code = code;
        return error;
    }

    return Object.freeze({
        DEMO_NAME,
        DEMO_TAG,
        getState,
        prepare,
        remove
    });
})();

window.DemoModeService = DemoModeService;
