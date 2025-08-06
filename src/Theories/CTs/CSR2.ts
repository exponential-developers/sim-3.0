import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep, getBestResult, getLastLevel } from "../../Utils/helpers.js";
import { LinearValue, ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import pubtable from "./helpers/CSR2pubtable.json" assert { type: "json" };
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';

export default async function csr2(data: theoryData): Promise<simResult> {
  const sim = new csr2Sim(data);
  const res = await sim.simulate(data);
  return res;
}

type theory = "CSR2";

type pubTable = {[key: string]: number};

class csr2Sim extends theoryClass<theory> implements specificTheoryProps {
  recursionValue: Array<number>;
  bestCoast: Array<number>;
  curMult: number;
  rho: number;
  q: number;
  updateError_flag: boolean;
  error: number;

  forcedPubRho: number;
  coasting: Array<boolean>;
  bestRes: simResult | null;

  getBuyingConditions() {
    const idlestrat = [true, true, true, true, true];
    const activeStrat = [
        () =>
          this.variables[0].cost + l10(7 + (this.variables[0].level % 10)) <
          Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost),
        true,
        () =>
          this.variables[2].cost + l10(15 + (this.variables[2].level % 10)) <
          Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost),
        true,
        true,
      ];
    const activeXLstrat = [
        () =>
          this.variables[0].cost + l10(7 + (this.variables[0].level % 10)) <
          Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost),
        () => this.variables[1].cost + l10(1.8) < this.variables[4].cost,
        () =>
          this.variables[2].cost + l10(15 + (this.variables[2].level % 10)) <
          Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost),
        () => this.variables[3].cost + l10(1.3) < this.variables[4].cost,
        true,
      ];
    
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      CSR2: idlestrat,
      CSR2PT: idlestrat,
      CSR2d: activeStrat,
      CSR2XL: activeXLstrat,
      CSR2XLPT: activeXLstrat
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getMilestoneConditions() {
    const conditions: Array<conditionFunction> = [() => true, () => true, () => true, () => true, () => this.milestones[1] > 0];
    return conditions;
  }
  getTotMult(val: number) {
    return Math.max(0, val * this.tauFactor * 0.55075 - l10(200));
  }
  updateMilestones(): void {
    let milestoneCount = 0;
    const points = [10, 45, 80, 115, 220, 500];
    for (let i = 0; i < points.length; i++) {
      if (Math.max(this.lastPub, this.maxRho) >= points[i]) milestoneCount = i + 1;
    }
    let priority = [2, 3, 1];
    if (this.lastPub < 500 && this.strat === "CSR2XL") {
      let msCond = 0;
      if (this.lastPub > 45) msCond = 4;
      if (this.lastPub > 80) msCond = 8;
      if (this.lastPub > 115) msCond = 20;
      if (this.lastPub > 220) msCond = 40;
      if (
        ((this.rho + l10(msCond * 0.5) > this.variables[3].cost ||
          (this.rho + l10(msCond) > this.variables[4].cost && this.milestones[1] > 0) ||
          (this.curMult > 1 && this.rho + l10(2) > this.variables[1].cost)) &&
          this.rho < Math.min(this.variables[3].cost, this.variables[4].cost)) ||
        this.t > this.recursionValue[0]
      ) {
        priority = [1, 2, 3];
      } else priority = [2, 3, 1];
    }
    this.milestones = [0, 0, 0];
    const max = [3, 1, 2];
    for (let i = 0; i < priority.length; i++) {
      while (this.milestones[priority[i] - 1] < max[priority[i] - 1] && milestoneCount > 0) {
        this.milestones[priority[i] - 1]++;
        milestoneCount--;
      }
    }
  }
  updateError(n: number) {
    const root8 = Math.sqrt(8)
    const root8p3 = root8 + 3;
    this.error = (n%2 == 0 ? subtract(n*l10(root8p3), 0) : add(n*l10(root8p3), 0)) - l10(root8);
  }
  searchCoast(rhodot: number) {
    if (this.curMult > 0.7) {
      let i = getCoastLen(this.lastPub);
      const maxMulti = ((this.totMult + Math.log10(4) + Math.log10(200)) / 2.203) * 10;
      const s = () => {
        const endRho = add(
          this.rho,
          rhodot +
            this.variables[0].value * (this.maxRho >= 10 ? (this.maxRho >= 45 ? (this.maxRho >= 80 ? 1.15 : 1.1) : 1.05) : 1) +
            Math.log10(i * 1.5)
        );
        const endTauH = (Math.min(maxMulti, endRho) - this.lastPub) / ((this.t + i) / 3600);
        if (this.bestCoast[0] < endTauH) {
          this.bestCoast[0] = endTauH;
          this.bestCoast[1] = this.t;
        }
      };
      if (this.lastPub < 500) {
        s();
        i = i * 0.8;
        s();
        i = i / 0.8 ** 2;
        s();
      } else {
        rhodot = this.totMult + this.variables[0].value * (1 + 0.05 * this.milestones[0]) + this.variables[1].value + this.q;
        const qdot = this.totMult + this.variables[2].value + this.variables[4].value * 1.15 + this.error;
        const avgQ = add(this.q + l10(2), qdot + Math.log10(i * 1.5)) - l10(2);
        const endRho = add(this.rho, rhodot - this.q + avgQ + Math.log10(i * 1.5));
        const endTauH = (endRho - this.lastPub) / ((this.t + i) / 3600);
        if (this.bestCoast[0] < endTauH && endRho < maxMulti) {
          this.bestCoast[0] = endTauH;
          this.bestCoast[1] = this.t;
        }
      }
    }
  }
  constructor(data: theoryData) {
    super(data);
    this.totMult = this.getTotMult(data.rho);
    this.curMult = 0;
    this.rho = 0;
    this.q = 0;
    //initialize variables
    this.varNames = ["q1", "q2", "c1", "n", "c2"];
    this.variables = [
      new Variable({ cost: new FirstFreeCost(new ExponentialCost(10, 5)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(15, 128), valueScaling: new ExponentialValue(2) }),
      new Variable({ cost: new ExponentialCost(1e6, 16), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ cost: new ExponentialCost(50, 2 ** (Math.log2(256) * 3.346)), valueScaling: new LinearValue(1, 1)}),
      new Variable({ cost: new ExponentialCost(1e3, 10 ** 5.65), valueScaling: new ExponentialValue(2) }),
    ];
    this.recursionValue = <Array<number>>data.recursionValue ?? [Infinity, 0];
    this.bestCoast = [0, 0];
    this.updateError_flag = true;
    this.error = 0;

    this.forcedPubRho = Infinity;
    this.coasting = new Array(this.variables.length).fill(false);
    this.bestRes = null;

    this.conditions = this.getBuyingConditions();
    this.milestoneConditions = this.getMilestoneConditions();
    this.updateMilestones();
  }
  copyFrom(other: this): void {
    super.copyFrom(other);

    this.milestones = [...other.milestones];
    this.recursionValue = [...other.recursionValue];
    this.bestCoast = [...other.bestCoast];
    this.curMult = other.curMult;
    this.rho = other.rho;
    this.q = other.q;
    this.updateError_flag = other.updateError_flag;
    this.error = other.error;

    this.forcedPubRho = other.forcedPubRho;
    this.coasting = [...other.coasting];
  }
  copy(): csr2Sim {
    let newsim = new csr2Sim(super.getDataForCopy());
    newsim.copyFrom(this);
    return newsim;
  }
  async simulate(data: theoryData) {
    if (this.lastPub >= 10 && (data.recursionValue === null || data.recursionValue === undefined) && this.strat === "CSR2XL") {
      data.recursionValue = [Infinity, 0];
      const sim = new csr2Sim(data);
      await sim.simulate(data);
      this.recursionValue = [sim.bestCoast[1], 1];
    }
    let pubCondition = false;
    if (this.strat.includes("PT") && this.lastPub >= 500 && this.lastPub < 1499.5) {
      let newpubtable: pubTable = pubtable.csr2data;
      let pubseek = Math.round(this.lastPub * 16);
      this.forcedPubRho = newpubtable[pubseek.toString()] / 16;
      if (this.forcedPubRho === undefined) this.forcedPubRho = Infinity;
    }
    while (!pubCondition) {
      if (!global.simulating) break;
      if ((this.ticks + 1) % 500000 === 0) await sleep();
      this.tick();
      if (this.rho > this.maxRho) this.maxRho = this.rho;
      this.curMult = 10 ** (this.getTotMult(this.maxRho) - this.totMult);
      if (
        (this.recursionValue !== null && this.recursionValue !== undefined && this.t < this.recursionValue[0]) ||
        this.curMult < 0.7 ||
        this.recursionValue[1] === 0
      ) await this.buyVariables();
      if (this.lastPub < 500) this.updateMilestones();
      if (this.forcedPubRho !== Infinity) {
        pubCondition = this.pubRho >= this.forcedPubRho && this.pubRho > 10 && (this.pubRho <= 1500 || this.t > this.pubT * 2);
        pubCondition ||= this.pubRho > this.cap[0];
      }
      else {
        pubCondition =
          (global.forcedPubTime !== Infinity ? this.t > global.forcedPubTime : this.t > this.pubT * 2 || this.pubRho > this.cap[0]) && this.pubRho > 10;
      }
      
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    let lastBuy = 0;
    for (let i = 0; i < this.variables.length; i++) {
      const costIncs = [5, 128, 16, 2 ** (Math.log2(256) * 3.346), 10 ** 5.65];
      lastBuy = Math.max(lastBuy, this.variables[i].cost - l10(costIncs[i]));
    }
    if (this.recursionValue[1] === 1 || this.strat !== "CSR2XL")
      while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    let stratExtra = " ";
    if (this.strat === "CSR2XL") {
      stratExtra += Math.min(this.pubMulti, 10 ** (this.getTotMult(lastBuy) - this.totMult)).toFixed(2);
    }
    if (this.strat.includes("PT")) {
      stratExtra += `q1: ${getLastLevel("q1", this.boughtVars)} q2: ${getLastLevel("q2", this.boughtVars)} c1: ${getLastLevel("c1", this.boughtVars)}`;
    }
    const result = createResult(this, stratExtra);

    return getBestResult(result, this.bestRes);
  }
  tick() {
    const vq1 = this.variables[0].value * (1 + 0.05 * this.milestones[0]);
    const vc2 = this.milestones[1] > 0 ? this.variables[4].value * (1 + 0.5 * this.milestones[2]) : 0;

    if (this.updateError_flag) {
      const c2level = this.milestones[1] > 0 ? this.variables[4].level : 0;
      const vn = this.variables[3].value + c2level;
      this.updateError(vn);

      this.updateError_flag = false;
    }

    if (this.lastPub < 500) this.searchCoast(this.totMult + this.variables[1].value + this.q);

    const qdot = this.variables[2].value + vc2 + this.error;
    this.q = add(this.q, this.totMult + l10(this.dt) + qdot);
    const rhodot = this.totMult + vq1 + this.variables[1].value + this.q;
    this.rho = add(this.rho, rhodot + l10(this.dt));

    this.t += this.dt / 1.5;
    this.dt *= this.ddt;
    if (this.maxRho < this.recovery.value) this.recovery.time = this.t;

    this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
    if (
      this.maxTauH < this.tauH || 
      this.maxRho >= this.cap[0] - this.cap[1] || 
      this.pubRho < 10 || 
      global.forcedPubTime !== Infinity ||
      (this.forcedPubRho !== Infinity && this.pubRho < this.forcedPubRho)
    ) {
      if (this.maxTauH < this.tauH && this.maxRho >= 1500)
      {
        this.coasting = new Array(this.variables.length).fill(false);
        this.forcedPubRho = Infinity;
      }
      this.maxTauH = this.tauH;
      this.pubT = this.t;
      this.pubRho = this.maxRho;
    }
  }
  async buyVariables() {
    let bought = false;
    const lowbounds = [0.65, 0.15, 0.85, 0, 0];
    const highbounds = [1.45, 0.5, 1.8, 1.2, 1.2];
    for (let i = this.variables.length - 1; i >= 0; i--)
      while (true) {
        if (this.rho > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]() && !this.coasting[i]) {
          if (this.forcedPubRho !== Infinity) {
            if (this.forcedPubRho - this.variables[i].cost <= lowbounds[i]) {
              this.coasting[i] = true;
              break;
            }
            if (this.forcedPubRho - this.variables[i].cost < highbounds[i]) {
              //console.log(`Creating fork for ${this.varNames[i]} lvl ${this.variables[i].level + 1}`)
              let fork = this.copy();
              fork.coasting[i] = true;
              const forkres = await fork.simulate(super.getDataForCopy());
              //console.log(`Fork returned ${forkres.tauH}`)
              this.bestRes = getBestResult(this.bestRes, forkres);
            }
          }
          if (this.maxRho + 5 > this.lastPub && (this.recursionValue[1] === 1 || this.strat !== "CSR2XL")) {
            this.boughtVars.push({ variable: this.varNames[i], level: this.variables[i].level + 1, cost: this.variables[i].cost, timeStamp: this.t });
          }
          this.rho = subtract(this.rho, this.variables[i].cost);
          this.variables[i].buy();
          if (i > 2) this.updateError_flag = true;
          bought = true;
        } else break;
      }
    if (bought && this.strat === "CSR2XL") this.searchCoast(this.totMult + this.variables[1].value + this.q);
  }
}

function getCoastLen(r: number) {
  if (r < 45) return r ** 2.1 / 10;
  if (r < 80) return r ** 2.22 / 40;
  if (r < 220) return r ** 2.7 / 3.3e4 + 40;
  if (r < 500) return r ** 2.8 / 9.2e4 + 40;
  return 1.5 ** (r ** 0.8475 / 20) * 5;
}
