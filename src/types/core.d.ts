import jsonData from "../Data/data.json" with { type: "json" };

declare global {
    type conditionFunction = () => boolean;

    type theoryType = keyof typeof jsonData.theories;
    type stratType = {
        [key in theoryType]: keyof (typeof jsonData.theories)[key]["strats"];
    };
    type SpecificInputOf = {
        [key in theoryType]: (typeof jsonData.theories)[key] extends { specificInputs: infer SI }
            ? keyof SI
            : never
    };
    type StratSpecificInputOf = {
        [theory in theoryType]: {
            [strat in stratType[theory]]: (typeof jsonData.theories)[theory]["strats"][strat] extends { specificInputs: infer SI }
            ? keyof SI
            : never
        }
    };

    type TheoryDataStructure = {
        [theory in theoryType]: {
            supportsRho?: boolean;
            specificInputs?: {
                [key in SpecificInputOf[theory]]: SpecificInputType
            };
            stratSpecificInputs?: Record<string, SpecificInputType>,
            UI_visible?: boolean;
            strats: {
                [strat in stratType[theory]]: {
                    stratFilterCondition: string;
                    forcedCondition?: string;
                    UI_visible?: boolean;
                    specificInputs?: {
                    [key in StratSpecificInputOf[theory][strat]]: SpecificInputType | null
                    }
                }
            }
        }
    }

    interface varBuy {
        variable: string;
        level: number;
        cost: number;
        symbol?: string;
        timeStamp: number;
    }
    
    type theoryData<T extends theoryType, S extends stratType[T] = stratType[T]> = {
        theory: T;
        specificInputs: SpecificInputRecord<T>;
        stratSpecificInputs: StratSpecificInputRecord<T, S>;
        sigma: number;
        input: ProgressValue;
        strat: S;
        cap?: ProgressValue;
        recursionValue: null | number | number[];
        settings: Settings;
    }
    
    interface simResult {
        theory: theoryType;
        sigma: number;
        lastPubTau: number;
        lastPubRho?: number;
        pubPointTau: number;
        pubPointRho?: number;
        deltaTau: number;
        pubMulti: number;
        strat: string;
        tauH: number;
        time: number;
        boughtVars: varBuy[];
    }

    type simResultRho = simResult & {
        lastPubRho: number;
        pubPointRho: number;
    }
    
    interface simAllResult {
        theory: theoryType;
        ratio: number;
        lastPubTau: number;
        lastPubRho?: number;
        active: simResult;
        idle: simResult;
    }

    type ProgressValueType = "tau" | "rho" | "multiplier";

    type ProgressValue = {
        valueType: ProgressValueType;
        value: number;
    }

    type AllModeProgressValue = ProgressValue | "ignore" | "cache";

    type ProgressValueConverter = {
        supportsRho: boolean;
        convertTo: (input: ProgressValue, inputType: ProgressValueType, sigma: number = 20) => number;
    }

    type ProgressValueConverterRho = {
        supportsRho: true;
        convertTo: (input: ProgressValue, inputType: ProgressValueType, sigma: number = 20) => number;
    }

    type TheoryInterface<T extends theoryType> = {
        simulate: <S extends stratType[T]>(data: theoryData<T, S>) => Promise<simResult>;
        converter: ProgressValueConverter;
    }
}

