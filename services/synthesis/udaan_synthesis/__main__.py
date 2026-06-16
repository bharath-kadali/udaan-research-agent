"""Run the synthesis service: python -m udaan_synthesis"""

import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "udaan_synthesis.app:app",
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8003")),
    )
