import data from "../Data/data.json" with { type: "json" };
import { findIndex, getIndexFromTheory } from "../Utils/helpers";
import { event, ce, removeAllChilds, hide, show } from "../Utils/DOMhelpers";
import { getSimState } from "./simState";
import UI from "./elements";

const theories = Object.keys(data.theories) as theoryType[];
const theoryData = data.theories as TheoryDataStructure;

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
    theoryData[theory].UI_visible !== false || showUnofficials));
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

function createSpecificInputForTheory(theory: theoryType) {
  const inputs = theoryData[theory].theorySpecificInputs;
  if (inputs) {
    for (let input of inputs) {
      const div = ce<HTMLDivElement>("div");
      div.innerHTML = `
          <span class="inputLabel">${input}: </span>
          <input type="text" spellcheck="false" theory="${theory}"/>
      `;
      div.setAttribute("theory", theory);
      UI.controls.theorySpecificInputWrapper.appendChild(div);
    }
  }
}

function updateTheorySpecificInputs(): void {
  removeAllChilds(UI.controls.theorySpecificInputWrapper);
  if (UI.controls.modeSelector.value === "Single sim") {
    const currentTheory = UI.controls.theorySelector.value as theoryType;
    createSpecificInputForTheory(currentTheory);
  }
}

function modeUpdate(): void {
  const newMode = UI.controls.modeSelector.value;

  hide(UI.controls.baseWrapper);
  hide(UI.controls.capInputWrapper);
  hide(UI.controls.hardCapWrapper);

  hide(UI.controls.stratSelectorWrapper);
  hide(UI.controls.extraInputWrapper)
  hide(UI.controls.simAllInputWrapper);
  hide(UI.controls.simAllInputArea);
  show(UI.controls.extraInputDesc);
  hide(UI.controls.extraInput);
  hide(UI.controls.timeDiffWrapper);

  // Displays the strat selector
  if (newMode !== "Comparison") show(UI.controls.stratSelectorWrapper);
  // Displays the single-theory inputs
  if (newMode !== "All" && newMode !== "Time diff.") show(UI.controls.baseWrapper);
  // Displays the cap input for chain/steps mode
  if (newMode === "Chain" || newMode === "Steps" || newMode === "StepChain") show(UI.controls.capInputWrapper);
  // Displays the hard cap input
  if (newMode === "Chain" || newMode == "StepChain" /*|| newMode == "Time"*/) show(UI.controls.hardCapWrapper);

  // Extra Inputs
  if (newMode !== "Single sim" && newMode !== "Comparison" && newMode !== "Time diff." && newMode !== "Chain") 
    show(UI.controls.extraInputWrapper)
  if (newMode === "All") {
    show(UI.controls.simAllInputWrapper);
    hide(UI.controls.extraInputDesc);
    show(UI.controls.simAllInputArea);
    UI.controls.simAllInputArea.placeholder = data.modeInputPlaceholder[0];
  }
  else {
    show(UI.controls.extraInput);
  }
  UI.controls.extraInputDesc.textContent = data.modeInputDescriptions[findIndex(data.modes, newMode)];
  UI.controls.extraInput.placeholder = data.modeInputPlaceholder[findIndex(data.modes, newMode)];
  
  if (newMode === "Time diff.") show(UI.controls.timeDiffWrapper);

  populateSingleSimFields();
  updateTheorySpecificInputs();
}

function theoryUpdate() {
  const currentTheory = UI.controls.theorySelector.value as theoryType;
  const currentTheoryStrats = Object.keys(data.theories[currentTheory].strats).filter(
    (strat) => theoryData[currentTheory].strats[strat].UI_visible !== false
  );
  populateSelectElement(UI.controls.stratSelector, data.stratCategories.concat(currentTheoryStrats));
  populateSingleSimFields(true);
  updateTheorySpecificInputs();
}

function themeUpdate() {
  const root = document.documentElement;
  root.setAttribute("theme", UI.settings.themeSelector.value);
}
