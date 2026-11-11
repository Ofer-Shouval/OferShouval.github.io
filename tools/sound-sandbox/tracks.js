// A scene's tracks, in the sound sandbox: each one plays a sound (a saved patch, or sound files) at its own moment in
// the scene: on every drop, only far or near ones, the ones clicked, or all the time, as a background. They're kept in
// src/sounds/scenes/<scene>.json (through dev-server.js), saved as they're changed. Used by sandbox.js.
//
// A track: { sound: 'patch:landing/raindrop.json' or 'sample:/sounds/landing/drip01.m4a|/sounds/landing/drip02.m4a',
//            when: 'drop' | 'far' | 'near' | 'pressed' | 'always', volume: 0 to 1.5, off: true (muted) or false }
// Each plays through its own volume, so muting one silences it at once (a background keeps going, unheard, and comes
// straight back as it's unmuted).

import { instrument, complete } from '../../src/scripts/patch.js';

export const moments = [
  ['drop', 'every drop'],
  ['far', 'far drops'],
  ['near', 'near drops'],
  ['pressed', 'drops you click'],
  ['always', 'all the time'],
];
const matches = (when, drop) =>
  when === 'drop' || (when === 'far' && drop.near < 0.5) || (when === 'near' && drop.near >= 0.5) || (when === 'pressed' && drop.pressed);

// Sound files as an instrument: as they are, one at random each time, each a little higher or lower (as the pond's
// drips are), with nothing else done to them
function samplePatch(srcs) {
  return complete({
    name: 'sound files',
    level: 1,
    out: 1,
    spread: 1.3,
    filter: { type: 'lowpass', q: 0.5, start: { ratio: 0, add: 20000, velocity: 0 }, end: { ratio: 0, add: 20000 } },
    echo: { time: 0.3, feedback: 0, wet: 0 },
    layers: [{ kind: 'sample', src: srcs.length > 1 ? srcs : srcs[0], follow: false, level: 1, sustain: 1 }],
  });
}
const lowestOf = (p) => Math.round(Math.min(p.range.low, p.range.high));

// `context`: audio and master (where they play), library() (the sandbox's), patchFor(file) (a saved patch as it is
// now, with any unsaved changes), live() ({ file }: the patch open in the sandbox, which a track playing it follows
// as its sliders move), onSave(tracks), openPatch(file), makePatch(name, kind, background) (a new,
// empty patch, 'synth' or 'sampler', saved, giving its file), siblingsOf(src), holder (the element they're shown in)
export function makeTracks(context) {
  const { audio, master, holder } = context;
  let tracks = [];
  const players = new WeakMap(); // track -> { sound, player, gain }
  let held = []; // [{ player, note }] for the tracks playing all the time, while they are
  let holding = false;

  const ready = (track) => !!track.sound;
  const loudness = (track) => (track.off ? 0 : track.volume);

  // What plays a track: its own instrument, into its own volume (the open patch's following its sliders)
  function playerOf(track) {
    const [kind, what] = [track.sound.slice(0, track.sound.indexOf(':')), track.sound.slice(track.sound.indexOf(':') + 1)];
    const follow = kind === 'patch' && what === context.live().file;
    let made = players.get(track);
    if (made?.sound !== track.sound) {
      if (made) setTimeout(() => made.player.disconnect(), 8000); // Once it's died away
      const gain = audio.createGain();
      gain.connect(master);
      const patch = kind === 'patch' ? context.patchFor(what) : samplePatch(what.split('|'));
      if (!patch) return null;
      gain.gain.value = loudness(track);
      made = { sound: track.sound, player: instrument(audio, patch, gain, { follow }), gain };
      players.set(track, made);
    }
    return { player: made.player };
  }
  // A track's volume, now: quickly, so a mute's at once
  function setLoudness(track) {
    players.get(track)?.gain.gain.setTargetAtTime(loudness(track), audio.currentTime, 0.015);
  }

  function save() {
    clearTimeout(save.timer);
    save.timer = setTimeout(() => context.onSave(tracks), 300);
  }

  function holdAll(on) {
    for (const { player, note } of held) player.noteOff(note);
    held = [];
    holding = on;
    if (!on) return;
    for (const track of tracks.filter((t) => ready(t) && t.when === 'always')) {
      const found = playerOf(track);
      if (found) held.push({ player: found.player, note: found.player.noteOn(lowestOf(found.player.patch), 0.8) });
    }
  }

  function changed() {
    save();
    if (holding) holdAll(true);
    render();
  }

  // --- Showing them ---
  function soundMenu(track) {
    const select = document.createElement('select');
    select.append(new Option('choose a sound…', ''));
    select.append(new Option('+ a new synth for it…', 'new:synth'));
    select.append(new Option('+ a new sampler for it…', 'new:sampler'));
    const library = context.library();
    const patches = document.createElement('optgroup');
    patches.label = 'patches';
    for (const { file, patch } of library.patches) patches.append(new Option(`${patch.name ?? file} (${file.split('/')[0]})`, 'patch:' + file));
    select.append(patches);
    // Sound files, by folder: each one, and each numbered set (drip01, drip02...) as one, played at random
    const folders = new Map();
    for (const src of library.sounds) {
      const folder = src.split('/').slice(2, -1).join('/');
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder).push(src);
    }
    for (const [folder, srcs] of folders) {
      const group = document.createElement('optgroup');
      group.label = 'sounds: ' + folder;
      const sets = new Set();
      for (const src of srcs) {
        const set = [src, ...context.siblingsOf(src)].sort();
        if (set.length > 1 && !sets.has(set[0])) {
          sets.add(set[0]);
          const stem = set[0].split('/').pop().replace(/[-_ ]?\d*\.\w+$/, '');
          group.append(new Option(`${stem} (all ${set.length}, one at random)`, 'sample:' + set.join('|')));
        }
      }
      for (const src of srcs) group.append(new Option(src.split('/').pop(), 'sample:' + src));
      select.append(group);
    }
    select.value = track.sound;
    if (select.value !== track.sound) {
      select.append(new Option(track.sound + ' (missing)', track.sound)); // Gone from the project: shown, not lost
      select.value = track.sound;
    }
    select.onchange = () => {
      if (select.value.startsWith('new:')) {
        naming = { track, kind: select.value.slice(4) };
        render();
        return;
      }
      track.sound = select.value;
      changed();
    };
    return select;
  }

  // Naming a new patch for a track, in its row, in place of its sound menu: { track, kind: 'synth' or 'sampler' }
  let naming = null;
  function nameBox(track, kind) {
    const box = document.createElement('span');
    box.className = 'track-naming';
    const name = document.createElement('input');
    name.type = 'text';
    name.spellcheck = false;
    name.placeholder = 'its name';
    name.value = (track.when === 'always' ? 'background ' : '') + kind;
    const make = document.createElement('button');
    make.textContent = 'make';
    make.className = 'primary';
    const cancel = document.createElement('button');
    cancel.textContent = 'cancel';
    const go = async () => {
      if (!name.value.trim()) return name.focus();
      make.disabled = true;
      const file = await context.makePatch(name.value.trim(), kind, track.when === 'always');
      naming = null;
      if (!file) return render();
      track.sound = 'patch:' + file;
      changed();
      context.openPatch(file); // To make it sound right, there and then
    };
    make.onclick = go;
    name.onkeydown = (event) => {
      if (event.key === 'Enter') go();
      if (event.key === 'Escape') cancel.onclick();
    };
    cancel.onclick = () => {
      naming = null;
      render();
    };
    box.append(name, make, cancel);
    requestAnimationFrame(() => name.select());
    return box;
  }

  function render() {
    holder.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'tracks-head';
    head.innerHTML = '<h3>tracks</h3>';
    // A new track, with a new, empty patch of its own (named in its row): a synth or a sampler
    const adder = (kind, tip) => {
      const button = document.createElement('button');
      button.textContent = '+ ' + kind;
      button.title = tip;
      button.onclick = () => {
        const track = { sound: '', when: 'drop', volume: 0.8, off: false };
        tracks.push(track);
        naming = { track, kind };
        changed();
      };
      return button;
    };
    const buttons = document.createElement('span');
    buttons.className = 'tracks-buttons';
    buttons.append(adder('synth', 'A track playing a new synth: waves, made from nothing'), adder('sampler', 'A track playing a new sampler: your sound files'));
    head.append(buttons);
    holder.append(head);
    if (!tracks.length) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'No tracks yet, so each drop plays the patch open here. Add tracks to choose what plays when.';
      holder.append(hint);
    }
    const { file: openFile } = context.live();
    for (const track of tracks) {
      const row = document.createElement('div');
      row.className = 'track' + (track.off ? ' off' : '');

      // Muting it: silent at once (but still going, so it comes straight back)
      const mute = document.createElement('button');
      mute.className = 'mute';
      const showMute = () => {
        mute.textContent = track.off ? 'muted' : 'mute';
        mute.setAttribute('aria-pressed', String(!!track.off));
        mute.title = track.off ? 'Muted: click to hear it again' : 'Silence this track';
        row.classList.toggle('off', !!track.off);
      };
      showMute();
      mute.onclick = () => {
        track.off = !track.off;
        showMute();
        setLoudness(track);
        save();
      };

      const when = document.createElement('select');
      for (const [value, label] of moments) when.append(new Option(label, value));
      when.value = track.when;
      when.title = 'When it plays';
      when.onchange = () => {
        track.when = when.value;
        changed();
      };

      const volume = document.createElement('input');
      volume.type = 'range';
      volume.min = 0;
      volume.max = 1.5;
      volume.step = 0.01;
      volume.value = track.volume;
      volume.title = 'Volume';
      volume.oninput = () => {
        track.volume = +volume.value;
        setLoudness(track);
        save();
      };

      const edit = document.createElement('button');
      const patchFile = track.sound.startsWith('patch:') ? track.sound.slice(6) : null;
      edit.textContent = patchFile && patchFile === openFile ? 'open' : 'edit';
      edit.disabled = !patchFile || patchFile === openFile;
      edit.title = patchFile ? (patchFile === openFile ? "It's the patch open here" : 'Open its patch, to change it') : 'Sound files have nothing to edit';
      edit.onclick = () => context.openPatch(patchFile);

      const remove = document.createElement('button');
      remove.textContent = '×';
      remove.title = 'Take this track out';
      remove.onclick = () => {
        tracks.splice(tracks.indexOf(track), 1);
        changed();
      };

      row.append(mute, naming?.track === track ? nameBox(track, naming.kind) : soundMenu(track), when, volume, edit, remove);
      holder.append(row);
    }
  }

  return {
    load(saved) {
      tracks = structuredClone(saved ?? []);
      render();
    },
    render,
    // Whether there are tracks to play (if not, the sandbox plays the open patch on each drop, as it did before)
    get active() {
      return tracks.some(ready);
    },
    // A drop landing in the scene: each track that plays on it plays
    drop(drop) {
      for (const track of tracks.filter((t) => ready(t) && !t.off && t.when !== 'always' && matches(t.when, drop))) {
        const found = playerOf(track);
        found?.player.play(found.player.randomNote(), drop.loud, 2, undefined, { pan: drop.pan });
      }
    },
    hold: holdAll,
    // The open patch has been changed: the tracks playing it all the time start a new note of it, so it's heard
    patchChanged() {
      const { file } = context.live();
      if (!holding || !tracks.some((t) => ready(t) && t.when === 'always' && t.sound === 'patch:' + file)) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => holding && holdAll(true), 250);
    },
    // A patch has been opened, changed or saved: the tracks playing it start again from it as it is now
    refresh() {
      for (const track of tracks) {
        const made = players.get(track);
        if (made) setTimeout(() => made.player.disconnect(), 8000); // Once it's died away
        players.delete(track);
      }
      if (holding) holdAll(true);
      render();
    },
  };
}
