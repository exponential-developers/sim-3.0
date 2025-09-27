import { formatNumber, getddtFromSlider, getdtFromSlider } from "../Utils/helpers";
import { qs, event } from "../Utils/DOMhelpers";
import { setSimState } from "./simState";

// Settings menu

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

// Instructions menu

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

// Settings inputs

const dtSlider = qs<HTMLInputElement>(".dt");
const dtOtp = qs(".dtOtp");

const ddtSlider = qs<HTMLInputElement>(".ddt");
const ddtOtp = qs(".ddtOtp");

const mfDepthSlider = qs<HTMLInputElement>(".mfDepth");
const mfDepthOpt = qs(".mfDepthOtp");

event(dtSlider, "input", () => {
  dtOtp.textContent = formatNumber(getdtFromSlider(parseFloat(dtSlider.value)), 4);
});

event(ddtSlider, "input", () => {
  ddtOtp.textContent = formatNumber(getddtFromSlider(parseFloat(ddtSlider.value)), 7)
});

event(mfDepthSlider, "input", () => mfDepthOpt.textContent = mfDepthSlider.value);

event(qs(".resetSettings"), "pointerdown", () => {
  dtSlider.value = "8.1943";
  dtOtp.textContent = "1.5";
  ddtSlider.value = "2.71233";
  ddtOtp.textContent = "1.0001";
  mfDepthSlider.value = "0";
  mfDepthOpt.textContent = "0";
});
