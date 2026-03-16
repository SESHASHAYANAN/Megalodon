import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import { FiX, FiCpu, FiLoader, FiCheck, FiAlertCircle, FiCopy, FiMaximize2, FiMinimize2 } from 'react-icons/fi'
import ScopeMap from './ScopeMap'

// ── Code block with copy button ──────────────────────────────────────────────
function CodeBlock({ children, className }) {
    const [copied, setCopied] = useState(false)
    const lang = className?.replace('language-', '') || ''
    const code = String(children).replace(/\n$/, '')
    const handleCopy = () => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <div style={{ position: 'relative', marginBottom: 8 }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 10px', background: 'var(--orca-bg-elevated)',
                borderRadius: '8px 8px 0 0', border: '1px solid var(--orca-border)', borderBottom: 'none',
            }}>
                <span style={{ fontSize: 10, color: 'var(--orca-text-muted)', fontFamily: 'var(--font-mono)' }}>{lang || 'code'}</span>
                <button onClick={handleCopy} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: copied ? 'var(--orca-green)' : 'var(--orca-text-muted)',
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 6px',
                    borderRadius: 4, transition: 'all 0.15s',
                }}>
                    <FiCopy size={11} /> {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre style={{
                margin: 0, padding: 12, overflow: 'auto',
                background: 'var(--orca-bg)', borderRadius: '0 0 8px 8px',
                border: '1px solid var(--orca-border)', borderTop: 'none', fontSize: 12, lineHeight: '18px',
            }}>
                <code className={className}>{children}</code>
            </pre>
        </div>
    )
}

const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
        if (inline) return (
            <code style={{ background: 'var(--orca-bg-tertiary)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orca-cyan)' }} {...props}>
                {children}
            </code>
        )
        return <CodeBlock className={className}>{children}</CodeBlock>
    }
}

/**
 * AnalysisModal — Reusable modal for showing AI analysis results.
 *
 * Props:
 *   title        {string}   Modal title (e.g. "Explain Purpose", "Test Results")
 *   emoji        {string}   Emoji icon for the title
 *   content      {string}   Markdown content to display
 *   loading      {boolean}  Whether the analysis is still running
 *   loadingText  {string}   Text to show while loading
 *   error        {string}   Error message if analysis failed
 *   onClose      {Function} Callback to close the modal
 *   filesAnalyzed {string[]} Optional list of files analyzed
 */
export default function AnalysisModal({ title, emoji, content, loading, loadingText, error, onClose, filesAnalyzed, scopeMap }) {
    const [fullscreen, setFullscreen] = useState(false)

    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    const overlayStyle = fullscreen
        ? { position: 'fixed', inset: 0, zIndex: 10000 }
        : {
            position: 'fixed',
            top: 40, left: '50%', transform: 'translateX(-50%)',
            width: 'min(900px, 94vw)',
            height: 'calc(100vh - 60px)',
            zIndex: 1200,
        }

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, zIndex: 1199,
                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
                }}
            />

            {/* Modal */}
            <div style={{
                ...overlayStyle,
                display: 'flex', flexDirection: 'column',
                background: 'var(--orca-bg)',
                border: '1px solid var(--orca-border)',
                borderRadius: fullscreen ? 0 : 14,
                boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 18px', flexShrink: 0,
                    background: 'var(--orca-bg-secondary)',
                    borderBottom: '1px solid var(--orca-border)',
                }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 9,
                        background: 'linear-gradient(135deg, var(--orca-accent), var(--orca-purple))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span style={{ fontSize: 16 }}>{emoji || '🤖'}</span>
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 700, flex: 1, color: 'var(--orca-text)' }}>{title}</span>

                    {filesAnalyzed && filesAnalyzed.length > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--orca-text-muted)' }}>
                            {filesAnalyzed.length} files analyzed
                        </span>
                    )}

                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--orca-accent)' }}>
                            <FiLoader size={13} className="spinner" /> {loadingText || 'Analyzing...'}
                        </div>
                    )}

                    {/* Fullscreen */}
                    <button onClick={() => setFullscreen(f => !f)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--orca-text-muted)', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                        {fullscreen ? <FiMinimize2 size={14} /> : <FiMaximize2 size={14} />}
                    </button>

                    {/* Close (X) */}
                    <button onClick={onClose}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--orca-text-muted)', padding: '4px 8px', borderRadius: 6,
                            display: 'flex', alignItems: 'center',
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--orca-red)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--orca-text-muted)'}
                        title="Close (Esc)">
                        <FiX size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
                    {loading && !content && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                            <div className="animate-pulse-glow" style={{
                                width: 56, height: 56, borderRadius: 14,
                                background: 'linear-gradient(135deg, var(--orca-accent), var(--orca-purple))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <FiCpu size={24} color="white" />
                            </div>
                            <p style={{ color: 'var(--orca-text-secondary)', fontSize: 14 }}>{loadingText || 'Running analysis...'}</p>
                            <div className="spinner" style={{ width: 24, height: 24 }} />
                        </div>
                    )}

                    {error && (
                        <div style={{
                            padding: '14px 18px', borderRadius: 10,
                            background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.25)',
                            color: 'var(--orca-red)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            <FiAlertCircle size={16} /> {error}
                        </div>
                    )}

                    {scopeMap && (
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--orca-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                🗺️ Interactive Scope Map
                            </div>
                            <ScopeMap data={scopeMap} />
                        </div>
                    )}

                    {content && (
                        <div className="markdown-content copilot-response" style={{ fontSize: 14 }}>
                            <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
                                {content}
                            </ReactMarkdown>
                        </div>
                    )}

                    {!loading && content && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 14px', marginTop: 20, borderRadius: 8,
                            background: 'rgba(63,185,80,0.1)', color: '#3fb950', fontSize: 12,
                        }}>
                            <FiCheck size={14} /> Analysis complete.
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
