// =========================================================
// API
// =========================================================

const API_BASE_URL =
    "https://sign-language-backend.onrender.com";


// =========================================================
// TEXT TO SPEECH
// =========================================================

let speechEnabled = true;

let lastSpokenPrediction = "";

let speechCooldown = false;


function speakPrediction(text = null) {

    let textToSpeak =
        text || prediction.textContent;

    // Remove confidence
    textToSpeak =
        textToSpeak
            .replace(/\s*\([^)]*\)/g, "")
            .trim();


    // Ignore invalid results
    if (
        !textToSpeak ||
        textToSpeak === "--" ||
        textToSpeak === "?" ||
        textToSpeak === "No hand" ||
        textToSpeak === "Camera error" ||
        textToSpeak === "Show hand"
    ) {
        return;
    }


    // Prevent continuous speaking
    if (
        textToSpeak === lastSpokenPrediction &&
        speechCooldown
    ) {
        return;
    }


    lastSpokenPrediction =
        textToSpeak;

    speechCooldown = true;


    window.speechSynthesis.cancel();


    const utterance =
        new SpeechSynthesisUtterance(
            textToSpeak
        );


    utterance.lang = "en-US";

    utterance.rate = 0.9;

    utterance.pitch = 1;

    utterance.volume = 1;


    window.speechSynthesis.speak(
        utterance
    );


    setTimeout(() => {

        speechCooldown = false;

    }, 2000);
}


// =========================================================
// DOM ELEMENTS
// =========================================================

let video =
    document.getElementById("video");


let canvas =
    document.createElement("canvas");


let ctx =
    canvas.getContext("2d");


let prediction =
    document.getElementById(
        "prediction"
    );


let savedOutput =
    document.getElementById(
        "savedOutput"
    );


// =========================================================
// SAVED OUTPUT
// =========================================================

let savedText = "";

let lastSavedPrediction = "";

let lastSavedTime = 0;


function addToSavedOutput(text) {

    if (!text) {
        return;
    }


    // Remove confidence
    text =
        text
            .replace(/\s*\([^)]*\)/g, "")
            .trim();


    // Ignore invalid results
    if (
        text === "?" ||
        text === "--" ||
        text === "Show hand" ||
        text === "Camera error" ||
        text === "No hand"
    ) {
        return;
    }


    const now =
        Date.now();


    // Prevent repeated same sign
    if (
        text === lastSavedPrediction &&
        now - lastSavedTime < 1500
    ) {
        return;
    }


    lastSavedPrediction =
        text;

    lastSavedTime =
        now;


    savedText += text;

    savedOutput.textContent =
        savedText;
}


function addSpace() {

    if (savedText.length === 0) {
        return;
    }


    if (!savedText.endsWith(" ")) {

        savedText += " ";

        savedOutput.textContent =
            savedText;
    }
}


function backspaceOutput() {

    if (savedText.length === 0) {
        return;
    }


    savedText =
        savedText.slice(0, -1);


    savedOutput.textContent =
        savedText;
}


function clearOutput() {

    savedText = "";

    savedOutput.textContent = "";

    lastSavedPrediction = "";

    lastSavedTime = 0;
}


function speakSavedOutput() {

    const textToSpeak =
        savedText.trim();


    if (!textToSpeak) {
        return;
    }


    window.speechSynthesis.cancel();


    const utterance =
        new SpeechSynthesisUtterance(
            textToSpeak
        );


    utterance.lang = "en-US";

    utterance.rate = 0.9;

    utterance.pitch = 1;

    utterance.volume = 1;


    window.speechSynthesis.speak(
        utterance
    );
}


// =========================================================
// CAMERA VARIABLES
// =========================================================

let stream = null;

let hands = null;

let cameraRaf = null;


// =========================================================
// START CAMERA
// =========================================================

async function startCamera() {

    try {

        stream =
            await navigator.mediaDevices
                .getUserMedia({
                    video: true,
                    audio: false
                });


        video.srcObject =
            stream;


        video.onloadedmetadata =
            () => {

                canvas.width =
                    video.videoWidth;

                canvas.height =
                    video.videoHeight;


                video.play();


                loadHands();
            };

    } catch (error) {

        console.error(
            "Camera error:",
            error
        );

        prediction.textContent =
            "Camera error";
    }
}


// =========================================================
// LOAD MEDIAPIPE
// =========================================================

function loadHands() {

    // Already loaded
    if (window.Hands) {

        console.log(
            "MediaPipe already loaded"
        );

        initHands();

        return;
    }


    const script =
        document.createElement(
            "script"
        );


    script.src =
        "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";


    script.onload =
        () => {

            console.log(
                "MediaPipe Hands script loaded"
            );

            initHands();
        };


    script.onerror =
        () => {

            console.error(
                "Failed to load MediaPipe Hands"
            );

            prediction.textContent =
                "MediaPipe error";
        };


    document.head.appendChild(
        script
    );
}


// =========================================================
// INITIALIZE MEDIAPIPE
// =========================================================

function initHands() {

    const HandsClass =
        window.Hands;


    if (!HandsClass) {

        console.error(
            "window.Hands is not available"
        );

        prediction.textContent =
            "MediaPipe error";

        return;
    }


    console.log(
        "MediaPipe constructor:",
        HandsClass
    );


    // IMPORTANT:
    // window.Hands itself is the constructor
    hands =
        new HandsClass({

            locateFile: (file) => {

                return (
                    "https://cdn.jsdelivr.net/npm/" +
                    "@mediapipe/hands/" +
                    file
                );
            }

        });


    hands.setOptions({

        maxNumHands: 1,

        modelComplexity: 0,

        minDetectionConfidence: 0.5,

        minTrackingConfidence: 0.5

    });


    hands.onResults(
        onHandResults
    );


    console.log(
        "MediaPipe Hands initialized successfully"
    );


    prediction.textContent =
        "Show hand";


    if (cameraRaf) {

        cancelAnimationFrame(
            cameraRaf
        );
    }


    cameraRaf =
        requestAnimationFrame(
            onFrame
        );
}


// =========================================================
// PROCESS CAMERA FRAME
// =========================================================

function onFrame() {

    if (
        !hands ||
        !video.videoWidth
    ) {

        cameraRaf =
            requestAnimationFrame(
                onFrame
            );

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


    const frame =
        canvas;


    hands.send({
        image: frame
    })
    .then(() => {

        cameraRaf =
            requestAnimationFrame(
                onFrame
            );

    })
    .catch((error) => {

        console.error(
            "MediaPipe frame error:",
            error
        );

        cameraRaf =
            requestAnimationFrame(
                onFrame
            );
    });
}


// =========================================================
// MEDIAPIPE RESULTS
// =========================================================

function onHandResults(
    results
) {

    if (
        results.multiHandLandmarks &&
        results.multiHandLandmarks.length > 0
    ) {

        const landmarks =
            results
                .multiHandLandmarks[0];


        const landmarkData =
            landmarks.map(
                (lm) => ({

                    x: lm.x,

                    y: lm.y,

                    z: lm.z

                })
            );


        predictSign(
            landmarkData
        );

    } else {

        if (
            lastPrediction !== "--"
        ) {

            prediction.textContent =
                "--";

            lastPrediction =
                "--";
        }
    }
}


// =========================================================
// PREDICT LANDMARKS
// =========================================================

async function predictSign(
    landmarks
) {

    try {

        const controller =
            new AbortController();


        const timeout =
            setTimeout(() => {

                controller.abort();

            }, 10000);


        const response =
            await fetch(
                `${API_BASE_URL}/predict_landmarks`,
                {

                    method: "POST",

                    signal: controller.signal,

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        landmarks:
                            landmarks
                    })

                }
            );


        clearTimeout(
            timeout
        );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const data =
            await response.json();


        let display =
            data.prediction || "?";


        if (data.confidence) {

            display +=
                ` (${data.confidence})`;
        }


        prediction.textContent =
            display;


        lastPrediction =
            display;


        if (data.prediction) {

            speakPrediction(
                data.prediction
            );


            addToSavedOutput(
                data.prediction
            );
        }

    } catch (error) {

        console.error(
            "Landmark prediction error:",
            error
        );

    }
}


// =========================================================
// PREDICT CURRENT IMAGE
// =========================================================

async function predictCurrentFrame() {

    if (
        !video.videoWidth ||
        !canvas
    ) {

        prediction.textContent =
            "? Camera not ready";

        return;
    }


    // Capture frame
    ctx.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );


    canvas.toBlob(
        async (blob) => {

            if (!blob) {

                prediction.textContent =
                    "? Image error";

                return;
            }


            const reader =
                new FileReader();


            reader.onload =
                async () => {

                    try {

                        const response =
                            await fetch(
                                `${API_BASE_URL}/predict_image`,
                                {

                                    method:
                                        "POST",

                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    },

                                    body:
                                        JSON.stringify({
                                            image:
                                                reader.result
                                        })
                                }
                            );


                        if (!response.ok) {

                            throw new Error(
                                `HTTP ${response.status}`
                            );
                        }


                        const data =
                            await response.json();


                        let display =
                            data.prediction ||
                            "?";


                        if (
                            data.confidence
                        ) {

                            display +=
                                ` (${data.confidence})`;
                        }


                        prediction.textContent =
                            display;


                        lastPrediction =
                            display;


                        if (
                            data.prediction
                        ) {

                            speakPrediction(
                                data.prediction
                            );


                            addToSavedOutput(
                                data.prediction
                            );
                        }

                    } catch (error) {

                        console.error(
                            "Image prediction error:",
                            error
                        );

                        prediction.textContent =
                            "? Error";
                    }
                };


            reader.readAsDataURL(
                blob
            );

        },
        "image/jpeg",
        0.8
    );
}


// =========================================================
// STOP CAMERA
// =========================================================

function stopCamera() {

    if (cameraRaf) {

        cancelAnimationFrame(
            cameraRaf
        );

        cameraRaf = null;
    }


    if (stream) {

        stream
            .getTracks()
            .forEach(
                (track) => {
                    track.stop();
                }
            );

        stream = null;
    }


    video.srcObject = null;

    hands = null;

    prediction.textContent =
        "--";
}