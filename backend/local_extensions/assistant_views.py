import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .ai_service import ask_groq_chat
from .assistant_tools import STUDENT_TOOLS, STUDENT_TOOL_FUNCTIONS

SYSTEM_PROMPT = (
    "You are the VetriOS Assistant, embedded in a training management platform. "
    "You can only see data through the tools provided — never invent numbers or "
    "records. For data questions (attendance, assignments, eligibility), call the "
    "relevant tool and answer using only its result. If the student asks for their "
    "weekly or monthly report, call get_report_download with the right period. For "
    "writing requests (drafting an email, a message, a summary), just write the "
    "content directly — you don't need a tool for that. Keep answers concise and friendly."
)


class AssistantChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = request.data.get("message", "").strip()
        history = request.data.get("history", [])
        if not message:
            return Response({"detail": "message is required."}, status=400)

        roles = request.user.active_role_names()
        if "Student" in roles:
            tools = STUDENT_TOOLS
            tool_functions = STUDENT_TOOL_FUNCTIONS
        else:
            tools = []
            tool_functions = {}

        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history + [
            {"role": "user", "content": message}
        ]

        try:
            for _ in range(4):
                reply = ask_groq_chat(messages, tools=tools if tools else None)

                if reply.get("tool_calls"):
                    messages.append(reply)
                    action_payload = None

                    for call in reply["tool_calls"]:
                        fn_name = call["function"]["name"]
                        try:
                            args = json.loads(call["function"].get("arguments") or "{}")
                        except json.JSONDecodeError:
                            args = {}
                        func = tool_functions.get(fn_name)
                        result = func(request.user, **args) if func else {"error": "Unknown tool."}

                        if isinstance(result, dict) and result.get("action") == "download_report":
                            action_payload = {"type": "download_report", "period": result["period"]}
                            return Response({"reply": result["message"], "action": action_payload})

                        messages.append({
                            "role": "tool",
                            "tool_call_id": call["id"],
                            "name": fn_name,
                            "content": json.dumps(result, default=str),
                        })
                    continue

                return Response({"reply": reply.get("content", "")})

            return Response({"reply": "Sorry, I couldn't complete that in time — try rephrasing."})
        except Exception as e:
            return Response({"detail": f"Assistant error: {e}"}, status=500)