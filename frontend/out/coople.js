'use strict';
Date.prototype.coopleDateFormat = function() {
  let y = this.getFullYear().toString().padStart(4,'0');
  let m = (this.getMonth()+1).toString().padStart(2,'0');
  let d = this.getDate().toString().padStart(2,'0');
  return y+m+d;
}
class CoopleStorage {
  constructor(key) {
    this.stor = window.localStorage;
    this.key = key;
  }
  getItem(item) {
    return JSON.parse(this.stor.getItem(`${this.key}:${item}`));
  }
  setItem(item, value) {
    this.stor.setItem(`${this.key}:${item}`, JSON.stringify(value));
  }
}
class CoopleStats {
  constructor() {
    this.stor = window.localStorage;
    this.key = 'stats';
  }
  getItem(item) {
    return JSON.parse(this.stor.getItem(`${this.key}:${item}`));
  }
  setItem(item, value) {
    this.stor.setItem(`${this.key}:${item}`, JSON.stringify(value));
  }
  logCompletion(_gameDate, gameCompletion, numGuesses) {
    let counts = this.getItem('counts');
    if (!counts) {
      counts = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
        'lose': 0,
        'total': 0
      };
    }
    if (gameCompletion === 'lose') {
      counts['lose'] += 1;
    } else {
      counts[numGuesses] += 1;
    }
    counts['total'] += 1;
    this.setItem('counts', counts);
  }
}
class CooplePlayer {
  static get SONGSEARCH_MAX_MATCHES() { return 5; }
  static get AUDIOSPRITE_LENGTHS() { return [2000, 2000, 3000, 3000, 5000, 5000]; }
  static get ERR_UNKNOWN_DATE() { return "There is no data for today's date (meaning Cooper is lazy and needs to update the site).\nPlease try again later."; }
  static get ERR_NULL_DATE() { return "There is no puzzle for today's date.\nHave a great day and see you tomorrow! :)"; }
  static get ERR_SONG_NOT_IN_SONGDB() { return "Internal data error. Please contact coop.rocks.123e <at> gmail.com for help."; }
  constructor() {
    this.initialized = false;
    this.gameDate = new Date().coopleDateFormat();
    this.storToday = new CoopleStorage(this.gameDate);
    this.stats = new CoopleStats();
    this.state = this.storToday.getItem('state');
    this.songdb = null;
    this.solutions = null;
    this.howlCurSoundId = null;
    this.errorText = null;
    this.getElems();
    if (!this.state) {
      this.state = {};
      this.state.gameGuesses = [];
      this.state.gameCompletion = 'inProgress';
    }
    this.setSectionVisible(this.state.gameCompletion !== 'inProgress' ? this.elem.section_done : this.elem.section_game);
    fetch('./data/songdb.json')
      .then(response => response.json())
      .then(data => {
        this.songdb = data;
        console.log('Songdb loaded!');
        this.maybeInitialize();
    });
    fetch('./data/solutions.json')
      .then(response => response.json())
      .then(data => {
        this.solutions = data;
        console.log('Solutions loaded!');
        this.maybeInitialize();
    });
  }
  getElems() {
    this.elem = {};
    const names = [
      "section_playback",
      "playback_meter_text",
      "playback_meter",
      "playback_play_stop",
      "section_guesses",
      "guess_1",
      "guess_2",
      "guess_3",
      "guess_4",
      "guess_5",
      "guess_6",
      "section_game",
      "guess_text",
      "guess_submit",
      "guess_autocomplete",
      "guess_feedback",
      "section_done",
      "share_text",
      "win_lose_text",
      "spotify_player",
      "section_err",
      "err_header",
      "err_text",
    ];
    for (const name of names) {
      this.elem[name] = document.getElementById(name);
    }
  }
  setErrorState(errorText) {
    this.errorHeader = "An error occurred!";
    this.errorText = errorText;
    this.updateUI();
  }
  songdbIdxByUri(uri) { return this.songdb.findIndex(song => song[0] === uri); }
  songdbIdxByName(name) { return this.songdb.findIndex(song => song[1] === name); }
  maybeInitialize() {
    if (!this.songdb || !this.solutions) return;
    this.gameSong = this.solutions[this.gameDate];
    if (this.gameSong === null) {
      this.errorHeader = "No Coople today!";
      this.errorText = CooplePlayer.ERR_NULL_DATE;
      this.updateUI();
      return;
    }
    if (!this.gameSong) { this.setErrorState(CooplePlayer.ERR_UNKNOWN_DATE); return; }
    if (this.songdbIdxByUri(this.gameSong) === -1) { this.setErrorState(CooplePlayer.ERR_SONG_NOT_IN_SONGDB); return; }
    this.gameSongId = this.gameSong.substring(14);
    const gameSongAudioUrl = `./data/audio/${this.gameSongId}.mp3`
    this.audioSprites = {};
    let spriteNum = 0;
    let accum = 0;
    for (const l of CooplePlayer.AUDIOSPRITE_LENGTHS) {
      accum += l;
      this.audioSprites[`aspr_${spriteNum}`] = [0, accum];
      spriteNum += 1;
    }
    this.audioSprites["aspr_6"] = [0, accum];
    this.howl = new Howl({
      src: [gameSongAudioUrl],
      sprite: this.audioSprites
    });
    this.howl.on('play', function(){ this.updateUITick(); }.bind(this));
    this.howl.on('load', function(){ this.initialized = true; this.updateUI(); }.bind(this));
  }
  formatTime(t) {
    const tr = Math.floor(t);
    const s = tr % 60;
    const m = Math.floor(tr / 60);
    return `${m}:${s.toString().padStart(2,'0')}`
  }
  get howlCurSprName() {
    if (this.state.gameCompletion === 'inProgress') {
      return `aspr_${this.state.gameGuesses.length}`;
    }
    return "aspr_6";
  }
  updateUITick() {
    if (!this.initialized) return;

    // Update time on playback progress bar
    var sound = this.howl;
    var seek = 0;
    const soundLen = this.audioSprites[this.howlCurSprName][1] / 1000;
    if (this.howlCurSoundId !== null ) {
      seek = sound.seek(this.howlCurSoundId) || 0;
    }
    this.elem.playback_meter_text.innerText = `${this.formatTime(seek)} / ${this.formatTime(soundLen)}`;
    this.elem.playback_meter.value = ((seek / soundLen) * 100) || 0;

    // If the sound is still playing, continue stepping.
    if (sound.playing()) {
      requestAnimationFrame(this.updateUITick.bind(this));
    }
  }
  setVisible(section, visible) {
    if (visible) {
      section.classList.remove('hidden');
    } else {
      section.classList.add('hidden');
    }
  }
  setSectionVisible(section) {
    for (const s of [this.elem.section_game, this.elem.section_done, this.elem.section_err]) {
      this.setVisible(s, s === section);
    }
    if (section === this.elem.section_done) {
      this.loadSpotifyEmbed();
    }
  }
  updateUI() {
    // Update what parts are visible
    if (this.errorText) {
      this.elem.err_header.innerText = this.errorHeader;
      this.elem.err_text.innerText = this.errorText;
      this.setSectionVisible(this.elem.section_err);
    } else if (this.initialized) {
      if (this.state.gameCompletion === 'win') {
        this.elem.win_lose_text.innerText = "Yay! You did it! :)";
      } else if (this.state.gameCompletion === 'lose') {
        this.elem.win_lose_text.innerText = "Sorry. Better luck tomorrow!";
      }
      this.setVisible(this.elem.section_playback, true);
      this.setVisible(this.elem.section_guesses, true);
      this.setSectionVisible(this.state.gameCompletion === 'inProgress' ? this.elem.section_game : this.elem.section_done);
    }
    // Update guesses on screen
    let iGuess = 1;
    const numGuesses = this.state.gameGuesses.length;
    for (const guess of this.state.gameGuesses) {
      const correct = this.state.gameCompletion === 'win' && iGuess === numGuesses;
      this.displayGuess(iGuess, guess, correct);
      iGuess += 1;
    }

    // Everything below needs the music stuff loaded
    if (!this.initialized) return;

    // Kick off progress bar updates
    this.updateUITick();
  }
  playPauseClick() {
    if (!this.initialized) return;
    var sound = this.howl;
    if (sound.playing()) {
      sound.stop();
    } else {
      this.howlCurSoundId = sound.play(this.howlCurSprName);
      this.updateUITick();
    }
  }
  guess() {
    const thisGuess = this.elem.guess_text.value;
    const guessIdx = this.songdbIdxByName(thisGuess);
    if (guessIdx === -1) {
      this.elem.guess_feedback.innerText = "Don't know that one. Pick from the list.";
      return;
    }
    this.elem.guess_feedback.innerText = "";
    this.howl.stop();
    this.howlCurSoundId = null;
    this.updateGuessEntry("");
    this.state.gameGuesses.push(thisGuess);
    if (this.songdb[this.songdbIdxByUri(this.gameSong)][1] === thisGuess) {
      this.state.gameCompletion = "win";
    } else if (this.state.gameGuesses.length === 6) {
      this.state.gameCompletion = "lose";
    }
    if (this.state.gameCompletion !== 'inProgress') {
      this.stats.logCompletion(this.gameDate, this.state.gameCompletion, this.state.gameGuesses.length);
    }
    this.storToday.setItem('state', this.state);
    this.updateUI();
  }
  updateGuessEntry(guess) {
    this.elem.guess_text.value = guess;
  }
  updateGuessEntryByUri(guessUri) {
    this.elem.guess_text.value = this.songdb[this.songdbIdxByUri(guessUri)][1];
  }
  displayGuess(idx, text, correct) {
    const elemName = `guess_${idx}`;
    const elem = this.elem[elemName];
    elem.innerText = text;
    if (correct) {
      elem.classList.add('bg-green-200');
      elem.classList.add('text-green-700');
    } else {
      elem.classList.add('bg-red-200');
      elem.classList.add('text-red-700');
    }
  }
  loadSpotifyEmbed() {
    this.elem.spotify_player.src = `https://open.spotify.com/embed/track/${this.gameSongId}`;
  }
  autocompleteMatch(input) {
    let re = "";
    for (const word of input.split(' ')) {
      re += `\w*${word}\w*.*`;
    }
    let reg = new RegExp(re, 'i');
    let ret = [];
    for (const song of this.songdb) {
      const name = song[1];
      if (name.match(reg)) {
        if (ret.push(song) >= CooplePlayer.SONGSEARCH_MAX_MATCHES) {
          break;
        }
      }
    }
    return ret;
  }
  showAutocomplete(val) {
    if (!this.initialized) return;
    if (!val) {
      this.setVisible(this.elem.guess_autocomplete, false);
      return;
    }
    let res = this.elem.guess_autocomplete;
    res.innerHTML = '';
    let list = '';
    let matches = this.autocompleteMatch(val);
    for (const song of matches){
      list += `<div class='py-1' onclick='pl.updateGuessEntryByUri("${song[0]}")'>${song[1]}</div>`
    }
    res.innerHTML = list;
    this.setVisible(this.elem.guess_autocomplete, true);
  }
  closeAutocomplete() {
    this.elem.guess_autocomplete.innerHTML = '';
    this.setVisible(this.elem.guess_autocomplete, false);
  }
  share() {
    let guessChar = this.state.gameCompletion === 'lose' ? 'X' : this.state.gameGuesses.length.toString();
    let boxes = "";
    let won = false;
    for (let i = 1; i <= 6; i++) {
      if (this.state.gameCompletion !== 'lose' && i === this.state.gameGuesses.length) {
        won = true;
        boxes += '🟩';
      } else if (won) {
        boxes += '⬜';
      } else {
        boxes += '🟧';
      }
    }
    let clipText = `coople ${this.gameDate} ${guessChar}/6\n\n${boxes}\n\nhttps://coopers.casa/coople/`;
    navigator.clipboard.writeText(clipText).then(function() {
      /* clipboard successfully set */
      this.elem.share_text.innerText = "Link copied to clipboard!";
    }.bind(this), function() {
      /* clipboard write failed */
      this.elem.share_text.innerText = "Error: Link could not be copied to clipboard :(";
    }.bind(this));
  }
}
var pl = new CooplePlayer();
