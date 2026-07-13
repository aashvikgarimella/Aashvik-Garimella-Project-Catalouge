import threading
import time
from tkinter import Tk, Label, Button
from flask import Flask
from LoginPage import main as user_main
import requests
from GUIforAPI import ControlGUI

app = Flask(__name__)

@app.route('/command', methods = ["POST"])
def command():
    return "command recived"
def home():
    return "Flask is running"


def run_flask():
    """Function to run the Flask app."""
    app.run(host ="0.0.0.0",port=5000, debug=False, use_reloader=False)


def start_flask_in_thread():
    """Start Flask in a separate thread."""
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True  # Daemon thread will exit when the main program exits
    flask_thread.start()


def main():
    # Start Flask in a separate thread
    print("Starting Flask server in the background...")
    start_flask_in_thread()

    # Wait for Flask to initialize
    time.sleep(2)

    # Start the main function from the user's script (which shows Login/Register options)
    print("Running the main function from the user's script...")
    user_main()

    # After user_main runs, check for successful login via the login_code function
    
    # If successful login occurred, open the control GUI
    print("Checking if login was successful...")
    

    
    successful_login = user_main
    print(successful_login)
    if successful_login:
        print("Login successful! Opening the control GUI...")
        ControlGUI()

    else:
        print("Login failed or cancelled.")


if __name__ == "__main__":
    main()

    