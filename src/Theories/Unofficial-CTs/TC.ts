import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, LinearValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost } from "../../Utils/cost";
import { add, getBestResult, getLastLevel, l10, toCallables } from "../../Utils/helpers";

export default async function tc(data: theoryData): Promise<simResult> {
  if (data.theorySpecificInputs) {
    const validate = tcSim.validateTheorySpecificInputs(data.theorySpecificInputs);
    if (validate !== true) {
      throw new Error(validate);
    }
  }

  let res;
  if (data.strat.includes("Coast")) {
    let data2: theoryData = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("Coast", "");
    const sim1 = new tcSim(data2);
    const res1 = await sim1.simulate();
    // const lastQ1 = getLastLevel("q1", res1.boughtVars);
    const lastR1 = getLastLevel("r1", res1.boughtVars);
    const lastP1 = getLastLevel("p1", res1.boughtVars);
    const sim2 = new tcSim(data);
    sim2.variables[1].setOriginalCap(lastR1);
    sim2.variables[1].configureCap(20);
    sim2.variables[5].setOriginalCap(lastP1);
    sim2.variables[5].configureCap(1);
    res = await sim2.simulate();
  }
  else {
    const sim = new tcSim(data);
    res = await sim.simulate();
  }
  return res;
}

type theory = "TC";

/**
 * Simulates a 16-bit LFSR with 16 internal clock cycles per output.
 * @param {number} seed - The input value 
 * @returns {number} A random float between 0 and 1
 */
function lfsr16BitScrambled(seed: number): number {
    // Map input to 16-bit space (0 to 65535) and ensure non-zero
    let state = (seed % 65536) || 1;

    // Clock 16 times to completely roll over the 16-bit register
    for (let i = 0; i < 16; i++) {
        if (state & 1) {
            // Shift right and XOR with 16-bit polynomial 0xB400
            state = (state >> 1) ^ 0xB400;
        } else {
            state = state >> 1;
        }
    }

    // Scale to a float between 0 and 1 (divide by max 16-bit value)
    return state / 65535;
}

class tcSim extends theoryClass<theory> {
  // growing variables
  r: number;
  P: number;

  achievementMulti: number;

  // System parameters
  systemDt: number;
  error: [number, number];
  timer: number;
  integral: number;
  amplitude: number;
  frequency: number;
  kp: number;
  ki: number;
  kd: number;
  T: number;
  setPoint: number;
  targetT: number;

  static validateTheorySpecificInputs(values: string[]): true | string {
    if (values.length !== 1) return `Expected 1 value, got ${values.length}`;
    const val = values[0].trim();
    if (val === '') return true;
    if (!/[0-9]*/.test(values[0])) return `Invalid value ${val}. Expected a number between 0 and 18.`;
    const num = Number(val);
    if (num < 0 || num > 18) return `Invalid value ${val}. Expected a number between 0 and 18.`;
    return true;
  }

  getBuyingConditions(): conditionFunction[] {
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      TC: new Array(11).fill(true),
      TCd: [
        true,
        () => this.variables[1].cost + l10(10) < this.variables[2].cost,
        ...new Array(9).fill(true)
      ],
      TCCoast: [
        true,
        () => this.variables[1].shouldBuy,
        true,
        true,
        true,
        () => this.variables[5].shouldBuy,
        ...new Array(5).fill(true)
      ],
      TCdCoast: [
        true,
        () => (this.variables[1].cost + l10(10) < this.variables[2].cost) && this.variables[1].shouldBuy,
        true,
        true,
        true,
        () => this.variables[5].shouldBuy,
        ...new Array(5).fill(true)
      ],
    };
    return toCallables(conditions[this.strat]);
  }

  getVariableAvailability(): conditionFunction[] {
    return [
      () => true, // c1
      () => true, // r1
      () => true, // r2
      () => this.milestones[4] >= 0 && this.variables[3].level <= 75, // c2
      () => this.variables[4].level <= 100, // dTexp
      () => this.achievementMulti == 30, // p1
      () => this.achievementMulti == 30, // p2
      () => this.variables[7].level < 3, // c1exp perma
      () => this.variables[8].level < 3, // r1exp perma
      () => this.variables[9].level < 2, // r2exp perma
      () => this.variables[10].level < 2 // c1base perma
    ];
  }

  getTotMult(val: number): number {
    return Math.max(0, val * 0.2 - l10(2));
  }

  recomputeC1Base() {
    if (this.variables[0].valueScaling instanceof ExponentialValue) {
      this.variables[0].valueScaling.power = this.variables[10].value;
      this.variables[0].reCalculate();
    }
  }

  getPidValues(strat: string): [number, number, number, number] {
    switch (strat) {
      case "TC":
      case "TCd":
      case "TCCoast":
      case "TCdCoast":
        return [5, 30, 11, 189];
      default:
        return [5, 0, 0, 100];
    }
  }

  getAutomationSettings(strat: string): [number, number] {
    switch (strat) {
      case "TC":
      case "TCd":
      case "TCCoast":
      case "TCdCoast":
        return [200, 1];
      default:
        return [30, 1.5];
    }
  }

  getMilestonePriority(): number[] {
    return [0, 1, 2, 3, 4, 5];
  }
  estimateAchievementMultiplier() {
    return this.lastPub >= 750 ? 30 : this.lastPub >= 600 ? 10 : 1;
  }
  constructor(data: theoryData) {
    super(data);
    this.totMult = this.getTotMult(data.rho);
    // System parameters
    this.systemDt = 0.1;
    this.curMult = 0;
    this.error = [0, 0];
    this.r = 0;
    this.P = 0;
    this.timer = 0;
    this.integral = 0;
    let automationSettings = this.getAutomationSettings(data.strat);
    this.amplitude = automationSettings[0];
    this.frequency = automationSettings[1];
    let pidSettings = this.getPidValues(data.strat);
    this.kp = pidSettings[0];
    this.ki = pidSettings[1];
    this.kd = pidSettings[2];
    this.T = 30;

    const seed = Math.round(this.lastPub * this.tauFactor);
    const rng = lfsr16BitScrambled(seed);

    this.targetT = Math.round(rng * (120 - 60) + 60);
    this.setPoint = pidSettings[3];

    this.achievementMulti = data.theorySpecificInputs && /[0-9]+/.test(data.theorySpecificInputs[0])
      ? Math.pow(30, 1 / 18 * Number(data.theorySpecificInputs[0])) 
      : this.estimateAchievementMultiplier();
    this.pubUnlock = 8;
    this.variables = [
      new Variable({ name: "c1", cost: new ExponentialCost(1e5, 18), valueScaling: new ExponentialValue(2.75) }), // c1
      new Variable({ name: "r1", cost: new ExponentialCost(10, 1.585), valueScaling: new StepwisePowerSumValue() }), // r1
      new Variable({ name: "r2", cost: new ExponentialCost(1000, 8), valueScaling: new ExponentialValue(2) }), // r2
      new Variable({ name: "c2", cost: new ExponentialCost("1e420", 10**4.5), valueScaling: new ExponentialValue(Math.E) }), // c2
      new Variable({ name: "dTexp", cost: new ExponentialCost(1e15, 1000), valueScaling: new LinearValue(1) }), // dTExponent
      new Variable({ name: "p1", cost: new ExponentialCost("1e800", 1e4), valueScaling: new StepwisePowerSumValue(2, 10, 1) }), // p1
      new Variable({ name: "p2", cost: new ExponentialCost("1e830", 1e10), valueScaling: new ExponentialValue(2.2) }), // p2
      new Variable({ name: "c1exp", cost: new ExponentialCost(1e30, 1e30), valueScaling: new LinearValue(0.05, 1)}), // c1 exp perma
      new Variable({ name: "r1exp", cost: new ExponentialCost(1e40, 1e40), valueScaling: new LinearValue(0.05, 1)}), // r1 exp perma
      new Variable({ name: "r2exp", cost: new ExponentialCost(1e150, 1e175), valueScaling: new LinearValue(0.03, 1)}), // r2 exp perma
      new Variable({ name: "c1base", cost: new ExponentialCost(1e200, 1e175), valueScaling: new LinearValue(0.125, 2.75)}) // c1 base perma
    ];
    this.milestoneUnlocks = [10, 50, 100, 400, 420, 440, 1000, 1200];
    this.milestonesMax = [1, 1, 1, 2, 1, 2];
    this.forcedPubConditions.push(() => this.pubRho >= this.lastPub);
    this.simEndConditions.push(() => this.curMult > 15);
    for (let i=7; i<11; i++) {
      while (this.variables[i].cost <= this.lastPub && this.variableAvailability[i]()) {
        this.variables[i].buy();
      }
    }
    this.recomputeC1Base();
    this.updateMilestones();
  }

  async simulate(): Promise<simResult> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      this.updateMilestones();
      this.buyVariables();
      if (this.variables[1].shouldFork) await this.doForkVariable(1);
      if (this.variables[5].shouldFork) await this.doForkVariable(5);

    }
    this.trimBoughtVars();
    let stratExtra= '';
    if(this.strat.includes("Coast")) {
      stratExtra = this.variables[1].prepareExtraForCap(getLastLevel("r1", this.boughtVars)) +
          this.variables[5].prepareExtraForCap(getLastLevel("p1", this.boughtVars));
    }
    return getBestResult(this.createResult(stratExtra), this.bestForkRes);
  }

  tick() {
    // System update
    const Q = 20; // max heat duty in W
    const h = 5; // thermal passive convection coefficient for Al (W/m^2 k)
    const Cp = 0.89; // heat capacity for Al (J/g/k)
    const area = 0.024; // area of element (m^2)
    const mass = 10; // grams
    const Tc = 30;

    const vki = this.milestones[1] > 0 ? this.ki : 0;
    const vkd = this.milestones[2] > 0 ? this.kd : 0;
    this.timer += this.systemDt;

    if (this.timer > this.frequency) {
      this.T = this.amplitude;
      this.timer = 0;
      this.integral = 0;
    }

    this.error[1] = this.error[0];
    this.error[0] = this.setPoint - this.T;
    this.integral += this.error[0];
    const derivative = (this.error[0] - this.error[1]) / this.systemDt;
    // Anti-windup scheme
    if (this.integral > 100) this.integral = 100;
    if (this.integral < -100) this.integral = -100;
    const output = Math.round(Math.max(0, Math.min(this.kp * this.error[0] + vki * this.integral + vkd * derivative, 512))); // range 0-512

    // Heating simulation
    const suppliedHeat = Q * output / 512;
    const dT = Math.abs(1 / mass / Cp * (suppliedHeat - (this.T - Tc) * h * area));
    const exponentialTerm = (suppliedHeat - h * area * (this.T - Tc)) * Math.pow(Math.E, -1 * this.systemDt / mass / Cp);
    this.T = Tc + (suppliedHeat - exponentialTerm) / (h * area);

    // Variable calculation
    // P Update
    if (this.achievementMulti == 30) {
      let dP =
        this.variables[5].value +
        this.variables[6].value +
        Math.LOG10E * (-0.2 * Math.pow(0.08, this.milestones[4]) * Math.abs(this.T - this.targetT))
      this.P = add(this.P, dP + l10(this.dt));
    }

    // R Update
    const r1exp = this.variables[8].value;
    const r2exp = this.variables[9].value;
    const dr =
      this.variables[1].value * r1exp +
      this.variables[2].value * r2exp -
      l10(1 + l10(1 + Math.abs(this.error[0])));
    this.r = add(this.r, dr + l10(this.dt));

    // rho update
    const c1exp = this.variables[7].value;
    const vc1 = this.variables[0].value * c1exp;
    const vc2 = this.milestones[4] > 0 ? this.variables[3].value : 0;
    const mrexp = this.milestones[3];
    this.rho.add(
      this.P +
      this.r * (1 + mrexp * 0.001) +
      (vc1 + vc2 + l10(dT) * (2 + this.variables[4].value)) / 2 +
      l10(this.dt) +
      this.totMult +
      l10(this.achievementMulti)
    );
  }
  copyFrom(other: this) {
    super.copyFrom(other);
    this.timer = other.timer;
    this.error[0] = other.error[0];
    this.error[1] = other.error[1];
    this.r = other.r;
    this.P = other.P;
    this.integral = other.integral;
    this.recomputeC1Base();
  }
  copy() {
    let copySim = new tcSim(this.getDataForCopy());
    copySim.copyFrom(this);
    return copySim;
  }

  onVariablePurchased(id: number): void {
    if (id == 10) this.recomputeC1Base();
    if (
        [1, 5].includes(id) &&
        this.strat.includes("Coast") &&
        this.variables[id].shouldBuy &&
        this.variables[id].coastingCapReached()
    ) {
      this.variables[id].shouldFork = true;
    }
  }
}
