import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, logToExp, getR9multiplier } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import theoryClass from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';

export default async function t6(data: theoryData): Promise<simResult> {
  const sim = new t6Sim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "T6";

class t6Sim extends theoryClass<theory> {
  q: number;
  r: number;
  k: number;
  stopC12: [number, number, boolean];

  getBuyingConditions() {
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      T6: [true, true, true, true, true, true, true, true, true],
      T6C3: [true, true, true, true, () => this.variables[6].level == 0, () => this.variables[6].level == 0, true, false, false],
      T6C4: [true, true, true, true, false, false, false, true, false],
      T6C125: [true, true, true, true, true, true, false, false, true],
      T6C12: [true, true, true, true, true, true, false, false, false],
      T6C5: [true, true, true, true, false, false, false, false, true],
      T6Snax: [true, true, true, true, () => this.stopC12[2], () => this.stopC12[2], false, false, true],
      T6C3d: [
        () => this.variables[0].cost + l10(3) < Math.min(this.variables[1].cost, this.milestones[0] > 0 ? this.variables[3].cost : Infinity, this.variables[6].cost),
        true,
        () => this.variables[2].cost + l10(3) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[6].cost),
        true,
        () => this.variables[6].level == 0 && this.variables[4].cost + l10(3) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[6].cost),
        () => this.variables[6].level == 0,
        true,
        false,
        false,
      ],
      T6C4d: [
        () => this.variables[0].cost + l10(5) < Math.min(this.variables[1].cost, this.milestones[0] > 0 ? this.variables[3].cost : Infinity, this.variables[7].cost),
        true,
        () => this.variables[2].cost + l10(5) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[7].cost),
        true,
        false,
        false,
        false,
        true,
        false,
      ],
      T6C125d: [
        () => this.variables[0].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity),
        true,
        () => this.variables[2].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity),
        true,
        () => this.variables[4].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity),
        true,
        false,
        false,
        true,
      ],
      T6C12d: [
        () => this.variables[0].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost),
        true,
        () => this.variables[2].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost),
        true,
        () => this.variables[4].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost),
        true,
        false,
        false,
        false,
      ],
      T6C5d: [
        () => this.variables[0].cost + l10(7 + (this.variables[0].level % 10)) < Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity),
        true,
        () => this.variables[2].cost + l10(5) < Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity),
        true,
        false,
        false,
        false,
        false,
        true,
      ],
      T6C5dIdleRecovery: [
        () => {
          if (this.lastPub >= this.maxRho) {
            return true;
          }
          return this.variables[0].cost + l10(7 + (this.variables[0].level % 10)) < Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity)
        },
        true,
        () => {
          if (this.lastPub >= this.maxRho) {
            return true;
          }
          return this.variables[2].cost + l10(5) < Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity)
        },
        true,
        false,
        false,
        false,
        false,
        true,
      ],
      T6AI: [],
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getVariableAvailability() {
    const conditions: Array<conditionFunction> = [
      () => true,
      () => true,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 0,
      () => true,
      () => true,
      () => true,
      () => true,
      () => this.milestones[2] > 0,
    ];
    return conditions;
  }
  getMilestoneTree() {
    const c4Route = [
      [0, 0, 0, 0],
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [1, 1, 1, 0],
      [1, 1, 1, 1],
      [1, 1, 1, 2],
      [1, 1, 1, 3],
    ];
    const globalOptimalRoute = [
      [0, 0, 0, 0],
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [1, 1, 1, 0],
      [1, 0, 0, 3],
      [1, 0, 1, 3],
      [1, 1, 1, 3],
    ];
    const tree: { [key in stratType[theory]]: Array<Array<number>> } = {
      T6: globalOptimalRoute,
      T6C3: globalOptimalRoute,
      T6C4: c4Route,
      T6C125: globalOptimalRoute,
      T6C12: globalOptimalRoute,
      T6C5: globalOptimalRoute,
      T6Snax: globalOptimalRoute,
      T6C3d: globalOptimalRoute,
      T6C4d: c4Route,
      T6C125d: globalOptimalRoute,
      T6C12d: globalOptimalRoute,
      T6C5d: globalOptimalRoute,
      T6AI: globalOptimalRoute,
      T6C5dIdleRecovery: globalOptimalRoute,
    };
    return tree[this.strat];
  }

  getTotMult(val: number) {
    return Math.max(0, val * 0.196 - l10(50)) + getR9multiplier(this.sigma);
  }
  updateMilestones(): void {
    const stage = Math.min(6, Math.floor(Math.max(this.lastPub, this.maxRho) / 25));
    this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
  }
  calculateIntegral(vc1: number, vc2: number, vc3: number, vc4: number, vc5: number) {
    const term1 = vc1 + vc2 + this.q + this.r;
    const term2 = vc3 + this.q * 2 + this.r - l10(2);
    const term3 = this.milestones[1] > 0 ? vc4 + this.q * 3 + this.r - l10(3) : -Infinity;
    const term4 = this.milestones[2] > 0 ? vc5 + this.q + this.r * 2 - l10(2) : -Infinity;
    this.k = term4 - term1;
    return this.totMult + add(term1, add(term2, add(term3, term4)));
  }
  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = 12;
    this.q = -Infinity;
    this.r = 0;
    //initialize variables
    this.variables = [
      new Variable({ name: "q1", cost: new FirstFreeCost(new ExponentialCost(15, 3)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "q2", cost: new ExponentialCost(500, 100), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "r1", cost: new ExponentialCost(1e25, 1e5), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "r2", cost: new ExponentialCost(1e30, 1e10), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c1", cost: new ExponentialCost(10, 2), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ name: "c2", cost: new ExponentialCost(100, 5), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c3", cost: new ExponentialCost(1e7, 1.255), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "c4", cost: new ExponentialCost(1e25, 5e5), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c5", cost: new ExponentialCost(15, 3.9), valueScaling: new ExponentialValue(2) }),
    ];
    this.k = 0;
    this.stopC12 = [0, 0, true];
    this.milestoneTree = this.getMilestoneTree();
    this.updateMilestones();
  }
  async simulate() {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 150) this.updateMilestones();
      this.buyVariables();
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    const result = createResult(this, this.strat === "T6Snax" ? " " + logToExp(this.stopC12[0], 1) : "");

    return result;
  }
  tick() {
    const vc1 = this.variables[4].value * (1 + 0.05 * this.milestones[3]);

    let C = subtract(this.calculateIntegral(vc1, this.variables[5].value, this.variables[6].value, this.variables[7].value, this.variables[8].value), this.rho.value);

    this.q = add(this.q, this.variables[0].value + this.variables[1].value + l10(this.dt));

    this.r = this.milestones[0] > 0 ? add(this.r, this.variables[2].value + this.variables[3].value + l10(this.dt) - 3) : 0;

    const newCurrency = this.calculateIntegral(vc1, this.variables[5].value, this.variables[6].value, this.variables[7].value, this.variables[8].value);
    C = C > newCurrency ? newCurrency : C;
    this.rho.value = Math.max(0, subtract(newCurrency, C));

    if (this.k > 0.3) this.stopC12[1]++;
    else this.stopC12[1] = 0;

    if (this.stopC12[1] > 30 && this.stopC12[2]) {
      this.stopC12[0] = this.maxRho;
      this.stopC12[2] = false;
    }
  }
  buyVariables() {
    if (this.strat !== "T6AI") super.buyVariables();
    else {
      while (true) {
        const rawCost = this.variables.map((item) => item.cost);
        const weights = [
          l10(7 + (this.variables[0].level % 10)), //q1
          0, //q2
          l10(5 + (this.variables[2].level % 10)), //r1
          0, //r2
          Math.max(0, this.k) + l10(8 + (this.variables[4].level % 10)), //c1
          Math.max(0, this.k), //c2
          Infinity, //c3
          Infinity, //c4
          -Math.min(0, this.k), //c5
        ];
        let minCost = [Number.MAX_VALUE, -1];
        for (let i = this.variables.length - 1; i >= 0; i--)
          if (rawCost[i] + weights[i] < minCost[0] && this.variableAvailability[i]()) {
            minCost = [rawCost[i] + weights[i], i];
          }
        if (minCost[1] !== -1 && rawCost[minCost[1]] < this.rho.value) {
          this.rho.subtract(this.variables[minCost[1]].cost);
          if (this.maxRho + 5 > this.lastPub) {
            this.boughtVars.push({ variable: this.variables[minCost[1]].name, level: this.variables[minCost[1]].level + 1, cost: this.variables[minCost[1]].cost, timeStamp: this.t });
          }
          this.variables[minCost[1]].buy();
        } else break;
      }
    }
  }
}
