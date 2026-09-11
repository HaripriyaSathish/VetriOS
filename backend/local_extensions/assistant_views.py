import json
import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .ai_service import ask_groq_chat

from module_03_training.models import TrainerProfile

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 2000
MAX_HISTORY_ITEMS = 12
MAX_HISTORY_CONTENT_LENGTH = 4000


def _safe_import_tools(module_name, tools_name, functions_name):
    """Import a (TOOLS, TOOL_FUNCTIONS) pair from a tools module without
    letting a missing/misnamed export crash the whole server on
    startup. Logs loudly so the real problem doesn't go unnoticed —
    check the server log for these on boot."""
    try:
        module = __import__(f"local_extensions.{module_name}", fromlist=[tools_name, functions_name])
        tools = getattr(module, tools_name)
        functions = getattr(module, functions_name)
        return tools, functions
    except (ImportError, AttributeError) as e:
        logger.error(
            "Assistant tool group '%s' failed to load (%s) — "
            "its tools will be unavailable until this is fixed.",
            module_name, e,
        )
        return [], {}


STUDENT_TOOLS, STUDENT_TOOL_FUNCTIONS = _safe_import_tools(
    "assistant_tools", "STUDENT_TOOLS", "STUDENT_TOOL_FUNCTIONS"
)
TRAINER_TOOLS, TRAINER_TOOL_FUNCTIONS = _safe_import_tools(
    "assistant_tools_trainer", "TRAINER_TOOLS", "TRAINER_TOOL_FUNCTIONS"
)
BUSINESS_TOOLS, BUSINESS_TOOL_FUNCTIONS = _safe_import_tools(
    "assistant_tools_business", "BUSINESS_TOOLS", "BUSINESS_TOOL_FUNCTIONS"
)
INTERN_TOOLS, INTERN_TOOL_FUNCTIONS = _safe_import_tools(
    "assistant_tools_intern", "INTERN_TOOLS", "INTERN_TOOL_FUNCTIONS"
)
PROJECT_TOOLS, PROJECT_TOOL_FUNCTIONS = _safe_import_tools(
    "assistant_tools_project", "PROJECT_TOOLS", "PROJECT_TOOL_FUNCTIONS"
)
ADMIN_TOOLS, ADMIN_TOOL_FUNCTIONS = _safe_import_tools(
    "assistant_tools_admin", "ADMIN_TOOLS", "ADMIN_TOOL_FUNCTIONS"
)
EMPLOYEE_TOOLS, EMPLOYEE_TOOL_FUNCTIONS = _safe_import_tools(
    "assistant_tools_employee", "EMPLOYEE_TOOLS", "EMPLOYEE_TOOL_FUNCTIONS"
)


SYSTEM_PROMPT = (
    "You are the VetriOS Assistant, embedded in a training management platform. "
    "You can only see data through the tools provided — never invent numbers or "
    "records. For data questions, call the relevant tool and answer using only its "
    "result. If a tool needs a batch name or student name and the user didn't give "
    "one, ask which they mean rather than guessing. For report requests, call the "
    "report download tool with the right period. For writing requests (drafting an "
    "email, a message, a summary), just write the content directly — you don't need "
    "a tool for that. Keep answers concise and friendly.\n\n"

    "Role-specific tool rules: "
    "System Administrators can use system administration tools. "
    "Trainers can use trainer tools for their assigned batches, students, "
    "attendance, schedules, assignments, performance, and leave. "
    "Project Managers can use project management tools. "
    "Business Team users can use business and client tools. "
    "Employees can use employee tools for their own employee information. "
    "Interns and Students can use their respective training/student tools. "
    "Only use tools that are actually provided for the current user.\n\n"

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

        raw_message = request.data.get("message", "")

        if not isinstance(raw_message, str):
            return Response({"detail": "message must be a string."}, status=400)

        message = raw_message.strip()

        if not message:
            return Response({"detail": "message is required."}, status=400)

        if len(message) > MAX_MESSAGE_LENGTH:
            return Response(
                {"detail": f"message must be {MAX_MESSAGE_LENGTH} characters or fewer."},
                status=400,
            )

        raw_history = request.data.get("history", [])

        if raw_history is None:
            raw_history = []

        if not isinstance(raw_history, list):
            return Response({"detail": "history must be a list."}, status=400)

        history = []
        for item in raw_history[-MAX_HISTORY_ITEMS:]:
            if not isinstance(item, dict):
                continue
            role = item.get("role")
            content = item.get("content")
            # Never accept tool messages or arbitrary message fields
            # from the browser; tool results must be created server-side.
            if role not in {"user", "assistant"} or not isinstance(content, str):
                continue
            history.append({"role": role, "content": content[:MAX_HISTORY_CONTENT_LENGTH]})

        # ====================================================
        # ACTIVE ROLE TOOL ROUTING
        # ====================================================

        roles = request.user.active_role_names()
        tool_groups = []

        if "System Administrator" in roles:
            tool_groups.append((ADMIN_TOOLS, ADMIN_TOOL_FUNCTIONS))

        # Trainer is determined by TrainerProfile rather than the RBAC
        # role list because the current database does not have a
        # "Trainer" RBAC role.
        is_trainer = TrainerProfile.objects.filter(user=request.user).exists()
        if is_trainer:
            tool_groups.append((TRAINER_TOOLS, TRAINER_TOOL_FUNCTIONS))

        if "Intern" in roles:
            tool_groups.append((INTERN_TOOLS, INTERN_TOOL_FUNCTIONS))

        if "Project Manager" in roles or "System Administrator" in roles:
            tool_groups.append((PROJECT_TOOLS, PROJECT_TOOL_FUNCTIONS))

        if "Business Team" in roles:
            tool_groups.append((BUSINESS_TOOLS, BUSINESS_TOOL_FUNCTIONS))

        if "Employee" in roles:
            tool_groups.append((EMPLOYEE_TOOLS, EMPLOYEE_TOOL_FUNCTIONS))

        if "Student" in roles:
            tool_groups.append((STUDENT_TOOLS, STUDENT_TOOL_FUNCTIONS))

        tools = [tool for group, _ in tool_groups for tool in group]
        tool_functions = {name: function for _, functions in tool_groups for name, function in functions.items()}

        sources = []

        messages = (
            [{"role": "system", "content": SYSTEM_PROMPT}]
            + history
            + [{"role": "user", "content": message}]
        )

        # ====================================================
        # GROQ TOOL LOOP
        # ====================================================

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

                        if isinstance(result, dict):
                            sources.extend(result.pop("_sources", []))

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
                                "action": {"type": "download_certificate", "document_id": result["document_id"]},
                            })

                        messages.append({
                            "role": "tool",
                            "tool_call_id": call["id"],
                            "name": fn_name,
                            "content": json.dumps(result, default=str),
                        })

                    continue

                return Response({"reply": reply.get("content", ""), "sources": sources})

            return Response({"reply": "Sorry, I couldn't complete that in time — try rephrasing."})

        except Exception:
            logger.exception("Assistant request failed for user %s", request.user.pk)
            return Response(
                {"detail": "The assistant is temporarily unavailable. Please try again."},
                status=503,
            )