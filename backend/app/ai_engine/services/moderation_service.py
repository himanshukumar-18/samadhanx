"""Service executing the AI Moderation graph pipeline and telemetry."""

from typing import Any
from app.ai_engine.exceptions import AIError, AIModerationError
from app.ai_engine.graphs.moderation_graph import ModerationGraphBuilder, ModerationGraphState
from app.ai_engine.observability.logging import log_ai_event
from app.ai_engine.observability.metrics import ai_metrics
from app.ai_engine.providers.base import ModelProvider
from app.ai_engine.providers.factory import get_model_provider
from app.ai_engine.schemas.common import ProblemAnalysisInput
from app.ai_engine.schemas.moderation import ProblemModerationOutput


class AIModerationService:
    """Coordinates execution of the moderation workflow graph."""

    def __init__(self, provider: ModelProvider | None = None):
        self.provider = provider or get_model_provider()
        self.graph_builder = ModerationGraphBuilder(self.provider)
        try:
            self.compiled_graph = self.graph_builder.build()
        except Exception:
            self.compiled_graph = None

    async def _run_sequential(
        self, input_data: ProblemAnalysisInput
    ) -> tuple[ProblemModerationOutput, dict[str, Any], str]:
        """Direct sequential pipeline execution if graph compilation is unavailable."""
        state: ModerationGraphState = {"input_data": input_data}
        self.graph_builder._node_input_validation(state)
        state.update(self.graph_builder._node_input_sanitization(state))
        state.update(self.graph_builder._node_pii_and_injection_guard(state))
        state.update(self.graph_builder._node_heuristic_spam_scan(state))
        inference_res = await self.graph_builder._node_model_inference(state)
        state.update(inference_res)
        state.update(self.graph_builder._node_spam_synthesis(state))
        state.update(self.graph_builder._node_risk_analysis(state))
        state.update(self.graph_builder._node_confidence_evaluation(state))
        state.update(self.graph_builder._node_output_validation(state))
        state.update(self.graph_builder._node_route_decision(state))
        final_state = self.graph_builder._node_finalize_output(state)
        return final_state["final_output"], final_state.get("telemetry", {}), state.get("wrapped_data", "")

    async def run_moderation(
        self,
        input_data: ProblemAnalysisInput,
    ) -> tuple[ProblemModerationOutput, dict[str, Any], str]:
        """Execute the moderation pipeline (via LangGraph or direct sequential fallback).
        
        Returns:
            Tuple of (final_output, telemetry_dict, sanitized_input_text)
        """
        problem_id_str = str(input_data.problem_id)
        log_ai_event(
            event_type="MODERATION_START",
            problem_id=problem_id_str,
            provider=self.provider.provider_name,
            model=self.provider.model_name,
        )

        initial_state: ModerationGraphState = {
            "input_data": input_data,
        }

        try:
            if self.compiled_graph is not None:
                result_state = await self.compiled_graph.ainvoke(initial_state)
                final_output = result_state.get("final_output")
                telemetry = result_state.get("telemetry", {})
                sanitized_input = result_state.get("wrapped_data", "")
            else:
                final_output, telemetry, sanitized_input = await self._run_sequential(input_data)

            if not final_output:
                raise AIModerationError("Moderation graph completed without generating final output")

            duration_ms = telemetry.get("duration_ms", 0)
            ai_metrics.record_success(
                duration_ms=duration_ms,
                recommendation=final_output.recommendation.value,
                spam_prob=final_output.spam_probability,
            )

            log_ai_event(
                event_type="MODERATION_SUCCESS",
                problem_id=problem_id_str,
                status="completed",
                provider=self.provider.provider_name,
                model=self.provider.model_name,
                duration_ms=duration_ms,
                recommendation=final_output.recommendation.value,
            )

            return final_output, telemetry, sanitized_input

        except AIError as e:
            ai_metrics.record_failure(e.code)
            log_ai_event(
                event_type="MODERATION_FAILED",
                problem_id=problem_id_str,
                status="failed",
                error=f"{e.code}: {e.message}",
            )
            raise

        except Exception as e:
            ai_metrics.record_failure("UNKNOWN_ERROR")
            log_ai_event(
                event_type="MODERATION_FAILED",
                problem_id=problem_id_str,
                status="failed",
                error=str(e),
            )
            raise AIModerationError(f"Unexpected error in moderation pipeline: {e}")
