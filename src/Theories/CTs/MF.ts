import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, getBestResult, defaultResult } from "../../Utils/helpers";

type theory = "MF";
type resetBundle = [number, number, number, number];
const depthConvert = [
    -99999,
    8, // depth == 1
    15, // depth == 2
    25, // depth == 3
    35, // depth == 4
    45, // depth == 5
]

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
    let isCoastStrat = data.strat.includes("Coast");
    let sim = new mfSim(data, resetBundle);
    if(isCoastStrat && sim.mfResetDepth > 0) {
      let tempSim = new mfSim(data, resetBundle);
      tempSim.mfResetDepth = 0;
      let tempRes = await tempSim.simulate();
      if (tempRes.strat.includes("c1: ")) {
        sim.lastC1 = parseInt(tempRes.strat.split("c1: ")[1].split(" ")[0]);
      }
    }
    let res = await sim.simulate();
    bestRes = getBestResult(bestRes, res);
  }
  return bestRes
}

const mu0 = 4e-7 * Math.PI
const q0 = 1.602e-19
const i0 = 1e-15
const m0 = 1e-3
const q0_m0_mu0 = (q0/m0) * mu0
const l10_q0_m0_mu0 = l10(q0_m0_mu0);

class mfSim extends theoryClass<theory> {
  lastC1: number;
  forkOnC1: boolean;
  c: number;
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
  mfResetDepth: number;
  isCoast: boolean;
  normalVariables: Variable[];
  // These are all precomputed values which only depend on things like variable levels and milestones.
  // We track them here to unload things from tick function, which for MF specifically lead to _very_ tangible speed up.
  precomp_omegaexp: number;
  precomp_xexp: number;
  precomp_vexp: number;
  precomp_a1exp: number;
  precomp_vterm: number;
  precomp_va1: number;
  precomp_va2: number;

  bestRes: simResult | null;

  getBuyingConditions(): conditionFunction[] {
    const idleStrat: conditionFunction[] = [
      () => this.variables[0].level < this.lastC1,
      ...new Array(8).fill(() => true), // Simplified condition (specifically, we rely on separate methods to buy v1-v4)
    ];
    const idleRCStrat: conditionFunction[] = [
      () => this.variables[0].level < this.lastC1 && (this.variables[0].cost < (this.goalBundleCost - l10(2)) || this.stopReset),
      () => true,
      () => (this.variables[2].cost < (this.goalBundleCost - l10(10)) || this.stopReset),
      () => true,
      () => true,
      ...new Array(4).fill(() => true), // Simplified condition (specifically, we rely on separate methods to buy v1-v4)
   ];
    const dPower: number[] = [3.09152, 3.00238, 2.91940]
    const activeStrat: conditionFunction[] = [
      () => (this.variables[0].level < this.lastC1) && (this.variables[0].cost +l10(9.9) <= Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost)),
      () => true,
      () => this.i/(i0*10 ** this.variables[3].value) < 0.5 || this.variables[2].cost+1<this.maxRho,
      () => true,
      () => this.variables[4].cost < Math.min(this.variables[1].cost, this.variables[3].cost),
      ...new Array(4).fill(() => true)
    ];
    const activeStrat2: conditionFunction[] = [
      () => (this.variables[0].level < this.lastC1) && (this.variables[0].cost + l10(8 + (this.variables[0].level % 7)) <= Math.min(this.variables[1].cost + l10(2), this.variables[3].cost, this.milestones[1] > 0 ? (this.variables[4].cost + l10(dPower[this.milestones[2]])) : Infinity)),
      () => true,
      () => l10(this.i) + l10(1.2) < this.variables[3].value - 15 || (this.variables[2].cost + l10(20) < this.maxRho && l10(this.i) + l10(1.012) < this.variables[3].value - 15),
      () => true,
      () => this.variables[4].cost + l10(dPower[this.milestones[2]]) < Math.min(this.variables[1].cost + l10(2), this.variables[3].cost),
      ...new Array(4).fill(() => true)
    ];
    const activeStrat3: conditionFunction[] = [
      // New active strat. Credits to Maimai.
      activeStrat[0],
      () => true,
      activeStrat2[2],
      () => true,
      () => this.variables[4].cost < Math.min(this.variables[3].cost + l10(0.6), this.variables[1].cost + l10(0.75)),
      ...new Array(4).fill(() => true)
    ];
      const activeStratRC: conditionFunction[] = [
          () => (this.variables[0].cost < (this.goalBundleCost - l10(2)) || this.stopReset) && ((this.variables[0].level < this.lastC1) && (this.variables[0].cost +l10(9.9) <= Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost))),
          () => true,
          () => (this.variables[2].cost < (this.goalBundleCost - l10(10)) || this.stopReset) && (this.i/(i0*10 ** this.variables[3].value) < 0.5 || this.variables[2].cost+1<this.maxRho),
          () => true,
          () => this.variables[4].cost < Math.min(this.variables[1].cost, this.variables[3].cost),
          ...new Array(4).fill(() => true)
      ];
      const activeStrat2RC: conditionFunction[] = [
          () => (this.variables[0].cost < (this.goalBundleCost - l10(2)) || this.stopReset) && ((this.variables[0].level < this.lastC1) && (this.variables[0].cost + l10(8 + (this.variables[0].level % 7)) <= Math.min(this.variables[1].cost + l10(2), this.variables[3].cost, this.milestones[1] > 0 ? (this.variables[4].cost + l10(dPower[this.milestones[2]])) : Infinity))),
          () => true,
          () => (this.variables[2].cost < (this.goalBundleCost - l10(10)) || this.stopReset) && (l10(this.i) + l10(1.2) < this.variables[3].value - 15 || (this.variables[2].cost + l10(20) < this.maxRho && l10(this.i) + l10(1.012) < this.variables[3].value - 15)),
          () => true,
          () => this.variables[4].cost + l10(dPower[this.milestones[2]]) < Math.min(this.variables[1].cost + l10(2), this.variables[3].cost),
          ...new Array(4).fill(() => true)
      ];
      const activeStrat3RC: conditionFunction[] = [
          // New active strat. Credits to Maimai.
          activeStratRC[0],
          () => true,
          activeStrat2RC[2],
          () => true,
          () => this.variables[4].cost < Math.min(this.variables[3].cost + l10(0.6), this.variables[1].cost + l10(0.75)),
          ...new Array(4).fill(() => true)
      ];
    const tailActiveGen = (i: number, offset: number): conditionFunction => {
      return () => {
        if (this.maxRho <= this.lastPub + offset) {
          return idleStrat[i]();
        } else {
          return activeStrat[i]();
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

    const conditions: Record<stratType[theory], conditionFunction[]> = {
      MF: idleStrat,
      MFd: activeStrat,
      MFd2: activeStrat2,
      MFd3: activeStrat3,
      MFCoast: idleStrat,
      MFRC: idleRCStrat,
      MFRCCoast: idleRCStrat,
      MFdCoast: activeStrat,
      MFd2Coast: activeStrat2,
      MFd3Coast: activeStrat3,
      MFdRCCoast: activeStratRC,
      MFd2RCCoast: activeStrat2RC,
      MFd3RCCoast: activeStrat3RC,
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
    return conditions[this.strat];
  }
  getVariableAvailability(): conditionFunction[] {
    return [
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
  }

  getTotMult(val: number): number {
    return val < this.pubUnlock ? 0 : Math.max(0, val * this.tauFactor * 0.17);
  }

  getMilestonePriority(): number[] {
    return [0, 1, 2, 3, 4, 5];
  }
  precomputeExps() {
    this.precomp_a1exp = this.a1exp();
    this.precomp_vexp = this.vexp();
    this.precomp_xexp = this.xexp();
    this.precomp_omegaexp = this.omegaexp();
    this.compute_vterm();
    this.compute_va1(); // We may have just updated a1exp, we need to update va1;
  }
  updateMilestonesNoMS(): boolean {
    const res = super.updateMilestonesNoMS();
    if(res) {
      this.precomputeExps();
      this.updateC();
    }
    return res;
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

  compute_vterm() {
      this.precomp_vterm = this.milestones[0] ? l10(this.vtot) * this.precomp_vexp : 0;
  }
  compute_va1() {
      this.precomp_va1 = 10 ** (this.variables[2].value * this.precomp_a1exp);
  }

  resetParticle(): void {
    this.x = 0;
    this.vx = 10 ** (this.variables[5].value + this.variables[6].value - 20);
    this.vz = 10 ** (this.variables[7].value + this.variables[8].value - 18);
    this.vtot = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
    this.compute_vterm();
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

  }

  updateC(): void {
    const xterm = l10(4e13)*this.precomp_xexp
    const omegaterm = (l10(m0 / (q0*mu0*i0)) - l10(900)) * this.precomp_omegaexp
    const vterm = this.milestones[0] ? l10(3e19) * 1.3 + l10(1e5)*(this.precomp_vexp - 1.3) : 0
    this.c = xterm + omegaterm + vterm + l10(8.67e23)
  }

  constructor(data: theoryData, resetBundle: resetBundle) {
    super(data);
    this.mfResetDepth = this.settings.mfResetDepth;
    this.c = 0;
    this.x = 0;
    this.i = 0;
    this.vx = 0;
    this.vz = 0;
    this.isCoast = this.strat.includes("Coast");
    this.vtot = 0;
    this.pubUnlock = 8;
    this.lastC1 = Infinity;
    this.forkOnC1 = false;
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
    this.normalVariables = [
      this.variables[0],
      this.variables[1],
      this.variables[2],
      this.variables[3],
      this.variables[4],
    ]
    this.resets = 0;
    this.resetBundle = resetBundle;
    this.stopReset = false;
    this.goalBundle = [0, 0, 0, 0];
    this.goalBundleCost = 0;
    this.bestRes = null;
    //These will all precompute in precomputeExps or milestone update:
    this.precomp_vexp = -1;
    this.precomp_xexp = -1;
    this.precomp_omegaexp = -1;
    this.precomp_a1exp = -1;
    this.precomp_vterm = -1;
    this.precomp_va1 = -1;
    this.precomp_va2 = 10 ** this.variables[3].value;
    this.updateMilestonesNoMS();
    // This will update precomp_vterm:
    this.precomputeExps();
    this.resetParticle();
  }
  copyFrom(other: this) {
    super.copyFrom(other)

    this.normalVariables = [
      this.variables[0],
      this.variables[1],
      this.variables[2],
      this.variables[3],
      this.variables[4],
    ]
    this.mfResetDepth = other.mfResetDepth;
    this.milestones = [...other.milestones];
    this.pubUnlock = other.pubUnlock;
    this.c = other.c;
    this.x = other.x;
    this.i = other.i;
    this.vx = other.vx;
    this.vz = other.vz;
    this.vtot = other.vtot;
    this.resets = other.resets;
    this.lastC1 = other.lastC1;

    this.resetBundle = other.resetBundle;
    this.stopReset = other.stopReset;
    this.goalBundle = [...other.goalBundle];
    this.goalBundleCost = other.goalBundleCost;
    this.precomp_va2 = other.precomp_va2;
    this.precomputeExps();
  }
  copy(): mfSim {
    let newsim = new mfSim(super.getDataForCopy(), this.resetBundle);
    newsim.copyFrom(this);
    return newsim;
  }
  async doForkC1() {
    const fork = this.copy();
    fork.lastC1 = this.variables[0].level;
    fork.forkOnC1 = false;
    const res = await fork.simulate();
    this.bestRes = getBestResult(this.bestRes, res);
    this.forkOnC1 = false;
  }

  async simulate(): Promise<simResult> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      this.updateMilestonesNoMS();
      this.buyNormalVariables();
      // These checks are here for optimization:
      if (!this.stopReset && this.rho.value >= this.goalBundleCost + 0.0001) {
        await this.checkForReset();
      }
      if(this.forkOnC1) {
        await this.doForkC1();
      }
    }
    this.trimBoughtVars();
    let stratExtra = ` Depth: ${this.mfResetDepth}`;
    if(this.lastC1 !== Infinity) {
      stratExtra += ` c1: ${this.lastC1}`
    }
    const result = this.createResult(stratExtra);
    return getBestResult(result, this.bestRes);
  }
  onVariablePurchased(id: number) {
    if(id === 2) {
      this.compute_va1(); // Update va1 after a1 level purchase.
    }
    if(id === 3) {
      this.precomp_va2 = 10 ** this.variables[3].value;
    }
    if(this.mfResetDepth === 0 && this.isCoast && id === 0 && this.lastC1 === Infinity && (this.maxRho > this.lastPub + 6)) {
      this.forkOnC1 = true;
    }
  }

  tick() {
    // Deal with i
    let icap = this.precomp_va2 * i0; //max reachable i value

    if(this.i < icap) {
        // if max i is not reached, we add a value to it:
        let scale = 1 - Math.E ** (-this.dt*this.precomp_va1/(400*this.precomp_va2));
        if (scale < 1e-13) scale = this.dt*this.precomp_va1/(400*this.precomp_va2);
        this.i = this.i + scale*(icap - this.i)
        this.i = Math.min(this.i, icap);
    }

    this.x += this.dt * this.vx;
    const xterm = l10(this.x) * this.precomp_xexp
    const omegaterm = (l10_q0_m0_mu0 + l10(this.i) + this.variables[4].value) * this.precomp_omegaexp;

    const rhodot =
        this.totMult + this.c + this.variables[0].value + this.variables[1].value + xterm + omegaterm + this.precomp_vterm;
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
  async testFinalReset() {
      let fork = this.copy();
      fork.stopReset = true;
      const forkres = await fork.simulate();
      this.bestRes = getBestResult(this.bestRes, forkres);
  }
  async checkForReset() {
    const depth = depthConvert[this.mfResetDepth];
    this.buyVVariables();
    this.resetParticle();
    if (this.maxRho >= this.lastPub - 10) {
       await this.testFinalReset();
    }
    if (depth > 0 && this.lastPub - this.maxRho <= depth) {
      let fork: mfSim;
      let forkres: simResult;

      // extra v1 test
      if (this.lastPub - this.maxRho <= depth) {
        fork = this.copy();
        fork.goalBundle = fork.getGoalBundle([fork.goalBundle[0] + 1, fork.goalBundle[1], fork.goalBundle[2], fork.goalBundle[3]]);
        fork.goalBundleCost = fork.calcBundleCost(fork.goalBundle);
        forkres = await fork.simulate();
        this.bestRes = getBestResult(this.bestRes, forkres);
      }

      // extra v2 test
      if (this.lastPub - this.maxRho <= depth) {
        fork = this.copy();
        fork.goalBundle = fork.getGoalBundle([fork.goalBundle[0], fork.goalBundle[1] + 1, fork.goalBundle[2], fork.goalBundle[3]]);
        fork.goalBundleCost = fork.calcBundleCost(fork.goalBundle);
        forkres = await fork.simulate();
        this.bestRes = getBestResult(this.bestRes, forkres);
      }
    }
  }
  // Custom MF method to only buy the first 5 variables (excluding the v1-v4 from normal cycle for speed).
  // This method also removes reliance on this.extraBuyingCondition.
  buyNormalVariables() {
    // let bought = false;
    let boughtVarsDelta = this.settings.boughtVarsDelta;
    for (let i = this.normalVariables.length - 1; i >= 0; i--) {
      let currency = this.normalVariables[i].currency ?? this.rho;
      while (true) {
        if (currency.value > this.normalVariables[i].cost && this.buyingConditions[i]() && this.variableAvailability[i]()) {
          if (this.maxRho + boughtVarsDelta > this.lastPub) {
            this.boughtVars.push({
              variable: this.normalVariables[i].name,
              level: this.normalVariables[i].level + 1,
              cost: this.normalVariables[i].cost,
              timeStamp: this.t,
              symbol: currency.symbol
            });
          }
          currency.subtract(this.normalVariables[i].cost);
          this.normalVariables[i].buy();
          // There is no buy any hook for mf:
          // bought = true;
          this.onVariablePurchased(i);
        } else break;
      }
    }
    // We don't need this hook in MF:
    // if (bought) this.onAnyVariablePurchased();
  }

  // Custom MF method to only buy v1-v4.
  // This method also removes reliance on this.extraBuyingCondition and buyingConditions, because when we are buying v,
  // we will always buy as many as we can.
  buyVVariables() {
    // let bought = false;
    let boughtVarsDelta = this.settings.boughtVarsDelta;
    for (let i = 8; i >= 5; i--) {
      let currency = this.variables[i].currency ?? this.rho;
      while (true) {
        if (currency.value > this.variables[i].cost && this.variableAvailability[i]()) {
          if (this.maxRho + boughtVarsDelta > this.lastPub) {
            this.boughtVars.push({
              variable: this.variables[i].name,
              level: this.variables[i].level + 1,
              cost: this.variables[i].cost,
              timeStamp: this.t,
              symbol: currency.symbol
            });
          }
          currency.subtract(this.variables[i].cost);
          this.variables[i].buy();
          // There is no buy any hook for mf:
          // bought = true;
          // There is no need for this hook when we are buying V variables.
          // this.onVariablePurchased(i);
        } else break;
      }
    }
    // We don't need this hook in MF:
    // if (bought) this.onAnyVariablePurchased();
  }
}