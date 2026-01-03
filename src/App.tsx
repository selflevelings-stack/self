import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import AuthGuard from './components/AuthGuard';
import LandingPage from './pages/LandingPage';
import Contact from './pages/Contact';
import NewAwakeningTest from './pages/NewAwakeningTest';
import LockedRankReveal from './pages/LockedRankReveal';
import UpgradePage from './pages/UpgradePage';
import RankReveal from './pages/RankReveal';
import HunterDashboard2 from './pages/HunterDashboard2';
import { useAuth } from './hooks/useAuth';
import { useSubscription } from './hooks/useSubscription';
import { signOut } from './lib/auth';
import { supabase } from './lib/supabase';
import { 
  createUserProfile, 
  createUserStats, 
  createDailyQuests,
  getUserProfile,
  getUserQuests 
} from './lib/supabase';

type AppState = 'landing' | 'test' | 'locked-reveal' | 'reveal' | 'dashboard' | 'upgrade';

function App() {
  const { user, profile, loading, isAuthenticated } = useAuth();
  const { subscriptionStatus, isActive } = useSubscription();
  const [currentState, setCurrentState] = useState<AppState>('landing');
  const [showAuthGuard, setShowAuthGuard] = useState(false);
  const [assessmentResults, setAssessmentResults] = useState<{
    totalScore: number;
    answers: number[];
    rank: string;
  } | null>(null);
  const [hunterData, setHunterData] = useState<any>(null);

  // Check if user has existing data when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      checkUserData();
    }
  }, [isAuthenticated, user]);

  const checkUserData = async () => {
    if (!user) return;

    // Admin bypass - grant immediate access
    if (user.email === 'selflevelings@gmail.com') {
      setHunterData({
        rank: 'D', // Start admin at D rank (can be reset via admin tools)
        totalScore: 150, // Perfect assessment score
        streak: 365, // Year-long streak
        totalXp: 25000, // Maximum XP for testing
        dailyQuests: []
      });
      setCurrentState('dashboard');
      return;
    }

    try {
      // Check if user has a profile first
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      // If no profile exists, create one
      if (!profileData) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: user.id,
            email: user.email!,
            created_at: new Date().toISOString()
          }]);
        
        if (profileError) {
          console.error('Error creating profile:', profileError);
        }
      }

      // Check if user has completed assessment by looking at profiles table
      const { data: userData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (userData && userData.subscription_status === 'active') {
        // User has completed assessment, check for today's quests
        const today = new Date().toISOString().split('T')[0];
        const { data: quests } = await getUserQuests(user.id, today);
        
        setHunterData({
          rank: 'C', // Default rank for active users
          totalScore: 75, // Default score
          streak: 0, // Default streak
          totalXp: 150, // Default XP
          dailyQuests: quests || []
        });
        setCurrentState('dashboard');
      } else if (user && !userData) {
        // User has profile but no assessment data, show test
        setCurrentState('test');
      }
    } catch (error) {
      console.error('Error checking user data:', error);
    }
  };

  const handleStartTest = () => {
    if (!isAuthenticated) {
      setShowAuthGuard(true);
      return;
    }
    setCurrentState('test');
  };

  const handleTestComplete = async (totalScore: number, answers: number[], rank: string) => {
    if (!user) return;

    try {
      // Calculate stats from answers
      const stats = calculateStatsFromAnswers(answers);
      
      // Only create user profile, don't reveal rank yet
      if (!profile) {
        await createUserProfile({
          id: user.id,
          email: user.email!,
          rank: rank as any,
          total_xp: totalScore * 2,
          streak_days: 0
        });

        // Create user stats record
        await createUserStats(user.id, stats);
      }

      setAssessmentResults({ totalScore, answers, rank });
      
      // Check subscription status to determine next screen
      if (isActive) {
        setCurrentState('reveal');
      } else {
        setCurrentState('locked-reveal');
      }
    } catch (error) {
      console.error('Error saving assessment results:', error);
    }
  };

  const handleUpgradeSuccess = () => {
    // User has successfully upgraded, show rank reveal
    setCurrentState('reveal');
  };

  const handleRankRevealComplete = async (dailyQuests: any[]) => {
    if (!assessmentResults || !user) return;

    try {
      // Save daily quests to database
      await createDailyQuests(user.id, dailyQuests);

      setHunterData({
        rank: assessmentResults.rank,
        totalScore: assessmentResults.totalScore,
        streak: 0,
        totalXp: assessmentResults.totalScore * 2,
        dailyQuests
      });
      setCurrentState('dashboard');
    } catch (error) {
      console.error('Error creating daily quests:', error);
    }
  };

  const handleUpdateProgress = (newXp: number, newStreak: number) => {
    if (hunterData) {
      setHunterData({
        ...hunterData,
        totalXp: newXp,
        streak: newStreak
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setCurrentState('landing');
      setAssessmentResults(null);
      setHunterData(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const calculateStatsFromAnswers = (answers: number[]) => {
    // Calculate stats based on question categories
    const categories = {
      mind: answers.slice(0, 5),
      work: answers.slice(5, 10),
      body: answers.slice(10, 15),
      discipline: answers.slice(15, 20),
      willpower: answers.slice(20, 25),
      habits: answers.slice(25, 30)
    };

    return {
      mind: Math.round(categories.mind.reduce((a, b) => a + b, 0) * 4), // Scale to 0-100
      body: Math.round(categories.body.reduce((a, b) => a + b, 0) * 4),
      discipline: Math.round(categories.discipline.reduce((a, b) => a + b, 0) * 4),
      lifestyle: Math.round(categories.habits.reduce((a, b) => a + b, 0) * 4),
      willpower: Math.round(categories.willpower.reduce((a, b) => a + b, 0) * 4),
      focus: Math.round(categories.willpower.reduce((a, b) => a + b, 0) * 4) // Use willpower for focus
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-dark via-slate-900 to-navy-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-electric-blue/30 border-t-electric-blue rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-orbitron text-glow">Loading Hunter System...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App relative">
        <Routes>
          <Route path="/upgrade" element={<UpgradePage />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/*" element={
            <>
        <PWAInstallPrompt />
        <OfflineIndicator />
        
        {/* Logout Button for Authenticated Users */}
        {isAuthenticated && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={handleLogout}
            className="fixed top-4 right-4 z-40 px-4 py-2 bg-navy-dark/80 hover:bg-navy-dark 
                     text-white font-orbitron font-medium rounded-lg transition-all duration-300
                     border border-electric-blue/30 hover:border-electric-blue/60
                     backdrop-blur-sm"
          >
            <div className="flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </div>
          </motion.button>
        )}
        
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'rgba(10, 15, 28, 0.95)',
              color: '#ffffff',
              border: '1px solid rgba(0, 207, 255, 0.3)',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              fontFamily: 'Orbitron, sans-serif',
            },
          }}
        />

        {currentState === 'landing' && (
          <LandingPage onStartTest={handleStartTest} />
        )}

        {currentState === 'test' && (
          <NewAwakeningTest onComplete={handleTestComplete} />
        )}

        {currentState === 'locked-reveal' && assessmentResults && (
          <LockedRankReveal 
            totalScore={assessmentResults.totalScore}
          />
        )}

        {currentState === 'reveal' && assessmentResults && (
          <RankReveal 
            rank={assessmentResults.rank}
            totalScore={assessmentResults.totalScore}
            onContinue={handleRankRevealComplete}
          />
        )}

        {currentState === 'dashboard' && hunterData && (
          <HunterDashboard2 />
        )}

        {/* Auth Guard for Unauthenticated Users */}
        {showAuthGuard && !isAuthenticated && (
          <AuthGuard onShowAuth={() => {
            setShowAuthGuard(false);
            setCurrentState('landing');
          }} />
        )}
            </>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;