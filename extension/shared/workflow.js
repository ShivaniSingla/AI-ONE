/**
 * shared/workflow.js
 * ==================
 * Renders and animates the AI workflow pipeline timeline used in both the
 * popup and the sidebar.
 *
 * Exported functions:
 *   renderWorkflow(listEl, badgeEl, badgeValEl, workflow, task)
 *   animateWorkflowLoading(listEl, stepNames) → stopFn
 *   resetWorkflow(listEl, badgeEl)
 */

// ── SVG icons for each step state ────────────────────────────────────────────

const STEP_ICONS = {
    done: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
             <path d="M3 8l4 4 6-6" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round"/>
           </svg>`,

    running: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.8"
                        stroke-dasharray="26" stroke-dashoffset="8" class="wf-spin"/>
              </svg>`,

    pending: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5"/>
              </svg>`,
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Maps a raw status string to a CSS/icon key. */
function resolveStatusKey(status) {
    if (status === 'completed') return 'done';
    if (status === 'running')   return 'running';
    return 'pending';
}

/**
 * Builds a single workflow step card element.
 *
 * @param   {string}      stepName - Human-readable step label.
 * @param   {string}      status   - "completed" | "running" | "pending"
 * @returns {HTMLElement}
 */
function buildStepCard(stepName, status) {
    const key   = resolveStatusKey(status);
    const label = key === 'done'    ? 'Completed'    :
                  key === 'running' ? 'In progress…' : 'Pending';
    const badge = key === 'done'    ? '✔' :
                  key === 'running' ? '…' : '—';

    const card = document.createElement('div');
    card.className = `wf-card ${key}`;
    card.innerHTML = `
        <div class="wf-icon ${key}">${STEP_ICONS[key]}</div>
        <div class="wf-info">
            <div class="wf-name">${String(stepName).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
            <div class="wf-status">${label}</div>
        </div>
        <span class="wf-badge ${key}">${badge}</span>`;
    return card;
}

/**
 * Updates an existing card's visual state in place (avoids a DOM rebuild).
 *
 * @param {HTMLElement} card   - The card element to update.
 * @param {string}      newKey - "done" | "running" | "pending"
 */
function updateCardState(card, newKey) {
    const label = newKey === 'done'    ? 'Completed'    :
                  newKey === 'running' ? 'In progress…' : 'Pending';
    const badge = newKey === 'done' ? '✔' : newKey === 'running' ? '…' : '—';

    card.className = `wf-card ${newKey} visible`;
    card.querySelector('.wf-icon').className   = `wf-icon ${newKey}`;
    card.querySelector('.wf-icon').innerHTML   = STEP_ICONS[newKey];
    card.querySelector('.wf-status').textContent = label;
    card.querySelector('.wf-badge').className  = `wf-badge ${newKey}`;
    card.querySelector('.wf-badge').textContent = badge;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Renders the final completed workflow steps into a container element.
 *
 * @param {HTMLElement}      listEl     - Container to render steps into.
 * @param {HTMLElement|null} badgeEl    - Optional task-type badge wrapper.
 * @param {HTMLElement|null} badgeValEl - Optional element for the badge text.
 * @param {Array<{step: string, status: string}>} workflow - Step definitions.
 * @param {string} task - Detected task label (e.g. "coding").
 */
export function renderWorkflow(listEl, badgeEl, badgeValEl, workflow, task) {
    if (!listEl) return;
    listEl.innerHTML = '';

    workflow.forEach((item, i) => {
        const card = buildStepCard(item.step, item.status);
        listEl.appendChild(card);
        // Stagger the fade-in animation
        setTimeout(() => card.classList.add('visible'), 60 + i * 90);
    });

    if (task && badgeEl) {
        badgeEl.hidden = false;
        if (badgeValEl) badgeValEl.textContent = task;
    }
}

/**
 * Displays animated placeholder steps while waiting for the backend response.
 * Steps cycle through pending → running → done states on a timer.
 *
 * @param   {HTMLElement} listEl    - Container for the placeholder steps.
 * @param   {string[]}    stepNames - Labels for the placeholder steps.
 * @returns {Function}              - Call this to stop the animation early.
 */
export function animateWorkflowLoading(listEl, stepNames) {
    if (!listEl) return () => {};
    listEl.innerHTML = '';

    const cards = stepNames.map((name, i) => {
        const card = buildStepCard(name, 'pending');
        listEl.appendChild(card);
        setTimeout(() => card.classList.add('visible'), 40 + i * 60);
        return card;
    });

    let currentStep = 0;
    const interval = setInterval(() => {
        // Mark the previous step as done
        if (currentStep > 0) {
            updateCardState(cards[currentStep - 1], 'done');
        }
        // Start the next step
        if (currentStep < cards.length) {
            updateCardState(cards[currentStep], 'running');
            currentStep++;
        } else {
            clearInterval(interval);
        }
    }, 650);

    return () => clearInterval(interval);
}

/**
 * Resets the workflow panel to its idle (empty) state.
 *
 * @param {HTMLElement|null} listEl  - The workflow list container.
 * @param {HTMLElement|null} badgeEl - The task badge element.
 */
export function resetWorkflow(listEl, badgeEl) {
    if (listEl)  listEl.innerHTML = '<p class="workflow-empty">Send a message to see the workflow.</p>';
    if (badgeEl) badgeEl.hidden = true;
}
