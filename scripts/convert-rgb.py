import sys
from PIL import Image

if len(sys.argv) < 3:
    print("Usage: convert-rgb.py <input> <output1> [output2 ...]")
    sys.exit(1)

src = sys.argv[1]
outputs = sys.argv[2:]

im = Image.open(src)
rgb = im.convert("RGB")

for out in outputs:
    if out.endswith(".jpg") or out.endswith(".jpeg"):
        rgb.save(out, "JPEG", quality=95)
    else:
        rgb.save(out, "PNG")

print(f"Saved {outputs[0]}: size={rgb.size}, mode={rgb.mode}")
