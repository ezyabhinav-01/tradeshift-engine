from fastapi.testclient import TestClient

from app.models import CommunityMessage


def test_channel_message_reaches_other_connected_client_without_refresh(app, helpers):
    sender_client = TestClient(app)
    receiver_client = TestClient(app)

    try:
        helpers.register_and_login(sender_client, prefix="community-sender")
        helpers.register_and_login(receiver_client, prefix="community-receiver")

        channels_response = sender_client.get("/api/community/channels")
        assert channels_response.status_code == 200, channels_response.text
        channel_id = channels_response.json()[0]["id"]

        with sender_client.websocket_connect("/ws/orders") as sender_ws:
            with receiver_client.websocket_connect("/ws/orders") as receiver_ws:
                assert sender_ws.receive_json()["type"] == "connected"
                assert receiver_ws.receive_json()["type"] == "connected"

                send_response = sender_client.post(
                    "/api/community/messages",
                    json={
                        "channel_id": channel_id,
                        "content": "live channel hello",
                        "client_temp_id": -101,
                    },
                )
                assert send_response.status_code == 200, send_response.text

                receiver_event = receiver_ws.receive_json()
                assert receiver_event["type"] == "community_message"
                assert receiver_event["data"]["content"] == "live channel hello"
                assert receiver_event["data"]["channel_id"] == channel_id
    finally:
        sender_client.close()
        receiver_client.close()


def test_direct_message_reaches_recipient_without_refresh(app, helpers):
    sender_client = TestClient(app)
    receiver_client = TestClient(app)

    try:
        helpers.register_and_login(sender_client, prefix="dm-sender")
        receiver_email = helpers.register_and_login(receiver_client, prefix="dm-receiver")
        receiver = helpers.run(helpers.get_user_by_email(receiver_email))

        with receiver_client.websocket_connect("/ws/orders") as receiver_ws:
            assert receiver_ws.receive_json()["type"] == "connected"

            send_response = sender_client.post(
                "/api/community/messages",
                json={
                    "recipient_id": receiver.id,
                    "content": "live dm hello",
                    "client_temp_id": -202,
                },
            )
            assert send_response.status_code == 200, send_response.text

            receiver_event = receiver_ws.receive_json()
            assert receiver_event["type"] == "direct_message"
            assert receiver_event["data"]["content"] == "live dm hello"
            assert receiver_event["data"]["recipient_id"] == receiver.id

        rows = helpers.run(helpers.fetch_model(CommunityMessage, CommunityMessage.content == "live dm hello"))
        assert len(rows) == 1
    finally:
        sender_client.close()
        receiver_client.close()
