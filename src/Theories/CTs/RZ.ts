import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep, binarySearch, convertTime } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue, LinearValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";
import { c1Exp, getBlackholeSpeed, lookups, resolution, zeta, ComplexValue } from "./helpers/RZ.js";
import goodzeros from "./helpers/RZgoodzeros.json" assert { type: "json" };

import { ExponentialCost, StepwiseCost, CompositeCost, ConstantCost, FirstFreeCost, BaseCost } from '../../Utils/cost.js';

export default async function rz(data: theoryData) {
    return await ((new rzSimWrap(data)).simulate());
}

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

class rzSim extends theoryClass<theory> implements specificTheoryProps {
    curMult: number;
    currencies: Array<number>;
    t_var: number;
    zTerm: number;
    rCoord: number;
    iCoord: number;
    offGrid: boolean;
    pubUnlock: number;
    targetZero: number;
    maxTVar: number;
    blackhole: boolean;
    bhSearchingRewind: boolean;
    bhFoundZero: boolean;
    bhAtRecovery: boolean;
    bhzTerm: number;
    bhdTerm: number;
    normalPubRho: number;
    maxC1Level: number;
    maxC1LevelActual: number;
    swapPointDelta: number;
    maxW1: number;

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
            RZMS: noBHRoute,
            // RZnoB: noBHRoute,
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
                    this.milestones[3] = 0;
                    this.blackhole = false;
                    this.bhSearchingRewind = true;
                    this.bhFoundZero = false;
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
            //console.log(`Searching rewind, t=${this.t_var}, srdt=${srdt}`)
            this.t_var += srdt;
        }
        else
        {
            //console.log(`Not searching rewind, t=${this.t_var}, bhdt=${bhdt}`)
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
        this.maxTVar = 0;
        this.normalPubRho = -1;
        this.maxC1Level = -1;
        this.maxC1LevelActual = -1;
        this.swapPointDelta = 0;
        this.maxW1 = Infinity;
        this.varNames = ["c1", "c2", "b", "w1", "w2", "w3"/*, "b+"*/];
        this.variables = [
            new Variable({
                cost: new FirstFreeCost(new ExponentialCost(225, Math.pow(2, 0.699))),
                // const c1Cost = new FirstFreeCost(new ExponentialCost(225, 0.699));
                // const getc1 = (level) => Utils.getStepwisePowerSum(level, 2, 8, 0);
                valueScaling: new StepwisePowerSumValue(2, 8),
            }),
            new Variable({
                cost: new ExponentialCost(1500, Math.pow(2, 0.699 * 4)),
                valueScaling: new ExponentialValue(2),
            }),
            new Variable({
                cost: new VariableBcost, valueScaling: new LinearValue(0.5)
                // cost: new ExponentialCost(1e21, 1e79),
                // power: use outside method
            }),
            // const w1Cost = new StepwiseCost(new ExponentialCost(12000, Math.log2(100)/3), 6);
            // const getw1 = (level) => Utils.getStepwisePowerSum(level, 2, 8, 1);
            new Variable({
                cost: new StepwiseCost(6, new ExponentialCost(12000, Math.pow(100, 1 / 3))),
                value: 1,
                valueScaling: new StepwisePowerSumValue(2, 8),
            }),
            // const w2Cost = new ExponentialCost(1e5, Math.log2(10));
            // const getw2 = (level) => BigNumber.TWO.pow(level);
            new Variable({
                cost: new ExponentialCost(1e5, 10),
                valueScaling: new ExponentialValue(2),
            }),
            new Variable({
                cost: new ExponentialCost("3.16227766017e600", '1e30'),
                valueScaling: new ExponentialValue(2),
            }),
            // new Variable({
            //     cost: new ExponentialCost("1e600", "1e300"),
            //     // b (2nd layer)
            // }),
        ];
        this.pubUnlock = 9;
        this.conditions = this.getBuyingConditions();
        this.milestoneConditions = this.getMilestoneConditions();
        this.milestoneTree = this.getMilestoneTree();
        this.updateMilestones();
        // this.output = document.querySelector(".varOutput");
        // this.outputResults = "time,t,rho,delta<br>";
    }
    async simulate() {
        let pubCondition = false;
        while (!pubCondition) {
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
            this.updateMilestones();
            this.curMult = Math.pow(10, this.getTotMult(this.maxRho) - this.totMult);
            this.buyVariables();
            pubCondition = (global.forcedPubTime !== Infinity ? this.t > global.forcedPubTime : this.t > this.pubT * 2 || this.pubRho > this.cap[0] || this.curMult > 30) && this.pubRho > this.pubUnlock;
            this.ticks++;
        }
        // Printing
        // this.output.innerHTML = this.outputResults;
        // this.outputResults = '';
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

        if (!this.bhFoundZero){
            const z = zeta(this.t_var, this.ticks, this.offGrid, lookups.zetaLookup);
            if (this.milestones[1]) {
                const tmpZ = zeta(this.t_var + 1 / 100000, this.ticks, this.offGrid, lookups.zetaDerivLookup);
                const dr = tmpZ[0] - z[0];
                const di = tmpZ[1] - z[1];
                const derivTerm = l10(Math.sqrt(dr * dr + di * di) * 100000);
                // derivCurrency.value += dTerm.pow(bTerm) * w1Term * w2Term * w3Term * bonus;
                this.currencies[1] = add(this.currencies[1], derivTerm * bTerm + w1Term + w2Term + w3Term + bonus);

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
        }
        else {
            this.currencies[1] = add(this.currencies[1], this.bhdTerm * bTerm + w1Term + w2Term + w3Term + bonus);
            this.currencies[0] = add(this.currencies[0], tTerm + c1Term + c2Term + w1Term + bonus - l10(this.bhzTerm / (2 ** bTerm) + 0.01));
        }

        // normCurrency.value += tTerm * c1Term * c2Term * w1Term * bonus / (zTerm / BigNumber.TWO.pow(bTerm) + bMarginTerm);
        
        this.t += this.dt / 1.5;
        this.dt *= this.ddt;
        if (this.maxW1 !== Infinity && this.variables[3].level < this.maxW1 && this.t_var > this.targetZero - 5){
            //console.log(`${this.t}; ${convertTime(this.t)}`)
            this.offGrid = true;
            this.dt = 0.15;
        }
        if (this.maxRho < this.recovery.value) this.recovery.time = this.t;
        this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
        if (this.maxTauH < this.tauH || this.maxRho >= this.cap[0] - this.cap[1] || this.pubRho < this.pubUnlock || global.forcedPubTime !== Infinity) {
            this.maxTauH = this.tauH;
            this.pubT = this.t;
            this.pubRho = this.maxRho;
            this.maxTVar = this.t_var;
        }
        // this.outputResults += `${this.t},${this.t_var},${this.currencies[0]},${this.currencies[1]}<br>`;
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
                    this.variables[i].buy();
                } else break;
            }
    }
}

class rzSimWrap extends theoryClass<theory> implements specificTheoryProps {
    _originalData: theoryData;

    constructor(data: theoryData) {
        super(data);
        this._originalData = data;
    }
    async simulate(): Promise<simResult> {
        if(this.strat.includes("BH") && !this.strat.includes("Rewind") && this.lastPub >= 600) {
            let zeroList = this.strat.startsWith("RZd") ? rzdZeros : rzZeros;
            if(this.strat.includes("Long")) {
                zeroList = goodzeros.longZeros;
            }
            let startZeroIndex = 0;
            let bestSim: rzSim | null = new rzSim(this._originalData);
            bestSim.bhAtRecovery = true;
            let bestSimRes: simResult | null = await bestSim.simulate();
            let boundaryCondition = null;
            if(!this.strat.startsWith("RZd")) {
                for(let x of goodzeros.rzIdleBHBoundaries) {
                    if(this._originalData.rho <= x.toRho) {
                        boundaryCondition = x;
                        break;
                    }
                }
            }
            else {
                for(let x of goodzeros.rzdIdleBoundaries) {
                    if(this._originalData.rho <= x.toRho) {
                        boundaryCondition = x;
                        break;
                    }
                }
            }
            if(this.strat.includes("Long")) {
                boundaryCondition = {
                    "toRho": 9999999999, "from": 3000, "to": 999999999
                }
                bestSim = null;
                bestSimRes = null;
            }
            for(let i = startZeroIndex; i < zeroList.length; i++) {
                let zero = zeroList[i];
                if(boundaryCondition != null) {
                    if(zero < boundaryCondition.from || zero > boundaryCondition.to) {
                        continue;
                    }
                }
                let internalSim = new rzSim(this._originalData)
                internalSim.targetZero = zero;
                let res = await internalSim.simulate();
                if(bestSim == null || bestSim.maxTauH < internalSim.maxTauH) {
                    bestSim = internalSim;
                    bestSimRes = res;
                }

                if(!this.strat.startsWith("RZd")) {
                    // Actual bounds are 14 to 18, saves 23m, but performance is shit.
                    for (let j = 14; j <= 15; j++) {
                        let internalSim3 = new rzSim(this._originalData)
                        internalSim3.targetZero = zero;
                        internalSim3.normalPubRho = internalSim.pubRho;
                        internalSim3.maxC1Level = internalSim.variables[0].level - j;
                        internalSim3.maxC1LevelActual = internalSim.variables[0].level;
                        let res3 = await internalSim3.simulate();
                        if (bestSim.maxTauH < internalSim3.maxTauH) {
                            bestSim = internalSim3;
                            bestSimRes = res3;
                        }
                    }
                }
                else {
                    let internalSim2 = new rzSim(this._originalData)
                    internalSim2.targetZero = zero;
                    internalSim2.normalPubRho = internalSim.pubRho;
                    internalSim2.maxC1LevelActual = internalSim.variables[0].level;
                    let res2 = await internalSim2.simulate();
                    if(bestSim.maxTauH < internalSim2.maxTauH) {
                        bestSim = internalSim2;
                        bestSimRes = res2;
                    }
                }
            }
            for (let key in bestSim) {
                // @ts-ignore
                if (bestSim.hasOwnProperty(key) && typeof bestSim[key] !== "function") {
                    // @ts-ignore
                    this[key] = bestSim[key];
                }
            }
            if(bestSimRes == null) {
                throw new Error("result somehow not set?");
            }
            return bestSimRes;
        }
        else if(this.strat.includes("BHRewind") && this.lastPub >= 600){
            let zeroList = rzdZeros;
            let zeroRewindList = goodzeros.rzRewind;
            let startZeroIndex = 0;
            let bestSim: rzSim | null = new rzSim(this._originalData);
            let bestSim2: rzSim | null = null;

            bestSim.bhAtRecovery = true;
            let bestSimRes: simResult | null = await bestSim.simulate();
            let bestSim2Res: simResult | null = null;
            let boundaryCondition = null;
            for(let x of goodzeros.rzIdleBHBoundaries) {
                if(this._originalData.rho <= x.toRho) {
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
                let internalSim = new rzSim(this._originalData)
                internalSim.targetZero = zero;
                let res = await internalSim.simulate();
                if(bestSim == null || bestSim.maxTauH < internalSim.maxTauH) {
                    bestSim = internalSim;
                    bestSimRes = res;
                }

                let internalSim2 = new rzSim(this._originalData)
                internalSim2.targetZero = zero;
                internalSim2.normalPubRho = internalSim.pubRho;
                internalSim2.maxC1LevelActual = internalSim.variables[0].level;
                let res2 = await internalSim2.simulate();
                if(bestSim.maxTauH < internalSim2.maxTauH) {
                    bestSim = internalSim2;
                    bestSimRes = res2;
                }
            }

            let maxW1 = Infinity;
            for (let i = bestSim.boughtVars.length - 1; i >= 0; i--){
                if (bestSim.boughtVars[i].variable === "w1"){
                    maxW1 = bestSim.boughtVars[i].level;
                    break;
                }
            }
            if (maxW1 % 6 != 0){
                maxW1 += 6 - (maxW1 % 6)
            }

            let rewindBoundaryCondition = null;
            for(let x of goodzeros.rzRewindBoundaries) {
                if(this._originalData.rho <= x.toRho) {
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

                    let internalSim = new rzSim(this._originalData)
                    internalSim.targetZero = rewindPoint;
                    internalSim.maxW1 = maxW1 + extraW1;
                    let res = await internalSim.simulate();
                    if(bestSim2 == null || bestSim2.maxTauH < internalSim.maxTauH) {
                        bestSim2 = internalSim;
                        bestSim2Res = res;
                    }

                    let internalSim2 = new rzSim(this._originalData)
                    internalSim2.targetZero = rewindPoint;
                    internalSim2.maxW1 = maxW1 + extraW1;
                    internalSim2.normalPubRho = internalSim.pubRho;
                    internalSim2.maxC1LevelActual = internalSim.variables[0].level;
                    let res2 = await internalSim2.simulate();
                    if(bestSim2.maxTauH < internalSim2.maxTauH) {
                        bestSim2 = internalSim2;
                        bestSim2Res = res2;
                    }
                }
            }

            for (let key in bestSim2) {
                // @ts-ignore
                if (bestSim2.hasOwnProperty(key) && typeof bestSim2[key] !== "function") {
                    // @ts-ignore
                    this[key] = bestSim2[key];
                }
            }
            if(bestSim2Res == null) {
                throw new Error("result somehow not set?");
            }
            return bestSim2Res;
        }
        else if(this.strat.includes("MS") && this._originalData.rho <= 400 && this._originalData.rho >= 10) {
            let normalSims = [
                new rzSim(this._originalData),
                new rzSim(this._originalData),
                new rzSim(this._originalData),
                new rzSim(this._originalData),
                new rzSim(this._originalData),
                new rzSim(this._originalData),
                new rzSim(this._originalData)
            ]
            let normalRets = []
            normalSims[1].swapPointDelta = -1;
            normalSims[2].swapPointDelta = -2;
            normalSims[3].swapPointDelta = -3;
            normalSims[4].swapPointDelta = -4;
            normalSims[5].swapPointDelta = -5;
            normalSims[6].swapPointDelta = -6;
            for(let i = 0; i < normalSims.length; i++) {
                normalRets.push(await normalSims[i].simulate());
            }
            let coastSims = [];
            let coastRets = [];
            for(let i = 0; i < normalSims.length; i++) {
                let ss = new rzSim(this._originalData);
                ss.normalPubRho = normalSims[i].pubRho;
                ss.swapPointDelta = normalSims[i].swapPointDelta;
                coastSims.push(ss);
                coastRets.push(await ss.simulate());
            }
            let totalArr = [];
            let retArr = [];
            for(let sim of normalSims) {
                totalArr.push(sim);
            }
            for(let sim of coastSims) {
                totalArr.push(sim);
            }
            for(let ret of normalRets) {
                retArr.push(ret);
            }
            for(let ret of coastRets) {
                retArr.push(ret);
            }
            let bestSim = totalArr[0];
            let bestRet = retArr[0];
            for(let i = 0; i < totalArr.length; i++) {
                if(bestSim.maxTauH < totalArr[i].maxTauH) {
                    bestSim = totalArr[i];
                    bestRet = retArr[i];
                }
            }
            for (let key in bestSim) {
                // @ts-ignore
                if (bestSim.hasOwnProperty(key) && typeof bestSim[key] !== "function") {
                    // @ts-ignore
                    this[key] = bestSim[key];
                }
            }
            return bestRet;
        }
        else {
            let internalSim = new rzSim(this._originalData);
            let ret = await internalSim.simulate();
            let internalSim2 = new rzSim(this._originalData);
            internalSim2.normalPubRho = internalSim.pubRho;
            internalSim2.maxC1Level = internalSim.variables[0].level - 14;
            internalSim2.maxC1LevelActual = internalSim.variables[0].level;
            let ret2 = internalSim2.simulate();
            let bestSim = internalSim.maxTauH > internalSim2.maxTauH ? internalSim: internalSim2;
            let bestRet = internalSim.maxTauH > internalSim2.maxTauH ? ret: ret2;

            let internalSim3 = new rzSim(this._originalData);
            internalSim3.normalPubRho = internalSim.pubRho;
            internalSim3.maxC1Level = internalSim.variables[0].level - 15;
            let ret3 = internalSim3.simulate();
            bestSim = bestSim.maxTauH > internalSim3.maxTauH ? bestSim: internalSim3;
            bestRet = bestSim.maxTauH > internalSim3.maxTauH ? bestRet: ret3;
            for (let key in bestSim) {
                // @ts-ignore
                if (bestSim.hasOwnProperty(key) && typeof bestSim[key] !== "function") {
                    // @ts-ignore
                    this[key] = bestSim[key];
                }
            }
            return bestRet;
        }
    }
}