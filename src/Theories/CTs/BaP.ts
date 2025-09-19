import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, subtract, getBestResult, binaryInsertionSearch, toCallables } from "../../Utils/helpers";
import pubtable from "./helpers/BaPpubtable.json" assert { type: "json" };

export default async function bap(data: theoryData): Promise<simResult> {
  const sim = new bapSim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "BaP";

interface pubTable {
  [key: string]: {
    next: number;
    time: number;
  };
}

class bapSim extends theoryClass<theory> {
  q: number[];
  r: number;
  t_var: number;

  forcedPubRho: number;
  doContinuityFork: boolean;
  bestRes: simResult | null;

  getBuyingConditions(): conditionFunction[] {
    const idlestrat = new Array(12).fill(true)
    const semiidlestrat = new Array(12).fill(() => this.maxRho < this.getNextCoast() - l10(25));
    const activestrat = [
      true,
      () => this.variables[1].cost + l10(0.5 * this.variables[0].level % 64) < this.variables[2].cost 
        && (this.milestones[0] > 0 || this.variables[1].level < 65),
      ...new Array(10).fill(true)
    ]

    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      BaP: idlestrat,
      BaPcoast: semiidlestrat,
      BaPAI: [],
      BaPAIMS: [],
      BaPAIMS2: [],
      BaPd: activestrat,
      BaPdMS: activestrat,
    };

    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = [
      () => this.variables[0].level < 4, //tdot
      () => true, //c1
      () => true, //c2
      () => this.milestones[3] > 0, //c3
      () => this.milestones[3] > 1, //c4
      () => this.milestones[3] > 2, //c5
      () => this.milestones[3] > 3, //c6
      () => this.milestones[3] > 4, //c7
      () => this.milestones[3] > 5, //c8
      () => this.milestones[3] > 6, //c9
      () => this.milestones[3] > 7, //10
      () => this.milestones[4] > 0 //n
    ];
    return conditions;
  }

  getTotMult(val: number): number {
    return val < this.pubUnlock ? 0 : Math.max(0, val * this.tauFactor * 0.132075 + l10(5));
  }
  getMilestonePriority(): number[] {
    const rho = Math.max(this.lastPub, this.maxRho);

    const a_points = [20, 30, 50, 80, 140, 240, 400, 600, 800];
    const q_points = [25, 40, 60, 100, 180, 300, 500, 700];
    const a_max = binaryInsertionSearch(a_points, rho);
    const q_max = binaryInsertionSearch(q_points, rho);
    const use_n = rho >= 1000 && this.maxRho >= 940 ? 1 : 0;
    this.milestonesMax = [1, 1, a_max, q_max, use_n];

    const apriority = [0, 1, 2, 3, 4];
    const qpriority = [0, 1, 3, 2, 4];

    if (this.strat == "BaPdMS" || this.strat == "BaPAIMS")
    {
      const tm300 = this.t % 300;
      if (tm300 < 100) return qpriority;
      else return apriority;
    }
    return apriority;
  }

  getRdot(c1: number, r_ms: boolean): number {
    if (c1 <= 2) { // exact computation
        c1 = 10**c1;
        let sum = 0;
        for (let i = 1; i < c1+0.001; i++) {
            sum += 1 / (i * i);
        }
        if (r_ms) {
            return l10(1 / ((Math.PI * Math.PI) / 6 - sum));
        }
        return l10(sum + (1 / (c1 * c1)));
    }

    //let approx_sum = 1 / c1 + BigNumber.ONE / (BigNumber.TWO * (c1.pow(BigNumber.TWO)));
    let approx_sum = add(-c1, -l10(2) - 2*c1)
    
    if (r_ms) {
        if (c1 <= 10) { // higher accuracy estimate
            return -approx_sum;
        } else { // discard higher order terms to avoid div by 0
            return c1;
        }
    }
    
    //return BigNumber.from(Math.PI * Math.PI) / BigNumber.SIX - approx_sum + BigNumber.ONE / c1.pow(BigNumber.TWO);
    return add(subtract(l10(Math.PI*Math.PI/6), approx_sum), -2*c1);
  }

  getA(level: number, n_unlocked: boolean, n_value: number): number {
    if (n_unlocked) {
        let partial_sum = 0;

        if (n_value <= 100) { //exact computation
            for (let i = 1; i <= n_value + 0.01; i++) {
                partial_sum += 1 / (i * i);
            }
        } else {
          partial_sum = ((Math.PI * Math.PI) / 6 - (1 / (n_value + 1) + 1 / (2 * ((n_value + 1) * (n_value + 1)))));
        }

        return 12 / (Math.PI * Math.PI) - 1.0 / partial_sum;
    }
    else {
        let a = 0.3
        for (let i = 9; i > 9 - level; i--) {
            a += i*i / 1000;
        }
        return a;
    }
  }

  getNextCoast(): number {
    let nextCoast = this.forcedPubRho;
    const rho = Math.max(this.maxRho, this.lastPub);
    const coastPoints = [10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100, 140, 150, 180, 200, 240, 300, 400, 500, 600, 700, 1000];
    for (const point of coastPoints){
      if (nextCoast > point && rho < point)
      {
        nextCoast = point;
      }
    }
    return nextCoast;
  }

  constructor(data: theoryData) {
    super(data);
    this.q = new Array(9).fill(-1e60);
    this.r = -1e60;
    this.t_var = 0;
    this.pubUnlock = 7;
    this.milestoneUnlocks = [10, 15, 20, 25, 30, 40, 50, 70, 90, 120, 150, 200, 250, 300, 400, 500, 600, 700, 800, 1000];
    this.variables = [
      new Variable({ name: "tdot", cost: new ExponentialCost(1e6, 1e6), valueScaling: new StepwisePowerSumValue()}), //tdot
      new Variable({ name: "c1",   cost: new FirstFreeCost(new ExponentialCost(0.0625, 0.25, true)), valueScaling: new StepwisePowerSumValue(65536, 64) }), //c1
      new Variable({ name: "c2",   cost: new ExponentialCost(16, 4, true), valueScaling: new ExponentialValue(2) }), // c2
      new Variable({ name: "c3",   cost: new ExponentialCost(19683, 19683), valueScaling: new ExponentialValue(3) }), // c3
      new Variable({ name: "c4",   cost: new ExponentialCost(4**16, 32, true), valueScaling: new ExponentialValue(4) }), // c4
      new Variable({ name: "c5",   cost: new ExponentialCost(5**25, 25*Math.log2(5), true), valueScaling: new ExponentialValue(5) }), // c5
      new Variable({ name: "c6",   cost: new ExponentialCost(6**36, 36*Math.log2(6), true), valueScaling: new ExponentialValue(6) }), // c6
      new Variable({ name: "c7",   cost: new ExponentialCost(7**49, 49*Math.log2(7), true), valueScaling: new ExponentialValue(7) }), // c7
      new Variable({ name: "c8",   cost: new ExponentialCost(8**64, 64*Math.log2(8), true), valueScaling: new ExponentialValue(8) }), // c8
      new Variable({ name: "c9",   cost: new ExponentialCost(9**81, 81*Math.log2(9), true), valueScaling: new ExponentialValue(9) }), // c9
      new Variable({ name: "c10",  cost: new ExponentialCost(10**100, 100*Math.log2(10), true), valueScaling: new ExponentialValue(10) }), // c10
      new Variable({ name: "n",    cost: new ExponentialCost(10**40, 60*Math.log2(10), true), valueScaling: new StepwisePowerSumValue(6, 16, 1)}), // n
    ];

    this.forcedPubRho = Infinity;
    this.doContinuityFork = true;
    this.bestRes = null;
    if (this.lastPub < 1480)
    {
      let newpubtable: pubTable = pubtable.bapdata;
      let pubseek = this.lastPub < 100 ? Math.round(this.lastPub * 4) / 4 : Math.round(this.lastPub);
      this.forcedPubRho = newpubtable[pubseek.toString()].next;
      if (this.forcedPubRho === undefined) this.forcedPubRho = Infinity;
    }

    this.doSimEndConditions = () => this.forcedPubRho == Infinity;
    this.updateMilestones();
  }
  copyFrom(other: this) {
    super.copyFrom(other);

    this.q = [...other.q];
    this.r = other.r;
    this.t_var = other.t_var;

    this.forcedPubRho = other.forcedPubRho;
  }
  copy(): bapSim {
    let newsim = new bapSim(this.getDataForCopy());
    newsim.copyFrom(this);
    return newsim;
  }
  async simulate(): Promise<simResult> {
    if (this.forcedPubRho != Infinity) {
      this.pubConditions.push(() => this.maxRho >= this.forcedPubRho);
    }
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      this.updateMilestones();
      this.buyVariables();
      if (this.forcedPubRho == 1500 && this.maxRho >= 1495 && this.doContinuityFork) {
        this.doContinuityFork = false;
        const fork = this.copy();
        fork.forcedPubRho = Infinity;
        const res = await fork.simulate();
        this.bestRes = getBestResult(this.bestRes, res);
      }
    }
    this.trimBoughtVars();
    const result = this.createResult();
    return getBestResult(result, this.bestRes);
  }
  tick() {
    this.t_var += (1 + this.variables[0].level) * this.dt

    if (this.milestones[3] > 7)
      this.q[8] = add(this.q[8], this.variables[10].value + l10(this.dt));
    for (let i=9; i>=2; i--)
    {
      if (this.milestones[3] > i-3)
        this.q[i-2] = add(this.q[i-2], this.variables[i].value + (this.milestones[3] > i-2 ? this.q[i-1] : 0) + l10(this.dt));
    }

    this.r = add(this.r, this.getRdot(this.variables[1].value, this.milestones[0] > 0) + l10(this.dt));
    const vn = this.milestones[4] > 0 ? 10**this.variables[11].value : 0;

    let rhodot;
    if (this.milestones[1] == 0)
      rhodot = this.totMult + (l10(this.t_var) + this.q[0] + this.r) * this.getA(this.milestones[2], this.milestones[4] > 0, vn);
    else
      rhodot = this.totMult + l10(this.t_var) + (this.q[0] + this.r) * this.getA(this.milestones[2], this.milestones[4] > 0, vn);

    this.rho.add(rhodot + l10(this.dt));
  }
  getVariableWeights(): number[] {
    const rawCost = this.variables.map((item) => item.cost);
    let nextCoast = this.getNextCoast();
    const minlayercost = Math.min(...rawCost.slice(2, this.milestones[4] + 3));
    const nextm64levels = 64 - ((this.variables[1].level - 1) % 64);
    const p = 2**0.25;
    const nextm64cost = rawCost[1] + l10((p**nextm64levels-1)/(p-1));
    const coast64 = nextm64cost < minlayercost + l10(2) && this.milestones[0] > 0;
    const coastn = this.maxRho > rawCost[11] - l10(25) && this.variables[11].level < 20 && this.milestones[4] > 0 && false;
    const weights = this.maxRho > nextCoast - l10(25) ? new Array(12).fill(Infinity) :  coastn ? [
      ...new Array(11).fill(Infinity),
      0 //n
    ] : coast64 ? [
      0, //t
      0, //c1
      ...new Array(9).fill(l10(4)), //c2-c10
      0 //n
    ] : [
      0, //t
      this.milestones[0] > 0 ? l10(this.variables[1].level % 64) : this.variables[1].level < 65 ? l10(2) : Infinity, //c1
      ...new Array(9).fill(0), //c2-c10
      0 //n
    ];
    return weights;
  }
  buyVariables() {
    if (!this.strat.includes("AI")) super.buyVariables();
    else super.buyVariablesWeight();
  }
}
