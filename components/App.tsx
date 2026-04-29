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
  increment,
} from 'firebase/firestore';
import {
  MessageSquare,
  Send,
  Sparkles,
  Trophy,
  RefreshCw,
  Globe,
  Zap,
  AlertCircle,
  WifiOff,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Mic,
  MicOff,
  ChevronDown,
} from 'lucide-react';

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

const glassStyle =
  'bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl transition-all duration-500';
const glassButton =
  'p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 text-slate-400 hover:text-white active:scale-95';

const NavBtn = ({ active, onClick, icon, label }: any) => (
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

const FeedbackButton = ({ type, onClick, active }: any) => (
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

export default function App({ initialAuthToken }: any) {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState('chat');
  const [authError, setAuthError] = useState<any>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [recapText, setRecapText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const [courseData, setCourseData] = useState<any>({ content: '', lastUpdated: null });
  const [userStats, setUserStats] = useState<any>({ totalQuizzes: 0, highScore: 0 });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [confusionHeatmap, setConfusionHeatmap] = useState<any[]>([]);

  const scrollRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const debounceRef = useRef<any>(null);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    const connectionTimeout = setTimeout(() => {
      if (!auth.currentUser) setAuthError('CONNECTION_TIMEOUT');
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
        setAuthError(e.code === 'auth/network-request-failed' ? 'NETWORK_ERROR' : 'AUTH_FAILED');
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

  useEffect(() => {
    if (!user) return;

    const unsubCourse = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'course_config', 'main'),
      (s) => s.exists() && setCourseData(s.data()),
      (err) => console.error('Firestore Error (Course):', err)
    );

    const unsubStats = onSnapshot(
      doc(db, 'artifacts', appId, 'users', user.uid, 'progress', 'stats'),
      (s) => s.exists() && setUserStats(s.data()),
      (err) => console.error('Firestore Error (Stats):', err)
    );

    const unsubBoard = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard'),
      (s) => {
        const board = s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
          .slice(0, 5);
        setLeaderboard(board);
      },
      (err) => console.error('Firestore Error (Board):', err)
    );

    const unsubConfusion = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'confusion_heatmap'),
      (s) => {
        const heat = s.docs.map((d) => ({ id: d.id, ...d.data() }));
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

  useEffect(() => {
    if (!user || messages.length > 0 || !courseData.content) return;
    const fetchRecap = async () => {
      try {
        const userMsgRef = doc(db, 'artifacts', appId, 'users', user.uid, 'chats', 'session');
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
        const recap = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (recap) {
          setRecapText(recap);
          setShowRecap(true);
        }
      } catch (e) {
        console.log('Recap generation skipped', e);
      }
    };
    fetchRecap();
  }, [user, courseData.content, messages.length]);

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
        const lines = raw.split('\n').filter((l: string) => l.trim());
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
      setMessages((prev) => [...prev, { role: 'assistant', text: aiResponse, id: newMsgId }]);

      const history = [...messages, { role: 'user', text: userMessage }, { role: 'assistant', text: aiResponse }]
        .slice(-8)
        .map((m) => `${m.role}: ${m.text}`);
      await setDoc(
        doc(db, 'artifacts', appId, 'users', user.uid, 'chats', 'session'),
        { lastSession: history, lastUpdated: serverTimestamp() },
        { merge: true }
      );

      if (userMessage.toLowerCase().includes('explain') || userMessage.toLowerCase().includes('confused')) {
        const section = userMessage.slice(0, 20).replace(/\s/g, '_') || 'general';
        await updateDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'confusion_heatmap', section),
          {
            count: increment(1),
            lastQuestion: userMessage,
            timestamp: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Signal lost.', id: Date.now().toString() }]);
    } finally {
      setLoading(false);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

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
              parts: [{ text: 'You are a helpful course tutor.' }],
            },
          }),
        }
      );
      const data = await res.json();
      const newExplanation =
        data.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not re-explain.';
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, text: newExplanation } : m))
      );
    } catch {
      alert('Failed to re-explain.');
    } finally {
      setLoading(false);
    }
  };

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
    } catch (e) {
      console.warn('Feedback not saved', e);
    }
  };

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
        <nav className="flex flex-col md:flex-row items-center justify-between gap-6 p-4 rounded-3xl bg-slate-900/40 border border-white/5 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <Zap className="text-white fill-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tighter uppercase">
                Companion<span className="text-indigo-500">Pro</span>
              </h1>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    courseData.content
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                      : 'bg-amber-500 animate-pulse'
                  }`}
                />
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                  {courseData.content ? 'Neural Link Active' : 'Standby: Awaiting Data'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-2xl border border-white/5">
            <NavBtn active={view === 'chat'} onClick={() => setView('chat')} icon={<MessageSquare size={16} />} label="Tutor" />
            <NavBtn active={view === 'quiz'} onClick={() => setView('quiz')} icon={<Trophy size={16} />} label="Arena" />
            {isAdmin && (
              <NavBtn active={view === 'admin'} onClick={() => setView('admin')} icon={<RefreshCw size={16} />} label="Admin" />
            )}
          </div>
        </nav>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {view === 'chat' ? (
              <div className={`${glassStyle} h-[650px] flex flex-col relative overflow-hidden`}>
                {showRecap && (
                  <div className="mx-6 mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-1">
                          Session Recap
                        </p>
                        <p className="text-sm text-slate-300 leading-relaxed">{recapText}</p>
                      </div>
                      <button
                        onClick={() => setShowRecap(false)}
                        className="text-slate-500 hover:text-white ml-4"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400">
                        <Sparkles size={32} className="animate-pulse" />
                      </div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter">AI Tutor Engaged</h2>
                      <p className="text-slate-500 text-sm max-w-xs mx-auto font-medium leading-relaxed">
                        {courseData.content
                          ? 'How can I help you master the course material today?'
                          : 'I am connected and ready. Sync lesson content to begin training.'}
                      </p>
                    </div>
                  )}
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed shadow-lg relative group ${
                          m.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-sm'
                            : 'bg-slate-800/80 border border-white/5 rounded-tl-sm text-slate-200'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        {m.role === 'assistant' && (
                          <div className="mt-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-2">
                              <FeedbackButton type="up" onClick={() => handleFeedback(m.id, 'up')} active={false} />
                              <FeedbackButton type="down" onClick={() => handleFeedback(m.id, 'down')} active={false} />
                              <button
                                onClick={() => navigator.clipboard.writeText(m.text)}
                                className={`${glassButton} p-1.5`}
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {['an analogy', 'ELI5', 'step-by-step', 'real-world example'].map((style) => (
                                <button
                                  key={style}
                                  onClick={() => handleExplainDifferent(m.id, `using ${style}`)}
                                  className="text-[10px] uppercase tracking-wider font-bold text-indigo-400/70 hover:text-indigo-300 bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg transition-all"
                                >
                                  {style === 'an analogy' ? 'Analogy' : style === 'ELI5' ? 'ELI5' : style === 'step-by-step' ? 'Steps' : 'Example'}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-3 border-t border-white/5 flex flex-wrap gap-2">
                  {['Explain like I\'m 5', 'Give me an analogy', 'Real-world example', 'What\'s the difference?'].map((tpl) => (
                    <button
                      key={tpl}
                      onClick={() => handleSendMessage(tpl)}
                      className="text-xs font-medium text-slate-400 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-3 py-1.5 transition-all"
                    >
                      {tpl}
                    </button>
                  ))}
                </div>
                <div className="p-6 bg-slate-900/90 border-t border-white/5">
                  {suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setInput(s);
                            setSuggestions([]);
                            inputRef.current?.focus();
                          }}
                          className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 hover:bg-indigo-500/20 transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="relative flex items-center">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={handleInputChange}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Ask about the course material..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-5 pr-20 focus:border-indigo-500 transition-all outline-none text-white placeholder:text-slate-600 shadow-inner"
                    />
                    <div className="absolute right-2 top-2 bottom-2 flex items-center gap-1">
                      <button
                        onClick={toggleListening}
                        className={`p-2 rounded-xl transition-all ${
                          listening ? 'bg-red-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'
                        }`}
                      >
                        {listening ? <MicOff size={18} /> : <Mic size={18} />}
                      </button>
                      <button
                        onClick={() => handleSendMessage()}
                        disabled={loading || !input.trim()}
                        className="p-2.5 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-30 text-white"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : view === 'admin' && isAdmin ? (
              <div className={`${glassStyle} p-6 space-y-8`}>
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Confusion Heatmap</h2>
                {confusionHeatmap.length === 0 ? (
                  <p className="text-slate-500 text-sm">No confusion data recorded yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {confusionHeatmap.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl border border-white/5 bg-slate-950/50 hover:border-indigo-500/30 transition-all"
                      >
                        <p className="text-sm font-bold text-white mb-1 truncate">{item.id.replace(/_/g, ' ')}</p>
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>Questions: {item.count || 1}</span>
                          <span>{new Date(item.timestamp?.toDate?.() || Date.now()).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-xs text-slate-600 border-t border-white/5 pt-4">
                  Built‑in analytics powered by real student questions.
                </div>
              </div>
            ) : (
              <div className={`${glassStyle} p-12 text-center`}>
                <h2 className="text-2xl font-black text-white uppercase tracking-widest">{view} Mode Locked</h2>
                <p className="text-slate-500 mt-2">Initialize tutor sync to unlock module training.</p>
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <div className={`${glassStyle} p-6 space-y-6`}>
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2 text-indigo-400 font-black text-sm uppercase tracking-tighter">
                  <Globe size={16} /> Global Leaderboard
                </div>
              </div>
              <div className="space-y-3">
                {leaderboard.map((entry: any, i: number) => (
                  <div
                    key={entry.id || i}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-white/5 hover:border-indigo-500/30 transition-colors group"
                  >
                    <span className="text-xs font-bold text-slate-300">
                      #0{i + 1} {entry.username || 'Anonymous'}
                    </span>
                    <span className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors">
                      {entry.score || 0}
                    </span>
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <div className="text-center py-6 text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">
                    Awaiting Champions
                  </div>
                )}
              </div>
            </div>
          </aside>
        </main>
      </div>

      <footer className="mt-8 pb-4 text-center">
        <a
          href="https://gist.github.com/piksen-digital/b944c5ba017dfc5c3d53d7eb1b195112"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-slate-600 hover:text-indigo-400 transition-colors uppercase tracking-widest font-bold"
        >
          Privacy Policy & Terms of Service
        </a>
      </footer>
    </div>
  );
}