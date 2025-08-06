import jsonData from "../Data/data.json" assert { type: "json" };
const raise = (err) => {
    throw new Error(err);
};
export const qs = (name) => { var _a; return (_a = document.querySelector(name)) !== null && _a !== void 0 ? _a : raise(`HtmlElement ${name} not found.`); };
export const qsa = (name) => document.querySelectorAll(name);
export const ce = (type) => { var _a; return (_a = document.createElement(type)) !== null && _a !== void 0 ? _a : raise(`HtmlElement ${type} could not be created.`); };
export const event = (element, eventType, callback) => element.addEventListener(eventType, (e) => callback(e));
export function findIndex(arr, val) {
    for (let i = 0; i < arr.length; i++)
        if (val === arr[i])
            return i;
    return -1;
}
export function sleep(time = 0) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
export function getIndexFromTheory(theory) {
    return theory in Object.keys(jsonData.theories);
}
export function getTheoryFromIndex(index) {
    return Object.keys(jsonData.theories)[index];
}
export function parseLog10String(num) {
    const split = String(num).split("e");
    const result = Number(split[1]) + Math.log10(Math.max(1, Number(split[0])));
    return Number(result);
}
export function logToExp(num, dec = 3) {
    const wholePart = Math.floor(num);
    const fractionalPart = num - wholePart;
    const frac1 = round(Math.pow(10, fractionalPart), dec);
    return (frac1 >= 10 ? frac1 / 10 : frac1) + "e" + (frac1 >= 10 ? wholePart + 1 : wholePart);
}
export function convertTime(secs) {
    const mins = Math.floor((secs / 60) % 60);
    const hrs = Math.floor((secs / 3600) % 24);
    const days = Math.floor((secs / 86400) % 365);
    const years = Math.floor(secs / 31536000);
    let result = "";
    if (years > 0) {
        result += years < 1e6 ? years : logToExp(Math.log10(years));
        result += "y";
    }
    if (days > 0)
        result += days + "d";
    result += (hrs < 10 ? "0" : "") + hrs + "h";
    if (years === 0)
        result += (mins < 10 ? "0" : "") + mins + "m";
    return result;
}
export function formatNumber(value, precision = 6) {
    return value.toPrecision(precision).replace(/[+]/, "");
}
export function round(number, decimals) {
    return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
export function add_old(value1, value2) {
    const max = value1 > value2 ? value1 : value2;
    const min = value1 > value2 ? value2 : value1;
    const wholePart1 = Math.floor(max);
    const fractionalPart1 = Math.pow(10, (max - wholePart1));
    const wholePart2 = Math.floor(min);
    const fractionalPart2 = Math.pow(10, (min - wholePart2));
    return wholePart1 + Math.log10(fractionalPart1 + fractionalPart2 / Math.pow(10, (wholePart1 - wholePart2)));
}
export function add(value1, value2) {
    const max = value1 > value2 ? value1 : value2;
    const min = value1 > value2 ? value2 : value1;
    return max != -Infinity ? max + l10(1 + Math.pow(10, (min - max))) : max;
}
export function subtract_old(value1, value2) {
    const max = value1 > value2 ? value1 : value2;
    const min = value1 > value2 ? value2 : value1;
    const wholePart1 = Math.floor(max);
    const fractionalPart1 = Math.pow(10, (max - wholePart1));
    const wholePart2 = Math.floor(min);
    const fractionalPart2 = Math.pow(10, (min - wholePart2));
    return wholePart1 + Math.log10(fractionalPart1 - fractionalPart2 / Math.pow(10, (wholePart1 - wholePart2)));
}
export function subtract(value1, value2) {
    const max = value1 > value2 ? value1 : value2;
    const min = value1 > value2 ? value2 : value1;
    return max != -Infinity ? max + l10(1 - Math.pow(10, (min - max))) : max;
}
export let l10 = Math.log10;
export let l2 = Math.log2;
//written by propfeds
export function binarySearch(arr, target) {
    let l = 0;
    let r = arr.length - 1;
    while (l < r) {
        const m = Math.ceil((l + r) / 2);
        if (arr[m] <= target)
            l = m;
        else
            r = m - 1;
    }
    return l;
}
export function createResult(data, stratExtra) {
    return {
        theory: data.theory,
        sigma: data.sigma,
        lastPub: logToExp(data.lastPub, 2),
        pubRho: logToExp(data.pubRho, 2),
        deltaTau: logToExp((data.pubRho - data.lastPub) * jsonData.theories[data.theory].tauFactor, 2),
        pubMulti: formatNumber(data.pubMulti),
        strat: data.strat + stratExtra,
        tauH: data.maxTauH === 0 ? 0 : Number(formatNumber(data.maxTauH * jsonData.theories[data.theory].tauFactor)),
        time: convertTime(Math.max(0, data.pubT - data.recovery.time)),
        rawData: {
            pubRho: data.pubRho,
            time: data.recovery.recoveryTime ? data.recovery.time : Math.max(0, data.pubT - data.recovery.time)
        },
        boughtVars: data.boughtVars
    };
}
export function resultIsSimResult(result) {
    return "strat" in result;
}
export function resultIsSimAllResult(result) {
    return "ratio" in result;
}
export function resultIsCombinedResult(result) {
    return Array.isArray(result);
}
export function defaultResult() {
    return {
        theory: "",
        sigma: 0,
        lastPub: "",
        pubRho: "",
        deltaTau: "",
        pubMulti: "",
        strat: "Result undefined",
        tauH: 0,
        time: "",
        rawData: { pubRho: 0, time: 0 },
        boughtVars: []
    };
}
export function getBestResult(res1, res2) {
    if (res1 == null && res2 != null) {
        return res2;
    }
    if (res2 == null && res1 != null) {
        return res1;
    }
    if (res1 != null && res2 != null) {
        return res1.tauH > res2.tauH ? res1 : res2;
    }
    return defaultResult();
}
export function getLastLevel(variable, arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].variable == variable) {
            return arr[i].level;
        }
    }
    return 0;
}
