import asyncio
import signal

from main import app, on_shutdown, on_startup


async def run_worker() -> None:
    await on_startup()
    worker_task = getattr(app.state, "docx_worker_task", None)
    if not worker_task:
        raise RuntimeError("DOCX worker is disabled. Set DOCX_INTERNAL_WORKER=true for worker process.")

    stop_event = asyncio.Event()

    def _stop_handler(*_args):
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _stop_handler)
        except NotImplementedError:
            pass

    wait_task = asyncio.create_task(stop_event.wait())
    done, _ = await asyncio.wait({worker_task, wait_task}, return_when=asyncio.FIRST_COMPLETED)

    if worker_task in done and worker_task.exception():
        raise worker_task.exception()

    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    await on_shutdown()


if __name__ == "__main__":
    asyncio.run(run_worker())
