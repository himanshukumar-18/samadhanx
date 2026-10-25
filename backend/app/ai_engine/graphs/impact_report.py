"""LangGraph orchestration pipeline for Admin AI Impact Report Generator.

Evaluates platform database statistics, routes dynamically based on data sufficiency,
invokes structured LLM generation with strict anti-hallucination constraints,
and provides deterministic fallback in case of provider failure.
"""

import logging
from typing import Any, TypedDict

try:
    from langgraph.graph import END, START, StateGraph
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    END = "__end__"
    START = "__start__"
    StateGraph = None

from app.ai_engine.prompts.impact_report import (
    ADMIN_IMPACT_REPORT_EVALUATION_PROMPT,
    ADMIN_IMPACT_REPORT_SYSTEM_PROMPT,
)
from app.ai_engine.providers.base import ModelProvider
from app.ai_engine.providers.factory import get_model_provider
from app.ai_engine.schemas.impact_report import (
    AdminImpactReportOutput,
    AdminImpactStatistics,
)

logger = logging.getLogger("samadhanx.ai.admin_impact_graph")


class ImpactReportGraphState(TypedDict, total=False):
    # Inputs
    statistics: dict[str, Any]

    # Intermediate state
    is_data_limited: bool
    formatted_prompt: str

    # Result
    report_output: dict[str, Any] | None
    error: str | None


class AdminImpactReportGraphBuilder:
    """Builds and runs the Admin AI Impact Report LangGraph workflow."""

    def __init__(self, provider: ModelProvider | None = None):
        self.provider = provider or get_model_provider()

    # ------------------------------------------------------------------
    # Node 1: Validate Statistics & Check Data Sufficiency
    # ------------------------------------------------------------------
    def _node_validate_statistics(self, state: ImpactReportGraphState) -> dict[str, Any]:
        """Validate input statistics and determine if sufficient data exists."""
        stats = state.get("statistics", {})
        users = stats.get("users", {})
        problems = stats.get("problems", {})
        projects = stats.get("projects", {})

        total_users = users.get("total", 0)
        total_problems = problems.get("total", 0)
        total_projects = projects.get("total", 0)

        # Baseline / Data limitation check
        if total_users == 0 and total_problems == 0 and total_projects == 0:
            limited_report = AdminImpactReportOutput(
                headline="SamadhanX Platform: Baseline Inception Phase",
                executive_summary=(
                    "Currently, not enough platform activity is recorded in the database to generate "
                    "a full natural-language impact evaluation. The platform infrastructure is operational "
                    "and awaiting citizen problem submissions and student pod registrations."
                ),
                key_achievements=[
                    "Core governance infrastructure and database verified operational.",
                    "Administrative and institutional control planes initialized.",
                ],
                problem_impact="No citizen problems recorded for the selected evaluation scope.",
                community_engagement="Grassroots citizen outreach is required to drive initial civic problem reports.",
                student_impact="Student solution pods are ready for onboarding upon civic problem intake.",
                collaboration_impact="Institutional university and industry partnerships are in preparatory stage.",
                key_insights=[
                    "Early-stage baseline indicates strong platform readiness.",
                    "Initial adoption campaigns are required to populate the civic problem pipeline.",
                ],
                areas_needing_attention=[
                    "Citizen awareness and problem submission drives.",
                    "University campus outreach and student developer onboarding.",
                ],
                recommended_next_steps=[
                    "Conduct local awareness drives in key municipal wards to invite first citizen problem reports.",
                    "Engage partner universities to form initial student solution pods.",
                ],
                is_data_limited=True,
            )
            return {
                "is_data_limited": True,
                "report_output": limited_report.model_dump(),
            }

        # Format Categories Text
        categories = stats.get("top_categories") or []
        if categories:
            cat_lines = [f"- {c.get('category', 'Category')}: {c.get('count', 0)} problem(s)" for c in categories]
            top_categories_text = "\n".join(cat_lines)
        else:
            top_categories_text = "No category breakdown available."

        # Format Locations Text
        locations = stats.get("top_locations") or []
        if locations:
            loc_lines = [f"- {loc.get('location', 'Location')}: {loc.get('count', 0)} problem(s)" for loc in locations]
            top_locations_text = "\n".join(loc_lines)
        else:
            top_locations_text = "No geographic breakdown available."

        # Format Recent Activity Text
        activities = stats.get("recent_activity") or []
        if activities:
            act_lines = [
                f"- [{a.get('timestamp', 'Recent')}] {a.get('action', 'Action')} on {a.get('target_type', 'Entity')}"
                for a in activities[:8]
            ]
            recent_activity_text = "\n".join(act_lines)
        else:
            recent_activity_text = "No recent activity log recorded."

        participation = stats.get("participation", {})

        formatted_prompt = ADMIN_IMPACT_REPORT_EVALUATION_PROMPT.format(
            period=stats.get("period", "30d"),
            district=stats.get("district") or "All Districts",
            generated_at=stats.get("generated_at", ""),
            total_users=total_users,
            active_users=users.get("active_users", 0),
            verified_users=users.get("verified_users", 0),
            citizens=users.get("citizens", 0),
            students=users.get("students", 0),
            faculty=users.get("faculty", 0),
            universities=users.get("universities", 0),
            industry=users.get("industry", 0),
            admins=users.get("admins", 0),
            total_problems=total_problems,
            approved_problems=problems.get("approved", 0),
            pending_problems=problems.get("pending", 0),
            in_progress_problems=problems.get("in_progress", 0),
            resolved_problems=problems.get("resolved", 0),
            rejected_problems=problems.get("rejected", 0),
            problem_status_breakdown=str(problems.get("status_breakdown", {})),
            total_projects=total_projects,
            active_projects=projects.get("active", 0),
            completed_projects=projects.get("completed", 0),
            project_status_breakdown=str(projects.get("status_breakdown", {})),
            students_engaged=participation.get("students_engaged", 0),
            solutions_submitted=participation.get("solutions_submitted", 0),
            updates_posted=participation.get("updates_posted", 0),
            top_categories_text=top_categories_text,
            top_locations_text=top_locations_text,
            recent_activity_text=recent_activity_text,
        )

        return {
            "is_data_limited": False,
            "formatted_prompt": formatted_prompt,
        }

    # ------------------------------------------------------------------
    # Node 2: Generate Report via LLM
    # ------------------------------------------------------------------
    async def _node_generate_report(self, state: ImpactReportGraphState) -> dict[str, Any]:
        """Invoke structured model provider to generate the impact report."""
        if state.get("is_data_limited"):
            return {}

        prompt = state.get("formatted_prompt", "")
        try:
            output, _ = await self.provider.generate_structured(
                prompt=prompt,
                schema=AdminImpactReportOutput,
                system_prompt=ADMIN_IMPACT_REPORT_SYSTEM_PROMPT,
            )
            return {"report_output": output.model_dump()}
        except Exception as exc:
            logger.warning("LLM impact report generation failed; applying deterministic fallback: %s", exc)
            fallback = self._create_fallback_report(state.get("statistics", {}))
            return {"report_output": fallback.model_dump(), "error": str(exc)}

    # ------------------------------------------------------------------
    # Node 3: Finalize Report
    # ------------------------------------------------------------------
    def _node_finalize(self, state: ImpactReportGraphState) -> dict[str, Any]:
        """Ensure report structure is valid and consistent."""
        out_dict = state.get("report_output")
        if not out_dict:
            fallback = self._create_fallback_report(state.get("statistics", {}))
            return {"report_output": fallback.model_dump()}

        return {"report_output": out_dict}

    # ------------------------------------------------------------------
    # Fallback Generation Helper
    # ------------------------------------------------------------------
    def _create_fallback_report(self, stats: dict[str, Any]) -> AdminImpactReportOutput:
        """Deterministic heuristic fallback when LLM is temporarily unreachable."""
        users = stats.get("users", {})
        problems = stats.get("problems", {})
        projects = stats.get("projects", {})
        participation = stats.get("participation", {})

        total_users = users.get("total", 0)
        total_problems = problems.get("total", 0)
        approved_problems = problems.get("approved", 0)
        resolved_problems = problems.get("resolved", 0)
        total_projects = projects.get("total", 0)
        active_projects = projects.get("active", 0)
        completed_projects = projects.get("completed", 0)
        students_engaged = participation.get("students_engaged", 0)

        headline = f"SamadhanX Impact Report: {total_problems} Problems Tracked, {resolved_problems} Resolved"
        summary = (
            f"SamadhanX has mobilized a community of {total_users} registered stakeholders across citizens, "
            f"students, and faculty mentors. A total of {total_problems} civic challenges have been reported, "
            f"with {approved_problems} approved for technical intervention and {resolved_problems} successfully resolved. "
            f"{total_projects} student solution pods are actively engaged, involving {students_engaged} student innovators."
        )

        achievements = [
            f"{total_problems} citizen problems cataloged across target regions.",
            f"{approved_problems} challenges approved through official moderation.",
            f"{total_projects} student engineering pods developed ({active_projects} active, {completed_projects} completed).",
            f"{resolved_problems} real-world civic problems brought to resolution.",
        ]

        problem_impact = (
            f"The platform maintains an intake of {total_problems} problems with {approved_problems} verified issues. "
            f"{resolved_problems} issues have reached full resolution."
        )

        community_engagement = (
            f"Community participation is supported by {users.get('citizens', 0)} citizen reporters contributing "
            f"ground-level insights and upvoting local challenges."
        )

        student_impact = (
            f"{students_engaged} student engineers across {total_projects} pods have developed working technical solutions, "
            f"accumulating hands-on public interest technology experience."
        )

        collaboration_impact = (
            f"Interdisciplinary mentorship brings together {users.get('faculty', 0)} faculty mentors and "
            f"{users.get('universities', 0)} academic institutions working alongside {users.get('industry', 0)} industry partners."
        )

        insights = [
            f"Problem-to-solution pipeline efficiency is currently at {round((resolved_problems / max(1, total_problems)) * 100, 1)}% resolution rate.",
            f"Student pod engagement is strong with an average of {round(students_engaged / max(1, total_projects), 1)} students per solution pod.",
        ]

        attention = [
            f"{problems.get('pending', 0)} pending problems require moderation attention.",
            f"{projects.get('planning', 0)} pods are currently in early planning stage and need mentor guidance.",
        ]

        steps = [
            "Accelerate moderation queue processing to transition pending problems into active student hack cycles.",
            "Host structured faculty review check-ins for active pods to ensure field deployment milestones are met.",
        ]

        return AdminImpactReportOutput(
            headline=headline,
            executive_summary=summary,
            key_achievements=achievements,
            problem_impact=problem_impact,
            community_engagement=community_engagement,
            student_impact=student_impact,
            collaboration_impact=collaboration_impact,
            key_insights=insights,
            areas_needing_attention=attention,
            recommended_next_steps=steps,
            is_data_limited=False,
        )

    # ------------------------------------------------------------------
    # Graph Compilation & Execution
    # ------------------------------------------------------------------
    def build_graph(self):
        """Construct LangGraph workflow if available."""
        if not LANGGRAPH_AVAILABLE or StateGraph is None:
            return None

        workflow = StateGraph(ImpactReportGraphState)
        workflow.add_node("validate_statistics", self._node_validate_statistics)
        workflow.add_node("generate_report", self._node_generate_report)
        workflow.add_node("finalize", self._node_finalize)

        def route_after_validate(state: ImpactReportGraphState) -> str:
            if state.get("is_data_limited"):
                return "finalize"
            return "generate_report"

        workflow.add_edge(START, "validate_statistics")
        workflow.add_conditional_edges(
            "validate_statistics",
            route_after_validate,
            {
                "finalize": "finalize",
                "generate_report": "generate_report",
            },
        )
        workflow.add_edge("generate_report", "finalize")
        workflow.add_edge("finalize", END)

        return workflow.compile()

    async def run(self, statistics: AdminImpactStatistics) -> AdminImpactReportOutput:
        """Execute the impact report pipeline."""
        initial_state: ImpactReportGraphState = {
            "statistics": statistics.model_dump(),
        }

        compiled_graph = self.build_graph()

        if compiled_graph is not None:
            result_state = await compiled_graph.ainvoke(initial_state)
        else:
            s1 = self._node_validate_statistics(initial_state)
            current_state = {**initial_state, **s1}
            if not current_state.get("is_data_limited"):
                s2 = await self._node_generate_report(current_state)
                current_state.update(s2)
            s3 = self._node_finalize(current_state)
            result_state = {**current_state, **s3}

        out = result_state.get("report_output") or {}
        return AdminImpactReportOutput.model_validate(out)
