"""Run the ranking service: python -m udaan_ranking"""

import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "udaan_ranking.app:app",
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8001")),
    )
