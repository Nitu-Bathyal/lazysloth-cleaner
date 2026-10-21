# LazySloth Cleaner - Gemma Vision Companion Dockerfile
# Compatible with Hugging Face Spaces, Render Web Services, and local Docker
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if required
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy companion application code
COPY companion/ ./companion/

# Configure standard environment
ENV PORT=7860
ENV HOST=0.0.0.0
ENV PYTHONUNBUFFERED=1

EXPOSE 7860

# Run Gemma companion service
CMD ["python", "companion/gemma_companion.py", "--host", "0.0.0.0"]
