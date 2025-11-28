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
  data: variableData;
  currency?: Currency;
  name: string;
  level: number;
  cost: number;
  value: number;
  originalCap: number;
  startCapAt: number;
  shouldBuy: boolean;
  shouldFork: boolean;
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
  init() {
    this.level = this.data.level ?? 0;
    this.cost = this.data.cost.getCost(this.level);
    this.value = this.valueScaling.recomputeValue(this.level);

    if(this.data.cost instanceof FirstFreeCost && this.level == 0) {
      this.buy();
    }
  }
  /** This group of methods will facilitate hard-stopping a variable during coasting */
  setOriginalCap(originalCap: number) {
    this.originalCap = originalCap;
  }
  configureCap(capDelta: number) {
    let startCapAt = this.originalCap - capDelta;
    if(startCapAt < 1) {
      startCapAt = 1;
    }
    this.startCapAt = startCapAt;
  }
  prepareExtraForCap(lastLevel: number) {
    return ` ${this.name}: ${lastLevel}`;// ${this.name}delta: ${this.originalCap - lastLevel}`
  }
  coastingCapReached() {
    return this.level >= this.startCapAt;
  }
  stopBuying() {
    this.shouldBuy = false;
  }
  underOriginalCap() {
    return this.level < this.originalCap;
  }
  aboveOriginalCap() {
    return this.level > this.originalCap;
  }
  buy() {
    this.value = this.valueScaling.computeNewValue(this.value, this.level);
    this.level++;
    this.cost = this.data.cost.getCost(this.level);
  }
  getCostForLevel(level: number): number {
    return this.data.cost.getCost(level);
  }
  getCostForLevels(from: number, to: number): number {
    let totalCost = this.getCostForLevel(from);
    for (let i = from + 1; i <= to; i++) {
      totalCost = add(totalCost, this.getCostForLevel(i));
    }
    return totalCost;
  }
  reCalculate() {
    this.value = this.valueScaling.recomputeValue(this.level);
  }
  reset() {
    this.init();
  }
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
