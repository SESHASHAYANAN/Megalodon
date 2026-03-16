import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import ChatPanel from '../components/creator/ChatPanel'
import PreviewPanel from '../components/creator/PreviewPanel'
import LeftSidebar from '../components/creator/LeftSidebar'
import StylePicker from '../components/creator/StylePicker'
import OrcaToolbar from '../components/creator/OrcaToolbar'
import PlanningPopup from '../components/creator/PlanningPopup'
import SecurityPopup from '../components/creator/SecurityPopup'
import CompliancePopup from '../components/creator/CompliancePopup'
import DeploymentsPopup from '../components/creator/DeploymentsPopup'
import DocumentationPopup from '../components/creator/DocumentationPopup'
import { generateContent, generateSingleAppStream, iterateAppDiff, addPage } from '../services/api'

const STORAGE_KEY = 'orca-app-creator-state'

function loadPersistedState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return null
}

export default function AppCreator() {
    const persisted = useMemo(() => loadPersistedState(), [])

    // ── State ─────────────────────────────────────────────
    const [htmlContent, setHtmlContent] = useState(persisted?.htmlContent || '')
    const [messages, setMessages] = useState(persisted?.messages || [])
    const [conversationHistory, setConversationHistory] = useState(persisted?.conversationHistory || [])
    const [pages, setPages] = useState(persisted?.pages || ['Home', 'About', 'Features', 'Contact'])
    const [isGenerating, setIsGenerating] = useState(false)
    const [appIdea, setAppIdea] = useState(persisted?.appIdea || '')
    const [viewport, setViewport] = useState(persisted?.viewport || 'desktop')
    const [statusText, setStatusText] = useState('')
    const [toast, setToast] = useState(null)
    const iframeRef = useRef(null)

    // 'idle' → 'content' → 'style' → 'generating' → 'done'
    const [stage, setStage] = useState(persisted?.stage || 'idle')
    const [generatedContent, setGeneratedContent] = useState(persisted?.generatedContent || null)
    const [designTokens, setDesignTokens] = useState(persisted?.designTokens || null)

    // ── Panel State
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [chatCollapsed, setChatCollapsed] = useState(false)
    const [chatWidth, setChatWidth] = useState(380)
    const [sidebarWidth, setSidebarWidth] = useState(260)

    // Popup state
    const [showPlanning, setShowPlanning] = useState(false)
    const [showSecurity, setShowSecurity] = useState(false)
    const [showCompliance, setShowCompliance] = useState(false)
    const [showDeployments, setShowDeployments] = useState(false)
    const [showDocumentation, setShowDocumentation] = useState(false)
    const chatResizing = useRef(false)
    const sidebarResizing = useRef(false)

    // ── Persist state to localStorage (debounced) ──
    const saveTimerRef = useRef(null)
    useEffect(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
            try {
                const state = {
                    htmlContent, messages, conversationHistory, pages,
                    appIdea, stage, generatedContent, designTokens, viewport
                }
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
            } catch { /* quota exceeded — ignore */ }
        }, 500)
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
    }, [htmlContent, messages, conversationHistory, pages, appIdea, stage, generatedContent, designTokens, viewport])

    // If persisted stage was 'generating' or 'content', reset to safe state
    useEffect(() => {
        if (persisted?.stage === 'generating' || persisted?.stage === 'content') {
            setStage(persisted.htmlContent ? 'done' : 'idle')
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Keyboard Shortcuts 
    useEffect(() => {
        const handler = (e) => {
            if (e.ctrlKey && e.key === 'b') { e.preventDefault(); setSidebarCollapsed(v => !v) }
            if (e.ctrlKey && e.key === 'j') { e.preventDefault(); setChatCollapsed(v => !v) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const handleChatResize = useCallback((e) => {
        e.preventDefault()
        chatResizing.current = true
        const startX = e.clientX
        const startWidth = chatWidth
        const onMove = (e) => {
            const delta = startX - e.clientX
            setChatWidth(Math.max(300, Math.min(600, startWidth + delta)))
        }
        const onUp = () => {
            chatResizing.current = false
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
    }, [chatWidth])

    const handleSidebarResize = useCallback((e) => {
        e.preventDefault()
        sidebarResizing.current = true
        const startX = e.clientX
        const startWidth = sidebarWidth
        const onMove = (e) => {
            const delta = e.clientX - startX
            setSidebarWidth(Math.max(200, Math.min(400, startWidth + delta)))
        }
        const onUp = () => {
            sidebarResizing.current = false
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
    }, [sidebarWidth])

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 4000)
    }, [])

    // ── Stage 1: Generate Content
    const handleContentGeneration = useCallback(async (prompt) => {
        setIsGenerating(true)
        setStage('content')
        setStatusText('Generating content...')
        setAppIdea(prompt)

        const userMsg = { role: 'user', content: prompt, timestamp: Date.now() }
        setMessages(prev => [...prev, userMsg])

        try {
            const result = await generateContent(prompt, 'html_css_js')
            setGeneratedContent(result.content)
            setStage('style')
            setStatusText('')
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `✅ Content generated for **${result.content?.app_name || prompt}**!\n\nNow choose your design theme →`,
                timestamp: Date.now(),
            }])
            showToast('✅ Content generated! Choose a theme.')
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ Content generation failed: ${err.message}`,
                timestamp: Date.now(),
                isError: true
            }])
            setStage('idle')
            setStatusText('')
        } finally {
            setIsGenerating(false)
        }
    }, [showToast])

    // SSE helper for App Stream
    const processAppStream = useCallback(async (response) => {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let fullHtml = ''

        const processLine = (line) => {
            if (!line.startsWith('data: ')) return
            let event
            try {
                event = JSON.parse(line.slice(6))
            } catch {
                return // ignore JSON parse errors only
            }
            if (event.type === 'thinking' || event.type === 'status') {
                setStatusText(event.content)
            } else if (event.type === 'stream') {
                // real-time typing effect placeholder
            } else if (event.type === 'done') {
                let html = event.html || ''
                // Strip markdown fences if LLM wrapped output
                html = html.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
                if (html) {
                    fullHtml = html
                    setHtmlContent(fullHtml)
                }
            } else if (event.type === 'error') {
                throw new Error(event.content || 'Generation failed on server')
            }
        }

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
                processLine(line)
            }
        }

        // Flush any remaining data in the buffer
        if (buffer.trim()) {
            processLine(buffer)
        }

        if (!fullHtml) {
            throw new Error('No HTML was generated. The AI may have returned an empty response — please try again.')
        }
        return fullHtml
    }, [])

    // ── Stage 3: Generate App
    const handleGenerateWithStyle = useCallback(async (tokens) => {
        setDesignTokens(tokens)
        setIsGenerating(true)
        setStage('generating')
        setStatusText('Starting HTML generation...')

        try {
            const response = await generateSingleAppStream(appIdea, '', generatedContent || {}, tokens)
            if (!response.ok) throw new Error(`HTTP ${response.status}`)

            const finalHtml = await processAppStream(response)

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '✅ Single-file app generated successfully!',
                timestamp: Date.now()
            }])
            setConversationHistory(prev => [...prev, {
                instruction: appIdea,
                summary: 'App generated'
            }])
            setStatusText('')
            setStage('done')
            showToast(`✅ Generated app successfully`)
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ Generation failed: ${err.message}`, timestamp: Date.now(), isError: true }])
            setStage('style')
        } finally {
            setIsGenerating(false)
            setStatusText('')
        }
    }, [appIdea, generatedContent, processAppStream, showToast])

    const handleGenerateDirect = useCallback(async (prompt) => {
        setIsGenerating(true)
        setStage('generating')
        setAppIdea(prompt)
        const userMsg = { role: 'user', content: prompt, timestamp: Date.now() }
        setMessages(prev => [...prev, userMsg])

        try {
            const response = await generateSingleAppStream(prompt, '', {}, {})
            if (!response.ok) throw new Error(`HTTP ${response.status}`)

            await processAppStream(response)

            setMessages(prev => [...prev, { role: 'assistant', content: '✅ App generated!', timestamp: Date.now() }])
            setConversationHistory(prev => [...prev, { instruction: prompt, summary: 'App generated' }])
            setStage('done')
            showToast(`✅ Generated app successfully`)
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ Generation failed: ${err.message}`, timestamp: Date.now(), isError: true }])
            setStage('idle')
        } finally {
            setIsGenerating(false)
            setStatusText('')
        }
    }, [processAppStream, showToast])

    // ── Iterate (Follow-up)
    const handleIterate = useCallback(async (prompt) => {
        if (!htmlContent) return handleGenerateDirect(prompt)

        setIsGenerating(true)
        setStatusText('Applying diff changes...')
        const userMsg = { role: 'user', content: prompt, timestamp: Date.now() }
        setMessages(prev => [...prev, userMsg])

        try {
            const result = await iterateAppDiff(prompt, htmlContent)
            if (result.error) throw new Error(result.error)

            const diffs = result.diff || []

            // 1. Send instant update to iframe
            iframeRef.current?.contentWindow?.postMessage({ action: 'APPLY_DIFF', diffs }, '*')

            // 2. Patch state HTML
            const parser = new DOMParser()
            const doc = parser.parseFromString(htmlContent, 'text/html')

            diffs.forEach(d => {
                const els = doc.querySelectorAll(d.selector)
                els.forEach(el => {
                    el.style[d.property] = d.value
                })
            })

            const newHtml = doc.documentElement.outerHTML
            setHtmlContent(newHtml)

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `✅ Applied ${diffs.length} change(s) successfully.`,
                timestamp: Date.now(),
            }])
            showToast(`✅ Applied changes`)
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ Iteration failed: ${err.message}`, timestamp: Date.now(), isError: true }])
        } finally {
            setIsGenerating(false)
            setStatusText('')
        }
    }, [htmlContent, handleGenerateDirect, showToast])

    const handleSubmit = useCallback((prompt) => {
        if (!htmlContent && stage === 'idle') handleContentGeneration(prompt)
        else if (stage === 'done' || htmlContent) handleIterate(prompt)
        else handleGenerateDirect(prompt)
    }, [htmlContent, stage, handleContentGeneration, handleIterate, handleGenerateDirect])

    const navigatePreview = useCallback((pageName) => {
        const path = pageName.toLowerCase() === 'home' ? '/' : `/${pageName.toLowerCase()}`
        iframeRef.current?.contentWindow?.postMessage({ action: 'NAVIGATE', path }, '*')
    }, [])

    // Add page
    const handleAddPage = useCallback(async (pageName) => {
        setPages(prev => [...prev, pageName])
        showToast(`✅ Added page: ${pageName}`)
    }, [showToast])
    const handleDeletePage = useCallback((page) => setPages(p => p.filter(x => x !== page)), [])

    // ── Clear Project ──
    const handleClearProject = useCallback(() => {
        if (!confirm('Are you sure you want to start a new project? All current work will be cleared.')) return
        localStorage.removeItem(STORAGE_KEY)
        setHtmlContent('')
        setMessages([])
        setConversationHistory([])
        setPages(['Home', 'About', 'Features', 'Contact'])
        setAppIdea('')
        setStage('idle')
        setGeneratedContent(null)
        setDesignTokens(null)
        setViewport('desktop')
        setStatusText('')
        showToast('🆕 Project cleared — ready for a fresh start!')
    }, [showToast])

    // mock file map for Sidebar
    const filesMap = htmlContent ? { 'index.html': htmlContent } : {}

    return (
        <div className="creator-outer-wrapper">
            {toast && <div className={`creator-toast ${toast.type}`}>{toast.message}</div>}

            {/* ORCA Pill Toolbar — full-width above workspace */}
            <OrcaToolbar
                onPlanningClick={() => setShowPlanning(true)}
                onSecurityClick={() => setShowSecurity(true)}
                onComplianceClick={() => setShowCompliance(true)}
                onDeploymentsClick={() => setShowDeployments(true)}
                onDocumentationClick={() => setShowDocumentation(true)}
            />

            <div className="creator-workspace">
                <div style={{ width: sidebarCollapsed ? 56 : sidebarWidth, flexShrink: 0, transition: 'width 0.2s ease' }}>
                    <LeftSidebar
                        files={filesMap}
                        selectedFile={htmlContent ? 'index.html' : null}
                        onSelectFile={() => { }} // single file context
                        pages={pages}
                        onAddPage={handleAddPage}
                        onDeletePage={handleDeletePage}
                        onNavigate={navigatePreview}
                        framework="html_css_js"
                        onFrameworkChange={() => { }} // disabled for app creator
                        isGenerating={isGenerating}
                        collapsed={sidebarCollapsed}
                        onToggleCollapse={() => setSidebarCollapsed(v => !v)}
                        stage={stage}
                        statusText={statusText}
                        onClearProject={handleClearProject}
                    />
                </div>

                {!sidebarCollapsed && <div className="creator-v-resize" onMouseDown={handleSidebarResize} />}

                <div className="creator-center">
                    {stage === 'style' ? (
                        <StylePicker
                            content={generatedContent}
                            onGenerate={handleGenerateWithStyle}
                            onBack={() => { setStage('idle'); setGeneratedContent(null) }}
                            isGenerating={isGenerating}
                        />
                    ) : (
                        <PreviewPanel
                            htmlContent={htmlContent}
                            setHtmlContent={setHtmlContent}
                            viewport={viewport}
                            onViewportChange={setViewport}
                            iframeRef={iframeRef}
                            pages={pages}
                        />
                    )}
                </div>

                {!chatCollapsed && <div className="creator-v-resize" onMouseDown={handleChatResize} />}

                <div className="creator-chat-wrapper" style={{ width: chatCollapsed ? 48 : chatWidth, transition: 'width 0.2s ease', flexShrink: 0 }}>
                    {chatCollapsed ? (
                        <div className="creator-chat-collapsed">
                            <button className="creator-chat-expand-btn" onClick={() => setChatCollapsed(false)} title="Open AI Chat">
                                <span className="creator-chat-expand-icon">💬</span>
                                <span className="creator-chat-expand-label">AI</span>
                            </button>
                        </div>
                    ) : (
                        <div className="creator-chat-full">
                            <div className="creator-chat-header">
                                <div className="creator-chat-header-left">
                                    <span className="creator-chat-header-dot" />
                                    <span className="creator-chat-header-title">AI Assistant</span>
                                </div>
                                <button className="creator-icon-btn" onClick={() => setChatCollapsed(true)} title="Collapse Chat">
                                    <span style={{ fontSize: 16 }}>×</span>
                                </button>
                            </div>
                            <ChatPanel
                                messages={messages}
                                onSubmit={handleSubmit}
                                isGenerating={isGenerating}
                                statusText={statusText}
                                hasFiles={!!htmlContent}
                                stage={stage}
                            />
                        </div>
                    )}
                </div>
            </div> {/* end creator-workspace */}

            {/* Popups — rendered outside workspace to avoid z-index issues */}
            {showPlanning && <PlanningPopup files={filesMap} appIdea={appIdea} onClose={() => setShowPlanning(false)} />}
            {showSecurity && <SecurityPopup files={filesMap} onUpdateFile={(name, content) => setHtmlContent(content)} onClose={() => setShowSecurity(false)} />}
            {showCompliance && <CompliancePopup files={filesMap} onUpdateFile={(name, content) => setHtmlContent(content)} onClose={() => setShowCompliance(false)} />}
            {showDeployments && <DeploymentsPopup files={filesMap} repoName={appIdea?.split(' ')[0]?.toLowerCase() || 'orca-app'} onClose={() => setShowDeployments(false)} />}
            {showDocumentation && <DocumentationPopup files={filesMap} appIdea={appIdea} pages={pages} onClose={() => setShowDocumentation(false)} />}
        </div>
    )
}
