import jsonData from "../Data/data.json" assert { type: "json" };
import { getTheoryFromIndex, isMainTheory, parseLog10String, reverseMulti } from "../Utils/helpers";
import { qs } from "../Utils/DOMhelpers";

//Inputs
const modeSelector = qs<HTMLSelectElement>(".mode");
const theorySelector = qs<HTMLSelectElement>(".theory");
const stratSelector = qs<HTMLSelectElement>(".strat");
const sigmaInput = qs<HTMLInputElement>(".sigma");
const currencyInput = qs<HTMLInputElement>(".input");
const capInput = qs<HTMLInputElement>(".cap");
const simAllInputArea = qs<HTMLTextAreaElement>(".simAllInputArea")
const modeInput = qs<HTMLTextAreaElement>(".modeInput");
const hardCap = qs<HTMLInputElement>(".hardCap");
const semi_idle = qs<HTMLInputElement>(".semi-idle");
const hard_active = qs<HTMLInputElement>(".hard-active");

//Setting Inputs
const dtOtp = qs(".dtOtp");
const ddtOtp = qs(".ddtOtp");
const mfDepthOtp = qs(".mfDepthOtp");
const boughtVarsDeltaSlider = qs<HTMLInputElement>(".boughtVarsDelta");
const themeSelector = qs<HTMLSelectElement>(".themeSelector");
const simAllStrats = qs<HTMLSelectElement>(".simallstrats");
const completedCTs = qs<HTMLSelectElement>(".completedcts");
const showA23 = qs<HTMLInputElement>(".a23");
const showUnofficials = qs<HTMLInputElement>(".unofficials");
const generateTotalPurchaseList = qs<HTMLInputElement>(".totalPurchaseList");

function parseSettings(): Settings {
    return {
        dt: parseFloat(dtOtp.textContent ?? "1.5"),
        ddt: parseFloat(ddtOtp.textContent ?? "1.0001"),
        mfResetDepth: parseInt(mfDepthOtp.textContent ?? "0"),
        boughtVarsDelta: parseInt(boughtVarsDeltaSlider.value),
        theme: themeSelector.value,
        simAllStrats: simAllStrats.value as SettingsSimAllStratsMode,
        completedCTs: completedCTs.value as SettingsCompletedCTsMode,
        showA23: showA23.checked,
        showUnofficials: showUnofficials.checked,
        totalPurchaseList: generateTotalPurchaseList.checked
    }
}

function parseExponentialValue(str: string): number {
    if (/^e?\d+(\.\d+)?$/.test(str)) {
        if (str.charAt(0) == 'e') str = str.slice(1);
        return parseFloat(str);
    }
    else if (/^\d+(\.\d+)?e\d+$/.test(str)) {
        return parseLog10String(str);
    }
    else {
        throw `Invalid currency value ${str}. Currency value must be in formats <number>, <exxxx> or <xexxxx>.`;
    }
}

function parseCurrency(str: string, theory: theoryType, sigma: number, defaultType = "r") {
    str = str.replace(" ", "");

    const inputType = str.match(/[rtm]$/g);
    let type = defaultType;
    if (inputType) {
        type = inputType[0];
        str = str.slice(0, str.length - 1);
    };

    let value = parseExponentialValue(str);

    if (type == 't') {
        return value / jsonData.theories[theory].tauFactor;
    }
    else if (type == 'm') {
        return reverseMulti(theory, value, sigma);
    }
    return value;
}

function parseSigma(required: boolean): number {
    const str = sigmaInput.value.replace(" ", "");
    const match = str.match(/^\d+$/g);
    if (match) {
        return parseInt(match[0]);
    }
    else {
        if (required) {
            throw "Invalid sigma value. Sigma must be an integer that's >= 0";
        }
        return 0;
    }
}

function parseSingleSim(): SingleSimQuery {
    const theory = theorySelector.value as theoryType;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "single",
        theory: theory,
        strat: stratSelector.value,
        sigma: sigma,
        rho: parseCurrency(currencyInput.value, theory, sigma),
        settings: parseSettings()
    }
}

function parseChainSim(): ChainSimQuery {
    const theory = theorySelector.value as theoryType;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "chain",
        theory: theory,
        strat: stratSelector.value,
        sigma: sigma,
        rho: parseCurrency(currencyInput.value, theory, sigma),
        cap: parseCurrency(capInput.value, theory, sigma),
        hardCap: hardCap.checked,
        settings: parseSettings()
    }
}

function parseStepSim(): StepSimQuery {
    const theory = theorySelector.value as theoryType;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "step",
        theory: theory,
        strat: stratSelector.value,
        sigma: sigma,
        rho: parseCurrency(currencyInput.value, theory, sigma),
        cap: parseCurrency(capInput.value, theory, sigma),
        step: parseExponentialValue(modeInput.value),
        settings: parseSettings()
    }
}

function parseSimAll(): SimAllQuery {
    const settings = parseSettings();
    const str = simAllInputArea.value;
    let split = str.split(" ").map(s => s.replace("\n", "")).filter(s => s != "");
    
    const sigmaStr = split.shift() ?? "";
    if (split.length < 1) throw "Student count and at least one theory value that is not 0 is required.";
    if (split.length > Object.keys(jsonData.theories).length) {
        throw `Invalid value ${split[Object.keys(jsonData.theories).length + 1]} does not match any theory.`;
    }

    const sigmaMatch = sigmaStr.match(/^\d+$/);
    if (!sigmaMatch) throw "Invalid sigma value. Sigma must be an integer that's >= 0";
    const sigma = parseInt(sigmaMatch[0]);

    let values = split.map((val, i) => parseCurrency(val, getTheoryFromIndex(i), sigma, 't'));

    values = values.map((val, i) => {
        const theory = getTheoryFromIndex(i);
        if (settings.completedCTs === "no" && i > 8 && val * jsonData.theories[theory].tauFactor >= 600) return 0;
        if (!settings.showUnofficials && (jsonData.theories as TheoryDataStructure)[theory].UI_visible === false) return 0;
        return val;
    })

    if (values.length - values.filter(val => val <= 0).length < 1) throw "Student count and at least one theory value that is not 0 is required.";

    return {
        queryType: "all",
        sigma: sigma,
        values: values,
        veryActive: hard_active.checked,
        semiIdle: semi_idle.checked,
        stratType: settings.simAllStrats,
        settings: settings
    }
}

export function parseQuery(): SimQuery {
    switch (modeSelector.value) {
        case "All": return parseSimAll();
        case "Single sim": return parseSingleSim();
        case "Chain": return parseChainSim();
        case "Steps": return parseStepSim();
        default: throw "This mode is not supported.";
    }
}