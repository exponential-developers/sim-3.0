import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, getR9multiplier, toCallables, getBestResult, defaultResult } from "../../Utils/helpers";

export default async function t2(data: theoryData): Promise<simResult> {
  let bestSim: t2Sim;
  let bestSimRes: simResult;
  if(data.strat == "T2Haxolotl") {
    const savedStrat = data.strat;
    data.strat = "T2MC";
    let t2mcRes = await new t2Sim(data).simulate();
    data.strat = savedStrat;
    let possibleStopPoints = [
        [3700, 2650, 1700, 750],
        [4650, 2900, 2250, 1150],
        [3500, 2700, 2050, 550]
    ]
    let cToTry = [
        1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3
    ];
    let c1ToTry = [
      1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5
    ]
    let bestRes = defaultResult();
    for(let c1 of c1ToTry) {
      for(let c2 of cToTry) {
        for(let c3 of cToTry) {
          for (let stopPoints of possibleStopPoints) {
            let sim = new t2Sim(data);
            sim.haxolotlC1 = c1;
            sim.haxolotlC2 = c2;
            sim.haxolotlC3 = c3;
            sim.stop4 = stopPoints[3]
            sim.stop3 = stopPoints[2]
            sim.stop2 = stopPoints[1]
            sim.stop1 = stopPoints[0]
            sim.targetRho = t2mcRes.pubRho;
            bestRes = getBestResult(await sim.simulate(), bestRes);
          }
        }
      }
    }
    bestSimRes = bestRes;
  }
  else if(data.strat == "T2MCAlt2" || data.strat == "T2MCAlt3") {
    const savedStrat = data.strat;
    data.strat = "T2MC";
    let res = await new t2Sim(data).simulate();

    data.strat = savedStrat;
    if(savedStrat == "T2MCAlt2") {
      bestSim = new t2Sim(data);
      bestSim.targetRho = res.pubRho;
      bestSimRes = await bestSim.simulate();
    }
    else {
      bestSim = new t2Sim(data);
      bestSim.stop4 = 750;
      bestSim.stop3 = 1700;
      bestSim.stop2 = 2650;
      bestSim.stop1 = 3700;
      bestSim.targetRho = res.pubRho;
      bestSimRes = await bestSim.simulate();
    }
  }
  else {
    bestSim = new t2Sim(data);
    bestSimRes = await bestSim.simulate();
  }
  return bestSimRes;
}

type theory = "T2";

class t2Sim extends theoryClass<theory> {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  haxolotlC1: number;
  haxolotlC2: number;
  haxolotlC3: number;
  targetRho: number;
  stop4: number;
  stop3: number;
  stop2: number;
  stop1: number;

  getBuyingConditions(): conditionFunction[] {
    const getMax = (index: number): number => {
      let max = -1;
      while(index >= 0) {
        max = Math.max(max, this.variables[index].cost, this.variables[4 + index].cost);
        index--;
      }
      return max;
    }
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      T2: new Array(8).fill(true),
      T2MC: [
        () => this.curMult < 4650,
        () => this.curMult < 2900,
        () => this.curMult < 2250,
        () => this.curMult < 1150,
        () => this.curMult < 4650,
        () => this.curMult < 2900,
        () => this.curMult < 2250,
        () => this.curMult < 1150,
      ],
      T2MCAlt: [
        () => this.curMult < 3500,
        () => this.curMult < 2700,
        () => this.curMult < 2050,
        () => this.curMult < 550,
        () => this.curMult < 3500,
        () => this.curMult < 2700,
        () => this.curMult < 2050,
        () => this.curMult < 550,
      ],
      T2MCAlt2: [
        () => this.curMult < 3500,
        () => this.curMult < 2700,
        () => this.curMult < 2050,
        () => this.curMult < 550,
        () => this.curMult < 3500,
        () => this.curMult < 2700,
        () => this.curMult < 2050,
        () => this.curMult < 550,
      ],
      T2MCAlt3: [
        () => this.curMult < this.stop1,
        () => this.curMult < this.stop2,
        () => this.curMult < this.stop3,
        () => this.curMult < this.stop4,
        () => this.curMult < this.stop1,
        () => this.curMult < this.stop2,
        () => this.curMult < this.stop3,
        () => this.curMult < this.stop4,
      ],
      T2Haxolotl: [
        () => this.curMult < this.stop1,
        () => (this.variables[1].cost + l10(this.haxolotlC1) < getMax(0)) && this.curMult < this.stop2,
        () => (this.variables[2].cost + l10(this.haxolotlC2) < getMax(1)) && this.curMult < this.stop3,
        () => (this.variables[3].cost + l10(this.haxolotlC3) < getMax(2)) && this.curMult < this.stop4,
        () => this.curMult < this.stop1,
        () => (this.variables[5].cost + l10(this.haxolotlC1) < getMax(0)) && this.curMult < this.stop2,
        () => (this.variables[6].cost + l10(this.haxolotlC2) < getMax(1)) && this.curMult < this.stop3,
        () => (this.variables[7].cost + l10(this.haxolotlC3) < getMax(2)) && this.curMult < this.stop4,
      ],
      T2MS: new Array(8).fill(true),
      T2QS: new Array(8).fill(true),
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = [
      () => true,
      () => true,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 1,
      () => true,
      () => true,
      () => this.milestones[1] > 0,
      () => this.milestones[1] > 1,
    ];
    return conditions;
  }
  getTotMult(val: number): number {
    return Math.max(0, val * 0.198 - l10(100)) + getR9multiplier(this.sigma);
  }
  getMilestonePriority(): number[] {
    if (this.strat === "T2MS") {
      const tm100 = this.t % 100;
      if (tm100 < 10) return [2, 3, 0, 1];
      else if (tm100 < 50) return [0, 1, 2, 3];
      else if (tm100 < 60) return [2, 3, 0, 1];
      else if (tm100 < 100) return [1, 0, 2, 3];
    }
    if (this.strat === "T2QS") {
      let coastMulti = Infinity;
      if (this.lastPub > 0) coastMulti = 10;
      if (this.lastPub > 75) coastMulti = 200;
      if (this.lastPub > 100) coastMulti = 200;
      if (this.lastPub > 125) coastMulti = 200;
      if (this.lastPub > 150) coastMulti = 600;
      if (this.lastPub > 200) coastMulti = 100;
      if (this.lastPub > 225) coastMulti = 25;
      if (this.curMult < coastMulti) return [0, 1, 2, 3];
      else return [2, 3, 0, 1];
    }
    return [0, 1, 2, 3];
  }
  constructor(data: theoryData) {
    super(data);
    this.q1 = -Infinity;
    this.q2 = 0;
    this.q3 = 0;
    this.q4 = 0;
    this.r1 = 0;
    this.r2 = 0;
    this.r3 = 0;
    this.r4 = 0;
    this.haxolotlC1 = 1.0;
    this.haxolotlC2 = 1.0;
    this.haxolotlC3 = 1.0;
    this.pubUnlock = 15;
    this.milestoneUnlockSteps = 25;
    this.milestonesMax = [2, 2, 3, 3];
    this.variables = [
      new Variable({ name: "q1", cost: new FirstFreeCost(new ExponentialCost(10, 2)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "q2", cost: new ExponentialCost(5000, 2), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "q3", cost: new ExponentialCost(3e25, 3), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "q4", cost: new ExponentialCost(8e50, 4), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "r1", cost: new ExponentialCost(2e6, 2), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "r2", cost: new ExponentialCost(3e9, 2), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "r3", cost: new ExponentialCost(4e25, 3), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "r4", cost: new ExponentialCost(5e50, 4), valueScaling: new StepwisePowerSumValue() }),
    ];
    
    this.targetRho = -1;
    this.stop1 = 3500;
    this.stop2 = 2700;
    this.stop3 = 2050;
    this.stop4 = 550;

    this.doSimEndConditions = () => this.targetRho == -1;
    this.updateMilestones();
  }
  async simulate(): Promise<simResult> {
    if (this.targetRho != -1) {
      this.pubConditions.push(() => this.maxRho >= this.targetRho);
    }
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 250) this.updateMilestones();
      this.buyVariables();
    }
    this.trimBoughtVars();
    let stratExtra = ["T2MCAlt3", "T2Haxolotl"].includes(this.strat) ? ` 4:${this.stop4} 3:${this.stop3} 2:${this.stop2} 1:${this.stop1}` : "";
    if(this.strat == "T2Haxolotl") {
      stratExtra += ` c1:${this.haxolotlC1} c2:${this.haxolotlC2} c3: ${this.haxolotlC3}`;
    }
    return this.createResult(stratExtra);
  }
  tick() {
    const logdt = l10(this.dt);

    this.q1 = add(this.q1, this.variables[0].value + this.q2 + logdt);
    this.q2 = add(this.q2, this.variables[1].value + this.q3 + logdt);
    this.q3 = this.milestones[0] > 0 ? add(this.q3, this.variables[2].value + this.q4 + logdt) : this.q3;
    this.q4 = this.milestones[0] > 1 ? add(this.q4, this.variables[3].value + logdt) : this.q4;

    this.r1 = add(this.r1, this.variables[4].value + this.r2 + logdt);
    this.r2 = add(this.r2, this.variables[5].value + this.r3 + logdt);
    this.r3 = this.milestones[1] > 0 ? add(this.r3, this.variables[6].value + this.r4 + logdt) : this.r3;
    this.r4 = this.milestones[1] > 1 ? add(this.r4, this.variables[7].value + logdt) : this.r4;

    const rhodot = this.q1 * (1 + 0.05 * this.milestones[2]) + this.r1 * (1 + 0.05 * this.milestones[3]) + this.totMult + logdt;
    this.rho.add(rhodot);
  }
}