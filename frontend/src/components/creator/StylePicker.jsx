import { useState, useMemo } from 'react'
import { FiChevronLeft, FiArrowRight } from 'react-icons/fi'

const THEMES = [
    {
        id: 'glassmorphism',
        name: 'Glassmorphism',
        colors: ['#0f172a', '#7c6aff', '#06b6d4', '#ffffff20'],
        font: 'Inter',
        desc: 'Frosted glass cards, blur backdrop, dark bg',
        cardStyle: {
            background: 'rgba(124, 106, 255, 0.12)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(124, 106, 255, 0.25)',
            borderRadius: 16,
        },
        pageBg: '#0f172a',
        textColor: '#e2e8f0',
        accent: '#06b6d4',
    },
    {
        id: 'neumorphism',
        name: 'Neumorphism',
        colors: ['#e0e5ec', '#6366f1', '#a5b4fc', '#c7d2fe'],
        font: 'Poppins',
        desc: 'Soft shadow embossed light theme',
        cardStyle: {
            background: '#e0e5ec',
            boxShadow: '6px 6px 12px #b8bec7, -6px -6px 12px #ffffff',
            borderRadius: 16,
            border: 'none',
        },
        pageBg: '#e0e5ec',
        textColor: '#334155',
        accent: '#6366f1',
    },
    {
        id: 'bold-gradient',
        name: 'Bold Gradient',
        colors: ['#1a0533', '#f43f5e', '#ec4899', '#fbbf24'],
        font: 'Outfit',
        desc: 'Vivid gradient backgrounds, large typography',
        cardStyle: {
            background: 'linear-gradient(135deg, #f43f5e, #ec4899)',
            borderRadius: 16,
            border: 'none',
        },
        pageBg: '#1a0533',
        textColor: '#fce7f3',
        accent: '#fbbf24',
    },
    {
        id: 'minimal-clean',
        name: 'Minimal Clean',
        colors: ['#ffffff', '#111827', '#6b7280', '#e5e7eb'],
        font: 'DM Sans',
        desc: 'White space dominant, thin fonts, monochrome',
        cardStyle: {
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
        },
        pageBg: '#ffffff',
        textColor: '#111827',
        accent: '#111827',
    },
    {
        id: 'retro-brutalist',
        name: 'Retro/Brutalist',
        colors: ['#fffbe6', '#1a1a1a', '#ff5722', '#000000'],
        font: 'Space Grotesk',
        desc: 'Bold borders, raw typography, high contrast',
        cardStyle: {
            background: '#fffbe6',
            border: '3px solid #1a1a1a',
            borderRadius: 0,
            boxShadow: '4px 4px 0 #1a1a1a',
        },
        pageBg: '#fffbe6',
        textColor: '#1a1a1a',
        accent: '#ff5722',
    },
    {
        id: 'dark-neon',
        name: 'Dark Neon',
        colors: ['#0a0a0f', '#00ff88', '#00d4ff', '#ff00ff'],
        font: 'Syne',
        desc: 'Dark bg, neon accent colors, glow effects',
        cardStyle: {
            background: 'rgba(0, 255, 136, 0.06)',
            border: '1px solid rgba(0, 255, 136, 0.3)',
            borderRadius: 12,
            boxShadow: '0 0 20px rgba(0, 255, 136, 0.1)',
        },
        pageBg: '#0a0a0f',
        textColor: '#d4d4d8',
        accent: '#00ff88',
    },
]

const FONTS = [
    { name: 'Inter', label: 'Inter — Modern Sans' },
    { name: 'Poppins', label: 'Poppins — Geometric' },
    { name: 'Playfair Display', label: 'Playfair — Elegant Serif' },
    { name: 'Space Grotesk', label: 'Space Grotesk — Tech' },
    { name: 'DM Sans', label: 'DM Sans — Clean' },
    { name: 'Raleway', label: 'Raleway — Sleek' },
    { name: 'Syne', label: 'Syne — Bold Display' },
    { name: 'Outfit', label: 'Outfit — Variable' },
]

export default function StylePicker({ content, onGenerate, onBack, isGenerating }) {
    const [selectedTheme, setSelectedTheme] = useState('glassmorphism')
    const [primary, setPrimary] = useState('#7c6aff')
    const [secondary, setSecondary] = useState('#1e1b4b')
    const [accent, setAccent] = useState('#06b6d4')
    const [font, setFont] = useState('Inter')
    const [density, setDensity] = useState('balanced')

    // Sync colors when theme changes
    const handleThemeSelect = (theme) => {
        setSelectedTheme(theme.id)
        setPrimary(theme.colors[1])
        setSecondary(theme.colors[0])
        setAccent(theme.accent || theme.colors[2])
        setFont(theme.font)
    }

    const designTokens = useMemo(() => ({
        theme: selectedTheme,
        primary,
        secondary,
        accent,
        font,
        density,
    }), [selectedTheme, primary, secondary, accent, font, density])

    return (
        <div className="style-picker">
            <div className="style-picker-header">
                <button className="style-picker-back" onClick={onBack}>
                    <FiChevronLeft size={16} /> Regenerate Content
                </button>
                <h2>Choose Your Design Theme</h2>
                <p>Select a visual style and customize colors, fonts, and layout density</p>
            </div>

            {/* Theme Cards */}
            <div className="style-picker-themes">
                {THEMES.map(theme => (
                    <div
                        key={theme.id}
                        className={`style-picker-theme-card ${selectedTheme === theme.id ? 'selected' : ''}`}
                        onClick={() => handleThemeSelect(theme)}
                    >
                        {/* Mini Preview */}
                        <div className="style-picker-preview" style={{ background: theme.pageBg }}>
                            <div className="style-picker-preview-nav" style={{
                                background: theme.cardStyle.background,
                                borderBottom: `1px solid ${theme.accent}33`,
                            }}>
                                <div className="style-picker-preview-dots">
                                    <span style={{ background: theme.colors[1] }} />
                                    <span style={{ background: theme.accent }} />
                                    <span style={{ background: theme.colors[2] }} />
                                </div>
                            </div>
                            <div className="style-picker-preview-body">
                                <div className="style-picker-preview-card" style={{
                                    ...theme.cardStyle,
                                    padding: '8px 10px',
                                    margin: '4px',
                                }}>
                                    <div style={{ width: '60%', height: 6, background: theme.accent, borderRadius: 3, marginBottom: 4 }} />
                                    <div style={{ width: '80%', height: 4, background: `${theme.textColor}40`, borderRadius: 2, marginBottom: 3 }} />
                                    <div style={{ width: '40%', height: 4, background: `${theme.textColor}30`, borderRadius: 2 }} />
                                </div>
                                <div style={{ display: 'flex', gap: 4, padding: '0 4px' }}>
                                    <div className="style-picker-preview-card" style={{
                                        ...theme.cardStyle,
                                        padding: '6px',
                                        flex: 1,
                                    }}>
                                        <div style={{ width: '100%', height: 4, background: `${theme.textColor}30`, borderRadius: 2 }} />
                                    </div>
                                    <div className="style-picker-preview-card" style={{
                                        ...theme.cardStyle,
                                        padding: '6px',
                                        flex: 1,
                                    }}>
                                        <div style={{ width: '100%', height: 4, background: `${theme.textColor}30`, borderRadius: 2 }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Theme Info */}
                        <div className="style-picker-theme-info">
                            <span className="style-picker-theme-name">{theme.name}</span>
                            <span className="style-picker-theme-desc">{theme.desc}</span>
                            <div className="style-picker-swatches">
                                {theme.colors.map((color, i) => (
                                    <span key={i} className="style-picker-swatch" style={{ background: color }} />
                                ))}
                            </div>
                            <span className="style-picker-font-label">Font: {theme.font}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Customizer */}
            <div className="style-picker-customizer">
                <div className="style-picker-colors">
                    <h3>Customize Colors</h3>
                    <div className="style-picker-color-row">
                        <label>
                            <span>Primary</span>
                            <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} />
                            <span className="style-picker-color-hex">{primary}</span>
                        </label>
                        <label>
                            <span>Secondary</span>
                            <input type="color" value={secondary} onChange={e => setSecondary(e.target.value)} />
                            <span className="style-picker-color-hex">{secondary}</span>
                        </label>
                        <label>
                            <span>Accent</span>
                            <input type="color" value={accent} onChange={e => setAccent(e.target.value)} />
                            <span className="style-picker-color-hex">{accent}</span>
                        </label>
                    </div>
                </div>

                <div className="style-picker-font">
                    <h3>Font Pairing</h3>
                    <select value={font} onChange={e => setFont(e.target.value)}>
                        {FONTS.map(f => (
                            <option key={f.name} value={f.name}>{f.label}</option>
                        ))}
                    </select>
                </div>

                <div className="style-picker-density">
                    <h3>Layout Density</h3>
                    <div className="style-picker-density-toggle">
                        {['spacious', 'balanced', 'compact'].map(d => (
                            <button
                                key={d}
                                className={`style-picker-density-btn ${density === d ? 'active' : ''}`}
                                onClick={() => setDensity(d)}
                            >
                                {d.charAt(0).toUpperCase() + d.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Generate Button */}
            <button
                className="style-picker-generate-btn"
                onClick={() => onGenerate(designTokens)}
                disabled={isGenerating}
            >
                {isGenerating ? 'Generating...' : 'Generate App'}
                {!isGenerating && <FiArrowRight size={18} />}
            </button>
        </div>
    )
}
