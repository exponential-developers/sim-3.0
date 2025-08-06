import { add, subtract } from "./helpers";

export abstract class BaseValue {
    abstract computeNewValue(prevValue: number, currentLevel: number): number;
    abstract recomputeValue(level: number): number;
    abstract copy(): BaseValue;
}

export class StepwisePowerSumValue extends BaseValue {
    base: number;
    length: number;
    offset: number;
    constructor(base: number = 2, length: number = 10, offset: number = 0) {
        super();
        this.base = base;
        this.length = length;
        this.offset = offset;
    }
    computeNewValue(prevValue: number, currentLevel: number): number {
        let toAdd = Math.log10(this.base) * Math.floor(currentLevel / this.length);
        return add(prevValue, toAdd);
    }
    recomputeValue(level: number): number {
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
    copy(): StepwisePowerSumValue {
        return new StepwisePowerSumValue(this.base, this.length, this.offset);
    }
}

export class ExponentialValue extends BaseValue {
    power: number;

    constructor(power: number = 2) {
        super();
        this.power = power;
    }

    computeNewValue(prevValue: number, currentLevel: number): number {
        return Math.log10(this.power) * (currentLevel + 1);
    }
    recomputeValue(level: number): number {
        return Math.log10(this.power) * level;
    }
    copy(): ExponentialValue {
        return new ExponentialValue(this.power);
    }
}

export class LinearValue extends BaseValue {
    power: number;
    offset: number;
    constructor(power: number = 10, offset: number = 0) {
        super();
        this.power = power;
        this.offset = offset;
    }
    computeNewValue(prevValue: number, currentLevel: number): number {
        return this.offset + this.power * (currentLevel + 1);
    }
    recomputeValue(level: number): number {
        return this.offset + this.power * level;
    }
    copy(): LinearValue {
        return new LinearValue(this.power, this.offset);
    }
}