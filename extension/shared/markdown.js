/**
 * shared/markdown.js
 * ==================
 * Lightweight Markdown-to-HTML renderer used in popup and sidebar message bubbles.
 *
 * Supported syntax:
 *   - Fenced code blocks  (```lang … ```)
 *   - Inline code         (`code`)
 *   - Bold/italic/bold-italic
 *   - Headings h1–h3
 *   - Blockquotes
 *   - Unordered and ordered lists
 *   - Hyperlinks
 *   - Paragraphs
 *
 * Each fenced code block receives a "Copy" button that writes to the clipboard.
 */

/** HTML-escapes a plain-text string for safe insertion into HTML content. */
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** HTML-escapes a string for safe use inside an HTML attribute value. */
function escapeAttr(s) {
    return String(s)
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Convert a Markdown string into an HTML string.
 *
 * @param   {string} raw - Raw Markdown text from the AI response.
 * @returns {string}     Safe HTML string ready for innerHTML assignment.
 */
export function renderMarkdown(raw) {
    const codeBlocks = [];

    // ── Extract fenced code blocks and replace with placeholders ──────────────
    let text = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push(
            `<div class="code-block-wrap">` +
                `<div class="code-block-header">` +
                    `<span>${escapeHtml(lang || 'code')}</span>` +
                    `<button class="copy-btn" data-code="${escapeAttr(code.trim())}">Copy</button>` +
                `</div>` +
                `<pre><code>${escapeHtml(code.trim())}</code></pre>` +
            `</div>`
        );
        return `\x00CODE${idx}\x00`;
    });

    // ── Escape remaining HTML, then apply inline Markdown rules ───────────────
    text = escapeHtml(text);
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*(.+?)\*\*/g,      '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g,           '<em>$1</em>');

    // ── Block-level elements ───────────────────────────────────────────────────
    text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
    text = text.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
    text = text.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    text = text.replace(/^[-•*] (.+)$/gm, '<li class="ul-li">$1</li>');
    text = text.replace(
        /(<li class="ul-li">[\s\S]*?<\/li>)(\n(?!<li class="ul-li">)|$)/g,
        (_, items) => '<ul>' + items + '</ul>'
    );
    text = text.replace(/^\d+\. (.+)$/gm, '<li class="ol-li">$1</li>');
    text = text.replace(
        /(<li class="ol-li">[\s\S]*?<\/li>)(\n(?!<li class="ol-li">)|$)/g,
        (_, items) => '<ol>' + items + '</ol>'
    );
    text = text.replace(
        /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );

    // ── Wrap bare text lines in <p> tags ──────────────────────────────────────
    const blockStart = /^(<h[1-3]|<ul|<ol|<li|<blockquote|<div|<pre|\x00CODE)/;
    const lines  = text.split('\n');
    const chunks = [];
    let   para   = [];

    for (const line of lines) {
        if (blockStart.test(line.trim())) {
            if (para.length) { chunks.push('<p>' + para.join('<br>') + '</p>'); para = []; }
            chunks.push(line);
        } else if (line.trim() === '') {
            if (para.length) { chunks.push('<p>' + para.join('<br>') + '</p>'); para = []; }
        } else {
            para.push(line);
        }
    }
    if (para.length) chunks.push('<p>' + para.join('<br>') + '</p>');

    text = chunks.join('\n');

    // ── Restore code block HTML ────────────────────────────────────────────────
    text = text.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[+i]);

    return text;
}
