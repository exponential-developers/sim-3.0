import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { l10, toCallables, parseLog10String, getLastLevel, getBestResult } from "../../Utils/helpers";

export default async function ilc(data: theoryData): Promise<simResult> {
  // const sim = new ilcSim(data);
  if(!data.strat.includes("Coast")) {
    const sim = new ilcSim(data);
    const res = await sim.simulate();
    return res;
  }
  else {
    let data2: theoryData = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("Coast", "");
    const sim1 = new ilcSim(data2);
    const res1 = await sim1.simulate();
    let vars = ["c1", "c2", "e1", "e2", "e3", "e4"];
    // TODO: e1 to e4 coasting, currently disabled.
    let caps = [6, 1, 1, 1, 1, 1];
    let sim2 = new ilcSim(data);
    for(let i = 0; i < 2; i++) {
      let lastVal = getLastLevel(vars[i], res1.boughtVars);
      sim2.variables[i].setOriginalCap(lastVal);
      sim2.variables[i].configureCap(caps[i]);
    }
    return await sim2.simulate();
  }
}

type theory = "ILC";

class ilcSim extends theoryClass<theory> {
  logAttractorPointsConstants = [ // -ln(q), ln(C)
    [0.55958025121547164703, -1.3567399465875839466],
    [0.553346, -1.40365],
    [0.54660087299449209265, -1.4589578628112783156],
    [0.539266, -1.52466],
  ];

  getBuyingConditions(): conditionFunction[] {
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      ILC: [
        () => true,
        () => true,
        () => true,
        () => true,
        () => true,
        () => true
      ],
      ILCd: [
        () => this.variables[0].cost + l10(3 + (this.variables[0].level % 10)) < this.variables[1].cost,
        () => true,
        () => true,
        () => true,
        () => true,
        () => true
      ],
      ILCCoast: [
        () => this.variables[0].shouldBuy,
        () => this.variables[1].shouldBuy,
        () => this.variables[2].shouldBuy,
        () => this.variables[3].shouldBuy,
        () => this.variables[4].shouldBuy,
        () => this.variables[5].shouldBuy
      ],
      ILCdCoast: [
        () => this.variables[0].shouldBuy && (this.variables[0].cost + l10(3 + (this.variables[0].level % 10)) < this.variables[1].cost),
        () => this.variables[1].shouldBuy,
        () => this.variables[2].shouldBuy,
        () => this.variables[3].shouldBuy,
        () => this.variables[4].shouldBuy,
        () => this.variables[5].shouldBuy
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
    return Math.max(0, val * this.tauFactor * 0.39 - l10(1100));
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
      new Variable({ name: "e1", cost: new ExponentialCost(10, 5), valueScaling: new StepwisePowerSumValue(2, 6, 1) }),
      new Variable({ name: "e2", cost: new ExponentialCost(25, 1210000), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "e3", cost: new ExponentialCost(1e10, 4000000000), valueScaling: new ExponentialValue(3) }),
      new Variable({ name: "e4", cost: new ExponentialCost(1e20, 190000000000000), valueScaling: new ExponentialValue(4) })
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
      for(let i = 0; i < 2; i++) {
        if(this.variables[i].shouldFork) await this.doForkVariable(i);
      }
    }
    let stratExtra = '';
    this.trimBoughtVars();
    if(this.strat.includes("Coast")) {
      let vars = ["c1", "c2", "e1", "e2", "e3", "e4"];
      for (let i = 0; i < 2; i++) {
        stratExtra += this.variables[i].prepareExtraForCap(getLastLevel(vars[i], this.boughtVars));
      }
    }
    return getBestResult(this.createResult(stratExtra), this.bestForkRes);
    // return this.createResult();
  }
  calculateN(index: number, epsilon: number): number {
    const constants = this.logAttractorPointsConstants[index];

    return Math.max(Math.ceil((constants[1] + epsilon / Math.LOG10E) / constants[0]), 0);
  }
  tick() {
    let epsilon = this.variables[2].value + this.variables[3].value;
    if (this.milestones[0] > 0) epsilon += this.variables[4].value;
    if (this.milestones[0] > 1) epsilon += this.variables[5].value;
    const nBase = 1.1 + 0.01 * this.milestones[1];
    const N = this.calculateN(this.milestones[2], epsilon);

    const rhodot = this.totMult + this.variables[0].value * (1 + 0.02 * this.milestones[3]) + this.variables[1].value + N * l10(nBase);

    this.rho.add(rhodot + l10(this.dt));
  }
  onVariablePurchased(id: number) {
    if(
        [0, 1].includes(id) &&
        this.strat.includes("Coast") &&
        this.variables[id].shouldBuy &&
        this.variables[id].coastingCapReached()
    ) {
      this.variables[id].shouldFork = true;
    }
  }

  copyFrom(other: this) {
    super.copyFrom(other);
  }
  copy() {
    let newsim = new ilcSim(super.getDataForCopy());
    newsim.copyFrom(this);
    return newsim;
  }
}
