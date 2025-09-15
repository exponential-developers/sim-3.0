import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, LinearValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost } from "../../Utils/cost";
import { add, l10, toCallables } from "../../Utils/helpers";

export default async function tc(data: theoryData): Promise<simResult> {
  const sim = new tcSim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "TC";

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

  getBuyingConditions(): conditionFunction[] {
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      TC: new Array(11).fill(true),
      TCd: [
        true, 
        () => this.variables[1].cost + l10(10) < this.variables[2].cost, 
        ...new Array(9).fill(true)
      ]
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
        return [5, 30, 11, 189];
      default:
        return [5, 0, 0, 100];
    }
  }

  getAutomationSettings(strat: string): [number, number] {
    switch (strat) {
      case "TC":
      case "TCd":
        return [200, 1];
      default:
        return [30, 1.5];
    }
  }

  getMilestonePriority(): number[] {
    return [0, 1, 2, 3, 4, 5];
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
    this.T = 100;
    this.setPoint = pidSettings[3];

    this.achievementMulti = this.lastPub >= 750 ? 30 : this.lastPub >= 600 ? 10 : 1;
    this.pubUnlock = 8;
    this.variables = [
      new Variable({ name: "c1", cost: new ExponentialCost(1e5, 18), valueScaling: new ExponentialValue(2.75) }), // c1
      new Variable({ name: "r1", cost: new ExponentialCost(10, 1.585), valueScaling: new StepwisePowerSumValue() }), // r1
      new Variable({ name: "r2", cost: new ExponentialCost(1000, 8), valueScaling: new ExponentialValue(2) }), // r2
      new Variable({ name: "c2", cost: new ExponentialCost("1e400", 10**4.5), valueScaling: new ExponentialValue(Math.E) }), // c2
      new Variable({ name: "dTexp", cost: new ExponentialCost(1e15, 1000), valueScaling: new LinearValue(1) }), // dTExponent
      new Variable({ name: "p1", cost: new ExponentialCost("1e750", 16.61), valueScaling: new StepwisePowerSumValue() }), // p1
      new Variable({ name: "p2", cost: new ExponentialCost("1e900", 1e15), valueScaling: new ExponentialValue(2) }), // p2
      new Variable({ name: "c1exp", cost: new ExponentialCost(1e30, 1e30), valueScaling: new LinearValue(0.05, 1)}), // c1 exp perma
      new Variable({ name: "r1exp", cost: new ExponentialCost(1e40, 1e40), valueScaling: new LinearValue(0.05, 1)}), // r1 exp perma
      new Variable({ name: "r2exp", cost: new ExponentialCost(1e150, 1e175), valueScaling: new LinearValue(0.03, 1)}), // r2 exp perma
      new Variable({ name: "c1base", cost: new ExponentialCost(1e200, 1e175), valueScaling: new LinearValue(0.125, 2.75)}) // c1 base perma
    ];
    this.milestoneUnlocks = [10, 50, 100, 400, 420, 440, 950, 1150];
    this.milestonesMax = [1, 1, 1, 2, 1, 2];
    this.forcedPubConditions.push(() => this.pubRho >= this.lastPub);
    this.simEndConditions.push(() => this.curMult > 15);
    for (let i=7; i<11; i++) {
      while (this.lastPub <= this.variables[i].cost && this.variableAvailability[i]()) {
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
      if (this.lastPub < 500) this.updateMilestones();
      this.buyVariables();
      this.ticks++;
    }
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    return this.createResult();
  }

  tick() {
    // System update
    const Q = 20; // max heat duty in W
    const h = 5; // thermal passive convection coefficient for Al (W/m^2 k)
    const Cp = 0.89; // heat capacity for Al (J/g/k)
    const area = 0.024; // area of element (m^2)
    const mass = 10; // grams
    const Tc = 30;
    if (this.milestones[1] >= 1)
        this.ki = 0;
    if (this.milestones[2] >= 3)
        this.kd = 0;
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
    let output = Math.round(Math.max(0, Math.min(this.kp * this.error[0] + this.ki * this.integral + this.kd * derivative, 512))) / 512; // range 0-512

    // Heating simulation
    const dT = Math.abs(1 / mass / Cp * (Q * output - (this.T - Tc) * h * area));
    const exponentialTerm = (Q * output - h * area * (this.T - Tc)) * Math.pow(Math.E, -1 * this.systemDt / mass / Cp);
    this.T = Tc + (Q * output - exponentialTerm) / (h * area);

    // Variable calculation
    const c1exp = this.variables[7].value;
    const r1exp = this.variables[8].value;
    const r2exp = this.variables[9].value;;
    const dr =
      this.variables[1].value * r1exp +
      this.variables[2].value * r2exp -
      l10(1 + l10(1 + Math.abs(this.error[0])));

    if (this.achievementMulti == 30) {
      let dP = 
        this.variables[5].value + 
        this.variables[6].value + 
        Math.E * (-0.01 * Math.pow(0.8, this.milestones[4]) * Math.abs(this.T - 100));
      this.P = add(this.P, dP + l10(this.dt));
    }

    this.r = add(this.r, dr + l10(this.dt));
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
  onVariablePurchased(id: number): void {
    if (id == 10) this.recomputeC1Base();
  }
}
