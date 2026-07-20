"use strict";

/* ============================================================
   PortraitOS
   Prompt Compiler
   ------------------------------------------------------------
   Responsabilidad:
   - Transformar un Portrait Contract en prompts utilizables.
   - Adaptar la salida al proveedor seleccionado.
   - Generar versiones short, standard, professional y contract.
   - Separar prompt principal, negative prompt y parámetros.
   - Preservar siempre la prioridad de identidad.
   - No modificar ni reinterpretar el Portrait Contract.
   ============================================================ */

const PromptCompiler = (() => {

    /* ========================================================
       CONFIGURACIÓN
       ======================================================== */

    const VERSION = "1.0.0";

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
        provider:
            PROVIDERS.GENERIC,

        level:
            LEVELS.PROFESSIONAL,

        language:
            "es",

        includeNegativePrompt:
            true,

        includeParameters:
            true,

        includeReferenceInstructions:
            true,

        includeIdentityContract:
            true,

        includeHeadings:
            true,

        preserveLineBreaks:
            true
    });

    const LEVEL_LIMITS = Object.freeze({
        short:
            900,

        standard:
            2200,

        professional:
            4800,

        contract:
            20000
    });

    const PROVIDER_CONFIG = Object.freeze({
        generic: {
            supportsNegativePrompt:
                true,

            supportsParameters:
                false,

            sentenceStyle:
                "structured",

            parameterPrefix:
                "",

            parameterSeparator:
                " "
        },

        openai: {
            supportsNegativePrompt:
                false,

            supportsParameters:
                false,

            sentenceStyle:
                "natural",

            parameterPrefix:
                "",

            parameterSeparator:
                " "
        },

        "gpt-image": {
            supportsNegativePrompt:
                false,

            supportsParameters:
                false,

            sentenceStyle:
                "natural",

            parameterPrefix:
                "",

            parameterSeparator:
                " "
        },

        midjourney: {
            supportsNegativePrompt:
                true,

            supportsParameters:
                true,

            sentenceStyle:
                "compact",

            parameterPrefix:
                "--",

            parameterSeparator:
                " "
        },

        flux: {
            supportsNegativePrompt:
                true,

            supportsParameters:
                true,

            sentenceStyle:
                "descriptive",

            parameterPrefix:
                "",

            parameterSeparator:
                ", "
        },

        "stable-diffusion": {
            supportsNegativePrompt:
                true,

            supportsParameters:
                true,

            sentenceStyle:
                "tagged",

            parameterPrefix:
                "",

            parameterSeparator:
                ", "
        },

        ideogram: {
            supportsNegativePrompt:
                true,

            supportsParameters:
                false,

            sentenceStyle:
                "descriptive",

            parameterPrefix:
                "",

            parameterSeparator:
                " "
        },

        firefly: {
            supportsNegativePrompt:
                false,

            supportsParameters:
                false,

            sentenceStyle:
                "natural",

            parameterPrefix:
                "",

            parameterSeparator:
                " "
        }
    });

    /* ========================================================
       COMPILACIÓN PRINCIPAL
       ======================================================== */

    function compile(contract, options = {}) {
        const normalizedContract =
            normalizeContract(contract);

        const normalizedOptions =
            normalizeOptions(
                normalizedContract,
                options
            );

        const validation =
            validate(
                normalizedContract,
                normalizedOptions
            );

        if (
            validation.blockers.length
        ) {
            throw createCompilerError(
                "PROMPT_COMPILATION_BLOCKED",
                "No es posible compilar el prompt.",
                validation
            );
        }

        const provider =
            normalizedOptions.provider;

        const adapter =
            getProviderAdapter(provider);

        const context = {
            contract:
                normalizedContract,

            options:
                normalizedOptions,

            providerConfig:
                PROVIDER_CONFIG[
                    provider
                ],

            sections:
                buildSections(
                    normalizedContract,
                    normalizedOptions
                )
        };

        const compiled =
            adapter(context);

        const result = {
            compilerVersion:
                VERSION,

            contractId:
                normalizedContract
                    .contractId,

            contractFingerprint:
                normalizedContract
                    .fingerprint,

            provider,

            level:
                normalizedOptions.level,

            language:
                normalizedOptions.language,

            prompt:
                normalizePromptText(
                    compiled.prompt,
                    normalizedOptions
                ),

            negativePrompt:
                normalizedOptions
                    .includeNegativePrompt
                    ? normalizePromptText(
                        compiled
                            .negativePrompt,
                        normalizedOptions
                    )
                    : "",

            parameters:
                normalizedOptions
                    .includeParameters
                    ? clone(
                        compiled.parameters ||
                        {}
                    )
                    : {},

            command:
                "",

            metadata: {
                characterCount:
                    0,

                wordCount:
                    0,

                negativeCharacterCount:
                    0,

                sectionsIncluded:
                    Object.keys(
                        context.sections
                    ).filter(
                        key =>
                            hasValue(
                                context.sections[
                                    key
                                ]
                            )
                    ),

                supportsNegativePrompt:
                    context.providerConfig
                        .supportsNegativePrompt,

                supportsParameters:
                    context.providerConfig
                        .supportsParameters,

                compiledAt:
                    new Date()
                        .toISOString()
            },

            validation:
                null
        };

        result.command =
            buildCommand(
                result,
                normalizedOptions
            );

        result.metadata.characterCount =
            result.prompt.length;

        result.metadata.wordCount =
            countWords(
                result.prompt
            );

        result.metadata
            .negativeCharacterCount =
            result.negativePrompt.length;

        result.validation =
            validateCompiledPrompt(
                result,
                normalizedOptions
            );

        return deepFreeze(
            clone(result)
        );
    }

    /* ========================================================
       CONSTRUCCIÓN DE SECCIONES
       ======================================================== */

    function buildSections(
        contract,
        options
    ) {
        return {
            objective:
                buildObjectiveSection(
                    contract
                ),

            identity:
                options
                    .includeIdentityContract
                    ? buildIdentitySection(
                        contract
                    )
                    : "",

            references:
                options
                    .includeReferenceInstructions
                    ? buildReferencesSection(
                        contract
                    )
                    : "",

            creativeDirection:
                buildCreativeDirectionSection(
                    contract
                ),

            technical:
                buildTechnicalSection(
                    contract
                ),

            constraints:
                buildConstraintsSection(
                    contract
                ),

            negative:
                buildNegativeSection(
                    contract
                )
        };
    }

    function buildObjectiveSection(
        contract
    ) {
        const intent =
            contract
                .creativeDirection
                ?.intent ||
            {};

        const fragments = [];

        fragments.push(
            "Crear un retrato fotográfico profesional de la persona representada en las imágenes de referencia."
        );

        appendSentence(
            fragments,
            "Objetivo",
            intent.objective
        );

        appendSentence(
            fragments,
            "Uso previsto",
            intent.useCase
        );

        appendSentence(
            fragments,
            "Plataforma",
            intent.platform
        );

        appendSentence(
            fragments,
            "Audiencia",
            intent.audience
        );

        appendSentence(
            fragments,
            "Mensaje",
            intent.message
        );

        return joinSentences(
            fragments
        );
    }

    function buildIdentitySection(
        contract
    ) {
        const identity =
            contract.subject
                ?.identity ||
            {};

        const fragments = [];

        fragments.push(
            "La identidad de la persona es fija, permanente y prioritaria."
        );

        appendSentence(
            fragments,
            "Edad aparente",
            identity.age
                ?.apparentRange
        );

        appendSentence(
            fragments,
            "Indicaciones de edad",
            identity.age
                ?.instructions
        );

        appendSentence(
            fragments,
            "Forma del rostro",
            identity.face
                ?.shape
        );

        appendSentence(
            fragments,
            "Proporciones faciales",
            identity.face
                ?.proportions
        );

        appendSentence(
            fragments,
            "Estructura facial",
            identity.face
                ?.structure
        );

        appendListSentence(
            fragments,
            "Asimetrías naturales",
            identity.face
                ?.asymmetries
        );

        appendListSentence(
            fragments,
            "Rasgos distintivos",
            identity.face
                ?.distinctiveFeatures
        );

        appendSentence(
            fragments,
            "Tono de piel",
            identity.skin
                ?.tone
        );

        appendSentence(
            fragments,
            "Subtono de piel",
            identity.skin
                ?.undertone
        );

        appendSentence(
            fragments,
            "Textura de piel",
            identity.skin
                ?.texture
        );

        appendSentence(
            fragments,
            "Arrugas y líneas naturales",
            identity.skin
                ?.wrinkles
        );

        appendListSentence(
            fragments,
            "Marcas de piel",
            identity.skin
                ?.marks
        );

        appendSentence(
            fragments,
            "Color de ojos",
            identity.eyes
                ?.color
        );

        appendSentence(
            fragments,
            "Forma de ojos",
            identity.eyes
                ?.shape
        );

        appendSentence(
            fragments,
            "Tamaño de ojos",
            identity.eyes
                ?.size
        );

        appendSentence(
            fragments,
            "Separación de ojos",
            identity.eyes
                ?.spacing
        );

        appendSentence(
            fragments,
            "Asimetría ocular",
            identity.eyes
                ?.asymmetry
        );

        appendSentence(
            fragments,
            "Cejas",
            formatObjectSummary(
                identity.eyebrows
            )
        );

        appendSentence(
            fragments,
            "Nariz",
            formatObjectSummary(
                identity.nose
            )
        );

        appendSentence(
            fragments,
            "Boca y labios",
            formatObjectSummary(
                identity.mouth
            )
        );

        appendSentence(
            fragments,
            "Mandíbula y mentón",
            formatObjectSummary(
                identity.jaw
            )
        );

        appendSentence(
            fragments,
            "Cabello",
            formatObjectSummary(
                identity.hair
            )
        );

        appendSentence(
            fragments,
            "Vello facial",
            formatObjectSummary(
                identity.facialHair
            )
        );

        appendSentence(
            fragments,
            "Orejas",
            identity.ears
        );

        appendSentence(
            fragments,
            "Cuello",
            identity.neck
        );

        appendSentence(
            fragments,
            "Constitución corporal",
            formatObjectSummary(
                identity.body
            )
        );

        appendListSentence(
            fragments,
            "Instrucciones inmutables",
            identity
                .immutableInstructions
        );

        return joinSentences(
            fragments
        );
    }

    function buildReferencesSection(
        contract
    ) {
        const references =
            contract.subject
                ?.references ||
            {};

        const fragments = [];

        if (
            references.items
                ?.length
        ) {
            fragments.push(
                `Usar ${references.items.length} fotografía${references.items.length === 1 ? "" : "s"} como referencia de identidad.`
            );
        }

        appendListSentence(
            fragments,
            "Reglas de uso",
            references.instructions
        );

        const descriptions =
            normalizeArray(
                references.items
            )
                .map(
                    item => {
                        const details = [
                            item.primary
                                ? "principal"
                                : null,

                            item.role,

                            item.angle,

                            item.quality
                                ? `calidad ${item.quality}`
                                : null,

                            item.notes
                        ]
                            .filter(
                                hasValue
                            )
                            .join(", ");

                        return details
                            ? `${item.name || item.id}: ${details}`
                            : item.name ||
                              item.id;
                    }
                )
                .filter(Boolean);

        appendListSentence(
            fragments,
            "Referencias disponibles",
            descriptions
        );

        return joinSentences(
            fragments
        );
    }

    function buildCreativeDirectionSection(
        contract
    ) {
        const direction =
            contract
                .creativeDirection ||
            {};

        const fragments = [];

        appendSentence(
            fragments,
            "Iluminación",
            formatObjectSummary(
                direction.lighting
            )
        );

        appendSentence(
            fragments,
            "Cámara",
            formatObjectSummary(
                direction.camera
            )
        );

        appendSentence(
            fragments,
            "Composición",
            formatObjectSummary(
                direction.composition
            )
        );

        appendSentence(
            fragments,
            "Fondo y entorno",
            formatObjectSummary(
                direction.background
            )
        );

        appendSentence(
            fragments,
            "Vestuario",
            formatObjectSummary(
                direction.wardrobe
            )
        );

        appendSentence(
            fragments,
            "Pose y expresión",
            formatObjectSummary(
                direction.pose
            )
        );

        appendSentence(
            fragments,
            "Tratamiento visual",
            formatObjectSummary(
                direction.treatment
            )
        );

        appendListSentence(
            fragments,
            "Instrucciones adicionales",
            direction
                .additionalInstructions
        );

        return joinSentences(
            fragments
        );
    }

    function buildTechnicalSection(
        contract
    ) {
        const output =
            contract.output ||
            {};

        const fragments = [];

        appendSentence(
            fragments,
            "Relación de aspecto",
            output.aspectRatio
        );

        if (
            output.dimensions
                ?.width &&
            output.dimensions
                ?.height
        ) {
            appendSentence(
                fragments,
                "Dimensiones",
                `${output.dimensions.width} × ${output.dimensions.height} px`
            );
        }

        appendSentence(
            fragments,
            "Número de imágenes",
            output.imageCount
        );

        appendSentence(
            fragments,
            "Nivel de detalle",
            output.level
        );

        return joinSentences(
            fragments
        );
    }

    function buildConstraintsSection(
        contract
    ) {
        const constraints =
            contract.constraints ||
            {};

        const fragments = [];

        fragments.push(
            "En cualquier conflicto, la identidad prevalece sobre la dirección creativa."
        );

        appendListSentence(
            fragments,
            "Obligatorio",
            constraints.mandatory
        );

        appendListSentence(
            fragments,
            "Cambios permitidos",
            constraints.allowChanges
        );

        appendListSentence(
            fragments,
            "Cambios prohibidos",
            constraints.prohibitedChanges
        );

        return joinSentences(
            fragments
        );
    }

    function buildNegativeSection(
        contract
    ) {
        return uniqueStrings(
            contract.constraints
                ?.negative ||
            []
        ).join(", ");
    }

    /* ========================================================
       ADAPTADORES DE PROVEEDOR
       ======================================================== */

    function getProviderAdapter(
        provider
    ) {
        const adapters = {
            generic:
                compileGeneric,

            openai:
                compileOpenAI,

            "gpt-image":
                compileOpenAI,

            midjourney:
                compileMidjourney,

            flux:
                compileFlux,

            "stable-diffusion":
                compileStableDiffusion,

            ideogram:
                compileIdeogram,

            firefly:
                compileFirefly
        };

        return (
            adapters[provider] ||
            compileGeneric
        );
    }

    function compileGeneric(context) {
        return {
            prompt:
                composeStructuredPrompt(
                    context
                ),

            negativePrompt:
                context.sections
                    .negative,

            parameters:
                buildGenericParameters(
                    context.contract
                )
        };
    }

    function compileOpenAI(context) {
        const prompt =
            composeNaturalPrompt(
                context,
                {
                    integrateNegatives:
                        true,

                    explicitReferencePriority:
                        true
                }
            );

        return {
            prompt,

            negativePrompt:
                "",

            parameters:
                {}
        };
    }

    function compileMidjourney(context) {
        const concise =
            composeCompactPrompt(
                context
            );

        const parameters =
            buildMidjourneyParameters(
                context.contract
            );

        return {
            prompt:
                concise,

            negativePrompt:
                context.sections
                    .negative,

            parameters
        };
    }

    function compileFlux(context) {
        return {
            prompt:
                composeDescriptivePrompt(
                    context
                ),

            negativePrompt:
                context.sections
                    .negative,

            parameters:
                buildDiffusionParameters(
                    context.contract,
                    "flux"
                )
        };
    }

    function compileStableDiffusion(
        context
    ) {
        return {
            prompt:
                composeTaggedPrompt(
                    context
                ),

            negativePrompt:
                buildStableDiffusionNegativePrompt(
                    context
                ),

            parameters:
                buildDiffusionParameters(
                    context.contract,
                    "stable-diffusion"
                )
        };
    }

    function compileIdeogram(context) {
        return {
            prompt:
                composeDescriptivePrompt(
                    context
                ),

            negativePrompt:
                context.sections
                    .negative,

            parameters:
                {}
        };
    }

    function compileFirefly(context) {
        return {
            prompt:
                composeNaturalPrompt(
                    context,
                    {
                        integrateNegatives:
                            true,

                        explicitReferencePriority:
                            true
                    }
                ),

            negativePrompt:
                "",

            parameters:
                {}
        };
    }

    /* ========================================================
       COMPOSICIÓN POR NIVEL
       ======================================================== */

    function composeStructuredPrompt(
        context
    ) {
        const sections =
            selectSectionsForLevel(
                context
            );

        return formatSections(
            sections,
            context.options
        );
    }

    function composeNaturalPrompt(
        context,
        options = {}
    ) {
        const level =
            context.options.level;

        const sections =
            context.sections;

        const paragraphs = [];

        paragraphs.push(
            sections.objective
        );

        if (
            level !==
            LEVELS.SHORT
        ) {
            paragraphs.push(
                sections.identity
            );
        } else {
            paragraphs.push(
                summarizeIdentity(
                    context.contract
                )
            );
        }

        if (
            context.options
                .includeReferenceInstructions &&
            level !==
                LEVELS.SHORT
        ) {
            paragraphs.push(
                sections.references
            );
        }

        paragraphs.push(
            sections.creativeDirection
        );

        if (
            level ===
                LEVELS.PROFESSIONAL ||
            level ===
                LEVELS.CONTRACT
        ) {
            paragraphs.push(
                sections.technical
            );

            paragraphs.push(
                sections.constraints
            );
        } else {
            paragraphs.push(
                "Preservar estrictamente la identidad, la edad aparente, la estructura facial y la textura natural."
            );
        }

        if (
            options.integrateNegatives &&
            hasValue(
                sections.negative
            )
        ) {
            paragraphs.push(
                `Evitar expresamente: ${sections.negative}.`
            );
        }

        return paragraphs
            .filter(hasValue)
            .join("\n\n");
    }

    function composeCompactPrompt(
        context
    ) {
        const contract =
            context.contract;

        const identity =
            summarizeIdentity(
                contract
            );

        const creative =
            summarizeCreativeDirection(
                contract
            );

        const constraints =
            "same person, preserve exact identity, preserve apparent age, facial structure, skin texture, hair pattern and natural asymmetries";

        const fragments = [
            "professional photographic portrait",

            identity,

            creative,

            constraints
        ];

        if (
            context.options.level ===
                LEVELS.PROFESSIONAL ||
            context.options.level ===
                LEVELS.CONTRACT
        ) {
            fragments.push(
                context.sections
                    .technical
            );
        }

        return fragments
            .filter(hasValue)
            .join(", ");
    }

    function composeDescriptivePrompt(
        context
    ) {
        const sections =
            context.sections;

        const fragments = [
            sections.objective,

            summarizeIdentity(
                context.contract
            ),

            sections.creativeDirection
        ];

        if (
            context.options.level !==
            LEVELS.SHORT
        ) {
            fragments.push(
                sections.references
            );
        }

        if (
            context.options.level ===
                LEVELS.PROFESSIONAL ||
            context.options.level ===
                LEVELS.CONTRACT
        ) {
            fragments.push(
                sections.constraints,

                sections.technical
            );
        }

        return fragments
            .filter(hasValue)
            .join("\n\n");
    }

    function composeTaggedPrompt(
        context
    ) {
        const contract =
            context.contract;

        const identityTags =
            extractIdentityTags(
                contract
            );

        const creativeTags =
            extractCreativeTags(
                contract
            );

        const qualityTags = [
            "professional portrait photography",
            "photorealistic",
            "natural skin texture",
            "identity consistency",
            "high facial fidelity",
            "realistic proportions",
            "detailed eyes",
            "natural hair texture"
        ];

        return uniqueStrings([
            ...qualityTags,
            ...identityTags,
            ...creativeTags
        ]).join(", ");
    }

    function selectSectionsForLevel(
        context
    ) {
        const sections =
            context.sections;

        const level =
            context.options.level;

        if (
            level ===
            LEVELS.SHORT
        ) {
            return [
                {
                    title:
                        "Objetivo",

                    content:
                        sections.objective
                },

                {
                    title:
                        "Identidad",

                    content:
                        summarizeIdentity(
                            context.contract
                        )
                },

                {
                    title:
                        "Dirección creativa",

                    content:
                        summarizeCreativeDirection(
                            context.contract
                        )
                },

                {
                    title:
                        "Restricción principal",

                    content:
                        "Preservar estrictamente la identidad, la edad aparente y los rasgos permanentes."
                }
            ];
        }

        if (
            level ===
            LEVELS.STANDARD
        ) {
            return [
                {
                    title:
                        "Objetivo",

                    content:
                        sections.objective
                },

                {
                    title:
                        "Identidad",

                    content:
                        summarizeIdentity(
                            context.contract
                        )
                },

                {
                    title:
                        "Referencias",

                    content:
                        sections.references
                },

                {
                    title:
                        "Dirección creativa",

                    content:
                        sections
                            .creativeDirection
                },

                {
                    title:
                        "Restricciones",

                    content:
                        summarizeConstraints(
                            context.contract
                        )
                }
            ];
        }

        if (
            level ===
            LEVELS.CONTRACT
        ) {
            return [
                {
                    title:
                        "Objetivo",

                    content:
                        sections.objective
                },

                {
                    title:
                        "Contrato de identidad permanente",

                    content:
                        sections.identity
                },

                {
                    title:
                        "Referencias fotográficas",

                    content:
                        sections.references
                },

                {
                    title:
                        "Dirección creativa",

                    content:
                        sections
                            .creativeDirection
                },

                {
                    title:
                        "Especificaciones técnicas",

                    content:
                        sections.technical
                },

                {
                    title:
                        "Reglas y restricciones",

                    content:
                        sections.constraints
                },

                {
                    title:
                        "Negative prompt",

                    content:
                        sections.negative
                }
            ];
        }

        return [
            {
                title:
                    "Objetivo",

                content:
                    sections.objective
            },

            {
                title:
                    "Identidad permanente",

                content:
                    sections.identity
            },

            {
                title:
                    "Referencias fotográficas",

                content:
                    sections.references
            },

            {
                title:
                    "Dirección creativa",

                content:
                    sections
                        .creativeDirection
            },

            {
                title:
                    "Especificaciones técnicas",

                content:
                    sections.technical
            },

            {
                title:
                    "Restricciones",

                content:
                    sections.constraints
            }
        ];
    }

    function formatSections(
        sections,
        options
    ) {
        return sections
            .filter(
                section =>
                    hasValue(
                        section.content
                    )
            )
            .map(
                section => {
                    if (
                        options
                            .includeHeadings ===
                        false
                    ) {
                        return section
                            .content;
                    }

                    return (
                        `${section.title.toUpperCase()}\n` +
                        section.content
                    );
                }
            )
            .join("\n\n");
    }

    /* ========================================================
       RESÚMENES
       ======================================================== */

    function summarizeIdentity(
        contract
    ) {
        const identity =
            contract.subject
                ?.identity ||
            {};

        const fragments = [];

        appendCompactValue(
            fragments,
            identity.age
                ?.apparentRange
                ? `edad aparente ${identity.age.apparentRange}`
                : null
        );

        appendCompactValue(
            fragments,
            identity.face
                ?.shape
                ? `rostro ${identity.face.shape}`
                : null
        );

        appendCompactValue(
            fragments,
            identity.skin
                ?.tone
                ? `piel ${identity.skin.tone}`
                : null
        );

        appendCompactValue(
            fragments,
            identity.skin
                ?.texture
                ? `textura de piel ${identity.skin.texture}`
                : null
        );

        appendCompactValue(
            fragments,
            identity.eyes
                ?.color
                ? `ojos ${identity.eyes.color}`
                : null
        );

        appendCompactValue(
            fragments,
            identity.hair
                ? `cabello ${formatObjectSummary(identity.hair)}`
                : null
        );

        appendCompactValue(
            fragments,
            identity.facialHair &&
            Object.keys(
                identity.facialHair
            ).length
                ? `vello facial ${formatObjectSummary(identity.facialHair)}`
                : null
        );

        appendCompactValue(
            fragments,
            normalizeArray(
                identity.face
                    ?.distinctiveFeatures
            ).join(", ")
        );

        const description =
            fragments.join(", ");

        return description
            ? `Mantener exactamente la misma persona: ${description}.`
            : "Mantener exactamente la misma persona y todos sus rasgos permanentes.";
    }

    function summarizeCreativeDirection(
        contract
    ) {
        const direction =
            contract
                .creativeDirection ||
            {};

        const fragments = [
            formatObjectSummary(
                direction.lighting
            ),

            formatObjectSummary(
                direction.camera
            ),

            formatObjectSummary(
                direction.composition
            ),

            formatObjectSummary(
                direction.background
            ),

            formatObjectSummary(
                direction.wardrobe
            ),

            formatObjectSummary(
                direction.pose
            ),

            formatObjectSummary(
                direction.treatment
            )
        ]
            .filter(hasValue);

        return fragments.join(
            ". "
        );
    }

    function summarizeConstraints(
        contract
    ) {
        const constraints =
            contract.constraints ||
            {};

        const prohibited =
            normalizeArray(
                constraints
                    .prohibitedChanges
            );

        return [
            "La identidad prevalece sobre cualquier decisión creativa.",

            prohibited.length
                ? `No modificar: ${prohibited.join(", ")}.`
                : "",

            "Solo pueden variar vestuario, pose, iluminación, cámara, composición y fondo."
        ]
            .filter(hasValue)
            .join(" ");
    }

    /* ========================================================
       PARÁMETROS
       ======================================================== */

    function buildGenericParameters(
        contract
    ) {
        return compactObject({
            provider:
                contract.output
                    ?.provider,

            aspectRatio:
                contract.output
                    ?.aspectRatio,

            dimensions:
                contract.output
                    ?.dimensions,

            imageCount:
                contract.output
                    ?.imageCount,

            seed:
                contract.output
                    ?.seed
        });
    }

    function buildMidjourneyParameters(
        contract
    ) {
        const output =
            contract.output ||
            {};

        const parameters = {};

        const aspectRatio =
            normalizeAspectRatio(
                output.aspectRatio
            );

        if (aspectRatio) {
            parameters.ar =
                aspectRatio;
        }

        if (output.seed) {
            parameters.seed =
                output.seed;
        }

        parameters.style =
            "raw";

        parameters.stylize =
            inferMidjourneyStylize(
                contract
            );

        parameters.quality =
            1;

        return parameters;
    }

    function buildDiffusionParameters(
        contract,
        provider
    ) {
        const output =
            contract.output ||
            {};

        const dimensions =
            output.dimensions ||
            inferDimensionsFromAspectRatio(
                output.aspectRatio
            );

        const parameters = {
            width:
                dimensions?.width ||
                1024,

            height:
                dimensions?.height ||
                1024,

            steps:
                provider ===
                    "flux"
                    ? 28
                    : 35,

            guidance:
                provider ===
                    "flux"
                    ? 3.5
                    : 7,

            seed:
                output.seed ||
                -1
        };

        return parameters;
    }

    function inferMidjourneyStylize(
        contract
    ) {
        const realism =
            normalizeText(
                contract
                    .creativeDirection
                    ?.treatment
                    ?.realism
            ).toLowerCase();

        if (
            realism.includes(
                "photo"
            ) ||
            realism.includes(
                "real"
            )
        ) {
            return 50;
        }

        if (
            realism.includes(
                "editorial"
            )
        ) {
            return 100;
        }

        return 75;
    }

    function buildCommand(
        result,
        options
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
                .map(
                    ([key, value]) =>
                        `--${key} ${value}`
                )
                .join(" ");

        const negative =
            result.negativePrompt
                ? ` --no ${result.negativePrompt}`
                : "";

        return [
            result.prompt,
            parameterString,
            negative
        ]
            .filter(hasValue)
            .join(" ")
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    /* ========================================================
       STABLE DIFFUSION
       ======================================================== */

    function extractIdentityTags(
        contract
    ) {
        const identity =
            contract.subject
                ?.identity ||
            {};

        return uniqueStrings([
            identity.age
                ?.apparentRange,

            identity.face
                ?.shape,

            identity.face
                ?.structure,

            identity.skin
                ?.tone,

            identity.skin
                ?.texture,

            identity.eyes
                ?.color,

            identity.eyes
                ?.shape,

            identity.hair
                ?.color,

            identity.hair
                ?.texture,

            identity.hair
                ?.pattern,

            ...normalizeArray(
                identity.face
                    ?.distinctiveFeatures
            )
        ]);
    }

    function extractCreativeTags(
        contract
    ) {
        const direction =
            contract
                .creativeDirection ||
            {};

        return uniqueStrings([
            ...objectValuesAsStrings(
                direction.lighting
            ),

            ...objectValuesAsStrings(
                direction.camera
            ),

            ...objectValuesAsStrings(
                direction.composition
            ),

            ...objectValuesAsStrings(
                direction.background
            ),

            ...objectValuesAsStrings(
                direction.wardrobe
            ),

            ...objectValuesAsStrings(
                direction.pose
            ),

            ...objectValuesAsStrings(
                direction.treatment
            )
        ]);
    }

    function buildStableDiffusionNegativePrompt(
        context
    ) {
        const base = [
            "different person",
            "identity drift",
            "face replacement",
            "generic face",
            "incorrect age",
            "younger appearance",
            "older appearance",
            "plastic skin",
            "waxy skin",
            "over-smoothed skin",
            "perfect symmetry",
            "altered facial structure",
            "different eyes",
            "different nose",
            "different jaw",
            "different hair texture",
            "missing gray hair",
            "beauty retouch",
            "deformed face",
            "bad anatomy",
            "extra fingers",
            "distorted hands",
            "low detail",
            "blurry face"
        ];

        return uniqueStrings([
            ...base,

            ...normalizeList(
                context.sections
                    .negative
            )
        ]).join(", ");
    }

    /* ========================================================
       VALIDACIÓN
       ======================================================== */

    function validate(
        contract,
        options = {}
    ) {
        const blockers = [];
        const errors = [];
        const warnings = [];

        if (!contract) {
            blockers.push(
                createIssue(
                    "CONTRACT_REQUIRED",
                    "No se ha proporcionado un Portrait Contract."
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
            contract.schema !==
            "portraitos.portrait-contract"
        ) {
            warnings.push(
                createIssue(
                    "UNKNOWN_CONTRACT_SCHEMA",
                    "El contrato no utiliza el esquema oficial de PortraitOS."
                )
            );
        }

        if (
            !contract.subject
                ?.identity
        ) {
            blockers.push(
                createIssue(
                    "IDENTITY_MISSING",
                    "El contrato no contiene identidad."
                )
            );
        }

        if (
            !contract
                .creativeDirection
        ) {
            blockers.push(
                createIssue(
                    "DIRECTION_MISSING",
                    "El contrato no contiene dirección creativa."
                )
            );
        }

        if (
            !contract.subject
                ?.references
                ?.items
                ?.length
        ) {
            blockers.push(
                createIssue(
                    "REFERENCES_MISSING",
                    "El contrato no contiene fotografías de referencia."
                )
            );
        }

        if (
            contract.validation
                ?.valid === false
        ) {
            errors.push(
                createIssue(
                    "CONTRACT_INVALID",
                    "El Portrait Contract contiene errores de validación."
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
                    "El nivel de prompt solicitado no es válido."
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
                    "El proveedor solicitado no es válido."
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

    function validateCompiledPrompt(
        compiled,
        options
    ) {
        const errors = [];
        const warnings = [];

        if (
            !hasValue(
                compiled.prompt
            )
        ) {
            errors.push(
                createIssue(
                    "EMPTY_PROMPT",
                    "El prompt compilado está vacío."
                )
            );
        }

        const limit =
            LEVEL_LIMITS[
                options.level
            ];

        if (
            limit &&
            compiled.prompt
                .length >
                limit
        ) {
            warnings.push(
                createIssue(
                    "PROMPT_OVER_LEVEL_LIMIT",
                    `El prompt supera el límite recomendado de ${limit} caracteres para el nivel ${options.level}.`
                )
            );
        }

        const identityTerms = [
            "identidad",
            "misma persona",
            "same person",
            "identity consistency",
            "preservar"
        ];

        const normalizedPrompt =
            compiled.prompt
                .toLowerCase();

        if (
            !identityTerms.some(
                term =>
                    normalizedPrompt
                        .includes(
                            term
                        )
            )
        ) {
            errors.push(
                createIssue(
                    "IDENTITY_PRIORITY_MISSING",
                    "El prompt compilado no expresa claramente la prioridad de identidad."
                )
            );
        }

        return {
            valid:
                errors.length ===
                0,

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

    function normalizeContract(
        contract
    ) {
        if (
            !contract ||
            typeof contract !==
                "object" ||
            Array.isArray(contract)
        ) {
            return null;
        }

        return clone(contract);
    }

    function normalizeOptions(
        contract,
        options
    ) {
        const source = {
            ...DEFAULT_OPTIONS,

            ...normalizeObject(
                contract?.output
            ),

            ...normalizeObject(
                options
            )
        };

        return {
            provider:
                normalizeProvider(
                    source.provider
                ),

            level:
                normalizeLevel(
                    source.level
                ),

            language:
                normalizeText(
                    source.language
                ) ||
                "es",

            includeNegativePrompt:
                source
                    .includeNegativePrompt !==
                false,

            includeParameters:
                source
                    .includeParameters !==
                false,

            includeReferenceInstructions:
                source
                    .includeReferenceInstructions !==
                false,

            includeIdentityContract:
                source
                    .includeIdentityContract !==
                false,

            includeHeadings:
                source
                    .includeHeadings !==
                false,

            preserveLineBreaks:
                source
                    .preserveLineBreaks !==
                false
        };
    }

    function normalizeProvider(value) {
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

    function normalizePromptText(
        value,
        options
    ) {
        let text =
            normalizeText(value);

        if (
            options
                .preserveLineBreaks
        ) {
            text = text
                .replace(
                    /[ \t]+/g,
                    " "
                )
                .replace(
                    /\n{3,}/g,
                    "\n\n"
                );
        } else {
            text = text
                .replace(
                    /\s+/g,
                    " "
                );
        }

        return text.trim();
    }

    /* ========================================================
       FORMATO
       ======================================================== */

    function appendSentence(
        target,
        label,
        value
    ) {
        if (!hasValue(value)) {
            return;
        }

        target.push(
            `${label}: ${normalizeSentenceValue(value)}.`
        );
    }

    function appendListSentence(
        target,
        label,
        values
    ) {
        const normalized =
            normalizeArray(values)
                .filter(hasValue);

        if (!normalized.length) {
            return;
        }

        target.push(
            `${label}: ${normalized.join("; ")}.`
        );
    }

    function appendCompactValue(
        target,
        value
    ) {
        if (hasValue(value)) {
            target.push(
                normalizeText(value)
            );
        }
    }

    function normalizeSentenceValue(
        value
    ) {
        if (
            typeof value ===
                "object"
        ) {
            return formatObjectSummary(
                value
            );
        }

        return normalizeText(value)
            .replace(
                /[.]+$/,
                ""
            );
    }

    function formatObjectSummary(
        object
    ) {
        if (
            !object ||
            typeof object !==
                "object" ||
            Array.isArray(object)
        ) {
            return normalizeText(
                object
            );
        }

        return Object.entries(
            object
        )
            .filter(
                ([key, value]) =>
                    ![
                        "immutable",
                        "immutableCharacteristics"
                    ].includes(key) &&
                    hasValue(value)
            )
            .map(
                ([key, value]) => {
                    const label =
                        humanizeKey(key);

                    if (
                        Array.isArray(
                            value
                        )
                    ) {
                        return `${label}: ${value.join(", ")}`;
                    }

                    if (
                        typeof value ===
                            "object"
                    ) {
                        return `${label}: ${formatObjectSummary(value)}`;
                    }

                    return `${label}: ${value}`;
                }
            )
            .join(", ");
    }

    function humanizeKey(key) {
        const labels = {
            apparentRange:
                "edad aparente",

            shotType:
                "plano",

            depthOfField:
                "profundidad de campo",

            colorTemperature:
                "temperatura de color",

            subjectPlacement:
                "posición del sujeto",

            negativeSpace:
                "espacio negativo",

            bodyOrientation:
                "orientación corporal",

            headOrientation:
                "orientación de cabeza",

            colorGrade:
                "tratamiento de color",

            grayHair:
                "canas",

            hairline:
                "línea de nacimiento",

            distinctiveDetails:
                "detalles distintivos",

            distinctiveFeatures:
                "rasgos distintivos"
        };

        if (labels[key]) {
            return labels[key];
        }

        return String(key)
            .replace(
                /([a-z])([A-Z])/g,
                "$1 $2"
            )
            .replace(
                /_/g,
                " "
            )
            .toLowerCase();
    }

    function objectValuesAsStrings(
        object
    ) {
        if (
            !object ||
            typeof object !==
                "object"
        ) {
            return [];
        }

        return Object.values(object)
            .flatMap(
                value => {
                    if (
                        Array.isArray(
                            value
                        )
                    ) {
                        return value;
                    }

                    if (
                        value &&
                        typeof value ===
                            "object"
                    ) {
                        return objectValuesAsStrings(
                            value
                        );
                    }

                    return hasValue(value)
                        ? [String(value)]
                        : [];
                }
            );
    }

    function joinSentences(
        sentences
    ) {
        return sentences
            .filter(hasValue)
            .join(" ")
            .replace(
                /\.\./g,
                "."
            )
            .trim();
    }

    /* ========================================================
       ASPECT RATIO Y DIMENSIONES
       ======================================================== */

    function normalizeAspectRatio(
        value
    ) {
        const normalized =
            normalizeText(value);

        const directMatch =
            normalized.match(
                /(\d+)\s*[:/x×-]\s*(\d+)/
            );

        if (directMatch) {
            return (
                `${directMatch[1]}:${directMatch[2]}`
            );
        }

        const aliases = {
            "square-1-1":
                "1:1",

            "portrait-4-5":
                "4:5",

            "portrait-2-3":
                "2:3",

            "landscape-3-2":
                "3:2",

            "landscape-16-9":
                "16:9"
        };

        return (
            aliases[
                normalized.toLowerCase()
            ] ||
            ""
        );
    }

    function inferDimensionsFromAspectRatio(
        value
    ) {
        const ratio =
            normalizeAspectRatio(
                value
            );

        const dimensions = {
            "1:1": {
                width: 1024,
                height: 1024
            },

            "4:5": {
                width: 1024,
                height: 1280
            },

            "2:3": {
                width: 1024,
                height: 1536
            },

            "3:2": {
                width: 1536,
                height: 1024
            },

            "16:9": {
                width: 1536,
                height: 864
            }
        };

        return (
            dimensions[ratio] ||
            null
        );
    }

    /* ========================================================
       UTILIDADES GENERALES
       ======================================================== */

    function compactObject(object) {
        return Object.fromEntries(
            Object.entries(object)
                .filter(
                    ([, value]) =>
                        hasValue(value)
                )
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

    function normalizeList(value) {
        if (Array.isArray(value)) {
            return value
                .map(normalizeText)
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
                    item =>
                        item.trim()
                )
                .filter(Boolean);
        }

        return [];
    }

    function uniqueStrings(values) {
        return [
            ...new Set(
                normalizeArray(values)
                    .map(normalizeText)
                    .filter(Boolean)
            )
        ];
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

    function normalizeText(value) {
        return String(
            value ?? ""
        ).trim();
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

    function createIssue(
        code,
        message
    ) {
        return {
            code,
            message
        };
    }

    function createCompilerError(
        code,
        message,
        validation
    ) {
        const error =
            new Error(message);

        error.name =
            "PromptCompilerError";

        error.code =
            code;

        error.validation =
            clone(validation);

        return error;
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

        LEVELS,
        PROVIDERS,
        LEVEL_LIMITS,

        compile,
        validate,
        validateCompiledPrompt,

        buildSections,
        buildObjectiveSection,
        buildIdentitySection,
        buildReferencesSection,
        buildCreativeDirectionSection,
        buildTechnicalSection,
        buildConstraintsSection,

        summarizeIdentity,
        summarizeCreativeDirection,
        summarizeConstraints,

        normalizeAspectRatio,
        inferDimensionsFromAspectRatio
    });

})();

window.PromptCompiler =
    PromptCompiler;
