import { add, subtract } from "./helpers.js";
import { parseValue } from "./cost";
export default class Variable {
    constructor(data) {
        this.data = data;
        this.level = 0;
        this.cost = 0;
        this.value = 0;
        this.isZero = false;
        this.stepwisePowerSum = { length: 0, base: 0 };
        this.varBase = 0;
        this.firstFreeCost = 0;
        this.init();
    }
    init() {
        var _a, _b, _c, _d;
        this.level = (_a = this.data.level) !== null && _a !== void 0 ? _a : 0;
        this.cost = this.data.cost.getCost(this.level);
        this.value = typeof this.data.value === "number" || typeof this.data.value === "string" ? parseValue(String(this.data.value)) : 0;
        this.isZero = false;
        if (this.value === -Infinity) {
            this.value = 0;
            this.isZero = true;
        }
        this.stepwisePowerSum =
            ((_b = this.data.stepwisePowerSum) === null || _b === void 0 ? void 0 : _b.default) === true
                ? { base: 2, length: 10 }
                : typeof ((_c = this.data.stepwisePowerSum) === null || _c === void 0 ? void 0 : _c.base) === "number" && typeof ((_d = this.data.stepwisePowerSum) === null || _d === void 0 ? void 0 : _d.length) === "number"
                    ? { base: this.data.stepwisePowerSum.base, length: this.data.stepwisePowerSum.length }
                    : { base: 0, length: 0 };
        this.varBase = this.data.varBase ? this.data.varBase : 10;
        this.firstFreeCost = this.data.firstFreeCost === true ? 1 : 0;
        if (this.data.firstFreeCost)
            this.buy();
    }
    buy() {
        if (this.stepwisePowerSum.base !== 0) {
            this.value = this.isZero
                ? Math.log10(this.stepwisePowerSum.base) * Math.floor(this.level / this.stepwisePowerSum.length)
                : add(this.value, Math.log10(this.stepwisePowerSum.base) * Math.floor(this.level / this.stepwisePowerSum.length));
            this.isZero = false;
        }
        else
            this.value = Math.log10(this.varBase) * (this.level + 1);
        this.level++;
        this.cost = this.data.cost.getCost(this.level - this.firstFreeCost);
    }
    getCostForLevel(level) {
        return this.data.cost.getCost(level - this.firstFreeCost);
    }
    reCalculate() {
        if (this.stepwisePowerSum.base !== 0) {
            const intPart = Math.floor(this.level / this.stepwisePowerSum.length);
            const modPart = this.level - intPart * this.stepwisePowerSum.length;
            const d = this.stepwisePowerSum.length / (this.stepwisePowerSum.base - 1);
            this.value = subtract(Math.log10(d + modPart) + Math.log10(this.stepwisePowerSum.base) * intPart, Math.log10(d));
        }
        else
            this.value = Math.log10(this.varBase) * this.level;
    }
    reset() {
        this.init();
    }
}
