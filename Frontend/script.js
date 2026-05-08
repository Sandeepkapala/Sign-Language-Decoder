

// Real MediaPipe Hands detection

let video = document.getElementById("video");
let canvas = document.createElement('canvas');
let ctx = canvas.getContext('2d');
let prediction = document.getElementById("prediction");
let stream;
let hands = null;
let cameraRaf = null;

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            video.play();
            loadHands();
        };
    } catch (error) {
        prediction.textContent = "Camera error";
    }
}

function loadHands() {
    // MediaPipe Hands
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js?r=0.1';
    script.onload = initHands;
    document.head.appendChild(script);
}

function initHands() {
    const mpHands = window.Hands;
    hands = new mpHands.Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });
    
    hands.onResults(onHandResults);
    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    prediction.textContent = "Show hand";
    cameraRaf = requestAnimationFrame(onFrame);
}

function onFrame() {
    if (!hands || !video.videoWidth) {
        cameraRaf = requestAnimationFrame(onFrame);
        return;
    }
    
    ctx.save();
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = canvas;
    
    hands.send({ image: frame }).then(() => {
        cameraRaf = requestAnimationFrame(onFrame);
    });
}

let lastPrediction = '';
function onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
        const landmarks = results.multiHandLandmarks[0];
        const landmarkData = landmarks.map(lm => ({
            x: lm.x,
            y: lm.y,
            z: lm.z
        }));
        predictSign(landmarkData);
    } else {
        if (lastPrediction !== '--') {
            prediction.textContent = '--';
            lastPrediction = '--';
        }
    }
}

async function predictSign(landmarks) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 100);
        
        const response = await fetch('http://localhost:5000/predict_landmarks', {
            method: 'POST',
            signal: controller.signal,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({landmarks})
        });
        clearTimeout(timeout);
        const data = await response.json();
        let display = data.prediction || '?';
        if (data.confidence) display += ` (${data.confidence})`;
        prediction.textContent = display;
    } catch (e) {
        prediction.textContent = '?';
    }
}

async function predictCurrentFrame() {
    if (!video.videoWidth || !canvas) {
        prediction.textContent = '? Camera not ready';
        return;
    }
    // Capture current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const response = await fetch('http://localhost:5000/predict_image', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({image: reader.result})
                });
                const data = await response.json();
                let display = data.prediction || '?';
                if (data.confidence) display += ` (${data.confidence})`;
                prediction.textContent = display;
                lastPrediction = display;
            } catch (e) {
                prediction.textContent = '? Error';
            }
        };
        reader.readAsDataURL(blob, 'image/jpeg');
    }, 'image/jpeg', 0.8);
}

function stopCamera() {
    if (cameraRaf) cancelAnimationFrame(cameraRaf);
    if (stream) stream.getTracks()[0].stop();
    prediction.textContent = "--";
}
