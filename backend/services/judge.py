"""
Judge Service
=============
Combines multiple AI-generated outputs into a single polished response
by making a final "judge" call to Granite.
"""

from services.granite import ask_granite


def judge_response(combined_outputs: str) -> str:
    """
    Sends multiple draft outputs to Granite and asks it to produce
    one unified, polished answer.

    Args:
        combined_outputs (str): Concatenated outputs from previous workflow steps.

    Returns:
        str: A single refined response.
    """
    prompt = f"""\
You are an AI Judge.

Combine the following outputs into one polished, well-structured answer.

Outputs:

{combined_outputs}

Return ONLY the final polished response.
"""
    return ask_granite(prompt)
