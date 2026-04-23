import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, 
  onAuthStateChanged, getIdTokenResult 
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, collection, onSnapshot, serverTimestamp 
} from 'firebase/firestore';
import { 
  MessageSquare, Send, Sparkles, Trophy, RefreshCw, Globe, 
  Zap, AlertCircle, WifiOff, Terminal, ShieldCheck, BrainCircuit, 
  Command, Cpu, Layers, ChevronRight
} from 'lucide-react';

/**
 * 1. CONFIGURATION & NEURAL HANDSHAKE
 */
const getFirebaseConfig = () => {
  const rawConfig = process.env.NEXT_PUBLIC_FIREBASE_CONFIG || '{}';
  try {
    if (rawConfig.startsWith('ewog') || !rawConfig.trim().startsWith('{')) {
      return JSON.parse(atob(rawConfig));
    }
    return JSON.parse(rawConfig);
  } catch (e) { return {}; }
};

const firebaseConfig = getFirebaseConfig();
const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID || 'whop-pro-companion';
const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""; 

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// PREMIUM UI TOKENS
const glassStyle = "bg-slate-900/80 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-700";
const glowBorder = "ring-1 ring-white/10 shadow-[0_0_20px_rgba(99,102,241,0.15)] focus-within:shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all duration-500";

const NeuralLogo = () => (
  <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]">
    <path d="M50 5L95 27.5V72.5L50 95L5 72.5V27.5L50 5Z" stroke="url(#paint0_linear)" strokeWidth="2" />
    <path d="M50 25L75 37.5V62.5L50 75L25 62.5V37.5L50 25Z" fill="url(#paint1_linear)" fillOpacity="0.8" />
    <circle cx="50" cy="50" r="10" fill="white" className="animate-pulse" />
    <defs>
      <linearGradient id="paint0_linear" x1="5" y1="5" x2="95" y2="95" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366F1" />
        <stop offset="1" stopColor="#A855F7" />
      </linearGradient>
      <linearGradient id="paint1_linear" x1="25" y1="25" x2="75" y2="75" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4F46E5" />
        <stop offset="1" stopColor="#9333EA" />
      </linearGradient>
    </defs>
  </svg>
);

export default function App({ initialAuthToken }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState('chat');
  const [authError, setAuthError] = useState(null);
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [courseData, setCourseData] = useState({ content: "", lastUpdated: null });
  const [leaderboard, setLeaderboard] = useState([]);
  const [adminInput, setAdminInput] = useState('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const scrollRef = useRef(null);

  // AUTHENTICATION FLOW
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = initialAuthToken || (typeof window !== 'undefined' && (window as any).__initial_auth_token);
        if (token) await signInWithCustomToken(auth, token);
        else await signInAnonymously(auth);
      } catch (e: any) { setAuthError("AUTH_FAILED"); }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const tokenResult = await getIdTokenResult(u);
        setIsAdmin(tokenResult.claims.whopRole === 'admin' || true); // Force true for dev/preview
      }
    });
    return () => unsubscribe();
  }, [initialAuthToken]);

  // REAL-TIME DATA SYNC
  useEffect(() => {
    if (!user) return;
    
    const unsubCourse = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'course_config', 'main'), (s) => {
      if (s.exists()) {
        setCourseData(s.data() as any);
        setIsDataLoaded(true);
      } else {
        setIsDataLoaded(false);
      }
    });

    const unsubBoard = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard'), (s) => {
      setLeaderboard(s.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a,b) => (b.score||0)-(a.score||0)).slice(0, 5));
    });

    return () => { unsubCourse(); unsubBoard(); };
  }, [user]);

  /**
   * ELITE RAG ENHANCEMENT
   */
  async function handleSendMessage() {
    if (!input.trim() || loading) return;
    
    if (!geminiKey) {
      setMessages(p => [...p, { role: 'assistant', text: "⚠ CONFIG ERROR: NEXT_PUBLIC_GEMINI_API_KEY is missing." }]);
      return;
    }

    const userText = input;
    const updatedHistory = [...messages, { role: 'user', text: userText }];
    setMessages(updatedHistory);
    setInput('');
    setLoading(true);
    
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiKey}`;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: updatedHistory.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          })), 
          systemInstruction: { 
            parts: [{ 
              text: `You are the "Companion Pro" Elite Neural Tutor. 
              CORE KNOWLEDGE BASE: ${courseData.content || 'No course data provided yet.'}
              INSTRUCTIONS: 1. Use ONLY the provided knowledge base. 2. If unknown, guide back to course. 3. Be concise and professional.` 
            }] 
          } 
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Neural connection interrupted.";
      setMessages(p => [...p, { role: 'assistant', text: aiResponse }]);
    } catch (e: any) { 
      setMessages(p => [...p, { role: 'assistant', text: `PROTOCOL ERROR: ${e.message}` }]); 
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    }
  }

  const handleMockSync = async () => {
    try {
      setLoading(true);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'course_config', 'main'), {
        content: "NEURAL ACADEMY KNOWLEDGE: This course specializes in Invisible SaaS architecture. Fact: Knowledge is dynamic. Fact: Our AI uses high-performance Tailwind UI patterns.",
        lastUpdated: serverTimestamp()
      });
      setLoading(false);
      alert("Neural Knowledge Base Seeded.");
    } catch (e) {
      setLoading(false);
      alert("Sync Failed. Check Firestore Rules.");
    }
  };

  if (authError) return <FailureState error={authError} />;
  if (!user) return <LoadingState />;

  return (
    <div className="min-h-screen bg-[#020205] text-slate-200 p-4 md:p-10 font-sans selection:bg-indigo-500/30 overflow-x-hidden relative">
      {/* RESTORED PREMIUM BACKGROUND PATTERN */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/10 blur-[150px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* NAV SECTION - SLATE 900 COMPLEMENTARY COLOR */}
        <nav className="flex flex-col md:flex-row items-center justify-between gap-8 p-6 rounded-[2.5rem] bg-slate-900/60 border border-white/5 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-6">
            <NeuralLogo />
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight uppercase">Companion<span className="text-indigo-400">Pro</span></h1>
              <div className="flex items-center gap-3">
                <span className={`flex h-2 w-2 rounded-full transition-all duration-1000 ${isDataLoaded ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-amber-500 animate-pulse shadow-[0_0_15px_#f59e0b]'}`} />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-[0.3em]">
                  {isDataLoaded ? 'Quantum Link Active' : 'Standby: Neural Sync Pending'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-1.5 bg-black/40 rounded-[1.5rem] border border-white/5">
            <NavBtn active={view==='chat'} onClick={()=>setView('chat')} icon={<BrainCircuit size={18}/>} label="Tutor" />
            <NavBtn active={view==='quiz'} onClick={()=>setView('quiz')} icon={<Trophy size={18}/>} label="Arena" />
            {isAdmin && <NavBtn active={view==='admin'} onClick={()=>setView('admin')} icon={<Terminal size={18}/>} label="Console" />}
          </div>
        </nav>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {view === 'chat' && (
              <div className={`${glassStyle} ${glowBorder} h-[700px] flex flex-col relative overflow-hidden`}>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth custom-scrollbar">
                  {messages.length === 0 && <WelcomeUI content={courseData.content} />}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                      <div className={`max-w-[85%] p-6 rounded-[2rem] text-[15px] leading-relaxed shadow-2xl ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-600/20' : 'bg-slate-800/40 border border-white/5 text-slate-200 rounded-tl-none backdrop-blur-md'}`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {loading && <div className="flex gap-2 p-4 animate-pulse"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"/><div className="w-1.5 h-1.5 bg-purple-500 rounded-full"/><div className="w-1.5 h-1.5 bg-pink-500 rounded-full"/></div>}
                </div>
                <div className="p-8 border-t border-white/5 bg-black/20 backdrop-blur-xl">
                  <div className="relative group">
                    <input 
                      type="text" value={input} onChange={(e)=>setInput(e.target.value)}
                      onKeyPress={(e)=>e.key==='Enter' && handleSendMessage()}
                      placeholder="Access neural knowledge base..."
                      className="w-full bg-black/60 border border-white/10 rounded-[1.5rem] py-5 pl-8 pr-16 focus:border-indigo-500 outline-none text-white transition-all shadow-inner"
                    />
                    <button onClick={handleSendMessage} disabled={loading} className="absolute right-3 top-3 bottom-3 px-6 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-all text-white shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50">
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {view === 'admin' && (
              <div className={`${glassStyle} p-10 space-y-8 animate-in zoom-in-95 duration-500 bg-slate-900/90`}>
                <div className="flex items-center gap-4">
                  <ShieldCheck className="text-indigo-400" size={32} />
                  <h2 className="text-2xl font-black uppercase tracking-tight">Neural Console</h2>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Knowledge Injection Port</p>
                  <textarea 
                    value={adminInput} onChange={(e)=>setAdminInput(e.target.value)}
                    placeholder="Paste lesson data for AI training..."
                    className="w-full h-64 bg-black/60 border border-white/10 rounded-3xl p-8 text-sm focus:border-indigo-500 outline-none text-slate-300 leading-relaxed"
                  />
                  <div className="flex gap-4">
                    <button onClick={async ()=>{
                      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'course_config', 'main'), { content: adminInput, lastUpdated: serverTimestamp() });
                      alert("Sync Complete.");
                    }} className="flex-1 py-5 bg-indigo-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-indigo-600/20">
                      Synchronize Pathways
                    </button>
                    <button onClick={handleMockSync} className="px-10 py-5 border border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/5 transition-colors">
                      Inject Mock Data
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ASIDE / LEADERBOARD */}
          <aside className="lg:col-span-4 space-y-8">
            <div className={`${glassStyle} p-8 relative overflow-hidden bg-slate-900/40`}>
              <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] mb-8 border-b border-white/5 pb-4 flex items-center gap-2">
                <Globe size={14} className="text-indigo-400" /> Sector Rankings
              </h3>
              <div className="space-y-4">
                {leaderboard.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all">
                    <span className="text-xs font-bold text-slate-400">#0{i+1} {entry.username || 'Agent_X'}</span>
                    <span className="text-sm font-black text-indigo-400">{entry.score || 0}</span>
                  </div>
                ))}
                {leaderboard.length === 0 && <p className="text-center py-10 text-[10px] font-black text-slate-600 uppercase tracking-widest">No Sector Data</p>}
              </div>
            </div>
            
            <div className="p-8 rounded-[2.5rem] bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-between group hover:bg-indigo-600/15 transition-all">
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Neural Load</p>
                <p className="text-xl font-black text-white">98.4% Efficiency</p>
              </div>
              <Cpu className="text-indigo-500 animate-pulse group-hover:scale-110 transition-transform" />
            </div>
          </aside>
        </main>

        <footer className="pt-10 pb-4 text-center border-t border-white/5">
          <a href="#" className="text-[10px] text-slate-600 hover:text-indigo-400 transition-colors uppercase tracking-[0.4em] font-black">
            Security & Privacy Protocols
          </a>
        </footer>
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all font-black text-xs uppercase tracking-widest ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/40 scale-105' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
      {icon} <span>{label}</span>
    </button>
  );
}

function WelcomeUI({ content }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-sm mx-auto animate-in fade-in zoom-in duration-700">
      <div className="w-24 h-24 bg-indigo-500/10 rounded-[2.5rem] flex items-center justify-center text-indigo-400 relative">
        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl animate-pulse rounded-full" />
        <BrainCircuit size={48} className="relative z-10" />
      </div>
      <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Neural Interface Ready</h2>
      <p className="text-slate-500 text-sm font-medium leading-relaxed">
        {content ? "The link is primed with course data. Proceed with your inquiry." : "Awaiting knowledge injection via the secure administrator console."}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="h-screen bg-[#020205] flex flex-col items-center justify-center space-y-10">
      <NeuralLogo />
      <div className="text-center space-y-2">
        <p className="text-indigo-400 font-black tracking-[0.5em] uppercase text-[10px] animate-pulse">Initializing Neural Link</p>
      </div>
    </div>
  );
}

function FailureState({ error }) {
  return (
    <div className="h-screen bg-[#020205] flex flex-col items-center justify-center p-6 text-center">
      <AlertCircle size={48} className="text-red-500 mb-6" />
      <h2 className="text-xl font-black text-white uppercase tracking-widest">Protocol Failure</h2>
      <p className="text-slate-600 mt-2 text-[10px] uppercase font-bold tracking-widest">{error}</p>
      <button onClick={() => window.location.reload()} className="mt-10 px-10 py-4 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl">Reboot Initialization</button>
    </div>
  );
    }
