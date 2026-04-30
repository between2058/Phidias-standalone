""" ci_utils.py """

import argparse
import json
import os
import re


def parse_coverage(cov_json, cov_output):
    """parse coverage percentage from json"""
    cov_data = None
    percent_covered = 0
    if not os.path.exists(cov_json):
        print("file not exist", cov_json)
    with open(cov_json, "r") as f:
        cov_data = json.load(f)
    if cov_data:
        percent_covered = cov_data["totals"]["percent_covered"]
    with open(cov_output, "w") as f:
        f.write(str(int(percent_covered)))


def pares_regex(input_f, output_f, regex, line=None):
    """parse input file by regex and write result to output file"""
    data = None
    match = ""
    with open(input_f, "r") as f:
        if line is not None:
            data = f.readlines()[line]
        else:
            data = f.read()

    if data:
        match_object = re.findall(regex, data)
        if match_object:
            match = match_object[0].replace("%", "")

    with open(output_f, "w") as f:
        f.write(match)
        print("write {} to {}".format(match, output_f))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("-f", "--func", type=str, help="select function: ")
    parser.add_argument("-i", "--input-file", type=str, help="input file for ci_utils")
    parser.add_argument("-o", "--output-file", type=str, help="output file")
    parser.add_argument("-r", "--regex", type=str, help="regex to parse string")
    parser.add_argument(
        "-l",
        "--line",
        type=int,
        default=None,
        help="search specific line number of file",
    )
    args = parser.parse_args()
    print(args)

    if args.func == "regex":
        pares_regex(args.input_file, args.output_file, regex=args.regex, line=args.line)
