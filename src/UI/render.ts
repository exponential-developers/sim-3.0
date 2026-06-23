import data from "../Data/data.json" with { type: "json" };
import { findIndex, getIndexFromTheory } from "../Utils/helpers";
import { event, ce, removeAllChilds } from "../Utils/DOMhelpers";
import { getSimState } from "./simState";
import UI from "./elements";

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
  populateSelectElement(UI.controls.theorySelector, theories.filter(theory => 
    (data.theories as TheoryDataStructure)[theory].UI_visible !== false || showUnofficials));
}

//Renders theories, strats and modes options on page load

populateSelectElement(UI.settings.themeSelector, data.themes);
event(UI.settings.themeSelector, "change", themeUpdate);

getSimState();

populateSelectElement(UI.controls.modeSelector, data.modes);
modeUpdate();
event(UI.controls.modeSelector, "input", modeUpdate);

populateTheoryList(UI.settings.showUnofficials.checked);
theoryUpdate();
event(UI.controls.theorySelector, "change", theoryUpdate);

event(UI.settings.showUnofficials, "click", () => {
    populateTheoryList(UI.settings.showUnofficials.checked);
    theoryUpdate();
});

function populateSingleSimFields(rewriteCurrency: boolean = false): void {
  // Sigma field
  const splits = UI.controls.simAllInputArea.value.replace("\n", "").split(" ").filter(s => s != "")

  if (UI.controls.sigmaInput.value == "" && splits.length > 0) {
    const match = splits[0].match(/^\d+$/g);
    if (match) {
      UI.controls.sigmaInput.value = match[0];
    }
  }

  if ((UI.controls.currencyInput.value == "" || rewriteCurrency) && UI.controls.theorySelector.value && splits.length > 1) {
    const theoryIndex = getIndexFromTheory(UI.controls.theorySelector.value);
    if (splits.length > theoryIndex + 1) {
      const str = splits[theoryIndex + 1];
      const match = str.match(/^e?\d+(\.\d+)?[rtm]?$/) || str.match(/^\d+(\.\d+)?e\d+[rtm]?$/);
      if (match) {
        UI.controls.currencyInput.value = /[rtm]/.test(str) ? str : str.concat("t");
      }
    }
    else if (rewriteCurrency) {
      UI.controls.currencyInput.value = "";
    }
  }
}

function modeUpdate(): void {
  const newMode = UI.controls.modeSelector.value;

  UI.controls.baseWrapper.style.display = "none";
  UI.controls.capInputWrapper.style.display = "none";
  UI.controls.hardCapWrapper.style.display = "none";

  UI.controls.stratSelectorWrapper.style.display = "none";
  UI.controls.extraInputWrapper.style.display = "none";
  UI.controls.simAllInputWrapper.style.display = "none";
  UI.controls.simAllInputArea.style.display = "none";
  UI.controls.extraInputDesc.style.display = "inline";
  UI.controls.extraInput.style.display = "none";
  UI.controls.timeDiffWrapper.style.display = "none";

  // Displays the strat selector
  if (newMode !== "Comparison") UI.controls.stratSelectorWrapper.style.display = "block";
  // Displays the single-theory inputs
  if (newMode !== "All" && newMode !== "Time diff.") UI.controls.baseWrapper.style.display = "grid";
  // Displays the cap input for chain/steps mode
  if (newMode === "Chain" || newMode === "Steps" || newMode === "StepChain") UI.controls.capInputWrapper.style.display = "inline";
  // Displays the hard cap input
  if (newMode === "Chain" || newMode == "StepChain" /*|| newMode == "Time"*/) UI.controls.hardCapWrapper.style.display = "block";

  // Extra Inputs
  if (newMode !== "Single sim" && newMode !== "Comparison" && newMode !== "Time diff." && newMode !== "Chain") UI.controls.extraInputWrapper.style.display = "flex";
  if (newMode === "All") {
    UI.controls.simAllInputWrapper.style.display = "grid";
    UI.controls.extraInputDesc.style.display = "none";
    UI.controls.simAllInputArea.style.display = "block";
    UI.controls.simAllInputArea.placeholder = data.modeInputPlaceholder[0];
  }
  else {
    UI.controls.extraInput.style.display = "block";
  }
  UI.controls.extraInputDesc.textContent = data.modeInputDescriptions[findIndex(data.modes, newMode)];
  UI.controls.extraInput.placeholder = data.modeInputPlaceholder[findIndex(data.modes, newMode)];
  
  if (newMode === "Time diff.") UI.controls.timeDiffWrapper.style.display = "grid";

  populateSingleSimFields();
}

function theoryUpdate() {
  const currentTheory = UI.controls.theorySelector.value as theoryType;
  const currentTheoryStrats = Object.keys(data.theories[currentTheory].strats).filter(
    (strat) => (data.theories as TheoryDataStructure)[currentTheory].strats[strat].UI_visible !== false
  );
  populateSelectElement(UI.controls.stratSelector, data.stratCategories.concat(currentTheoryStrats));
  populateSingleSimFields(true);
}

function themeUpdate() {
  const root = document.documentElement;
  root.setAttribute("theme", UI.settings.themeSelector.value);
}
