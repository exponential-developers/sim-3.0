import { qs, round } from "../Utils/helpers.js";
import { global } from "../Sim/main.js"
import { modeUpdate } from "./render.js";

//Inputs
const theory = <HTMLSelectElement>qs(".theory");
const strat = <HTMLSelectElement>qs(".strat");
const sigma = <HTMLInputElement>qs(".sigma");
const input = <HTMLInputElement>qs(".input");
const cap = <HTMLInputElement>qs(".cap");
const mode = <HTMLSelectElement>qs(".mode");
const modeInput = <HTMLInputElement>qs("textarea");
const hardCap = <HTMLInputElement>qs(".hardCap");

//Outputs
const output = qs(".output");
const table = qs(".simTable");

//Setting Inputs
const dtSlider = <HTMLInputElement>qs(".dt");
const dtOtp = qs(".dtOtp");

const ddtSlider = <HTMLInputElement>qs(".ddt");
const ddtOtp = qs(".ddtOtp");

const mfDepthSlider = <HTMLInputElement>qs(".mfDepth");
const mfDepthOpt = qs(".mfDepthOtp");

const themeSelector = <HTMLSelectElement>qs(".themeSelector");

const simAllStrats = <HTMLSelectElement>qs(".simallstrats");
const skipCompletedCTs = <HTMLInputElement>qs(".skipcompletedcts");
const showA23 = <HTMLInputElement>qs(".a23");
const showUnofficials = <HTMLInputElement>qs(".unofficials");

const defaultState = `{"settings":{"dt":"1.5","ddt":"1.0001","skipCompletedCTs":false,"showA23":false,"showUnofficials":false}}`;
const defaultTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "classic";

export function setSimState() {
  localStorage.setItem(
    "simState",
    JSON.stringify({
      settings: {
        dt: dtOtp.textContent,
        ddt: ddtOtp.textContent,
        mfResetDepth: mfDepthOpt.textContent,
        simAllStrats: simAllStrats.value,
        skipCompletedCTs: skipCompletedCTs.checked,
        showA23: showA23.checked,
        showUnofficials: showUnofficials.checked,
        theme: themeSelector.value
      },
    })
  );
}
export function getSimState() {
  const state = JSON.parse(localStorage.getItem("simState") ?? defaultState);
  dtOtp.textContent = state.settings.dt;
  ddtOtp.textContent = state.settings.ddt;
  mfDepthOpt.textContent = state.settings.mfResetDepth ?? "0";
  simAllStrats.value = state.settings.simAllStrats ?? "all";
  skipCompletedCTs.checked = state.settings.skipCompletedCTs ?? false;
  showA23.checked = state.settings.showA23;
  showUnofficials.checked = state.settings.showUnofficials ?? false;
  global.showUnofficials = showUnofficials.checked;
  // Determines the slider position based on the stored value (see settings.ts)
  dtSlider.value = String(round(Math.log2((state.settings.dt - 0.15) / (4.9 / (1 + 2 ** parseFloat(dtSlider.max)))), 4));
  ddtSlider.value = String(round(Math.log((state.settings.ddt - 1) / (0.3 / 3 ** parseFloat(ddtSlider.max))) / Math.log(3), 4));
  mfDepthSlider.value = mfDepthOpt.textContent ?? "0";
  themeSelector.value = state.settings.theme ?? defaultTheme;
}
