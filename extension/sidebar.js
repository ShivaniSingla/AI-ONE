/**
 * sidebar.js
 * ==========
 * Controller for the AI-One sidebar panel, injected as an iframe into every page.
 *
 * Views:
 *   home    — landing screen with suggestion chips and context panel
 *   chat    — message thread with workflow pipeline column
 *   history — searchable list of saved conversations
 *
 * The sidebar receives page context from content.js via postMessage and injects
 * it into every outgoing message before sending to the backend.
 */

import { chatRequest }                                                  from './shared/api.js';
import { renderWorkflow, animateWorkflowLoading, resetWorkflow }        from './shared/workflow.js';
import { renderMarkdown }                                               from './shared/markdown.js';
import { loadHistory, saveConversation, deleteConversation, clearHistory } from './shared/history.js';
import { summarizeContext, buildContextPrompt }                         from './shared/context.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Placeholder step labels displayed while the backend is processing. */
const LOADING_STEPS = ['Intent Detection', 'Planning', 'Execution', 'Review', 'Judge'];

// ─── State ────────────────────────────────────────────────────────────────────

let currentConversation = null;  // Active conversation object
let isStreaming         = false;  // Prevents concurrent sends
let pageContext         = null;   // Extracted context from content.js
let allHistory         = [];     // In-memory cache for the history view

// ─── View Router ─────────────────────────────────────────────────────────────

const views = {
    home:    document.getElementById('sview-home'),
    chat:    document.getElementById('sview-chat'),
    history: document.getElementById('sview-history'),
};

/** Activate a named view and hide all others. */
function showView(name) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    if (views[name]) views[name].classList.add('active');
}

// ─── Initialisation ───────────────────────────────────────────────────────────

(function init() {
    wireInput(
        document.getElementById('sidebarInput'),
        document.getElementById('sidebarSendBtn'),
        sendFromHome
    );
    wireInput(
        document.getElementById('sidebarChatInput'),
        document.getElementById('sidebarChatSendBtn'),
        sendFromChat
    );

    document.getElementById('sidebarNewChatBtn').addEventListener('click', startNewChat);
    document.getElementById('sidebarHistoryBtn').addEventListener('click', openHistory);
    document.getElementById('sidebarCloseBtn').addEventListener('click', () => {
        window.parent.postMessage({ type: 'AI1_CLOSE_SIDEBAR' }, '*');
    });
    document.getElementById('sidebarClearAllBtn').addEventListener('click', async () => {
        await clearHistory();
        renderHistoryList([]);
    });
    document.getElementById('sidebarHistorySearch').addEventListener('input', e =>
        filterHistory(e.target.value)
    );

    // Listen for messages from the parent content.js
    window.addEventListener('message', handleContentMessage);

    showView('home');
})();

// ─── Content Script Message Handler ──────────────────────────────────────────

/**
 * Handles postMessage events from the parent content.js frame.
 * Receives context updates, init payloads, and direct send commands.
 *
 * @param {MessageEvent} event
 */
function handleContentMessage(event) {
    const data = event.data;
    if (!data) return;

    // Store context whenever a message carries it
    if (data.context !== undefined) {
        pageContext = data.context;
        renderContextPanel(data.context, data.siteName);
        if (data.suggestions?.length) renderSuggestions(data.suggestions);
    }

    if (data.type === 'AI1_INIT') {
        const siteLabel = data.siteName
            ? data.siteName.charAt(0).toUpperCase() + data.siteName.slice(1)
            : 'AI Companion';
        document.getElementById('sidebarContextLabel').textContent = siteLabel;

        if (data.prefill) {
            startNewConversation(data.prefill);
            showView('chat');
            sendMessage(data.prefill);
        } else {
            showView('home');
        }
    }

    if (data.type === 'AI1_SEND') {
        if (!currentConversation) startNewConversation(data.message);
        showView('chat');
        sendMessage(data.message);
    }

    if (data.type === 'AI1_CONTEXT_UPDATE') {
        pageContext = data.context;
        renderContextPanel(data.context, data.siteName);
        if (data.suggestions?.length) renderSuggestions(data.suggestions);
    }
}

// ─── Context Rendering ───────────────────────────────────────────────────────

/**
 * Renders the context metadata panel in the sidebar's home view.
 * Hides the panel if no meaningful rows exist.
 *
 * @param {object|null} ctx      - Extracted page context.
 * @param {string|null} siteName - Detected site name.
 */
function renderContextPanel(ctx, siteName) {
    const panel = document.getElementById('sidebarContextPanel');
    if (!panel) return;

    const rows = summarizeContext(ctx);
    if (!rows.length) { panel.hidden = true; return; }

    const site = (siteName || ctx?.website || 'Page').charAt(0).toUpperCase() +
                 (siteName || ctx?.website || 'page').slice(1);

    panel.hidden = false;
    panel.innerHTML = `
        <div class="ctx-panel-header">
            <span class="ctx-status-dot"></span>
            <span class="ctx-site-name">${site}</span>
            <span class="ctx-status-label">Context Extracted</span>
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
 * Renders smart suggestion chips in the home view.
 * @param {string[]} suggestions - Array of suggestion strings.
 */
function renderSuggestions(suggestions) {
    const container = document.getElementById('sidebarSuggestions');
    container.innerHTML = '';
    suggestions.forEach(text => {
        const btn = document.createElement('button');
        btn.className = 'suggestion-chip';
        btn.textContent = text;
        btn.addEventListener('click', () => {
            document.getElementById('sidebarInput').value = text;
            sendFromHome();
        });
        container.appendChild(btn);
    });
}

// ─── Send Flows ──────────────────────────────────────────────────────────────

/** Reads the home-view input, opens chat, and sends the message. */
function sendFromHome() {
    const input = document.getElementById('sidebarInput');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    input.style.height = 'auto';
    startNewConversation(message);
    showView('chat');
    sendMessage(message);
}

/** Reads the chat-view input and sends the message. */
function sendFromChat() {
    const input = document.getElementById('sidebarChatInput');
    const message = input.value.trim();
    if (!message || isStreaming) return;
    input.value = '';
    input.style.height = 'auto';
    sendMessage(message);
}

// ─── Core Send Logic ─────────────────────────────────────────────────────────

/**
 * Sends a message to the backend, animates the workflow pipeline,
 * streams the reply, and persists the conversation.
 *
 * @param {string} message - The user's raw message text.
 */
async function sendMessage(message) {
    if (isStreaming) return;
    isStreaming = true;

    appendMessage('user', message);

    if (currentConversation) {
        if (!currentConversation.title || currentConversation.title === 'New Chat') {
            currentConversation.title = message.slice(0, 52) + (message.length > 52 ? '…' : '');
        }
        currentConversation.messages.push({ role: 'user', content: message, time: getCurrentTime() });
    }

    showTypingIndicator();

    const workflowList  = document.getElementById('sidebarWorkflowList');
    const stopAnimation = animateWorkflowLoading(workflowList, LOADING_STEPS);

    try {
        // Enrich the prompt with extracted page context before sending
        const enrichedPrompt = pageContext ? buildContextPrompt(message, pageContext) : message;
        const data = await chatRequest(enrichedPrompt);

        stopAnimation();
        hideTypingIndicator();

        renderWorkflow(
            workflowList,
            document.getElementById('sidebarTaskBadge'),
            document.getElementById('sidebarTaskBadgeValue'),
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
        resetWorkflow(workflowList, document.getElementById('sidebarTaskBadge'));
    } finally {
        isStreaming = false;
    }
}

// ─── Conversation Management ─────────────────────────────────────────────────

/**
 * Creates a new conversation object and resets the message list.
 * @param {string} firstMessage - The opening message (used as the initial title).
 */
function startNewConversation(firstMessage) {
    currentConversation = {
        id:       Date.now(),
        title:    firstMessage.slice(0, 52) + (firstMessage.length > 52 ? '…' : ''),
        task:     '',
        workflow: [],
        messages: [],
    };
    document.getElementById('sidebarMessages').innerHTML = '';
    isStreaming = false;
    resetWorkflow(
        document.getElementById('sidebarWorkflowList'),
        document.getElementById('sidebarTaskBadge')
    );
}

/** Resets all state and returns to the home view. */
function startNewChat() {
    currentConversation = null;
    document.getElementById('sidebarMessages').innerHTML = '';
    document.getElementById('sidebarInput').value = '';
    isStreaming = false;
    resetWorkflow(
        document.getElementById('sidebarWorkflowList'),
        document.getElementById('sidebarTaskBadge')
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
 * @param {Array} items - Conversations to render.
 */
function renderHistoryList(items) {
    const container = document.getElementById('sidebarHistoryList');
    if (!items.length) {
        container.innerHTML = '<div class="empty-state">No conversations yet.</div>';
        return;
    }
    container.innerHTML = '';
    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'history-item';
        el.innerHTML = `
            <div class="history-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 2h12v10H2z" stroke="currentColor" stroke-width="1.4"
                          stroke-linejoin="round"/>
                    <path d="M5 6h6M5 9h4" stroke="currentColor" stroke-width="1.4"
                          stroke-linecap="round"/>
                </svg>
            </div>
            <div class="history-info">
                <div class="history-title">${escapeHtml(item.title || 'Chat')}</div>
                <div class="history-meta">
                    ${item.messages?.length || 0} messages${item.task ? ' · ' + item.task : ''}
                </div>
            </div>
            <button class="history-del" title="Delete">
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
    document.getElementById('sidebarMessages').innerHTML = '';
    isStreaming = false;
    conv.messages.forEach(m => appendMessage(m.role, m.content));
    if (conv.workflow?.length) {
        renderWorkflow(
            document.getElementById('sidebarWorkflowList'),
            document.getElementById('sidebarTaskBadge'),
            document.getElementById('sidebarTaskBadgeValue'),
            conv.workflow,
            conv.task || ''
        );
    }
    showView('chat');
}

// ─── Message Rendering ───────────────────────────────────────────────────────

/**
 * Appends a fully-rendered message bubble with a timestamp.
 *
 * @param {'user'|'assistant'} role    - Message author.
 * @param {string}             content - Markdown content.
 */
function appendMessage(role, content) {
    const container = document.getElementById('sidebarMessages');
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.innerHTML = `
        <div class="msg-avatar">${role === 'user' ? 'U' : 'A'}</div>
        <div class="msg-body">
            <div class="msg-meta">
                <span class="msg-role">${role === 'user' ? 'You' : 'AI-One'}</span>
                <span class="msg-time">${getCurrentTime()}</span>
            </div>
            <div class="msg-content">${renderMarkdown(content)}</div>
        </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    wireCopyButtons(div);
}

/**
 * Appends a message bubble and simulates streaming, then resolves with the
 * final message object.
 *
 * @param   {string}  content - Full response text.
 * @returns {Promise<{role: string, content: string, time: string}>}
 */
function streamMessage(content) {
    return new Promise(resolve => {
        const container = document.getElementById('sidebarMessages');
        const time = getCurrentTime();
        const div = document.createElement('div');
        div.className = 'msg assistant';
        div.innerHTML = `
            <div class="msg-avatar">A</div>
            <div class="msg-body">
                <div class="msg-meta">
                    <span class="msg-role">AI-One</span>
                    <span class="msg-time">${time}</span>
                </div>
                <div class="msg-content msg-streaming"></div>
            </div>`;
        container.appendChild(div);

        const contentEl = div.querySelector('.msg-content');
        const tokens    = content.split(/(\s+)/);
        let tokenIndex  = 0;
        let accumulated = '';

        function tick() {
            if (tokenIndex >= tokens.length) {
                contentEl.innerHTML = renderMarkdown(content);
                contentEl.classList.remove('msg-streaming');
                wireCopyButtons(div);
                container.scrollTop = container.scrollHeight;
                resolve({ role: 'assistant', content, time });
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
    const container = document.getElementById('sidebarMessages');
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
 * Wires a textarea with auto-resize and Enter-to-send behaviour.
 *
 * @param {HTMLTextAreaElement} textarea - The input element.
 * @param {HTMLButtonElement}   button   - The send button.
 * @param {Function}            onSend   - Callback for send events.
 */
function wireInput(textarea, button, onSend) {
    if (!textarea || !button) return;
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    });
    textarea.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
    });
    button.addEventListener('click', onSend);
}

/**
 * Attaches clipboard-copy behaviour to all "Copy" buttons within a message.
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
