import { formatNumber, round, qs, event } from "../Utils/helpers.js";
import { setSimState } from "./simState.js";

const settingsBtn = qs<HTMLButtonElement>(".settingsBtn");
const settingsCloseBtn = qs<HTMLButtonElement>(".settingsCloseBtn");
const settingsModal = qs<HTMLDialogElement>(".settings");

event(settingsBtn, "pointerdown", () => {
  settingsModal.showModal();
  document.body.style.overflow = "hidden";
});

event(settingsCloseBtn, "pointerdown", () => {
  setSimState();
  settingsModal.close();
  document.body.style.overflow = "auto";
});

const instructionsBtn = qs<HTMLButtonElement>(".instructionsBtn");
const instructionsCloseBtn = qs<HTMLButtonElement>(".instructionsCloseBtn");
const instructionsModal = qs<HTMLDialogElement>(".instructions");

event(instructionsBtn, "pointerdown", () => {
  instructionsModal.showModal();
  document.body.style.overflow = "hidden";
});

event(instructionsCloseBtn, "pointerdown", () => {
  instructionsModal.close();
  document.body.style.overflow = "auto";
});

const dtSlider = qs<HTMLInputElement>(".dt");
const dtOtp = qs(".dtOtp");

const ddtSlider = qs<HTMLInputElement>(".ddt");
const ddtOtp = qs(".ddtOtp");

const mfDepthSlider = qs<HTMLInputElement>(".mfDepth");
const mfDepthOpt = qs(".mfDepthOtp");

event(
  dtSlider,
  "input",
  () => (dtOtp.textContent = dtSlider.value === "0" ? "0.15" : dtSlider.value === "10" ? "5" : String(formatNumber(0.15 + 2 ** parseFloat(dtSlider.value) * (4.9 / (1 + 2 ** parseFloat(dtSlider.max))), 4)))
);

event(
  ddtSlider,
  "input",
  () =>
    (ddtOtp.textContent = ddtSlider.value === "0" ? "1" : ddtSlider.value === "10" ? "1.3" : String(round(1 + Number(formatNumber(3 ** parseFloat(ddtSlider.value) * (0.3 / 3 ** parseFloat(ddtSlider.max)), 2)), 7)))
);

event(
  mfDepthSlider,
  "input",
  () => mfDepthOpt.textContent = mfDepthSlider.value
)

event(qs(".resetSettings"), "pointerdown", () => {
  dtSlider.value = "8.1943";
  dtOtp.textContent = "1.5";
  ddtSlider.value = "2.71233";
  ddtOtp.textContent = "1.0001";
  mfDepthSlider.value = "0";
  mfDepthOpt.textContent = "0";
});
