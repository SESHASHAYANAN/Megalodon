import { useState, useCallback } from 'react'
import { FiUploadCloud, FiExternalLink, FiCopy, FiLoader, FiGithub, FiGlobe, FiCheck, FiChevronDown } from 'react-icons/fi'

export default function DeployButton({ files }) {
    const [isDeploying, setIsDeploying] = useState(false)
    const [deployResult, setDeployResult] = useState(null) // { url, repoUrl, platform }
    const [error, setError] = useState(null)
    const [showMenu, setShowMenu] = useState(false)
    const [deployStep, setDeployStep] = useState('')

    const deployToNetlify = useCallback(async () => {
        if (Object.keys(files).length === 0) return
        setIsDeploying(true)
        setDeployResult(null)
        setError(null)
        setShowMenu(false)
        setDeployStep('Creating zip bundle...')

        try {
            const JSZip = (await import('jszip')).default
            const zip = new JSZip()
            Object.entries(files).forEach(([path, content]) => zip.file(path, content))
            const blob = await zip.generateAsync({ type: 'blob' })

            setDeployStep('Uploading to Netlify...')
            const response = await fetch('https://api.netlify.com/api/v1/sites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/zip' },
                body: blob,
            })

            if (!response.ok) throw new Error(`Deploy failed: ${response.status}`)
            const data = await response.json()
            const url = data.ssl_url || data.url || `https://${data.subdomain}.netlify.app`
            setDeployResult({ url, platform: 'netlify' })
        } catch (err) {
            setError(err.message)
        } finally {
            setIsDeploying(false)
            setDeployStep('')
        }
    }, [files])

    const deployToGitHub = useCallback(async () => {
        if (Object.keys(files).length === 0) return
        setIsDeploying(true)
        setDeployResult(null)
        setError(null)
        setShowMenu(false)

        try {
            setDeployStep('Creating GitHub repository...')
            const response = await fetch('/api/deploy/github-pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files }),
            })

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}))
                throw new Error(errData.detail || errData.error || `Deploy failed: ${response.status}`)
            }

            const data = await response.json()
            setDeployResult({
                url: data.pages_url || data.url,
                repoUrl: data.repo_url,
                platform: 'github'
            })
        } catch (err) {
            setError(err.message)
        } finally {
            setIsDeploying(false)
            setDeployStep('')
        }
    }, [files])

    const copyUrl = useCallback(() => {
        if (deployResult?.url) navigator.clipboard.writeText(deployResult.url)
    }, [deployResult])

    const hasFiles = Object.keys(files).length > 0

    return (
        <div className="creator-deploy-wrapper" style={{ position: 'relative' }}>
            {/* Deploy Button + Menu */}
            <div style={{ position: 'relative' }}>
                <button
                    className="btn-ghost creator-deploy-btn"
                    onClick={() => hasFiles && !isDeploying && setShowMenu(v => !v)}
                    disabled={isDeploying || !hasFiles}
                    title="Deploy your app"
                >
                    {isDeploying ? (
                        <><FiLoader className="spin-icon" size={14} /> {deployStep || 'Deploying...'}</>
                    ) : (
                        <><FiUploadCloud size={14} /> Deploy <FiChevronDown size={11} /></>
                    )}
                </button>

                {showMenu && (
                    <div className="creator-deploy-menu" onClick={() => setShowMenu(false)}>
                        <button className="creator-deploy-menu-item" onClick={deployToNetlify}>
                            <FiGlobe size={14} />
                            <div>
                                <div className="creator-deploy-menu-label">Netlify</div>
                                <div className="creator-deploy-menu-desc">Instant anonymous deploy</div>
                            </div>
                        </button>
                        <button className="creator-deploy-menu-item" onClick={deployToGitHub}>
                            <FiGithub size={14} />
                            <div>
                                <div className="creator-deploy-menu-label">GitHub Pages</div>
                                <div className="creator-deploy-menu-desc">Create repo + enable Pages</div>
                            </div>
                        </button>
                    </div>
                )}
            </div>

            {/* Success Result */}
            {deployResult && (
                <div className="creator-deploy-success">
                    <span>{deployResult.platform === 'github' ? '🐙' : '🚀'}</span>
                    <a href={deployResult.url} target="_blank" rel="noopener noreferrer" className="creator-deploy-link">
                        {deployResult.url?.replace('https://', '').substring(0, 30)}
                        <FiExternalLink size={11} />
                    </a>
                    {deployResult.repoUrl && (
                        <a href={deployResult.repoUrl} target="_blank" rel="noopener noreferrer"
                            className="creator-deploy-link" style={{ color: 'var(--orca-text-secondary)' }}>
                            <FiGithub size={11} /> Repo
                        </a>
                    )}
                    <button className="creator-icon-btn" onClick={copyUrl} title="Copy URL">
                        <FiCopy size={12} />
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="creator-deploy-error">
                    ❌ {error}
                </div>
            )}
        </div>
    )
}
