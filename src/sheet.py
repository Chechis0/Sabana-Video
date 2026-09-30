# Hoja de contactos de cuadros de revisión: python3 src/sheet.py salida.png t1.png t2.png ...
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).resize((360, 640)) for f in files]
sheet = Image.new('RGB', (360 * len(ims), 640), 'white')
for i, im in enumerate(ims):
    sheet.paste(im, (i * 360, 0))
sheet.save(out)
