import { parseQuery } from "./parse";
import { simulate } from "./simulate";
import { writeSimResponse } from "./write";
import { setSimState } from "../UI/simState";
import { qs, event } from "../Utils/DOMhelpers";
import { cacheFilterQuery, cacheFilterResponse, setCache } from "./cache";

const output = qs(".output");

//Buttons
const simulateButton = qs(".simulate");

export const global = {
  stratFilter: true,
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

  try {
    const query = parseQuery();
    const filteredQuery = cacheFilterQuery(structuredClone(query));
    const response = await simulate(filteredQuery);
    const filteredResponse = cacheFilterResponse(filteredQuery, response);
    setCache(query, filteredResponse);
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