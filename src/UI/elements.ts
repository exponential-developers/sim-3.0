import { qs } from "../Utils/DOMhelpers";

const UI = {
    nav: {
        instructionsBtn: qs<HTMLButtonElement>("#instructionsBtn"),
        settingsBtn: qs<HTMLButtonElement>("#settingsBtn")
    },
    controls: {
        baseWrapper: qs("#baseControlsWrapper"),

        theorySelector: qs<HTMLSelectElement>("#theorySelector"),

        stratSelectorWrapper: qs("#stratSelectionWrapper"),
        stratSelector: qs<HTMLSelectElement>("#stratSelector"),

        sigmaInput: qs<HTMLInputElement>("#sigmaInput"),
        currencyInput: qs<HTMLInputElement>("#currencyInput"),
        capInputWrapper: qs("#capInputWrapper"),
        capInput: qs<HTMLInputElement>("#capInput"),

        modeSelector: qs<HTMLSelectElement>("#modeSelector"),

        hardCapWrapper: qs("#hardCapWrapper"),
        hardCap: qs<HTMLInputElement>("#hardCapToggle"),

        extraInputWrapper: qs("#extraInputWrapper"),
        extraInputDesc: qs("#extraInputDescription"),

        simAllInputWrapper: qs("#simAllInputWrapper"),
        saveDistBtn: qs<HTMLButtonElement>("#saveDistBtn"),
        semiIdleToggle: qs<HTMLInputElement>("#semiIdleToggle"),
        veryActiveToggle: qs<HTMLInputElement>("#hardActiveToggle"),
        getDistBtn: qs("#getDistBtn"),
        loadSaveBtn: qs<HTMLButtonElement>("#loadSaveBtn"),

        simAllInputArea: qs<HTMLTextAreaElement>("#simAllInputArea"),
        extraInput: qs<HTMLTextAreaElement>("#extraInput"),

        timeDiffWrapper: qs("#timeDiffWrapper"),

        copyImageBtn: qs<HTMLButtonElement>("#copyImageBtn"),
        downloadImageBtn: qs("#downloadImageBtn"),
        downloadCsvBtn: qs("#downloadCsvBtn"),
        clearResultsBtn: qs("#clearResultsBtn"),
        clearInputsBtn: qs("#clearInputsBtn"),
        simulateBtn: qs("#simulateBtn")
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