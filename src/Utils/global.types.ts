import jsonData from "../Data/data.json" with { type: "json" };

declare global {
  type conditionFunction = () => boolean;

  type theoryType = keyof typeof jsonData.theories;
  type stratType = {
    [key in theoryType]: keyof (typeof jsonData.theories)[key]["strats"];
  };

  type SpecificInputValidationType = {
    type: "int" | "float" | "exp",
    min: number,
    max: number
  } | {
    type: "string"
  }

  type SpecificInputType = {label: string} & ({
    type: "textbox",
    validation: SpecificInputValidationType
  } | {
    type: "slider",
    validation: SpecificInputValidationType,
    step: number
  } | {
    type: "dropdown",
    choices: string[]
  });

  type TheoryDataStructure = {
    [theory in theoryType]: {
      tauFactor: number;
      specificInputs?: {
        [input: string]: SpecificInputType
      };
      UI_visible?: boolean;
      strats: {
        [strat in stratType[theory]]: {
          stratFilterCondition: string;
          forcedCondition?: string;
          UI_visible?: boolean;
        }
      }
    }
  }

  type BaseSimQuery = {
    sigma: number;
    settings: Settings;
  }

  type stratCategoryType = "Best Overall" | "Best Active" | "Best Semi-Idle" | "Best Idle";
  type FullStratType<T extends theoryType> = stratType[T] | stratCategoryType;

  type SingleSimQuery<T extends theoryType> = BaseSimQuery & {
    queryType: "single";
    theory: T;
    strat: FullStratType<T>;
    rho: number;
    cap?: number;
    lastStrat?: string;
  }

  type ChainSimQuery<T extends theoryType> = BaseSimQuery & {
    queryType: "chain";
    theory: T;
    strat: FullStratType<T>;
    rho: number;
    cap: number;
    hardCap: boolean;
  }

  type StepSimQuery<T extends theoryType> = BaseSimQuery & {
    queryType: "step";
    theory: T;
    strat: FullStratType<T>;
    rho: number;
    cap: number;
    step: number;
  }

  type PubTableSimQuery = BaseSimQuery & {
    queryType: "pub_table";
    theory: theoryType;
    strat: string;
    rho: number;
    cap: number;
    step: number;
  }

  type PubTableSimQuery = BaseSimQuery & {
    queryType: "pub_table";
    theory: theoryType;
    strat: string;
    rho: number;
    cap: number;
    step: number;
  }

  type ComparisonSimQuery<T extends theoryType> = BaseSimQuery & {
    queryType: "comparison";
    theory: T;
    rho: number;
  }

  type AmountSimQuery<T extends theoryType> = BaseSimQuery & {
    queryType: "amount";
    theory: T;
    strat: FullStratType<T>;
    rho: number;
    amount: number;
  }

  type TimeSimQuery<T extends theoryType> = BaseSimQuery & {
    queryType: "time";
    theory: T;
    strat: FullStratType<T>;
    rho: number;
    time: number;
    hardCap: boolean;
  }

  type SimAllQuery = BaseSimQuery & {
    queryType: "all";
    values: number[];
    veryActive: boolean;
    semiIdle: boolean;
    stratType: SettingsSimAllStratsMode;
  }

  type StepChainQuery<T extends theoryType> = BaseSimQuery & {
    queryType: "step_chain"
    theory: T
    strat: FullStratType<T>
    rho: number
    cap: number
    step: number
    hardCap: boolean
  }

  type SimQuery = SingleSimQuery<any>
    | ChainSimQuery<any>
    | StepSimQuery<any>
    | ComparisonSimQuery<any>
    | AmountSimQuery<any>
    | TimeSimQuery<any>
    | SimAllQuery 
    | StepChainQuery<any>
    | PubTableSimQuery;

  type SingleSimResponse = {
    responseType: "single";
    result: simResult;
  }

  type ChainSimResponse = {
    responseType: "chain";
    results: simResult[];
    deltaTau: number;
    averageRate: number;
    totalTime: number;
  }

  type PubTableResponse = {
    responseType: "pub_table";
    cap: number,
    step: number,
    start: number,
    pub_table: [number, number][]
  }
  type StepSimResponse = {
    responseType: "step";
    results: simResult[];
  }

  type SimAllResponse = {
    responseType: "all";
    sigma: number;
    stratType: SettingsSimAllStratsMode;
    completedCTs: SettingsCompletedCTsMode;
    results: simAllResult[];
  }

  type SimResponse = SingleSimResponse | ChainSimResponse | StepSimResponse | SimAllResponse | PubTableResponse;

  interface varBuy {
    variable: string;
    level: number;
    cost: number;
    symbol?: string;
    timeStamp: number;
  }

  type theoryData<T extends theoryType> = {
    theory: T;
    sigma: number;
    rho: number;
    strat: stratType[T];
    recovery: null | { value: number; time: number; recoveryTime: boolean };
    cap: null | number;
    recursionValue: null | number | number[];
    settings: Settings;
  }

  type SettingsSimAllStratsMode = "all" | "active" | "idle";
  type SettingsCompletedCTsMode = "in" | "end" | "no";
  type Settings = {
    dt: number;
    ddt: number;
    mfResetDepth: number;
    boughtVarsDelta: number;
    theme: string;
    simAllStrats: SettingsSimAllStratsMode;
    completedCTs: SettingsCompletedCTsMode;
    showA23: boolean;
    showUnofficials: boolean;
    totalPurchaseList: boolean;
  }

  interface simResult {
    theory: theoryType;
    sigma: number;
    lastPub: number;
    pubRho: number;
    deltaTau: number;
    pubMulti: number;
    strat: string;
    tauH: number;
    time: number;
    boughtVars: varBuy[];
  }

  interface simAllResult {
    theory: theoryType;
    ratio: number;
    lastPub: number;
    active: simResult;
    idle: simResult;
  }
}
