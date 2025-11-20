import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, getBestResult, defaultResult, toCallable, toCallables } from "../../Utils/helpers";

type theory = "MF";
type resetBundle = [number, number, number, number];

export default async function mf(data: theoryData): Promise<simResult> {
  let resetBundles: resetBundle[] = [
    [0, 1, 0, 0],
    [0, 1, 0, 1],
    [0, 2, 0, 0]
  ];
  let bestRes: simResult = defaultResult();
  for (const resetBundle of resetBundles) {
    if (data.rho <= 100 && resetBundle[3] > 0) {
      continue;
    }
    let sim = new mfSim(data, resetBundle);
    let res = await sim.simulate();
    bestRes = getBestResult(bestRes, res);
  }
  return bestRes
}

const mu0 = 4e-7 * Math.PI
const q0 = 1.602e-19
const i0 = 1e-15
const m0 = 1e-3

class mfSim extends theoryClass<theory> {
  c: number
  x: number;
  i: number;
  vx: number;
  vz: number;
  vtot: number;
  resets: number;
  stopReset: boolean;
  resetBundle: resetBundle;
  goalBundle: resetBundle;
  goalBundleCost: number;
  buyV: boolean;

  bestRes: simResult | null;

  getBuyingConditions(): conditionFunction[] {
    const idleStrat: (boolean | conditionFunction)[] = [
      ...new Array(5).fill(() => !this.buyV),
      ...new Array(4).fill(() => this.buyV)
    ];
    const dPower: number[] = [3.09152, 3.00238, 2.91940]
    const activeStrat: (boolean | conditionFunction)[] = [
      () => {
        if (this.buyV) { return false }
        return this.variables[0].cost +l10(9.9) <= Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost);
      },
      () => !this.buyV,
      () => {
        if (this.buyV) { return false }
        return this.i/(i0*10 ** this.variables[3].value) < 0.5 || this.variables[2].cost+1<this.maxRho;
      },
      () => !this.buyV,
      () => {
        if (this.buyV) { return false }
        return this.variables[4].cost < Math.min(this.variables[1].cost, this.variables[3].cost);
      },
      ...new Array(4).fill(() => this.buyV)
    ];
    const activeStrat2: (boolean | conditionFunction)[] = [
      () => {
        if (this.buyV) { return false }
        return this.variables[0].cost + l10(8 + (this.variables[0].level % 7)) <= Math.min(this.variables[1].cost + l10(2), this.variables[3].cost, this.milestones[1] > 0 ? (this.variables[4].cost + l10(dPower[this.milestones[2]])) : Infinity);
      },
      () => !this.buyV,
      () => {
        if (this.buyV) { return false }
        return l10(this.i) + l10(1.2) < this.variables[3].value - 15 || (this.variables[2].cost + l10(20) < this.maxRho && l10(this.i) + l10(1.012) < this.variables[3].value - 15);
      },
      () => !this.buyV,
      () => {
        if (this.buyV) { return false }
        return this.variables[4].cost + l10(dPower[this.milestones[2]]) < Math.min(this.variables[1].cost + l10(2), this.variables[3].cost);
      },
      ...new Array(4).fill(() => this.buyV)
    ];
    const tailActiveGen = (i: number, offset: number): conditionFunction => {
      return () => {
        if (this.maxRho <= this.lastPub + offset) {
          return toCallable(idleStrat[i])();
        } else {
          return toCallable(activeStrat[i])();
        }
      }
    }
    function makeMFdPostRecovery(offset: number): conditionFunction[] {
      let tailActive: conditionFunction[] = [];
      for(let i = 0; i < 9; i++) {
        tailActive.push(tailActiveGen(i, offset))
      }
      return tailActive;
    }

    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      MF: idleStrat,
      MFd: activeStrat,
      MFd2: activeStrat2,
      MFdPostRecovery0: makeMFdPostRecovery(0),
      MFdPostRecovery1: makeMFdPostRecovery(1),
      MFdPostRecovery2: makeMFdPostRecovery(2),
      MFdPostRecovery3: makeMFdPostRecovery(3),
      MFdPostRecovery4: makeMFdPostRecovery(4),
      MFdPostRecovery5: makeMFdPostRecovery(5),
      MFdPostRecovery6: makeMFdPostRecovery(6),
      MFdPostRecovery7: makeMFdPostRecovery(7),
      MFdPostRecovery8: makeMFdPostRecovery(8),
      MFdPostRecovery9: makeMFdPostRecovery(9)
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = 
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

  getTotMult(val: number): number {
    return val < this.pubUnlock ? 0 : Math.max(0, val * this.tauFactor * 0.17);
  }

  getMilestonePriority(): number[] {
    return [0, 1, 2, 3, 4, 5];
  }
  updateMilestones(): void {
    super.updateMilestones();
    this.updateC();
  }

  omegaexp(): number {
    return 4.1 + 0.15 * this.milestones[2]
  }
  xexp(): number {
    return 3.2 + 0.1 * this.milestones[3]
  }
  vexp(): number {
    return 1.3 + 0.31 * this.milestones[4]
  }
  a1exp(): number {
    return 1 + 0.01 * this.milestones[5]
  }

  resetParticle(): void {
    this.x = 0;
    this.vx = 10 ** (this.variables[5].value + this.variables[6].value - 20);
    this.vz = 10 ** (this.variables[7].value + this.variables[8].value - 18);
    this.vtot = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
    this.resets++;
    if (this.resets>1) {
      this.boughtVars.push({
        variable: 'Reset at V='+this.variables[5].level+","+this.variables[6].level+","+this.variables[7].level+","+this.variables[8].level,
        level: this.resets-1,
        cost: this.maxRho,
        timeStamp: this.t
      });
    }
    this.goalBundle = this.getGoalBundle();
    this.goalBundleCost = this.calcBundleCost(this.goalBundle);
    this.buyV = false;
  }

  updateC(): void {
    const xterm = l10(4e13)*this.xexp()
    const omegaterm = (l10(m0 / (q0*mu0*i0)) - l10(900)) * this.omegaexp()
    const vterm = this.milestones[0] ? l10(3e19) * 1.3 + l10(1e5)*(this.vexp() - 1.3) : 0
    this.c = xterm + omegaterm + vterm + l10(8.67e23)
  }

  constructor(data: theoryData, resetBundle: resetBundle) {
    super(data);
    this.c = 0;
    this.x = 0;
    this.i = 0;
    this.vx = 0;
    this.vz = 0;
    this.vtot = 0;
    this.pubUnlock = 8;
    this.milestoneUnlocks = [20, 50, 175, 225, 275, 325, 425, 475, 525];
    this.milestonesMax = [1, 1, 2, 2, 2, 1];
    this.variables =
    [
      new Variable({ name: "c1", cost: new FirstFreeCost(new ExponentialCost(10, 2)), valueScaling: new StepwisePowerSumValue(2, 7) }), // c1
      new Variable({ name: "c2", cost: new ExponentialCost(1e3, 50), valueScaling: new ExponentialValue(2) }), // c2
      new Variable({ name: "a1", cost: new ExponentialCost(1e3, 25), valueScaling: new StepwisePowerSumValue(2, 5, 3)}), // a1
      new Variable({ name: "a2", cost: new ExponentialCost(1e4, 100), valueScaling: new ExponentialValue(1.25) }), // a2
      new Variable({ name: "δ",  cost: new ExponentialCost(1e50, 300), valueScaling: new ExponentialValue(1.1) }), // delta
      new Variable({ name: "v1", cost: new ExponentialCost(80, 80), valueScaling: new StepwisePowerSumValue(2, 10, 1)}), // v1
      new Variable({ name: "v2", cost: new ExponentialCost(1e4, 10**4.5), valueScaling: new ExponentialValue(1.3) }), // v2
      new Variable({ name: "v3", cost: new ExponentialCost(1e50, 70), valueScaling: new StepwisePowerSumValue() }), // v3
      new Variable({ name: "v4", cost: new ExponentialCost(1e52, 1e6), valueScaling: new ExponentialValue(1.5) }), // v4
    ];
    this.resets = 0;
    this.resetBundle = resetBundle;
    this.stopReset = false;
    this.goalBundle = [0, 0, 0, 0];
    this.goalBundleCost = 0;
    this.buyV = true;
    this.bestRes = null;
    this.updateMilestones();
    this.resetParticle();
  }
  copyFrom(other: this) {
    super.copyFrom(other)

    this.milestones = [...other.milestones];
    this.pubUnlock = other.pubUnlock;
    this.c = other.c;
    this.x = other.x;
    this.i = other.i;
    this.vx = other.vx;
    this.vz = other.vz;
    this.vtot = other.vtot;
    this.resets = other.resets;

    this.resetBundle = other.resetBundle;
    this.stopReset = other.stopReset;
    this.goalBundle = [...other.goalBundle];
    this.goalBundleCost = other.goalBundleCost;
    this.buyV = other.buyV;
  }
  copy(): mfSim {
    let newsim = new mfSim(super.getDataForCopy(), this.resetBundle);
    newsim.copyFrom(this);
    return newsim;
  }

  async simulate(): Promise<simResult> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      this.updateMilestones();
      this.buyVariables();
      await this.checkForReset();
    }
    this.trimBoughtVars();
    const result = this.createResult(` Depth: ${this.settings.mfResetDepth}`);
    return getBestResult(result, this.bestRes);
  }
  tick() {
    const newdt = this.dt * 1;

    const va1 = 10 ** (this.variables[2].value * this.a1exp());
    const va2 = 10 ** this.variables[3].value;
    const vc1 = this.variables[0].value;
    const vc2 = this.variables[1].value;

    this.x += newdt * this.vx
    let icap = va2*i0;
    let scale = 1 - Math.E ** (-newdt*va1/(400*va2));
    if (scale < 1e-13) scale = newdt*va1/(400*va2);
    this.i = this.i + scale*(icap - this.i)
    this.i = Math.min(this.i, icap);

    const xterm = l10(this.x) * this.xexp()
    const omegaterm = (l10((q0/m0) * mu0 * this.i) + this.variables[4].value) * this.omegaexp()
    const vterm = this.milestones[0] ? l10(this.vtot) * this.vexp() : 0;

    const rhodot = this.totMult + this.c + vc1 + vc2 + xterm + omegaterm + vterm;
    this.rho.add(rhodot + l10(this.dt));
  }
  calcBundleCost(bundle: resetBundle): number {
    let cost = 0.;
    for (let i = 0; i < 4; i++) {
      if (bundle[i] == 0) continue;
      cost = add(cost, this.variables[5+i].getCostForLevels(this.variables[5+i].level, this.variables[5+i].level + bundle[i] - 1))
    }
    return cost
  }
  getGoalBundle(bundle: resetBundle = this.resetBundle): resetBundle {
    let goalBundle = <resetBundle>[...bundle];
    if (this.maxRho <= 65) {
      goalBundle[2] = 0;
      goalBundle[3] = 0;
    }

    let bundleCost = this.calcBundleCost(goalBundle);

    while (this.variables[6].getCostForLevel(this.variables[6].level + goalBundle[1]) < bundleCost + 0.01) {
      goalBundle[1]++;
    }
    bundleCost = this.calcBundleCost(goalBundle);
    while (this.variables[8].getCostForLevel(this.variables[8].level + goalBundle[3]) < bundleCost + 0.01) {
      goalBundle[3]++;
    }
    bundleCost = this.calcBundleCost(goalBundle);
    while (this.variables[5].getCostForLevel(this.variables[5].level + goalBundle[0]) < bundleCost + 0.01) {
      goalBundle[0]++;
    }
    bundleCost = this.calcBundleCost(goalBundle);
    while (this.variables[7].getCostForLevel(this.variables[7].level + goalBundle[2]) < bundleCost + 0.01) {
      goalBundle[2]++;
    }
    return goalBundle;
  }
  async checkForReset() {
    const depth = this.settings.mfResetDepth;
    if (this.stopReset) {
      this.buyV = false;
      return;
    }
    if (this.rho.value >= this.goalBundleCost + 0.0001) {
      if (this.maxRho >= this.lastPub) {
        let fork = this.copy();
        fork.stopReset = true;
        const forkres = await fork.simulate();
        this.bestRes = getBestResult(this.bestRes, forkres);
      }
      this.buyV = true;
      this.buyVariables();
      this.resetParticle();
      if (depth > 0 && this.lastPub - this.maxRho <= 25) {
        let fork: mfSim;
        let forkres: simResult;

        // extra v1 test
        if (this.lastPub - this.maxRho <= (depth == 1 ? 8 : depth == 2 ? 15 : 25)) {
          fork = this.copy();
          fork.goalBundle = fork.getGoalBundle([fork.goalBundle[0] + 1, fork.goalBundle[1], fork.goalBundle[2], fork.goalBundle[3]]);
          fork.goalBundleCost = fork.calcBundleCost(fork.goalBundle);
          forkres = await fork.simulate();
          this.bestRes = getBestResult(this.bestRes, forkres);
        }
        
        // extra v2 test
        if (this.lastPub - this.maxRho <= (depth == 1 ? 8 : depth == 2 ? 15 : 25)) {
          fork = this.copy();
          fork.goalBundle = fork.getGoalBundle([fork.goalBundle[0], fork.goalBundle[1] + 1, fork.goalBundle[2], fork.goalBundle[3]]);
          fork.goalBundleCost = fork.calcBundleCost(fork.goalBundle);
          forkres = await fork.simulate();
          this.bestRes = getBestResult(this.bestRes, forkres);
        }
      }
    }
  }
}