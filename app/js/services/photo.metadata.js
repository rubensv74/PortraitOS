"use strict";

/* ============================================================
   PortraitOS
   Photo Metadata Service
   ------------------------------------------------------------
   Responsabilidad:
   - Extraer metadatos técnicos básicos.
   - Calcular orientación, proporción y resolución.
   - Evaluar la calidad técnica de la imagen.
   - Generar información normalizada para el perfil.
   - No modifica el perfil.
   ============================================================ */

const PhotoMetadata = (() => {

    const RESOLUTION_LEVELS = Object.freeze({
        LOW: "low",
        MEDIUM: "medium",
        HIGH: "high",
        VERY_HIGH: "very-high"
    });

    const QUALITY_LEVELS = Object.freeze({
        INSUFFICIENT: "insufficient",
        ACCEPTABLE: "acceptable",
        GOOD: "good",
        EXCELLENT: "excellent"
    });

    /* ========================================================
       API PRINCIPAL
       ======================================================== */

    async function extract(file) {
        validateFile(file);

        const image = await loadImage(file);

        const width =
            image.naturalWidth || image.width;

        const height =
            image.naturalHeight || image.height;

        validateDimensions(width, height);

        const aspectRatio =
            calculateAspectRatio(width, height);

        const orientation =
            getOrientation(width, height);

        const megapixels =
            calculateMegapixels(width, height);

        const resolutionLevel =
            getResolutionLevel(width, height);

        const quality =
            evaluateQuality(width, height);

        return {
            id: createMetadataId(file),

            file: {
                name: file.name || "",
                type: file.type || "",
                extension:
                    getExtension(file.name),
                size: file.size || 0,
                sizeFormatted:
                    formatBytes(file.size || 0),
                lastModified:
                    file.lastModified || null,
                lastModifiedIso:
                    toIsoDate(file.lastModified)
            },

            image: {
                width,
                height,
                aspectRatio,
                aspectRatioLabel:
                    getAspectRatioLabel(
                        width,
                        height
                    ),
                orientation,
                megapixels,
                resolutionLevel,
                resolutionLabel:
                    getResolutionLabel(
                        width,
                        height
                    )
            },

            quality,

            extractedAt:
                new Date().toISOString()
        };
    }

    async function extractMany(files) {
        const collection =
            normalizeFiles(files);

        return Promise.all(
            collection.map(file => extract(file))
        );
    }

    /* ========================================================
       DIMENSIONES Y PROPORCIONES
       ======================================================== */

    function calculateAspectRatio(
        width,
        height,
        precision = 3
    ) {
        validateDimensions(width, height);

        const ratio = width / height;

        return Number(
            ratio.toFixed(
                normalizePrecision(precision)
            )
        );
    }

    function getOrientation(width, height) {
        validateDimensions(width, height);

        if (width > height) {
            return "landscape";
        }

        if (height > width) {
            return "portrait";
        }

        return "square";
    }

    function calculateMegapixels(
        width,
        height,
        precision = 2
    ) {
        validateDimensions(width, height);

        const megapixels =
            (width * height) / 1000000;

        return Number(
            megapixels.toFixed(
                normalizePrecision(precision)
            )
        );
    }

    function getAspectRatioLabel(
        width,
        height
    ) {
        validateDimensions(width, height);

        const divisor =
            greatestCommonDivisor(
                Math.round(width),
                Math.round(height)
            );

        const reducedWidth =
            Math.round(width) / divisor;

        const reducedHeight =
            Math.round(height) / divisor;

        const knownRatio =
            matchKnownAspectRatio(
                width / height
            );

        if (knownRatio) {
            return knownRatio;
        }

        return `${reducedWidth}:${reducedHeight}`;
    }

    function matchKnownAspectRatio(ratio) {
        const knownRatios = [
            {
                label: "1:1",
                value: 1
            },
            {
                label: "4:5",
                value: 4 / 5
            },
            {
                label: "5:4",
                value: 5 / 4
            },
            {
                label: "3:4",
                value: 3 / 4
            },
            {
                label: "4:3",
                value: 4 / 3
            },
            {
                label: "2:3",
                value: 2 / 3
            },
            {
                label: "3:2",
                value: 3 / 2
            },
            {
                label: "9:16",
                value: 9 / 16
            },
            {
                label: "16:9",
                value: 16 / 9
            }
        ];

        const tolerance = 0.025;

        const match = knownRatios.find(
            item =>
                Math.abs(
                    item.value - ratio
                ) <= tolerance
        );

        return match
            ? match.label
            : null;
    }

    function greatestCommonDivisor(a, b) {
        let first = Math.abs(a);
        let second = Math.abs(b);

        while (second) {
            const rest = first % second;

            first = second;
            second = rest;
        }

        return first || 1;
    }

    /* ========================================================
       RESOLUCIÓN
       ======================================================== */

    function getResolutionLevel(
        width,
        height
    ) {
        validateDimensions(width, height);

        const shortestSide =
            Math.min(width, height);

        if (shortestSide < 600) {
            return RESOLUTION_LEVELS.LOW;
        }

        if (shortestSide < 1200) {
            return RESOLUTION_LEVELS.MEDIUM;
        }

        if (shortestSide < 2400) {
            return RESOLUTION_LEVELS.HIGH;
        }

        return RESOLUTION_LEVELS.VERY_HIGH;
    }

    function getResolutionLabel(
        width,
        height
    ) {
        const level =
            getResolutionLevel(
                width,
                height
            );

        const labels = {
            [RESOLUTION_LEVELS.LOW]:
                "Resolución baja",
            [RESOLUTION_LEVELS.MEDIUM]:
                "Resolución media",
            [RESOLUTION_LEVELS.HIGH]:
                "Resolución alta",
            [RESOLUTION_LEVELS.VERY_HIGH]:
                "Resolución muy alta"
        };

        return labels[level];
    }

    /* ========================================================
       EVALUACIÓN TÉCNICA
       ======================================================== */

    function evaluateQuality(
        width,
        height
    ) {
        validateDimensions(width, height);

        const shortestSide =
            Math.min(width, height);

        const megapixels =
            calculateMegapixels(
                width,
                height
            );

        let level;
        let score;
        let message;

        if (
            shortestSide < 600 ||
            megapixels < 0.5
        ) {
            level =
                QUALITY_LEVELS.INSUFFICIENT;

            score = 25;

            message =
                "La imagen tiene una resolución insuficiente para un análisis fiable.";
        } else if (
            shortestSide < 1200 ||
            megapixels < 2
        ) {
            level =
                QUALITY_LEVELS.ACCEPTABLE;

            score = 55;

            message =
                "La imagen puede utilizarse, aunque conviene aportar una versión de mayor resolución.";
        } else if (
            shortestSide < 2400 ||
            megapixels < 8
        ) {
            level =
                QUALITY_LEVELS.GOOD;

            score = 80;

            message =
                "La imagen tiene una calidad técnica adecuada para el análisis de identidad.";
        } else {
            level =
                QUALITY_LEVELS.EXCELLENT;

            score = 100;

            message =
                "La imagen tiene una resolución excelente para el análisis detallado.";
        }

        return {
            level,
            score,
            message,
            suitableForIdentity:
                level !==
                QUALITY_LEVELS.INSUFFICIENT,
            suitableForThumbnail: true
        };
    }

    /* ========================================================
       LECTURA DE IMAGEN
       ======================================================== */

    async function loadImage(source) {
        if (
            window.PhotoReader &&
            typeof PhotoReader.loadImage ===
                "function"
        ) {
            return PhotoReader.loadImage(source);
        }

        const dataUrl =
            await readAsDataURL(source);

        return new Promise(
            (resolve, reject) => {
                const image =
                    new Image();

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

                image.src = dataUrl;
            }
        );
    }

    function readAsDataURL(file) {
        return new Promise(
            (resolve, reject) => {
                const reader =
                    new FileReader();

                reader.onload = () => {
                    resolve(
                        String(
                            reader.result || ""
                        )
                    );
                };

                reader.onerror = () => {
                    reject(
                        createError(
                            "FILE_READ_FAILED",
                            "No se pudo leer el archivo."
                        )
                    );
                };

                reader.onabort = () => {
                    reject(
                        createError(
                            "FILE_READ_ABORTED",
                            "La lectura del archivo fue cancelada."
                        )
                    );
                };

                reader.readAsDataURL(file);
            }
        );
    }

    /* ========================================================
       INFORMACIÓN DEL ARCHIVO
       ======================================================== */

    function getExtension(filename) {
        const value =
            String(filename || "")
                .trim();

        const index =
            value.lastIndexOf(".");

        if (
            index < 0 ||
            index === value.length - 1
        ) {
            return "";
        }

        return value
            .slice(index + 1)
            .toLowerCase();
    }

    function formatBytes(
        bytes,
        decimals = 2
    ) {
        const value =
            Number(bytes);

        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {
            return "0 B";
        }

        const units = [
            "B",
            "KB",
            "MB",
            "GB"
        ];

        const index = Math.min(
            Math.floor(
                Math.log(value) /
                Math.log(1024)
            ),
            units.length - 1
        );

        const amount =
            value /
            Math.pow(1024, index);

        return `${amount.toFixed(
            normalizePrecision(decimals)
        )} ${units[index]}`;
    }

    function toIsoDate(timestamp) {
        if (!timestamp) {
            return null;
        }

        const date =
            new Date(timestamp);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return null;
        }

        return date.toISOString();
    }

    function createMetadataId(file) {
        const source = [
            file.name || "photo",
            file.size || 0,
            file.lastModified || 0
        ].join("-");

        return `photo-meta-${hashString(source)}`;
    }

    function hashString(value) {
        let hash = 0;

        for (
            let index = 0;
            index < value.length;
            index += 1
        ) {
            hash =
                (
                    (hash << 5) -
                    hash
                ) +
                value.charCodeAt(index);

            hash |= 0;
        }

        return Math.abs(hash)
            .toString(36);
    }

    /* ========================================================
       VALIDACIÓN INTERNA
       ======================================================== */

    function validateFile(file) {
        if (
            !(file instanceof File)
        ) {
            throw createError(
                "INVALID_FILE",
                "El elemento indicado no es un archivo válido."
            );
        }

        if (
            !file.type ||
            !file.type.startsWith("image/")
        ) {
            throw createError(
                "INVALID_IMAGE_TYPE",
                "El archivo indicado no es una imagen."
            );
        }

        if (file.size <= 0) {
            throw createError(
                "EMPTY_FILE",
                "El archivo está vacío."
            );
        }

        return true;
    }

    function normalizeFiles(files) {
        const collection =
            Array.from(files || []);

        if (!collection.length) {
            throw createError(
                "EMPTY_COLLECTION",
                "No se han indicado fotografías."
            );
        }

        collection.forEach(
            validateFile
        );

        return collection;
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

        return true;
    }

    function normalizePrecision(
        value
    ) {
        const numeric =
            Number(value);

        if (
            !Number.isInteger(numeric) ||
            numeric < 0
        ) {
            return 2;
        }

        return Math.min(
            numeric,
            6
        );
    }

    /* ========================================================
       ERRORES
       ======================================================== */

    function createError(
        code,
        message
    ) {
        const error =
            new Error(message);

        error.name =
            "PhotoMetadataError";

        error.code = code;

        return error;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        extract,
        extractMany,

        calculateAspectRatio,
        calculateMegapixels,

        getOrientation,
        getAspectRatioLabel,
        getResolutionLevel,
        getResolutionLabel,

        evaluateQuality,
        formatBytes,

        constants: Object.freeze({
            RESOLUTION_LEVELS,
            QUALITY_LEVELS
        })
    });

})();

window.PhotoMetadata = PhotoMetadata;
