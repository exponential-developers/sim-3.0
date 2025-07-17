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
import { ExponentialValue, LinearValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { ExponentialCost } from "../../Utils/cost.js";
import { theoryClass } from "../theory.js";
export default function tc(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const sim = new tcSim(data);
        const res = yield sim.simulate();
        return res;
    });
}
class tcSim extends theoryClass {
    getBuyingConditions() {
        const conditions = {
            TC: new Array(7).fill(true),
            TCd: [
                true,
                () => this.variables[1].cost + l10(10) < this.variables[2].cost,
                ...new Array(5).fill(true)
            ]
        };
        const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
        return condition;
    }
    getMilestoneConditions() {
        return [
            () => true,
            () => true,
            () => true,
            () => this.milestones[6] >= 0 && this.variables[3].level <= 75,
            () => this.variables[4].level <= 100,
            () => this.milestones[8] > 0,
            () => this.milestones[8] > 0,
        ];
    }
    getTotMult(val) {
        return Math.max(0, val * 0.2 - l10(2));
    }
    updateMilestones() {
        let stage = 0;
        const points = [10, 35, 50, 65, 90, 110, 130, 150, 200, 325, 375, 400, 420, 440, 600, 750];
        for (let i = 0; i < points.length; i++) {
            if (Math.max(this.lastPub, this.maxRho) >= points[i])
                stage = i + 1;
        }
        this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
        if (this.variables[0].valueScaling.varBase !== 2.75 + 0.125 * this.milestones[4]) {
            this.variables[0].valueScaling.varBase = 2.75 + 0.125 * this.milestones[4];
            this.variables[0].reCalculate();
        }
    }
    getPidValues(strat) {
        switch (strat) {
            case "TC":
            case "TCd":
                return [5, 30, 11, 189];
            default:
                return [5, 0, 0, 100];
        }
    }
    getAutomationSettings(strat) {
        switch (strat) {
            case "TC":
            case "TCd":
                return [200, 1];
            default:
                return [30, 1.5];
        }
    }
    getMilestoneTree() {
        const globalOptimalRoute = [
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [1, 0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 0, 0, 0, 0, 0, 0, 0],
            [1, 2, 0, 0, 0, 0, 0, 0, 0],
            [1, 3, 0, 0, 0, 0, 0, 0, 0],
            [1, 3, 1, 0, 0, 0, 0, 0, 0],
            [1, 3, 2, 0, 0, 0, 0, 0, 0],
            [1, 3, 3, 0, 0, 0, 0, 0, 0],
            [1, 3, 3, 1, 0, 0, 0, 0, 0],
            [1, 3, 3, 2, 0, 0, 0, 0, 0],
            [1, 3, 3, 2, 1, 0, 0, 0, 0],
            [1, 3, 3, 2, 2, 0, 0, 0, 0],
            [1, 3, 3, 2, 2, 1, 0, 0, 0],
            [1, 3, 3, 2, 2, 2, 0, 0, 0],
            [1, 3, 3, 2, 2, 2, 1, 0, 0],
            [1, 3, 3, 2, 2, 2, 1, 1, 0],
            [1, 3, 3, 2, 2, 2, 1, 1, 1], // P variable added
        ];
        const tree = {
            TC: globalOptimalRoute,
            TCd: globalOptimalRoute
        };
        return tree[this.strat];
    }
    constructor(data) {
        super(data);
        this.totMult = this.getTotMult(data.rho);
        this.systemDt = 0.1;
        this.curMult = 0;
        this.error = [0, 0];
        this.rho = 0;
        this.r = 0;
        this.P = 0;
        this.timer = 0;
        this.integral = 0;
        let automationSettings = this.getAutomationSettings(data.strat);
        this.amplitude = automationSettings[0];
        this.frequency = automationSettings[1];
        let pidSettings = this.getPidValues(data.strat);
        this.kp = pidSettings[0];
        this.ki = pidSettings[1];
        this.kd = pidSettings[2];
        this.T = 100;
        this.setPoint = pidSettings[3];
        this.pubUnlock = 8;
        this.varNames = ["c1", "r1", "r2", "c2", "dTexp", "p1", "p2"];
        this.variables = [
            new Variable({ cost: new ExponentialCost(1e5, 18), valueScaling: new ExponentialValue(2.75) }),
            new Variable({ cost: new ExponentialCost(10, 1.585), valueScaling: new StepwisePowerSumValue() }),
            new Variable({ cost: new ExponentialCost(1000, 8), valueScaling: new ExponentialValue(2) }),
            new Variable({ cost: new ExponentialCost("1e400", Math.pow(10, 4.5)), valueScaling: new ExponentialValue(Math.E) }),
            new Variable({ cost: new ExponentialCost(1e15, 1000), valueScaling: new LinearValue(1) }),
            new Variable({ cost: new ExponentialCost("1e750", 16.60964), valueScaling: new StepwisePowerSumValue() }),
            new Variable({ cost: new ExponentialCost("1e900", 1e15), valueScaling: new ExponentialValue(2) }), // p2
        ];
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
                if (this.lastPub < 500)
                    this.updateMilestones();
                this.curMult = Math.pow(10, this.getTotMult(this.maxRho) - this.totMult);
                this.buyVariables();
                pubCondition =
                    (global.forcedPubTime !== Infinity
                        ? this.t > global.forcedPubTime
                        : this.t > this.pubT * 2 || this.pubRho > this.cap[0] || this.curMult > 15) &&
                        this.pubRho > this.pubUnlock &&
                        this.pubRho > this.lastPub;
                this.ticks++;
            }
            this.pubMulti = Math.pow(10, this.getTotMult(this.pubRho) - this.totMult);
            while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT)
                this.boughtVars.pop();
            const result = createResult(this, "");
            return result;
        });
    }
    tick() {
        let Q = 20; // max heat duty in W
        let h = 5; // thermal passive convection coefficient for Al (W/m^2 k)
        let Cp = 0.89; // heat capacity for Al (J/g/k)
        let area = 0.024; // area of element (m^2)
        let mass = 10; // grams
        let Tc = 30;
        this.timer += this.systemDt;
        if (this.timer > this.frequency) {
            this.T = this.amplitude;
            this.timer = 0;
            this.integral = 0;
        }
        this.error[1] = this.error[0];
        this.error[0] = this.setPoint - this.T;
        this.integral += this.error[0];
        let derivative = (this.error[0] - this.error[1]) / this.systemDt;
        // Anti-windup scheme
        if (this.integral > 100)
            this.integral = 100;
        if (this.integral < -100)
            this.integral = -100;
        let output = Math.round(Math.max(0, Math.min(this.kp * this.error[0] + this.ki * this.integral + this.kd * derivative, 512))) / 512; // range 0-512
        // Heating simulation
        let dT = Math.abs(1 / mass / Cp * (Q * output - (this.T - Tc) * h * area));
        let exponentialTerm = (Q * output - h * area * (this.T - Tc)) * Math.pow(Math.E, -1 * this.systemDt / mass / Cp);
        this.T = Tc + (Q * output - exponentialTerm) / (h * area);
        let mr1exp = this.milestones[2];
        let mr2exp = this.milestones[3];
        let dr = this.variables[1].value * (1 + mr1exp * 0.05) +
            l10(2) * this.variables[2].level * (1 + mr2exp * 0.03) -
            l10(1 + l10(1 + Math.abs(this.error[0])));
        let achievementMulti = 1;
        if (this.milestones[7] > 0) {
            if (this.lastPub > 600 && this.lastPub < 750) {
                achievementMulti = 10;
            }
            else if (this.lastPub > 750) {
                achievementMulti = 30;
            }
        }
        if (this.milestones[8] > 0) {
            let dP = this.variables[5].value + this.variables[6].value + l10(this.T) - l10(100);
            this.P = add(this.P, dP + l10(this.dt));
        }
        this.r = add(this.r, dr + l10(this.dt));
        let mc1Base = this.milestones[4];
        let mc1exp = this.milestones[1];
        let vc1 = l10(2.75 + mc1Base * 0.125) * this.variables[0].level * (1 + mc1exp * 0.05);
        let vc2 = this.milestones[6] > 0 ? this.variables[3].value : 0;
        let mrexp = this.milestones[5];
        this.rho = add(this.rho, this.P +
            this.r * (1 + mrexp * 0.001) +
            (vc1 + vc2 + l10(dT) * (2 + this.variables[4].value)) / 2 +
            l10(this.dt) +
            this.totMult +
            l10(achievementMulti));
        this.t += this.dt / 1.5;
        this.dt *= this.ddt;
        if (this.maxRho < this.recovery.value) {
            this.recovery.time = this.t;
        }
        this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
        if (this.maxTauH < this.tauH ||
            this.maxRho >= this.cap[0] - this.cap[1] ||
            this.pubRho < 10 ||
            global.forcedPubTime !== Infinity) {
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
                        this.boughtVars.push({
                            variable: this.varNames[i],
                            level: this.variables[i].level + 1,
                            cost: this.variables[i].cost,
                            timeStamp: this.t,
                        });
                    }
                    this.rho = subtract(this.rho, this.variables[i].cost);
                    this.variables[i].buy();
                }
                else
                    break;
            }
    }
}
