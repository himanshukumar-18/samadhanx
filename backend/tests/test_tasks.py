from app.tasks.health import ping_task


def test_celery_ping_task_execution() -> None:
    # Celery tasks can be executed directly as regular Python functions in unit tests
    result = ping_task(message="unit-test-ping")
    assert result["status"] == "SUCCESS"
    assert "pong: unit-test-ping" in result["message"]
    assert result["worker"] == "celery"
