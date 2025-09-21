/** Raises an exception */
const raise = (err: string) => {
  throw new Error(err);
};
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