import data from "../Data/data.json" with { type: "json" };
import { findIndex, getIndexFromTheory, getTheories } from "../Utils/helpers";
import { event, ce, removeAllChilds, hide, show } from "../Utils/DOMhelpers";
import { getSimState } from "./simState";
import UI from "./elements";
import { generateSpecificInputWidgetWrapper } from "./specificInputs";

const theories = getTheories();
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

function populateSpecificInputsForTheory<T extends theoryType>(theory: T, container: HTMLElement, allMode: boolean = false) {
  if (theoryData[theory].specificInputs) {
    for (let inputId of Object.keys(theoryData[theory].specificInputs) as SpecificInputOf[T][]) {
      let div = generateSpecificInputWidgetWrapper(theory, inputId, theoryData[theory].specificInputs[inputId], allMode);
      container.appendChild(div);
    }
  }
}
function populateStratSpecificInputsForTheory<T extends theoryType, S extends stratType[T]>(
  theory: T,
  strat: S,
  container: HTMLElement
) {
  if (!theoryData[theory].strats[strat]?.specificInputs) return;
  for (let inputId of Object.keys(theoryData[theory].strats[strat].specificInputs) as StratSpecificInputOf[T][S][]) {
    let input = theoryData[theory].strats[strat].specificInputs[inputId];
    if (input === null) {
      if (!theoryData[theory].stratSpecificInputs?.[inputId]) {
        console.warn(`Could not find strat specific input with id '${inputId}'`);
        continue;
      }
      input = theoryData[theory].stratSpecificInputs[inputId];
    }
    let div = generateSpecificInputWidgetWrapper(theory, inputId, input, false);
    container.appendChild(div);
  }
}

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
  hide(UI.controls.specificInputsMenuButtonWrapper);
  hide(UI.controls.specificInputsWrapper);
  hide(UI.controls.stratSpecificInputsWrapper);

  // Displays the strat selector
  if (newMode !== "Comparison") show(UI.controls.stratSelectorWrapper);
  // Displays the single-theory inputs
  if (newMode !== "All" && newMode !== "Time diff.") show(UI.controls.baseWrapper);
  // Displays the cap input for chain/steps mode
  if (newMode === "Chain" || newMode === "Steps" || newMode === "StepChain" || newMode == "Pub Table") show(UI.controls.capInputWrapper);
  // Displays the hard cap input
  if (newMode === "Chain" || newMode == "StepChain" /*|| newMode == "Time"*/) show(UI.controls.hardCapWrapper);

  console.log(newMode)
  // Extra Inputs
  if (newMode !== "Single sim" && newMode !== "Comparison" && newMode !== "Time diff." && newMode !== "Chain")
    show(UI.controls.extraInputWrapper)
  if (newMode === "All") {
    show(UI.controls.simAllInputWrapper);
    hide(UI.controls.extraInputDesc);
    show(UI.controls.simAllInputArea);
    show(UI.controls.specificInputsMenuButtonWrapper);
    UI.controls.simAllInputArea.placeholder = data.modeInputPlaceholder[0];
  }
  else {
    show(UI.controls.extraInput);
    show(UI.controls.specificInputsWrapper);
    if (newMode !== "Comparison") show(UI.controls.stratSpecificInputsWrapper);
  }
  UI.controls.extraInputDesc.textContent = data.modeInputDescriptions[findIndex(data.modes, newMode)];
  UI.controls.extraInput.placeholder = data.modeInputPlaceholder[findIndex(data.modes, newMode)];

  if (newMode === "Time diff.") show(UI.controls.timeDiffWrapper);

  populateSingleSimFields();
}

function theoryUpdate<T extends theoryType>() {
  const currentTheory = UI.controls.theorySelector.value as T;
  const currentTheoryStrats = (Object.keys(data.theories[currentTheory].strats) as stratType[T][]).filter(
    (strat) => (data.theories as TheoryDataStructure)[currentTheory].strats[strat].UI_visible !== false
  );
  populateSelectElement(UI.controls.stratSelector, data.stratCategories.concat(currentTheoryStrats));
  populateSingleSimFields(true);
  removeAllChilds(UI.controls.specificInputsWrapper);
  populateSpecificInputsForTheory(currentTheory, UI.controls.specificInputsWrapper, false);
  stratUpdate();
}

function stratUpdate<theory extends theoryType, strat extends stratType[theory]>() {
  const currentTheory = UI.controls.theorySelector.value as theory;
  const currentStrat = UI.controls.stratSelector.value as strat;
  removeAllChilds(UI.controls.stratSpecificInputsWrapper);
  populateStratSpecificInputsForTheory(currentTheory, currentStrat, UI.controls.stratSpecificInputsWrapper);
}

function themeUpdate() {
  const root = document.documentElement;
  root.setAttribute("theme", UI.settings.themeSelector.value);
}

//Renders theories, strats and modes options on page load

event(UI.settings.themeSelector, "change", themeUpdate);

event(UI.controls.modeSelector, "input", modeUpdate);

event(UI.controls.theorySelector, "change", theoryUpdate);

event(UI.controls.stratSelector, "change", stratUpdate);

event(UI.settings.showUnofficials, "click", () => {
    populateTheoryList(UI.settings.showUnofficials.checked);
    theoryUpdate();
});

for (let theory of theories) {
  populateSpecificInputsForTheory(theory, UI.specificInputsDialog.contentWrapper, true);
}

populateSelectElement(UI.settings.themeSelector, data.themes);
populateSelectElement(UI.controls.modeSelector, data.modes);

getSimState();

populateTheoryList(UI.settings.showUnofficials.checked);

modeUpdate();
theoryUpdate();
