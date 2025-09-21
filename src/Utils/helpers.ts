import jsonData from "../Data/data.json" assert { type: "json" };

/** Returns the index of the first occurrence of `val` in `arr`, or -1 if not found */
export function findIndex<T>(arr: T[], val: T): number {
  for (let i = 0; i < arr.length; i++) if (val === arr[i]) return i;
  return -1;
}
/** Sleeps the given number of seconds */
export function sleep(time = 0) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

/** Alias of Math.log10 */
export let l10 = Math.log10;
/** Alias of Math.log2 */
export let l2 = Math.log2;

/** Returns the index matching the theory */
export function getIndexFromTheory(theory: string): number {
  return findIndex(Object.keys(jsonData.theories), theory);
}
/** Returns the theory matching the index */
export function getTheoryFromIndex(index: number): theoryType {
  return Object.keys(jsonData.theories)[index] as theoryType;
}

/** Parses a value of the form x.xex to a log10 value */
export function parseLog10String(num: string): number {
  const split = num.split("e");
  const result = Number(split[1]) + l10(Math.max(1, Number(split[0])));
  return result;
}

/** Formats a log10 value as a string */
export function logToExp(num: number, dec = 3): string {
  const wholePart = Math.floor(num);
  const fractionalPart = num - wholePart;
  const frac1 = round(10 ** fractionalPart, dec);
  return (frac1 >= 10 ? frac1 / 10 : frac1) + "e" + (frac1 >= 10 ? wholePart + 1 : wholePart);
}
/** Returns a time string for the given number of seconds */
export function convertTime(secs: number): string {
  const mins = Math.floor((secs / 60) % 60);
  const hrs = Math.floor((secs / 3600) % 24);
  const days = Math.floor((secs / 86400) % 365);
  const years = Math.floor(secs / 31536000);
  let result = "";
  if (years > 0) {
    result += years < 1e6 ? years : logToExp(l10(years));
    result += "y";
  }
  if (days > 0) result += days + "d";
  result += (hrs < 10 ? "0" : "") + hrs + "h";
  if (years === 0) result += (mins < 10 ? "0" : "") + mins + "m";
  return result;
}

/** 
 * Formats a number to the given precision 
 * 
 * This function removes the `+` in the scientific form
 * */
export function formatNumber(value: number, precision = 6): string {
  return value.toPrecision(precision).replace(/[+]/, "");
}

/** Rounds `number` to `decimals` decimals */
export function round(number: number, decimals: number): number {
  return Math.round(number * 10 ** decimals) / 10 ** decimals;
}

/** Converts an element to a function with no parameter returning this element, if it is not already a function */
export function toCallable<T>(val: T | (() => T)): () => T {
  return typeof val === "function" ? (val as () => T) : () => val;
}
/** Converts all elements in an array to a function with no parameter returning this element, if it is not already a function */
export function toCallables<T>(arr: (T | (() => T))[]): (() => T)[] {
  return arr.map((val) => toCallable(val));
}

export function add_old(value1: number, value2: number): number {
  const max = value1 > value2 ? value1 : value2;
  const min = value1 > value2 ? value2 : value1;
  const wholePart1 = Math.floor(max);
  const fractionalPart1 = 10 ** (max - wholePart1);
  const wholePart2 = Math.floor(min);
  const fractionalPart2 = 10 ** (min - wholePart2);
  return wholePart1 + l10(fractionalPart1 + fractionalPart2 / 10 ** (wholePart1 - wholePart2));
}

/** Adds two log10 values 
 * @returns the result as a log10 value
*/
export function add2(value1: number, value2: number): number {
  const max = value1 > value2 ? value1 : value2;
  const min = value1 > value2 ? value2 : value1;
  return max != -Infinity ? max + l10(1 + 10**(min-max)) : max;
}

/** Adds multiple log10 values 
 * @returns the result as a log10 value
*/
export function add(...values: number[]): number {
  if (values.length === 0) return -Infinity;
  if (values.length === 1) return values[0];
  if (values.length === 2) return add2(values[0], values[1]);
  let sum = add2(values[0], values[1]);
  for (let i = 2; i < values.length; i++) {
    sum = add2(sum, values[i]);
  }
  return sum;
}

export function subtract_old(value1: number, value2: number): number {
  const max = value1 > value2 ? value1 : value2;
  const min = value1 > value2 ? value2 : value1;
  const wholePart1 = Math.floor(max);
  const fractionalPart1 = 10 ** (max - wholePart1);
  const wholePart2 = Math.floor(min);
  const fractionalPart2 = 10 ** (min - wholePart2);
  return wholePart1 + l10(fractionalPart1 - fractionalPart2 / 10 ** (wholePart1 - wholePart2));
}

/** Subtracts two log10 values
 * @returns the result as a log10 value
 */
export function subtract(value1: number, value2: number): number {
  const max = value1 > value2 ? value1 : value2;
  const min = value1 > value2 ? value2 : value1;
  return max != -Infinity ? max + l10(1 - 10**(min-max)) : max;
}

/**
 * Returns the index `target` would have if inserted in `arr`
 * 
 * This is equivalent to count how many elements in `arr` are strictly lower than `target`
 * @param arr Number array sorted in increasing order with no repetitions
 * @param target Target number
 */
export function binaryInsertionSearch(arr: number[], target: number): number {
  if (target < arr[0]) return 0;
  let l = 0;
  let r = arr.length - 1;
  while (l < r) {
    const m = Math.ceil((l + r) / 2);
    if (arr[m] <= target) l = m;
    else r = m - 1;
  }
  return l + 1;
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

/** Returns a default simResult */
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

/**
 * Return the result with the highest tau/hr.
 * 
 * If one result is null, returns the other result.
 * If both results are null, returns the default result.
 */
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

/**
 * Returns the last bought level of a variable in a variable buy list
 * @param variable The variable name to search
 * @param arr The variable buy list
 * @returns The last level bought of the variable, or 0 if the variable was not found
 */
export function getLastLevel(variable: string, arr: varBuy[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].variable == variable) {
      return arr[i].level;
    }
  }
  return 0;
}

/**
 * @param {number} sigma Number of students
 * @returns the R9 multiplier as a log value
*/
export function getR9multiplier(sigma: number): number {
  return l10((sigma / 20) ** (sigma < 65 ? 0 : sigma < 75 ? 1 : sigma < 85 ? 2 : 3))
}

export function getdtFromSlider(val: number): number {
  return val == 0 ? 0.15 : val == 10 ? 5 : 0.15 + (2 ** val) * (4.85 / 2 ** 10);
}

export function getddtFromSlider(val: number): number {
  return val == 0 ? 1 : val == 10 ? 1.3 : round(1 + (3 ** val) * (0.3 / 3 ** 10), 7)
}