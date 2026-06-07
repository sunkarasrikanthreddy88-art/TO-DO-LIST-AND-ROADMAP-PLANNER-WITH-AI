import os
import time
import uuid
from typing import List, Optional, Union
from fastapi import FastAPI, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from pymongo import MongoClient
from dotenv import load_dotenv

# Load Environment Configuration
load_dotenv()
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/auratask")
PORT = int(os.getenv("PORT", 3000))

# Initialize MongoDB Client
try:
    client = MongoClient(MONGODB_URI)
    # Get database (fall back to 'auratask' if db name isn't parsed from URI)
    db = client.get_default_database()
    if db is None:
        db = client["auratask"]
    print("Successfully connected to MongoDB.")
except Exception as e:
    print(f"MongoDB connection failed: {e}")
    # Initialize connection to local default database
    client = MongoClient("mongodb://127.0.0.1:27017/")
    db = client["auratask"]

app = FastAPI(title="AuraTask AI API Server")

# Pydantic Schemas for validation
class SubtaskSchema(BaseModel):
    id: Optional[str] = None
    title: str
    completed: bool = False

class TaskSchema(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = ""
    category: Optional[str] = "General"
    priority: Optional[str] = "medium"
    startDate: Optional[str] = ""
    dueDate: Optional[str] = ""
    endDate: Optional[str] = ""
    groupName: Optional[str] = None
    completed: bool = False
    subtasks: List[SubtaskSchema] = []

class SettingsSchema(BaseModel):
    apiKey: str
    model: str = "gemini-2.5-flash"

# Helper formatters
def format_task(doc):
    if not doc:
        return None
    return {
        "id": doc.get("id") or str(doc.get("_id")),
        "title": doc.get("title", ""),
        "description": doc.get("description", ""),
        "category": doc.get("category", "General"),
        "priority": doc.get("priority", "medium"),
        "startDate": doc.get("startDate", ""),
        "dueDate": doc.get("dueDate", ""),
        "endDate": doc.get("endDate", ""),
        "groupName": doc.get("groupName"),
        "completed": bool(doc.get("completed", False)),
        "subtasks": [
            {
                "id": sub.get("id") or f"sub-{int(time.time()*1000)}-{idx}",
                "title": sub.get("title", ""),
                "completed": bool(sub.get("completed", False))
            }
            for idx, sub in enumerate(doc.get("subtasks", []))
        ]
    }

def format_settings(doc):
    if not doc:
        return {"apiKey": "", "model": "gemini-2.5-flash"}
    return {
        "apiKey": doc.get("apiKey", ""),
        "model": doc.get("model", "gemini-2.5-flash")
    }

# --- REST API ROUTES ---

@app.get("/api/settings")
async def get_settings():
    doc = db.settings.find_one({})
    return format_settings(doc)

@app.post("/api/settings")
async def save_settings(settings: SettingsSchema):
    db.settings.update_one(
        {}, 
        {"$set": {"apiKey": settings.apiKey.strip(), "model": settings.model}}, 
        upsert=True
    )
    return {"success": True, "settings": settings}

@app.get("/api/tasks")
async def get_tasks():
    cursor = db.tasks.find({})
    tasks = [format_task(doc) for doc in cursor]
    return tasks

@app.post("/api/tasks", status_code=status.HTTP_201_CREATED)
async def create_task(task: TaskSchema):
    task_id = task.id or f"task-{int(time.time()*1000)}-{uuid.uuid4().hex[:4]}"
    
    # Process subtasks structure
    processed_subtasks = []
    for s_idx, sub in enumerate(task.subtasks):
        sub_id = sub.id or f"sub-{int(time.time()*1000)}-{s_idx}"
        processed_subtasks.append({
            "id": sub_id,
            "title": sub.title,
            "completed": sub.completed
        })
        
    task_dict = {
        "id": task_id,
        "title": task.title,
        "description": task.description,
        "category": task.category,
        "priority": task.priority,
        "startDate": task.startDate,
        "dueDate": task.dueDate,
        "endDate": task.endDate,
        "groupName": task.groupName,
        "completed": task.completed,
        "subtasks": processed_subtasks
    }
    
    db.tasks.insert_one(task_dict)
    return format_task(task_dict)

@app.post("/api/tasks/bulk", status_code=status.HTTP_201_CREATED)
async def create_tasks_bulk(tasks: List[TaskSchema]):
    if not tasks:
        raise HTTPException(status_code=400, detail="Empty tasks list")
        
    processed_tasks = []
    for t_idx, t in enumerate(tasks):
        task_id = t.id or f"task-{int(time.time()*1000)}-{t_idx}-{uuid.uuid4().hex[:4]}"
        
        processed_subtasks = []
        for s_idx, sub in enumerate(t.subtasks):
            sub_id = sub.id or f"sub-{int(time.time()*1000)}-{t_idx}-{s_idx}"
            processed_subtasks.append({
                "id": sub_id,
                "title": sub.title,
                "completed": sub.completed
            })
            
        processed_tasks.append({
            "id": task_id,
            "title": t.title,
            "description": t.description,
            "category": t.category,
            "priority": t.priority,
            "startDate": t.startDate,
            "dueDate": t.dueDate,
            "endDate": t.endDate,
            "groupName": t.groupName,
            "completed": t.completed,
            "subtasks": processed_subtasks
        })
        
    db.tasks.insert_many(processed_tasks)
    return {"success": True, "count": len(processed_tasks)}

@app.delete("/api/tasks")
async def clear_all_tasks():
    db.tasks.delete_many({})
    return {"success": True, "message": "All tasks cleared"}

@app.put("/api/tasks/{task_id}")
async def update_task(task_id: str, update_data: dict):
    # Filter keys to update
    allowed_keys = ["title", "description", "category", "priority", "startDate", "dueDate", "endDate", "groupName", "completed", "subtasks"]
    filtered_update = {k: v for k, v in update_data.items() if k in allowed_keys}
    
    if "subtasks" in filtered_update:
        # Normalize subtasks structure
        normalized_subtasks = []
        for s_idx, sub in enumerate(filtered_update["subtasks"]):
            sub_id = sub.get("id") or f"sub-{int(time.time()*1000)}-{s_idx}"
            normalized_subtasks.append({
                "id": sub_id,
                "title": sub.get("title", ""),
                "completed": bool(sub.get("completed", False))
            })
        filtered_update["subtasks"] = normalized_subtasks
        
    result = db.tasks.update_one({"id": task_id}, {"$set": filtered_update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
        
    updated_doc = db.tasks.find_one({"id": task_id})
    return format_task(updated_doc)

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    result = db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True, "id": task_id}

# Ensure 'dist' directory exists to prevent StaticFiles initialization errors on startup
DIST_DIR = os.path.join(os.path.dirname(__file__), "dist")
if not os.path.exists(DIST_DIR):
    os.makedirs(DIST_DIR, exist_ok=True)
    with open(os.path.join(DIST_DIR, "index.html"), "w") as f:
        f.write("<h1>React App compiling... Please run 'npm run build' to update.</h1>")

from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
