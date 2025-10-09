import jsonData from "../Data/data.json" assert { type: "json" };

declare global {
  type conditionFunction = () => boolean;

  type theoryType = keyof typeof jsonData.theories;
  type stratType = {
    [key in theoryType]: keyof (typeof jsonData.theories)[key]["strats"];
  };

  type TheoryDataStructure = {
    [key: string]: {
      tauFactor: number;
      UI_visible?: boolean;
      strats: {
        [key: string]: {
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

  type SingleSimQuery = BaseSimQuery & {
    queryType: "single";
    theory: theoryType;
    strat: string;
    rho: number;
    cap?: number;
    lastStrat?: string;
  }

  type ChainSimQuery = BaseSimQuery & {
    queryType: "chain";
    theory: theoryType;
    strat: string;
    rho: number;
    cap: number;
    hardCap: boolean;
  }

  type StepSimQuery = BaseSimQuery & {
    queryType: "step";
    theory: theoryType;
    strat: string;
    rho: number;
    cap: number;
    step: number;
  }

  type SimAllQuery = BaseSimQuery & {
    queryType: "all";
    values: number[];
    veryActive: boolean;
    semiIdle: boolean;
    stratType: SettingsSimAllStratsMode;
  }

  type SimQuery = SingleSimQuery | ChainSimQuery | StepSimQuery | SimAllQuery;

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

  type SimResponse = SingleSimResponse | ChainSimResponse | StepSimResponse | SimAllResponse;

  interface varBuy {
    variable: string;
    level: number;
    cost: number;
    symbol?: string;
    timeStamp: number;
  }

  interface theoryData {
    theory: theoryType;
    sigma: number;
    rho: number;
    strat: string;
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
    theme: string;
    simAllStrats: SettingsSimAllStratsMode;
    completedCTs: SettingsCompletedCTsMode;
    showA23: boolean;
    showUnofficials: boolean;
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
