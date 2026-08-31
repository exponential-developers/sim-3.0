import theoryClass from "../Theories/theory";

export abstract class BasePubTableCollector {
    // This hook is to be called in simulate method.
    abstract collectData(theory: theoryClass<any>): void;
}

export class NullPubTableCollector implements BasePubTableCollector {
    // Noop implementation
    collectData(theory: theoryClass<any>): void {}
}

export class StepPubTableCollector implements BasePubTableCollector {
    lastPub: number;
    step: number;
    cap: number;
    timings: number[];

    constructor(lastPub: number, step: number, cap: number) {
        this.lastPub = lastPub;
        this.step = step;
        // We can reach lastPub immediately.
        this.timings = [0];
        this.cap = cap;
    }
    collectData(theory: theoryClass<any>): void {
        if (theory.maxRho > this.cap + this.step) {
            // We are not interested if we are over cap.
            return;
        }
        if(theory.maxRho < theory.pubUnlock || theory.maxRho < this.lastPub) {
            // We are not interested if pubs are not yet available.
            return;
        }
        let delta = theory.maxRho - this.lastPub;
        let delta_num = Math.floor(delta / this.step);
        // console.log(theory.maxRho, this.lastPub, delta, delta_num);
        while (this.timings.length <= delta_num) {
            this.timings.push(theory.t)
        }
        // Update specific timing reachability:
        if(theory.t < this.timings[delta_num]) {
            this.timings[delta_num] = theory.t;
        }
    }
}

export let noopCollector = new NullPubTableCollector();

type currentCollectorType = "currentCollector";

export let collectorCache: Record<currentCollectorType, BasePubTableCollector> = {
    currentCollector: noopCollector
}
