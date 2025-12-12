import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { LinearValue, ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, subtract, getBestResult, getLastLevel, toCallables } from "../../Utils/helpers";
import pubtable from "./helpers/CSR2pubtable.json" assert { type: "json" };

export default async function csr2(data: theoryData): Promise<simResult> {
  const sim = new csr2Sim(data);
  const res = await sim.simulate(data);
  return res;
}

type theory = "CSR2";

type pubTable = {[key: string]: number};
const lowboundsActive = [0.65, 0.15, 0.85, 0, 0];
const highboundsActive = [1.45, 0.5, 1.8, 1.2, 1.2];

const lowboundsPassive = [1, 0.15, 1.35, 0, 0];
const highboundsPassive = [2.85, 0.5, 3.3, 1.2, 1.2];

class csr2Sim extends theoryClass<theory> {
  recursionValue: number[];
  bestCoast: number[];
  q: number;
  updateError_flag: boolean;
  error: number;

  forcedPubRho: number;
  coasting: boolean[];
  bestRes: simResult | null;
  doContinuityFork: boolean;
  lowbounds: number[];
  highbounds: number[];

  getBuyingConditions(): conditionFunction[] {
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

    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      CSR2: idlestrat,
      CSR2PT: idlestrat,
      CSR2d: activeStrat,
      CSR2XL: activeXLstrat,
      CSR2XLPT: activeXLstrat
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = [
      () => true,
      () => true,
      () => true,
      () => true,
      () => this.milestones[1] > 0
    ];
    return conditions;
  }
  getTotMult(val: number): number {
    return Math.max(0, val * this.tauFactor * 0.55075 - l10(200));
  }
  getMilestonePriority(): number[] {
    const c2priority = [1, 2, 0];
    const q1priority = [0, 1, 2];

    if (this.lastPub < 500 && this.strat === "CSR2XL") {
      let msCond = 0;
      if (this.lastPub > 45) msCond = 4;
      if (this.lastPub > 80) msCond = 8;
      if (this.lastPub > 115) msCond = 20;
      if (this.lastPub > 220) msCond = 40;
      if (
        (
          (
            this.rho.value + l10(msCond * 0.5) > this.variables[3].cost
            || (this.rho.value + l10(msCond) > this.variables[4].cost && this.milestones[1] > 0)
            || (this.curMult > 1 && this.rho.value + l10(2) > this.variables[1].cost)
          )
          && this.rho.value < Math.min(this.variables[3].cost, this.variables[4].cost)
        )
        || this.t > this.recursionValue[0]
      ) {
        return q1priority;
      } else return c2priority;
    }

    return c2priority;
  }
  updateError(n: number) {
    const root8 = Math.sqrt(8)
    const root8p3 = root8 + 3;
    this.error = (n%2 == 0 ? subtract(n*l10(root8p3), 0) : add(n*l10(root8p3), 0)) - l10(root8);
  }
  searchCoast(rhodot: number) {
    if (this.curMult > 0.7) {
      let i = getCoastLen(this.lastPub);
      const maxMulti = ((this.totMult + l10(4) + l10(200)) / 2.203) * 10;
      const s = () => {
        const endRho = add(
          this.rho.value,
          rhodot +
            this.variables[0].value * (this.maxRho >= 10 ? (this.maxRho >= 45 ? (this.maxRho >= 80 ? 1.15 : 1.1) : 1.05) : 1) +
            l10(i * 1.5)
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
        const avgQ = add(this.q + l10(2), qdot + l10(i * 1.5)) - l10(2);
        const endRho = add(this.rho.value, rhodot - this.q + avgQ + l10(i * 1.5));
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
    this.q = 0;
    this.updateError_flag = true;
    this.error = 0;
    this.pubUnlock = 10;
    this.milestoneUnlocks = [10, 45, 80, 115, 220, 500];
    this.milestonesMax = [3, 1, 2];
    this.variables = [
      new Variable({ name: "q1", cost: new FirstFreeCost(new ExponentialCost(10, 5)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "q2", cost: new ExponentialCost(15, 128), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c1", cost: new ExponentialCost(1e6, 16), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ name: "n",  cost: new ExponentialCost(50, 2 ** (Math.log2(256) * 3.346)), valueScaling: new LinearValue(1, 1)}),
      new Variable({ name: "c2", cost: new ExponentialCost(1e3, 10 ** 5.65), valueScaling: new ExponentialValue(2) }),
    ];

    this.recursionValue = <number[]>data.recursionValue ?? [Infinity, 0];
    this.bestCoast = [0, 0];

    this.forcedPubRho = Infinity;
    this.coasting = new Array(this.variables.length).fill(false);
    this.bestRes = null;
    this.doContinuityFork = true;
    if(this.strat.includes("XL")) {
        this.lowbounds = lowboundsActive;
        this.highbounds = highboundsActive;
    }
    else {
        this.lowbounds = lowboundsPassive;
        this.highbounds = highboundsPassive;
    }
    if (this.strat.includes("PT") && this.lastPub >= 500 && this.lastPub < 1499.5) {
      let newpubtable: pubTable = pubtable.csr2data;
      let pubseek = Math.round(this.lastPub * 16);
      this.forcedPubRho = newpubtable[pubseek.toString()] / 16;
      if (this.forcedPubRho === undefined) this.forcedPubRho = Infinity;
    }

    this.doSimEndConditions = () => this.forcedPubRho == Infinity;
    this.updateMilestones();
  }
  copyFrom(other: this) {
    super.copyFrom(other);

    this.milestones = [...other.milestones];
    this.recursionValue = [...other.recursionValue];
    this.bestCoast = [...other.bestCoast];
    this.curMult = other.curMult;
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
  async simulate(data: theoryData): Promise<simResult> {
    if (this.forcedPubRho != Infinity) {
      this.pubConditions.push(() => this.maxRho >= this.forcedPubRho);
    }
    if (this.lastPub >= 10 && (data.recursionValue === null || data.recursionValue === undefined) && this.strat === "CSR2XL") {
      data.recursionValue = [Infinity, 0];
      const sim = new csr2Sim(data);
      await sim.simulate(data);
      this.recursionValue = [sim.bestCoast[1], 1];
    }
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (
        (this.recursionValue !== null && this.recursionValue !== undefined && this.t < this.recursionValue[0])
        || this.curMult < 0.7
        || this.recursionValue[1] === 0
      ) await this.buyVariablesFork();
      if (this.lastPub < 500) this.updateMilestones();
      if (this.forcedPubRho == 1500 && this.maxRho >= 1495 && this.doContinuityFork) {
        this.doContinuityFork = false;
        const fork = this.copy();
        fork.forcedPubRho = Infinity;
        const res = await fork.simulate(this.getDataForCopy());
        this.bestRes = getBestResult(this.bestRes, res);
      }
    }
    if (this.recursionValue[1] === 1 || this.strat !== "CSR2XL")
      this.trimBoughtVars();

    let stratExtra = " ";
    if (this.strat === "CSR2XL") {
      let lastBuy = 0;
      for (let i = 0; i < this.variables.length; i++) {
        const costIncs = [5, 128, 16, 2 ** (Math.log2(256) * 3.346), 10 ** 5.65];
        lastBuy = Math.max(lastBuy, this.variables[i].cost - l10(costIncs[i]));
      }
      stratExtra += (10 ** (this.getTotMult(Math.min(lastBuy, this.pubRho)) - this.totMult)).toFixed(2);
    }
    if (this.strat.includes("PT")) {
      stratExtra += `q1: ${getLastLevel("q1", this.boughtVars)} q2: ${getLastLevel("q2", this.boughtVars)} c1: ${getLastLevel("c1", this.boughtVars)}`;
    }
    const result = this.createResult(stratExtra);
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
    this.rho.add(rhodot + l10(this.dt));
  }
  extraBuyingCondition(id: number): boolean {
    return !this.coasting[id];
  }
  async confirmPurchase(id: number): Promise<boolean> {
    if (this.forcedPubRho !== Infinity) {
      if (this.forcedPubRho - this.variables[id].cost <= this.lowbounds[id]) {
        this.coasting[id] = true;
        return false;
      }
      if (this.forcedPubRho - this.variables[id].cost < this.highbounds[id]) {
        let fork = this.copy();
        fork.coasting[id] = true;
        const forkres = await fork.simulate(super.getDataForCopy());
        this.bestRes = getBestResult(this.bestRes, forkres);
      }
    }
    return true;
  }
  onVariablePurchased(id: number): void {
    if (id > 2) this.updateError_flag = true;
  }
  onAnyVariablePurchased(): void {
    if (this.strat === "CSR2XL") this.searchCoast(this.totMult + this.variables[1].value + this.q);
  }
}

function getCoastLen(r: number) {
  if (r < 45) return r ** 2.1 / 10;
  if (r < 80) return r ** 2.22 / 40;
  if (r < 220) return r ** 2.7 / 3.3e4 + 40;
  if (r < 500) return r ** 2.8 / 9.2e4 + 40;
  return 1.5 ** (r ** 0.8475 / 20) * 5;
}
