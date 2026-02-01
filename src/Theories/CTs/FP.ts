import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue, BaseValue } from "../../Utils/value";
import { CompositeCost, ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, subtract, getBestResult, toCallables } from "../../Utils/helpers";
import pubtable from "./helpers/FPpubtable.json" assert { type: "json" };

export default async function fp(data: theoryData): Promise<simResult> {
  const sim = new fpSim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "FP";

class VariableSValue extends BaseValue {
  getS(level: number): number {
    const cutoffs = [32, 39];
    if (level < cutoffs[0]) return 1 + level * 0.15;
    if (level < cutoffs[1]) return this.getS(cutoffs[0] - 1) + 0.15 + (level - cutoffs[0]) * 0.2;
    return this.getS(cutoffs[1] - 1) + 0.2 + (level - cutoffs[1]) * 0.15;
  }
  computeNewValue(prevValue: number, currentLevel: number): number {
    return this.getS(currentLevel + 1);
  }
  recomputeValue(level: number): number {
    return this.getS(level);
  }
  copy(): VariableSValue {
    return new VariableSValue()
  }
}

const stepwiseSum = (level: number, base: number, length: number) => {
  if (level <= length) return level;
  level -= length;
  const cycles = Math.floor(level / length);
  const mod = level - cycles * length;
  return base * (cycles + 1) * ((length * cycles) / 2 + mod) + length + level;
};

type pubTable = {[key: string]: number};

class fpSim extends theoryClass<theory> {
  // growing variables
  q: number;
  r: number;
  t_var: number;
  // fractals
  T_n: number;
  U_n: number;
  S_n: number;
  n: number;
  updateN_flag: boolean;
  // pub tables and coasting
  forcedPubRho: number;
  coasting: boolean[];
  bestRes: simResult | null;
  doContinuityFork: boolean;

  getBuyingConditions(): conditionFunction[] {
    const idleStrat = new Array(8).fill(true);
    const activeStrat = [
      true,
      () => this.variables[1].cost + l10((this.variables[1].level % 100) + 1) < this.variables[2].cost,
      ...new Array(6).fill(true),
    ];
    const activeBurstStrat = [
      true, // t - 0
      () => {
        const mod100 = this.variables[1].level % 100;
        if(mod100 > 85) {
          const levelMinusMod = this.variables[1].level - mod100;
          const totalCost = this.variables[1].getCostForLevels(
              levelMinusMod + mod100,
              levelMinusMod + 101
          )
          if(totalCost < this.variables[2].cost && (this.milestones[4] == 0 || totalCost < this.variables[7].cost)) {
            return true;
          }
        }
        return (this.variables[1].cost + l10((this.variables[1].level % 100) + 1) < this.variables[2].cost) &&
            (this.milestones[4] == 0 || this.variables[1].cost + l10((this.variables[1].level % 100) + 1) < this.variables[7].cost)
      }, // c1 - 1
      () => {
        if(this.milestones[4] == 0) return true;
        // s:
        return this.variables[2].cost + 0.1 < this.variables[7].cost;
      }, //c2 - 2
      //q1 - 3
      () => {
        let cond1 = this.variables[3].cost + l10(((this.variables[3].level % 10) + 1) * 2) < this.variables[4].cost
        //let cond2 = this.variables[3].cost + l10((this.variables[3].level % 10) + 1) < this.variables[2].cost
        return cond1;
      }, //q1
      () => {
        let cond1 = true; //this.variables[4].cost + 0.05 < this.variables[2].cost;
        let cond2 = true;
        if(this.milestones[4] != 0) {
          cond2 = this.variables[4].cost + 0.1 < this.variables[7].cost;
        }
        return cond1 && cond2;
      }, //q2 - 4
      true, //r1 - 5
      true, //n1 - 6
      true, //s - 7
    ];

    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      FP: idleStrat,
      FPcoast: idleStrat,
      FPd: activeStrat,
      FPdMS: activeStrat,
      FPmodBurstC1: activeBurstStrat,
      FPmodBurstC1MS: activeBurstStrat
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = [
      () => this.variables[0].level < 4,
      () => true,
      () => true,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 1,
      () => true,
      () => this.milestones[4] > 0,
    ];
    return conditions;
  }
  getTotMult(val: number): number {
    return val < this.pubUnlock ? 0 : Math.max(0, val * this.tauFactor * 0.331 + l10(5));
  }
  getMilestonePriority(): number[] {
    return [0, 1, 2, 3, 4, 5];
  }
  approx(n: number): number {
    n++;
    return l10(1 / 6) + add(l10(2) * (2 * n), l10(2));
  }
  T(n: number): number {
    if (n === 0) return 0;
    const log2N = Math.log2(n);
    if (log2N % 1 === 0) return (2 ** (2 * log2N + 1) + 1) / 3;
    const i = n - 2 ** Math.floor(log2N);
    return this.T(2 ** Math.floor(log2N)) + 2 * this.T(i) + this.T(i + 1) - 1;
  }
  V(n: number): number {
    if (n === 0) return 0;
    const log2N = Math.log2(n);
    if (log2N % 1 === 0) return 2 ** (2 * log2N);
    const i = n - 2 ** Math.floor(log2N);
    return 2 ** (2 * Math.floor(log2N)) + 3 * this.V(i);
  }
  U(n: number): number {
    return (4/3)*this.V(n) - (1/3);
  }
  S(n: number): number {
    if (n === 0) return 0;
    if (this.milestones[3] === 0) return l10(3) * (n - 1);
    return l10(1 / 3) + subtract(l10(2) + l10(3) * n, l10(3));
  }
  updateN() {
    this.T_n = this.T(this.n);
    this.U_n = this.U(this.n);
    this.S_n = this.S(Math.floor(Math.sqrt(this.n)));
  }
  constructor(data: theoryData) {
    super(data);
    this.q = 0;
    this.r = 0;
    this.t_var = 0;
    this.T_n = 1;
    this.U_n = 1;
    this.S_n = 0;
    this.n = 1;
    this.updateN_flag = true;
    this.pubUnlock = 12;
    this.milestoneUnlocks = [l10(5e22), 95, 175, 300, 385, 420, 550, 600, 700, 1500];
    this.milestonesMax = [2, 2, 3, 1, 1, 1];
    this.variables = [
      new Variable({ name: "tdot", cost: new ExponentialCost(1e4, 1e4), valueScaling: new ExponentialValue(10) }),
      new Variable({ name: "c1", cost: new FirstFreeCost(new ExponentialCost(10, 1.4)), valueScaling: new StepwisePowerSumValue(150, 100)}),
      new Variable({ name: "c2", cost: new CompositeCost(15, new ExponentialCost(1e15, 40), new ExponentialCost(1e37, 16.42)), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "q1", cost: new FirstFreeCost(new ExponentialCost(1e35, 12)), valueScaling: new StepwisePowerSumValue(10, 10)}),
      new Variable({ name: "q2", cost: new ExponentialCost(1e76, 1e3), valueScaling: new ExponentialValue(10) }),
      new Variable({
        name: "r1",
        cost: new FirstFreeCost(new CompositeCost(285, new ExponentialCost(1e80, 25), new ExponentialCost("1e480", 150))),
        valueScaling: new StepwisePowerSumValue(2, 5)
      }),
      new Variable({ name: "n", cost: new ExponentialCost(1e4, 3e6), valueScaling: new ExponentialValue(10) }),
      new Variable({ name: "s", cost: new ExponentialCost("1e730", 1e30), valueScaling: new VariableSValue()}),
    ];

    this.forcedPubRho = Infinity;
    this.coasting = new Array(this.variables.length).fill(false);
    this.bestRes = null;
    this.doContinuityFork = true;
    if (this.lastPub >= 1200 && this.lastPub < 1990 && this.strat !== "FP") {
      let newpubtable: pubTable = pubtable.fpdata;
      let pubseek = Math.round(this.lastPub * 8);
      this.forcedPubRho = newpubtable[pubseek.toString()] / 8;
      if (this.forcedPubRho === undefined) this.forcedPubRho = Infinity;
    }

    this.doSimEndConditions = () => this.forcedPubRho == Infinity;
    this.updateMilestones();
  }
  copyFrom(other: this): void {
    super.copyFrom(other);

    this.milestones = { ...other.milestones };
    this.curMult = other.curMult;
    this.q = other.q;
    this.r = other.r;
    this.t_var = other.t_var;
    this.T_n = other.T_n;
    this.U_n = other.U_n;
    this.S_n = other.S_n;
    this.n = other.n;
    this.updateN_flag = other.updateN_flag;
    this.forcedPubRho = other.forcedPubRho;
    this.coasting = [...other.coasting];
  }
  copy(): fpSim {
    let newsim = new fpSim(this.getDataForCopy());
    newsim.copyFrom(this);
    return newsim;
  }
  async simulate(): Promise<simResult> {
    if (this.forcedPubRho != Infinity) {
      this.pubConditions.push(() => this.maxRho >= this.forcedPubRho);
    }
    else {
      this.simEndConditions.push(() => this.curMult > 10000)
    }
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      this.updateMilestones();
      await this.buyVariablesFork();
      if (this.forcedPubRho == 2000 && this.maxRho >= 1996 && this.doContinuityFork) {
        this.doContinuityFork = false;
        const fork = this.copy();
        fork.forcedPubRho = Infinity;
        const res = await fork.simulate();
        this.bestRes = getBestResult(this.bestRes, res);
      }
    }
    this.trimBoughtVars();
    const result = this.createResult();
    return getBestResult(result, this.bestRes);
  }
  tick() {
    if (this.updateN_flag) {
      const term1 = stepwiseSum(this.variables[6].level, 1, 40);
      const term2 = this.milestones[1] > 0 ? Math.floor(stepwiseSum(Math.max(0, this.variables[6].level - 30), 1, 35) * 2) : 0;
      const term3 = this.milestones[1] > 1 ? Math.floor(stepwiseSum(Math.max(0, this.variables[6].level - 69), 1, 30) * 2.4) : 0;
      this.n = Math.min(20000, 1 + term1 + term2 + term3);
      this.updateN();
      this.updateN_flag = false;
    }

    if (this.strat.includes("MS") && this.lastPub > 700 && this.variables[7].value < 2) {
      this.milestones[4] = 1;
      if (this.ticks % 20 < 10 / this.variables[7].value) this.milestones[4] = 0;
    }

    const vq1 = this.variables[3].value - l10(1 + 1000 / this.variables[3].level ** 1.5);
    const vr1 = this.variables[5].value - l10(1 + 1e9 / this.variables[5].level ** 4);
    const A = this.approx(this.variables[4].level);

    this.t_var += (this.variables[0].level / 5 + 0.2) * this.dt;

    const qdot = vq1 + A + l10(this.U_n) * (7 + (this.milestones[4] > 0 ? this.variables[7].value : 0)) - 3;
    this.q = this.milestones[0] > 0 ? add(this.q, qdot + l10(this.dt)) : this.q;

    let rdot: number;
    const vSn = this.S_n * (1 + 0.6 * this.milestones[2]);
    if (this.milestones[5] < 1) rdot = vr1 + (l10(this.T_n) + l10(this.U_n)) * l10(this.n) + vSn;
    else rdot = vr1 + (l10(this.T_n) + l10(this.U_n)) * (l10(this.U_n * 2) / 2) + vSn;
    this.r = this.milestones[0] > 1 ? add(this.r, rdot + l10(this.dt)) : this.r;

    let rhodot =
      this.totMult +
      this.variables[1].value +
      this.variables[2].value +
      l10(this.T_n) * (7 + (this.milestones[4] > 0 ? this.variables[7].value - 2 : 0)) +
      l10(this.t_var);
    rhodot += this.milestones[0] > 0 ? this.q : 0;
    rhodot += this.milestones[0] > 1 ? this.r : 0;

    this.rho.add(rhodot + l10(this.dt));
  }
  extraBuyingCondition(id: number): boolean {
    return !this.coasting[id];
  }
  async confirmPurchase(id: number): Promise<boolean> {
    if (this.forcedPubRho !== Infinity) {
      const lowbounds = [0, 0.3, 0.15, 0.3, 0.3, 0.1, 0, 0];
      const highbounds = [0, 3.5, 0.5, 3.5, 1, 3.5, 1.5, 0];
      if (this.forcedPubRho - this.variables[id].cost <= lowbounds[id]) {
        this.coasting[id] = true;
        return false;
      }
      if (this.forcedPubRho - this.variables[id].cost < highbounds[id]) {
        let fork = this.copy();
        fork.coasting[id] = true;
        const forkres = await fork.simulate();
        this.bestRes = getBestResult(this.bestRes, forkres);
      }
    }
    return true;
  }
  onVariablePurchased(id: number): void {
    if (id === 6) this.updateN_flag = true;
  }
}
