import { ce, event } from "../Utils/DOMhelpers";

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

function generateSpecificInputWidget(theory: theoryType, id: string, input: SpecificInputType): HTMLSpanElement {
    switch (input.type) {
        case "slider": return generateSlider(theory, id, input)
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