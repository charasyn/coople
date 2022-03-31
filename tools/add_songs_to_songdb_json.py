#!/usr/bin/env python3
from sys import exit
import csv
import json
import argparse
import pathlib
from typing import List
from songdb import SongDbEntry, SongDb

DEFAULT_CONFIG = {
    'min_popularity': 75, # todo: find good value
    'exclude': [],
    'include': [],
}

def parse_csv_file(filepath_in: pathlib.Path, cols: List[str]) -> List[List[str]]:
    with open(filepath_in, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header_row = next(reader)
        col_indices = []
        for colname in cols:
            try:
                col_index = header_row.index(colname)
            except ValueError as e:
                raise ValueError(f"Column '{colname}' missing from file") from e
            col_indices.append(col_index)
        output = []
        for row in reader:
            output.append([row[idx] for idx in col_indices])
    return output
        

def main() -> int:
    ap = argparse.ArgumentParser(description="""
Add .csv from https://watsonbox.github.io/exportify/ to coople .json format
""")
    ap.add_argument('--config', metavar='songdb-JSON-config', type=pathlib.Path)
    ap.add_argument('--in', metavar='watsonbox-CSV-file', type=pathlib.Path, nargs='*', dest='inputs', default=[])
    ap.add_argument('--songdb', metavar='songdb-JSON-file', type=pathlib.Path, required=True, dest='songdb')
    args = ap.parse_args()
    config = DEFAULT_CONFIG
    if args.config:
        with open(args.config) as f:
            config.update(json.load(f))
        unknown_keys = [k for k in config if k not in DEFAULT_CONFIG]
        if unknown_keys:
            print("Unknown configuration options:", ', '.join(f"'{k}'" for k in unknown_keys))
            print("Allowed configuration options:", ', '.join(f"'{k}'" for k in DEFAULT_CONFIG))
            return 1
    # Convert include and exclude lists in config into sets
    for list_name in ('include', 'exclude'):
        config[list_name] = set(config[list_name])
    
    # Create songdb from file
    songdb = SongDb()
    try:
        songdb.load_from(args.songdb)
        print(f"SongDb loaded from '{args.songdb}'.")
    except FileNotFoundError as e:
        print(f"SongDb file '{args.songdb}' doesn't exist. Creating new SongDb...")

    # Load all input .csv files into dict
    csv_songs = {}
    song_keys = ['Track URI', 'Popularity', 'Track Name', 'Artist Name(s)']
    def song_csv_data_to_songdb(song: List[str]) -> SongDbEntry:
        return SongDbEntry(song[0], f'{song[2]} - {song[3]}')
    def song_check_conditions(song_info: List[str]) -> bool:
        # Accept song if URI is in 'include' list
        if song_info[0] in config['include']:
            return True
        # Reject song if URI is in 'exclude' list
        if song_info[0] in config['exclude']:
            return False
        # Reject song if it's below the popularity threshold
        if int(song_info[1]) < config['min_popularity']:
            return False
        # Default: accept song
        return True
    error = False
    for csv_in in args.inputs:
        try:
            csv_data = parse_csv_file(csv_in, song_keys)
            csv_songs.update({row[0]: row for row in csv_data if song_check_conditions(row)})
            print(f"Loaded CSV file '{csv_in}'.")
        except ValueError as e:
            print('Error:', str(e))
            print(f"Unable to read CSV file '{csv_in}'!")
            error = True
    if error:
        print('Exiting due to previous errors.')
        return 1
    
    # Merge new .csv contents and existing SongDb
    songdb_prev_size = len(songdb.data_by_uri)
    songdb.update([song_csv_data_to_songdb(song) for song in csv_songs.values()])
    songdb_new_size = len(songdb.data_by_uri)
    print(f"SongDb went from {songdb_prev_size} to {songdb_new_size} songs.")

    # Write songdb to file
    songdb.save_to(args.songdb)
    print(f"SongDb saved to '{args.songdb}'.")

if __name__ == '__main__':
    exit(main())
