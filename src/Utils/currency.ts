import { add, subtract } from "./helpers";

export default class Currency {
    value: number;
    symbol: string;

    constructor(symb: string = "rho") {
        this.value = -Infinity;
        this.symbol = symb;
    }

    add(toAdd: number) {
        this.value = add(this.value, toAdd);
    }

    subtract(toSubtract: number) {
        this.value = subtract(this.value, toSubtract);
    }

    copy(): Currency {
        let copy = new Currency(this.symbol);
        copy.value = this.value;
        return copy;
    }
}