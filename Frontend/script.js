// Text-to-Speech

let speechEnabled = true;
let lastSpokenPrediction = '';
let speechCooldown = false;

// Render Backend URL
const API_BASE_URL = 'https://sign-language-backend.onrender.com';

function speakPrediction(text = null) {

    let textToSpeak = text || prediction.textContent;

    // Remove confidence percentage
    textToSpeak = textToSpeak.replace(/\s*\([^)]*\)/g, '').trim();

    // Don't speak invalid results
    if (
        !textToSpeak ||
        textToSpeak === '--' ||
        textToSpeak === '?' ||
        textToSpeak === 'No hand' ||
        textToSpeak === 'Camera error'
    ) {
        return;
    }

    // Prevent speaking the same prediction continuously
    if (textToSpeak === lastSpokenPrediction && speechCooldown) {
        return;
    }

    lastSpokenPrediction = textToSpeak;
    speechCooldown = true;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);

    // Allow same sign to be spoken again after 2 seconds
    setTimeout(() => {
        speechCooldown = false;
    }, 2000);
}


// Real MediaPipe Hands detection

let video = document.getElementById("video");

let canvas = document.createElement('canvas');
let ctx = canvas.getContext('2d');

let prediction = document.getElementById("prediction");
let savedOutput = document.getElementById("savedOutput");


// Stores the complete detected sentence
let savedText = "";

// Prevent the same prediction from being added repeatedly
let lastSavedPrediction = "";
let lastSavedTime = 0;


function addToSavedOutput(text) {

    if (!text) return;

    // Remove confidence percentage if present
    text = text.replace(/\s*\([^)]*\)/g, '').trim();

    if (
        text === "?" ||
        text === "--" ||
        text === "Show hand" ||
        text === "Camera error"
    ) {
        return;
    }

    const now = Date.now();

    // Prevent the same sign from being added continuously
    if (
        text === lastSavedPrediction &&
        now - lastSavedTime < 1500
    ) {
        return;
    }

    lastSavedPrediction = text;
    lastSavedTime = now;

    savedText += text;

    savedOutput.textContent = savedText;
}


function addSpace() {

    // Don't add multiple spaces
    if (savedText.length === 0) return;

    if (!savedText.endsWith(" ")) {
        savedText += " ";
        savedOutput.textContent = savedText;
    }
}


function backspaceOutput() {

    if (savedText.length === 0) return;

    savedText = savedText.slice(0, -1);

    savedOutput.textContent = savedText;
}


function clearOutput() {

    savedText = "";
    savedOutput.textContent = "";

    // Reset prediction tracking
    lastSavedPrediction = "";
    lastSavedTime = 0;
}


function speakSavedOutput() {

    // Get exactly what is currently saved
    const textToSpeak = savedText.trim();

    // Don't speak if empty
    if (!textToSpeak) {
        return;
    }

    // Stop previous speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
}


let stream;
let hands = null;
let cameraRaf = null;


async function startCamera() {

    try {

        stream = await navigator.mediaDevices.getUserMedia({
            video: true
        });

        video.srcObject = stream;

        video.onloadedmetadata = () => {

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            video.play();

            loadHands();
        };

    } catch (error) {

        console.error("Camera error:", error);

        prediction.textContent = "Camera error";
    }
}


function loadHands() {

    // MediaPipe Hands
    const script = document.createElement('script');

    script.src =
        'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js?r=0.1';

    script.onload = initHands;

    script.onerror = () => {
        prediction.textContent = "MediaPipe error";
    };

    document.head.appendChild(script);
}


function initHands() {

    const HandsClass = window.Hands;

    if (!HandsClass) {
        console.error("MediaPipe Hands library not loaded");
        prediction.textContent = "MediaPipe error";
        return;
    }

    hands = new HandsClass({
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

    ctx.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.restore();


    const frame = canvas;


    hands.send({
        image: frame
    }).then(() => {

        cameraRaf = requestAnimationFrame(onFrame);

    }).catch((error) => {

        console.error("MediaPipe error:", error);

        cameraRaf = requestAnimationFrame(onFrame);
    });
}


let lastPrediction = '';


function onHandResults(results) {

    if (
        results.multiHandLandmarks &&
        results.multiHandLandmarks[0]
    ) {

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

        // Render can take a few seconds to respond
        const timeout = setTimeout(() => {
            controller.abort();
        }, 10000);


        const response = await fetch(
            `${API_BASE_URL}/predict_landmarks`,
            {
                method: 'POST',

                signal: controller.signal,

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    landmarks: landmarks
                })
            }
        );


        clearTimeout(timeout);


        if (!response.ok) {
            throw new Error(
                `Server returned ${response.status}`
            );
        }


        const data = await response.json();


        let display = data.prediction || '?';


        if (data.confidence) {
            display += ` (${data.confidence})`;
        }


        prediction.textContent = display;

        lastPrediction = display;


        if (data.prediction) {

            speakPrediction(data.prediction);

            addToSavedOutput(data.prediction);
        }


    } catch (e) {

        console.error("Prediction error:", e);

        prediction.textContent = '?';
    }
}


async function predictCurrentFrame() {

    if (!video.videoWidth || !canvas) {

        prediction.textContent = '? Camera not ready';

        return;
    }


    // Capture current frame
    ctx.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );


    canvas.toBlob(async (blob) => {

        if (!blob) {

            prediction.textContent = '? Image error';

            return;
        }


        const reader = new FileReader();


        reader.onload = async () => {

            try {

                const response = await fetch(
                    `${API_BASE_URL}/predict_image`,
                    {
                        method: 'POST',

                        headers: {
                            'Content-Type': 'application/json'
                        },

                        body: JSON.stringify({
                            image: reader.result
                        })
                    }
                );


                if (!response.ok) {

                    throw new Error(
                        `Server returned ${response.status}`
                    );
                }


                const data = await response.json();


                let display = data.prediction || '?';


                if (data.confidence) {

                    display += ` (${data.confidence})`;
                }


                prediction.textContent = display;

                lastPrediction = display;


                if (data.prediction) {

                    speakPrediction(data.prediction);

                    addToSavedOutput(data.prediction);
                }


            } catch (e) {

                console.error(
                    "Image prediction error:",
                    e
                );

                prediction.textContent = '? Error';
            }
        };


        reader.readAsDataURL(blob, 'image/jpeg');

    }, 'image/jpeg', 0.8);
}


function stopCamera() {

    if (cameraRaf) {

        cancelAnimationFrame(cameraRaf);

        cameraRaf = null;
    }


    if (stream) {

        stream.getTracks().forEach(track => {
            track.stop();
        });

        stream = null;
    }


    video.srcObject = null;

    prediction.textContent = "--";
}