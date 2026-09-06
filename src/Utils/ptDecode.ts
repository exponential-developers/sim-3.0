type codedTable = {
    t: string;
    s: number;
};

export async function ptDecodeFormat1(table: codedTable, num_length: number = 2): Promise<Record<string, string>> {
    let raw = table.t;
    let step = table.s;
    const binaryString = atob(raw);

    // Prepare uint8 array to then decompress:
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
    }

    const stream = new Response(uint8Array).body;
    if (!stream) throw new Error('Failed to read binary stream');
    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    const response = new Response(decompressedStream);
    let decompressed = await response.arrayBuffer();
    // Actual decoding:

    // Align the results to step:
    let nums_per_item = 2
    if(step >= 0.1)
        nums_per_item = 1

    let rev_keys: Record<number, string> = {};
    let pre_table: Record<string, number> = {};
    let cur_key = 0.0;

    // Decode pt:
    const view = new DataView(decompressed);
    const codedPt: number[] = [];

    for (let offset = 0; offset < decompressed.byteLength; offset += num_length) {
        // Pass false for big-endian (or leave the second argument empty)
        if(num_length == 2) {
            codedPt.push(view.getUint16(offset, false));
        }
        else {
            codedPt.push(view.getUint32(offset, false));
        }
    }

    // Convert PT to standard view:
    for(let i = 0; i < codedPt.length; i += 1) {
        let data = codedPt[i];
        let key = cur_key.toFixed(nums_per_item);
        rev_keys[i] = key
        pre_table[key] = data
        cur_key += step;
    }

    let res_table: Record<string, string>  = {}
    for(let x in pre_table) {
        res_table[x] = rev_keys[pre_table[x]]
    }

    return res_table;
}
