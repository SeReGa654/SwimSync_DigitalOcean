FROM python:3.11-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY docx-service/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY docx-service .
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 3012
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3012"]
