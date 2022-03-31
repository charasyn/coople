#!/usr/bin/env python3
from sys import exit
import json
import argparse
import pathlib
import datetime
from thefuzz.process import extract
from typing import List
from songdb import SongDbEntry, SongDb

def song_selection_menu(options: List[str]) -> str:
    while True:
        print('Make a selection:')
        for i, opt in enumerate(options, 1):
            print(f'{i}:', opt)
        sel = input('Selection: ')
        try:
            sel_int = int(sel) - 1
            return options[sel_int]
        except:
            pass

def main() -> int:
    ap = argparse.ArgumentParser(description="""
Select a song as the correct solution for a given date, and add to the 'solutions.json' file.
""")
    ap.add_argument('--songdb', metavar='songdb.json', type=pathlib.Path, required=True, dest='songdb')
    ap.add_argument('--solutions', metavar='solutions.json', type=pathlib.Path, required=True, dest='solutions')
    ap.add_argument('date', metavar='YYYY-MM-DD', type=str)
    ap.add_argument('songname', metavar='song-pretty-name', type=str)
    args = ap.parse_args()

    # Parse date
    thedate = datetime.date.fromisoformat(args.date)
    
    # Create songdb from file
    songdb = SongDb()
    songdb.load_from(args.songdb)
    print(f"SongDb loaded from '{args.songdb}'.")

    # Look through songdb for songname match
    songs_by_name = {song.display_name: song for song in songdb.data_by_uri.values()}
    best_matches = extract(args.songname, songs_by_name.keys(), limit=5)
    if len(best_matches) > 1:
        song_name = song_selection_menu([m[0] for m in best_matches])
    else:
        song_name = best_matches[0][0]
    song_uri = songs_by_name[song_name].song_uri

    # Update solutions
    solutions = {}
    try:
        with open(args.solutions, 'r', encoding='utf-8') as f:
            solutions = json.load(f)
    except FileNotFoundError:
        print(f"No previous solutions found in '{args.solutions}', creating new file...")
    solutions[thedate.strftime('%Y%m%d')] = song_uri
    with open(args.solutions, 'w', encoding='utf-8') as f:
        json.dump(solutions, f)

if __name__ == '__main__':
    exit(main())
