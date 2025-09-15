import { global } from "../Sim/main";
import Currency from "../Utils/currency";
import Variable from "../Utils/variable";
import { binaryInsertionSearch, convertTime, formatNumber, logToExp } from "../Utils/helpers";
import jsonData from "../Data/data.json";

/** Base class for a theory */
export default abstract class theoryClass<theory extends theoryType> {
  buyingConditions: conditionFunction[];
  variableAvailability: conditionFunction[];
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
  variables: Variable[];
  boughtVars: varBuy[];
  //pub values
  tauH: number;
  maxTauH: number;
  pubT: number;
  pubRho: number;
  //pub conditions
  forcedPubConditions: conditionFunction[];
  pubConditions: conditionFunction[];
  simEndConditions: conditionFunction[];
  doSimEndConditions: conditionFunction;
  //milestones
  milestones: number[];
  milestonesMax: number[];
  milestoneUnlocks: number[];
  milestoneUnlockSteps: number;
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

    this.milestones = [];
    this.milestonesMax = [];
    this.milestoneUnlocks = [];
    this.milestoneUnlockSteps = -1;

    this.pubMulti = 0;
    this.buyingConditions = this.getBuyingConditions();
    this.variableAvailability = this.getVariableAvailability();
  }

  abstract getMilestonePriority(): number[];

  updateMilestones(): void {
    const rho = Math.max(this.maxRho, this.lastPub);
    const priority = this.getMilestonePriority();
    let milestoneCount = this.milestoneUnlockSteps > 0 
      ? Math.floor(rho / this.milestoneUnlockSteps)
      : binaryInsertionSearch(this.milestoneUnlocks, rho);
    this.milestones = new Array(this.milestonesMax.length).fill(0);
    for (let i = 0; i < priority.length; i++) {
        while (this.milestones[priority[i]] < this.milestonesMax[priority[i]] && milestoneCount > 0) {
            this.milestones[priority[i]]++;
            milestoneCount--;
        }
    }
  }

  copyFrom(other: this): void {
    this.cap = other.cap;
    this.totMult = other.totMult;
    this.dt = other.dt;
    this.ddt = other.ddt;
    this.t = other.t;
    this.ticks = other.ticks;

    this.rho.value = other.rho.value;
    this.maxRho = other.maxRho;
    this.variables = other.variables.map((v, i) => v.copy(this.variables[i].currency));
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

  extraBuyingCondition(id: number): boolean {return true;};

  buyVariables() {
    let bought = false;
    for (let i = this.variables.length - 1; i >= 0; i--) {
      let currency = this.variables[i].currency ?? this.rho;
      while (true) {
        if (currency.value > this.variables[i].cost && this.buyingConditions[i]() && this.variableAvailability[i]() && this.extraBuyingCondition(i)) {
          if (this.maxRho + 5 > this.lastPub) {
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
          bought = true;
          this.onVariablePurchased(i);
        } else break;
      }
    }
    if (bought) this.onAnyVariablePurchased();
  }

  getVariableWeights?(): number[];

  buyVariablesWeight() {
    if (!this.getVariableWeights) throw "Cannot use buyVariabllesWeight if getVariableWeights is undefined";
    while (true) {
      const rawCost = this.variables.map((item) => item.cost);
      const weights = this.getVariableWeights();
      let minCost = [Number.MAX_VALUE, -1];
      for (let i = this.variables.length - 1; i >= 0; i--)
        if (rawCost[i] + weights[i] < minCost[0] && this.variableAvailability[i]()) {
          minCost = [rawCost[i] + weights[i], i];
        }
      if (minCost[1] !== -1 && rawCost[minCost[1]] < this.rho.value) {
        this.rho.subtract(this.variables[minCost[1]].cost);
        if (this.maxRho + 5 > this.lastPub) {
          this.boughtVars.push({ 
            variable: this.variables[minCost[1]].name, 
            level: this.variables[minCost[1]].level + 1, 
            cost: this.variables[minCost[1]].cost, 
            timeStamp: this.t 
          });
        }
        this.variables[minCost[1]].buy();
      } else break;
    }
  }

  async confirmPurchase?(id: number): Promise<boolean>;

  // Change this at some point (maybe in the Web Workers update)
  async buyVariablesFork() {
    if (!this.confirmPurchase) throw "Cannot use buyVariablesFork if confirmPurchase is undefined";
    let bought = false;
    for (let i = this.variables.length - 1; i >= 0; i--) {
      let currency = this.variables[i].currency ?? this.rho;
      while (true) {
        if (currency.value > this.variables[i].cost && this.buyingConditions[i]() && this.variableAvailability[i]() && this.extraBuyingCondition(i)) {
          let confirmPurchase = await this.confirmPurchase(i);
          if (!confirmPurchase) break;
          if (this.maxRho + 5 > this.lastPub) {
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
          bought = true;
          this.onVariablePurchased(i);
        } else break;
      }
    }
    if (bought) this.onAnyVariablePurchased();
  }

  createResult(stratExtra: string = ""): simResult {
    return {
      theory: this.theory,
      sigma: this.sigma,
      lastPub: logToExp(this.lastPub, 2),
      pubRho: logToExp(this.pubRho, 2),
      deltaTau: logToExp((this.pubRho - this.lastPub) * this.tauFactor, 2),
      pubMulti: formatNumber(10 ** (this.getTotMult(this.pubRho) - this.totMult)),
      strat: this.strat as String + stratExtra,
      tauH: this.maxTauH === 0 ? 0 : Number(formatNumber(this.maxTauH)),
      time: convertTime(Math.max(0, this.pubT - this.recovery.time)),
      rawData: {
        pubRho: this.pubRho,
        time: this.recovery.recoveryTime ? this.recovery.time : Math.max(0, this.pubT - this.recovery.time)
      },
      boughtVars: this.boughtVars
    }
  }
}
