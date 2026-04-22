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
  Command, Cpu, Layers
} from 'lucide-react';

/**
 * 1. DESIGN CONSTANTS & ASSETS
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

// OPULENT STYLING
const glassStyle = "bg-slate-950/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-700";
const glowBorder = "ring-1 ring-white/10 shadow-[0_0_20px_rgba(99,102,241,0.15)] hover:shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-shadow duration-500";

// PREMIUM LOGO COMPONENT (Fortune 500 Abstract Neural Prism)
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
  const [isAdmin, setIsAdmin] = useState(true);
  const [view, setView] = useState('chat');
  const [authError, setAuthError] = useState(null);
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [courseData, setCourseData] = useState({ content: "", lastUpdated: null });
  const [leaderboard, setLeaderboard] = useState([]);
  const [adminInput, setAdminInput] = useState('');

  const scrollRef = useRef(null);

  // LOGO & FAVICON INJECTION
  useEffect(() => {
    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/x-icon'; link.rel = 'shortcut icon';
    link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%236366F1"/></svg>';
    document.getElementsByTagName('head')[0].appendChild(link);
    document.title = "Companion Pro | Neural Interface";
  }, []);

  useEffect(() => {
    const connectionTimeout = setTimeout(() => { if (!auth.currentUser) setAuthError("CONNECTION_TIMEOUT"); }, 15000);

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
        clearTimeout(connectionTimeout);
        setUser(u);
        const tokenResult = await getIdTokenResult(u);
        // DEV OVERRIDE: If you want to force admin view for testing, 
        // you can also check for a specific email or UID here.
        setIsAdmin(tokenResult.claims.whopRole === 'admin' || u.isAnonymous === false); 
      }
    });

    return () => { clearTimeout(connectionTimeout); unsubscribe(); };
  }, [initialAuthToken]);

  useEffect(() => {
    if (!user) return;
    const unsubCourse = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'course_config', 'main'), (s) => s.exists() && setCourseData(s.data() as any));
    const unsubBoard = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard'), (s) => {
      setLeaderboard(s.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a,b) => (b.score||0)-(a.score||0)).slice(0, 5));
    });
    return () => { unsubCourse(); unsubBoard(); };
  }, [user]);

  // KILLER FEATURE: Mock Data Hydration (For Testing)
  const handleMockSync = async () => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'course_config', 'main'), {
      content: "This is a Mock Course about AI SaaS development. It covers Firebase, Gemini API, and Whop integration.",
      lastUpdated: serverTimestamp(),
      version: "1.0.0-mock"
    });
    alert("Neural Pathways Hydrated with Mock Data!");
  };

  if (authError) return <FailureState error={authError} />;

  if (!user) return <LoadingState />;

  return (
    <div className="min-h-screen bg-[#05050a] text-slate-200 p-4 md:p-10 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* BACKGROUND GRAPHIC ELEMENTS */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 30-30 30L0 30z' fill='%23ffffff' fill-rule='evenodd'/%3E%3C/svg%3E")` }} />
      </div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* NAV: TOP TIER BRANDING */}
        <nav className="flex flex-col md:flex-row items-center justify-between gap-8 p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-6">
            <NeuralLogo />
            <div>
              <h1 className="text-2xl font-black text-white tracking-[-0.05em] uppercase flex items-center gap-2">
                Companion<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Pro</span>
              </h1>
              <div className="flex items-center gap-3">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-[0.3em]">Quantum Link Established</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-1.5 bg-black/40 rounded-[1.2rem] border border-white/5">
            <NavBtn active={view==='chat'} onClick={()=>setView('chat')} icon={<BrainCircuit size={18}/>} label="Tutor" />
            <NavBtn active={view==='quiz'} onClick={()=>setView('quiz')} icon={<Trophy size={18}/>} label="Arena" />
            {isAdmin && <NavBtn active={view==='admin'} onClick={()=>setView('admin')} icon={<Terminal size={18}/>} label="Console" />}
          </div>
        </nav>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {view === 'chat' && (
              <div className={`${glassStyle} ${glowBorder} h-[750px] flex flex-col relative`}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth custom-scrollbar">
                  {messages.length === 0 && <WelcomeUI content={courseData.content} />}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                      <div className={`max-w-[80%] p-5 rounded-[2rem] text-[15px] leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/20 rounded-tr-none' : 'bg-white/5 border border-white/5 text-slate-100 rounded-tl-none backdrop-blur-md'}`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {loading && <div className="flex gap-2 p-4 animate-pulse"><div className="w-2 h-2 bg-indigo-500 rounded-full"/><div className="w-2 h-2 bg-purple-500 rounded-full"/><div className="w-2 h-2 bg-pink-500 rounded-full"/></div>}
                </div>
                <div className="p-8 border-t border-white/5 bg-slate-950/50 rounded-b-[2.5rem]">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-10 group-focus-within:opacity-30 transition duration-1000" />
                    <input 
                      type="text" value={input} onChange={(e)=>setInput(e.target.value)}
                      onKeyPress={(e)=>e.key==='Enter' && handleSendMessage()}
                      placeholder="Input inquiry to neural tutor..."
                      className="relative w-full bg-black border border-white/10 rounded-2xl py-5 pl-7 pr-20 focus:border-indigo-500 outline-none text-white transition-all"
                    />
                    <button onClick={handleSendMessage} className="absolute right-3 top-3 bottom-3 px-6 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-all text-white flex items-center gap-2 font-bold uppercase text-xs tracking-widest shadow-lg shadow-indigo-600/30">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {view === 'admin' && (
              <div className={`${glassStyle} ${glowBorder} p-10 space-y-8 animate-in zoom-in-95 duration-500`}>
                <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl"><ShieldCheck className="text-indigo-400" /></div>
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter">Neural Console</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Administrator Access Level 01</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Injection Context (Course Material)</label>
                  <textarea 
                    value={adminInput} onChange={(e)=>setAdminInput(e.target.value)}
                    placeholder="Paste your course knowledge here..."
                    className="w-full h-64 bg-black border border-white/10 rounded-3xl p-6 text-sm text-slate-300 focus:border-indigo-500 outline-none transition-all leading-relaxed"
                  />
                  <div className="flex gap-4">
                    <button onClick={async ()=>{
                      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'course_config', 'main'), { content: adminInput, lastUpdated: serverTimestamp() });
                      alert("Knowledge Base Updated Successfully.");
                    }} className="flex-1 py-5 bg-indigo-600 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all">
                      Synchronize Neural Net
                    </button>
                    <button onClick={handleMockSync} className="px-8 py-5 border border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] text-slate-400 hover:bg-white/5 transition-all">
                      Hydrate Mock
                    </button>
                  </div>
                </div>
              </div>
            )}

            {view === 'quiz' && (
              <div className={`${glassStyle} ${glowBorder} p-20 text-center space-y-6 relative overflow-hidden`}>
                <Layers className="absolute -top-10 -right-10 w-64 h-64 text-indigo-500/5 rotate-12" />
                <div className="w-24 h-24 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-full mx-auto flex items-center justify-center shadow-2xl shadow-orange-500/20">
                  <Trophy size={40} className="text-white" />
                </div>
                <h2 className="text-4xl font-black uppercase tracking-tighter text-white">The Knowledge Arena</h2>
                <p className="text-slate-400 max-w-md mx-auto leading-relaxed">Battle through high-frequency quizzes generated from your course material. Mode currently calibrating neural weights.</p>
                <div className="pt-8">
                  <span className="px-6 py-2 bg-white/5 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Available in Version 1.1</span>
                </div>
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 space-y-8">
            <div className={`${glassStyle} ${glowBorder} p-8 space-y-8 relative overflow-hidden`}>
               <div className="absolute top-0 right-0 p-4"><Globe size={24} className="text-white/5" /></div>
              <div className="border-b border-white/5 pb-4">
                <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Global Rankings</h3>
              </div>
              <div className="space-y-4">
                {leaderboard.map((entry, i) => (
                  <div key={entry.id || i} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/50 transition-all group">
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${i===0?'bg-amber-500/20 text-amber-500':'bg-white/5 text-slate-500'}`}>0{i+1}</span>
                      <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{entry.username || 'Agent_Anon'}</span>
                    </div>
                    <span className="text-sm font-black text-indigo-400">{entry.score || 0}</span>
                  </div>
                ))}
                {leaderboard.length === 0 && <p className="text-center py-10 text-[10px] font-black text-slate-600 uppercase tracking-widest">No Sector Champions Found</p>}
              </div>
            </div>

            <div className="p-8 rounded-[2rem] bg-indigo-600/10 border border-indigo-500/20 flex items-center gap-6 group hover:bg-indigo-600/20 transition-all cursor-pointer">
              <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/40 group-hover:rotate-12 transition-transform">
                <Cpu size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Neural Load</p>
                <p className="text-xl font-black text-white">98.4% Efficiency</p>
              </div>
            </div>
          </aside>
        </main>

        <footer className="pt-10 pb-4 text-center border-t border-white/5">
          <a 
            href="https://gist.githubusercontent.com/piksen-digital/b944c5ba017dfc5c3d53d7eb1b195112/raw/c43575c9a525c37de3ec2e914d0c2129502ad02f/privacy-policy.md" 
            target="_blank" 
            className="text-[10px] text-slate-600 hover:text-indigo-400 transition-colors uppercase tracking-[0.3em] font-black"
          >
            Security & Privacy Protocols
          </a>
        </footer>
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
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: userText }] }], 
          systemInstruction: { parts: [{ text: `You are the Companion Pro AI. Analyze this course data: ${courseData.content || 'None available'}. Provide elite, concise tutoring.` }] } 
        })
      });
      const data = await res.json();
      setMessages(p => [...p, { role: 'assistant', text: data.candidates?.[0]?.content?.parts?.[0]?.text || "Protocol offline." }]);
    } catch (e) { setMessages(p => [...p, { role: 'assistant', text: "Neural link lost." }]); }
    finally { setLoading(false); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }
  }
}

// SUB-COMPONENTS FOR CLEANLINESS
function NavBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all font-black text-xs uppercase tracking-widest ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 scale-105' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
      {icon} <span>{label}</span>
    </button>
  );
}

function WelcomeUI({ content }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-sm mx-auto">
      <div className="w-24 h-24 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center text-indigo-400 relative">
        <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" />
        <Command size={48} className="relative z-10" />
      </div>
      <h2 className="text-3xl font-black uppercase tracking-tighter">Ready for Instruction</h2>
      <p className="text-slate-500 text-sm font-medium leading-relaxed">
        {content ? "The neural pathways have been primed with course data. Proceed with your inquiry." : "I am awaiting knowledge injection via the administrator console."}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="h-screen bg-[#05050a] flex flex-col items-center justify-center space-y-10">
      <div className="relative">
        <div className="w-32 h-32 border-2 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center"><NeuralLogo /></div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-indigo-400 font-black tracking-[0.5em] uppercase text-xs animate-pulse">Initializing Neural Link</p>
        <p className="text-[10px] text-slate-700 uppercase font-bold tracking-widest">Decoding Quantum Credentials</p>
      </div>
    </div>
  );
}

function FailureState({ error }) {
  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <AlertCircle size={64} className="text-red-500 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
      <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">System Malfunction</h2>
      <p className="text-slate-500 mb-10 max-w-xs uppercase text-[10px] font-black tracking-[0.2em]">{error}</p>
      <button onClick={() => window.location.reload()} className="px-12 py-5 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all shadow-2xl">Reboot Interface</button>
    </div>
  );
}
