import { add, subtract } from "./helpers";

export abstract class BaseValue {
    varBase: number;
    constructor(varBase: number = 10) {
        this.varBase = varBase;
    }
    abstract computeNewValue(prevValue: number, currentLevel: number, isZero: boolean): number;
    abstract recomputeValue(level: number): number;
    abstract copy(): BaseValue;
}

export class StepwisePowerSumValue extends BaseValue {
    base: number;
    length: number;
    constructor(base: number = 2, length: number = 10, varBase: number = -Infinity) {
        super(varBase);
        this.base = base;
        this.length = length;
    }
    computeNewValue(prevValue: number, currentLevel: number, isZero: boolean): number {
        let toAdd = Math.log10(this.base) * Math.floor(currentLevel / this.length);
        return isZero ? toAdd : add(prevValue, toAdd);
    }
    recomputeValue(level: number): number {
        const intPart = Math.floor(level / this.length);
        const modPart = level - intPart * this.length;
        const d = this.length / (this.base - 1);
        const subPart = subtract(Math.log10(d + modPart) + Math.log10(this.base) * intPart, Math.log10(d));
        if (this.varBase !== -Infinity) {
            return add(this.varBase, subPart);
        }
        else {
            return subPart;
        }
    }
    copy(): StepwisePowerSumValue {
        return new StepwisePowerSumValue(this.base, this.length, this.varBase);
    }
}

export class ExponentialValue extends BaseValue {
    computeNewValue(prevValue: number, currentLevel: number, isZero: boolean): number {
        return Math.log10(this.varBase) * (currentLevel + 1);
    }
    recomputeValue(level: number): number {
        return Math.log10(this.varBase) * level;
    }
    copy(): ExponentialValue {
        return new ExponentialValue(this.varBase);
    }
}

export class LinearValue extends BaseValue {
    offset: number;
    constructor(varBase: number = 10, offset: number = 0) {
        super(varBase);
        this.offset = offset;
    }
    computeNewValue(prevValue: number, currentLevel: number, isZero: boolean): number {
        return this.offset + this.varBase * (currentLevel + 1);
    }
    recomputeValue(level: number): number {
        return this.offset + this.varBase * level;
    }
    copy(): LinearValue {
        return new LinearValue(this.varBase, this.offset);
    }
}