import { useState, useRef, useEffect, useCallback } from 'react'
import {
    FiX, FiRefreshCw, FiMaximize2, FiMinimize2, FiExternalLink,
    FiMonitor, FiSmartphone, FiTablet, FiSliders, FiAlertTriangle,
    FiCheck, FiSun, FiMoon, FiDroplet, FiType, FiZoomIn, FiZoomOut
} from 'react-icons/fi'

// ── Utility: build srcdoc from files dict ─────────────────────────────────────

function buildSrcdoc(files, settings) {
    if (!files || Object.keys(files).length === 0) return ''

    // Prefer preview_html if set
    if (files.__preview_html) return injectSettings(files.__preview_html, settings)

    // Find index.html
    const htmlKey = Object.keys(files).find(k => k.endsWith('index.html')) || Object.keys(files).find(k => k.endsWith('.html'))
    if (!htmlKey) {
        // No HTML — show a code listing
        const fileList = Object.entries(files)
            .map(([k, v]) => `<h3>${k}</h3><pre>${escHtml(v.slice(0, 2000))}</pre>`)
            .join('')
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#0d1117;color:#e6edf3;font-family:monospace;padding:20px;}h3{color:#58a6ff;border-bottom:1px solid #30363d;padding-bottom:4px;}pre{background:#161b22;padding:12px;border-radius:8px;overflow:auto;font-size:12px;}</style></head><body>${fileList}</body></html>`
    }

    let html = files[htmlKey]

    // Inline CSS files
    const cssKey = Object.keys(files).find(k => k.endsWith('style.css') || k.endsWith('index.css') || k.endsWith('styles.css'))
    if (cssKey && !html.includes('<link')) {
        html = html.replace('</head>', `<style>${files[cssKey]}</style></head>`)
    }

    // Inline JS files
    const jsKey = Object.keys(files).find(k => k.endsWith('script.js') || k.endsWith('index.js') || k.endsWith('main.js') || k.endsWith('app.js'))
    if (jsKey && !html.includes('<script src')) {
        html = html.replace('</body>', `<script>${files[jsKey]}</script></body>`)
    }

    return injectSettings(html, settings)
}

function injectSettings(html, settings) {
    if (!html) return ''
    const overrides = `
<style id="__orca_preview_overrides">
:root {
    --preview-font-size: ${settings.fontSize}px !important;
    --preview-zoom: ${settings.zoom / 100} !important;
}
html { font-size: ${settings.fontSize}px !important; }
body {
    zoom: ${settings.zoom / 100} !important;
    ${settings.darkMode ? 'filter: invert(1) hue-rotate(180deg) !important;' : ''}
    ${settings.grayscale ? 'filter: grayscale(1) !important;' : ''}
    ${settings.highContrast ? 'filter: contrast(1.5) !important;' : ''}
}
</style>`
    if (html.includes('</head>')) return html.replace('</head>', overrides + '</head>')
    return overrides + html
}

function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Default Settings ──────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
    fontSize: 16,
    zoom: 100,
    darkMode: false,
    grayscale: false,
    highContrast: false,
    viewport: 'desktop',      // 'desktop' | 'tablet' | 'mobile'
    bgColor: '#ffffff',
}

const VIEWPORT_SIZES = {
    desktop: { width: '100%', height: '100%', label: 'Desktop' },
    tablet: { width: 768, height: 1024, label: 'iPad' },
    mobile: { width: 390, height: 844, label: 'iPhone' },
}

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * LivePreview — popup modal with close button and full UI controls.
 *
 * Props:
 *   files         {Object}   {filename: content, ...} for srcdoc rendering
 *   html          {string}   raw HTML string (alternative to files)
 *   src           {string}   URL to load in iframe (for dev server preview)
 *   onClose       {Function} callback to close the popup
 *   title         {string}   optional title shown in header
 */
export default function LivePreview({ files, html, src, onClose, title, defaultSettings }) {
    const iframeRef = useRef(null)
    const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...defaultSettings })
    const [showControls, setShowControls] = useState(false)
    const [fullscreen, setFullscreen] = useState(false)
    const [iframeStatus, setIframeStatus] = useState('loading') // loading | ok | error
    const [reloadKey, setReloadKey] = useState(0)
    const [srcdoc, setSrcdoc] = useState('')

    // Build srcdoc whenever files / html / settings change
    useEffect(() => {
        if (src) { setIframeStatus('loading'); return }  // URL mode — no srcdoc needed
        const doc = html
            ? injectSettings(html, settings)
            : buildSrcdoc(files, settings)
        setSrcdoc(doc)
        setIframeStatus(doc ? 'loading' : 'empty')
    }, [files, html, src, settings])

    const handleReload = useCallback(() => {
        setReloadKey(k => k + 1)
        setIframeStatus('loading')
    }, [])

    const updateSetting = useCallback((key, val) => {
        setSettings(prev => ({ ...prev, [key]: val }))
    }, [])

    const toggleSetting = useCallback((key) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }))
    }, [])

    // Viewport frame size
    const vp = VIEWPORT_SIZES[settings.viewport]
    const frameStyle = settings.viewport === 'desktop'
        ? { width: '100%', height: '100%' }
        : {
            width: vp.width,
            height: vp.height,
            margin: '0 auto',
            boxShadow: '0 0 0 2px var(--orca-border), 0 16px 48px rgba(0,0,0,0.4)',
            borderRadius: settings.viewport === 'mobile' ? 24 : 12,
            overflow: 'hidden',
            flexShrink: 0,
        }

    const overlayStyle = fullscreen
        ? { position: 'fixed', inset: 0, zIndex: 10000 }
        : {
            position: 'fixed',
            top: 60, left: '50%', transform: 'translateX(-50%)',
            width: 'min(1100px, 96vw)',
            height: 'calc(100vh - 80px)',
            zIndex: 1200,
        }

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, zIndex: 1199,
                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
                }}
            />

            {/* Popup */}
            <div style={{
                ...overlayStyle,
                display: 'flex', flexDirection: 'column',
                background: 'var(--orca-bg)',
                border: '1px solid var(--orca-border)',
                borderRadius: fullscreen ? 0 : 12,
                boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                overflow: 'hidden',
            }}>
                {/* ── Header ─────────────────────────────────────────────── */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px', flexShrink: 0,
                    background: 'var(--orca-bg-secondary)',
                    borderBottom: '1px solid var(--orca-border)',
                }}>
                    {/* Traffic-light dots */}
                    <div style={{ display: 'flex', gap: 6, marginRight: 4 }}>
                        <div onClick={onClose} style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', cursor: 'pointer' }} title="Close" />
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
                        <div onClick={() => setFullscreen(f => !f)} style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840', cursor: 'pointer' }} title={fullscreen ? 'Restore' : 'Maximise'} />
                    </div>

                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {title || 'Preview'}
                    </span>

                    {/* Status indicator */}
                    {iframeStatus === 'ok' && <span style={{ fontSize: 11, color: 'var(--orca-green)', display: 'flex', alignItems: 'center', gap: 3 }}><FiCheck size={11} /> Live</span>}
                    {iframeStatus === 'error' && <span style={{ fontSize: 11, color: 'var(--orca-orange)', display: 'flex', alignItems: 'center', gap: 3 }}><FiAlertTriangle size={11} /> Error</span>}

                    {/* Viewport */}
                    <div style={{ display: 'flex', gap: 2, background: 'var(--orca-bg-tertiary)', borderRadius: 6, padding: 3 }}>
                        {[
                            { id: 'desktop', icon: FiMonitor },
                            { id: 'tablet', icon: FiTablet },
                            { id: 'mobile', icon: FiSmartphone },
                            { id: 'multi', icon: () => <div style={{ display: 'flex', gap: 2 }}><FiMonitor size={11} /><FiTablet size={11} /><FiSmartphone size={11} /></div> },
                        ].map(({ id, icon: Icon }) => (
                            <button key={id} onClick={() => updateSetting('viewport', id)}
                                style={{
                                    background: settings.viewport === id ? 'var(--orca-accent)' : 'none',
                                    border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer',
                                    color: settings.viewport === id ? 'white' : 'var(--orca-text-muted)',
                                    display: 'flex', alignItems: 'center',
                                }} title={id}>
                                <Icon size={13} />
                            </button>
                        ))}
                    </div>

                    {/* Reload */}
                    <button onClick={handleReload}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--orca-text-muted)', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                        title="Reload">
                        <FiRefreshCw size={13} />
                    </button>

                    {/* Open in new tab */}
                    {src && (
                        <a href={src} target="_blank" rel="noopener noreferrer"
                            style={{ textDecoration: 'none', color: 'var(--orca-text-muted)', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                            <FiExternalLink size={13} />
                        </a>
                    )}

                    {/* UI Controls toggle */}
                    <button onClick={() => setShowControls(c => !c)}
                        style={{
                            background: showControls ? 'rgba(88,166,255,0.12)' : 'none',
                            border: '1px solid ' + (showControls ? 'var(--orca-accent)' : 'transparent'),
                            borderRadius: 6, cursor: 'pointer',
                            color: showControls ? 'var(--orca-accent)' : 'var(--orca-text-muted)',
                            padding: '4px 9px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
                        }} title="UI Controls">
                        <FiSliders size={13} /> Controls
                    </button>

                    {/* Fullscreen */}
                    <button onClick={() => setFullscreen(f => !f)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--orca-text-muted)', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                        {fullscreen ? <FiMinimize2 size={14} /> : <FiMaximize2 size={14} />}
                    </button>

                    {/* Close */}
                    <button onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--orca-text-muted)', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                        <FiX size={16} />
                    </button>
                </div>

                {/* ── UI Controls Panel ───────────────────────────────────── */}
                {showControls && (
                    <div style={{
                        flexShrink: 0, padding: '10px 16px',
                        background: 'var(--orca-bg-secondary)',
                        borderBottom: '1px solid var(--orca-border)',
                        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
                    }}>
                        {/* Font size */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FiType size={12} style={{ color: 'var(--orca-text-muted)' }} />
                            <span style={{ fontSize: 11, color: 'var(--orca-text-muted)', whiteSpace: 'nowrap' }}>Font</span>
                            <button onClick={() => updateSetting('fontSize', Math.max(10, settings.fontSize - 1))}
                                style={{ ...btnSmall }}><FiZoomOut size={11} /></button>
                            <span style={{ fontSize: 12, minWidth: 24, textAlign: 'center' }}>{settings.fontSize}</span>
                            <button onClick={() => updateSetting('fontSize', Math.min(28, settings.fontSize + 1))}
                                style={{ ...btnSmall }}><FiZoomIn size={11} /></button>
                        </div>

                        {/* Zoom */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FiMaximize2 size={12} style={{ color: 'var(--orca-text-muted)' }} />
                            <span style={{ fontSize: 11, color: 'var(--orca-text-muted)' }}>Zoom</span>
                            <input
                                type="range" min={50} max={150} value={settings.zoom}
                                onChange={e => updateSetting('zoom', Number(e.target.value))}
                                style={{ width: 80, accentColor: 'var(--orca-accent)' }} />
                            <span style={{ fontSize: 11, minWidth: 34 }}>{settings.zoom}%</span>
                        </div>

                        {/* Background color */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FiDroplet size={12} style={{ color: 'var(--orca-text-muted)' }} />
                            <span style={{ fontSize: 11, color: 'var(--orca-text-muted)' }}>BG</span>
                            <input type="color" value={settings.bgColor}
                                onChange={e => updateSetting('bgColor', e.target.value)}
                                style={{ width: 28, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }} />
                        </div>

                        {/* Toggles */}
                        {[
                            { key: 'darkMode', icon: FiMoon, label: 'Invert' },
                            { key: 'grayscale', icon: FiSun, label: 'Grayscale' },
                            { key: 'highContrast', icon: FiSliders, label: 'Hi-Contrast' },
                        ].map(({ key, icon: Icon, label }) => (
                            <button key={key} onClick={() => toggleSetting(key)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    background: settings[key] ? 'rgba(88,166,255,0.15)' : 'var(--orca-bg-tertiary)',
                                    border: '1px solid ' + (settings[key] ? 'var(--orca-accent)' : 'var(--orca-border)'),
                                    color: settings[key] ? 'var(--orca-accent)' : 'var(--orca-text-muted)',
                                    borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11,
                                }}>
                                <Icon size={11} /> {label}
                            </button>
                        ))}

                        {/* Reset */}
                        <button onClick={() => setSettings(DEFAULT_SETTINGS)}
                            style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--orca-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
                            Reset
                        </button>
                    </div>
                )}

                {/* ── Viewport container ──────────────────────────────────── */}
                <div style={{
                    flex: 1, overflow: 'auto',
                    background: settings.viewport === 'desktop' ? settings.bgColor : 'var(--orca-bg)',
                    display: 'flex', alignItems: settings.viewport === 'desktop' ? 'stretch' : 'flex-start',
                    justifyContent: settings.viewport === 'multi' ? 'flex-start' : 'center',
                    padding: settings.viewport === 'desktop' ? 0 : 24,
                    gap: settings.viewport === 'multi' ? 40 : 0,
                }}>
                    {settings.viewport === 'multi' ? (
                        <>
                            {['mobile', 'tablet', 'desktop'].map(vpMode => {
                                const mVP = VIEWPORT_SIZES[vpMode];
                                const mStyle = vpMode === 'desktop'
                                    ? { width: 1024, height: 768, flexShrink: 0, boxShadow: '0 0 0 2px var(--orca-border)', borderRadius: 12, overflow: 'hidden' } // Fixed desktop for multi
                                    : {
                                        width: mVP.width, height: mVP.height, flexShrink: 0,
                                        boxShadow: '0 0 0 2px var(--orca-border), 0 16px 48px rgba(0,0,0,0.4)',
                                        borderRadius: vpMode === 'mobile' ? 24 : 12, overflow: 'hidden',
                                    };
                                return (
                                    <div key={vpMode} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--orca-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{mVP.label}</div>
                                        <div style={{ ...mStyle, position: 'relative' }}>
                                            {(srcdoc || src) && (
                                                <iframe
                                                    key={reloadKey} srcDoc={src ? undefined : srcdoc} src={src || undefined} title={`Preview ${mVP.label}`}
                                                    onLoad={() => setIframeStatus('ok')} onError={() => setIframeStatus('error')}
                                                    style={{ width: '100%', height: '100%', border: 'none', background: settings.bgColor }}
                                                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                                                    allow="clipboard-write"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </>
                    ) : (
                        <div style={{ ...frameStyle, position: 'relative' }}>
                            {/* Empty state */}
                            {(iframeStatus === 'empty' || (!srcdoc && !src)) && (
                                <div style={{
                                    position: 'absolute', inset: 0, display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                                    gap: 12, background: 'var(--orca-bg)', color: 'var(--orca-text-muted)',
                                }}>
                                    <FiMonitor size={40} style={{ opacity: 0.25 }} />
                                    <p style={{ fontSize: 13 }}>No previewable content yet</p>
                                    <p style={{ fontSize: 11, opacity: 0.6 }}>Generate or open an app to see the live preview</p>
                                </div>
                            )}

                            {/* Error overlay */}
                            {iframeStatus === 'error' && (
                                <div style={{
                                    position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 10,
                                    background: 'rgba(240,136,62,0.12)', border: '1px solid rgba(240,136,62,0.35)',
                                    borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
                                }}>
                                    <FiAlertTriangle size={14} style={{ color: 'var(--orca-orange)', flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, color: 'var(--orca-orange)' }}>
                                        Preview failed to load. The app may have an error.
                                    </span>
                                    <button onClick={handleReload}
                                        style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--orca-orange)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                                        Retry
                                    </button>
                                </div>
                            )}

                            {/* Iframe */}
                            {(srcdoc || src) && (
                                <iframe
                                    key={reloadKey}
                                    ref={iframeRef}
                                    srcDoc={src ? undefined : srcdoc}
                                    src={src || undefined}
                                    title="Live Preview"
                                    onLoad={() => setIframeStatus('ok')}
                                    onError={() => setIframeStatus('error')}
                                    style={{
                                        width: '100%', height: '100%', border: 'none',
                                        background: settings.bgColor,
                                    }}
                                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                                    allow="clipboard-write"
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const btnSmall = {
    background: 'var(--orca-bg-tertiary)',
    border: '1px solid var(--orca-border)',
    borderRadius: 4, cursor: 'pointer',
    color: 'var(--orca-text-muted)',
    padding: '2px 6px',
    display: 'flex', alignItems: 'center',
}
