# AI-One — Context-Aware AI Workflow Orchestrator

> **A Chrome Extension + FastAPI backend powered by IBM Granite.**
> Understands where you are on the web and routes your request through expert multi-step AI workflows.

---

## Problem Statement

Modern AI chat tools are generic — they have no idea what you're looking at. You have to copy-paste context manually, describe what page you're on, and repeat yourself for every question.

**AI-One solves this.** It reads your current page (LeetCode, GitHub, LinkedIn, YouTube, Gmail, and more), understands what you need, and automatically routes your request through the right AI workflow — all without leaving your browser.

---

## Why AI-One?

| Feature | Generic AI Chat | AI-One |
|---|---|---|
| Knows your current page | ❌ | ✅ |
| Multi-step AI pipeline | ❌ | ✅ |
| Expert-specialised prompts | ❌ | ✅ |
| Works on every website | ❌ | ✅ |
| Context-aware suggestions | ❌ | ✅ |
| Conversation history | ✅ | ✅ |

---

## Features

- **Context Extraction** — Reads LeetCode problems, GitHub repos, LinkedIn profiles, YouTube transcripts, Gmail threads, Stack Overflow questions, and Amazon products automatically.
- **Smart Suggestions** — Surfaces relevant prompt chips based on the current website.
- **Multi-Step Workflows** — Coding, Writing, and Research requests are processed through specialised agent pipelines before returning a polished answer.
- **Workflow Visualizer** — Live animated pipeline showing every agent step in real time.
- **Popup & Sidebar** — Full chat experience in both the popup (380×560 px) and a resizable side panel.
- **Text Selection Menu** — Select any text on any page → mini action bar → Explain / Summarize / Rewrite / Translate.
- **Right-Click Menu** — Access AI-One actions from the browser context menu.
- **Conversation History** — Searchable, persistent history stored in `chrome.storage.local`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                        │
│                                                             │
│  ┌──────────────┐   ┌───────────────┐   ┌───────────────┐   │
│  │  popup.js    │   │  sidebar.js   │   │  content.js   │   │
│  │  (popup UI)  │   │  (side panel) │   │  (page inject)│   │
│  └──────┬───────┘   └──────┬────────┘   └──────┬────────┘   │
│         │                  │                   │            │
│         └──────────────────┼───────────────────┘            │
│                            │ shared/                        │
│                 ┌──────────┴──────────┐                     │
│                 │  api.js             │  POST /chat         │
│                 │  context.js         │  ──────────────────►│
│                 │  workflow.js        │                     │
│                 │  markdown.js        │◄────────────────────│
│                 │  history.js         │  JSON response      │
│                 └─────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                          │
│                                                             │
│   router.py          ──► classify_task()                    │
│   workflow.py         ──► coding / writing / research       │
│   prompt_builder.py   ──► build system prompts              │
│   granite.py          ──► IBM Granite API calls             │
│   judge.py            ──► merge & polish outputs            │
│   history.py          ──► JSON persistence                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  IBM watsonx.ai (Granite 4)
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| AI Model | IBM Granite (`ibm/granite-4-h-small`) via IBM watsonx.ai |
| Backend | Python 3.12 · FastAPI · Uvicorn |
| Extension | Chrome MV3 · Vanilla JS (ES Modules) |
| Storage | `chrome.storage.local` (conversations) · JSON file (backend) |
| Auth | IBM IAM — API key → short-lived access token |

---

## Folder Structure

```
AI-One/
├── backend/
│   ├── main.py                  ← FastAPI app + route definitions
│   ├── requirements.txt         ← Python dependencies
│   ├── database/
│   │   └── history.json         ← Persisted chat history (git-ignored)
│   └── services/
│       ├── granite.py           ← IBM Granite API client
│       ├── router.py            ← Task classification (coding/writing/research)
│       ├── prompt_builder.py    ← System prompt templates
│       ├── workflow.py          ← Multi-step agent pipelines
│       ├── judge.py             ← Response merging & polishing
│       ├── history.py           ← JSON persistence layer
│       └── progress.py          ← Workflow step utilities
│
├── extension/
│   ├── manifest.json            ← Chrome MV3 manifest
│   ├── background.js            ← Service worker (context menus, message router)
│   ├── content.js               ← Injected into every page (FAB, sidebar, extractors)
│   ├── content.css              ← Styles for FAB, sidebar wrapper, selection menu
│   ├── popup.html / .css / .js  ← Browser action popup (380×560 px)
│   ├── sidebar.html / .css / .js← Full-height side panel
│   ├── shared/
│   │   ├── api.js               ← Centralised backend API layer
│   │   ├── context.js           ← Context summarisation + prompt enrichment
│   │   ├── workflow.js          ← Animated pipeline timeline component
│   │   ├── markdown.js          ← Lightweight Markdown → HTML renderer
│   │   └── history.js           ← chrome.storage.local conversation manager
│   └── icons/
│       ├── icon16.png
│       ├── icon32.png
│       ├── icon48.png
│       └── icon128.png
│
├── docs/
│   ├── architecture.png         ← Architecture diagram (add your own)
│   ├── workflow.png             ← Workflow diagram (add your own)
│   └── screenshots/             ← UI screenshots (add your own)
│
├── .env.example                 ← Environment variable template
├── .gitignore
├── LICENSE                      ← MIT
└── README.md
```

---

## Installation

### Prerequisites

- Python 3.10+
- Google Chrome (or any Chromium-based browser)
- An [IBM Cloud account](https://cloud.ibm.com/) with watsonx.ai access

### 1. Clone the repository

```bash
git clone https://github.com/your-username/AI-One.git
cd AI-One
```

### 2. Configure environment variables

```bash
cp .env.example backend/.env
```

Edit `backend/.env` and fill in your IBM credentials:

```env
IBM_API_KEY=your_ibm_api_key_here
IBM_PROJECT_ID=your_project_id_here
IBM_REGION=us-south
```

> **Where to find these values:**
> - `IBM_API_KEY` → [IBM Cloud → Manage → Access (IAM) → API keys](https://cloud.ibm.com/iam/apikeys)
> - `IBM_PROJECT_ID` → IBM watsonx.ai → your project → Manage → General
> - `IBM_REGION` → The region shown in your watsonx.ai URL (e.g. `us-south`)

### 3. Set up the backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Start the backend

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
Visit `http://localhost:8000/docs` for the interactive Swagger UI.

### 5. Load the Chrome extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. The **AI-One** icon appears in your Chrome toolbar ✅

---

## Usage

### Popup
Click the AI-One icon in the Chrome toolbar. The popup detects your current page and shows relevant suggestions.

### Sidebar
Click the floating **A** button on any webpage, or click "Open in Sidebar" in the popup. A resizable side panel opens with the full chat interface and the workflow pipeline timeline.

### Text Selection
Select any text on any page → a mini action bar appears above the selection → choose:
- **Explain** — get a detailed explanation
- **Summarize** — condense the text
- **Rewrite** — improve clarity
- **Translate** — convert to English
- **Improve** — enhance quality

### Right-Click Menu
Right-click any selected text → hover over the **AI-One** submenu.

---

## Workflow Explanation

When you send a message, AI-One:

1. **Detects the task type** — Keyword analysis classifies it as `coding`, `writing`, `research`, or `general`.
2. **Enriches the prompt** — Page context is automatically injected (LeetCode problem, GitHub file, LinkedIn profile, etc.).
3. **Runs the pipeline** — Multiple specialised Granite agents process the request in sequence.
4. **Judges the output** — A final agent merges and polishes all outputs.
5. **Streams the response** — The answer appears with a token-by-token streaming effect.

### Agent Pipelines

| Task | Steps |
|---|---|
| **Coding** | Algorithm Expert → Code Generator → Code Reviewer → Judge |
| **Writing** | Content Writer → Language Expert → Editor / Judge |
| **Research** | Research Analyst → Summarizer → Insight Generator → Judge |
| **General** | Single-step General Assistant |

---

## Supported Websites

| Website | Extracted Context |
|---|---|
| **LeetCode** | Problem title, difficulty, statement, examples, constraints, language, user code |
| **GitHub** | Repo name, branch, file path, file code, README |
| **LinkedIn** | Profile: name, headline, about, experience, skills · Job: title, company, description |
| **YouTube** | Video title, channel, description, current timestamp, transcript |
| **Gmail** | Subject, sender, full thread |
| **Stack Overflow** | Question, code snippets, tags, accepted answer |
| **Amazon** | Product title, price, rating, features, reviews |
| **Any other site** | Page title, meta description, selected text, main content |

---

## Configuration

### Change the backend URL

Edit `extension/shared/api.js`:

```js
const CONFIG = {
    API_BASE_URL: 'https://your-deployed-backend.com', // ← change this
};
```

This is the only place you need to change for deployment.

---

## Screenshots

> *(Add screenshots to `docs/screenshots/` and reference them here)*

| Feature | Preview |
|---|---|
| Popup Home | `docs/screenshots/popup-home.png` |
| Chat with Workflow | `docs/screenshots/popup-chat.png` |
| Sidebar on LeetCode | `docs/screenshots/sidebar-leetcode.png` |
| Text Selection Menu | `docs/screenshots/selection-menu.png` |

---

## Future Scope

The modular architecture is designed for easy extension:

- **Voice Assistant** — Web Speech API integration in `shared/voice.js`
- **OCR / Screenshot Analysis** — `chrome.desktopCapture` + vision model
- **PDF Understanding** — PDF.js content script
- **Browser Memory** — Vector-search powered conversation memory
- **Multi-language Support** — Prompt templates in multiple languages
- **Cloud Deployment** — Deploy backend to IBM Code Engine or Railway

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgements

- **IBM Granite** — AI model powering all responses
- **IBM watsonx.ai** — Enterprise AI platform
- **IBM SkillBuild** — Project inspiration and learning resources
- **FastAPI** — Modern Python web framework
- **Chrome Extensions MV3** — Browser extension platform

---

*Built with IBM Granite · FastAPI · Chrome MV3*
