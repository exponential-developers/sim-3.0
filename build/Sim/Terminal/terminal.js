import { qs, ce } from "../../Utils/helpers.js";
export default class Terminal {
    constructor() {
        var _a, _b, _c;
        this.terminal_element = qs(".terminal");
        this.output_container = qs(".terminalOutputs");
        this.input = qs(".terminalInput");
        this.history = JSON.parse((_a = localStorage.getItem("terminalHistory")) !== null && _a !== void 0 ? _a : "[]");
        this.historyIndex = this.history.length;
        const terminalSize = JSON.parse((_b = localStorage.getItem("terminalSize")) !== null && _b !== void 0 ? _b : `{"width": "700px", "height":"400px"}`);
        this.terminal_element.style.width = terminalSize.width;
        this.terminal_element.style.height = terminalSize.height;
        this.terminal_element.style.display = "block";
        const terminalPos = JSON.parse((_c = localStorage.getItem("terminalPos")) !== null && _c !== void 0 ? _c : `{"top": "0px", "left":"0px"}`);
        this.terminal_element.style.top = terminalPos.top;
        this.terminal_element.style.left = terminalPos.left;
    }
    parseInput() {
        const input = this.input.value;
        this.input.value = "";
        this.updateHistory(input);
        this.writeLine(input, true);
        return input;
    }
    writeLine(value, inp = false) {
        value = value.replace(/script/g, "/script/");
        value = value.replace(/[(]/g, "/(/");
        value = value.replace(/[)]/g, "/)/");
        if (value.length === 0)
            return;
        value = value.replace(/<r>/g, '<span style="color:red; font-weight:bold">');
        value = value.replace(/<\/r>/g, "</span>");
        value = value.replace(/<g>/g, '<span style="color:rgb(34, 211, 34); font-weight:bold">');
        value = value.replace(/<\/g>/g, "</span>");
        const div = ce("div");
        if (inp) {
            const sign = ce("span");
            sign.innerText = ">";
            sign.style.marginRight = "1rem";
            sign.style.userSelect = "none";
            div.appendChild(sign);
            div.style.marginBlock = "0.3em";
        }
        const span = ce("span");
        span.classList.add("output");
        span.innerHTML = value;
        div.appendChild(span);
        this.output_container.appendChild(div);
        qs(".terminalOutputWrapper").scroll({ top: 100000000 });
    }
    deleteLine() {
        if (this.output_container.lastChild)
            this.output_container.lastChild.remove();
    }
    clearTerminal() {
        while (this.output_container.firstChild)
            this.output_container.firstChild.remove();
    }
    updateHistory(input) {
        this.history = this.history.filter((elem) => elem !== input);
        if (input.length > 0 && input !== "c")
            this.history.push(input);
        this.historyIndex = this.history.length;
        localStorage.setItem("terminalHistory", JSON.stringify(this.history.slice(Math.max(0, this.history.length - 20), this.history.length)));
    }
    getHistory(direction) {
        if ((this.historyIndex > 0 || direction === 1) && (this.historyIndex < this.history.length - 1 || direction === -1))
            this.historyIndex += direction;
        if (this.history.length > 0)
            this.input.value = this.history[this.historyIndex];
        const end = this.input.value.length;
        setTimeout(() => {
            this.input.setSelectionRange(end, end);
            this.input.focus();
        }, 0);
    }
}
