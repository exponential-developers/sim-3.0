import { global } from "../../Sim/main";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { l10, toCallables, parseLog10String } from "../../Utils/helpers";
import { traditionalConverter } from "../../Utils/progressConversion";
import traditionalTheoryClass from "../traditionalTheory";

type theory = "BT";

const tauFactor = 0.4;

const converter: ProgressValueConverterRho = traditionalConverter({
  tauFactor,
  multExponent: 1.25
});

const BT: TheoryInterface<theory> = {
  simulate: bt,
  converter
};

export default BT;

async function bt(data: theoryData<theory>): Promise<simResult> {
  const sim = new btSim(data);
  const res = await sim.simulate();
  return res;
}

class btSim extends traditionalTheoryClass<theory> {
  getBuyingConditions(): conditionFunction[] {
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      BT: [true, true, true],
      BTd: [
        () => this.variables[0].cost + l10(this.lastPubRho < 275 ? 12 + (this.variables[0].level % 10) : 10 + (this.variables[0].level % 10)) < this.variables[1].cost,
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
      () => this.milestones[2] > 0
    ];
    return conditions;
  }
  getMilestonePriority(): number[] {
    return [1, 0, 2, 3];
  }
  constructor(data: theoryData<theory>) {
    super(data, converter);
    this.pubUnlockRho = 7;
    this.milestoneUnlocks = [20, 40, 60, 100, 150, 250, 750, 850, 950, 1050, 1150, 1250, 1450];
    this.milestonesMax = [3, 3, 6, 1];
    this.variables = [
      new Variable({ currency: this.rho, name: "tai", cost: new FirstFreeCost(new ExponentialCost(15, 2)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ currency: this.rho, name: "rao", cost: new ExponentialCost(5, 10), valueScaling: new ExponentialValue(2) }),
      new Variable({ currency: this.rho, name: "tay", cost: new ExponentialCost(1e10, 10, true), valueScaling: new ExponentialValue(10) })
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
      this.pubTableCollector.collectData(this);
    }
    this.trimBoughtVars();
    return this.createResult();
  }
  tick() {
    const tayexponent = ((this.milestones[2] + 1) * (this.milestones[2] + 2) * 0.5 - 1) * 0.0003
    const vtai = this.variables[0].value * (1 + 0.08 * this.milestones[0])
    const vrao = this.variables[1].value * (1 + 0.077 * this.milestones[1])
    const vtay = this.variables[2].value * (this.milestones[3] == 0 ? tayexponent : 0.015)
    const rhodot = this.totMult + vtai + vrao + vtay;

    this.rho.add(rhodot + l10(this.dt));
    if (this.milestones[3] == 1 && Math.max(this.maxRho, this.lastPubRho) * tauFactor < parseLog10String("9e599")) {
      this.rho.value = parseLog10String("1.05e1500");
    }
  }
}
