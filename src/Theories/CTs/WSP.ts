import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, toCallables } from "../../Utils/helpers";

export default async function wsp(data: theoryData): Promise<simResult> {
  const sim = new wspSim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "WSP";

class wspSim extends theoryClass<theory> {
  q: number;
  S: number;
  updateS_flag: boolean;

  getBuyingConditions(): conditionFunction[] {
    let c1weight = 0;
    if (this.lastPub >= 25) c1weight = l10(3);
    if (this.lastPub >= 40) c1weight = 1;
    if (this.lastPub >= 200) c1weight = l10(50);
    if (this.lastPub >= 400) c1weight = 3;
    if (this.lastPub >= 700) c1weight = 10000;
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      WSP: [true, true, true, true, true],
      WSPStopC1: [true, true, true, () => this.lastPub < 450 || this.t < 15, true],
      WSPdStopC1: [
        () =>
          this.variables[0].cost + l10(8 + (this.variables[0].level % 10)) <
          Math.min(this.variables[1].cost, this.variables[2].cost, this.milestones[1] > 0 ? this.variables[4].cost : Infinity),
        true,
        true,
        () =>
          this.variables[3].cost + c1weight <
            Math.min(this.variables[1].cost, this.variables[2].cost, this.milestones[1] > 0 ? this.variables[4].cost : Infinity) || this.t < 15,
        true,
      ],
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = [() => true, () => true, () => true, () => true, () => this.milestones[1] > 0];
    return conditions;
  }
  getMilestonePriority(): number[] {
    return [2, 1, 0];
  }
  getTotMult(val: number): number {
    return Math.max(0, val * this.tauFactor * 0.375);
  }
  srK_helper(x: number): number {
    const x2 = x * x;
    return Math.log(x2 + 1 / 6 + 1 / 120 / x2 + 1 / 810 / x2 / x2) / 2 - 1;
  };

  sineRatioK(n: number, x: number, K = 5): number {
    if (n < 1 || x >= n + 1) return 0;
    const N = n + 1 + K,
      x2 = x * x,
      L1 = this.srK_helper(N + x),
      L2 = this.srK_helper(N - x),
      L3 = this.srK_helper(N);
    let result = N * (L1 + L2 - 2 * L3) + x * (L1 - L2) - Math.log(1 - x2 / N / N) / 2;
    for (let k = n + 1; k < N; ++k) result -= Math.log(1 - x2 / k / k);
    return Math.LOG10E * result;
  };
  updateS() {
    const vn = l10(this.variables[2].value);
    const vc1 = this.variables[3].value;
    const chi = 10 ** (l10(Math.PI) + vc1 + vn - add(vc1, vn - l10(3) * this.milestones[2])) + 1;
    this.S = this.sineRatioK(this.variables[2].value, chi / Math.PI);
  }
  constructor(data: theoryData) {
    super(data);
    this.q = 0;
    this.pubUnlock = 8;
    this.milestoneUnlocks = [10, 25, 40, 55, 70, 100, 140, 200];
    this.milestonesMax = [4, 1, 3];
    this.variables = [
      new Variable({ name: "q1", cost: new FirstFreeCost(new ExponentialCost(10, 3.38 / 4, true)), valueScaling: new StepwisePowerSumValue()}),
      new Variable({ name: "q2", cost: new ExponentialCost(1000, 3.38 * 3, true), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "n",  cost: new ExponentialCost(20, 3.38, true), valueScaling: new ExponentialValue(10) }),
      new Variable({ name: "c1", cost: new ExponentialCost(50, 3.38 / 1.5, true), valueScaling: new StepwisePowerSumValue(2, 50, 1)}),
      new Variable({ name: "c2", cost: new ExponentialCost(1e10, 3.38 * 10, true), valueScaling: new ExponentialValue(2) }),
    ];
    this.S = 0;
    this.updateS_flag = false;
    
    this.simEndConditions.push(() => this.curMult > 15);
    this.updateMilestones();
  }
  async simulate() {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 200) this.updateMilestones();
      this.buyVariables();
      this.ticks++;
    }
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    return this.createResult();
  }
  tick() {
    if (this.updateS_flag) {
      this.updateS_flag = false;
      this.updateS();
    }

    const vq1 = this.variables[0].value * (1 + 0.01 * this.milestones[0]);

    const qdot = Math.max(0, l10(this.dt) + this.S + this.variables[4].value);

    this.q = add(this.q, qdot);

    const rhodot = this.totMult + vq1 + this.variables[1].value + this.q + l10(this.dt);
    this.rho.add(rhodot);
  }
  onVariablePurchased(id: number): void {
    if (id === 2 || id === 4) this.updateS_flag = true;
  }
}
