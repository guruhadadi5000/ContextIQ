from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import os
from dotenv import load_dotenv
from typing import Optional, List, Dict
import json
import uuid
from datetime import datetime
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from context import prompt
from extract import DocumentError, extract_text

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize Bedrock client
bedrock_client = boto3.client(
    service_name="bedrock-runtime",
    region_name=os.getenv("DEFAULT_AWS_REGION", "ap-southeast-2"),
    config=Config(retries={"max_attempts": 5, "mode": "adaptive"}),
)

# Bedrock model selection
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")

# Memory storage configuration
USE_S3 = os.getenv("USE_S3", "false").lower() == "true"
S3_BUCKET = os.getenv("S3_BUCKET", "")
MEMORY_DIR = os.getenv("MEMORY_DIR", "../memory")

# Initialize S3 client if needed
if USE_S3:
    s3_client = boto3.client("s3")


# Request/Response models
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


class Message(BaseModel):
    role: str
    content: str
    timestamp: str


# Memory management functions
def get_memory_path(session_id: str) -> str:
    return f"{session_id}.json"


def get_document_path(session_id: str) -> str:
    return f"{session_id}.document.json"


def load_conversation(session_id: str) -> List[Dict]:
    """Load conversation history from storage"""
    if USE_S3:
        try:
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=get_memory_path(session_id))
            return json.loads(response["Body"].read().decode("utf-8"))
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return []
            raise
    else:
        # Local file storage
        file_path = os.path.join(MEMORY_DIR, get_memory_path(session_id))
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                return json.load(f)
        return []


def save_conversation(session_id: str, messages: List[Dict]):
    """Save conversation history to storage"""
    if USE_S3:
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=get_memory_path(session_id),
            Body=json.dumps(messages, indent=2),
            ContentType="application/json",
        )
    else:
        # Local file storage
        os.makedirs(MEMORY_DIR, exist_ok=True)
        file_path = os.path.join(MEMORY_DIR, get_memory_path(session_id))
        with open(file_path, "w") as f:
            json.dump(messages, f, indent=2)


def load_document(session_id: str) -> Optional[Dict]:
    if USE_S3:
        try:
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=get_document_path(session_id))
            return json.loads(response["Body"].read().decode("utf-8"))
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return None
            raise
    file_path = os.path.join(MEMORY_DIR, get_document_path(session_id))
    if not os.path.exists(file_path):
        return None
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_document(session_id: str, document: Dict):
    body = json.dumps(document, indent=2)
    if USE_S3:
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=get_document_path(session_id),
            Body=body,
            ContentType="application/json",
        )
        return
    os.makedirs(MEMORY_DIR, exist_ok=True)
    file_path = os.path.join(MEMORY_DIR, get_document_path(session_id))
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(body)


def delete_document_file(session_id: str):
    if USE_S3:
        s3_client.delete_object(Bucket=S3_BUCKET, Key=get_document_path(session_id))
        return
    file_path = os.path.join(MEMORY_DIR, get_document_path(session_id))
    if os.path.exists(file_path):
        os.remove(file_path)


def document_instructions(document: Dict) -> str:
    filename = document["filename"]
    return f"""You are ContextIQ. Answer questions about the uploaded document below.

Document name: {filename}
Page breaks are marked like [Page N]. Answer only from this document and the conversation.
If the answer is not in the document, say that you cannot find it there. Do not invent details.
Format the answer in Markdown when it helps: short headings, lists, and fenced code.
End every answer with a final plain-text line, not inside Markdown, in exactly this form:
Source: {filename} · Page N
Use the page number you relied on. If the document has no page markers, end with:
Source: {filename}

DOCUMENT:
{document["text"]}
"""


def model_messages(conversation: List[Dict], user_message: str) -> List[Dict]:
    messages = []
    for msg in conversation[-20:]:
        role = msg.get("role")
        if role not in ("user", "assistant"):
            continue
        if messages and messages[-1]["role"] == role:
            messages[-1]["content"][0]["text"] += "\n" + msg["content"]
            continue
        messages.append({"role": role, "content": [{"text": msg["content"]}]})

    if messages and messages[-1]["role"] == "user":
        messages[-1]["content"][0]["text"] += "\n" + user_message
    else:
        messages.append({"role": "user", "content": [{"text": user_message}]})
    return messages


def bedrock_error_text(error: ClientError) -> str:
    code = error.response["Error"]["Code"]
    if code == "ValidationException":
        return "Invalid message format for Bedrock"
    if code == "AccessDeniedException":
        return "Access denied to Bedrock model"
    if code == "ThrottlingException":
        return "The model is busy. Try again in a moment."
    print(f"Bedrock error: {error}")
    return "The model could not answer just now."


def sse(payload: Dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def next_stream_event(iterator):
    try:
        return next(iterator)
    except StopIteration:
        return None
    except ClientError as error:
        return error


@app.get("/")
async def root():
    return {
        "message": "ContextIAI - Serverless AI Assistant Platform (Powered by AWS Bedrock)",
        "memory_enabled": True,
        "storage": "S3" if USE_S3 else "local",
        "ai_model": BEDROCK_MODEL_ID
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "use_s3": USE_S3,
        "bedrock_model": BEDROCK_MODEL_ID
    }


@app.post("/chat")
async def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Enter a message.")

    session_id = request.session_id or str(uuid.uuid4())
    try:
        conversation = load_conversation(session_id)
        document = load_document(session_id)
    except Exception as error:
        print(f"Error in chat endpoint: {error}")
        raise HTTPException(status_code=500, detail="The conversation could not be loaded.") from error

    system_text = document_instructions(document) if document else prompt()
    messages = model_messages(conversation, request.message)

    async def events():
        try:
            response = await asyncio.to_thread(
                bedrock_client.converse_stream,
                modelId=BEDROCK_MODEL_ID,
                system=[{"text": system_text}],
                messages=messages,
                inferenceConfig={"maxTokens": 2000, "temperature": 0.7, "topP": 0.9},
            )
        except ClientError as error:
            yield sse({"error": bedrock_error_text(error)})
            return

        yield sse({"session_id": session_id})
        parts: List[str] = []
        iterator = iter(response["stream"])
        while True:
            event = await asyncio.to_thread(next_stream_event, iterator)
            if event is None:
                break
            if isinstance(event, ClientError):
                yield sse({"error": bedrock_error_text(event)})
                return
            delta = event.get("contentBlockDelta", {}).get("delta", {}).get("text", "")
            if delta:
                parts.append(delta)
                yield sse({"delta": delta})

        full_response = "".join(parts).strip()
        if not full_response:
            yield sse({"error": "The model returned an empty reply."})
            return

        conversation.append(
            {"role": "user", "content": request.message, "timestamp": datetime.now().isoformat()}
        )
        conversation.append(
            {
                "role": "assistant",
                "content": full_response,
                "timestamp": datetime.now().isoformat(),
            }
        )
        await asyncio.to_thread(save_conversation, session_id, conversation)
        yield sse({"done": True})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/document")
async def upload_document(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
):
    session_id = session_id or str(uuid.uuid4())
    data = await file.read()
    try:
        extracted = extract_text(file.filename or "document", data)
    except DocumentError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error

    extracted["uploaded_at"] = datetime.now().isoformat()
    save_document(session_id, extracted)
    return {
        "session_id": session_id,
        "filename": extracted["filename"],
        "characters": extracted["characters"],
    }


@app.get("/document/{session_id}")
async def get_document(session_id: str):
    document = load_document(session_id)
    if not document:
        raise HTTPException(status_code=404, detail="No document for this conversation")
    return {
        "session_id": session_id,
        "filename": document["filename"],
        "characters": document["characters"],
    }


@app.delete("/document/{session_id}")
async def remove_document(session_id: str):
    delete_document_file(session_id)
    return {"session_id": session_id, "removed": True}


@app.get("/conversation/{session_id}")
async def get_conversation(session_id: str):
    """Retrieve conversation history"""
    try:
        conversation = load_conversation(session_id)
        return {"session_id": session_id, "messages": conversation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)