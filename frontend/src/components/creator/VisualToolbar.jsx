import { useState, useCallback, useRef, useEffect } from 'react'
import { FiMousePointer, FiType, FiDroplet, FiBox, FiX, FiMove } from 'react-icons/fi'
import ComponentPalette from './ComponentPalette'

const TOOLS = [
    { id: 'select', icon: FiMousePointer, label: 'Select Element', emoji: null },
    { id: 'text', icon: FiType, label: 'Edit Text', emoji: null },
    { id: 'color', icon: FiDroplet, label: 'Color Picker', emoji: null },
    { id: 'font', icon: null, label: 'Font Picker', emoji: 'Aa' },
    { id: 'spacing', icon: null, label: 'Spacing', emoji: '⊞' },
    { id: 'border', icon: null, label: 'Border', emoji: '▢' },
    { id: 'animation', icon: null, label: 'Animation', emoji: '▷' },
    { id: 'shadow', icon: null, label: 'Shadow', emoji: '◻' },
    { id: 'components', icon: FiBox, label: 'Components', emoji: null },
]

const GOOGLE_FONTS = [
    'Inter', 'Outfit', 'Poppins', 'Roboto', 'Montserrat', 'Lato',
    'Raleway', 'Nunito', 'Playfair Display', 'Space Grotesk', 'DM Sans', 'Sora'
]

const CSS_ANIMATIONS = [
    { name: 'fadeIn', css: '@keyframes fadeIn{from{opacity:0}to{opacity:1}} .anim-fadeIn{animation:fadeIn 0.6s ease forwards}' },
    { name: 'slideUp', css: '@keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}} .anim-slideUp{animation:slideUp 0.6s ease forwards}' },
    { name: 'slideLeft', css: '@keyframes slideLeft{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:translateX(0)}} .anim-slideLeft{animation:slideLeft 0.6s ease forwards}' },
    { name: 'bounce', css: '@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}} .anim-bounce{animation:bounce 0.8s ease infinite}' },
    { name: 'zoomIn', css: '@keyframes zoomIn{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}} .anim-zoomIn{animation:zoomIn 0.5s ease forwards}' },
]

export default function VisualToolbar({ iframeRef, htmlContent, setHtmlContent }) {
    const [activeTool, setActiveTool] = useState(null)
    const [showPalette, setShowPalette] = useState(false)
    const cleanupRef = useRef(null)

    // Draggable state
    const [pos, setPos] = useState({ x: -1, y: -1 })
    const [isDragging, setIsDragging] = useState(false)
    const dragStart = useRef({ x: 0, y: 0 })
    const toolbarRef = useRef(null)

    // Tool-specific state
    const [showFontPicker, setShowFontPicker] = useState(false)
    const [showAnimPicker, setShowAnimPicker] = useState(false)
    const [shadowValues, setShadowValues] = useState({ x: 4, y: 4, blur: 12, spread: 0, color: '#00000040' })
    const [showShadowPanel, setShowShadowPanel] = useState(false)
    const [borderValues, setBorderValues] = useState({ width: 2, style: 'solid', color: '#6366f1', radius: 8 })
    const [showBorderPanel, setShowBorderPanel] = useState(false)

    // Initialize position
    useEffect(() => {
        if (pos.x === -1 && toolbarRef.current) {
            const rect = toolbarRef.current.parentElement?.getBoundingClientRect()
            if (rect) setPos({ x: rect.right - 60, y: rect.top + 80 })
        }
    }, [pos.x])

    // Drag handlers
    const handleDragStart = useCallback((e) => {
        e.preventDefault()
        setIsDragging(true)
        dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }

        const onMove = (e) => {
            setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
        }
        const onUp = () => {
            setIsDragging(false)
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
    }, [pos])

    // Send postMessage to the iframe
    const sendBridgeMessage = useCallback((action, payload = {}) => {
        iframeRef?.current?.contentWindow?.postMessage({ action, ...payload }, '*')
    }, [iframeRef])

    const cleanupTool = useCallback(() => {
        if (cleanupRef.current) {
            cleanupRef.current()
            cleanupRef.current = null
        }
        setShowFontPicker(false)
        setShowAnimPicker(false)
        setShowShadowPanel(false)
        setShowBorderPanel(false)
    }, [])

    // ── SELECT TOOL
    const activateSelect = useCallback(() => {
        sendBridgeMessage('ACTIVATE_SELECT')
        cleanupRef.current = () => sendBridgeMessage('DEACTIVATE_SELECT')
    }, [sendBridgeMessage])

    // ── TEXT TOOL
    const activateText = useCallback(() => {
        sendBridgeMessage('ACTIVATE_TEXT_TOOL')
        cleanupRef.current = () => sendBridgeMessage('DEACTIVATE_TEXT_TOOL')
    }, [sendBridgeMessage])

    // ── COLOR TOOL
    const activateColor = useCallback(() => {
        sendBridgeMessage('ACTIVATE_COLOR_TOOL')
        cleanupRef.current = () => sendBridgeMessage('DEACTIVATE_COLOR_TOOL')
    }, [sendBridgeMessage])

    // ── FONT TOOL
    const activateFont = useCallback(() => {
        sendBridgeMessage('ACTIVATE_FONT_TOOL')
        setShowFontPicker(true)
        cleanupRef.current = () => sendBridgeMessage('DEACTIVATE_FONT_TOOL')
    }, [sendBridgeMessage])

    const applyFont = useCallback((fontName) => {
        sendBridgeMessage('APPLY_FONT', { font: fontName })
        // Also patch HTML string
        setHtmlContent(prev => {
            if (!prev) return prev
            // Add Google Font link if not present
            const fontLink = `<link href="https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@300;400;600;700&display=swap" rel="stylesheet">`
            let html = prev
            if (!html.includes(fontName.replace(/ /g, '+'))) {
                html = html.replace('</head>', `${fontLink}\n</head>`)
            }
            return html
        })
    }, [sendBridgeMessage, setHtmlContent])

    // ── SPACING TOOL
    const activateSpacing = useCallback(() => {
        sendBridgeMessage('ACTIVATE_SPACING_TOOL')
        cleanupRef.current = () => sendBridgeMessage('DEACTIVATE_SPACING_TOOL')
    }, [sendBridgeMessage])

    // ── BORDER TOOL
    const activateBorder = useCallback(() => {
        sendBridgeMessage('ACTIVATE_BORDER_TOOL')
        setShowBorderPanel(true)
        cleanupRef.current = () => sendBridgeMessage('DEACTIVATE_BORDER_TOOL')
    }, [sendBridgeMessage])

    const applyBorder = useCallback((vals) => {
        setBorderValues(vals)
        sendBridgeMessage('APPLY_BORDER', { border: vals })
    }, [sendBridgeMessage])

    // ── ANIMATION TOOL
    const activateAnimation = useCallback(() => {
        sendBridgeMessage('ACTIVATE_ANIMATION_TOOL')
        setShowAnimPicker(true)
        cleanupRef.current = () => sendBridgeMessage('DEACTIVATE_ANIMATION_TOOL')
    }, [sendBridgeMessage])

    const applyAnimation = useCallback((anim) => {
        sendBridgeMessage('APPLY_ANIMATION', { animation: anim })
        // Inject animation CSS into HTML
        setHtmlContent(prev => {
            if (!prev || prev.includes(anim.css)) return prev
            return prev.replace('</style>', `\n${anim.css}\n</style>`)
        })
    }, [sendBridgeMessage, setHtmlContent])

    // ── SHADOW TOOL
    const activateShadow = useCallback(() => {
        sendBridgeMessage('ACTIVATE_SHADOW_TOOL')
        setShowShadowPanel(true)
        cleanupRef.current = () => sendBridgeMessage('DEACTIVATE_SHADOW_TOOL')
    }, [sendBridgeMessage])

    const applyShadow = useCallback((vals) => {
        setShadowValues(vals)
        const shadowStr = `${vals.x}px ${vals.y}px ${vals.blur}px ${vals.spread}px ${vals.color}`
        sendBridgeMessage('APPLY_SHADOW', { shadow: shadowStr })
    }, [sendBridgeMessage])

    // ── COMPONENT TOOL
    const handleComponentInsert = useCallback((html) => {
        sendBridgeMessage('ACTIVATE_INSERT_COMPONENT', { html })
        setShowPalette(false)
        setActiveTool(null)
    }, [sendBridgeMessage])

    const handleToolClick = useCallback((toolId) => {
        cleanupTool()
        if (activeTool === toolId) {
            setActiveTool(null)
            setShowPalette(false)
            return
        }
        setActiveTool(toolId)
        setShowPalette(false)

        switch (toolId) {
            case 'select': activateSelect(); break
            case 'text': activateText(); break
            case 'color': activateColor(); break
            case 'font': activateFont(); break
            case 'spacing': activateSpacing(); break
            case 'border': activateBorder(); break
            case 'animation': activateAnimation(); break
            case 'shadow': activateShadow(); break
            case 'components': setShowPalette(true); break
        }
    }, [activeTool, cleanupTool, activateSelect, activateText, activateColor, activateFont, activateSpacing, activateBorder, activateAnimation, activateShadow])

    useEffect(() => {
        return () => cleanupTool()
    }, [cleanupTool])

    // Listen for messages back from the iframe bridge
    useEffect(() => {
        const handleMessage = (e) => {
            const data = e.data
            if (!data) return

            // Text change
            if (data.action === 'TEXT_CHANGED') {
                const { selector, newText } = data
                setHtmlContent(prev => {
                    const parser = new DOMParser()
                    const doc = parser.parseFromString(prev, 'text/html')
                    const el = doc.querySelector(selector)
                    if (el) { el.textContent = newText; return doc.documentElement.outerHTML }
                    return prev
                })
            }

            // Color change
            if (data.action === 'COLOR_CHANGED') {
                const { selector, color } = data
                setHtmlContent(prev => {
                    const parser = new DOMParser()
                    const doc = parser.parseFromString(prev, 'text/html')
                    const el = doc.querySelector(selector)
                    if (el) {
                        el.style.color = color
                        el.style.backgroundColor = color
                        return doc.documentElement.outerHTML
                    }
                    return prev
                })
            }

            // Font change
            if (data.action === 'FONT_CHANGED') {
                const { selector, font } = data
                setHtmlContent(prev => {
                    const parser = new DOMParser()
                    const doc = parser.parseFromString(prev, 'text/html')
                    const el = doc.querySelector(selector)
                    if (el) { el.style.fontFamily = `'${font}', sans-serif`; return doc.documentElement.outerHTML }
                    return prev
                })
            }

            // Spacing change
            if (data.action === 'SPACING_CHANGED') {
                const { selector, property, value } = data
                setHtmlContent(prev => {
                    const parser = new DOMParser()
                    const doc = parser.parseFromString(prev, 'text/html')
                    const el = doc.querySelector(selector)
                    if (el) { el.style[property] = value; return doc.documentElement.outerHTML }
                    return prev
                })
            }

            // Border change
            if (data.action === 'BORDER_CHANGED') {
                const { selector, border } = data
                setHtmlContent(prev => {
                    const parser = new DOMParser()
                    const doc = parser.parseFromString(prev, 'text/html')
                    const el = doc.querySelector(selector)
                    if (el) {
                        el.style.border = `${border.width}px ${border.style} ${border.color}`
                        el.style.borderRadius = `${border.radius}px`
                        return doc.documentElement.outerHTML
                    }
                    return prev
                })
            }

            // Animation applied
            if (data.action === 'ANIMATION_APPLIED') {
                const { selector, className } = data
                setHtmlContent(prev => {
                    const parser = new DOMParser()
                    const doc = parser.parseFromString(prev, 'text/html')
                    const el = doc.querySelector(selector)
                    if (el) { el.classList.add(className); return doc.documentElement.outerHTML }
                    return prev
                })
            }

            // Shadow change
            if (data.action === 'SHADOW_CHANGED') {
                const { selector, shadow } = data
                setHtmlContent(prev => {
                    const parser = new DOMParser()
                    const doc = parser.parseFromString(prev, 'text/html')
                    const el = doc.querySelector(selector)
                    if (el) { el.style.boxShadow = shadow; return doc.documentElement.outerHTML }
                    return prev
                })
            }

            // Component inserted
            if (data.action === 'COMPONENT_INSERTED') {
                const { htmlAfterInsert } = data
                setHtmlContent(htmlAfterInsert)
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [setHtmlContent])

    const toolbarStyle = pos.x >= 0 ? {
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 99999,
        cursor: isDragging ? 'grabbing' : 'default',
    } : { zIndex: 9999 }

    return (
        <div className="creator-visual-toolbar creator-visual-toolbar-draggable" ref={toolbarRef} style={toolbarStyle}>
            {/* Drag handle */}
            <div className="creator-visual-toolbar-drag-handle" onMouseDown={handleDragStart} title="Drag to move">
                <FiMove size={14} />
            </div>

            {TOOLS.map(tool => {
                const Icon = tool.icon
                return (
                    <button
                        key={tool.id}
                        className={`creator-visual-tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                        onClick={() => handleToolClick(tool.id)}
                        title={tool.label}
                    >
                        {Icon ? <Icon size={16} /> : <span style={{ fontSize: 13, fontWeight: 700 }}>{tool.emoji}</span>}
                    </button>
                )
            })}

            {activeTool && activeTool !== 'components' && (
                <button
                    className="creator-visual-tool-btn cancel"
                    onClick={() => { cleanupTool(); setActiveTool(null); setShowPalette(false) }}
                    title="Cancel Tool"
                >
                    <FiX size={14} />
                </button>
            )}

            {/* Font Picker Panel */}
            {showFontPicker && (
                <div className="visual-tool-popover font-picker-popover">
                    <div className="visual-tool-popover-header">
                        <span>Select Font</span>
                        <button className="creator-icon-btn" onClick={() => setShowFontPicker(false)}><FiX size={12} /></button>
                    </div>
                    <div className="font-picker-grid">
                        {GOOGLE_FONTS.map(font => (
                            <button
                                key={font}
                                className="font-picker-item"
                                onClick={() => applyFont(font)}
                                style={{ fontFamily: `'${font}', sans-serif` }}
                            >
                                {font}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Animation Picker */}
            {showAnimPicker && (
                <div className="visual-tool-popover anim-picker-popover">
                    <div className="visual-tool-popover-header">
                        <span>Choose Animation</span>
                        <button className="creator-icon-btn" onClick={() => setShowAnimPicker(false)}><FiX size={12} /></button>
                    </div>
                    <div className="anim-picker-list">
                        {CSS_ANIMATIONS.map(anim => (
                            <button key={anim.name} className="anim-picker-item" onClick={() => applyAnimation(anim)}>
                                {anim.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Shadow Panel */}
            {showShadowPanel && (
                <div className="visual-tool-popover shadow-panel-popover">
                    <div className="visual-tool-popover-header">
                        <span>Box Shadow</span>
                        <button className="creator-icon-btn" onClick={() => setShowShadowPanel(false)}><FiX size={12} /></button>
                    </div>
                    <div className="shadow-sliders">
                        {[
                            { key: 'x', label: 'X Offset', min: -50, max: 50 },
                            { key: 'y', label: 'Y Offset', min: -50, max: 50 },
                            { key: 'blur', label: 'Blur', min: 0, max: 100 },
                            { key: 'spread', label: 'Spread', min: -50, max: 50 },
                        ].map(s => (
                            <div key={s.key} className="shadow-slider-row">
                                <label>{s.label}</label>
                                <input
                                    type="range" min={s.min} max={s.max}
                                    value={shadowValues[s.key]}
                                    onChange={e => {
                                        const v = { ...shadowValues, [s.key]: parseInt(e.target.value) }
                                        applyShadow(v)
                                    }}
                                />
                                <span>{shadowValues[s.key]}px</span>
                            </div>
                        ))}
                        <div className="shadow-slider-row">
                            <label>Color</label>
                            <input
                                type="color"
                                value={shadowValues.color.replace(/[0-9a-f]{2}$/i, '')}
                                onChange={e => {
                                    const v = { ...shadowValues, color: e.target.value + '66' }
                                    applyShadow(v)
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Border Panel */}
            {showBorderPanel && (
                <div className="visual-tool-popover border-panel-popover">
                    <div className="visual-tool-popover-header">
                        <span>Border</span>
                        <button className="creator-icon-btn" onClick={() => setShowBorderPanel(false)}><FiX size={12} /></button>
                    </div>
                    <div className="border-controls">
                        <div className="border-control-row">
                            <label>Width</label>
                            <input type="range" min={0} max={10} value={borderValues.width}
                                onChange={e => applyBorder({ ...borderValues, width: parseInt(e.target.value) })} />
                            <span>{borderValues.width}px</span>
                        </div>
                        <div className="border-control-row">
                            <label>Style</label>
                            <select value={borderValues.style} onChange={e => applyBorder({ ...borderValues, style: e.target.value })}>
                                <option value="solid">Solid</option>
                                <option value="dashed">Dashed</option>
                                <option value="dotted">Dotted</option>
                            </select>
                        </div>
                        <div className="border-control-row">
                            <label>Color</label>
                            <input type="color" value={borderValues.color}
                                onChange={e => applyBorder({ ...borderValues, color: e.target.value })} />
                        </div>
                        <div className="border-control-row">
                            <label>Radius</label>
                            <input type="range" min={0} max={50} value={borderValues.radius}
                                onChange={e => applyBorder({ ...borderValues, radius: parseInt(e.target.value) })} />
                            <span>{borderValues.radius}px</span>
                        </div>
                    </div>
                </div>
            )}

            {showPalette && (
                <ComponentPalette
                    onInsert={handleComponentInsert}
                    onClose={() => { setShowPalette(false); setActiveTool(null) }}
                />
            )}
        </div>
    )
}
