import { useState, useEffect, useRef, useMemo } from 'react'
import { FiX, FiSearch, FiCpu, FiLoader } from 'react-icons/fi'
import { getMapping, getNodeSummary } from '../services/api'

// ── Pure SVG/CSS Code Flow Visualizer (no reactflow) ────────────────────────

const NODE_COLORS = {
    entry: { bg: 'rgba(88,166,255,0.15)', border: '#58a6ff', text: '#58a6ff' },
    utility: { bg: 'rgba(63,185,80,0.15)', border: '#3fb950', text: '#3fb950' },
    api: { bg: 'rgba(240,136,62,0.15)', border: '#f0883e', text: '#f0883e' },
    database: { bg: 'rgba(248,81,73,0.15)', border: '#f85149', text: '#f85149' },
    default: { bg: 'rgba(188,140,255,0.15)', border: '#bc8cff', text: '#bc8cff' },
}

function getNodeType(filePath) {
    const p = filePath.toLowerCase()
    if (p.includes('index') || p.includes('main') || p.includes('app.')) return 'entry'
    if (p.includes('util') || p.includes('helper') || p.includes('lib')) return 'utility'
    if (p.includes('api') || p.includes('route') || p.includes('endpoint') || p.includes('controller')) return 'api'
    if (p.includes('model') || p.includes('schema') || p.includes('migration') || p.includes('db')) return 'database'
    return 'default'
}

function layoutNodes(nodes) {
    const cols = Math.ceil(Math.sqrt(nodes.length))
    const spacingX = 220, spacingY = 100
    return nodes.map((n, i) => ({
        ...n,
        x: 60 + (i % cols) * spacingX,
        y: 60 + Math.floor(i / cols) * spacingY,
        w: 180,
        h: 50,
    }))
}

export default function MappingPanel({ owner, repo, filePaths, onClose, onOpenFile }) {
    const [nodes, setNodes] = useState([])
    const [edges, setEdges] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState(null)
    const [summary, setSummary] = useState('')
    const [summaryLoading, setSummaryLoading] = useState(false)
    const svgRef = useRef(null)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [dragging, setDragging] = useState(false)
    const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const data = await getMapping(owner, repo, filePaths)
                if (cancelled) return
                const laid = layoutNodes(data.nodes || [])
                setNodes(laid)
                setEdges(data.edges || [])
            } catch (e) {
                if (!cancelled) setError(e.message || 'Failed to load mapping')
            }
            if (!cancelled) setLoading(false)
        }
        load()
        return () => { cancelled = true }
    }, [owner, repo])

    const handleNodeClick = async (node) => {
        setSelected(node)
        setSummary('')
        setSummaryLoading(true)
        try {
            const data = await getNodeSummary(owner, repo, node.id)
            setSummary(data.summary || 'No summary available.')
        } catch {
            setSummary('Could not generate summary.')
        }
        setSummaryLoading(false)
    }

    const filteredNodes = useMemo(() => {
        if (!search.trim()) return nodes
        const q = search.toLowerCase()
        return nodes.map(n => ({
            ...n,
            dimmed: !n.id.toLowerCase().includes(q) && !(n.label || '').toLowerCase().includes(q),
        }))
    }, [nodes, search])

    const nodeMap = useMemo(() => {
        const m = {}
        filteredNodes.forEach(n => { m[n.id] = n })
        return m
    }, [filteredNodes])

    // Pan handlers
    const onMouseDown = (e) => {
        if (e.target.tagName === 'rect' || e.target.tagName === 'text') return
        setDragging(true)
        dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    }
    const onMouseMove = (e) => {
        if (!dragging) return
        setPan({
            x: dragStart.current.px + (e.clientX - dragStart.current.x),
            y: dragStart.current.py + (e.clientY - dragStart.current.y),
        })
    }
    const onMouseUp = () => setDragging(false)

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
                        background: 'linear-gradient(135deg, #58a6ff, #bc8cff)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <FiCpu size={14} color="white" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--orca-text)' }}>
                            Code Flow Mapping
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--orca-text-muted)' }}>
                            {owner}/{repo} · {nodes.length} files detected
                        </div>
                    </div>

                    {/* Search */}
                    <div style={{ position: 'relative', width: 200 }}>
                        <FiSearch size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--orca-text-muted)' }} />
                        <input
                            placeholder="Filter files..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            style={{
                                width: '100%', padding: '6px 10px 6px 28px', fontSize: 12,
                                background: 'var(--orca-bg)', border: '1px solid var(--orca-border)',
                                borderRadius: 6, color: 'var(--orca-text)', outline: 'none',
                            }}
                        />
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--orca-text-muted)' }}>
                        {Object.entries(NODE_COLORS).filter(([k]) => k !== 'default').map(([k, v]) => (
                            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.border }} />
                                {k}
                            </span>
                        ))}
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
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: dragging ? 'grabbing' : 'grab' }}
                    onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--orca-text-muted)' }}>
                            <FiLoader size={20} className="spinner" /> Scanning codebase...
                        </div>
                    ) : error ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#f85149' }}>
                            {error}
                        </div>
                    ) : (
                        <svg ref={svgRef} width="100%" height="100%" style={{ display: 'block' }}>
                            <defs>
                                <marker id="arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto">
                                    <path d="M0,0 L10,3 L0,6" fill="#6e768180" />
                                </marker>
                            </defs>
                            <g transform={`translate(${pan.x}, ${pan.y})`}>
                                {/* Edges */}
                                {edges.map((e, i) => {
                                    const src = nodeMap[e.source]
                                    const tgt = nodeMap[e.target]
                                    if (!src || !tgt) return null
                                    return (
                                        <line key={`e-${i}`}
                                            x1={src.x + src.w / 2} y1={src.y + src.h}
                                            x2={tgt.x + tgt.w / 2} y2={tgt.y}
                                            stroke="#6e768140" strokeWidth={1.5}
                                            markerEnd="url(#arrow)"
                                            strokeDasharray="6 3"
                                            style={{ animation: `dashFlow 1.5s linear infinite` }}
                                        />
                                    )
                                })}

                                {/* Nodes */}
                                {filteredNodes.map(node => {
                                    const type = getNodeType(node.id)
                                    const colors = NODE_COLORS[type] || NODE_COLORS.default
                                    const dimmed = node.dimmed
                                    const isSelected = selected?.id === node.id
                                    return (
                                        <g key={node.id} style={{ cursor: 'pointer', opacity: dimmed ? 0.25 : 1, transition: 'opacity 0.2s' }}
                                            onClick={(ev) => { ev.stopPropagation(); handleNodeClick(node) }}>
                                            <rect
                                                x={node.x} y={node.y} width={node.w} height={node.h}
                                                rx={10} ry={10}
                                                fill={colors.bg}
                                                stroke={isSelected ? '#fff' : colors.border}
                                                strokeWidth={isSelected ? 2 : 1}
                                            />
                                            <text
                                                x={node.x + node.w / 2} y={node.y + node.h / 2 + 1}
                                                textAnchor="middle" dominantBaseline="middle"
                                                fill={colors.text}
                                                fontSize={11} fontWeight={600}
                                                fontFamily="var(--font-mono)"
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                {(node.label || node.id).length > 22
                                                    ? '…' + (node.label || node.id).slice(-20)
                                                    : (node.label || node.id)}
                                            </text>
                                        </g>
                                    )
                                })}
                            </g>
                        </svg>
                    )}

                    {/* CSS for the flowing edges */}
                    <style>{`
                        @keyframes dashFlow {
                            to { stroke-dashoffset: -18; }
                        }
                    `}</style>

                    {/* Summary popup */}
                    {selected && (
                        <div style={{
                            position: 'absolute', bottom: 20, right: 20, width: 340,
                            background: 'var(--orca-bg-secondary)', border: '1px solid var(--orca-border)',
                            borderRadius: 12, padding: '14px 16px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                            animation: 'fadeIn 0.2s ease-out',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orca-text)', fontFamily: 'var(--font-mono)' }}>
                                    {selected.label || selected.id}
                                </div>
                                <button onClick={() => setSelected(null)} style={{
                                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--orca-text-muted)', padding: 2,
                                }}>
                                    <FiX size={12} />
                                </button>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--orca-text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                                {summaryLoading ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--orca-text-muted)' }}>
                                        <FiLoader size={11} className="spinner" /> Generating AI summary...
                                    </span>
                                ) : summary}
                            </div>
                            <button onClick={() => { onOpenFile?.(selected.id); onClose() }}
                                style={{
                                    background: 'var(--orca-gradient-vivid)', border: 'none', borderRadius: 6,
                                    color: 'white', padding: '5px 12px', fontSize: 11, fontWeight: 700,
                                    cursor: 'pointer',
                                }}>
                                Open in Editor
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
