/**
 * shared/history.js
 * =================
 * Manages conversation history using chrome.storage.local.
 *
 * Each conversation object has the shape:
 *   { id, title, task, workflow, messages: [{role, content, time}] }
 *
 * Up to MAX_ITEMS conversations are retained; the oldest is dropped when
 * the limit is exceeded.
 */

const STORAGE_KEY = 'ai1_history';
const MAX_ITEMS   = 60;

/**
 * Load all saved conversations from local extension storage.
 *
 * @returns {Promise<Array>} Array of conversation objects, newest first.
 */
export async function loadHistory() {
    return new Promise(resolve => {
        chrome.storage.local.get([STORAGE_KEY], result => {
            resolve(result[STORAGE_KEY] || []);
        });
    });
}

/**
 * Persist a conversation. Updates in place if the id already exists,
 * otherwise prepends to the list.
 *
 * @param {{ id, title, task, workflow, messages }} conv - Conversation to save.
 * @returns {Promise<void>}
 */
export async function saveConversation(conv) {
    const history = await loadHistory();
    const existingIndex = history.findIndex(c => c.id === conv.id);

    if (existingIndex >= 0) {
        history[existingIndex] = conv;
    } else {
        history.unshift(conv);
    }

    // Trim to the maximum allowed length
    if (history.length > MAX_ITEMS) history.pop();

    return new Promise(resolve => {
        chrome.storage.local.set({ [STORAGE_KEY]: history }, resolve);
    });
}

/**
 * Remove a single conversation by its unique id.
 *
 * @param {number|string} id - The conversation id to delete.
 * @returns {Promise<void>}
 */
export async function deleteConversation(id) {
    const history = await loadHistory();
    const filtered = history.filter(c => c.id !== id);
    return new Promise(resolve => {
        chrome.storage.local.set({ [STORAGE_KEY]: filtered }, resolve);
    });
}

/**
 * Erase the entire conversation history from local storage.
 *
 * @returns {Promise<void>}
 */
export async function clearHistory() {
    return new Promise(resolve => {
        chrome.storage.local.remove([STORAGE_KEY], resolve);
    });
}
