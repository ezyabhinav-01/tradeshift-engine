# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Ensure data directory exists
RUN mkdir -p /app/data

# Copy the requirements file into the container
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Run the application with Gunicorn + Uvicorn workers
CMD ["sh", "-c", "gunicorn main:app -k uvicorn.workers.UvicornWorker -w 1 -b 0.0.0.0:${PORT:-8000} --timeout 300"]
