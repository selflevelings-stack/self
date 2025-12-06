export interface Keypoint {
  x: number;
  y: number;
  score: number;
}

export interface Pose {
  keypoints: Keypoint[];
  score: number;
}

const calculateDistance = (p1: Keypoint, p2: Keypoint): number => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
};

const calculateAngle = (a: Keypoint, b: Keypoint, c: Keypoint): number => {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };

  const dotProduct = ba.x * bc.x + ba.y * bc.y;
  const baLength = Math.sqrt(ba.x ** 2 + ba.y ** 2);
  const bcLength = Math.sqrt(bc.x ** 2 + bc.y ** 2);

  if (baLength === 0 || bcLength === 0) return 0;

  const cosAngle = dotProduct / (baLength * bcLength);
  return Math.acos(Math.min(1, Math.max(-1, cosAngle))) * (180 / Math.PI);
};

const getKeypoint = (pose: Pose, index: number): Keypoint | null => {
  const kp = pose.keypoints[index];
  return kp && kp.score > 0.3 ? kp : null;
};

const getMeanConfidence = (keypoints: (Keypoint | null)[]): number => {
  const validKeypoints = keypoints.filter(kp => kp !== null) as Keypoint[];
  if (validKeypoints.length === 0) return 0;
  return validKeypoints.reduce((sum, kp) => sum + kp.score, 0) / validKeypoints.length;
};

export class ExerciseDetector {
  protected lastReps = 0;
  protected isInDownPosition = false;
  protected lastAngle = 0;
  protected formQuality = 'Good';
  protected frameCount = 0;
  protected lastRepFrameCount = 0;

  abstract detectRep(pose: Pose): boolean;

  getReps(): number {
    return this.lastReps;
  }

  getFormFeedback(): string {
    return this.formQuality;
  }

  reset(): void {
    this.lastReps = 0;
    this.isInDownPosition = false;
    this.lastAngle = 0;
    this.frameCount = 0;
    this.lastRepFrameCount = 0;
  }
}

export class PushupDetector extends ExerciseDetector {
  private startPositionThreshold = 150;
  private endPositionThreshold = 25;
  private framesBetweenReps = 10;
  private minFormQuality = 0.5;

  detectRep(pose: Pose): boolean {
    this.frameCount++;
    const leftShoulder = getKeypoint(pose, 5);
    const leftElbow = getKeypoint(pose, 7);
    const leftWrist = getKeypoint(pose, 9);
    const rightShoulder = getKeypoint(pose, 6);
    const rightElbow = getKeypoint(pose, 8);
    const rightWrist = getKeypoint(pose, 10);

    if (!leftElbow || !rightElbow) {
      this.formQuality = 'Position body with arms visible';
      return false;
    }

    const confidence = getMeanConfidence([leftShoulder, leftElbow, leftWrist, rightShoulder, rightElbow, rightWrist]);

    let elbowAngle = 180;
    if (leftShoulder && leftWrist) {
      elbowAngle = Math.min(
        elbowAngle,
        calculateAngle(leftShoulder, leftElbow, leftWrist)
      );
    }
    if (rightShoulder && rightWrist) {
      elbowAngle = Math.min(
        elbowAngle,
        calculateAngle(rightShoulder, rightElbow, rightWrist)
      );
    }

    this.lastAngle = elbowAngle;

    if (confidence < this.minFormQuality) {
      this.formQuality = 'Low visibility - adjust your position';
      return false;
    }

    const wasDown = this.isInDownPosition;
    this.isInDownPosition = elbowAngle < this.endPositionThreshold;

    let repCounted = false;

    if (wasDown && !this.isInDownPosition) {
      if (elbowAngle > this.startPositionThreshold && this.frameCount - this.lastRepFrameCount > this.framesBetweenReps) {
        this.lastReps++;
        this.lastRepFrameCount = this.frameCount;
        repCounted = true;
        this.formQuality = 'Perfect! Rep counted';
      } else if (elbowAngle < this.startPositionThreshold) {
        this.formQuality = 'Incomplete rep - extend fully';
      }
    } else {
      if (this.isInDownPosition) {
        if (elbowAngle < 15) {
          this.formQuality = 'Perfect form! Keep going';
        } else if (elbowAngle < 50) {
          this.formQuality = 'Good form - go lower';
        } else {
          this.formQuality = 'Go lower for full rep';
        }
      } else {
        this.formQuality = 'Ready - Lower your body';
      }
    }

    return repCounted;
  }
}

export class SquatDetector extends ExerciseDetector {
  private startPositionThreshold = 140;
  private endPositionThreshold = 85;
  private framesBetweenReps = 10;
  private minFormQuality = 0.5;

  detectRep(pose: Pose): boolean {
    this.frameCount++;
    const leftHip = getKeypoint(pose, 11);
    const leftKnee = getKeypoint(pose, 13);
    const leftAnkle = getKeypoint(pose, 15);
    const rightHip = getKeypoint(pose, 12);
    const rightKnee = getKeypoint(pose, 14);
    const rightAnkle = getKeypoint(pose, 16);

    if (!leftKnee || !rightKnee) {
      this.formQuality = 'Position legs for detection';
      return false;
    }

    const confidence = getMeanConfidence([leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle]);

    let kneeAngle = 180;
    if (leftHip && leftAnkle) {
      kneeAngle = Math.min(
        kneeAngle,
        calculateAngle(leftHip, leftKnee, leftAnkle)
      );
    }
    if (rightHip && rightAnkle) {
      kneeAngle = Math.min(
        kneeAngle,
        calculateAngle(rightHip, rightKnee, rightAnkle)
      );
    }

    this.lastAngle = kneeAngle;

    if (confidence < this.minFormQuality) {
      this.formQuality = 'Low visibility - adjust your position';
      return false;
    }

    const wasDown = this.isInDownPosition;
    this.isInDownPosition = kneeAngle < this.endPositionThreshold;

    let repCounted = false;

    if (wasDown && !this.isInDownPosition) {
      if (kneeAngle > this.startPositionThreshold && this.frameCount - this.lastRepFrameCount > this.framesBetweenReps) {
        this.lastReps++;
        this.lastRepFrameCount = this.frameCount;
        repCounted = true;
        this.formQuality = 'Perfect! Rep counted';
      } else if (kneeAngle < this.startPositionThreshold) {
        this.formQuality = 'Incomplete rep - stand up fully';
      }
    } else {
      if (this.isInDownPosition) {
        if (kneeAngle < 80) {
          this.formQuality = 'Excellent depth!';
        } else if (kneeAngle < 100) {
          this.formQuality = 'Good depth - keep going';
        } else {
          this.formQuality = 'Go lower for full squat';
        }
      } else {
        this.formQuality = 'Ready - Squat down';
      }
    }

    return repCounted;
  }
}

export class SitupDetector extends ExerciseDetector {
  private startPositionThreshold = 140;
  private endPositionThreshold = 100;
  private framesBetweenReps = 10;
  private minFormQuality = 0.5;

  detectRep(pose: Pose): boolean {
    this.frameCount++;
    const nose = getKeypoint(pose, 0);
    const leftHip = getKeypoint(pose, 11);
    const rightHip = getKeypoint(pose, 12);
    const leftShoulder = getKeypoint(pose, 5);
    const rightShoulder = getKeypoint(pose, 6);

    if (!nose || !leftHip || !rightHip) {
      this.formQuality = 'Position your body fully';
      return false;
    }

    const confidence = getMeanConfidence([nose, leftHip, rightHip, leftShoulder, rightShoulder]);

    const hipMidpoint = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
      score: 0.5
    };

    const torsoDistance = calculateDistance(nose, hipMidpoint);
    const normalizedAngle = Math.min(torsoDistance * 50, 180);

    this.lastAngle = normalizedAngle;

    if (confidence < this.minFormQuality) {
      this.formQuality = 'Low visibility - adjust position';
      return false;
    }

    const wasDown = this.isInDownPosition;
    this.isInDownPosition = normalizedAngle < this.endPositionThreshold;

    let repCounted = false;

    if (wasDown && !this.isInDownPosition) {
      if (normalizedAngle > this.startPositionThreshold && this.frameCount - this.lastRepFrameCount > this.framesBetweenReps) {
        this.lastReps++;
        this.lastRepFrameCount = this.frameCount;
        repCounted = true;
        this.formQuality = 'Perfect! Rep counted';
      } else if (normalizedAngle < this.startPositionThreshold) {
        this.formQuality = 'Incomplete rep - lie back fully';
      }
    } else {
      if (this.isInDownPosition) {
        if (normalizedAngle < 90) {
          this.formQuality = 'Great curl! Complete it';
        } else {
          this.formQuality = 'Keep curling up';
        }
      } else {
        this.formQuality = 'Ready - Curl up';
      }
    }

    return repCounted;
  }
}
