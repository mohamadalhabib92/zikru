"""Apple TV brand assets from assets/icon.png.

Home screen icon: 400×240 @1x and 800×480 @2x, front + back layers.
App Store icon: 1280×768, front + back layers.
Top Shelf: 1920×720 @1x and 3840×1440 @2x.
Top Shelf Wide: 2320×720 @1x and 4640×1440 @2x.

The back layer is an opaque dark field. The front layer is the existing mark
with the near-black ground knocked out, so tvOS can shift the layers apart.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "icon.png"
OUT = ROOT / "assets" / "tv"

INK = (20, 18, 16, 255)
GLOW = (15, 61, 48, 255)


def knockout(image: Image.Image, threshold: int = 30) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if red < threshold and green < threshold and blue < threshold:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                pixels[x, y] = (red, green, blue, alpha)
    return image


def back_layer(width: int, height: int) -> Image.Image:
    canvas = Image.new("RGBA", (width, height), INK)
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    cx, cy = width / 2, height / 2
    radius = int(min(width, height) * 0.72)
    for step in range(radius, 0, -3):
        fade = 1 - (step / radius)
        alpha = int(88 * (fade ** 1.6))
        draw.ellipse((cx - step, cy - step, cx + step, cy + step), fill=(*GLOW[:3], alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(8, min(width, height) // 40)))
    return Image.alpha_composite(canvas, glow).convert("RGB")


def fit_mark(mark: Image.Image, width: int, height: int, height_frac: float, width_frac: float) -> Image.Image:
    scale = min((height * height_frac) / mark.height, (width * width_frac) / mark.width)
    resized = mark.resize((max(1, int(mark.width * scale)), max(1, int(mark.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.paste(resized, ((width - resized.width) // 2, (height - resized.height) // 2), resized)
    return canvas


def shelf(mark: Image.Image, width: int, height: int) -> Image.Image:
    base = back_layer(width, height).convert("RGBA")
    emblem = fit_mark(mark, width, height, 0.72, 0.42)
    return Image.alpha_composite(base, emblem).convert("RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    mark = knockout(Image.open(SRC))
    jobs = {
        "icon-home-back.png": lambda: back_layer(400, 240),
        "icon-home-back@2x.png": lambda: back_layer(800, 480),
        "icon-home-front.png": lambda: fit_mark(mark, 400, 240, 0.78, 0.7),
        "icon-home-front@2x.png": lambda: fit_mark(mark, 800, 480, 0.78, 0.7),
        "icon-store-back.png": lambda: back_layer(1280, 768),
        "icon-store-front.png": lambda: fit_mark(mark, 1280, 768, 0.78, 0.7),
        "top-shelf.png": lambda: shelf(mark, 1920, 720),
        "top-shelf@2x.png": lambda: shelf(mark, 3840, 1440),
        "top-shelf-wide.png": lambda: shelf(mark, 2320, 720),
        "top-shelf-wide@2x.png": lambda: shelf(mark, 4640, 1440),
    }
    for name, draw in jobs.items():
        image = draw()
        image.save(OUT / name, "PNG", optimize=True)
        print(f"{name} {image.size} {image.mode}")


if __name__ == "__main__":
    main()
