import { useState, useEffect, useCallback, useRef } from 'react'
import { FiX, FiPlay, FiCode, FiEdit3, FiSend, FiUploadCloud, FiLoader, FiTerminal, FiEye } from 'react-icons/fi'
import { chatWithAI, pushToGitHub, deployToGitHubPagesStream } from '../services/api'

const LANGUAGES = [
    { id: 'python', label: 'Python', icon: '🐍' },
    { id: 'javascript', label: 'JavaScript', icon: '⚡' },
    { id: 'html', label: 'HTML', icon: '🌐' },
    { id: 'bash', label: 'Bash', icon: '💻' },
]

function detectLanguage(fileName) {
    if (!fileName) return 'javascript'
    const ext = fileName.split('.').pop().toLowerCase()
    const map = {
        py: 'python', pyw: 'python',
        js: 'javascript', jsx: 'javascript', ts: 'javascript', tsx: 'javascript', mjs: 'javascript',
        html: 'html', htm: 'html', svg: 'html',
        sh: 'bash', bash: 'bash', zsh: 'bash',
    }
    return map[ext] || 'javascript'
}

let pyodideInstance = null
let pyodideLoading = false

async function loadPyodideSafe() {
    if (pyodideInstance) return pyodideInstance
    if (pyodideLoading) {
        // Wait for existing load
        while (pyodideLoading) await new Promise(r => setTimeout(r, 200))
        return pyodideInstance
    }
    pyodideLoading = true
    try {
        // Load Pyodide from CDN
        if (!window.loadPyodide) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script')
                script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js'
                script.onload = resolve
                script.onerror = reject
                document.head.appendChild(script)
            })
        }
        pyodideInstance = await window.loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
        })
        return pyodideInstance
    } catch (err) {
        throw err
    } finally {
        pyodideLoading = false
    }
}

export default function SandboxPopup({ fileName = '', code = '', onClose, onUpdateFile, repoName = '' }) {
    const [lang, setLang] = useState(detectLanguage(fileName))
    const [editCode, setEditCode] = useState(code || '')
    const [output, setOutput] = useState([])
    const [isRunning, setIsRunning] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [aiPrompt, setAiPrompt] = useState('')
    const [isAiEditing, setIsAiEditing] = useState(false)
    const [isDeploying, setIsDeploying] = useState(false)
    const [pyodideStatus, setPyodideStatus] = useState('idle') // idle | loading | ready | error
    const [deployStatus, setDeployStatus] = useState(null)
    const iframeRef = useRef(null)
    const textareaRef = useRef(null)
    const outputRef = useRef(null)
    const previewTimeoutRef = useRef(null)

    // Escape to close
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        document.body.style.overflow = 'hidden'
        return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = '' }
    }, [onClose])

    // Scroll output to bottom
    useEffect(() => {
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
    }, [output])

    // Live preview for HTML (debounced)
    useEffect(() => {
        if (lang === 'html' && showPreview && iframeRef.current) {
            if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
            previewTimeoutRef.current = setTimeout(() => {
                try {
                    iframeRef.current.srcdoc = editCode
                } catch (e) { /* ignore */ }
            }, 300)
        }
        return () => { if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current) }
    }, [editCode, lang, showPreview])

    // Auto-show preview for HTML
    useEffect(() => {
        if (lang === 'html') setShowPreview(true)
        else setShowPreview(false)
    }, [lang])

    const addOutput = useCallback((text, type = 'stdout') => {
        setOutput(prev => [...prev, { text, type, ts: Date.now() }])
    }, [])

    // ── Run Code ──────────────────────────────────────────────────────────
    const runCode = useCallback(async () => {
        setIsRunning(true)
        setOutput([])

        if (lang === 'python') {
            addOutput('⏳ Loading Python runtime (Pyodide)…', 'system')
            setPyodideStatus('loading')
            try {
                const pyodide = await loadPyodideSafe()
                setPyodideStatus('ready')
                addOutput('✅ Python runtime ready', 'system')

                // Capture stdout and stderr
                const stdout = []
                const stderr = []
                pyodide.setStdout({ batched: (text) => { stdout.push(text) } })
                pyodide.setStderr({ batched: (text) => { stderr.push(text) } })

                try {
                    const result = await pyodide.runPythonAsync(editCode)
                    // Show captured stdout
                    stdout.forEach(line => addOutput(line, 'stdout'))
                    stderr.forEach(line => addOutput(line, 'stderr'))
                    // Show return value if any (but not if it's undefined/None)
                    if (result !== undefined && result !== null && String(result) !== 'undefined') {
                        const resultStr = String(result)
                        // Filter out raw Pyodide/JS object internals
                        if (!resultStr.startsWith('[object') && !resultStr.includes('pyodide')) {
                            addOutput(resultStr, 'stdout')
                        }
                    }
                    if (stdout.length === 0 && stderr.length === 0 && (result === undefined || result === null)) {
                        addOutput('(no output)', 'system')
                    }
                } catch (pyErr) {
                    addOutput(`Error: ${pyErr.message}`, 'stderr')
                }
            } catch (loadErr) {
                setPyodideStatus('error')
                addOutput(`❌ Failed to load Python runtime: ${loadErr.message}`, 'stderr')
            }
        } else if (lang === 'javascript') {
            try {
                // Create a sandboxed execution environment
                const logs = []
                const fakeConsole = {
                    log: (...args) => logs.push({ type: 'log', text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
                    error: (...args) => logs.push({ type: 'error', text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
                    warn: (...args) => logs.push({ type: 'warn', text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
                    info: (...args) => logs.push({ type: 'info', text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
                    table: (...args) => logs.push({ type: 'log', text: JSON.stringify(args[0], null, 2) }),
                    dir: (...args) => logs.push({ type: 'log', text: JSON.stringify(args[0], null, 2) }),
                }

                // Execute with fake console
                const fn = new Function('console', editCode)
                const returnVal = fn(fakeConsole)

                logs.forEach(entry => addOutput(entry.text, entry.type === 'error' ? 'stderr' : 'stdout'))
                if (returnVal !== undefined) {
                    addOutput(`→ ${typeof returnVal === 'object' ? JSON.stringify(returnVal, null, 2) : String(returnVal)}`, 'stdout')
                }
                if (logs.length === 0 && returnVal === undefined) addOutput('(no output)', 'system')
            } catch (err) {
                addOutput(`Error: ${err.message}`, 'stderr')
            }
        } else if (lang === 'html') {
            addOutput('Rendering HTML preview…', 'system')
            setShowPreview(true)
            if (iframeRef.current) {
                iframeRef.current.srcdoc = editCode
            }
        } else if (lang === 'bash') {
            addOutput('⚠️ Bash execution is not supported directly in the browser.', 'system')
            addOutput('Tip: Copy this script and run it in your terminal, or use the AI Edit bar to convert it to JavaScript.', 'system')
        }

        setIsRunning(false)
    }, [editCode, lang, addOutput])

    // ── AI Edit ───────────────────────────────────────────────────────────
    const handleAiEdit = useCallback(async () => {
        if (!aiPrompt.trim()) return
        setIsAiEditing(true)
        try {
            const result = await chatWithAI(
                `Modify this ${lang} code according to the instruction below.\n\n` +
                `CODE:\n\`\`\`${lang}\n${editCode}\n\`\`\`\n\n` +
                `INSTRUCTION: ${aiPrompt}\n\n` +
                `Return ONLY the modified code. No explanations, no markdown fences, no backticks wrapping the response.`,
                '', []
            )
            let newCode = (result.response || '').trim()
            // Strip markdown fences if present
            const fenceMatch = newCode.match(/```[\w]*\s*\n([\s\S]*?)\n\s*```/)
            if (fenceMatch) newCode = fenceMatch[1].trim()
            else if (newCode.startsWith('```')) {
                newCode = newCode.replace(/^```[\w]*\s*\n?/, '').replace(/\n?\s*```\s*$/, '').trim()
            }

            if (newCode && newCode.length > 5) {
                setEditCode(newCode)
                addOutput(`✅ AI applied: "${aiPrompt}"`, 'system')
                setAiPrompt('')

                // Update parent state
                if (onUpdateFile && fileName) {
                    onUpdateFile(fileName, newCode)
                }
            } else {
                addOutput('⚠️ AI returned empty response', 'system')
            }
        } catch (err) {
            addOutput(`❌ AI Edit failed: ${err.message}`, 'stderr')
        } finally {
            setIsAiEditing(false)
        }
    }, [editCode, aiPrompt, lang, addOutput, onUpdateFile, fileName])

    // ── Auto Push & Deploy ────────────────────────────────────────────────
    const handleAutoDeploy = useCallback(async () => {
        setIsDeploying(true)
        setDeployStatus(null)
        try {
            const name = repoName || 'orca-sandbox'
            // Push file to GitHub first
            addOutput(`📤 Pushing ${fileName || 'sandbox.html'} to GitHub…`, 'system')
            const deployFiles = { [fileName || 'index.html']: editCode }
            // Ensure index.html exists
            if (!Object.keys(deployFiles).some(k => k.toLowerCase() === 'index.html')) {
                if (lang === 'html') {
                    deployFiles['index.html'] = editCode
                } else {
                    deployFiles['index.html'] = `<!DOCTYPE html><html><head><title>Sandbox</title></head><body><pre>${editCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`
                }
            }

            await pushToGitHub(name, deployFiles, `sandbox: update ${fileName || 'index.html'}`)
            addOutput('✅ Files pushed to GitHub', 'system')

            // Deploy to GitHub Pages
            addOutput('🚀 Deploying to GitHub Pages…', 'system')
            let liveUrl = null
            await deployToGitHubPagesStream(name, deployFiles, (event) => {
                if (event.type === 'log') addOutput(event.message, 'system')
                else if (event.type === 'live') {
                    liveUrl = event.url
                    addOutput(`✅ Live at: ${event.url}`, 'system')
                }
                else if (event.type === 'done' && event.url) liveUrl = event.url
                else if (event.type === 'error') addOutput(`❌ ${event.message}`, 'stderr')
            })

            if (liveUrl) {
                setDeployStatus({ url: liveUrl, status: 'live' })
                addOutput(`🌐 Visit: ${liveUrl}`, 'system')
            } else {
                setDeployStatus({ status: 'done' })
                addOutput('✅ Deployment initiated', 'system')
            }
        } catch (err) {
            addOutput(`❌ Deploy failed: ${err.message}`, 'stderr')
            setDeployStatus({ status: 'failed', error: err.message })
        } finally {
            setIsDeploying(false)
        }
    }, [editCode, fileName, repoName, lang, addOutput])

    const langConfig = LANGUAGES.find(l => l.id === lang)

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div style={{
                width: '94vw', maxWidth: 1200, height: '90vh',
                background: 'var(--orca-bg-secondary, #161b22)',
                border: '1px solid var(--orca-border, #333)',
                borderRadius: 16, display: 'flex', flexDirection: 'column',
                overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}>
                {/* ── Header ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', padding: '12px 20px',
                    borderBottom: '1px solid var(--orca-border, #333)',
                    background: 'rgba(0,0,0,0.2)',
                }}>
                    <FiCode size={16} style={{ color: 'var(--orca-accent, #7c6aff)', marginRight: 8 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--orca-text, #eee)' }}>
                        Sandbox
                    </span>
                    {fileName && (
                        <span style={{ fontSize: 12, color: 'var(--orca-text-muted)', marginLeft: 8, fontFamily: 'monospace' }}>
                            — {fileName}
                        </span>
                    )}

                    {/* Language selector */}
                    <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', marginRight: 12 }}>
                        {LANGUAGES.map(l => (
                            <button
                                key={l.id}
                                onClick={() => setLang(l.id)}
                                style={{
                                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                    background: lang === l.id ? 'var(--orca-accent, #7c6aff)' : 'rgba(255,255,255,0.04)',
                                    color: lang === l.id ? 'white' : 'var(--orca-text-muted)',
                                    border: `1px solid ${lang === l.id ? 'var(--orca-accent)' : 'transparent'}`,
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}
                            >
                                {l.icon} {l.label}
                            </button>
                        ))}
                    </div>

                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--orca-text-muted)', padding: 4 }}>
                        <FiX size={18} />
                    </button>
                </div>

                {/* ── Main body: Editor + Output ── */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Editor (left) */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--orca-border, #333)' }}>
                        {/* Editor toolbar */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                            borderBottom: '1px solid var(--orca-border, #333)', background: 'rgba(0,0,0,0.1)',
                        }}>
                            <button
                                onClick={runCode}
                                disabled={isRunning}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px',
                                    background: '#22c55e', border: 'none', borderRadius: 8,
                                    color: 'white', fontSize: 12, fontWeight: 700,
                                    cursor: isRunning ? 'not-allowed' : 'pointer',
                                    opacity: isRunning ? 0.7 : 1, transition: 'all 0.15s',
                                }}
                            >
                                {isRunning ? <FiLoader size={13} className="spinner" /> : <FiPlay size={13} />}
                                {isRunning ? 'Running…' : 'Run'}
                            </button>

                            {lang === 'html' && (
                                <button
                                    onClick={() => setShowPreview(!showPreview)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px',
                                        background: showPreview ? 'rgba(124,106,255,0.15)' : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${showPreview ? 'var(--orca-accent)' : 'var(--orca-border,#333)'}`,
                                        borderRadius: 8, color: showPreview ? 'var(--orca-accent)' : 'var(--orca-text-muted)',
                                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                    }}
                                >
                                    <FiEye size={12} /> Preview
                                </button>
                            )}

                            <button
                                onClick={handleAutoDeploy}
                                disabled={isDeploying}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px',
                                    background: 'rgba(124,106,255,0.08)', border: '1px solid rgba(124,106,255,0.3)',
                                    borderRadius: 8, color: 'var(--orca-accent, #7c6aff)',
                                    fontSize: 11, fontWeight: 700, cursor: isDeploying ? 'not-allowed' : 'pointer',
                                    marginLeft: 'auto', transition: 'all 0.15s',
                                }}
                            >
                                {isDeploying ? <FiLoader size={12} className="spinner" /> : <FiUploadCloud size={12} />}
                                {isDeploying ? 'Deploying…' : 'Auto Push & Deploy'}
                            </button>
                        </div>

                        {/* Code textarea */}
                        <textarea
                            ref={textareaRef}
                            value={editCode}
                            onChange={e => setEditCode(e.target.value)}
                            spellCheck={false}
                            style={{
                                flex: 1, resize: 'none', padding: '14px 16px',
                                fontFamily: '"Fira Code", "JetBrains Mono", "Cascadia Code", "SF Mono", monospace',
                                fontSize: 13, lineHeight: 1.6, tabSize: 4,
                                background: 'var(--orca-bg, #0d1117)', color: 'var(--orca-text, #e6edf3)',
                                border: 'none', outline: 'none',
                            }}
                            onKeyDown={(e) => {
                                // Tab key handling
                                if (e.key === 'Tab') {
                                    e.preventDefault()
                                    const start = e.target.selectionStart
                                    const end = e.target.selectionEnd
                                    const newVal = editCode.substring(0, start) + '    ' + editCode.substring(end)
                                    setEditCode(newVal)
                                    setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = start + 4 }, 0)
                                }
                                // Ctrl+Enter to run
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault()
                                    runCode()
                                }
                            }}
                        />

                        {/* AI Edit bar */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                            borderTop: '1px solid var(--orca-border, #333)', background: 'rgba(0,0,0,0.1)',
                        }}>
                            <FiEdit3 size={13} style={{ color: 'var(--orca-accent, #7c6aff)', flexShrink: 0 }} />
                            <input
                                value={aiPrompt}
                                onChange={e => setAiPrompt(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiEdit() } }}
                                placeholder="Ask AI to edit this code…"
                                style={{
                                    flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 12,
                                    background: 'var(--orca-bg, #0d1117)', border: '1px solid var(--orca-border, #333)',
                                    color: 'var(--orca-text, #eee)', outline: 'none',
                                }}
                            />
                            <button
                                onClick={handleAiEdit}
                                disabled={isAiEditing || !aiPrompt.trim()}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px',
                                    background: isAiEditing ? 'rgba(124,106,255,0.08)' : 'var(--orca-accent, #7c6aff)',
                                    border: 'none', borderRadius: 6, color: 'white',
                                    fontSize: 11, fontWeight: 600, cursor: isAiEditing ? 'not-allowed' : 'pointer',
                                    opacity: isAiEditing || !aiPrompt.trim() ? 0.6 : 1,
                                }}
                            >
                                {isAiEditing ? <FiLoader size={12} className="spinner" /> : <FiSend size={12} />}
                                {isAiEditing ? 'Editing…' : 'Apply'}
                            </button>
                        </div>
                    </div>

                    {/* Output / Preview (right) */}
                    <div style={{
                        width: showPreview ? '50%' : '40%', minWidth: 280,
                        display: 'flex', flexDirection: 'column',
                        background: 'rgba(0,0,0,0.15)',
                    }}>
                        {/* Output Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                            borderBottom: '1px solid var(--orca-border, #333)',
                            fontSize: 12, fontWeight: 700, color: 'var(--orca-text-secondary, #aaa)',
                        }}>
                            {showPreview ? (
                                <><FiEye size={13} /> Live Preview</>
                            ) : (
                                <><FiTerminal size={13} /> Output</>
                            )}
                            {pyodideStatus === 'loading' && (
                                <span style={{ marginLeft: 'auto', color: '#f59e0b', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <FiLoader size={11} className="spinner" /> Loading Python…
                                </span>
                            )}
                        </div>

                        {/* Preview iframe OR output terminal */}
                        {showPreview && lang === 'html' ? (
                            <iframe
                                ref={iframeRef}
                                sandbox="allow-scripts allow-same-origin"
                                style={{
                                    flex: 1, border: 'none', background: 'white', borderRadius: 0,
                                }}
                                srcDoc={editCode}
                            />
                        ) : (
                            <div ref={outputRef} style={{
                                flex: 1, overflow: 'auto', padding: '12px 14px',
                                fontFamily: '"Fira Code", monospace', fontSize: 12, lineHeight: 1.7,
                            }}>
                                {output.length === 0 ? (
                                    <div style={{ color: 'var(--orca-text-muted)', textAlign: 'center', padding: 40 }}>
                                        <FiPlay size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                                        <p>Click <b>Run</b> or press <b>Ctrl+Enter</b> to execute</p>
                                    </div>
                                ) : (
                                    output.map((entry, i) => (
                                        <div key={i} style={{
                                            color: entry.type === 'stderr' ? '#ef4444'
                                                : entry.type === 'system' ? '#7c6aff'
                                                : '#e6edf3',
                                            padding: '1px 0',
                                            wordBreak: 'break-word',
                                            whiteSpace: 'pre-wrap',
                                        }}>
                                            {entry.text}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Deploy status */}
                        {deployStatus && deployStatus.url && (
                            <div style={{
                                padding: '8px 14px', borderTop: '1px solid var(--orca-border, #333)',
                                background: 'rgba(34,197,94,0.06)', fontSize: 12,
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <span style={{ color: '#22c55e', fontWeight: 600 }}>🟢 Live:</span>
                                <a href={deployStatus.url} target="_blank" rel="noopener noreferrer"
                                    style={{ color: 'var(--orca-accent)', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                                    {deployStatus.url}
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
