import { useState, useEffect, useRef } from 'react'
import { FiX, FiTerminal, FiLoader, FiCheck, FiMaximize2, FiMinimize2, FiAlertTriangle, FiDownload } from 'react-icons/fi'
import { exportTestReportPDF } from '../services/api'

/**
 * TerminalModal — Reusable modal for showing terminal output.
 *
 * Supports two modes:
 * 1. Static mode: pass `content` string directly
 * 2. Live SSE mode: pass `lines` array that grows over time
 *
 * Props:
 *   title        {string}   Modal title
 *   content      {string}   Static terminal output
 *   lines        {Array}    Array of {text, type} for live streaming
 *   loading      {boolean}  Whether the terminal process is still running
 *   loadingText  {string}   Text to show while loading
 *   error        {string}   Error message
 *   autoDebug    {string}   Auto-debug status message
 *   onClose      {Function} Callback to close the modal
 *   testResults  {Object}   Test results data for PDF export
 *   testMeta     {Object}   {owner, repo, test_code, full_output} for PDF
 */
export default function TerminalModal({ title, content, lines, loading, loadingText, error, autoDebug, onClose, testResults, testMeta }) {
    const [fullscreen, setFullscreen] = useState(false)
    const [exporting, setExporting] = useState(false)
    const bottomRef = useRef(null)

    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    // Auto-scroll to bottom when new lines appear
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [lines, content])

    const handleExportPDF = async () => {
        if (!testResults && !testMeta) return
        setExporting(true)
        try {
            await exportTestReportPDF({
                owner: testMeta?.owner || '',
                repo: testMeta?.repo || '',
                test_results: testResults || {},
                test_code: testMeta?.test_code || '',
                full_output: testMeta?.full_output || '',
            })
        } catch {
            /* PDF export failed */
        } finally {
            setExporting(false)
        }
    }

    const colorize = (line) => {
        if (!line) return { color: 'inherit', text: line || '' }

        // PASSED / success
        if (line.includes('PASSED') || /\bpassed\b/i.test(line) || /\bOK\b/.test(line) || line.includes('✅'))
            return { color: '#3fb950', text: line }
        // FAILED / ERROR
        if (line.includes('FAILED') || line.includes('ERROR') || line.includes('error') || /\bfailed\b/i.test(line) || line.includes('❌'))
            return { color: '#ff7b72', text: line }
        // WARNING
        if (line.includes('WARNING') || line.includes('warning') || line.includes('⚠'))
            return { color: '#e3b341', text: line }
        // Section dividers
        if (line.startsWith('=') || line.startsWith('─') || line.startsWith('═'))
            return { color: '#79c0ff', text: line }
        // Auto-debug
        if (line.includes('AUTO-DEBUG') || line.includes('🔄'))
            return { color: '#d2a8ff', text: line }
        // Collecting / plugin info
        if (line.startsWith('collecting') || line.startsWith('collected'))
            return { color: '#8b949e', text: line }

        return { color: '#e6edf3', text: line }
    }

    const overlayStyle = fullscreen
        ? { position: 'fixed', inset: 0, zIndex: 10000 }
        : {
            position: 'fixed',
            top: 40, left: '50%', transform: 'translateX(-50%)',
            width: 'min(900px, 94vw)',
            height: 'calc(100vh - 60px)',
            zIndex: 1200,
        }

    // Combine content lines + live lines
    const allLines = []
    if (content) {
        content.split('\n').forEach(l => allLines.push(l))
    }
    if (lines) {
        lines.forEach(l => allLines.push(typeof l === 'string' ? l : l.text || l.line || ''))
    }

    const isFinished = !loading && allLines.length > 0
    const hasFailed = allLines.some(l => l.includes('FAILED'))

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
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: fullscreen ? 0 : 10,
                boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
                overflow: 'hidden',
            }}>
                {/* Mac-style Window Header */}
                <div style={{
                    display: 'flex', alignItems: 'center',
                    padding: '12px 16px', flexShrink: 0,
                    background: '#161b22',
                    borderBottom: '1px solid #30363d',
                }}>
                    <div style={{ display: 'flex', gap: 6, marginRight: 16 }}>
                        <div onClick={onClose} style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56', cursor: 'pointer' }} />
                        <div onClick={() => setFullscreen(f => !f)} style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e', cursor: 'pointer' }} />
                        <div onClick={() => setFullscreen(f => !f)} style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f', cursor: 'pointer' }} />
                    </div>

                    <FiTerminal size={14} color="#8b949e" style={{ marginRight: 8 }} />
                    <span style={{ fontSize: 13, flex: 1, color: '#c9d1d9', fontFamily: 'var(--font-mono)' }}>{title}</span>

                    {/* Status indicator */}
                    {loading && (
                        <span style={{ fontSize: 11, color: '#3fb950', display: 'flex', alignItems: 'center', gap: 5, marginRight: 8 }}>
                            <FiLoader size={11} className="spinner" /> Running
                        </span>
                    )}
                    {autoDebug && (
                        <span style={{ fontSize: 11, color: '#d2a8ff', display: 'flex', alignItems: 'center', gap: 5, marginRight: 8 }}>
                            <FiAlertTriangle size={11} /> {autoDebug}
                        </span>
                    )}

                    {/* PDF Export Button — shown when test is finished */}
                    {isFinished && (testResults || testMeta) && (
                        <button onClick={handleExportPDF} disabled={exporting}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                background: 'rgba(88,166,255,0.12)', border: '1px solid rgba(88,166,255,0.3)',
                                color: '#58a6ff', borderRadius: 6, padding: '4px 12px',
                                fontSize: 11, cursor: exporting ? 'wait' : 'pointer',
                                marginRight: 8, transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(88,166,255,0.2)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(88,166,255,0.12)' }}>
                            {exporting ? <FiLoader size={11} className="spinner" /> : <FiDownload size={11} />}
                            {exporting ? 'Generating...' : 'Export PDF Report'}
                        </button>
                    )}

                    {/* Window Controls */}
                    <button onClick={() => setFullscreen(f => !f)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', padding: '4px 8px', borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                        {fullscreen ? <FiMinimize2 size={13} /> : <FiMaximize2 size={13} />}
                    </button>
                    <button onClick={onClose}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#8b949e', padding: '4px 8px', borderRadius: 4,
                            display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ff4444'}
                        onMouseLeave={e => e.currentTarget.style.color = '#8b949e'}
                        title="Close (Esc)">
                        <FiX size={16} />
                    </button>
                </div>

                {/* Body (Terminal style) */}
                <div style={{
                    flex: 1, overflow: 'auto', padding: '20px',
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                    lineHeight: '1.6', color: '#e6edf3',
                }}>
                    {loading && allLines.length === 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#3fb950' }}>
                            <FiLoader size={16} className="spinner" />
                            <span>{loadingText || 'Running tests...'}</span>
                        </div>
                    )}

                    {error && (
                        <div style={{ color: '#ff7b72', marginBottom: 16 }}>
                            [ERROR] {error}
                        </div>
                    )}

                    {allLines.length > 0 && (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {allLines.map((line, i) => {
                                const { color, text } = colorize(line)
                                return <div key={i} style={{ color, minHeight: 18 }}>{text}</div>
                            })}
                        </pre>
                    )}

                    {isFinished && (
                        <div style={{ marginTop: 24, color: hasFailed ? '#ff7b72' : '#3fb950', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FiCheck size={14} /> Process finished with exit code {hasFailed ? '1' : '0'}
                        </div>
                    )}

                    <div ref={bottomRef} />
                </div>
            </div>
        </>
    )
}
