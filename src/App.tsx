/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { User, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './lib/firebase';
import toast, { Toaster } from "react-hot-toast";
import Dashboard from './components/Dashboard';
import DeadlineEditor from './components/DeadlineEditor';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'editor'>('dashboard');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return <div className="h-full flex items-center justify-center font-sans bg-zinc-950 text-white">Загрузка...</div>;
  }

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950 font-sans p-4">
        <Toaster position="top-right" toastOptions={{ style: { background: '#27272a', color: '#fff' } }} />
        <div className="glass-panel w-full max-w-sm rounded-2xl p-8 accent-glow border-blue-500/30">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">Вход в систему</h1>
            <p className="text-zinc-400">Войдите для доступа к дашборду</p>
          </div>
          <button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all"
            onClick={async () => {
              try {
                await signInWithPopup(auth, new GoogleAuthProvider());
              } catch (error: any) {
                console.error("Sign in error:", error);
                toast.error("Ошибка авторизации: " + (error.message || "Неизвестная ошибка"));
              }
            }}
          >
            Войти с Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-zinc-950 flex font-sans overflow-hidden">
      <Toaster position="top-right" toastOptions={{ style: { background: '#27272a', color: '#fff' } }} />
      
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col justify-between p-6 h-full flex-shrink-0">
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold">D</div>
              <h1 className="text-xl font-bold tracking-tight text-white">DataFlux</h1>
            </div>
            
            <nav className="space-y-4">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center gap-3 font-medium p-2 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-zinc-800/50 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                Главная
              </button>
              
              <button 
                onClick={() => setActiveTab('editor')}
                className={`w-full flex items-center gap-3 font-medium p-2 rounded-lg transition-colors ${activeTab === 'editor' ? 'bg-zinc-800/50 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Расписание потоков
              </button>
            </nav>
          </div>
        </div>
        
        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 cursor-pointer" onClick={() => auth.signOut()}>
          <p className="text-xs text-blue-400 font-semibold mb-1">Выйти</p>
          <p className="text-sm text-zinc-300 truncate" title={user.email || ''}>{user.email}</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full bg-zinc-950 overflow-hidden">
        <header className="h-20 border-b border-zinc-800 flex items-center justify-end px-8 bg-zinc-900/30 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-white font-medium">Администратор</p>
              <p className="text-xs text-zinc-500">{user.email}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
              {user.photoURL ? <img src={user.photoURL} alt="avatar" /> : <div className="text-zinc-500">A</div>}
            </div>
          </div>
        </header>
        
        <div className="flex-1 p-8 overflow-auto">
          {activeTab === 'dashboard' ? <Dashboard /> : <DeadlineEditor />}
        </div>
      </main>
    </div>
  );
}

