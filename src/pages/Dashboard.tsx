import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Target,
  Users,
  Crown,
  Calendar,
  TrendingUp,
  Award,
  Flame
} from 'lucide-react';
import { User, Quest } from '../types';
import { generateDailyQuests, getXpRequiredForNextRank } from '../data/questSystem';
import GlowingCard from '../components/GlowingCard';
import RankBadge from '../components/RankBadge';
import ProgressBar from '../components/ProgressBar';
import SystemNotification from '../components/SystemNotification';
import NotificationSetup from '../components/NotificationSetup';
import TrainingModal from '../components/TrainingModal';
import { useNotifications } from '../hooks/useNotifications';

interface DashboardProps {
  user: User;
  onUpdateUser: (user: User) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onUpdateUser }) => {
  const [dailyQuests, setDailyQuests] = useState<Quest[]>([]);
  const { sendNotification, sendRankUp, scheduleQuestReminder } = useNotifications();
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'warning' | 'achievement';
  }>({ show: false, message: '', type: 'success' });
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);

  useEffect(() => {
    setDailyQuests(generateDailyQuests());
    scheduleQuestReminder();
  }, []);

  const showNotification = (message: string, type: 'success' | 'warning' | 'achievement') => {
    setNotification({ show: true, message, type });
    
    // Also send browser notification
    if (type === 'success') {
      sendNotification('⚡ Quest Complete!', {
        body: message,
        tag: 'quest-complete'
      });
    }
  };

  const completeQuest = (questId: string) => {
    setDailyQuests(quests => 
      quests.map(quest => {
        if (quest.id === questId && !quest.completed) {
          showNotification(`⚡ Ding! You gained +${quest.xpReward} ${quest.category.toUpperCase()} XP`, 'success');
          
          const updatedUser = {
            ...user,
            totalXp: user.totalXp + quest.xpReward,
            rank: calculateRankFromXp ? calculateRankFromXp(user.totalXp + quest.xpReward) : user.rank,
            stats: {
              ...user.stats,
              [quest.category]: user.stats[quest.category] + quest.xpReward
            }
          };
          
          // Check for rank up
          if (updatedUser.rank !== user.rank) {
            sendRankUp(updatedUser.rank);
            showNotification(`🎉 Rank Up! You are now ${updatedUser.rank}-Rank Hunter!`, 'achievement');
          }
          
          onUpdateUser(updatedUser);
          
          return { ...quest, completed: true };
        }
        return quest;
      })
    );
  };

  const completedQuests = dailyQuests.filter(q => q.completed).length;
  const nextRankXp = getXpRequiredForNextRank(user.totalXp);
  const progressToNext = ((user.totalXp / nextRankXp) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-dark via-slate-900 to-navy-dark py-8">
      <SystemNotification
        {...notification}
        onClose={() => setNotification({ ...notification, show: false })}
      />
      
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-orbitron font-bold text-white mb-4 text-glow-strong">
            Hunter Dashboard
          </h1>
          <p className="text-electric-blue font-orbitron text-lg text-glow">
            Welcome back, {user.rank}-Rank Hunter
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Stats & Progress */}
          <div className="lg:col-span-1 space-y-6">
            {/* Notification Setup */}
            <NotificationSetup />
            
            {/* Rank Card */}
            <GlowingCard>
              <div className="text-center">
                <div className="mb-4">
                  <RankBadge rank={user.rank} size="lg" />
                </div>
                <h3 className="text-xl font-orbitron font-bold text-white mb-2 text-glow">
                  Current Rank
                </h3>
                <ProgressBar
                  current={user.totalXp}
                  max={nextRankXp}
                  label="Progress to Next Rank"
                />
                <p className="text-electric-blue font-orbitron mt-2">
                  {user.totalXp} / {nextRankXp} XP
                </p>
              </div>
            </GlowingCard>

            {/* Stats Overview */}
            <GlowingCard>
              <h3 className="text-xl font-orbitron font-bold text-white mb-4 flex items-center gap-2 text-glow">
                <TrendingUp className="w-5 h-5 text-electric-blue" />
                Hunter Stats
              </h3>
              <div className="space-y-4">
                {Object.entries(user.stats).map(([key, value]) => (
                  <ProgressBar
                    key={key}
                    current={value}
                    max={100}
                    label={key.charAt(0).toUpperCase() + key.slice(1)}
                  />
                ))}
              </div>
            </GlowingCard>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <GlowingCard hover={false}>
                <div className="text-center">
                  <Flame className="w-8 h-8 text-electric-blue mx-auto mb-2" />
                  <div className="text-2xl font-orbitron font-bold text-white text-glow">{user.streakDays}</div>
                  <div className="text-electric-blue font-orbitron text-sm">Day Streak</div>
                </div>
              </GlowingCard>
              
              <GlowingCard hover={false}>
                <div className="text-center">
                  <Award className="w-8 h-8 text-electric-blue mx-auto mb-2" />
                  <div className="text-2xl font-orbitron font-bold text-white text-glow">{user.totalXp}</div>
                  <div className="text-electric-blue font-orbitron text-sm">Total XP</div>
                </div>
              </GlowingCard>
            </div>
          </div>

          {/* Middle Column - Daily Quests */}
          <div className="lg:col-span-2">
            <GlowingCard>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-orbitron font-bold text-white flex items-center gap-2 text-glow">
                  <Target className="w-6 h-6 text-electric-blue" />
                  Daily Quests
                </h3>
                <div className="text-electric-blue font-orbitron">
                  {completedQuests} / {dailyQuests.length} Complete
                </div>
              </div>

              <div className="space-y-4">
                {dailyQuests.map((quest, index) => (
                  <motion.div
                    key={quest.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`
                      p-4 rounded-lg border-2 transition-all duration-300
                      ${quest.completed 
                        ? 'bg-green-500/10 border-green-400/50' 
                        : 'bg-navy-dark/50 border-electric-blue/30 hover:border-electric-blue/60'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-orbitron font-bold text-white mb-1 text-glow">{quest.title}</h4>
                        <p className="text-white/80 font-orbitron text-sm">{quest.description}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-electric-blue font-orbitron uppercase tracking-wider font-semibold">
                            {quest.category}
                          </span>
                          <span className="text-xs text-electric-blue font-orbitron font-semibold">
                            +{quest.xpReward} XP
                          </span>
                        </div>
                      </div>
                      
                      {quest.category === 'body' ? (
                        <motion.button
                          whileHover={{ scale: quest.completed ? 1 : 1.05 }}
                          whileTap={{ scale: quest.completed ? 1 : 0.95 }}
                          onClick={() => !quest.completed && setIsTrainingModalOpen(true)}
                          disabled={quest.completed}
                          className={`
                            px-4 py-2 rounded-lg font-medium transition-all duration-300
                            ${quest.completed
                              ? 'bg-green-500 text-white cursor-default font-orbitron'
                              : 'bg-electric-blue hover:bg-electric-blue-dark text-white font-orbitron'
                            }
                          `}
                        >
                          {quest.completed ? 'Complete' : 'Start Training'}
                        </motion.button>
                      ) : (
                        <motion.button
                          whileHover={{ scale: quest.completed ? 1 : 1.05 }}
                          whileTap={{ scale: quest.completed ? 1 : 0.95 }}
                          onClick={() => !quest.completed && completeQuest(quest.id)}
                          disabled={quest.completed}
                          className={`
                            px-4 py-2 rounded-lg font-medium transition-all duration-300
                            ${quest.completed
                              ? 'bg-green-500 text-white cursor-default font-orbitron'
                              : 'bg-electric-blue hover:bg-electric-blue-dark text-white font-orbitron'
                            }
                          `}
                        >
                          {quest.completed ? 'Complete' : 'Mark Done'}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {completedQuests === dailyQuests.length && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 p-6 bg-gradient-to-r from-electric-blue/10 to-green-500/10 
                           border border-electric-blue/40 rounded-lg text-center"
                >
                  <Crown className="w-8 h-8 text-electric-blue mx-auto mb-2" />
                  <h4 className="text-xl font-orbitron font-bold text-white mb-2 text-glow">
                    Perfect Day Achievement!
                  </h4>
                  <p className="text-white/80 font-orbitron">
                    You've completed all daily quests. Bonus XP will be awarded!
                  </p>
                </motion.div>
              )}
            </GlowingCard>

            {/* Guild Section */}
            <GlowingCard className="mt-6">
              <div className="text-center">
                <Users className="w-12 h-12 text-electric-blue mx-auto mb-4" />
                <h3 className="text-xl font-orbitron font-bold text-white mb-2 text-glow">
                  Guild System
                </h3>
                <p className="text-white/80 font-orbitron mb-4">
                  Join a specialized hunter guild to compete and collaborate with others.
                </p>
                <button className="px-6 py-3 bg-gradient-to-r from-electric-blue to-electric-blue-dark 
                                 text-white font-orbitron font-bold rounded-lg hover:scale-105 
                                 transition-transform duration-300">
                  Browse Guilds
                </button>
              </div>
            </GlowingCard>
          </div>
        </div>
      </div>

      <TrainingModal
        isOpen={isTrainingModalOpen}
        onClose={() => setIsTrainingModalOpen(false)}
        userRank={user.rank}
        requiredReps={15}
        onSessionComplete={(xpEarned, repsCompleted) => {
          const bodyQuest = dailyQuests.find(q => q.category === 'body');
          if (bodyQuest) {
            completeQuest(bodyQuest.id, xpEarned);
          }
        }}
      />
    </div>
  );
};

export default Dashboard;