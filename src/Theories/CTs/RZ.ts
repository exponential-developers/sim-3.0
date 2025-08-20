import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep, binarySearch, getBestResult } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue, LinearValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";
import { c1Exp, getBlackholeSpeed, lookups, resolution, zeta, ComplexValue } from "./helpers/RZ.js";
import goodzeros from "./helpers/RZgoodzeros.json" assert { type: "json" };

import { ExponentialCost, StepwiseCost, CompositeCost, ConstantCost, FirstFreeCost, BaseCost } from '../../Utils/cost.js';

type theory = "RZ";

class VariableBcost extends BaseCost {
    getCost(level: number) {
        return [15, 45, 360, 810, 1050, 1200][level];
    }
    copy(): VariableBcost {
        return new VariableBcost()
    }
}

function mergeSortedLists(list1: Array<number>, list2: Array<number>): Array<number> {
    let mergedList = [];
    let i = 0; // Pointer for list1
    let j = 0; // Pointer for list2

    // Merge lists while both have elements left
    while (i < list1.length && j < list2.length) {
        if (list1[i] <= list2[j]) {
            mergedList.push(list1[i]);
            i++;
        } else {
            mergedList.push(list2[j]);
            j++;
        }
    }

    // Add remaining elements from list1, if any
    while (i < list1.length) {
        mergedList.push(list1[i]);
        i++;
    }

    // Add remaining elements from list2, if any
    while (j < list2.length) {
        mergedList.push(list2[j]);
        j++;
    }

    return mergedList;
}

let rzZeros = mergeSortedLists(goodzeros.genericZeros, goodzeros.rzSpecificZeros);
let rzdZeros = mergeSortedLists(goodzeros.genericZeros, goodzeros.rzdSpecificZeros);

export default async function rz(data: theoryData) {
    // Normal BH
    if(data.strat.includes("BH") && !data.strat.includes("Rewind") && data.rho >= 600) {
        let zeroList = data.strat.startsWith("RZd") ? rzdZeros : rzZeros;
        if(data.strat.includes("Long")) {
            zeroList = goodzeros.longZeros;
        }
        let startZeroIndex = 0;
        let sim: rzSim | null = new rzSim(data);
        sim.bhAtRecovery = true;
        let bestSimRes: simResult | null = await sim.simulate();
        let boundaryCondition = null;
        if(!data.strat.startsWith("RZd")) {
            for(let x of goodzeros.rzIdleBHBoundaries) {
                if(data.rho <= x.toRho) {
                    boundaryCondition = x;
                    break;
                }
            }
        }
        else {
            for(let x of goodzeros.rzdIdleBoundaries) {
                if(data.rho <= x.toRho) {
                    boundaryCondition = x;
                    break;
                }
            }
        }
        if(data.strat.includes("Long")) {
            boundaryCondition = {
                "toRho": 9999999999, "from": 3000, "to": 999999999
            }
            bestSimRes = null;
        }
        for(let i = startZeroIndex; i < zeroList.length; i++) {
            let zero = zeroList[i];
            if(boundaryCondition != null) {
                if(zero < boundaryCondition.from || zero > boundaryCondition.to) {
                    continue;
                }
            }
            let internalSim = new rzSim(data)
            internalSim.targetZero = zero;
            let res = await internalSim.simulate();
            bestSimRes = getBestResult(bestSimRes, res);

            if(!data.strat.startsWith("RZd")) {
                // Actual bounds are 14 to 18, saves 23m, but performance is shit.
                for (let j = 14; j <= 15; j++) {
                    let internalSim3 = new rzSim(data)
                    internalSim3.targetZero = zero;
                    internalSim3.normalPubRho = internalSim.pubRho;
                    internalSim3.maxC1Level = internalSim.variables[0].level - j;
                    internalSim3.maxC1LevelActual = internalSim.variables[0].level;
                    let res3 = await internalSim3.simulate();
                    bestSimRes = getBestResult(bestSimRes, res3);
                }
            }
            else {
                let internalSim2 = new rzSim(data)
                internalSim2.targetZero = zero;
                internalSim2.normalPubRho = internalSim.pubRho;
                internalSim2.maxC1LevelActual = internalSim.variables[0].level;
                let res2 = await internalSim2.simulate();
                bestSimRes = getBestResult(bestSimRes, res2);
            }
        }
        if(bestSimRes == null) {
            throw new Error("result somehow not set?");
        }
        return bestSimRes;
    }
    else if(data.strat.includes("BHRewind") && data.rho >= 600){
        let zeroList = rzdZeros;
        let zeroRewindList = goodzeros.rzRewind;
        let startZeroIndex = 0;
        let sim: rzSim | null = new rzSim(data);

        sim.bhAtRecovery = true;
        let bestSimRes: simResult | null = await sim.simulate();
        let bestSimRes2: simResult | null = null;
        let boundaryCondition = null;
        for(let x of goodzeros.rzIdleBHBoundaries) {
            if(data.rho <= x.toRho) {
                boundaryCondition = x;
                break;
            }
        }
        // Get best normal zero
        for(let i = startZeroIndex; i < zeroList.length; i++) {
            let zero = zeroList[i];
            if(boundaryCondition != null) {
                if(zero < boundaryCondition.from || zero > boundaryCondition.to) {
                    continue;
                }
            }
            let internalSim = new rzSim(data)
            internalSim.targetZero = zero;
            let res = await internalSim.simulate();
            bestSimRes = getBestResult(bestSimRes, res);

            let internalSim2 = new rzSim(data)
            internalSim2.targetZero = zero;
            internalSim2.normalPubRho = internalSim.pubRho;
            internalSim2.maxC1LevelActual = internalSim.variables[0].level;
            let res2 = await internalSim2.simulate();
            bestSimRes = getBestResult(bestSimRes, res2);
        }

        let maxW1 = Infinity;
        for (let i = bestSimRes.boughtVars.length - 1; i >= 0; i--){
            if (bestSimRes.boughtVars[i].variable === "w1"){
                maxW1 = bestSimRes.boughtVars[i].level;
                break;
            }
        }
        if (maxW1 % 6 != 0){
            maxW1 += 6 - (maxW1 % 6)
        }

        let rewindBoundaryCondition = null;
        for(let x of goodzeros.rzRewindBoundaries) {
            if(data.rho <= x.toRho) {
                rewindBoundaryCondition = x;
                break;
            }
        }

        const extraW1s = [6, 12]; // 18 rarely better so disabled due to performance

        for (let extraW1 of extraW1s){
            for(let i = 0; i < zeroRewindList.length; i++){
                let rewindPoint = zeroRewindList[i];

                if(rewindBoundaryCondition != null) {
                    if(rewindPoint < rewindBoundaryCondition.from || rewindPoint > rewindBoundaryCondition.to) {
                        continue;
                    }
                }

                let internalSim = new rzSim(data)
                internalSim.targetZero = rewindPoint;
                internalSim.maxW1 = maxW1 + extraW1;
                let res = await internalSim.simulate();
                bestSimRes2 = getBestResult(bestSimRes2, res);

                let internalSim2 = new rzSim(data)
                internalSim2.targetZero = rewindPoint;
                internalSim2.maxW1 = maxW1 + extraW1;
                internalSim2.normalPubRho = internalSim.pubRho;
                internalSim2.maxC1LevelActual = internalSim.variables[0].level;
                let res2 = await internalSim2.simulate();
                bestSimRes2 = getBestResult(bestSimRes2, res2);
            }
        }
        if(bestSimRes2 == null) {
            throw new Error("result somehow not set?");
        }
        return bestSimRes2;
    }
    else if(data.strat.includes("MS") && data.rho <= 400 && data.rho >= 10) {
        const swapPointDeltas = [0, -1, -2, -3, -4, -5, -6];
        let normalRets = [];
        for(let i = 0; i < swapPointDeltas.length; i++) {
            let normalSim = new rzSim(data);
            normalSim.swapPointDelta = swapPointDeltas[i];
            normalRets.push(await normalSim.simulate());
        }
        let coastRets = [];
        for(let i = 0; i < normalRets.length; i++) {
            let ss = new rzSim(data);
            ss.normalPubRho = normalRets[i].rawData.pubRho;
            ss.swapPointDelta = swapPointDeltas[i];
            coastRets.push(await ss.simulate());
        }
        let retArr = [];
        for(let ret of normalRets) {
            retArr.push(ret);
        }
        for(let ret of coastRets) {
            retArr.push(ret);
        }
        let bestRet = retArr[0];
        for(let i = 0; i < retArr.length; i++) {
            bestRet = getBestResult(bestRet, retArr[i]);
        }
        return bestRet;
    }
    else {
        let internalSim = new rzSim(data);
        let ret = await internalSim.simulate();
        let internalSim2 = new rzSim(data);
        internalSim2.normalPubRho = internalSim.pubRho;
        internalSim2.maxC1Level = internalSim.variables[0].level - 14;
        internalSim2.maxC1LevelActual = internalSim.variables[0].level;
        let ret2 = await internalSim2.simulate();
        let bestRet = getBestResult(ret, ret2);

        let internalSim3 = new rzSim(data);
        internalSim3.normalPubRho = internalSim.pubRho;
        internalSim3.maxC1Level = internalSim.variables[0].level - 15;
        let ret3 = await internalSim3.simulate();
        bestRet = getBestResult(bestRet, ret3);
        return bestRet;
    }
}

class rzSim extends theoryClass<theory> implements specificTheoryProps {
    currencies: Array<number>;
    t_var: number;
    // Zeta parameters
    zTerm: number;
    rCoord: number;
    iCoord: number;
    offGrid: boolean;
    // Pub parameters
    normalPubRho: number;
    maxC1Level: number;
    maxC1LevelActual: number;
    swapPointDelta: number;
    // BH parameters
    targetZero: number;
    blackhole: boolean;
    bhSearchingRewind: boolean;
    bhFoundZero: boolean;
    bhAtRecovery: boolean;
    bhzTerm: number;
    bhdTerm: number;
    // RZdBHRewind control parameters
    maxW1: number;
    bhRewindStatus: number;
    bhRewindT: number;
    bhRewindNorm: number;
    bhRewindDeriv: number;

    getBuyingConditions() {
        const activeStrat = [
            () => {
                if(this.normalPubRho != -1 && this.variables[1].cost > this.normalPubRho - l10(2)) {
                    return this.variables[0].cost <= this.normalPubRho - l10(10 + this.variables[0].level % 8);
                }
                else {
                    let precond = this.normalPubRho == -1 || this.variables[0].cost <= this.normalPubRho - l10(10 + this.variables[0].level % 8);
                    let levelCond = this.variables[0].level < this.variables[1].level * 4 + (this.milestones[0] ? 2 : 1);
                    // let percentCond = this.variables[0].cost < this.variables[1].cost - l10(8 + this.variables[0].level % 8);
                    // if(this.strat.includes("BH"))
                    //     return precond && percentCond;
                    // else
                    return precond && levelCond;
                }
            },
            () => {
                if(this.normalPubRho == -1) {
                    return true;
                }
                return this.variables[1].cost <= this.normalPubRho - l10(2);
            },
            () => this.t_var >= 16,
            () => {
                // if(this.strat.includes("BH") && this.variables[3].cost * 10 % 10 > 3 && this.variables[3].cost * 10 % 10 < 4) {
                //     // We want it this late!
                //     return true;
                // }
                return (this.milestones[2] ? this.variables[3].cost + l10(4 + 0.5 * (this.variables[3].level % 8) + 0.0001) < Math.min(this.variables[4].cost, this.variables[5].cost) : true)
            },
            true,
            true,
        ];
        const semiPassiveStrat = [
            () => {
                if(this.normalPubRho == -1) {
                    return true;
                }
                if(this.maxC1Level == -1) {
                    return this.variables[0].cost <= this.normalPubRho - l10(7.3 + 0.8 * this.variables[0].level % 8);
                }
                return this.variables[0].level < this.maxC1Level;
            },
            () => {
                if(this.normalPubRho == -1) {
                    return true;
                }
                return this.variables[1].cost <= this.normalPubRho - l10(2);
            },
            () => this.t_var >= 16,
            true,
            true,
            true
        ]
        const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
            RZ: semiPassiveStrat,
            RZd: activeStrat,
            RZBH: semiPassiveStrat,
            RZBHLong: semiPassiveStrat,
            RZdBH: activeStrat,
            RZdBHLong: activeStrat,
            RZdBHRewind: activeStrat,
            RZSpiralswap: activeStrat,
            RZdMS: activeStrat,
            RZMS: semiPassiveStrat,
            // RZnoB: [true, true, false, true, true, false, false],
        };
        return conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    }
    getMilestoneConditions() {
        // "c1", "c2", "b", "w1", "w2", "w3"
        return [
            () => true,
            () => true,
            () => this.variables[2].level < 6,
            () => this.milestones[1] === 1,
            () => this.milestones[2] === 1,
            () => this.milestones[2] === 1,
        ];
    }
    getMilestoneTree() {
        const noBHRoute = [
            [0, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 1, 1, 0],
            [1, 1, 1, 0],
            [2, 1, 1, 0],
            [3, 1, 1, 0],
            [3, 1, 1, 0]
        ]
        const BHRoute = [
            [0, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 1, 1, 0],
            [1, 1, 1, 0],
            [2, 1, 1, 0],
            [3, 1, 1, 0],
            [3, 1, 1, 0],
            [3, 1, 1, 1]
        ]
        const tree: { [key in stratType[theory]]: Array<Array<number>> } = {
            RZ: noBHRoute,
            RZd: noBHRoute,
            RZBH: BHRoute,
            RZBHLong: BHRoute,
            RZdBH: BHRoute,
            RZdBHLong: BHRoute,
            RZdBHRewind: BHRoute,
            RZSpiralswap: noBHRoute,
            RZdMS: noBHRoute,
            RZMS: noBHRoute
        };
        return tree[this.strat];
    }
    getTotMult(val: number) {
        return Math.max(0, val * 0.2102 + l10(2));
    }
    updateMilestones() {
        const points = [0, 25, 50, 125, 250, 400, 600];
        const stage = binarySearch(points, Math.max(this.lastPub, this.maxRho));
        const max = [3, 1, 1, 1];
        const originPriority = [2, 1, 3];
        const peripheryPriority = [2, 3, 1];
        let BHStrats = new Set(["RZBH", "RZdBH", "RZBHLong", "RZdBHLong", "RZdBHRewind"]);

        if (this.strat === "RZSpiralswap" && stage >= 2 && stage <= 4)
        {
            // Spiralswap
            let priority = originPriority;
            if (this.zTerm > 1) priority = peripheryPriority;
            let milestoneCount = stage;
            this.milestones = [0, 0, 0, 0];
            for (let i = 0; i < priority.length; i++) {
                while (this.milestones[priority[i] - 1] < max[priority[i] - 1] && milestoneCount > 0) {
                    this.milestones[priority[i] - 1]++;
                    milestoneCount--;
                }
            }
        }
        else if ((this.strat === "RZMS" || this.strat === "RZdMS") && stage >= 2 && stage <= 4)
        {
            let priority = peripheryPriority;
            if (this.maxRho > this.lastPub + this.swapPointDelta) priority = originPriority;
            let milestoneCount = stage;
            this.milestones = [0, 0, 0, 0];
            for (let i = 0; i < priority.length; i++) {
                while (this.milestones[priority[i] - 1] < max[priority[i] - 1] && milestoneCount > 0) {
                    this.milestones[priority[i] - 1]++;
                    milestoneCount--;
                }
            }
        }
        else if (BHStrats.has(this.strat) && stage === 6 && this.maxW1 === Infinity)
        {
            if (!this.blackhole){
                // Black hole coasting
                if (
                    (!this.bhAtRecovery && (this.t_var <= this.targetZero)) ||
                    (this.bhAtRecovery && (this.maxRho < this.lastPub))
                ) 
                {
                    this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
                }
                else {
                    if (!this.bhAtRecovery)
                        this.t_var = this.targetZero + 0.01;
                    this.blackhole = true;
                    this.offGrid = true;
                    this.milestones = this.milestoneTree[stage + 1];
                }
            }
        }
        else if (this.maxW1 !== Infinity){
            this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
            if (this.variables[3].level < this.maxW1){
                if (this.bhFoundZero === true){
                    if (this.bhRewindStatus === 0) {
                        this.milestones[3] = 0;
                        this.blackhole = false;
                        this.bhSearchingRewind = true;
                        this.bhFoundZero = false;
                        this.bhRewindStatus = 1;
                        this.offGrid = true;
                        this.dt = 0.15;
                    }
                    else {
                        this.bhRewindStatus = 2;
                        this.dt = this.bhRewindT;
                    }
                }
                else if (this.t_var > this.targetZero && !this.blackhole){
                    this.t_var = this.targetZero;
                    this.milestones[3] = 1;
                    this.blackhole = true;
                    this.offGrid = true;
                    this.bhSearchingRewind = true;
                    this.bhFoundZero = false;
                }
            }
            else {
                this.milestones[3] = 1;
                this.blackhole = true;
                this.bhRewindStatus = 3;
            }
        }
        else{
            this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
        }
    }

    bhProcess(zResult: ComplexValue | null = null, tmpZ: ComplexValue | null = null) {
        this.offGrid = true;

        if (zResult === null){
            zResult = zeta(this.t_var, this.ticks, this.offGrid, lookups.zetaLookup);
        }
        if (tmpZ === null){
            tmpZ = zeta(this.t_var + 1 / 100000, this.ticks, this.offGrid, lookups.zetaDerivLookup);
        }

        let dNewt = (tmpZ[2] - zResult[2]) * 100000;
        let bhdt = Math.min(Math.max(-0.5, -zResult[2] / dNewt), 0.375);

        if(this.bhSearchingRewind && this.t_var > 14.5 && bhdt > 0)
        {
            let srdt = -Math.min(0.125 / bhdt, 0.125);
            this.t_var += srdt;
        }
        else
        {
            this.t_var += bhdt;
            this.bhSearchingRewind = false;
            if(Math.abs(bhdt) < 1e-9)
            {
                this.bhFoundZero = true;
                let z = zeta(this.t_var, this.ticks, this.offGrid, lookups.zetaLookup);
                tmpZ = zeta(this.t_var + 1 / 100000, this.ticks, this.offGrid, lookups.zetaDerivLookup);
                let dr = tmpZ[0] - z[0];
                let di = tmpZ[1] - z[1];
                this.bhdTerm = l10(Math.sqrt(dr * dr + di * di) * 100000);
                this.rCoord = z[0];
                this.iCoord = z[1];
                this.bhzTerm = Math.abs(z[2]);
            }
        }
    }

    snapZero() {
        while(!this.bhFoundZero){
            this.bhProcess();
        }
    }

    updateT() {
        if (this.maxW1 !== Infinity && this.variables[3].level < this.maxW1 && this.t_var > this.targetZero - 5 && this.bhRewindStatus < 2){
            this.offGrid = true;
            this.dt = 0.15;
            this.t += this.dt / 1.5;
            if (this.bhRewindStatus == 1){
                this.bhRewindT += this.dt;
            }
        }
        else if (this.bhRewindStatus == 2) {
            this.t += this.dt / 1.5;
        }
        else {
            this.t += this.dt / 1.5;
            this.dt *= this.ddt;
        }
    }

    constructor(data: theoryData) {
        super(data);
        this.totMult = this.getTotMult(data.rho);
        this.curMult = 0;
        this.targetZero = 999999999;
        this.currencies = [0, 0];
        this.t_var = 0;
        this.zTerm = 0;
        this.rCoord = -1.4603545088095868;
        this.iCoord = 0;
        this.offGrid = false;
        this.blackhole = false;
        this.bhSearchingRewind = true;
        this.bhFoundZero = false;
        this.bhAtRecovery = false;
        this.bhzTerm = 0;
        this.bhdTerm = 0;
        this.normalPubRho = -1;
        this.maxC1Level = -1;
        this.maxC1LevelActual = -1;
        this.swapPointDelta = 0;
        this.maxW1 = Infinity;
        this.bhRewindStatus = 0;
        this.bhRewindT = 0;
        this.bhRewindNorm = 0;
        this.bhRewindDeriv = 0;
        this.varNames = ["c1", "c2", "b", "w1", "w2", "w3"];
        this.variables = [
            new Variable({
                cost: new FirstFreeCost(new ExponentialCost(225, Math.pow(2, 0.699))),
                valueScaling: new StepwisePowerSumValue(2, 8),
            }),
            new Variable({
                cost: new ExponentialCost(1500, Math.pow(2, 0.699 * 4)),
                valueScaling: new ExponentialValue(2),
            }),
            new Variable({
                cost: new VariableBcost, valueScaling: new LinearValue(0.5)
            }),
            new Variable({
                cost: new StepwiseCost(6, new ExponentialCost(12000, Math.pow(100, 1 / 3))),
                valueScaling: new StepwisePowerSumValue(2, 8, 1),
            }),
            new Variable({
                cost: new ExponentialCost(1e5, 10),
                valueScaling: new ExponentialValue(2),
            }),
            new Variable({
                cost: new ExponentialCost("3.16227766017e600", '1e30'),
                valueScaling: new ExponentialValue(2),
            }),
        ];
        this.pubUnlock = 9;
        this.conditions = this.getBuyingConditions();
        this.milestoneConditions = this.getMilestoneConditions();
        this.milestoneTree = this.getMilestoneTree();
        this.pubConditions.push(() => this.curMult > 30);
        this.updateMilestones();
    }
    async simulate() {
        while (!this.endSimulation()) {
            if (!global.simulating) break;
            // Prevent lookup table from retrieving values from wrong sim settings
            if (!this.ticks && (this.dt !== lookups.prevDt || this.ddt !== lookups.prevDdt)) {
                lookups.prevDt = this.dt;
                lookups.prevDdt = this.ddt;
                lookups.zetaLookup = [];
                lookups.zetaDerivLookup = [];
            }
            if ((this.ticks + 1) % 500000 === 0) await sleep();
            this.tick();
            if (this.currencies[0] > this.maxRho) this.maxRho = this.currencies[0];
            this.updateSimStatus();
            this.updateMilestones();
            this.buyVariables();
            this.ticks++;
        }
        this.pubMulti = Math.pow(10, this.getTotMult(this.pubRho) - this.totMult);
        let stratExtra = "";
        if (this.strat.includes("BH"))
        {
            stratExtra += ` t=${this.bhAtRecovery ? this.t_var.toFixed(2) : this.targetZero.toFixed(2)}`
        }
        if (this.strat.includes("MS") && this.swapPointDelta != 0) {
            stratExtra += ` swap:${(this.lastPub + this.swapPointDelta).toFixed(2)}`
        }
        if (this.normalPubRho != -1) {
            // if(this.maxC1LevelActual == -1)
            stratExtra += ` c1: ${this.variables[0].level} c2: ${this.variables[1].level}`
            // else
            //     stratExtra += ` c1=${this.variables[0].level}/${this.maxC1LevelActual} c2=${this.variables[1].level}`
        }
        if (this.maxW1 !== Infinity){
            stratExtra += ` w1: ${this.maxW1}`;
        }
        while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
        const result = createResult(this, stratExtra);
        return result;
    }
    tick() {
        let t_dot: number;

        if (!this.milestones[3]){
            t_dot = 1 / resolution;
            this.t_var += (this.dt * t_dot) / 1.5;
        }

        const tTerm = l10(this.t_var);
        const bonus = l10(this.dt) + this.totMult;
        const w1Term = this.milestones[1] ? this.variables[3].value : 0;
        const w2Term = this.milestones[2] ? this.variables[4].value : 0;
        const w3Term = this.milestones[2] ? this.variables[5].value : 0;
        const c1Term = this.variables[0].value * c1Exp[this.milestones[0]];
        const c2Term = this.variables[1].value;
        const bTerm = this.variables[2].value;

        if (this.bhRewindStatus == 2){
            this.currencies[1] = add(this.currencies[1], l10(this.bhRewindDeriv) + w1Term + w2Term + w3Term + this.totMult);
            this.currencies[0] = add(this.currencies[0], tTerm + c1Term + c2Term + w1Term + this.totMult + l10(this.bhRewindNorm));
        }
        else if (!this.bhFoundZero){
            const z = zeta(this.t_var, this.ticks, this.offGrid, lookups.zetaLookup);
            if (this.milestones[1]) {
                const tmpZ = zeta(this.t_var + 1 / 100000, this.ticks, this.offGrid, lookups.zetaDerivLookup);
                const dr = tmpZ[0] - z[0];
                const di = tmpZ[1] - z[1];
                const derivTerm = l10(Math.sqrt(dr * dr + di * di) * 100000);
                this.currencies[1] = add(this.currencies[1], derivTerm * bTerm + w1Term + w2Term + w3Term + bonus);
                if (this.bhRewindStatus == 1) {
                    this.bhRewindDeriv += this.dt * (Math.sqrt(dr * dr + di * di) * 100000) ** bTerm;
                }

                if (this.milestones[3]){
                    if (this.maxW1 === Infinity || this.variables[3].level >= this.maxW1){
                        this.snapZero();
                    }
                    else {
                        this.bhProcess(z, tmpZ);
                    }
                }
            }
            this.rCoord = z[0];
            this.iCoord = z[1];
            this.zTerm = Math.abs(z[2]);
            this.currencies[0] = add(this.currencies[0], tTerm + c1Term + c2Term + w1Term + bonus - l10(this.zTerm / (2 ** bTerm) + 0.01));
            if (this.bhRewindStatus == 1) {
                this.bhRewindNorm += this.dt / (this.zTerm / (2 ** bTerm) + 0.01);
            }
        }
        else {
            this.currencies[1] = add(this.currencies[1], this.bhdTerm * bTerm + w1Term + w2Term + w3Term + bonus);
            this.currencies[0] = add(this.currencies[0], tTerm + c1Term + c2Term + w1Term + bonus - l10(this.bhzTerm / (2 ** bTerm) + 0.01));
        }
    }
    buyVariables() {
        const currencyIndices = [0, 0, 0, 1, 1, 1];

        for (let i = this.variables.length - 1; i >= 0; i--)
            while (true) {
                if (this.currencies[currencyIndices[i]] > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]()) {
                    this.currencies[currencyIndices[i]] = subtract(this.currencies[currencyIndices[i]], this.variables[i].cost);
                    if (this.maxRho + 5 > this.lastPub) {
                        let vb: varBuy = {
                            variable: this.varNames[i],
                            level: this.variables[i].level + 1,
                            cost: this.variables[i].cost,
                            timeStamp: this.t,
                        };
                        if (currencyIndices[i] == 1) {
                            vb.symbol = "delta";
                        }
                        this.boughtVars.push(vb);
                    }
                    if (i == 2 && this.bhRewindStatus == 2) { 
                        // Reset RZdBHRewind status when buying b
                        // To make sure the cache is recomputed with the new b value
                        this.bhRewindT = 0;
                        this.bhRewindNorm = 0;
                        this.bhRewindDeriv = 0;
                        this.milestones[3] = 0;
                        this.blackhole = false;
                        this.bhSearchingRewind = true;
                        this.bhFoundZero = false;
                        this.bhRewindStatus = 1;
                    }
                    this.variables[i].buy();
                } else break;
            }
    }
}