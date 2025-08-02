import html2canvas from "html2canvas";
import { qs, event } from "../Utils/helpers.js";
import { global } from "../Sim/main.js";

//Buttons
const clear = qs(".clear");
const copyImage = qs(".imageC");
const downloadImage = qs(".imageD");

//Other elements
let tbody: HTMLElement;

const output = qs(".output");

event(clear, "pointerdown", () => {
  tbody = qs("tbody");
  while (tbody.firstChild) tbody.firstChild.remove();
  output.textContent = "";
  console.clear();
});

event(copyImage, "pointerdown", () => createImage(""));
event(downloadImage, "pointerdown", () => createImage("download"));

function createImage(mode: string) {
  html2canvas(qs(".simTable")).then((canvas) =>
    canvas.toBlob((blob) => {
      if (mode === "download") {
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = "output.png";
        a.click();
      } else {
        navigator.clipboard
          .write([new ClipboardItem({ "image/png": blob } as { [key: string]: Blob })])
          .then(() => {
            console.log("Sucsessfully created image!");
          })
          .catch(() => console.log("Failed creating image."));
      }
    })
  );
}

const saveDist = <HTMLButtonElement>qs(".saveDist");
const getDist = qs(".getDist");
const loadSave = qs(".loadSave");
const modeInput = <HTMLTextAreaElement>qs("textarea");

event(saveDist, "pointerdown", () => {
  if (modeInput.value.replace(" ", "").length === 0) return;
  saveDist.disabled = true;
  saveDist.innerHTML = "Saved!"
  localStorage.setItem("savedDistribution", modeInput.value);
  setTimeout(() => {
    saveDist.disabled = false;
    saveDist.innerHTML = "Save distribution"
  }, 1500);
});
event(getDist, "pointerdown", () => {
  modeInput.value = localStorage.getItem("savedDistribution") ?? modeInput.value;
});

event(loadSave, "pointerdown", () => {
  let presumedSaveFile = modeInput.value;
  const output = qs(".output");

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
