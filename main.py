# uvicorn main:app --reload

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pipeline import run_research_pipeline

app = FastAPI(title="Agentic Research API", version="1.0.0")

# Enable CORS for the frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace "*" with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic model for request validation
class ResearchRequest(BaseModel):
    topic: str

@app.post("/api/research")
async def process_research(request: ResearchRequest):
    if not request.topic or not request.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty.")
        
    try:
        # Execute the multi-agent pipeline
        final_state = run_research_pipeline(request.topic)
        
        # Return the structured data to the frontend
        return {
            "status": "success",
            "report": final_state.get("report", "Report generation failed."),
            "feedback": final_state.get("feedback", "No feedback provided.")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # FastAPI defaults to port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)