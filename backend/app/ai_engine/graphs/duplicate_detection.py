"""LangGraph orchestration pipeline for Duplicate Problem Detection.

Unifies duplicate detection across two modes:
1. 'precheck' (Citizen): Fast vector search + heuristic routing, returns privacy-preserving candidate cards, skips LLM for latency.
2. 'moderation' (Admin): Full graph execution with LLM verification for borderline cases, geo-downgrade routing, and persistence.
"""

import logging
from typing import Any, Literal, TypedDict

from pydantic import BaseModel, Field

try:
    from langgraph.graph import END, START, StateGraph
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    END = "__end__"
    START = "__start__"
    StateGraph = None

from app.ai_engine.providers.base import ModelProvider
from app.ai_engine.providers.factory import get_model_provider
from app.ai_engine.services.embedder import EmbedderService
from app.core.config import settings
from app.models.enums import DuplicateVerdict

logger = logging.getLogger("samadhanx.ai.duplicate_detection")


class LLMDuplicateVerification(BaseModel):
    """Structured output schema for LLM borderline duplicate verification."""

    is_duplicate: bool = Field(
        ...,
        description="Whether Problem B describes the exact same physical and civic incident/issue as Problem A",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score in the duplicate determination (0.0 to 1.0)",
    )
    same_location: bool = Field(
        ...,
        description="Whether both problems refer to the exact same physical place, street, ward, or locality",
    )
    reasoning: str = Field(
        ...,
        description="Concise rationale (max 2 sentences) explaining whether they are duplicate reports or distinct issues",
    )


class DuplicateCandidateData(TypedDict, total=False):
    candidate_id: str
    title: str
    description: str
    category: str
    district: str
    status: str
    similarity: float
    endorsement_count: int
    verdict: str
    llm_used: bool
    llm_reason: str | None
    same_location: bool | None


class DuplicateGraphState(TypedDict, total=False):
    problem_id: str | None
    title: str
    description: str
    category: str | None
    district: str | None
    mode: Literal["precheck", "moderation"]

    # Intermediate artifacts
    normalized_text: str
    embedding: list[float] | None
    raw_candidates: list[dict[str, Any]]
    evaluated_candidates: list[DuplicateCandidateData]
    degraded: bool
    error: str | None


class DuplicateDetectionGraphBuilder:
    """Builds and compiles the duplicate detection StateGraph."""

    def __init__(self, provider: ModelProvider | None = None):
        self.provider = provider or get_model_provider()

    def _node_normalize_input(self, state: DuplicateGraphState) -> dict[str, Any]:
        """Normalize title and description text."""
        normalized = EmbedderService.normalize_text(
            state.get("title", ""), state.get("description", "")
        )
        return {"normalized_text": normalized}

    def _node_embed_problem(self, state: DuplicateGraphState) -> dict[str, Any]:
        """Compute multilingual dense embedding vector."""
        if state.get("embedding"):
            return {"embedding": state["embedding"], "degraded": False}

        normalized = state.get("normalized_text", "")
        try:
            vec = EmbedderService.get_embedding(normalized)
            return {"embedding": vec, "degraded": False}
        except Exception as exc:
            logger.warning(f"Embedding computation failed, failing open: {exc}")
            return {"embedding": None, "degraded": True, "error": str(exc)}

    def _node_score_and_route(self, state: DuplicateGraphState) -> dict[str, Any]:
        """Score candidates against high and low similarity thresholds with geo-check."""
        raw_candidates = state.get("raw_candidates", [])
        high_threshold = float(getattr(settings, "DUPLICATE_HIGH_THRESHOLD", 0.90))
        low_threshold = float(getattr(settings, "DUPLICATE_LOW_THRESHOLD", 0.75))
        mode = state.get("mode", "moderation")
        new_district = (state.get("district") or "").strip()

        def same_district(left: str, right: str) -> bool:
            """Compare locations adhering to platform deduplication rules:
            - Compare at DISTRICT level only (e.g. Ranchi vs Hazaribag = different)
            - Ignore locality spelling differences, use fuzzy matching (ratio >= 80/85) for locality
            - If district is missing or unclear on either side, do NOT downgrade
            """
            if not left or not right:
                return True  # Missing data on either side: do NOT downgrade

            def clean_tokens(s: str) -> list[str]:
                return [p.strip().lower() for p in s.replace("/", ",").split(",") if len(p.strip()) >= 3]

            tokens_left = clean_tokens(left)
            tokens_right = clean_tokens(right)

            if not tokens_left or not tokens_right:
                return True  # Unclear or missing: do NOT downgrade

            # Helper for fuzzy ratio (prefers rapidfuzz if available, standard library difflib as fallback)
            def _calc_ratio(s1: str, s2: str) -> float:
                try:
                    from rapidfuzz import fuzz  # type: ignore[import]
                    return float(fuzz.ratio(s1, s2))
                except Exception:
                    import difflib
                    return difflib.SequenceMatcher(None, s1, s2).ratio() * 100

            # If ANY locality/block/district token matches across the two strings
            # (exact, substring, or fuzzy match >= 80 to catch typos like Khjiri vs Khijri)
            for tl in tokens_left:
                for tr in tokens_right:
                    if tl == tr or tl in tr or tr in tl:
                        return True
                    if _calc_ratio(tl, tr) >= 80:
                        return True

            # No tokens match at all (e.g., Ranchi vs Hazaribag) -> different locations
            return False

        evaluated: list[DuplicateCandidateData] = []
        for cand in raw_candidates:
            sim = float(cand.get("similarity", 0.0))
            cand_district = (cand.get("district") or "").strip()

            item: DuplicateCandidateData = {
                "candidate_id": str(cand.get("id", "")),
                "title": cand.get("title", ""),
                "description": cand.get("description", ""),
                "category": cand.get("category", ""),
                "district": cand.get("district", ""),
                "status": cand.get("status", ""),
                "similarity": sim,
                "endorsement_count": int(cand.get("endorsement_count", 0)),
                "llm_used": False,
                "llm_reason": None,
                "same_location": None,
            }

            if sim >= high_threshold:
                # Geo-downgrade rule: only downgrade when BOTH sides have location data
                # AND they are confirmed to be in different districts/localities.
                if not same_district(new_district, cand_district):
                    item["verdict"] = DuplicateVerdict.RELATED.value
                    item["llm_reason"] = "High semantic similarity but reported in different districts."
                else:
                    item["verdict"] = DuplicateVerdict.STRONG_DUPLICATE.value
            elif sim >= low_threshold:
                if mode == "precheck":
                    # Pre-check skips LLM for sub-second latency
                    item["verdict"] = DuplicateVerdict.POSSIBLE_DUPLICATE.value
                else:
                    # Mark for LLM verification in moderation mode
                    item["verdict"] = "needs_llm_verify"
            else:
                item["verdict"] = DuplicateVerdict.UNIQUE.value

            evaluated.append(item)

        return {"evaluated_candidates": evaluated}



    async def _node_llm_verify(self, state: DuplicateGraphState) -> dict[str, Any]:
        """Run structured LLM verification on borderline candidates."""
        evaluated = list(state.get("evaluated_candidates", []))
        new_title = state.get("title", "")
        new_desc = state.get("description", "")
        new_district = state.get("district", "")

        for item in evaluated:
            if item.get("verdict") != "needs_llm_verify":
                continue

            prompt = (
                "You are an expert civic problem deduplication specialist for the SamadhanX platform.\n"
                "Determine whether Problem B is a duplicate of Problem A (reporting the exact same issue and locality) "
                "or a distinct, independent community concern.\n\n"
                f"<problem_a>\nTitle: {new_title}\nDistrict: {new_district}\nDescription: {new_desc}\n</problem_a>\n\n"
                f"<problem_b>\nTitle: {item.get('title')}\nDistrict: {item.get('district')}\nDescription: {item.get('description')}\n</problem_b>\n"
            )

            try:
                res: LLMDuplicateVerification = await self.provider.generate_structured(
                    schema=LLMDuplicateVerification,
                    prompt=prompt,
                    system_prompt="You evaluate civic reports for duplicates with strict fidelity to physical location and core issue. Output valid JSON.",
                )
                item["llm_used"] = True
                item["llm_reason"] = res.reasoning
                item["same_location"] = res.same_location

                # If LLM confirms duplicate with confidence >= 0.70
                if res.is_duplicate and res.confidence >= 0.70:
                    # Downgrade if location does not match
                    if not res.same_location:
                        item["verdict"] = DuplicateVerdict.RELATED.value
                    else:
                        item["verdict"] = DuplicateVerdict.POSSIBLE_DUPLICATE.value
                else:
                    item["verdict"] = DuplicateVerdict.RELATED.value if res.confidence >= 0.50 else DuplicateVerdict.UNIQUE.value

            except Exception as exc:
                logger.warning(f"LLM verification failed on candidate {item.get('candidate_id')}: {exc}")
                # Safe fallback: preserve possible_duplicate flag without blocking
                item["llm_used"] = False
                item["verdict"] = DuplicateVerdict.POSSIBLE_DUPLICATE.value
                item["llm_reason"] = "Automated similarity flag (LLM verification unavailable)"

        return {"evaluated_candidates": evaluated}

    def _node_build_result(self, state: DuplicateGraphState) -> dict[str, Any]:
        """Filter out unique items and format candidate payload."""
        evaluated = state.get("evaluated_candidates", [])
        candidates = [c for c in evaluated if c.get("verdict") != DuplicateVerdict.UNIQUE.value]
        # Sort by similarity descending
        candidates.sort(key=lambda x: x.get("similarity", 0.0), reverse=True)
        return {"evaluated_candidates": candidates}

    def build(self) -> Any:
        """Compile the LangGraph workflow."""
        if not LANGGRAPH_AVAILABLE:
            return None

        workflow = StateGraph(DuplicateGraphState)
        workflow.add_node("normalize_input", self._node_normalize_input)
        workflow.add_node("embed_problem", self._node_embed_problem)
        workflow.add_node("score_and_route", self._node_score_and_route)
        workflow.add_node("llm_verify", self._node_llm_verify)
        workflow.add_node("build_result", self._node_build_result)

        workflow.add_edge(START, "normalize_input")
        workflow.add_edge("normalize_input", "embed_problem")

        def route_after_embed(state: DuplicateGraphState) -> str:
            if state.get("degraded") or not state.get("embedding"):
                return "build_result"
            return "score_and_route"

        workflow.add_conditional_edges("embed_problem", route_after_embed, {
            "build_result": "build_result",
            "score_and_route": "score_and_route",
        })

        def route_after_score(state: DuplicateGraphState) -> str:
            if state.get("mode") == "moderation":
                has_borderline = any(
                    c.get("verdict") == "needs_llm_verify"
                    for c in state.get("evaluated_candidates", [])
                )
                if has_borderline:
                    return "llm_verify"
            return "build_result"

        workflow.add_conditional_edges("score_and_route", route_after_score, {
            "llm_verify": "llm_verify",
            "build_result": "build_result",
        })

        workflow.add_edge("llm_verify", "build_result")
        workflow.add_edge("build_result", END)

        return workflow.compile()
