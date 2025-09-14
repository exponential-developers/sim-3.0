import { global } from "../../Sim/main.js";
import { add, binaryInsertionSearch, createResult, l10, subtract } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import theoryClass from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';

export default async function fi(data: theoryData): Promise<simResult> {
  const sim = new fiSim(data);
  const res = await sim.simulate();
  return res;
}

const factoriallogs = [0];
for (let i = 1; i < 9; i++) {
  factoriallogs.push(l10(i) + factoriallogs[i-1]);
}

type theory = "FI";

class fiSim extends theoryClass<theory> {
  q: number;
  r: number;
  tval: number;

  maxFx: number;
  maxLambda: number;

  msstate: number;
  msq: number;

  getBuyingConditions() {
    let activeStrat = [
      true, //tdot - 0
      //q1 mod 23
      () => this.variables[1].cost + l10((this.variables[1].level % 23) + 1) < this.variables[2].cost, //q1 - 1
      true, //q2 - 2
      true, //k - 3
      true, //m - 4
      //n mod 11 - 5
      () => this.variables[5].cost + l10((this.variables[5].level % 11) + 1) < this.variables[4].cost //n - 5
    ]
    let activeStrat2 = [
      true, //tdot - 0
      //q1 mod 23
      () => this.variables[1].cost + l10((this.variables[1].level % 23) + 1) < Math.min(this.variables[2].cost, this.variables[3].cost), //q1 - 1
      true, //q2 - 2
      true, //k - 3
      true, //m - 4
      //n mod 11 - 5
      () => this.variables[5].cost + l10((this.variables[5].level % 11) + 1) < Math.min(this.variables[2].cost, this.variables[3].cost, this.variables[4].cost) //n - 5
    ]
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      FI: new Array(6).fill(true),
      // ["tdot", "q1", "q2", "k", "m", "n"]
      FId: activeStrat2,
      FIPermaSwap: new Array(6).fill(true),
      FIdPermaSwap: activeStrat2,
      FIMS: new Array(6).fill(true),
      // ["tdot", "q1", "q2", "k", "m", "n"]
      FIMSd: activeStrat2,
      FIMSPermaSwap: new Array(6).fill(true),
      FIMSdPermaSwap: activeStrat2
    };
    return conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
  }
  getVariableAvailability() {
    const conditions: Array<conditionFunction> = [
      () => this.variables[0].level < 4,
      () => true,
      () => true,
      () => this.milestones[1] > 0,
      () => this.milestones[3] > 0,
      () => this.milestones[4] > 0,
    ];
    return conditions;
  }

  getTotMult(val: number) {
    return Math.max(0, val * this.tauFactor * 0.1625);
  }
  getMilestonePriority(): number[] {
    const rho = Math.max(this.maxRho, this.lastPub);
    const total_points = binaryInsertionSearch(this.milestoneUnlocks, rho);

    let available_fx = binaryInsertionSearch([100, 450, 1050], rho);
    const avaliable_lambda = binaryInsertionSearch([350, 750], rho);
    const use_fx_level3 = this.strat.includes("PermaSwap") ? this.maxRho >= 1076 : rho >= 1150;
    if (!use_fx_level3) available_fx = Math.min(available_fx, 2);
    this.milestonesMax = [1, 1, 3, 1, 1, available_fx, avaliable_lambda];

    const q1mn_points = total_points - (2 + available_fx + avaliable_lambda);
    const q1m23 = this.variables[1].level % 23;
    const qf = q1m23 < 5 ? 4 : q1m23 < 10 ? 3 : q1m23 < 20 ? 2.5 : 2;
    const qpriority = [0, 1, 5, 6, 2, 3, 4];
    const rhopriority = [0, 1, 5, 6, 3, 4, 2];
    if (this.strat.includes("MS") && q1mn_points > 0 && q1mn_points < 5 && this.msstate > 0) {
      if (this.msstate == 1) // start q build
      {
        this.msstate = 2;
        this.msq = this.q;
        return qpriority;
      }
      else if (this.msstate == 2 && this.msq + l10(qf) < this.q) // end q build
      {
        this.msstate = 0;
        return rhopriority;
      }
      else { // continue q build
        return qpriority;
      }
    }
    return rhopriority;
  }
  updateMilestones(): void {
    super.updateMilestones();
    const fx = this.milestones[5];
    const lambda = this.milestones[6];
    if (fx > this.maxFx) {
      if (fx === 1) {
        this.variables[2].data.cost = new ExponentialCost(1e7, 3e3);
        this.variables[2].reset();
        this.q = 0;
      } else if (fx === 2) {
        this.variables[2].data.cost = new ExponentialCost(1e-10, 2.27e3);
        this.variables[2].reset();
        this.q = 0;
      } else if (fx === 3) {
        this.variables[2].data.cost = new ExponentialCost(1e95, 1.08e3);
        this.variables[2].reset();
        this.q = 0;
        this.msq = 0;
      }
      this.maxFx = fx;
    }
    if (lambda > this.maxLambda) {
      if (lambda === 1) {
        this.variables[3].data.cost = new ExponentialCost(1e-5, 37);
        this.variables[3].reset();
      } else if (lambda === 2) {
        this.variables[3].data.cost = new ExponentialCost(1e-10, 95);
        this.variables[3].reset();
      }
      this.maxLambda = lambda;
    }
  }

  fact(num: number) {
    if (num >= factoriallogs.length) {
      throw "Error in fact().";
    }
    return factoriallogs[num];
  }
  norm_int(limit: number): number {
    switch (this.milestones[5]) {
      case 0:
        return this.approxCos(limit);
      case 1:
        return this.approxSin(limit);
      case 2:
        return this.approxL10(limit);
      case 3:
        return this.approxEX(limit);
      default:
        throw "Error in norm_int().";
    }
  }

  approx(k_v: number, base: number) {
    return -this.norm_int(l10(Math.PI)) - 1 / (Math.E + 1.519) + k_v * l10(base);
  }

  approxEX(limit: number) {
    return add(
      add(
        add(add(add(limit * 6 - this.fact(6), limit * 5 - this.fact(5)), limit * 4 - this.fact(4)), limit * 3 - this.fact(3)),
        limit * 2 - this.fact(2)
      ),
      limit
    );
  }

  approxSin(limit: number) {
    let positives = add(limit * 2 - this.fact(2), limit * 6 - this.fact(6));
    let negatives = limit * 4 - this.fact(4);
    return subtract(positives, negatives);
  }

  approxCos(limit: number) {
    let positives = add(limit, limit * 5 - this.fact(5));
    let negatives = limit * 3 - this.fact(3);
    return subtract(positives, negatives);
  }

  approxL10(limit: number) {
    let positives = add(limit * 2 - l10(2), add(limit * 4 - l10(12), limit * 6 - l10(30)));
    let negatives = add(limit * 3 - l10(6), limit * 5 - l10(20));
    return subtract(positives, negatives) - l10(Math.log(10));
  }

  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = 8;
    this.milestoneUnlocks = [10, 20, 30, 70, 210, 300, 425, 530, 700, 800, 950, 1150];
    this.q = 0;
    this.r = 0;
    this.tval = 0;

    this.maxFx = 0;
    this.maxLambda = 0;

    this.msstate = 0;
    this.msq = 0;

    //initialize variables
    this.variables = [
      new Variable({ name: "tdot", cost: new ExponentialCost(1e25, 1e50), valueScaling: new ExponentialValue(10) }),
      new Variable({ name: "q1",   cost: new FirstFreeCost(new ExponentialCost(5, 14.6)), valueScaling: new StepwisePowerSumValue(50, 23) }),
      new Variable({ name: "q2",   cost: new ExponentialCost(1e7, 5e3), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "K",    cost: new ExponentialCost(1e2, 10), valueScaling: new ExponentialValue(10) }),
      new Variable({ name: "m",    cost: new ExponentialCost(1e4, 4.44), valueScaling: new ExponentialValue(1.5) }),
      new Variable({ name: "n",    cost: new ExponentialCost(1e69, 11), valueScaling: new StepwisePowerSumValue(3, 11) }),
    ];
    this.variables[5].buy();
    this.updateMilestones();
  }
  async simulate() {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      this.updateMilestones();
      this.buyVariables();
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    const result = createResult(this, "");

    return result;
  }
  tick() {
    let vq1 = this.variables[1].value * (1 + 0.01 * this.milestones[2]);
    let vden = this.approx(this.variables[3].value, 2 + this.milestones[6]);

    this.tval += ((this.variables[0].value + 1) / 5) * this.dt;
    this.q = add(this.q, vq1 + this.variables[2].value + l10(this.dt));
    this.r = add(this.r, vden + l10(this.dt));

    const integral = (this.milestones[0] 
      ? this.norm_int(this.q - (this.milestones[5] < 3 ? l10(Math.PI) : 0)) 
      : this.q - l10(Math.PI)) 
      * (1 / Math.PI);
    const vm = this.milestones[3] ? this.variables[4].value : 0;
    const vn = this.milestones[4] ? this.variables[5].value : 0;

    let rhodot = l10(this.tval) + integral + this.r + vm + vn;

    this.rho.add(this.totMult + rhodot + l10(this.dt));
  }
  onVariablePurchased(id: number): void {
    if (id == 2 && this.msstate == 0) this.msstate = 1;
  }
}
