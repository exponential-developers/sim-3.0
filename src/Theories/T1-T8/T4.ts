import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep, getLastLevel, getR9multiplier } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';

export default async function t4(data: theoryData): Promise<simResult> {
  const sim = new t4Sim(data);
  const res = await sim.simulate(data);
  return res;
}

type theory = "T4";

class t4Sim extends theoryClass<theory> implements specificTheoryProps {
  recursionValue: number;
  rho: number;
  q: number;
  variableSum: number;

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
  getMilestoneConditions() {
    const conditions: Array<conditionFunction> = [() => true, () => true, () => true, () => this.milestones[0] > 0, () => this.milestones[0] > 1, () => this.milestones[0] > 2, () => true, () => true];
    return conditions;
  }
  getMilestoneTree() {
    const tree: { [key in stratType[theory]]: Array<Array<number>> } = {
      T4C3d66: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 0, 2],
        [0, 0, 3],
      ],
      T4C3coast: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 0, 2],
        [0, 0, 3],
      ],
      T4C3: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 0, 2],
        [0, 0, 3],
      ],
      T4C3dC12rcv: [
        [0, 0, 0],
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 2],
        [0, 1, 3]
      ],
      T4C356dC12rcv: [
        [0, 0, 0],
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 2],
        [0, 1, 3],
        [1, 1, 3],
        [2, 1, 3],
        [3, 1, 3],
      ],
      T4C456dC12rcvMS: [[0, 0, 0]],
      T4C123d: [
        [0, 0, 0],
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 2],
        [0, 1, 3],
      ],
      T4C123: [
        [0, 0, 0],
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 2],
        [0, 1, 3],
      ],
      T4C12d: [
        [0, 0, 0],
        [0, 1, 0],
      ],
      T4C12: [
        [0, 0, 0],
        [0, 1, 0],
      ],
      T4C56: [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
        [3, 0, 0],
        [3, 0, 1],
        [3, 0, 2],
        [3, 0, 3],
        [3, 0, 3],
      ],
      T4C4: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [1, 0, 2],
        [1, 0, 3],
      ],
      T4C5: [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
        [2, 0, 1],
        [2, 0, 2],
        [2, 0, 3],
      ],
      T4: [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
        [3, 0, 0],
        [3, 0, 1],
        [3, 0, 2],
        [3, 0, 3],
        [3, 1, 3],
      ],
    };
    return tree[this.strat];
  }
  getTotMult(val: number) {
    return Math.max(0, val * 0.165 - l10(4)) + getR9multiplier(this.sigma);
  }
  updateMilestones(): void {
    const stage = Math.min(7, Math.floor(Math.max(this.lastPub, this.maxRho) / 25));
    this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];

    if (this.strat === "T4C456dC12rcvMS") {
      const max = [3, 1, 3];
      this.milestones = [0, 0, 0];

      let priority;
      if (this.maxRho < this.lastPub) {
        priority = [2, 3, 1];
      } else if (this.t % 100 < 50) {
        priority = [3, 1, 2];
      } else {
        priority = [1, 3, 2];
      }

      let milestoneCount = stage;
      this.milestones = [0, 0, 0];
      for (let i = 0; i < priority.length; i++) {
        while (this.milestones[priority[i] - 1] < max[priority[i] - 1] && milestoneCount > 0) {
          this.milestones[priority[i] - 1]++;
          milestoneCount--;
        }
      }
    }
  }
  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = 9;
    this.totMult = this.getTotMult(data.rho);
    this.recursionValue = <number>data.recursionValue;
    this.rho = 0;
    this.q = 0;
    this.curMult = 0;
    //initialize variables
    this.variables = [
      new Variable({ cost: new FirstFreeCost(new ExponentialCost(5, 1.305)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(20, 3.75), valueScaling: new ExponentialValue(2) }),
      new Variable({ cost: new ExponentialCost(2000, 2.468), valueScaling: new ExponentialValue(2) }),
      new Variable({ cost: new ExponentialCost(1e4, 4.85), valueScaling: new ExponentialValue(3) }),
      new Variable({ cost: new ExponentialCost(1e8, 12.5), valueScaling: new ExponentialValue(5) }),
      new Variable({ cost: new ExponentialCost(1e10, 58), valueScaling: new ExponentialValue(10) }),
      new Variable({ cost: new ExponentialCost(1e3, 100), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(1e4, 1000), valueScaling: new ExponentialValue(2) }),
    ];
    this.variableSum = 0;
    this.varNames = ["c1", "c2", "c3", "c4", "c5", "c6", "q1", "q2"];
    //milestones  [terms, c1exp, multQdot]
    this.milestones = [0, 0, 0];
    this.conditions = this.getBuyingConditions();
    this.milestoneConditions = this.getMilestoneConditions();
    this.milestoneTree = this.getMilestoneTree();
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
      if ((this.ticks + 1) % 500000 === 0) await sleep();
      this.tick();
      if (this.rho > this.maxRho) this.maxRho = this.rho;
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
    this.variableSum = vc1 + vc2;
    this.variableSum = add(this.variableSum, this.variables[2].value + this.q);
    if (this.milestones[0] >= 1) this.variableSum = add(this.variableSum, this.variables[3].value + this.q * 2);
    if (this.milestones[0] >= 2) this.variableSum = add(this.variableSum, this.variables[4].value + this.q * 3);
    if (this.milestones[0] >= 3) this.variableSum = add(this.variableSum, this.variables[5].value + this.q * 4);

    const rhodot = this.totMult + this.variableSum;
    this.rho = add(this.rho, rhodot + l10(this.dt));
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
        } else break;
      }
  }
}
