import { formatNumber, getddtFromSlider, getdtFromSlider } from "../Utils/helpers";
import { bindDialogCloseEvents, event, openDialog } from "../Utils/DOMhelpers";
import { setSimState } from "./simState";
import UI from "./elements";

event(UI.nav.settingsBtn, "pointerdown", () => openDialog(UI.settings.dialog));
bindDialogCloseEvents(UI.settings.dialog, UI.settings.closeBtn, setSimState);

event(UI.nav.instructionsBtn, "pointerdown", () => openDialog(UI.instructions.dialog));
bindDialogCloseEvents(UI.instructions.dialog, UI.instructions.closeBtn);

event(UI.settings.dtSlider, "input", () => {
  UI.settings.dtOtp.textContent = formatNumber(getdtFromSlider(parseFloat(UI.settings.dtSlider.value)), 4);
});

event(UI.settings.ddtSlider, "input", () => {
  UI.settings.ddtOtp.textContent = formatNumber(getddtFromSlider(parseFloat(UI.settings.ddtSlider.value)), 7)
});

event(UI.settings.mfDepthSlider, "input", () => 
  UI.settings.mfDepthOtp.textContent = UI.settings.mfDepthSlider.value
);

event(UI.settings.boughtVarsDeltaSlider, "input", () => 
  UI.settings.boughtVarsDeltaOtp.textContent = `e${UI.settings.boughtVarsDeltaSlider.value}ρ`
);

event(UI.settings.resetBtn, "pointerdown", () => {
  UI.settings.dtSlider.value = "8.1943";
  UI.settings.dtOtp.textContent = "1.5";
  UI.settings.ddtSlider.value = "2.71233";
  UI.settings.ddtOtp.textContent = "1.0001";
  UI.settings.boughtVarsDeltaSlider.value = "5";
  UI.settings.boughtVarsDeltaOtp.textContent = "e5ρ";
  UI.settings.mfDepthSlider.value = "0";
  UI.settings.mfDepthOtp.textContent = "0";
});
