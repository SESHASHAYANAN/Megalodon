// Use the environment variable if defined (for Vercel Deployments), otherwise fallback to the local proxy
const API = import.meta.env.VITE_API_URL || '/api';

// ── GitHub ────────────────────────────────────────────────────────────────
export async function searchRepos(query, language) {
    const params = new URLSearchParams({ q: query });
    if (language) params.set('language', language);
    const r = await fetch(`${API}/github/search?${params}`, { credentials: 'include' });
    if (!r.ok) throw new Error('Search failed');
    return r.json();
}

export async function getRepo(owner, repo) {
    const r = await fetch(`${API}/github/repo/${owner}/${repo}`, { credentials: 'include' });
    if (!r.ok) throw new Error('Repo not found');
    return r.json();
}

export async function getRepoTree(owner, repo) {
    const r = await fetch(`${API}/github/tree/${owner}/${repo}`, { credentials: 'include' });
    if (!r.ok) throw new Error('Tree not found');
    return r.json();
}

export async function getFileContent(owner, repo, path) {
    const r = await fetch(`${API}/github/file/${owner}/${repo}/${path}`, { credentials: 'include' });
    if (!r.ok) throw new Error('File not found');
    return r.json();
}

// ── GitHub OAuth ──────────────────────────────────────────────────────────
// Auth redirect must go directly to the backend (not through Vercel proxy)
// because Vercel Deployment Protection blocks proxy requests.
const BACKEND_URL = import.meta.env.VITE_API_URL || API;

export function getAuthUrl() {
    // This URL triggers a 302 redirect to GitHub's authorize page
    return `${BACKEND_URL}/auth/github`;
}

export async function getGitHubUser() {
    const r = await fetch(`${API}/auth/github/me`, { credentials: 'include' });
    if (!r.ok) return { authenticated: false };
    return r.json();
}

export async function getUserRepos(page = 1) {
    const r = await fetch(`${API}/github/user/repos?page=${page}`, { credentials: 'include' });
    if (!r.ok) throw new Error('Failed to fetch repos');
    return r.json();
}

export async function pushChanges(owner, repo, files, commitMessage) {
    const r = await fetch(`${API}/github/push-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ owner, repo, files, commit_message: commitMessage }),
    });
    if (!r.ok) throw new Error('Push failed');
    return r.json();
}

export async function logoutGitHub() {
    const r = await fetch(`${API}/auth/github/logout`, {
        method: 'POST',
        credentials: 'include',
    });
    return r.json();
}

export async function pushToGitHub(repoName, files, commitMessage = 'Deploy from ORCA', isPrivate = false) {
    const r = await fetch(`${API}/github/push-to-github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            repo_name: repoName,
            files,
            commit_message: commitMessage,
            private: isPrivate,
        }),
    });
    if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.detail || 'Push to GitHub failed');
    }
    return r.json();
}

// ── AI ────────────────────────────────────────────────────────────────────
export async function explainCode(code, filename, context) {
    const r = await fetch(`${API}/ai/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, filename, context }),
    });
    if (!r.ok) throw new Error('Explain failed');
    return r.json();
}

export async function improveCode(code, filename, instruction) {
    const r = await fetch(`${API}/ai/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, filename, instruction }),
    });
    if (!r.ok) throw new Error('Improve failed');
    return r.json();
}

export async function generateApp(idea, tech_stack, design_hints, design_proposal, image_urls, pages, backend_enabled, backend_framework) {
    const r = await fetch(`${API}/ai/generate-app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, tech_stack, design_hints, design_proposal, image_urls, pages, backend_enabled, backend_framework }),
    });
    if (!r.ok) throw new Error('Generation failed');
    return r.json();
}

export async function iterateApp(instruction, current_files, tech_stack, conversation_history) {
    const r = await fetch(`${API}/ai/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, current_files, tech_stack, conversation_history }),
    });
    if (!r.ok) throw new Error('Iteration failed');
    return r.json();
}

// ── App Creator SSE Streams ──────────────────────────────────────────────
export function generateAppStream(idea, tech_stack, pages, design_hints = '', backend_enabled = false, backend_framework = 'fastapi', content = {}, designTokens = {}) {
    return fetch(`${API}/ai/generate-app-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, tech_stack, design_hints, pages, backend_enabled, backend_framework, content, design_tokens: designTokens }),
    });
}

export function iterateAppStream(instruction, current_files, tech_stack, conversation_history = []) {
    return fetch(`${API}/ai/iterate-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, current_files, tech_stack, conversation_history }),
    });
}

export function generateSingleAppStream(idea, design_hints = '', content = {}, designTokens = {}) {
    return fetch(`${API}/ai/generate-single-file-app-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, design_hints, content, design_tokens: designTokens }),
    });
}

export async function iterateAppDiff(instruction, current_html) {
    const r = await fetch(`${API}/ai/iterate-app-diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, current_html }),
    });
    if (!r.ok) throw new Error('Iterate diff failed');
    return r.json();
}

// ── Content Generation (Stage 1) ────────────────────────────────────────
export async function generateContent(idea, framework = 'html_css_js') {
    const r = await fetch(`${API}/ai/generate-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, framework }),
    });
    if (!r.ok) throw new Error('Content generation failed');
    return r.json();
}

export async function addPage(page_name, existing_files, framework, idea) {
    const r = await fetch(`${API}/ai/add-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_name, existing_files, framework, idea }),
    });
    if (!r.ok) throw new Error('Add page failed');
    return r.json();
}

export async function chatWithAI(message, context, history) {
    const r = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context, history }),
    });
    if (!r.ok) throw new Error('Chat failed');
    return r.json();
}

// ── Repo Summary ──────────────────────────────────────────────────────────
export async function getRepoSummary(message, context) {
    const r = await fetch(`${API}/ai/repo-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context }),
    });
    if (!r.ok) throw new Error('Summary failed');
    return r.json();
}

// ── Feature-Specific Analysis ─────────────────────────────────────────────
export async function analyzeIssues(owner, repo, filePaths) {
    const r = await fetch(`${API}/ai/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, file_paths: filePaths }),
    });
    if (!r.ok) throw new Error('Issues analysis failed');
    return r.json();
}

export async function analyzePulls(owner, repo, filePaths) {
    const r = await fetch(`${API}/ai/pulls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, file_paths: filePaths }),
    });
    if (!r.ok) throw new Error('PR analysis failed');
    return r.json();
}

export async function analyzeWiki(owner, repo, filePaths) {
    const r = await fetch(`${API}/ai/wiki`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, file_paths: filePaths }),
    });
    if (!r.ok) throw new Error('Wiki generation failed');
    return r.json();
}

export async function analyzeSecurity(owner, repo, filePaths) {
    const r = await fetch(`${API}/ai/security-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, file_paths: filePaths }),
    });
    if (!r.ok) throw new Error('Security scan failed');
    return r.json();
}

export async function analyzeInsights(owner, repo, filePaths) {
    const r = await fetch(`${API}/ai/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, file_paths: filePaths }),
    });
    if (!r.ok) throw new Error('Insights analysis failed');
    return r.json();
}

// ── Sandbox ───────────────────────────────────────────────────────────────
export async function createSandbox(owner, repo, files) {
    const r = await fetch(`${API}/sandbox/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, files }),
    });
    if (!r.ok) throw new Error('Sandbox creation failed');
    return r.json();
}

export async function getSandbox(id) {
    const r = await fetch(`${API}/sandbox/${id}`);
    if (!r.ok) throw new Error('Sandbox not found');
    return r.json();
}

export async function getSandboxFile(id, path) {
    const r = await fetch(`${API}/sandbox/${id}/file/${path}`);
    if (!r.ok) throw new Error('File not found');
    return r.json();
}

export async function sandboxEdit(id, instruction) {
    const r = await fetch(`${API}/sandbox/${id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
    });
    if (!r.ok) throw new Error('Edit failed');
    return r.json();
}

export async function sandboxPreview(id) {
    const r = await fetch(`${API}/sandbox/${id}/preview`, {
        method: 'POST',
    });
    if (!r.ok) throw new Error('Preview failed');
    return r.json();
}

// ── Design App ────────────────────────────────────────────────────────────
export async function designApp(idea, target_users, style) {
    const r = await fetch(`${API}/ai/design-app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, target_users, style }),
    });
    if (!r.ok) throw new Error('Design failed');
    return r.json();
}

// ── ORCA Agent (SSE) ─────────────────────────────────────────────────────────
// Every call MUST include project_root. Backend validates os.path.exists(project_root).
export function runAgentStream(projectRoot, task) {
    if (!projectRoot || !projectRoot.trim()) {
        throw new Error('project_root is required. Please open a project folder first.');
    }
    return fetch(`${API}/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            project_root: projectRoot.trim(),
            task: task.trim(),
        }),
    });
}

// Legacy alias — do NOT use in new code
export const codingAgentStream = runAgentStream;


// ── Preview Server ───────────────────────────────────────────────────────
export async function startPreview(files, projectId = null) {
    const r = await fetch(`${API}/preview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, project_id: projectId }),
    });
    if (!r.ok) throw new Error('Failed to start preview');
    return r.json();
}

export async function stopPreview(projectId) {
    const r = await fetch(`${API}/preview/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
    });
    return r.json();
}

export async function getPreviewStatus(projectId) {
    const r = await fetch(`${API}/preview/status/${projectId}`);
    if (!r.ok) throw new Error('Failed to get preview status');
    return r.json();
}

export async function reloadPreview(projectId, files = null) {
    const r = await fetch(`${API}/preview/reload/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, files }),
    });
    return r.json();
}

export async function detectProjectType(files) {
    const r = await fetch(`${API}/preview/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
    });
    if (!r.ok) throw new Error('Failed to detect project type');
    return r.json();
}


// ── Krea AI Image Generation ─────────────────────────────────────────────
export async function generateImage(prompt, idea = '') {
    const r = await fetch(`${API}/ai/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, idea }),
    });
    if (!r.ok) throw new Error('Image generation failed');
    return r.json();
}


// ── Test Cases ───────────────────────────────────────────────────────────
export async function runTestCases(owner, repo, filePaths = []) {
    const r = await fetch(`${API}/ai/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, file_paths: filePaths }),
    });
    if (!r.ok) throw new Error('Test case generation failed');
    return r.json();
}

// ── Test Cases SSE Stream ────────────────────────────────────────────────
export function runTestCasesStream(owner, repo, filePaths = []) {
    return fetch(`${API}/ai/test-cases-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, file_paths: filePaths }),
    });
}

// ── Code Review SSE Stream ───────────────────────────────────────────────
export function streamCodeReview(code, filename) {
    return fetch(`${API}/ai/code-review-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, filename }),
    });
}

// ── Explain Codebase SSE Stream ──────────────────────────────────────
export function streamExplainCodebase(owner, repo, filePaths = []) {
    return fetch(`${API}/ai/explain-codebase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, file_paths: filePaths }),
    });
}

// ── Explain Purpose SSE Stream ───────────────────────────────────────
export function streamExplainPurpose(code, filename, context = '') {
    return fetch(`${API}/ai/explain-purpose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, filename, context }),
    });
}

// ── Mapping — Code Flow Visualizer ──────────────────────────────────────
export async function getMapping(owner, repo, filePaths = []) {
    const r = await fetch(`${API}/ai/mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, file_paths: filePaths }),
    });
    if (!r.ok) throw new Error('Mapping request failed');
    return r.json();
}

// ── Node Summary ────────────────────────────────────────────────────────
export async function getNodeSummary(owner, repo, filepath) {
    const r = await fetch(`${API}/ai/node-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, filepath }),
    });
    if (!r.ok) throw new Error('Node summary request failed');
    return r.json();
}

// ── Architecture — Project Layers ───────────────────────────────────────
export async function getArchitecture(owner, repo, filePaths = []) {
    const r = await fetch(`${API}/ai/architecture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, file_paths: filePaths }),
    });
    if (!r.ok) throw new Error('Architecture request failed');
    return r.json();
}

// ── Scope Map — Interactive code structure ──────────────────────────────
export async function getScopeMap(owner, repo, filePaths = []) {
    const r = await fetch(`${API}/ai/scope-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, file_paths: filePaths }),
    });
    if (!r.ok) throw new Error('Scope map request failed');
    return r.json();
}

// ── Test Report PDF ─────────────────────────────────────────────────────
export async function exportTestReportPDF(data) {
    const r = await fetch(`${API}/ai/test-report-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error('PDF report generation failed');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ORCA_TestReport_${data.owner || 'project'}_${data.repo || 'tests'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── File Write / Backup / Revert (Security Fix-All) ──────────────────────
export async function writeSourceFile(filePath, content, projectRoot = '') {
    const r = await fetch(`${API}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, content, project_root: projectRoot }),
    });
    if (!r.ok) throw new Error('File write failed');
    return r.json();
}

export async function backupSourceFile(filePath, projectRoot = '') {
    const r = await fetch(`${API}/files/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, project_root: projectRoot }),
    });
    if (!r.ok) throw new Error('File backup failed');
    return r.json();
}

export async function revertSourceFile(filePath, projectRoot = '') {
    const r = await fetch(`${API}/files/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, project_root: projectRoot }),
    });
    if (!r.ok) throw new Error('File revert failed');
    return r.json();
}

export async function runRegressionTest(filePath, fixDescription = '', content = '') {
    const r = await fetch(`${API}/ai/regression-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, fix_description: fixDescription, content }),
    });
    if (!r.ok) throw new Error('Regression test failed');
    return r.json();
}

// ── GitHub Pages Real Deployment (SSE streaming) ──────────────────────
export async function deployToGitHubPagesStream(repoName, files, onEvent) {
    const r = await fetch(`${API}/deploy/github-pages-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ repo_name: repoName, files }),
    });
    if (!r.ok) throw new Error(`Deploy request failed: ${r.status}`);

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const event = JSON.parse(line.slice(6));
                    if (onEvent) onEvent(event);
                } catch (e) { /* skip malformed SSE */ }
            }
        }
    }
}

// ── Video Visualization ──────────────────────────────────────────────────
export async function generateVideo(repoUrl) {
    const r = await fetch(`${API}/video/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl }),
    });
    if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.detail || 'Video generation failed');
    }
    return r.json();
}

export async function getVideoStatus(projectId) {
    const r = await fetch(`${API}/video/status/${projectId}`);
    if (!r.ok) throw new Error('Status check failed');
    return r.json();
}

// ── Visualization Endpoints ──────────────────────────────────────────────
export async function getVisualOverview(repoUrl) {
    const r = await fetch(`${API}/visualize/overview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl }),
    });
    if (!r.ok) throw new Error('Overview request failed');
    return r.json();
}

export async function getVisualErrors(repoUrl) {
    const r = await fetch(`${API}/visualize/errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl }),
    });
    if (!r.ok) throw new Error('Error scan failed');
    return r.json();
}

export async function getVisualDataflow(repoUrl) {
    const r = await fetch(`${API}/visualize/dataflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl }),
    });
    if (!r.ok) throw new Error('Dataflow analysis failed');
    return r.json();
}
