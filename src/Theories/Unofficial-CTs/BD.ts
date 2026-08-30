import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, LinearValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { l10, toCallables, parseLog10String, add, getLastLevel, getBestResult, getFactorial } from "../../Utils/helpers";

export default async function bd(data: theoryData): Promise<simResult> {
  if(!data.strat.includes("Coast")) {
    const sim = new bdSim(data);
    const res = await sim.simulate();
    return res;
  }
  else {
    let data2: theoryData = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("Coast", "");
    const sim1 = new bdSim(data2);
    const res1 = await sim1.simulate();
    let vars = ["a1", "b1", "c1"];
    let indexes = [0, 2, 4];
    let caps = [5, 5, 5];
    if(!data2.strat.includes("BDd")) {
      // Raise the semi-idle cap.
      caps[1] = 10;
      caps[2] = 10;
    }
    let sim2 = new bdSim(data);
    for(let i = 0; i < 3; i++) {
      let lastVal = getLastLevel(vars[i], res1.boughtVars);
      sim2.variables[indexes[i]].setOriginalCap(lastVal);
      sim2.variables[indexes[i]].configureCap(caps[i]);
    }
    return await sim2.simulate();
  }
}

type theory = "BD";

class bdSim extends theoryClass<theory> {
  static  SYMMETRY_STEP = 0.25;
  static LATE_BOOST_STEP = 0.05;
  static K_TIME_DIVISOR = 60;

  q: number;
  k: number;
  cachedRowTerm: number;
  rowTermIsDirty: boolean;

  getBuyingConditions(): conditionFunction[] {
    const conditions: Record<stratType[theory], conditionFunction[]> = {
      BD: [
        () => true,
        () => true,
        () => true,
        () => true,
        () => true,
        () => true,
        () => true,
      ],
      BDCoast: [
        () => this.variables[0].shouldBuy,
        () => true,
        () => this.variables[2].shouldBuy,
        () => true,
        () => this.variables[4].shouldBuy,
        () => true,
        () => true,
      ],
      BDd: [
        () => this.variables[0].cost + l10(9 + 0.956581 + 0.00221792 * this.variables[0].level % 10) + l10(1 + 0.05 * this.milestones[0]) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost, this.variables[6].value),
        () => true,
        () => this.variables[2].cost + l10(9 + 0.956581 + 0.00221792 * this.variables[2].level % 10) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost, this.variables[6].value),
        () => true,
        () => this.variables[4].cost + l10(9 + 0.956581 + 0.00221792 * this.variables[4].level % 10) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost, this.variables[6].value),
        () => true,
        () => true,
      ],
      BDdCoast: [
        () => this.variables[0].shouldBuy && (this.variables[0].cost + l10(9 + 0.956581 + 0.00221792 * this.variables[0].level % 10) + l10(1 + 0.05 * this.milestones[0]) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost, this.variables[6].value)),
        () => true,
        () => this.variables[2].shouldBuy && (this.variables[2].cost + l10(9 + 0.956581 + 0.00221792 * this.variables[2].level % 10) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost, this.variables[6].value)),
        () => true,
        () => this.variables[4].shouldBuy && (this.variables[4].cost + l10(9 + 0.956581 + 0.00221792 * this.variables[4].level % 10) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost, this.variables[6].value)),
        () => true,
        () => true,
      ],
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = [
      () => true,
      () => true,
      () => true,
      () => this.milestones[1] > 0,
      () => true,
      () => this.milestones[2] > 0,
      () => true,
    ];
    return conditions;
  }
  getTotMult(val: number): number {
    return Math.max(0, val * this.tauFactor * 0.375);
  }
  getMilestonePriority(): number[] {
    return [1, 2, 0, 3, 4, 5, 6];
  }
  constructor(data: theoryData) {
    super(data);
    this.q = 0;
    this.k = -Infinity;
    this.cachedRowTerm = 0;
    this.rowTermIsDirty = true;
    this.pubUnlock = 8;
    this.milestoneUnlocks = [4, 10, 25, 45, 65, 90, 130, 190, 250, 310, 340, 370, 400, 425, 445, 455, 465, 475, 485, 510, 535, 560, 585].map(value => value / this.tauFactor);
    this.milestonesMax = [3, 1, 1, 4, 6, 4, 4];
    this.totMult = data.rho < this.pubUnlock ? 0 : this.getTotMult(data.rho);
    this.variables = [
      new Variable({ name: "a1", cost: new FirstFreeCost(new ExponentialCost(10, 0.82, true)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "a2", cost: new ExponentialCost(1e3, 9, true), valueScaling: new ExponentialValue() }),
      new Variable({ name: "b1", cost: new ExponentialCost(1e4, 0.95, true), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "b2", cost: new ExponentialCost(1e15, 11, true), valueScaling: new ExponentialValue() }),
      new Variable({ name: "c1", cost: new ExponentialCost(50, 1.015, true), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ name: "c2", cost: new ExponentialCost(1e25, 10.15, true), valueScaling: new ExponentialValue() }),
      new Variable({ name: "n", cost: new ExponentialCost(20, 2.5615, true), valueScaling: new LinearValue(1, 1) })
    ];
    this.updateMilestones();
  }
  updateMilestones() {
    const prev_ms = this.milestones.reduce((p, c) => p+c, 0);
    super.updateMilestones();
    const new_ms = this.milestones.reduce((p, c) => p+c, 0);
    // Only update this if sum of milestones changed
    if (new_ms > prev_ms) this.rowTermIsDirty = true;
  }
  async simulate(): Promise<simResult> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      this.updateMilestones();
      this.buyVariables();
      for(let i = 0; i < 7; i++) {
        if(this.variables[i].shouldFork) await this.doForkVariable(i);
      }
    }
    let stratExtra = '';
    this.trimBoughtVars();
    if(this.strat.includes("Coast")) {
      let vars = ["a1", "b1", "c1"];
      let indexes = [0, 2, 4]
      for (let i = 0; i < 3; i++) {
        stratExtra += this.variables[indexes[i]].prepareExtraForCap(getLastLevel(vars[i], this.boughtVars));
      }
    }
    return getBestResult(this.createResult(stratExtra), this.bestForkRes);
  }
  getBinomialCoefficient(n: number, k: number): number {
    return getFactorial(n) - getFactorial(k) - getFactorial(n - k);
  }
  getPartialSum(n: number, k: number): number {
    k = Math.min(k, n-k);
    if (k == Math.floor(n/2)) return n * l10(2);
    let c = 0;
    let s = 0;
    for (let i=1; i<=k; i++) {
      c = c + l10(n-i+1) - l10(i);
      s = add(s, c);
    }
    return s + l10(2);
  }
  getPolynomialExponent(): number {
    let result = 0.25 * this.milestones[3]; // 1
    result += bdSim.SYMMETRY_STEP * this.milestones[4]; // 1.5
    result += bdSim.LATE_BOOST_STEP * this.milestones[6]; // 0.2
    return result;
  }
  updateRowTerm() {
    const n = this.variables[6].value;
    const target = Math.floor(this.variables[6].value / 2);

    const k = Math.min(target, Math.floor(10 ** this.k));

    const fullRowFraction = this.milestones[5] / this.milestonesMax[5];

    let baseTerm;
    if (this.milestones[5] === 0)
      baseTerm = this.getBinomialCoefficient(n, k);
    else if (this.milestones[5] === this.milestonesMax[5])
      baseTerm = this.getPartialSum(n, k);
    else
      baseTerm = this.getBinomialCoefficient(n, k) * (1 - fullRowFraction)
      + this.getPartialSum(n, k) * fullRowFraction;

    this.cachedRowTerm = baseTerm + this.getPolynomialExponent() * l10(1 + n);
    this.rowTermIsDirty = false;
  }
  tick() {
    const target = l10(Math.floor(this.variables[6].value / 2));
    const vb2 = this.milestones[1] > 0 ? this.variables[3].value : 0;
    const vc2 = this.milestones[2] > 0 ? this.variables[5].value : 0;

    // Updates k
    if (this.k < target) {
        const prev_k = this.k;
        const symmetrySpeed = bdSim.SYMMETRY_STEP * this.milestones[4];
        const dk = l10(this.dt) + vc2 + symmetrySpeed - l10(bdSim.K_TIME_DIVISOR);
        this.k = add(this.k, dk);
        this.k = Math.min(this.k, target);
        if (this.k > prev_k) {
            this.rowTermIsDirty = true;
        }
    }
    // Updates cached rho term
    if (this.rowTermIsDirty) {
        this.updateRowTerm();
    }

    const variableTerm = (this.variables[2].value + vb2 + this.variables[4].value + vc2) * 0.5;
    this.q = add(this.q, l10(this.dt) + variableTerm + this.cachedRowTerm);

    let drho = (1 + 0.05 * this.milestones[0]) * this.variables[0].value + this.variables[1].value;
    this.rho.add(l10(this.dt) + this.totMult + drho + this.q);
  }
  copyFrom(other: this) {
    super.copyFrom(other);
    this.q = other.q;
    this.k = other.k;
    this.cachedRowTerm = other.cachedRowTerm;
    this.rowTermIsDirty = true;
  }
  copy() {
    let copySim = new bdSim(this.getDataForCopy());
    copySim.copyFrom(this);
    return copySim;
  }
  onVariablePurchased(id: number): void {
    if(
        [0, 2, 4].includes(id) &&
        this.strat.includes("Coast") &&
        this.variables[id].shouldBuy &&
        this.variables[id].coastingCapReached() &&
        !this.variables[id].aboveOriginalCap()
    ) {
      this.variables[id].shouldFork = true;
    }
    if (id == 6) this.rowTermIsDirty = true;
  }
}
