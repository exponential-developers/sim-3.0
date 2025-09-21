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
const modeInput = qs<HTMLTextAreaElement>("textarea");

event(saveDist, "pointerdown", () => {
  if (modeInput.value.replace(" ", "").length === 0) return;
  saveDist.disabled = true;
  saveDist.innerHTML = "Saved!"
  localStorage.setItem("savedDistribution", modeInput.value);
  setTimeout(() => {
    saveDist.disabled = false;
    saveDist.innerHTML = "Save distribution"
  }, 1000);
});
event(getDist, "pointerdown", () => {
  modeInput.value = localStorage.getItem("savedDistribution") ?? modeInput.value;
});

event(loadSave, "pointerdown", () => {
  let presumedSaveFile = modeInput.value;

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
      modeInput.value = r[1];
    }
  }).catch(e => {
    output.textContent = "Error loading save file.";
  })
})
