"""Dérive les icônes à partir de assets/icon.png (logo validé, ne pas redessiner l’arabe).

Le fichier source est le carré plein, sans transparence. iOS applique son masque arrondi.
Android et l’icône maskable gardent le dessin entier dans la zone sûre centrale (66 %).
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "icon.png")
BG = (24, 24, 24)  # #181818
SAFE = 0.66
CANVAS = 1024


def load_source():
    im = Image.open(SRC).convert("RGB")
    if im.size != (CANVAS, CANVAS):
        im = im.resize((CANVAS, CANVAS), Image.Resampling.LANCZOS)
    return im


def content_box(im):
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if max(abs(r - BG[0]), abs(g - BG[1]), abs(b - BG[2])) > 12:
                minx, miny = min(minx, x), min(miny, y)
                maxx, maxy = max(maxx, x), max(maxy, y)
    return minx, miny, maxx + 1, maxy + 1


def fit_safe(im):
    """Dessin entier dans le carré central de 66 %, fond transparent autour."""
    x0, y0, x1, y1 = content_box(im)
    crop = im.crop((x0, y0, x1, y1))
    # Un peu à l’intérieur du cercle de 66 % : le bout de l’alif et les perles du bas ne sont pas coupés.
    side = int(round(CANVAS * SAFE)) - 28
    scale = side / max(crop.size)
    nw, nh = max(1, int(round(crop.size[0] * scale))), max(1, int(round(crop.size[1] * scale)))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(resized, ((CANVAS - nw) // 2, (CANVAS - nh) // 2))
    # Le fond charbon du dessin devient transparent : la couleur de fond Android le remplace.
    px = out.load()
    for y in range(CANVAS):
        for x in range(CANVAS):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if max(abs(r - BG[0]), abs(g - BG[1]), abs(b - BG[2])) <= 14:
                px[x, y] = (0, 0, 0, 0)
    return out


def monochrome(foreground):
    out = Image.new("RGBA", foreground.size, (0, 0, 0, 0))
    src, dst = foreground.load(), out.load()
    w, h = foreground.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            if a:
                dst[x, y] = (255, 255, 255, a)
    return out


def save_rgb(im, path):
    im.convert("RGB").save(path, "PNG", optimize=True)


def main():
    src = load_source()
    # iOS : le fichier source, sans couche alpha.
    save_rgb(src, os.path.join(ROOT, "assets", "icon.png"))
    save_rgb(src, os.path.join(ROOT, "assets", "splash-icon.png"))
    fg = fit_safe(src)
    fg.save(os.path.join(ROOT, "assets", "android-icon-foreground.png"), "PNG", optimize=True)
    Image.new("RGB", (CANVAS, CANVAS), BG).save(os.path.join(ROOT, "assets", "android-icon-background.png"), "PNG", optimize=True)
    monochrome(fg).save(os.path.join(ROOT, "assets", "android-icon-monochrome.png"), "PNG", optimize=True)
    icons = os.path.join(ROOT, "public", "icons")
    os.makedirs(icons, exist_ok=True)
    save_rgb(src.resize((48, 48), Image.Resampling.LANCZOS), os.path.join(ROOT, "assets", "favicon.png"))
    save_rgb(src.resize((192, 192), Image.Resampling.LANCZOS), os.path.join(icons, "icon-192.png"))
    save_rgb(src.resize((512, 512), Image.Resampling.LANCZOS), os.path.join(icons, "icon-512.png"))
    save_rgb(src.resize((180, 180), Image.Resampling.LANCZOS), os.path.join(icons, "apple-touch-icon.png"))
    mask = fg.resize((512, 512), Image.Resampling.LANCZOS)
    plate = Image.new("RGBA", (512, 512), BG + (255,))
    plate.alpha_composite(mask)
    save_rgb(plate, os.path.join(icons, "maskable-512.png"))
    print("icônes dérivées de assets/icon.png")


if __name__ == "__main__":
    main()
