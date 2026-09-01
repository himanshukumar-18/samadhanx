import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.chat import ChatMessageCreate, ChatMessageResponse
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["Real-time Chat & Message Requests"])


# In-memory WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)


manager = ConnectionManager()


@router.post("/send", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    data: ChatMessageCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ChatService(db)
    msg = await service.send_message(sender=current_user, data=data)

    # Real-time WebSocket dispatch if recipient online
    recipient_id_str = str(data.recipient_id)
    if msg.is_accepted:
        await manager.send_personal_message(
            f'{{"type": "new_message", "sender": "{current_user.full_name}", "content": "{data.content}"}}',
            recipient_id_str,
        )
    else:
        await manager.send_personal_message(
            f'{{"type": "message_request", "sender": "{current_user.full_name}"}}',
            recipient_id_str,
        )

    return msg


@router.get("/thread/{other_user_id}", response_model=list[ChatMessageResponse])
async def list_chat_thread(
    other_user_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=100),
):
    service = ChatService(db)
    return await service.list_thread(current_user=current_user, other_user_id=other_user_id, limit=limit)


@router.get("/requests", response_model=list[ChatMessageResponse])
async def list_message_requests(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ChatService(db)
    return await service.list_pending_requests(current_user=current_user)


@router.post("/requests/{message_id}/accept", response_model=ChatMessageResponse)
async def accept_message_request(
    message_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = ChatService(db)
    return await service.accept_request(current_user=current_user, message_id=message_id)


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        manager.disconnect(user_id)
