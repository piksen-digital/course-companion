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
  Trophy, RefreshCw, Globe, Users, Zap
} from 'lucide-react';

// Import the centralized Firebase instances we created in lib/firebase.ts
import { auth, db } from '../lib/firebase';

const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID || 'whop-pro-companion';
const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""; 

const glassStyle = "bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl transition-all duration-500";

export default function App({ initialAuthToken }) {
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState('authenticating'); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState('chat');
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [courseData, setCourseData] = useState({ content: "", lastUpdated: null });
  const [quiz, setQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [userStats, setUserStats] = useState({ totalQuizzes: 0, highScore: 0 });
  const [leaderboard, setLeaderboard] = useState([]);

  const scrollRef = useRef(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = initialAuthToken || (typeof window !== 'undefined' && (window as any).__initial_auth_token);
        if (token) {
          await signInWithCustomToken(auth, token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { 
        console.error("Auth Error:", e);
        setAuthStatus('error'); 
      }
    };
    initAuth();

    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
         setAuthStatus(u.isAnonymous ? 'anonymous' : 'whop');
         const tokenResult = await getIdTokenResult(u);
         setIsAdmin(tokenResult.claims.whopRole === 'admin');
      }
    });
  }, [initialAuthToken]);

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
                       .sort((a, b) => b.score - a.score)
                       .slice(0, 5); 
        setLeaderboard(board);
      },
      (err) => console.error("Firestore Error (Board):", err)
    );

    return () => { unsubCourse(); unsubStats(); unsubBoard(); };
  }, [user]);

  const recordScore = async (score) => {
    if (!user) return;
    const newStats = {
      totalQuizzes: (userStats.totalQuizzes || 0) + 1,
      highScore: Math.max(userStats.highScore || 0, score)
    };
    
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'progress', 'stats'), newStats, { merge: true });
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', user.uid), {
      username: user.isAnonymous ? "Guest Learner" : `User ${user.uid.slice(-4)}`,
      score: newStats.highScore,
      updatedAt: new Date().toISOString()
    });
  };

  const handleSendMessage = async () => {
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
          systemInstruction: { parts: [{ text: `Course context: ${courseData.content}. You are an elite tutor for this course.` }] } 
        })
      });
      const data = await res.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm having trouble connecting right now.";
      setMessages(p => [...p, { role: 'assistant', text: aiResponse }]);
    } catch (error) {
      setMessages(p => [...p, { role: 'assistant', text: "Error connecting to AI brain." }]);
    } finally {
      setLoading(false);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  if (!user) return <div className="h-screen bg-slate-950 flex items-center justify-center text-indigo-500 animate-pulse font-bold tracking-widest uppercase text-sm">Initializing Neural Link...</div>;

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
                <div className={`w-2 h-2 rounded-full animate-pulse ${courseData.content ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                  {courseData.lastUpdated ? `Sync: ${new Date(courseData.lastUpdated).toLocaleTimeString()}` : 'Neural Link Active'}
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
              <div className={`${glassStyle} h-[650px] flex flex-col relative`}>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400">
                        <Sparkles size={32} className="animate-pulse" />
                      </div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter">AI Tutor Engaged</h2>
                      <p className="text-slate-500 text-sm max-w-xs mx-auto font-medium">Synced with course content. Ask me anything.</p>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-4 rounded-3xl text-sm leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800/80 border border-white/5 rounded-tl-sm'}`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-slate-900/80 border-t border-white/5 rounded-b-3xl">
                  <div className="relative">
                    <input 
                      type="text" value={input} onChange={(e)=>setInput(e.target.value)}
                      onKeyPress={(e)=>e.key==='Enter' && handleSendMessage()}
                      placeholder="Ask about the course..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-5 pr-14 focus:border-indigo-500 transition-all outline-none shadow-inner text-white placeholder:text-slate-600"
                    />
                    <button onClick={handleSendMessage} disabled={loading} className="absolute right-2 top-2 bottom-2 px-5 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-50 text-white">
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {view === 'quiz' && (
               <div className={`${glassStyle} min-h-[600px] flex flex-col items-center justify-center p-12`}>
                {/* Quiz content logic... */}
                <div className="text-center space-y-6">
                   <Trophy size={48} className="mx-auto text-indigo-400" />
                   <h2 className="text-2xl font-black">Arena Mode</h2>
                   <p className="text-slate-400">Quiz logic is initialized and ready for deployment.</p>
                </div>
               </div>
            )}
            {view === 'admin' && isAdmin && (
              <div className={`${glassStyle} p-8 space-y-6`}>
                <div className="flex items-center gap-3">
                   <RefreshCw className="text-indigo-400" />
                   <h2 className="text-2xl font-black">Admin Sync</h2>
                </div>
                <textarea 
                  className="w-full h-80 bg-slate-950/80 border border-slate-800 rounded-2xl p-6 text-sm outline-none focus:border-indigo-500 font-mono"
                  placeholder="Course content data..."
                  defaultValue={courseData.content}
                />
              </div>
            )}
          </div>
          
          <aside className="lg:col-span-4 space-y-6">
            <div className={`${glassStyle} p-6 space-y-6`}>
              <div className="flex items-center gap-2 text-indigo-400 font-black text-sm uppercase tracking-tighter">
                <Globe size={16} /> Leaderboard
              </div>
              <div className="space-y-3">
                {leaderboard.map((entry, i) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-white/5">
                    <span className="text-xs font-bold text-slate-300">#0{i+1} {entry.username}</span>
                    <span className="text-sm font-black text-white">{entry.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-xs uppercase tracking-tight ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
      {icon} <span>{label}</span>
    </button>
  );
      }
