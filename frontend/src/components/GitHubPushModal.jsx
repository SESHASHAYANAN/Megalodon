import { useState } from 'react'
import { FiGithub, FiUploadCloud, FiX, FiLock, FiUnlock, FiCheck, FiExternalLink, FiAlertCircle } from 'react-icons/fi'
import { pushToGitHub, getGitHubUser } from '../services/api'
import { useEffect } from 'react'

export default function GitHubPushModal({ files, onClose, defaultName = '' }) {
    const [repoName, setRepoName] = useState(defaultName)
    const [commitMsg, setCommitMsg] = useState('Deploy from ORCA')
    const [isPrivate, setIsPrivate] = useState(false)
    const [pushing, setPushing] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')
    const [authenticated, setAuthenticated] = useState(null) // null = loading

    useEffect(() => {
        getGitHubUser().then(data => {
            setAuthenticated(data.authenticated === true)
        }).catch(() => setAuthenticated(false))
    }, [])

    const handlePush = async () => {
        if (!repoName.trim()) return
        setPushing(true)
        setError('')
        setResult(null)
        try {
            const data = await pushToGitHub(repoName, files, commitMsg, isPrivate)
            setResult(data)
        } catch (e) {
            setError(e.message || 'Push failed')
        }
        setPushing(false)
    }

    const handleLogin = () => {
        window.location.href = '/api/auth/github'
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(4px)',
        }} onClick={onClose}>
            <div className="glass-card animate-fadeIn" onClick={e => e.stopPropagation()}
                style={{ width: 480, padding: 28, borderRadius: 16 }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: 'rgba(88,166,255,0.15)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <FiGithub size={20} style={{ color: 'var(--orca-accent)' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Push to GitHub</h3>
                            <p style={{ fontSize: 12, color: 'var(--orca-text-muted)' }}>{Object.keys(files).length} files</p>
                        </div>
                    </div>
                    <button className="btn-ghost" onClick={onClose}><FiX size={16} /></button>
                </div>

                {/* Loading auth state */}
                {authenticated === null && (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <div className="spinner" style={{ margin: '0 auto 12px' }} />
                        <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)' }}>Checking authentication…</p>
                    </div>
                )}

                {/* Not signed in */}
                {authenticated === false && (
                    <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
                            background: 'rgba(248,166,0,0.12)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <FiAlertCircle size={26} style={{ color: 'var(--orca-orange)' }} />
                        </div>
                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Sign In Required</h3>
                        <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                            Sign in with GitHub to push your files directly to a repository.
                        </p>
                        <button className="btn-primary" onClick={handleLogin}
                            style={{ display: 'inline-flex', gap: 8, padding: '12px 28px' }}>
                            <FiGithub size={16} /> Sign In with GitHub
                        </button>
                    </div>
                )}

                {/* Authenticated — show form or result */}
                {authenticated === true && result && (
                    /* Success state */
                    <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
                            background: 'rgba(63,185,80,0.15)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <FiCheck size={28} style={{ color: 'var(--orca-green)' }} />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Pushed Successfully!</h3>
                        <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)', marginBottom: 4 }}>
                            {result.pushed?.length || 0} files pushed to {result.repo}
                        </p>
                        <a href={`https://github.com/${result.repo}`} target="_blank" rel="noreferrer" className="btn-primary"
                            style={{ textDecoration: 'none', display: 'inline-flex', marginTop: 16 }}>
                            <FiExternalLink size={14} /> Open Repository
                        </a>
                    </div>
                )}

                {authenticated === true && !result && (
                    /* Form */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--orca-text-secondary)', marginBottom: 6, display: 'block' }}>
                                Repository Name
                            </label>
                            <input className="input-field" placeholder="my-awesome-app"
                                value={repoName} onChange={e => setRepoName(e.target.value)} />
                        </div>

                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--orca-text-secondary)', marginBottom: 6, display: 'block' }}>
                                Commit Message
                            </label>
                            <input className="input-field" placeholder="Deploy from ORCA"
                                value={commitMsg} onChange={e => setCommitMsg(e.target.value)} />
                        </div>

                        <div onClick={() => setIsPrivate(!isPrivate)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 0' }}>
                            {isPrivate ? <FiLock size={14} style={{ color: 'var(--orca-orange)' }} />
                                : <FiUnlock size={14} style={{ color: 'var(--orca-green)' }} />}
                            <span style={{ fontSize: 13 }}>{isPrivate ? 'Private' : 'Public'} repository</span>
                        </div>

                        {error && (
                            <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(248,81,73,0.1)', color: 'var(--orca-red)', fontSize: 13 }}>
                                {error}
                            </div>
                        )}

                        <button className="btn-primary" onClick={handlePush}
                            disabled={pushing || !repoName.trim()}
                            style={{ width: '100%', justifyContent: 'center', padding: '12px 24px', marginTop: 4 }}>
                            {pushing ? <><div className="spinner" /> Pushing...</> : <><FiUploadCloud size={15} /> Push to GitHub</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
