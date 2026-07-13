# Import necessary modules
import platform
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, Response
from datetime import datetime
import requests
import os
import subprocess
import logging
from queue import Queue
from threading import Lock
import json
from LoginPage import validate_login, register_user, create_table
from LineProcessing import FINAL_OVERLAY  # Import frame processing from LineProcessing.py
import cv2
# Initialize Flask application and configurations
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your_default_secret_key')
RPI_IP = "192.168.240.22"  # Update with your Raspberry Pi's IP
RPI_USER = "pi"      # Update with your Raspberry Pi username
create_table()
# Global variables
message = ""
login_logs = []
command_logs = []
StartStatus = False
event_queue = Queue()
clients = set()
clients_lock = Lock()

# Logging configuration
LOG_FILE_PATH = "app.log"
LOGIN_LOG_FILE_PATH = "login.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE_PATH),
        logging.StreamHandler()
    ]
)

def broadcast_event(event_type, data):
    """Send event to all connected clients."""
    event = {'type': event_type, 'data': data}
    with clients_lock:
        for client_queue in clients:
            client_queue.put(event)

def log_login(username):
    """Log login attempt and broadcast event."""
    login_message = f"{username} logged in at {datetime.now()}"
    with open(LOGIN_LOG_FILE_PATH, 'a') as f:
        f.write(login_message + "\n")
    logging.info(login_message)
    broadcast_event('login_log', login_message)

def check_services():
    """Check if both scripts are running on the Raspberry Pi."""
    try:
        cmd = f"ssh {RPI_USER}@{RPI_IP} 'pgrep -f \"python3 (RPIcameraStream|rasperryPiControl).py\"'"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.returncode == 0
    except Exception:
        return False

def control_robot(action):
    """Send control commands to the robot."""
    global message
    try:
        response = requests.post(f"http://{RPI_IP}:5010/control_robot", json={'action': action})
        if response.status_code == 200:
            message = f"Command '{action}' sent successfully"
        else:
            message = f"Error sending command '{action}'"
    except Exception as e:
        message = f"Failed to connect to Raspberry Pi: {e}"
    
    log_entry = {
        "command": action,
        "timestamp": str(datetime.now()),
        "status": message
    }
    command_logs.append(log_entry)
    logging.info(message)
    broadcast_event('command_log', log_entry)
    return message

@app.route('/')
def login():
    """Render the login page."""
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login_user():
    """Handle user login."""
    username = request.form['username']
    password = request.form['password']
    if validate_login(username, password):
        session['username'] = username
        log_login(username)
        return redirect(url_for('dashboard'))
    return 'Invalid credentials', 401

@app.route('/register', methods=['POST'])
def register_user_route():
    """Handle user registration."""
    username = request.form['username']
    password = request.form['password']
    if register_user(username, password):
        return redirect(url_for('login'))
    return 'Registration failed. Username may already exist.', 400

@app.route('/dashboard')
def dashboard():
    """Render the main dashboard."""
    if 'username' not in session:
        return redirect(url_for('login'))
    return render_template('dashboard.html', username=session['username'])

@app.route('/video_feed/raw')
def raw_video_feed():
    """Stream raw video feed."""
    try:
        return redirect(f"http://{RPI_IP}:5001/video_feed/raw")
    except Exception as e:
        logging.error(f"Failed to connect to raw video stream: {str(e)}")
        return "Raw video stream unavailable", 503

@app.route('/video_feed/overlay')
def overlay_video_feed():
    """Stream processed video feed using LineProcessing.py to add lane detection."""
    def generate_frames():
        cap = cv2.VideoCapture(f"http://{RPI_IP}:8081")

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Call FINAL_OVERLAY from LineProcessing.py
            frame = FINAL_OVERLAY(frame)
            
            _, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

        cap.release()

    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')
@app.route('/events')
def events():
    """SSE endpoint for real-time updates."""
    def generate():
        client_queue = Queue()
        with clients_lock:
            clients.add(client_queue)
        try:
            while True:
                message = client_queue.get()
                yield f"data: {json.dumps(message)}\n\n"
        finally:
            with clients_lock:
                clients.remove(client_queue)
    
    return Response(generate(), mimetype='text/event-stream')

@app.route('/get-login-logs')
def get_login_logs():
    """Return login logs."""
    if os.path.exists(LOGIN_LOG_FILE_PATH):
        with open(LOGIN_LOG_FILE_PATH, 'r') as f:
            logs = f.readlines()
    else:
        logs = ["Login log file not found."]
    return jsonify(logs=logs)

@app.route('/get-logs')
def get_logs():
    """Return general logs."""
    if os.path.exists(LOG_FILE_PATH):
        with open(LOG_FILE_PATH, 'r') as f:
            logs = f.readlines()
    else:
        logs = ["Log file not found."]
    return jsonify(logs=logs)


@app.route('/send-command', methods=['POST'])
def send_command():
    """Handle robot control commands."""
    if 'username' not in session:
        return redirect(url_for('login'))
    
    command = request.json.get('command')
    response_message = control_robot(command)
    
    return jsonify({"status": response_message})

@app.route('/start-robot', methods=['POST'])
def start_robot():
    """Start or stop both the camera stream and robot control scripts."""
    global StartStatus
    action = request.json.get('action')
    message = ""

    if action == "start":
        if not StartStatus:
            try:
                # Start both scripts using SSH
                ssh_commands = [
                    f"ssh -o StrictHostKeyChecking=no {RPI_USER}@{RPI_IP} 'python3 RPIcameraStream.py &'",
                    f"ssh -o StrictHostKeyChecking=no {RPI_USER}@{RPI_IP} 'python3 RasperryPiControl.py &'"
                ]
                
                for cmd in ssh_commands:
                    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                    if result.returncode != 0:
                        raise Exception(f"Command failed: {result.stderr}")
                
                StartStatus = True
                message = "Robot and camera stream started successfully."
            except Exception as e:
                message = f"Error starting scripts: {str(e)}"
        else:
            message = "Robot is already running."

    elif action == "exit":
        if StartStatus:
            try:
                # Kill both scripts using SSH
                ssh_commands = [
                    f"ssh {RPI_USER}@{RPI_IP} 'pkill -f sudo service motion restart'",
                    f"ssh {RPI_USER}@{RPI_IP} 'pkill -f RasperryPiControl.py'"
                ]
                
                for cmd in ssh_commands:
                    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                    if result.returncode != 0:
                        raise Exception(f"Command failed: {result.stderr}")
                
                StartStatus = False
                message = "Robot and camera stream stopped successfully."
            except Exception as e:
                message = f"Error stopping scripts: {str(e)}"
        else:
            message = "The robot is not currently running."

    log_entry = {
        "command": action,
        "timestamp": str(datetime.now()),
        "status": message
    }
    command_logs.append(log_entry)
    logging.info(f"Command executed: {message}")
    broadcast_event('command_log', log_entry)
    return jsonify({"status": message})

if __name__ == '__main__':
    app.run(debug=True, threaded=True, host='0.0.0.0', port=5001)

