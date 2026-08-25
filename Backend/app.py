from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np
import cv2
import mediapipe as mp
import base64

app = Flask(__name__)
CORS(app)

model = None
labels_dict = {0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E',5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'V', 13: 'W', 14: 'Y'}
data_dict = None
max_len = 0

mp_hands = mp.solutions.hands
hands_model = mp_hands.Hands(static_image_mode=True, min_detection_confidence=0.3)

def load_resources():
    global model, data_dict, max_len
    model_dict = pickle.load(open('model.p', 'rb'))
    model = model_dict['model']
    
    data_dict = pickle.load(open('data.pickle', 'rb'))
    data = np.array(data_dict['data'], dtype=object)
    max_len = max(len(i) for i in data)
    print(f"Model loaded. Max len: {max_len}")

load_resources()
print("Backend ready - No login required")

@app.route('/predict_image', methods=['POST'])
def predict_image():
    try:
        data = request.json
        img_b64 = data['image']
        img_bytes = base64.b64decode(img_b64.split(',')[1])
        
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        results = hands_model.process(img_rgb)
        if results.multi_hand_landmarks:
            data_aux = []
            x_ = []
            y_ = []
            # Only process the first hand to maintain 42 features
            hand_landmarks = results.multi_hand_landmarks[0]
            
            for i in range(len(hand_landmarks.landmark)):
                x = hand_landmarks.landmark[i].x
                y = hand_landmarks.landmark[i].y
                x_.append(x)
                y_.append(y)
            
            for i in range(len(hand_landmarks.landmark)):
                x = hand_landmarks.landmark[i].x
                y = hand_landmarks.landmark[i].y
                data_aux.append(x - min(x_))
                data_aux.append(y - min(y_))
            
            # Ensure fixed length (42) for prediction if model expects 42
            # or pad if model is older and expects max_len
            if len(data_aux) < max_len:
                data_aux += [0] * (max_len - len(data_aux))
            elif len(data_aux) > max_len:
                data_aux = data_aux[:max_len]
            
            data_input = np.array(data_aux)
            proba = model.predict_proba([data_input])[0]
            pred_idx = np.argmax(proba)
            pred_char = labels_dict[pred_idx]
            confidence = f'{max(proba)*100:.1f}%'
            return jsonify({'prediction': pred_char, 'confidence': confidence})
        return jsonify({'prediction': 'No hand', 'confidence': '0.0%'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/predict_landmarks', methods=['POST'])
def predict_landmarks():
    try:
        data = request.json
        landmarks = data['landmarks']
        x_ = [lm['x'] for lm in landmarks]
        y_ = [lm['y'] for lm in landmarks]
        # Backend usually receives 21 landmarks for 1 hand from Frontend
        data_aux = []
        for i in range(len(landmarks)):
            data_aux.append(x_[i] - min(x_))
            data_aux.append(y_[i] - min(y_))
        
        # Consistent padding logic
        if len(data_aux) < max_len:
            data_aux += [0] * (max_len - len(data_aux))
        elif len(data_aux) > max_len:
            data_aux = data_aux[:max_len]
        
        data_input = np.asarray(data_aux)
        proba = model.predict_proba([data_input])[0]
        pred_idx = np.argmax(proba)
        pred_char = labels_dict[pred_idx]
        confidence = f'{max(proba)*100:.1f}%'
        return jsonify({'prediction': pred_char, 'confidence': confidence})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/')
def health():
    return f"Sign API ready! Max data len: {max_len}. Public endpoints: /predict_landmarks /predict_image /"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

