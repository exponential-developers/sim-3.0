import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep, getR9multiplier } from "../../Utils/helpers.js";
import { StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';

export default async function t2(data: theoryData): Promise<simResult> {
  let bestSim, bestSimRes;
  if(data.strat == "T2MCAlt2" || data.strat == "T2MCAlt3") {
    const savedStrat = data.strat;
    data.strat = "T2MC";
    let res = await new t2Sim(data).simulate();

    data.strat = savedStrat;
    if(savedStrat == "T2MCAlt2") {
      bestSim = new t2Sim(data);
      bestSim.targetRho = res.rawData.pubRho;
      bestSimRes = await bestSim.simulate();
    }
    else {
      bestSim = new t2Sim(data);
      bestSim.stop4 = 750;
      bestSim.stop3 = 1700;
      bestSim.stop2 = 2650;
      bestSim.stop1 = 3700;
      bestSim.targetRho = res.rawData.pubRho;
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

class t2Sim extends theoryClass<theory> implements specificTheoryProps {
  rho: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  targetRho: number;
  stop4: number;
  stop3: number;
  stop2: number;
  stop1: number;

  getBuyingConditions() {
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
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
      T2MS: new Array(8).fill(true),
      T2QS: new Array(8).fill(true),
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getMilestoneConditions() {
    const conditions: Array<conditionFunction> = [
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
  getMilestoneTree() {
    const globalOptimalRoute = [
      [0, 0, 0, 0],
      [1, 0, 0, 0],
      [2, 0, 0, 0],
      [2, 1, 0, 0],
      [2, 2, 0, 0],
      [2, 2, 1, 0],
      [2, 2, 2, 0],
      [2, 2, 3, 0],
      [2, 2, 3, 1],
      [2, 2, 3, 2],
      [2, 2, 3, 3],
    ];
    const tree: { [key in stratType[theory]]: Array<Array<number>> } = {
      T2: globalOptimalRoute,
      T2MC: globalOptimalRoute,
      T2MCAlt: globalOptimalRoute,
      T2MCAlt2: globalOptimalRoute,
      T2MCAlt3: globalOptimalRoute,
      T2MS: globalOptimalRoute,
      T2QS: globalOptimalRoute,
    };
    return tree[this.strat];
  }
  getTotMult(val: number) {
    return Math.max(0, val * 0.198 - l10(100)) + getR9multiplier(this.sigma);
  }
  updateMilestones() {
    let milestoneCount = Math.min(10, Math.floor(Math.max(this.lastPub, this.maxRho) / 25));
    this.milestones = [0, 0, 0, 0];
    let priority: Array<number> = [];

    priority = [1, 2, 3, 4];

    if (this.strat === "T2MS") {
      const tm100 = this.t % 100;
      if (tm100 < 10) priority = [3, 4, 1, 2];
      else if (tm100 < 50) priority = [1, 2, 3, 4];
      else if (tm100 < 60) priority = [3, 4, 1, 2];
      else if (tm100 < 100) priority = [2, 1, 3, 4];
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
      if (this.curMult < coastMulti) priority = [1, 2, 3, 4];
      else priority = [3, 4, 1, 2];
    }
    const max = [2, 2, 3, 3];
    for (let i = 0; i < priority.length; i++) {
      while (this.milestones[priority[i] - 1] < max[priority[i] - 1] && milestoneCount > 0) {
        this.milestones[priority[i] - 1]++;
        milestoneCount--;
      }
    }
  }
  constructor(data: theoryData) {
    super(data);
    //theory
    this.pubUnlock = 15;
    this.curMult = 0;
    this.totMult = this.getTotMult(data.rho);
    //currencies
    this.rho = 0;
    this.q1 = -Infinity;
    this.q2 = 0;
    this.q3 = 0;
    this.q4 = 0;
    this.r1 = 0;
    this.r2 = 0;
    this.r3 = 0;
    this.r4 = 0;
    this.targetRho = -1;
    this.stop1 = 3500;
    this.stop2 = 2700;
    this.stop3 = 2050;
    this.stop4 = 550;
    //initialize variables
    this.varNames = ["q1", "q2", "q3", "q4", "r1", "r2", "r3", "r4"];
    this.variables = [
      new Variable({ cost: new FirstFreeCost(new ExponentialCost(10, 2)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(5000, 2), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(3e25, 3), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(8e50, 4), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(2e6, 2), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(3e9, 2), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(4e25, 3), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(5e50, 4), valueScaling: new StepwisePowerSumValue() }),
    ];
    //milestones  [qterm, rterm, q1exp, r1exp]
    this.milestones = [0, 0, 0, 0];
    this.conditions = this.getBuyingConditions();
    this.milestoneConditions = this.getMilestoneConditions();
    this.milestoneTree = this.getMilestoneTree();
    this.doSimEndConditions = () => this.targetRho == -1;
    this.updateMilestones();
  }
  async simulate() {
    if (this.targetRho != -1) {
      this.pubConditions.push(() => this.maxRho >= this.targetRho);
    }
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      if ((this.ticks + 1) % 500000 === 0) await sleep();
      this.tick();
      if (this.rho > this.maxRho) this.maxRho = this.rho;
      this.updateSimStatus();
      if (this.lastPub < 250) this.updateMilestones();
      this.buyVariables();
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    let result;
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    if(this.strat == "T2MCAlt3") {
      result = createResult(this, ` 4:${this.stop4} 3:${this.stop3} 2:${this.stop2} 1:${this.stop1}`);
    }
    else {
      result = createResult(this, "");
    }

    return result;
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
    this.rho = add(this.rho, rhodot);
  }
  buyVariables() {
    for (let i = this.variables.length - 1; i >= 0; i--)
      while (true) {
        if (this.rho > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]()) {
          if (this.maxRho + 5 > this.lastPub) {
            this.boughtVars.push({ variable: this.varNames[i], level: this.variables[i].level + 1, cost: this.variables[i].cost, timeStamp: this.t });
          }
          this.rho = subtract(this.rho, this.variables[i].cost);
          this.variables[i].buy();
        } else break;
      }
  }
}