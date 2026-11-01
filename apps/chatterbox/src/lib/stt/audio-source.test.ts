import { afterEach, beforeEach, expect, jest, test } from 'bun:test'

import type { SttEngine, SttEngineEvent, SttEngineEventHandler, SttSessionParams } from './types'

import { captureLiveAudio } from './audio-source'
import { createAudioSourceEngine } from './audio-source-engine'

class Track extends EventTarget {
  readyState = 'live'
  stops = 0
  constructor(
    readonly kind: string,
    readonly surface = 'browser'
  ) {
    super()
  }
  stop() {
    this.stops++
    this.readyState = 'ended'
  }
  getSettings() {
    return { displaySurface: this.surface }
  }
  end() {
    this.readyState = 'ended'
    this.dispatchEvent(new Event('ended'))
  }
}
class Stream {
  constructor(readonly tracks: Track[]) {}
  getTracks() {
    return this.tracks
  }
  getAudioTracks() {
    return this.tracks.filter(t => t.kind === 'audio')
  }
  getVideoTracks() {
    return this.tracks.filter(t => t.kind === 'video')
  }
}
class Player extends EventTarget {
  paused = false
  ended = false
  readyState = 4
  isConnected = true
  captures = 0
  constructor(
    readonly stream: Stream,
    readonly size = 100
  ) {
    super()
  }
  getBoundingClientRect() {
    return { width: this.size, height: this.size }
  }
  captureStream() {
    this.captures++
    return this.stream
  }
}
const originals = new Map(
  ['document', 'navigator', 'MediaStream'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)])
)
let players: Player[] = []
let display: () => Promise<Stream>
let micCalls = 0
let active: SttEngine | undefined
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
const params: SttSessionParams = {
  apiKey: 'test',
  model: 'test',
  audioDeviceId: '',
  languageHints: [],
  audioSource: 'player',
}
const define = (key: string, value: unknown) =>
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
beforeEach(() => {
  players = []
  micCalls = 0
  display = async () => new Stream([new Track('audio'), new Track('video')])
  define('MediaStream', Stream)
  define('document', { querySelectorAll: (selector: string) => (selector === 'video, audio' ? players : []) })
  define('navigator', {
    mediaDevices: {
      getDisplayMedia: () => display(),
      getUserMedia: () => {
        micCalls++
        throw new Error('Unexpected microphone request')
      },
    },
  })
})
afterEach(() => {
  active?.cancel()
  active = undefined
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
  jest.useRealTimers()
})
function player(size = 100) {
  const audio = new Track('audio'),
    video = new Track('video')
  const element = new Player(new Stream([audio, video]), size)
  players.push(element)
  return { element, audio, video }
}
function session(overrides: Partial<SttSessionParams> = {}) {
  const events: SttEngineEvent[] = []
  const state = {
    starts: 0,
    stops: 0,
    cancels: 0,
    received: undefined as SttSessionParams | undefined,
    emit: (() => {}) as SttEngineEventHandler,
  }
  const factory = (received: SttSessionParams, emit: SttEngineEventHandler): SttEngine => {
    state.received = received
    state.emit = emit
    return {
      start: () => {
        state.starts++
      },
      stop: async () => {
        state.stops++
      },
      cancel: () => {
        state.cancels++
      },
      pause() {},
      resume() {},
      finalize() {},
    }
  }
  active = createAudioSourceEngine(factory, { ...params, ...overrides }, event => events.push(event))
  return { engine: active, events, state }
}
test('captures largest playing media, discards video, leaves playback intact, never asks for microphone', async () => {
  const small = player(10),
    large = player(100)
  const input = await captureLiveAudio('player')
  expect(large.element.captures).toBe(1)
  expect(small.element.captures).toBe(0)
  expect(input.stream.getAudioTracks()[0] as unknown).toBe(large.audio)
  expect(input.stream.getVideoTracks()).toHaveLength(0)
  expect(large.video.readyState).toBe('ended')
  input.stop()
  input.stop()
  expect(large.audio.stops).toBe(1)
  expect(large.element.paused).toBe(false)
  expect(micCalls).toBe(0)
})
test('unavailable or protected playback gives actionable errors with no microphone fallback', async () => {
  await expect(captureLiveAudio('player')).rejects.toThrow('没有找到')
  const p = player()
  p.element.captureStream = () => {
    throw new Error('SecurityError')
  }
  await expect(captureLiveAudio('player')).rejects.toThrow('标签页音频')
  expect(micCalls).toBe(0)
})
test('tab without shared audio releases all tracks', async () => {
  const video = new Track('video')
  display = async () => new Stream([video])
  await expect(captureLiveAudio('tab')).rejects.toThrow('共享标签页音频')
  expect(video.stops).toBe(1)
  expect(micCalls).toBe(0)
})
test('rejects whole-screen capture and releases it', async () => {
  const audio = new Track('audio'),
    video = new Track('video', 'monitor')
  display = async () => new Stream([audio, video])
  await expect(captureLiveAudio('tab')).rejects.toThrow('浏览器标签页')
  expect(audio.stops).toBe(1)
  expect(video.stops).toBe(1)
})
test('ending tab sharing notifies session and releases capture', async () => {
  const audio = new Track('audio'),
    video = new Track('video')
  display = async () => new Stream([audio, video])
  const input = await captureLiveAudio('tab')
  let ends = 0
  input.onEnded(() => {
    ends++
    input.stop()
  })
  video.end()
  expect(ends).toBe(1)
  expect(audio.readyState).toBe('ended')
})
test('replaced player ends the old capture', async () => {
  jest.useFakeTimers()
  const p = player()
  const input = await captureLiveAudio('player')
  let ends = 0
  input.onEnded(() => {
    ends++
    input.stop()
  })
  p.element.isConnected = false
  jest.advanceTimersByTime(600)
  expect(ends).toBe(1)
  expect(p.audio.readyState).toBe('ended')
})
test('wrapper supplies audio to provider once and retains final text while draining', async () => {
  const p = player()
  const { engine, state, events } = session()
  engine.start()
  engine.start()
  await tick()
  expect(p.element.captures).toBe(1)
  expect(state.starts).toBe(1)
  expect(state.received?.audioStream?.getAudioTracks()[0] as unknown).toBe(p.audio)
  await engine.stop()
  state.emit({ type: 'transcript', chunks: [{ text: '最后一句', kind: 'original', isFinal: true }] })
  state.emit({ type: 'finished' })
  expect(events.at(-2)?.type).toBe('transcript')
  expect(events.at(-1)?.type).toBe('finished')
  expect(p.audio.readyState).toBe('ended')
})
test('stop while tab picker is pending releases late stream without starting provider', async () => {
  let resolve: (s: Stream) => void = () => {}
  const audio = new Track('audio'),
    video = new Track('video')
  display = () =>
    new Promise<Stream>(r => {
      resolve = r
    })
  const { engine, state, events } = session({ audioSource: 'tab' })
  engine.start()
  await engine.stop()
  resolve(new Stream([audio, video]))
  await tick()
  expect(state.starts).toBe(0)
  expect(audio.readyState).toBe('ended')
  expect(video.readyState).toBe('ended')
  expect(events.filter(e => e.type === 'finished')).toHaveLength(1)
})
test('cancel while capture is pending prevents provider start', async () => {
  const p = player()
  const { engine, state } = session()
  engine.start()
  engine.cancel()
  await tick()
  expect(state.starts).toBe(0)
  expect(p.audio.readyState).toBe('ended')
})
test('provider error cancels session and releases player stream', async () => {
  const p = player()
  const { engine, state, events } = session()
  engine.start()
  await tick()
  state.emit({ type: 'error', error: new Error('provider unavailable') })
  expect(p.audio.readyState).toBe('ended')
  expect(state.cancels).toBe(1)
  state.emit({ type: 'connected' })
  expect(events.at(-1)?.type).toBe('error')
})
test('stalled provider stop is bounded and releases tab capture', async () => {
  jest.useFakeTimers()
  const p = player()
  const { engine, state, events } = session()
  engine.start()
  await tick()
  await engine.stop()
  jest.advanceTimersByTime(12000)
  expect(state.cancels).toBe(1)
  expect(p.audio.readyState).toBe('ended')
  expect(events.at(-1)?.type).toBe('finished')
})
test('microphone mode retains original provider behavior', () => {
  const { engine, state } = session({ audioSource: 'microphone' })
  engine.start()
  expect(state.starts).toBe(1)
  expect(state.received?.audioStream).toBeUndefined()
  expect(players).toHaveLength(0)
})
