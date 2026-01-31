import { add } from "./helpers";
import { BaseCost, FirstFreeCost } from "./cost";
import { BaseValue } from "./value";
import Currency from "./currency";

interface variableData {
  currency?: Currency;
  name: string;
  level?: number;
  cost: BaseCost;
  valueScaling: BaseValue;
}

export default class Variable {
  /** Data used to initialize the variable */
  data: variableData;
  /** Currency used to buy the variable - default rho */
  currency?: Currency;
  /** Variable name */
  name: string;
  /** Variable level */
  level: number;
  /** Current cost of the variable */
  cost: number;
  /** Current value of the variable */
  value: number;
  /**
   * Value used for hotab coasting.
   * 
   * Original Cap is the original max level bought of the variable when the strat was ran without coasting.
   */
  originalCap: number;
  /**
   * Value used for hotab coasting.
   * 
   * This is the level cap of the variable for coasting rules.
   */
  startCapAt: number;
  /**
   * Value used for hotab coasting.
   * 
   * If the variable should be bought according to coasting rules.
   */
  shouldBuy: boolean;
  /**
   * Value used for hotab coasting.
   * 
   * If a fork will be created to see if this variable will be bought, according to coasting rules.
   */
  shouldFork: boolean;
  /** Value model of the variable */
  valueScaling: BaseValue;

  constructor(data: variableData) {
    this.data = data;
    this.currency = data.currency;
    this.name = data.name;
    this.level = 0;
    this.cost = 0;
    this.value = 0;
    this.valueScaling = this.data.valueScaling;
    this.originalCap = Infinity;
    this.startCapAt = Infinity;
    this.shouldBuy = true;
    this.shouldFork = false;
    this.init();
  }
  /**
   * Initializes the variable level, cost and value
   */
  init() {
    this.level = this.data.level ?? 0;
    this.cost = this.data.cost.getCost(this.level);
    this.value = this.valueScaling.recomputeValue(this.level);

    if(this.data.cost instanceof FirstFreeCost && this.level == 0) {
      this.buy();
    }
  }
  /** This group of methods will facilitate hard-stopping a variable during coasting */
  /** 
   * Sets the original cap to the given value.
   * 
   * The original cap is the variable level it has when doing the strat without coasting.
   */
  setOriginalCap(originalCap: number) {
    this.originalCap = originalCap;
  }
  /**
   * Sets the coasting cap of the variable to original cap - capDelta
   * @param capDelta number of levels that the original cap should be reduced by
   */
  configureCap(capDelta: number) {
    let startCapAt = this.originalCap - capDelta;
    if(startCapAt < 1) {
      startCapAt = 1;
    }
    this.startCapAt = startCapAt;
  }
  /**
   * Outputs a string to output the last level of the variable to the user
   * @param lastLevel last level of the variable
   * @returns string to output to the user in the stratExtra output
   */
  prepareExtraForCap(lastLevel: number) {
    let actualLast = lastLevel || this.level;
    return ` ${this.name}: ${actualLast}` // ${this.name}delta: ${this.originalCap - actualLast}`
  }
  /**
   * If the coasting cap is reaches
   * @returns true if the coasting cap is reached
   */
  coastingCapReached() {
    return this.level >= this.startCapAt;
  }
  /**
   * The sim needs to stop buying this variable according to coasting rules.
   */
  stopBuying() {
    this.shouldBuy = false;
  }
  /**
   * If the variable level is strictly under its original cap
   * @returns true if the variable level is under its original cap
   */
  underOriginalCap() {
    return this.level < this.originalCap;
  }
  /**
   * If the variable level is strictly above its original cap.
   * 
   * This can be used to indicate the sim to stop forking
   * @returns true if the variable level is above its original cap
   */
  aboveOriginalCap() {
    return this.level > this.originalCap;
  }
  /**
   * Updates the level, value and cost of the variable that has been bought
   */
  buy() {
    this.value = this.valueScaling.computeNewValue(this.value, this.level);
    this.level++;
    this.cost = this.data.cost.getCost(this.level);
  }
  /**
   * Returns the cost to go for level N to level N+1
   * @param level N
   * @returns cost to go from N to N+1 (coast displayed when the variable is at level N)
   */
  getCostForLevel(level: number): number {
    return this.data.cost.getCost(level);
  }
  /**
   * Returns the cost to go for level N to level N+1
   * @param from N
   * @param to M
   * @returns cost to go from N to M
   */
  getCostForLevels(from: number, to: number): number {
    let totalCost = this.getCostForLevel(from);
    for (let i = from + 1; i < to; i++) {
      totalCost = add(totalCost, this.getCostForLevel(i));
    }
    return totalCost;
  }
  /**
   * Recomputes the value of the variable
   */
  reCalculate() {
    this.value = this.valueScaling.recomputeValue(this.level);
  }
  /**
   * Resets the variable level
   */
  reset() {
    this.init();
  }
  /**
   * Creates a copy of the variable
   * @param currency If the currency reference should change, the new reference can be put here
   * @returns a copy of the variable
   */
  copy(currency?: Currency): Variable {
    let varData = {
      currency: currency ?? this.currency,
      name: this.name,
      level: this.data.level,
      cost: this.data.cost.copy(),
      valueScaling: this.data.valueScaling.copy(),
    }
    let copy = new Variable(varData);
    copy.level = this.level;
    copy.cost = this.cost;
    copy.value = this.value;
    copy.startCapAt = this.startCapAt;
    copy.originalCap = this.originalCap;
    copy.shouldBuy = this.shouldBuy;
    copy.shouldFork = this.shouldFork;
    return copy
  }
}
