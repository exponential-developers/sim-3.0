import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Currency from "../../Utils/currency";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, getR9multiplier, toCallables, getLastLevel, getBestResult } from "../../Utils/helpers";

export default async function t3(data: theoryData): Promise<simResult> {
  let res;
  if(!data.strat.includes("Coast")) {
    const sim = new t3Sim(data);
    res = await sim.simulate();
  }
  else {
    let data2: theoryData = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("Coast", "");
    const sim1 = new t3Sim(data2);
    const res1 = await sim1.simulate();
    const lastB2 = getLastLevel("b2", res1.boughtVars);
    const lastB3 = getLastLevel("b3", res1.boughtVars);
    let sim2 = new t3Sim(data);
    sim2.variables[1].setOriginalCap(lastB2);
    sim2.variables[1].configureCap(9);
    sim2.variables[2].setOriginalCap(lastB3);
    sim2.variables[2].configureCap(9);
    res = await sim2.simulate();
  }
  return res;
}

type theory = "T3";

class t3Sim extends theoryClass<theory> {
  rho2: Currency;
  rho3: Currency;

  getBuyingConditions(): conditionFunction[] {
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      T3Play2: [
        () => (this.lastPub - this.maxRho > 1 ? this.variables[0].cost + l10(8) < this.variables[9].cost : false),
        () => (this.curMult < 1.2 ? this.variables[1].cost + l10(5) < this.variables[10].cost : this.variables[1].cost + l10(8) < this.variables[4].cost) || this.curMult > 2.4,
        () => (this.curMult < 2.4 ? this.variables[2].cost + l10(8) < this.variables[8].cost : true),
        false,
        () => (this.curMult < 1.2 ? this.variables[4].cost + 2 < this.variables[10].cost : true),
        false,
        false,
        () => (this.curMult < 1.2 ? this.variables[7].cost + l10(1 / (2 / 5)) < this.variables[10].cost : this.variables[7].cost + l10(8) < this.variables[4].cost),
        true,
        () => this.lastPub - this.maxRho > 1,
        () => (this.curMult < 1.2 ? true : this.curMult < 2.4 ? this.variables[10].cost + l10(8) < this.variables[4].cost : false),
        () => (this.curMult < 1.2 ? this.variables[11].cost + l10(10) < this.variables[8].cost : false),
      ],
      T3Play: [
        () => (this.curMult < 2 ? this.variables[0].cost + l10(8) < this.variables[9].cost : false),
        () => this.curMult < 2 
          ? this.variables[1].cost + l10(4) < Math.min(this.variables[4].cost, this.variables[10].cost) 
            && this.variables[1].cost + l10(2) < this.variables[7].cost 
          : true,
        () => this.variables[2].cost + l10(8) < this.variables[8].cost && this.variables[2].cost + l10(2) < this.variables[11].cost,
        false,
        true,
        false,
        false,
        () => (this.curMult < 2 ? this.variables[7].cost + l10(2) < Math.min(this.variables[4].cost, this.variables[10].cost) : true),
        true,
        () => this.curMult < 2,
        true,
        () => this.variables[11].cost + l10(4) < this.variables[8].cost,
      ],
      T3SnaxCoast: [
        () => this.curMult < 1,
        () => this.variables[1].shouldBuy,
        () => this.variables[2].shouldBuy,
        false,
        true,
        false,
        false,
        true,
        true,
        () => this.curMult < 1,
        () => this.curMult < 1,
        () => this.curMult < 1,
      ],
      T3Snax: [
        () => this.curMult < 1,
        true,
        true,
        false,
        true,
        false,
        false,
        true,
        true,
        () => this.curMult < 1,
        () => this.curMult < 1,
        () => this.curMult < 1,
      ],
      T3SnaxdC12: [
        () => this.curMult < 1,
        true,
        true,
        false,
        () => (this.curMult < 1 ? this.variables[4].cost + 2 < this.variables[10].cost : true),
        false,
        false,
        true,
        true,
        () => this.curMult < 1,
        () => this.curMult < 1,
        () => this.curMult < 1,
      ],
      T3Snax2: [
        () => (this.curMult < 1 ? this.variables[0].cost + 1 < this.rho.value : false),
        () => this.variables[1].cost + l10(3) < this.rho2.value,
        () => this.variables[2].cost + l10(5) < this.rho3.value,
        false,
        () => (this.curMult < 1 ? this.variables[4].cost + 2 < this.rho.value : true),
        false,
        false,
        () => (this.curMult < 1 ? true : this.variables[7].cost + l10(8) < this.rho2.value),
        true,
        () => this.curMult < 1,
        () => this.curMult < 1,
        () => (this.curMult < 1 ? this.variables[11].cost + 1 < this.rho3.value : false),
      ],
      T3P2C23d: [
        false,
        () => this.variables[1].cost + l10(3) < Math.min(this.variables[4].cost, this.variables[7].cost, this.variables[10].cost),
        () => this.variables[2].cost + l10(9) < this.variables[8].cost,
        false,
        true,
        false,
        false,
        true,
        true,
        false,
        true,
        false,
      ],
      T3P2C23C33d: [
        false,
        () => this.variables[1].cost + l10(3) < Math.min(this.variables[4].cost, this.variables[7].cost, this.variables[10].cost),
        () => this.variables[2].cost + l10(9) < this.variables[8].cost,
        false,
        true,
        false,
        false,
        true,
        true,
        false,
        true,
        true,
      ],
      T3P2C23: [false, true, true, false, true, false, false, true, true, false, true, false],
      T3P2C23C33: [false, true, true, false, true, false, false, true, true, false, true, true],
      T3P2C23C33Coast: [
        false,
        () => this.variables[1].shouldBuy,
        () => this.variables[2].shouldBuy,
        false, true, false, false, true, true, false, true, true
      ],
      T3noC11C13C21C33d: [
        () => this.variables[0].cost + l10(8) < this.variables[9].cost,
        () => this.variables[1].cost + l10(5) < Math.min(this.variables[4].cost, this.variables[7].cost, this.variables[10].cost),
        () => this.variables[2].cost + l10(8) < this.variables[8].cost,
        false,
        true,
        false,
        false,
        true,
        true,
        true,
        true,
        false,
      ],
      T3noC11C13C21C33: [true, true, true, false, true, false, false, true, true, true, true, false],
      T3noC13C33d: [
        () => this.variables[0].cost + l10(10) < Math.min(this.variables[3].cost, this.variables[6].cost, this.variables[9].cost),
        () => this.variables[1].cost + l10(4) < Math.min(this.variables[4].cost, this.variables[7].cost, this.variables[10].cost),
        () => this.variables[2].cost + l10(10) < this.variables[8].cost,
        true,
        true,
        false,
        true,
        true,
        true,
        true,
        true,
        false,
      ],
      T3noC13C33: [true, true, true, true, true, false, true, true, true, true, true, false],
      T3noC11C13C33d: [
        () => this.variables[0].cost + l10(10) < Math.min(this.variables[6].cost, this.variables[9].cost),
        () => this.variables[1].cost + l10(4) < Math.min(this.variables[4].cost, this.variables[7].cost, this.variables[10].cost),
        () => this.variables[2].cost + l10(10) < this.variables[8].cost,
        false,
        true,
        false,
        true,
        true,
        true,
        true,
        true,
        false,
      ],
      T3noC11C13C33: [
        true,
        true,
        true,
        false,
        true,
        false,
        true,
        true,
        true,
        true,
        true,
        false,
      ],
      T3noC13C32C33d: [
        () => this.variables[0].cost + l10(8) < Math.min(this.variables[3].cost, this.variables[6].cost, this.variables[9].cost),
        () => this.variables[1].cost + l10(5) < Math.min(this.variables[4].cost, this.variables[7].cost),
        () => this.variables[2].cost + l10(8) < this.variables[8].cost,
        true,
        true,
        false,
        true,
        true,
        true,
        true,
        false,
        false,
      ],
      T3noC13C32C33: [true, true, true, true, true, false, true, true, true, true, false, false],
      T3C11C12C21d: [
        () => this.variables[0].cost + l10(7) < Math.min(this.variables[3].cost, this.variables[6].cost),
        () => this.variables[1].cost + l10(7) < this.variables[4].cost,
        false,
        true,
        true,
        false,
        true,
        false,
        false,
        false,
        false,
        false,
      ],
      T3C11C12C21: [true, true, false, true, true, false, true, false, false, false, false, false],
      T3: new Array(12).fill(true), //t3
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = [
      () => true,
      () => true,
      () => this.milestones[0] > 0,
      () => true,
      () => true,
      () => this.milestones[0] > 0,
      () => true,
      () => true,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 0,
    ];
    return conditions;
  }
  getMilestonePriority(): number[] {
    return [1, 2, 0, 3];
  }
  getTotMult(val: number): number {
    return Math.max(0, val * 0.147 + l10(3)) + getR9multiplier(this.sigma);
  }
  constructor(data: theoryData) {
    super(data);
    this.rho.symbol = "rho_1";
    this.rho2 = new Currency("rho_2");
    this.rho3 = new Currency("rho_3");
    this.pubUnlock = 9;
    this.milestoneUnlockSteps = 25;
    //milestones  [dimensions, b1exp, b2exp, b3exp]
    this.milestonesMax = [1, 2, 2, 2];
    this.variables = [
      new Variable({ name: "b1",  currency: this.rho,  cost: new FirstFreeCost(new ExponentialCost(10, 1.18099)), valueScaling: new StepwisePowerSumValue() }), //b1
      new Variable({ name: "b2",  currency: this.rho2, cost: new ExponentialCost(10, 1.308), valueScaling: new StepwisePowerSumValue() }), //b2
      new Variable({ name: "b3",  currency: this.rho3, cost: new ExponentialCost(3000, 1.675), valueScaling: new StepwisePowerSumValue() }), //b3
      new Variable({ name: "c11", currency: this.rho,  cost: new ExponentialCost(20, 6.3496), valueScaling: new ExponentialValue(2) }), //c11
      new Variable({ name: "c12", currency: this.rho2, cost: new ExponentialCost(10, 2.74), valueScaling: new ExponentialValue(2) }), //c12
      new Variable({ name: "c13", currency: this.rho3, cost: new ExponentialCost(1000, 1.965), valueScaling: new ExponentialValue(2) }), //c13
      new Variable({ name: "c21", currency: this.rho,  cost: new ExponentialCost(500, 18.8343), valueScaling: new ExponentialValue(2) }), //c21
      new Variable({ name: "c22", currency: this.rho2, cost: new ExponentialCost(1e5, 3.65), valueScaling: new ExponentialValue(2) }), //c22
      new Variable({ name: "c23", currency: this.rho3, cost: new ExponentialCost(1e5, 2.27), valueScaling: new ExponentialValue(2) }), //c23
      new Variable({ name: "c31", currency: this.rho,  cost: new ExponentialCost(1e4, 1248.27), valueScaling: new ExponentialValue(2) }), //c31
      new Variable({ name: "c32", currency: this.rho2, cost: new ExponentialCost(1e3, 6.81744), valueScaling: new ExponentialValue(2) }), //c32
      new Variable({ name: "c33", currency: this.rho3, cost: new ExponentialCost(1e5, 2.98), valueScaling: new ExponentialValue(2) }), //c33
    ];

    this.updateMilestones();
  }
  async simulate(): Promise<simResult> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 175) this.updateMilestones();
      this.buyVariables();
      if(this.variables[1].shouldFork) await this.doForkVariable(1);
      if(this.variables[2].shouldFork) await this.doForkVariable(2);
    }
    this.trimBoughtVars();
    let stratExtra = "";
    if(this.strat.includes("Coast")) {
      stratExtra += this.variables[1].prepareExtraForCap(getLastLevel("b2", this.boughtVars)) +
          this.variables[2].prepareExtraForCap(getLastLevel("b3", this.boughtVars));
    }
    return getBestResult(this.createResult(stratExtra), this.bestForkRes);
  }
  tick() {
    const vb1 = this.variables[0].value * (1 + 0.05 * this.milestones[1]);
    const vb2 = this.variables[1].value * (1 + 0.05 * this.milestones[2]);
    const vb3 = this.variables[2].value * (1 + 0.05 * this.milestones[3]);

    const rhodot = add(this.variables[3].value + vb1, this.variables[4].value + vb2, this.variables[5].value + vb3);
    this.rho.add(l10(this.dt) + this.totMult + rhodot);

    const rho2dot = add(this.variables[6].value + vb1, this.variables[7].value + vb2, this.variables[8].value + vb3);
    this.rho2.add(l10(this.dt) + this.totMult + rho2dot);

    const rho3dot = add(this.variables[9].value + vb1, this.variables[10].value + vb2, this.variables[11].value + vb3);
    if (this.milestones[0] > 0) this.rho3.add(l10(this.dt) + this.totMult + rho3dot);
  }
  copyFrom(other: this) {
    super.copyFrom(other);
    this.rho2 = other.rho2.copy();
    this.rho3 = other.rho3.copy();
    for(let varIndex of [1, 4, 7, 10]) {
      this.variables[varIndex].currency = this.rho2;
    }
    for(let varIndex of [2, 5, 8, 11]) {
      this.variables[varIndex].currency = this.rho3;
    }
  }
  copy() {
    let sim = new t3Sim(this.getDataForCopy());
    sim.copyFrom(this);
    return sim;
  }
  onVariablePurchased(id: number) {
    if(
        [1, 2].includes(id) &&
        this.strat.includes("Coast") &&
        this.variables[id].shouldBuy &&
        this.variables[id].coastingCapReached() &&
        // For this strat, there is no sense to test levels above cap:
        !this.variables[id].aboveOriginalCap()
    ) {
      this.variables[id].shouldFork = true;
    }
  }
}
