import Variable from "../Utils/variable";
import { global } from "../Sim/main.js";
import jsonData from "../Data/data.json";

interface currencyDefinition {
  rho?: number;
  currencies?: Array<number>;
}

export interface specificTheoryProps extends currencyDefinition {
  theory: theoryType;
}

export type conditionFunction = () => boolean;

export class theoryClass<theory extends theoryType, milestoneType = Array<number>> {
  conditions: Array<conditionFunction>;
  milestoneConditions: Array<conditionFunction>;
  milestoneTree: Array<milestoneType>;
  strat: stratType[theory];
  theory: theoryType;
  tauFactor: number;
  //theory
  cap: Array<number>;
  recovery: { value: number; time: number; recoveryTime: boolean };
  lastPub: number;
  sigma: number;
  totMult: number;
  curMult?: number;
  dt: number;
  ddt: number;
  t: number;
  ticks: number;
  //currencies
  maxRho: number;
  //initialize variables
  varNames: Array<string>;
  variables: Array<Variable>;
  boughtVars: Array<varBuy>;
  //pub values
  tauH: number;
  maxTauH: number;
  pubT: number;
  pubRho: number;
  //milestones  [terms, c1exp, multQdot]
  milestones: milestoneType;
  pubMulti: number;

  constructor(data: theoryData) {
    this.strat = data.strat as stratType[theory];
    this.theory = data.theory;
    this.tauFactor = jsonData.theories[data.theory].tauFactor;
    //theory
    this.cap = typeof data.cap === "number" && data.cap > 0 ? [data.cap, 1] : [Infinity, 0];
    this.recovery = data.recovery ?? { value: 0, time: 0, recoveryTime: false };
    this.lastPub = data.rho;
    this.sigma = data.sigma;
    this.totMult = 0;
    this.dt = global.dt;
    this.ddt = global.ddt;
    this.t = 0;
    this.ticks = 0;
    //currencies
    this.maxRho = 0;
    //initialize variables
    this.varNames = [];
    this.variables = [];
    this.boughtVars = [];
    //pub values
    this.tauH = 0;
    this.maxTauH = 0;
    this.pubT = 0;
    this.pubRho = 0;
    this.milestones = [] as unknown as milestoneType;
    this.pubMulti = 0;
    this.conditions = [];
    this.milestoneConditions = [];
    this.milestoneTree = [] as unknown as Array<milestoneType>;
  }

  copyFrom(other: this): void {
    this.cap = [...other.cap];
    this.totMult = other.totMult;
    this.dt = other.dt;
    this.ddt = other.ddt;
    this.t = other.t;
    this.ticks = other.ticks;

    this.maxRho = other.maxRho;
    this.varNames = other.varNames;
    this.variables = other.variables.map((v) => v.copy());
    this.boughtVars = [...other.boughtVars];

    this.tauH = other.tauH;
    this.maxTauH = other.maxTauH;
    this.pubT = other.pubT;
    this.pubRho = other.pubRho;
    
    this.pubMulti = other.pubMulti;
  }

  getDataForCopy(): theoryData {
    return {
      theory: this.theory,
      sigma: this.sigma,
      rho: this.lastPub,
      strat: this.strat as string,
      recovery: { ...this.recovery },
      cap: this.cap[0],
      recursionValue: null,
    };
  }
}
