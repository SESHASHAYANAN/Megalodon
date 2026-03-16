import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
    FiHome, FiCode, FiBox, FiUploadCloud, FiSettings,
    FiMessageSquare, FiGithub, FiLogOut, FiZap, FiUser, FiBookOpen, FiVideo
} from 'react-icons/fi'
import { getGitHubUser, logoutGitHub } from '../services/api'

const NAV_LINKS = [
    { to: '/', icon: FiHome, label: 'Home' },
    { to: '/explorer', icon: FiCode, label: 'Explorer' },
    { to: '/creator', icon: FiBox, label: 'App Creator' },
    { to: '/learning', icon: FiBookOpen, label: 'Learning' },
    { to: '/visualize', icon: FiVideo, label: 'Visualize' },
    { to: '/deploy', icon: FiUploadCloud, label: 'Deploy' },
    { to: '/settings', icon: FiSettings, label: 'Settings' },
]

export default function Navbar({ onToggleAI, showAI }) {
    const [ghUser, setGhUser] = useState(null)
    const [showDropdown, setShowDropdown] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        getGitHubUser().then(data => {
            if (data.authenticated) {
                setGhUser({ login: data.login, avatar_url: data.avatar_url, name: data.name || data.login })
            }
        }).catch(() => { })
    }, [])

    // Navigates to /api/auth/github which triggers a 302 redirect to GitHub's authorize page
    const handleGitHubLogin = () => { window.location.href = '/api/auth/github' }

    const handleLogout = async () => {
        try { await logoutGitHub() } catch { }
        setGhUser(null)
        setShowDropdown(false)
    }

    return (
        <nav style={{
            display: 'flex', alignItems: 'center',
            height: 50, padding: '0 18px',
            background: 'var(--orca-bg-secondary)',
            borderBottom: '1px solid var(--orca-border)',
            gap: 6, flexShrink: 0, zIndex: 100,
        }}>
            {/* Logo */}
            <div
                onClick={() => navigate('/')}
                style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 20, cursor: 'pointer', userSelect: 'none' }}
            >
                <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: 'var(--orca-gradient-vivid)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, color: 'white', fontSize: 14, letterSpacing: '-1px',
                    boxShadow: '0 0 16px rgba(124,106,255,0.4)',
                }}>⬡</div>
                <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.4px' }}>
                    <span style={{ color: 'var(--orca-accent)' }}>OR</span>
                    <span style={{ color: 'var(--orca-text)' }}>CA</span>
                </span>
            </div>

            {/* Nav Links */}
            <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                {NAV_LINKS.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to} to={to} end={to === '/'}
                        style={({ isActive }) => ({
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 13px', borderRadius: 6,
                            fontSize: 13, fontWeight: isActive ? 600 : 500,
                            textDecoration: 'none',
                            color: isActive ? 'var(--orca-text)' : 'var(--orca-text-secondary)',
                            background: isActive ? 'rgba(124,106,255,0.14)' : 'transparent',
                            borderBottom: isActive ? '2px solid var(--orca-accent)' : '2px solid transparent',
                            transition: 'all 0.15s ease',
                        })}
                    >
                        <Icon size={14} />
                        {label}
                    </NavLink>
                ))}
            </div>

            {/* Right actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                {/* AI Assistant Toggle */}
                <button
                    onClick={onToggleAI}
                    className="btn-ghost"
                    title="Toggle AI Assistant"
                    style={{
                        color: showAI ? 'var(--orca-accent)' : 'var(--orca-text-secondary)',
                        background: showAI ? 'rgba(124,106,255,0.12)' : 'transparent',
                        borderRadius: 7, padding: '5px 10px',
                    }}
                >
                    <FiMessageSquare size={15} />
                    <span style={{ fontSize: 12 }}>AI</span>
                </button>

                {/* GitHub Auth */}
                {ghUser ? (
                    <div style={{ position: 'relative' }}>
                        <button
                            className="btn-ghost"
                            onClick={() => setShowDropdown(!showDropdown)}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 9px' }}
                        >
                            <img src={ghUser.avatar_url} alt={ghUser.login} style={{
                                width: 24, height: 24, borderRadius: '50%',
                                border: '2px solid var(--orca-accent)',
                            }} />
                            <span style={{ fontSize: 12, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--orca-text)' }}>
                                {ghUser.login}
                            </span>
                        </button>
                        {showDropdown && (
                            <div className="glass-card animate-fadeIn" style={{
                                position: 'absolute', top: '100%', right: 0, marginTop: 8,
                                padding: 8, minWidth: 190, zIndex: 200,
                                border: '1px solid var(--orca-border)',
                                background: 'var(--orca-bg-elevated)',
                            }}>
                                <div style={{
                                    padding: '7px 10px', fontSize: 12,
                                    color: 'var(--orca-text-muted)',
                                    borderBottom: '1px solid var(--orca-border)', marginBottom: 4,
                                }}>
                                    <div style={{ fontWeight: 700, color: 'var(--orca-text)', fontSize: 13 }}>{ghUser.name}</div>
                                    <div>@{ghUser.login}</div>
                                </div>
                                <button className="btn-ghost" onClick={handleLogout}
                                    style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 10px', fontSize: 12, color: 'var(--orca-red)' }}>
                                    <FiLogOut size={13} /> Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button className="btn-secondary" onClick={handleGitHubLogin}
                        style={{ padding: '5px 13px', fontSize: 12, gap: 6, borderColor: 'var(--orca-border-light)' }}>
                        <FiGithub size={14} /> Sign In
                    </button>
                )}
            </div>
        </nav>
    )
}
