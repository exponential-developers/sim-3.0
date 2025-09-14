import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, getLastLevel, getR9multiplier } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import theoryClass from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';

export default async function t4(data: theoryData): Promise<simResult> {
  const sim = new t4Sim(data);
  const res = await sim.simulate(data);
  return res;
}

type theory = "T4";

class t4Sim extends theoryClass<theory> {
  recursionValue: number;
  q: number;

  getBuyingConditions() {
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      T4C3d66: [
        false,
        false,
        () => this.variables[2].cost + 0.1 < (this.recursionValue ?? Infinity),
        ...new Array(3).fill(false),
        () =>
          this.variables[6].cost + l10(10 + (this.variables[6].level % 10)) <= Math.min(this.variables[7].cost, this.variables[2].cost) &&
          this.variables[6].cost + l10(10 + (this.variables[6].level % 10)) + 1 < (this.recursionValue ?? Infinity),
        () => this.variables[7].cost + 0.5 < (this.recursionValue ?? Infinity) && (this.curMult < 1 || this.variables[7].cost + l10(1.5) <= this.variables[2].cost),
      ],
      T4C3coast: [
        false,
        false,
        () => this.variables[2].cost + 0.1 < (this.recursionValue ?? Infinity),
        ...new Array(3).fill(false),
        () => this.variables[6].cost + l10(10 + (this.variables[6].level % 10)) + 1 < (this.recursionValue ?? Infinity),
        () => this.variables[7].cost + 0.5 < (this.recursionValue ?? Infinity),
      ],
      T4C3: [false, false, true, ...new Array(3).fill(false), true, true],
      T4C3dC12rcv: [() => this.variables[0].cost + 1 < this.variables[1].cost && this.maxRho < this.lastPub, () => this.maxRho < this.lastPub, true, false, false, false, () => this.variables[6].cost + 1 < this.variables[7].cost, true],
      T4C356dC12rcv: [() => this.variables[0].cost + 1 < this.variables[1].cost && this.maxRho < this.lastPub, () => this.maxRho < this.lastPub, true, false, true, true, () => this.variables[6].cost + 1 < this.variables[7].cost, true],
      T4C456dC12rcvMS: [() => this.variables[0].cost + 1 < this.variables[1].cost && this.maxRho < this.lastPub, () => this.maxRho < this.lastPub, false, true, true, true, () => this.variables[6].cost + 1 < this.variables[7].cost, true],
      T4C123d: [() => this.variables[0].cost + 1 < this.variables[1].cost, true, true, false, false, false, () => this.variables[6].cost + 1 < this.variables[7].cost, true],
      T4C123: [true, true, true, false, false, false, true, true],
      T4C12d: [() => this.variables[0].cost + 1 < this.variables[1].cost, true, false, false, false, false, false, false],
      T4C12: [true, true, ...new Array(6).fill(false)],
      T4C56: [...new Array(4).fill(false), true, true, true, true],
      T4C4: [...new Array(3).fill(false), true, false, false, true, true],
      T4C5: [...new Array(4).fill(false), true, false, true, true],
      T4: new Array(8).fill(true),
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getVariableAvailability() {
    const conditions: Array<conditionFunction> = [() => true, () => true, () => true, () => this.milestones[0] > 0, () => this.milestones[0] > 1, () => this.milestones[0] > 2, () => true, () => true];
    return conditions;
  }
  getTotMult(val: number) {
    return Math.max(0, val * 0.165 - l10(4)) + getR9multiplier(this.sigma);
  }
  getMilestonePriority(): number[] {
    switch (this.strat) {
      case "T4C3d66": return [2];
      case "T4C3coast": return [2];
      case "T4C3": return [2];
      case "T4C3dC12rcv": return [1, 2];
      case "T4C356dC12rcv": return [1, 2, 0];
      case "T4C456dC12rcvMS": {
        if (this.maxRho < this.lastPub) return [1, 2, 0]
        else if (this.t % 100 < 50) return [2, 0, 1] 
        else return [0, 2, 1];
      }
      case "T4C123d": return [1, 2];
      case "T4C123": return [1, 2];
      case "T4C12d": return [1];
      case "T4C12": return [1];
      case "T4C56": return [0, 2];
      case "T4C4": {
        this.milestonesMax = [1, 0, 3];
        return [0, 2];
      }
      case "T4C5": {
        this.milestonesMax = [2, 0, 3];
        return [0, 2];
      }
      case "T4": return [0, 2, 1];
    }
  }
  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = 9;
    this.recursionValue = <number>data.recursionValue;
    this.q = 0;
    //initialize variables
    this.variables = [
      new Variable({ name: "c1", cost: new FirstFreeCost(new ExponentialCost(5, 1.305)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "c2", cost: new ExponentialCost(20, 3.75), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c3", cost: new ExponentialCost(2000, 2.468), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c4", cost: new ExponentialCost(1e4, 4.85), valueScaling: new ExponentialValue(3) }),
      new Variable({ name: "c5", cost: new ExponentialCost(1e8, 12.5), valueScaling: new ExponentialValue(5) }),
      new Variable({ name: "c6", cost: new ExponentialCost(1e10, 58), valueScaling: new ExponentialValue(10) }),
      new Variable({ name: "q1", cost: new ExponentialCost(1e3, 100), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "q2", cost: new ExponentialCost(1e4, 1000), valueScaling: new ExponentialValue(2) }),
    ];
    //milestones  [terms, c1exp, multQdot]
    this.milestonesMax = [3, 1, 3];
    this.milestoneUnlockSteps = 25;
    this.updateMilestones();
  }
  async simulate(data: theoryData) {
    if ((this.recursionValue === null || this.recursionValue === undefined) && ["T4C3d66", "T4C3coast"].includes(this.strat)) {
      data.recursionValue = Number.MAX_VALUE;
      const tempSim = await new t4Sim(data).simulate(data);
      this.recursionValue = tempSim.rawData.pubRho;
    }
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 176) this.updateMilestones();
      this.buyVariables();
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    const result = createResult(this, ["T4C3d66", "T4C3coast"].includes(this.strat) ? ` q1:${getLastLevel("q1", this.boughtVars)} q2:${getLastLevel("q2", this.boughtVars)}` : "");

    return result;
  }
  tick() {
    const vq1 = this.variables[6].value;
    const vq2 = this.variables[7].value;

    const p = add(this.q, 0) * 2
    this.q = subtract(add(p, l10(2) * (1 + this.milestones[2]) + vq1 + vq2 + l10(this.dt)) / 2, 0)

    const vc1 = this.variables[0].value * (1 + 0.15 * this.milestones[1]);
    const vc2 = this.variables[1].value;
    let variableSum = vc1 + vc2;
    variableSum = add(variableSum, this.variables[2].value + this.q);
    if (this.milestones[0] >= 1) variableSum = add(variableSum, this.variables[3].value + this.q * 2);
    if (this.milestones[0] >= 2) variableSum = add(variableSum, this.variables[4].value + this.q * 3);
    if (this.milestones[0] >= 3) variableSum = add(variableSum, this.variables[5].value + this.q * 4);

    const rhodot = this.totMult + variableSum;
    this.rho.add(rhodot + l10(this.dt));
  }
}
