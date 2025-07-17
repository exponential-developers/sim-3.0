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
import { add, createResult, l10, subtract, sleep, l2 } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { theoryClass } from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';
export default function sl(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const sim = new slSim(data);
        const res = yield sim.simulate();
        return res;
    });
}
class slSim extends theoryClass {
    getBuyingConditions() {
        const conditions = {
            SL: [true, true, true, true],
            SLStopA: [() => this.curMult < 4.5, () => this.curMult < 4.5, () => this.curMult < 6, () => this.curMult < 6],
            SLStopAd: [
                () => this.curMult < 4.5 && this.variables[0].cost + l10(2 * (this.variables[0].level % 3) + 0.0001) < this.variables[1].cost,
                () => this.curMult < 4.5,
                () => this.curMult < 6 && this.variables[2].cost + l10(this.variables[2].cost % 4) < this.variables[3].cost,
                () => this.curMult < 6,
            ],
            SLMS: [() => this.curMult < 4, () => this.curMult < 4, () => this.curMult < 7.5, () => this.curMult < 7.5],
            SLMSd: [
                () => this.curMult < 4 && this.variables[0].cost + l10(2 * (this.variables[0].level % 3) + 0.0001) < this.variables[1].cost,
                () => this.curMult < 4,
                () => this.curMult < 7.5 && this.variables[2].cost + l10(this.variables[2].cost % 4) < this.variables[3].cost,
                () => this.curMult < 7.5,
            ],
        };
        const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
        return condition;
    }
    getMilestoneConditions() {
        const conditions = [() => true, () => true, () => true, () => true];
        return conditions;
    }
    getTotMult(val) {
        return Math.max(0, val * this.tauFactor * 0.375);
    }
    updateMilestones() {
        const maxVal = Math.max(this.lastPub, this.maxRho);
        let milestoneCount = Math.min(13, Math.floor(maxVal / 25));
        this.milestones = [0, 0, 0, 0];
        let priority = [4, 3, 1, 2];
        if ((this.strat === "SLMS" || this.strat === "SLMSd") && maxVal >= 25 && maxVal <= 300) {
            //when to swap to a3exp (increasing rho2dot) before b1b2
            let emg_Before_b1b2 = 5;
            //when to swap to rho2 exp before b1b2
            let r2exp_Before_b1b2 = 4;
            if (maxVal < 50) {
                emg_Before_b1b2 = 5;
                r2exp_Before_b1b2 = 4;
            }
            else if (maxVal < 75) {
                emg_Before_b1b2 = 7;
                r2exp_Before_b1b2 = 6;
            }
            else if (maxVal < 100) {
                emg_Before_b1b2 = 12;
                r2exp_Before_b1b2 = 10;
            }
            else if (maxVal < 150) {
                emg_Before_b1b2 = 20;
                r2exp_Before_b1b2 = 15;
            }
            else if (maxVal < 175) {
                emg_Before_b1b2 = 8;
                r2exp_Before_b1b2 = 6;
            }
            else if (maxVal < 200) {
                emg_Before_b1b2 = 1.5;
                r2exp_Before_b1b2 = 1;
            }
            else if (maxVal < 275) {
                emg_Before_b1b2 = 3;
                r2exp_Before_b1b2 = 3;
            }
            else if (maxVal < 300) {
                emg_Before_b1b2 = 2;
                r2exp_Before_b1b2 = 2;
            }
            const minCost = Math.min(this.variables[2].cost, this.variables[3].cost);
            if (this.rho + l10(emg_Before_b1b2) < minCost) {
                //b12 exp
                priority = [4, 3, 1, 2];
            }
            else if (this.curMult > 4.5 || this.rho + l10(r2exp_Before_b1b2) > minCost) {
                //rho2 exp
                priority = [1, 2, 4, 3];
            }
            else if (this.rho + l10(emg_Before_b1b2) > minCost && this.rho + l10(r2exp_Before_b1b2) < minCost) {
                //a3 boost
                priority = [2, 1, 4, 3];
            }
        }
        const max = [3, 5, 2, 2];
        for (let i = 0; i < priority.length; i++) {
            while (this.milestones[priority[i] - 1] < max[priority[i] - 1] && milestoneCount > 0) {
                this.milestones[priority[i] - 1]++;
                milestoneCount--;
            }
        }
    }
    constructor(data) {
        super(data);
        this.updateInverseE_Gamma = (x) => {
            const y = l10(l10(2) / Math.LOG10E + x / Math.LOG10E + l10(Math.PI) / Math.LOG10E) - (l10(2) + x);
            this.inverseE_Gamma = 0 - Math.LOG10E - add(subtract(y, y + y - l10(2)), y + y + y + l10(6));
        };
        this.totMult = this.getTotMult(data.rho);
        this.curMult = 0;
        this.rho = 0;
        this.rho2 = 0;
        this.rho3 = 0;
        this.varNames = ["a1", "a2", "b1", "b2"];
        this.variables = [
            new Variable({ cost: new FirstFreeCost(new ExponentialCost(1, 0.369 * l2(10), true)), valueScaling: new StepwisePowerSumValue(3.5, 3) }),
            new Variable({ cost: new ExponentialCost(175, 10), valueScaling: new ExponentialValue(2) }),
            new Variable({ cost: new ExponentialCost(500, 0.649 * l2(10), true), valueScaling: new StepwisePowerSumValue(6.5, 4) }),
            new Variable({ cost: new ExponentialCost(1000, 0.926 * l2(10), true), valueScaling: new ExponentialValue(2) }),
        ];
        this.inverseE_Gamma = 0;
        this.conditions = this.getBuyingConditions();
        this.milestoneConditions = this.getMilestoneConditions();
        this.updateMilestones();
    }
    simulate() {
        return __awaiter(this, void 0, void 0, function* () {
            let pubCondition = false;
            while (!pubCondition) {
                if (!global.simulating)
                    break;
                if ((this.ticks + 1) % 500000 === 0)
                    yield sleep();
                this.tick();
                if (this.rho > this.maxRho)
                    this.maxRho = this.rho;
                if (this.lastPub < 300)
                    this.updateMilestones();
                this.curMult = Math.pow(10, (this.getTotMult(this.maxRho) - this.totMult));
                this.buyVariables();
                pubCondition =
                    (global.forcedPubTime !== Infinity
                        ? this.t > global.forcedPubTime
                        : this.t > this.pubT * 2 || this.pubRho > this.cap[0] || this.curMult > 15) && this.pubRho > 10;
                this.ticks++;
            }
            this.pubMulti = Math.pow(10, (this.getTotMult(this.pubRho) - this.totMult));
            while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT)
                this.boughtVars.pop();
            const result = createResult(this, "");
            return result;
        });
    }
    tick() {
        const rho3dot = this.variables[2].value * (1 + 0.02 * this.milestones[2]) + this.variables[3].value * (1 + 0.02 * this.milestones[3]);
        this.rho3 = add(this.rho3, rho3dot + l10(this.dt));
        this.updateInverseE_Gamma(Math.max(1, this.rho3));
        const rho2dot = Math.LOG10E *
            (this.variables[0].value / Math.LOG10E +
                this.variables[1].value / Math.LOG10E -
                Math.log(2 - 0.008 * this.milestones[1]) * (Math.max(1, this.rho3) / Math.LOG10E));
        this.rho2 = add(this.rho2, Math.max(0, rho2dot) + l10(this.dt));
        const rhodot = this.rho2 * (1 + this.milestones[0] * 0.02) * 0.5 + this.inverseE_Gamma;
        this.rho = add(this.rho, rhodot + this.totMult + l10(this.dt));
        this.t += this.dt / 1.5;
        this.dt *= this.ddt;
        if (this.maxRho < this.recovery.value)
            this.recovery.time = this.t;
        this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
        if (this.maxTauH < this.tauH || this.maxRho >= this.cap[0] - this.cap[1] || this.pubRho < 10 || global.forcedPubTime !== Infinity) {
            this.maxTauH = this.tauH;
            this.pubT = this.t;
            this.pubRho = this.maxRho;
        }
    }
    buyVariables() {
        for (let i = this.variables.length - 1; i >= 0; i--)
            while (true) {
                if (this.rho > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]()) {
                    if (this.maxRho + 5 > this.lastPub) {
                        this.boughtVars.push({ variable: this.varNames[i], level: this.variables[i].level + 1, cost: this.variables[i].cost, timeStamp: this.t });
                    }
                    this.rho = subtract(this.rho, this.variables[i].cost);
                    this.variables[i].buy();
                }
                else
                    break;
            }
    }
}
