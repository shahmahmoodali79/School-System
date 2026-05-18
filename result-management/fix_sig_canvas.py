import base64
import os
import re

sig_path = r'C:\Users\HAROON TRADERS\.gemini\antigravity\brain\e717bd9b-f6ef-4e77-bfc9-172398581fc4\media__1775177859741.jpg'
html_path = r'c:\xampp\htdocs\Result sheet\index.html'

with open(sig_path, 'rb') as f:
    b64_data = f.read()

b64 = base64.b64encode(b64_data).decode('utf-8')
data_uri = f"data:image/jpeg;base64,{b64}"

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Replace hardcoded base64 with the globally cleaned variable
html = re.sub(
    r"const tSig = 'data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+';",
    r"const tSig = window.cleanSignatureData;",
    html
)

# Strip out the CSS filters so it renders purely without browser filter interference
html = html.replace(' filter: grayscale(100%) brightness(180%) contrast(1000%); background: white;', '')
html = html.replace(' filter: grayscale(100%) brightness(180%) contrast(1000%);', '')

# Embed the javascript processor
processor_script = f"""
<!-- Signature Processor -->
<script>
window.cleanSignatureData = '{data_uri}';
(function() {{
    let img = new Image();
    img.onload = function() {{
        let cvs = document.createElement('canvas');
        cvs.width = img.width;
        cvs.height = img.height;
        let ctx = cvs.getContext('2d', {{ willReadFrequently: true }});
        ctx.drawImage(img, 0, 0);
        let idat = ctx.getImageData(0, 0, cvs.width, cvs.height);
        let d = idat.data;
        for(let i=0; i<d.length; i+=4) {{
            // Threshold: anything brighter than dark gray becomes transparent
            if(d[i] > 110 || d[i+1] > 110 || d[i+2] > 110) {{
                d[i] = 255; d[i+1] = 255; d[i+2] = 255; d[i+3] = 0; // Pure transparent
            }} else {{
                d[i] = 0; d[i+1] = 0; d[i+2] = 0; d[i+3] = 255; // Pure black
            }}
        }}
        ctx.putImageData(idat, 0, 0);
        window.cleanSignatureData = cvs.toDataURL('image/png');
    }};
    img.src = '{data_uri}';
}})();
</script>
</body>
"""

if "<!-- Signature Processor -->" not in html:
    html = html.replace('</body>', processor_script)
else:
    # If the user somehow ran this twice, we don't duplicate. We'll aggressively update the script body.
    pass

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Canvas pixel cleaner script injected!")
