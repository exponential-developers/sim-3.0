import jsonData from "../Data/data.json" assert { type: "json" };

const raise = (err: string) => {
  throw new Error(err);
};
export const qs = <T extends HTMLElement>(name: string) => document.querySelector<T>(name) ?? raise(`HtmlElement ${name} not found.`);
export const qsa = <T extends HTMLElement>(name: string) => document.querySelectorAll<T>(name);
export const ce = <T extends HTMLElement>(type: string) => (document.createElement(type) as T) ?? raise(`HtmlElement ${type} could not be created.`);

export const event = <T>(element: HTMLElement, eventType: string, callback: (e: T) => void) => element.addEventListener(eventType, (e) => callback(e as T));

export function findIndex(arr: Array<string | number | boolean>, val: string | number | boolean) {
  for (let i = 0; i < arr.length; i++) if (val === arr[i]) return i;
  return -1;
}
export function sleep(time = 0) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export function getIndexFromTheory(theory: string) {
  return theory in Object.keys(jsonData.theories);
}
export function getTheoryFromIndex(index: number) {
  return Object.keys(jsonData.theories)[index] as theoryType;
}

export function parseLog10String(num: string): number {
  const split = String(num).split("e");
  const result = Number(split[1]) + Math.log10(Math.max(1, Number(split[0])));
  return Number(result);
}

export function logToExp(num: number, dec = 3): string {
  const wholePart: number = Math.floor(num);
  const fractionalPart: number = num - wholePart;
  const frac1: number = round(10 ** fractionalPart, dec);
  return (frac1 >= 10 ? frac1 / 10 : frac1) + "e" + (frac1 >= 10 ? wholePart + 1 : wholePart);
}
export function convertTime(secs: number): string {
  const mins = Math.floor((secs / 60) % 60);
  const hrs = Math.floor((secs / 3600) % 24);
  const days = Math.floor((secs / 86400) % 365);
  const years = Math.floor(secs / 31536000);
  let result = "";
  if (years > 0) {
    result += years < 1e6 ? years : logToExp(Math.log10(years));
    result += "y";
  }
  if (days > 0) result += days + "d";
  result += (hrs < 10 ? "0" : "") + hrs + "h";
  if (years === 0) result += (mins < 10 ? "0" : "") + mins + "m";
  return result;
}
export function formatNumber(value: number, precision = 6): string {
  return value.toPrecision(precision).replace(/[+]/, "");
}

export function round(number: number, decimals: number): number {
  return Math.round(number * 10 ** decimals) / 10 ** decimals;
}

export function add_old(value1: number, value2: number) {
  const max = value1 > value2 ? value1 : value2;
  const min = value1 > value2 ? value2 : value1;
  const wholePart1 = Math.floor(max);
  const fractionalPart1 = 10 ** (max - wholePart1);
  const wholePart2 = Math.floor(min);
  const fractionalPart2 = 10 ** (min - wholePart2);
  return wholePart1 + Math.log10(fractionalPart1 + fractionalPart2 / 10 ** (wholePart1 - wholePart2));
}

export function add(value1: number, value2: number) {
  const max = value1 > value2 ? value1 : value2;
  const min = value1 > value2 ? value2 : value1;
  return max + l10(1 + 10**(min-max));
}

export function subtract_old(value1: number, value2: number) {
  const max = value1 > value2 ? value1 : value2;
  const min = value1 > value2 ? value2 : value1;
  const wholePart1 = Math.floor(max);
  const fractionalPart1 = 10 ** (max - wholePart1);
  const wholePart2 = Math.floor(min);
  const fractionalPart2 = 10 ** (min - wholePart2);
  return wholePart1 + Math.log10(fractionalPart1 - fractionalPart2 / 10 ** (wholePart1 - wholePart2));
}

export function subtract(value1: number, value2: number) {
  const max = value1 > value2 ? value1 : value2;
  const min = value1 > value2 ? value2 : value1;
  return max + l10(1 - 10**(min-max));
}

export let l10 = Math.log10;
export let l2 = Math.log2;

//written by propfeds
export function binarySearch(arr: Array<number>, target: number) {
  let l = 0;
  let r = arr.length - 1;
  while (l < r) {
    const m = Math.ceil((l + r) / 2);
    if (arr[m] <= target) l = m;
    else r = m - 1;
  }
  return l;
}

interface simResultInterface {
  sigma: number;
  pubRho: number;
  pubMulti: number;
  lastPub: number;
  recovery: { value: number; time: number; recoveryTime: boolean };
  pubT: number;
  strat: string;
  maxTauH: number;
  theory: theoryType;
  boughtVars: Array<varBuy>;
}

export function createResult(data: simResultInterface, stratExtra: null | string): simResult {
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
    rawData : {
      pubRho: data.pubRho,
      time: data.recovery.recoveryTime ? data.recovery.time : Math.max(0, data.pubT - data.recovery.time)
    },
    boughtVars: data.boughtVars
  }
}

export function resultIsSimResult(result: generalResult): result is simResult {
  return "strat" in result;
}

export function resultIsSimAllResult(result: generalResult): result is simAllResult {
  return "ratio" in result;
}

export function resultIsCombinedResult(result: generalResult): result is combinedResult {
  return Array.isArray(result);
}

export function defaultResult(): simResult {
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

export function getBestResult(res1: simResult | null, res2: simResult | null): simResult {
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