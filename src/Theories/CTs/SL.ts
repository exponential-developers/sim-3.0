import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, l2 } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import theoryClass from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';

export default async function sl(data: theoryData): Promise<simResult> {
  const sim = new slSim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "SL";

class slSim extends theoryClass<theory> {
  rho2: number;
  rho3: number;
  inverseE_Gamma: number;

  getBuyingConditions() {
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      SL: [true, true, true, true],
      SLStopA: [() => this.curMult < 4.5, () => this.curMult < 4.5, () => this.curMult < 6, () => this.curMult < 6],
      SLStopAd: [
        () => this.curMult < 4.5 && this.variables[0].cost + l10(2 * (this.variables[0].level % 3) + 0.0001) < this.variables[1].cost,
        () => this.curMult < 4.5,
        () => this.curMult < 6 && this.variables[2].cost + l10(this.variables[2].cost % 4) < this.variables[3].cost,
        () => this.curMult < 6,
      ],
      SLMS: [() => this.curMult < 4, () => this.curMult < 4, () => this.curMult < 7.5, () => this.curMult < 7.5],
      SLMSd: [
        () => this.curMult < 4 && this.variables[0].cost + l10(2 * (this.variables[0].level % 3) + 0.0001) < this.variables[1].cost,
        () => this.curMult < 4,
        () => this.curMult < 7.5 && this.variables[2].cost + l10(this.variables[2].cost % 4) < this.variables[3].cost,
        () => this.curMult < 7.5,
      ],
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getVariableAvailability() {
    const conditions: Array<conditionFunction> = [() => true, () => true, () => true, () => true];
    return conditions;
  }
  getTotMult(val: number) {
    return Math.max(0, val * this.tauFactor * 0.375);
  }
  getMilestonePriority(): number[] {
    const maxVal = Math.max(this.lastPub, this.maxRho);
    if ((this.strat === "SLMS" || this.strat === "SLMSd") && maxVal >= 25 && maxVal <= 300) {
      //when to swap to a3exp (increasing rho2dot) before b1b2
      let emg_Before_b1b2 = 5;
      //when to swap to rho2 exp before b1b2
      let r2exp_Before_b1b2 = 4;
      if (maxVal < 50) {
        emg_Before_b1b2 = 5;
        r2exp_Before_b1b2 = 4;
      } else if (maxVal < 75) {
        emg_Before_b1b2 = 7;
        r2exp_Before_b1b2 = 6;
      } else if (maxVal < 100) {
        emg_Before_b1b2 = 12;
        r2exp_Before_b1b2 = 10;
      } else if (maxVal < 150) {
        emg_Before_b1b2 = 20;
        r2exp_Before_b1b2 = 15;
      } else if (maxVal < 175) {
        emg_Before_b1b2 = 8;
        r2exp_Before_b1b2 = 6;
      } else if (maxVal < 200) {
        emg_Before_b1b2 = 1.5;
        r2exp_Before_b1b2 = 1;
      } else if (maxVal < 275) {
        emg_Before_b1b2 = 3;
        r2exp_Before_b1b2 = 3;
      } else if (maxVal < 300) {
        emg_Before_b1b2 = 2;
        r2exp_Before_b1b2 = 2;
      }
      const minCost = Math.min(this.variables[2].cost, this.variables[3].cost);
      if (this.rho.value + l10(emg_Before_b1b2) < minCost) {
        //b12 exp
        return [3, 2, 0, 1];
      } else if (this.curMult > 4.5 || this.rho.value + l10(r2exp_Before_b1b2) > minCost) {
        //rho2 exp
        return [0, 1, 3, 2];
      } else if (this.rho.value + l10(emg_Before_b1b2) > minCost && this.rho.value + l10(r2exp_Before_b1b2) < minCost) {
        //a3 boost
        return [1, 0, 3, 2];
      }
    }
    return [3, 2, 0, 1];
  }
  updateInverseE_Gamma = (x: number) => {
    const y = l10(l10(2) / Math.LOG10E + x / Math.LOG10E + l10(Math.PI) / Math.LOG10E) - (l10(2) + x);
    this.inverseE_Gamma = 0 - Math.LOG10E - add(subtract(y, y + y - l10(2)), y + y + y + l10(6));
  };
  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = 10;
    this.rho2 = 0;
    this.rho3 = 0;
    this.variables = [
      new Variable({ name: "a1", cost: new FirstFreeCost(new ExponentialCost(1, 0.369 * l2(10), true)), valueScaling: new StepwisePowerSumValue(3.5, 3)}),
      new Variable({ name: "a2", cost: new ExponentialCost(175, 10), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "b1", cost: new ExponentialCost(500, 0.649 * l2(10), true), valueScaling: new StepwisePowerSumValue(6.5, 4) }),
      new Variable({ name: "b2", cost: new ExponentialCost(1000, 0.926 * l2(10), true), valueScaling: new ExponentialValue(2) }),
    ];
    this.milestonesMax = [3, 5, 2, 2];
    this.milestoneUnlockSteps = 25;
    this.inverseE_Gamma = 0;
    this.simEndConditions.push(() => this.curMult > 15);
    this.updateMilestones();
  }
  async simulate() {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 300) this.updateMilestones();
      this.buyVariables();
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    const result = createResult(this, "");

    return result;
  }
  tick() {
    const rho3dot = this.variables[2].value * (1 + 0.02 * this.milestones[2]) + this.variables[3].value * (1 + 0.02 * this.milestones[3]);
    this.rho3 = add(this.rho3, rho3dot + l10(this.dt));
    this.updateInverseE_Gamma(Math.max(1, this.rho3));

    const rho2dot =
      Math.LOG10E *
      (this.variables[0].value / Math.LOG10E +
        this.variables[1].value / Math.LOG10E -
        Math.log(2 - 0.008 * this.milestones[1]) * (Math.max(1, this.rho3) / Math.LOG10E));

    this.rho2 = add(this.rho2, Math.max(0, rho2dot) + l10(this.dt));

    const rhodot = this.rho2 * (1 + this.milestones[0] * 0.02) * 0.5 + this.inverseE_Gamma;
    this.rho.add(rhodot + this.totMult + l10(this.dt));
  }
}
