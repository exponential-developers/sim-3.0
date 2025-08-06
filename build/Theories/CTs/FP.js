var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep, getBestResult } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue, BaseValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import pubtable from "./helpers/FPpubtable.json" assert { type: "json" };
import { theoryClass } from "../theory.js";
import { CompositeCost, ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';
export default function fp(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const sim = new fpSim(data);
        const res = yield sim.simulate();
        return res;
    });
}
class VariableSValue extends BaseValue {
    getS(level) {
        const cutoffs = [32, 39];
        if (level < cutoffs[0])
            return 1 + level * 0.15;
        if (level < cutoffs[1])
            return this.getS(cutoffs[0] - 1) + 0.15 + (level - cutoffs[0]) * 0.2;
        return this.getS(cutoffs[1] - 1) + 0.2 + (level - cutoffs[1]) * 0.15;
    }
    computeNewValue(prevValue, currentLevel) {
        return this.getS(currentLevel + 1);
    }
    recomputeValue(level) {
        return this.getS(level);
    }
    copy() {
        return new VariableSValue();
    }
}
const stepwiseSum = (level, base, length) => {
    if (level <= length)
        return level;
    level -= length;
    const cycles = Math.floor(level / length);
    const mod = level - cycles * length;
    return base * (cycles + 1) * ((length * cycles) / 2 + mod) + length + level;
};
class fpSim extends theoryClass {
    getBuyingConditions() {
        const conditions = {
            FP: new Array(8).fill(true),
            FPcoast: new Array(8).fill(true),
            FPdMS: [
                true,
                () => this.variables[1].cost + Math.log10((this.variables[1].level % 100) + 1) < this.variables[2].cost,
                ...new Array(6).fill(true),
            ],
            FPmodBurstC1MS: [
                true,
                () => {
                    let mod100 = this.variables[1].level % 100;
                    if (mod100 > 85) {
                        let levelMinusMod = this.variables[1].level - mod100;
                        let totalCost = this.variables[1].getCostForLevels(levelMinusMod + mod100 + 1, levelMinusMod + 101);
                        if (totalCost < this.variables[2].cost + 0.1 && (this.milestones.sterm == 0 || totalCost < this.variables[7].cost)) {
                            return true;
                        }
                    }
                    return (this.variables[1].cost + Math.log10((this.variables[1].level % 100) + 1) < this.variables[2].cost) &&
                        (this.milestones.sterm == 0 || this.variables[1].cost + Math.log10((this.variables[1].level % 100) + 1) < this.variables[7].cost);
                },
                () => {
                    if (this.milestones.sterm == 0)
                        return true;
                    // s:
                    return this.variables[2].cost + 0.1 < this.variables[7].cost;
                },
                //q1 - 3
                () => {
                    let cond1 = this.variables[3].cost + Math.log10((this.variables[3].level % 10) + 1) * 1.5 < this.variables[4].cost;
                    //let cond2 = this.variables[3].cost + Math.log10((this.variables[3].level % 10) + 1) < this.variables[2].cost
                    return cond1;
                },
                () => {
                    let cond1 = true; //this.variables[4].cost + 0.05 < this.variables[2].cost;
                    let cond2 = true;
                    if (this.milestones.sterm != 0) {
                        cond2 = this.variables[4].cost + 0.1 < this.variables[7].cost;
                    }
                    return cond1 && cond2;
                },
                () => {
                    return true;
                },
                true,
                true, //s - 7
            ],
        };
        const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
        return condition;
    }
    getMilestoneConditions() {
        const conditions = [
            () => this.variables[0].level < 4,
            () => true,
            () => true,
            () => this.milestones.fractals > 0,
            () => this.milestones.fractals > 0,
            () => this.milestones.fractals > 1,
            () => true,
            () => this.milestones.sterm > 0,
        ];
        return conditions;
    }
    getMilestoneTree() {
        const globalOptimalRoute = [
            { snexp: 0, fractals: 0, nboost: 0, snboost: 0, sterm: 0, expterm: 0 },
            { snexp: 0, fractals: 1, nboost: 0, snboost: 0, sterm: 0, expterm: 0 },
            { snexp: 0, fractals: 2, nboost: 0, snboost: 0, sterm: 0, expterm: 0 },
            { snexp: 0, fractals: 2, nboost: 1, snboost: 0, sterm: 0, expterm: 0 },
            { snexp: 0, fractals: 2, nboost: 2, snboost: 0, sterm: 0, expterm: 0 },
            { snexp: 1, fractals: 2, nboost: 2, snboost: 0, sterm: 0, expterm: 0 },
            { snexp: 2, fractals: 2, nboost: 2, snboost: 0, sterm: 0, expterm: 0 },
            { snexp: 3, fractals: 2, nboost: 2, snboost: 0, sterm: 0, expterm: 0 },
            { snexp: 3, fractals: 2, nboost: 2, snboost: 1, sterm: 0, expterm: 0 },
            { snexp: 3, fractals: 2, nboost: 2, snboost: 1, sterm: 1, expterm: 0 },
            { snexp: 3, fractals: 2, nboost: 2, snboost: 1, sterm: 1, expterm: 1 },
        ];
        const tree = {
            FP: globalOptimalRoute,
            FPcoast: globalOptimalRoute,
            FPdMS: globalOptimalRoute,
            FPmodBurstC1MS: globalOptimalRoute,
        };
        return tree[this.strat];
    }
    getTotMult(val) {
        return Math.max(0, val * this.tauFactor * 0.331 + l10(5));
    }
    updateMilestones() {
        let stage = 0;
        const points = [l10(5e22), 95, 175, 300, 385, 420, 550, 600, 700, 1500];
        for (let i = 0; i < points.length; i++) {
            if (Math.max(this.lastPub, this.maxRho) >= points[i])
                stage = i + 1;
        }
        this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
        // if (this.lastPub > 700 && this.lastPub < 900) {
        //   if (this.ticks % 40 < 20) this.milestones.sterm = 0;
        //   else this.milestones.sterm = 1;
        // }
    }
    approx(n) {
        n++;
        return l10(1 / 6) + add(l10(2) * (2 * n), l10(2));
    }
    T(n) {
        if (n === 0)
            return 0;
        const log2N = Math.log2(n);
        if (log2N % 1 === 0)
            return (Math.pow(2, (2 * log2N + 1)) + 1) / 3;
        const i = n - Math.pow(2, Math.floor(log2N));
        return this.T(Math.pow(2, Math.floor(log2N))) + 2 * this.T(i) + this.T(i + 1) - 1;
    }
    V(n) {
        if (n === 0)
            return 0;
        const log2N = Math.log2(n);
        if (log2N % 1 === 0)
            return Math.pow(2, (2 * log2N));
        const i = n - Math.pow(2, Math.floor(log2N));
        return Math.pow(2, (2 * Math.floor(log2N))) + 3 * this.V(i);
    }
    U(n) {
        return (4 / 3) * this.V(n) - (1 / 3);
    }
    S(n) {
        if (n === 0)
            return 0;
        if (this.milestones.snboost === 0)
            return l10(3) * (n - 1);
        return l10(1 / 3) + subtract(l10(2) + l10(3) * n, l10(3));
    }
    updateN() {
        this.T_n = this.T(this.n);
        this.U_n = this.U(this.n);
        this.S_n = this.S(Math.floor(Math.sqrt(this.n)));
    }
    constructor(data) {
        super(data);
        this.totMult = data.rho < 9 ? 0 : this.getTotMult(data.rho);
        this.curMult = 0;
        this.pubUnlock = 12;
        this.rho = 0;
        this.q = 0;
        this.r = 0;
        this.t_var = 0;
        this.varNames = ["tdot", "c1", "c2", "q1", "q2", "r1", "n", "s"];
        this.variables = [
            new Variable({ cost: new ExponentialCost(1e4, 1e4), valueScaling: new ExponentialValue(10) }),
            new Variable({ cost: new FirstFreeCost(new ExponentialCost(10, 1.4)), valueScaling: new StepwisePowerSumValue(150, 100) }),
            new Variable({ cost: new CompositeCost(15, new ExponentialCost(1e15, 40), new ExponentialCost(1e37, 16.42)), valueScaling: new ExponentialValue(2) }),
            new Variable({ cost: new FirstFreeCost(new ExponentialCost(1e35, 12)), valueScaling: new StepwisePowerSumValue(10, 10) }),
            new Variable({ cost: new ExponentialCost(1e76, 1e3), valueScaling: new ExponentialValue(10) }),
            new Variable({
                cost: new FirstFreeCost(new CompositeCost(285, new ExponentialCost(1e80, 25), new ExponentialCost("1e480", 150))),
                valueScaling: new StepwisePowerSumValue(2, 5)
            }),
            new Variable({ cost: new ExponentialCost(1e4, 3e6), valueScaling: new ExponentialValue(10) }),
            new Variable({ cost: new ExponentialCost("1e730", 1e30), valueScaling: new VariableSValue() }),
        ];
        this.T_n = 1;
        this.U_n = 1;
        this.S_n = 0;
        this.n = 1;
        this.updateN_flag = true;
        this.forcedPubRho = Infinity;
        this.coasting = new Array(this.variables.length).fill(false);
        this.bestRes = null;
        //pub values
        this.milestones = { snexp: 0, fractals: 0, nboost: 0, snboost: 0, sterm: 0, expterm: 0 };
        this.conditions = this.getBuyingConditions();
        this.milestoneConditions = this.getMilestoneConditions();
        this.milestoneTree = this.getMilestoneTree();
        this.updateMilestones();
    }
    copyFrom(other) {
        super.copyFrom(other);
        this.milestones = Object.assign({}, other.milestones);
        this.curMult = other.curMult;
        this.rho = other.rho;
        this.q = other.q;
        this.r = other.r;
        this.t_var = other.t_var;
        this.T_n = other.T_n;
        this.U_n = other.U_n;
        this.S_n = other.S_n;
        this.n = other.n;
        this.updateN_flag = other.updateN_flag;
        this.forcedPubRho = other.forcedPubRho;
        this.coasting = [...other.coasting];
    }
    copy() {
        let newsim = new fpSim(this.getDataForCopy());
        newsim.copyFrom(this);
        return newsim;
    }
    simulate() {
        return __awaiter(this, void 0, void 0, function* () {
            let pubCondition = false;
            if (this.lastPub >= 1200 && this.lastPub < 1990 && this.strat !== "FP") {
                let newpubtable = pubtable.fpdata;
                let pubseek = Math.round(this.lastPub * 8);
                this.forcedPubRho = newpubtable[pubseek.toString()] / 8;
                if (this.forcedPubRho === undefined)
                    this.forcedPubRho = Infinity;
            }
            while (!pubCondition) {
                if (!global.simulating)
                    break;
                if ((this.ticks + 1) % 500000 === 0)
                    yield sleep();
                this.tick();
                if (this.rho > this.maxRho)
                    this.maxRho = this.rho;
                this.updateMilestones();
                this.curMult = Math.pow(10, (this.getTotMult(this.maxRho) - this.totMult));
                yield this.buyVariables();
                if (this.forcedPubRho !== Infinity) {
                    pubCondition = this.pubRho >= this.forcedPubRho && this.pubRho > this.pubUnlock && (this.pubRho <= 2000 || this.t > this.pubT * 2);
                    pubCondition || (pubCondition = this.pubRho > this.cap[0]);
                }
                else {
                    pubCondition =
                        (global.forcedPubTime !== Infinity
                            ? this.t > global.forcedPubTime
                            : this.t > this.pubT * 2 || this.pubRho > this.cap[0] || this.curMult > 10000) && this.pubRho > this.pubUnlock;
                }
                this.ticks++;
            }
            this.pubMulti = Math.pow(10, (this.getTotMult(this.pubRho) - this.totMult));
            while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT)
                this.boughtVars.pop();
            const result = createResult(this, "");
            return getBestResult(result, this.bestRes);
        });
    }
    tick() {
        if (this.updateN_flag) {
            const term2 = this.milestones.nboost > 0 ? Math.floor(stepwiseSum(Math.max(0, this.variables[6].level - 30), 1, 35) * 2) : 0;
            const term3 = this.milestones.nboost > 1 ? Math.floor(stepwiseSum(Math.max(0, this.variables[6].level - 69), 1, 30) * 2.4) : 0;
            this.n = Math.min(20000, 1 + stepwiseSum(this.variables[6].level, 1, 40) + term2 + term3);
            this.updateN();
            this.updateN_flag = false;
        }
        if (["FPdMS", "FPmodBurstC1MS"].includes(this.strat) && this.lastPub > 700 && this.variables[7].value < 2) {
            this.milestones.sterm = 1;
            if (this.ticks % 20 < 10 / this.variables[7].value)
                this.milestones.sterm = 0;
        }
        const vq1 = this.variables[3].value - l10(1 + 1000 / Math.pow(this.variables[3].level, 1.5));
        const vr1 = this.variables[5].value - l10(1 + 1e9 / Math.pow(this.variables[5].level, 4));
        const A = this.approx(this.variables[4].level);
        this.t_var += (this.variables[0].level / 5 + 0.2) * this.dt;
        const qdot = vq1 + A + l10(this.U_n) * (7 + (this.milestones.sterm > 0 ? this.variables[7].value : 0)) - 3;
        this.q = this.milestones.fractals > 0 ? add(this.q, qdot + l10(this.dt)) : this.q;
        let rdot;
        if (this.milestones.expterm < 1)
            rdot = vr1 + (l10(this.T_n) + l10(this.U_n)) * l10(this.n) + this.S_n * (1 + 0.6 * this.milestones.snexp);
        else
            rdot = vr1 + (l10(this.T_n) + l10(this.U_n)) * (l10(this.U_n * 2) / 2) + this.S_n * (1 + 0.6 * this.milestones.snexp);
        this.r = this.milestones.fractals > 1 ? add(this.r, rdot + l10(this.dt)) : this.r;
        let rhodot = this.totMult +
            this.variables[1].value +
            this.variables[2].value +
            l10(this.T_n) * (7 + (this.milestones.sterm > 0 ? this.variables[7].value - 2 : 0)) +
            l10(this.t_var);
        rhodot += this.milestones.fractals > 0 ? this.q : 0;
        rhodot += this.milestones.fractals > 1 ? this.r : 0;
        this.rho = add(this.rho, rhodot + l10(this.dt));
        this.t += this.dt / 1.5;
        this.dt *= this.ddt;
        if (this.maxRho < this.recovery.value)
            this.recovery.time = this.t;
        this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
        if (this.maxTauH < this.tauH ||
            this.maxRho >= this.cap[0] - this.cap[1] ||
            this.pubRho < this.pubUnlock ||
            global.forcedPubTime !== Infinity ||
            (this.forcedPubRho !== Infinity && this.pubRho < this.forcedPubRho)) {
            if (this.maxTauH < this.tauH && this.maxRho >= 2000) {
                this.coasting = new Array(this.variables.length).fill(false);
                this.forcedPubRho = Infinity;
            }
            this.maxTauH = this.tauH;
            this.pubT = this.t;
            this.pubRho = this.maxRho;
        }
    }
    buyVariables() {
        return __awaiter(this, void 0, void 0, function* () {
            const lowbounds = [0, 0.3, 0.15, 0.3, 0.3, 0.1, 0, 0];
            const highbounds = [0, 1.5, 0.5, 1.5, 1, 1.5, 1.5, 0];
            for (let i = this.variables.length - 1; i >= 0; i--)
                while (true) {
                    if (this.rho > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]() && !this.coasting[i]) {
                        if (this.forcedPubRho !== Infinity) {
                            if (this.forcedPubRho - this.variables[i].cost <= lowbounds[i]) {
                                this.coasting[i] = true;
                                break;
                            }
                            if (this.forcedPubRho - this.variables[i].cost < highbounds[i]) {
                                let fork = this.copy();
                                fork.coasting[i] = true;
                                const forkres = yield fork.simulate();
                                this.bestRes = getBestResult(this.bestRes, forkres);
                            }
                        }
                        if (this.maxRho + 5 > this.lastPub) {
                            this.boughtVars.push({ variable: this.varNames[i], level: this.variables[i].level + 1, cost: this.variables[i].cost, timeStamp: this.t });
                        }
                        this.rho = subtract(this.rho, this.variables[i].cost);
                        this.variables[i].buy();
                        if (i === 6)
                            this.updateN_flag = true;
                    }
                    else
                        break;
                }
        });
    }
}
