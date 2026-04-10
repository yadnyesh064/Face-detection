from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import logging

from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VisionAPI")

engine = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    global engine
    try:
        from vision import VisionEngine
        engine = VisionEngine()
        logger.info("Vision Analytics Engine initialized.")
    except Exception as e:
        logger.error(f"Failed to load vision module: {e}")
    
    yield
    
    # Shutdown logic
    if engine:
        engine.release()
    logger.info("Vision Analytics Engine shut down.")

app = FastAPI(title="Face Analytics API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "online", "message": "Vision API is reachable"}


@app.websocket("/ws/video")
async def websocket_video_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("Client connected to video stream.")
    
    try:
        while True:
            payload = {"image": None, "telemetry": None}
            
            if engine:
                try:
                    frame_base64, telemetry = engine.process_frame()
                    payload["image"] = frame_base64
                    payload["telemetry"] = telemetry
                except Exception as e:
                    logger.error(f"Error in processing frame: {e}")
                    payload["telemetry"] = {"system_error": f"Internal Process Error: {e}"}
            else:
                payload["telemetry"] = {"system_error": "Vision Engine not initialized."}
            
            # Send payload even if image is missing to report errors to UI
            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(0.01) 
            
    except WebSocketDisconnect:
        logger.info("Client disconnected from video stream.")
    except Exception as e:
        logger.error(f"WebSocket processing error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
