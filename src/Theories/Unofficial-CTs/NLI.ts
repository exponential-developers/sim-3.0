import { defaultResult } from "../../Utils/helpers";
import { genericProgressConverter } from "../../Utils/progressConversion";

type theory = "NLI";

const converter: ProgressValueConverter = genericProgressConverter({
    multExponent: 0.2
});

const NLI: TheoryInterface<theory> = {
    simulate: nli,
    converter
};

export default NLI;

async function nli(data: theoryData<theory>): Promise<simResult<theory>> {
    return defaultResult();
}
