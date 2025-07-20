import { parseLog10String } from "./helpers";

export function parseValue(val: string) {
    if (val === "Infinity") throw "Variable value reached Infinity";
    if (val === "0") return -Infinity;
    if (/[e]/.test(val)) return parseLog10String(val);
    return Math.log10(Number(val));
}

export abstract class BaseCost {
    abstract getCost(level: number): number;
    abstract copy(): BaseCost;
}

export class CompositeCost extends BaseCost {
    cutoff: number;
    cost1: BaseCost;
    cost2: BaseCost;
    constructor(cutoff: number, cost1: BaseCost, cost2: BaseCost) {
        super();
        this.cutoff = cutoff;
        this.cost1 = cost1;
        this.cost2 = cost2;
    }
    getCost(level: number): number {
        return level < this.cutoff ? this.cost1.getCost(level) : this.cost2.getCost(level - this.cutoff);
    }
    copy(): CompositeCost {
        return new CompositeCost(this.cutoff, this.cost1.copy(), this.cost2.copy());
    }
}

export class ExponentialCost extends BaseCost  {
    cost: number;
    costInc: number;
    /**
     * ExponentialCost constructor
     * @param {number} base BaseCost of the variable
     * @param {number} costInc Cost Increase of the variable
     * @param {boolean} log2 States whether the cost increase is log2 or not - optional, default: false
     */
    constructor(base: number | string, costInc: number | string, log2: boolean | null = false) {
        super();
        this.cost = parseValue(String(base));
        this.costInc = parseValue(String(costInc));
        if (log2) this.costInc = Math.log10(2) * 10 ** this.costInc;
    }
    getCost(level: number) {
        return this.cost + this.costInc * level;
    }
    copy(): ExponentialCost {
        let res = new ExponentialCost("10", "10", false);
        // Dark hacks to make a copy of this one:
        res.cost = this.cost;
        res.costInc = this.costInc;
        return res;
    }
}

export class StepwiseCost extends BaseCost {
    stepLength: number;
    cost: BaseCost;
    constructor(stepLength: number, cost: BaseCost) {
        super();
        this.stepLength = stepLength;
        this.cost = cost;
    }
    getCost(level: number): number {
        return this.cost.getCost(Math.floor(level / this.stepLength));
    }
    copy(): StepwiseCost {
        return new StepwiseCost(this.stepLength, this.cost.copy());
    }
}

export class ConstantCost extends BaseCost {
    cost: number;
    constructor(base: number | string) {
        super();
        this.cost = parseValue(String(base));
    }
    getCost(level: number): number {
        return this.cost;
    }
    copy(): ConstantCost {
        // Dark hacks to make a copy of this one:
        let res = new ConstantCost("10");
        res.cost = this.cost;
        return res;
    }
}

export class FirstFreeCost extends BaseCost {
    trueCost: BaseCost;

    constructor(trueCost: BaseCost) {
        super();
        this.trueCost = trueCost;
    }
    getCost(level: number): number {
        if(level == 0) {
            return this.trueCost.getCost(0);
        }
        return this.trueCost.getCost(level - 1);
    }
    copy(): FirstFreeCost {
        return new FirstFreeCost(this.trueCost.copy());
    }
}