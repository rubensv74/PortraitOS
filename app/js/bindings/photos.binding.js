"use strict";

/* ============================================================
   PortraitOS
   Photos Binding
   ------------------------------------------------------------
   Responsabilidad:
   - Conectar el selector de archivos con ProfileService.photos.
   - Gestionar drag & drop.
   - Validar archivos antes de incorporarlos.
   - Crear miniaturas y renderizar la galería.
   - Seleccionar fotografía principal.
   - Eliminar y reordenar fotografías.
   - Mantener sincronizada la interfaz con el perfil activo.
   ============================================================ */

const PhotosBinding = (() => {

    const SELECTORS = Object.freeze({
        INPUT:
            "[data-photo-input]",

        DROPZONE:
            ".photo-dropzone",

        GALLERY:
            "[data-photo-gallery]",

        PHOTO_CARD:
            "[data-photo-id]",

        ACTION:
            "[data-photo-action]",

        COUNTER:
            "[data-photo-counter]",

        STATUS:
            "[data-photo-status]"
    });

    const CLASSES = Object.freeze({
        DRAGGING:
            "is-dragging",

        LOADING:
            "is-loading",

        PRIMARY:
            "is-primary",

        INVALID:
            "is-invalid",

        EMPTY:
            "is-empty"
    });

    const DEFAULT_MAX_FILES = 12;

    let initialized = false;
    let root = document;

    let input = null;
    let dropzone = null;
    let gallery = null;
    let counter = null;
    let status = null;

    let subscriptions = [];
    let processing = false;
    let dragDepth = 0;

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

        render();

        initialized = true;

        emit(
            "binding:photos-ready",
            {
                photoCount:
                    getPhotos().length
            }
        );

        return getState();
    }

    function destroy() {
        input?.removeEventListener(
            "change",
            handleInputChange
        );

        dropzone?.removeEventListener(
            "dragenter",
            handleDragEnter
        );

        dropzone?.removeEventListener(
            "dragover",
            handleDragOver
        );

        dropzone?.removeEventListener(
            "dragleave",
            handleDragLeave
        );

        dropzone?.removeEventListener(
            "drop",
            handleDrop
        );

        gallery?.removeEventListener(
            "click",
            handleGalleryClick
        );

        gallery?.removeEventListener(
            "dragstart",
            handleCardDragStart
        );

        gallery?.removeEventListener(
            "dragover",
            handleCardDragOver
        );

        gallery?.removeEventListener(
            "drop",
            handleCardDrop
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

        initialized = false;
        processing = false;
        dragDepth = 0;

        input = null;
        dropzone = null;
        gallery = null;
        counter = null;
        status = null;

        return true;
    }

    function cacheElements() {
        input =
            root.querySelector(
                SELECTORS.INPUT
            );

        dropzone =
            root.querySelector(
                SELECTORS.DROPZONE
            );

        gallery =
            root.querySelector(
                SELECTORS.GALLERY
            );

        counter =
            root.querySelector(
                SELECTORS.COUNTER
            );

        status =
            root.querySelector(
                SELECTORS.STATUS
            );
    }

    /* ========================================================
       EVENTOS DOM
       ======================================================== */

    function bindDomEvents() {
        input?.addEventListener(
            "change",
            handleInputChange
        );

        dropzone?.addEventListener(
            "dragenter",
            handleDragEnter
        );

        dropzone?.addEventListener(
            "dragover",
            handleDragOver
        );

        dropzone?.addEventListener(
            "dragleave",
            handleDragLeave
        );

        dropzone?.addEventListener(
            "drop",
            handleDrop
        );

        gallery?.addEventListener(
            "click",
            handleGalleryClick
        );

        gallery?.addEventListener(
            "dragstart",
            handleCardDragStart
        );

        gallery?.addEventListener(
            "dragover",
            handleCardDragOver
        );

        gallery?.addEventListener(
            "drop",
            handleCardDrop
        );
    }

    async function handleInputChange(event) {
        const files =
            [
                ...(
                    event.currentTarget
                        .files ||
                    []
                )
            ];

        event.currentTarget.value =
            "";

        if (!files.length) {
            return;
        }

        await addFiles(files);
    }

    function handleDragEnter(event) {
        preventFileDrag(event);

        dragDepth += 1;

        dropzone?.classList
            .add(
                CLASSES.DRAGGING
            );
    }

    function handleDragOver(event) {
        preventFileDrag(event);

        if (
            event.dataTransfer
        ) {
            event.dataTransfer
                .dropEffect =
                "copy";
        }
    }

    function handleDragLeave(event) {
        preventFileDrag(event);

        dragDepth =
            Math.max(
                0,
                dragDepth - 1
            );

        if (dragDepth === 0) {
            dropzone?.classList
                .remove(
                    CLASSES.DRAGGING
                );
        }
    }

    async function handleDrop(event) {
        preventFileDrag(event);

        dragDepth = 0;

        dropzone?.classList
            .remove(
                CLASSES.DRAGGING
            );

        const files =
            [
                ...(
                    event.dataTransfer
                        ?.files ||
                    []
                )
            ];

        if (!files.length) {
            return;
        }

        await addFiles(files);
    }

    async function handleGalleryClick(event) {
        const actionElement =
            event.target.closest(
                SELECTORS.ACTION
            );

        if (!actionElement) {
            return;
        }

        const card =
            actionElement.closest(
                SELECTORS.PHOTO_CARD
            );

        const photoId =
            normalizeText(
                card?.dataset
                    .photoId
            );

        const action =
            normalizeText(
                actionElement.dataset
                    .photoAction
            );

        if (!photoId) {
            return;
        }

        switch (action) {
            case "primary":
                setPrimary(photoId);
                break;

            case "remove":
                await removePhoto(
                    photoId
                );
                break;

            case "move-left":
                movePhoto(
                    photoId,
                    -1
                );
                break;

            case "move-right":
                movePhoto(
                    photoId,
                    1
                );
                break;

            case "inspect":
                inspectPhoto(
                    photoId
                );
                break;

            default:
                break;
        }
    }

    function handleCardDragStart(event) {
        const card =
            event.target.closest(
                SELECTORS.PHOTO_CARD
            );

        if (
            !card ||
            !event.dataTransfer
        ) {
            return;
        }

        event.dataTransfer
            .effectAllowed =
            "move";

        event.dataTransfer
            .setData(
                "text/plain",
                card.dataset.photoId
            );
    }

    function handleCardDragOver(event) {
        const card =
            event.target.closest(
                SELECTORS.PHOTO_CARD
            );

        if (!card) {
            return;
        }

        event.preventDefault();

        if (
            event.dataTransfer
        ) {
            event.dataTransfer
                .dropEffect =
                "move";
        }
    }

    function handleCardDrop(event) {
        const targetCard =
            event.target.closest(
                SELECTORS.PHOTO_CARD
            );

        if (
            !targetCard ||
            !event.dataTransfer
        ) {
            return;
        }

        event.preventDefault();

        const sourceId =
            normalizeText(
                event.dataTransfer
                    .getData(
                        "text/plain"
                    )
            );

        const targetId =
            normalizeText(
                targetCard.dataset
                    .photoId
            );

        if (
            !sourceId ||
            !targetId ||
            sourceId === targetId
        ) {
            return;
        }

        reorderPhoto(
            sourceId,
            targetId
        );
    }

    /* ========================================================
       ALTA DE FOTOGRAFÍAS
       ======================================================== */

    async function addFiles(files) {
        if (processing) {
            return {
                added: [],
                rejected: [],
                reason:
                    "busy"
            };
        }

        const sourceFiles =
            normalizeFiles(files);

        if (!sourceFiles.length) {
            return {
                added: [],
                rejected: []
            };
        }

        processing = true;

        setLoading(
            true,
            "Procesando fotografías..."
        );

        const added = [];
        const rejected = [];

        try {
            const availableSlots =
                getAvailableSlots();

            if (availableSlots <= 0) {
                notify(
                    `El perfil ya contiene el máximo de ${getMaxFiles()} fotografías.`,
                    "warning"
                );

                return {
                    added,
                    rejected:
                        sourceFiles.map(
                            file => ({
                                file,
                                reason:
                                    "maximum-reached"
                            })
                        )
                };
            }

            const acceptedFiles =
                sourceFiles.slice(
                    0,
                    availableSlots
                );

            const overflowFiles =
                sourceFiles.slice(
                    availableSlots
                );

            overflowFiles.forEach(
                file => {
                    rejected.push({
                        file,
                        reason:
                            "maximum-reached"
                    });
                }
            );

            for (
                const file of
                acceptedFiles
            ) {
                const validation =
                    validatePhotoFile(
                        file
                    );

                if (!validation.valid) {
                    rejected.push({
                        file,
                        reason:
                            "validation",
                        errors:
                            validation.errors
                    });

                    continue;
                }

                try {
                    const photo =
                        await createPhotoRecord(
                            file
                        );

                    const stored =
                        await persistPhoto(
                            photo,
                            file
                        );

                    added.push(
                        stored || photo
                    );
                } catch (error) {
                    rejected.push({
                        file,
                        reason:
                            "processing",
                        error
                    });

                    emitError(
                        error,
                        {
                            action:
                                "add-photo",
                            filename:
                                file.name
                        }
                    );
                }
            }

            ensurePrimaryPhoto();

            render();

            if (added.length) {
                notify(
                    added.length === 1
                        ? "Fotografía añadida correctamente."
                        : `${added.length} fotografías añadidas correctamente.`,
                    "success"
                );
            }

            if (rejected.length) {
                notify(
                    buildRejectedMessage(
                        rejected
                    ),
                    "warning"
                );
            }

            emit(
                "binding:photos-added",
                {
                    added:
                        clone(added),
                    rejected:
                        serializeRejected(
                            rejected
                        )
                }
            );

            return {
                added,
                rejected
            };
        } finally {
            processing = false;

            setLoading(false);
        }
    }

    function validatePhotoFile(file) {
        if (
            window.PhotoValidation &&
            typeof PhotoValidation
                .validate ===
                "function"
        ) {
            return normalizeValidationResult(
                PhotoValidation.validate(
                    file
                )
            );
        }

        if (
            window.PhotoValidation &&
            typeof PhotoValidation
                .validateFile ===
                "function"
        ) {
            return normalizeValidationResult(
                PhotoValidation.validateFile(
                    file
                )
            );
        }

        if (
            window.Validators &&
            typeof Validators.file ===
                "function"
        ) {
            return normalizeValidationResult(
                Validators.file(
                    file,
                    {
                        allowedTypes: [
                            "image/jpeg",
                            "image/png",
                            "image/webp"
                        ],
                        maxSize:
                            15 *
                            1024 *
                            1024
                    }
                )
            );
        }

        return {
            valid: true,
            errors: []
        };
    }

    async function createPhotoRecord(
        file
    ) {
        const id =
            createId();

        const dataUrl =
            await readPhoto(file);

        const thumbnail =
            await createThumbnail(
                file,
                dataUrl
            );

        const metadata =
            await readMetadata(
                file,
                dataUrl
            );

        return {
            id,
            name:
                file.name,
            filename:
                file.name,
            type:
                file.type,
            size:
                file.size,
            extension:
                getExtension(
                    file.name
                ),
            dataUrl,
            thumbnail:
                thumbnail ||
                dataUrl,
            metadata:
                metadata || {},
            primary:
                false,
            order:
                getPhotos().length,
            createdAt:
                new Date()
                    .toISOString()
        };
    }

    async function readPhoto(file) {
        if (
            window.PhotoReader &&
            typeof PhotoReader
                .readAsDataURL ===
                "function"
        ) {
            return PhotoReader
                .readAsDataURL(file);
        }

        if (
            window.PhotoReader &&
            typeof PhotoReader
                .read ===
                "function"
        ) {
            const result =
                await PhotoReader
                    .read(file);

            return (
                result?.dataUrl ||
                result?.result ||
                result
            );
        }

        return fileToDataUrl(file);
    }

    async function createThumbnail(
        file,
        dataUrl
    ) {
        if (
            window.PhotoThumbnail &&
            typeof PhotoThumbnail
                .create ===
                "function"
        ) {
            const result =
                await PhotoThumbnail
                    .create(
                        file,
                        {
                            source:
                                dataUrl
                        }
                    );

            return (
                result?.dataUrl ||
                result?.thumbnail ||
                result
            );
        }

        if (
            window.PhotoThumbnail &&
            typeof PhotoThumbnail
                .generate ===
                "function"
        ) {
            const result =
                await PhotoThumbnail
                    .generate(
                        dataUrl
                    );

            return (
                result?.dataUrl ||
                result?.thumbnail ||
                result
            );
        }

        return dataUrl;
    }

    async function readMetadata(
        file,
        dataUrl
    ) {
        if (
            window.PhotoMetadata &&
            typeof PhotoMetadata
                .extract ===
                "function"
        ) {
            return PhotoMetadata.extract(
                file,
                {
                    source:
                        dataUrl
                }
            );
        }

        if (
            window.PhotoMetadata &&
            typeof PhotoMetadata
                .read ===
                "function"
        ) {
            return PhotoMetadata.read(
                file
            );
        }

        return {
            filename:
                file.name,
            mimeType:
                file.type,
            size:
                file.size
        };
    }

    async function persistPhoto(
        photo,
        file
    ) {
        const service =
            getPhotoService();

        if (
            typeof service.add ===
                "function"
        ) {
            return service.add(
                photo,
                file
            );
        }

        if (
            typeof service.addPhoto ===
                "function"
        ) {
            return service.addPhoto(
                photo,
                file
            );
        }

        if (
            typeof service.create ===
                "function"
        ) {
            return service.create(
                photo,
                file
            );
        }

        const profile =
            getActiveProfile();

        if (!profile) {
            throw createError(
                "PROFILE_NOT_AVAILABLE",
                "No existe un perfil activo."
            );
        }

        const updated =
            clone(profile);

        updated.photos =
            Array.isArray(
                updated.photos
            )
                ? updated.photos
                : [];

        updated.photos.push(photo);

        persistProfile(updated);

        return photo;
    }

    /* ========================================================
       FOTOGRAFÍA PRINCIPAL
       ======================================================== */

    function setPrimary(photoId) {
        const service =
            getPhotoService();

        let result;

        if (
            typeof service
                .setPrimary ===
                "function"
        ) {
            result =
                service.setPrimary(
                    photoId
                );
        } else if (
            typeof service
                .setPrimaryPhoto ===
                "function"
        ) {
            result =
                service
                    .setPrimaryPhoto(
                        photoId
                    );
        } else {
            const profile =
                getActiveProfile();

            if (!profile) {
                return false;
            }

            const updated =
                clone(profile);

            updated.photos =
                normalizePhotoArray(
                    updated.photos
                ).map(
                    photo => ({
                        ...photo,
                        primary:
                            photo.id ===
                            photoId
                    })
                );

            updated.primaryPhotoId =
                photoId;

            persistProfile(updated);

            result = true;
        }

        render();

        emit(
            "binding:photo-primary-changed",
            {
                photoId
            }
        );

        return result;
    }

    function ensurePrimaryPhoto() {
        const photos =
            getPhotos();

        if (!photos.length) {
            return false;
        }

        const primary =
            photos.find(
                photo =>
                    isPrimaryPhoto(
                        photo
                    )
            );

        if (primary) {
            return true;
        }

        setPrimary(
            photos[0].id
        );

        return true;
    }

    /* ========================================================
       ELIMINACIÓN
       ======================================================== */

    async function removePhoto(photoId) {
        const photo =
            getPhotoById(photoId);

        if (!photo) {
            return false;
        }

        let confirmed = true;

        if (
            window.UI &&
            typeof UI.confirm ===
                "function"
        ) {
            confirmed =
                await UI.confirm({
                    title:
                        "Eliminar fotografía",
                    message:
                        `Se eliminará “${photo.name || photo.filename || "la fotografía"}” del perfil.`,
                    acceptLabel:
                        "Eliminar",
                    cancelLabel:
                        "Cancelar"
                });
        }

        if (!confirmed) {
            return false;
        }

        const service =
            getPhotoService();

        if (
            typeof service.remove ===
                "function"
        ) {
            service.remove(
                photoId
            );
        } else if (
            typeof service
                .removePhoto ===
                "function"
        ) {
            service.removePhoto(
                photoId
            );
        } else {
            const profile =
                getActiveProfile();

            const updated =
                clone(profile);

            updated.photos =
                normalizePhotoArray(
                    updated.photos
                ).filter(
                    item =>
                        item.id !==
                        photoId
                );

            if (
                updated.primaryPhotoId ===
                photoId
            ) {
                updated.primaryPhotoId =
                    null;
            }

            persistProfile(updated);
        }

        ensurePrimaryPhoto();
        render();

        notify(
            "Fotografía eliminada.",
            "success"
        );

        emit(
            "binding:photo-removed",
            {
                photoId
            }
        );

        return true;
    }

    /* ========================================================
       ORDEN
       ======================================================== */

    function movePhoto(
        photoId,
        offset
    ) {
        const photos =
            getPhotos();

        const currentIndex =
            photos.findIndex(
                photo =>
                    photo.id ===
                    photoId
            );

        if (currentIndex < 0) {
            return false;
        }

        const targetIndex =
            clamp(
                currentIndex +
                Number(offset || 0),
                0,
                photos.length - 1
            );

        if (
            targetIndex ===
            currentIndex
        ) {
            return false;
        }

        return applyPhotoOrder(
            moveArrayItem(
                photos,
                currentIndex,
                targetIndex
            )
        );
    }

    function reorderPhoto(
        sourceId,
        targetId
    ) {
        const photos =
            getPhotos();

        const sourceIndex =
            photos.findIndex(
                photo =>
                    photo.id ===
                    sourceId
            );

        const targetIndex =
            photos.findIndex(
                photo =>
                    photo.id ===
                    targetId
            );

        if (
            sourceIndex < 0 ||
            targetIndex < 0
        ) {
            return false;
        }

        return applyPhotoOrder(
            moveArrayItem(
                photos,
                sourceIndex,
                targetIndex
            )
        );
    }

    function applyPhotoOrder(
        orderedPhotos
    ) {
        const normalized =
            orderedPhotos.map(
                (photo, index) => ({
                    ...photo,
                    order:
                        index
                })
            );

        const service =
            getPhotoService();

        if (
            typeof service.reorder ===
                "function"
        ) {
            service.reorder(
                normalized.map(
                    photo =>
                        photo.id
                )
            );
        } else if (
            typeof service
                .setOrder ===
                "function"
        ) {
            service.setOrder(
                normalized.map(
                    photo =>
                        photo.id
                )
            );
        } else {
            const profile =
                getActiveProfile();

            const updated =
                clone(profile);

            updated.photos =
                normalized;

            persistProfile(updated);
        }

        render();

        emit(
            "binding:photos-reordered",
            {
                order:
                    normalized.map(
                        photo =>
                            photo.id
                    )
            }
        );

        return true;
    }

    /* ========================================================
       INSPECCIÓN
       ======================================================== */

    function inspectPhoto(photoId) {
        const photo =
            getPhotoById(photoId);

        if (!photo) {
            return false;
        }

        if (
            !window.UI ||
            typeof UI.openModal !==
                "function"
        ) {
            return false;
        }

        UI.openModal({
            title:
                photo.name ||
                photo.filename ||
                "Fotografía",

            content:
                buildPhotoInspectionMarkup(
                    photo
                ),

            closeLabel:
                "Cerrar"
        });

        return true;
    }

    function buildPhotoInspectionMarkup(
        photo
    ) {
        const source =
            photo.dataUrl ||
            photo.thumbnail ||
            "";

        const metadata =
            photo.metadata || {};

        const width =
            metadata.width ||
            photo.width ||
            "—";

        const height =
            metadata.height ||
            photo.height ||
            "—";

        const size =
            formatFileSize(
                photo.size
            );

        return `
            <div class="photo-inspection">

                <img
                    class="photo-inspection__image"
                    src="${escapeAttribute(source)}"
                    alt="${escapeHtml(photo.name || photo.filename || "Fotografía")}"
                >

                <dl class="photo-inspection__metadata">

                    <div>
                        <dt>Archivo</dt>
                        <dd>${escapeHtml(photo.name || photo.filename || "—")}</dd>
                    </div>

                    <div>
                        <dt>Tipo</dt>
                        <dd>${escapeHtml(photo.type || metadata.mimeType || "—")}</dd>
                    </div>

                    <div>
                        <dt>Tamaño</dt>
                        <dd>${escapeHtml(size)}</dd>
                    </div>

                    <div>
                        <dt>Dimensiones</dt>
                        <dd>${escapeHtml(`${width} × ${height}`)}</dd>
                    </div>

                </dl>

            </div>
        `;
    }

    /* ========================================================
       RENDER
       ======================================================== */

    function render() {
        if (!gallery) {
            return;
        }

        const photos =
            getPhotos();

        renderCounter(
            photos.length
        );

        renderStatus(
            photos
        );

        if (!photos.length) {
            gallery.classList
                .add(
                    CLASSES.EMPTY
                );

            gallery.innerHTML =
                buildEmptyState();

            return;
        }

        gallery.classList
            .remove(
                CLASSES.EMPTY
            );

        gallery.innerHTML =
            photos
                .map(
                    (
                        photo,
                        index
                    ) =>
                        buildPhotoCard(
                            photo,
                            index,
                            photos.length
                        )
                )
                .join("");
    }

    function buildPhotoCard(
        photo,
        index,
        total
    ) {
        const primary =
            isPrimaryPhoto(photo);

        const source =
            photo.thumbnail ||
            photo.dataUrl ||
            "";

        const name =
            photo.name ||
            photo.filename ||
            `Fotografía ${index + 1}`;

        return `
            <article
                class="photo-card ${primary ? CLASSES.PRIMARY : ""}"
                data-photo-id="${escapeAttribute(photo.id)}"
                draggable="true"
            >

                <div class="photo-card__preview">

                    <img
                        src="${escapeAttribute(source)}"
                        alt="${escapeHtml(name)}"
                        loading="lazy"
                    >

                    ${
                        primary
                            ? `
                                <span class="photo-card__primary-badge">
                                    Principal
                                </span>
                              `
                            : ""
                    }

                    <button
                        type="button"
                        class="photo-card__inspect"
                        data-photo-action="inspect"
                        aria-label="Ampliar ${escapeAttribute(name)}"
                    >
                        Ver
                    </button>

                </div>

                <div class="photo-card__content">

                    <strong title="${escapeAttribute(name)}">
                        ${escapeHtml(name)}
                    </strong>

                    <span>
                        ${escapeHtml(formatFileSize(photo.size))}
                    </span>

                </div>

                <div class="photo-card__actions">

                    <button
                        type="button"
                        class="button button--ghost button--small"
                        data-photo-action="primary"
                        ${primary ? "disabled" : ""}
                    >
                        ${primary ? "Principal" : "Hacer principal"}
                    </button>

                    <div class="photo-card__order-actions">

                        <button
                            type="button"
                            class="icon-button"
                            data-photo-action="move-left"
                            aria-label="Mover a la izquierda"
                            ${index === 0 ? "disabled" : ""}
                        >
                            ←
                        </button>

                        <button
                            type="button"
                            class="icon-button"
                            data-photo-action="move-right"
                            aria-label="Mover a la derecha"
                            ${index === total - 1 ? "disabled" : ""}
                        >
                            →
                        </button>

                    </div>

                    <button
                        type="button"
                        class="icon-button icon-button--danger"
                        data-photo-action="remove"
                        aria-label="Eliminar ${escapeAttribute(name)}"
                    >
                        ×
                    </button>

                </div>

            </article>
        `;
    }

    function buildEmptyState() {
        return `
            <div class="empty-state">

                <strong>
                    Todavía no hay fotografías.
                </strong>

                <span>
                    Añade una fotografía frontal, una vista tres cuartos y otros ángulos útiles.
                </span>

            </div>
        `;
    }

    function renderCounter(count) {
        if (!counter) {
            return;
        }

        counter.textContent =
            `${count} / ${getMaxFiles()}`;
    }

    function renderStatus(photos) {
        if (!status) {
            return;
        }

        const primary =
            photos.find(
                isPrimaryPhoto
            );

        if (!photos.length) {
            status.textContent =
                "Sin fotografías";

            return;
        }

        if (!primary) {
            status.textContent =
                "Falta fotografía principal";

            return;
        }

        status.textContent =
            `${photos.length} fotografía${photos.length === 1 ? "" : "s"}`;
    }

    function setLoading(
        active,
        message = ""
    ) {
        dropzone?.classList
            .toggle(
                CLASSES.LOADING,
                active === true
            );

        if (input) {
            input.disabled =
                active === true;
        }

        if (
            window.UI &&
            typeof UI.setBusy ===
                "function"
        ) {
            UI.setBusy(
                active,
                message
            );
        }
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

        const events = [
            "profile:loaded",
            "profile:imported",
            "profile:photo-added",
            "profile:photo-removed",
            "profile:photos-reordered",
            "profile:primary-photo-changed"
        ];

        events.forEach(
            eventName => {
                subscriptions.push(
                    AppEvents.on(
                        eventName,
                        render
                    )
                );
            }
        );
    }

    /* ========================================================
       ACCESO A SERVICIOS
       ======================================================== */

    function getPhotoService() {
        return (
            ProfileService.photos ||
            window.ProfilePhotos ||
            {}
        );
    }

    function getPhotos() {
        const service =
            getPhotoService();

        let photos = [];

        if (
            typeof service.list ===
                "function"
        ) {
            photos =
                service.list();
        } else if (
            typeof service.getAll ===
                "function"
        ) {
            photos =
                service.getAll();
        } else if (
            typeof service.getPhotos ===
                "function"
        ) {
            photos =
                service.getPhotos();
        } else {
            const profile =
                getActiveProfile();

            photos =
                profile?.photos ||
                [];
        }

        return normalizePhotoArray(
            photos
        )
            .sort(
                (a, b) =>
                    Number(
                        a.order ?? 0
                    ) -
                    Number(
                        b.order ?? 0
                    )
            );
    }

    function getPhotoById(photoId) {
        const service =
            getPhotoService();

        if (
            typeof service.get ===
                "function"
        ) {
            return (
                service.get(
                    photoId
                ) ||
                null
            );
        }

        if (
            typeof service.getById ===
                "function"
        ) {
            return (
                service.getById(
                    photoId
                ) ||
                null
            );
        }

        return (
            getPhotos().find(
                photo =>
                    photo.id ===
                    photoId
            ) ||
            null
        );
    }

    function getActiveProfile() {
        return (
            typeof ProfileService
                .getActive ===
                "function"
                ? ProfileService
                    .getActive()
                : null
        );
    }

    function persistProfile(profile) {
        if (
            typeof ProfileService
                .update ===
                "function"
        ) {
            ProfileService.update(
                profile
            );

            return;
        }

        if (
            typeof ProfileService
                .setActive ===
                "function"
        ) {
            ProfileService.setActive(
                profile
            );

            return;
        }

        throw createError(
            "PROFILE_UPDATE_UNAVAILABLE",
            "No existe un método para actualizar el perfil."
        );
    }

    function getMaxFiles() {
        return (
            Number(
                window.AppConstants
                    ?.PHOTO
                    ?.MAX_FILES
            ) ||
            Number(
                window.AppConstants
                    ?.LIMITS
                    ?.MAX_PHOTOS
            ) ||
            DEFAULT_MAX_FILES
        );
    }

    function getAvailableSlots() {
        return Math.max(
            0,
            getMaxFiles() -
            getPhotos().length
        );
    }

    /* ========================================================
       UTILIDADES
       ======================================================== */

    function normalizeFiles(files) {
        return [
            ...(
                files ||
                []
            )
        ].filter(
            file =>
                file instanceof File
        );
    }

    function normalizePhotoArray(
        photos
    ) {
        return (
            Array.isArray(photos)
                ? photos
                : []
        )
            .filter(Boolean)
            .map(
                (photo, index) => ({
                    ...photo,
                    id:
                        normalizeText(
                            photo.id
                        ) ||
                        createId(),
                    order:
                        Number.isFinite(
                            Number(
                                photo.order
                            )
                        )
                            ? Number(
                                photo.order
                            )
                            : index
                })
            );
    }

    function isPrimaryPhoto(photo) {
        const profile =
            getActiveProfile();

        return (
            photo?.primary ===
                true ||
            profile
                ?.primaryPhotoId ===
                photo?.id
        );
    }

    function normalizeValidationResult(
        result
    ) {
        if (
            result === true
        ) {
            return {
                valid: true,
                errors: []
            };
        }

        if (
            result === false
        ) {
            return {
                valid: false,
                errors: [
                    {
                        message:
                            "El archivo no es válido."
                    }
                ]
            };
        }

        return {
            valid:
                result?.valid !==
                false,
            errors:
                Array.isArray(
                    result?.errors
                )
                    ? result.errors
                    : []
        };
    }

    function buildRejectedMessage(
        rejected
    ) {
        if (
            rejected.length === 1
        ) {
            const item =
                rejected[0];

            const message =
                item.errors?.[0]
                    ?.message;

            return (
                message ||
                `No se pudo añadir “${item.file?.name || "el archivo"}”.`
            );
        }

        return `${rejected.length} archivos no pudieron añadirse.`;
    }

    function serializeRejected(
        rejected
    ) {
        return rejected.map(
            item => ({
                filename:
                    item.file?.name ||
                    "",
                reason:
                    item.reason ||
                    "",
                errors:
                    clone(
                        item.errors ||
                        []
                    )
            })
        );
    }

    function moveArrayItem(
        array,
        fromIndex,
        toIndex
    ) {
        const copy =
            [...array];

        const [
            item
        ] =
            copy.splice(
                fromIndex,
                1
            );

        copy.splice(
            toIndex,
            0,
            item
        );

        return copy;
    }

    function preventFileDrag(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    function fileToDataUrl(file) {
        return new Promise(
            (resolve, reject) => {
                const reader =
                    new FileReader();

                reader.onload =
                    () =>
                        resolve(
                            reader.result
                        );

                reader.onerror =
                    () =>
                        reject(
                            createError(
                                "PHOTO_READ_FAILED",
                                `No se pudo leer “${file.name}”.`
                            )
                        );

                reader.readAsDataURL(
                    file
                );
            }
        );
    }

    function formatFileSize(
        bytes
    ) {
        const value =
            Number(bytes);

        if (
            !Number.isFinite(value) ||
            value < 0
        ) {
            return "—";
        }

        if (value < 1024) {
            return `${value} B`;
        }

        if (
            value <
            1024 * 1024
        ) {
            return `${(
                value /
                1024
            ).toFixed(1)} KB`;
        }

        return `${(
            value /
            1024 /
            1024
        ).toFixed(1)} MB`;
    }

    function getExtension(
        filename
    ) {
        const parts =
            normalizeText(
                filename
            ).split(".");

        return (
            parts.length > 1
                ? parts.pop()
                : ""
        ).toLowerCase();
    }

    function createId() {
        if (
            window.Helpers &&
            typeof Helpers.uuid ===
                "function"
        ) {
            return Helpers.uuid();
        }

        if (
            window.crypto &&
            typeof crypto.randomUUID ===
                "function"
        ) {
            return crypto.randomUUID();
        }

        return (
            "photo-" +
            Date.now()
                .toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    }

    function clamp(
        value,
        min,
        max
    ) {
        return Math.min(
            max,
            Math.max(
                min,
                value
            )
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
        return {
            initialized,
            processing,
            photoCount:
                getPhotos().length,
            maxFiles:
                getMaxFiles(),
            availableSlots:
                getAvailableSlots()
        };
    }

    function validateDependencies() {
        const required = [
            "ProfileService"
        ];

        const missing =
            required.filter(
                name =>
                    !window[name]
            );

        if (missing.length) {
            throw createError(
                "MISSING_PHOTOS_BINDING_DEPENDENCY",
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
            "PhotosBindingError";

        error.code = code;

        return error;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        init,
        destroy,

        addFiles,
        removePhoto,
        setPrimary,

        movePhoto,
        reorderPhoto,

        inspectPhoto,
        render,

        getState
    });

})();

window.PhotosBinding =
    PhotosBinding;
