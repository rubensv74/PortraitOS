"use strict";

/* ============================================================
   PortraitOS
   Validators Utility
   ------------------------------------------------------------
   Responsabilidad:
   - Centralizar validaciones genéricas.
   - Proporcionar resultados consistentes.
   - Evitar duplicación entre formularios y servicios.
   - No contener lógica específica del dominio PortraitOS.
   ============================================================ */

const Validators = (() => {

    const RESULT_STATUS = Object.freeze({
        VALID:
            "valid",

        INVALID:
            "invalid"
    });

    /* ========================================================
       RESULTADOS
       ======================================================== */

    function valid(
        value = null,
        metadata = {}
    ) {
        return {
            valid: true,
            status:
                RESULT_STATUS.VALID,
            value,
            errors: [],
            metadata:
                normalizeMetadata(metadata)
        };
    }

    function invalid(
        errors,
        value = null,
        metadata = {}
    ) {
        return {
            valid: false,
            status:
                RESULT_STATUS.INVALID,
            value,
            errors:
                normalizeErrors(errors),
            metadata:
                normalizeMetadata(metadata)
        };
    }

    function combine(results) {
        const list =
            Array.isArray(results)
                ? results
                : [];

        const errors =
            list.flatMap(
                result =>
                    Array.isArray(
                        result?.errors
                    )
                        ? result.errors
                        : []
            );

        return {
            valid:
                errors.length === 0,

            status:
                errors.length === 0
                    ? RESULT_STATUS.VALID
                    : RESULT_STATUS.INVALID,

            errors,

            results:
                list
        };
    }

    /* ========================================================
       REQUERIDOS
       ======================================================== */

    function required(
        value,
        options = {}
    ) {
        const label =
            normalizeLabel(
                options.label
            );

        if (isMissing(value)) {
            return invalid({
                code:
                    "REQUIRED",

                field:
                    options.field || "",

                message:
                    `${label} es obligatorio.`
            });
        }

        return valid(value);
    }

    function requiredText(
        value,
        options = {}
    ) {
        const requiredResult =
            required(
                value,
                options
            );

        if (!requiredResult.valid) {
            return requiredResult;
        }

        const normalized =
            normalizeText(value);

        if (!normalized) {
            return invalid({
                code:
                    "REQUIRED_TEXT",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} debe contener texto.`
            });
        }

        return valid(normalized);
    }

    /* ========================================================
       TEXTO
       ======================================================== */

    function textLength(
        value,
        options = {}
    ) {
        const text =
            normalizeText(value);

        const min =
            normalizeNumber(
                options.min,
                0
            );

        const max =
            normalizeNumber(
                options.max,
                Infinity
            );

        const errors = [];

        if (
            text.length < min
        ) {
            errors.push({
                code:
                    "TEXT_TOO_SHORT",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} debe tener al menos ${min} caracteres.`,

                expected:
                    min,

                actual:
                    text.length
            });
        }

        if (
            text.length > max
        ) {
            errors.push({
                code:
                    "TEXT_TOO_LONG",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} no puede superar ${max} caracteres.`,

                expected:
                    max,

                actual:
                    text.length
            });
        }

        return errors.length
            ? invalid(
                errors,
                text
            )
            : valid(text);
    }

    function matches(
        value,
        pattern,
        options = {}
    ) {
        const text =
            normalizeText(value);

        if (
            !(pattern instanceof RegExp)
        ) {
            throw createError(
                "INVALID_PATTERN",
                "El patrón debe ser una expresión regular."
            );
        }

        if (!pattern.test(text)) {
            return invalid({
                code:
                    "PATTERN_MISMATCH",

                field:
                    options.field || "",

                message:
                    normalizeText(
                        options.message
                    ) ||
                    `${normalizeLabel(options.label)} no tiene un formato válido.`
            });
        }

        return valid(text);
    }

    function email(
        value,
        options = {}
    ) {
        const text =
            normalizeText(value);

        const pattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
            options.optional === true &&
            !text
        ) {
            return valid("");
        }

        if (!pattern.test(text)) {
            return invalid({
                code:
                    "INVALID_EMAIL",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label || "El correo electrónico")} no es válido.`
            });
        }

        return valid(text);
    }

    function slug(
        value,
        options = {}
    ) {
        const text =
            normalizeText(value);

        const pattern =
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

        if (!pattern.test(text)) {
            return invalid({
                code:
                    "INVALID_SLUG",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} debe contener letras minúsculas, números y guiones.`
            });
        }

        return valid(text);
    }

    /* ========================================================
       NÚMEROS
       ======================================================== */

    function number(
        value,
        options = {}
    ) {
        const numeric =
            Number(value);

        if (
            !Number.isFinite(numeric)
        ) {
            return invalid({
                code:
                    "INVALID_NUMBER",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} debe ser un número válido.`
            });
        }

        const errors = [];

        if (
            Number.isFinite(
                Number(options.min)
            ) &&
            numeric <
            Number(options.min)
        ) {
            errors.push({
                code:
                    "NUMBER_TOO_LOW",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} no puede ser menor que ${options.min}.`,

                expected:
                    Number(options.min),

                actual:
                    numeric
            });
        }

        if (
            Number.isFinite(
                Number(options.max)
            ) &&
            numeric >
            Number(options.max)
        ) {
            errors.push({
                code:
                    "NUMBER_TOO_HIGH",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} no puede ser mayor que ${options.max}.`,

                expected:
                    Number(options.max),

                actual:
                    numeric
            });
        }

        if (
            options.integer === true &&
            !Number.isInteger(
                numeric
            )
        ) {
            errors.push({
                code:
                    "INTEGER_REQUIRED",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} debe ser un número entero.`
            });
        }

        return errors.length
            ? invalid(
                errors,
                numeric
            )
            : valid(numeric);
    }

    function percentage(
        value,
        options = {}
    ) {
        return number(
            value,
            {
                ...options,
                min:
                    options.min ?? 0,
                max:
                    options.max ?? 100
            }
        );
    }

    /* ========================================================
       ARRAYS
       ======================================================== */

    function array(
        value,
        options = {}
    ) {
        if (
            !Array.isArray(value)
        ) {
            return invalid({
                code:
                    "ARRAY_REQUIRED",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} debe ser una lista.`
            });
        }

        const min =
            normalizeNumber(
                options.min,
                0
            );

        const max =
            normalizeNumber(
                options.max,
                Infinity
            );

        const errors = [];

        if (
            value.length < min
        ) {
            errors.push({
                code:
                    "ARRAY_TOO_SHORT",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} debe contener al menos ${min} elementos.`,

                expected:
                    min,

                actual:
                    value.length
            });
        }

        if (
            value.length > max
        ) {
            errors.push({
                code:
                    "ARRAY_TOO_LONG",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} no puede contener más de ${max} elementos.`,

                expected:
                    max,

                actual:
                    value.length
            });
        }

        return errors.length
            ? invalid(
                errors,
                value
            )
            : valid(value);
    }

    function uniqueArray(
        value,
        options = {}
    ) {
        const arrayResult =
            array(
                value,
                options
            );

        if (!arrayResult.valid) {
            return arrayResult;
        }

        const normalized =
            value.map(
                item =>
                    options.caseSensitive ===
                    true
                        ? normalizeText(item)
                        : normalizeText(item)
                            .toLowerCase()
            );

        const duplicates =
            normalized.filter(
                (item, index) =>
                    normalized.indexOf(
                        item
                    ) !== index
            );

        if (duplicates.length) {
            return invalid({
                code:
                    "DUPLICATE_VALUES",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} contiene valores duplicados.`,

                values:
                    [
                        ...new Set(
                            duplicates
                        )
                    ]
            });
        }

        return valid(value);
    }

    function valuesInSet(
        value,
        allowedValues,
        options = {}
    ) {
        const list =
            Array.isArray(value)
                ? value
                : [value];

        const allowed =
            Array.isArray(
                allowedValues
            )
                ? allowedValues
                : [];

        const invalidValues =
            list.filter(
                item =>
                    !allowed.includes(
                        item
                    )
            );

        if (invalidValues.length) {
            return invalid({
                code:
                    "VALUE_NOT_ALLOWED",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} contiene valores no permitidos.`,

                values:
                    invalidValues
            });
        }

        return valid(value);
    }

    /* ========================================================
       OBJETOS
       ======================================================== */

    function object(
        value,
        options = {}
    ) {
        if (
            !value ||
            typeof value !==
                "object" ||
            Array.isArray(value)
        ) {
            return invalid({
                code:
                    "OBJECT_REQUIRED",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} debe ser un objeto válido.`
            });
        }

        return valid(value);
    }

    function hasFields(
        value,
        fields,
        options = {}
    ) {
        const objectResult =
            object(
                value,
                options
            );

        if (!objectResult.valid) {
            return objectResult;
        }

        const requiredFields =
            Array.isArray(fields)
                ? fields
                : [];

        const missingFields =
            requiredFields.filter(
                field =>
                    !Object.prototype
                        .hasOwnProperty
                        .call(
                            value,
                            field
                        )
            );

        if (missingFields.length) {
            return invalid({
                code:
                    "MISSING_FIELDS",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} no contiene todos los campos obligatorios.`,

                fields:
                    missingFields
            });
        }

        return valid(value);
    }

    /* ========================================================
       ARCHIVOS
       ======================================================== */

    function file(
        value,
        options = {}
    ) {
        if (
            !(value instanceof File)
        ) {
            return invalid({
                code:
                    "FILE_REQUIRED",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label || "El archivo")} no es válido.`
            });
        }

        const errors = [];

        const allowedTypes =
            Array.isArray(
                options.allowedTypes
            )
                ? options.allowedTypes
                : [];

        const allowedExtensions =
            Array.isArray(
                options.allowedExtensions
            )
                ? options.allowedExtensions
                : [];

        const maxSize =
            normalizeNumber(
                options.maxSize,
                Infinity
            );

        if (
            allowedTypes.length &&
            !allowedTypes.includes(
                value.type
            )
        ) {
            errors.push({
                code:
                    "FILE_TYPE_NOT_ALLOWED",

                field:
                    options.field || "",

                message:
                    "El tipo de archivo no está permitido.",

                actual:
                    value.type,

                allowed:
                    allowedTypes
            });
        }

        if (
            allowedExtensions.length
        ) {
            const extension =
                getExtension(
                    value.name
                );

            if (
                !allowedExtensions.includes(
                    extension
                )
            ) {
                errors.push({
                    code:
                        "FILE_EXTENSION_NOT_ALLOWED",

                    field:
                        options.field || "",

                    message:
                        "La extensión del archivo no está permitida.",

                    actual:
                        extension,

                    allowed:
                        allowedExtensions
                });
            }
        }

        if (
            value.size > maxSize
        ) {
            errors.push({
                code:
                    "FILE_TOO_LARGE",

                field:
                    options.field || "",

                message:
                    `El archivo supera el tamaño máximo permitido.`,

                expected:
                    maxSize,

                actual:
                    value.size
            });
        }

        return errors.length
            ? invalid(
                errors,
                value
            )
            : valid(value);
    }

    /* ========================================================
       FECHAS
       ======================================================== */

    function date(
        value,
        options = {}
    ) {
        const parsed =
            new Date(value);

        if (
            Number.isNaN(
                parsed.getTime()
            )
        ) {
            return invalid({
                code:
                    "INVALID_DATE",

                field:
                    options.field || "",

                message:
                    `${normalizeLabel(options.label)} no es una fecha válida.`
            });
        }

        const errors = [];

        if (options.min) {
            const min =
                new Date(
                    options.min
                );

            if (
                parsed < min
            ) {
                errors.push({
                    code:
                        "DATE_TOO_EARLY",

                    field:
                        options.field || "",

                    message:
                        `${normalizeLabel(options.label)} no puede ser anterior a la fecha mínima.`,

                    expected:
                        min.toISOString(),

                    actual:
                        parsed.toISOString()
                });
            }
        }

        if (options.max) {
            const max =
                new Date(
                    options.max
                );

            if (
                parsed > max
            ) {
                errors.push({
                    code:
                        "DATE_TOO_LATE",

                    field:
                        options.field || "",

                    message:
                        `${normalizeLabel(options.label)} no puede ser posterior a la fecha máxima.`,

                    expected:
                        max.toISOString(),

                    actual:
                        parsed.toISOString()
                });
            }
        }

        return errors.length
            ? invalid(
                errors,
                parsed
            )
            : valid(parsed);
    }

    /* ========================================================
       ESQUEMAS
       ======================================================== */

    function schema(
        value,
        rules,
        options = {}
    ) {
        const objectResult =
            object(
                value,
                options
            );

        if (!objectResult.valid) {
            return objectResult;
        }

        const errors = [];

        Object.entries(
            rules || {}
        ).forEach(
            ([field, validator]) => {
                if (
                    typeof validator !==
                    "function"
                ) {
                    return;
                }

                const result =
                    validator(
                        value[field],
                        field,
                        value
                    );

                if (
                    result &&
                    result.valid === false
                ) {
                    errors.push(
                        ...normalizeErrors(
                            result.errors
                        )
                    );
                }
            }
        );

        return errors.length
            ? invalid(
                errors,
                value
            )
            : valid(value);
    }

    /* ========================================================
       ASERCIONES
       ======================================================== */

    function assert(
        result,
        options = {}
    ) {
        if (
            !result ||
            result.valid !== true
        ) {
            const errors =
                normalizeErrors(
                    result?.errors
                );

            const message =
                normalizeText(
                    options.message
                ) ||
                errors
                    .map(
                        error =>
                            error.message
                    )
                    .filter(Boolean)
                    .join(" ") ||
                "La validación ha fallado.";

            const error =
                createError(
                    options.code ||
                    "VALIDATION_FAILED",
                    message
                );

            error.validationErrors =
                errors;

            throw error;
        }

        return result.value;
    }

    /* ========================================================
       UTILIDADES INTERNAS
       ======================================================== */

    function isMissing(value) {
        return (
            value === null ||
            value === undefined ||
            (
                typeof value ===
                    "string" &&
                normalizeText(value) ===
                    ""
            ) ||
            (
                Array.isArray(value) &&
                value.length === 0
            )
        );
    }

    function normalizeErrors(errors) {
        const list =
            Array.isArray(errors)
                ? errors
                : errors
                    ? [errors]
                    : [];

        return list.map(
            error => {
                if (
                    typeof error ===
                    "string"
                ) {
                    return {
                        code:
                            "VALIDATION_ERROR",
                        field:
                            "",
                        message:
                            error
                    };
                }

                return {
                    code:
                        normalizeText(
                            error.code
                        ) ||
                        "VALIDATION_ERROR",

                    field:
                        normalizeText(
                            error.field
                        ),

                    message:
                        normalizeText(
                            error.message
                        ) ||
                        "El valor no es válido.",

                    ...error
                };
            }
        );
    }

    function normalizeMetadata(
        value
    ) {
        return (
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
        )
            ? value
            : {};
    }

    function normalizeLabel(
        value
    ) {
        return (
            normalizeText(value) ||
            "El campo"
        );
    }

    function normalizeText(value) {
        return String(value ?? "")
            .trim();
    }

    function normalizeNumber(
        value,
        fallback
    ) {
        const numeric =
            Number(value);

        return Number.isFinite(
            numeric
        )
            ? numeric
            : fallback;
    }

    function getExtension(
        filename
    ) {
        const parts =
            normalizeText(filename)
                .toLowerCase()
                .split(".");

        return parts.length > 1
            ? parts.pop()
            : "";
    }

    function createError(
        code,
        message
    ) {
        const error =
            new Error(message);

        error.name =
            "ValidatorsError";

        error.code = code;

        return error;
    }

    /* ========================================================
       API PÚBLICA
       ======================================================== */

    return Object.freeze({
        valid,
        invalid,
        combine,

        required,
        requiredText,

        textLength,
        matches,
        email,
        slug,

        number,
        percentage,

        array,
        uniqueArray,
        valuesInSet,

        object,
        hasFields,

        file,
        date,
        schema,

        assert,

        constants:
            Object.freeze({
                RESULT_STATUS
            })
    });

})();

window.Validators = Validators;
