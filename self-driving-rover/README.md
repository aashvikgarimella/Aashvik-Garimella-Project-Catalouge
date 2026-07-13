# Self-Driving Rover

Guides a rover along a predetermined path using real-time lane detection from a
Raspberry Pi camera stream, controlled from a Flask web dashboard.

## How it works

`LineProcessing.py` handles the vision. Frames are edge-detected, lines are
extracted with a Hough transform, then separated into left and right lanes by
slope. The midpoint between the two lanes gives a center line, and the rover
steers toward it. Center-line position is smoothed with an exponential moving
average (alpha = 0.7) so single-frame noise does not jerk the steering.

`app.py` serves the dashboard, streams processed frames back to the browser, and
relays drive commands to the Pi. `PCA9685.py` drives the servos over I2C.
`RaspberryPiControl.py` and `RPIcameraStream.py` run on the Pi itself.

## Layout

| File | Role |
|---|---|
| `LineProcessing.py` | Lane detection, center-line calculation (OpenCV + NumPy) |
| `app.py` | Flask server, video stream, command relay |
| `templates/` | Dashboard and login pages |
| `RaspberryPiControl.py` | Motor and steering control on the Pi |
| `RPIcameraStream.py` | Camera feed from the Pi |
| `PCA9685.py` | 16-channel PWM servo driver (see note below) |
| `LoginPage.py` | Tkinter login, SQLite user store |

## Setup

```
pip install -r requirements.txt
export SECRET_KEY="<your-key>"
python app.py
```

Set `RPI_IP` in `app.py` to your Raspberry Pi's address.

## Attribution

`PCA9685.py` is the manufacturer's servo driver, not original work. The file
carries a note saying so.
