# 8051 Quiz Pro (Standalone Mode)

This is a portable version of the **8051 Quiz Pro** application. It has been simplified to run as a single server without needing Docker, GitHub, or FastAPI.

## 🚀 How to Start

1.  **Run the Server**: Double-click the file **`run_quiz.bat`**. This will start your local quiz server.
2.  **Open Dashboard**: Go to [http://localhost:8000](http://localhost:8000) in your web browser. This is where you can add questions and see student scores.
3.  **Share with Students**:
    - **Offline (Same Wi-Fi)**: Tell students to go to the IP address shown in the black server window.
    - **Online (From Home)**: Double-click **`share_quiz.bat`**. It will give you a public link (e.g., `https://example.loca.lt`) to send to your students.

## 🛠️ Internal Structure

- `server.js`: The unified engine representing both Teacher and Student backends.
- `frontend/`: Contains the source code and built files for the web interface.
- `quiz.db`: The database where all your questions and results are saved.
- `run_quiz.bat`: Local launcher.
- `share_quiz.bat`: Internet-sharing launcher (uses localtunnel).
- `force_cleanup.bat`: Use this if the server ever gets "stuck" or says "Port in Use".

## 📦 Requirements
- Only **Node.js** needs to be installed on the host computer.
