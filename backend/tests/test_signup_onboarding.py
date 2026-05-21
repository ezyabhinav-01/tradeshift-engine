import time

from app.models import User


def _signup_payload(email: str) -> dict:
    return {
        "email": email,
        "password": "Password123!",
        "full_name": "New Tutorial User",
        "dob": "2000-01-01",
        "phone_number": "+91 99999 12345",
        "experience_level": "Beginner",
        "investment_goals": "Learn",
        "preferred_instruments": "Equity",
        "risk_tolerance": "Moderate",
        "occupation": "Student",
        "city": "Bengaluru",
        "how_heard_about": "Testing",
    }


def test_signup_request_generates_otp_and_queues_email(client, helpers, monkeypatch):
    sent = []

    async def fake_send_signup_otp_email(email: str, otp: str, **kwargs):
        sent.append((email, otp))

    monkeypatch.setattr("app.auth.send_signup_otp_email", fake_send_signup_otp_email)

    email = "signup-otp@example.com"
    response = client.post("/auth/register/request", json=_signup_payload(email))

    assert response.status_code == 200, response.text
    user = helpers.run(helpers.fetch_user(email))
    assert user is not None
    assert user.otp_code is not None
    assert len(user.otp_code) == 6
    assert user.otp_expiry is not None

    deadline = time.time() + 2
    while time.time() < deadline and not sent:
        time.sleep(0.05)

    assert sent == [(email, user.otp_code)]


def test_new_signup_response_has_tutorial_bootstrap_fields(client, helpers):
    email = "signup-onboarding@example.com"
    response = client.post("/auth/register/request", json=_signup_payload(email))
    assert response.status_code == 200, response.text

    user = helpers.run(helpers.fetch_user(email))
    verify_response = client.post(
        "/auth/register/verify",
        json={"email": email, "otp_code": user.otp_code},
    )
    assert verify_response.status_code == 200, verify_response.text

    pin_response = client.post("/auth/register/set-pin", json={"email": email, "pin": "1234"})
    assert pin_response.status_code == 200, pin_response.text

    payload = pin_response.json()
    assert payload["created_at"]
    assert payload.get("onboarding_status") in ({}, None)
    assert payload["email"] == email

    refreshed_user = helpers.run(helpers.fetch_model(User, User.email == email))[0]
    assert refreshed_user.is_verified is True
    assert refreshed_user.security_pin is not None
