import { useEffect, useRef, useState } from 'react'
import { FiCpu, FiAlertTriangle, FiZap } from 'react-icons/fi'

export default function CodeViewer({ code, filename, onExplain, onImprove, onCodeReview, loading }) {
    const codeRef = useRef(null)
    const [lineCount, setLineCount] = useState(0)

    useEffect(() => {
        if (code) setLineCount(code.split('\n').length)
    }, [code])

    if (!code) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: 'var(--orca-text-muted)', gap: 12,
            }}>
                <FiCpu size={40} style={{ opacity: 0.3 }} />
                <p style={{ fontSize: 14 }}>Select a file to view code</p>
            </div>
        )
    }

    const getLanguage = (name) => {
        const ext = name?.split('.').pop() || ''
        const langMap = {
            js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
            py: 'python', css: 'css', html: 'html', json: 'json', md: 'markdown',
            yml: 'yaml', yaml: 'yaml', sh: 'bash', java: 'java', go: 'go',
            rs: 'rust', rb: 'ruby', php: 'php', swift: 'swift', kt: 'kotlin',
        }
        return langMap[ext] || 'text'
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* File header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 16px', borderBottom: '1px solid var(--orca-border)',
                background: 'var(--orca-bg-secondary)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{filename}</span>
                    <span className="badge">{getLanguage(filename)}</span>
                    <span style={{ fontSize: 12, color: 'var(--orca-text-muted)' }}>{lineCount} lines</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" onClick={() => onCodeReview?.(code, filename)} disabled={loading}
                        style={{ color: 'var(--orca-accent)' }}>
                        <FiCpu size={13} /> Explain
                    </button>
                    <button className="btn-ghost" onClick={() => onCodeReview?.(code, filename)} disabled={loading}
                        style={{ color: 'var(--orca-orange)' }}>
                        <FiAlertTriangle size={13} /> Find Issues
                    </button>
                    <button className="btn-ghost" onClick={() => onCodeReview?.(code, filename)} disabled={loading}
                        style={{ color: 'var(--orca-green)' }}>
                        <FiZap size={13} /> Improve
                    </button>
                </div>
            </div>

            {/* Code display */}
            <div ref={codeRef} style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
                {/* Line numbers */}
                <div style={{
                    padding: '12px 0', background: 'var(--orca-bg-secondary)',
                    borderRight: '1px solid var(--orca-border)', textAlign: 'right',
                    userSelect: 'none', flexShrink: 0,
                }}>
                    {code.split('\n').map((_, i) => (
                        <div key={i} style={{
                            padding: '0 12px', fontSize: 13, lineHeight: '20px',
                            fontFamily: 'var(--font-mono)', color: 'var(--orca-text-muted)',
                        }}>
                            {i + 1}
                        </div>
                    ))}
                </div>
                {/* Code content */}
                <pre style={{
                    flex: 1, padding: 12, margin: 0, overflow: 'auto',
                    fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: '20px',
                    color: 'var(--orca-text)', background: 'var(--orca-bg)',
                    whiteSpace: 'pre',
                }}>
                    {code}
                </pre>
            </div>
        </div>
    )
}
