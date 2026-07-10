/**
 * popup.js
 * ========
 * Controller for the AI-One browser action popup (380×560 px).
 *
 * Views:
 *   home    — landing screen with context panel and suggestion chips
 *   chat    — message thread with workflow pipeline sidebar
 *   history — searchable list of past conversations
 *
 * The popup extracts page context from the active tab via content.js,
 * then injects it into every outgoing message before sending to the backend.
 */

import { chatRequest }                                                  from './shared/api.js';
import { renderWorkflow, animateWorkflowLoading, resetWorkflow }        from './shared/workflow.js';
import { renderMarkdown }                                               from './shared/markdown.js';
import { loadHistory, saveConversation, deleteConversation, clearHistory } from './shared/history.js';
import { summarizeContext, buildContextPrompt }                         from './shared/context.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Placeholder step labels displayed while the backend is processing. */
const LOADING_STEPS = ['Intent Detection', 'Planning', 'Execution', 'Review', 'Judge'];

/** Emoji map for the context banner (keyed by site name). */
const SITE_EMOJI = {
    leetcode: '💻', github: '🐙', linkedin: '💼', youtube: '▶️',
    gmail: '✉️', stackoverflow: '🔧', amazon: '🛒', generic: '🤖',
};

// ─── State ────────────────────────────────────────────────────────────────────

let currentConversation = null;  // Active conversation object
let isStreaming         = false;  // Prevents concurrent sends
let pageContext         = null;   // Extracted context from the current tab
let allHistory         = [];     // In-memory cache for the history view

// ─── DOM References ───────────────────────────────────────────────────────────

const views = {
    home:    document.getElementById('pview-home'),
    chat:    document.getElementById('pview-chat'),
    history: document.getElementById('pview-history'),
};

/** Activate a named view and hide all others. */
function showView(name) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    if (views[name]) views[name].classList.add('active');
}

// ─── Initialisation ───────────────────────────────────────────────────────────

(async function init() {
    // Retrieve page context from the active tab's content script
    const ctxData = await getPageContext();
    pageContext = ctxData?.context || null;

    renderContextBanner(ctxData);
    renderSuggestions(ctxData?.suggestions || []);
    if (pageContext) renderContextPanel(pageContext, ctxData?.siteName);

    // Wire up input areas
    wireInput(
        document.getElementById('popupInput'),
        document.getElementById('popupSendBtn'),
        sendFromHome
    );
    wireInput(
        document.getElementById('popupChatInput'),
        document.getElementById('popupChatSendBtn'),
        sendFromChat
    );

    // Top-bar buttons
    document.getElementById('popupNewChatBtn').addEventListener('click', startNewChat);
    document.getElementById('popupHistoryBtn').addEventListener('click', openHistory);
    document.getElementById('popupOpenSidebarBtn').addEventListener('click', openInSidebar);

    // History view controls
    document.getElementById('popupClearAllBtn').addEventListener('click', async () => {
        await clearHistory();
        renderHistoryList([]);
    });
    document.getElementById('popupHistorySearch').addEventListener('input', e =>
        filterHistory(e.target.value)
    );

    showView('home');
})();

// ─── Context Rendering ───────────────────────────────────────────────────────

/**
 * Fills the top-bar context banner with the current site's emoji and label.
 * @param {object|null} ctxData - Result from getPageContext().
 */
function renderContextBanner(ctxData) {
    const site = ctxData?.siteName || 'generic';
    document.getElementById('contextEmoji').textContent = SITE_EMOJI[site] || '🤖';
    document.getElementById('contextLabel').textContent =
        site.charAt(0).toUpperCase() + site.slice(1);
}

/**
 * Renders the context metadata panel above the home input.
 * Hides the panel if no meaningful context rows exist.
 *
 * @param {object}      ctx      - Extracted page context object.
 * @param {string|null} siteName - Detected site name.
 */
function renderContextPanel(ctx, siteName) {
    const panel = document.getElementById('popupContextPanel');
    if (!panel) return;

    const rows = summarizeContext(ctx);
    if (!rows.length) { panel.hidden = true; return; }

    const site = (siteName || ctx?.website || 'page').charAt(0).toUpperCase() +
                 (siteName || ctx?.website || 'page').slice(1);

    panel.hidden = false;
    panel.innerHTML = `
        <div class="ctx-panel-header">
            <span class="ctx-status-dot"></span>
            <span class="ctx-site-name">${site}</span>
            <span class="ctx-status-label">Context Ready</span>
        </div>
        <div class="ctx-rows">
            ${rows.map(r => `
                <div class="ctx-row">
                    <span class="ctx-row-label">${escapeHtml(r.label)}</span>
                    <span class="ctx-row-value">${escapeHtml(r.value)}</span>
                </div>`).join('')}
        </div>`;
}

/**
 * Renders smart suggestion chips below the context panel.
 * Clicking a chip pre-fills the input and immediately sends the message.
 *
 * @param {string[]} suggestions - Array of suggestion strings.
 */
function renderSuggestions(suggestions) {
    const container = document.getElementById('popupSuggestions');
    container.innerHTML = '';
    suggestions.forEach(text => {
        const btn = document.createElement('button');
        btn.className = 'suggestion-chip';
        btn.textContent = text;
        btn.addEventListener('click', () => {
            document.getElementById('popupInput').value = text;
            sendFromHome();
        });
        container.appendChild(btn);
    });
}

// ─── Send Flows ──────────────────────────────────────────────────────────────

/** Reads the home-view input, opens the chat view, and sends the message. */
function sendFromHome() {
    const input = document.getElementById('popupInput');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    input.style.height = 'auto';
    startNewConversation(message);
    showView('chat');
    sendMessage(message);
}

/** Reads the chat-view input and sends the message (no view switch required). */
function sendFromChat() {
    const input = document.getElementById('popupChatInput');
    const message = input.value.trim();
    if (!message || isStreaming) return;
    input.value = '';
    input.style.height = 'auto';
    sendMessage(message);
}

// ─── Core Send Logic ─────────────────────────────────────────────────────────

/**
 * Sends a message to the backend, animates the workflow, streams the reply,
 * and persists the conversation.
 *
 * @param {string} message - The user's raw message text.
 */
async function sendMessage(message) {
    if (isStreaming) return;
    isStreaming = true;

    appendMessage('user', message);

    if (currentConversation) {
        if (!currentConversation.title || currentConversation.title === 'New Chat') {
            currentConversation.title = message.slice(0, 50) + (message.length > 50 ? '…' : '');
        }
        currentConversation.messages.push({ role: 'user', content: message, time: getCurrentTime() });
    }

    showTypingIndicator();

    const workflowList = document.getElementById('popupWorkflowList');
    const stopAnimation = animateWorkflowLoading(workflowList, LOADING_STEPS);

    try {
        // Enrich the prompt with extracted page context before sending
        const enrichedPrompt = pageContext ? buildContextPrompt(message, pageContext) : message;
        const data = await chatRequest(enrichedPrompt);

        stopAnimation();
        hideTypingIndicator();

        renderWorkflow(
            workflowList,
            document.getElementById('popupTaskBadge'),
            document.getElementById('popupTaskBadgeValue'),
            data.workflow || [],
            data.task     || ''
        );

        const responseObj = await streamMessage(data.response || '*(No response)*');

        if (currentConversation) {
            currentConversation.messages.push(responseObj);
            currentConversation.task     = data.task     || '';
            currentConversation.workflow = data.workflow || [];
            await saveConversation(currentConversation);
        }

    } catch (err) {
        stopAnimation();
        hideTypingIndicator();
        await streamMessage(`**Error:** ${err.message}`);
        resetWorkflow(workflowList, document.getElementById('popupTaskBadge'));
    } finally {
        isStreaming = false;
    }
}

// ─── Conversation Management ─────────────────────────────────────────────────

/**
 * Creates a new conversation object and resets the chat view.
 * @param {string} firstMessage - The first message (used as the initial title).
 */
function startNewConversation(firstMessage) {
    currentConversation = {
        id:       Date.now(),
        title:    firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '…' : ''),
        task:     '',
        workflow: [],
        messages: [],
    };
    document.getElementById('popupMessages').innerHTML = '';
    isStreaming = false;
    resetWorkflow(
        document.getElementById('popupWorkflowList'),
        document.getElementById('popupTaskBadge')
    );
}

/** Resets all state and returns to the home view. */
function startNewChat() {
    currentConversation = null;
    document.getElementById('popupMessages').innerHTML = '';
    document.getElementById('popupInput').value = '';
    isStreaming = false;
    resetWorkflow(
        document.getElementById('popupWorkflowList'),
        document.getElementById('popupTaskBadge')
    );
    showView('home');
}

// ─── History ─────────────────────────────────────────────────────────────────

/** Loads history from storage and switches to the history view. */
async function openHistory() {
    allHistory = await loadHistory();
    renderHistoryList(allHistory);
    showView('history');
}

/**
 * Renders the history list. Shows an empty state if there are no items.
 * @param {Array} items - Conversations to display.
 */
function renderHistoryList(items) {
    const container = document.getElementById('popupHistoryList');
    if (!items.length) {
        container.innerHTML = '<div class="empty-state">No conversations yet.</div>';
        return;
    }
    container.innerHTML = '';
    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'history-item';
        el.innerHTML = `
            <div class="history-info">
                <div class="history-title">${escapeHtml(item.title || 'Chat')}</div>
                <div class="history-meta">${item.messages?.length || 0} messages</div>
            </div>
            <button class="history-del" data-id="${item.id}" title="Delete">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                    <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4H5z"
                          stroke="currentColor" stroke-width="1.4"
                          stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>`;
        el.querySelector('.history-info').addEventListener('click', () => loadConversation(item));
        el.querySelector('.history-del').addEventListener('click', async e => {
            e.stopPropagation();
            await deleteConversation(item.id);
            allHistory = allHistory.filter(c => c.id !== item.id);
            renderHistoryList(allHistory);
        });
        container.appendChild(el);
    });
}

/**
 * Filters the in-memory history list by title and re-renders.
 * @param {string} query - Search query string.
 */
function filterHistory(query) {
    const q = query.toLowerCase();
    renderHistoryList(allHistory.filter(c => (c.title || '').toLowerCase().includes(q)));
}

/**
 * Loads a past conversation into the chat view and replays its messages.
 * @param {object} conv - Conversation object from history.
 */
function loadConversation(conv) {
    currentConversation = { ...conv };
    document.getElementById('popupMessages').innerHTML = '';
    isStreaming = false;
    conv.messages.forEach(m => appendMessage(m.role, m.content));
    if (conv.workflow?.length) {
        renderWorkflow(
            document.getElementById('popupWorkflowList'),
            document.getElementById('popupTaskBadge'),
            document.getElementById('popupTaskBadgeValue'),
            conv.workflow,
            conv.task || ''
        );
    }
    showView('chat');
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

/** Signals the content script to open the sidebar, then closes the popup. */
function openInSidebar() {
    chrome.runtime.sendMessage({ type: 'AI1_OPEN_SIDEBAR', message: '' });
    window.close();
}

// ─── Message Rendering ───────────────────────────────────────────────────────

/**
 * Appends a fully-rendered message bubble to the message list.
 *
 * @param {'user'|'assistant'} role    - Message author.
 * @param {string}             content - Markdown content.
 */
function appendMessage(role, content) {
    const container = document.getElementById('popupMessages');
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.innerHTML = `
        <div class="msg-avatar">${role === 'user' ? 'U' : 'A'}</div>
        <div class="msg-body">
            <div class="msg-role">${role === 'user' ? 'You' : 'AI-One'}</div>
            <div class="msg-content">${renderMarkdown(content)}</div>
        </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    wireCopyButtons(div);
}

/**
 * Appends a message bubble and simulates a character-by-character stream effect,
 * then resolves with the final message object once streaming is complete.
 *
 * @param   {string}  content - Full response text.
 * @returns {Promise<{role: string, content: string, time: string}>}
 */
function streamMessage(content) {
    return new Promise(resolve => {
        const container = document.getElementById('popupMessages');
        const div = document.createElement('div');
        div.className = 'msg assistant';
        div.innerHTML = `
            <div class="msg-avatar">A</div>
            <div class="msg-body">
                <div class="msg-role">AI-One</div>
                <div class="msg-content msg-streaming"></div>
            </div>`;
        container.appendChild(div);

        const contentEl  = div.querySelector('.msg-content');
        const tokens     = content.split(/(\s+)/);
        let tokenIndex   = 0;
        let accumulated  = '';

        function tick() {
            if (tokenIndex >= tokens.length) {
                // Replace streaming text with fully-rendered Markdown
                contentEl.innerHTML = renderMarkdown(content);
                contentEl.classList.remove('msg-streaming');
                wireCopyButtons(div);
                container.scrollTop = container.scrollHeight;
                resolve({ role: 'assistant', content, time: getCurrentTime() });
                return;
            }
            accumulated += tokens[tokenIndex++];
            contentEl.innerHTML = escapeHtml(accumulated).replace(/\n/g, '<br>');
            container.scrollTop = container.scrollHeight;
            setTimeout(tick, 26);
        }
        tick();
    });
}

// ─── Typing Indicator ────────────────────────────────────────────────────────

let typingElement = null;

function showTypingIndicator() {
    const container = document.getElementById('popupMessages');
    typingElement = document.createElement('div');
    typingElement.className = 'msg assistant';
    typingElement.innerHTML = `
        <div class="msg-avatar">A</div>
        <div class="msg-body">
            <div class="msg-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>`;
    container.appendChild(typingElement);
    container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
    if (typingElement) { typingElement.remove(); typingElement = null; }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Wires a textarea and its send button with auto-resize and Enter-to-send behaviour.
 *
 * @param {HTMLTextAreaElement} textarea  - The input element.
 * @param {HTMLButtonElement}   button    - The send button.
 * @param {Function}            onSend    - Callback invoked when the user sends.
 */
function wireInput(textarea, button, onSend) {
    if (!textarea || !button) return;
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
    textarea.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
    });
    button.addEventListener('click', onSend);
}

/**
 * Attaches clipboard-copy behaviour to all "Copy" buttons within a message element.
 * @param {HTMLElement} messageEl - The message bubble container.
 */
function wireCopyButtons(messageEl) {
    messageEl.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            navigator.clipboard?.writeText(btn.dataset.code);
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = original; }, 1600);
        });
    });
}

/** Safely escapes a string for use as HTML text content. */
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** Returns the current time formatted as HH:MM. */
function getCurrentTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Requests the extracted page context from the active tab's content script.
 * Returns null if the content script is unavailable (e.g. on chrome:// pages).
 *
 * @returns {Promise<{context, suggestions, siteName}|null>}
 */
function getPageContext() {
    return new Promise(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (!tabs[0]?.id) return resolve(null);
            chrome.tabs.sendMessage(tabs[0].id, { type: 'AI1_GET_CONTEXT' }, res => {
                if (chrome.runtime.lastError) return resolve(null);
                resolve(res || null);
            });
        });
    });
}
