type BaseSimQuery = {
    sigma: number;
    settings: Settings;
}

type BaseSingleTheoryQuery<T extends theoryType> = BaseSimQuery & {
    theory: T;
    theorySpecificInputs: SpecificInputRecord<T>;
}

type stratCategoryType = "Best Overall" | "Best Active" | "Best Semi-Idle" | "Best Idle";
type FullStratType<T extends theoryType> = stratType[T] | stratCategoryType;

type SingleSimQuery<T extends theoryType, S extends FullStratType<T> = FullStratType<T>> = BaseSingleTheoryQuery<T> & {
    queryType: "single";
    strat: S;
    stratSpecificInputs: GeneralStratSpecificInputRecord<T, S>;
    input: ProgressValue;
    cap?: ProgressValue;
    lastStrat?: string;
}

type ChainSimQuery<T extends theoryType, S extends FullStratType<T> = FullStratType<T>> = BaseSingleTheoryQuery<T> & {
    queryType: "chain";
    strat: S;
    stratSpecificInputs: GeneralStratSpecificInputRecord<T, S>;
    input: ProgressValue;
    cap: ProgressValue;
    hardCap: boolean;
}

type StepSimQuery<T extends theoryType, S extends FullStratType<T> = FullStratType<T>> = BaseSingleTheoryQuery<T> & {
    queryType: "step";
    strat: S;
    stratSpecificInputs: GeneralStratSpecificInputRecord<T, S>;
    input: ProgressValue;
    cap: ProgressValue;
    step: number;
}

type PubTableSimQuery = BaseSimQuery & {
    queryType: "pub_table";
    theory: theoryType;
    strat: string;
    input: ProgressValue;
    cap: ProgressValue;
    step: number;
}

type ComparisonSimQuery<T extends theoryType> = BaseSingleTheoryQuery<T> & {
    queryType: "comparison";
    input: ProgressValue;
}

type AmountSimQuery<T extends theoryType, S extends FullStratType<T> = FullStratType<T>> = BaseSingleTheoryQuery<T> & {
    queryType: "amount";
    strat: S;
    stratSpecificInputs: GeneralStratSpecificInputRecord<T, S>;
    input: ProgressValue;
    amount: number;
}

type TimeSimQuery<T extends theoryType, S extends FullStratType<T> = FullStratType<T>> = BaseSingleTheoryQuery<T> & {
    queryType: "time";
    strat: S;
    stratSpecificInputs: GeneralStratSpecificInputRecord<T, S>;
    input: ProgressValue;
    time: number;
    hardCap: boolean;
}

type SimAllQuery = BaseSimQuery & {
    queryType: "all";
    theorySpecificInputs: SpecificInputFullRecord
    values: AllModeProgressValue[];
    veryActive: boolean;
    semiIdle: boolean;
    stratType: SettingsSimAllStratsMode;
}

type StepChainQuery<T extends theoryType, S extends FullStratType<T> = FullStratType<T>> = BaseSingleTheoryQuery<T> & {
    queryType: "step_chain";
    strat: S;
    stratSpecificInputs: GeneralStratSpecificInputRecord<T, S>;
    input: ProgressValue;
    cap: ProgressValue;
    step: number;
    hardCap: boolean;
}

type SimQuery = 
    SingleSimQuery<any>
    | ChainSimQuery<any>
    | StepSimQuery<any>
    | ComparisonSimQuery<any>
    | AmountSimQuery<any>
    | TimeSimQuery<any>
    | SimAllQuery 
    | StepChainQuery<any>
    | PubTableSimQuery;