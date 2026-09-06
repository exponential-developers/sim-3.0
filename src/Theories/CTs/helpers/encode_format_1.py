from typing import TypedDict
import base64
import json
import zopfli.gzip
import gzip

targets = [
    "table_bd_0_1_bdcoast.json",
    "table_bd_0_1_bdcoast.json",
    "table_bd_0_1_bddcoast.json",
    "table_fi_0_1_passive_coast.json",
    "table_fs_0_02_active_coast.json",
    "table_fs_0_02_passive_coast.json",
    "table_ilc_0_01_ilccoast.json",
    "table_mf_0_05_mfrccoast.json",
    "table_rz_0_1_active.json",
    "table_rz_0_1_passive.json",
    "table_wsp_0_1_active_coast.json",
    "table_wsp_0_1_passive_coast.json",
]

Table = dict[str, str]


class ResTable(TypedDict):
    sz: int  # size of the value in the table in bytes
    i: int  # Initial value for the delta encoding (it is an outlier in most cases)
    t: str  # compressed table
    s: float  # step of the table
    d: int  # delta offset


def _load_one(name: str) -> Table:
    with open(name, "rb") as f:
        raw_table = json.load(f)
    return raw_table


def _encode_one(data: Table) -> ResTable:
    keys: list[str] = []
    rev_keys: dict[str, int] = {}
    pre_encoding: list[int] = []

    for item in data:
        keys.append(item)

    keys.sort(key=lambda x: float(x))
    for i in range(0, len(keys)):
        rev_keys[keys[i]] = i

    for k in keys:
        pre_encoding.append(rev_keys[data[k]])

    packed: bytes = b''
    prev_item = pre_encoding[0]
    max_delta = 0
    min_delta = 0
    # The last one targets literally itself:
    pre_encoding[-1] = pre_encoding[-2]
    for item in pre_encoding:
        if item - prev_item > max_delta:
            max_delta = item - prev_item
        if item - prev_item < min_delta:
            min_delta = item - prev_item
        prev_item = item

    print(max_delta, min_delta)

    sz = 1
    while (max_delta - min_delta) > 2 ** (sz*8) - 1:
        sz += 1

    prev_item = pre_encoding[0]
    for item in pre_encoding:
        packed += (item - prev_item - min_delta).to_bytes(sz, byteorder="big")
        prev_item = item

    best_candidate = gzip.compress(packed, compresslevel=9)
    second = zopfli.gzip.compress(packed)
    if len(second) < len(best_candidate):
        best_candidate = second

    return {
        "t": base64.b64encode(best_candidate).decode('utf-8'),
        "sz": sz,
        "i": pre_encoding[0],
        "s": float(keys[1]) - float(keys[0]),
        "d": min_delta
    }


def _decode_one(res: ResTable) -> Table:
    coded = res["t"]
    step = res["s"]
    num_size = res["sz"]
    initial = res["i"]
    d = res["d"]
    raw = gzip.decompress(base64.b64decode(coded))
    nums_per_item = 2
    if step >= 0.1:
        nums_per_item = 1

    keys: list[str] = []
    rev_keys: dict[int, str] = {}
    pre_table: dict[str, int] = {}
    cur_key = 0.0
    prev_value = initial
    for i in range(0, len(raw), num_size):
        cur_byte = raw[i:i+num_size]
        # Compute table:
        data = int.from_bytes(cur_byte, byteorder="big") + prev_value + d
        prev_value = data
        key = f"{cur_key:.{nums_per_item}f}"

        # Compute key:
        rev_keys[len(keys)] = key
        keys.append(key)
        pre_table[key] = data
        if i == len(raw) - num_size:
            # Last element must be 0 to match original table!
            pre_table[key] = 0
        cur_key += step

    return {x: rev_keys[pre_table[x]] for x in pre_table}


for item in targets:
    print("Doing ", item)
    max_delta_detected = 0
    table = _load_one(item)
    encoded = _encode_one(table)
    with open(item.replace('.json', '_coded.json'), "w", encoding="utf-8") as f:
        json.dump(encoded, f)
    decoded = _decode_one(encoded)
    assert table == decoded
