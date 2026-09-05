import json
import os
import sys


if __name__ == '__main__':
    item1 = sys.argv[1]
    item2 = sys.argv[2]
    delta_out = sys.argv[3]
    with open(item1, "rb") as f:
        table1 = json.load(f)
    with open(item2, "rb") as f:
        table2 = json.load(f)

    for key in table1:
        if key not in table2:
            raise Exception("Tables not compatible")

    for key in table2:
        if key not in table1:
            raise Exception("Tables not compatible")

    delta = {}
    for key in table2:
        if table1[key] != table2[key]:
            delta[key] = table2[key]

    with open(delta_out, "w", encoding="utf-8") as f:
        json.dump(delta, f, indent=2)

