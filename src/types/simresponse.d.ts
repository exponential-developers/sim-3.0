type SingleSimResponse<T extends theoryType = theoryType> = {
    responseType: "single";
    result: simResult<T>;
}

type ChainSimResponse = {
    responseType: "chain";
    results: simResult[];
    deltaTau: number;
    averageRate: number;
    totalTime: number;
}

type PubTableResponse = {
    responseType: "pub_table";
    cap: number;
    step: number;
    start: number;
    pub_table: [number, number][];
}

type StepSimResponse = {
    responseType: "step";
    results: simResult[];
}

type SimAllResponse = {
responseType: "all";
sigma: number;
stratType: SettingsSimAllStratsMode;
completedCTs: SettingsCompletedCTsMode;
results: simAllResult[];
}

type SimResponse = 
    SingleSimResponse 
    | ChainSimResponse 
    | StepSimResponse 
    | SimAllResponse 
    | PubTableResponse;