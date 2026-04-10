# Contributing to Tradeshift Engine

This guide ensures that all contributors (macOS and Windows) can run the project smoothly using Docker.

## 🚀 One-Minute Setup

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/Ritsham/tradeshift-engine.git
    cd tradeshift-engine
    ```

2.  **Environment Variables**:
    Teammates **MUST** create a `.env` file in the `backend/` directory.
    ```bash
    cp backend/.env.example backend/.env
    ```
    > [!IMPORTANT]
    > Ask the project owner for the actual `HUGGINGFACE_API_KEY` and `GEMINI_API_KEY`. Without these, the AI Analysis and Charting features will show 401 errors.

3.  **Run with Docker (Mandatory for Windows)**:
    Windows users should always use Docker to avoid issues with native C++ bindings in libraries like `psycopg2` or charting tools.
    ```bash
    docker compose up --build -d
    ```

---

## 🛠️ Dependency Management

### Backend (Python)
All backend dependencies are listed in `backend/requirements.txt`.
*   **Do NOT** add frontend libraries (like `@pipsend/charts`) here.
*   The `docker-compose` build handles the `pip install` automatically.

### Frontend (Node.js / React)
All frontend dependencies are in `frontend/package.json`.
*   **@pipsend/charts**: This is a frontend-only charting library.
*   If you see "Module not found" errors, ensure you are running inside the Docker container or have run `npm install` in the `frontend` directory.

---

## 🪟 Windows Specific Tips

*   **Docker Desktop**: Ensure Docker Desktop is running and set to use **WSL 2 backend**.
*   **Line Endings**: If you get "File not found" errors inside Docker for scripts, ensure your Git is NOT converting `LF` to `CRLF`. (Run `git config core.autocrlf input`).
*   **Ports**: 
    *   Backend: `http://localhost:8000`
    *   Frontend: `http://localhost:5173`
    *   Database: `localhost:5433` (mapped from 5432)
