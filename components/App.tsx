import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  getIdTokenResult,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  getDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import {
  MessageSquare,
  Send,
  Sparkles,
  Trophy,
  RefreshCw,
  Globe,
  Users,
  Zap,
  AlertCircle,
  WifiOff,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Mic,
  MicOff,
  ChevronDown,
  ZapOff,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  HELPERS & CONFIG                                                          */
/* -------------------------------------------------------------------------- */
const getFirebaseConfig = () => {
  const rawConfig = process.env.NEXT_PUBLIC_FIREBASE_CONFIG || '{}';
  try {
    if (rawConfig.startsWith('ewog') || !rawConfig.trim().startsWith('{')) {
      return JSON.parse(atob(rawConfig));
    }
    return JSON.parse(rawConfig);
  } catch (e) {
    console.error('Firebase Config Parsing Error:', e);
    return {};
  }
};

const firebaseConfig = getFirebaseConfig();
const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID || 'whop-pro-companion';
const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* -------------------------------------------------------------------------- */
/*  STYLE CONSTANTS                                                           */
/* -------------------------------------------------------------------------- */
const glassStyle =
  'bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl transition-all duration-500';
const glassButton =
  'p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 text-slate-400 hover:text-white active:scale-95';

/* -------------------------------------------------------------------------- */
/*  COMPONENTS                                                                */
/* -------------------------------------------------------------------------- */
const NavBtn = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-xs uppercase tracking-tight ${
      active
        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'
        : 'text-slate-500 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon} <span>{label}</span>
  </button>
);

const FeedbackButton = ({ type, onClick, active }) => (
  <button
    onClick={onClick}
    className={`p-1.5 rounded-lg transition-all ${
      active
        ? 'bg-indigo-600/20 text-indigo-400'
        : 'hover:bg-white/5 text-slate-600 hover:text-slate-300'
    }`}
  >
    {type === 'up' ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
  </button>
);

/* -------------------------------------------------------------------------- */
/*  APP                                                                       */
/* -------------------------------------------------------------------------- */
export default function App({ initialAuthToken }) {
  /* ---- Auth & User State ---- */
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState('chat');
  const [authError, setAuthError] = useState(null);

  /* ---- Chat State ---- */
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [recapText, setRecapText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [listening, setListening] = useState(false);

  /* ---- Course & User Data ---- */
  const [courseData, setCourseData] = useState({ content: '', lastUpdated: null });
  const [userStats, setUserStats] = useState({ totalQuizzes: 0, highScore: 0 });
  const [leaderboard, setLeaderboard] = useState([]);

  /* ---- Admin Analytics ---- */
  const [confusionHeatmap, setConfusionHeatmap] = useState([]);

  /* ---- Refs ---- */
  const scrollRef = useRef(null);
  const recognitionRef = useRef<any>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ============================================================= */
  /*  AUTH EFFECT                                                   */
  /* ============================================================= */
  useEffect(() => {
    const connectionTimeout = setTimeout(() => {
      if (!auth.currentUser) {
        setAuthError('CONNECTION_TIMEOUT');
      }
    }, 15000);

    const initAuth = async () => {
      try {
        const token =
          initialAuthToken ||
          (typeof window !== 'undefined' && (window as any).__initial_auth_token);
        if (token) {
          await signInWithCustomToken(auth, token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e: any) {
        console.error('Auth Error:', e.code);
        setAuthError(
          e.code === 'auth/network-request-failed' ? 'NETWORK_ERROR' : 'AUTH_FAILED'
        );
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        clearTimeout(connectionTimeout);
        setUser(u);
        const tokenResult = await getIdTokenResult(u);
        setIsAdmin(tokenResult.claims.whopRole === 'admin');
      }
    });
    return () => {
      clearTimeout(connectionTimeout);
      unsubscribe();
    };
  }, [initialAuthToken]);

  /* ============================================================= */
  /*  DATA LISTENERS (course, stats, leaderboard, admin)            */
  /* ============================================================= */
  useEffect(() => {
    if (!user) return;

    const unsubCourse = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'course_config', 'main'),
      (s) => s.exists() && setCourseData(s.data() as any),
      (err) => console.error('Firestore Error (Course):', err)
    );

    const unsubStats = onSnapshot(
      doc(db, 'artifacts', appId, 'users', user.uid, 'progress', 'stats'),
      (s) => s.exists() && setUserStats(s.data() as any),
      (err) => console.error('Firestore Error (Stats):', err)
    );

    const unsubBoard = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard'),
      (s) => {
        const board = s.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 5);
        setLeaderboard(board);
      },
      (err) => console.error('Firestore Error (Board):', err)
    );

    // Admin confusion heatmap (reads from public data)
    const unsubConfusion = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'confusion_heatmap'),
      (s) => {
        const heat = s.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        setConfusionHeatmap(heat);
      },
      (err) => console.error('Firestore Error (Heatmap):', err)
    );

    return () => {
      unsubCourse();
      unsubStats();
      unsubBoard();
      unsubConfusion();
    };
  }, [user]);

  /* ============================================================= */
  /*  SMART RECAP (on first load with previous messages)            */
  /* ============================================================= */
  useEffect(() => {
    if (!user || messages.length > 0 || !courseData.content) return;
    const fetchRecap = async () => {
      try {
        // Load last session messages from Firestore (simple: last 6 assistant+user)
        const userMsgRef = doc(
          db,
          'artifacts',
          appId,
          'users',
          user.uid,
          'chats',
          'session'
        );
        const snap = await getDoc(userMsgRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const history: string[] = data?.lastSession || [];
        if (history.length < 2) return;

        const prompt = `Summarize the last learning session in 2-3 sentences. Here are the recent interactions:\n${history.join('\n')}`;
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );
        const json = await res.json();
        const recap =
          json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (recap) {
          setRecapText(recap);
          setShowRecap(true);
        }
      } catch (e) {
        console.log('Recap generation skipped', e);
      }
    };
    fetchRecap();
  }, [user, courseData.content]);

  /* ============================================================= */
  /*  AUTO-GENERATE SUGGESTIONS WHEN USER TYPES                     */
  /* ============================================================= */
  const generateSuggestions = useCallback(
    async (query: string) => {
      if (!query.trim() || !courseData.content) {
        setSuggestions([]);
        return;
      }
      setSuggestionsLoading(true);
      try {
        const prompt = `You are a course tutor. Based on this course: "${courseData.content}", the student typed: "${query}". Generate exactly 3 related questions the student might want to ask, each on its own line without numbering.`;
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );
        const json = await res.json();
        const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const lines = raw.split('\n').filter((l) => l.trim());
        setSuggestions(lines.slice(0, 3));
      } catch (e) {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    },
    [courseData.content]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      generateSuggestions(val);
    }, 500);
  };

  /* ============================================================= */
  /*  SEND MESSAGE + SAVE HISTORY FOR RECAP                         */
  /* ============================================================= */
  const handleSendMessage = async (customText?: string) => {
    const text = customText || input;
    if (!text.trim() || loading) return;
    const userMessage = text.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userMessage, id: Date.now().toString() }]);
    if (!customText) setInput('');
    setSuggestions([]);
    setLoading(true);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userMessage }] }],
            systemInstruction: {
              parts: [{ text: `You are a helpful AI Course Tutor. Here is the course context: ${courseData.content}` }],
            },
          }),
        }
      );
      const data = await res.json();
      const aiResponse =
        data.candidates?.[0]?.content?.parts?.[0]?.text || 'Response logic failure.';
      const newMsgId = Date.now().toString();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: aiResponse, id: newMsgId },
      ]);

      // Save last session (simplified) for recap
      const history = [...messages, { role: 'user', text: userMessage }, { role: 'assistant', text: aiResponse }]
        .slice(-8)
        .map((m) => `${m.role}: ${m.text}`);
      await setDoc(
        doc(db, 'artifacts', appId, 'users', user.uid, 'chats', 'session'),
        { lastSession: history, lastUpdated: serverTimestamp() },
        { merge: true }
      );

      // Track confusion: simple example - if user asks "explain" or "confused", log to admin heatmap
      if (userMessage.toLowerCase().includes('explain') || userMessage.toLowerCase().includes('confused')) {
        const section = detectSection(userMessage); // simplistic: just whole message as section
        await updateDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'confusion_heatmap', section),
          {
            count: increment(),
            lastQuestion: userMessage,
            timestamp: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Signal lost.', id: Date.now().toString() },
      ]);
    } finally {
      setLoading(false);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  // Dummy section detector - you can later integrate with course structure
  const detectSection = (text: string) => {
    // In real app, match against course module names
    return text.slice(0, 20).replace(/\s/g, '_') || 'general';
  };

  /* ============================================================= */
  /*  EXPLAIN DIFFERENT                                             */
  /* ============================================================= */
  const handleExplainDifferent = async (msgId: string, style: string) => {
    const originalMsg = messages.find((m) => m.id === msgId);
    if (!originalMsg || originalMsg.role !== 'assistant') return;
    setLoading(true);
    try {
      const prompt = `The previous explanation was: "${originalMsg.text}". Now ${style} re-explain the same concept.`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: {
              parts: [{ text: `You are a helpful course tutor.` }],
            },
          }),
        }
      );
      const data = await res.json();
      const newExplanation =
        data.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not re-explain.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, text: newExplanation } : m
        )
      );
    } catch {
      alert('Failed to re-explain.');
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================= */
  /*  FEEDBACK (thumbs)                                             */
  /* ============================================================= */
  const handleFeedback = async (msgId: string, feedback: 'up' | 'down') => {
    if (!user) return;
    try {
      await updateDoc(
        doc(db, 'artifacts', appId, 'users', user.uid, 'feedback', msgId),
        {
          feedback,
          timestamp: serverTimestamp(),
          messageText: messages.find((m) => m.id === msgId)?.text || '',
        },
        { merge: true }
      );
      // Optionally show a subtle toast – omitted for brevity
    } catch (e) {
      console.warn('Feedback not saved', e);
    }
  };

  /* ============================================================= */
  /*  VOICE INPUT – Web Speech API                                  */
  /* ============================================================= */
  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input is not supported in your browser.');
      return;
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => prev + ' ' + transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  /* ============================================================= */
  /*  RENDER LOGIC (Auth Errors / Loading / Main App)               */
  /* ============================================================= */
  if (authError) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
          {authError === 'NETWORK_ERROR' ? <WifiOff size={40} /> : <AlertCircle size={40} />}
        </div>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight uppercase">
          Neural Link Failure
        </h2>
        <p className="text-slate-400 mb-8 max-w-sm leading-relaxed">
          {authError === 'CONNECTION_TIMEOUT'
            ? 'Initialization timed out. This is often caused by invalid credentials or a blocked connection.'
            : 'A network error occurred while establishing the link.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
        >
          RETRY INITIALIZATION
        </button>
      </div>
    );
  }

  const activeContent = courseData.content || 'Welcome. I am standing by for course data synchronization.';

  if (!user) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500 animate-pulse" size={32} />
        </div>
        <div className="mt-8 text-indigo-400 font-black tracking-[0.3em] uppercase text-sm animate-pulse text-center">
          Initializing Neural Link<span className="animate-bounce">...</span>
          <p className="text-[10px] text-slate-600 mt-2 tracking-normal font-medium">
            Decoding Credentials & Connecting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8 font-sans selection:bg-indigo-500/40">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* NAVIGATION */}
        <nav className="flex flex-col md:flex-row items-center justify-betw
