import base64
import os
import re

sig_path = r'C:\Users\HAROON TRADERS\.gemini\antigravity\brain\e717bd9b-f6ef-4e77-bfc9-172398581fc4\media__1775177859741.jpg'
html_path = r'c:\xampp\htdocs\Result sheet\index.html'

with open(sig_path, 'rb') as f:
    b64_data = f.read()

# Encode the jpg
b64 = base64.b64encode(b64_data).decode('utf-8')
data_uri = f"'data:image/jpeg;base64,{b64}'"

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Use regex to find whatever old base64 is currently hardcoded and replace it.
html = re.sub(
    r"const tSig = 'data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+';",
    f"const tSig = {data_uri};",
    html
)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Found the real signature and injected it successfully.")
