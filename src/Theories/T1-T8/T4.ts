import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import {
  add,
  l10,
  subtract,
  getLastLevel,
  getR9multiplier,
  toCallables,
  getBestResult,
  defaultResult
} from "../../Utils/helpers";

export default async function t4(data: theoryData): Promise<simResult> {
  let res;
  if(!data.strat.includes("coast2")) {
    const sim = new t4Sim(data);
    res = await sim.simulate();
  }
  else {
    let data2: theoryData = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("coast2", "");
    const sim1 = new t4Sim(data2);
    const res1 = await sim1.simulate();
    const lastQ1 = getLastLevel("q1", res1.boughtVars);
    const lastQ2 = getLastLevel("q2", res1.boughtVars);
    const lastC3 = getLastLevel("c3", res1.boughtVars);
    const sim2 = new t4Sim(data);
    sim2.variables[2].setOriginalCap(lastC3);
    sim2.variables[2].configureCap(3);

    sim2.variables[6].setOriginalCap(lastQ1);
    if(data2.strat.includes("T4C3d")) {
      sim2.variables[6].configureCap(1);
    }
    else {
      sim2.variables[6].configureCap(3);
    }

    sim2.variables[7].setOriginalCap(lastQ2);
    sim2.variables[7].configureCap(1);

    res = getBestResult(await sim2.simulate(), res1);
  }
  return res;
}

type theory = "T4";

class t4Sim extends theoryClass<theory> {
  q: number;
  bestRes: simResult;

  getBuyingConditions(): conditionFunction[] {
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      T4C3d: [
        false,
        false,
        true,
        ...new Array(3).fill(false),
        () =>
            this.variables[6].cost + l10(10 + (this.variables[6].level % 10)) <= Math.min(this.variables[7].cost, this.variables[2].cost),
        () => this.curMult < 1 || this.variables[7].cost + l10(1.5) <= this.variables[2].cost,
      ],
      T4C3dcoast2: [
        false,
        false,
        () => this.variables[2].shouldBuy,
        ...new Array(3).fill(false),
        () => this.variables[6].shouldBuy &&
            (this.variables[6].cost + l10(10 + (this.variables[6].level % 10)) <= Math.min(this.variables[7].cost, this.variables[2].cost)),
        () => this.variables[7].shouldBuy && (this.curMult < 1 || this.variables[7].cost + l10(1.5) <= this.variables[2].cost),
      ],
      T4C3coast2: [
        false,
        false,
        () => this.variables[2].shouldBuy,
        ...new Array(3).fill(false),
        () => this.variables[6].shouldBuy,
        () => this.variables[7].shouldBuy,
      ],
      T4C3: [false, false, true, ...new Array(3).fill(false), true, true],
      T4C3dC12rcv: [
        () => this.variables[0].cost + 1 < this.variables[1].cost && this.maxRho < this.lastPub, 
        () => this.maxRho < this.lastPub, 
        true, 
        ...new Array(3).fill(false),
        () => this.variables[6].cost + 1 < this.variables[7].cost, 
        true
      ],
      T4C356dC12rcv: [
        () => this.variables[0].cost + 1 < this.variables[1].cost && this.maxRho < this.lastPub, 
        () => this.maxRho < this.lastPub, 
        true, 
        false, 
        true, 
        true, 
        () => this.variables[6].cost + 1 < this.variables[7].cost, 
        true
      ],
      T4C456dC12rcvMS: [
        () => this.variables[0].cost + 1 < this.variables[1].cost && this.maxRho < this.lastPub, 
        () => this.maxRho < this.lastPub, 
        false, 
        true, 
        true, 
        true, 
        () => this.variables[6].cost + 1 < this.variables[7].cost, 
        true
      ],
      T4C123d: [() => this.variables[0].cost + 1 < this.variables[1].cost, true, true, false, false, false, () => this.variables[6].cost + 1 < this.variables[7].cost, true],
      T4C123: [true, true, true, false, false, false, true, true],
      T4C12d: [() => this.variables[0].cost + 1 < this.variables[1].cost, true, ...new Array(6).fill(false)],
      T4C12: [true, true, ...new Array(6).fill(false)],
      T4C56: [...new Array(4).fill(false), true, true, true, true],
      T4C4: [...new Array(3).fill(false), true, false, false, true, true],
      T4C5: [...new Array(4).fill(false), true, false, true, true],
      T4: new Array(8).fill(true),
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability() {
    const conditions: conditionFunction[] = [
      () => true, 
      () => true, 
      () => true, 
      () => this.milestones[0] > 0, 
      () => this.milestones[0] > 1, 
      () => this.milestones[0] > 2, 
      () => true, 
      () => true
    ];
    return conditions;
  }
  getTotMult(val: number): number {
    return Math.max(0, val * 0.165 - l10(4)) + getR9multiplier(this.sigma);
  }
  getMilestonePriority(): number[] {
    switch (this.strat) {
      case "T4C3d": return [2];
      case "T4C3coast2": return [2];
      case "T4C3dcoast2": return [2];
      case "T4C3": return [2];
      case "T4C3dC12rcv": return [1, 2];
      case "T4C356dC12rcv": return [1, 2, 0];
      case "T4C456dC12rcvMS": {
        if (this.maxRho < this.lastPub) return [1, 2, 0]
        else if (this.t % 100 < 50) return [2, 0, 1] 
        else return [0, 2, 1];
      }
      case "T4C123d": return [1, 2];
      case "T4C123": return [1, 2];
      case "T4C12d": return [1];
      case "T4C12": return [1];
      case "T4C56": return [0, 2];
      case "T4C4": {
        this.milestonesMax = [1, 0, 3];
        return [0, 2];
      }
      case "T4C5": {
        this.milestonesMax = [2, 0, 3];
        return [0, 2];
      }
      case "T4": return [0, 2, 1];
    }
  }
  constructor(data: theoryData) {
    super(data);
    this.bestRes = defaultResult();
    this.q = 0;
    this.pubUnlock = 9;
    this.milestoneUnlockSteps = 25;
    //milestones  [terms, c1exp, multQdot]
    this.milestonesMax = [3, 1, 3];
    this.variables = [
      new Variable({ name: "c1", cost: new FirstFreeCost(new ExponentialCost(5, 1.305)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "c2", cost: new ExponentialCost(20, 3.75), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c3", cost: new ExponentialCost(2000, 2.468), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c4", cost: new ExponentialCost(1e4, 4.85), valueScaling: new ExponentialValue(3) }),
      new Variable({ name: "c5", cost: new ExponentialCost(1e8, 12.5), valueScaling: new ExponentialValue(5) }),
      new Variable({ name: "c6", cost: new ExponentialCost(1e10, 58), valueScaling: new ExponentialValue(10) }),
      new Variable({ name: "q1", cost: new ExponentialCost(1e3, 100), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "q2", cost: new ExponentialCost(1e4, 1000), valueScaling: new ExponentialValue(2) }),
    ];
    this.updateMilestones();
  }
  async simulate(): Promise<simResult> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 176) this.updateMilestones();
      this.buyVariables();
      if(this.variables[6].shouldFork) await this.doForkVariable(6);
      if(this.variables[7].shouldFork) await this.doForkVariable(7);
      if(this.variables[2].shouldFork) await this.doForkVariable(2);
    }
    this.trimBoughtVars();
    let stratExtra = '';
    if(this.strat.includes("coast2")) {
      stratExtra = this.variables[6].prepareExtraForCap(getLastLevel("q1", this.boughtVars)) +
          this.variables[7].prepareExtraForCap(getLastLevel("q2", this.boughtVars)) +
          this.variables[2].prepareExtraForCap(getLastLevel("c3", this.boughtVars));
    }
    return getBestResult(this.createResult(stratExtra), this.bestRes);
  }
  tick() {
    const vq1 = this.variables[6].value;
    const vq2 = this.variables[7].value;

    const p = add(this.q, 0) * 2
    this.q = subtract(add(p, l10(2) * (1 + this.milestones[2]) + vq1 + vq2 + l10(this.dt)) / 2, 0)

    const vc1 = this.variables[0].value * (1 + 0.15 * this.milestones[1]);
    const vc2 = this.variables[1].value;
    let variableSum = vc1 + vc2;
    variableSum = add(variableSum, this.variables[2].value + this.q);
    if (this.milestones[0] >= 1) variableSum = add(variableSum, this.variables[3].value + this.q * 2);
    if (this.milestones[0] >= 2) variableSum = add(variableSum, this.variables[4].value + this.q * 3);
    if (this.milestones[0] >= 3) variableSum = add(variableSum, this.variables[5].value + this.q * 4);

    const rhodot = this.totMult + variableSum;
    this.rho.add(rhodot + l10(this.dt));
  }

  async doForkVariable(id: number) {
    const fork = this.copy();
    fork.variables[id].stopBuying();
    fork.variables[id].shouldFork = false;
    const res = await fork.simulate();
    this.bestRes = getBestResult(res, this.bestRes);
    this.variables[id].shouldFork = false;
  }

  onVariablePurchased(id: number) {
    if(
        [2, 6, 7].includes(id) &&
        this.strat.includes("coast2") &&
        this.variables[id].shouldBuy &&
        this.variables[id].coastingCapReached() &&
        // For this strat, there is almost never use to get levels above cap. We can skip simming that for faster sim:
        !this.variables[id].aboveOriginalCap()
    ) {
      this.variables[id].shouldFork = true;
    }
  }

  copyFrom(other: this) {
    super.copyFrom(other);
    this.q = other.q;
    this.bestRes = other.bestRes;
  }
  copy() {
    let newsim = new t4Sim(super.getDataForCopy());
    newsim.copyFrom(this);
    return newsim;
  }
}
