"""
Email Notification Service for TradeShift
Sends transactional emails for: signup, login, PIN events, trade events.
All functions are designed to be called via BackgroundTasks (non-blocking).
"""
import logging
from fastapi_mail import FastMail, MessageSchema, MessageType
from app.config import conf

logger = logging.getLogger(__name__)

# ── Brand colours (matching frontend) ──────────────────────────────────────
PRIMARY = "#2962FF"
BG_DARK = "#1E222D"
TEXT_LIGHT = "#9598A1"
# ───────────────────────────────────────────────────────────────────────────

def _html_wrapper(title: str, content: str) -> str:
    """Wrap email content in a branded HTML template."""
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#0B0E11;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B0E11;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:{BG_DARK};border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,{PRIMARY} 0%,#1565C0 100%);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
              Trade<span style="opacity:0.7;">Shift</span>
            </h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;letter-spacing:2px;text-transform:uppercase;">{title}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            {content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:rgba(0,0,0,0.3);padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;color:{TEXT_LIGHT};font-size:12px;">© 2025 TradeShift. All rights reserved.</p>
            <p style="margin:6px 0 0;color:{TEXT_LIGHT};font-size:11px;">This is an automated notification — please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

def _text(text: str, size: int = 15, color: str = "#C4C4C4") -> str:
    return f'<p style="margin:0 0 16px;color:{color};font-size:{size}px;line-height:1.6;">{text}</p>'

def _heading(text: str) -> str:
    return f'<h2 style="margin:0 0 20px;color:#fff;font-size:22px;font-weight:700;">{text}</h2>'

def _badge(text: str, color: str = PRIMARY) -> str:
    return f'<span style="background:{color};color:#fff;padding:5px 14px;border-radius:50px;font-size:12px;font-weight:700;letter-spacing:0.5px;">{text}</span>'

def _divider() -> str:
    return '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;"/>'

def _info_row(label: str, value: str) -> str:
    return f"""
    <tr>
      <td style="padding:10px 0;color:{TEXT_LIGHT};font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06);">{label}</td>
      <td style="padding:10px 0;color:#fff;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);">{value}</td>
    </tr>"""

def _info_table(rows: list[tuple[str, str]]) -> str:
    inner = "".join(_info_row(l, v) for l, v in rows)
    return f'<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">{inner}</table>'

def _cta_button(text: str, href: str = "http://localhost:5173") -> str:
    return f"""
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="{href}" style="background:{PRIMARY};color:#fff;padding:14px 36px;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;display:inline-block;letter-spacing:0.3px;">{text}</a>
    </div>"""

# ── Async email sender ──────────────────────────────────────────────────────
async def _send(to_email: str, subject: str, html: str):
    try:
        message = MessageSchema(
            subject=subject,
            recipients=[to_email],
            body=html,
            subtype=MessageType.html,
        )
        fm = FastMail(conf)
        await fm.send_message(message)
        logger.info(f"✅ Email sent to {to_email}: {subject}")
    except Exception as e:
        logger.warning(f"❌ Failed to send email to {to_email}: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# 1.  WELCOME EMAIL  (on signup)
# ═══════════════════════════════════════════════════════════════════════════
async def send_welcome_email(email: str, name: str, demat_id: str):
    first = name.split()[0] if name else "Trader"
    content = f"""
    {_heading(f"Welcome aboard, {first}!")}
    {_text("Your TradeShift account has been successfully created. You are now part of an AI-powered trading simulation platform.")}
    
    <div style="background:rgba(41,98,255,0.05); border:1px solid rgba(41,98,255,0.1); border-radius:8px; padding:14px; margin:24px 0; text-align:center;">
      <span style="color:#9598A1; font-size:13px; vertical-align:middle;">Demat Account ID:</span>
      <span style="color:{PRIMARY}; font-size:18px; font-weight:800; letter-spacing:1px; font-family:monospace; margin-left:10px; vertical-align:middle;">{demat_id}</span>
    </div>
    
    {_divider()}
    {_text("Here's what you can do:", 13, TEXT_LIGHT)}
    <ul style="color:#C4C4C4;font-size:14px;line-height:2;padding-left:20px;margin:0 0 20px;">
      <li>[&#8226;] Simulate real-time stock trading with live market data</li>
      <li>[&#8226;] Get AI-powered market analysis and insights</li>
      <li>[&#8226;] Track your portfolio performance and trade history</li>
      <li>[&#8226;] Build your trading skills without any financial risk</li>
    </ul>
    {_cta_button("Start Trading Now")}
    """
    await _send(email, "Welcome to TradeShift — Your Account is Ready!", _html_wrapper("Welcome", content))


# ═══════════════════════════════════════════════════════════════════════════
# 2.  LOGIN ALERT  (on login)
# ═══════════════════════════════════════════════════════════════════════════
async def send_login_alert_email(email: str, name: str, login_time: str, ip_address: str = "Unknown"):
    first = name.split()[0] if name else "Trader"
    content = f"""
    {_heading("Successfully Logged In")}
    {_text(f"Hi {first}, you have successfully logged in to TradeShift.")}
    {_divider()}
    {_info_table([
        ("Website", "TradeShift"),
        ("Account", email),
        ("Login Time", login_time),
        ("IP Address", ip_address),
        ("Verified At", login_time),
    ])}
    """
    await _send(email, "New Login to Your TradeShift Account", _html_wrapper("Login Alert", content))


# ═══════════════════════════════════════════════════════════════════════════
# 3.  PIN CREATED  (on successful PIN creation)
# ═══════════════════════════════════════════════════════════════════════════
async def send_pin_created_email(email: str, name: str):
    first = name.split()[0] if name else "Trader"
    content = f"""
    {_heading("Security PIN Created")}
    {_text(f"Hi {first}, you have successfully set up your 4-digit Security PIN for TradeShift.")}
    {_divider()}
    {_text("This PIN is required for every login to ensure your account remains secure. Never share this PIN with anyone.")}
    {_cta_button("Go to Dashboard")}
    """
    await _send(email, "Your TradeShift Security PIN is Ready!", _html_wrapper("PIN Created", content))


# ═══════════════════════════════════════════════════════════════════════════
# 4.  FORGOT PASSWORD OTP
# ═══════════════════════════════════════════════════════════════════════════
async def send_otp_email(email: str, name: str, otp_code: str):
    first = name.split()[0] if name else "Trader"
    content = f"""
    {_heading("Password Reset Requested")}
    {_text(f"Hi {first}, we received a request to reset your password. Use the following 6-digit verification code to proceed:")}
    <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
      <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:{PRIMARY};">{otp_code}</span>
    </div>
    {_text("This code will expire in 10 minutes. If you did not request this, please ignore this email.")}
    """
    await _send(email, f"{otp_code} is your TradeShift verification code", _html_wrapper("Reset Password", content))


# ═══════════════════════════════════════════════════════════════════════════
# 5.  PASSWORD RESET SUCCESS
# ═══════════════════════════════════════════════════════════════════════════
async def send_password_reset_success_email(email: str, name: str):
    first = name.split()[0] if name else "Trader"
    content = f"""
    {_heading("Password Changed Successfully")}
    {_text(f"Hi {first}, your TradeShift account password has been successfully updated.")}
    {_divider()}
    {_text("If you did not make this change, please contact support or reset your password immediately.")}
    {_cta_button("Login to Your Account")}
    """
    await _send(email, "Your TradeShift Password Has Been Changed", _html_wrapper("Password Reset Success", content))


# ═══════════════════════════════════════════════════════════════════════════
# 6.  PIN VERIFIED  (on successful PIN check)
# ═══════════════════════════════════════════════════════════════════════════
async def send_pin_verified_email(email: str, name: str, verified_at: str):
    first = name.split()[0] if name else "Trader"
    content = f"""
    {_heading("Identity Verified")}
    {_text(f"Hi {first}, your Security PIN was successfully verified and your session is now active.")}
    {_divider()}
    {_info_table([
        ("Account", email),
        ("Verified At", verified_at),
        ("Session Status", "[ACTIVE]"),
    ])}
    {_text("If you did not just verify your PIN, please reset it immediately to protect your account.", 13, "#FF6B6B")}
    {_cta_button("Go to Dashboard")}
    """
    await _send(email, "Login Successful — TradeShift", _html_wrapper("Login Success", content))


# ═══════════════════════════════════════════════════════════════════════════
# 4.  PIN RESET  (on successful PIN reset)
# ═══════════════════════════════════════════════════════════════════════════
async def send_pin_reset_email(email: str, name: str, reset_at: str):
    first = name.split()[0] if name else "Trader"
    content = f"""
    {_heading("Security PIN Changed")}
    {_text(f"Hi {first}, your Security PIN has been successfully reset.")}
    {_divider()}
    {_info_table([
        ("Account", email),
        ("Reset At", reset_at),
        ("Status", "[SUCCESS] New PIN Active"),
    ])}
    {_text("If you did not request this change, your account may be compromised. Please contact support immediately.", 13, "#FF6B6B")}
    {_cta_button("Go to Login")}
    """
    await _send(email, "Your TradeShift Security PIN Has Been Changed", _html_wrapper("PIN Reset", content))


# ═══════════════════════════════════════════════════════════════════════════
# 5.  TRADE EXECUTED  (on buy/sell order)
# ═══════════════════════════════════════════════════════════════════════════
async def send_trade_confirmation_email(
    email: str,
    name: str,
    trade_id: int,
    symbol: str,
    direction: str,
    quantity: float,
    entry_price: float,
    order_type: str,
    executed_at: str,
    stop_loss: float | None = None,
    take_profit: float | None = None,
    demat_id: str | None = None,
):
    first = name.split()[0] if name else "Trader"
    direction_color = "#26A69A" if direction.upper() == "BUY" else "#EF5350"
    direction_icon = "<span style='color:#26A69A'>&#9650;</span>" if direction.upper() == "BUY" else "<span style='color:#EF5350'>&#9660;</span>"
    total_value = quantity * entry_price
    rows = [
        ("Trade ID", f"#{trade_id}"),
        ("Company / Symbol", symbol),
        ("Action", f"{direction_icon} {direction.upper()}"),
        ("Quantity", f"{quantity:,.0f} units"),
        ("Price per Unit", f"Rs {entry_price:,.2f}"),
        ("Total Value", f"Rs {total_value:,.2f}"),
        ("Order Type", order_type),
        ("Executed At", executed_at),
        ("Demat Account ID", demat_id or "Not linked"),
    ]
    if stop_loss:
        rows.append(("Stop Loss", f"Rs {stop_loss:,.2f}"))
    if take_profit:
        rows.append(("Take Profit", f"Rs {take_profit:,.2f}"))

    content = f"""
    {_heading(f"Trade Executed {direction_icon}")}
    <div style="text-align:center;margin-bottom:24px;">
      {_badge(f"{direction.upper()} &middot; {symbol}", direction_color)}
    </div>
    {_text(f"Hi {first}, your {direction.upper()} order for <strong style='color:#fff'>{symbol}</strong> has been executed successfully.")}
    {_divider()}
    {_info_table(rows)}
    <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; margin:16px 0; text-align:center;">
      <span style="color:#9598A1; font-size:13px; vertical-align:middle;">Linked Demat Account:</span>
      <span style="color:#fff; font-size:14px; font-weight:700; font-family:monospace; margin-left:10px; vertical-align:middle; letter-spacing:1px;">{demat_id or 'Not linked'}</span>
    </div>
    {_text("Keep an eye on your position in the trading dashboard.", 13, TEXT_LIGHT)}
    {_cta_button("View Open Positions")}
    """
    await _send(email, f"Trade Confirmed: {direction.upper()} {symbol} - TradeShift", _html_wrapper("Trade Confirmation", content))


# ═══════════════════════════════════════════════════════════════════════════
# 6.  TRADE CLOSED  (on exit)
# ═══════════════════════════════════════════════════════════════════════════
async def send_trade_closed_email(
    email: str,
    name: str,
    trade_id: int,
    symbol: str,
    direction: str,
    quantity: float,
    entry_price: float,
    exit_price: float,
    pnl: float,
    closed_at: str,
    demat_id: str | None = None,
):
    first = name.split()[0] if name else "Trader"
    pnl_color = "#26A69A" if pnl >= 0 else "#EF5350"
    pnl_icon = "<span style='color:#26A69A'>&#10003;</span>" if pnl >= 0 else "<span style='color:#EF5350'>&#10005;</span>"
    pnl_label = "Profit" if pnl >= 0 else "Loss"
    total_entry_value = quantity * entry_price
    total_exit_value = quantity * exit_price
    content = f"""
    {_heading(f"Position Closed &mdash; {symbol}")}
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:36px;font-weight:900;color:{pnl_color};">{pnl_icon} Rs {abs(pnl):,.2f}</span>
      <p style="margin:4px 0 0;color:{TEXT_LIGHT};font-size:13px;">{pnl_label}</p>
    </div>
    {_text(f"Hi {first}, your {direction.upper()} position on <strong style='color:#fff'>{symbol}</strong> has been closed.")}
    {_divider()}
    {_info_table([
        ("Trade ID", f"#{trade_id}"),
        ("Company / Symbol", symbol),
        ("Direction", direction.upper()),
        ("Quantity", f"{quantity:,.0f} units"),
        ("Entry Price", f"Rs {entry_price:,.2f}"),
        ("Exit Price", f"Rs {exit_price:,.2f}"),
        ("Total Entry Value", f"Rs {total_entry_value:,.2f}"),
        ("Total Exit Value", f"Rs {total_exit_value:,.2f}"),
        (pnl_label, f"Rs {abs(pnl):,.2f}"),
        ("Closed At", closed_at),
        ("Demat Account ID", demat_id or "Not linked"),
    ])}
    <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; margin:16px 0; text-align:center;">
      <span style="color:#9598A1; font-size:13px; vertical-align:middle;">Linked Demat Account:</span>
      <span style="color:#fff; font-size:14px; font-weight:700; font-family:monospace; margin-left:10px; vertical-align:middle; letter-spacing:1px;">{demat_id or 'Not linked'}</span>
    </div>
    {_cta_button("View Trade History")}
    """
    await _send(email, f"Position Closed: {symbol} - {pnl_label} Rs {abs(pnl):,.2f}", _html_wrapper("Position Closed", content))


# ═══════════════════════════════════════════════════════════════════════════
# 7.  MARKET ALERT  (on alert triggered)
# ═══════════════════════════════════════════════════════════════════════════
async def send_price_alert_email(
    email: str,
    name: str,
    demat_id: str | None,
    symbol: str,
    condition: str,
    target_value: float,
    current_price: float,
    side: str,
    message: str
):
    first = name.split()[0] if name else "Trader"
    
    # Beautify the condition string
    condition_map = {
        "crossing": "Crossed",
        "crossing_up": "Crossed Above",
        "crossing_down": "Crossed Below",
        "greater_than": "Is Greater Than",
        "less_than": "Is Less Than"
    }
    pretty_cond = condition_map.get(condition, condition)
    
    # Color Logic based on Side
    side_color = "#26A69A" if side.upper() == "BUY" else "#EF5350"
    if side.upper() not in ["BUY", "SELL"]:
         side_color = "#f59e0b" # Fallback amber if side is just "TARGET"
         
    side_label = side.upper()
    
    content = f"""
    {_heading(f"{side_label} Alert Triggered 🎯")}
    <div style="text-align:center;margin-bottom:24px;">
      {_badge(f"{side_label} TARGET REACHED", side_color)}
    </div>
    
    {_text(f"Hi {first}, your {side_label} price target for <strong style='color:#fff'>{symbol}</strong> has been met.")}
    
    <div style="background:rgba(255,193,7,0.05); border:1px solid {side_color}; border-radius:12px; padding:20px; margin:24px 0; text-align:center;">
      <p style="margin:0 0 8px; color:#C4C4C4; font-size:14px; text-transform:uppercase; letter-spacing:1px;">Market Event</p>
      <span style="font-size:20px; font-weight:800; color:#fff;">{symbol} {pretty_cond} Rs {target_value:.2f}</span>
      <p style="margin:12px 0 0; color:{side_color}; font-size:18px; font-weight:700;">Current Price: Rs {current_price:.2f}</p>
    </div>
    
    {_info_table([
        ("Symbol", symbol),
        ("Alert Direction", side_label),
        ("Condition", pretty_cond),
        ("Target Price", f"Rs {target_value:.2f}"),
        ("Actual Trigger Price", f"Rs {current_price:.2f}"),
        ("Demat Account ID", demat_id or "Not linked"),
    ])}
    
    <div style="background:rgba(255,255,255,0.03); border-radius:8px; padding:15px; margin-bottom:24px; border-left:4px solid {side_color};">
       <p style="margin:0; color:#C4C4C4; font-size:13px; font-style:italic;">"{message or 'No message provided'}"</p>
    </div>

    {_cta_button(f"Go to {side_label} Dashboard")}
    """
    await _send(email, f"Target Hit: {symbol} at Rs {current_price:.2f}", _html_wrapper("Market Alert", content))
