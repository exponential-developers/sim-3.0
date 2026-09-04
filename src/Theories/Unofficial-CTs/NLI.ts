import { ExponentialCost, FirstFreeCost } from "../../Utils/cost";
import Currency from "../../Utils/currency";
import { trueFunc } from "../../Utils/functions";
import { add, binaryInsertionSearch, defaultResult, l10, parseExponentialValue, regsum, subtract, toCallables } from "../../Utils/helpers";
import { genericProgressConverter } from "../../Utils/progressConversion";
import { ExponentialValue } from "../../Utils/value";
import Variable from "../../Utils/variable";
import theoryClass from "../theory";

type theory = "NLI";

class ExponentialValueM1 extends ExponentialValue {
    computeNewValue(prevValue: number, currentLevel: number): number {
        return subtract(l10(this.power) * (currentLevel + 1), -0.00001);
    }
    recomputeValue(level: number): number {
        return subtract(l10(this.power) * level, -0.00001);
    }
    copy(): ExponentialValueM1 {
        return new ExponentialValueM1(this.power);
    }
}

const converter: ProgressValueConverter = genericProgressConverter({
    multExponent: 0.2
});

const NLI: TheoryInterface<theory> = {
    simulate: nli,
    converter
};

export default NLI;

async function nli(data: theoryData<theory>): Promise<simResult<theory>> {
    const sim = new MainNLISim(data);
    return await sim.simulate();
}

const PHI = (1 + Math.sqrt(5)) / 2;
const RHO_CONVERTION = 0.4;
const H_CONVERTION = 0.4;

const PUB_UNLOCK = 5;
const RHO_UNLOCK = 16;
const MS_MENU_UNLOCK = 10;
const K_PERMA_UNLOCKS = [50, 140];
const H_PERMA_UNLOCKS = [90];
const MS_INCREASE_PERMA_UNLOCKS = [60, 100, 160, 500, 650, 770];

const MILESTONE_CAPS = [
    [1, 1, 1, 1, 0, 0, 0], // level 0
    [2, 2, 2, 2, 1, 0, 0], // level 1
    [3, 3, 3, 3, 2, 1, 0], // level 2
    [4, 4, 4, 4, 3, 2, 1], // level 3
    [4, 4, 4, 4, 4, 3, 2], // level 4
    [4, 4, 4, 4, 4, 4, 3], // level 5
    [4, 4, 4, 4, 4, 4, 4]  // level 6
];

const MILESTONE_COSTS = [
    60, 80, 90,                    // group 1
    180, 200, 210, 220,            // group 2
    300, 320, 330, 340, 350,       // group 3
    800, 850, 900, 925, 950, 1000, // group 4
    1425, 1525, 1625,              // group 5
    1850, 1950,                    // group 6
    2280,                          // group 7
    2290, 2300, 2310, 2320,        // useless milestones
    2375                           // final
];

const BASES = [
    [1.39, 1.4, 1.41, 1.42, 1.43], // a0
    [1.435, 1.455, 1.475, 1.495, 1.515], // a1
    [1.43, 1.455, 1.48, 1.505, 1.53], // a2
    [1.38, 1.405, 1.43, 1.455, 1.48], // a3
    [1.55, 1.57, 1.59, 1.61, 1.63], // b0
    [1.7, 1.72, 1.74, 1.76, 1.78], // b1
    [1.605, 1.615, 1.63, 1.655, 1.68] // b2
]

/**
 * Evaluates polynomial
 * @param poly log10 numbers
 * @param point log10 number
 * @returns polynomial evaluation
 */
function evaluatePoly(poly: number[], point: number): number {
    let res = -Infinity;

    for (let i = 0; i < poly.length; i++) {
        res = add(res, poly[i] + point * i);
    }

    return res;
}

function rspIntegral(poly1: number[], poly2: number[], bound: number): number {
    let res = -Infinity;

    for (let i = 0; i < poly1.length; i++){
        for (let j = 1; j < poly2.length; j++){
            res = add(res, l10(j / (i + j)) + poly1[i] + poly2[j] + bound * (i + j))
        }
    }

    return res;
}

function getMilestoneReduction(h: number) {
    return add(h * 4, 0);
}

function deriveAlphaFromTau(tau: number): number {
    return 0;
}

/**
 * Used to derive how many milestones a player should have given tau and alpha
 * @param tau tau
 * @param alpha alpha
 * @returns estimated max(h)
 */
function alphaToH(tau: number, alpha: number): number {
    const b0Levels = Math.min(1, 1 + Math.floor((alpha - l10(200)) / 2.54));
    const perma3Levels = binaryInsertionSearch(MS_INCREASE_PERMA_UNLOCKS, alpha);

    if (perma3Levels === 0) {
        const hNoMs = l10(BASES[4][0]) * b0Levels;
        const ms1Price = MILESTONE_COSTS[0] - getMilestoneReduction(hNoMs);
        if (tau > ms1Price) return l10(BASES[4][1]) * b0Levels;
        else return hNoMs;
    }
    else {
        return l10(BASES[4][Math.min(4, 1 + perma3Levels)]) * b0Levels;
    }
}

function hToMilestoneCount(tau: number, h: number) {
    if (tau < MS_MENU_UNLOCK) return 0;
    const power = tau + getMilestoneReduction(h);
    return binaryInsertionSearch(MILESTONE_COSTS, power);
}

function alphaToMilestoneCount(tau: number, alpha: number): number {
    const h = alphaToH(tau, alpha);
    return hToMilestoneCount(tau, h);
}

function alphaToPermas(alpha: number): number[] {
    return [
        binaryInsertionSearch(K_PERMA_UNLOCKS, alpha),
        binaryInsertionSearch(H_PERMA_UNLOCKS, alpha),
        binaryInsertionSearch(MS_INCREASE_PERMA_UNLOCKS, alpha)
    ]
};

interface NLIAlphaState {
    b0Level: number,
    maxAlpha: number;
    t: number;
    tauPower: number;
    maxh: number;
    permaPoints: number;
    msPoints: number;
}

abstract class BaseNLISim extends theoryClass<theory> {
    baseTau: number;
    baseAlpha: number;
    q: number;
    abstract currency: Currency;
    permas: number[];
    permaCount: number;
    msCount: number;

    constructor (data: theoryData<theory>) {
        super(data, converter);
        this.baseTau = converter.convertTo(this.lastPub, "tau");
        this.baseAlpha = data.specificInputs.lifetime_alpha 
            ? parseExponentialValue(data.specificInputs.lifetime_alpha)
            : deriveAlphaFromTau(this.baseTau);
        this.q = -Infinity;
        this.permas = alphaToPermas(this.baseAlpha);
        this.milestones = [0, 0, 0, 0, 0, 0, 0, 0];
        this.permaCount = regsum(...this.permas);
        this.msCount = alphaToMilestoneCount(this.baseTau, this.baseAlpha);
    }

    getVariableAvailability(): conditionFunction[] {
        return [
            trueFunc,
            trueFunc,
            trueFunc,
            () => this.permas[0] > 0,
            () => this.permas[0] > 1,
            trueFunc,
            trueFunc,
            () => this.permas[1] > 0
        ]
    }

    getTotMult(val: ProgressValue): number {
        return converter.convertTo(val, "multiplier");
    }

    updateBases() {
        const varIdToMsId = [0, 2, 4, 6, 1, 3, 5];
        for (let i = 0; i < 7; i++) {
            (this.variables[i + 1].valueScaling as ExponentialValue).power = BASES[i][this.milestones[varIdToMsId[i]]];
            this.variables[i + 1].reCalculate();
        }
    }

    tick() {
        this.q = add(this.q * (1 + PHI), this.variables[0].value + l10(this.dt)) * (1 / (1 + PHI));
    }

    recordPurchase(variable: Variable) {
        if (true) { // is filtered later
          this.boughtVars.push({
            variable: variable.name,
            level: variable.level + 1,
            cost: variable.cost,
            timeStamp: this.t,
            symbol: variable.currency.symbol
          });
        }
    }

    getMilestoneMax(): number[] {
        return MILESTONE_CAPS[this.permas[2]];
    }
}

class NLIAlphaSim extends BaseNLISim {
    currency: Currency;
    maxAlpha: number;
    maxh: number;
    stateDirtyFlag: boolean;

    getBuyingConditions(): conditionFunction[] {
        const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
            NLI: [true, false, true, true, true, true, true, true]
        };
        return toCallables(conditions[this.strat]);
    }

    constructor (data: theoryData<theory>) {
        super(data);
        this.currency = new Currency("α");
        this.maxAlpha = this.currency.value;
        this.maxh = -Infinity;
        this.stateDirtyFlag = true;

        this.variables = [
            new Variable({ 
                currency: this.currency, 
                name: "q1", 
                cost: new FirstFreeCost(new ExponentialCost(5000, 31.2)), 
                valueScaling: new ExponentialValueM1(2) 
            }), // q1
            new Variable({ 
                currency: this.currency, 
                name: "a0", 
                cost: new ExponentialCost(1e6, 1e6), 
                valueScaling: new ExponentialValue(BASES[0][0])
            }), // a0 - unused
            new Variable({ 
                currency: this.currency, 
                name: "a1", 
                cost: new ExponentialCost(80, 4.9), 
                valueScaling: new ExponentialValue(BASES[1][0])
            }), // a1
            new Variable({ 
                currency: this.currency, 
                name: "a2", 
                cost: new ExponentialCost(1e5, 10.15), 
                valueScaling: new ExponentialValue(BASES[2][0])
            }), // a2
            new Variable({ 
                currency: this.currency, 
                name: "a3", 
                cost: new ExponentialCost(1e8, 40), 
                valueScaling: new ExponentialValue(BASES[3][0])
            }), // a3
            new Variable({ 
                currency: this.currency, 
                name: "b0", 
                cost: new FirstFreeCost(new ExponentialCost(200, 2.54)), 
                valueScaling: new ExponentialValueM1(BASES[4][0])
            }), // b0
            new Variable({ 
                currency: this.currency, 
                name: "b1", 
                cost: new FirstFreeCost(new ExponentialCost(3000, 3.65)), 
                valueScaling: new ExponentialValueM1(BASES[5][0])
            }), // b1
            new Variable({ 
                currency: this.currency, 
                name: "b2", 
                cost: new FirstFreeCost(new ExponentialCost(1e7, 4.1)), 
                valueScaling: new ExponentialValueM1(BASES[6][0])
            }), // b2
        ]

        this.updateMilestones();
        this.buyingConditions = this.getBuyingConditions();
        this.variableAvailability = this.getVariableAvailability();
    }

    getTauPower() {
        return this.maxh * H_CONVERTION;
    }

    updatePermas() {
        if (this.maxAlpha < this.baseAlpha) return;
        this.permas = alphaToPermas(this.maxAlpha);
        const newPermaCount = regsum(...this.permas);
        if (newPermaCount > this.permaCount) {
            this.permaCount = newPermaCount;
            this.stateDirtyFlag = true;
            this.updateMilestones();
        }
    }

    updateMilestoneCount() {
        const newMilestoneCount = hToMilestoneCount(
            Math.max(this.baseTau, this.getTauPower()), this.maxh
        );
        if (newMilestoneCount > this.msCount) {
            this.msCount = newMilestoneCount;
            this.stateDirtyFlag = true;
            this.updateMilestones();
        }
    }

    getMilestonePriority(): number[] {
        switch (this.permas[2]) {
            case 0: return [2, 3, 1];
            case 1: return [4, 3, 2, 1];
            case 2: return [4, 3, 2, 1, 5];
            case 3: return [3, 2, 1, 4, 6, 5];
            case 4: return [4, 3, 2, 1, 6, 5];
            case 5: return [5, 4, 3, 2, 1, 6];
            case 6: return [6, 5, 4, 3, 1, 2];
            default: return []; // unreachable
        }
    }

    updateMilestones() {
        const priority = this.getMilestonePriority();
        let milestoneCount = this.msCount;
        this.milestones = new Array(this.milestonesMax.length).fill(0);
        for (let i = 0; i < priority.length; i++) {
            while (this.milestones[priority[i]] < this.milestonesMax[priority[i]] && milestoneCount > 0) {
                this.milestones[priority[i]]++;
                milestoneCount--;
            }
        }
        this.updateBases();
    }

    updateMaxH() {
        const milestones = Math.min(this.msCount, this.getMilestoneMax()[1]);
        this.maxh = l10(BASES[4][milestones]) * this.variables[5].level;
    }

    tick() {
        super.tick();
        const k = [
            0,
            this.variables[2].value,
            this.permas[0] > 0 ? this.variables[3].value : -Infinity,
            this.permas[0] > 1 ? this.variables[4].value : -Infinity
        ];
        const h = [
            this.variables[5].value,
            this.variables[6].value,
            this.permas[1] > 0 ? this.variables[7].value : -Infinity
        ];

        const integral = rspIntegral(h, k, this.q);
        this.currency.add(integral + this.totMult + l10(this.dt));
    }

    updateSimStatus() {
        if (this.currency.value > this.maxAlpha) this.maxAlpha = this.currency.value;
        this.updateT();
        this.updateMaxH();
        this.updatePermas();
    }

    deriveState(): NLIAlphaState {
        return {
            b0Level: this.variables[5].level,
            maxAlpha: this.maxAlpha,
            t: this.t,
            tauPower: this.getTauPower(),
            maxh: this.maxh,
            permaPoints: this.permaCount,
            msPoints: this.msCount
        }
    }

    onVariablePurchased(id: number): void {
        if (id === 5) this.stateDirtyFlag = true;
    }
}

class NLIRhoSim extends BaseNLISim {
    currency: Currency;
    maxRho: number;
    maxh: number;

    getBuyingConditions(): conditionFunction[] {
        const conditions: Record<stratType[theory], (boolean | conditionFunction)[]> = {
            NLI: [true, true, true, true, true, false, true, true]
        };
        return toCallables(conditions[this.strat]);
    }

    constructor (data: theoryData<theory>, maxh: number) {
        super(data);
        this.currency = new Currency("α");
        this.maxRho = this.currency.value;
        this.maxh = maxh;

        this.variables = [
            new Variable({ 
                currency: this.currency, 
                name: "q1", 
                cost: new FirstFreeCost(new ExponentialCost(5000, 31.2)), 
                valueScaling: new ExponentialValueM1(2) 
            }), // q1
            new Variable({ 
                currency: this.currency, 
                name: "a0", 
                cost: new ExponentialCost(50, 1.891), 
                valueScaling: new ExponentialValue(BASES[0][0])
            }), // a0
            new Variable({ 
                currency: this.currency, 
                name: "a1", 
                cost: new ExponentialCost(1e4, 2.362), 
                valueScaling: new ExponentialValue(BASES[1][0])
            }), // a1
            new Variable({ 
                currency: this.currency, 
                name: "a2", 
                cost: new ExponentialCost(1e4, 2.855), 
                valueScaling: new ExponentialValue(BASES[2][0])
            }), // a2
            new Variable({ 
                currency: this.currency, 
                name: "a3", 
                cost: new ExponentialCost(1e8, 3.31), 
                valueScaling: new ExponentialValue(BASES[3][0])
            }), // a3
            new Variable({ 
                currency: this.currency, 
                name: "b0", 
                cost: new FirstFreeCost(new ExponentialCost(1e6, 1e6)), 
                valueScaling: new ExponentialValueM1(BASES[4][0])
            }), // b0 - unused
            new Variable({ 
                currency: this.currency, 
                name: "b1", 
                cost: new FirstFreeCost(new ExponentialCost(1e5, 11.25)), 
                valueScaling: new ExponentialValueM1(BASES[5][0])
            }), // b1
            new Variable({ 
                currency: this.currency, 
                name: "b2", 
                cost: new FirstFreeCost(new ExponentialCost(1e10, 25.55)), 
                valueScaling: new ExponentialValueM1(BASES[6][0])
            }), // b2
        ]

        this.updateMilestones();
        this.buyingConditions = this.getBuyingConditions();
        this.variableAvailability = this.getVariableAvailability();
    }

    getTauPower() {
        return this.maxh * H_CONVERTION + this.maxRho * RHO_CONVERTION;
    }

    updateMilestoneCount() {
        const newMilestoneCount = hToMilestoneCount(
            Math.max(this.baseTau, this.getTauPower()), this.maxh
        );
        if (newMilestoneCount > this.msCount) {
            this.msCount = newMilestoneCount;
            this.updateMilestones();
        }
    }

    getMilestonePriority(): number[] {
        switch (this.permas[2]) {
            case 0: return [0, 3, 2];
            case 1: return [3, 4, 0, 2];
            case 2: return [0, 3, 2, 5, 4];
            case 3: return [0, 2, 3, 5, 4, 6];
            case 4: return [0, 2, 3, 4, 5, 6];
            case 5: return [0, 2, 3, 4, 5, 6];
            case 6: return [0, 6, 5, 4, 3, 2];
            default: return []; // unreachable
        }
    }

    updateMilestones() {
        const priority = this.getMilestonePriority();
        let milestoneCount = this.msCount;
        this.milestones = new Array(this.milestonesMax.length).fill(0);
        for (let i = 0; i < priority.length; i++) {
            while (this.milestones[priority[i]] < this.milestonesMax[priority[i]] && milestoneCount > 0) {
                this.milestones[priority[i]]++;
                milestoneCount--;
            }
        }
        this.updateBases();
    }

    tick() {
        super.tick();
        const k = [
            this.variables[1].value,
            this.variables[2].value,
            this.permas[0] > 0 ? this.variables[3].value : -Infinity,
            this.permas[0] > 1 ? this.variables[4].value : -Infinity
        ];
        const h = [
            0,
            this.variables[6].value,
            this.permas[1] > 0 ? this.variables[7].value : -Infinity
        ];
        
        const integral = rspIntegral(k, h, this.q);
        this.currency.add(integral + this.totMult + l10(this.dt));
    }

    updateSimStatus() {
        if (this.currency.value > this.maxRho) this.maxRho = this.currency.value;
        this.updateT();
    }
}

class MainNLISim {
    constructor (data: theoryData<theory>) {

    }

    async simulate(): Promise<simResult<theory>> {
        return defaultResult();
    }
}