"use strict";

/* ============================================================
   PortraitOS
   Photo Reader Service
   ------------------------------------------------------------
   Responsabilidad:
   - Leer archivos de imagen.
   - Convertir File/Blob a Data URL.
   - Convertir File/Blob a ArrayBuffer.
   - Crear objetos Image.
   - No valida reglas de negocio.
   - No modifica el perfil.
   ============================================================ */

const PhotoReader = (() => {

    /* ========================================================
       LECTURA COMO DATA URL
       ======================================================== */

    function readAsDataURL(file) {

        validateBlob(file);

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
                        "READ_DATA_URL_FAILED",
                        getReadErrorMessage(
                            file,
                            "No se pudo leer el archivo como Data URL."
                        )
                    )
                );

            };

            reader.onabort = () => {

                reject(
                    createError(
                        "READ_ABORTED",
                        getReadErrorMessage(
                            file,
                            "La lectura del archivo fue cancelada."
                        )
                    )
                );

            };

            reader.readAsDataURL(file);

        });

    }

    /* ========================================================
       LECTURA COMO TEXTO
       ======================================================== */

    function readAsText(
        file,
        encoding = "utf-8"
    ) {

        validateBlob(file);

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
                        "READ_TEXT_FAILED",
                        getReadErrorMessage(
                            file,
                            "No se pudo leer el archivo como texto."
                        )
                    )
                );

            };

            reader.onabort = () => {

                reject(
                    createError(
                        "READ_ABORTED",
                        getReadErrorMessage(
                            file,
                            "La lectura del archivo fue cancelada."
                        )
                    )
                );

            };

            reader.readAsText(
                file,
                encoding
            );

        });

    }

    /* ========================================================
       LECTURA COMO ARRAY BUFFER
       ======================================================== */

    function readAsArrayBuffer(file) {

        validateBlob(file);

        return new Promise((resolve, reject) => {

            const reader = new FileReader();

            reader.onload = () => {

                if (
                    !(reader.result instanceof ArrayBuffer)
                ) {

                    reject(
                        createError(
                            "INVALID_ARRAY_BUFFER",
                            "El resultado de lectura no es un ArrayBuffer válido."
                        )
                    );

                    return;

                }

                resolve(reader.result);

            };

            reader.onerror = () => {

                reject(
                    createError(
                        "READ_ARRAY_BUFFER_FAILED",
                        getReadErrorMessage(
                            file,
                            "No se pudo leer el archivo como ArrayBuffer."
                        )
                    )
                );

            };

            reader.onabort = () => {

                reject(
                    createError(
                        "READ_ABORTED",
                        getReadErrorMessage(
                            file,
                            "La lectura del archivo fue cancelada."
                        )
                    )
                );

            };

            reader.readAsArrayBuffer(file);

        });

    }

    /* ========================================================
       LECTURA COMO OBJECT URL
       ======================================================== */

    function createObjectURL(file) {

        validateBlob(file);

        if (
            !window.URL ||
            typeof URL.createObjectURL !== "function"
        ) {

            throw createError(
                "OBJECT_URL_UNAVAILABLE",
                "El navegador no permite crear Object URLs."
            );

        }

        return URL.createObjectURL(file);

    }

    function revokeObjectURL(url) {

        if (
            !url ||
            typeof url !== "string"
        ) {

            return false;

        }

        if (
            !window.URL ||
            typeof URL.revokeObjectURL !== "function"
        ) {

            return false;

        }

        URL.revokeObjectURL(url);

        return true;

    }

    /* ========================================================
       CREACIÓN DE IMAGE
       ======================================================== */

    async function loadImage(source) {

        const normalizedSource =
            await normalizeImageSource(source);

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

    async function normalizeImageSource(source) {

        if (
            source instanceof Blob
        ) {

            return readAsDataURL(source);

        }

        if (
            typeof source === "string" &&
            source.trim()
        ) {

            return source.trim();

        }

        throw createError(
            "INVALID_IMAGE_SOURCE",
            "La fuente de imagen no es válida."
        );

    }

    /* ========================================================
       LECTURA DE MÚLTIPLES ARCHIVOS
       ======================================================== */

    async function readManyAsDataURL(files) {

        const normalizedFiles =
            normalizeFiles(files);

        return Promise.all(
            normalizedFiles.map(
                async file => ({
                    file,
                    dataUrl:
                        await readAsDataURL(file)
                })
            )
        );

    }

    async function readManyAsArrayBuffer(files) {

        const normalizedFiles =
            normalizeFiles(files);

        return Promise.all(
            normalizedFiles.map(
                async file => ({
                    file,
                    arrayBuffer:
                        await readAsArrayBuffer(file)
                })
            )
        );

    }

    /* ========================================================
       INFORMACIÓN DEL ARCHIVO
       ======================================================== */

    function getFileInfo(file) {

        validateBlob(file);

        return {
            name:
                file instanceof File
                    ? file.name
                    : "",
            type:
                file.type || "",
            size:
                file.size || 0,
            lastModified:
                file instanceof File
                    ? file.lastModified || null
                    : null,
            extension:
                file instanceof File
                    ? getExtension(file.name)
                    : ""
        };

    }

    function getExtension(filename) {

        const value =
            String(filename || "").trim();

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

    /* ========================================================
       VALIDACIÓN INTERNA
       ======================================================== */

    function validateBlob(value) {

        if (
            !(value instanceof Blob)
        ) {

            throw createError(
                "INVALID_BLOB",
                "El valor indicado no es un archivo o Blob válido."
            );

        }

        if (
            value.size <= 0
        ) {

            throw createError(
                "EMPTY_FILE",
                "El archivo está vacío."
            );

        }

        return true;

    }

    function normalizeFiles(files) {

        const normalized =
            Array.from(files || []);

        if (!normalized.length) {

            throw createError(
                "EMPTY_FILE_COLLECTION",
                "No se han indicado archivos."
            );

        }

        normalized.forEach(validateBlob);

        return normalized;

    }

    /* ========================================================
       ERRORES
       ======================================================== */

    function getReadErrorMessage(
        file,
        fallback
    ) {

        const name =
            file instanceof File &&
            file.name
                ? ` "${file.name}"`
                : "";

        return `${fallback}${name}`;

    }

    function createError(
        code,
        message
    ) {

        const error =
            new Error(message);

        error.name =
            "PhotoReaderError";

        error.code =
            code;

        return error;

    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({

        readAsDataURL,

        readAsText,

        readAsArrayBuffer,

        createObjectURL,

        revokeObjectURL,

        loadImage,

        readManyAsDataURL,

        readManyAsArrayBuffer,

        getFileInfo,

        getExtension

    });

})();

window.PhotoReader = PhotoReader;
