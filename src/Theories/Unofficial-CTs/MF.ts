import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep } from "../../Utils/helpers.js";
import Variable, { ExponentialCost } from "../../Utils/variable.js";
import { specificTheoryProps, theoryClass, conditionFunction } from "../theory.js";

export default async function mf(data: theoryData): Promise<simResult> {
  const sim = new mfSim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "MF";

const mu0 = 4e-7 * Math.PI
const q0 = 1.602e-19
const i0 = 1e-15
const m0 = 1e-3

class mfSim extends theoryClass<theory> implements specificTheoryProps {
  rho: number;
  pubUnlock: number;
  c: number
  x: number;
  i: number;
  vx: number;
  vz: number;
  vtot: number;
  resets: number;

  getBuyingConditions() {
    const autobuyall = new Array(9).fill(true);
    const idleStrat = [
      true,
      true,
      true,
      true,
      true,
      ...new Array(4).fill(() => this.maxRho < this.lastPub)
    ]

    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      MF: idleStrat,
      MF2: idleStrat,
      MF3: idleStrat,
      MF4: idleStrat
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getMilestoneConditions() {
    const conditions: Array<conditionFunction> = 
    [
      () => true,
      () => true,
      () => true,
      () => true,
      () => this.milestones[1] > 0,
      () => true,
      () => true,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 0
    ];
    return conditions;
  }
  getMilestoneTree() {
    const globalOptimalRoute = [
      [0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 0],
      [1, 1, 0, 0, 0, 0],
      [1, 1, 0, 1, 0, 0],
      [1, 1, 0, 2, 0, 0],
      [1, 1, 1, 2, 0, 0],
      [1, 1, 2, 2, 0, 0],
      [1, 1, 2, 2, 1, 0],
      [1, 1, 2, 2, 2, 0],
      [1, 1, 2, 2, 2, 1]
    ];
    const tree: { [key in stratType[theory]]: Array<Array<number>> } = {
      MF: globalOptimalRoute,
      MF2: globalOptimalRoute,
      MF3: globalOptimalRoute,
      MF4: globalOptimalRoute
    };
    return tree[this.strat];
  }

  getTotMult(val: number) {
    return Math.max(0, val * this.tauFactor * 0.17);
  }
  updateMilestones(): void {
    let stage = 0;
    const points = [25, 50, 175, 225, 275, 325, 425, 475, 525];
    for (let i = 0; i < points.length; i++) {
      if (Math.max(this.lastPub, this.maxRho) >= points[i]) stage = i + 1;
    }
    this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
    this.updateC()
  }

  xexp(): number {
    return 3.2 + 0.24 * this.milestones[2]
  }
  omegaexp(): number {
    return 4.1 + 0.22 * this.milestones[3]
  }
  vexp(): number {
    return 1.3 + 0.39 * this.milestones[4]
  }
  a1exp(): number {
    return 1 + 0.01 * this.milestones[5]
  }

  resetParticle(): void {
    this.x = 0;
    this.vx = 10 ** (this.variables[5].value + this.variables[6].value - 20);
    this.vz = 10 ** (this.variables[7].value + this.variables[8].value - 18);
    this.vtot = Math.sqrt(this.vx * this.vx + 2 * this.vz * this.vz);
    this.resets++
  }

  updateC(): void {
    const xterm = l10(1e15)*this.xexp()
    const omegaterm = (l10(m0 / (q0*mu0*i0)) - l10(1000)) * this.omegaexp()
    const vterm = this.milestones[0] ? l10(3e19) * 1.3 + l10(1e6)*(this.vexp() - 1.3) : 0
    this.c = xterm + omegaterm + vterm + l10(4.49e19)
  }

  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = 8;
    this.totMult = data.rho < this.pubUnlock ? 0 : this.getTotMult(data.rho);
    this.rho = 0;
    this.c = 0;
    this.x = 0;
    this.i = 0;
    this.vx = 0;
    this.vz = 0;
    this.vtot = 0;
    this.resets = 0;
    this.varNames = ["c1", "c2", "a1", "a2", "delta",  "v1", "v2", "v3", "v4"];
    this.variables = [
      new Variable({ cost: new ExponentialCost(10, 2), stepwisePowerSum: { base:2, length:7 }, firstFreeCost: true }), // c1
      new Variable({ cost: new ExponentialCost(1e3, 100), varBase: 2 }), // c2
      new Variable({ cost: new ExponentialCost(1e3, 25), stepwisePowerSum: { base:2, length:5 }, value: 1 }), // a1
      new Variable({ cost: new ExponentialCost(1e4, 55), varBase: 1.25}), // a2
      new Variable({ cost: new ExponentialCost(1e50, 300), varBase: 1.1}), // delta
      new Variable({ cost: new ExponentialCost(80, 80), stepwisePowerSum: { default:true }, value: 1 }), // v1
      new Variable({ cost: new ExponentialCost(1e4, 10**4.5), varBase: 1.3}), // v2
      new Variable({ cost: new ExponentialCost(1e50, 70), stepwisePowerSum: { default:true }}), // v3
      new Variable({ cost: new ExponentialCost(1e55, 1e6), varBase: 1.5}), // v4
    ];
    this.conditions = this.getBuyingConditions();
    this.milestoneConditions = this.getMilestoneConditions();
    this.milestoneTree = this.getMilestoneTree();
    this.updateMilestones();
    this.resetParticle();
  }
  async simulate() {
    let pubCondition = false;
    while (!pubCondition) {
      if (!global.simulating) break;
      if ((this.ticks + 1) % 500000 === 0) await sleep();
      this.tick();
      if (this.rho > this.maxRho) this.maxRho = this.rho;
      this.updateMilestones();
      this.curMult = 10 ** (this.getTotMult(this.maxRho) - this.totMult);
      this.buyVariables();
      pubCondition = (global.forcedPubTime !== Infinity ? this.t > global.forcedPubTime : this.t > this.pubT * 2 || this.pubRho > this.cap[0] || this.pubMulti > 3.5) && this.pubRho > this.pubUnlock;
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    const result = createResult(this, "");

    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    global.varBuy.push([result[7], this.boughtVars]);
    return result;
  }
  tick() {
    const newdt = this.dt * 1;

    const va1 = 10 ** (this.variables[2].value * this.a1exp());
    const va2 = 10 ** this.variables[3].value;
    const vc1 = this.variables[0].value;
    const vc2 = this.variables[1].value;

    this.x += newdt * this.vx
    this.i += Math.max(0, va1 * 0.01 * (i0 - this.i/va2))
    this.i = Math.min(this.i, va2*i0)

    const xterm = l10(this.x) * this.xexp()
    const omegaterm = (l10((q0/m0) * mu0 * this.i) + this.variables[4].value) * this.omegaexp()
    const vterm = this.milestones[0] ? l10(this.vtot) * this.vexp() : 0;

    const rhodot = this.totMult + this.c + vc1 + vc2 + xterm + omegaterm + vterm;
    this.rho = add(this.rho, rhodot + l10(this.dt));

    const vvx = 10 ** (this.variables[5].value + this.variables[6].value - 20);
    let resetcond: boolean;
    switch (this.strat)
    {
      case "MF":
        resetcond = vvx/this.vx > 2.718 && this.maxRho < this.lastPub;
        break
      case "MF2":
        resetcond = vvx/this.vx > 3.5 && this.maxRho < this.lastPub;
        break
      case "MF3":
        resetcond = vvx/this.vx > 2.5 && this.maxRho < this.lastPub;
        break
      case "MF4":
        resetcond = vvx/this.vx > 2 && this.maxRho < this.lastPub;
        break
      default:
        resetcond = false;
        break
    }
    if (resetcond)
      this.resetParticle()

    this.t += this.dt / 1.5;
    this.dt *= this.ddt;
    if (this.maxRho < this.recovery.value) this.recovery.time = this.t;

    this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
    if (this.maxTauH < this.tauH || this.maxRho >= this.cap[0] - this.cap[1] || this.pubRho < this.pubUnlock || global.forcedPubTime !== Infinity) {
      this.maxTauH = this.tauH;
      this.pubT = this.t;
      this.pubRho = this.maxRho;
    }
  }
  buyVariables() {
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
}
