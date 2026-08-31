import theoryClass from "../Theories/theory";

export abstract class BasePubTableCollector {
    // This hook is to be called in simulate method.
    abstract collectData(theory: theoryClass<any>): void;
}

export class NullPubTableCollector {
    // Noop implementation
    collectData(theory: theoryClass<any>): void {}
}

export let noopCollector = new NullPubTableCollector();
