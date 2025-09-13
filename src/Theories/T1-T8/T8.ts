import { global } from "../../Sim/main.js";
import { add, createResult, l10, getR9multiplier } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import theoryClass from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';

export default async function t8(data: theoryData): Promise<simResult> {
  const sim = new t8Sim(data);
  const res = await sim.simulate();
  return res;
}

type theory = "T8";

class t8Sim extends theoryClass<theory> {
  bounds: Array<Array<Array<number>>>;
  defaultStates: Array<Array<number>>;
  dts: Array<number>;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  msTimer: number;

  getBuyingConditions() {
    const conditions: { [key in stratType[theory]]: Array<boolean | conditionFunction> } = {
      T8: [true, true, true, true, true],
      T8noC3: [true, true, false, true, true],
      T8noC5: [true, true, true, true, false],
      T8noC35: [true, true, false, true, false],
      T8Snax: [() => this.curMult < 1.6, true, () => this.curMult < 2.3, true, () => this.curMult < 2.3],
      T8noC3d: [() => this.variables[0].cost + 1 < Math.min(this.variables[1].cost, this.variables[3].cost), true, false, true, true],
      T8noC5d: [() => this.variables[0].cost + 1 < Math.min(this.variables[1].cost, this.variables[3].cost), true, true, true, false],
      T8noC35d: [() => this.variables[0].cost + 1 < Math.min(this.variables[1].cost, this.variables[3].cost), true, false, true, false],
      T8d: [() => this.variables[0].cost + 1 < Math.min(this.variables[1].cost, this.variables[3].cost), true, true, true, true],
      T8Play: [
        () => this.variables[0].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost),
        true,
        () => this.variables[2].cost + l10(2.5) < Math.min(this.variables[1].cost, this.variables[3].cost),
        true,
        () => this.variables[4].cost + l10(4) < Math.min(this.variables[1].cost, this.variables[3].cost),
      ],
      T8PlaySolarswap: [
        () => this.variables[0].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost),
        true,
        () => this.variables[2].cost + l10(2.5) < Math.min(this.variables[1].cost, this.variables[3].cost),
        true,
        () => this.variables[4].cost + l10(2.5) < Math.min(this.variables[1].cost, this.variables[3].cost),
      ],
    };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getVariableAvailability() {
    const conditions: Array<conditionFunction> = [() => true, () => true, () => true, () => true, () => true];
    return conditions;
  }
  getMilestoneTree() {
    const pActiveRoute = [
      [0, 0, 0, 0],
      [1, 0, 0, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 3],
      [1, 0, 3, 0],
      [2, 0, 3, 0],
      [2, 0, 3, 1],
      [2, 0, 3, 2],
      [2, 0, 3, 3],
      [2, 1, 3, 3],
      [2, 2, 3, 3],
      [2, 3, 3, 3],
    ];
    const tree: { [key in stratType[theory]]: Array<Array<number>> } = {
      T8: [
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [2, 0, 0, 0],
        [0, 0, 0, 3],
        [1, 0, 3, 0],
        [2, 0, 3, 0],
        [2, 0, 3, 1],
        [2, 0, 3, 2],
        [2, 0, 3, 3],
        [2, 1, 3, 3],
        [2, 2, 3, 3],
        [2, 3, 3, 3],
      ],
      T8noC3: [
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [2, 0, 0, 0],
        [2, 0, 1, 0],
        [2, 0, 2, 0],
        [2, 0, 3, 0],
        [2, 0, 3, 1],
        [2, 0, 3, 2],
        [2, 0, 3, 3],
      ],
      T8noC5: [
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [2, 0, 0, 0],
        [2, 0, 1, 0],
        [2, 0, 2, 0],
        [2, 0, 3, 0],
        [2, 1, 3, 0],
        [2, 2, 3, 0],
        [2, 3, 3, 0],
      ],
      T8noC35: [
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [2, 0, 0, 0],
        [2, 0, 1, 0],
        [2, 0, 2, 0],
        [2, 0, 3, 0],
      ],
      T8Snax: [
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [2, 0, 0, 0],
        [0, 0, 0, 3],
        [1, 0, 3, 0],
        [2, 0, 3, 0],
        [2, 0, 3, 1],
        [2, 0, 3, 2],
        [2, 0, 3, 3],
        [2, 1, 3, 3],
        [2, 2, 3, 3],
        [2, 3, 3, 3],
      ],
      T8noC3d: [
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [2, 0, 0, 0],
        [2, 0, 1, 0],
        [2, 0, 2, 0],
        [2, 0, 3, 0],
        [2, 0, 3, 1],
        [2, 0, 3, 2],
        [2, 0, 3, 3],
      ],
      T8noC5d: [
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [2, 0, 0, 0],
        [2, 0, 1, 0],
        [2, 0, 2, 0],
        [2, 0, 3, 0],
        [2, 1, 3, 0],
        [2, 2, 3, 0],
        [2, 3, 3, 0],
      ],
      T8noC35d: [
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [2, 0, 0, 0],
        [2, 0, 1, 0],
        [2, 0, 2, 0],
        [2, 0, 3, 0],
      ],
      T8d: pActiveRoute,
      T8Play: pActiveRoute,
      T8PlaySolarswap: pActiveRoute,
    };
    return tree[this.strat];
  }

  getTotMult(val: number) {
    return Math.max(0, val * 0.15) + getR9multiplier(this.sigma);
  }
  updateMilestones(): void {
    const stage = Math.min(11, Math.floor(Math.max(this.lastPub, this.maxRho) / 20));
    this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
  }
  dn(ix = this.x, iy = this.y, iz = this.z) {
    if (this.milestones[0] === 0) {
      this.dx = 10 * (iy - ix);
      this.dy = ix * (28 - iz) - iy;
      this.dz = ix * iy - (8 * iz) / 3;
    }
    if (this.milestones[0] === 1) {
      this.dx = 10 * (40 * (iy - ix));
      this.dy = 10 * (-12 * ix - ix * iz + 28 * iy);
      this.dz = 10 * (ix * iy - 3 * iz);
    }
    if (this.milestones[0] === 2) {
      this.dx = 500 * (-iy - iz);
      this.dy = 500 * (ix + 0.1 * iy);
      this.dz = 500 * (0.1 + iz * (ix - 14));
    }
  }
  constructor(data: theoryData) {
    super(data);
    this.pubUnlock = 8;
    //initialize variables
    this.variables = [
      new Variable({ name: "c1", cost: new FirstFreeCost(new ExponentialCost(10, 1.5172)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "c2", cost: new ExponentialCost(20, 64), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c3", cost: new ExponentialCost(1e2, 1.15 * Math.log2(3), true), valueScaling: new ExponentialValue(3) }),
      new Variable({ name: "c4", cost: new ExponentialCost(1e2, 1.15 * Math.log2(5), true), valueScaling: new ExponentialValue(5) }),
      new Variable({ name: "c5", cost: new ExponentialCost(1e2, 1.15 * Math.log2(7), true), valueScaling: new ExponentialValue(7) }),
    ];
    //attractor stuff
    this.bounds = [
      [
        [0, -20, 20],
        [0, -27, 27],
        [24.5, 1, 48],
      ],
      [
        [0.5, -23, 24],
        [1, -25, 27],
        [20.5, 1, 40],
      ],
      [
        [1, -20, 22],
        [-1.5, -21, 18],
        [8, 0, 37],
      ],
    ];
    this.defaultStates = [
      [-6, -8, 26],
      [-10.6, -4.4, 28.6],
      [-6, 15, 0],
    ];
    this.dts = [0.02, 0.002, 0.00014];
    this.milestones = [0, 0, 0, 0];
    this.x = this.defaultStates[this.milestones[0]][0];
    this.y = this.defaultStates[this.milestones[0]][1];
    this.z = this.defaultStates[this.milestones[0]][2];
    this.dx = 0;
    this.dy = 0;
    this.dz = 0;
    this.msTimer = 0;
    this.milestoneTree = this.getMilestoneTree();
    this.updateMilestones();
  }
  async simulate() {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 220) this.updateMilestones();
      this.buyVariables();
      this.ticks++;
    }
    this.pubMulti = 10 ** (this.getTotMult(this.pubRho) - this.totMult);
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    const result = createResult(this, "");

    return result;
  }
  tick() {
    this.dn();

    const midpointx = this.x + this.dx * 0.5 * this.dts[this.milestones[0]];
    const midpointy = this.y + this.dy * 0.5 * this.dts[this.milestones[0]];
    const midpointz = this.z + this.dz * 0.5 * this.dts[this.milestones[0]];

    this.dn(midpointx, midpointy, midpointz);

    this.x += this.dx * this.dts[this.milestones[0]];
    this.y += this.dy * this.dts[this.milestones[0]];
    this.z += this.dz * this.dts[this.milestones[0]];

    this.dn();

    const xlowerBound = (this.bounds[this.milestones[0]][0][1] - this.bounds[this.milestones[0]][0][0]) * 5 + this.bounds[this.milestones[0]][0][0];
    const xupperBound = (this.bounds[this.milestones[0]][0][2] - this.bounds[this.milestones[0]][0][0]) * 5 + this.bounds[this.milestones[0]][0][0];
    const ylowerBound = (this.bounds[this.milestones[0]][1][1] - this.bounds[this.milestones[0]][1][0]) * 5 + this.bounds[this.milestones[0]][1][0];
    const yupperBound = (this.bounds[this.milestones[0]][1][2] - this.bounds[this.milestones[0]][1][0]) * 5 + this.bounds[this.milestones[0]][1][0];
    const zlowerBound = (this.bounds[this.milestones[0]][2][1] - this.bounds[this.milestones[0]][2][0]) * 5 + this.bounds[this.milestones[0]][2][0];
    const zupperBound = (this.bounds[this.milestones[0]][2][2] - this.bounds[this.milestones[0]][2][0]) * 5 + this.bounds[this.milestones[0]][2][0];

    if (this.x < xlowerBound || this.x > xupperBound || this.y < ylowerBound || this.y > yupperBound || this.z < zlowerBound || this.z > zupperBound) {
      this.x = this.defaultStates[this.milestones[0]][0];
      this.y = this.defaultStates[this.milestones[0]][1];
      this.z = this.defaultStates[this.milestones[0]][2];
    }

    this.dn();

    this.msTimer++;
    if (this.msTimer === 335 && this.strat === "T8PlaySolarswap") {
      this.x = this.defaultStates[this.milestones[0]][0];
      this.y = this.defaultStates[this.milestones[0]][1];
      this.z = this.defaultStates[this.milestones[0]][2];
      this.msTimer = 0;
    }

    const vc3 = this.variables[2].value * (1 + 0.05 * this.milestones[1]);
    const vc4 = this.variables[3].value * (1 + 0.05 * this.milestones[2]);
    const vc5 = this.variables[4].value * (1 + 0.05 * this.milestones[3]);

    const dx2Term = vc3 + l10(this.dx * this.dx);
    const dy2Term = vc4 + l10(this.dy * this.dy);
    const dz2Term = vc5 + l10(this.dz * this.dz);

    const rhodot = l10(this.dt) + this.totMult + this.variables[0].value + this.variables[1].value + add(add(dx2Term, dy2Term), dz2Term) / 2 - 2;
    this.rho.add(rhodot);
  }
}
