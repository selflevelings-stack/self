import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Zap } from 'lucide-react';
import {
  PushupDetector,
  SquatDetector,
  SitupDetector,
  ExerciseDetector,
  Keypoint
} from '../utils/exerciseDetection';

interface LiveTrainingCameraProps {
  exerciseType: 'pushup' | 'squat' | 'situp';
  onRepsUpdate: (reps: number) => void;
  onFormUpdate: (feedback: string) => void;
  onClose: () => void;
  requiredReps: number;
  onComplete?: () => void;
}

declare global {
  interface Window {
    tf: any;
    poseDetection: any;
  }
}

export default function LiveTrainingCamera({
  exerciseType,
  onRepsUpdate,
  onFormUpdate,
  onClose,
  requiredReps,
  onComplete
}: LiveTrainingCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<ExerciseDetector | null>(null);
  const [reps, setReps] = useState(0);
  const [feedback, setFeedback] = useState('Initializing camera...');
  const [fps, setFps] = useState(0);
  const fpsRef = useRef(0);
  const lastTimeRef = useRef(Date.now());
  const detectorInstanceRef = useRef<any>(null);
  const animationIdRef = useRef<number | null>(null);
  const [librariesLoaded, setLibrariesLoaded] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const completionTriggeredRef = useRef(false);

  useEffect(() => {
    loadLibraries();
    return () => {
      stopCamera();
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      completionTriggeredRef.current = false;
      setIsComplete(false);
    };
  }, []);

  useEffect(() => {
    if (librariesLoaded) {
      initializeDetector();
      completionTriggeredRef.current = false;
      setIsComplete(false);
      setReps(0);
    }
  }, [exerciseType, librariesLoaded]);

  const loadLibraries = async () => {
    try {
      // Load TensorFlow
      if (!window.tf) {
        const tfScript = document.createElement('script');
        tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.18.0';
        tfScript.async = true;
        tfScript.onload = () => {
          const webglScript = document.createElement('script');
          webglScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@4.18.0';
          webglScript.async = true;
          webglScript.onload = () => {
            loadPoseDetectionLib();
          };
          document.head.appendChild(webglScript);
        };
        document.head.appendChild(tfScript);
      } else {
        loadPoseDetectionLib();
      }
    } catch (error) {
      console.error('Error loading libraries:', error);
      setFeedback('Failed to load AI libraries');
    }
  };

  const loadPoseDetectionLib = async () => {
    try {
      if (!window.poseDetection) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@1.1.0';
        script.async = true;
        script.onload = () => {
          setTimeout(() => {
            setLibrariesLoaded(true);
            initializeCamera();
          }, 100);
        };
        document.head.appendChild(script);
      } else {
        setLibrariesLoaded(true);
        initializeCamera();
      }
    } catch (error) {
      console.error('Error loading pose detection:', error);
      setFeedback('Failed to load pose detection');
    }
  };

  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          startDetection();
        };
      }
    } catch (error: any) {
      console.error('Camera access error:', error);

      let errorMessage = 'Camera access denied. Please enable camera permissions.';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please check your device.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Camera is not supported in this browser.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera does not meet the required specifications.';
      }

      setFeedback(errorMessage);
    }
  };

  const initializeDetector = () => {
    switch (exerciseType) {
      case 'pushup':
        detectorRef.current = new PushupDetector();
        break;
      case 'squat':
        detectorRef.current = new SquatDetector();
        break;
      case 'situp':
        detectorRef.current = new SitupDetector();
        break;
    }
  };

  const loadPoseDetector = async () => {
    if (detectorInstanceRef.current || !window.poseDetection) return;

    try {
      const detector = await window.poseDetection.createDetector(
        window.poseDetection.SupportedModels.MoveNet,
        {
          modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true
        }
      );
      detectorInstanceRef.current = detector;
      setFeedback('Ready to track!');
    } catch (error) {
      console.error('Failed to load pose detector:', error);
      setFeedback('Failed to initialize pose detector');
    }
  };

  const startDetection = async () => {
    await loadPoseDetector();
    detectFrame();
  };

  const detectFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !detectorInstanceRef.current || !detectorRef.current) {
      animationIdRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      animationIdRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const poses = await detectorInstanceRef.current.estimatePoses(video, {
        maxPoses: 1,
        flipHorizontal: false
      });

      if (poses.length > 0) {
        const pose = poses[0];
        const isNewRep = detectorRef.current.detectRep(pose as any);

        if (isNewRep) {
          const newReps = detectorRef.current.getReps();
          setReps(newReps);
          onRepsUpdate(newReps);

          if (newReps >= requiredReps && !completionTriggeredRef.current && onComplete) {
            completionTriggeredRef.current = true;
            setIsComplete(true);
            setFeedback('Mission Complete!');
            setTimeout(() => {
              onComplete();
            }, 1500);
          }
        }

        const formFeedback = (detectorRef.current as any).getFormFeedback?.() || 'Tracking...';
        setFeedback(formFeedback);
        onFormUpdate(formFeedback);

        drawPose(ctx, pose.keypoints as Keypoint[], canvas.width, canvas.height);
      }
    } catch (error) {
      console.error('Pose detection error:', error);
    }

    updateFps();
    animationIdRef.current = requestAnimationFrame(detectFrame);
  };

  const drawPose = (ctx: CanvasRenderingContext2D, keypoints: Keypoint[], width: number, height: number) => {
    const minScore = 0.3;
    const connections = [
      [5, 7], [7, 9], [6, 8], [8, 10],
      [5, 6], [5, 11], [6, 12],
      [11, 12], [11, 13], [13, 15],
      [12, 14], [14, 16], [0, 1],
      [0, 2], [1, 3], [2, 4]
    ];

    ctx.strokeStyle = '#00FF88';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#00FF88';

    connections.forEach(([start, end]) => {
      const kpStart = keypoints[start];
      const kpEnd = keypoints[end];

      if (kpStart?.score > minScore && kpEnd?.score > minScore) {
        ctx.beginPath();
        ctx.moveTo(kpStart.x, kpStart.y);
        ctx.lineTo(kpEnd.x, kpEnd.y);
        ctx.stroke();
      }
    });

    keypoints.forEach(kp => {
      if (kp.score > minScore) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  const updateFps = () => {
    fpsRef.current++;
    const now = Date.now();
    const elapsed = now - lastTimeRef.current;

    if (elapsed >= 1000) {
      setFps(fpsRef.current);
      fpsRef.current = 0;
      lastTimeRef.current = now;
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative w-full h-full bg-black rounded-lg overflow-hidden"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ filter: 'brightness(0.9)' }}
      />

      <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
        <div className="flex justify-between items-start">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="pointer-events-auto p-2 bg-red-500/30 hover:bg-red-500/50 border border-red-500 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-red-400" />
          </motion.button>

          <div className="text-xs text-cyan-400 bg-black/50 px-2 py-1 rounded">
            {fps} FPS
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: isComplete ? 1.1 : 1 }}
            className="text-center"
          >
            <motion.div
              key={reps}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: isComplete ? 1.2 : 1, opacity: 1 }}
              className={`text-6xl font-orbitron font-bold text-transparent bg-clip-text ${
                isComplete
                  ? 'bg-gradient-to-r from-green-400 via-emerald-400 to-green-400'
                  : 'bg-gradient-to-r from-cyan-400 via-green-400 to-cyan-400'
              }`}
            >
              {reps}
            </motion.div>
            <p className={`text-sm mt-2 ${isComplete ? 'text-green-400 font-bold' : 'text-cyan-300'}`}>
              {isComplete ? 'Complete!' : 'Reps'}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/70 border border-cyan-500/50 rounded-lg p-3 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 font-semibold">Form Check</span>
            </div>
            <p className="text-cyan-300 text-sm">{feedback}</p>
          </motion.div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-auto">
          Your camera feed never leaves your device. All tracking happens in real time.
        </p>
      </div>
    </motion.div>
  );
}
