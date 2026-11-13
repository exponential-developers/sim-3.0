import { global } from "../../Sim/main";
import Variable from "../../Utils/variable";
import { StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, toCallables, getBestResult, defaultResult, add2, subtract, mulm1, muls, adds, SignedLogNumber } from "../../Utils/helpers";
import { traditionalConverter } from "../../Utils/progressConversion";
import traditionalTheoryClass from "../traditionalTheory";

type theory = "T2";

const converter: ProgressValueConverterRho = traditionalConverter({
  r9Affected: true,
  multExponent: 0.198,
  multFactor: -l10(100)
})

const T2: TheoryInterface<theory> = {
  simulate: t2,
  converter
}

export default T2;

async function t2(data: theoryData<theory>): Promise<simResult<theory>> {
  let bestSim: t2Sim;
  let bestSimRes: simResult<theory>;
  if(data.strat == "T2Haxolotl") {
    const savedStrat = data.strat;
    data.strat = "T2MC";
    let t2mcRes = await new t2Sim(data).simulate();
    data.strat = savedStrat;
    let possibleStopPoints = [
        [3700, 2650, 1700, 750],
        [4650, 2900, 2250, 1150],
        [3500, 2700, 2050, 550]
    ]
    let cToTry = [
        1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3
    ];
    let c1ToTry = [
      1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5
    ]
    let bestRes = defaultResult<theory>();
    for(let c1 of c1ToTry) {
      for(let c2 of cToTry) {
        for(let c3 of cToTry) {
          for (let stopPoints of possibleStopPoints) {
            let sim = new t2Sim(data);
            sim.haxolotlC1 = c1;
            sim.haxolotlC2 = c2;
            sim.haxolotlC3 = c3;
            sim.stop4 = stopPoints[3]
            sim.stop3 = stopPoints[2]
            sim.stop2 = stopPoints[1]
            sim.stop1 = stopPoints[0]
            sim.targetRho = t2mcRes.pubPointRho ?? 0;
            bestRes = getBestResult(await sim.simulate(), bestRes);
          }
        }
      }
    }
    bestSimRes = bestRes;
  }
  else if(data.strat == "T2MCAlt2" || data.strat == "T2MCAlt3") {
    const savedStrat = data.strat;
    data.strat = "T2MC";
    let res = await new t2Sim(data).simulate();

    data.strat = savedStrat;
    if(savedStrat == "T2MCAlt2") {
      bestSim = new t2Sim(data);
      bestSim.targetRho = res.pubPointRho ?? 0;
      bestSimRes = await bestSim.simulate();
    }
    else {
      bestSim = new t2Sim(data);
      bestSim.stop4 = 750;
      bestSim.stop3 = 1700;
      bestSim.stop2 = 2650;
      bestSim.stop1 = 3700;
      bestSim.targetRho = res.pubPointRho ?? 0;
      bestSimRes = await bestSim.simulate();
    }
  }
  else if (data.strat === "T2ROI" || data.strat === "T2ROIMS") {
    const sim1 = new t2Sim(data);
    const res1 = await sim1.simulate();

    const sim = new t2Sim(data);
    sim.timeToPub = res1.time;
    const res = await sim.simulate();

    bestSimRes = res;
  }
  else {
    bestSim = new t2Sim(data);
    bestSimRes = await bestSim.simulate();
  }
  return bestSimRes;
}

class t2Sim extends traditionalTheoryClass<theory> {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  haxolotlC1: number;
  haxolotlC2: number;
  haxolotlC3: number;
  targetRho: number;
  stop4: number;
  stop3: number;
  stop2: number;
  stop1: number;
  timeToPub: number = Infinity;

  getBuyingConditions(): conditionFunction[] {
    const getMax = (index: number): number => {
      let max = -1;
      while(index >= 0) {
        max = Math.max(max, this.variables[index].cost, this.variables[4 + index].cost);
        index--;
      }
      return max;
    }
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      T2: new Array(8).fill(true),
      T2MC: [
        () => this.curMult < 4650,
        () => this.curMult < 2900,
        () => this.curMult < 2250,
        () => this.curMult < 1150,
        () => this.curMult < 4650,
        () => this.curMult < 2900,
        () => this.curMult < 2250,
        () => this.curMult < 1150,
      ],
      T2MCAlt: [
        () => this.curMult < 3500,
        () => this.curMult < 2700,
        () => this.curMult < 2050,
        () => this.curMult < 550,
        () => this.curMult < 3500,
        () => this.curMult < 2700,
        () => this.curMult < 2050,
        () => this.curMult < 550,
      ],
      T2MCAlt2: [
        () => this.curMult < 3500,
        () => this.curMult < 2700,
        () => this.curMult < 2050,
        () => this.curMult < 550,
        () => this.curMult < 3500,
        () => this.curMult < 2700,
        () => this.curMult < 2050,
        () => this.curMult < 550,
      ],
      T2MCAlt3: [
        () => this.curMult < this.stop1,
        () => this.curMult < this.stop2,
        () => this.curMult < this.stop3,
        () => this.curMult < this.stop4,
        () => this.curMult < this.stop1,
        () => this.curMult < this.stop2,
        () => this.curMult < this.stop3,
        () => this.curMult < this.stop4,
      ],
      T2Haxolotl: [
        () => this.curMult < this.stop1,
        () => (this.variables[1].cost + l10(this.haxolotlC1) < getMax(0)) && this.curMult < this.stop2,
        () => (this.variables[2].cost + l10(this.haxolotlC2) < getMax(1)) && this.curMult < this.stop3,
        () => (this.variables[3].cost + l10(this.haxolotlC3) < getMax(2)) && this.curMult < this.stop4,
        () => this.curMult < this.stop1,
        () => (this.variables[5].cost + l10(this.haxolotlC1) < getMax(0)) && this.curMult < this.stop2,
        () => (this.variables[6].cost + l10(this.haxolotlC2) < getMax(1)) && this.curMult < this.stop3,
        () => (this.variables[7].cost + l10(this.haxolotlC3) < getMax(2)) && this.curMult < this.stop4,
      ],
      T2MS: new Array(8).fill(true),
      T2QS: new Array(8).fill(true),
      T2ROI: new Array(8).fill(true),
      T2ROIMS: new Array(8).fill(true),
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = [
      () => true,
      () => true,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 1,
      () => true,
      () => true,
      () => this.milestones[1] > 0,
      () => this.milestones[1] > 1,
    ];
    return conditions;
  }
  getMilestonePriority(): number[] {
    if (this.strat === "T2MS" || this.strat === "T2ROIMS") {
      const tm100 = this.t % 100;
      if (tm100 < 10) return [2, 3, 0, 1];
      else if (tm100 < 50) return [0, 1, 2, 3];
      else if (tm100 < 60) return [2, 3, 0, 1];
      else if (tm100 < 100) return [1, 0, 2, 3];
    }
    if (this.strat === "T2QS") {
      let coastMulti = Infinity;
      if (this.lastPubRho > 0) coastMulti = 10;
      if (this.lastPubRho > 75) coastMulti = 200;
      if (this.lastPubRho > 100) coastMulti = 200;
      if (this.lastPubRho > 125) coastMulti = 200;
      if (this.lastPubRho > 150) coastMulti = 600;
      if (this.lastPubRho > 200) coastMulti = 100;
      if (this.lastPubRho > 225) coastMulti = 25;
      if (this.curMult < coastMulti) return [0, 1, 2, 3];
      else return [2, 3, 0, 1];
    }
    return [0, 1, 2, 3];
  }
  constructor(data: theoryData<theory>) {
    super(data, converter, {
      pubUnlockRho: 15
    });
    this.q1 = -Infinity;
    this.q2 = 0;
    this.q3 = 0;
    this.q4 = 0;
    this.r1 = 0;
    this.r2 = 0;
    this.r3 = 0;
    this.r4 = 0;
    this.haxolotlC1 = 1.0;
    this.haxolotlC2 = 1.0;
    this.haxolotlC3 = 1.0;
    this.milestoneUnlockSteps = 25;
    this.milestonesMax = [2, 2, 3, 3];
    this.variables = [
      new Variable({ currency: this.rho, name: "q1", cost: new FirstFreeCost(new ExponentialCost(10, 2)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ currency: this.rho, name: "q2", cost: new ExponentialCost(5000, 2), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ currency: this.rho, name: "q3", cost: new ExponentialCost(3e25, 3), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ currency: this.rho, name: "q4", cost: new ExponentialCost(8e50, 4), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ currency: this.rho, name: "r1", cost: new ExponentialCost(2e6, 2), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ currency: this.rho, name: "r2", cost: new ExponentialCost(3e9, 2), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ currency: this.rho, name: "r3", cost: new ExponentialCost(4e25, 3), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ currency: this.rho, name: "r4", cost: new ExponentialCost(5e50, 4), valueScaling: new StepwisePowerSumValue() }),
    ];

    this.targetRho = -1;
    this.stop1 = 3500;
    this.stop2 = 2700;
    this.stop3 = 2050;
    this.stop4 = 550;

    this.doSimEndConditions = () => this.targetRho == -1;
    this.updateMilestones();
  }
  async simulate(): Promise<simResult<theory>> {
    if (this.targetRho != -1) {
      this.pubConditions.push(() => this.maxRho >= this.targetRho);
    }
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPubRho < 250) this.updateMilestones();
      this.buyVariables();
      this.pubTableCollector.collectData(this);
    }
    this.trimBoughtVars();
    let stratExtra = ["T2MCAlt3", "T2Haxolotl"].includes(this.strat) ? ` 4:${this.stop4} 3:${this.stop3} 2:${this.stop2} 1:${this.stop1}` : "";
    if(this.strat == "T2Haxolotl") {
      stratExtra += ` c1:${this.haxolotlC1} c2:${this.haxolotlC2} c3: ${this.haxolotlC3}`;
    }
    return this.createResult(stratExtra);
  }
  tick() {
    const logdt = l10(this.dt);

    this.q1 = add(this.q1, this.variables[0].value + this.q2 + logdt);
    this.q2 = add(this.q2, this.variables[1].value + this.q3 + logdt);
    this.q3 = this.milestones[0] > 0 ? add(this.q3, this.variables[2].value + this.q4 + logdt) : this.q3;
    this.q4 = this.milestones[0] > 1 ? add(this.q4, this.variables[3].value + logdt) : this.q4;

    this.r1 = add(this.r1, this.variables[4].value + this.r2 + logdt);
    this.r2 = add(this.r2, this.variables[5].value + this.r3 + logdt);
    this.r3 = this.milestones[1] > 0 ? add(this.r3, this.variables[6].value + this.r4 + logdt) : this.r3;
    this.r4 = this.milestones[1] > 1 ? add(this.r4, this.variables[7].value + logdt) : this.r4;

    const rhodot = this.q1 * (1 + 0.05 * this.milestones[2]) + this.r1 * (1 + 0.05 * this.milestones[3]) + this.totMult + logdt;
    this.rho.add(rhodot);
  }
  
  buyVariables(): void {
    if ((this.strat === "T2ROI" || this.strat === "T2ROIMS") && this.timeToPub !== Infinity) { if (this.t < this.timeToPub) this.buyVariablesROI(); }
    else { super.buyVariables(); }
  }
  buyVariablesROI(): void {
    // skip if none of variables are currently affordable
    let anyAvailable = false;
    for (let i = 0; i < 8; i++) {
      if (this.variableAvailability[i]() && this.variables[i].cost <= this.rho.value) {
        anyAvailable = true; break;
      }
    }
    if (!anyAvailable) return;

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

    const t0 = l10(this.t), t = l10(this.timeToPub);

    let integrate = (f: (x: number) => number, a: number, b: number, tol: number = 1e-10, maxDepth: number = 50) => {
      const swapSigns = a > b;
      if (swapSigns) {
        const temp = a;
        a = b;
        b = temp;
      }

      const simp = (x0: number, x1: number, f0: number, fm: number, f1: number): SignedLogNumber => {
        return muls(add(f0, l10(4) + fm, f1) - l10(6), adds(x1, mulm1(x0)));
      };

      function recurse(a: number, b: number, fa: number, fm: number, fb: number, whole: SignedLogNumber, precision: number, depth: number): SignedLogNumber {
        const m = add2(a, b) - l10(2);
        const lm = add2(a, m) - l10(2);
        const rm = add2(m, b) - l10(2);
        const flm = f(lm);
        const frm = f(rm);

        const left  = simp(a, m, fa, flm, fm);
        const right = simp(m, b, fm, frm, fb);
        const delta = adds(adds(left, right), mulm1(whole));

        if (depth <= 0 || delta.value <= l10(15 * precision)) {
          return adds(adds(left, right, delta.value - l10(15)));
        }

        return adds(recurse(a, m, fa, flm, fm, left, precision / 2, depth - 1), recurse(m, b, fm, frm, fb, right, precision / 2, depth - 1));
      }

      const m = add2(a, b) - l10(2);
      const fa = f(a), fb = f(b), fm = f(m);
      let result = recurse(a, b, fa, fm, fb, simp(a, b, fa, fm, fb), precision, maxDepth);
      if (swapSigns) result = mulm1(result);
      return result;
    };

    // integral functions of Q1(t) and R1(t) per milestone
    let ft2Func = (t: number, dq1: number, dq2: number, q1: number, q2: number) => {
      return add2(dq1 + add2(dq2 + t * 2 - l10(2), q2 + t), q1);
    };
    let ft3Func = (t: number, dq1: number, dq2: number, dq3: number, q1: number, q2: number, q3: number) => {
      return add2(dq1 + add2(dq2 + add2(dq3 + t * 3 - l10(6), q3 + t * 2 - l10(2)), q2 + t), q1 + t);
    };
    let ft4Func = (t: number, dq1: number, dq2: number, dq3: number, dq4: number, q1: number, q2: number, q3: number, q4: number) => {
      return add2(dq1 + add2(dq2 + add2(dq3 + add2(dq4 + t * 4 - l10(24), q4 + t * 3 - l10(6)), q3 + t * 2 - l10(2)), q2 + t), q1 + t);
    };

    // buy level 0 upgrades just to be sure that all q and r are being generated
    for (let i = 0; i < 8; i++) {
      if (this.variableAvailability[i]() && this.variables[i].level === 0)
        buyVariable(i);
    }

    let bought: boolean;
    do {
      bought = false;

      let varIncrease = new Array(this.variables.length);
      for (let i = 0; i < this.variables.length; i++) {
        if (!this.variableAvailability[i]()) {
          varIncrease[i] = -Infinity;
          continue;
        }
        varIncrease[i] = subtract(this.variables[i].valueScaling.recomputeValue(this.variables[i].level + 1), this.variables[i].value);
      }
      
      // calculates the ROI value, aka [rho*(t) - rho(t)]dt from t0 to t1, where
      // rho(t) is the original function (the function if the variable is not bought),
      // rho*(t) is the new function after the variable is bought.
      const calculateRoi = (params: any): number => {
        params.dq1VarIncrease ??= -Infinity; params.dr1VarIncrease ??= -Infinity;
        params.dq2VarIncrease ??= -Infinity; params.dr2VarIncrease ??= -Infinity;
        params.dq3VarIncrease ??= -Infinity; params.dr3VarIncrease ??= -Infinity;
        params.dq4VarIncrease ??= -Infinity; params.dr4VarIncrease ??= -Infinity;

        const dq1 = add2(params.dq1VarIncrease, this.variables[0].value), dr1 = add2(params.dr1VarIncrease, this.variables[4].value);
        const dq2 = add2(params.dq2VarIncrease, this.variables[1].value), dr2 = add2(params.dr2VarIncrease, this.variables[5].value);
        const dq3 = add2(params.dq3VarIncrease, this.variables[2].value), dr3 = add2(params.dr3VarIncrease, this.variables[6].value);
        const dq4 = add2(params.dq4VarIncrease, this.variables[3].value), dr4 = add2(params.dr4VarIncrease, this.variables[7].value);
        const q1exp = 1 + 0.05 * this.milestones[2];
        const r1exp = 1 + 0.05 * this.milestones[3];

        let rhoDotTimeFactor = (t: number, exp: number, milestoneCount: number,
          dq1: number, dq2: number, dq3: number, dq4: number, q1: number, q2: number, q3: number, q4: number
        ) => {
          let value: number = -Infinity;
          switch (milestoneCount) {
            case 0: value = ft2Func(t, dq1, dq2, q1, q2); break;
            case 1: value = ft3Func(t, dq1, dq2, dq3, q1, q2, q3); break;
            case 2: value = ft4Func(t, dq1, dq2, dq3, dq4, q1, q2, q3, q4); break;
          }
          return value * exp;
        };
        let rhoIntegral = (t: number): number => {
          const newRhoDotQ = rhoDotTimeFactor(t, q1exp, this.milestones[0], dq1, dq2, dq3, dq4, this.q1, this.q2, this.q3, this.q4);
          const newRhoDotR = rhoDotTimeFactor(t, r1exp, this.milestones[1], dr1, dr2, dr3, dr4, this.r1, this.r2, this.r3, this.r4);

          const oldRhoDotQ = rhoDotTimeFactor(t, q1exp, this.milestones[0], this.variables[0].value, this.variables[1].value, this.variables[2].value, this.variables[3].value, this.q1, this.q2, this.q3, this.q4);
          const oldRhoDotR = rhoDotTimeFactor(t, r1exp, this.milestones[1], this.variables[4].value, this.variables[5].value, this.variables[6].value, this.variables[7].value, this.r1, this.r2, this.r3, this.r4);
          
          return this.totMult + subtract(newRhoDotQ + newRhoDotR, oldRhoDotQ + oldRhoDotR);
        };

        const value = integrate(rhoIntegral, t0, t, 1e-1, 1);
        if (value.isNegative) return -Infinity; // safeguard: value of the integral is negative
        return value.value;
      };

      const roi2: number[] = new Array(this.variables.length);
      roi2[0] = calculateRoi({ dq1VarIncrease: varIncrease[0] });
      roi2[1] = calculateRoi({ dq2VarIncrease: varIncrease[1] });
      roi2[2] = this.milestones[0] > 0 ? calculateRoi({ dq3VarIncrease: varIncrease[2] }) : -Infinity;
      roi2[3] = this.milestones[0] > 1 ? calculateRoi({ dq4VarIncrease: varIncrease[3] }) : -Infinity;
      roi2[4] = calculateRoi({ dr1VarIncrease: varIncrease[4] });
      roi2[5] = calculateRoi({ dr2VarIncrease: varIncrease[5] });
      roi2[6] = this.milestones[1] > 0 ? calculateRoi({ dr3VarIncrease: varIncrease[6] }) : -Infinity;
      roi2[7] = this.milestones[1] > 1 ? calculateRoi({ dr4VarIncrease: varIncrease[7] }) : -Infinity;
      const roi = roi2
        .map((val, i) => adds(muls(val, -this.variables[i].cost), mulm1(0))) // rescale: divide by variable cost and subtract 1
        .map((val, i) => this.variables[i].shouldBuy && this.variableAvailability[i]() && !val.isNegative ? val.value : -Infinity);
      
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
}
