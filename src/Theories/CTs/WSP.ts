import { global } from "../../Sim/main";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, getBestResult, getLastLevel, l10, toCallables } from "../../Utils/helpers";

import activePubTable from "./helpers/table_wsp_0_1_active_coast.json";
import passivePubTable from "./helpers/table_wsp_0_1_passive_coast.json";

import activePubTable2 from "./helpers/table_wsp_0_1_active_coast_1497.json";
import passivePubTable2 from "./helpers/table_wsp_0_1_passive_coast_1497.json";
import { traditionalConverter } from "../../Utils/progressConversion";
import traditionalTheoryClass from "../traditionalTheory";

type pubRecord = {
  next: string;
  time: number;
}

type theory = "WSP";

const converter: ProgressValueConverterRho = traditionalConverter({
  tauFactor: 0.4,
  multExponent: 0.375
});

const WSP: TheoryInterface<theory> = {
  simulate: wsp,
  converter
};

export default WSP;

async function wsp(data: theoryData<theory>): Promise<simResult> {
  let res;
  if(data.strat.includes("Coast")) {
    let data2: theoryData<theory> = {
      ...data,
      strat: data.strat.replace("PT2", "").replace("PT", "").replace("Coast", "").replace("PostRecovery", "") as stratType[theory]
    };
    const sim1 = new wspSim(data2);
    const res1 = await sim1.simulate();
    const lastQ1 = getLastLevel("q1", res1.boughtVars);
    let sim = new wspSim(data);
    sim.variables[0].setOriginalCap(lastQ1);
    if(data.strat.includes("WSPd")) {
      // For WSPd, it is always either skip 0, 1 or 2.
      sim.variables[0].configureCap(2);
    }
    else {
      if(converter.convertTo(data.input, "rho") >= 300) {
        sim.variables[0].configureCap(10);
      }
      else {
        sim.variables[0].configureCap(19);
      }
    }
    res = await sim.simulate();

  }
  else {
    const sim = new wspSim(data);
    res = await sim.simulate();
  }
  return res;
}

class wspSim extends traditionalTheoryClass<theory> {
  q: number;
  S: number;
  updateS_flag: boolean;

  getBuyingConditions(): conditionFunction[] {
    let c1weight = 0;
    if (this.lastPubRho >= 25) c1weight = l10(3);
    if (this.lastPubRho >= 40) c1weight = 1;
    if (this.lastPubRho >= 200) c1weight = l10(50);
    if (this.lastPubRho >= 400) c1weight = 3;
    if (this.lastPubRho >= 700) c1weight = 10000;

    const WSPStopC1CoastQ1 = toCallables([
      () => this.variables[0].shouldBuy,
      true,
      true,
      () => this.lastPubRho < 450 || this.t < 15,
      true
    ]);
    const WSPdStopC1CoastQ1 = toCallables([
      () =>
          this.variables[0].shouldBuy && (this.variables[0].cost + l10(6 + (this.variables[0].level % 10)) <
        Math.min(this.variables[1].cost, this.variables[2].cost, this.milestones[1] > 0 ? this.variables[4].cost : Infinity)),
      true,
      true,
      () =>
        this.variables[3].cost + c1weight <
        Math.min(this.variables[1].cost, this.variables[2].cost, this.milestones[1] > 0 ? this.variables[4].cost : Infinity) || this.t < 15,
      true,
    ]);

    let conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      WSP: [true, true, true, true, true],
      WSPStopC1: [true, true, true, () => this.lastPubRho < 450 || this.t < 15, true],
      WSPStopC1Coast: WSPStopC1CoastQ1,
      WSPPTStopC1Coast: WSPStopC1CoastQ1,
      WSPPT2StopC1Coast: WSPStopC1CoastQ1,
      WSPPostRecoveryStopC1Coast: [
        () => this.maxRho <= this.lastPubRho ? WSPStopC1CoastQ1[0]() : WSPdStopC1CoastQ1[0](),
        true,
        true,
        () => this.maxRho <= this.lastPubRho ? WSPStopC1CoastQ1[3]() : WSPdStopC1CoastQ1[3](),
        true,
      ],
      WSPdStopC1: [
        () =>
          this.variables[0].cost + l10(6 + (this.variables[0].level % 10)) <
          Math.min(this.variables[1].cost, this.variables[2].cost, this.milestones[1] > 0 ? this.variables[4].cost : Infinity),
        true,
        true,
        () =>
          this.variables[3].cost + c1weight <
            Math.min(this.variables[1].cost, this.variables[2].cost, this.milestones[1] > 0 ? this.variables[4].cost : Infinity) || this.t < 15,
        true,
      ],
      WSPdStopC1Coast: WSPdStopC1CoastQ1,
      WSPdPTStopC1Coast: WSPdStopC1CoastQ1,
      WSPdPT2StopC1Coast: WSPdStopC1CoastQ1
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    return [() => true, () => true, () => true, () => true, () => this.milestones[1] > 0];
  }
  getMilestonePriority(): number[] {
    return [2, 1, 0];
  }
  srK_helper(x: number): number {
    const x2 = x * x;
    return Math.log(x2 + 1 / 6 + 1 / 120 / x2 + 1 / 810 / x2 / x2) / 2 - 1;
  };

  sineRatioK(n: number, x: number, K = 5): number {
    if (n < 1 || x >= n + 1) return 0;
    const N = n + 1 + K,
      x2 = x * x,
      L1 = this.srK_helper(N + x),
      L2 = this.srK_helper(N - x),
      L3 = this.srK_helper(N);
    let result = N * (L1 + L2 - 2 * L3) + x * (L1 - L2) - Math.log(1 - x2 / N / N) / 2;
    for (let k = n + 1; k < N; ++k) result -= Math.log(1 - x2 / k / k);
    return Math.LOG10E * result;
  };
  updateS() {
    const vn = l10(this.variables[2].value);
    const vc1 = this.variables[3].value;
    const chi = 10 ** (l10(Math.PI) + vc1 + vn - add(vc1, vn - l10(3) * this.milestones[2])) + 1;
    this.S = this.sineRatioK(this.variables[2].value, chi / Math.PI);
  }
  constructor(data: theoryData<theory>) {
    super(data, converter);
    this.q = 0;
    this.pubUnlockRho = 8;
    this.milestoneUnlocks = [10, 25, 40, 55, 70, 100, 140, 200];
    this.milestonesMax = [4, 1, 3];
    this.variables = [
      new Variable({ currency: this.rho, name: "q1", cost: new FirstFreeCost(new ExponentialCost(10, 3.38 / 4, true)), valueScaling: new StepwisePowerSumValue()}),
      new Variable({ currency: this.rho, name: "q2", cost: new ExponentialCost(1000, 3.38 * 3, true), valueScaling: new ExponentialValue(2) }),
      new Variable({ currency: this.rho, name: "n",  cost: new ExponentialCost(20, 3.38, true), valueScaling: new ExponentialValue(10) }),
      new Variable({ currency: this.rho, name: "c1", cost: new ExponentialCost(50, 3.38 / 1.5, true), valueScaling: new StepwisePowerSumValue(2, 50, 1)}),
      new Variable({ currency: this.rho, name: "c2", cost: new ExponentialCost(1e10, 3.38 * 10, true), valueScaling: new ExponentialValue(2) }),
    ];
    this.S = 0;
    this.updateS_flag = false;
    if(this.strat == "WSPdPTStopC1Coast" || this.strat == "WSPPTStopC1Coast") {
      if (this.lastPubRho < 1499)
      {
        let pubSeek = (Math.round(this.lastPubRho * 10) / 10).toFixed(4);
        let table: Record<string, pubRecord> =
            this.strat.includes("WSPd") ? activePubTable : passivePubTable;
        let nextRho = parseFloat(table[pubSeek].next);
        this.doSimEndConditions = () => false;
        this.pubConditions.push(() => this.maxRho >= nextRho);
      }
    }
    if(this.strat == "WSPdPT2StopC1Coast" || this.strat == "WSPPT2StopC1Coast") {
      if (this.lastPubRho < 1495)
      {
        let pubSeek = (Math.round(this.lastPubRho * 10) / 10).toFixed(4);
        let table: Record<string, pubRecord> =
            this.strat.includes("WSPd") ? activePubTable2 : passivePubTable2;
        let nextRho = parseFloat(table[pubSeek].next);
        this.doSimEndConditions = () => false;
        this.pubConditions.push(() => this.maxRho >= nextRho);
      }
    }

    this.simEndConditions.push(() => this.curMult > 15);
    this.updateMilestones();
  }
  async simulate() {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPubRho < 200) this.updateMilestones();
      this.buyVariables();
      if(this.variables[0].shouldFork) await this.doForkVariable(0);
      this.pubTableCollector.collectData(this);
    }
    this.trimBoughtVars();
    let extra = '';
    if(this.strat.includes("Coast")) {
      extra += this.variables[0].prepareExtraForCap(getLastLevel("q1", this.boughtVars));
    }
    return getBestResult(this.createResult(extra), this.bestForkRes);
  }
  tick() {
    if (this.updateS_flag) {
      this.updateS_flag = false;
      this.updateS();
    }

    const vq1 = this.variables[0].value * (1 + 0.01 * this.milestones[0]);

    const qdot = Math.max(0, l10(this.dt) + this.S + this.variables[4].value);

    this.q = add(this.q, qdot);

    const rhodot = this.totMult + vq1 + this.variables[1].value + this.q + l10(this.dt);
    this.rho.add(rhodot);
  }
  onVariablePurchased(id: number): void {
    if (id === 2 || id === 4) this.updateS_flag = true;
    if(
        id === 0 &&
        this.strat.includes("Coast") &&
        this.variables[id].shouldBuy &&
        this.variables[id].coastingCapReached() &&
        // For WSP: no need to go over original cap:
        !this.variables[id].aboveOriginalCap()
    ) {
      this.variables[id].shouldFork = true;
    }
  }
  copyFrom(other: this) {
    super.copyFrom(other)
    this.updateS_flag = other.updateS_flag;
    this.S = other.S;
    this.q = other.q;
  }
  copy() {
    let sim = new wspSim(this.getDataForCopy());
    sim.copyFrom(this);
    return sim;
  }
}
