import data from "../Data/data.json" assert { type: "json" };
import { findIndex, getIndexFromTheory } from "../Utils/helpers";
import { qs, qsa, event, ce, removeAllChilds } from "../Utils/DOMhelpers";
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
const sigmaInput = qs<HTMLInputElement>(".sigma");
const currencyInput = qs<HTMLInputElement>(".input");
const simAllInputArea = qs<HTMLTextAreaElement>(".simAllInputArea")
const modeInput = qs<HTMLTextAreaElement>(".modeInput");
const hardCapWrapper = qs(".hardCapWrapper");
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
  populateSelectElement(theorySelector, theories.filter(theory => 
    (data.theories as TheoryDataStructure)[theory].UI_visible !== false || showUnofficials));
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

function populateSingleSimFields(rewriteCurrency: boolean = false): void {
  // Sigma field
  const splits = simAllInputArea.value.replace("\n", "").split(" ").filter(s => s != "")

  if (sigmaInput.value == "" && splits.length > 0) {
    const match = splits[0].match(/^\d+$/g);
    if (match) {
      sigmaInput.value = match[0];
    }
  }

  if ((currencyInput.value == "" || rewriteCurrency) && theorySelector.value) {
    const theoryIndex = getIndexFromTheory(theorySelector.value);
    if (splits.length > theoryIndex + 1) {
      const str = splits[theoryIndex + 1];
      const match = str.match(/^e?\d+(\.\d+)?[rtm]?$/) || str.match(/^\d+(\.\d+)?e\d+[rtm]?$/);
      if (match) {
        currencyInput.value = /[rtm]/.test(str) ? str : str.concat("t");
      }
    }
    else if (rewriteCurrency) {
      currencyInput.value = "";
    }
  }
}

function modeUpdate(): void {
  const newMode = modeSelector.value;

  singleInput.style.display = "none";
  capInputWrapper.style.display = "none";
  hardCapWrapper.style.display = "none";

  extraInputs.style.display = "none";
  simAllInputs.style.display = "none";
  simAllInputArea.style.display = "none";
  modeInputDescription.style.display = "inline";
  modeInput.style.display = "none";
  timeDiffWrapper.style.display = "none";

  // Displays the single-theory inputs
  if (newMode !== "All" && newMode !== "Time diff.") singleInput.style.display = "grid";
  // Displays the cap input for chain/steps mode
  if (newMode === "Chain" || newMode === "Steps") capInputWrapper.style.display = "inline";
  // Displays the hard cap input
  if (newMode === "Chain") hardCapWrapper.style.display = "block";

  // Extra Inputs
  if (newMode !== "Single sim" && newMode !== "Time diff." && newMode !== "Chain") extraInputs.style.display = "flex";
  if (newMode === "All") {
    simAllInputs.style.display = "grid";
    modeInputDescription.style.display = "none";
    simAllInputArea.style.display = "block";
    simAllInputArea.placeholder = data.modeInputPlaceholder[0];
  }
  else {
    modeInput.style.display = "block";
  }
  modeInputDescription.textContent = data.modeInputDescriptions[findIndex(data.modes, newMode)];
  modeInput.placeholder = data.modeInputPlaceholder[findIndex(data.modes, newMode)];
  
  if (newMode === "Time diff.") timeDiffWrapper.style.display = "grid";

  populateSingleSimFields();
}

function theoryUpdate() {
  const currentTheory = theorySelector.value as theoryType;
  const currentTheoryStrats = Object.keys(data.theories[currentTheory].strats).filter(
    (strat) => (data.theories as TheoryDataStructure)[currentTheory].strats[strat].UI_visible !== false
  );
  populateSelectElement(stratSelector, data.stratCategories.concat(currentTheoryStrats));
  populateSingleSimFields(true);
}

function themeUpdate() {
  const root = document.documentElement;
  root.setAttribute("theme", themeSelector.value);
}
