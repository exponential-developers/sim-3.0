import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';

export default async function fi(data: theoryData): Promise<simResult> {
  const sim = new fiSim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "FI";

class fiSim extends theoryClass<theory> implements specificTheoryProps {
  pubUnlock: number;
  rho: number;
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
      () => this.variables[1].cost + Math.log10((this.variables[1].level % 23) + 1) < this.variables[2].cost, //q1 - 1
      true, //q2 - 2
      true, //k - 3
      true, //m - 4
      //n mod 11 - 5
      () => this.variables[5].cost + Math.log10((this.variables[5].level % 11) + 1) < this.variables[4].cost //n - 5
    ]
    let activeStrat2 = [
      true, //tdot - 0
      //q1 mod 23
      () => this.variables[1].cost + Math.log10((this.variables[1].level % 23) + 1) < Math.min(this.variables[2].cost, this.variables[3].cost), //q1 - 1
      true, //q2 - 2
      true, //k - 3
      true, //m - 4
      //n mod 11 - 5
      () => this.variables[5].cost + Math.log10((this.variables[5].level % 11) + 1) < Math.min(this.variables[2].cost, this.variables[3].cost, this.variables[4].cost) //n - 5
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
  getMilestoneConditions() {
    const conditions: Array<conditionFunction> = [
      () => this.variables[0].level < 4,
      () => true,
      () => true,
      () => Math.max(this.maxRho, this.lastPub) > 20,
      () => this.milestones[1] > 0,
      () => this.milestones[2] > 0,
    ];
    return conditions;
  }

  getTotMult(val: number) {
    return Math.max(0, val * this.tauFactor * 0.1625);
  }
  updateMilestones() {
    //q1 m n fx lambda
    let avaliable = [3, 1, 1, 0, 0];
    const unlock = [[Infinity], [Infinity], [Infinity], [100, 450, 1050], [350, 750]];
    const pointUnlocks = [30, 70, 210, 300, 425, 530, 700, 800, 950, 1150];
    //20 70 fx 210 300 lambda 425 fx 530 700 lambda 800 950 fx 1150

    const maxVal = Math.max(this.lastPub, this.maxRho);
    for (let i = 0; i < avaliable.length; i++) {
      for (let j = 0; j < unlock[i].length; j++) if (maxVal >= unlock[i][j]) avaliable[i]++;
    }
    let points = 0;
    for (let i = 0; i < pointUnlocks.length; i++) if (maxVal > pointUnlocks[i]) points++;

    let fx;

    if (this.strat.includes("PermaSwap")) {
      fx = Math.min(avaliable[3], points, maxVal > 1050 ? 3 : 2);
      if (this.maxRho < 1076 && fx == 3) {
        fx -= 1;
      }
    }
    else {
      fx = Math.min(avaliable[3], points, maxVal >= 1150 ? 3 : 2);
    }

    points -= fx;

    if(this.strat.includes("PermaSwap")) {
      // Swap back.
      if (this.maxFx === 3 && this.maxRho < 1074) {
        this.variables[2].data.cost = new ExponentialCost(1e-10, 2.27e3);
        this.variables[2].reset();
        this.q = 0;
        this.maxFx = fx;
      }
    }

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
        if(this.strat.includes("PermaSwap") || this.maxFx < 2) {
          this.variables[2].data.cost = new ExponentialCost(1e95, 1.08e3);
          this.variables[2].reset();
          this.q = 0;
        }
      }
      this.maxFx = fx;
    }

    let lambda_base = Math.min(avaliable[4], points);
    points -= lambda_base;

    if (lambda_base > this.maxLambda) {
      if (lambda_base === 1) {
        this.variables[3].data.cost = new ExponentialCost(1e-5, 37);
        this.variables[3].reset();
      } else if (lambda_base === 2) {
        this.variables[3].data.cost = new ExponentialCost(1e-10, 95);
        this.variables[3].reset();
      }
      this.maxLambda = lambda_base;
    }

    let qf, q1m23, q1exp, mterm, nterm;
    q1m23 = this.variables[1].level % 23;
    qf = q1m23 < 5 ? 4 : q1m23 < 10 ? 3 : q1m23 < 20 ? 2.5 : 2;

    if (this.strat.includes("MS") && points > 0 && points < 5 && this.msstate > 0)
    {
      if (this.msstate == 1) // start q build
      {
        q1exp = Math.min(avaliable[0], points);
        points -= q1exp;
        mterm = Math.min(avaliable[1], points);
        points -= mterm;
        nterm = Math.min(avaliable[2], points);
        points -= nterm;

        this.msstate = 2;
        this.msq = this.q;
      }
      else if (this.msstate == 2 && this.msq + l10(qf) < this.q) // end q build
      {
        mterm = Math.min(avaliable[1], points);
        points -= mterm;

        nterm = Math.min(avaliable[2], points);
        points -= nterm;

        q1exp = Math.min(avaliable[0], points);
        points -= q1exp;

        this.msstate = 0;
      }
      else { // continue q build
        q1exp = Math.min(avaliable[0], points);
        points -= q1exp;
        mterm = Math.min(avaliable[1], points);
        points -= mterm;
        nterm = Math.min(avaliable[2], points);
        points -= nterm;
      }
    }
    else // no MS
    {
      mterm = Math.min(avaliable[1], points);
      points -= mterm;

      nterm = Math.min(avaliable[2], points);
      points -= nterm;

      q1exp = Math.min(avaliable[0], points);
      points -= q1exp;
    }
    

    this.milestones = [q1exp, mterm, nterm, fx, lambda_base];
  }

  fact(num: number) {
    switch (num) {
      case 1:
        return 0;
      case 2:
        return l10(2);
      case 3:
        return Math.log10(6);
      case 4:
        return Math.log10(24);
      case 5:
        return Math.log10(120);
      case 6:
        return Math.log10(720);
      case 7:
        return Math.log10(5040);
      case 8:
        return Math.log10(40320);
      case 9:
        return Math.log10(362880);
      default:
        //todo: make this a global function later and convert to array
        throw "Error in fact().";
    }
  }
  norm_int(limit: number): number {
    switch (this.milestones[3]) {
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
    return -this.norm_int(Math.log10(Math.PI)) - 1 / (Math.E + 1.519) + k_v * Math.log10(base);
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
    let positives = add(limit * 2 - l10(2), add(limit * 4 - Math.log10(12), limit * 6 - Math.log10(30)));
    let negatives = add(limit * 3 - Math.log10(6), limit * 5 - Math.log10(20));
    return subtract(positives, negatives) - Math.log10(Math.log(10));
  }

  constructor(data: theoryData) {
    super(data);
    this.totMult = this.getTotMult(data.rho);
    this.pubUnlock = 8;
    this.rho = 0;
    this.q = 0;
    this.r = 0;
    this.tval = 0;

    this.maxFx = 0;
    this.maxLambda = 0;

    this.msstate = 0;
    this.msq = 0;

    //initialize variables
    this.varNames = ["tdot", "q1", "q2", "k", "m", "n"];
    this.variables = [
      new Variable({ cost: new ExponentialCost(1e25, 1e50), valueScaling: new ExponentialValue(10) }),
      new Variable({ cost: new FirstFreeCost(new ExponentialCost(5, 14.6)), valueScaling: new StepwisePowerSumValue(50, 23) }),
      new Variable({ cost: new ExponentialCost(1e7, 5e3), valueScaling: new ExponentialValue(2) }),
      new Variable({ cost: new ExponentialCost(1e2, 10), valueScaling: new ExponentialValue(10) }),
      new Variable({ cost: new ExponentialCost(1e4, 4.44), valueScaling: new ExponentialValue(1.5) }),
      new Variable({ cost: new ExponentialCost(1e69, 11), valueScaling: new StepwisePowerSumValue(3, 11) }),
    ];
    this.variables[5].buy();
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
      pubCondition =
        (global.forcedPubTime !== Infinity ? this.t > global.forcedPubTime : this.t > this.pubT * 2 || this.pubRho > this.cap[0]) &&
        this.pubRho > this.pubUnlock;
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    const result = createResult(this, "");

    return result;
  }
  tick() {
    let vq1 = this.variables[1].value * (1 + 0.01 * this.milestones[0]);
    let vden = this.approx(this.variables[3].value, 2 + this.milestones[4]);

    this.tval += ((this.variables[0].value + 1) / 5) * this.dt;
    this.q = add(this.q, vq1 + this.variables[2].value + l10(this.dt));
    this.r = add(this.r, vden + l10(this.dt));

    const vm = this.milestones[1] ? this.variables[4].value : 0;
    const vn = this.milestones[2] ? this.variables[5].value : 0;

    let rhodot =
      l10(this.tval) +
      (Math.max(this.maxRho, this.lastPub) >= 10 ? this.norm_int(this.q - (this.milestones[3] < 3 ? l10(Math.PI) : 0)) : this.q - l10(Math.PI)) *
        (1 / Math.PI) +
      this.r +
      vm +
      vn;

    this.rho = add(this.rho, this.totMult + rhodot + l10(this.dt));

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
          if (i == 2 && this.msstate == 0) this.msstate = 1;
          this.rho = subtract(this.rho, this.variables[i].cost);
          this.variables[i].buy();
        } else break;
      }
  }
}
