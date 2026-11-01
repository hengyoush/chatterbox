import type { LiveAudioInput } from './audio-source'
import type { SttEngine, SttEngineEventHandler, SttEngineFactory, SttSessionParams } from './types'

import { STT_STOP_TIMEOUT_MS } from '../const'
import { captureLiveAudio } from './audio-source'

/** Share playback capture across providers while preserving their microphone path. */
export function createAudioSourceEngine(
  factory: SttEngineFactory,
  params: SttSessionParams,
  onEvent: SttEngineEventHandler
): SttEngine {
  const source = params.audioSource ?? 'microphone'
  if (source === 'microphone') return factory(params, onEvent)
  let inner: SttEngine | null = null
  let input: LiveAudioInput | null = null
  let ended = false
  let starting = false
  let stopping = false
  let stopTimer: ReturnType<typeof setTimeout> | undefined
  const release = () => {
    clearTimeout(stopTimer)
    input?.stop()
    input = null
  }
  const finish = () => {
    if (ended) return
    ended = true
    release()
    onEvent({ type: 'state', state: 'stopped' })
    onEvent({ type: 'finished' })
  }
  const stop = async () => {
    if (ended || stopping) return
    stopping = true
    if (!inner) {
      finish()
      return
    }
    onEvent({ type: 'state', state: 'stopping' })
    stopTimer = setTimeout(() => {
      inner?.cancel()
      finish()
    }, STT_STOP_TIMEOUT_MS)
    try {
      await inner.stop()
    } catch (error) {
      if (ended) return
      ended = true
      inner.cancel()
      release()
      onEvent({ type: 'error', error: error instanceof Error ? error : new Error(String(error)) })
    }
  }
  return {
    start() {
      if (starting || ended) return
      starting = true
      // Acquire now: the tab picker needs the original button click's activation.
      void captureLiveAudio(source)
        .then(acquired => {
          if (ended) {
            acquired.stop()
            return
          }
          input = acquired
          inner = factory({ ...params, audioStream: acquired.stream }, event => {
            if (ended) return
            if (event.type === 'error' || event.type === 'finished') {
              ended = true
              release()
              if (event.type === 'error') inner?.cancel()
            }
            onEvent(event)
          })
          acquired.onEnded(() => {
            void stop()
          })
          if (!stopping && !ended) inner.start()
        })
        .catch(error => {
          if (ended) return
          ended = true
          inner?.cancel()
          release()
          onEvent({ type: 'error', error: error instanceof Error ? error : new Error(String(error)) })
        })
    },
    stop,
    cancel() {
      ended = true
      inner?.cancel()
      release()
    },
    pause() {
      inner?.pause()
    },
    resume() {
      inner?.resume()
    },
    finalize(options) {
      inner?.finalize(options)
    },
  }
}
