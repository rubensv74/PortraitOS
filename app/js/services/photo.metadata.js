"use strict";

/* ============================================================
   PortraitOS
   Photo Metadata Service
   ------------------------------------------------------------
   Responsabilidad:
   - Extraer metadatos básicos de imagen.
   - Calcular orientación, proporción y resolución.
   - Generar una descripción técnica normalizada.
   - No modifica el perfil.
   ============================================================ */

const PhotoMetadata = (() => {

    async function extract(file) {

        validateFile(file);

        const source =
            await readSource(file);

        const image =
            await loadImage(source);

        const width =
            image.naturalWidth || image.width;

        const height =
            image.naturalHeight || image.height;

        const aspectRatio =
            calculateAspectRatio(
                width,
                height
            );

        const orientation =
            getOrientation(
                width,
                height
            );

        return {
            name:
                file.name || "",
            type:
                file.type || "",
            size:
                file.size || 0,
            lastModified:
                file.lastModified || null,

            width,
            height,
            aspectRatio,
            orientation,

            megapixels:
                calculateMegapixels(
                    width,
                    height
                ),

            resolutionLabel:
                getResolutionLabel(
                    width,
                    height
                ),

            quality:
                evaluateQuality(
                    width,
                    height
                ),

            extractedAt:
                new Date().toISOString()
        };

    }

    function calculateAspect
