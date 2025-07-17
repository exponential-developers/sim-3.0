var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import jsonData from "../Data/data.json" assert { type: "json" };
import { qs, sleep, getTheoryFromIndex, logToExp, convertTime, formatNumber } from "../Utils/helpers.js";
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
    stratFilter: true,
    simulating: false,
    forcedPubTime: Infinity,
    showA23: false,
    showUnofficials: false,
    skipCompletedCTs: false,
    varBuy: [[0, [{ variable: "var", level: 0, cost: 0, timeStamp: 0 }]]],
    customVal: null,
};
const cache = {
    lastStrat: "",
    simEndTimestamp: 0,
};
export function simulate(simData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (global.simulating) {
            global.simulating = false;
            return "Sim stopped.";
        }
        if ((performance.now() - cache.simEndTimestamp) / 1000 < 1)
            return null;
        try {
            const pData = parseData(simData);
            let res = [];
            global.simulating = true;
            switch (pData.mode) {
                case "Single sim":
                    res = [(yield singleSim(pData)).map((v) => v.toString())];
                    break;
                case "Chain":
                    res = yield chainSim(pData);
                    break;
                case "Steps":
                    res = (yield stepSim(pData)).map((i) => i.map((v) => v.toString()));
                    break;
                case "All":
                    res = yield simAll(pData);
                    break;
            }
            cache.simEndTimestamp = performance.now();
            return res;
        }
        catch (err) {
            return String(err);
        }
    });
}
function singleSim(data) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (jsonData.stratCategories.includes(data.strat))
            return getBestStrat(data);
        const sendData = {
            theory: data.theory,
            strat: data.strat,
            sigma: data.sigma,
            rho: data.rho,
            recursionValue: null,
            recovery: (_a = data.recovery) !== null && _a !== void 0 ? _a : { value: 0, time: 0, recoveryTime: false },
            cap: data.hardCap ? data.cap : null,
        };
        switch (data.theory) {
            case "T1":
                return yield t1(sendData);
            case "T2":
                return yield t2(sendData);
            case "T3":
                return yield t3(sendData);
            case "T4":
                return yield t4(sendData);
            case "T5":
                return yield t5(sendData);
            case "T6":
                return yield t6(sendData);
            case "T7":
                return yield t7(sendData);
            case "T8":
                return yield t8(sendData);
            case "WSP":
                return yield wsp(sendData);
            case "SL":
                return yield sl(sendData);
            case "EF":
                return yield ef(sendData);
            case "CSR2":
                return yield csr2(sendData);
            case "FP":
                return yield fp(sendData);
            case "FI":
                return yield fi(sendData);
            case "RZ":
                return yield rz(sendData);
            case "MF":
                return yield mf(sendData);
            case "BaP":
                return yield bap(sendData);
            case "BT":
                return yield bt(sendData);
            case "TC":
                return yield tc(sendData);
        }
    });
}
function chainSim(data) {
    return __awaiter(this, void 0, void 0, function* () {
        let lastPub = data.rho;
        let time = 0;
        const start = data.rho;
        const result = [];
        const stopOtp = logToExp(data.cap);
        let lastLog = 0;
        while (lastPub < data.cap) {
            const st = performance.now();
            if (st - lastLog > 250) {
                lastLog = st;
                output.textContent = `Simulating ${logToExp(lastPub, 0)}/${stopOtp}`;
                yield sleep();
            }
            const res = yield singleSim(Object.assign({}, data));
            if (!global.simulating)
                break;
            if (typeof res[6] === "string")
                cache.lastStrat = res[6].split(" ")[0];
            result.push(res.map((v) => v.toString()));
            lastPub = res[9][0];
            data.rho = lastPub;
            time += res[9][1];
        }
        cache.lastStrat = "";
        result.push(["", "", "", "", "ΔTau Total", "", "", `Average <span style="font-size:0.9rem; font-style:italics">&tau;</span>/h`, "Total Time"]);
        const dtau = (data.rho - start) * jsonData.theories[data.theory].tauFactor;
        result.push(["", "", "", "", logToExp(dtau, 2), "", "", formatNumber(dtau / (time / 3600), 5), convertTime(time)]);
        return result;
    });
}
function stepSim(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = [];
        const stopOtp = logToExp(data.cap);
        let lastLog = 0;
        while (data.rho < data.cap + 0.00001) {
            const st = performance.now();
            if (st - lastLog > 250) {
                lastLog = st;
                output.textContent = `Simulating ${logToExp(data.rho, 0)}/${stopOtp}`;
                yield sleep();
            }
            const res = yield singleSim(Object.assign({}, data));
            if (!global.simulating)
                break;
            if (typeof res[6] === "string")
                cache.lastStrat = res[6].split(" ")[0];
            result.push(res);
            data.rho += data.modeInput;
        }
        cache.lastStrat = "";
        return result;
    });
}
function simAll(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const sigma = data.modeInput[0];
        const values = data.modeInput.slice(1, data.modeInput.length);
        const res = [];
        const totalSimmed = Math.min(values.length, global.showUnofficials ? Infinity : 17);
        for (let i = 0; i < totalSimmed; i++) {
            if (values[i] === 0)
                continue;
            output.innerText = `Simulating ${getTheoryFromIndex(i)}/${getTheoryFromIndex(totalSimmed - 1)}`;
            yield sleep();
            if (!global.simulating)
                break;
            const modes = [data.simAllInputs[0] ? "Best Semi-Idle" : "Best Idle", data.simAllInputs[1] ? "Best Overall" : "Best Active"];
            const temp = [];
            for (let j = 0; j < modes.length; j++) {
                const sendData = {
                    theory: getTheoryFromIndex(i),
                    strat: modes[j],
                    sigma,
                    rho: values[i],
                    cap: Infinity,
                    mode: "Single Sim",
                };
                temp.push(yield singleSim(sendData));
            }
            res.push(createSimAllOutput(temp));
        }
        res.push([sigma.toString()]);
        return res;
    });
}
function createSimAllOutput(arr) {
    return [
        arr[0][0],
        arr[0][2],
        formatNumber(arr[1][7] / arr[0][7], 4),
        arr[1][7],
        arr[0][7],
        arr[1][5],
        arr[0][5],
        arr[1][6],
        arr[0][6],
        arr[1][8],
        arr[0][8],
        arr[1][4],
        arr[0][4],
        arr[1][3],
        arr[0][3], // Pub Rho Passive
    ].map((v) => v.toString());
}
function getBestStrat(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const strats = getStrats(data.theory, data.rho, data.strat, cache.lastStrat);
        let bestSim = ["", 0, "", "", "", "", "", 0, "", [0, 0]];
        for (let i = 0; i < strats.length; i++) {
            data.strat = strats[i];
            const sim = yield singleSim(data);
            if (bestSim[7] < sim[7])
                bestSim = sim;
        }
        return bestSim;
    });
}
