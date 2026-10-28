import { global } from "../../Sim/main";
import Variable from "../../Utils/variable";
import { ExponentialValue, LinearValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { l10, toCallables, getLastLevel, getBestResult, add2, subtract, defaultResult, add } from "../../Utils/helpers";
import { traditionalConverter } from "../../Utils/progressConversion";
import traditionalTheoryClass from "../traditionalTheory";

let activePubTable: Record<string, string> = {}
let passivePubTable: Record<string, string> = {};

type theory = "BD";

const tauFactor = 0.4;
const K_TIME_DIVISOR = l10(3);
const Q_ETA_SCALE = 10;

const converter: ProgressValueConverterRho = traditionalConverter({
  tauFactor,
  multExponent: 0.375
});

const BD: TheoryInterface<theory> = {
  simulate: bd,
  converter
};

export default BD;

async function bd(data: theoryData<theory>): Promise<simResult<theory>> {
  if (!data.strat.includes("Coast")) {
    const sim = new bdSim(data);
    const res = await sim.simulate();
    return res;
  }
  else {
    let data2: theoryData<theory> = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("Coast", "").replace("PT", "") as stratType[theory];
    let res1 = await new bdSim(data2).simulate();

    let vars = ["a1", "b1", "c1"];
    let indexes = [0, 2, 4];
    let caps = [2, 2, 2];

    let sim2 = new bdSim(data);
    for(let i = 0; i < 3; i++) {
      let lastVal = getLastLevel(vars[i], res1.boughtVars);
      sim2.variables[indexes[i]].setOriginalCap(lastVal);
      sim2.variables[indexes[i]].configureCap(caps[i]);
    }
    return await sim2.simulate();
  }
}

class bdSim extends traditionalTheoryClass<theory> {
  q: number;
  k: number;
  cachedRowTerm: number;
  rowTermIsDirty: boolean;

  rhodot: number = -Infinity;
  qdot: number = -Infinity;
  kdot: number = -Infinity;

  koalaB1Purchased: number = 0; koalaSwap: number = 0;

  getBuyingConditions(): conditionFunction[] {
    const BD = [
      () => this.variables[0].shouldBuy,
      () => true,
      () => this.variables[2].shouldBuy,
      () => true,
      () => this.variables[4].shouldBuy,
      () => true,
      () => true,
    ];
    const BD2 = [
      () => this.variables[0].shouldBuy,
      () => true,
      () => this.variables[2].shouldBuy && (this.variables[2].level === 0 || (10 ** this.k) >= Math.floor(this.variables[6].value / 2)),
      () => (10 ** this.k) >= Math.floor(this.variables[6].value / 2),
      () => this.variables[4].shouldBuy,
      () => true,
      () => true,
    ];

    const koala = [
      () => this.variables[0].shouldBuy,
      () => true,
      () => this.variables[2].shouldBuy && (this.milestones[4] > 0 || (10 ** this.k) >= Math.floor(this.variables[6].value / 2) - 0.001 && this.variables[2].value + this.variables[3].value < this.variables[4].value + this.variables[5].value - 1),
      () => true,
      () => this.variables[4].shouldBuy,
      () => true,
      () => true,
    ];

    const conditions: Record<stratType[theory], conditionFunction[]> = {
      BD: BD,
      BDCoast: BD,

      BD2: BD2,
      BD2Coast: BD2,

      BDKoala: koala,
      BDKoalaCoast: koala,
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
  getMilestonePriority(): number[] {
    if (this.strat.includes("BDKoala") && this.koalaSwap === 0) {
      if (this.koalaB1Purchased > 20) return [1, 2, 0, 3];
      this.koalaSwap = this.variables[2].level;
    }

    return [1, 2, 0, 3, 4, 5, 7, 8, 6];
  }
  constructor(data: theoryData<theory>) {
    super(data, converter, {
      pubUnlockRho: 8
    });
    this.q = 0;
    this.k = -Infinity;
    this.cachedRowTerm = 0;
    this.rowTermIsDirty = true;
    this.milestoneUnlocks = [4, 10, 25, 45, 65, 130, 190, 250, 310, 340, 370, 400, 425, 455, 485, 535, 585].map(value => value / tauFactor);
    this.milestonesMax = [3, 1, 1, 1, 6, 1, 2, 1, 1];
    this.variables = [
      new Variable({ currency: this.rho, name: "a1", cost: new FirstFreeCost(new ExponentialCost(10, 0.82, true)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ currency: this.rho, name: "a2", cost: new ExponentialCost(1e3, 9, true), valueScaling: new ExponentialValue() }),
      new Variable({ currency: this.rho, name: "b1", cost: new ExponentialCost(1e4, 0.95, true), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ currency: this.rho, name: "b2", cost: new ExponentialCost(1e15, 10.2, true), valueScaling: new ExponentialValue() }),
      new Variable({ currency: this.rho, name: "c1", cost: new ExponentialCost(50, 1.015, true), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ currency: this.rho, name: "c2", cost: new ExponentialCost(1e25, 10.15, true), valueScaling: new ExponentialValue() }),
      new Variable({ currency: this.rho, name: "n", cost: new ExponentialCost(20, 2.573, true), valueScaling: new LinearValue(1, 1) })
    ];
    this.updateMilestonesNoMS();
    this.updatedCachedValues();
  }
  updateMilestonesNoMS(): boolean {
    let changed = super.updateMilestonesNoMS();
    if (changed) {
      this.updatedCachedValues();
      this.rowTermIsDirty = true;
    }
    return changed;
  }
  updateMilestones(): void {
    if (this.strat.startsWith("BDKoala")) {
      super.updateMilestones();
      this.updatedCachedValues();
      this.rowTermIsDirty = true;
      this.koalaB1Purchased = Infinity;
    } else {
      this.updateMilestonesNoMS();
    }
  }
  async simulate(): Promise<simResult<theory>> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      this.updateMilestones();
      this.buyVariables();
      for(let i = 0; i < 7; i++) {
        if (this.variables[i].shouldFork) await this.doForkVariable(i);
      }
      this.pubTableCollector.collectData(this);
    }
    let stratExtra = '';
    this.trimBoughtVars();
    if (this.strat.includes("Koala") && this.koalaSwap > 0) {
      stratExtra += ` ${this.koalaSwap}`;
    }
    if (this.strat.includes("Coast")) {
      let vars = ["a1", "b1", "c1"];
      let indexes = [0, 2, 4];
      for (let i = 0; i < 3; i++) {
        stratExtra += this.variables[indexes[i]].prepareExtraForCap(getLastLevel(vars[i], this.boughtVars));
      }
    }
    return getBestResult(this.createResult(stratExtra), this.bestForkRes);
  }
  getRowTerms = (row: number, position: number) => {
    let target = Math.floor(row / 2), pos = Math.min(target, Math.max(0, Math.floor(position)));
    let coefficient = 0;
    let sum = -Infinity, second = -Infinity, fourth = -Infinity;
    if (pos === target) {
      for (let j = 1; j <= Math.floor(row / 2); j++) {
        coefficient += l10(row - j + 1) - l10(j);
      }
      sum = row * l10(2);
      second = sum + l10(row) - l10(4);
      fourth = sum + subtract(l10(3) + l10(row) * 2, l10(2) + l10(row)) - l10(16);
    } else {
      for (let j = 0; j <= pos; j++) {
        if (j > 0) coefficient += l10(row - j + 1) - l10(j);
        let copies = (2 * j === row) ? 1 : 2;
        let term = coefficient + l10(copies);
        let distance = Math.abs(j - row / 2);

        sum = add2(sum, term);
        second = add2(second, term + l10(distance) * 2);
        fourth = add2(fourth, term + l10(distance) * 4);
      }
    }
    return { coefficient, sum, second, fourth };
  };
  updateRowTerm() {
    let row = this.variables[6].value, target = Math.floor(row / 2);
    let position = Math.min(target, Math.floor(10 ** this.k + 0.0001));
    let terms = this.getRowTerms(row, position);
    let reward = this.milestones[5] > 0 ? terms.sum : terms.coefficient;
    if (this.milestones[7] > 0) reward = add2(reward, l10(4) + terms.second - l10(1 + row));
    if (this.milestones[8] > 0) reward = add2(reward, l10(16) + terms.fourth - l10(1 + row) * (2 - 0.1 * this.milestones[6]));
    if (this.milestones[3] > 0) reward += l10(1 + row);
    this.cachedRowTerm = reward;
    this.rowTermIsDirty = false;
  }
  updatedCachedValues() {
    const va1 = this.variables[0].value, va2 = this.variables[1].value;
    const vb1 = this.variables[2].value, vb2 = this.milestones[1] > 0 ? this.variables[3].value : 0;
    const vc1 = this.variables[4].value, vc2 = this.milestones[2] > 0 ? this.variables[5].value : 0;

    const eta = 1 + 0.01 * this.milestones[4];
    
    this.kdot = (vc1 + vc2) * eta - (add(0, vb1 + vb2, (vc1 + vc2) * eta) + K_TIME_DIVISOR + l10(2) * this.milestones[4]);
    this.qdot = (vb1 + vb2 + vc1 + vc2) / 2;
    this.rhodot = this.totMult + va1 * (1 + 0.05 * this.milestones[0]) + va2;
  }
  tick() {
    const target = l10(Math.floor(this.variables[6].value / 2));
    if (this.k < target) {
      const oldPosition = Math.floor(10 ** this.k + 0.0001);
      this.k = add2(this.k, this.kdot + l10(this.dt));
      this.k = Math.min(this.k, target);

      if (Math.floor(10 ** this.k + 0.0001) !== oldPosition) this.rowTermIsDirty = true;
    }
    if (this.rowTermIsDirty) this.updateRowTerm();

    this.q = add2(this.q, this.qdot + this.cachedRowTerm + add2(0, this.k) * (Q_ETA_SCALE * 0.01 * this.milestones[4]) + l10(this.dt));
    this.rho.add(this.rhodot + this.q + l10(this.dt));
  }
  copyFrom(other: this) {
    super.copyFrom(other);
    this.q = other.q;
    this.k = other.k;
    this.cachedRowTerm = other.cachedRowTerm;
    this.rowTermIsDirty = true;
    this.koalaB1Purchased = other.koalaB1Purchased; this.koalaSwap = other.koalaSwap;
    this.updatedCachedValues();
  }
  copy() {
    let copySim = new bdSim(this.getDataForCopy());
    copySim.copyFrom(this);
    return copySim;
  }
  onAnyVariablePurchased(): void {
    this.updatedCachedValues();
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

    if (id == 2 && this.strat.includes("BDKoala") && this.koalaSwap === 0) {
      if (this.koalaB1Purchased === Infinity) this.koalaB1Purchased = 0;
      this.koalaB1Purchased++;
    }
  }
}
