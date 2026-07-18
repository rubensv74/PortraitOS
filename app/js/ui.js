/* ===========================================================
   PortraitOS
   UI Layer
   Version: 0.1.0
   =========================================================== */

"use strict";

const PortraitUI = (() => {

    /* =======================================================
       ESTADO INTERNO
       ======================================================= */

    let initialized = false;

    let elements = {};

    let lastState = null;

    let activeModal = null;

    let loadingCount = 0;

    let toastSequence = 0;


    const STEP_ICONS = Object.freeze({

        photos: "01",

        identity: "02",

        faceLock: "03",

        goal: "04",

        perception: "05",

        summary: "06"

    });


    const GOAL_OPTIONS = Object.freeze([

        {

            id: "linkedin",

            title: "LinkedIn",

            description:
                "Retrato profesional para perfil, publicaciones y presencia corporativa.",

            icon: "LI"

        },

        {

            id: "corporate",

            title: "Perfil corporativo",

            description:
                "Imagen institucional para directorios, intranet, firma o dossier.",

            icon: "CO"

        },

        {

            id: "executive",

            title: "Retrato ejecutivo",

            description:
                "Presencia estratégica, liderazgo, credibilidad y capacidad de decisión.",

            icon: "EX"

        },

        {

            id: "editorial",

            title: "Editorial profesional",

            description:
                "Retrato con intención visual para artículos, entrevistas o publicaciones.",

            icon: "ED"

        },

        {

            id: "speaker",

            title: "Ponente o conferencia",

            description:
                "Imagen para congresos, programas, webinars y materiales promocionales.",

            icon: "SP"

        },

        {

            id: "personal-brand",

            title: "Marca personal",

            description:
                "Retrato distintivo y coherente con una identidad profesional propia.",

            icon: "MP"

        }

    ]);


    const PERCEPTION_OPTIONS = Object.freeze([

        {

            id: "credible",

            title: "Credibilidad",

            description:
                "Seguridad, solvencia y confianza profesional.",

            icon: "CR"

        },

        {

            id: "approachable",

            title: "Cercanía",

            description:
                "Accesibilidad, escucha y trato humano.",

            icon: "CE"

        },

        {

            id: "leadership",

            title: "Liderazgo",

            description:
                "Autoridad serena, dirección y capacidad de decisión.",

            icon: "LI"

        },

        {

            id: "competent",

            title: "Competencia",

            description:
                "Dominio técnico, precisión y fiabilidad.",

            icon: "CO"

        },

        {

            id: "creative",

            title: "Creatividad",

            description:
                "Originalidad, sensibilidad visual y pensamiento diferente.",

            icon: "CV"

        },

        {

            id: "confident",

            title: "Confianza",

            description:
                "Autoconfianza equilibrada, sin rigidez ni arrogancia.",

            icon: "CF"

        },

        {

            id: "warm",

            title: "Calidez",

            description:
                "Empatía, naturalidad y conexión emocional.",

            icon: "CA"

        },

        {

            id: "strategic",

            title: "Visión estratégica",

            description:
                "Perspectiva, madurez y orientación a resultados.",

            icon: "VE"

        },

        {

            id: "dynamic",

            title: "Dinamismo",

            description:
                "Energía, iniciativa y disposición para actuar.",

            icon: "DI"

        }

    ]);


    /* =======================================================
       INICIALIZACIÓN
       ======================================================= */

    function initialize() {

        if (initialized) {

            return;

        }

        ensureApplicationShell();

        cacheElements();

        attachGlobalEvents();

        initialized = true;

    }


    function ensureApplicationShell() {

        let workspace =
            document.getElementById(
                "workspace"
            );

        if (!workspace) {

            workspace =
                document.createElement(
                    "main"
                );

            workspace.id =
                "workspace";

            workspace.setAttribute(
                "aria-live",
                "polite"
            );

            document.body.appendChild(
                workspace
            );

        }

        if (
            !document.querySelector(
                ".toast-container"
            )
        ) {

            const toastContainer =
                document.createElement(
                    "div"
                );

            toastContainer.className =
                "toast-container";

            toastContainer.setAttribute(
                "aria-live",
                "polite"
            );

            document.body.appendChild(
                toastContainer
            );

        }

    }


    function cacheElements() {

        elements = {

            app:

                document.getElementById(
                    "app"
                ),

            sidebar:

                document.querySelector(
                    ".sidebar"
                ),

            sidebarNav:

                document.querySelector(
                    "[data-sidebar-nav]"
                ) ||

                document.querySelector(
                    ".sidebar nav"
                ),

            topbar:

                document.querySelector(
                    ".topbar"
                ),

            pageTitle:

                document.getElementById(
                    "pageTitle"
                ) ||

                document.querySelector(
                    "[data-page-title]"
                ) ||

                document.querySelector(
                    ".topbar h2"
                ),

            pageDescription:

                document.getElementById(
                    "pageDescription"
                ) ||

                document.querySelector(
                    "[data-page-description]"
                ) ||

                document.querySelector(
                    ".topbar p"
                ),

            workspace:

                document.getElementById(
                    "workspace"
                ),

            wizardSteps:

                document.querySelector(
                    "[data-wizard-steps]"
                ) ||

                document.querySelector(
                    ".wizard-steps"
                ),

            progressFill:

                document.querySelector(
                    ".progress-fill"
                ),

            previousButton:

                document.getElementById(
                    "btnPrevious"
                ) ||

                document.querySelector(
                    "[data-action='previous']"
                ),

            nextButton:

                document.getElementById(
                    "btnNext"
                ) ||

                document.querySelector(
                    "[data-action='next']"
                ),

            stepCounter:

                document.querySelector(
                    ".step-counter"
                ),

            toastContainer:

                document.querySelector(
                    ".toast-container"
                )

        };

    }


    function attachGlobalEvents() {

        document.addEventListener(
            "click",
            handleDocumentClick
        );

        document.addEventListener(
            "change",
            handleDocumentChange
        );

        document.addEventListener(
            "input",
            handleDocumentInput
        );

        document.addEventListener(
            "keydown",
            handleDocumentKeydown
        );

        document.addEventListener(
            "dragover",
            handleDragOver
        );

        document.addEventListener(
            "dragleave",
            handleDragLeave
        );

        document.addEventListener(
            "drop",
            handleDrop
        );

    }


    /* =======================================================
       RENDER PRINCIPAL
       ======================================================= */

    function render(state) {

        initialize();

        if (
            !state ||
            typeof state !== "object"
        ) {

            throw new TypeError(
                "PortraitUI.render requiere un estado válido."
            );

        }

        lastState = state;

        renderHeader(state);

        renderSidebar(state);

        renderWizardNavigation(state);

        renderStep(state);

        renderProgress(state);

        updateButtons(state);

    }


    function renderHeader(state) {

        const route =
            state.route || {};

        if (elements.pageTitle) {

            elements.pageTitle.textContent =

                route.title ||

                state.step?.title ||

                "PortraitOS";

        }

        if (
            elements.pageDescription
        ) {

            elements.pageDescription.textContent =

                route.description ||

                "Sistema profesional de inteligencia para retrato.";

        }

    }


    /* =======================================================
       SIDEBAR
       ======================================================= */

    function renderSidebar(state) {

        if (
            !elements.sidebarNav ||
            !window.PortraitRouter
        ) {

            return;

        }

        const routes =
            PortraitRouter.getRoutes();

        const currentStep =
            Number(
                state.currentStep || 0
            );

        const completedSteps =
            normalizeCompletedSteps(
                state.session
            );

        elements.sidebarNav.innerHTML =

            routes

                .map(route => {

                    const isActive =
                        route.step ===
                        currentStep;

                    const isCompleted =
                        completedSteps.includes(
                            route.step
                        );

                    const isAllowed =
                        canNavigateToRoute(
                            route,
                            state
                        );

                    const classes = [

                        "nav-item",

                        isActive
                            ? "active"
                            : "",

                        isCompleted
                            ? "completed"
                            : "",

                        !isAllowed
                            ? "disabled"
                            : ""

                    ]

                        .filter(Boolean)

                        .join(" ");

                    return `

                        <button

                            type="button"

                            class="${classes}"

                            data-route="${escapeAttribute(
                                route.id
                            )}"

                            data-step="${route.step}"

                            aria-current="${
                                isActive
                                    ? "step"
                                    : "false"
                            }"

                            aria-disabled="${
                                !isAllowed
                            }"

                            ${
                                !isAllowed
                                    ? "disabled"
                                    : ""
                            }

                        >

                            <span aria-hidden="true">

                                ${
                                    STEP_ICONS[
                                        route.id
                                    ] ||

                                    String(
                                        route.step + 1
                                    ).padStart(
                                        2,
                                        "0"
                                    )
                                }

                            </span>

                            <div>

                                <strong>

                                    ${escapeHTML(
                                        route.title
                                    )}

                                </strong>

                                <small>

                                    ${getRouteStatusLabel(

                                        route.step,

                                        currentStep,

                                        completedSteps

                                    )}

                                </small>

                            </div>

                        </button>

                    `;

                })

                .join("");

    }


    function renderWizardNavigation(
        state
    ) {

        if (
            !elements.wizardSteps ||
            !window.PortraitRouter
        ) {

            return;

        }

        const routes =
            PortraitRouter.getRoutes();

        const currentStep =
            Number(
                state.currentStep || 0
            );

        const completedSteps =
            normalizeCompletedSteps(
                state.session
            );

        elements.wizardSteps.innerHTML =

            routes

                .map(route => {

                    const isActive =
                        route.step ===
                        currentStep;

                    const isCompleted =
                        completedSteps.includes(
                            route.step
                        );

                    const isAllowed =
                        canNavigateToRoute(
                            route,
                            state
                        );

                    const classes = [

                        "step",

                        isActive
                            ? "active"
                            : "",

                        isCompleted
                            ? "completed"
                            : "",

                        !isAllowed
                            ? "disabled"
                            : ""

                    ]

                        .filter(Boolean)

                        .join(" ");

                    return `

                        <button

                            type="button"

                            class="${classes}"

                            data-route="${escapeAttribute(
                                route.id
                            )}"

                            data-step="${route.step}"

                            aria-current="${
                                isActive
                                    ? "step"
                                    : "false"
                            }"

                            ${
                                !isAllowed
                                    ? "disabled"
                                    : ""
                            }

                        >

                            ${escapeHTML(
                                route.title
                            )}

                        </button>

                    `;

                })

                .join("");

    }


    function getRouteStatusLabel(

        step,

        currentStep,

        completedSteps

    ) {

        if (
            step === currentStep
        ) {

            return "Paso actual";

        }

        if (
            completedSteps.includes(
                step
            )
        ) {

            return "Completado";

        }

        if (
            step < currentStep
        ) {

            return "Revisable";

        }

        return "Pendiente";

    }


    function canNavigateToRoute(

        route,

        state

    ) {

        if (
            !window.PortraitRouter
                ?.canNavigateToStep
        ) {

            return (
                route.step <=
                Number(
                    state.currentStep || 0
                ) + 1
            );

        }

        return PortraitRouter
            .canNavigateToStep(

                route.step,

                state.session || {}

            );

    }


    /* =======================================================
       RENDER DEL PASO
       ======================================================= */

    function renderStep(state) {

        const routeId =

            state.route?.id ||

            state.step?.id ||

            "photos";

        let content = "";

        switch (routeId) {

            case "photos":

                content =
                    renderPhotos(state);

                break;

            case "identity":

                content =
                    renderIdentity(state);

                break;

            case "faceLock":

                content =
                    renderFaceLock(state);

                break;

            case "goal":

                content =
                    renderGoal(state);

                break;

            case "perception":

                content =
                    renderPerception(
                        state
                    );

                break;

            case "summary":

                content =
                    renderSummary(state);

                break;

            default:

                content =
                    renderUnknownStep(
                        routeId
                    );

        }

        elements.workspace.innerHTML = `

            <div class="container">

                ${content}

            </div>

        `;

        focusWorkspaceHeading();

    }


    function renderStepHeader({

        eyebrow,

        title,

        description,

        actions = ""

    }) {

        return `

            <header class="workspace-header">

                <div class="workspace-header__content">

                    <span class="workspace-eyebrow">

                        ${escapeHTML(
                            eyebrow
                        )}

                    </span>

                    <h1

                        class="workspace-title"

                        tabindex="-1"

                        data-workspace-heading

                    >

                        ${escapeHTML(
                            title
                        )}

                    </h1>

                    <p class="workspace-description">

                        ${escapeHTML(
                            description
                        )}

                    </p>

                </div>

                ${
                    actions

                        ? `

                            <div class="workspace-actions">

                                ${actions}

                            </div>

                        `

                        : ""
                }

            </header>

        `;

    }


    /* =======================================================
       FOTOGRAFÍAS
       ======================================================= */

    function renderPhotos(state) {

        const photos =

            Array.isArray(

                state.profile
                    ?.identity
                    ?.photos

            )

                ? state.profile
                    .identity
                    .photos

                : [];

        const primaryPhotoId =

            state.profile
                ?.identity
                ?.primaryPhotoId ||

            null;

        return `

            ${renderStepHeader({

                eyebrow:
                    "Identidad visual",

                title:
                    "Fotografías de referencia",

                description:
                    "Añade imágenes nítidas y representativas. Estas fotografías constituyen la fuente de verdad visual de PortraitOS.",

                actions: `

                    <button

                        type="button"

                        class="secondary"

                        data-action="open-profile-import"

                    >

                        Importar perfil

                    </button>

                `

            })}

            <section

                class="info-panel"

                aria-label="Recomendación"

            >

                <div

                    class="info-panel__icon"

                    aria-hidden="true"

                >

                    i

                </div>

                <div>

                    <strong>

                        La calidad de la referencia determina la fidelidad.

                    </strong>

                    <p>

                        Utiliza fotografías recientes, sin filtros,
                        con buena luz y ángulos complementarios.
                        Incluye al menos una vista frontal.

                    </p>

                </div>

            </section>

            <label

                class="photo-upload"

                for="portraitPhotoInput"

                data-photo-dropzone

            >

                <span

                    class="photo-upload__icon"

                    aria-hidden="true"

                >

                    +

                </span>

                <strong>

                    Añadir fotografías

                </strong>

                <p>

                    Arrastra las imágenes hasta aquí
                    o selecciónalas desde el equipo.

                </p>

                <small>

                    JPG, PNG o WEBP.
                    Máximo recomendado: 10 MB por archivo.

                </small>

                <input

                    id="portraitPhotoInput"

                    type="file"

                    accept="image/jpeg,image/png,image/webp"

                    multiple

                    hidden

                    data-action="add-photos"

                >

            </label>

            ${
                photos.length

                    ? renderPhotoGallery(

                        photos,

                        primaryPhotoId

                    )

                    : renderPhotoEmptyState()
            }

        `;

    }


    function renderPhotoGallery(

        photos,

        primaryPhotoId

    ) {

        return `

            <section

                class="photo-gallery"

                aria-label="Fotografías añadidas"

            >

                ${photos

                    .map(photo =>

                        renderPhotoCard(

                            photo,

                            primaryPhotoId

                        )

                    )

                    .join("")}

            </section>

        `;

    }


    function renderPhotoCard(

        photo,

        primaryPhotoId

    ) {

        const isPrimary =
            photo.id ===
            primaryPhotoId;

        const preview =

            photo.previewUrl ||

            photo.dataUrl ||

            photo.objectUrl ||

            "";

        return `

            <article

                class="photo-card ${
                    isPrimary
                        ? "primary-photo"
                        : ""
                }"

                data-photo-id="${escapeAttribute(
                    photo.id
                )}"

            >

                ${
                    isPrimary

                        ? `

                            <span class="photo-card__badge">

                                Referencia principal

                            </span>

                        `

                        : ""
                }

                <div class="photo-card__preview">

                    ${
                        preview

                            ? `

                                <img

                                    src="${escapeAttribute(
                                        preview
                                    )}"

                                    alt="Fotografía de referencia ${escapeAttribute(
                                        photo.name || ""
                                    )}"

                                >

                            `

                            : renderPhotoPlaceholder()
                    }

                </div>

                <footer class="photo-card__footer">

                    <span

                        class="photo-card__name"

                        title="${escapeAttribute(
                            photo.name ||
                            "Fotografía"
                        )}"

                    >

                        ${escapeHTML(

                            photo.name ||

                            "Fotografía"

                        )}

                    </span>

                    <div class="photo-card__actions">

                        ${
                            !isPrimary

                                ? `

                                    <button

                                        type="button"

                                        class="icon-button"

                                        data-action="set-primary-photo"

                                        data-photo-id="${escapeAttribute(
                                            photo.id
                                        )}"

                                        title="Establecer como principal"

                                        aria-label="Establecer como principal"

                                    >

                                        ★

                                    </button>

                                `

                                : ""
                        }

                        <button

                            type="button"

                            class="icon-button"

                            data-action="remove-photo"

                            data-photo-id="${escapeAttribute(
                                photo.id
                            )}"

                            title="Eliminar fotografía"

                            aria-label="Eliminar fotografía"

                        >

                            ×

                        </button>

                    </div>

                </footer>

            </article>

        `;

    }


    function renderPhotoPlaceholder() {

        return `

            <div

                class="empty"

                style="min-height:100%;padding:24px"

            >

                <span

                    aria-hidden="true"

                    style="font-size:32px"

                >

                    □

                </span>

                <small>

                    Vista previa no almacenada

                </small>

            </div>

        `;

    }


    function renderPhotoEmptyState() {

        return `

            <section

                class="empty"

                aria-label="Sin fotografías"

            >

                <div

                    class="photo-upload__icon"

                    aria-hidden="true"

                >

                    01

                </div>

                <div>

                    <strong>

                        Aún no hay referencias visuales.

                    </strong>

                    <p class="mt-2">

                        Añade varias fotografías para
                        construir una identidad más sólida.

                    </p>

                </div>

            </section>

        `;

    }


    /* =======================================================
       IDENTITY CONTRACT
       ======================================================= */

    function renderIdentity(state) {

        const contract =

            state.profile
                ?.identity
                ?.contract ||

            {};

        const items =
            Object.entries(
                contract
            );

        const lockedCount =

            items.filter(

                ([, item]) =>

                    item?.preserve !==
                    false

            ).length;

        return `

            ${renderStepHeader({

                eyebrow:
                    "Contrato de identidad",

                title:
                    "Identity Contract™",

                description:
                    "Confirma los rasgos que PortraitOS debe preservar. Cada protección activa se convierte en una cláusula explícita.",

                actions: `

                    <span class="selection-counter">

                        <strong>

                            ${lockedCount}

                        </strong>

                        de ${items.length}
                        rasgos protegidos

                    </span>

                `

            })}

            <section

                class="info-panel"

                aria-label="Principio de identidad"

            >

                <div

                    class="info-panel__icon"

                    aria-hidden="true"

                >

                    ID

                </div>

                <div>

                    <strong>

                        La identidad no es una variable creativa.

                    </strong>

                    <p>

                        La iluminación, el vestuario, el fondo,
                        la pose o la cámara pueden evolucionar.
                        Los rasgos personales deben permanecer.

                    </p>

                </div>

            </section>

            <section class="identity-grid">

                ${items

                    .map(([key, item]) =>

                        renderIdentityCard(

                            key,

                            item

                        )

                    )

                    .join("")}

            </section>

        `;

    }


    function renderIdentityCard(

        key,

        item = {}

    ) {

        const preserve =
            item.preserve !== false;

        const label =

            item.label ||

            humanizeKey(key);

        return `

            <article

                class="identity-card ${
                    preserve
                        ? "locked"
                        : ""
                }"

            >

                <header class="identity-card__header">

                    <div>

                        <h2 class="identity-card__title">

                            ${escapeHTML(
                                label
                            )}

                        </h2>

                        <p class="identity-card__description">

                            ${
                                preserve

                                    ? "Protección activa: este rasgo debe mantenerse."

                                    : "Protección desactivada."
                            }

                        </p>

                    </div>

                    <label class="switch">

                        <input

                            type="checkbox"

                            data-action="toggle-identity-clause"

                            data-contract-key="${escapeAttribute(
                                key
                            )}"

                            ${
                                preserve
                                    ? "checked"
                                    : ""
                            }

                            aria-label="Proteger ${escapeAttribute(
                                label
                            )}"

                        >

                        <span class="switch-control"></span>

                    </label>

                </header>

                <textarea

                    data-action="update-identity-notes"

                    data-contract-key="${escapeAttribute(
                        key
                    )}"

                    aria-label="Notas de ${escapeAttribute(
                        label
                    )}"

                    placeholder="Añade una instrucción precisa..."

                >${escapeHTML(
                    item.notes || ""
                )}</textarea>

            </article>

        `;

    }


    /* =======================================================
       FACE LOCK
       ======================================================= */

    function renderFaceLock(state) {

        const faceLock =

            state.profile
                ?.identity
                ?.faceLock ||

            {};

        const value =
            clamp(

                Number(
                    faceLock.value || 100
                ),

                70,

                100

            );

        const circumference =
            2 * Math.PI * 120;

        const offset =

            circumference *

            (
                1 -
                value / 100
            );

        return `

            ${renderStepHeader({

                eyebrow:
                    "Control de fidelidad",

                title:
                    "Face Lock™",

                description:
                    "Define la prioridad técnica de la fidelidad facial. La identidad siempre prevalece; este control ajusta el rigor de la instrucción."

            })}

            <section class="face-lock-layout">

                <div

                    class="face-lock-meter"

                    aria-label="Nivel de Face Lock ${value}%"

                >

                    <svg

                        viewBox="0 0 280 280"

                        role="img"

                        aria-hidden="true"

                    >

                        <circle

                            class="face-lock-meter__track"

                            cx="140"

                            cy="140"

                            r="120"

                        ></circle>

                        <circle

                            class="face-lock-meter__progress"

                            cx="140"

                            cy="140"

                            r="120"

                            stroke-dasharray="${circumference}"

                            stroke-dashoffset="${offset}"

                        ></circle>

                    </svg>

                    <div class="face-lock-meter__content">

                        <strong

                            class="face-lock-meter__value"

                            data-face-lock-value

                        >

                            ${value}%

                        </strong>

                        <span class="face-lock-meter__label">

                            ${escapeHTML(
                                getFaceLockLabel(
                                    value
                                )
                            )}

                        </span>

                    </div>

                </div>

                <div class="face-lock-settings">

                    <div class="card">

                        <div class="field">

                            <label for="faceLockRange">

                                Fidelidad facial

                            </label>

                            <input

                                id="faceLockRange"

                                class="face-lock-slider"

                                type="range"

                                min="70"

                                max="100"

                                step="1"

                                value="${value}"

                                data-action="update-face-lock"

                            >

                        </div>

                        <div class="divider mt-6 mb-6"></div>

                        <span class="badge badge-success">

                            Identidad prioritaria

                        </span>

                        <h2 class="card-title mt-4">

                            ${escapeHTML(
                                getFaceLockLabel(
                                    value
                                )
                            )}

                        </h2>

                        <p class="card-description">

                            ${escapeHTML(
                                getFaceLockDescription(
                                    value
                                )
                            )}

                        </p>

                    </div>

                    <section

                        class="info-panel"

                        style="margin-bottom:0"

                    >

                        <div

                            class="info-panel__icon"

                            aria-hidden="true"

                        >

                            !

                        </div>

                        <div>

                            <strong>

                                No se permite rejuvenecer ni idealizar.

                            </strong>

                            <p>

                                Face Lock no corrige a la persona.
                                Impide que sus rasgos sean sustituidos
                                por un rostro genérico o embellecido.

                            </p>

                        </div>

                    </section>

                </div>

            </section>

        `;

    }


    function getFaceLockLabel(value) {

        if (
            value >= 96
        ) {

            return "Máxima fidelidad";

        }

        if (
            value >= 90
        ) {

            return "Fidelidad estricta";

        }

        if (
            value >= 82
        ) {

            return "Fidelidad reforzada";

        }

        return "Fidelidad protegida";

    }


    function getFaceLockDescription(
        value
    ) {

        if (
            value >= 96
        ) {

            return "La identidad prevalece sobre cualquier decisión estética, editorial o fotográfica.";

        }

        if (
            value >= 90
        ) {

            return "Se admite variación creativa únicamente cuando no modifica la lectura facial.";

        }

        if (
            value >= 82
        ) {

            return "La composición puede ser más flexible, manteniendo intactos los rasgos esenciales.";

        }

        return "El sistema protege la identidad, aunque permite una dirección visual algo más abierta.";

    }


    /* =======================================================
       OBJETIVO
       ======================================================= */

    function renderGoal(state) {

        const selectedGoal =

            state.profile
                ?.direction
                ?.goal ||

            null;

        return `

            ${renderStepHeader({

                eyebrow:
                    "Dirección del retrato",

                title:
                    "Objetivo de publicación",

                description:
                    "Selecciona el uso principal. PortraitOS adaptará composición, vestuario, encuadre, iluminación y contexto sin alterar la identidad."

            })}

            <section

                class="selection-grid"

                aria-label="Objetivos disponibles"

            >

                ${GOAL_OPTIONS

                    .map(option =>

                        renderSelectionCard({

                            option,

                            selected:
                                option.id ===
                                selectedGoal,

                            action:
                                "select-goal",

                            multi:
                                false

                        })

                    )

                    .join("")}

            </section>

            <div class="field mt-6">

                <label for="directionNotes">

                    Contexto adicional

                </label>

                <textarea

                    id="directionNotes"

                    data-action="update-direction-notes"

                    placeholder="Ejemplo: candidatura interna, perfil de analista funcional o publicación para un artículo..."

                >${escapeHTML(

                    state.profile
                        ?.direction
                        ?.notes ||

                    ""

                )}</textarea>

            </div>

        `;

    }


    /* =======================================================
       PERCEPCIÓN
       ======================================================= */

    function renderPerception(state) {

        const selectedPerceptions =

            Array.isArray(

                state.profile
                    ?.direction
                    ?.perceptions

            )

                ? state.profile
                    .direction
                    .perceptions

                : [];

        return `

            ${renderStepHeader({

                eyebrow:
                    "Lectura visual",

                title:
                    "Percepción deseada",

                description:
                    "Elige hasta tres cualidades. Son atributos de comunicación visual, no cambios físicos ni reinterpretaciones de la persona.",

                actions: `

                    <span class="selection-counter">

                        <strong>

                            ${selectedPerceptions.length}

                        </strong>

                        de 3 seleccionadas

                    </span>

                `

            })}

            <section

                class="selection-grid"

                aria-label="Percepciones disponibles"

            >

                ${PERCEPTION_OPTIONS

                    .map(option =>

                        renderSelectionCard({

                            option,

                            selected:

                                selectedPerceptions
                                    .includes(
                                        option.id
                                    ),

                            action:
                                "toggle-perception",

                            multi:
                                true

                        })

                    )

                    .join("")}

            </section>

            <div class="field mt-6">

                <label for="customPerception">

                    Matiz personalizado

                </label>

                <input

                    id="customPerception"

                    type="text"

                    value="${escapeAttribute(

                        state.profile
                            ?.direction
                            ?.customPerception ||

                        ""

                    )}"

                    data-action="update-custom-perception"

                    placeholder="Ejemplo: autoridad serena, elegancia natural o solvencia técnica..."

                >

            </div>

        `;

    }


    function renderSelectionCard({

        option,

        selected,

        action,

        multi

    }) {

        return `

            <button

                type="button"

                class="selection-card ${
                    selected
                        ? "selected"
                        : ""
                }"

                data-action="${escapeAttribute(
                    action
                )}"

                data-value="${escapeAttribute(
                    option.id
                )}"

                aria-pressed="${selected}"

            >

                <span

                    class="selection-card__check"

                    aria-hidden="true"

                >

                    ✓

                </span>

                <span

                    class="selection-card__icon"

                    aria-hidden="true"

                >

                    ${escapeHTML(
                        option.icon
                    )}

                </span>

                <span>

                    <h3>

                        ${escapeHTML(
                            option.title
                        )}

                    </h3>

                    <p>

                        ${escapeHTML(
                            option.description
                        )}

                    </p>

                </span>

                ${
                    multi

                        ? `

                            <small class="text-muted">

                                Selección múltiple

                            </small>

                        `

                        : ""
                }

            </button>

        `;

    }


    /* =======================================================
       RESUMEN
       ======================================================= */

    function renderSummary(state) {

        const profile =
            state.profile || {};

        const photos =
            profile.identity?.photos || [];

        const contractEntries =

            Object.values(

                profile.identity
                    ?.contract ||

                {}

            );

        const protectedCount =

            contractEntries.filter(

                item =>

                    item?.preserve !==
                    false

            ).length;

        const goal =

            GOAL_OPTIONS.find(

                item =>

                    item.id ===
                    profile.direction?.goal

            );

        const perceptions =

            PERCEPTION_OPTIONS.filter(

                item =>

                    (
                        profile.direction
                            ?.perceptions ||

                        []
                    )

                        .includes(
                            item.id
                        )

            );

        const promptText =

            profile.prompt
                ?.compiledText ||

            buildPromptPreview(

                profile,

                goal,

                perceptions

            );

        return `

            ${renderStepHeader({

                eyebrow:
                    "Compilación final",

                title:
                    "Resumen del retrato",

                description:
                    "Revisa el contrato de identidad y la dirección visual antes de copiar o exportar la especificación.",

                actions: `

                    <button

                        type="button"

                        class="secondary"

                        data-action="export-profile"

                    >

                        Exportar perfil

                    </button>

                    <button

                        type="button"

                        class="primary"

                        data-action="compile-prompt"

                    >

                        Compilar

                    </button>

                `

            })}

            <section class="summary-grid">

                ${renderSummaryCard(

                    "Referencias",

                    String(
                        photos.length
                    ),

                    photos.length === 1

                        ? "Una fotografía cargada"

                        : `${photos.length} fotografías cargadas`

                )}

                ${renderSummaryCard(

                    "Identity Contract",

                    `${protectedCount}/${contractEntries.length}`,

                    "Rasgos protegidos"

                )}

                ${renderSummaryCard(

                    "Face Lock",

                    `${profile.identity
                        ?.faceLock
                        ?.value || 100}%`,

                    getFaceLockLabel(

                        profile.identity
                            ?.faceLock
                            ?.value ||

                        100

                    )

                )}

                ${renderSummaryCard(

                    "Objetivo",

                    goal?.title ||

                    "Sin seleccionar",

                    goal?.description ||

                    "Pendiente de definición"

                )}

                ${renderSummaryCard(

                    "Percepción",

                    perceptions.length

                        ? perceptions

                            .map(
                                item =>
                                    item.title
                            )

                            .join(", ")

                        : "Sin seleccionar",

                    profile.direction
                        ?.customPerception ||

                    "Sin matiz adicional"

                )}

                ${renderSummaryCard(

                    "Estado",

                    profile.metadata
                        ?.status ===
                        "ready"

                        ? "Preparado"

                        : "Borrador",

                    `Actualizado ${formatDate(

                        profile.metadata
                            ?.updatedAt

                    )}`

                )}

            </section>

            <section class="prompt-panel">

                <header class="prompt-panel__header">

                    <span class="prompt-panel__title">

                        Especificación PortraitOS

                    </span>

                    <div class="prompt-panel__actions">

                        <button

                            type="button"

                            class="ghost"

                            data-action="copy-prompt"

                        >

                            Copiar

                        </button>

                    </div>

                </header>

                <textarea

                    readonly

                    spellcheck="false"

                    data-prompt-output

                    aria-label="Especificación compilada"

                >${escapeHTML(
                    promptText
                )}</textarea>

            </section>

        `;

    }


    function renderSummaryCard(

        label,

        value,

        detail

    ) {

        return `

            <article class="summary-card">

                <span class="summary-card__label">

                    ${escapeHTML(
                        label
                    )}

                </span>

                <div class="summary-card__value">

                    ${escapeHTML(
                        value
                    )}

                </div>

                <p class="summary-card__detail">

                    ${escapeHTML(
                        detail
                    )}

                </p>

            </article>

        `;

    }


    function buildPromptPreview(

        profile,

        goal,

        perceptions

    ) {

        const clauses =

            Object.values(

                profile.identity
                    ?.contract ||

                {}

            )

                .filter(

                    item =>

                        item?.preserve !==
                        false

                )

                .map(

                    item =>

                        `- ${item.label}: ${item.notes}`

                )

                .join("\n");

        const perceptionText =

            perceptions.length

                ? perceptions

                    .map(
                        item =>
                            item.title
                    )

                    .join(", ")

                : "Pendiente de definir";

        return [

            "PORTRAITOS — ESPECIFICACIÓN DE RETRATO",

            "",

            "PRINCIPIO CENTRAL",

            "La identidad de la persona debe conservarse de forma estricta. La creatividad solo puede aplicarse a iluminación, vestuario, composición, pose, fondo y cámara.",

            "",

            "IDENTITY CONTRACT",

            clauses ||

            "- Contrato pendiente de completar.",

            "",

            `FACE LOCK: ${
                profile.identity
                    ?.faceLock
                    ?.value ||

                100
            }%`,

            "",

            `OBJETIVO: ${
                goal?.title ||
                "Pendiente de seleccionar"
            }`,

            `PERCEPCIÓN: ${perceptionText}`,

            profile.direction
                ?.customPerception

                ? `MATIZ: ${profile.direction.customPerception}`

                : "",

            profile.direction
                ?.notes

                ? `CONTEXTO: ${profile.direction.notes}`

                : "",

            "",

            "RESTRICCIONES",

            "- No rejuvenecer.",

            "- No idealizar ni sustituir rasgos.",

            "- No alisar ni plastificar la textura de la piel.",

            "- No modificar edad, arrugas, canas, proporciones faciales, nariz, ojos, mandíbula, dentadura, barba ni asimetrías.",

            "- La imagen final debe parecer inequívocamente la misma persona."

        ]

            .filter(
                line =>
                    line !== ""
            )

            .join("\n");

    }


    function renderUnknownStep(
        routeId
    ) {

        return `

            ${renderStepHeader({

                eyebrow:
                    "PortraitOS",

                title:
                    "Paso no disponible",

                description:
                    "La ruta solicitada no está definida en esta versión."

            })}

            <section class="empty">

                <strong>

                    Ruta desconocida

                </strong>

                <p>

                    ${escapeHTML(
                        routeId
                    )}

                </p>

            </section>

        `;

    }


    /* =======================================================
       PROGRESO
       ======================================================= */

    function renderProgress(state) {

        const currentStep =
            Number(
                state.currentStep || 0
            );

        const totalSteps =
            Number(
                state.totalSteps || 1
            );

        const percentage =
            clamp(

                (
                    (
                        currentStep + 1
                    ) /

                    totalSteps
                ) * 100,

                0,

                100

            );

        if (
            elements.progressFill
        ) {

            elements.progressFill
                .style
                .width =
                `${percentage}%`;

            elements.progressFill
                .setAttribute(

                    "aria-valuenow",

                    String(
                        Math.round(
                            percentage
                        )
                    )

                );

        }

        if (
            elements.stepCounter
        ) {

            elements.stepCounter
                .textContent =

                `Paso ${currentStep + 1} de ${totalSteps}`;

        }

    }


    function updateButtons(state) {

        const currentStep =
            Number(
                state.currentStep || 0
            );

        const totalSteps =
            Number(
                state.totalSteps || 1
            );

        const isFirst =
            currentStep === 0;

        const isLast =
            currentStep ===
            totalSteps - 1;

        const canContinue =
            state.validation
                ?.valid !== false;

        if (
            elements.previousButton
        ) {

            elements.previousButton
                .disabled =
                isFirst;

            elements.previousButton
                .hidden =
                isFirst;

        }

        if (
            elements.nextButton
        ) {

            elements.nextButton
                .disabled =
                !canContinue;

            elements.nextButton
                .textContent =

                isLast

                    ? "Finalizar"

                    : "Continuar";

            elements.nextButton
                .dataset
                .action =

                isLast

                    ? "finish"

                    : "next";

        }

    }


    /* =======================================================
       EVENTOS
       ======================================================= */

    function handleDocumentClick(
        event
    ) {

        const routeElement =

            event.target.closest(
                "[data-route]"
            );

        if (
            routeElement &&
            !routeElement.disabled
        ) {

            emitUIEvent(

                "navigate",

                {

                    routeId:
                        routeElement
                            .dataset
                            .route,

                    step:
                        Number(

                            routeElement
                                .dataset
                                .step

                        )

                }

            );

            return;

        }

        const actionElement =

            event.target.closest(
                "[data-action]"
            );

        if (!actionElement) {

            return;

        }

        const action =
            actionElement
                .dataset
                .action;

        switch (action) {

            case "previous":

                emitUIEvent(
                    "previous"
                );

                break;

            case "next":

                emitUIEvent(
                    "next"
                );

                break;

            case "finish":

                emitUIEvent(
                    "finish"
                );

                break;

            case "set-primary-photo":

                emitUIEvent(

                    "set-primary-photo",

                    {

                        photoId:

                            actionElement
                                .dataset
                                .photoId

                    }

                );

                break;

            case "remove-photo":

                confirmPhotoRemoval(

                    actionElement
                        .dataset
                        .photoId

                );

                break;

            case "select-goal":

                emitUIEvent(

                    "select-goal",

                    {

                        value:

                            actionElement
                                .dataset
                                .value

                    }

                );

                break;

            case "toggle-perception":

                emitUIEvent(

                    "toggle-perception",

                    {

                        value:

                            actionElement
                                .dataset
                                .value

                    }

                );

                break;

            case "compile-prompt":

                emitUIEvent(
                    "compile-prompt"
                );

                break;

            case "copy-prompt":

                copyPromptToClipboard();

                break;

            case "export-profile":

                emitUIEvent(
                    "export-profile"
                );

                break;

            case "open-profile-import":

                openImportDialog();

                break;

            case "modal-cancel":

                closeModal();

                break;

            case "modal-confirm":

                executeModalConfirmation();

                break;

            default:

                break;

        }

    }


    function handleDocumentChange(
        event
    ) {

        const target =
            event.target;

        const action =
            target.dataset.action;

        switch (action) {

            case "add-photos":

                emitUIEvent(

                    "add-photos",

                    {

                        files:

                            Array.from(

                                target.files ||
                                []

                            )

                    }

                );

                target.value = "";

                break;

            case "toggle-identity-clause":

                emitUIEvent(

                    "toggle-identity-clause",

                    {

                        key:

                            target.dataset
                                .contractKey,

                        preserve:

                            target.checked

                    }

                );

                break;

            case "update-face-lock":

                emitUIEvent(

                    "update-face-lock",

                    {

                        value:

                            Number(
                                target.value
                            )

                    }

                );

                break;

            case "import-profile-file":

                emitUIEvent(

                    "import-profile-file",

                    {

                        file:

                            target.files?.[0] ||

                            null

                    }

                );

                closeModal();

                break;

            default:

                break;

        }

    }


    function handleDocumentInput(
        event
    ) {

        const target =
            event.target;

        const action =
            target.dataset.action;

        switch (action) {

            case "update-identity-notes":

                emitUIEvent(

                    "update-identity-notes",

                    {

                        key:

                            target.dataset
                                .contractKey,

                        notes:

                            target.value

                    }

                );

                break;

            case "update-face-lock":

                updateFaceLockPreview(

                    Number(
                        target.value
                    )

                );

                emitUIEvent(

                    "update-face-lock",

                    {

                        value:

                            Number(
                                target.value
                            )

                    }

                );

                break;

            case "update-direction-notes":

                emitUIEvent(

                    "update-direction-notes",

                    {

                        value:

                            target.value

                    }

                );

                break;

            case "update-custom-perception":

                emitUIEvent(

                    "update-custom-perception",

                    {

                        value:

                            target.value

                    }

                );

                break;

            default:

                break;

        }

    }


    function handleDocumentKeydown(
        event
    ) {

        if (
            event.key === "Escape" &&
            activeModal
        ) {

            closeModal();

        }

    }


    function emitUIEvent(

        name,

        detail = {}

    ) {

        window.dispatchEvent(

            new CustomEvent(

                `portraitos:ui:${name}`,

                {

                    detail

                }

            )

        );

    }


    /* =======================================================
       DRAG AND DROP
       ======================================================= */

    function handleDragOver(event) {

        const dropzone =

            event.target.closest(
                "[data-photo-dropzone]"
            );

        if (!dropzone) {

            return;

        }

        event.preventDefault();

        dropzone.classList.add(
            "drag-over"
        );

    }


    function handleDragLeave(event) {

        const dropzone =

            event.target.closest(
                "[data-photo-dropzone]"
            );

        if (!dropzone) {

            return;

        }

        dropzone.classList.remove(
            "drag-over"
        );

    }


    function handleDrop(event) {

        const dropzone =

            event.target.closest(
                "[data-photo-dropzone]"
            );

        if (!dropzone) {

            return;

        }

        event.preventDefault();

        dropzone.classList.remove(
            "drag-over"
        );

        const files =

            Array.from(

                event.dataTransfer
                    ?.files ||

                []

            )

                .filter(

                    file =>

                        file.type
                            .startsWith(
                                "image/"
                            )

                );

        if (
            files.length
        ) {

            emitUIEvent(

                "add-photos",

                {

                    files

                }

            );

        }

    }


    /* =======================================================
       FACE LOCK PREVIEW
       ======================================================= */

    function updateFaceLockPreview(
        value
    ) {

        const safeValue =
            clamp(
                value,
                70,
                100
            );

        const valueElement =

            document.querySelector(
                "[data-face-lock-value]"
            );

        const labelElement =

            document.querySelector(
                ".face-lock-meter__label"
            );

        const progressCircle =

            document.querySelector(
                ".face-lock-meter__progress"
            );

        const titleElement =

            document.querySelector(
                ".face-lock-settings .card-title"
            );

        const descriptionElement =

            document.querySelector(
                ".face-lock-settings .card-description"
            );

        if (
            valueElement
        ) {

            valueElement.textContent =
                `${safeValue}%`;

        }

        if (
            labelElement
        ) {

            labelElement.textContent =

                getFaceLockLabel(
                    safeValue
                );

        }

        if (
            progressCircle
        ) {

            const circumference =
                2 * Math.PI * 120;

            const offset =

                circumference *

                (
                    1 -
                    safeValue / 100
                );

            progressCircle
                .style
                .strokeDashoffset =
                String(offset);

        }

        if (
            titleElement
        ) {

            titleElement.textContent =

                getFaceLockLabel(
                    safeValue
                );

        }

        if (
            descriptionElement
        ) {

            descriptionElement
                .textContent =

                getFaceLockDescription(
                    safeValue
                );

        }

    }


    /* =======================================================
       TOASTS
       ======================================================= */

    function showToast({

        title = "PortraitOS",

        message = "",

        type = "success",

        duration = 3500

    } = {}) {

        initialize();

        const id =

            `portrait-toast-${++toastSequence}`;

        const toast =

            document.createElement(
                "div"
            );

        toast.id = id;

        toast.className =

            `toast ${normalizeToastType(
                type
            )}`;

        toast.setAttribute(

            "role",

            type === "error"

                ? "alert"

                : "status"

        );

        toast.innerHTML = `

            <div class="toast__content">

                <strong class="toast__title">

                    ${escapeHTML(
                        title
                    )}

                </strong>

                ${
                    message

                        ? `

                            <p class="toast__message">

                                ${escapeHTML(
                                    message
                                )}

                            </p>

                        `

                        : ""
                }

            </div>

            <button

                type="button"

                class="ghost"

                aria-label="Cerrar notificación"

                data-toast-close

            >

                ×

            </button>

        `;

        elements.toastContainer
            .appendChild(
                toast
            );

        toast

            .querySelector(
                "[data-toast-close]"
            )

            ?.addEventListener(

                "click",

                () =>

                    removeToast(
                        toast
                    )

            );

        if (
            duration > 0
        ) {

            window.setTimeout(

                () =>

                    removeToast(
                        toast
                    ),

                duration

            );

        }

        return id;

    }


    function removeToast(toast) {

        if (
            !toast?.isConnected
        ) {

            return;

        }

        toast.style.opacity =
            "0";

        toast.style.transform =
            "translateX(16px)";

        window.setTimeout(

            () =>

                toast.remove(),

            180

        );

    }


    function normalizeToastType(
        type
    ) {

        return [

            "success",

            "warning",

            "error"

        ].includes(type)

            ? type

            : "success";

    }


    /* =======================================================
       LOADING
       ======================================================= */

    function showLoading(

        message =
            "Procesando..."

    ) {

        initialize();

        loadingCount += 1;

        let overlay =

            document.querySelector(
                ".loading-overlay"
            );

        if (!overlay) {

            overlay =

                document.createElement(
                    "div"
                );

            overlay.className =
                "loading-overlay";

            overlay.setAttribute(
                "role",
                "status"
            );

            overlay.innerHTML = `

                <div style="text-align:center">

                    <div

                        class="spinner"

                        aria-hidden="true"

                    ></div>

                    <p

                        class="mt-4 text-secondary"

                        data-loading-message

                    ></p>

                </div>

            `;

            elements.workspace
                .style
                .position =
                "relative";

            elements.workspace
                .appendChild(
                    overlay
                );

        }

        const messageElement =

            overlay.querySelector(
                "[data-loading-message]"
            );

        if (
            messageElement
        ) {

            messageElement.textContent =
                message;

        }

    }


    function hideLoading(

        force = false

    ) {

        loadingCount =

            force

                ? 0

                : Math.max(

                    0,

                    loadingCount - 1

                );

        if (
            loadingCount > 0
        ) {

            return;

        }

        document

            .querySelector(
                ".loading-overlay"
            )

            ?.remove();

    }


    /* =======================================================
       MODALES
       ======================================================= */

    function openModal({

        title = "Confirmación",

        body = "",

        confirmText = "Confirmar",

        cancelText = "Cancelar",

        danger = false,

        onConfirm = null,

        showCancel = true

    } = {}) {

        closeModal();

        const backdrop =

            document.createElement(
                "div"
            );

        backdrop.className =
            "modal-backdrop";

        backdrop.innerHTML = `

            <section

                class="modal"

                role="dialog"

                aria-modal="true"

                aria-labelledby="portraitModalTitle"

            >

                <header class="modal__header">

                    <h2

                        id="portraitModalTitle"

                        class="modal__title"

                    >

                        ${escapeHTML(
                            title
                        )}

                    </h2>

                    <button

                        type="button"

                        class="icon-button"

                        data-action="modal-cancel"

                        aria-label="Cerrar"

                    >

                        ×

                    </button>

                </header>

                <div class="modal__body">

                    ${body}

                </div>

                <footer class="modal__footer">

                    ${
                        showCancel

                            ? `

                                <button

                                    type="button"

                                    class="secondary"

                                    data-action="modal-cancel"

                                >

                                    ${escapeHTML(
                                        cancelText
                                    )}

                                </button>

                            `

                            : ""
                    }

                    <button

                        type="button"

                        class="${
                            danger
                                ? "danger"
                                : "primary"
                        }"

                        data-action="modal-confirm"

                    >

                        ${escapeHTML(
                            confirmText
                        )}

                    </button>

                </footer>

            </section>

        `;

        backdrop.addEventListener(

            "click",

            event => {

                if (
                    event.target ===
                    backdrop
                ) {

                    closeModal();

                }

            }

        );

        activeModal = {

            element:
                backdrop,

            onConfirm

        };

        document.body.appendChild(
            backdrop
        );

        backdrop

            .querySelector(
                "button, input, textarea, select"
            )

            ?.focus();

    }


    function closeModal() {

        if (!activeModal) {

            return;

        }

        activeModal
            .element
            ?.remove();

        activeModal = null;

    }


    function executeModalConfirmation() {

        const callback =
            activeModal?.onConfirm;

        closeModal();

        if (
            typeof callback ===
            "function"
        ) {

            callback();

        }

    }


    function confirmPhotoRemoval(
        photoId
    ) {

        openModal({

            title:
                "Eliminar fotografía",

            body: `

                <p>

                    La fotografía dejará de formar parte
                    del conjunto de referencias de identidad.

                </p>

            `,

            confirmText:
                "Eliminar",

            cancelText:
                "Conservar",

            danger:
                true,

            onConfirm:
                () => {

                    emitUIEvent(

                        "remove-photo",

                        {

                            photoId

                        }

                    );

                }

        });

    }


    function openImportDialog() {

        openModal({

            title:
                "Importar perfil PortraitOS",

            body: `

                <div class="field">

                    <label for="portraitImportInput">

                        Archivo JSON

                    </label>

                    <input

                        id="portraitImportInput"

                        type="file"

                        accept="application/json,.json"

                        data-action="import-profile-file"

                    >

                    <small class="text-muted">

                        El perfil importado sustituirá
                        el borrador almacenado actualmente.

                    </small>

                </div>

            `,

            confirmText:
                "Cerrar",

            showCancel:
                false

        });

    }


    /* =======================================================
       PORTAPAPELES
       ======================================================= */

    async function copyPromptToClipboard() {

        const output =

            document.querySelector(
                "[data-prompt-output]"
            );

        const text =

            output?.value ||

            output?.textContent ||

            "";

        if (
            !text.trim()
        ) {

            showToast({

                title:
                    "No hay contenido",

                message:
                    "Compila primero la especificación.",

                type:
                    "warning"

            });

            return;

        }

        try {

            await navigator
                .clipboard
                .writeText(text);

            showToast({

                title:
                    "Especificación copiada",

                message:
                    "El contenido está disponible en el portapapeles.",

                type:
                    "success"

            });

        } catch (error) {

            output?.select();

            document.execCommand(
                "copy"
            );

            showToast({

                title:
                    "Especificación copiada",

                message:
                    "Se ha utilizado el método compatible del navegador.",

                type:
                    "success"

            });

        }

    }


    /* =======================================================
       UTILIDADES
       ======================================================= */

    function normalizeCompletedSteps(
        session
    ) {

        return Array.isArray(
            session?.completedSteps
        )

            ? session
                .completedSteps
                .map(Number)

            : [];

    }


    function focusWorkspaceHeading() {

        window.requestAnimationFrame(

            () => {

                document

                    .querySelector(
                        "[data-workspace-heading]"
                    )

                    ?.focus({

                        preventScroll:
                            true

                    });

            }

        );

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


    function humanizeKey(value) {

        return String(
            value || ""
        )

            .replace(

                /([a-z])([A-Z])/g,

                "$1 $2"

            )

            .replace(

                /[_-]+/g,

                " "

            )

            .replace(

                /^./,

                character =>

                    character
                        .toUpperCase()

            );

    }


    function formatDate(value) {

        if (!value) {

            return "sin fecha";

        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "sin fecha";

        }

        return new Intl
            .DateTimeFormat(

                "es-ES",

                {

                    dateStyle:
                        "medium",

                    timeStyle:
                        "short"

                }

            )

            .format(date);

    }


    function escapeHTML(value) {

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


    function escapeAttribute(value) {

        return escapeHTML(value)

            .replace(
                /`/g,
                "&#096;"
            );

    }


    function getLastState() {

        return lastState;

    }


    /* =======================================================
       API PÚBLICA
       ======================================================= */

    return {

        initialize,

        render,

        renderHeader,

        renderSidebar,

        renderWizardNavigation,

        renderStep,

        renderProgress,

        updateButtons,

        showToast,

        showLoading,

        hideLoading,

        openModal,

        closeModal,

        getLastState,

        escapeHTML

    };

})();


/* ===========================================================
   EXPOSICIÓN GLOBAL
   =========================================================== */

window.PortraitUI =
    PortraitUI;
