import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';
import { parseValue } from "../../Sim/parsers.js";

export default async function bt(data: theoryData): Promise<simResult> {
  const sim = new btSim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "BT";

class btSim extends theoryClass<theory> implements specificTheoryProps {
  rho: number;
  pubUnlock: number;

  getBuyingConditions() {
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      BT: [true, true, true],
      BTd: [
        () => this.variables[0].cost + l10(this.lastPub < 275 ? 12 + (this.variables[0].level % 10) : 10 + (this.variables[0].level % 10)) < this.variables[1].cost, 
        true, 
        true
      ],
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getMilestoneConditions() {
    const conditions: Array<conditionFunction> = [
      () => true, 
      () => true,
      () => this.milestones[2] > 0
    ];
    return conditions;
  }
  getMilestoneTree() {
    const globalOptimalRoute = [
      [0, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 2, 0, 0],
      [0, 3, 0, 0],
      [1, 3, 0, 0],
      [2, 3, 0, 0],
      [3, 3, 0, 0],
      [3, 3, 1, 0],
      [3, 3, 2, 0],
      [3, 3, 3, 0],
      [3, 3, 4, 0],
      [3, 3, 5, 0],
      [3, 3, 6, 0],
      [3, 3, 6, 1]
    ]
    const tree: { [key in stratType[theory]]: Array<Array<number>> } = {
      BT: globalOptimalRoute,
      BTd: globalOptimalRoute,
    };
    return tree[this.strat];
  }

  getTotMult(val: number) {
    return Math.max(0, val * this.tauFactor * 1.25);
  }
  updateMilestones(): void {
    let stage = 0;
    const points = [20, 40, 60, 100, 150, 250, 750, 850, 950, 1050, 1150, 1250, 1450];
    const max = [3, 3, 6, 1];
    const priority = [2, 1, 3, 4]
    for (let i = 0; i < points.length; i++) {
      if (Math.max(this.lastPub, this.maxRho) >= points[i]) stage = i + 1;
    }
    let milestoneCount = stage;
    this.milestones = [0, 0, 0, 0];
    for (let i = 0; i < priority.length; i++) {
        while (this.milestones[priority[i] - 1] < max[priority[i] - 1] && milestoneCount > 0) {
            this.milestones[priority[i] - 1]++;
            milestoneCount--;
        }
    }
  }
  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = 7;
    this.totMult = data.rho < this.pubUnlock ? 0 : this.getTotMult(data.rho);
    this.rho = 0;
    this.varNames = ["tai", "rao", "tay"];
    this.variables = [
      new Variable({ cost: new FirstFreeCost(new ExponentialCost(15, 2)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(5, 10), valueScaling: new ExponentialValue(2) }),
      new Variable({ cost: new ExponentialCost(1e10, 10, true), valueScaling: new ExponentialValue(10) })
    ];
    this.conditions = this.getBuyingConditions();
    this.milestoneConditions = this.getMilestoneConditions();
    this.milestoneTree = this.getMilestoneTree();
    this.updateMilestones();
  }
  async simulate() {
    let pubCondition = false;
    while (!pubCondition) {
      if (!global.simulating) break;
      if ((this.ticks + 1) % 500000 === 0) await sleep();
      this.tick();
      if (this.rho > this.maxRho) this.maxRho = this.rho;
      this.updateMilestones();
      this.curMult = 10 ** (this.getTotMult(this.maxRho) - this.totMult);
      this.buyVariables();
      pubCondition = (global.forcedPubTime !== Infinity ? this.t > global.forcedPubTime : this.t > this.pubT * 2 || this.pubRho > this.cap[0]) && this.pubRho > this.pubUnlock;
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    const result = createResult(this, "");

    return result;
  }
  tick() {
    const tayexponent = ((this.milestones[2] + 1) * (this.milestones[2] + 2) * 0.5 - 1) * 0.0003
    const vtai = this.variables[0].value * (1 + 0.08 * this.milestones[0])
    const vrao = this.variables[1].value * (1 + 0.077 * this.milestones[1])
    const vtay = this.variables[2].value * (this.milestones[3] == 0 ? tayexponent : 0.015)
    const rhodot = this.totMult + vtai + vrao + vtay;

    this.rho = add(this.rho, rhodot + l10(this.dt));
    if (this.milestones[3] == 1 && Math.max(this.maxRho, this.lastPub) * this.tauFactor < parseValue("9e599")) {
      this.rho = parseValue("1.05e1500");
    }

    this.t += this.dt / 1.5;
    this.dt *= this.ddt;
    if (this.maxRho < this.recovery.value) this.recovery.time = this.t;

    this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
    if (this.maxTauH < this.tauH || this.maxRho >= this.cap[0] - this.cap[1] || this.pubRho < this.pubUnlock || global.forcedPubTime !== Infinity) {
      this.maxTauH = this.tauH;
      this.pubT = this.t;
      this.pubRho = this.maxRho;
    }
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
