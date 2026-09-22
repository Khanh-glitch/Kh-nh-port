"""
make_content_textures.py — authored content surfaces for Study A1.

Study A0 proved the composition and lighting but still read as a tasteful
generic 3D room. The missing ingredient was *evidence of specific work*.

This script builds the graphic surfaces that carry that evidence, from the
real project media already in this repository:

    01_ai_prompt_to_play.jpg        PROMPT TO PLAY   — AI / competition event
    02_social_debate_poster.jpg     SOCIAL EXPERIMENT — content / video
    03_music_vibes.jpg              MUSIC LED MY LIFE — music / performance
    03_music_performance.jpg        (inside RUNNING_ORDER_DESIGN_TEST.zip)

Nothing here is invented stock imagery and nothing is downloaded. Every
photograph is the user's own; the documents around them (run of show, floor
plan, credential, contact sheet) are typeset from the project metadata in
`RUNNING_ORDER_DESIGN_TEST_PROMPT.md`.

Art direction is taken from that same prompt rather than improvised:
warm near-white paper, near-black type, hairline structural rules, mono
metadata, and *work owns the colour* — the documents stay quiet so the
photographs carry all the saturation.

Output: assets/textures/room-content/*.png

Typography note: the source brief asks for Inter Tight / Archivo / IBM Plex
Mono. Only DejaVu ships in this environment, so DejaVu Sans / Sans Mono
stand in. At the scale these surfaces occupy in frame they read as document
*types*, not as typography, so this does not affect the art-direction test.
"""

from __future__ import annotations

import io
import os
import zipfile

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "assets", "textures", "room-content")

F_DIR = "/usr/share/fonts/truetype/dejavu"
F_BOLD = os.path.join(F_DIR, "DejaVuSans-Bold.ttf")
F_SANS = os.path.join(F_DIR, "DejaVuSans.ttf")
F_MONO = os.path.join(F_DIR, "DejaVuSansMono.ttf")
F_MONO_B = os.path.join(F_DIR, "DejaVuSansMono-Bold.ttf")

# --- palette (from the project's own art direction) ------------------------
PAPER = (242, 240, 235)
PAPER_WARM = (236, 231, 219)
PAPER_COOL = (238, 239, 238)
INK = (20, 20, 15)
INK_SOFT = (92, 90, 84)
RULE = (201, 196, 184)
RULE_SOFT = (222, 218, 208)
NOTE_Y = (232, 205, 120)
NOTE_O = (226, 158, 96)
ACCENT = (198, 74, 42)          # the lanyard red/orange from the event photo


def font(path, size):
    return ImageFont.truetype(path, size)


def load_photos():
    """The user's real project media."""
    p = {
        "event": Image.open(os.path.join(REPO, "01_ai_prompt_to_play.jpg")),
        "social": Image.open(os.path.join(REPO, "02_social_debate_poster.jpg")),
        "music": Image.open(os.path.join(REPO, "03_music_vibes.jpg")),
    }
    zpath = os.path.join(REPO, "RUNNING_ORDER_DESIGN_TEST.zip")
    with zipfile.ZipFile(zpath) as z:
        name = "vibecode_running_order_package/assets/03_music_performance.jpg"
        p["perf"] = Image.open(io.BytesIO(z.read(name)))
    return {k: v.convert("RGB") for k, v in p.items()}


def fit(img, w, h, focus=(0.5, 0.5)):
    """Cover-crop to exactly w x h around a focal point."""
    sw, sh = img.size
    scale = max(w / sw, h / sh)
    nw, nh = max(w, int(sw * scale + 0.5)), max(h, int(sh * scale + 0.5))
    r = img.resize((nw, nh), Image.LANCZOS)
    cx, cy = int((nw - w) * focus[0]), int((nh - h) * focus[1])
    return r.crop((cx, cy, cx + w, cy + h))


def as_print(img, warmth=1.0, bright=0.98, sat=0.94):
    """Make a photograph read as a matte print rather than a lit screen."""
    img = ImageEnhance.Brightness(img).enhance(bright)
    img = ImageEnhance.Color(img).enhance(sat)
    if warmth != 1.0:
        r, g, b = img.split()
        r = r.point(lambda v: min(255, int(v * warmth)))
        b = b.point(lambda v: int(v / warmth))
        img = Image.merge("RGB", (r, g, b))
    return img


def paper(w, h, tone=PAPER):
    return Image.new("RGB", (w, h), tone)


def hairline(d, x0, y0, x1, y1, fill=RULE, width=1):
    d.line([x0, y0, x1, y1], fill=fill, width=width)


def pin(d, cx, cy, r=7, color=(168, 52, 38)):
    """A pushpin, drawn into the sheet so no alpha channel is needed."""
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    d.ellipse([cx - r + 2, cy - r + 2, cx - r + 5, cy - r + 5],
              fill=(255, 235, 225))


def tape(d, x0, y0, x1, y1, tone=(214, 208, 190)):
    d.rectangle([x0, y0, x1, y1], fill=tone)


def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path, optimize=True)
    print(f"  {name:<34} {img.size[0]}x{img.size[1]}  "
          f"{os.path.getsize(path) / 1024:.0f} KB")


# ===========================================================================
# 1. PRIMARY DISPLAY — the RUNNING ORDER cue track, mid-design
# ===========================================================================

def screen_running_order(ph, w=1400, h=772):
    """The portfolio concept itself, open on the monitor.

    This is the single most identity-bearing surface in the room: it shows
    the person's own `RUNNING ORDER / CONTINUOUS CUE TRACK` concept being
    worked on, using their own event photography as the active project. The
    layout follows the art direction in their brief (paper ground, near-black
    type, hairline marks, one cue marker, media owns the colour).
    """
    im = paper(w, h, PAPER)
    d = ImageDraw.Draw(im)

    f_title = font(F_BOLD, 40)
    f_meta = font(F_MONO, 19)
    f_meta_s = font(F_MONO, 16)
    f_proj = font(F_BOLD, 70)

    # --- header ---
    d.text((56, 40), "RUNNING ORDER", font=f_title, fill=INK)
    d.text((58, 92), "CONTINUOUS CUE TRACK", font=f_meta, fill=INK_SOFT)
    d.text((w - 56, 46), "2026", font=f_meta, fill=INK_SOFT, anchor="ra")
    d.text((w - 56, 74), "01 / 03", font=f_meta, fill=INK, anchor="ra")
    hairline(d, 56, 132, w - 56, 132, RULE, 2)

    # --- active project media ---
    mx0, my0, mx1, my1 = 56, 168, 884, 590
    d.rectangle([mx0 - 1, my0 - 1, mx1 + 1, my1 + 1], outline=RULE, width=1)
    im.paste(fit(ph["event"], mx1 - mx0, my1 - my0, (0.52, 0.46)), (mx0, my0))

    # --- title block ---
    tx = 936
    d.text((tx, 168), "PROMPT", font=f_proj, fill=INK)
    d.text((tx, 238), "TO PLAY", font=f_proj, fill=INK)
    d.text((tx, 330), "AI / COMPETITION", font=f_meta, fill=INK_SOFT)
    hairline(d, tx, 368, w - 56, 368, RULE, 1)
    rows = [("ROLE", "PRODUCTION / TECH"),
            ("FORMAT", "LIVE  ·  24 TEAMS"),
            ("OUTPUT", "RUN OF SHOW, VT, LED")]
    y = 390
    for k, v in rows:
        d.text((tx, y), k, font=f_meta_s, fill=INK_SOFT)
        d.text((tx + 108, y), v, font=f_meta_s, fill=INK)
        y += 30
    d.rectangle([tx, 500, tx + 150, 536], fill=INK)
    d.text((tx + 75, 518), "AT CUE", font=font(F_MONO_B, 17),
           fill=PAPER, anchor="mm")

    # --- the continuous track ---
    ty0, ty1 = 640, 742
    hairline(d, 56, ty0 - 22, w - 56, ty0 - 22, RULE_SOFT, 1)
    segs = [("event", 56, 700, (0.52, 0.45)),
            ("social", 700, 1030, (0.5, 0.42)),
            ("music", 1030, w - 56, (0.5, 0.18))]
    for key, x0, x1, foc in segs:
        im.paste(fit(ph[key], x1 - x0, ty1 - ty0, foc), (x0, ty0))
    # No gaps, no borders, no rounded corners — one continuous media body.
    d.rectangle([56, ty0, w - 57, ty1], outline=RULE, width=1)

    # --- the single cue marker (structural, not a DAW playhead) ---
    cue = 700
    d.line([cue, ty0 - 34, cue, ty1 + 20], fill=INK, width=3)
    d.line([cue - 11, ty0 - 34, cue + 11, ty0 - 34], fill=INK, width=3)
    d.line([cue - 11, ty1 + 20, cue + 11, ty1 + 20], fill=INK, width=3)

    d.text((56, ty1 + 14), "SCROLL / DRAG", font=f_meta_s, fill=INK_SOFT)
    d.text((w - 56, ty1 + 14), "02 SOCIAL EXPERIMENT  ·  03 MUSIC",
           font=f_meta_s, fill=INK_SOFT, anchor="ra")

    save(im, "screen_running_order.png")


# ===========================================================================
# 2. CORKBOARD — the working review surface
# ===========================================================================

def board_contact_strip(ph, w=1200, h=312):
    """Contact sheet: four frames pulled from the event shoot for selection."""
    im = paper(w, h, PAPER_COOL)
    d = ImageDraw.Draw(im)
    f = font(F_MONO, 15)
    d.text((16, 10), "PROMPT TO PLAY — SELECTS", font=font(F_MONO_B, 16),
           fill=INK)
    fx, fy, fw, fh = 16, 38, 284, 214
    focs = [(0.22, 0.44), (0.5, 0.42), (0.74, 0.5), (0.9, 0.36)]
    marks = ["01", "02", "03", "04"]
    for i, (foc, mk) in enumerate(zip(focs, marks)):
        x = fx + i * (fw + 8)
        im.paste(as_print(fit(ph["event"], fw, fh, foc)), (x, fy))
        d.rectangle([x - 1, fy - 1, x + fw, fy + fh], outline=RULE, width=1)
        d.text((x + 2, fy + fh + 8), mk, font=f, fill=INK_SOFT)
        if i == 2:      # one frame ringed as the chosen select
            d.rectangle([x - 4, fy - 4, x + fw + 3, fy + fh + 3],
                        outline=ACCENT, width=3)
    d.text((w - 16, h - 26), "SELECT 03", font=font(F_MONO_B, 16),
           fill=ACCENT, anchor="ra")
    pin(d, w // 2, 14, 8)
    save(im, "board_contact_strip.png")


def board_runsheet(w=640, h=884):
    """Run of show — the document that most says 'event production'."""
    im = paper(w, h, PAPER)
    d = ImageDraw.Draw(im)
    f_h = font(F_BOLD, 34)
    f_k = font(F_MONO_B, 19)
    f_r = font(F_MONO, 21)

    d.text((34, 44), "RUN OF SHOW", font=f_h, fill=INK)
    d.text((34, 90), "PROMPT TO PLAY  ·  V4", font=f_r, fill=INK_SOFT)
    hairline(d, 34, 130, w - 34, 130, RULE, 2)

    d.text((34, 148), "CUE", font=f_k, fill=INK_SOFT)
    d.text((118, 148), "ITEM", font=f_k, fill=INK_SOFT)
    d.text((w - 34, 148), "DUR", font=f_k, fill=INK_SOFT, anchor="ra")
    hairline(d, 34, 180, w - 34, 180, RULE_SOFT, 1)

    rows = [("Q1", "HOUSE OPEN", "20"),
            ("Q2", "OPENING VT", "02"),
            ("Q3", "HOST WELCOME", "05"),
            ("Q4", "BRIEF — RND 01", "08"),
            ("Q5", "BUILD SPRINT", "45"),
            ("Q6", "LED / SCORES", "04"),
            ("Q7", "DEMO 1-8", "24"),
            ("Q8", "JUDGING", "12"),
            ("Q9", "AWARD + PHOTO", "10")]
    y = 200
    row_h = 62
    for i, (q, item, dur) in enumerate(rows):
        if i == 4:      # the long item, highlighted and amended
            d.rectangle([28, y - 8, w - 28, y + 40], fill=(226, 222, 210))
        d.text((34, y), q, font=f_r, fill=ACCENT if i == 4 else INK)
        d.text((118, y), item, font=f_r, fill=INK)
        d.text((w - 34, y), dur, font=f_r, fill=INK_SOFT, anchor="ra")
        y += row_h
        hairline(d, 34, y - 11, w - 34, y - 11, RULE_SOFT, 1)

    # A hand-marked amendment against the Q5 duration: the sheet is in use.
    q5y = 200 + 4 * row_h
    d.line([w - 108, q5y + 16, w - 30, q5y + 13], fill=ACCENT, width=3)
    d.text((w - 250, q5y + 46), "+2 MIN", font=font(F_MONO_B, 24), fill=ACCENT)

    hairline(d, 34, y + 18, w - 34, y + 18, RULE, 2)
    d.text((34, y + 34), "FOH CALL  ·  KHANH", font=f_r, fill=INK_SOFT)
    pin(d, w // 2, 20, 9)
    save(im, "board_runsheet.png")


def board_floorplan(w=800, h=600):
    """Room / stage plan: the other unmistakable production document."""
    im = paper(w, h, PAPER_WARM)
    d = ImageDraw.Draw(im)
    f = font(F_MONO, 16)
    f_b = font(F_MONO_B, 17)

    d.text((24, 20), "FLOOR PLAN — HUB", font=f_b, fill=INK)
    hairline(d, 24, 48, w - 24, 48, RULE, 2)

    # outer room
    d.rectangle([48, 76, w - 48, h - 56], outline=INK, width=3)
    # LED / stage end
    d.rectangle([120, 92, w - 120, 132], fill=INK)
    d.text((w // 2, 112), "LED", font=f_b, fill=PAPER_WARM, anchor="mm")
    # team tables, two banks
    for r in range(3):
        for c in range(4):
            x = 96 + c * 152
            y = 188 + r * 92
            d.rectangle([x, y, x + 108, y + 46], outline=INK_SOFT, width=2)
    d.text((w // 2, 168), "TEAM TABLES  ·  24", font=f, fill=INK_SOFT,
           anchor="mm")
    # FOH position
    d.rectangle([w - 190, h - 130, w - 76, h - 80], outline=ACCENT, width=3)
    d.text((w - 133, h - 105), "FOH", font=f_b, fill=ACCENT, anchor="mm")
    # cable run, dashed
    for x in range(130, w - 190, 26):
        d.line([x, h - 105, x + 14, h - 105], fill=INK_SOFT, width=2)
    d.text((24, h - 40), "CABLE RUN / DMX", font=f, fill=INK_SOFT)
    pin(d, w // 2, 12, 8)
    save(im, "board_floorplan.png")


def board_print_event(ph, w=720, h=480):
    im = paper(w, h, PAPER)
    d = ImageDraw.Draw(im)
    im.paste(as_print(fit(ph["social"], w - 28, h - 66, (0.5, 0.4))), (14, 14))
    d.text((14, h - 44), "SOCIAL EXPERIMENT — FIELD", font=font(F_MONO, 19),
           fill=INK_SOFT)
    tape(d, w // 2 - 46, 0, w // 2 + 46, 16)
    save(im, "board_print_event.png")


def board_print_music(ph, w=560, h=784):
    im = paper(w, h, PAPER)
    d = ImageDraw.Draw(im)
    im.paste(fit(ph["music"], w - 26, h - 70, (0.5, 0.1)), (13, 13))
    d.text((13, h - 48), "MUSIC LED MY LIFE", font=font(F_MONO, 20),
           fill=INK_SOFT)
    pin(d, w // 2, 10, 9)
    save(im, "board_print_music.png")


def board_note(name, text_lines, w, h, tone, angle_tone=None):
    im = paper(w, h, tone)
    d = ImageDraw.Draw(im)
    f = font(F_MONO_B, max(16, int(h * 0.13)))
    y = int(h * 0.16)
    for line in text_lines:
        d.text((int(w * 0.10), y), line, font=f, fill=(58, 44, 20))
        y += int(h * 0.22)
    save(im, name)


def pass_credential(w=460, h=702):
    """Event credential. One small object that says 'this person runs shows'."""
    im = paper(w, h, (248, 246, 241))
    d = ImageDraw.Draw(im)
    # clip slot
    d.rectangle([w // 2 - 62, 26, w // 2 + 62, 46], fill=(210, 206, 196))
    # header band in the event's lanyard red
    d.rectangle([0, 70, w, 210], fill=ACCENT)
    d.text((w // 2, 120), "CREW", font=font(F_BOLD, 62), fill=(255, 250, 246),
           anchor="mm")
    d.text((w // 2, 176), "ALL AREAS", font=font(F_MONO_B, 22),
           fill=(255, 226, 214), anchor="mm")
    d.text((w // 2, 250), "PROMPT TO PLAY", font=font(F_BOLD, 30), fill=INK,
           anchor="mm")
    d.text((w // 2, 292), "2026", font=font(F_MONO, 22), fill=INK_SOFT,
           anchor="mm")
    hairline(d, 40, 330, w - 40, 330, RULE, 2)
    d.text((w // 2, 372), "KHANH", font=font(F_BOLD, 40), fill=INK,
           anchor="mm")
    d.text((w // 2, 416), "PRODUCTION", font=font(F_MONO, 22), fill=INK_SOFT,
           anchor="mm")
    # barcode
    x = 58
    import random
    rng = random.Random(7)
    while x < w - 58:
        bw = rng.choice([3, 3, 5, 8])
        if rng.random() > 0.32:
            d.rectangle([x, 470, x + bw, 560], fill=INK)
        x += bw + 4
    d.text((w // 2, 596), "FOH · STAGE · BACK", font=font(F_MONO, 19),
           fill=INK_SOFT, anchor="mm")
    d.rectangle([0, 0, w - 1, h - 1], outline=(206, 202, 192), width=2)
    save(im, "pass_credential.png")


# ===========================================================================
# 3. WALL SHEETS — the looser working material around the desk
# ===========================================================================

def wall_sheet_music(ph, w=600, h=800):
    im = paper(w, h, PAPER)
    d = ImageDraw.Draw(im)
    im.paste(fit(ph["music"], w - 24, h - 78, (0.5, 0.06)), (12, 12))
    d.text((12, h - 54), "03 — MUSIC", font=font(F_MONO_B, 22), fill=INK)
    tape(d, w // 2 - 52, 0, w // 2 + 52, 18)
    save(im, "wall_sheet_music.png")


def wall_sheet_brief(w=550, h=750):
    im = paper(w, h, PAPER)
    d = ImageDraw.Draw(im)
    d.text((30, 34), "CUE TRACK", font=font(F_BOLD, 34), fill=INK)
    d.text((30, 78), "TEST NOTES", font=font(F_MONO, 20), fill=INK_SOFT)
    hairline(d, 30, 112, w - 30, 112, RULE, 2)
    lines = ["WORK VISIBLE ON", "FIRST PAINT", "", "ONE CONTINUOUS",
             "TRACK — NO CARDS", "", "EXPANDS AT CUE,", "COMPRESSES BACK",
             "", "REVERSIBLE"]
    y = 138
    for ln in lines:
        d.text((30, y), ln, font=font(F_MONO, 21), fill=INK)
        y += 34
    d.line([28, 176, 300, 173], fill=ACCENT, width=3)
    d.text((30, h - 60), "→ VARIANT B", font=font(F_MONO_B, 21), fill=ACCENT)
    pin(d, w // 2, 16, 8)
    save(im, "wall_sheet_brief.png")


def wall_sheet_perf(ph, w=650, h=500):
    im = paper(w, h, PAPER)
    d = ImageDraw.Draw(im)
    im.paste(as_print(fit(ph["perf"], w - 24, h - 62, (0.5, 0.5))), (12, 12))
    d.text((12, h - 42), "STAGE — 03", font=font(F_MONO, 19), fill=INK_SOFT)
    tape(d, w // 2 - 44, 0, w // 2 + 44, 15)
    save(im, "wall_sheet_perf.png")


def wall_sheet_layout(w=700, h=500):
    """A wireframe of the cue-track geometry: design thinking on the wall."""
    im = paper(w, h, PAPER_COOL)
    d = ImageDraw.Draw(im)
    d.text((22, 18), "TRACK GEOMETRY", font=font(F_MONO_B, 20), fill=INK)
    hairline(d, 22, 48, w - 22, 48, RULE, 2)
    # compressed state
    d.text((22, 68), "COMPRESSED", font=font(F_MONO, 16), fill=INK_SOFT)
    x = 22
    for bw in (150, 150, 150, 150):
        d.rectangle([x, 94, x + bw, 150], outline=INK, width=2)
        x += bw
    # expanded state
    d.text((22, 178), "AT CUE", font=font(F_MONO, 16), fill=INK_SOFT)
    d.rectangle([22, 204, 120, 300], outline=INK_SOFT, width=2)
    d.rectangle([120, 204, 430, 380], outline=INK, width=4)
    d.rectangle([430, 204, 528, 300], outline=INK_SOFT, width=2)
    d.line([120, 186, 120, 400], fill=ACCENT, width=3)
    d.text((132, 392), "CUE", font=font(F_MONO_B, 17), fill=ACCENT)
    # arrows
    d.line([560, 250, 660, 250], fill=INK, width=2)
    d.line([648, 242, 660, 250], fill=INK, width=2)
    d.line([648, 258, 660, 250], fill=INK, width=2)
    d.text((556, 274), "PROGRESS", font=font(F_MONO, 15), fill=INK_SOFT)
    pin(d, w // 2, 12, 8)
    save(im, "wall_sheet_layout.png")


def wall_sheet_frame(ph, w=500, h=650):
    im = paper(w, h, PAPER)
    d = ImageDraw.Draw(im)
    im.paste(as_print(fit(ph["event"], w - 24, h - 74, (0.86, 0.34))), (12, 12))
    d.text((12, h - 50), "CREW — FOH", font=font(F_MONO, 19), fill=INK_SOFT)
    pin(d, w // 2, 12, 8)
    save(im, "wall_sheet_frame.png")


def desk_runsheet(w=600, h=849):
    """The printed page actually in use on the desk, marked up."""
    im = paper(w, h, (246, 244, 238))
    d = ImageDraw.Draw(im)
    d.text((34, 36), "CUE SHEET", font=font(F_BOLD, 30), fill=INK)
    d.text((34, 76), "ROUND 01  ·  WORKING COPY", font=font(F_MONO, 17),
           fill=INK_SOFT)
    hairline(d, 34, 108, w - 34, 108, RULE, 2)
    y = 128
    rows = ["VT IN — 00:02:00", "HOST MIC A", "LED PRESET 3",
            "TIMER START", "SCORE OVERLAY", "BAND CHANGE",
            "DEMO CAM 2", "AWARD STING", "HOUSE LIGHTS"]
    for i, r in enumerate(rows):
        d.text((34, y), r, font=font(F_MONO, 19), fill=INK)
        hairline(d, 34, y + 30, w - 34, y + 30, RULE_SOFT, 1)
        if i in (2, 5):
            d.line([30, y + 14, 330, y + 11], fill=ACCENT, width=3)
        y += 46
    d.text((34, y + 20), "CHECK DMX PATCH", font=font(F_MONO_B, 20),
           fill=ACCENT)
    save(im, "desk_runsheet.png")


def mounted_print(ph, w=800, h=500):
    im = paper(w, h, (232, 228, 219))
    d = ImageDraw.Draw(im)
    im.paste(as_print(fit(ph["event"], w - 36, h - 84, (0.36, 0.5)),
                      bright=0.94), (18, 18))
    d.text((18, h - 54), "PROMPT TO PLAY — 2026", font=font(F_MONO, 22),
           fill=INK_SOFT)
    save(im, "mounted_print.png")


def main():
    os.makedirs(OUT, exist_ok=True)
    ph = load_photos()
    print("authoring content surfaces from real project media:")
    screen_running_order(ph)
    board_contact_strip(ph)
    board_runsheet()
    board_floorplan()
    board_print_event(ph)
    board_print_music(ph)
    board_note("board_note_a.png", ["RE-CUT", "VT 02"], 420, 340, NOTE_Y)
    board_note("board_note_b.png", ["ASK", "RIGGING"], 400, 320, NOTE_O)
    pass_credential()
    wall_sheet_music(ph)
    wall_sheet_brief()
    wall_sheet_perf(ph)
    wall_sheet_layout()
    wall_sheet_frame(ph)
    desk_runsheet()
    mounted_print(ph)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f"total {total / 1024:.0f} KB in {os.path.relpath(OUT, REPO)}")


if __name__ == "__main__":
    main()
