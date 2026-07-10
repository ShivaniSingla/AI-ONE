"""
History Service
===============
Manages chat history persistence using a JSON file on disk.
"""

import json
import os
from datetime import datetime

# Base directory
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

# Database folder
DATABASE_DIR = os.path.join(BASE_DIR, "database")

# History file
_HISTORY_FILE = os.path.join(DATABASE_DIR, "history.json")


def ensure_storage():
    """
    Ensure the database folder and history.json file exist.
    """
    os.makedirs(DATABASE_DIR, exist_ok=True)

    if not os.path.exists(_HISTORY_FILE):
        with open(_HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def load_history():
    """
    Load all previous chats.
    """
    ensure_storage()

    try:
        with open(_HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def save_chat(user_message, task, workflow, response):
    """
    Save a conversation.
    """
    ensure_storage()

    history = load_history()

    history.append({
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "user_message": user_message,
        "task": task,
        "workflow": workflow,
        "response": response
    })

    with open(_HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=4)