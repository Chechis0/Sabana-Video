# Hoja de contactos: python3 film/sheet.py salida.jpg ancho t1.png t2.png ...
import sys
from PIL import Image, ImageDraw
out, w, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
h = w * 16 // 9
cols = min(len(files), 6)
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, (h + 22) * rows), 'white')
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((w, h))
    x, y = (i % cols) * w, (i // cols) * (h + 22)
    sheet.paste(im, (x, y + 22))
    d.text((x + 4, y + 4), f.split('/')[-1], fill='black')
sheet.save(out, quality=90)
