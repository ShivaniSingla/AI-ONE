/**
 * shared/context.js
 * =================
 * Utilities for summarising extracted page context into display rows and
 * for building enriched prompts that include page context before the user's message.
 *
 * These functions are used by both popup.js and sidebar.js. Keeping them here
 * eliminates the duplicated logic that previously existed in both files.
 *
 * Exported functions:
 *   summarizeContext(ctx)                       → Array<{label, value}>
 *   buildContextPrompt(userMessage, context)    → string
 */

/**
 * Converts a page context object into a flat array of label/value row pairs
 * suitable for rendering in the context panel.
 *
 * @param   {object|null} ctx - Extracted page context object.
 * @returns {Array<{label: string, value: string}>} Rows to display, empty array if no context.
 */
export function summarizeContext(ctx) {
    if (!ctx) return [];

    const rows = [];
    const add = (label, value) => {
        if (value && String(value).trim()) {
            rows.push({ label, value: String(value).trim() });
        }
    };

    switch (ctx.website) {
        case 'leetcode':
            add('Problem',    ctx.title);
            add('Difficulty', ctx.difficulty);
            add('Language',   ctx.language);
            add('Code Lines', ctx.userCode ? ctx.userCode.split('\n').length + ' lines' : '');
            add('Tags',       ctx.tags?.slice(0, 3).join(', '));
            break;

        case 'github':
            add('Repo',   ctx.repoName);
            add('Branch', ctx.branch);
            add('Page',   ctx.pageType);
            add('File',   ctx.currentFile?.split('/').pop());
            break;

        case 'linkedin':
            add('Page',     ctx.pageType);
            add('Name',     ctx.name);
            add('Headline', ctx.headline?.slice(0, 60));
            add('Job',      ctx.jobTitle);
            add('Company',  ctx.jobCompany);
            break;

        case 'youtube':
            add('Video',      ctx.title?.slice(0, 50));
            add('Channel',    ctx.channel);
            add('Timestamp',  ctx.timestamp);
            add('Transcript', ctx.transcript ? ctx.transcript.split(' ').length + ' words' : 'None');
            break;

        case 'gmail':
            add('Subject', ctx.subject?.slice(0, 50));
            add('From',    ctx.sender);
            add('Thread',  ctx.thread?.length + ' msgs');
            break;

        case 'stackoverflow':
            add('Question', ctx.questionTitle?.slice(0, 50));
            add('Tags',     ctx.tags?.slice(0, 3).join(', '));
            add('Answered', ctx.acceptedAnswer ? 'Yes' : 'No');
            break;

        case 'amazon':
            add('Product', ctx.title?.slice(0, 50));
            add('Price',   ctx.price);
            add('Rating',  ctx.rating);
            add('Reviews', ctx.reviewCount);
            break;

        default:
            add('Page',     ctx.title?.slice(0, 60));
            add('Info',     ctx.description?.slice(0, 80));
            add('Selected', ctx.selectedText?.slice(0, 60));
            break;
    }

    return rows;
}

/**
 * Builds an enriched prompt string by appending structured page context
 * below the user's original message.
 *
 * Returns the original message unchanged if no context is provided or
 * if the context produces no meaningful fields.
 *
 * @param   {string}      userMessage - The raw user input.
 * @param   {object|null} context     - Extracted page context object.
 * @returns {string}                  - Enriched prompt for the backend.
 */
export function buildContextPrompt(userMessage, context) {
    if (!context) return userMessage;

    const sections = [];

    switch (context.website) {
        case 'leetcode':
            if (context.title)        sections.push('Problem: '    + context.title);
            if (context.difficulty)   sections.push('Difficulty: ' + context.difficulty);
            if (context.problem)      sections.push('Statement:\n' + context.problem);
            if (context.examples)     sections.push('Examples:\n'  + context.examples);
            if (context.constraints)  sections.push('Constraints:\n' + context.constraints);
            if (context.language)     sections.push('Language: '   + context.language);
            if (context.tags?.length) sections.push('Tags: '       + context.tags.join(', '));
            if (context.userCode)     sections.push('Current Code:\n```' + (context.language || '') + '\n' + context.userCode + '\n```');
            break;

        case 'github':
            if (context.repoName)    sections.push('Repository: ' + context.repoName);
            if (context.description) sections.push('Description: ' + context.description);
            if (context.branch)      sections.push('Branch: '      + context.branch);
            if (context.currentFile) sections.push('File: '        + context.currentFile);
            if (context.fileCode)    sections.push('Code:\n```\n'  + context.fileCode + '\n```');
            if (context.readme)      sections.push('README:\n'     + context.readme);
            break;

        case 'linkedin':
            if (context.name)     sections.push('Name: '     + context.name);
            if (context.headline) sections.push('Headline: ' + context.headline);
            if (context.about)    sections.push('About: '    + context.about);
            if (context.experience?.length) {
                sections.push('Experience:\n' + context.experience.slice(0, 3)
                    .map(e => '- ' + e.title + ' at ' + e.company).join('\n'));
            }
            if (context.skills?.length) sections.push('Skills: ' + context.skills.slice(0, 10).join(', '));
            if (context.jobTitle) sections.push('Job: ' + context.jobTitle + ' at ' + context.jobCompany);
            if (context.jobDesc)  sections.push('Job Description:\n' + context.jobDesc);
            break;

        case 'youtube':
            if (context.title)       sections.push('Video: '        + context.title);
            if (context.channel)     sections.push('Channel: '      + context.channel);
            if (context.description) sections.push('Description:\n' + context.description);
            if (context.timestamp)   sections.push('Current Time: ' + context.timestamp);
            if (context.transcript)  sections.push('Transcript:\n'  + context.transcript.slice(0, 1500));
            break;

        case 'gmail':
            if (context.subject) sections.push('Subject: ' + context.subject);
            if (context.thread?.length) {
                sections.push('Thread:\n' + context.thread
                    .map(m => 'From: ' + m.from + '\n' + m.body).join('\n---\n'));
            }
            break;

        case 'stackoverflow':
            if (context.questionTitle)         sections.push('Question: '  + context.questionTitle);
            if (context.questionBody)          sections.push('Details:\n'  + context.questionBody);
            if (context.codeSnippets?.length)  sections.push('Code:\n```\n' + context.codeSnippets[0] + '\n```');
            if (context.acceptedAnswer)        sections.push('Accepted Answer:\n' + context.acceptedAnswer);
            break;

        case 'amazon':
            if (context.title)         sections.push('Product: '     + context.title);
            if (context.price)         sections.push('Price: '       + context.price);
            if (context.rating)        sections.push('Rating: '      + context.rating + ' (' + context.reviewCount + ')');
            if (context.features?.length) {
                sections.push('Features:\n' + context.features.map(f => '- ' + f).join('\n'));
            }
            if (context.description)   sections.push('Description:\n' + context.description);
            break;

        default:
            if (context.title)        sections.push('Page: '         + context.title);
            if (context.description)  sections.push('About: '        + context.description);
            if (context.selectedText) sections.push('Selected Text:\n' + context.selectedText);
            if (context.mainContent)  sections.push('Content:\n'     + context.mainContent.slice(0, 1200));
            break;
    }

    if (!sections.length) return userMessage;

    return (
        userMessage +
        '\n\n---\n[Page Context]\n' +
        sections.join('\n\n') +
        '\nURL: ' + context.url
    );
}
