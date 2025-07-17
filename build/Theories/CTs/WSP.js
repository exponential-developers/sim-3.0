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
export default function wsp(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const sim = new wspSim(data);
        const res = yield sim.simulate();
        return res;
    });
}
class wspSim extends theoryClass {
    getBuyingConditions() {
        let c1weight = 0;
        if (this.lastPub >= 25)
            c1weight = l10(3);
        if (this.lastPub >= 40)
            c1weight = 1;
        if (this.lastPub >= 200)
            c1weight = l10(50);
        if (this.lastPub >= 400)
            c1weight = 3;
        if (this.lastPub >= 700)
            c1weight = 10000;
        const conditions = {
            WSP: [true, true, true, true, true],
            WSPStopC1: [true, true, true, () => this.lastPub < 450 || this.t < 15, true],
            WSPdStopC1: [
                () => this.variables[0].cost + l10(8 + (this.variables[0].level % 10)) <
                    Math.min(this.variables[1].cost, this.variables[2].cost, this.milestones[1] > 0 ? this.variables[4].cost : Infinity),
                true,
                true,
                () => this.variables[3].cost + c1weight <
                    Math.min(this.variables[1].cost, this.variables[2].cost, this.milestones[1] > 0 ? this.variables[4].cost : Infinity) || this.t < 15,
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
    getMilestoneTree() {
        const globalOptimalRoute = [
            [0, 0, 0],
            [0, 0, 1],
            [0, 0, 2],
            [0, 0, 3],
            [0, 1, 3],
            [1, 1, 3],
            [2, 1, 3],
            [3, 1, 3],
            [4, 1, 3],
        ];
        const tree = {
            WSP: globalOptimalRoute,
            WSPStopC1: globalOptimalRoute,
            WSPdStopC1: globalOptimalRoute,
        };
        return tree[this.strat];
    }
    getTotMult(val) {
        return Math.max(0, val * this.tauFactor * 0.375);
    }
    updateMilestones() {
        let stage = 0;
        const points = [10, 25, 40, 55, 70, 100, 140, 200];
        for (let i = 0; i < points.length; i++) {
            if (Math.max(this.lastPub, this.maxRho) >= points[i])
                stage = i + 1;
        }
        this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
    }
    updateS() {
        const vn = l10(this.variables[2].value);
        const vc1 = this.variables[3].value;
        const chi = Math.pow(10, (l10(Math.PI) + vc1 + vn - add(vc1, vn - l10(3) * this.milestones[2]))) + 1;
        this.S = this.sineRatioK(this.variables[2].value, chi / Math.PI);
    }
    constructor(data) {
        super(data);
        this.srK_helper = (x) => {
            const x2 = x * x;
            return Math.log(x2 + 1 / 6 + 1 / 120 / x2 + 1 / 810 / x2 / x2) / 2 - 1;
        };
        this.sineRatioK = (n, x, K = 5) => {
            if (n < 1 || x >= n + 1)
                return 0;
            const N = n + 1 + K, x2 = x * x, L1 = this.srK_helper(N + x), L2 = this.srK_helper(N - x), L3 = this.srK_helper(N);
            let result = N * (L1 + L2 - 2 * L3) + x * (L1 - L2) - Math.log(1 - x2 / N / N) / 2;
            for (let k = n + 1; k < N; ++k)
                result -= Math.log(1 - x2 / k / k);
            return Math.LOG10E * result;
        };
        this.totMult = this.getTotMult(data.rho);
        this.rho = 0;
        this.q = 0;
        //initialize variables
        this.varNames = ["q1", "q2", "n", "c1", "c2"];
        this.variables = [
            new Variable({ cost: new FirstFreeCost(new ExponentialCost(10, 3.38 / 4, true)), valueScaling: new StepwisePowerSumValue() }),
            new Variable({ cost: new ExponentialCost(1000, 3.38 * 3, true), valueScaling: new ExponentialValue(2) }),
            new Variable({ cost: new ExponentialCost(20, 3.38, true), valueScaling: new ExponentialValue(10) }),
            new Variable({ cost: new ExponentialCost(50, 3.38 / 1.5, true), valueScaling: new StepwisePowerSumValue(2, 50) }),
            new Variable({ cost: new ExponentialCost(1e10, 3.38 * 10, true), valueScaling: new ExponentialValue(2) }),
        ];
        this.S = 0;
        this.conditions = this.getBuyingConditions();
        this.milestoneConditions = this.getMilestoneConditions();
        this.milestoneTree = this.getMilestoneTree();
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
                if (this.lastPub < 200)
                    this.updateMilestones();
                this.curMult = Math.pow(10, (this.getTotMult(this.maxRho) - this.totMult));
                this.buyVariables();
                pubCondition =
                    (global.forcedPubTime !== Infinity
                        ? this.t > global.forcedPubTime
                        : this.t > this.pubT * 2 || this.pubRho > this.cap[0] || this.curMult > 15) && this.pubRho > 8;
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
        const vq1 = this.variables[0].value * (1 + 0.01 * this.milestones[0]);
        const qdot = Math.max(0, l10(this.dt) + this.S + this.variables[4].value);
        this.q = add(this.q, qdot);
        const rhodot = this.totMult + vq1 + this.variables[1].value + this.q + l10(this.dt);
        this.rho = add(this.rho, rhodot);
        this.t += this.dt / 1.5;
        this.dt *= this.ddt;
        if (this.maxRho < this.recovery.value)
            this.recovery.time = this.t;
        this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
        if (this.maxTauH < this.tauH || this.maxRho >= this.cap[0] - this.cap[1] || this.pubRho < 8 || global.forcedPubTime !== Infinity) {
            this.maxTauH = this.tauH;
            this.pubT = this.t;
            this.pubRho = this.maxRho;
        }
    }
    buyVariables() {
        let updateS_flag = false;
        for (let i = this.variables.length - 1; i >= 0; i--)
            while (true) {
                if (this.rho > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]()) {
                    this.rho = subtract(this.rho, this.variables[i].cost);
                    if (this.maxRho + 5 > this.lastPub) {
                        this.boughtVars.push({ variable: this.varNames[i], level: this.variables[i].level + 1, cost: this.variables[i].cost, timeStamp: this.t });
                    }
                    this.variables[i].buy();
                    if (i === 2 || i === 4)
                        updateS_flag = true;
                }
                else
                    break;
            }
        if (updateS_flag)
            this.updateS();
    }
}
