import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { LinearValue, ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, subtract, getBestResult, getLastLevel, toCallables, newtonMax, logToExp } from "../../Utils/helpers";
import pubtable from "./helpers/CSR2pubtable.json" with { type: "json" };

export default async function csr2(data: theoryData): Promise<simResult> {
  if (data.strat !== "CSR2") {
    const sim1 = new csr2Sim(data);
    const res1 = await sim1.simulate();

    if (sim1.forcedPubRho !== Infinity) {
      return res1;
    }
    else {
      const sim2 = new csr2Sim(data);
      sim2.variables.forEach((v, i) => 
        v.setOriginalCap(getLastLevel(v.name, res1.boughtVars) || sim1.variables[i].level));

      sim2.variables[0].configureCap(4);
      sim2.variables[1].configureCap(1);
      sim2.variables[2].configureCap(4);
      sim2.variables[3].configureCap(1);
      sim2.variables[4].configureCap(1);

      const res2 = await sim2.simulate();
      return res2;
    }
  }

  const sim = new csr2Sim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "CSR2";

type PubTableType = {[key: string]: number};
const lowboundsActive = [0.65, 0.15, 0.85, 0, 0];
const highboundsActive = [1.45, 0.5, 1.8, 1.2, 1.2];

const lowboundsPassive = [1, 0.15, 1.35, 0, 0];
const highboundsPassive = [3.85, 0.5, 3.8, 1.2, 1.2];

class csr2Sim extends theoryClass<theory> {
  q: number;
  updateError_flag: boolean;
  error: number;

  forcedPubRho: number;
  bestRes: simResult | null;
  doContinuityFork: boolean;
  lowbounds: number[];
  highbounds: number[];

  tauHForSwap: number;
  swapQ?: number;

  getBuyingConditions(): conditionFunction[] {
    const idleStrat = [true, true, true, true, true];
    const coastingStrat = new Array(5).map((_, i) => () => this.variables[i].shouldBuy);
    const dStrat = [
        () =>
          this.variables[0].shouldBuy
          && this.variables[0].cost + 1 <
            Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost),
        () => this.variables[1].shouldBuy,
        () =>
          this.variables[2].shouldBuy
          && this.variables[2].cost + 1 <
            Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost),
        () => this.variables[3].shouldBuy,
        () => this.variables[4].shouldBuy,
      ];
    const modStrat = [
        () =>
          this.variables[0].shouldBuy
          && this.variables[0].cost + l10(7 + (this.variables[0].level % 10)) <
            Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost),
        () => 
          this.variables[1].shouldBuy 
          && this.variables[1].cost + l10(1.8) < this.variables[4].cost,
        () =>
          this.variables[2].shouldBuy
          && this.variables[2].cost + l10(15 + (this.variables[2].level % 10)) <
            Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost),
        () => this.variables[3].shouldBuy
          && this.variables[3].cost + l10(1.3) < this.variables[4].cost,
        () => this.variables[4].shouldBuy,
      ];

    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      CSR2: idleStrat,
      CSR2PT: coastingStrat,
      CSR2d: dStrat,
      CSR2Mod: modStrat,
      CSR2MSMod: modStrat
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

    if (this.lastPub < 500 && this.strat === "CSR2MSMod") {
      let msCond = 0;
      if (this.lastPub > 45) msCond = 4;
      if (this.lastPub > 80) msCond = 8;
      if (this.lastPub > 115) msCond = 20;
      if (this.lastPub > 220) msCond = 40;

      if (this.tauHForSwap === Infinity) return q1priority;
      if (this.variables.every((v) => !v.shouldBuy)) {
        const currentTauHForSwap = this.calculateTauHForSwap();
        console.log(currentTauHForSwap);
        if (currentTauHForSwap < this.tauHForSwap) {
          this.tauHForSwap = Infinity;
          this.swapQ = this.q;
          return q1priority;
        }
        else {
          this.tauHForSwap = currentTauHForSwap;
        }
      }

      if (
        (
          (
            this.rho.value + l10(msCond * 0.5) > this.variables[3].cost
            || (this.rho.value + l10(msCond) > this.variables[4].cost && this.milestones[1] > 0)
            || (this.curMult > 1 && this.rho.value + l10(2) > this.variables[1].cost)
          )
          && this.rho.value < Math.min(this.variables[3].cost, this.variables[4].cost)
        )
      ) {
        return q1priority;
      } else return c2priority;
    }

    return c2priority;
  }
  calculateTauHForSwap(): number {
    const oldMilestones = this.milestones
    this.updateMilestones([0, 1, 2]);

    const vq1 = this.variables[0].value * (1 + 0.05 * this.milestones[0]);
    const vc2 = this.milestones[1] > 0 ? this.variables[4].value * (1 + 0.5 * this.milestones[2]) : 0;
    const rhodot_c = this.totMult + vq1 + this.variables[1].value;
    const qdot = this.totMult + this.variables[2].value + vc2 + this.error;

    this.milestones = oldMilestones;

    let tauHFunc = (t: number) => 
      this.tauFactor * (add(
        this.rho.value, 
        rhodot_c + add(this.q, qdot + l10(t * 0.75)) + l10(t * 1.5)
      ) 
        - this.lastPub) / (t / 3600);

    return newtonMax(this.t, tauHFunc);
  }
  updateError(n: number) {
    const root8 = Math.sqrt(8)
    const root8p3 = root8 + 3;
    this.error = (n%2 == 0 ? subtract(n*l10(root8p3), 0) : add(n*l10(root8p3), 0)) - l10(root8);
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
    this.tauHForSwap = 0;

    this.forcedPubRho = Infinity;
    this.bestRes = null;
    this.doContinuityFork = true;
    if(this.strat.includes("Mod")) {
        this.lowbounds = lowboundsActive;
        this.highbounds = highboundsActive;
    }
    else {
        this.lowbounds = lowboundsPassive;
        this.highbounds = highboundsPassive;
    }
    if (this.strat !== "CSR2" && this.lastPub >= 500 && this.lastPub < 1499.5) {
      let newpubtable: PubTableType = pubtable.csr2data;
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
    this.curMult = other.curMult;
    this.q = other.q;
    this.updateError_flag = other.updateError_flag;
    this.error = other.error;

    this.forcedPubRho = other.forcedPubRho;
  }
  copy(): csr2Sim {
    let newsim = new csr2Sim(super.getDataForCopy());
    newsim.copyFrom(this);
    return newsim;
  }
  async simulate(): Promise<simResult> {
    //console.log("Start CSR2 sim");
    if (this.forcedPubRho != Infinity) {
      this.pubConditions.push(() => this.maxRho >= this.forcedPubRho);
    }
    while (!this.endSimulation()) {
      this.tick();
      this.updateSimStatus();
      // Do variable forks
      for (let i = 0; i < this.variables.length; i++) {
        let v = this.variables[i];
        if (v.shouldFork && v.cost <= this.rho.value) {
          await this.doForkVariable(i);
          this.bestRes = getBestResult(this.bestRes, this.bestForkRes);
        }
      }
      
      this.buyVariables();
      if (this.lastPub < 500) this.updateMilestones();
      // Continuity fork for pub tables
      if (this.forcedPubRho == 1500 && this.maxRho >= 1497 && this.doContinuityFork) {
        this.doContinuityFork = false;
        const fork = this.copy();
        fork.forcedPubRho = Infinity;
        const res = await fork.simulate();
        if (res.pubRho > 1500) {
          this.bestRes = getBestResult(this.bestRes, res);
        }
      }
    }
    this.trimBoughtVars();

    let stratExtra = " ";
    if (this.strat !== "CSR2") {
      stratExtra += `q1: ${getLastLevel("q1", this.boughtVars)} q2: ${getLastLevel("q2", this.boughtVars)} c1: ${getLastLevel("c1", this.boughtVars)}`;
    }
    if (this.swapQ) {
      stratExtra += " q: " + logToExp(this.swapQ, 1);
    }
    const result = this.createResult(stratExtra);
    //console.log("End CSR2 sim");
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

    const qdot = this.totMult + this.variables[2].value + vc2 + this.error;
    this.q = add(this.q, l10(this.dt) + qdot);
    const rhodot = this.totMult + vq1 + this.variables[1].value + this.q;
    this.rho.add(rhodot + l10(this.dt));
  }
  onVariablePurchased(id: number): void {
    if (id > 2) this.updateError_flag = true;
    if (this.strat !== "CSR2") {
      if (this.forcedPubRho !== Infinity) {
        if (this.forcedPubRho - this.variables[id].cost <= this.lowbounds[id]) {
          this.variables[id].stopBuying();
        }
        else if (this.forcedPubRho - this.variables[id].cost < this.highbounds[id]) {
          this.variables[id].shouldFork = true;
        }
      }
      else if (this.variables[id].coastingCapReached()) {
        if (this.variables[id].level < this.variables[id].originalCap) 
          this.variables[id].shouldFork = true;
        else this.variables[id].stopBuying();
      }
    }
  }
}

