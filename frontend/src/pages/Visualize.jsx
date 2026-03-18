import { useState, useRef, useEffect, useCallback, Component } from 'react'
import {
    FiSearch, FiVideo, FiEye, FiAlertCircle, FiActivity,
    FiLoader, FiRotateCw, FiPlay, FiDownload, FiAlertTriangle,
    FiCheck, FiX, FiArrowRight, FiCode, FiDatabase, FiServer,
    FiMonitor, FiLayers, FiFile, FiFolder, FiZap
} from 'react-icons/fi'
import { API } from '../services/api'

const MODES = [
    { id: 'video', label: 'Video', icon: FiVideo, desc: 'Generate a 50s project walkthrough video', color: '#7c6aff' },
    { id: 'overview', label: 'Overview', icon: FiEye, desc: 'One-page visual project summary', color: '#3fb950' },
    { id: 'errors', label: 'Errors', icon: FiAlertCircle, desc: 'Annotated error visualization', color: '#f85149' },
    { id: 'dataflow', label: 'Data Flow', icon: FiActivity, desc: 'Animated data flow diagram', color: '#58a6ff' },
]

const SCENE_DURATIONS = [5, 10, 15, 10, 10] // hook, intro, code, stats, cta

// ── Error Boundary ─────────────────────────────────────────
class VisualizeErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="visualize-error-boundary">
                    <FiAlertTriangle size={48} color="#f43f5e" />
                    <h2>Something went wrong</h2>
                    <p>{this.state.error?.message || 'Unexpected error in Visualize module.'}</p>
                    <button onClick={() => this.setState({ hasError: false, error: null })} className="btn-primary">
                        <FiRotateCw size={14} /> Retry
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}

export default function VisualizeWithBoundary() {
    return (
        <VisualizeErrorBoundary>
            <VisualizeInner />
        </VisualizeErrorBoundary>
    )
}

function VisualizeInner() {
    const [repoUrl, setRepoUrl] = useState('')
    const [scanned, setScanned] = useState(false)
    const [activeMode, setActiveMode] = useState(null)

    // Video / Reel state
    const [videoStatus, setVideoStatus] = useState(null) // 'rendering' | 'error'
    const [videoAnalysis, setVideoAnalysis] = useState(null)
    const [videoError, setVideoError] = useState('')

    // Reel playback state
    const [reelData, setReelData] = useState(null)
    const [reelPlaying, setReelPlaying] = useState(false)
    const [reelPaused, setReelPaused] = useState(false)
    const [currentScene, setCurrentScene] = useState(0)

    // Overview state
    const [overview, setOverview] = useState(null)
    const [overviewLoading, setOverviewLoading] = useState(false)

    // Errors state
    const [errors, setErrors] = useState(null)
    const [errorsLoading, setErrorsLoading] = useState(false)

    // Dataflow state
    const [dataflow, setDataflow] = useState(null)
    const [dataflowLoading, setDataflowLoading] = useState(false)

    const pollRef = useRef(null)
    const sceneTimerRef = useRef(null)

    // Scene durations in seconds
    const SCENE_DURATIONS_REF = [5, 10, 15, 10, 10] // hook, intro, code, stats, cta

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
            if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current)
        }
    }, [])

    // Auto-advance scenes
    useEffect(() => {
        if (!reelPlaying || reelPaused) return
        if (currentScene >= SCENE_DURATIONS_REF.length) return

        sceneTimerRef.current = setTimeout(() => {
            if (currentScene < SCENE_DURATIONS_REF.length - 1) {
                setCurrentScene(prev => prev + 1)
            } else {
                setReelPaused(true) // pause at end
            }
        }, SCENE_DURATIONS_REF[currentScene] * 1000)

        return () => {
            if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current)
        }
    }, [currentScene, reelPlaying, reelPaused])

    // ── Scan (lightweight validation) ─────────────────────
    const handleScan = useCallback(() => {
        if (!repoUrl.trim()) return
        setScanned(true)
        setActiveMode('video')
    }, [repoUrl])

    // ── Reel Generation ───────────────────────────────────
    const generateReel = useCallback(async () => {
        if (!repoUrl.trim()) return
        setVideoStatus('rendering')
        setVideoError('')
        setVideoAnalysis(null)
        setReelData(null)
        setReelPlaying(false)
        setCurrentScene(0)

        try {
            // Call backend for repo analysis (or use the AI chat endpoint as fallback)
            const r = await fetch(`${API}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    message: `You are a viral short-form video director for Instagram Reels. Analyze this GitHub repo and create a reel script. Repo: ${repoUrl.trim()}

Return ONLY valid JSON with this structure:
{
  "hook": "catchy 5-word hook text",
  "projectName": "project name",
  "tagline": "one line description",
  "techStack": ["tech1", "tech2", "tech3", "tech4"],
  "codeLines": [
    {"text": "// comment", "cls": "comment"},
    {"text": "function name() {", "cls": "func"},
    {"text": "  return value;", "cls": ""},
    {"text": "}", "cls": ""}
  ],
  "stats": [
    {"num": "42", "label": "Files"},
    {"num": "3.2K", "label": "Lines"},
    {"num": "5", "label": "Languages"},
    {"num": "99%", "label": "Score"}
  ],
  "cta": "Follow for more 🚀"
}`,
                    context: '',
                    history: []
                }),
            })

            if (!r.ok) throw new Error(`API error: ${r.status}`)
            const data = await r.json()

            // Try to parse AI response as JSON
            let parsed = null
            try {
                const raw = data.response || ''
                const jsonMatch = raw.match(/\{[\s\S]*\}/)
                if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
            } catch { /* use defaults */ }

            if (parsed) {
                setReelData(parsed)
                setVideoAnalysis({
                    project_name: parsed.projectName,
                    tagline: parsed.tagline,
                    tech_stack: { frontend: parsed.techStack?.slice(0, 2), backend: parsed.techStack?.slice(2) }
                })
            }

            setVideoStatus(null)
            setReelPlaying(true)
            setReelPaused(false)
            setCurrentScene(0)
        } catch (err) {
            // Fallback: use defaults and still play reel
            setVideoStatus(null)
            setReelPlaying(true)
            setReelPaused(false)
            setCurrentScene(0)
        }
    }, [repoUrl])

    // ── Overview ──────────────────────────────────────────
    const fetchOverview = useCallback(async () => {
        if (overview || overviewLoading) return
        setOverviewLoading(true)
        try {
            const r = await fetch(`${API}/visualize/overview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ repo_url: repoUrl.trim() }),
            })
            const data = await r.json()
            setOverview(data)
        } catch (err) {
            setOverview({ error: err.message })
        } finally {
            setOverviewLoading(false)
        }
    }, [repoUrl, overview, overviewLoading])

    // ── Errors ────────────────────────────────────────────
    const fetchErrors = useCallback(async () => {
        if (errors || errorsLoading) return
        setErrorsLoading(true)
        try {
            const r = await fetch(`${API}/visualize/errors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ repo_url: repoUrl.trim() }),
            })
            const data = await r.json()
            setErrors(data)
        } catch (err) {
            setErrors({ error: err.message })
        } finally {
            setErrorsLoading(false)
        }
    }, [repoUrl, errors, errorsLoading])

    // ── Dataflow ──────────────────────────────────────────
    const fetchDataflow = useCallback(async () => {
        if (dataflow || dataflowLoading) return
        setDataflowLoading(true)
        try {
            const r = await fetch(`${API}/visualize/dataflow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ repo_url: repoUrl.trim() }),
            })
            const data = await r.json()
            setDataflow(data)
        } catch (err) {
            setDataflow({ error: err.message })
        } finally {
            setDataflowLoading(false)
        }
    }, [repoUrl, dataflow, dataflowLoading])

    // ── Mode Change Handler ───────────────────────────────
    const handleModeChange = (modeId) => {
        setActiveMode(modeId)
        if (modeId === 'overview') fetchOverview()
        if (modeId === 'errors') fetchErrors()
        if (modeId === 'dataflow') fetchDataflow()
    }

    // ══════════════════════════════════════════════════════
    // RENDER — Pre-scan state
    // ══════════════════════════════════════════════════════
    if (!scanned) {
        return (
            <div className="visualize-page">
                <div className="visualize-hero">
                    <div className="visualize-hero-glow" />
                    <div className="visualize-hero-icon">🎬</div>
                    <h1 className="visualize-hero-title">Visualize Any Codebase</h1>
                    <p className="visualize-hero-desc">
                        Paste a GitHub repo URL to generate walkthrough videos, project overviews,
                        error visualizations, and animated data flow diagrams.
                    </p>
                    <div className="visualize-scan-input">
                        <FiSearch size={18} />
                        <input
                            type="text"
                            value={repoUrl}
                            onChange={e => setRepoUrl(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleScan()}
                            placeholder="https://github.com/user/repo"
                        />
                        <button onClick={handleScan} disabled={!repoUrl.trim()}>
                            Visualize
                        </button>
                    </div>
                    <div className="visualize-features-grid">
                        {MODES.map(mode => {
                            const Icon = mode.icon
                            return (
                                <div key={mode.id} className="visualize-feature-card">
                                    <div className="visualize-feature-icon" style={{ background: `${mode.color}20`, color: mode.color }}>
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

    // ══════════════════════════════════════════════════════
    // RENDER — Post-scan state (mode sidebar + content)
    // ══════════════════════════════════════════════════════
    return (
        <div className="visualize-page visualize-page--active">
            {/* Mode Sidebar */}
            <div className="visualize-sidebar">
                <div className="visualize-sidebar-repo">
                    <FiCode size={14} />
                    <span>{repoUrl.split('/').slice(-1)[0] || 'Repository'}</span>
                </div>
                {MODES.map(mode => {
                    const Icon = mode.icon
                    return (
                        <button
                            key={mode.id}
                            className={`visualize-mode-btn ${activeMode === mode.id ? 'active' : ''}`}
                            onClick={() => handleModeChange(mode.id)}
                            style={{ '--mode-color': mode.color }}
                        >
                            <Icon size={16} />
                            <span>{mode.label}</span>
                        </button>
                    )
                })}
                <button className="visualize-mode-btn" onClick={() => {
                    setScanned(false)
                    setActiveMode(null)
                    setOverview(null)
                    setErrors(null)
                    setDataflow(null)
                    setVideoStatus(null)
                    setReelData(null)
                    setReelPlaying(false)
                    setReelPaused(false)
                    setCurrentScene(0)
                    if (pollRef.current) clearInterval(pollRef.current)
                    if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current)
                }}>
                    <FiRotateCw size={16} />
                    <span>New Scan</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="visualize-content">
                {/* ── VIDEO TAB — INSTAGRAM REEL ────────────── */}
                {activeMode === 'video' && (
                    <div className="vis-section animate-fadeIn">
                        <h2 className="vis-section-title"><FiVideo size={22} /> Video Walkthrough</h2>
                        <p className="vis-hint">
                            Generate a 50-second Instagram Reel-style walkthrough: hook → project → code → stats → CTA
                        </p>

                        {!videoStatus && !reelPlaying && (
                            <button className="vis-generate-btn" onClick={generateReel}>
                                <FiPlay size={18} />
                                Generate Reel
                            </button>
                        )}

                        {videoStatus === 'rendering' && (
                            <div className="vis-status-card rendering">
                                <div className="vis-spinner" />
                                <div>
                                    <h3>Analyzing your project...</h3>
                                    <p>Generating a viral reel script from your codebase.</p>
                                </div>
                            </div>
                        )}

                        {videoStatus === 'error' && (
                            <div className="vis-status-card error">
                                <FiAlertTriangle size={24} style={{ color: '#f85149' }} />
                                <div>
                                    <h3>Reel generation failed</h3>
                                    <p>{videoError}</p>
                                    <button className="vis-retry-btn" onClick={() => { setVideoStatus(null); setReelPlaying(false) }}>
                                        <FiRotateCw size={14} /> Retry
                                    </button>
                                </div>
                            </div>
                        )}

                        {(reelPlaying || reelData) && (
                            <div className="reel-container">
                                {/* Phone Frame */}
                                <div className="reel-phone-frame">
                                    <div className="reel-screen">
                                        {/* Progress bar segments */}
                                        <div className="reel-progress-bar">
                                            {SCENE_DURATIONS.map((dur, i) => (
                                                <div
                                                    key={i}
                                                    className={`reel-progress-segment ${
                                                        i < currentScene ? 'done' : i === currentScene ? 'active' : ''
                                                    }`}
                                                    style={{ '--scene-duration': `${dur}s` }}
                                                >
                                                    <div className="reel-progress-fill" />
                                                </div>
                                            ))}
                                        </div>

                                        {/* Scene 1 — Hook */}
                                        <div className={`reel-scene reel-scene-hook ${currentScene === 0 ? 'active' : ''}`}>
                                            <div className="reel-hook-emoji">🔥</div>
                                            <div className="reel-hook-text">
                                                {reelData?.hook || "I built something insane"}
                                            </div>
                                            <div className="reel-hook-sub">swipe to see the magic ✨</div>
                                        </div>

                                        {/* Scene 2 — Project Intro */}
                                        <div className={`reel-scene reel-scene-intro ${currentScene === 1 ? 'active' : ''}`}>
                                            <div className="reel-project-name">
                                                {reelData?.projectName || repoUrl.split('/').pop() || 'My Project'}
                                            </div>
                                            <div className="reel-tagline">
                                                {reelData?.tagline || 'A developer project that pushes boundaries'}
                                            </div>
                                            <div className="reel-tech-badges">
                                                {(reelData?.techStack || ['React', 'Python', 'FastAPI']).map((tech, i) => (
                                                    <span
                                                        key={i}
                                                        className="reel-tech-badge"
                                                        style={{ animationDelay: `${0.3 + i * 0.15}s` }}
                                                    >
                                                        {tech}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Scene 3 — Code */}
                                        <div className={`reel-scene reel-scene-code ${currentScene === 2 ? 'active' : ''}`}>
                                            <div className="reel-code-label">✦ Core Logic</div>
                                            <div className="reel-code-block">
                                                {(reelData?.codeLines || [
                                                    { text: '// The magic happens here', cls: 'comment' },
                                                    { text: 'async function analyze(repo) {', cls: 'func' },
                                                    { text: '  const data = await scan(repo);', cls: '' },
                                                    { text: '  const graph = buildGraph(data);', cls: '' },
                                                    { text: '  return graph.optimize();', cls: 'keyword' },
                                                    { text: '}', cls: '' },
                                                    { text: '', cls: '' },
                                                    { text: 'export default analyze;', cls: 'keyword' },
                                                ]).map((line, i) => (
                                                    <div
                                                        key={i}
                                                        className={`reel-code-line ${line.cls}`}
                                                        style={{ animationDelay: `${0.3 + i * 0.2}s` }}
                                                    >
                                                        {line.text || '\u00A0'}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Scene 4 — Stats */}
                                        <div className={`reel-scene reel-scene-stats ${currentScene === 3 ? 'active' : ''}`}>
                                            <div className="reel-stats-title">Project Stats</div>
                                            <div className="reel-stats-grid">
                                                {(reelData?.stats || [
                                                    { num: '42', label: 'Files' },
                                                    { num: '3.2K', label: 'Lines' },
                                                    { num: '5', label: 'Languages' },
                                                    { num: '99%', label: 'Clean Code' },
                                                ]).map((stat, i) => (
                                                    <div
                                                        key={i}
                                                        className="reel-stat-card"
                                                        style={{ animationDelay: `${0.2 + i * 0.15}s` }}
                                                    >
                                                        <div className="reel-stat-number">{stat.num}</div>
                                                        <div className="reel-stat-label">{stat.label}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Scene 5 — CTA */}
                                        <div className={`reel-scene reel-scene-cta ${currentScene === 4 ? 'active' : ''}`}>
                                            <div className="reel-cta-emoji">🚀</div>
                                            <div className="reel-cta-text">
                                                {reelData?.cta || 'Follow for more'}
                                            </div>
                                            <div className="reel-cta-sub">
                                                Built with passion • Star on GitHub
                                            </div>
                                            <div className="reel-cta-buttons">
                                                <span className="reel-cta-btn like">❤️ Like</span>
                                                <span className="reel-cta-btn share">↗ Share</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="reel-controls">
                                    <button
                                        className="reel-play-btn"
                                        onClick={() => {
                                            if (reelPaused) {
                                                setReelPaused(false)
                                            } else {
                                                setReelPaused(true)
                                            }
                                        }}
                                    >
                                        {reelPaused ? <><FiPlay size={14} /> Play</> : <><FiLoader size={14} /> Pause</>}
                                    </button>
                                    <div className="reel-scene-dots">
                                        {SCENE_DURATIONS.map((_, i) => (
                                            <button
                                                key={i}
                                                className={`reel-dot ${i === currentScene ? 'active' : ''}`}
                                                onClick={() => setCurrentScene(i)}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        className="vis-retry-btn"
                                        onClick={() => { setReelPlaying(false); setReelData(null); setVideoStatus(null); setCurrentScene(0) }}
                                    >
                                        <FiRotateCw size={14} /> Reset
                                    </button>
                                </div>
                            </div>
                        )}

                        {videoAnalysis && (
                            <div className="vis-analysis-preview">
                                <h3>📊 Analysis Preview</h3>
                                <div className="vis-analysis-grid">
                                    <div className="vis-analysis-item">
                                        <span className="vis-analysis-label">Project</span>
                                        <span className="vis-analysis-value">{videoAnalysis.project_name}</span>
                                    </div>
                                    <div className="vis-analysis-item">
                                        <span className="vis-analysis-label">Tagline</span>
                                        <span className="vis-analysis-value">{videoAnalysis.tagline}</span>
                                    </div>
                                    {videoAnalysis.tech_stack && (
                                        <>
                                            <div className="vis-analysis-item">
                                                <span className="vis-analysis-label">Frontend</span>
                                                <span className="vis-analysis-value">
                                                    {videoAnalysis.tech_stack.frontend?.join(', ') || 'N/A'}
                                                </span>
                                            </div>
                                            <div className="vis-analysis-item">
                                                <span className="vis-analysis-label">Backend</span>
                                                <span className="vis-analysis-value">
                                                    {videoAnalysis.tech_stack.backend?.join(', ') || 'N/A'}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── OVERVIEW TAB ─────────────────────────── */}
                {activeMode === 'overview' && (
                    <div className="vis-section animate-fadeIn">
                        <h2 className="vis-section-title"><FiEye size={22} /> Project Overview</h2>

                        {overviewLoading && (
                            <div className="vis-loading"><FiLoader className="spin-icon" size={24} /> Analyzing project...</div>
                        )}

                        {overview && !overview.error && (
                            <div className="vis-overview-content">
                                <div className="vis-overview-header">
                                    <h3>{overview.project_name || 'Project'}</h3>
                                    <span className="vis-arch-badge">{overview.architecture_type || 'Unknown'}</span>
                                </div>
                                <p className="vis-overview-purpose">{overview.purpose}</p>

                                {overview.quick_stats && (
                                    <div className="vis-stats-row">
                                        <div className="vis-stat"><span className="vis-stat-num">{overview.quick_stats.total_files || '—'}</span><span>Files</span></div>
                                        <div className="vis-stat"><span className="vis-stat-num">{overview.quick_stats.languages || '—'}</span><span>Languages</span></div>
                                        <div className="vis-stat"><span className="vis-stat-num">{overview.quick_stats.frameworks || '—'}</span><span>Frameworks</span></div>
                                        <div className="vis-stat"><span className="vis-stat-num">{overview.complexity_score || '—'}/10</span><span>Complexity</span></div>
                                    </div>
                                )}

                                {overview.tech_summary && (
                                    <div className="vis-tech-cards">
                                        {Object.entries(overview.tech_summary).map(([k, v]) => (
                                            <div key={k} className="vis-tech-card">
                                                <span className="vis-tech-label">{k}</span>
                                                <span className="vis-tech-value">{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {overview.entry_points?.length > 0 && (
                                    <div className="vis-entry-points">
                                        <h4><FiFile size={14} /> Entry Points</h4>
                                        {overview.entry_points.map((ep, i) => (
                                            <div key={i} className="vis-entry-item">
                                                <span className="vis-entry-badge">{ep.type}</span>
                                                <code>{ep.file}</code>
                                                <span className="vis-entry-desc">{ep.description}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {overview.key_directories?.length > 0 && (
                                    <div className="vis-dirs">
                                        <h4><FiFolder size={14} /> Key Directories</h4>
                                        {overview.key_directories.map((dir, i) => (
                                            <div key={i} className="vis-dir-item">
                                                <code>{dir.path}</code>
                                                <span>{dir.purpose}</span>
                                                {dir.file_count && <span className="vis-dir-count">{dir.file_count} files</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {overview?.error && (
                            <div className="vis-status-card error">
                                <FiAlertTriangle size={20} />
                                <p>{overview.error}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── ERRORS TAB ───────────────────────────── */}
                {activeMode === 'errors' && (
                    <div className="vis-section animate-fadeIn">
                        <h2 className="vis-section-title"><FiAlertCircle size={22} /> Error Visualization</h2>

                        {errorsLoading && (
                            <div className="vis-loading"><FiLoader className="spin-icon" size={24} /> Scanning for errors...</div>
                        )}

                        {errors && !errors.error && (
                            <div className="vis-errors-content">
                                <div className="vis-errors-summary">
                                    <div className="vis-error-stat critical">
                                        <span className="vis-error-stat-num">{errors.critical || 0}</span>
                                        <span>Critical</span>
                                    </div>
                                    <div className="vis-error-stat warning">
                                        <span className="vis-error-stat-num">{errors.warnings || 0}</span>
                                        <span>Warnings</span>
                                    </div>
                                    <div className="vis-error-stat total">
                                        <span className="vis-error-stat-num">{errors.total_errors || 0}</span>
                                        <span>Total</span>
                                    </div>
                                </div>

                                {errors.errors?.map((err, i) => (
                                    <div key={i} className={`vis-error-card ${err.severity}`} style={{ animationDelay: `${i * 0.1}s` }}>
                                        <div className="vis-error-header">
                                            <span className={`vis-severity-badge ${err.severity}`}>
                                                {err.severity === 'critical' ? <FiX size={12} /> : err.severity === 'warning' ? <FiAlertTriangle size={12} /> : <FiZap size={12} />}
                                                {err.severity}
                                            </span>
                                            <span className="vis-error-type">{err.type}</span>
                                            <span className={`vis-error-status ${err.status}`}>
                                                {err.status === 'fixed' ? <FiCheck size={12} /> : <FiX size={12} />}
                                                {err.status}
                                            </span>
                                        </div>
                                        <h4 className="vis-error-title">{err.title}</h4>
                                        <p className="vis-error-desc">{err.description}</p>
                                        {err.file && (
                                            <div className="vis-error-location">
                                                <code>{err.file}{err.line ? `:${err.line}` : ''}</code>
                                            </div>
                                        )}
                                        {err.code_snippet && (
                                            <pre className="vis-error-code">{err.code_snippet}</pre>
                                        )}
                                        {err.fix_suggestion && (
                                            <div className="vis-error-fix">
                                                <FiZap size={12} /> <strong>Fix:</strong> {err.fix_suggestion}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {errors?.error && (
                            <div className="vis-status-card error">
                                <FiAlertTriangle size={20} />
                                <p>{errors.error}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── DATAFLOW TAB ─────────────────────────── */}
                {activeMode === 'dataflow' && (
                    <div className="vis-section animate-fadeIn">
                        <h2 className="vis-section-title"><FiActivity size={22} /> Data Flow Visualization</h2>

                        {dataflowLoading && (
                            <div className="vis-loading"><FiLoader className="spin-icon" size={24} /> Analyzing data flow...</div>
                        )}

                        {dataflow && !dataflow.error && (
                            <div className="vis-dataflow-content">
                                {/* Layer cards */}
                                <div className="vis-layers-row">
                                    {dataflow.layers?.map((layer, i) => (
                                        <div key={i} className="vis-layer-card" style={{ '--layer-color': layer.color || '#7c6aff' }}>
                                            <div className="vis-layer-icon">
                                                {layer.id === 'frontend' ? <FiMonitor size={24} /> :
                                                 layer.id === 'backend' ? <FiServer size={24} /> :
                                                 layer.id === 'database' ? <FiDatabase size={24} /> :
                                                 <FiLayers size={24} />}
                                            </div>
                                            <h4>{layer.name}</h4>
                                            <span className="vis-layer-tech">{layer.tech}</span>
                                            <div className="vis-layer-components">
                                                {layer.components?.map((comp, j) => (
                                                    <span key={j} className="vis-layer-component">{comp}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Connection arrows */}
                                {dataflow.connections?.length > 0 && (
                                    <div className="vis-connections">
                                        <h4>Connections</h4>
                                        {dataflow.connections.map((conn, i) => (
                                            <div key={i} className="vis-connection" style={{ animationDelay: `${i * 0.2}s` }}>
                                                <span className="vis-conn-from">{conn.from}</span>
                                                <div className="vis-conn-arrow">
                                                    <FiArrowRight size={16} />
                                                    <span className="vis-conn-label">{conn.label}</span>
                                                    <span className="vis-conn-protocol">{conn.protocol}</span>
                                                </div>
                                                <span className="vis-conn-to">{conn.to}</span>
                                                {conn.methods?.length > 0 && (
                                                    <div className="vis-conn-methods">
                                                        {conn.methods.map((m, j) => (
                                                            <code key={j}>{m}</code>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {dataflow.flow_description && (
                                    <div className="vis-flow-desc">
                                        <h4>Flow Description</h4>
                                        <p>{dataflow.flow_description}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {dataflow?.error && (
                            <div className="vis-status-card error">
                                <FiAlertTriangle size={20} />
                                <p>{dataflow.error}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
