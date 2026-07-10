/**
 * shared/api.js
 * =============
 * Centralised API layer for all communication with the AI-One backend.
 *
 * To point the extension at a different backend (e.g. a deployed server),
 * change CONFIG.API_BASE_URL — that is the only place you need to edit.
 */

const CONFIG = {
    API_BASE_URL: 'https://ai-one.onrender.com',
};

/**
 * POST /chat
 *
 * Sends a user message (optionally pre-enriched with page context) to the
 * backend and returns the AI response along with task type and workflow steps.
 *
 * @param   {string} message - The prompt to send (may include injected page context).
 * @returns {Promise<{task: string, workflow: Array, response: string}>}
 * @throws  {Error}  On non-2xx HTTP responses, with a user-friendly message.
 */
export async function chatRequest(message) {
    const res = await fetch(`${CONFIG.API_BASE_URL}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message }),
    });

    if (!res.ok) {
        let detail = `Backend error ${res.status}`;
        try {
            const body = await res.json();
            detail = body.detail || detail;
        } catch (_) { /* non-JSON error body — keep default message */ }
        throw new Error(detail);
    }

    return res.json();
}

/**
 * GET /history
 *
 * Fetches all conversations persisted on the backend (server-side history).
 * Note: The extension also stores history in chrome.storage.local (see history.js).
 *
 * @returns {Promise<Array>}
 * @throws  {Error} On non-2xx responses.
 */
export async function getBackendHistory() {
    const res = await fetch(`${CONFIG.API_BASE_URL}/history`);
    if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
    return res.json();
}
