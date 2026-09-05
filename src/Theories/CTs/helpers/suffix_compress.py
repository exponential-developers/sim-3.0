import json
import os
import sys


if __name__ == '__main__':
    pth = sys.argv[1]
    with open(pth, "rb") as f:
        d = json.load(f)

    suffix = sys.argv[2]

    compressed = {}

    for item in d:
        if not d[item].endswith(suffix) or not item.endswith(suffix):
            print("Bad suffix:", item, d[item])
        compressed[item[:-len(suffix)]] = d[item][:-len(suffix)]

    with open(pth, "w", encoding="utf-8") as f:
        json.dump(compressed, f, indent=2)
