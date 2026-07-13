from flask import Flask, request
from PCA9685 import PCA9685
import time

# Initialize Flask app
app = Flask(__name__)

# Motor control setup using PCA9685 and MotorDriver
Dir = [
    'forward',
    'backward',
]
pwm = PCA9685(0x40, debug=False)
pwm.setPWMFreq(50)

class MotorDriver():
    def __init__(self):
        self.PWMA = 0
        self.AIN1 = 1
        self.AIN2 = 2
        self.PWMB = 5
        self.BIN1 = 3
        self.BIN2 = 4

    def MotorRun(self, motor, index, speed):
        if speed > 100:
            return
        if(motor == 0):
            pwm.setDutycycle(self.PWMA, speed)
            if(index == Dir[0]):
                pwm.setLevel(self.AIN1, 0)
                pwm.setLevel(self.AIN2, 1)
            else:
                pwm.setLevel(self.AIN1, 1)
                pwm.setLevel(self.AIN2, 0)
        else:
            pwm.setDutycycle(self.PWMB, speed)
            if(index == Dir[1]):
                pwm.setLevel(self.BIN1, 0)
                pwm.setLevel(self.BIN2, 1)
            else:
                pwm.setLevel(self.BIN1, 1)
                pwm.setLevel(self.BIN2, 0)

    def MotorStop(self, motor):
        if (motor == 0):
            pwm.setDutycycle(self.PWMA, 0)
        else:
            pwm.setDutycycle(self.PWMB, 0)

# Create a motor driver instance
Motor = MotorDriver()

# Define motor control functions
def move_forward(duration, speed):
    Motor.MotorRun(0, 'forward', speed)
    Motor.MotorRun(1, 'forward', speed)
    # time.sleep(duration)
    # stop_motors()

def move_backward(duration, speed):
    Motor.MotorRun(0, 'backward', speed)
    Motor.MotorRun(1, 'backward', speed)
    # time.sleep(duration)
    # stop_motors()

def stop_motors():
    Motor.MotorStop(0)
    Motor.MotorStop(1)

def turn_left(duration=.25, speed=100):
    Motor.MotorRun(0, 'backward', speed)  # Move left motor backward
    Motor.MotorRun(1, 'forward', speed)   # Move right motor forward
    # time.sleep(duration)
    # stop_motors()

def turn_right(duration=.25, speed=100):
    Motor.MotorRun(0, 'forward', speed)   # Move left motor forward
    Motor.MotorRun(1, 'backward', speed)  # Move right motor backward
    # time.sleep(duration)
    # stop_motors()

def FTturn_right(duration=.05, speed=100):
    Motor.MotorRun(0, 'forward', speed)   # Move left motor forward
    Motor.MotorRun(1, 'backward', speed)  # Move right motor backward
    # time.sleep(duration)
    # stop_motors()

def FTturn_left(duration=.05, speed=100):
    Motor.MotorRun(0, 'backward', speed)  # Move left motor backward
    Motor.MotorRun(1, 'forward', speed)   # Move right motor forward
    # time.sleep(duration)
    # stop_motors()

# Flask route for controlling the robot
@app.route('/control_robot', methods=['POST'])
def control_robot():
    action = request.json.get('action')
    speed = request.json.get('speed', 40) 

    if action == 'backward':
        move_forward(.25, speed)  
        return "Moving backward", 200

    elif action == 'forward':
        move_backward(.25, speed) 
        return "Moving forward", 200

    elif action == 'right':
        turn_left(.25, speed)  
        return "Turning right", 200

    elif action == 'left':
        turn_right(.25, speed)  
        return "Turning left", 200

    elif action == 'stop':
        stop_motors()
        return "Stopped", 200

    else:
        return "Invalid action", 400

if __name__ == '__main__':
    try:
        app.run(host='0.0.0.0', port=5005)
    except KeyboardInterrupt:
        stop_motors()

#scp "/Users/pl244272/Documents/DesertronCODE/CODE CODE CODE/DesertronCODE/RobotAPIpwpMacOS 3/RaspberryPiControl.py" pi@192.168.240.22/home/pi/