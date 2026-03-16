import { useState } from 'react'
import { FiFolder, FiLayers, FiImage, FiSettings, FiChevronLeft, FiChevronRight, FiPlusCircle } from 'react-icons/fi'
import CreatorFileTree from './CreatorFileTree'
import PagesManager from './PagesManager'
import FrameworkSelector from './FrameworkSelector'

const TABS = [
    { id: 'files', label: 'Files', icon: FiFolder },
    { id: 'pages', label: 'Pages', icon: FiLayers },
    { id: 'assets', label: 'Assets', icon: FiImage },
    { id: 'settings', label: 'Settings', icon: FiSettings },
]

export default function LeftSidebar({
    files, selectedFile, onSelectFile, pages, onAddPage, onDeletePage,
    onNavigate, framework, onFrameworkChange, isGenerating, collapsed,
    onToggleCollapse, stage, statusText, onClearProject
}) {
    const [activeTab, setActiveTab] = useState('files')
    const fileCount = Object.keys(files).length

    if (collapsed) {
        return (
            <div className="creator-sidebar creator-sidebar--collapsed">
                <button className="creator-sidebar-toggle" onClick={onToggleCollapse} title="Expand Sidebar">
                    <FiChevronRight size={16} />
                </button>
                <div className="creator-sidebar-icons">
                    {TABS.map(tab => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                className={`creator-sidebar-icon-btn ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => { setActiveTab(tab.id); onToggleCollapse() }}
                                title={tab.label}
                            >
                                <Icon size={18} />
                            </button>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="creator-sidebar">
            {/* Header */}
            <div className="creator-sidebar-header">
                <div className="creator-sidebar-tabs">
                    {TABS.map(tab => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                className={`creator-sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                                title={tab.label}
                            >
                                <Icon size={14} />
                                <span>{tab.label}</span>
                            </button>
                        )
                    })}
                </div>
                <button className="creator-sidebar-toggle" onClick={onToggleCollapse} title="Collapse Sidebar">
                    <FiChevronLeft size={16} />
                </button>
            </div>

            {/* Stage Indicator */}
            {(stage === 'content' || stage === 'style' || stage === 'generating') && (
                <div className="creator-stage-indicator">
                    <div className={`creator-si-step ${stage === 'content' ? 'active' : (stage !== 'content' ? 'done' : '')}`}>
                        <span className="creator-si-dot">1</span>
                        <span>Content</span>
                    </div>
                    <div className="creator-si-line" />
                    <div className={`creator-si-step ${stage === 'style' ? 'active' : (stage === 'generating' ? 'done' : '')}`}>
                        <span className="creator-si-dot">2</span>
                        <span>Theme</span>
                    </div>
                    <div className="creator-si-line" />
                    <div className={`creator-si-step ${stage === 'generating' ? 'active' : ''}`}>
                        <span className="creator-si-dot">3</span>
                        <span>Code</span>
                    </div>
                    {statusText && <div className="creator-si-status">{statusText}</div>}
                </div>
            )}

            {/* Tab Content */}
            <div className="creator-sidebar-content">
                {activeTab === 'files' && (
                    <div className="creator-sidebar-panel">
                        {fileCount > 0 ? (
                            <CreatorFileTree
                                files={files}
                                selectedFile={selectedFile}
                                onSelect={onSelectFile}
                            />
                        ) : (
                            <div className="creator-sidebar-empty">
                                <FiFolder size={32} />
                                <p>No files yet</p>
                                <span>Generate an app to see files here</span>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'pages' && (
                    <div className="creator-sidebar-panel">
                        <PagesManager
                            pages={pages}
                            onAddPage={onAddPage}
                            onDeletePage={onDeletePage}
                            onNavigate={onNavigate}
                            disabled={isGenerating}
                        />
                    </div>
                )}

                {activeTab === 'assets' && (
                    <div className="creator-sidebar-panel">
                        <div className="creator-sidebar-empty">
                            <FiImage size={32} />
                            <p>Assets</p>
                            <span>Images and media files will appear here</span>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="creator-sidebar-panel">
                        <FrameworkSelector
                            value={framework}
                            onChange={onFrameworkChange}
                            disabled={isGenerating}
                        />
                        <div className="creator-settings-section">
                            <div className="creator-section-header">
                                <span>⚙️ PROJECT INFO</span>
                            </div>
                            <div className="creator-settings-info">
                                <div className="creator-settings-row">
                                    <span className="creator-settings-label">Files</span>
                                    <span className="creator-settings-value">{fileCount}</span>
                                </div>
                                <div className="creator-settings-row">
                                    <span className="creator-settings-label">Pages</span>
                                    <span className="creator-settings-value">{pages.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* New Project Button */}
            {onClearProject && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--orca-border)', flexShrink: 0 }}>
                    <button
                        onClick={onClearProject}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 8, padding: '8px 12px', borderRadius: 8,
                            background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)',
                            color: '#818cf8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)' }}
                    >
                        <FiPlusCircle size={14} />
                        New Project
                    </button>
                </div>
            )}
        </div>
    )
}
