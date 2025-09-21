import { round } from "../Utils/helpers.js";
import { qs } from "../Utils/DOMhelpers.js";
import { global } from "../Sim/main.js";

//Setting Inputs
const dtSlider = qs<HTMLInputElement>(".dt");
const dtOtp = qs(".dtOtp");

const ddtSlider = qs<HTMLInputElement>(".ddt");
const ddtOtp = qs(".ddtOtp");

const mfDepthSlider = qs<HTMLInputElement>(".mfDepth");
const mfDepthOpt = qs(".mfDepthOtp");

const themeSelector = qs<HTMLSelectElement>(".themeSelector");

const simAllStrats = qs<HTMLSelectElement>(".simallstrats");
const skipCompletedCTs = qs<HTMLInputElement>(".skipcompletedcts");
const showA23 = qs<HTMLInputElement>(".a23");
const showUnofficials = qs<HTMLInputElement>(".unofficials");

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
