"use strict";

/* ============================================================
   PortraitOS
   Prompt Optimizer
   ------------------------------------------------------------
   Responsabilidad:
   - Optimizar prompts ya compilados.
   - Reducir redundancias sin perder información esencial.
   - Adaptar longitud, densidad y estilo al proveedor.
   - Preservar el contrato de identidad.
   - Detectar y corregir conflictos de prioridad.
   - Generar una versión optimizada, trazable y comparable.
   ============================================================ */

const PromptOptimizer = (() => {

    /* ========================================================
       CONFIGURACIÓN
       ======================================================== */

    const VERSION =
        "1.0.0";

    const MODES = Object.freeze({
        CONSERVATIVE:
            "conservative",

        BALANCED:
            "balanced",

        AGGRESSIVE:
            "aggressive"
    });

    const LEVELS = Object.freeze({
        SHORT:
            "short",

        STANDARD:
            "standard",

        PROFESSIONAL:
            "professional",

        CONTRACT:
            "contract"
    });

    const PROVIDERS = Object.freeze({
        GENERIC:
            "generic",

        OPENAI:
            "openai",

        GPT_IMAGE:
            "gpt-image",

        MIDJOURNEY:
            "midjourney",

        FLUX:
            "flux",

        STABLE_DIFFUSION:
            "stable-diffusion",

        IDEOGRAM:
            "ideogram",

        FIREFLY:
            "firefly"
    });

    const DEFAULT_OPTIONS = Object.freeze({
        mode:
            MODES.BALANCED,

        provider:
            PROVIDERS.GENERIC,

        level:
            LEVELS.PROFESSIONAL,

        preserveHeadings:
            true,

        preserveLineBreaks:
            true,

        preserveIdentityLanguage:
            true,

        optimizeNegativePrompt:
            true,

        optimizeParameters:
            true,

        enforceProviderLimit:
            true,

        targetCharacters:
            null,

        targetWords:
            null
    });

    const LEVEL_TARGETS = Object.freeze({
        short: {
            characters:
                800,

            words:
                120
        },

        standard: {
            characters:
                2000,

            words:
                300
        },

        professional: {
            characters:
                4200,

            words:
                650
        },

        contract: {
            characters:
                12000,

            words:
                1800
        }
    });

    const PROVIDER_LIMITS = Object.freeze({
        generic:
            16000,

        openai:
            12000,

        "gpt-image":
            12000,

        midjourney:
            6000,

        flux:
            6000,

        "stable-diffusion":
            4000,

        ideogram:
            4000,

        firefly:
            3000
    });

    const IDENTITY_GUARD_PHRASES = Object.freeze([
        "mantener exactamente la misma persona",
        "preservar estrictamente la identidad",
        "la identidad prevalece",
        "mantener la misma identidad",
        "preservar la edad aparente",
        "preservar la estructura facial",
        "preservar la textura natural de la piel",
        "preservar las asimetrías naturales",
        "same person",
        "preserve exact identity",
        "identity consistency",
        "identity wins"
    ]);

    const IDENTITY_KEYWORDS = Object.freeze([
        "identidad",
        "misma persona",
        "same person",
        "edad aparente",
        "estructura facial",
        "textura de piel",
        "arrugas",
        "canas",
        "asimetrías",
        "ojos",
        "nariz",
        "labios",
        "mandíbula",
        "cabello",
        "facial structure",
        "skin texture",
        "gray hair",
        "natural asymmetries"
    ]);

    const FORBIDDEN_IDENTITY_TRANSFORMATIONS =
        Object.freeze([
            /\brejuvenecer\b/i,
            /\bmás joven\b/i,
            /\beliminar arrugas\b/i,
            /\bsin arrugas\b/i,
            /\bpiel perfecta\b/i,
            /\bpiel de porcelana\b/i,
            /\beliminar canas\b/i,
            /\bcambiar facciones\b/i,
            /\bafinar nariz\b/i,
            /\bagrandar ojos\b/i,
            /\bcorregir asimetrías\b/i,
            /\bsimetría perfecta\b/i,
            /\bface replacement\b/i,
            /\byounger appearance\b/i,
            /\bperfect symmetry\b/i
        ]);

    const REDUNDANT_EXPRESSIONS =
        Object.freeze([
            [
                /\bfotografía profesional profesional\b/gi,
                "fotografía profesional"
            ],

            [
                /\bretrato profesional profesional\b/gi,
                "retrato profesional"
            ],

            [
                /\bmantener exactamente exactamente\b/gi,
                "mantener exactamente"
            ],

            [
                /\bpreservar estrictamente estrictamente\b/gi,
                "preservar estrictamente"
            ],

            [
                /\bmisma misma persona\b/gi,
                "misma persona"
            ],

            [
                /\bphotorealistic photorealistic\b/gi,
                "photorealistic"
            ],

            [
                /\bhigh detail high detail\b/gi,
                "high detail"
            ],

            [
                /\bnatural natural skin texture\b/gi,
                "natural skin texture"
            ]
        ]);

    const WEAK_EXPRESSIONS =
        Object.freeze([
            [
                /\bintentar mantener\b/gi,
                "mantener"
            ],

            [
                /\btratar de preservar\b/gi,
                "preservar"
            ],

            [
                /\bpreferiblemente\b/gi,
                ""
            ],

            [
                /\bsi es posible\b/gi,
                ""
            ],

            [
                /\bde alguna manera\b/gi,
                ""
            ],

            [
                /\bquizá\b/gi,
                ""
            ],

            [
                /\bmaybe\b/gi,
                ""
            ],

            [
                /\btry to preserve\b/gi,
                "preserve"
            ],

            [
                /\bif possible\b/gi,
                ""
            ]
        ]);

    const PROVIDER_STYLE = Object.freeze({
        generic: {
            sentenceMode:
                "structured",

            separator:
                "\n\n",

            compact:
                false
        },

        openai: {
            sentenceMode:
                "natural",

            separator:
                "\n\n",

            compact:
                false
        },

        "gpt-image": {
            sentenceMode:
                "natural",

            separator:
                "\n\n",

            compact:
                false
        },

        midjourney: {
            sentenceMode:
                "compact",

            separator:
                ", ",

            compact:
                true
        },

        flux: {
            sentenceMode:
                "descriptive",

            separator:
                ", ",

            compact:
                true
        },

        "stable-diffusion": {
            sentenceMode:
                "tagged",

            separator:
                ", ",

            compact:
                true
        },

        ideogram: {
            sentenceMode:
                "descriptive",

            separator:
                ". ",

            compact:
                false
        },

        firefly: {
            sentenceMode:
                "natural",

            separator:
                ". ",

            compact:
                false
        }
    });

    /* ========================================================
       OPTIMIZACIÓN PRINCIPAL
       ======================================================== */

    function optimize(
        compiledPrompt,
        options = {}
    ) {
        const source =
            normalizeCompiledPrompt(
                compiledPrompt
            );

        const normalizedOptions =
            normalizeOptions(
                source,
                options
            );

        const validation =
            validateInput(
                source,
                normalizedOptions
            );

        if (
            validation.blockers.length
        ) {
            throw createOptimizerError(
                "PROMPT_OPTIMIZATION_BLOCKED",
                "No es posible optimizar el prompt.",
                validation
            );
        }

        const original = {
            prompt:
                source.prompt,

            negativePrompt:
                source.negativePrompt,

            parameters:
                clone(
                    source.parameters
                ),

            command:
                source.command
        };

        const optimizationLog = [];

        let optimizedPrompt =
            source.prompt;

        optimizedPrompt =
            normalizeWhitespace(
                optimizedPrompt,
                normalizedOptions
            );

        optimizedPrompt =
            removeRedundancies(
                optimizedPrompt,
                optimizationLog
            );

        optimizedPrompt =
            strengthenInstructions(
                optimizedPrompt,
                optimizationLog
            );

        optimizedPrompt =
            normalizePunctuation(
                optimizedPrompt,
                normalizedOptions
            );

        optimizedPrompt =
            optimizeStructure(
                optimizedPrompt,
                normalizedOptions,
                optimizationLog
            );

        optimizedPrompt =
            enforceIdentityPriority(
                optimizedPrompt,
                normalizedOptions,
                optimizationLog
            );

        optimizedPrompt =
            removeIdentityConflicts(
                optimizedPrompt,
                optimizationLog
            );

        optimizedPrompt =
            adaptToProvider(
                optimizedPrompt,
                normalizedOptions,
                optimizationLog
            );

        optimizedPrompt =
            reduceToTarget(
                optimizedPrompt,
                normalizedOptions,
                optimizationLog
            );

        optimizedPrompt =
            finalCleanup(
                optimizedPrompt,
                normalizedOptions
            );

        let optimizedNegativePrompt =
            source.negativePrompt;

        if (
            normalizedOptions
                .optimizeNegativePrompt
        ) {
            optimizedNegativePrompt =
                optimizeNegativePrompt(
                    source.negativePrompt,
                    normalizedOptions,
                    optimizationLog
                );
        }

        const optimizedParameters =
            normalizedOptions
                .optimizeParameters
                ? optimizeParameters(
                    source.parameters,
                    normalizedOptions,
                    optimizationLog
                )
                : clone(
                    source.parameters
                );

        const result = {
            optimizerVersion:
                VERSION,

            sourceCompilerVersion:
                source.compilerVersion ||
                null,

            contractId:
                source.contractId ||
                null,

            contractFingerprint:
                source.contractFingerprint ||
                null,

            provider:
                normalizedOptions.provider,

            level:
                normalizedOptions.level,

            mode:
                normalizedOptions.mode,

            original,

            prompt:
                optimizedPrompt,

            negativePrompt:
                optimizedNegativePrompt,

            parameters:
                optimizedParameters,

            command:
                "",

            metrics:
                buildMetrics(
                    original,
                    {
                        prompt:
                            optimizedPrompt,

                        negativePrompt:
                            optimizedNegativePrompt
                    }
                ),

            changes:
                optimizationLog,

            validation:
                null,

            optimizedAt:
                new Date()
                    .toISOString()
        };

        result.command =
            buildOptimizedCommand(
                result
            );

        result.validation =
            validateOutput(
                result,
                normalizedOptions
            );

        return deepFreeze(
            clone(result)
        );
    }

    /* ========================================================
       OPTIMIZACIÓN DE TEXTO
       ======================================================== */

    function removeRedundancies(
        text,
        log
    ) {
        let result =
            text;

        REDUNDANT_EXPRESSIONS
            .forEach(
                ([expression, replacement]) => {
                    const before =
                        result;

                    result =
                        result.replace(
                            expression,
                            replacement
                        );

                    if (
                        before !==
                        result
                    ) {
                        log.push(
                            createChange({
                                type:
                                    "redundancy",

                                description:
                                    `Se eliminó una redundancia: ${expression}.`
                            })
                        );
                    }
                }
            );

        result =
            removeDuplicateSentences(
                result,
                log
            );

        result =
            removeDuplicateClauses(
                result,
                log
            );

        return result;
    }

    function strengthenInstructions(
        text,
        log
    ) {
        let result =
            text;

        WEAK_EXPRESSIONS
            .forEach(
                ([expression, replacement]) => {
                    const before =
                        result;

                    result =
                        result.replace(
                            expression,
                            replacement
                        );

                    if (
                        before !==
                        result
                    ) {
                        log.push(
                            createChange({
                                type:
                                    "instruction-strengthening",

                                description:
                                    "Se sustituyó una formulación débil por una instrucción directa."
                            })
                        );
                    }
                }
            );

        return result;
    }

    function normalizeWhitespace(
        text,
        options
    ) {
        let result =
            normalizeText(text);

        result =
            result.replace(
                /\r\n?/g,
                "\n"
            );

        result =
            result.replace(
                /[ \t]+/g,
                " "
            );

        result =
            result.replace(
                / +\n/g,
                "\n"
            );

        result =
            result.replace(
                /\n +/g,
                "\n"
            );

        if (
            options.preserveLineBreaks
        ) {
            result =
                result.replace(
                    /\n{3,}/g,
                    "\n\n"
                );
        } else {
            result =
                result.replace(
                    /\s+/g,
                    " "
                );
        }

        return result.trim();
    }

    function normalizePunctuation(
        text,
        options
    ) {
        let result =
            text;

        result =
            result.replace(
                /\s+([,.;:!?])/g,
                "$1"
            );

        result =
            result.replace(
                /([,;:])([^\s\n])/g,
                "$1 $2"
            );

        result =
            result.replace(
                /\.{2,}/g,
                "."
            );

        result =
            result.replace(
                /,{2,}/g,
                ","
            );

        result =
            result.replace(
                /;\s*;/g,
                ";"
            );

        if (
            options.provider ===
                PROVIDERS.MIDJOURNEY ||
            options.provider ===
                PROVIDERS.FLUX ||
            options.provider ===
                PROVIDERS.STABLE_DIFFUSION
        ) {
            result =
                result.replace(
                    /\.\s+/g,
                    ", "
                );
        }

        return result.trim();
    }

    function optimizeStructure(
        text,
        options,
        log
    ) {
        const providerStyle =
            PROVIDER_STYLE[
                options.provider
            ] ||
            PROVIDER_STYLE.generic;

        if (
            providerStyle.compact
        ) {
            const compact =
                compactStructuredPrompt(
                    text
                );

            if (
                compact !==
                text
            ) {
                log.push(
                    createChange({
                        type:
                            "structure",

                        description:
                            `Se compactó la estructura para ${options.provider}.`
                    })
                );
            }

            return compact;
        }

        if (
            options.preserveHeadings
        ) {
            return normalizeHeadings(
                text
            );
        }

        const withoutHeadings =
            removeHeadings(text);

        if (
            withoutHeadings !==
            text
        ) {
            log.push(
                createChange({
                    type:
                        "headings",

                    description:
                        "Se eliminaron encabezados para obtener una redacción continua."
                })
            );
        }

        return withoutHeadings;
    }

    function enforceIdentityPriority(
        text,
        options,
        log
    ) {
        if (
            options
                .preserveIdentityLanguage ===
            false
        ) {
            return text;
        }

        const normalized =
            text.toLowerCase();

        const hasGuard =
            IDENTITY_GUARD_PHRASES
                .some(
                    phrase =>
                        normalized.includes(
                            phrase
                        )
                );

        const identityMentions =
            IDENTITY_KEYWORDS
                .filter(
                    keyword =>
                        normalized.includes(
                            keyword
                        )
                )
                .length;

        if (
            hasGuard &&
            identityMentions >= 3
        ) {
            return text;
        }

        const identityGuard =
            buildIdentityGuard(
                options.provider
            );

        log.push(
            createChange({
                type:
                    "identity-guard",

                description:
                    "Se reforzó explícitamente la prioridad del contrato de identidad."
            })
        );

        if (
            isCompactProvider(
                options.provider
            )
        ) {
            return [
                identityGuard,
                text
            ]
                .filter(Boolean)
                .join(", ");
        }

        return [
            identityGuard,
            text
        ]
            .filter(Boolean)
            .join("\n\n");
    }

    function removeIdentityConflicts(
        text,
        log
    ) {
        let result =
            text;

        FORBIDDEN_IDENTITY_TRANSFORMATIONS
            .forEach(
                expression => {
                    if (
                        expression.test(
                            result
                        )
                    ) {
                        expression.lastIndex =
                            0;

                        result =
                            result.replace(
                                expression,
                                ""
                            );

                        log.push(
                            createChange({
                                type:
                                    "identity-conflict",

                                severity:
                                    "critical",

                                description:
                                    `Se eliminó una instrucción incompatible con la identidad: ${expression}.`
                            })
                        );
                    }
                }
            );

        return normalizeWhitespace(
            result,
            {
                preserveLineBreaks:
                    true
            }
        );
    }

    function adaptToProvider(
        text,
        options,
        log
    ) {
        const provider =
            options.provider;

        if (
            provider ===
                PROVIDERS.OPENAI ||
            provider ===
                PROVIDERS.GPT_IMAGE
        ) {
            const adapted =
                adaptForOpenAI(
                    text
                );

            if (
                adapted !==
                text
            ) {
                log.push(
                    createChange({
                        type:
                            "provider-adaptation",

                        description:
                            "Se adaptó el prompt a instrucciones naturales para OpenAI Images."
                    })
                );
            }

            return adapted;
        }

        if (
            provider ===
            PROVIDERS.MIDJOURNEY
        ) {
            const adapted =
                adaptForMidjourney(
                    text
                );

            if (
                adapted !==
                text
            ) {
                log.push(
                    createChange({
                        type:
                            "provider-adaptation",

                        description:
                            "Se adaptó el prompt a una estructura compacta para Midjourney."
                    })
                );
            }

            return adapted;
        }

        if (
            provider ===
            PROVIDERS.STABLE_DIFFUSION
        ) {
            const adapted =
                adaptForStableDiffusion(
                    text
                );

            if (
                adapted !==
                text
            ) {
                log.push(
                    createChange({
                        type:
                            "provider-adaptation",

                        description:
                            "Se adaptó el prompt a una estructura de etiquetas para Stable Diffusion."
                    })
                );
            }

            return adapted;
        }

        if (
            provider ===
            PROVIDERS.FLUX
        ) {
            const adapted =
                adaptForFlux(
                    text
                );

            if (
                adapted !==
                text
            ) {
                log.push(
                    createChange({
                        type:
                            "provider-adaptation",

                        description:
                            "Se optimizó la descripción para Flux."
                    })
                );
            }

            return adapted;
        }

        if (
            provider ===
            PROVIDERS.FIREFLY
        ) {
            return adaptForFirefly(
                text
            );
        }

        if (
            provider ===
            PROVIDERS.IDEOGRAM
        ) {
            return adaptForIdeogram(
                text
            );
        }

        return text;
    }

    /* ========================================================
       ADAPTADORES
       ======================================================== */

    function adaptForOpenAI(text) {
        return text
            .replace(
                /NEGATIVE PROMPT\s*/gi,
                "Evitar expresamente: "
            )
            .replace(
                /--no\s+/gi,
                "Evitar "
            )
            .replace(
                /\s*,\s*,+/g,
                ", "
            )
            .trim();
    }

    function adaptForMidjourney(
        text
    ) {
        const fragments =
            splitSemanticFragments(
                text
            );

        return uniqueStrings(
            fragments
                .map(
                    fragment =>
                        removeHeadingPrefix(
                            fragment
                        )
                )
                .filter(Boolean)
        )
            .join(", ")
            .replace(
                /\s+/g,
                " "
            )
            .replace(
                /,\s*,+/g,
                ", "
            )
            .trim();
    }

    function adaptForStableDiffusion(
        text
    ) {
        const fragments =
            splitSemanticFragments(
                text
            );

        const tags =
            fragments
                .flatMap(
                    fragment =>
                        fragment.split(
                            /[,;]+/
                        )
                )
                .map(
                    fragment =>
                        removeHeadingPrefix(
                            fragment
                        )
                )
                .map(
                    fragment =>
                        normalizeText(
                            fragment
                        )
                )
                .filter(Boolean);

        return uniqueStrings(tags)
            .join(", ");
    }

    function adaptForFlux(text) {
        return splitSemanticFragments(
            text
        )
            .map(
                removeHeadingPrefix
            )
            .filter(Boolean)
            .join(", ")
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    function adaptForFirefly(text) {
        return removeHeadings(text)
            .replace(
                /\n+/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    function adaptForIdeogram(text) {
        return removeHeadings(text)
            .replace(
                /\n+/g,
                ". "
            )
            .replace(
                /\.{2,}/g,
                "."
            )
            .trim();
    }

    /* ========================================================
       REDUCCIÓN DE LONGITUD
       ======================================================== */

    function reduceToTarget(
        text,
        options,
        log
    ) {
        const target =
            resolveTargetCharacters(
                options
            );

        if (
            !target ||
            text.length <= target
        ) {
            return text;
        }

        let result =
            text;

        result =
            removeLowPriorityParentheticals(
                result
            );

        if (
            result.length <= target
        ) {
            log.push(
                createChange({
                    type:
                        "length",

                    description:
                        `Se redujo el prompt al objetivo de ${target} caracteres eliminando aclaraciones secundarias.`
                })
            );

            return result;
        }

        result =
            compressRepeatedIdentityRules(
                result
            );

        if (
            result.length <= target
        ) {
            log.push(
                createChange({
                    type:
                        "length",

                    description:
                        `Se consolidaron reglas repetidas para respetar el objetivo de ${target} caracteres.`
                })
            );

            return result;
        }

        result =
            removeLowPrioritySentences(
                result,
                target,
                options
            );

        if (
            result.length > target &&
            options.mode ===
                MODES.AGGRESSIVE
        ) {
            result =
                truncateSafely(
                    result,
                    target
                );
        }

        log.push(
            createChange({
                type:
                    "length",

                severity:
                    result.length > target
                        ? "warning"
                        : "info",

                description:
                    result.length > target
                        ? `El prompt sigue superando el objetivo de ${target} caracteres para preservar información prioritaria.`
                        : `Se redujo el prompt al objetivo de ${target} caracteres.`
            })
        );

        return result;
    }

    function resolveTargetCharacters(
        options
    ) {
        if (
            Number.isFinite(
                Number(
                    options
                        .targetCharacters
                )
            ) &&
            Number(
                options
                    .targetCharacters
            ) > 0
        ) {
            return Number(
                options
                    .targetCharacters
            );
        }

        const levelTarget =
            LEVEL_TARGETS[
                options.level
            ]?.characters;

        const providerLimit =
            PROVIDER_LIMITS[
                options.provider
            ];

        if (
            options
                .enforceProviderLimit ===
            false
        ) {
            return levelTarget;
        }

        return Math.min(
            levelTarget ||
                Number.MAX_SAFE_INTEGER,

            providerLimit ||
                Number.MAX_SAFE_INTEGER
        );
    }

    function removeLowPrioritySentences(
        text,
        target,
        options
    ) {
        const sentences =
            splitSentences(text);

        const scored =
            sentences.map(
                sentence => ({
                    sentence,

                    score:
                        scoreSentence(
                            sentence
                        )
                })
            );

        const sortedRemovable =
            scored
                .filter(
                    item =>
                        item.score < 60
                )
                .sort(
                    (a, b) =>
                        a.score -
                        b.score
                );

        let result =
            text;

        for (
            const item of
            sortedRemovable
        ) {
            if (
                result.length <=
                target
            ) {
                break;
            }

            result =
                removeSentence(
                    result,
                    item.sentence
                );
        }

        if (
            result.length > target &&
            options.mode !==
                MODES.CONSERVATIVE
        ) {
            const mediumPriority =
                scored
                    .filter(
                        item =>
                            item.score >=
                                60 &&
                            item.score <
                                85
                    )
                    .sort(
                        (a, b) =>
                            a.score -
                            b.score
                    );

            for (
                const item of
                mediumPriority
            ) {
                if (
                    result.length <=
                    target
                ) {
                    break;
                }

                result =
                    removeSentence(
                        result,
                        item.sentence
                    );
            }
        }

        return normalizeWhitespace(
            result,
            {
                preserveLineBreaks:
                    true
            }
        );
    }

    function scoreSentence(
        sentence
    ) {
        const normalized =
            sentence.toLowerCase();

        let score = 50;

        if (
            IDENTITY_KEYWORDS.some(
                keyword =>
                    normalized.includes(
                        keyword
                    )
            )
        ) {
            score += 40;
        }

        if (
            normalized.includes(
                "obligatorio"
            ) ||
            normalized.includes(
                "prohibido"
            ) ||
            normalized.includes(
                "no modificar"
            ) ||
            normalized.includes(
                "prevalece"
            )
        ) {
            score += 35;
        }

        if (
            normalized.includes(
                "iluminación"
            ) ||
            normalized.includes(
                "cámara"
            ) ||
            normalized.includes(
                "composición"
            ) ||
            normalized.includes(
                "pose"
            ) ||
            normalized.includes(
                "fondo"
            )
        ) {
            score += 20;
        }

        if (
            normalized.includes(
                "notas"
            ) ||
            normalized.includes(
                "adicional"
            ) ||
            normalized.includes(
                "recomendado"
            )
        ) {
            score -= 20;
        }

        return score;
    }

    /* ========================================================
       NEGATIVE PROMPT
       ======================================================== */

    function optimizeNegativePrompt(
        negativePrompt,
        options,
        log
    ) {
        if (
            !hasValue(
                negativePrompt
            )
        ) {
            return "";
        }

        let items =
            normalizeList(
                negativePrompt
            );

        items =
            items
                .map(
                    normalizeNegativeItem
                )
                .filter(Boolean);

        items =
            uniqueStrings(items);

        items =
            items.filter(
                item =>
                    !isPositiveInstruction(
                        item
                    )
            );

        if (
            options.provider ===
                PROVIDERS.OPENAI ||
            options.provider ===
                PROVIDERS.GPT_IMAGE ||
            options.provider ===
                PROVIDERS.FIREFLY
        ) {
            log.push(
                createChange({
                    type:
                        "negative-prompt",

                    description:
                        "El proveedor no utiliza un campo negativo independiente; las restricciones se mantienen en el prompt principal."
                })
            );

            return "";
        }

        if (
            options.provider ===
            PROVIDERS.MIDJOURNEY
        ) {
            items =
                items.map(
                    item =>
                        item
                            .replace(
                                /^no\s+/i,
                                ""
                            )
                            .replace(
                                /^evitar\s+/i,
                                ""
                            )
                );
        }

        const result =
            uniqueStrings(items)
                .join(", ");

        if (
            result !==
            negativePrompt
        ) {
            log.push(
                createChange({
                    type:
                        "negative-prompt",

                    description:
                        "Se eliminaron duplicados y formulaciones inconsistentes del negative prompt."
                })
            );
        }

        return result;
    }

    function normalizeNegativeItem(
        item
    ) {
        return normalizeText(item)
            .replace(
                /^[-•]\s*/,
                ""
            )
            .replace(
                /\.$/,
                ""
            )
            .toLowerCase();
    }

    function isPositiveInstruction(
        value
    ) {
        const normalized =
            value.toLowerCase();

        return (
            normalized.startsWith(
                "mantener "
            ) ||
            normalized.startsWith(
                "preservar "
            ) ||
            normalized.startsWith(
                "usar "
            )
        );
    }

    /* ========================================================
       PARÁMETROS
       ======================================================== */

    function optimizeParameters(
        parameters,
        options,
        log
    ) {
        const source =
            normalizeObject(
                parameters
            );

        const optimized = {
            ...source
        };

        if (
            options.provider ===
            PROVIDERS.MIDJOURNEY
        ) {
            if (
                optimized.style ===
                    undefined
            ) {
                optimized.style =
                    "raw";
            }

            if (
                optimized.stylize ===
                    undefined
            ) {
                optimized.stylize =
                    50;
            }

            if (
                optimized.quality ===
                    undefined
            ) {
                optimized.quality =
                    1;
            }

            delete optimized.width;
            delete optimized.height;
            delete optimized.steps;
            delete optimized.guidance;
        }

        if (
            options.provider ===
            PROVIDERS.STABLE_DIFFUSION
        ) {
            optimized.steps =
                clampInteger(
                    optimized.steps,
                    20,
                    60,
                    35
                );

            optimized.guidance =
                clampNumber(
                    optimized.guidance,
                    3,
                    12,
                    7
                );

            optimized.seed =
                optimized.seed ??
                -1;

            delete optimized.style;
            delete optimized.stylize;
            delete optimized.quality;
        }

        if (
            options.provider ===
            PROVIDERS.FLUX
        ) {
            optimized.steps =
                clampInteger(
                    optimized.steps,
                    20,
                    40,
                    28
                );

            optimized.guidance =
                clampNumber(
                    optimized.guidance,
                    2,
                    5,
                    3.5
                );

            optimized.seed =
                optimized.seed ??
                -1;

            delete optimized.style;
            delete optimized.stylize;
            delete optimized.quality;
        }

        if (
            [
                PROVIDERS.OPENAI,
                PROVIDERS.GPT_IMAGE,
                PROVIDERS.FIREFLY,
                PROVIDERS.IDEOGRAM
            ].includes(
                options.provider
            )
        ) {
            Object.keys(
                optimized
            ).forEach(
                key => {
                    if (
                        ![
                            "aspectRatio",
                            "dimensions",
                            "imageCount"
                        ].includes(key)
                    ) {
                        delete optimized[key];
                    }
                }
            );
        }

        if (
            JSON.stringify(source) !==
            JSON.stringify(optimized)
        ) {
            log.push(
                createChange({
                    type:
                        "parameters",

                    description:
                        `Se normalizaron los parámetros para ${options.provider}.`
                })
            );
        }

        return optimized;
    }

    /* ========================================================
       COMANDO FINAL
       ======================================================== */

    function buildOptimizedCommand(
        result
    ) {
        if (
            result.provider !==
            PROVIDERS.MIDJOURNEY
        ) {
            return result.prompt;
        }

        const parameterString =
            Object.entries(
                result.parameters
            )
                .filter(
                    ([, value]) =>
                        hasValue(value)
                )
                .map(
                    ([key, value]) =>
                        `--${key} ${value}`
                )
                .join(" ");

        const negative =
            result.negativePrompt
                ? `--no ${result.negativePrompt}`
                : "";

        return [
            result.prompt,
            parameterString,
            negative
        ]
            .filter(Boolean)
            .join(" ")
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    /* ========================================================
       MÉTRICAS
       ======================================================== */

    function buildMetrics(
        original,
        optimized
    ) {
        const originalCharacters =
            normalizeText(
                original.prompt
            ).length;

        const optimizedCharacters =
            normalizeText(
                optimized.prompt
            ).length;

        const originalWords =
            countWords(
                original.prompt
            );

        const optimizedWords =
            countWords(
                optimized.prompt
            );

        const savedCharacters =
            Math.max(
                0,
                originalCharacters -
                optimizedCharacters
            );

        const reductionPercent =
            originalCharacters > 0
                ? Math.round(
                    savedCharacters /
                    originalCharacters *
                    100
                )
                : 0;

        return {
            originalCharacters,

            optimizedCharacters,

            savedCharacters,

            reductionPercent,

            originalWords,

            optimizedWords,

            originalNegativeCharacters:
                normalizeText(
                    original
                        .negativePrompt
                ).length,

            optimizedNegativeCharacters:
                normalizeText(
                    optimized
                        .negativePrompt
                ).length,

            identityCoverage:
                calculateIdentityCoverage(
                    optimized.prompt
                ),

            estimatedTokenCount:
                estimateTokens(
                    optimized.prompt
                )
        };
    }

    function calculateIdentityCoverage(
        prompt
    ) {
        const normalized =
            normalizeText(
                prompt
            ).toLowerCase();

        const hits =
            IDENTITY_KEYWORDS
                .filter(
                    keyword =>
                        normalized.includes(
                            keyword
                        )
                )
                .length;

        return Math.round(
            hits /
            IDENTITY_KEYWORDS.length *
            100
        );
    }

    function estimateTokens(text) {
        const characters =
            normalizeText(text)
                .length;

        return Math.ceil(
            characters / 4
        );
    }

    /* ========================================================
       VALIDACIÓN
       ======================================================== */

    function validateInput(
        source,
        options
    ) {
        const blockers = [];
        const errors = [];
        const warnings = [];

        if (!source) {
            blockers.push(
                createIssue(
                    "COMPILED_PROMPT_REQUIRED",
                    "No se ha proporcionado un prompt compilado."
                )
            );

            return {
                valid: false,
                blockers,
                errors,
                warnings
            };
        }

        if (
            !hasValue(
                source.prompt
            )
        ) {
            blockers.push(
                createIssue(
                    "PROMPT_REQUIRED",
                    "El prompt compilado está vacío."
                )
            );
        }

        if (
            !Object.values(
                PROVIDERS
            ).includes(
                options.provider
            )
        ) {
            errors.push(
                createIssue(
                    "INVALID_PROVIDER",
                    "El proveedor seleccionado no es válido."
                )
            );
        }

        if (
            !Object.values(
                LEVELS
            ).includes(
                options.level
            )
        ) {
            errors.push(
                createIssue(
                    "INVALID_LEVEL",
                    "El nivel seleccionado no es válido."
                )
            );
        }

        if (
            !Object.values(
                MODES
            ).includes(
                options.mode
            )
        ) {
            errors.push(
                createIssue(
                    "INVALID_MODE",
                    "El modo de optimización no es válido."
                )
            );
        }

        if (
            source.validation
                ?.valid === false
        ) {
            warnings.push(
                createIssue(
                    "SOURCE_PROMPT_INVALID",
                    "El prompt compilado contiene advertencias o errores previos."
                )
            );
        }

        return {
            valid:
                blockers.length ===
                    0 &&
                errors.length ===
                    0,

            blockers,
            errors,
            warnings
        };
    }

    function validateOutput(
        result,
        options
    ) {
        const blockers = [];
        const errors = [];
        const warnings = [];

        if (
            !hasValue(
                result.prompt
            )
        ) {
            blockers.push(
                createIssue(
                    "OPTIMIZED_PROMPT_EMPTY",
                    "El prompt optimizado está vacío."
                )
            );
        }

        const normalized =
            result.prompt
                .toLowerCase();

        const identityGuardPresent =
            IDENTITY_GUARD_PHRASES
                .some(
                    phrase =>
                        normalized.includes(
                            phrase
                        )
                );

        const identityCoverage =
            calculateIdentityCoverage(
                result.prompt
            );

        if (
            options
                .preserveIdentityLanguage &&
            !identityGuardPresent
        ) {
            errors.push(
                createIssue(
                    "IDENTITY_GUARD_MISSING",
                    "El prompt optimizado no expresa claramente la prioridad de identidad."
                )
            );
        }

        if (
            options
                .preserveIdentityLanguage &&
            identityCoverage < 15
        ) {
            warnings.push(
                createIssue(
                    "LOW_IDENTITY_COVERAGE",
                    "La cobertura de términos de identidad es baja."
                )
            );
        }

        FORBIDDEN_IDENTITY_TRANSFORMATIONS
            .forEach(
                expression => {
                    expression.lastIndex =
                        0;

                    if (
                        expression.test(
                            result.prompt
                        )
                    ) {
                        blockers.push(
                            createIssue(
                                "IDENTITY_CONFLICT_REMAINING",
                                `Permanece una instrucción incompatible con la identidad: ${expression}.`
                            )
                        );
                    }
                }
            );

        const target =
            resolveTargetCharacters(
                options
            );

        if (
            target &&
            result.prompt.length >
                target
        ) {
            warnings.push(
                createIssue(
                    "TARGET_LENGTH_EXCEEDED",
                    `El prompt supera el objetivo de ${target} caracteres.`
                )
            );
        }

        const providerLimit =
            PROVIDER_LIMITS[
                options.provider
            ];

        if (
            providerLimit &&
            result.prompt.length >
                providerLimit
        ) {
            errors.push(
                createIssue(
                    "PROVIDER_LIMIT_EXCEEDED",
                    `El prompt supera el límite recomendado de ${providerLimit} caracteres para ${options.provider}.`
                )
            );
        }

        return {
            valid:
                blockers.length ===
                    0 &&
                errors.length ===
                    0,

            blockers,
            errors,
            warnings,

            checkedAt:
                new Date()
                    .toISOString()
        };
    }

    /* ========================================================
       NORMALIZACIÓN
       ======================================================== */

    function normalizeCompiledPrompt(
        value
    ) {
        if (
            !value ||
            typeof value !==
                "object" ||
            Array.isArray(value)
        ) {
            return null;
        }

        return {
            ...clone(value),

            prompt:
                normalizeText(
                    value.prompt
                ),

            negativePrompt:
                normalizeText(
                    value
                        .negativePrompt
                ),

            parameters:
                normalizeObject(
                    value.parameters
                ),

            command:
                normalizeText(
                    value.command
                ),

            provider:
                normalizeProvider(
                    value.provider
                ),

            level:
                normalizeLevel(
                    value.level
                )
        };
    }

    function normalizeOptions(
        source,
        options
    ) {
        const merged = {
            ...DEFAULT_OPTIONS,

            provider:
                source?.provider ||
                DEFAULT_OPTIONS
                    .provider,

            level:
                source?.level ||
                DEFAULT_OPTIONS
                    .level,

            ...normalizeObject(
                options
            )
        };

        return {
            mode:
                normalizeMode(
                    merged.mode
                ),

            provider:
                normalizeProvider(
                    merged.provider
                ),

            level:
                normalizeLevel(
                    merged.level
                ),

            preserveHeadings:
                merged
                    .preserveHeadings !==
                false,

            preserveLineBreaks:
                merged
                    .preserveLineBreaks !==
                false,

            preserveIdentityLanguage:
                merged
                    .preserveIdentityLanguage !==
                false,

            optimizeNegativePrompt:
                merged
                    .optimizeNegativePrompt !==
                false,

            optimizeParameters:
                merged
                    .optimizeParameters !==
                false,

            enforceProviderLimit:
                merged
                    .enforceProviderLimit !==
                false,

            targetCharacters:
                normalizeOptionalPositiveNumber(
                    merged
                        .targetCharacters
                ),

            targetWords:
                normalizeOptionalPositiveNumber(
                    merged.targetWords
                )
        };
    }

    function normalizeMode(value) {
        const normalized =
            normalizeText(value)
                .toLowerCase();

        return Object.values(
            MODES
        ).includes(
            normalized
        )
            ? normalized
            : MODES.BALANCED;
    }

    function normalizeProvider(
        value
    ) {
        const normalized =
            normalizeText(value)
                .toLowerCase();

        return Object.values(
            PROVIDERS
        ).includes(
            normalized
        )
            ? normalized
            : PROVIDERS.GENERIC;
    }

    function normalizeLevel(value) {
        const normalized =
            normalizeText(value)
                .toLowerCase();

        return Object.values(
            LEVELS
        ).includes(
            normalized
        )
            ? normalized
            : LEVELS.PROFESSIONAL;
    }

    /* ========================================================
       UTILIDADES DE TEXTO
       ======================================================== */

    function removeDuplicateSentences(
        text,
        log
    ) {
        const sentences =
            splitSentences(text);

        const seen =
            new Set();

        const unique = [];

        sentences.forEach(
            sentence => {
                const key =
                    normalizeComparisonText(
                        sentence
                    );

                if (
                    !key ||
                    seen.has(key)
                ) {
                    if (key) {
                        log.push(
                            createChange({
                                type:
                                    "duplicate-sentence",

                                description:
                                    "Se eliminó una frase duplicada."
                            })
                        );
                    }

                    return;
                }

                seen.add(key);
                unique.push(
                    sentence
                );
            }
        );

        return unique.join(
            " "
        );
    }

    function removeDuplicateClauses(
        text,
        log
    ) {
        const paragraphs =
            text.split(
                /\n{2,}/
            );

        const optimized =
            paragraphs.map(
                paragraph => {
                    const clauses =
                        paragraph
                            .split(
                                /[;]+/
                            )
                            .map(
                                normalizeText
                            )
                            .filter(Boolean);

                    const seen =
                        new Set();

                    const unique =
                        clauses.filter(
                            clause => {
                                const key =
                                    normalizeComparisonText(
                                        clause
                                    );

                                if (
                                    seen.has(
                                        key
                                    )
                                ) {
                                    log.push(
                                        createChange({
                                            type:
                                                "duplicate-clause",

                                            description:
                                                "Se eliminó una cláusula duplicada."
                                        })
                                    );

                                    return false;
                                }

                                seen.add(key);

                                return true;
                            }
                        );

                    return unique.join(
                        "; "
                    );
                }
            );

        return optimized.join(
            "\n\n"
        );
    }

    function compactStructuredPrompt(
        text
    ) {
        return splitSemanticFragments(
            text
        )
            .map(
                removeHeadingPrefix
            )
            .filter(Boolean)
            .join(", ")
            .replace(
                /\s+/g,
                " "
            )
            .replace(
                /,\s*,+/g,
                ", "
            )
            .trim();
    }

    function normalizeHeadings(text) {
        return text
            .split("\n")
            .map(
                line => {
                    const trimmed =
                        line.trim();

                    if (
                        /^[A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s/&-]{2,}$/
                            .test(
                                trimmed
                            )
                    ) {
                        return trimmed;
                    }

                    return line;
                }
            )
            .join("\n");
    }

    function removeHeadings(text) {
        return text
            .split("\n")
            .filter(
                line =>
                    !isHeading(
                        line
                    )
            )
            .join("\n")
            .trim();
    }

    function isHeading(line) {
        const value =
            normalizeText(line);

        if (!value) {
            return false;
        }

        return (
            /^[A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s/&-]{2,}$/
                .test(value) ||
            /^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñÑ\s/&-]{2,}:$/
                .test(value)
        );
    }

    function removeHeadingPrefix(
        value
    ) {
        return normalizeText(value)
            .replace(
                /^[A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s/&-]{2,}\s*/u,
                ""
            )
            .replace(
                /^[^:]{2,40}:\s*/,
                ""
            )
            .trim();
    }

    function splitSemanticFragments(
        text
    ) {
        return normalizeText(text)
            .split(
                /\n+|(?<=[.!?])\s+|;/
            )
            .map(
                normalizeText
            )
            .filter(Boolean);
    }

    function splitSentences(text) {
        return normalizeText(text)
            .split(
                /(?<=[.!?])\s+|\n{2,}/
            )
            .map(
                normalizeText
            )
            .filter(Boolean);
    }

    function removeSentence(
        text,
        sentence
    ) {
        return text
            .replace(
                sentence,
                ""
            )
            .replace(
                /\n{3,}/g,
                "\n\n"
            )
            .replace(
                /\s{2,}/g,
                " "
            )
            .trim();
    }

    function removeLowPriorityParentheticals(
        text
    ) {
        return text.replace(
            /\s*\((?:opcional|recomendado|cuando sea posible|si procede)[^)]*\)/gi,
            ""
        );
    }

    function compressRepeatedIdentityRules(
        text
    ) {
        const sentences =
            splitSentences(text);

        const identitySentences =
            sentences.filter(
                sentence =>
                    IDENTITY_KEYWORDS
                        .some(
                            keyword =>
                                sentence
                                    .toLowerCase()
                                    .includes(
                                        keyword
                                    )
                        )
            );

        if (
            identitySentences.length <=
            4
        ) {
            return text;
        }

        const compressed =
            "Preservar exactamente la identidad, la edad aparente, la estructura facial, la textura natural de la piel, el cabello, las canas, los rasgos distintivos y las asimetrías reales.";

        let result =
            text;

        identitySentences
            .slice(1)
            .forEach(
                sentence => {
                    result =
                        removeSentence(
                            result,
                            sentence
                        );
                }
            );

        if (
            !result.includes(
                compressed
            )
        ) {
            result =
                [
                    compressed,
                    result
                ]
                    .filter(Boolean)
                    .join("\n\n");
        }

        return result;
    }

    function truncateSafely(
        text,
        target
    ) {
        if (
            text.length <= target
        ) {
            return text;
        }

        const protectedPrefix =
            buildIdentityGuard(
                PROVIDERS.GENERIC
            );

        const available =
            Math.max(
                100,
                target -
                protectedPrefix.length -
                4
            );

        let truncated =
            text.slice(
                0,
                available
            );

        const lastBoundary =
            Math.max(
                truncated.lastIndexOf(
                    "."
                ),

                truncated.lastIndexOf(
                    ","
                ),

                truncated.lastIndexOf(
                    ";"
                )
            );

        if (
            lastBoundary > 100
        ) {
            truncated =
                truncated.slice(
                    0,
                    lastBoundary + 1
                );
        }

        return [
            protectedPrefix,
            truncated
        ]
            .filter(Boolean)
            .join("\n\n")
            .slice(
                0,
                target
            )
            .trim();
    }

    function finalCleanup(
        text,
        options
    ) {
        let result =
            normalizeWhitespace(
                text,
                options
            );

        result =
            normalizePunctuation(
                result,
                options
            );

        result =
            result.replace(
                /,\s*$/g,
                ""
            );

        result =
            result.replace(
                /;\s*$/g,
                ""
            );

        if (
            !isCompactProvider(
                options.provider
            ) &&
            result &&
            !/[.!?]$/.test(
                result
            )
        ) {
            result += ".";
        }

        return result.trim();
    }

    /* ========================================================
       REGLAS AUXILIARES
       ======================================================== */

    function buildIdentityGuard(
        provider
    ) {
        if (
            provider ===
                PROVIDERS.MIDJOURNEY ||
            provider ===
                PROVIDERS.FLUX ||
            provider ===
                PROVIDERS.STABLE_DIFFUSION
        ) {
            return "same person, preserve exact identity, apparent age, facial structure, natural skin texture, hair pattern, gray hair and natural asymmetries";
        }

        return "Mantener exactamente la misma persona. La identidad prevalece sobre cualquier decisión creativa: preservar edad aparente, estructura facial, textura natural de la piel, cabello, canas, rasgos distintivos y asimetrías reales.";
    }

    function isCompactProvider(
        provider
    ) {
        return [
            PROVIDERS.MIDJOURNEY,
            PROVIDERS.FLUX,
            PROVIDERS.STABLE_DIFFUSION
        ].includes(provider);
    }

    function normalizeComparisonText(
        value
    ) {
        return normalizeText(value)
            .toLowerCase()
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .replace(
                /[^a-z0-9\s]/g,
                ""
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    function normalizeList(value) {
        if (Array.isArray(value)) {
            return value
                .flatMap(
                    item =>
                        normalizeList(
                            item
                        )
                )
                .filter(Boolean);
        }

        if (
            typeof value ===
                "string"
        ) {
            return value
                .split(
                    /[,;\n]+/
                )
                .map(
                    normalizeText
                )
                .filter(Boolean);
        }

        return [];
    }

    function uniqueStrings(values) {
        const seen =
            new Set();

        return normalizeArray(values)
            .map(
                normalizeText
            )
            .filter(Boolean)
            .filter(
                item => {
                    const key =
                        normalizeComparisonText(
                            item
                        );

                    if (
                        seen.has(key)
                    ) {
                        return false;
                    }

                    seen.add(key);

                    return true;
                }
            );
    }

    function normalizeObject(value) {
        return (
            value &&
            typeof value ===
                "object" &&
            !Array.isArray(value)
        )
            ? value
            : {};
    }

    function normalizeArray(value) {
        return Array.isArray(value)
            ? value
            : [];
    }

    function normalizeText(value) {
        return String(
            value ?? ""
        ).trim();
    }

    function normalizeOptionalPositiveNumber(
        value
    ) {
        const number =
            Number(value);

        return Number.isFinite(
            number
        ) &&
        number > 0
            ? number
            : null;
    }

    function hasValue(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return false;
        }

        if (
            typeof value ===
                "string"
        ) {
            return value.trim()
                .length > 0;
        }

        if (
            Array.isArray(value)
        ) {
            return value.length > 0;
        }

        if (
            typeof value ===
                "object"
        ) {
            return Object.keys(value)
                .length > 0;
        }

        return true;
    }

    function countWords(value) {
        const text =
            normalizeText(value);

        return text
            ? text
                .split(/\s+/)
                .length
            : 0;
    }

    function clampInteger(
        value,
        minimum,
        maximum,
        fallback
    ) {
        const number =
            Number.parseInt(
                value,
                10
            );

        if (
            !Number.isFinite(
                number
            )
        ) {
            return fallback;
        }

        return Math.min(
            maximum,
            Math.max(
                minimum,
                number
            )
        );
    }

    function clampNumber(
        value,
        minimum,
        maximum,
        fallback
    ) {
        const number =
            Number(value);

        if (
            !Number.isFinite(
                number
            )
        ) {
            return fallback;
        }

        return Math.min(
            maximum,
            Math.max(
                minimum,
                number
            )
        );
    }

    /* ========================================================
       RESULTADOS Y ERRORES
       ======================================================== */

    function createChange({
        type,
        description,
        severity = "info"
    }) {
        return {
            id:
                createId(),

            type:
                normalizeText(type),

            description:
                normalizeText(
                    description
                ),

            severity:
                normalizeText(
                    severity
                ) ||
                "info"
        };
    }

    function createIssue(
        code,
        message
    ) {
        return {
            code:
                normalizeText(code),

            message:
                normalizeText(
                    message
                )
        };
    }

    function createOptimizerError(
        code,
        message,
        validation
    ) {
        const error =
            new Error(message);

        error.name =
            "PromptOptimizerError";

        error.code =
            code;

        error.validation =
            clone(validation);

        return error;
    }

    function createId() {
        if (
            window.crypto &&
            typeof crypto.randomUUID ===
                "function"
        ) {
            return crypto.randomUUID();
        }

        return (
            "prompt-optimization-" +
            Date.now()
                .toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    }

    function clone(value) {
        if (
            value === undefined
        ) {
            return undefined;
        }

        if (
            typeof structuredClone ===
                "function"
        ) {
            return structuredClone(
                value
            );
        }

        return JSON.parse(
            JSON.stringify(value)
        );
    }

    function deepFreeze(value) {
        if (
            !value ||
            typeof value !==
                "object" ||
            Object.isFrozen(value)
        ) {
            return value;
        }

        Object.freeze(value);

        Object.values(value)
            .forEach(
                deepFreeze
            );

        return value;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        VERSION,

        MODES,
        LEVELS,
        PROVIDERS,
        LEVEL_TARGETS,
        PROVIDER_LIMITS,

        optimize,

        validateInput,
        validateOutput,

        removeRedundancies,
        strengthenInstructions,
        enforceIdentityPriority,
        removeIdentityConflicts,
        adaptToProvider,
        reduceToTarget,

        optimizeNegativePrompt,
        optimizeParameters,

        buildMetrics,
        calculateIdentityCoverage,
        estimateTokens
    });

})();

window.PromptOptimizer =
    PromptOptimizer;
