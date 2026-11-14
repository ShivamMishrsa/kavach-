"""Straightening and enlarging a photo before it is read (no Tesseract needed)."""

from PIL import Image, ImageDraw

from app.scans.ocr import _tilt, prepare


def lines_picture(width: int = 900, height: int = 500, tilt: float = 0.0) -> Image.Image:
    """White page with rows of dark 'text', turned by `tilt` degrees."""
    page = Image.new("L", (width, height), 255)
    draw = ImageDraw.Draw(page)
    for y in range(60, height - 60, 28):
        for x in range(60, width - 60, 24):
            draw.rectangle((x, y, x + 16, y + 10), fill=30)
    return page.rotate(tilt, resample=Image.Resampling.BICUBIC, fillcolor=255)


def test_a_straight_picture_is_left_alone():
    assert _tilt(lines_picture()) == 0.0


def test_a_tilted_picture_is_straightened_by_about_the_right_angle():
    for tilt in (-5.0, -3.0, 3.0, 6.0):
        assert abs(_tilt(lines_picture(tilt=tilt)) + tilt) <= 1.0, tilt


def test_a_picture_without_lines_is_not_turned():
    assert _tilt(Image.new("L", (800, 600), 200)) == 0.0


def test_a_small_photo_is_enlarged_and_a_big_one_is_not():
    assert prepare(lines_picture(600, 300), 40_000_000).width == 1400
    assert prepare(lines_picture(1300, 400), 40_000_000).size == (1300, 400)


def test_enlarging_stays_inside_the_pixel_limit():
    small = lines_picture(600, 3000)
    enlarged = prepare(small, 4_000_000)
    assert enlarged.width * enlarged.height <= 4_000_000
