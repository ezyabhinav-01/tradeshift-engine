import requests
import json
import pyotp
import hashlib
import os
from dotenv import load_dotenv

load_dotenv()

user_id = os.getenv('SHOONYA_USER_ID', '').strip()
password = os.getenv('SHOONYA_PASSWORD', '').strip()
vendor_code = os.getenv('SHOONYA_VENDOR_CODE', '').strip()
api_secret = os.getenv('SHOONYA_API_SECRET', '').strip()
totp_secret = os.getenv('SHOONYA_TOTP_SECRET', '').strip()
imei = 'abc1234'

totp = pyotp.TOTP(totp_secret).now()

url1 = "https://api.shoonya.com/NorenWClientTP//QuickAuth"
url2 = "https://api.shoonya.com/NorenWClientTP/QuickAuth"

pwd = hashlib.sha256(password.encode('utf-8')).hexdigest()
u_app_key = '{0}|{1}'.format(user_id, api_secret)
app_key=hashlib.sha256(u_app_key.encode('utf-8')).hexdigest()

values = { "source": "API" , "apkversion": "1.0.0"}
values["uid"] = user_id
values["pwd"] = pwd
values["factor2"] = totp
values["vc"] = vendor_code
values["appkey"] = app_key        
values["imei"] = imei    

payload = 'jData=' + json.dumps(values)

print("Test URL 1:", url1)
res1 = requests.post(url1, data=payload)
print("Reply 1:", res1.text[:100])

print("Test URL 2:", url2)
res2 = requests.post(url2, data=payload)
print("Reply 2:", res2.text[:100])

