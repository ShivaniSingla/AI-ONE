"""
IBM Granite API Client
======================
Handles authentication and text generation against the IBM watsonx.ai platform.

Uses environment variables loaded from backend/.env:
  IBM_API_KEY    — IBM Cloud API key
  IBM_PROJECT_ID — watsonx.ai project ID
  IBM_REGION     — deployment region (e.g. us-south)
"""

import os

import requests
from dotenv import load_dotenv

load_dotenv()

IBM_API_KEY    = os.getenv("IBM_API_KEY")
IBM_PROJECT_ID = os.getenv("IBM_PROJECT_ID")
IBM_REGION     = os.getenv("IBM_REGION", "us-south")

_IAM_TOKEN_URL   = "https://iam.cloud.ibm.com/identity/token"
_WATSONX_VERSION = "2023-05-29"
_MODEL_ID        = "ibm/granite-4-h-small"
_MAX_TOKENS      = 500
_TEMPERATURE     = 0.7


def _get_access_token() -> str:
    """
    Exchanges the IBM Cloud API key for a short-lived IAM access token.

    Returns:
        str: Bearer access token.

    Raises:
        requests.HTTPError: If the IAM request fails.
    """
    response = requests.post(
        _IAM_TOKEN_URL,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": IBM_API_KEY,
        },
    )
    response.raise_for_status()
    return response.json()["access_token"]


def ask_granite(prompt: str) -> str:
    """
    Sends a prompt to IBM Granite and returns the generated text.

    Args:
        prompt (str): The full prompt string to send.

    Returns:
        str: The model's text response.

    Raises:
        Exception: On rate-limit (429) or authentication failure (401).
        requests.HTTPError: On any other non-2xx response.
    """
    token = _get_access_token()

    url = (
        f"https://{IBM_REGION}.ml.cloud.ibm.com"
        f"/ml/v1/text/chat?version={_WATSONX_VERSION}"
    )

    payload = {
        "project_id": IBM_PROJECT_ID,
        "model_id":   _MODEL_ID,
        "messages":   [{"role": "user", "content": prompt}],
        "max_tokens": _MAX_TOKENS,
        "temperature": _TEMPERATURE,
    }

    headers = {
        "Accept":        "application/json",
        "Content-Type":  "application/json",
        "Authorization": f"Bearer {token}",
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code == 429:
        raise Exception(
            "IBM API rate limit reached (429). Please wait a moment and try again."
        )
    if response.status_code == 401:
        raise Exception(
            "IBM API authentication failed (401). Check your IBM_API_KEY in backend/.env."
        )

    response.raise_for_status()

    return response.json()["choices"][0]["message"]["content"]
