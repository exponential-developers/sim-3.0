import { parseQuery } from "./parse";
import { simulate } from "./simulate";
import { writeSimResponse } from "./write";
import { setSavedSpecificInputs, setSimState } from "../UI/simState";
import { event } from "../Utils/DOMhelpers";
import { cacheFilterQuery, cacheFilterResponse, setCache } from "./cache";
import { refreshDOMEventLoop } from "../Utils/helpers";
import { loadSave } from "../UI/buttonEvents";
import UI from "../UI/elements";

export const global = {
  simulating: false,
};

async function simCall() {
  if (global.simulating) {
    global.simulating = false;
    UI.outputs.log.textContent = "Sim stopped.";
    return;
  }

  global.simulating = true;
  UI.outputs.log.textContent = "";
  UI.controls.simulateBtn.textContent = "Stop simulating";
  UI.controls.simulateBtn.classList.remove("green", "red");
  UI.controls.simulateBtn.classList.add("red");
  await refreshDOMEventLoop();

  // Auto-load save
  if (/^[A-Za-z0-9+\/=]{20,}$/.test(UI.controls.simAllInputArea.value.trim())) {
    await loadSave();
    await refreshDOMEventLoop();
  }

  try {
    const query = parseQuery();
    if (query.queryType === "all") {
      setSavedSpecificInputs(query.theorySpecificInputs);
    }
    const filteredQuery = cacheFilterQuery(structuredClone(query));
    const response = await simulate(filteredQuery);
    const filteredResponse = cacheFilterResponse(filteredQuery, response);
    await refreshDOMEventLoop();
    if (global.simulating) setCache(query, filteredResponse);
    writeSimResponse(filteredResponse);
    UI.outputs.log.textContent = "";
  }
  catch (err) {
    UI.outputs.log.textContent = global.simulating ? String(err) : "Sim stopped.";
  }
  
  global.simulating = false;
  UI.controls.simulateBtn.textContent = "Simulate";
  UI.controls.simulateBtn.classList.remove("green", "red");
  UI.controls.simulateBtn.classList.add("green");
  setSimState();
}

event(UI.controls.simulateBtn, "click", simCall);