import { qs, removeAllChilds } from "../Utils/DOMhelpers";

const output = qs(".output");
const table = qs(".simTable");
const thead = qs(".simTable > thead");
const tbody = qs(".simTable > tbody");

const tau = `<span style="font-size:0.9rem; font-style:italics">&tau;</span>`;
const rho = `<span style="font-size:0.9rem; font-style:italics">&rho;</span>`;

const tableHeaders = {
  single: `<tr><th style="padding-inline: 0.5rem !important">Theory</th><th><span style="font-size:0.9rem;">&sigma;</span><sub>t</sub></th><th>Last Pub</th><th>Max Rho</th><th>&Delta;${tau}</th><th>Multi</th><th>Strat</th><th>${tau}/h</th><th>Pub Time</th></tr>`,
  all: `<tr><th>&emsp;</th><th>Input</th><th>Ratio</th><th>${tau}/h</th><th>Multi</th><th>Strat</th><th>Time</th><th>&Delta;${tau}</th><th>Pub ${rho}</th></tr>`,
};

function clearTable() {
    removeAllChilds(tbody);
}
function setTableClass(cl: ("big" | "small")) {
    table.classList.remove("big", "small");
    table.classList.add(cl);
}
function setTableMode(mode: string) {
    table.setAttribute("simMode", mode);
}
function getTableMode(): string {
    return table.getAttribute("simMode") ?? "";
}


function writeSingleSimResponse(response: SingleSimResponse) {

}

function writeChainSimResponse(response: ChainSimResponse) {

}

function writeStepSimResponse(response: StepSimResponse) {

}

function writeSimAllResponse(response: SimAllResponse) {

}

function writeSimResponse(response: SimResponse) {
    if (response.responseType != "single") clearTable();
    

    switch (response.responseType) {
        case "single": writeSingleSimResponse(response); break;
        case "chain": writeChainSimResponse(response); break;
        case "step": writeStepSimResponse(response); break;
        case "all": writeSimAllResponse(response); break;
    }
}