import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep, getBestResult } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";
import pubtable from "./helpers/BaPpubtable.json" assert { type: "json" };
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';

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

class bapSim extends theoryClass<theory> implements specificTheoryProps {
  rho: number;
  q: Array<number>;
  r: number;
  t_var: number;

  forcedPubRho: number;
  doContinuityFork: boolean;
  bestRes: simResult | null;

  getBuyingConditions() {
    const idlestrat = new Array(12).fill(true)
    const semiidlestrat = new Array(12).fill(() => this.maxRho < this.getNextCoast() - l10(25));
    const activestrat = [
      true,
      () => this.variables[1].cost + l10(0.5 * this.variables[0].level % 64) < this.variables[2].cost && (this.milestones[0] > 0 || this.variables[1].level < 65),
      ...new Array(10).fill(true)
    ]

    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      BaP: idlestrat,
      BaPcoast: semiidlestrat,
      BaPAI: [],
      BaPAIMS: [],
      BaPAIMS2: [],
      BaPd: activestrat,
      BaPdMS: activestrat,
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getMilestoneConditions() {
    const conditions: Array<conditionFunction> = [
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

  getTotMult(val: number) {
    return Math.max(0, val * this.tauFactor * 0.132075 + l10(5));
  }
  updateMilestones(): void {
    let stage = 0;
    let a_max = 0;
    let q_max = 0;
    const points = [10, 15, 20, 25, 30, 40, 50, 70, 90, 120, 150, 200, 250, 300, 400, 500, 600, 700, 800, 1000];
    const a_points = [20, 30, 50, 80, 140, 240, 400, 600, 800];
    const q_points = [25, 40, 60, 100, 180, 300, 500, 700];
    for (let i = 0; i < points.length; i++) {
      if (Math.max(this.lastPub, this.maxRho) >= points[i]) stage = i + 1;
    }
    for (let i = 0; i < a_points.length; i++) {
      if (Math.max(this.lastPub, this.maxRho) >= a_points[i]) a_max = i + 1;
    }
    for (let i = 0; i < q_points.length; i++) {
      if (Math.max(this.lastPub, this.maxRho) >= q_points[i]) q_max = i + 1;
    }
    let milestoneCount = stage;

    const max = [1, 1, a_max, q_max, stage===20?1:0];
    const apriority = [1, 2, 3, 4, 5];
    const qpriority = [1, 2, 4, 3, 5];
    let priority = apriority;

    if (this.strat == "BaPdMS" || this.strat == "BaPAIMS")
    {
      const tm300 = this.t % 300;
      if (tm300 < 100) priority = qpriority;
      else if (tm300 < 300) priority = apriority;
    }

    this.milestones = [0, 0, 0, 0, 0];
    for (let i = 0; i < priority.length; i++) {
        while (this.milestones[priority[i] - 1] < max[priority[i] - 1] && milestoneCount > 0) {
            this.milestones[priority[i] - 1]++;
            milestoneCount--;
        }
    }

    if (this.maxRho < 940)
    {
      this.milestones[4] = 0;
    }
  }

  getRdot(c1:number, r_ms:boolean):number {
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

  getA(level:number, n_unlocked:boolean, n_value:number):number {
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

  getNextCoast(){
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
    this.pubUnlock = 7;
    this.totMult = data.rho < this.pubUnlock ? 0 : this.getTotMult(data.rho);
    this.rho = 0;
    this.q = new Array(9).fill(-1e60)
    this.r = -1e60
    this.t_var = 0
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
    this.varNames = ["tdot", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10", "n"];
    this.variables = [
      new Variable({ cost: new ExponentialCost(1e6, 1e6), valueScaling: new StepwisePowerSumValue()}), //tdot
      new Variable({ cost: new FirstFreeCost(new ExponentialCost(0.0625, 0.25, true)), valueScaling: new StepwisePowerSumValue(65536, 64) }), //c1
      new Variable({ cost: new ExponentialCost(16, 4, true), valueScaling: new ExponentialValue(2) }), // c2
      new Variable({ cost: new ExponentialCost(19683, 19683), valueScaling: new ExponentialValue(3) }), // c3
      new Variable({ cost: new ExponentialCost(4**16, 32, true), valueScaling: new ExponentialValue(4) }), // c4
      new Variable({ cost: new ExponentialCost(5**25, 25*Math.log2(5), true), valueScaling: new ExponentialValue(5) }), // c5
      new Variable({ cost: new ExponentialCost(6**36, 36*Math.log2(6), true), valueScaling: new ExponentialValue(6) }), // c6
      new Variable({ cost: new ExponentialCost(7**49, 49*Math.log2(7), true), valueScaling: new ExponentialValue(7) }), // c7
      new Variable({ cost: new ExponentialCost(8**64, 64*Math.log2(8), true), valueScaling: new ExponentialValue(8) }), // c8
      new Variable({ cost: new ExponentialCost(9**81, 81*Math.log2(9), true), valueScaling: new ExponentialValue(9) }), // c9
      new Variable({ cost: new ExponentialCost(10**100, 100*Math.log2(10), true), valueScaling: new ExponentialValue(10) }), // c10
      new Variable({ cost: new ExponentialCost(10**40, 60*Math.log2(10), true), valueScaling: new StepwisePowerSumValue(6, 16, 1)}), // n
    ];
    this.conditions = this.getBuyingConditions();
    this.milestoneConditions = this.getMilestoneConditions();
    this.doSimEndConditions = () => this.forcedPubRho == Infinity;
    this.updateMilestones();
  }
  copyFrom(other: this): void {
    super.copyFrom(other);

    this.rho = other.rho;
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
  async simulate() {
    if (this.forcedPubRho != Infinity) {
      this.pubConditions.push(() => this.maxRho >= this.forcedPubRho);
    }
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      if ((this.ticks + 1) % 500000 === 0) await sleep();
      this.tick();
      if (this.rho > this.maxRho) this.maxRho = this.rho;
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
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    const result = createResult(this, "");

    return getBestResult(result, this.bestRes);
  }
  tick() {
    this.t_var += (1 + this.variables[0].level) * this.dt

    if (this.milestones[3] > 7)
      this.q[8] = add(this.q[8], this.variables[10].value + l10(this.dt));
    for (let i=9; i>=2; i--)
    {
      if (this.milestones[3] > i-3)
      {
        this.q[i-2] = add(this.q[i-2], this.variables[i].value + (this.milestones[3] > i-2 ? this.q[i-1] : 0) + l10(this.dt))
      }
    }

    this.r = add(this.r, this.getRdot(this.variables[1].value, this.milestones[0] > 0) + l10(this.dt));
    const vn = this.milestones[4] > 0 ? 10**this.variables[11].value : 0;

    let rhodot;
    if (this.milestones[1] == 0)
    {
      rhodot = this.totMult + (l10(this.t_var) + this.q[0] + this.r) * this.getA(this.milestones[2], this.milestones[4] > 0, vn);
    }
    else
    {
      rhodot = this.totMult + l10(this.t_var) + (this.q[0] + this.r) * this.getA(this.milestones[2], this.milestones[4] > 0, vn);
    }

    this.rho = add(this.rho, rhodot + l10(this.dt));
  }
  buyVariables() {
    if (!this.strat.includes("AI"))
    {
      for (let i = this.variables.length - 1; i >= 0; i--)
        while (true) {
          if (this.rho > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]()) {
            if (this.maxRho + 5 > this.lastPub) {
              this.boughtVars.push({ variable: this.varNames[i], level: this.variables[i].level + 1, cost: this.variables[i].cost, timeStamp: this.t });
            }
            this.rho = subtract(this.rho, this.variables[i].cost);
            this.variables[i].buy();
          } else break;
        }
    }
    else{
      while (true) {
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
        let minCost = [Number.MAX_VALUE, -1];
        for (let i = this.variables.length - 1; i >= 0; i--)
          if (rawCost[i] + weights[i] < minCost[0] && this.milestoneConditions[i]()) {
            minCost = [rawCost[i] + weights[i], i];
          }
        if (minCost[1] !== -1 && rawCost[minCost[1]] < this.rho) {
          this.rho = subtract(this.rho, this.variables[minCost[1]].cost);
          if (this.maxRho + 5 > this.lastPub) {
            this.boughtVars.push({ variable: this.varNames[minCost[1]], level: this.variables[minCost[1]].level + 1, cost: this.variables[minCost[1]].cost, timeStamp: this.t });
          }
          this.variables[minCost[1]].buy();
        } else break;
      }
    }
  }
}
