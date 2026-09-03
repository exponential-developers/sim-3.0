import jsonData from "../Data/data.json" with { type: "json" };
import { collectorCache, noopCollector, StepPubTableCollector } from "../Utils/pubTableCollector";
import { global } from "./main";
import { convertTime, defaultResult, getBestResult, getTheoryFromIndex, isMainTheory, logToExp, refreshDOMEventLoop, sleep } from "../Utils/helpers";
import { getStrats } from "./strats";
import T1 from "../Theories/T1-T8/T1";
import T2 from "../Theories/T1-T8/T2";
import T3 from "../Theories/T1-T8/T3";
import T4 from "../Theories/T1-T8/T4";
import T5 from "../Theories/T1-T8/T5";
import T6 from "../Theories/T1-T8/T6";
import T7 from "../Theories/T1-T8/T7";
import T8 from "../Theories/T1-T8/T8";
import WSP from "../Theories/CTs/WSP";
import SL from "../Theories/CTs/SL";
import EF from "../Theories/CTs/EF";
import CSR2 from "../Theories/CTs/CSR2";
import FI from "../Theories/CTs/FI";
import FP from "../Theories/CTs/FP";
import RZ from "../Theories/CTs/RZ";
import MF from "../Theories/CTs/MF";
import BaP from "../Theories/CTs/BaP";
import BT from "../Theories/Unofficial-CTs/BT";
import TC from "../Theories/Unofficial-CTs/TC";
import FS from "../Theories/Unofficial-CTs/FS";
import BD from "../Theories/Unofficial-CTs/BD";
import ILC from "../Theories/Unofficial-CTs/ILC";
import UI from "../UI/elements";


const theoryInterface: { [theory in theoryType]: TheoryInterface<theory> } = {
    T1,
    T2,
    T3,
    T4,
    T5,
    T6,
    T7,
    T8,
    WSP,
    SL,
    EF,
    CSR2,
    FI,
    FP,
    RZ,
    MF,
    BaP,
    BT,
    TC,
    FS,
    BD,
    ILC,
}

async function simulateOnce<T extends theoryType, S extends stratType[T]>(
    strat: S,
    stratSpecificInputs: StratSpecificInputRecord<T, S>,
    query: Omit<SingleSimQuery<T, stratType[T]>, "strat" | "stratSpecificInputs">
): Promise<simResult<T>> {
    const data: theoryData<T, S> = {
        theory: query.theory,
        specificInputs: query.theorySpecificInputs,
        stratSpecificInputs,
        sigma: query.sigma,
        input: query.input,
        strat,
        cap: query.cap,
        recursionValue: null,
        settings: query.settings
    }
    const res = await theoryInterface[query.theory].simulate(data);
    return res;
}

async function singleSim<T extends theoryType>(query: SingleSimQuery<T>): Promise<SingleSimResponse<T>> {
    const converter = theoryInterface[query.theory].converter;
    const strats = query.strat == "Best Active" 
    || query.strat == "Best Overall" 
    || query.strat == "Best Semi-Idle" 
    || query.strat == "Best Idle"
        ? getStrats(
            query.theory, 
            converter.convertTo(query.input, "tau", query.sigma),
            converter.supportsRho ? converter.convertTo(query.input, "rho", query.sigma) : 0, 
            query.strat, 
            query.lastStrat ?? ""
        )
        : [query.strat];

    let bestRes = defaultResult();
    
    for (let strat of strats) {
        const res = await simulateOnce(
            strat, 
            query.stratSpecificInputs, 
            query
        );
        bestRes = getBestResult(bestRes, res);
    }

    return {
        responseType: "single",
        result: bestRes as simResult<T>
    }
}

async function chainSim<T extends theoryType>(query: ChainSimQuery<T>, doLog = true): Promise<ChainSimResponse> {
    const converter = theoryInterface[query.theory].converter;
    const start = converter.convertTo(query.input, "tau", query.sigma);
    const cap = converter.convertTo(query.cap, "tau", query.sigma);
    let tau = start;
    let time = 0;
    let lastStrat = "";
    const results: simResult<T>[] = [];
    const stopStr = logToExp(converter.supportsRho ? converter.convertTo(query.cap, "rho", query.sigma) : cap);
    let lastLog = 0;

    let theorySpecificInputs: SpecificInputRecord<T> = query.theorySpecificInputs;

    while (tau < cap) {
        const ts = performance.now();
        if (ts - lastLog > 250 && doLog) {
            lastLog = ts;
            UI.outputs.log.textContent = `Simulating ${logToExp(converter.supportsRho ? converter.convertTo({
                valueType: "tau",
                value: tau
            }, "rho") : tau, 0)}/${stopStr}`;
            await refreshDOMEventLoop();
        }

        const res = (await singleSim({
            queryType: "single",
            theory: query.theory,
            theorySpecificInputs,
            stratSpecificInputs: query.stratSpecificInputs,
            strat: query.strat,
            input: { valueType: "tau", value: tau },
            sigma: query.sigma,
            settings: query.settings,
            cap: query.hardCap ? query.cap : undefined,
            lastStrat: lastStrat
        })).result;
        if (!global.simulating) break;

        results.push(res);
        tau = res.pubPointTau;
        lastStrat = res.strat.split(" ")[0];
        time += res.time;
        if (res.theorySpecificInputs) {
            theorySpecificInputs = { ...theorySpecificInputs, ...res.theorySpecificInputs };
        }
    }

    const deltaTau = tau - start;

    return {
        responseType: "chain",
        results: results,
        deltaTau: deltaTau,
        averageRate: deltaTau / (time / 3600),
        totalTime: time
    }
}

async function amountSim<T extends theoryType>(query: AmountSimQuery<T>, doLog = true): Promise<ChainSimResponse> {
    const converter = theoryInterface[query.theory].converter;
    const start = converter.convertTo(query.input, "tau", query.sigma);

    let tau = start;
    let time = 0;
    let lastStrat = "";
    const results: simResult[] = [];
    let lastLog = 0;

    for (let i = 0; i < query.amount; i++) {
        const ts = performance.now();
        if (ts - lastLog > 250 && doLog) {
            lastLog = ts;
            UI.outputs.log.textContent = `Simulating ${i+1}/${query.amount} pubs`;
            await sleep();
        }

        const res = (await singleSim({
            queryType: "single",
            theory: query.theory,
            theorySpecificInputs: query.theorySpecificInputs,
            stratSpecificInputs: query.stratSpecificInputs,
            strat: query.strat,
            input: { valueType: "tau", value: tau },
            sigma: query.sigma,
            settings: query.settings,
            lastStrat: lastStrat
        })).result;
        if (!global.simulating) break;

        results.push(res);
        tau = res.pubPointTau;
        lastStrat = res.strat.split(" ")[0];
        time += res.time;
    }

    const deltaTau = tau - start;

    return {
        responseType: "chain",
        results: results,
        deltaTau: deltaTau,
        averageRate: deltaTau / (time / 3600),
        totalTime: time
    }
}

async function timeSim<T extends theoryType>(query: TimeSimQuery<T>): Promise<ChainSimResponse> {
    const converter = theoryInterface[query.theory].converter;
    const start = converter.convertTo(query.input, "tau", query.sigma);

    let tau = start;
    let time = 0;
    let lastStrat = "";
    const results: simResult[] = [];
    const stopStr = convertTime(query.time);
    let lastLog = 0;

    while (time < query.time) {
        const ts = performance.now();
        if (ts - lastLog > 250) {
            lastLog = ts;
            UI.outputs.log.textContent = `Simulating ${convertTime(time)}/${stopStr}`;
            await sleep();
        }

        const res = (await singleSim({
            queryType: "single",
            theory: query.theory,
            theorySpecificInputs: query.theorySpecificInputs,
            stratSpecificInputs: query.stratSpecificInputs,
            strat: query.strat,
            input: { valueType: "tau", value: tau },
            sigma: query.sigma,
            settings: query.settings,
            lastStrat: lastStrat
        })).result;
        if (!global.simulating) break;

        results.push(res);
        tau = res.pubPointTau;
        lastStrat = res.strat.split(" ")[0];
        time += res.time;
    }

    const deltaTau = tau - start;

    return {
        responseType: "chain",
        results: results,
        deltaTau: deltaTau,
        averageRate: deltaTau / (time / 3600),
        totalTime: time
    }
}

async function stepSim<T extends theoryType>(query: StepSimQuery<T>): Promise<StepSimResponse> {
    const converter = theoryInterface[query.theory].converter;
    const start = converter.convertTo(query.input, "tau", query.sigma);
    const cap = converter.convertTo(query.cap, "tau", query.sigma);

    //! TEMPORARY SOLUTION
    let calculateNextStep = (val: number) => converter.supportsRho
        ? converter.convertTo(
            {
                valueType: "rho",
                value: converter.convertTo({ valueType: "tau", value: val }, "rho", query.sigma) + query.step
            }
            , "tau", query.sigma)
        : val + query.step;

    let tau = start;
    let lastStrat = "";
    const results: simResult[] = [];
    const stopStr = logToExp(converter.supportsRho ? converter.convertTo(query.cap, "rho", query.sigma) : cap);
    let lastLog = 0;

    while (tau < cap + 0.00001) {
        const ts = performance.now();
        if (ts - lastLog > 250) {
            lastLog = ts;
            UI.outputs.log.textContent = `Simulating ${logToExp(converter.supportsRho ? converter.convertTo({
                valueType: "tau",
                value: tau
            }, "rho") : tau, 0)}/${stopStr}`;
            await sleep();
        }

        const res = (await singleSim({
            queryType: "single",
            theory: query.theory,
            theorySpecificInputs: query.theorySpecificInputs,
            stratSpecificInputs: query.stratSpecificInputs,
            strat: query.strat,
            input: { valueType: "tau", value: tau },
            sigma: query.sigma,
            settings: query.settings,
            lastStrat: lastStrat
        })).result;
        if (!global.simulating) break;

        results.push(res);
        tau = calculateNextStep(tau);
        lastStrat = res.strat.split(" ")[0];
    }

    return {
        responseType: "step",
        results: results
    }
}

async function pubTableSim(query: PubTableSimQuery): Promise<PubTableResponse> {
    const converter = theoryInterface[query.theory].converter;
    if (!converter.supportsRho) throw "This mode is not supported for this theory";
    let rho = converter.convertTo(query.input, "rho", query.sigma);
    let cap = converter.convertTo(query.cap, "rho", query.sigma);
    const stopStr = logToExp(rho);

    let current = cap - query.step;
    let lastLog = 0;
    let lastStrat = "";
    let pubTable: [number, number][] = [[0, 0]]; // Cap is reachable in 0 time.
    while(current > rho - 0.00001) {
        const ts = performance.now();
        if (ts - lastLog > 250) {
            lastLog = ts;
            UI.outputs.log.textContent = `Simulating ${logToExp(current, 0)}/${stopStr}`;
            await sleep();
        }
        let pubCollector = new StepPubTableCollector(current, query.step, cap);
        collectorCache.currentCollector = pubCollector;
        const res = (await singleSim({
            queryType: "single",
            theory: query.theory,
            theorySpecificInputs: {},
            stratSpecificInputs: {},
            strat: query.strat as FullStratType<theoryType>,
            input: { valueType: "rho", value: current},
            sigma: query.sigma,
            settings: query.settings,
            lastStrat: lastStrat
        })).result;
        if (!global.simulating) break;
        current -= query.step;
        lastStrat = res.strat.split(" ")[0];
        let currentTable = pubCollector.timings;
        let min_time = Infinity;
        let min_target = Infinity;
        for(let i = currentTable.length - 1; i > 0; i--) {
            let step_delta = i * query.step;
            if(current + step_delta > cap + 0.0000001) {
                //We overshot.
                continue;
            }
            if(pubTable[pubTable.length - i][0] + currentTable[i] < min_time) {
                min_time = pubTable[pubTable.length - i][0] + currentTable[i];
                min_target = cap - (pubTable.length - i) * query.step
            }
        }
        pubTable.push([min_time, min_target]);
    }
    collectorCache.currentCollector = noopCollector;
    return {
        cap: cap,
        start: rho,
        step: query.step,
        responseType: "pub_table",
        pub_table: pubTable
    }
}

async function comparisonSim<T extends theoryType>(query: ComparisonSimQuery<T>): Promise<StepSimResponse> {
    const converter = theoryInterface[query.theory].converter;
    const strats = getStrats(
        query.theory, 
        converter.convertTo(query.input, "tau", query.sigma), 
        converter.convertTo(query.input, "rho", query.sigma),
        "", 
        "", 
        false
    );
    const results: simResult[] = [];

    for (let strat of strats) {
        results.push((await singleSim({
            ...query,
            queryType: "single",
            strat,
            stratSpecificInputs: {} as GeneralStratSpecificInputRecord<T, stratType[T]>
        })).result)
    }

    return {
        responseType: "step",
        results: results.sort((r1, r2) => r2.tauH - r1.tauH)
    }
}

async function simAll(query: SimAllQuery): Promise<SimAllResponse> {
    const results: simAllResult[] = [];
    const lastTheory = getTheoryFromIndex(
        query.values.length - 1 - query.values.slice().reverse().findIndex(
            (v, i) => {
                const theory = getTheoryFromIndex(query.values.length - 1 - i);
                const converter = theoryInterface[theory].converter;
                return !(v == "cache" || v == "ignore") && 
                    (isMainTheory(theory) || query.settings.completedCTs !== "no" || converter.convertTo(v, "tau", query.sigma) < 600);
            }
        )
    );

    for (let i = 0; i < query.values.length; i++) {
        const theory = getTheoryFromIndex(i);
        const converter = theoryInterface[theory].converter;
        const value = query.values[i];
        if (value == "cache" || value == "ignore") continue;
        if (query.settings.completedCTs === "no" && !isMainTheory(theory) && converter.convertTo(value, "tau", query.sigma) >= 600) continue;
        if (!global.simulating) break;

        UI.outputs.log.innerText = `Simulating ${theory}/${lastTheory}`;
        await sleep();

        const queryData: Omit<SingleSimQuery<typeof theory>, "strat"> = {
            queryType: "single",
            theory: theory,
            theorySpecificInputs: query.theorySpecificInputs[theory],
            stratSpecificInputs: {},
            input: value,
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
            lastPubTau: converter.convertTo(value, "tau", query.sigma),
            lastPubRho: converter.supportsRho ? converter.convertTo(value, "rho", query.sigma) : undefined,
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

async function stepChainSim<T extends theoryType>(query: StepChainQuery<T>): Promise<StepSimResponse> {
    const converter = theoryInterface[query.theory].converter;
    const start = converter.convertTo(query.input, "tau", query.sigma);
    const cap = converter.convertTo(query.cap, "tau", query.sigma);

    //! TEMPORARY SOLUTION
    let calculateNextStep = (val: number, mult: number = 1) => converter.supportsRho
        ? converter.convertTo(
            {
                valueType: "rho",
                value: converter.convertTo({ valueType: "tau", value: val }, "rho", query.sigma) + query.step * mult
            }
            , "tau", query.sigma)
        : val + query.step * mult;

    let tau = start;
    const results: simResult[] = [];
    const stopStr = logToExp(converter.supportsRho ? converter.convertTo(query.cap, "rho", query.sigma) : cap);
    let lastLog = 0;

    while (tau < calculateNextStep(cap, -1) + 0.000001) {
        const ts = performance.now();
        if (ts - lastLog > 250) {
            lastLog = ts;
            UI.outputs.log.textContent = `Simulating ${logToExp(converter.supportsRho ? converter.convertTo({
                valueType: "tau",
                value: tau
            }, "rho") : tau, 0)}/${stopStr}`;
            await sleep();
        }

        const chain_res = await chainSim({
            queryType: "chain",
            settings: query.settings,
            sigma: query.sigma,
            input: { valueType: "tau", value: tau },
            theory: query.theory,
            theorySpecificInputs: query.theorySpecificInputs,
            stratSpecificInputs: query.stratSpecificInputs,
            strat: query.strat,
            cap: query.cap,
            hardCap: query.hardCap
        }, false);
        if (!global.simulating) break;

        let tau_acc = 0;
        let time_acc = 0;
        let pub_count = 0;
        let bestRes = defaultResult();
        for (let result of chain_res.results) {
            tau_acc += result.deltaTau;
            time_acc += result.time;
            pub_count++;
            const tauH = tau_acc / (time_acc / 3600);
            let cur_res: simResult = {
                theory: query.theory,
                sigma: query.sigma,
                lastPubTau: tau,
                pubPointTau: result.pubPointTau,
                deltaTau: tau_acc,
                pubMulti: 1,
                strat: pub_count + " pub" + (pub_count > 1 ? "s": ""),
                tauH: tauH,
                time: time_acc,
                boughtVars: []
            }
            bestRes = getBestResult(bestRes, cur_res);
        }
        results.push(bestRes);
        tau += query.step;
    }

    return {
        responseType: "step",
        results: results
    }
}

export async function simulate(query: SimQuery): Promise<SimResponse> {
    switch (query.queryType) {
        case "single": return await singleSim(query);
        case "chain": return await chainSim(query);
        case "step": return await stepSim(query);
        case "comparison": return await comparisonSim(query);
        case "all": return await simAll(query);
        case "step_chain": return await stepChainSim(query);
        case "pub_table": return await pubTableSim(query);
        case "amount": return await amountSim(query);
        case "time": return await timeSim(query);
        default: {
            console.log(query);
            throw "Unimplemented";
        }
    }
}
