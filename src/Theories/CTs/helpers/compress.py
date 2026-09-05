import json
import os
import sys


if __name__ == '__main__':
    item = sys.argv[1]
    with open(item, "rb") as f:
        d = json.load(f)

    compressed = {

    }
    for key in d:
        compressed[key] = d[key]["next"]

    with open(item, "w", encoding="utf-8") as f:
        json.dump(compressed, f, indent=2)
