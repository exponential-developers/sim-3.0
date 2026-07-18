import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { l10, toCallables, parseLog10String } from "../../Utils/helpers";

export default async function ilc(data: theoryData): Promise<simResult> {
  const sim = new ilcSim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "ILC";

class ilcSim extends theoryClass<theory> {
  logAttractorPoints = [ // re, im
    [-0.11919307341454844813, 0.75058329393243957757],
    [-0.114671, 0.763914],
    [-0.109499109769577, 0.778497586048476],
    [-0.103534, 0.794542]
  ];

  getBuyingConditions(): conditionFunction[] {
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      ILC: [true, true, true, true, true, true],
      ILCd: [
        () => this.variables[0].cost + 1 < this.variables[1].cost,
        true,
        true,
        true,
        true,
        true
      ],
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = [
      () => true, 
      () => true,
      () => true,
      () => true,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 1
    ];
    return conditions;
  }
  getTotMult(val: number): number {
    return Math.max(0, val * this.tauFactor * 0.39 - l10(200));
  }
  getMilestonePriority(): number[] {
    return [0, 1, 2, 3];
  }
  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = 6;
    this.milestoneUnlocks = [25, 50, 75, 100, 120, 140, 160, 180, 200, 220];
    this.milestonesMax = [2, 2, 3, 3];
    this.totMult = data.rho < this.pubUnlock ? 0 : this.getTotMult(data.rho);
    this.variables = [
      new Variable({ name: "c1", cost: new FirstFreeCost(new ExponentialCost(1, 2.37)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "c2", cost: new ExponentialCost(2, 2560), valueScaling: new ExponentialValue() }),
      new Variable({ name: "e1", cost: new ExponentialCost(10, 608400), valueScaling: new ExponentialValue(1.4) }),
      new Variable({ name: "e2", cost: new ExponentialCost(25, 1210000), valueScaling: new ExponentialValue(1.43) }),
      new Variable({ name: "e3", cost: new ExponentialCost(1e10, 18840000000 ** 2), valueScaling: new ExponentialValue(1.46) }),
      new Variable({ name: "e4", cost: new ExponentialCost(1e20, 3970000000000000000 ** 2), valueScaling: new ExponentialValue(1.49) })
    ];
    this.updateMilestones();
  }
  async simulate(): Promise<simResult> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      this.updateMilestones();
      this.buyVariables();
    }
    this.trimBoughtVars();
    return this.createResult();
  }
  calculateN(reX: number, imX: number, index: number, epsilon: number): number {
    reX -= this.logAttractorPoints[index][0];
    imX -= this.logAttractorPoints[index][1];
    return Math.ceil((l10(reX ** 2 + imX ** 2) / 2 - epsilon) / l10(Math.sqrt(this.logAttractorPoints[index][0] ** 2 + this.logAttractorPoints[index][1] ** 2)));
  }
  tick() {
    let epsilon = this.variables[2].value + this.variables[3].value;
    if (this.milestones[0] > 0) epsilon += this.variables[4].value;
    if (this.milestones[1] > 0) epsilon += this.variables[5].value;
    const nBase = l10(1.1 + 0.01 * this.milestones[1]);
    const N = this.calculateN(0, 1, this.milestones[2], epsilon);

    const rhodot = this.totMult + this.variables[0].value * (1 + 0.02 * this.milestones[3]) + this.variables[1].value + N * nBase;

    this.rho.add(rhodot + l10(this.dt));
  }
}
