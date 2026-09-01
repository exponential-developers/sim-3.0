import jsonData from "../Data/data.json" with { type: "json" };
import { getTheories, getTheoryFromIndex, isMainTheory, parseLog10String, reverseMulti } from "../Utils/helpers";
import UI from "../UI/elements";

type ParsedSpecificInput<T extends theoryType> = {
    theory: T,
    id: SpecificInputOf[T],
    value?: string
}

export function parseSettings(): Settings {
    return {
        dt: parseFloat(UI.settings.dtOtp.textContent ?? "1.5"),
        ddt: parseFloat(UI.settings.ddtOtp.textContent ?? "1.0001"),
        boughtVarsDelta: parseInt(UI.settings.boughtVarsDeltaSlider.value),
        theme: UI.settings.themeSelector.value,
        simAllStrats: UI.settings.simAllStrats.value as SettingsSimAllStratsMode,
        completedCTs: UI.settings.completedCTs.value as SettingsCompletedCTsMode,
        showA23: UI.settings.showA23.checked,
        showUnofficials: UI.settings.showUnofficials.checked,
        totalPurchaseList: UI.settings.totalPurchaseList.checked
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

function parseSpecificInputSlider(div: Element): string | undefined {
    const span = div.querySelector(".specificInputSliderOutput");
    if (span == null) return undefined;
    return span.innerHTML;
}

function parseSpecificInput<T extends theoryType>(div: Element): ParsedSpecificInput<T> {
    const theory = div.getAttribute("theory") as T;
    const id = div.getAttribute("inputid") as SpecificInputOf[T];
    const inputType = div.getAttribute("inputtype") as SpecificInputType["type"];
    let value: string | undefined;
    switch (inputType) {
        case "slider": value = parseSpecificInputSlider(div);
    }

    return {theory, id, value};
}

function parseAllModeSpecificInputs(): SpecificInputFullRecord {
    let record: {[theory in theoryType]: Partial<Record<string, string>>} = 
        Object.fromEntries(getTheories().map((t) => [t, {}])) as {[theory in theoryType]: Partial<Record<string, string>>};
    for (let div of UI.specificInputsDialog.contentWrapper.children) {
        let parsed = parseSpecificInput(div);
        record[parsed.theory][parsed.id] = parsed.value;
    }

    return record;
}

function parseTheorySpecificInputs<T extends theoryType>(): SpecificInputRecord<T> {
    let record: SpecificInputRecord<T> = {};
    for (let div of UI.controls.specificInputsWrapper.children) {
        let parsed = parseSpecificInput<T>(div);
        record[parsed.id] = parsed.value;
    }

    return record;
}

function parseSigma(required: boolean): number {
    const str = UI.controls.sigmaInput.value.replace(" ", "");
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

function parseSingleSim<T extends theoryType>(): SingleSimQuery<T> {
    const theory = UI.controls.theorySelector.value as T;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "single",
        theory: theory,
        theorySpecificInputs: parseTheorySpecificInputs(),
        strat: UI.controls.stratSelector.value as FullStratType<T>,
        sigma: sigma,
        rho: parseCurrency(UI.controls.currencyInput.value, theory, sigma),
        settings: parseSettings()
    }
}

function parseChainSim<T extends theoryType>(): ChainSimQuery<T> {
    const theory = UI.controls.theorySelector.value as T;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "chain",
        theory: theory,
        theorySpecificInputs: parseTheorySpecificInputs(),
        strat: UI.controls.stratSelector.value as FullStratType<T>,
        sigma: sigma,
        rho: parseCurrency(UI.controls.currencyInput.value, theory, sigma),
        cap: parseCurrency(UI.controls.capInput.value, theory, sigma),
        hardCap: UI.controls.hardCap.checked,
        settings: parseSettings()
    }
}

function parseStepSim<T extends theoryType>(): StepSimQuery<T> {
    const theory = UI.controls.theorySelector.value as T;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "step",
        theory: theory,
        theorySpecificInputs: parseTheorySpecificInputs(),
        strat: UI.controls.stratSelector.value as FullStratType<T>,
        sigma: sigma,
        rho: parseCurrency(UI.controls.currencyInput.value, theory, sigma),
        cap: parseCurrency(UI.controls.capInput.value, theory, sigma),
        step: parseExponentialValue(UI.controls.extraInput.value),
        settings: parseSettings()
    }
}

function parseComparisonSim<T extends theoryType>(): ComparisonSimQuery<T> {
    const theory = UI.controls.theorySelector.value as T;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "comparison",
        theory: theory,
        theorySpecificInputs: parseTheorySpecificInputs(),
        sigma: sigma,
        rho: parseCurrency(UI.controls.currencyInput.value, theory, sigma),
        settings: parseSettings()
    }
}

function parseAmountSim<T extends theoryType>(): AmountSimQuery<T> {
    const theory = UI.controls.theorySelector.value as T;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "amount",
        theory: theory,
        theorySpecificInputs: parseTheorySpecificInputs(),
        strat: UI.controls.stratSelector.value as FullStratType<T>,
        sigma: sigma,
        rho: parseCurrency(UI.controls.currencyInput.value, theory, sigma),
        amount: parseInt(UI.controls.extraInput.value),
        settings: parseSettings()
    }
}

function parseTimeSim<T extends theoryType>(): TimeSimQuery<T> {
    const theory = UI.controls.theorySelector.value as T;
    const sigma = parseSigma(isMainTheory(theory));

    const timeStr = UI.controls.extraInput.value;
    const timeComponents = timeStr.matchAll(/(\d+)([ydhm])/g);
    let time = 0;

    for (let component of timeComponents) {
        switch (component[2]) {
            case 'y':
                time += parseInt(component[1]) * 3600 * 24 * 365;
                break;
            case 'd':
                time += parseInt(component[1]) * 3600 * 24;
                break;
            case 'h':
                time += parseInt(component[1]) * 3600;
                break;
            case 'm':
                time += parseInt(component[1]) * 60;
                break;
        }
    }

    return {
        queryType: "time",
        theory: theory,
        theorySpecificInputs: {},
        strat: UI.controls.stratSelector.value as FullStratType<T>,
        sigma: sigma,
        rho: parseCurrency(UI.controls.currencyInput.value, theory, sigma),
        time,
        hardCap: UI.controls.hardCap.checked,
        settings: parseSettings()
    }
}

function parseStepChainSim<T extends theoryType>(): StepChainQuery<T> {
    const theory = UI.controls.theorySelector.value as T;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "step_chain",
        theory: theory,
        theorySpecificInputs: parseTheorySpecificInputs(),
        strat: UI.controls.stratSelector.value as FullStratType<T>,
        sigma: sigma,
        rho: parseCurrency(UI.controls.currencyInput.value, theory, sigma),
        cap: parseCurrency(UI.controls.capInput.value, theory, sigma),
        step: parseExponentialValue(UI.controls.extraInput.value),
        hardCap: UI.controls.hardCap.checked,
        settings: parseSettings()
    }
}

function parseSimAll(): SimAllQuery {
    const settings = parseSettings();
    const str = UI.controls.simAllInputArea.value;
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
        if (settings.completedCTs === "no" && i >= 8 && val * jsonData.theories[theory].tauFactor >= 600) return 0;
        if (!settings.showUnofficials && (jsonData.theories as TheoryDataStructure)[theory].UI_visible === false) return 0;
        return val;
    })

    if (values.length - values.filter(val => val <= 0).length < 1) throw "Student count and at least one theory value that is not 0 is required.";

    return {
        queryType: "all",
        theorySpecificInputs: parseAllModeSpecificInputs(),
        sigma: sigma,
        values: values,
        veryActive: UI.controls.veryActiveToggle.checked,
        semiIdle: UI.controls.semiIdleToggle.checked,
        stratType: settings.simAllStrats,
        settings: settings
    }
}

export function parseQuery(): SimQuery {
    switch (UI.controls.modeSelector.value) {
        case "All": return parseSimAll();
        case "Single sim": return parseSingleSim();
        case "Chain": return parseChainSim();
        case "Steps": return parseStepSim();
        case "Comparison": return parseComparisonSim();
        case "Amount": return parseAmountSim();
        case "Time": return parseTimeSim();
        case "StepChain": return parseStepChainSim();
        default: throw "This mode is not supported.";
    }
}