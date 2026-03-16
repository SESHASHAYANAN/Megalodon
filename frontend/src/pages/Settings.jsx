import { useState, useEffect } from 'react'
import { FiMoon, FiSun, FiCpu, FiGithub, FiInfo, FiUser, FiLogOut, FiServer, FiCloud } from 'react-icons/fi'
import { getGitHubUser, getAuthUrl, logoutGitHub } from '../services/api'

const sections = [
    { id: 'appearance', icon: FiMoon, label: 'Appearance' },
    { id: 'ai', icon: FiCpu, label: 'AI Settings' },
    { id: 'github', icon: FiGithub, label: 'GitHub' },
    { id: 'about', icon: FiInfo, label: 'About' },
]

// Tier badge helper
function Tier({ label, color }) {
    return (
        <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 20,
            fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
            background: `${color}18`, color,
            border: `1px solid ${color}33`,
        }}>{label}</span>
    )
}

// Model info row
function ModelRow({ icon: Icon, tier, tierColor, name, desc }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 14,
            padding: '14px 0', borderBottom: '1px solid var(--orca-border)',
        }}>
            <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: `${tierColor}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Icon size={17} style={{ color: tierColor }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--orca-text)' }}>{name}</span>
                    <Tier label={tier} color={tierColor} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--orca-text-secondary)', lineHeight: 1.5, margin: 0 }}>{desc}</p>
            </div>
        </div>
    )
}

export default function Settings() {
    const [activeSection, setActiveSection] = useState('appearance')
    const [theme, setTheme] = useState('dark')
    const [ghUser, setGhUser] = useState(null)
    const [ghLoading, setGhLoading] = useState(true)

    useEffect(() => {
        getGitHubUser()
            .then(data => { if (data.authenticated) setGhUser(data) })
            .catch(() => { })
            .finally(() => setGhLoading(false))
    }, [])

    const handleGitHubLogin = () => { window.location.href = getAuthUrl() }

    const handleLogout = async () => {
        try { await logoutGitHub() } catch { }
        setGhUser(null)
    }

    return (
        <div style={{ display: 'flex', height: '100%' }}>
            {/* Left nav */}
            <div style={{
                width: 240, flexShrink: 0, padding: '20px 8px',
                background: 'var(--orca-bg-secondary)', borderRight: '1px solid var(--orca-border)',
            }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--orca-text-muted)', textTransform: 'uppercase', letterSpacing: 1, padding: '0 12px', marginBottom: 12 }}>
                    Settings
                </div>
                {sections.map(({ id, icon: Icon, label }) => (
                    <div key={id} onClick={() => setActiveSection(id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                            fontSize: 14, marginBottom: 2,
                            background: activeSection === id ? 'rgba(88,166,255,0.1)' : 'transparent',
                            color: activeSection === id ? 'var(--orca-text)' : 'var(--orca-text-secondary)',
                            fontWeight: activeSection === id ? 500 : 400,
                        }}>
                        <Icon size={16} />
                        {label}
                    </div>
                ))}
            </div>

            {/* Right content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px' }}>
                <div className="animate-fadeIn" style={{ maxWidth: 600 }}>

                    {/* ── Appearance ── */}
                    {activeSection === 'appearance' && (
                        <>
                            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Appearance</h2>
                            <div className="glass-card" style={{ padding: 24 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Theme</h3>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    {[{ id: 'dark', icon: FiMoon, label: 'Dark' }, { id: 'light', icon: FiSun, label: 'Light' }].map(t => (
                                        <div key={t.id} className="glass-card" onClick={() => setTheme(t.id)}
                                            style={{
                                                padding: 20, cursor: 'pointer', textAlign: 'center', flex: 1,
                                                borderColor: theme === t.id ? 'var(--orca-accent)' : 'var(--orca-border)',
                                            }}>
                                            <t.icon size={24} style={{ color: theme === t.id ? 'var(--orca-accent)' : 'var(--orca-text-muted)', marginBottom: 8 }} />
                                            <div style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── AI Settings ── */}
                    {activeSection === 'ai' && (
                        <>
                            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>AI Settings</h2>

                            {/* Model stack info */}
                            <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Model Stack</h3>
                                <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                                    ORCA uses a two-tier routing system: fast local inference for all internal
                                    reasoning, and a powerful cloud model for final user-facing responses.
                                </p>

                                <ModelRow
                                    icon={FiServer}
                                    tier="Tier 1 · Local"
                                    tierColor="var(--orca-cyan)"
                                    name="Ollama gemma3:4b  →  gemma3:1b"
                                    desc="Runs 100% offline on your machine. Handles file reading, code analysis, ReAct loop, tool calls, and dependency mapping. 128 K context window."
                                />
                                <ModelRow
                                    icon={FiCloud}
                                    tier="Tier 2 · Cloud"
                                    tierColor="var(--orca-accent)"
                                    name="deepseek/deepseek-r1-0528:free"
                                    desc="OpenRouter free model with chain-of-thought reasoning and 128 K context. Used only for the final polished response streamed to you. Fallback: qwen/qwen3-235b-a22b:free."
                                />

                                <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, background: 'var(--orca-bg)', border: '1px solid var(--orca-border)' }}>
                                    <p style={{ fontSize: 12, color: 'var(--orca-text-muted)', margin: 0, lineHeight: 1.6 }}>
                                        <strong style={{ color: 'var(--orca-text-secondary)' }}>OpenRouter API key</strong> is configured in{' '}
                                        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--orca-cyan)', fontSize: 11 }}>backend/.env</code>{' '}
                                        as <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--orca-cyan)', fontSize: 11 }}>OPENROUTER_API_KEY</code>.
                                        Keep it out of source control.
                                    </p>
                                </div>
                            </div>

                            {/* Ollama status hint */}
                            <div className="glass-card" style={{ padding: 24 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Local Ollama Status</h3>
                                <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                                    Ollama must be running for all agent features. If it's not running, start it from a terminal:
                                </p>
                                <code style={{
                                    display: 'block', padding: '10px 14px', borderRadius: 8,
                                    background: 'var(--orca-bg)', border: '1px solid var(--orca-border)',
                                    fontFamily: 'var(--font-mono)', fontSize: 13,
                                    color: 'var(--orca-cyan)',
                                }}>
                                    ollama serve
                                </code>
                            </div>
                        </>
                    )}

                    {/* ── GitHub ── */}
                    {activeSection === 'github' && (
                        <>
                            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>GitHub</h2>
                            <div className="glass-card" style={{ padding: 24 }}>
                                {ghLoading ? (
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <div className="spinner" />
                                        <span style={{ fontSize: 13, color: 'var(--orca-text-secondary)' }}>Checking session…</span>
                                    </div>
                                ) : ghUser ? (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                                            <img
                                                src={ghUser.avatar_url} alt={ghUser.login}
                                                style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid var(--orca-accent)' }}
                                            />
                                            <div>
                                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{ghUser.name || ghUser.login}</h3>
                                                <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)' }}>@{ghUser.login}</p>
                                            </div>
                                        </div>
                                        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', marginBottom: 20 }}>
                                            <p style={{ fontSize: 13, color: '#3fb950', margin: 0 }}>
                                                ✓ Connected — you can push changes and deploy directly to GitHub.
                                            </p>
                                        </div>
                                        <button className="btn-ghost" onClick={handleLogout}
                                            style={{ color: 'var(--orca-red)', gap: 6 }}>
                                            <FiLogOut size={14} /> Sign Out
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--orca-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FiUser size={22} style={{ color: 'var(--orca-text-secondary)' }} />
                                            </div>
                                            <div>
                                                <h3 style={{ fontSize: 14, fontWeight: 600 }}>Not connected</h3>
                                                <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)' }}>Connect your GitHub account to push changes and deploy projects.</p>
                                            </div>
                                        </div>
                                        <button className="btn-primary" onClick={handleGitHubLogin}>
                                            <FiGithub size={14} /> Connect GitHub
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── About ── */}
                    {activeSection === 'about' && (
                        <>
                            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>About ORCA</h2>
                            <div className="glass-card" style={{ padding: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 10,
                                        background: 'linear-gradient(135deg, var(--orca-gradient-start), var(--orca-gradient-end))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 18, fontWeight: 800, color: 'white',
                                    }}>O</div>
                                    <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>ORCA v5.0.0</h3>
                                        <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)' }}>GitHub Exploration &amp; AI Development Assistant</p>
                                    </div>
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
                                    ORCA helps you search, understand, and learn from any GitHub repository using AI.
                                    Generate full applications from ideas, preview them live, and deploy directly to GitHub.
                                </p>
                                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--orca-bg)', border: '1px solid var(--orca-border)' }}>
                                    <p style={{ fontSize: 12, color: 'var(--orca-text-muted)', margin: 0, lineHeight: 1.6 }}>
                                        <strong style={{ color: 'var(--orca-text-secondary)' }}>Inference:</strong> Ollama (local) + OpenRouter (cloud) ·{' '}
                                        <strong style={{ color: 'var(--orca-text-secondary)' }}>Backend:</strong> FastAPI 5.0 ·{' '}
                                        <strong style={{ color: 'var(--orca-text-secondary)' }}>Frontend:</strong> React + Vite
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                </div>
            </div>
        </div>
    )
}
