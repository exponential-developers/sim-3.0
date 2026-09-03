import Variable from "../Utils/variable";
import {
  defaultResult,
  getBestResult
} from "../Utils/helpers";

/** Base class for a theory */
export default abstract class 
  theoryClass<theory extends theoryType, strat extends stratType[theory] = stratType[theory]> 
  {
  /** Theory */
  readonly theory: theory;
  /** Current strategy */
  readonly strat: strat;
  /** Sim settings used in the simulation */
  readonly settings: Settings;
  /** Specific inputs */
  readonly specificInputs: SpecificInputRecord<theory>;
  /** Strat specific inputs */
  readonly stratSpecificInputs: StratSpecificInputRecord<theory, strat>;

  // Theory
  /** cap at which simulation will stop */
  cap: ProgressValue;
  /** Value of the last publication */
  lastPub: ProgressValue;
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
  /** previous milestone count */
  prevMilestoneCount: number;

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
   * Best result (tracked for sims that fork)
   */
  bestForkRes: simResult;

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
   * Returns the total multiplier
   */
  abstract getTotMult(val: ProgressValue): number

  constructor(readonly data: theoryData<theory>, readonly converter: ProgressValueConverter) {
    this.bestForkRes = defaultResult();
    this.theory = data.theory;
    this.strat = data.strat as strat;
    this.settings = data.settings;
    this.specificInputs = data.specificInputs;
    this.stratSpecificInputs = data.stratSpecificInputs;
    this.prevMilestoneCount = -1;

    //theory
    this.cap = data.cap ?? { valueType: "tau", value: Infinity };
    this.lastPub = data.input;
    this.sigma = data.sigma;
    this.totMult = this.getTotMult(data.input);
    this.curMult = 0;
    this.dt = this.settings.dt;
    this.ddt = this.settings.ddt;
    this.t = 0;
    this.ticks = 0;

    //initialize variables
    this.variables = [];
    this.boughtVars = [];

    //pub values
    this.tauH = 0;
    this.maxTauH = 0;
    this.pubT = 0;

    // pub conditions
    this.forcedPubConditions = [];
    this.pubConditions = [];
    this.simEndConditions = [() => this.t > this.pubT * 2];
    this.doSimEndConditions = () => true;

    this.milestones = [];
    this.milestonesMax = [];

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

    this.variables = other.variables.map((v, i) => v.copy(this.variables[i].currency));
    this.boughtVars = [...other.boughtVars];

    this.tauH = other.tauH;
    this.maxTauH = other.maxTauH;
    this.pubT = other.pubT;
    this.bestForkRes = other.bestForkRes;
  }

  /** Returns the theoryData needed to create a copy */
  getDataForCopy(): theoryData<theory, strat> {
    return {
      theory: this.theory,
      specificInputs: this.specificInputs,
      stratSpecificInputs: this.stratSpecificInputs,
      sigma: this.sigma,
      input: this.lastPub,
      strat: this.strat,
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
  abstract getMilestonePriority(): number[]; // dunno if we'll keep this here

  /**
   * Updates milestones
   */
  abstract updateMilestones(): void; // dunno if we'll keep this here

  /**
   * Update milestones, no MS
   */
  abstract updateMilestonesNoMS(): boolean; // dunno if we'll keep this here

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

  abstract recordPurchase(variable: Variable): void;

  /**
   * Buys variables.
   *
   * Variables are bought from the end of the variable list.
   * */
  buyVariables() {
    let bought = false;
    for (let i = this.variables.length - 1; i >= 0; i--) {
      let currency = this.variables[i].currency;
      while (true) {
        if (currency.value > this.variables[i].cost && this.buyingConditions[i]() && this.variableAvailability[i]() && this.extraBuyingCondition(i)) {
          this.recordPurchase(this.variables[i]);
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
    if (!this.getVariableWeights) throw "Cannot use buyVariablesWeight if getVariableWeights is undefined";
    let bought = false;
    while (true) {
      const rawCost = this.variables.map((item) => item.cost);
      const weights = this.getVariableWeights();
      let minCost = [Number.MAX_VALUE, -1];
      for (let i = this.variables.length - 1; i >= 0; i--)
        if (rawCost[i] + weights[i] < minCost[0] && this.variableAvailability[i]()) {
          minCost = [rawCost[i] + weights[i], i];
        }
      if (minCost[1] !== -1 && rawCost[minCost[1]] < this.variables[minCost[1]].currency.value) {
        this.variables[minCost[1]].currency.subtract(this.variables[minCost[1]].cost);
        this.recordPurchase(this.variables[minCost[1]]);
        this.variables[minCost[1]].buy();
        bought = true;
        this.onVariablePurchased(minCost[1]);
      } else break;
    }
    if(bought) this.onAnyVariablePurchased();
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
      const currency = this.variables[i].currency;
      while (true) {
        if (currency.value > this.variables[i].cost && this.buyingConditions[i]() && this.variableAvailability[i]() && this.extraBuyingCondition(i)) {
          let confirmPurchase = await this.confirmPurchase(i);
          if (!confirmPurchase) break;
          this.recordPurchase(this.variables[i]);
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
   * Removes the variable purchases that occurred after the publication point
   */
  trimBoughtVars() {
    while (this.boughtVars.length && this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
  }

  /**
   * Creates a sim result from the sim class
   * @param stratExtra Extra string to append to the "strat" column
   */
  abstract createResult(stratExtra: string): simResult<theory>;

  copy(): any {
    throw new Error("Please implement `copy` method");
  }

  async doForkVariable(id: number) {
    this.variables[id].shouldFork = false;
    const fork = this.copy();
    fork.variables[id].stopBuying();
    const res = await fork.simulate();
    this.bestForkRes = getBestResult(res, this.bestForkRes);
  }
}
