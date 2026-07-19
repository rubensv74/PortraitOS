"use strict";

const PortraitProfile = (() => {

    function initialize() {}

    function getProfile() {}

    function save() {}

    function reset() {}

    return {

        initialize,
        getProfile,
        save,
        reset,

        photos: PortraitPhotos,

        identity: PortraitIdentity,

        direction: PortraitDirection,

        validation: PortraitValidation,

        importExport: PortraitImportExport

    };

})();

window.PortraitProfile = PortraitProfile;
