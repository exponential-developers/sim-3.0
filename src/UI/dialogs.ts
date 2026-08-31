import { bindDialogCloseEvents, event, openDialog } from "../Utils/DOMhelpers";
import { setSimState } from "./simState";
import UI from "./elements";

event(UI.nav.settingsBtn, "pointerdown", () => openDialog(UI.settings.dialog));
bindDialogCloseEvents(UI.settings.dialog, UI.settings.closeBtn, setSimState);

event(UI.controls.specificInputsMenuButton, "pointerdown", () => openDialog(UI.specificInputsDialog.dialog));
bindDialogCloseEvents(UI.specificInputsDialog.dialog, UI.specificInputsDialog.closeBtn);

event(UI.nav.instructionsBtn, "pointerdown", () => openDialog(UI.instructions.dialog));
bindDialogCloseEvents(UI.instructions.dialog, UI.instructions.closeBtn);