import { add, subtract } from "./helpers";
export class BaseValue {
}
export class StepwisePowerSumValue extends BaseValue {
    constructor(base = 2, length = 10, offset = 0) {
        super();
        this.base = base;
        this.length = length;
        this.offset = offset;
    }
    computeNewValue(prevValue, currentLevel) {
        let toAdd = Math.log10(this.base) * Math.floor(currentLevel / this.length);
        return add(prevValue, toAdd);
    }
    recomputeValue(level) {
        if (level === 0) {
            return Math.log10(this.offset);
        }
        const intPart = Math.floor(level / this.length);
        const modPart = level - intPart * this.length;
        const d = this.length / (this.base - 1);
        const subPart = subtract(Math.log10(d + modPart) + Math.log10(this.base) * intPart, Math.log10(d));
        if (this.offset !== -Infinity) {
            return add(Math.log10(this.offset), subPart);
        }
        else {
            return subPart;
        }
    }
    copy() {
        return new StepwisePowerSumValue(this.base, this.length, this.offset);
    }
}
export class ExponentialValue extends BaseValue {
    constructor(power = 2) {
        super();
        this.power = power;
    }
    computeNewValue(prevValue, currentLevel) {
        return Math.log10(this.power) * (currentLevel + 1);
    }
    recomputeValue(level) {
        return Math.log10(this.power) * level;
    }
    copy() {
        return new ExponentialValue(this.power);
    }
}
export class LinearValue extends BaseValue {
    constructor(power = 10, offset = 0) {
        super();
        this.power = power;
        this.offset = offset;
    }
    computeNewValue(prevValue, currentLevel) {
        return this.offset + this.power * (currentLevel + 1);
    }
    recomputeValue(level) {
        return this.offset + this.power * level;
    }
    copy() {
        return new LinearValue(this.power, this.offset);
    }
}
