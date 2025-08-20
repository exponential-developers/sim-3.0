import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, logToExp, sleep, getR9multiplier } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';

export default async function t5(data: theoryData): Promise<simResult> {
  const sim = new t5Sim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "T5";

class t5Sim extends theoryClass<theory> implements specificTheoryProps {
  rho: number;
  q: number;
  c2worth: boolean;

  getBuyingConditions() {
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      T5: [true, true, true, true, true],
      T5Idle: [
        true, 
        true, 
        () => this.maxRho + (this.lastPub - 200) / 165 < this.lastPub, 
        () => this.c2worth, 
        true
      ],
      T5AI2: [
        () => this.variables[0].cost + l10(3 + (this.variables[0].level % 10)) <= Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[4].cost : 1000),
        true,
        () => this.q + l10(1.5) < this.variables[3].value + this.variables[4].value * (1 + 0.05 * this.milestones[2]) || !this.c2worth,
        () => this.c2worth,
        true,
      ],
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getMilestoneConditions() {
    const conditions: Array<conditionFunction> = [() => true, () => true, () => true, () => true, () => this.milestones[1] > 0];
    return conditions;
  }
  getMilestoneTree() {
    const globalOptimalRoute = [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [2, 1, 0],
      [3, 1, 0],
      [3, 1, 1],
      [3, 1, 2],
    ];
    const tree: { [key in stratType[theory]]: Array<Array<number>> } = {
      T5: globalOptimalRoute,
      T5Idle: globalOptimalRoute,
      T5AI2: globalOptimalRoute,
    };
    return tree[this.strat];
  }
  getTotMult(val: number) {
    return Math.max(0, val * 0.159) + getR9multiplier(this.sigma);
  }
  updateMilestones(): void {
    const stage = Math.min(6, Math.floor(Math.max(this.lastPub, this.maxRho) / 25));
    this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
  }
  // Solves q using the differential equation result
  calculateQ(ic1: number, ic2: number, ic3: number){
    const qcap = ic2 + ic3
    const gamma = 10 ** (ic1 + ic3 - ic2) // q growth speed characteristic parameter
    const adjust = this.q - subtract(qcap, this.q); // initial condition
    const sigma = 10 ** (adjust + gamma * this.dt * l10(Math.E)) 
    let newq;
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
    this.pubUnlock = 7;
    this.rho = 0;
    this.q = 0;
    //initialize variables
    this.variables = [
      new Variable({ cost: new FirstFreeCost(new ExponentialCost(10, 1.61328)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(15, 64), valueScaling: new ExponentialValue(2) }),
      new Variable({ cost: new ExponentialCost(1e6, 1.18099), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ cost: new ExponentialCost(75, 4.53725), valueScaling: new ExponentialValue(2) }),
      new Variable({ cost: new ExponentialCost(1e3, 8.85507e7), valueScaling: new ExponentialValue(2) }),
    ];
    this.c2worth = true;
    this.varNames = ["q1", "q2", "c1", "c2", "c3"];
    //milestones  [q1exp,c3term,c3exp]
    this.milestones = [0, 0, 0];
    this.conditions = this.getBuyingConditions();
    this.milestoneConditions = this.getMilestoneConditions();
    this.milestoneTree = this.getMilestoneTree();
    this.updateMilestones();
  }
  async simulate() {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      if ((this.ticks + 1) % 500000 === 0) await sleep();
      this.tick();
      if (this.rho > this.maxRho) this.maxRho = this.rho;
      this.updateSimStatus();
      if (this.lastPub < 150) this.updateMilestones();
      this.buyVariables();
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    const result = createResult(this, this.strat === "T5Idle" ? " " + logToExp(this.variables[2].cost, 1) : "");

    return result;
  }
  tick() {
    const vq1 = this.variables[0].value * (1 + 0.05 * this.milestones[0]);
    const vc3 = this.milestones[1] > 0 ? this.variables[4].value * (1 + 0.05 * this.milestones[2]) : 0;

    this.q = this.calculateQ(this.variables[2].value, this.variables[3].value, vc3);
    const rhodot = vq1 + this.variables[1].value + this.q;
    this.rho = add(this.rho, rhodot + this.totMult + l10(this.dt));
  }
  buyVariables() {
    let c2Counter = 0;
    const nc3 = this.milestones[1] > 0 ? this.variables[4].value * (1 + 0.05 * this.milestones[2]) : 0;
    let iq = this.calculateQ(this.variables[2].value, this.variables[3].value, nc3);
    this.c2worth = iq >= this.variables[3].value + nc3 + l10(2 / 3);
    for (let i = this.variables.length - 1; i >= 0; i--) {
      while (true) {
        if (this.rho > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]()) {
          if (this.maxRho + 5 > this.lastPub) {
            this.boughtVars.push({ variable: this.varNames[i], level: this.variables[i].level + 1, cost: this.variables[i].cost, timeStamp: this.t });
          }
          this.rho = subtract(this.rho, this.variables[i].cost);
          this.variables[i].buy();
          if (i === 3) {
            c2Counter++;
            iq = this.calculateQ(this.variables[2].value, this.variables[3].value + l10(2) * c2Counter, nc3);
            this.c2worth = iq >= this.variables[3].value + l10(2) * c2Counter + this.variables[4].value * (1 + 0.05 * this.milestones[2]) + l10(2 / 3);
          }
        } else break;
      }
    }
  }
}
