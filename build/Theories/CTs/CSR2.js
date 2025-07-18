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
import { LinearValue, ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { theoryClass } from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';
export default function csr2(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const sim = new csr2Sim(data);
        const res = yield sim.simulate(data);
        return res;
    });
}
class csr2Sim extends theoryClass {
    getBuyingConditions() {
        const conditions = {
            CSR2: [true, true, true, true, true],
            CSR2d: [
                () => this.variables[0].cost + l10(7 + (this.variables[0].level % 10)) <
                    Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost),
                true,
                () => this.variables[2].cost + l10(15 + (this.variables[2].level % 10)) <
                    Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost),
                true,
                true,
            ],
            CSR2XL: [
                () => this.variables[0].cost + l10(7 + (this.variables[0].level % 10)) <
                    Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost),
                () => this.variables[1].cost + l10(1.8) < this.variables[4].cost,
                () => this.variables[2].cost + l10(15 + (this.variables[2].level % 10)) <
                    Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost),
                () => this.variables[3].cost + l10(1.3) < this.variables[4].cost,
                true,
            ],
        };
        const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
        return condition;
    }
    getMilestoneConditions() {
        const conditions = [() => true, () => true, () => true, () => true, () => this.milestones[1] > 0];
        return conditions;
    }
    getTotMult(val) {
        return Math.max(0, val * this.tauFactor * 0.55075 - l10(200));
    }
    updateMilestones() {
        let milestoneCount = 0;
        const points = [10, 45, 80, 115, 220, 500];
        for (let i = 0; i < points.length; i++) {
            if (Math.max(this.lastPub, this.maxRho) >= points[i])
                milestoneCount = i + 1;
        }
        let priority = [2, 3, 1];
        if (this.lastPub < 500 && this.strat === "CSR2XL") {
            let msCond = 0;
            if (this.lastPub > 45)
                msCond = 4;
            if (this.lastPub > 80)
                msCond = 8;
            if (this.lastPub > 115)
                msCond = 20;
            if (this.lastPub > 220)
                msCond = 40;
            if (((this.rho + l10(msCond * 0.5) > this.variables[3].cost ||
                (this.rho + l10(msCond) > this.variables[4].cost && this.milestones[1] > 0) ||
                (this.curMult > 1 && this.rho + l10(2) > this.variables[1].cost)) &&
                this.rho < Math.min(this.variables[3].cost, this.variables[4].cost)) ||
                this.t > this.recursionValue[0]) {
                priority = [1, 2, 3];
            }
            else
                priority = [2, 3, 1];
        }
        this.milestones = [0, 0, 0];
        const max = [3, 1, 2];
        for (let i = 0; i < priority.length; i++) {
            while (this.milestones[priority[i] - 1] < max[priority[i] - 1] && milestoneCount > 0) {
                this.milestones[priority[i] - 1]++;
                milestoneCount--;
            }
        }
    }
    updateError(n) {
        const root8 = Math.sqrt(8);
        const root8p3 = root8 + 3;
        this.error = (n % 2 == 0 ? subtract(n * l10(root8p3), 0) : add(n * l10(root8p3), 0)) - l10(root8);
    }
    searchCoast(rhodot) {
        if (this.curMult > 0.7) {
            let i = getCoastLen(this.lastPub);
            const maxMulti = ((this.totMult + Math.log10(4) + Math.log10(200)) / 2.203) * 10;
            const s = () => {
                const endRho = add(this.rho, rhodot +
                    this.variables[0].value * (this.maxRho >= 10 ? (this.maxRho >= 45 ? (this.maxRho >= 80 ? 1.15 : 1.1) : 1.05) : 1) +
                    Math.log10(i * 1.5));
                const endTauH = (Math.min(maxMulti, endRho) - this.lastPub) / ((this.t + i) / 3600);
                if (this.bestCoast[0] < endTauH) {
                    this.bestCoast[0] = endTauH;
                    this.bestCoast[1] = this.t;
                }
            };
            if (this.lastPub < 500) {
                s();
                i = i * 0.8;
                s();
                i = i / Math.pow(0.8, 2);
                s();
            }
            else {
                rhodot = this.totMult + this.variables[0].value * (1 + 0.05 * this.milestones[0]) + this.variables[1].value + this.q;
                const qdot = this.totMult + this.variables[2].value + this.variables[4].value * 1.15 + this.error;
                const avgQ = add(this.q + l10(2), qdot + Math.log10(i * 1.5)) - l10(2);
                const endRho = add(this.rho, rhodot - this.q + avgQ + Math.log10(i * 1.5));
                const endTauH = (endRho - this.lastPub) / ((this.t + i) / 3600);
                if (this.bestCoast[0] < endTauH && endRho < maxMulti) {
                    this.bestCoast[0] = endTauH;
                    this.bestCoast[1] = this.t;
                }
            }
        }
    }
    constructor(data) {
        var _a;
        super(data);
        this.totMult = this.getTotMult(data.rho);
        this.curMult = 0;
        this.rho = 0;
        this.q = 0;
        //initialize variables
        this.varNames = ["q1", "q2", "c1", "n", "c2"];
        this.variables = [
            new Variable({ cost: new FirstFreeCost(new ExponentialCost(10, 5)), valueScaling: new StepwisePowerSumValue() }),
            new Variable({ cost: new ExponentialCost(15, 128), valueScaling: new ExponentialValue(2) }),
            new Variable({ cost: new ExponentialCost(1e6, 16), value: 1, valueScaling: new StepwisePowerSumValue() }),
            new Variable({ cost: new ExponentialCost(50, Math.pow(2, (Math.log2(256) * 3.346))), valueScaling: new LinearValue(1, 1), value: 10 }),
            //TODO: this value set to 10 because log10 = 1, fix this hack.
            new Variable({ cost: new ExponentialCost(1e3, Math.pow(10, 5.65)), valueScaling: new ExponentialValue(2) }),
        ];
        this.recursionValue = (_a = data.recursionValue) !== null && _a !== void 0 ? _a : [Infinity, 0];
        this.bestCoast = [0, 0];
        this.updateError_flag = true;
        this.error = 0;
        this.conditions = this.getBuyingConditions();
        this.milestoneConditions = this.getMilestoneConditions();
        this.updateMilestones();
    }
    simulate(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.lastPub >= 10 && (data.recursionValue === null || data.recursionValue === undefined) && this.strat === "CSR2XL") {
                data.recursionValue = [Infinity, 0];
                const sim = new csr2Sim(data);
                yield sim.simulate(data);
                this.recursionValue = [sim.bestCoast[1], 1];
            }
            let pubCondition = false;
            while (!pubCondition) {
                if (!global.simulating)
                    break;
                if ((this.ticks + 1) % 500000 === 0)
                    yield sleep();
                this.tick();
                if (this.rho > this.maxRho)
                    this.maxRho = this.rho;
                this.curMult = Math.pow(10, (this.getTotMult(this.maxRho) - this.totMult));
                if ((this.recursionValue !== null && this.recursionValue !== undefined && this.t < this.recursionValue[0]) ||
                    this.curMult < 0.7 ||
                    this.recursionValue[1] === 0)
                    this.buyVariables();
                if (this.lastPub < 500)
                    this.updateMilestones();
                pubCondition =
                    (global.forcedPubTime !== Infinity ? this.t > global.forcedPubTime : this.t > this.pubT * 2 || this.pubRho > this.cap[0]) && this.pubRho > 10;
                this.ticks++;
            }
            this.pubMulti = Math.pow(10, (this.getTotMult(this.pubRho) - this.totMult));
            let lastBuy = 0;
            for (let i = 0; i < this.variables.length; i++) {
                const costIncs = [5, 128, 16, Math.pow(2, (Math.log2(256) * 3.346)), Math.pow(10, 5.65)];
                lastBuy = Math.max(lastBuy, this.variables[i].cost - l10(costIncs[i]));
            }
            if (this.recursionValue[1] === 1 || this.strat !== "CSR2XL")
                while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT)
                    this.boughtVars.pop();
            const result = createResult(this, this.strat === "CSR2XL" ? " " + Math.min(this.pubMulti, Math.pow(10, (this.getTotMult(lastBuy) - this.totMult))).toFixed(2) : "");
            return result;
        });
    }
    tick() {
        const vq1 = this.variables[0].value * (1 + 0.05 * this.milestones[0]);
        const vc2 = this.milestones[1] > 0 ? this.variables[4].value * (1 + 0.5 * this.milestones[2]) : 0;
        if (this.updateError_flag) {
            const c2level = this.milestones[1] > 0 ? this.variables[4].level : 0;
            const vn = this.variables[3].value + c2level;
            this.updateError(vn);
            this.updateError_flag = false;
        }
        if (this.lastPub < 500)
            this.searchCoast(this.totMult + this.variables[1].value + this.q);
        const qdot = this.variables[2].value + vc2 + this.error;
        this.q = add(this.q, this.totMult + l10(this.dt) + qdot);
        const rhodot = this.totMult + vq1 + this.variables[1].value + this.q;
        this.rho = add(this.rho, rhodot + l10(this.dt));
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
        let bought = false;
        for (let i = this.variables.length - 1; i >= 0; i--)
            while (true) {
                if (this.rho > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]()) {
                    if (this.maxRho + 5 > this.lastPub && (this.recursionValue[1] === 1 || this.strat !== "CSR2XL")) {
                        this.boughtVars.push({ variable: this.varNames[i], level: this.variables[i].level + 1, cost: this.variables[i].cost, timeStamp: this.t });
                    }
                    this.rho = subtract(this.rho, this.variables[i].cost);
                    this.variables[i].buy();
                    if (i > 2)
                        this.updateError_flag = true;
                    bought = true;
                }
                else
                    break;
            }
        if (bought)
            this.searchCoast(this.totMult + this.variables[1].value + this.q);
    }
}
function getCoastLen(r) {
    if (r < 45)
        return Math.pow(r, 2.1) / 10;
    if (r < 80)
        return Math.pow(r, 2.22) / 40;
    if (r < 220)
        return Math.pow(r, 2.7) / 3.3e4 + 40;
    if (r < 500)
        return Math.pow(r, 2.8) / 9.2e4 + 40;
    return Math.pow(1.5, (Math.pow(r, 0.8475) / 20)) * 5;
}
