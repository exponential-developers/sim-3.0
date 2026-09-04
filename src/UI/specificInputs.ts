import { ce, event } from "../Utils/DOMhelpers";
import UI from "./elements";

function generateSlider(theory: theoryType, id: string, input: SpecificInputSlider): HTMLSpanElement {
    const span = ce<HTMLSpanElement>("span");

    const slider = ce<HTMLInputElement>("input");
    slider.type = "range";
    slider.min = input.validation.min.toString();
    slider.max = input.validation.max.toString();
    slider.step = input.step.toString();
    slider.value = input.default ? input.default.toString() : slider.min;
    slider.classList.add("specificInputSlider");
    span.appendChild(slider);

    const output = ce<HTMLSpanElement>("span");
    output.innerText = slider.value;
    output.classList.add("specificInputSliderOutput");
    span.appendChild(output);

    event(slider, "input", () => output.innerText = slider.value);

    return span;
}

function generateTextbox(theory: theoryType, id: string, input: SpecificInputTextbox): HTMLSpanElement {
    const span = ce<HTMLSpanElement>("span");

    const textbox = ce<HTMLInputElement>("input");
    textbox.type = "text";
    textbox.placeholder = input.placeholder ?? "";
    textbox.spellcheck = false;
    textbox.classList.add("specificInputTextbox");
    textbox.style.minWidth = "8ch";
    span.appendChild(textbox);

    return span;
}

function generateSpecificInputWidget(theory: theoryType, id: string, input: SpecificInputType): HTMLSpanElement {
    switch (input.type) {
        case "slider": return generateSlider(theory, id, input);
        case "textbox": return generateTextbox(theory, id, input);
    }
    return ce<HTMLSpanElement>("span");
}

export function generateSpecificInputWidgetWrapper(
    theory: theoryType, 
    id: string, 
    input: SpecificInputType, 
    allMode: boolean = false
): HTMLDivElement {
    const div = ce<HTMLDivElement>("div");
    div.setAttribute("theory", theory);
    div.setAttribute("inputid", id);
    div.setAttribute("inputtype", input.type);

    const label = ce<HTMLSpanElement>("span");
    label.innerText = (allMode ? `${theory} - ` : "") + input.label + ":";
    div.appendChild(label);

    const widget = generateSpecificInputWidget(theory, id, input);
    div.appendChild(widget);

    return div;
}

export function setSpecificInput<T extends theoryType>(
    theory: T, 
    input: SpecificInputOf[T], 
    value: string, 
    allMode: boolean
) {
    const container = allMode ? UI.specificInputsDialog.contentWrapper : UI.controls.specificInputsWrapper;
    const div = container.querySelector<HTMLDivElement>(`div[theory="${theory}"][inputid="${input}"]`);
    if (div === null) return;
    if (!div.hasAttribute("inputtype")) return;
    switch (div.getAttribute("inputtype") as SpecificInputType["type"]) {
        case "slider": {
            const slider = div.querySelector<HTMLInputElement>(".specificInputSlider");
            const output = div.querySelector<HTMLInputElement>(".specificInputSliderOutput");
            if (slider === null || output === null) return;
            slider.value = value;
            output.innerText = value;
        };
        case "textbox": {
            const textbox = div.querySelector<HTMLInputElement>(".specificInputTextbox");
            if (textbox === null) return;
            textbox.value = value;
        }
    }
}