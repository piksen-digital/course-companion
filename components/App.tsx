import React, { useState, useEffect, useRef } from 'react';
import { 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged,
  getIdTokenResult 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  collection, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  MessageSquare, Send, Sparkles, 
  Trophy, RefreshCw, Globe, Users, Zap,
  AlertCircle, WifiOff
} from 'lucide-react';

// Import the centralized Firebase instances
import { auth, db } from '../lib/firebase';

const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID || 'whop-pro-companion';
const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""; 

const glassStyle = "bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl transition-all duration-500";

export default function App({ initialAuthToken }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState('chat');
  const [authError, setAuthError] = useState(null);
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [courseData, setCourseData] = useState({ content: "", lastUpdated: null });
  const [userStats, setUserStats] = useState({ totalQuizzes: 0, highScore: 0 });
  const [leaderboard, setLeaderboard] = useState([]);

  const scrollRef = useRef(null);

  // 1. Auth & Connection Logic with Timeout
  useEffect(() => {
    // Set a 15-second safety timer to stop the infinite loop
    const connectionTimeout = setTimeout(() => {
      if (!auth.currentUser) {
        setAuthError("CONNECTION_TIMEOUT");
      }
    }, 15000);

    const initAuth = async () => {
      try {
        const token = initialAuthToken || (typeof window !== 'undefined' && (window as any).__initial_auth_token);
        if (token) {
          await signInWithCustomToken(auth, token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e: any) { 
        console.error("Auth Error Code:", e.code);
        if (e.code === 'auth/network-request-failed') {
          setAuthError("NETWORK_ERROR");
        } else {
          setAuthError("AUTH_FAILED");
        }
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        clearTimeout(connectionTimeout); // Success! Stop the timeout timer.
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

  // 2. Real-time Firestore Sync
  useEffect(() => {
    if (!user) return;

    const unsubCourse = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'course_config'), 
      (s) => s.exists() && setCourseData(s.data() as any),
      (err) => console.error("Firestore Error (Course):", err)
    );

    const unsubStats = onSnapshot(
      doc(db, 'artifacts', appId, 'users', user.uid, 'progress', 'stats'), 
      (s) => s.exists() && setUserStats(s.data() as any),
      (err) => console.error("Firestore Error (Stats):", err)
    );

    const unsubBoard = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard'), 
      (s) => {
        const board = s.docs.map(d => ({ id: d.id, ...d.data() } as any))
                       .sort((a, b) => (b.score || 0) - (a.score || 0))
                       .slice(0, 5); 
        setLeaderboard(board);
      },
      (err) => console.error("Firestore Error (Board):", err)
    );

    return () => { unsubCourse(); unsubStats(); unsubBoard(); };
  }, [user]);

  // Handle errors visually instead of looping forever
  if (authError) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
          {authError === 'NETWORK_ERROR' ? <WifiOff size={40} /> : <AlertCircle size={40} />}
        </div>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight uppercase">Neural Link Failure</h2>
        <p className="text-slate-400 mb-8 max-w-sm leading-relaxed">
          {authError === 'NETWORK_ERROR' 
            ? "Your connection to the Firebase core was interrupted. This usually happens if the domain is not authorized or the API is blocked."
            : "The authentication sequence timed out. Please ensure you are logged into Whop or try refreshing the session."}
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
        >
          RETRY INITIALIZATION
        </button>
      </div>
    );
  }

  // Fallback content for AI Tutor if database is empty
  const activeContent = courseData.content || "Welcome to your Course Companion. I am currently in standby mode waiting for lesson data to be synced from the Whop creator dashboard. Once synced, I can answer questions, summarize lessons, and generate practice quizzes based on your specific course material.";

  if (!user) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500 animate-pulse" size={32} />
        </div>
        <div className="mt-8 text-indigo-400 font-black tracking-[0.3em] uppercase text-sm animate-pulse text-center">
          Initializing Neural Link<span className="animate-bounce">...</span>
          <p className="text-[10px] text-slate-600 mt-2 tracking-normal font-medium">Attempting Secure Auth Handshake</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8 selection:bg-indigo-500/40 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <nav className="flex flex-col md:flex-row items-center justify-between gap-6 p-4 rounded-3xl bg-slate-900/40 border border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <Zap className="text-white fill-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tighter uppercase">Companion<span className="text-indigo-500">Pro</span></h1>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${courseData.content ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'}`} />
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                  {courseData.content ? 'Neural Link Active' : 'Standby: Awaiting Data'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-2xl border border-white/5">
            <NavBtn active={view==='chat'} onClick={()=>setView('chat')} icon={<MessageSquare size={16}/>} label="Tutor" />
            <NavBtn active={view==='quiz'} onClick={()=>setView('quiz')} icon={<Trophy size={16}/>} label="Arena" />
            {isAdmin && <NavBtn active={view==='admin'} onClick={()=>setView('admin')} icon={<RefreshCw size={16}/>} label="Admin" />}
          </div>
        </nav>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {view === 'chat' && (
              <div className={`${glassStyle} h-[650px] flex flex-col relative overflow-hidden`}>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400">
                        <Sparkles size={32} className="animate-pulse" />
                      </div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter">AI Tutor Engaged</h2>
                      <p className="text-slate-500 text-sm max-w-xs mx-auto font-medium">
                        {courseData.content ? "I've analyzed the course material. What would you like to clarify?" : "I'm ready. I'll automatically sync with your lessons as the creator updates them."}
                      </p>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800/80 border border-white/5 rounded-tl-sm text-slate-200'}`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-slate-900/90 border-t border-white/5">
                  <div className="relative">
                    <input 
                      type="text" value={input} onChange={(e)=>setInput(e.target.value)}
                      onKeyPress={(e)=>e.key==='Enter' && handleSendMessage()}
                      placeholder="Ask about the course material..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-5 pr-14 focus:border-indigo-500 transition-all outline-none shadow-inner text-white placeholder:text-slate-600"
                    />
                    <button 
                      onClick={handleSendMessage} 
                      disabled={loading || !input.trim()} 
                      className="absolute right-2 top-2 bottom-2 px-5 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-30 text-white"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* View logic for 'quiz' and 'admin' remains standard */}
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <div className={`${glassStyle} p-6 space-y-6`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-400 font-black text-sm uppercase tracking-tighter">
                  <Globe size={16} /> Leaderboard
                </div>
              </div>
              <div className="space-y-3">
                {leaderboard.map((entry, i) => (
                  <div key={entry.id || i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-white/5">
                    <span className="text-xs font-bold text-slate-300">#0{i+1} {entry.username || 'Anonymous'}</span>
                    <span className="text-sm font-black text-white">{entry.score || 0}</span>
                  </div>
                ))}
                {leaderboard.length === 0 && <div className="text-center py-4 text-[10px] text-slate-600 font-bold uppercase tracking-widest">No Rankings Found</div>}
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );

  async function handleSendMessage() {
    if (!input.trim() || loading) return;
    const userText = input;
    setMessages(p => [...p, { role: 'user', text: userText }]);
    setInput('');
    setLoading(true);
    
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: userText }] }], 
          systemInstruction: { parts: [{ text: `You are a helpful AI Course Tutor. Here is the course context: ${activeContent}` }] } 
        })
      });
      const data = await res.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm having trouble processing that right now.";
      setMessages(p => [...p, { role: 'assistant', text: aiResponse }]);
    } catch (error) {
      setMessages(p => [...p, { role: 'assistant', text: "Signal lost. Check your API key or network." }]);
    } finally {
      setLoading(false);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }
}

function NavBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-xs uppercase tracking-tight ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
      {icon} <span>{label}</span>
    </button>
  );
}
