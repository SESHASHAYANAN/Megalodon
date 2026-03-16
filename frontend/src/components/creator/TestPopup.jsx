import { useEffect, useCallback } from 'react'
import { FiX, FiSmartphone, FiTablet, FiMonitor } from 'react-icons/fi'

export default function TestPopup({ previewHtml, onClose }) {
    // Close on Escape key
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const viewports = [
        { key: 'mobile', width: 390, label: 'Mobile', icon: FiSmartphone },
        { key: 'tablet', width: 768, label: 'Tablet', icon: FiTablet },
        { key: 'desktop', width: 1280, label: 'Desktop', icon: FiMonitor },
    ]

    return (
        <div className="creator-test-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="creator-test-popup">
                {/* Header */}
                <div className="creator-test-header">
                    <h3>Multi-Viewport Testing</h3>
                    <div className="creator-test-header-badges">
                        {viewports.map(vp => {
                            const Icon = vp.icon
                            return (
                                <span key={vp.key} className="creator-test-badge">
                                    <Icon size={12} /> {vp.label} ({vp.width}px)
                                </span>
                            )
                        })}
                    </div>
                    <button className="creator-icon-btn" onClick={onClose} title="Close (Esc)">
                        <FiX size={16} />
                    </button>
                </div>

                {/* Viewport Grid */}
                <div className="creator-test-grid">
                    {viewports.map(vp => {
                        const Icon = vp.icon
                        return (
                            <div key={vp.key} className="creator-test-viewport-col">
                                <div className="creator-test-viewport-label">
                                    <Icon size={14} /> {vp.label} — {vp.width}px
                                </div>
                                <div className="creator-test-viewport-frame" style={{ maxWidth: `${vp.width}px` }}>
                                    <iframe
                                        className="creator-test-iframe"
                                        sandbox="allow-scripts allow-forms allow-popups"
                                        srcDoc={previewHtml}
                                        title={`${vp.label} Preview`}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
