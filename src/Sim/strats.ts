import jsonData from "../Data/data.json" with { type: "json" };

const stratConditionArgs = ["very_active", "active", "semi_idle", "idle", "rho", "laststrat"];

type stratConditionFunction = (
  very_active: boolean,
  active: boolean,
  semi_idle: boolean,
  idle: boolean,
  rho: number,
  laststrat: string
) => boolean;

type TheoryStratDataType<T extends theoryType> = { 
  strats: {
    [key in stratType[T]]: {
      stratFilterCondition: stratConditionFunction;
      forcedCondition: stratConditionFunction;
    };
  };
};

type StratsDataType = {
  [key in theoryType]: TheoryStratDataType<key>
};

const stratData = convertConditions(structuredClone(jsonData.theories) as TheoryDataStructure);

function buildTheoryStratFilters<T extends theoryType>(
  theoryData: TheoryDataStructure[T]
): TheoryStratDataType<T> {
  const strats: Record<string, any> = {};
  for (const strat of (Object.keys(theoryData.strats) as stratType[T][])) {
    strats[strat] = {
      stratFilterCondition: Function(...stratConditionArgs, parseExpression(theoryData.strats[strat].stratFilterCondition)) as stratConditionFunction,
      forcedCondition: Function(...stratConditionArgs, parseExpression(theoryData.strats[strat].forcedCondition ?? "")) as stratConditionFunction
    }
  }
  return { strats } as TheoryStratDataType<T>;
}

function convertConditions(theoryData: TheoryDataStructure): StratsDataType {
  const returnedData: Record<theoryType, any> = {} as any;
  for (const theory of (Object.keys(theoryData) as theoryType[])) {
    returnedData[theory] = buildTheoryStratFilters(theoryData[theory]);
  }
  return returnedData as StratsDataType;
}

function parseExpression(expression: string) {
  if (!expression) return "return true";
  expression = expression.replace(/-/g, "_");
  expression = expression.toLowerCase();
  return `return ${expression}`;
}

export function getStrats<T extends theoryType>(theory: T, rho: number, type: string, lastStrat: string, stratFilter = true): stratType[T][] {
  const strats: stratType[T][] = [];
  const args = [...jsonData.stratCategories.map((v) => v === type), rho, lastStrat] as [boolean, boolean, boolean, boolean, number, string];
  for (const strat of (Object.keys(stratData[theory].strats) as stratType[T][])) {
    if (
      (stratData[theory].strats[strat].stratFilterCondition(...args) || !stratFilter) 
      && stratData[theory].strats[strat].forcedCondition(...args)
    ) strats.push(strat);
  }
  return strats;
}
