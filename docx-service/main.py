"""SwimSync DOCX Microservice — FastAPI

Endpoints:
  POST /parse-zayvka     — parse .docx team application
  POST /start-protocol   — generate start protocol .docx
  POST /result-protocol  — generate results protocol .docx
  POST /jobs/start-protocol  — enqueue start protocol generation
  POST /jobs/result-protocol — enqueue result protocol generation
  GET  /jobs/{job_id}        — job status
  GET  /jobs/{job_id}/download — download generated .docx
  POST /convert-pdf      — convert .docx to PDF via LibreOffice
"""

import os
import tempfile
import asyncio
import logging
import time
import json
from contextlib import asynccontextmanager
from uuid import uuid4
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, AsyncIterator
from redis import asyncio as redis_async

from docx_service_parser.zayvka_parser import parse_zayvka
from generator.start_protocol import generate_start_protocol
from generator.result_protocol import generate_result_protocol
from generator.named_application import generate_named_application

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("swimsync.docx-service")
docx_jobs: Dict[str, Dict[str, Any]] = {}
docx_job_queue: Optional[asyncio.Queue] = None
docx_idempotency: Dict[str, Dict[str, Any]] = {}
docx_dead_letter: List[Dict[str, Any]] = []
DOCX_JOB_TTL_SEC = int(os.getenv("DOCX_JOB_TTL_SEC", "900"))
DOCX_JOB_MAX_RETRIES = int(os.getenv("DOCX_JOB_MAX_RETRIES", "3"))
DOCX_INTERNAL_WORKER = os.getenv("DOCX_INTERNAL_WORKER", "true").strip().lower() in ("1", "true", "yes", "on")
DOCX_REDIS_URL = os.getenv("DOCX_REDIS_URL", os.getenv("REDIS_URL", "")).strip()
DOCX_REDIS_QUEUE_KEY = os.getenv("DOCX_REDIS_QUEUE_KEY", "swimsync:docx:queue")
DOCX_REDIS_DEAD_LETTER_KEY = os.getenv("DOCX_REDIS_DEAD_LETTER_KEY", "swimsync:docx:dead-letter")
DOCX_REDIS_JOB_PREFIX = os.getenv("DOCX_REDIS_JOB_PREFIX", "swimsync:docx:job")
DOCX_REDIS_IDEMP_PREFIX = os.getenv("DOCX_REDIS_IDEMP_PREFIX", "swimsync:docx:idempotency")
redis_client: Optional[redis_async.Redis] = None


async def on_startup() -> None:
    global docx_job_queue, redis_client
    if DOCX_REDIS_URL:
        redis_client = redis_async.from_url(DOCX_REDIS_URL, decode_responses=False)
        await redis_client.ping()
        docx_job_queue = None
        logger.info("docx_queue_backend=redis")
    else:
        docx_job_queue = asyncio.Queue()
        logger.info("docx_queue_backend=memory")

    if DOCX_INTERNAL_WORKER:
        existing_task = getattr(app.state, "docx_worker_task", None)
        if not existing_task or existing_task.done():
            app.state.docx_worker_task = asyncio.create_task(_docx_worker(docx_job_queue))
        logger.info("docx_internal_worker=enabled")
    else:
        app.state.docx_worker_task = None
        logger.info("docx_internal_worker=disabled")


async def on_shutdown() -> None:
    global redis_client
    task = getattr(app.state, "docx_worker_task", None)
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        app.state.docx_worker_task = None

    if redis_client:
        await redis_client.close()
        redis_client = None


@asynccontextmanager
async def lifespan(fastapi_app: FastAPI) -> AsyncIterator[None]:
    await on_startup()

    try:
        yield
    finally:
        await on_shutdown()


app = FastAPI(title="SwimSync DOCX Service", version="1.0.0", lifespan=lifespan)

cors_origins_raw = os.getenv("CORS_ALLOW_ORIGINS", "")
cors_origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> Dict[str, str]:
    return {"status": "ok", "service": "swimsync-docx-service"}


# ─── Parse .docx application ───────────────────────────────────────────────

@app.post("/parse-zayvka")
async def parse_zayvka_endpoint(file: UploadFile = File(...)):
    """Parse a .docx team application file.
    
    Returns JSON with athletes, entries, warnings, errors.
    """
    filename = (file.filename or '').lower()
    if not filename.endswith('.docx'):
        raise HTTPException(400, "Only .docx files are supported")
    
    content = await file.read()
    try:
        result = parse_zayvka(content)
        return result
    except Exception as error:
        logger.error(
            "parse_zayvka_failed endpoint=%s error_type=%s",
            "/parse-zayvka",
            type(error).__name__,
        )
        raise HTTPException(500, "Failed to parse application document")


# ─── Generate Start Protocol ───────────────────────────────────────────────

class HeatEntry(BaseModel):
    lane: int
    full_name: str
    age_group: str = ""
    birth_year: int
    entry_time_ms: Optional[int] = None
    coach: str = ""

class Heat(BaseModel):
    number: int
    entries: List[HeatEntry]

class EventForStartProtocol(BaseModel):
    distance_m: int
    style: str
    gender: str
    heats: List[Heat]

class StartProtocolRequest(BaseModel):
    competition: Dict[str, Any]
    events: List[EventForStartProtocol]
    idempotency_key: Optional[str] = None


def dump_model(obj: BaseModel):
    """Compatibility helper for Pydantic v1 (dict) and v2 (model_dump)."""
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    return obj.dict()


@app.post("/start-protocol")
async def generate_start_protocol_endpoint(req: StartProtocolRequest):
    """Generate start protocol .docx file."""
    try:
        docx_bytes = generate_start_protocol(
            req.competition,
            [dump_model(e) for e in req.events]
        )
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": 'attachment; filename="start_protocol.docx"'
            }
        )
    except Exception as error:
        logger.error(
            "start_protocol_generation_failed endpoint=%s error_type=%s",
            "/start-protocol",
            type(error).__name__,
        )
        raise HTTPException(500, "Failed to generate start protocol")


# ─── Generate Results Protocol ─────────────────────────────────────────────

class ResultEntry(BaseModel):
    place: Optional[int] = None
    place_display: str = ""
    lane: int = 0
    full_name: str
    birth_year: int
    rank: str = "NONE"
    club: str = ""
    region: str = ""
    finish_time_ms: Optional[int] = None
    achieved_rank: Optional[str] = None
    points_wa: Optional[int] = None
    coach: str = ""
    status: str = "OK"
    dq_reason: Optional[str] = None

class AgeGroupResults(BaseModel):
    name: str = ""
    results: List[ResultEntry]

class EventForResultProtocol(BaseModel):
    distance_m: int
    style: str
    gender: str
    age_groups: List[AgeGroupResults]

class ResultProtocolRequest(BaseModel):
    competition: Dict[str, Any]
    events: List[EventForResultProtocol]
    idempotency_key: Optional[str] = None

class NamedApplicationEvent(BaseModel):
    distanceM: Optional[int] = None
    style: Optional[str] = None
    entryTimeMs: Optional[int] = None

class NamedApplicationAthlete(BaseModel):
    fullName: str
    birthYear: int
    gender: str
    rank: Optional[str] = None
    coach: Optional[str] = None
    club: Optional[str] = None
    region: Optional[str] = None
    events: List[NamedApplicationEvent] = []

class NamedApplicationRequest(BaseModel):
    title: Optional[str] = None
    organization: Optional[str] = None
    region: Optional[str] = None
    generatedAt: Optional[str] = None
    athletes: List[NamedApplicationAthlete]

class DocxJobSubmitResponse(BaseModel):
    job_id: str
    status: str

class DocxJobStatusResponse(BaseModel):
    job_id: str
    status: str
    error: Optional[str] = None


@app.post("/result-protocol")
async def generate_result_protocol_endpoint(req: ResultProtocolRequest):
    """Generate results protocol .docx file."""
    try:
        docx_bytes = generate_result_protocol(
            req.competition,
            [dump_model(e) for e in req.events]
        )
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": 'attachment; filename="result_protocol.docx"'
            }
        )
    except Exception as error:
        logger.error(
            "result_protocol_generation_failed endpoint=%s error_type=%s",
            "/result-protocol",
            type(error).__name__,
        )
        raise HTTPException(500, "Failed to generate result protocol")


@app.post("/named-application")
async def generate_named_application_endpoint(req: NamedApplicationRequest):
    """Generate named application .docx file."""
    try:
        docx_bytes = generate_named_application(dump_model(req))
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": 'attachment; filename="named_application.docx"'
            }
        )
    except Exception as error:
        logger.error(
            "named_application_generation_failed endpoint=%s error_type=%s",
            "/named-application",
            type(error).__name__,
        )
        raise HTTPException(500, "Failed to generate named application")

def _job_meta_key(job_id: str) -> str:
    return f"{DOCX_REDIS_JOB_PREFIX}:{job_id}:meta"

def _job_result_key(job_id: str) -> str:
    return f"{DOCX_REDIS_JOB_PREFIX}:{job_id}:result"

def _job_idempotency_key(job_type: str, idempotency_key: str) -> str:
    return f"{DOCX_REDIS_IDEMP_PREFIX}:{job_type}:{idempotency_key}"

async def _save_job(job: Dict[str, Any]) -> None:
    if redis_client:
        meta = dict(job)
        meta.pop("result_bytes", None)
        await redis_client.set(_job_meta_key(job["job_id"]), json.dumps(meta), ex=DOCX_JOB_TTL_SEC)
        result_bytes = job.get("result_bytes")
        if result_bytes:
            await redis_client.set(_job_result_key(job["job_id"]), result_bytes, ex=DOCX_JOB_TTL_SEC)
        else:
            await redis_client.delete(_job_result_key(job["job_id"]))
        return
    docx_jobs[job["job_id"]] = job

async def _load_job(job_id: str) -> Optional[Dict[str, Any]]:
    if redis_client:
        raw_meta = await redis_client.get(_job_meta_key(job_id))
        if not raw_meta:
            return None
        meta = json.loads(raw_meta.decode() if isinstance(raw_meta, bytes) else raw_meta)
        result_bytes = await redis_client.get(_job_result_key(job_id))
        if result_bytes:
            meta["result_bytes"] = result_bytes
        return meta
    return docx_jobs.get(job_id)

def _cleanup_expired_jobs() -> None:
    if redis_client:
        return
    now = time.time()
    expired_ids = []
    for job_id, job in docx_jobs.items():
        if job["status"] in ("completed", "failed") and (now - job["updated_at"]) > DOCX_JOB_TTL_SEC:
            expired_ids.append(job_id)
    for job_id in expired_ids:
        docx_jobs.pop(job_id, None)

    expired_idempotency = []
    for key, item in docx_idempotency.items():
        if item["expires_at"] <= now:
            expired_idempotency.append(key)
    for key in expired_idempotency:
        docx_idempotency.pop(key, None)

async def _enqueue_queue_message(job_id: str, job_type: str) -> None:
    if redis_client:
        await redis_client.rpush(
            DOCX_REDIS_QUEUE_KEY,
            json.dumps({"job_id": job_id, "job_type": job_type}),
        )
        return
    if not docx_job_queue:
        raise HTTPException(503, "Queue is not initialized")
    docx_job_queue.put_nowait((job_id, job_type))

async def _pull_queue_message(queue: Optional[asyncio.Queue]) -> Optional[Dict[str, str]]:
    if redis_client:
        item = await redis_client.blpop(DOCX_REDIS_QUEUE_KEY, timeout=1)
        if not item:
            return None
        _, raw_payload = item
        payload = raw_payload.decode() if isinstance(raw_payload, bytes) else raw_payload
        return json.loads(payload)

    if not queue:
        return None
    try:
        job_id, job_type = await asyncio.wait_for(queue.get(), timeout=1)
    except asyncio.TimeoutError:
        return None
    return {"job_id": job_id, "job_type": job_type}

async def _register_idempotency(job_type: str, idempotency_key: str, job_id: str) -> None:
    if redis_client:
        await redis_client.set(_job_idempotency_key(job_type, idempotency_key), job_id, ex=DOCX_JOB_TTL_SEC)
        return
    docx_idempotency[f"{job_type}:{idempotency_key}"] = {
        "job_id": job_id,
        "expires_at": time.time() + DOCX_JOB_TTL_SEC,
    }

async def _resolve_idempotency(job_type: str, idempotency_key: Optional[str]) -> Optional[str]:
    if not idempotency_key:
        return None
    if redis_client:
        existing = await redis_client.get(_job_idempotency_key(job_type, idempotency_key))
        if not existing:
            return None
        return existing.decode() if isinstance(existing, bytes) else str(existing)
    record = docx_idempotency.get(f"{job_type}:{idempotency_key}")
    if not record:
        return None
    if record["expires_at"] <= time.time():
        docx_idempotency.pop(f"{job_type}:{idempotency_key}", None)
        return None
    return record["job_id"]

async def _push_dead_letter(job: Dict[str, Any]) -> None:
    item = {
        "job_id": job["job_id"],
        "job_type": job["job_type"],
        "attempts": job.get("attempts", 0),
        "error": job.get("error"),
        "updated_at": job.get("updated_at"),
    }
    if redis_client:
        await redis_client.rpush(DOCX_REDIS_DEAD_LETTER_KEY, json.dumps(item))
        await redis_client.ltrim(DOCX_REDIS_DEAD_LETTER_KEY, -500, -1)
        return
    docx_dead_letter.append(item)
    if len(docx_dead_letter) > 500:
        del docx_dead_letter[:-500]

async def _docx_worker(queue: Optional[asyncio.Queue]):
    while True:
        job_ref = await _pull_queue_message(queue)
        if not job_ref:
            continue

        job_id = job_ref["job_id"]
        job = await _load_job(job_id)
        if not job:
            if queue and not redis_client:
                queue.task_done()
            continue

        attempts = int(job.get("attempts", 0)) + 1
        job["attempts"] = attempts
        job["status"] = "processing"
        job["updated_at"] = time.time()
        await _save_job(job)

        try:
            payload = job["payload"]
            if job["job_type"] == "start-protocol":
                result_bytes = generate_start_protocol(payload["competition"], payload["events"])
            elif job["job_type"] == "result-protocol":
                result_bytes = generate_result_protocol(payload["competition"], payload["events"])
            else:
                raise ValueError("Unsupported job type")

            job["status"] = "completed"
            job["error"] = None
            job["result_bytes"] = result_bytes
            job["updated_at"] = time.time()
            await _save_job(job)
        except Exception as error:
            logger.error(
                "docx_job_failed job_id=%s job_type=%s error_type=%s attempt=%s/%s",
                job_id,
                job["job_type"],
                type(error).__name__,
                attempts,
                DOCX_JOB_MAX_RETRIES,
            )
            job["error"] = "DOCX_GENERATION_FAILED"
            job["updated_at"] = time.time()
            if attempts < DOCX_JOB_MAX_RETRIES:
                job["status"] = "queued"
                await _save_job(job)
                await _enqueue_queue_message(job_id, job["job_type"])
            else:
                job["status"] = "failed"
                await _save_job(job)
                await _push_dead_letter(job)
        finally:
            if queue and not redis_client:
                queue.task_done()

async def _enqueue_docx_job(job_type: str, payload: Dict[str, Any], idempotency_key: Optional[str]) -> Dict[str, str]:
    _cleanup_expired_jobs()
    existing_job_id = await _resolve_idempotency(job_type, idempotency_key)
    if existing_job_id:
        existing_job = await _load_job(existing_job_id)
        if existing_job:
            return {"job_id": existing_job_id, "status": existing_job["status"]}

    job_id = uuid4().hex
    now = time.time()
    job = {
        "job_id": job_id,
        "status": "queued",
        "job_type": job_type,
        "payload": payload,
        "attempts": 0,
        "error": None,
        "result_bytes": None,
        "created_at": now,
        "updated_at": now,
    }
    await _save_job(job)
    if idempotency_key:
        await _register_idempotency(job_type, idempotency_key, job_id)
    await _enqueue_queue_message(job_id, job_type)
    return {"job_id": job_id, "status": "queued"}

@app.post("/jobs/start-protocol", response_model=DocxJobSubmitResponse)
async def enqueue_start_protocol(req: StartProtocolRequest):
    payload = {
        "competition": req.competition,
        "events": [dump_model(e) for e in req.events],
    }
    queued = await _enqueue_docx_job("start-protocol", payload, req.idempotency_key)
    return queued

@app.post("/jobs/result-protocol", response_model=DocxJobSubmitResponse)
async def enqueue_result_protocol(req: ResultProtocolRequest):
    payload = {
        "competition": req.competition,
        "events": [dump_model(e) for e in req.events],
    }
    queued = await _enqueue_docx_job("result-protocol", payload, req.idempotency_key)
    return queued

@app.get("/jobs/{job_id}", response_model=DocxJobStatusResponse)
async def get_job_status(job_id: str):
    _cleanup_expired_jobs()
    job = await _load_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return {
        "job_id": job_id,
        "status": job["status"],
        "error": job["error"],
    }

@app.get("/jobs/{job_id}/download")
async def download_job_result(job_id: str):
    _cleanup_expired_jobs()
    job = await _load_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job["status"] == "failed":
        raise HTTPException(409, "Job failed")
    if job["status"] != "completed" or not job.get("result_bytes"):
        raise HTTPException(409, "Job is not completed yet")
    filename = "start_protocol.docx" if job["job_type"] == "start-protocol" else "result_protocol.docx"
    return Response(
        content=job["result_bytes"],
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@app.get("/jobs/dead-letter")
async def get_dead_letter():
    if redis_client:
        raw_items = await redis_client.lrange(DOCX_REDIS_DEAD_LETTER_KEY, -50, -1)
        items = []
        for raw in raw_items:
            payload = raw.decode() if isinstance(raw, bytes) else raw
            items.append(json.loads(payload))
        return items
    return docx_dead_letter[-50:]


# ─── PDF Conversion ────────────────────────────────────────────────────────

@app.post("/convert-pdf")
async def convert_to_pdf(file: UploadFile = File(...)):
    """Convert .docx to PDF via LibreOffice (if available)."""
    filename = (file.filename or '').lower()
    if not filename.endswith('.docx'):
        raise HTTPException(400, "Only .docx files are supported")

    content = await file.read()

    with tempfile.TemporaryDirectory() as tmpdir:
        docx_path = os.path.join(tmpdir, "document.docx")
        with open(docx_path, 'wb') as f:
            f.write(content)

        # Try LibreOffice conversion
        try:
            process = await asyncio.create_subprocess_exec(
                'soffice', '--headless', '--convert-to', 'pdf', '--outdir', tmpdir, docx_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30.0)
            except asyncio.TimeoutError:
                try:
                    process.kill()
                    await process.communicate()
                except Exception:
                    pass
                raise HTTPException(500, "LibreOffice conversion timed out")
            
            if process.returncode != 0:
                logger.error(
                    "pdf_conversion_failed endpoint=%s reason=%s stderr=%s",
                    "/convert-pdf",
                    "libreoffice_non_zero_exit",
                    stderr.decode(errors="ignore")[:500],
                )
                raise HTTPException(500, "Failed to convert document to PDF")
        except FileNotFoundError:
            raise HTTPException(
                501,
                "LibreOffice not installed. Install it for PDF conversion, "
                "or use @react-pdf/renderer on frontend."
            )

        pdf_path = os.path.join(tmpdir, "document.pdf")
        if not os.path.exists(pdf_path):
            raise HTTPException(500, "PDF file not generated")

        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="document.pdf"'}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)
