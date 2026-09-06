type codedTable = {
    t: string;
    s: number;
};

async function decompress(b64str: string): Promise<ArrayBuffer> {
    const binaryString = atob(b64str);

    // Prepare uint8 array to then decompress:
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
    }

    const stream = new Response(uint8Array).body;
    if (!stream) throw new Error('Failed to read binary stream');
    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    const response = new Response(decompressedStream);
    return await response.arrayBuffer();
}

function decodeAtOffset(buf: DataView, offset: number, num_length: number): number {
    let res = 0;
    for (let i = 0; i < num_length; i++) {
        res = (res << 8) | buf.getUint8(offset + i);
    }
    return res;
}

export async function ptDecodeFormat1(table: codedTable, num_length: number = 2): Promise<Record<string, string>> {
    let raw = table.t;
    let step = table.s;
    let decompressed = await decompress(raw);

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
        codedPt.push(decodeAtOffset(view, offset, num_length));
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

export async function ptDecodeFormat2(table: codedTable, num_length: number = 2): Promise<Record<string, number>> {
    let raw = table.t;
    let offset = table.s;
    let decompressed = await decompress(raw);

    const view = new DataView(decompressed);

    let ctr = offset;
    let res: Record<string, number> = {}
    for (let i = 0; i < decompressed.byteLength; i += num_length) {
        res[ctr] = decodeAtOffset(view, i, num_length);
        ctr++;
    }
    return res;
}
