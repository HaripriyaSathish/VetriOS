from decouple import config
import requests

GROQ_API_KEY = config("GROQ_API_KEY", default="")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def ask_groq(prompt, max_tokens=1500, model="openai/gpt-oss-120b"):
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set in the environment.")

    response = requests.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.4,
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]

def ask_groq_chat(messages, tools=None, model="openai/gpt-oss-120b", max_tokens=1200, temperature=0.3):
    """Like ask_groq, but supports tool/function calling and returns the
    full assistant message object (not just text), so the caller can
    inspect tool_calls and loop."""
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set in the environment.")

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    response = requests.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]