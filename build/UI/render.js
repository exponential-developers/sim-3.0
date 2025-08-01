import { qs, qsa, event, ce, findIndex } from "../Utils/helpers.js";
import data from "../Data/data.json" assert { type: "json" };
import { updateTimeDiffTable } from "../Sim/parsers.js";
import { global } from "../Sim/main.js";
import { getSimState } from "./simState.js";
//Inputs
const theory = qs(".theory");
const strat = qs(".strat");
const cap = qs(".cap");
const mode = qs(".mode");
const modeInput = qs("textarea");
const hardCap = qs(".hardCapWrapper");
const semi_idle = qs(".semi-idle");
const hard_active = qs(".hard-active");
const timeDiffInputs = qsa(".timeDiffInput");
const themeSelector = qs(".themeSelector");
//Other containers/elements
const extraInputs = qs(".extraInputs");
const timeDiffWrapper = qs(".timeDiffWrapper");
const singleInput = qsa(".controls")[0];
const simAllInputs = qs(".simAllInputs");
const modeInputDescription = qs(".extraInputDescription");
//Renders theories, strats and modes options on page load
const theories = Object.keys(data.theories);
window.onload = () => {
    var _a;
    for (let i = 0; i < data.themes.length; i++) {
        const option = ce("option");
        option.value = data.themes[i];
        option.textContent = data.themes[i];
        themeSelector.appendChild(option);
    }
    event(themeSelector, "change", themeUpdate);
    getSimState();
    for (let i = 0; i < theories.length; i++) {
        if (data.theories[theories[i]].UI_visible === false && !global.showUnofficials)
            continue;
        const option = ce("option");
        option.value = theories[i];
        option.textContent = theories[i];
        theory.appendChild(option);
    }
    const T1strats = Object.keys(data.theories.T1.strats);
    for (let i = 0; i < T1strats.length; i++) {
        const option = ce("option");
        option.value = T1strats[i];
        option.textContent = T1strats[i];
        strat.appendChild(option);
    }
    for (let i = 0; i < data.modes.length; i++) {
        const option = ce("option");
        option.value = data.modes[i];
        option.textContent = data.modes[i];
        mode.appendChild(option);
    }
    modeUpdate();
    event(mode, "input", modeUpdate);
    event(theory, "change", theoryUpdate);
    const simAllSettings = JSON.parse((_a = localStorage.getItem("simAllSettings")) !== null && _a !== void 0 ? _a : "[true, false]");
    semi_idle.checked = simAllSettings[0];
    hard_active.checked = simAllSettings[1];
    for (const elem of timeDiffInputs) {
        event(elem, "input", () => {
            updateTimeDiffTable();
        });
    }
};
export function modeUpdate() {
    singleInput.style.display = "none";
    extraInputs.style.display = "none";
    timeDiffWrapper.style.display = "none";
    hardCap.style.display = "none";
    simAllInputs.style.display = "none";
    modeInputDescription.style.display = "inline";
    modeInput.style.height = "1.8em";
    modeInput.style.width = "6rem";
    cap.style.display = "none";
    qs(".capDesc").style.display = "none";
    if (mode.value === "Chain" || mode.value === "Steps") {
        cap.style.display = "inline";
        qs(".capDesc").style.display = "inline";
    }
    if (mode.value !== "Single sim" && mode.value !== "Time diff." && mode.value !== "Chain")
        extraInputs.style.display = "flex";
    if (mode.value === "Time diff.")
        timeDiffWrapper.style.display = "grid";
    if (mode.value !== "All" && mode.value !== "Time diff.")
        singleInput.style.display = "grid";
    if (mode.value === "Chain")
        hardCap.style.display = "block";
    if (mode.value === "All") {
        simAllInputs.style.display = "grid";
        modeInputDescription.style.display = "none";
        modeInput.style.height = "4rem";
        modeInput.style.width = "20rem";
    }
    modeInput.placeholder = data.modeInputPlaceholder[findIndex(data.modes, mode.value)];
    modeInputDescription.textContent = data.modeInputDescriptions[findIndex(data.modes, mode.value)];
}
export function theoryUpdate() {
    while (strat.firstChild)
        strat.firstChild.remove();
    for (let i = 0; i < 4; i++) {
        const option = ce("option");
        option.value = data.stratCategories[i];
        option.textContent = data.stratCategories[i];
        strat.appendChild(option);
    }
    const currentTheory = theory.value;
    const strats = Object.keys(data.theories[currentTheory].strats);
    for (let i = 0; i < strats.length; i++) {
        if (data.theories[currentTheory].strats[strats[i]].UI_visible === false)
            continue;
        const option = ce("option");
        option.value = strats[i];
        option.textContent = strats[i];
        strat.appendChild(option);
    }
}
export function themeUpdate() {
    const root = document.documentElement;
    root.setAttribute("theme", themeSelector.value);
}
