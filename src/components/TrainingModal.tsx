import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Shield, Lock } from 'lucide-react';
import LiveTrainingCamera from './LiveTrainingCamera';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface TrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRank: string;
  onSessionComplete: (xpEarned: number, repsCompleted: number) => void;
  requiredReps?: number;
}

const EXERCISE_XP = {
  pushup: 2,
  squat: 2,
  situp: 1.5
};

const RANK_MULTIPLIERS: Record<string, number> = {
  E: 1.0,
  D: 1.5,
  C: 2.0,
  B: 2.5,
  A: 3.0,
  S: 3.5,
  SS: 4.0
};

interface ExerciseInfo {
  id: 'pushup' | 'squat' | 'situp';
  name: string;
  description: string;
  xpPerRep: number;
  icon: string;
}

const EXERCISES: ExerciseInfo[] = [
  {
    id: 'pushup',
    name: 'Push-ups',
    description: 'Track elbow and shoulder angle for perfect form',
    xpPerRep: 2,
    icon: '💪'
  },
  {
    id: 'squat',
    name: 'Squats',
    description: 'Monitor knee and hip angle depth',
    xpPerRep: 2,
    icon: '🏋️'
  },
  {
    id: 'situp',
    name: 'Sit-ups',
    description: 'Measure torso curl completion',
    xpPerRep: 1.5,
    icon: '🤸'
  }
];

export default function TrainingModal({
  isOpen,
  onClose,
  userRank,
  onSessionComplete,
  requiredReps = 10
}: TrainingModalProps) {
  const { user } = useAuth();
  const [selectedExercise, setSelectedExercise] = useState<'pushup' | 'squat' | 'situp' | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [reps, setReps] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [formFeedback, setFormFeedback] = useState('');

  const multiplier = RANK_MULTIPLIERS[userRank] || 1.0;

  const handleStartTraining = (exercise: 'pushup' | 'squat' | 'situp') => {
    setSelectedExercise(exercise);
    setIsTraining(true);
    setReps(0);
    setSessionStartTime(Date.now());
  };

  const handleEndSession = async () => {
    if (!user || !sessionStartTime || reps < requiredReps) {
      if (reps < requiredReps) {
        toast.error(`You need at least ${requiredReps} reps to complete this mission! (${reps}/${requiredReps})`);
      }
      return;
    }

    try {
      const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
      const baseXP = Math.floor(reps * (EXERCISE_XP[selectedExercise!] || 1));
      const xpEarned = Math.floor(baseXP * multiplier);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('total_xp, streak_days, last_active')
        .eq('id', user.id)
        .maybeSingle();

      if (userError) throw userError;

      const today = new Date().toISOString().split('T')[0];
      const lastActive = userData?.last_active ? new Date(userData.last_active).toISOString().split('T')[0] : null;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      let newStreakDays = userData?.streak_days || 0;
      if (lastActive !== today) {
        if (lastActive === yesterday) {
          newStreakDays += 1;
        } else {
          newStreakDays = 1;
        }
      }

      await supabase.from('exercise_sessions').insert({
        user_id: user.id,
        exercise_type: selectedExercise,
        reps_completed: reps,
        xp_earned: xpEarned,
        session_duration: sessionDuration
      });

      const newTotalXp = (userData?.total_xp || 0) + xpEarned;
      await supabase
        .from('users')
        .update({
          total_xp: newTotalXp,
          streak_days: newStreakDays,
          last_active: new Date().toISOString()
        })
        .eq('id', user.id);

      toast.success(`+${xpEarned} XP earned! ${reps} reps completed!`);
      setIsTraining(false);
      setSelectedExercise(null);
      setReps(0);
      setSessionStartTime(null);
      onSessionComplete(xpEarned, reps);
      onClose();
    } catch (error) {
      console.error('Error saving session:', error);
      toast.error('Failed to save training session');
    }
  };

  const handleCameraClose = () => {
    toast.error(`Session cancelled. Complete at least ${requiredReps} reps to finish your mission!`);
    setIsTraining(false);
    setSelectedExercise(null);
    setReps(0);
    setSessionStartTime(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-cyan-500/30 rounded-2xl overflow-hidden flex flex-col"
          >
            {isTraining ? (
              <>
                <div className="flex justify-between items-center p-4 border-b border-cyan-500/30">
                  <h2 className="text-xl font-orbitron text-cyan-400">
                    {EXERCISES.find(e => e.id === selectedExercise)?.name}
                  </h2>
                  <motion.button
                    onClick={handleEndSession}
                    disabled={reps < requiredReps}
                    className={`px-4 py-2 border rounded-lg font-semibold transition-all ${
                      reps >= requiredReps
                        ? 'bg-green-500/20 hover:bg-green-500/40 border-green-500 text-green-400'
                        : 'bg-gray-500/10 border-gray-600 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {reps >= requiredReps ? 'End Session' : `${reps}/${requiredReps} Reps`}
                  </motion.button>
                </div>
                <div className="flex-1 min-h-[400px] flex items-center justify-center">
                  <LiveTrainingCamera
                    exerciseType={selectedExercise!}
                    onRepsUpdate={setReps}
                    onFormUpdate={setFormFeedback}
                    onClose={handleCameraClose}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center p-6 border-b border-cyan-500/30">
                  <h2 className="text-2xl font-orbitron text-cyan-400">Live Training</h2>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-cyan-500/20 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5 text-cyan-400" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6">
                  <div className="space-y-4 mb-6">
                    <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-blue-300">AI-Powered Detection</p>
                        <p className="text-sm text-blue-200">Real-time pose detection with TensorFlow.js</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                      <Lock className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-cyan-300">Complete Privacy</p>
                        <p className="text-sm text-cyan-200">No video recording or storage - all processing local</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <Zap className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-green-300">Rank Bonus</p>
                        <p className="text-sm text-green-200">{userRank} Rank: {(multiplier * 100).toFixed(0)}% XP multiplier</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <Zap className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-yellow-300">Required Reps</p>
                        <p className="text-sm text-yellow-200">Complete {requiredReps} reps to finish your mission and earn XP</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {EXERCISES.map(exercise => (
                      <motion.button
                        key={exercise.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleStartTraining(exercise.id)}
                        className="relative group p-6 bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30 hover:border-cyan-400 rounded-xl transition-all overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-green-500 opacity-0 group-hover:opacity-10 transition-opacity" />

                        <div className="relative z-10 flex flex-col items-center gap-3">
                          <span className="text-4xl">{exercise.icon}</span>
                          <h3 className="font-orbitron text-cyan-400 font-bold">{exercise.name}</h3>
                          <p className="text-xs text-gray-400 text-center">{exercise.description}</p>

                          <div className="mt-2 pt-4 border-t border-cyan-500/20 w-full">
                            <p className="text-sm font-semibold text-green-400">
                              +{Math.floor(exercise.xpPerRep * multiplier)} XP/rep
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
