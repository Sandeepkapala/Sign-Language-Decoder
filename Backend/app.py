from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np
import cv2
import mediapipe as mp
import base64
import os

app = Flask(__name__)

# Allow requests from your Vercel frontend
CORS(
    app,
    resources={
        r"/*": {
            "origins": [
                "https://sign-language-decoder.vercel.app"
            ],
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type"]
        }
    }
)

model = None
data_dict = None
max_len = 0

labels_dict = {
    0: 'A',
    1: 'B',
    2: 'C',
    3: 'D',
    4: 'E',
    5: 'F',
    6: 'G',
    7: 'H',
    8: 'I',
    9: 'J',
    10: 'K',
    11: 'L',
    12: 'V',
    13: 'W',
    14: 'Y'
}

# MediaPipe Hands
mp_hands = mp.solutions.hands

hands_model = mp_hands.Hands(
    static_image_mode=True,
    min_detection_confidence=0.3
)


def load_resources():
    global model, data_dict, max_len

    base_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), '..')
    )

    model_path = os.path.join(base_dir, 'model.p')
    data_path = os.path.join(base_dir, 'data.pickle')

    print("Loading model:", model_path)
    print("Loading dataset:", data_path)

    with open(model_path, 'rb') as f:
        model_dict = pickle.load(f)

    model = model_dict['model']

    with open(data_path, 'rb') as f:
        data_dict = pickle.load(f)

    data = np.array(
        data_dict['data'],
        dtype=object
    )

    max_len = max(len(i) for i in data)

    print(f"Model loaded successfully.")
    print(f"Maximum feature length: {max_len}")


# Load model when server starts
load_resources()

print("Backend ready - No login required")


# --------------------------------------------------
# HOME / HEALTH CHECK
# --------------------------------------------------

@app.route('/', methods=['GET'])
def health():
    return jsonify({
        "status": "success",
        "message": "Sign Language API is running",
        "max_data_length": max_len,
        "endpoints": [
            "/predict_landmarks",
            "/predict_image"
        ]
    })


# --------------------------------------------------
# PREDICT FROM IMAGE
# --------------------------------------------------

@app.route('/predict_image', methods=['POST', 'OPTIONS'])
def predict_image():

    # Handle browser CORS preflight
    if request.method == 'OPTIONS':
        return '', 204

    try:

        data = request.get_json()

        if not data:
            return jsonify({
                "error": "No JSON data received"
            }), 400

        if 'image' not in data:
            return jsonify({
                "error": "Image data missing"
            }), 400

        img_b64 = data['image']

        # Remove data:image/...;base64, prefix
        if ',' in img_b64:
            img_b64 = img_b64.split(',', 1)[1]

        img_bytes = base64.b64decode(img_b64)

        nparr = np.frombuffer(
            img_bytes,
            np.uint8
        )

        img = cv2.imdecode(
            nparr,
            cv2.IMREAD_COLOR
        )

        if img is None:
            return jsonify({
                "error": "Could not decode image"
            }), 400

        img_rgb = cv2.cvtColor(
            img,
            cv2.COLOR_BGR2RGB
        )

        # Detect hand
        results = hands_model.process(img_rgb)

        if not results.multi_hand_landmarks:

            return jsonify({
                "prediction": "No hand",
                "confidence": "0.0%"
            })

        # Use first detected hand
        hand_landmarks = results.multi_hand_landmarks[0]

        x_ = []
        y_ = []

        for landmark in hand_landmarks.landmark:

            x_.append(landmark.x)
            y_.append(landmark.y)

        # Create normalized features
        data_aux = []

        min_x = min(x_)
        min_y = min(y_)

        for i in range(len(hand_landmarks.landmark)):

            data_aux.append(
                x_[i] - min_x
            )

            data_aux.append(
                y_[i] - min_y
            )

        # Match model feature size
        if len(data_aux) < max_len:

            data_aux += [0] * (
                max_len - len(data_aux)
            )

        elif len(data_aux) > max_len:

            data_aux = data_aux[:max_len]

        data_input = np.array(data_aux)

        # Prediction
        proba = model.predict_proba(
            [data_input]
        )[0]

        pred_idx = int(
            np.argmax(proba)
        )

        pred_char = labels_dict.get(
            pred_idx,
            "Unknown"
        )

        confidence = f"{max(proba) * 100:.1f}%"

        return jsonify({
            "prediction": pred_char,
            "confidence": confidence
        })

    except Exception as e:

        print("predict_image error:", str(e))

        return jsonify({
            "error": str(e)
        }), 400


# --------------------------------------------------
# PREDICT FROM LANDMARKS
# --------------------------------------------------

@app.route(
    '/predict_landmarks',
    methods=['POST', 'OPTIONS']
)
def predict_landmarks():

    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return '', 204

    try:

        data = request.get_json()

        if not data:
            return jsonify({
                "error": "No JSON data received"
            }), 400

        if 'landmarks' not in data:
            return jsonify({
                "error": "Landmarks missing"
            }), 400

        landmarks = data['landmarks']

        if not landmarks:
            return jsonify({
                "prediction": "No hand",
                "confidence": "0.0%"
            })

        x_ = [
            lm['x']
            for lm in landmarks
        ]

        y_ = [
            lm['y']
            for lm in landmarks
        ]

        min_x = min(x_)
        min_y = min(y_)

        data_aux = []

        for i in range(len(landmarks)):

            data_aux.append(
                x_[i] - min_x
            )

            data_aux.append(
                y_[i] - min_y
            )

        # Match model feature size
        if len(data_aux) < max_len:

            data_aux += [0] * (
                max_len - len(data_aux)
            )

        elif len(data_aux) > max_len:

            data_aux = data_aux[:max_len]

        data_input = np.asarray(
            data_aux
        )

        # Prediction
        proba = model.predict_proba(
            [data_input]
        )[0]

        pred_idx = int(
            np.argmax(proba)
        )

        pred_char = labels_dict.get(
            pred_idx,
            "Unknown"
        )

        confidence = f"{max(proba) * 100:.1f}%"

        return jsonify({
            "prediction": pred_char,
            "confidence": confidence
        })

    except Exception as e:

        print(
            "predict_landmarks error:",
            str(e)
        )

        return jsonify({
            "error": str(e)
        }), 400


# --------------------------------------------------
# RUN SERVER
# --------------------------------------------------

if __name__ == '__main__':

    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False
    )