import jsonData from "../Data/data.json" with { type: "json" };
import { getTheories, getTheoryFromIndex, isMainTheory, parseLog10String } from "../Utils/helpers";
import UI from "../UI/elements";

type ParsedSpecificInput<T extends theoryType> = {
    theory: T,
    id: SpecificInputOf[T],
    value?: string
}

type ParsedStratSpecificInput<T extends theoryType, S extends stratType[T]> = {
    theory: T,
    id: StratSpecificInputOf[T][S],
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
        throw `Invalid value ${str}. Value must be in formats <number>, <exxxx> or <xexxxx>.`;
    }
}

function parseProgressValueType(letter: string): ProgressValueType {
    switch (letter) {
        case "r": return "rho";
        case "t": return "tau";
        case "m": return "multiplier";
    }
    return "tau";
}

function parseCurrency(
    str: string, 
    theory: theoryType,
    defaultType: ProgressValueType = "rho"
): ProgressValue {
    str = str.replace(" ", "");

    const inputType = str.match(/[rtm]$/g);
    let type = defaultType;
    if (inputType) {
        type = parseProgressValueType(inputType[0]);
        str = str.slice(0, str.length - 1);
    };

    if ((jsonData.theories as TheoryDataStructure)[theory].supportsRho === false
        && type == "rho") {
        throw "Cannot use rho mode for theory " + theory
    }

    let value = parseExponentialValue(str);

    return {
        value,
        valueType: type
    };
}

function parseSpecificInputSlider(div: Element): string | undefined {
    const span = div.querySelector(".specificInputSliderOutput");
    if (span === null) return undefined;
    return span.innerHTML;
}

function parseSpecificInputTextbox<T extends theoryType>(div: Element): string | undefined {
    const textbox = div.querySelector<HTMLInputElement>(".specificInputTextbox");
    if (textbox === null) return undefined;

    const theory = div.getAttribute("theory") as T;
    const id = div.getAttribute("inputid") as SpecificInputOf[T];
    const theoryData = (jsonData.theories as TheoryDataStructure)[theory];
    if (!theoryData.specificInputs) return undefined;

    const input = theoryData.specificInputs[id];
    if (input.type !== "textbox") return undefined;

    const val = textbox.value.trim();
    let error = (message?: string) => {
        throw `Bad input for ${theory} - ${input.label}` + (
            message ? ": " + message : ""
        );
    }

    switch (input.validation.type) {
        case "int": {
            if (!/^\d+$/.test(val)) error("Expected an integer");
            const parsedValue = parseInt(val);
            const min = typeof input.validation.min == "string" ? parseInt(input.validation.min) : input.validation.min;
            const max = typeof input.validation.min == "string" ? parseInt(input.validation.min) : input.validation.min;
            if (parsedValue < min || parsedValue > max) error(
                `Value should be between ${min} and ${max}`
            );
            return val;
        }
        case "float": {
            if (!/^\d+(\.\d+)$/.test(val)) error("Expected a number");
            const parsedValue = parseFloat(val);
            const min = typeof input.validation.min == "string" ? parseFloat(input.validation.min) : input.validation.min;
            const max = typeof input.validation.min == "string" ? parseFloat(input.validation.min) : input.validation.min;
            if (parsedValue < min || parsedValue > max) error(
                `Value should be between ${min} and ${max}`
            );
            return val;
        }
        case "exp": {
            let parsedValue: number;
            try {
                parsedValue = parseExponentialValue(val);
            }
            catch (e) {
                error(e as string);
                throw "Unreachable";
            }
            const min = typeof input.validation.min == "string" ? parseExponentialValue(input.validation.min) : input.validation.min;
            const max = typeof input.validation.min == "string" ? parseExponentialValue(input.validation.min) : input.validation.min;
            if (parsedValue < min || parsedValue > max) error(
                `Value should be between ${min} and ${max}`
            );
            return val;
        }
        case "string": {
            return val;
        }
    }
}

function parseSpecificInputValue(div: Element): string | undefined {
    const inputType = div.getAttribute("inputtype") as SpecificInputType["type"];
    switch (inputType) {
        case "slider": return parseSpecificInputSlider(div);
        case "textbox": return parseSpecificInputTextbox(div);
    }
}

function parseSpecificInput<T extends theoryType>(div: Element): ParsedSpecificInput<T> {
    const theory = div.getAttribute("theory") as T;
    const id = div.getAttribute("inputid") as SpecificInputOf[T];
    const value = parseSpecificInputValue(div);

    return {theory, id, value};
}

function parseStratSpecificInput<T extends theoryType, S extends stratType[T]>(div: Element): ParsedStratSpecificInput<T, S> {
    const theory = div.getAttribute("theory") as T;
    const id = div.getAttribute("inputid") as StratSpecificInputOf[T][S];
    const value = parseSpecificInputValue(div);

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

function _parseStratSpecificInputs<T extends theoryType, S extends stratType[T]>(): StratSpecificInputRecord<T, S> {
    let record: StratSpecificInputRecord<T, S> = {};
    for (let div of UI.controls.stratSpecificInputsWrapper.children) {
        let parsed = parseStratSpecificInput<T, S>(div);
        record[parsed.id] = parsed.value;
    }

    return record;
}

// I don't like using this but I don't think I have a choice here -Mathis
function parseStratSpecificInputs<T extends theoryType, S extends FullStratType<T>>(
    strat: S
): GeneralStratSpecificInputRecord<T, S> {
    if (jsonData.stratCategories.includes(strat as string)) return {} as GeneralStratSpecificInputRecord<T, S>;
    return _parseStratSpecificInputs() as GeneralStratSpecificInputRecord<T, S>;
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
    const strat = UI.controls.stratSelector.value as FullStratType<T>;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "single",
        theory,
        theorySpecificInputs: parseTheorySpecificInputs(),
        stratSpecificInputs: parseStratSpecificInputs(strat),
        strat,
        sigma,
        input: parseCurrency(UI.controls.currencyInput.value, theory),
        settings: parseSettings()
    }
}

function parseChainSim<T extends theoryType>(): ChainSimQuery<T> {
    const theory = UI.controls.theorySelector.value as T;
    const strat = UI.controls.stratSelector.value as FullStratType<T>;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "chain",
        theory,
        theorySpecificInputs: parseTheorySpecificInputs(),
        stratSpecificInputs: parseStratSpecificInputs(strat),
        strat,
        sigma,
        input: parseCurrency(UI.controls.currencyInput.value, theory),
        cap: parseCurrency(UI.controls.capInput.value, theory),
        hardCap: UI.controls.hardCap.checked,
        settings: parseSettings()
    }
}

function parseStepSim<T extends theoryType>(): StepSimQuery<T> {
    const theory = UI.controls.theorySelector.value as T;
    const strat = UI.controls.stratSelector.value as FullStratType<T>;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "step",
        theory,
        theorySpecificInputs: parseTheorySpecificInputs(),
        stratSpecificInputs: parseStratSpecificInputs(strat),
        strat,
        sigma,
        input: parseCurrency(UI.controls.currencyInput.value, theory),
        cap: parseCurrency(UI.controls.capInput.value, theory),
        step: parseExponentialValue(UI.controls.extraInput.value),
        settings: parseSettings()
    }
}

function parsePubTableSim<T extends theoryType>(): PubTableSimQuery {
    const theory = UI.controls.theorySelector.value as T;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "pub_table",
        theory,
        strat: UI.controls.stratSelector.value as FullStratType<T>,
        sigma: sigma,
        input: parseCurrency(UI.controls.currencyInput.value, theory),
        cap: parseCurrency(UI.controls.capInput.value, theory),
        step: parseExponentialValue(UI.controls.extraInput.value),
        settings: parseSettings()
    }
}

function parseComparisonSim<T extends theoryType>(): ComparisonSimQuery<T> {
    const theory = UI.controls.theorySelector.value as T;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "comparison",
        theory,
        theorySpecificInputs: parseTheorySpecificInputs(),
        sigma,
        input: parseCurrency(UI.controls.currencyInput.value, theory),
        settings: parseSettings()
    }
}

function parseAmountSim<T extends theoryType>(): AmountSimQuery<T> {
    const theory = UI.controls.theorySelector.value as T;
    const strat = UI.controls.stratSelector.value as FullStratType<T>;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "amount",
        theory,
        theorySpecificInputs: parseTheorySpecificInputs(),
        stratSpecificInputs: parseStratSpecificInputs(strat),
        strat,
        sigma,
        input: parseCurrency(UI.controls.currencyInput.value, theory),
        amount: parseInt(UI.controls.extraInput.value),
        settings: parseSettings()
    }
}

function parseTimeSim<T extends theoryType>(): TimeSimQuery<T> {
    const theory = UI.controls.theorySelector.value as T;
    const strat = UI.controls.stratSelector.value as FullStratType<T>;
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
        theory,
        theorySpecificInputs: parseTheorySpecificInputs(),
        stratSpecificInputs: parseStratSpecificInputs(strat),
        strat,
        sigma,
        input: parseCurrency(UI.controls.currencyInput.value, theory),
        time,
        hardCap: UI.controls.hardCap.checked,
        settings: parseSettings()
    }
}

function parseStepChainSim<T extends theoryType>(): StepChainQuery<T> {
    const theory = UI.controls.theorySelector.value as T;
    const strat = UI.controls.stratSelector.value as FullStratType<T>;
    const sigma = parseSigma(isMainTheory(theory));

    return {
        queryType: "step_chain",
        theory,
        theorySpecificInputs: parseTheorySpecificInputs(),
        stratSpecificInputs: parseStratSpecificInputs(strat),
        strat,
        sigma,
        input: parseCurrency(UI.controls.currencyInput.value, theory),
        cap: parseCurrency(UI.controls.capInput.value, theory),
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

    let values = split.map((val, i) => parseCurrency(val, getTheoryFromIndex(i), 'tau'));

    let new_values: AllModeProgressValue[] = values.map((val, i) => {
        const theory = getTheoryFromIndex(i);
        if (val.value <= 0) return "ignore";
        if (!settings.showUnofficials && (jsonData.theories as TheoryDataStructure)[theory].UI_visible === false) return "ignore";
        return val;
    })

    if (new_values.length - new_values.filter(val => typeof val === "string").length < 1) throw "Student count and at least one theory value is required.";

    return {
        queryType: "all",
        theorySpecificInputs: parseAllModeSpecificInputs(),
        sigma: sigma,
        values: new_values,
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
        case "Pub Table": return parsePubTableSim();
        default: throw "This mode is not supported.";
    }
}
