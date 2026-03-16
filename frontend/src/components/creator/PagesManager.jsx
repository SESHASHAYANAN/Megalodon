import { useState } from 'react'
import { FiPlus, FiTrash2, FiFile, FiNavigation } from 'react-icons/fi'

export default function PagesManager({ pages, onAddPage, onDeletePage, onNavigate, disabled }) {
    const [isAdding, setIsAdding] = useState(false)
    const [newPageName, setNewPageName] = useState('')

    const handleAdd = () => {
        const name = newPageName.trim()
        if (!name) return
        if (pages.includes(name)) return
        onAddPage(name)
        setNewPageName('')
        setIsAdding(false)
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleAdd()
        if (e.key === 'Escape') { setIsAdding(false); setNewPageName('') }
    }

    const handlePageClick = (page) => {
        if (onNavigate) {
            onNavigate(page)
        }
    }

    return (
        <div className="creator-pages-manager">
            <div className="creator-section-header">
                <span>📄 PAGES</span>
                <button
                    className="creator-icon-btn"
                    onClick={() => setIsAdding(true)}
                    disabled={disabled}
                    title="Add page"
                >
                    <FiPlus size={14} />
                </button>
            </div>
            <div className="creator-pages-list">
                {pages.map(page => (
                    <div key={page} className="creator-page-item" onClick={() => handlePageClick(page)}>
                        <FiFile size={13} />
                        <span className="creator-page-name">{page}</span>
                        <button
                            className="creator-page-nav"
                            onClick={(e) => { e.stopPropagation(); handlePageClick(page) }}
                            title={`Navigate to ${page}`}
                        >
                            <FiNavigation size={11} />
                        </button>
                        {pages.length > 1 && (
                            <button
                                className="creator-page-delete"
                                onClick={(e) => { e.stopPropagation(); onDeletePage(page) }}
                                disabled={disabled}
                                title={`Delete ${page}`}
                            >
                                <FiTrash2 size={12} />
                            </button>
                        )}
                    </div>
                ))}
                {isAdding && (
                    <div className="creator-page-add-input">
                        <input
                            type="text"
                            value={newPageName}
                            onChange={e => setNewPageName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={() => { if (!newPageName.trim()) setIsAdding(false) }}
                            placeholder="Page name..."
                            autoFocus
                            className="creator-inline-input"
                        />
                        <button className="creator-icon-btn accent" onClick={handleAdd} disabled={!newPageName.trim()}>
                            <FiPlus size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
