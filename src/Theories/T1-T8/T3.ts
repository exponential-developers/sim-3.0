import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Currency from "../../Utils/currency";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, getR9multiplier, toCallables, getLastLevel } from "../../Utils/helpers";

async function runT3Coast(
    data: theoryData,
    targetB2: number,
    origB2: number,
    targetB3: number,
    origB3: number,
): Promise<simResult> {
  const sim = new t3Sim(data);
  sim.lastB2 = targetB2;
  sim.lastB2Orig = origB2;
  sim.lastB3 = targetB3;
  sim.lastB3Orig = origB3;
  return sim.simulate();
}

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
    res = res1;
    for(let limB2 = 0; limB2 < 10; limB2++) {
      if(lastB2 - limB2 <= 1) {
        break;
      }
      for(let limB3 = 0; limB3 < 10; limB3++) {
        if(lastB3 - limB3 <= 1) {
          break;
        }
        if(limB2 === limB3 && limB2 === 0) {
          continue;
        }
        const resN = await runT3Coast(data, lastB2 - limB2, lastB2, lastB3 - limB3, lastB3)
        if(resN.tauH > res.tauH) {
          res = resN;
        }
      }
    }
  }
  return res;
}

type theory = "T3";

class t3Sim extends theoryClass<theory> {
  rho2: Currency;
  rho3: Currency;
  lastB2: number;
  lastB2Orig: number;
  lastB3: number;
  lastB3Orig: number;

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
        () => this.variables[1].level < this.lastB2,
        () => this.variables[2].level < this.lastB3,
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
    this.lastB2 = -1;
    this.lastB2Orig = -1;
    this.lastB3 = -1;
    this.lastB3Orig = -1;
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
    }
    this.trimBoughtVars();
    let stratExtra = "";
    if(this.strat.includes("Coast")) {
      let lastB2Level = getLastLevel("b2", this.boughtVars) || this.lastB2;
      stratExtra += ` b2: ${lastB2Level}`;
      // stratExtra += ` b2delta: ${this.lastB2Orig - lastB2Level}`;

      let lastB3Level = getLastLevel("b3", this.boughtVars) || this.lastB3;
      stratExtra += ` b3: ${lastB3Level}`;
      // stratExtra += ` b3delta: ${this.lastB3Orig - lastB3Level}`;
    }
    return this.createResult(stratExtra);
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
}
