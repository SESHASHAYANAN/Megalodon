import { useState, useEffect, useMemo } from 'react'
import { FiX, FiLayers, FiMonitor, FiServer, FiDatabase, FiCloud, FiSettings, FiLoader } from 'react-icons/fi'
import { getArchitecture } from '../services/api'

// ── Pure SVG/CSS Architecture Visualizer (no reactflow) ─────────────────────

const LAYER_CONFIG = {
    frontend: { color: '#58a6ff', icon: '🖥️', label: 'Frontend' },
    backend: { color: '#3fb950', icon: '⚙️', label: 'Backend' },
    database: { color: '#f0883e', icon: '🗄️', label: 'Database' },
    external: { color: '#bc8cff', icon: '☁️', label: 'External Services' },
    devops: { color: '#f85149', icon: '🔧', label: 'DevOps' },
}

export default function ArchitecturePanel({ owner, repo, filePaths, onClose, onOpenFile }) {
    const [layers, setLayers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const data = await getArchitecture(owner, repo, filePaths)
                if (cancelled) return
                // Backend returns {layers: {frontend: [{name, tech, filepath}], backend: [...]}}
                // Transform to array format: [{name: "frontend", files: ["path1", "path2"]}]
                const rawLayers = data.layers || {}
                let parsed = []
                if (Array.isArray(rawLayers)) {
                    // Already in array format
                    parsed = rawLayers
                } else {
                    // Dict format — convert
                    parsed = Object.entries(rawLayers)
                        .filter(([, items]) => items.length > 0)
                        .map(([layerName, items]) => ({
                            name: layerName,
                            files: items.map(item => item.filepath || item.name || item),
                            items: items, // keep raw items for tech info
                        }))
                }
                setLayers(parsed)
            } catch (e) {
                if (!cancelled) setError(e.message || 'Failed to load architecture')
            }
            if (!cancelled) setLoading(false)
        }
        load()
        return () => { cancelled = true }
    }, [owner, repo])

    // Layout: each layer is a horizontal row, blocks inside each
    const layerHeight = 100
    const layerGap = 60
    const blockW = 160, blockH = 44, blockGap = 16
    const svgH = layers.length * (layerHeight + layerGap) + 80
    const maxBlocks = Math.max(1, ...layers.map(l => (l.files || []).length))
    const svgW = Math.max(800, maxBlocks * (blockW + blockGap) + 120)

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
        }}>
            <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />

            <div style={{
                position: 'relative', width: '92vw', height: '88vh',
                background: 'var(--orca-bg)', borderRadius: 16,
                border: '1px solid var(--orca-border)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                animation: 'fadeIn 0.25s ease-out', zIndex: 1,
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 20px', borderBottom: '1px solid var(--orca-border)',
                    background: 'var(--orca-bg-secondary)', flexShrink: 0,
                }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f0883e, #3fb950)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <FiLayers size={14} color="white" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--orca-text)' }}>
                            Imagine Architecture
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--orca-text-muted)' }}>
                            {owner}/{repo} · {layers.length} layers detected
                        </div>
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--orca-text-muted)' }}>
                        {layers.map(l => {
                            const cfg = LAYER_CONFIG[l.name] || LAYER_CONFIG.external
                            return (
                                <span key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
                                    {cfg.label}
                                </span>
                            )
                        })}
                    </div>

                    <button onClick={onClose} style={{
                        background: 'var(--orca-bg-elevated)', border: '1px solid var(--orca-border)',
                        borderRadius: 8, cursor: 'pointer', color: 'var(--orca-text-muted)',
                        padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                    }}>
                        <FiX size={14} /> Close
                    </button>
                </div>

                {/* Canvas */}
                <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--orca-text-muted)' }}>
                            <FiLoader size={20} className="spinner" /> Analyzing project architecture...
                        </div>
                    ) : error ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#f85149' }}>
                            {error}
                        </div>
                    ) : (
                        <svg width={svgW} height={svgH} style={{ display: 'block', margin: '0 auto' }}>
                            <defs>
                                <marker id="arch-arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto">
                                    <path d="M0,0 L10,3 L0,6" fill="#6e768180" />
                                </marker>
                            </defs>

                            {layers.map((layer, layerIdx) => {
                                const cfg = LAYER_CONFIG[layer.name] || LAYER_CONFIG.external
                                const y = 40 + layerIdx * (layerHeight + layerGap)
                                const files = layer.files || []
                                const totalW = files.length * (blockW + blockGap) - blockGap
                                const startX = (svgW - totalW) / 2

                                return (
                                    <g key={layer.name}>
                                        {/* Layer background */}
                                        <rect
                                            x={30} y={y} width={svgW - 60} height={layerHeight}
                                            rx={12} fill={`${cfg.color}08`}
                                            stroke={`${cfg.color}30`} strokeWidth={1}
                                            strokeDasharray="6 3"
                                        />

                                        {/* Layer label */}
                                        <text x={50} y={y + 20} fill={cfg.color} fontSize={12} fontWeight={700}>
                                            {cfg.icon} {cfg.label}
                                        </text>

                                        {/* File blocks */}
                                        {files.map((file, fi) => {
                                            const bx = startX + fi * (blockW + blockGap)
                                            const by = y + 34
                                            const shortName = file.split('/').pop()
                                            return (
                                                <g key={file} style={{ cursor: 'pointer' }}
                                                    onClick={() => { onOpenFile?.(file); onClose() }}>
                                                    <rect
                                                        x={bx} y={by} width={blockW} height={blockH}
                                                        rx={8} fill={`${cfg.color}15`}
                                                        stroke={cfg.color} strokeWidth={1.2}
                                                    />
                                                    <text
                                                        x={bx + blockW / 2} y={by + blockH / 2 + 1}
                                                        textAnchor="middle" dominantBaseline="middle"
                                                        fill={cfg.color} fontSize={11}
                                                        fontFamily="var(--font-mono)" fontWeight={600}
                                                        style={{ pointerEvents: 'none' }}
                                                    >
                                                        {shortName.length > 18 ? '…' + shortName.slice(-16) : shortName}
                                                    </text>
                                                </g>
                                            )
                                        })}

                                        {/* Connection line to next layer */}
                                        {layerIdx < layers.length - 1 && (
                                            <line
                                                x1={svgW / 2} y1={y + layerHeight}
                                                x2={svgW / 2} y2={y + layerHeight + layerGap}
                                                stroke="#6e768140" strokeWidth={2}
                                                markerEnd="url(#arch-arrow)"
                                                strokeDasharray="6 3"
                                                style={{ animation: 'dashFlow 1.5s linear infinite' }}
                                            />
                                        )}
                                    </g>
                                )
                            })}
                        </svg>
                    )}

                    <style>{`
                        @keyframes dashFlow {
                            to { stroke-dashoffset: -18; }
                        }
                    `}</style>
                </div>
            </div>
        </div>
    )
}
