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

type TheorySingleStratDataType = {
  stratFilterCondition: stratConditionFunction;
  forcedCondition: stratConditionFunction;
  subStrats: {
    [key: string]: {
      stratFilterCondition: stratConditionFunction;
      forcedCondition: stratConditionFunction;
    };
  };
};

type TheoryStratDataType = { 
  strats: {
    [key: string]: TheorySingleStratDataType
  };
};

type StratsDataType = {
  [key: string]: TheoryStratDataType
};

const stratData = convertConditions(structuredClone(jsonData.theories) as TheoryDataStructure);

function convertConditions(theoryData: TheoryDataStructure): StratsDataType {
  let returnedData: StratsDataType = {};
  for (const theory of Object.keys(theoryData)) {
    let currentTheory: TheoryStratDataType = {
      strats: {}
    };
    const baseStrats = theoryData[theory].strats;
    for (const strat of Object.keys(baseStrats)) {
      let currentStrat: TheorySingleStratDataType = {
        stratFilterCondition: Function(
          ...stratConditionArgs,
          parseExpression(baseStrats[strat].stratFilterCondition)
        ) as stratConditionFunction,
        forcedCondition: Function(
          ...stratConditionArgs,
          parseExpression(baseStrats[strat].forcedCondition ?? "")
        ) as stratConditionFunction,
        subStrats: {}
      }

      const subStrats = baseStrats[strat].subStrats ?? Object.fromEntries([[strat, {stratFilterCondition: "true", forcedCondition: ""}]]);
      for (const subStrat of Object.keys(subStrats)) {
        currentStrat.subStrats[subStrat] = {
          stratFilterCondition: Function(
            ...stratConditionArgs,
            parseExpression(subStrats[subStrat].stratFilterCondition)
          ) as stratConditionFunction,
          forcedCondition: Function(
            ...stratConditionArgs,
            parseExpression(subStrats[subStrat].forcedCondition ?? "")
          ) as stratConditionFunction
        }
      }
      
      currentTheory.strats[strat] = currentStrat;
    }
    returnedData[theory] = currentTheory;
  }
  return returnedData;
}

function parseExpression(expression: string) {
  if (!expression) return "return true";
  expression = expression.replace(/-/g, "_");
  expression = expression.toLowerCase();
  return `return ${expression}`;
}

export function getStrats(theory: theoryType, rho: number, type: string, lastStrat: string, stratFilter = true): {strat: string, subStrat: string}[] {
  const strats = [];
  const args = [...jsonData.stratCategories.map((v) => v === type), rho, lastStrat] as [boolean, boolean, boolean, boolean, number, string];
  const baseStrats = stratData[theory].strats;
  for (const strat of Object.keys(baseStrats)) {
    if (
      (baseStrats[strat].stratFilterCondition(...args) || !stratFilter) 
      && baseStrats[strat].forcedCondition(...args)
    ) {
      const subStrats = baseStrats[strat].subStrats;
      for (const subStrat of Object.keys(subStrats)) {
        if (
          (subStrats[subStrat].stratFilterCondition(...args) || !stratFilter) 
          && subStrats[subStrat].forcedCondition(...args)
        ) strats.push({strat: strat, subStrat: subStrat});
      }
      
    }
  }
  return strats;
}

export function getSubStrats(theory: theoryType, baseStrat: string, rho: number, type: string, lastStrat: string, stratFilter = true): {strat: string, subStrat: string}[] {
  const strats = [];
  const args = [...jsonData.stratCategories.map((v) => v === type), rho, lastStrat] as [boolean, boolean, boolean, boolean, number, string];
  const subStrats = stratData[theory].strats[baseStrat].subStrats;
  for (const subStrat of Object.keys(subStrats)) {
    if (
      (subStrats[subStrat].stratFilterCondition(...args) || !stratFilter) 
      && subStrats[subStrat].forcedCondition(...args)
    ) strats.push({strat: baseStrat, subStrat: subStrat});
  }
  return strats;
}
