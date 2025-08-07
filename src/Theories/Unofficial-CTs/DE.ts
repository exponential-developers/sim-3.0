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
    super();
    this.model = model;
    this.mul = mul;
  }

  computeNewValue(prevValue: number, currentLevel: number): number {
      return this.recomputeValue(currentLevel + 1);
    }
    recomputeValue(level: number): number {
        return this.model.recomputeValue(level) + l10(this.mul);
    }
    copy(): StepwiseMulValue {
        return new StepwiseMulValue(this.model.base, this.model.length, this.mul);
    }
}

class MaxXPermCapCost extends BaseCost {
  getCost(level: number): number {
    if (level >= 7) {
      return Infinity
    }
    return [400, 500, 650, 900, 1050, 1250, 1500][level];
  }

  copy() {
    return new MaxXPermCapCost;
  }
}

type theory = "DE";

class deSim extends theoryClass<theory> implements specificTheoryProps {
  rho: number;
  pubUnlock: number;
  x: number;
  t_var: number;
  q: number;

  getBuyingConditions() {
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      DE: new Array(8).fill(true)
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getMilestoneConditions() {
    const conditions: Array<conditionFunction> = [
      () => true, // n
      () => this.milestones[4] > 0, // m
      () => true, // a0
      () => true, // a1
      () => this.milestones[2] > 0, // a2
      () => true, // max x
      () => this.variables[6].level < 7 //maxXPermCap
    ];
    return conditions;
  }
  getTotMult(val: number) {
    return Math.max(0, val * this.tauFactor * 0.4 - l10(4));
  }
  updateMilestones(): void {
    let stage = 0;
    const maxRho = Math.max(this.lastPub, this.maxRho);
    const points = [20, 45, 70, 100, 125, 150, 175, 200, 225, 250, 375, 475, 700, 825, 900, 950, 1000, 1100, 1250, 1400];
    const max = [
      this.variables[6].value, 
      2, 
      maxRho >= 80 ? 1 : 0, 
      maxRho >= 150 ? 3 : 0, 
      maxRho >= 200 ? 1 : 0
    ];
    const priority = [3, 5, 1, 2, 4]
    for (let i = 0; i < points.length; i++) {
      if (maxRho >= points[i]) stage = i + 1;
    }
    let milestoneCount = stage;
    this.milestones = [0, 0, 0, 0, 0];
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
    this.varNames = ["n", "m", "a0", "a1", "a2", "max x", "perm"];
    this.variables = [
      new Variable({ cost: new ExponentialCost(200, 2.2), valueScaling: new ExponentialValue(2 ** 0.3) }), // n
      new Variable({ cost: new ExponentialCost(1e200, 1000), valueScaling: new ExponentialValue(2) }), // m
      new Variable({ cost: new FirstFreeCost(new CompositeCost(4377, new ExponentialCost(3, 1.4), new ExponentialCost("1e640", 5))), valueScaling: new StepwisePowerSumValue(2.2, 5) }), // a0
      new Variable({ cost: new ExponentialCost(50, 1.74), valueScaling: new StepwisePowerSumValue(3, 7) }), // a1
      new Variable({ cost: new ExponentialCost(1e85, 20), valueScaling: new StepwiseMulValue(1.5, 11, 1/10)}), // a2
      new Variable({ cost: new CompositeCost(26, new ExponentialCost(1e7, 12, true), new ExponentialCost(1e101, 19.5, true)), valueScaling: new LinearValue()}), // max x upgrade
      new Variable({ cost: new MaxXPermCapCost, valueScaling: new LinearValue(1, 6)}) // max X perm cap
    ];
    while (this.lastPub >= this.variables[6].cost) {
      this.variables[6].buy();
    }
    this.x = 1e-100;
    this.t_var = 1e-100;
    this.q = 0;
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
    const mslvl = this.milestones[0];
    return l10(1024) + this.variables[5].level * l10(mslvl >= 10 ? 19.5 + mslvl / 2 : mslvl >= 6 ? 15 + mslvl : 5 + mslvl * 3)
  }

  tick() {
    const va0 = this.variables[2].value * (1 + this.milestones[3])
    const vn = this.variables[0].value * (1.2 - 0.6 * this.milestones[1])
    const vm = this.variables[1].value - 256 * l10(2)

    const rhodot = add(add(
      this.variables[2].value, 
      l10(2) + this.variables[3].value + this.x),
      this.milestones[2] > 0 ? l10(3) * this.variables[4].value + 2 * this.x : -Infinity)
    + this.variables[0].value + (this.milestones[4] > 0 ? 0.1*this.q : 0)

    this.rho = add(this.rho, rhodot + this.totMult + l10(this.dt));
    this.t_var = add(this.t_var, this.totMult + l10(this.dt));

    this.x = add(this.x, this.variables[0].value + l10(add(l10(Math.E), va0 - vn) * Math.log(10)) + l10(this.dt));
    const xcap = this.getCapX();
    this.x = this.x >= xcap ? xcap : this.x;
    if (this.milestones[4] > 0) {
      this.q = add(this.q, this.variables[3].value + this.x + vm - add(0, this.t_var) + l10(this.dt));
    }

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
          this.t_var = 1e-50;
          if (i == 1) {
            this.q = 0;
          }
        } else break;
      }
  }
}
