import { useState, useRef, useEffect, useCallback, Component } from 'react'
import { FiSearch, FiBookOpen, FiGitBranch, FiTarget, FiCheckCircle, FiMic, FiVolume2, FiSend, FiLoader, FiChevronRight, FiRotateCw, FiCode, FiZap, FiFolder, FiFile, FiAlertTriangle } from 'react-icons/fi'
import ReactMarkdown from 'react-markdown'

const MODES = [
    { id: 'learn', label: 'Learn', icon: FiBookOpen, desc: 'AI explains your codebase simply', color: '#7c6aff' },
    { id: 'visualize', label: 'Visualize', icon: FiGitBranch, desc: 'Architecture diagrams & node graphs', color: '#3fb950' },
    { id: 'focus', label: 'Focus', icon: FiTarget, desc: 'Important files & learning path', color: '#f0883e' },
    { id: 'quality', label: 'Code Quality', icon: FiCheckCircle, desc: 'Complexity, duplication analysis', color: '#58a6ff' },
]

// ── Error Boundary ─────────────────────────────────────────
class LearningErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }
    componentDidCatch(error, errorInfo) {
        console.error('Learning Error:', error, errorInfo)
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    height: '100%', gap: 16, padding: 32, color: '#94a3b8',
                    background: 'var(--orca-bg, #0a0a1a)',
                }}>
                    <FiAlertTriangle size={48} color="#f43f5e" />
                    <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: 20 }}>Content Unavailable</h2>
                    <p style={{ margin: 0, maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
                        {this.state.error?.message || 'An unexpected error occurred in the Learning module.'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{
                            padding: '10px 24px', background: 'linear-gradient(135deg, #7c6aff, #9d6fff)',
                            border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer',
                            fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
                        }}
                    >
                        <FiRotateCw size={14} /> Retry
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}

export default function LearningWithBoundary() {
    return (
        <LearningErrorBoundary>
            <LearningInner />
        </LearningErrorBoundary>
    )
}

function LearningInner() {
    const [repoUrl, setRepoUrl] = useState('')
    const [isScanning, setIsScanning] = useState(false)
    const [scanResult, setScanResult] = useState(null) // { structure, techStack, purpose }
    const [activeMode, setActiveMode] = useState(null)
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [flashcards, setFlashcards] = useState([])
    const [activeCardIdx, setActiveCardIdx] = useState(0)
    const [cardFlipped, setCardFlipped] = useState(false)
    const [qualityReport, setQualityReport] = useState(null)
    const [focusFiles, setFocusFiles] = useState([])
    const messagesEndRef = useRef(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // ── Scan Repository ───────────────────────────────────
    const handleScan = useCallback(async () => {
        if (!repoUrl.trim()) return
        setIsScanning(true)
        setScanResult(null)
        setActiveMode(null)
        setMessages([])

        try {
            const response = await fetch('/api/learning/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo_url: repoUrl.trim() }),
            })
            if (!response.ok) throw new Error(`Scan failed: ${response.status}`)
            const data = await response.json()
            setScanResult(data)
        } catch (err) {
            setScanResult({ error: err.message })
        } finally {
            setIsScanning(false)
        }
    }, [repoUrl])

    // ── Learn Mode Chat ───────────────────────────────────
    const handleLearnChat = useCallback(async (prompt) => {
        if (!prompt.trim() || isProcessing) return
        setIsProcessing(true)
        const userMsg = { role: 'user', content: prompt }
        setMessages(prev => [...prev, userMsg])
        setInput('')

        try {
            const response = await fetch('/api/learning/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo_url: repoUrl, question: prompt }),
            })
            if (!response.ok) throw new Error(`Failed: ${response.status}`)
            const data = await response.json()
            setMessages(prev => [...prev, { role: 'assistant', content: data.explanation }])
            if (data.flashcards) setFlashcards(prev => [...prev, ...data.flashcards])
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${err.message}`, isError: true }])
        } finally {
            setIsProcessing(false)
        }
    }, [repoUrl, isProcessing])

    // ── Code Quality Analysis ─────────────────────────────
    const runQualityAnalysis = useCallback(async () => {
        setIsProcessing(true)
        try {
            const response = await fetch('/api/learning/quality', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo_url: repoUrl }),
            })
            if (!response.ok) throw new Error(`Analysis failed: ${response.status}`)
            const data = await response.json()
            setQualityReport(data)
        } catch (err) {
            setQualityReport({ error: err.message })
        } finally {
            setIsProcessing(false)
        }
    }, [repoUrl])

    // ── Focus Mode ────────────────────────────────────────
    const runFocusAnalysis = useCallback(async () => {
        setIsProcessing(true)
        try {
            const response = await fetch('/api/learning/focus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo_url: repoUrl }),
            })
            if (!response.ok) throw new Error(`Focus failed: ${response.status}`)
            const data = await response.json()
            setFocusFiles(data.files || [])
        } catch (err) {
            setFocusFiles([])
        } finally {
            setIsProcessing(false)
        }
    }, [repoUrl])

    // ── TTS ──────────────────────────────────────────────
    const speakText = useCallback((text) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text)
            utterance.rate = 0.9
            speechSynthesis.cancel()
            speechSynthesis.speak(utterance)
        }
    }, [])

    // ── STT ──────────────────────────────────────────────
    const startListening = useCallback(() => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript
            setInput(transcript)
        }
        recognition.start()
    }, [])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (activeMode === 'learn') handleLearnChat(input)
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) }
    }

    // ══════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════

    // Pre-scan state
    if (!scanResult) {
        return (
            <div className="learning-page">
                <div className="learning-hero">
                    <div className="learning-hero-icon">🧠</div>
                    <h1 className="learning-hero-title">Learn Any Codebase</h1>
                    <p className="learning-hero-desc">
                        Paste a GitHub repository URL and let AI analyze the codebase for you.
                        Get explanations, architecture diagrams, flashcards, and quality reports.
                    </p>
                    <div className="learning-scan-input">
                        <FiSearch size={18} />
                        <input
                            type="text"
                            value={repoUrl}
                            onChange={e => setRepoUrl(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleScan()}
                            placeholder="https://github.com/user/repo"
                            disabled={isScanning}
                        />
                        <button onClick={handleScan} disabled={isScanning || !repoUrl.trim()}>
                            {isScanning ? <><FiLoader className="spin-icon" size={16} /> Scanning...</> : 'Scan Repository'}
                        </button>
                    </div>
                    <div className="learning-features-grid">
                        {MODES.map(mode => {
                            const Icon = mode.icon
                            return (
                                <div key={mode.id} className="learning-feature-card">
                                    <div className="learning-feature-icon" style={{ background: `${mode.color}20`, color: mode.color }}>
                                        <Icon size={24} />
                                    </div>
                                    <h3>{mode.label}</h3>
                                    <p>{mode.desc}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        )
    }

    // Error state
    if (scanResult.error) {
        return (
            <div className="learning-page">
                <div className="learning-hero">
                    <h2 style={{ color: 'var(--orca-red)' }}>❌ Scan Failed</h2>
                    <p>{scanResult.error}</p>
                    <button className="btn-primary" onClick={() => setScanResult(null)}>Try Again</button>
                </div>
            </div>
        )
    }

    // Post-scan state — mode selector + active mode
    return (
        <div className="learning-page learning-page--scanned">
            {/* Mode Sidebar */}
            <div className="learning-mode-sidebar">
                <div className="learning-mode-repo">
                    <FiCode size={14} />
                    <span>{repoUrl.split('/').slice(-1)[0] || 'Repository'}</span>
                </div>
                {MODES.map(mode => {
                    const Icon = mode.icon
                    return (
                        <button
                            key={mode.id}
                            className={`learning-mode-btn ${activeMode === mode.id ? 'active' : ''}`}
                            onClick={() => {
                                setActiveMode(mode.id)
                                if (mode.id === 'quality' && !qualityReport) runQualityAnalysis()
                                if (mode.id === 'focus' && focusFiles.length === 0) runFocusAnalysis()
                            }}
                            style={{ '--mode-color': mode.color }}
                        >
                            <Icon size={16} />
                            <span>{mode.label}</span>
                        </button>
                    )
                })}
                <button className="learning-mode-btn" onClick={() => { setScanResult(null); setActiveMode(null) }}>
                    <FiRotateCw size={16} />
                    <span>New Scan</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="learning-content">
                {!activeMode && (
                    <div className="learning-overview">
                        <h2>📊 Repository Overview</h2>
                        <div className="learning-overview-grid">
                            <div className="learning-stat-card">
                                <span className="learning-stat-value">{scanResult.file_count || '—'}</span>
                                <span className="learning-stat-label">Files</span>
                            </div>
                            <div className="learning-stat-card">
                                <span className="learning-stat-value">{scanResult.tech_stack?.join(', ') || '—'}</span>
                                <span className="learning-stat-label">Tech Stack</span>
                            </div>
                            <div className="learning-stat-card">
                                <span className="learning-stat-value">{scanResult.purpose || '—'}</span>
                                <span className="learning-stat-label">Purpose</span>
                            </div>
                        </div>
                        {scanResult.structure && (
                            <div className="learning-structure">
                                <h3>📁 File Structure</h3>
                                <pre className="learning-structure-tree">{scanResult.structure}</pre>
                            </div>
                        )}
                        <p className="learning-hint">← Select a mode from the sidebar to start learning</p>
                    </div>
                )}

                {/* Learn Mode */}
                {activeMode === 'learn' && (
                    <div className="learning-chat-mode">
                        <div className="learning-chat-messages">
                            {messages.length === 0 && (
                                <div className="learning-chat-empty">
                                    <FiBookOpen size={32} />
                                    <h3>Ask anything about this codebase</h3>
                                    <p>I'll explain it as if you were 10 years old, then give you the technical details.</p>
                                    <div className="learning-chat-suggestions">
                                        {['What does this project do?', 'Explain the architecture', 'Show me the main components', 'How does the data flow?'].map(s => (
                                            <button key={s} className="creator-suggestion-chip" onClick={() => handleLearnChat(s)}>{s}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {messages.map((msg, i) => (
                                <div key={i} className={`learning-chat-msg ${msg.role}`}>
                                    <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}>
                                        {msg.role === 'assistant' ? (
                                            <div className="copilot-response">
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                <button className="learning-tts-btn" onClick={() => speakText(msg.content)} title="Read aloud">
                                                    <FiVolume2 size={14} />
                                                </button>
                                            </div>
                                        ) : msg.content}
                                    </div>
                                </div>
                            ))}
                            {isProcessing && (
                                <div className="learning-chat-msg assistant">
                                    <div className="chat-bubble-assistant generating">
                                        <FiLoader className="spin-icon" size={14} />
                                        <span>Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Flashcards */}
                        {flashcards.length > 0 && (
                            <div className="learning-flashcards">
                                <h4>📇 Flashcards ({activeCardIdx + 1}/{flashcards.length})</h4>
                                <div className={`learning-flashcard ${cardFlipped ? 'flipped' : ''}`} onClick={() => setCardFlipped(v => !v)}>
                                    <div className="learning-flashcard-front">
                                        <p>{flashcards[activeCardIdx]?.question}</p>
                                        <span className="learning-flashcard-hint">Click to flip</span>
                                    </div>
                                    <div className="learning-flashcard-back">
                                        <p>{flashcards[activeCardIdx]?.answer}</p>
                                        {flashcards[activeCardIdx]?.code && (
                                            <pre className="learning-flashcard-code">{flashcards[activeCardIdx].code}</pre>
                                        )}
                                    </div>
                                </div>
                                <div className="learning-flashcard-nav">
                                    <button disabled={activeCardIdx === 0} onClick={() => { setActiveCardIdx(i => i - 1); setCardFlipped(false) }}>← Prev</button>
                                    <button disabled={activeCardIdx >= flashcards.length - 1} onClick={() => { setActiveCardIdx(i => i + 1); setCardFlipped(false) }}>Next →</button>
                                </div>
                            </div>
                        )}

                        {/* Input */}
                        <form className="learning-chat-input-area" onSubmit={handleSubmit}>
                            <div className="creator-chat-input-wrapper">
                                <textarea
                                    className="creator-chat-input"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask about the codebase..."
                                    rows={1}
                                    disabled={isProcessing}
                                />
                                <button type="button" className="learning-mic-btn" onClick={startListening} title="Voice input">
                                    <FiMic size={16} />
                                </button>
                                <button type="submit" className="creator-chat-send" disabled={!input.trim() || isProcessing}>
                                    <FiSend size={16} />
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Visualize Mode */}
                {activeMode === 'visualize' && (
                    <div className="learning-visualize">
                        <h2><FiGitBranch size={20} /> Architecture Visualization</h2>
                        <p className="learning-hint">Interactive node graph coming soon. Below is a text-based architecture view.</p>
                        {scanResult.structure && (
                            <pre className="learning-structure-tree" style={{ fontSize: 13 }}>{scanResult.structure}</pre>
                        )}
                    </div>
                )}

                {/* Focus Mode */}
                {activeMode === 'focus' && (
                    <div className="learning-focus">
                        <h2><FiTarget size={20} /> Focus: Key Files</h2>
                        {isProcessing ? (
                            <div className="learning-loading"><FiLoader className="spin-icon" size={24} /> Analyzing important files...</div>
                        ) : focusFiles.length > 0 ? (
                            <div className="learning-focus-list">
                                {focusFiles.map((file, i) => (
                                    <div key={i} className="learning-focus-item">
                                        <div className="learning-focus-rank">{i + 1}</div>
                                        <div className="learning-focus-info">
                                            <div className="learning-focus-name"><FiFile size={13} /> {file.path}</div>
                                            <div className="learning-focus-reason">{file.reason}</div>
                                        </div>
                                        <FiChevronRight size={14} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="learning-hint">No focus data available. Try scanning a repository first.</p>
                        )}
                    </div>
                )}

                {/* Code Quality Mode */}
                {activeMode === 'quality' && (
                    <div className="learning-quality">
                        <h2><FiCheckCircle size={20} /> Code Quality Report</h2>
                        {isProcessing ? (
                            <div className="learning-loading"><FiLoader className="spin-icon" size={24} /> Analyzing code quality...</div>
                        ) : qualityReport ? (
                            qualityReport.error ? (
                                <p style={{ color: 'var(--orca-red)' }}>❌ {qualityReport.error}</p>
                            ) : (
                                <div className="learning-quality-report">
                                    <div className="learning-quality-score">
                                        <div className="learning-quality-score-ring" style={{
                                            '--score': `${(qualityReport.score || 75) * 3.6}deg`
                                        }}>
                                            <span>{qualityReport.score || 75}</span>
                                        </div>
                                        <span className="learning-quality-score-label">Overall Score</span>
                                    </div>
                                    {qualityReport.issues?.map((issue, i) => (
                                        <div key={i} className="learning-quality-issue">
                                            <span className={`learning-quality-severity ${issue.severity}`}>{issue.severity}</span>
                                            <span>{issue.message}</span>
                                        </div>
                                    ))}
                                    {qualityReport.suggestions?.map((s, i) => (
                                        <div key={i} className="learning-quality-suggestion">
                                            <FiZap size={13} /> {s}
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            <p className="learning-hint">Run analysis to see results.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
