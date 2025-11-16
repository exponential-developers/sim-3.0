import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, subtract, logToExp, getR9multiplier, toCallables, getLastLevel } from "../../Utils/helpers";

async function runT6CoastQ1R1(
    data: theoryData,
    targetQ1: number,
    origQ1: number,
    targetR1: number,
    origR1: number,
): Promise<simResult> {
  const sim = new t6Sim(data);
  sim.lastQ1 = targetQ1;
  sim.lastQ1Orig = origQ1;
  sim.lastR1 = targetR1;
  sim.lastR1Orig = origR1;
  return sim.simulate();
}

export default async function t6(data: theoryData): Promise<simResult> {
  let res;
  if(data.strat.includes("CoastQ1R1")) {
    let data2: theoryData = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("CoastQ1R1", "");
    const sim1 = new t6Sim(data2);
    const res1 = await sim1.simulate();
    const lastQ1 = getLastLevel("q1", res1.boughtVars);
    const lastR1 = getLastLevel("r1", res1.boughtVars);
    let startQ = 0;
    let limitQ = 15;
    let startR = 0;
    let limitR = 2;
    if(data2.strat.includes("T6C5d") || data2.strat.includes("IdleRecovery") || data2.strat.includes("T6AI")) {
      // There is little use in coasting too many levels with T6C5d.
      // In testing, we only needed 1-2 levels of q1 and 0-1 levels of r1, but in this case we do include more levels
      // for q for just in case.
      limitQ = 5;
    }
    // Originally, we start with no coasting at all:
    res = res1;
    for(let qLim = startQ; qLim < limitQ; qLim++) {
      if(lastQ1 - qLim <= 1) {
        break;
      }
      for(let rLim = startR; rLim < limitR; rLim++) {
        if(lastR1 - rLim <= 1) {
          break;
        }
        const resN = await runT6CoastQ1R1(data, lastQ1 - qLim, lastQ1, lastR1 - rLim, lastR1);
        if(resN.tauH > res.tauH) {
          res = resN;
        }
      }
    }
  }
  else {
    const sim = new t6Sim(data);
    res = await sim.simulate();
  }
  return res;
}

type theory = "T6";

class t6Sim extends theoryClass<theory> {
  q: number;
  r: number;
  k: number;
  lastQ1: number;
  lastQ1Orig: number;
  lastR1: number;
  lastR1Orig: number;
  stopC12: [number, number, boolean];

  getBuyingConditions(): conditionFunction[] {
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      T6: [true, true, true, true, true, true, true, true, true],
      T6C3: [true, true, true, true, () => this.variables[6].level == 0, () => this.variables[6].level == 0, true, false, false],
      T6C4: [true, true, true, true, false, false, false, true, false],
      T6C125: [true, true, true, true, true, true, false, false, true],
      T6C12: [true, true, true, true, true, true, false, false, false],
      T6C5: [true, true, true, true, false, false, false, false, true],
      T6C5CoastQ1R1: [
        () => this.variables[0].level < this.lastQ1,
        true,
        () => this.variables[2].level < this.lastR1,
        true,
        false,
        false,
        false,
        false,
        true
      ],
      T6Snax: [true, true, true, true, () => this.stopC12[2], () => this.stopC12[2], false, false, true],
      T6SnaxCoastQ1R1: [
        () => this.variables[0].level < this.lastQ1,
        true,
        () => this.variables[2].level < this.lastR1,
        true,
        () => this.stopC12[2],
        () => this.stopC12[2],
        false,
        false,
        true
      ],
      T6C3d: [
        () => this.variables[0].cost + l10(3) < Math.min(this.variables[1].cost, this.milestones[0] > 0 ? this.variables[3].cost : Infinity, this.variables[6].cost),
        true,
        () => this.variables[2].cost + l10(3) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[6].cost),
        true,
        () => this.variables[6].level == 0 && this.variables[4].cost + l10(3) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[6].cost),
        () => this.variables[6].level == 0,
        true,
        false,
        false,
      ],
      T6C4d: [
        () => this.variables[0].cost + l10(5) < Math.min(this.variables[1].cost, this.milestones[0] > 0 ? this.variables[3].cost : Infinity, this.variables[7].cost),
        true,
        () => this.variables[2].cost + l10(5) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[7].cost),
        true,
        false,
        false,
        false,
        true,
        false,
      ],
      T6C125d: [
        () => this.variables[0].cost + l10(8) 
          < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity),
        true,
        () => this.variables[2].cost + l10(8) 
          < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity),
        true,
        () => this.variables[4].cost + l10(8) 
          < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity),
        true,
        false,
        false,
        true,
      ],
      T6C12d: [
        () => this.variables[0].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost),
        true,
        () => this.variables[2].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost),
        true,
        () => this.variables[4].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[5].cost),
        true,
        false,
        false,
        false,
      ],
      T6C5d: [
        () => this.variables[0].cost + l10(7 + (this.variables[0].level % 10)) 
          < Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity),
        true,
        () => this.variables[2].cost + l10(5) 
          < Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity),
        true,
        false,
        false,
        false,
        false,
        true,
      ],
      T6C5dCoastQ1R1: [
        () => (this.variables[0].level < this.lastQ1) && (this.variables[0].cost + l10(7 + (this.variables[0].level % 10))
          < Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity)),
        true,
        () => (this.variables[2].level < this.lastR1) && (this.variables[2].cost + l10(5)
          < Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity)),
        true,
        false,
        false,
        false,
        false,
        true,
      ],
      T6C5dIdleRecovery: [
        () => {
          if (this.lastPub >= this.maxRho) return true;
          return this.variables[0].cost + l10(7 + (this.variables[0].level % 10)) 
            < Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity);
        },
        true,
        () => {
          if (this.lastPub >= this.maxRho) return true;
          return this.variables[2].cost + l10(5) 
            < Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity)
        },
        true,
        false,
        false,
        false,
        false,
        true,
      ],
      T6C5dIdleRecoveryCoastQ1R1: [
        () => {
          if (this.variables[0].level >= this.lastQ1) return false;
          if (this.lastPub >= this.maxRho) return true;
          return this.variables[0].cost + l10(7 + (this.variables[0].level % 10))
              < Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity);
        },
        true,
        () => {
          if (this.variables[2].level >= this.lastR1) return false;
          if (this.lastPub >= this.maxRho) return true;
          return this.variables[2].cost + l10(5)
              < Math.min(this.variables[1].cost, this.variables[3].cost, this.milestones[2] > 0 ? this.variables[8].cost : Infinity)
        },
        true,
        false,
        false,
        false,
        false,
        true,
      ],
      T6AI: [],
      T6AICoastQ1R1: [],
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = [
      () => true,
      () => true,
      () => this.milestones[0] > 0,
      () => this.milestones[0] > 0,
      () => true,
      () => true,
      () => true,
      () => true,
      () => this.milestones[2] > 0,
    ];
    return conditions;
  }
  getMilestonePriority(): number[] {
    const milestoneCount = Math.min(6, Math.floor(Math.max(this.lastPub, this.maxRho) / 25));
    switch (this.strat) {
      case "T6": return milestoneCount >= 4 ? [0, 3, 1, 2] : [1, 0, 3, 2];
      case "T6C3": return [0];
      case "T6C4": return [1, 0];
      case "T6C125": return [0, 2, 3];
      case "T6C12": return [0, 3];
      case "T6C5": return [0, 2];
      case "T6C5CoastQ1R1": return [0, 2];
      case "T6Snax": return [0, 3, 2];
      case "T6SnaxCoastQ1R1": return [0, 3, 2];
      case "T6C3d": return [0];
      case "T6C4d": return [1, 0];
      case "T6C125d": return [0, 2, 3];
      case "T6C12d": return [0, 3];
      case "T6C5d": return [0, 2];
      case "T6C5dCoastQ1R1": return [0, 2];
      case "T6AI": return [0, 3, 2];
      case "T6AICoastQ1R1": return [0, 3, 2];
      case "T6C5dIdleRecovery": return [0, 2];
      case "T6C5dIdleRecoveryCoastQ1R1": return [0, 2];
    }
  }
  getTotMult(val: number): number {
    return Math.max(0, val * 0.196 - l10(50)) + getR9multiplier(this.sigma);
  }
  calculateIntegral(vc1: number, vc2: number, vc3: number, vc4: number, vc5: number): number {
    const term1 = vc1 + vc2 + this.q + this.r;
    const term2 = vc3 + this.q * 2 + this.r - l10(2);
    const term3 = this.milestones[1] > 0 ? vc4 + this.q * 3 + this.r - l10(3) : -Infinity;
    const term4 = this.milestones[2] > 0 ? vc5 + this.q + this.r * 2 - l10(2) : -Infinity;
    this.k = term4 - term1;
    return this.totMult + add(term1, term2, term3, term4);
  }
  constructor(data: theoryData) {
    super(data);
    this.lastQ1 = -1;
    this.lastQ1Orig = -1;
    this.lastR1 = -1;
    this.lastR1Orig = -1;
    this.q = -Infinity;
    this.r = 0;
    this.pubUnlock = 12;
    this.milestoneUnlockSteps = 25;
    this.milestonesMax = [1, 1, 1, 3];
    this.variables = [
      new Variable({ name: "q1", cost: new FirstFreeCost(new ExponentialCost(15, 3)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "q2", cost: new ExponentialCost(500, 100), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "r1", cost: new ExponentialCost(1e25, 1e5), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "r2", cost: new ExponentialCost(1e30, 1e10), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c1", cost: new ExponentialCost(10, 2), valueScaling: new StepwisePowerSumValue(2, 10, 1) }),
      new Variable({ name: "c2", cost: new ExponentialCost(100, 5), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c3", cost: new ExponentialCost(1e7, 1.255), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "c4", cost: new ExponentialCost(1e25, 5e5), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c5", cost: new ExponentialCost(15, 3.9), valueScaling: new ExponentialValue(2) }),
    ];
    this.k = 0;
    this.stopC12 = [0, 0, true];
    this.updateMilestones();
  }
  async simulate(): Promise<simResult> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 150) this.updateMilestones();
      this.buyVariables();
      this.ticks++;
    }
    this.trimBoughtVars();
    let stratExtra = this.strat.includes("T6Snax") ? " " + logToExp(this.stopC12[0], 1) : "";
    if(this.strat.includes("CoastQ1R1")) {
      stratExtra += ` q1: ${this.lastQ1} r1: ${this.lastR1}`;
      // stratExtra += ` q1: ${this.lastQ1} q1delta: ${this.lastQ1Orig - this.lastQ1} r1: ${this.lastR1} r1delta: ${this.lastR1Orig - this.lastR1} `
    }
    return this.createResult(stratExtra);
  }
  tick() {
    const vc1 = this.variables[4].value * (1 + 0.05 * this.milestones[3]);

    let C = subtract(this.calculateIntegral(vc1, this.variables[5].value, this.variables[6].value, this.variables[7].value, this.variables[8].value), this.rho.value);

    this.q = add(this.q, this.variables[0].value + this.variables[1].value + l10(this.dt));

    this.r = this.milestones[0] > 0 ? add(this.r, this.variables[2].value + this.variables[3].value + l10(this.dt) - 3) : 0;

    const newCurrency = this.calculateIntegral(vc1, this.variables[5].value, this.variables[6].value, this.variables[7].value, this.variables[8].value);
    C = C > newCurrency ? newCurrency : C;
    this.rho.value = Math.max(0, subtract(newCurrency, C));

    if (this.k > 0.3) this.stopC12[1]++;
    else this.stopC12[1] = 0;

    if (this.stopC12[1] > 30 && this.stopC12[2]) {
      this.stopC12[0] = this.maxRho;
      this.stopC12[2] = false;
    }
  }
  getVariableWeights(): number[] {
    let weights = [
      l10(7 + (this.variables[0].level % 10)), //q1
      0, //q2
      l10(5 + (this.variables[2].level % 10)), //r1
      0, //r2
      Math.max(0, this.k) + l10(8 + (this.variables[4].level % 10)), //c1
      Math.max(0, this.k), //c2
      Infinity, //c3
      Infinity, //c4
      -Math.min(0, this.k), //c5
    ];
    // Not buying r1 and q1 past limit conditions:
    if (this.variables[0].level >= this.lastQ1 && this.lastQ1 != -1) {
      weights[0] = Infinity;
    }
    if (this.variables[2].level >= this.lastR1 && this.lastR1 != -1) {
      weights[2] = Infinity;
    }
    return weights;
  }
  buyVariables() {
    if (this.strat !== "T6AI" && this.strat != "T6AICoastQ1R1") super.buyVariables();
    else super.buyVariablesWeight();
  }
}
