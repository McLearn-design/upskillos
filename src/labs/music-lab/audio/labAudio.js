// Audio engine for the Music Lab: a thin layer over Tone.js.
// Rooms only ever ask for frequencies, so every tuning system works the same way.
import * as Tone from 'tone'

class LabAudio {
  constructor() {
    this.ready = false
    this.drones = new Map()
    this.loopId = null
    this.voice = 'triangle'
  }

  async start() {
    await Tone.start()
    if (this.ready) return
    this.out = new Tone.Volume(-10).toDestination()
    this.analyser = new Tone.Analyser('waveform', 1024)
    this.out.connect(this.analyser)
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: this.voice },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.5 },
    }).connect(this.out)
    this.synth.maxPolyphony = 24
    this.kick = new Tone.MembraneSynth({ octaves: 4, envelope: { attack: 0.001, decay: 0.25, sustain: 0 } }).connect(this.out)
    this.tick = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 } }).connect(this.out)
    this.tick.volume.value = -14
    this.ready = true
  }

  setVoice(type) {
    this.voice = type
    if (this.synth) this.synth.set({ oscillator: { type } })
  }

  /**
   * Play one or more frequencies.
   * opts.arpeggio: seconds between successive notes (0 = together).
   */
  async play(freqs, { dur = 0.9, arpeggio = 0, delay = 0, velocity = 0.8 } = {}) {
    await this.start()
    const list = Array.isArray(freqs) ? freqs : [freqs]
    const t0 = Tone.now() + 0.02 + delay
    list.forEach((f, i) => {
      if (Number.isFinite(f) && f > 0) this.synth.triggerAttackRelease(f, dur, t0 + i * arpeggio, velocity)
    })
  }

  /** A sustained tone whose frequency, waveform and level can change live. */
  async drone(id, { freq = 440, type = 'sine', partials = null, gain = 0.3 } = {}) {
    await this.start()
    let d = this.drones.get(id)
    if (!d) {
      const amp = new Tone.Gain(0).connect(this.out)
      const osc = new Tone.Oscillator({ frequency: freq, type: partials ? 'custom' : type })
      if (partials) osc.partials = partials
      osc.connect(amp).start()
      amp.gain.rampTo(gain, 0.05)
      d = { osc, amp }
      this.drones.set(id, d)
      return
    }
    this.updateDrone(id, { freq, type, partials, gain })
  }

  updateDrone(id, { freq, type, partials, gain } = {}) {
    const d = this.drones.get(id)
    if (!d) return
    if (Number.isFinite(freq) && freq > 0) d.osc.frequency.rampTo(freq, 0.03)
    if (partials) d.osc.partials = partials
    else if (type && d.osc.type !== type) d.osc.type = type
    if (Number.isFinite(gain)) d.amp.gain.rampTo(gain, 0.05)
  }

  stopDrone(id) {
    const d = this.drones.get(id)
    if (!d) return
    this.drones.delete(id)
    d.amp.gain.rampTo(0, 0.05)
    setTimeout(() => { d.osc.stop(); d.osc.dispose(); d.amp.dispose() }, 120)
  }

  isDroning(id) {
    return this.drones.has(id)
  }

  /**
   * Repeating step loop. onStep(step, time) runs ahead of time on the audio
   * clock for scheduling sounds; onDraw(step) runs in sync for the UI.
   */
  async loop({ stepSeconds, steps, onStep, onDraw }) {
    await this.start()
    this.stopLoop()
    const transport = Tone.getTransport()
    let step = 0
    this.loopId = transport.scheduleRepeat((time) => {
      const s = step
      onStep?.(s, time)
      if (onDraw) Tone.getDraw().schedule(() => onDraw(s), time)
      step = (step + 1) % steps
    }, stepSeconds)
    transport.start('+0.05')
  }

  stopLoop() {
    const transport = Tone.getTransport()
    if (this.loopId != null) transport.clear(this.loopId)
    this.loopId = null
    transport.stop()
    transport.cancel()
  }

  hit(kind, time, velocity = 1) {
    if (!this.ready) return
    if (kind === 'low') this.kick.triggerAttackRelease('C2', '16n', time, velocity)
    else if (kind === 'high') this.tick.triggerAttackRelease('C6', 0.03, time, velocity)
    else this.tick.triggerAttackRelease('G5', 0.03, time, velocity * 0.6)
  }

  /** Play a frequency at a specific audio-clock time (for loops). */
  noteAt(freq, time, dur = 0.2, velocity = 0.7) {
    if (this.ready) this.synth.triggerAttackRelease(freq, dur, time, velocity)
  }

  waveform() {
    return this.analyser ? this.analyser.getValue() : null
  }

  stopAll() {
    for (const id of [...this.drones.keys()]) this.stopDrone(id)
    if (this.ready) {
      this.stopLoop()
      this.synth.releaseAll()
    }
  }
}

export const audio = new LabAudio()
