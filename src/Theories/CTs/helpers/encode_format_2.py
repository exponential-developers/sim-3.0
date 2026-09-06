from typing import TypedDict
import base64
import json
import zopfli.zlib
import zlib

targets = [
    "EFpubtable.json",
    "CSR2pubtable.json",
    "FPextendedPT.json",
    "FPpubtable.json",
]

Table = dict[str, int]


class ResTable(TypedDict):
    sz: int  # size of the value in the table in bytes
    i: int  # Initial value for the delta encoding (it is an outlier in most cases)
    t: str  # compressed table
    s: int  # starting value offset of the table
    d: int  # delta offset


def _load_one(name: str) -> Table:
    with open(name, "rb") as f:
        raw_table = json.load(f)
    return raw_table


def _encode_one(data: Table) -> ResTable:
    keys: list[str] = []

    for item in data:
        keys.append(item)

    keys.sort(key=lambda x: float(x))

    packed = b''

    prev_item = data[keys[0]]
    max_delta = 0
    min_delta = 0
    offsets_set = set()
    for k in keys:
        item = data[k]
        if item - prev_item > max_delta:
            max_delta = item - prev_item
        if item - prev_item < min_delta:
            min_delta = item - prev_item
        offsets_set.add(item - prev_item)
        prev_item = item

    sz = 1
    while (max_delta - min_delta) > 2 ** (sz*8) - 1:
        sz += 1

    prev_item = data[keys[0]]
    for k in keys:
        packed += (data[k] - prev_item - min_delta).to_bytes(sz, byteorder="big")
        prev_item = data[k]

    best_candidate = zlib.compress(packed, level=9)
    second = zopfli.zlib.compress(packed)
    if len(second) < len(best_candidate):
        best_candidate = second

    print(len(packed), len(best_candidate), len(offsets_set), max_delta - min_delta)
    print(sorted(offsets_set))

    return {
        "t": base64.b64encode(best_candidate).decode('utf-8'),
        "i": data[keys[0]],
        "d": min_delta,
        "sz": sz,
        "s": int(keys[0])
    }


def _decode_one(res: ResTable) -> Table:
    coded = base64.b64decode(res["t"])
    num_size = res["sz"]
    initial = res["i"]
    offset = res["s"]
    min_delta = res["d"]
    raw = zlib.decompress(coded)
    table: Table = {}
    ctr = 0
    prev_value = initial
    for i in range(0, len(raw), num_size):
        cur_byte = raw[i:i+num_size]
        # Compute table:
        data = int.from_bytes(cur_byte, byteorder="big") + prev_value + min_delta
        prev_value = data
        key = str(ctr+offset)
        table[key] = data
        ctr += 1
    return table

for item in targets:
    print(item)
    table = _load_one(item)
    encoded = _encode_one(table)
    with open(item.replace('.json', '_coded.json'), "w", encoding="utf-8") as f:
        json.dump(encoded, f)
    with open(item.replace('.json', '_coded.gz'), "wb") as f:
        f.write(base64.b64decode(encoded["t"]))
    decoded = _decode_one(encoded)
    # print(table, decoded)
    assert table == decoded
