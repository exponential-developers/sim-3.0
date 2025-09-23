import { findIndex } from "../Utils/helpers";
import { qs, qsa, event, ce, removeAllChilds } from "../Utils/DOMhelpers";
import data from "../Data/data.json" assert { type: "json" };
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
const theorySelector = qs<HTMLSelectElement>(".theory");
const stratSelector = qs<HTMLSelectElement>(".strat");
const capInputWrapper = qs(".capWrapper");
const modeSelector = qs<HTMLSelectElement>(".mode");
const modeInput = <HTMLInputElement>qs("textarea");
const hardCapWrapper = qs(".hardCapWrapper");
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


const theories = Object.keys(data.theories) as theoryType[];

/** Populates a select element with the given items */
function populateSelectElement(select: HTMLSelectElement, items: string[], clear = true) {
  if (clear) removeAllChilds(select);
  for (let item of items) {
    const option = ce<HTMLOptionElement>("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  }
}
function populateTheoryList(showUnofficials: boolean) {
  populateSelectElement(theorySelector, theories.filter((item) => (data.theories as TheoryDataStructure)[item].UI_visible !== false || showUnofficials))
}

//Renders theories, strats and modes options on page load

populateSelectElement(themeSelector, data.themes);
event(themeSelector, "change", themeUpdate);

getSimState();

populateSelectElement(modeSelector, data.modes);
modeUpdate();
event(modeSelector, "input", modeUpdate);

populateTheoryList(showUnofficials.checked);
theoryUpdate();
event(theorySelector, "change", theoryUpdate);

event(showUnofficials, "click", () => {
    populateTheoryList(showUnofficials.checked);
    theoryUpdate();
});

function modeUpdate(): void {
  singleInput.style.display = "none";
  extraInputs.style.display = "none";
  timeDiffWrapper.style.display = "none";
  hardCapWrapper.style.display = "none";
  simAllInputs.style.display = "none";
  modeInputDescription.style.display = "inline";
  modeInput.style.height = "1.8em";
  modeInput.style.width = "6rem";
  capInputWrapper.style.display = "none";
  if (modeSelector.value === "Chain" || modeSelector.value === "Steps") {
    capInputWrapper.style.display = "inline";
  }
  if (modeSelector.value !== "Single sim" && modeSelector.value !== "Time diff." && modeSelector.value !== "Chain") extraInputs.style.display = "flex";
  if (modeSelector.value === "Time diff.") timeDiffWrapper.style.display = "grid";
  if (modeSelector.value !== "All" && modeSelector.value !== "Time diff.") singleInput.style.display = "grid";
  if (modeSelector.value === "Chain") hardCapWrapper.style.display = "block";
  if (modeSelector.value === "All") {
    simAllInputs.style.display = "grid";
    modeInputDescription.style.display = "none";
    modeInput.style.height = "4rem";
    modeInput.style.width = "20rem";
  }
  modeInput.placeholder = data.modeInputPlaceholder[findIndex(data.modes, modeSelector.value)];
  modeInputDescription.textContent = data.modeInputDescriptions[findIndex(data.modes, modeSelector.value)];
}

function theoryUpdate() {
  const currentTheory = theorySelector.value as theoryType;
  const currentTheoryStrats = Object.keys(data.theories[currentTheory].strats).filter(
    (strat) => (data.theories as TheoryDataStructure)[currentTheory].strats[strat].UI_visible !== false
  );
  populateSelectElement(stratSelector, data.stratCategories.concat(currentTheoryStrats));
}

function themeUpdate() {
  const root = document.documentElement;
  root.setAttribute("theme", themeSelector.value);
}
