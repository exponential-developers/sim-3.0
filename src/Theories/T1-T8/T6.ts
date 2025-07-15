import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, logToExp, sleep } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';

export default async function t6(data: theoryData): Promise<simResult> {
  const sim = new t6Sim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "T6";

class t6Sim extends theoryClass<theory> implements specificTheoryProps {
  rho: number;
  q: number;
  r: number;
  k: number;
  stopC12: [number, number, boolean];

  getBuyingConditions() {
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      T6: [true, true, true, true, true, true, true, true, true],
      T6C3: [true, true, true, true, false, false, true, false, false],
      T6C4: [true, true, true, true, false, false, false, true, false],
      T6noC34: [true, true, true, true, true, true, false, false, true],
      T6noC345: [true, true, true, true, true, true, false, false, false],
      T6noC1234: [true, true, true, true, false, false, false, false, true],
      T6Snax: [true, true, true, true, () => this.stopC12[2], () => this.stopC12[2], false, false, true],
      T6C3d: [
        () => this.variables[0].cost + l10(3) < Math.min(this.variables[1].cost, this.milestones[0] > 0 ? this.variables[3].cost : Infinity, this.variables[6].cost),
        true,
        () => this.variables[2].cost + l10(3) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[6].cost),
        true,
        false,
        false,
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
      T6noC34d: [
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
      T6noC345d: [
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
      T6noC1234d: [
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
      T6noC1234dIdleRecovery: [
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
  getMilestoneConditions() {
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
      T6C4: globalOptimalRoute,
      T6noC34: globalOptimalRoute,
      T6noC345: globalOptimalRoute,
      T6noC1234: globalOptimalRoute,
      T6Snax: globalOptimalRoute,
      T6C3d: globalOptimalRoute,
      T6C4d: globalOptimalRoute,
      T6noC34d: globalOptimalRoute,
      T6noC345d: globalOptimalRoute,
      T6noC1234d: globalOptimalRoute,
      T6AI: globalOptimalRoute,
      T6noC1234dIdleRecovery: globalOptimalRoute,
    };
    return tree[this.strat];
  }

  getTotMult(val: number) {
    return Math.max(0, val * 0.196) - l10(50) + l10((this.sigma / 20) ** (this.sigma < 65 ? 0 : this.sigma < 75 ? 1 : this.sigma < 85 ? 2 : 3));
  }
  updateMilestones(): void {
    const stage = Math.min(6, Math.floor(Math.max(this.lastPub, this.maxRho) / 25));
    this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
  }
  calculateIntegral(vc1: number, vc2: number, vc3: number, vc4: number, vc5: number) {
    const term1 = vc1 + vc2 + this.q + this.r;
    const term2 = vc3 + this.q * 2 + this.r - l10(2);
    const term3 = this.milestones[1] > 0 ? vc4 + this.q * 3 + this.r - l10(3) : 0;
    const term4 = this.milestones[2] > 0 ? vc5 + this.q + this.r * 2 - l10(2) : 0;
    this.k = term4 - term1;
    return this.totMult + add(term1, add(term2, add(term3, term4)));
  }
  constructor(data: theoryData) {
    super(data);
    this.totMult = this.getTotMult(data.rho);
    this.rho = 0;
    this.q = 0;
    this.r = 0;
    //initialize variables
    this.varNames = ["q1", "q2", "r1", "r2", "c1", "c2", "c3", "c4", "c5"];
    this.variables = [
      new Variable({ cost: new FirstFreeCost(new ExponentialCost(15, 3)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(500, 100), valueScaling: new ExponentialValue(2) }),
      new Variable({ cost: new ExponentialCost(1e25, 1e5), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(1e30, 1e10), valueScaling: new ExponentialValue(2) }),
      new Variable({ cost: new ExponentialCost(10, 2), value: 1, valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(100, 5), valueScaling: new ExponentialValue(2) }),
      new Variable({ cost: new ExponentialCost(1e7, 1.255), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(1e25, 5e5), valueScaling: new ExponentialValue(2) }),
      new Variable({ cost: new ExponentialCost(15, 3.9), valueScaling: new ExponentialValue(2) }),
    ];
    this.k = 0;
    this.stopC12 = [0, 0, true];
    this.conditions = this.getBuyingConditions();
    this.milestoneConditions = this.getMilestoneConditions();
    this.milestoneTree = this.getMilestoneTree();
    this.updateMilestones();
  }
  async simulate() {
    let pubCondition = false;
    while (!pubCondition) {
      if (!global.simulating) break;
      if ((this.ticks + 1) % 500000 === 0) await sleep();
      this.tick();
      if (this.rho > this.maxRho) this.maxRho = this.rho;
      if (this.lastPub < 150) this.updateMilestones();
      this.curMult = 10 ** (this.getTotMult(this.maxRho) - this.totMult);
      this.buyVariables();
      pubCondition = (global.forcedPubTime !== Infinity ? this.t > global.forcedPubTime : this.t > this.pubT * 2 || this.pubRho > this.cap[0]) && this.pubRho > 12;
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    const result = createResult(this, this.strat === "T6Snax" ? " " + logToExp(this.stopC12[0], 1) : "");

    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    global.varBuy.push([result[7], this.boughtVars]);

    return result;
  }
  tick() {
    const vc1 = this.variables[4].value * (1 + 0.05 * this.milestones[3]);

    let C = subtract(this.calculateIntegral(vc1, this.variables[5].value, this.variables[6].value, this.variables[7].value, this.variables[8].value), this.rho);

    this.q = add(this.q, this.variables[0].value + this.variables[1].value + l10(this.dt));

    this.r = this.milestones[0] > 0 ? add(this.r, this.variables[2].value + this.variables[3].value + l10(this.dt) - 3) : 0;

    const newCurrency = this.calculateIntegral(vc1, this.variables[5].value, this.variables[6].value, this.variables[7].value, this.variables[8].value);
    C = C > newCurrency ? newCurrency : C;
    this.rho = Math.max(0, subtract(newCurrency, C));

    if (this.k > 0.3) this.stopC12[1]++;
    else this.stopC12[1] = 0;

    if (this.stopC12[1] > 30 && this.stopC12[2]) {
      this.stopC12[0] = this.maxRho;
      this.stopC12[2] = false;
    }

    this.t += this.dt / 1.5;
    this.dt *= this.ddt;
    if (this.maxRho < this.recovery.value) this.recovery.time = this.t;

    this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
    if (this.maxTauH < this.tauH || this.maxRho >= this.cap[0] - this.cap[1] || this.pubRho < 12 || global.forcedPubTime !== Infinity) {
      this.maxTauH = this.tauH;
      this.pubT = this.t;
      this.pubRho = this.maxRho;
    }
  }
  buyVariables() {
    if (this.strat !== "T6AI")
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
          if (rawCost[i] + weights[i] < minCost[0] && this.milestoneConditions[i]()) {
            minCost = [rawCost[i] + weights[i], i];
          }
        if (minCost[1] !== -1 && rawCost[minCost[1]] < this.rho) {
          this.rho = subtract(this.rho, this.variables[minCost[1]].cost);
          if (this.maxRho + 5 > this.lastPub) {
            this.boughtVars.push({ variable: this.varNames[minCost[1]], level: this.variables[minCost[1]].level + 1, cost: this.variables[minCost[1]].cost, timeStamp: this.t });
          }
          this.variables[minCost[1]].buy();
        } else break;
      }
    }
  }
}
