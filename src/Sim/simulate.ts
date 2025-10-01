import jsonData from "../Data/data.json" assert { type: "json" };
import { global } from "./main";
import { defaultResult, getBestResult, getTheoryFromIndex, logToExp, sleep } from "../Utils/helpers";
import { qs } from "../Utils/DOMhelpers";
import { getStrats } from "./strats";
import t1 from "../Theories/T1-T8/T1";
import t2 from "../Theories/T1-T8/T2";
import t3 from "../Theories/T1-T8/T3";
import t4 from "../Theories/T1-T8/T4";
import t5 from "../Theories/T1-T8/T5";
import t6 from "../Theories/T1-T8/T6";
import t7 from "../Theories/T1-T8/T7";
import t8 from "../Theories/T1-T8/T8";
import wsp from "../Theories/CTs/WSP";
import sl from "../Theories/CTs/SL";
import ef from "../Theories/CTs/EF";
import csr2 from "../Theories/CTs/CSR2";
import fi from "../Theories/CTs/FI";
import fp from "../Theories/CTs/FP";
import rz from "../Theories/CTs/RZ";
import mf from "../Theories/CTs/MF";
import bap from "../Theories/CTs/BaP";
import bt from "../Theories/Unofficial-CTs/BT";
import tc from "../Theories/Unofficial-CTs/TC";

const output = qs(".output");

const simFunction: { [key in theoryType]: ((data: theoryData) => Promise<simResult>) } = {
    T1: t1,
    T2: t2,
    T3: t3,
    T4: t4,
    T5: t5,
    T6: t6,
    T7: t7,
    T8: t8,
    WSP: wsp,
    SL: sl,
    EF: ef,
    CSR2: csr2,
    FI: fi,
    FP: fp,
    RZ: rz,
    MF: mf,
    BaP: bap,
    BT: bt,
    TC: tc
}

async function singleSim(query: SingleSimQuery): Promise<SingleSimResponse> {
    const strats = jsonData.stratCategories.includes(query.strat) 
        ? getStrats(query.theory, query.rho, query.strat, query.lastStrat ?? "")
        : [query.strat];

    let bestRes = defaultResult();
    for (let strat of strats) {
        const data: theoryData = {
            theory: query.theory,
            sigma: query.sigma,
            rho: query.rho,
            strat: strat,
            recovery: null,
            cap: query.cap ?? null,
            recursionValue: null,
            settings: query.settings
        }
        const res = await simFunction[query.theory](data);
        bestRes = getBestResult(bestRes, res);
    }

    return {
        responseType: "single",
        result: bestRes
    }
}

async function chainSim(query: ChainSimQuery): Promise<ChainSimResponse> {
    let rho = query.rho;
    let time = 0;
    let lastStrat = "";
    const results: simResult[] = [];
    const stopStr = logToExp(query.cap);
    let lastLog = 0;

    while (rho < query.cap) {
        const ts = performance.now();
        if (ts - lastLog > 250) {
            lastLog = ts;
            output.textContent = `Simulating ${logToExp(rho, 0)}/${stopStr}`;
            await sleep();
        }

        const res = (await singleSim({
            queryType: "single",
            theory: query.theory,
            strat: query.strat,
            rho: rho,
            sigma: query.sigma,
            settings: query.settings,
            cap: query.hardCap ? query.cap : undefined,
            lastStrat: lastStrat
        })).result;
        if (!global.simulating) break;

        results.push(res);
        rho = res.pubRho;
        lastStrat = res.strat.split(" ")[0];
        time += res.time;
    }

    const deltaTau = (rho - query.rho) * jsonData.theories[query.theory].tauFactor;

    return {
        responseType: "chain",
        results: results,
        deltaTau: deltaTau,
        averageRate: deltaTau / (time / 3600),
        totalTime: time
    }
}

async function stepSim(query: StepSimQuery): Promise<StepSimResponse> {
    let rho = query.rho;
    let lastStrat = "";
    const results: simResult[] = [];
    const stopStr = logToExp(query.cap);
    let lastLog = 0;

    while (rho < query.cap + 0.00001) {
        const ts = performance.now();
        if (ts - lastLog > 250) {
            lastLog = ts;
            output.textContent = `Simulating ${logToExp(rho, 0)}/${stopStr}`;
            await sleep();
        }

        const res = (await singleSim({
            queryType: "single",
            theory: query.theory,
            strat: query.strat,
            rho: rho,
            sigma: query.sigma,
            settings: query.settings,
            lastStrat: lastStrat
        })).result;
        if (!global.simulating) break;

        results.push(res);
        rho += query.step;
        lastStrat = res.strat.split(" ")[0];
    }

    return {
        responseType: "step",
        results: results
    }
}

async function simAll(query: SimAllQuery): Promise<SimAllResponse> {
    const results: simAllResult[] = [];
    const lastTheory = getTheoryFromIndex(query.values.length - 1 - query.values.slice().reverse().findIndex(v => v > 0));

    for (let i = 0; i < query.values.length; i++) {
        const theory = getTheoryFromIndex(i);
        const rho = query.values[i];
        if (rho <= 0) continue;
        if (!global.simulating) break;
        
        output.innerText = `Simulating ${theory}/${lastTheory}`;
        await sleep();

        const queryData: Omit<SingleSimQuery, "strat"> = {
            queryType: "single",
            theory: theory,
            rho: rho,
            sigma: query.sigma,
            settings: query.settings
        }
        const activeRes = query.stratType != "idle"
            ? (await singleSim({
                strat: query.veryActive ? "Best Overall" : "Best Active",
                ...queryData
            })).result
            : defaultResult();
        const idleRes = query.stratType != "active"
            ? (await singleSim({
                strat: query.semiIdle ? "Best Semi-Idle" : "Best Idle",
                ...queryData
            })).result
            : defaultResult();

        results.push({
            theory: theory,
            ratio: query.stratType == "all" ? activeRes.tauH / idleRes.tauH : 1,
            lastPub: rho,
            active: activeRes,
            idle: idleRes
        })
    }

    return {
        responseType: "all",
        sigma: query.sigma,
        stratType: query.stratType,
        completedCTs: query.settings.completedCTs,
        results: results
    }
}

export async function simulate(query: SimQuery): Promise<SimResponse> {
    switch (query.queryType) {
        case "single": return await singleSim(query);
        case "chain": return await chainSim(query);
        case "step": return await stepSim(query);
        case "all": return await simAll(query);
    }
}