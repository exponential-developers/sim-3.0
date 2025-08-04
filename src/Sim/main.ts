import jsonData from "../Data/data.json" assert { type: "json" };
import { qs, sleep, getTheoryFromIndex, logToExp, convertTime, formatNumber, defaultResult } from "../Utils/helpers.js";
import { parseData } from "./parsers.js";
import { getStrats } from "./strats.js";
import t1 from "../Theories/T1-T8/T1.js";
import t2 from "../Theories/T1-T8/T2.js";
import t3 from "../Theories/T1-T8/T3.js";
import t4 from "../Theories/T1-T8/T4.js";
import t5 from "../Theories/T1-T8/T5.js";
import t6 from "../Theories/T1-T8/T6.js";
import t7 from "../Theories/T1-T8/T7.js";
import t8 from "../Theories/T1-T8/T8.js";
import wsp from "../Theories/CTs/WSP.js";
import sl from "../Theories/CTs/SL.js";
import ef from "../Theories/CTs/EF.js";
import csr2 from "../Theories/CTs/CSR2.js";
import fi from "../Theories/CTs/FI";
import fp from "../Theories/CTs/FP.js";
import rz from "../Theories/CTs/RZ.js";
import mf from "../Theories/CTs/MF.js";
import bap from "../Theories/CTs/BaP.js";
import bt from "../Theories/Unofficial-CTs/BT.js";
import tc from "../Theories/Unofficial-CTs/TC";

const output = qs(".output");

export const global = {
  dt: 1.5,
  ddt: 1.0001,
  mfResetDepth: 0,
  stratFilter: true,
  simulating: false,
  forcedPubTime: Infinity,
  showA23: false,
  showUnofficials: false,
  simAllStrats: "all",
  skipCompletedCTs: false,
  customVal: null,
};

const cache = {
  lastStrat: "",
  simEndTimestamp: 0,
};

export interface inputData {
  theory: theoryType;
  strat: string;
  sigma: string;
  rho: string;
  cap: string;
  mode: string;
  hardCap: boolean;
  modeInput: string;
  simAllInputs: [boolean, boolean];
  timeDiffInputs: Array<string>;
}
export interface parsedData {
  theory: theoryType;
  strat: string;
  sigma: number;
  rho: number;
  cap: number;
  mode: string;
  simAllInputs: [boolean, boolean];
  hardCap?: boolean;
  modeInput?: string | Array<number> | Array<Array<Array<number>>> | number;
  recovery?: null | { value: number; time: number; recoveryTime: boolean };
}

export async function simulate(simData: inputData): Promise<string | null | Array<generalResult>> {
  if (global.simulating) {
    global.simulating = false;
    return "Sim stopped.";
  }
  if ((performance.now() - cache.simEndTimestamp) / 1000 < 1) return null;
  try {
    const pData: parsedData = parseData(simData);
    let res: Array<generalResult> = [];
    global.simulating = true;
    switch (pData.mode) {
      case "Single sim":
        const simres = await singleSim(pData);
        res = [simres];
        break;
      case "Chain":
        res = await chainSim(pData);
        break;
      case "Steps":
        res = await stepSim(pData);
        break;
      case "All":
        res = await simAll(pData);
        break;
    }
    cache.simEndTimestamp = performance.now();
    return res;
  } catch (err) {
    return String(err);
  }
}
async function singleSim(data: Omit<parsedData, "simAllInputs">): Promise<simResult> {
  if (jsonData.stratCategories.includes(data.strat)) return getBestStrat(data);
  const sendData: theoryData = {
    theory: data.theory,
    strat: data.strat,
    sigma: data.sigma,
    rho: data.rho,
    recursionValue: null,
    recovery: data.recovery ?? { value: 0, time: 0, recoveryTime: false },
    cap: data.hardCap ? data.cap : null,
  };
  switch (data.theory) {
    case "T1":
      return await t1(sendData);
    case "T2":
      return await t2(sendData);
    case "T3":
      return await t3(sendData);
    case "T4":
      return await t4(sendData);
    case "T5":
      return await t5(sendData);
    case "T6":
      return await t6(sendData);
    case "T7":
      return await t7(sendData);
    case "T8":
      return await t8(sendData);
    case "WSP":
      return await wsp(sendData);
    case "SL":
      return await sl(sendData);
    case "EF":
      return await ef(sendData);
    case "CSR2":
      return await csr2(sendData);
    case "FP":
      return await fp(sendData);
    case "FI":
      return await fi(sendData);
    case "RZ":
      return await rz(sendData);
    case "MF":
      return await mf(sendData);
    case "BaP":
      return await bap(sendData);
    case "BT":
      return await bt(sendData);
    case "TC":
      return await tc(sendData);
  }
}

async function chainSim(data: parsedData): Promise<Array<simResult | combinedResult>> {
  let lastPub: number = data.rho;
  let time = 0;
  const start = data.rho;
  const result: Array<simResult | combinedResult> = [];
  const stopOtp = logToExp(data.cap);
  let lastLog = 0;
  while (lastPub < data.cap) {
    const st = performance.now();
    if (st - lastLog > 250) {
      lastLog = st;
      output.textContent = `Simulating ${logToExp(lastPub, 0)}/${stopOtp}`;
      await sleep();
    }
    const res = await singleSim({ ...data });
    if (!global.simulating) break;
    if (typeof res.strat === "string") cache.lastStrat = res.strat.split(" ")[0];
    result.push(res);
    lastPub = res.rawData.pubRho;
    data.rho = lastPub;
    time += res.rawData.time;
  }
  cache.lastStrat = "";
  result.push(["ΔTau Total", `Average <span style="font-size:0.9rem; font-style:italics">&tau;</span>/h`, "Total Time"]);
  const dtau = (data.rho - start) * jsonData.theories[data.theory as theoryType].tauFactor;
  result.push([logToExp(dtau, 2), formatNumber(dtau / (time / 3600), 5), convertTime(time)]);
  return result;
}
async function stepSim(data: parsedData): Promise<Array<simResult>> {
  const result: Array<simResult> = [];
  const stopOtp = logToExp(data.cap);
  let lastLog = 0;
  while (data.rho < data.cap + 0.00001) {
    const st = performance.now();
    if (st - lastLog > 250) {
      lastLog = st;
      output.textContent = `Simulating ${logToExp(data.rho, 0)}/${stopOtp}`;
      await sleep();
    }
    const res = await singleSim({ ...data });
    if (!global.simulating) break;
    if (typeof res.strat === "string") cache.lastStrat = res.strat.split(" ")[0];
    result.push(res);
    data.rho += <number>data.modeInput;
  }
  cache.lastStrat = "";
  return result;
}
async function simAll(data: parsedData): Promise<Array<generalResult>> {
  const sigma = (<Array<number>>data.modeInput)[0];
  const values = (<Array<number>>data.modeInput).slice(1, (<Array<number>>data.modeInput).length);
  const res: Array<generalResult> = [];
  const totalSimmed = Math.min(values.length, global.showUnofficials ? Infinity : 17);
  let simRes:simResult | null;
  for (let i = 0; i < totalSimmed; i++) {
    if (values[i] === 0) continue;
    output.innerText = `Simulating ${getTheoryFromIndex(i)}/${getTheoryFromIndex(totalSimmed - 1)}`;
    await sleep();
    if (!global.simulating) break;
    const modes = [];
    if (global.simAllStrats !== "idle") modes.push(data.simAllInputs[1] ? "Best Overall" : "Best Active")
    if (global.simAllStrats !== "active") modes.push(data.simAllInputs[0] ? "Best Semi-Idle" : "Best Idle")
    const temp: Array<simResult> = [];
    for (let j = 0; j < modes.length; j++) {
      const sendData = {
        theory: getTheoryFromIndex(i),
        strat: modes[j],
        sigma,
        rho: values[i],
        cap: Infinity,
        mode: "Single Sim",
      };
      simRes = await singleSim(sendData);
      temp.push(simRes);
    }
    res.push(createSimAllOutput(temp));
  }
  return res;
}
function createSimAllOutput(arr: Array<simResult>): simResult | simAllResult {
  if (global.simAllStrats === "all") {
    return {
      theory: arr[0].theory,
      ratio: formatNumber(arr[0].tauH / arr[1].tauH, 4),
      lastPub: arr[0].lastPub,
      active: arr[0],
      idle: arr[1]
    }
  }
  else { return arr[0] }
}

async function getBestStrat(data: Omit<parsedData, "simAllInputs">): Promise<simResult> {
  const strats: Array<string> = getStrats(data.theory, data.rho, data.strat, cache.lastStrat);
  let bestSim: simResult = defaultResult();
  for (let i = 0; i < strats.length; i++) {
    data.strat = strats[i];
    const sim = await singleSim(data);
    if (bestSim.tauH < sim.tauH) bestSim = sim;
  }
  return bestSim;
}
