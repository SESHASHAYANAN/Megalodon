import { useState, useEffect, useCallback, useRef } from 'react'
import { FiX, FiCheckCircle, FiAlertCircle, FiLoader, FiRotateCcw } from 'react-icons/fi'
import { chatWithAI, writeSourceFile, backupSourceFile, revertSourceFile } from '../../services/api'

/**
 * Strip markdown fences from AI response.
 */
function extractCode(response) {
    if (!response) return ''
    const text = response.trim()
    const fenceMatch = text.match(/```[\w]*\s*\n([\s\S]*?)\n\s*```/)
    if (fenceMatch) return fenceMatch[1].trim()
    if (text.startsWith('```')) {
        return text.replace(/^```[\w]*\s*\n?/, '').replace(/\n?\s*```\s*$/, '').trim()
    }
    return text
}

const CATEGORY_CONFIG = {
    'accessibility': { icon: '♿', label: 'Accessibility', color: '#3b82f6' },
    'error-handling': { icon: '⚠️', label: 'Error Handling', color: '#f59e0b' },
    'code-quality': { icon: '🧹', label: 'Code Quality', color: '#8b5cf6' },
    'performance': { icon: '⚡', label: 'Performance', color: '#06b6d4' },
    'production-readiness': { icon: '🚀', label: 'Production Readiness', color: '#ef4444' },
}

export default function CompliancePopup({ files = {}, onUpdateFile, onClose }) {
    const [issues, setIssues] = useState([])
    const [isScanning, setIsScanning] = useState(true)
    const [isFixingAll, setIsFixingAll] = useState(false)
    const [fixProgress, setFixProgress] = useState({ current: 0, total: 0 })
    const [fixingIds, setFixingIds] = useState(new Set())
    const [targetScore, setTargetScore] = useState(0)
    const [animatedScore, setAnimatedScore] = useState(0)
    const [fixLog, setFixLog] = useState([])

    const filesRef = useRef(files)
    useEffect(() => { filesRef.current = files }, [files])

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        document.body.style.overflow = 'hidden'
        return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = '' }
    }, [onClose])

    // Animate score
    useEffect(() => {
        if (animatedScore < targetScore) {
            const t = setTimeout(() => setAnimatedScore(s => Math.min(s + 1, targetScore)), 20)
            return () => clearTimeout(t)
        } else if (animatedScore > targetScore) {
            const t = setTimeout(() => setAnimatedScore(s => Math.max(s - 1, targetScore)), 20)
            return () => clearTimeout(t)
        }
    }, [animatedScore, targetScore])

    useEffect(() => { scanCompliance() }, [])

    // Auto-refresh when SecurityPopup dispatches 'security-fixes-applied'
    useEffect(() => {
        const handler = () => {
            setIssues([])
            setTargetScore(0)
            setAnimatedScore(0)
            setFixLog([])
            // Small delay to allow file updates to propagate
            setTimeout(() => scanCompliance(), 1000)
        }
        window.addEventListener('security-fixes-applied', handler)
        return () => window.removeEventListener('security-fixes-applied', handler)
    }, [])

    const calculateScore = (issueList) => {
        const total = issueList.length
        const fixed = issueList.filter(i => i.fixed).length
        if (total === 0) return 100
        return Math.round((fixed / total) * 100)
    }

    const addLog = useCallback((msg) => {
        setFixLog(prev => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${msg}`])
    }, [])

    const scanCompliance = useCallback(async () => {
        setIsScanning(true)
        const fileEntries = Object.entries(filesRef.current).slice(0, 12)
        if (fileEntries.length === 0) {
            setIssues([])
            setTargetScore(100)
            setIsScanning(false)
            return
        }

        const fileContext = fileEntries.map(([name, content]) => {
            const lines = typeof content === 'string' ? content.split('\n') : []
            const numbered = lines.slice(0, 120).map((line, i) => `${i + 1}: ${line}`).join('\n')
            return `### FILE: ${name}\n\`\`\`\n${numbered}\n\`\`\``
        }).join('\n\n')

        try {
            const result = await chatWithAI(
                `You are a code compliance auditor. Scan for:\n` +
                `- Missing error boundaries in React components\n- Unhandled promise rejections (.then without .catch)\n` +
                `- console.log statements in production code\n- Missing loading/error states on async calls\n` +
                `- Missing alt attributes on <img> tags\n- Missing aria-label on interactive elements\n` +
                `- Missing environment variable validation\n- Hardcoded localhost URLs\n` +
                `- Unused imports or variables\n- Missing TypeScript types\n\n` +
                `For EACH issue, specify the EXACT file name and line number.\n\n` +
                `Return ONLY a valid JSON array (no markdown fences, no explanations):\n` +
                `[{"id":"1","category":"code-quality","title":"Issue Title","description":"Description","file":"filename","line":42,"autoFixable":true,"fix":"Fix suggestion"}]\n\n` +
                `category must be one of: "code-quality", "accessibility", "error-handling", "production-readiness", "performance"\n` +
                `If no issues found, return: []\n\n` +
                `Files:\n${fileContext}`,
                '', []
            )
            const text = (result.response || '').trim()
            let parsed = []
            try {
                const jsonMatch = text.match(/\[[\s\S]*\]/)
                if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
            } catch {
                try {
                    const stripped = extractCode(text)
                    const jsonMatch2 = stripped.match(/\[[\s\S]*\]/)
                    if (jsonMatch2) parsed = JSON.parse(jsonMatch2[0])
                } catch { /* give up */ }
            }

            const issueList = Array.isArray(parsed)
                ? parsed.map((f, i) => ({
                    ...f,
                    id: f.id || String(i + 1),
                    category: CATEGORY_CONFIG[f.category] ? f.category : 'code-quality',
                    file: f.file || '',
                    line: parseInt(f.line) || null,
                    fixed: false,
                }))
                : []

            setIssues(issueList)
            setTargetScore(calculateScore(issueList))
        } catch {
            /* compliance scan failed */
        } finally {
            setIsScanning(false)
        }
    }, [])

    const handleAutoFix = useCallback(async (issue) => {
        const currentFiles = filesRef.current
        if (!issue.file || !currentFiles[issue.file]) {
            addLog(`⚠️ Cannot fix "${issue.title}": file "${issue.file}" not found`)
            return false
        }

        const fileContent = currentFiles[issue.file]
        setFixingIds(prev => new Set([...prev, issue.id]))
        addLog(`🔧 Fixing: ${issue.title} in ${issue.file}:${issue.line || '?'}`)

        try {
            // Backup first
            try {
                await backupSourceFile(issue.file)
                addLog(`💾 Backup created for ${issue.file}`)
            } catch { addLog(`⚠️ Backup skipped`) }

            // Generate fix
            const fileLines = fileContent.split('\n')
            const contextStart = Math.max(0, (issue.line || 1) - 5)
            const contextEnd = Math.min(fileLines.length, (issue.line || 1) + 10)
            const contextSnippet = fileLines.slice(contextStart, contextEnd)
                .map((line, i) => `${contextStart + i + 1}: ${line}`).join('\n')

            const result = await chatWithAI(
                `Apply a MINIMAL fix for this compliance issue.\n\n` +
                `FILE: "${issue.file}"\nLINE: ${issue.line || 'unknown'}\n` +
                `ISSUE: ${issue.title}\nDESCRIPTION: ${issue.description}\n` +
                `FIX APPROACH: ${issue.fix}\n\n` +
                `Context:\n\`\`\`\n${contextSnippet}\n\`\`\`\n\n` +
                `Full file:\n\`\`\`\n${fileContent.substring(0, 6000)}\n\`\`\`\n\n` +
                `Return ONLY the complete fixed file content. No explanations, no markdown fences.`,
                '', []
            )

            let fixedContent = extractCode(result.response || '')
            if (!fixedContent || fixedContent.length < 10) {
                addLog(`❌ AI returned empty patch for "${issue.title}"`)
                setFixingIds(prev => { const n = new Set(prev); n.delete(issue.id); return n })
                return false
            }

            // Apply fix to React state
            if (onUpdateFile) {
                onUpdateFile(issue.file, fixedContent)
            }

            // Persist to disk
            try {
                await writeSourceFile(issue.file, fixedContent)
                addLog(`✅ Written to disk: ${issue.file}`)
            } catch (writeErr) {
                addLog(`⚠️ Disk write skipped: ${writeErr.message}`)
            }

            // Mark as fixed
            setIssues(prev => {
                const updated = prev.map(i => i.id === issue.id ? { ...i, fixed: true } : i)
                setTargetScore(calculateScore(updated))
                return updated
            })
            addLog(`✅ Fixed: ${issue.title}`)
            setFixingIds(prev => { const n = new Set(prev); n.delete(issue.id); return n })
            return true
        } catch (err) {
            addLog(`❌ Fix failed: ${err.message}`)
            setFixingIds(prev => { const n = new Set(prev); n.delete(issue.id); return n })
            return false
        }
    }, [onUpdateFile, addLog])

    const handleRevert = useCallback(async (issue) => {
        addLog(`↩️ Reverting: ${issue.title}`)
        try {
            const result = await revertSourceFile(issue.file)
            if (result.content && onUpdateFile) {
                onUpdateFile(issue.file, result.content)
            }
            setIssues(prev => {
                const updated = prev.map(i => i.id === issue.id ? { ...i, fixed: false } : i)
                setTargetScore(calculateScore(updated))
                return updated
            })
            addLog(`✅ Reverted: ${issue.file}`)
        } catch (err) {
            addLog(`❌ Revert failed: ${err.message}`)
        }
    }, [onUpdateFile, addLog])

    const handleFixAll = useCallback(async () => {
        const fixable = issues.filter(i => i.autoFixable !== false && !i.fixed)
        if (fixable.length === 0) return
        setIsFixingAll(true)
        setFixProgress({ current: 0, total: fixable.length })
        addLog(`🚀 Starting Fix All: ${fixable.length} issues`)

        let successCount = 0
        for (let i = 0; i < fixable.length; i++) {
            setFixProgress({ current: i + 1, total: fixable.length })
            const success = await handleAutoFix(fixable[i])
            if (success) successCount++
            if (i < fixable.length - 1) {
                await new Promise(r => setTimeout(r, 500))
            }
        }

        addLog(`🏁 Fix All complete: ${successCount}/${fixable.length} fixed`)
        setIsFixingAll(false)
    }, [issues, handleAutoFix, addLog])

    const fixableCount = issues.filter(i => i.autoFixable !== false && !i.fixed).length
    const fixedIssueCount = issues.filter(i => i.fixed).length

    const circumference = 2 * Math.PI * 45
    const dashOffset = circumference - (animatedScore / 100) * circumference
    const scoreColor = animatedScore >= 80 ? '#22c55e' : animatedScore >= 50 ? '#f59e0b' : '#ef4444'

    // Group issues by category
    const grouped = issues.reduce((acc, issue) => {
        const cat = issue.category || 'code-quality'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(issue)
        return acc
    }, {})

    return (
        <div className="orca-popup-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="orca-popup-container compliance-popup" style={{ maxWidth: 760, maxHeight: '92vh' }}>
                {/* Header */}
                <div className="orca-popup-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FiCheckCircle size={18} style={{ color: '#22c55e' }} />
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Compliance Check</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!isScanning && fixableCount > 0 && (
                            <button
                                onClick={handleFixAll}
                                disabled={isFixingAll}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px',
                                    background: isFixingAll ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.15)',
                                    border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8,
                                    color: '#22c55e', fontSize: 12, fontWeight: 700,
                                    cursor: isFixingAll ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {isFixingAll ? (
                                    <><FiLoader size={12} className="spinner" /> Fixing {fixProgress.current}/{fixProgress.total}…</>
                                ) : (
                                    <>🔧 Fix All ({fixableCount})</>
                                )}
                            </button>
                        )}
                        <button
                            onClick={() => { setIssues([]); setTargetScore(0); setAnimatedScore(0); scanCompliance() }}
                            disabled={isScanning}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--orca-border,#333)',
                                borderRadius: 6, color: 'var(--orca-text-muted,#888)', fontSize: 11,
                                cursor: 'pointer',
                            }}
                        >
                            🔄 Re-scan
                        </button>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--orca-text-muted)', padding: 4 }}><FiX size={16} /></button>
                    </div>
                </div>

                {/* Body */}
                <div className="orca-popup-body" style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                    {isScanning ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60, gap: 16 }}>
                            <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            <p style={{ color: 'var(--orca-text-muted)', fontSize: 13 }}>Scanning for compliance issues…</p>
                        </div>
                    ) : (
                        <>
                            {/* Score Circle + stats */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
                                <svg viewBox="0 0 100 100" width="120" height="120">
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                                    <circle
                                        cx="50" cy="50" r="45" fill="none"
                                        stroke={scoreColor}
                                        strokeWidth="6"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={dashOffset}
                                        strokeLinecap="round"
                                        transform="rotate(-90 50 50)"
                                        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                                    />
                                    <text x="50" y="45" textAnchor="middle" fill={scoreColor} fontSize="24" fontWeight="700">
                                        {animatedScore}
                                    </text>
                                    <text x="50" y="62" textAnchor="middle" fill="var(--orca-text-muted,#888)" fontSize="10">
                                        SCORE
                                    </text>
                                </svg>
                                <div>
                                    <p style={{ color: 'var(--orca-text-secondary)', fontSize: 13, margin: '0 0 4px' }}>
                                        {issues.length} issues found · {fixedIssueCount} fixed
                                    </p>
                                    {issues.length === 0 && (
                                        <p style={{ color: '#22c55e', fontSize: 14, fontWeight: 600, margin: 0 }}>✅ All compliant!</p>
                                    )}
                                </div>
                            </div>

                            {/* Fix Progress Bar */}
                            {isFixingAll && fixProgress.total > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--orca-text-muted)', marginBottom: 4 }}>
                                        <span>Fixing compliance issues…</span>
                                        <span>{fixProgress.current} / {fixProgress.total}</span>
                                    </div>
                                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', width: `${(fixProgress.current / fixProgress.total) * 100}%`,
                                            background: 'linear-gradient(90deg, #22c55e, #06b6d4)', borderRadius: 4,
                                            transition: 'width 0.3s ease',
                                        }} />
                                    </div>
                                </div>
                            )}

                            {/* Issues grouped by category */}
                            {Object.entries(grouped).map(([cat, catIssues]) => {
                                const catConfig = CATEGORY_CONFIG[cat] || { icon: '📋', label: cat, color: '#888' }
                                return (
                                    <div key={cat} style={{ marginBottom: 20 }}>
                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--orca-text)', marginBottom: 10 }}>
                                            <span>{catConfig.icon}</span>
                                            {catConfig.label}
                                            <span style={{ fontSize: 11, color: 'var(--orca-text-muted)', fontWeight: 400 }}>({catIssues.length})</span>
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {catIssues.map(issue => {
                                                const isBeingFixed = fixingIds.has(issue.id)
                                                return (
                                                    <div key={issue.id} style={{
                                                        padding: '12px 14px', borderRadius: 10,
                                                        background: issue.fixed ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.02)',
                                                        border: `1px solid ${issue.fixed ? 'rgba(34,197,94,0.2)' : 'var(--orca-border,#333)'}`,
                                                        opacity: issue.fixed ? 0.7 : 1, transition: 'all 0.2s',
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                                            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{catConfig.icon}</span>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--orca-text)', margin: '0 0 3px' }}>{issue.title}</h4>
                                                                <p style={{ fontSize: 12, color: 'var(--orca-text-secondary)', margin: '0 0 6px', lineHeight: 1.5 }}>{issue.description}</p>
                                                                <span style={{
                                                                    fontSize: 10, fontFamily: 'monospace', padding: '1px 6px',
                                                                    borderRadius: 4, background: 'rgba(255,255,255,0.05)',
                                                                    color: 'var(--orca-text-muted)',
                                                                }}>
                                                                    📄 {issue.file}{issue.line ? `:${issue.line}` : ''}
                                                                </span>
                                                            </div>
                                                            <div style={{ flexShrink: 0 }}>
                                                                {issue.fixed ? (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                        <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>✅ Fixed</span>
                                                                        <button
                                                                            onClick={() => handleRevert(issue)}
                                                                            style={{
                                                                                display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px',
                                                                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                                                                borderRadius: 6, color: '#ef4444', fontSize: 10, fontWeight: 600,
                                                                                cursor: 'pointer',
                                                                            }}
                                                                        >
                                                                            <FiRotateCcw size={10} /> Revert
                                                                        </button>
                                                                    </div>
                                                                ) : isBeingFixed ? (
                                                                    <span style={{ color: '#f59e0b', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                        <FiLoader size={11} className="spinner" /> Fixing…
                                                                    </span>
                                                                ) : issue.autoFixable !== false ? (
                                                                    <button
                                                                        onClick={() => handleAutoFix(issue)}
                                                                        disabled={isFixingAll}
                                                                        style={{
                                                                            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px',
                                                                            background: `${catConfig.color}15`, border: `1px solid ${catConfig.color}55`,
                                                                            borderRadius: 6, color: catConfig.color, fontSize: 11, fontWeight: 600,
                                                                            cursor: 'pointer',
                                                                        }}
                                                                    >
                                                                        🔧 Auto-Fix
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Fix Log */}
                            {fixLog.length > 0 && (
                                <details style={{ marginTop: 16 }}>
                                    <summary style={{ fontSize: 11, color: 'var(--orca-text-muted)', cursor: 'pointer', fontWeight: 600 }}>
                                        📋 Fix Log ({fixLog.length})
                                    </summary>
                                    <div style={{
                                        maxHeight: 120, overflow: 'auto', padding: 8, borderRadius: 6,
                                        background: 'rgba(0,0,0,0.2)', fontSize: 11, fontFamily: 'monospace',
                                        lineHeight: 1.6, color: 'var(--orca-text-secondary)',
                                        border: '1px solid rgba(255,255,255,0.05)', marginTop: 6,
                                    }}>
                                        {fixLog.map((line, i) => <div key={i}>{line}</div>)}
                                    </div>
                                </details>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
