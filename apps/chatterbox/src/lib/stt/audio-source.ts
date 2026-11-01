import type { SttAudioSource } from './types'

export interface LiveAudioInput {
  stream: MediaStream
  stop: () => void
  onEnded: (handler: () => void) => void
}

function mediaElements(root: Document | ShadowRoot): HTMLMediaElement[] {
  const media = [...root.querySelectorAll<HTMLMediaElement>('video, audio')]
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot) media.push(...mediaElements(element.shadowRoot))
  }
  for (const frame of root.querySelectorAll('iframe')) {
    try {
      if (frame.contentDocument) media.push(...mediaElements(frame.contentDocument))
    } catch {}
  }
  return media
}

/** Capture live playback without opening the microphone. */
export async function captureLiveAudio(source: Exclude<SttAudioSource, 'microphone'>): Promise<LiveAudioInput> {
  let captured: MediaStream
  let player: HTMLMediaElement | undefined
  if (source === 'tab') {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('当前浏览器不支持标签页音频采集')
    const options = {
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      systemAudio: 'exclude',
    }
    captured = await navigator.mediaDevices.getDisplayMedia(options)
  } else {
    player = mediaElements(document)
      .filter(media => !media.paused && !media.ended && media.readyState >= 2)
      .sort((a, b) => {
        const aa = a.getBoundingClientRect(),
          bb = b.getBoundingClientRect()
        return bb.width * bb.height - aa.width * aa.height
      })[0]
    if (!player) throw new Error('没有找到正在播放的直播播放器，请先播放直播或选择标签页音频')
    const element = player as HTMLMediaElement & {
      captureStream?: () => MediaStream
      mozCaptureStream?: () => MediaStream
    }
    const capture = element.captureStream ?? element.mozCaptureStream
    if (!capture) throw new Error('播放器不支持直接采集，请选择标签页音频')
    try {
      captured = capture.call(element)
    } catch {
      throw new Error('播放器限制直接采集，请选择标签页音频')
    }
  }
  const release = () => {
    for (const track of captured.getTracks()) track.stop()
  }
  const audioTracks = captured.getAudioTracks().filter(track => track.readyState === 'live')
  if (!audioTracks.length) {
    release()
    throw new Error(
      source === 'tab' ? '未共享音频，请选择直播标签页并勾选共享标签页音频' : '播放器没有可采集的音轨，请选择标签页音频'
    )
  }
  const videoTrack = captured.getVideoTracks()[0]
  if (source === 'tab' && videoTrack?.getSettings().displaySurface !== 'browser') {
    release()
    throw new Error('请选择浏览器标签页，以便仅识别直播声音')
  }
  if (source === 'player') for (const track of captured.getVideoTracks()) track.stop()
  const stream = new MediaStream(audioTracks)
  let disposed = false
  let handler: (() => void) | undefined
  const ended = () => {
    if (!disposed) handler?.()
  }
  const tracks = captured.getTracks().filter(track => track.readyState === 'live')
  for (const track of tracks) track.addEventListener('ended', ended)
  player?.addEventListener('ended', ended)
  const monitor = player
    ? setInterval(() => {
        if (!player?.isConnected || player.ended) ended()
      }, 500)
    : undefined
  return {
    stream,
    onEnded(callback) {
      handler = callback
      if (!stream.getAudioTracks().some(track => track.readyState === 'live')) ended()
    },
    stop() {
      if (disposed) return
      disposed = true
      clearInterval(monitor)
      for (const track of tracks) track.removeEventListener('ended', ended)
      player?.removeEventListener('ended', ended)
      release()
    },
  }
}
