# Images

Drop your photos in this folder, then replace the matching placeholder block in
`../index.html`. Each placeholder has an HTML comment next to it showing the
exact `<img>` tag to paste.

## What to add

| File | Used for | Crop / size | Notes |
|------|----------|-------------|-------|
| `bride-hero.jpg` | Hero portrait | 4:5, ~1200×1500 | Your strongest bridal shot. Face upper-centre so parallax doesn't clip it. |
| `look-kanjeevaram.jpg` | "Signature looks" card 1 | 3:4, ~900×1200 | Traditional silk + temple jewellery |
| `look-reception.jpg` | card 2 | 3:4 | Stage / reception look |
| `look-minimal.jpg` | card 3 | 3:4 | Soft, natural muhurtham |
| `look-airbrush.jpg` | card 4 | 3:4 | Close-up skin detail |
| `bride-01.jpg` … `bride-09.jpg` | Portfolio grid | 4:5, ~1000×1250 | Real brides, shot on the day. Keep the crop consistent. |
| `artist.jpg` | About section | 4:5 | The artist, ideally mid-work |
| `og-cover.jpg` | Social share preview | 1200×630 | Shown when the link is pasted into WhatsApp / Instagram |

## Where to get licence-free photos (until you have your own)

All CC0 / free-to-use commercially, no attribution required:

- **Pexels** — pexels.com — search *"south indian bride"*, *"indian bridal makeup"*, *"kanjeevaram saree"*
- **Unsplash** — unsplash.com — *"indian wedding"*, *"bridal jewellery"*, *"makeup artist"*
- **Openverse** — openverse.org — filter by "use commercially" + "modify"

Replace them with your own portfolio as soon as you can — real local work is the
single biggest trust signal for a bridal client.

## Optimising

Export at the sizes above, then compress:

```bash
# ImageMagick
magick input.jpg -resize 1200x -quality 82 bride-hero.jpg

# or Squoosh (squoosh.app) in the browser — target < 250 KB per image
```

Consider also exporting `.webp` versions and using `<picture>` for a ~30% size cut.
