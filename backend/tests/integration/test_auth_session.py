def test_auth_session_flow_persists_and_revokes_server_session(client, helpers):
    email = helpers.register_and_login(client, prefix="auth-session")

    me_response = client.get("/auth/me")
    assert me_response.status_code == 200, me_response.text
    assert me_response.json()["email"] == email

    user = helpers.run(helpers.get_user_by_email(email))
    sessions = helpers.run(helpers.get_sessions_for_user(user.id))
    assert len(sessions) == 1
    assert sessions[0].session_token == client.cookies.get("session_id")

    logout_response = client.post("/auth/logout")
    assert logout_response.status_code == 200, logout_response.text

    me_after_logout = client.get("/auth/me")
    assert me_after_logout.status_code == 401, me_after_logout.text

    sessions_after_logout = helpers.run(helpers.get_sessions_for_user(user.id))
    assert sessions_after_logout == []

    login_response = client.post("/auth/login", json={"email": email, "password": "Password123!"})
    assert login_response.status_code == 200, login_response.text
    assert login_response.json()["email"] == email
    assert client.cookies.get("session_id")

    refreshed_sessions = helpers.run(helpers.get_sessions_for_user(user.id))
    assert len(refreshed_sessions) == 1
