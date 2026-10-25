"""LangGraph orchestration pipeline for Problem AI Moderation Assistant.

Sequential 11-node pipeline:
1. input_validation: Check required fields, length boundaries
2. input_sanitization: Clean HTML, control chars, whitespace
3. pii_and_injection_guard: Scan/redact PII and detect prompt injection attempts
4. heuristic_spam_scan: Deterministic keyword and link heuristics
5. model_inference: Structured LLM call through configured provider
6. spam_synthesis: Combine heuristic and LLM spam signals
7. risk_analysis: Consolidate policy and safety flags
8. confidence_evaluation: Evaluate confidence against threshold
9. output_validation: Validate canonical taxonomy and constrain field lengths
10. route_decision: Assign human moderation routing
11. finalize_output: Compile final structured output and telemetry
"""

from typing import Any, TypedDict

try:
    from langgraph.graph import END, START, StateGraph
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    END = "__end__"
    START = "__start__"
    StateGraph = None

from app.ai_engine.chains.moderation import ModerationChain
from app.ai_engine.config.settings import get_ai_settings
from app.ai_engine.providers.base import ModelProvider
from app.ai_engine.schemas.common import ProblemAnalysisInput, RiskFlag, RiskSeverity
from app.ai_engine.schemas.moderation import ProblemModerationOutput
from app.ai_engine.security.output_validator import OutputValidator
from app.ai_engine.security.pii_redactor import PIIRedactor
from app.ai_engine.security.prompt_guard import PromptGuard
from app.ai_engine.security.sanitizer import InputSanitizer
from app.ai_engine.services.spam_service import SpamService
from app.models.enums import AIModerationRecommendation


class ModerationGraphState(TypedDict, total=False):
    """State dictionary flowing through all nodes of the moderation graph."""

    # Inputs
    input_data: ProblemAnalysisInput

    # Sanitization & Security
    sanitized_title: str
    sanitized_description: str
    wrapped_data: str
    pii_flags: list[RiskFlag]
    injection_flags: list[RiskFlag]
    heuristic_flags: list[RiskFlag]
    heuristic_spam_score: float
    heuristic_spam_reasons: list[str]

    # Model Inference
    raw_model_output: ProblemModerationOutput | None
    telemetry: dict[str, Any]

    # Post-processing & Synthesis
    combined_risk_flags: list[RiskFlag]
    combined_spam_score: float
    combined_spam_reasons: list[str]

    # Validation & Final Output
    final_output: ProblemModerationOutput | None
    route: str
    error: str | None


class ModerationGraphBuilder:
    """Builds and compiles the 11-node LangGraph state machine for problem moderation."""

    def __init__(self, provider: ModelProvider):
        self.provider = provider
        self.settings = get_ai_settings()
        self.sanitizer = InputSanitizer()
        self.chain = ModerationChain(provider)
        self.output_validator = OutputValidator()
        self.spam_service = SpamService()

    # Node 1: Input Validation
    def _node_input_validation(self, state: ModerationGraphState) -> dict[str, Any]:
        inp = state.get("input_data")
        if not inp or not inp.title or not inp.description:
            raise ValueError("Input title and description are required for moderation analysis")
        return {}

    # Node 2: Input Sanitization
    def _node_input_sanitization(self, state: ModerationGraphState) -> dict[str, Any]:
        inp = state["input_data"]
        sanitized_title = self.sanitizer.sanitize(inp.title, max_length_override=200)
        sanitized_desc = self.sanitizer.sanitize(inp.description)
        return {
            "sanitized_title": sanitized_title,
            "sanitized_description": sanitized_desc,
        }

    # Node 3: PII & Injection Guard
    def _node_pii_and_injection_guard(self, state: ModerationGraphState) -> dict[str, Any]:
        inp = state["input_data"]
        sanitized_desc = state["sanitized_description"]
        sanitized_title = state["sanitized_title"]

        # PII Redaction
        redacted_desc, pii_flags = PIIRedactor.redact(sanitized_desc)

        # Prompt Injection Defense
        injection_flags = PromptGuard.inspect_for_injection(f"{inp.title} {inp.description}")

        # Wrap within untrusted boundaries
        loc_str = f"{inp.district or ''}, {inp.state or ''}".strip(", ")
        wrapped_data = PromptGuard.wrap_untrusted_data(
            title=sanitized_title,
            description=redacted_desc,
            category=inp.original_category,
            location=loc_str,
        )

        return {
            "sanitized_description": redacted_desc,
            "wrapped_data": wrapped_data,
            "pii_flags": pii_flags,
            "injection_flags": injection_flags,
        }

    # Node 4: Heuristic Spam Scan
    def _node_heuristic_spam_scan(self, state: ModerationGraphState) -> dict[str, Any]:
        h_score, h_reasons, h_flags = self.spam_service.evaluate_heuristics(
            title=state["sanitized_title"],
            description=state["sanitized_description"],
        )
        return {
            "heuristic_spam_score": h_score,
            "heuristic_spam_reasons": h_reasons,
            "heuristic_flags": h_flags,
        }

    # Node 5: Model Inference
    async def _node_model_inference(self, state: ModerationGraphState) -> dict[str, Any]:
        wrapped_data = state["wrapped_data"]
        raw_output, telemetry = await self.chain.ainvoke(wrapped_data)
        return {
            "raw_model_output": raw_output,
            "telemetry": telemetry,
        }

    # Node 6: Spam Synthesis
    def _node_spam_synthesis(self, state: ModerationGraphState) -> dict[str, Any]:
        raw_output = state.get("raw_model_output")
        model_spam_score = float(raw_output.spam_probability) if raw_output else 0.0
        model_spam_reasons = list(raw_output.spam_reasons or []) if raw_output else []

        h_score = state.get("heuristic_spam_score", 0.0)
        h_reasons = state.get("heuristic_spam_reasons", [])

        combined_score, combined_reasons = self.spam_service.combine_scores(
            heuristic_score=h_score,
            model_score=model_spam_score,
            heuristic_reasons=h_reasons,
            model_reasons=model_spam_reasons,
        )

        return {
            "combined_spam_score": combined_score,
            "combined_spam_reasons": combined_reasons,
        }

    # Node 7: Risk Analysis
    def _node_risk_analysis(self, state: ModerationGraphState) -> dict[str, Any]:
        raw_output = state.get("raw_model_output")
        model_flags = list(raw_output.risk_flags or []) if raw_output else []

        pii_flags = state.get("pii_flags", [])
        injection_flags = state.get("injection_flags", [])
        heuristic_flags = state.get("heuristic_flags", [])

        all_flags = model_flags + pii_flags + injection_flags + heuristic_flags
        return {"combined_risk_flags": all_flags}

    # Node 8: Confidence Evaluation
    def _node_confidence_evaluation(self, state: ModerationGraphState) -> dict[str, Any]:
        raw_output = state.get("raw_model_output")
        confidence = float(raw_output.confidence) if raw_output else 0.8
        # If severe prompt injection detected, downgrade confidence
        if any(f.severity == RiskSeverity.CRITICAL for f in state.get("combined_risk_flags", [])):
            confidence = min(confidence, 0.3)
        return {}

    # Node 9: Output Validation & Thresholds
    def _node_output_validation(self, state: ModerationGraphState) -> dict[str, Any]:
        raw_output = state.get("raw_model_output")
        if not raw_output:
            raise ValueError("No model output generated during graph execution")

        all_flags = state.get("combined_risk_flags", [])

        # Construct updated output with synthesized spam
        s_output = raw_output.model_copy(
            update={
                "spam_probability": state.get("combined_spam_score", raw_output.spam_probability),
                "spam_reasons": state.get("combined_spam_reasons", raw_output.spam_reasons),
            }
        )

        validated_output = self.output_validator.validate_and_refine(
            output=s_output,
            injected_flags=all_flags,
        )

        return {"final_output": validated_output}

    # Node 10: Route Decision
    def _node_route_decision(self, state: ModerationGraphState) -> dict[str, Any]:
        final_output = state.get("final_output")
        rec = final_output.recommendation if final_output else AIModerationRecommendation.NORMAL_REVIEW

        if rec == AIModerationRecommendation.HIGH_RISK_ESCALATION:
            route = "escalation"
        elif rec == AIModerationRecommendation.SPAM_REVIEW:
            route = "spam"
        elif rec == AIModerationRecommendation.HUMAN_REVIEW_REQUIRED:
            route = "human_review"
        else:
            route = "normal"

        return {"route": route}

    # Node 11: Finalize Output
    def _node_finalize_output(self, state: ModerationGraphState) -> dict[str, Any]:
        return {
            "final_output": state.get("final_output"),
            "telemetry": state.get("telemetry", {}),
            "route": state.get("route", "normal"),
        }

    def build(self):
        """Construct and compile the sequential LangGraph moderation workflow."""
        if not LANGGRAPH_AVAILABLE or StateGraph is None:
            return None

        workflow = StateGraph(ModerationGraphState)

        workflow.add_node("input_validation", self._node_input_validation)
        workflow.add_node("input_sanitization", self._node_input_sanitization)
        workflow.add_node("pii_and_injection_guard", self._node_pii_and_injection_guard)
        workflow.add_node("heuristic_spam_scan", self._node_heuristic_spam_scan)
        workflow.add_node("model_inference", self._node_model_inference)
        workflow.add_node("spam_synthesis", self._node_spam_synthesis)
        workflow.add_node("risk_analysis", self._node_risk_analysis)
        workflow.add_node("confidence_evaluation", self._node_confidence_evaluation)
        workflow.add_node("output_validation", self._node_output_validation)
        workflow.add_node("route_decision", self._node_route_decision)
        workflow.add_node("finalize_output", self._node_finalize_output)

        workflow.add_edge(START, "input_validation")
        workflow.add_edge("input_validation", "input_sanitization")
        workflow.add_edge("input_sanitization", "pii_and_injection_guard")
        workflow.add_edge("pii_and_injection_guard", "heuristic_spam_scan")
        workflow.add_edge("heuristic_spam_scan", "model_inference")
        workflow.add_edge("model_inference", "spam_synthesis")
        workflow.add_edge("spam_synthesis", "risk_analysis")
        workflow.add_edge("risk_analysis", "confidence_evaluation")
        workflow.add_edge("confidence_evaluation", "output_validation")
        workflow.add_edge("output_validation", "route_decision")
        workflow.add_edge("route_decision", "finalize_output")
        workflow.add_edge("finalize_output", END)

        return workflow.compile()
