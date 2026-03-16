import { useState, useRef, useEffect } from 'react'
import { FiSend, FiFile, FiEye, FiMessageSquare, FiX, FiGithub, FiCpu, FiRefreshCw, FiTerminal, FiMaximize2, FiMinimize2 } from 'react-icons/fi'
import { sandboxEdit, sandboxPreview } from '../services/api'
import GitHubPushModal from './GitHubPushModal'

const VIEWPORTS = [
    { key: 'mobile', label: '📲 Mobile', width: 390 },
    { key: 'tablet', label: '📱 Tablet', width: 768 },
    { key: 'desktop', label: '🖥️ Desktop', width: '100%' },
]

export default function SandboxPanel({ sandboxId, owner, repo, initialFiles, onClose }) {
    const [files, setFiles] = useState(initialFiles || {})
    const [selectedFile, setSelectedFile] = useState(Object.keys(initialFiles || {})[0] || '')
    const [previewHtml, setPreviewHtml] = useState('')
    const [frameworks, setFrameworks] = useState({})
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `🧪 **Sandbox ready** for **${owner}/${repo}**\n\nI can read the actual code. Ask me to:\n• Add new features\n• Refactor code\n• Write new files\n• Fix bugs\n\nAll changes run live in the sandbox.`
        }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPush, setShowPush] = useState(false)
    const [error, setError] = useState(null)
    const [sandboxStatus, setSandboxStatus] = useState('running') // running | stopped | building
    const [activeViewport, setActiveViewport] = useState('desktop')
    const [fullscreenVp, setFullscreenVp] = useState(null)
    const [srcdoc, setSrcdoc] = useState('')
    const [previewVersion, setPreviewVersion] = useState(0)
    const endRef = useRef(null)
    const timeoutRef = useRef(null)

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

    // Fetch preview HTML and framework info on mount
    useEffect(() => {
        sandboxPreview(sandboxId).then(data => {
            if (data.preview_html) setPreviewHtml(data.preview_html)
            if (data.frameworks) setFrameworks(data.frameworks)
        }).catch(() => { })
    }, [sandboxId])

    // Build srcdoc from files — inline CSS + JS into HTML
    const buildSrcdoc = (fileMap) => {
        if (!fileMap || Object.keys(fileMap).length === 0) return ''
        const htmlFile = Object.keys(fileMap).find(f => f.endsWith('.html')) || ''
        let html = fileMap[htmlFile] || ''

        if (!html) {
            const cssContent = Object.entries(fileMap)
                .filter(([k]) => k.endsWith('.css'))
                .map(([, v]) => v).join('\n')
            const jsContent = Object.entries(fileMap)
                .filter(([k]) => k.endsWith('.js') || k.endsWith('.jsx'))
                .map(([, v]) => v).join('\n')
            html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${cssContent}</style></head><body><div id="root"></div><script>${jsContent}<\/script></body></html>`
        } else {
            Object.entries(fileMap).forEach(([name, content]) => {
                if (name.endsWith('.css')) {
                    html = html.replace('</head>', `<style>${content}</style></head>`)
                }
                if (name.endsWith('.js') || name.endsWith('.jsx')) {
                    html = html.replace('</body>', `<script>${content}<\/script></body>`)
                }
            })
        }
        return html
    }

    // Hot-reload: rebuild srcdoc whenever files change
    useEffect(() => {
        const doc = previewHtml || buildSrcdoc(files)
        setSrcdoc(doc)
        setPreviewVersion(v => v + 1)
        setSandboxStatus('running')
    }, [files, previewHtml])

    // Auto-timeout: 30 minutes
    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
            setSandboxStatus('stopped')
        }, 30 * 60 * 1000) // 30 minutes
        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
    }, [files])

    const handleSend = async () => {
        if (!input.trim() || loading) return
        const instruction = input
        setMessages(prev => [...prev, { role: 'user', content: instruction }])
        setInput('')
        setLoading(true)
        setError(null)
        setSandboxStatus('building')

        try {
            const data = await sandboxEdit(sandboxId, instruction)
            const updatedFiles = data.files || files
            setFiles(updatedFiles)
            if (data.preview_html) setPreviewHtml(data.preview_html)
            const changedStr = data.changed_files?.length > 0
                ? `\n\n**Changed files:** ${data.changed_files.join(', ')}`
                : ''
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `✅ ${data.summary}${changedStr}`
            }])
            if (data.changed_files?.length > 0) setSelectedFile(data.changed_files[0])
            setSandboxStatus('running')
        } catch (e) {
            const errMsg = e?.message || 'Failed to apply changes.'
            setError(`❌ ${errMsg}`)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ **Error:** ${errMsg}\n\nPlease try again or rephrase your instruction.`
            }])
            setSandboxStatus('running')
        }
        setLoading(false)
    }

    const renderContent = (text) => {
        const parts = text.split(/(\*\*.*?\*\*|`[^`]+`|\n)/g)
        return parts.map((p, i) => {
            if (p.startsWith('**') && p.endsWith('**'))
                return <strong key={i} style={{ color: 'var(--orca-text)' }}>{p.slice(2, -2)}</strong>
            if (p.startsWith('`') && p.endsWith('`'))
                return <code key={i} style={{ background: 'var(--orca-bg)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orca-cyan)' }}>{p.slice(1, -1)}</code>
            if (p === '\n') return <br key={i} />
            return <span key={i}>{p}</span>
        })
    }

    const statusColors = { running: '#3fb950', stopped: '#f85149', building: '#e3b341' }
    const statusLabels = { running: '🟢 Running', stopped: '🔴 Stopped', building: '🟡 Building' }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 999, background: 'var(--orca-bg)',
            display: 'flex', flexDirection: 'column',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', borderBottom: '1px solid var(--orca-border)',
                background: 'var(--orca-bg-secondary)', flexShrink: 0,
            }}>
                <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: 'linear-gradient(135deg, var(--orca-green), var(--orca-cyan))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <FiTerminal size={14} color="white" />
                </div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Sandbox</span>
                <span className="badge">{owner}/{repo}</span>

                {/* Status badge */}
                <span style={{
                    fontSize: 11, padding: '2px 10px', borderRadius: 12,
                    background: `${statusColors[sandboxStatus]}18`,
                    border: `1px solid ${statusColors[sandboxStatus]}40`,
                    color: statusColors[sandboxStatus],
                }}>
                    {statusLabels[sandboxStatus]}
                </span>

                {/* Framework detection */}
                {frameworks && frameworks.name && (
                    <span className="badge badge-purple">{frameworks.name}</span>
                )}

                <span style={{ fontSize: 12, color: 'var(--orca-text-muted)' }}>
                    {Object.keys(files).length} files
                </span>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    {/* Viewport toggler */}
                    {VIEWPORTS.map(vp => (
                        <button key={vp.key} onClick={() => setActiveViewport(vp.key)}
                            style={{
                                padding: '3px 10px', fontSize: 11, borderRadius: 4,
                                border: activeViewport === vp.key ? '1px solid var(--orca-accent)' : '1px solid var(--orca-border)',
                                background: activeViewport === vp.key ? 'rgba(88,166,255,0.12)' : 'transparent',
                                color: activeViewport === vp.key ? 'var(--orca-accent)' : 'var(--orca-text-muted)',
                                cursor: 'pointer', transition: 'all 0.15s',
                            }}>
                            {vp.label}
                        </button>
                    ))}
                    <button className="btn-secondary" onClick={() => setShowPush(true)} style={{ padding: '6px 14px', fontSize: 13 }}>
                        <FiGithub size={13} /> Push to GitHub
                    </button>
                    <button className="btn-ghost" onClick={onClose}><FiX size={16} /></button>
                </div>
            </div>

            {/* Body: 3-column */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Left: file list */}
                <div style={{
                    width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column',
                    background: 'var(--orca-bg-secondary)', borderRight: '1px solid var(--orca-border)',
                }}>
                    <div style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--orca-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--orca-border)' }}>
                        Sandbox Files
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
                        {Object.keys(files).sort().map(name => (
                            <div key={name} onClick={() => setSelectedFile(name)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
                                    background: selectedFile === name ? 'rgba(88,166,255,0.1)' : 'transparent',
                                    color: selectedFile === name ? 'var(--orca-text)' : 'var(--orca-text-secondary)',
                                }}>
                                <FiFile size={12} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Center: code + inline preview */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Code view */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderBottom: '1px solid var(--orca-border)' }}>
                        <div style={{
                            padding: '6px 14px', borderBottom: '1px solid var(--orca-border)',
                            background: 'var(--orca-bg-secondary)', display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            <FiFile size={13} style={{ color: 'var(--orca-accent)' }} />
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{selectedFile || 'No file selected'}</span>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
                            <div style={{
                                padding: '12px 0', background: 'var(--orca-bg-secondary)',
                                borderRight: '1px solid var(--orca-border)', textAlign: 'right',
                                userSelect: 'none', flexShrink: 0,
                            }}>
                                {(files[selectedFile] || '').split('\n').map((_, i) => (
                                    <div key={i} style={{ padding: '0 10px', fontSize: 12, lineHeight: '20px', fontFamily: 'var(--font-mono)', color: 'var(--orca-text-muted)' }}>
                                        {i + 1}
                                    </div>
                                ))}
                            </div>
                            <pre style={{
                                flex: 1, padding: 12, margin: 0, overflow: 'auto',
                                fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: '20px',
                                color: 'var(--orca-text)', whiteSpace: 'pre',
                            }}>
                                {files[selectedFile] || '// Select a file'}
                            </pre>
                        </div>
                    </div>

                    {/* Inline Multi-Viewport Preview */}
                    <div style={{
                        height: 300, flexShrink: 0, display: 'flex', flexDirection: 'column',
                        background: '#0d1117',
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 14px', borderBottom: '1px solid var(--orca-border)',
                            background: 'var(--orca-bg-secondary)',
                        }}>
                            <FiEye size={13} style={{ color: 'var(--orca-green)' }} />
                            <span style={{ fontSize: 12, fontWeight: 600 }}>Live Preview</span>
                            <span style={{ fontSize: 10, color: 'var(--orca-text-muted)' }}>
                                {VIEWPORTS.find(v => v.key === activeViewport)?.label}
                                {' '}({VIEWPORTS.find(v => v.key === activeViewport)?.width === '100%' ? 'full' : VIEWPORTS.find(v => v.key === activeViewport)?.width + 'px'})
                            </span>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                <button onClick={() => { setSrcdoc(previewHtml || buildSrcdoc(files)); setPreviewVersion(v => v + 1) }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--orca-text-muted)', padding: 4 }}>
                                    <FiRefreshCw size={12} />
                                </button>
                                <button onClick={() => setFullscreenVp(fullscreenVp ? null : activeViewport)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--orca-text-muted)', padding: 4 }}>
                                    {fullscreenVp ? <FiMinimize2 size={12} /> : <FiMaximize2 size={12} />}
                                </button>
                            </div>
                        </div>
                        <div style={{
                            flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'stretch', overflow: 'hidden',
                            ...(fullscreenVp ? { position: 'fixed', inset: 0, zIndex: 9999, background: '#0d1117' } : {}),
                        }}>
                            {srcdoc ? (
                                <iframe
                                    key={previewVersion}
                                    srcDoc={srcdoc}
                                    title={`Preview ${activeViewport}`}
                                    style={{
                                        width: VIEWPORTS.find(v => v.key === activeViewport)?.width === '100%' ? '100%' : VIEWPORTS.find(v => v.key === activeViewport)?.width,
                                        maxWidth: '100%',
                                        height: '100%',
                                        border: 'none',
                                        background: 'white',
                                        borderRadius: 0,
                                        transition: 'width 0.3s ease',
                                    }}
                                    sandbox="allow-scripts allow-same-origin allow-forms"
                                />
                            ) : (
                                <div style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    height: '100%', color: 'var(--orca-text-muted)',
                                }}>
                                    <FiEye size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                                    <p style={{ fontSize: 12 }}>No preview available</p>
                                </div>
                            )}
                            {fullscreenVp && (
                                <button onClick={() => setFullscreenVp(null)}
                                    style={{
                                        position: 'fixed', top: 16, right: 16, zIndex: 10000,
                                        padding: '8px 16px', borderRadius: 8, fontSize: 12,
                                        background: 'rgba(0,0,0,0.8)', color: 'white', border: '1px solid rgba(255,255,255,0.2)',
                                        cursor: 'pointer',
                                    }}>
                                    ✕ Exit Fullscreen
                                </button>
                            )}
                        </div>

                        {sandboxStatus === 'stopped' && (
                            <div style={{
                                position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                                padding: '10px 20px', borderRadius: 8, fontSize: 13,
                                background: 'rgba(248,81,73,0.12)', border: '1px solid rgba(248,81,73,0.3)',
                                color: '#f85149', display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                ⏱️ Sandbox timed out —
                                <button onClick={() => setSandboxStatus('running')}
                                    style={{ background: 'rgba(248,81,73,0.2)', border: '1px solid rgba(248,81,73,0.4)', color: '#f85149', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>
                                    Restart
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: AI assistant */}
                <div style={{
                    width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column',
                    borderLeft: '1px solid var(--orca-border)',
                }}>
                    <div style={{
                        padding: '10px 14px', borderBottom: '1px solid var(--orca-border)',
                        background: 'var(--orca-bg-secondary)', display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <FiCpu size={13} style={{ color: 'var(--orca-accent)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>AI Assistant</span>
                    </div>
                    {/* Messages */}
                    <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{
                                padding: '10px 12px', borderRadius: 10,
                                background: msg.role === 'user' ? 'rgba(88,166,255,0.1)' : 'var(--orca-bg-tertiary)',
                                borderBottomRightRadius: msg.role === 'user' ? 4 : 10,
                                borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 10,
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '92%', fontSize: 13, lineHeight: 1.6,
                            }}>
                                {renderContent(msg.content)}
                            </div>
                        ))}
                        {loading && (
                            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--orca-bg-tertiary)', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="spinner" /> Applying changes...
                            </div>
                        )}
                        {error && (
                            <div style={{
                                padding: '8px 12px', borderRadius: 8, fontSize: 12,
                                background: 'rgba(240,136,62,0.1)', border: '1px solid rgba(240,136,62,0.25)',
                                color: 'var(--orca-orange)',
                            }}>
                                {error}
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>
                    {/* Input */}
                    <div style={{ padding: 10, borderTop: '1px solid var(--orca-border)', display: 'flex', gap: 6, background: 'var(--orca-bg-secondary)' }}>
                        <input className="input-field" placeholder="e.g. 'add a dark mode toggle'..."
                            value={input} onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            style={{ fontSize: 13 }} />
                        <button onClick={handleSend} className="btn-primary" style={{ padding: '8px 12px', flexShrink: 0 }}>
                            <FiSend size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {showPush && <GitHubPushModal files={files} onClose={() => setShowPush(false)} defaultName={repo} />}
        </div>
    )
}
