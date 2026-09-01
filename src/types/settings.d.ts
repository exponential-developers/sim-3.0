type SettingsSimAllStratsMode = "all" | "active" | "idle";
type SettingsCompletedCTsMode = "in" | "end" | "no";
type Settings = {
    dt: number;
    ddt: number;
    boughtVarsDelta: number;
    theme: string;
    simAllStrats: SettingsSimAllStratsMode;
    completedCTs: SettingsCompletedCTsMode;
    showA23: boolean;
    showUnofficials: boolean;
    totalPurchaseList: boolean;
}