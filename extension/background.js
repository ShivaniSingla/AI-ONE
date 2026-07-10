/**
 * background.js — Service Worker
 * ================================
 * Manages context menu creation, routes right-click AI actions to the sidebar,
 * and relays messages between the popup, content scripts, and sidebar iframe.
 */

// ─── Context Menu Setup ───────────────────────────────────────────────────────

/** Right-click menu items injected on every page. */
const CONTEXT_MENU_ITEMS = [
    { id: 'ai1-explain',   title: '🔍 Explain with AI-One' },
    { id: 'ai1-summarize', title: '📝 Summarize' },
    { id: 'ai1-rewrite',   title: '✏️  Rewrite' },
    { id: 'ai1-optimize',  title: '⚡ Optimize' },
    { id: 'ai1-translate', title: '🌐 Translate to English' },
];

chrome.runtime.onInstalled.addListener(() => {
    CONTEXT_MENU_ITEMS.forEach(item =>
        chrome.contextMenus.create({
            id:       item.id,
            title:    item.title,
            contexts: ['selection'],
        })
    );
});

// ─── Context Menu Click Handler ───────────────────────────────────────────────

/** Maps menu item IDs to the prompt prefix sent to the sidebar. */
const CONTEXT_MENU_ACTIONS = {
    'ai1-explain':   'Explain this: ',
    'ai1-summarize': 'Summarize this: ',
    'ai1-rewrite':   'Rewrite this more clearly: ',
    'ai1-optimize':  'Optimize this: ',
    'ai1-translate': 'Translate this to English: ',
};

chrome.contextMenus.onClicked.addListener((info, tab) => {
    const prefix = CONTEXT_MENU_ACTIONS[info.menuItemId];
    if (!prefix || !info.selectionText) return;

    // Forward the composed message to the content script to open / send to sidebar
    chrome.tabs.sendMessage(tab.id, {
        type:    'AI1_OPEN_SIDEBAR',
        message: prefix + info.selectionText,
    });
});

// ─── Message Router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    // Popup requesting the active tab URL
    if (msg.type === 'AI1_GET_TAB_URL') {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            sendResponse({ url: tabs[0]?.url || '' });
        });
        return true; // keep channel open for async response
    }

    // Content script requesting its own tab URL (used by the sidebar)
    if (msg.type === 'AI1_GET_CURRENT_URL') {
        sendResponse({ url: sender.tab?.url || '' });
        return true;
    }

    // Popup requesting sidebar to open — relay to the active tab's content script
    if (msg.type === 'AI1_OPEN_SIDEBAR') {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, msg);
        });
    }
});
