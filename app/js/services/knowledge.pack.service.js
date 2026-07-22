"use strict";

/* ============================================================
   PortraitOS
   Knowledge Pack Service
   ============================================================ */

const KnowledgePackService = (() => {
    const STORAGE_KEY = "portraitos.knowledge-pack.selected";

    const PACKS = Object.freeze([
        Object.freeze({
            id: "none",
            name: "Sin pack",
            description: "Mantiene únicamente la dirección creativa definida en el perfil.",
            direction: Object.freeze({})
        }),
        Object.freeze({
            id: "corporate-headshot",
            name: "Corporate Headshot",
            description: "Retrato profesional, limpio y fiable para perfiles corporativos.",
            direction: Object.freeze({
                objective: "Retrato profesional para comunicación corporativa",
                audience: "Entorno profesional y empresarial",
                platform: "LinkedIn y canales corporativos",
                mood: "confident",
                lighting: Object.freeze({
                    type: "studio",
                    softness: "soft",
                    contrast: "moderate",
                    colorTemperature: "neutral"
                }),
                camera: Object.freeze({
                    shotType: "headshot",
                    angle: "eye-level",
                    focalLength: "85mm",
                    depthOfField: "shallow"
                }),
                background: Object.freeze({
                    type: "studio",
                    description: "Fondo sobrio, limpio y sin distracciones",
                    color: "neutral"
                }),
                pose: Object.freeze({
                    gaze: "direct to camera",
                    expression: "natural, confident and approachable"
                }),
                treatment: Object.freeze({
                    realism: "photorealistic",
                    retouching: "natural and restrained",
                    skinTreatment: "preserve natural texture"
                })
            })
        }),
        Object.freeze({
            id: "editorial-premium",
            name: "Editorial Premium",
            description: "Estética editorial cuidada con iluminación y acabado de revista.",
            direction: Object.freeze({
                objective: "Retrato editorial premium",
                audience: "Marca personal y comunicación creativa",
                mood: "elegant",
                lighting: Object.freeze({
                    type: "cinematic",
                    direction: "three-quarter",
                    softness: "soft",
                    contrast: "controlled"
                }),
                camera: Object.freeze({
                    shotType: "bust",
                    angle: "three-quarter",
                    focalLength: "85mm",
                    aperture: "f/2.8"
                }),
                composition: Object.freeze({
                    framing: "editorial portrait",
                    negativeSpace: "balanced",
                    eyeLine: "upper third"
                }),
                background: Object.freeze({
                    type: "studio",
                    description: "Textured editorial backdrop with subtle depth"
                }),
                treatment: Object.freeze({
                    realism: "high-end photographic realism",
                    colorGrading: "refined editorial grade",
                    retouching: "premium but natural"
                })
            })
        }),
        Object.freeze({
            id: "cinematic-portrait",
            name: "Cinematic Portrait",
            description: "Retrato narrativo con profundidad, contraste y atmósfera cinematográfica.",
            direction: Object.freeze({
                objective: "Retrato cinematográfico con intención narrativa",
                mood: "intense",
                lighting: Object.freeze({
                    type: "cinematic",
                    direction: "side light",
                    contrast: "high",
                    colorTemperature: "mixed warm and cool"
                }),
                camera: Object.freeze({
                    shotType: "close-up",
                    angle: "eye-level",
                    focalLength: "50mm",
                    depthOfField: "shallow"
                }),
                background: Object.freeze({
                    type: "environmental",
                    description: "Atmospheric background with cinematic depth"
                }),
                treatment: Object.freeze({
                    realism: "cinematic photorealism",
                    colorGrading: "cinematic",
                    grain: "subtle film grain",
                    contrast: "dramatic but controlled"
                })
            })
        })
    ]);

    function list() {
        return clone(PACKS);
    }

    function get(id) {
        const normalizedId = normalizeId(id);
        return clone(PACKS.find(pack => pack.id === normalizedId) || PACKS[0]);
    }

    function getSelectedId() {
        try {
            return normalizeId(window.localStorage.getItem(STORAGE_KEY));
        } catch (error) {
            return "none";
        }
    }

    function select(id) {
        const pack = get(id);
        try {
            window.localStorage.setItem(STORAGE_KEY, pack.id);
        } catch (error) {
            // La selección sigue activa durante la sesión aunque localStorage no esté disponible.
        }
        emit("knowledge-pack:changed", { pack });
        return pack;
    }

    function apply(profile, id = getSelectedId()) {
        const source = clone(profile);
        const pack = get(id);

        if (pack.id === "none") {
            return source;
        }

        source.direction = mergeDefaults(
            clone(pack.direction),
            source.direction && typeof source.direction === "object"
                ? source.direction
                : {}
        );
        source.direction.knowledgePackId = pack.id;
        source.direction.knowledgePackName = pack.name;

        return source;
    }

    function mergeDefaults(defaults, overrides) {
        const result = clone(defaults);

        Object.keys(overrides || {}).forEach(key => {
            const value = overrides[key];
            if (isPlainObject(value) && isPlainObject(result[key])) {
                result[key] = mergeDefaults(result[key], value);
                return;
            }
            if (!isEmptyValue(value)) {
                result[key] = clone(value);
            }
        });

        return result;
    }

    function isEmptyValue(value) {
        return value === undefined || value === null || value === "";
    }

    function isPlainObject(value) {
        return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }

    function normalizeId(value) {
        const id = String(value || "none").trim();
        return PACKS.some(pack => pack.id === id) ? id : "none";
    }

    function emit(name, detail) {
        if (window.AppEvents && typeof AppEvents.emit === "function") {
            AppEvents.emit(name, detail);
            return;
        }
        window.dispatchEvent(new CustomEvent(name, { detail }));
    }

    function clone(value) {
        return typeof structuredClone === "function"
            ? structuredClone(value)
            : JSON.parse(JSON.stringify(value));
    }

    return Object.freeze({
        list,
        get,
        getSelectedId,
        select,
        apply
    });
})();

window.KnowledgePackService = KnowledgePackService;
