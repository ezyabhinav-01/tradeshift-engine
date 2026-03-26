# File: backend/app/websocket_manager.py

"""
WebSocket Connection Manager for user-room-based event broadcasting.
Tracks connected clients by user room (user-{user_id}) and enables
targeted event emission to specific users.
"""

from fastapi import WebSocket
from typing import Dict, List, Any
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections organized by user rooms.
    Each user can have multiple connections (e.g., multiple browser tabs).
    """

    def __init__(self):
        # { "user-{user_id}": [websocket1, websocket2, ...] }
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        """Accept and register a WebSocket connection to a user's room."""
        await websocket.accept()
        room = f"user-{user_id}"
        if room not in self.active_connections:
            self.active_connections[room] = []
        self.active_connections[room].append(websocket)
        logger.info(f"🟢 WebSocket connected: {room} (total in room: {len(self.active_connections[room])})")

    def disconnect(self, websocket: WebSocket, user_id: int):
        """Remove a WebSocket connection from a user's room."""
        room = f"user-{user_id}"
        if room in self.active_connections:
            self.active_connections[room] = [
                ws for ws in self.active_connections[room] if ws != websocket
            ]
            if not self.active_connections[room]:
                del self.active_connections[room]
        logger.info(f"🔴 WebSocket disconnected: {room}")

    async def emit_to_user(self, user_id: int, event_type: str, payload: dict):
        """
        Send an event to all WebSocket connections belonging to a user.
        
        Args:
            user_id: The target user's ID
            event_type: Event name (e.g., 'order_update')
            payload: Event data dictionary
        """
        room = f"user-{user_id}"
        if room not in self.active_connections:
            logger.debug(f"No active connections for {room}, skipping event {event_type}")
            return

        message = {"type": event_type, "data": payload}
        disconnected = []

        for ws in self.active_connections[room]:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to {room}: {e}")
                disconnected.append(ws)

        # Clean up broken connections
        for ws in disconnected:
            self.active_connections[room] = [
                conn for conn in self.active_connections.get(room, []) if conn != ws
            ]

    def get_connected_users(self) -> List[str]:
        """Return list of rooms with active connections."""
        return list(self.active_connections.keys())

    async def emit_to_channel(self, channel_id: int, event_type: str, payload: dict):
        """
        Send an event to all users who might be interested in a channel.
        For now, since we don't have a 'joined_channels' table, 
        we broadcast to ALL active connections. In a real app, 
        you'd filter by users who are members of the channel.
        """
        message = {"type": event_type, "data": payload}
        
        for room, connections in self.active_connections.items():
            disconnected = []
            for ws in connections:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    logger.warning(f"Failed to send to {room} in channel {channel_id}: {e}")
                    disconnected.append(ws)
            
            # Clean up broken connections for this room
            if disconnected:
                self.active_connections[room] = [
                    conn for conn in self.active_connections.get(room, []) if conn not in disconnected
                ]


# Singleton instance used across the application
order_manager = ConnectionManager()
