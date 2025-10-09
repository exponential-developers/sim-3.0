import { round } from "../Utils/helpers";
import { qs } from "../Utils/DOMhelpers";

//Sim All Settings
const semiIdle = qs<HTMLInputElement>(".semi-idle");
const hardActive = qs<HTMLInputElement>(".hard-active");

//Setting Inputs
const dtSlider = qs<HTMLInputElement>(".dt");
const dtOtp = qs(".dtOtp");

const ddtSlider = qs<HTMLInputElement>(".ddt");
const ddtOtp = qs(".ddtOtp");

const mfDepthSlider = qs<HTMLInputElement>(".mfDepth");
const mfDepthOpt = qs(".mfDepthOtp");

const themeSelector = qs<HTMLSelectElement>(".themeSelector");

const simAllStrats = qs<HTMLSelectElement>(".simallstrats");
const completedCTs = qs<HTMLInputElement>(".completedcts");
const showA23 = qs<HTMLInputElement>(".a23");
const showUnofficials = qs<HTMLInputElement>(".unofficials");

const defaultState = `{"settings":{"dt":"1.5","ddt":"1.0001","showA23":false,"showUnofficials":false}}`;
const defaultTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "classic";

export function setSimState() {
  localStorage.setItem("simAllSettings", JSON.stringify([semiIdle.checked, hardActive.checked]));
  localStorage.setItem(
    "simState",
    JSON.stringify({
      settings: {
        dt: dtOtp.textContent,
        ddt: ddtOtp.textContent,
        mfResetDepth: mfDepthOpt.textContent,
        simAllStrats: simAllStrats.value,
        completedCTs: completedCTs.value,
        showA23: showA23.checked,
        showUnofficials: showUnofficials.checked,
        theme: themeSelector.value
      },
    })
  );
}
export function getSimState() {
  //Sim All Settings
  const simAllSettings: [boolean, boolean] = JSON.parse(localStorage.getItem("simAllSettings") ?? "[true, false]");
  semiIdle.checked = simAllSettings[0];
  hardActive.checked = simAllSettings[1];

  // Sim Settings
  const state = JSON.parse(localStorage.getItem("simState") ?? defaultState);

  dtOtp.textContent = state.settings.dt;
  ddtOtp.textContent = state.settings.ddt;
  mfDepthOpt.textContent = state.settings.mfResetDepth ?? "0";
  // Determines the slider position based on the stored value (see helpers.ts)
  dtSlider.value = String(round(Math.log2((state.settings.dt - 0.15) / (4.9 / (1 + 2 ** parseFloat(dtSlider.max)))), 4));
  ddtSlider.value = String(round(Math.log((state.settings.ddt - 1) / (0.3 / 3 ** parseFloat(ddtSlider.max))) / Math.log(3), 4));
  mfDepthSlider.value = mfDepthOpt.textContent ?? "0";

  themeSelector.value = state.settings.theme ?? defaultTheme;
  simAllStrats.value = state.settings.simAllStrats ?? "all";
  completedCTs.value = state.settings.completedCTs ?? (state.settings.skipCompletedCTs === true ? "no" : "in");
  //skipCompletedCTs.checked = state.settings.skipCompletedCTs ?? false;
  showA23.checked = state.settings.showA23;
  showUnofficials.checked = state.settings.showUnofficials ?? false;
}
