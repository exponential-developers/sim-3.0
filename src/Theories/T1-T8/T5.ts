import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import {
  l10,
  subtract,
  logToExp,
  getR9multiplier,
  toCallable,
  toCallables,
  getLastLevel,
  getBestResult
} from "../../Utils/helpers";

export default async function t5(data: theoryData): Promise<simResult> {
  let res;
  if(data.strat.includes("Coast")) {
    let data2: theoryData = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("Coast2", "").replace("Coast", "");
    const sim1 = new t5Sim(data2);
    const res1 = await sim1.simulate();
    const lastQ1 = getLastLevel("q1", res1.boughtVars);
    // Directly take the level from the sim thanks to how condition is constructed in T5Idle. It will not buy any levels
    // above max.
    const lastC1 = sim1.variables[2].level;
    const sim2 = new t5Sim(data);
    sim2.variables[0].setOriginalCap(lastQ1);
    sim2.variables[0].configureCap(13);
    if(data.strat.includes("Coast2")) {
      sim2.variables[2].setOriginalCap(lastC1 + 10); // Lie to the strat that there is more level of C1 that were bought
      sim2.variables[2].configureCap(15); // Also test up to 5 levels below original.
    }
    res = await sim2.simulate();
  }
  else {
    const sim = new t5Sim(data);
    res = await sim.simulate();
  }
  return res;
}

type theory = "T5";

class t5Sim extends theoryClass<theory> {
  q: number;
  c2worth: boolean;
  c2Counter: number;
  nc3: number;

  getBuyingConditions(): conditionFunction[] {
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      T5: [true, true, true, true, true],
      T5Idle: [
        true, 
        true, 
        () => this.maxRho + (this.lastPub - 200) / 165 < this.lastPub, 
        () => this.c2worth, 
        true
      ],
      T5IdleCoast: [
        () => this.variables[0].shouldBuy,
        true,
        () => this.maxRho + (this.lastPub - 200) / 165 < this.lastPub,
        () => this.c2worth,
        true
      ],
      T5IdleCoast2: [
        () => this.variables[0].shouldBuy,
        true,
        () => this.variables[2].shouldBuy,
        () => this.c2worth,
        true
      ],
      T5AI2: [
        () => this.variables[0].cost + l10(3 + (this.variables[0].level % 10)) 
          <= Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[4].cost : 1000),
        true,
        () => this.q + l10(1.5) < this.variables[3].value + this.variables[4].value * (1 + 0.05 * this.milestones[2]) || !this.c2worth,
        () => this.c2worth,
        true,
      ],
      T5AI2Coast: [
        () => this.variables[0].shouldBuy && (this.variables[0].cost + l10(3 + (this.variables[0].level % 10))
            <= Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[4].cost : 1000)),
        true,
        () => this.q + l10(1.5) < this.variables[3].value + this.variables[4].value * (1 + 0.05 * this.milestones[2]) || !this.c2worth,
        () => this.c2worth,
        true,
      ],
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    return [() => true, () => true, () => true, () => true, () => this.milestones[1] > 0];
  }
  getMilestonePriority(): number[] {
    return [1, 0, 2];
  }
  getTotMult(val: number): number {
    return Math.max(0, val * 0.159) + getR9multiplier(this.sigma);
  }
  /** Solves q using the differential equation result */
  calculateQ(ic1: number, ic2: number, ic3: number): number{
    const qcap = ic2 + ic3
    const gamma = 10 ** (ic1 + ic3 - ic2) // q growth speed characteristic parameter
    const adjust = this.q - subtract(qcap, this.q); // initial condition
    const sigma = 10 ** (adjust + gamma * this.dt * l10(Math.E)) 
    let newq: number;
    // Approximation when q << qcap
    if (sigma < 1e-30){
      newq = qcap + adjust + gamma * this.dt * l10(Math.E);
    }
    // Normal resolution
    else {
      newq = qcap - l10(1 + 1 / sigma);
    }
    return Math.min(newq, qcap)
  }
  constructor(data: theoryData) {
    super(data);
    this.q = 0;
    this.pubUnlock = 7;
    this.milestoneUnlockSteps = 25;
    //milestones  [q1exp,c3term,c3exp]
    this.milestonesMax = [3, 1, 2];
    this.variables = [
      new Variable({ name: "q1", cost: new FirstFreeCost(new ExponentialCost(10, 1.61328)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "q2", cost: new ExponentialCost(15, 64), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c1", cost: new ExponentialCost(1e6, 1.18099), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ name: "c2", cost: new ExponentialCost(75, 4.53725), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c3", cost: new ExponentialCost(1e3, 8.85507e7), valueScaling: new ExponentialValue(2) }),
    ];
    this.c2worth = true;
    this.c2Counter = 0;
    this.nc3 = 0;
    this.updateMilestones();
  }
  async simulate(): Promise<simResult> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 150) this.updateMilestones();
      this.c2Counter = 0;
      this.buyVariables();
      if(this.variables[0].shouldFork) await this.doForkVariable(0);
      if(this.variables[2].shouldFork) await this.doForkVariable(2);
    }
    this.trimBoughtVars();
    let stratExtra = ["T5Idle", "T5IdleCoast"].includes(this.strat) ? " " + logToExp(this.variables[2].cost, 1) : "";
    if(this.strat.includes("Coast")) {
      stratExtra += this.variables[0].prepareExtraForCap(getLastLevel("q1", this.boughtVars))
      if(this.strat.includes("Coast2")) {
        stratExtra += this.variables[2].prepareExtraForCap(getLastLevel("c1", this.boughtVars)) // rely on variables[2].level in this case.
      }
    }
    return getBestResult(this.createResult(stratExtra), this.bestForkRes);
  }
  tick() {
    const vq1 = this.variables[0].value * (1 + 0.05 * this.milestones[0]);
    const vc3 = this.milestones[1] > 0 ? this.variables[4].value * (1 + 0.05 * this.milestones[2]) : 0;

    this.q = this.calculateQ(this.variables[2].value, this.variables[3].value, vc3);
    const rhodot = vq1 + this.variables[1].value + this.q;
    this.rho.add(rhodot + this.totMult + l10(this.dt));

    this.nc3 = this.milestones[1] > 0 ? this.variables[4].value * (1 + 0.05 * this.milestones[2]) : 0;
    const iq = this.calculateQ(this.variables[2].value, this.variables[3].value, this.nc3);
    this.c2worth = iq >= this.variables[3].value + this.nc3 + l10(2 / 3);
  }
  onVariablePurchased(id: number): void {
    if (id == 3) {
      this.c2Counter++;
      const iq = this.calculateQ(this.variables[2].value, this.variables[3].value + l10(2) * this.c2Counter, this.nc3);
      this.c2worth = iq >= this.variables[3].value + l10(2) * this.c2Counter + this.variables[4].value * (1 + 0.05 * this.milestones[2]) + l10(2 / 3);
    }
    if(
        id == 0 &&
        this.strat.includes("Coast") &&
        this.variables[id].shouldBuy &&
        this.variables[id].coastingCapReached()
    ) {
      this.variables[id].shouldFork = true;
    }
    if(
        id == 2 &&
        this.strat.includes("Coast2") &&
        this.variables[id].shouldBuy &&
        this.variables[id].coastingCapReached()
    ) {
      if(this.variables[id].level < this.variables[id].originalCap + 21) {
        this.variables[id].shouldFork = true;
      }
      else {
        this.variables[id].stopBuying();
      }
    }
  }
  copyFrom(other: this) {
    super.copyFrom(other);
    this.q = other.q;
    this.nc3 = other.nc3;
    this.c2worth = other.c2worth;
    this.c2Counter = other.c2Counter;
  }
  copy() {
    let copySim = new t5Sim(this.getDataForCopy());
    copySim.copyFrom(this);
    return copySim;
  }
}
