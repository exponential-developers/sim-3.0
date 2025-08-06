import { add } from "./helpers.js";
import { parseValue, BaseCost, FirstFreeCost } from "./cost";
import { BaseValue } from "./value";

interface variableData {
  level?: number;
  cost: BaseCost;
  valueScaling: BaseValue;
}

export default class Variable {
  data: variableData;
  level: number;
  cost: number;
  value: number;
  valueScaling: BaseValue;

  constructor(data: variableData) {
    this.data = data;
    this.level = 0;
    this.cost = 0;
    this.value = 0;
    this.valueScaling = this.data.valueScaling;
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
  copy(): Variable {
    let varData = {
      level: this.data.level,
      cost: this.data.cost.copy(),
      valueScaling: this.data.valueScaling.copy(),
    }
    let copy = new Variable(varData);
    copy.level = this.level;
    copy.cost = this.cost;
    copy.value = this.value;
    return copy
  }
}
