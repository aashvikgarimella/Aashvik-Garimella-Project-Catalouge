# Facial Recognition

Locates a target face inside a larger crowd image using OpenCV template matching.

## How it works

Both the target crop and the search image are converted to grayscale, blurred
with a 5x5 Gaussian to suppress noise, and histogram-equalized so lighting
differences between the two do not dominate the match. The detector then slides
the target over the search image and scores candidate windows, returning the
best match above a confidence threshold.

Grayscale is used deliberately: the match is on structure, not color.

## Test images

Not included. Supply your own target crop and search image, then point the script
at them. Do not commit photos of people who have not consented to being in a
public repository.

## Usage

```
pip install -r requirements.txt
python facialRecog.py
```
