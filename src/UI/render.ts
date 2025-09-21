import { findIndex } from "../Utils/helpers";
import { qs, qsa, event, ce } from "../Utils/DOMhelpers";
import data from "../Data/data.json" assert { type: "json" };
import { global } from "../Sim/main";
import { updateTimeDiffTable } from "../Sim/parsers";
import { getSimState } from "./simState";

type TheoryDataStructure = {
  [key in theoryType]: {
    tauFactor: number,
    UI_visible?: boolean,
    strats: {
      [key: string]: {
        UI_visible?: boolean;
      }
    }
  };
}

//Inputs
const theory = qs<HTMLSelectElement>(".theory");
const strat = qs<HTMLSelectElement>(".strat");
const cap = qs(".capWrapper");
const mode = qs<HTMLSelectElement>(".mode");
const modeInput = <HTMLInputElement>qs("textarea");
const hardCap = qs(".hardCapWrapper");
const semi_idle = qs<HTMLInputElement>(".semi-idle");
const hard_active = qs<HTMLInputElement>(".hard-active");
const timeDiffInputs = qsa<HTMLInputElement>(".timeDiffInput");
const themeSelector = qs<HTMLSelectElement>(".themeSelector");
const showUnofficials = qs<HTMLInputElement>(".unofficials");

//Other containers/elements
const extraInputs = qs(".extraInputs");
const timeDiffWrapper = qs(".timeDiffWrapper");
const singleInput = qsa(".controls")[0];
const simAllInputs = qs(".simAllInputs");
const modeInputDescription = qs(".extraInputDescription");


//Renders theories, strats and modes options on page load

const theories = Object.keys(data.theories) as theoryType[];

/** Populates a select element with the given items */
function populateSelectElement(select: HTMLSelectElement, items: string[]) {
  while (select.firstChild) select.firstChild.remove();
  for (let item of items) {
    const option = ce<HTMLOptionElement>("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  }
}
function populateTheoryList(showUnofficials: boolean) {
  populateSelectElement(theory, theories.filter((item) => (data.theories as TheoryDataStructure)[item].UI_visible !== false || showUnofficials))
}

populateSelectElement(themeSelector, data.themes);
event(themeSelector, "change", themeUpdate);

getSimState();

populateSelectElement(mode, data.modes);
modeUpdate();
event(mode, "input", modeUpdate);

populateTheoryList(global.showUnofficials);
theoryUpdate();
event(theory, "change", theoryUpdate);

const simAllSettings: [boolean, boolean] = JSON.parse(localStorage.getItem("simAllSettings") ?? "[true, false]");
semi_idle.checked = simAllSettings[0];
hard_active.checked = simAllSettings[1];

for (const elem of timeDiffInputs) {
  event(elem, "input", () => {
    updateTimeDiffTable();
  });
}

event(showUnofficials, "click", () => {
  if (global.showUnofficials != showUnofficials.checked)
  {
    global.showUnofficials = showUnofficials.checked;
    populateTheoryList(global.showUnofficials);
    theoryUpdate();
  }
});

function modeUpdate(): void {
  singleInput.style.display = "none";
  extraInputs.style.display = "none";
  timeDiffWrapper.style.display = "none";
  hardCap.style.display = "none";
  simAllInputs.style.display = "none";
  modeInputDescription.style.display = "inline";
  modeInput.style.height = "1.8em";
  modeInput.style.width = "6rem";
  cap.style.display = "none";
  if (mode.value === "Chain" || mode.value === "Steps") {
    cap.style.display = "inline";
  }
  if (mode.value !== "Single sim" && mode.value !== "Time diff." && mode.value !== "Chain") extraInputs.style.display = "flex";
  if (mode.value === "Time diff.") timeDiffWrapper.style.display = "grid";
  if (mode.value !== "All" && mode.value !== "Time diff.") singleInput.style.display = "grid";
  if (mode.value === "Chain") hardCap.style.display = "block";
  if (mode.value === "All") {
    simAllInputs.style.display = "grid";
    modeInputDescription.style.display = "none";
    modeInput.style.height = "4rem";
    modeInput.style.width = "20rem";
  }
  modeInput.placeholder = data.modeInputPlaceholder[findIndex(data.modes, mode.value)];
  modeInputDescription.textContent = data.modeInputDescriptions[findIndex(data.modes, mode.value)];
}

function theoryUpdate() {
  while (strat.firstChild) strat.firstChild.remove();
  for (let i = 0; i < 4; i++) {
    const option = ce<HTMLSelectElement>("option");
    option.value = data.stratCategories[i];
    option.textContent = data.stratCategories[i];
    strat.appendChild(option);
  }
  const currentTheory = theory.value as theoryType;
  const strats = Object.keys(data.theories[currentTheory].strats);
  for (let i = 0; i < strats.length; i++) {
    if ((data.theories as TheoryDataStructure)[currentTheory].strats[strats[i]].UI_visible === false) continue;
    const option = ce<HTMLSelectElement>("option");
    option.value = strats[i];
    option.textContent = strats[i];
    strat.appendChild(option);
  }
}

function themeUpdate() {
  const root = document.documentElement;
  root.setAttribute("theme", themeSelector.value);
}
