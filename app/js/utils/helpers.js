"use strict";

/* ============================================================
   PortraitOS
   Helpers Utility
   ------------------------------------------------------------
   Funciones auxiliares compartidas por toda la aplicación.
   No contienen lógica de negocio.
   ============================================================ */

const Helpers = (() => {

    /* ========================================================
       TEXTO
       ======================================================== */

    function normalizeText(value) {
        return String(value ?? "").trim();
    }

    function isEmpty(value) {
        return normalizeText(value) === "";
    }

    function capitalize(text) {
        text = normalizeText(text);

        if (!text) return "";

        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    function titleCase(text) {

        return normalizeText(text)
            .toLowerCase()
            .split(" ")
            .map(capitalize)
            .join(" ");

    }

    function slugify(text) {

        return normalizeText(text)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
            .toLowerCase();

    }

    /* ========================================================
       ARRAYS
       ======================================================== */

    function unique(array) {

        if (!Array.isArray(array))
            return [];

        return [...new Set(array)];

    }

    function ensureArray(value) {

        if (Array.isArray(value))
            return value;

        if (
            value === null ||
            value === undefined
        )
            return [];

        return [value];

    }

    function moveItem(
        array,
        from,
        to
    ) {

        const copy = [...array];

        const item =
            copy.splice(from, 1)[0];

        copy.splice(
            to,
            0,
            item
        );

        return copy;

    }

    /* ========================================================
       OBJETOS
       ======================================================== */

    function deepClone(value) {

        if (
            typeof structuredClone ===
            "function"
        ) {
            return structuredClone(value);
        }

        return JSON.parse(
            JSON.stringify(value)
        );

    }

    function deepMerge(
        target,
        source
    ) {

        const output =
            deepClone(target);

        Object.keys(source).forEach(
            key => {

                if (
                    isObject(source[key])
                ) {

                    if (
                        !output[key]
                    ) {
                        output[key] = {};
                    }

                    output[key] =
                        deepMerge(
                            output[key],
                            source[key]
                        );

                } else {

                    output[key] =
                        source[key];

                }

            });

        return output;

    }

    function isObject(value) {

        return (
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
        );

    }

    /* ========================================================
       IDs
       ======================================================== */

    function uuid() {

        if (
            crypto &&
            crypto.randomUUID
        ) {
            return crypto.randomUUID();
        }

        return (
            Date.now().toString(36) +
            Math.random()
                .toString(36)
                .substring(2)
        );

    }

    /* ========================================================
       FECHAS
       ======================================================== */

    function nowIso() {

        return new Date().toISOString();

    }

    function formatDate(date) {

        return new Intl.DateTimeFormat(
            "es-ES",
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        ).format(
            new Date(date)
        );

    }

    /* ========================================================
       NÚMEROS
       ======================================================== */

    function clamp(
        value,
        min,
        max
    ) {

        return Math.min(
            Math.max(value, min),
            max
        );

    }

    function round(
        value,
        decimals = 2
    ) {

        return Number(
            value.toFixed(decimals)
        );

    }

    function percentage(
        value,
        total
    ) {

        if (!total)
            return 0;

        return round(
            (value / total) * 100
        );

    }

    /* ========================================================
       ARCHIVOS
       ======================================================== */

    function fileExtension(
        filename
    ) {

        return normalizeText(filename)
            .split(".")
            .pop()
            .toLowerCase();

    }

    function fileSize(bytes) {

        if (bytes < 1024)
            return `${bytes} B`;

        if (bytes < 1024 * 1024)
            return `${round(bytes / 1024)} KB`;

        if (bytes < 1024 * 1024 * 1024)
            return `${round(bytes / 1024 / 1024)} MB`;

        return `${round(bytes / 1024 / 1024 / 1024)} GB`;

    }

    /* ========================================================
       DOM
       ======================================================== */

    function $(selector, root = document) {

        return root.querySelector(selector);

    }

    function $all(selector, root = document) {

        return [
            ...root.querySelectorAll(selector)
        ];

    }

    function create(
        tag,
        className = ""
    ) {

        const element =
            document.createElement(tag);

        if (className)
            element.className =
                className;

        return element;

    }

    /* ========================================================
       DEBOUNCE
       ======================================================== */

    function debounce(
        fn,
        delay = 300
    ) {

        let timer;

        return function (...args) {

            clearTimeout(timer);

            timer =
                setTimeout(
                    () =>
                        fn.apply(
                            this,
                            args
                        ),
                    delay
                );

        };

    }

    /* ========================================================
       THROTTLE
       ======================================================== */

    function throttle(
        fn,
        delay = 100
    ) {

        let waiting = false;

        return (...args) => {

            if (waiting)
                return;

            waiting = true;

            fn(...args);

            setTimeout(
                () =>
                    waiting = false,
                delay
            );

        };

    }

    /* ========================================================
       PROMESAS
       ======================================================== */

    function sleep(ms) {

        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        );

    }

    /* ========================================================
       EXPORTACIÓN
       ======================================================== */

    return Object.freeze({

        normalizeText,
        isEmpty,
        capitalize,
        titleCase,
        slugify,

        unique,
        ensureArray,
        moveItem,

        deepClone,
        deepMerge,
        isObject,

        uuid,

        nowIso,
        formatDate,

        clamp,
        round,
        percentage,

        fileExtension,
        fileSize,

        $,
        $all,
        create,

        debounce,
        throttle,

        sleep

    });

})();

window.Helpers = Helpers;
