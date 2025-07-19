import { qs, round } from "../Utils/helpers.js";
import { global } from "../Sim/main.js";
//Inputs
const theory = qs(".theory");
const strat = qs(".strat");
const sigma = qs(".sigma");
const input = qs(".input");
const cap = qs(".cap");
const mode = qs(".mode");
const modeInput = qs("textarea");
const hardCap = qs(".hardCap");
//Outputs
const output = qs(".output");
const table = qs(".simTable");
//Setting Inputs
const dtSlider = qs(".dt");
const dtOtp = qs(".dtOtp");
const ddtSlider = qs(".ddt");
const ddtOtp = qs(".ddtOtp");
const themeSelector = qs(".themeSelector");
const simAllStrats = qs(".simallstrats");
const skipCompletedCTs = qs(".skipcompletedcts");
const showA23 = qs(".a23");
const showUnofficials = qs(".unofficials");
const defaultState = `{"settings":{"dt":"1.5","ddt":"1.0001","skipCompletedCTs":false,"showA23":false,"showUnofficials":false}}`;
const defaultTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "classic";
export function setSimState() {
    localStorage.setItem("simState", JSON.stringify({
        settings: {
            dt: dtOtp.textContent,
            ddt: ddtOtp.textContent,
            simAllStrats: simAllStrats.value,
            skipCompletedCTs: skipCompletedCTs.checked,
            showA23: showA23.checked,
            showUnofficials: showUnofficials.checked,
            theme: themeSelector.value
        },
    }));
}
export function getSimState() {
    var _a, _b, _c, _d, _e;
    const state = JSON.parse((_a = localStorage.getItem("simState")) !== null && _a !== void 0 ? _a : defaultState);
    dtOtp.textContent = state.settings.dt;
    ddtOtp.textContent = state.settings.ddt;
    simAllStrats.value = (_b = state.settings.simAllStrats) !== null && _b !== void 0 ? _b : "all";
    skipCompletedCTs.checked = (_c = state.settings.skipCompletedCTs) !== null && _c !== void 0 ? _c : false;
    showA23.checked = state.settings.showA23;
    showUnofficials.checked = (_d = state.settings.showUnofficials) !== null && _d !== void 0 ? _d : false;
    global.showUnofficials = showUnofficials.checked;
    // Determines the slider position based on the stored value (see settings.ts)
    dtSlider.value = String(round(Math.log2((state.settings.dt - 0.15) / (4.9 / (1 + Math.pow(2, parseFloat(dtSlider.max))))), 4));
    ddtSlider.value = String(round(Math.log((state.settings.ddt - 1) / (0.3 / Math.pow(3, parseFloat(ddtSlider.max)))) / Math.log(3), 4));
    themeSelector.value = (_e = state.settings.theme) !== null && _e !== void 0 ? _e : defaultTheme;
}
