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
import { add, createResult, l10, subtract, sleep } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { theoryClass } from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';
export default function ef(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const sim = new efSim(data);
        const res = yield sim.simulate(data);
        return res;
    });
}
class efSim extends theoryClass {
    getBuyingConditions() {
        const conditions = {
            EF: new Array(10).fill(true),
            EFSnax: [
                true,
                () => this.curMult < 1,
                true,
                () => this.curMult < 1,
                () => this.curMult < 1,
                () => this.curMult < 1,
                () => this.curMult < 1,
                () => this.curMult < 1 || this.lastPub > 150,
                true,
                true,
            ],
            EFd: [
                true,
                () => this.variables[1].cost + 1 < this.variables[2].cost,
                true,
                true,
                true,
                true,
                true,
                () => this.variables[6].cost + l10(2.5) < this.variables[2].cost,
                true,
                true,
            ],
            EFAI: [
                /*tdot*/ true,
                /*q1*/ () => this.variables[1].cost + l10(10 + (this.variables[1].level % 10)) < this.variables[2].cost &&
                    this.variables[1].cost + l10((this.variables[1].level % 10) + 5) < this.recursionValue[0],
                /*q2*/ () => this.variables[2].cost + 0.2 < this.recursionValue[0],
                /*b1*/ () => this.variables[3].cost + l10(5) < this.variables[8].cost || this.milestones[1] < 2 || this.curMult < 1,
                /*b2*/ () => this.variables[4].cost + l10(5) < this.variables[8].cost || this.milestones[1] < 2 || this.curMult < 1,
                /*c1*/ () => this.variables[5].cost + l10(5) < this.variables[9].cost || this.milestones[1] < 2 || this.curMult < 1,
                /*c2*/ () => this.variables[6].cost + l10(5) < this.variables[9].cost || this.milestones[1] < 2 || this.curMult < 1,
                /*a1*/ () => (this.variables[7].cost + l10(4 + (this.variables[7].level % 10) / 2) < this.variables[2].cost || this.variables[2].cost > this.recursionValue[0]) &&
                    this.variables[7].cost + l10((this.variables[7].level % 10) / 3) < this.recursionValue[0],
                /*a2*/ true,
                /*a3*/ true,
            ],
        };
        const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
        return condition;
    }
    getMilestoneConditions() {
        const conditions = [
            () => this.variables[0].level < 4 && this.maxRho + l10(5) < this.nextMilestoneCost,
            () => true && this.maxRho + l10(5) < this.nextMilestoneCost,
            () => true && this.maxRho + l10(5) < this.nextMilestoneCost,
            () => this.milestones[0] > 0 && this.maxRho + l10(5) < this.nextMilestoneCost,
            () => this.milestones[0] > 0 && this.maxRho + l10(5) < this.nextMilestoneCost,
            () => this.milestones[0] > 1 && this.maxRho + l10(5) < this.nextMilestoneCost,
            () => this.milestones[0] > 1 && this.maxRho + l10(5) < this.nextMilestoneCost,
            () => this.milestones[1] > 0 && this.maxRho + l10(5) < this.nextMilestoneCost,
            () => this.milestones[1] > 1,
            () => this.milestones[1] > 2,
        ];
        return conditions;
    }
    getMilestoneTree() {
        const globalOptimalRoute = [
            [0, 0, 0, 0, 0],
            [1, 0, 0, 0, 0],
            [2, 0, 0, 0, 0],
            [2, 1, 0, 0, 0],
            [2, 2, 0, 0, 0],
            [2, 3, 0, 0, 0],
            [2, 3, 1, 0, 0],
            [2, 3, 2, 0, 0],
            [2, 3, 3, 0, 0],
            [2, 3, 4, 0, 0],
            [2, 3, 5, 0, 0],
            [2, 3, 5, 1, 0],
            [2, 3, 5, 2, 0],
            [2, 3, 5, 2, 1],
            [2, 3, 5, 2, 2],
        ];
        const tree = {
            EF: globalOptimalRoute,
            EFd: globalOptimalRoute,
            EFSnax: globalOptimalRoute,
            EFAI: globalOptimalRoute,
        };
        return tree[this.strat];
    }
    getTotMult(val) {
        return Math.max(0, val * this.tauFactor * 0.09675);
    }
    updateMilestones() {
        let stage = 0;
        const points = [10, 20, 30, 40, 50, 70, 90, 110, 130, 150, 250, 275, 300, 325];
        for (let i = 0; i < points.length; i++) {
            if (Math.max(this.lastPub, this.maxRho) >= points[i])
                stage = i + 1;
            if (points[i] > Math.max(this.lastPub, this.maxRho)) {
                this.nextMilestoneCost = points[i];
                break;
            }
        }
        if (Math.max(this.lastPub, this.maxRho) >= 325)
            this.nextMilestoneCost = Infinity;
        this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
        if (this.variables[4].valueScaling instanceof ExponentialValue && this.variables[4].valueScaling.power !== 1.1 + 0.01 * this.milestones[3]) {
            this.variables[4].valueScaling.power = 1.1 + 0.01 * this.milestones[3];
            this.variables[4].reCalculate();
        }
        if (this.variables[6].valueScaling instanceof ExponentialValue && this.variables[6].valueScaling.power !== 1.1 + 0.0125 * this.milestones[4]) {
            this.variables[6].valueScaling.power = 1.1 + 0.0125 * this.milestones[4];
            this.variables[6].reCalculate();
        }
    }
    evaluatePubConditions() {
        if (!this.isEFAI)
            return false;
        let totalMilestones = 0;
        let initMilestones = 0;
        const points = [10, 20, 30, 40, 50, 70, 90, 110, 130, 150, 250, 275, 300, 325];
        for (let i = 0; i < points.length; i++) {
            if (Math.max(this.lastPub, this.maxRho) >= points[i])
                totalMilestones = i + 1;
            if (this.lastPub >= points[i])
                initMilestones = i + 1;
        }
        return ((this.lastPub < 30 && this.maxRho > 32.4) ||
            (this.lastPub < 40 && this.maxRho > 42) ||
            (this.lastPub < 50 && this.maxRho > 55) ||
            (this.lastPub < 70 && this.maxRho > 72) ||
            (this.lastPub < 90 && this.maxRho > 92) ||
            (this.lastPub < 110 && this.maxRho > 113) ||
            (this.lastPub < 150 && this.maxRho > 153) ||
            (this.lastPub < 130 && this.maxRho > 134) ||
            (this.lastPub < 146 && this.lastPub > 145 && this.curMult > 2) ||
            (this.lastPub < 126 && this.lastPub > 125 && this.curMult > 2) ||
            (this.lastPub < 106 && this.lastPub > 105 && this.curMult > 3) ||
            (this.lastPub < 87 && this.lastPub > 85 && this.curMult > 3) ||
            (this.lastPub < 67 && this.lastPub > 65 && this.curMult > 3) ||
            (this.lastPub < 46.4 && this.lastPub > 44.7 && this.curMult > 3) ||
            (this.lastPub < 37 && this.lastPub > 36 && this.curMult > 3) ||
            (this.lastPub < 27 && this.lastPub > 26 && this.curMult > 3) ||
            (this.lastPub < 298.2 && this.maxRho > 300) ||
            (this.lastPub < 323.2 && this.maxRho > 325) ||
            (totalMilestones - initMilestones < 1 && this.curMult > 2.6 + (totalMilestones - initMilestones) && this.recursionValue[1] < 2 && this.isEFAI) ||
            (this.recursionValue[1] === 2 &&
                this.pubRho > this.variables[7].cost + l10(4) &&
                this.variables[7].cost + l10((this.variables[7].level % 10) / 3) > this.recursionValue[0]));
    }
    forcedPubConditions() {
        if (!this.isEFAI)
            return true;
        return (this.lastPub < 296 || this.pubRho > 300) && (this.lastPub < 321 || this.pubRho > 325);
    }
    evaluateTauHConditions() {
        if (!this.isEFAI)
            return false;
        return (this.lastPub < 298.2 && this.lastPub >= 296) || (this.lastPub >= 321 && this.lastPub < 323.2);
    }
    constructor(data) {
        var _a;
        super(data);
        this.totMult = this.getTotMult(data.rho);
        this.curMult = 0;
        this.currencies = [0, 0, 0];
        this.q = 0;
        this.t_var = 0;
        //initialize variables
        this.varNames = ["t", "q1", "q2", "b1", "b2", "c1", "c2", "a1", "a2", "a3"];
        this.variables = [
            new Variable({ cost: new ExponentialCost(1e6, 1e6), valueScaling: new ExponentialValue(10) }),
            new Variable({ cost: new FirstFreeCost(new ExponentialCost(10, 1.61328)), valueScaling: new StepwisePowerSumValue() }),
            new Variable({ cost: new ExponentialCost(5, 60), valueScaling: new ExponentialValue(2) }),
            new Variable({ cost: new FirstFreeCost(new ExponentialCost(20, 200)), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
            new Variable({ cost: new ExponentialCost(100, 2), valueScaling: new ExponentialValue(1.1) }),
            new Variable({ cost: new FirstFreeCost(new ExponentialCost(20, 200)), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
            new Variable({ cost: new ExponentialCost(100, 2), valueScaling: new ExponentialValue(1.1) }),
            new Variable({ cost: new FirstFreeCost(new ExponentialCost(2000, 2.2, true)), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
            new Variable({ cost: new ExponentialCost(500, 2.2, true), valueScaling: new StepwisePowerSumValue(40, 10, 1) }),
            new Variable({ cost: new ExponentialCost(500, 2.2, true), valueScaling: new ExponentialValue(2) }),
        ];
        this.recursionValue = (_a = data.recursionValue) !== null && _a !== void 0 ? _a : [Infinity, 0];
        this.lastA23 = [0, 0];
        this.isEFAI = this.strat === "EFAI";
        this.nextMilestoneCost = 0;
        this.conditions = this.getBuyingConditions();
        this.milestoneConditions = this.getMilestoneConditions();
        this.milestoneTree = this.getMilestoneTree();
        this.updateMilestones();
    }
    simulate(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.lastPub >= 10 && (data.recursionValue === null || data.recursionValue === undefined) && this.isEFAI) {
                data.recursionValue = [Infinity, 0];
                const res1 = yield ef(data);
                data.recursionValue = [res1.rawData.pubRho, 1];
                const res2 = yield ef(data);
                this.recursionValue = [res2.rawData.pubRho, 2];
                if (this.recursionValue[0] > 300 && this.recursionValue[0] < 301)
                    this.recursionValue[0] = 299.2;
                if (this.recursionValue[0] > 325 && this.recursionValue[0] < 326)
                    this.recursionValue[0] = 324.2;
            }
            let pubCondition = false;
            while (!pubCondition) {
                if (!global.simulating)
                    break;
                if ((this.ticks + 1) % 500000 === 0)
                    yield sleep();
                this.tick();
                if (this.currencies[0] > this.maxRho)
                    this.maxRho = this.currencies[0];
                if (this.lastPub <= 325)
                    this.updateMilestones();
                this.curMult = Math.pow(10, (this.getTotMult(this.maxRho) - this.totMult));
                this.buyVariables();
                pubCondition =
                    (global.forcedPubTime !== Infinity ? this.t > global.forcedPubTime : this.t > this.pubT * 2 || this.pubRho > this.cap[0] || this.evaluatePubConditions()) &&
                        this.pubRho > 10 &&
                        this.forcedPubConditions();
                this.ticks++;
            }
            this.pubMulti = Math.pow(10, (this.getTotMult(this.pubRho) - this.totMult));
            if (!this.isEFAI || this.recursionValue[1] === 2)
                while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT)
                    this.boughtVars.pop();
            const result = createResult(this, this.isEFAI
                ? ` q1: ${this.variables[1].level} q2: ${this.variables[2].level} a1: ${this.variables[7].level}` +
                    (global.showA23 ? ` a2: ${this.lastA23[0]} a3: ${this.lastA23[1]}` : "")
                : "");
            return result;
        });
    }
    tick() {
        const logbonus = l10(this.dt) + this.totMult;
        this.q = add(this.q, this.variables[1].value + this.variables[2].value + logbonus);
        this.t_var += this.dt * (this.variables[0].level / 5 + 0.2);
        const a = (this.variables[7].value + this.variables[8].value + this.variables[9].value) * (0.1 * this.milestones[2] + 1);
        const b = this.variables[3].value + this.variables[4].value;
        const c = this.variables[5].value + this.variables[6].value;
        const R = b + l10(Math.abs(Math.cos(this.t_var)));
        const I = c + l10(Math.abs(Math.sin(this.t_var)));
        this.currencies[1] = this.milestones[0] > 0 ? add(this.currencies[1], logbonus + R * 2) : 0;
        this.currencies[2] = this.milestones[0] > 1 ? add(this.currencies[2], logbonus + I * 2) : 0;
        switch (this.milestones[0]) {
            case 0:
                this.currencies[0] = add(this.currencies[0], logbonus + (l10(this.t_var) + this.q * 2) / 2);
                break;
            case 1:
                this.currencies[0] = add(this.currencies[0], logbonus + add(l10(this.t_var) + this.q * 2, this.currencies[1] * 2) / 2);
                break;
            case 2:
                this.currencies[0] = add(this.currencies[0], logbonus + a + add(add(l10(this.t_var) + this.q * 2, this.currencies[1] * 2), this.currencies[2] * 2) / 2);
                break;
        }
        this.t += this.dt / 1.5;
        this.dt *= this.isEFAI && this.recursionValue[1] < 2 ? Math.min(1.3, this.ddt * 50) : this.ddt;
        //this.dt *= this.ddt;
        if (this.maxRho < this.recovery.value)
            this.recovery.time = this.t;
        this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
        if (this.maxTauH < this.tauH || this.maxRho >= this.cap[0] - this.cap[1] || this.pubRho < 10 || global.forcedPubTime !== Infinity || this.evaluateTauHConditions()) {
            this.maxTauH = this.tauH;
            this.pubT = this.t;
            this.pubRho = this.maxRho;
            this.lastA23 = [this.variables[8].level, this.variables[9].level];
        }
    }
    buyVariables() {
        const currencyIndicies = [0, 0, 0, 1, 1, 2, 2, 0, 1, 2];
        for (let i = this.variables.length - 1; i >= 0; i--)
            while (true) {
                if (this.currencies[currencyIndicies[i]] > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]()) {
                    if (this.maxRho + 5 > this.lastPub && (!this.isEFAI || this.recursionValue[1] === 2)) {
                        this.boughtVars.push({
                            variable: this.varNames[i],
                            level: this.variables[i].level + 1,
                            cost: this.variables[i].cost,
                            timeStamp: this.t,
                            symbol: ["rho", "R", "I"][currencyIndicies[i]],
                        });
                    }
                    this.currencies[currencyIndicies[i]] = subtract(this.currencies[currencyIndicies[i]], this.variables[i].cost);
                    this.variables[i].buy();
                }
                else
                    break;
            }
    }
}
