import type { AudioSource } from '@soniox/client'

import { type PcmCapture, startPcmCapture } from './pcm-capture'

/** Raw PCM source for Soniox when the session owns a playback stream. */
export function createSonioxPlaybackSource(stream: MediaStream): AudioSource {
  let capture: PcmCapture | null = null
  let stopped = false
  let paused = false
  return {
    async start(handlers) {
      const acquired = await startPcmCapture({
        deviceId: '',
        stream,
        onFrame(frame) {
          if (!stopped && !paused) handlers.onData(frame.buffer)
        },
      })
      if (stopped) acquired.stop()
      else capture = acquired
    },
    stop() {
      stopped = true
      capture?.stop()
      capture = null
    },
    pause() {
      paused = true
    },
    resume() {
      paused = false
    },
  }
}
