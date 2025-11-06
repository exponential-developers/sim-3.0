import Currency from "../Utils/currency";
import Variable from "../Utils/variable";
import { binaryInsertionSearch, convertTime, formatNumber, logToExp } from "../Utils/helpers";
import jsonData from "../Data/data.json";

/** Base class for a theory */
export default abstract class theoryClass<theory extends theoryType> {
  /** Theory */
  readonly theory: theoryType;
  /** Current strategy */
  readonly strat: stratType[theory];
  /** tau/rho conversion rate */
  readonly tauFactor: number;
  /** Sim settings used in the simulation */
  readonly settings: Settings;

  // Theory
  /** rho at which publications are unlocked */
  pubUnlock: number;
  /** cap at which simulation will stop */
  cap: number;
  /** recovery data */
  recovery: { value: number; time: number; recoveryTime: boolean };
  /** rho of the last publication */
  lastPub: number;
  /** number of students */
  sigma: number;
  /** current total multiplier */
  totMult: number;
  /** current publication multiplier increase for the next pub */
  curMult: number;
  /** tick length */
  dt: number;
  /** tick growth speed */
  ddt: number;
  /** real elapsed time of the publication */
  t: number;
  /** number of elapsed ticks */
  ticks: number;

  // Currencies
  /** Main currency of the theory */
  rho: Currency;
  /** max value of rho for this publication */
  maxRho: number;

  // Variables
  /** List of variables */
  variables: Variable[];
  /** List of recorded variable purchases */
  boughtVars: varBuy[];

  // Buying conditions
  /** Array of buying conditions for each variable */
  buyingConditions: conditionFunction[];
  /** Array of variable availability for each variable */
  variableAvailability: conditionFunction[];

  // Publication values
  /** Average tau/hr gain at this point in the publication (can be negative) */
  tauH: number;
  /** Maximum tau/hr gain in the publication (can be negative) */
  maxTauH: number;
  /** final publication time */
  pubT: number;
  /** final rho of the publication */
  pubRho: number;

  // Publication conditions
  /** 
   * Prevents the sim from publishing if one of these conditions is not satisfied
   */
  forcedPubConditions: conditionFunction[];
  /** 
   * If one of these conditions is reached, the publication ends at that point
   */
  pubConditions: conditionFunction[];
  /**
   * If one of these conditions is reached, the simulation ends
   * and the publication point is set at the last peak of tau/hr
   */
  simEndConditions: conditionFunction[];
  /**
   * Determines if `simEndConditions` are checked
   */
  doSimEndConditions: conditionFunction;

  // Milestones
  /** Level of each milestone */
  milestones: number[];
  /** Maximum level for each milestone */
  milestonesMax: number[];
  /** 
   * Milestone unlock points 
   * 
   * This is overwritten if `milestoneUnlockSteps` is set
   * */
  milestoneUnlocks: number[];
  /** 
   * Steps of rho at which milestones are unlocked
   * 
   * Takes priority over `milestoneUnlocks`
   */
  milestoneUnlockSteps: number;

  /** 
   * Returns the buying conditions for each variable.
   * 
   * This is only called once during the simulation.
   * */
  abstract getBuyingConditions(): conditionFunction[];
  /**
   * Returns the variable availability of each variable.
   * 
   * This is only called once during the simulation.
   */
  abstract getVariableAvailability(): conditionFunction[];
  /**
   * Returns the total multiplier for a given rho value
   */
  abstract getTotMult(val: number): number;

  constructor(readonly data: theoryData) {
    this.theory = data.theory;
    this.strat = data.strat as stratType[theory];
    this.tauFactor = jsonData.theories[data.theory].tauFactor;
    this.settings = data.settings;

    //theory
    this.pubUnlock = 1;
    this.cap = typeof data.cap === "number" && data.cap > 0 ? data.cap : Infinity;
    this.recovery = data.recovery ?? { value: 0, time: 0, recoveryTime: false };
    this.lastPub = data.rho;
    this.sigma = data.sigma;
    this.totMult = this.getTotMult(data.rho);
    this.curMult = 0;
    this.dt = this.settings.dt;
    this.ddt = this.settings.ddt;
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

    this.buyingConditions = this.getBuyingConditions();
    this.variableAvailability = this.getVariableAvailability();
  }

  /**
   * Copies the base attributes from `other`
   */
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
  }

  /** Returns the theoryData needed to create a copy */
  getDataForCopy(): theoryData {
    return {
      theory: this.theory,
      sigma: this.sigma,
      rho: this.lastPub,
      strat: this.strat as string,
      recovery: { ...this.recovery },
      cap: this.cap,
      recursionValue: null,
      settings: this.settings
    };
  }

  /**
   * Returns the order at which milestones must be distributed. Order must be a 0-indexed list.
   * It does not need to feature all milestones.
   * 
   * This is called each time `updateMilestones` is called.
   */
  abstract getMilestonePriority(): number[];

  /**
   * Updates milestones
   */
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

  evaluateForcedPubConditions(): boolean {
    return this.forcedPubConditions.every((cond) => cond())
  }

  evaluatePubConditions(): boolean {
    return this.pubConditions.some((cond) => cond())
  }

  evaluateSimEndConditions(): boolean {
    return this.simEndConditions.some((cond) => cond())
  }

  /**
   * Evaluates the publication/sim end conditions to determine if the simulation loop should end or not
   * @returns true if it will break out of the simulation loop
   */
  endSimulation(): boolean {
    return this.evaluateForcedPubConditions() && (this.evaluatePubConditions() || (this.doSimEndConditions() && this.evaluateSimEndConditions()));
  }

  /**
   * Updates `t` and `dt`
   */
  updateT() {
    this.t += this.dt / 1.5;
    this.dt *= this.ddt;
  }

  /**
   * Updates several sim status parameters
   */
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
    this.ticks++;
  }

  /**
   * Runs each time a variable is purchased
   * @param id id of the purchased variable
   */
  onVariablePurchased(id: number) {}

  /**
   * Runs once per tick if a variable was bought
   */
  onAnyVariablePurchased() {}

  /**
   * Extra buying condition if needed.
   * @param id id of the variable to be purchased
   */
  extraBuyingCondition(id: number): boolean {return true;};

  /** 
   * Buys variables. 
   * 
   * Variables are bought from the end of the variable list.
   * */
  buyVariables() {
    let bought = false;
    for (let i = this.variables.length - 1; i >= 0; i--) {
      let currency = this.variables[i].currency ?? this.rho;
      while (true) {
        if (currency.value > this.variables[i].cost && this.buyingConditions[i]() && this.variableAvailability[i]() && this.extraBuyingCondition(i)) {
          if (this.maxRho + this.settings.boughtVarsDelta > this.lastPub) {
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

  /**
   * Returns the weights for the costs when using `buyVariablesWeight`.
   * 
   * This function is called each time `buyVariablesWeight` is ran.
   */
  getVariableWeights?(): number[];

  /**
   * Buys variables using a weighted cost algorithm.
   * 
   * The weight of the cost of each variable must be defined by `getVariableWeights`.
   */
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
        if (this.maxRho + this.settings.boughtVarsDelta > this.lastPub) {
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

  /**
   * @deprecated This behavior will be changed in a future sim update
   */
  async confirmPurchase?(id: number): Promise<boolean>;

  /**
   * @deprecated This behavior will be changed in a future sim update
   */
  async buyVariablesFork() {
    if (!this.confirmPurchase) throw "Cannot use buyVariablesFork if confirmPurchase is undefined";
    let bought = false;
    for (let i = this.variables.length - 1; i >= 0; i--) {
      let currency = this.variables[i].currency ?? this.rho;
      while (true) {
        if (currency.value > this.variables[i].cost && this.buyingConditions[i]() && this.variableAvailability[i]() && this.extraBuyingCondition(i)) {
          let confirmPurchase = await this.confirmPurchase(i);
          if (!confirmPurchase) break;
          if (this.maxRho + this.settings.boughtVarsDelta > this.lastPub) {
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

  /**
   * Removes the variable purchases that occured after the publication point
   */
  trimBoughtVars() {
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
  }

  /**
   * Creates a sim result from the sim class
   * @param stratExtra Extra string to append to the "strat" column
   */
  createResult(stratExtra: string = ""): simResult {
    return {
      theory: this.theory,
      sigma: this.sigma,
      lastPub: this.lastPub,
      pubRho: this.pubRho,
      deltaTau: (this.pubRho - this.lastPub) * this.tauFactor,
      pubMulti: 10 ** (this.getTotMult(this.pubRho) - this.totMult),
      strat: this.strat as String + stratExtra,
      tauH: this.maxTauH,
      time: Math.max(0, this.pubT - this.recovery.time),
      boughtVars: this.boughtVars
    }
  }
}
