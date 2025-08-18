import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep, getLastLevel, getBestResult } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import pubtable from "./helpers/EFpubtable.json" assert { type: "json" };
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';

export default async function ef(data: theoryData): Promise<simResult> {
  const sim = new efSim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "EF";

type pubTable = {[key: string]: number};

class efSim extends theoryClass<theory> implements specificTheoryProps {
  pubUnlock: number;
  curMult: number;
  currencies: Array<number>;
  q: number;
  t_var: number;
  nextMilestoneCost: number;

  forcedPubRho: number;
  coasting: Array<boolean>;
  bestRes: simResult | null;

  getBuyingConditions() {
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      EF: new Array(10).fill(true),
      EFSnax: [
        true,
        () => this.curMult < 1,
        true,
        () => this.curMult < 1,
        () => this.curMult < 1,
        () => this.curMult < 1,
        () => this.curMult < 1,
        () => this.curMult < 1 || this.lastPub > 150,
        true,
        true,
      ],
      EFd: [
        true,
        () => this.variables[1].cost + 1 < this.variables[2].cost,
        true,
        () => this.curMult < 1,
        () => this.curMult < 1,
        () => this.curMult < 1,
        () => this.curMult < 1,
        () => this.variables[6].cost + l10(2.5) < this.variables[2].cost,
        true,
        true,
      ],
      EFAI: [
        /*tdot*/ true,
        /*q1*/ () => this.variables[1].cost + l10(10 + (this.variables[1].level % 10)) < this.variables[2].cost,
        /*q2*/ true,
        /*b1*/ () => this.variables[3].cost + l10(5) < this.variables[8].cost || this.milestones[1] < 2 || this.curMult < 1,
        /*b2*/ () => this.variables[4].cost + l10(5) < this.variables[8].cost || this.milestones[1] < 2 || this.curMult < 1,
        /*c1*/ () => this.variables[5].cost + l10(5) < this.variables[9].cost || this.milestones[1] < 2 || this.curMult < 1,
        /*c2*/ () => this.variables[6].cost + l10(5) < this.variables[9].cost || this.milestones[1] < 2 || this.curMult < 1,
        /*a1*/ () =>
          (this.variables[7].cost + l10(4 + (this.variables[7].level % 10) / 2) < this.variables[2].cost || this.coasting[2]),
        /*a2*/ true,
        /*a3*/ true,
      ],
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getMilestoneConditions() {
    const conditions: Array<conditionFunction> = [
      () => this.variables[0].level < 4,
      () => true,
      () => true,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 1,
      () => this.milestones[0] > 1,
      () => this.milestones[1] > 0,
      () => this.milestones[1] > 1,
      () => this.milestones[1] > 2,
    ];
    return conditions;
  }
  getDynamicCoastingConditions() {
    const conditions: Array<conditionFunction> = [
      () => false,
      () => this.curMult > 1.2,
      () => this.curMult > 1.6,
      ...new Array(4).fill(() => false),
      () => this.curMult > 1.4,
      () => false,
      () => false,
    ];
    return conditions;
  }
  getForcedDynamicCoastingConditions() {
    const conditions: Array<conditionFunction> = [
      () => false,
      () => this.coasting[2] || this.coasting[7],
      ...new Array(8).fill(() => false)
    ];
    return conditions;
  }
  getMilestoneTree() {
    const globalOptimalRoute = [
      [0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [2, 0, 0, 0, 0],
      [2, 1, 0, 0, 0],
      [2, 2, 0, 0, 0],
      [2, 3, 0, 0, 0],
      [2, 3, 1, 0, 0],
      [2, 3, 2, 0, 0],
      [2, 3, 3, 0, 0],
      [2, 3, 4, 0, 0],
      [2, 3, 5, 0, 0],
      [2, 3, 5, 1, 0],
      [2, 3, 5, 2, 0],
      [2, 3, 5, 2, 1],
      [2, 3, 5, 2, 2],
    ];
    const tree: { [key in stratType[theory]]: Array<Array<number>> } = {
      EF: globalOptimalRoute,
      EFd: globalOptimalRoute,
      EFSnax: globalOptimalRoute,
      EFAI: globalOptimalRoute,
    };
    return tree[this.strat];
  }
  getTotMult(val: number) {
    return Math.max(0, val * this.tauFactor * 0.09675);
  }
  updateMilestones(): void {
    let stage = 0;
    const points = [10, 20, 30, 40, 50, 70, 90, 110, 130, 150, 250, 275, 300, 325];
    for (let i = 0; i < points.length; i++) {
      if (Math.max(this.lastPub, this.maxRho) >= points[i]) stage = i + 1;
      if (points[i] > Math.max(this.lastPub, this.maxRho)) {
        this.nextMilestoneCost = points[i];
        break;
      }
    }
    if (Math.max(this.lastPub, this.maxRho) >= 325) this.nextMilestoneCost = Infinity;
    this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
    if (this.variables[4].valueScaling instanceof ExponentialValue && this.variables[4].valueScaling.power !== 1.1 + 0.01 * this.milestones[3]) {
      this.variables[4].valueScaling.power = 1.1 + 0.01 * this.milestones[3];
      this.variables[4].reCalculate();
    }
    if (this.variables[6].valueScaling instanceof ExponentialValue && this.variables[6].valueScaling.power !== 1.1 + 0.0125 * this.milestones[4]) {
      this.variables[6].valueScaling.power = 1.1 + 0.0125 * this.milestones[4];
      this.variables[6].reCalculate();
    }
  }
  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = 10;
    this.totMult = this.getTotMult(data.rho);
    this.curMult = 0;
    this.currencies = [0, 0, 0];
    this.q = 0;
    this.t_var = 0;
    //initialize variables
    this.varNames = ["t", "q1", "q2", "b1", "b2", "c1", "c2", "a1", "a2", "a3"];
    this.variables = [
      new Variable({ cost: new ExponentialCost(1e6, 1e6), valueScaling: new ExponentialValue(10) }),
      new Variable({ cost: new FirstFreeCost(new ExponentialCost(10, 1.61328)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ cost: new ExponentialCost(5, 60), valueScaling: new ExponentialValue(2) }),
      new Variable({ cost: new FirstFreeCost(new ExponentialCost(20, 200)), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ cost: new ExponentialCost(100, 2), valueScaling: new ExponentialValue(1.1) }),
      new Variable({ cost: new FirstFreeCost(new ExponentialCost(20, 200)), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ cost: new ExponentialCost(100, 2), valueScaling: new ExponentialValue(1.1) }),
      new Variable({ cost: new FirstFreeCost(new ExponentialCost(2000, 2.2, true)), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ cost: new ExponentialCost(500, 2.2, true), valueScaling: new StepwisePowerSumValue(40, 10, 1) }),
      new Variable({ cost: new ExponentialCost(500, 2.2, true), valueScaling: new ExponentialValue(2) }),
    ];
    this.forcedPubRho = Infinity;
    this.coasting = new Array(this.variables.length).fill(false);
    this.bestRes = null;
    this.nextMilestoneCost = Infinity;
    this.conditions = this.getBuyingConditions();
    this.milestoneConditions = this.getMilestoneConditions();
    this.milestoneTree = this.getMilestoneTree();
    this.updateMilestones();
  }
  copyFrom(other: this): void {
    super.copyFrom(other);

    this.curMult = other.curMult;
    this.currencies = [...other.currencies];
    this.q = other.q;
    this.t_var = other.t_var;
    this.nextMilestoneCost = other.nextMilestoneCost;

    this.forcedPubRho = other.forcedPubRho;
    this.coasting = [...other.coasting];
  }
  copy(): efSim {
    let newsim = new efSim(this.getDataForCopy());
    newsim.copyFrom(this);
    return newsim;
  }
  async simulate() {
    let pubCondition = false;
    if (this.lastPub < 374 && this.strat !== "EF") {
      let newpubtable: pubTable = pubtable.efdata;
      let pubseek = Math.round(this.lastPub * 32);
      this.forcedPubRho = newpubtable[pubseek.toString()] / 32;
      if (this.forcedPubRho === undefined) this.forcedPubRho = Infinity;
    }
    while (!pubCondition) {
      if (!global.simulating) break;
      if ((this.ticks + 1) % 500000 === 0) await sleep();
      this.tick();
      if (this.currencies[0] > this.maxRho) this.maxRho = this.currencies[0];
      let prev_nextMilestoneCost = this.nextMilestoneCost;
      if (this.lastPub <= 325) this.updateMilestones();
      if (this.nextMilestoneCost > prev_nextMilestoneCost) {
        this.coasting.fill(false);
      }
      this.curMult = 10 ** (this.getTotMult(this.maxRho) - this.totMult);
      await this.buyVariables();
      if (this.forcedPubRho != Infinity) {
        pubCondition = this.pubRho >= this.forcedPubRho && this.pubRho > this.pubUnlock && (this.pubRho <= 375 || this.t > this.pubT * 2);
        pubCondition ||= this.pubRho > this.cap[0];
      }
      else {
        pubCondition =
        (global.forcedPubTime !== Infinity ? this.t > global.forcedPubTime : this.t > this.pubT * 2 || this.pubRho > this.cap[0]) &&
        this.pubRho > this.pubUnlock;
      }
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    const lastLevels = this.varNames.map((variable) => getLastLevel(variable, this.boughtVars));
    const result = createResult(
      this,
      this.strat !== "EF"
        ? ` q1: ${lastLevels[1]} q2: ${lastLevels[2]} a1: ${lastLevels[7]}` +
            (global.showA23 ? ` a2: ${lastLevels[8]} a3: ${lastLevels[9]}` : "")
        : ""
    );
    return getBestResult(result, this.bestRes);
  }
  tick() {
    const logbonus = l10(this.dt) + this.totMult;
    this.q = add(this.q, this.variables[1].value + this.variables[2].value + logbonus);

    this.t_var += this.dt * (this.variables[0].level / 5 + 0.2);

    const a = this.milestones[1] > 0 ? (this.variables[7].value + this.variables[8].value + this.variables[9].value) * (0.1 * this.milestones[2] + 1) : 0;

    const b = this.variables[3].value + this.variables[4].value;

    const c = this.variables[5].value + this.variables[6].value;

    const R = b + l10(Math.abs(Math.cos(this.t_var)));
    const I = c + l10(Math.abs(Math.sin(this.t_var)));

    this.currencies[1] = this.milestones[0] > 0 ? add(this.currencies[1], logbonus + R * 2) : 0;

    this.currencies[2] = this.milestones[0] > 1 ? add(this.currencies[2], logbonus + I * 2) : 0;

    switch (this.milestones[0]) {
      case 0:
        this.currencies[0] = add(this.currencies[0], logbonus + (l10(this.t_var) + this.q * 2) / 2);
        break;
      case 1:
        this.currencies[0] = add(this.currencies[0], logbonus + add(l10(this.t_var) + this.q * 2, this.currencies[1] * 2) / 2);
        break;
      case 2:
        this.currencies[0] = add(this.currencies[0], logbonus + a + add(add(l10(this.t_var) + this.q * 2, this.currencies[1] * 2), this.currencies[2] * 2) / 2);
        break;
    }

    this.t += this.dt / 1.5;
    this.dt *= this.ddt;
    if (this.maxRho < this.recovery.value) this.recovery.time = this.t;

    this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
    if (
      this.maxTauH < this.tauH || 
      this.maxRho >= this.cap[0] - this.cap[1] || 
      this.pubRho < 10 || 
      global.forcedPubTime !== Infinity ||
      (this.forcedPubRho !== Infinity && this.pubRho < this.forcedPubRho)
    ) {
      if (this.maxTauH < this.tauH && this.maxRho >= 375 && this.forcedPubRho != Infinity)
      {
        this.coasting.fill(false);
        this.forcedPubRho = Infinity;
      }
      this.maxTauH = this.tauH;
      this.pubT = this.t;
      this.pubRho = this.maxRho;
    }
  }
  async buyVariables() {
    const nextCoast = Math.min(this.forcedPubRho, this.nextMilestoneCost);
    const currencyIndicies = [0, 0, 0, 1, 1, 2, 2, 0, 1, 2];
    const lowbounds = [0, 0.6, 0.2, 0, 0, 0, 0, 0.3, 0, 0];
    const highbounds = [0, 1.8, 1.5, 0, 0, 0, 0, 1.5, 0, 0];
    const doDynamicCoasting = this.forcedPubRho == Infinity && this.strat != "EF";
    for (let i = this.variables.length - 1; i >= 0; i--)
      while (true) {
        if (this.currencies[currencyIndicies[i]] > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]() && !this.coasting[i]) {
          if (this.forcedPubRho - this.variables[i].cost <= lowbounds[i] || (doDynamicCoasting && this.getForcedDynamicCoastingConditions()[i]())) {
            this.coasting[i] = true;
            break;
          }
          if (nextCoast - this.variables[i].cost < highbounds[i] || (doDynamicCoasting && this.getDynamicCoastingConditions()[i]())) {
            let fork = this.copy();
            fork.coasting[i] = true;
            const forkres = await fork.simulate();
            this.bestRes = getBestResult(this.bestRes, forkres);
          }
          if (this.maxRho + 5 > this.lastPub) {
            this.boughtVars.push({
              variable: this.varNames[i],
              level: this.variables[i].level + 1,
              cost: this.variables[i].cost,
              timeStamp: this.t,
              symbol: ["rho", "R", "I"][currencyIndicies[i]],
            });
          }
          this.currencies[currencyIndicies[i]] = subtract(this.currencies[currencyIndicies[i]], this.variables[i].cost);
          this.variables[i].buy();
        } else break;
      }
  }
}
