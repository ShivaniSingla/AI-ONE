"""
AI Workflow Pipelines
=====================
Implements multi-step agentic workflows for each task type.
Each workflow calls Granite multiple times with specialised prompts,
then merges the results into a final answer.

Workflows:
  - coding_workflow   : Algorithm → Code Generation → Code Review → Judge
  - writing_workflow  : Draft Writer → Language Expert → Editor/Judge
  - research_workflow : Research Analyst → Summarizer → Insight Generator → Judge
"""

from services.granite import ask_granite
from services.judge import judge_response


def coding_workflow(user_query: str) -> dict:
    """
    Four-step coding pipeline.

    Steps:
      1. Algorithm Expert   — explains the approach
      2. Code Generator     — produces clean Python code with explanation
      3. Code Reviewer      — suggests improvements
      4. Judge              — merges code and review into a final response

    Args:
        user_query (str): The user's coding question or request.

    Returns:
        dict: {"workflow": [...steps], "answer": str}
    """
    # Step 1 — Understand and explain the algorithm
    algorithm = ask_granite(f"""\
You are an expert Computer Science teacher.

Understand the user's problem and explain the algorithm clearly.

User Question:
{user_query}
""")

    # Step 2 — Generate clean code from the algorithm
    code = ask_granite(f"""\
You are an expert Software Engineer.

Using the following algorithm explanation:

{algorithm}

Generate clean, well-commented Python code and explain each part.
""")

    # Step 3 — Review the generated code
    review = ask_granite(f"""\
You are a Senior Software Engineer performing a code review.

Review the following code and suggest concrete improvements.

Code:

{code}
""")

    # Step 4 — Combine code and review into the final answer
    final_answer = ask_granite(f"""\
You are an AI Judge.

Combine the generated code and its review into one polished, complete response.

Generated Code:

{code}

Code Review:

{review}
""")

    return {
        "workflow": [
            {"step": "Algorithm Expert", "status": "completed"},
            {"step": "Code Generator",   "status": "completed"},
            {"step": "Code Reviewer",    "status": "completed"},
            {"step": "Judge",            "status": "completed"},
        ],
        "answer": final_answer,
    }


def writing_workflow(user_query: str) -> dict:
    """
    Three-step writing pipeline.

    Steps:
      1. Content Writer   — produces an initial draft
      2. Language Expert  — improves grammar, tone and readability
      3. Editor / Judge   — finalises the polished version

    Args:
        user_query (str): The user's writing request.

    Returns:
        dict: {"workflow": [...steps], "answer": str}
    """
    # Step 1 — Write an initial draft
    draft = ask_granite(f"""\
You are an expert content writer.

Write high-quality content based on the following request.

User Request:
{user_query}
""")

    # Step 2 — Improve grammar and tone
    improved = ask_granite(f"""\
You are an English language expert.

Improve the grammar, tone and readability of the following content.

Content:

{draft}
""")

    # Step 3 — Produce the final polished version
    final = ask_granite(f"""\
You are a professional editor.

Produce the final polished version by combining the best of both drafts.

Original Draft:

{draft}

Improved Version:

{improved}
""")

    return {
        "workflow": [
            {"step": "Content Writer",  "status": "completed"},
            {"step": "Language Expert", "status": "completed"},
            {"step": "Editor / Judge",  "status": "completed"},
        ],
        "answer": final,
    }


def research_workflow(user_query: str) -> dict:
    """
    Four-step research pipeline.

    Steps:
      1. Research Expert    — deep-dives into the topic
      2. Summarizer         — condenses the research
      3. Insight Generator  — extracts key takeaways
      4. Judge              — merges everything into the final answer

    Args:
        user_query (str): The user's research question or topic.

    Returns:
        dict: {"workflow": [...steps], "answer": str}
    """
    # Step 1 — Research the topic
    research = ask_granite(f"""\
You are an expert research analyst.

Research the following topic thoroughly and provide detailed information.

Topic:
{user_query}
""")

    # Step 2 — Summarize the research
    summary = ask_granite(f"""\
Summarize the following research clearly and concisely.

{research}
""")

    # Step 3 — Extract actionable insights
    insights = ask_granite(f"""\
Based on the following summary, generate the most important insights and takeaways.

{summary}
""")

    # Step 4 — Combine all outputs into the final answer
    final = judge_response("\n\n".join([research, summary, insights]))

    return {
        "workflow": [
            {"step": "Research Expert",   "status": "completed"},
            {"step": "Summarizer",        "status": "completed"},
            {"step": "Insight Generator", "status": "completed"},
            {"step": "Judge",             "status": "completed"},
        ],
        "answer": final,
    }
