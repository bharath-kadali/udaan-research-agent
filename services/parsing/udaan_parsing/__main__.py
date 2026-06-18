"""Run the parsing service: python -m udaan_parsing"""

import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "udaan_parsing.app:app",
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8002")),
    )
