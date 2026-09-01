import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.enums import UserRole
from app.models.user import User


@pytest.mark.asyncio
async def test_chat_follow_logic_and_message_requests(async_client: AsyncClient, db_session: AsyncSession):
    sender = User(
        email="sender_chat@samadhanx.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.STUDENT,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    recipient = User(
        email="recipient_chat@samadhanx.in",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.FACULTY,
        is_verified=True,
        is_active=True,
        is_approved=True,
    )
    db_session.add(sender)
    db_session.add(recipient)
    await db_session.flush()

    sender_token = create_access_token(sender.id, sender.role.value)
    recipient_token = create_access_token(recipient.id, recipient.role.value)

    headers_sender = {"Authorization": f"Bearer {sender_token}"}
    headers_recipient = {"Authorization": f"Bearer {recipient_token}"}

    # 1. Non-following user sends message -> Goes to Message Requests inbox (is_accepted = False)
    msg_res1 = await async_client.post(
        "/api/v1/chat/send",
        json={"recipient_id": str(recipient.id), "content": "Hello Professor, I would like to request mentorship."},
        headers=headers_sender,
    )
    assert msg_res1.status_code == 201
    msg1_data = msg_res1.json()
    assert msg1_data["is_accepted"] is False
    message_id = msg1_data["id"]

    # 2. Recipient views pending message requests
    req_res = await async_client.get("/api/v1/chat/requests", headers=headers_recipient)
    assert req_res.status_code == 200
    requests = req_res.json()
    assert len(requests) == 1
    assert requests[0]["id"] == message_id

    # 3. Recipient accepts message request
    accept_res = await async_client.post(f"/api/v1/chat/requests/{message_id}/accept", headers=headers_recipient)
    assert accept_res.status_code == 200
    assert accept_res.json()["is_accepted"] is True

    # 4. Now recipient follows sender -> Subsequent messages go directly to main inbox (is_accepted = True)
    await async_client.post(f"/api/v1/social/users/{sender.id}/follow", headers=headers_recipient)

    msg_res2 = await async_client.post(
        "/api/v1/chat/send",
        json={"recipient_id": str(recipient.id), "content": "Thank you for accepting!"},
        headers=headers_sender,
    )
    assert msg_res2.status_code == 201
    assert msg_res2.json()["is_accepted"] is True
