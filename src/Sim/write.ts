import jsonData from "../Data/data.json" assert { type: "json" };
import { convertTime, formatNumber, isMainTheory, logToExp } from "../Utils/helpers";
import { qs, qsa, ce, event, removeAllChilds, downloadString } from "../Utils/DOMhelpers";

// Settings
const generateTotalPurchaseList = qs<HTMLInputElement>(".totalPurchaseList");

// Outputs
const table = qs(".simTable");
const theadRow = qs<HTMLTableRowElement>(".simTable > thead > tr");
const tbody = qs(".simTable > tbody");

const varBuyDialog = qs<HTMLDialogElement>(".boughtVars");
const varBuyTable = qs<HTMLTableSectionElement>(".boughtVarsOtp");
const varBuyListCloseBtn = qs<HTMLButtonElement>(".boughtVarsCloseBtn");

// Consts
const tau = `<span style="font-size:0.9rem; font-style:italics">&tau;</span>`;
const rho = `<span style="font-size:0.9rem; font-style:italics">&rho;</span>`;

const downloadIcon = '<svg xmlns="http://www.w3.org" width="24" height="24" viewBox="0 0 24 24" ' +
        'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' +
        'class="feather feather-download">\n' +
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>' +
    '<polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>\n' +
    '</svg>'

const eyeIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" ' + 
        'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' + 
        'stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye">\n' + 
    ' <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>\n' + 
    ' <circle cx="12" cy="12" r="3"></circle>\n' + 
    '</svg>';

let totalBuys: varBuy[] = [];

// Utils
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
function setTableHeaders(...headers: string[]) {
    removeAllChilds(theadRow);
    headers.forEach(header => {
        const cell = ce("th");
        cell.innerHTML = header;
        theadRow.appendChild(cell);
    })
}

/**
 * Adds a cell to a HTML table
 * @param row The HTML table to append the cell to
 * @param content The HTML content of the cell
 * @param rowspan The rowspan of the cell (default 1)
 */
function addTableCell(row: HTMLTableRowElement, content: string, rowspan = 1) {
    const cell = ce("td");
    cell.innerHTML = content;
    if (rowspan > 1) cell.setAttribute("rowspan", String(rowspan));
    row.appendChild(cell);
}

/**
 * Fills an HTML row with empty cells
 * @param row The HTML row to fill
 * @param count The number of empty cells to add
 */
function fillTableRow(row: HTMLTableRowElement, count: number) {
    for (let i = 0; i < count; i++) addTableCell(row, "");
}

function makeVarBuyCsv(arr: varBuy[]): string {
    let csvTotal = "variable,level,cost,timeStamp\n";
    for(let item of arr) {
        csvTotal += `"${item.variable}",${item.level},${logToExp(item.cost, 2)}${getCurrencySymbol(item.symbol)},${convertTime(item.timeStamp)}\n`;
    }
    return csvTotal;
}

function addVarBuyCell(row: HTMLTableRowElement, buys: varBuy[], addToTotal = true, rowspan = 1) {
    if (addToTotal && generateTotalPurchaseList.checked) {
        totalBuys.push(...buys);
        totalBuys.push({variable: "---", level: 0, cost: 0, timeStamp: 0});
    }

    const cell = ce("td");
    cell.classList.add("varBuyCell");

    const viewBtn = ce("div");
    viewBtn.innerHTML = eyeIcon;
    viewBtn.onclick = () => openVarModal(buys);

    const downloadBtn = ce("a");
    downloadBtn.innerHTML = downloadIcon;
    downloadBtn.onclick = () => {
        const csvOut = makeVarBuyCsv(buys);
        downloadString(csvOut, "buys.csv");
    }

    cell.appendChild(viewBtn);
    cell.appendChild(downloadBtn);
    
    if (rowspan > 1) cell.setAttribute("rowspan", String(rowspan));
    row.appendChild(cell);
}

// Var buy utils

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

/** Highlights MF reset cells */
function highlightResetCells() {
  const cells = qsa<HTMLTableCellElement>('.boughtVars tr td:nth-child(1)');
  cells.forEach(cell => {
    if (cell.innerText.toLowerCase().includes('reset at')) {
      cell.classList.add('highlighted');
    }
  });
}

/** Generates and open the var buy list */
function openVarModal(arr: varBuy[]) {
  document.body.style.overflow = "hidden";
  varBuyDialog.showModal();
  removeAllChilds(varBuyTable);
  for (let varBuy of arr) {
    const row = ce<HTMLTableRowElement>("tr");
    addTableCell(row, varBuy.variable);
    addTableCell(row, varBuy.level.toString());
    addTableCell(row, `${logToExp(varBuy.cost, 2)}<span style="margin-left:.1em">${getCurrencySymbol(varBuy.symbol)}</span>`);
    addTableCell(row, convertTime(varBuy.timeStamp));
    varBuyTable.appendChild(row);
  }
  highlightResetCells();
}

event(varBuyListCloseBtn, "pointerdown", () => varBuyDialog.close());

event(varBuyDialog, "close", () => document.body.style.overflow = "auto");

// Response writers

function writeSingleSimResponse(response: SingleSimResponse) {
    const res = response.result;
    const row = ce<HTMLTableRowElement>("tr");
    addTableCell(row, res.theory);
    addTableCell(row, res.sigma.toString());
    addTableCell(row, logToExp(res.lastPub, 2));
    addTableCell(row, logToExp(res.pubRho, 2));
    addTableCell(row, logToExp(res.deltaTau, 2));
    addTableCell(row, formatNumber(res.pubMulti));
    addTableCell(row, res.strat);
    addTableCell(row, res.tauH == 0 ? "0" : formatNumber(res.tauH));
    addTableCell(row, convertTime(res.time));
    addVarBuyCell(row, res.boughtVars);
    tbody.append(row);
}

function writeChainSimResponse(response: ChainSimResponse) {
    response.results.forEach(res => writeSingleSimResponse({
        responseType: "single",
        result: res
    }));
    const labelRow = ce<HTMLTableRowElement>("tr");
    const resRow = ce<HTMLTableRowElement>("tr");

    fillTableRow(labelRow, 4);
    fillTableRow(resRow, 4);

    addTableCell(labelRow, "ΔTau Total");
    addTableCell(resRow, logToExp(response.deltaTau, 2));

    fillTableRow(labelRow, 2);
    fillTableRow(resRow, 2);

    addTableCell(labelRow, `Average ${tau}/h`);
    addTableCell(resRow, formatNumber(response.averageRate, 5));

    addTableCell(labelRow, `Total Time`);
    addTableCell(resRow, convertTime(response.totalTime));

    fillTableRow(labelRow, 1);
    if(generateTotalPurchaseList.checked) {
        addVarBuyCell(resRow, totalBuys, false);
    }
    else {
        fillTableRow(resRow, 1);
    }

    tbody.append(labelRow);
    tbody.append(resRow);
}

function writeStepSimResponse(response: StepSimResponse) {
    response.results.forEach(res => writeSingleSimResponse({
        responseType: "single",
        result: res
    }));
    if (generateTotalPurchaseList.checked) {
        const resRow = ce<HTMLTableRowElement>("tr");
        fillTableRow(resRow, 8);
        addTableCell(resRow, "Total");
        addVarBuyCell(resRow, totalBuys, false);
        tbody.append(resRow);
    }
}

function writeSimAllResponse(response: SimAllResponse) {
    const completeSimAllLine = (row: HTMLTableRowElement, res: simResult) => {
        addTableCell(row, res.tauH == 0 ? "0" : formatNumber(res.tauH));
        addTableCell(row, formatNumber(res.pubMulti));
        addTableCell(row, res.strat);
        addTableCell(row, convertTime(res.time));
        addTableCell(row, logToExp(res.deltaTau, 2));
        addTableCell(row, logToExp(res.pubRho, 2));
        addVarBuyCell(row, res.boughtVars);
    }

    let sets: simAllResult[][] = [[], [], []];
    response.results.forEach((res, i) => {
        if (isMainTheory(res.theory)) {
            sets[0].push(res);
        }
        else {
            if (response.completedCTs === "end" && res.lastPub * jsonData.theories[res.theory].tauFactor >= 600) {
                sets[2].push(res);
            }
            else sets[1].push(res);
        }
    });
    sets = sets.filter(set => set.length > 0);

    sets.forEach((set, i) => {
        set.forEach(res => {
            if (response.stratType == "all") {
                const rowActive = ce<HTMLTableRowElement>("tr");
                const rowPassive = ce<HTMLTableRowElement>("tr");

                addTableCell(rowActive, res.theory, 2);
                addTableCell(rowActive, logToExp(res.lastPub, 2), 2);
                addTableCell(rowActive, formatNumber(res.ratio, 4), 2);

                completeSimAllLine(rowActive, res.active);
                completeSimAllLine(rowPassive, res.idle);

                tbody.appendChild(rowActive);
                tbody.appendChild(rowPassive);
            }
            else {
                const uniqueRes = response.stratType == "active" ? res.active : res.idle;
                const row = ce<HTMLTableRowElement>("tr");

                addTableCell(row, res.theory);
                addTableCell(row, logToExp(res.lastPub, 2));
                completeSimAllLine(row, uniqueRes);

                tbody.appendChild(row);
            }
        })

        if (i < sets.length - 1) {
            const bufferRow1 = ce<HTMLTableRowElement>("tr");
            const bufferRow2 = ce<HTMLTableRowElement>("tr");

            bufferRow1.style.display = "none";
            addTableCell(bufferRow2, "---");

            tbody.appendChild(bufferRow1);
            tbody.appendChild(bufferRow2);
        }
    })
}

export function writeSimResponse(response: SimResponse) {
    const mode = response.responseType;

    if (mode != "single" || getTableMode() != mode) {
        setTableClass(mode == "all" ? "big" : "small");
        setTableMode(mode);
        clearTable();
    }
    if (mode === "all") {
        let headers = [
            `${response.sigma}<span style="font-size:0.9rem;">&sigma;</span><sub>t</sub>`,
            'Input'
        ];
        if (response.stratType == "all") headers.push('Ratio');
        headers.push(
            `${tau}/h`,
            'Multi',
            'Strat',
            'Time',
            `&Delta;${tau}`,
            `Pub ${rho}`,
            'Var Buys'
        )
        setTableHeaders(...headers);
    }
    else setTableHeaders(
        '<span style="padding-inline: 0.5rem">Theory</span>',
        '<span style="font-size:0.9rem;">&sigma;</span><sub>t</sub>',
        'Last Pub',
        'Max Rho',
        `&Delta;${tau}`,
        'Multi',
        'Strat',
        `${tau}/h`,
        'Pub Time',
        'Var Buys'
    );

    totalBuys = [];

    switch (mode) {
        case "single": writeSingleSimResponse(response); break;
        case "chain": writeChainSimResponse(response); break;
        case "step": writeStepSimResponse(response); break;
        case "all": writeSimAllResponse(response); break;
    }
}
