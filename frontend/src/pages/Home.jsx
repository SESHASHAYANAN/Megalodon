import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiSearch, FiCode, FiBox, FiCpu, FiArrowRight, FiStar, FiGitBranch } from 'react-icons/fi'

const quickActions = [
    {
        icon: FiCode, title: 'Explore Repos', desc: 'Search & understand any GitHub repo with AI',
        color: 'var(--orca-accent)', path: '/explorer',
    },
    {
        icon: FiBox, title: 'Create App', desc: 'Describe your idea, get a working app instantly',
        color: 'var(--orca-purple)', path: '/creator',
    },
    {
        icon: FiCpu, title: 'AI Assistant', desc: 'Ask anything about code, architecture & more',
        color: 'var(--orca-cyan)', path: null,
    },
]

const trending = [
    { name: 'facebook/react', desc: 'The library for web and native user interfaces', stars: '224k', lang: 'JavaScript' },
    { name: 'microsoft/vscode', desc: 'Visual Studio Code', stars: '166k', lang: 'TypeScript' },
    { name: 'openai/whisper', desc: 'Robust Speech Recognition via Large-Scale Weak Supervision', stars: '69k', lang: 'Python' },
    { name: 'vercel/next.js', desc: 'The React Framework', stars: '128k', lang: 'JavaScript' },
    { name: 'denoland/deno', desc: 'A modern runtime for JavaScript and TypeScript', stars: '97k', lang: 'Rust' },
    { name: 'tailwindlabs/tailwindcss', desc: 'A utility-first CSS framework', stars: '83k', lang: 'CSS' },
]

export default function Home() {
    const [search, setSearch] = useState('')
    const navigate = useNavigate()

    const handleSearch = (e) => {
        e.preventDefault()
        if (search.trim()) navigate(`/explorer?q=${encodeURIComponent(search.trim())}`)
    }

    return (
        <div style={{ height: '100%', overflow: 'auto' }}>
            {/* Hero Section */}
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '80px 20px 50px',
                position: 'relative', overflow: 'hidden',
            }}>
                {/* Background glow */}
                <div style={{
                    position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
                    width: 700, height: 500, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(124,106,255,0.12) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', top: 100, left: '20%',
                    width: 300, height: 300, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(188,140,255,0.06) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div className="animate-fadeIn" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                    {/* Logo */}
                    <div className="animate-float" style={{
                        width: 76, height: 76, borderRadius: 20, margin: '0 auto 24px',
                        background: 'linear-gradient(135deg, #7c6aff, #bc8cff)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 34, fontWeight: 900, color: 'white',
                        boxShadow: '0 8px 40px rgba(124,106,255,0.45)',
                    }}>⬡</div>

                    <h1 style={{
                        fontSize: 42, fontWeight: 800, letterSpacing: '-1px', marginBottom: 12,
                        background: 'linear-gradient(135deg, var(--orca-gradient-start), var(--orca-gradient-end))',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                        Welcome to ORCA
                    </h1>
                    <p style={{ fontSize: 18, color: 'var(--orca-text-secondary)', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.6 }}>
                        Search any GitHub repo, understand it instantly with AI, generate apps, and deploy — all in one tab.
                    </p>

                    {/* Search Bar */}
                    <form onSubmit={handleSearch} style={{
                        display: 'flex', maxWidth: 600, margin: '0 auto',
                        background: 'var(--orca-bg-secondary)', borderRadius: 12,
                        border: '1px solid var(--orca-border)', overflow: 'hidden',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 30px rgba(124,106,255,0.15)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: 'var(--orca-text-muted)' }}>
                            <FiSearch size={18} />
                        </div>
                        <input
                            className="input-field"
                            placeholder="Search repos... e.g. facebook/react or 'machine learning'"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ border: 'none', borderRadius: 0, background: 'transparent', padding: '14px 0' }}
                        />
                        <button type="submit" className="btn-primary" style={{ borderRadius: 0, padding: '14px 24px' }}>
                            <FiArrowRight size={16} />
                        </button>
                    </form>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="animate-fadeIn" style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px 40px' }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--orca-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
                    Quick Actions
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {quickActions.map(({ icon: Icon, title, desc, color, path }, i) => (
                        <div
                            key={i}
                            className="glass-card"
                            onClick={() => path && navigate(path)}
                            style={{ padding: 24, cursor: 'pointer', animationDelay: `${i * 0.1}s` }}
                        >
                            <div style={{
                                width: 44, height: 44, borderRadius: 10,
                                background: `${color}15`, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                            }}>
                                <Icon size={22} style={{ color }} />
                            </div>
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{title}</h3>
                            <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)', lineHeight: 1.5 }}>{desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Trending Repos */}
            <div className="animate-fadeIn" style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px 60px' }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--orca-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
                    Trending Repositories
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {trending.map((repo, i) => (
                        <div
                            key={i}
                            className="glass-card"
                            onClick={() => navigate(`/explorer?q=${repo.name}`)}
                            style={{ padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FiGitBranch size={14} style={{ color: 'var(--orca-accent)' }} />
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--orca-accent)' }}>{repo.name}</span>
                            </div>
                            <p style={{ fontSize: 13, color: 'var(--orca-text-secondary)', lineHeight: 1.4 }}>{repo.desc}</p>
                            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--orca-text-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <FiStar size={12} /> {repo.stars}
                                </span>
                                <span className="badge">{repo.lang}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
