import { global } from "../../Sim/main";
import Variable from "../../Utils/variable";
import { ExponentialValue, LinearValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { toCallables, adds, l10, add2, subtract, logToExp } from "../../Utils/helpers";
import { traditionalConverter } from "../../Utils/progressConversion";
import traditionalTheoryClass from "../traditionalTheory";
import Currency from "../../Utils/currency";
import { trueFunc } from "../../Utils/functions";

type theory = "TOE";

const tauFactor = 0.4;

const converter: ProgressValueConverterRho = traditionalConverter({
  tauFactor,
  multExponent: 0.5
});

const TOE: TheoryInterface<theory> = {
  simulate: toe,
  converter
};

export default TOE;

async function toe(data: theoryData<theory>): Promise<simResult<theory>> {
  const sim = new toePubSim(data);
  const res = await sim.simulate();
  return res;
}

const tickspeedConsts = [
  11 / (2 ** 10),
  10 / (2 ** 9),
  9 / (2 ** 8),
  8 / (2 ** 7),
  7 / (2 ** 6),
  6 / (2 ** 5),
  5 / (2 ** 4),
  4 / (2 ** 3),
  3 / (2 ** 2),
  2 / (2 ** 1),
];

const conjectureGoals = [
  [8, 10, 12],
  [7, 9, 11],
  [8, 10, 16 + l10(3)],
  [l10(250000), l10(750000), l10(2250000)],
];

/*function calculateXDxSoftcapped(x: number, dx: SignedLogNumber, initialThreshold: number, apply: ((x: SignedLogNumber) => SignedLogNumber)[]): number {
  let new_x;
  if (x < initialThreshold) {
    new_x = adds(x, dx);
    if (!new_x.isNegative && new_x.value >= initialThreshold) {
      new_x = apply[0](adds(new_x.value - initialThreshold)).value + initialThreshold;
    } else if (new_x.isNegative) {
      new_x = -Infinity;
    } else {
      new_x = new_x.value;
    }
  } else {
    const result = apply[0](adds(apply[1](adds(x - initialThreshold)), muls(dx, -initialThreshold)));
    if (result.isNegative) {
      new_x = -Infinity;
    } else {
      new_x = result.value + initialThreshold;
    }
  }
  return new_x;
}*/

function calculateXDxSoftcapped(x: number, dx: number, initialThreshold: number, apply: ((x: number) => number)[]): number {
  let new_x;
  if (x < initialThreshold) {
    new_x = add2(x, dx);
    if (new_x >= initialThreshold) {
      new_x = apply[0](new_x - initialThreshold) + initialThreshold;
    }
  } else {
    new_x = apply[0](add2(apply[1](x - initialThreshold), dx - initialThreshold)) + initialThreshold;
  }
  return new_x;
}

class toeGammaSim extends traditionalTheoryClass<theory> {
  softcapFn: ((x: number) => number)[];
  
  rhoVariables: Variable[];
  rhoPermaVariables: Variable[];
  rhoVariableBuyingConditions: conditionFunction[];
  rhoVariableAvailability: conditionFunction[];

  q1: number;
  q2: number;
  q3: number;
  q4: number;

  tGamma: number;
  /** The game's own t (grows by dt * tickspeed, 1.5 * tickspeed per second), used by γ2's t^3 */
  tGame: number;
  gamma: Currency;
  gammaVariables: Variable[];
  gammaVariableAvailability: conditionFunction[];
  gammaMaxRho: number;
  gammaResets: number;
  activeConjecture: { id: number, difficulty: number };
  completedConjectures: number[];

  gammaH: number;
  maxGammaH: number;
  gammaResetT: number;
  gammaResetCurrency: number;
  gammaForcedPubConditions: conditionFunction[];
  gammaPubConditions: conditionFunction[];
  gammaSimEndConditions: conditionFunction[];
  gammaDoSimEndConditions: conditionFunction;

  evaluateGammaForcedPubConditions(): boolean {
    return this.gammaForcedPubConditions.every((cond) => cond())
  }

  evaluateGammaPubConditions(): boolean {
    return this.gammaPubConditions.some((cond) => cond())
  }

  evaluateGammaSimEndConditions(): boolean {
    return this.gammaSimEndConditions.some((cond) => cond())
  }
  
  endGammaSimulation(): boolean {
    return this.evaluateGammaForcedPubConditions() && (this.evaluateGammaPubConditions() || (this.gammaDoSimEndConditions() && this.evaluateGammaSimEndConditions()));
  }

  getBuyingConditions(): conditionFunction[] { return []; }

  getVariableAvailability(): conditionFunction[] { return []; }

  getRhoBuyingConditions(): conditionFunction[] {
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      TOE: [
        true,
        true,
        true,
        true,
      ],
    };
    return toCallables(conditions[this.strat]);
  }

  getRhoVariableAvailability(): conditionFunction[] {
    // Conjecture 4 (id 3) disables dq4 from difficulty 1, dq3 from 2 and dq2 from 3
    const disabledBy = (minDifficulty: number) => () =>
      !(this.activeConjecture.id === 3 && this.activeConjecture.difficulty >= minDifficulty);
    const conditions: conditionFunction[] = [
      trueFunc,
      disabledBy(3),
      disabledBy(2),
      disabledBy(1),
    ];
    return conditions;
  }

  getGammaVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = [
      trueFunc,
      trueFunc,
      () => this.gammaVariables[2].level < 5,
      () => this.gammaVariables[3].level < 3,
      () => this.gammaVariables[4].level < 5,
      () => this.gammaVariables[5].level < 6,
      () => this.gammaVariables[6].level < 3,
    ];
    return conditions;
  }

  recordPurchase(variable: Variable): void {
    /*if (this.maxRho + this.settings.boughtVarsDelta > this.lastPubRho) {
      this.boughtVars.push({
        variable: variable.name,
        level: variable.level + 1,
        cost: variable.cost,
        timeStamp: this.t,
        symbol: (variable.currency ?? this.rho).symbol
      });
    }*/
  }

  computeFirstSoftcap(): number {
    let result = 0.8 + 0.01 * this.completedConjectures[3];
    if (this.activeConjecture.id === 3) result /= 2;
    return result;
  }

  constructor(data: theoryData<theory>) {
    super(data, converter);

    this.milestoneUnlocks = [];
    this.milestonesMax = [];

    this.softcapFn = [
      (value) => {
        let result = value;
        if (result > 0) result *= this.computeFirstSoftcap();
        return result;
      },
      (value) => {
        let result = value;
        if (result > 0) result /= this.computeFirstSoftcap();
        return result;
      }
    ];

    this.rhoVariables = [
      new Variable({ currency: this.rho, name: "dq1", cost: new FirstFreeCost(new ExponentialCost(0.1, Math.log2(2e2) / 2, true)), valueScaling: new StepwisePowerSumValue(2, 9, 0) }),
      new Variable({ currency: this.rho, name: "dq2", cost: new FirstFreeCost(new ExponentialCost(1, Math.log2(2e4) / 2, true)), valueScaling: new StepwisePowerSumValue(2, 9, 0) }),
      new Variable({ currency: this.rho, name: "dq3", cost: new ExponentialCost(10000, Math.log2(2e6) / 2, true), valueScaling: new StepwisePowerSumValue(2, 9, 0) }),
      new Variable({ currency: this.rho, name: "dq4", cost: new ExponentialCost(8e18, Math.log2(2e8) / 2, true), valueScaling: new StepwisePowerSumValue(2, 9, 0) }),
    ];
    this.rhoPermaVariables = [
      new Variable({ name: `nt`, currency: this.rho, cost: new ExponentialCost(2, 80), valueScaling: new LinearValue(1, 0) }),
    ];
    this.rhoVariableBuyingConditions = this.getRhoBuyingConditions();
    this.rhoVariableAvailability = this.getRhoVariableAvailability();

    this.q1 = this.q2 = -Infinity;
    this.q3 = this.q4 = 0;

    this.tGamma = 0;
    this.tGame = 0;
    this.gamma = new Currency("γ");
    this.gammaVariables = [
      new Variable({ name: `γ1`, currency: this.gamma, cost: new ExponentialCost(1, 1.85), valueScaling: new ExponentialValue(1.8) }),
      new Variable({ name: `γ2`, currency: this.gamma, cost: new ExponentialCost(1, 1.7), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: `γ3`, currency: this.gamma, cost: new ExponentialCost(3, 14.5), valueScaling: new LinearValue(1, 0) }),
      new Variable({ name: `γ4`, currency: this.gamma, cost: new ExponentialCost(70, 5), valueScaling: new ExponentialValue(1.1) }),
      new Variable({ name: `γ5`, currency: this.gamma, cost: new ExponentialCost(100, 2.5), valueScaling: new LinearValue(2, 0) }),
      new Variable({ name: `γ6`, currency: this.gamma, cost: new ExponentialCost(10, 3), valueScaling: new LinearValue(0.04, 0) }),
      new Variable({ name: `γ7`, currency: this.gamma, cost: new ExponentialCost(10000, 2.1), valueScaling: new LinearValue(0.1, 0) }),
    ];
    this.gammaVariableAvailability = this.getGammaVariableAvailability();
    this.gammaMaxRho = -Infinity;
    this.gammaResets = 0;
    this.activeConjecture = { id: -1, difficulty: 0 };
    this.completedConjectures = [0, 0, 0, 0];
    
    this.gammaH = 0;
    this.maxGammaH = 0;
    this.gammaResetT = 0;
    this.gammaResetCurrency = -Infinity;
    // Reset once the γ left over plus the pending γ buys the cheapest available γ upgrade (or the
    // q's have all decayed)
    this.gammaForcedPubConditions = [() => add2(this.gamma.value, this.getGammaPending(this.gammaMaxRho)) >= Math.min(...[0, 1, 2, 3, 4, 5, 6].map(i => this.gammaVariableAvailability[i]() ? this.gammaVariables[i].cost : Infinity)) || this.q1 < -10 && this.q2 < -10 && this.q3 < -10 && this.q4 < -10];
    this.gammaPubConditions = [() => true];
    this.gammaSimEndConditions = [() => this.q1 < -10 && this.q2 < -10 && this.q3 < -10 && this.q4 < -10];
    this.gammaDoSimEndConditions = () => true;

    this.recomputeDQ1Base();
  }

  /** γ7 raises dq1's stepwise base: 2 + 0.1 * γ7 level */
  recomputeDQ1Base() {
    const scaling = this.rhoVariables[0].valueScaling;
    if (scaling instanceof StepwisePowerSumValue) {
      scaling.base = 2 + this.gammaVariables[6].value;
      this.rhoVariables[0].reCalculate();
    }
  }

  getMilestonePriority(): number[] {
    return [];
  }

  buySingleVariable(variable: Variable): boolean {
    const currency = variable.currency ?? this.rho;
    if (currency.value >= variable.cost) {
      this.recordPurchase(variable);
      currency.subtract(variable.cost);
      variable.buy();
      return true;
    }
    return false;
  }

  buyRhoVariables(): void {
    while (this.rhoPermaVariables[0].level < 4 && this.buySingleVariable(this.rhoPermaVariables[0])) {
      ;
    }

    for (let i = this.rhoVariables.length - 1; i >= 0; i--) {
      while (this.rhoVariableAvailability[i]() && this.rhoVariableBuyingConditions[i]()) {
        if (!this.buySingleVariable(this.rhoVariables[i])) break;
      }
    }
  }

  buyGammaVariables(): void {
    for (let i = this.gammaVariables.length - 1; i >= 0; i--) {
      while (this.gammaVariableAvailability[i]() && this.buySingleVariable(this.gammaVariables[i])) {
        if (i === 6) this.recomputeDQ1Base();
      }
    }
  }

  calculateQCap(dq: number, qDecay: number): number {
    let result = l10(qDecay) + dq;

    const softcap = this.computeFirstSoftcap();
    const initialThreshold = 0;
    if (result >= initialThreshold) {
      result = initialThreshold + (dq - initialThreshold - l10(Math.expm1(Math.log1p(1 / qDecay) / softcap))) * softcap;
    }

    return result;
  }

  updateSimStatus(): void {
    this.updateT();

    this.gammaH = this.getGammaPending(this.gammaMaxRho) / (this.tGamma / 3600);
    if (this.maxGammaH < this.gammaH || !this.evaluateGammaForcedPubConditions() || this.evaluateGammaPubConditions()) {
      this.maxGammaH = this.gammaH;
      this.gammaResetT = this.tGamma;
      this.gammaResetCurrency = this.gammaMaxRho;
    }
  }

  updateT(): void {
    super.updateT();
    this.tGamma += this.dt / 1.5;
  }

  async simulateGamma(): Promise<{ gammaResetT: number, gammaResetCurrency: number }> {
    while (!this.endGammaSimulation()) {
      this.tickGamma();
      this.updateSimStatus();
      this.buyRhoVariables();
    }
    return {
      gammaResetT: this.gammaResetT,
      gammaResetCurrency: this.gammaResetCurrency,
    };
  }

  getQDecay(): number {
    let q_decay = (100 + this.gammaVariables[4].value) * (1.2 ** this.completedConjectures[0]);
    if (this.activeConjecture.id === 0) {
      if (this.activeConjecture.difficulty === 1) q_decay /= 5;
      else if (this.activeConjecture.difficulty === 2) q_decay /= 10;
      else q_decay /= 20;
    }
    return q_decay;
  }

  tickGamma() {
    // The game steps q and ρ with dt = 0.1s * 1.5 * tickspeed. A large sim dt makes the q update
    // overshoot below 0 (it relaxes toward its cap over about softcap * q_decay game time), so the
    // tick is split into steps of at most a tenth of that time.
    const gameDt = this.dt * tickspeedConsts[this.rhoPermaVariables[0].value + this.gammaVariables[2].value];
    const maxStep = this.getQDecay() * this.computeFirstSoftcap() / 10;
    const steps = Math.max(1, Math.ceil(gameDt / maxStep));
    const stepDt = gameDt / steps;
    const l10_step = l10(stepDt);
    for (let i = 0; i < steps; i++) {
      this.tickQ(l10_step);
      this.tickRho(l10_step);
      this.tGame += stepDt;
    }
  }

  tickQ(dt: number) {
    const q_decay = this.getQDecay();
    // log10(1 + 1/q_decay): the game subtracts q + q / q_decay
    const l10_decay_factor = add2(0, -l10(q_decay));

    const dq1 = this.rhoVariables[0].value - 1 + this.q2;
    const dq2 = this.rhoVariables[1].value - 1 + this.gammaVariables[3].value + this.q3;
    const dq3 = this.rhoVariables[2].value - 1 + this.q4;
    const dq4 = this.rhoVariables[3].value - 1;
    const q1_cap = this.calculateQCap(dq1, q_decay);
    const q2_cap = this.calculateQCap(dq2, q_decay);
    const q3_cap = this.calculateQCap(dq3, q_decay);
    const q4_cap = this.calculateQCap(dq4, q_decay);

    // All four use the old q values, as in the game
    const new_q1 = this.nextQ(this.q1, dq1, q1_cap, l10_decay_factor, dt);
    const new_q2 = this.nextQ(this.q2, dq2, q2_cap, l10_decay_factor, dt);
    const new_q3 = this.nextQ(this.q3, dq3, q3_cap, l10_decay_factor, dt);
    const new_q4 = this.nextQ(this.q4, dq4, q4_cap, l10_decay_factor, dt);
    this.q1 = new_q1;
    this.q2 = new_q2;
    this.q3 = new_q3;
    this.q4 = new_q4;
  }

  /**
   * One q update, in log10: q + (softcapped(q, dq) - q - q / q_decay) * dt, clamped to the cap when
   * it crosses it from below and to 0 (-Infinity) when it goes negative, like the game.
   */
  nextQ(q: number, dq: number, cap: number, l10_decay_factor: number, dt: number): number {
    const production = adds(calculateXDxSoftcapped(q, dq, 0, this.softcapFn), { isNegative: true, value: q + l10_decay_factor });
    const q_new = adds(q, { ...production, value: production.value + dt });
    if (q < cap && !q_new.isNegative && q_new.value >= cap) return cap;
    return q_new.isNegative ? -Infinity : q_new.value;
  }

  tickRho(dt: number) {
    // 1 + 1e-6 * γ2 * t^3, with the game's t
    let drho = this.gammaVariables[0].value + add2(0, this.gammaVariables[1].value + 3 * l10(this.tGame / 100));
    if (this.activeConjecture.id === 2) {
      if (this.activeConjecture.difficulty === 1) drho += this.q2;
      if (this.activeConjecture.difficulty === 2) drho += this.q3;
      if (this.activeConjecture.difficulty === 3) drho += this.q4;
    } else {
      drho += this.q1;
      if (this.completedConjectures[2] > 0) drho += Math.max(this.q2, 0);
      if (this.completedConjectures[2] > 1) drho += Math.max(this.q3, 0);
      if (this.completedConjectures[2] > 2) drho += Math.max(this.q4, 0);
    }

    this.rho.add(subtract(calculateXDxSoftcapped(this.rho.value, drho, 0, this.softcapFn), this.rho.value) + dt);
    this.gammaMaxRho = Math.max(this.rho.value, this.gammaMaxRho);
  }

  getGammaPending(rho = this.gammaMaxRho): number {
    const threshold = l10(1000);
    const gammaExpScaling = 0.2 + this.gammaVariables[5].value;
    if (rho < threshold) {
      return -Infinity;
    } else {
      let result = (rho - threshold) * gammaExpScaling;
      // Achievement 3 ("Decay Was Too Strong", unlocked by the first γ reset) doubles γ gain. With a
      // previous publication it is already unlocked.
      if (this.gammaResets > 0 || this.data.input.value !== -Infinity) result += l10(2);
      return result + this.totMult;
    }
  }

  copyFrom(other: toeGammaSim): void {
    super.copyFrom(other as this);

    this.rhoVariables = other.rhoVariables.map((value) => value.copy(this.rho));
    // nt (tickspeed) is a permanent upgrade: it carries over between γ resets
    this.rhoPermaVariables = other.rhoPermaVariables.map((value) => value.copy(this.rho));

    this.q1 = other.q1;
    this.q2 = other.q2;
    this.q3 = other.q3;
    this.q4 = other.q4;

    this.tGamma = other.tGamma;
    this.tGame = other.tGame;
    this.gamma = other.gamma.copy();
    this.gammaVariables = other.gammaVariables.map((value) => value.copy(this.gamma));
    this.gammaResets = other.gammaResets;
    this.activeConjecture = { ...other.activeConjecture };
    this.completedConjectures = [...other.completedConjectures];

    this.gammaH = other.gammaH;
    this.maxGammaH = other.maxGammaH;
    this.gammaResetT = other.gammaResetT;
    this.gammaResetCurrency = other.gammaResetCurrency;
  }
}

class toePubSim extends toeGammaSim {
  maxGamma: number;

  constructor(data: theoryData<theory>) {
    super(data);
    this.maxGamma = 0;

    this.forcedPubConditions = [() => this.completedConjectures[0] >= 2 && this.completedConjectures[1] >= 2 && this.completedConjectures[2] >= 2 && this.completedConjectures[3] === 3];
    this.pubConditions = [() => this.maxRho >= this.rhoCap];
    this.simEndConditions = [() => this.t > this.pubT * 10];
    this.doSimEndConditions = () => true;
  }

  updateSimStatus(): void {
    if (this.gamma.value > this.maxGamma) this.maxGamma = this.gamma.value;

    // τ = γ^0.4; the last publication is already a τ value
    this.tauH = (this.maxGamma * tauFactor - converter.convertTo(this.lastPub, "tau")) / (this.t / 3600);
    if (this.maxTauH < this.tauH || !this.forcedPubConditions.every(cond => cond()) || this.pubConditions.some(cond => cond())) {
      this.maxTauH = this.tauH;
      this.pubT = this.t;
      this.pubRho = this.maxGamma;
    }
  }

  async simulate(): Promise<simResult<theory>> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;

      this.rho.value = -Infinity;
      this.rhoVariables.forEach((x) => {
        x.level = 0;
        x.init();
      });
      this.q1 = -Infinity;
      this.q2 = -Infinity;
      this.q3 = l10(1.2);
      this.q4 = 0;
      this.tGamma = 0;
      this.tGame = 0;
      // Each γ reset starts like a new publication: dt grows during a run (ddt), and without this
      // it would keep growing across every reset, since the gamma sim's dt is copied back below
      this.dt = this.settings.dt;

      this.gammaH = 0;
      this.maxGammaH = 0;
      this.gammaResetT = 0;
      this.gammaResetCurrency = -Infinity;

      if (this.activeConjecture.id === -1 && this.gammaVariables[3].level === 3 && this.gammaVariables[4].level === 5 && this.gammaVariables[5].level === 6 && this.gammaVariables[6].level === 3) {
        let completedAny;
        do {
          completedAny = false;
          for (let i = 0; i < 4; i++) {
            if (this.completedConjectures[i] === 3) continue;

            const rhoGoal = conjectureGoals[i][this.completedConjectures[i]];
            const conjSim = new toeGammaSim(this.getDataForCopy());
            conjSim.copyFrom(this);
            conjSim.activeConjecture.id = i;
            conjSim.activeConjecture.difficulty = this.completedConjectures[i] + 1;
            conjSim.q3 = l10(1.2) + this.completedConjectures[1] * l10(2);
            conjSim.q4 = this.completedConjectures[1] * l10(2);
            // A conjecture run ends at its goal, or gives up after an hour
            conjSim.gammaForcedPubConditions = [() => conjSim.gammaMaxRho >= rhoGoal || conjSim.tGamma > 60 * 60];
            if (i === 1) {
              if (conjSim.activeConjecture.difficulty === 1) {
                conjSim.q4 = -Infinity;
              } else if (conjSim.activeConjecture.difficulty === 2) {
                conjSim.q4 = -Infinity;
                conjSim.q3 = -Infinity;
                conjSim.q2 = 0;
              } else if (conjSim.activeConjecture.difficulty === 3) {
                conjSim.q4 = -Infinity;
                conjSim.q3 = -Infinity;
                conjSim.q2 = -Infinity;
                conjSim.q1 = 0;
              }
            } else if (i === 2) {
              // Conjecture 3 makes dq4 cheaper (reCalculate only updates the value, so set the cost too)
              const dq4 = conjSim.rhoVariables[3];
              dq4.data.cost = new ExponentialCost(1.0001e10, Math.log2(2e8) / 2, true);
              dq4.cost = dq4.getCostForLevel(dq4.level);
            } else if (i === 3) {
              if (conjSim.activeConjecture.difficulty >= 3) conjSim.q2 = 0;
            }
            const result = await conjSim.simulateGamma();
            if (conjSim.gammaMaxRho >= rhoGoal) {
              completedAny = true;
              this.completedConjectures[i]++;
              
              this.boughtVars.push({
                variable: `Entered Conjecture ${conjSim.activeConjecture.id}`,
                level: conjSim.activeConjecture.difficulty,
                cost: 0,
                timeStamp: this.t
              });
              this.t += result.gammaResetT;
              this.boughtVars.push({
                variable: `Completed Conjecture ${conjSim.activeConjecture.id}`,
                level: conjSim.activeConjecture.difficulty,
                cost: 0,
                timeStamp: this.t
              });
            }
          }
        } while (completedAny);
      }
      this.q3 += this.completedConjectures[1] * l10(2);
      this.q4 += this.completedConjectures[1] * l10(2);

      const gammaSim = new toeGammaSim(this.getDataForCopy());
      gammaSim.copyFrom(this);
      const gammaSimResult = await gammaSim.simulateGamma();

      const old_t = this.t;
      this.copyFrom(gammaSim);
      this.t = old_t + gammaSimResult.gammaResetT;
      // After copyFrom, which copies the γ run's (unchanged) reset count
      this.gammaResets++;
      
      this.boughtVars.push({
        variable: `Reset at ${this.rho.symbol}=${logToExp(gammaSimResult.gammaResetCurrency)}`,
        level: this.gammaResets,
        cost: gammaSimResult.gammaResetCurrency,
        timeStamp: this.t
      });
      this.gamma.add(this.getGammaPending(gammaSimResult.gammaResetCurrency));

      this.updateSimStatus();
      this.buyGammaVariables();
      this.pubTableCollector.collectData(this);
    }
    this.trimBoughtVars();
    return this.createResult();
  }
}
