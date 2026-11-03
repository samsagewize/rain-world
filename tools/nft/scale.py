# Upscale the 32x32 renders to 1024x1024 with nearest-neighbour and save as palette PNGs.
import os
from PIL import Image
RC = '/workspace/rainworld/raincats'
os.makedirs(f'{RC}/images', exist_ok=True)
n = 0
for f in os.listdir(f'{RC}/png32'):
    im = Image.open(f'{RC}/png32/{f}').convert('RGBA').resize((1024, 1024), Image.NEAREST)
    im.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(f'{RC}/images/{f}', optimize=True); n += 1
print('scaled', n)
