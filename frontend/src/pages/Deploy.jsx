import { useState, useEffect } from 'react'
import { FiGithub, FiUploadCloud, FiCheck, FiPlus, FiLink, FiRefreshCw, FiExternalLink, FiInbox } from 'react-icons/fi'
import { getGitHubUser, getUserRepos, pushToGitHub } from '../services/api'

export default function Deploy() {
    const [ghUser, setGhUser] = useState(null)
    const [deploying, setDeploying] = useState(false)
    const [repoName, setRepoName] = useState('')
    const [deployments, setDeployments] = useState([])
    const [selectedDeployment, setSelectedDeployment] = useState(null)

    useEffect(() => {
        getGitHubUser().then(data => {
            if (data.authenticated) {
                setGhUser(data)
                // Load real repos as "deployments"
                getUserRepos(1).then(repoData => {
                    const repos = (repoData.repos || []).slice(0, 10).map(repo => ({
                        id: repo.id,
                        name: repo.name,
                        repo: repo.full_name,
                        status: 'success',
                        date: new Date(repo.updated_at).toLocaleDateString(),
                        url: repo.html_url,
                    }))
                    setDeployments(repos)
                }).catch(() => { })
            }
        }).catch(() => { })
    }, [])

    const handleConnect = () => {
        window.location.href = '/api/auth/github'
    }

    const handleDeploy = async () => {
        if (!repoName.trim() || deploying) return
        setDeploying(true)
        try {
            await pushToGitHub(repoName.trim(), {}, `Initial deploy from ORCA`, false)
            setRepoName('')
        } catch {
            /* deploy failed */
        }
        setDeploying(false)
    }

    return (
        <div style={{ display: 'flex', height: '100%' }}>
            {/* Left: Deployment list */}
            <div style={{
                width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column',
                background: 'var(--orca-bg-secondary)', borderRight: '1px solid var(--orca-border)',
            }}>
                <div style={{
                    padding: '16px 16px 12px', borderBottom: '1px solid var(--orca-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Deployments</span>
                    <button className="btn-ghost">
                        <FiPlus size={14} /> New
                    </button>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
                    {deployments.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 16px', color: 'var(--orca-text-muted)' }}>
                            <FiInbox size={32} style={{ opacity: 0.3 }} />
                            <p style={{ fontSize: 13, textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
                                {ghUser ? 'No deployments yet. Create one to get started.' : 'Connect GitHub or open a project to begin.'}
                            </p>
                        </div>
                    ) : (
                        deployments.map(dep => (
                            <div key={dep.id} onClick={() => setSelectedDeployment(dep)}
                                className="glass-card"
                                style={{
                                    padding: 14, marginBottom: 6, cursor: 'pointer',
                                    borderColor: selectedDeployment?.id === dep.id ? 'var(--orca-accent)' : 'var(--orca-border)',
                                    background: selectedDeployment?.id === dep.id ? 'rgba(88,166,255,0.05)' : 'transparent',
                                }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <FiGithub size={14} style={{ color: 'var(--orca-text-secondary)' }} />
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{dep.name}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--orca-text-muted)' }}>
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: 'var(--orca-green)',
                                    }} />
                                    Deployed · {dep.date}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right: Deploy details */}
            <div style={{ flex: 1, overflow: 'auto', padding: 40 }}>
                <div className="animate-fadeIn" style={{ maxWidth: 600 }}>
                    {/* GitHub Connection */}
                    <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 10,
                                background: ghUser ? 'rgba(63,185,80,0.15)' : 'rgba(88,166,255,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {ghUser ? <FiCheck size={22} style={{ color: 'var(--orca-green)' }} />
                                    : <FiGithub size={22} style={{ color: 'var(--orca-accent)' }} />}
                            </div>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>
                                    {ghUser ? 'GitHub Connected' : 'Connect GitHub'}
                                </h3>
                                <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)' }}>
                                    {ghUser ? `Signed in as @${ghUser.login}. You can push repos.` : 'Link your GitHub account to deploy projects.'}
                                </p>
                            </div>
                        </div>
                        {!ghUser && (
                            <button className="btn-primary" onClick={handleConnect}>
                                <FiLink size={14} /> Connect with GitHub
                            </button>
                        )}
                    </div>

                    {/* Deploy new project */}
                    {ghUser && (
                        <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Deploy to GitHub</h3>
                            <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)', marginBottom: 16 }}>
                                Create a new repository or push to an existing one.
                            </p>
                            <input
                                className="input-field"
                                placeholder="Repository name, e.g. my-awesome-app"
                                value={repoName}
                                onChange={e => setRepoName(e.target.value)}
                                style={{ marginBottom: 12 }}
                            />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn-primary" onClick={handleDeploy} disabled={deploying || !repoName.trim()}>
                                    {deploying ? <><div className="spinner" /> Deploying...</> : <><FiUploadCloud size={14} /> Create & Push</>}
                                </button>
                                <button className="btn-secondary">
                                    <FiGithub size={14} /> Push to Existing
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Selected deployment details */}
                    {selectedDeployment && (
                        <div className="glass-card animate-fadeIn" style={{ padding: 24 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                                {selectedDeployment.name}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--orca-text-secondary)' }}>Repository</span>
                                    <span style={{ color: 'var(--orca-accent)' }}>{selectedDeployment.repo}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--orca-text-secondary)' }}>Status</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: 'var(--orca-green)',
                                        }} />
                                        Deployed
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--orca-text-secondary)' }}>Last updated</span>
                                    <span>{selectedDeployment.date}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                <button className="btn-secondary" onClick={() => window.open(selectedDeployment.url, '_blank')}><FiExternalLink size={14} /> Open Repo</button>
                                <button className="btn-ghost"><FiRefreshCw size={14} /> Redeploy</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
