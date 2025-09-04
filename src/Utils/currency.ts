import { add, subtract } from "./helpers";

export default class Currency {
    value: number;
    symb: string;

    constructor(symb: string = "rho") {
        this.value = -Infinity;
        this.symb = symb;
    }

    add(toAdd: number) {
        this.value = add(this.value, toAdd);
    }

    subtract(toSubtract: number) {
        this.value = subtract(this.value, toSubtract);
    }

    copy(): Currency {
        let newCurrency = new Currency(this.symb);
        newCurrency.value = this.value;
        return newCurrency;
    }
}