import { global } from "../../Sim/main";
import theoryClass from "../theory";
import Variable from "../../Utils/variable";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost';
import { add, l10, getR9multiplier, toCallables, getLastLevel, getBestResult } from "../../Utils/helpers";

export default async function t8(data: theoryData): Promise<simResult> {
  let res;
  if(!data.strat.includes("Coast")) {
    const sim = new t8Sim(data);
    res = await sim.simulate();
  }
  else {
    let data2: theoryData = JSON.parse(JSON.stringify(data));
    data2.strat = data2.strat.replace("Coast", "");
    const sim1 = new t8Sim(data2);
    const res1 = await sim1.simulate();
    const lastC1 = getLastLevel("c1", res1.boughtVars);
    const lastC3 = getLastLevel("c3", res1.boughtVars);
    const lastC5 = getLastLevel("c5", res1.boughtVars);
    const sim2 = new t8Sim(data);
    sim2.variables[0].setOriginalCap(lastC1)
    sim2.variables[0].configureCap(13);
    sim2.variables[2].setOriginalCap(lastC3)
    sim2.variables[2].configureCap(4);
    sim2.variables[4].setOriginalCap(lastC5)
    sim2.variables[4].configureCap(1);
    res = await sim2.simulate();
  }
  return res;
}

type theory = "T8";

class t8Sim extends theoryClass<theory> {
  bounds: number[][][];
  defaultStates: number[][];
  dts: number[];
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  msTimer: number;

  getBuyingConditions(): conditionFunction[] {
    const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
      T8: [true, true, true, true, true],
      T8noC3: [true, true, false, true, true],
      T8noC5: [true, true, true, true, false],
      T8noC35: [true, true, false, true, false],
      T8Snax: [() => this.curMult < 1.6, true, () => this.curMult < 2.3, true, () => this.curMult < 2.3],
      T8Coast: [
        () => this.variables[0].shouldBuy,
        true,
        () => this.variables[2].shouldBuy,
        true,
        () => this.variables[4].shouldBuy,
      ],
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
      T8PlayCoast: [
        () => this.variables[0].shouldBuy && (this.variables[0].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost)),
        true,
        () => this.variables[2].shouldBuy && (this.variables[2].cost + l10(2.5) < Math.min(this.variables[1].cost, this.variables[3].cost)),
        true,
        () => this.variables[4].shouldBuy && (this.variables[4].cost + l10(2.5) < Math.min(this.variables[1].cost, this.variables[3].cost)),
      ],
      T8PlaySolarswap: [
        () => this.variables[0].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost),
        true,
        () => this.variables[2].cost + l10(2.5) < Math.min(this.variables[1].cost, this.variables[3].cost),
        true,
        () => this.variables[4].cost + l10(2.5) < Math.min(this.variables[1].cost, this.variables[3].cost),
      ],
      T8PlaySolarswapCoast: [
        () => this.variables[0].shouldBuy && (this.variables[0].cost + l10(8) < Math.min(this.variables[1].cost, this.variables[3].cost)),
        true,
        () => this.variables[2].shouldBuy && (this.variables[2].cost + l10(2.5) < Math.min(this.variables[1].cost, this.variables[3].cost)),
        true,
        () => this.variables[4].shouldBuy && (this.variables[4].cost + l10(2.5) < Math.min(this.variables[1].cost, this.variables[3].cost)),
      ]
    };
    return toCallables(conditions[this.strat]);
  }
  getVariableAvailability(): conditionFunction[] {
    const conditions: conditionFunction[] = [() => true, () => true, () => true, () => true, () => true];
    return conditions;
  }
  getMilestonePriority(): number[] {
    const milestoneCount = Math.min(11, Math.floor(Math.max(this.lastPub, this.maxRho) / 20));
    switch (this.strat) {
      case "T8noC3": return [0, 2, 3];
      case "T8noC3d": return [0, 2, 3];
      case "T8noC5": return [0, 2, 1];
      case "T8noC5d": return [0, 2, 1];
      case "T8noC35": return [0, 2];
      case "T8noC35d": return [0, 2];
    }
    if (milestoneCount < 3) return [0];
    else if (milestoneCount == 3) return [3];
    else return [2, 0, 3, 1];
  }
  updateMilestones(): void {
    const prevAttractor = this.milestones[0];
    super.updateMilestones();
    if (this.milestones[0] != prevAttractor) {
      this.x = this.defaultStates[this.milestones[0]][0];
      this.y = this.defaultStates[this.milestones[0]][1];
      this.z = this.defaultStates[this.milestones[0]][2];
    }
  }
  getTotMult(val: number): number {
    return Math.max(0, val * 0.15) + getR9multiplier(this.sigma);
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
    this.x = this.defaultStates[0][0];
    this.y = this.defaultStates[0][1];
    this.z = this.defaultStates[0][2];
    this.dx = 0;
    this.dy = 0;
    this.dz = 0;
    this.pubUnlock = 8;
    this.milestoneUnlockSteps = 20;
    this.milestonesMax = [2, 3, 3, 3];
    //initialize variables
    this.variables = [
      new Variable({ name: "c1", cost: new FirstFreeCost(new ExponentialCost(10, 1.5172)), valueScaling: new StepwisePowerSumValue() }),
      new Variable({ name: "c2", cost: new ExponentialCost(20, 64), valueScaling: new ExponentialValue(2) }),
      new Variable({ name: "c3", cost: new ExponentialCost(1e2, 1.15 * Math.log2(3), true), valueScaling: new ExponentialValue(3) }),
      new Variable({ name: "c4", cost: new ExponentialCost(1e2, 1.15 * Math.log2(5), true), valueScaling: new ExponentialValue(5) }),
      new Variable({ name: "c5", cost: new ExponentialCost(1e2, 1.15 * Math.log2(7), true), valueScaling: new ExponentialValue(7) }),
    ];
    this.msTimer = 0;
    this.updateMilestones();
  }
  async simulate(): Promise<simResult> {
    while (!this.endSimulation()) {
      if (!global.simulating) break;
      this.tick();
      this.updateSimStatus();
      if (this.lastPub < 220) this.updateMilestones();
      this.buyVariables();
      if(this.variables[0].shouldFork) await this.doForkVariable(0)
      if(this.variables[2].shouldFork) await this.doForkVariable(2)
      if(this.variables[4].shouldFork) await this.doForkVariable(4)
    }
    let stratExtra = "";
    if(this.strat.includes("Coast")) {
      stratExtra += this.variables[0].prepareExtraForCap(getLastLevel("c1", this.boughtVars)) +
          this.variables[2].prepareExtraForCap(getLastLevel("c3", this.boughtVars)) +
          this.variables[4].prepareExtraForCap(getLastLevel("c5", this.boughtVars))
    }
    this.trimBoughtVars();
    return getBestResult(this.createResult(stratExtra), this.bestForkRes);
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
    if (this.msTimer === 335 && this.strat.includes("Solarswap")) {
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

    const rhodot = l10(this.dt) + this.totMult + this.variables[0].value + this.variables[1].value + add(dx2Term, dy2Term, dz2Term) / 2 - 2;
    this.rho.add(rhodot);
  }
  copyFrom(other: this) {
    super.copyFrom(other);
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    this.dx = other.dx;
    this.dy = other.dy;
    this.dz = other.dz;
    this.msTimer = other.msTimer;
  }
  copy() {
    let copySim = new t8Sim(this.getDataForCopy());
    copySim.copyFrom(this);
    return copySim;
  }
  onVariablePurchased(id: number) {
    if(
        [0, 2, 4].includes(id) &&
        this.strat.includes("Coast") &&
        this.variables[id].shouldBuy &&
        this.variables[id].coastingCapReached()
    ) {
      if(this.variables[id].level == this.variables[id].originalCap) {
        //Specific condition for t8 solarswap coast, strat goes crazy w/o this.
        this.variables[id].stopBuying();
      }
      else {
        this.variables[id].shouldFork = true;
      }
    }
  }
}
