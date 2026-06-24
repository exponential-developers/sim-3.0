/** Raises an exception */
const raise = (err: string) => {
  throw new Error(err);
};

// Consts
export const tau = `<span style="font-size:0.9rem; font-style:italics">&tau;</span>`;
export const rho = `<span style="font-size:0.9rem; font-style:italics">&rho;</span>`;
export const sigma_t = `<span style="font-size:0.9rem;">&sigma;</span><sub>t</sub>`;

/** Alias of document.querySelector */
export const qs = <T extends HTMLElement>(name: string) => document.querySelector<T>(name) ?? raise(`HtmlElement ${name} not found.`);
/** Alias of document.querySelectorAll */
export const qsa = <T extends HTMLElement>(name: string) => document.querySelectorAll<T>(name);
/** Alias of document.createElement */
export const ce = <T extends HTMLElement>(type: string) => (document.createElement(type) as T) ?? raise(`HtmlElement ${type} could not be created.`);
/** Adds an event listener to `element` */
export const event = <T>(element: HTMLElement, eventType: string, callback: (e: T) => void) => element.addEventListener(eventType, (e) => callback(e as T));

/** Removes all childs of `element` */
export const removeAllChilds = (element: HTMLElement) => {
  while (element.firstChild) element.firstChild.remove();
}

/**
 * Downloads a text file (usually csv) from a given string
 * @param str string to download
 * @param filename name of the file
 */
export function downloadString(str: string, filename: string) {
    const blob = new Blob([str], { type: 'text/csv;charset=utf-8;' });

    // Create a URL for the blob
    if ((navigator as any).msSaveBlob) { // IE 10+
        (navigator as any).msSaveBlob(blob, filename);
    } else {
        const link = ce('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link); // Clean up the DOM element
    }
}

export function getTableHeaders(tableType: "single" | "all" | "all_one", headerType: "html" | "text", sigma?: number): string[] {
  if (tableType !== "single") {
      let headers = [
          headerType === "html" ? `${sigma}${sigma_t}` : `${sigma}σ`,
          'Input'
      ];
      if (tableType == "all") headers.push('Ratio');
      headers.push(
          headerType === "html" ? `${tau}/h` : "τ/h",
          'Multi',
          'Strat',
          'Time',
          headerType === "html" ? `&Delta;${tau}` : "Δτ",
          headerType === "html" ? `Pub ${rho}` : "Pub ρ"
      )
      return headers;
  }
  else {
    let headers = [
      '<span style="padding-inline: 0.5rem">Theory</span>',
      headerType === "html" ? sigma_t : "σ",
      'Last Pub',
      'Max Rho',
      headerType === "html" ? `&Delta;${tau}` : "Δτ",
      'Multi',
      'Strat',
      headerType === "html" ? `${tau}/h` : "τ/h",
      'Pub Time'
    ];
    return headers;
  };
}

export function animateButton(button: HTMLButtonElement, text: string, delay = 1000, animateClass = "buttongreen") {
  const previousText = button.innerHTML;
  button.disabled = true;
  button.innerHTML = text;
  button.classList.add(animateClass);
  setTimeout(() => {
    button.disabled = false;
    button.innerHTML = previousText;
    button.classList.remove(animateClass);
  }, delay);
}

export function openDialog(dialog: HTMLDialogElement) {
  dialog.showModal();
  document.body.style.overflow = "hidden";
}

export function bindDialogCloseEvents(dialog: HTMLDialogElement, closeBtn: HTMLButtonElement, onClosed?: () => void) {
  event(closeBtn, "pointerdown", () => dialog.close());

  event(dialog, "close", () => {
    if (onClosed) onClosed();
    document.body.style.overflow = "auto";
  })
}