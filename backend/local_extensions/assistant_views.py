import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .ai_service import ask_groq_chat
from .assistant_tools import STUDENT_TOOLS, STUDENT_TOOL_FUNCTIONS
from .assistant_tools_trainer import TRAINER_TOOLS, TRAINER_TOOL_FUNCTIONS
from .assistant_tools_business import BUSINESS_TOOLS, BUSINESS_TOOL_FUNCTIONS
from .assistant_tools_intern import INTERN_TOOLS, INTERN_TOOL_FUNCTIONS

SYSTEM_PROMPT = (
    "You are the VetriOS Assistant, embedded in a training management platform. "
    "You can only see data through the tools provided — never invent numbers or "
    "records. For data questions, call the relevant tool and answer using only its "
    "result. If a tool needs a batch name or student name and the user didn't give "
    "one, ask which they mean rather than guessing. For report requests, call the "
    "report download tool with the right period. For writing requests (drafting an "
    "email, a message, a summary), just write the content directly — you don't need "
    "a tool for that. Keep answers concise and friendly.\n\n"
    "Language rule — read carefully: look ONLY at the most recent user message to "
    "decide what language to reply in. Ignore what language you used in any earlier "
    "reply in this conversation — your own past replies are not a signal for this "
    "decision. If the latest user message is plain English, your reply must be "
    "plain English, even if you replied in Tamil or Tanglish earlier in this same "
    "conversation. Only switch to Tanglish (Tamil words mixed with English, written "
    "in English letters) or Tamil script when the user's LATEST message is itself "
    "written that way. Keep technical terms (attendance, batch names, student "
    "names, task titles) in English even inside a Tanglish reply."
)


class AssistantChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = request.data.get("message", "").strip()
        history = request.data.get("history", [])
        if not message:
            return Response({"detail": "message is required."}, status=400)

        roles = request.user.active_role_names()
        if "Intern" in roles:
            tools = INTERN_TOOLS
            tool_functions = INTERN_TOOL_FUNCTIONS
        elif "Employee" in roles:
            tools = TRAINER_TOOLS
            tool_functions = TRAINER_TOOL_FUNCTIONS
        elif "Business Team" in roles:
            tools = BUSINESS_TOOLS
            tool_functions = BUSINESS_TOOL_FUNCTIONS
        elif "Student" in roles:
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

                    for call in reply["tool_calls"]:
                        fn_name = call["function"]["name"]
                        try:
                            args = json.loads(call["function"].get("arguments") or "{}")
                        except json.JSONDecodeError:
                            args = {}
                        func = tool_functions.get(fn_name)
                        result = func(request.user, **args) if func else {"error": "Unknown tool."}

                        if isinstance(result, dict) and result.get("action") == "download_report":
                            return Response({
                                "reply": result["message"],
                                "action": {"type": "download_report", "period": result["period"]},
                            })
                        if isinstance(result, dict) and result.get("action") == "download_batch_report":
                            return Response({
                                "reply": result["message"],
                                "action": {
                                    "type": "download_batch_report",
                                    "batch_id": result["batch_id"],
                                    "period": result["period"],
                                },
                            })
                        if isinstance(result, dict) and result.get("action") == "download_certificate":
                            return Response({
                                "reply": result["message"],
                                "action": {
                                    "type": "download_certificate",
                                    "document_id": result["document_id"],
                                },
                            })

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