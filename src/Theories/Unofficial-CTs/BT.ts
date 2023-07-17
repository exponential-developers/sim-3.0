import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep } from "../../Utils/helpers.js";
import Variable, { ExponentialCost } from "../../Utils/variable.js";
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";

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
      BT: [true, true],
      BTd: [() => this.variables[0].cost + l10(this.lastPub < 275 ? 12 + (this.variables[0].level % 10) : 10 + (this.variables[0].level % 10)) < this.variables[1].cost, true],
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getMilestoneConditions() {
    const conditions: Array<conditionFunction> = [() => true, () => true];
    return conditions;
  }
  getMilestoneTree() {
    const globalOptimalRoute = [
      [0, 0, 0],
      [0, 1, 0],
      [0, 2, 0],
      [0, 3, 0],
      [1, 3, 0],
      [2, 3, 0],
      [3, 3, 0],
      [3, 3, 1],
    ];
    const tree: { [key in stratType[theory]]: Array<Array<number>> } = {
      BT: globalOptimalRoute,
      BTd: globalOptimalRoute,
    };
    return tree[this.strat];
  }

  getTotMult(val: number) {
    return Math.max(0, val * this.tauFactor * 5);
  }
  updateMilestones(): void {
    let stage = 0;
    const points = [20, 40, 60, 100, 150, 275, 750];
    for (let i = 0; i < points.length; i++) {
      if (Math.max(this.lastPub, this.maxRho) >= points[i]) stage = i + 1;
    }
    this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
  }
  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = 7;
    this.totMult = data.rho < this.pubUnlock ? 0 : this.getTotMult(data.rho);
    this.rho = 0;
    this.varNames = ["tai", "rao"];
    this.variables = [new Variable({ cost: new ExponentialCost(15, 2), stepwisePowerSum: { default: true }, firstFreeCost: true }), new Variable({ cost: new ExponentialCost(5, 10), varBase: 2 })];
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
      pubCondition = (global.forcedPubTime !== Infinity ? this.t > global.forcedPubTime : this.t > this.pubT * 2 || this.pubRho > this.cap[0] || this.pubMulti > 3.5) && this.pubRho > this.pubUnlock;
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    const result = createResult(this, "");

    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    global.varBuy.push([result[7], this.boughtVars]);

    return result;
  }
  tick() {
    const rhodot = this.totMult + this.variables[0].value * (1 + 0.08 * this.milestones[0]) + this.variables[1].value * (1 + 0.077 * this.milestones[1] + 0.003 * this.milestones[2]);

    this.rho = add(this.rho, rhodot + l10(this.dt));

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
