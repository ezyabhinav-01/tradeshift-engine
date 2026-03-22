import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    model_name: str = "gemini-2.5-flash"
    device: str = "auto"
    vector_db_path: str = "./chroma_db"
    
    class Config:
        env_file = ".env"
        extra = "ignore"

config = Settings()
