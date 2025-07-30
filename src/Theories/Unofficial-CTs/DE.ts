import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep } from "../../Utils/helpers.js";
import { BaseValue, ExponentialValue, LinearValue, StepwisePowerSumValue } from "../../Utils/value.js";
import Variable from "../../Utils/variable.js";
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";
import { BaseCost, CompositeCost, ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';
import { parseValue } from "../../Sim/parsers.js";
import { LibManifestPlugin } from "webpack";

export default async function de(data: theoryData): Promise<simResult> {
  const sim = new deSim(data);
  const res = await sim.simulate();
  return res;
}

class StepwiseMulValue extends BaseValue {
  model: StepwisePowerSumValue;
  mul: number;
  constructor(base: number, length: number, mul: number){
    const model = new StepwisePowerSumValue(base, length);
    super(model.varBase);
    this.model = model;
    this.mul = mul;
  }

  computeNewValue(prevValue: number, currentLevel: number, isZero: boolean): number {
        let toAdd = Math.log10(this.model.base) * Math.floor(currentLevel / this.model.length) + l10(this.mul);
        return isZero ? toAdd : add(prevValue, toAdd);
    }
    recomputeValue(level: number): number {
        return this.model.recomputeValue(level) + l10(this.mul);
    }
    copy(): StepwiseMulValue {
        return new StepwiseMulValue(this.model.base, this.model.length, this.mul);
    }
}

type theory = "DE";

class deSim extends theoryClass<theory> implements specificTheoryProps {
  rho: number;
  pubUnlock: number;
  x: number;

  getBuyingConditions() {
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      DE: new Array(7).fill(true)
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getMilestoneConditions() {
    const conditions: Array<conditionFunction> = [
      () => true, // n
      () => true, // a0
      () => true, // a1
      () => this.milestones[2] > 0, // a2
      () => false, // a3
      () => true // max x
    ];
    return conditions;
  }

  getTotMult(val: number) {
    return Math.max(0, val * this.tauFactor * 1.6 - l10(4));
  }
  updateMilestones(): void {
    let stage = 0;
    const maxRho = Math.max(this.lastPub, this.maxRho);
    const points = [20, 45, 70, 95, 120, 145, 170, 250, 550, 650, 750];
    const max = [4, 2, maxRho >= 80 ? 1 : 0, maxRho >= 150 ? 3 : 0];
    const priority = [3, 1, 2, 4]
    for (let i = 0; i < points.length; i++) {
      if (maxRho >= points[i]) stage = i + 1;
    }
    let milestoneCount = stage;
    this.milestones = [0, 0, 0, 0];
    for (let i = 0; i < priority.length; i++) {
        while (this.milestones[priority[i] - 1] < max[priority[i] - 1] && milestoneCount > 0) {
            this.milestones[priority[i] - 1]++;
            milestoneCount--;
        }
    }
  }
  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = l10(5e8);
    this.totMult = data.rho < this.pubUnlock ? 0 : this.getTotMult(data.rho);
    this.rho = 0;
    this.varNames = ["n", "a0", "a1", "a2", "a3", "max x"];
    this.variables = [
      new Variable({ cost: new ExponentialCost(200, 2.2), valueScaling: new ExponentialValue(2 ** 0.3) }), // n
      new Variable({ cost: new FirstFreeCost(new ExponentialCost(3, 1.6)), valueScaling: new StepwisePowerSumValue(2.2, 5) }), // a0
      new Variable({ cost: new ExponentialCost(50, 1.74), valueScaling: new StepwisePowerSumValue(3, 7) }), // a1
      new Variable({ cost: new ExponentialCost(1e85, 35), valueScaling: new StepwiseMulValue(1.5, 11, 1/10)}), // a2
      new Variable({ cost: new ExponentialCost("1e300", 40), valueScaling: new StepwiseMulValue(1.1, 11, 1/10)}), // a3
      new Variable({ cost: new CompositeCost(26, new ExponentialCost(1e7, 12, true), new ExponentialCost(1e101, 20, true)), valueScaling: new LinearValue()}), // max x upgrade
    ];
    this.x = 1e-100;
    this.conditions = this.getBuyingConditions();
    this.milestoneConditions = this.getMilestoneConditions();
    this.updateMilestones();
  }
  async simulate() {
    let pubCondition = false;
    while (!pubCondition) {
      if (!global.simulating) break;
      if ((this.ticks + 1) % 500000 === 0) await sleep();
      this.tick();
      if (this.rho > this.maxRho) this.maxRho = this.rho;
      this.updateMilestones();
      this.curMult = 10 ** (this.getTotMult(this.maxRho) - this.totMult);
      this.buyVariables();
      pubCondition = (global.forcedPubTime !== Infinity ? this.t > global.forcedPubTime : this.t > this.pubT * 2 || this.pubRho > this.cap[0]) && this.pubRho > this.pubUnlock;
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    const result = createResult(this, "");

    return result;
  }

  getCapX(): number {
    return l10(1024) + this.variables[5].level * l10(5 + 3 * this.milestones[0])
  }

  tick() {
    const va0 = this.variables[1].value * (1 + this.milestones[3])
    const vn = this.variables[0].value * (1.2 - 0.6 * this.milestones[1])

    const rhodot = add(add(add(
      this.variables[1].value, 
      l10(2) + this.variables[2].value + this.x),
      this.milestones[2] > 0 ? l10(3) * this.variables[3].value + 2 * this.x : 1e-50),
      1e-50
    ) + this.variables[0].value

    this.rho = add(this.rho, rhodot + this.totMult + l10(this.dt));

    this.x = add(this.x, this.variables[0].value + l10(add(l10(Math.E), va0 - vn) * Math.log(10)) + l10(this.dt));
    const xcap = this.getCapX();
    this.x = this.x >= xcap ? xcap : this.x;


    this.t += this.dt / 1.5;
    this.dt *= this.ddt;
    if (this.maxRho < this.recovery.value) this.recovery.time = this.t;

    this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
    if (this.maxTauH < this.tauH || this.maxRho >= this.cap[0] - this.cap[1] || this.pubRho < this.pubUnlock || global.forcedPubTime !== Infinity) {
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
          this.x = 1e-50;
          if (i == 3) {
            console.log(10**this.variables[3].value);
          }
        } else break;
      }
  }
}
