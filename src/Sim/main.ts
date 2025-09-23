import { parseQuery } from "./parse";
import { simulate } from "./simulate";
import { writeSimResponse } from "./write";
import { setSimState } from "../UI/simState";
import { qs, event } from "../Utils/DOMhelpers";

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
  }

  global.simulating = true;
  output.textContent = "";
  simulateButton.textContent = "Stop simulating";

  try {
    const query = parseQuery();
    const response = await simulate(query);
    writeSimResponse(response);
    output.textContent = "";
  }
  catch (err) {
    output.textContent = String(err);
  }
  
  global.simulating = false;
  simulateButton.textContent = "Simulate";
  setSimState();
}

event(simulateButton, "click", simCall);