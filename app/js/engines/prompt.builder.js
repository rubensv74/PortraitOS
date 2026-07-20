"use strict";

/* ============================================================
   PortraitOS
   Prompt Builder
   ------------------------------------------------------------
   Responsabilidad:
   - Transformar un perfil validado en un Portrait Contract.
   - Separar identidad permanente y dirección creativa.
   - Construir una representación estructurada e independiente
     del proveedor de generación de imágenes.
   - Mantener invariantes de identidad.
   - Detectar instrucciones creativas incompatibles.
   - Preparar el contrato para PromptCompiler.
   ============================================================ */

const PromptBuilder = (() => {

    /* ========================================================
       CONFIGURACIÓN
       ======================================================== */

    const VERSION = "1.0.0";

    const CONTRACT_SCHEMA =
        "portraitos.portrait-contract";

    const CONTRACT_SCHEMA_VERSION =
        "1.0";

    const DEFAULT_LANGUAGE =
        "es";

    const DEFAULT_OUTPUT = Object.freeze({
        provider:
            "generic",

        level:
            "professional",

        language:
            DEFAULT_LANGUAGE,

        format:
            "text",

        includeNegativePrompt:
            true,

        includeReferenceInstructions:
            true,

        includeTechnicalSettings:
            true
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

    const IDENTITY_ALTERATION_PATTERNS = Object.freeze([
        {
            code:
                "ALTER_AGE",

            expression:
                /\b(rejuvenecer|más joven|menos edad|quitar años|cambiar edad|aparentar \d+ años)\b/i,

            message:
                "La dirección creativa intenta modificar la edad aparente."
        },

        {
            code:
                "REMOVE_WRINKLES",

            expression:
                /\b(sin arrugas|eliminar arrugas|borrar arrugas|piel sin líneas|piel completamente lisa)\b/i,

            message:
                "La dirección creativa intenta eliminar rasgos naturales asociados a la edad."
        },

        {
            code:
                "ALTER_SKIN",

            expression:
                /\b(piel perfecta|piel de porcelana|piel sin textura|suavizado extremo|beauty retouch extremo)\b/i,

            message:
                "La dirección creativa intenta sustituir la textura real de la piel."
        },

        {
            code:
                "ALTER_EYES",

            expression:
                /\b(agrandar ojos|cambiar ojos|ojos más grandes|modificar forma de ojos)\b/i,

            message:
                "La dirección creativa intenta modificar los ojos."
        },

        {
            code:
                "ALTER_NOSE",

            expression:
                /\b(afinar nariz|reducir nariz|cambiar nariz|nariz más pequeña)\b/i,

            message:
                "La dirección creativa intenta modificar la nariz."
        },

        {
            code:
                "ALTER_JAW",

            expression:
                /\b(afinar mandíbula|cambiar mandíbula|mandíbula más marcada|cambiar mentón)\b/i,

            message:
                "La dirección creativa intenta modificar la mandíbula o el mentón."
        },

        {
            code:
                "ALTER_HAIR",

            expression:
                /\b(eliminar canas|cambiar color de pelo|cambiar tipo de cabello|alisar el pelo|rizar el pelo)\b/i,

            message:
                "La dirección creativa intenta modificar características permanentes del cabello."
        },

        {
            code:
                "ALTER_FACE",

            expression:
                /\b(cambiar rostro|modificar facciones|embellecer rostro|rostro idealizado|cara diferente)\b/i,

            message:
                "La dirección creativa intenta modificar la estructura facial."
        },

        {
            code:
                "REMOVE_ASYMMETRY",

            expression:
                /\b(simetría perfecta|corregir asimetrías|eliminar asimetrías|rostro perfectamente simétrico)\b/i,

            message:
                "La dirección creativa intenta eliminar asimetrías naturales."
        }
    ]);

    const DEFAULT_NEGATIVE_CONSTRAINTS = Object.freeze([
        "no cambiar la identidad",
        "no cambiar la edad aparente",
        "no rejuvenecer",
        "no envejecer",
        "no eliminar arrugas",
        "no borrar la textura de la piel",
        "no modificar la estructura facial",
        "no alterar ojos",
        "no alterar nariz",
        "no alterar labios",
        "no alterar mandíbula",
        "no eliminar canas",
        "no modificar el patrón natural del cabello",
        "no eliminar asimetrías naturales",
        "no sustituir rasgos distintivos",
        "no crear un rostro genérico",
        "no idealizar las facciones",
        "no aplicar retoque beauty extremo",
        "no generar apariencia plástica",
        "no modificar etnia ni tono de piel"
    ]);

    /* ========================================================
       CONSTRUCCIÓN PRINCIPAL
       ======================================================== */

    function build(profile, options = {}) {
        const normalizedOptions =
            normalizeOptions(options);

        const sourceProfile =
            normalizeProfile(profile);

        const validation =
            validateInput(
                sourceProfile,
                normalizedOptions
            );

        if (
            validation.blockers.length
        ) {
            throw createBuildError(
                "PORTRAIT_CONTRACT_BLOCKED",
                "No es posible construir el Portrait Contract.",
                validation
            );
        }

        const identity =
            buildIdentitySection(
                sourceProfile.identity
            );

        const direction =
            buildCreativeDirectionSection(
                sourceProfile.direction
            );

        const references =
            buildReferenceSection(
                sourceProfile
            );

        const output =
            buildOutputSection(
                sourceProfile,
                normalizedOptions
            );

        const constraints =
            buildConstraintSection(
                identity,
                direction,
                normalizedOptions
            );

        const contract = {
            schema:
                CONTRACT_SCHEMA,

            schemaVersion:
                CONTRACT_SCHEMA_VERSION,

            builderVersion:
                VERSION,

            contractId:
                createId(),

            profileId:
                sourceProfile.id ||
                null,

            profileName:
                sourceProfile.name ||
                "Untitled Portrait",

            language:
                normalizedOptions.language,

            createdAt:
                new Date()
                    .toISOString(),

            sourceValidation: {
                score:
                    sourceProfile.validation
                        ?.score ??
                    null,

                status:
                    sourceProfile.validation
                        ?.status ||
                    null,

                validatedAt:
                    sourceProfile.validation
                        ?.validatedAt ||
                    null
            },

            subject: {
                identity,

                references
            },

            creativeDirection:
                direction,

            constraints,

            output,

            metadata: {
                identityLocked:
                    identity.locked,

                referenceCount:
                    references.items.length,

                primaryReferenceId:
                    references.primaryReferenceId,

                presetId:
                    direction.presetId,

                presetModified:
                    direction.presetModified,

                completeness: {
                    identity:
                        identity.completeness,

                    direction:
                        direction.completeness,

                    overall:
                        calculateContractCompleteness(
                            sourceProfile
                        )
                }
            }
        };

        contract.validation =
            validateContract(contract);

        contract.fingerprint =
            createFingerprint(contract);

        return deepFreeze(
            clone(contract)
        );
    }

    /* ========================================================
       IDENTIDAD PERMANENTE
       ======================================================== */

    function buildIdentitySection(identitySource) {
        const source =
            normalizeObject(
                identitySource
            );

        return compactObject({
            locked:
                source.locked === true ||
                source.status ===
                    "locked",

            status:
                normalizeText(
                    source.status
                ) ||
                "draft",

            completeness:
                normalizePercentage(
                    source.completeness
                ),

            age: compactObject({
                apparentRange:
                    firstValue(
                        source.age
                            ?.apparentRange,
                        source.apparentAge,
                        source.ageRange
                    ),

                instructions:
                    firstValue(
                        source.age
                            ?.instructions,
                        source.ageDescription
                    ),

                immutable:
                    true
            }),

            face: compactObject({
                shape:
                    firstValue(
                        source.face
                            ?.shape,
                        source.faceShape
                    ),

                proportions:
                    firstValue(
                        source.face
                            ?.proportions,
                        source.faceProportions
                    ),

                structure:
                    firstValue(
                        source.face
                            ?.structure,
                        source.facialStructure
                    ),

                asymmetries:
                    normalizeList(
                        firstValue(
                            source.face
                                ?.asymmetries,
                            source.asymmetries
                        )
                    ),

                distinctiveFeatures:
                    normalizeList(
                        firstValue(
                            source.face
                                ?.distinctiveFeatures,
                            source.distinctiveFeatures
                        )
                    )
            }),

            skin: compactObject({
                tone:
                    firstValue(
                        source.skin
                            ?.tone,
                        source.skinTone
                    ),

                undertone:
                    firstValue(
                        source.skin
                            ?.undertone,
                        source.skinUndertone
                    ),

                texture:
                    firstValue(
                        source.skin
                            ?.texture,
                        source.skinTexture
                    ),

                marks:
                    normalizeList(
                        firstValue(
                            source.skin
                                ?.marks,
                            source.skinMarks
                        )
                    ),

                wrinkles:
                    firstValue(
                        source.skin
                            ?.wrinkles,
                        source.wrinkles
                    ),

                immutable:
                    true
            }),

            eyes: compactObject({
                color:
                    firstValue(
                        source.eyes
                            ?.color,
                        source.eyeColor
                    ),

                shape:
                    firstValue(
                        source.eyes
                            ?.shape,
                        source.eyeShape
                    ),

                size:
                    firstValue(
                        source.eyes
                            ?.size,
                        source.eyeSize
                    ),

                spacing:
                    firstValue(
                        source.eyes
                            ?.spacing,
                        source.eyeSpacing
                    ),

                asymmetry:
                    firstValue(
                        source.eyes
                            ?.asymmetry,
                        source.eyeAsymmetry
                    )
            }),

            eyebrows: compactObject({
                shape:
                    firstValue(
                        source.eyebrows
                            ?.shape,
                        source.eyebrowShape
                    ),

                density:
                    firstValue(
                        source.eyebrows
                            ?.density,
                        source.eyebrowDensity
                    ),

                color:
                    firstValue(
                        source.eyebrows
                            ?.color,
                        source.eyebrowColor
                    )
            }),

            nose: compactObject({
                shape:
                    firstValue(
                        source.nose
                            ?.shape,
                        source.noseShape
                    ),

                proportions:
                    firstValue(
                        source.nose
                            ?.proportions,
                        source.noseProportions
                    ),

                distinctiveDetails:
                    firstValue(
                        source.nose
                            ?.distinctiveDetails,
                        source.noseDetails
                    )
            }),

            mouth: compactObject({
                lips:
                    firstValue(
                        source.mouth
                            ?.lips,
                        source.lips
                    ),

                shape:
                    firstValue(
                        source.mouth
                            ?.shape,
                        source.mouthShape
                    ),

                smile:
                    firstValue(
                        source.mouth
                            ?.smile,
                        source.smile
                    )
            }),

            jaw: compactObject({
                shape:
                    firstValue(
                        source.jaw
                            ?.shape,
                        source.jawShape
                    ),

                chin:
                    firstValue(
                        source.jaw
                            ?.chin,
                        source.chin
                    )
            }),

            hair: compactObject({
                color:
                    firstValue(
                        source.hair
                            ?.color,
                        source.hairColor
                    ),

                grayHair:
                    firstValue(
                        source.hair
                            ?.grayHair,
                        source.grayHair
                    ),

                texture:
                    firstValue(
                        source.hair
                            ?.texture,
                        source.hairTexture
                    ),

                pattern:
                    firstValue(
                        source.hair
                            ?.pattern,
                        source.hairPattern
                    ),

                density:
                    firstValue(
                        source.hair
                            ?.density,
                        source.hairDensity
                    ),

                volume:
                    firstValue(
                        source.hair
                            ?.volume,
                        source.hairVolume
                    ),

                hairline:
                    firstValue(
                        source.hair
                            ?.hairline,
                        source.hairline
                    ),

                immutableCharacteristics:
                    true
            }),

            facialHair: compactObject({
                type:
                    firstValue(
                        source.facialHair
                            ?.type,
                        source.beardType
                    ),

                color:
                    firstValue(
                        source.facialHair
                            ?.color,
                        source.beardColor
                    ),

                density:
                    firstValue(
                        source.facialHair
                            ?.density,
                        source.beardDensity
                    ),

                pattern:
                    firstValue(
                        source.facialHair
                            ?.pattern,
                        source.beardPattern
                    )
            }),

            ears:
                firstValue(
                    source.ears
                        ?.description,
                    source.ears
                ),

            neck:
                firstValue(
                    source.neck
                        ?.description,
                    source.neck
                ),

            body: compactObject({
                build:
                    firstValue(
                        source.body
                            ?.build,
                        source.bodyBuild
                    ),

                height:
                    firstValue(
                        source.body
                            ?.height,
                        source.height
                    ),

                proportions:
                    firstValue(
                        source.body
                            ?.proportions,
                        source.bodyProportions
                    )
            }),

            immutableInstructions:
                buildImmutableIdentityInstructions(
                    source
                ),

            sourceNotes:
                firstValue(
                    source.notes,
                    source.identityNotes
                )
        });
    }

    function buildImmutableIdentityInstructions(
        identity
    ) {
        const instructions = [
            "Mantener exactamente la misma identidad de la persona representada.",
            "Preservar la edad aparente y todos los signos naturales asociados a ella.",
            "Preservar la estructura facial, proporciones y asimetrías reales.",
            "Preservar ojos, nariz, labios, mandíbula y mentón.",
            "Mantener el tono, textura y marcas naturales de la piel.",
            "Mantener el color, textura, patrón, densidad y volumen natural del cabello.",
            "Mantener las canas cuando estén presentes.",
            "Mantener barba o vello facial con su patrón natural cuando corresponda.",
            "No sustituir el rostro por una versión idealizada o genérica."
        ];

        normalizeList(
            identity.immutableInstructions
        ).forEach(
            instruction => {
                if (
                    !instructions.includes(
                        instruction
                    )
                ) {
                    instructions.push(
                        instruction
                    );
                }
            }
        );

        return instructions;
    }

    /* ========================================================
       DIRECCIÓN CREATIVA
       ======================================================== */

    function buildCreativeDirectionSection(
        directionSource
    ) {
        const source =
            normalizeObject(
                directionSource
            );

        return compactObject({
            status:
                normalizeText(
                    source.status
                ) ||
                "draft",

            completeness:
                normalizePercentage(
                    source.completeness
                ),

            presetId:
                normalizeNullableText(
                    source.presetId
                ),

            presetName:
                normalizeNullableText(
                    source.presetName
                ),

            presetModified:
                source.presetModified ===
                    true,

            intent: compactObject({
                objective:
                    firstValue(
                        source.intent
                            ?.objective,
                        source.objective,
                        source.purpose
                    ),

                useCase:
                    firstValue(
                        source.intent
                            ?.useCase,
                        source.useCase
                    ),

                platform:
                    firstValue(
                        source.intent
                            ?.platform,
                        source.platform
                    ),

                audience:
                    firstValue(
                        source.intent
                            ?.audience,
                        source.audience
                    ),

                message:
                    firstValue(
                        source.intent
                            ?.message,
                        source.message
                    )
            }),

            lighting: compactObject({
                type:
                    firstValue(
                        source.lighting
                            ?.type,
                        source.lightingType
                    ),

                direction:
                    firstValue(
                        source.lighting
                            ?.direction,
                        source.lightDirection
                    ),

                quality:
                    firstValue(
                        source.lighting
                            ?.quality,
                        source.lightQuality
                    ),

                contrast:
                    firstValue(
                        source.lighting
                            ?.contrast,
                        source.contrast
                    ),

                colorTemperature:
                    firstValue(
                        source.lighting
                            ?.colorTemperature,
                        source.colorTemperature
                    ),

                notes:
                    firstValue(
                        source.lighting
                            ?.notes,
                        source.lightingNotes
                    )
            }),

            camera: compactObject({
                shotType:
                    firstValue(
                        source.camera
                            ?.shotType,
                        source.shotType
                    ),

                angle:
                    firstValue(
                        source.camera
                            ?.angle,
                        source.cameraAngle
                    ),

                lens:
                    firstValue(
                        source.camera
                            ?.lens,
                        source.lens
                    ),

                focalLength:
                    firstValue(
                        source.camera
                            ?.focalLength,
                        source.focalLength
                    ),

                aperture:
                    firstValue(
                        source.camera
                            ?.aperture,
                        source.aperture
                    ),

                depthOfField:
                    firstValue(
                        source.camera
                            ?.depthOfField,
                        source.depthOfField
                    ),

                distance:
                    firstValue(
                        source.camera
                            ?.distance,
                        source.cameraDistance
                    )
            }),

            composition: compactObject({
                format:
                    firstValue(
                        source.composition
                            ?.format,
                        source.format
                    ),

                aspectRatio:
                    firstValue(
                        source.composition
                            ?.aspectRatio,
                        source.aspectRatio
                    ),

                framing:
                    firstValue(
                        source.composition
                            ?.framing,
                        source.framing
                    ),

                subjectPlacement:
                    firstValue(
                        source.composition
                            ?.subjectPlacement,
                        source.subjectPlacement
                    ),

                negativeSpace:
                    firstValue(
                        source.composition
                            ?.negativeSpace,
                        source.negativeSpace
                    ),

                crop:
                    firstValue(
                        source.composition
                            ?.crop,
                        source.crop
                    ),

                notes:
                    firstValue(
                        source.composition
                            ?.notes,
                        source.compositionNotes
                    )
            }),

            background: compactObject({
                type:
                    firstValue(
                        source.background
                            ?.type,
                        source.backgroundType
                    ),

                environment:
                    firstValue(
                        source.background
                            ?.environment,
                        source.environment
                    ),

                description:
                    firstValue(
                        source.background
                            ?.description,
                        source.backgroundDescription
                    ),

                depth:
                    firstValue(
                        source.background
                            ?.depth,
                        source.backgroundDepth
                    ),

                blur:
                    firstValue(
                        source.background
                            ?.blur,
                        source.backgroundBlur
                    ),

                elements:
                    normalizeList(
                        firstValue(
                            source.background
                                ?.elements,
                            source.backgroundElements
                        )
                    )
            }),

            wardrobe: compactObject({
                style:
                    firstValue(
                        source.wardrobe
                            ?.style,
                        source.wardrobeStyle
                    ),

                garments:
                    normalizeList(
                        firstValue(
                            source.wardrobe
                                ?.garments,
                            source.garments
                        )
                    ),

                colors:
                    normalizeList(
                        firstValue(
                            source.wardrobe
                                ?.colors,
                            source.wardrobeColors
                        )
                    ),

                materials:
                    normalizeList(
                        firstValue(
                            source.wardrobe
                                ?.materials,
                            source.wardrobeMaterials
                        )
                    ),

                description:
                    firstValue(
                        source.wardrobe
                            ?.description,
                        source.wardrobeDescription
                    ),

                accessories:
                    normalizeList(
                        firstValue(
                            source.wardrobe
                                ?.accessories,
                            source.accessories
                        )
                    )
            }),

            pose: compactObject({
                position:
                    firstValue(
                        source.pose
                            ?.position,
                        source.posePosition
                    ),

                bodyOrientation:
                    firstValue(
                        source.pose
                            ?.bodyOrientation,
                        source.bodyOrientation
                    ),

                headOrientation:
                    firstValue(
                        source.pose
                            ?.headOrientation,
                        source.headOrientation
                    ),

                gaze:
                    firstValue(
                        source.pose
                            ?.gaze,
                        source.gaze
                    ),

                hands:
                    firstValue(
                        source.pose
                            ?.hands,
                        source.handPosition
                    ),

                expression:
                    firstValue(
                        source.pose
                            ?.expression,
                        source.expression
                    ),

                notes:
                    firstValue(
                        source.pose
                            ?.notes,
                        source.poseNotes
                    )
            }),

            treatment: compactObject({
                mood:
                    firstValue(
                        source.treatment
                            ?.mood,
                        source.mood
                    ),

                realism:
                    firstValue(
                        source.treatment
                            ?.realism,
                        source.realism
                    ),

                colorGrade:
                    firstValue(
                        source.treatment
                            ?.colorGrade,
                        source.colorGrade
                    ),

                contrast:
                    firstValue(
                        source.treatment
                            ?.contrast,
                        source.treatmentContrast
                    ),

                texture:
                    firstValue(
                        source.treatment
                            ?.texture,
                        source.imageTexture
                    ),

                grain:
                    firstValue(
                        source.treatment
                            ?.grain,
                        source.grain
                    ),

                retouch:
                    firstValue(
                        source.treatment
                            ?.retouch,
                        source.retouch
                    ),

                notes:
                    firstValue(
                        source.treatment
                            ?.notes,
                        source.treatmentNotes
                    )
            }),

            additionalInstructions:
                normalizeList(
                    firstValue(
                        source.additionalInstructions,
                        source.instructions
                    )
                )
        });
    }

    /* ========================================================
       REFERENCIAS FOTOGRÁFICAS
       ======================================================== */

    function buildReferenceSection(profile) {
        const photos =
            normalizePhotos(
                profile.photos
            );

        const primary =
            photos.find(
                photo =>
                    photo.primary ===
                        true ||
                    profile.primaryPhotoId ===
                        photo.id
            ) ||
            photos[0] ||
            null;

        return {
            strategy:
                photos.length > 1
                    ? "multi-reference"
                    : "single-reference",

            primaryReferenceId:
                primary?.id ||
                null,

            instructions: [
                "Usar las fotografías exclusivamente como referencias de identidad.",
                "Priorizar la fotografía principal para la estructura facial global.",
                "Usar el resto de fotografías para confirmar rasgos, asimetrías, cabello y proporciones.",
                "No copiar iluminación, vestuario, fondo o encuadre de las referencias salvo que la dirección creativa lo solicite expresamente.",
                "Resolver discrepancias entre fotografías preservando la identidad más consistente."
            ],

            items:
                photos.map(
                    photo =>
                        compactObject({
                            id:
                                photo.id,

                            name:
                                photo.name,

                            primary:
                                photo.id ===
                                primary?.id,

                            role:
                                photo.role ||
                                inferPhotoRole(
                                    photo
                                ),

                            angle:
                                photo.angle,

                            quality:
                                photo.quality,

                            width:
                                photo.width,

                            height:
                                photo.height,

                            mimeType:
                                photo.mimeType,

                            notes:
                                photo.notes,

                            identityUse:
                                photo.identityUse !==
                                false
                        })
                )
        };
    }

    /* ========================================================
       RESTRICCIONES
       ======================================================== */

    function buildConstraintSection(
        identity,
        direction,
        options
    ) {
        const mandatory =
            uniqueStrings([
                ...identity
                    .immutableInstructions,

                "La identidad permanente prevalece sobre cualquier instrucción creativa.",

                "La dirección creativa puede cambiar vestuario, pose, iluminación, composición, cámara y fondo.",

                "La dirección creativa no puede cambiar edad, facciones, textura de piel, cabello natural, canas ni asimetrías.",

                "Cuando exista conflicto, ignorar la instrucción creativa incompatible y preservar la identidad."
            ]);

        const negative =
            uniqueStrings([
                ...DEFAULT_NEGATIVE_CONSTRAINTS,

                ...normalizeList(
                    direction
                        .negativePrompt
                )
            ]);

        return {
            priorityOrder: [
                "identity",
                "referenceConsistency",
                "creativeDirection",
                "technicalOutput"
            ],

            mandatory,

            negative:
                options
                    .includeNegativePrompt
                    ? negative
                    : [],

            conflictPolicy:
                "identity-wins",

            allowChanges: [
                "wardrobe",
                "pose",
                "expression",
                "lighting",
                "camera",
                "lens",
                "composition",
                "background",
                "environment",
                "color grading",
                "image format"
            ],

            prohibitedChanges: [
                "identity",
                "age",
                "facial structure",
                "eyes",
                "nose",
                "lips",
                "jaw",
                "chin",
                "skin tone",
                "skin texture",
                "wrinkles",
                "gray hair",
                "natural hair pattern",
                "facial asymmetries",
                "distinctive marks"
            ]
        };
    }

    /* ========================================================
       SALIDA
       ======================================================== */

    function buildOutputSection(
        profile,
        options
    ) {
        return compactObject({
            provider:
                options.provider,

            level:
                options.level,

            language:
                options.language,

            format:
                options.format,

            aspectRatio:
                firstValue(
                    options.aspectRatio,
                    profile.direction
                        ?.composition
                        ?.aspectRatio,
                    profile.direction
                        ?.composition
                        ?.format
                ),

            dimensions:
                normalizeDimensions(
                    firstValue(
                        options.dimensions,
                        profile.direction
                            ?.composition
                            ?.dimensions
                    )
                ),

            imageCount:
                normalizePositiveInteger(
                    options.imageCount,
                    1
                ),

            includeNegativePrompt:
                options
                    .includeNegativePrompt,

            includeReferenceInstructions:
                options
                    .includeReferenceInstructions,

            includeTechnicalSettings:
                options
                    .includeTechnicalSettings,

            seed:
                normalizeNullableText(
                    options.seed
                ),

            customParameters:
                normalizeObject(
                    options.customParameters
                )
        });
    }

    /* ========================================================
       VALIDACIONES
       ======================================================== */

    function validateInput(
        profile,
        options
    ) {
        const blockers = [];
        const errors = [];
        const warnings = [];

        if (!profile) {
            blockers.push(
                createIssue(
                    "PROFILE_REQUIRED",
                    "No se ha proporcionado un perfil."
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
            !profile.identity ||
            !Object.keys(
                profile.identity
            ).length
        ) {
            blockers.push(
                createIssue(
                    "IDENTITY_REQUIRED",
                    "El perfil no contiene una identidad permanente."
                )
            );
        }

        if (
            !profile.direction ||
            !Object.keys(
                profile.direction
            ).length
        ) {
            blockers.push(
                createIssue(
                    "DIRECTION_REQUIRED",
                    "El perfil no contiene una dirección creativa."
                )
            );
        }

        if (
            !normalizePhotos(
                profile.photos
            ).length
        ) {
            blockers.push(
                createIssue(
                    "REFERENCE_REQUIRED",
                    "El perfil no contiene fotografías de referencia."
                )
            );
        }

        if (
            options.requireValidatedProfile &&
            profile.validation
                ?.canGeneratePrompt !==
                true
        ) {
            blockers.push(
                createIssue(
                    "PROFILE_NOT_VALIDATED",
                    "El perfil no está validado para generar prompts."
                )
            );
        }

        const creativeText =
            JSON.stringify(
                profile.direction ||
                {}
            );

        IDENTITY_ALTERATION_PATTERNS
            .forEach(
                rule => {
                    if (
                        rule.expression
                            .test(
                                creativeText
                            )
                    ) {
                        blockers.push(
                            createIssue(
                                rule.code,
                                rule.message
                            )
                        );
                    }
                }
            );

        if (
            profile.identity
                ?.locked !== true &&
            profile.identity
                ?.status !==
                "locked"
        ) {
            warnings.push(
                createIssue(
                    "IDENTITY_NOT_LOCKED",
                    "La identidad permanente no está bloqueada."
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

    function validateContract(contract) {
        const blockers = [];
        const errors = [];
        const warnings = [];

        if (
            !contract.subject
                ?.identity
        ) {
            blockers.push(
                createIssue(
                    "CONTRACT_IDENTITY_MISSING",
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
                    "CONTRACT_DIRECTION_MISSING",
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
                    "CONTRACT_REFERENCES_MISSING",
                    "El contrato no contiene referencias visuales."
                )
            );
        }

        if (
            contract.subject
                ?.identity
                ?.locked !==
                true
        ) {
            warnings.push(
                createIssue(
                    "CONTRACT_IDENTITY_UNLOCKED",
                    "El contrato se ha construido con una identidad no bloqueada."
                )
            );
        }

        if (
            contract.metadata
                ?.identityLocked ===
                true &&
            contract.metadata
                ?.completeness
                ?.identity < 60
        ) {
            errors.push(
                createIssue(
                    "LOCKED_IDENTITY_INCOMPLETE",
                    "La identidad está bloqueada, pero su completitud es insuficiente."
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

    function normalizeOptions(options) {
        const source = {
            ...DEFAULT_OUTPUT,
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
                DEFAULT_LANGUAGE,

            format:
                normalizeText(
                    source.format
                ) ||
                "text",

            aspectRatio:
                normalizeNullableText(
                    source.aspectRatio
                ),

            dimensions:
                source.dimensions,

            imageCount:
                source.imageCount,

            seed:
                source.seed,

            includeNegativePrompt:
                source
                    .includeNegativePrompt !==
                false,

            includeReferenceInstructions:
                source
                    .includeReferenceInstructions !==
                false,

            includeTechnicalSettings:
                source
                    .includeTechnicalSettings !==
                false,

            requireValidatedProfile:
                source
                    .requireValidatedProfile ===
                true,

            customParameters:
                normalizeObject(
                    source.customParameters
                )
        };
    }

    function normalizeProfile(profile) {
        if (
            !profile ||
            typeof profile !==
                "object" ||
            Array.isArray(profile)
        ) {
            return null;
        }

        const source =
            clone(profile);

        return {
            ...source,

            id:
                normalizeNullableText(
                    firstValue(
                        source.id,
                        source.profileId
                    )
                ),

            name:
                firstValue(
                    source.name,
                    source.general
                        ?.name,
                    source.profile
                        ?.name
                ),

            identity:
                normalizeObject(
                    source.identity
                ),

            direction:
                normalizeObject(
                    firstValue(
                        source.direction,
                        source.creativeDirection
                    )
                ),

            photos:
                normalizePhotos(
                    firstValue(
                        source.photos,
                        source.references
                    )
                ),

            validation:
                normalizeObject(
                    source.validation
                )
        };
    }

    function normalizePhotos(photos) {
        if (!Array.isArray(photos)) {
            return [];
        }

        return photos
            .filter(
                item =>
                    item &&
                    typeof item ===
                        "object"
            )
            .map(
                (photo, index) =>
                    compactObject({
                        id:
                            normalizeText(
                                photo.id
                            ) ||
                            `reference-${index + 1}`,

                        name:
                            firstValue(
                                photo.name,
                                photo.filename,
                                `Reference ${index + 1}`
                            ),

                        primary:
                            photo.primary ===
                                true,

                        role:
                            normalizeNullableText(
                                photo.role
                            ),

                        angle:
                            firstValue(
                                photo.angle,
                                photo.metadata
                                    ?.angle
                            ),

                        quality:
                            firstValue(
                                photo.quality,
                                photo.validation
                                    ?.quality
                            ),

                        width:
                            firstValue(
                                photo.width,
                                photo.metadata
                                    ?.width
                            ),

                        height:
                            firstValue(
                                photo.height,
                                photo.metadata
                                    ?.height
                            ),

                        mimeType:
                            firstValue(
                                photo.mimeType,
                                photo.type
                            ),

                        notes:
                            firstValue(
                                photo.notes,
                                photo.description
                            ),

                        identityUse:
                            photo.identityUse !==
                                false
                    })
            );
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

    function normalizeDimensions(value) {
        if (!value) {
            return null;
        }

        if (
            typeof value ===
                "string"
        ) {
            const match =
                value.match(
                    /^(\d+)\s*[x×]\s*(\d+)$/i
                );

            if (!match) {
                return value;
            }

            return {
                width:
                    Number(match[1]),

                height:
                    Number(match[2])
            };
        }

        if (
            typeof value ===
                "object"
        ) {
            const width =
                Number(value.width);

            const height =
                Number(value.height);

            if (
                Number.isFinite(width) &&
                Number.isFinite(height)
            ) {
                return {
                    width,
                    height
                };
            }
        }

        return null;
    }

    /* ========================================================
       MÉTRICAS
       ======================================================== */

    function calculateContractCompleteness(
        profile
    ) {
        const identity =
            normalizePercentage(
                profile.identity
                    ?.completeness
            );

        const direction =
            normalizePercentage(
                profile.direction
                    ?.completeness
            );

        const references =
            normalizePhotos(
                profile.photos
            ).length;

        const referenceScore =
            references >= 3
                ? 100
                : references === 2
                    ? 80
                    : references === 1
                        ? 50
                        : 0;

        return Math.round(
            identity * 0.45 +
            direction * 0.35 +
            referenceScore * 0.20
        );
    }

    /* ========================================================
       UTILIDADES
       ======================================================== */

    function inferPhotoRole(photo) {
        const source =
            [
                photo.name,
                photo.notes,
                photo.angle
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

        if (
            source.includes(
                "perfil"
            ) ||
            source.includes(
                "lateral"
            )
        ) {
            return "profile";
        }

        if (
            source.includes(
                "tres cuartos"
            ) ||
            source.includes(
                "3/4"
            )
        ) {
            return "three-quarter";
        }

        if (
            source.includes(
                "frontal"
            ) ||
            source.includes(
                "front"
            )
        ) {
            return "front";
        }

        return "identity-reference";
    }

    function compactObject(object) {
        return Object.fromEntries(
            Object.entries(
                object
            ).filter(
                ([, value]) =>
                    !isEmptyValue(
                        value
                    )
            )
        );
    }

    function isEmptyValue(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return true;
        }

        if (
            typeof value ===
                "string"
        ) {
            return value.trim() ===
                "";
        }

        if (
            Array.isArray(value)
        ) {
            return value.length ===
                0;
        }

        if (
            typeof value ===
                "object"
        ) {
            return Object.keys(value)
                .length === 0;
        }

        return false;
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

    function normalizeList(value) {
        if (Array.isArray(value)) {
            return value
                .map(
                    item =>
                        normalizeText(
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
                    item =>
                        item.trim()
                )
                .filter(Boolean);
        }

        return [];
    }

    function normalizePercentage(value) {
        const number =
            Number(value);

        if (!Number.isFinite(number)) {
            return 0;
        }

        return Math.min(
            100,
            Math.max(
                0,
                Math.round(number)
            )
        );
    }

    function normalizePositiveInteger(
        value,
        fallback
    ) {
        const number =
            Number.parseInt(
                value,
                10
            );

        return Number.isFinite(number) &&
            number > 0
            ? number
            : fallback;
    }

    function firstValue(...values) {
        return values.find(
            value =>
                !isEmptyValue(
                    value
                )
        );
    }

    function normalizeText(value) {
        return String(
            value ?? ""
        ).trim();
    }

    function normalizeNullableText(
        value
    ) {
        const normalized =
            normalizeText(value);

        return normalized ||
            null;
    }

    function uniqueStrings(values) {
        return [
            ...new Set(
                values
                    .map(
                        normalizeText
                    )
                    .filter(Boolean)
            )
        ];
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

    function createBuildError(
        code,
        message,
        validation
    ) {
        const error =
            new Error(message);

        error.name =
            "PromptBuilderError";

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
            return crypto
                .randomUUID();
        }

        return (
            "portrait-contract-" +
            Date.now()
                .toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    }

    function createFingerprint(
        contract
    ) {
        const source =
            JSON.stringify({
                identity:
                    contract.subject
                        ?.identity,

                references:
                    contract.subject
                        ?.references
                        ?.items
                        ?.map(
                            item =>
                                item.id
                        ),

                direction:
                    contract
                        .creativeDirection,

                output:
                    contract.output
            });

        let hash = 2166136261;

        for (
            let index = 0;
            index < source.length;
            index += 1
        ) {
            hash ^=
                source.charCodeAt(
                    index
                );

            hash = Math.imul(
                hash,
                16777619
            );
        }

        return (
            "pc-" +
            (
                hash >>> 0
            ).toString(16)
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

        LEVELS,
        PROVIDERS,

        build,
        validateInput,
        validateContract,

        buildIdentitySection,
        buildCreativeDirectionSection,
        buildReferenceSection,
        buildConstraintSection,
        buildOutputSection,

        calculateContractCompleteness
    });

})();

window.PromptBuilder =
    PromptBuilder;
