import { qs, qsa } from "../Utils/DOMhelpers";
import { getTheoryFromIndex, isMainTheory, parseLog10String, reverseMulti } from "../Utils/helpers";
import jsonData from "../Data/data.json" assert { type: "json" };

type TheoryDataStructure = {
    [key in theoryType]: {
      tauFactor: number,
      UI_visible?: boolean,
    };
  }

//Inputs
const modeSelector = qs<HTMLSelectElement>(".mode");
const theorySelector = qs<HTMLSelectElement>(".theory");
const stratSelector = qs<HTMLSelectElement>(".strat");
const sigma = qs<HTMLInputElement>(".sigma");
const input = qs<HTMLInputElement>(".input");
const cap = qs<HTMLInputElement>(".cap");
const modeInput = qs<HTMLInputElement>("textarea");
//const timeDiffInputs = qsa<HTMLInputElement>(".timeDiffInput");
const hardCap = qs<HTMLInputElement>(".hardCap");
const semi_idle = qs<HTMLInputElement>(".semi-idle");
const hard_active = qs<HTMLInputElement>(".hard-active");

//Setting Inputs
const dtOtp = qs(".dtOtp");
const ddtOtp = qs(".ddtOtp");
const mfDepthOtp = qs(".mfDepthOtp");
const themeSelector = qs<HTMLSelectElement>(".themeSelector");
const simAllStrats = qs<HTMLSelectElement>(".simallstrats");
const skipCompletedCTs = qs<HTMLInputElement>(".skipcompletedcts");
const showA23 = qs<HTMLInputElement>(".a23");
const showUnofficials = qs<HTMLInputElement>(".unofficials");

export function parseSettings(): Settings {
    return {
        dt: parseFloat(dtOtp.textContent ?? "1.5"),
        ddt: parseFloat(ddtOtp.textContent ?? "1.0001"),
        mfResetDepth: parseInt(mfDepthOtp.textContent ?? "0"),
        theme: themeSelector.value,
        simAllStrats: simAllStrats.value,
        skipCompletedCTs: skipCompletedCTs.checked,
        showA23: showA23.checked,
        showUnofficials: showUnofficials.checked
    }
}

function parseExponentialValue(str: string): number {
    if (/^e?\d+(.\d+)?$/.test(str)) {
        if (str.charAt(0) == 'e') str = str.slice(1);
        return parseFloat(str);
    }
    else if (/^\d+(.\d+)?e\d+$/.test(str)) {
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
    const str = sigma.value.replace(" ", "");
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
        rho: parseCurrency(input.value, theory, sigma),
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
        rho: parseCurrency(input.value, theory, sigma),
        cap: parseCurrency(cap.value, theory, sigma),
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
        rho: parseCurrency(input.value, theory, sigma),
        cap: parseCurrency(cap.value, theory, sigma),
        step: parseExponentialValue(modeInput.value),
        settings: parseSettings()
    }
}

function parseSimAll(): SimAllQuery {
    const settings = parseSettings();
    const str = modeInput.value;
    let split = str.split(" ").map((s) => s.replace("\n", "")).filter((s) => s != "");
    
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
        if (settings.skipCompletedCTs && i > 8 && val >= 600) return 0;
        if (!settings.showUnofficials && (jsonData.theories as TheoryDataStructure)[getTheoryFromIndex(i)].UI_visible === false) return 0;
        return val;
    })

    if (values.length - values.filter((val) => val > 0).length < 1) throw "Student count and at least one theory value that is not 0 is required.";

    return {
        queryType: "all",
        sigma: sigma,
        values: values,
        veryActive: hard_active.checked,
        semiIdle: semi_idle.checked,
        stratType: simAllStrats.value,
        settings: settings
    }
}

function parseQuery(): SimQuery {
    switch (modeSelector.value) {
        case "All": return parseSimAll();
        case "Single sim": return parseSingleSim();
        case "Chain": return parseChainSim();
        case "Steps": return parseStepSim();
        default: throw "This mode is not supported.";
    }
}