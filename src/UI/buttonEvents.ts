import html2canvas from "html2canvas";
import { qsa, ce, event, removeAllChilds, downloadString, getTableHeaders, animateButton, hide, show } from "../Utils/DOMhelpers";
import UI from "./elements";
import { refreshDOMEventLoop } from "../Utils/helpers";

event(UI.controls.clearResultsBtn, "pointerdown", () => {
  removeAllChilds(UI.outputs.tableBody);
  UI.outputs.log.textContent = "";
  console.clear();
});

event(UI.controls.clearInputsBtn, "pointerdown", () => {
  UI.controls.sigmaInput.value = "";
  UI.controls.currencyInput.value = "";
  UI.controls.capInput.value = "";
  UI.controls.simAllInputArea.value = "";
  UI.controls.extraInput.value = "";
})

event(UI.controls.copyImageBtn, "pointerdown", async () => {await createImage("copy")});
event(UI.controls.downloadImageBtn, "pointerdown", async () => {await createImage("download")});
event(UI.controls.downloadCsvBtn, "pointerdown", () => {
  if (UI.outputs.tableHeadRow.childElementCount == 0) {
    return;
  }
  downloadString(makeTableCsv(), "sim_results.csv");
})

async function createImage(mode: "download" | "copy") {
  if (UI.outputs.tableHeadRow.childElementCount == 0) {
    return;
  }

  const lastHeader = UI.outputs.getLastTableHeader();
  const varBuyCells = qsa(".varBuyCell");

  hide(lastHeader);
  varBuyCells.forEach((elem) => hide(elem));
  await refreshDOMEventLoop();

  html2canvas(UI.outputs.table).then((canvas) =>
    canvas.toBlob((blob) => {
      if (mode === "download") {
        const a = ce<HTMLAnchorElement>("a");
        a.href = canvas.toDataURL("image/png");
        a.download = "output.png";
        a.click();
      } else {
        if (blob == null) throw "blob is null";
        navigator.clipboard
          .write([new ClipboardItem({ "image/png": blob })])
          .then(() => {
            console.log("Sucsessfully created image and copied to clipboard!");
            animateButton(UI.controls.copyImageBtn, "Copied!");
          }).catch(() => console.log("Failed creating image."));
      }
    })
  )
  .catch(() => console.log("Failed creating image."));

  show(lastHeader);
  varBuyCells.forEach((elem) => show(elem));
}

function makeTableCsv(): string {
    let csvTotal = "";

    if (UI.outputs.table.classList.contains("big")) {
      let headers = getTableHeaders(
        UI.outputs.tableHeadRow.children.length == 10 ? "all" : "all_one",
        "text",
        Number(UI.outputs.tableHeadRow.children[0].innerHTML.match(/^\d+/))
      )
      csvTotal += headers.join(",") + ",\n";
      let rowIndex = 0;
      while (rowIndex < UI.outputs.tableBody.children.length) {
        let row = UI.outputs.tableBody.children[rowIndex];
        if (row.children.length >= 2) {
          if ((row.children[0] as HTMLTableCellElement).rowSpan == 2) {
            rowIndex++;
            let nextRow = UI.outputs.tableBody.children[rowIndex];
            let row1Content = [];
            let row2Content = [];
            let j = 0;
            for (let i = 0; i < UI.outputs.tableHeadRow.children.length - 1; i++) {
              if ((row.children[i] as HTMLTableCellElement).rowSpan == 2) {
                row1Content.push(row.children[i].innerHTML);
                row2Content.push(row.children[i].innerHTML);
              }
              else {
                row1Content.push(row.children[i].innerHTML);
                row2Content.push(nextRow.children[j].innerHTML);
                j += 1;
              }
            }
            csvTotal += row1Content.join(",") + ",\n";
            csvTotal += row2Content.join(",") + ",\n";
          }
          else {
            for (let i = 0; i < UI.outputs.tableHeadRow.children.length - 1; i++) {
              csvTotal += row.children[i].innerHTML + ",";
            }
            csvTotal += "\n";
          }
        }
        rowIndex++;
      }
    }
    else {
      let headers = getTableHeaders("single", "text");
      let h0match = headers[0].match(/<span[^>]*>(.*)<\/span>/);
      headers[0] = h0match == undefined ? headers[0] : (h0match.groups == undefined ? headers[0] : h0match.groups[0]);
      csvTotal += headers.join(",") + ",\n";
      for (let row of UI.outputs.tableBody.children) {
          if (row.children[0].innerHTML.trim().length == 0) {
            continue;
          }
          for (let i = 0; i < 9; i++) {
              csvTotal += row.children[i].innerHTML + ",";
          }
          csvTotal += "\n";
      }
    }

    return csvTotal;
}

event(UI.controls.saveDistBtn, "pointerdown", () => {
  const saveString = UI.controls.simAllInputArea.value;
  if (saveString.replace(" ", "").length === 0) return;
  localStorage.setItem("savedDistribution", saveString);
  animateButton(UI.controls.saveDistBtn, "Saved!");
});
event(UI.controls.getDistBtn, "pointerdown", () => {
  UI.controls.simAllInputArea.value = localStorage.getItem("savedDistribution") ?? UI.controls.simAllInputArea.value;
});

export async function loadSave(): Promise<void> {
  let presumedSaveFile = UI.controls.simAllInputArea.value.trim();

  return fetch("https://ex-save-loader.hotab.pw/load",{
    method: "POST",
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({savefile: presumedSaveFile})
  }).then(res => res.json()).then(r => {
    if(!r[1] || r[1] == "Not a savefile") {
      UI.outputs.log.textContent = "Error loading save file.";
    } else {
      UI.controls.simAllInputArea.value = r[1];
      animateButton(UI.controls.loadSaveBtn, "Loaded!")
    }
  }).catch(e => {
    UI.outputs.log.textContent = "Error loading save file.";
  });
}

event(UI.controls.loadSaveBtn, "pointerdown", loadSave);