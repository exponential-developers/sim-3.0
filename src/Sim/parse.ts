import { qs } from "../Utils/DOMhelpers";

//Setting Inputs
const dtOtp = qs(".dtOtp");
const ddtOtp = qs(".ddtOtp");
const mfDepthOtp = qs(".mfDepthOtp");
const themeSelector = qs<HTMLSelectElement>(".themeSelector");
const simAllStrats = qs<HTMLSelectElement>(".simallstrats");
const skipCompletedCTs = qs<HTMLInputElement>(".skipcompletedcts");
const showA23 = qs<HTMLInputElement>(".a23");
const showUnofficials = qs<HTMLInputElement>(".unofficials");

export function parseSettings(): Settings {
    return {
        dt: parseFloat(dtOtp.textContent ?? "1.5"),
        ddt: parseFloat(ddtOtp.textContent ?? "1.0001"),
        mfResetDepth: parseInt(mfDepthOtp.textContent ?? "0"),
        theme: themeSelector.value,
        simAllStrats: simAllStrats.value,
        skipCompletedCTs: skipCompletedCTs.checked,
        showA23: showA23.checked,
        showUnofficials: showUnofficials.checked
    }
}

