var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, sleep, binarySearch, getBestResult } from "../../Utils/helpers.js";
import { ExponentialValue, StepwisePowerSumValue } from "../../Utils/value";
import Variable from "../../Utils/variable.js";
import { theoryClass } from "../theory.js";
import { ExponentialCost, FirstFreeCost } from '../../Utils/cost.js';
export default function mf(data) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield ((new mfSimWrap(data)).simulate());
    });
}
const mu0 = 4e-7 * Math.PI;
const q0 = 1.602e-19;
const i0 = 1e-15;
const m0 = 1e-3;
class mfSim extends theoryClass {
    getBuyingConditions() {
        const autobuyall = new Array(9).fill(true);
        const idleStrat = [
            ...new Array(5).fill(() => !this.buyV),
            ...new Array(4).fill(() => this.buyV)
        ];
        const activeStrat = [
            () => {
                if (this.buyV) {
                    return false;
                }
                if (this.normalPubRho != -1 && Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost) > this.normalPubRho - l10(2)) {
                    return this.variables[0].cost + l10(10) <= this.normalPubRho;
                }
                else {
                    return this.variables[0].cost + l10(9.9) <= Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost);
                }
            },
            () => {
                if (this.buyV) {
                    return false;
                }
                if (this.normalPubRho == -1) {
                    return true;
                }
                return this.variables[1].cost <= this.normalPubRho - l10(2);
            },
            () => {
                if (this.buyV) {
                    return false;
                }
                if (this.normalPubRho != -1 && Math.min(this.variables[1].cost, this.variables[3].cost, this.variables[4].cost) > this.normalPubRho - l10(2)) {
                    return this.variables[2].cost + l10(10) <= this.normalPubRho;
                }
                else {
                    return this.i / (i0 * Math.pow(10, this.variables[3].value)) < 0.5 || this.variables[2].cost + 1 < this.maxRho;
                }
            },
            () => {
                if (this.buyV) {
                    return false;
                }
                if (this.normalPubRho == -1) {
                    return true;
                }
                return this.variables[3].cost <= this.normalPubRho - l10(2);
            },
            () => {
                if (this.buyV) {
                    return false;
                }
                if (this.normalPubRho == -1) {
                    return this.variables[4].cost < Math.min(this.variables[1].cost, this.variables[3].cost);
                }
                return (this.variables[4].cost <= this.normalPubRho - l10(2)) && this.variables[4].cost < Math.min(this.variables[1].cost, this.variables[3].cost);
            },
            ...new Array(4).fill(() => this.buyV)
        ];
        const activeStrat2 = [
            () => {
                if (this.buyV) {
                    return false;
                }
                const dPower = [3.09152, 3.00238, 2.91940];
                return this.variables[0].cost + l10(8 + (this.variables[0].level % 7)) <= Math.min(this.variables[1].cost + l10(2), this.variables[3].cost, this.milestones[1] * (this.variables[4].cost + l10(dPower[this.milestones[2]])));
            },
            () => {
                return !this.buyV;
            },
            () => {
                if (this.buyV) {
                    return false;
                }
                return l10(this.i) + l10(1.2) < this.variables[3].value - 15 || (this.variables[2].cost + l10(20) < this.maxRho && l10(this.i) + l10(1.012) < this.variables[3].value - 15);
            },
            () => {
                return !this.buyV;
            },
            () => {
                if (this.buyV) {
                    return false;
                }
                const dPower = [3.09152, 3.00238, 2.91940];
                return this.variables[4].cost + l10(dPower[this.milestones[2]]) < Math.min(this.variables[1].cost + l10(2), this.variables[3].cost);
            },
            ...new Array(4).fill(() => this.buyV)
        ];
        const tailActiveGen = (i, offset) => {
            return () => {
                if (this.maxRho <= this.lastPub + offset) {
                    if (idleStrat[i] == true) {
                        return true;
                    }
                    return idleStrat[i]();
                }
                else {
                    if (activeStrat[i] == true) {
                        return true;
                    }
                    return activeStrat[i]();
                }
            };
        };
        function makeMFdPostRecovery(offset) {
            let tailActive = [];
            for (let i = 0; i < 9; i++) {
                tailActive.push(tailActiveGen(i, offset));
            }
            return tailActive;
        }
        const conditions = {
            MF: idleStrat,
            MFd: activeStrat,
            MFd2: activeStrat2,
            MFd2SLOW: activeStrat2,
            MFdPostRecovery0: makeMFdPostRecovery(0),
            MFdPostRecovery1: makeMFdPostRecovery(1),
            MFdPostRecovery2: makeMFdPostRecovery(2),
            MFdPostRecovery3: makeMFdPostRecovery(3),
            MFdPostRecovery4: makeMFdPostRecovery(4),
            MFdPostRecovery5: makeMFdPostRecovery(5),
            MFdPostRecovery6: makeMFdPostRecovery(6),
            MFdPostRecovery7: makeMFdPostRecovery(7),
            MFdPostRecovery8: makeMFdPostRecovery(8),
            MFdPostRecovery9: makeMFdPostRecovery(9)
        };
        const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
        return condition;
    }
    getMilestoneConditions() {
        const conditions = [
            () => true,
            () => true,
            () => true,
            () => true,
            () => this.milestones[1] > 0,
            () => true,
            () => true,
            () => this.milestones[0] > 0,
            () => this.milestones[0] > 0
        ];
        return conditions;
    }
    getMilestoneTree() {
        const globalOptimalRoute = [
            [0, 0, 0, 0, 0, 0],
            [1, 0, 0, 0, 0, 0],
            [1, 1, 0, 0, 0, 0],
            [1, 1, 1, 0, 0, 0],
            [1, 1, 2, 0, 0, 0],
            [1, 1, 2, 1, 0, 0],
            [1, 1, 2, 2, 0, 0],
            [1, 1, 2, 2, 1, 0],
            [1, 1, 2, 2, 2, 0],
            [1, 1, 2, 2, 2, 1]
        ];
        const tree = {
            MF: globalOptimalRoute,
            MFd: globalOptimalRoute,
            MFd2: globalOptimalRoute,
            MFd2SLOW: globalOptimalRoute,
            MFdPostRecovery0: globalOptimalRoute,
            MFdPostRecovery1: globalOptimalRoute,
            MFdPostRecovery2: globalOptimalRoute,
            MFdPostRecovery3: globalOptimalRoute,
            MFdPostRecovery4: globalOptimalRoute,
            MFdPostRecovery5: globalOptimalRoute,
            MFdPostRecovery6: globalOptimalRoute,
            MFdPostRecovery7: globalOptimalRoute,
            MFdPostRecovery8: globalOptimalRoute,
            MFdPostRecovery9: globalOptimalRoute,
        };
        return tree[this.strat];
    }
    getTotMult(val) {
        return Math.max(0, val * this.tauFactor * 0.17);
    }
    updateMilestones() {
        const points = [0, 20, 50, 175, 225, 275, 325, 425, 475, 525];
        const stage = binarySearch(points, Math.max(this.lastPub, this.maxRho));
        this.milestones = this.milestoneTree[Math.min(this.milestoneTree.length - 1, stage)];
        this.updateC();
    }
    omegaexp() {
        return 4.1 + 0.15 * this.milestones[2];
    }
    xexp() {
        return 3.2 + 0.1 * this.milestones[3];
    }
    vexp() {
        return 1.3 + 0.31 * this.milestones[4];
    }
    a1exp() {
        return 1 + 0.01 * this.milestones[5];
    }
    resetParticle() {
        this.x = 0;
        this.vx = Math.pow(10, (this.variables[5].value + this.variables[6].value - 20));
        this.vz = Math.pow(10, (this.variables[7].value + this.variables[8].value - 18));
        this.vtot = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
        this.resets++;
        this.stratExtra = "";
        if (this.resets > 1) {
            this.boughtVars.push({
                variable: 'Reset at V=' + this.variables[5].level + "," + this.variables[6].level + "," + this.variables[7].level + "," + this.variables[8].level,
                level: this.resets - 1,
                cost: this.maxRho,
                timeStamp: this.t
            });
        }
        this.currentBundle = [0, 0, 0, 0];
        this.goalBundle = this.getGoalBundle();
        this.goalBundleCost = this.calcBundleCost(this.goalBundle);
        // console.log(this.strat + " vMaxBuy="+this.vMaxBuy+": "+(this.resets) + " resets ("+ parseFloat((this.t/3600).toFixed(2)).toFixed(2)+" hours & "+(10**(this.maxRho % 1)).toFixed(2)+'e'+Math.floor(this.maxRho) + " rho), "+"resetMulti= "+this.dynamicResetMulti+", v1="+this.variables[5].level+", v2="+this.variables[6].level+", v3="+this.variables[7].level+", v4="+this.variables[8].level)
        this.buyV = false;
    }
    updateC() {
        const xterm = l10(4e13) * this.xexp();
        const omegaterm = (l10(m0 / (q0 * mu0 * i0)) - l10(900)) * this.omegaexp();
        const vterm = this.milestones[0] ? l10(3e19) * 1.3 + l10(1e5) * (this.vexp() - 1.3) : 0;
        this.c = xterm + omegaterm + vterm + l10(8.67e23);
    }
    constructor(data, resetBundle) {
        super(data);
        this.pubUnlock = 8;
        this.totMult = data.rho < this.pubUnlock ? 0 : this.getTotMult(data.rho);
        this.rho = 0;
        this.c = 0;
        this.x = 0;
        this.i = 0;
        this.vx = 0;
        this.vz = 0;
        this.vtot = 0;
        this.resets = 0;
        this.varNames = ["c1", "c2", "a1", "a2", "δ", "v1", "v2", "v3", "v4"];
        this.stratExtra = "";
        this.normalPubRho = -1;
        this.resetBundle = resetBundle;
        this.stopReset = false;
        this.currentBundle = [0, 0, 0, 0];
        this.goalBundle = [0, 0, 0, 0];
        this.goalBundleCost = 0;
        //this.dynamicResetMulti = resetCombination[0];
        this.buyV = true;
        this.resetcond = false;
        this.bestRes = null;
        this.variables =
            [
                new Variable({ cost: new FirstFreeCost(new ExponentialCost(10, 2)), valueScaling: new StepwisePowerSumValue(2, 7) }),
                new Variable({ cost: new ExponentialCost(1e3, 50), valueScaling: new ExponentialValue(2) }),
                new Variable({ cost: new ExponentialCost(1e3, 25), valueScaling: new StepwisePowerSumValue(2, 5), value: l10(3) }),
                new Variable({ cost: new ExponentialCost(1e4, 100), valueScaling: new ExponentialValue(1.25) }),
                new Variable({ cost: new ExponentialCost(1e50, 300), valueScaling: new ExponentialValue(1.1) }),
                new Variable({ cost: new ExponentialCost(80, 80), valueScaling: new StepwisePowerSumValue(), value: 0 }),
                new Variable({ cost: new ExponentialCost(1e4, Math.pow(10, 4.5)), valueScaling: new ExponentialValue(1.3) }),
                new Variable({ cost: new ExponentialCost(1e50, 70), valueScaling: new StepwisePowerSumValue() }),
                new Variable({ cost: new ExponentialCost(1e52, 1e6), valueScaling: new ExponentialValue(1.5) }), // v4
            ];
        this.conditions = this.getBuyingConditions();
        this.milestoneConditions = this.getMilestoneConditions();
        this.milestoneTree = this.getMilestoneTree();
        this.updateMilestones();
        this.resetParticle();
    }
    copyFrom(other) {
        super.copyFrom(other);
        this.milestones = [...other.milestones];
        this.pubUnlock = other.pubUnlock;
        this.rho = other.rho;
        this.c = other.c;
        this.x = other.x;
        this.i = other.i;
        this.vx = other.vx;
        this.vz = other.vz;
        this.vtot = other.vtot;
        this.resets = other.resets;
        this.stratExtra = other.stratExtra;
        this.normalPubRho = other.normalPubRho;
        this.resetBundle = other.resetBundle;
        this.stopReset = other.stopReset;
        this.goalBundle = [...other.goalBundle];
        this.goalBundleCost = other.goalBundleCost;
        this.currentBundle = [...other.currentBundle];
        this.buyV = other.buyV;
        this.resetcond = other.resetcond;
    }
    copy() {
        let newsim = new mfSim(super.getDataForCopy(), this.resetBundle);
        newsim.copyFrom(this);
        return newsim;
    }
    simulate() {
        return __awaiter(this, void 0, void 0, function* () {
            let pubCondition = false;
            while (!pubCondition) {
                if (!global.simulating)
                    break;
                if ((this.ticks + 1) % 500000 === 0)
                    yield sleep();
                this.tick();
                if (this.rho > this.maxRho)
                    this.maxRho = this.rho;
                this.updateMilestones();
                this.buyVariables();
                yield this.checkForReset();
                //this.curMult = 10 ** (this.getTotMult(this.maxRho) - this.totMult);
                pubCondition = (global.forcedPubTime !== Infinity ? this.t > global.forcedPubTime : this.t > this.pubT * 2 || this.pubRho > this.cap[0] || this.pubMulti > 3.5) && this.pubRho > this.pubUnlock;
                this.ticks++;
            }
            this.pubMulti = Math.pow(10, (this.getTotMult(this.pubRho) - this.totMult));
            while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT)
                this.boughtVars.pop();
            const result = createResult(this, true ? " " + this.resetBundle : this.stratExtra);
            return getBestResult(result, this.bestRes);
        });
    }
    tick() {
        const newdt = this.dt * 1;
        const va1 = Math.pow(10, (this.variables[2].value * this.a1exp()));
        const va2 = Math.pow(10, this.variables[3].value);
        const vc1 = this.variables[0].value;
        const vc2 = this.variables[1].value;
        this.x += newdt * this.vx;
        let icap = va2 * i0;
        let scale = 1 - Math.pow(Math.E, (-newdt * va1 / (400 * va2)));
        if (scale < 1e-13)
            scale = newdt * va1 / (400 * va2);
        this.i = this.i + scale * (icap - this.i);
        this.i = Math.min(this.i, icap);
        const xterm = l10(this.x) * this.xexp();
        const omegaterm = (l10((q0 / m0) * mu0 * this.i) + this.variables[4].value) * this.omegaexp();
        const vterm = this.milestones[0] ? l10(this.vtot) * this.vexp() : 0;
        const rhodot = this.totMult + this.c + vc1 + vc2 + xterm + omegaterm + vterm;
        this.rho = add(this.rho, rhodot + l10(this.dt));
        this.t += this.dt / 1.5;
        this.dt *= this.ddt;
        if (this.maxRho < this.recovery.value)
            this.recovery.time = this.t;
        this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
        if (this.maxTauH < this.tauH || this.maxRho >= this.cap[0] - this.cap[1] || this.pubRho < this.pubUnlock || global.forcedPubTime !== Infinity) {
            this.maxTauH = this.tauH;
            this.pubT = this.t;
            this.pubRho = this.maxRho;
        }
    }
    calcBundleCost(bundle) {
        let cost = 0.;
        for (let i = 0; i < 4; i++) {
            if (bundle[i] == 0) {
                continue;
            }
            cost = add(cost, this.variables[5 + i].getCostForLevels(this.variables[5 + i].level, this.variables[5 + i].level + bundle[i] - 1));
        }
        return cost;
    }
    getGoalBundle() {
        let goalBundle = [...this.resetBundle];
        let bundleCost = this.calcBundleCost(goalBundle);
        while (this.variables[5].getCostForLevel(this.variables[5].level + goalBundle[0]) < bundleCost) {
            goalBundle[0]++;
        }
        bundleCost = this.calcBundleCost(goalBundle);
        while (this.variables[6].getCostForLevel(this.variables[6].level + goalBundle[1]) < bundleCost) {
            goalBundle[1]++;
        }
        bundleCost = this.calcBundleCost(goalBundle);
        while (this.variables[8].getCostForLevel(this.variables[8].level + goalBundle[3]) < bundleCost) {
            goalBundle[3]++;
        }
        bundleCost = this.calcBundleCost(goalBundle);
        while (this.variables[7].getCostForLevel(this.variables[7].level + goalBundle[2]) < bundleCost) {
            goalBundle[2]++;
        }
        return goalBundle;
    }
    checkForReset() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.stopReset) {
                this.buyV = false;
                return;
            }
            if (this.rho >= this.goalBundleCost + 0.0001) {
                if (this.maxRho >= this.lastPub) {
                    //console.log(`Opened fork for ${this.goalBundleCost}`)
                    let fork = this.copy();
                    fork.stopReset = true;
                    const forkres = yield fork.simulate();
                    this.bestRes = getBestResult(this.bestRes, forkres);
                    //console.log(`Fork closed; ${forkres.tauH}; ${this.bestRes != null ? this.bestRes.tauH : 'null'}`);
                }
                this.buyV = true;
                this.buyVariables();
                //console.log(`Reset ${this.goalBundleCost}; ${this.goalBundle}; ${this.variables.slice(5).map(v => v.level)}`)
                this.resetParticle();
            }
        });
    }
    buyVariables() {
        for (let i = this.variables.length - 1; i >= 0; i--) {
            while (true) {
                /*if ((!this.buyV) && (i >= 5 && (this.rho > (Math.max(this.variables[5].cost,this.variables[6].cost,this.variables[7].cost,this.variables[8].cost)+l10(2))))) {
                  this.buyV = true;
                }*/
                if (this.rho > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]()) {
                    if (this.maxRho + 10 > this.lastPub) {
                        this.boughtVars.push({
                            variable: this.varNames[i],
                            level: this.variables[i].level + 1,
                            cost: this.variables[i].cost,
                            timeStamp: this.t
                        });
                    }
                    if (i >= 5) {
                        this.currentBundle[i - 5]++;
                    }
                    this.rho = subtract(this.rho, this.variables[i].cost);
                    this.variables[i].buy();
                }
                else {
                    break;
                }
            }
        }
    }
}
class mfSimWrap extends theoryClass {
    constructor(data) {
        super(data);
        this._originalData = data;
    }
    simulate() {
        return __awaiter(this, void 0, void 0, function* () {
            let resetBundles = [
                [0, 1, 0, 0],
                [0, 1, 0, 1],
                [0, 2, 0, 0],
                [0, 2, 0, 1],
                [0, 3, 0, 0],
                [0, 3, 0, 1],
                [0, 3, 0, 2],
            ];
            let bestRes = getBestResult(null, null);
            for (const resetBundle of resetBundles) {
                //for (const resetCombination of getAllCombinations(resetMulti, this.strat === "MFd2SLOW" ? true : false)) {
                if (this._originalData.rho <= 100 && resetBundle[3] > 0) {
                    continue;
                }
                //console.log(`Started simulating ${resetBundle}`);
                let sim = new mfSim(this._originalData, resetBundle);
                let res = yield sim.simulate();
                // Unnecessary additional coasting attempt
                // let internalSim = new mfSim(this._originalData, resetCombination)
                // internalSim.normalPubRho = bestSim.pubRho;
                // let res = await internalSim.simulate();
                // if (bestSim.maxTauH < internalSim.maxTauH) {
                //   bestSim = internalSim;
                //   bestSimRes = res;
                // }
                if (bestRes.tauH < res.tauH) {
                    bestRes = res;
                }
                //}
            }
            return bestRes;
        });
    }
}
/*function getAllCombinations(resetMulti: number, slowMode: boolean) {
  const values = slowMode === true ? [resetMulti, resetMulti + 0.3, resetMulti - 0.3].filter(val => val >= 1) : [resetMulti].filter(val => val >= 1);
  const combinations: number[][] = [];

  function combine(prefix:number[], array:number[]) {
      if (prefix.length > 0) {
          combinations.push([...prefix]);
      }
      for (let i = 0; i < array.length; i++) {
          combine([...prefix, array[i]], array.slice(i + 1));
      }
  }

  combine([resetMulti], values.slice(1));
  return combinations;
}*/
