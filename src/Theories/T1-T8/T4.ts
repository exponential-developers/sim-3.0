import { global } from "../../Sim/main";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import {
  add,
  l10,
  subtract,
  getLastLevel,
  getR9multiplier,
  toCallables,
  getBestResult,
  add2,
} from "../../Utils/helpers";
import { traditionalConverter } from "../../Utils/progressConversion";
import traditionalTheoryClass from "../traditionalTheory";

type theory = "T4";

const converter: ProgressValueConverterRho = traditionalConverter({
  r9Affected: true,
  multExponent: 0.165,
  multFactor: -l10(4)
});

const T4: TheoryInterface<theory> = {
  simulate: t4,
  converter
};

export default T4;

async function t4(data: theoryData<theory>): Promise<simResult<theory>> {
  let res: simResult<theory>;
  if (data.strat === "T4ROI") {
      const sim1 = new t4Sim(data);
      sim1.timeToPub = Infinity;
      const res1 = await sim1.simulate();
      const lastQ1 = getLastLevel("q1", res1.boughtVars);
      const lastQ2 = getLastLevel("q2", res1.boughtVars);
      const lastC3 = getLastLevel("c3", res1.boughtVars);
      const lastC4 = getLastLevel("c4", res1.boughtVars);
      const lastC5 = getLastLevel("c5", res1.boughtVars);
      const lastC6 = getLastLevel("c6", res1.boughtVars);
      const sim = new t4Sim(data);
      sim.timeToPub = res1.time * 2;
      sim.variables[2].setOriginalCap(lastC3);
      sim.variables[2].configureCap(3);
      sim.variables[3].setOriginalCap(lastC4);
      sim.variables[3].configureCap(1);
      sim.variables[4].setOriginalCap(lastC5);
      sim.variables[4].configureCap(1);
      sim.variables[5].setOriginalCap(lastC6);
      sim.variables[5].configureCap(1);
      sim.variables[6].setOriginalCap(lastQ1);
      sim.variables[6].configureCap(1);
      sim.variables[7].setOriginalCap(lastQ2);
      sim.variables[7].configureCap(1);
      res = await sim.simulate();
      for (let i = 0; i < 10; i++) {
        const sim2 = new t4Sim(data);
        sim2.variables[2].setOriginalCap(lastC3);
        sim2.variables[2].configureCap(3);
        sim2.variables[3].setOriginalCap(lastC4);
        sim2.variables[3].configureCap(1);
        sim2.variables[4].setOriginalCap(lastC5);
        sim2.variables[4].configureCap(1);
        sim2.variables[5].setOriginalCap(lastC6);
        sim2.variables[5].configureCap(1);
        sim2.variables[6].setOriginalCap(lastQ1);
        sim2.variables[6].configureCap(1);
        sim2.variables[7].setOriginalCap(lastQ2);
        sim2.variables[7].configureCap(1);
        sim2.timeToPub = res.time;
        const res2 = await sim2.simulate();
    
        const sim3 = new t4Sim(data);
        sim3.variables[2].setOriginalCap(getLastLevel("c3", res2.boughtVars));
        sim3.variables[2].configureCap(3);
        sim3.variables[3].setOriginalCap(getLastLevel("c4", res2.boughtVars));
        sim3.variables[3].configureCap(1);
        sim3.variables[4].setOriginalCap(getLastLevel("c5", res2.boughtVars));
        sim3.variables[4].configureCap(1);
        sim3.variables[5].setOriginalCap(getLastLevel("c6", res2.boughtVars));
        sim3.variables[5].configureCap(1);
        sim3.variables[6].setOriginalCap(getLastLevel("q1", res2.boughtVars));
        sim3.variables[6].configureCap(1);
        sim3.variables[7].setOriginalCap(getLastLevel("q2", res2.boughtVars));
        sim3.variables[7].configureCap(1);
        sim3.timeToPub = res.time;
        const res3 = await sim3.simulate();
    
        let bestResult = getBestResult<theory>(res3, res2);
        bestResult = getBestResult<theory>(bestResult, res);
        if (bestResult === res) break;
        res = bestResult;
      }
  } else if (!data.strat.includes("Coast")) {
    const sim = new t4Sim(data);
    res = await sim.simulate();
  }
  else {
    let data2: theoryData<theory> = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("Coast", "") as stratType[theory];
    const sim1 = new t4Sim(data2);
    const res1 = await sim1.simulate();
    const lastQ1 = getLastLevel("q1", res1.boughtVars);
    const lastQ2 = getLastLevel("q2", res1.boughtVars);
    const lastC3 = getLastLevel("c3", res1.boughtVars);
    const lastC4 = getLastLevel("c4", res1.boughtVars);
    const lastC5 = getLastLevel("c5", res1.boughtVars);
    const lastC6 = getLastLevel("c6", res1.boughtVars);
    const sim2 = new t4Sim(data);
    if (data2.strat === "T4ROI" || data2.strat === "T4C56" || data2.strat === "T4C356dC12rcv" || data2.strat === "T4C456dC12rcvMS") {
      sim2.variables[4].setOriginalCap(lastC5);
      sim2.variables[4].configureCap(1);

      sim2.variables[5].setOriginalCap(lastC6);
      sim2.variables[5].configureCap(1);
    }
    if (data2.strat === "T4ROI" || data2.strat === "T4C3d" || data2.strat === "T4C3Coast" || data2.strat === "T4C356dC12rcv") {
      sim2.variables[2].setOriginalCap(lastC3);
      sim2.variables[2].configureCap(3);
    }
    if (data2.strat === "T4ROI" || data2.strat === "T4C456dC12rcvMS") {
      sim2.variables[3].setOriginalCap(lastC4);
      sim2.variables[3].configureCap(1);
    }
    sim2.variables[6].setOriginalCap(lastQ1);
    if (data2.strat === "T4ROI" || data2.strat.includes("T4C3d")) {
      sim2.variables[6].configureCap(1);
    }
    else {
      sim2.variables[6].configureCap(1);
    }
    sim2.variables[7].setOriginalCap(lastQ2);
    sim2.variables[7].configureCap(1);
    res = getBestResult(await sim2.simulate(), res1);
  }
  return res;
}

class t4Sim extends traditionalTheoryClass<theory> {
  q: number;
  timeToPub: number = Infinity;

  getBuyingConditions(): conditionFunction[] {
    const c3d: (boolean | conditionFunction)[] = [
      false,
      false,
      true,
      ...new Array(3).fill(false),
      () => this.variables[6].cost + l10(10 + this.variables[6].level % 10) <= Math.min(this.variables[7].cost, this.variables[2].cost),
      () => this.curMult < 1 || this.variables[7].cost + l10(3) <= this.variables[2].cost,
    ];
    const c3dCoast: (boolean | conditionFunction)[] = [
      false,
      false,
      () => this.variables[2].shouldBuy,
      ...new Array(3).fill(false),
      () => this.variables[6].shouldBuy && (this.variables[6].cost + l10(10 + this.variables[6].level % 10)) <= Math.min(this.variables[7].cost, this.variables[2].cost),
      () => this.variables[7].shouldBuy && (this.curMult < 1 || this.variables[7].cost + l10(1.5) <= this.variables[2].cost),
    ];

    const c12d: (boolean | conditionFunction)[] = [
      () => this.variables[0].cost + l10((1 - 1 / 2) / (1 - (10 + this.variables[0].level % 10) / (11 + this.variables[0].level % 10))) < this.variables[1].cost,
      true,
      ...new Array(6).fill(false)
    ];

    const c356dC12rcv: conditionFunction[] = [
      () => {
        if (this.maxRho >= this.lastPubRho) return false;

        return this.variables[0].cost + l10((1 - 1 / 2) / (1 - (10 + this.variables[0].level % 10) / (11 + this.variables[0].level % 10))) < Math.min(this.variables[1].cost, this.variables[2].cost);
      },
      () => this.maxRho < this.lastPubRho,
      () => true,
      () => false,
      () => {
        if (this.maxRho < this.lastPubRho) return true;
          
        // Yes, c5 uses c6 cost instead of its own. No, I don't know why.
        return this.variables[5].cost + l10((1 - 1 / 2) / (1 - 1 / 10)) < this.variables[2].cost;
      },
      () => true,
      () => this.variables[6].cost + l10((1 - 1 / 2) / (1 - (10 + this.variables[6].level % 10) / (11 + this.variables[6].level % 10))) < this.variables[7].cost,
      () => true
    ];
    const c356dC12rcvCoast: conditionFunction[] = [
      c356dC12rcv[0],
      c356dC12rcv[1],
      () => this.variables[2].shouldBuy && c356dC12rcv[2](),
      c356dC12rcv[3],
      () => this.variables[4].shouldBuy && c356dC12rcv[4](),
      () => this.variables[5].shouldBuy && c356dC12rcv[5](),
      () => this.variables[6].shouldBuy && c356dC12rcv[6](),
      () => this.variables[7].shouldBuy && c356dC12rcv[7](),
    ];

    const c456dC12rcvMS: conditionFunction[] = [
      () => this.variables[0].cost + 1 < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost) && this.maxRho < this.lastPubRho,
      () => this.maxRho < this.lastPubRho,
      () => false,
      () => true,
      () => true,
      () => true,
      () => this.variables[6].cost + 1 < this.variables[7].cost,
      () => true
    ];
    const c456dC12rcvMSCoast: conditionFunction[] = [
      c456dC12rcvMS[0],
      c456dC12rcvMS[1],
      c456dC12rcvMS[2],
      () => this.variables[3].shouldBuy && c456dC12rcvMS[3](),
      () => this.variables[4].shouldBuy && c456dC12rcvMS[4](),
      () => this.variables[5].shouldBuy && c456dC12rcvMS[5](),
      () => this.variables[6].shouldBuy && c456dC12rcvMS[6](),
      () => this.variables[7].shouldBuy && c456dC12rcvMS[7](),
    ];

    const c56: (boolean | conditionFunction)[] = [
      ...new Array(4).fill(false),
      true,
      true,
      true,
      true
    ];
    const c56Coast: (boolean | conditionFunction)[] = [
      ...new Array(4).fill(false),
      () => this.variables[4].shouldBuy,
      () => this.variables[5].shouldBuy,
      () => this.variables[6].shouldBuy,
      () => this.variables[7].shouldBuy
    ];

    const c5: (boolean | conditionFunction)[] = [
      ...new Array(4).fill(false),
      true,
      false,
      true,
      true
    ];

    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      T4ROI: new Array(8).fill(true),
      T4C3d: c3d,
      T4C3dCoast: c3dCoast,
      T4C3Coast: [
        false,
        false,
        () => this.variables[2].shouldBuy,
        ...new Array(3).fill(false),
        () => this.variables[6].shouldBuy,
        () => this.variables[7].shouldBuy,
      ],
      T4C3: [false, false, true, ...new Array(3).fill(false), true, true],
      T4C3dC12rcv: [
        () => this.variables[0].cost + l10((1 - 1 / 2) / (1 - (10 + this.variables[0].level % 10) / (11 + this.variables[0].level % 10))) < Math.min(this.variables[1].cost, this.variables[2].cost) && this.maxRho < this.lastPubRho,
        () => this.maxRho < this.lastPubRho,
        true,
        ...new Array(3).fill(false),
        () => this.variables[6].cost + 1 < this.variables[7].cost,
        true
      ],
      T4C356dC12rcv: c356dC12rcv,
      T4C356dC12rcvCoast: c356dC12rcvCoast,
      T4C456dC12rcvMS: c456dC12rcvMS,
      T4C456dC12rcvMSCoast: c456dC12rcvMSCoast,
      T4C123d: [
        () => this.variables[0].cost + l10((1 - 1 / 2) / (1 - (10 + this.variables[0].level % 10) / (11 + this.variables[0].level % 10))) < Math.min(this.variables[1].cost, this.variables[2].cost),
        true,
        true,
        false,
        false,
        false,
        () => this.variables[6].cost + 1 < this.variables[7].cost,
        true
      ],
      T4C123: [
        true,
        true,
        true,
        false,
        false,
        false,
        true,
        true
      ],
      T4C12d: c12d,
      T4C12: [
        true,
        true,
        ...new Array(6).fill(false)
      ],
      T4C56: c56,
      T4C56Coast: c56Coast,
      T4C4: [
        ...new Array(3).fill(false),
        true,
        false,
        false,
        true,
        true],
      T4C4d: [
        ...new Array(3).fill(false),
        true,
        false,
        false,
        () => this.variables[6].cost + l10((1 - 1 / 2) / (1 - (10 + this.variables[6].level % 10) / (11 + this.variables[6].level % 10))) <= Math.min(this.variables[7].cost, this.variables[3].cost),
        () => this.curMult < 1 || this.variables[7].cost + l10(1.5) <= this.variables[3].cost,
      ],
      T4C5: c5,
      T4: new Array(8).fill(true),
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability() {
    const conditions: conditionFunction[] = [
      () => true,
      () => true,
      () => true,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 1,
      () => this.milestones[0] > 2,
      () => true,
      () => true
    ];
    return conditions;
  }
  getMilestonePriority(): number[] {
    switch (this.strat) {
      case "T4ROI": {
        if (this.maxRho > 100 && this.maxRho < 200) {
          if (this.maxRho < this.lastPubRho) return [1, 2, 0];
          else if (this.t % 100 < 50) return [2, 0, 1];
          else return [0, 2, 1];
        } else {
          return [0, 2, 1];
        }
      }
      case "T4C3d": return [2];
      case "T4C3Coast": return [2];
      case "T4C3dCoast": return [2];
      case "T4C3": return [2];
      case "T4C3dC12rcv": return [1, 2];
      case "T4C356dC12rcv": case "T4C356dC12rcvCoast": return [1, 2, 0];
      case "T4C456dC12rcvMS": case "T4C456dC12rcvMSCoast": {
        if (this.maxRho < this.lastPubRho) return [1, 2, 0]
        else if (this.t % 100 < 50) return [2, 0, 1]
        else return [0, 2, 1];
      }
      case "T4C123": case "T4C123d": return [1, 2];
      case "T4C12": case "T4C12d": return [1];
      case "T4C56": case "T4C56Coast": return [0, 2];
      case "T4C4": {
        this.milestonesMax = [1, 0, 3];
        return [0, 2];
      }
      case "T4C4d": {
        this.milestonesMax = [1, 0, 3];
        return [0, 2];
      }
      case "T4C5": {
        this.milestonesMax = [2, 0, 3];
        return [0, 2];
      }
      case "T4": return [0, 2, 1];
    }
  }
  constructor(data: theoryData<theory>) {
    super(data, converter, {
      pubUnlockRho: 9
    });
    this.q = 0;
    this.milestoneUnlockSteps = 25;
    //milestones  [terms, c1exp, multQdot]
    this.milestonesMax = [3, 1, 3];
    this.variables = [
      new Variable({ currency: this.rho, name: "c1", cost: new FirstFreeCost(new ExponentialCost(5, 1.305)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ currency: this.rho, name: "c2", cost: new ExponentialCost(20, 3.75), valueScaling: new ExponentialValue(2) }),
      new Variable({ currency: this.rho, name: "c3", cost: new ExponentialCost(2000, 2.468), valueScaling: new ExponentialValue(2) }),
      new Variable({ currency: this.rho, name: "c4", cost: new ExponentialCost(1e4, 4.85), valueScaling: new ExponentialValue(3) }),
      new Variable({ currency: this.rho, name: "c5", cost: new ExponentialCost(1e8, 12.5), valueScaling: new ExponentialValue(5) }),
      new Variable({ currency: this.rho, name: "c6", cost: new ExponentialCost(1e10, 58), valueScaling: new ExponentialValue(10) }),
      new Variable({ currency: this.rho, name: "q1", cost: new ExponentialCost(1e3, 100), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ currency: this.rho, name: "q2", cost: new ExponentialCost(1e4, 1000), valueScaling: new ExponentialValue(2) }),
    ];
    this.updateMilestones();
  }
  async simulate(): Promise<simResult<theory>> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPubRho < 176) this.updateMilestones();
      this.buyVariables();
      if(this.variables[6].shouldFork) await this.doForkVariable(6);
      if(this.variables[7].shouldFork) await this.doForkVariable(7);
      if(this.variables[2].shouldFork) await this.doForkVariable(2);
      this.pubTableCollector.collectData(this);
    }
    this.trimBoughtVars();
    let stratExtra = '';
    if (this.strat === "T4C56Coast") {
      stratExtra = this.variables[6].prepareExtraForCap(getLastLevel("q1", this.boughtVars)) +
          this.variables[7].prepareExtraForCap(getLastLevel("q2", this.boughtVars)) +
          this.variables[4].prepareExtraForCap(getLastLevel("c5", this.boughtVars)) +
          this.variables[5].prepareExtraForCap(getLastLevel("c6", this.boughtVars));
    } else if (this.strat === "T4C356dC12rcvCoast") {
      stratExtra = this.variables[6].prepareExtraForCap(getLastLevel("q1", this.boughtVars)) +
          this.variables[7].prepareExtraForCap(getLastLevel("q2", this.boughtVars)) +
          this.variables[2].prepareExtraForCap(getLastLevel("c3", this.boughtVars)) +
          this.variables[4].prepareExtraForCap(getLastLevel("c5", this.boughtVars)) +
          this.variables[5].prepareExtraForCap(getLastLevel("c6", this.boughtVars));
    } else if (this.strat === "T4C456dC12rcvMSCoast") {
      stratExtra = this.variables[6].prepareExtraForCap(getLastLevel("q1", this.boughtVars)) +
          this.variables[7].prepareExtraForCap(getLastLevel("q2", this.boughtVars)) +
          this.variables[3].prepareExtraForCap(getLastLevel("c4", this.boughtVars)) +
          this.variables[4].prepareExtraForCap(getLastLevel("c5", this.boughtVars)) +
          this.variables[5].prepareExtraForCap(getLastLevel("c6", this.boughtVars));
    } else if (this.strat.includes("Coast")) {
      stratExtra = this.variables[6].prepareExtraForCap(getLastLevel("q1", this.boughtVars)) +
          this.variables[7].prepareExtraForCap(getLastLevel("q2", this.boughtVars)) +
          this.variables[2].prepareExtraForCap(getLastLevel("c3", this.boughtVars));
    } else if (this.strat === "T4ROI") {
      stratExtra = this.variables[6].prepareExtraForCap(getLastLevel("q1", this.boughtVars)) +
          this.variables[7].prepareExtraForCap(getLastLevel("q2", this.boughtVars)) +
          //this.variables[0].prepareExtraForCap(getLastLevel("c1", this.boughtVars)) +
          //this.variables[1].prepareExtraForCap(getLastLevel("c2", this.boughtVars)) +
          this.variables[2].prepareExtraForCap(getLastLevel("c3", this.boughtVars)) +
          this.variables[3].prepareExtraForCap(getLastLevel("c4", this.boughtVars)) +
          this.variables[4].prepareExtraForCap(getLastLevel("c5", this.boughtVars)) +
          this.variables[5].prepareExtraForCap(getLastLevel("c6", this.boughtVars));
    }
    return getBestResult(this.createResult(stratExtra), this.bestForkRes);
  }
  tick() {
    const vq1 = this.variables[6].value;
    const vq2 = this.variables[7].value;

    const p = add(this.q, 0) * 2;
    this.q = subtract(add(p, l10(2) * (1 + this.milestones[2]) + vq1 + vq2 + l10(this.dt)) / 2, 0);

    const vc1 = this.variables[0].value * (1 + 0.15 * this.milestones[1]);
    const vc2 = this.variables[1].value;
    let variableSum = vc1 + vc2;
    variableSum = add(variableSum, this.variables[2].value + this.q);
    if (this.milestones[0] >= 1) variableSum = add(variableSum, this.variables[3].value + this.q * 2);
    if (this.milestones[0] >= 2) variableSum = add(variableSum, this.variables[4].value + this.q * 3);
    if (this.milestones[0] >= 3) variableSum = add(variableSum, this.variables[5].value + this.q * 4);

    const rhodot = this.totMult + variableSum;
    this.rho.add(rhodot + l10(this.dt));
  }

  buyVariables(): void {
    if (this.strat === "T4ROI" && this.timeToPub !== Infinity) { if (this.t <= this.timeToPub) this.buyVariablesROI(); }
    else { super.buyVariables(); }
  }
  onVariablePurchased(id: number) {
    if(
        [2, 6, 7].includes(id) &&
        (this.strat.includes("Coast") || this.strat === "T4ROI") &&
        this.variables[id].shouldBuy &&
        this.variables[id].coastingCapReached() &&
        // For this strat, there is almost never use to get levels above cap. We can skip simming that for faster sim:
        !this.variables[id].aboveOriginalCap()
    ) {
      this.variables[id].shouldFork = true;
    }
  }

  buyVariablesROI(): void {
    const buyVariable = (index: number): boolean => {
      const variable = this.variables[index];
      const currency = variable.currency ?? this.rho;
      if (currency.value > variable.cost) {
        this.recordPurchase(variable);
        currency.subtract(variable.cost);
        variable.buy();
        this.onVariablePurchased(index);
        return true;
      }
      return false;
    };

    type SignedLogNumber = { isNegative: boolean, value: number };
    function adds(...values: (number | SignedLogNumber)[]): SignedLogNumber {
      if (values.length === 0) return { isNegative: false, value: -Infinity };
      const result = typeof values[0] === 'number' ? { isNegative: false, value: values[0] } : { ...values[0] };
      if (values.length === 1) return result;
      for (let i = 1; i < values.length; i++) {
        const adder = typeof values[i] === 'number' ? { isNegative: false, value: values[i] as number } : values[i] as SignedLogNumber;
        if (result.isNegative === adder.isNegative) {
          result.value = add2(result.value, adder.value);
        } else {
          result.isNegative = adder.isNegative ? adder.value > result.value : result.value > adder.value;
          result.value = subtract(result.value, adder.value);
        }
      }
      return result;
    }
    function muls(...values: (number | SignedLogNumber)[]): SignedLogNumber {
      if (values.length === 0) return { isNegative: false, value: 0 };
      const result = typeof values[0] === 'number' ? { isNegative: false, value: values[0] } : { ...values[0] };
      if (values.length === 1) return result;
      for (let i = 1; i < values.length; i++) {
        const adder = typeof values[i] === 'number' ? { isNegative: false, value: values[i] as number } : values[i] as SignedLogNumber;
        result.value += adder.value;
        if (adder.isNegative) result.isNegative = !result.isNegative;
      }
      return result;
    }
    function mulm1(value: (number | SignedLogNumber)): SignedLogNumber {
      const result: SignedLogNumber = typeof value === 'number' ? { isNegative: false, value: value } : { ...value };
      result.isNegative = !result.isNegative;
      return result;
    }

    if (this.variables[6].level === 0) buyVariable(6);
    
    let bought: boolean;
    do {
      bought = false;

      const l10timeToPub = l10(this.timeToPub);
      const remainingTime = l10(this.timeToPub - this.t);
      const calculateRoi = (params: any): SignedLogNumber => {
        params.q1VarIncrease ??= -Infinity; params.q2VarIncrease ??= 0;
        params.c1VarIncrease ??= 0;
        params.c2VarIncrease ??= 0;
        params.c3VarIncrease ??= 0;
        params.c4VarIncrease ??= 0;
        params.c5VarIncrease ??= 0;
        params.c6VarIncrease ??= 0;

        const vc1exp = 1 + 0.15 * this.milestones[1];
        const qdotold = l10(2) * this.milestones[2] + this.variables[6].value + this.variables[7].value;
        const qdotnew = l10(2) * this.milestones[2] + add2(params.q1VarIncrease, this.variables[6].value) + (params.q2VarIncrease + this.variables[7].value);

        // TODO: figure out why this is worse than current version:
        const q0 = add2(this.q, 0) * 2;
        const t0 = l10(this.t);
        let Qint1 = (qdot: number, t: number) => adds(add2(l10(2) + qdot + subtract(t, t0), q0) * (3 / 2) - (l10(3) + qdot), mulm1(t));
        let Qint2 = (qdot: number, t: number) => adds(muls(t, adds(muls(qdot, adds(t, mulm1(l10(2) + t0))), q0, l10(2) + q0, l10(2))), mulm1((l10(2) + add2(l10(2) + qdot + subtract(t, t0), q0) * (3 / 2)) - (l10(3) + qdot)));
        let Qint3 = (qdot: number, t: number) => subtract(add(l10(2) + qdot + subtract(t, t0), q0) / 2, 0) * 4 + add(l10(4) + add(l10(2) + qdot + subtract(t, t0), q0) / 2, 0) - (l10(20) + qdot);
        let Qint4 = (qdot: number, t: number) => subtract(add(l10(2) + qdot + subtract(t, t0), q0) / 2, 0) * 5 + add(l10(5) + add(l10(2) + qdot + subtract(t, t0), q0) / 2, 0) - (l10(30) + qdot);
        let Qint = (varIncrease: number, k: 1 | 2 | 3 | 4) => {
          let fn; switch (k) {
            case 1: { fn = Qint1; break; }
            case 2: { fn = Qint2; break; }
            case 3: { fn = Qint3; break; }
            case 4: { fn = Qint4; break; } // 0.0862331
          } return adds(
            // delta int_{t0}^{t1} {q*(t) dt}
            muls(varIncrease, adds(fn(qdotnew, l10timeToPub))),
            // - int_{t0}^{t1} {q(t) dt}
            mulm1(adds(fn(qdotold, l10timeToPub)))
          );
        }

        /* The current version:
        let Qint1 = (qdot: number, t: number) => adds(add2(l10(2) + qdot + t, 0) * (3 / 2) - (l10(3) + qdot), mulm1(t));
        let Qint2 = (qdot: number, t: number) => adds(t + add2(qdot + t, l10(2)), mulm1((l10(2) + add2(l10(2) + qdot + t, 0) * (3 / 2)) - (l10(3) + qdot)));
        let Qint3 = (qdot: number, t: number) => adds((l10(2) + add2(qdot + t, l10(3)) + add2(l10(2) + qdot + t, 0) * (3 / 2)) - (l10(5) + qdot), mulm1(t + add2(l10(3) + qdot + t, l10(4))));
        let Qint4 = (qdot: number, t: number) => (subtract(add2(l10(2) + qdot + t, 0) / 2, 0) * 5 + add2(l10(5) + add2(l10(2) + qdot + t, 0) / 2, 0)) - (l10(30) + qdot);
        let Qint = (varIncrease: number, k: 1 | 2 | 3 | 4) => {
          //const qtime = subtract(add2(this.q, 0) * 2, 0) - (l10(2) + qdotold);
          let fn; switch (k) {
            case 1: { fn = Qint1; break; }
            case 2: { fn = Qint2; break; }
            case 3: { fn = Qint3; break; } // 0.0877578
            case 4: { fn = Qint4; break; }
          } return adds(
            // delta int_{t0}^{t1} {q*(t) dt}
            muls(varIncrease, adds(fn(qdotnew, l10timeToPub), mulm1(this.q * k))),
            // - int_{t0}^{t1} {q(t) dt}
            mulm1(adds(fn(qdotold, l10timeToPub), mulm1(this.q * k)))
          );
        }
        */

        let qint = Qint(params.c3VarIncrease, 1);
        let qint2 = Qint(params.c4VarIncrease, 2);
        let qint3 = Qint(params.c5VarIncrease, 3);
        let qint4 = Qint(params.c6VarIncrease, 4);

        const c1c2 = this.variables[0].value * vc1exp + this.variables[1].value + subtract(params.c1VarIncrease * vc1exp + params.c2VarIncrease, 0) + remainingTime;
        const c3 = muls(this.variables[2].value, qint);
        const c4 = this.milestones[0] >= 1 ? muls(this.variables[3].value, qint2) : -Infinity;
        const c5 = this.milestones[0] >= 2 ? muls(this.variables[4].value, qint3) : -Infinity;
        const c6 = this.milestones[0] >= 3 ? muls(this.variables[5].value, qint4) : -Infinity;

        return muls(this.totMult, adds(c1c2, c3, c4, c5, c6));
      };

      const varIncrease = new Array(this.variables.length);
      varIncrease[6] = subtract(this.variables[6].valueScaling.recomputeValue(this.variables[6].level + 1), this.variables[6].value);
      for (let i = 0; i < this.variables.length; i++) {
        if (i === 6) continue;
        varIncrease[i] = this.variables[i].valueScaling.recomputeValue(this.variables[i].level + 1) - this.variables[i].value;
      }

      let roi2: SignedLogNumber[] = new Array(this.variables.length);
      roi2[0] = calculateRoi({ c1VarIncrease: varIncrease[0] });
      roi2[1] = calculateRoi({ c2VarIncrease: varIncrease[1] });
      roi2[2] = calculateRoi({ c3VarIncrease: varIncrease[2] });
      roi2[3] = calculateRoi({ c4VarIncrease: varIncrease[3] });
      roi2[4] = calculateRoi({ c5VarIncrease: varIncrease[4] });
      roi2[5] = calculateRoi({ c6VarIncrease: varIncrease[5] });
      roi2[6] = calculateRoi({ q1VarIncrease: varIncrease[6] });
      roi2[7] = calculateRoi({ q2VarIncrease: varIncrease[7] });
      roi2 = roi2.map((val, i) => adds(muls(val, -this.variables[i].cost), mulm1(0)));
      const roi = roi2.map((val, i) => this.variables[i].shouldBuy && this.variableAvailability[i]() && !val.isNegative ? val.value : -Infinity);
      
      const arr = roi;
      switch (Math.max(...arr)) {
        case -Infinity: { break; }
        case arr[7]: { if (arr[7] !== -Infinity) bought = buyVariable(7); break; }
        case arr[6]: { if (arr[6] !== -Infinity) bought = buyVariable(6); break; }
        case arr[5]: { if (arr[5] !== -Infinity) bought = buyVariable(5); break; }
        case arr[4]: { if (arr[4] !== -Infinity) bought = buyVariable(4); break; }
        case arr[3]: { if (arr[3] !== -Infinity) bought = buyVariable(3); break; }
        case arr[2]: { if (arr[2] !== -Infinity) bought = buyVariable(2); break; }
        case arr[1]: { if (arr[1] !== -Infinity) bought = buyVariable(1); break; }
        case arr[0]: { if (arr[0] !== -Infinity) bought = buyVariable(0); break; }
      }
    } while (bought);
  }

  copyFrom(other: this) {
    super.copyFrom(other);
    this.q = other.q;
  }
  copy() {
    let newsim = new t4Sim(super.getDataForCopy());
    newsim.copyFrom(this);
    return newsim;
  }
}
