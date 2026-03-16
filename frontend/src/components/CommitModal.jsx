import { useState } from 'react'
import { FiGitCommit, FiX, FiUploadCloud, FiFile } from 'react-icons/fi'

export default function CommitModal({ modifiedFiles, onConfirm, onClose, pushing }) {
    const [commitMsg, setCommitMsg] = useState('')

    const filePaths = Object.keys(modifiedFiles || {})

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(4px)',
        }} onClick={onClose}>
            <div className="glass-card animate-fadeIn" onClick={e => e.stopPropagation()}
                style={{ width: 500, padding: 28, borderRadius: 16 }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: 'rgba(88,166,255,0.15)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <FiGitCommit size={20} style={{ color: 'var(--orca-accent)' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Push to GitHub</h3>
                            <p style={{ fontSize: 12, color: 'var(--orca-text-muted)' }}>
                                {filePaths.length} modified file{filePaths.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <button className="btn-ghost" onClick={onClose}><FiX size={16} /></button>
                </div>

                {/* Modified files list */}
                <div style={{
                    maxHeight: 160, overflow: 'auto', marginBottom: 16,
                    background: 'var(--orca-bg)', borderRadius: 8, border: '1px solid var(--orca-border)',
                }}>
                    {filePaths.map(fp => (
                        <div key={fp} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px', borderBottom: '1px solid var(--orca-border)',
                            fontSize: 12, color: 'var(--orca-text-secondary)',
                        }}>
                            <FiFile size={12} style={{ color: 'var(--orca-orange)' }} />
                            <span style={{ fontFamily: 'var(--font-mono)' }}>{fp}</span>
                            <span style={{
                                marginLeft: 'auto', fontSize: 10, padding: '2px 6px',
                                borderRadius: 4, background: 'rgba(240,136,62,0.15)',
                                color: 'var(--orca-orange)',
                            }}>modified</span>
                        </div>
                    ))}
                </div>

                {/* Commit message */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--orca-text-secondary)',
                        marginBottom: 6, display: 'block',
                    }}>
                        Commit Message
                    </label>
                    <input className="input-field" placeholder="Describe your changes..."
                        value={commitMsg} onChange={e => setCommitMsg(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && commitMsg.trim() && onConfirm(commitMsg)}
                        autoFocus />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={onClose} style={{ padding: '10px 18px' }}>
                        Cancel
                    </button>
                    <button className="btn-primary" onClick={() => commitMsg.trim() && onConfirm(commitMsg)}
                        disabled={pushing || !commitMsg.trim()}
                        style={{ padding: '10px 24px' }}>
                        {pushing
                            ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Pushing...</>
                            : <><FiUploadCloud size={14} /> Commit & Push</>}
                    </button>
                </div>
            </div>
        </div>
    )
}
