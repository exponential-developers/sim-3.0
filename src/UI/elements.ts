import { qs } from "../Utils/DOMhelpers";

const UI = {
    nav: {
        instructionsBtn: qs<HTMLButtonElement>("#instructionsBtn"),
        settingsBtn: qs<HTMLButtonElement>("#settingsBtn")
    },
    controls: {
        baseWrapper: qs("#baseControlsWrapper"),

        theorySelector: qs<HTMLSelectElement>(".theory"),

        stratSelectorWrapper: qs("#stratSelectionWrapper"),
        stratSelector: qs<HTMLSelectElement>("#stratSelector"),

        sigmaInput: qs<HTMLInputElement>("#sigmaInput"),
        currencyInput: qs<HTMLInputElement>(".input"),
        capInputWrapper: qs(".capWrapper"),
        capInput: qs<HTMLInputElement>(".cap"),

        modeSelector: qs<HTMLSelectElement>(".mode"),

        hardCapWrapper: qs(".hardCapWrapper"),
        hardCap: qs<HTMLInputElement>(".hardCap"),

        extraInputWrapper: qs(".extraInputs"),
        extraInputDesc: qs(".extraInputDescription"),

        simAllInputWrapper: qs(".simAllInputs"),
        saveDistBtn: qs<HTMLButtonElement>(".saveDist"),
        semiIdleToggle: qs<HTMLInputElement>(".semi-idle"),
        veryActiveToggle: qs<HTMLInputElement>(".hard-active"),
        getDistBtn: qs(".getDist"),
        loadSaveBtn: qs<HTMLButtonElement>(".loadSave"),

        simAllInputArea: qs<HTMLTextAreaElement>(".simAllInputArea"),
        extraInput: qs<HTMLTextAreaElement>(".modeInput"),

        timeDiffWrapper: qs(".timeDiffWrapper"),

        copyImageBtn: qs<HTMLButtonElement>(".imageC"),
        downloadImageBtn: qs(".imageD"),
        downloadCsvBtn: qs(".csvD"),
        clearResultsBtn: qs(".clear"),
        clearInputsBtn: qs(".clearInput"),
        simulateBtn: qs(".simulate")
    },
    outputs: {
        log: qs(".output"),
        table: qs(".simTable"),
        tableHeadRow: qs<HTMLTableRowElement>(".simTable > thead > tr"),
        tableBody: qs(".simTable > tbody")
    },
    settings: {
        dialog: qs<HTMLDialogElement>(".settings"),
        closeBtn: qs<HTMLButtonElement>(".settingsCloseBtn"),
        dtSlider: qs<HTMLInputElement>(".dt"),
        dtOtp: qs(".dtOtp"),
        ddtSlider: qs<HTMLInputElement>(".ddt"),
        ddtOtp: qs(".ddtOtp"),
        mfDepthSlider: qs<HTMLInputElement>(".mfDepth"),
        mfDepthOtp: qs(".mfDepthOtp"),
        boughtVarsDeltaSlider: qs<HTMLInputElement>(".boughtVarsDelta"),
        boughtVarsDeltaOtp: qs(".boughtVarsDeltaOtp"),
        resetBtn: qs(".resetSettings"),

        themeSelector: qs<HTMLSelectElement>(".themeSelector"),
        simAllStrats: qs<HTMLSelectElement>(".simallstrats"),
        completedCTs: qs<HTMLSelectElement>(".completedcts"),
        showA23: qs<HTMLInputElement>(".a23"),
        showUnofficials: qs<HTMLInputElement>(".unofficials"),
        totalPurchaseList: qs<HTMLInputElement>(".totalPurchaseList")
    },
    buyList: {
        dialog: qs<HTMLDialogElement>(".boughtVars"),
        closeBtn: qs<HTMLButtonElement>(".boughtVarsCloseBtn"),
        table: qs<HTMLTableSectionElement>(".boughtVarsOtp")
    },
    instructions: {
        dialog: qs<HTMLDialogElement>(".instructions"),
        closeBtn: qs<HTMLButtonElement>(".instructionsCloseBtn")
    }
};

export default UI;