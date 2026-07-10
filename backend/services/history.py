"""
History Service
===============
Manages chat history persistence using a JSON file on disk.

Storage path: backend/database/history.json

Each history entry contains:
  - timestamp    (str)  : ISO-style datetime string
  - user_message (str)  : Original user input
  - task         (str)  : Detected task type
  - workflow     (list) : Steps executed in the pipeline
  - response     (str)  : Final AI response
"""

import json
import os
from datetime import datetime

_HISTORY_FILE = os.path.join(os.path.dirname(__file__), "..", "database", "history.json")


def load_history() -> list:
    """
    Reads and returns all stored chat history entries.

    Returns:
        list: Parsed JSON array of conversation objects, or [] if file is
              missing or corrupted.
    """
    if not os.path.exists(_HISTORY_FILE):
        return []

    with open(_HISTORY_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def save_chat(user_message: str, task: str, workflow: list, response: str) -> None:
    """
    Appends a new conversation entry to the history file.

    Args:
        user_message (str):  The original user input.
        task         (str):  Detected task type (e.g. "coding").
        workflow     (list): List of workflow step dicts.
        response     (str):  Final AI-generated answer.
    """
    history = load_history()

    history.append({
        "timestamp":    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "user_message": user_message,
        "task":         task,
        "workflow":     workflow,
        "response":     response,
    })

    with open(_HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=4)
