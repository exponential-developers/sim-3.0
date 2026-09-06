import base64
import json
import gzip

targets = [
    "EFpubtable.json",
    "CSR2pubtable.json",
    "FPextendedPT.json",
    "FPpubtable.json",
]

Table = dict[str, int]


def _load_one(name: str) -> Table:
    with open(name, "rb") as f:
        raw_table = json.load(f)
    return raw_table


def _encode_one(data: Table, num_size: int = 2) -> tuple[bytes, int]:
    keys: list[str] = []

    for item in data:
        keys.append(item)

    keys.sort(key=lambda x: float(x))

    packed = b''

    for k in keys:
        packed += data[k].to_bytes(num_size, byteorder="big")

    return gzip.compress(packed, compresslevel=9), int(keys[0])


def _decode_one(coded: bytes, offset: int, num_size: int = 2) -> Table:
    raw = gzip.decompress(coded)
    table: Table = {}
    ctr = 0
    for i in range(0, len(raw), num_size):
        cur_byte = raw[i:i+num_size]
        # Compute table:
        data = int.from_bytes(cur_byte, byteorder="big")
        key = str(ctr+offset)
        table[key] = data
        ctr += 1
    return table

for item in targets:
    table = _load_one(item)
    encoded = _encode_one(table)
    with open(item.replace('.json', '_coded.json'), "w", encoding="utf-8") as f:
        json.dump({
            "t": base64.b64encode(encoded[0]).decode('utf-8'),
            "s": encoded[1]
        }, f)
    decoded = _decode_one(encoded[0], encoded[1])
    # print(table, decoded)
    assert table == decoded
