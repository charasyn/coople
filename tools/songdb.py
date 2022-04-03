from dataclasses import dataclass
import json
from typing import Dict

@dataclass
class SongDbEntry:
    song_uri: str
    display_name: str

class SongDb:
    def __init__(self):
        self.data_by_uri: Dict[str, SongDbEntry] = {}
    def load_from(self, filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                for entry in data:
                    datum = SongDbEntry(entry[0], entry[1])
                    self.data_by_uri[datum.song_uri] = datum
            elif isinstance(data, dict):
                for k,v in data.items():
                    if isinstance(v, list):
                        datum = SongDbEntry(k, *v)
                    else:
                        datum = SongDbEntry(k, v)
                    self.data_by_uri[datum.song_uri] = datum
    def save_to(self, filepath):
        output_list = [[datum.song_uri, datum.display_name] for datum in self.data_by_uri.values()]
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(output_list, f)
    def update(self, update_data):
        if isinstance(update_data, list):
            if len(update_data) <= 0:
                return
            for datum in update_data:
                if not isinstance(datum, SongDbEntry):
                    raise TypeError(f"Datum '{datum}' is not a SongDbEntry")
                self.data_by_uri[datum.song_uri] = datum
        else:
            raise TypeError("Expecting a list of SongDbEntry")
