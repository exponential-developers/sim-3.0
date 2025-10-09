import jsonData from "../Data/data.json" assert { type: "json" };
import { global } from "./main";

const stratConditionArgs = ["very_active", "active", "semi_idle", "idle", "rho", "laststrat"];

type stratConditionFunction = (
  very_active: boolean,
  active: boolean,
  semi_idle: boolean,
  idle: boolean,
  rho: number,
  laststrat: string
) => boolean;

type TheoryStratDataType = { 
  strats: {
    [key: string]: {
      stratFilterCondition: stratConditionFunction;
      forcedCondition: stratConditionFunction;
    };
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
    for (const strat of Object.keys(theoryData[theory].strats)) {
      currentTheory.strats[strat] = {
        stratFilterCondition: Function(...stratConditionArgs, parseExpression(theoryData[theory].strats[strat].stratFilterCondition)) as stratConditionFunction,
        forcedCondition: Function(...stratConditionArgs, parseExpression(theoryData[theory].strats[strat].forcedCondition ?? "")) as stratConditionFunction
      }
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

export function getStrats(theory: theoryType, rho: number, type: string, lastStrat: string): string[] {
  const strats = [];
  const args = [...jsonData.stratCategories.map((v) => v === type), rho, lastStrat] as [boolean, boolean, boolean, boolean, number, string];
  for (const strat of Object.keys(stratData[theory].strats)) {
    if (
      (stratData[theory].strats[strat].stratFilterCondition(...args) || !global.stratFilter) 
      && stratData[theory].strats[strat].forcedCondition(...args)
    ) strats.push(strat);
  }
  return strats;
}
