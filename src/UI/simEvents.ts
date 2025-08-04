import { simulate, inputData, global } from "../Sim/main.js";
import { qs, event, sleep, ce, qsa, convertTime, logToExp, resultIsSimResult, resultIsSimAllResult, resultIsCombinedResult } from "../Utils/helpers.js";
import { getSimState, setSimState } from "./simState.js";
import jsondata from "../Data/data.json" assert { type: "json" };
import { json } from "stream/consumers";
import { theoryUpdate } from "./render.js";

//Inputs
const theory = qs<HTMLSelectElement>(".theory");
const strat = qs<HTMLSelectElement>(".strat");
const sigma = qs<HTMLInputElement>(".sigma");
const input = qs<HTMLInputElement>(".input");
const cap = qs<HTMLInputElement>(".cap");
const mode = qs<HTMLSelectElement>(".mode");
const modeInput = qs<HTMLInputElement>("textarea");
const timeDiffInputs = qsa<HTMLInputElement>(".timeDiffInput");
const hardCap = qs<HTMLInputElement>(".hardCap");
const semi_idle = qs<HTMLInputElement>(".semi-idle");
const hard_active = qs<HTMLInputElement>(".hard-active");

//Outputs
const output = qs(".output");
let table = qs(".simTable");
let thead = qs(".simTable > thead");
let tbody = qs(".simTable > tbody");

//Buttons
const simulateButton = qs(".simulate");

//Setting Inputs
const dtOtp = qs(".dtOtp");
const ddtOtp = qs(".ddtOtp");
const mfDepthOtp = qs(".mfDepthOtp");
const simAllStrats = <HTMLSelectElement>qs(".simallstrats");
const skipCompletedCTs = <HTMLInputElement>qs(".skipcompletedcts");
const showA23 = <HTMLInputElement>qs(".a23");
const showUnofficials = <HTMLInputElement>qs(".unofficials");

const theories = Object.keys(jsondata.theories) as Array<theoryType>;

let prevMode = "All";

const tau = `<span style="font-size:0.9rem; font-style:italics">&tau;</span>`;
const rho = `<span style="font-size:0.9rem; font-style:italics">&rho;</span>`;

const tableHeaders = {
  current: "All",
  single: `<tr><th style="padding-inline: 0.5rem !important">Theory</th><th><span style="font-size:0.9rem;">&sigma;</span><sub>t</sub></th><th>Last Pub</th><th>Max Rho</th><th>&Delta;${tau}</th><th>Multi</th><th>Strat</th><th>${tau}/h</th><th>Pub Time</th></tr>`,
  all: `<tr><th>&emsp;</th><th>Input</th><th>Ratio</th><th>${tau}/h</th><th>Multi</th><th>Strat</th><th>Time</th><th>&Delta;${tau}</th><th>Pub ${rho}</th></tr>`,
};
thead.innerHTML = tableHeaders.all;
table.classList.add("big");

event(showUnofficials, "click", async () => {
  if (global.showUnofficials != showUnofficials.checked)
  {
    global.showUnofficials = showUnofficials.checked;
    while (theory.firstChild) theory.firstChild.remove();
    for (let i = 0; i < theories.length; i++) {
      if ((jsondata.theories[theories[i]] as unknown as Record<"UI_visible", boolean>).UI_visible === false && !global.showUnofficials) continue;
      const option = ce<HTMLSelectElement>("option");
      option.value = theories[i];
      option.textContent = theories[i];
      theory.appendChild(option);
      theoryUpdate();
    }
  }
})

event(simulateButton, "click", async () => {
  global.dt = parseFloat(dtOtp.textContent ?? "1.5");
  global.ddt = parseFloat(ddtOtp.textContent ?? "1.0001");
  global.mfResetDepth = parseInt(mfDepthOtp.textContent ?? "0");
  global.stratFilter = true;
  global.simAllStrats = simAllStrats.value;
  global.skipCompletedCTs = skipCompletedCTs.checked;
  global.showA23 = showA23.checked;
  localStorage.setItem("simAllSettings", JSON.stringify([semi_idle.checked, hard_active.checked]));
  const data: inputData = {
    theory: theory.value as theoryType,
    strat: strat.value,
    sigma: sigma.value.replace(" ", ""),
    rho: input.value.replace(" ", ""),
    cap: cap.value.replace(" ", ""),
    mode: mode.value,
    modeInput: modeInput.value,
    simAllInputs: [semi_idle.checked, hard_active.checked],
    timeDiffInputs: [],
    hardCap: hardCap.checked,
  };
  for (const element of timeDiffInputs) {
    data.timeDiffInputs.push(element.value);
  }
  updateTablePreprocess();
  output.textContent = "";
  simulateButton.textContent = "Stop simulating";
  await sleep();
  const res = await simulate(data);
  if (typeof res === "string") output.textContent = res;
  else output.textContent = "";
  if (res !== null && typeof res !== "string") updateTable(res);
  simulateButton.textContent = "Simulate";
  global.simulating = false;
  setSimState();
});

function updateTablePreprocess(): void {
  if (prevMode !== mode.value) clearTable();
  prevMode = mode.value;
  if (mode.value === "All") {
    table.classList.add("big");
    table.classList.remove("small");
    thead.innerHTML = tableHeaders.all;
    if (global.simAllStrats !== "all") {
      thead.children[0].removeChild(thead.children[0].children[2]);
    }
  } else {
    table.classList.remove("big");
    table.classList.add("small");
    thead.innerHTML = tableHeaders.single;
  }
  if (mode.value !== "Single sim") clearTable();
}

function updateTable(arr: Array<generalResult>): void {
  const addCell = (row: HTMLTableRowElement, content: any) => {
    const cell = ce("td");
    cell.innerHTML = String(content);
    row.appendChild(cell);
  }

  const addCellRowspan = (row: HTMLTableRowElement, content: any, rowspan: string) => {
    const cell = ce("td");
    cell.innerHTML = String(content);
    cell.setAttribute("rowspan", rowspan);
    row.appendChild(cell);
  }

  const bindVarBuy = (row: HTMLTableRowElement, buys: Array<varBuy>) => {
    (<HTMLElement>row?.lastChild).onclick = () => {
      openVarModal(buys);
    };
    (<HTMLElement>row?.lastChild).style.cursor = "pointer";
  }

  if(mode.value == "All") {
    for (let i = 0; i < arr.length; i++) {
      let res: generalResult = arr[i];
      if (resultIsSimAllResult(res)) {
        if (i == 0) {
          thead.children[0].children[0].innerHTML = String(res.active.sigma) + '<span style="font-size:0.9rem;">&sigma;</span><sub>t</sub>';
        }

        const rowActive = <HTMLTableRowElement>ce("tr");
        const rowPassive = <HTMLTableRowElement>ce("tr");

        // Theory name cell:
        addCellRowspan(rowActive, res.theory, "2");

        // Input cell:
        addCellRowspan(rowActive, res.lastPub, "2");

        // Ratio cell:
        addCellRowspan(rowActive, res.ratio, "2");

        addCell(rowActive, res.active.tauH);
        addCell(rowActive, res.active.pubMulti);
        addCell(rowActive, res.active.strat);
        addCell(rowActive, res.active.time);
        addCell(rowActive, res.active.deltaTau);
        addCell(rowActive, res.active.pubRho);

        addCell(rowPassive, res.idle.tauH);
        addCell(rowPassive, res.idle.pubMulti);
        addCell(rowPassive, res.idle.strat);
        addCell(rowPassive, res.idle.time);
        addCell(rowPassive, res.idle.deltaTau);
        addCell(rowPassive, res.idle.pubRho);

        tbody.appendChild(rowActive);
        tbody.appendChild(rowPassive);

        bindVarBuy(rowActive, res.active.boughtVars);
        bindVarBuy(rowPassive, res.idle.boughtVars);
      } 
      else if (resultIsSimResult(res)) {
        if (i == 0) {
          thead.children[0].children[0].innerHTML = String(res.sigma) + '<span style="font-size:0.9rem;">&sigma;</span><sub>t</sub>';
        }

        const row = <HTMLTableRowElement>ce("tr");

        addCell(row, res.theory);
        addCell(row, res.lastPub);
        addCell(row, res.tauH);
        addCell(row, res.pubMulti);
        addCell(row, res.strat);
        addCell(row, res.time);
        addCell(row, res.deltaTau);
        addCell(row, res.pubRho);

        tbody.appendChild(row);
        bindVarBuy(row, res.boughtVars);
      }

      // Buffer between main theories and CTs

      if (i < arr.length - 1) {
        const next = arr[i + 1];
        const lastTheory = (resultIsSimAllResult(res) ? res.active.theory : resultIsSimResult(res) ? res.theory : "");
        const nextTheory = (resultIsSimAllResult(next) ? next.active.theory : resultIsSimResult(next) ? next.theory : "");
        if (lastTheory.match(/T[1-8]/) && !nextTheory.match(/T[1-8]/)){
          const bufferRow1 = <HTMLTableRowElement>ce("tr");
          const bufferRow2 = <HTMLTableRowElement>ce("tr");
          
          bufferRow1.style.display = "none";
          addCell(bufferRow2, "---");

          tbody.appendChild(bufferRow1);
          tbody.appendChild(bufferRow2)
        }
      }
    }
  }
  else {
    for (let i = 0; i < arr.length; i++) {
      const res = arr[i];
      const row = <HTMLTableRowElement>ce("tr");
      if (resultIsSimResult(res)) {
        addCell(row, res.theory);
        addCell(row, res.sigma);
        addCell(row, res.lastPub);
        addCell(row, res.pubRho);
        addCell(row, res.deltaTau);
        addCell(row, res.pubMulti);
        addCell(row, res.strat);
        addCell(row, res.tauH);
        addCell(row, res.time);
        bindVarBuy(row, res.boughtVars);
      }
      else if (resultIsCombinedResult(res)) {
        for (let i = 0; i < 4; i++) { addCell(row, "") }
        addCell(row, res[0]);
        for (let i = 0; i < 2; i++) { addCell(row, "") }
        addCell(row, res[1]);
        addCell(row, res[2]);
      }
      tbody.appendChild(row);
    }
  }
}

function highlightResetCells() {
  const cells = document.querySelectorAll('.boughtVars tr td:nth-child(1)');
  cells.forEach(cell => {
    const htmlCell = cell as HTMLElement;
    if (htmlCell.innerText.toLowerCase().includes('reset at')) {
      htmlCell.classList.add('highlighted');
    }
  });
}

function openVarModal(arr: Array<varBuy>) {
  document.body.style.overflow = "hidden";
  (<HTMLDialogElement>qs(".boughtVars")).showModal();
  const tbody = qs(".boughtVarsOtp");
  while (tbody.firstChild) tbody.firstChild.remove();
  for (let i = 0; i < arr.length; i++) {
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    td1.innerText = arr[i].variable;
    tr.appendChild(td1);
    const td2 = document.createElement("td");
    td2.innerText = arr[i].level.toString();
    tr.appendChild(td2);
    const td3 = document.createElement("td");
    td3.innerHTML = `${logToExp(arr[i].cost, 2)}<span style="margin-left:.1em">${getCurrencySymbol(arr[i].symbol)}</span>`;
    tr.appendChild(td3);
    const td4 = document.createElement("td");
    td4.innerText = convertTime(arr[i].timeStamp);
    tr.appendChild(td4);
    tbody.appendChild(tr);
  }
  highlightResetCells();
}
function getCurrencySymbol(value: string | undefined): string {
  if (value === undefined || value === "rho") return "\u03C1";
  if (value === "lambda") return "\u03BB";
  if (value === "delta") return "\u03B4"
  if (/_/.test(value)) {
    value = value.replace(/{}/g, "");
    const split = value.split("_");
    return `${getCurrencySymbol(split[0])}<sub>${split[1]}</sub>`;
  }
  return value;
}
event(qs(".boughtVarsCloseBtn"), "pointerdown", () => {
  (<HTMLDialogElement>qs(".boughtVars")).close();
  document.body.style.overflow = "auto";
});
function clearTable(): void {
  while (tbody.firstChild) tbody.firstChild.remove();
}
