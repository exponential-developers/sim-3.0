import { global } from "../../Sim/main.js";
import { add_old, createResult, l10, subtract_old, getR9multiplier } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import theoryClass from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';
import Currency from "../../Utils/currency.js";

export default async function t7(data: theoryData): Promise<simResult> {
  const sim = new t7Sim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "T7";

const add = add_old;
const subtract = subtract_old;

class t7Sim extends theoryClass<theory> {
  rho2: Currency;
  drho13: number;
  drho23: number;
  c2ratio: number;

  getBuyingConditions() {
    if (this.lastPub >= 100) this.c2ratio = 100;
    if (this.lastPub >= 175) this.c2ratio = 10;
    if (this.lastPub >= 250) this.c2ratio = 20;
    if (this.lastPub >= 275) this.c2ratio = 50;
    if (this.lastPub >= 300) this.c2ratio = Infinity;
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      T7: [true, true, true, true, true, true, true],
      T7C12: [true, true, true, false, false, false, false],
      T7C3: [true, false, false, true, false, false, false],
      T7noC12: [true, false, false, true, true, true, true],
      T7noC123: [true, false, false, false, true, true, true],
      T7noC1234: [true, false, false, false, false, true, true],
      T7C12d: [() => this.variables[0].cost + 1 < this.variables[2].cost, () => this.variables[1].cost + l10(8) < this.variables[2].cost, true, false, false, false, false],
      T7C3d: [() => this.variables[0].cost + 1 < this.variables[3].cost, false, false, true, false, false, false],
      T7PlaySpqcey: [
        () => this.variables[0].cost + l10(4) < this.variables[6].cost,
        () => this.variables[1].cost + l10(10 + this.variables[2].level) < this.variables[2].cost,
        () => this.variables[2].cost + l10(this.c2ratio) < this.variables[6].cost,
        () => this.variables[3].cost + 1 < this.variables[6].cost,
        () => this.variables[4].cost + 1 < this.variables[6].cost,
        () => this.variables[5].cost + l10(4) < this.variables[6].cost,
        true,
      ],
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getVariableAvailability() {
    const conditions: Array<conditionFunction> = [
      () => true,
      () => true,
      () => true,
      () => this.milestones[1] > 0,
      () => this.milestones[0] > 0,
      () => this.milestones[2] > 0,
      () => this.milestones[3] > 0,
    ];
    return conditions;
  }
  getMilestoneTree() {
    const tree: { [key in stratType[theory]]: Array<Array<number>> } = {
      T7: [
        [0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 2],
        [1, 1, 1, 1, 3],
      ],
      T7C12: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1],
        [0, 0, 0, 0, 2],
        [0, 0, 0, 0, 3],
      ],
      T7C3: [
        [0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
      ],
      T7noC12: [
        [0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 1, 0],
      ],
      T7noC123: [
        [0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 1, 0, 0],
        [1, 0, 1, 1, 0],
      ],
      T7noC1234: [
        [0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 1, 0, 0],
        [1, 0, 1, 1, 0],
      ],
      T7C12d: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1],
        [0, 0, 0, 0, 2],
        [0, 0, 0, 0, 3],
      ],
      T7C3d: [
        [0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
      ],
      T7PlaySpqcey: [
        [0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 2],
        [1, 1, 1, 1, 3],
      ],
    };
    return tree[this.strat];
  }

  getTotMult(val: number) {
    return Math.max(0, val * 0.152) + getR9multiplier(this.sigma);
  }
  updateMilestones(): void {
    const stage = Math.min(7, Math.floor(Math.max(this.lastPub, this.maxRho) / 25));
    this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
  }
  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = 10;
    this.rho2 = new Currency;
    //initialize variables
    this.variables = [
      new Variable({ name: "q1", cost: new FirstFreeCost(new ExponentialCost(500, 1.51572)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "c1", cost: new ExponentialCost(10, 1.275), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ name: "c2", cost: new ExponentialCost(40, 8), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c3", cost: new ExponentialCost(1e5, 63), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c4", cost: new ExponentialCost(10, 2.82), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c5", cost: new ExponentialCost(1e8, 60), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c6", cost: new ExponentialCost(1e2, 2.81), valueScaling: new ExponentialValue(2) }),
    ];
    this.drho13 = 0;
    this.drho23 = 0;
    this.c2ratio = Infinity;
    this.buyingConditions = this.getBuyingConditions();
    this.variableAvailability = this.getVariableAvailability();
    this.milestoneTree = this.getMilestoneTree();
    this.updateMilestones();
  }
  async simulate() {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 175) this.updateMilestones();
      this.buyVariables();
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    const result = createResult(this, this.strat === "T7PlaySpqcey" && this.c2ratio !== Infinity ? this.c2ratio.toString() : "");

    return result;
  }
  tick() {
    const vc1 = this.variables[1].value * (1 + 0.05 * this.milestones[4]);
    const rho = Math.max(this.rho.value, 0);
    const rho2 = Math.max(this.rho2.value, 0);

    const drho11 = vc1 + this.variables[2].value;
    const drho12 = this.milestones[1] > 0 ? l10(1.5) + this.variables[3].value + rho / 2 : 0;
    const drho21 = this.milestones[0] > 0 ? this.variables[4].value : 0;
    const drho22 = this.milestones[2] > 0 ? l10(1.5) + this.variables[5].value + rho2 / 2 : 0;
    this.drho13 = this.milestones[3] > 0 ? Math.min(this.drho13 + 2, Math.min(l10(0.5) + this.variables[6].value + rho2 / 2 - rho / 2, rho + 2)) : 0;
    this.drho23 = this.milestones[3] > 0 ? Math.min(this.drho23 + 2, Math.min(l10(0.5) + this.variables[6].value + rho / 2 - rho2 / 2, rho2 + 2)) : 0;
    const dtq1bonus = l10(this.dt) + this.variables[0].value + this.totMult;

    this.rho.add(dtq1bonus + add(add(drho11, drho12), this.drho13));
    this.rho2.add(dtq1bonus + add(add(drho21, drho22), this.drho23));
  }
}
