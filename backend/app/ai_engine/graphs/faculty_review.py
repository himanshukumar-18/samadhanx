"""LangGraph orchestration pipeline for Faculty AI Review Assistant.

Evaluates student solution pods against civic problems, extracting completed milestones,
detecting technical/validation gaps, assessing progress, and drafting actionable guidance.
"""

import logging
from typing import Any, Literal, TypedDict

try:
    from langgraph.graph import END, START, StateGraph
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    END = "__end__"
    START = "__start__"
    StateGraph = None

from app.ai_engine.prompts.faculty_review import (
    FACULTY_REVIEW_EVALUATION_PROMPT,
    FACULTY_REVIEW_SYSTEM_PROMPT,
)
from app.ai_engine.providers.base import ModelProvider
from app.ai_engine.providers.factory import get_model_provider
from app.ai_engine.schemas.faculty_review import (
    FacultyAIReviewInput,
    FacultyAIReviewOutput,
)

logger = logging.getLogger("samadhanx.ai.faculty_review_graph")

INSUFFICIENT_DATA_SUMMARY = "Not enough project data is available for a reliable AI review."


class FacultyReviewGraphState(TypedDict, total=False):
    # Inputs
    project_input: dict[str, Any]

    # Intermediate flags
    is_insufficient: bool
    formatted_prompt: str

    # Result
    review_output: dict[str, Any] | None
    error: str | None


class FacultyReviewGraphBuilder:
    """Builds and runs the Faculty AI Review LangGraph workflow."""

    def __init__(self, provider: ModelProvider | None = None):
        self.provider = provider or get_model_provider()

    # ------------------------------------------------------------------
    # Node 1: Prepare & Check Data Sufficiency
    # ------------------------------------------------------------------
    def _node_prepare_data(self, state: FacultyReviewGraphState) -> dict[str, Any]:
        """Inspect project data to detect if sufficient evidence exists for review."""
        p_input = state.get("project_input", {})
        description = (p_input.get("project_description") or "").strip()
        updates = p_input.get("updates") or []
        title = (p_input.get("project_title") or "").strip()

        # Insufficient data check: minimal description (<25 chars) and zero updates
        if (len(description) < 25 and len(updates) == 0) or (len(title) < 3 and len(description) < 10):
            insufficient_output = FacultyAIReviewOutput(
                summary=INSUFFICIENT_DATA_SUMMARY,
                progress_percentage=0,
                completed_work=[],
                pending_work=[
                    "Submit comprehensive solution architecture and project scope.",
                    "Post the first engineering log or prototype milestone update.",
                ],
                strengths=[],
                risks=[
                    "Insufficient project documentation and zero submitted updates prevent evaluation.",
                ],
                suggested_feedback=[
                    "Please provide a detailed technical methodology and post regular engineering logs so your faculty mentor can review progress.",
                ],
                next_steps=[
                    "Update project description with proposed technical architecture.",
                    "Submit milestone update detailing initial design or code repository.",
                ],
                overall_assessment="insufficient_data",
            )
            return {
                "is_insufficient": True,
                "review_output": insufficient_output.model_dump(),
            }

        # Format updates text
        if updates:
            update_lines = []
            for u in updates:
                proto_part = f" (Prototype: {u.get('prototype_url')})" if u.get("prototype_url") else ""
                update_lines.append(
                    f"- [{u.get('created_at', 'Recent')}] {u.get('title', 'Update')}: {u.get('content', '')}{proto_part}"
                )
            updates_text = "\n".join(update_lines)
        else:
            updates_text = "No milestone updates submitted yet."

        # Format previous reviews text
        reviews = p_input.get("previous_reviews") or []
        if reviews:
            reviews_text = "\n".join(
                f"- [{r.get('created_at', 'Past')}] Reviewer: {r.get('reviewer_name', 'Faculty')}, "
                f"Decision: {r.get('decision')}, Feedback: {r.get('feedback_text')}"
                for r in reviews
            )
        else:
            reviews_text = "No previous reviews recorded."

        formatted_prompt = FACULTY_REVIEW_EVALUATION_PROMPT.format(
            problem_title=p_input.get("problem_title", "Civic Problem"),
            problem_category=p_input.get("problem_category", "General"),
            problem_location=p_input.get("problem_location") or "Local Area",
            problem_district=p_input.get("problem_district") or "District",
            problem_description=p_input.get("problem_description", ""),
            project_id=p_input.get("project_id", ""),
            project_title=title,
            team_name=p_input.get("team_name", "Team"),
            lead_student_name=p_input.get("lead_student_name") or "Student Lead",
            member_count=p_input.get("member_count", 1),
            project_status=p_input.get("project_status", "in_progress"),
            repository_url=p_input.get("repository_url") or "None provided",
            project_description=description,
            update_count=len(updates),
            updates_text=updates_text,
            review_count=len(reviews),
            reviews_text=reviews_text,
        )

        return {
            "is_insufficient": False,
            "formatted_prompt": formatted_prompt,
        }

    # ------------------------------------------------------------------
    # Node 2: Generate Structured Review
    # ------------------------------------------------------------------
    async def _node_generate_review(self, state: FacultyReviewGraphState) -> dict[str, Any]:
        """Invoke AI provider to generate structured FacultyAIReviewOutput."""
        if state.get("is_insufficient"):
            return {}

        prompt = state.get("formatted_prompt", "")
        try:
            output, _ = await self.provider.generate_structured(
                prompt=prompt,
                schema=FacultyAIReviewOutput,
                system_prompt=FACULTY_REVIEW_SYSTEM_PROMPT,
            )
            return {"review_output": output.model_dump()}
        except Exception as exc:
            logger.warning("LLM review generation failed; triggering deterministic fallback: %s", exc)
            fallback = self._create_fallback_review(state.get("project_input", {}))
            return {"review_output": fallback.model_dump(), "error": str(exc)}

    # ------------------------------------------------------------------
    # Node 3: Finalize & Post-Process
    # ------------------------------------------------------------------
    def _node_finalize(self, state: FacultyReviewGraphState) -> dict[str, Any]:
        """Ensure all fields are valid, clamped, and strictly compliant."""
        out_dict = state.get("review_output")
        if not out_dict:
            fallback = self._create_fallback_review(state.get("project_input", {}))
            return {"review_output": fallback.model_dump()}

        # Clamp progress between 0 and 100
        prog = out_dict.get("progress_percentage", 50)
        out_dict["progress_percentage"] = max(0, min(100, int(prog)))

        # Validate assessment literal
        valid_assessments = {"on_track", "needs_attention", "behind", "insufficient_data"}
        if out_dict.get("overall_assessment") not in valid_assessments:
            out_dict["overall_assessment"] = "needs_attention"

        return {"review_output": out_dict}

    # ------------------------------------------------------------------
    # Fallback Generation Helper
    # ------------------------------------------------------------------
    def _create_fallback_review(self, p_input: dict[str, Any]) -> FacultyAIReviewOutput:
        """Deterministic heuristic fallback when LLM service is temporarily unreachable."""
        updates = p_input.get("updates") or []
        status = p_input.get("project_status", "in_progress")
        title = p_input.get("project_title", "Project")
        prob_title = p_input.get("problem_title", "civic challenge")

        update_count = len(updates)
        has_repo = bool(p_input.get("repository_url"))

        if update_count == 0:
            pct = 15
            assessment: Literal["on_track", "needs_attention", "behind", "insufficient_data"] = "needs_attention"
            completed = ["Initial project proposal registered."]
            pending = ["Prototype architecture implementation", "Engineering log updates"]
            risks = ["No recorded milestone updates submitted by team."]
        elif update_count < 3:
            pct = 35 + update_count * 10
            assessment = "on_track" if status != "rejected" else "behind"
            completed = [u.get("title", f"Milestone update #{i+1}") for i, u in enumerate(updates[:3])]
            pending = ["Field validation and user testing", "Complete deployment documentation"]
            risks = ["Testing evidence is limited in current logs."]
        else:
            pct = min(85, 40 + update_count * 8)
            assessment = "on_track"
            completed = [u.get("title", f"Milestone update #{i+1}") for i, u in enumerate(updates[:4])]
            pending = ["Deployment checklist validation", "Stakeholder handover"]
            risks = ["Ensure cross-browser and field resilience before rollout."]

        feedback = [
            f"Review the problem requirements for '{prob_title}' and ensure all edge cases are tested.",
            "Document test procedures with reproducible data and include links to demonstration code or prototypes.",
        ]
        next_steps = [
            "Conduct structured testing with target community users.",
            "Prepare detailed demonstration of current prototype for next review.",
        ]

        summary = (
            f"The team for '{title}' is currently at status '{status}' with {update_count} milestone update(s). "
            f"Repository {'is linked' if has_repo else 'not yet linked'}. "
            f"Further field validation is required to verify civic impact."
        )

        return FacultyAIReviewOutput(
            summary=summary,
            progress_percentage=pct,
            completed_work=completed,
            pending_work=pending,
            strengths=["Active student pod registration and problem alignment."],
            risks=risks,
            suggested_feedback=feedback,
            next_steps=next_steps,
            overall_assessment=assessment,
        )

    # ------------------------------------------------------------------
    # Graph Compilation & Execution
    # ------------------------------------------------------------------
    def build_graph(self):
        """Construct LangGraph workflow if available."""
        if not LANGGRAPH_AVAILABLE or StateGraph is None:
            return None

        workflow = StateGraph(FacultyReviewGraphState)
        workflow.add_node("prepare_data", self._node_prepare_data)
        workflow.add_node("generate_review", self._node_generate_review)
        workflow.add_node("finalize", self._node_finalize)

        def route_after_prepare(state: FacultyReviewGraphState) -> str:
            if state.get("is_insufficient"):
                return "finalize"
            return "generate_review"

        workflow.add_edge(START, "prepare_data")
        workflow.add_conditional_edges(
            "prepare_data",
            route_after_prepare,
            {
                "finalize": "finalize",
                "generate_review": "generate_review",
            },
        )
        workflow.add_edge("generate_review", "finalize")
        workflow.add_edge("finalize", END)

        return workflow.compile()

    async def run(self, project_input: FacultyAIReviewInput) -> FacultyAIReviewOutput:
        """Execute the review pipeline."""
        initial_state: FacultyReviewGraphState = {
            "project_input": project_input.model_dump(),
        }

        compiled_graph = self.build_graph()

        if compiled_graph is not None:
            result_state = await compiled_graph.ainvoke(initial_state)
        else:
            # Linear fallback if LangGraph is not installed
            s1 = self._node_prepare_data(initial_state)
            current_state = {**initial_state, **s1}
            if not current_state.get("is_insufficient"):
                s2 = await self._node_generate_review(current_state)
                current_state.update(s2)
            s3 = self._node_finalize(current_state)
            result_state = {**current_state, **s3}

        out = result_state.get("review_output") or {}
        return FacultyAIReviewOutput.model_validate(out)
