import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Currency from "../../Utils/currency";
import Variable from "../../Utils/variable";
import { ExponentialValue, LinearValue, StepwisePowerSumValue } from "../../Utils/value";
import { BaseCost, ExponentialCost, FirstFreeCost } from "../../Utils/cost";
import { add, getBestResult, binaryInsertionSearch, getLastLevel, l10, toCallables } from "../../Utils/helpers";

const PHI_VALUE = (1 + Math.sqrt(5)) / 2;
const SQRT5_VALUE = Math.sqrt(5);

const fibLogCache = [-Infinity, 0];
const lucasLogCache = [l10(2), 0];
const tribLogCache = [-Infinity, -Infinity, 0];

const ensureFibLogCache = (n: number) => {
  for (let i = fibLogCache.length; i <= n; i++) {
    fibLogCache.push(add(fibLogCache[i - 1], fibLogCache[i - 2]));
  }
};

const ensureLucasLogCache = (n: number) => {
  for (let i = lucasLogCache.length; i <= n; i++) {
    lucasLogCache.push(add(lucasLogCache[i - 1], lucasLogCache[i - 2]));
  }
};

const ensureTribonacciLogCache = (n: number) => {
  for (let i = tribLogCache.length; i <= n; i++) {
    tribLogCache.push(add(tribLogCache[i - 1], tribLogCache[i - 2], tribLogCache[i - 3]));
  }
};

const getFibLog = (n: number): number => {
  const index = Math.floor(n);
  if (index <= 0) return Number.NEGATIVE_INFINITY;
  ensureFibLogCache(index);
  return fibLogCache[index];
};

const getLucasLog = (n: number): number => {
  const index = Math.floor(n);
  if (index < 0) return Number.NEGATIVE_INFINITY;
  ensureLucasLogCache(index);
  return lucasLogCache[index];
};

const getTribonacciLog = (n: number): number => {
  const index = Math.floor(n);
  if (index < 0) return Number.NEGATIVE_INFINITY;
  ensureTribonacciLogCache(index);
  return tribLogCache[index];
};

const getTribonacciIndex = (t: number): number => {
  const safeT = Math.max(1, t);
  const raw = Math.pow(safeT, 0.2);
  if (!isFinite(raw) || raw < 2) return 2;
  return Math.floor(raw);
};

const getLastIndex = (variable: string, arr: varBuy[]): number => {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].variable == variable) {
      return i;
    }
  }
  return 0;
};

class SequenceCost extends BaseCost {
  constructor(private readonly getCostLog: (level: number) => number) {
    super();
  }

  getCost(level: number): number {
    return this.getCostLog(level);
  }

  copy(): BaseCost {
    return new SequenceCost(this.getCostLog);
  }
}

export default async function fs(data: theoryData): Promise<simResult> {
  let res;
  if (data.strat.includes("Coast")) {
    let initialSim = new fsSim(data);
    let initialRes = await initialSim.simulate();
    let lastN = getLastLevel("n", initialRes.boughtVars.slice(0, getLastIndex("c3", initialRes.boughtVars)));
    let lastM = getLastLevel("m", initialRes.boughtVars.slice(0, getLastIndex("c4", initialRes.boughtVars)));
    if (data.strat.includes("StopNM")) {
      let newLastN = lastN;
      let newLastM = lastM;

      do {
        lastN = newLastN;
        lastM = newLastM;
        initialSim = new fsSim(data);
        initialSim.variables[2].setOriginalCap(lastN);
        initialSim.variables[3].setOriginalCap(lastM);
        initialRes = await initialSim.simulate();
        newLastN = getLastLevel("n", initialRes.boughtVars.slice(0, getLastIndex("c3", initialRes.boughtVars)));
        newLastM = getLastLevel("m", initialRes.boughtVars.slice(0, getLastIndex("c4", initialRes.boughtVars)));
      }
      while (lastM != newLastM || lastN != newLastN)
    }

    const lastC1 = getLastLevel("c1", initialRes.boughtVars);

    let sim = new fsSim(data);
    sim.variables[0].setOriginalCap(lastC1);
    // Max is
    sim.variables[0].configureCap(8);
    sim.variables[2].setOriginalCap(lastN);
    sim.variables[3].setOriginalCap(lastM);
    res = await sim.simulate();
  } else if (data.strat.includes("StopNM")) {
    let sim = new fsSim(data);
    res = await sim.simulate();
    let lastN = getLastLevel("n", res.boughtVars.slice(0, getLastIndex("c3", res.boughtVars)));
    let lastM = getLastLevel("m", res.boughtVars.slice(0, getLastIndex("c4", res.boughtVars)));

    let newLastN = lastN;
    let newLastM = lastM;
    do {
      lastN = newLastN;
      lastM = newLastM;
      sim = new fsSim(data);
      sim.variables[2].setOriginalCap(lastN);
      sim.variables[3].setOriginalCap(lastM);
      res = await sim.simulate();
      newLastN = getLastLevel("n", res.boughtVars.slice(0, getLastIndex("c3", res.boughtVars)));
      newLastM = getLastLevel("m", res.boughtVars.slice(0, getLastIndex("c4", res.boughtVars)));
    }
    while (lastM != newLastM || lastN != newLastN)

    return res;

  } else {
    const sim = new fsSim(data);
    res = await sim.simulate();
  }

  return res;
}

type theory = "FS";

class fsSim extends theoryClass<theory> {
  F: Currency;
  L: Currency;
  tVar: number;
  targetPubRho: number;

  getBuyingConditions(): conditionFunction[] {
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      FS: new Array(10).fill(true),
      FSCoast: [
        () => this.variables[0].shouldBuy,
        ...new Array(9).fill(true)
      ],
      FSd: [
        //c1 mod 13
        () => this.variables[0].cost + l10(1 + (this.variables[0].level % 13) / 2) < this.variables[1].cost, //c1
        true, //c2
        () => this.variables[2].cost + l10(2) < this.variables[1].cost && this.milestones[0] > 0, //n
        () => this.variables[3].cost + l10(2) < this.variables[1].cost, //m
        true, //c3
        //f1 mod 34
        () => this.variables[5].cost + l10((this.variables[5].level % 34) + 1) < Math.min(this.variables[4].cost, this.variables[6].cost), //f1
        () => this.variables[6].cost + l10(5) < this.variables[4].cost, //f2
        //l1 mod 47
        () => this.variables[7].cost + l10((this.variables[7].level % 47) + 1) < Math.min(this.variables[8].cost, this.variables[9].cost), //l1
        () => this.variables[8].cost + l10(4) < this.variables[9].cost, //l2
        true, //c4
      ],
      FSdCoast: [
        //c1 mod 13
        () => this.variables[0].shouldBuy && this.variables[0].cost + l10(1 + (this.variables[0].level % 13) / 2) < this.variables[1].cost, //c1
        true, //c2
        () => this.variables[2].cost + l10(2) < this.variables[1].cost && this.milestones[0] > 0, //n
        () => this.variables[3].cost + l10(2) < this.variables[1].cost, //m
        true, //c3
        //f1 mod 34
        () => this.variables[5].cost + l10((this.variables[5].level % 34) + 1) < Math.min(this.variables[4].cost, this.variables[6].cost), //f1
        () => this.variables[6].cost + l10(5) < this.variables[4].cost, //f2
        //l1 mod 47
        () => this.variables[7].cost + l10((this.variables[7].level % 47) + 1) < Math.min(this.variables[8].cost, this.variables[9].cost), //l1
        () => this.variables[8].cost + l10(4) < this.variables[9].cost, //l2
        true, //c4
      ],
      FSStopNM: [
        true,
        true,
        () => this.variables[2].underOriginalCap(),
        () => this.variables[3].underOriginalCap(),
        ...new Array(6).fill(true)
      ],
      FSStopNMCoast: [
        () => this.variables[0].shouldBuy,
        true,
        () => this.variables[2].underOriginalCap(),
        () => this.variables[3].underOriginalCap(),
        ...new Array(6).fill(true)
      ],
      FSdStopNM: [
        //c1 mod 13
        () => this.variables[0].cost + l10(1 + (this.variables[0].level % 13) / 2) < this.variables[1].cost, //c1
        true, //c2
        () => this.variables[2].cost + l10(2) < this.variables[1].cost && this.variables[2].underOriginalCap() && this.milestones[0] > 0, //n
        () => this.variables[3].cost + l10(2) < this.variables[1].cost && this.variables[3].underOriginalCap(), //m
        true, //c3
        //f1 mod 34
        () => this.variables[5].cost + l10((this.variables[5].level % 34) + 1) < Math.min(this.variables[4].cost, this.variables[6].cost), //f1
        () => this.variables[6].cost + l10(5) < this.variables[4].cost, //f2
        //l1 mod 47
        () => this.variables[7].cost + l10((this.variables[7].level % 47) + 1) < Math.min(this.variables[8].cost, this.variables[9].cost), //l1
        () => this.variables[8].cost + l10(4) < this.variables[9].cost, //l2
        true, //c4
      ],
      FSdStopNMCoast: [
        //c1 mod 13
        () => this.variables[0].shouldBuy && this.variables[0].cost + l10(1 + (this.variables[0].level % 13) / 2) < this.variables[1].cost, //c1
        true, //c2
        () => this.variables[2].cost + l10(2) < this.variables[1].cost && this.variables[2].underOriginalCap() && this.milestones[0] > 0, //n
        () => this.variables[3].cost + l10(2) < this.variables[1].cost && this.variables[3].underOriginalCap(), //m
        true, //c3
        //f1 mod 34
        () => this.variables[5].cost + l10((this.variables[5].level % 34) + 1) < Math.min(this.variables[4].cost, this.variables[6].cost), //f1
        () => this.variables[6].cost + l10(5) < this.variables[4].cost, //f2
        //l1 mod 47
        () => this.variables[7].cost + l10((this.variables[7].level % 47) + 1) < Math.min(this.variables[8].cost, this.variables[9].cost), //l1
        () => this.variables[8].cost + l10(4) < this.variables[9].cost, //l2
        true, //c4
      ],
    };
    return toCallables(conditions[this.strat]);
  }

  getVariableAvailability(): conditionFunction[] {
    return [
      () => true, // c1
      () => true, // c2
      () => true, // n
      () => this.milestones[1] > 0, // m
      () => this.milestones[0] > 0, // c3
      () => this.milestones[2] > 0, // f1
      () => this.milestones[2] > 1, // f2
      () => this.milestones[3] > 0, // l1
      () => this.milestones[3] > 1, // l2
      () => this.milestones[1] > 0, // c4
    ];
  }

  getMilestonePriority(): number[] {
    return [0, 1, 2, 3, 4, 5];
  }

  getTotMult(val: number): number {
    return Math.max(0, (val * this.tauFactor) / SQRT5_VALUE);
  }

  updateMilestones(): void {
    super.updateMilestones()

    const base =
      this.milestones[4] > 2
        ? PHI_VALUE
        : this.milestones[4] > 1
        ? 1.6
        : this.milestones[4] > 0
        ? 11 / 7
        : 1.5;
    const c2Scaling = this.variables[1].valueScaling;
    if (c2Scaling instanceof ExponentialValue && c2Scaling.power !== base) {
      c2Scaling.power = base;
      this.variables[1].reCalculate();
    }
  }

  constructor(data: theoryData) {
    super(data);
    this.F = new Currency("F");
    this.L = new Currency("L");
    this.tVar = 1;
    this.targetPubRho = Infinity;
    this.pubUnlock = 5;
    this.milestoneUnlocks = [8, 13, 21, 34, 55, 89, 144, 233, 377, 610];
    this.milestonesMax = [1, 1, 2, 2, 3, 1];
    this.totMult = data.rho < this.pubUnlock ? 0 : this.getTotMult(data.rho);
    this.variables = [
      new Variable({
        name: "c1",
        currency: this.rho,
        cost: new FirstFreeCost(new SequenceCost((level) => getFibLog(level + 1))),
        valueScaling: new StepwisePowerSumValue(8, 13, 0),
      }),
      new Variable({
        name: "c2",
        currency: this.rho,
        cost: new ExponentialCost(21, 21),
        valueScaling: new ExponentialValue(1.5), // changing base
      }),
      new Variable({
        name: "n",
        currency: this.rho,
        cost: new ExponentialCost(3, 3),
        valueScaling: new LinearValue(1),
      }),
      new Variable({
        name: "m",
        currency: this.rho,
        cost: new ExponentialCost(2, 5),
        valueScaling: new LinearValue(1),
      }),
      new Variable({
        name: "c3",
        currency: this.F,
        cost: new ExponentialCost(987, 610),
        valueScaling: new ExponentialValue(2),
      }),
      new Variable({
        name: "f1",
        currency: this.F,
        cost: new SequenceCost((level) => getFibLog(level + 1)),
        valueScaling: new StepwisePowerSumValue(21, 34, 1),
      }),
      new Variable({
        name: "f2",
        currency: this.F,
        cost: new ExponentialCost(2584, 14930352),
        valueScaling: new ExponentialValue(5),
      }),
      new Variable({
        name: "l1",
        currency: this.L,
        cost: new SequenceCost((level) => getLucasLog(level)),
        valueScaling: new StepwisePowerSumValue(29, 47, 1),
      }),
      new Variable({
        name: "l2",
        currency: this.L,
        cost: new ExponentialCost(1, 87403803),
        valueScaling: new ExponentialValue(4),
      }),
      new Variable({
        name: "c4",
        currency: this.L,
        cost: new ExponentialCost(1, 987),
        valueScaling: new ExponentialValue(3),
      }),
    ];
    this.updateMilestones();
  }

  async simulate(): Promise<simResult> {
    if (this.lastPub < 13) this.simEndConditions = [() => this.t > this.pubT * 4];
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      this.updateMilestones();
      this.buyVariables();
      if(this.variables[0].shouldFork) await this.doForkVariable(0);      
    }
    this.trimBoughtVars();
    const lastLevels = this.variables.map((variable) => getLastLevel(variable.name, this.boughtVars));
    let varCaps = "";
    const mString = this.milestones[1] > 1 ? `M: ${lastLevels[3]}` : "";
    varCaps += this.strat.includes("Coast") ? ` c1: ${lastLevels[0]}` : "" ;
    varCaps += this.strat.includes("StopNM") ? ` N: ${lastLevels[2]}` + mString : "" ;
    return getBestResult(this.createResult(varCaps), this.bestForkRes);
  }

  tick() {
    const logdt = l10(this.dt);
    this.tVar += this.dt;

    const tFactor = -0.3 * l10(Math.max(1, this.tVar));
    let rhoTerm = this.variables[0].value + this.variables[1].value + tFactor;
    if (this.milestones[0] > 0) rhoTerm += this.variables[4].value;
    if (this.milestones[1] > 0) rhoTerm += this.variables[9].value;
    if (this.milestones[5] > 0) {
      rhoTerm += getTribonacciLog(getTribonacciIndex(this.tVar));
    }

    this.rho.add(rhoTerm + this.totMult + logdt);

    const fibLog = getFibLog(this.variables[2].level);
    let fMultiplier = 0;
    if (this.milestones[2] > 0) fMultiplier += this.variables[5].value;
    if (this.milestones[2] > 1) fMultiplier += this.variables[6].value;

    this.F.add(fibLog + fMultiplier + this.totMult + logdt);

    if (this.milestones[1] > 0) {
      const lucasLog = getLucasLog(this.variables[3].level);
      let lMultiplier = 0;
      if (this.milestones[3] > 0) lMultiplier += this.variables[7].value;
      if (this.milestones[3] > 1) lMultiplier += this.variables[8].value;
      this.L.add(lucasLog + lMultiplier + this.totMult + logdt);
    }
  }

  onVariablePurchased(id: number): void {
    if(
        id === 0 &&
        this.strat.includes("Coast") &&
        this.variables[id].shouldBuy &&
        this.variables[id].coastingCapReached() 
    ) {
      if (this.variables[id].level > this.variables[id].originalCap + 5) this.variables[id].stopBuying()
      else this.variables[id].shouldFork = true;
    }
  }
  copyFrom(other: this) {
    super.copyFrom(other);
    this.F = other.F.copy();
    this.L = other.L.copy();
    this.tVar = other.tVar;
    this.targetPubRho = other.targetPubRho;
  }
  copy() {
    let sim = new fsSim(this.getDataForCopy());
    sim.copyFrom(this);
    return sim;
  }
}
