import Variable from "../Utils/variable";
import { global } from "../Sim/main.js";
import jsonData from "../Data/data.json";
import Currency from "../Utils/currency";

/** Base class for a theory */
export default abstract class theoryClass<theory extends theoryType, milestoneType = Array<number>> {
  buyingConditions: conditionFunction[];
  variableAvailability: conditionFunction[];
  milestoneTree: Array<milestoneType>;
  strat: stratType[theory];
  theory: theoryType;
  tauFactor: number;
  //theory
  pubUnlock: number;
  cap: number;
  recovery: { value: number; time: number; recoveryTime: boolean };
  lastPub: number;
  sigma: number;
  totMult: number;
  curMult: number;
  dt: number;
  ddt: number;
  t: number;
  ticks: number;
  //currencies
  rho: Currency;
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
  //pub conditions
  forcedPubConditions: Array<conditionFunction>;
  pubConditions: Array<conditionFunction>;
  simEndConditions: Array<conditionFunction>;
  doSimEndConditions: conditionFunction;
  //milestones  [terms, c1exp, multQdot]
  milestones: milestoneType;
  pubMulti: number;

  abstract getBuyingConditions(): conditionFunction[];
  abstract getVariableAvailability(): conditionFunction[];
  abstract getTotMult(val: number): number;

  constructor(data: theoryData) {
    this.strat = data.strat as stratType[theory];
    this.theory = data.theory;
    this.tauFactor = jsonData.theories[data.theory].tauFactor;

    //theory
    this.pubUnlock = 1;
    this.cap = typeof data.cap === "number" && data.cap > 0 ? data.cap : Infinity;
    this.recovery = data.recovery ?? { value: 0, time: 0, recoveryTime: false };
    this.lastPub = data.rho;
    this.sigma = data.sigma;
    this.totMult = this.getTotMult(data.rho);
    this.curMult = 0;
    this.dt = global.dt;
    this.ddt = global.ddt;
    this.t = 0;
    this.ticks = 0;

    //currencies
    this.rho = new Currency;
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

    // pub conditions
    this.forcedPubConditions = [() => this.pubRho >= this.pubUnlock];
    this.pubConditions = [() => this.maxRho >= this.cap];
    this.simEndConditions = [() => this.t > this.pubT * 2];
    this.doSimEndConditions = () => true;

    this.milestones = [] as unknown as milestoneType;
    this.pubMulti = 0;
    this.buyingConditions = [];
    this.variableAvailability = [];
    this.milestoneTree = [] as unknown as Array<milestoneType>;
  }

  copyFrom(other: this): void {
    this.cap = other.cap;
    this.totMult = other.totMult;
    this.dt = other.dt;
    this.ddt = other.ddt;
    this.t = other.t;
    this.ticks = other.ticks;

    this.rho = other.rho.copy();
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
      cap: this.cap,
      recursionValue: null,
    };
  }

  evaluateForcedPubConditions(): boolean {
    return this.forcedPubConditions.every((cond) => cond())
  }

  evaluatePubConditions(): boolean {
    return this.pubConditions.some((cond) => cond())
  }

  evaluateSimEndConditions(): boolean {
    return this.simEndConditions.some((cond) => cond())
  }

  endSimulation(): boolean {
    return this.evaluateForcedPubConditions() && (this.evaluatePubConditions() || (this.doSimEndConditions() && this.evaluateSimEndConditions()));
  }

  updateT() {
    this.t += this.dt / 1.5;
    this.dt *= this.ddt;
  }

  updateSimStatus() {
    if (this.rho.value > this.maxRho) this.maxRho = this.rho.value;
    this.updateT();
    if (this.maxRho < this.recovery.value) this.recovery.time = this.t;

    this.tauH = this.tauFactor * (this.maxRho - this.lastPub) / (this.t / 3600);
    if (this.maxTauH < this.tauH || !this.evaluateForcedPubConditions() || this.evaluatePubConditions()) {
      this.maxTauH = this.tauH;
      this.pubT = this.t;
      this.pubRho = this.maxRho;
    }
    
    this.curMult = 10 ** (this.getTotMult(this.maxRho) - this.totMult);
  }

  onVariablePurchased(id: number) {}

  onAnyVariablePurchased() {}

  buyVariables() {
    let bought = false;
    for (let i = this.variables.length - 1; i >= 0; i--) {
      let currency = this.variables[i].currency ?? this.rho;
      while (true) {
        if (currency.value > this.variables[i].cost && this.buyingConditions[i]() && this.variableAvailability[i]()) {
          if (this.maxRho + 5 > this.lastPub) {
            this.boughtVars.push({ 
              variable: this.varNames[i], 
              level: this.variables[i].level + 1, 
              cost: this.variables[i].cost, 
              timeStamp: this.t,
              symbol: currency.symb
            });
          }
          currency.subtract(this.variables[i].cost);
          this.variables[i].buy();
          bought = true;
          this.onVariablePurchased(i);
        } else break;
      }
    }
    if (bought) this.onAnyVariablePurchased();
  }
}
