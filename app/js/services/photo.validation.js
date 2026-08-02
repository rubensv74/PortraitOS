"use strict";

/* ============================================================
   PortraitOS
   Photo Validation Service
   ------------------------------------------------------------
   Responsabilidad:
   - Validar fotografías antes de incorporarlas al perfil.
   - No modifica el perfil.
   - No lee archivos.
   - No genera miniaturas.
   ============================================================ */

const PhotoValidation = (() => {

    /* ========================================================
       CONSTANTES
       ======================================================== */

    const MAX_PHOTOS = 12;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    const ALLOWED_TYPES = Object.freeze([
        "image/jpeg",
        "image/png",
        "image/webp"
    ]);

    const MIN_WIDTH = 600;
    const MIN_HEIGHT = 600;

    /* ========================================================
       API
       ======================================================== */

    function validateFile(file) {

        const result = checkFile(file);

        if (!result.valid) {

            throw error(
                result.errors[0].code,
                result.errors[0].message
            );

        }

        return true;

    }

    function checkFile(file) {

        const errors = [];

        if (!(file instanceof File)) {

            errors.push({
                code: "INVALID_FILE",
                message: "El elemento indicado no es un archivo válido."
            });

            return { valid: false, errors };

        }

        if (file.size <= 0) {
            errors.push({
                code: "EMPTY_FILE",
                message: "El archivo está vacío."
            });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            errors.push({
                code: "INVALID_FORMAT",
                message: "Solo se admiten JPG, PNG y WEBP."
            });
        }

        if (file.size > MAX_FILE_SIZE) {
            errors.push({
                code: "FILE_TOO_LARGE",
                message: "La fotografía supera los 10 MB."
            });
        }

        return {
            valid: errors.length === 0,
            errors
        };

    }

    function validateCollection(profile, incoming = 1) {

        if (!profile) {

            throw error(
                "INVALID_PROFILE",
                "Perfil no válido."
            );

        }

        const current =
            profile.identity?.photos?.length || 0;

        if (current + incoming > MAX_PHOTOS) {

            throw error(
                "PHOTO_LIMIT",
                `Solo se permiten ${MAX_PHOTOS} fotografías.`
            );

        }

        return true;

    }

    async function validateResolution(file) {

        validateFile(file);

        const dimensions =
            await getImageDimensions(file);

        validateDimensions(
            dimensions.width,
            dimensions.height
        );

        return dimensions;

    }

    function validateDimensions(width, height) {

        if (
            width < MIN_WIDTH ||
            height < MIN_HEIGHT
        ) {

            throw error(
                "LOW_RESOLUTION",
                `La resolución mínima es ${MIN_WIDTH}x${MIN_HEIGHT}px.`
            );

        }

        return true;

    }

    function validateType(file) {

        if (!ALLOWED_TYPES.includes(file.type)) {

            throw error(
                "INVALID_FORMAT",
                "Solo se admiten JPG, PNG y WEBP."
            );

        }

    }

    function validateSize(file) {

        if (file.size > MAX_FILE_SIZE) {

            throw error(
                "FILE_TOO_LARGE",
                "La fotografía supera los 10 MB."
            );

        }

    }

    async function getImageDimensions(file) {

        const dataUrl =
            await readAsDataURL(file);

        return new Promise((resolve, reject) => {

            const image = new Image();

            image.onload = () => {

                resolve({

                    width: image.naturalWidth,

                    height: image.naturalHeight,

                    orientation:
                        image.naturalWidth > image.naturalHeight
                            ? "landscape"
                            : image.naturalWidth < image.naturalHeight
                                ? "portrait"
                                : "square"

                });

            };

            image.onerror = () => {

                reject(
                    error(
                        "INVALID_IMAGE",
                        "No se pudo leer la imagen."
                    )
                );

            };

            image.src = dataUrl;

        });

    }

    function readAsDataURL(file) {

        return new Promise((resolve, reject) => {

            const reader = new FileReader();

            reader.onload = () =>
                resolve(reader.result);

            reader.onerror = () =>
                reject(
                    error(
                        "READ_ERROR",
                        "No se pudo leer el archivo."
                    )
                );

            reader.readAsDataURL(file);

        });

    }

    function error(code, message) {

        const e = new Error(message);

        e.name = "PhotoValidationError";

        e.code = code;

        return e;

    }

    return Object.freeze({

        validateFile,

        checkFile,

        validateCollection,

        validateResolution,

        validateDimensions,

        validateType,

        validateSize,

        constants: Object.freeze({

            MAX_PHOTOS,

            MAX_FILE_SIZE,

            MIN_WIDTH,

            MIN_HEIGHT,

            ALLOWED_TYPES

        })

    });

})();

window.PhotoValidation = PhotoValidation;
