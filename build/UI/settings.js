import { formatNumber, round, qs, event } from "../Utils/helpers.js";
import { setSimState } from "./simState.js";
const settingsBtn = qs(".settingsBtn");
const settingsCloseBtn = qs(".settingsCloseBtn");
const settingsModal = qs(".settings");
event(settingsBtn, "pointerdown", () => {
    settingsModal.showModal();
    document.body.style.overflow = "hidden";
});
event(settingsCloseBtn, "pointerdown", () => {
    setSimState();
    settingsModal.close();
    document.body.style.overflow = "auto";
});
const instructionsBtn = qs(".instructionsBtn");
const instructionsCloseBtn = qs(".instructionsCloseBtn");
const instructionsModal = qs(".instructions");
event(instructionsBtn, "pointerdown", () => {
    instructionsModal.showModal();
    document.body.style.overflow = "hidden";
});
event(instructionsCloseBtn, "pointerdown", () => {
    instructionsModal.close();
    document.body.style.overflow = "auto";
});
const dtSlider = qs(".dt");
const dtOtp = qs(".dtOtp");
const ddtSlider = qs(".ddt");
const ddtOtp = qs(".ddtOtp");
event(dtSlider, "input", () => (dtOtp.textContent = dtSlider.value === "0" ? "0.15" : dtSlider.value === "10" ? "5" : String(formatNumber(0.15 + Math.pow(2, parseFloat(dtSlider.value)) * (4.9 / (1 + Math.pow(2, parseFloat(dtSlider.max)))), 4))));
event(ddtSlider, "input", () => (ddtOtp.textContent = ddtSlider.value === "0" ? "1" : ddtSlider.value === "10" ? "1.3" : String(round(1 + Number(formatNumber(Math.pow(3, parseFloat(ddtSlider.value)) * (0.3 / Math.pow(3, parseFloat(ddtSlider.max))), 2)), 7))));
event(qs(".resetSettings"), "pointerdown", () => {
    dtSlider.value = "8.1943";
    dtOtp.textContent = "1.5";
    ddtSlider.value = "2.71233";
    ddtOtp.textContent = "1.0001";
});
