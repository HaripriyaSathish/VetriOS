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