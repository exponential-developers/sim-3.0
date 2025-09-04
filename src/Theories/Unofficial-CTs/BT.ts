import { global } from "../../Sim/main.js";
import { add, createResult, l10 } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import theoryClass from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';
import { parseValue } from "../../Sim/parsers.js";

export default async function bt(data: theoryData): Promise<simResult> {
  const sim = new btSim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "BT";

class btSim extends theoryClass<theory> {
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
  getVariableAvailability() {
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
    this.variables = [
      new Variable({ name: "tai", cost: new FirstFreeCost(new ExponentialCost(15, 2)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "rao", cost: new ExponentialCost(5, 10), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "tay", cost: new ExponentialCost(1e10, 10, true), valueScaling: new ExponentialValue(10) })
    ];
    this.milestoneTree = this.getMilestoneTree();
    this.updateMilestones();
  }
  async simulate() {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      this.updateMilestones();
      this.buyVariables();
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

    this.rho.add(rhodot + l10(this.dt));
    if (this.milestones[3] == 1 && Math.max(this.maxRho, this.lastPub) * this.tauFactor < parseValue("9e599")) {
      this.rho.value = parseValue("1.05e1500");
    }
  }
}
