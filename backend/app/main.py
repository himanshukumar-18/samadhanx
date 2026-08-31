from fastapi import FastAPI

app = FastAPI(
    title="SamadhanX API",
    description="AI-powered platform for solving societal challenges.",
    version="1.0.0",
)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "samadhanx-api",
    }