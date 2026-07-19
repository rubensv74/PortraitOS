"use strict";

/* ============================================================
   PortraitOS
   Validation Binding
   ------------------------------------------------------------
   Responsabilidad:
   - Orquestar la validación global del perfil.
   - Consolidar resultados de todos los bindings y engines.
   - Clasificar incidencias por severidad.
   - Calcular Portrait Readiness.
   - Determinar si puede generarse un prompt.
   - Renderizar el dashboard de validación.
   - Mantener sincronizado el estado global de calidad.
   ============================================================ */

const ValidationBinding = (() => {

    /* ========================================================
       CONFIGURACIÓN
       ======================================================== */

    const SELECTORS = Object.freeze({
        PANEL:
            "[data-step-panel='validation']",

        RESULTS:
            "[data-validation-results]",

        SCORE:
            "[data-validation-score]",

        SCORE_BAR:
            "[data-validation-score-bar]",

        STATUS:
            "[data-validation-status]",

        SUMMARY:
            "[data-validation-summary]",

        SECTIONS:
            "[data-validation-sections]",

        ISSUES:
            "[data-validation-issues]",

        RECOMMENDATIONS:
            "[data-validation-recommendations]",

        ACTION:
            "[data-action='validate-profile']",

        REFRESH_ACTION:
            "[data-action='validation-refresh']",

        NAVIGATE_ACTION:
            "[data-validation-navigate]",

        GENERATE_ACTION:
            "[data-action='generate-prompt']"
    });

    const CLASSES = Object.freeze({
        READY:
            "is-ready",

        WARNING:
            "is-warning",

        ERROR:
            "is-error",

        BLOCKED:
            "is-blocked",

        VALIDATING:
            "is-validating",

        COMPLETE:
            "is-complete"
    });

    const SEVERITY = Object.freeze({
        INFO:
            "info",

        WARNING:
            "warning",

        ERROR:
            "error",

        BLOCKER:
            "blocker"
    });

    const SEVERITY_ORDER = Object.freeze({
        blocker: 4,
        error: 3,
        warning: 2,
        info: 1
    });

    const SECTION_WEIGHTS = Object.freeze({
        profile:
            10,

        photos:
            20,

        identity:
            30,

        direction:
            25,

        contract:
            15
    });

    const MINIMUM_PHOTOS = 1;
    const RECOMMENDED_PHOTOS = 3;

    let initialized = false;
    let validating = false;

    let root = document;
    let panel = null;
    let resultsElement = null;
    let scoreElement = null;
    let scoreBarElement = null;
    let statusElement = null;
    let summaryElement = null;
    let sectionsElement = null;
    let issuesElement = null;
    let recommendationsElement = null;

    let subscriptions = [];

    let state = createInitialState();

    /* ========================================================
       INICIALIZACIÓN
       ======================================================== */

    function init(options = {}) {
        if (initialized) {
            return getState();
        }

        validateDependencies();

        root =
            options.root ||
            document;

        cacheElements();
        bindDomEvents();
        bindApplicationEvents();

        renderDashboard();

        initialized = true;

        emit(
            "binding:validation-ready",
            getState()
        );

        return getState();
    }

    function destroy() {
        root
            .querySelector(
                SELECTORS.ACTION
            )
            ?.removeEventListener(
                "click",
                handleValidate
            );

        root
            .querySelector(
                SELECTORS.REFRESH_ACTION
            )
            ?.removeEventListener(
                "click",
                handleValidate
            );

        root.removeEventListener(
            "click",
            handleNavigationClick
        );

        subscriptions.forEach(
            unsubscribe => {
                if (
                    typeof unsubscribe ===
                    "function"
                ) {
                    unsubscribe();
                }
            }
        );

        subscriptions = [];

        panel = null;
        resultsElement = null;
        scoreElement = null;
        scoreBarElement = null;
        statusElement = null;
        summaryElement = null;
        sectionsElement = null;
        issuesElement = null;
        recommendationsElement = null;

        initialized = false;
        validating = false;
        state = createInitialState();

        return true;
    }

    function cacheElements() {
        panel =
            root.querySelector(
                SELECTORS.PANEL
            );

        resultsElement =
            root.querySelector(
                SELECTORS.RESULTS
            );

        scoreElement =
            root.querySelector(
                SELECTORS.SCORE
            );

        scoreBarElement =
            root.querySelector(
                SELECTORS.SCORE_BAR
            );

        statusElement =
            root.querySelector(
                SELECTORS.STATUS
            );

        summaryElement =
            root.querySelector(
                SELECTORS.SUMMARY
            );

        sectionsElement =
            root.querySelector(
                SELECTORS.SECTIONS
            );

        issuesElement =
            root.querySelector(
                SELECTORS.ISSUES
            );

        recommendationsElement =
            root.querySelector(
                SELECTORS.RECOMMENDATIONS
            );
    }

    /* ========================================================
       EVENTOS DOM
       ======================================================== */

    function bindDomEvents() {
        root
            .querySelector(
                SELECTORS.ACTION
            )
            ?.addEventListener(
                "click",
                handleValidate
            );

        root
            .querySelector(
                SELECTORS.REFRESH_ACTION
            )
            ?.addEventListener(
                "click",
                handleValidate
            );

        root.addEventListener(
            "click",
            handleNavigationClick
        );
    }

    async function handleValidate() {
        await validate();
    }

    function handleNavigationClick(event) {
        const target =
            event.target.closest(
                SELECTORS.NAVIGATE_ACTION
            );

        if (!target) {
            return;
        }

        const destination =
            normalizeText(
                target.dataset
                    .validationNavigate
            );

        if (!destination) {
            return;
        }

        navigateToSection(
            destination
        );
    }

    /* ========================================================
       VALIDACIÓN GLOBAL
       ======================================================== */

    async function validate(options = {}) {
        if (validating) {
            return getState();
        }

        validating = true;

        setValidating(true);

        try {
            const profileResult =
                await validateProfile();

            const photosResult =
                await validatePhotos();

            const identityResult =
                await validateIdentity();

            const directionResult =
                await validateDirection();

            const contractResult =
                await validateContract({
                    profile:
                        profileResult,

                    photos:
                        photosResult,

                    identity:
                        identityResult,

                    direction:
                        directionResult
                });

            const sections = {
                profile:
                    profileResult,

                photos:
                    photosResult,

                identity:
                    identityResult,

                direction:
                    directionResult,

                contract:
                    contractResult
            };

            const issues =
                consolidateIssues(
                    sections
                );

            const score =
                calculateScore(
                    sections,
                    issues
                );

            const canGenerate =
                determineCanGenerate(
                    issues,
                    sections
                );

            state = {
                validated:
                    true,

                validating:
                    false,

                score,

                status:
                    determineStatus(
                        score,
                        issues,
                        canGenerate
                    ),

                canGeneratePrompt:
                    canGenerate,

                sections:
                    clone(sections),

                issues:
                    clone(issues),

                counts:
                    countIssues(
                        issues
                    ),

                validatedAt:
                    new Date()
                        .toISOString()
            };

            persistValidationState(
                state
            );

            renderDashboard();

            updateGenerateAction();

            emit(
                "validation:completed",
                getState()
            );

            if (
                options.notify !==
                    false
            ) {
                notifyValidationResult();
            }

            return getState();
        } catch (error) {
            state = {
                ...state,

                validating:
                    false,

                validated:
                    false,

                status:
                    "error",

                canGeneratePrompt:
                    false,

                issues: [
                    createIssue({
                        code:
                            "GLOBAL_VALIDATION_FAILED",

                        section:
                            "contract",

                        severity:
                            SEVERITY.BLOCKER,

                        message:
                            "No se pudo completar la validación global.",

                        detail:
                            error.message
                    })
                ]
            };

            renderDashboard();
            updateGenerateAction();

            emitError(
                error,
                {
                    action:
                        "global-validation"
                }
            );

            notify(
                "No se pudo completar la validación global.",
                "error"
            );

            return getState();
        } finally {
            validating = false;
            setValidating(false);
        }
    }

    /* ========================================================
       VALIDACIÓN DEL PERFIL
       ======================================================== */

    async function validateProfile() {
        const issues = [];
        const profile =
            getActiveProfile();

        if (!profile) {
            issues.push(
                createIssue({
                    code:
                        "PROFILE_NOT_AVAILABLE",

                    section:
                        "profile",

                    severity:
                        SEVERITY.BLOCKER,

                    message:
                        "No existe un perfil activo.",

                    action:
                        "profile"
                })
            );

            return createSectionResult(
                "profile",
                issues,
                0
            );
        }

        const name =
            normalizeText(
                profile.name ||
                profile.general?.name ||
                profile.profile?.name
            );

        if (!name) {
            issues.push(
                createIssue({
                    code:
                        "PROFILE_NAME_MISSING",

                    section:
                        "profile",

                    severity:
                        SEVERITY.ERROR,

                    message:
                        "El perfil no tiene nombre.",

                    recommendation:
                        "Asigna un nombre reconocible al perfil.",

                    action:
                        "profile"
                })
            );
        }

        if (
            window.ProfileBinding &&
            typeof ProfileBinding
                .validateAll ===
                "function"
        ) {
            try {
                const result =
                    await ProfileBinding
                        .validateAll();

                issues.push(
                    ...mapExternalIssues(
                        result,
                        "profile"
                    )
                );
            } catch (error) {
                issues.push(
                    createIssue({
                        code:
                            "PROFILE_BINDING_VALIDATION_FAILED",

                        section:
                            "profile",

                        severity:
                            SEVERITY.WARNING,

                        message:
                            "No se pudo ejecutar la validación detallada del perfil.",

                        detail:
                            error.message
                    })
                );
            }
        }

        const completeness =
            getNumericValue(
                profile.completeness,
                estimateProfileCompleteness(
                    profile
                )
            );

        return createSectionResult(
            "profile",
            issues,
            completeness
        );
    }

    /* ========================================================
       VALIDACIÓN DE FOTOGRAFÍAS
       ======================================================== */

    async function validatePhotos() {
        const issues = [];

        const profile =
            getActiveProfile();

        const photos =
            getPhotos(profile);

        const primary =
            photos.find(
                photo =>
                    photo.primary === true ||
                    profile
                        ?.primaryPhotoId ===
                        photo.id
            );

        if (!photos.length) {
            issues.push(
                createIssue({
                    code:
                        "PHOTOS_MISSING",

                    section:
                        "photos",

                    severity:
                        SEVERITY.BLOCKER,

                    message:
                        "El perfil no contiene fotografías de referencia.",

                    recommendation:
                        "Añade al menos una fotografía frontal clara.",

                    action:
                        "photos"
                })
            );
        } else if (
            photos.length <
            RECOMMENDED_PHOTOS
        ) {
            issues.push(
                createIssue({
                    code:
                        "PHOTOS_INSUFFICIENT",

                    section:
                        "photos",

                    severity:
                        SEVERITY.WARNING,

                    message:
                        `El perfil contiene ${photos.length} fotografía${photos.length === 1 ? "" : "s"} de referencia.`,

                    recommendation:
                        "Se recomiendan al menos tres fotografías: frontal, tres cuartos y lateral.",

                    action:
                        "photos"
                })
            );
        }

        if (
            photos.length > 0 &&
            !primary
        ) {
            issues.push(
                createIssue({
                    code:
                        "PRIMARY_PHOTO_MISSING",

                    section:
                        "photos",

                    severity:
                        SEVERITY.ERROR,

                    message:
                        "No se ha definido una fotografía principal.",

                    recommendation:
                        "Selecciona la imagen más representativa como fotografía principal.",

                    action:
                        "photos"
                })
            );
        }

        photos.forEach(
            photo => {
                if (
                    !photo.dataUrl &&
                    !photo.thumbnail &&
                    !photo.source
                ) {
                    issues.push(
                        createIssue({
                            code:
                                "PHOTO_SOURCE_MISSING",

                            section:
                                "photos",

                            severity:
                                SEVERITY.ERROR,

                            message:
                                `La fotografía «${photo.name || photo.filename || photo.id}» no contiene una fuente válida.`,

                            action:
                                "photos"
                        })
                    );
                }
            }
        );

        const completeness =
            calculatePhotosCompleteness(
                photos,
                primary
            );

        return createSectionResult(
            "photos",
            issues,
            completeness,
            {
                count:
                    photos.length,

                primaryPhotoId:
                    primary?.id ||
                    null
            }
        );
    }

    /* ========================================================
       VALIDACIÓN DE IDENTIDAD
       ======================================================== */

    async function validateIdentity() {
        const issues = [];
        const profile =
            getActiveProfile();

        const identity =
            profile?.identity ||
            {};

        let bindingResult = null;

        if (
            window.IdentityBinding &&
            typeof IdentityBinding
                .validateAll ===
                "function"
        ) {
            try {
                bindingResult =
                    await IdentityBinding
                        .validateAll();

                issues.push(
                    ...mapExternalIssues(
                        bindingResult,
                        "identity"
                    )
                );
            } catch (error) {
                issues.push(
                    createIssue({
                        code:
                            "IDENTITY_BINDING_VALIDATION_FAILED",

                        section:
                            "identity",

                        severity:
                            SEVERITY.ERROR,

                        message:
                            "No se pudo validar el contrato de identidad.",

                        detail:
                            error.message,

                        action:
                            "identity"
                    })
                );
            }
        }

        if (
            window.IdentityEngine &&
            typeof IdentityEngine
                .validate ===
                "function"
        ) {
            try {
                const engineResult =
                    await IdentityEngine
                        .validate(
                            identity
                        );

                issues.push(
                    ...mapExternalIssues(
                        engineResult,
                        "identity"
                    )
                );
            } catch (error) {
                issues.push(
                    createIssue({
                        code:
                            "IDENTITY_ENGINE_FAILED",

                        section:
                            "identity",

                        severity:
                            SEVERITY.WARNING,

                        message:
                            "No se pudo ejecutar la validación avanzada de identidad.",

                        detail:
                            error.message
                    })
                );
            }
        }

        const completeness =
            getNumericValue(
                bindingResult
                    ?.completeness,
                getNumericValue(
                    identity.completeness,
                    window.IdentityBinding &&
                    typeof IdentityBinding
                        .calculateCompleteness ===
                        "function"
                        ? IdentityBinding
                            .calculateCompleteness()
                        : 0
                )
            );

        const locked =
            identity.locked ===
                true ||
            identity.status ===
                "locked";

        if (!locked) {
            issues.push(
                createIssue({
                    code:
                        "IDENTITY_NOT_LOCKED",

                    section:
                        "identity",

                    severity:
                        completeness >= 85
                            ? SEVERITY.WARNING
                            : SEVERITY.ERROR,

                    message:
                        "La identidad permanente todavía no está bloqueada.",

                    recommendation:
                        "Valida y bloquea la identidad antes de generar el contrato final.",

                    action:
                        "identity"
                })
            );
        }

        if (
            locked &&
            completeness < 85
        ) {
            issues.push(
                createIssue({
                    code:
                        "LOCKED_IDENTITY_INCOMPLETE",

                    section:
                        "identity",

                    severity:
                        SEVERITY.BLOCKER,

                    message:
                        "La identidad está bloqueada, pero su nivel de completitud es insuficiente.",

                    recommendation:
                        "Desbloquea la identidad, completa los rasgos permanentes y vuelve a validarla.",

                    action:
                        "identity"
                })
            );
        }

        if (completeness < 60) {
            issues.push(
                createIssue({
                    code:
                        "IDENTITY_LOW_COMPLETENESS",

                    section:
                        "identity",

                    severity:
                        SEVERITY.BLOCKER,

                    message:
                        `La identidad tiene una completitud del ${completeness} %.`,

                    recommendation:
                        "Completa los rasgos faciales, cabello, piel, edad y características distintivas.",

                    action:
                        "identity"
                })
            );
        }

        return createSectionResult(
            "identity",
            issues,
            completeness,
            {
                locked
            }
        );
    }

    /* ========================================================
       VALIDACIÓN DE DIRECCIÓN CREATIVA
       ======================================================== */

    async function validateDirection() {
        const issues = [];
        const profile =
            getActiveProfile();

        const direction =
            profile?.direction ||
            {};

        let bindingResult = null;

        if (
            window.DirectionBinding &&
            typeof DirectionBinding
                .validateAll ===
                "function"
        ) {
            try {
                bindingResult =
                    await DirectionBinding
                        .validateAll({
                            notify:
                                false
                        });

                issues.push(
                    ...mapExternalIssues(
                        bindingResult,
                        "direction"
                    )
                );
            } catch (error) {
                issues.push(
                    createIssue({
                        code:
                            "DIRECTION_BINDING_VALIDATION_FAILED",

                        section:
                            "direction",

                        severity:
                            SEVERITY.ERROR,

                        message:
                            "No se pudo validar la dirección creativa.",

                        detail:
                            error.message,

                        action:
                            "direction"
                    })
                );
            }
        }

        if (
            window.CreativeEngine &&
            typeof CreativeEngine
                .validate ===
                "function"
        ) {
            try {
                const engineResult =
                    await CreativeEngine
                        .validate(
                            direction,
                            {
                                profile,
                                identity:
                                    profile?.identity
                            }
                        );

                issues.push(
                    ...mapExternalIssues(
                        engineResult,
                        "direction"
                    )
                );
            } catch (error) {
                issues.push(
                    createIssue({
                        code:
                            "CREATIVE_ENGINE_FAILED",

                        section:
                            "direction",

                        severity:
                            SEVERITY.WARNING,

                        message:
                            "No se pudo ejecutar la validación avanzada de dirección creativa.",

                        detail:
                            error.message
                    })
                );
            }
        }

        const completeness =
            getNumericValue(
                bindingResult
                    ?.completeness,
                getNumericValue(
                    direction
                        .completeness,
                    window.DirectionBinding &&
                    typeof DirectionBinding
                        .calculateCompleteness ===
                        "function"
                        ? DirectionBinding
                            .calculateCompleteness()
                        : 0
                )
            );

        if (completeness < 60) {
            issues.push(
                createIssue({
                    code:
                        "DIRECTION_LOW_COMPLETENESS",

                    section:
                        "direction",

                    severity:
                        SEVERITY.ERROR,

                    message:
                        `La dirección creativa tiene una completitud del ${completeness} %.`,

                    recommendation:
                        "Define iluminación, cámara, composición, fondo, vestuario, pose y tratamiento.",

                    action:
                        "direction"
                })
            );
        }

        if (
            direction.presetId &&
            direction.validation
                ?.errors?.length
        ) {
            issues.push(
                createIssue({
                    code:
                        "PRESET_WITH_CONFLICTS",

                    section:
                        "direction",

                    severity:
                        SEVERITY.ERROR,

                    message:
                        "El preset aplicado presenta conflictos con la configuración actual.",

                    recommendation:
                        "Revisa los campos modificados o vuelve a aplicar el preset.",

                    action:
                        "direction"
                })
            );
        }

        return createSectionResult(
            "direction",
            issues,
            completeness,
            {
                presetId:
                    direction.presetId ||
                    null
            }
        );
    }

    /* ========================================================
       VALIDACIÓN DEL CONTRATO
       ======================================================== */

    async function validateContract(
        sectionResults = {}
    ) {
        const issues = [];

        const profile =
            getActiveProfile();

        if (!profile) {
            issues.push(
                createIssue({
                    code:
                        "CONTRACT_PROFILE_MISSING",

                    section:
                        "contract",

                    severity:
                        SEVERITY.BLOCKER,

                    message:
                        "No es posible construir el contrato sin un perfil activo."
                })
            );

            return createSectionResult(
                "contract",
                issues,
                0
            );
        }

        const identity =
            profile.identity ||
            {};

        const direction =
            profile.direction ||
            {};

        const photos =
            getPhotos(profile);

        if (
            !identity ||
            !Object.keys(identity).length
        ) {
            issues.push(
                createIssue({
                    code:
                        "CONTRACT_IDENTITY_MISSING",

                    section:
                        "contract",

                    severity:
                        SEVERITY.BLOCKER,

                    message:
                        "El contrato no contiene una identidad permanente.",

                    action:
                        "identity"
                })
            );
        }

        if (
            !direction ||
            !Object.keys(direction).length
        ) {
            issues.push(
                createIssue({
                    code:
                        "CONTRACT_DIRECTION_MISSING",

                    section:
                        "contract",

                    severity:
                        SEVERITY.BLOCKER,

                    message:
                        "El contrato no contiene una dirección creativa.",

                    action:
                        "direction"
                })
            );
        }

        if (
            photos.length <
            MINIMUM_PHOTOS
        ) {
            issues.push(
                createIssue({
                    code:
                        "CONTRACT_REFERENCES_MISSING",

                    section:
                        "contract",

                    severity:
                        SEVERITY.BLOCKER,

                    message:
                        "El contrato no contiene referencias visuales suficientes.",

                    action:
                        "photos"
                })
            );
        }

        const alteringTerms =
            detectIdentityAlteringTerms(
                direction
            );

        alteringTerms.forEach(
            term => {
                issues.push(
                    createIssue({
                        code:
                            "CONTRACT_IDENTITY_ALTERATION",

                        section:
                            "contract",

                        severity:
                            SEVERITY.BLOCKER,

                        message:
                            `La dirección creativa contiene una instrucción incompatible con la identidad permanente: «${term}».`,

                        recommendation:
                            "Elimina cualquier instrucción que cambie edad, facciones, cabello, piel o asimetrías.",

                        action:
                            "direction"
                    })
                );
            }
        );

        const inputSections =
            Object.values(
                sectionResults
            );

        const blockingSections =
            inputSections.filter(
                section =>
                    section?.issues
                        ?.some(
                            issue =>
                                issue.severity ===
                                SEVERITY.BLOCKER
                        )
            );

        if (
            blockingSections.length
        ) {
            issues.push(
                createIssue({
                    code:
                        "CONTRACT_DEPENDENCY_BLOCKED",

                    section:
                        "contract",

                    severity:
                        SEVERITY.BLOCKER,

                    message:
                        "El contrato depende de secciones que contienen bloqueos.",

                    recommendation:
                        "Corrige primero los bloqueos del perfil, fotografías, identidad o dirección creativa."
                })
            );
        }

        let promptCompatibility = null;

        if (
            window.PromptEngine &&
            typeof PromptEngine
                .validate ===
                "function"
        ) {
            try {
                promptCompatibility =
                    await PromptEngine
                        .validate(
                            profile
                        );

                issues.push(
                    ...mapExternalIssues(
                        promptCompatibility,
                        "contract"
                    )
                );
            } catch (error) {
                issues.push(
                    createIssue({
                        code:
                            "PROMPT_COMPATIBILITY_CHECK_FAILED",

                        section:
                            "contract",

                        severity:
                            SEVERITY.WARNING,

                        message:
                            "No se pudo comprobar la compatibilidad con el generador de prompts.",

                        detail:
                            error.message
                    })
                );
            }
        }

        const completeness =
            calculateContractCompleteness(
                sectionResults,
                issues
            );

        return createSectionResult(
            "contract",
            issues,
            completeness,
            {
                promptCompatibility:
                    clone(
                        promptCompatibility
                    )
            }
        );
    }

    /* ========================================================
       SCORING
       ======================================================== */

    function calculateScore(
        sections = state.sections,
        issues = state.issues
    ) {
        let weightedScore = 0;
        let totalWeight = 0;

        Object.entries(
            SECTION_WEIGHTS
        ).forEach(
            ([sectionName, weight]) => {
                const section =
                    sections?.[
                        sectionName
                    ];

                const completeness =
                    getNumericValue(
                        section
                            ?.completeness,
                        0
                    );

                weightedScore +=
                    completeness *
                    weight;

                totalWeight +=
                    weight;
            }
        );

        let score =
            totalWeight > 0
                ? weightedScore /
                  totalWeight
                : 0;

        const counts =
            countIssues(
                issues
            );

        score -=
            counts.blocker * 25;

        score -=
            counts.error * 10;

        score -=
            counts.warning * 3;

        score -=
            counts.info * 0.5;

        if (
            counts.blocker > 0
        ) {
            score =
                Math.min(
                    score,
                    49
                );
        }

        if (
            counts.blocker === 0 &&
            counts.error > 0
        ) {
            score =
                Math.min(
                    score,
                    74
                );
        }

        return clamp(
            Math.round(score),
            0,
            100
        );
    }

    function determineCanGenerate(
        issues,
        sections
    ) {
        const blockers =
            issues.some(
                issue =>
                    issue.severity ===
                    SEVERITY.BLOCKER
            );

        const invalidIdentity =
            sections.identity
                ?.valid === false;

        const invalidDirection =
            sections.direction
                ?.valid === false;

        const missingPhotos =
            sections.photos
                ?.metadata
                ?.count < 1;

        return !(
            blockers ||
            invalidIdentity ||
            invalidDirection ||
            missingPhotos
        );
    }

    function canGeneratePrompt() {
        return (
            state.validated ===
                true &&
            state.canGeneratePrompt ===
                true
        );
    }

    function determineStatus(
        score,
        issues,
        canGenerate
    ) {
        const counts =
            countIssues(
                issues
            );

        if (
            counts.blocker > 0
        ) {
            return "blocked";
        }

        if (
            counts.error > 0
        ) {
            return "error";
        }

        if (
            !canGenerate ||
            counts.warning > 0 ||
            score < 85
        ) {
            return "warning";
        }

        return "ready";
    }

    /* ========================================================
       RENDER
       ======================================================== */

    function renderDashboard() {
        renderScore();
        renderStatus();
        renderSummary();
        renderSections();
        renderIssues();
        renderRecommendations();
        renderResultsContainer();
    }

    function renderScore() {
        const score =
            state.score || 0;

        if (scoreElement) {
            scoreElement.textContent =
                `${score} %`;
        }

        if (scoreBarElement) {
            scoreBarElement.style.width =
                `${score}%`;

            scoreBarElement.setAttribute(
                "aria-valuenow",
                String(score)
            );
        }

        panel?.style.setProperty(
            "--validation-score",
            `${score}%`
        );
    }

    function renderStatus() {
        if (!statusElement) {
            return;
        }

        statusElement.classList.remove(
            CLASSES.READY,
            CLASSES.WARNING,
            CLASSES.ERROR,
            CLASSES.BLOCKED
        );

        const labels = {
            pending:
                "Pendiente",

            ready:
                "Listo para generar",

            warning:
                "Revisión recomendada",

            error:
                "Requiere correcciones",

            blocked:
                "Generación bloqueada"
        };

        statusElement.textContent =
            labels[state.status] ||
            labels.pending;

        const classMap = {
            ready:
                CLASSES.READY,

            warning:
                CLASSES.WARNING,

            error:
                CLASSES.ERROR,

            blocked:
                CLASSES.BLOCKED
        };

        if (
            classMap[state.status]
        ) {
            statusElement.classList.add(
                classMap[state.status]
            );
        }
    }

    function renderSummary() {
        if (!summaryElement) {
            return;
        }

        const counts =
            state.counts ||
            createIssueCounts();

        summaryElement.innerHTML =
            `
            <div class="validation-summary__item">
                <strong>${counts.blocker}</strong>
                <span>Bloqueos</span>
            </div>

            <div class="validation-summary__item">
                <strong>${counts.error}</strong>
                <span>Errores</span>
            </div>

            <div class="validation-summary__item">
                <strong>${counts.warning}</strong>
                <span>Advertencias</span>
            </div>

            <div class="validation-summary__item">
                <strong>${counts.info}</strong>
                <span>Recomendaciones</span>
            </div>
            `;
    }

    function renderSections() {
        if (!sectionsElement) {
            return;
        }

        const sectionOrder = [
            "profile",
            "photos",
            "identity",
            "direction",
            "contract"
        ];

        sectionsElement.innerHTML =
            sectionOrder
                .map(
                    sectionName =>
                        buildSectionCard(
                            sectionName,
                            state.sections
                                ?.[
                                    sectionName
                                ]
                        )
                )
                .join("");
    }

    function buildSectionCard(
        sectionName,
        section
    ) {
        const result =
            section ||
            createSectionResult(
                sectionName,
                [],
                0
            );

        const highestSeverity =
            getHighestSeverity(
                result.issues
            );

        const status =
            !state.validated
                ? "pending"
                : highestSeverity ===
                    SEVERITY.BLOCKER
                    ? "blocked"
                    : highestSeverity ===
                        SEVERITY.ERROR
                        ? "error"
                        : highestSeverity ===
                            SEVERITY.WARNING
                            ? "warning"
                            : "complete";

        return `
            <article
                class="validation-section validation-section--${escapeAttribute(status)}"
            >

                <div class="validation-section__icon">
                    ${getSectionIcon(status)}
                </div>

                <div class="validation-section__content">

                    <strong>
                        ${escapeHtml(getSectionLabel(sectionName))}
                    </strong>

                    <span>
                        ${escapeHtml(getSectionStatusText(result, status))}
                    </span>

                </div>

                <div class="validation-section__score">
                    ${result.completeness} %
                </div>

                ${
                    sectionName !==
                    "contract"
                        ? `
                            <button
                                type="button"
                                class="button button--ghost button--small"
                                data-validation-navigate="${escapeAttribute(sectionName)}"
                            >
                                Revisar
                            </button>
                          `
                        : ""
                }

            </article>
        `;
    }

    function renderIssues() {
        if (!issuesElement) {
            return;
        }

        const actionableIssues =
            state.issues.filter(
                issue =>
                    issue.severity !==
                    SEVERITY.INFO
            );

        if (!actionableIssues.length) {
            issuesElement.innerHTML =
                `
                <div class="empty-state">
                    <strong>
                        No se han detectado incidencias.
                    </strong>

                    <span>
                        El contrato no contiene errores ni bloqueos.
                    </span>
                </div>
                `;

            return;
        }

        issuesElement.innerHTML =
            actionableIssues
                .map(
                    buildIssueCard
                )
                .join("");
    }

    function renderRecommendations() {
        if (!recommendationsElement) {
            return;
        }

        const recommendations =
            state.issues.filter(
                issue =>
                    issue.recommendation ||
                    issue.severity ===
                    SEVERITY.INFO
            );

        if (!recommendations.length) {
            recommendationsElement.innerHTML =
                `
                <div class="empty-state">
                    <strong>
                        Sin recomendaciones pendientes.
                    </strong>
                </div>
                `;

            return;
        }

        recommendationsElement.innerHTML =
            `
            <ul class="recommendation-list">
                ${recommendations
                    .map(
                        issue => `
                            <li>
                                <span>
                                    ${escapeHtml(
                                        issue.recommendation ||
                                        issue.message
                                    )}
                                </span>

                                ${
                                    issue.action
                                        ? `
                                            <button
                                                type="button"
                                                class="button button--ghost button--small"
                                                data-validation-navigate="${escapeAttribute(issue.action)}"
                                            >
                                                Revisar
                                            </button>
                                          `
                                        : ""
                                }
                            </li>
                        `
                    )
                    .join("")}
            </ul>
            `;
    }

    function renderResultsContainer() {
        if (!resultsElement) {
            return;
        }

        resultsElement.classList.toggle(
            CLASSES.READY,
            state.status ===
                "ready"
        );

        resultsElement.classList.toggle(
            CLASSES.WARNING,
            state.status ===
                "warning"
        );

        resultsElement.classList.toggle(
            CLASSES.ERROR,
            state.status ===
                "error"
        );

        resultsElement.classList.toggle(
            CLASSES.BLOCKED,
            state.status ===
                "blocked"
        );
    }

    function buildIssueCard(issue) {
        return `
            <article
                class="validation-issue validation-issue--${escapeAttribute(issue.severity)}"
            >

                <div class="validation-issue__header">

                    <span class="validation-issue__severity">
                        ${escapeHtml(getSeverityLabel(issue.severity))}
                    </span>

                    <span class="validation-issue__section">
                        ${escapeHtml(getSectionLabel(issue.section))}
                    </span>

                </div>

                <strong>
                    ${escapeHtml(issue.message)}
                </strong>

                ${
                    issue.detail
                        ? `
                            <p>
                                ${escapeHtml(issue.detail)}
                            </p>
                          `
                        : ""
                }

                ${
                    issue.recommendation
                        ? `
                            <p class="validation-issue__recommendation">
                                ${escapeHtml(issue.recommendation)}
                            </p>
                          `
                        : ""
                }

                ${
                    issue.action
                        ? `
                            <button
                                type="button"
                                class="button button--ghost button--small"
                                data-validation-navigate="${escapeAttribute(issue.action)}"
                            >
                                Revisar sección
                            </button>
                          `
                        : ""
                }

            </article>
        `;
    }

    function setValidating(active) {
        panel?.classList.toggle(
            CLASSES.VALIDATING,
            active === true
        );

        if (
            window.UI &&
            typeof UI.setBusy ===
                "function"
        ) {
            UI.setBusy(
                active,
                active
                    ? "Validando Portrait Contract..."
                    : ""
            );
        }
    }

    function updateGenerateAction() {
        root.querySelectorAll(
            SELECTORS.GENERATE_ACTION
        )
            .forEach(
                button => {
                    button.disabled =
                        !canGeneratePrompt();

                    button.setAttribute(
                        "aria-disabled",
                        String(
                            !canGeneratePrompt()
                        )
                    );

                    button.title =
                        canGeneratePrompt()
                            ? ""
                            : "Completa la validación antes de generar el prompt.";
                }
            );
    }

    /* ========================================================
       NAVEGACIÓN
       ======================================================== */

    function navigateToSection(
        section
    ) {
        const routeMap = {
            profile:
                "profile",

            photos:
                "photos",

            identity:
                "identity",

            direction:
                "direction",

            validation:
                "validation"
        };

        const destination =
            routeMap[section];

        if (!destination) {
            return false;
        }

        if (
            window.Wizard &&
            typeof Wizard.goTo ===
                "function"
        ) {
            Wizard.goTo(
                destination
            );

            return true;
        }

        if (
            window.Router &&
            typeof Router.navigate ===
                "function"
        ) {
            Router.navigate(
                destination
            );

            return true;
        }

        emit(
            "navigation:requested",
            {
                destination
            }
        );

        return true;
    }

    /* ========================================================
       PERSISTENCIA
       ======================================================== */

    function persistValidationState(
        validationState
    ) {
        const profile =
            getActiveProfile();

        if (!profile) {
            return false;
        }

        const updated =
            clone(profile);

        updated.validation = {
            score:
                validationState.score,

            status:
                validationState.status,

            canGeneratePrompt:
                validationState
                    .canGeneratePrompt,

            counts:
                clone(
                    validationState.counts
                ),

            sections:
                clone(
                    validationState.sections
                ),

            issues:
                clone(
                    validationState.issues
                ),

            validatedAt:
                validationState
                    .validatedAt
        };

        if (
            typeof ProfileService
                .update ===
                "function"
        ) {
            ProfileService.update(
                updated
            );

            return true;
        }

        if (
            typeof ProfileService
                .setActive ===
                "function"
        ) {
            ProfileService.setActive(
                updated
            );

            return true;
        }

        return false;
    }

    /* ========================================================
       EVENTOS DE APLICACIÓN
       ======================================================== */

    function bindApplicationEvents() {
        if (
            !window.AppEvents ||
            typeof AppEvents.on !==
                "function"
        ) {
            return;
        }

        const invalidatingEvents = [
            "profile:updated",
            "profile:photo-added",
            "profile:photo-removed",
            "profile:photos-reordered",
            "profile:primary-photo-changed",
            "identity:field-updated",
            "identity:locked",
            "identity:unlocked",
            "direction:field-updated",
            "direction:preset-applied",
            "direction:preset-cleared",
            "direction:reset"
        ];

        invalidatingEvents.forEach(
            eventName => {
                subscriptions.push(
                    AppEvents.on(
                        eventName,
                        invalidate
                    )
                );
            }
        );

        subscriptions.push(
            AppEvents.on(
                "profile:loaded",
                detail => {
                    loadStoredValidation(
                        detail?.profile
                    );
                }
            )
        );

        subscriptions.push(
            AppEvents.on(
                "profile:imported",
                detail => {
                    loadStoredValidation(
                        detail?.profile
                    );
                }
            )
        );

        subscriptions.push(
            AppEvents.on(
                "binding:validation-run",
                validate
            )
        );

        subscriptions.push(
            AppEvents.on(
                "binding:validation-refresh",
                validate
            )
        );
    }

    function invalidate() {
        state = {
            ...state,

            validated:
                false,

            status:
                "pending",

            canGeneratePrompt:
                false
        };

        renderDashboard();
        updateGenerateAction();

        emit(
            "validation:invalidated",
            getState()
        );
    }

    function loadStoredValidation(
        profile = null
    ) {
        const source =
            profile ||
            getActiveProfile();

        const stored =
            source?.validation;

        if (
            !stored ||
            typeof stored !==
                "object"
        ) {
            state =
                createInitialState();

            renderDashboard();
            updateGenerateAction();

            return;
        }

        state = {
            validated:
                Boolean(
                    stored.validatedAt
                ),

            validating:
                false,

            score:
                getNumericValue(
                    stored.score,
                    0
                ),

            status:
                stored.status ||
                "pending",

            canGeneratePrompt:
                stored.canGeneratePrompt ===
                true,

            sections:
                clone(
                    stored.sections ||
                    {}
                ),

            issues:
                clone(
                    stored.issues ||
                    []
                ),

            counts:
                clone(
                    stored.counts ||
                    countIssues(
                        stored.issues ||
                        []
                    )
                ),

            validatedAt:
                stored.validatedAt ||
                null
        };

        renderDashboard();
        updateGenerateAction();
    }

    /* ========================================================
       UTILIDADES DE RESULTADOS
       ======================================================== */

    function createInitialState() {
        return {
            validated:
                false,

            validating:
                false,

            score:
                0,

            status:
                "pending",

            canGeneratePrompt:
                false,

            sections:
                {},

            issues:
                [],

            counts:
                createIssueCounts(),

            validatedAt:
                null
        };
    }

    function createSectionResult(
        name,
        issues,
        completeness,
        metadata = {}
    ) {
        const normalizedIssues =
            uniqueIssues(
                issues
            );

        return {
            name,

            valid:
                !normalizedIssues
                    .some(
                        issue =>
                            issue.severity ===
                                SEVERITY.ERROR ||
                            issue.severity ===
                                SEVERITY.BLOCKER
                    ),

            completeness:
                clamp(
                    Math.round(
                        getNumericValue(
                            completeness,
                            0
                        )
                    ),
                    0,
                    100
                ),

            issues:
                normalizedIssues,

            counts:
                countIssues(
                    normalizedIssues
                ),

            metadata:
                clone(metadata)
        };
    }

    function createIssue({
        code,
        section,
        severity,
        message,
        detail = "",
        recommendation = "",
        action = "",
        field = ""
    }) {
        return {
            id:
                createId(),

            code:
                normalizeText(code) ||
                "VALIDATION_ISSUE",

            section:
                normalizeText(section) ||
                "contract",

            severity:
                normalizeSeverity(
                    severity
                ),

            message:
                normalizeText(message) ||
                "Se ha detectado una incidencia.",

            detail:
                normalizeText(detail),

            recommendation:
                normalizeText(
                    recommendation
                ),

            action:
                normalizeText(action),

            field:
                normalizeText(field)
        };
    }

    function mapExternalIssues(
        result,
        section
    ) {
        const issues = [];

        normalizeArray(
            result?.errors
        ).forEach(
            item => {
                issues.push(
                    createIssue({
                        code:
                            item.code ||
                            "EXTERNAL_VALIDATION_ERROR",

                        section,

                        severity:
                            normalizeSeverity(
                                item.severity
                            ) ===
                            SEVERITY.BLOCKER
                                ? SEVERITY.BLOCKER
                                : SEVERITY.ERROR,

                        message:
                            item.message ||
                            String(item),

                        detail:
                            item.detail,

                        recommendation:
                            item.recommendation,

                        action:
                            item.action ||
                            section,

                        field:
                            item.field
                    })
                );
            }
        );

        normalizeArray(
            result?.warnings
        ).forEach(
            item => {
                issues.push(
                    createIssue({
                        code:
                            item.code ||
                            "EXTERNAL_VALIDATION_WARNING",

                        section,

                        severity:
                            SEVERITY.WARNING,

                        message:
                            item.message ||
                            String(item),

                        detail:
                            item.detail,

                        recommendation:
                            item.recommendation,

                        action:
                            item.action ||
                            section,

                        field:
                            item.field
                    })
                );
            }
        );

        normalizeArray(
            result?.recommendations
        ).forEach(
            item => {
                issues.push(
                    createIssue({
                        code:
                            item.code ||
                            "EXTERNAL_RECOMMENDATION",

                        section,

                        severity:
                            SEVERITY.INFO,

                        message:
                            item.message ||
                            String(item),

                        recommendation:
                            item.recommendation ||
                            item.message ||
                            String(item),

                        action:
                            item.action ||
                            section,

                        field:
                            item.field
                    })
                );
            }
        );

        return issues;
    }

    function consolidateIssues(
        sections
    ) {
        return uniqueIssues(
            Object.values(
                sections
            ).flatMap(
                section =>
                    section?.issues ||
                    []
            )
        )
            .sort(
                (a, b) =>
                    SEVERITY_ORDER[
                        b.severity
                    ] -
                    SEVERITY_ORDER[
                        a.severity
                    ]
            );
    }

    function uniqueIssues(
        issues
    ) {
        const seen =
            new Set();

        return normalizeArray(
            issues
        ).filter(
            issue => {
                const key =
                    [
                        issue.code,
                        issue.section,
                        issue.field,
                        issue.message
                    ].join("|");

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

    function countIssues(
        issues
    ) {
        return normalizeArray(
            issues
        ).reduce(
            (counts, issue) => {
                const severity =
                    normalizeSeverity(
                        issue.severity
                    );

                counts[severity] += 1;

                return counts;
            },
            createIssueCounts()
        );
    }

    function createIssueCounts() {
        return {
            blocker: 0,
            error: 0,
            warning: 0,
            info: 0
        };
    }

    function getHighestSeverity(
        issues
    ) {
        return normalizeArray(
            issues
        ).reduce(
            (highest, issue) => {
                if (
                    SEVERITY_ORDER[
                        issue.severity
                    ] >
                    SEVERITY_ORDER[
                        highest
                    ]
                ) {
                    return issue.severity;
                }

                return highest;
            },
            SEVERITY.INFO
        );
    }

    /* ========================================================
       CÁLCULOS DE COMPLETITUD
       ======================================================== */

    function estimateProfileCompleteness(
        profile
    ) {
        const values = [
            profile.name ||
                profile.general?.name,

            profile.description ||
                profile.general
                    ?.description,

            profile.purpose ||
                profile.general
                    ?.purpose,

            profile.language ||
                profile.general
                    ?.language
        ];

        const completed =
            values.filter(
                hasValue
            ).length;

        return Math.round(
            completed /
            values.length *
            100
        );
    }

    function calculatePhotosCompleteness(
        photos,
        primary
    ) {
        if (!photos.length) {
            return 0;
        }

        let score = 40;

        if (primary) {
            score += 25;
        }

        if (
            photos.length >= 2
        ) {
            score += 15;
        }

        if (
            photos.length >=
            RECOMMENDED_PHOTOS
        ) {
            score += 20;
        }

        return clamp(
            score,
            0,
            100
        );
    }

    function calculateContractCompleteness(
        sections,
        issues
    ) {
        const values =
            Object.values(
                sections
            )
                .map(
                    section =>
                        section
                            ?.completeness
                )
                .filter(
                    value =>
                        Number.isFinite(
                            Number(value)
                        )
                );

        const average =
            values.length
                ? values.reduce(
                    (sum, value) =>
                        sum +
                        Number(value),
                    0
                ) /
                  values.length
                : 0;

        const counts =
            countIssues(
                issues
            );

        return clamp(
            Math.round(
                average -
                counts.blocker * 30 -
                counts.error * 10 -
                counts.warning * 3
            ),
            0,
            100
        );
    }

    /* ========================================================
       REGLAS DE CONTRATO
       ======================================================== */

    function detectIdentityAlteringTerms(
        direction
    ) {
        const forbiddenTerms = [
            "rejuvenecer",
            "más joven",
            "sin arrugas",
            "eliminar arrugas",
            "piel perfecta",
            "eliminar canas",
            "cambiar facciones",
            "modificar facciones",
            "afinar nariz",
            "agrandar ojos",
            "cambiar mandíbula",
            "cambiar rostro",
            "cambiar edad",
            "alterar identidad"
        ];

        const serialized =
            JSON.stringify(
                direction ||
                {}
            ).toLowerCase();

        return forbiddenTerms.filter(
            term =>
                serialized.includes(
                    term
                )
        );
    }

    /* ========================================================
       SERVICIOS
       ======================================================== */

    function getActiveProfile() {
        if (
            window.ProfileService &&
            typeof ProfileService
                .getActive ===
                "function"
        ) {
            return ProfileService
                .getActive();
        }

        return null;
    }

    function getPhotos(profile) {
        if (
            window.ProfileService
                ?.photos &&
            typeof ProfileService
                .photos.list ===
                "function"
        ) {
            return normalizeArray(
                ProfileService
                    .photos.list()
            );
        }

        if (
            window.ProfilePhotos &&
            typeof ProfilePhotos.list ===
                "function"
        ) {
            return normalizeArray(
                ProfilePhotos.list()
            );
        }

        return normalizeArray(
            profile?.photos
        );
    }

    /* ========================================================
       MENSAJES Y ETIQUETAS
       ======================================================== */

    function notifyValidationResult() {
        if (
            state.status ===
                "ready"
        ) {
            notify(
                `Portrait Contract validado. Readiness: ${state.score} %.`,
                "success"
            );

            return;
        }

        if (
            state.status ===
                "blocked"
        ) {
            notify(
                `La generación está bloqueada por ${state.counts.blocker} incidencia${state.counts.blocker === 1 ? "" : "s"} crítica${state.counts.blocker === 1 ? "" : "s"}.`,
                "error"
            );

            return;
        }

        if (
            state.status ===
                "error"
        ) {
            notify(
                `La validación contiene ${state.counts.error} error${state.counts.error === 1 ? "" : "es"}.`,
                "warning"
            );

            return;
        }

        notify(
            `Validación completada con ${state.counts.warning} recomendación${state.counts.warning === 1 ? "" : "es"}.`,
            "info"
        );
    }

    function getSectionLabel(
        section
    ) {
        const labels = {
            profile:
                "Perfil",

            photos:
                "Fotografías",

            identity:
                "Identidad",

            direction:
                "Dirección creativa",

            contract:
                "Portrait Contract"
        };

        return (
            labels[section] ||
            section ||
            "Sección"
        );
    }

    function getSectionStatusText(
        section,
        status
    ) {
        if (status === "pending") {
            return "Validación pendiente";
        }

        if (status === "complete") {
            return "Sin incidencias";
        }

        if (status === "blocked") {
            return `${section.counts.blocker} bloqueo${section.counts.blocker === 1 ? "" : "s"}`;
        }

        if (status === "error") {
            return `${section.counts.error} error${section.counts.error === 1 ? "" : "es"}`;
        }

        if (status === "warning") {
            return `${section.counts.warning} advertencia${section.counts.warning === 1 ? "" : "s"}`;
        }

        return "Pendiente";
    }

    function getSectionIcon(
        status
    ) {
        const icons = {
            pending:
                "○",

            complete:
                "✓",

            warning:
                "!",

            error:
                "×",

            blocked:
                "■"
        };

        return (
            icons[status] ||
            "○"
        );
    }

    function getSeverityLabel(
        severity
    ) {
        const labels = {
            info:
                "Info",

            warning:
                "Advertencia",

            error:
                "Error",

            blocker:
                "Bloqueo"
        };

        return (
            labels[severity] ||
            "Incidencia"
        );
    }

    /* ========================================================
       UTILIDADES GENERALES
       ======================================================== */

    function normalizeSeverity(
        value
    ) {
        const normalized =
            normalizeText(
                value
            ).toLowerCase();

        return Object.values(
            SEVERITY
        ).includes(
            normalized
        )
            ? normalized
            : SEVERITY.WARNING;
    }

    function normalizeArray(value) {
        return Array.isArray(
            value
        )
            ? value
            : [];
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

        return true;
    }

    function getNumericValue(
        value,
        fallback = 0
    ) {
        const number =
            Number(value);

        return Number.isFinite(
            number
        )
            ? number
            : fallback;
    }

    function clamp(
        value,
        minimum,
        maximum
    ) {
        return Math.min(
            maximum,
            Math.max(
                minimum,
                value
            )
        );
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
            "validation-" +
            Date.now()
                .toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    }

    function notify(
        message,
        type = "info"
    ) {
        if (
            window.UI &&
            typeof UI.notify ===
                "function"
        ) {
            UI.notify(
                message,
                {
                    type
                }
            );

            return;
        }

        emit(
            "ui:notification",
            {
                message,
                type
            }
        );
    }

    function emit(
        eventName,
        detail
    ) {
        if (
            window.AppEvents &&
            typeof AppEvents.emit ===
                "function"
        ) {
            AppEvents.emit(
                eventName,
                detail
            );
        }
    }

    function emitError(
        error,
        context
    ) {
        if (
            window.AppEvents &&
            typeof AppEvents
                .emitError ===
                "function"
        ) {
            AppEvents.emitError(
                error,
                context
            );
        }
    }

    function normalizeText(value) {
        return String(
            value ?? ""
        ).trim();
    }

    function escapeHtml(value) {
        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }

    function escapeAttribute(
        value
    ) {
        return escapeHtml(value);
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

    function getState() {
        return clone({
            initialized,
            ...state
        });
    }

    function validateDependencies() {
        const required = [
            "ProfileService"
        ];

        const missing =
            required.filter(
                dependency =>
                    !window[dependency]
            );

        if (missing.length) {
            throw createError(
                "MISSING_VALIDATION_BINDING_DEPENDENCY",
                `Faltan dependencias: ${missing.join(", ")}.`
            );
        }
    }

    function createError(
        code,
        message
    ) {
        const error =
            new Error(message);

        error.name =
            "ValidationBindingError";

        error.code =
            code;

        return error;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        init,
        destroy,

        validate,
        validateProfile,
        validatePhotos,
        validateIdentity,
        validateDirection,
        validateContract,

        calculateScore,
        canGeneratePrompt,

        renderDashboard,
        renderSummary,
        renderStatus,

        invalidate,
        getState
    });

})();

window.ValidationBinding =
    ValidationBinding;
