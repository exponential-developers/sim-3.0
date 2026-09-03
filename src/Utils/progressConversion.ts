import { getR9multiplier } from "./helpers";

interface TraditionalProgressConverterInterface {
    r9Affected?: boolean;
    tauFactor?: number;
    multExponent: number;
    multFactor?: number;
}

export function traditionalConverter(data: TraditionalProgressConverterInterface): ProgressValueConverterRho {
    const r9Affected = data.r9Affected ?? false;
    const tauFactor = data.tauFactor ?? 1;
    const multExponent = data.multExponent;
    const multFactor = data.multFactor ?? 0;

    let r9 = (sigma: number) => r9Affected ? getR9multiplier(sigma) : 0;

    let rhoToTau = (value: number) => value * tauFactor;
    let multToTau = (value: number, sigma: number) => (value - multFactor - r9(sigma)) / multExponent;
    let tauToRho = (value: number) => value / tauFactor;
    let tauToMult = (value: number, sigma: number) => value * multExponent + multFactor + r9(sigma);

    return {
        supportsRho: true,
        convertTo(input, inputType, sigma = 20) {
            let val = input.value;
            if (input.valueType == "rho") val = rhoToTau(val);
            if (input.valueType == "multiplier") val = multToTau(val, sigma);

            switch (inputType) {
                case "tau": return val;
                case "rho": return tauToRho(val);
                case "multiplier": return tauToMult(val, sigma);
            }
        },
    }
}