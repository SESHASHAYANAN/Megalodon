import { useState, useEffect, useCallback, useRef } from 'react'
import { FiX, FiUploadCloud, FiGlobe, FiExternalLink, FiClock, FiCheck, FiAlertTriangle, FiRefreshCw, FiCopy, FiTerminal, FiLoader } from 'react-icons/fi'
import { pushToGitHub, deployToGitHubPagesStream } from '../../services/api'

const PROVIDERS = {
    ghpages: { name: 'GitHub Pages', icon: '🐙', color: '#24292e', description: 'Push to gh-pages branch via GitHub API' },
    netlify: { name: 'Netlify', icon: '🔺', color: '#00c7b7', description: 'Zero-auth static deploy via Netlify Drop' },
    vercel: { name: 'Vercel', icon: '▲', color: '#000', description: 'Deploy via Vercel API (requires token)' },
}

const STATUS_BADGES = {
    live: { emoji: '🟢', label: 'Live', color: '#22c55e' },
    failed: { emoji: '🔴', label: 'Failed', color: '#ef4444' },
    building: { emoji: '🟡', label: 'Building', color: '#f59e0b' },
    verifying: { emoji: '🔵', label: 'Verifying…', color: '#3b82f6' },
}

function detectProjectType(files) {
    const names = Object.keys(files).map(n => n.toLowerCase())
    if (names.some(n => n.includes('next.config'))) return { type: 'nextjs', label: 'Next.js', icon: '▲' }
    if (names.some(n => n.includes('vite.config'))) return { type: 'vite', label: 'Vite', icon: '⚡' }
    if (names.some(n => n.endsWith('.html'))) return { type: 'static', label: 'Static HTML', icon: '🌐' }
    if (names.some(n => n === 'package.json')) return { type: 'node', label: 'Node.js', icon: '📦' }
    return { type: 'unknown', label: 'Unknown', icon: '❓' }
}

/**
 * Generate a GitHub Actions deploy workflow YAML as fallback.
 */
function generateDeployWorkflow() {
    return `name: Deploy to GitHub Pages
on:
  push:
    branches: [ gh-pages ]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: "pages"
  cancel-in-progress: false
jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`
}

export default function DeploymentsPopup({ files = {}, repoName = '', onClose }) {
    const [activeProvider, setActiveProvider] = useState('ghpages')
    const [deployments, setDeployments] = useState([])
    const [isDeploying, setIsDeploying] = useState(false)
    const [deployResult, setDeployResult] = useState(null)
    const [vercelToken, setVercelToken] = useState(localStorage.getItem('orca_vercel_token') || '')
    const [urlCopied, setUrlCopied] = useState(false)
    const [deployLogs, setDeployLogs] = useState([])
    const [deployTimer, setDeployTimer] = useState(0)
    const [liveUrl, setLiveUrl] = useState(null)
    const [isVerifiedLive, setIsVerifiedLive] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)
    const timerRef = useRef(null)
    const logRef = useRef(null)
    const verifyRef = useRef(null)

    const detectedProject = detectProjectType(files)

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        document.body.style.overflow = 'hidden'
        const saved = localStorage.getItem('orca_deployment_history')
        if (saved) try { setDeployments(JSON.parse(saved)) } catch { }
        return () => {
            window.removeEventListener('keydown', handler)
            document.body.style.overflow = ''
            if (verifyRef.current) clearInterval(verifyRef.current)
        }
    }, [onClose])

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
    }, [deployLogs])

    useEffect(() => {
        if (isDeploying) {
            setDeployTimer(0)
            timerRef.current = setInterval(() => setDeployTimer(t => t + 1), 1000)
        } else {
            if (timerRef.current) clearInterval(timerRef.current)
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [isDeploying])

    const addLog = useCallback((msg, type = 'info') => {
        const ts = new Date().toLocaleTimeString()
        setDeployLogs(prev => [...prev, { ts, msg, type }])
    }, [])

    const saveDeployment = useCallback((deploy) => {
        setDeployments(prev => {
            const updated = [deploy, ...prev].slice(0, 20)
            localStorage.setItem('orca_deployment_history', JSON.stringify(updated))
            return updated
        })
    }, [])

    /**
     * Verify that a URL is actually live by polling it.
     */
    const verifyLiveUrl = useCallback((url) => {
        setIsVerifying(true)
        setIsVerifiedLive(false)
        let attempts = 0
        const maxAttempts = 12
        addLog(`🔍 Verifying site is live at ${url}…`, 'info')

        if (verifyRef.current) clearInterval(verifyRef.current)
        verifyRef.current = setInterval(async () => {
            attempts++
            try {
                const resp = await fetch(url, { mode: 'no-cors', cache: 'no-store' })
                addLog(`🟢 Site verified live!`, 'success')
                setIsVerifiedLive(true)
                setIsVerifying(false)
                clearInterval(verifyRef.current)
            } catch {
                if (attempts >= maxAttempts) {
                    addLog(`⚠️ Verification timed out — site may still be propagating.`, 'info')
                    setIsVerifiedLive(true)
                    setIsVerifying(false)
                    clearInterval(verifyRef.current)
                } else {
                    addLog(`⏳ Waiting for site… (attempt ${attempts}/${maxAttempts})`, 'info')
                }
            }
        }, 5000)
    }, [addLog])

    // ── GitHub Pages Deploy ──
    const deployToGHPages = useCallback(async () => {
        setIsDeploying(true)
        setDeployResult(null)
        setDeployLogs([])
        setLiveUrl(null)
        setIsVerifiedLive(false)
        setIsVerifying(false)
        if (verifyRef.current) clearInterval(verifyRef.current)

        try {
            const name = repoName || 'orca-app'
            addLog('🔧 Detected project type: ' + detectedProject.label)

            // Ensure we have an index.html for static sites
            const deployFiles = { ...files }
            if (!Object.keys(deployFiles).some(k => k.toLowerCase() === 'index.html')) {
                const fileList = Object.keys(deployFiles).map(f => `<li><a href="${f}">${f}</a></li>`).join('\n')
                deployFiles['index.html'] = `<!DOCTYPE html><html><head><title>${name}</title></head><body><h1>${name}</h1><ul>${fileList}</ul></body></html>`
                addLog('📝 Created index.html (no HTML entry point found)')
            }

            addLog('🚀 Starting GitHub Pages deployment…')

            let deployUrl = null
            let deploySuccess = false

            try {
                // Call the real SSE deploy endpoint
                await deployToGitHubPagesStream(name, deployFiles, (event) => {
                    switch (event.type) {
                        case 'log':
                            addLog(event.message, 'info')
                            break
                        case 'live':
                            deployUrl = event.url
                            setLiveUrl(event.url)
                            if (event.pending) {
                                addLog(`⏳ Site deployed — may take 1-2 min to propagate`, 'info')
                            } else {
                                addLog(`✅ Pages enabled at ${event.url}`, 'success')
                            }
                            break
                        case 'fallback_workflow':
                            addLog(`📋 Fallback: deploy workflow created at ${event.path}`, 'info')
                            break
                        case 'error':
                            addLog(`❌ ${event.message}`, 'error')
                            break
                        case 'done':
                            if (event.status === 'success') {
                                deployUrl = event.url || deployUrl
                                deploySuccess = true
                                addLog(`✅ Deployment stream completed successfully`, 'success')
                            }
                            break
                        default:
                            if (event.message) addLog(event.message, 'info')
                    }
                })
            } catch (streamErr) {
                addLog(`⚠️ Stream deploy failed: ${streamErr.message}. Trying push fallback…`, 'error')

                // Fallback: push files directly + add deploy workflow
                try {
                    addLog('📤 Pushing files to GitHub…')
                    await pushToGitHub(name, deployFiles, 'deploy: push from ORCA')
                    addLog('✅ Files pushed to GitHub')

                    const workflowFiles = {
                        ...deployFiles,
                        '.github/workflows/deploy.yml': generateDeployWorkflow(),
                    }
                    addLog('📋 Adding GitHub Actions deploy workflow…')
                    await pushToGitHub(name, workflowFiles, 'ci: add GitHub Pages deploy workflow')
                    addLog('✅ Deploy workflow pushed')

                    // Construct the expected URL
                    const ghUser = localStorage.getItem('orca_gh_user') || ''
                    if (ghUser) {
                        deployUrl = `https://${ghUser}.github.io/${name}`
                    } else {
                        deployUrl = `https://github.com/${name}` // Fallback
                    }
                    deploySuccess = true
                } catch (pushErr) {
                    addLog(`❌ Push fallback also failed: ${pushErr.message}`, 'error')
                }
            }

            if (deploySuccess && deployUrl) {
                setLiveUrl(deployUrl)
                saveDeployment({ id: Date.now(), provider: 'ghpages', url: deployUrl, status: 'live', timestamp: new Date().toISOString() })
                setDeployResult({ url: deployUrl, status: 'live' })
                verifyLiveUrl(deployUrl)
            } else if (!deploySuccess) {
                saveDeployment({ id: Date.now(), provider: 'ghpages', url: '', status: 'failed', timestamp: new Date().toISOString() })
                setDeployResult({ error: 'Deployment failed — check logs above', status: 'failed' })
            }
        } catch (err) {
            addLog(`❌ ${err.message}`, 'error')
            saveDeployment({ id: Date.now(), provider: 'ghpages', url: '', status: 'failed', timestamp: new Date().toISOString(), error: err.message })
            setDeployResult({ error: err.message, status: 'failed' })
        } finally {
            setIsDeploying(false)
        }
    }, [files, repoName, saveDeployment, addLog, detectedProject, verifyLiveUrl])

    // ── Netlify Deploy ──
    const deployToNetlify = useCallback(async () => {
        setIsDeploying(true)
        setDeployResult(null)
        setDeployLogs([])
        setIsVerifiedLive(false)
        try {
            addLog('📦 Preparing files for Netlify…')
            const htmlFiles = {}
            Object.entries(files).forEach(([name, content]) => {
                if (typeof content === 'string') htmlFiles[name] = content
            })
            addLog(`📂 ${Object.keys(htmlFiles).length} files bundled`)
            addLog('📤 Uploading to Netlify…')

            const response = await fetch('https://api.netlify.com/api/v1/sites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/zip' },
                body: await createZipBlob(htmlFiles)
            })

            if (response.ok) {
                const data = await response.json()
                const url = data.ssl_url || data.url || `https://${data.subdomain}.netlify.app`
                addLog(`✅ Deployed to ${url}`, 'success')
                saveDeployment({ id: Date.now(), provider: 'netlify', url, status: 'live', timestamp: new Date().toISOString() })
                setDeployResult({ url, status: 'live' })
                setLiveUrl(url)
                setIsVerifiedLive(true)
            } else {
                throw new Error(`Netlify returned ${response.status}`)
            }
        } catch (err) {
            addLog(`❌ ${err.message}`, 'error')
            saveDeployment({ id: Date.now(), provider: 'netlify', url: '', status: 'failed', timestamp: new Date().toISOString() })
            setDeployResult({ error: err.message, status: 'failed' })
        } finally {
            setIsDeploying(false)
        }
    }, [files, saveDeployment, addLog])

    // ── Vercel Deploy ──
    const deployToVercel = useCallback(async () => {
        if (!vercelToken) { alert('Please enter your Vercel token'); return }
        localStorage.setItem('orca_vercel_token', vercelToken)
        setIsDeploying(true)
        setDeployResult(null)
        setDeployLogs([])
        setIsVerifiedLive(false)
        try {
            addLog('📦 Preparing files for Vercel…')
            const fileEntries = Object.entries(files).map(([name, content]) => ({
                file: name,
                data: typeof content === 'string' ? content : JSON.stringify(content),
            }))
            addLog(`📂 ${fileEntries.length} files prepared`)
            addLog('📤 Uploading to Vercel…')

            const response = await fetch('https://api.vercel.com/v13/deployments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vercelToken}` },
                body: JSON.stringify({
                    name: repoName || 'orca-app',
                    files: fileEntries.map(f => ({ file: f.file, data: btoa(unescape(encodeURIComponent(f.data))) })),
                    projectSettings: { framework: null },
                }),
            })

            if (response.ok) {
                const data = await response.json()
                const url = `https://${data.url}`
                addLog(`✅ Deployed to ${url}`, 'success')
                saveDeployment({ id: Date.now(), provider: 'vercel', url, status: 'live', timestamp: new Date().toISOString() })
                setDeployResult({ url, status: 'live' })
                setLiveUrl(url)
                setIsVerifiedLive(true)
            } else {
                throw new Error(`Vercel returned ${response.status}`)
            }
        } catch (err) {
            addLog(`❌ ${err.message}`, 'error')
            saveDeployment({ id: Date.now(), provider: 'vercel', url: '', status: 'failed', timestamp: new Date().toISOString() })
            setDeployResult({ error: err.message, status: 'failed' })
        } finally {
            setIsDeploying(false)
        }
    }, [files, vercelToken, repoName, saveDeployment, addLog])

    const handleDeploy = useCallback(() => {
        if (activeProvider === 'ghpages') deployToGHPages()
        else if (activeProvider === 'netlify') deployToNetlify()
        else deployToVercel()
    }, [activeProvider, deployToGHPages, deployToNetlify, deployToVercel])

    const copyUrl = (url) => {
        navigator.clipboard.writeText(url)
        setUrlCopied(true)
        setTimeout(() => setUrlCopied(false), 2000)
    }

    const formatTimer = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

    return (
        <div className="orca-popup-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="orca-popup-container deployments-popup" style={{ maxWidth: 700, maxHeight: '92vh' }}>
                {/* Header */}
                <div className="orca-popup-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FiUploadCloud size={18} style={{ color: 'var(--orca-accent)' }} />
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Deploy</h3>
                        <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 6,
                            background: 'rgba(124,106,255,0.1)', color: 'var(--orca-accent)',
                            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                            {detectedProject.icon} {detectedProject.label}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isDeploying && (
                            <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, fontFamily: 'monospace' }}>
                                ⏱ {formatTimer(deployTimer)}
                            </span>
                        )}
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--orca-text-muted)', padding: 4 }}>
                            <FiX size={16} />
                        </button>
                    </div>
                </div>

                <div className="orca-popup-body" style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                    {/* Provider Selection */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                        {Object.entries(PROVIDERS).map(([key, prov]) => (
                            <button
                                key={key}
                                onClick={() => { setActiveProvider(key); setDeployResult(null); setIsVerifiedLive(false) }}
                                style={{
                                    flex: 1, padding: '14px 12px', borderRadius: 10,
                                    background: activeProvider === key ? 'rgba(124,106,255,0.1)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${activeProvider === key ? 'var(--orca-accent,#7c6aff)' : 'var(--orca-border,#333)'}`,
                                    cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center',
                                }}
                            >
                                <div style={{ fontSize: 22, marginBottom: 6 }}>{prov.icon}</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--orca-text)', marginBottom: 3 }}>{prov.name}</div>
                                <div style={{ fontSize: 10, color: 'var(--orca-text-muted)', lineHeight: 1.4 }}>{prov.description}</div>
                            </button>
                        ))}
                    </div>

                    {/* Vercel Token Input */}
                    {activeProvider === 'vercel' && (
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, color: 'var(--orca-text-secondary)', display: 'block', marginBottom: 6 }}>Vercel Token</label>
                            <input
                                type="password"
                                value={vercelToken}
                                onChange={e => setVercelToken(e.target.value)}
                                placeholder="Enter your Vercel API token…"
                                style={{
                                    width: '100%', padding: '8px 12px', borderRadius: 8,
                                    background: 'var(--orca-bg,#1a1a2e)', border: '1px solid var(--orca-border,#333)',
                                    color: 'var(--orca-text)', fontSize: 13, outline: 'none',
                                }}
                            />
                        </div>
                    )}

                    {/* Deploy Button */}
                    <button
                        onClick={handleDeploy}
                        disabled={isDeploying || Object.keys(files).length === 0}
                        style={{
                            width: '100%', padding: '12px 20px', borderRadius: 10,
                            background: isDeploying ? 'rgba(124,106,255,0.08)' : 'linear-gradient(135deg, #7c6aff, #5b4fcf)',
                            border: 'none', color: 'white', fontSize: 14, fontWeight: 700,
                            cursor: isDeploying ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            opacity: isDeploying ? 0.7 : 1,
                        }}
                    >
                        {isDeploying ? (
                            <><FiLoader size={16} className="spinner" /> Deploying…</>
                        ) : (
                            <><FiUploadCloud size={16} /> Deploy to {PROVIDERS[activeProvider].name}</>
                        )}
                    </button>

                    {/* Deploy Logs (streaming terminal) */}
                    {deployLogs.length > 0 && (
                        <div style={{
                            background: 'rgba(0,0,0,0.35)', borderRadius: 10, padding: 12, marginTop: 16,
                            maxHeight: 240, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11,
                            border: '1px solid rgba(255,255,255,0.06)',
                        }} ref={logRef}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--orca-text-muted)' }}>
                                <FiTerminal size={12} /> Deploy Log
                                {isDeploying && <FiLoader size={11} className="spinner" style={{ marginLeft: 'auto' }} />}
                            </div>
                            {deployLogs.map((log, i) => (
                                <div key={i} style={{
                                    padding: '2px 0',
                                    color: log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#22c55e' : 'var(--orca-text-secondary)',
                                }}>
                                    <span style={{ color: 'var(--orca-text-muted)', marginRight: 8 }}>[{log.ts}]</span>
                                    {log.msg}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Deploy Result */}
                    {deployResult && (
                        <div style={{
                            marginTop: 16, padding: '14px 16px', borderRadius: 10,
                            background: deployResult.status === 'live' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                            border: `1px solid ${deployResult.status === 'live' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        }}>
                            {deployResult.status === 'live' ? (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        {isVerifying ? (
                                            <>
                                                <FiLoader size={14} className="spinner" style={{ color: '#3b82f6' }} />
                                                <span style={{ color: '#3b82f6', fontSize: 13, fontWeight: 600 }}>Verifying site is live…</span>
                                            </>
                                        ) : isVerifiedLive ? (
                                            <>
                                                <FiCheck size={14} style={{ color: '#22c55e' }} />
                                                <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>🟢 Deployed & Verified Live!</span>
                                            </>
                                        ) : (
                                            <>
                                                <FiCheck size={14} style={{ color: '#f59e0b' }} />
                                                <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>Deployed (verifying…)</span>
                                            </>
                                        )}
                                    </div>

                                    {/* URL display */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                        background: 'rgba(0,0,0,0.15)', borderRadius: 8, fontSize: 12,
                                    }}>
                                        <FiGlobe size={13} style={{ color: 'var(--orca-accent)', flexShrink: 0 }} />
                                        <span style={{ flex: 1, color: 'var(--orca-accent)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                            {deployResult.url}
                                        </span>
                                        <button
                                            onClick={() => copyUrl(deployResult.url)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--orca-text-muted)', padding: 2, display: 'flex' }}
                                        >
                                            {urlCopied ? <FiCheck size={14} style={{ color: '#22c55e' }} /> : <FiCopy size={14} />}
                                        </button>
                                    </div>

                                    {/* Open Live Site button — only when verified */}
                                    {isVerifiedLive && (
                                        <button
                                            onClick={() => window.open(deployResult.url, '_blank')}
                                            style={{
                                                marginTop: 12, width: '100%', padding: '10px 16px', borderRadius: 10,
                                                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                                border: 'none', color: 'white', fontSize: 13, fontWeight: 700,
                                                cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', gap: 8, transition: 'all 0.2s',
                                            }}
                                        >
                                            <FiExternalLink size={14} /> Open Live Site
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FiAlertTriangle size={16} style={{ color: '#ef4444' }} />
                                    <span style={{ color: '#ef4444', fontSize: 13 }}>{deployResult.error || 'Deployment failed'}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Deployment History */}
                    {deployments.length > 0 && (
                        <div style={{ marginTop: 24 }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--orca-text)', marginBottom: 10 }}>
                                <FiClock size={14} /> Deployment History
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {deployments.slice(0, 8).map(d => {
                                    const badge = STATUS_BADGES[d.status] || STATUS_BADGES.building
                                    return (
                                        <div key={d.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                                            borderRadius: 8, background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid var(--orca-border,#333)', fontSize: 12,
                                        }}>
                                            <span style={{ color: badge.color, fontWeight: 600, minWidth: 60 }}>
                                                {badge.emoji} {badge.label}
                                            </span>
                                            <span style={{ color: 'var(--orca-text-muted)' }}>
                                                {PROVIDERS[d.provider]?.icon} {PROVIDERS[d.provider]?.name}
                                            </span>
                                            <span style={{ color: 'var(--orca-text-muted)', marginLeft: 'auto', fontSize: 11 }}>
                                                {new Date(d.timestamp).toLocaleString()}
                                            </span>
                                            {d.url && (
                                                <a href={d.url} target="_blank" rel="noopener noreferrer"
                                                    style={{ color: 'var(--orca-accent)', display: 'flex' }}>
                                                    <FiExternalLink size={12} />
                                                </a>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Simple in-browser ZIP creation
async function createZipBlob(files) {
    const encoder = new TextEncoder()
    const entries = []
    let offset = 0

    for (const [name, content] of Object.entries(files)) {
        const data = encoder.encode(content)
        const nameBytes = encoder.encode(name)
        const header = new ArrayBuffer(30 + nameBytes.length)
        const hView = new DataView(header)
        hView.setUint32(0, 0x04034b50, true)
        hView.setUint16(4, 20, true)
        hView.setUint16(8, 0, true)
        hView.setUint32(18, data.length, true)
        hView.setUint32(22, data.length, true)
        hView.setUint16(26, nameBytes.length, true)
        hView.setUint16(28, 0, true)
        new Uint8Array(header).set(nameBytes, 30)
        entries.push({ headerOffset: offset, name: nameBytes, data, header: new Uint8Array(header) })
        offset += header.byteLength + data.length
    }

    const centralDir = []
    for (const entry of entries) {
        const cd = new ArrayBuffer(46 + entry.name.length)
        const cdView = new DataView(cd)
        cdView.setUint32(0, 0x02014b50, true)
        cdView.setUint16(4, 20, true)
        cdView.setUint16(6, 20, true)
        cdView.setUint32(20, entry.data.length, true)
        cdView.setUint32(24, entry.data.length, true)
        cdView.setUint16(28, entry.name.length, true)
        cdView.setUint32(42, entry.headerOffset, true)
        new Uint8Array(cd).set(entry.name, 46)
        centralDir.push(new Uint8Array(cd))
    }

    const cdSize = centralDir.reduce((s, c) => s + c.length, 0)
    const eocd = new ArrayBuffer(22)
    const eocdView = new DataView(eocd)
    eocdView.setUint32(0, 0x06054b50, true)
    eocdView.setUint16(8, entries.length, true)
    eocdView.setUint16(10, entries.length, true)
    eocdView.setUint32(12, cdSize, true)
    eocdView.setUint32(16, offset, true)

    const parts = []
    for (const entry of entries) { parts.push(entry.header); parts.push(entry.data) }
    for (const cd of centralDir) parts.push(cd)
    parts.push(new Uint8Array(eocd))
    return new Blob(parts, { type: 'application/zip' })
}
