import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, logToExp, getR9multiplier, toCallables, getLastLevel, getBestResult } from "../../Utils/helpers";
import { start } from "repl";
import { simulate } from "../../Sim/simulate";


export default async function t1(data: theoryData): Promise<simResult> {
  let res;
  if (["T1SolarXLII", "T1C34Coast", "T1C4Coast"].includes(data.strat)) {
    const initialData: theoryData = {...data};
    const initialSim = new t1Sim(initialData);
    initialSim.doCoasting = false;
    const initialRes = await initialSim.simulate();
    const lastQ1 = getLastLevel("q1", initialRes.boughtVars);
    const lastQ2 = getLastLevel("q2", initialRes.boughtVars);
    const lastC3 = getLastLevel("c3", initialRes.boughtVars);

    const sim = new t1Sim(data);
    sim.doCoasting = true;
    sim.variables[0].setOriginalCap(lastQ1);
    sim.variables[1].setOriginalCap(lastQ2);
    sim.variables[4].setOriginalCap(lastC3);
    if (data.strat === "T1SolarXLII") {
      sim.variables[0].configureCap(5);
    }
    else {
      sim.variables[0].configureCap(18);
    }
    sim.variables[1].configureCap(1);
    sim.variables[4].configureCap(3);

    res = await sim.simulate();
  }
  else if (data.strat.includes("Coast")) {
    let data2: theoryData = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("Coast", "")
    const sim1 = new t1Sim(data2);
    const res1 = await sim1.simulate();
    const lastQ1 = getLastLevel("q1", res1.boughtVars);
    const lastC3 = getLastLevel("c3", res1.boughtVars);
    let sim = new t1Sim(data);
    if(data.strat === "T1Coast") {
      // We actually force-skip 2 levels due to better pub cycle.
      sim.variables[0].setOriginalCap(lastQ1 - 2);
    }
    else {
      // For active strats, we do no such thing.
      sim.variables[0].setOriginalCap(lastQ1);
    }
    sim.variables[0].configureCap(18);
    sim.variables[4].setOriginalCap(lastC3);
    sim.variables[4].configureCap(3);
    res = await sim.simulate();
  }
  else {
    const sim = new t1Sim(data);
    res = await sim.simulate();
  }
  return res;
}

type theory = "T1";

class t1Sim extends theoryClass<theory> {
  term1: number;
  term2: number;
  term3: number;
  termRatio: number;
  c3Ratio: number;
  doCoasting: boolean;
  /** This is exclusivery used by T1SolarXLII and T1SolarXLIICoast for legacy purposes */
  coast: number;

  getBuyingConditions(): conditionFunction[] {
    const q1CoastCond = () => this.variables[0].shouldBuy;
    const q2CoastCond = () => this.variables[1].shouldBuy;
    const c3CoastCond = () => this.variables[4].shouldBuy;
    const T1SolarXLII = [
      () => // q1
        this.variables[0].cost + l10(5) <= this.rho.value &&
        this.variables[0].cost + l10(6 + (this.variables[0].level % 10)) <= this.variables[1].cost &&
        this.variables[0].cost + l10(15 + (this.variables[0].level % 10)) < (this.milestones[3] > 0 ? this.variables[5].cost : 1000),
      () => this.variables[1].cost + l10(1.11) < this.rho.value,
      () => this.variables[2].cost + this.termRatio + 1 <= this.rho.value,
      () => this.variables[3].cost + this.termRatio <= this.rho.value,
      () => this.variables[4].cost + l10(this.c3Ratio) < this.rho.value,
      true,
    ];
    const T1SolarXLIICoast = [
      () => // q1
          q1CoastCond() && (this.variables[0].cost + l10(5) <= this.rho.value &&
          this.variables[0].cost + l10(6 + (this.variables[0].level % 10)) <= this.variables[1].cost &&
          this.variables[0].cost + l10(15 + (this.variables[0].level % 10)) < (this.milestones[3] > 0 ? this.variables[5].cost : 1000)),
      () => q2CoastCond() && this.variables[1].cost + l10(1.11) < this.rho.value,
      () => this.variables[2].cost + this.termRatio + 1 <= this.rho.value,
      () => (this.variables[3].cost + this.termRatio <= this.rho.value),
      () => c3CoastCond() && (this.variables[4].cost + l10(this.c3Ratio) < this.rho.value),
      true,
    ];
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      T1: new Array(6).fill(true),
      T1Coast: [q1CoastCond, true, true, true, c3CoastCond, true],
      T1C34: [true, true, false, false, true, true],
      T1C34Coast: [q1CoastCond, q2CoastCond, false, false, c3CoastCond, true],
      T1C4: [true, true, false, false, false, true],
      T1C4Coast: [q1CoastCond, q2CoastCond, false, false, false, true],
      T1Ratio: [
        () => this.variables[0].cost + 1 < this.rho.value, // q1
        () => this.variables[1].cost + l10(1.11) < this.rho.value,
        () => this.variables[2].cost + this.termRatio + 1 <= this.rho.value,
        () => this.variables[3].cost + this.termRatio <= this.rho.value,
        () => this.variables[4].cost + l10(this.c3Ratio) < this.rho.value,
        true,
      ],
      T1RatioCoast: [
        () => q1CoastCond() && (this.variables[0].cost + 1 < this.rho.value), // q1
        () => this.variables[1].cost + l10(1.11) < this.rho.value,
        () => this.variables[2].cost + this.termRatio + 1 <= this.rho.value,
        () => this.variables[3].cost + this.termRatio <= this.rho.value,
        () => c3CoastCond() && (this.variables[4].cost + l10(this.c3Ratio) < this.rho.value),
        true,
      ],
      T1SolarXLII: T1SolarXLIICoast,
      T1SolarXLIIOld: T1SolarXLII,
      T1SolarXLIIOldCoast: T1SolarXLIICoast
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    return [
      () => true,
      () => true,
      () => true,
      () => true,
      () => this.milestones[2] > 0,
      () => this.milestones[3] > 0
    ];
  }
  getMilestonePriority(): number[] {
    return [2, 3, 0, 1];
  }
  getTotMult(val: number): number {
    return Math.max(0, val * 0.164 - l10(3)) + getR9multiplier(this.sigma);
  }
  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = 10;
    this.milestoneUnlockSteps = 25;
    //milestones  [logterm, c1exp, c3term, c4term]
    this.milestonesMax = [1, 3, 1, 1];
    this.variables = [
      new Variable({ name: "q1", cost: new FirstFreeCost(new ExponentialCost(5, 2)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "q2", cost: new ExponentialCost(100, 10), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c1", cost: new ExponentialCost(15, 2), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ name: "c2", cost: new ExponentialCost(3000, 10), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c3", cost: new ExponentialCost(1e4, 4.5 * Math.log2(10), true), valueScaling: new ExponentialValue(10) }),
      new Variable({ name: "c4", cost: new ExponentialCost(1e10, 8 * Math.log2(10), true), valueScaling: new ExponentialValue(10) }),
    ];
    this.coast = Infinity;
    this.doCoasting = this.strat.includes("Coast");
    //values of the different terms, so they are accesible for variable buying conditions
    this.term1 = 0;
    this.term2 = 0;
    this.term3 = 0;
    this.termRatio = 0;
    this.c3Ratio = this.lastPub < 300 ? 1 : this.lastPub < 450 ? 1.1 : this.lastPub < 550 ? 2 : this.lastPub < 655 ? 5 : 10;

    this.updateMilestones();
  }
  async simulate(): Promise<simResult> {
    const nextc4 = Math.ceil((this.lastPub - 10) / 8) * 8 + 10;
    // Old pub cycle
    if (this.strat.includes("Old")) {
      const pub =
          nextc4 - this.lastPub < 3 ? nextc4 + 2
        : nextc4 - this.lastPub < 5 ? nextc4 - 2 + l10(1.5)
        : nextc4 - 4 + l10(1.4);
      this.coast = (nextc4 - this.lastPub < 3 ? nextc4 : Math.floor(this.lastPub)) + l10(30);
      this.coast = Math.max(8 + l10(30), this.coast + Math.floor(pub - this.coast));
      this.doSimEndConditions = () => false;
      this.pubConditions.push(() => this.maxRho >= pub);
    }
    // New pub cycle
    if (["T1SolarXLII", "T1C34Coast", "T1C4Coast"].includes(this.strat))
    {
      const c4dist = nextc4 - this.lastPub;
      let prevPoint = 0;
      let nextPoint = 0;
      if (this.strat === "T1SolarXLII") {
        if (c4dist > 7.5) {
          prevPoint = nextc4 - 10 + l10(5.5);
          nextPoint = nextc4 - 6 + l10(1.5);
        }
        else if (c4dist > 4.5) {
          prevPoint = nextc4 - 6 + l10(1.5);
          nextPoint = nextc4 - 4 + l10(5.5);
        }
        else if (c4dist > 2.25) {
          prevPoint = nextc4 - 4 + l10(5.5);
          nextPoint = nextc4 - 2 + l10(5.5);
        }
        else {
          prevPoint = nextc4 - 2 + l10(5.5);
          nextPoint = nextc4 + 2 + l10(1.5);
        }
      }
      else {
        if (c4dist > 7.5) {
          prevPoint = nextc4 - 10 + l10(6.5);
          nextPoint = nextc4 - 6;
        }
        else if (c4dist > 4.5) {
          prevPoint = nextc4 - 6;
          nextPoint = nextc4 - 4 + l10(6.5);
        }
        else if (c4dist > 2.25) {
          prevPoint = nextc4 - 4 + l10(6.5);
          nextPoint = nextc4 - 2 + l10(6.5);
        }
        else {
          prevPoint = nextc4 - 2 + l10(6.5);
          nextPoint = nextc4 + 2;
        }
      }
      let misalignment = this.lastPub - prevPoint;
      if (Math.abs(misalignment) < l10(2)) misalignment = 0;
      const pub = nextPoint + misalignment * 0.5;
      this.doSimEndConditions = () => false;
      this.pubConditions.push(() => this.maxRho >= pub);
    }
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 176) this.updateMilestones();
      if (!(this.strat.includes("Old")) || this.rho.value < this.coast) this.buyVariables();
      if (this.variables[0].shouldFork) await this.doForkVariable(0);
      if (this.variables[1].shouldFork) await this.doForkVariable(1);
      if (this.variables[4].shouldFork) await this.doForkVariable(4);
    }
    this.trimBoughtVars();
    let stratExtra = "";
    if (this.strat.includes("Old")) {
      stratExtra += ` ${this.lastPub < 50 ? "" : logToExp(Math.min(this.pubRho, this.coast), 2)}`;
    }
    if(this.doCoasting) {
      stratExtra += this.variables[0].prepareExtraForCap(getLastLevel("q1", this.boughtVars));
      stratExtra += this.variables[1].prepareExtraForCap(getLastLevel("q2", this.boughtVars));
      if(this.variables[4].level !== 0) {
        stratExtra += this.variables[4].prepareExtraForCap(getLastLevel("c3", this.boughtVars));
      }
    }
    return getBestResult(this.createResult(stratExtra), this.bestForkRes);
  }
  tick() {
    this.term1 = this.variables[2].value * (1 + 0.05 * this.milestones[1])
      + this.variables[3].value
      + (this.milestones[0] > 0 ? l10(1 + Math.max(this.rho.value, 0) / Math.LOG10E / 100) : 0);
    this.term2 = add(this.variables[4].value + this.rho.value * 0.2, this.variables[5].value + this.rho.value * 0.3);
    this.term3 = this.variables[0].value + this.variables[1].value;

    const rhodot = add(this.term1, this.term2) + this.term3 + this.totMult + l10(this.dt);
    this.rho.add(rhodot);
  }
  onAnyVariablePurchased(): void {
    this.termRatio = this.lastPub < 350 ? Math.max(l10(5), (this.term2 - this.term1) * Number(this.milestones[3] > 0)) : Infinity;
  }

  copyFrom(other: this) {
    super.copyFrom(other);
    this.term1 = other.term1;
    this.term2 = other.term2;
    this.term3 = other.term3;
    this.termRatio = other.termRatio;
    this.c3Ratio = other.c3Ratio;
    this.doCoasting = other.doCoasting;
    this.coast = other.coast;
  }
  copy() {
    let sim = new t1Sim(this.getDataForCopy());
    sim.copyFrom(this);
    return sim;
  }
  onVariablePurchased(id: number) {
    if (
        [0, 1, 4].includes(id) &&
        this.doCoasting &&
        this.variables[id].shouldBuy &&
        this.variables[id].coastingCapReached() &&
        // For this theory, we don't want to go above original cap:
        !this.variables[id].aboveOriginalCap()
    ) {
      this.variables[id].shouldFork = true;
    }
  }
}
