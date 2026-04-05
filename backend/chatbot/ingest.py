import os
import json
import chromadb
import asyncio

# Need to run this as a standalone script or module
try:
    from config import config
    from app.utils.gemini_pool import gemini_pool
except ImportError:
    from .config import config
    from app.utils.gemini_pool import gemini_pool

def ingest_data():
    # Initialize ChromaDB persistent client
    # Resolve absolute path to ensure DB doesn't scatter
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(base_dir, config.vector_db_path.lstrip("./"))
    
    print(f"Initializing ChromaDB at: {db_path}")
    client = chromadb.PersistentClient(path=db_path)
    
    # Create or get the collection
    collection = client.get_or_create_collection(name="trade_knowledge")
    
    # NEW: Clear old data to ensure a "Clean Sync" (prevents 'ghost' memory from removed articles)
    print("Cleaning old embeddings for a fresh sync...")
    collection.delete(where={})
    
    print("TradeGuide Ingest: Using Gemini Cloud Embeddings (text-embedding-004)...")
    
    data_dir = os.path.join(base_dir, "data")
    files = ["learn_articles.json", "platform_docs.json"]
    
    documents = []
    metadatas = []
    ids = []
    
    for filename in files:
        filepath = os.path.join(data_dir, filename)
        if not os.path.exists(filepath):
            print(f"Warning: {filepath} not found.")
            continue
            
        with open(filepath, 'r', encoding='utf-8') as f:
            items = json.load(f)
            
        for idx, item in enumerate(items):
            content = item.get("content", "")
            if not content:
                continue
                
            doc_id = f"{filename.split('.')[0]}_{idx}"
            
            documents.append(content)
            # Store metadata for citation / reference passing
            metadatas.append({
                "title": item.get("title", "Unknown"),
                "url": item.get("url", ""),
                "type": filename.replace(".json", "")
            })
            ids.append(doc_id)
            
    if documents:
        print(f"Generating embeddings for {len(documents)} documents via Gemini API...")
        # Encode all documents into vectors using Gemini Cloud API
        embeddings = asyncio.run(gemini_pool.get_embeddings_async(documents))
        
        print("Upserting vectors into ChromaDB...")
        collection.upsert(
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        print(f"Successfully ingested {len(documents)} documents into '{db_path}'.")
    else:
        print("No documents found to ingest.")

if __name__ == "__main__":
    ingest_data()
