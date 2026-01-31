import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Currency from "../../Utils/currency";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, getLastLevel, getBestResult, binaryInsertionSearch, toCallables } from "../../Utils/helpers";
import pubtable from "./helpers/EFpubtable.json" assert { type: "json" };

export default async function ef(data: theoryData): Promise<simResult> {
  if (data.strat !== "EFPlay") {
    const sim = new efSim(data);
    const res = await sim.simulate();
    return res;
  }
  const initialSim = new efSim({
    ...data,
    strat: "EFAI"
  });
  const initialRes = await initialSim.simulate();
  const sim = new efSim(data);
  sim.lastStronga2 = 10 * Math.floor((getLastLevel("a2", initialRes.boughtVars) - 1) / 10) + 1;
  sim.lastStronga2Cost = l10(500) + 2.2 * (sim.lastStronga2 - 1) * l10(2);
  sim.lasta23 = [getLastLevel("a2", initialRes.boughtVars), getLastLevel("a3", initialRes.boughtVars)];
  sim.lasta23costs = [l10(500) + 2.2 * (sim.lasta23[0] - 1) * l10(2), l10(500) + 2.2 * (sim.lasta23[1] - 1) * l10(2)];
  const res = await sim.simulate();
  return res;
}

type theory = "EF";

type pubTable = {[key: string]: number};

class efSim extends theoryClass<theory> {
  R: Currency;
  I: Currency;
  q: number;
  t_var: number;
  nextMilestoneCost: number;

  lastStronga2?: number;
  lastStronga2Cost?: number;
  lasta23?: [number, number];
  lasta23costs?: [number, number];

  forcedPubRho: number;
  coasting: boolean[];
  bestRes: simResult | null;
  doContinuityFork: boolean;

  depth: number;

  getBuyingConditions() {
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
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
      EFPlay: [
        true,
        () => this.variables[1].cost + l10(10 + (this.variables[1].level % 10)) < this.variables[2].cost,
        true,
        () => this.lastStronga2 === undefined || this.lasta23 === undefined  || this.lastStronga2Cost === undefined || this.lasta23costs === undefined ? true
          : this.variables[8].level < this.lastStronga2 ? this.variables[3].cost + l10(5) < this.lastStronga2Cost
          : this.variables[3].cost + l10(5) < this.lasta23costs[0] ? this.variables[3].cost + l10(2) < this.variables[8].cost
          : false,
        () => this.lastStronga2 === undefined || this.lasta23 === undefined  || this.lastStronga2Cost === undefined || this.lasta23costs === undefined ? true
          : this.variables[8].level < this.lastStronga2 ? this.variables[4].cost + l10(5) < this.lastStronga2Cost
          : this.variables[4].cost + l10(5) < this.lasta23costs[0] ? this.variables[4].cost + l10(2) < this.variables[8].cost
          : false,
        () => this.lastStronga2 === undefined || this.lasta23 === undefined  || this.lastStronga2Cost === undefined || this.lasta23costs === undefined ? true
          : this.variables[5].cost + l10(5) < this.lasta23costs[1] ? this.variables[5].cost + l10(1.25) < this.variables[9].cost
          : false,
        () => this.lastStronga2 === undefined || this.lasta23 === undefined  || this.lastStronga2Cost === undefined || this.lasta23costs === undefined ? true
          : this.variables[6].cost + l10(5) < this.lasta23costs[1] ? this.variables[6].cost + l10(1.25) < this.variables[9].cost
          : false,
        () => this.variables[7].cost + l10(4 + (this.variables[7].level % 10) / 2) < this.variables[2].cost || this.coasting[2],
        () => this.lastStronga2 === undefined || this.lasta23 === undefined  || this.lastStronga2Cost === undefined || this.lasta23costs === undefined ? true
          : Math.min(this.variables[3].cost, this.variables[4].cost) + l10(5) < this.lastStronga2Cost ? false
          : true,
        () => true,
      ]
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability() {
    const conditions: conditionFunction[] = [
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
    const conditions: conditionFunction[] = [
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
    const conditions: conditionFunction[] = [
      () => false,
      () => this.coasting[2] || this.coasting[7],
      ...new Array(8).fill(() => false)
    ];
    return conditions;
  }
  getTotMult(val: number) {
    return Math.max(0, val * this.tauFactor * 0.09675);
  }
  getMilestonePriority(): number[] {
    return [0, 1, 2, 3, 4];
  }
  updateMilestones(): void {
    const rho = Math.max(this.lastPub, this.maxRho);
    const stage = binaryInsertionSearch(this.milestoneUnlocks, rho);
    this.nextMilestoneCost = this.milestoneUnlocks[stage] || Infinity;
    super.updateMilestones();
    if (this.variables[4].valueScaling instanceof ExponentialValue 
        && this.variables[4].valueScaling.power !== 1.1 + 0.01 * this.milestones[3]) 
    {
      this.variables[4].valueScaling.power = 1.1 + 0.01 * this.milestones[3];
      this.variables[4].reCalculate();
    }
    if (this.variables[6].valueScaling instanceof ExponentialValue 
        && this.variables[6].valueScaling.power !== 1.1 + 0.0125 * this.milestones[4]) 
    {
      this.variables[6].valueScaling.power = 1.1 + 0.0125 * this.milestones[4];
      this.variables[6].reCalculate();
    }
  }
  constructor(data: theoryData) {
    super(data);
    this.R = new Currency("R");
    this.I = new Currency("I");
    this.q = 0;
    this.t_var = 0;
    this.pubUnlock = 10;
    this.milestoneUnlocks = [10, 20, 30, 40, 50, 70, 90, 110, 130, 150, 250, 275, 300, 325];
    this.milestonesMax = [2, 3, 5, 2, 2];
    this.nextMilestoneCost = Infinity;
    this.variables = [
      new Variable({ name: "tdot", currency: this.rho, cost: new ExponentialCost(1e6, 1e6), valueScaling: new ExponentialValue(10) }),
      new Variable({ name: "q1",   currency: this.rho, cost: new FirstFreeCost(new ExponentialCost(10, 1.61328)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "q2",   currency: this.rho, cost: new ExponentialCost(5, 60), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "b1",   currency: this.R,   cost: new FirstFreeCost(new ExponentialCost(20, 200)), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ name: "b2",   currency: this.R,   cost: new ExponentialCost(100, 2), valueScaling: new ExponentialValue(1.1) }),
      new Variable({ name: "c1",   currency: this.I,   cost: new FirstFreeCost(new ExponentialCost(20, 200)), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ name: "c2",   currency: this.I,   cost: new ExponentialCost(100, 2), valueScaling: new ExponentialValue(1.1) }),
      new Variable({ name: "a1",   currency: this.rho, cost: new FirstFreeCost(new ExponentialCost(2000, 2.2, true)), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ name: "a2",   currency: this.R,   cost: new ExponentialCost(500, 2.2, true), valueScaling: new StepwisePowerSumValue(40, 10, 1) }),
      new Variable({ name: "a3",   currency: this.I,   cost: new ExponentialCost(500, 2.2, true), valueScaling: new ExponentialValue(2) }),
    ];

    this.forcedPubRho = Infinity;
    if (this.lastPub < 374 && this.strat !== "EF") {
      let newpubtable: pubTable = pubtable.efdata;
      let pubseek = Math.round(this.lastPub * 32);
      this.forcedPubRho = newpubtable[pubseek.toString()] / 32;
      if (this.forcedPubRho === undefined) this.forcedPubRho = Infinity;
    }
    this.coasting = new Array(this.variables.length).fill(false);
    this.bestRes = null;
    this.doContinuityFork = true;
    this.depth = 0;

    this.doSimEndConditions = () => this.forcedPubRho == Infinity;
    this.updateMilestones();
  }
  copyFrom(other: this): void {
    super.copyFrom(other);

    this.curMult = other.curMult;
    this.R.value = other.R.value;
    this.I.value = other.I.value;
    this.q = other.q;
    this.t_var = other.t_var;
    this.nextMilestoneCost = other.nextMilestoneCost;

    this.lastStronga2 = other.lastStronga2;
    this.lastStronga2Cost = other.lastStronga2Cost;
    this.lasta23 = other.lasta23;
    this.lasta23costs = other.lasta23costs;

    this.forcedPubRho = other.forcedPubRho;
    this.coasting = [...other.coasting];

    this.depth = other.depth + 1;
  }
  copy(): efSim {
    let newsim = new efSim(this.getDataForCopy());
    newsim.copyFrom(this);
    newsim.updateMilestones();
    return newsim;
  }
  async simulate(): Promise<simResult> {
    if (this.forcedPubRho != Infinity) {
      this.pubConditions.push(() => this.maxRho >= this.forcedPubRho);
    }
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      let prev_nextMilestoneCost = this.nextMilestoneCost;
      if (this.lastPub <= 325) this.updateMilestones();
      if (this.nextMilestoneCost > prev_nextMilestoneCost) {
        this.coasting.fill(false);
      }
      await this.buyVariablesFork();
      if (this.forcedPubRho == 375 && this.maxRho >= 370 && this.doContinuityFork) {
        this.doContinuityFork = false;
        const fork = this.copy();
        fork.forcedPubRho = Infinity;
        const res = await fork.simulate();
        this.bestRes = getBestResult(this.bestRes, res);
      }
    }
    this.trimBoughtVars();
    const lastLevels = this.variables.map((variable) => getLastLevel(variable.name, this.boughtVars));
    const result = this.createResult(
      this.strat !== "EF"
        ? ` q1: ${lastLevels[1]} q2: ${lastLevels[2]} a1: ${lastLevels[7]}` +
            (this.settings.showA23 ? ` a2: ${lastLevels[8]} a3: ${lastLevels[9]}` : "")
        : ""
    );
    return getBestResult(result, this.bestRes);
  }
  tick() {
    const logbonus = l10(this.dt) + this.totMult;

    this.q = add(this.q, this.variables[1].value + this.variables[2].value + logbonus);
    this.t_var += this.dt * (this.variables[0].level / 5 + 0.2);

    const b = this.variables[3].value + this.variables[4].value;
    const c = this.variables[5].value + this.variables[6].value;
    const R = b + l10(Math.abs(Math.cos(this.t_var)));
    const I = c + l10(Math.abs(Math.sin(this.t_var)));
    if (this.milestones[0] > 0) this.R.add(logbonus + R * 2);
    if (this.milestones[0] > 1) this.I.add(logbonus + I * 2);
    
    const a = this.milestones[1] > 0 ? (this.variables[7].value + this.variables[8].value + this.variables[9].value) * (0.1 * this.milestones[2] + 1) : 0;
    switch (this.milestones[0]) {
      case 0:
        this.rho.add(logbonus + (l10(this.t_var) + this.q * 2) / 2);
        break;
      case 1:
        this.rho.add(logbonus + add(l10(this.t_var) + this.q * 2, this.R.value * 2) / 2);
        break;
      case 2:
        this.rho.add(logbonus + a + add(l10(this.t_var) + this.q * 2, this.R.value * 2, this.I.value * 2) / 2);
        break;
    }
  }
  extraBuyingCondition(id: number): boolean {
    return !this.coasting[id];
  }
  async confirmPurchase(id: number): Promise<boolean> {
    const nextCoast = Math.min(this.forcedPubRho, this.nextMilestoneCost);
    const lowbounds = [0, 0.6, 0.2, 0, 0, 0, 0, 0.3, 0, 0];
    const highbounds = [0, 1.8, 1.5, 0, 0, 0, 0, 1.5, 0, 0];
    const doDynamicCoasting = this.forcedPubRho == Infinity && this.strat != "EF";
    
    if (this.forcedPubRho - this.variables[id].cost <= lowbounds[id] || (doDynamicCoasting && this.getForcedDynamicCoastingConditions()[id]())) {
      this.coasting[id] = true;
      return false;
    }
    if (nextCoast - this.variables[id].cost < highbounds[id] || (doDynamicCoasting && this.getDynamicCoastingConditions()[id]())) {
      if (this.depth > 100) {
        throw "Max coasting research depth reached. Please contact the authors of the sim."
      }
      let fork = this.copy();
      fork.coasting[id] = true;
      const forkres = await fork.simulate();
      this.bestRes = getBestResult(this.bestRes, forkres);
    }
    return true;
  }
}
