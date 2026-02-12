import html2canvas from "html2canvas";
import { qs, qsa, ce, event, removeAllChilds, downloadString } from "../Utils/DOMhelpers";

//Buttons
const clear = qs(".clear");
const copyImage = qs<HTMLButtonElement>(".imageC");
const downloadImage = qs(".imageD");
const downloadCsv = qs(".csvD");
const clearInput = qs(".clearInput");

const saveDist = qs<HTMLButtonElement>(".saveDist");
const getDist = qs(".getDist");
const loadSave = qs(".loadSave");
const sigmaInput = qs<HTMLInputElement>(".sigma");
const currencyInput = qs<HTMLInputElement>(".input");
const capInput = qs<HTMLInputElement>(".cap");
const simAllInputArea = qs<HTMLTextAreaElement>(".simAllInputArea");
const modeInput = qs<HTMLTextAreaElement>(".modeInput");


const output = qs(".output");
const table = qs(".simTable");
const tbody = qs(".simTable tbody");

event(clear, "pointerdown", () => {
  removeAllChilds(tbody);
  output.textContent = "";
  console.clear();
});

event(clearInput, "pointerdown", () => {
  sigmaInput.value = "";
  currencyInput.value = "";
  capInput.value = "";
  simAllInputArea.value = "";
  modeInput.value = "";
})

event(copyImage, "pointerdown", () => createImage(""));
event(downloadImage, "pointerdown", () => createImage("download"));
event(downloadCsv, "pointerdown", () => {
  if (table.children[0].children[0].childElementCount == 0) {
    return;
  }
  downloadString(makeTableCsv(), "sim_results.csv");
})

function createImage(mode: string) {
  if (table.children[0].children[0].childElementCount == 0) {
    return;
  }

  const lastHeader = qs(".simTable thead tr th:last-child");
  const varBuyCells = qsa(".varBuyCell");

  const initialLastHeaderDisplay = lastHeader.style.display;
  lastHeader.style.display = "none";
  varBuyCells.forEach((elem) => elem.style.display = "none");

  html2canvas(table).then((canvas) =>
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
            copyImage.disabled = true;
            copyImage.innerHTML = "Copied!";
            copyImage.classList.add("buttongreen");
            setTimeout(() => {
              copyImage.disabled = false;
              copyImage.innerHTML = "Copy Image";
              copyImage.classList.remove("buttongreen");
            }, 1000);
          })
          .catch(() => console.log("Failed creating image."));
      }
    })
  )
  .catch(() => console.log("Failed creating image."));

  lastHeader.style.display = initialLastHeaderDisplay;
  varBuyCells.forEach((elem) => elem.style.display = "flex");
}

function makeTableCsv(): string {
    const theadRow = qs(".simTable thead tr");

    let csvTotal = "";

    if (table.classList.contains("big")) {
      for (let i = 0; i < theadRow.children.length - 1; i++) {
        csvTotal += theadRow.children[i].innerHTML + ",";
      }
      csvTotal += "\n";
      let rowIndex = 0;
      while (rowIndex < tbody.children.length) {
        let row = tbody.children[rowIndex];
        if (row.children.length >= 2) {
          if ((row.children[0] as HTMLTableCellElement).rowSpan == 2) {
            rowIndex++;
            let nextRow = tbody.children[rowIndex];
            let row1Content = [];
            let row2Content = [];
            let j = 0;
            for (let i = 0; i < theadRow.children.length - 1; i++) {
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
            for (let i = 0; i < 9; i++) {
              csvTotal += row.children[i].innerHTML + ",";
            }
            csvTotal += "\n";
          }
        }
        rowIndex++;
      }
    }
    else {
      for (let i = 0; i < 9; i++) {
        csvTotal += theadRow.children[i].innerHTML + ",";
      }
      csvTotal += "\n";
      for (let row of tbody.children) {
          for (let i = 0; i < 9; i++) {
              csvTotal += row.children[i].innerHTML + ",";
          }
          csvTotal += "\n";
      }
    }

    return csvTotal;
}

event(saveDist, "pointerdown", () => {
  const saveString = simAllInputArea.value;
  if (saveString.replace(" ", "").length === 0) return;
  saveDist.disabled = true;
  saveDist.innerHTML = "Saved!";
  saveDist.classList.add("buttongreen");
  localStorage.setItem("savedDistribution", saveString);
  setTimeout(() => {
    saveDist.disabled = false;
    saveDist.innerHTML = "Save distribution";
    saveDist.classList.remove("buttongreen")
  }, 1000);
});
event(getDist, "pointerdown", () => {
  simAllInputArea.value = localStorage.getItem("savedDistribution") ?? simAllInputArea.value;
});

event(loadSave, "pointerdown", () => {
  let presumedSaveFile = simAllInputArea.value;

  fetch("https://ex-save-loader.hotab.pw/load",{
    method: "POST",
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({savefile: presumedSaveFile})
  }).then(res => res.json()).then(r => {
    if(!r[1] || r[1] == "Not a savefile") {
      output.textContent = "Error loading save file.";
    } else {
      simAllInputArea.value = r[1];
    }
  }).catch(e => {
    output.textContent = "Error loading save file.";
  })
})