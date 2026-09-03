import Currency from "../Utils/currency";
import { BasePubTableCollector, collectorCache } from "../Utils/pubTableCollector";
import Variable from "../Utils/variable";
import {
  binaryInsertionSearch,
  getBestResult,
  getR9multiplier,
  isMainTheory
} from "../Utils/helpers";
import theoryClass from "./theory";

/** Base class for a theory */
export default abstract class 
  traditionalTheoryClass<theory extends theoryType, strat extends stratType[theory] = stratType[theory]> 
  extends theoryClass<theory, strat> {
  // Theory
  /** rho cap */
  rhoCap: number;
  /** rho at which publications are unlocked */
  pubUnlockRho: number;
  /** Rho of the last publication */
  lastPubRho: number;

  // Currencies
  /** Main currency of the theory */
  rho: Currency;
  /** max value of rho for this publication */
  maxRho: number;

  // Publication values
  /** final rho of the publication */
  pubRho: number;
  /** pub table collector, will be overridden in relevant methods */
  pubTableCollector: BasePubTableCollector;

  // Milestones
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
   * Returns the total multiplier for a given rho
   */
  getTotMultFromRho(rho: number): number {
    return rho < this.pubUnlockRho
    ? (isMainTheory(this.theory) ? getR9multiplier(this.sigma) : 0)
    : this.converter.convertTo({valueType: "rho", value: rho}, "multiplier", this.sigma);
  }

  /**
   * Returns the total multiplier for a given value
   */
  getTotMult(val: ProgressValue): number {
    return this.getTotMultFromRho(this.converter.convertTo(val, "rho", this.sigma));
  };

  constructor(readonly data: theoryData<theory>, readonly converter: ProgressValueConverterRho) {
    super(data, converter);
    this.pubTableCollector = collectorCache.currentCollector;

    //theory
    this.rhoCap = this.converter.convertTo(this.cap, "rho", this.sigma);
    this.lastPubRho = this.converter.convertTo(this.lastPub, "rho", this.sigma);
    this.pubUnlockRho = 1;
    this.totMult = this.getTotMult(data.input);

    //currencies
    this.rho = new Currency;
    this.maxRho = 0;

    //pub values
    this.pubRho = 0;

    // pub conditions
    this.forcedPubConditions = [() => this.pubRho >= this.pubUnlockRho];
    this.pubConditions = [() => this.maxRho >= this.rhoCap];
    this.simEndConditions = [() => this.t > this.pubT * 2];
    this.doSimEndConditions = () => true;

    this.milestoneUnlocks = [];
    this.milestoneUnlockSteps = -1;

    this.buyingConditions = this.getBuyingConditions();
    this.variableAvailability = this.getVariableAvailability();
  }

  /**
   * Copies the base attributes from `other`
   */
  copyFrom(other: this): void {
    super.copyFrom(other);

    this.pubTableCollector = other.pubTableCollector;
    this.rhoCap = other.rhoCap;
    this.lastPubRho = other.lastPubRho;

    this.rho.value = other.rho.value;
    this.maxRho = other.maxRho;

    this.pubRho = other.pubRho;
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
    const rho = Math.max(this.maxRho, this.lastPubRho);
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

  /**
   * Update milestones, no MS
   */
  updateMilestonesNoMS(): boolean {
    const rho = Math.max(this.maxRho, this.lastPubRho);
    let milestoneCount = this.milestoneUnlockSteps > 0
        ? Math.floor(rho / this.milestoneUnlockSteps)
        : binaryInsertionSearch(this.milestoneUnlocks, rho);
    if(milestoneCount != this.prevMilestoneCount) {
      this.prevMilestoneCount = milestoneCount;
      const priority = this.getMilestonePriority();
      this.milestones = new Array(this.milestonesMax.length).fill(0);
      for (let i = 0; i < priority.length; i++) {
        while (this.milestones[priority[i]] < this.milestonesMax[priority[i]] && milestoneCount > 0) {
          this.milestones[priority[i]]++;
          milestoneCount--;
        }
      }
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * Updates several sim status parameters
   */
  updateSimStatus() {
    if (this.rho.value > this.maxRho) this.maxRho = this.rho.value;
    this.updateT();

    this.tauH = (
      this.converter.convertTo({ valueType: "rho", value: this.maxRho }, "tau") 
      - this.converter.convertTo(this.lastPub, "tau", this.sigma) 
    ) / (this.t / 3600);
    if (this.maxTauH < this.tauH || !this.evaluateForcedPubConditions() || this.evaluatePubConditions()) {
      this.maxTauH = this.tauH;
      this.pubT = this.t;
      this.pubRho = this.maxRho;
    }

    this.curMult = 10 ** (this.getTotMultFromRho(this.maxRho) - this.totMult);
    this.ticks++;
  }

  recordPurchase(variable: Variable) {
    if (this.maxRho + this.settings.boughtVarsDelta > this.lastPubRho) {
      this.boughtVars.push({
        variable: variable.name,
        level: variable.level + 1,
        cost: variable.cost,
        timeStamp: this.t,
        symbol: (variable.currency ?? this.rho).symbol
      });
    }
  }

  /**
   * Creates a sim result from the sim class
   * @param stratExtra Extra string to append to the "strat" column
   */
  createResult(stratExtra: string = ""): simResultRho<theory> {
    const startTau = this.converter.convertTo(
      this.lastPub,
      "tau",
      this.sigma
    );
    const startRho = this.lastPubRho;
    const pubTau = this.converter.convertTo({
      valueType: "rho",
      value: this.pubRho
    }, "tau");
    const pubRho = this.pubRho;
    return {
      theory: this.theory,
      sigma: this.sigma,
      lastPubTau: startTau,
      lastPubRho: startRho,
      pubPointTau: pubTau,
      pubPointRho: pubRho,
      deltaTau: pubTau - startTau,
      pubMulti: 10 ** (this.getTotMultFromRho(pubRho) - this.totMult),
      strat: this.strat as String + stratExtra,
      tauH: this.maxTauH,
      time: this.pubT,
      boughtVars: this.boughtVars
    }
  }

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
