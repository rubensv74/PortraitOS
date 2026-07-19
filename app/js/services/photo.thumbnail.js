"use strict";

/* ============================================================
   PortraitOS
   Photo Thumbnail Service
   ------------------------------------------------------------
   Responsabilidad:
   - Generar miniaturas.
   - Redimensionar imágenes.
   - Mantener proporciones.
   - Exportar Data URL o Blob.
   - No modifica el perfil.
   ============================================================ */

const PhotoThumbnail = (() => {

    const DEFAULT_OPTIONS = Object.freeze({
        maxWidth: 480,
        maxHeight: 480,
        mimeType: "image/jpeg",
        quality: 0.86,
        backgroundColor: "#ffffff",
        allowUpscale: false
    });

    async function create(source, options = {}) {
        const config = normalizeOptions(options);

        const image = await loadImage(source);

        const dimensions = calculateDimensions(
            image.naturalWidth || image.width,
            image.naturalHeight || image.height,
            config.maxWidth,
            config.maxHeight,
            config.allowUpscale
        );

        const canvas = createCanvas(
            dimensions.width,
            dimensions.height
        );

        const context = getContext(canvas);

        paintBackground(
            context,
            canvas,
            config.backgroundColor,
            config.mimeType
        );

        context.drawImage(
            image,
            0,
            0,
            dimensions.width,
            dimensions.height
        );

        return canvas.toDataURL(
            config.mimeType,
            config.quality
        );
    }

    async function createBlob(source, options = {}) {
        const config = normalizeOptions(options);

        const image = await loadImage(source);

        const dimensions = calculateDimensions(
            image.naturalWidth || image.width,
            image.naturalHeight || image.height,
            config.maxWidth,
            config.maxHeight,
            config.allowUpscale
        );

        const canvas = createCanvas(
            dimensions.width,
            dimensions.height
        );

        const context = getContext(canvas);

        paintBackground(
            context,
            canvas,
            config.backgroundColor,
            config.mimeType
        );

        context.drawImage(
            image,
            0,
            0,
            dimensions.width,
            dimensions.height
        );

        return canvasToBlob(
            canvas,
            config.mimeType,
            config.quality
        );
    }

    async function createSquare(
        source,
        size = 480,
        options = {}
    ) {
        const config = normalizeOptions({
            ...options,
            maxWidth: size,
            maxHeight: size
        });

        const image = await loadImage(source);

        const sourceWidth =
            image.naturalWidth || image.width;

        const sourceHeight =
            image.naturalHeight || image.height;

        const crop = calculateSquareCrop(
            sourceWidth,
            sourceHeight
        );

        const canvas = createCanvas(
            size,
            size
        );

        const context = getContext(canvas);

        paintBackground(
            context,
            canvas,
            config.backgroundColor,
            config.mimeType
        );

        context.drawImage(
            image,
            crop.x,
            crop.y,
            crop.size,
            crop.size,
            0,
            0,
            size,
            size
        );

        return canvas.toDataURL(
            config.mimeType,
            config.quality
        );
    }

    async function createSquareBlob(
        source,
        size = 480,
        options = {}
    ) {
        const config = normalizeOptions({
            ...options,
            maxWidth: size,
            maxHeight: size
        });

        const image = await loadImage(source);

        const sourceWidth =
            image.naturalWidth || image.width;

        const sourceHeight =
            image.naturalHeight || image.height;

        const crop = calculateSquareCrop(
            sourceWidth,
            sourceHeight
        );

        const canvas = createCanvas(
            size,
            size
        );

        const context = getContext(canvas);

        paintBackground(
            context,
            canvas,
            config.backgroundColor,
            config.mimeType
        );

        context.drawImage(
            image,
            crop.x,
            crop.y,
            crop.size,
            crop.size,
            0,
            0,
            size,
            size
        );

        return canvasToBlob(
            canvas,
            config.mimeType,
            config.quality
        );
    }

    function calculateDimensions(
        sourceWidth,
        sourceHeight,
        maxWidth,
        maxHeight,
        allowUpscale = false
    ) {
        validateDimensions(
            sourceWidth,
            sourceHeight
        );

        const widthRatio =
            maxWidth / sourceWidth;

        const heightRatio =
            maxHeight / sourceHeight;

        let ratio = Math.min(
            widthRatio,
            heightRatio
        );

        if (!allowUpscale) {
            ratio = Math.min(ratio, 1);
        }

        return {
            width: Math.max(
                1,
                Math.round(sourceWidth * ratio)
            ),
            height: Math.max(
                1,
                Math.round(sourceHeight * ratio)
            ),
            ratio
        };
    }

    function calculateSquareCrop(
        sourceWidth,
        sourceHeight
    ) {
        validateDimensions(
            sourceWidth,
            sourceHeight
        );

        const size = Math.min(
            sourceWidth,
            sourceHeight
        );

        return {
            x: Math.max(
                0,
                Math.round(
                    (sourceWidth - size) / 2
                )
            ),
            y: Math.max(
                0,
                Math.round(
                    (sourceHeight - size) / 2
                )
            ),
            size
        };
    }

    async function loadImage(source) {
        if (
            window.PhotoReader &&
            typeof PhotoReader.loadImage ===
                "function"
        ) {
            return PhotoReader.loadImage(source);
        }

        const normalizedSource =
            await normalizeSource(source);

        return new Promise((resolve, reject) => {
            const image = new Image();

            image.onload = () => {
                resolve(image);
            };

            image.onerror = () => {
                reject(
                    createError(
                        "IMAGE_LOAD_FAILED",
                        "No se pudo cargar la imagen."
                    )
                );
            };

            image.src = normalizedSource;
        });
    }

    async function normalizeSource(source) {
        if (source instanceof Blob) {
            return readAsDataURL(source);
        }

        if (
            typeof source === "string" &&
            source.trim()
        ) {
            return source.trim();
        }

        throw createError(
            "INVALID_SOURCE",
            "La fuente de imagen no es válida."
        );
    }

    function readAsDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                resolve(
                    String(reader.result || "")
                );
            };

            reader.onerror = () => {
                reject(
                    createError(
                        "READ_FAILED",
                        "No se pudo leer la imagen."
                    )
                );
            };

            reader.readAsDataURL(blob);
        });
    }

    function normalizeOptions(options) {
        const source =
            options &&
            typeof options === "object"
                ? options
                : {};

        const maxWidth = normalizePositiveInteger(
            source.maxWidth,
            DEFAULT_OPTIONS.maxWidth
        );

        const maxHeight = normalizePositiveInteger(
            source.maxHeight,
            DEFAULT_OPTIONS.maxHeight
        );

        const mimeType = normalizeMimeType(
            source.mimeType ||
            DEFAULT_OPTIONS.mimeType
        );

        const quality = normalizeQuality(
            source.quality
        );

        return {
            maxWidth,
            maxHeight,
            mimeType,
            quality,
            backgroundColor:
                normalizeColor(
                    source.backgroundColor ||
                    DEFAULT_OPTIONS.backgroundColor
                ),
            allowUpscale:
                Boolean(source.allowUpscale)
        };
    }

    function normalizePositiveInteger(
        value,
        fallback
    ) {
        const numeric = Number(value);

        if (
            !Number.isFinite(numeric) ||
            numeric <= 0
        ) {
            return fallback;
        }

        return Math.round(numeric);
    }

    function normalizeQuality(value) {
        const numeric = Number(value);

        if (!Number.isFinite(numeric)) {
            return DEFAULT_OPTIONS.quality;
        }

        return Math.min(
            1,
            Math.max(0, numeric)
        );
    }

    function normalizeMimeType(value) {
        const mimeType =
            String(value || "")
                .trim()
                .toLowerCase();

        const supported = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        return supported.includes(mimeType)
            ? mimeType
            : DEFAULT_OPTIONS.mimeType;
    }

    function normalizeColor(value) {
        const color =
            String(value || "").trim();

        return color ||
            DEFAULT_OPTIONS.backgroundColor;
    }

    function createCanvas(width, height) {
        const canvas =
            document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        return canvas;
    }

    function getContext(canvas) {
        const context = canvas.getContext(
            "2d",
            {
                alpha: false
            }
        );

        if (!context) {
            throw createError(
                "CANVAS_CONTEXT_UNAVAILABLE",
                "No se pudo obtener el contexto de dibujo."
            );
        }

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        return context;
    }

    function paintBackground(
        context,
        canvas,
        backgroundColor,
        mimeType
    ) {
        if (mimeType === "image/png") {
            context.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

            return;
        }

        context.fillStyle = backgroundColor;

        context.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );
    }

    function canvasToBlob(
        canvas,
        mimeType,
        quality
    ) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                blob => {
                    if (!blob) {
                        reject(
                            createError(
                                "BLOB_CREATION_FAILED",
                                "No se pudo generar la miniatura."
                            )
                        );

                        return;
                    }

                    resolve(blob);
                },
                mimeType,
                quality
            );
        });
    }

    function validateDimensions(
        width,
        height
    ) {
        if (
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) {
            throw createError(
                "INVALID_DIMENSIONS",
                "Las dimensiones de la imagen no son válidas."
            );
        }
    }

    function createError(code, message) {
        const error = new Error(message);

        error.name = "PhotoThumbnailError";
        error.code = code;

        return error;
    }

    return Object.freeze({
        create,
        createBlob,
        createSquare,
        createSquareBlob,
        calculateDimensions,
        calculateSquareCrop,

        defaults: DEFAULT_OPTIONS
    });

})();

window.PhotoThumbnail = PhotoThumbnail;
