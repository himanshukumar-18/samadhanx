"""LangGraph orchestration pipeline for Citizen Smart Problem Assistant.

Coordinates multi-turn conversation, fact extraction, state merging,
missing-field determination, conditional routing, question generation,
and problem draft synthesis.
"""

import json
import logging
import re
from typing import Any, Literal, TypedDict

from pydantic import BaseModel

try:
    from langgraph.graph import END, START, StateGraph
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    END = "__end__"
    START = "__start__"
    StateGraph = None

from app.ai_engine.prompts.problem_assistant import (
    ASSISTANT_SYSTEM_PROMPT,
    DRAFT_GENERATION_PROMPT,
    EXTRACTION_PROMPT,
    QUESTION_GENERATION_PROMPT,
)
from app.ai_engine.providers.base import ModelProvider
from app.ai_engine.providers.factory import get_model_provider
from app.ai_engine.schemas.problem_assistant import (
    AssistantExtractionOutput,
    AssistantProblemState,
    AssistantQuestionOutput,
    GeneratedProblemDraft,
)

logger = logging.getLogger("samadhanx.ai.problem_assistant_graph")


class AssistantGraphState(TypedDict, total=False):
    # Inputs
    session_id: str
    user_id: str | None
    latest_message: str
    history: list[dict[str, str]]
    current_state: dict[str, Any]
    turn_count: int
    max_turns: int
    district_hint: str | None

    # Intermediate artifacts
    detected_language: str
    is_off_topic: bool
    extracted_state: dict[str, Any]
    missing_fields: list[str]
    is_ready_for_draft: bool
    validation_status: Literal["ready_to_draft", "need_more_info", "off_topic_clarification"]

    # Final outputs
    next_question: str | None
    next_field: str | None
    suggested_answers: list[str]
    problem_draft: dict[str, Any] | None
    progress: int
    complete: bool
    final_message: str | None


class ProblemAssistantGraphBuilder:
    """Builds and compiles the Smart Problem Assistant LangGraph workflow."""

    def __init__(self, provider: ModelProvider | None = None):
        self.provider = provider or get_model_provider()

    # ------------------------------------------------------------------
    # Node 1: Analyze Input
    # ------------------------------------------------------------------
    def _node_analyze_input(self, state: AssistantGraphState) -> dict[str, Any]:
        """Detect language, check for off-topic or explicit termination requests."""
        message = (state.get("latest_message") or "").strip()
        lowered = message.lower()

        # Language detection heuristic
        has_devanagari = bool(re.search(r"[\u0900-\u097f]", message))
        if has_devanagari:
            lang = "hindi"
        elif any(w in lowered for w in ["hai", "nahi", "karo", "kharab", "paani", "sadak", "bijli", "gaav", "kripya"]):
            lang = "hinglish"
        else:
            lang = "english"

        # Check for off-topic prompt injection or chatter
        off_topic_triggers = ["write a poem", "tell a joke", "python code", "who is the prime minister", "ignore previous instructions"]
        is_off_topic = any(t in lowered for t in off_topic_triggers)

        # Check for explicit completion request
        finish_triggers = ["draft it", "submit now", "that is all", "bas itna hi", "report banao", "enough info", "no more details"]
        explicit_finish = any(t in lowered for t in finish_triggers)

        return {
            "detected_language": lang,
            "is_off_topic": is_off_topic,
            "is_ready_for_draft": explicit_finish,
        }

    # ------------------------------------------------------------------
    # Node 2: Extract Problem Data
    # ------------------------------------------------------------------
    async def _node_extract_data(self, state: AssistantGraphState) -> dict[str, Any]:
        """Extract structured problem facts via structured LLM schema."""
        if state.get("is_off_topic"):
            return {
                "extracted_state": {},
                "missing_fields": state.get("missing_fields", ["location"]),
            }

        latest_msg = state.get("latest_message", "")
        history = state.get("history", [])
        history_formatted = "\n".join(
            f"{m.get('role', 'user').capitalize()}: {m.get('content', '')}"
            for m in history[-6:]
        )
        curr_state = state.get("current_state", {})

        prompt = EXTRACTION_PROMPT.format(
            current_state=json.dumps(curr_state, indent=2),
            latest_message=latest_msg,
            history=history_formatted or "No previous history.",
        )

        try:
            result, _ = await self.provider.generate_structured(
                schema=AssistantExtractionOutput,
                prompt=prompt,
                system_prompt=ASSISTANT_SYSTEM_PROMPT,
            )
            extracted_dict = result.extracted_state.model_dump(exclude_none=True)
            return {
                "extracted_state": extracted_dict,
                "missing_fields": result.missing_fields,
                "is_ready_for_draft": state.get("is_ready_for_draft") or result.is_ready_for_draft,
            }
        except Exception as exc:
            logger.warning(f"Structured extraction LLM call failed, falling back to heuristics: {exc}")
            # Safe non-blocking fallback
            fallback_state = {}
            if len(latest_msg.split()) >= 3 and not curr_state.get("description"):
                fallback_state["description"] = latest_msg
            return {
                "extracted_state": fallback_state,
                "missing_fields": ["location", "duration"],
                "is_ready_for_draft": False,
            }

    # ------------------------------------------------------------------
    # Node 3: Merge State & Calculate Progress
    # ------------------------------------------------------------------
    def _node_merge_state(self, state: AssistantGraphState) -> dict[str, Any]:
        """Merge newly extracted facts with existing state and compute completion %."""
        merged = dict(state.get("current_state", {}))
        extracted = state.get("extracted_state", {})

        # Merge extracted values into current state without overwriting valid data with None
        for k, v in extracted.items():
            if v is not None and v != "":
                merged[k] = v

        # Apply district hint if available and missing
        if not merged.get("district") and state.get("district_hint"):
            merged["district"] = state["district_hint"]

        # Calculate progress percentage (0 - 100)
        progress = 20  # Base progress for starting
        if merged.get("description") or state.get("latest_message"):
            progress += 20
        if merged.get("location"):
            progress += 20
        if merged.get("district"):
            progress += 15
        if merged.get("category"):
            progress += 10
        if merged.get("duration") or merged.get("impact") or merged.get("severity"):
            progress += 15

        progress = min(100, max(20, progress))

        return {
            "current_state": merged,
            "progress": progress,
        }

    # ------------------------------------------------------------------
    # Node 4: Validate Problem (Determine next step)
    # ------------------------------------------------------------------
    def _node_validate_problem(self, state: AssistantGraphState) -> dict[str, Any]:
        """Evaluate if enough information exists to draft report or if next question is needed."""
        if state.get("is_off_topic"):
            return {"validation_status": "off_topic_clarification"}

        curr = state.get("current_state", {})
        turn_count = state.get("turn_count", 0)
        max_turns = state.get("max_turns", 4)
        explicit_ready = state.get("is_ready_for_draft", False)

        has_issue = bool(curr.get("description") or curr.get("title") or state.get("latest_message"))
        has_location = bool(curr.get("location") or curr.get("district"))
        has_context = bool(curr.get("duration") or curr.get("impact") or curr.get("category"))

        # If turn count has reached max, or citizen requested, or core facts are present:
        if turn_count >= max_turns or explicit_ready or (has_issue and has_location and has_context):
            return {"validation_status": "ready_to_draft"}

        return {"validation_status": "need_more_info"}

    # ------------------------------------------------------------------
    # Node 5: Generate Question
    # ------------------------------------------------------------------
    async def _node_generate_question(self, state: AssistantGraphState) -> dict[str, Any]:
        """Formulate single targeted question for the highest-priority missing field."""
        if state.get("validation_status") == "off_topic_clarification":
            lang = state.get("detected_language", "english")
            if lang == "hindi":
                msg = "मैं केवल आपकी स्थानीय नागरिक समस्या (सड़क, पानी, कचरा, बिजली) दर्ज करने में मदद कर सकता हूँ। कृपया अपनी समस्या और स्थान बताएं।"
            elif lang == "hinglish":
                msg = "Main sirf aapki local civic problem report karne me help kar sakta hu. Please apni problem aur area batayein."
            else:
                msg = "I can only assist with reporting civic and community problems. Please tell me about the issue you are facing and where it is located."

            return {
                "next_question": msg,
                "next_field": "description",
                "suggested_answers": ["Damaged road in our area", "Drinking water problem", "Uncollected garbage"],
                "complete": False,
                "final_message": msg,
            }

        curr_state = state.get("current_state", {})
        missing = list(state.get("missing_fields", []))

        # Ensure order of priority
        priority_order = ["location", "district", "duration", "impact", "affected_people"]
        ordered_missing = [f for f in priority_order if f in missing or not curr_state.get(f)]
        if not ordered_missing:
            ordered_missing = ["impact"]

        prompt = QUESTION_GENERATION_PROMPT.format(
            current_state=json.dumps(curr_state, indent=2),
            missing_fields=", ".join(ordered_missing),
            language_hint=state.get("detected_language", "english"),
        )

        try:
            q_res, _ = await self.provider.generate_structured(
                schema=AssistantQuestionOutput,
                prompt=prompt,
                system_prompt=ASSISTANT_SYSTEM_PROMPT,
            )
            return {
                "next_question": q_res.question,
                "next_field": q_res.field,
                "suggested_answers": q_res.suggested_answers or [],
                "complete": False,
                "final_message": q_res.question,
            }
        except Exception as exc:
            logger.warning(f"Question generation LLM call failed, using heuristic: {exc}")
            target_field = ordered_missing[0]
            lang = state.get("detected_language", "english")

            if target_field == "location":
                msg = "यह समस्या किस गांव, मोहल्ले या इलाके में है?" if lang == "hindi" else "Where is this problem located? (Village, street, or landmark)"
                chips = ["Near Main Market", "Near Govt School", "Barka Village"]
            elif target_field == "duration":
                msg = "यह समस्या कितने समय से चल रही है?" if lang == "hindi" else "About how long has this issue been going on?"
                chips = ["Under 1 month", "1 to 6 months", "More than a year"]
            elif target_field == "impact":
                msg = "इससे स्थानीय लोगों को क्या मुख्य परेशानी हो रही है?" if lang == "hindi" else "What specific difficulty or hazard is this causing for residents?"
                chips = ["Vehicles cannot pass", "Accident risk", "Health hazard"]
            else:
                msg = "कृपया इस बारे में कुछ और विवरण साझा करें।" if lang == "hindi" else "Could you share any additional details about the situation?"
                chips = []

            return {
                "next_question": msg,
                "next_field": target_field,
                "suggested_answers": chips,
                "complete": False,
                "final_message": msg,
            }

    # ------------------------------------------------------------------
    # Node 6: Generate Problem Draft
    # ------------------------------------------------------------------
    async def _node_generate_draft(self, state: AssistantGraphState) -> dict[str, Any]:
        """Convert collected facts into a polished civic problem draft."""
        curr_state = state.get("current_state", {})
        history = state.get("history", [])
        history_formatted = "\n".join(
            f"{m.get('role', 'user').capitalize()}: {m.get('content', '')}"
            for m in history
        )

        prompt = DRAFT_GENERATION_PROMPT.format(
            current_state=json.dumps(curr_state, indent=2),
            history=history_formatted or "Direct statement.",
        )

        try:
            draft_res, _ = await self.provider.generate_structured(
                schema=GeneratedProblemDraft,
                prompt=prompt,
                system_prompt=ASSISTANT_SYSTEM_PROMPT,
            )
            draft_dict = draft_res.model_dump()
            return {
                "problem_draft": draft_dict,
                "progress": 100,
                "complete": True,
            }
        except Exception as exc:
            logger.error(f"Draft generation LLM call failed, assembling heuristic draft: {exc}")
            loc = curr_state.get("location") or "Local Area"
            dist = curr_state.get("district") or state.get("district_hint") or "Ranchi"
            desc_text = curr_state.get("description") or state.get("latest_message") or "Civic problem reported."
            cat = curr_state.get("category") or "Smart Infrastructure & Roads"

            heuristic_draft = {
                "title": f"Civic Issue at {loc}, {dist}"[:120],
                "description": f"The community at {loc} in {dist} reports: {desc_text}. Immediate administrative inspection and resolution requested.",
                "category": cat,
                "location": loc,
                "district": dist,
                "state": "Jharkhand",
                "duration": curr_state.get("duration"),
                "affected_people": curr_state.get("affected_people"),
                "impact": curr_state.get("impact"),
                "severity": curr_state.get("severity") or "medium",
                "tags": [cat.split()[0], "CommunityReport"],
            }
            return {
                "problem_draft": heuristic_draft,
                "progress": 100,
                "complete": True,
            }

    # ------------------------------------------------------------------
    # Node 7: Finalize Problem
    # ------------------------------------------------------------------
    def _node_finalize(self, state: AssistantGraphState) -> dict[str, Any]:
        """Wrap up final message for citizen review."""
        lang = state.get("detected_language", "english")
        if lang == "hindi":
            msg = "धन्यवाद! आपकी समस्या का विवरण तैयार कर लिया गया है। कृपया नीचे समीक्षा करें और सबमिट करें।"
        elif lang == "hinglish":
            msg = "Thanks! Aapki problem report prepare ho gayi hai. Please niche review karein aur submit karein."
        else:
            msg = "Thank you! I have gathered enough information to prepare your report. Please review the details below before submitting."

        return {
            "complete": True,
            "progress": 100,
            "final_message": msg,
        }

    # ------------------------------------------------------------------
    # Graph Assembly & Execution
    # ------------------------------------------------------------------
    def build(self) -> Any:
        """Compile the LangGraph workflow with conditional edges."""
        if not LANGGRAPH_AVAILABLE:
            return None

        workflow = StateGraph(AssistantGraphState)

        workflow.add_node("analyze_input", self._node_analyze_input)
        workflow.add_node("extract_data", self._node_extract_data)
        workflow.add_node("merge_state", self._node_merge_state)
        workflow.add_node("validate_problem", self._node_validate_problem)
        workflow.add_node("generate_question", self._node_generate_question)
        workflow.add_node("generate_draft", self._node_generate_draft)
        workflow.add_node("finalize", self._node_finalize)

        workflow.add_edge(START, "analyze_input")
        workflow.add_edge("analyze_input", "extract_data")
        workflow.add_edge("extract_data", "merge_state")
        workflow.add_edge("merge_state", "validate_problem")

        # Conditional routing after validation
        def route_after_validate(s: AssistantGraphState) -> str:
            status = s.get("validation_status", "need_more_info")
            if status == "ready_to_draft":
                return "generate_draft"
            return "generate_question"

        workflow.add_conditional_edges(
            "validate_problem",
            route_after_validate,
            {
                "generate_draft": "generate_draft",
                "generate_question": "generate_question",
            },
        )

        workflow.add_edge("generate_draft", "finalize")
        workflow.add_edge("generate_question", END)
        workflow.add_edge("finalize", END)

        return workflow.compile()

    async def execute_turn(self, state: AssistantGraphState) -> AssistantGraphState:
        """Execute turn through compiled graph with guaranteed fallback."""
        compiled = self.build()
        if compiled is not None:
            try:
                res = await compiled.ainvoke(state)
                return res
            except Exception as exc:
                logger.warning(f"LangGraph execution exception, executing programmatic chain: {exc}")

        # Programmatic chain fallback if LangGraph is not compiled or encounters execution error
        step1 = self._node_analyze_input(state)
        state.update(step1)

        step2 = await self._node_extract_data(state)
        state.update(step2)

        step3 = self._node_merge_state(state)
        state.update(step3)

        step4 = self._node_validate_problem(state)
        state.update(step4)

        if state.get("validation_status") == "ready_to_draft":
            step_draft = await self._node_generate_draft(state)
            state.update(step_draft)
            step_final = self._node_finalize(state)
            state.update(step_final)
        else:
            step_q = await self._node_generate_question(state)
            state.update(step_q)

        return state

