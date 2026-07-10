"""
AI-One FastAPI Backend
======================
Entry point for the AI-One backend. Exposes three endpoints:
  POST /chat    — routes a user message through the appropriate AI workflow
  GET  /history — returns all persisted chat history
  DELETE /history/{index} — removes a single history entry by index
"""

import json
import os

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services.granite import ask_granite
from services.router import classify_task
from services.prompt_builder import build_prompt
from services.workflow import coding_workflow, writing_workflow, research_workflow
from services.history import save_chat, load_history

app = FastAPI(
    title="AI-One",
    version="1.0.0",
    description="Context-aware AI workflow orchestrator powered by IBM Granite.",
)

# ─── File path for direct history writes ──────────────────────────────────────
_HISTORY_FILE = os.path.join(os.path.dirname(__file__), "database", "history.json")


# ─── Request / Response Models ────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """Incoming chat payload from the Chrome extension."""
    message: str


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health", summary="Health check")
def health():
    """Returns a simple status payload to confirm the backend is running."""
    return {"status": "ok", "app": "AI-One"}


@app.post("/chat", summary="Send a message and receive an AI response")
def chat(request: ChatRequest):
    """
    Routes the user message through an AI workflow based on detected task type.

    - Classifies the message as coding / writing / research / general.
    - Runs the matching multi-step workflow (or a single-step general call).
    - Persists the conversation to disk.
    - Returns task label, workflow steps, and final AI response.
    """
    task = classify_task(request.message)

    try:
        if task == "coding":
            result = coding_workflow(request.message)
        elif task == "writing":
            result = writing_workflow(request.message)
        elif task == "research":
            result = research_workflow(request.message)
        else:
            prompt = build_prompt(task, request.message)
            raw_answer = ask_granite(prompt)
            result = {
                "workflow": [{"step": "General Assistant", "status": "completed"}],
                "answer": raw_answer,
            }

    except Exception as exc:
        error_message = str(exc)
        status_code = 429 if "429" in error_message else 503
        return JSONResponse(
            status_code=status_code,
            content={"detail": error_message},
        )

    save_chat(
        user_message=request.message,
        task=task,
        workflow=result["workflow"],
        response=result["answer"],
    )

    return {
        "task": task,
        "workflow": result["workflow"],
        "response": result["answer"],
    }


@app.get("/history", summary="Retrieve all chat history")
def get_history():
    """Returns the full list of persisted conversations."""
    return load_history()


@app.delete("/history/{index}", summary="Delete a history entry by index")
def delete_history_item(index: int):
    """
    Removes a single conversation from history by its zero-based index.

    Raises 404 if the index is out of range.
    """
    history = load_history()

    if index < 0 or index >= len(history):
        raise HTTPException(status_code=404, detail="History item not found.")

    history.pop(index)

    with open(_HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=4)

    return {"message": "Deleted successfully.", "remaining": len(history)}
