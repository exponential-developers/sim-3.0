import jsonData from "../Data/data.json" assert { type: "json" };
import { global } from "./main.js";

const stratData = convertConditions(structuredClone(jsonData.theories) as unknown as theoryDataType);

type args = [boolean, boolean, boolean, boolean, number, string];

type conditionFunctions = (...args: args) => boolean;

type stratDataType = {
  [key: string]: {
    stratFilterCondition: conditionFunctions;
    forcedCondition: conditionFunctions;
  };
};

type theoryDataType = {
  [key: string]: { strats: stratDataType; tauFactor?: number };
};

function convertConditions(theoryData: theoryDataType) {
  for (const theory of Object.keys(theoryData)) {
    delete theoryData[theory].tauFactor;
    for (const strat of Object.keys(theoryData[theory].strats)) {
      theoryData[theory].strats[strat].stratFilterCondition = Function(parseExpression(<string>(<unknown>theoryData[theory].strats[strat].stratFilterCondition))) as conditionFunctions;
      theoryData[theory].strats[strat].forcedCondition = Function(parseExpression(<string>(<unknown>theoryData[theory].strats[strat].forcedCondition))) as conditionFunctions;
    }
  }
  return theoryData;
}

function parseExpression(expression: string) {
  if (!expression) return "return true";
  expression = expression.replace(/-/g, "_");
  expression = expression.toLowerCase();
  expression = expression.replace(/very_active/g, "arguments[0]");
  expression = expression.replace(/active/g, "arguments[1]");
  expression = expression.replace(/semi_idle/g, "arguments[2]");
  expression = expression.replace(/idle/g, "arguments[3]");
  expression = expression.replace(/rho/g, "arguments[4]");
  expression = expression.replace(/laststrat/g, "arguments[5]");
  return `return ${expression}`;
}

export function getStrats(theory: theoryType, rho: number, type: string, lastStrat: string): string[] {
  const res = [];
  const args = [...jsonData.stratCategories.map((v) => v === type), rho, lastStrat] as args;
  for (const strat of Object.keys(stratData[theory].strats)) {
    if ((stratData[theory].strats[strat].stratFilterCondition(...args) || !global.stratFilter) && stratData[theory].strats[strat].forcedCondition(...args)) res.push(strat);
  }
  return res;
}
