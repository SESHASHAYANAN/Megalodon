import { useState, useEffect, useRef, useCallback } from 'react'
import { FiX, FiVideo, FiDownload, FiGithub, FiMusic } from 'react-icons/fi'
import { pushToGitHub } from '../../services/api'
import lamejs from 'lamejs'

export default function RecordDemoPopup({ htmlContent, pages = [], appName = 'app', onClose }) {
    const [phase, setPhase] = useState('countdown') // countdown | recording | preview
    const [countdown, setCountdown] = useState(3)
    const [elapsed, setElapsed] = useState(0)
    const [recordedBlob, setRecordedBlob] = useState(null)
    const [videoUrl, setVideoUrl] = useState(null)
    const [currentPageIdx, setCurrentPageIdx] = useState(-1)
    const [isPushing, setIsPushing] = useState(false)
    const [audioBlob, setAudioBlob] = useState(null)
    const [mp3Url, setMp3Url] = useState(null)
    const [encodingMp3, setEncodingMp3] = useState(false)
    const iframeRef = useRef(null)
    const previewContainerRef = useRef(null)
    const mediaRecorderRef = useRef(null)
    const audioRecorderRef = useRef(null)
    const audioStreamRef = useRef(null)
    const chunksRef = useRef([])
    const audioChunksRef = useRef([])
    const timerRef = useRef(null)
    const walkRef = useRef(null)

    const pageList = pages.length > 0 ? pages : ['Home', 'About', 'Features', 'Contact']

    // Escape key close + cleanup
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', handler)
            document.body.style.overflow = ''
            if (timerRef.current) clearInterval(timerRef.current)
            if (walkRef.current) clearTimeout(walkRef.current)
            if (videoUrl) URL.revokeObjectURL(videoUrl)
            if (mp3Url) URL.revokeObjectURL(mp3Url)
            if (audioStreamRef.current) {
                audioStreamRef.current.getTracks().forEach(t => t.stop())
            }
        }
    }, [onClose, videoUrl])

    // Countdown then start recording
    useEffect(() => {
        if (phase !== 'countdown') return
        if (countdown <= 0) {
            startRecording()
            return
        }
        const t = setTimeout(() => setCountdown(c => c - 1), 1000)
        return () => clearTimeout(t)
    }, [phase, countdown])

    const startRecording = useCallback(async () => {
        setPhase('recording')
        chunksRef.current = []
        audioChunksRef.current = []

        try {
            let stream
            try {
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: { ideal: 3840, max: 3840 },
                        height: { ideal: 2160, max: 2160 },
                        frameRate: { ideal: 30 }
                    },
                    audio: false
                })
            } catch {
                // User cancelled or not available, try lower res
                try {
                    stream = await navigator.mediaDevices.getDisplayMedia({
                        video: { width: { ideal: 1920 }, height: { ideal: 1080 } }
                    })
                } catch {
                    // Fallback: canvas-based capture
                    stream = await createCanvasStream()
                }
            }

            if (!stream) {
                setPhase('preview')
                return
            }

            // Detect best supported MIME type
            const mimeType = MediaRecorder.isTypeSupported('video/mp4')
                ? 'video/mp4'
                : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                    ? 'video/webm;codecs=vp9'
                    : 'video/webm'

            const recorder = new MediaRecorder(stream, { mimeType })
            mediaRecorderRef.current = recorder

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType })
                setRecordedBlob(blob)
                const url = URL.createObjectURL(blob)
                setVideoUrl(url)
                setPhase('preview')
                stream.getTracks().forEach(t => t.stop())
            }

            // If user manually stops screen sharing, end recording
            stream.getVideoTracks()[0].onended = () => {
                stopRecording()
            }

            recorder.start(100)

            // Start elapsed timer
            timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)

            // Capture microphone audio in parallel
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
                audioStreamRef.current = audioStream
                const audioMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : 'audio/webm'
                const audioRec = new MediaRecorder(audioStream, { mimeType: audioMime })
                audioRecorderRef.current = audioRec
                audioRec.ondataavailable = (e) => {
                    if (e.data.size > 0) audioChunksRef.current.push(e.data)
                }
                audioRec.onstop = () => {
                    const aBlob = new Blob(audioChunksRef.current, { type: audioMime })
                    setAudioBlob(aBlob)
                    audioStream.getTracks().forEach(t => t.stop())
                }
                audioRec.start(100)
            } catch (audioErr) {
                console.warn('Microphone not available:', audioErr)
                // Audio recording is optional — video still works
            }

            // Auto-walk through pages
            autoWalkPages()

        } catch {
            setPhase('preview')
        }
    }, [pageList, htmlContent])

    const createCanvasStream = useCallback(async () => {
        // Fallback: capture iframe as canvas frames
        // This is a basic fallback for browsers without getDisplayMedia
        try {
            const canvas = document.createElement('canvas')
            canvas.width = 1920
            canvas.height = 1080
            return canvas.captureStream(30)
        } catch {
            return null
        }
    }, [])

    const autoWalkPages = useCallback(() => {
        let index = 0

        const navigateTo = (pageName) => {
            const path = pageName.toLowerCase() === 'home' ? '/' : `/${pageName.toLowerCase()}`
            iframeRef.current?.contentWindow?.postMessage({ action: 'NAVIGATE', path }, '*')
        }

        const smoothScroll = () => {
            // Send scroll command to iframe
            iframeRef.current?.contentWindow?.postMessage({
                action: 'SMOOTH_SCROLL'
            }, '*')
        }

        const walkNext = () => {
            if (index >= pageList.length) {
                // Return to Home then end
                navigateTo('Home')
                setCurrentPageIdx(0)
                walkRef.current = setTimeout(() => stopRecording(), 2000)
                return
            }

            const page = pageList[index]
            setCurrentPageIdx(index)
            navigateTo(page)

            // After 1.5s pause, start smooth scrolling, then wait remaining time
            walkRef.current = setTimeout(() => {
                smoothScroll()
                walkRef.current = setTimeout(() => {
                    index++
                    walkNext()
                }, 2500) // 2.5s more after scroll starts = ~4s total per page
            }, 1500)
        }

        walkNext()
    }, [pageList])

    const stopRecording = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current)
        if (walkRef.current) clearTimeout(walkRef.current)
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
        }
        if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
            audioRecorderRef.current.stop()
        }
    }, [])

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0')
        const s = (seconds % 60).toString().padStart(2, '0')
        return `${m}:${s}`
    }

    const handleDownload = useCallback(() => {
        if (!recordedBlob) return
        const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm'
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const a = document.createElement('a')
        a.href = videoUrl
        a.download = `ORCA_Demo_${appName}_${ts}.${ext}`
        a.click()
    }, [recordedBlob, videoUrl, appName])

    // ── MP3 encoding and download ──
    const handleDownloadMp3 = useCallback(async () => {
        if (!audioBlob) return
        setEncodingMp3(true)
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
            const arrayBuf = await audioBlob.arrayBuffer()
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuf)

            // Get PCM data (mono, downsample to 44100 if needed)
            const sampleRate = audioBuffer.sampleRate
            const numChannels = audioBuffer.numberOfChannels
            const samples = audioBuffer.getChannelData(0) // mono channel

            // Convert Float32 to Int16
            const int16 = new Int16Array(samples.length)
            for (let i = 0; i < samples.length; i++) {
                const s = Math.max(-1, Math.min(1, samples[i]))
                int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
            }

            // Encode to MP3 using lamejs
            const mp3Encoder = new lamejs.Mp3Encoder(1, sampleRate, 128)
            const mp3Data = []
            const blockSize = 1152

            for (let i = 0; i < int16.length; i += blockSize) {
                const chunk = int16.subarray(i, i + blockSize)
                const mp3buf = mp3Encoder.encodeBuffer(chunk)
                if (mp3buf.length > 0) mp3Data.push(mp3buf)
            }

            const finalBuf = mp3Encoder.flush()
            if (finalBuf.length > 0) mp3Data.push(finalBuf)

            const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' })
            const url = URL.createObjectURL(mp3Blob)
            setMp3Url(url)

            // Trigger download
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
            const a = document.createElement('a')
            a.href = url
            a.download = `ORCA_Audio_${appName}_${ts}.mp3`
            a.click()

            audioCtx.close()
        } catch (err) {
            alert('❌ MP3 encoding failed: ' + err.message)
        } finally {
            setEncodingMp3(false)
        }
    }, [audioBlob, appName])

    const handleSaveToGitHub = useCallback(async () => {
        if (!recordedBlob) return
        setIsPushing(true)
        try {
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
            const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm'
            const fileName = `ORCA_Demo_${ts}.${ext}`

            // Convert blob to base64
            const reader = new FileReader()
            const base64 = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result.split(',')[1])
                reader.onerror = reject
                reader.readAsDataURL(recordedBlob)
            })

            await pushToGitHub(
                appName || 'orca-app',
                { [`demo/${fileName}`]: atob(base64) },
                `demo: add ORCA demo recording ${fileName}`
            )
            alert(`✅ Saved to GitHub: demo/${fileName}`)
        } catch (err) {
            alert(`❌ Failed to save to GitHub: ${err.message}`)
        } finally {
            setIsPushing(false)
        }
    }, [recordedBlob, appName])

    // Enhanced HTML with smooth scroll support
    const enhancedHtml = htmlContent ? htmlContent.replace(
        '</body>',
        `<script>
            window.addEventListener('message', function(e) {
                if (e.data && e.data.action === 'SMOOTH_SCROLL') {
                    const totalHeight = document.body.scrollHeight - window.innerHeight;
                    if (totalHeight > 0) {
                        window.scrollTo({ top: totalHeight, behavior: 'smooth' });
                    }
                }
                if (e.data && e.data.action === 'NAVIGATE' && window.navigate) {
                    window.navigate(e.data.path);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        </script></body>`
    ) : htmlContent

    return (
        <div className="record-demo-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="record-demo-popup">
                {/* Header */}
                <div className="record-demo-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FiVideo size={18} style={{ color: 'var(--orca-accent)' }} />
                        <h3 style={{ margin: 0 }}>Record Demo</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {phase === 'recording' && (
                            <button className="record-demo-stop-btn" onClick={stopRecording}>
                                ⏹ Stop Recording
                            </button>
                        )}
                        <button className="creator-icon-btn" onClick={onClose}><FiX size={16} /></button>
                    </div>
                </div>

                {/* Progress Bar — visible during recording */}
                {phase === 'recording' && (
                    <div className="record-demo-progress-bar">
                        {pageList.map((page, i) => (
                            <div
                                key={page}
                                className={`record-demo-progress-segment ${i === currentPageIdx ? 'active' : ''} ${i < currentPageIdx ? 'done' : ''}`}
                            >
                                <span>{page}</span>
                                <div className="progress-fill">
                                    <div
                                        className="progress-fill-inner"
                                        style={{
                                            width: i < currentPageIdx ? '100%' : i === currentPageIdx ? '60%' : '0%'
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Content */}
                <div className="record-demo-content">
                    {phase === 'countdown' && (
                        <div className="record-demo-countdown-area">
                            <div className="record-demo-countdown-number">{countdown > 0 ? countdown : 'GO'}</div>
                            <p style={{ color: 'var(--orca-text-muted)' }}>Recording starts in...</p>
                        </div>
                    )}

                    {phase === 'recording' && (
                        <div ref={previewContainerRef} className="record-demo-container" style={{ flex: 1, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                            {/* Floating REC badge — overlaid on preview, NOT inside iframe */}
                            <div className="record-demo-rec-badge">
                                <span style={{
                                    width: 10, height: 10, background: 'white',
                                    borderRadius: '50%', display: 'inline-block',
                                    animation: 'pulse 1s ease infinite'
                                }} />
                                REC {formatTime(elapsed)}
                            </div>
                            <iframe
                                ref={iframeRef}
                                className="record-demo-iframe"
                                sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                                srcDoc={enhancedHtml}
                                title="Recording Preview"
                            />
                        </div>
                    )}

                    {phase === 'preview' && (
                        <>
                            <div className="record-demo-preview-area">
                                {videoUrl ? (
                                    <video
                                        src={videoUrl}
                                        controls
                                        className="record-demo-video"
                                        autoPlay
                                        style={{ width: '100%', maxHeight: '100%' }}
                                    />
                                ) : (
                                    <div style={{ color: 'var(--orca-text-muted)', textAlign: 'center', padding: 40 }}>
                                        <p>No recording captured. Please try again.</p>
                                    </div>
                                )}
                            </div>
                            {videoUrl && (
                                <div className="record-demo-actions">
                                    <button className="record-demo-save-btn primary" onClick={handleDownload}>
                                        <FiDownload size={16} />
                                        Download {recordedBlob?.type?.includes('mp4') ? 'MP4' : 'WebM'}
                                    </button>
                                    {audioBlob && (
                                        <button
                                            className="record-demo-save-btn primary"
                                            onClick={handleDownloadMp3}
                                            disabled={encodingMp3}
                                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                                        >
                                            <FiMusic size={16} />
                                            {encodingMp3 ? '⏳ Encoding...' : 'Download MP3'}
                                        </button>
                                    )}
                                    <button
                                        className="record-demo-save-btn secondary"
                                        onClick={handleSaveToGitHub}
                                        disabled={isPushing}
                                    >
                                        <FiGithub size={16} />
                                        {isPushing ? '⏳ Pushing...' : 'Save to GitHub'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
