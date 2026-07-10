(function () {
  'use strict';

  if (window.__AI1_INJECTED__) return;
  window.__AI1_INJECTED__ = true;

  /* ══════════════════════════════════════════════
     SECTION 1 — EXTRACTORS (inlined)
  ══════════════════════════════════════════════ */

  // ── Generic ─────────────────────────────────
  async function extractGeneric() {
    return {
      website:      'generic',
      url:          location.href,
      title:        document.title || '',
      description:  document.querySelector('meta[name="description"]')
                      ?.getAttribute('content') || '',
      selectedText: getSelection()?.toString().trim() || '',
      mainContent:  (document.querySelector('article') ||
                     document.querySelector('main') ||
                     document.querySelector('[role="main"]'))
                     ?.innerText?.slice(0, 2000).trim() || '',
    };
  }

  // ── LeetCode ────────────────────────────────
  async function extractLeetCode() {
    await waitFor('[data-track-load="description_content"]', 4000);
    const ctx = {
      website: 'leetcode', url: location.href,
      title: '', difficulty: '', problem: '',
      examples: '', constraints: '', tags: [],
      language: '', userCode: '', status: '',
    };
    ctx.title =
      document.querySelector('[data-cy="question-title"]')?.innerText?.trim() ||
      document.querySelector('.text-title-large')?.innerText?.trim() ||
      document.title.replace(' - LeetCode', '').trim();

    const diffEl = document.querySelector(
      '.text-difficulty-easy,.text-difficulty-medium,.text-difficulty-hard,[class*="difficulty"]'
    );
    if (diffEl) ctx.difficulty = diffEl.innerText.trim();

    const descEl = document.querySelector(
      '[data-track-load="description_content"],[class*="description__"]'
    );
    if (descEl) {
      const full = descEl.innerText?.trim() || '';
      const exIdx    = full.search(/\bExample\s*1\b|\bExample:/i);
      const constIdx = full.search(/\bConstraints:\b/i);
      ctx.problem      = exIdx > 0 ? full.slice(0, exIdx).trim() : full.slice(0, 600).trim();
      if (exIdx > 0)    ctx.examples    = constIdx > exIdx ? full.slice(exIdx, constIdx).trim() : full.slice(exIdx, exIdx + 600).trim();
      if (constIdx > 0) ctx.constraints = full.slice(constIdx, constIdx + 400).trim();
    }
    document.querySelectorAll('[class*="tag__"],.topic-tag').forEach(t => {
      const v = t.innerText.trim(); if (v) ctx.tags.push(v);
    });
    const langEl = document.querySelector('.ant-select-selection-item,button[id*="headlessui-listbox-button"]');
    if (langEl) ctx.language = langEl.innerText.trim();
    ctx.userCode = extractEditorCode();
    return ctx;
  }

  function extractEditorCode() {
    try { const eds = window.monaco?.editor?.getEditors(); if (eds?.length) return eds[0].getValue(); } catch (_) {}
    const cm = document.querySelector('.CodeMirror'); if (cm?.CodeMirror) return cm.CodeMirror.getValue();
    return [...document.querySelectorAll('.view-line')].map(l => l.innerText).join('\n').slice(0, 3000);
  }

  // ── GitHub ───────────────────────────────────
  async function extractGitHub() {
    const ctx = {
      website: 'github', url: location.href,
      repoName: '', description: '', branch: '',
      currentFile: '', fileCode: '', readme: '', pageType: '',
    };
    ctx.repoName =
      document.querySelector('meta[name="octolytics-dimension-repository_nwo"]')?.content ||
      location.pathname.split('/').slice(1, 3).join('/');
    ctx.description =
      document.querySelector('.f4.my-3')?.innerText?.trim() || '';
    ctx.branch =
      document.querySelector('[data-testid="branch-picker-branch-name"]')?.innerText?.trim() ||
      document.querySelector('.branch-name')?.innerText?.trim() || '';
    const p = location.pathname;
    if (p.includes('/blob/')) {
      ctx.pageType = 'file';
      ctx.currentFile = p.split('/blob/').pop() || '';
      ctx.fileCode = (document.querySelector('.react-code-lines') ||
                      document.querySelector('#read-only-cursor-text-area'))
                     ?.innerText?.slice(0, 4000).trim() || '';
    } else if (p.includes('/pull/')) {
      ctx.pageType = 'pr';
    } else if (p.includes('/issues/')) {
      ctx.pageType = 'issue';
    } else {
      ctx.pageType = 'repo';
      ctx.readme = (document.querySelector('#readme .markdown-body') ||
                    document.querySelector('article.markdown-body'))
                   ?.innerText?.slice(0, 3000).trim() || '';
    }
    return ctx;
  }

  // ── LinkedIn ─────────────────────────────────
  async function extractLinkedIn() {
    const ctx = {
      website: 'linkedin', url: location.href,
      pageType: 'unknown', name: '', headline: '',
      about: '', experience: [], skills: [],
      jobTitle: '', jobCompany: '', jobDesc: '',
    };
    const p = location.pathname;
    if (p.includes('/in/')) {
      ctx.pageType = 'profile';
      ctx.name     = document.querySelector('h1.text-heading-xlarge')?.innerText?.trim() || '';
      ctx.headline = document.querySelector('.text-body-medium.break-words')?.innerText?.trim() || '';
      ctx.about    = document.querySelector('#about ~ div .display-flex span')?.innerText?.trim() || '';
      document.querySelectorAll('[data-field="experience_component"]').forEach(el => {
        const title   = el.querySelector('.mr1.t-bold span')?.innerText?.trim();
        const company = el.querySelector('.t-14.t-normal span')?.innerText?.trim();
        if (title || company) ctx.experience.push({ title, company });
      });
      document.querySelectorAll('[data-field="skill_page_skill_component"]').forEach(el => {
        const s = el.querySelector('.mr1.t-bold span')?.innerText?.trim();
        if (s) ctx.skills.push(s);
      });
      ctx.skills = ctx.skills.slice(0, 15);
    } else if (p.includes('/jobs/')) {
      ctx.pageType   = 'job';
      ctx.jobTitle   = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.innerText?.trim() || '';
      ctx.jobCompany = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.innerText?.trim() || '';
      ctx.jobDesc    = document.querySelector('#job-details .jobs-description-content__text')?.innerText?.slice(0, 2000).trim() || '';
    }
    return ctx;
  }

  // ── YouTube ──────────────────────────────────
  async function extractYouTube() {
    await sleep(800);
    const ctx = {
      website: 'youtube', url: location.href,
      videoId: new URLSearchParams(location.search).get('v') || '',
      title: '', channel: '', description: '', timestamp: '', transcript: '',
    };
    ctx.title   = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string')?.innerText?.trim() ||
                  document.title.replace(' - YouTube', '').trim();
    ctx.channel = document.querySelector('ytd-channel-name yt-formatted-string a')?.innerText?.trim() || '';
    document.querySelector('tp-yt-paper-button#expand')?.click();
    await sleep(300);
    ctx.description = document.querySelector('ytd-text-inline-expander yt-attributed-string')?.innerText?.slice(0, 1500).trim() || '';
    const vid = document.querySelector('video');
    if (vid) { const s = Math.floor(vid.currentTime); ctx.timestamp = `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
    ctx.transcript = [...document.querySelectorAll('ytd-transcript-segment-renderer')]
      .map(el => el.querySelector('.segment-text')?.innerText?.trim()).filter(Boolean).slice(0, 120).join(' ');
    return ctx;
  }

  // ── Gmail ────────────────────────────────────
  async function extractGmail() {
    const ctx = { website: 'gmail', url: location.href, subject: '', sender: '', recipient: '', body: '', thread: [] };
    ctx.subject = document.querySelector('h2.hP')?.innerText?.trim() || '';
    const msgs = document.querySelectorAll('.adn.ads');
    msgs.forEach((msg, i) => {
      if (i < msgs.length - 3) return;
      const from = msg.querySelector('.gD')?.getAttribute('email') || '';
      const body = msg.querySelector('.a3s.aiL')?.innerText?.trim().slice(0, 800) || '';
      if (i === msgs.length - 1) { ctx.sender = from; ctx.body = body; }
      ctx.thread.push({ from, body });
    });
    return ctx;
  }

  // ── Stack Overflow ───────────────────────────
  async function extractStackOverflow() {
    const ctx = { website: 'stackoverflow', url: location.href, questionTitle: '', questionBody: '', codeSnippets: [], tags: [], acceptedAnswer: '', topAnswer: '' };
    ctx.questionTitle = document.querySelector('#question-header h1 a')?.innerText?.trim() || '';
    const qb = document.querySelector('#question .s-prose');
    if (qb) {
      ctx.questionBody = qb.innerText?.trim().slice(0, 1500) || '';
      qb.querySelectorAll('code,pre').forEach(c => { const t = c.innerText?.trim(); if (t && t.length > 10) ctx.codeSnippets.push(t.slice(0, 600)); });
    }
    document.querySelectorAll('.post-tag,.s-tag').forEach(t => { const v = t.innerText.trim(); if (v) ctx.tags.push(v); });
    ctx.acceptedAnswer = document.querySelector('.answer.accepted-answer .s-prose')?.innerText?.trim().slice(0, 1500) || '';
    if (!ctx.acceptedAnswer) ctx.topAnswer = document.querySelector('.answer .s-prose')?.innerText?.trim().slice(0, 1500) || '';
    return ctx;
  }

  // ── Amazon ───────────────────────────────────
  async function extractAmazon() {
    const ctx = { website: 'amazon', url: location.href, title: '', price: '', rating: '', reviewCount: '', description: '', features: [], topReviews: [] };
    ctx.title       = document.querySelector('#productTitle')?.innerText?.trim() || '';
    ctx.price       = document.querySelector('.a-price .a-offscreen')?.innerText?.trim() || '';
    ctx.rating      = document.querySelector('#acrPopover .a-size-base.a-color-base')?.innerText?.trim() || '';
    ctx.reviewCount = document.querySelector('#acrCustomerReviewText')?.innerText?.trim() || '';
    document.querySelectorAll('#feature-bullets li span.a-list-item').forEach(el => {
      const t = el.innerText.trim(); if (t) ctx.features.push(t.slice(0, 200));
    });
    ctx.features = ctx.features.slice(0, 8);
    ctx.description = document.querySelector('#productDescription p')?.innerText?.trim().slice(0, 800) || '';
    document.querySelectorAll('[data-hook="review"]').forEach((el, i) => {
      if (i >= 3) return;
      ctx.topReviews.push({
        title:  el.querySelector('[data-hook="review-title"] span:not(.a-icon-alt)')?.innerText?.trim() || '',
        body:   el.querySelector('[data-hook="review-body"]')?.innerText?.trim().slice(0, 300) || '',
        rating: el.querySelector('[data-hook="review-star-rating"] .a-icon-alt')?.innerText?.trim() || '',
      });
    });
    return ctx;
  }

  /* ══════════════════════════════════════════════
     SECTION 2 — CONTEXT MANAGER (inlined)
  ══════════════════════════════════════════════ */

  const SITE_REGISTRY = [
    { name: 'leetcode',      match: /leetcode\.com/,                   extract: extractLeetCode,      suggestions: ['Solve this problem step by step','Give me a hint only','Optimize my solution','Find the bug in my code','What is the time & space complexity?'] },
    { name: 'github',        match: /github\.com/,                     extract: extractGitHub,        suggestions: ['Explain this repository','Review this code','Improve the README','Find potential bugs','Write unit tests'] },
    { name: 'linkedin',      match: /linkedin\.com/,                   extract: extractLinkedIn,      suggestions: ['Improve my LinkedIn headline','Rewrite my About section','ATS resume review','Draft a cover letter','Suggest interview questions'] },
    { name: 'youtube',       match: /youtube\.com/,                    extract: extractYouTube,       suggestions: ['Summarize this video','Generate study notes','Quiz me on the key concepts','Explain the main ideas','Write a Twitter thread'] },
    { name: 'gmail',         match: /mail\.google\.com/,               extract: extractGmail,         suggestions: ['Draft a professional reply','Improve this email','Make it more concise','Change to formal tone','Write a follow-up'] },
    { name: 'stackoverflow', match: /stackoverflow\.com/,              extract: extractStackOverflow, suggestions: ['Explain this error','Find a better solution','Explain this code','Why does this work?','How to debug this?'] },
    { name: 'amazon',        match: /amazon\.(com|in|co\.uk|de|fr)/,   extract: extractAmazon,        suggestions: ['Is this a good deal?','Summarize the reviews','Compare pros and cons','Find a better alternative','Main complaints?'] },
  ];

  const DEFAULT_SUGGESTIONS = ['Explain this page','Summarize the content','What is this about?','Help me understand this','Write a tweet about this'];

  async function extractPageContext() {
    const site = SITE_REGISTRY.find(s => s.match.test(location.href));
    if (!site) {
      return { context: await extractGeneric(), suggestions: DEFAULT_SUGGESTIONS, siteName: 'generic' };
    }
    try {
      const context = await site.extract();
      return { context, suggestions: site.suggestions, siteName: site.name };
    } catch (err) {
      const context = await extractGeneric();
      context.extractionError = err.message;
      return { context, suggestions: site.suggestions, siteName: site.name };
    }
  }

  function summarizeContext(ctx) {
    if (!ctx) return [];
    const rows = [];
    const add = (label, value) => { if (value && String(value).trim()) rows.push({ label, value: String(value).trim() }); };
    switch (ctx.website) {
      case 'leetcode':      add('Problem', ctx.title); add('Difficulty', ctx.difficulty); add('Language', ctx.language); add('Code Lines', ctx.userCode ? ctx.userCode.split('\n').length + ' lines' : ''); add('Tags', ctx.tags?.slice(0,3).join(', ')); break;
      case 'github':        add('Repo', ctx.repoName); add('Branch', ctx.branch); add('Page', ctx.pageType); add('File', ctx.currentFile?.split('/').pop()); break;
      case 'linkedin':      add('Page', ctx.pageType); add('Name', ctx.name); add('Headline', ctx.headline?.slice(0,60)); add('Job', ctx.jobTitle); add('Company', ctx.jobCompany); break;
      case 'youtube':       add('Video', ctx.title?.slice(0,50)); add('Channel', ctx.channel); add('Timestamp', ctx.timestamp); add('Transcript', ctx.transcript ? ctx.transcript.split(' ').length + ' words' : 'None'); break;
      case 'gmail':         add('Subject', ctx.subject?.slice(0,50)); add('From', ctx.sender); add('Thread', ctx.thread?.length + ' msgs'); break;
      case 'stackoverflow': add('Question', ctx.questionTitle?.slice(0,50)); add('Tags', ctx.tags?.slice(0,3).join(', ')); add('Answered', ctx.acceptedAnswer ? 'Yes' : 'No'); break;
      case 'amazon':        add('Product', ctx.title?.slice(0,50)); add('Price', ctx.price); add('Rating', ctx.rating); add('Reviews', ctx.reviewCount); break;
      default:              add('Page', ctx.title?.slice(0,60)); add('Info', ctx.description?.slice(0,80)); add('Selected', ctx.selectedText?.slice(0,60)); break;
    }
    return rows;
  }

  function buildContextPrompt(userMessage, context) {
    if (!context) return userMessage;
    const sections = [];
    switch (context.website) {
      case 'leetcode':
        if (context.title)       sections.push('Problem: ' + context.title);
        if (context.difficulty)  sections.push('Difficulty: ' + context.difficulty);
        if (context.problem)     sections.push('Statement:\n' + context.problem);
        if (context.examples)    sections.push('Examples:\n' + context.examples);
        if (context.constraints) sections.push('Constraints:\n' + context.constraints);
        if (context.language)    sections.push('Language: ' + context.language);
        if (context.tags?.length) sections.push('Tags: ' + context.tags.join(', '));
        if (context.userCode)    sections.push('Current Code:\n```' + (context.language||'') + '\n' + context.userCode + '\n```');
        break;
      case 'github':
        if (context.repoName)    sections.push('Repository: ' + context.repoName);
        if (context.description) sections.push('Description: ' + context.description);
        if (context.branch)      sections.push('Branch: ' + context.branch);
        if (context.currentFile) sections.push('File: ' + context.currentFile);
        if (context.fileCode)    sections.push('Code:\n```\n' + context.fileCode + '\n```');
        if (context.readme)      sections.push('README:\n' + context.readme);
        break;
      case 'linkedin':
        if (context.name)        sections.push('Name: ' + context.name);
        if (context.headline)    sections.push('Headline: ' + context.headline);
        if (context.about)       sections.push('About: ' + context.about);
        if (context.experience?.length) sections.push('Experience:\n' + context.experience.slice(0,3).map(e => '- ' + e.title + ' at ' + e.company).join('\n'));
        if (context.skills?.length) sections.push('Skills: ' + context.skills.slice(0,10).join(', '));
        if (context.jobTitle)    sections.push('Job: ' + context.jobTitle + ' at ' + context.jobCompany);
        if (context.jobDesc)     sections.push('Job Description:\n' + context.jobDesc);
        break;
      case 'youtube':
        if (context.title)       sections.push('Video: ' + context.title);
        if (context.channel)     sections.push('Channel: ' + context.channel);
        if (context.description) sections.push('Description:\n' + context.description);
        if (context.timestamp)   sections.push('Current Time: ' + context.timestamp);
        if (context.transcript)  sections.push('Transcript:\n' + context.transcript.slice(0, 1500));
        break;
      case 'gmail':
        if (context.subject)     sections.push('Subject: ' + context.subject);
        if (context.thread?.length) sections.push('Thread:\n' + context.thread.map(m => 'From: ' + m.from + '\n' + m.body).join('\n---\n'));
        break;
      case 'stackoverflow':
        if (context.questionTitle)  sections.push('Question: ' + context.questionTitle);
        if (context.questionBody)   sections.push('Details:\n' + context.questionBody);
        if (context.codeSnippets?.length) sections.push('Code:\n```\n' + context.codeSnippets[0] + '\n```');
        if (context.acceptedAnswer) sections.push('Accepted Answer:\n' + context.acceptedAnswer);
        break;
      case 'amazon':
        if (context.title)       sections.push('Product: ' + context.title);
        if (context.price)       sections.push('Price: ' + context.price);
        if (context.rating)      sections.push('Rating: ' + context.rating + ' (' + context.reviewCount + ')');
        if (context.features?.length) sections.push('Features:\n' + context.features.map(f => '- ' + f).join('\n'));
        if (context.description) sections.push('Description:\n' + context.description);
        break;
      default:
        if (context.title)        sections.push('Page: ' + context.title);
        if (context.description)  sections.push('About: ' + context.description);
        if (context.selectedText) sections.push('Selected Text:\n' + context.selectedText);
        if (context.mainContent)  sections.push('Content:\n' + context.mainContent.slice(0, 1200));
        break;
    }
    if (!sections.length) return userMessage;
    return userMessage + '\n\n---\n[Page Context]\n' + sections.join('\n\n') + '\nURL: ' + context.url;
  }

  /* ══════════════════════════════════════════════
     SECTION 3 — HELPERS
  ══════════════════════════════════════════════ */

  function waitFor(selector, timeout) {
    return new Promise(resolve => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const obs = new MutationObserver(() => {
        const el2 = document.querySelector(selector);
        if (el2) { obs.disconnect(); resolve(el2); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(null); }, timeout || 3000);
    });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ══════════════════════════════════════════════
     SECTION 4 — RUNTIME STATE
  ══════════════════════════════════════════════ */

  let sidebarOpen   = false;
  let sidebarIframe = null;
  let selectionMenu = null;
  let pageContext   = null;

  /* ══════════════════════════════════════════════
     SECTION 5 — CONTEXT EXTRACTION ENGINE
  ══════════════════════════════════════════════ */

  let lastUrl = location.href;
  extractAndCacheContext();

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      pageContext = null;
      setTimeout(extractAndCacheContext, 1200);
    }
  }).observe(document.body, { childList: true, subtree: true });

  async function extractAndCacheContext() {
    try {
      pageContext = await extractPageContext();
      if (sidebarOpen && sidebarIframe) {
        sidebarIframe.contentWindow?.postMessage(
          { type: 'AI1_CONTEXT_UPDATE', ...pageContext }, '*'
        );
      }
    } catch (_) { /* never crash the host page */ }
  }

  /* ══════════════════════════════════════════════
     SECTION 6 — FLOATING ACTION BUTTON
  ══════════════════════════════════════════════ */

  const fab = document.createElement('div');
  fab.id = 'ai1-fab';
  fab.title = 'Open AI-One';
  fab.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none">'
    + '<circle cx="12" cy="12" r="10" fill="url(#ai1grad)"/>'
    + '<text x="12" y="17" text-anchor="middle" font-size="13" font-weight="800" '
    + 'font-family="IBM Plex Sans,system-ui,sans-serif" fill="white">A</text>'
    + '<defs><linearGradient id="ai1grad" x1="0" y1="0" x2="1" y2="1">'
    + '<stop offset="0%" stop-color="#4589ff"/><stop offset="100%" stop-color="#a56eff"/>'
    + '</linearGradient></defs></svg>';
  document.body.appendChild(fab);
  fab.addEventListener('click', function () { toggleSidebar(); });

  /* ══════════════════════════════════════════════
     SECTION 7 — SIDEBAR IFRAME
  ══════════════════════════════════════════════ */

  function createSidebar() {
    var wrapper = document.createElement('div');
    wrapper.id = 'ai1-sidebar-wrapper';

    var iframe = document.createElement('iframe');
    iframe.id  = 'ai1-sidebar-iframe';
    iframe.src = chrome.runtime.getURL('sidebar.html');
    iframe.setAttribute('allowtransparency', 'true');

    var handle = document.createElement('div');
    handle.id = 'ai1-sidebar-handle';

    wrapper.appendChild(handle);
    wrapper.appendChild(iframe);
    document.body.appendChild(wrapper);

    var dragging = false, startX = 0, startW = 0;
    handle.addEventListener('mousedown', function (e) {
      dragging = true; startX = e.clientX; startW = wrapper.offsetWidth;
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var newW = Math.min(600, Math.max(300, startW + (startX - e.clientX)));
      wrapper.style.width = newW + 'px';
    });
    document.addEventListener('mouseup', function () {
      dragging = false; document.body.style.userSelect = '';
    });

    sidebarIframe = iframe;
    return wrapper;
  }

  function toggleSidebar(prefillMsg) {
    sidebarOpen = !sidebarOpen;

    if (sidebarOpen) {
      if (!document.getElementById('ai1-sidebar-wrapper')) createSidebar();
      document.getElementById('ai1-sidebar-wrapper').classList.add('open');
      fab.classList.add('active');

      sidebarIframe.addEventListener('load', function () {
        sidebarIframe.contentWindow.postMessage({
          type:        'AI1_INIT',
          url:         location.href,
          prefill:     typeof prefillMsg === 'string' ? prefillMsg : '',
          context:     pageContext ? pageContext.context     : null,
          suggestions: pageContext ? pageContext.suggestions : [],
          siteName:    pageContext ? pageContext.siteName    : 'generic',
        }, '*');
      }, { once: true });

    } else {
      var w = document.getElementById('ai1-sidebar-wrapper');
      if (w) w.classList.remove('open');
      fab.classList.remove('active');
    }
  }

  /* ══════════════════════════════════════════════
     SECTION 8 — TEXT SELECTION MINI-MENU
  ══════════════════════════════════════════════ */

  var SELECTION_ACTIONS = [
    { label: 'Explain',   prefix: 'Explain this: ' },
    { label: 'Summarize', prefix: 'Summarize this: ' },
    { label: 'Rewrite',   prefix: 'Rewrite this more clearly: ' },
    { label: 'Translate', prefix: 'Translate to English: ' },
    { label: 'Improve',   prefix: 'Improve the quality of: ' },
  ];

  document.addEventListener('mouseup', function () {
    setTimeout(function () {
      var sel = window.getSelection();
      var selected = sel ? sel.toString().trim() : '';
      removeSelectionMenu();
      if (!selected || selected.length < 5) return;

      var range = sel.getRangeAt(0);
      var rect  = range.getBoundingClientRect();

      selectionMenu = document.createElement('div');
      selectionMenu.id = 'ai1-sel-menu';
      selectionMenu.innerHTML = SELECTION_ACTIONS.map(function (a) {
        return '<button class="ai1-sel-btn" data-prefix="' + encodeURIComponent(a.prefix) + '">' + a.label + '</button>';
      }).join('');
      selectionMenu.style.top  = (rect.top  + window.scrollY - 44) + 'px';
      selectionMenu.style.left = (rect.left + window.scrollX) + 'px';
      document.body.appendChild(selectionMenu);

      selectionMenu.querySelectorAll('.ai1-sel-btn').forEach(function (btn) {
        btn.addEventListener('mousedown', function (ev) {
          ev.preventDefault();
          var message = decodeURIComponent(btn.getAttribute('data-prefix')) + selected;
          removeSelectionMenu();
          if (!sidebarOpen) toggleSidebar(message);
          else sendToSidebar(message);
        });
      });
    }, 10);
  });

  document.addEventListener('mousedown', function (e) {
    if (selectionMenu && !selectionMenu.contains(e.target)) removeSelectionMenu();
  });

  function removeSelectionMenu() {
    if (selectionMenu) { selectionMenu.remove(); selectionMenu = null; }
  }

  function sendToSidebar(message) {
    if (!sidebarIframe) return;
    sidebarIframe.contentWindow.postMessage({
      type:        'AI1_SEND',
      message:     message,
      context:     pageContext ? pageContext.context     : null,
      suggestions: pageContext ? pageContext.suggestions : [],
      siteName:    pageContext ? pageContext.siteName    : 'generic',
    }, '*');
  }

  /* ══════════════════════════════════════════════
     SECTION 9 — CHROME RUNTIME MESSAGES
  ══════════════════════════════════════════════ */

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg.type === 'AI1_OPEN_SIDEBAR') {
      if (!sidebarOpen) toggleSidebar(msg.message);
      else sendToSidebar(msg.message);
    }
    if (msg.type === 'AI1_GET_CONTEXT') {
      sendResponse({
        context:     pageContext ? pageContext.context     : null,
        suggestions: pageContext ? pageContext.suggestions : [],
        siteName:    pageContext ? pageContext.siteName    : 'generic',
      });
      return true;
    }
  });

  /* ══════════════════════════════════════════════
     SECTION 10 — SIDEBAR CLOSE
  ══════════════════════════════════════════════ */

  window.addEventListener('message', function (msg) {
    if (msg.data && msg.data.type === 'AI1_CLOSE_SIDEBAR') {
      sidebarOpen = false;
      var w = document.getElementById('ai1-sidebar-wrapper');
      if (w) w.classList.remove('open');
      fab.classList.remove('active');
    }
  });

  /* ══════════════════════════════════════════════
     SECTION 11 — EXPOSE buildContextPrompt
     sidebar.js / popup.js call this via postMessage
     but API layer in sidebar needs it directly.
     Store on window under a namespaced key so
     sidebar iframe can access from its own origin.
  ══════════════════════════════════════════════ */
  window.__AI1_buildContextPrompt = buildContextPrompt;
  window.__AI1_summarizeContext   = summarizeContext;

})();
