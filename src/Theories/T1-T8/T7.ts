import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Currency from "../../Utils/currency";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add_old, l10, getR9multiplier, toCallables, getLastLevel } from "../../Utils/helpers";

async function runT7CoastQ1(data: theoryData, targetQ1: number, origQ1: number): Promise<simResult> {
  const sim = new t7Sim(data);
  sim.lastQ1 = targetQ1;
  sim.lastQ1Orig = origQ1;
  return sim.simulate();
}

export default async function t7(data: theoryData): Promise<simResult> {
  let res;
  if(data.strat.includes("CoastQ1")) {
    let data2: theoryData = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("CoastQ1", "");
    const sim1 = new t7Sim(data2);
    const res1 = await sim1.simulate();
    const lastQ1 = getLastLevel("q1", res1.boughtVars);
    res = await runT7CoastQ1(data, lastQ1 - 1, lastQ1);
    let limit = 14;
    let start = 2;
    for(let i = start; i < limit; i++) {
      if(lastQ1 - i <= 1) {
        break;
      }
      const resN = await runT7CoastQ1(data, lastQ1 - i, lastQ1);
      if(resN.tauH > res.tauH) {
        res = resN;
      }
    }
  }
  else {
    const sim = new t7Sim(data);
    res = await sim.simulate();
  }

  return res;
}

type theory = "T7";

const add = add_old;

class t7Sim extends theoryClass<theory> {
  rho2: Currency;
  lastQ1: number;
  lastQ1Orig: number;
  drho13: number;
  drho23: number;
  c2ratio: number;

  getBuyingConditions(): conditionFunction[] {
    const q1CoastCond = () => this.variables[0].level < this.lastQ1;
    if (this.lastPub >= 100) this.c2ratio = 100;
    if (this.lastPub >= 175) this.c2ratio = 10;
    if (this.lastPub >= 250) this.c2ratio = 20;
    if (this.lastPub >= 275) this.c2ratio = 50;
    if (this.lastPub >= 300) this.c2ratio = Infinity;
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      T7: [true, true, true, true, true, true, true],
      T7CoastQ1: [q1CoastCond, true, true, true, true, true, true],
      T7C12: [true, true, true, false, false, false, false],
      T7C12CoastQ1: [q1CoastCond, true, true, false, false, false, false],
      T7C3: [true, false, false, true, false, false, false],
      T7C3CoastQ1: [q1CoastCond, false, false, true, false, false, false],
      T7noC12: [true, false, false, true, true, true, true],
      T7noC12CoastQ1: [q1CoastCond, false, false, true, true, true, true],
      T7noC123: [true, false, false, false, true, true, true],
      T7noC123CoastQ1: [q1CoastCond, false, false, false, true, true, true],
      T7noC1234: [true, false, false, false, false, true, true],
      T7noC1234CoastQ1: [q1CoastCond, false, false, false, false, true, true],
      T7C12d: [() => this.variables[0].cost + 1 < this.variables[2].cost, () => this.variables[1].cost + l10(8) < this.variables[2].cost, true, false, false, false, false],
      T7C12dCoastQ1: [() => q1CoastCond() && (this.variables[0].cost + 1 < this.variables[2].cost), () => this.variables[1].cost + l10(8) < this.variables[2].cost, true, false, false, false, false],
      T7C3d: [() => this.variables[0].cost + 1 < this.variables[3].cost, false, false, true, false, false, false],
      T7C3dCoastQ1: [() => q1CoastCond() && (this.variables[0].cost + 1 < this.variables[3].cost), false, false, true, false, false, false],
      T7PlaySpqcey: [
        () => this.variables[0].cost + l10(4) < this.variables[6].cost,
        () => this.variables[1].cost + l10(10 + this.variables[2].level) < this.variables[2].cost,
        () => this.variables[2].cost + l10(this.c2ratio) < this.variables[6].cost,
        () => this.variables[3].cost + 1 < this.variables[6].cost,
        () => this.variables[4].cost + 1 < this.variables[6].cost,
        () => this.variables[5].cost + l10(4) < this.variables[6].cost,
        true,
      ],
      T7PlaySpqceyCoastQ1: [
        () => q1CoastCond() && (this.variables[0].cost + l10(4) < this.variables[6].cost),
        () => this.variables[1].cost + l10(10 + this.variables[2].level) < this.variables[2].cost,
        () => this.variables[2].cost + l10(this.c2ratio) < this.variables[6].cost,
        () => this.variables[3].cost + 1 < this.variables[6].cost,
        () => this.variables[4].cost + 1 < this.variables[6].cost,
        () => this.variables[5].cost + l10(4) < this.variables[6].cost,
        true,
      ],
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = [
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
  getMilestonePriority(): number[] {
    switch (this.strat) {
      case "T7": case "T7CoastQ1": return [1, 0, 2, 3, 4];
      case "T7C12": case "T7C12CoastQ1": return [4];
      case "T7C3": case "T7C3CoastQ1": return [1];
      case "T7noC12": case "T7noC12CoastQ1": return [1, 0, 2, 3];
      case "T7noC123": case "T7noC123CoastQ1": return [0, 2, 3];
      case "T7noC1234": case "T7noC1234CoastQ1": return [0, 2, 3];
      case "T7C12d": case "T7C12dCoastQ1": return [4];
      case "T7C3d": case "T7C3dCoastQ1": return [1];
      case "T7PlaySpqcey": case "T7PlaySpqceyCoastQ1": return [1, 0, 2, 3, 4];
    }
  }
  getTotMult(val: number): number {
    return Math.max(0, val * 0.152) + getR9multiplier(this.sigma);
  }
  constructor(data: theoryData) {
    super(data);
    this.lastQ1 = -1;
    this.lastQ1Orig = -1;
    this.rho2 = new Currency;
    this.pubUnlock = 10;
    this.milestoneUnlockSteps = 25;
    this.milestonesMax = [1, 1, 1, 1, 3];
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
    this.updateMilestones();
  }
  async simulate(): Promise<simResult> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 175) this.updateMilestones();
      this.buyVariables();
    }
    this.trimBoughtVars()
    let stratExtra = this.strat.includes("T7PlaySpqcey") && this.c2ratio !== Infinity ? this.c2ratio.toString() : "";
    if(this.strat.includes("CoastQ1")) {
      stratExtra += ` q1: ${this.lastQ1}`;
      // stratExtra += ` q1delta: ${this.lastQ1Orig - this.lastQ1}`;
    }
    return this.createResult(stratExtra);
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
