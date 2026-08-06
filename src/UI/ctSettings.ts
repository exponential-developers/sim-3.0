import { applyTheorySettings } from "../Sim/simulate";
import { qs } from "../Utils/DOMhelpers";

const ctParameters = qs("#customTheoryParameters");

let settings: ({ id: string, elements: HTMLElement[], parse: () => string })[] = [];

export interface InputButtonParameters {
    id: string;
    text: string;
    placeholder: string;
    parse: (input: string) => { value: any, errorMessage?: string };
    defaultValue?: string;
}

export interface ParametersBuilder {
    addInputButton(params: InputButtonParameters): void;
}

export function applyCustomTheoryParameters(theoryType: theoryType) {
    ctParameters.style = "display: none";
    ctParameters.innerHTML = "";

    settings = [];
    const ctParametersBuilder: ParametersBuilder = {
        addInputButton(params: InputButtonParameters) {
            const elements: HTMLElement[] = [];

            const text = document.createElement("span");
            text.className = "description";
            text.textContent = `${params.text}: `;
            elements.push(text);

            const input = document.createElement("input");
            input.type = "text";
            input.style = "width: 5rem";
            input.placeholder = params.placeholder;
            elements.push(input);

            settings.push({
                id: params.id,
                elements,
                parse: () => {
                    let result = params.parse(input.value);
                    if (result.errorMessage !== undefined)
                        throw result.errorMessage;

                    return result.value;
                }
            });
        },
    };

    applyTheorySettings(theoryType, ctParametersBuilder);
    if (settings.length > 0) {
        ctParameters.style = "";
        for (let i = 0; i < settings.length; i++) {
            const setting = settings[i];

            const div = document.createElement("div");
            setting.elements.forEach(element => div.append(element));
            ctParameters.append(div);
        }
    }
}

export function parseCustomTheorySettings(): Map<string, any> {
    const map = new Map<string, any>();
    settings.forEach(setting => {
        map.set(setting.id, setting.parse());
    });
    return map;
}