import { useState, useEffect, useRef } from 'react'
import { FiX, FiCpu, FiAlertTriangle, FiCheckCircle, FiInfo, FiCopy, FiCheck, FiBarChart2 } from 'react-icons/fi'
import { streamCodeReview } from '../services/api'

/**
 * CodeReviewPopup — Advanced floating popup for AI code review.
 * Tabbed: Issues Found | Improved Code | Plain English | Code Quality Score
 */
export default function CodeReviewPopup({ code, filename, onClose, onApply }) {
    const [loading, setLoading] = useState(true)
    const [review, setReview] = useState('')
    const [improved, setImproved] = useState('')
    const [explanation, setExplanation] = useState('')
    const [quality, setQuality] = useState(null)
    const [error, setError] = useState(null)
    const [copied, setCopied] = useState(false)
    const [activeTab, setActiveTab] = useState('issues')
    const [scanProgress, setScanProgress] = useState(0)
    const scanInterval = useRef(null)

    const TABS = [
        { id: 'issues', label: 'Issues Found', emoji: '🔍' },
        { id: 'improved', label: 'Improved Code', emoji: '✨' },
        { id: 'explanation', label: 'Codebase Explanation', emoji: '📖' },
        { id: 'quality', label: 'Code Quality Score', emoji: '📊' },
    ]

    // Animate the scanner
    useEffect(() => {
        if (loading) {
            scanInterval.current = setInterval(() => {
                setScanProgress(p => (p >= 100 ? 0 : p + 0.8))
            }, 30)
        } else {
            clearInterval(scanInterval.current)
            setScanProgress(100)
        }
        return () => clearInterval(scanInterval.current)
    }, [loading])

    // Fetch review via SSE
    useEffect(() => {
        let cancelled = false
        const run = async () => {
            try {
                const resp = await streamCodeReview(code, filename)
                if (!resp.ok) throw new Error('Review request failed')
                const reader = resp.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ''

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop()

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue
                        try {
                            const data = JSON.parse(line.slice(6))
                            if (cancelled) return
                            if (data.type === 'review') setReview(data.content || '')
                            else if (data.type === 'improved') setImproved(data.content || '')
                            else if (data.type === 'explanation') setExplanation(data.content || '')
                            else if (data.type === 'quality') setQuality(data.scores || null)
                            else if (data.type === 'error') setError(data.message)
                            else if (data.type === 'done') setLoading(false)
                        } catch { }
                    }
                }
                if (!cancelled) setLoading(false)
            } catch (e) {
                if (!cancelled) { setError(e.message); setLoading(false) }
            }
        }
        run()
        return () => { cancelled = true }
    }, [code, filename])

    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    const handleCopyImproved = () => {
        let codeText = improved
        const match = codeText.match(/```[\w]*\n([\s\S]*?)```/)
        if (match) codeText = match[1]
        navigator.clipboard.writeText(codeText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleApply = () => {
        let codeText = improved
        const match = codeText.match(/```[\w]*\n([\s\S]*?)```/)
        if (match) codeText = match[1]
        onApply?.(codeText)
        onClose()
    }

    const parseSeverity = (line) => {
        if (line.includes('[CRITICAL')) return { severity: 'critical', icon: '🔴', color: '#ff7b72', bg: 'rgba(248,81,73,0.12)' }
        if (line.includes('[WARNING')) return { severity: 'warning', icon: '🟡', color: '#e3b341', bg: 'rgba(227,179,65,0.12)' }
        if (line.includes('[INFO')) return { severity: 'info', icon: '🔵', color: '#58a6ff', bg: 'rgba(88,166,255,0.12)' }
        return null
    }

    const parseLineNum = (line) => {
        const match = line.match(/\|line\s*(\d+)\]/)
        return match ? match[1] : null
    }

    // Simple diff: compute added/removed lines
    const renderDiff = () => {
        let improvedClean = improved.replace(/^```[\w]*\n/, '').replace(/\n```$/, '')
        const origLines = code.split('\n')
        const impLines = improvedClean.split('\n')

        return (
            <div style={{ display: 'flex', gap: 0, overflow: 'auto', maxHeight: 400, borderRadius: 8, border: '1px solid var(--orca-border)' }}>
                {/* Original */}
                <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid var(--orca-border)' }}>
                    <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#ff7b72', background: 'rgba(248,81,73,0.08)', borderBottom: '1px solid var(--orca-border)' }}>
                        Original
                    </div>
                    <pre style={{
                        padding: '10px 12px', margin: 0, fontSize: 12, lineHeight: '20px',
                        fontFamily: 'var(--font-mono)', color: '#c9d1d9', background: 'var(--orca-bg)',
                        whiteSpace: 'pre', overflowX: 'auto',
                    }}>
                        {origLines.map((line, i) => (
                            <div key={i} style={{
                                padding: '0 4px',
                                background: !impLines[i] || impLines[i] !== line ? 'rgba(248,81,73,0.1)' : 'transparent',
                            }}>
                                <span style={{ color: 'var(--orca-text-muted)', fontSize: 11, marginRight: 8, display: 'inline-block', width: 28, textAlign: 'right' }}>{i + 1}</span>
                                {line}
                            </div>
                        ))}
                    </pre>
                </div>
                {/* Improved */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#3fb950', background: 'rgba(63,185,80,0.08)', borderBottom: '1px solid var(--orca-border)' }}>
                        Improved
                    </div>
                    <pre style={{
                        padding: '10px 12px', margin: 0, fontSize: 12, lineHeight: '20px',
                        fontFamily: 'var(--font-mono)', color: '#c9d1d9', background: 'var(--orca-bg)',
                        whiteSpace: 'pre', overflowX: 'auto',
                    }}>
                        {impLines.map((line, i) => (
                            <div key={i} style={{
                                padding: '0 4px',
                                background: !origLines[i] || origLines[i] !== line ? 'rgba(63,185,80,0.1)' : 'transparent',
                            }}>
                                <span style={{ color: 'var(--orca-text-muted)', fontSize: 11, marginRight: 8, display: 'inline-block', width: 28, textAlign: 'right' }}>{i + 1}</span>
                                {line}
                            </div>
                        ))}
                    </pre>
                </div>
            </div>
        )
    }

    const renderQualityBar = (label, value, color, delay) => (
        <div key={label} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--orca-text)' }}>
                <span>{label}</span>
                <span style={{ color }}>{value}/100</span>
            </div>
            <div style={{
                height: 10, borderRadius: 5, background: 'var(--orca-bg-tertiary)',
                overflow: 'hidden', position: 'relative',
            }}>
                <div style={{
                    width: `${value}%`, height: '100%', borderRadius: 5,
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    animation: `progressFill 1s ease-out ${delay}s both`,
                    transition: 'width 1s ease-out',
                }} />
            </div>
        </div>
    )

    return (
        <>
            {/* Backdrop */}
            <div onClick={onClose}
                style={{ position: 'fixed', inset: 0, zIndex: 1199, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }} />

            {/* Popup */}
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: 'min(900px, 94vw)', maxHeight: '88vh',
                zIndex: 1200,
                display: 'flex', flexDirection: 'column',
                background: 'var(--orca-bg)',
                border: '1px solid var(--orca-border)',
                borderRadius: 14,
                boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
                overflow: 'hidden',
                animation: 'fadeIn 0.25s ease-out',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 18px', flexShrink: 0,
                    background: 'var(--orca-bg-secondary)',
                    borderBottom: '1px solid var(--orca-border)',
                }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'var(--orca-gradient)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: loading ? 'pulse-glow 2s ease-in-out infinite' : 'none',
                    }}>
                        <FiCpu size={16} color="white" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--orca-text)' }}>AI Code Review</div>
                        <div style={{ fontSize: 11, color: 'var(--orca-text-muted)' }}>{filename}</div>
                    </div>
                    <button onClick={onClose}
                        style={{
                            background: 'var(--orca-bg-elevated)', border: '1px solid var(--orca-border)',
                            borderRadius: 8, cursor: 'pointer', color: 'var(--orca-text-muted)',
                            padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 12, transition: 'all 0.15s', position: 'absolute', top: 12, right: 14,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ff7b72'; e.currentTarget.style.borderColor = '#ff7b72' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--orca-text-muted)'; e.currentTarget.style.borderColor = 'var(--orca-border)' }}>
                        <FiX size={14} /> ✕
                    </button>
                </div>

                {/* AI scanning animation line and sweep */}
                <div style={{ height: 3, background: 'var(--orca-bg-tertiary)', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                    {loading && (
                        <div style={{
                            position: 'absolute', top: 0, left: 0, width: '30%', height: '100%',
                            background: 'var(--orca-gradient)',
                            animation: 'lineSweep 1.5s ease-in-out infinite',
                            borderRadius: 2,
                        }} />
                    )}
                </div>

                {/* Sweep animation overlay on the whole popup body */}
                {loading && (
                    <div style={{
                        position: 'absolute', top: 61, bottom: 0, left: `${scanProgress}%`,
                        width: '4px', background: 'var(--orca-cyan)',
                        boxShadow: '0 0 15px var(--orca-cyan)', zIndex: 999,
                        pointerEvents: 'none', transition: 'left 0.05s linear',
                        opacity: 0.15,
                    }} />
                )}

                {!loading && (
                    <div style={{ height: 3, flexShrink: 0 }}>
                        <div style={{ width: '100%', height: '100%', background: error ? '#ff7b72' : '#3fb950', borderRadius: 2 }} />
                    </div>
                )}

                {/* Tab Bar */}
                <div style={{
                    display: 'flex', borderBottom: '1px solid var(--orca-border)',
                    background: 'var(--orca-bg-secondary)', flexShrink: 0,
                    padding: '0 14px',
                }}>
                    {TABS.map(tab => (
                        <button key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '10px 16px', fontSize: 12, fontWeight: 600,
                                border: 'none', background: 'transparent', cursor: 'pointer',
                                color: activeTab === tab.id ? 'var(--orca-accent)' : 'var(--orca-text-muted)',
                                borderBottom: activeTab === tab.id ? '2px solid var(--orca-accent)' : '2px solid transparent',
                                display: 'flex', alignItems: 'center', gap: 6,
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--orca-text-secondary)' }}
                            onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--orca-text-muted)' }}>
                            <span>{tab.emoji}</span> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'auto', padding: '20px 22px' }}>
                    {loading && !review && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 0' }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: '50%',
                                background: 'var(--orca-gradient)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                animation: 'pulse-glow 2s ease-in-out infinite',
                            }}>
                                <FiCpu size={28} color="white" />
                            </div>
                            <div style={{ fontSize: 14, color: 'var(--orca-text-secondary)', animation: 'fadeIn 0.3s' }}>
                                AI is reading and analyzing your code...
                            </div>
                            {/* Code line sweep visualization */}
                            <div style={{
                                width: '80%', maxWidth: 400, borderRadius: 8, overflow: 'hidden',
                                background: 'var(--orca-bg-tertiary)', padding: '12px 14px',
                            }}>
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} style={{
                                        height: 8, borderRadius: 4, marginBottom: 6,
                                        background: 'var(--orca-bg-elevated)',
                                        animation: `lineSweep 1.5s ease-in-out ${i * 0.2}s infinite`,
                                        opacity: 0.6 + i * 0.08,
                                    }} />
                                ))}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(248,81,73,0.1)', color: '#ff7b72', fontSize: 13, marginBottom: 16 }}>
                            <FiAlertTriangle size={14} style={{ marginRight: 6 }} /> {error}
                        </div>
                    )}

                    {/* ── Tab: Issues Found ── */}
                    {activeTab === 'issues' && review && (
                        <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {review.split('\n').filter(l => l.trim()).map((line, i) => {
                                    const sev = parseSeverity(line)
                                    const lineNum = parseLineNum(line)
                                    if (sev) {
                                        return (
                                            <div key={i} style={{
                                                padding: '10px 14px', borderRadius: 8,
                                                background: sev.bg, border: `1px solid ${sev.color}30`,
                                                fontSize: 13, lineHeight: 1.6, color: 'var(--orca-text-secondary)',
                                                display: 'flex', alignItems: 'flex-start', gap: 8,
                                                animation: `fadeIn ${0.3 + i * 0.1}s ease-out`,
                                            }}>
                                                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{sev.icon}</span>
                                                <span style={{
                                                    fontSize: 10, fontWeight: 700, padding: '2px 8px',
                                                    borderRadius: 4, background: sev.color,
                                                    color: '#fff', flexShrink: 0, textTransform: 'uppercase',
                                                    marginTop: 2,
                                                }}>{sev.severity}</span>
                                                {lineNum && (
                                                    <span style={{
                                                        fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                                        background: 'var(--orca-bg-elevated)', color: 'var(--orca-text-muted)',
                                                        flexShrink: 0, marginTop: 2, fontFamily: 'var(--font-mono)',
                                                    }}>L{lineNum}</span>
                                                )}
                                                <span>{line.replace(/\[(CRITICAL|WARNING|INFO)(\|line\s*\d+)?\]\s*/, '')}</span>
                                            </div>
                                        )
                                    }
                                    return <div key={i} style={{ fontSize: 13, color: 'var(--orca-text-secondary)', lineHeight: 1.6, paddingLeft: 4 }}>{line}</div>
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Tab: Improved Code ── */}
                    {activeTab === 'improved' && improved && (
                        <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ fontSize: 13, color: 'var(--orca-text-muted)' }}>
                                    Side-by-side comparison
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={handleCopyImproved}
                                        style={{
                                            background: 'var(--orca-bg-elevated)', border: '1px solid var(--orca-border)',
                                            borderRadius: 6, cursor: 'pointer', color: copied ? 'var(--orca-green)' : 'var(--orca-text-muted)',
                                            padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
                                        }}>
                                        {copied ? <><FiCheck size={11} /> Copied</> : <><FiCopy size={11} /> Copy</>}
                                    </button>
                                    <button onClick={handleApply}
                                        style={{
                                            background: 'var(--orca-gradient-vivid)', border: 'none',
                                            borderRadius: 6, cursor: 'pointer', color: 'white',
                                            padding: '4px 14px', fontSize: 11, fontWeight: 700,
                                        }}>
                                        ✅ Apply to File
                                    </button>
                                </div>
                            </div>
                            {renderDiff()}
                        </div>
                    )}

                    {/* ── Tab: Plain English ── */}
                    {activeTab === 'explanation' && explanation && (
                        <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {explanation.split('\n').filter(l => l.trim()).map((sentence, i) => (
                                    <div key={i} style={{
                                        fontSize: 14, lineHeight: 1.8, color: 'var(--orca-text-secondary)',
                                        padding: '10px 16px', borderRadius: 8,
                                        background: 'var(--orca-bg-elevated)',
                                        borderLeft: '3px solid var(--orca-cyan)',
                                        animation: `fadeInSentence 0.4s ease-out ${i * 0.15}s both`,
                                        opacity: 0,
                                    }}>
                                        {sentence}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Tab: Code Quality Score ── */}
                    {activeTab === 'quality' && (
                        <div style={{ animation: 'fadeIn 0.4s ease-out', maxWidth: 500, margin: '0 auto', paddingTop: 10 }}>
                            {quality ? (
                                <>
                                    {/* Overall score */}
                                    <div style={{
                                        textAlign: 'center', marginBottom: 28, padding: '20px 0',
                                        borderBottom: '1px solid var(--orca-border)',
                                    }}>
                                        <div style={{
                                            fontSize: 48, fontWeight: 800,
                                            background: 'var(--orca-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                        }}>
                                            {Math.round((quality.readability + quality.performance + quality.security + quality.maintainability) / 4)}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--orca-text-muted)', marginTop: 4 }}>Overall Score</div>
                                    </div>
                                    {renderQualityBar('📖 Readability', quality.readability, '#58a6ff', 0.1)}
                                    {renderQualityBar('⚡ Performance', quality.performance, '#3fb950', 0.3)}
                                    {renderQualityBar('🔒 Security', quality.security, '#f0883e', 0.5)}
                                    {renderQualityBar('🔧 Maintainability', quality.maintainability, '#bc8cff', 0.7)}
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: 40, color: 'var(--orca-text-muted)' }}>
                                    {loading ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                            <div className="spinner" style={{ width: 16, height: 16 }} /> Calculating scores...
                                        </div>
                                    ) : 'No quality scores available.'}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Empty state for tabs without data yet */}
                    {!loading && !error && (
                        (activeTab === 'issues' && !review) ||
                        (activeTab === 'improved' && !improved) ||
                        (activeTab === 'explanation' && !explanation)
                    ) && (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--orca-text-muted)', fontSize: 13 }}>
                                No data available for this section.
                            </div>
                        )}
                </div>
            </div >
        </>
    )
}
