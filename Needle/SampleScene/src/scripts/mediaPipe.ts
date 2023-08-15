// START MARKER using mediapipe with hands
import { FilesetResolver, HandLandmarker, HandLandmarkerResult, NormalizedLandmark, GestureRecognizer, GestureRecognizerResult } from "@mediapipe/tasks-vision";
import { Behaviour, Mathf, serializable, showBalloonMessage } from "@needle-tools/engine";
import { ParticleSphere } from "./ParticleSphere";

export class MediapipeHands extends Behaviour {

    @serializable(ParticleSphere)
    spheres: ParticleSphere[] = [];

    public showWebcam : Boolean = true;
    private _video!: HTMLVideoElement;
    private _handLandmarker!: HandLandmarker;
    private _gestureRecognizer!: GestureRecognizer;
    private _zPos : number = -10;

    async awake() {
        showBalloonMessage("Initializing Hand Tracking...")

        const vision = await FilesetResolver.forVisionTasks(
            // path/to/wasm/root
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        this._handLandmarker = await HandLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
                    delegate: "GPU"
                },
                numHands: 1
            });

        this._gestureRecognizer = await GestureRecognizer.createFromOptions(
            vision, 
            {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                    delegate: "GPU"
                },
            });

        //@ts-ignore
        await Promise.all([this._gestureRecognizer.setOptions({ runningMode: "VIDEO" }), await this._handLandmarker.setOptions({ runningMode: "VIDEO" })]);


        this._video = document.createElement("video");
        this._video.autoplay = true;
        this._video.playsInline = true;
        this.context.domElement.appendChild(this._video);
        this.startWebcam(this._video);
    }

    private _lastVideoTime: number = 0;

    update(): void {
        if (!this._video || !this._handLandmarker) return;
        const video = this._video;
        if (video.currentTime !== this._lastVideoTime) {
            let startTimeMs = performance.now();
            const detections = this._handLandmarker.detectForVideo(video, startTimeMs);
            const gestureDetections = this._gestureRecognizer.recognizeForVideo(video, startTimeMs);
            this.processResults(detections, gestureDetections);
    
            this._lastVideoTime = video.currentTime;
        }

        if (this.showWebcam) {
            this._video.style.display = 'block';
        } else {
            this._video.style.display = 'none';
        }
    }

    private processResults(handResults: HandLandmarkerResult, gestureResults: GestureRecognizerResult) {
        const hand1 = handResults.landmarks[0];
        // check if we have even one hand
        if (!hand1 && gestureResults.gestures.length) return;

        if (hand1 && hand1.length >= 4 && this.spheres[0] && gestureResults.gestures.length > 0) {
            const pos = hand1[4];
            const categoryName = gestureResults.gestures[0][0].categoryName;
            this.processLandmark(this.spheres[0], pos, categoryName);
        }
    }

    private processLandmark(sphere: ParticleSphere, pos: NormalizedLandmark, categoryName: String) {
        // Push
        if (categoryName === 'Open_Palm') {
            this._zPos++;
        // Pull
        } else if (categoryName === 'Closed_Fist') {
            this._zPos--;
        }

        const px = Mathf.remap(pos.x, 0, 1, -24, 24);
        const py = Mathf.remap(pos.y, 0, 1, 12, -12);
        const pz = Mathf.clamp(this._zPos, -10, 10);

        sphere.setTarget(px, py, pz);
    }

    private async startWebcam(video: HTMLVideoElement) {
        const constraints = { video: true, audio: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
    }
}