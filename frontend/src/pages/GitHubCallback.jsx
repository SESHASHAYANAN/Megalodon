import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FiGithub, FiAlertCircle } from 'react-icons/fi'

/**
 * GitHubCallback — handles the return from GitHub OAuth.
 *
 * Supports TWO flows:
 *
 * Flow A — Backend redirect (preferred):
 *   Backend already exchanged the code and set a cookie.
 *   We arrive with ?success=true&login=<username>  or  ?error=<message>
 *
 * Flow B — GitHub redirects directly here with ?code=<xxx>:
 *   We POST the code to /api/auth/github/exchange so the backend can
 *   exchange it for a token, set the httpOnly cookie, and return the login.
 */
export default function GitHubCallback() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [error, setError] = useState(null)
    const [status, setStatus] = useState('Completing sign-in…')

    useEffect(() => {
        const success = searchParams.get('success')
        const login = searchParams.get('login')
        const oauthError = searchParams.get('error')
        const code = searchParams.get('code')

        if (oauthError) {
            setError(decodeURIComponent(oauthError.replace(/\+/g, ' ')))
            return
        }

        // Flow A — backend already handled the exchange
        if (success === 'true') {
            setStatus(`Welcome, ${login || 'user'}! Redirecting…`)
            setTimeout(() => navigate('/explorer', { replace: true }), 1200)
            return
        }

        // Flow B — GitHub redirected here with a code; exchange it now
        if (code) {
            setStatus('Exchanging token…')
            fetch('/api/auth/github/exchange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code }),
            })
                .then(async (r) => {
                    const data = await r.json()
                    if (r.ok && data.success) {
                        setStatus(`Welcome, ${data.login || 'user'}! Redirecting…`)
                        setTimeout(() => navigate('/explorer', { replace: true }), 1200)
                    } else {
                        setError(data.detail || data.error || 'Token exchange failed. Please try again.')
                    }
                })
                .catch(() => {
                    setError('Could not reach the server. Make sure the backend is running.')
                })
            return
        }

        // Neither success nor code — something went wrong
        setError('Authentication could not be completed. Please try signing in again.')
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div style={{
            height: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--orca-bg)',
        }}>
            <div className="glass-card animate-fadeIn" style={{
                padding: 40, textAlign: 'center', maxWidth: 420, width: '90%',
            }}>
                {error ? (
                    <>
                        <div style={{
                            width: 56, height: 56, borderRadius: 14, margin: '0 auto 20px',
                            background: 'rgba(248,81,73,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <FiAlertCircle size={28} style={{ color: 'var(--orca-red)' }} />
                        </div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: 'var(--orca-text)' }}>
                            Authentication Failed
                        </h2>
                        <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                            {error}
                        </p>
                        <button
                            className="btn-primary"
                            onClick={() => navigate('/', { replace: true })}
                            style={{ width: '100%', justifyContent: 'center' }}
                        >
                            Return to Home
                        </button>
                    </>
                ) : (
                    <>
                        <div style={{
                            width: 56, height: 56, borderRadius: 14, margin: '0 auto 20px',
                            background: 'linear-gradient(135deg, var(--orca-gradient-start), var(--orca-gradient-end))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <FiGithub size={26} style={{ color: 'white' }} />
                        </div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: 'var(--orca-text)' }}>
                            {status}
                        </h2>
                        <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)' }}>
                            You're now signed in. Heading to the Explorer…
                        </p>
                        <div className="spinner" style={{ margin: '20px auto 0' }} />
                    </>
                )}
            </div>
        </div>
    )
}
