import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Currency from "../../Utils/currency";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add_old, l10, getR9multiplier, toCallables, getLastLevel, getBestResult } from "../../Utils/helpers";

export default async function t7(data: theoryData): Promise<simResult> {
  let res;
  if(data.strat.includes("Coast")) {
    let data2: theoryData = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("Coast", "");
    const sim1 = new t7Sim(data2);
    const res1 = await sim1.simulate();
    const sim2 = new t7Sim(data);

    const lastQ1 = getLastLevel("q1", res1.boughtVars);
    sim2.variables[0].setOriginalCap(lastQ1);
    sim2.variables[0].configureCap(13);
    const lastC6 = getLastLevel("c6", res1.boughtVars);
    sim2.variables[6].setOriginalCap(lastC6);
    sim2.variables[6].configureCap(1);

    res = await sim2.simulate();
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
  drho13: number;
  drho23: number;
  c2ratio: number;

  getBuyingConditions(): conditionFunction[] {
    const q1CoastCond = () => this.variables[0].shouldBuy;
    const c6CoastCond = () => this.variables[6].shouldBuy;
    if (this.lastPub >= 100) this.c2ratio = 100;
    if (this.lastPub >= 175) this.c2ratio = 10;
    if (this.lastPub >= 250) this.c2ratio = 20;
    if (this.lastPub >= 275) this.c2ratio = 50;
    if (this.lastPub >= 300) this.c2ratio = Infinity;
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      T7: [true, true, true, true, true, true, true],
      T7Coast: [q1CoastCond, true, true, true, true, true, c6CoastCond],
      T7C12: [true, true, true, false, false, false, false],
      T7C12Coast: [q1CoastCond, true, true, false, false, false, false],
      T7C3: [true, false, false, true, false, false, false],
      T7C3Coast: [q1CoastCond, false, false, true, false, false, false],
      T7noC12: [true, false, false, true, true, true, true],
      T7noC12Coast: [q1CoastCond, false, false, true, true, true, c6CoastCond],
      T7noC123: [true, false, false, false, true, true, true],
      T7noC123Coast: [q1CoastCond, false, false, false, true, true, c6CoastCond],
      T7noC1234: [true, false, false, false, false, true, true],
      T7noC1234Coast: [q1CoastCond, false, false, false, false, true, c6CoastCond],
      T7C12d: [() => this.variables[0].cost + 1 < this.variables[2].cost, () => this.variables[1].cost + l10(8) < this.variables[2].cost, true, false, false, false, false],
      T7C12dCoast: [() => q1CoastCond() && (this.variables[0].cost + 1 < this.variables[2].cost), () => this.variables[1].cost + l10(8) < this.variables[2].cost, true, false, false, false, false],
      T7C3d: [() => this.variables[0].cost + 1 < this.variables[3].cost, false, false, true, false, false, false],
      T7C3dCoast: [() => q1CoastCond() && (this.variables[0].cost + 1 < this.variables[3].cost), false, false, true, false, false, false],
      T7PlaySpqcey: [
        () => this.variables[0].cost + l10(4) < this.variables[6].cost,
        () => this.variables[1].cost + l10(10 + this.variables[2].level) < this.variables[2].cost,
        () => this.variables[2].cost + l10(this.c2ratio) < this.variables[6].cost,
        () => this.variables[3].cost + 1 < this.variables[6].cost,
        () => this.variables[4].cost + 1 < this.variables[6].cost,
        () => this.variables[5].cost + l10(4) < this.variables[6].cost,
        true,
      ],
      T7PlaySpqceyCoast: [
        () => q1CoastCond() && (this.variables[0].cost + l10(4) < this.variables[6].cost),
        () => this.variables[1].cost + l10(10 + this.variables[2].level) < this.variables[2].cost,
        () => this.variables[2].cost + l10(this.c2ratio) < this.variables[6].cost,
        () => this.variables[3].cost + 1 < this.variables[6].cost,
        () => this.variables[4].cost + 1 < this.variables[6].cost,
        () => this.variables[5].cost + l10(4) < this.variables[6].cost,
        c6CoastCond,
      ],
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    return [
      () => true,
      () => true,
      () => true,
      () => this.milestones[1] > 0,
      () => this.milestones[0] > 0,
      () => this.milestones[2] > 0,
      () => this.milestones[3] > 0,
    ];
  }
  getMilestonePriority(): number[] {
    switch (this.strat) {
      case "T7": case "T7Coast": return [1, 0, 2, 3, 4];
      case "T7C12": case "T7C12Coast": return [4];
      case "T7C3": case "T7C3Coast": return [1];
      case "T7noC12": case "T7noC12Coast": return [1, 0, 2, 3];
      case "T7noC123": case "T7noC123Coast": return [0, 2, 3];
      case "T7noC1234": case "T7noC1234Coast": return [0, 2, 3];
      case "T7C12d": case "T7C12dCoast": return [4];
      case "T7C3d": case "T7C3dCoast": return [1];
      case "T7PlaySpqcey": case "T7PlaySpqceyCoast": return [1, 0, 2, 3, 4];
    }
  }
  getTotMult(val: number): number {
    return Math.max(0, val * 0.152) + getR9multiplier(this.sigma);
  }
  constructor(data: theoryData) {
    super(data);
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
      if(this.variables[0].shouldFork) await this.doForkVariable(0);
      if(this.variables[6].shouldFork) await this.doForkVariable(6);
    }
    this.trimBoughtVars()
    let stratExtra = this.strat.includes("T7PlaySpqcey") && this.c2ratio !== Infinity ? this.c2ratio.toString() : "";
    if(this.strat.includes("Coast")) {
      stratExtra += this.variables[0].prepareExtraForCap(getLastLevel("q1", this.boughtVars));
      if(this.variables[6].level !== 0) {
        stratExtra += this.variables[6].prepareExtraForCap(getLastLevel("c6", this.boughtVars));
      }
    }
    return getBestResult(this.createResult(stratExtra), this.bestForkRes);
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
  onVariablePurchased(id: number) {
    if(
        (id === 0 || id === 6) &&
        this.strat.includes("Coast") &&
        this.variables[id].shouldBuy &&
        this.variables[id].coastingCapReached()
        // (this.variables[id].underOriginalCap() || this.maxRho >= 1000)
    ) {
      this.variables[id].shouldFork = true;
    }
  }

  copy() {
    let copySim = new t7Sim(this.getDataForCopy());
    copySim.copyFrom(this);
    return copySim;
  }
  copyFrom(other: this) {
    super.copyFrom(other);
    this.rho2 = other.rho2.copy();
    this.drho13 = other.drho13;
    this.drho23 = other.drho23;
    this.c2ratio = other.c2ratio;
  }
}
