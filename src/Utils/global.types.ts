import jsonData from "../Data/data.json" assert { type: "json" };

declare global {
  type theoryType = keyof typeof jsonData.theories;
  type stratType = {
    [key in theoryType]: keyof (typeof jsonData.theories)[key]["strats"];
  };

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
    recursionValue: null | number | Array<number>;
  }

  type combinedResult = [string, string, string];

  interface simResult {
    theory: string;
    sigma: number;
    lastPub: string;
    pubRho: string;
    deltaTau: string;
    pubMulti: string;
    strat: string;
    tauH: number;
    time: string;
    rawData: { pubRho: number; time: number };
    boughtVars: Array<varBuy>;
  }

  interface simAllResult {
    theory: string;
    ratio: string;
    lastPub: string;
    active: simResult;
    idle: simResult;
  }

  type generalResult = simResult | combinedResult | simAllResult;
}
