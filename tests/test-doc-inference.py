from PIL import Image, ImageDraw
import urllib.request, json

# Create a synthetic document image with black text on white background
img = Image.new('RGB', (400, 300), color=(255, 255, 255))
d = ImageDraw.Draw(img)
d.text((20, 20), "INVOICE & RECEIPT #1094\nDate: 2026-10-22\nTotal Paid: $142.50\nStudy Notes & Calculus Lecture Notes", fill=(0, 0, 0))
img.save('test_doc.png')

boundary = '----FormBoundary123'
with open('test_doc.png', 'rb') as f:
    data = f.read()

header = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="test_doc.png"\r\nContent-Type: image/png\r\n\r\n'.encode('utf-8')
footer = f'\r\n--{boundary}--\r\n'.encode('utf-8')
payload = header + data + footer

req = urllib.request.Request('http://localhost:5001/classify', data=payload)
req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')

with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    print('Document classification result:\n', json.dumps(res, indent=2))
