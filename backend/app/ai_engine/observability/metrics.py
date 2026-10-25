"""In-memory telemetry and metrics collector for AI Engine operations."""

import threading
from typing import Any


class AIMetricsCollector:
    """Thread-safe collector for AI operational metrics."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._init_metrics()
            return cls._instance

    def _init_metrics(self):
        self._total_analyses = 0
        self._successful_analyses = 0
        self._failed_analyses = 0
        self._timeout_count = 0
        self._rate_limit_count = 0
        self._spam_detected_count = 0
        self._escalated_count = 0
        self._human_review_count = 0
        self._total_duration_ms = 0

    def record_success(self, duration_ms: int, recommendation: str, spam_prob: float):
        with self._lock:
            self._total_analyses += 1
            self._successful_analyses += 1
            self._total_duration_ms += duration_ms

            if spam_prob >= 0.6:
                self._spam_detected_count += 1
            if recommendation == "high_risk_escalation":
                self._escalated_count += 1
            elif recommendation == "human_review_required":
                self._human_review_count += 1

    def record_failure(self, error_code: str):
        with self._lock:
            self._total_analyses += 1
            self._failed_analyses += 1
            if error_code == "AI_TIMEOUT":
                self._timeout_count += 1
            elif error_code == "AI_RATE_LIMIT":
                self._rate_limit_count += 1

    def get_summary(self) -> dict[str, Any]:
        with self._lock:
            avg_duration = (
                self._total_duration_ms / self._successful_analyses
                if self._successful_analyses > 0
                else 0.0
            )
            success_rate = (
                (self._successful_analyses / self._total_analyses) * 100.0
                if self._total_analyses > 0
                else 100.0
            )
            return {
                "total_analyses": self._total_analyses,
                "successful": self._successful_analyses,
                "failed": self._failed_analyses,
                "success_rate_percent": round(success_rate, 2),
                "avg_duration_ms": round(avg_duration, 2),
                "timeouts": self._timeout_count,
                "rate_limits": self._rate_limit_count,
                "spam_detected": self._spam_detected_count,
                "escalations": self._escalated_count,
                "human_reviews": self._human_review_count,
            }


ai_metrics = AIMetricsCollector()
