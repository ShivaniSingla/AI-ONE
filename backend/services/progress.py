"""
Progress Utilities
==================
Shared helpers for building workflow step objects used across pipeline modules.
"""


def make_step(name: str, status: str = "completed") -> dict:
    """
    Creates a standardised workflow step dictionary.

    Args:
        name   (str): Human-readable step label.
        status (str): Step status — "completed", "running", or "pending".

    Returns:
        dict: {"step": name, "status": status}
    """
    return {"step": name, "status": status}
