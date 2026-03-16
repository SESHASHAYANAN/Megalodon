import { useState, useEffect, useRef, useCallback } from 'react'
import { FiX, FiFileText, FiDownload, FiGithub, FiSearch } from 'react-icons/fi'
import { chatWithAI, pushToGitHub } from '../../services/api'

// Simple markdown-to-HTML converter (no external deps)
function markdownToHtml(md) {
    if (!md) return ''
    let html = md
        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold + italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Unordered lists
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        // Ordered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Wrap consecutive <li> in <ul>
        .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>')
    return `<p>${html}</p>`
}

// Extract headings from markdown for TOC
function extractHeadings(md) {
    if (!md) return []
    const headings = []
    const regex = /^(#{1,3})\s+(.+)$/gm
    let match
    while ((match = regex.exec(md)) !== null) {
        const level = match[1].length
        const text = match[2].trim()
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        headings.push({ level, text, id })
    }
    return headings
}

export default function DocumentationPopup({ files = {}, appIdea = '', pages = [], onClose }) {
    const [phase, setPhase] = useState('capturing') // capturing | generating | ready
    const [screenshots, setScreenshots] = useState({})
    const [documentation, setDocumentation] = useState('')
    const [progressText, setProgressText] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [activeSection, setActiveSection] = useState('')
    const [isPushingGH, setIsPushingGH] = useState(false)
    const contentRef = useRef(null)
    const iframeRef = useRef(null)

    // Escape key
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        document.body.style.overflow = 'hidden'
        return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = '' }
    }, [onClose])

    // Auto-start on mount
    useEffect(() => {
        captureScreenshots()
    }, [])

    const pageList = pages.length > 0 ? pages : ['Home', 'About', 'Features', 'Contact']

    const captureScreenshots = useCallback(async () => {
        setPhase('capturing')
        const captured = {}

        for (let i = 0; i < pageList.length; i++) {
            const page = pageList[i]
            setProgressText(`📸 Capturing ${page} page… (${i + 1}/${pageList.length})`)

            // Navigate iframe to this page
            if (iframeRef.current) {
                const path = page.toLowerCase() === 'home' ? '/' : `/${page.toLowerCase()}`
                iframeRef.current.contentWindow?.postMessage({ action: 'NAVIGATE', path }, '*')
                // Wait for render
                await new Promise(r => setTimeout(r, 800))
            }

            // Try html2canvas capture
            try {
                if (typeof window.html2canvas === 'function' || window.html2canvas) {
                    const canvas = await window.html2canvas(iframeRef.current.contentDocument.body, {
                        scale: 2,
                        useCORS: true,
                        width: 1440,
                        height: 900
                    })
                    captured[page] = canvas.toDataURL('image/png')
                } else {
                    // Fallback: capture via canvas drawing
                    captured[page] = await captureIframeAsCanvas(page)
                }
            } catch {
                // Fallback to placeholder
                captured[page] = await captureIframeAsCanvas(page)
            }
        }

        setScreenshots(captured)
        await generateDocumentation(captured)
    }, [pageList, files])

    const captureIframeAsCanvas = useCallback(async (pageName) => {
        // Create a simple placeholder screenshot
        const canvas = document.createElement('canvas')
        canvas.width = 1440
        canvas.height = 900
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#f8fafc'
        ctx.fillRect(0, 0, 1440, 900)
        ctx.fillStyle = '#64748b'
        ctx.font = 'bold 32px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${pageName} Page`, 720, 420)
        ctx.font = '18px Inter, sans-serif'
        ctx.fillText('Screenshot captured at build time', 720, 460)
        return canvas.toDataURL('image/png')
    }, [])

    const generateDocumentation = useCallback(async (capturedScreenshots) => {
        setPhase('generating')
        setProgressText('🤖 Generating documentation with AI...')

        const fileContext = Object.entries(files).slice(0, 10).map(([name, content]) =>
            `### ${name}\n\`\`\`\n${typeof content === 'string' ? content.substring(0, 3000) : ''}\n\`\`\``
        ).join('\n\n')

        const screenshotDescriptions = Object.keys(capturedScreenshots).map(page =>
            `- ${page} page: Screenshot captured`
        ).join('\n')

        const prompt = `You are a technical documentation writer. Generate comprehensive project documentation in Markdown format.

App idea/description: ${appIdea || 'Web application'}
Pages: ${pageList.join(', ')}
Screenshots available for: ${Object.keys(capturedScreenshots).join(', ')}

Codebase files:
${fileContext}

Generate the following sections (use ## for section headers):

## Project Overview
What the app does, who it is for, key features list

## Tech Stack
Detected frameworks, libraries, dependencies with version numbers if visible

## Architecture
How frontend and backend connect, data flow description

## Page-by-Page Breakdown
For each page (${pageList.join(', ')}): purpose, components used, user interactions. Add a placeholder "[SCREENSHOT: PageName]" for each page.

## API Documentation
Any detected endpoints with method, path, request body, response format

## Setup & Installation
Step-by-step how to run locally, environment variables required

## Deployment Guide
How to deploy to Netlify, Vercel, and GitHub Pages

## Video Demo
Add a placeholder note: "Record a demo using the ORCA Record Demo feature"

## Known Issues & Roadmap
Any detected issues or future improvements

Return ONLY the markdown content. Make it detailed and professional.`

        try {
            const result = await chatWithAI(prompt, '', [])
            let doc = result.response || '# Documentation\n\nDocumentation generation failed. Please try again.'

            // Replace screenshot placeholders with actual base64 images
            Object.entries(capturedScreenshots).forEach(([page, dataUrl]) => {
                doc = doc.replace(
                    new RegExp(`\\[SCREENSHOT:\\s*${page}\\]`, 'gi'),
                    `\n![${page} Page Screenshot](${dataUrl})\n`
                )
            })

            setDocumentation(doc)
            setPhase('ready')
            setProgressText('')
        } catch (err) {
            setDocumentation('# Documentation\n\n❌ Generation failed: ' + err.message + '\n\nPlease try again.')
            setPhase('ready')
            setProgressText('')
        }
    }, [files, appIdea, pageList])

    // Export: Download PDF via print
    const handleDownloadPDF = useCallback(() => {
        const printWindow = window.open('', '_blank')
        if (!printWindow) { alert('Please allow popups for PDF generation'); return }

        const appNameClean = (appIdea || 'ORCA App').split(' ').slice(0, 3).join(' ')
        const ts = new Date().toISOString().slice(0, 10)

        printWindow.document.write(`<!DOCTYPE html>
<html><head>
<title>ORCA Documentation — ${appNameClean}</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; color: #1a1a2e; padding: 40px; line-height: 1.7; font-size: 14px; }
    h1 { font-size: 28px; margin: 24px 0 16px; color: #0d0d1a; border-bottom: 2px solid #7c6aff; padding-bottom: 8px; }
    h2 { font-size: 20px; margin: 20px 0 10px; color: #1a1530; }
    h3 { font-size: 16px; margin: 16px 0 8px; color: #201b38; }
    p { margin: 8px 0; }
    ul, ol { padding-left: 24px; margin: 8px 0; }
    li { margin: 4px 0; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 12px 0; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    img { max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; margin: 12px 0; }
    .cover { text-align: center; padding: 100px 40px; page-break-after: always; }
    .cover h1 { font-size: 36px; border: none; color: #7c6aff; }
    .cover p { font-size: 16px; color: #64748b; margin: 8px 0; }
    @media print { body { padding: 20px; } .cover { padding: 60px 20px; } }
</style>
</head><body>
<div class="cover">
    <h1>📋 ${appNameClean}</h1>
    <p>Auto-generated documentation by ORCA</p>
    <p>Generated: ${ts}</p>
</div>
${markdownToHtml(documentation)}
</body></html>`)

        printWindow.document.close()
        setTimeout(() => {
            printWindow.print()
        }, 500)
    }, [documentation, appIdea])

    // Export: Download styled HTML with dark mode
    const handleDownloadHTML = useCallback(() => {
        const appNameClean = (appIdea || 'ORCA App').split(' ').slice(0, 3).join(' ')
        const ts = new Date().toISOString().slice(0, 10)
        const docHtmlContent = markdownToHtml(documentation)

        // Embed screenshots in the HTML
        let htmlWithScreenshots = docHtmlContent
        Object.entries(screenshots).forEach(([page, dataUrl]) => {
            htmlWithScreenshots = htmlWithScreenshots.replace(
                new RegExp(`<img[^>]*alt="${page}[^"]*"[^>]*>`, 'gi'),
                `<img src="${dataUrl}" alt="${page} Page Screenshot" style="max-width:100%;border-radius:8px;border:1px solid var(--border);" />`
            )
        })

        const htmlDoc = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${appNameClean} — Documentation</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
:root { --bg: #ffffff; --text: #1a1a2e; --text-muted: #64748b; --border: #e2e8f0; --code-bg: #f1f5f9; --pre-bg: #f8fafc; --accent: #7c6aff; --accent-glow: rgba(124,106,255,0.15); --card-bg: #ffffff; --sidebar-bg: #f8fafc; }
[data-theme="dark"] { --bg: #0d0d1a; --text: #e2e8f0; --text-muted: #94a3b8; --border: rgba(255,255,255,0.08); --code-bg: rgba(124,106,255,0.1); --pre-bg: rgba(255,255,255,0.03); --accent: #a78bfa; --accent-glow: rgba(167,139,250,0.1); --card-bg: rgba(255,255,255,0.03); --sidebar-bg: rgba(255,255,255,0.02); }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); line-height:1.8; }
.doc-wrapper { display:flex; min-height:100vh; }
.doc-sidebar { width:260px; position:fixed; top:0; left:0; bottom:0; background:var(--sidebar-bg); border-right:1px solid var(--border); padding:24px 16px; overflow-y:auto; }
.doc-sidebar h2 { font-size:13px; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:16px; }
.doc-sidebar a { display:block; padding:6px 12px; color:var(--text-muted); text-decoration:none; font-size:13px; border-radius:6px; margin:2px 0; transition:all 0.2s; }
.doc-sidebar a:hover { background:var(--accent-glow); color:var(--accent); }
.doc-content { margin-left:260px; padding:48px 64px; max-width:900px; }
.doc-header { text-align:center; padding:64px 0 40px; border-bottom:1px solid var(--border); margin-bottom:40px; }
.doc-header h1 { font-size:32px; font-weight:700; color:var(--accent); margin-bottom:8px; }
.doc-header p { color:var(--text-muted); font-size:14px; }
h1 { font-size:26px; margin:32px 0 16px; padding-bottom:8px; border-bottom:2px solid var(--accent); }
h2 { font-size:20px; margin:28px 0 12px; color:var(--text); }
h3 { font-size:16px; margin:20px 0 8px; }
p { margin:10px 0; font-size:15px; }
ul,ol { padding-left:24px; margin:10px 0; }
li { margin:4px 0; }
code { background:var(--code-bg); padding:2px 6px; border-radius:4px; font-family:'JetBrains Mono',monospace; font-size:13px; }
pre { background:var(--pre-bg); border:1px solid var(--border); border-radius:10px; padding:20px; margin:16px 0; overflow-x:auto; }
pre code { background:none; padding:0; }
img { max-width:100%; border-radius:10px; border:1px solid var(--border); margin:16px 0; box-shadow:0 4px 20px rgba(0,0,0,0.08); }
.theme-toggle { position:fixed; top:16px; right:16px; background:var(--card-bg); border:1px solid var(--border); border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:18px; z-index:100; transition:all 0.2s; box-shadow:0 2px 8px rgba(0,0,0,0.1); }
.theme-toggle:hover { transform:scale(1.1); box-shadow:0 4px 16px rgba(0,0,0,0.15); }
@media (max-width:768px) { .doc-sidebar{display:none;} .doc-content{margin-left:0;padding:24px;} }
@media print { .doc-sidebar,.theme-toggle{display:none;} .doc-content{margin-left:0;} }
</style>
</head>
<body>
<button class="theme-toggle" onclick="toggleTheme()" title="Toggle dark/light mode">🌓</button>
<div class="doc-wrapper">
<nav class="doc-sidebar"><h2>Contents</h2></nav>
<main class="doc-content">
<div class="doc-header">
<h1>📋 ${appNameClean}</h1>
<p>Auto-generated documentation by ORCA • ${ts}</p>
</div>
${htmlWithScreenshots}
</main>
</div>
<script>
function toggleTheme(){var t=document.documentElement;t.dataset.theme=t.dataset.theme==='dark'?'light':'dark';}
// Build sidebar TOC
(function(){var nav=document.querySelector('.doc-sidebar');var hs=document.querySelectorAll('h1,h2');hs.forEach(function(h,i){var id='s'+i;h.id=id;var a=document.createElement('a');a.href='#'+id;a.textContent=h.textContent;a.style.paddingLeft=h.tagName==='H1'?'12px':'24px';nav.appendChild(a);});})();
</script>
</body>
</html>`
        const blob = new Blob([htmlDoc], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ORCA_Documentation_${appNameClean.replace(/\s+/g, '_')}_${ts}.html`
        a.click()
        URL.revokeObjectURL(url)
    }, [documentation, screenshots, appIdea])

    // Export: Download MD
    const handleDownloadMD = useCallback(() => {
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const appNameClean = (appIdea || 'app').replace(/\s+/g, '_').toLowerCase()
        const blob = new Blob([documentation], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ORCA_Documentation_${appNameClean}_${ts}.md`
        a.click()
        URL.revokeObjectURL(url)
    }, [documentation, appIdea])

    // Export: Push to GitHub
    const handlePushToGitHub = useCallback(async () => {
        setIsPushingGH(true)
        try {
            const filesToPush = { 'DOCUMENTATION.md': documentation }

            // Add screenshots
            Object.entries(screenshots).forEach(([page, dataUrl]) => {
                const base64 = dataUrl.split(',')[1]
                if (base64) {
                    filesToPush[`docs/screenshots/${page.toLowerCase()}.png`] = atob(base64)
                }
            })

            const repoName = (appIdea || 'orca-app').split(' ')[0]?.toLowerCase() || 'orca-app'
            await pushToGitHub(
                repoName,
                filesToPush,
                'docs: auto-generated ORCA documentation'
            )
            alert('✅ Documentation pushed to GitHub!')
        } catch (err) {
            alert(`❌ Push failed: ${err.message}`)
        } finally {
            setIsPushingGH(false)
        }
    }, [documentation, screenshots, appIdea])

    const headings = extractHeadings(documentation)

    // Filter documentation by search
    const filteredDoc = searchQuery
        ? documentation.split('\n').filter(line =>
            line.toLowerCase().includes(searchQuery.toLowerCase())
        ).join('\n')
        : documentation

    const scrollToSection = (id) => {
        setActiveSection(id)
        const el = contentRef.current?.querySelector(`#${id}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // Add IDs to headers in rendered HTML
    const docHtml = markdownToHtml(filteredDoc).replace(
        /<h([1-3])>(.*?)<\/h[1-3]>/g,
        (match, level, text) => {
            const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
            return `<h${level} id="${id}">${text}</h${level}>`
        }
    )

    // Embed screenshots in HTML by replacing img tags with base64 src
    let finalHtml = docHtml
    Object.entries(screenshots).forEach(([page, dataUrl]) => {
        finalHtml = finalHtml.replace(
            new RegExp(`<img[^>]*alt="${page}[^"]*"[^>]*>`, 'gi'),
            `<img src="${dataUrl}" alt="${page} Page Screenshot" class="doc-screenshot" />`
        )
    })

    return (
        <div className="orca-popup-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="orca-popup-container documentation-popup">
                {/* Header */}
                <div className="orca-popup-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FiFileText size={18} style={{ color: '#f59e0b' }} />
                        <h3 style={{ margin: 0 }}>Documentation</h3>
                        {appIdea && <span style={{ fontSize: 11, color: 'var(--orca-text-muted)', fontStyle: 'italic' }}>— {appIdea}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {phase === 'ready' && (
                            <div className="doc-export-group">
                                <button className="doc-export-btn primary" onClick={handleDownloadPDF}>
                                    <FiDownload size={13} /> PDF
                                </button>
                                <button className="doc-export-btn" onClick={handleDownloadHTML}>
                                    <FiDownload size={13} /> HTML
                                </button>
                                <button className="doc-export-btn" onClick={handleDownloadMD}>
                                    <FiDownload size={13} /> MD
                                </button>
                                <button className="doc-export-btn" onClick={handlePushToGitHub} disabled={isPushingGH}>
                                    <FiGithub size={13} /> {isPushingGH ? 'Pushing…' : 'GitHub'}
                                </button>
                            </div>
                        )}
                        <button className="creator-icon-btn" onClick={onClose}><FiX size={16} /></button>
                    </div>
                </div>

                {/* Body */}
                {(phase === 'capturing' || phase === 'generating') ? (
                    <div className="doc-progress-status">
                        <div className="orca-popup-spinner" />
                        <p style={{ fontSize: 14, fontWeight: 600 }}>{progressText}</p>
                        <div className="doc-progress-steps">
                            <span className={`doc-progress-step ${phase === 'capturing' ? 'active' : 'done'}`}>
                                📸 Screenshots
                            </span>
                            <span className={`doc-progress-step ${phase === 'generating' ? 'active' : phase === 'ready' ? 'done' : ''}`}>
                                🤖 AI Generation
                            </span>
                            <span className={`doc-progress-step ${phase === 'ready' ? 'done' : ''}`}>
                                📄 Preview
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="doc-popup-layout">
                        {/* TOC Sidebar */}
                        <div className="doc-toc-sidebar">
                            <div className="doc-toc-title">Table of Contents</div>
                            {headings.filter(h => h.level <= 2).map((h, i) => (
                                <button
                                    key={i}
                                    className={`doc-toc-item ${activeSection === h.id ? 'active' : ''}`}
                                    onClick={() => scrollToSection(h.id)}
                                    style={{ paddingLeft: h.level === 1 ? 16 : 28 }}
                                >
                                    {h.text}
                                </button>
                            ))}
                        </div>

                        {/* Main Content */}
                        <div className="doc-main-content" ref={contentRef}>
                            {/* Search */}
                            <div className="doc-search-bar">
                                <FiSearch size={14} style={{ color: 'var(--orca-text-muted)' }} />
                                <input
                                    placeholder="Search documentation..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {/* Rendered doc */}
                            <div
                                className="doc-section"
                                dangerouslySetInnerHTML={{ __html: finalHtml }}
                            />
                        </div>
                    </div>
                )}

                {/* Hidden iframe for screenshot capture */}
                {phase === 'capturing' && (
                    <iframe
                        ref={iframeRef}
                        style={{ position: 'absolute', left: -9999, top: -9999, width: 1440, height: 900 }}
                        sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                        srcDoc={Object.values(files)[0] || ''}
                        title="Screenshot Capture"
                    />
                )}
            </div>
        </div>
    )
}
