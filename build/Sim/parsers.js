import { getTheoryFromIndex, parseLog10String } from "../Utils/helpers.js";
import jsonData from "../Data/data.json" assert { type: "json" };
import { global } from "./main.js";
import { qs, qsa } from "../Utils/helpers.js";
export function parseData(data) {
    const parsedDataObj = {
        theory: data.theory,
        strat: data.strat,
        mode: data.mode,
        hardCap: data.hardCap,
        modeInput: data.modeInput,
        simAllInputs: data.simAllInputs,
        sigma: 0,
        rho: 0,
        cap: Infinity,
        recovery: null,
    };
    if (data.mode !== "All" && data.mode !== "Time diff.") {
        //parsing sigma
        if (data.sigma.length > 0 && data.sigma.match(/^[0-9]+$/) !== null && parseInt(data.sigma) >= 0 && parseFloat(data.sigma) % 1 === 0)
            parsedDataObj.sigma = parseInt(data.sigma);
        else if (data.theory.match(/T[1-8]/))
            throw "Invalid sigma value. Sigma must be an integer that's >= 0";
        //parsing currency
        if (data.rho.length > 0)
            parsedDataObj.rho = parseCurrencyValue(data.rho, parsedDataObj.theory, parsedDataObj.sigma);
        else
            throw "Input value cannot be empty.";
        //parsing cap if needed
        if (data.mode === "Chain" || data.mode === "Steps") {
            if (data.cap.length > 0)
                parsedDataObj.cap = parseCurrencyValue(data.cap, parsedDataObj.theory, parsedDataObj.sigma);
            else
                throw "Cap value cannot be empty.";
        }
    }
    //parsing mode input if needed
    if (data.mode !== "Single sim" && data.mode !== "Chain") {
        if (data.mode === "Time diff.")
            data.modeInput = JSON.stringify(data.timeDiffInputs);
        parsedDataObj.modeInput = parseModeInput(data.modeInput, data.mode);
    }
    return parsedDataObj;
}
export function parseCurrencyValue(value, theory, sigma, defaultType = "r") {
    if (typeof value === "string") {
        const lastChar = value.charAt(value.length - 1);
        //checks if last character is not valid currency character. If not, throw error
        if (lastChar.match(/[r/t/m]/) !== null) {
            value = value.slice(0, -1);
            if (isValidCurrency(value))
                value = [value, lastChar];
        }
        else if (lastChar.match(/[0-9]/)) {
            if (isValidCurrency(value))
                value = [value, defaultType];
        }
        else {
            throw `Invalid currency value ${value}. Currency value must be in formats <number>, <exxxx> or <xexxxx>.`;
        }
    }
    //Parses currency value if it is still a string.
    if (typeof value[0] === "string" && Array.isArray(value))
        value[0] = parseValue(value[0]);
    //failsafe in case value is not parsed currectly.
    if (typeof value[0] !== "number")
        throw `Cannot parse value ${value[0]}. Please contact the author of the sim.`;
    //returns value if last character is r.
    if (value[1] === "r")
        return value[0];
    //returns value with correct tau factor if last character is t.
    if (value[1] === "t")
        return value[0] / jsonData.theories[theory].tauFactor;
    //returns value converted to rho from current multiplier if last character is r.
    if (value[1] === "m")
        return reverseMulti(theory, value[0], sigma);
    throw `Cannot parse value ${value[0]} and ${value[1]}. Please contact the author of the sim.`;
}
export function isValidCurrency(val) {
    //if currency contains any other characters than 0-9, . or e, throw error for invalid currency.
    if (val.match(/^[0-9/e/.]+$/) === null)
        throw `Invalid currency value ${val}. Currency value must be in formats <number>, <exxxx> or <xexxxx>.`;
    //if amount of e's in currency are more than 1, throw error for invalid currency. same for dots
    let es = 0;
    for (let i = 0; i < val.length; i++)
        if (val[i] === "e")
            es++;
    if (es > 1)
        throw `Invalid currency value ${val}. Currency value must be in formats <number>, <exxxx> or <xexxxx>.`;
    let dots = 0;
    for (let i = 0; i < val.length; i++)
        if (val[i] === ".")
            dots++;
    if (dots > 1)
        throw `Invalid currency value ${val}. Currency value must be in formats <number>, <exxxx> or <xexxxx>.`;
    //if currency is valid, return true.
    return true;
}
export function parseValue(val) {
    if (/[e]/.test(val))
        return parseLog10String(val);
    return parseFloat(val);
}
function isInt(str) {
    return /^\d+$/.test(str);
}
export function reverseMulti(theory, value, sigma) {
    const getR9Exp = () => (sigma < 65 ? 0 : sigma < 75 ? 1 : sigma < 85 ? 2 : 3);
    const divSigmaMulti = (exp, div) => (value - Math.log10(Math.pow((sigma / 20), getR9Exp())) + Math.log10(div)) * (1 / exp);
    const multSigmaMulti = (exp, mult) => (value - Math.log10(Math.pow((sigma / 20), getR9Exp())) - Math.log10(mult)) * (1 / exp);
    const sigmaMulti = (exp) => (value - Math.log10(Math.pow((sigma / 20), getR9Exp()))) * (1 / exp);
    switch (theory) {
        case "T1":
            return divSigmaMulti(0.164, 3);
        case "T2":
            return divSigmaMulti(0.198, 100);
        case "T3":
            return multSigmaMulti(0.147, 3);
        case "T4":
            return divSigmaMulti(0.165, 4);
        case "T5":
            return sigmaMulti(0.159);
        case "T6":
            return divSigmaMulti(0.196, 50);
        case "T7":
            return sigmaMulti(0.152);
        case "T8":
            return sigmaMulti(0.15);
        case "WSP":
        case "SL":
            return value / 0.15;
        case "EF":
            return value * (1 / 0.387) * 2.5;
        case "CSR2":
            return (value + Math.log10(200)) * (1 / 2.203) * 10;
        case "FI":
            return value * (1 / 0.1625) * 2.5;
        case "FP":
            return (value - Math.log10(5)) * (1 / 0.331) * (10 / 3);
        case "RZ":
            return (value - Math.log10(2)) / 0.2102;
        case "MF":
            return value / 0.17;
        case "BaP":
            return (value - Math.log10(5)) / 0.132075 * 2.5;
    }
    throw `Failed parsing multiplier. Please contact the author of the sim.`;
}
export function parseModeInput(input, mode) {
    //Parsing Step mode input
    if (mode === "Steps" && typeof input === "string") {
        if (isValidCurrency(input))
            return parseValue(input);
    }
    //Parsing Amount input
    if (mode === "Amount" && typeof input === "string") {
        if (input.match(/[0-9]/) !== null)
            return parseFloat(input);
        throw mode + " input must be a number.";
    }
    //Parsing Time input
    // if (mode === "Time") return parseTime(input);
    //All and Time diff. mode has it's own parser export functions
    if (mode === "All")
        return parseSimAll(input);
    if (mode === "Time diff.")
        return parseTimeDiff(input);
    if (mode === "Time diff." || mode === "Single sim" || mode === "Chain")
        return input;
    throw `Couldnt parse mode ${mode}. Please contact the author of the sim.`;
}
// function parseTime(input: string):number {
//   let years: string | Array<string> = input.split("y");
//   let days: string | Array<string> = years[Math.min(years.length - 1, 1)].split("d");
//   let hours: string | Array<string> = days[Math.min(days.length - 1, 1)].split("h");
//   let minutes: string | Array<string> = hours[Math.min(hours.length - 1, 1)].split("m");
//   if(Math.max(years.length, days.length, hours.length, minutes.length)>2)throw "Invalid time value."
//   if(years.length > 0)
//   years = years[0]
// }
function parseSimAll(input) {
    //splitting input at every space
    let split = input.split(" ");
    //removing all leftover spaces and line breaks in every split
    for (let i = 0; i < split.length; i++) {
        split[i] = split[i].replace(" ", "");
        split[i] = split[i].replace("\n", "");
    }
    split = split.filter((elem) => elem !== "");
    //needs at least two items
    if (split.length < 2)
        throw "Student count and at least one theory value that is not 0 is required.";
    //dont allow more inputs than students + theories
    if (split.length - 1 > Object.keys(jsonData.theories).length)
        throw `Invalid value ${split[Object.keys(jsonData.theories).length + 1]} does not match any theory.`;
    //parse students
    const res = [];
    let value = 0;
    if (isInt(split[0]))
        res.push(parseInt(split[0]));
    else
        throw `Invalid student value ${split[0]}.`;
    //parse and check if all values are valid
    for (let i = 1; i < split.length; i++) {
        value = parseCurrencyValue(split[i], getTheoryFromIndex(i - 1), res[0], "t");
        if (global.skipCompletedCTs && i > 8 && value * jsonData.theories[getTheoryFromIndex(i - 1)].tauFactor >= 600) {
            value = 0;
        }
        res.push(value);
    }
    if (res.length - res.filter(item => item == 0).length < 2)
        throw "Student count and at least one theory value that is not 0 is required.";
    return res;
}
function parseTimeDiff(input) {
    const inputSplit = JSON.parse(input);
    const settings = { sigma: [0, 0], ct: false };
    //parsing settings input
    let temp = 0;
    inputSplit[2] = inputSplit[2].split(" ");
    for (let i = 0; i < inputSplit[2].length; i++) {
        if (inputSplit[2][i].length === 0)
            continue;
        if (temp < 2)
            settings.sigma[temp] = Math.max(0, parseInt(inputSplit[2][i]));
        else
            settings.ct = inputSplit[2][i] === "y";
        temp++;
    }
    //parsing theory
    const distributions = [];
    for (let i = 0; i < 2; i++) {
        const theories = inputSplit[i].split(",");
        const parsedInput = [];
        for (let j = 0; j < theories.length; j++) {
            const values = theories[j].split(" ");
            const temp = [];
            for (let k = 0; k < values.length; k++) {
                if (values[k].length === 0)
                    continue;
                temp.push(parseCurrencyValue(values[k], getTheoryFromIndex(j + Number(settings.ct) * 8), settings.sigma[i], "t"));
            }
            parsedInput.push(temp);
        }
        distributions.push(parsedInput);
    }
    return distributions;
}
export function updateTimeDiffTable() {
    const timeDiffInputs = qsa(".timeDiffInput");
    const timeDiffTable = qs(".timeDiffTable");
    const str = [];
    for (const elem of timeDiffInputs)
        str.push(elem.value);
    // const parsedValues = parseTimeDiff(JSON.stringify(str));
    while (timeDiffTable.firstChild)
        timeDiffTable.firstChild.remove();
    const tr = document.createElement("th");
    const td = document.createElement("td");
    td.innerHTML = "Hello world";
    tr.appendChild(td);
    timeDiffTable.appendChild(tr);
}
