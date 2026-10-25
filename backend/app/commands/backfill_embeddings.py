"""Backfill all missing problem embeddings in batches."""

from app.tasks.duplicate_detection_task import backfill_problem_embeddings_task


def main() -> None:
    total = 0
    while True:
        result = backfill_problem_embeddings_task.run(batch_size=32)
        processed = int(result.get("processed", 0))
        total += processed
        print(f"embedding batch: {processed}; total: {total}")
        if processed == 0 or result.get("status") != "completed":
            break
    print(f"embedding backfill complete: {total} problem(s)")


if __name__ == "__main__":
    main()
