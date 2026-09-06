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


def _load_one(name: str) -> Table:
    with open(name, "rb") as f:
        raw_table = json.load(f)
    return raw_table


def _encode_one(data: Table, num_size: int = 2) -> tuple[bytes, float]:
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
    for item in pre_encoding:
        packed += item.to_bytes(num_size, byteorder="big")

    best_candidate = gzip.compress(packed, compresslevel=9)
    second = zopfli.gzip.compress(packed)
    if len(second) < len(best_candidate):
        best_candidate = second

    return best_candidate, float(keys[1]) - float(keys[0])


def _decode_one(coded: bytes, step: float, num_size: int = 2) -> Table:
    raw = gzip.decompress(coded)
    nums_per_item = 2
    if step >= 0.1:
        nums_per_item = 1

    keys: list[str] = []
    rev_keys: dict[int, str] = {}
    pre_table: dict[str, int] = {}
    cur_key = 0.0
    for i in range(0, len(raw), num_size):
        cur_byte = raw[i:i+num_size]
        # Compute table:
        data = int.from_bytes(cur_byte, byteorder="big")
        key = f"{cur_key:.{nums_per_item}f}"

        # Compute key:
        rev_keys[len(keys)] = key
        keys.append(key)
        pre_table[key] = data
        cur_key += step
    return {x: rev_keys[pre_table[x]] for x in pre_table}


for item in targets:
    table = _load_one(item)
    encoded = _encode_one(table)
    with open(item.replace('.json', '_coded.json'), "w", encoding="utf-8") as f:
        json.dump({
            "t": base64.b64encode(encoded[0]).decode('utf-8'),
            "s": encoded[1]
        }, f)
    decoded = _decode_one(encoded[0], encoded[1])
    assert table == decoded
