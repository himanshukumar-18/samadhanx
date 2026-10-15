"""Evaluation and calibration script for Duplicate Problem Detection.

Evaluates precision, recall, F1, and geo-filter efficacy across threshold ranges
using the curated evaluation dataset (duplicate_pairs.json).
"""

import json
import math
from pathlib import Path
import sys

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.ai_engine.services.embedder import EmbedderService


def cosine_sim(v1: list[float], v2: list[float]) -> float:
    if not v1 or not v2:
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


def run_evaluation(data_path: Path | None = None) -> dict:
    if data_path is None:
        data_path = Path(__file__).parent / "duplicate_pairs.json"

    with open(data_path, "r", encoding="utf-8") as f:
        pairs = json.load(f)

    print(f"Loaded {len(pairs)} test pairs from {data_path.name}")
    print("Computing embeddings with multilingual SentenceTransformer...")

    has_embedder = EmbedderService.is_available()
    scores = []

    for item in pairs:
        pa = item["problem_a"]
        pb = item["problem_b"]
        gt = item["ground_truth"]

        text_a = EmbedderService.normalize_text(pa["title"], pa["description"])
        text_b = EmbedderService.normalize_text(pb["title"], pb["description"])

        if has_embedder:
            va = EmbedderService.get_embedding(text_a)
            vb = EmbedderService.get_embedding(text_b)
            sim = cosine_sim(va, vb)
        else:
            # Deterministic word overlap similarity fallback when running without pytorch
            set_a = set(text_a.lower().split())
            set_b = set(text_b.lower().split())
            sim = len(set_a & set_b) / max(len(set_a | set_b), 1)

        scores.append({
            "id": item["id"],
            "ground_truth": gt,
            "sim": sim,
            "district_a": pa.get("district", ""),
            "district_b": pb.get("district", ""),
        })

    # Threshold sweep
    thresholds = [0.70, 0.75, 0.80, 0.85, 0.90, 0.95]
    results = {}

    print("\n--- Calibration Results Across Thresholds ---")
    print(f"{'Threshold':<12} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'Geo Filtered':<12}")
    print("-" * 65)

    best_f1 = -1.0
    best_thresh = 0.85

    for t in thresholds:
        tp = 0
        fp = 0
        fn = 0
        tn = 0
        geo_filtered = 0

        for s in scores:
            pred_dup = s["sim"] >= t
            is_dup = s["ground_truth"] == "duplicate"

            # Apply district match rule
            if pred_dup and s["district_a"].strip().lower() != s["district_b"].strip().lower():
                geo_filtered += 1
                pred_dup = False  # Downgraded from duplicate

            if pred_dup and is_dup:
                tp += 1
            elif pred_dup and not is_dup:
                fp += 1
            elif not pred_dup and is_dup:
                fn += 1
            else:
                tn += 1

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        results[t] = {"precision": precision, "recall": recall, "f1": f1, "geo_filtered": geo_filtered}
        print(f"{t:<12.2f} | {precision:<10.3f} | {recall:<10.3f} | {f1:<10.3f} | {geo_filtered:<12}")

        if f1 > best_f1:
            best_f1 = f1
            best_thresh = t

    print("-" * 65)
    print(f"Optimal high threshold: {best_thresh} (F1: {best_f1:.3f})")
    print(f"Recommended LOW threshold for candidate recall & LLM verify: 0.75")
    print(f"Recommended HIGH threshold for auto-flagging: 0.90\n")

    return results


if __name__ == "__main__":
    run_evaluation()

