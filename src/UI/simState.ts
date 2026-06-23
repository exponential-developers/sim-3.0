import { round } from "../Utils/helpers";
import UI from "./elements";

const defaultState = `{"settings":{"dt":"1.5","ddt":"1.0001","showA23":false,"showUnofficials":false}}`;
const defaultTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "classic";

export function setSimState() {
  localStorage.setItem("simAllSettings", JSON.stringify([
    UI.controls.semiIdleToggle.checked, 
    UI.controls.veryActiveToggle.checked
  ]));
  localStorage.setItem(
    "simState",
    JSON.stringify({
      settings: {
        dt: UI.settings.dtOtp.textContent,
        ddt: UI.settings.ddtOtp.textContent,
        mfResetDepth: UI.settings.mfDepthOtp.textContent,
        boughtVarsDelta: UI.settings.boughtVarsDeltaSlider.value,
        simAllStrats: UI.settings.simAllStrats.value,
        completedCTs: UI.settings.completedCTs.value,
        showA23: UI.settings.showA23.checked,
        showUnofficials: UI.settings.showUnofficials.checked,
        theme: UI.settings.themeSelector.value
      },
    })
  );
}
export function getSimState() {
  //Sim All Settings
  const simAllSettings: [boolean, boolean] = JSON.parse(localStorage.getItem("simAllSettings") ?? "[true, false]");
  UI.controls.semiIdleToggle.checked = simAllSettings[0];
  UI.controls.veryActiveToggle.checked = simAllSettings[1];

  // Sim Settings
  const state = JSON.parse(localStorage.getItem("simState") ?? defaultState);

  UI.settings.dtOtp.textContent = state.settings.dt;
  UI.settings.ddtOtp.textContent = state.settings.ddt;
  UI.settings.mfDepthOtp.textContent = state.settings.mfResetDepth ?? "0";
  UI.settings.boughtVarsDeltaOtp.textContent = `e${state.settings.boughtVarsDelta ?? 5}ρ`;
  // Determines the slider position based on the stored value (see helpers.ts)
  UI.settings.dtSlider.value = 
    String(round(Math.log2((state.settings.dt - 0.15) / (4.9 / (1 + 2 ** parseFloat(UI.settings.dtSlider.max)))), 4));
  UI.settings.ddtSlider.value = 
    String(round(Math.log((state.settings.ddt - 1) / (0.3 / 3 ** parseFloat(UI.settings.ddtSlider.max))) / Math.log(3), 4));
  UI.settings.mfDepthSlider.value = UI.settings.mfDepthOtp.textContent ?? "0";
  UI.settings.boughtVarsDeltaSlider.value = state.settings.boughtVarsDelta ?? 5;

  UI.settings.themeSelector.value = state.settings.theme ?? defaultTheme;
  UI.settings.simAllStrats.value = state.settings.simAllStrats ?? "all";
  UI.settings.completedCTs.value = state.settings.completedCTs ?? (state.settings.skipCompletedCTs === true ? "no" : "in");
  //skipCompletedCTs.checked = state.settings.skipCompletedCTs ?? false;
  UI.settings.showA23.checked = state.settings.showA23;
  UI.settings.showUnofficials.checked = state.settings.showUnofficials ?? false;
}
