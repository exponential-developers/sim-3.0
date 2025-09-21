import jsonData from "../../Data/data.json" assert { type: "json" };
import { inputData } from "../main";
import { getTheoryFromIndex } from "../../Utils/helpers";

export function parseSimParams(params: string[]) {
  if (params.length < 3) throw "At least 3 parameters [strat, sigma, start rho] required.";
  params = params.map((elem) => elem.replace(/ /g, ""));

  const data: inputData = {
    theory: "T1",
    strat: "",
    sigma: "",
    rho: "",
    cap: "",
    mode: "Single sim",
    modeInput: "",
    simAllInputs: [true, true],
    timeDiffInputs: [],
    hardCap: false,
  };

  const s01 = params[0].slice(0, 2).toLowerCase();
  const s2e = params[0].slice(2, params[0].length);
  if (["bo", "ba", "bs", "bi"].includes(s01)) {
    data.theory = /[1-8]/.test(s2e) ? getTheoryFromIndex(parseInt(s2e) - 1) : (s2e.toUpperCase() as theoryType);
    switch (s01) {
      case "bo":
        data.strat = "Best Overall";
        break;
      case "ba":
        data.strat = "Best Active";
        break;
      case "bs":
        data.strat = "Best Semi-Idle";
        break;
      case "bi":
        data.strat = "Best Idle";
        break;
    }
  } else {
    let index = -1;
    for (let i = 0; i < Object.keys(jsonData.theories).length; i++) {
      if (new RegExp(getTheoryFromIndex(i)).test(params[0].toUpperCase())) {
        data.theory = getTheoryFromIndex(i);
        index = i;
      }
    }
    for (let i = 0; i < Object.keys(jsonData.theories[getTheoryFromIndex(index)].strats).length; i++) {
      const strat = Object.keys(jsonData.theories[getTheoryFromIndex(index)].strats)[i];
      if (params[0].toLowerCase() === strat.toLowerCase()) data.strat = strat;
    }
  }

  data.sigma = params[1];

  if (/[+=]/.test(params[2])) {
    const split = params[2].split("+=");
    data.rho = split[0];
    data.modeInput = split[1];
    data.mode = "Steps";
  } else data.rho = params[2];

  if (params.length > 3 && params[3].length !== 0) {
    data.cap = params[3];
    data.mode = data.mode === "Single sim" ? "Chain" : data.mode;
  }

  return data;
}
