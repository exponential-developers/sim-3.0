
export function prepareTable(rawTable: Record<string, string>, suffix: string): Record<string, string> {
    let table: Record<string, string> = {};
    for(let item in rawTable) {
        table[item+suffix] = rawTable[item] + suffix
    }
    return table;
}
