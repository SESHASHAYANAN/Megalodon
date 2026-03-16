import { useState, useEffect, useCallback } from 'react'
import { FiX, FiMap, FiColumns, FiGitBranch, FiArrowRight } from 'react-icons/fi'
import { chatWithAI } from '../../services/api'

export default function PlanningPopup({ files = {}, appIdea = '', onClose }) {
    const [activeTab, setActiveTab] = useState('roadmap')
    const [roadmapItems, setRoadmapItems] = useState([])
    const [sprintTasks, setSprintTasks] = useState({ todo: [], inProgress: [], done: [] })
    const [architecture, setArchitecture] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [dragItem, setDragItem] = useState(null)
    const [hasAnalyzed, setHasAnalyzed] = useState({ roadmap: false, sprint: false, architecture: false })

    // localStorage key for sprint persistence
    const sprintKey = `orca_sprint_${appIdea || 'default'}`

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        document.body.style.overflow = 'hidden'
        // Restore sprint tasks from localStorage
        try {
            const saved = localStorage.getItem(sprintKey)
            if (saved) setSprintTasks(JSON.parse(saved))
        } catch { }
        return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = '' }
    }, [onClose, sprintKey])

    // Save sprint to localStorage on change
    useEffect(() => {
        if (sprintTasks.todo.length + sprintTasks.inProgress.length + sprintTasks.done.length > 0) {
            localStorage.setItem(sprintKey, JSON.stringify(sprintTasks))
        }
    }, [sprintTasks, sprintKey])

    const analyze = useCallback(async (type) => {
        if (hasAnalyzed[type] && type !== 'roadmap') return // don't re-analyze if already done (except roadmap)
        setIsLoading(true)
        const fileContext = Object.entries(files).slice(0, 5).map(([name, content]) =>
            `${name}:\n${typeof content === 'string' ? content.substring(0, 1500) : ''}`
        ).join('\n\n')

        try {
            const prompts = {
                roadmap: `Analyze this codebase and suggest a product roadmap. Return JSON array: [{"title":"...","description":"...","priority":"high|medium|low","effort":"S|M|L","category":"feature|improvement|fix"}]. Suggest 6-8 items. App idea: ${appIdea}\n\nCode:\n${fileContext}`,
                sprint: `Analyze this codebase for TODOs, incomplete features, and improvements. Return JSON: {"todo":[{"id":"1","title":"...","description":"...","priority":"high|medium|low"}],"inProgress":[],"done":[]}. Generate 5-8 todo items.\n\nCode:\n${fileContext}`,
                architecture: `Analyze this codebase and describe its architecture. Return JSON array: [{"id":"1","label":"Component Name","type":"module|page|service|util","connections":["2","3"],"description":"..."}]. Include 5-8 nodes.\n\nCode:\n${fileContext}`
            }

            const result = await chatWithAI(prompts[type], '', [])
            const text = result.response || ''
            try {
                const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0])
                    if (type === 'roadmap') setRoadmapItems(Array.isArray(data) ? data : [])
                    else if (type === 'sprint') {
                        // Only set if we don't already have saved tasks
                        const hasSaved = sprintTasks.todo.length + sprintTasks.inProgress.length + sprintTasks.done.length > 0
                        if (!hasSaved) {
                            const sprint = Array.isArray(data) ? { todo: data, inProgress: [], done: [] } : data
                            setSprintTasks(sprint)
                        }
                    }
                    else setArchitecture(Array.isArray(data) ? data : [])
                }
            } catch { /* fallback */ }
            setHasAnalyzed(prev => ({ ...prev, [type]: true }))
        } catch {
            /* analysis failed */
        } finally {
            setIsLoading(false)
        }
    }, [files, appIdea, hasAnalyzed, sprintTasks])

    useEffect(() => {
        const typeMap = { roadmap: 'roadmap', sprint: 'sprint', architecture: 'architecture' }
        analyze(typeMap[activeTab] || 'roadmap')
    }, [activeTab])

    const handleDragStart = (task, fromCol) => setDragItem({ task, fromCol })
    const handleDrop = (toCol) => {
        if (!dragItem) return
        const { task, fromCol } = dragItem
        if (fromCol === toCol) return
        setSprintTasks(prev => ({
            ...prev,
            [fromCol]: prev[fromCol].filter(t => t.id !== task.id),
            [toCol]: [...prev[toCol], task]
        }))
        setDragItem(null)
    }

    const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }
    const TYPE_COLORS = { module: '#3b82f6', page: '#22c55e', service: '#f59e0b', util: '#8b5cf6' }

    const tabs = [
        { id: 'roadmap', label: 'Roadmap', icon: FiMap },
        { id: 'sprint', label: 'Sprint Board', icon: FiColumns },
        { id: 'architecture', label: 'Architecture', icon: FiGitBranch },
    ]

    return (
        <div className="orca-popup-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="orca-popup-container planning-popup">
                <div className="orca-popup-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FiMap size={18} style={{ color: 'var(--orca-accent)' }} />
                        <h3 style={{ margin: 0 }}>Product Planning</h3>
                        {appIdea && <span style={{ fontSize: 11, color: 'var(--orca-text-muted)', fontStyle: 'italic' }}>— {appIdea}</span>}
                    </div>
                    <button className="creator-icon-btn" onClick={onClose}><FiX size={16} /></button>
                </div>

                <div className="orca-popup-tabs">
                    {tabs.map(tab => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                className={`orca-popup-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <Icon size={14} /> {tab.label}
                            </button>
                        )
                    })}
                </div>

                <div className="orca-popup-body">
                    {isLoading && (
                        <div className="orca-popup-loading">
                            <div className="orca-popup-spinner" />
                            <p>Analyzing codebase with AI...</p>
                        </div>
                    )}

                    {!isLoading && activeTab === 'roadmap' && (
                        <div className="planning-roadmap-grid">
                            {roadmapItems.length === 0 && (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--orca-text-muted)' }}>
                                    No roadmap items yet. Generate an app first to see AI-powered suggestions.
                                </div>
                            )}
                            {roadmapItems.map((item, i) => (
                                <div key={i} className="planning-roadmap-card">
                                    <div className="planning-roadmap-card-header">
                                        <span className="planning-priority-badge" style={{ background: PRIORITY_COLORS[item.priority] || '#6366f1' }}>
                                            {item.priority}
                                        </span>
                                        <span className="planning-effort-badge">{item.effort || 'M'}</span>
                                    </div>
                                    <h4>{item.title}</h4>
                                    <p>{item.description}</p>
                                    {item.category && <span className="planning-category-tag">{item.category}</span>}
                                </div>
                            ))}
                        </div>
                    )}

                    {!isLoading && activeTab === 'sprint' && (
                        <div className="planning-kanban">
                            {['todo', 'inProgress', 'done'].map(col => (
                                <div
                                    key={col}
                                    className="planning-kanban-col"
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={() => handleDrop(col)}
                                >
                                    <div className="planning-kanban-col-header">
                                        <span>{col === 'todo' ? '📋 Todo' : col === 'inProgress' ? '🔄 In Progress' : '✅ Done'}</span>
                                        <span className="planning-kanban-count">{sprintTasks[col]?.length || 0}</span>
                                    </div>
                                    <div className="planning-kanban-cards">
                                        {(sprintTasks[col] || []).map((task, i) => (
                                            <div
                                                key={task.id || i}
                                                className="planning-kanban-card"
                                                draggable
                                                onDragStart={() => handleDragStart(task, col)}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <h5>{task.title}</h5>
                                                    <span className="planning-priority-dot" style={{ background: PRIORITY_COLORS[task.priority] || '#6366f1' }} />
                                                </div>
                                                <p>{task.description}</p>
                                            </div>
                                        ))}
                                        {(sprintTasks[col] || []).length === 0 && (
                                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--orca-text-muted)', fontSize: 12, opacity: 0.5 }}>
                                                Drop tasks here
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!isLoading && activeTab === 'architecture' && (
                        <div className="planning-arch-diagram">
                            {architecture.length === 0 && (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--orca-text-muted)' }}>
                                    No architecture data yet. Generate an app first.
                                </div>
                            )}
                            {architecture.map((node, i) => (
                                <div key={node.id || i} className={`planning-arch-node planning-arch-${node.type || 'module'}`}>
                                    <div className="planning-arch-node-header">
                                        <span className="planning-arch-type-badge" style={{ background: `${TYPE_COLORS[node.type] || '#8b5cf6'}22`, color: TYPE_COLORS[node.type] || '#8b5cf6' }}>
                                            {node.type || 'module'}
                                        </span>
                                        <h4>{node.label}</h4>
                                    </div>
                                    <p>{node.description}</p>
                                    {node.connections?.length > 0 && (
                                        <div className="planning-arch-connections">
                                            <FiArrowRight size={12} />
                                            {node.connections.map((c, ci) => {
                                                const target = architecture.find(n => n.id === c)
                                                return <span key={ci} className="planning-arch-conn-tag">{target?.label || c}</span>
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
