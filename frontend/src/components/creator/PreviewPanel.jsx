import { useState, useRef, useEffect, useCallback } from 'react'
import { FiMonitor, FiTablet, FiSmartphone, FiMaximize2, FiMinimize2, FiRefreshCw, FiPlay, FiRotateCw, FiZoomIn, FiZoomOut, FiVideo } from 'react-icons/fi'
import VisualToolbar from './VisualToolbar'
import TestPopup from './TestPopup'
import RecordDemoPopup from './RecordDemoPopup'

const VIEWPORTS = {
    mobile: { width: 375, height: 812, label: 'Mobile', icon: FiSmartphone },
    tablet: { width: 768, height: 1024, label: 'Tablet', icon: FiTablet },
    desktop: { width: 1440, height: 900, label: 'Desktop', icon: FiMonitor },
}

const ZOOM_LEVELS = [50, 75, 100, 'fit']

export default function PreviewPanel({ htmlContent, setHtmlContent, viewport, onViewportChange, pages }) {
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [rotated, setRotated] = useState(false)
    const [zoom, setZoom] = useState('fit')
    const [showTest, setShowTest] = useState(false)
    const [showRecordDemo, setShowRecordDemo] = useState(false)
    const iframeRef = useRef(null)
    const containerRef = useRef(null)
    const previewAreaRef = useRef(null)
    const [iframeKey, setIframeKey] = useState(0)
    const [computedScale, setComputedScale] = useState(1)

    const toggleFullscreen = useCallback(() => {
        if (!isFullscreen) {
            containerRef.current?.requestFullscreen?.()
        } else {
            document.exitFullscreen?.()
        }
        setIsFullscreen(!isFullscreen)
    }, [isFullscreen])

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', handler)
        return () => document.removeEventListener('fullscreenchange', handler)
    }, [])

    // Injection via srcdoc, fallback to contentDocument write
    useEffect(() => {
        if (!iframeRef.current) return
        if (htmlContent) {
            const bridgeCode = `
                // VISUAL EDITING BRIDGE
                window.addEventListener('message', e => {
                    const data = e.data;
                    if (!data) return;
                    
                    if (data.action === 'ACTIVATE_SELECT') {
                        // (Simplified highlight logic)
                    }
                    if (data.action === 'ACTIVATE_TEXT_TOOL') {
                        document.querySelectorAll('h1,h2,h3,p,a,button').forEach((el, i) => {
                            if (!el.id) el.id = 'vd-txt-' + i;
                            el.contentEditable = 'true';
                            el.style.outline = '1px dashed #6366f1';
                            el.onblur = () => {
                                window.parent.postMessage({ action: 'TEXT_CHANGED', selector: '#' + el.id, newText: el.textContent }, '*');
                            };
                        });
                    }
                    if (data.action === 'DEACTIVATE_TEXT_TOOL') {
                         document.querySelectorAll('h1,h2,h3,p,a,button').forEach(el => {
                            el.contentEditable = 'false';
                            el.style.outline = '';
                            el.onblur = null;
                        });
                    }
                    if (data.action === 'APPLY_DIFF') {
                        // Apply diff on the fly
                        data.diffs.forEach(d => {
                            const domEl = document.querySelector(d.selector);
                            if (domEl) domEl.style[d.property] = d.value;
                        });
                    }
                    if (data.action === 'NAVIGATE') {
                        if (window.navigate) window.navigate(data.path);
                    }

                    // ── FONT TOOL ──
                    if (data.action === 'ACTIVATE_FONT_TOOL') {
                        document.querySelectorAll('*').forEach(el => {
                            el.addEventListener('click', function fontClick(e) {
                                e.preventDefault(); e.stopPropagation();
                                el.style.outline = '2px dashed #8b5cf6';
                                window._vdSelectedForFont = el;
                                if (!el.id) el.id = 'vd-font-' + Math.random().toString(36).substr(2,6);
                                el.removeEventListener('click', fontClick);
                            }, { once: true });
                        });
                    }
                    if (data.action === 'APPLY_FONT' && window._vdSelectedForFont) {
                        const el = window._vdSelectedForFont;
                        el.style.fontFamily = "'" + data.font + "', sans-serif";
                        el.style.outline = '';
                        window.parent.postMessage({ action: 'FONT_CHANGED', selector: '#' + el.id, font: data.font }, '*');
                    }

                    // ── SPACING TOOL ──
                    if (data.action === 'ACTIVATE_SPACING_TOOL') {
                        document.querySelectorAll('section,div,header,footer,main,article').forEach((el, i) => {
                            if (!el.id) el.id = 'vd-sp-' + i;
                            el.style.outline = '1px dashed #22c55e';
                            el.style.cursor = 'pointer';
                            el.addEventListener('click', function spClick(e) {
                                e.preventDefault(); e.stopPropagation();
                                const cs = getComputedStyle(el);
                                const pad = parseInt(cs.padding) || 16;
                                el.style.padding = (pad + 8) + 'px';
                                window.parent.postMessage({ action: 'SPACING_CHANGED', selector: '#' + el.id, property: 'padding', value: el.style.padding }, '*');
                            });
                        });
                    }
                    if (data.action === 'DEACTIVATE_SPACING_TOOL') {
                        document.querySelectorAll('section,div,header,footer,main,article').forEach(el => {
                            el.style.outline = ''; el.style.cursor = '';
                        });
                    }

                    // ── BORDER TOOL ──
                    if (data.action === 'ACTIVATE_BORDER_TOOL') {
                        document.querySelectorAll('*').forEach(el => {
                            el.addEventListener('click', function borderClick(e) {
                                e.preventDefault(); e.stopPropagation();
                                el.style.outline = '2px dashed #f59e0b';
                                window._vdSelectedForBorder = el;
                                if (!el.id) el.id = 'vd-brd-' + Math.random().toString(36).substr(2,6);
                                el.removeEventListener('click', borderClick);
                            }, { once: true });
                        });
                    }
                    if (data.action === 'APPLY_BORDER' && window._vdSelectedForBorder) {
                        const el = window._vdSelectedForBorder;
                        const b = data.border;
                        el.style.border = b.width + 'px ' + b.style + ' ' + b.color;
                        el.style.borderRadius = b.radius + 'px';
                        el.style.outline = '';
                        window.parent.postMessage({ action: 'BORDER_CHANGED', selector: '#' + el.id, border: b }, '*');
                    }

                    // ── ANIMATION TOOL ──
                    if (data.action === 'ACTIVATE_ANIMATION_TOOL') {
                        document.querySelectorAll('*').forEach(el => {
                            el.addEventListener('click', function animClick(e) {
                                e.preventDefault(); e.stopPropagation();
                                el.style.outline = '2px dashed #ec4899';
                                window._vdSelectedForAnim = el;
                                if (!el.id) el.id = 'vd-anim-' + Math.random().toString(36).substr(2,6);
                                el.removeEventListener('click', animClick);
                            }, { once: true });
                        });
                    }
                    if (data.action === 'APPLY_ANIMATION' && window._vdSelectedForAnim) {
                        const el = window._vdSelectedForAnim;
                        const anim = data.animation;
                        // Inject CSS if needed
                        if (!document.querySelector('style[data-vd-anim]')) {
                            const s = document.createElement('style'); s.setAttribute('data-vd-anim','1');
                            document.head.appendChild(s);
                        }
                        const styleEl = document.querySelector('style[data-vd-anim]');
                        if (anim.css && !styleEl.textContent.includes(anim.name)) styleEl.textContent += anim.css;
                        el.classList.add('anim-' + anim.name);
                        el.style.outline = '';
                        window.parent.postMessage({ action: 'ANIMATION_APPLIED', selector: '#' + el.id, className: 'anim-' + anim.name }, '*');
                    }

                    // ── SHADOW TOOL ──
                    if (data.action === 'ACTIVATE_SHADOW_TOOL') {
                        document.querySelectorAll('*').forEach(el => {
                            el.addEventListener('click', function shadowClick(e) {
                                e.preventDefault(); e.stopPropagation();
                                el.style.outline = '2px dashed #06b6d4';
                                window._vdSelectedForShadow = el;
                                if (!el.id) el.id = 'vd-shd-' + Math.random().toString(36).substr(2,6);
                                el.removeEventListener('click', shadowClick);
                            }, { once: true });
                        });
                    }
                    if (data.action === 'APPLY_SHADOW' && window._vdSelectedForShadow) {
                        const el = window._vdSelectedForShadow;
                        el.style.boxShadow = data.shadow;
                        el.style.outline = '';
                        window.parent.postMessage({ action: 'SHADOW_CHANGED', selector: '#' + el.id, shadow: data.shadow }, '*');
                    }

                    // ── INSERT COMPONENT ──
                    if (data.action === 'ACTIVATE_INSERT_COMPONENT' && data.html) {
                        const wrapper = document.createElement('div');
                        wrapper.innerHTML = data.html;
                        const node = wrapper.firstElementChild || wrapper;
                        const main = document.querySelector('main') || document.querySelector('#app') || document.body;
                        main.appendChild(node);
                        window.parent.postMessage({ action: 'COMPONENT_INSERTED', htmlAfterInsert: document.documentElement.outerHTML }, '*');
                    }
                });

                // Drag and Drop support
                document.addEventListener('dragover', e => e.preventDefault());
                document.addEventListener('drop', e => {
                    e.preventDefault();
                    const html = e.dataTransfer.getData('text/html');
                    if (!html) return;
                    
                    const wrapper = document.createElement('div');
                    wrapper.innerHTML = html;
                    const node = wrapper.firstElementChild || wrapper;

                    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
                    if (range && range.startContainer) {
                        const container = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
                        if (container && container.parentElement) {
                            container.parentElement.insertBefore(node, container.nextSibling);
                        } else {
                            document.body.appendChild(node);
                        }
                    } else {
                        document.body.appendChild(node);
                    }
                    window.parent.postMessage({ action: 'COMPONENT_INSERTED', htmlAfterInsert: document.documentElement.outerHTML }, '*');
                });
            `;
            const enhancedHtml = htmlContent.includes('</body>')
                ? htmlContent.replace('</body>', `<script>${bridgeCode}</script></body>`)
                : htmlContent + `<script>${bridgeCode}</script>`;

            try {
                iframeRef.current.srcdoc = enhancedHtml
            } catch (err) {
                const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document
                if (doc) {
                    doc.open()
                    doc.write(enhancedHtml)
                    doc.close()
                }
            }
        }
    }, [htmlContent, iframeKey])

    // Scale logic
    useEffect(() => {
        if (zoom !== 'fit' || viewport === 'desktop') return
        const area = previewAreaRef.current
        if (!area) return

        const observer = new ResizeObserver(() => {
            const vpConfig = VIEWPORTS[viewport]
            const w = rotated ? vpConfig.height : vpConfig.width
            const h = rotated ? vpConfig.width : vpConfig.height
            const areaW = area.clientWidth - 48
            const areaH = area.clientHeight - 48
            const scale = Math.min(areaW / w, areaH / h, 1)
            setComputedScale(scale)
        })
        observer.observe(area)
        return () => observer.disconnect()
    }, [zoom, viewport, rotated])

    const vpConfig = VIEWPORTS[viewport] || VIEWPORTS.desktop
    const rawW = rotated ? vpConfig.height : vpConfig.width
    const rawH = rotated ? vpConfig.width : vpConfig.height
    const isDesktop = viewport === 'desktop'
    const actualZoom = zoom === 'fit' ? computedScale : zoom / 100

    return (
        <div className="creator-preview-panel" ref={containerRef} style={{ background: '#f8fafc' }}>
            {/* Toolbar */}
            <div className="creator-preview-toolbar">
                <div className="creator-preview-viewport-switcher">
                    {Object.entries(VIEWPORTS).map(([key, vp]) => {
                        const Icon = vp.icon
                        return (
                            <button
                                key={key}
                                className={`creator-viewport-btn ${viewport === key ? 'active' : ''}`}
                                onClick={() => { onViewportChange(key); setRotated(false) }}
                                title={`${vp.label} (${vp.width}×${vp.height})`}
                            >
                                <Icon size={14} />
                                <span className="creator-viewport-label-text">{vp.label}</span>
                                <span className="creator-viewport-size">{vp.width}</span>
                            </button>
                        )
                    })}
                </div>

                <div className="creator-preview-actions">
                    {!isDesktop && (
                        <div className="creator-zoom-group">
                            <button className="btn-ghost creator-zoom-btn" onClick={() => {
                                const numZooms = ZOOM_LEVELS.filter(z => z !== 'fit')
                                const current = zoom === 'fit' ? 100 : zoom
                                const nextIdx = numZooms.indexOf(current)
                                if (nextIdx > 0) setZoom(numZooms[nextIdx - 1])
                            }} title="Zoom out"><FiZoomOut size={13} /></button>
                            <span className="creator-zoom-value">{zoom === 'fit' ? 'Fit' : `${zoom}%`}</span>
                            <button className="btn-ghost creator-zoom-btn" onClick={() => {
                                const numZooms = ZOOM_LEVELS.filter(z => z !== 'fit')
                                const current = zoom === 'fit' ? 100 : zoom
                                const nextIdx = numZooms.indexOf(current)
                                if (nextIdx < numZooms.length - 1) setZoom(numZooms[nextIdx + 1])
                            }} title="Zoom in"><FiZoomIn size={13} /></button>
                        </div>
                    )}
                    {!isDesktop && (
                        <button className="btn-ghost" onClick={() => setRotated(r => !r)} title="Rotate device">
                            <FiRotateCw size={14} />
                        </button>
                    )}
                    {htmlContent && (
                        <button className="btn-ghost creator-test-btn" onClick={() => setShowTest(true)} title="Test viewports">
                            <FiPlay size={14} /> Test
                        </button>
                    )}
                    {htmlContent && (
                        <button className="btn-ghost creator-test-btn" onClick={() => setShowRecordDemo(true)} title="Record demo video">
                            <FiVideo size={14} /> Record
                        </button>
                    )}
                    <button className="btn-ghost" onClick={() => setIframeKey(k => k + 1)} title="Refresh preview">
                        <FiRefreshCw size={14} />
                    </button>
                    <button className="btn-ghost" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                        {isFullscreen ? <FiMinimize2 size={14} /> : <FiMaximize2 size={14} />}
                    </button>
                </div>
            </div>

            <div className="creator-preview-content" ref={previewAreaRef}>
                <div className="creator-preview-canvas" style={{ background: '#e2e8f0' }}>
                    {isDesktop ? (
                        <div className="creator-preview-iframe-container creator-preview-desktop" style={{ background: 'white' }}>
                            {htmlContent ? (
                                <>
                                    <VisualToolbar iframeRef={iframeRef} htmlContent={htmlContent} setHtmlContent={setHtmlContent} />
                                    <iframe
                                        ref={iframeRef}
                                        key={iframeKey}
                                        className="creator-preview-iframe"
                                        style={{ background: 'white', width: '100%', height: '100%' }}
                                        sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                                        title="App Preview"
                                        srcDoc={htmlContent}
                                    />
                                </>
                            ) : (
                                <div className="creator-preview-empty">
                                    <div className="creator-preview-empty-icon">🚀</div>
                                    <h3 style={{ color: '#94a3b8' }}>Live Preview</h3>
                                    <p style={{ color: '#94a3b8' }}>Your app will appear here once generated.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="creator-device-frame" style={{
                            width: rawW,
                            height: rawH,
                            transform: `scale(${actualZoom})`,
                            transformOrigin: 'top center',
                            background: 'white'
                        }}>
                            <div className="creator-device-notch" />
                            <div className="creator-device-screen" style={{ background: 'white' }}>
                                {htmlContent ? (
                                    <>
                                        <VisualToolbar iframeRef={iframeRef} htmlContent={htmlContent} setHtmlContent={setHtmlContent} />
                                        <iframe
                                            ref={iframeRef}
                                            key={iframeKey}
                                            className="creator-preview-iframe"
                                            style={{ background: 'white', width: '100%', height: '100%' }}
                                            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                                            title="App Preview"
                                            srcDoc={htmlContent}
                                        />
                                    </>
                                ) : (
                                    <div className="creator-preview-empty">
                                        <div className="creator-preview-empty-icon">🚀</div>
                                        <h3 style={{ color: '#94a3b8' }}>Live Preview</h3>
                                        <p style={{ color: '#94a3b8' }}>Your app will appear here once generated.</p>
                                    </div>
                                )}
                            </div>
                            <div className="creator-device-home-bar" />
                        </div>
                    )}
                </div>
            </div>

            {showTest && <TestPopup previewHtml={htmlContent} onClose={() => setShowTest(false)} />}
            {showRecordDemo && <RecordDemoPopup htmlContent={htmlContent} pages={pages || []} onClose={() => setShowRecordDemo(false)} />}
        </div>
    )
}
