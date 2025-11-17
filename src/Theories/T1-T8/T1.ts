import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, logToExp, getR9multiplier, toCallables, getLastLevel } from "../../Utils/helpers";

async function runT1CoastQ1(data: theoryData, targetQ1: number, origQ1: number): Promise<simResult> {
  const sim = new t1Sim(data);
  sim.lastQ1 = targetQ1;
  sim.lastQ1Orig = origQ1;
  return sim.simulate();
}

export default async function t1(data: theoryData): Promise<simResult> {
  let res;
  if(data.strat.includes("CoastQ1")) {
    let data2: theoryData = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("CoastQ1", "");
    const sim1 = new t1Sim(data2);
    const res1 = await sim1.simulate();
    const lastQ1 = getLastLevel("q1", res1.boughtVars);
    res = await runT1CoastQ1(data, lastQ1 - 1, lastQ1);
    let limit = 19;
    let start = 2;
    for(let i = start; i < limit; i++) {
      if(lastQ1 - i <= 1) {
        break;
      }
      const resN = await runT1CoastQ1(data, lastQ1 - i, lastQ1);
      if(resN.tauH > res.tauH) {
        res = resN;
      }
    }
  }
  else {
    const sim = new t1Sim(data);
    res = await sim.simulate();
  }
  return res;
}

type theory = "T1";

class t1Sim extends theoryClass<theory> {
  lastQ1: number;
  lastQ1Orig: number;
  term1: number;
  term2: number;
  term3: number;
  termRatio: number;
  c3Ratio: number;

  getBuyingConditions(): conditionFunction[] {
    const q1CoastCond = () => this.variables[0].level < this.lastQ1;
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      T1: new Array(6).fill(true),
      T1CoastQ1: [
        q1CoastCond,
        true,
        true,
        true,
        true,
        true,
      ],
      T1C34: [true, true, false, false, true, true],
      T1C34CoastQ1: [q1CoastCond, true, false, false, true, true],
      T1C4: [true, true, false, false, false, true],
      T1C4CoastQ1: [q1CoastCond, true, false, false, false, true],
      T1Ratio: [
        () => this.variables[0].cost + 1 < this.rho.value, // q1
        () => this.variables[1].cost + l10(1.11) < this.rho.value,
        () => this.variables[2].cost + this.termRatio + 1 <= this.rho.value,
        () => this.variables[3].cost + this.termRatio <= this.rho.value,
        () => this.variables[4].cost + l10(this.c3Ratio) < this.rho.value,
        true,
      ],
      T1RatioCoastQ1: [
        () => q1CoastCond() && (this.variables[0].cost + 1 < this.rho.value), // q1
        () => this.variables[1].cost + l10(1.11) < this.rho.value,
        () => this.variables[2].cost + this.termRatio + 1 <= this.rho.value,
        () => this.variables[3].cost + this.termRatio <= this.rho.value,
        () => this.variables[4].cost + l10(this.c3Ratio) < this.rho.value,
        true,
      ],
      T1SolarXLII: [
        () => // q1
          this.variables[0].cost + l10(5) <= this.rho.value &&
          this.variables[0].cost + l10(6 + (this.variables[0].level % 10)) <= this.variables[1].cost &&
          this.variables[0].cost + l10(15 + (this.variables[0].level % 10)) < (this.milestones[3] > 0 ? this.variables[5].cost : 1000),
        () => this.variables[1].cost + l10(1.11) < this.rho.value,
        () => this.variables[2].cost + this.termRatio + 1 <= this.rho.value,
        () => this.variables[3].cost + this.termRatio <= this.rho.value,
        () => this.variables[4].cost + l10(this.c3Ratio) < this.rho.value,
        true,
      ],
      T1SolarXLIICoastQ1: [
        () => // q1
            q1CoastCond() && (this.variables[0].cost + l10(5) <= this.rho.value &&
            this.variables[0].cost + l10(6 + (this.variables[0].level % 10)) <= this.variables[1].cost &&
            this.variables[0].cost + l10(15 + (this.variables[0].level % 10)) < (this.milestones[3] > 0 ? this.variables[5].cost : 1000)),
        () => this.variables[1].cost + l10(1.11) < this.rho.value,
        () => this.variables[2].cost + this.termRatio + 1 <= this.rho.value,
        () => this.variables[3].cost + this.termRatio <= this.rho.value,
        () => this.variables[4].cost + l10(this.c3Ratio) < this.rho.value,
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
      () => true, 
      () => this.milestones[2] > 0, 
      () => this.milestones[3] > 0
    ];
    return conditions;
  }
  getMilestonePriority(): number[] {
    return [2, 3, 0, 1];
  }
  getTotMult(val: number): number {
    return Math.max(0, val * 0.164 - l10(3)) + getR9multiplier(this.sigma);
  }
  constructor(data: theoryData) {
    super(data);
    this.lastQ1 = -1;
    this.lastQ1Orig = -1;
    this.pubUnlock = 10;
    this.milestoneUnlockSteps = 25;
    //milestones  [logterm, c1exp, c3term, c4term]
    this.milestonesMax = [1, 3, 1, 1];
    this.variables = [
      new Variable({ name: "q1", cost: new FirstFreeCost(new ExponentialCost(5, 2)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "q2", cost: new ExponentialCost(100, 10), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c1", cost: new ExponentialCost(15, 2), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ name: "c2", cost: new ExponentialCost(3000, 10), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c3", cost: new ExponentialCost(1e4, 4.5 * Math.log2(10), true), valueScaling: new ExponentialValue(10) }),
      new Variable({ name: "c4", cost: new ExponentialCost(1e10, 8 * Math.log2(10), true), valueScaling: new ExponentialValue(10) }),
    ];
    //values of the different terms, so they are accesible for variable buying conditions
    this.term1 = 0;
    this.term2 = 0;
    this.term3 = 0;
    this.termRatio = 0;
    this.c3Ratio = this.lastPub < 300 ? 1 : this.lastPub < 450 ? 1.1 : this.lastPub < 550 ? 2 : this.lastPub < 655 ? 5 : 10;

    this.doSimEndConditions = () => !this.strat.includes("T1SolarXLII");
    this.updateMilestones();
  }
  async simulate(): Promise<simResult> {
    const c4_nc = Math.ceil((this.lastPub - 10) / 8) * 8 + 10;
    const pub = c4_nc - this.lastPub < 3 ? c4_nc + 2 : c4_nc - this.lastPub < 5 ? c4_nc - 2 + l10(1.5) : c4_nc - 4 + l10(1.4);
    let coast = (c4_nc - this.lastPub < 3 ? c4_nc : Math.floor(this.lastPub)) + l10(30);
    coast = Math.max(8 + l10(30), coast + Math.floor(pub - coast));
    if (this.strat.includes("T1SolarXLII")) {
      this.pubConditions.push(() => this.maxRho >= pub)
    }
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 176) this.updateMilestones();
      if (!this.strat.includes("T1SolarXLII") || this.rho.value < coast) this.buyVariables();
    }
    this.trimBoughtVars();
    let stratExtra = this.strat.includes("T1SolarXLII") ? ` ${this.lastPub < 50 ? "" : logToExp(Math.min(this.pubRho, coast), 2)}` : "";
    if(this.strat.includes("CoastQ1")) {
      stratExtra += ` q1: ${this.lastQ1}`;
      // stratExtra += ` q1delta: ${this.lastQ1Orig - this.lastQ1}`
    }
    return this.createResult(stratExtra);
  }
  tick() {
    this.term1 = this.variables[2].value * (1 + 0.05 * this.milestones[1]) 
      + this.variables[3].value 
      + (this.milestones[0] > 0 ? l10(1 + Math.max(this.rho.value, 0) / Math.LOG10E / 100) : 0);
    this.term2 = add(this.variables[4].value + this.rho.value * 0.2, this.variables[5].value + this.rho.value * 0.3);
    this.term3 = this.variables[0].value + this.variables[1].value;

    const rhodot = add(this.term1, this.term2) + this.term3 + this.totMult + l10(this.dt);
    this.rho.add(rhodot);
  }
  onAnyVariablePurchased(): void {
    this.termRatio = this.lastPub < 350 ? Math.max(l10(5), (this.term2 - this.term1) * Number(this.milestones[3] > 0)) : Infinity;
  }
}