"""Optional CPU-only benchmark server; install fastapi, uvicorn, sentence-transformers."""

import os

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

app = FastAPI()
model = CrossEncoder(
    os.environ.get("RERANKER_MODEL_ID", "cross-encoder/ms-marco-MiniLM-L-6-v2"),
    trust_remote_code=True,
    device="cpu",
)


class Request(BaseModel):
    model: str
    query: str
    documents: list[str]
    top_n: int


@app.post("/v1/rerank")
def rerank(request: Request):
    scores = model.predict(
        [(request.query, document) for document in request.documents],
        batch_size=4,
        show_progress_bar=False,
    )
    results = sorted(
        ({"index": index, "relevance_score": float(score)} for index, score in enumerate(scores)),
        key=lambda item: -item["relevance_score"],
    )
    return {"results": results[: request.top_n]}
