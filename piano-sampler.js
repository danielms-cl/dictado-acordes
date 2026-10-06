/* =========================================================
   piano-sampler.js
   Módulo reutilizable de piano con samples personalizados.
   Requiere Tone.js cargado antes.

   Uso:
     <script src="https://unpkg.com/tone@14.7.77/build/Tone.js"></script>
     <script src="piano-sampler.js"></script>

     await PianoSampler.init();
     PianoSampler.play(60);
     PianoSampler.playChord([60, 64, 67]);
     PianoSampler.playSequence([{midi:60, time:0, duration:"8n"}]);
   ========================================================= */

const PianoSampler = (() => {
  let sampler = null;
  let reverb = null;
  let initialized = false;
  let initPromise = null;

  const CONFIG = {
    urls: {
      "36": "M36.mp3",
      "52": "M52.mp3",
      "65": "M65.mp3",
      "78": "M78.mp3",
    },
    baseUrl: "samples/",
    release: 1.5,
    volume: -6,
    reverbWet: 0.15,
    reverbDecay: 1.8,
  };

  function midiToNote(midi) {
    return Tone.Frequency(midi, "midi").toNote();
  }

  /**
   * Fuerza el desbloqueo del AudioContext (crítico para iOS/Safari).
   * Debe llamarse dentro de un gesto táctil real (click, touchend, etc.).
   */
  async function unlockAudio() {
    try {
      if (Tone.context.state !== "running") {
        await Tone.start();
      }
      if (Tone.context.state !== "running") {
        await Tone.context.resume();
      }
      // Reproducir un buffer silencioso de 1 muestra para forzar el desbloqueo
      const silentBuffer = Tone.context.createBuffer(1, 1, 22050);
      const source = Tone.context.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(Tone.context.destination);
      source.start(0);
    } catch (e) {
      console.warn("[PianoSampler] No se pudo desbloquear el audio:", e);
    }
  }

  async function init(userConfig = {}) {
    if (initialized) return true;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const cfg = { ...CONFIG, ...userConfig };

      // Desbloqueo reforzado (especialmente útil en iOS)
      await unlockAudio();

      reverb = new Tone.Reverb({
        decay: cfg.reverbDecay,
        wet: cfg.reverbWet,
      }).toDestination();

      sampler = new Tone.Sampler({
        urls: cfg.urls,
        baseUrl: cfg.baseUrl,
        release: cfg.release,
        volume: cfg.volume,
      }).connect(reverb);

      await Tone.loaded();

      // Segundo desbloqueo por si las moscas (iOS puede haberlo suspendido
      // durante la carga de samples)
      await unlockAudio();

      initialized = true;
      return true;
    })();

    return initPromise;
  }

  function play(midi, duration = "2n", time = undefined, velocity = 0.8) {
    if (!sampler) {
      console.warn("[PianoSampler] No inicializado.");
      return;
    }
    sampler.triggerAttackRelease(midiToNote(midi), duration, time, velocity);
  }

  function playChord(midis, duration = "2n", velocity = 0.8) {
    if (!sampler) return;
    const notes = midis.map(midiToNote);
    sampler.triggerAttackRelease(notes, duration, undefined, velocity);
  }

  function playArpeggio(midis, interval = 0.08, duration = "2n") {
    if (!sampler) return;
    const now = Tone.now();
    midis.forEach((m, i) => {
      sampler.triggerAttackRelease(midiToNote(m), duration, now + i * interval);
    });
  }

  function playSequence(events) {
    if (!sampler) return;
    const now = Tone.now();
    events.forEach(ev => {
      sampler.triggerAttackRelease(
        midiToNote(ev.midi),
        ev.duration || "8n",
        now + ev.time,
        ev.velocity ?? 0.8
      );
    });
  }

  function setVolume(db) {
    if (sampler) sampler.volume.value = db;
  }

  function dispose() {
    if (sampler) { sampler.dispose(); sampler = null; }
    if (reverb)  { reverb.dispose();  reverb = null; }
    initialized = false;
    initPromise = null;
  }

  function isReady() {
    return initialized && sampler !== null;
  }

  return {
    init, play, playChord, playArpeggio, playSequence,
    setVolume, dispose, isReady, unlockAudio,
    get sampler() { return sampler; },
    CONFIG,
  };
})();