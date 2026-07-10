"""
Task Router
===========
Classifies an incoming user message into one of four task categories:
  - coding    (programming, algorithms, debugging)
  - writing   (content creation, emails, resumes)
  - research  (explanations, comparisons, summaries)
  - general   (catch-all)

The classification is keyword-based and case-insensitive.
"""

# ─── Keyword maps ─────────────────────────────────────────────────────────────

_CODING_KEYWORDS = {
    "python", "code", "program", "bug", "algorithm",
    "leetcode", "java", "c++", "javascript", "function",
    "debug", "error", "syntax", "compile",
}

_WRITING_KEYWORDS = {
    "resume", "linkedin", "email", "blog", "write",
    "caption", "essay", "draft", "rewrite", "letter",
}

_RESEARCH_KEYWORDS = {
    "research", "compare", "explain", "summarize",
    "study", "analysis", "difference", "overview",
}


def classify_task(message: str) -> str:
    """
    Determines the task type for a given user message.

    Args:
        message (str): Raw user input.

    Returns:
        str: One of "coding", "writing", "research", or "general".
    """
    words = message.lower().split()
    word_set = set(words)

    if word_set & _CODING_KEYWORDS:
        return "coding"
    if word_set & _WRITING_KEYWORDS:
        return "writing"
    if word_set & _RESEARCH_KEYWORDS:
        return "research"
    return "general"
