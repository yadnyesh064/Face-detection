import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import base64
import time
import os

class VisionEngine:
    def __init__(self):
        self.detector = None
        self.cap = None
        self.error_message = None
        
        # Robust Path Resolution for Model File
        current_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(current_dir, 'face_landmarker.task')
        
        if not os.path.exists(model_path):
            self.error_message = f"MODEL ERROR: '{model_path}' not found."
            print(self.error_message)
        else:
            try:
                base_options = python.BaseOptions(model_asset_path=model_path)
                options = vision.FaceLandmarkerOptions(
                    base_options=base_options,
                    output_face_blendshapes=False,
                    output_facial_transformation_matrixes=False,
                    num_faces=1)
                self.detector = vision.FaceLandmarker.create_from_options(options)
                print("Face Landmarker initialized successfully.")
            except Exception as e:
                self.error_message = f"INITIALIZATION ERROR: {e}"
                print(self.error_message)

        # Robust Camera Initialization (TRY 0, 1, 2)
        for index in [0, 1, 2]:
            try:
                print(f"Attempting to open camera index {index}...")
                # Try with CAP_DSHOW on Windows for faster/more reliable access
                self.cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
                if not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(index) # Fallback to default
                
                if self.cap.isOpened():
                    self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    self.cap.set(cv2.CAP_PROP_FPS, 30)
                    # Test read
                    ret, _ = self.cap.read()
                    if ret:
                        print(f"Camera {index} initialized and reading successfully.")
                        break
                    else:
                        print(f"Camera {index} opened but failed to read. Releasing...")
                        self.cap.release()
                        self.cap = None
                else:
                    self.cap = None
            except Exception as e:
                print(f"Camera {index} error: {e}")
                self.cap = None

        if self.cap is None or not self.cap.isOpened():
            cam_err = "CAMERA ERROR: Could not access any camera devices (0, 1, or 2)."
            self.error_message = cam_err if not self.error_message else f"{self.error_message} | {cam_err}"
            print(cam_err)
        
        self.base_bpm = 72.0
        self.smoothing = 0.6
        self.last_points = None
        self.last_nx = None
        self.last_ny = None
        self.last_threat = 5.0
        self.last_emotions = {"stress": 0.1, "focus": 0.8, "anxiety": 0.1}
        
    def process_frame(self):
        telemetry = self._get_empty_telemetry()
        
        if self.error_message:
            telemetry["system_error"] = self.error_message

        if self.cap is None or not self.cap.isOpened():
            return None, telemetry

        success, image = self.cap.read()
        if not success:
            telemetry["system_error"] = "CAMERA ERROR: Failed to capture frame."
            return None, telemetry
            
        start_time = time.time()
        
        # Only detect if detector exists
        if self.detector:
            try:
                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
                results = self.detector.detect(mp_image)

                h, w, _ = image.shape

                if results.face_landmarks:
                    telemetry["faces_detected"] = len(results.face_landmarks)
                    
                    for face_landmarks in results.face_landmarks:
                        points = [{"x": lm.x, "y": lm.y, "z": lm.z} for lm in face_landmarks]
                        
                        # Smoothing
                        if self.last_points is None:
                            self.last_points = points
                        else:
                            for i in range(len(points)):
                                points[i]["x"] = self.smoothing * self.last_points[i]["x"] + (1 - self.smoothing) * points[i]["x"]
                                points[i]["y"] = self.smoothing * self.last_points[i]["y"] + (1 - self.smoothing) * points[i]["y"]
                                points[i]["z"] = self.smoothing * self.last_points[i]["z"] + (1 - self.smoothing) * points[i]["z"]
                            self.last_points = points
                        
                        telemetry["mesh_points"] = self.last_points
                        
                        # Metrics simulation
                        self.base_bpm += np.random.normal(0, 0.3)
                        self.base_bpm = max(60, min(110, self.base_bpm)) 
                        telemetry["heart_rate"] = float(round(self.base_bpm, 1))
                        
                        raw_threat = float(round(np.random.uniform(2, 12), 1))
                        self.last_threat = self.smoothing * self.last_threat + (1 - self.smoothing) * raw_threat
                        telemetry["threat_score"] = float(round(self.last_threat, 1))
                        
                        raw_stress = round(abs(self.base_bpm - 72)/40.0, 2)
                        raw_focus = float(round(np.random.uniform(0.8, 0.98), 2))
                        raw_anxiety = float(round(np.random.uniform(0.05, 0.2), 2))
                        
                        self.last_emotions["stress"] = self.smoothing * self.last_emotions["stress"] + (1 - self.smoothing) * raw_stress
                        self.last_emotions["focus"] = self.smoothing * self.last_emotions["focus"] + (1 - self.smoothing) * raw_focus
                        self.last_emotions["anxiety"] = self.smoothing * self.last_emotions["anxiety"] + (1 - self.smoothing) * raw_anxiety
                        
                        telemetry["emotions"] = {
                            "stress": float(round(self.last_emotions["stress"], 2)),
                            "focus": float(round(self.last_emotions["focus"], 2)),
                            "anxiety": float(round(self.last_emotions["anxiety"], 2))
                        }
                        
                        # Visual feedback
                        nose_tip = self.last_points[1]
                        raw_nx, raw_ny = int(nose_tip["x"] * w), int(nose_tip["y"] * h)
                        
                        if self.last_nx is None:
                            self.last_nx, self.last_ny = raw_nx, raw_ny
                        else:
                            self.last_nx = int(self.smoothing * self.last_nx + (1 - self.smoothing) * raw_nx)
                            self.last_ny = int(self.smoothing * self.last_ny + (1 - self.smoothing) * raw_ny)
                        
                        nx, ny = self.last_nx, self.last_ny
                        cv2.circle(image, (nx, ny), 3, (255, 255, 255), -1)
                        cv2.rectangle(image, (nx - 20, ny - 20), (nx + 20, ny + 20), (200, 200, 200), 1)
                else:
                    self._reset_face_state()
            except Exception as e:
                telemetry["system_error"] = f"RUNTIME ERROR: {e}"
                self._reset_face_state()
        else:
            telemetry["system_error"] = self.error_message or "DETECTOR ERROR: Not initialized."
            self._reset_face_state()

        # Finalize image
        h, w, _ = image.shape
        cv2.line(image, (w//2, 0), (w//2, h), (50, 50, 50), 1)

        try:
            _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 80])
            jpg_as_text = base64.b64encode(buffer).decode('utf-8')
        except Exception as e:
            telemetry["system_error"] = f"ENCODING ERROR: {e}"
            jpg_as_text = None
        
        telemetry["fps"] = round(1 / (time.time() - start_time)) if (time.time() - start_time) > 0 else 0
        return jpg_as_text, telemetry

    def _get_empty_telemetry(self):
        return {
            "fps": 0, "faces_detected": 0, "threat_score": 0, "heart_rate": 0,
            "emotions": {"stress": 0.0, "focus": 0.0, "anxiety": 0.0},
            "mesh_points": [], "head_pose": {"pitch": 0, "yaw": 0, "roll": 0},
            "system_error": None
        }

    def _reset_face_state(self):
        self.last_points = None
        self.last_nx = None
        self.last_ny = None

    def release(self):
        if self.cap:
            self.cap.release()
            print("Camera released.")
