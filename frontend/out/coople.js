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
    return this.stor.getItem(`${this.key}:${item}`);
  }
  setItem(item, value) {
    this.stor.setItem(`${this.key}:${item}`, value);
  }
}
class CooplePlayer {
  static get SONGSEARCH_MAX_MATCHES() { return 5; }
  static get AUDIOSPRITE_LENGTHS() { return [2000, 2000, 3000, 3000, 5000, 5000]; }
  static get ERR_UNKNOWN_DATE() { return "There is no puzzle for today's date (yet). Please try again later."; }
  static get ERR_SONG_NOT_IN_SONGDB() { return "Internal data error. Please contact coop.rocks.123e <at> gmail.com for help."; }
  constructor() {
    this.getElems();
    this.gameDate = new Date().coopleDateFormat();
    this.storToday = new CoopleStorage(this.gameDate);
    this.setSectionVisible(this.storToday.getItem('state') === 'complete' ?
                             this.elem.section_done : this.elem.section_game);
    console.log('Date: ', this.gameDate);
    this.songdb = null;
    this.solutions = null;
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
    for (const name of ["section_game", "section_err", "err_text"]) {
      this.elem[name] = document.getElementById(name);
    }
  }
  setVisible(section, visible) {
    section.style.display = visible ? "flex !important" : "none !important";
  }
  setSectionVisible(section) {
    for (const s of [this.elem.section_game, this.elem.section_err]) {
      this.setVisible(s, s === section);
    }
  }
  setErrorState(errorText) {
    this.setSectionVisible(this.elem.section_err);
    this.elem.err_text.innerText = errorText;
  }
  maybeInitialize() {
    if (!this.songdb || !this.solutions) return;
    this.gameSong = this.solutions[this.gameDate];
    if (!this.gameSong) { this.setErrorState(CooplePlayer.ERR_UNKNOWN_DATE); return; }
    if (!this.songdb[this.gameSong]) { this.setErrorState(CooplePlayer.ERR_SONG_NOT_IN_SONGDB); return; }
    this.gameSongId = this.gameSong.substring(14);
    const gameSongAudioUrl = `./data/audio/${this.gameSongId}.mp3`
    const audioSprites = [];
    let spriteNum = 0;
    let accum = 0;
    for (const l of CooplePlayer.AUDIOSPRITE_LENGTHS) {
      accum += l;
      audioSprites[spriteNum] = [0, accum];
      spriteNum += 1;
    }
    this.howl = new Howl({
      src: [gameSongAudioUrl],
      sprite: audioSprites
    });
    this.howl.on('load', function(){ this.initialized = true; });
  }
  autocompleteMatch(input) {
    if (!input) {
      return [];
    }
    let re = "";
    for (const word of input.split(' ')) {
      re += `\w*${word}\w*.*`;
    }
    let reg = new RegExp(re, 'i');
    let ret = [];
    for (const song of this.songdb) {
      const name = song[1];
      if (name.match(reg)) {
        if (ret.push(name) >= CooplePlayer.SONGSEARCH_MAX_MATCHES) {
          break;
        }
      }
    }
    return ret;
  }
  showResults(val) {
    if (!this.initialized) return;
    let res = document.getElementById("result");
    res.innerHTML = '';
    let list = '';
    let terms = this.autocompleteMatch(val);
    for (const term of terms){
      list += `<li><a onclick='alert("${term}")'>${term}</a></li>`
    }
    res.innerHTML = '<ul>' + list + '</ul>';
  }
  updateUI() {
    if (!this.initialized) return;
    // Get the Howl we want to manipulate.
    var sound = this.howl;

    // Determine our current seek position.
    var seek = sound.seek() || 0;
    this.elem.timer.innerHTML = this.formatTime(Math.round(seek));
    this.elem.progress.style.width = (((seek / sound.duration()) * 100) || 0) + '%';

    // If the sound is still playing, continue stepping.
    if (sound.playing()) {
      requestAnimationFrame(this.step.bind(this));
    }
  }
  playPauseClick() {
    if (!this.initialized) return;
    var sound = this.howl;
    if (sound.playing()) {
      sound.stop();
    } else {
      sound.play(this.gameGuesses);
    }
  }
  guess() {

  }
  loadSpotifyEmbed() {
    this.elem.spotify_player.src = `https://open.spotify.com/embed/track/${this.gameSongId}`;
  }
}
var pl = new CooplePlayer();
