import { useState, useRef, useEffect } from 'react'
import { FiCpu, FiX, FiSend, FiCheck, FiAlertCircle, FiRefreshCw, FiChevronDown, FiChevronRight, FiFile, FiCopy, FiFolder } from 'react-icons/fi'
import { runAgentStream } from '../services/api'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'

function AgentCodeBlock({ children, className }) {
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
                padding: '4px 10px', background: '#161b22',
                borderRadius: '8px 8px 0 0', border: '1px solid #30363d', borderBottom: 'none',
            }}>
                <span style={{ fontSize: 10, color: '#6e7681', fontFamily: 'var(--font-mono)' }}>{lang || 'code'}</span>
                <button onClick={handleCopy} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: copied ? '#3fb950' : '#6e7681',
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 6px',
                    borderRadius: 4, transition: 'all 0.15s',
                }}>
                    <FiCopy size={11} /> {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre style={{
                margin: 0, padding: 12, overflow: 'auto',
                background: '#0d1117', borderRadius: '0 0 8px 8px',
                border: '1px solid #30363d', borderTop: 'none',
                fontSize: 12, lineHeight: '18px',
            }}>
                <code className={className}>{children}</code>
            </pre>
        </div>
    )
}

const mdComponents = {
    code({ node, inline, className, children, ...props }) {
        if (inline) return <code style={{ background: '#1c2128', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#39d2c0' }} {...props}>{children}</code>
        return <AgentCodeBlock className={className}>{children}</AgentCodeBlock>
    }
}

/**
 * CodingAgentPanel
 *
 * Props:
 *   projectRoot {string}   — REQUIRED: absolute path to the open project directory
 *   onClose     {function} — called when panel is closed
 *   onApply     {function} — optional: called with list of written file paths
 */
export default function CodingAgentPanel({ projectRoot, onClose, onApply }) {
    const [instruction, setInstruction] = useState('')
    const [streaming, setStreaming] = useState(false)
    const [chunks, setChunks] = useState([])
    const [error, setError] = useState('')
    const [agentLabel, setAgentLabel] = useState('')
    const outputRef = useRef(null)

    useEffect(() => {
        outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' })
    }, [chunks])

    const runAgent = async () => {
        if (!instruction.trim() || streaming) return

        // ── Guard: project_root MUST be set ────────────────────────────────
        if (!projectRoot || !projectRoot.trim()) {
            setError('No project folder is open. Please open a project first (File → Open Folder).')
            return
        }

        setStreaming(true)
        setChunks([])
        setError('')
        setAgentLabel('')

        try {
            const resp = await runAgentStream(projectRoot, instruction)

            if (!resp.ok) {
                let msg = `Agent request failed (HTTP ${resp.status})`
                try { const err = await resp.json(); msg = err.detail || msg } catch { }
                setError(msg)
                setStreaming(false)
                return
            }

            const reader = resp.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    try {
                        const data = JSON.parse(line.slice(6))
                        const { type, content, agent, files } = data

                        if (type === 'thinking' || type === 'repo_scan' || type === 'dep_map') {
                            setChunks(prev => [...prev, { type, content }])

                        } else if (type === 'agent_selected') {
                            setAgentLabel(agent || '')
                            setChunks(prev => [...prev, { type: 'thinking', content: `🤖 ${agent} activated` }])

                        } else if (type === 'stream') {
                            // Accumulate streaming tokens
                            setChunks(prev => {
                                const last = prev[prev.length - 1]
                                if (last && last.type === 'stream') {
                                    return [...prev.slice(0, -1), { type: 'stream', content: last.content + content }]
                                }
                                return [...prev, { type: 'stream', content }]
                            })

                        } else if (type === 'code') {
                            // Replace streaming placeholder with final markdown
                            setChunks(prev => [
                                ...prev.filter(c => c.type !== 'stream'),
                                { type: 'code', content }
                            ])

                        } else if (type === 'files_written') {
                            setChunks(prev => [...prev, { type: 'files_written', content, files }])
                            if (onApply && files) onApply(files)

                        } else if (type === 'error') {
                            setError(content)

                        } else if (type === 'done') {
                            setChunks(prev => [...prev, { type: 'done', content }])
                        }
                    } catch { }
                }
            }
        } catch (e) {
            setError(e.message || 'Connection failed')
        }
        setStreaming(false)
    }

    const hasProject = Boolean(projectRoot && projectRoot.trim())

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            display: 'flex', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }}>
            <div style={{ flex: 1 }} onClick={onClose} />
            <div className="animate-slideInRight" style={{
                width: 680, display: 'flex', flexDirection: 'column',
                background: '#0d1117', borderLeft: '1px solid #30363d',
                height: '100vh', minHeight: 0,
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 18px', borderBottom: '1px solid #30363d',
                    background: '#161b22',
                }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: 'linear-gradient(135deg, #f0883e, #bc8cff)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <FiCpu size={14} color="white" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3' }}>
                            ORCA Agent{agentLabel ? ` · ${agentLabel}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: '#6e7681', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                            <FiFolder size={10} style={{ flexShrink: 0 }} />
                            {hasProject
                                ? <span style={{ color: '#58a6ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectRoot}</span>
                                : <span style={{ color: '#f85149' }}>No project open</span>}
                        </div>
                    </div>
                    {streaming && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#f0883e', flexShrink: 0 }}>
                            <FiRefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                            Running…
                        </div>
                    )}
                    <button className="btn-ghost" onClick={onClose} style={{ padding: 6, flexShrink: 0 }}>
                        <FiX size={16} />
                    </button>
                </div>

                {/* No project warning */}
                {!hasProject && (
                    <div style={{
                        margin: '12px 16px', padding: '10px 14px', borderRadius: 8,
                        background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)',
                        color: '#f85149', fontSize: 12,
                        display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <FiAlertCircle size={14} />
                        Open a project folder so the agent can read your files.
                    </div>
                )}

                {/* Output */}
                <div ref={outputRef} style={{
                    flex: 1, overflow: 'auto', padding: '20px 24px',
                    fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7, color: '#e6edf3',
                    minHeight: 0,
                }}>
                    {chunks.length === 0 && !streaming && (
                        <div style={{ textAlign: 'center', padding: 40, color: '#6e7681' }}>
                            <FiCpu size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
                            <p style={{ fontSize: 13, marginBottom: 6 }}>Reads your full codebase → routes to the right agent → writes to disk.</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 12 }}>
                                {['CodeWriter', 'DebugAgent', 'ExplainAgent', 'SecurityAgent', 'FileReader'].map(t => (
                                    <span key={t} className="badge" style={{ fontSize: 10 }}>{t}</span>
                                ))}
                            </div>
                            <p style={{ fontSize: 11, marginTop: 14 }}>
                                Try: "Fix the login bug" · "Explain this codebase" · "Scan for vulnerabilities"
                            </p>
                        </div>
                    )}

                    {/* Status chips */}
                    {chunks.filter(c => ['thinking', 'repo_scan', 'dep_map'].includes(c.type)).map((c, i) => (
                        <div key={`s-${i}`} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '4px 10px', marginBottom: 3, borderRadius: 6, fontSize: 11,
                            fontFamily: 'var(--font-sans)',
                            background: c.type === 'repo_scan' ? 'rgba(63,185,80,0.08)' : c.type === 'dep_map' ? 'rgba(240,136,62,0.08)' : 'rgba(188,140,255,0.06)',
                            color: c.type === 'repo_scan' ? '#3fb950' : c.type === 'dep_map' ? '#f0883e' : '#bc8cff',
                        }}>
                            <FiCpu size={10} /> {c.content}
                        </div>
                    ))}

                    {/* Streaming live text */}
                    {chunks.filter(c => c.type === 'stream').map((c, i) => (
                        <div key={`st-${i}`} style={{
                            padding: '12px 16px', fontSize: 12, lineHeight: 1.8,
                            background: '#0d1117', borderRadius: 8, border: '1px solid #30363d',
                            marginBottom: 8, color: '#e6edf3', whiteSpace: 'pre-wrap',
                            fontFamily: 'var(--font-mono)',
                        }}>
                            {c.content}
                            <span style={{
                                display: 'inline-block', width: 2, height: 14,
                                background: '#f0883e', marginLeft: 2, verticalAlign: 'middle',
                                animation: 'blink 1s step-end infinite',
                            }} />
                        </div>
                    ))}

                    {/* Final markdown */}
                    {chunks.filter(c => c.type === 'code').map((c, i) => (
                        <div key={`cd-${i}`} className="markdown-content copilot-response" style={{ marginBottom: 8 }}>
                            <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={mdComponents}>
                                {c.content}
                            </ReactMarkdown>
                        </div>
                    ))}

                    {/* Files written badge */}
                    {chunks.filter(c => c.type === 'files_written').map((c, i) => (
                        <div key={`fw-${i}`} style={{
                            padding: '8px 12px', marginBottom: 8, borderRadius: 6,
                            background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.25)',
                            color: '#3fb950', fontSize: 12, fontFamily: 'var(--font-sans)',
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            <FiCheck size={14} /> {c.content}
                        </div>
                    ))}

                    {/* Done */}
                    {chunks.filter(c => c.type === 'done').map((c, i) => (
                        <div key={`dn-${i}`} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 12px', marginTop: 12, borderRadius: 6,
                            background: 'rgba(63,185,80,0.1)', color: '#3fb950',
                            fontSize: 12, fontFamily: 'var(--font-sans)',
                        }}>
                            <FiCheck size={14} /> {c.content}
                        </div>
                    ))}

                    {error && (
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: 12,
                            padding: '14px 16px', marginTop: 12, borderRadius: 8,
                            background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#f85149', fontSize: 13, lineHeight: 1.5 }}>
                                <FiAlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                                <div style={{ whiteSpace: 'pre-wrap' }}>{error}</div>
                            </div>
                            <button
                                onClick={runAgent}
                                disabled={streaming || !instruction.trim()}
                                style={{
                                    alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '6px 12px', background: '#21262d', border: '1px solid #30363d',
                                    borderRadius: 6, color: '#c9d1d9', fontSize: 12, fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#30363d'}
                                onMouseLeave={e => e.currentTarget.style.background = '#21262d'}
                            >
                                <FiRefreshCw size={12} /> Retry Pipeline
                            </button>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div style={{ padding: 14, borderTop: '1px solid #30363d', background: '#161b22' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input className="input-field"
                            placeholder={hasProject
                                ? 'Describe what you want… fix bug · explain code · security scan'
                                : 'Open a project folder first…'}
                            value={instruction}
                            onChange={e => setInstruction(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && runAgent()}
                            disabled={streaming || !hasProject}
                            style={{ fontSize: 13 }} />
                        <button className="btn-primary" onClick={runAgent}
                            disabled={streaming || !instruction.trim() || !hasProject}
                            style={{ padding: '8px 16px', flexShrink: 0 }}>
                            {streaming
                                ? <div className="spinner" style={{ width: 14, height: 14 }} />
                                : <FiSend size={14} />}
                        </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--orca-text-muted)', marginTop: 6 }}>
                        Gemini 1.5-flash → OpenRouter DeepSeek R1 → Groq Llama 3.3 70B
                    </div>
                </div>
            </div>
        </div>
    )
}
