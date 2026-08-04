"use strict";

/* ============================================================
   PortraitOS
   Knowledge Pack Service
   ============================================================ */

const KnowledgePackService = (() => {
    const STORAGE_KEY = "portraitos.knowledge-pack.selected";
    const STORAGE_BY_PROFILE_KEY = "portraitos.knowledge-pack.by-profile.v1";

    const PACKS = Object.freeze([
        createPack({
            id: "none",
            name: "Sin pack",
            version: "1.0",
            category: "Base",
            description: "Mantiene únicamente la dirección creativa definida en el perfil.",
            tags: ["manual", "personalizado"],
            direction: {}
        }),
        createPack({
            id: "corporate-headshot",
            name: "Corporate Headshot",
            version: "1.1",
            category: "Profesional",
            description: "Retrato profesional, limpio y fiable para perfiles corporativos.",
            tags: ["linkedin", "corporativo", "profesional"],
            direction: {
                objective: "Retrato profesional para comunicación corporativa",
                audience: "Entorno profesional y empresarial",
                platform: "LinkedIn y canales corporativos",
                mood: "confident",
                lighting: { type: "studio", softness: "soft", contrast: "moderate", colorTemperature: "neutral" },
                camera: { shotType: "headshot", angle: "eye-level", focalLength: "85mm", depthOfField: "shallow" },
                background: { type: "studio", description: "Fondo sobrio, limpio y sin distracciones", color: "neutral" },
                pose: { gaze: "direct to camera", expression: "natural, confident and approachable" },
                treatment: { realism: "photorealistic", retouching: "natural and restrained", skinTreatment: "preserve natural texture" }
            }
        }),
        createPack({
            id: "editorial-premium",
            name: "Editorial Premium",
            version: "1.0",
            category: "Editorial",
            description: "Estética editorial cuidada con iluminación y acabado de revista.",
            tags: ["editorial", "premium", "marca personal"],
            direction: {
                objective: "Retrato editorial premium",
                audience: "Marca personal y comunicación creativa",
                mood: "elegant",
                lighting: { type: "cinematic", direction: "three-quarter", softness: "soft", contrast: "controlled" },
                camera: { shotType: "bust", angle: "three-quarter", focalLength: "85mm", aperture: "f/2.8" },
                composition: { framing: "editorial portrait", negativeSpace: "balanced", eyeLine: "upper third" },
                background: { type: "studio", description: "Textured editorial backdrop with subtle depth" },
                treatment: { realism: "high-end photographic realism", colorGrading: "refined editorial grade", retouching: "premium but natural" }
            }
        }),
        createPack({
            id: "cinematic-portrait",
            name: "Cinematic Portrait",
            version: "1.0",
            category: "Cinematográfico",
            description: "Retrato narrativo con profundidad, contraste y atmósfera cinematográfica.",
            tags: ["cine", "narrativo", "dramático"],
            direction: {
                objective: "Retrato cinematográfico con intención narrativa",
                mood: "intense",
                lighting: { type: "cinematic", direction: "side light", contrast: "high", colorTemperature: "mixed warm and cool" },
                camera: { shotType: "close-up", angle: "eye-level", focalLength: "50mm", depthOfField: "shallow" },
                background: { type: "environmental", description: "Atmospheric background with cinematic depth" },
                treatment: { realism: "cinematic photorealism", colorGrading: "cinematic", grain: "subtle film grain", contrast: "dramatic but controlled" }
            }
        })
    ]);

    function createPack(data) {
        return Object.freeze({
            id: data.id,
            name: data.name,
            version: data.version || "1.0",
            category: data.category || "General",
            description: data.description || "",
            status: "available",
            tags: Object.freeze([...(data.tags || [])]),
            direction: deepFreeze(clone(data.direction || {}))
        });
    }

    function list(profile = getActiveProfile()) {
        return PACKS.map(pack => ({ ...clone(pack), compatible: isCompatible(pack, profile) }));
    }

    function get(id, profile = getActiveProfile()) {
        const normalizedId = normalizeId(id);
        const pack = PACKS.find(item => item.id === normalizedId) || PACKS[0];
        return { ...clone(pack), compatible: isCompatible(pack, profile) };
    }

    function getSelectedId(profile = getActiveProfile()) {
        const profileId = normalizeText(profile?.id);
        const directionPackId = normalizeText(profile?.direction?.knowledgePackId);
        if (directionPackId && hasPack(directionPackId)) return directionPackId;

        const map = readProfileSelections();
        if (profileId && hasPack(map[profileId])) return map[profileId];

        try {
            return normalizeId(window.ProfileStorage?.knowledge?.load(STORAGE_KEY));
        } catch (error) {
            return "none";
        }
    }

    function select(id, profile = getActiveProfile()) {
        const pack = get(id, profile);
        const profileId = normalizeText(profile?.id);

        try {
            window.ProfileStorage?.knowledge?.save(STORAGE_KEY, pack.id);
            if (profileId) {
                const map = readProfileSelections();
                map[profileId] = pack.id;
                window.ProfileStorage?.knowledge?.save(STORAGE_BY_PROFILE_KEY, JSON.stringify(map));
            }
        } catch (error) {
            console.warn("PortraitOS: no se pudo persistir la selección del Knowledge Pack.", error);
        }

        emit("knowledge-pack:changed", { pack, profileId: profileId || null });
        return pack;
    }

    function apply(profile, id = getSelectedId(profile)) {
        const source = clone(profile);
        const pack = get(id, source);
        if (pack.id === "none" || !pack.compatible) return source;

        source.direction = mergeDefaults(clone(pack.direction), isPlainObject(source.direction) ? source.direction : {});
        source.direction.knowledgePackId = pack.id;
        source.direction.knowledgePackName = pack.name;
        source.direction.knowledgePackVersion = pack.version;
        return source;
    }

    function isCompatible(pack, profile) {
        if (!profile || typeof profile !== "object") return true;
        if (pack.id === "none") return true;
        return Boolean(profile.identity || profile.photos || profile.direction);
    }

    function search(query = "", options = {}) {
        const normalizedQuery = normalizeText(query).toLowerCase();
        const profile = options.profile || getActiveProfile();
        const selectedId = getSelectedId(profile);
        return list(profile).filter(pack => {
            if (options.filter === "compatible" && !pack.compatible) return false;
            if (options.filter === "active" && pack.id !== selectedId) return false;
            if (!normalizedQuery) return true;
            return [pack.name, pack.description, pack.category, ...(pack.tags || [])]
                .join(" ").toLowerCase().includes(normalizedQuery);
        });
    }

    function readProfileSelections() {
        try {
            const parsed = JSON.parse(window.ProfileStorage?.knowledge?.load(STORAGE_BY_PROFILE_KEY) || "{}");
            return isPlainObject(parsed) ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function getActiveProfile() {
        return window.ProfileService?.getActive?.() || null;
    }

    function mergeDefaults(defaults, overrides) {
        const result = clone(defaults);
        Object.keys(overrides || {}).forEach(key => {
            const value = overrides[key];
            if (isPlainObject(value) && isPlainObject(result[key])) result[key] = mergeDefaults(result[key], value);
            else if (!isEmptyValue(value)) result[key] = clone(value);
        });
        return result;
    }

    function hasPack(id) { return PACKS.some(pack => pack.id === id); }
    function isEmptyValue(value) { return value === undefined || value === null || value === ""; }
    function isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
    function normalizeId(value) { const id = normalizeText(value) || "none"; return hasPack(id) ? id : "none"; }
    function normalizeText(value) { return String(value || "").trim(); }
    function emit(name, detail) { if (window.AppEvents?.emit) AppEvents.emit(name, detail); else window.dispatchEvent(new CustomEvent(name, { detail })); }
    function clone(value) { return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
    function deepFreeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; Object.values(value).forEach(deepFreeze); return Object.freeze(value); }

    return Object.freeze({ list, get, search, getSelectedId, select, apply, isCompatible });
})();

window.KnowledgePackService = KnowledgePackService;
