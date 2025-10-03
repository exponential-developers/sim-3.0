import html2canvas from "html2canvas";
import { qs, ce, event, removeAllChilds } from "../Utils/DOMhelpers";

//Buttons
const clear = qs(".clear");
const copyImage = qs(".imageC");
const downloadImage = qs(".imageD");

const output = qs(".output");
const table = qs(".simTable")
const tbody = qs("tbody");

event(clear, "pointerdown", () => {
  removeAllChilds(tbody);
  output.textContent = "";
  console.clear();
});

event(copyImage, "pointerdown", () => createImage(""));
event(downloadImage, "pointerdown", () => createImage("download"));

function createImage(mode: string) {
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
          })
          .catch(() => console.log("Failed creating image."));
      }
    })
  )
  .catch(() => console.log("Failed creating image."));
}

const saveDist = qs<HTMLButtonElement>(".saveDist");
const getDist = qs(".getDist");
const loadSave = qs(".loadSave");
const simAllInputArea = qs<HTMLTextAreaElement>(".simAllInputArea");

event(saveDist, "pointerdown", () => {
  const saveString = simAllInputArea.value;
  if (saveString.replace(" ", "").length === 0) return;
  saveDist.disabled = true;
  saveDist.innerHTML = "Saved!"
  localStorage.setItem("savedDistribution", saveString);
  setTimeout(() => {
    saveDist.disabled = false;
    saveDist.innerHTML = "Save distribution"
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
