import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, query, limit } from 'firebase/firestore';
import { 
  MessageSquare, BookOpen, Send, Sparkles, BrainCircuit, 
  CheckCircle2, ChevronRight, ShieldCheck, AlertCircle, 
  UserCircle2, Lock, History, Trophy, LayoutDashboard,
  Users, Zap, RefreshCw, Globe
} from 'lucide-react';

// --- CONFIGURATION ---
// These pull from your Vercel Environment Variables
const firebaseConfig = JSON.parse(window.__firebase_config || '{}');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// UPDATED: Using the Next.js Public Environment Variables
const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID || 'whop-pro-companion';
const geminiKey = process.env.GEMINI_API_KEY || ""; 

const glassStyle = "bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl transition-all duration-500";

export default function App({ initialAuthToken }) {
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState('authenticating'); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState('chat');
  
  // States
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

  // 1. Auth & Claims Handling
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = initialAuthToken || (typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null);
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
         // Check custom claims for admin status
         const idTokenResult = await u.getIdTokenResult();
         setIsAdmin(idTokenResult.claims.whopRole === 'admin');
      }
    });
  }, [initialAuthToken]);

  // 2. Real-time Firestore Sync (Multiplayer & Course Updates)
  useEffect(() => {
    if (!user) return;

    // A. Course Content (Syncs automatically via Webhook)
    const unsubCourse = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'course_config'), 
      (s) => s.exists() && setCourseData(s.data()),
      (err) => console.error("Firestore Error (Course):", err)
    );

    // B. User Stats (Private Progress)
    const unsubStats = onSnapshot(
      doc(db, 'artifacts', appId, 'users', user.uid, 'progress', 'stats'), 
      (s) => s.exists() && setUserStats(s.data()),
      (err) => console.error("Firestore Error (Stats):", err)
    );

    // C. Global Leaderboard (Public Data)
    const unsubBoard = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard'), 
      (s) => {
        const board = s.docs.map(d => ({ id: d.id, ...d.data() }))
                       .sort((a, b) => b.score - a.score)
                       .slice(0, 5); 
        setLeaderboard(board);
      },
      (err) => console.error("Firestore Error (Board):", err)
    );

    return () => { unsubCourse(); unsubStats(); unsubBoard(); };
  }, [user]);

  // 3. Score Logic
  const recordScore = async (score) => {
    if (!user) return;
    const newStats = {
      totalQuizzes: (userStats.totalQuizzes || 0) + 1,
      highScore: Math.max(userStats.highScore || 0, score)
    };
    
    // Save personal stats
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'progress', 'stats'), newStats, { merge: true });

    // Update global leaderboard entry
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', user.uid), {
      username: user.isAnonymous ? "Guest Learner" : `User ${user.uid.slice(-4)}`,
      score: newStats.highScore,
      updatedAt: new Date().toISOString()
    });
  };

  // 4. AI Chat Logic
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

  if (!user) return <div className="h-screen bg-slate-950 flex items-center justify-center text-indigo-500 animate-pulse font-bold">WHOP AUTH...</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8 selection:bg-indigo-500/40">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <nav className="flex flex-col md:flex-row items-center justify-between gap-6 p-4 rounded-3xl bg-slate-900/40 border border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <Zap className="text-white fill-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tighter">Companion<span className="text-indigo-500">Pro</span></h1>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${courseData.content ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                  {courseData.lastUpdated ? `Sync: ${new Date(courseData.lastUpdated).toLocaleTimeString()}` : 'No Course Data Found'}
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
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400">
                        <Sparkles size={32} className="animate-pulse" />
                      </div>
                      <h2 className="text-2xl font-black">AI Tutor Engaged</h2>
                      <p className="text-slate-500 text-sm max-w-xs mx-auto">I'm synced with your course content. How can I help you today?</p>
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
                <div className="p-6 bg-slate-900/80 border-t border-white/5">
                  <div className="relative">
                    <input 
                      type="text" value={input} onChange={(e)=>setInput(e.target.value)}
                      onKeyPress={(e)=>e.key==='Enter' && handleSendMessage()}
                      placeholder="Ask a question about the course..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-5 pr-14 focus:border-indigo-500 transition-all outline-none shadow-inner"
                    />
                    <button onClick={handleSendMessage} disabled={loading} className="absolute right-2 top-2 bottom-2 px-5 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-50">
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {view === 'quiz' && (
              <div className={`${glassStyle} min-h-[600px] flex flex-col items-center justify-center p-12`}>
                {!quiz ? (
                  <div className="text-center space-y-6 max-w-sm">
                    <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto text-indigo-400">
                      <Trophy size={48} className="animate-bounce" />
                    </div>
                    <h2 className="text-3xl font-black">Knowledge Arena</h2>
                    <p className="text-slate-500 text-sm">Test your knowledge and climb the leaderboard.</p>
                    <button onClick={async () => {
                        setLoading(true);
                        try {
                          const prompt = `Generate a 3 question MCQ quiz. Context: ${courseData.content}. Return JSON: {questions:[{q, options, correct}]}`;
                          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiKey}`, {
                            method: 'POST', headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ contents: [{parts:[{text: prompt}]}], generationConfig:{responseMimeType:"application/json"}})
                          });
                          const d = await res.json(); 
                          setQuiz(JSON.parse(d.candidates[0].content.parts[0].text).questions);
                        } catch (e) { console.error(e); }
                        setLoading(false);
                    }} className="w-full py-4 bg-indigo-600 rounded-2xl font-black text-lg hover:scale-[1.02] transition-transform">
                      {loading ? "Generating Challenge..." : "Enter Arena"}
                    </button>
                  </div>
                ) : (
                  <div className="w-full max-w-xl space-y-6">
                     {quiz.map((q, i) => (
                       <div key={i} className="p-6 bg-slate-900/80 border border-white/5 rounded-3xl space-y-4">
                         <p className="font-bold text-lg">{i+1}. {q.q}</p>
                         <div className="flex flex-col gap-2">
                           {q.options.map((opt, oIdx) => (
                             <button key={oIdx} onClick={() => !quizResult && setQuizAnswers({...quizAnswers, [i]: oIdx})}
                               className={`p-4 rounded-xl text-left text-sm transition-all border ${quizAnswers[i] === oIdx ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-950 border-slate-800 hover:bg-slate-800'}`}
                             >{opt}</button>
                           ))}
                         </div>
                       </div>
                     ))}
                     {!quizResult ? (
                       <button onClick={() => {
                         let s = 0; quiz.forEach((q, i) => { if(quizAnswers[i] === q.correct) s++ });
                         setQuizResult(s); recordScore(s);
                       }} className="w-full py-5 bg-emerald-600 rounded-2xl font-black text-xl">Finish Quiz</button>
                     ) : (
                       <div className="p-8 bg-indigo-600/20 rounded-3xl border border-indigo-500/30 text-center">
                         <p className="text-5xl font-black mb-2">{quizResult} / {quiz.length}</p>
                         <p className="text-indigo-400 font-bold mb-4">Score Recorded!</p>
                         <button onClick={() => {setQuiz(null); setQuizResult(null); setQuizAnswers({});}} className="text-white bg-indigo-600 px-6 py-2 rounded-xl hover:bg-indigo-500">Play Again</button>
                       </div>
                     )}
                  </div>
                )}
              </div>
            )}

            {view === 'admin' && (
              <div className={`${glassStyle} p-8 space-y-6`}>
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><RefreshCw /></div>
                   <h2 className="text-2xl font-black">Sync Dashboard</h2>
                </div>
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-200 text-xs">
                  Whop Webhook: <span className="font-mono text-white underline select-all">https://your-domain.com/api/webhook/whop</span>
                </div>
                <textarea 
                  className="w-full h-80 bg-slate-950/80 border border-slate-800 rounded-2xl p-6 text-sm outline-none focus:border-indigo-500 font-mono"
                  placeholder="Paste lesson text here for manual override..."
                  defaultValue={courseData.content}
                  onBlur={async (e) => {
                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'course_config'), { 
                      content: e.target.value,
                      lastUpdated: new Date().toISOString(),
                      source: 'Admin Manual Sync'
                    });
                  }}
                />
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <div className={`${glassStyle} p-6 space-y-6 border-indigo-500/20`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-400 font-black text-sm uppercase tracking-tighter">
                  <Globe size={16} /> Leaderboard
                </div>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-full font-bold">LIVE</span>
              </div>
              <div className="space-y-3">
                {leaderboard.map((entry, i) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-white/5 group hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 text-xs font-black ${i === 0 ? 'text-amber-400' : 'text-slate-600'}`}>#0{i+1}</span>
                      <span className="text-xs font-bold text-slate-300 truncate w-24">{entry.username}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Trophy size={12} className="text-amber-500" />
                      <span className="text-sm font-black text-white">{entry.score}</span>
                    </div>
                  </div>
                ))}
                {leaderboard.length === 0 && <div className="text-center py-4 text-xs text-slate-600 italic">No rankings yet.</div>}
              </div>
            </div>

            <div className={`${glassStyle} p-6 space-y-4`}>
              <div className="flex items-center gap-2 text-slate-400 font-black text-sm uppercase tracking-tighter">
                <Users size={16} /> Personal Stats
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Best</p>
                  <p className="text-xl font-black text-white">{userStats.highScore || 0}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Quizzes</p>
                  <p className="text-xl font-black text-white">{userStats.totalQuizzes || 0}</p>
                </div>
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
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-xs ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
      {icon} <span>{label}</span>
    </button>
  );
          }
