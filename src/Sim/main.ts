import { parseQuery } from "./parse";
import { simulate } from "./simulate";
import { writeSimResponse } from "./write";
import { setSimState } from "../UI/simState";
import { qs, event } from "../Utils/DOMhelpers";
import { cacheFilterQuery, cacheFilterResponse, setCache } from "./cache";
import { refreshDOMEventLoop } from "../Utils/helpers";
import { loadSave } from "../UI/buttonEvents";

const output = qs(".output");

// Inputs
const simAllInputArea = qs<HTMLTextAreaElement>(".simAllInputArea");

//Buttons
const simulateButton = qs(".simulate");

export const global = {
  simulating: false,
};

async function simCall() {
  if (global.simulating) {
    global.simulating = false;
    output.textContent = "Sim stopped.";
    return;
  }

  global.simulating = true;
  output.textContent = "";
  simulateButton.textContent = "Stop simulating";

  // Auto-load save
  if (/^[A-Za-z0-9+\/=]{20,}$/.test(simAllInputArea.value.trim())) {
    await loadSave();
    await refreshDOMEventLoop();
  }

  try {
    const query = parseQuery();
    const filteredQuery = cacheFilterQuery(structuredClone(query));
    const response = await simulate(filteredQuery);
    const filteredResponse = cacheFilterResponse(filteredQuery, response);
    await refreshDOMEventLoop();
    if (global.simulating) setCache(query, filteredResponse);
    writeSimResponse(filteredResponse);
    output.textContent = "";
  }
  catch (err) {
    output.textContent = global.simulating ? String(err) : "Sim stopped.";
  }
  
  global.simulating = false;
  simulateButton.textContent = "Simulate";
  setSimState();
}

event(simulateButton, "click", simCall);