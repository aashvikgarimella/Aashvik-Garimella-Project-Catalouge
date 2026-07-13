from flask import Flask, request, jsonify
from tkinter import *
import threading
import requests
import queue

app = Flask(__name__)
RPI_IP = "192.168.1.74"
# Initialize states
fwd_state = backwd_state = left_state = right_state = stop_state = 0
command_queue = queue.Queue()

def control_robot(action):
    try:
        response = requests.post(f"http://{RPI_IP}:5000/control_robot", json={'action': action})
        if response.status_code == 200:
            print("Success")
        else:
            print("Error")
    except Exception as e:
        print("Failed to connect:", e)

def FWD():
    global fwd_state
    fwd_state = 0b0001
    print("Forward")
    control_robot("forward")

def BACKWD():
    global backwd_state
    backwd_state = 0b0010
    print("Backward")
    control_robot("backward")

def LEFT():
    global left_state
    left_state = 0b0100
    print("Left")
    control_robot("left")

def RIGHT():
    global right_state
    right_state = 0b1000
    print("Right")
    control_robot("right")

def STOP():
    global stop_state
    stop_state = 0b0000
    print("Stopping")
    control_robot("stop")

def reset_states():
    global fwd_state, backwd_state, left_state, right_state, stop_state
    fwd_state = backwd_state = left_state = right_state = stop_state = 0
def FTLeft():
    control_robot("FTLeft")
def FTRight():
    control_robot("FTRight")

class ControlGUI(Tk):
    def __init__(self):
        super().__init__()
        self.geometry("400x400")
        self.title("Control GUI")

        Label(self, text="Control Panel", font=("Arial", 20)).pack(pady=20)

        Button(self, text="Forward", command=lambda: [reset_states(), FWD()]).pack(pady=10)
        Button(self, text="Backward", command=lambda: [reset_states(), BACKWD()]).pack(pady=10)
        Button(self, text="Right", command=lambda: [reset_states(), RIGHT()]).pack(pady=10)
        Button(self, text="Left", command=lambda: [reset_states(), LEFT()]).pack(pady=10)
        Button(self, text="Stop", command=lambda: [reset_states(), STOP()]).pack(pady=10)
        Button(self, text="Fine Tune Left", command=lambda: [reset_states(), FTLeft()]).pack(pady=10)
        Button(self, text="Fine Tune Right", command=lambda: [reset_states(), FTRight()]).pack(pady=10)
        self.mainloop()

@app.route('/control_robot', methods=['POST'])
def handle_command():
    data = request.get_json()
    command = data.get('action')

    if command == 'forward':
        reset_states()
        FWD()
    elif command == 'backward':
        reset_states()
        BACKWD()
    elif command == 'left':
        reset_states()
        LEFT()
    elif command == 'right':
        reset_states()
        RIGHT()
    elif command == 'stop':
        reset_states()
        STOP()
    else:
        return jsonify({"status": "Error: Unknown command"}), 400

    return jsonify({"status": f"Command '{command}' executed in GUI"}), 200

def run_server():
    app.run(host="0.0.0.0", port=22)

if __name__ == '__main__':
    # Start the Flask server in a new thread
    server_thread = threading.Thread(target=run_server)
    server_thread.start()

    # Start the GUI
    ControlGUI()