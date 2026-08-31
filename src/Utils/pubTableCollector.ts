import theoryClass from "../Theories/theory";

export abstract class BasePubTableCollector {
    // This hook is to be called in simulate method.
    abstract collectData(theory: theoryClass<any>): void;
}

export class NullPubTableCollector implements BasePubTableCollector {
    // Noop implementation
    collectData(theory: theoryClass<any>): void {}
}

export let noopCollector = new NullPubTableCollector();

export let collectorCache: Record<string, BasePubTableCollector> = {
    currentCollector: noopCollector
}
